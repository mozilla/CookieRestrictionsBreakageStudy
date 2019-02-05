window.VARIATIONS = {
  "Control": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 0,   // Default, Block no cookies
      // Default basic list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256",
      "browser.contentblocking.ui.enabled": false, // Turn off UI tour
    },
    ndprefs: [
      {
        pref: "browser.contentblocking.category",
        value: "custom",
        reset_to: "standard",
      },
    ],
  },

  "ThirdPartyTrackingBasic": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 4, // Block third party tracking cookies
      // Default basic list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256",
      "browser.contentblocking.ui.enabled": false, // Turn off UI tour
    },
    ndprefs: [
      {
        pref: "browser.contentblocking.category",
        value: "custom",
        reset_to: "standard",
      },
    ],
  },

  "ThirdPartyTrackingStrict": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 4, // Block third party tracking cookies
      // Strict list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256,content-track-digest256",
      "browser.contentblocking.ui.enabled": false, // Turn off UI tour
    },
    ndprefs: [
      {
        pref: "browser.contentblocking.category",
        value: "custom",
        reset_to: "standard",
      },
    ],
  },

  "AllThirdPartyCookies": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 1, // Block all third party cookies.
      // Default basic list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256",
      "browser.contentblocking.ui.enabled": false, // Turn off UI tour
    },
    ndprefs: [
      {
        pref: "browser.contentblocking.category",
        value: "custom",
        reset_to: "standard",
      },
    ],
  },
};
