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
- **The living valley** (`people.js`, `village.js`, `blood.js`, `food.js`, `contagion.js`): every resident has a
  body that persists, and the valley runs every game day whether or not you see it.
  - Households grow maize and beans (sown with the rains, lifted at the end of the rains and the start of the cool
    dry season), keep cassava in the ground, buy grain while they have money, sell a chicken or a goat, then eat
    less. One year in six the rains fail; illness in the growing season costs the next harvest. Hunger thins people,
    lowers fertility, weakens defence against infection and, past ~75% of the median weight, kills.
  - Blood (`blood.js`): haemoglobin, the iron store, folate, red cell size and turnover, and the genes that shape
    them (sickle trait and disease, α-thalassaemia, inherited by Mendel). Iron comes from food (a few per cent of it
    from maize and beans, more when the store is empty, less while inflammation raises hepcidin) and from tablets;
    it leaves with monthly bleeding, hookworms, haemorrhage and the growing baby (~1000 mg a pregnancy). So
    anaemia in pregnancy is common, has several causes at once, and iron tablets mend only the part that wanted
    iron: malaria, hookworm, HIV, sickle cell disease, thalassaemia trait and folate need their own answers, and
    severe anaemia needs transfusion at the health centre.
  - Illness arises the way it does in a valley: germs pass at home, in the hamlet and on your waiting bench
    (`content/contagion.js`: faecal, airborne, skin, mosquito and sexual routes; measles, chickenpox and mumps
    come as epidemics as births dilute immunity, the measles vaccine protects most children); the rest happens at
    steady rates (`content/village.js`), and lifelong illness (high blood pressure, HIV, TB, worms…) is carried.
  - Anyone ill or pregnant has a record the game runs hour by hour (`disease.js simulate`), so what they bring to
    you is exactly what they have; every pregnancy runs as one, labour complications included. The sick decide
    each day whether to walk to you (how ill they feel, a small child, the distance, your fee and name, their
    means): that is who arrives. Emergencies at home are carried in. Deaths at home, the harvest and hunger come to
    you as news (Ledger → The valley).
  - A pregnant woman's foetus takes in what her blood carries: drugs (`foetal` data on actives) and illness
    (malaria, severe anaemia, high fever); birth turns it into a stillbirth, a small baby or a marked one. Babies
    join the mother's household with her genes and iron. Drugs in a baby under 2 months have their own harms.
  - Villagers are on the map, but only those in view are drawn (`schedule.js`: water at dawn, the field in the
    farming months, firewood, the market on market day, no cooking fire in a hungry house; the sick stay in).
- **The laboratory** (`content/lab.js`, `lab.js`): buy glassware and a microscope (mission stores, the post), or
  make crude glass in a kiln from river sand, wood ash and lime (cloudy slides read worse). Tests: haemoglobin by
  colour scale, Sahli or meter; thick and thin films (malaria parasites, red cell shape, the differential); white
  cell count in a counting chamber; reticulocytes; the sickling test; Kato-Katz stool for worm eggs; and a solar
  blood counter by post (reagent packs, a daily control, now and then a fault). Each reads the true blood
  (`signs.js bloodPicture`) through the method's own error and the reader's skill. Hindsight says why the blood was
  thin.
- **Staff** (`staff.js`, Ledger → Staff): hire people of the valley as a hunter (meat with haem iron for his family
  and your shelf; too many empty the bush), a herb gatherer (the plant you name, sometimes a lookalike) or a
  laboratory assistant (reads slides while you work, better with every slide, faster when you check them). Wages go
  home and feed the household; days away cost the farm.
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
  - History questions cost minutes. They are grouped by topic (the story, fever, head, chest, belly, urine, skin,
    pain and swelling, pregnancy, the child, background) and ask one thing each; "Tell me about it from the start"
    gets the story of the main illness. An answer gives what is there, or a plain "no".
  - What a patient says first is true when they say it: each complaint line names its claims (`says` in
    `conditions.js`), people come in while the illness shows (a semi-immune adult with silent parasites does not
    walk in with a fever), and they never "haven't noticed" what they came about. `test/history.test.mjs` checks
    every illness.
  - When they come back: better or worse since last time, which doses they missed or when they stopped, any
    trouble from the medicine, and how well they kept your advice.
  - Examination is by body region, on an SVG figure (`js/ui/body.js`) that shows what you found.
  - Some exams need tools: watch, thermometer, scale, MUAC tape, magnifier, stethoscope, BP cuff.
  - A differential helper can be switched off.
- **Advice** (`encounter.js` INSTRUCTIONS): one thing per line, grouped (medicine, when to come back, care at home,
  prevention, family, birth and the baby), and only what fits the person (age, sex, pregnancy, a newborn), never the
  diagnosis. "Come back at once if…" brings them back sooner when it turns bad. Prevention (a net, boiled water, a
  latrine, shoes, washed faces, no smoke) lowers what that person catches next (`epi.prevent`, with references).
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
- **Childbirth and the newborn** (WTND chapter 19; models `labour`, `bleeding`, `spasm`):
  - obstructed labour (refer: only the hospital can end it), bleeding after birth (oxytocin, misoprostol,
    ergometrine; misoprostol to take at home as soon as the baby comes), eclampsia (magnesium sulfate), childbirth
    fever, heavy miscarriage bleeding, ectopic pregnancy, breast infection;
  - newborn blood infection (ampicillin and gentamicin), infected cord, newborn tetanus (the mother's tetanus
    vaccine, a clean cord), jaundice (sunlight), the cold small baby (skin to skin);
  - the DMPA injection lowers how many babies the valley has. A pregnancy lasts about 29 game days (COMPRESS),
    and women in the valley die in childbirth at about 600 per 100,000.
