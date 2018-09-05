window.VARIATIONS = {
  "Control": {
    weight: 1,
    prefs: {
      // Make sure we're not affected by the Symantec distrust.
      "security.pki.distrust_ca_policy": 1,
    },
  },

  "CookiesBlocked": {
    weight: 1,
    prefs: {
      // Fastblock and Tracking Protection UI should be disabled.
      "browser.contentblocking.trackingprotection.ui.enabled": false,
      "Browser.contentblocking.fastblock.ui.enabled": false,

      "network.cookie.cookieBehavior": 4,

      // temporary to show Tracker status
      "privacy.trackingprotection.enabled": true,

      // Make sure we're not affected by the Symantec distrust.
      "security.pki.distrust_ca_policy": 1,
    },
  },
};
