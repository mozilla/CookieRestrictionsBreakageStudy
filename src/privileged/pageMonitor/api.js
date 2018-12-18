"use strict";

/* global AddonManager, ExtensionAPI, ExtensionCommon, ExtensionUtils, XPCOMUtils, Services */
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.defineModuleGetter(this, "AddonManager", "resource://gre/modules/AddonManager.jsm");

/* eslint-disable-next-line no-var */
var {EventManager, EventEmitter} = ExtensionCommon;
/* eslint-disable-next-line no-var */
var {Management: {global: {tabTracker}}} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});

ChromeUtils.defineModuleGetter(
  this,
  "BrowserWindowTracker",
  "resource:///modules/BrowserWindowTracker.jsm",
);

class PageMonitorEventEmitter extends EventEmitter {
  emitIdentityPopupShown(tabId) {
    this.emit("identity-popup-shown", tabId);
  }
  emitReportBreakage(tabId) {
    this.emit("report-breakage", tabId);
  }
  emitPageBeforeUnload(tabId, data) {
    this.emit("page-before-unload", tabId, data);
  }
  emitPageUnload(tabId, data) {
    this.emit("page-unload", tabId, data);
  }
  emitToggleException(tabId, toggleValue) {
    this.emit("exception-toggled", tabId, toggleValue);
  }
  emitPageDOMContentLoaded(tabId) {
    this.emit("page-DOMContentLoaded", tabId);
  }
  emitErrorDetected(error, tabId) {
    this.emit("page-error-detected", error, tabId);
  }
}