- **The other infections** (WTND chapters 13–18, 21; models `mycobacterial`, `tetanus`, `hiv`):
  - TB of the lungs and neck glands, and leprosy, on the game calendar: six months of TB treatment is about 20 game
    days, cure depends on someone watching every dose, and isoniazid alone breeds resistance;
  - tetanus (antitoxin, diazepam; dirty wounds give it to the unvaccinated), meningitis (judged by what reaches the
    spinal fluid), cholera, hepatitis (an unboiled syringe can pass it on);
  - infections spread by sex, with "bring your partner"; syphilis harms the baby; HIV kept basic (no antiretrovirals);
  - impetigo, cellulitis, ringworm, pink eye, trachoma, eye injury, chickenpox and mumps.
- **Hindsight**: the ledger shows what it really was, what helped and what harmed, once the
  patient recovers or dies.

## Languages
English and Korean (한국어), switched at any time from the title screen, the HUD toggle or the Menu; the choice is
remembered, and a first visit follows the browser's language.
- `js/core/i18n.js` — `t('English text', vars)` everywhere a player reads something. The English is the key; a
  language pack maps it to its own words, so English needs no pack. Korean particles follow the word they attach to
  (`{who:이}` → 딸이 / 아들이 / 제가). Content tables translate on read (`localize()`), saved text (ledger, patient
  records) is stored as `msg()` and rendered in whatever language is current, and generated names are written in
  Hangul (`i18n/ko/names.js`).
- `js/core/i18n/ko/` — the Korean pack (one dictionary per area) and `glossary.md` (register and terms).
- Korean uses the Galmuri pixel font (OFL), loaded only when Hangul is on screen.
- **Adding a language:** add a row to `AVAILABLE` in `i18n.js`, copy `i18n/ko/` to `i18n/<code>/` and translate the
  values (keep the keys), give it its own `attach`/`name`/`cite` rules if its grammar needs them, add a font for its
  script if Pixelify Sans lacks it, then run `node tools/i18n-check.mjs <code> --list` until nothing is missing.
  `npm test` checks Korean coverage, and plays a consultation for every illness in Korean looking for leftover English.

## Roadmap
- **Phase 2 (done):** Green Pages medicines from the mission stores and a mail-order catalogue;
  antibiotics with organism MICs and the valley's resistance index; the rest of the book's illnesses (injections,
  TB, tetanus, meningitis, asthma, high blood pressure, eyes, STIs, malnutrition, childbirth and the newborn);
  history-taking and advice rebuilt. Still open: evidence grading per species (HerbMedPro-style).
- **Phase 3:** a chemistry lab: glassware, reagents, extraction, semi-synthesis and synthesis (willow →
  salicin → aspirin, cinchona → quinine, *Artemisia* → artemisinin → artesunate, paracetamol,
  sulfanilamide, compounding), with purity checks (melting point, TLC).
  - **Apothecary** (village): bring herbs and pay in coins or produce; he makes tinctures, extracts
    and pills, steadier and labelled in mg, dearer than making them yourself.
  - **Chemist** (town): purifies, semi-synthesises and makes anything (controlled drugs at game
    level only). He comes to town once your herbal skill is high enough; his price falls as your
    reputation rises. Hire him into a built dispensary and his work is faster, though it still takes
    real-world times.
- **Phase 4:** clinic → hospital: ward, maternity, theatre, community health (the lab, staff and the living valley are
  done: see above).
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
- After phase 1, if wanted: PWA hosting, APK and save sync, copied from `dont get lost`. (Hosting done:
  GitHub Pages at clinic.robbiemed.org.)

## Later plans (phase 5 and beyond; not scheduled)
- **Ask anything.** A game for doctors should let you ask about every body part and process. Build questions
  from parts, as a template: [how often / since when / how much] + [verb] + [object] ("How often do you take
  paracetamol?", "How often do you have sex?", "Do you drink alcohol?", "Any pain when you swallow?"). Answers come
  from properties of the person, so each verb and noun has to link to something real:
  - a **symptom vocabulary** for every body part, each with SOCRATES-style attributes (site, onset, character,
    radiation, timing, what makes it better or worse, severity) that illnesses fill in from their state, the way
    `signs.js` HISTORY rows do now;
  - a **life record** for each person (habits, diet, water source, work, sex and partners, alcohol, tobacco,
    medicines they buy, travel, who they live with), drawn from the population model so it is stable across
    visits and shared by a household;
  - honest uncertainty: "I don't know", answers that drift when the patient is embarrassed or the question is
    leading, and a parent who cannot know what a child feels.
- **Patient compliance as individuals.** Each person keeps advice and doses by their own habits, beliefs, money
  and trust in you, instead of one adherence number. Over-advising may then cost something.
- **Faster time.** A control to speed the clock, with chronic illness (already compressed, `COMPRESS`) and the
  everyday clock running at different rates.
- **Contracts.** People already persist and work for you (staff.js); still to come: contracts to build (a field of
  drying racks) and to staff it.
- **A bank** for loans.
- **An ultrasound** to buy (pregnancy dating, the baby's position, fluid in the belly).
- **Mechanics from the other apps** (e.g. `dont get lost`), where they fit.

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
