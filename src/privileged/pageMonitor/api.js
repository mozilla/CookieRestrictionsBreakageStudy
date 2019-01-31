"use strict";

/* global AddonManager, ExtensionAPI, ExtensionCommon, ExtensionUtils, Services */
ChromeUtils.defineModuleGetter(this, "AddonManager", "resource://gre/modules/AddonManager.jsm");
/* eslint-disable no-var */
var {AppConstants} = ChromeUtils.import("resource://gre/modules/AppConstants.jsm", {});
var {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm", {});
var {EventManager, EventEmitter} = ExtensionCommon;
var {Management} = ChromeUtils.import("resource://gre/modules/Extension.jsm", null);
var tabTracker = Management.global.tabTracker;
/* eslint-enable no-var */

ChromeUtils.defineModuleGetter(
  this,
  "BrowserWindowTracker",
  "resource:///modules/BrowserWindowTracker.jsm",
);

/** Return most recent NON-PRIVATE browser window, so that we can
 * manipulate chrome elements on it.
 */
function getMostRecentBrowserWindow() {
  return BrowserWindowTracker.getTopWindow({
    private: false,
    allowPopups: false,
  });
}

class PageMonitorEventEmitter extends EventEmitter {
  emitReportBreakage(tabId) {
    this.emit("report-breakage", tabId);
  }
  emitPageBeforeUnload(tabId, data) {
    this.emit("page-before-unload", tabId, data);
  }
  emitPageDOMContentLoaded(tabId, data) {
    this.emit("page-DOMContentLoaded", tabId, data);
  }
  emitErrorDetected(error, tabId) {
    const recentWindow = getMostRecentBrowserWindow();
    const hasException = Services.perms.testExactPermissionFromPrincipal(recentWindow.gBrowser.contentPrincipal, "trackingprotection") === Services.perms.ALLOW_ACTION;
    this.emit("page-error-detected", error, tabId, hasException);
  }
  emitExceptionSuccessfullyAdded(tabId) {
    this.emit("exception-added", tabId);
  }
  emitHasException(hasException) {
    this.emit("has-exception", hasException);
  }
  emitPlatform(platform) {
    this.emit("platform-found", platform);
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
          mm.removeMessageListener("CookieRestrictions:beforeunload", this.pageBeforeUnloadCallback);
          mm.removeMessageListener("CookieRestrictions:DOMContentLoaded", this.pageDOMContentLoadedCallback);
          mm.removeMessageListener("CookieRestrictions:pageError", this.pageErrorCallback);

          const shieldIcon = win.document.getElementById("tracking-protection-icon-box");
          const trackingProtectionSection = win.document.getElementById("tracking-protection-container");
          shieldIcon.style.display = "";
          trackingProtectionSection.style.display = "";
        },
        async pageErrorCallback(e) {
          const tabId = tabTracker.getBrowserTabId(e.target);
          pageMonitorEventEmitter.emitErrorDetected(e.data, tabId);
        },
        async pageBeforeUnloadCallback(e) {
          const tabId = tabTracker.getBrowserTabId(e.target);
          try {
            e.data.telemetryData.etld =
              Services.eTLD.getBaseDomainFromHost(e.data.telemetryData.origin);
          } catch (error) {
            return;
          }
          pageMonitorEventEmitter.emitPageBeforeUnload(tabId, e.data.telemetryData);
        },
        async pageDOMContentLoadedCallback(e) {
          const tabId = tabTracker.getBrowserTabId(e.target);
          try {
            e.data.telemetryData.etld =
              Services.eTLD.getBaseDomainFromHost(e.data.telemetryData.origin);
          } catch (error) {
            return;
          }

          pageMonitorEventEmitter.emitPageDOMContentLoaded(tabId, e.data.telemetryData);
        },
        async setListeners(win) {
          const mm = win.getGroupMessageManager("browsers");
          // We pass "true" as the third argument to signify that we want to listen
          // to messages even when the framescript is unloading, to catch tabs closing.
          mm.addMessageListener("CookieRestrictions:beforeunload", this.pageBeforeUnloadCallback, true);
          mm.addMessageListener("CookieRestrictions:DOMContentLoaded", this.pageDOMContentLoadedCallback, true);
          mm.addMessageListener("CookieRestrictions:pageError", this.pageErrorCallback);

          mm.loadFrameScript(context.extension.getURL("privileged/pageMonitor/framescript.js"), true);

          const shieldIcon = win.document.getElementById("tracking-protection-icon-box");
          const trackingProtectionSection = win.document.getElementById("tracking-protection-container");
          shieldIcon.style.display = "none";
          trackingProtectionSection.style.display = "none";
        },

        async init(extensionSetExceptions) {
          this.extensionSetExceptions = extensionSetExceptions;
          EveryWindow.registerCallback("set-content-listeners", this.setListeners.bind(this), this.unmount.bind(this));

          // Listen for addon disabling or uninstall.
          AddonManager.addAddonListener(this);
        },

        async addException(currentOrigin) {
          const recentWindow = getMostRecentBrowserWindow();
          const tabId = tabTracker.getBrowserTabId(recentWindow.gBrowser.selectedBrowser);
          const hasException = Services.perms.testExactPermissionFromPrincipal(recentWindow.gBrowser.contentPrincipal, "trackingprotection") === Services.perms.ALLOW_ACTION;
          if (!hasException) {
            const addExceptionButton = recentWindow.document.getElementById("tracking-action-unblock");
            addExceptionButton.doCommand();
            this.extensionSetExceptions.push(currentOrigin);
            pageMonitorEventEmitter.emitExceptionSuccessfullyAdded(tabId);
          }
        },

        removeExceptions(domains) {
          for (const domain of domains) {
            Services.perms.remove(Services.io.newURI(domain), "trackingprotection");
          }
        },

        testPermission() {
          const recentWindow = getMostRecentBrowserWindow();
          const hasException = Services.perms.testExactPermissionFromPrincipal(recentWindow.gBrowser.contentPrincipal, "trackingprotection") === Services.perms.ALLOW_ACTION;
          pageMonitorEventEmitter.emitHasException(hasException);
        },

        testPlatform() {
          pageMonitorEventEmitter.emitPlatform(AppConstants.platform);
        },

        onUninstalling(addon) {
          this.handleDisableOrUninstall(addon);
        },

        onDisabled(addon) {
          this.handleDisableOrUninstall(addon);
        },

        handleDisableOrUninstall(addon) {
          this.removeExceptions(this.extensionSetExceptions);
          if (addon.id !== context.extension.id) {
            return;
          }

          AddonManager.removeAddonListener(this);
          // This is needed even for onUninstalling, because it nukes the addon
          // from UI. If we don't do this, the user has a chance to "undo".
          addon.uninstall();
        },

        onHasExceptionResults: new EventManager(
          context,
          "pageMonitor.onHasExceptionResults",
          fire => {
            const listener = (value, hasException) => {
              fire.async(hasException);
            };
            pageMonitorEventEmitter.on(
              "has-exception",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "has-exception",
                listener,
              );
            };
          },
        ).api(),

        onPlatformResult: new EventManager(
          context,
          "pageMonitor.onPlatformResult",
          fire => {
            const listener = (value, platform) => {
              fire.async(platform);
            };
            pageMonitorEventEmitter.on(
              "platform-found",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "platform-found",
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

        onPageDOMContentLoaded: new EventManager(
          context,
          "pageMonitor.onPageDOMContentLoaded",
          fire => {
            const listener = (value, tabId, data) => {
              fire.async(tabId, data);
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
            const listener = (value, error, tabId, hasException) => {
              fire.async(error, tabId, hasException);
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

        onExceptionAdded: new EventManager(
          context,
          "pageMonitor.onExceptionAdded",
          fire => {
            const listener = (value, tabId, hasException) => {
              fire.async(tabId, hasException);
            };
            pageMonitorEventEmitter.on(
              "exception-added",
              listener,
            );
            return () => {
              pageMonitorEventEmitter.off(
                "exception-added",
                listener,
              );
            };
          },
        ).api(),

      },
    };
  }
};
