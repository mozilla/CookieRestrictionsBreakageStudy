browser.windows.getCurrent().then((windowInfo) => {
  if (windowInfo.incognito) {
    document.getElementById("basicBrowsing").hidden = true;
    document.getElementById("privateBrowsing").hidden = false;
  }
});

function getCurrentWindowActiveTab() {
  return browser.tabs.query({currentWindow: true, active: true});
}

const button = document.getElementById("fixThisSite");
button.addEventListener("click", (e) => {
  getCurrentWindowActiveTab().then((tabList) => {
    const activeTabID = tabList[0].id;
    // Send message to feature.js to turn on compat mode.
    browser.runtime.sendMessage({tabId: activeTabID});
  });
  window.close();
});
