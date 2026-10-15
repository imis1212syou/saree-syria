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

    const swUrl = new URL("saree_sw.js?v=20261006-pwa-install-log", base).href;
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
      if(result && result.outcome === "accepted") logInstallEvent();
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


  function currentVisitorId(){
    try{return localStorage.getItem('saree_visitor_id')||localStorage.getItem('visitor_id')||null;}catch(_){return null;}
  }

  async function logInstallEvent(){
    try{
      const key='saree_pwa_install_logged_v2';
      if(localStorage.getItem(key)) return;
      const client=window.supabaseClient;
      if(!client) return;
      const {error}=await client.rpc('record_app_install');
      if(error) throw error;
      localStorage.setItem(key,new Date().toISOString());
    }catch(err){
      console.warn('PWA install log:',err);
    }
  }

  async function renderAdminInstallStats(){
    const panel=document.getElementById('sareePwaInstallStats');
    if(!panel || window.__SAREE_ADMIN_STATUS__!==true) return;
    try{
      const client=window.supabaseClient;
      if(!client) return;
      const {data,error}=await client.rpc('admin_app_install_count');
      if(error) throw error;
      const total=Number(data||0);
      panel.innerHTML=`<div class="card"><div class="name">${total}</div><div class="muted">إجمالي تحميلات/تثبيتات التطبيق</div></div>`;
    }catch(err){
      console.warn('PWA admin stats:',err);
      panel.innerHTML='<div class="card muted">تعذر تحميل سجل تحميلات التطبيق حالياً.</div>';
    }
  }

  function ensureAdminInstallPanel(){
    if(window.__SAREE_ADMIN_STATUS__!==true) return;
    const adminPanel=document.getElementById('adminPanel');
    if(!adminPanel) return;
    let panel=document.getElementById('sareePwaInstallStats');
    if(!panel){
      panel=document.createElement('div');
      panel.id='sareePwaInstallStats';
      adminPanel.appendChild(panel);
    }
    renderAdminInstallStats();
  }

  window.ensureSareeAdminInstallPanel=ensureAdminInstallPanel;

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateButton();
    logInstallEvent();
  });

  function observeAdminPanel(){
    const panel=document.getElementById('adminPanel');
    if(!panel || panel.__sareePwaObserver) return;
    panel.__sareePwaObserver=true;
    const mo=new MutationObserver(()=>{
      if(window.__SAREE_ADMIN_STATUS__===true && !document.getElementById('sareePwaInstallStats')) ensureAdminInstallPanel();
    });
    mo.observe(panel,{childList:true,subtree:true});
    if(window.__SAREE_ADMIN_STATUS__===true) ensureAdminInstallPanel();
  }

  function init() {
    addManifest();
    registerSW();
    createButton();
    updateButton();
    observeAdminPanel();
    setTimeout(ensureAdminInstallPanel,600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
