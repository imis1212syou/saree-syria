/* سعرلي سوريا — الإحصائيات الشهرية المطلوبة فقط */
(function(){
  'use strict';

  const SITE_ID='00000000-0000-0000-0000-000000000000';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmt=n=>Number(n||0).toLocaleString('ar-SY');
  const monthLabel=v=>{try{return new Date(v+'T00:00:00').toLocaleDateString('ar-SY',{month:'long',year:'numeric'})}catch(_){return v}};
  async function record(entityType,entityId,event){
    if(!window.supabaseClient) return false;
    try{
      const {error}=await supabaseClient.rpc('saree_record_stat_event',{p_entity_type:entityType,p_entity_id:entityType==='site'?SITE_ID:entityId,p_event:event,p_visitor_id:null});
      if(error) throw error;
      return true;
    }catch(err){
      console.warn('monthly stats event:',err);
      return false;
    }
  }

  function once(key){
    try{if(sessionStorage.getItem(key)==='1')return false;sessionStorage.setItem(key,'1');return true}catch(_){return true}
  }
  function throttled(key,ms){
    try{
      const now=Date.now(),last=Number(sessionStorage.getItem(key)||0);
      if(now-last<ms)return false;
      sessionStorage.setItem(key,String(now));return true;
    }catch(_){return true}
  }

  async function statsFor(entityType,entityId){
    const {data,error}=await supabaseClient.rpc('saree_monthly_stats_for',{p_entity_type:entityType,p_entity_id:entityType==='site'?SITE_ID:entityId,p_limit:24});
    if(error) throw error;
    return Array.isArray(data)?data:[];
  }

  function metricGrid(row){
    return `<div class="grid"><div class="stat"><b>${fmt(row?.orders)}</b><div class="muted">الطلبات</div></div><div class="stat"><b>${fmt(row?.views)}</b><div class="muted">المشاهدات</div></div><div class="stat"><b>${fmt(row?.whatsapp_people)}</b><div class="muted">تواصلات واتساب</div></div><div class="stat"><b>${fmt(row?.visits)}</b><div class="muted">إجمالي الزيارات</div></div><div class="stat"><b>${fmt(row?.qr_visits)}</b><div class="muted">زيارات QR</div></div></div>`;
  }

  function growth(cur,prev,key){
    if(!prev)return '<span class="muted">لا توجد بيانات للشهر السابق</span>';
    const a=Number(cur?.[key]||0),b=Number(prev?.[key]||0),d=a-b;
    if(b===0)return d===0?'<span class="muted">بدون تغير</span>':`<b>${d>0?'+':''}${fmt(d)}</b>`;
    const pct=(d/b)*100;
    return `<b>${d>0?'+':''}${fmt(d)}</b> <span class="muted">(${pct>0?'+':''}${pct.toFixed(1)}%)</span>`;
  }

  function renderHistory(rows){
    if(rows.length<=1) return rows.length?'<div class="muted" style="margin-top:10px">لا توجد أشهر سابقة بعد.</div>':'<div class="muted">لا توجد بيانات شهرية بعد.</div>';
    return `<div style="margin-top:12px">${rows.slice(1).map((row,i)=>{const older=rows[i+2]||null;return `<div class="priceRow"><div class="accordionHead" data-saree-stat-toggle="saree_stat_month_${i}"><div><b>${esc(monthLabel(row.month_start))}</b><div class="muted">الطلبات ${fmt(row.orders)} • المشاهدات ${fmt(row.views)} • واتساب ${fmt(row.whatsapp_people)}</div></div><span>▾</span></div><div id="saree_stat_month_${i}" class="accordionBody hidden">${metricGrid(row)}<div class="muted">مقارنة بالشهر السابق — الطلبات: ${growth(row,older,'orders')} • المشاهدات: ${growth(row,older,'views')} • واتساب: ${growth(row,older,'whatsapp_people')} • الزيارات: ${growth(row,older,'visits')} • QR: ${growth(row,older,'qr_visits')}</div></div></div>`}).join('')}</div>`;
  }

  async function loadPanel(panel,entityType,entityId){
    const body=panel?.querySelector('[data-saree-stats-body]');
    if(!body)return;
    body.innerHTML='<div class="muted">جاري تحميل الإحصائيات...</div>';
    try{
      const rows=await statsFor(entityType,entityId);
      const current=rows[0]||{orders:0,views:0,whatsapp_people:0,visits:0,qr_visits:0};
      const previous=rows[1]||null;
      body.innerHTML=`<div class="notice">الشهر الحالي: <b>${esc(monthLabel(current.month_start||new Date().toISOString().slice(0,10)))}</b></div>${metricGrid(current)}<div class="muted" style="margin-top:8px">مقارنة بالشهر السابق — الطلبات: ${growth(current,previous,'orders')} • المشاهدات: ${growth(current,previous,'views')} • واتساب: ${growth(current,previous,'whatsapp_people')} • الزيارات: ${growth(current,previous,'visits')} • QR: ${growth(current,previous,'qr_visits')}</div><h3 style="margin-top:16px">الأشهر السابقة</h3>${renderHistory(rows)}`;
      body.querySelectorAll('[data-saree-stat-toggle]').forEach(head=>head.onclick=()=>$(head.dataset.sareeStatToggle)?.classList.toggle('hidden'));
    }catch(err){
      console.warn('monthly stats:',err);
      body.innerHTML=`<div class="notice pending">تعذر تحميل الإحصائيات الشهرية. نفّذ ملف SUPABASE_REQUIRED_CHANGES.sql مرة واحدة على Supabase.</div>`;
    }
  }

  function makePanel(id,title,entityType,entityId){
    const box=document.createElement('div');box.id=id;box.className='card';
    box.innerHTML=`<div class="accordionHead" data-saree-stats-head="1"><div><h2>${esc(title)}</h2><div class="muted">الطلبات والمشاهدات وواتساب والزيارات وزيارات QR، مع حفظ كل شهر كسجل مستقل.</div></div><span>▾</span></div><div class="accordionBody hidden" data-saree-stats-body><div class="actions"><button type="button" class="btn secondary" data-saree-stats-close="1">× إغلاق</button></div></div>`;
    box.querySelector('[data-saree-stats-head]').onclick=()=>{
      const body=box.querySelector('[data-saree-stats-body]');
      const willOpen=body?.classList.contains('hidden');
      body?.classList.toggle('hidden');
      if(willOpen && !box.dataset.loaded){box.dataset.loaded='1';loadPanel(box,entityType,entityId)}
    };
    box.querySelector('[data-saree-stats-close]')?.addEventListener('click',ev=>{ev.stopPropagation();box.querySelector('[data-saree-stats-body]')?.classList.add('hidden')});
    return box;
  }

  function injectAdmin(){
    if(window.__SAREE_ADMIN_STATUS__!==true)return;
    const panel=$('adminPanel');if(!panel||$('sareeMonthlySiteStats'))return;
    panel.insertBefore(makePanel('sareeMonthlySiteStats','📊 إحصائيات الموقع','site',SITE_ID),panel.firstChild);
  }

  function injectMerchant(){
    if(String(window.profileData?.role||'').toLowerCase()!=='store'||!window.profileData?.store_id)return;
    const panel=$('merchantPanel');if(!panel||$('sareeMonthlyStoreStats'))return;
    panel.appendChild(makePanel('sareeMonthlyStoreStats','📊 إحصائيات المتجر','store',window.profileData.store_id));
  }

  function injectCompany(){
    const ctx=window.companyContext;
    if(!ctx?.company_id || ctx.can_view_stats!==true)return;
    const panel=$('companyPanel');if(!panel||$('sareeMonthlyCompanyStats'))return;
    panel.appendChild(makePanel('sareeMonthlyCompanyStats','📊 إحصائيات الشركة','company',ctx.company_id));
  }

  function installRenderWrappers(){
    if(typeof window.renderAdmin==='function'&&!window.renderAdmin.__sareeMonthlyWrapped){
      const original=window.renderAdmin;
      const wrapped=async function(){const r=await original.apply(this,arguments);injectAdmin();return r};
      wrapped.__sareeMonthlyWrapped=true;window.renderAdmin=wrapped;
    }
    if(typeof window.renderMerchant==='function'&&!window.renderMerchant.__sareeMonthlyWrapped){
      const original=window.renderMerchant;
      const wrapped=async function(){const r=await original.apply(this,arguments);injectMerchant();return r};
      wrapped.__sareeMonthlyWrapped=true;window.renderMerchant=wrapped;
    }

    const companyPanel=$('companyPanel');
    if(companyPanel&&!companyPanel.__sareeMonthlyObserved){
      const observer=new MutationObserver(()=>setTimeout(injectCompany,0));
      observer.observe(companyPanel,{childList:true,subtree:false});
      companyPanel.__sareeMonthlyObserved=true;
      setTimeout(injectCompany,0);
    }
  }

  function whatsappPhoneKey(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    try{
      const url=new URL(raw,location.href);
      const phone=url.searchParams.get('phone');
      if(phone)return phone.replace(/\D/g,'');
      const pathPhone=url.pathname.match(/(?:wa\.me\/)([0-9]+)/i);
      if(pathPhone)return pathPhone[1];
    }catch{}
    const m=raw.match(/(?:wa\.me\/|phone=)([0-9]+)/i);
    return m?m[1]:raw.replace(/\D/g,'');
  }

  function whatsappEntityFromTarget(target){
    const key=whatsappPhoneKey(target);
    if(!key)return null;
    try{
      if(typeof stores!=='undefined'&&Array.isArray(stores)){
        const st=stores.find(x=>whatsappPhoneKey(x?.whatsapp_url||x?.whatsapp)===key);
        if(st)return {type:'store',id:st.id};
      }
      if(typeof companies!=='undefined'&&Array.isArray(companies)){
        const c=companies.find(x=>whatsappPhoneKey(x?.whatsapp_url||x?.whatsapp)===key);
        if(c)return {type:'company',id:c.id};
      }
    }catch{}
    const params=new URLSearchParams(location.search);
    if(params.get('store'))return {type:'store',id:params.get('store')};
    if(params.get('company'))return {type:'company',id:params.get('company')};
    return null;
  }

  window.sareeTrackWhatsapp=function(entityType,entityId){
    if(!entityId)return false;
    return record(entityType,entityId,'whatsapp');
  };

  window.sareeTrackWhatsappTarget=function(target){
    const entity=whatsappEntityFromTarget(target);
    if(entity?.id)return window.sareeTrackWhatsapp(entity.type,entity.id);
    return false;
  };

  function installEventTracking(){
    if(document.body&&!document.body.__sareeMonthlyWhatsappTracked){
      document.body.__sareeMonthlyWhatsappTracked=true;
      document.addEventListener('click',ev=>{
        const el=ev.target?.closest?.('a');
        if(!el)return;
        const text=String(el.innerText||el.textContent||'');
        const href=String(el.getAttribute?.('href')||'');
        if(!/واتساب|whatsapp/i.test(text+' '+href))return;
        window.sareeTrackWhatsappTarget?.(href);
      },true);
    }

    if(typeof window.recordVisitor==='function'&&!window.recordVisitor.__sareeMonthlyWrapped){
      const original=window.recordVisitor;
      const wrapped=async function(){const r=await original.apply(this,arguments);if(once('saree_monthly_site_visit'))await record('site',SITE_ID,'visit');return r};
      wrapped.__sareeMonthlyWrapped=true;window.recordVisitor=wrapped;
    }

    if(typeof window.show==='function'&&!window.show.__sareeMonthlyWrapped){
      const original=window.show;
      const wrapped=function(id){const result=original.apply(this,arguments);if(id!=='storeDetail'&&id!=='companyDetail'&&throttled('saree_monthly_site_view_'+String(id),800))record('site',SITE_ID,'view');return result};
      wrapped.__sareeMonthlyWrapped=true;window.show=wrapped;
    }

    if(typeof window.renderStoreDetail==='function'&&!window.renderStoreDetail.__sareeMonthlyWrapped){
      const original=window.renderStoreDetail;
      const wrapped=async function(id){const result=await original.apply(this,arguments);const sid=id||new URLSearchParams(location.search).get('store');if(sid){if(throttled('saree_monthly_store_view_'+sid,1500))record('store',sid,'view');if(once('saree_monthly_store_visit_'+sid))record('store',sid,'visit')}return result};
      wrapped.__sareeMonthlyWrapped=true;window.renderStoreDetail=wrapped;
    }

    if(typeof window.openCompanyById==='function'&&!window.openCompanyById.__sareeMonthlyWrapped){
      const original=window.openCompanyById;
      const wrapped=async function(id){const result=await original.apply(this,arguments);const cid=String(id||'');if(cid){if(throttled('saree_monthly_company_view_'+cid,1500))record('company',cid,'view');if(once('saree_monthly_company_visit_'+cid))record('company',cid,'visit')}return result};
      wrapped.__sareeMonthlyWrapped=true;window.openCompanyById=wrapped;
    }

    if(typeof window.recordSareeQrVisit==='function'&&!window.recordSareeQrVisit.__sareeMonthlyWrapped){
      const original=window.recordSareeQrVisit;
      const wrapped=async function(entityType,entityId){const result=await original.apply(this,arguments);if(result)await record(entityType,entityId,'qr');return result};
      wrapped.__sareeMonthlyWrapped=true;window.recordSareeQrVisit=wrapped;
    }

    if(typeof window.sareeSendWhatsappOrder==='function'&&!window.sareeSendWhatsappOrder.__sareeMonthlyWrapped){
      const original=window.sareeSendWhatsappOrder;
      const wrapped=async function(storeId){const result=await original.apply(this,arguments);if(result===true)await record('store',storeId,'order');return result};
      wrapped.__sareeMonthlyWrapped=true;window.sareeSendWhatsappOrder=wrapped;
    }

    if(typeof window.companySendWhatsappOrder==='function'&&!window.companySendWhatsappOrder.__sareeMonthlyWrapped){
      const original=window.companySendWhatsappOrder;
      const wrapped=async function(companyId){
        const id=String(companyId||'');
        let hasItems=false;
        try{
          const all=JSON.parse(localStorage.getItem('saree_company_carts_v1')||'{}');
          const items=all&&Array.isArray(all[id])?all[id]:[];
          hasItems=items.length>0;
        }catch{}
        const result=await original.apply(this,arguments);
        if(hasItems)await record('company',id,'order');
        return result;
      };
      wrapped.__sareeMonthlyWrapped=true;window.companySendWhatsappOrder=wrapped;
    }
  }

  const boot=()=>{
    installRenderWrappers();installEventTracking();injectAdmin();injectMerchant();injectCompany();
  };
  boot();
  setTimeout(boot,250);
  setTimeout(boot,1000);
  setTimeout(boot,2500);
  setInterval(boot,5000);
})();
