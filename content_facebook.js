function waitForEl(selector, timeout=10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error('Timeout')); }, timeout);
  });
}

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// Facebook's Year / Vehicle Type fields are custom click-to-open dropdowns, not native
// <select> elements - filling them needs a click + wait + click-the-option sequence.
function findClickableByText(text, exact=true) {
  const candidates = Array.from(document.querySelectorAll('div[role="combobox"], div[role="button"], span, label'));
  return candidates.find(el => {
    if (el.offsetParent === null) return false; // skip hidden
    const t = el.textContent.trim();
    return exact ? t === text : t.toLowerCase().includes(text.toLowerCase());
  }) || null;
}

async function clickDropdownAndSelect(trigger, optionText) {
  if (!trigger) return false;
  trigger.click();
  await new Promise(r => setTimeout(r, 600));
  const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li[role]'));
  const match = options.find(o => o.textContent.trim().toLowerCase() === optionText.toLowerCase())
    || options.find(o => o.textContent.trim().toLowerCase().includes(optionText.toLowerCase()));
  if (match) { match.click(); await new Promise(r => setTimeout(r, 300)); return true; }
  // Close the dropdown if nothing matched, so it doesn't sit open over other fields
  document.body.click();
  return false;
}

// Facebook's Model/Mileage/Price/Description inputs have NO placeholder, aria-label, or
// name attribute at all - the "Model"/"Mileage" text you see is a separate floating label
// element sitting next to the real input, not part of the input itself. So instead of
// matching an attribute, find the visible label text, then find the nearest input/textarea
// in the same form row (walking up a few parent levels until one turns up).
function findInputNearLabel(labelText, tagName='input') {
  const allEls = Array.from(document.querySelectorAll('span,div,label'));
  const labelEl = allEls.find(el => {
    if (el.offsetParent === null) return false;
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join('');
    return directText === labelText;
  });
  if (!labelEl) return null;
  let container = labelEl;
  for (let i = 0; i < 6; i++) {
    container = container.parentElement;
    if (!container) break;
    const field = container.querySelector(tagName);
    if (field) return field;
  }
  return null;
}

async function fillListing(data) {
  await new Promise(r => setTimeout(r, 2000));

  // Vehicle Type: always default to the first option ("Car/Truck").
  // This is the very first field and gates everything below it, so it goes first.
  try {
    const typeTrigger = findClickableByText('Vehicle type', false) || findClickableByText('Car/Truck', false);
    if (typeTrigger) {
      typeTrigger.click();
      await new Promise(r => setTimeout(r, 700));
      const firstOption = document.querySelector('[role="option"], [role="menuitem"], li[role]');
      if (firstOption) firstOption.click();
      await new Promise(r => setTimeout(r, 800));
    }
  } catch(_) {}

  // Year (custom dropdown)
  if (data.year) {
    try {
      const yearTrigger = findClickableByText('Year', true);
      await clickDropdownAndSelect(yearTrigger, data.year);
      await new Promise(r => setTimeout(r, 500));
    } catch(_) {}
  }

  // Make (custom dropdown) - gates Model/Mileage/Color appearing below it,
  // so we wait after selecting it rather than rushing straight to Model.
  if (data.make) {
    try {
      const makeTrigger = findClickableByText('Make', true);
      await clickDropdownAndSelect(makeTrigger, data.make);
      await new Promise(r => setTimeout(r, 800));
    } catch(_) {}
  }

  // Model (plain text input, no placeholder/aria-label - find by its floating label)
  if (data.model) {
    try {
      const modelEl = findInputNearLabel('Model');
      if (modelEl) setNativeValue(modelEl, data.model);
      await new Promise(r => setTimeout(r, 400));
    } catch(_) {}
  }

  // Mileage (plain text input, no placeholder/aria-label - find by its floating label)
  if (data.kms) {
    try {
      const kmNum = String(data.kms).replace(/[^0-9]/g, '');
      if (kmNum) {
        const mileageEl = findInputNearLabel('Mileage');
        if (mileageEl) setNativeValue(mileageEl, kmNum);
        await new Promise(r => setTimeout(r, 400));
      }
    } catch(_) {}
  }

  // Exterior color (custom dropdown)
  if (data.color) {
    try {
      const colorTrigger = findClickableByText('Exterior color', true) || findClickableByText('Exterior colour', true);
      await clickDropdownAndSelect(colorTrigger, data.color);
      await new Promise(r => setTimeout(r, 400));
    } catch(_) {}
  }

  const priceNum = (data.todayPrice || '').replace(/[^0-9]/g, '');
  if (priceNum) {
    try {
      const priceEl = findInputNearLabel('Price') || document.querySelector('input[placeholder*="rice"]');
      if (priceEl) setNativeValue(priceEl, priceNum);
    } catch(_) {}
  }
  const lines = [];
  if (data.todayPrice) lines.push(`💰 ${data.todayPrice}`);
  if (data.kms) lines.push(`📍 ${data.kms}${data.color ? ` | ${data.color}` : ''}`);
  if (data.biweeklyPayment) lines.push(`✅ ${data.biweeklyPayment}`);
  if (data.description) {
    lines.push('');
    lines.push(data.description);
  }
  if (data.features?.length) {
    lines.push('');
    lines.push('🔑 KEY FEATURES:');
    data.features.forEach(f => lines.push(`• ${f}`));
  }
  lines.push('');
  lines.push('📲 DM us or comment below to get started!');
  lines.push('#SubprimeAuto #CarLoans #BadCredit #GetApproved #EasyAutoLoans');
  try {
    const desc = document.querySelector('textarea') || findInputNearLabel('Description', 'textarea');
    if (desc) setNativeValue(desc, lines.join('\n'));
  } catch(_) {}
  if (data.images?.length) {
    const files = [];
    for (const imgUrl of data.images.slice(0, 20)) {
      try {
        const proxyUrl = `https://tyme-vehicle-builder.vercel.app/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const name = imgUrl.split('/').pop().split('?')[0] || 'photo.jpg';
        files.push(new File([blob], name.includes('.') ? name : name + '.jpg', { type: 'image/jpeg' }));
      } catch(_) {}
    }
    if (files.length) {
      try {
        const input = await waitForEl('input[type="file"][accept*="image"]', 5000);
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch(_) {}
    }
  }
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:16px;right:16px;background:#052e16;color:#4ade80;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:700;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
  banner.textContent = '✅ TYME Auto — Listing filled! Review and submit.';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FILL_LISTING') fillListing(msg.data);
});

chrome.storage.local.get('tymeListingData', (result) => {
  if (result.tymeListingData) {
    setTimeout(() => fillListing(result.tymeListingData), 2000);
    chrome.storage.local.remove('tymeListingData');
  }
});
