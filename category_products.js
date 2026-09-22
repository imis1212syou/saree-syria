/*
 * Saree Syria - Category Products Module
 * جديد فقط: لا يعدّل الدوال الموجودة في المشروع ولا يستبدلها.
 *
 * الوظيفة:
 * - عند الضغط على أي تصنيف في صفحة "التصنيفات" تظهر كل المنتجات التابعة له.
 * - الضغط على شارة التصنيف داخل بطاقة المنتج يفتح نفس القائمة.
 * - القائمة قابلة للبحث.
 * - الصور لا تمنع عرض بقية المنتجات: كل منتجات التصنيف تظهر كبطاقات.
 * - يعتمد فقط على المتغيرات والدوال الموجودة حالياً: products, prices, e, f, old, details, addBasket.
 */
(function () {
  'use strict';

  const STYLE_ID = 'saree-category-products-style';
  const MODAL_ID = 'saree-category-products-modal';

  function esc(value) {
    if (typeof window.e === 'function') return window.e(value == null ? '' : String(value));
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value) {
    if (typeof window.f === 'function') return window.f(value);
    return Number(value || 0).toLocaleString('ar-SY');
  }

  function oldMoney(value) {
    if (typeof window.old === 'function') return window.old(value);
    return '';
  }

  function pricesFor(product) {
    if (!Array.isArray(window.prices)) return [];
    return window.prices
      .filter(function (x) { return x.product_id === product.id; })
      .sort(function (a, b) { return Number(a.price_new || 0) - Number(b.price_new || 0); });
  }

  function cheapest(product) {
    return pricesFor(product)[0] || null;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID}{
        position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);
        display:none;padding:18px;overflow:auto;
      }
      #${MODAL_ID}.open{display:block}
      .saree-cat-panel{
        width:min(1100px,100%);margin:0 auto;background:#10181d;color:inherit;
        border:1px solid #2c383e;border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.45);
        min-height:calc(100vh - 36px);padding:18px;
      }
      .saree-cat-head{display:flex;align-items:center;gap:10px;justify-content:space-between;position:sticky;top:0;background:#10181d;z-index:2;padding-bottom:12px;border-bottom:1px solid #253137}
      .saree-cat-title{font-size:22px;font-weight:800;margin:0}
      .saree-cat-count{font-size:13px;opacity:.75;margin-top:4px}
      .saree-cat-close{border:0;cursor:pointer;border-radius:10px;padding:9px 13px;background:#26343a;color:#fff;font-size:18px}
      .saree-cat-search{width:100%;margin:14px 0;padding:12px 14px;border-radius:12px;border:1px solid #334249;background:#0b1115;color:#fff;box-sizing:border-box;outline:none}
      .saree-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-top:12px}
      .saree-cat-card{background:#0d1418;border:1px solid #29363c;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-width:0}
      .saree-cat-img{width:100%;height:145px;object-fit:contain;background:#080d10;display:block}
      .saree-cat-img-empty{height:145px;background:#080d10;display:flex;align-items:center;justify-content:center;color:#6f7c82;font-size:12px}
      .saree-cat-body{padding:12px;display:flex;flex-direction:column;gap:7px;flex:1}
      .saree-cat-name{font-size:16px;font-weight:800;line-height:1.4}
      .saree-cat-meta{font-size:12px;opacity:.72;line-height:1.5}
      .saree-cat-price{font-size:16px;font-weight:800}
      .saree-cat-old{font-size:12px;opacity:.55;text-decoration:line-through}
      .saree-cat-stores{font-size:12px;opacity:.7}
      .saree-cat-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:auto;padding-top:4px}
      .saree-cat-actions button{flex:1;min-width:100px;border:0;border-radius:9px;padding:9px 8px;cursor:pointer}
      .saree-cat-empty{padding:30px;text-align:center;opacity:.7;border:1px dashed #334249;border-radius:14px}
      .saree-category-clickable{cursor:pointer;transition:transform .12s ease,filter .12s ease}
      .saree-category-clickable:hover{filter:brightness(1.12);transform:translateY(-1px)}
      #cats .saree-category-clickable{min-height:92px;display:flex;flex-direction:column;justify-content:center}
      @media(max-width:600px){
        #${MODAL_ID}{padding:8px}
        .saree-cat-panel{min-height:calc(100vh - 16px);padding:12px;border-radius:14px}
        .saree-cat-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .saree-cat-img,.saree-cat-img-empty{height:120px}
        .saree-cat-body{padding:9px}
        .saree-cat-name{font-size:14px}
        .saree-cat-price{font-size:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="saree-cat-panel" role="dialog" aria-modal="true" aria-labelledby="sareeCatTitle">
        <div class="saree-cat-head">
          <div>
            <h2 id="sareeCatTitle" class="saree-cat-title">التصنيف</h2>
            <div id="sareeCatCount" class="saree-cat-count"></div>
          </div>
          <button type="button" class="saree-cat-close" id="sareeCatClose" aria-label="إغلاق">×</button>
        </div>
        <input id="sareeCatSearch" class="saree-cat-search" type="search" placeholder="ابحث داخل هذا التصنيف..." autocomplete="off">
        <div id="sareeCatGrid" class="saree-cat-grid"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeCategory();
    });
    document.getElementById('sareeCatClose').addEventListener('click', closeCategory);
    document.getElementById('sareeCatSearch').addEventListener('input', function () {
      renderCategoryProducts(modal.dataset.category || '', this.value || '');
    });

    return modal;
  }

  function productMatches(product, query) {
    if (!query) return true;
    const text = [product.name, product.description, product.brand, product.category, product.unit]
      .filter(Boolean).join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }

  function productCard(product) {
    const ps = pricesFor(product);
    const cheapestPrice = ps[0] || null;
    const storesCount = new Set(ps.map(function (x) { return x.store_id; }).filter(Boolean)).size;
    const image = product.image_url
      ? `<img class="saree-cat-img" src="${esc(product.image_url)}" alt="${esc(product.name)}" loading="lazy">`
      : `<div class="saree-cat-img-empty">لا توجد صورة</div>`;

    const priceHtml = cheapestPrice
      ? `<div class="saree-cat-price">${money(cheapestPrice.price_new)} ل.س جديدة</div>
         <div class="saree-cat-old">${oldMoney(cheapestPrice.price_new)} ل.س قديمة</div>
         <div class="saree-cat-stores">متوفر في ${storesCount || ps.length} متجر</div>`
      : `<div class="saree-cat-meta">لا يوجد سعر معتمد حالياً</div>`;

    return `
      <article class="saree-cat-card">
        ${image}
        <div class="saree-cat-body">
          <div class="saree-cat-name">${esc(product.name || 'منتج')}</div>
          <div class="saree-cat-meta">${esc(product.unit || '')}${product.brand ? ' • ' + esc(product.brand) : ''}</div>
          ${priceHtml}
          <div class="saree-cat-actions">
            <button type="button" data-cat-details="${esc(product.id)}">تفاصيل الأسعار</button>
            <button type="button" data-cat-basket="${esc(product.id)}">أضف للسلة</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderCategoryProducts(category, query) {
    const grid = document.getElementById('sareeCatGrid');
    const count = document.getElementById('sareeCatCount');
    if (!grid) return;

    const all = Array.isArray(window.products) ? window.products : [];
    const wanted = category || 'عام';
    const list = all.filter(function (p) {
      return (p.category || 'عام') === wanted && productMatches(p, query || '');
    });

    if (count) count.textContent = `${list.length} منتج${list.length === 1 ? '' : 'ات'} ضمن تصنيف «${wanted}»`;
    grid.innerHTML = list.length
      ? list.map(productCard).join('')
      : '<div class="saree-cat-empty">لا توجد منتجات مطابقة داخل هذا التصنيف.</div>';

    grid.querySelectorAll('[data-cat-details]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = this.getAttribute('data-cat-details');
        if (typeof window.details === 'function') window.details(id);
      });
    });

    grid.querySelectorAll('[data-cat-basket]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = this.getAttribute('data-cat-basket');
        if (typeof window.addBasket === 'function') window.addBasket(id);
      });
    });
  }

  function openCategory(category) {
    const name = (category || 'عام').trim() || 'عام';
    const modal = ensureModal();
    modal.dataset.category = name;
    document.getElementById('sareeCatTitle').textContent = `منتجات تصنيف: ${name}`;
    document.getElementById('sareeCatSearch').value = '';
    renderCategoryProducts(name, '');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { document.getElementById('sareeCatSearch')?.focus(); }, 30);
  }

  function closeCategory() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function categoryFromElement(element) {
    if (!element) return '';
    return (element.textContent || '').replace(/^\s+|\s+$/g, '');
  }

  function markCategoryCards() {
    const cats = document.getElementById('cats');
    if (cats && !cats.dataset.sareeBound) {
      cats.dataset.sareeBound = '1';
      cats.addEventListener('click', function (event) {
        const card = event.target.closest('.card');
        if (!card || !cats.contains(card)) return;
        const pill = card.querySelector('.pill');
        if (!pill) return;
        event.preventDefault();
        openCategory(categoryFromElement(pill));
      });
    }

    const productsGrid = document.getElementById('products');
    if (productsGrid && !productsGrid.dataset.sareeCategoryBound) {
      productsGrid.dataset.sareeCategoryBound = '1';
      productsGrid.addEventListener('click', function (event) {
        const pill = event.target.closest('.pill');
        if (!pill || !productsGrid.contains(pill)) return;
        event.preventDefault();
        event.stopPropagation();
        openCategory(categoryFromElement(pill));
      });
    }

    if (cats) {
      cats.querySelectorAll('.card').forEach(function (card) {
        if (card.querySelector('.pill')) card.classList.add('saree-category-clickable');
      });
    }

    if (productsGrid) {
      productsGrid.querySelectorAll('.card .pill').forEach(function (pill) {
        pill.classList.add('saree-category-clickable');
        pill.title = 'اضغط لعرض كل منتجات هذا التصنيف';
      });
    }
  }

  function start() {
    injectStyle();
    ensureModal();
    markCategoryCards();

    const observer = new MutationObserver(function () {
      markCategoryCards();
    });

    const cats = document.getElementById('cats');
    const productsGrid = document.getElementById('products');
    if (cats) observer.observe(cats, { childList: true, subtree: true });
    if (productsGrid) observer.observe(productsGrid, { childList: true, subtree: true });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeCategory();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.sareeOpenCategoryProducts = openCategory;
  window.sareeCloseCategoryProducts = closeCategory;
})();
