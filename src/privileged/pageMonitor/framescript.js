/* global ChromeUtils, content, sendAsyncMessage, addMessageListener, removeMessageListener */

// This will be reset on page unload.
let telemetryData = {};

const telemetryAndSendLoadEvent = (e) => {
  // Ignore frames or non-web-sites.
  if ((!content.location.href.startsWith("http")) ||
      (e && e.target.defaultView.top !== e.target.defaultView)) {
    return;
  }

  telemetryData.origin = content.location.origin;
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
};

// Add listener to fire every time the page is loaded.
// If the addon is installed after the page is already loaded, we need to
// call it once on this page since there won't be a DOMContentLoaded event.
addEventListener("DOMContentLoaded", telemetryAndSendLoadEvent);
if (content.document.readyState === "complete") {
  telemetryAndSendLoadEvent();
}
