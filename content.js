// Nudge catches purchase intent before merchant click/submit handlers run.
const BUY_INTENT = /\b(buy now|place order|complete purchase|pay now|checkout|submit order|order now|confirm (?:and )?pay|purchase now|continue to payment)\b/i;
const ESCALATION_SECONDS = [12, 30, 60];
const SUPABASE_URL = 'https://mujiunuyzjthcsfghyqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Nm61hwh-rh0ohm46oFEPvQ_OZiXKUzx';
let overlayOpen = false;
let bypassElement = null;
let allowNextSubmit = false;
let lastInterceptAt = 0;

function actionableElement(target) {
  return target instanceof Element ? target.closest('button, a, input[type="submit"], input[type="button"], [role="button"], [onclick]') : null;
}
function intentText(element) {
  if (!element) return '';
  return [element.innerText, element.textContent, element.value, element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('data-testid'), element.getAttribute('name')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
function formHasCardNumber(element) {
  return Boolean(element?.closest?.('form')?.querySelector('[autocomplete="cc-number"]'));
}
function isPurchaseAction(element) {
  return Boolean(element) && (BUY_INTENT.test(intentText(element)) || (formHasCardNumber(element) && /submit|pay|order|continue|review/i.test(intentText(element))));
}
function priceFromText(text) {
  const match = text?.match(/(?:US\$|\$)\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}
function detectPrice() {
  const selectors = ['[data-testid*="total" i]', '[data-test*="total" i]', '[class*="grand-total" i]', '[class*="order-total" i]', '[class*="cart-total" i]', '[id*="grand-total" i]', '[id*="order-total" i]', '.order-summary__total-recap', '#subtotals-marketplace-table'];
  for (const selector of selectors) {
    const value = priceFromText(document.querySelector(selector)?.textContent);
    if (value && value > 0) return value;
  }
  const bodyMatch = document.body?.innerText?.match(/(?:order total|grand total|total due|total)[^\n$]{0,40}\$\s*([\d,]+(?:\.\d{1,2})?)/i);
  return bodyMatch ? Number(bodyMatch[1].replace(/,/g, '')) : null;
}
function readableSite() { return location.hostname.replace(/^www\./, ''); }
function todayKey() { return new Date().toLocaleDateString('en-CA'); }
async function nextDelay() {
  const key = `nudge_intercepts:${readableSite()}:${todayKey()}`;
  const stored = await chrome.storage.local.get(key);
  const count = (Number(stored[key]) || 0) + 1;
  await chrome.storage.local.set({ [key]: count });
  return { count, seconds: ESCALATION_SECONDS[Math.min(count - 1, ESCALATION_SECONDS.length - 1)] };
}
function formatMoney(value) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value); }
async function recordSavings(amount) {
  if (!amount || amount <= 0) return;
  const { nudge_session } = await chrome.storage.local.get('nudge_session');
  if (!nudge_session?.access_token || !nudge_session?.user?.id) return;
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${nudge_session.access_token}`, 'Content-Type': 'application/json' };
  try {
    const event = await fetch(`${SUPABASE_URL}/rest/v1/savings_events`, { method: 'POST', headers, body: JSON.stringify({ user_id: nudge_session.user.id, amount, url: location.href }) });
    if (!event.ok) return;
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_total_saved`, { method: 'POST', headers, body: JSON.stringify({ uid: nudge_session.user.id, amt: amount }) });
    const current = await chrome.storage.local.get('nudge_total_saved');
    await chrome.storage.local.set({ nudge_total_saved: Number(current.nudge_total_saved || 0) + amount });
  } catch (_) { /* A network error must never break the decision flow. */ }
}
function removeOverlay() { document.getElementById('nudge-circuit-breaker')?.remove(); overlayOpen = false; }
async function showOverlay(element) {
  overlayOpen = true;
  const price = detectPrice();
  const { nudge_hourly_wage } = await chrome.storage.local.get('nudge_hourly_wage');
  const wage = Number(nudge_hourly_wage);
  const { count, seconds } = await nextDelay();
  const hours = price && wage > 0 ? price / wage : null;
  const reframe = hours ? `${formatMoney(price)} is ${hours.toFixed(hours < 10 ? 1 : 0)} hours of your work at ${formatMoney(wage)}/hour.` : price ? `${formatMoney(price)} is leaving your account today.` : 'Pause for a moment before committing.';
  const overlay = document.createElement('section');
  overlay.id = 'nudge-circuit-breaker';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `<div class="nudge-card"><div class="nudge-mark">nudge<span>.</span></div><p class="nudge-kicker">PURCHASE PAUSE ${count > 1 ? `· ATTEMPT ${count}` : ''}</p><h2>Give this purchase one conscious moment.</h2><p class="nudge-reframe">${reframe}</p><div class="nudge-countdown"><strong id="nudge-seconds">${seconds}</strong><span>seconds to reflect</span></div><p class="nudge-instruction" id="nudge-instruction">When the timer ends, choose deliberately.</p><div class="nudge-actions"><button type="button" class="nudge-skip" id="nudge-skip">Not worth it</button><button type="button" class="nudge-continue" id="nudge-continue" disabled aria-disabled="true">Continue anyway</button></div>${!wage ? '<p class="nudge-wage-note">Set your hourly wage in the Nudge extension to see work-time cost.</p>' : ''}</div>`;
  document.documentElement.appendChild(overlay);
  const continueButton = overlay.querySelector('#nudge-continue');
  const secondsLabel = overlay.querySelector('#nudge-seconds');
  const instruction = overlay.querySelector('#nudge-instruction');
  let remaining = seconds;
  const timer = setInterval(() => {
    remaining -= 1; secondsLabel.textContent = Math.max(remaining, 0);
    if (remaining > 0) return;
    clearInterval(timer); instruction.textContent = 'One last step: tap “Continue anyway” to confirm your choice.';
    continueButton.disabled = false; continueButton.setAttribute('aria-disabled', 'false');
  }, 1000);
  overlay.querySelector('#nudge-skip').addEventListener('click', async () => { clearInterval(timer); await recordSavings(price); removeOverlay(); });
  continueButton.addEventListener('click', () => {
    if (continueButton.disabled) return;
    clearInterval(timer); bypassElement = element; removeOverlay();
    setTimeout(() => {
      if (element instanceof HTMLFormElement) {
        allowNextSubmit = true;
        element.requestSubmit();
        allowNextSubmit = false;
      } else {
        element?.click();
      }
      bypassElement = null;
    }, 0);
  });
}
function intercept(event, element) {
  if (allowNextSubmit || !element || element === bypassElement || overlayOpen || Date.now() - lastInterceptAt < 500) return;
  lastInterceptAt = Date.now(); event.preventDefault(); event.stopImmediatePropagation(); showOverlay(element);
}
// Capture phase runs before site React, checkout, and 1-click handlers.
document.addEventListener('click', event => { const element = actionableElement(event.target); if (isPurchaseAction(element)) intercept(event, element); }, true);
document.addEventListener('pointerdown', event => { const element = actionableElement(event.target); if (isPurchaseAction(element)) intercept(event, element); }, true);
document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { const element = actionableElement(event.target); if (isPurchaseAction(element)) intercept(event, element); } }, true);
document.addEventListener('submit', event => { const form = event.target; if (!(form instanceof HTMLFormElement)) return; const submitter = event.submitter || form.querySelector('button[type="submit"], input[type="submit"]'); if (formHasCardNumber(submitter || form) || isPurchaseAction(submitter)) intercept(event, submitter || form); }, true);
