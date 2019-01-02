function getCurrentWindowActiveTab() {
  return browser.tabs.query({currentWindow: true, active: true});
}

const checkbox = document.getElementById("unbreakCheck");
checkbox.addEventListener("click", (e) => {
  if (checkbox.checked) {
    getCurrentWindowActiveTab().then((tabList) => {
      const activeTabID = tabList[0].id;
      browser.runtime.sendMessage({tabId: activeTabID});
    });
  } else {
    console.log("unchecking");
  }
});
