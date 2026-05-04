/**
 * Live Demo Robot — drives the real <App isDemo /> mounted in an iframe.
 *
 * The robot lives in the parent (landing page). It reaches into the
 * same-origin iframe's contentDocument to find real DOM nodes, animates
 * a cursor overlay to those coords, then performs a real synthetic
 * click / type that React's controlled inputs will accept.
 */

/* ---------- helpers ---------- */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function $(doc, selector) {
  if (!doc) return null;
  try { return doc.querySelector(selector); } catch { return null; }
}

export function $all(doc, selector) {
  if (!doc) return [];
  try { return Array.from(doc.querySelectorAll(selector)); } catch { return []; }
}

/** Find a button or clickable element whose visible text contains `text`. */
export function findByText(doc, text) {
  if (!doc || !text) return null;
  const t = String(text).toLowerCase();
  const candidates = $all(doc, 'button, [role="button"], [role="tab"], a');
  // Prefer the shortest match (more specific).
  const matches = candidates.filter((el) => {
    if (el.disabled) return false;
    if (el.offsetParent === null && el.getClientRects().length === 0) return false;
    return (el.textContent || '').trim().toLowerCase().includes(t);
  });
  matches.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
  return matches[0] || null;
}

/** Resolve when predicate() returns truthy or timeout (ms) elapses. */
export function waitFor(predicate, { timeout = 5000, interval = 80 } = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      let val;
      try { val = predicate(); } catch { val = null; }
      if (val) return resolve(val);
      if (performance.now() - start > timeout) return resolve(null);
      setTimeout(tick, interval);
    };
    tick();
  });
}

