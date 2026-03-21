const APP_URL = 'https://nudge-53km.vercel.app/';

function openApp(hash) {
  chrome.tabs.create({ url: APP_URL + (hash || '') });
  document.getElementById('opened-msg').style.display = 'block';
  setTimeout(() => window.close(), 600);
}

document.getElementById('btn-calc').addEventListener('click', () => openApp(''));
document.getElementById('btn-debt').addEventListener('click', () => openApp('#quiz'));
