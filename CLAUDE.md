# A Clinic in the Valley (`no_doctor`): notes for agents

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
- **No synthesis or extraction routes for controlled substances** (opioids, benzodiazepines,
  ketamine, ephedrine and similar precursors). `test/content.test.mjs` enforces this. The phase-3
  chemistry lab keeps it.
- WTND text is paraphrased with page refs. The extracted book text lives in `sources/` (gitignored).
  Never commit it.
- New game-icon name: rebuild icons (`node tools/used-icons.mjs | python3 tools/build_icons.py <game-icons repo>`;
  a clone was used from the session scratchpad, so `git clone --depth 1 https://github.com/game-icons/icons`).
- After gameplay changes, run `npm test` and `node tools/playtest.mjs <scratch dir>` (and `--mobile`).
- Android WebView can't `fetch()` file:// URLs, so JSON loads via XHR (`js/game/icons.js`). This
  matters if an APK is made later.

## Ports & services
- 3411 `no-doctor-preview`: on-demand static preview (`.claude/launch.json`). Also used by
  `tools/playtest.mjs`, which starts and stops its own server.
