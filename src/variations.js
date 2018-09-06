window.VARIATIONS = {
  "Control": {
    weight: 1,
    prefs: {
      // Make sure we're not affected by the Symantec distrust.
      "security.pki.distrust_ca_policy": 1,
      "browser.contentblocking.ui.enabled": false,
    },
  },

  "CookiesBlocked": {
    weight: 1,
    prefs: {
      "network.cookie.cookieBehavior": 4,

      // Fastblock and Tracking Protection UI should be disabled.
      "browser.contentblocking.trackingprotection.ui.enabled": false,
      "browser.contentblocking.fastblock.ui.enabled": false,
      "browser.contentblocking.fastblock.control-center.ui.enabled": false,
      "browser.contentblocking.trackingprotection.control-center.ui.enabled": false,

      // Make sure we're not affected by the Symantec distrust.
      "security.pki.distrust_ca_policy": 1,

      "browser.contentblocking.enabled": true,
      "browser.contentblocking.ui.enabled": true,
      "browser.contentblocking.rejecttrackers.ui.recommended": true,
      "browser.contentblocking.rejecttrackers.control-center.ui.enabled": true,
      "browser.contentblocking.cookies-site-data.ui.reject-trackers.recommended": true,
      "browser.contentblocking.cookies-site-data.ui.reject-trackers.enabled": true,
      "browser.contentblocking.reportBreakage.enabled": true,
      "urlclassifier.trackingAnnotationTable": "test-track-simple,base-track-digest256",
      "urlclassifier.trackingAnnotationWhitelistTable": "test-trackwhite-simple,mozstd-trackwhite-digest256",
    },
  },
};
