# Test plan for this add-on

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Contents**

* [Manual / QA TEST Instructions](#manual--qa-test-instructions)
  * [Preparations](#preparations)
  * [Install the add-on and enroll in the study](#install-the-add-on-and-enroll-in-the-study)
* [Expected User Experience / Functionality](#expected-user-experience--functionality)
  * [Do these tests](#do-these-tests)
  * [Design](#design)
  * [Note: checking "sent Telemetry is correct"](#note-checking-sent-telemetry-is-correct)
* [Debug](#debug)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Manual / QA TEST Instructions

### Preparations

* Download a Nightly version of Firefox
* After 2018-09-04, use Beta instead

### Install the add-on and enroll in the study

* (Create profile: <https://developer.mozilla.org/Firefox/Multiple_profiles>, or via some other method)
* Navigate to _about:config_ and set the following preferences. (If a preference does not exist, create it by right-clicking in the white area and selecting New -> String)
* Set `shieldStudy.logLevel` to `All`. This permits shield-add-on log output in browser console.
* Set `extensions.cookie-restrictions-shield_mozilla_org.test.variationName` to `FB2L0` (or any other study variation/branch to test specifically)
* Go to [this study's tracking bug](tbd: replace with your study's launch bug link in bugzilla) and install the latest add-on zip file

### Test Beta or other versions of Firefox

npm will launch the add-on in Nightly by default, but you may want to test it in Beta.

Using `npm start` you may pass in the path or short name of the Firefox release you want to test with the `--firefox` option:

```
npm start -- --firefox=beta --pref=extensions.cookie-restrictions-shield_mozilla_org.test.variationName=CookiesBlocked
```

See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Getting_started_with_web-ext#Testing_in_different_versions_of_Firefox for more information.

### Variations

There are a 2 variations to study features and heuristics:

  * `Control`
  * `CookiesBlocked`

You can run a specific variation like so:

```
npm start -- -f Nightly --pref=extensions.cookie-restrictions-shield_mozilla_org.test.variationName=CookiesBlocked
```

## Expected User Experience / Functionality

In all variations:

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

```
npm start -- -f Nightly --pref=extensions.cookie-restrictions-shield_mozilla_org.test.variationName=Control
```

### Tracking Protection

 ```
 npm start -- -f Nightly --pref=extensions.cookie-restrictions-shield_mozilla_org.test.variationName=
 ```

 In a CookiesBlocked [variation](#variations):

   * The user should see the "How Tracking Protection works" onboarding experience
     when they first visit a site with trackers detected.
   * The "Content Blocking" panel should show "Trackers: Blocked",
     "Slow-loading Trackers: Add blocking...", and "Disable Blocking for This
     Site"

### Testing Guide

In combination with the above instructions, add the pref `shieldStudy.logLevel=all` to the command to see extra logging. The logging will show the contents of the Telemetry ping, and the variation.

```
npm start -- -f Nightly --pref=extensions.cookie-restrictions-shield_mozilla_org.test.variationName=Control --pref=shieldStudy.logLevel=all
```

### Design

Any UI in a Shield study should be consistent with standard Firefox design specifications. These standards can be found at [design.firefox.com](https://design.firefox.com/photon/welcome.html). Firefox logo specifications can be found [here](https://design.firefox.com/photon/visuals/product-identity-assets.html).

### Note: checking "sent Telemetry is correct"

* Open the Browser Console using Firefox's top menu at `Tools > Web Developer > Browser Console`. This will display Shield (loading/telemetry) log output from the add-on.

See [TELEMETRY.md](./TELEMETRY.md) for more details on what pings are sent by this add-on.

## Debug

To debug installation and loading of the add-on:

* Open the Browser Console using Firefox's top menu at `Tools > Web Developer > Browser Console`. This will display Shield (loading/telemetry) and log output from the add-on.
