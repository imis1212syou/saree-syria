(function () {
  'use strict';

  // يجعل الموقع قابلاً للتثبيت كتطبيق Android/iPhone بدون تغيير واجهة الموقع.
  function setupPWA() {
    if (!location.protocol.startsWith('http')) return;

    // Manifest
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = './saree_manifest.json';
      document.head.appendChild(link);
    }

    // Mobile browser/app appearance.
    const metas = [
      ['theme-color', '#071014'],
      ['mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
      ['apple-mobile-web-app-title', 'سعري سوريا']
    ];
    metas.forEach(([name, content]) => {
      if (!document.querySelector('meta[name="' + name + '"]')) {
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });

    // iPhone/iPad icon.
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = './saree-icon-192.png';
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPWA, { once: true });
  } else {
    setupPWA();
  }
})();
