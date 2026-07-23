let listingData = null;

function setStatus(msg, type='') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + type;
}

async function scrapeUrl() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return setStatus('Paste a listing URL first.', 'error');
  setStatus('Pulling listing data... (15-30 seconds)', 'loading');
  document.getElementById('scrapeBtn').disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'FETCH_LISTING', url });
    if (!result) throw new Error('No response from background worker');
    if (!result.success) throw new Error(result.error || 'Failed to fetch listing');
    listingData = result.data;
    listingData.url = url;
    document.getElementById('infoTitle').textContent = listingData.title || '—';
    document.getElementById('infoPrice').textContent = listingData.todayPrice || listingData.wasPrice || '—';
    document.getElementById('infoKms').textContent = [listingData.kms, listingData.color].filter(Boolean).join(' · ') || '—';
    const grid = document.getElementById('photosGrid');
    grid.innerHTML = '';
    const photos = listingData.images || [];
    photos.slice(0, 8).forEach(src => {
      const img = document.createElement('img');
      img.src = `https://tyme-vehicle-builder.vercel.app/api/proxy-image?url=${encodeURIComponent(src)}`;
      img.onerror = () => { img.src = src; };
      grid.appendChild(img);
    });
    document.getElementById('photoCount').textContent = `${photos.length} photos found`;
    document.getElementById('vehicleInfo').style.display = 'block';
    setStatus(`✓ ${listingData.title || 'Vehicle'} — ready to post`, 'success');
  } catch(e) {
    setStatus('Error: ' + e.message, 'error');
  }
  document.getElementById('scrapeBtn').disabled = false;
}

async function postToFacebook() {
  if (!listingData) return setStatus('Pull listing data first.', 'error');
  await chrome.storage.local.set({ tymeListingData: listingData });
  setStatus('Opening Facebook Marketplace...', 'loading');
  chrome.tabs.create({ url: 'https://www.facebook.com/marketplace/create/vehicle' }, (tab) => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'FILL_LISTING', data: listingData });
          setStatus('✓ Filling Facebook form...', 'success');
        }, 3000);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('scrapeBtn').addEventListener('click', scrapeUrl);
  document.getElementById('postBtn').addEventListener('click', postToFacebook);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    if (url.includes('autotrader.ca') || url.includes('cargurus') || url.includes('kaizenauto') || url.includes('mountainviewdodge')) {
      document.getElementById('urlInput').value = url;
      scrapeUrl();
    }
  });
});
