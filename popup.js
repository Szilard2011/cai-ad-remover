document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const count = document.getElementById('count');
  const notice = document.getElementById('notice');
  const mainUI = document.getElementById('mainUI');
  const themeBtn = document.getElementById('themeBtn');
  const html = document.documentElement;

  const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.sync : null;
  const tabsAPI = typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs : null;

  if (storage) {
    storage.get({ enabled: true, theme: 'light' }, (data) => {
      toggle.checked = data.enabled;
      html.setAttribute('data-theme', data.theme);
      themeBtn.textContent = data.theme === 'dark' ? 'Light' : 'Dark';
    });
  }

  themeBtn.addEventListener('click', () => {
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    themeBtn.textContent = isDark ? 'Dark' : 'Light';
    
    if (storage) {
      storage.set({ theme: newTheme });
    }
  });

  if (tabsAPI) {
    tabsAPI.query({ active: true, currentWindow: true }, (activeTabs) => {
      const tab = activeTabs[0];
      const isCai = tab?.url && tab.url.includes('character.ai');

      if (!isCai) {
        notice.style.display = 'block';
        mainUI.style.opacity = '0.3';
        mainUI.style.pointerEvents = 'none';
        return;
      }

      tabsAPI.sendMessage(tab.id, { type: 'GET_STATS' }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res) {
          count.textContent = res.count || 0;
          toggle.checked = res.enabled !== false;
        }
      });

      setInterval(() => {
        tabsAPI.sendMessage(tab.id, { type: 'GET_STATS' }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res) {
            count.textContent = res.count || 0;
          }
        });
      }, 1000);
    });
  }

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    
    if (storage) {
      storage.set({ enabled });
    }

    if (tabsAPI) {
      tabsAPI.query({ active: true, currentWindow: true }, (activeTabs) => {
        const tab = activeTabs[0];
        if (!tab?.url?.includes('character.ai')) return;
        
        tabsAPI.sendMessage(tab.id, { type: 'SET_ENABLED', enabled }).catch(() => {});
      });
    }
  });
});