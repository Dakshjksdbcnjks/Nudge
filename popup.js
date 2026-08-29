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

