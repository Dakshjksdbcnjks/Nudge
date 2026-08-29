const APP_URL = 'https://nudge-53km.vercel.app/';

function openApp(hash) {
  chrome.tabs.create({ url: APP_URL + (hash || '') });
  document.getElementById('opened-msg').style.display = 'block';
  setTimeout(() => window.close(), 600);
}

document.getElementById('btn-calc').addEventListener('click', () => openApp(''));
document.getElementById('btn-debt').addEventListener('click', () => openApp('#quiz'));

async function renderAuthSection() {
  const { nudge_session, nudge_total_saved } = await chrome.storage.local.get([
    'nudge_session',
    'nudge_total_saved'
  ]);
  const el = document.getElementById('auth-section');

  if (nudge_session) {
    const amount = Number(nudge_total_saved || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2
    });
    el.innerHTML = `
      <div class="saved-box">
        <div class="saved-label">TOTAL SAVED</div>
        <div class="saved-amount">$${amount}</div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="signed-out-box">
        Sign in on the <a href="#" id="signin-link">Nudge website</a> to track savings here.
      </div>`;
    document.getElementById('signin-link').addEventListener('click', (e) => {
      e.preventDefault();
      openApp('');
    });
  }
}

renderAuthSection();

async function renderWageSection() {
  const { nudge_hourly_wage, nudge_onboarding_pending } = await chrome.storage.local.get([
    'nudge_hourly_wage', 'nudge_onboarding_pending'
  ]);
  const section = document.getElementById('wage-section');
  const hasWage = Number(nudge_hourly_wage) > 0;
  section.innerHTML = `
    <div class="wage-box">
      <label>${nudge_onboarding_pending || !hasWage ? 'Set your hourly wage for purchase reframes' : 'Hourly wage used by Nudge'}</label>
      <div class="wage-row">
        <input id="nudge-wage-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="e.g. 18" value="${hasWage ? Number(nudge_hourly_wage) : ''}">
        <button id="nudge-save-wage">Save</button>
      </div>
    </div>`;
  document.getElementById('nudge-save-wage').addEventListener('click', async () => {
    const wage = Number(document.getElementById('nudge-wage-input').value);
    if (!Number.isFinite(wage) || wage <= 0) return;
    await chrome.storage.local.set({ nudge_hourly_wage: wage, nudge_onboarding_pending: false });
    renderWageSection();
  });
}

renderWageSection();

