// app.js - UIとエンジン連携（進化対応）
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  // 設定（cards.js があれば優先）
  const ASSETS_BASE = (window.Cards && window.Cards.config && window.Cards.config.ASSETS_BASE) || 'assets';
  const CARD_BACK = (window.Cards && window.Cards.config && window.Cards.config.CARD_BACK) || `${ASSETS_BASE}/card_back.webp`;

  // 盤面参照
  const hand = $('#hand');
  const bench = $('#bench');
  const active = $('#active');
  const prizes = $('#prizes');
  const discard = $('#discard');

  // 相手手札
  const oppHand = document.querySelector('.hand--opponent');

  // スラッグ化
  const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  function resolveImageCandidates(card) {
    if (window.Cards && typeof window.Cards.resolveImageCandidates === 'function') {
      const list = window.Cards.resolveImageCandidates(card);
      if (Array.isArray(list) && list.length) return list;
    }
    if (card.image) return [card.image];
    const id = card.id ? String(card.id) : '';
    const list = [];
    if (id) list.push(`${ASSETS_BASE}/${id}.webp`, `${ASSETS_BASE}/${id}.png`, `${ASSETS_BASE}/${id}.jpg`);
    if (card.name) { const s = slug(card.name); list.push(`${ASSETS_BASE}/${s}.webp`, `${ASSETS_BASE}/${s}.png`, `${ASSETS_BASE}/${s}.jpg`); }
    if (!list.length) list.push(`${ASSETS_BASE}/sample.webp`);
    return list;
  }

  function preload(srcs = []) { srcs.forEach((src) => { const img = new Image(); img.decoding = 'async'; img.src = src; }); }

  // カードDOM
  function createCard({ name = 'カード', candidates = [], faceDown = false, safe = { l: '6%', t: '9%', r: '6%', b: '38%' }, pos = { x: '50%', y: '50%' } } = {}) {
    const el = document.createElement('div');
    el.className = 'card';
    el.tabIndex = 0;
    el.style.setProperty('--safe-l', safe.l);
    el.style.setProperty('--safe-t', safe.t);
    el.style.setProperty('--safe-r', safe.r);
    el.style.setProperty('--safe-b', safe.b);
    el.style.setProperty('--img-x', pos.x);
    el.style.setProperty('--img-y', pos.y);
    let idx = 0;
    const list = Array.isArray(candidates) && candidates.length ? candidates : [];
    const src = faceDown ? CARD_BACK : (list[0] || CARD_BACK);
    el.dataset.facedown = String(faceDown);
    el.innerHTML = `
      <div class="card__frame">
        <img class="card__image" alt="${name}" src="${src}" />
        <div class="card__energies"></div>
        <div class="card__safe-area" aria-hidden="true"></div>
        <div class="card__label">${name}</div>
      </div>
    `;
    if (!faceDown && list.length > 1) {
      const imgEl = el.querySelector('.card__image');
      imgEl.addEventListener('error', () => { idx += 1; if (idx < list.length) imgEl.src = list[idx]; });
    }
    return el;
  }

  function animate(el, cls) {
    return new Promise((resolve) => {
      el.classList.add(cls);
      const done = () => { el.classList.remove(cls); el.removeEventListener('animationend', done); resolve(); };
      el.addEventListener('animationend', done, { once: true });
    });
  }

  // DOMカード管理
  const cardDom = new Map(); // uid -> element
  function ensureDomCard(card, faceDown = false) {
    if (!card) return null;
    let el = cardDom.get(card.uid);
    const candidates = resolveImageCandidates(card);
    if (!el) {
      el = createCard({ name: card.name, candidates, faceDown, safe: card.safeArea ? { l: card.safeArea.l ?? '6%', t: card.safeArea.t ?? '9%', r: card.safeArea.r ?? '6%', b: card.safeArea.b ?? '38%' } : undefined, pos: card.pos ? { x: (card.pos.x ?? 50) + '%', y: (card.pos.y ?? 50) + '%' } : undefined });
      cardDom.set(card.uid, el);
    } else {
      el.dataset.facedown = String(faceDown);
      if (!faceDown) {
        const img = el.querySelector('.card__image');
        if (img && !img.src.includes(CARD_BACK)) img.src = candidates[0] || img.src;
      }
    }
    if (card.attached) updateEnergyBadges(el, card.attached);
    return el;
  }

  function updateEnergyBadges(el, attached) {
    const wrap = el.querySelector('.card__energies');
    if (!wrap) return;
    wrap.innerHTML = '';
    const entries = Object.entries(attached || {}).filter(([,n]) => n>0).slice(0,4);
    for (const [t,n] of entries) {
      const b = document.createElement('span');
      b.className = 'card__energy';
      b.textContent = n;
      b.title = `Energy ${t}: ${n}`;
      wrap.appendChild(b);
    }
  }

  // ログ
  function logEvent(type, payload) {
    const ul = document.getElementById('log'); if (!ul) return;
    const li = document.createElement('li'); li.textContent = formatLog(type, payload); ul.appendChild(li);
    const auto = document.getElementById('autoscroll'); if (!auto || auto.checked) ul.scrollTop = ul.scrollHeight;
  }
  function formatLog(type, p) {
    try {
      if (type === 'draw') return `P${p.player+1} ドロー`;
      if (type === 'bench') return `P${p.player+1} ベンチ: ${p.card.name}`;
      if (type === 'active') return `P${p.player+1} バトル場: ${p.card.name}`;
      if (type === 'evolve') return `P${p.player+1} 進化: ${p.from?.name} → ${p.to?.name}`;
      if (type === 'attack') return `P${p.player+1} ワザ: ${p.attacker.name} → ${p.target.name} (${p.damage})`;
      if (type === 'damage') return `ダメージ: ${p.card.name} (${p.card.damage}/${p.card.hp})`;
      if (type === 'ko') return `きぜつ: ${p.card.name}`;
      if (type === 'prize') return `P${p.player+1} サイド取得 (残${p.remaining})`;
      if (type === 'attachEnergy') return `エネルギー付与: ${p.target.name} (${p.energyType})`;
      if (type === 'retreat') return `にげる: ${p.from?.name} → ${p.to?.name}`;
      if (type === 'attackBlocked') return `攻撃不可: ${p.reason}`;
      if (type === 'evolveBlocked') return `進化不可: ${p.reason}`;
      if (type === 'turn') return `ターン: P${p.player+1} ${p.phase}`;
      return `${type}`;
    } catch { return `${type}`; }
  }

  // イベント→UI
  function wireEngine() {
    if (!window.Engine) return false;
    window.Engine.subscribe((e) => {
      const { type, payload } = e; logEvent(type, payload);
      if (type === 'draw') {
        const { player, card } = payload;
        const el = ensureDomCard(card, player === 1);
        const zone = getZoneEl(player, 'hand'); if (zone && !el.isConnected) zone.appendChild(el);
        animate(el, 'anim-draw');
      }
      if (type === 'bench') {
        const { player, card } = payload;
        const el = ensureDomCard(card, false);
        const zone = getZoneEl(player, 'bench'); if (zone && !el.isConnected) zone.appendChild(el);
        animate(el, 'anim-bench');
      }
      if (type === 'active') {
        const { player, card } = payload;
        const el = ensureDomCard(card, false);
        const zone = getZoneEl(player, 'active'); if (zone) { zone.innerHTML = ''; zone.appendChild(el); }
      }
      if (type === 'move') {
        const { player, to, card } = payload;
        const el = ensureDomCard(card, to === 'prizes' || (to === 'hand' && player === 1));
        const zone = getZoneEl(player, to); if (zone && !el.isConnected) zone.appendChild(el);
      }
      if (type === 'attachEnergy') {
        const { target, attached } = payload; const el = cardDom.get(target.uid); if (el) updateEnergyBadges(el, attached);
      }
      if (type === 'retreat') {
        const { player, to } = payload; const el = ensureDomCard(to, false); const zone = getZoneEl(player, 'active'); if (zone) { zone.innerHTML = ''; zone.appendChild(el); }
      }
      if (type === 'evolve') {
        const { from, to } = payload; const fromEl = cardDom.get(from.uid); const toEl = ensureDomCard(to, false); if (fromEl && fromEl.parentElement) fromEl.parentElement.replaceChild(toEl, fromEl);
      }
      if (type === 'attack') { const { attacker } = payload; const el = cardDom.get(attacker.uid); if (el) animate(el, 'anim-attack'); }
      if (type === 'ko') { const { card } = payload; const el = cardDom.get(card.uid); if (el) animate(el, 'anim-faint'); }
    });
    return true;
  }

  function getZoneEl(player, zone) {
    if (player === 0) { if (zone === 'hand') return hand; if (zone === 'bench') return bench; if (zone === 'active') return active; if (zone === 'prizes') return prizes; if (zone === 'discard') return discard; }
    else { const root = document.querySelector('.player--opponent'); if (!root) return null; if (zone === 'hand') return root.querySelector('.hand'); if (zone === 'bench') return root.querySelector('.bench'); if (zone === 'active') return root.querySelector('.active'); if (zone === 'prizes') return root.querySelector('.prizes'); if (zone === 'discard') return root.querySelector('.discard'); }
    return null;
  }

  // デバッグUI
  let selectedCard = null;
  const imgX = $('#img-x'); const imgY = $('#img-y'); const toggleSafe = $('#toggle-safe');
  function selectCard(el) { if (selectedCard) selectedCard.classList.remove('is-selected'); selectedCard = el; if (el) el.classList.add('is-selected'); }
  function getVar(el, name, fallback) { const v = getComputedStyle(el).getPropertyValue(name).trim(); const num = parseFloat(v); return Number.isFinite(num) ? num : fallback; }
  function syncSliders() { if (!selectedCard) return; if (imgX) imgX.value = String(getVar(selectedCard, '--img-x', 50)); if (imgY) imgY.value = String(getVar(selectedCard, '--img-y', 50)); }
  if (toggleSafe) toggleSafe.addEventListener('change', (e) => { document.body.classList.toggle('debug-safe', e.target.checked); });
  if (imgX && imgY) { const apply = () => { if (!selectedCard) return; selectedCard.style.setProperty('--img-x', `${imgX.value}%`); selectedCard.style.setProperty('--img-y', `${imgY.value}%`); }; imgX.addEventListener('input', apply); imgY.addEventListener('input', apply); }
  document.addEventListener('click', (e) => { const c = e.target.closest && e.target.closest('.card'); if (c) { selectCard(c); syncSliders(); } });

  // カード読み込み
  async function loadCards() {
    try { if (window.Cards && typeof window.Cards.load === 'function') return await window.Cards.load(); if (Array.isArray(window.CARDS)) return window.CARDS; if (window.cards && typeof window.cards.list === 'function') return await window.cards.list(); const res = await fetch('cards.json', { cache: 'no-store' }); if (!res.ok) throw new Error(`HTTP ${res.status}`); return await res.json(); } catch { return [ { id: '001', name: 'ピカチュウ' }, { id: '002', name: 'フシギダネ' }, { id: '003', name: 'ヒトカゲ' }, { id: '004', name: 'ゼニガメ' }, { id: '005', name: 'イーブイ' }, { id: '006', name: 'ニャース' } ]; }
  }

  async function init() {
    const cards = await loadCards();
    const imgLists = cards.map(resolveImageCandidates); const preloadList = imgLists.map(l => l[0]).filter(Boolean); preload([CARD_BACK, ...preloadList.slice(0, 10)]);

    if (wireEngine()) {
      window.Engine.init(cards, 1337);
      // 操作
      $('#btn-draw')?.addEventListener('click', () => window.Engine.draw(0, 1));
      $('#btn-bench')?.addEventListener('click', () => { const handEls = Array.from(hand.querySelectorAll('.card')); const el = handEls[handEls.length - 1]; if (!el) return; const uid = [...cardDom.entries()].find(([, v]) => v === el)?.[0]; if (uid) window.Engine.move(0, 'hand', 'bench', uid); });
      $('#btn-attach')?.addEventListener('click', () => { const uid = window.Engine.getState().players[0].active?.uid; window.Engine.attachEnergy(0, 0, uid); });
      $('#btn-retreat')?.addEventListener('click', () => { window.Engine.retreat(0, 0); });
      $('#btn-evolve')?.addEventListener('click', () => {
        // 手札から進化先を探索（進化元一致・非Basic）→アクティブに適用
        const state = window.Engine.getState(); const activeUid = state.players[0].active?.uid; const activeName = state.players[0].active?.name; if (!activeUid) return;
        const handList = (window.Engine.getHand && window.Engine.getHand(0)) || [];
        const idx = handList.findIndex(c => c.supertype === 'Pokemon' && String(c.stage).toLowerCase() !== 'basic' && (!c.evolvesFrom || c.evolvesFrom === activeName));
        if (idx >= 0) window.Engine.evolve(0, idx, activeUid);
      });
      $('#btn-attack')?.addEventListener('click', () => { window.Engine.attack(0); setTimeout(() => window.Engine.cpuTurn(), 300); });
      $('#btn-faint')?.addEventListener('click', () => { const st = window.Engine.getState(); const uid = st.players[0].active?.uid; if (uid) window.Engine.move(0, 'active', 'discard', uid); });
      return;
    }

    // フォールバック（エンジンなしのデモ）
    const mk = (c) => createCard({ name: c.name || 'カード', candidates: resolveImageCandidates(c), safe: c.safeArea ? { l: c.safeArea.l ?? '6%', t: c.safeArea.t ?? '9%', r: c.safeArea.r ?? '6%', b: c.safeArea.b ?? '38%' } : { l: '6%', t: '9%', r: '6%', b: '38%' }, pos: c.pos ? { x: (c.pos.x ?? 50) + '%', y: (c.pos.y ?? 50) + '%' } : { x: '50%', y: '50%' } });
    const sample = cards.slice(); const a = sample.shift(); if (a) active.appendChild(mk(a)); for (let i = 0; i < 2; i++) { const c = sample.shift(); if (c) bench.appendChild(mk(c)); } for (let i = 0; i < 3; i++) { const c = sample.shift() || { name: `カード${i+1}` }; hand.appendChild(mk(c)); } for (let i = 0; i < 6; i++) { prizes.appendChild(createCard({ name: `サイド${i+1}`, faceDown: true })); } if (oppHand) { for (let i = 0; i < 5; i++) oppHand.appendChild(createCard({ name: '相手カード', faceDown: true })); }
    $('#btn-draw')?.addEventListener('click', () => { const card = mk({ name: 'カード' }); hand.appendChild(card); animate(card, 'anim-draw'); });
    $('#btn-bench')?.addEventListener('click', () => { const card = hand.lastElementChild; if (!card) return; bench.appendChild(card); animate(card, 'anim-bench'); });
    $('#btn-attack')?.addEventListener('click', () => { const t = active.firstElementChild || bench.firstElementChild; if (t) animate(t, 'anim-attack'); });
    $('#btn-faint')?.addEventListener('click', () => { const t = active.firstElementChild || bench.firstElementChild || hand.firstElementChild; if (!t) return; animate(t, 'anim-faint'); discard.appendChild(t); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

