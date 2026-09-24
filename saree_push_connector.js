/* سعرلي سوريا — ملف ربط إشعارات الهاتف
   ملف مستقل: يربط الموقع بخدمة Web Push بعد إعداد مفاتيح VAPID في Edge Functions.
   لا يعدل الملفات القديمة.
*/

(() => {
  "use strict";

  const CONFIG = {
    edgeFunction: "smart-action",
    vapidKeySource: "site_push_settings"
  };

  async function subscribeToPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("المتصفح لا يدعم إشعارات الهاتف");
    }

    const registration = await navigator.serviceWorker.ready;

    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      throw new Error("لم يتم السماح بالإشعارات");
    }

    // المفتاح العام يتم جلبه من إعدادات الموقع/قاعدة البيانات
    const vapidPublicKey = window.sareeVapidPublicKey;
    if (!vapidPublicKey) {
      throw new Error("VAPID_PUBLIC_KEY غير مربوط بالموقع");
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey
    });

    return subscription;
  }

  window.sareePushConnector = {
    subscribeToPush,
    config: CONFIG
  };
})();
