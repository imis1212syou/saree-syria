/* سعرلي سوريا - إعدادات الميزات والإدارة */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const admin=()=>{try{return String(profileData?.role||'').toLowerCase()==='admin'}catch(_){return false}};
  let settings={enabled:false,fee:50};
  async function getSettings(){try{const {data,error}=await supabaseClient.from('saree_feature_settings').select('key,value');if(error)throw error;(data||[]).forEach(x=>{if(x.key==='whatsapp_orders_enabled')settings.enabled=String(x.value).toLowerCase()==='true';if(x.key==='whatsapp_order_fee')settings.fee=Number(x.value||0)});}catch(e){console.warn(e)}}
  async function saveSetting(key,value){const {error}=await supabaseClient.from('saree_feature_settings').upsert({key,value:String(value),updated_at:new Date().toISOString()},{onConflict:'key'});if(error)throw error}
  async function injectAdmin(){
    if(!admin())return;const panel=$('adminPanel');if(!panel)return;
    if(!$('sareeFinalAdminBox')){const box=document.createElement('div');box.id='sareeFinalAdminBox';box.className='card';box.innerHTML=`<h2>⚙️ ميزات سعرلي سوريا</h2><p class="muted">إيقاف الميزة يخفيها من واجهة المستخدم ولا يحذف البيانات.</p><label class="rememberRow"><input id="sareeWaEnabled" type="checkbox"> تفعيل «إرسال الطلب عبر واتساب»</label><label>رسم الطلب بالليرة السورية<input id="sareeWaFee" type="number" min="0" step="1"></label><div class="actions"><button class="btn primary" id="sareeSaveSettings">حفظ إعدادات طلبات واتساب</button></div><hr style="border-color:#263137;margin:18px 0"><h3>صلاحيات الشركات</h3><p class="muted">لا تُمنح صلاحيات صور المنتجات أو أسئلة المنتجات للشركة إلا من هنا.</p><div id="sareeCompanyPerms"></div>`;panel.prepend(box)}
    $('sareeWaEnabled').checked=settings.enabled;$('sareeWaFee').value=settings.fee;
    $('sareeSaveSettings').onclick=async()=>{try{const fee=Math.max(0,Number($('sareeWaFee').value||0));await saveSetting('whatsapp_orders_enabled',$('sareeWaEnabled').checked?'true':'false');await saveSetting('whatsapp_order_fee',fee);settings.enabled=$('sareeWaEnabled').checked;settings.fee=fee;window.sareeWhatsappOrdersEnabled=settings.enabled;window.sareeWhatsappOrderFee=fee;alert('تم حفظ إعدادات طلبات واتساب.');}catch(e){alert(e.message)}};
    try{const {data,error}=await supabaseClient.from('companies').select('id,name,allow_product_images,allow_product_questions').order('name');if(error)throw error;$('sareeCompanyPerms').innerHTML=(data||[]).map(c=>`<div class="priceRow"><b>${esc(c.name)}</b><label class="rememberRow"><input type="checkbox" data-ci="${esc(c.id)}" data-k="img" ${c.allow_product_images?'checked':''}> السماح للشركة بإضافة صور للمنتجات</label><label class="rememberRow"><input type="checkbox" data-ci="${esc(c.id)}" data-k="q" ${c.allow_product_questions?'checked':''}> السماح للشركة بميزة أسئلة/ملاحظات المنتجات</label></div>`).join('')||'<div class="muted">لا توجد شركات.</div>';$('sareeCompanyPerms').querySelectorAll('input[data-ci]').forEach(ch=>ch.onchange=async()=>{const id=ch.dataset.ci;const row={};if(ch.dataset.k==='img')row.allow_product_images=ch.checked;else row.allow_product_questions=ch.checked;const {error}=await supabaseClient.from('companies').update(row).eq('id',id);if(error){ch.checked=!ch.checked;alert(error.message)}})}catch(e){console.warn(e)}
  }
  const oldRenderAdmin=window.renderAdmin;
  if(typeof oldRenderAdmin==='function'){window.renderAdmin=async function(){await oldRenderAdmin();await getSettings();await injectAdmin()}}
  else{setTimeout(async()=>{await getSettings();await injectAdmin()},1500)}
  window.sareeReloadFeatureSettings=getSettings;
})();
