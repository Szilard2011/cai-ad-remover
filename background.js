const tabStats = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.type === 'AD_REMOVED' && tabId) {
    tabStats[tabId] = message.count;
    updateBadge(tabId, message.count);
  }

  sendResponse({ ok: true });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabStats[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabStats[tabId] = 0;
    chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
  }
});

function updateBadge(tabId, count) {
  if (count > 0) {
    chrome.action.setBadgeText({
      text: count > 99 ? '99+' : String(count),
      tabId,
    }).catch(() => {});

    chrome.action.setBadgeBackgroundColor({
      color: '#6C63FF',
      tabId,
    }).catch(() => {});
  }
}