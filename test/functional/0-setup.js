/* eslint-env node, mocha */

// for unhandled promise rejection debugging
process.on("unhandledRejection", r => console.error(r)); // eslint-disable-line no-console

const {assert} = require("chai");
const utils = require("./utils");

const allPrefs = [
  "browser.contentblocking.enabled",
  "browser.contentblocking.ui.enabled",
  "security.pki.distrust_ca_policy",
  "browser.contentblocking.reportBreakage.enabled",
  "browser.fastblock.enabled",
  "browser.fastblock.timeout",
  "privacy.trackingprotection.enabled",
  "network.http.tailing.enabled",
  "urlclassifier.trackingTable",
  "urlclassifier.trackingAnnotationTable",
  "urlclassifier.trackingAnnotationWhitelistTable",
  "browser.contentblocking.fastblock.ui.enabled",
  "browser.contentblocking.fastblock.control-center.ui.enabled",
  "browser.contentblocking.trackingprotection.ui.enabled",
  "browser.contentblocking.trackingprotection.control-center.ui.enabled",
];

async function checkPrefs(driver, prefs) {
  for (const pref of allPrefs) {
    if (prefs[pref] != undefined) {
      const val = await utils.getPreference(driver, pref);
      assert.equal(val, prefs[pref], `set the right pref for ${pref}`);
    } else {
      const hasUserValue = await utils.prefHasUserValue(driver, pref);
      assert.isFalse(hasUserValue, `${pref} is set to the default`);
    }
  }
}

describe("setup and teardown", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;

  // runs ONCE
  before(async () => {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
  });

  after(() => {
    driver.quit();
  });

  describe("sets up the correct prefs, depending on the variation", function() {
    const SETUP_DELAY = 500;

    it("sets the correct prefs for variation TPL0", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "TPL0");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 0],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", true],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation TPL1", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "TPL1");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 1],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", true],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation TPL2", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "TPL2");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 2],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", true],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation TPL3", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "TPL3");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 3],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", true],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB2L0", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB2L0");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 0],
        ["browser.fastblock.timeout", 2000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB2L1", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB2L1");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 1],
        ["browser.fastblock.timeout", 2000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB2L2", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB2L2");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 2],
        ["browser.fastblock.timeout", 2000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB2L3", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB2L3");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 3],
        ["browser.fastblock.timeout", 2000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB5L0", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB5L0");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 0],
        ["browser.fastblock.timeout", 5000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB5L1", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB5L1");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 1],
        ["browser.fastblock.timeout", 5000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB5L2", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB5L2");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 2],
        ["browser.fastblock.timeout", 5000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation FB5L3", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "FB5L3");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 3],
        ["browser.fastblock.timeout", 5000],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation Control", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "Control");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["browser.fastblock.enabled", false],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

    it("sets the correct prefs for variation TT", async () => {
      await utils.setPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName", "TT");
      const addonId = await utils.setupWebdriver.installAddon(driver);
      await driver.sleep(SETUP_DELAY);

      await checkPrefs(driver, [
        ["privacy.fastblock.list", 0],
        ["browser.fastblock.enabled", true],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.setupWebdriver.uninstallAddon(driver, addonId);

      await checkPrefs(driver, [
        // list pref will change see #35
        ["privacy.fastblock.list", null],
        ["browser.fastblock.enabled", false],
        ["privacy.trackingprotection.enabled", false],
        ["network.http.tailing.enabled", true],
      ]);

      await utils.clearPreference(driver, "extensions.cookie-restrictions-shield_mozilla_org.test.variationName");
    });

  });
});
