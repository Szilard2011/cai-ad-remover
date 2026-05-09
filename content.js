(function () {
  'use strict';

  let hiddenCount = 0;
  let isEnabled = true;

  function notifyBackground() {
    try {
      chrome.runtime.sendMessage({ type: 'AD_REMOVED', count: hiddenCount }).catch(() => {});
    } catch (_) {}
  }

  function injectCSS() {
    if (document.getElementById('cai-ad-remover-css')) return;
    const style = document.createElement('style');
    style.id = 'cai-ad-remover-css';
    style.textContent = `
      [id^="div-gpt-ad-"],
      iframe[src*="doubleclick.net"],
      iframe[src*="googlesyndication.com"],
      iframe[id^="google_ads_iframe_"] {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        position: absolute !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeCSS() {
    const style = document.getElementById('cai-ad-remover-css');
    if (style) style.remove();
  }

  function hideElement(el) {
    if (!el || el.dataset.caiHidden) return;
    el.dataset.caiHidden = 'true';
    el.style.setProperty('display', 'none', 'important');
    hiddenCount++;
    notifyBackground();
  }

  function getHighestSafeWrapper(el) {
    let current = el;
    let highestSafe = el;

    while (current) {
      const parent = current.parentElement;
      if (!parent) break;

      const candidate = parent.closest('.w-full, .fixed');
      if (!candidate) break;

      if (
        candidate.tagName === 'BODY' ||
        candidate.tagName === 'MAIN' ||
        candidate.querySelector('main') ||
        candidate.querySelector('textarea') ||
        candidate.querySelector('form') ||
        candidate.closest('form')
      ) {
        break;
      }

      highestSafe = candidate;
      current = candidate;
    }

    return highestSafe;
  }

  function scanDOM() {
    if (!isEnabled || !document.body) return;

    const gptSlots = document.querySelectorAll('[id^="div-gpt-ad-"]');
    gptSlots.forEach(slot => {
      hideElement(getHighestSafeWrapper(slot));
    });

    const inHouseBanners = document.querySelectorAll('[style*="/in-house/"]');
    inHouseBanners.forEach(banner => {
      hideElement(getHighestSafeWrapper(banner));
    });
  }

  let timeoutId = null;
  const observer = new MutationObserver(() => {
    if (!isEnabled) return;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(scanDOM, 100);
  });

  function start() {
    injectCSS();
    scanDOM();
    if (document.body) {
      observer.observe(document.body, { 
        childList: true, 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['style', 'class'] 
      });
    }
  }

  function stop() {
    removeCSS();
    observer.disconnect();
    const hiddenEls = document.querySelectorAll('[data-cai-hidden="true"]');
    hiddenEls.forEach(el => {
      delete el.dataset.caiHidden;
      el.style.display = '';
    });
  }

  chrome.storage.sync.get({ enabled: true }, (res) => {
    isEnabled = res.enabled;
    if (isEnabled) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STATS') {
      sendResponse({ count: hiddenCount, enabled: isEnabled });
    } else if (msg.type === 'SET_ENABLED') {
      isEnabled = msg.enabled;
      if (isEnabled) {
        start();
      } else {
        stop();
      }
      sendResponse({ ok: true });
    }
    return true;
  });

})();