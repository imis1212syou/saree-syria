/* سعرلي سوريا — ماسح الباركود
   الدفعة 1 من 2
*/
(function(){

  'use strict';

  let barcodeStream = null;
  let barcodeTimer = null;
  let barcodeBusy = false;

  function B(id){
    return document.getElementById(id);
  }

  function escBarcode(v){
    if(typeof window.e === 'function'){
      return window.e(v);
    }

    return String(v ?? '').replace(/[&<>"']/g,function(m){
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
      }[m];
    });
  }

  function stopBarcodeCamera(){
    try{
      if(barcodeTimer){
        clearInterval(barcodeTimer);
        barcodeTimer=null;
      }

      if(barcodeStream){
        barcodeStream.getTracks().forEach(function(track){
          track.stop();
        });
        barcodeStream=null;
      }
    }catch(_){}

    barcodeBusy=false;
  }

  window.closeBarcodeScanner=function(){
    stopBarcodeCamera();

    const box=B('barcodeScannerBox');

    if(box){
      box.remove();
    }
  };

  window.openBarcodeScanner=function(storeId){

    storeId=storeId || window.currentStoreId;

    if(!storeId){
      alert('لم يتم تحديد المتجر.');
      return;
    }

    window.currentBarcodeStoreId=storeId;

    window.closeBarcodeScanner();

    const box=document.createElement('div');

    box.id='barcodeScannerBox';

    box.innerHTML=`
      <div class="card" style="
        position:fixed;
        z-index:99999;
        inset:10px;
        max-width:600px;
        margin:auto;
        overflow:auto;
        background:#111820;
        border:1px solid #2b3945;
      ">

        <div class="row" style="
          justify-content:space-between;
          align-items:center;
        ">
          <h2>📷 مسح باركود</h2>

          <button
            class="btn secondary"
            onclick="closeBarcodeScanner()">
            إغلاق
          </button>
        </div>

        <p class="muted">
          وجّه الكاميرا نحو الباركود وانتظر حتى يتم التعرف عليه تلقائياً.
        </p>

        <div style="
          position:relative;
          width:100%;
          max-width:500px;
          margin:15px auto;
          overflow:hidden;
          border-radius:18px;
          background:#000;
        ">

          <video
            id="barcodeVideo"
            autoplay
            muted
            playsinline
            style="
              display:block;
              width:100%;
              min-height:260px;
              object-fit:cover;
            ">
          </video>

          <div style="
            position:absolute;
            left:10%;
            right:10%;
            top:45%;
            height:2px;
            background:#32d583;
            box-shadow:0 0 10px #32d583;
          "></div>

        </div>

        <p id="barcodeScannerStatus"
           class="muted"
           style="text-align:center">
          جاري تشغيل الكاميرا...
        </p>

        <button
          class="btn secondary"
          onclick="stopBarcodeCamera()">
          إيقاف الكاميرا
        </button>

      </div>
    `;

    document.body.appendChild(box);

    startBarcodeCamera();
  };


  async function startBarcodeCamera(){

    const video=B('barcodeVideo');
    const status=B('barcodeScannerStatus');

    if(!video){
      return;
    }

    if(!navigator.mediaDevices ||
       !navigator.mediaDevices.getUserMedia){

      if(status){
        status.textContent=
          'المتصفح لا يسمح بتشغيل الكاميرا.';
      }

      return;
    }

    try{

      barcodeStream=
        await navigator.mediaDevices.getUserMedia({
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
        });

      video.srcObject=barcodeStream;

      await video.play();

      if(status){
        status.textContent=
          'وجّه الكاميرا نحو الباركود...';
      }

      startBarcodeDetection(video);

    }catch(error){

      console.warn('barcode camera:',error);

      if(status){

        if(error &&
           (error.name==='NotAllowedError' ||
            error.name==='PermissionDeniedError')){

          status.textContent=
            'اسمح للموقع باستخدام الكاميرا ثم حاول مرة أخرى.';

        }else{

          status.textContent=
            'تعذر تشغيل الكاميرا: '+(error.message||'');

        }

      }
    }
  }


  function startBarcodeDetection(video){

    if(!('BarcodeDetector' in window)){

      const status=B('barcodeScannerStatus');

      if(status){
        status.innerHTML=
          'هذا المتصفح لا يدعم قراءة الباركود مباشرة. '+
          'سنضيف طريقة بديلة في الدفعة الثانية.';
      }

      return;
    }

    let detector;

    try{

      detector=new BarcodeDetector({
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

    }catch(error){

      console.warn('BarcodeDetector:',error);

      try{
        detector=new BarcodeDetector();
      }catch(_){
        return;
      }
    }


    barcodeTimer=setInterval(async function(){

      if(barcodeBusy){
        return;
      }

      if(!video.videoWidth ||
         !video.videoHeight){
        return;
      }

      barcodeBusy=true;

      try{

        const codes=
          await detector.detect(video);

        if(codes && codes.length){

          const code=
            codes[0].rawValue;

          if(code){

            await window.findProductByBarcode(
              String(code).trim()
            );

          }
        }

      }catch(error){

        console.warn(
          'barcode detection:',
          error
        );

      }finally{

        barcodeBusy=false;
      }

    },350);
  }


  window.findProductByBarcode=
    async function(barcode){

      barcode=String(barcode||'').trim();

      if(!barcode){
        return;
      }

      stopBarcodeCamera();

      const status=B('barcodeScannerStatus');

      if(status){
        status.textContent=
          'تمت قراءة الباركود: '+barcode+
          ' — جاري البحث...';
      }

      const storeId=
        window.currentBarcodeStoreId ||
        window.currentStoreId;

      if(!storeId){

        alert('لم يتم تحديد المتجر.');

        window.closeBarcodeScanner();

        return;
      }

      try{

        const {data:productsData,error:productError}=
          await supabaseClient
            .from('products')
            .select('*')
            .eq('barcode',barcode)
            .limit(1);

        if(productError){
          throw productError;
        }

        if(!productsData ||
           !productsData.length){

          alert(
            'هذا الباركود غير مسجل ضمن مواد الموقع حالياً.'
          );

          window.closeBarcodeScanner();

          return;
        }

        const product=
          productsData[0];

        const {data:priceData,error:priceError}=
          await supabaseClient
            .from('price_listings')
            .select('*')
            .eq('store_id',storeId)
            .eq('product_id',product.id)
            .eq('status','approved')
            .order('updated_at',{
              ascending:false
            })
            .limit(1);

        if(priceError){
          throw priceError;
        }

        if(!priceData ||
           !priceData.length){

          alert(
            'المادة موجودة، لكن لا يوجد لها سعر منشور في هذا المتجر.'
          );

          window.closeBarcodeScanner();

          return;
        }

        window.closeBarcodeScanner();

        window.barcodeFoundProduct=product;

        window.barcodeFoundPrice=priceData[0];

        showBarcodeProductResult(
          product,
          priceData[0]
        );

      }catch(error){

        console.error(error);

        alert(
          'حدث خطأ أثناء البحث: '+
          (error.message||error)
        );

        window.closeBarcodeScanner();
      }
    };


  function showBarcodeProductResult(
    product,
    price
  ){

    const body=B('storeDetailBody');

    if(!body){
      return;
    }

    const oldContent=
      body.innerHTML;

    body.innerHTML=`
      <div class="card"
           style="border:2px solid #32d583">

        <div class="row"
             style="
               justify-content:space-between;
               align-items:center
             ">

          <h2>
            ${escBarcode(product.name||'المادة')}
          </h2>

          <span class="pill">
            ✓ تم العثور
          </span>

        </div>

        ${
          product.brand
          ? `<p class="muted">
               العلامة: ${escBarcode(product.brand)}
             </p>`
          : ''
        }

        ${
          product.unit
          ? `<p class="muted">
               الحجم / الوزن: ${escBarcode(product.unit)}
             </p>`
          : ''
        }

        <div style="
          font-size:28px;
          font-weight:800;
          margin:18px 0;
        ">
          ${typeof window.f==='function'
            ? window.f(price.price)
            : price.price}
          ل.س
        </div>

        <p class="muted">
          الباركود:
          ${escBarcode(product.barcode)}
        </p>

        <button
          class="btn primary"
          onclick="restoreBarcodeStore()">
          ← العودة لصفحة المتجر
        </button>

      </div>
    `;

    window._barcodeOldStoreDetail=
      oldContent;
  }


  window.restoreBarcodeStore=function(){

    if(typeof window.renderStoreDetail==='function'){

      window.renderStoreDetail(
        window.currentBarcodeStoreId ||
        window.currentStoreId
      );

    }
  };

})();
/* سعرلي سوريا — ماسح الباركود
   الدفعة 2 من 2
*/
(function(){

  'use strict';

  /* إضافة زر مسح الباركود داخل صفحة المتجر */
  function addBarcodeButton(){

    const body=document.getElementById('storeDetailBody');

    if(!body) return;

    if(document.getElementById('openBarcodeBtn')) return;

    const storeId=
      window.currentStoreId ||
      window.currentBarcodeStoreId;

    if(!storeId) return;

    const btn=document.createElement('button');

    btn.id='openBarcodeBtn';
    btn.className='btn primary';
    btn.style.width='100%';
    btn.style.marginBottom='15px';
    btn.textContent='📷 مسح باركود المادة';

    btn.onclick=function(){
      window.openBarcodeScanner(storeId);
    };

    body.insertBefore(btn,body.firstChild);
  }


  /* إعادة إضافة الزر بعد فتح صفحة المتجر */
  const originalRenderStoreDetail=
    window.renderStoreDetail;

  if(typeof originalRenderStoreDetail==='function'){

    window.renderStoreDetail=async function(id){

      const result=
        await originalRenderStoreDetail.apply(
          this,
          arguments
        );

      setTimeout(function(){
        addBarcodeButton();
      },100);

      return result;
    };
  }


  /* دعم المتصفحات التي لا تدعم BarcodeDetector */
  async function loadFallbackScanner(){

    if(window.Html5Qrcode){
      return true;
    }

    return new Promise(function(resolve){

      const existing=
        document.querySelector(
          'script[data-barcode-fallback]'
        );

      if(existing){

        existing.addEventListener(
          'load',
          ()=>resolve(true)
        );

        existing.addEventListener(
          'error',
          ()=>resolve(false)
        );

        return;
      }

      const script=
        document.createElement('script');

      script.src=
        'https://unpkg.com/html5-qrcode';

      script.async=true;

      script.setAttribute(
        'data-barcode-fallback',
        '1'
      );

      script.onload=function(){
        resolve(true);
      };

      script.onerror=function(){
        resolve(false);
      };

      document.head.appendChild(script);
    });
  }


  window.openBarcodeFallback=
    async function(storeId){

      storeId=
        storeId ||
        window.currentStoreId;

      if(!storeId){
        alert('لم يتم تحديد المتجر.');
        return;
      }

      window.currentBarcodeStoreId=
        storeId;

      window.closeBarcodeScanner();

      const box=
        document.createElement('div');

      box.id='barcodeScannerBox';

      box.innerHTML=`
        <div class="card" style="
          position:fixed;
          z-index:99999;
          inset:10px;
          max-width:600px;
          margin:auto;
          overflow:auto;
          background:#111820;
          border:1px solid #2b3945;
        ">

          <div class="row" style="
            justify-content:space-between;
            align-items:center;
          ">

            <h2>📷 مسح باركود</h2>

            <button
              class="btn secondary"
              onclick="closeBarcodeScanner()">
              إغلاق
            </button>

          </div>

          <p class="muted">
            وجّه الكاميرا نحو الباركود.
          </p>

          <div id="barcodeFallbackReader"
               style="width:100%">
          </div>

          <p id="barcodeFallbackStatus"
             class="muted"
             style="text-align:center">
             جاري تجهيز الكاميرا...
          </p>

        </div>
      `;

      document.body.appendChild(box);

      const loaded=
        await loadFallbackScanner();

      if(!loaded || !window.Html5Qrcode){

        const status=
          document.getElementById(
            'barcodeFallbackStatus'
          );

        if(status){
          status.textContent=
            'تعذر تشغيل قارئ الباركود.';
        }

        return;
      }

      const readerId=
        'barcodeFallbackReader';

      const scanner=
        new Html5Qrcode(readerId);

      window.barcodeFallbackScanner=
        scanner;

      try{

        await scanner.start(
          {
            facingMode:'environment'
          },
          {
            fps:10,
            qrbox:{
              width:250,
              height:150
            },
            formatsToSupport:[
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.ITF
            ]
          },
          async function(decodedText){

            try{
              await scanner.stop();
            }catch(_){}

            window.barcodeFallbackScanner=null;

            if(typeof window.findProductByBarcode==='function'){
              window.findProductByBarcode(
                String(decodedText).trim()
              );
            }

          },
          function(_errorMessage){
            /* تجاهل أخطاء القراءة المؤقتة */
          }
        );

        const status=
          document.getElementById(
            'barcodeFallbackStatus'
          );

        if(status){
          status.textContent=
            'وجّه الكاميرا نحو الباركود...';
        }

      }catch(error){

        console.error(
          'fallback scanner:',
          error
        );

        const status=
          document.getElementById(
            'barcodeFallbackStatus'
          );

        if(status){
          status.textContent=
            'اسمح للموقع باستخدام الكاميرا ثم حاول مرة أخرى.';
        }
      }
    };


  /* إغلاق قارئ الطريقة البديلة */
  const oldClose=
    window.closeBarcodeScanner;

  window.closeBarcodeScanner=function(){

    try{

      if(window.barcodeFallbackScanner){

        window.barcodeFallbackScanner
          .stop()
          .catch(function(){});

        window.barcodeFallbackScanner=null;
      }

    }catch(_){}

    if(typeof oldClose==='function'){
      oldClose();
    }
  };


  /* إذا لم يدعم الهاتف BarcodeDetector
     نستخدم القارئ البديل تلقائياً */
  const oldOpen=
    window.openBarcodeScanner;

  window.openBarcodeScanner=function(storeId){

    if(
      !('BarcodeDetector' in window)
    ){

      window.openBarcodeFallback(storeId);

      return;
    }

    if(typeof oldOpen==='function'){
      return oldOpen(storeId);
    }
  };


  /* مراقبة صفحة المتجر وإظهار زر المسح */
  setInterval(function(){

    try{

      if(
        document.getElementById('storeDetail') &&
        document.getElementById('storeDetail')
          .classList.contains('active')
      ){
        addBarcodeButton();
      }

    }catch(_){}

  },1000);


})();
