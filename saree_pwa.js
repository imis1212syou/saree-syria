(function () {
  'use strict';

  var deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function setupManifestAndSW() {
    if (!/^https?:$/.test(location.protocol)) return;

    if (!document.querySelector('link[rel="manifest"]')) {
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = location.pathname.indexOf('/app') === 0 ? '../saree_manifest.json' : './saree_manifest.json';
      document.head.appendChild(link);
    }

    var metas = [
      ['theme-color', '#071014'],
      ['mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
      ['apple-mobile-web-app-title', 'سعري سوريا']
    ];
    metas.forEach(function (item) {
      if (!document.querySelector('meta[name="' + item[0] + '"]')) {
        var meta = document.createElement('meta');
        meta.name = item[0];
        meta.content = item[1];
        document.head.appendChild(meta);
      }
    });

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      var icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = location.pathname.indexOf('/app') === 0 ? '../saree-icon-192.png' : './saree-icon-192.png';
      document.head.appendChild(icon);
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./saree_sw.js', { scope: './' }).catch(function () {
          // لا نوقف الموقع إذا رفض المتصفح Service Worker.
        });
      });
    }
  }

  function installApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; updateInstallButtons(); });
      return true;
    }
    return false;
  }

  window.sareeInstallApp = installApp;

  function updateInstallButtons() {
    var buttons = document.querySelectorAll('[data-saree-install]');
    buttons.forEach(function (btn) {
      if (isStandalone()) {
        btn.style.display = 'none';
      } else if (deferredPrompt) {
        btn.style.display = '';
        btn.textContent = '📱 تثبيت التطبيق';
      } else {
        btn.style.display = '';
        btn.textContent = '📱 تحميل / تثبيت التطبيق';
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallButtons();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    updateInstallButtons();
  });

  function addSiteInstallButton() {
    if (isStandalone() || document.querySelector('[data-saree-install]')) return;
    if (location.pathname.indexOf('/app') === 0) return;

    var bar = document.createElement('div');
    bar.id = 'sareeAppInstallBar';
    bar.dir = 'rtl';
    bar.innerHTML = '<a href="/app/" style="text-decoration:none;color:inherit">📱 تحميل التطبيق</a>';
    bar.style.cssText = 'display:block;width:100%;box-sizing:border-box;text-align:center;padding:8px 12px;background:#071014;color:#fff;font:600 14px Arial,sans-serif;position:relative;z-index:20;';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function setup() {
    setupManifestAndSW();
    addSiteInstallButton();
    updateInstallButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
