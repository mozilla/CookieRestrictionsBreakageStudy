/* eslint-env node, mocha */

// for unhandled promise rejection debugging
process.on("unhandledRejection", r => console.error(r)); // eslint-disable-line no-console

const {assert} = require("chai");
const utils = require("./utils");
const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

describe("telemetry", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;
  let studyPings;

  // runs ONCE
  before(async () => {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
    await utils.setPreference(driver, "extensions.cookie-restrictions-breakage_shield_mozilla_org.test.variationName", "ThirdPartyTrackingBasic");
    await utils.setupWebdriver.installAddon(driver);
  });

  after(() => {
    driver.quit();
  });

  function checkTelemetryPayload(nonTracking = false) {
    it("has recorded pings", async () => {
      assert(studyPings.length, "at least one shield telemetry ping");
    });

    it("correctly records etld as a hash", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.exists(attributes.etld, "etld exists");
      assert.notInclude(attributes.etld, "itisatrap", "etld does not contain the domain");
      assert.equal(attributes.etld.length * 4, 256, "etld is a 256 bit hex string");
    });

    it("correctly records whether the page was reloaded", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.page_reloaded, "false", "page reloaded is false");
      assert.equal(parseInt(attributes.page_reloaded_survey), 0, "page reloaded survey not shown");
    });

    it("correctly records the set preferences in the payload", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      const privacy_trackingprotection_enabled = await utils.getPreference(driver, "privacy.trackingprotection.enabled");
      assert.equal(attributes.privacy_trackingprotection_enabled, privacy_trackingprotection_enabled.toString(), "privacy_trackingprotection_enabled is set, and equals the pref");
    });
  }

  describe("records shield telemetry on tracking pages after reload", function() {
    before(async () => {
      const time = Date.now();
      driver.setContext(Context.CONTENT);
      await driver.get("https://itisatrap.org/firefox/its-a-tracker.html");
      await driver.sleep(500);
      await driver.navigate().refresh();
      await driver.sleep(500);
      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    after(async () => {
      driver.setContext(Context.CONTENT);
      // Navigate to a benign site to avoid sending telemetry in the next test.
      await driver.get("https://example.org");
      await driver.sleep(500);
    });

    checkTelemetryPayload();
  });

  describe("records shield telemetry on tracking pages after navigation", function() {
    before(async () => {
      const time = Date.now();
      driver.setContext(Context.CONTENT);
      await driver.get("https://itisatrap.org/firefox/its-a-tracker.html");
      await driver.sleep(500);
      await driver.get("https://example.com");
      await driver.sleep(500);
      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
  });

  describe("records shield telemetry on tracking pages after the tab closes", function() {
    before(async () => {
      const time = Date.now();
      utils.openNewTab(driver);
      await driver.sleep(500);
      const tabs = await driver.getAllWindowHandles();
      await driver.switchTo().window(tabs[1]);
      driver.setContext(Context.CONTENT);
      await driver.get("https://itisatrap.org/firefox/its-a-tracker.html");
      await driver.sleep(500);
      await utils.removeCurrentTab(driver);
      await driver.switchTo().window(tabs[0]);
      await driver.sleep(500);
      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
  });

  describe("records shield telemetry on non-tracking pages", function() {
    before(async () => {
      const time = Date.now();
      driver.setContext(Context.CONTENT);
      await driver.get("https://example.org");
      await driver.sleep(500);
      await driver.get("https://example.com");
      await driver.sleep(500);
      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload(true);
  });

  describe("records the correct value if a user has set an exception", function() {
    before(async () => {
      const time = Date.now();
      driver.setContext(Context.CONTENT);
      await driver.get("https://itisatrap.org/firefox/its-a-tracker.html");
      await driver.sleep(500);
      await driver.navigate().refresh();
      await driver.sleep(500);
      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    it("correctly records if the user has set a tracking protection exception on the page", async () => {
      it.skip("This depends on platform support, this will currently only record false");
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      const value = await driver.executeScript(`
        let uri = Services.io.newURI("https://itisatrap.org/firefox/its-a-tracker.html");
        return Services.perms.testExactPermission(uri, "trackingprotection") === Services.perms.ALLOW_ACTION;
      `);

      assert.equal(attributes.user_has_tracking_protection_exception, value.toString(), "user_has_tracking_protection_exception is recorded, and equals the actual setting");
    });
  });
});
