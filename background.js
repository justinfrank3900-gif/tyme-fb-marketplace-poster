chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_LISTING') {
    fetch('https://tyme-vehicle-builder.vercel.app/api/fetch-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: msg.url })
    })
    .then(r => r.json())
    .then(json => sendResponse(json))
    .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});
chrome.runtime.onInstalled.addListener(() => console.log('TYME Auto installed'));
