/* global TabRecords, VARIATIONS, Services */

// Constants for the action telemetry probe.
const SURVEY_CLOSED = "survey_closed";
const SURVEY_PAGE_FIXED = "survey_response_fixed";
const SURVEY_PAGE_NOT_FIXED = "survey_response_not_fixed";
const SURVEY_IGNORED = "survey_ignored";
const ENTER_COMPAT_MODE = "enter_compatibility_mode";

class Feature {
  constructor() {}

  async configure(studyInfo) {
    // Open onboarding page, if user does not agree to join, then do not begin study.
    (this.openOnboardingTab = () => {
      browser.tabs.create({
        url: browser.runtime.getURL("./onboarding/index.html"),
      });
    })();
    browser.browserAction.onClicked.addListener(this.openOnboardingTab);

    browser.pageMonitor.onPlatformResult.addListener((platform) => {
      browser.runtime.sendMessage({msg: "platform", platform});
    });

    // On receiving an action from the onboarding page, we begin, or end the study.
    browser.runtime.onMessage.addListener((data) => {
      if (data.msg === "user_permission" && data.user_joined) {
        browser.storage.local.set({user_joined: data.user_joined});
        this.sendTelemetry({"action": "info_page_user_enrolled"});
        this.beginStudy(studyInfo);
      } else if (data.msg === "user_permission" && !data.user_joined) {
        this.sendTelemetry({"action": "info_page_user_unerolled"});

        // Actually uninstall addon. User has confirmed.
        browser.management.uninstallSelf();
      } else if (data.msg === "window_closed") {
        browser.management.uninstallSelf();
      } else if (data.msg === "test-platform") {
        browser.pageMonitor.testPlatform();
      }
    });

    const userPreviouslyJoined = await browser.storage.local.get("user_joined").user_joined;
    if (userPreviouslyJoined) {
      this.beginStudy(studyInfo);
    }
  }

