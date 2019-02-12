const getCurrentWindowActiveTab = () => {
  return browser.tabs.query({currentWindow: true, active: true});
};

const button = document.getElementById("fixThisSite");
button.addEventListener("click", (e) => {
  getCurrentWindowActiveTab().then((tabList) => {
    const activeTabID = tabList[0].id;
    // Send message to feature.js to turn on compat mode.
    browser.runtime.sendMessage({msg: "compat_mode", tabId: activeTabID}).then(window.close);
  });
});

const anchors = document.querySelectorAll(".learn-more");
for (const anchor of anchors) {
  anchor.onclick = () => {
    browser.tabs.create({
      url: browser.runtime.getURL("./onboarding/index.html"),
    }).then(window.close());
  };
}

getCurrentWindowActiveTab().then((tabList) => {
  const url = tabList[0].url;
  const hostname = new URL(url).hostname;
  document.getElementById("domainName").textContent = hostname;
});

browser.runtime.onMessage.addListener((data) => {
  if (data.msg === "hasException") {
    document.body.classList.toggle("exception", data.hasException);
  }
});

browser.windows.getCurrent().then((windowInfo) => {
  document.body.classList.toggle("basic", !windowInfo.incognito);
  document.body.classList.toggle("private", windowInfo.incognito);
  if (!window.incognito) {
    browser.runtime.sendMessage({msg: "test-permission"});
  }
});

// Popup resets back to default
browser.browserAction.setPopup({popup: ""});
