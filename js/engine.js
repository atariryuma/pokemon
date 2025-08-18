// engine.js - CPU対戦の最小ルールエンジン（進化対応）
(function (global) {
  const Engine = {};

  const S = { listeners: [], rngSeed: 12345, players: [null, null], turn: 0, started: false, firstTurn: 0, turnCounter: 0 };
  const emit = (type, payload) => { const evt = { type, payload, ts: Date.now() }; S.listeners.forEach(fn => { try { fn(evt); } catch {} }); };
  const rng = () => ((S.rngSeed = (S.rngSeed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  function cloneCard(c, uid) {
    return {
      uid,
      id: c.id || String(uid),
      name: c.name || 'カード',
      image: c.image,
      supertype: c.supertype || 'Pokemon',
      type: c.type || (Array.isArray(c.types) ? c.types[0] : c.types) || 'C',
      stage: c.stage || 'Basic',
      evolvesFrom: c.evolvesFrom || null,
      hp: Number(c.hp || 60),
      damage: 0,
      baseDamage: Number((c.attacks && c.attacks[0] && c.attacks[0].damage) || c.baseDamage || 10),
      attacks: c.attacks || null,
      weakness: c.weakness || (Array.isArray(c.weaknesses) ? c.weaknesses[0] : null),
      resistance: c.resistance || (Array.isArray(c.resistances) ? c.resistances[0] : null),
      retreatCost: Number(c.retreatCost || 1),
      energyType: c.energyType || c.type || 'C',
      attached: {},
      status: null,
      turnPlayed: null,
      safeArea: c.safeArea,
      pos: c.pos,
    };
  }

  const emptyState = () => ({ deck: [], hand: [], bench: [], active: null, discard: [], prizes: [], energyAttachedThisTurn: false, retreatedThisTurn: false });
  const setupPlayer = (baseCards) => { const P = emptyState(); P.deck = makeDeck(baseCards); return P; };
  const makeDeck = (baseCards) => { const deck = []; let uid = 1; while (deck.length < 60) { for (const c of baseCards) { deck.push(cloneCard(c, uid++)); if (deck.length >= 60) break; } if (!baseCards.length) break; } return shuffle(deck); };
  const zoneSizes = (p) => { const P = S.players[p]; return { deck: P.deck.length, hand: P.hand.length, bench: P.bench.length, prizes: P.prizes.length, discard: P.discard.length, active: P.active ? 1 : 0 }; };
  const currentTurnCount = () => S.turnCounter || 0;

  function snapshotCard(c) {
    if (!c) return null;
    return { uid: c.uid, id: c.id, name: c.name, image: c.image, hp: c.hp, damage: c.damage, baseDamage: c.baseDamage, attached: { ...c.attached }, type: c.type, supertype: c.supertype, stage: c.stage, evolvesFrom: c.evolvesFrom };
  }

  function findCard(player, uid) {
    const P = S.players[player];
    if (P.active && P.active.uid === uid) return P.active;
    for (const z of [P.hand, P.bench, P.prizes, P.discard, P.deck]) { for (const c of z) if (c.uid === uid) return c; }
    return null;
  }

  function moveCard(player, from, to, card) {
    const P = S.players[player];
    const removeFrom = () => { if (from === 'active') { const c = P.active; P.active = null; return c; } const arr = P[from]; const i = arr.indexOf(card); if (i >= 0) return arr.splice(i, 1)[0]; return card; };
    const putTo = (c) => { if (to === 'active') P.active = c; else P[to].push(c); };
    const c = removeFrom(); putTo(c);
    if (to === 'active' || to === 'bench') c.turnPlayed = currentTurnCount();
    emit('move', { player, from, to, card: snapshotCard(c), zones: zoneSizes(player) });
    return c;
  }

  function draw(player, n = 1) { const P = S.players[player]; for (let i = 0; i < n; i++) { const c = P.deck.shift(); if (!c) { emit('deckOut', { player }); continue; } P.hand.push(c); emit('draw', { player, card: snapshotCard(c), zones: zoneSizes(player) }); } }
  function benchFromHand(player, handIndex) { const P = S.players[player]; if (P.bench.length >= 5) return false; const c = P.hand.splice(handIndex, 1)[0]; if (!c) return false; P.bench.push(c); c.turnPlayed = currentTurnCount(); emit('bench', { player, card: snapshotCard(c), zones: zoneSizes(player) }); return true; }
  function setActiveFromHand(player, handIndex) { const P = S.players[player]; if (P.active) return false; const c = P.hand.splice(handIndex, 1)[0]; if (!c) return false; P.active = c; c.turnPlayed = currentTurnCount(); emit('active', { player, card: snapshotCard(c), zones: zoneSizes(player) }); return true; }

  const energyCount = (a) => Object.values(a || {}).reduce((x, y) => x + y, 0);
  function hasEnergyForCost(card, cost) { if (!cost) return true; const pool = { ...card.attached }; for (const [t, n] of Object.entries(cost)) { if (t === 'C') continue; if ((pool[t] || 0) < n) return false; pool[t] -= n; } const needC = cost.C || 0; return energyCount(pool) >= needC; }
  function pickFirstAttack(card) { if (!card.attacks || !Array.isArray(card.attacks) || card.attacks.length === 0) return { cost: { C: 1 }, damage: card.baseDamage || 10 }; const a = card.attacks[0]; const cost = Array.isArray(a.cost) ? a.cost.reduce((m,t)=> (m[t]=(m[t]||0)+1, m), {}) : (a.cost || { C: 1 }); return { cost, damage: Number(a.damage || 0) || (card.baseDamage || 10) }; }
  function attachEnergy(player, handIndex, targetUid) { const P = S.players[player]; if (P.energyAttachedThisTurn) return false; const c = P.hand[handIndex]; if (!c || c.supertype !== 'Energy') return false; const target = findCard(player, targetUid) || P.active; if (!target) return false; const t = c.energyType || 'C'; target.attached[t] = (target.attached[t] || 0) + 1; P.hand.splice(handIndex, 1); P.discard.push(c); P.energyAttachedThisTurn = true; emit('attachEnergy', { player, target: snapshotCard(target), energyType: t, attached: { ...target.attached } }); return true; }
  function retreat(player, benchIndex) { const P = S.players[player]; if (P.retreatedThisTurn) return false; const a = P.active; if (!a) return false; const target = P.bench[benchIndex]; if (!target) return false; let cost = Number(a.retreatCost || 0); const spent = {}; const types = Object.keys(a.attached); for (const t of types) { while (cost > 0 && a.attached[t] > 0) { a.attached[t]-=1; spent[t]=(spent[t]||0)+1; cost-=1; } if (cost<=0) break; } if (cost>0) return false; const idx = P.bench.indexOf(target); P.bench[idx] = a; P.active = target; P.retreatedThisTurn = true; emit('retreat', { player, from: snapshotCard(P.bench[idx]), to: snapshotCard(P.active), spent }); return true; }

  function attack(player) {
    const atkP = S.players[player], def = S.players[1 - player]; if (!atkP.active || !def.active) return false;
    if (currentTurnCount() === 0 && player === S.firstTurn) { emit('attackBlocked', { reason: 'firstTurn' }); return false; }
    const a = atkP.active, d = def.active; const atk = pickFirstAttack(a); if (!hasEnergyForCost(a, atk.cost)) { emit('attackBlocked', { reason: 'noEnergy' }); return false; }
    let dmg = Math.max(0, atk.damage || a.baseDamage || 10);
    const w = d.weakness && (d.weakness.type ? d.weakness.type : d.weakness); const r = d.resistance && (d.resistance.type ? d.resistance.type : d.resistance);
    if (w && w === a.type) dmg *= 2; if (r && r === a.type) dmg = Math.max(0, dmg - 30);
    emit('attack', { player, attacker: snapshotCard(a), target: snapshotCard(d), damage: dmg, cost: atk.cost });
    d.damage += dmg; emit('damage', { player: 1 - player, card: snapshotCard(d) });
    if (d.damage >= d.hp) { const ko = moveCard(1 - player, 'active', 'discard', d); emit('ko', { player: 1 - player, card: snapshotCard(ko) }); const prize = S.players[player].prizes.shift(); if (prize) { S.players[player].hand.push(prize); emit('prize', { player, card: snapshotCard(prize), remaining: S.players[player].prizes.length }); if (S.players[player].prizes.length === 0) { emit('gameOver', { winner: player, reason: 'prizes' }); S.started=false; } } }
    return true;
  }

  function evolve(player, handIndex, targetUid) {
    const P = S.players[player]; const evo = P.hand[handIndex]; if (!evo || evo.supertype !== 'Pokemon') return false; if (!evo.stage || String(evo.stage).toLowerCase()==='basic') return false;
    if (currentTurnCount() === 0 && player === S.firstTurn) { emit('evolveBlocked', { reason: 'firstTurn' }); return false; }
    const base = findCard(player, targetUid) || P.active; if (!base) return false; if (typeof base.turnPlayed==='number' && base.turnPlayed >= currentTurnCount()) { emit('evolveBlocked', { reason: 'sameTurn' }); return false; }
    if (evo.evolvesFrom && base.name && evo.evolvesFrom !== base.name) { emit('evolveBlocked', { reason: 'notMatch' }); return false; }
    const to = cloneCard(evo, evo.uid); to.damage = base.damage||0; to.attached = { ...base.attached }; to.status = null; to.turnPlayed = base.turnPlayed;
    P.hand.splice(handIndex,1);
    if (P.active && P.active.uid === base.uid) { P.discard.push(base); P.active = to; emit('evolve', { player, from: snapshotCard(base), to: snapshotCard(to), slot: 'active' }); }
    else { const i = P.bench.indexOf(base); if (i<0) return false; P.discard.push(base); P.bench[i]=to; emit('evolve', { player, from: snapshotCard(base), to: snapshotCard(to), slot: 'bench', index: i }); }
    return true;
  }

  const ensureBasicInHand = (P) => P.hand.length > 0;
  function setup(baseCards, rngSeed) {
    S.rngSeed = rngSeed || S.rngSeed; S.players[0]=setupPlayer(baseCards); S.players[1]=setupPlayer(baseCards); emit('init', { players: [zoneSizes(0), zoneSizes(1)] });
    for (let p=0;p<2;p++){ draw(p,7); if(!ensureBasicInHand(S.players[p])){ S.players[p].deck.push(...S.players[p].hand); S.players[p].hand=[]; shuffle(S.players[p].deck); draw(p,7); emit('mulligan',{player:p}); }
      setActiveFromHand(p,0); while(S.players[p].hand.length && S.players[p].bench.length<2){ benchFromHand(p,0); }
      for (let i=0;i<6;i++){ const c=S.players[p].deck.shift(); if(c) S.players[p].prizes.push(c); }
      emit('setup:placed',{player:p,zones:zoneSizes(p)});
    }
    S.started=true; S.turn=0; S.firstTurn=0; S.turnCounter=0; emit('turn',{player:S.turn,phase:'start'});
  }

  function startTurn(){ if(!S.started) return; draw(S.turn,1); S.players[S.turn].energyAttachedThisTurn=false; S.players[S.turn].retreatedThisTurn=false; emit('turn',{player:S.turn,phase:'main'}); }
  function endTurn(){ if(!S.started) return; S.turn=1-S.turn; S.turnCounter=(S.turnCounter||0)+1; emit('turn',{player:S.turn,phase:'start'}); }
  function cpuTurn(){ if(!S.started) return; startTurn(); const me=S.turn, P=S.players[me]; const eIdx=P.hand.findIndex(c=>c.supertype==='Energy'); if(eIdx>=0 && P.active) attachEnergy(me,eIdx,P.active.uid); if(P.bench.length<5){ const idx=P.hand.findIndex(c=>c.supertype!=='Energy'); if(idx>=0) benchFromHand(me,idx);} const atk=P.active && pickFirstAttack(P.active); if(P.active && atk && hasEnergyForCost(P.active, atk.cost)) attack(me); else if(!P.retreatedThisTurn && P.bench.length){ for(let i=0;i<P.bench.length;i++){ if(retreat(me,i)) break; } const atk2=P.active && pickFirstAttack(P.active); if(P.active && atk2 && hasEnergyForCost(P.active, atk2.cost)) attack(me); } endTurn(); }

  // 公開API
  Engine.subscribe = (fn)=>{ S.listeners.push(fn); };
  Engine.init = (cards, seed)=> setup(cards, seed);
  Engine.getState = ()=> ({ turn:S.turn, players:[ { active:snapshotCard(S.players[0].active), zones:zoneSizes(0) }, { active:snapshotCard(S.players[1].active), zones:zoneSizes(1) } ] });
  Engine.getHand = (player)=> (S.players[player]?.hand || []).map(snapshotCard);
  Engine.draw = (p,n)=> draw(p,n);
  Engine.attack = (p)=> attack(p);
  Engine.endTurn = ()=> endTurn();
  Engine.cpuTurn = ()=> cpuTurn();
  Engine.attachEnergy = (p,i,uid)=> attachEnergy(p,i,uid);
  Engine.retreat = (p,i)=> retreat(p,i);
  Engine.move = (p,from,to,uid)=> { const c=findCard(p,uid); if(!c) return false; moveCard(p,from,to,c); return true; };
  Engine.evolve = (p,i,uid)=> evolve(p,i,uid);

  global.Engine = Engine;
})(window);

