/* سعرلي سوريا — ربط Web Push مع smart-action */
(() => {
  "use strict";

  const SUPABASE_URL = "https://ovocwugezuddbwypzteg.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_THEl1NqFWWRUImYpTLxu9g_iGM03Nsz";
  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/smart-action`;

  function base64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(normalized);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async function getVapidPublicKey() {
    const res = await fetch(`${FUNCTION_URL}?action=vapid-public-key`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.vapid_public_key) {
      throw new Error(data.error || "تعذر الحصول على VAPID_PUBLIC_KEY");
    }
    window.sareeVapidPublicKey = data.vapid_public_key;
    return data.vapid_public_key;
  }

  async function subscribeToPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("المتصفح لا يدعم إشعارات Push");
    }

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if (permission !== "granted") throw new Error("لم يتم السماح بالإشعارات");

    const registration = await navigator.serviceWorker.ready;
    const publicKey = await getVapidPublicKey();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(publicKey),
      });
    }

    const res = await fetch(`${FUNCTION_URL}?action=subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "فشل حفظ اشتراك الهاتف");

    localStorage.setItem("saree_push_enabled", "1");
    return subscription;
  }

  async function unsubscribeFromPush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch(`${FUNCTION_URL}?action=unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});

    await subscription.unsubscribe();
    localStorage.removeItem("saree_push_enabled");
  }

  window.sareePushConnector = {
    subscribeToPush,
    unsubscribeFromPush,
    getVapidPublicKey,
    functionUrl: FUNCTION_URL,
  };

  // توافق مع الزر/الكود القديم إن كان موجودًا.
  window.enableSareeNotifications = subscribeToPush;
})();
