/* global ChromeUtils, content, docShell, sendAsyncMessage */

// This will be reset on page unload.
let telemetryData = {};
let sentReload = false;

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

  telemetryData.hostname = content.location.hostname;
  // there *should* be only one entry - I haven't see anything to the alternative yet
  const entryForReload = content.performance.getEntriesByType("navigation")[0];
  telemetryData.page_reloaded = entryForReload.type === "reload";

  // We use the "load" event to enter the performance data, because at
  // "load" +1 tick it will contain everything we need. This means some
  // pages may end up without perf data if the user closes the tab too
  // early, but that's a tradeoff in simplicity vs. correctness we're
  // willing to take.
  content.window.addEventListener("load", () => {
    // We call setTimeout because otherwise our loadEventEnd entry (which is
    // filled after the "load" event handler runs) would be empty.
    setTimeout(function() {
      if (!sentReload && telemetryData.page_reloaded) {
        sendAsyncMessage("reload", {hostname: telemetryData.hostname});
        sentReload = true;
      }
    }, 0);
  }, {once: true});

  // Listening on "unload" was giving us race conditions with the
  // tab being removed too fast, which meant we were unable to recover
  // the tabId that is associated with this data. As a compromise we
  // use the "beforeunload" event (which is a little earlier) for recording
  // and use the "unload" event (or a tab close) for submitting the data.
  content.window.addEventListener("beforeunload", () => {
    const passwordFields = content.document.querySelectorAll("input[type='password']");
    telemetryData.login_form_on_page = !!passwordFields.length;
    telemetryData.completeLocation = content.location.href;

    telemetryData.num_blockable_trackers = docShell.document.numTrackersFound;

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

    sendAsyncMessage("beforeunload", {telemetryData});
  }, {once: true});

  content.window.addEventListener("unload", () => {
    sendAsyncMessage("unload", {});
    telemetryData = {};
    sentReload = false;
  }, {once: true});
});
