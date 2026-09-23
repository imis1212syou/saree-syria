(() => {
  "use strict";

  const base = new URL(".", location.href);
  let deferredPrompt = null;

  function addManifest() {
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = new URL("saree_manifest.json", base).href;
    document.head.appendChild(link);
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("saree_sw.js", base).href, { scope: base.pathname })
        .catch(err => console.warn("PWA service worker:", err));
    });
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function showIOSHelp() {
    alert("لتثبيت التطبيق على iPhone:\n\nاضغط زر المشاركة ⬆️ في Safari، ثم اختر «إضافة إلى الشاشة الرئيسية».");
  }

  function showAndroidHelp() {
    alert("إذا لم يظهر التثبيت تلقائياً، افتح قائمة المتصفح ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».");
  }

  let waitingForInstallPrompt = false;

  function askAndInstall() {
    const ok = window.confirm("هل تريد تثبيت تطبيق سعرلي سوريا على جهازك؟\n\nاضغط «موافق» للمتابعة أو «إلغاء» للرجوع.");
    if (!ok) return;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => {
        deferredPrompt = null;
        updateButton();
      });
      return;
    }

    // أحياناً يصل حدث التثبيت بعد ظهور الصفحة بقليل؛ ننتظر قليلاً بعد موافقة المستخدم.
    waitingForInstallPrompt = true;
    setTimeout(() => {
      waitingForInstallPrompt = false;
      if (!deferredPrompt) showAndroidHelp();
    }, 8000);
  }

  function installApp() {
    if (isStandalone()) return;
    if (isIOS()) {
      if (window.confirm("هل تريد تثبيت تطبيق سعرلي سوريا على جهازك؟\n\nاضغط «موافق» لعرض خطوات التثبيت أو «إلغاء» للرجوع.")) {
        showIOSHelp();
      }
      return;
    }
    askAndInstall();
  }

  function createButton() {
    if (document.getElementById("sareePwaInstallButton")) return;
    const top = document.querySelector(".top");
    if (!top) return;

    const btn = document.createElement("button");
    btn.id = "sareePwaInstallButton";
    btn.type = "button";
    btn.className = "btn primary";
    btn.textContent = "📱 تحميل التطبيق";
    btn.title = "تحميل / تثبيت التطبيق";
    btn.style.marginInlineStart = "8px";
    btn.addEventListener("click", installApp);

    const account = document.getElementById("topAccountBtn");
    if (account) {
      account.parentNode.insertBefore(btn, account);
    } else {
      top.appendChild(btn);
    }
  }

  function updateButton() {
    const btn = document.getElementById("sareePwaInstallButton");
    if (!btn) return;
    btn.style.display = isStandalone() ? "none" : "inline-block";
    btn.textContent = deferredPrompt ? "📱 تثبيت التطبيق" : "📱 تحميل التطبيق";
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    createButton();
    updateButton();

    // إذا وافق المستخدم قبل وصول الحدث، افتح نافذة التثبيت فور وصوله.
    if (waitingForInstallPrompt) {
      waitingForInstallPrompt = false;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => {
        deferredPrompt = null;
        updateButton();
      });
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateButton();
  });

  function init() {
    addManifest();
    registerSW();
    createButton();
    updateButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
