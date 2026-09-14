/* سعرلي سوريا - store_barcode_fix_v2.js
   إصلاح بحث باركود المتجر
*/
(function(){
  'use strict';

  function $(id){
    return document.getElementById(id);
  }

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g,function(c){
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
      }[c];
    });
  }

  function db(){
    return window.supabaseClient ||
           window.sb ||
           window.supabase ||
           null;
  }

  function storeId(){
    var q = new URLSearchParams(location.search).get('store');

    if(q) return q;

    if(window.currentStoreId)
      return window.currentStoreId;

    if(window.profileData && window.profileData.store_id)
      return window.profileData.store_id;

    return null;
  }

  function merchantFor(id){
    return !!(
      window.profileData &&
      window.profileData.role === 'store' &&
      window.profileData.store_id &&
      String(window.profileData.store_id) === String(id) &&
      window.profileData.can_edit_prices === true
    );
  }

  /*
   * البحث عن المادة والسعر داخل المتجر نفسه
   */
  async function findPrice(id,code){

    var c = db();

    if(!c)
      throw new Error('NO_DB');

    var q = c
      .from('price_listings')
      .select(
        'id,store_id,product_id,price,price_new,status,updated_at,products!inner(id,name,brand,unit,barcode,image_url)'
      )
      .eq('store_id',id)
      .eq('products.barcode',code)
      .eq('status','approved')
      .limit(1)
      .maybeSingle();

    var r = await q;

    if(r.error)
      throw r.error;

    return r.data;
  }

  /*
   * تنفيذ البحث
   */
  async function search(id,code){

    code = String(code || '').replace(/\D/g,'');

    var msg = $('sbv2Msg');
    var out = $('sbv2Result');

    if(!code){

      if(msg)
        msg.textContent = 'امسح أو أدخل الباركود أولاً.';

      return;
    }

    if(msg)
      msg.textContent = 'جاري البحث عن السعر في هذا المتجر...';

    if(out)
      out.innerHTML = '';

    try{

      var row = await findPrice(id,code);

      if(!row){

        if(msg)
          msg.textContent =
            'تم التعرف على الباركود، لكن لا يوجد سعر منشور لهذه المادة في هذا المتجر.';

        return;
      }

      var p = row.products || {};

      var price =
        row.price_new != null
          ? row.price_new
          : row.price;

      if(out){

        out.innerHTML =
          '<div class="card" style="margin-top:10px">' +

            '<h3 style="margin-top:0">' +
              esc(p.name || 'مادة') +
            '</h3>' +

            (
              p.brand
              ? '<div class="muted">العلامة: ' +
                esc(p.brand) +
                '</div>'
              : ''
            ) +

            (
              p.unit
              ? '<div class="muted">الوحدة: ' +
                esc(p.unit) +
                '</div>'
              : ''
            ) +

            '<div style="font-size:26px;font-weight:800;margin-top:10px">' +
              esc(price) +
              ' ل.س' +
            '</div>' +

            '<div class="muted" style="margin-top:6px">' +
              'الباركود: ' +
              esc(code) +
            '</div>' +

            (
              row.updated_at
              ? '<div class="muted">آخر تحديث: ' +
                esc(
                  new Date(row.updated_at)
                    .toLocaleString('ar-SY')
                ) +
                '</div>'
              : ''
            ) +

          '</div>';
      }

      if(msg)
        msg.textContent =
          'تم العثور على السعر في هذا المتجر.';

    }catch(e){

      console.error(
        'store_barcode_fix_v2',
        e
      );

      if(msg)
        msg.textContent =
          'حدث خطأ أثناء البحث. تأكد أن عمود barcode موجود وأن السعر منشور.';
    }
  }

  /*
   * الكاميرا
   */

  var stream = null;
  var raf = null;
  var detector = null;

  function closeScan(){

    if(raf){
      cancelAnimationFrame(raf);
      raf = null;
    }

    if(stream){

      stream
        .getTracks()
        .forEach(function(t){
          t.stop();
        });

      stream = null;
    }

    var m = $('sbv2Modal');

    if(m)
      m.remove();
  }

  function openScan(id){

    closeScan();

    var m = document.createElement('div');

    m.id = 'sbv2Modal';

    m.style.cssText =
      'position:fixed;' +
      'inset:0;' +
      'z-index:999999;' +
      'background:rgba(0,0,0,.9);' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:center;' +
      'padding:14px;' +
      'direction:rtl;';

    m.innerHTML =
      '<div class="card" style="width:min(520px,100%);max-height:95vh;overflow:auto">' +

        '<div style="display:flex;justify-content:space-between;align-items:center">' +

          '<h3 style="margin:0">' +
            'مسح باركود المادة' +
          '</h3>' +

          '<button type="button" class="btn secondary" id="sbv2Close">' +
            'إغلاق' +
          '</button>' +

        '</div>' +

        '<video ' +
          'id="sbv2Video" ' +
          'autoplay ' +
          'playsinline ' +
          'muted ' +
          'style="display:block;width:100%;margin-top:12px;border-radius:16px;background:#000;aspect-ratio:4/3;object-fit:cover">' +
        '</video>' +

        '<p id="sbv2ScanMsg" class="muted">' +
          'وجّه الكاميرا نحو الباركود...' +
        '</p>' +

        '<input ' +
          'id="sbv2Manual" ' +
          'inputmode="numeric" ' +
          'autocomplete="off" ' +
          'placeholder="أو أدخل الباركود يدوياً">' +

        '<button type="button" class="btn primary" id="sbv2Use" style="width:100%;margin-top:8px">' +
          'بحث' +
        '</button>' +

      '</div>';

    document.body.appendChild(m);

    $('sbv2Close').onclick = closeScan;

    $('sbv2Use').onclick = function(){

      var v =
        $('sbv2Manual')
          .value
          .replace(/\D/g,'');

      if(v){

        closeScan();

        var i = $('sbv2Input');

        if(i)
          i.value = v;

        search(id,v);
      }
    };

    if(
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ){

      $('sbv2ScanMsg').textContent =
        'الكاميرا غير متاحة في هذا المتصفح. استخدم الإدخال اليدوي.';

      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video:{
          facingMode:{
            ideal:'environment'
          },
          width:{
            ideal:1280
          },
          height:{
            ideal:720
          }
        },
        audio:false
      })
      .then(async function(s){

        stream = s;

        var v = $('sbv2Video');

        if(!v)
          return;

        v.srcObject = s;

        await v.play();

        if(!('BarcodeDetector' in window)){

          $('sbv2ScanMsg').textContent =
            'الكاميرا تعمل، لكن المسح التلقائي غير مدعوم. استخدم الإدخال اليدوي.';

          return;
        }

        try{

          detector =
            new BarcodeDetector({
              formats:[
                'ean_13',
                'ean_8',
                'upc_a',
                'upc_e',
                'code_128',
                'code_39',
                'itf',
                'codabar'
              ]
            });

        }catch(e){

          detector =
            new BarcodeDetector();
        }

        scan(id);

      })
      .catch(function(e){

        console.error(e);

        var x = $('sbv2ScanMsg');

        if(x)
          x.textContent =
            'تعذر فتح الكاميرا. اسمح للموقع باستخدام الكاميرا ثم جرّب مرة أخرى.';
      });
  }

  async function scan(id){

    if(!detector || !stream)
      return;

    try{

      var v = $('sbv2Video');

      if(
        v &&
        v.readyState >= 2
      ){

        var a =
          await detector.detect(v);

        if(
          a &&
          a[0] &&
          a[0].rawValue
        ){

          var code =
            String(a[0].rawValue)
              .replace(/\D/g,'');

          if(code){

            closeScan();

            var i = $('sbv2Input');

            if(i)
              i.value = code;

            await search(id,code);

            return;
          }
        }
      }

    }catch(e){}

    raf =
      requestAnimationFrame(
        function(){
          scan(id);
        }
      );
  }

  /*
   * لوحة باركود المتجر
   */

  function panel(id){

    var internal =
      merchantFor(id);

    return (

      '<div id="storeBarcodePanelV2" class="card" style="margin-top:14px">' +

        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +

          '<h3 style="margin:0">' +
            'باركود المتجر' +
          '</h3>' +

          '<span class="pill">' +
            (
              internal
              ? 'إدارة المتجر'
              : 'بحث'
            ) +
          '</span>' +

        '</div>' +

        '<p class="muted">' +
          'امسح باركود مادة للبحث عن سعرها في هذا المتجر فقط.' +
        '</p>' +

        '<button type="button" class="btn secondary" id="sbv2Camera">' +
          '📷 مسح بالكاميرا' +
        '</button>' +

        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +

          '<input ' +
            'id="sbv2Input" ' +
            'inputmode="numeric" ' +
            'autocomplete="off" ' +
            'placeholder="رقم الباركود" ' +
            'style="flex:1;min-width:180px">' +

          '<button type="button" class="btn primary" id="sbv2Search">' +
            'بحث 🔎' +
          '</button>' +

        '</div>' +

        '<p id="sbv2Msg" class="muted"></p>' +

        '<div id="sbv2Result"></div>' +

      '</div>'
    );
  }

  /*
   * إظهار اللوحة
   */

  function mount(){

    var id = storeId();

    if(!id)
      return;

    var target =
      document.getElementById(
        'storeDetailBody'
      );

    if(
      !target &&
      merchantFor(id)
    ){

      target =
        document.getElementById(
          'merchantStoreBox'
        );
    }

    if(!target)
      return;

    var old =
      document.getElementById(
        'storeBarcodePanelV2'
      );

    if(old)
      old.remove();

    var w =
      document.createElement('div');

    w.innerHTML =
      panel(id);

    target.appendChild(
      w.firstElementChild
    );

    $('sbv2Camera').onclick =
      function(){
        openScan(id);
      };

    $('sbv2Search').onclick =
      function(){

        search(
          id,
          $('sbv2Input').value
        );
      };

    $('sbv2Input')
      .addEventListener(
        'input',
        function(){

          this.value =
            this.value.replace(
              /\D/g,
              ''
            );
        }
      );

    $('sbv2Input')
      .addEventListener(
        'keydown',
        function(e){

          if(e.key === 'Enter')
            search(
              id,
              this.value
            );
        }
      );
  }

  /*
   * إعادة تركيب اللوحة بعد فتح صفحة المتجر
   */

  var oldRender =
    window.renderStoreDetail;

  if(typeof oldRender === 'function'){

    window.renderStoreDetail =
      async function(){

        var r =
          await oldRender.apply(
            this,
            arguments
          );

        setTimeout(
          mount,
          50
        );

        return r;
      };
  }

  document.addEventListener(
    'DOMContentLoaded',
    function(){

      setTimeout(
        mount,
        300
      );

    }
  );

  window.addEventListener(
    'popstate',
    function(){

      setTimeout(
        mount,
        100
      );

    }
  );

  window.mountStoreBarcodeV2 =
    mount;

  window.openStoreBarcodeV2 =
    function(){

      var id = storeId();

      if(id)
        openScan(id);
    };

})();
