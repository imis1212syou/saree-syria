/* سعرلي سوريا — إدارة المتاجر والشركات والتجار للمدير */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const profile=()=>{try{return typeof profileData!=='undefined'&&profileData?profileData:window.profileData}catch(_){return window.profileData||null}};
  const getStores=()=>{try{return typeof stores!=='undefined'&&Array.isArray(stores)?stores:(window.stores||[])}catch(_){return window.stores||[]}};
  const admin=()=>window.__SAREE_ADMIN_STATUS__===true;
  const onlyAdmin=()=>{if(!admin()){alert('المدير فقط يستطيع استخدام هذه الميزة.');return false}return true};
  const storeById=id=>getStores().find(x=>String(x.id)===String(id));

  window.sareeDeleteImage = async function(url){
    if(!url) return true;
    try{
      const marker='/storage/v1/object/public/product-images/';
      const i=String(url).indexOf(marker);
      if(i<0) return true;
      const path=decodeURIComponent(String(url).slice(i+marker.length));
      if(path) await supabaseClient.storage.from('product-images').remove([path]);
    }catch(e){ console.warn('delete image file:',e); }
    return true;
  };

  function overlay(html){
    const old=$('sareeAdminOverlay'); if(old) old.remove();
    const el=document.createElement('div'); el.id='sareeAdminOverlay';
    el.style='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.82);padding:18px;overflow:auto;display:flex;align-items:flex-start;justify-content:center';
    el.innerHTML=`<div style="width:min(760px,100%);margin:30px auto;background:#10191e;border:1px solid #33434b;border-radius:18px;padding:18px;box-shadow:0 20px 70px rgba(0,0,0,.5)">${html}</div>`;
    document.body.appendChild(el);
    el.addEventListener('click',ev=>{if(ev.target===el)el.remove()});
    return el;
  }

  window.closeAdminEditor=()=>$('sareeAdminOverlay')?.remove();

  function isMerchantOwner(id){
    const p=profile();
    return !!p && String(p.role||'').toLowerCase()==='store' && !!p.store_id && String(p.store_id)===String(id);
  }

  function openStoreEditor(id,ownerMode){
    const st=storeById(id); if(!st)return alert('المتجر غير موجود.');
    if(ownerMode ? !isMerchantOwner(id) : !admin()) return alert(ownerMode?'يمكن للتاجر تعديل متجره المرتبط فقط.':'المدير فقط يستطيع استخدام هذه الميزة.');
    const companyName=st.company_name||st.company||'';
    overlay(`<h2>تعديل المتجر</h2>
      <div class="two">
        <input id="sa_name" value="${esc(st.name)}" placeholder="اسم المتجر">
        <input id="sa_city" value="${esc(st.city)}" placeholder="المدينة">
        <input id="sa_area" value="${esc(st.area)}" placeholder="المنطقة">
        <input id="sa_address" value="${esc(st.address)}" placeholder="العنوان">
        <input id="sa_phone" value="${esc(st.phone)}" placeholder="الهاتف">
        <input id="sa_whatsapp" value="${esc(st.whatsapp_url||st.whatsapp)}" placeholder="واتساب">
        <input id="sa_hours" value="${esc(st.opening_hours)}" placeholder="ساعات الدوام">
        <input id="sa_days" value="${esc(st.working_days)}" placeholder="أيام العمل">
        <select id="sa_company"><option value="">بدون شركة</option></select>
        <input id="sa_image" type="file" accept="image/*">${st.image_url||st.logo_url ? '<label class="rememberRow"><input id="sa_remove_image" type="checkbox"> حذف صورة المتجر</label>' : ''}
      </div>
      <label class="rememberRow"><input id="sa_whatsapp_orders_enabled" type="checkbox" ${st.whatsapp_orders_enabled?'checked':''}> تفعيل إرسال سلة الطلب عبر واتساب لهذا المتجر</label>
      ${ownerMode ? '<div class="notice">التعديلات على متجرك تُنشر مباشرة ولا تحتاج موافقة المدير.</div>' : `<label class="muted"><input id="sa_verified" type="checkbox" ${st.verified?'checked':''}> المتجر موثّق</label><label class="muted"><input id="sa_active" type="checkbox" ${st.active!==false?'checked':''}> المتجر نشط</label>`}
      <p id="sa_msg" class="muted"></p>
      <div class="actions"><button type="button" class="btn primary" id="sa_save">حفظ التعديلات</button><button type="button" class="btn secondary" onclick="closeAdminEditor()">إغلاق</button></div>`);
    loadCompanyOptions(st.company_id||'',companyName);
    $('sa_save').onclick=()=>saveStore(id,ownerMode);
  }

  window.openAdminStoreEdit=function(id){openStoreEditor(id,false)};
  window.openMerchantStoreEdit=function(id){openStoreEditor(id,true)};


  async function loadCompanyOptions(selectedId,selectedName){
    const sel=$('sa_company'); if(!sel)return;
    try{
      const {data,error}=await supabaseClient.from('companies').select('id,name').eq('active',true).order('name');
      if(error)throw error;
      (data||[]).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;if(String(c.id)===String(selectedId)||(!selectedId&&c.name===selectedName))o.selected=true;sel.appendChild(o)});
    }catch(e){console.warn('companies:',e)}
  }

  async function saveStore(id,ownerMode=false){
    const st=storeById(id); if(!st)return;
    if(ownerMode){if(!isMerchantOwner(id))return alert('يمكن للتاجر تعديل متجره المرتبط فقط.');}
    else if(!onlyAdmin())return;
    const name=$('sa_name')?.value.trim(); if(!name)return alert('اسم المتجر مطلوب.');
    let image_url=st.image_url||st.logo_url||null;
    const removeImage=!!$('sa_remove_image')?.checked;
    const file=$('sa_image')?.files?.[0];
    if(removeImage){await window.sareeDeleteImage?.(image_url);image_url=null;}
    else if(file){try{image_url=await window.uploadImage(file,'stores')}catch(e){return alert('فشل رفع الصورة: '+e.message)}}
    const companyId=$('sa_company')?.value||null;
    const payload={name,city:$('sa_city').value.trim()||null,area:$('sa_area').value.trim()||null,address:$('sa_address').value.trim()||null,phone:$('sa_phone').value.trim()||null,whatsapp_url:$('sa_whatsapp').value.trim()||null,opening_hours:$('sa_hours').value.trim()||null,working_days:$('sa_days').value.trim()||null,image_url,whatsapp_orders_enabled:!!$('sa_whatsapp_orders_enabled')?.checked};
    if(ownerMode){
      payload.verified=true;
      payload.active=true;
      payload.company_id=companyId;
    }else{
      payload.verified=!!$('sa_verified')?.checked;
      payload.active=!!$('sa_active')?.checked;
      payload.company_id=companyId;
    }
    $('sa_msg').textContent='جاري الحفظ...';
    const {error}=await supabaseClient.from('stores').update(payload).eq('id',id).select('id').maybeSingle();
    if(error){$('sa_msg').textContent=error.message;return}
    closeAdminEditor(); alert(ownerMode?'تم تعديل المتجر ونشر التعديلات مباشرة ✅':'تم تعديل المتجر بنجاح.'); await refreshEverything();
  }

  window.toggleAdminStoreVerification=async function(id){
    if(!onlyAdmin())return; const st=storeById(id);if(!st)return;
    const next=!Boolean(st.verified);if(!confirm(next?'توثيق المتجر؟':'إلغاء توثيق المتجر؟'))return;
    const {error}=await supabaseClient.from('stores').update({verified:next}).eq('id',id);
    if(error)return alert(error.message); alert(next?'تم توثيق المتجر.':'تم إلغاء توثيق المتجر.'); await refreshEverything();
  };

  window.deleteAdminStore=async function(id){
    if(!onlyAdmin())return; const st=storeById(id);if(!st)return;
    if(!confirm(`حذف المتجر «${st.name||''}»؟\nسيتم حذف الأسعار المرتبطة وفك ربط التجار.`))return;
    const {error}=await supabaseClient.rpc('admin_delete_store',{p_store_id:id});
    if(error)return alert('تعذر حذف المتجر:\n'+error.message);
    alert('تم حذف المتجر بنجاح.'); await refreshEverything();
  };

  async function refreshEverything(){
    if(typeof window.refreshAll==='function')await window.refreshAll();
    if(typeof window.renderAdmin==='function')await window.renderAdmin();
  }

  window.openAdminCompanyCreate=async function(){
    if(!onlyAdmin())return;
    overlay(`<h2>إضافة شركة</h2><div class="two"><input id="ca_name" placeholder="اسم الشركة"><input id="ca_phone" placeholder="الهاتف"><input id="ca_address" placeholder="العنوان"><input id="ca_whatsapp" placeholder="رابط/رقم واتساب"><input id="ca_established_year" inputmode="numeric" maxlength="4" placeholder="سنة التأسيس"><input id="ca_latitude" type="number" step="any" placeholder="خط العرض Latitude"><input id="ca_longitude" type="number" step="any" placeholder="خط الطول Longitude"><input id="ca_image" type="file" accept="image/*"></div><label class="rememberRow"><input id="ca_whatsapp_orders_enabled" type="checkbox"> تفعيل إرسال سلة الطلب عبر واتساب للشركة</label><label class="muted"><input id="ca_verified" type="checkbox"> الشركة موثّقة</label><p id="ca_msg" class="muted"></p><div class="actions"><button type="button" class="btn primary" onclick="saveAdminCompanyCreate()">حفظ الشركة</button><button type="button" class="btn secondary" onclick="closeAdminEditor()">إغلاق</button></div>`);
  };

  window.saveAdminCompanyCreate=async function(){
    if(!onlyAdmin())return; const name=$('ca_name')?.value.trim();if(!name)return alert('اسم الشركة مطلوب.');
    let image_url=null;const file=$('ca_image')?.files?.[0];if(file){try{image_url=await window.uploadImage(file,'companies')}catch(e){return alert('فشل رفع الصورة: '+e.message)}}
    const {data:createdId,error}=await supabaseClient.rpc('admin_add_company',{p_name:name,p_phone:$('ca_phone').value.trim()||null,p_address:$('ca_address').value.trim()||null,p_whatsapp_url:$('ca_whatsapp').value.trim()||null,p_image_url:image_url,p_verified:!!$('ca_verified').checked});
    if(error)return alert(error.message);
    const createdCompanyId=Array.isArray(createdId)?(createdId[0]?.id||createdId[0]):(createdId?.id||createdId);
    if(createdCompanyId){
      const yr=String($('ca_established_year')?.value||'').trim();
      const patch={established_year:/^\d{4}$/.test(yr)?Number(yr):null,latitude:$('ca_latitude')?.value===''?null:Number($('ca_latitude').value),longitude:$('ca_longitude')?.value===''?null:Number($('ca_longitude').value),whatsapp_orders_enabled:!!$('ca_whatsapp_orders_enabled')?.checked};
      const r=await supabaseClient.from('companies').update(patch).eq('id',createdCompanyId);
      if(r.error)return alert('تم إنشاء الشركة، لكن تعذر حفظ بيانات الموقع/التأسيس/واتساب: '+r.error.message);
    }
    closeAdminEditor();alert('تمت إضافة الشركة بنجاح.');await refreshEverything();
  };

  async function getCompany(id){const {data,error}=await supabaseClient.from('companies').select('*').eq('id',id).maybeSingle();if(error)throw error;return data}
  window.openAdminCompanyEdit=async function(id){
    if(!onlyAdmin())return;let c;try{c=await getCompany(id)}catch(e){return alert(e.message)}if(!c)return alert('الشركة غير موجودة.');
    overlay(`<h2>تعديل الشركة</h2><div class="two"><input id="ce_name" value="${esc(c.name)}" placeholder="اسم الشركة"><input id="ce_phone" value="${esc(c.phone)}" placeholder="الهاتف"><input id="ce_address" value="${esc(c.address)}" placeholder="العنوان"><input id="ce_whatsapp" value="${esc(c.whatsapp_url)}" placeholder="رابط/رقم واتساب"><input id="ce_established_year" inputmode="numeric" maxlength="4" value="${esc(c.established_year||'')}" placeholder="سنة التأسيس"><input id="ce_latitude" type="number" step="any" value="${esc(c.latitude??'')}" placeholder="خط العرض Latitude"><input id="ce_longitude" type="number" step="any" value="${esc(c.longitude??'')}" placeholder="خط الطول Longitude"><input id="ce_image" type="file" accept="image/*">${c.image_url ? '<label class="rememberRow"><input id="ce_remove_image" type="checkbox"> حذف صورة الشركة</label>' : ''}</div><label class="rememberRow"><input id="ce_whatsapp_orders_enabled" type="checkbox" ${c.whatsapp_orders_enabled?'checked':''}> تفعيل إرسال سلة الطلب عبر واتساب للشركة</label><label class="muted"><input id="ce_verified" type="checkbox" ${c.verified?'checked':''}> الشركة موثّقة</label><label class="muted"><input id="ce_active" type="checkbox" ${c.active!==false?'checked':''}> الشركة نشطة</label><p id="ce_msg" class="muted"></p><div class="actions"><button type="button" class="btn primary" onclick="saveAdminCompanyEdit('${esc(id)}')">حفظ التعديلات</button><button type="button" class="btn secondary" onclick="closeAdminEditor()">إغلاق</button></div>`);
  };

  window.saveAdminCompanyEdit=async function(id){
    if(!onlyAdmin())return;let image_url=null;const current=await getCompany(id).catch(()=>null);if(!current)return;
    image_url=current.image_url||null;const removeImage=!!$('ce_remove_image')?.checked;const file=$('ce_image')?.files?.[0];if(removeImage){await window.sareeDeleteImage?.(image_url);image_url=null;}else if(file){try{image_url=await window.uploadImage(file,'companies')}catch(e){return alert(e.message)}}
    const {error}=await supabaseClient.rpc('admin_update_company',{p_id:id,p_name:$('ce_name').value.trim(),p_phone:$('ce_phone').value.trim()||null,p_address:$('ce_address').value.trim()||null,p_whatsapp_url:$('ce_whatsapp').value.trim()||null,p_image_url:image_url,p_verified:!!$('ce_verified').checked,p_active:!!$('ce_active').checked});
    if(error)return alert(error.message);
    const yr=String($('ce_established_year')?.value||'').trim();
    const patch={established_year:/^\d{4}$/.test(yr)?Number(yr):null,latitude:$('ce_latitude')?.value===''?null:Number($('ce_latitude').value),longitude:$('ce_longitude')?.value===''?null:Number($('ce_longitude').value),whatsapp_orders_enabled:!!$('ce_whatsapp_orders_enabled')?.checked};
    const r=await supabaseClient.from('companies').update(patch).eq('id',id);
    if(r.error)return alert('تم تعديل الشركة، لكن تعذر حفظ بيانات الموقع/التأسيس/واتساب: '+r.error.message);
    closeAdminEditor();alert('تم تعديل الشركة بنجاح.');await refreshEverything();
  };

  window.toggleAdminCompanyVerification=async function(id){
    if(!onlyAdmin())return;const c=await getCompany(id).catch(e=>null);if(!c)return alert('الشركة غير موجودة.');
    const {error}=await supabaseClient.from('companies').update({verified:!c.verified}).eq('id',id);if(error)return alert(error.message);await refreshEverything();
  };

  window.deleteAdminCompany=async function(id){
    if(!onlyAdmin())return;const c=await getCompany(id).catch(()=>null);if(!c)return alert('الشركة غير موجودة.');
    if(!confirm(`حذف الشركة «${c.name}»؟\nسيتم فك ربط المتاجر بها.`))return;
    const {error}=await supabaseClient.rpc('admin_delete_company',{p_id:id});if(error)return alert(error.message);alert('تم حذف الشركة بنجاح.');await refreshEverything();
  };

  window.toggleAdminMerchantVerification=async function(id){
    if(!onlyAdmin())return;const {data,error}=await supabaseClient.from('profiles').select('verified').eq('id',id).maybeSingle();if(error)return alert(error.message);if(!data)return alert('الحساب غير موجود.');
    const r=await supabaseClient.from('profiles').update({verified:!data.verified}).eq('id',id);if(r.error)return alert(r.error.message);alert(data.verified?'تم إلغاء توثيق التاجر.':'تم توثيق التاجر.');await refreshEverything();
  };

  window.deleteAdminMerchant=async function(id){
    if(!onlyAdmin())return;if(String(id)===String((typeof ADMIN_UID!=='undefined'?ADMIN_UID:window.ADMIN_UID)||''))return alert('لا يمكن حذف المدير.');
    if(!confirm('حذف سجل التاجر من profiles؟'))return;const {error}=await supabaseClient.from('profiles').delete().eq('id',id);if(error)return alert(error.message);alert('تم حذف سجل التاجر.');await refreshEverything();
  };
})();
