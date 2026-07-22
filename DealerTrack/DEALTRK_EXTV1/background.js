const LOGIN_URL = 'https://signin.coxautoinc.com/?solutionID=DTCOM_prod&clientId=46127dba4e524814b4fb0cdd8b7dec66';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_PAYOFF_JOB') {
    openOrFocusDealertrackTab();
  }

  if (message.type === 'SCRAPE_HAPPYFOX_TICKET') {
    relayHappyFoxScrape().then(sendResponse);
    return true; // keep the message channel open for the async response
  }

  if (message.type === 'BRING_TAB_TO_FRONT' && sender.tab) {
    bringTabToFront(sender.tab.id, sender.tab.windowId);
  }

  if ((message.type === 'QUOTE_READY' || message.type === 'QUOTE_NEEDS_ATTENTION') && sender.tab) {
    const status = message.type === 'QUOTE_READY' ? 'ready' : 'attention';
    relayQuoteStatusToHappyFox(sender.tab, message.ticketUrl, status);
  }

  if (message.type === 'FOCUS_DEALERTRACK_TAB') {
    bringTabToFront(message.tabId, message.windowId);
  }
});

// Instead of forcing the Dealertrack window into view (which kept running
// into platform/policy limits I couldn't reliably work around), this tells
// the HappyFox tab to show a small widget — same idea as the WA DOL fill
// widget. The Dealertrack window itself can stay wherever it landed; you
// only ever have to look at it if you actually click "View."
async function relayQuoteStatusToHappyFox(dealertrackTab, ticketUrl, status) {
  const tabs = await chrome.tabs.query({ url: 'https://rvcs.happyfox.com/staff/ticket/*' });
  const targetTab = tabs.find((t) => t.url === ticketUrl) || tabs[0];

  if (!targetTab) {
    // No HappyFox tab to notify — nowhere to show a widget, so fall back
    // to just bringing Dealertrack forward directly.
    bringTabToFront(dealertrackTab.id, dealertrackTab.windowId);
    return;
  }

  try {
    await chrome.tabs.sendMessage(targetTab.id, {
      type: 'SHOW_QUOTE_WIDGET',
      status,
      dealertrackTabId: dealertrackTab.id,
      dealertrackWindowId: dealertrackTab.windowId
    });
  } catch {
    // HappyFox content script isn't reachable for some reason — fall back.
    bringTabToFront(dealertrackTab.id, dealertrackTab.windowId);
  }
}

async function relayHappyFoxScrape() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://rvcs.happyfox.com/staff/ticket/*' });

    if (tabs.length === 0) {
      return { error: 'No open HappyFox ticket tab found. Open the ticket first.' };
    }

    // If more than one ticket tab happens to be open, this grabs whichever
    // one Chrome returns first — not necessarily the one you're looking at.
    // Flag it if that becomes an issue and we can make this smarter.
    const ticketTab = tabs[0];

    try {
      return await chrome.tabs.sendMessage(ticketTab.id, { type: 'GET_TICKET_FIELDS' });
    } catch (err) {
      // Most common cause: this tab was already open before the extension's
      // content script was (re)loaded, so nothing is listening yet. Inject
      // it now and retry once before giving up.
      try {
        await chrome.scripting.executeScript({
          target: { tabId: ticketTab.id },
          files: ['lender-matcher.js', 'content-happyfox.js']
        });
        return await chrome.tabs.sendMessage(ticketTab.id, { type: 'GET_TICKET_FIELDS' });
      } catch (retryErr) {
        return { error: `Could not read the HappyFox tab: ${retryErr.message}` };
      }
    }
  } catch (outerErr) {
    // Guarantees this always resolves to something (never rejects), so the
    // message channel back to content-dealertrack.js never closes without
    // a response — that's the one way our own code could cause a "listener
    // indicated an asynchronous response... but the message channel closed"
    // error in Chrome.
    return { error: `Unexpected error reading the HappyFox tab: ${outerErr.message}` };
  }
}

async function openOrFocusDealertrackTab() {
  // Creating unfocused first, then minimizing as a separate step — some
  // Chromium versions don't reliably honor state:'minimized' set directly
  // at creation time, especially combined with a url. Splitting it into
  // two calls has proven more consistent.
  const win = await chrome.windows.create({ url: LOGIN_URL, focused: false });
  await chrome.windows.update(win.id, { state: 'minimized' });

  const check = await chrome.windows.get(win.id);
  console.log('[Dealertrack Automator] Background window created, id:', win.id, 'actual state:', check.state);
}

async function bringTabToFront(tabId, windowId) {
  console.log('[Dealertrack Automator] Restoring and focusing the window:', windowId);
  await chrome.windows.update(windowId, { state: 'normal', focused: true });
  await chrome.tabs.update(tabId, { active: true });
}
