const joinButton = document.getElementById("joinStudy");
const content = document.querySelector(".content");
joinButton.addEventListener("click", (e) => {
  if (e.target.textContent === "Join Study") {
    content.classList.add("joined");
    e.target.textContent = "Leave Study";
    browser.runtime.sendMessage({msg: "user_permission", user_joined: true});
  } else {
    content.classList.remove("joined");
    e.target.textContent = "Join Study";
    browser.runtime.sendMessage({msg: "user_permission", user_joined: false});
  }
});
