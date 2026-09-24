// saree_push_notifications.js

const SUPABASE_URL = "ضع رابط مشروع Supabase هنا";
const SUPABASE_ANON_KEY = "ضع مفتاح Supabase العام هنا";

async function enableSareeNotifications() {
  if (!("serviceWorker" in navigator)) {
    console.log("Service Worker غير مدعوم");
    return;
  }

  if (!("PushManager" in window)) {
    console.log("Push غير مدعوم");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.log("لم يسمح المستخدم بالإشعارات");
    return;
  }

  const registration = await navigator.serviceWorker.register(
    "/saree_push_sw.js"
  );

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey:
      "ضع VAPID_PUBLIC_KEY هنا"
  });

  await fetch(
    SUPABASE_URL + "/rest/v1/push_subscriptions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        subscription: subscription
      })
    }
  );

  console.log("تم تسجيل الإشعارات بنجاح");
}

window.enableSareeNotifications = enableSareeNotifications;
