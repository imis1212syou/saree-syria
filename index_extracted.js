
const SUPABASE_URL="https://ovocwugezuddbwypzteg.supabase.co";
const SUPABASE_KEY="sb_publishable_THEl1NqFWWRUImYpTLxu9g_iGM03Nsz";
const ADMIN_UID="fb610b6d-8b2b-4d6d-a957-dda26f1be4a2";
const REQUEST_TIMEOUT=10000;
async function fetchWithTimeout(input,init={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT);
  try{return await fetch(input,{...init,signal:controller.signal});}
  finally{clearTimeout(timer)}
}
const supabaseClient=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
  global:{fetch:fetchWithTimeout}
});
let products=[],stores=[],prices=[],requests=[],companies=[],profileData=null;
let basket=JSON.parse(localStorage.getItem('saree_basket')||'[]'),favorites=JSON.parse(localStorage.getItem('saree_favorites')||'[]'),alerts=JSON.parse(localStorage.getItem('saree_alerts')||'{}');
const $=id=>document.getElementById(id);
function e(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function f(n){return Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2})}
function old(n){return f(Number(n||0)*100)}
function escAttr(x){return e(x).replace(/`/g,'&#096;')}
function show(id){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id)?.classList.add('active');window.scrollTo(0,0);if(id==='basket')renderBasket();if(id==='favorites')renderFavorites();if(id==='stores')renderStores();if(id==='categories')renderCategories();if(id==='storeDetail')renderStoreDetail();if(id==='home')renderRoleActions();}
function storeUrl(id){return window.location.origin+window.location.pathname+'?store='+encodeURIComponent(id);}
function openStore(id){if(!id)return;history.pushState({},'',window.location.pathname+'?store='+encodeURIComponent(id));show('storeDetail');renderStoreDetail(id);}
async function recordStoreVisit(storeId){
  try{
    if(!storeId) return;
    await supabaseClient.from('store_visitor_visits').upsert({store_id:storeId,visitor_id:visitorId()},{onConflict:'store_id,visitor_id',ignoreDuplicates:true});
  }catch(err){console.warn('store visit:',err)}
}
function normalizeBarcode(v){return String(v??'').replace(/\D/g,'').trim()}
function storeBarcodeOf(product, listing){return normalizeBarcode(listing?.barcode || product?.barcode || '')}
function storeContactHtml(s){const wa=s.whatsapp_url||s.whatsapp||'';return `<div class="storeContact">${s.phone?`<a class="btn secondary" href="tel:${escAttr(s.phone)}">📞 الهاتف</a>`:''}${wa?`<a class="btn primary" target="_blank" rel="noopener" href="${escAttr(wa)}">💬 واتساب</a>`:''}</div>`}
function renderStoreDetail(id){
 const storeId=id||new URLSearchParams(location.search).get('store');
 const s=stores.find(x=>x.id===storeId);
 if(!s){$('storeDetailName').textContent='المتجر غير موجود';$('storeDetailBody').innerHTML='<div class="card">هذا الرابط غير صالح أو المتجر غير متاح حالياً.</div>';return;}
 $('storeDetailName').textContent=s.name;recordStoreVisit(storeId);
 const ps=prices.filter(x=>x.store_id===s.id).sort((a,b)=>Number(a.price_new)-Number(b.price_new));
 const company=s.companies?.name||s.company?.name||s.company_name||s.company||'';
 $('storeDetailBody').innerHTML=`${s.image_url?`<img class="img" src="${escAttr(s.image_url)}">`:''}<div class="muted">${company?`<span class="pill companyBadge">${e(company)}</span><br>`:''}${e(s.city||'')} ${e(s.area||'')}<br>${e(s.address||'')}</div>${storeContactHtml(s)}<div class="barcodeSearch"><input id="storeBarcodeSearch" inputmode="numeric" autocomplete="off" placeholder="ابحث عن باركود داخل هذا المتجر فقط"><button class="btn secondary" onclick="scanBarcodeForStore('${escAttr(s.id)}')">📷</button><button class="btn secondary" onclick="searchStoreBarcode('${escAttr(s.id)}')">بحث</button></div><p id="storeBarcodeMsg" class="muted"></p><h2 style="margin-top:18px">أسعار المتجر (${ps.length})</h2><div id="storeProductsGrid" class="grid">${renderStorePriceCards(ps,s.id)}</div>`;
}
function renderStorePriceCards(ps,storeId){
 const seen=new Set(); const out=[];
 for(const x of ps){const p=products.find(y=>y.id===x.product_id);if(!p)continue;const key=x.product_id||storeBarcodeOf(p,x);if(seen.has(key))continue;seen.add(key);out.push(`<div class="card storeProductCard" data-barcode="${escAttr(storeBarcodeOf(p,x))}"><div class="name">${e(p.name)}</div>${storeBarcodeOf(p,x)?`<div class="muted">باركود: ${e(storeBarcodeOf(p,x))}</div>`:''}<div class="price">${f(x.price_new)} ل.س جديدة</div><div class="old">${old(x.price_new)} ل.س قديمة</div></div>`)}
 return out.join('')||'<div class="card muted">لا توجد أسعار معتمدة لهذا المتجر حالياً. العدد: صفر</div>';
}
function searchStoreBarcode(storeId, value){
 const q=normalizeBarcode(value??$('storeBarcodeSearch')?.value); const msg=$('storeBarcodeMsg');
 if(!q){msg.textContent='اكتب رقم الباركود أو امسحه بالكاميرا.';return;}
 const ps=prices.filter(x=>x.store_id===storeId); const matches=ps.filter(x=>{const p=products.find(y=>y.id===x.product_id);return storeBarcodeOf(p,x)===q;});
 const grid=$('storeProductsGrid'); if(!grid)return;
 grid.innerHTML=matches.length?renderStorePriceCards(matches,storeId):'<div class="card muted">لم يتم العثور على هذا الباركود داخل هذا المتجر.</div>';
 msg.textContent=matches.length?`تم العثور على ${matches.length} مادة في هذا المتجر فقط.`:'لا توجد مادة بهذا الباركود في هذا المتجر.';
}
async function scanBarcodeForStore(storeId){
  if(typeof window.openBarcodeScannerForStore==='function'){
    window.openBarcodeScannerForStore(storeId);
  }else{
    alert('ماسح الباركود غير محمّل.');
  }
}
function handleStoreDeepLink(){const id=new URLSearchParams(location.search).get('store');if(id){setTimeout(()=>{show('storeDetail');renderStoreDetail(id);},0);}}
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('store');if(id){show('storeDetail');renderStoreDetail(id);}else{show('home');}});
function renderTopAccount(){const b=$('topAccountBtn');if(!b)return;b.classList.remove('hidden');if(profileData&&(profileData.role==='store'||profileData.role==='admin')){b.textContent='تسجيل الخروج';b.onclick=confirmLogout;}else{b.textContent='دخول الحساب';b.onclick=()=>show('login');}}
function renderRoleActions(){const box=$('roleActions');if(!box)return;box.innerHTML='';if(!profileData)return;if(profileData.role==='store'){box.innerHTML='<button class="btn primary" onclick="showAdd()">تسجيل سعر جديد</button><button class="btn secondary" onclick="openPriceUpdate()">تحديث الأسعار</button>';}else if(profileData.role==='admin'){box.innerHTML='<button class="btn primary" onclick="showAdd()">تسجيل سعر جديد</button><button class="btn secondary" onclick="openPriceUpdate()">تحديث الأسعار</button><button class="btn secondary" onclick="show(\'admin\')">لوحة التحكم</button>';}}
function openPriceUpdate(){if(profileData?.role==='admin'){show('admin');renderAdmin();return;}if(profileData?.role==='store'){renderMerchant();return;}alert('هذه الميزة للحسابات المصرح لها فقط.');}
function openNav(id){show(id);if(id==='basket' && basket.length===0) $('basketList').innerHTML='<div class="card"><div class="name">السلة</div><div class="price">0</div><div class="muted">عدد المنتجات في السلة: صفر</div></div>';if(id==='favorites' && favorites.length===0) $('favoritesList').innerHTML='<div class="card"><div class="name">المفضلة</div><div class="price">0</div><div class="muted">عدد المواد المفضلة: صفر</div></div>';if(id==='stores' && stores.length===0) $('storesList').innerHTML='<div class="card"><div class="name">المتاجر</div><div class="price">0</div><div class="muted">عدد المتاجر: صفر</div></div>';if(id==='categories' && !products.some(p=>p.category)) $('cats').innerHTML='<div class="card"><div class="name">التصنيفات</div><div class="price">0</div><div class="muted">عدد التصنيفات: صفر</div></div>';}
function goRole(){if(profileData?.role==='admin')show('admin');else if(profileData?.role==='store')show('merchant');else show('login')}
function enterVisitor(){const n=$('visitorName').value.trim();if(!n)return alert('اكتب اسمك أولاً');localStorage.setItem('visitor_name',n);profileData=null;renderTopAccount();renderRoleActions();$('status').textContent=n+' • زائر';show('home');refreshAll()}
function currentName(){return localStorage.getItem('visitor_name')||'زائر'}
function visitorId(){
 let id=localStorage.getItem('saree_visitor_id');
 if(!id){
   id=(crypto.randomUUID?crypto.randomUUID():('v_'+Date.now()+'_'+Math.random().toString(36).slice(2)));
   localStorage.setItem('saree_visitor_id',id);
 }
 return id;
}
async function recordVisitor(){
 try{
   await supabaseClient.from('visitor_visits').insert({visitor_id:visitorId()});
 }catch(err){console.warn('visitor tracking:',err)}
}
function confirmLogout(){if(confirm('هل أنت متأكد أنك تريد تسجيل الخروج؟')) logout();}
function enterVisitorFromLogin(){
 const n=localStorage.getItem('visitor_name')||'زائر';
 localStorage.setItem('visitor_name',n);profileData=null;
 $('status').textContent=n+' • زائر';renderTopAccount();renderRoleActions();show('home');
 refreshAll().catch(console.warn);
}

async function signup(){
 const name=$('signupName').value.trim(),email=$('signupEmail').value.trim().toLowerCase(),p1=$('signupPass').value,p2=$('signupPass2').value,type=$('accountType').value;
 if(!name||!email||!p1)return $('signupMsg').textContent='املأ جميع الحقول.';
 if(p1.length<6)return $('signupMsg').textContent='كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
 if(p1!==p2)return $('signupMsg').textContent='كلمتا المرور غير متطابقتين.';
 $('signupMsg').textContent='جاري إنشاء الحساب...';
 const {data,error}=await supabaseClient.auth.signUp({email,password:p1,options:{data:{name,account_type:type}}});
 if(error){
   const m=error.message.toLowerCase();
   $('signupMsg').textContent=(m.includes('already')||m.includes('registered')||m.includes('exists'))?'هذا البريد مستخدم مسبقاً. كل بريد له حساب واحد فقط.':'تعذر إنشاء الحساب: '+error.message;
   return;
 }
 if(data.session){await loadProfile();await refreshAll();return}
 $('signupMsg').textContent='تم إنشاء الحساب. إذا طلب النظام تأكيد البريد، افتح رسالة التأكيد ثم سجّل الدخول.';
 show('login');
}

async function login(){

 const em=$('email').value.trim().toLowerCase(),pw=$('pass').value;
 const remember=!!$('rememberLogin')?.checked;
 if(!em||!pw){$('msg').textContent='اكتب البريد وكلمة المرور';return}
 $('msg').textContent='جاري تسجيل الدخول...';
 sessionStorage.setItem('saree_explicit_login','1');
 const {error}=await supabaseClient.auth.signInWithPassword({email:em,password:pw});
 if(error){sessionStorage.removeItem('saree_explicit_login');$('msg').textContent='تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور.';return}
 if(remember)localStorage.setItem('saree_remember_login','1');else localStorage.removeItem('saree_remember_login');
 localStorage.removeItem('visitor_name');
 const ok=await loadProfile();
 if(!ok){await supabaseClient.auth.signOut();$('msg').textContent='تعذر فتح الحساب حالياً. يمكنك الدخول كزائر بدون حساب.';show('login');return}
 $('msg').textContent='تم تسجيل الدخول.';
 renderTopAccount();renderRoleActions();
 await refreshAll();
 if(!profileData){setTimeout(()=>loadProfile().catch(console.warn),300);}
}
async function forgotPassword(){
 const em=$('email').value.trim().toLowerCase();if(!em)return alert('اكتب البريد الإلكتروني أولاً');
 const {error}=await supabaseClient.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});
 alert(error?'خطأ: '+error.message:'تم إرسال رابط إعادة تعيين كلمة السر إذا كان الحساب موجوداً.');
}
async function logout(){localStorage.removeItem('saree_remember_login');sessionStorage.removeItem('saree_explicit_login');try{await supabaseClient.auth.signOut()}catch(e){console.warn(e)}profileData=null;renderTopAccount();renderRoleActions();$('status').textContent=currentName()+' • زائر';show('home');await refreshAll()}
async function loadProfile(){
  try{
    const {data:{user},error:authError}=await supabaseClient.auth.getUser();
    if(authError) throw authError;
    if(!user){profileData=null;$('status').textContent=currentName()+' • زائر';return false}
    const {data,error}=await supabaseClient.from('profiles')
      .select('id,name,role,store_id,can_edit_prices').eq('id',user.id).maybeSingle();
    if(error) throw error;
    if(!data){profileData=null;$('status').textContent=(user.email||'حساب')+' • حساب غير مكتمل';show('home');return false}
    profileData={...data,email:user.email||''};
    $('status').textContent=(data.name||user.email||'حساب');
    renderTopAccount();renderRoleActions();
    if(data.role==='admin') await renderAdmin();
    else if(data.role==='store') await renderMerchant();
    else show('home');
    renderTopAccount();renderRoleActions();
    return true;
  }catch(err){
    console.warn('loadProfile:',err);
    profileData=null;
    $('status').textContent=currentName()+' • زائر';
    if(!$('home').classList.contains('active')) show('home');
    return false;
  }
}
async function refreshAll(){
  renderProducts();renderStores();renderCategories();renderBasket();renderFavorites();
  try{await loadPublicData();}catch(err){console.warn('public data:',err)}
  try{await loadProfileIfNeeded();}catch(err){console.warn('profile:',err)}
  renderProducts();renderStores();renderCategories();renderBasket();renderFavorites();
  const deepStore=new URLSearchParams(location.search).get('store');
  if(deepStore){show('storeDetail');renderStoreDetail(deepStore);}
}
async function loadProfileIfNeeded(){
  try{
    const {data:{user}}=await supabaseClient.auth.getUser();
    if(user&&!profileData) await loadProfile();
  }catch(err){console.warn('auth check:',err)}
}
async function loadPublicData(){
  try{
    const [p,s,l]=await Promise.all([
      supabaseClient.from('products').select('*').eq('active',true).order('name'),
      supabaseClient.from('stores').select('*,companies(id,name,verified,active)').eq('active',true).order('name'),
      supabaseClient.from('price_listings').select('*,stores(id,name,city,area,address,phone,image_url,verified)').eq('approved',true).order('price_new')
    ]);
    if(p.error||s.error||l.error) throw(p.error||s.error||l.error);
    products=p.data||[];stores=s.data||[];prices=l.data||[];
    $('pc').textContent=products.length;$('sc').textContent=stores.length;
    $('approvedCount').textContent=prices.length;$('basketCount').textContent=basket.length;
    fillFilters();
  }catch(err){console.warn('loadPublicData:',err)}
}
function fillFilters(){
 const cities=[...new Set(stores.flatMap(s=>[s.city,s.area]).filter(Boolean))].sort(),cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
 const cf=$('cityFilter'),kt=$('catFilter'),cv=cf.value,kv=kt.value;
 cf.innerHTML='<option value="">كل المدن</option>'+cities.map(x=>`<option value="${escAttr(x)}">${e(x)}</option>`).join('');
 kt.innerHTML='<option value="">كل التصنيفات</option>'+cats.map(x=>`<option value="${escAttr(x)}">${e(x)}</option>`).join('');
 cf.value=cities.includes(cv)?cv:'';kt.value=cats.includes(kv)?kv:'';
 const ep=$('existingProduct');if(ep){const oldv=ep.value;ep.innerHTML='<option value="">إضافة مادة جديدة</option>'+products.map(p=>`<option value="${p.id}">${e(p.name)} ${p.unit?'- '+e(p.unit):''}</option>`).join('');ep.value=oldv}
}
function allPrices(p){return prices.filter(x=>x.product_id===p.id).sort((a,b)=>Number(a.price_new)-Number(b.price_new))}
function cheapest(p){return allPrices(p)[0]}
function renderProducts(){
 const q=($('search').value||'').trim().toLowerCase(),city=$('cityFilter').value,cat=$('catFilter').value;
 const list=products.filter(p=>{
  const txt=[p.name,p.description,p.brand,p.category,p.unit].join(' ').toLowerCase(),ps=allPrices(p);
  return (!q||txt.includes(q))&&(!cat||p.category===cat)&&(!city||ps.some(x=>(x.stores?.city||'')===city||(x.stores?.area||'')===city))
 });
 $('products').innerHTML=list.map(p=>{
  const c=cheapest(p),ps=allPrices(p),fav=favorites.includes(p.id);
  return `<div class="card">${p.image_url?`<img class="img" src="${escAttr(p.image_url)}">`:''}<span class="pill">${e(p.category||'عام')}</span><div class="name">${e(p.name)}</div><div class="muted">${e(p.unit||'')} ${p.brand?'• '+e(p.brand):''}</div>
  ${c?`<div class="price">${f(c.price_new)} ل.س جديدة</div><div class="old">${old(c.price_new)} ل.س قديمة</div><div class="meta"><span>الأرخص: ${e(c.stores?.name||'')}</span><span>${e(c.stores?.city||'')}</span></div><div class="meta"><span>${ps.length} متاجر</span><span>آخر تحديث: ${new Date(c.updated_at).toLocaleDateString('ar')}</span></div>`:'<div class="notice pending">لا يوجد سعر معتمد حالياً</div>'}
  <div class="actions"><button class="btn secondary" onclick="toggleFav('${p.id}')">${fav?'★ إزالة من المفضلة':'☆ أضف للمفضلة'}</button><button class="btn primary" onclick="details('${p.id}')">تفاصيل الأسعار</button><button class="btn secondary" onclick="addBasket('${p.id}')">أضف للسلة</button></div></div>`
 }).join('')||'<div class="card muted">لا توجد نتائج.</div>';
}
function details(id){
 const p=products.find(x=>x.id===id);if(!p)return;const ps=allPrices(p),c=ps[0],save=c&&ps.length>1?Number(ps[ps.length-1].price_new)-Number(c.price_new):0;
 let text=p.name+'\n\n'+ps.map((x,i)=>`${i+1}) ${f(x.price_new)} ل.س جديدة — ${x.stores?.name||''} — ${x.stores?.city||''} ${x.stores?.area||''}`).join('\n');
 text+=(save>0?`\n\nالتوفير بين الأعلى والأرخص: ${f(save)} ل.س`:'');alert(text||'لا توجد أسعار معتمدة.');
}
async function vote(priceId,v){
 const {data:{user}}=await supabaseClient.auth.getUser();
 if(!user)return alert('سجّل الدخول بحساب مستخدم لتقييم السعر.');
 const {error}=await supabaseClient.from('price_votes').upsert({price_id:priceId,user_id:user.id,vote:v},{onConflict:'price_id,user_id'});
 alert(error?'تعذر تسجيل التقييم: '+error.message:'تم تسجيل تقييمك.');
}
function addBasket(id){if(!basket.includes(id))basket.push(id);localStorage.setItem('saree_basket',JSON.stringify(basket));$('basketCount').textContent=basket.length;renderBasket();alert('تمت إضافة المادة للسلة.')}
function removeBasket(id){basket=basket.filter(x=>x!==id);localStorage.setItem('saree_basket',JSON.stringify(basket));renderBasket();$('basketCount').textContent=basket.length}
function renderBasket(){const items=basket.map(id=>products.find(p=>p.id===id)).filter(Boolean);if(!items.length)return $('basketList').innerHTML='<div class="card"><div class="name">السلة</div><div class="price">0</div><div class="muted">عدد المنتجات في السلة: صفر</div></div>';let total=0;$('basketList').innerHTML=items.map(p=>{const c=cheapest(p);total+=Number(c?.price_new||0);return `<div class="card"><div class="name">${e(p.name)}</div><div class="price">${c?f(c.price_new)+' ل.س':'لا يوجد سعر'}</div><div class="muted">${c?e(c.stores?.name||'')+' • '+e(c.stores?.city||''):''}</div><button class="btn secondary" onclick="removeBasket('${p.id}')">إزالة</button></div>`}).join('')+`<div class="hero"><h2>المجموع التقريبي</h2><div class="price">${f(total)} ل.س جديدة</div><div class="old">${old(total)} ل.س قديمة</div></div>`}
function toggleFav(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem('saree_favorites',JSON.stringify(favorites));renderProducts();renderFavorites()}
function renderFavorites(){const items=favorites.map(id=>products.find(p=>p.id===id)).filter(Boolean);$('favoritesList').innerHTML=items.length?items.map(p=>{const c=cheapest(p);return `<div class="card"><div class="name">${e(p.name)}</div><div class="price">${c?f(c.price_new)+' ل.س':'لا يوجد سعر'}</div><button class="btn secondary" onclick="toggleFav('${p.id}')">إزالة</button>${c?`<button class="btn secondary" onclick="setAlert('${p.id}')">تنبيه عند نزول السعر</button>`:''}</div>`}).join(''):'<div class="card"><div class="name">المفضلة</div><div class="price">0</div><div class="muted">عدد المواد المفضلة: صفر</div></div>'}
function setAlert(id){const c=cheapest(products.find(p=>p.id===id));if(!c)return;const v=prompt('أرسل لي تنبيهًا عندما يصبح السعر أقل من:',String(c.price_new));if(v===null)return;alerts[id]=Number(v);localStorage.setItem('saree_alerts',JSON.stringify(alerts));alert('تم حفظ التنبيه على هذا الجهاز.')}
function renderStores(){
 $('storesList').innerHTML=stores.map(s=>`<div class="card"><div onclick="openStore('${s.id}')" style="cursor:pointer">${s.image_url?`<img class="img" src="${escAttr(s.image_url)}">`:''}<div class="name">${e(s.name)} ${s.verified?'✓':''}</div>${(s.companies?.name||s.company?.name||s.company_name||s.company)?`<span class="pill companyBadge">${e(s.companies?.name||s.company?.name||s.company_name||s.company)}</span>`:''}<div class="muted">${e(s.city||'')} ${e(s.area||'')}<br>${e(s.address||'')}</div>${s.phone?`<div class="muted">${e(s.phone)}</div>`:''}${s.whatsapp_url||s.whatsapp?`<div class="actions"><a class="btn primary" target="_blank" rel="noopener" href="${escAttr(s.whatsapp_url||s.whatsapp)}">💬 واتساب</a></div>`:''}</div><button class="btn secondary" onclick="openStore('${s.id}')">فتح المتجر</button></div>`).join('')||'<div class="card muted">لا توجد متاجر حالياً. العدد: صفر</div>'}
function renderCategories(){const m={};products.forEach(p=>(m[p.category||'عام']??=[]).push(p));$('cats').innerHTML=Object.entries(m).map(([k,v])=>`<div class="card"><span class="pill">${e(k)}</span><div class="name">${v.length} منتجات</div></div>`).join('')||'<div class="card muted">لا توجد تصنيفات بعد.</div>'}
function showAdd(){
 if(!profileData){alert('هذه الميزة للحسابات المصرح لها فقط.');return}
 if(profileData.role==='admin'){alert('الحساب مصرح له بالكامل.');show('admin');return}
 if(profileData.role!=='store'){alert('إضافة الأسعار والمواد من الحسابات المصرح لها فقط.');return}
 if(!profileData.can_edit_prices){alert('الحساب غير مصرح له حالياً.');return}
 if(!profileData.store_id){alert('الحساب غير مرتبط بمتجر بعد.');return}
 alert('الحساب مصرح له.');
 show('add');$('merchantStoreBox').innerHTML=`<div class="notice">المتجر المرتبط: ${e(stores.find(s=>s.id===profileData.store_id)?.name||'غير ظاهر')}</div>`;
}
$('existingProduct').addEventListener('change',()=>{const on=!!$('existingProduct').value;$('pn').disabled=on;$('brand').disabled=on;$('unit').disabled=on;$('cat').disabled=on})
async function uploadImage(file,folder){
 if(!file)return null;const {data:{user}}=await supabaseClient.auth.getUser();if(!user)throw Error('يجب تسجيل الدخول');
 const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${folder}/${user.id}/${Date.now()}.${ext}`;
 const {error}=await supabaseClient.storage.from('product-images').upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;
 return supabaseClient.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
async function submitPrice(){

  const selected = $('existingProduct').value;
  const n = $('pn').value.trim();
  const brand = $('brand').value.trim();
  const unit = $('unit').value.trim();
  const category = $('cat').value.trim() || 'عام';
  const v = Number($('pr').value);
  const file = $('pimg').files[0];

  if(Number.isNaN(v) || v < 0){
    return alert('اكتب السعر بشكل صحيح.');
  }

  if(!selected && !n){
    return alert('اكتب اسم المادة الجديدة.');
  }

  if(!profileData){
    return alert('يجب تسجيل الدخول.');
  }

  const isAdmin =
    String(profileData.role).toLowerCase() === 'admin';

  const isStore =
    String(profileData.role).toLowerCase() === 'store';

  if(
    !isAdmin &&
    (
      !isStore ||
      !profileData.store_id ||
      profileData.can_edit_prices !== true
    )
  ){
    return alert('حسابك غير مخول لإضافة مادة أو سعر.');
  }

  let storeId = null;

  if(isAdmin){

    const storeSelect =
      $('merchantStoreSelect');

    if(storeSelect && storeSelect.value){
      storeId = storeSelect.value;
    }else{
      storeId =
        profileData.store_id || null;
    }

    if(!storeId){

      const availableStores =
        stores || [];

      if(availableStores.length === 1){
        storeId =
          availableStores[0].id;
      }else{
        return alert(
          'اختر المتجر الذي تريد إضافة المادة إليه.'
        );
      }
    }

  }else{

    storeId =
      profileData.store_id;
  }

  let imageUrl = null;

  try{

    if(file){
      imageUrl =
        await uploadImage(
          file,
          'materials'
        );
    }

  }catch(err){

    return alert(
      'فشل رفع الصورة: ' +
      err.message
    );
  }


  /*
   * =========================
   * إضافة مباشرة للمدير
   * =========================
   */

  if(isAdmin){

    try{

      let productId = selected || null;

      /*
       * مادة جديدة
       */
      if(!productId){

        const {data:newProduct,error:productError} =
          await supabaseClient
            .from('products')
            .insert({
              name: n,
              brand: brand || null,
              unit: unit || null,
              category: category,
              barcode: $('barcode')?.value?.replace(/\D/g,'') || null,
              image_url: imageUrl
            })
            .select()
            .single();

        if(productError)
          throw productError;

        productId =
          newProduct.id;

      }


      /*
       * إضافة السعر للمتجر
       */

      const {error:priceError} =
        await supabaseClient
          .from('price_listings')
          .insert({
            product_id: productId,
            store_id: storeId,
            price_new: v,
            approved: true,
            updated_at: new Date().toISOString()
          });

      if(priceError)
        throw priceError;

      alert(
        'تمت إضافة المادة والسعر مباشرة بنجاح ✅'
      );

      ['pn','brand','unit','cat','pr']
        .forEach(function(id){

          const field = $(id);

          if(field)
            field.value = '';

        });

      if($('pimg'))
        $('pimg').value = '';

      if($('existingProduct'))
        $('existingProduct').value = '';

      if($('barcode'))
        $('barcode').value = '';

      show('admin');

      if(typeof window.renderProducts === 'function'){
        await window.renderProducts();
      }

      return;

    }catch(err){

      console.error(err);

      return alert(
        'تعذر إضافة المادة:\n' +
        (err.message || 'خطأ غير معروف')
      );
    }
  }


  /*
   * =========================
   * إضافة التاجر
   * =========================
   */

  const payload = {
    request_type: selected
      ? 'price'
      : 'product',

    product_id:
      selected || null,

    store_id:
      storeId,

    price_new:
      v,

    product_name:
      selected ? null : n,

    product_description:
      null,

    product_category:
      category,

    product_unit:
      unit,

    product_image_url:
      imageUrl,

    submitted_by:
      profileData.id,

    status:
      'pending'
  };


  const {error} =
    await supabaseClient
      .from('change_requests')
      .insert(payload);

  if(error){

    return $('addMsg').textContent =
      'خطأ: ' + error.message;

  }

  $('addMsg').textContent =
    'تم إرسال الطلب للمراجعة.';

  ['pn','brand','unit','cat','pr']
    .forEach(function(id){

      const field = $(id);

      if(field)
        field.value = '';

    });

  if($('pimg'))
    $('pimg').value = '';

  if($('existingProduct'))
    $('existingProduct').value = '';

  if($('barcode'))
    $('barcode').value = '';

  show('merchant');
}
async function loadMerchantStoreVisitorCount(){
  try{
    if(!profileData || profileData.role!=='store' || !profileData.store_id) return;
    const {data,error}=await supabaseClient.rpc('merchant_store_visitor_count',{p_store_id:profileData.store_id});
    if(!error && $('merchantVisitorCount')) $('merchantVisitorCount').textContent=f(data||0);
  }catch(err){console.warn('merchant store visitors:',err)}
}

async function renderMerchant(){
 show('merchant');$('merchantRole').textContent='الحساب مربوط بمتجر واحد فقط. لا يمكنك تعديل متجر آخر أو النشر مباشرة.';
 const s=stores.find(x=>x.id===profileData.store_id);
 const {data,error}=await supabaseClient.from('change_requests').select('*').eq('submitted_by',profileData.id).order('created_at',{ascending:false}).limit(30);
 const reqs=data||[];
 $('merchantPanel').innerHTML=`<div class="card"><div class="name">${e(s?.name||'لم يتم ربط متجر بعد')}</div><div class="muted">${e(s?.city||'')} ${e(s?.area||'')}<br>${e(s?.address||'')}<br>${e(s?.phone||'')}</div><div class="notice ${profileData.can_edit_prices?'':'pending'}">${profileData.can_edit_prices&&s?'الصلاحية مفعّلة، وكل طلب يحتاج موافقة المدير.':'لا توجد لديك صلاحية إرسال أسعار أو مواد حالياً.'}</div>${s?`<div class="card" style="margin-top:10px"><div class="name" id="merchantVisitorCount">—</div><div class="muted">زوار المتجر الفريدون</div></div>`:''}<div class="actions"><button class="btn primary" ${profileData.can_edit_prices&&s?'':'disabled'} onclick="showAdd()">إضافة مادة / سعر</button><button class="btn secondary" onclick="openPriceUpdate()">تحديث الأسعار</button><button class="btn secondary" onclick="logout()">تسجيل الخروج</button></div></div><div class="card"><h2>طلباتك</h2>${error?`<p class="muted">${e(error.message)}</p>`:reqs.length?reqs.map(r=>`<div class="priceRow"><b>${e(r.product_name||'تعديل سعر')}</b><div class="muted">${r.price_new!=null?f(r.price_new)+' ل.س جديدة':''} • ${new Date(r.created_at).toLocaleString('ar')}</div><span class="pill">${r.status==='pending'?'قيد المراجعة':r.status==='approved'?'مقبول':'مرفوض'}</span>${r.reason?`<div class="muted">السبب: ${e(r.reason)}</div>`:''}</div>`).join(''):'<p class="muted">لا توجد طلبات.</p>'}</div>`;
 loadMerchantStoreVisitorCount();
}
async function loadVisitorCount(){
  try{
    if(!profileData || profileData.role!=='admin') return;
    const {data,error}=await supabaseClient.rpc('admin_visitor_count');
    if(!error && $('visitorCount')) $('visitorCount').textContent=f(data||0);
  }catch(err){console.warn('visitor count:',err)}
}
function toggleAdminGroup(id){$(id)?.classList.toggle('hidden')}
async function saveSiteLinks(){
 if(profileData?.role!=='admin')return alert('هذا الخيار للمدير فقط.');
 const payload={key:'site_contact_links',whatsapp_url:$('siteWhatsapp')?.value.trim()||null,telegram_url:$('siteTelegram')?.value.trim()||null,updated_by:profileData.id};
 const {error}=await supabaseClient.from('site_settings').upsert(payload,{onConflict:'key'});
 $('siteLinksMsg').textContent=error?'تعذر حفظ الروابط: '+error.message:'تم حفظ روابط الموقع.';
}
async function loadSiteLinks(){
 if(profileData?.role!=='admin')return;
 try{const {data}=await supabaseClient.from('site_settings').select('whatsapp_url,telegram_url').eq('key','site_contact_links').maybeSingle();if(data){if($('siteWhatsapp'))$('siteWhatsapp').value=data.whatsapp_url||'';if($('siteTelegram'))$('siteTelegram').value=data.telegram_url||'';}}catch(e){console.warn('site links:',e)}
}
// ماسح الباركود موجود في barcode_scanner.js لتجنب تعارض BarcodeDetector مع المتصفح.
// لا نعرّف scanBarcode هنا.
async function renderAdmin(){
 show('admin');$('role').textContent='لوحة تحكم المدير: إدارة كاملة للمنتجات والأسعار والمتاجر والحسابات والموافقات.';
 const [rq,pr,st,us,co]=await Promise.all([
  supabaseClient.from('change_requests').select('*').eq('status','pending').order('created_at',{ascending:false}),
  supabaseClient.from('products').select('*').order('name'),
  supabaseClient.from('stores').select('*').order('name'),
  supabaseClient.from('profiles').select('id,name,role,store_id,can_edit_prices,verified').order('created_at',{ascending:false}),
  supabaseClient.from('companies').select('*').order('name')
 ]);
 const er=rq.error||pr.error||st.error||us.error||co.error;
 if(er){$('adminPanel').innerHTML=`<div class="card dangerbox">خطأ: ${e(er.message)}</div>`;return;}
 requests=rq.data||[];products=pr.data||products;stores=st.data||stores;companies=co.data||[];const users=us.data||[];
 const merchantUsers=users.filter(u=>u.role==='store'&&u.id!==ADMIN_UID);
 const requestBlock=requests.length?requests.map(requestHtml).join(''):'<p class="muted">لا توجد طلبات معلقة.</p>';
 const merchantBlock=merchantUsers.length?merchantUsers.map((u,i)=>{
   const opts='<option value="">بدون متجر</option>'+stores.map(st=>`<option value="${st.id}" ${u.store_id===st.id?'selected':''}>${e(st.name)}${st.city?' • '+e(st.city):''}</option>`).join('');
   return `<div class="priceRow"><div class="accordionHead" onclick="toggleAdminGroup('merchant_${u.id}')"><b>${e(u.name||u.id)}</b><span>▾</span></div><div id="merchant_${u.id}" class="accordionBody hidden"><div class="muted">حساب تاجر • ${e(u.email||'بدون بريد')} • ${u.store_id?'مرتبط بمتجر':'غير مرتبط بمتجر'}</div><select id="store_${u.id}">${opts}</select><label class="muted"><input id="edit_${u.id}" type="checkbox" ${u.can_edit_prices?'checked':''}> تفعيل صلاحية إرسال الأسعار والمواد</label><button class="btn primary" onclick="saveUser('${u.id}')">ربط وحفظ الصلاحيات</button></div></div>`;
 }).join(''):'<p class="muted">لا توجد حسابات تجار حالياً.</p>';
 const usersBlock=users.map(u=>u.id!==ADMIN_UID?`<div class="priceRow"><div class="accordionHead" onclick="toggleAdminGroup('user_${u.id}')"><b>${e(u.name||u.id)}</b><span>▾</span></div><div id="user_${u.id}" class="accordionBody hidden"><div class="muted">البريد: ${e(u.email||'بدون بريد')} • الدور: ${e(u.role)}${u.store_id?' • مرتبط بمتجر':''}</div><select id="role_${u.id}"><option value="user" ${u.role==='user'?'selected':''}>مستخدم</option><option value="store" ${u.role==='store'?'selected':''}>تاجر</option></select><button class="btn secondary" onclick="saveRoleOnly('${u.id}')">حفظ الدور</button></div></div>`:'<div class="priceRow"><b>حساب المدير</b><span class="pill">مدير النظام</span></div>').join('');
 const storeBlock=stores.length?stores.map(st=>`<div class="priceRow admin-store-row" id="adminStoreRow_${st.id}"><b>${e(st.name)}</b>${st.verified?'<span class="pill">✓ موثّق</span>':'<span class="pill">غير موثّق</span>'}<div class="muted">${e(st.city||'')} • ${e(st.area||'')} • ${e(st.address||'')}</div><div class="muted">زوار المتجر الفريدون: <b id="sv_${st.id}">—</b></div><div id="qr_${st.id}" class="qrbox"></div><div class="actions"><button type="button" class="btn secondary" onclick="event.stopPropagation();openStore('${st.id}')">فتح صفحة المتجر</button><button type="button" class="btn secondary" onclick="event.stopPropagation();printStoreQR('${st.id}')">طباعة QR</button><button type="button" class="btn primary" onclick="event.stopPropagation();openAdminStoreEdit('${st.id}')">تعديل المتجر</button><button type="button" class="btn secondary" onclick="event.stopPropagation();toggleAdminStoreVerification('${st.id}')">${st.verified?'إلغاء التوثيق':'توثيق المتجر'}</button><button type="button" class="btn danger" onclick="event.stopPropagation();deleteAdminStore('${st.id}')">حذف المتجر</button></div></div>`).join(''):'<p class="muted">لا توجد متاجر حالياً.</p>';
 $('adminPanel').innerHTML=`<div class="grid"><div class="card"><div class="name">${requests.length}</div><div class="muted">طلبات معلقة</div></div><div class="card"><div class="name">${stores.length}</div><div class="muted">متاجر</div></div><div class="card"><div class="name">${products.length}</div><div class="muted">منتجات</div></div><div class="card"><div class="name">${users.length}</div><div class="muted">حسابات</div></div><div class="card"><div class="name" id="visitorCount">—</div><div class="muted">عدد الزوار الفريدين</div></div></div><div class="card"><h2>طلبات التجار</h2>${requestBlock}</div><div class="card"><h2>إضافة متجر</h2><div class="two"><input id="sn" placeholder="اسم المتجر"><input id="scity" placeholder="المدينة"><input id="sarea" placeholder="المنطقة"><input id="saddr" placeholder="العنوان"><input id="sphone" placeholder="الهاتف"><input id="swhatsapp" placeholder="رابط واتساب المتجر"><select id="scompany"><option value="">بدون شركة</option></select><input id="shours" placeholder="ساعات الدوام"><input id="sdays" placeholder="أيام العمل"><input id="simg" type="file" accept="image/*"></div><button class="btn primary" onclick="adminAddStore()">إضافة المتجر</button></div><div class="card"><h2>ربط حسابات التجار بالمتاجر</h2><p class="muted">أنشئ المتجر أولاً، ثم اختر حساب التاجر واربطه بمتجر واحد فقط. الحساب الجديد يبقى بلا صلاحيات حتى تفعّلها أنت.</p>${merchantBlock}</div><div class="card"><h2>جميع الحسابات</h2>${usersBlock}</div><div class="card"><h2>روابط الموقع</h2><p class="muted">هذه الروابط متاحة للمدير فقط.</p><div class="two"><input id="siteWhatsapp" placeholder="رابط واتساب الموقع"><input id="siteTelegram" placeholder="رابط تلغرام الموقع"></div><button class="btn primary" onclick="saveSiteLinks()">حفظ روابط الموقع</button><p id="siteLinksMsg" class="muted"></p></div><div class="card"><h2>إدارة الشركات</h2><p class="muted">إضافة وتعديل وتوثيق وحذف الشركات. ربط المتجر بالشركة يتم من شاشة تعديل المتجر.</p><div class="actions"><button type="button" class="btn primary" onclick="openAdminCompanyCreate()">إضافة شركة</button></div><div id="adminCompaniesList" class="grid" style="margin-top:12px">${companies.length?companies.map(c=>`<div class="priceRow admin-company-row" id="adminCompanyRow_${c.id}"><b>${e(c.name)}</b> ${c.verified?'<span class="pill">✓ موثقة</span>':'<span class="pill">غير موثقة</span>'}<div class="muted">${e(c.phone||'')} ${c.address?'• '+e(c.address):''}</div><div class="actions"><button type="button" class="btn primary" onclick="openAdminCompanyEdit('${c.id}')">تعديل الشركة</button><button type="button" class="btn secondary" onclick="toggleAdminCompanyVerification('${c.id}')">${c.verified?'إلغاء التوثيق':'توثيق الشركة'}</button><button type="button" class="btn danger" onclick="deleteAdminCompany('${c.id}')">حذف الشركة</button></div></div>`).join(''):'<div class="card muted">لا توجد شركات مسجلة.</div>'}</div></div><div class="card"><h2>المتاجر و QR Code</h2><p class="muted">لكل متجر QR Code فعلي. عند مسحه بكاميرا الهاتف يفتح صفحة المتجر مباشرة.</p>${storeBlock}</div><div class="actions"><button class="btn secondary" onclick="show('home')">العودة للموقع</button><button class="btn secondary" onclick="logout()">تسجيل الخروج</button></div>`;
 loadVisitorCount();loadAdminStoreVisitorCounts();loadSiteLinks();setTimeout(buildAllQRCodes,50);
}
async function loadAdminStoreVisitorCounts(){
  try{
    if(!profileData || profileData.role!=='admin') return;
    const {data,error}=await supabaseClient.rpc('admin_store_visitor_counts');
    if(error || !Array.isArray(data)) return;
    data.forEach(row=>{const el=$('sv_'+row.store_id);if(el)el.textContent=f(row.visitor_count||0)});
  }catch(err){console.warn('store visitor counts:',err)}
}

function buildAllQRCodes(){if(typeof QRCode==='undefined')return;stores.forEach(s=>{const box=$('qr_'+s.id);if(!box)return;box.innerHTML='';new QRCode(box,{text:storeUrl(s.id),width:160,height:160,correctLevel:QRCode.CorrectLevel.H});});}
function printStoreQR(id){const st=stores.find(x=>x.id===id);if(!st)return;const url=storeUrl(id);const w=window.open('','_blank');if(!w)return alert('اسمح بفتح النوافذ المنبثقة لطباعة QR.');const safeName=e(st.name),safeUrl=e(url);const html='<!doctype html><html dir=\"rtl\"><head><meta charset=\"utf-8\"><title>QR - '+safeName+'</title></head><body style=\"font-family:Arial;text-align:center;padding:30px\"><h2>'+safeName+'</h2><div id=\"qrprint\"></div><p>'+safeUrl+'</p><script src=\"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js\"><\/script><script>new QRCode(document.getElementById(\"qrprint\"),{text:'+JSON.stringify(url)+',width:300,height:300,correctLevel:QRCode.CorrectLevel.H});setTimeout(function(){window.print();},800);<\/script></body></html>';w.document.open();w.document.write(html);w.document.close();}
function requestHtml(r){return `<div class="priceRow"><b>${e(r.product_name||'طلب تعديل سعر')}</b><div class="muted">السعر: ${r.price_new!=null?f(r.price_new)+' ل.س جديدة':'—'}<br>النوع: ${e(r.request_type)}<br>أرسل: ${new Date(r.created_at).toLocaleString('ar')}</div><div class="actions"><button class="btn approve" onclick="approveRequest('${r.id}')">موافقة ونشر</button><button class="btn reject" onclick="rejectRequest('${r.id}')">رفض</button></div></div>`}
async function approveRequest(id){
 const r=requests.find(x=>x.id===id);if(!r)return;
 if(r.request_type==='product'){
  const {data,error}=await supabaseClient.from('products').insert({name:r.product_name,description:r.product_description,category:r.product_category,unit:r.product_unit,image_url:r.product_image_url,active:true,created_by:r.submitted_by}).select().single();
  if(error)return alert(error.message);
  const {error:e2}=await supabaseClient.from('price_listings').insert({product_id:data.id,store_id:r.store_id,price_new:r.price_new,approved:true,submitted_by:r.submitted_by,approved_by:profileData.id});
  if(e2)return alert(e2.message);
 }else if(r.request_type==='price'){
  const {data:existing}=await supabaseClient.from('price_listings').select('*').eq('product_id',r.product_id).eq('store_id',r.store_id).maybeSingle();
  if(existing){
   await supabaseClient.from('price_history').insert({price_id:existing.id,old_price_new:existing.price_new,new_price_new:r.price_new,changed_by:profileData.id});
   const {error}=await supabaseClient.from('price_listings').update({price_new:r.price_new,approved:true,approved_by:profileData.id,updated_at:new Date().toISOString()}).eq('id',existing.id);if(error)return alert(error.message);
  }else{
   const {error}=await supabaseClient.from('price_listings').insert({product_id:r.product_id,store_id:r.store_id,price_new:r.price_new,approved:true,submitted_by:r.submitted_by,approved_by:profileData.id});if(error)return alert(error.message);
  }
 }
 const {error}=await supabaseClient.from('change_requests').update({status:'approved',reviewed_by:profileData.id,reviewed_at:new Date().toISOString()}).eq('id',id);
 if(error)return alert(error.message);alert('تمت الموافقة والنشر.');await refreshAll();await renderAdmin();
}
async function rejectRequest(id){const reason=prompt('سبب الرفض (اختياري):','');const {error}=await supabaseClient.from('change_requests').update({status:'rejected',reason,reviewed_by:profileData.id,reviewed_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);alert('تم رفض الطلب.');await renderAdmin()}
async function adminAddStore(){
 const name=$('sn').value.trim();if(!name)return alert('اكتب اسم المتجر.');let image=null;try{image=await uploadImage($('simg').files[0],'stores')}catch(err){return alert(err.message)}
 const {error}=await supabaseClient.from('stores').insert({name,city:$('scity').value.trim(),area:$('sarea').value.trim(),address:$('saddr').value.trim(),phone:$('sphone').value.trim(),opening_hours:$('shours').value.trim(),working_days:$('sdays').value.trim(),image_url:image,whatsapp_url:$('swhatsapp').value.trim()||null,company_id:$('scompany')?.value||null,verified:true,active:true});
 if(error)return alert(error.message);alert('تمت إضافة المتجر.');await refreshAll();await renderAdmin();
}
async function saveUser(id){
 const role='store';
 const store_id=$('store_'+id).value||null;
 const can_edit_prices=!!store_id && $('edit_'+id).checked;
 const {error}=await supabaseClient.from('profiles').update({role,store_id,can_edit_prices}).eq('id',id);
 if(error)return alert(error.message);
 alert(store_id?(can_edit_prices?'تم ربط التاجر بالمتجر وتفعيل الصلاحية.':'تم ربط التاجر بالمتجر، والصلاحية ما زالت متوقفة.'):'تم فك ربط التاجر عن المتجر وإيقاف الصلاحية.');
 await renderAdmin();
}
async function saveRoleOnly(id){
 const role=$('role_'+id).value;
 if(role==='store'){
   const {error}=await supabaseClient.from('profiles').update({role:'store',store_id:null,can_edit_prices:false}).eq('id',id);
   if(error)return alert(error.message);
 }else{
   const {error}=await supabaseClient.from('profiles').update({role:'user',store_id:null,can_edit_prices:false}).eq('id',id);
   if(error)return alert(error.message);
 }
 alert('تم حفظ الدور.');await renderAdmin();
}
supabaseClient.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT'){
    profileData=null;renderTopAccount();renderRoleActions();$('status').textContent=currentName()+' • زائر';
    show('home');
  }
  if(event==='SIGNED_IN') setTimeout(()=>loadProfile().catch(console.warn),0);
});
(()=>{
  const hasVisitor=localStorage.getItem('visitor_name');
  $('visitorName').value=hasVisitor?currentName():'';
  renderTopAccount();renderRoleActions();
  show('home');
  renderProducts();renderStores();renderCategories();renderBasket();renderFavorites();
  setTimeout(async()=>{
    try{
      const remember=localStorage.getItem('saree_remember_login')==='1';
      const {data}=await supabaseClient.auth.getSession();
      const explicit=sessionStorage.getItem('saree_explicit_login')==='1';
      if(explicit){sessionStorage.removeItem('saree_explicit_login');}
      if(!remember && data?.session && !explicit){
        await supabaseClient.auth.signOut();
      }
    }catch(err){console.warn('session check:',err)}
    recordVisitor().catch(console.warn);
    refreshAll().catch(err=>console.warn('startup:',err));
  },0);
})();
handleStoreDeepLink();
