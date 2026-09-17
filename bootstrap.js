/* سعرلي سوريا — bootstrap
   يحمّل التشغيل النهائي بعد تحميل جميع وحدات الميزات.
*/
(function(){
  'use strict';
  supabaseClient.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){
      profileData=null;
      renderTopAccount();
      renderRoleActions();
      const st=document.getElementById('status');
      if(st) st.textContent=currentName()+' • زائر';
      show('home');
    }
    if(event==='SIGNED_IN') setTimeout(()=>loadProfile().catch(console.warn),0);
  });

  (async function(){
    const hasVisitor=localStorage.getItem('visitor_name');
    const visitor=document.getElementById('visitorName');
    if(visitor) visitor.value=hasVisitor?currentName():'';
    renderTopAccount();
    renderRoleActions();
    show('home');
    // الميزات الجديدة/الموسعة هي صاحبة العرض النهائي لهذه الأقسام.
    try{ await window.renderProducts?.(); }catch(e){console.warn(e)}
    try{ await window.renderStores?.(); }catch(e){console.warn(e)}
    renderCategories();
    renderBasket();
    renderFavorites();
    setTimeout(async()=>{
      try{
        const remember=localStorage.getItem('saree_remember_login')==='1';
        const {data}=await supabaseClient.auth.getSession();
        const explicit=sessionStorage.getItem('saree_explicit_login')==='1';
        if(explicit) sessionStorage.removeItem('saree_explicit_login');
        if(!remember && data?.session && !explicit) await supabaseClient.auth.signOut();
      }catch(err){console.warn('session check:',err)}
      recordVisitor().catch(console.warn);
      refreshAll().catch(err=>console.warn('startup:',err));
    },0);
    if(typeof handleStoreDeepLink==='function') handleStoreDeepLink();
  })();
})();
