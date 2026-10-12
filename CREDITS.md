# Credits

## Medical content
- **Where There Is No Doctor** — David Werner with Carol Thuman and Jane Maxwell, Hesperian Health
  Guides (2011 printing). Hesperian encourages adaptation of the book for free or at-cost
  distribution; commercial use needs their permission. This game is free. The text is paraphrased
  with page references, and no illustrations are reused. Hesperian asks for a copy of adaptations:
  https://hesperian.org.
- Pharmacology references are cited on each row of `js/core/content/actives.js` and `herbs.js`.

## Art
- **Dungeon Crawl Stone Soup tiles** (CC0 / public domain): https://github.com/crawl/crawl. The atlas
  is copied from `dont get lost` (`assets/tiles.png`, built by `tools/build_atlas.py`).
- **game-icons.net** (CC BY 3.0): https://github.com/game-icons/icons. The exact authors are listed in
  `assets/icons-authors.json`; they include Lorc, Delapouite, Skoll, Sbed, Zeromancer, Caro Asercion,
  Lord Berandas and the Badges set.

## Font
- **Pixelify Sans** (SIL Open Font License 1.1), in `assets/fonts/`.

## Code (vendored, all MIT)
Phaser 3, simplex-noise, Alea, ZzFX and nipplejs (see `vendor/licenses/`).

## Reused from this machine's projects
- `dont get lost` (sibling project). Copied:
  - `rng`, `noise`, `inventory` (with potency added) and `lore`;
  - `store`, `icons`, `sfx`;
  - the playtest harness and the atlas/icon tools;
  - CSS and patterns from `world`, `scene`, `ui` and `crafting`.
- `antibiotiX` (the drug/case schema idea) and `FOU` (weighted-trigger differential), as ideas for
  later phases.
