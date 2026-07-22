// Runs on the Dealertrack app. Injects a floating button that pulls the VIN
// and lien holder info from an open HappyFox ticket tab and runs the payoff
// quote flow automatically. Also auto-runs on its own, without needing this
// button clicked, if a job was queued from the matching button on the
// HappyFox ticket page itself.
//
// Depends on lender-matcher.js being loaded first (see manifest.json).

injectButton();
resumeIfPending();

function injectButton() {
  if (document.getElementById('dt-auto-payoff-btn')) return; // already injected

  const btn = document.createElement('button');
  btn.id = 'dt-auto-payoff-btn';
  btn.textContent = 'Auto Payoff Quote';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 999999,
    padding: '10px 16px',
    background: '#1c3f94',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  });

  btn.addEventListener('click', startFromButton);
  document.body.appendChild(btn);
}

// Manual click path: read the ticket, validate it, queue it, then hand off
// to the same resume logic a HappyFox-triggered job uses.
async function startFromButton() {
  const btn = document.getElementById('dt-auto-payoff-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Reading ticket...';

  try {
    const ticketData = await fetchTicketDataFromHappyFox();
    const problem = validateTicketData(ticketData);
    if (problem) {
      alert(`Auto Payoff Quote: ${problem}`);
      return;
    }

    await chrome.storage.local.set({ pendingAutoRun: ticketData });
    await resumeIfPending();
  } catch (err) {
    console.error('[Dealertrack Automator] Auto payoff quote failed:', err);
    alert(`Auto Payoff Quote failed: ${err.message}`);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function validateTicketData(ticketData) {
  if (ticketData.error) return ticketData.error;
  if (!ticketData.vin) return 'Could not find a VIN on the open ticket.';
  if (!ticketData.hasLien) return 'This ticket has no lien on file — nothing to request a payoff on.';
  return null;
}

function fetchTicketDataFromHappyFox() {
  return chrome.runtime.sendMessage({ type: 'SCRAPE_HAPPYFOX_TICKET' });
}

// A background tab won't actually show alert()/confirm() until it's
// focused — Chrome defers them rather than interrupting whatever tab
// you're currently looking at. These bring the tab forward first, so a
// mid-flow dialog (e.g. "use this lender anyway?") is something you'll
// actually see in the moment, not something the flow silently stalls on.
function alertUser(message) {
  chrome.runtime.sendMessage({ type: 'BRING_TAB_TO_FRONT' });
  alert(message);
}

function confirmUser(message) {
  chrome.runtime.sendMessage({ type: 'BRING_TAB_TO_FRONT' });
  return confirm(message);
}

// Runs on every Dealertrack page load. If there's a queued job, keeps
// making progress on it. The job carries a "step" so it can pick up
// correctly regardless of which page it lands on — several actions in
// this flow (clicking through to /payoff/, and now submitting the quote)
// turned out to trigger real page loads rather than staying on the same
// page, which kills whatever script was mid-flow. Storing progress and
// resuming fresh on each load sidesteps that entirely.
async function resumeIfPending() {
  const { pendingAutoRun } = await chrome.storage.local.get('pendingAutoRun');
  if (!pendingAutoRun) return;

  try {
    const result = await runPayoffFlow(pendingAutoRun);
    if (result.status === 'done') {
      await chrome.storage.local.remove('pendingAutoRun');
      chrome.runtime.sendMessage({ type: 'BRING_TAB_TO_FRONT' });
    } else {
      // status === 'navigating': save the updated step and let the page
      // we just sent the browser to call resumeIfPending() again itself.
      // Deliberately doesn't bring the tab forward here — only once the
      // flow is actually done does it need your attention.
      await chrome.storage.local.set({ pendingAutoRun: result.nextJob });
    }
  } catch (err) {
    console.error('[Dealertrack Automator] Auto payoff quote failed:', err);
    await chrome.storage.local.remove('pendingAutoRun'); // don't leave a broken job stuck forever
    chrome.runtime.sendMessage({ type: 'BRING_TAB_TO_FRONT' });
    alert(`Auto Payoff Quote failed: ${err.message}`);
  }
}

// job.step tracks progress across page loads: 'fillForm' (default) fills
// out and submits the request; 'confirmAccount' handles the "Is this the
// correct account?" page that submitting sometimes leads to. job.triedModes
// tracks which Customer Information modes have already failed with a
// "Lender Error" (e.g. VIN rejected), so a retry automatically moves on to
// the next one instead of repeating the same failure. Returns
// { status: 'navigating', nextJob } if it just sent the browser to a new
// page (execution below that point never runs — expected), or
// { status: 'done' } once there's nothing more to do.
async function runPayoffFlow(job) {
  const step = job.step || 'fillForm';

  if (step === 'fillForm') {
    // Go straight to the request form. This used to click through "Payoff"
    // then "Obtain a Payoff Quote" first, but those turned out to be real
    // page loads, not in-page navigation — clicking them destroyed the
    // running script before it could do anything past that first click.
    if (window.location.pathname !== '/payoff/') {
      window.location.href = '/payoff/';
      return { status: 'navigating', nextJob: job };
    }

    await waitFor('#id_search_key'); // confirms the request form actually loaded

    // Lender — sets the real <select> directly rather than clicking
    // through Chosen's visual dropdown, so there's nothing to wait for it
    // to render.
    const lenderSelected = await selectLender(job);
    if (!lenderSelected) return { status: 'done' }; // selectLender already alerted why

    // Some lenders show an extra required "Product" choice (Retail/Balloon
    // vs Lease) right after the lender is picked. Not every lender shows
    // this, so it's fine if it never appears.
    await selectProductIfPresent();

    // Customer Information is actually a mode selector (VIN, Account
    // Number, or SSN), not a list of customers — and not every lender
    // offers every mode (Huntington National Bank, for example, only
    // offers Account Number or SSN, no VIN at all). This picks whichever
    // mode is actually available and hasn't already failed, preferring
    // VIN, falling back to Account Number, then SSN.
    const modeUsed = await selectBestCustomerInfoMode(job);
    if (!modeUsed) return { status: 'done' }; // already alerted why

    const entered = await enterCustomerInfoValue(modeUsed, job);
    if (!entered) return { status: 'done' };

    // Consent checkbox
    const consent = await waitFor('#id_customer_consent');
    if (!consent.checked) consent.click();

    // Submit. This might cause a real page navigation to a confirmation
    // page, or it might swap content in place on the same page — save the
    // next step to storage right now, before waiting, so a navigation
    // that kills this script mid-wait still leaves something for the
    // freshly-loaded page to resume. If nothing navigates and this script
    // survives the wait (an in-place update), it cleans this back up
    // itself below rather than leaving a stale step sitting around.
    const quoteBtn = await waitFor('#id_get_payoff');
    quoteBtn.click();

    await chrome.storage.local.set({ pendingAutoRun: { ...job, step: 'confirmAccount', modeUsed } });

    await clickYesButtonIfPresent();

    return finishOrRetry(job, modeUsed);
  }

  if (step === 'confirmAccount') {
    // Not every lender shows this confirmation — this checks briefly and
    // does nothing if it's not there.
    await clickYesButtonIfPresent();
    return finishOrRetry(job, job.modeUsed);
  }

  return { status: 'done' };
}

// Checks for a "Lender Error" (e.g. "Account not eligible for quote" —
// what a rejected VIN lookup actually looks like) and, if found, retries
// automatically with the next available Customer Information mode instead
// of just giving up. Only brings the tab forward once there's truly
// nothing more to try, or it actually succeeded.
// Checks for a "Lender Error" (e.g. "Account not eligible for quote" —
// what a rejected VIN lookup actually looks like) and, if found, retries
// automatically with the next available Customer Information mode instead
// of just giving up. Once there's truly nothing more to try automatically
// (success or exhausted), signals HappyFox to show a widget rather than
// trying to force this window into view directly.
async function finishOrRetry(job, modeUsed) {
  const lenderError = await checkForLenderError();

  if (lenderError) {
    console.log(`[Dealertrack Automator] ${lenderError} — retrying with a different Customer Information mode.`);
    const triedModes = [...(job.triedModes || []), modeUsed];
    const retryJob = { ...job, step: 'fillForm', triedModes };
    await chrome.storage.local.set({ pendingAutoRun: retryJob });
    window.location.href = '/payoff/';
    return { status: 'navigating', nextJob: retryJob };
  }

  await chrome.storage.local.remove('pendingAutoRun');
  chrome.runtime.sendMessage({ type: 'QUOTE_READY', ticketUrl: job.ticketUrl });
  return { status: 'done' };
}

// Detects a lender-rejection banner, whatever its exact wording — we've
// now seen two completely different messages for this ("Lender Error:
// Account not eligible for quote" and "Technical Difficulties. Please
// contact..."), so matching specific phrases doesn't scale. Both used the
// same visual pattern instead (a red/danger-styled alert box), which is
// what this actually checks for, with the known phrases as a fast-path
// backup. If a future error doesn't use either signal, the real HTML of
// it would let me tighten this up further.
async function checkForLenderError() {
  await new Promise((resolve) => setTimeout(resolve, 800)); // let any error banner finish rendering

  const KNOWN_PATTERNS = [/Lender Error:[^\n]*/, /Technical Difficulties[^\n]*/];
  for (const pattern of KNOWN_PATTERNS) {
    const match = document.body.textContent.match(pattern);
    if (match) return match[0].trim();
  }

  const candidates = document.querySelectorAll(
    '.alert, .alert-danger, .error, [class*="danger"], [class*="error"]'
  );
  for (const el of candidates) {
    const text = el.textContent.trim();
    if (el.offsetParent !== null && text.length > 0 && text.length < 300) {
      return text;
    }
  }

  return null;
}

// Handles two things that plain waitFor()+click() doesn't: (1) there might
// be more than one element with this id on the page (only one real, valid
// HTML or not) — this only clicks one that's actually visible, so it can't
// accidentally hit a hidden duplicate/template copy. (2) a bare .click()
// only fires a 'click' event; some page JS listens for a fuller mouse
// sequence instead, so this fires mousedown/mouseup too for a closer
// approximation of a real click. Logs what it finds either way, so if this
// still doesn't work, the console will show exactly why instead of nothing.
async function clickYesButtonIfPresent() {
  const start = Date.now();
  const timeout = 6000;

  while (Date.now() - start < timeout) {
    const matches = [...document.querySelectorAll('#id_yes_button')];
    const visible = matches.filter((el) => el.offsetParent !== null);

    if (matches.length > 0) {
      console.log(`[Dealertrack Automator] #id_yes_button: ${matches.length} in DOM, ${visible.length} visible.`);
    }

    if (visible.length > 0) {
      const btn = visible[0];
      console.log('[Dealertrack Automator] Clicking the Yes confirmation button.', btn);
      simulateRealClick(btn);

      // If this click just swaps content in place (rather than a fresh
      // page load), give it a moment to actually finish rendering the
      // real quote before the flow declares itself done — otherwise the
      // tab could come to the front showing a half-updated page instead
      // of the finished result.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log('[Dealertrack Automator] No visible #id_yes_button found within timeout — no confirmation for this submission.');
  return false;
}

function simulateRealClick(el) {
  const rect = el.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
}

// Some lenders require an extra "Product" choice (Retail/Balloon vs
// Lease) that only appears after the lender is selected. Always picks
// Retail or Balloon when it shows up; does nothing if it never appears.
async function selectProductIfPresent() {
  try {
    const retailRadio = await waitFor('#id_product_1', 2000);
    if (!retailRadio.checked) {
      retailRadio.click();
    }
  } catch {
    // no Product field for this lender — nothing to do
  }
}

async function selectLender(ticketData) {
  const selectEl = await waitForPopulatedSelectByLabel('Lenders');
  const optionEls = [...selectEl.options].filter(
    (o) => o.value && o.textContent.trim().toLowerCase() !== 'select'
  );
  const optionTexts = optionEls.map((o) => o.textContent.trim());

  // Cache the full lender list so the HappyFox side can check availability
  // later without needing a live Dealertrack tab open.
  cacheLenderList(optionTexts);

  const { match, confidence } = findLenderMatch(optionTexts, ticketData.lenderName);

  if (confidence === 'none') {
    alertUser(`Auto Payoff Quote: could not find anything close to "${ticketData.lenderName}" in Dealertrack. Select it manually if this ticket needs a payoff quote.`);
    return false;
  }

  if (confidence === 'low') {
    const confirmed = confirmUser(`Auto Payoff Quote: "${ticketData.lenderName}" isn't an exact match, but the closest option in Dealertrack is "${match}". Use it?`);
    if (!confirmed) return false;
  }

  const matchOption = optionEls.find((o) => o.textContent.trim() === match);
  setSelectValue(selectEl, matchOption.value);
  console.log(`[Dealertrack Automator] Lender select value is now: "${selectEl.value}" (jQuery available: ${!!window.jQuery})`);
  return true;
}

function cacheLenderList(list) {
  if (list.length === 0) return; // never trust/store an empty result — always a transient failure
  chrome.storage.local.set({
    dealertrackLenderCache: { list, updatedAt: Date.now() }
  });
}

// Not every lender offers every Customer Information mode. Checks what's
// actually available and picks the best one in priority order (VIN first
// since it needs no extra parsing, then Account Number, then SSN), rather
// than assuming VIN is always there and giving up if it isn't.
const MODE_PRIORITY = ['Vehicle Identification Number', 'Account Number', 'Last Name / Account Number', 'Social Security Number'];

async function selectBestCustomerInfoMode(job) {
  const selectEl = await waitForPopulatedSelect('#id_search_key');
  const optionEls = [...selectEl.options].filter(
    (o) => o.value && o.textContent.trim().toLowerCase() !== 'select'
  );
  const availableModes = optionEls.map((o) => o.textContent.trim());
  const triedModes = job.triedModes || [];

  const modeToUse = MODE_PRIORITY.find((m) => availableModes.includes(m) && !triedModes.includes(m));

  if (!modeToUse) {
    console.warn('[Dealertrack Automator] #id_search_key options were:', availableModes, 'already tried:', triedModes);
    alertUser(
      triedModes.length > 0
        ? `Auto Payoff Quote: tried ${triedModes.join(', ')} and none worked (Lender Error each time). No other modes are available for this lender.`
        : `Auto Payoff Quote: none of the expected Customer Information modes are available. Real options are: ${availableModes.join(', ') || '(none)'}`
    );
    return null;
  }

  const match = optionEls.find((o) => o.textContent.trim() === modeToUse);
  setSelectValue(selectEl, match.value);
  return modeToUse;
}

// Fills whichever field(s) actually apply for the mode that got selected.
async function enterCustomerInfoValue(modeUsed, job) {
  if (modeUsed === 'Vehicle Identification Number') {
    return enterVin(job.vin);
  }

  if (modeUsed === 'Account Number') {
    return enterAccountNumber(job.lenderAccountNumber, job.lastFourSSN);
  }

  if (modeUsed === 'Last Name / Account Number') {
    return enterLastNameAccountNumber(job.lenderAccountNumber, job.ownerName);
  }

  if (modeUsed === 'Social Security Number') {
    // Don't have this field's real markup yet — stop cleanly rather than
    // guess at a field tied to SSN. Lender and mode are already selected,
    // so this just needs the SSN typed in manually to finish.
    alertUser('Auto Payoff Quote: this lender only offers Social Security Number lookup, and I don\'t have that field mapped yet. The lender and mode are already selected — enter the SSN manually to finish.');
    return false;
  }

  return false;
}

// Sets a <select>'s value directly and fires the events needed for both
// the page's own logic and the Chosen widget's visual display to notice —
// no clicking through the dropdown UI, so there's nothing to wait for.
function setSelectValue(selectEl, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  nativeSetter.call(selectEl, value);
  selectEl.dispatchEvent(new Event('change', { bubbles: true }));

  // Chosen won't visually update on its own from a programmatic change —
  // it needs to be told directly, if it's the jQuery plugin we've seen
  // elsewhere on this page.
  if (window.jQuery) {
    window.jQuery(selectEl).trigger('chosen:updated');
  }
}

async function enterVin(vin) {
  const vinInput = await waitFor('input[placeholder="Enter Full Vehicle Number"]');
  fillTextInput(vinInput, vin);
  return true;
}

async function enterAccountNumber(accountNumber, lastFourSSN) {
  const acctInput = await waitFor('#id_account_number_retail');
  fillTextInput(acctInput, accountNumber);

  // Some lenders also show a companion "last 4 of SSN" field alongside
  // Account Number — fill it in if it's there, skip it if it's not.
  try {
    const ssnInput = await waitFor('#id_ssn_last_4', 2000);
    if (lastFourSSN) fillTextInput(ssnInput, lastFourSSN);
  } catch {
    // no companion SSN field for this lender — nothing more to do
  }

  return true;
}

// "Last Name / Account Number" mode — a different mode than plain "Account
// Number", asking for just the last 4 of the account number plus the
// owner's last name (ZIP is optional, left blank). These fields don't have
// distinguishing placeholder text like VIN/Account Number did, so this
// finds them by walking from their visible labels instead of guessing ids.
async function enterLastNameAccountNumber(fullAccountNumber, ownerName) {
  const acctInput = await waitForInputByLabel('Account Number');
  const last4 = onlyDigits(fullAccountNumber).slice(-4);
  fillTextInput(acctInput, last4);

  const lastNameInput = await waitForInputByLabel('Last Name');
  fillTextInput(lastNameInput, extractLastName(ownerName));

  // ZIP Code is optional — left blank on purpose.
  return true;
}

function onlyDigits(s) {
  return (s || '').replace(/\D/g, '');
}

function extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function waitForInputByLabel(labelText, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const find = () => {
      const label = [...document.querySelectorAll('label')]
        .find((l) => l.textContent.trim() === labelText);
      if (!label) return null;
      const row = label.closest('tr, .form-group, .control-group, .row') || label.parentElement;
      return row?.querySelector('input') || null;
    };

    const existing = find();
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = find();
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for the "${labelText}" field`));
    }, timeout);
  });
}

function fillTextInput(el, value) {
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

// Waits for a <select> to actually contain real <option>s, not just for
// the element itself to exist — some of these selects get their options
// added slightly after the element first appears in the DOM.
function waitForPopulatedSelect(selector, minOptions = 2, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const el = document.querySelector(selector);
      return el && el.options.length >= minOptions ? el : null;
    };

    const existing = check();
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for ${selector} to populate with options`));
    }, timeout);
  });
}

// Same idea, but finds the <select> by walking from its visible label text
// instead of assuming an id — safer when the real id was never directly
// confirmed (unlike #id_search_key, which was).
function waitForPopulatedSelectByLabel(labelText, minOptions = 2, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const label = [...document.querySelectorAll('label')]
        .find((l) => l.textContent.trim() === labelText);
      if (!label) return null;
      const row = label.closest('tr, .form-group, .control-group, .row') || label.parentElement;
      const select = row?.querySelector('select');
      return select && select.options.length >= minOptions ? select : null;
    };

    const existing = check();
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for the "${labelText}" field to populate`));
    }, timeout);
  });
}
