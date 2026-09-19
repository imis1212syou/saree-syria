(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const attr=x=>esc(x).replace(/`/g,'&#096;');
  let adsCache=[];

  function placementFor(page){
    if(page==='home') return ['home_top','all'];
    if(page==='stores') return ['stores_top','all'];
    if(page==='storeDetail') return ['store_detail','all'];
    return ['all'];
  }

  function adCard(ad){
    const image=ad.image_url?`<img class="adImage" src="${attr(ad.image_url)}" alt="${attr(ad.title||'إعلان')}">`:'';
    const body=ad.body?`<div class="muted adBody">${esc(ad.body)}</div>`:'';
    const button=ad.target_url?`<a class="btn primary adButton" href="${attr(ad.target_url)}" target="_blank" rel="noopener noreferrer">${esc(ad.button_text||'عرض الإعلان')}</a>`:'';
    return `<article class="adCard"><div class="adLabel">إعلان</div>${image}<div class="adContent">${ad.title?`<div class="name">${esc(ad.title)}</div>`:''}${body}${button}</div></article>`;
  }

  async function loadAds(){
    try{
      const now=new Date().toISOString();
      const {data,error}=await supabaseClient.from('ads').select('*').eq('active',true).lte('start_at',now).order('created_at',{ascending:false}).limit(50);
      if(error){console.warn('ads:',error.message);adsCache=[];return []}
      const filtered=(data||[]).filter(a=>!a.end_at||new Date(a.end_at).getTime()>=Date.now());
      adsCache=filtered;return adsCache;
    }catch(err){console.warn('ads:',err);adsCache=[];return []}
  }

  async function renderAds(page){
    const boxId=page==='home'?'adsHome':page==='stores'?'adsStores':page==='storeDetail'?'adsStoreDetail':null;
    const box=boxId&&$(boxId); if(!box)return;
    const ads=adsCache.length?adsCache:await loadAds();
    const allowed=placementFor(page);
    const list=ads.filter(a=>allowed.includes(a.placement||'all'));
    box.innerHTML=list.length?list.map(adCard).join(''):'';
    box.classList.toggle('hidden',!list.length);
  }

  window.loadAds=loadAds;
  window.renderAds=renderAds;
  window.refreshAds=async function(){adsCache=[];await loadAds();await Promise.all(['home','stores','storeDetail'].map(renderAds));};

  function adsOverlay(html){
    const old=$('sareeAdminOverlay');
    if(old) old.remove();
    const el=document.createElement('div');
    el.id='sareeAdminOverlay';
    el.style='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.82);padding:18px;overflow:auto;display:flex;align-items:flex-start;justify-content:center';
    el.innerHTML=`<div style="width:min(760px,100%);margin:30px auto;background:#10191e;border:1px solid #33434b;border-radius:18px;padding:18px;box-shadow:0 20px 70px rgba(0,0,0,.5)">${html}</div>`;
    document.body.appendChild(el);
    el.addEventListener('click',ev=>{if(ev.target===el)el.remove()});
    return el;
  }

  function closeAdsOverlay(){
    $('sareeAdminOverlay')?.remove();
  }

  window.openAdminAds=async function(){
    if(typeof profileData==='undefined'||profileData?.role!=='admin')return alert('هذا الخيار للمدير فقط.');
    const {data,error}=await supabaseClient.from('ads').select('*').order('created_at',{ascending:false});
    if(error)return alert('تعذر تحميل الإعلانات: '+error.message);
    const list=data||[];
    const rows=list.length?list.map(a=>`<div class="priceRow"><div class="row" style="justify-content:space-between;align-items:center"><div><b>${esc(a.title||'إعلان بدون عنوان')}</b> ${a.active?'<span class="pill">نشط</span>':'<span class="pill">متوقف</span>'}</div><span class="muted">${esc(({all:'كل الصفحات',home_top:'الرئيسية',stores_top:'المتاجر',store_detail:'صفحة المتجر'})[a.placement||'all']||a.placement)}</span></div><div class="muted">${esc(a.body||'')}<br><span class="muted">النوع: ${esc(({banner:'بانر',store:'متجر',product:'مادة / منتج',company:'شركة / علامة',custom:'مخصص'})[a.ad_type||'banner']||a.ad_type)}</span>${a.target_url?`<br>${esc(a.target_url)}`:''}</div><div class="actions"><button type="button" class="btn primary" onclick="openAdminAdEdit('${attr(a.id)}')">تعديل</button><button type="button" class="btn secondary" onclick="toggleAdminAd('${attr(a.id)}',${a.active?'true':'false'})">${a.active?'إيقاف':'تفعيل'}</button><button type="button" class="btn danger" onclick="deleteAdminAd('${attr(a.id)}')">حذف</button></div></div>`).join(''):'<div class="card muted">لا توجد إعلانات.</div>';
    const html=`<h2>إدارة الإعلانات</h2><p class="muted">إعلانات الموقع تُدار من هنا. يمكنك إضافة إعلان صورة أو نص مع رابط وتحديد مكان ظهوره ومدة تشغيله.</p><div class="actions"><button type="button" class="btn primary" onclick="openAdminAdCreate()">إضافة إعلان</button></div><div style="margin-top:12px">${rows}</div>`;
    adsOverlay(html);
  };

  function adForm(a){
    a=a||{};
    const st=a.start_at?new Date(a.start_at).toISOString().slice(0,16):'';
    const en=a.end_at?new Date(a.end_at).toISOString().slice(0,16):'';
    return `<h2>${a.id?'تعديل الإعلان':'إضافة إعلان'}</h2><div class="two"><input id="ad_title" value="${attr(a.title||'')}" placeholder="عنوان الإعلان"><input id="ad_button" value="${attr(a.button_text||'عرض الإعلان')}" placeholder="نص الزر"><input id="ad_url" value="${attr(a.target_url||'')}" placeholder="رابط الإعلان https://..."><select id="ad_type"><option value="banner" ${a.ad_type==='banner'||!a.ad_type?'selected':''}>بانر</option><option value="store" ${a.ad_type==='store'?'selected':''}>إعلان متجر</option><option value="product" ${a.ad_type==='product'?'selected':''}>إعلان مادة / منتج</option><option value="company" ${a.ad_type==='company'?'selected':''}>إعلان شركة / علامة</option><option value="custom" ${a.ad_type==='custom'?'selected':''}>إعلان مخصص</option></select><input id="ad_image" type="file" accept="image/*"><select id="ad_placement"><option value="all" ${a.placement==='all'||!a.placement?'selected':''}>كل الصفحات</option><option value="home_top" ${a.placement==='home_top'?'selected':''}>الرئيسية</option><option value="stores_top" ${a.placement==='stores_top'?'selected':''}>المتاجر</option><option value="store_detail" ${a.placement==='store_detail'?'selected':''}>صفحة المتجر</option></select><input id="ad_start" type="datetime-local" value="${attr(st)}" placeholder="بداية الإعلان"><input id="ad_end" type="datetime-local" value="${attr(en)}" placeholder="نهاية الإعلان"></div><textarea id="ad_body" style="width:100%;min-height:90px;margin-top:9px;padding:12px;border-radius:10px;border:1px solid #303b40;background:#0d1418;color:#fff" placeholder="وصف الإعلان">${esc(a.body||'')}</textarea><label class="muted"><input id="ad_active" type="checkbox" ${a.active!==false?'checked':''}> الإعلان نشط</label><p id="ad_msg" class="muted"></p><div class="actions"><button type="button" class="btn primary" onclick="saveAdminAd(${a.id?`'${attr(a.id)}'`:'null'})">حفظ الإعلان</button><button type="button" class="btn secondary" onclick="openAdminAds()">إلغاء</button></div>`;
  }

  window.openAdminAdCreate=function(){if(typeof profileData==='undefined'||profileData?.role!=='admin')return alert('هذا الخيار للمدير فقط.');adsOverlay(adForm(null));};
  window.openAdminAdEdit=async function(id){
    if(typeof profileData==='undefined'||profileData?.role!=='admin')return alert('هذا الخيار للمدير فقط.');
    const {data,error}=await supabaseClient.from('ads').select('*').eq('id',id).maybeSingle();
    if(error)return alert(error.message);if(!data)return alert('الإعلان غير موجود.');adsOverlay(adForm(data));
  };
  window.saveAdminAd=async function(id){
    if(typeof profileData==='undefined'||profileData?.role!=='admin')return alert('هذا الخيار للمدير فقط.');
    const title=$('ad_title')?.value.trim()||null, body=$('ad_body')?.value.trim()||null, target_url=$('ad_url')?.value.trim()||null, button_text=$('ad_button')?.value.trim()||'عرض الإعلان', placement=$('ad_placement')?.value||'all', ad_type=$('ad_type')?.value||'banner';
    if(!title && !body && !$('ad_image')?.files?.[0])return alert('أضف عنواناً أو نصاً أو صورة للإعلان.');
    if(target_url && !/^https?:\/\//i.test(target_url))return alert('رابط الإعلان يجب أن يبدأ بـ http:// أو https://');
    let image_url=null;
    if(id){const cur=await supabaseClient.from('ads').select('image_url').eq('id',id).maybeSingle();if(cur.error)return alert(cur.error.message);image_url=cur.data?.image_url||null;}
    const file=$('ad_image')?.files?.[0];
    if(file){try{image_url=await window.uploadImage(file,'ads')}catch(e){return alert('فشل رفع صورة الإعلان: '+e.message)}}
    const start=$('ad_start')?.value?new Date($('ad_start').value).toISOString():new Date().toISOString();
    const end=$('ad_end')?.value?new Date($('ad_end').value).toISOString():null;
    const payload={title,body,target_url,button_text,placement,ad_type,image_url,start_at:start,end_at:end,active:!!$('ad_active')?.checked,updated_at:new Date().toISOString()};
    const q=id?supabaseClient.from('ads').update(payload).eq('id',id):supabaseClient.from('ads').insert({...payload,created_by:profileData.id});
    const {error}=await q;if(error)return alert(error.message);alert(id?'تم تعديل الإعلان.':'تمت إضافة الإعلان.');closeAdsOverlay();await window.refreshAds();await window.renderAdmin();
  };
  window.toggleAdminAd=async function(id,current){if(typeof profileData==='undefined'||profileData?.role!=='admin')return alert('هذا الخيار للمدير فقط.');const {error}=await supabaseClient.from('ads').update({active:!current,updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await window.refreshAds();await window.renderAdmin();};
  window.deleteAdminAd=async function(id){if(typeof profileData==='undefined'||profileData?.role!=='admin')return alert('هذا الخيار للمدير فقط.');if(!confirm('حذف هذا الإعلان؟'))return;const {error}=await supabaseClient.from('ads').delete().eq('id',id);if(error)return alert(error.message);await window.refreshAds();await window.renderAdmin();};

  document.addEventListener('DOMContentLoaded',async function(){
    await loadAds();
    await Promise.all(['home','stores','storeDetail'].map(renderAds));
  });
})();
