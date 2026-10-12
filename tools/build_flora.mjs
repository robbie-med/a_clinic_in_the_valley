// build_flora.mjs — builds js/core/content/flora.js from two open datasets. Nothing here rates a
// herb: a species' strength comes from its measured compound content (Duke, ppm of the dry part),
// the extraction method and the PK of its compound CLASS (content/flora_actives.js). Compounds that
// map to no class are inert and dropped.
//
//   node tools/build_flora.mjs --duke <dir with Duke CSVs> --wcvp <dir with wcvp_names.csv> [--out <file>]
//
// Duke: USDA Dr. Duke's Phytochemical and Ethnobotanical Databases (public domain, CC0).
//   FARMACY_NEW.csv (species × chemical × plant part, ppm low/high), FNFTAX.csv (taxon),
//   ETHNOBOT.csv (species × folk use).
// WCVP: Kew World Checklist of Vascular Plants (CC BY 4.0) — accepted name, family, life form,
//   climate description. wcvp_names.csv is pipe-separated and unquoted.
import { createReadStream, writeFileSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DUKE = arg('duke'), WCVP = arg('wcvp');
const OUT = arg('out', new URL('../js/core/content/flora.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (!DUKE || !WCVP) { console.error('need --duke <dir> --wcvp <dir>'); process.exit(1); }

// ——— compound classes. One regex per class; the class itself (PK, effects, toxicity, refs) is a single
// entry in content/flora_actives.js or an existing active in actives.js. `def` is the typical content
// (% of dry part) used only when Duke lists the compound without a number, from the sources cited on
// the class in flora_actives.js. Everything not matched here is inert.
const CLASSES = [
  ['salicin', /^(SALICIN|SALICORTIN|TREMULACIN|POPULIN|SALIREPOSIDE|FRAGILIN|TREMULOIDIN|SALICYLATES|SALICYLIC-ACID)$/, 0.3],
  ['quinine', /^(QUININE|QUINIDINE|CINCHONINE|CINCHONIDINE)$/, 2],
  ['artemisinin', /^ARTEMISININ$/, 0.3],
  ['digitoxin', /^(DIGITOXIN|GITOXIN|PURPUREA-GLYCOSIDE-[AB]|LANATOSIDE-[AB]|ACETYLDIGITOXINS)$/, 0.2],
  ['cardenolide', /^(DIGOXIN|LANATOSIDE-C|OUABAIN|[GK]-STROPHANTHIN|STROPHANTHIN|CYMARIN|CONVALLATOXIN|CONVALLOSIDE|OLEANDRIN|THEVETIN-[AB]|PERUVOSIDE|NERIIFOLIN|CALOTROPIN|CALACTIN|SCILLAREN-A|PROSCILLARIDIN|HELLEBRIN|ADONITOXIN)$/, 0.1],
  ['tropane', /^(\(-\)-)?(HYOSCYAMINE|ATROPINE|SCOPOLAMINE|HYOSCINE)$/, 0.2],
  ['gingerol', /^([0-9]+-)?(GINGEROLS?|SHOGAOLS?)$/, 1],
  ['papain_bitc', /^BENZYL-ISOTHIOCYANATE$/, 0.3],
  ['allicin', /^ALLICIN$/, 0.5],
  ['aloin', /^(ALOINS?|ALOIN-[AB]|BARBALOIN|SENNOSIDES?|SENNOSIDE-[A-D]|CASCAROSIDES?|CASCAROSIDE-[A-F]|FRANGULINS?|FRANGULIN-[AB]|GLUCOFRANGULINS?|GLUCOFRANGULIN-[AB]|RHEIN-8-GLUCOSIDE|ANTHRAQUINONE-GLYCOSIDES|HYDROXYANTHRACENE-DERIVATIVES)$/, 1],
  ['emodin', /^(EMODIN|ALOE-EMODIN|CHRYSOPHANOL|CHRYSOPHANIC-ACID|RHEIN|PHYSCION)$/, 0.3],
  ['tannin', /^(TANNINS?|TANNIC-ACID|CATECHIN-TANNINS?|CATECHOL-TANNINS?|CATECIC-TANNINS|GALLOTANNINS?|ELLAGITANNINS?|CONDENSED-TANNINS?|HYDROLYZABLE-TANNINS?|PROANTHOCYANIDINS?)$/, 5],
  ['guava_flavonoid', /^(QUERCETIN|QUERCITRIN|RUTIN|HYPEROSIDE|ISOQUERCITRIN|QUERCETIN-3-O-GLUCOSIDE)$/, 0.5],
  ['pyrrolizidine', /^(SENECIONINE|SENECIPHYLLINE|SENECIVERNINE|RETRORSINE|RIDDELLIINE|MONOCROTALINE|HELIOTRINE|LASIOCARPINE|ECHIMIDINE|SYMPHYTINE|SYMLANDINE|INTERMEDINE|LYCOPSAMINE|ACETYLINTERMEDINE|ACETYLLYCOPSAMINE|7-ACETYL-INTERMEDINE|7-ACETYL-LYCOPSAMINE|JACOBINE|JACOZINE|JACONINE|SENKIRKINE|PETASITENINE|CLIVORINE|EUROPINE|INTEGERRIMINE|ERUCIFOLINE|HELIOSUPINE|ECHINATINE|RINDERINE|UPLANDICINE|PYRROLIZIDINE-ALKALOIDS)$/, 0.05],
  ['aristolochic', /^ARISTOLOCHIC-ACID(-[AI]+)?$/, 0.1],
  ['aconitine', /^(ACONITINE|MESACONITINE|HYPACONITINE|JESACONITINE|PSEUDACONITINE|INDACONITINE|BIKHACONITINE)$/, 0.05],
  ['ephedrine', /^(\([+-]\)-)?(EPHEDRINE|PSEUDOEPHEDRINE|NOREPHEDRINE|NOR-EPHEDRINE|METHYLEPHEDRINE)$/, 1],
  ['berberine', /^(BERBERINE|PALMATINE|JATRORRHIZINE|COPTISINE|COLUMBAMINE)$/, 2],
  ['caffeine', /^(CAFFEINE|THEOPHYLLINE|THEOBROMINE)$/, 1],
  ['coumarin', /^(COUMARIN|COUMARINS)$/, 0.3],
  ['cyanogenic', /^(\([RS]\)-)?(AMYGDALIN|PRUNASIN|LINAMARIN|LOTAUSTRALIN|DHURRINE?|SAMBUNIGRIN|TAXIPHYLLIN|VICIANIN|GYNOCARDIN|CYANOGENIC-GLYCOSIDES?|HYDROCYANIC-ACID)$/, 0.2],
  ['saponin', /^(SAPONINS?|SAPONIN-GLYCOSIDES)$/, 3],
  ['glycyrrhizin', /^(GLYCYRRHIZIN|GLYCYRRHIZIC-ACID|GLYCYRRHIZINIC-ACID|18-BETA-GLYCYRRHIZINIC-ACID)$/, 4],
  ['thujone', /^(\(-\)-)?(ALPHA-|BETA-|ALPHA-BETA-)?THUJONES?$/, 0.2],
  ['eucalyptol', /^(1,8-CINEOLE?|CINEOLE?|EUCALYPTOL)$/, 0.3],
  ['thymol', /^(THYMOL|CARVACROL)$/, 0.2],
  ['eugenol', /^EUGENOL$/, 0.2],
  ['menthol', /^(\([+-]\)-)?MENTHOL$/, 0.4],
  // Capsaicin is left out on purpose: creams do relieve pain, but the pain model has no topical hook, and
  // a class with no modelled target would only pretend. Chilli is inert here.
  ['oxalate', /^(OXALIC-ACID|OXALATES?|CALCIUM-OXALATE)$/, 1],
];
const classOf = (chem) => CLASSES.find(([, re]) => re.test(chem));

// ——— Duke folk uses → the game's complaints and conditions, where the mapping is obvious.
const USES = {
  Fever: 'fever', Malaria: 'malaria', Diarrhea: 'watery_diarrhea', Dysentery: 'dysentery',
  Cough: 'cough', Bronchitis: 'cough', Cold: 'common_cold', Catarrh: 'common_cold', Pneumonia: 'pneumonia',
  Wound: 'wound', Vulnerary: 'wound', Sore: 'wound', Burn: 'burn', Boil: 'wound_infected',
  Vermifuge: 'worms', Anthelmintic: 'worms', Ascaricide: 'worms',
  Itch: 'itch', Scabies: 'scabies', Mange: 'scabies',
  Anodyne: 'pain', 'Ache(Head)': 'pain', 'Ache(Tooth)': 'pain', 'Ache(Back)': 'back_pain', Rheumatism: 'back_pain',
  Dropsy: 'heart_failure', Cardiotonic: 'heart_failure', Diuretic: 'swelling',
  Emetic: 'vomiting', Nausea: 'nausea', 'Ache(Stomach)': 'stomach_ache', Colic: 'cramp', Spasm: 'cramp',
  Laxative: 'constipation', Purgative: 'constipation', Astringent: 'loose_stool',
  'Sore(Throat)': 'sore_throat', Earache: 'earache', 'Ache(Ear)': 'earache',
  Antiseptic: 'antiseptic', Bactericide: 'antiseptic', Jaundice: 'jaundice', Anemia: 'anaemia',
  Poison: 'poison', Narcotic: 'poison',
};

// ——— plant parts worth gathering (Duke PPCO codes). Essential oil, pollen, exudates etc. are skipped.
const PARTS = { LF: 'leaf', BK: 'bark', RT: 'root', SD: 'seed', FR: 'fruit', FL: 'flower', RH: 'rhizome', ST: 'stem', TU: 'tuber', BU: 'bulb', SH: 'shoot', PL: 'plant', WD: 'wood' };
// methods that make sense for a part (preparations.js ids); 'dry' is always available.
const METHODS = { leaf: ['infusion', 'tincture'], shoot: ['infusion', 'tincture'], plant: ['infusion', 'tincture'], flower: ['infusion', 'tincture'],
  bark: ['decoction', 'tincture'], root: ['decoction', 'tincture'], rhizome: ['decoction', 'tincture'], wood: ['decoction', 'tincture'], stem: ['decoction', 'tincture'],
  seed: ['powder'], fruit: ['powder', 'decoction'], tuber: ['powder', 'decoction'], bulb: ['powder', 'decoction'] };
const LIFE = [[/bamboo|^tree|shrub or tree|tree or shrub/, 'tree'], [/climb|liana|scrambl|vine/, 'climber'], [/succulent|cactus/, 'succulent'], [/shrub/, 'shrub'], [/epiphyte|lithophyte/, 'epiphyte'], [/geophyte|bulb/, 'geophyte'], [/.*/, 'herb']];
const CLIM = { 'wet tropical': 'wt', 'seasonally dry tropical': 'sd', 'montane tropical': 'mt', 'subtropical': 'st', 'subtropical or tropical': 'st', 'desert or dry shrubland': 'dr', 'temperate': 'te', 'subalpine or subarctic': 'sa' };

// The 12 plants of the valley are hand-written in herbs.js (own habitat, part, note and refs): skipped here.
const HAND = new Set(['Salix alba', 'Cinchona pubescens', 'Artemisia annua', 'Digitalis purpurea', 'Brugmansia arborea',
  'Aloe vera', 'Carica papaya', 'Psidium guajava', 'Azadirachta indica', 'Eucalyptus globulus', 'Zingiber officinale', 'Zea mays']);
// Which part a gatherer would take: the one carrying the classes that actually do something.
const WEIGHT = { digitoxin: 5, cardenolide: 5, quinine: 5, aconitine: 5, aristolochic: 5, tropane: 5, berberine: 4, ephedrine: 4,
  aloin: 3, emodin: 3, salicin: 3, pyrrolizidine: 3, caffeine: 3, capsaicin: 2, thymol: 2, menthol: 2, eucalyptol: 2, thujone: 2, cyanogenic: 2 };
const score = (m) => [...m.keys()].reduce((a, c) => a + (WEIGHT[c] || 1), 0);
const total = (m) => [...m.values()].reduce((a, v) => a + v[1], 0);
const r3 = (n) => +n.toPrecision(2);
const id = (n) => n.toLowerCase().replace(/[^a-z]+/g, '_');

// ——— a minimal CSV reader for Duke's quoted, latin-1 files
function csv(path) {
  const text = readFileSync(path, 'latin1');
  const rows = [];
  let f = '', row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.trim()); f = ''; if (row.length > 1) rows.push(row); row = []; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f.trim()); rows.push(row); }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// ——— 1. Duke taxa and their chemistry
const tax = new Map();   // FNFNUM → { name, genus, species, family }
for (const t of csv(join(DUKE, 'FNFTAX.csv'))) {
  if (!t.GENUS || !t.SPECIES || t.SUBSPECIES || t.VARIETY || /\bsp{1,2}\.?$|^x /i.test(t.SPECIES)) continue;
  tax.set(t.FNFNUM, { name: t.GENUS + ' ' + t.SPECIES, genus: t.GENUS, species: t.SPECIES, family: t.FAMILY });
}
const content = new Map();  // name → part → class → [lo, hi, estimated]
for (const r of csv(join(DUKE, 'FARMACY_NEW.csv'))) {
  const t = tax.get(r.FNFNUM), part = PARTS[r.PPCO];
  if (!t || !part || r.QUANT_UNIT) continue;
  const cl = classOf(r.CHEM);
  if (!cl) continue;
  const lo = parseFloat(r.AMT_LO || r.AMT_OR_LO), hi = parseFloat(r.AMT_OR_HI || r.AMT_HI);
  let a, b, est = 0;
  if (isFinite(lo) || isFinite(hi)) {                      // ppm of the dry part → % of dry weight
    a = (isFinite(lo) ? lo : hi) / 1e4; b = (isFinite(hi) ? hi : lo) / 1e4;
    if (!(b > 0) || b > 50) continue;
  } else { a = cl[2] * 0.5; b = cl[2] * 1.5; est = 1; }     // listed but never measured
  const byPart = content.get(t.name) || (content.set(t.name, new Map()), content.get(t.name));
  const byClass = byPart.get(part) || (byPart.set(part, new Map()), byPart.get(part));
  const prev = byClass.get(cl[0]);
  if (!prev || (prev[2] && !est) || (prev[2] === est && b > prev[1])) byClass.set(cl[0], [Math.min(a, b), Math.max(a, b), est]);
}

// ——— 1b. common names (first one Duke lists)
const common = new Map();
for (const c of csv(join(DUKE, 'COMMON_NAMES.csv'))) if (!common.has(c.FNFNUM) && /^[A-Za-z][A-Za-z' -]+$/.test(c.CNNAM)) common.set(c.FNFNUM, c.CNNAM);
const commonOf = new Map([...tax].filter(([n]) => common.has(n)).map(([n, t]) => [t.name, common.get(n)]));

// ——— 2. Duke ethnobotany: folk uses per species
const uses = new Map();
for (const e of csv(join(DUKE, 'ETHNOBOT.csv'))) {
  const u = USES[e.ACTIVITY];
  if (!u || !e.GENUS || !e.SPECIES) continue;
  const name = e.GENUS + ' ' + e.SPECIES;
  if (!content.has(name)) continue;
  (uses.get(name) || uses.set(name, new Set()).get(name)).add(u);
}

// ——— 3. WCVP: accepted name, family, life form, climate (two streaming passes over a 300 MB file)
async function wcvpPass(want, byId) {
  const rl = createInterface({ input: createReadStream(join(WCVP, 'wcvp_names.csv'), 'utf8'), crlfDelay: Infinity });
  let head = null;
  const out = new Map();
  for await (const line of rl) {
    const f = line.split('|');
    if (!head) { head = f; continue; }
    const g = { id: f[0], rank: f[2], status: f[3], family: f[4], genus: f[6], species: f[8], life: f[19], clim: f[20], acc: f[23] };
    if (g.rank !== 'Species') continue;
    const name = g.genus + ' ' + g.species;
    if (byId) { if (byId.has(g.id)) out.set(g.id, g); continue; }
    if (!want.has(name)) continue;
    const prev = out.get(name);
    if (!prev || (prev.status !== 'Accepted' && g.status === 'Accepted')) out.set(name, g);
  }
  return out;
}
const hit = await wcvpPass(new Set(content.keys()), null);
const needIds = new Set([...hit.values()].filter((g) => g.status !== 'Accepted' && g.acc).map((g) => g.acc));
const accepted = needIds.size ? await wcvpPass(null, needIds) : new Map();

// ——— 4. one row per species
const seen = new Set();
const rows = [];
for (const [name, byPart] of content) {
  let g = hit.get(name);
  if (!g) continue;
  if (g.status !== 'Accepted') g = accepted.get(g.acc);
  if (!g || !g.clim || !CLIM[g.clim]) continue;
  const acc = g.genus + ' ' + g.species;
  if (seen.has(acc) || HAND.has(acc) || HAND.has(name)) continue;
  // the part that carries the most classes (ties: the richest)
  const best = [...byPart].sort((a, b) => score(b[1]) - score(a[1]) || total(b[1]) - total(a[1]))[0];
  if (!best || !METHODS[best[0]]) continue;
  const k = {};
  for (const [cl, [lo, hi, est]] of [...best[1]].sort()) k[cl] = est ? [r3(lo), r3(hi), 1] : [r3(lo), r3(hi)];
  seen.add(acc);
  rows.push({ i: id(acc), n: acc, cn: commonOf.get(name) || '', f: g.family, l: LIFE.find(([re]) => re.test(g.life || ''))[1], c: CLIM[g.clim], p: best[0], k, u: [...(uses.get(name) || [])].sort() });
}
rows.sort((a, b) => a.i.localeCompare(b.i));

// ——— 5. write the content module
const q = (s) => JSON.stringify(s);
const line = (r) => `{i:'${r.i}',n:${q(r.n)},${r.cn ? `cn:${q(r.cn)},` : ''}f:'${r.f}',l:'${r.l}',c:'${r.c}',p:'${r.p}',k:{${Object.entries(r.k).map(([c, v]) => `${c}:[${v}]`).join(',')}}${r.u.length ? `,u:[${r.u.map((u) => `'${u}'`).join(',')}]` : ''}},`;
const classes = [...new Set(rows.flatMap((r) => Object.keys(r.k)))].sort();
writeFileSync(OUT, `// flora.js — GENERATED by tools/build_flora.mjs. Do not edit by hand.
//
// The world's medicinal plants, from two open datasets:
//   • USDA Dr. Duke's Phytochemical and Ethnobotanical Databases (public domain / CC0): which
//     compounds each species holds, in ppm of the dry part, and what people use it for.
//   • Kew World Checklist of Vascular Plants, WCVP (CC BY 4.0): accepted name, family, life form and
//     climate. See CREDITS.md.
//
// Short keys: i id · n accepted Latin name · f family · l life form · c climate · p part used ·
// cn common name (Duke's first) · k compound class → [low, high] % of DRY weight (a third element 1 = Duke lists the compound but
// never measured it, so the class's typical content is used — an estimate) · u folk uses.
// Climates: wt wet tropical · sd seasonally dry tropical · mt montane tropical · st subtropical ·
// dr desert or dry shrubland · te temperate · sa subalpine or subarctic.
//
// Effects come from the compound CLASS (content/flora_actives.js), never from a per-species rating:
// strength = content × extraction (preparations.js) × PK (pk.js). ${rows.length} species, ${classes.length} classes.
export const FLORA = [
${rows.map(line).join('\n')}
];
export const FLORA_BY_ID = new Map(FLORA.map((s) => [s.i, s]));
export const FLORA_CLASSES = [${classes.map((c) => `'${c}'`).join(', ')}];
`);
console.log(`${rows.length} species, ${classes.length} compound classes, ${(Buffer.byteLength(readFileSync(OUT)) / 1024).toFixed(0)} kB`);
console.log('uses mapped:', new Set(rows.flatMap((r) => r.u)).size, '· life forms:', [...new Set(rows.map((r) => r.l))].join(','), '· climates:', [...new Set(rows.map((r) => r.c))].join(','));