  async beginStudy(studyInfo) {
    browser.browserAction.onClicked.removeListener(this.openOnboardingTab);
    browser.browserAction.setPopup({popup: "../popup/compatMode.html"});
    let { variation } = studyInfo;
    this.onCompatMode = this.onCompatMode.bind(this);
    browser.runtime.onMessage.addListener((data) => {
      if (data.msg === "compat_mode") {
        this.onCompatMode(data.tabId);
      } else if (data.msg === "test-permission") {
        browser.pageMonitor.testPermission();
      }
    });

    browser.pageMonitor.onHasExceptionResults.addListener((hasException) => {
      browser.runtime.sendMessage({msg: "hasException", hasException});
    });

    // The userid will be used to create a unique hash
    // for the etld + userid combination.
    let { userid } = await browser.storage.local.get("userid");
    if (!userid) {
      userid = this.generateUUID();
      await browser.storage.local.set({userid});
    }
    this.userid = userid;

    variation = VARIATIONS[variation.name];

    for (const pref in variation.prefs) {
      browser.prefs.registerPrefCleanup(pref);

      const value = variation.prefs[pref];
      if (typeof value === "boolean") {
        browser.prefs.setBoolPref(pref, value);
      } else if (typeof value === "string") {
        browser.prefs.setStringPref(pref, value);
      } else if (typeof value === "number") {
        browser.prefs.setIntPref(pref, value);
      }
    }

    // Get the current state of the exceptions list and pass to chrome code to keep both in sync,
    // init as an array if it doesn't exist.
    let {extensionSetExceptions} = await browser.storage.local.get("extensionSetExceptions");
    if (!extensionSetExceptions) {
      extensionSetExceptions = [];
    }
    await browser.storage.local.set({extensionSetExceptions});

    // Initialize listeners in privileged code.
    browser.pageMonitor.init(extensionSetExceptions);

    // We receive most of the critical site information in beforeunload
    // and send it either on unload or on tab close.
    browser.pageMonitor.onPageBeforeUnload.addListener(async (tabId, data) => {
      if (tabId < 0 || !data.etld) {
        return;
      }

      const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
      await this.addMainTelemetryData(tabInfo, data, userid);
    });

    // When a tab is removed, make sure to submit telemetry for the
    // last page and delete the tab entry.
    browser.tabs.onRemoved.addListener(tabId => {
      const tabInfo = TabRecords.getTabInfo(tabId);
      if (!tabInfo) {
        return;
      }

      // payloadWaitingForSurvey means user has entered compat mode on this tab, but not answered the survey. Send telemetry action=SURVEY_IGNORED.
      if (tabInfo.payloadWaitingForSurvey) {
        tabInfo.payloadWaitingForSurvey.action = SURVEY_IGNORED;
        this.submitPayloadWaitingForSurvey(tabInfo);
      }
      TabRecords.deleteTabEntry(tabId);
    });

    // Listen for the page to load to show the banner
    browser.pageMonitor.onPageDOMContentLoaded.addListener(async (tabId, data) => {
      const tabInfo = TabRecords.getOrInsertTabInfo(tabId);

      tabInfo.currentOrigin = data.origin;

      // Increment external and internal navigations between reporting broken and answering the survey.
      if (tabInfo.currentOriginReported &&
          tabInfo.currentOrigin !== tabInfo.currentOriginReported) {
        tabInfo.payloadWaitingForSurvey.navigated_external += 1;
      } else if (tabInfo.currentOriginReported &&
                 tabInfo.currentOrigin === tabInfo.currentOriginReported &&
                 !tabInfo.compatModeWasJustEntered) {
        tabInfo.payloadWaitingForSurvey.navigated_internal += 1;
      }

      await this.addMainTelemetryData(tabInfo, data, userid);

      // compatModeWasJustEntered - show the banner as a response to clicking the icon.
      if (tabInfo && tabInfo.compatModeWasJustEntered) {
        // Clear the old timer if we report a second site within the 15 min.
        if (tabInfo.bannerTimer) {
          clearTimeout(tabInfo.bannerTimer);
          tabInfo.bannerTimer = null;
        }
        await this.addMainTelemetryData(tabInfo, data, userid);
        tabInfo.compatModeWasJustEntered = false;
        tabInfo.waitingForReturn = false;
        browser.popupNotification.show(tabInfo.currentOrigin);

      // If user has left the reported domain.
      } else if (tabInfo.currentOriginReported &&
          tabInfo.currentOrigin !== tabInfo.currentOriginReported &&
          !tabInfo.waitingForReturn) {
        // If the user does not return within 15 min, clear the data, the user has ignored the banner.
        tabInfo.bannerTimer = setTimeout(function() {
          tabInfo.payloadWaitingForSurvey = null;
          tabInfo.currentOriginReported = null;
          tabInfo.waitingForReturn = null;
          tabInfo.bannerTimer = null;
        }, 900000); // 900000 = 15 min
        browser.popupNotification.close();
        tabInfo.waitingForReturn = true;

      // If user has returned in time.
      } else if (tabInfo &&
                 tabInfo.currentOrigin === tabInfo.currentOriginReported &&
                 tabInfo.payloadWaitingForSurvey &&
                 tabInfo.waitingForReturn &&
                 !tabInfo.compatModeWasJustEntered) {
        tabInfo.waitingForReturn = false;
        clearTimeout(tabInfo.bannerTimer);
        // Show the banner because we have returned to the reported site within 15 min.
        browser.popupNotification.show(tabInfo.currentOrigin);
      }
    });

    // Watch for the user pressing the "x" to close the banner.
    browser.popupNotification.onReportClosed.addListener(
      (tabId) => {
        const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
        if (!tabInfo || !tabInfo.payloadWaitingForSurvey) {
          return;
        }
        tabInfo.telemetryPayload.action = SURVEY_CLOSED;
        this.submitPayloadWaitingForSurvey(tabInfo);
      },
    );

    // Watch for the user pressing the "Yes this page was fixed"
    // button and record the answer.
    browser.popupNotification.onReportPageFixed.addListener(
      (tabId, location) => {
        const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
        if (!tabInfo || !tabInfo.payloadWaitingForSurvey) {
          return;
        }

        // Location is either an empty string or a URL if the user has given permission.
        tabInfo.telemetryPayload.plain_text_url = location;
        tabInfo.telemetryPayload.action = SURVEY_PAGE_FIXED;

        // This will trigger twice, this is due to sending a message when the user answers and also
        // sending a message when it is ignored. The "ignored" event will fire no matter what happens.
        // we only want the "ignored" event if the first event does not happen.
        if (tabInfo.payloadWaitingForSurvey) {
          this.submitPayloadWaitingForSurvey(tabInfo);
        }
      },
    );

    // Watch for the user pressing the "No this page was not fixed"
    // button and record the answer.
    browser.popupNotification.onReportPageNotFixed.addListener(
      (tabId) => {
        const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
        if (!tabInfo || !tabInfo.payloadWaitingForSurvey) {
          return;
        }
        tabInfo.telemetryPayload.action = SURVEY_PAGE_NOT_FIXED;
        this.submitPayloadWaitingForSurvey(tabInfo);
      },
    );

    browser.pageMonitor.onErrorDetected.addListener(
      (error, tabId, hasException) => {
        this.recordPageError(error, tabId, hasException);
      }
    );

    browser.pageMonitor.onExceptionAdded.addListener(
      (tabId) => {
        this.recordExceptionAdded(tabId);
      }
    );
  }

