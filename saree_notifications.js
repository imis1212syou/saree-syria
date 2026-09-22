/* إشعارات الإدارة */
(function(){'use strict';const C=window.SareeFeatureCore;if(!C)return;const db=C.client,esc=C.escape;
async function isAdmin(){const {data:{user}}=await db.auth.getUser();if(!user)return false;const {data}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();return data?.role==='admin';}
async function inject(){if(!await isAdmin())return;const top=document.querySelector('.top');if(!top||document.getElementById('sareeNotifBtn'))return;const b=document.createElement('button');b.id='sareeNotifBtn';b.className='btn secondary';b.textContent='🔔 إشعارات';top.appendChild(b);b.onclick=async()=>{const {data}=await db.from('saree_notifications').select('*').order('created_at',{ascending:false}).limit(30);alert((data||[]).map(n=>`${n.is_read?'':'• '}${n.title||''}\n${n.body||''}`).join('\n\n')||'لا توجد إشعارات.');if(data?.length)await db.from('saree_notifications').update({is_read:true,read_at:new Date().toISOString()}).in('id',data.map(x=>x.id));};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,1000),{once:true});else setTimeout(inject,1000);
})();
