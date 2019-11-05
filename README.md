# Cookie Restrictions Breakage Shield Study

This repository is a [Shield Study](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies) based on the [Shield Studies Add-on Template](https://github.com/mozilla/shield-studies-addon-template). 

### About This Add-on

By default, cookies and site data can be set by all websites.  We would like to change this default to instead block cookies and site data when they are accessed or set by third parties that are identified as trackers by Disconnect’s Tracking Protection List.

Cookie Restrictions make it difficult for trackers to track users across different websites.  A third party resource identified as a tracker on a first party page will not get to read any cookies or site data from their site stored in Firefox.  They will not get to set any cookies or site data, and document.cookie will not return any data.  If the third party is opened with a window.open in a new tab that the user interacts with, the third party will get exempted from the restriction on the previous tab.  If the user opens Control Center and “Disables protection for this site”, the first party website will get whitelisted and all trackers within it will get full cookie and site data access when embedded by that whitelisted first party.

## Development

You must run the study with [Firefox
Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/#nightly)

See [Getting
Started](https://github.com/mozilla/CookieRestrictionsShield/blob/master/docs/DEV.md#getting-started) for instructions to install, run, lint, and build the add-on.

You should be able to `npm start -- -f Nightly`

### Tests

We currently have functional tests, you can find them under `test/functional/`.
Please test your new code and make sure to run the tests before committing.

To run the tests, use

```shell
npm run build
npm run test
```

Note that you have to re-run `npm run build` when making changes to study code because the tests use a bundled version of the add-on.

## Running Variations

First, be sure you go through the [Development](#Development) steps and are able
to `npm start -- -f Nightly`

To run a specific variation, you will pass the variation name to the `start`
command with `--pref`.

### Variations

There are a 3 variations to study features and heuristics:

  * `Control`
  * `ThirdPartyTrackingBasic`
  * `ThirdPartyTrackingStrict`
  * `AllThirdPartyCookies`

You can run a specific variation like so:

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions-breakage_shield_mozilla_org.test.variationName=ThirdPartyTrackingBasic
```

## User Scenarios

In all variations:
 <!-- TODO Describe behaviour here of popups and panels -->
* The shield in the top left of the url bar should never show up.
* When opening the control panel, the Content Blocking section should not exist
* Telemetry Behaviour:


### Control
In a Control [variation](#variations):

  * There are no differences for Control branches from the behaviours described for all variations

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions-breakage_shield_mozilla_org.
test.variationName=Control
```

### Third Party Tracking Basic
In a Third Party Tracking Basic [variation](#variations):


```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions-breakage_shield_mozilla_org.
test.variationName=ThirdPartyTrackingBasic
```

### Third Party Tracking Strict
In a Third Party Tracking Strict [variation](#variations):

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions-breakage_shield_mozilla_org.test.variationName=ThirdPartyTrackingStrict
```
### All Third Party Cookies
In a All Third Party Cookies [variation](#variations):

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions-breakage_shield_mozilla_org.test.variationName=AllThirdPartyCookies
```

### Testing Guide

In combination with the above instructions, add the pref `shieldStudy.logLevel=all` to the command to see extra logging. The logging will show the contents of the Telemetry ping, and the variation.

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions-breakage_shield_mozilla_org.test.variationName=ThirdPartyTrackingBasic --pref=shieldStudy.logLevel=all
```

### After Study Survey
