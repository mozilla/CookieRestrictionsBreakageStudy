/**
 * A helper object to make it easier to store and retrieve information
 * about a specific tab, such as telemetry payload or how many times it was reloaded.
 */
window.TabRecords = {
  _tabs: new Map(),

  resetPayload(tabId) {
    const tabInfo = this._tabs.get(tabId);
    tabInfo.telemetryPayload = {
      etld: null,
      num_blockable_trackers: 0,
      page_reloaded: false,
      page_reloaded_survey: 0,
      user_reported_page_breakage: false,
      user_toggled_exception: 0,
      user_opened_control_center: false,
      login_form_on_page: false,
      embedded_social_script: false,
      user_has_tracking_protection_exception: false,
      password_field_was_filled_in: false,
      browser_contentblocking_enabled: true,
      privacy_trackingprotection_enabled: true,
      network_cookie_cookieBehavior: 0,
      browser_contentblocking_ui_enabled: false,
      browser_contentblocking_rejecttrackers_ui_recommended: false,
      browser_contentblocking_rejecttrackers_control_center_ui_enabled: false,
      browser_contentblocking_cookies_site_data_ui_reject_trackers_enabled: false,
      browser_contentblocking_cookies_site_data_ui_reject_trackers_recommended: false,
      browser_contentblocking_reportBreakage_enabled: false,
      urlclassifier_trackingAnnotationTable: "",
      urlclassifier_trackingAnnotationWhitelistTable: "",
      browser_contentblocking_fastblock_ui_enabled: false,
      browser_contentblocking_trackingprotection_ui_enabled: false,
      browser_contentblocking_fastblock_control_center_ui_enabled: false,
      browser_contentblocking_trackingprotection_control_center_ui_enabled: false,
    };

    return tabInfo;
  },

  getTabInfo(tabId) {
    return this._tabs.get(tabId);
  },

  getOrInsertTabInfo(tabId) {
    let tabInfo = this._tabs.get(tabId);
    if (tabInfo) {
      return tabInfo;
    }

    tabInfo = {
      surveyShown: false,
      reloadCount: 0,
    };

    this._tabs.set(tabId, tabInfo);
    this.resetPayload(tabId);
    return tabInfo;
  },

  deleteTabEntry(tabId) {
    this._tabs.delete(tabId);
  },
};
