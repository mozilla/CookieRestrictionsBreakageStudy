window.VARIATIONS = {
  "Control": {
    weight: 1,
    prefs: {
      // Add a pref here which hides the control panel section and shield
    },
  },

  "ThirdPartyTracking": {
    weight: 1,
    prefs: {
      "network.cookie.cookieBehavior": 4, // Block third part tracking cookies
      // Add a pref here which hides the control panel section and shield
    },
  },

  "Breakage": {
    weight: 1,
    prefs: {
      "network.cookie.cookieBehavior": 1, // Block all third party cookies. We don't know if we will use this yet
      // Add a pref here which hides the control panel section and shield
    },
  },
};
