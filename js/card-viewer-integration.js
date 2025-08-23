/*
  card-viewer-integration.js
  - Wires CardAPI into card_viewer.html without assuming specific UI
  - Adds Ctrl+S save shortcut and optional button hooks
  - Exposes window.saveCardsToServer(cards) and window.loadCardsFromServer()
*/
(function () {
  function toast(msg) {
    try { console.info(msg); } catch {}
  }

  async function loadCardsFromServer() {
    const cards = await (window.CardAPI ? CardAPI.getAll() : Promise.resolve([]));
    toast(`Loaded ${cards.length} cards from server`);
    return cards;
  }

  async function saveCardsToServer(cards) {
    if (!window.CardAPI) throw new Error('CardAPI not loaded');
    const list = Array.isArray(cards) ? cards : [];
    await CardAPI.replaceAll(list);
    toast(`Saved ${list.length} cards to server`);
    return true;
  }

  function tryParseJSON(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function detectCardsFromPage() {
    if (Array.isArray(window.cards)) return window.cards;
    if (window.CARD_DATA && Array.isArray(window.CARD_DATA.cards)) return window.CARD_DATA.cards;
    const ta = document.querySelector('textarea#cards-json, textarea[name="cards"], textarea[data-cards]');
    if (ta && ta.value) {
      const parsed = tryParseJSON(ta.value.trim());
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.cards)) return parsed.cards;
    }
    const pre = document.querySelector('pre#cards-json, pre[data-cards]');
    if (pre && pre.textContent) {
      const parsed = tryParseJSON(pre.textContent.trim());
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.cards)) return parsed.cards;
    }
    return null;
  }

  function installHotkeys() {
    document.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        try {
          const cards = detectCardsFromPage() || await loadCardsFromServer();
          await saveCardsToServer(cards);
        } catch (err) {
          console.error('Save failed:', err);
          alert('保存に失敗しました: ' + (err && err.message ? err.message : String(err)));
        }
      }
    });
  }

  function installButtons() {
    const saveBtn = document.getElementById('save-cards');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const cards = detectCardsFromPage() || await loadCardsFromServer();
          await saveCardsToServer(cards);
          alert('保存しました');
        } catch (err) {
          alert('保存に失敗しました: ' + (err && err.message ? err.message : String(err)));
        }
      });
    }
    const loadBtn = document.getElementById('load-cards');
    if (loadBtn) {
      loadBtn.addEventListener('click', async () => {
        const cards = await loadCardsFromServer();
        if (window.renderCards) window.renderCards(cards);
      });
    }
  }

  function ensureCardAPI(cb) {
    if (window.CardAPI) return cb();
    const s = document.createElement('script');
    s.src = './js/card-api.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function init() {
    ensureCardAPI(() => {
      window.saveCardsToServer = saveCardsToServer;
      window.loadCardsFromServer = loadCardsFromServer;
      installHotkeys();
      installButtons();
      console.log('Card viewer integration ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

