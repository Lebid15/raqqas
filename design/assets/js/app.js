/* ==========================================================================
   سوق الرقة — منطق واجهة النموذج الأولي
   ملاحظة: هذا للعرض فقط. المنطق الحقيقي سيكون في Next.js + Django REST API.
   ========================================================================== */

/* ---------- أدوات مساعدة ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** تنسيق السعر */
function money(price, currency) {
  if (!price) return 'على السوم';
  const n = price.toLocaleString('en-US');
  return currency === 'USD'
    ? `${n} <span class="cur">$</span>`
    : `${n} <span class="cur">ل.س</span>`;
}

/* ---------- المفضلة (تُحفظ محليًا للتجربة) ---------- */
const Fav = {
  key: 'souq_raqqa_favs',
  all() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; } },
  has(id) { return this.all().includes(id); },
  toggle(id) {
    const list = this.all();
    const i = list.indexOf(id);
    if (i > -1) list.splice(i, 1); else list.push(id);
    localStorage.setItem(this.key, JSON.stringify(list));
    return i === -1; // true = تمت الإضافة
  }
};

/* ---------- بطاقة إعلان ---------- */
function adCard(ad) {
  const on = Fav.has(ad.id) ? 'is-on' : '';
  const badges = [];
  if (ad.featured) badges.push('<span class="badge badge-featured">⭐ مميز</span>');
  badges.push(ad.condition === 'new'
    ? '<span class="badge badge-new">جديد</span>'
    : '<span class="badge badge-used">مستعمل</span>');

  return `
  <article class="ad-card">
    <a class="ad-thumb" href="listing.html?id=${ad.id}">
      <img src="${ad.img}" alt="${ad.title}" loading="lazy">
      <div class="ad-badges">${badges.join('')}</div>
      <span class="ad-media-count">📷 ${ad.photos}${ad.video ? ' · 🎬' : ''}</span>
    </a>
    <button class="ad-fav ${on}" data-fav="${ad.id}" aria-label="حفظ في المفضلة">❤</button>
    <div class="ad-body">
      <a class="ad-title" href="listing.html?id=${ad.id}">${ad.title}</a>
      <div class="ad-price">${money(ad.price, ad.currency)}</div>
      <div class="ad-meta">
        <span>📍 ${ad.area}</span>
        <span>🕐 ${ad.time}</span>
      </div>
    </div>
  </article>`;
}

/** بطاقة أفقية (المفضلة / إعلاناتي) */
function adRow(ad, actionsHtml = '') {
  return `
  <article class="ad-row">
    <a class="ad-row-thumb" href="listing.html?id=${ad.id}">
      <img src="${ad.img}" alt="${ad.title}" loading="lazy">
    </a>
    <div class="ad-row-body">
      <a class="ad-row-title" href="listing.html?id=${ad.id}">${ad.title}</a>
      <div class="ad-price" style="font-size:14px">${money(ad.price, ad.currency)}</div>
      <div class="ad-meta"><span>📍 ${ad.area}</span><span>👁 ${ad.views}</span></div>
      ${actionsHtml ? `<div class="ad-row-actions">${actionsHtml}</div>` : ''}
    </div>
  </article>`;
}

/* ---------- تفعيل أزرار المفضلة ---------- */
function bindFavs(root = document) {
  $$('[data-fav]', root).forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const id = Number(btn.dataset.fav);
      const added = Fav.toggle(id);
      btn.classList.toggle('is-on', added);
      toast(added ? '❤️ تم الحفظ في المفضلة' : 'أُزيل من المفضلة');
    });
  });
}

/* ---------- التنبيه العائم ---------- */
let toastTimer;
function toast(msg) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('is-open'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-open'), 2200);
}

