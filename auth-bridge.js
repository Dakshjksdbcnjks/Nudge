// Runs only on the Nudge website. Listens for the session broadcast from
// index.html and relays it to the extension's background worker, since
// content scripts and background workers are the only things that can
// write to chrome.storage — the page itself has no access to it.

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  const msg = event.data;
  if (!msg || msg.source !== 'nudge-web' || msg.type !== 'NUDGE_AUTH_SESSION') return;

  chrome.runtime.sendMessage({
    type: 'NUDGE_SET_SESSION',
    session: msg.session // null on sign-out, {access_token, refresh_token, user} on sign-in
  });
});
