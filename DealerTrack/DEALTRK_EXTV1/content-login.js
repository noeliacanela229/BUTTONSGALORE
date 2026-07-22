// Runs on signin.coxautoinc.com. Only acts if a job is queued from the popup,
// so it never interferes with a normal manual login.

(async function () {
  const { pendingLogin, dealertrackCreds } = await chrome.storage.local.get([
    'pendingLogin',
    'dealertrackCreds'
  ]);

  if (!pendingLogin) return;

  if (!dealertrackCreds) {
    console.warn('[Dealertrack Automator] No saved login — open the extension popup and save it first.');
    return;
  }

  try {
    const usernameField = await waitFor('input[name="username"], input[type="text"]:not([type="hidden"])');
    fillField(usernameField, dealertrackCreds.username);

    const nextBtn = await waitFor('#signIn');
    nextBtn.click();

    // The password field replaces/appears next to the username field in
    // the same SPA — no page navigation happens here.
    const passwordField = await waitFor('#password');
    fillField(passwordField, dealertrackCreds.password);

    const signInBtn = await waitFor('#signIn');
    signInBtn.click();

    await chrome.storage.local.remove('pendingLogin');
  } catch (err) {
    console.error('[Dealertrack Automator] Login step failed:', err);
  }
})();

function fillField(el, value) {
  // Use the native setter so React/Angular-style forms register the change
  // (plain el.value = ... often gets silently ignored by these frameworks).
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function waitFor(selector, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for ${selector}`));
    }, timeout);
  });
}
