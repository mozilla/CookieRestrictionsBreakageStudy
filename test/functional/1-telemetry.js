/* eslint-env node, mocha */

// for unhandled promise rejection debugging
process.on("unhandledRejection", r => console.error(r)); // eslint-disable-line no-console

const {assert} = require("chai");
const utils = require("./utils");
const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;
const webdriver = require("selenium-webdriver");
const until = webdriver.until;
const By = webdriver.By;


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
    utils.joinStudy(driver);
  });

  after(() => {
    driver.quit();
  });

  async function activateCompatMode() {
    driver.setContext(Context.CONTENT);
    await driver.get("https://en.wikipedia.org/wiki/Main_Page");
    driver.setContext(Context.CHROME);
    const tabs = await driver.getAllWindowHandles();
    driver.setContext(Context.CONTENT);
    // Focus the driver on the webextension page so we can use the browser.runtime api to send messages.
    driver.switchTo().window(tabs[1]);
    await driver.sleep(500);

    // We are at the auto-opened extension page, so we can send messages from here.
    // We send a message that the button is "clicked" from tab 2,
    // but we are reporting tab 1 so that real data gets sent.
    driver.setContext(Context.CHROME);
    // Select the wikipedia tab to allow it to have a "DOMContentLoaded" event
    await driver.executeScript(`
      gBrowser.selectedTab = gBrowser.tabs[0];
    `);
    await driver.sleep(500);
    driver.setContext(Context.CONTENT);
    // driver is still focused on the "extension" tab,
    // so can access the "browser" api to send a message reporting the wikipedia tab.
    await driver.executeScript(`browser.runtime.sendMessage({msg: "compat_mode", tabId: 1});`);
    await driver.sleep(500);
  }

  async function resetDriver() {
    driver.quit();
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
    await utils.setPreference(driver, "extensions.cookie-restrictions-breakage_shield_mozilla_org.test.variationName", "ThirdPartyTrackingBasic");
    await utils.setupWebdriver.installAddon(driver);
  }

  function checkTelemetryPayload(nonTracking = false) {
    it("has recorded pings", async () => {
      assert(studyPings.length, "at least one shield telemetry ping");
    });

    it("correctly records etld as a hash", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.exists(attributes.etld, "etld exists");
      assert.notInclude(attributes.etld, "wikipedia", "etld does not contain the domain");
      assert.equal(attributes.etld.length * 4, 256, "etld is a 256 bit hex string");
    });

    it("correctly records the set preferences in the payload", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      const privacy_trackingprotection_enabled = await utils.getPreference(driver, "privacy.trackingprotection.enabled");
      const network_cookie_cookieBehavior = await utils.getPreference(driver, "network.cookie.cookieBehavior");
      const urlclassifier_trackingTable = await utils.getPreference(driver, "urlclassifier.trackingTable");

      assert.equal(attributes.privacy_trackingprotection_enabled, privacy_trackingprotection_enabled.toString(), "privacy_trackingprotection_enabled is set, and equals the pref");
      assert.equal(attributes.network_cookie_cookieBehavior, network_cookie_cookieBehavior.toString(), "network_cookie_cookieBehavior is set, and equals the pref");
      assert.equal(attributes.urlclassifier_trackingTable, urlclassifier_trackingTable.toString(), "privacy_trackingprotection_enabled is set, and equals the pref");
    });
  }

  describe("records shield telemetry when 'compat_mode' message is received", function() {
    before(async () => {
      const time = Date.now();
      await activateCompatMode();

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
  });

  describe("records shield telemetry when user answers survey with no", function() {
    before(async () => {
      const time = Date.now();
      driver.setContext(Context.CHROME);

      // Click the "No" answer on the banner
      const noButton = await driver.wait(until.elementLocated(By.css("notification[value='cookie-restrictions-breakage'] .notification-button[label='No']")), 1000);
      noButton.click();
      await driver.sleep(500);

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
    it("correctly sends a 'No' answer", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.action, "survey_response_not_fixed", "action is 'survey_response_not_fixed'");
    });
  });

  describe("records shield telemetry when user answers survey with yes, and send plain text url", function() {
    before(async () => {
      await resetDriver();
      utils.joinStudy(driver);
      await activateCompatMode();

      const time = Date.now();
      driver.setContext(Context.CHROME);

      // Click the "Yes" answer on the banner
      const yesButton = await driver.wait(until.elementLocated(By.css("notification[value='cookie-restrictions-breakage'] .notification-button[label='Yes']")), 1000);
      yesButton.click();
      const sendButton = await driver.wait(until.elementLocated(By.css("notification[value='cookie-restrictions-breakage-report-url'] .notification-button[label='Yes']")), 1000);
      sendButton.click();
      await driver.sleep(500);

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
    it("correctly sends a 'Yes' answer", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.action, "survey_response_fixed", "action is 'survey_response_not_fixed'");
    });

    it("correctly includes a plain text url in the telemetry", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.plain_text_url, "https://en.wikipedia.org", "ping contains 'https://en.wikipedia.org' in plain text");
    });
  });

  describe("records shield telemetry when user clicks the x on the survey", function() {
    before(async () => {
      await resetDriver();
      utils.joinStudy(driver);
      await activateCompatMode();

      const time = Date.now();
      driver.setContext(Context.CHROME);

      // Click the "x" button on the banner
      const xButton = await driver.wait(until.elementLocated(By.css("notification[value='cookie-restrictions-breakage'] .messageCloseButton")), 1000);
      xButton.click();
      await driver.sleep(500);

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
    it("correctly sends a 'survey closed' answer", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.action, "survey_closed", "action is 'survey_closed'");
    });
  });

  describe("records shield telemetry when user answers survey with yes, and doesn't send plain text url", function() {
    before(async () => {
      await resetDriver();
      utils.joinStudy(driver);
      await activateCompatMode();

      const time = Date.now();
      driver.setContext(Context.CHROME);

      // Click the "Yes" answer on the banner
      const yesButton = await driver.wait(until.elementLocated(By.css("notification[value='cookie-restrictions-breakage'] .notification-button[label='Yes']")), 1000);
      yesButton.click();
      const doNotSendButton = await driver.wait(until.elementLocated(By.css("notification[value='cookie-restrictions-breakage-report-url'] .notification-button[label='No']")), 1000);
      doNotSendButton.click();
      await driver.sleep(500);

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
    it("correctly sends a 'Yes' answer", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.action, "survey_response_fixed", "action is 'survey_response_fixed'");
    });

    it("correctly does not include a plain text url in the telemetry", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.plain_text_url, "", "ping does not contain the url in plain text");
    });
  });

  describe("records number of internal and external navigations", function() {
    before(async () => {
      await resetDriver();
      utils.joinStudy(driver);
      await activateCompatMode();
      const time = Date.now();

      driver.setContext(Context.CHROME);
      const tabs = await driver.getAllWindowHandles();
      await driver.switchTo().window(tabs[0]);
      driver.setContext(Context.CONTENT);
      await driver.get("https://en.wikipedia.org/wiki/Encyclopedia");
      await driver.get("https://github.com/");
      await driver.get("https://www.mozilla.org/en-US/");
      await driver.get("https://en.wikipedia.org/wiki/Encyclopedia");

      driver.setContext(Context.CHROME);
      // Click the "No" answer on the banner
      const noButton = await driver.wait(until.elementLocated(By.css("notification[value='cookie-restrictions-breakage'] .notification-button[label='No']")), 1000);
      noButton.click();
      await driver.sleep(500);

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
    it("correctly sends a 'No' answer", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.action, "survey_response_not_fixed", "action is 'survey_response_not_fixed'");
    });

    it("correctly sends the count of navigations", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.navigated_external, "2", "navigated externally");
      assert.equal(attributes.navigated_internal, "2", "navigated internally");
    });
  });

  describe("records shield telemetry after the tab closes", function() {
    before(async () => {
      await resetDriver();
      utils.joinStudy(driver);
      await activateCompatMode();
      const time = Date.now();

      await utils.removeCurrentTab(driver);
      driver.setContext(Context.CHROME);
      const tabs = await driver.getAllWindowHandles();
      await driver.switchTo().window(tabs[0]);
      await driver.sleep(500);
      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkTelemetryPayload();
    it("correctly sends a 'survey ignored' answer", async () => {
      const ping = studyPings[0];
      const attributes = ping.payload.data.attributes;
      assert.equal(attributes.action, "survey_ignored", "action is 'survey_ignored'");
    });
  });
});
