export async function loadCards(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const raw = await res.json();
  const cards = Array.isArray(raw) ? raw : (raw.data || raw.cards || []);
  return cards.map(normalizeCard);
}

function normalizeCard(c) {
  const id = c.id ?? c.code ?? c.number ?? c.name ?? Math.random().toString(36).slice(2);
  const supertype = c.supertype || c.category || guessSupertype(c);
  const name = c.name || c.jpName || c.title || id;
  const types = c.types || c.type || [];
  const hp = toNumber(c.hp) || 60;
  const attacks = Array.isArray(c.attacks) ? c.attacks.map(a => normalizeAttack(a)) : [];
  const candidates = resolveImageCandidates(c, id, name);
  const image = candidates[0] || resolveLegacyImage(c, id);
  const isPokemon = (supertype || '').toLowerCase().includes('pokemon') || supertype === 'Pokémon';
  return { id, name, supertype, types, hp, attacks, image, imageCandidates: candidates, _raw: c, isPokemon };
}

function normalizeAttack(a) {
  const name = a.name || a.text || 'Attack';
  const cost = (a.cost || a.energyCost || []).map(toSymbol);
  const base = parseDamage(a.damage);
  return { name, cost, damage: base, text: a.text || '' };
}

function toSymbol(t) {
  const map = { Colorless: 'C', Fire: 'R', Water: 'W', Grass: 'G', Lightning: 'L', Psychic: 'P', Darkness: 'D', Metal: 'M', Fighting: 'F', Fairy: 'Y', Dragon: 'N' };
  if (!t) return 'C';
  if (map[t]) return map[t];
  const s = String(t).charAt(0).toUpperCase();
  return map[s] || s;
}

function parseDamage(dmg) {
  if (dmg == null) return 0;
  const s = String(dmg).trim();
  if (!s || s === '-' || s === '—') return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function toNumber(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }

function guessSupertype(c) {
  if (c.attacks || c.hp || c.types) return 'Pokémon';
  if (c.rules) return 'Trainer';
  return 'Energy';
}

function resolveLegacyImage(c, id){
  // Fallback single path (kept for backward compatibility)
  const cleaned = (id || c.name || '').toString().replace(/[^a-z0-9_-]/gi, '_');
  return `assets/${cleaned}.jpg`;
}

function resolveImageCandidates(c, id, name){
  const out = [];
  if (c.images) {
    if (c.images.large) out.push(c.images.large);
    if (c.images.small) out.push(c.images.small);
  }
  if (c.image) out.push(c.image);
  const cleanedId = (id||'').toString().replace(/[^a-z0-9_-]/gi, '_');
  const cleanedName = (name||'').toString().replace(/[^a-z0-9_-]/gi, '_');
  const bases = [`assets/${cleanedId}`, `assets/${cleanedName}`, `assets/${cleanedId.toLowerCase()}`, `assets/${cleanedName.toLowerCase()}`];
  const exts = ['.webp','.png','.jpg','.jpeg'];
  for (const b of bases) for (const ext of exts) out.push(`${b}${ext}`);
  // de-duplicate while preserving order
  return [...new Set(out.filter(Boolean))];
}
