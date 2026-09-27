حزمة تطبيق سعري سوريا - صفحة /app

1) ارفع الملفات الستة في نفس مجلد index.html:
   saree_pwa.js
   saree_manifest.json
   saree_sw.js
   saree-icon-192.png
   saree-icon-512.png
   (README_AR.txt اختياري)

2) ارفع مجلد app كاملًا بجانب index.html:
   app/index.html

3) في index.html أضف فقط:
   <script src="saree_pwa.js"></script>

4) صفحة التثبيت ستكون:
   /app/

5) سيظهر في الموقع شريط «📱 تحميل التطبيق» يفتح صفحة /app/.
   وعلى الأجهزة التي تدعم التثبيت المباشر سيظهر زر «تثبيت التطبيق».

مهم: يجب أن يعمل الموقع عبر HTTPS حتى يعمل Service Worker والتثبيت بشكل صحيح.
