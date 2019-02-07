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
  if (joinButton.textContent === "Join Study") {
    browser.browserAction.setPopup({popup: "../popup/onboarding-join.html"});
    content.classList.add("joined");
    joinButton.textContent = "Leave Study";
    browser.runtime.sendMessage({msg: "user_permission", user_joined: true});
    browser.browserAction.openPopup();
    // Popup reverts back to default, only show this special
    // popup on the info page click events.
    browser.browserAction.setPopup({popup: ""});
  } else {
    browser.browserAction.setPopup({popup: "../popup/onboarding-leave.html"});
    // No need to change the button nor copy back to default,
    // if the user actually leaves, the tab will close upon uninstall.
    browser.runtime.sendMessage({msg: "open-in-overflow"});
  }
};

joinButton.addEventListener("click", joinedStudy);
for (const anchor of anchors) {
  anchor.addEventListener("click", joinedStudy);
}

// Send message when window closes, so we know to uninstall addon skeleton
// if user has not agreed.
window.onbeforeunload = () => {
  // Check user_joined and send message only if the user has
  // not joined the study yet.
  browser.storage.local.get("user_joined").then(({user_joined}) => {
    if (!user_joined) {
      browser.runtime.sendMessage({msg: "window_closed"});
    }
  });
};
