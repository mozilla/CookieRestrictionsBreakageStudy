"use strict";

/* global ExtensionAPI */

ChromeUtils.import("resource://gre/modules/Console.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

/* eslint-disable-next-line */
var {EventManager, EventEmitter} = ExtensionCommon;
/* eslint-disable-next-line no-var */
var {Management: {global: {tabTracker}}} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});

function loadStyles(resourceURI) {
  const styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);
  const styleURI = styleSheet(resourceURI);
  const sheetType = styleSheetService.AGENT_SHEET;
  styleSheetService.loadAndRegisterSheet(styleURI, sheetType);
}

function styleSheet(resourceURI) {
  return Services.io.newURI("prompt.css", null, Services.io.newURI(resourceURI));
}

function unloadStyles(resourceURI) {
  const styleURI = styleSheet(resourceURI);
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
  emitShow(location) {
    const self = this;
    const recentWindow = getMostRecentBrowserWindow();
    const browser = recentWindow.gBrowser.selectedBrowser;
    const tabId = tabTracker.getBrowserTabId(browser);

    const userWillSubmit = () => {
      self.emit("page-fixed", tabId, location);
      notificationBox.appendNotification(
        "Thanks for helping us improve Firefox.", // message
        "cookie-restrictions-breakage-thanks", // value
        null, // icon
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
        null, // icon
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

    const pageWasFixedCB = () => {
      notificationBox.appendNotification(
        `Submit ${location} to Firefox? This will help us learn more about what broke.`, // message
        "cookie-restrictions-breakage-report-url", // value
        null, // icon
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
        null,
      );
    };

    const pageNotFixedCB = () => {
      self.emit("page-not-fixed", tabId);
      notificationBox.appendNotification(
        `Sorry we couldn't fix ${location}. This means Firefox privacy settings likely didn't cause the problem.`, // message
        "cookie-restrictions-breakage-not-fixed", // value
        null, // icon
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
    const notificationBox = recentWindow.gBrowser.getNotificationBox();
    self.cookieRestrictionsBanner = notificationBox.appendNotification(
      label, // message
      "cookie-restrictions-breakage", // value
      null, // icon
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
    loadStyles(extension.baseURI.spec);
  }
  /**
   * Extension Shutdown
   * Goes through each tab for each window and removes the notification, if it exists.
   */
  onShutdown(shutdownReason) {
    unloadStyles(this.extension.baseURI.spec);
    for (const win of BrowserWindowTracker.orderedWindows) {
      for (const browser of win.gBrowser.browsers) {
        const notification = win.PopupNotifications.getNotification("cookie-restriction", browser);
        if (notification) {
          win.PopupNotifications.remove(notification);
        }
      }
    }
  }

  getAPI(context) {
    const popupNotificationEventEmitter = new PopupNotificationEventEmitter();
    return {
      popupNotification: {
        show(location) {
          popupNotificationEventEmitter.emitShow(location);
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
