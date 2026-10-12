# Credits

## Medical content
- **Where There Is No Doctor** — David Werner with Carol Thuman and Jane Maxwell, Hesperian Health
  Guides (2011 printing). Hesperian encourages adaptation of the book for free or at-cost
  distribution; commercial use needs their permission. This game is free. The text is paraphrased
  with page references, and no illustrations are reused. Hesperian asks for a copy of adaptations:
  https://hesperian.org.
- Pharmacology references are cited on each row of `js/core/content/actives.js`, `herbs.js` and
  `flora_actives.js`.

## Plant data (`js/core/content/flora.js`, built by `tools/build_flora.mjs`)
- **Dr. Duke's Phytochemical and Ethnobotanical Databases** — James A. Duke, USDA Agricultural
  Research Service / National Agricultural Library. **Public domain (CC0 1.0)**,
  https://phytochem.nal.usda.gov and the USDA Ag Data Commons record
  (doi:10.15482/USDA.ADC/1239279). Used for: which compounds a species holds and how much (ppm of the
  dry part, tables `FARMACY_NEW`/`FNFTAX`), its common name (`COMMON_NAMES`), and the folk uses people
  report for it (`ETHNOBOT`). Attribution requested by the source: *Duke, J.A. Dr. Duke's
  Phytochemical and Ethnobotanical Databases. U.S. Department of Agriculture, Agricultural Research
  Service, 1992–2016.*
- **World Checklist of Vascular Plants (WCVP)** — Royal Botanic Gardens, Kew. **CC BY 4.0**,
  https://sftp.kew.org/pub/data-repositories/WCVP (also on Zenodo/GBIF). Used for: accepted name,
  family, life form and climate description. Attribution required by the licence: *Govaerts, R. et al.
  The World Checklist of Vascular Plants (WCVP). Royal Botanic Gardens, Kew. CC BY 4.0.*
- **TCMBank** (https://tcmbank.cn; Lv Q et al. Chem Sci 2023) was **not used**: the site states only
  that it is "non-commercial" and publishes no licence or terms of reuse, so redistributing its tables
  here would not be clearly permitted. Its gene "targets" would be unusable anyway — they are
  network-pharmacology predictions, not clinical effect sizes. The Chinese herbs that matter clinically
  (aconite, aristolochia/birthwort, ephedra, coptis, rhubarb, licorice, cinnabar, realgar, antler) are
  covered by Duke or by the hand table in `js/core/content/materia.js`.
- The non-plant materia medica (`materia.js`) and every compound class (`flora_actives.js`) are
  hand-written from the references cited on each entry.

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