/* ---------- النوافذ السفلية (Bottom Sheets) ---------- */
function openSheet(id) {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  let bd = $('.sheet-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.className = 'sheet-backdrop';
    document.body.appendChild(bd);
    bd.addEventListener('click', closeSheet);
  }
  requestAnimationFrame(() => {
    bd.classList.add('is-open');
    sheet.classList.add('is-open');
  });
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $$('.sheet.is-open').forEach(s => s.classList.remove('is-open'));
  $('.sheet-backdrop')?.classList.remove('is-open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ---------- الشريط السفلي: تحديد الصفحة الحالية ---------- */
function bottomNav(active) {
  const items = [
    { id: 'home',     href: 'index.html',      icon: '🏠', label: 'الرئيسية' },
    { id: 'cats',     href: 'categories.html', icon: '📂', label: 'الأقسام' },
    { id: 'add',      href: 'add.html',        icon: '+',  label: 'أضف إعلان', fab: true },
    { id: 'messages', href: 'messages.html',   icon: '💬', label: 'الرسائل' },
    { id: 'account',  href: 'account.html',    icon: '👤', label: 'حسابي' }
  ];
  return `
  <nav class="bottom-nav">
    <div class="bottom-nav-inner">
      ${items.map(i => i.fab ? `
        <div class="nav-item nav-fab">
          <a class="fab" href="${i.href}" aria-label="أضف إعلان">+</a>
          <span class="fab-label">أضف إعلان</span>
        </div>` : `
        <a class="nav-item ${active === i.id ? 'is-active' : ''}" href="${i.href}">
          <span class="ni-icon">${i.icon}</span>
          <span>${i.label}</span>
        </a>`).join('')}
    </div>
  </nav>`;
}

/* ---------- رجوع آمن (يعود للرئيسية إن لم يوجد سجل) ---------- */
function goBack(fallback = 'index.html') {
  if (history.length > 1) history.back();
  else location.href = fallback;
}

/* ---------- الترويسة الرئيسية ----------
   الخيارات:
   - search : 'link' (افتراضي) | 'input' (حقل بحث حيّ) | false (بدون شريط بحث)
   - value  : القيمة المبدئية لحقل البحث
   - title  : عنوان الصفحة — يظهر في صف داخل الترويسة بدل شريط البحث
   - back   : إظهار زر الرجوع
   - actions: HTML لأزرار إضافية في صف العنوان
*/
function mainHeader(active, opts = {}) {
  const { search = 'link', value = '', title = '', back = false, actions = '' } = opts;
  const links = [
    { id: 'home', href: 'index.html', label: 'الرئيسية' },
    { id: 'cats', href: 'categories.html', label: 'الأقسام' },
    { id: 'search', href: 'search.html', label: 'البحث' },
    { id: 'favorites', href: 'favorites.html', label: 'المفضلة' },
    { id: 'messages', href: 'messages.html', label: 'الرسائل' },
    { id: 'account', href: 'account.html', label: 'حسابي' }
  ];

  const backBtn = back
    ? `<button class="icon-btn is-back" onclick="goBack()" aria-label="رجوع">→</button>`
    : '';

  let row = '';
  if (title) {
    row = `
    <div class="header-bar">
      ${backBtn}
      <h1 class="header-bar-title">${title}</h1>
      ${actions}
    </div>`;
  } else if (search === 'input') {
    row = `
    <div class="header-search is-live">
      ${backBtn}
      <form class="searchbar" role="search" onsubmit="return false">
        <span class="sb-icon">🔎</span>
        <input id="q" type="search" placeholder="ماذا تبحث؟" value="${value}" autocomplete="off">
        <button type="button" id="clear" class="sb-clear" aria-label="مسح البحث">✕</button>
      </form>
    </div>`;
  } else if (search) {
    row = `
    <div class="header-search">
      <a class="searchbar" href="search.html">
        <span class="sb-icon">🔎</span>
        <span>ماذا تبحث؟</span>
      </a>
    </div>`;
  }

  return `
  <header class="header">
    <div class="header-inner">
      <a class="brand" href="index.html">
        <span class="brand-mark">س</span>
        <span class="brand-text">
          <span class="brand-name">سوق الرقة</span>
          <span class="brand-sub">بيع واشترِ داخل مدينتك</span>
        </span>
      </a>
      <nav class="header-nav">
        ${links.map(l => `<a href="${l.href}" class="${active === l.id ? 'is-active' : ''}">${l.label}</a>`).join('')}
      </nav>
      <div class="header-actions">
        <a class="icon-btn" href="messages.html" aria-label="الرسائل">💬<span class="dot">3</span></a>
        <a class="icon-btn" href="account.html#notifications" aria-label="الإشعارات">🔔</a>
      </div>
    </div>
    ${row}
  </header>`;
}

/* ---------- ترويسة داخلية ---------- */
function subHeader(title, actionsHtml = '') {
  return `
  <header class="subheader">
    <div class="subheader-inner">
      <button class="icon-btn" onclick="goBack()" aria-label="رجوع">→</button>
      <h1 class="subheader-title">${title}</h1>
      ${actionsHtml}
    </div>
  </header>`;
}

/* ---------- التبويبات ---------- */
function bindTabs(root = document) {
  $$('.tabs', root).forEach(group => {
    $$('.tab', group).forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab', group).forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const target = tab.dataset.panel;
        if (!target) return;
        $$('[data-panel-content]').forEach(p => p.classList.add('hidden'));
        $(`[data-panel-content="${target}"]`)?.classList.remove('hidden');
      });
    });
  });
}

/* ---------- قراءة معطى من الرابط ---------- */
function param(name, fallback = null) {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}

/* ---------- تبديل الوضع الليلي ---------- */
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('souq_theme', next);
  toast(next === 'dark' ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري');
}
(function initTheme() {
  const saved = localStorage.getItem('souq_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

/* ---------- ضبط ارتفاع الترويسة اللاصقة ----------
   العناصر اللاصقة تحت الترويسة (شريط المرشّحات…) تعتمد على --sticky-top،
   والترويسة الرئيسية أطول من الداخلية وتتغيّر حسب عرض الشاشة. */
function syncStickyTop() {
  const h = $('.header, .subheader');
  document.documentElement.style.setProperty('--sticky-top', (h ? h.offsetHeight : 0) + 'px');
}
window.addEventListener('resize', syncStickyTop);

/* ---------- تهيئة عامة عند تحميل أي صفحة ---------- */
document.addEventListener('DOMContentLoaded', () => {
  syncStickyTop();
  bindFavs();
  bindTabs();
  // إغلاق النوافذ السفلية عبر الأزرار المخصّصة
  $$('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheet));
  $$('[data-open-sheet]').forEach(b =>
    b.addEventListener('click', () => openSheet(b.dataset.openSheet)));
});
