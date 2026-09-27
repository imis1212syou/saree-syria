(() => {
  "use strict";

  const base = new URL(".", location.href);
  let deferredPrompt = null;
  let installRequested = false;

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
      navigator.serviceWorker.register(new URL("saree_sw.js", base).href, {
        scope: base.pathname
      }).catch(err => console.warn("PWA service worker:", err));
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

  function createButton() {
    if (document.getElementById("sareePwaInstallButton")) return;
    const top = document.querySelector(".top");
    if (!top) return;

    const btn = document.createElement("button");
    btn.id = "sareePwaInstallButton";
    btn.type = "button";
    btn.className = "btn primary";
    btn.textContent = "📱 تحميل التطبيق";
    btn.title = "تثبيت تطبيق سعرلي سوريا";
    btn.style.marginInlineStart = "8px";
    btn.addEventListener("click", installApp);

    const account = document.getElementById("topAccountBtn");
    if (account) account.parentNode.insertBefore(btn, account);
    else top.appendChild(btn);
  }

  function updateButton() {
    const btn = document.getElementById("sareePwaInstallButton");
    if (!btn) return;
    btn.style.display = isStandalone() ? "none" : "inline-block";
    btn.textContent = "📱 تحميل التطبيق";
  }

  async function openNativeInstall() {
    if (!deferredPrompt) return false;

    const promptEvent = deferredPrompt;
    deferredPrompt = null;

    try {
      promptEvent.prompt();
      const result = await promptEvent.userChoice;
      updateButton();
      return result && result.outcome === "accepted";
    } catch (e) {
      console.warn("PWA install prompt:", e);
      updateButton();
      return false;
    }
  }

  function showIOSInstructions() {
    alert("افتح هذا الموقع في Safari، ثم اضغط مشاركة ⬆️ واختر «إضافة إلى الشاشة الرئيسية» لتثبيت تطبيق سعرلي سوريا.");
  }

  function installApp() {
    if (isStandalone()) return;

    // التأكيد الذي طلبه المستخدم: نعم = متابعة التثبيت، لا = إلغاء.
    const ok = window.confirm(
      "هل تريد تثبيت تطبيق «سعرلي سوريا» على جهازك؟\n\nاضغط «موافق» للتثبيت أو «إلغاء» للرجوع."
    );
    if (!ok) return;

    if (isIOS()) {
      showIOSInstructions();
      return;
    }

    // نافذة التثبيت الرسمية من Chrome/Chromium.
    if (deferredPrompt) {
      openNativeInstall();
      return;
    }

    // لا نعرض رسالة «افتح قائمة المتصفح». ننتظر وصول حدث التثبيت الرسمي.
    installRequested = true;
    const started = Date.now();
    const waitForPrompt = setInterval(() => {
      if (deferredPrompt) {
        clearInterval(waitForPrompt);
        installRequested = false;
        openNativeInstall();
        return;
      }
      if (Date.now() - started >= 15000) {
        clearInterval(waitForPrompt);
        installRequested = false;
        // Chrome لم يوفّر نافذة التثبيت الرسمية لهذه الجلسة؛ لا نفتح رسالة قديمة.
      }
    }, 250);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    createButton();
    updateButton();

    // إذا ضغط المستخدم «موافق» قبل وصول الحدث، نفتح التثبيت فوراً.
    if (installRequested) {
      installRequested = false;
      openNativeInstall();
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
