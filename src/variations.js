window.VARIATIONS = {
  "Control": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 0,   // Default, Block no cookies
      // Default basic list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256",
    },
  },

  "ThirdPartyTrackingBasic": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 4, // Block third party tracking cookies
      // Default basic list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256",
    },
  },

  "ThirdPartyTrackingStrict": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 4, // Block third party tracking cookies
      // Strict list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256,content-track-digest256",
    },
  },

  "AllThirdPartyCookies": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": false, // Tracking protection off
      "network.cookie.cookieBehavior": 1, // Block all third party cookies.
      // Default basic list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256",
    },
  },

  "TPStrict": {
    weight: 1,
    prefs: {
      "privacy.trackingprotection.enabled": true, // Tracking protection on
      "network.cookie.cookieBehavior": 0,   // Default, Block no cookies
      // Strict list
      "urlclassifier.trackingTable": "test-track-simple,base-track-digest256,content-track-digest256",
    },
  },
};
