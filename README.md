# A Clinic in the Valley (working title)

A village-clinic game built on the mechanics of `dont get lost` (seeded world, gathering, crafting,
building). Villagers walk in from the hamlets with real illnesses. You take a history, examine them
on a tappable body, decide what it is, and treat with remedies you made from the valley's plants or
bought from traders. Then the body does the rest, at home, hour by hour.

Clinical content follows **Where There Is No Doctor** (David Werner, Hesperian), paraphrased with
page references. The pharmacology is real: absorption, half-life, effective and toxic levels for each
compound, with sources.

- **Local preview:** `npm run serve` → http://127.0.0.1:3411
- Static ES modules, no build step, libraries vendored in `vendor/`.

## How it plays (phases 1–2: the herbal clinic and the Green Pages)

- **The valley** (`js/core/region.js`) is a 160×160 map made from the seed:
  - highlands in one corner and a river running down from them;
  - swamp, forest and dry scrub;
  - your village with a market square and a shop;
  - six hamlets joined by paths.

  Where people live decides what they catch: malaria near standing water, diarrhoea where the
  river is the water source.
- **People** (`people.js`, very basic for now): each hamlet has households whose people age, conceive, give
  birth and die on the 40-day calendar year (rural East African birth and death rates), so the valley grows
  over generations. Patients are drawn from them. A pregnant patient carries a foetus that takes in what her
  blood carries: drugs (`foetal` data on actives: vitamin A early on, NSAIDs late, ...) and illness (malaria,
  severe anaemia, high fever) add harm, and birth turns it into a stillbirth, a small baby or a marked one.
  Babies join the mother's household. Drugs in a baby under 2 months have their own harms (`newborn` data).
- **Patients** (`patient.js`, `clinic.js`) each have:
  - a seeded age, sex, weight, nutrition, pregnancy and haemoglobin;
  - their own drug clearance;
  - their own adherence and wealth;
  - one of 24 WTND conditions, already some hours or days in.

  How many come each day depends on your name in the valley and your fee.
- **The illness runs in the body** (`disease.js`). There are 11 models: viral, bacterial,
  falciparum malaria (parasite load, anaemia, acquired immunity), wound, burn, scabies, worms, pain,
  heart failure, morning sickness and pre-eclampsia. Water balance and dehydration run over all of
  them, along with poisoning, death hazard, and taking or skipping or stopping medicine at home.
- **Drugs act through PK/PD** (`pk.js`): a one-compartment model with first-order absorption, summed
  over every dose, plus:
  - Emax/Hill effects;
  - a parasite-reduction ratio for antimalarials;
  - auto-induction (artemisinin);
  - toxic thresholds.

  Gut-acting and skin-acting remedies are handled separately.
- **Diagnosis** (`signs.js`, `encounter.js`): findings are computed from the true state.
  - History questions cost minutes.
  - Examination is by body region, on an SVG figure (`js/ui/body.js`) that shows what you found.
  - Some exams need tools: watch, thermometer, scale, MUAC tape, magnifier, stethoscope, BP cuff.
  - A differential helper can be switched off.
- **Herbs → medicine** (`content/herbs.js`, `content/preparations.js`, `crafting.js`):
  - 12 real plants (Latin name, part, % content range, habitat, season, evidence, harms).
  - Methods: drying, powder, infusion, decoction, sour (acid) decoction, cold soak and tincture,
    each with its own extraction efficiency per compound.
  - Every plant and every batch differs in strength, and nobody tells you by how much.
- **The world's flora** (`content/flora.js`, `flora_herbs.js`, `core/flora.js`): 870 more species built
  from open data by `tools/build_flora.mjs` — USDA Dr. Duke's databases (public domain) for compound
  content in ppm of the dry part and for folk uses, Kew's WCVP (CC BY 4.0) for accepted name, family,
  life form and climate.
  - Every effect comes from one of **28 compound classes** (`content/flora_actives.js`): tannins,
    berberine, anthraquinones, saponins, cardiac glycosides, tropanes, pyrrolizidine alkaloids (liver),
    aristolochic acids (kidneys), aconitine, ephedrine, caffeine, cyanogenic glycosides, thujone,
    coumarin, oxalates, essential-oil antiseptics… Each class is written once, with real PK and
    toxicity and its own references. No species is rated by hand: strength = content × extraction × PK.
  - Each valley grows 200–400 climate-suitable species, scattered from the seed; the rest are
    trade-only. A plant out of its climate is thin and weak.
  - Hooks for the patient side: `floraNear(G, hamletId)`, `folkUses(speciesId)`,
    `lookalikes(speciesId)` (same genus or family — misidentification), `climateFit(speciesId)`.
