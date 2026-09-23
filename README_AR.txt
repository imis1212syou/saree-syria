تجهيز موقع «سعري سوريا» كتطبيق مجاني PWA

1) ارفع هذه الملفات الأربعة إلى جذر الموقع نفسه بجانب index.html:
   - saree_manifest.json
   - saree_sw.js
   - saree_pwa.js
   - saree-icon-192.png
   - saree-icon-512.png

2) في نهاية index.html وقبل </body> أضف:
   <script src="saree_pwa.js"></script>

3) ارفع الملفات إلى GitHub Pages وانتظر تحديث الموقع.

4) على Android/Chrome:
   افتح الموقع، ثم من قائمة Chrome اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» حسب إصدار المتصفح.

لا يحتاج هذا إلى Google Play أو رسوم. الموقع يبقى كما هو، وSupabase يبقى كما هو.

ملاحظة: Service Worker يخزن ملفات الموقع الأساسية فقط ولا يخزن طلبات Supabase/API عبر الإنترنت.