/** Type into a React-controlled input using the native value setter trick. */
export function reactSetValue(input, value, win) {
  if (!input) return;
  const W = win || window;
  const proto = input.tagName === 'TEXTAREA'
    ? W.HTMLTextAreaElement.prototype
    : W.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Get the rect of an element relative to the iframe's viewport. */
export function getRect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

/* ---------- selectors ---------- */
/* Selectors prefer placeholder / role / text — no component edits required. */

const POS_SEARCH = 'input[placeholder*="Scan barcode" i], input[placeholder*="search for a product" i]';
const INVENTORY_SEARCH = 'input[placeholder*="Search products" i]';
const CUSTOMER_SEARCH = 'input[placeholder*="Search by name" i]';

/* ---------- scene definitions ---------- */
/*
  Step kinds (interpreted by LiveDemoPlayer.runScene):
    { kind: 'wait', ms }
    { kind: 'caption', text }
    { kind: 'click', selector }                     // simple selector
    { kind: 'clickByText', text }                   // text inside button/tab/link
    { kind: 'clickFn', fn: (doc) => HTMLElement }   // escape hatch (popovers, table rows)
    { kind: 'type', selector, text, perChar = 80 }  // synthetic typing
    { kind: 'pressKey', key }                       // Escape / Enter on document.activeElement
*/

export const SCENES = [
  {
    id: 'pos',
    title: 'Point of Sale',
    subtitle: 'Ring up a customer in seconds',
    tab: 'pos',
    duration: 30000,
    steps: [
      { kind: 'caption', text: 'Welcome to Point of Sale — your cash register.' },
      { kind: 'wait', ms: 700 },
      { kind: 'caption', text: 'Skip the lookup with a guest sale.' },
      { kind: 'clickByText', text: 'Continue as Guest' },
      { kind: 'wait', ms: 700 },
      { kind: 'caption', text: 'Type to search any product…' },
      { kind: 'type', selector: POS_SEARCH, text: 'Espresso', perChar: 80 },
      { kind: 'wait', ms: 600 },
      { kind: 'caption', text: 'One tap adds it to the cart.' },
      { kind: 'clickFn', fn: (doc) => {
        const popover = doc.querySelector('[data-radix-popper-content-wrapper]')
          || doc.querySelector('[role="listbox"]');
        if (popover) return popover.querySelector('[role="option"], [class*="cursor-pointer"], button');
        return doc.querySelector('[role="option"]');
      } },
      { kind: 'wait', ms: 900 },
      { kind: 'caption', text: 'Adding another item…' },
      { kind: 'type', selector: POS_SEARCH, text: 'Croissant', perChar: 80 },
      { kind: 'wait', ms: 600 },
      { kind: 'clickFn', fn: (doc) => {
        const popover = doc.querySelector('[data-radix-popper-content-wrapper]')
          || doc.querySelector('[role="listbox"]');
        if (popover) return popover.querySelector('[role="option"], [class*="cursor-pointer"], button');
        return doc.querySelector('[role="option"]');
      } },
      { kind: 'wait', ms: 1000 },
      { kind: 'caption', text: 'Heading to checkout to charge the customer.' },
      { kind: 'clickByText', text: 'Checkout' },
      { kind: 'wait', ms: 1300 },
      { kind: 'caption', text: 'Cash, card, or swipe — every payment method, built in.' },
      { kind: 'wait', ms: 1100 },
      { kind: 'caption', text: 'Quick-cash buttons fill the tendered amount in one tap.' },
      { kind: 'clickFn', fn: (doc) => {
        const dialog = doc.querySelector('[role="dialog"]') || doc;
        const buttons = Array.from(dialog.querySelectorAll('button'));
        return buttons.find((b) => /^\$\d/.test((b.textContent || '').trim()));
      } },
      { kind: 'wait', ms: 800 },
      { kind: 'caption', text: 'Finalizing the sale…' },
      { kind: 'clickByText', text: 'Finalize Cash Payment' },
      { kind: 'wait', ms: 1300 },
      { kind: 'caption', text: 'Sale complete — receipt is ready to print.' },
      { kind: 'wait', ms: 2200 },
      { kind: 'caption', text: 'One tap and the next customer is up.' },
      { kind: 'clickByText', text: 'Start New Sale' },
      { kind: 'wait', ms: 800 },
    ],
  },

  {
    id: 'inventory',
    title: 'Inventory Management',
    subtitle: 'Live stock counts, bulk editing, full control',
    tab: 'inventory',
    duration: 18000,
    steps: [
      { kind: 'caption', text: 'Inventory — every product, real-time stock.' },
      { kind: 'wait', ms: 1100 },
      { kind: 'caption', text: 'Search by name, barcode, or SKU.' },
      { kind: 'type', selector: INVENTORY_SEARCH, text: 'Cold', perChar: 100 },
      { kind: 'wait', ms: 1000 },
      { kind: 'caption', text: 'Click a product to edit its details.' },
      { kind: 'clickFn', fn: (doc) => doc.querySelector('tbody tr') },
      { kind: 'wait', ms: 1800 },
      { kind: 'pressKey', key: 'Escape' },
      { kind: 'wait', ms: 500 },
      { kind: 'type', selector: INVENTORY_SEARCH, text: '', perChar: 0 },
      { kind: 'wait', ms: 400 },
      { kind: 'caption', text: 'Updating many items? Switch to Excel mode.' },
      { kind: 'clickByText', text: 'Excel Mode' },
      { kind: 'wait', ms: 1600 },
      { kind: 'caption', text: 'Edit any cell — like a spreadsheet, but live.' },
      { kind: 'wait', ms: 2200 },
      { kind: 'clickByText', text: 'Exit Excel Mode' },
      { kind: 'wait', ms: 800 },
    ],
  },

  {
    id: 'customers',
    title: 'Customer Management',
    subtitle: 'Profiles, purchase history, loyalty',
    tab: 'customers',
    duration: 11000,
    steps: [
      { kind: 'caption', text: 'Customers — find anyone in seconds.' },
      { kind: 'wait', ms: 800 },
      { kind: 'caption', text: 'Search by name, phone, or email.' },
      { kind: 'type', selector: CUSTOMER_SEARCH, text: 'John', perChar: 100 },
      { kind: 'wait', ms: 1000 },
      { kind: 'caption', text: 'Open the profile to see full purchase history.' },
      { kind: 'clickFn', fn: (doc) => doc.querySelector('tbody tr') || doc.querySelector('[class*="cursor-pointer"]') },
      { kind: 'wait', ms: 3500 },
      { kind: 'pressKey', key: 'Escape' },
      { kind: 'wait', ms: 600 },
    ],
  },

  {
    id: 'pbx',
    title: 'Built-in Phone System',
    subtitle: 'Call logs, voicemail, IVR, business hours, extensions',
    tab: 'pbx',
    duration: 24000,
    steps: [
      { kind: 'caption', text: 'A full PBX — phones built right into your POS.' },
      { kind: 'wait', ms: 1600 },
      { kind: 'caption', text: 'Dashboard shows total calls, inbound/outbound, missed and average talk time.' },
      { kind: 'wait', ms: 2200 },
      { kind: 'caption', text: 'Every call, logged automatically with caller, direction and duration.' },
      { kind: 'clickByText', text: 'Call logs' },
      { kind: 'wait', ms: 2400 },
      { kind: 'caption', text: 'Listen to voicemails right inside the console.' },
      { kind: 'clickByText', text: 'Voicemails' },
      { kind: 'wait', ms: 2400 },
      { kind: 'caption', text: 'Build an IVR auto-attendant — press 1 for sales, 2 for support.' },
      { kind: 'clickByText', text: 'IVR / Auto attendant' },
      { kind: 'wait', ms: 2400 },
      { kind: 'caption', text: 'Set business hours — calls route differently after-hours.' },
      { kind: 'clickByText', text: 'Business hours' },
      { kind: 'wait', ms: 2200 },
      { kind: 'caption', text: 'Manage extensions for every team member.' },
      { kind: 'clickByText', text: 'Extensions' },
      { kind: 'wait', ms: 2200 },
      { kind: 'clickByText', text: 'Dashboard' },
      { kind: 'wait', ms: 900 },
    ],
  },

  {
    id: 'reports',
    title: 'Reports & Invoices',
    subtitle: 'Filter sales, preview invoices, export anywhere',
    tab: 'reports',
    duration: 16000,
    steps: [
      { kind: 'caption', text: 'Reports — slice your data any way you want.' },
      { kind: 'wait', ms: 1100 },
      { kind: 'caption', text: 'Show only today\'s sales…' },
      { kind: 'clickByText', text: 'Today' },
      { kind: 'wait', ms: 1400 },
      { kind: 'caption', text: '…or zoom out to the last seven days.' },
      { kind: 'clickByText', text: 'Last 7 days' },
      { kind: 'wait', ms: 1500 },
      { kind: 'caption', text: 'Click any sale to preview its invoice.' },
      { kind: 'clickFn', fn: (doc) => doc.querySelector('tbody tr') },
      { kind: 'wait', ms: 3500 },
      { kind: 'pressKey', key: 'Escape' },
      { kind: 'wait', ms: 800 },
      { kind: 'caption', text: 'Switch to the monthly view for a bigger picture.' },
      { kind: 'clickByText', text: 'This Month' },
      { kind: 'wait', ms: 1500 },
    ],
  },
];

/* ---------- step runner ---------- */

/**
 * Execute one step inside the iframe.
 * Returns { target } where target is the DOM element interacted with (so the
 * caller can animate the cursor to it before the action). Returns null if the
 * step has no visual target (wait, caption, type into input).
 */
export async function resolveTarget(step, iframe) {
  const doc = iframe?.contentDocument;
  if (!doc) return null;

  switch (step.kind) {
    case 'click':
      return await waitFor(() => $(doc, step.selector), { timeout: 4000 });
    case 'clickByText':
      return await waitFor(() => findByText(doc, step.text), { timeout: 4000 });
    case 'clickFn':
      return await waitFor(() => step.fn(doc), { timeout: 4000 });
    case 'type':
      return await waitFor(() => $(doc, step.selector), { timeout: 4000 });
    default:
      return null;
  }
}

export async function performStep(step, iframe) {
  const doc = iframe?.contentDocument;
  const win = iframe?.contentWindow;
  if (!doc || !win) return;

  switch (step.kind) {
    case 'wait':
      await sleep(step.ms || 500);
      return;

    case 'caption':
      // Visual-only; handled by player overlay.
      return;

    case 'click': {
      const el = await waitFor(() => $(doc, step.selector), { timeout: 4000 });
      if (el) clickElement(el);
      return;
    }

    case 'clickByText': {
      const el = await waitFor(() => findByText(doc, step.text), { timeout: 4000 });
      if (el) clickElement(el);
      return;
    }

    case 'clickFn': {
      const el = await waitFor(() => step.fn(doc), { timeout: 4000 });
      if (el) clickElement(el);
      return;
    }

    case 'type': {
      const input = await waitFor(() => $(doc, step.selector), { timeout: 4000 });
      if (!input) return;
      input.focus();
      const target = String(step.text || '');
      const perChar = step.perChar ?? 80;
      if (perChar === 0 || target.length === 0) {
        reactSetValue(input, target, win);
        return;
      }
      // Clear if there's existing content.
      if (input.value) reactSetValue(input, '', win);
      let buffer = '';
      for (const ch of target) {
        buffer += ch;
        reactSetValue(input, buffer, win);
        await sleep(perChar);
      }
      return;
    }

    case 'pressKey': {
      const el = doc.activeElement || doc.body;
      const key = step.key || 'Escape';
      el.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true }));
      el.dispatchEvent(new win.KeyboardEvent('keyup', { key, bubbles: true }));
      return;
    }

    default:
      return;
  }
}

function clickElement(el) {
  try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch { /* noop */ }
  // pointer + mouse + click for Radix and friends
  const opts = { bubbles: true, cancelable: true, view: el.ownerDocument.defaultView };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse' }));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse' }));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
}
