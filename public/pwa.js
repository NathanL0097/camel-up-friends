(() => {
  const installButton = document.getElementById("installAppButton");
  let installPrompt = null;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton?.classList.remove("hidden");
  });

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton?.classList.add("hidden");
  });
})();