- **Traders** (`content/vendors.js`, `economy.js`):
  - the village shop, open daily;
  - market day, every 7th day;
  - a wandering herb seller, whose goods are sometimes adulterated;
  - a tool peddler;
  - the mission medical stores, every 9–13 days, with sealed Green Pages medicines.

  About 1 in 10 medicines in poor markets is falsified or substandard (WHO 2017). Loose tablets
  from the market tray can be chalk.
- **Germs and antibiotics** (`content/organisms.js`, `disease.js`, `clinic.js`):
  - each bacterial infection is caught from a strain with its own MIC for each antibiotic;
  - antibiotics kill by their free blood level against that MIC (time-dependent for the
    penicillins, concentration-dependent for ciprofloxacin, mostly growth-stopping for the rest);
  - a level that sits between the MIC and the mutant-prevention level can breed resistance in the
    patient;
  - every course nudges the valley's resistance index; one clinic shifts it over decades, not seasons, and it
    fades slowly when a drug is rested (bacteria barely, malaria within about a decade);
  - the district health office sends a resistance bulletin each season (Ledger);
  - true penicillin allergy (~2%) shows as hives, rarely anaphylaxis.

  Malaria parasites carry the same kind of resistance (chloroquine widely resisted, artemisinins
  slowly slipping), and the bulletin reports it.
- **Green Pages medicines** (`content/medicines.js`): antibiotics, paracetamol, ibuprofen, aspirin,
  codeine, chloroquine, artemether–lumefantrine, artesunate, quinine tablets, mebendazole,
  albendazole, permethrin, benzyl benzoate, WHO ORS sachets, zinc, metronidazole, iron and
  vitamin A, each with real PK and the book's page.
  - Buy them from the shop, the market tray, the mission stores van, or **order by post**
    (Ledger): paid when posted, on your shelf in 4–8 days.
- **The import house** (Ledger → Order by post): dried material and seed packets of any species in the
  world table, plus the non-plant materia medica (`content/materia.js`: deer antler, cinnabar = mercury
  sulfide, realgar = arsenic sulfide). Priced and delayed by distance (3–8 weeks), and about one sack in
  three holds a different species altogether (Newmaster 2013; worse for antler). Seed can be planted;
  it grows as well as the climate allows.
- **More of the book** (phase 2): urinary infection, ear infection, strep throat, typhoid, amoebic
  dysentery, giardia, hookworm with anaemia (iron rebuilds the blood), and measles (vitamin A
  cuts deaths).
- **Injections** (`encounter.js` `injectNow`): benzathine and benzyl penicillin, ceftriaxone and adrenaline,
  given by your hand in the clinic with a syringe. An unboiled syringe can leave an abscess. An allergic
  patient reacts while you watch, and adrenaline within about half an hour mostly saves them from shock.
- **Consequences, not warnings** (`disease.js`, `pk.js`, data on `actives.js` and `conditions.js`):
  - untreated strep throat can bring rheumatic fever weeks later, and that can damage the heart years later;
    a 10-day penicillin course mostly prevents it;
  - bladder infections can climb to the kidneys, and ear infections into the mastoid;
  - iron, vitamin A and zinc poison in quantity;
  - ibuprofen or aspirin in a dehydrated child injures the kidneys;
  - rare reactions: a blistering rash from cotrimoxazole, Reye syndrome from aspirin in a child with a virus;
  - two weeks of daily codeine brings tolerance, and withdrawal on stopping;
  - too little antimalarial against a heavy infection can breed a resistant parasite.

  Where the evidence says a warning in the book is outdated, nothing happens: doxycycline in short courses does
  not stain children's teeth, and metronidazole with alcohol gave no reaction in trials.
- **Home remedies** (`homecare.js`): about 4 in 10 families have already been giving a tea of something
  that grows near home and is used for the illness. Ask to see the plant: now and then it is a lookalike.
  You can tell them to stop, or send them to gather a plant you know. They may not find it, or may bring
  back a lookalike. Either way the plant acts through its real compounds.
- **Chronic illness and emergencies** (WTND chapters 10, 11, 13, 22; four more models in `disease.js`: `chronic`,
  `asthma`, `fits`, `venom`):
  - asthma attacks (salbutamol, prednisolone, adrenaline); epilepsy and fever fits (phenobarbital every night,
    diazepam into the anus for a fit that will not stop);
  - high blood pressure on the cuff (amlodipine, hydrochlorothiazide, less salt) that brings stroke and heart failure
    over the years; stroke itself; diabetes (diet, the urine taste test) with foot sores; goitre (iodized oil);
    stomach ulcer (antacid, omeprazole; aspirin makes it bleed);
  - severe malnutrition, dry and wet (therapeutic food, feeding often), and anaemia from too little iron or folate;
  - snakebite and scorpion sting (horse-serum antivenom: a third react, a few with shock), kerosene swallowed,
    broken bones, sprains and arthritis.

  Months and years run 9 times faster than illness (time.js `COMPRESS`): a game year of high blood pressure carries
  a real year's stroke risk, and a child on therapeutic food recovers in about a game week.
