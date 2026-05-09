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
      [aria-label="Hirdetés" i],
      [aria-label="Advertisement" i],
      [aria-label="Ads" i],
      iframe[src*="doubleclick.net"],
      iframe[src*="googlesyndication.com"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
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

  function isSafeToHide(el) {
    if (!el) return false;
    if (el.tagName === 'BODY' || el.tagName === 'MAIN' || el.tagName === 'NAV') return false;
    if (el.querySelector('main') || el.querySelector('nav') || el.querySelector('textarea')) return false;
    if (el.querySelectorAll('a').length > 10) return false;
    return true;
  }

  function findSpecificWrapper(el) {
    const labeled = el.closest('[aria-label="Hirdetés" i], [aria-label="Advertisement" i], [aria-label="Ads" i]');
    if (labeled) return labeled;

    let parent = el.parentElement;
    if (parent && parent.classList.contains('w-full') && isSafeToHide(parent)) {
        return parent;
    }
    
    return el;
  }

  function scanDOM() {
    if (!isEnabled || !document.body) return;

    const gptSlots = document.querySelectorAll('[id^="div-gpt-ad-"]');
    gptSlots.forEach(slot => {
      const target = findSpecificWrapper(slot);
      if (isSafeToHide(target)) hideElement(target);
    });

    const inHouseBanners = document.querySelectorAll('[style*="/in-house/"]');
    inHouseBanners.forEach(banner => {
      const target = findSpecificWrapper(banner);
      if (isSafeToHide(target)) hideElement(target);
    });

    const labels = document.querySelectorAll('p, span, button');
    labels.forEach(label => {
        const txt = label.textContent.trim().toLowerCase();
        if (txt === 'hirdetés' || txt === 'advertisement') {
            const target = label.closest('.w-full');
            if (isSafeToHide(target)) hideElement(target);
        }
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
