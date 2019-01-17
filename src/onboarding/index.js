const joinButton = document.getElementById("joinStudy");
const content = document.querySelector(".content");
const anchors = document.querySelectorAll(".join-study");

const joinedStudy = (e) => {
  browser.browserAction.setPopup({popup: "../popup/onboarding.html"});
  if (e.target.textContent === "Join Study") {
    content.classList.add("joined");
    e.target.textContent = "Leave Study";
    browser.runtime.sendMessage({msg: "user_permission", user_joined: true});
  } else {
    // No need to change the button nor copy back to default,
    // if the user actually leaves, the tab will close upon uninstall.
    // Set the storage, but don't send a message to uninstall yet.
    browser.storage.local.set({user_joined: false});
  }
  browser.browserAction.openPopup();
  // Popup reverts back to default, only show this special
  // popup on the info page click events.
  browser.browserAction.setPopup({popup: null});
};

joinButton.addEventListener("click", joinedStudy);
for (const anchor of anchors) {
  anchor.addEventListener("click", joinedStudy);
}
