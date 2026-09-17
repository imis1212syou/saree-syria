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
let products=[],stores=[],prices=[],requests=[],profileData=null;
let basket=JSON.parse(localStorage.getItem('saree_basket')||'[]'),favorites=JSON.parse(localStorage.getItem('saree_favorites')||'[]'),alerts=JSON.parse(localStorage.getItem('saree_alerts')||'{}');
const $=id=>document.getElementById(id);
function e(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function f(n){return Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2})}
function old(n){return f(Number(n||0)*100)}
function escAttr(x){return e(x).replace(/`/g,'&#096;')}
function show(id){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id)?.classList.add('active');window.scrollTo(0,0);if(id==='basket')renderBasket();if(id==='favorites')renderFavorites();if(id==='stores')renderStores();if(id==='categories')renderCategories();if(id==='storeDetail')renderStoreDetail();if(id==='home')renderRoleActions();}
function storeUrl(id){return window.location.origin+window.location.pathname+'?store='+encodeURIComponent(id);}
function openStore(id){if(!id)return;history.pushState({},'',window.location.pathname+'?store='+encodeURIComponent(id));show('storeDetail');renderStoreDetail(id);}

function normalizeBarcode(v){return String(v??'').replace(/\D/g,'').trim()}
function storeBarcodeOf(product, listing){return normalizeBarcode(listing?.barcode || product?.barcode || '')}
function storeContactHtml(s){const wa=s.whatsapp_url||s.whatsapp||'';return `<div class="storeContact">${s.phone?`<a class="btn secondary" href="tel:${escAttr(s.phone)}">📞 الهاتف</a>`:''}${wa?`<a class="btn primary" target="_blank" rel="noopener" href="${escAttr(wa)}">💬 واتساب</a>`:''}</div>`}

function renderStorePriceCards(ps,storeId){
 const seen=new Set(); const out=[];
 for(const x of ps){const p=products.find(y=>y.id===x.product_id);if(!p)continue;const key=x.product_id||storeBarcodeOf(p,x);if(seen.has(key))continue;seen.add(key);out.push(`<div class="card storeProductCard" data-barcode="${escAttr(storeBarcodeOf(p,x))}"><div class="name">${e(p.name)}</div>${storeBarcodeOf(p,x)?`<div class="muted">باركود: ${e(storeBarcodeOf(p,x))}</div>`:''}<div class="price">${f(x.price_new)} ل.س جديدة</div><div class="old">${old(x.price_new)} ل.س قديمة</div></div>`)}
 return out.join('')||'<div class="card muted">لا توجد أسعار معتمدة لهذا المتجر حالياً. العدد: صفر</div>';
}

async function scanBarcodeForStore(storeId){
 if(typeof window.openBarcodeScannerForStore==='function'){
   window.openBarcodeScannerForStore(storeId);
   return;
 }
 alert('ماسح الباركود غير جاهز بعد. استخدم البحث اليدوي.');
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
      supabaseClient.from('stores').select('*').eq('active',true).order('name'),
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

function renderCategories(){const m={};products.forEach(p=>(m[p.category||'عام']??=[]).push(p));$('cats').innerHTML=Object.entries(m).map(([k,v])=>`<div class="card"><span class="pill">${e(k)}</span><div class="name">${v.length} منتجات</div></div>`).join('')||'<div class="card muted">لا توجد تصنيفات بعد.</div>'}

$('existingProduct').addEventListener('change',()=>{const on=!!$('existingProduct').value;$('pn').disabled=on;$('brand').disabled=on;$('unit').disabled=on;$('cat').disabled=on})






function toggleAdminGroup(id){$(id)?.classList.toggle('hidden')}






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
