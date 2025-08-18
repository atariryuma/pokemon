export class Renderer {
  constructor(regions, fx, logFn) {
    this.regions = regions;
    this.fx = fx;
    this.log = logFn;
    this.game = null;
    this.back = 'assets/back.jpg';
    this.detectBack();
  }

  bind(game) { this.game = game; }

  render(game) {
    const s = game.state;
    this.renderPlayer('opponent', s.players[0]);
    this.renderPlayer('player', s.players[1]);
    this.renderHand(s.players[1]);
  }

  renderPlayer(side, p) {
    const R = this.regions[side];
    // deck as back-card stack, discard as count
    R.deck.innerHTML = '';
    R.deck.appendChild(this.backCardEl(`×${p.deck.length}`));
    R.discard.textContent = `DISCARD (${p.discard.length})`;
    // prizes
    R.prizes.innerHTML = '';
    for (let i=0;i<p.prizes.length;i++) { R.prizes.appendChild(this.backCardEl()); }
    // active
    R.active.innerHTML = '';
    if (p.active) R.active.appendChild(this.cardEl(p.active));
    // bench
    R.bench.innerHTML = '';
    p.bench.forEach(c => R.bench.appendChild(this.cardEl(c)));
  }

  renderHand(player) {
    const H = this.regions.hand;
    H.innerHTML = '';
    player.hand.forEach(c => H.appendChild(this.cardEl(c)));
  }

  cardEl(card) {
    const el = document.createElement('div');
    el.className = 'card';
    const img = document.createElement('img');
    img.loading = 'lazy';
    // prepare candidate sources: prefer card.imageCandidates but build if absent
    const candidates = buildCandidates(card);
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) return;
      img.src = candidates[idx++];
    };
    img.onerror = () => tryNext();
    tryNext();
    const hp = document.createElement('div'); hp.className = 'hp'; hp.textContent = `${Math.max(0, card.hp ?? 0)}/${card.maxHp ?? card.hp ?? ''}`;
    const energy = document.createElement('div'); energy.className = 'energy';
    (card.energy || []).forEach(e => {
      const dot = document.createElement('div'); dot.className = `e ${e.energyType || 'C'}`; dot.title = e.energyType || 'C'; energy.appendChild(dot);
    });
    const badge = document.createElement('div'); badge.className = 'badge'; badge.textContent = (card.types?.[0] || '').slice(0,3).toUpperCase();
    el.append(img, hp, energy, badge);
    return el;
  }

  animateAttack(game, payload) {
    const atkSide = payload.attackerSide;
    const src = this.regions[atkSide].active.querySelector('.card');
    const dst = this.regions[atkSide === 'player' ? 'opponent' : 'player'].active.querySelector('.card');
    if (payload.attack && src && dst) {
      const color = '#ff5577';
      this.fx.attack(src, dst, { color });
      dst.classList.add('flash-hit', 'shake');
      setTimeout(()=> dst && dst.classList.remove('flash-hit', 'shake'), 450);
    }
    if (payload.knockout) {
      // small explosion effect at target area
      if (dst) this.fx.impactAtEl(dst, { color: '#ffaa33' });
    }
  }

  backCardEl(counter) {
    const el = document.createElement('div');
    el.className = 'card card-back';
    const img = document.createElement('img'); img.loading = 'lazy'; img.src = this.back; img.alt = 'Card Back';
    el.appendChild(img);
    if (counter) { const c = document.createElement('div'); c.className = 'badge'; c.textContent = counter; el.appendChild(c); }
    return el;
  }

  detectBack(){
    const candidates = [
      'assets/back.webp','assets/back.png','assets/back.jpg',
      'assets/card-back.webp','assets/card-back.png','assets/card-back.jpg',
      'assets/card_back.webp','assets/card_back.png','assets/card_back.jpg',
      'assets/pokemon_back.webp','assets/pokemon_back.png','assets/pokemon_back.jpg',
      'assets/pokemon-back.webp','assets/pokemon-back.png','assets/pokemon-back.jpg'
    ];
    const tryNext = (i) => {
      if (i>=candidates.length) return;
      const src = candidates[i];
      const im = new Image();
      im.onload = ()=> { this.back = src; };
      im.onerror = ()=> tryNext(i+1);
      im.src = src;
    };
    tryNext(0);
  }
}

function buildCandidates(card){
  const list = [];
  if (Array.isArray(card.imageCandidates)) list.push(...card.imageCandidates);
  if (card.image) list.push(card.image);
  const id = (card.id||'').toString().replace(/[^a-z0-9_-]/gi,'_');
  const name = (card.name||'').toString().replace(/[^a-z0-9_-]/gi,'_');
  const bases = [`assets/${id}`, `assets/${name}`, `assets/${id.toLowerCase()}`, `assets/${name.toLowerCase()}`];
  const exts = ['.webp','.png','.jpg','.jpeg'];
  for (const b of bases) for (const ext of exts) list.push(`${b}${ext}`);
  return [...new Set(list.filter(Boolean))];
}

export function createRendererState(state){ return { version: 1, t: Date.now(), snapshot: state }; }