/* https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/functions.html */
this.pageMonitor = class extends ExtensionAPI {
  constructor(extension) {
    super(extension);
    this.framescriptUrl = extension.getURL("privileged/pageMonitor/framescript.js");
  }


  onShutdown(shutdownReason) {
    EveryWindow.unregisterCallback("set-content-listeners");
    for (const win of [...BrowserWindowTracker.orderedWindows]) {
      const mm = win.getGroupMessageManager("browsers");
      // Ensure the framescript will not be loaded in any newly opened tabs.
      mm.removeDelayedFrameScript(this.framescriptUrl);
    }
  }

  getAPI(context) {
    const pageMonitorEventEmitter = new PageMonitorEventEmitter();
    /* global EveryWindow */
    Services.scriptloader.loadSubScript(
      context.extension.getURL("privileged/pageMonitor/EveryWindow.js"));
    return {
      pageMonitor: {
        async unmount(win) {
          const mm = win.ownerGlobal.getGroupMessageManager("browsers");
          mm.removeMessageListener("CookieRestrictions:unload", this.pageUnloadCallback);
          mm.removeMessageListener("CookieRestrictions:beforeunload", this.pageBeforeUnloadCallback);
          mm.removeMessageListener("CookieRestrictions:DOMContentLoaded", this.pageDOMContentLoadedCallback);
          mm.removeMessageListener("CookieRestrictions:pageError", this.pageErrorCallback);

          win.gIdentityHandler._identityPopup.removeEventListener("popupshown", this.onIdentityPopupShownEvent);
        },
        async pageErrorCallback(e) {
          const tabId = tabTracker.getBrowserTabId(e.target);
          pageMonitorEventEmitter.emitErrorDetected(e.data, tabId);
        },
        async pageBeforeUnloadCallback(e) {
          const tabId = tabTracker.getBrowserTabId(e.target);
          let uri;
          try {
            uri = Services.io.newURI(e.data.telemetryData.completeLocation);
            e.data.telemetryData.etld =
              Services.eTLD.getBaseDomainFromHost(e.data.telemetryData.hostname);
          } catch (error) {
            return;
          }
          // Browser is never private, so type can always be "trackingprotection"
          e.data.telemetryData.user_has_tracking_protection_exception =
            Services.perms.testExactPermission(uri, "trackingprotection") === Services.perms.ALLOW_ACTION;
          e.data.telemetryData.completeLocation = null;
          uri = null;
          pageMonitorEventEmitter.emitPageBeforeUnload(tabId, e.data.telemetryData);
        },
        async pageUnloadCallback(e) {
          const tabId = tabTracker.getBrowserTabId(e.target);
          let uri;
          try {
            uri = Services.io.newURI(e.data.telemetryData.completeLocation);
            e.data.telemetryData.etld =
              Services.eTLD.getBaseDomainFromHost(e.data.telemetryData.hostname);
          } catch (error) {
            return;
          }
          // Browser is never private, so type can always be "trackingprotection"
          e.data.telemetryData.user_has_tracking_protection_exception =
            Services.perms.testExactPermission(uri, "trackingprotection") === Services.perms.ALLOW_ACTION;
          pageMonitorEventEmitter.emitPageUnload(tabId, e.data.telemetryData);
        },
        async pageDOMContentLoadedCallback(e) {
          const tabId = tabTracker.getBrowserTabId(e.target);
          pageMonitorEventEmitter.emitPageDOMContentLoaded(tabId);
        },
        onIdentityPopupShownEvent(e) {
          const win = e.target.ownerGlobal;
          const tabId = tabTracker.getBrowserTabId(win.gBrowser.selectedBrowser);
          pageMonitorEventEmitter.emitIdentityPopupShown(tabId);
        },
        async onToggleExceptionCommand(e) {
          const win = e.target.ownerGlobal;
          const tabId = tabTracker.getBrowserTabId(win.gBrowser.selectedBrowser);
          const addedException = this.id === "tracking-action-unblock";
          pageMonitorEventEmitter.emitToggleException(tabId, addedException);
        },
        async setListeners(win) {
          const mm = win.getGroupMessageManager("browsers");
          // We pass "true" as the third argument to signify that we want to listen
          // to messages even when the framescript is unloading, to catch tabs closing.
          mm.addMessageListener("CookieRestrictions:beforeunload", this.pageBeforeUnloadCallback, true);
          mm.addMessageListener("CookieRestrictions:unload", this.pageUnloadCallback, true);
          mm.addMessageListener("CookieRestrictions:DOMContentLoaded", this.pageDOMContentLoadedCallback, true);
          mm.addMessageListener("CookieRestrictions:pageError", this.pageErrorCallback);

          mm.loadFrameScript(context.extension.getURL("privileged/pageMonitor/framescript.js"), true);

          win.gIdentityHandler._identityPopup.addEventListener("popupshown", this.onIdentityPopupShownEvent);

          // The user has clicked "disable protection for this site"
          const addExceptionButton = win.document.getElementById("tracking-action-unblock");
          addExceptionButton.addEventListener("command", this.onToggleExceptionCommand);
          // The user has clicked the "enable protection" button
          const removeExceptionButton = win.document.getElementById("tracking-action-block");
          removeExceptionButton.addEventListener("command", this.onToggleExceptionCommand);
        },

        async init() {
          EveryWindow.registerCallback("set-content-listeners", this.setListeners.bind(this), this.unmount.bind(this));

          // Listen for addon disabling or uninstall.
          AddonManager.addAddonListener(this);
        },

        onUninstalling(addon) {
          this.handleDisableOrUninstall(addon);
        },

        onDisabled(addon) {
          this.handleDisableOrUninstall(addon);
        },

        handleDisableOrUninstall(addon) {
          if (addon.id !== context.extension.id) {
            return;
          }

          AddonManager.removeAddonListener(this);
          // This is needed even for onUninstalling, because it nukes the addon
          // from UI. If we don't do this, the user has a chance to "undo".
          addon.uninstall();
        },

        onPageUnload: new EventManager(
          context,
          "pageMonitor.onPageUnload",
          fire => {
            const listener = (value, tabId, data) => {
              fire.async(tabId, data);
            };
            pageMonitorEventEmitter.on(
              "page-unload",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "page-unload",
                listener,
              );
            };
          },
        ).api(),

        onPageBeforeUnload: new EventManager(
          context,
          "pageMonitor.onPageBeforeUnload",
          fire => {
            const listener = (value, tabId, data) => {
              fire.async(tabId, data);
            };
            pageMonitorEventEmitter.on(
              "page-before-unload",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "page-before-unload",
                listener,
              );
            };
          },
        ).api(),

        onIdentityPopupShown: new EventManager(
          context,
          "pageMonitor.onIdentityPopupShown",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            pageMonitorEventEmitter.on(
              "identity-popup-shown",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "identity-popup-shown",
                listener,
              );
            };
          },
        ).api(),

        onToggleException: new EventManager(
          context,
          "onToggleException",
          fire => {
            const listener = (value, tabId, toggleValue) => {
              fire.async(tabId, toggleValue);
            };
            pageMonitorEventEmitter.on(
              "exception-toggled",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "exception-toggled",
                listener,
              );
            };
          },
        ).api(),

        onPageDOMContentLoaded: new EventManager(
          context,
          "pageMonitor.onPageDOMContentLoaded",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            pageMonitorEventEmitter.on(
              "page-DOMContentLoaded",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "page-DOMContentLoaded",
                listener,
              );
            };
          },
        ).api(),

        onErrorDetected: new EventManager(
          context,
          "pageMonitor.onErrorDetected",
          fire => {
            const listener = (value, error, tabId) => {
              fire.async(error, tabId);
            };
            pageMonitorEventEmitter.on(
              "page-error-detected",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "page-error-detected",
                listener,
              );
            };
          },
        ).api(),

      },
    };
  }
};
