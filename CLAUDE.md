# A Clinic in the Valley (`a_clinic_in_the_valley`): notes for agents

Read `README.md` first. Static vanilla-JS ES modules, no build step, vendored libraries.
Sibling of `~/Projects/dont get lost`. Code was **copied** from there, not imported, so keep them
independent.

## Rules
- **`js/core/` stays pure** (no Phaser, no DOM): it runs in Node for `npm test`.
- **The valley is a function of the seed** (`region.js`). Saves hold only diffs: `World.toRecord()`
  plus `meta` (player, clinic, patients, ledger). Content ids are stable strings, so never rename an
  item, herb, active or condition id.
- **Medicine is simulated, never scripted.** Nothing says "item X cures Y". Remedies carry compounds
  (`actives.js`); compounds act through `pk.js`; illnesses are models (`disease.js`); findings come
  only from `signs.js`. `teach` fields on conditions are for the handbook and hindsight only.
- **Every clinical number needs a `ref`.** Mark effect sizes fitted to a trial as `calibrated`, and
  mark extraction efficiencies as estimates. After changing any number, run `npm test`. The outcome
  bands in `test/sim.test.mjs` must still hold; recalibrate rather than loosening them blindly.
- **`js/core/content/flora.js` is generated** by `tools/build_flora.mjs` from USDA Dr. Duke's databases
  (public domain) and Kew's WCVP (CC BY 4.0): never hand-edit it, and never hand-rate a species. A
  plant's strength is its measured content × extraction (`preparations.js`) × PK. Effects and toxicity
  live once per compound class in `content/flora_actives.js`; a compound that maps to no class is inert.
  The generated table feeds `content/flora_herbs.js` (herb-shaped rows, generic sprite pool per life
  form) and `core/flora.js` (which species this seed's valley grows, plus `floraNear`, `folkUses`,
  `lookalikes`, `climateFit`).
- Any drug may be made in the lab: this valley follows no real country's drug law. Recipes for drugs
  that are controlled in the real world stay at game level (inputs, station, time, yield), with no
  real reagents, conditions or step-by-step chemistry.
- **Bilingual (English + Korean), more languages later.** Every player-visible string goes through `t()` /
  `localize()` / `msg()` (`js/core/i18n.js`); the English text is the key, so never edit an English string without
  updating its Korean in `js/core/i18n/ko/*.js`. Build whole-sentence templates (never glue fragments), keep the
  first argument of `t()` a plain literal, store saved text as `msg()`, and follow `i18n/ko/glossary.md`.
  `npm test` fails on any string without Korean (`node tools/i18n-check.mjs ko --list` shows which).
- WTND text is paraphrased with page refs. The book (2011 PDF plus extracted text) is committed only
  encrypted, as `sources/wtnd-book.tar.gz.gpg` (AES-256, symmetric; the user holds the password). On a
  new machine, unpack it with `gpg -d sources/wtnd-book.tar.gz.gpg | tar xz -C sources`. The
  plaintext files in `sources/` are gitignored: never commit them unencrypted.
- Patients draw each drug's PK variation from its own seeded stream (`patient.js`), so adding a
  compound never reshuffles who walks in. Keep new per-patient randomness on its own stream too.
- Bacterial (and parasite) strains come from `content/organisms.js` and the valley's resistance
  index (`clinic.js`). Antibiotics act only through MIC there, never by naming an illness.
- Harms are data on the active, not code: `toxic` (`at` mg/L, or `atMgKg` swallowed in 24 h; `dry` = only when
  dehydrated), `idio` (rare reactions per course), `dependence` (with `harm` if stopping can kill), `allergen`,
  `reacts` (share of anyone who reacts, allergic or not: horse serum). Complications are data on the condition:
  `ascend` (spreads to the next organ, keeping its strain), `sequel` (decided when its window closes) and, on the
  `chronic` model, `risk` (per game year, rising with the level: high blood pressure → stroke).
- Slow processes (months, years) run `COMPRESS` (time.js) times faster than illness: divide real-time `tau`s and
  recovery times by it in the condition data and say so; attacks, fits, bites and PK stay in real hours.
- `abxAs` lets an active share another's MIC (benzylpenicillin uses penicillin V's); an organism's `link` makes one
  drug's resistance draw follow another's (MRSA resists ceftriaxone too).
- New game-icon name: rebuild icons (`node tools/used-icons.mjs | python3 tools/build_icons.py <game-icons repo>`;
  a clone was used from the session scratchpad, so `git clone --depth 1 https://github.com/game-icons/icons`).
- After gameplay changes, run `npm test` and `node tools/playtest.mjs <scratch dir>` (and `--mobile`).
- Android WebView can't `fetch()` file:// URLs, so JSON loads via XHR (`js/game/icons.js`). This
  matters if an APK is made later.

## Ports & services
- 3411 `no-doctor-preview`: on-demand static preview (`node tools/serve.mjs`, no Python needed;
  `.claude/launch.json`). Also used by
  `tools/playtest.mjs`, which starts and stops its own server.
