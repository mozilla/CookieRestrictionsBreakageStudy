function getCurrentWindowActiveTab() {
  return browser.tabs.query({currentWindow: true, active: true});
}

const button = document.getElementById("FixThisSite");
button.addEventListener("click", (e) => {
  getCurrentWindowActiveTab().then((tabList) => {
    const activeTabID = tabList[0].id;
    // Send message to feature.js to turn on compat mode.
    browser.runtime.sendMessage({tabId: activeTabID});
  });
  window.close();
});
