(() => {
  const installButton = document.getElementById("installAppButton");
  let installPrompt = null;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton?.classList.remove("hidden");
  });

  if (isMobile) installButton?.classList.remove("hidden");

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) {
      window.alert(isApple ? "请在 Safari 点击分享按钮，再选择“添加到主屏幕”。" : "请打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。");
      return;
    }
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
