"use strict";

/* global ExtensionAPI */
/* eslint-disable no-var */
var {ExtensionCommon} = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm", {});
var {AppConstants} = ChromeUtils.import("resource://gre/modules/AppConstants.jsm", {});
var {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm", {});
var {EventManager, EventEmitter} = ExtensionCommon;
var {Management} = ChromeUtils.import("resource://gre/modules/Extension.jsm", null);
var tabTracker = Management.global.tabTracker;
/* eslint-enable no-var */

function loadStyles(resourceURI, sheet) {
  const styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);
  const styleURI = styleSheet(resourceURI, sheet);
  const sheetType = styleSheetService.AGENT_SHEET;
  styleSheetService.loadAndRegisterSheet(styleURI, sheetType);
}

function styleSheet(resourceURI, sheet) {
  return Services.io.newURI(sheet, null, Services.io.newURI(resourceURI));
}

function unloadStyles(resourceURI, sheet) {
  const styleURI = styleSheet(resourceURI, sheet);
  const styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);
  const sheetType = styleSheetService.AGENT_SHEET;
  if (styleSheetService.sheetRegistered(styleURI, sheetType)) {
    styleSheetService.unregisterSheet(styleURI, sheetType);
  }
}

// eslint-disable-next-line no-undef
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

class PopupNotificationEventEmitter extends EventEmitter {
  emitClose() {
    if (this.cookieRestrictionsBanner) {
      this.cookieRestrictionsBanner.close();
    }
  }
  emitShow(location, iconURL) {
    const self = this;
    const recentWindow = getMostRecentBrowserWindow();
    const browser = recentWindow.gBrowser.selectedBrowser;
    const tabId = tabTracker.getBrowserTabId(browser);
    const notificationBox = recentWindow.gBrowser.getNotificationBox(browser);

    const userWillSubmit = () => {
      self.emit("page-fixed", tabId, location);
      notificationBox.appendNotification(
        "Thanks for helping us improve Firefox.", // message
        "cookie-restrictions-breakage-thanks", // value
        iconURL, // icon
        notificationBox.PRIORITY_INFO_HIGH,
        [
          {
            disableHighlight: true,
            label: "Close",
            accessKey: "c",
            callback: () => {},
          },
        ],
        null,
      );
    };

    const userWillNotSubmit = () => {
      self.emit("page-fixed", tabId, "");
      notificationBox.appendNotification(
        "Domain not sent. We respect your privacy!", // message
        "cookie-restrictions-breakage-not-sent", // value
        iconURL, // icon
        notificationBox.PRIORITY_INFO_HIGH,
        [
          {
            disableHighlight: true,
            label: "Close",
            accessKey: "c",
            callback: () => {},
          },
        ],
        (e) => { self.emit("page-fixed", tabId, ""); },
      );
    };

    const pageWasFixedCB = () => {
      notificationBox.appendNotification(
        `Submit ${location} to Firefox? This will help us learn more about what broke.`, // message
        "cookie-restrictions-breakage-report-url", // value
        iconURL, // icon
        notificationBox.PRIORITY_INFO_HIGH,
        [
          {
            disableHighlight: true,
            label: "Yes",
            accessKey: "y",
            callback: userWillSubmit,
          },
          {
            label: "No",
            accessKey: "n",
            callback: userWillNotSubmit,
          },
        ],
        (e) => { self.emit("page-fixed", tabId, ""); },
      );
    };

    const pageNotFixedCB = () => {
      self.emit("page-not-fixed", tabId);
      notificationBox.appendNotification(
        `Sorry we couldn't fix ${location}. This means Firefox privacy settings likely didn't cause the problem.`, // message
        "cookie-restrictions-breakage-not-fixed", // value
        iconURL, // icon
        notificationBox.PRIORITY_INFO_HIGH,
        [
          {
            disableHighlight: true,
            label: "Close",
            accessKey: "c",
            callback: () => {},
          },
        ],
        null,
      );
    };

    const label = `Firefox tried to fix the site and reloaded the page. Is ${location} working properly now?`;
    self.cookieRestrictionsBanner = notificationBox.appendNotification(
      label, // message
      "cookie-restrictions-breakage", // value
      iconURL, // icon
      notificationBox.PRIORITY_INFO_HIGH,
      [
        {
          disableHighlight: true,
          label: "Yes",
          accessKey: "y",
          callback: pageWasFixedCB,
        },
        {
          label: "No",
          accessKey: "n",
          callback: pageNotFixedCB,
        },
      ],
      // callback for nb events
      null,
    );

    // Banner will persist across navigations 100 times.
    self.cookieRestrictionsBanner.persistence = 100;
    // Add listener for clicking close button to send telemetry when user manually dismisses.
    const closeButton = self.cookieRestrictionsBanner.querySelector(".messageCloseButton");
    closeButton.addEventListener("click", () => { self.emit("banner-closed", tabId); });
  }
}

