# Telemetry sent by this add-on

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Contents**

- [Usual Firefox Telemetry is mostly unaffected](#usual-firefox-telemetry-is-mostly-unaffected)
- [`shield-study` pings (common to all shield-studies)](#shield-study-pings-common-to-all-shield-studies)
- [`shield-study-addon` pings, specific to THIS study.](#shield-study-addon-pings-specific-to-this-study)
- [Example payload of the `shield-study-addon` ping.](#example-payload-of-the-shield-study-addon-ping)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Usual Firefox Telemetry is mostly unaffected

* No change: `main` and other pings are UNAFFECTED by this add-on, except that [shield-studies-addon-utils](https://github.com/mozilla/shield-studies-addon-utils) adds the add-on id as an active experiment in the telemetry environment.
* Respects telemetry preferences. If user has disabled telemetry, no telemetry will be sent.

## `shield-study` pings (common to all shield-studies)

[shield-studies-addon-utils](https://github.com/mozilla/shield-studies-addon-utils) sends the usual packets.

## `shield-study-addon` pings, specific to THIS study.

There is one ping per page visit, fired on the `unload` event.

## Example payload of the `shield-study-addon` ping.

These are the `payload` fields from the `shield-study-addon` bucket.

```js
telemetry: {
  "version": 3,
  "study_name": "cookie-restrictions-breakage@shield.mozilla.org",
  "branch": "ThirdPartyTrackingBasic",
  "addon_version": "2.0.0",
  "shield_version": "5.0.3",
  "type": "shield-study-addon",
  "data": {
    "attributes": {
      "etld": "f231d141395abf6f4c98dd55fe8c37e2752e82d72e1ffd3b64bdc6c978692fc6",
      "action": "survey_response_fixed",
      // These measurements are untrustworthy, 
      // they will not catch every login form, nor every social script
      "embedded_social_script": "false",
      "login_form_on_page": "false",
      // This is optional, it will either be a blank string, or a url if the user gives explicit permission.
      "plain_text_url": "",
      
      // Reporting the status of of prefs we are interested in
      "network_cookie_cookieBehavior": "4",
      "privacy_trackingprotection_enabled": "false",
      "urlclassifier_trackingAnnotationTable": "test-track-simple,base-track-digest256",
      "urlclassifier_trackingAnnotationWhitelistTable": "test-trackwhite-simple,mozstd-trackwhite-digest256",
      
      // Reporting any page Javascript errors before and after entering compat mode
      "compat_on_num_EvalError": "0",
      "compat_on_num_InternalError": "0",
      "compat_on_num_RangeError": "0",
      "compat_on_num_ReferenceError": "0",
      "compat_on_num_SyntaxError": "0",
      "compat_on_num_TypeError": "0",
      "compat_on_num_URIError": "0",
      "compat_on_num_SecurityError": "0",
      "compat_on_num_other_error": "0"
      "compat_off_num_EvalError": "0",
      "compat_off_num_InternalError": "0",
      "compat_off_num_RangeError": "0",
      "compat_off_num_ReferenceError": "0",
      "compat_off_num_SyntaxError": "0",
      "compat_off_num_TypeError": "0",
      "compat_off_num_URIError": "0",
      "compat_off_num_SecurityError": "0",
      "compat_off_num_other_error": "0",
      
      // We may or may not send these
      "page_reloaded": "true",
      "user_opened_control_center": "false",
    }
  }
}
```
