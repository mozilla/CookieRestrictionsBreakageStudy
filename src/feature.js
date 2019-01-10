/* global TabRecords, VARIATIONS, Services */

// Constants for the action telemetry probe.
const SURVEY_CLOSED = "survey_closed";
const SURVEY_PAGE_FIXED = "survey_response_fixed";
const SURVEY_PAGE_NOT_FIXED = "survey_response_not_fixed";
// const SURVEY_IGNORED = "survey_ignored";
const ENTER_COMPAT_MODE = "enter_compatibility_mode";
// const NAVIGATE = "navigate";

class Feature {
  constructor() {}

  async configure(studyInfo) {
    let { variation } = studyInfo;
    this.onCompatMode = this.onCompatMode.bind(this);
    browser.runtime.onMessage.addListener(this.onCompatMode);

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

    // Initialize listeners in privileged code.
    browser.pageMonitor.init();

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

      if (tabInfo.payloadWaitingForSurvey) {
        this.submitPayloadWaitingForSurvey(tabInfo);
      }
      // Only submit telemetry if we have recorded load info
      if (tabInfo.telemetryPayload.etld) {
        this.sendTelemetry(tabInfo.telemetryPayload);
      }
      TabRecords.deleteTabEntry(tabId);
    });

    // Record when users opened the control center (identity popup).
    browser.pageMonitor.onIdentityPopupShown.addListener(
      tabId => {
        if (tabId < 0) {
          return;
        }

        const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
        tabInfo.telemetryPayload.user_opened_control_center = true;
      }
    );

    // Listen for the page to load to show the banner
    browser.pageMonitor.onPageDOMContentLoaded.addListener(async (tabId, data) => {
      const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
      const location = /[^?]*/.exec(data.completeLocation)[0];
      data.completeLocation = null;
      await this.addMainTelemetryData(tabInfo, data, userid);

      if (tabInfo && tabInfo.payloadWaitingForSurvey) {
        browser.popupNotification.show(location);
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
      (tabId) => {
        const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
        if (!tabInfo || !tabInfo.payloadWaitingForSurvey) {
          return;
        }
        tabInfo.telemetryPayload.action = SURVEY_PAGE_FIXED;
        this.submitPayloadWaitingForSurvey(tabInfo);
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

  onCompatMode({tabId}) {
    const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
    this.sendTelemetry({...tabInfo.telemetryPayload, action: ENTER_COMPAT_MODE});
    // TODO: make this turn on compat mode

    // Only keep a record of the "off" page errors to pass forwards.
    tabInfo.payloadWaitingForSurvey = {};
    tabInfo.payloadWaitingForSurvey.compat_off_num_EvalError =
      tabInfo.telemetryPayload.compat_off_num_EvalError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_InternalError =
      tabInfo.telemetryPayload.compat_off_num_InternalError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_RangeError =
      tabInfo.telemetryPayload.compat_off_num_RangeError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_ReferenceError =
      tabInfo.telemetryPayload.compat_off_num_ReferenceError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_SyntaxError =
      tabInfo.telemetryPayload.compat_off_num_SyntaxError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_TypeError =
      tabInfo.telemetryPayload.compat_off_num_TypeError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_URIError =
      tabInfo.telemetryPayload.compat_off_num_URIError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_SecurityError =
      tabInfo.telemetryPayload.compat_off_num_SecurityError;
    tabInfo.payloadWaitingForSurvey.compat_off_num_other_error =
      tabInfo.telemetryPayload.compat_off_num_other_error;
    browser.tabs.reload(tabId);
  }

  submitPayloadWaitingForSurvey(tabInfo) {
    this.sendTelemetry({...tabInfo.telemetryPayload, ...tabInfo.payloadWaitingForSurvey});
    tabInfo.payloadWaitingForSurvey = null;
  }

  async addMainTelemetryData(tabInfo, data, userid) {
    const hash = await this.SHA256(userid + data.etld);
    tabInfo.telemetryPayload.etld = hash;
    tabInfo.telemetryPayload.page_reloaded = data.page_reloaded || false;

    tabInfo.telemetryPayload.embedded_social_script = data.embedded_social_script;
    tabInfo.telemetryPayload.login_form_on_page = data.login_form_on_page;
    tabInfo.telemetryPayload.user_has_tracking_protection_exception =
      data.user_has_tracking_protection_exception;
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
