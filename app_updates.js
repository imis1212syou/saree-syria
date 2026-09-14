/* =========================================================
   سعرلي سوريا — app_updates.js
   تحديثات إضافية للموقع
   ========================================================= */

(function(){

  'use strict';


  /* ---------------------------------------------------------
     أدوات مساعدة
     --------------------------------------------------------- */

  function esc(v){

    if(typeof window.e === 'function'){
      return window.e(v);
    }

    return String(v ?? '').replace(
      /[&<>"']/g,
      function(m){
        return {
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          '"':'&quot;',
          "'":'&#039;'
        }[m];
      }
    );
  }


  function el(id){
    return document.getElementById(id);
  }


  /* ---------------------------------------------------------
     التصنيفات
     صور التصنيف فقط بدون أعلام
     --------------------------------------------------------- */

  const CATEGORY_IMAGES = {

    'بسكوت':
      'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=500&q=80',

    'شيبس':
      'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=500&q=80',

    'مشروبات':
      'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=500&q=80',

    'شوكولا وحلويات':
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=500&q=80',

    'ألبان وأجبان':
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=500&q=80',

    'عصائر':
      'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=500&q=80',

    'معلبات':
      'https://images.unsplash.com/photo-1584473457493-17c4c24290c1?auto=format&fit=crop&w=500&q=80',

    'مواد غذائية':
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80',

    'منظفات':
      'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=500&q=80',

    'مناديل وورقيات':
      'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=500&q=80',

    'عناية شخصية':
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=500&q=80',

    'قهوة وشاي':
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=500&q=80',

    'سكاكر وعلكة':
      'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?auto=format&fit=crop&w=500&q=80'
  };


  /* ---------------------------------------------------------
     إنشاء قسم التصنيفات
     --------------------------------------------------------- */

  function createCategories(){

    if(document.getElementById('imageCategories')){
      return;
    }


    const home =
      document.getElementById('home');


    if(!home){
      return;
    }


    const section =
      document.createElement('section');


    section.id =
      'imageCategories';


    section.className =
      'card';


    section.innerHTML = `

      <h2>
        التصنيفات
      </h2>

      <div
        id="imageCategoriesGrid"
        style="
          display:grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(110px,1fr)
            );
          gap:12px;
        "
      >

        ${
          Object.entries(
            CATEGORY_IMAGES
          )
          .map(function(item){

            const name =
              item[0];

            const image =
              item[1];

            return `

              <button
                type="button"
                class="categoryImageCard"
                data-category="${esc(name)}"
                style="
                  padding:0;
                  border:0;
                  background:transparent;
                  cursor:pointer;
                  overflow:hidden;
                  border-radius:16px;
                "
              >

                <div
                  style="
                    position:relative;
                    aspect-ratio:1/1;
                    overflow:hidden;
                    border-radius:16px;
                  "
                >

                  <img
                    src="${image}"
                    alt="${esc(name)}"
                    loading="lazy"
                    style="
                      width:100%;
                      height:100%;
                      object-fit:cover;
                      display:block;
                    "
                  >

                  <div
                    style="
                      position:absolute;
                      right:0;
                      left:0;
                      bottom:0;
                      padding:10px 6px;
                      background:
                        linear-gradient(
                          transparent,
                          rgba(0,0,0,.85)
                        );
                      color:white;
                      font-weight:700;
                      text-align:center;
                    "
                  >
                    ${esc(name)}
                  </div>

                </div>

              </button>

            `;

          })
          .join('')
        }

      </div>
    `;


    /*
      نضع التصنيفات بعد الجزء العلوي
      حتى يبقى شكل الموقع الحالي.
    */

    const firstCard =
      home.querySelector('.card');


    if(firstCard){

      firstCard.after(
        section
      );

    }else{

      home.appendChild(
        section
      );

    }


    section
      .querySelectorAll(
        '.categoryImageCard'
      )
      .forEach(function(btn){

        btn.addEventListener(
          'click',
          function(){

            openCategory(
              btn.dataset.category
            );

          }
        );

      });

  }


  /* ---------------------------------------------------------
     فتح التصنيف
     --------------------------------------------------------- */

  async function openCategory(
    category
  ){

    let page =
      document.getElementById(
        'categoryProductsPage'
      );


    if(!page){

      page =
        document.createElement(
          'section'
        );

      page.id =
        'categoryProductsPage';

      page.className =
        'page';


      page.innerHTML = `

        <div class="hero">

          <h1 id="categoryProductsTitle">
            المنتجات
          </h1>

          <button
            class="btn secondary"
            type="button"
            id="categoryBackBtn"
          >
            العودة
          </button>

        </div>

        <div
          class="grid"
          id="categoryProductsList"
        >
        </div>

      `;


      document.body.appendChild(
        page
      );


      page
        .querySelector(
          '#categoryBackBtn'
        )
        .onclick =
        function(){

          if(
            typeof window.show ===
            'function'
          ){

            window.show('home');

          }

        };

    }


    document
      .querySelectorAll('.page')
      .forEach(function(p){

        p.classList.remove(
          'active'
        );

      });


    page.classList.add(
      'active'
    );


    const title =
      page.querySelector(
        '#categoryProductsTitle'
      );


    const list =
      page.querySelector(
        '#categoryProductsList'
      );


    title.textContent =
      category;


    list.innerHTML =
      '<div class="card">' +
      '<p class="muted">جاري تحميل المنتجات...</p>' +
      '</div>';


    try{

      const {
        data,
        error
      } =
        await supabaseClient
          .from('products')
          .select('*')
          .eq(
            'category',
            category
          )
          .eq(
            'active',
            true
          )
          .order(
            'name'
          );


      if(error){

        list.innerHTML =
          '<div class="card">' +
          '<p class="muted">' +
          'تعذر تحميل المنتجات: ' +
          esc(error.message) +
          '</p>' +
          '</div>';

        return;
      }


      if(
        !Array.isArray(data) ||
        !data.length
      ){

        list.innerHTML =
          '<div class="card">' +
          '<p class="muted">' +
          'لا توجد منتجات في هذا التصنيف حالياً.' +
          '</p>' +
          '</div>';

        return;
      }


      list.innerHTML =
        data.map(function(p){

          return `

            <div class="card">

              ${
                p.image_url
                ? `
                  <img
                    src="${esc(p.image_url)}"
                    alt="${esc(p.name)}"
                    loading="lazy"
                    style="
                      width:100%;
                      max-height:220px;
                      object-fit:contain;
                      border-radius:14px;
                    "
                  >
                `
                : ''
              }


              <h3>
                ${esc(p.name)}
              </h3>


              ${
                p.brand
                ? `
                  <div class="muted">
                    ${esc(p.brand)}
                  </div>
                `
                : ''
              }


              ${
                p.unit
                ? `
                  <div class="muted">
                    ${esc(p.unit)}
                  </div>
                `
                : ''
              }


              <button
                class="btn primary"
                type="button"
                onclick="
                  openProductFromCategory(
                    '${p.id}'
                  )
                "
              >
                عرض الأسعار
              </button>

            </div>

          `;

        }).join('');


    }catch(err){

      list.innerHTML =
        '<div class="card">' +
        '<p class="muted">' +
        'حدث خطأ أثناء تحميل المنتجات.' +
        '</p>' +
        '</div>';

    }

  }


  window.openCategory =
    openCategory;


  /* ---------------------------------------------------------
     عرض أسعار المنتج من التصنيف
     --------------------------------------------------------- */

  window.openProductFromCategory =
    async function(productId){

      try{

        const {
          data:
          product
        } =
          await supabaseClient
            .from('products')
            .select('*')
            .eq(
              'id',
              productId
            )
            .single();


        if(!product){

          alert(
            'المنتج غير موجود.'
          );

          return;
        }


        const {
          data:
          listings,
          error
        } =
          await supabaseClient
            .from('price_listings')
            .select(
              '*,stores(*)'
            )
            .eq(
              'product_id',
              productId
            )
            .eq(
              'status',
              'approved'
            )
            .order(
              'price',
              {
                ascending:true
              }
            );


        if(error){

          alert(
            'تعذر تحميل الأسعار: ' +
            error.message
          );

          return;
        }


        let html = `

          <div class="hero">

            <h1>
              ${esc(product.name)}
            </h1>

            ${
              product.brand
              ? `
                <p class="muted">
                  ${esc(product.brand)}
                </p>
              `
              : ''
            }

          </div>

        `;


        if(
          !Array.isArray(listings) ||
          !listings.length
        ){

          html += `

            <div class="card">

              <p class="muted">
                لا توجد أسعار منشورة لهذا المنتج حالياً.
              </p>

            </div>

          `;

        }else{

          html += `

            <div class="grid">

              ${
                listings.map(function(row){

                  const store =
                    row.stores || {};


                  return `

                    <div class="card">

                      <h3>
                        ${esc(
                          store.name ||
                          'متجر'
                        )}
                      </h3>


                      ${
                        store.city
                        ? `
                          <div class="muted">
                            ${esc(
                              store.city
                            )}
                          </div>
                        `
                        : ''
                      }


                      <div class="price">

                        ${esc(
                          row.price ??
                          row.price_new ??
                          0
                        )}

                        ل.س

                      </div>


                      <button
                        class="btn secondary"
                        type="button"
                        onclick="
                          openStore(
                            '${store.id}'
                          )
                        "
                      >
                        فتح المتجر
                      </button>

                    </div>

                  `;

                }).join('')
              }

            </div>

          `;

        }


        let modal =
          document.getElementById(
            'appProductModal'
          );


        if(!modal){

          modal =
            document.createElement(
              'div'
            );

          modal.id =
            'appProductModal';


          modal.style.cssText =
            `
              position:fixed;
              inset:0;
              z-index:9999;
              background:rgba(0,0,0,.75);
              overflow:auto;
              padding:20px;
            `;


          document.body.appendChild(
            modal
          );

        }


        modal.innerHTML = `

          <div
            class="card"
            style="
              max-width:800px;
              margin:30px auto;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:10px;
              "
            >

              <h2>
                ${esc(product.name)}
              </h2>

              <button
                class="btn secondary"
                type="button"
                id="closeProductModal"
              >
                إغلاق
              </button>

            </div>

            ${html}

          </div>

        `;


        modal
          .querySelector(
            '#closeProductModal'
          )
          .onclick =
          function(){

            modal.remove();

          };


      }catch(err){

        alert(
          'حدث خطأ: ' +
          err.message
        );

      }

    };


  /* ---------------------------------------------------------
     تحسين اختيار المادة في نموذج الإضافة
     --------------------------------------------------------- */

  async function fillExistingProducts(){

    const select =
      el('existingProduct');


    if(!select){
      return;
    }


    try{

      const {
        data,
        error
      } =
        await supabaseClient
          .from('products')
          .select(
            'id,name,brand,unit,category,barcode'
          )
          .eq(
            'active',
            true
          )
          .order(
            'name'
          );


      if(error){
        return;
      }


      const oldValue =
        select.value;


      select.innerHTML =
        '<option value="">إضافة مادة جديدة</option>';


      (data || [])
        .forEach(function(p){

          const option =
            document.createElement(
              'option'
            );


          option.value =
            p.id;


          option.textContent =
            p.name +
            (
              p.brand
              ? ' — ' + p.brand
              : ''
            );


          select.appendChild(
            option
          );

        });


      if(oldValue){
        select.value =
          oldValue;
      }


    }catch(_){}

  }


  /* ---------------------------------------------------------
     عند اختيار مادة موجودة
     --------------------------------------------------------- */

  function setupProductSelection(){

    const select =
      el('existingProduct');


    if(!select){
      return;
    }


    select.addEventListener(
      'change',
      async function(){

        const id =
          select.value;


        if(!id){
          return;
        }


        try{

          const {
            data:
            p
          } =
            await supabaseClient
              .from('products')
              .select(
                'name,brand,unit,category,barcode,image_url'
              )
              .eq(
                'id',
                id
              )
              .single();


          if(!p){
            return;
          }


          if(el('pn')){
            el('pn').value =
              p.name || '';
          }


          if(el('brand')){
            el('brand').value =
              p.brand || '';
          }


          if(el('unit')){
            el('unit').value =
              p.unit || '';
          }


          if(el('cat')){
            el('cat').value =
              p.category || '';
          }


          if(el('barcode')){
            el('barcode').value =
              p.barcode || '';
          }


        }catch(_){}

      }
    );

  }


  /* ---------------------------------------------------------
     تحديث التصنيفات بعد تحميل المنتجات
     --------------------------------------------------------- */

  function init(){

    createCategories();

    fillExistingProducts();

    setupProductSelection();

  }


  /*
    تشغيل مرة واحدة فقط.
    لا يوجد setInterval حتى لا يحدث وميض.
  */

  if(
    document.readyState ===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      function(){

        setTimeout(
          init,
          200
        );

      },
      {
        once:true
      }
    );

  }else{

    setTimeout(
      init,
      200
    );

  }


  /*
    إذا فتح المستخدم صفحة الإضافة لاحقاً،
    نحدّث قائمة المواد مرة واحدة فقط.
  */

  const oldShow =
    window.show;


  if(
    typeof oldShow ===
    'function' &&
    !window.__appUpdatesShowWrapped
  ){

    window.__appUpdatesShowWrapped =
      true;


    window.show =
      function(page){

        oldShow.apply(
          this,
          arguments
        );


        if(page === 'add'){

          setTimeout(
            function(){

              fillExistingProducts();

              setupProductSelection();

            },
            100
          );

        }

      };

  }


})();
