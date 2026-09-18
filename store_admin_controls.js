/* سعرلي سوريا — store_admin_controls.js
   إضافات مستقلة لإدارة المتاجر والتجار من قبل المدير.
   لا تعدل store_features.js ولا barcode_scanner.js ولا index.html.
   تعتمد على نفس متغيرات ودوال المشروع الحالية: supabaseClient, profileData, stores,
   isAdmin عبر profileData.role، refreshAll، renderAdmin، uploadImage، openStore.
*/
(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const isAdmin = () => String(window.profileData?.role || '').toLowerCase() === 'admin';

  function adminOnly(){
    if(!isAdmin()){
      alert('المدير فقط يستطيع استخدام هذه الميزة.');
      return false;
    }
    return true;
  }

  function adminStoreId(id){
    return String(id ?? '');
  }

  function storeById(id){
    return (window.stores || []).find(x=>String(x.id)===adminStoreId(id)) || null;
  }

  async function refreshAdmin(){
    if(typeof window.renderAdmin==='function') await window.renderAdmin();
    setTimeout(injectAdminControls,80);
  }

  async function loadProfiles(){
    const {data,error}=await supabaseClient.from('profiles').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return data || [];
  }

  function storeEditHtml(st){
    const id=adminStoreId(st.id);
    return `<div class="card" id="adminStoreEdit_${esc(id)}" style="margin-top:10px">
      <h3>تعديل تفاصيل المتجر والشركة</h3>
      <div class="two">
        <input id="ase_name_${esc(id)}" value="${esc(st.name)}" placeholder="اسم المتجر">
        <input id="ase_city_${esc(id)}" value="${esc(st.city)}" placeholder="المدينة">
        <input id="ase_area_${esc(id)}" value="${esc(st.area)}" placeholder="المنطقة">
        <input id="ase_addr_${esc(id)}" value="${esc(st.address)}" placeholder="العنوان">
        <input id="ase_phone_${esc(id)}" value="${esc(st.phone)}" placeholder="الهاتف">
        <input id="ase_whatsapp_${esc(id)}" value="${esc(st.whatsapp_url || st.whatsapp)}" placeholder="رابط واتساب المتجر">
        <input id="ase_company_${esc(id)}" value="${esc(st.company_name || st.company)}" placeholder="اسم الشركة (اختياري)">
        <input id="ase_hours_${esc(id)}" value="${esc(st.opening_hours)}" placeholder="ساعات الدوام">
        <input id="ase_days_${esc(id)}" value="${esc(st.working_days)}" placeholder="أيام العمل">
        <input id="ase_image_${esc(id)}" type="file" accept="image/*">
      </div>
      <label class="muted"><input id="ase_verified_${esc(id)}" type="checkbox" ${st.verified?'checked':''}> المتجر موثّق</label>
      <label class="muted"><input id="ase_active_${esc(id)}" type="checkbox" ${st.active!==false?'checked':''}> المتجر نشط</label>
      <div class="actions">
        <button class="btn primary" onclick="saveAdminStoreDetails('${esc(id)}')">حفظ تفاصيل المتجر</button>
        <button class="btn secondary" onclick="cancelAdminStoreEdit('${esc(id)}')">إغلاق</button>
      </div>
      <p id="ase_msg_${esc(id)}" class="muted"></p>
    </div>`;
  }

  window.openAdminStoreEdit = function(id){
    if(!adminOnly()) return;
    const st=storeById(id); if(!st)return;
    const old=$('adminStoreEdit_'+id);
    if(old){old.remove();return;}
    const row=$('adminStoreRow_'+id);
    if(row) row.insertAdjacentHTML('beforeend',storeEditHtml(st));
  };

  window.cancelAdminStoreEdit = function(id){
    $('adminStoreEdit_'+id)?.remove();
  };

  window.saveAdminStoreDetails = async function(id){
    if(!adminOnly()) return;
    const st=storeById(id); if(!st)return;
    const msg=$('ase_msg_'+id);
    const setMsg=v=>{if(msg)msg.textContent=v};
    setMsg('جاري الحفظ...');

    let image_url=st.image_url || st.logo_url || null;
    const file=$('ase_image_'+id)?.files?.[0] || null;
    if(file){
      try{ image_url=await window.uploadImage(file,'stores'); }
      catch(err){ setMsg('فشل رفع صورة المتجر: '+err.message); return; }
    }

    const payload={
      name:$('ase_name_'+id)?.value.trim(),
      city:$('ase_city_'+id)?.value.trim(),
      area:$('ase_area_'+id)?.value.trim(),
      address:$('ase_addr_'+id)?.value.trim(),
      phone:$('ase_phone_'+id)?.value.trim(),
      whatsapp_url:$('ase_whatsapp_'+id)?.value.trim()||null,
      company_name:$('ase_company_'+id)?.value.trim()||null,
      opening_hours:$('ase_hours_'+id)?.value.trim(),
      working_days:$('ase_days_'+id)?.value.trim(),
      image_url,
      verified:!!$('ase_verified_'+id)?.checked,
      active:!!$('ase_active_'+id)?.checked
    };

    if(!payload.name){setMsg('اكتب اسم المتجر.');return;}
    const {error}=await supabaseClient.from('stores').update(payload).eq('id',id);
    if(error){setMsg(error.message);return;}
    alert('تم حفظ تفاصيل المتجر والتوثيق.');
    await refreshAdmin();
  };

  window.toggleAdminStoreVerification = async function(id){
    if(!adminOnly()) return;
    const st=storeById(id); if(!st)return;
    const next=!st.verified;
    if(!confirm(next?'توثيق هذا المتجر؟':'إلغاء توثيق هذا المتجر؟')) return;
    const {error}=await supabaseClient.from('stores').update({verified:next}).eq('id',id);
    if(error)return alert(error.message);
    alert(next?'تم توثيق المتجر.':'تم إلغاء توثيق المتجر.');
    await refreshAdmin();
  };

  window.deleteAdminStore = async function(id){
    if(!adminOnly()) return;
    const st=storeById(id); if(!st)return;
    if(!confirm('حذف المتجر «'+(st.name||'')+'»؟\n\nسيتم أولاً محاولة الحذف الفعلي. إذا كانت هناك بيانات مرتبطة تمنع الحذف، لن يتم تغيير البيانات تلقائياً.')) return;

    const {error}=await supabaseClient.from('stores').delete().eq('id',id);
    if(error){
      alert('تعذر حذف المتجر من قاعدة البيانات. السبب:\n'+error.message+'\n\nلم يتم تغيير المتجر تلقائياً حفاظاً على البيانات المرتبطة به.');
      return;
    }
    alert('تم حذف المتجر.');
    await refreshAdmin();
    if(typeof window.refreshAll==='function') await window.refreshAll();
  };

  function merchantVerificationField(u){
    const hasVerified=Object.prototype.hasOwnProperty.call(u,'verified');
    const checked=!!u.verified;
    if(!hasVerified){
      return '<div class="muted">توثيق التاجر: غير مفعّل في بنية الحساب الحالية. إذا كان جدول profiles لا يحتوي الحقل verified فلن يتم إنشاء حقل جديد تلقائياً من المتصفح.</div>';
    }
    return `<label class="muted"><input id="av_${esc(u.id)}" type="checkbox" ${checked?'checked':''}> التاجر موثّق من المدير</label>`;
  }

  window.toggleAdminMerchantVerification = async function(id){
    if(!adminOnly()) return;
    const profiles=await loadProfiles().catch(err=>{alert(err.message);return null});
    if(!profiles)return;
    const u=profiles.find(x=>String(x.id)===String(id));
    if(!u)return alert('الحساب غير موجود.');
    if(!Object.prototype.hasOwnProperty.call(u,'verified')){
      return alert('ميزة توثيق التاجر تحتاج إلى حقل verified في جدول profiles. لم يتم تعديل قاعدة البيانات تلقائياً.');
    }
    const next=!u.verified;
    if(!confirm(next?'توثيق هذا التاجر؟':'إلغاء توثيق هذا التاجر؟'))return;
    const {error}=await supabaseClient.from('profiles').update({verified:next}).eq('id',id);
    if(error)return alert(error.message);
    alert(next?'تم توثيق التاجر.':'تم إلغاء توثيق التاجر.');
    await refreshAdmin();
  };

  window.deleteAdminMerchant = async function(id){
    if(!adminOnly()) return;
    if(String(id)===String(window.ADMIN_UID||'')) return alert('لا يمكن حذف حساب المدير.');
    const profiles=await loadProfiles().catch(err=>{alert(err.message);return null});
    if(!profiles)return;
    const u=profiles.find(x=>String(x.id)===String(id));
    if(!u)return alert('الحساب غير موجود.');
    if(!confirm('حذف حساب التاجر «'+(u.name||u.email||u.id)+'»؟\n\nسيتم حذف سجل الحساب من profiles وفك ارتباطه بالمتجر. حذف مستخدم Supabase Auth نفسه يحتاج صلاحية خادمية، لذلك هذا الملف لا يضع Service Role Key داخل المتصفح.')) return;

    const {error}=await supabaseClient.from('profiles').delete().eq('id',id);
    if(error){
      alert('تعذر حذف سجل التاجر من profiles. السبب:\n'+error.message);
      return;
    }
    alert('تم حذف سجل التاجر وفك ارتباطه من بيانات المشروع.');
    await refreshAdmin();
  };

  function merchantActions(u){
    if(u.id===window.ADMIN_UID)return '';
    const verify=Object.prototype.hasOwnProperty.call(u,'verified')
      ? `<button class="btn secondary" onclick="toggleAdminMerchantVerification('${esc(u.id)}')">${u.verified?'إلغاء توثيق التاجر':'توثيق التاجر'}</button>`
      : '';
    return `<div class="actions">${verify}<button class="btn secondary" onclick="deleteAdminMerchant('${esc(u.id)}')">حذف التاجر</button></div>`;
  }

  function injectMerchantButtons(){
    document.querySelectorAll('#adminPanel .priceRow').forEach(row=>{
      const text=row.textContent||'';
      if(!text.includes('حساب تاجر'))return;
      if(row.querySelector('[data-admin-merchant-actions]'))return;
      const btn=row.querySelector('button[onclick^="saveUser"]');
      if(!btn)return;
      const onclick=btn.getAttribute('onclick')||'';
      const m=onclick.match(/saveUser\('([^']+)'\)/);
      if(!m)return;
      const id=m[1];
      const actions=document.createElement('div');
      actions.setAttribute('data-admin-merchant-actions','1');
      actions.className='actions';
      actions.innerHTML=`<button class="btn secondary" onclick="toggleAdminMerchantVerification('${esc(id)}')">توثيق التاجر</button><button class="btn secondary" onclick="deleteAdminMerchant('${esc(id)}')">حذف التاجر</button>`;
      btn.parentElement?.appendChild(actions);
    });
  }

  function injectStoreButtons(){
    const storeBlock=document.querySelectorAll('#adminPanel .priceRow');
    (window.stores||[]).forEach(st=>{
      let row=$('adminStoreRow_'+st.id);
      if(!row){
        const candidates=Array.from(storeBlock).filter(x=>(x.textContent||'').includes(st.name||'') && x.querySelector('button[onclick*="openStore"]'));
        row=candidates[0]||null;
        if(row) row.id='adminStoreRow_'+st.id;
      }
      if(!row)return;
      if(row.querySelector('[data-admin-store-actions]'))return;
      const actions=document.createElement('div');
      actions.setAttribute('data-admin-store-actions','1');
      actions.className='actions';
      actions.innerHTML=`<button class="btn secondary" onclick="openAdminStoreEdit('${esc(st.id)}')">تعديل تفاصيل المتجر</button><button class="btn secondary" onclick="toggleAdminStoreVerification('${esc(st.id)}')">${st.verified?'إلغاء توثيق المتجر':'توثيق المتجر'}</button><button class="btn secondary" onclick="deleteAdminStore('${esc(st.id)}')">حذف المتجر</button>`;
      row.appendChild(actions);
    });
  }

  function injectAdminControls(){
    if(!isAdmin() || !$('adminPanel'))return;
    injectMerchantButtons();
    injectStoreButtons();
  }

  const originalRenderAdmin=window.renderAdmin;
  if(typeof originalRenderAdmin==='function'){
    window.renderAdmin=async function(){
      const result=await originalRenderAdmin.apply(this,arguments);
      setTimeout(injectAdminControls,60);
      return result;
    };
  }

  window.addEventListener('load',()=>setTimeout(injectAdminControls,120));
  window.addEventListener('saree:admin-refresh',()=>setTimeout(injectAdminControls,60));

  /*
    توثيق التاجر يعتمد على profiles.verified إن كان الحقل موجوداً بالفعل.
    لا يتم إنشاء أعمدة أو سياسات RLS من JavaScript داخل المتصفح.
  */
  window.storeAdminControls={
    refresh:refreshAdmin,
    inject:injectAdminControls
  };
})();
