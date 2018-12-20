/* global TabRecords, VARIATIONS */

// Constants for the survey_answer telemetry probe.
// const SURVEY_IGNORED = 1;
const SURVEY_PAGE_FIXED = 2;
const SURVEY_PAGE_NOT_FIXED = 3;

class Feature {
  constructor() {}

  async configure(studyInfo) {
    let { variation } = studyInfo;
    browser.runtime.onMessage.addListener(this.onCompatMode);

    // The userid will be used to create a unique hash
    // for the etld + userid combination.
    let {userid} = await browser.storage.local.get("userid");
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

    // On unload, submit telemetry and reset.
    browser.pageMonitor.onPageUnload.addListener(async (tabId, data) => {
      const tabInfo = TabRecords.getTabInfo(tabId);
      if (!tabInfo || !tabInfo.telemetryPayload.etld) {
        return;
      }
      // The tab we are dealing with might have been unloaded because
      // it was closed. In this case the onRemoved handler will
      // deal with submitting telemetry.
      try {
        await browser.tabs.get(tabId);
      } catch (e) {
        return;
      }

      await this.addMainTelemetryData(tabInfo, data, userid);
      if (tabInfo.compatModeWasJustEntered) {
        tabInfo.compatModeWasJustEntered = false;
        return;
      } else if (tabInfo.payloadWaitingForSurvey) {
        // TODO: change this to send after answering survey
        this.submitPayloadWaitingForSurvey(tabInfo);
      }

      TabRecords.resetPayload(tabId);
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

    // Listen for the page to load to show the "is this page broken?"
    // survey for the previous (reloaded) page.
    browser.pageMonitor.onPageDOMContentLoaded.addListener((tabId) => {
      const tabInfo = TabRecords.getTabInfo(tabId);
      if (tabInfo && tabInfo.payloadWaitingForSurvey) {
        this.showNotification(tabInfo);
      }
    });


    // Watch for the user pressing the "Yes this page is broken"
    // button and record the answer.
    browser.popupNotification.onReportPageBroken.addListener(
      (tabId) => {
        const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
        if (!tabInfo || !tabInfo.payloadWaitingForSurvey) {
          return;
        }
        tabInfo.payloadWaitingForSurvey.survey_answer = SURVEY_PAGE_NOT_FIXED;
        this.submitPayloadWaitingForSurvey(tabInfo);
      },
    );

    // Watch for the user pressing the "No this page is not broken"
    // button and record the answer.
    browser.popupNotification.onReportPageNotBroken.addListener(
      (tabId) => {
        const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
        if (!tabInfo || !tabInfo.payloadWaitingForSurvey) {
          return;
        }
        tabInfo.payloadWaitingForSurvey.survey_answer = SURVEY_PAGE_FIXED;
        this.submitPayloadWaitingForSurvey(tabInfo);
      },
    );

    browser.pageMonitor.onErrorDetected.addListener(
      (error, tabId) => {
        this.recordPageError(error, tabId);
      }
    );
  }

  recordPageError(error, tabId) {
    const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
    // TODO if compat mode is on, put errors into `compat_on_num_${error}`
    if (`compat_off_num_${error}` in tabInfo.telemetryPayload) {
      tabInfo.telemetryPayload[`compat_off_num_${error}`] += 1;
    }
  }

  onCompatMode({tabId}) {
    const tabInfo = TabRecords.getOrInsertTabInfo(tabId);
    // TODO: make this refresh and turn on compat mode
    // then show survey
    tabInfo.payloadWaitingForSurvey = Object.assign({}, tabInfo.telemetryPayload);
    tabInfo.compatModeWasJustEntered = true;
    browser.tabs.reload(tabId);
  }

  submitPayloadWaitingForSurvey(tabInfo) {
    this.sendTelemetry(tabInfo.payloadWaitingForSurvey);
    tabInfo.payloadWaitingForSurvey = null;
  }

  async addMainTelemetryData(tabInfo, data, userid) {
    for (const key in data.performanceEvents) {
      tabInfo.telemetryPayload[key] = data.performanceEvents[key];
    }
    const hash = await this.SHA256(userid + data.etld);
    tabInfo.telemetryPayload.etld = hash;
    tabInfo.telemetryPayload.page_reloaded = data.page_reloaded || false;

    tabInfo.telemetryPayload.embedded_social_script = data.embedded_social_script;
    tabInfo.telemetryPayload.login_form_on_page = data.login_form_on_page;
    tabInfo.telemetryPayload.password_field_was_filled_in = data.password_field_was_filled_in;
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

  async showNotification(tabInfo) {
    const payload = tabInfo.payloadWaitingForSurvey;

    if (payload) {
      browser.popupNotification.show();
    }
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
    payload.urlclassifier_trackingAnnotationTable = await browser.prefs.getStringPref("urlclassifier.trackingAnnotationTable");
    payload.urlclassifier_trackingAnnotationWhitelistTable = await browser.prefs.getStringPref("urlclassifier.trackingAnnotationWhitelistTable");

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
