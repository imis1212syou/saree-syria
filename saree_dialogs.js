/* سعرلي سوريا — نظام موحد لإشعارات ورسائل الموقع */
(() => {
  'use strict';
  const icons = {success:'✓', error:'!', warning:'⚠', info:'i'};
  const classify = message => {
    const s = String(message ?? '');
    if (/تعذر|فشل|خطأ|غير صالح|لا يمكن|لم يتم|ليس لديك|لا توجد|مطلوب|مستخدمة|مستخدم سابقاً/i.test(s)) return 'error';
    if (/هل أنت متأكد|حذف|إلغاء توثيق|فك ربط|تحويل هذا الحساب|إخفاء هذه المادة/i.test(s)) return 'warning';
    if (/تم |نجاح|بنجاح|أضيف|إضافة|حفظ|تحديث|تفعيل|تعطيل|إزالة/i.test(s)) return 'success';
    return 'info';
  };
  function toast(message, type) {
    const kind = type || classify(message);
    let host = document.getElementById('sareeToastHost');
    if (!host) { host = document.createElement('div'); host.id = 'sareeToastHost'; host.className = 'sareeToastHost'; host.setAttribute('aria-live','polite'); host.setAttribute('aria-atomic','false'); document.body.appendChild(host); }
    const item = document.createElement('div'); item.className = `sareeToast sareeToast-${kind}`;
    const icon = document.createElement('span'); icon.className = 'sareeToastIcon'; icon.textContent = icons[kind] || icons.info;
    const text = document.createElement('div'); text.className = 'sareeToastText'; text.textContent = String(message ?? '');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'sareeToastClose'; close.setAttribute('aria-label','إغلاق'); close.textContent = '×';
    close.addEventListener('click', () => item.remove()); item.append(icon,text,close); host.appendChild(item);
    requestAnimationFrame(() => item.classList.add('is-visible'));
    const duration = kind === 'error' ? 6500 : 4300;
    const timer = setTimeout(() => { item.classList.remove('is-visible'); setTimeout(() => item.remove(),220); }, duration);
    close.addEventListener('click', () => clearTimeout(timer));
    while (host.children.length > 4) host.firstElementChild.remove();
  }
  function dialog({title='تأكيد العملية', message='', type='warning', value='', placeholder='', confirmText='متابعة', cancelText='إلغاء', input=false}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div'); overlay.className = 'sareeDialogOverlay';
      const panel = document.createElement('section'); panel.className = `sareeDialog sareeDialog-${type}`; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby','sareeDialogTitle');
      const head = document.createElement('div'); head.className='sareeDialogHead';
      const mark=document.createElement('span');mark.className='sareeDialogMark';mark.textContent=icons[type]||icons.info;
      const heading=document.createElement('h3');heading.id='sareeDialogTitle';heading.textContent=title;head.append(mark,heading);
      const body=document.createElement('div');body.className='sareeDialogMessage';body.textContent=String(message??'');
      let field=null;
      if(input){field=document.createElement('input');field.className='sareeDialogInput';field.type='text';field.value=String(value??'');field.placeholder=placeholder;field.autocomplete='off';body.appendChild(field);}
      const actions=document.createElement('div');actions.className='sareeDialogActions';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='sareeDialogCancel';cancel.textContent=cancelText;
      const accept=document.createElement('button');accept.type='button';accept.className='sareeDialogAccept';accept.textContent=confirmText;
      actions.append(cancel,accept);panel.append(head,body,actions);overlay.appendChild(panel);document.body.appendChild(overlay);
      let settled=false;
      const finish=result=>{if(settled)return;settled=true;document.removeEventListener('keydown',keyHandler);overlay.classList.remove('is-visible');setTimeout(()=>overlay.remove(),160);resolve(result);};
      const keyHandler=e=>{if(e.key==='Escape'){e.preventDefault();finish(input?null:false);}else if(e.key==='Enter'&&input){e.preventDefault();finish(field.value);}};
      cancel.addEventListener('click',()=>finish(input?null:false));accept.addEventListener('click',()=>finish(input?field.value:true));
      overlay.addEventListener('click',e=>{if(e.target===overlay)finish(input?null:false);});document.addEventListener('keydown',keyHandler);
      requestAnimationFrame(()=>{overlay.classList.add('is-visible');(field||accept).focus();if(field)field.select();});
    });
  }
  window.sareeNotify = toast;
  window.sareeConfirm = (message, options={}) => dialog({message,title:options.title||'تأكيد العملية',type:options.type||'warning',confirmText:options.confirmText||'نعم، متابعة',cancelText:options.cancelText||'إلغاء'});
  window.sareePrompt = (message, value='', options={}) => dialog({message,value,input:true,title:options.title||'إدخال البيانات',type:'info',confirmText:options.confirmText||'حفظ',cancelText:options.cancelText||'إلغاء',placeholder:options.placeholder||''});
  // توحيد جميع استدعاءات alert القديمة دون الحاجة إلى تغيير منطق العمليات.
  window.alert = message => toast(message);
})();
