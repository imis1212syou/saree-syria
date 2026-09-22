/* سعرلي سوريا - ميزات الشركات ولوحة تعريف الشركة */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  async function companyForStore(store){if(!store?.company_id)return null;try{const {data}=await supabaseClient.from('companies').select('*').eq('id',store.company_id).maybeSingle();return data}catch(_){return null}}
  window.sareeCompanyForStore=companyForStore;
  // نضيف بطاقة تعريف الشركة بشكل خفيف داخل صفحة المتجر دون إزعاج المستخدم.
  const old=window.renderStoreDetail;
  window.renderStoreDetail=async function(id){await old(id);const storeId=id||window.currentStoreId;const st=(stores||[]).find(s=>String(s.id)===String(storeId));if(!st||!st.company_id)return;const company=await companyForStore(st);if(!company||company.verified===false||company.active===false)return;const body=$('storeDetailBody');if(!body||$('sareeCompanyPromo'))return;const box=document.createElement('div');box.id='sareeCompanyPromo';box.className='card';box.innerHTML=`<div class="muted">الشركة المنتجة</div><div class="row" style="align-items:center">${company.image_url?`<img src="${esc(company.image_url)}" style="width:54px;height:54px;border-radius:12px;object-fit:cover">`:''}<div><div class="name" style="margin:0">${esc(company.name)}</div><div class="muted">تصفح معلومات الشركة ومنتجاتها.</div></div><button class="btn secondary" style="margin-inline-start:auto" onclick="window.openCompany('${esc(company.name)}')">تصفح الشركة</button></div>`;const first=body.firstElementChild;body.insertBefore(box,first?.nextSibling||null)};
})();
