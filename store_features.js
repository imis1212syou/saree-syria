/* سعرلي سوريا — إضافات المتاجر والمواد
   يوضع هذا الملف بجانب index.html.
   ملاحظة: يجب أن تستدعيه الصفحة مرة واحدة عبر:
   <script src="store_features.js"></script>
*/
(function(){
  'use strict';

  function esc(v){
    if(typeof window.e==='function') return window.e(v);
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }
  function el(id){ return document.getElementById(id); }

  function canAdd(){
    return !!(profileData && (
      profileData.role==='admin' ||
      (profileData.role==='store' && profileData.store_id && profileData.can_edit_prices)
    ));
  }

  async function refreshStoresSafe(){
    try{
      const {data,error}=await supabaseClient
        .from('stores')
        .select('*')
        .order('name');

      if(error){
        console.warn('stores:',error.message);
        return;
      }

      if(Array.isArray(data)){
        stores=data;
      }
    }catch(err){
      console.warn('stores refresh:',err);
    }
  }

  window.renderStores=async function(){
    const box=el('storesList');
    if(!box) return;

    await refreshStoresSafe();

    if(!stores.length){
      box.innerHTML='<div class="card"><p class="muted">لا توجد متاجر مضافة حالياً.</p></div>';
      return;
    }

    box.innerHTML=stores.map(st=>{
      const verified=st.verified
        ? '<span class="pill">✓ موثّق</span>'
        : '';

      const hours=st.opening_hours
        ? `<div class="muted">🕐 ${esc(st.opening_hours)}</div>`
        : '';

      const days=st.working_days
        ? `<div class="muted">📅 ${esc(st.working_days)}</div>`
        : '';

      const phone=st.phone
        ? `<div class="muted">📞 ${esc(st.phone)}</div>`
        : '';

      const address=st.address
        ? `<div class="muted">📍 ${esc(st.address)}</div>`
        : '';

      const area=[st.city,st.area].filter(Boolean).join(' — ');

      return `
        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center">
            <h3>${esc(st.name||'متجر')}</h3>
            ${verified}
          </div>

          ${area ? `<div class="muted">📍 ${esc(area)}</div>` : ''}
          ${address}
          ${phone}
          ${hours}
          ${days}

          <button class="btn primary" onclick="openStore('${st.id}')">
            فتح صفحة المتجر
          </button>

          ${profileData?.role==='admin' ? `
            <button class="btn secondary" onclick="toggleStoreVerification('${st.id}',${st.verified?'false':'true'})">
              ${st.verified?'إلغاء توثيق المتجر':'✓ توثيق المتجر'}
            </button>
          `:''}
        </div>
      `;
    }).join('');
  };

  window.renderStoreDetail=async function(id){
    const body=el('storeDetailBody');
    const title=el('storeDetailName');
    if(!body || !title) return;

    const storeId=id || window.currentStoreId;
    if(!storeId){
      body.innerHTML='<p class="muted">لم يتم تحديد المتجر.</p>';
      return;
    }

    await refreshStoresSafe();

    const st=stores.find(x=>String(x.id)===String(storeId));

    if(!st){
      title.textContent='المتجر';
      body.innerHTML='<div class="card"><p class="muted">المتجر غير موجود.</p></div>';
      return;
    }

    window.currentStoreId=st.id;
    title.textContent=st.name||'المتجر';

    try{
      if(typeof recordStoreVisit==='function'){
        await recordStoreVisit(st.id);
      }
    }catch(_){}

    const area=[st.city,st.area].filter(Boolean).join(' — ');

    let html=`
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center">
          <h2>${esc(st.name||'المتجر')}</h2>
          ${st.verified?'<span class="pill">✓ موثّق</span>':''}
        </div>

        ${area?`<p class="muted">📍 ${esc(area)}</p>`:''}
        ${st.address?`<p>📍 العنوان: ${esc(st.address)}</p>`:''}
        ${st.phone?`<p>📞 الهاتف: ${esc(st.phone)}</p>`:''}
        ${st.opening_hours?`<p>🕐 ساعات الدوام: ${esc(st.opening_hours)}</p>`:''}
        ${st.working_days?`<p>📅 أيام العمل: ${esc(st.working_days)}</p>`:''}
      </div>
    `;

    let ps=[];

    try{
      const {data,error}=await supabaseClient
        .from('price_listings')
        .select('*,products(*)')
        .eq('store_id',st.id)
        .eq('status','approved')
        .order('updated_at',{ascending:false});

      if(!error && Array.isArray(data)) ps=data;
    }catch(_){}

    html+=`
      <div class="card">
        <h3>أسعار المتجر</h3>
        ${
          ps.length
          ? `<div class="grid">${ps.map(p=>{
              const pr=p.products||{};
              return `
                <div class="card">
                  <h3>${esc(pr.name||'مادة')}</h3>
                  ${pr.brand?`<div class="muted">${esc(pr.brand)}</div>`:''}
                  ${pr.unit?`<div class="muted">${esc(pr.unit)}</div>`:''}
                  <div class="price">${f(p.price)} ل.س</div>
                  <div class="muted">آخر تحديث: ${esc(p.updated_at||'')}</div>
                </div>
              `;
            }).join('')}</div>`
          : '<p class="muted">لا توجد أسعار منشورة لهذا المتجر حالياً.</p>'
        }
      </div>
    `;

    body.innerHTML=html;
  };

  window.toggleStoreVerification=async function(storeId,value){
    if(!profileData || profileData.role!=='admin'){
      alert('هذه العملية للمدير فقط.');
      return;
    }

    try{
      const {error}=await supabaseClient
        .from('stores')
        .update({verified:value===true || value==='true'})
        .eq('id',storeId);

      if(error){
        alert('تعذر تحديث التوثيق: '+error.message);
        return;
      }

      await refreshStoresSafe();
      renderStores();
    }catch(err){
      alert('حدث خطأ: '+err.message);
    }
  };

  window.showAdd=function(){
    if(!profileData){
      alert('سجّل الدخول أولاً.');
      show('login');
      return;
    }

    if(profileData.role==='admin'){
      show('add');

      const box=el('merchantStoreBox');
      if(box){
        const opts=stores.map(s=>
          `<option value="${s.id}">${esc(s.name)}</option>`
        ).join('');

        box.innerHTML=`
          <label class="muted">المتجر للسعر (اختياري)</label>
          <select id="adminAddStore">
            <option value="">بدون سعر متجر</option>
            ${opts}
          </select>
        `;
      }
      return;
    }

    if(profileData.role!=='store'){
      alert('إضافة المواد متاحة للتاجر المربوط بمتجر والمصرح له، وللمدير.');
      return;
    }

    if(!profileData.can_edit_prices){
      alert('حسابك غير مصرح له حالياً.');
      return;
    }

    if(!profileData.store_id){
      alert('حسابك غير مربوط بمتجر حتى الآن.');
      return;
    }

    show('add');
  };

  function injectHomeButton(){
    const home=document.getElementById('home');
    if(!home || !canAdd()) return;

    if(document.getElementById('storeFeaturesAddBtn')) return;

    const btn=document.createElement('button');
    btn.id='storeFeaturesAddBtn';
    btn.className='btn primary';
    btn.textContent='إضافة مادة جديدة';
    btn.onclick=window.showAdd;

    home.appendChild(btn);
  }

  setInterval(function(){
    try{
      injectHomeButton();

      if(el('stores')?.classList.contains('active'))
        window.renderStores();

      if(el('storeDetail')?.classList.contains('active'))
        window.renderStoreDetail();
    }catch(_){}
  },1200);

  window.addEventListener('load',function(){
    setTimeout(function(){
      injectHomeButton();

      if(el('stores')?.classList.contains('active'))
        window.renderStores();
    },700);
  });
})();
(function(){
  'use strict';

  window.submitPrice = async function(){
    const selected=document.getElementById('existingProduct')?.value||'';
    const name=document.getElementById('pn')?.value.trim()||'';
    const priceRaw=document.getElementById('pr')?.value;
    const price=priceRaw===''?null:Number(priceRaw);
    const file=document.getElementById('pimg')?.files?.[0]||null;

    if(!selected && !name){
      alert('اكتب اسم المادة الجديدة.');
      return;
    }

    if(price!==null && (Number.isNaN(price)||price<0)){
      alert('اكتب السعر بشكل صحيح.');
      return;
    }

    if(!profileData){
      alert('سجّل الدخول أولاً.');
      return;
    }

    /* المدير */
    if(profileData.role==='admin'){
      let imageUrl=null;

      try{
        if(file && typeof window.uploadImage==='function'){
          imageUrl=await window.uploadImage(file,'materials');
        }
      }catch(err){
        alert('فشل رفع الصورة: '+err.message);
        return;
      }

      if(selected){
        if(price===null){
          alert('اكتب السعر عند إضافة سعر لمادة موجودة.');
          return;
        }

        const storeId=document.getElementById('adminAddStore')?.value||'';

        if(!storeId){
          alert('اختر المتجر للسعر.');
          return;
        }

        const {error}=await supabaseClient
          .from('price_listings')
          .upsert({
            product_id:selected,
            store_id:storeId,
            price_new:price,
            approved:true,
            submitted_by:profileData.id,
            approved_by:profileData.id,
            updated_at:new Date().toISOString()
          },{
            onConflict:'product_id,store_id'
          });

        if(error){
          alert(error.message);
          return;
        }

        alert('تم إضافة السعر ونشره مباشرة.');
      }else{
        const {data,error}=await supabaseClient
          .from('products')
          .insert({
            name:name,
            description:null,
            category:document.getElementById('cat')?.value.trim()||'عام',
            unit:document.getElementById('unit')?.value.trim()||null,
            image_url:imageUrl,
            active:true,
            created_by:profileData.id
          })
          .select()
          .single();

        if(error){
          alert(error.message);
          return;
        }

        const storeId=document.getElementById('adminAddStore')?.value||'';

        if(storeId && price!==null){
          const {error:e2}=await supabaseClient
            .from('price_listings')
            .insert({
              product_id:data.id,
              store_id:storeId,
              price_new:price,
              approved:true,
              submitted_by:profileData.id,
              approved_by:profileData.id
            });

          if(e2){
            alert(e2.message);
            return;
          }
        }

        alert(
          storeId&&price!==null
          ? 'تمت إضافة المادة والسعر ونشرهما مباشرة.'
          : 'تمت إضافة المادة ونشرها مباشرة.'
        );
      }

      ['pn','brand','unit','cat','pr'].forEach(i=>{
        const x=document.getElementById(i);
        if(x)x.value='';
      });

      if(document.getElementById('pimg'))
        document.getElementById('pimg').value='';

      if(document.getElementById('existingProduct'))
        document.getElementById('existingProduct').value='';

      if(typeof window.refreshAll==='function')
        await window.refreshAll();

      if(typeof window.show==='function')
        window.show('home');

      return;
    }

    /* التاجر */
    if(
      profileData.role!=='store' ||
      !profileData.store_id ||
      !profileData.can_edit_prices
    ){
      alert('حسابك غير مخول لإرسال الطلب.');
      return;
    }

    if(price===null){
      alert('اكتب السعر.');
      return;
    }

    let imageUrl=null;

    try{
      if(file && typeof window.uploadImage==='function'){
        imageUrl=await window.uploadImage(file,'materials');
      }
    }catch(err){
      alert('فشل رفع الصورة: '+err.message);
      return;
    }

    const payload={
      request_type:selected?'price':'product',
      product_id:selected||null,
      store_id:profileData.store_id,
      price_new:price,
      product_name:selected?null:name,
      product_description:null,
      product_category:document.getElementById('cat')?.value.trim()||'عام',
      product_unit:document.getElementById('unit')?.value.trim()||'',
      product_image_url:imageUrl,
      submitted_by:profileData.id,
      status:'pending'
    };

    const {error}=await supabaseClient
      .from('change_requests')
      .insert(payload);

    if(error){
      const msg=document.getElementById('addMsg');
      if(msg)msg.textContent='خطأ: '+error.message;
      return;
    }

    const msg=document.getElementById('addMsg');
    if(msg)msg.textContent='تم إرسال الطلب للمراجعة.';

    ['pn','brand','unit','cat','pr'].forEach(i=>{
      const x=document.getElementById(i);
      if(x)x.value='';
    });

    if(document.getElementById('pimg'))
      document.getElementById('pimg').value='';

    if(document.getElementById('existingProduct'))
      document.getElementById('existingProduct').value='';

    if(typeof window.show==='function')
      window.show('merchant');

    if(typeof window.renderMerchant==='function')
      await window.renderMerchant();
  };

  /* إعادة تشغيل وظائف المتاجر بعد التنقل */
  const oldShow=window.show;

  if(typeof oldShow==='function'){
    window.show=function(id){
      const result=oldShow.apply(this,arguments);

      if(id==='stores')
        setTimeout(()=>window.renderStores(),0);

      if(id==='storeDetail')
        setTimeout(()=>window.renderStoreDetail(),0);

      return result;
    };
  }

  function addButton(){
    if(!profileData)return;

    const allowed=
      profileData.role==='admin' ||
      (
        profileData.role==='store' &&
        profileData.store_id &&
        profileData.can_edit_prices
      );

    if(!allowed)return;

    const box=document.getElementById('roleActions');
    if(!box)return;

    if(box.querySelector('[data-store-feature-add]'))return;

    const b=document.createElement('button');
    b.className='btn primary';
    b.textContent='إضافة مادة جديدة';
    b.setAttribute('data-store-feature-add','1');
    b.onclick=window.showAdd;

    box.appendChild(b);
  }

  setInterval(()=>{
    try{
      addButton();
    }catch(_){}
  },1200);

})();
