/*
 * سعرلي سوريا — V3: ربط حسابات الشركات والمتاجر + الصلاحيات + أزرار الإدارة + إحصائيات الزوار
 *
 * هذا الملف إضافي فقط. لا يحذف ولا يعدّل الملفات القديمة.
 * حمّله بعد آخر ملفات JavaScript الحالية في index.html.
 *
 * يعتمد على:
 *   window.supabaseClient
 *   profileData
 *   window.sareeCheckAdmin / public.is_admin()
 *   الجداول الحالية: profiles, stores, companies, company_users,
 *   company_products, price_listings, store_visitor_visits, company_visitor_visits
 */

(function () {
  "use strict";

  const ADMIN_UID = "fb610b6d-8b2b-4d6d-a957-dda26f1be4a2";
  const CARD_ID = "sareeOwnerV3AdminCard";
  let accountsCache = [];
  let storesCache = [];
  let companiesCache = [];
  let initialized = false;

  const $ = (id) => document.getElementById(id);
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  const attr = (v) => esc(v).replace(/`/g, "&#096;");
  const fmt = (v) => Number(v ?? 0).toLocaleString("ar-SY", {
    maximumFractionDigits: 0
  });

  function client() {
    return window.supabaseClient;
  }

  async function isAdmin() {
    try {
      if (window.__SAREE_ADMIN_STATUS__ === true) return true;
      if (typeof window.sareeCheckAdmin === "function") {
        const ok = await window.sareeCheckAdmin(true);
        if (ok) return true;
      }
      const { data: { user } = {} } = await client().auth.getUser();
      return String(user?.id || "") === ADMIN_UID;
    } catch (_) {
      return false;
    }
  }

  function role() {
    return String(window.profileData?.role || "").toLowerCase();
  }

  function addCss() {
    if ($("sareeOwnerV3Css")) return;
    const s = document.createElement("style");
    s.id = "sareeOwnerV3Css";
    s.textContent = `
      #${CARD_ID} .ov3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #${CARD_ID} .ov3-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #${CARD_ID} .ov3-box{padding:12px;border:1px solid #303b40;border-radius:14px;background:#0d1418;margin-top:10px}
      #${CARD_ID} .ov3-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      #${CARD_ID} .ov3-checks label{display:flex;gap:7px;align-items:center}
      #${CARD_ID} .ov3-account{border:1px solid #303b40;border-radius:14px;padding:12px;margin-top:10px}
      #${CARD_ID} .ov3-account .ov3-perms{font-size:13px;line-height:1.8}
      #${CARD_ID} .ov3-muted{opacity:.78;font-size:12px}
      #${CARD_ID} .ov3-danger{color:#ff8d8d}
      .saree-owner-v3-stat{padding:14px;border:1px solid #303b40;border-radius:14px;background:#0d1418}
      .saree-owner-v3-stat b{font-size:24px}
      .saree-owner-v3-products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .saree-owner-v3-product{padding:12px;border:1px solid #303b40;border-radius:14px;background:#0d1418}
      .saree-owner-v3-product .actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
      @media(max-width:700px){
        #${CARD_ID} .ov3-grid,#${CARD_ID} .ov3-grid-3,#${CARD_ID} .ov3-checks,
        .saree-owner-v3-products{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(s);
  }

  async function loadAdminData() {
    const [a, s, c] = await Promise.all([
      client().rpc("admin_owner_accounts_v3"),
      client().from("stores").select("id,name,city,area,company_id,active").order("name"),
      client().from("companies").select("id,name,active").order("name")
    ]);
    if (a.error) throw a.error;
    if (s.error) throw s.error;
    if (c.error) throw c.error;
    accountsCache = (Array.isArray(a.data) ? a.data : []).filter(x => String(x.user_id) !== ADMIN_UID);
    storesCache = Array.isArray(s.data) ? s.data : [];
    companiesCache = Array.isArray(c.data) ? c.data : [];
  }

  function permissionMarkup(type, current = {}) {
    if (type === "company") {
      return `
        <div class="ov3-box">
          <b>صلاحيات الشركة</b>
          <div class="ov3-checks">
            <label><input id="ov3_company_manage" type="checkbox" ${current.can_manage_products ? "checked" : ""}> إضافة وإدارة المنتجات</label>
            <label><input id="ov3_company_edit" type="checkbox" ${current.can_edit_products ? "checked" : ""}> تعديل المنتجات</label>
            <label><input id="ov3_company_delete" type="checkbox" ${current.can_delete_products ? "checked" : ""}> حذف المنتجات</label>
            <label><input id="ov3_company_cat" type="checkbox" ${current.can_manage_categories ? "checked" : ""}> إدارة التصنيفات</label>
            <label><input id="ov3_company_settings" type="checkbox" ${current.can_manage_settings ? "checked" : ""}> إعدادات الشركة</label>
            <label><input id="ov3_company_orders" type="checkbox" ${current.can_view_orders ? "checked" : ""}> مشاهدة الطلبات</label>
            <label><input id="ov3_company_visits" type="checkbox" ${current.can_view_visits ? "checked" : ""}> مشاهدة عدد الزوار</label>
          </div>
        </div>`;
    }
    return `
      <div class="ov3-box">
        <b>صلاحيات المتجر</b>
        <div class="ov3-checks">
          <label><input id="ov3_store_manage" type="checkbox" ${current.can_manage_store_products || current.can_edit_prices ? "checked" : ""}> إضافة / تعديل / حذف مواد وأسعار المتجر</label>
          <label><input id="ov3_store_visits" type="checkbox" ${current.can_view_store_visits ? "checked" : ""}> مشاهدة عدد زوار المتجر</label>
        </div>
        <div class="ov3-muted">هذه الصلاحيات تطبق على المتجر المرتبط بهذا الحساب فقط.</div>
      </div>`;
  }

  function currentAccount(uid) {
    return accountsCache.find(x => String(x.user_id) === String(uid)) || null;
  }

  function buildAdminCard() {
    const panel = $("adminPanel");
    if (!panel) return;
    let box = $(CARD_ID);
    if (!box) {
      box = document.createElement("div");
      box.id = CARD_ID;
      box.className = "card";
      panel.insertBefore(box, panel.firstChild);
    }

    const activeAccounts = accountsCache.filter(a =>
      a.store_id || a.company_id
    );
    const userOptions = accountsCache.map(a =>
      `<option value="${attr(a.user_id)}">${esc(a.name || "حساب")} — ${esc(a.email || "")}</option>`
    ).join("");

    box.innerHTML = `
      <h2>👤 ربط الحسابات والصلاحيات</h2>
      <p class="muted">من هنا تعطي الحساب صلاحية متجر أو شركة وتربطه بالمكان الذي يخصه. لا يحتاج الحساب إلى إرسال طلب منفصل.</p>

      <div class="ov3-grid">
        <div>
          <label class="muted">الحساب</label>
          <select id="ov3_user">${userOptions || '<option value="">لا توجد حسابات</option>'}</select>
        </div>
        <div>
          <label class="muted">نوع الربط</label>
          <select id="ov3_type">
            <option value="store">متجر</option>
            <option value="company">شركة</option>
          </select>
        </div>
      </div>

      <div style="margin-top:10px">
        <label class="muted">المتجر / الشركة</label>
        <select id="ov3_target"></select>
      </div>

      <div id="ov3_permissions"></div>

      <div class="actions" style="margin-top:10px">
        <button type="button" class="btn primary" id="ov3_save">حفظ الربط والصلاحيات</button>
        <button type="button" class="btn danger" id="ov3_unlink">فك الربط وإعادة الحساب لمستخدم عادي</button>
        <button type="button" class="btn secondary" id="ov3_refresh">تحديث القائمة</button>
      </div>

      <div class="ov3-box">
        <h3 style="margin-top:0">الحسابات المرتبطة حالياً</h3>
        <div id="ov3_linked_list">${activeAccounts.length ? activeAccounts.map(renderLinkedAccount).join("") : '<div class="muted">لا توجد حسابات مرتبطة بعد.</div>'}</div>
      </div>
    `;

    const userSel = $("ov3_user");
    const typeSel = $("ov3_type");

    function fillEditor() {
      const a = currentAccount(userSel.value);
      const type = typeSel.value;
      const target = type === "company" ? a?.company_id : a?.store_id;
      const list = type === "company" ? companiesCache : storesCache;
      $("ov3_target").innerHTML =
        `<option value="">اختر ${type === "company" ? "الشركة" : "المتجر"}</option>` +
        list.filter(x => x.active !== false).map(x =>
          `<option value="${attr(x.id)}" ${String(x.id) === String(target || "") ? "selected" : ""}>${esc(x.name)}${x.city ? ` — ${esc(x.city)}` : ""}</option>`
        ).join("");
      $("ov3_permissions").innerHTML = permissionMarkup(type, a || {});
    }

    userSel?.addEventListener("change", fillEditor);
    typeSel?.addEventListener("change", fillEditor);
    $("ov3_refresh")?.addEventListener("click", async () => {
      try {
        await loadAdminData();
        buildAdminCard();
      } catch (e) {
        alert("تعذر تحديث الحسابات: " + (e.message || e));
      }
    });

    $("ov3_save")?.addEventListener("click", async () => {
      const uid = userSel?.value;
      const type = typeSel?.value;
      const target = $("ov3_target")?.value;
      if (!uid || !target) return alert("اختر الحساب ثم المتجر أو الشركة.");

      try {
        let error = null;
        if (type === "company") {
          const r = await client().rpc("admin_link_company_user_v3", {
            p_user_id: uid,
            p_company_id: target,
            p_can_manage_products: !!$("ov3_company_manage")?.checked,
            p_can_edit_products: !!$("ov3_company_edit")?.checked,
            p_can_delete_products: !!$("ov3_company_delete")?.checked,
            p_can_manage_categories: !!$("ov3_company_cat")?.checked,
            p_can_manage_settings: !!$("ov3_company_settings")?.checked,
            p_can_view_orders: !!$("ov3_company_orders")?.checked,
            p_can_view_visits: !!$("ov3_company_visits")?.checked
          });
          error = r.error;
        } else {
          const manage = !!$("ov3_store_manage")?.checked;
          const visits = !!$("ov3_store_visits")?.checked;
          const r = await client().rpc("admin_link_store_user_v3", {
            p_user_id: uid,
            p_store_id: target,
            p_can_manage_products: manage,
            p_can_view_visits: visits
          });
          error = r.error;
        }
        if (error) throw error;
        alert("تم حفظ الربط والصلاحيات بنجاح ✅");
        await window.sareeOwnerV3RefreshAdmin();
      } catch (e) {
        alert("تعذر حفظ الربط: " + (e.message || e));
      }
    });

    $("ov3_unlink")?.addEventListener("click", async () => {
      const uid = userSel?.value;
      if (!uid) return alert("اختر الحساب أولاً.");
      if (!confirm("فك ربط الحساب من المتجر/الشركة وتحويله إلى مستخدم عادي؟")) return;
      const { error } = await client().rpc("admin_unlink_owner_v3", { p_user_id: uid });
      if (error) return alert("تعذر فك الربط: " + error.message);
      alert("تم فك الربط ✅");
      await window.sareeOwnerV3RefreshAdmin();
    });

    fillEditor();
  }

  function renderLinkedAccount(a) {
    const target = a.company_name || a.store_name || "غير مرتبط";
    const type = a.company_id ? "شركة" : "متجر";
    let p = "";
    if (a.company_id) {
      p = [
        a.can_manage_products ? "إدارة منتجات" : "",
        a.can_edit_products ? "تعديل" : "",
        a.can_delete_products ? "حذف" : "",
        a.can_manage_categories ? "تصنيفات" : "",
        a.can_manage_settings ? "إعدادات" : "",
        a.can_view_orders ? "طلبات" : "",
        a.can_view_visits ? "زوار" : ""
      ].filter(Boolean).join(" • ");
    } else {
      p = [
        a.can_edit_prices ? "مواد وأسعار" : "",
        a.can_view_store_visits ? "زوار" : ""
      ].filter(Boolean).join(" • ");
    }
    return `
      <div class="ov3-account">
        <div><b>${esc(a.name || "حساب")}</b> <span class="pill">${type}</span></div>
        <div class="muted">${esc(a.email || "")}</div>
        <div class="muted">مرتبط بـ: <b>${esc(target)}</b></div>
        <div class="ov3-perms">${esc(p || "بدون صلاحيات فعلية")}</div>
        <div class="actions">
          <button type="button" class="btn secondary" data-ov3-edit="${attr(a.user_id)}">${a.company_id ? "تعديل صلاحيات الشركة" : "تعديل صلاحيات المتجر"}</button>
          <button type="button" class="btn danger" data-ov3-unlink="${attr(a.user_id)}">فك الربط</button>
        </div>
      </div>`;
  }

  async function refreshAdmin() {
    if (!(await isAdmin())) return;
    addCss();
    try {
      await loadAdminData();
      buildAdminCard();
    } catch (e) {
      const panel = $("adminPanel");
      if (panel) {
        let box = $(CARD_ID);
        if (!box) {
          box = document.createElement("div");
          box.id = CARD_ID;
          box.className = "card";
          panel.insertBefore(box, panel.firstChild);
        }
        box.innerHTML = `<h2>👤 ربط الحسابات والصلاحيات</h2><div class="card dangerbox">تعذر تحميل بيانات الصلاحيات: ${esc(e.message || e)}</div>`;
      }
    }
  }

  async function editAccount(uid) {
    const a = currentAccount(uid);
    if (!a) return;
    const type = a.company_id ? "company" : "store";
    const userSel = $("ov3_user");
    const typeSel = $("ov3_type");
    if (userSel) userSel.value = uid;
    if (typeSel) typeSel.value = type;
    userSel?.dispatchEvent(new Event("change"));
    setTimeout(() => {
      const t = $("ov3_target");
      if (t) t.value = type === "company" ? (a.company_id || "") : (a.store_id || "");
      $("ov3_permissions").innerHTML = permissionMarkup(type, a);
      $("ov3_save")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function bindAdminDelegates() {
    const box = $(CARD_ID);
    if (!box || box.dataset.ov3Bound) return;
    box.dataset.ov3Bound = "1";
    box.addEventListener("click", async (ev) => {
      const edit = ev.target.closest("[data-ov3-edit]");
      if (edit) return editAccount(edit.dataset.ov3Edit);
      const unlink = ev.target.closest("[data-ov3-unlink]");
      if (unlink) {
        if (!confirm("فك ربط هذا الحساب؟")) return;
        const { error } = await client().rpc("admin_unlink_owner_v3", { p_user_id: unlink.dataset.ov3Unlink });
        if (error) return alert(error.message);
        await refreshAdmin();
      }
    });
  }

  async function injectCompanyVisitorCard() {
    if (role() !== "company" || !window.companyContext) return;
    const ctx = window.companyContext;
    if (!ctx.can_view_visits) return;
    const host = $("adminPanel");
    if (!host) return;
    let box = $("sareeOwnerV3CompanyVisitors");
    if (!box) {
      box = document.createElement("div");
      box.id = "sareeOwnerV3CompanyVisitors";
      box.className = "card";
      host.insertBefore(box, host.firstChild);
    }
    box.innerHTML = `
      <h2>👁️ زوار الشركة</h2>
      <div class="ov3-grid-3">
        <div class="saree-owner-v3-stat"><b id="ov3_company_total">—</b><div class="muted">إجمالي الزيارات المسجلة</div></div>
        <div class="saree-owner-v3-stat"><b id="ov3_company_unique">—</b><div class="muted">الزوار الفريدون</div></div>
        <div class="saree-owner-v3-stat"><b>${esc(ctx.companies?.name || "")}</b><div class="muted">الشركة المرتبطة</div></div>
      </div>
    `;
    const { data, error } = await client().rpc("owner_company_visitor_stats_v3", { p_company_id: ctx.company_id });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      $("ov3_company_total").textContent = fmt(row?.total_visits || 0);
      $("ov3_company_unique").textContent = fmt(row?.unique_visitors || 0);
    } else {
      $("ov3_company_total").textContent = "—";
      $("ov3_company_unique").textContent = "—";
      box.insertAdjacentHTML("beforeend", `<div class="muted">تعذر تحميل الإحصاءات: ${esc(error.message)}</div>`);
    }
  }

  async function loadStoreListings(storeId) {
    const { data, error } = await client()
      .from("price_listings")
      .select("id,store_id,product_id,price_new,price,updated_at,products(id,name,brand,unit,category,barcode,image_url)")
      .eq("store_id", storeId)
      .eq("approved", true)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  function uniqueByProduct(rows) {
    const map = new Map();
    rows.forEach(r => {
      const k = String(r.product_id || r.id);
      if (!map.has(k)) map.set(k, r);
    });
    return [...map.values()];
  }

  function buildStoreOwnerPanel(store, profile) {
    const canManage = profile?.can_manage_store_products === true || profile?.can_edit_prices === true;
    const canVisits = profile?.can_view_store_visits === true;
    const panel = $("merchantPanel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="card">
        ${store?.image_url ? `<img class="img storeLogo" src="${attr(store.image_url)}" alt="${attr(store.name)}">` : ""}
        <div class="name">${esc(store?.name || "لا يوجد متجر مرتبط")}</div>
        <div class="notice ${store ? (canManage ? "" : "pending") : "pending"}">
          ${store
            ? (canManage ? "الصلاحية مفعّلة لإدارة مواد وأسعار هذا المتجر فقط." : "الحساب مرتبط بهذا المتجر لكن صلاحية إدارة المواد غير مفعّلة.")
            : "الحساب غير مرتبط بمتجر. المدير يجب أن يربطه أولاً."}
        </div>

        <div class="ov3-grid-3" style="margin-top:10px">
          <div class="saree-owner-v3-stat"><b id="ov3_store_total">—</b><div class="muted">إجمالي زيارات المتجر</div></div>
          <div class="saree-owner-v3-stat"><b id="ov3_store_unique">—</b><div class="muted">الزوار الفريدون</div></div>
          <div class="saree-owner-v3-stat"><b>${canVisits ? "مسموح" : "غير مسموح"}</b><div class="muted">صلاحية إحصائيات الزوار</div></div>
        </div>

        <div class="actions">
          ${store ? `<button type="button" class="btn primary" onclick="openStore('${attr(store.id)}')">فتح متجري</button>` : ""}
          <button type="button" class="btn primary" ${canManage ? "" : "disabled"} id="ov3_store_add">➕ إضافة مادة / سعر</button>
          <button type="button" class="btn secondary" onclick="sareeOwnerV3OpenStoreDashboard()">🔄 تحديث اللوحة</button>
          <button type="button" class="btn secondary" onclick="logout()">تسجيل الخروج</button>
        </div>
      </div>

      <div class="card">
        <h2>مواد وأسعار متجرك</h2>
        <div id="ov3_store_products" class="saree-owner-v3-products"><div class="muted">جاري التحميل...</div></div>
      </div>
    `;

    $("ov3_store_add")?.addEventListener("click", () => {
      if (!canManage) return alert("لا توجد لديك صلاحية إدارة مواد هذا المتجر.");
      // showAdd هو نموذج المشروع الحالي ويحافظ على آلية المراجعة الموجودة.
      if (typeof window.showAdd === "function") window.showAdd();
    });

    loadStoreOwnerData(store, canVisits).catch(err => {
      const list = $("ov3_store_products");
      if (list) list.innerHTML = `<div class="card dangerbox">تعذر تحميل مواد المتجر: ${esc(err.message || err)}</div>`;
    });
  }

  async function loadStoreOwnerData(store, canVisits) {
    if (!store) return;
    const [rows, stats] = await Promise.all([
      loadStoreListings(store.id),
      canVisits
        ? client().rpc("owner_store_visitor_stats_v3", { p_store_id: store.id })
        : Promise.resolve({ data: null, error: null })
    ]);
    const list = $("ov3_store_products");
    const unique = uniqueByProduct(rows);
    list.innerHTML = unique.length ? unique.map(row => {
      const p = row.products || {};
      return `
        <div class="saree-owner-v3-product">
          ${p.image_url ? `<img class="img materialImage" src="${attr(p.image_url)}" alt="${attr(p.name || "مادة")}" loading="lazy">` : ""}
          <div class="name">${esc(p.name || "مادة")}</div>
          <div class="muted">${esc(p.category || "عام")}${p.brand ? ` • ${esc(p.brand)}` : ""}${p.unit ? ` • ${esc(p.unit)}` : ""}</div>
          ${p.barcode ? `<div class="muted">باركود: ${esc(p.barcode)}</div>` : ""}
          <div class="price">${fmt(row.price_new ?? row.price)} ل.س جديدة</div>
          <div class="actions">
            <button type="button" class="btn secondary" ${!((window.profileData?.can_manage_store_products === true) || (window.profileData?.can_edit_prices === true)) ? "disabled" : ""} onclick="sareeOwnerV3EditStoreMaterial('${attr(row.id)}','${attr(store.id)}')">تعديل</button>
            <button type="button" class="btn danger" ${!((window.profileData?.can_manage_store_products === true) || (window.profileData?.can_edit_prices === true)) ? "disabled" : ""} onclick="sareeOwnerV3DeleteStoreMaterial('${attr(row.id)}','${attr(store.id)}')">حذف</button>
          </div>
        </div>`;
    }).join("") : '<div class="card muted">لا توجد مواد وأسعار معتمدة لهذا المتجر حالياً.</div>';

    if (canVisits) {
      const e = stats?.error;
      const row = Array.isArray(stats?.data) ? stats.data[0] : stats?.data;
      if (e) {
        $("ov3_store_total").textContent = "—";
        $("ov3_store_unique").textContent = "—";
      } else {
        $("ov3_store_total").textContent = fmt(row?.total_visits || 0);
        $("ov3_store_unique").textContent = fmt(row?.unique_visitors || 0);
      }
    } else {
      $("ov3_store_total").textContent = "—";
      $("ov3_store_unique").textContent = "—";
    }
  }

  window.sareeOwnerV3OpenStoreDashboard = async function () {
    if (role() !== "store" || !window.profileData?.store_id) {
      return alert("الحساب غير مرتبط بمتجر.");
    }
    addCss();
    try {
      const { data, error } = await client()
        .from("stores")
        .select("id,name,city,area,address,phone,opening_hours,working_days,image_url,whatsapp_url,active")
        .eq("id", window.profileData.store_id)
        .maybeSingle();
      if (error) throw error;
      buildStoreOwnerPanel(data, window.profileData);
      if (typeof window.show === "function") window.show("merchant");
    } catch (e) {
      alert("تعذر فتح لوحة المتجر: " + (e.message || e));
    }
  };

  window.sareeOwnerV3EditStoreMaterial = async function (listingId, storeId) {
    if (role() !== "store" || String(window.profileData?.store_id || "") !== String(storeId)) {
      return alert("غير مسموح بتعديل هذا المتجر.");
    }
    if (!window.profileData?.can_manage_store_products && !window.profileData?.can_edit_prices) {
      return alert("لا توجد لديك صلاحية تعديل المواد.");
    }
    if (typeof window.editStoreMaterial === "function") {
      return window.editStoreMaterial(listingId, storeId);
    }
    alert("أداة تعديل المواد غير محمّلة حالياً.");
  };

  window.sareeOwnerV3DeleteStoreMaterial = async function (listingId, storeId) {
    if (role() !== "store" || String(window.profileData?.store_id || "") !== String(storeId)) {
      return alert("غير مسموح بحذف مادة من هذا المتجر.");
    }
    if (!window.profileData?.can_manage_store_products && !window.profileData?.can_edit_prices) {
      return alert("لا توجد لديك صلاحية حذف المواد.");
    }
    if (typeof window.deleteStoreMaterial === "function") {
      await window.deleteStoreMaterial(listingId, storeId);
      await window.sareeOwnerV3OpenStoreDashboard();
      return;
    }
    alert("أداة حذف المواد غير محمّلة حالياً.");
  };

  async function refreshProfileExtras() {
    const userId = window.profileData?.id;
    if (!userId) return false;
    const { data, error } = await client().from("profiles").select(
      "id,name,role,store_id,company_id,can_edit_prices,can_manage_store_products,can_view_store_visits,verified"
    ).eq("id", userId).maybeSingle();
    if (error || !data) return false;
    window.profileData = { ...window.profileData, ...data };
    // إبقاء الصلاحية القديمة متوافقة مع الصلاحية الجديدة.
    if (window.profileData.role === "store" && window.profileData.can_manage_store_products) {
      window.profileData.can_edit_prices = true;
    }
    return true;
  }

  function injectOwnerRoleButtons() {
    const box = $("roleActions");
    if (!box || !window.profileData) return;
    box.querySelectorAll(".saree-owner-v3-role-btn").forEach(x => x.remove());
    if (role() === "store") {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn primary saree-owner-v3-role-btn";
      b.textContent = "🏪 لوحة متجري";
      b.onclick = () => window.sareeOwnerV3OpenStoreDashboard();
      box.appendChild(b);
    } else if (role() === "company") {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn primary saree-owner-v3-role-btn";
      b.textContent = "🏢 لوحة شركتي";
      b.onclick = () => {
        if (window.companyContext?.companies?.id && typeof window.show === "function") {
          window.show("admin");
          setTimeout(() => injectCompanyVisitorCard().catch(console.warn), 60);
          return;
        }
        alert("لم يتم تحميل لوحة الشركة بعد. أعد فتح الصفحة.");
      };
      box.appendChild(b);
    }
  }

  async function refreshOwnerUi() {
    if (!window.profileData || window.profileData.is_admin) return;
    await refreshProfileExtras();

    if (role() === "store") {
      injectOwnerRoleButtons();
      if (window.profileData.store_id) {
        await window.sareeOwnerV3OpenStoreDashboard();
      }
    } else if (role() === "company") {
      injectOwnerRoleButtons();
      // company_system.js يبني لوحة الشركة. نضيف إليها إحصائيات الزوار والصلاحيات.
      setTimeout(() => injectCompanyVisitorCard().catch(console.warn), 80);
    }
  }

  window.sareeOwnerV3RefreshAdmin = async function () {
    if (!(await isAdmin())) return;
    await loadAdminData();
    buildAdminCard();
    bindAdminDelegates();
    // إعادة بناء القائمة بعد كل حفظ مع الإحصائيات الحالية إن كانت واجهاتها متاحة.
    if (typeof window.renderAdmin === "function") {
      try { await window.renderAdmin(); } catch (_) {}
    }
  };

  async function installAdminHook() {
    if (!(await isAdmin())) return;
    addCss();
    await refreshAdmin();
    bindAdminDelegates();

    if (initialized) return;
    initialized = true;

    const oldRenderAdmin = window.renderAdmin;
    if (typeof oldRenderAdmin === "function") {
      window.renderAdmin = async function () {
        const result = await oldRenderAdmin.apply(this, arguments);
        try {
          await refreshAdmin();
          bindAdminDelegates();
        } catch (e) {
          console.warn("saree owner admin refresh:", e);
        }
        return result;
      };
    }
  }

  async function installProfileHook() {
    if (window.__SAREE_OWNER_V3_PROFILE_HOOK__) return;
    window.__SAREE_OWNER_V3_PROFILE_HOOK__ = true;

    const old = window.loadProfile;
    if (typeof old === "function") {
      window.loadProfile = async function () {
        const result = await old.apply(this, arguments);
        try { await refreshOwnerUi(); } catch (e) { console.warn("owner ui:", e); }
        return result;
      };
    }

    // تشغيل مباشر عند تحميل الصفحة أو بعد تبديل الجلسة.
    try { await refreshOwnerUi(); } catch (_) {}

    if (client()?.auth?.onAuthStateChange) {
      client().auth.onAuthStateChange(() => {
        setTimeout(() => refreshOwnerUi().catch(console.warn), 200);
      });
    }
  }

  async function boot() {
    addCss();
    await installProfileHook();
    await installAdminHook();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(() => boot().catch(console.warn), 100), { once: true });
  } else {
    setTimeout(() => boot().catch(console.warn), 100);
  }

  window.addEventListener("load", () => setTimeout(() => boot().catch(console.warn), 250), { once: true });
})();
