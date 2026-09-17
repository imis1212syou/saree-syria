/* سعرلي سوريا — توثيق حساب التاجر
   لا يستبدل renderAdmin ولا saveUser؛ يضيف طبقة توثيق مستقلة.
*/
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const isAdmin=()=>String(window.profileData?.role||'').toLowerCase()==='admin';

  async function getTraderVerification(id){
    const {data,error}=await window.supabaseClient.from('profiles').select('verified').eq('id',id).maybeSingle();
    if(error) throw error;
    return !!data?.verified;
  }

  window.verifyTraderAccount=async function(id,verified){
    if(!isAdmin()) return alert('المدير فقط يستطيع توثيق حساب التاجر.');
    const {error}=await window.supabaseClient.from('profiles').update({verified:!!verified}).eq('id',id);
    if(error){
      alert('تعذر حفظ التوثيق: '+error.message);
      return;
    }
    alert(verified?'تم توثيق حساب التاجر ✅':'تم إلغاء توثيق حساب التاجر.');
    if(typeof window.renderAdmin==='function') await window.renderAdmin();
  };

  /* بعد رسم لوحة الإدارة، نضيف حالة التوثيق للتجار دون تغيير بقية اللوحة. */
  const decorate=async function(){
    if(!isAdmin()) return;
    const rows=document.querySelectorAll('.merchantAdminItem');
    for(const row of rows){
      const idMatch=row.innerHTML.match(/saveMerchantPermission\\('([^']+)'\\)/);
      const id=idMatch?.[1];
      if(!id || row.querySelector('[data-trader-verified]')) continue;
      try{
        const verified=await getTraderVerification(id);
        const target=row.querySelector('.accordionHead > div');
        if(!target) continue;
        const box=document.createElement('div');
        box.setAttribute('data-trader-verified','1');
        box.className='muted';
        box.style.marginTop='6px';
        box.innerHTML=verified
          ? '✓ <b>حساب التاجر موثّق</b> <button type="button" class="btn secondary" style="padding:6px 9px" data-unverify="'+esc(id)+'">إلغاء التوثيق</button>'
          : 'حساب التاجر غير موثّق <button type="button" class="btn secondary" style="padding:6px 9px" data-verify="'+esc(id)+'">توثيق الحساب</button>';
        target.appendChild(box);
        box.querySelector('[data-verify]')?.addEventListener('click',()=>window.verifyTraderAccount(id,true));
        box.querySelector('[data-unverify]')?.addEventListener('click',()=>window.verifyTraderAccount(id,false));
      }catch(err){ console.warn('trader verification:',err); }
    }
  };

  const originalRenderAdmin=window.renderAdmin;
  if(typeof originalRenderAdmin==='function'){
    window.renderAdmin=async function(){
      const result=await originalRenderAdmin.apply(this,arguments);
      setTimeout(decorate,0);
      return result;
    };
  }
  window.SareeSyria=window.SareeSyria||{};
  window.SareeSyria.modules=window.SareeSyria.modules||{};
  window.SareeSyria.modules.traders=true;
})();