this.popupNotification = class extends ExtensionAPI {
  constructor(extension) {
    super(extension);
    this.extension = extension;
    loadStyles(this.extension.baseURI.spec, "prompt.css");
    this.platform = AppConstants.platform;
    if (this.platform === "macosx") {
      loadStyles(this.extension.baseURI.spec, "prompt-mac.css");
    }
  }
  /**
   * Extension Shutdown
   * Goes through each tab for each window and removes the notification, if it exists.
   */
  onShutdown(shutdownReason) {
    unloadStyles(this.extension.baseURI.spec, "prompt.css");
    if (this.platform === "macosx") {
      unloadStyles(this.extension.baseURI.spec, "prompt-mac.css");
    }
    for (const win of BrowserWindowTracker.orderedWindows) {
      const notificationBox = win.gBrowser.getNotificationBox();
      if (notificationBox.getNotificationWithValue("cookie-restrictions-breakage")) {
        notificationBox.getNotificationWithValue("cookie-restrictions-breakage").close();
      }
      if (notificationBox.getNotificationWithValue("cookie-restrictions-breakage-not-fixed")) {
        notificationBox.getNotificationWithValue("cookie-restrictions-breakage-not-fixed").close();
      }
      if (notificationBox.getNotificationWithValue("cookie-restrictions-breakage-report-url")) {
        notificationBox.getNotificationWithValue("cookie-restrictions-breakage-report-url").close();
      }
      if (notificationBox.getNotificationWithValue("cookie-restrictions-breakage-not-sent")) {
        notificationBox.getNotificationWithValue("cookie-restrictions-breakage-not-sent").close();
      }
      if (notificationBox.getNotificationWithValue("cookie-restrictions-thanks")) {
        notificationBox.getNotificationWithValue("cookie-restrictions-thanks").close();
      }
    }
  }

  getAPI(context) {
    const popupNotificationEventEmitter = new PopupNotificationEventEmitter();
    const self = this;
    return {
      popupNotification: {
        show(location) {
          popupNotificationEventEmitter.emitShow(location, self.extension.getURL("../../icons/firefox-silhouette.svg"));
        },
        close() {
          popupNotificationEventEmitter.emitClose();
        },
        onReportPageFixed: new EventManager(
          context,
          "popupNotification.onReportPageFixed",
          fire => {
            const listener = (value, tabId, location) => {
              fire.async(tabId, location);
            };
            popupNotificationEventEmitter.on(
              "page-fixed",
              listener,
            );
            return () => {
              popupNotificationEventEmitter.off(
                "page-fixed",
                listener,
              );
            };
          },
        ).api(),
        onReportPageNotFixed: new EventManager(
          context,
          "popupNotification.onReportPageNotFixed",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            popupNotificationEventEmitter.on(
              "page-not-fixed",
              listener,
            );
            return () => {
              popupNotificationEventEmitter.off(
                "page-not-fixed",
                listener,
              );
            };
          },
        ).api(),
        onReportClosed: new EventManager(
          context,
          "popupNotification.onReportClosed",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            popupNotificationEventEmitter.on(
              "banner-closed",
              listener,
            );
            return () => {
              popupNotificationEventEmitter.off(
                "banner-closed",
                listener,
              );
            };
          },
        ).api(),
      },
    };
  }
};
