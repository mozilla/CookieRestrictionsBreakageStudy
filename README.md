# Cookie Restrictions Shield Study

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
npm run test:func
```

Note that you have to re-run `npm run build` when making changes to study code because the tests use a bundled version of the add-on.

## Running Variations

First, be sure you go through the [Development](#Development) steps and are able
to `npm start -- -f Nightly`

To run a specific variation, you will pass the variation name to the `start`
command with `--pref`.

### Variations

There are a 2 variations to study features and heuristics:

  * `Control`
  * `CookiesBlocked`

You can run a specific variation like so:

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions_shield_mozilla_org.test.variationName=CookiesBlocked
```

## User Scenarios

In both variations:

* Nothing different should happen in Private Browsing or Safe Mode operation.
* Panel Behaviour:
  * The panel has a checkbox on it, if the user checks that box and clicks an option, 
    they will be un-enrolled from the study.
  * If the user refreshes a page they have a chance of being shown
    a panel notification: "Did you reload this page to resolve loading issues?". This chance is 100% by the 6th refresh.
  * If the panel is ignored it will not show up again on the next refreshes. Once the user
    navigates, on the next refresh there is once again a chance the panel will show up. And the
    chance that it might show up on the same etld+1 is once again possible.
  * If "yes" or "no" is clicked on the panel, it will never show up again for that etld+1.
  * The panel should not dismiss until interacted with, or until the user navigates or refreshes
    the page
  * If "yes" is clicked we will add an exception for this page for content blocking
* Telemetry Behaviour:
  * Telemetry will be sent upon page unload.


### Control
In a Control [variation](#variations):

  * There are no differences for Control branches from the behaviours described for all variations

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions_shield_mozilla_org.
test.variationName=Control
```

### Cookie Restrictions

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions_shield_mozilla_org.
test.variationName=CookiesBlocked
```

In a Cookies Blocked [variation](#variations):

* The user should see the "How Tracking Protection works" onboarding experience
  when they first visit a site with trackers detected.
* The "Content Blocking" panel should show "Trackers: Blocked",
  "Slow-loading Trackers: Add blocking...", and "Disable Blocking for This
  Site"
  

### Testing Guide

In combination with the above instructions, add the pref `shieldStudy.logLevel=all` to the command to see extra logging. The logging will show the contents of the Telemetry ping, and the variation.

```shell
npm start -- -f Nightly --pref=extensions.cookie-restrictions_shield_mozilla_org.test.variationName=CookiesBlocked --pref=shieldStudy.logLevel=all
```
