const cancel = document.getElementById("cancel");
const confirm = document.getElementById("confirmQuit");
cancel.addEventListener("click", () => {
  // User cancelled, put storage permission back.
  browser.storage.local.set({user_joined: true});
  window.close();
});
confirm.addEventListener("click", () => {
  // Send message to uninstall addon;
  browser.runtime.sendMessage({msg: "user_permission", user_joined: false});
});

browser.runtime.onMessage.addListener((data) => {
  if (data.msg === "platform") {
    document.body.classList.add(data.platform);
  }
});

browser.runtime.sendMessage({msg: "test-platform"});
// Popup resets back to default, only show this special
// popup on the info page click events.
browser.browserAction.setPopup({popup: ""});
