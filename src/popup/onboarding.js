browser.storage.local.get("user_joined").then((result) => {
  const {user_joined} = result;
  document.getElementById("joined").toggleAttribute("hidden", !user_joined);
  document.getElementById("leaving").toggleAttribute("hidden", user_joined);
});

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
  window.close();
});
