const NUDGE_APP_URL = 'https://nudge-53km.vercel.app/';

const CHECKOUT_URL_SIGNALS = [
  '/gp/buy', '/gp/cart', '/checkout', '/cart',
  'checkoutnow', 'order-confirm', 'place-order',
  '/buy/', 'payment', 'spc', 'address/select'
];

const CHECKOUT_TITLE_SIGNALS = [
  'checkout', 'cart', 'payment', 'purchase',
  'order', 'buy now', 'place order'
];

function isCheckoutPage() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  return CHECKOUT_URL_SIGNALS.some(s => url.includes(s)) ||
         CHECKOUT_TITLE_SIGNALS.some(s => title.includes(s));
}

// ── PRICE DETECTION ──────────────────────────────────────────
function detectPrice() {
  const selectors = [
    '#subtotals-marketplace-table',   // Amazon order summary
    '#spc-orders',
    '.grand-total-price',
    '[data-testid="grand-total"]',
    '[class*="order-total"]',
    '[class*="grand-total"]',
    '[class*="cart-total"]',
    '[id*="order-total"]',
    '[id*="grand-total"]',
    '.order-summary__total-recap',    // Shopify
    '.checkout-total',
    '[data-automation="Checkout-page-order-total"]'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const match = el.textContent.match(/\$\s*([\d,]+\.?\d{0,2})/);
      if (match) return parseFloat(match[1].replace(',', ''));
    }
  }

  // Fallback: scan page text near the word "total"
  const bodyText = document.body.innerText;
  const m = bodyText.match(/(?:order total|grand total|total)[^\n$]{0,30}\$([\d,]+\.?\d{0,2})/i);
  if (m) return parseFloat(m[1].replace(',', ''));

  return null;
}

// ── ITEM NAME DETECTION ───────────────────────────────────────
function detectItemName() {
  // Amazon product page title
  const amazonTitle = document.getElementById('productTitle');
  if (amazonTitle) return amazonTitle.textContent.trim().split('\n')[0].substring(0, 60);

  // Amazon cart — first item name
  const amazonCartItem = document.querySelector('.sc-product-title, [class*="item-title"]');
  if (amazonCartItem) return amazonCartItem.textContent.trim().substring(0, 60);

  // Amazon checkout page heading (SPC)
  const spcTitle = document.querySelector('#checkout-page-container h1, #spc-product-list .a-truncate-full');
  if (spcTitle) return spcTitle.textContent.trim().substring(0, 60);

  // Shopify — product title
  const shopifyTitle = document.querySelector('.product__title, .cart-item__name, [class*="product-title"]');
  if (shopifyTitle) return shopifyTitle.textContent.trim().substring(0, 60);

  // Generic: og:title or first h1
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const t = ogTitle.getAttribute('content');
    if (t && !t.toLowerCase().includes('checkout')) return t.substring(0, 60);
  }

  return null;
}

// ── PAYMENT METHOD DETECTION ──────────────────────────────────
function detectPaymentMethod() {
  const text = document.body.innerText.toLowerCase();
  if (text.includes('afterpay') || text.includes('klarna') ||
      text.includes('affirm') || text.includes('buy now, pay later') ||
      text.includes('pay in 4') || text.includes('pay later')) {
    return 'bnpl';
  }
  if (text.includes('credit card') || text.includes('visa') ||
      text.includes('mastercard') || text.includes('amex')) {
    return 'credit';
  }
  return null;
}

// ── BANNER ────────────────────────────────────────────────────
function dismissBanner() {
  const banner = document.getElementById('nudge-banner');
  if (!banner) return;
  banner.style.transform = 'translateY(-100%)';
  setTimeout(() => banner.remove(), 400);
}

function injectBanner() {
  if (document.getElementById('nudge-banner')) return;

  const price  = detectPrice();
  const name   = detectItemName();
  const method = detectPaymentMethod();

  // Build display text for banner
  let tagline = 'Know the real cost before you pay';
  if (price && name) {
    tagline = `${name.substring(0, 35)}${name.length > 35 ? '...' : ''} — $${price.toFixed(2)} detected`;
  } else if (price) {
    tagline = `$${price.toFixed(2)} detected — see what this really costs`;
  } else if (name) {
    tagline = `${name.substring(0, 45)} — check the real cost`;
  }

  const banner = document.createElement('div');
  banner.id = 'nudge-banner';
  banner.innerHTML = `
    <div id="nudge-banner-inner">
      <div id="nudge-banner-left">
        <span id="nudge-logo">nudge<span style="color:#D4663A">.</span></span>
        <span id="nudge-tagline">${tagline}</span>
      </div>
      <div id="nudge-banner-right">
        <button id="nudge-open-btn">${price ? 'Autofill & check →' : 'Check real cost →'}</button>
        <button id="nudge-dismiss-btn" title="Dismiss">✕</button>
      </div>
    </div>
  `;

  document.body.prepend(banner);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    banner.style.transform = 'translateY(0)';
  }));

  document.getElementById('nudge-open-btn').addEventListener('click', () => {
    // Build query params with everything we found
    const params = new URLSearchParams();
    if (price)  params.set('price',  price.toString());
    if (name)   params.set('name',   name);
    if (method) params.set('method', method);

    const url = NUDGE_APP_URL + (params.toString() ? '?' + params.toString() : '');
    window.open(url, '_blank', 'width=820,height=700,scrollbars=yes');
    dismissBanner();
  });

  document.getElementById('nudge-dismiss-btn').addEventListener('click', dismissBanner);

  setTimeout(dismissBanner, 15000);
}

// ── INIT ──────────────────────────────────────────────────────
function tryInject() {
  if (isCheckoutPage()) setTimeout(injectBanner, 1000);
}

// Watch for Amazon SPA navigation (no full page reload on checkout)
let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    if (isCheckoutPage()) setTimeout(injectBanner, 1200);
  }
}).observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInject);
} else {
  tryInject();
}
