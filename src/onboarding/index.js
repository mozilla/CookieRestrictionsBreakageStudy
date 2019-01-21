const joinButton = document.getElementById("joinStudy");
const content = document.querySelector(".content");
const anchors = document.querySelectorAll(".join-study");

// If this page is arrived at from learn more link,
// or user refreshes, make sure it is showing the correct state.
browser.storage.local.get("user_joined").then(({user_joined}) => {
  if (user_joined) {
    content.classList.add("joined");
    joinButton.textContent = "Leave Study";
  }
});

const joinedStudy = () => {
  browser.browserAction.setPopup({popup: "../popup/onboarding.html"});
  if (joinButton.textContent === "Join Study") {
    content.classList.add("joined");
    joinButton.textContent = "Leave Study";
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
  browser.browserAction.setPopup({popup: "../popup/compatMode.html"});
};

joinButton.addEventListener("click", joinedStudy);
for (const anchor of anchors) {
  anchor.addEventListener("click", joinedStudy);
}

// Send message when window closes, so we know to uninstall addon skeleton if user has not agreed.
window.onunload = () => {
  browser.runtime.sendMessage({msg: "window_closed"});
};