- **Hindsight**: the ledger shows what it really was, what helped and what harmed, once the
  patient recovers or dies.

## Roadmap
- **Phase 2 (done):** Green Pages medicines from the mission stores and a mail-order catalogue;
  antibiotics with organism MICs and the valley's resistance index; eight more WTND conditions.
  Still to come from the book: injections (benzathine penicillin, ceftriaxone), TB, tetanus,
  meningitis, asthma, high blood pressure, eye problems, STIs, malnutrition, childbirth and the
  newborn.
- **Phase 3:** a chemistry lab: glassware, reagents, extraction, semi-synthesis and synthesis (willow →
  salicin → aspirin, cinchona → quinine, *Artemisia* → artemisinin → artesunate, paracetamol,
  sulfanilamide, compounding), with purity checks (melting point, TLC).
  - **Apothecary** (village): bring herbs and pay in coins or produce; he makes tinctures, extracts
    and pills, steadier and labelled in mg, dearer than making them yourself.
  - **Chemist** (town): purifies, semi-synthesises and makes anything (controlled drugs at game
    level only). He comes to town once your herbal skill is high enough; his price falls as your
    reputation rises. Hire him into a built dispensary and his work is faster, though it still takes
    real-world times.
- **Phase 4:** clinic → hospital: lab, ward, maternity, theatre, staff, community health.
- **The world's materia medica (done, before phase 3).** Built from open data; see "The world's flora"
  above and `CREDITS.md`. What is still missing: HerbMedPro-style evidence grading per species, and
  patients bringing in the remedies they gathered (the hooks in `core/flora.js` are there for it).
  - Sources: TCMBank (herb → ingredient; https://tcmbank.cn), USDA Dr. Duke's Phytochemical and Ethnobotanical
    Database (public domain, plant → compound with ppm), HerbMedPro (American Botanical Council; evidence per
    herb), PubMed. TCMBank's targets are network-pharmacology predictions, not effect sizes: never use them as
    `effects`. Cite facts per entry; don't bulk-copy any licensed database.
  - Getting what doesn't grow here (e.g. staghorn, deer antler):
    - a town medicine shop with an import catalogue: weeks by post, priced by distance, and often fake
      (adulterated antler and ginseng are common in real markets);
    - plants grown from bought seed or cuttings where the valley's climate allows, at a strength that
      depends on how well they suit it;
    - local plants and animals with their own real chemistry, never a stand-in for the imported one.
- **Later: full pregnancy/foetus/newborn physiology** (foetal growth, preterm labour, labour itself, breast milk
  carrying drugs, a newborn's slow drug clearance, bilirubin), replacing the basic models in `people.js`.
- After phase 1, if wanted: PWA hosting, APK and save sync, copied from `dont get lost`.

## The book
`sources/wtnd-book.tar.gz.gpg` holds *Where There Is No Doctor* (2011 PDF + extracted text), encrypted.
Unpack it with `gpg -d sources/wtnd-book.tar.gz.gpg | tar xz -C sources` (ask the owner for the password).

## Code
- `js/core/` — pure simulation (runs in Node): content tables, region, world diffs, PK, disease,
  signs, encounter, clinic, people, economy, crafting, actions, time.
- `js/game/` — Phaser 3 scene (tilemap, paperdoll villagers, walking, day/night), icons, sound.
- `js/ui/` — DOM HUD and panels; `body.js` is the examinable figure.
- `js/store.js` — IndexedDB saves (meta + one "valley" diff record).

## Tests & tools
```bash
npm test                                  # content integrity, region, PK, outcome bands
node tools/playtest.mjs <outdir> [--mobile]   # headless Chromium play-through (serves :3411)
node tools/used-icons.mjs | python3 tools/build_icons.py <game-icons repo>   # rebuild icons
node tools/build_flora.mjs --duke <dir> --wcvp <dir>   # rebuild content/flora.js from the open data
```
The outcome bands in `test/sim.test.mjs` are deliberately broad. Examples:
- a full 7-day quinine course cures more than 70% of child malaria;
- a 3-day course mostly recrudesces;
- an overdose poisons more than 8%;
- the rehydration drink cuts deaths from infant diarrhoea at least threefold.

## Not medical advice
This is a game. The numbers come from the cited sources, simplified. Do not treat anyone with it.

## License
- **Code:** MIT (see `LICENSE`).
- **Medical content:** the condition, sign and home-treatment content is paraphrased from *Where There Is
  No Doctor* © Hesperian Health Guides. It is **not** covered by MIT. Hesperian permits adaptation only
  when it is distributed free or at cost; commercial use needs their permission.
- **Art and fonts** keep their own licenses (CC0 tiles, CC BY 3.0 icons, OFL font); see `CREDITS.md`.
