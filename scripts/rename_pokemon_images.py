import os
import json
import re
from difflib import SequenceMatcher

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
IMG_DIR = os.path.join(BASE_DIR, 'assets', 'cards', 'pokemon')
JSON_PATH = os.path.join(BASE_DIR, 'data', 'cards-master.json')


def load_card_names(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    names_en = []
    import unicodedata
    for card in data:
        ctype = (card.get('card_type') or card.get('cardType') or '').strip()
        # Normalize diacritics/punctuation for robust matching
        ctype_nfkd = unicodedata.normalize('NFKD', ctype)
        ctype_ascii = ''.join([ch for ch in ctype_nfkd if ord(ch) < 128])
        ctype_ascii = re.sub(r'[^A-Za-z]', '', ctype_ascii).lower()
        if ctype_ascii == 'pokemon':
            en = card.get('name_en') or card.get('nameEn') or ''
            if en:
                names_en.append(en)
    return names_en


def slugify(name):
    # Keep letters, numbers and spaces; normalize spaces to underscores
    name = name.strip()
    name = re.sub(r"[\u2019'`\-]+", ' ', name)  # apostrophes/hyphens -> space
    name = re.sub(r"[^A-Za-z0-9 ]+", '', name)
    name = re.sub(r"\s+", '_', name.strip())
    return name


def norm(s):
    # For similarity: lowercase, remove non-alnum
    s = s.lower()
    s = re.sub(r"[^a-z0-9]", '', s)
    return s


def best_match(current_base, candidates):
    ncur = norm(current_base)

    # Exact slug match first
    for cand in candidates:
        if current_base == cand:
            return cand, 1.0

    # Heuristic overrides for known mismatches
    overrides = {
        'Neko_exv': 'Cat_exv',
        'Kemushi_exz': 'Caterpillar_exz',
        'Koban_Inago': 'Kobane_Inago',
        'Tsumamura_Sakimadara': 'Tsumamurasaki_Madara',
        'Haiirohitori_Larva': 'Grey_Dagger_Moth_Larva',
        'Kurohime_Ganbo': 'Kurohime_Crane_Fly',
        'Tateha': 'Tateha_Butterfly',
        # Ensure hyphenated filename for Short-horned Grasshopper
        'Shouyou_Batta': 'Short-horned_Grasshopper',
        'Tonosama_Batta': 'Tonosama_Grasshopper',
    }
    if current_base in overrides:
        return overrides[current_base], 0.99

    # Fuzzy match by SequenceMatcher
    best = (None, 0.0)
    for cand in candidates:
        score = SequenceMatcher(None, ncur, norm(cand)).ratio()
        if score > best[1]:
            best = (cand, score)
    return best


def main(apply=False):
    if not os.path.isdir(IMG_DIR):
        print(f"Image directory not found: {IMG_DIR}")
        return 1
    if not os.path.isfile(JSON_PATH):
        print(f"JSON not found: {JSON_PATH}")
        return 1

    names = load_card_names(JSON_PATH)
    # Build candidate slugs
    candidate_bases = [slugify(n) for n in names]

    # Deduplicate while preserving order
    seen = set()
    unique_candidates = []
    for c in candidate_bases:
        if c not in seen:
            unique_candidates.append(c)
            seen.add(c)

    # Current files
    files = [f for f in os.listdir(IMG_DIR) if f.lower().endswith('.webp')]
    current_bases = [os.path.splitext(f)[0] for f in files]

    # Map currents to best candidates
    mapping = []  # (src_file, dst_file, score)
    target_counts = {}
    for base, fname in zip(current_bases, files):
        target_base, score = best_match(base, unique_candidates)
        if target_base is None:
            # leave unchanged
            mapping.append((fname, fname, 0.0))
            continue

        # Handle duplicates: if multiple files map to same target, append numeric suffixes
        count = target_counts.get(target_base, 0) + 1
        target_counts[target_base] = count
        final_base = target_base if count == 1 else f"{target_base}_{count}"
        dst = final_base + '.webp'

        # If already same, keep as is
        if fname == dst:
            mapping.append((fname, fname, score))
        else:
            mapping.append((fname, dst, score))

    # Present plan sorted by whether it changes
    changes = [m for m in mapping if m[0] != m[1]]
    unchanged = [m for m in mapping if m[0] == m[1]]

    print('Rename plan (dry-run):')
    for src, dst, score in sorted(changes):
        print(f"  {src}  ->  {dst}  (match={score:.2f})")
    if not changes:
        print('  No changes needed.')

    print('\nUnchanged files:')
    for src, _, score in sorted(unchanged):
        print(f"  {src}  (match={score:.2f})")

    if apply and changes:
        print('\nApplying renames...')
        for src, dst, _ in changes:
            src_path = os.path.join(IMG_DIR, src)
            dst_path = os.path.join(IMG_DIR, dst)
            if os.path.exists(dst_path):
                print(f"  SKIP: {dst} already exists")
                continue
            os.rename(src_path, dst_path)
            print(f"  Renamed: {src} -> {dst}")

    return 0


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser(description='Rename pokemon images to match names from cards-master.json')
    p.add_argument('--apply', action='store_true', help='Apply the renames')
    args = p.parse_args()
    main(apply=args.apply)
