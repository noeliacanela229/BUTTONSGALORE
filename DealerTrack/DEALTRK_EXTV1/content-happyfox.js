// Runs on HappyFox ticket pages. Checks the ticket's lien holder against a
// cached copy of Dealertrack's lender list, and — only if it's confidently
// available — shows a button right on the ticket to kick off the whole
// flow. The cache is seeded by the Dealertrack side each time its Lenders
// dropdown is opened; until that's happened at least once, nothing will
// show here.
//
// Depends on lender-matcher.js being loaded first (see manifest.json).
// HappyFox's ticket view is an Ember SPA, so this watches for DOM changes
// rather than assuming a fresh page load per ticket.

const FIELD_IDS = {
  vin: '90',                  // "VIN (SF)"
  hasLien: '173',             // "Is there a lien on your RV?"
  lenderName: '180',          // "Lien Holder Name"
  lenderAccountNumber: '181', // "Lien Holder Account #"
  lastFourSSN: '182',         // "Last Four SS#"
  ownerName: '183'            // "Owner Legal First and Last Name"
};

const FIELD_LABELS = {
  vin: 'VIN (SF)',
  hasLien: 'Is there a lien on your RV?',
  lenderName: 'Lien Holder Name',
  lenderAccountNumber: 'Lien Holder Account #',
  lastFourSSN: 'Last Four SS#',
  ownerName: 'Owner Legal First and Last Name'
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TICKET_FIELDS') {
    sendResponse(scrapeTicketFields());
  }

  if (message.type === 'SHOW_QUOTE_WIDGET') {
    showQuoteReadyWidget(message.status, message.dealertrackTabId, message.dealertrackWindowId);
  }
});

// Ember re-renders the ticket panel in place (no full page reload) when
// switching tickets or when fields load asynchronously, so watch for
// changes rather than checking once at script-injection time.
const debouncedCheck = debounce(checkAndInjectIndicator, 500);
new MutationObserver(debouncedCheck).observe(document.body, { childList: true, subtree: true });
checkAndInjectIndicator();

async function checkAndInjectIndicator() {
  const fields = scrapeTicketFields();

  if (!fields.hasLien || !fields.lenderName) {
    console.log('[Dealertrack Automator] No lien or no lender name on this ticket — button hidden.', fields);
    document.getElementById('hf-dealertrack-btn')?.remove();
    return;
  }

  let dealertrackLenderCache;
  try {
    ({ dealertrackLenderCache } = await chrome.storage.local.get('dealertrackLenderCache'));
  } catch (err) {
    // "Extension context invalidated" happens when this tab was already
    // open before the extension was last reloaded — this specific tab's
    // copy of the script is orphaned until the tab itself is refreshed.
    // Nothing to do here but wait for that refresh, so fail quietly.
    if (err.message?.includes('Extension context invalidated')) return;
    throw err;
  }

  if (!dealertrackLenderCache?.list?.length) {
    console.log('[Dealertrack Automator] Lender cache is empty or missing — button hidden. Run a payoff quote from a HappyFox ticket once to seed it.');
    return;
  }

  const { match, confidence } = findLenderMatch(dealertrackLenderCache.list, fields.lenderName);
  console.log(`[Dealertrack Automator] Lender "${fields.lenderName}" -> match: "${match}", confidence: ${confidence} (checked against ${dealertrackLenderCache.list.length} cached lenders)`);

  if (confidence === 'none') {
    document.getElementById('hf-dealertrack-btn')?.remove();
    return;
  }

  injectIndicator(fields, confidence);
}

function injectIndicator(fields, confidence) {
  const existing = document.getElementById('hf-dealertrack-btn');
  if (existing) return; // already there

  const btn = document.createElement('button');
  btn.id = 'hf-dealertrack-btn';
  btn.textContent = confidence === 'high'
    ? 'Get Payoff Quote in Dealertrack'
    : 'Get Payoff Quote in Dealertrack (lender needs confirming)';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 999999,
    padding: '10px 16px',
    background: confidence === 'high' ? '#1c3f94' : '#b06a00',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  });

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Opening Dealertrack...';

    await chrome.storage.local.set({
      pendingLogin: true,
      pendingAutoRun: { ...fields, queuedAt: Date.now() }
    });
    chrome.runtime.sendMessage({ type: 'START_PAYOFF_JOB' });

    // Reset after a few seconds in case the Dealertrack tab doesn't come to
    // the front automatically for some reason.
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = confidence === 'high'
        ? 'Get Payoff Quote in Dealertrack'
        : 'Get Payoff Quote in Dealertrack (lender needs confirming)';
    }, 5000);
  });

  document.body.appendChild(btn);
}

// Shows a small "quote ready" (or "needs attention") widget once the
// Dealertrack side signals it's done — same idea as the WA DOL fill
// widget: a floating box on the page itself, rather than trying to force
// a browser window into view. Clicking "View" is what actually brings the
// Dealertrack window forward — being a real click rather than a
// programmatic focus request, this is also more likely to actually work
// given how locked-down this browser's window management is.
function showQuoteReadyWidget(status, dealertrackTabId, dealertrackWindowId) {
  document.getElementById('hf-quote-ready-widget')?.remove();

  const isReady = status === 'ready';
  const accentColor = isReady ? '#1c3f94' : '#b06a00';

  const box = document.createElement('div');
  box.id = 'hf-quote-ready-widget';
  Object.assign(box.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 999999,
    background: 'white',
    border: `2px solid ${accentColor}`,
    borderRadius: '8px',
    padding: '12px 32px 12px 14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '260px'
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '6px',
    right: '8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#999'
  });
  closeBtn.addEventListener('click', () => box.remove());
  box.style.position = 'fixed'; // keep for the absolute-positioned close button

  const label = document.createElement('div');
  label.textContent = isReady
    ? 'Payoff quote ready'
    : 'Needs your attention in Dealertrack';
  label.style.fontWeight = '600';

  const viewBtn = document.createElement('button');
  viewBtn.textContent = 'View';
  Object.assign(viewBtn.style, {
    background: accentColor,
    color: 'white',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '4px',
    cursor: 'pointer'
  });
  viewBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'FOCUS_DEALERTRACK_TAB',
      tabId: dealertrackTabId,
      windowId: dealertrackWindowId
    });
    box.remove();
  });

  box.appendChild(closeBtn);
  box.appendChild(label);
  box.appendChild(viewBtn);
  document.body.appendChild(box);
}

function scrapeTicketFields() {
  const vin = readField('vin');
  const hasLienRaw = readField('hasLien');

  return {
    vin,
    hasLien: (hasLienRaw || '').trim().toLowerCase() === 'yes',
    lenderName: readField('lenderName'),
    lenderAccountNumber: readField('lenderAccountNumber'),
    lastFourSSN: readField('lastFourSSN'),
    ownerName: readField('ownerName'),
    ticketUrl: window.location.href
  };
}

function readField(key) {
  const byId = document.querySelector(`[data-test-id="custom-field-value-${FIELD_IDS[key]}"]`);
  if (byId) return byId.textContent.trim();

  const labels = document.querySelectorAll('.hf-custom-field_label');
  for (const label of labels) {
    if (label.textContent.trim() === FIELD_LABELS[key]) {
      const container = label.closest('.hf-custom-field');
      const value = container?.querySelector('.hf-custom-field_value');
      if (value) return value.textContent.trim();
    }
  }

  return null;
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
