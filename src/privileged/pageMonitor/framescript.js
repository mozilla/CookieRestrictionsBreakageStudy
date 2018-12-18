/* global ChromeUtils, content, sendAsyncMessage, addMessageListener, removeMessageListener */

// This will be reset on page unload.
let telemetryData = {};

// We want a listener on clicking the button, not on reload.
const reloadListener = {
  receiveMessage(message) {
    if (message.name === "Browser:Reload") {
      telemetryData.page_reloaded = true;
    }
  },
};

addMessageListener("Browser:Reload", reloadListener);

addEventListener("unload", function() {
  removeMessageListener("Browser:Reload", reloadListener);
});

// The global "load" and "unload" event listeners listen for lifetime
// events of the framescript, hence we wait for a DOM window to appear
// and attach listeners to it. That also helps us make sure that these
// events are only forwarded once.
addEventListener("DOMContentLoaded", function(e) {
  // Ignore frames or non-web-sites.
  if (e.target.defaultView.top !== e.target.defaultView ||
      !e.target.documentURI.startsWith("http")) {
    return;
  }

  // We show the survey doorhanger on next page load, so
  // let the background script know that some page loaded.
  sendAsyncMessage("CookieRestrictions:DOMContentLoaded", {});

  telemetryData.hostname = content.location.hostname;

  // Listening on "unload" was giving us race conditions with the
  // tab being removed too fast, which meant we were unable to recover
  // the tabId that is associated with this data. As a compromise we
  // use the "beforeunload" event (which is a little earlier) for recording
  // and use the "unload" event (or a tab close) for submitting the data.
  content.window.addEventListener("beforeunload", (event) => {
    const passwordFields = content.document.querySelectorAll("input[type='password']");
    telemetryData.login_form_on_page = !!passwordFields.length;
    telemetryData.password_field_was_filled_in = Array.from(passwordFields).some(input => {
      return !!input.value.length;
    });
    telemetryData.completeLocation = content.location.href;

    // Find all scripts on the page.
    const scripts = Array.prototype.slice
      .apply(content.document.querySelectorAll("script"))
      .filter(s => s.src)
      .map(s => s.src);
    // Find if any of the scripts are identified social login scripts.
    const urls = [/platform\.twitter\.com\/widgets\.js/, /apis\.google\.com\/js\/platform\.js/,
      /platform\.linkedin\.com\/in\.js/, /www\.paypalobjects\.com\/js\/external\/api\.js/,
      /api-cdn\.amazon\.com\/sdk\/login1\.js/, /api\.instagram\.com\/oauth\/authorize\//,
      /connect\.facebook\.net\/.*\/(all|sdk)\.js/];

    telemetryData.embedded_social_script = scripts.some(src => {
      return urls.some(url => url.test(src));
    });

    sendAsyncMessage("CookieRestrictions:beforeunload", {telemetryData});
  }, {once: true});

  content.window.addEventListener("unload", (event) => {
    telemetryData.completeLocation = content.location.href;
    sendAsyncMessage("CookieRestrictions:unload", {telemetryData});
    telemetryData = {};
  }, {once: true});

  // Listen for errors from the content.
  content.window.addEventListener("error", function(event) {
    // TODO should we handle these somehow?
    if (!event.error) {
      return;
    }

    sendAsyncMessage("CookieRestrictions:pageError", e.error.name);
  });
});
