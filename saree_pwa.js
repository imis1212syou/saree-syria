(() => {
  "use strict";

  const base = new URL(".", location.href);
  let deferredPrompt = null;
  let installRequested = false;

  function addManifest() {
    // The manifest is now declared directly in index.html so Safari/iOS can
    // see it during the initial page load. Keep this fallback for older pages.
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = new URL("saree_manifest.json", base).href;
    document.head.appendChild(link);
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;

    const swUrl = new URL("saree_sw.js?v=20261001", base).href;
    window.sareePwaRegistrationPromise = new Promise(resolve => {
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register(swUrl, {
            scope: base.pathname,
            updateViaCache: "none"
          });
          try { await registration.update(); } catch (_) {}
          resolve(registration);
        } catch (err) {
          console.warn("PWA service worker:", err);
          resolve(null);
        }
      };

      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    });
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isSafari() {
    const ua = navigator.userAgent;
    return /safari/i.test(ua) &&
      !/crios|fxios|edgios|opios|mercury/i.test(ua);
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
    btn.title = "تثبيت تطبيق سعرلي سوريا";
    btn.style.marginInlineStart = "8px";
    btn.addEventListener("click", installApp);

    const account = document.getElementById("topAccountBtn");
    if (account) account.parentNode.insertBefore(btn, account);
    else top.appendChild(btn);
    updateButton();
  }

  function updateButton() {
    const btn = document.getElementById("sareePwaInstallButton");
    if (!btn) return;
    btn.style.display = isStandalone() ? "none" : "inline-block";
    btn.textContent = isIOS() ? "📱 تثبيت على الآيفون" : "📱 تحميل التطبيق";
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
    const browserHint = isSafari()
      ? "أنت في Safari بالفعل."
      : "على الآيفون افتح هذا الرابط في Safari ثم أكمل الخطوات.";

    alert(
      "تثبيت سعرلي سوريا على الآيفون:\n\n" +
      browserHint + "\n\n" +
      "1) اضغط زر المشاركة ⬆️\n" +
      "2) اختر «إضافة إلى الشاشة الرئيسية»\n" +
      "3) اضغط «إضافة»\n\n" +
      "بعدها سيظهر سعرلي سوريا كأيقونة على الشاشة الرئيسية ويفتح كتطبيق."
    );
  }

  function installApp() {
    if (isStandalone()) return;

    // iOS/iPadOS لا يوفّر beforeinstallprompt، لذلك التثبيت يتم من قائمة المشاركة.
    if (isIOS()) {
      showIOSInstructions();
      return;
    }

    // على Android/Chromium نستخدم نافذة التثبيت الرسمية.
    if (deferredPrompt) {
      openNativeInstall();
      return;
    }

    // التأكيد فقط عندما تكون هناك نافذة تثبيت رسمية محتملة.
    const ok = window.confirm(
      "هل تريد تثبيت تطبيق «سعرلي سوريا» على جهازك؟\n\nاضغط «موافق» للتثبيت أو «إلغاء» للرجوع."
    );
    if (!ok) return;

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
      }
    }, 250);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    createButton();
    updateButton();

    if (installRequested) {
      installRequested = false;
      openNativeInstall();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateButton();
  });

  window.addEventListener("pageshow", updateButton);

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
