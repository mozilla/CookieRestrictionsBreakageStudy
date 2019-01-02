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
  emitShow(variationName) {
    const self = this;
    const recentWindow = getMostRecentBrowserWindow();
    const browser = recentWindow.gBrowser.selectedBrowser;
    const tabId = tabTracker.getBrowserTabId(browser);

    const notificationBox = recentWindow.gBrowser.getNotificationBox();
    notificationBox.appendNotification(
      "Firefox tried to fix the site and reloaded the page. Is www.domain.com working properly now?", // message
      "cookie-restrictions-breakage", // value
      null, // icon
      notificationBox.PRIORITY_INFO_HIGH,
      [
        {
          disableHighlight: true,
          label: "Yes",
          accessKey: "y",
          callback: () => {
            console.log("clicked YES");
            self.emit("page-broken", tabId); // TODO change this event
          },
        },
        {
          label: "No",
          accessKey: "n",
          callback: () => {
            console.log("clicked NO");
            self.emit("page-not-broken", tabId); // TODO change this event
          },
        },
      ],
      // callback for nb events
      null,
    );
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
        show() {
          popupNotificationEventEmitter.emitShow();
        },
        onReportPageBroken: new EventManager(
          context,
          "popupNotification.onReportPageBroken",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            popupNotificationEventEmitter.on(
              "page-broken",
              listener,
            );
            return () => {
              popupNotificationEventEmitter.off(
                "page-broken",
                listener,
              );
            };
          },
        ).api(),
        onReportPageNotBroken: new EventManager(
          context,
          "popupNotification.onReportPageNotBroken",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            popupNotificationEventEmitter.on(
              "page-not-broken",
              listener,
            );
            return () => {
              popupNotificationEventEmitter.off(
                "page-not-broken",
                listener,
              );
            };
          },
        ).api(),
      },
    };
  }
};
