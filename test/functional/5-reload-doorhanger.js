/* eslint-env node, mocha */
/* eslint-disable no-unreachable */

// for unhandled promise rejection debugging
process.on("unhandledRejection", r => console.error(r)); // eslint-disable-line no-console

const {assert} = require("chai");
const utils = require("./utils");
const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;
const webdriver = require("selenium-webdriver");
const By = webdriver.By;
const DELAY = process.env.DELAY ? parseInt(process.env.DELAY) : 1000;

describe("reload survey doorhanger", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(DELAY * 15);

  let driver;
  let studyPings;
  let tries = 0;

  // runs ONCE
  before(async () => {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
    await utils.setupWebdriver.installAddon(driver);
    await driver.sleep(DELAY);
  });

  after(() => {
    driver.quit();
  });
  
  async function checkDoorhangerTelemetry() {
    it("shows the doorhanger after at most 6 tries", async () => {
      assert.isAtMost(tries, 6, "Should have shown the doorhanger after at most 6 tries");
    });

    it("has recorded one ping per reload", async () => {
      assert.equal(studyPings.length, tries, "one shield telemetry ping per reload");
    });

    it("correctly records whether the page was reloaded", async () => {
      for (let i = 0; i < studyPings.length; i++) {
        const ping = studyPings[i];
        const attributes = ping.payload.data.attributes;
        if (i === studyPings.length - 1) {
          assert.equal(attributes.page_reloaded, "false", `page reloaded is false on ${i}`);
        } else {
          assert.equal(attributes.page_reloaded, "true", `page reloaded is true on ${i}`);
        }

        if (i === 0) {
          assert.equal(parseInt(attributes.page_reloaded_survey), 1, "page reloaded survey shown");
        } else {
          assert.equal(parseInt(attributes.page_reloaded_survey), 0, `page reloaded survey not shown on ${i}`);
        }
      }
    });

    it("correctly records etld as a hash", async () => {
      for (let i = 0; i < studyPings.length; i++) {
        const ping = studyPings[i];
        const attributes = ping.payload.data.attributes;
        assert.exists(attributes.etld, "etld exists");
        assert.notInclude(attributes.etld, "itisatrap", "etld does not contain the domain");
        assert.notInclude(attributes.etld, "example", "etld does not contain the domain");
        assert.equal(attributes.etld.length * 4, 256, "etld is a 256 bit hex string");
      }
    });
  }

  async function checkDoorhangerPresent() {
    driver.setContext(Context.CHROME);
    const result = await driver.findElements(By.id("cookie-restriction-notification"));
    return !!result.length;
  }

  describe("shows a survey after reloading a page with trackers 6 times max", function() {
    before(async () => {
      await utils.setPreference(driver, "privacy.trackingprotection.enabled", true);
      await driver.sleep(DELAY);

      const time = Date.now();
      driver.setContext(Context.CONTENT);
      await driver.get("https://itisatrap.org/firefox/its-a-tracker.html");
      await driver.sleep(DELAY);
      while (tries++ < 6) {
        const hasSeenDoorhanger = await checkDoorhangerPresent();
        driver.setContext(Context.CONTENT);
        await driver.navigate().refresh();
        await driver.sleep(DELAY);
        if (hasSeenDoorhanger) {
          break;
        }
      }

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });

    checkDoorhangerTelemetry();

    after(async () => {
      tries = 0;
      studyPings = [];
      await utils.clearPreference(driver, "privacy.trackingprotection.enabled");
    });
  });
  
  describe("shows a survey after reloading a page without trackers 6 times max", function() {
    let studyPings;
    let tries = 0;

    before(async () => {
      await utils.setPreference(driver, "privacy.trackingprotection.enabled", true);
      await driver.sleep(DELAY);

      const time = Date.now();
      driver.setContext(Context.CONTENT);
      await driver.get("http://example.org/");
      await driver.sleep(DELAY);
      while (tries++ < 6) {
        const hasSeenDoorhanger = await checkDoorhangerPresent();
        driver.setContext(Context.CONTENT);
        await driver.navigate().refresh();
        await driver.sleep(DELAY);
        if (hasSeenDoorhanger) {
          break;
        }
      }

      studyPings = await utils.telemetry.getShieldPingsAfterTimestamp(
        driver,
        time,
      );
      studyPings = studyPings.filter(ping => ping.type === "shield-study-addon");
    });
    checkDoorhangerTelemetry();

    after(async () => {
      tries = 0;
      studyPings = [];
      await utils.clearPreference(driver, "privacy.trackingprotection.enabled");
    });
  });

});
