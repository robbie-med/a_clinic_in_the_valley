#!/usr/bin/env python3
"""Pack the Dungeon Crawl Stone Soup tiles we use into one uniform 32x32 grid sprite sheet.

    python3 tools/build_atlas.py <path-to>/crawl-ref/source/rltiles

Writes assets/tiles.png (64 columns, row-major) and assets/tiles.json ({"cols":64,"pad":1,"names":[...]}),
Each 32x32 tile sits in a 34x34 cell with its edge pixels extruded by 1 px (margin 1, spacing 2), so
tilemaps drawn at fractional zoom never sample a neighbouring tile (no seams between rows).
where a tile's frame index is its position in `names` and its name is its path under rltiles
without ".png" (e.g. "mon/animals/wolf", "dngn/trees/tree3").

Source: https://github.com/crawl/crawl (crawl-ref/source/rltiles). The tiles are CC0 / public
domain (see CREDITS.md). Fetch them with a sparse clone:
    git clone --depth 1 --filter=blob:none --sparse https://github.com/crawl/crawl.git
    cd crawl && git sparse-checkout set crawl-ref/source/rltiles
"""
import json, os, re, sys
from PIL import Image

T = 32
PAD = 1
CELL = T + 2 * PAD
COLS = 64
MAX = COLS * 64  # 4096 frames keeps the sheet at 2048x2048, safe for any phone GPU

# Whole directories (recursive) and filtered families. Order is irrelevant; names are sorted.
INCLUDE_DIRS = [
    'dngn/floor', 'dngn/trees', 'dngn/water', 'dngn/decor', 'dngn/vaults', 'dngn/statues', 'dngn/doors',
    'dngn/shops',
    'mon/animals', 'mon/aquatic', 'mon/fungi_plants', 'mon/amorphous', 'mon/mutantbeast', 'mon/undead',
    'mon/humanoids', 'mon/dragons', 'mon/draco', 'mon/demihumanoids', 'mon/holy',
    'item',
    'player/base', 'player/body', 'player/head', 'player/legs', 'player/boots', 'player/gloves',
    'player/cloak', 'player/hair', 'player/beard',
    'misc/blood', 'misc/icons',
]
# dngn/wall is huge; keep only natural rock, stone, brick, wood and ice families.
WALL_RE = re.compile(r'^dngn/wall/(stone_|stone2_|brick_|cobalt_rock|lab-rock|gulch_rock|rock_wall|sandstone|marble|limestone|'
                     r'ice_|icy_|rime|volcanic|wall_vines|relief|slime_stone|church|crystal_wall_(green|brown|blue|white)|'
                     r'shoals_wall|desolation|elf-stone|undead_brown|wall_stone_lair|wall_stone_orc)')
EFFECT_RE = re.compile(r'^effect/(arrow|cloud_fire|cloud_grey_smoke|cloud_black_smoke|cloud_rain|cloud_storm|cloud_poison|'
                       r'cloud_cold|bolt|sling|stone|net|dart|javelin|flame)')
SKIP_RE = re.compile(r'/UNUSED/|/artefact/|/unrand|_art\d*$|demonic|panlord')


def collect(root):
    names = set()
    for dirpath, _, files in os.walk(root):
        for f in files:
            if not f.endswith('.png'):
                continue
            rel = os.path.relpath(os.path.join(dirpath, f), root)[:-4].replace(os.sep, '/')
            if SKIP_RE.search('/' + rel):
                continue
            if any(rel.startswith(d + '/') for d in INCLUDE_DIRS) or WALL_RE.match(rel) or EFFECT_RE.match(rel):
                names.add(rel)
    return sorted(names)


def fit(img):
    img = img.convert('RGBA')
    w, h = img.size
    if (w, h) != (T, T):
        s = min(T / w, T / h)
        if s < 1:
            img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.NEAREST)
        cell = Image.new('RGBA', (T, T), (0, 0, 0, 0))
        cell.paste(img, ((T - img.size[0]) // 2, T - img.size[1]))  # bottom-aligned, like a creature standing
        img = cell
    return img


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = sys.argv[1]
    names = collect(root)
    if len(names) > MAX:
        sys.exit(f'{len(names)} tiles > {MAX}; tighten INCLUDE_DIRS')
    rows = (len(names) + COLS - 1) // COLS
    sheet = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    for i, n in enumerate(names):
        t = fit(Image.open(os.path.join(root, n + '.png')))
        x, y = (i % COLS) * CELL, (i // COLS) * CELL
        # extrude: stretch the tile to 34x34 first (fills the border), then paste the crisp tile in the middle
        sheet.paste(t.resize((CELL, CELL), Image.NEAREST), (x, y))
        sheet.paste(t, (x + PAD, y + PAD))
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(os.path.dirname(here), 'assets')
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, 'tiles.png'), optimize=True)
    with open(os.path.join(out, 'tiles.json'), 'w') as fh:
        json.dump({'tile': T, 'pad': PAD, 'cols': COLS, 'names': names}, fh, separators=(',', ':'))
    print(f'{len(names)} tiles -> assets/tiles.png ({sheet.size[0]}x{sheet.size[1]})')


if __name__ == '__main__':
    main()
