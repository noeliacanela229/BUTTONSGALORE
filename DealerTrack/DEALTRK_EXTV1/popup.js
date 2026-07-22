const statusEl = document.getElementById('status');

// Pre-fill saved username (never the password) for convenience
chrome.storage.local.get('dealertrackCreds', ({ dealertrackCreds }) => {
  if (dealertrackCreds?.username) {
    document.getElementById('username').value = dealertrackCreds.username;
  }
});

document.getElementById('saveCreds').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    statusEl.textContent = 'Enter both username and password to save.';
    return;
  }

  await chrome.storage.local.set({ dealertrackCreds: { username, password } });
  document.getElementById('password').value = '';
  statusEl.textContent = 'Login saved locally on this browser.';
});

document.getElementById('start').addEventListener('click', async () => {
  const { dealertrackCreds } = await chrome.storage.local.get('dealertrackCreds');

  if (!dealertrackCreds) {
    statusEl.textContent = 'Save your Dealertrack login first (see below).';
    return;
  }

  await chrome.storage.local.set({ pendingLogin: true });
  chrome.runtime.sendMessage({ type: 'START_PAYOFF_JOB' });
  statusEl.textContent = 'Opening Dealertrack...';
});
