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
    if (document.getElementById('cai-nuke-css')) return;
    const style = document.createElement('style');
    style.id = 'cai-nuke-css';
    style.textContent = `
      [data-cai-nuked="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        position: absolute !important;
        pointer-events: none !important;
        border: none !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeCSS() {
    const style = document.getElementById('cai-nuke-css');
    if (style) style.remove();
  }

  function getOutermostAdBox(trigger) {
    let current = trigger;
    let bestWrapper = trigger;

    for (let i = 0; i < 7; i++) {
      const parent = current.parentElement;
      if (!parent) break;

      const tag = parent.tagName;
      if (tag === 'BODY' || tag === 'MAIN' || tag === 'NAV' || tag === 'ASIDE' || tag === 'SECTION') break;

      if (parent.id && !parent.id.includes('gpt-ad')) break;
      if (parent.classList.contains('flex-1') || parent.classList.contains('grid')) break;

      if (parent.querySelector('textarea') || parent.querySelector('form')) break;
      if (parent.querySelectorAll('img').length > 1) break;
      if (parent.querySelectorAll('a, button').length > 4) break;
      if (parent.textContent.length > 300) break;

      if (
        parent.classList.contains('w-full') ||
        parent.classList.contains('fixed') ||
        parent.classList.contains('absolute')
      ) {
        bestWrapper = parent;
        if (parent.classList.contains('fixed') && !parent.classList.contains('inset-0')) break;
      }

      current = parent;
    }

    return bestWrapper;
  }

  function nukeAd(trigger) {
    if (!trigger) return;
    const wrapper = getOutermostAdBox(trigger);
    if (wrapper && wrapper.dataset.caiNuked !== "true") {
      wrapper.dataset.caiNuked = "true";
      hiddenCount++;
      notifyBackground();
    }
  }

  function nukeDialogAds() {
    const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    dialogs.forEach(dialog => {
      if (dialog.dataset.caiNuked) return;

      const hasInHouse = dialog.querySelector('[style*="/in-house/"]');
      const hasGpt = dialog.querySelector('[id^="div-gpt-ad-"]');

      if (hasInHouse || hasGpt) {
        dialog.dataset.caiNuked = "true";
        hiddenCount++;
        notifyBackground();

        const backdrop = document.querySelector('button.fixed.inset-0[aria-label="Close"]');
        if (backdrop && !backdrop.dataset.caiNuked) {
          backdrop.dataset.caiNuked = "true";
        }
      }
    });
  }

  function nukeAdBreaks() {
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    dialogs.forEach(dialog => {
      if (dialog.dataset.caiNuked) return;

      const hasAdBreakImg = dialog.querySelector('img[src*="ad-break-chat-entry-background"]');
      const hasKeepChatting = dialog.textContent.includes('Keep chatting with ads');

      if (hasAdBreakImg || hasKeepChatting) {
        dialog.dataset.caiNuked = "true";
        hiddenCount++;
        notifyBackground();

        const backdrop = document.querySelector('div.fixed.inset-0.z-50.bg-black\\/50');
        if (backdrop && !backdrop.dataset.caiNuked) {
          backdrop.dataset.caiNuked = "true";
          hiddenCount++;
          notifyBackground();
        }
      }
    });
  }

  function scanDOM() {
    if (!isEnabled || !document.body) return;

    const triggers = document.querySelectorAll(
      '[id^="div-gpt-ad-"], [style*="/in-house/"], iframe[src*="doubleclick.net"], iframe[src*="googlesyndication.com"], button.fixed.inset-0[aria-label="Close"], #ad-break-toast-upcoming'
    );

    for (let i = 0; i < triggers.length; i++) {
      nukeAd(triggers[i]);
    }

    nukeDialogAds();
    nukeAdBreaks();
  }

  let intervalId = null;

  function start() {
    injectCSS();
    scanDOM();

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(scanDOM, 100);

    const observer = new MutationObserver(() => {
      if (isEnabled) scanDOM();
    });

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
    if (intervalId) clearInterval(intervalId);
    const nuked = document.querySelectorAll('[data-cai-nuked="true"]');
    for (let i = 0; i < nuked.length; i++) {
      delete nuked[i].dataset.caiNuked;
    }
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
      if (isEnabled) start(); else stop();
      sendResponse({ ok: true });
    }
    return true;
  });

})();
