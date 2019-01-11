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

addEventListener("DOMContentLoaded", function(e) {
  // Ignore frames or non-web-sites.
  if (e.target.defaultView.top !== e.target.defaultView ||
      !e.target.documentURI.startsWith("http")) {
    return;
  }

  telemetryData.hostname = content.location.hostname;
  telemetryData.completeLocation = content.location.href;
  // Check if there is a password field on the page, this gives the best
  // indication that this might be a login page
  const passwordFields = content.document.querySelectorAll("input[type='password']");
  telemetryData.login_form_on_page = !!passwordFields.length;

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

  sendAsyncMessage("CookieRestrictions:DOMContentLoaded", {telemetryData});

  content.window.addEventListener("beforeunload", (event) => {
    sendAsyncMessage("CookieRestrictions:beforeunload", {telemetryData});
  });

  content.window.addEventListener("unload", (event) => {
    telemetryData = {};
  }, {once: true});

  // Listen for errors from the content.
  content.window.addEventListener("error", function(event) {
    // TODO should we handle these somehow?
    if (!event.error) {
      return;
    }

    sendAsyncMessage("CookieRestrictions:pageError", event.error.name);
  });
});
