const SUPABASE_URL = 'https://mujiunuyzjthcsfghyqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Nm61hwh-rh0ohm46oFEPvQ_OZiXKUzx';

// The first popup opened after installation asks for this once. It stays local
// to the extension and powers the work-time reframe on every supported site.
chrome.runtime.onInstalled.addListener(async () => {
  const { nudge_hourly_wage } = await chrome.storage.local.get('nudge_hourly_wage');
  if (nudge_hourly_wage === undefined) {
    await chrome.storage.local.set({ nudge_onboarding_pending: true });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'NUDGE_SET_SESSION') {
    handleSetSession(msg.session);
    return;
  }
  if (msg.type === 'NUDGE_RECORD_SAVINGS') {
    recordSavingsEvent(Number(msg.amount), msg.url || sender.tab?.url || '');
  }
});

async function handleSetSession(session) {
  if (!session) {
    await chrome.storage.local.remove(['nudge_session', 'nudge_total_saved']);
    return;
  }
  await chrome.storage.local.set({ nudge_session: session });
  await refreshTotalSaved(session);
}

async function refreshTotalSaved(session) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=total_saved`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );
    const rows = await res.json();
    const totalSaved = rows?.[0]?.total_saved ?? 0;
    await chrome.storage.local.set({ nudge_total_saved: totalSaved });
  } catch (e) {
    // Offline or token expired — popup just falls back to last cached value.
  }
}

// Records a decline event (called later by content.js once the checkout
// interceptor is built) and keeps the local cached total in sync.
async function recordSavingsEvent(amount, url) {
  const { nudge_session } = await chrome.storage.local.get('nudge_session');
  if (!nudge_session) return;

  await fetch(`${SUPABASE_URL}/rest/v1/savings_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${nudge_session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_id: nudge_session.user.id, amount, url })
  });

  await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_total_saved`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${nudge_session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uid: nudge_session.user.id, amt: amount })
  });

  await refreshTotalSaved(nudge_session);
}
