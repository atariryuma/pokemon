/*
  CardAPI - simple client for server.js endpoints
  Usage (in card_viewer.html):
    <script src="./js/card-api.js"></script>
    // Example:
    CardAPI.getAll().then(cards => ...)
    CardAPI.create({ name: 'Pikachu', ... })
    CardAPI.update('123', { name: 'Raichu' })
    CardAPI.remove('123')
    CardAPI.replaceAll(cardsArray)
*/
(function () {
  const BASE = '';

  async function handle(res) {
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText || 'Request failed';
      throw new Error(`${res.status}: ${msg}`);
    }
    return data;
  }

  function getAll() {
    return fetch(`${BASE}/api/cards`, { headers: { 'Accept': 'application/json' } })
      .then(handle)
      .then(d => Array.isArray(d.cards) ? d.cards : (Array.isArray(d) ? d : []));
  }

  function create(card) {
    return fetch(`${BASE}/api/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card || {})
    }).then(handle);
  }

  function update(id, patch) {
    if (id == null) return Promise.reject(new Error('id required'));
    return fetch(`${BASE}/api/cards/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch || {})
    }).then(handle);
  }

  function remove(id) {
    if (id == null) return Promise.reject(new Error('id required'));
    return fetch(`${BASE}/api/cards/${encodeURIComponent(String(id))}`, {
      method: 'DELETE'
    }).then(handle);
  }

  function replaceAll(cards) {
    const list = Array.isArray(cards) ? cards : [];
    return fetch(`${BASE}/api/cards`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: list })
    }).then(handle);
  }

  // Back-compat helpers for code that read/write the raw JSON file
  function readRawFile() {
    return fetch(`${BASE}/data/cards-master.json`, { cache: 'no-cache' })
      .then(handle)
      .then(d => Array.isArray(d.cards) ? d.cards : (Array.isArray(d) ? d : []));
  }

  function writeRawFile(cards) {
    const list = Array.isArray(cards) ? cards : [];
    return fetch(`${BASE}/data/cards-master.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: list })
    }).then(handle);
  }

  window.CardAPI = {
    getAll,
    create,
    update,
    remove,
    replaceAll,
    readRawFile,
    writeRawFile,
  };
})();

