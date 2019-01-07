/**
 * A helper object to make it easier to store and retrieve information
 * about a specific tab, such as telemetry payload or how many times it was reloaded.
 */
window.TabRecords = {
  _tabs: new Map(),

  resetPayload(tabId) {
    const tabInfo = this._tabs.get(tabId);
    tabInfo.telemetryPayload = {
      etld: 0,
      page_reloaded: false,
      action: "",
      login_form_on_page: false,
      embedded_social_script: false,
      // TODO Possibly remove this later - it may indicate they have previously
      // used compat mode on this page. Or they may have an exception set previuosly.
      // Should we filter users who have previously set exceptions?
      user_has_tracking_protection_exception: false,
      // Are we interested in this? they might be searching for a way to disable
      user_opened_control_center: false,
      password_field_was_filled_in: false,
      privacy_trackingprotection_enabled: true,
      network_cookie_cookieBehavior: -1,
      urlclassifier_trackingAnnotationTable: "",
      urlclassifier_trackingAnnotationWhitelistTable: "",

      compat_on_num_EvalError: 0,
      compat_on_num_InternalError: 0,
      compat_on_num_RangeError: 0,
      compat_on_num_ReferenceError: 0,
      compat_on_num_SyntaxError: 0,
      compat_on_num_TypeError: 0,
      compat_on_num_URIError: 0,
      compat_on_num_SecurityError: 0,
      compat_on_num_other_error: 0,

      compat_off_num_EvalError: 0,
      compat_off_num_InternalError: 0,
      compat_off_num_RangeError: 0,
      compat_off_num_ReferenceError: 0,
      compat_off_num_SyntaxError: 0,
      compat_off_num_TypeError: 0,
      compat_off_num_URIError: 0,
      compat_off_num_SecurityError: 0,
      compat_off_num_other_error: 0,
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
      payloadWaitingForSurvey: null,
      compatModeWasJustEntered: null,
    };

    this._tabs.set(tabId, tabInfo);
    this.resetPayload(tabId);
    return tabInfo;
  },

  deleteTabEntry(tabId) {
    this._tabs.delete(tabId);
  },
};