  recordPageError(error, tabId, hasException) {
    const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
    // If an exception is set for this page, even if not from us,
    // it is equivalent to compat mode being on, so treat it as on.
    if (hasException) {
      if (`compat_on_num_${error}` in tabInfo.telemetryPayload) {
        tabInfo.telemetryPayload[`compat_on_num_${error}`] += 1;
      } else {
        tabInfo.telemetryPayload.compat_on_num_other_error += 1;
      }
    } else {
      if (`compat_off_num_${error}` in tabInfo.telemetryPayload) {
        tabInfo.telemetryPayload[`compat_off_num_${error}`] += 1;
      } else {
        tabInfo.telemetryPayload.compat_off_num_other_error += 1;
      }
    }
  }

  async recordExceptionAdded(tabId) {
    const tabInfo = TabRecords.getTabInfo(tabId);
    const {extensionSetExceptions} = await browser.storage.local.get("extensionSetExceptions");
    extensionSetExceptions.push(tabInfo.currentOrigin);
    await browser.storage.local.set({extensionSetExceptions});
  }

  onCompatMode(tabId) {
    const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
    this.sendTelemetry({...tabInfo.telemetryPayload, action: ENTER_COMPAT_MODE});
    tabInfo.currentOriginReported = tabInfo.currentOrigin;

    // Only keep a record of the particular info we want.
    tabInfo.payloadWaitingForSurvey = {
      navigated_external: 0,
      navigated_internal: 0,
      compat_off_num_EvalError: tabInfo.telemetryPayload.compat_off_num_EvalError,
      compat_off_num_InternalError: tabInfo.telemetryPayload.compat_off_num_InternalError,
      compat_off_num_RangeError: tabInfo.telemetryPayload.compat_off_num_RangeError,
      compat_off_num_ReferenceError: tabInfo.telemetryPayload.compat_off_num_ReferenceError,
      compat_off_num_SyntaxError: tabInfo.telemetryPayload.compat_off_num_SyntaxError,
      compat_off_num_TypeError: tabInfo.telemetryPayload.compat_off_num_TypeError,
      compat_off_num_URIError: tabInfo.telemetryPayload.compat_off_num_URIError,
      compat_off_num_SecurityError: tabInfo.telemetryPayload.compat_off_num_SecurityError,
      compat_off_num_other_error: tabInfo.telemetryPayload.compat_off_num_other_error,
      compat_etld: tabInfo.telemetryPayload.etld,
      embedded_social_script: tabInfo.telemetryPayload.embedded_social_script,
      login_form_on_page: tabInfo.telemetryPayload.login_form_on_page,
    };

    tabInfo.compatModeWasJustEntered = true;
    browser.pageMonitor.addException(tabInfo.currentOrigin);
    browser.tabs.reload(tabId);
  }

  submitPayloadWaitingForSurvey(tabInfo) {
    this.sendTelemetry({...tabInfo.telemetryPayload, ...tabInfo.payloadWaitingForSurvey});
    tabInfo.payloadWaitingForSurvey = null;
  }

  async addMainTelemetryData(tabInfo, data, userid) {
    const hash = await this.SHA256(userid + data.etld);
    tabInfo.telemetryPayload.etld = hash;

    tabInfo.telemetryPayload.embedded_social_script = data.embedded_social_script;
    tabInfo.telemetryPayload.login_form_on_page = data.login_form_on_page;
  }

  // Adapted from https://gist.github.com/jed/982883
  generateUUID() {
    const randomNumbers = window.crypto.getRandomValues(new Uint8Array(32)).values();
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, a =>
      (a ^ randomNumbers.next().value & 0b1111 >> a / 4).toString(16)
    );
  }

  SHA256(message) {
    // encode as UTF-8
    const msgBuffer = new TextEncoder("utf-8").encode(message);
    // hash the message
    return crypto.subtle.digest("SHA-256", msgBuffer).then((hash) => {
      // convert ArrayBuffer to Array
      const hashArray = Array.from(new Uint8Array(hash));
      // convert bytes to hex string
      const hashHex = hashArray.map(b => ("00" + b.toString(16)).slice(-2)).join("");
      return hashHex;
    });
  }

  /**
   * Takes a flat JSON object, converts all values to strings and
   * submits it to Shield telemetry.
   */
  async sendTelemetry(payload) {
    const stringToStringMap = {};
    // Report these prefs with each telemetry ping.
    payload.privacy_trackingprotection_enabled = await browser.prefs.getBoolPref("privacy.trackingprotection.enabled");
    payload.network_cookie_cookieBehavior = await browser.prefs.getIntPref("network.cookie.cookieBehavior");
    payload.urlclassifier_trackingTable = await browser.prefs.getStringPref("urlclassifier.trackingTable");

    // Shield Telemetry deals with flat string-string mappings.
    for (const key of Object.keys(payload)) {
      stringToStringMap[key] = payload[key].toString();
    }

    browser.study.sendTelemetry(stringToStringMap);
  }
}

// make an instance of the feature class available to background.js
// construct only. will be configured after setup
window.feature = new Feature();
