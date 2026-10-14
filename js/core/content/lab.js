// lab.js (content) — the clinic's laboratory: glassware and instruments, the reagents they use up, and the tests. The
// tests read the true blood and stool (signs.js bloodPicture) through each method's own error (core/lab.js). Glassware
// comes first from the mission stores and the post; later a kiln turns river sand, wood ash and lime into crude glass,
// and crude slides read worse (content/build.js, index.js). Prices in shillings (about the MSH International Medical
// Products Price Guide 2015 and laboratory suppliers' catalogues; estimates).
import { localize } from '../i18n.js';

/** Instruments (tools: kept, not used up; `glass` ones can break, `breaks` a use). */
export const LAB_TOOLS = [
  { id: 'microscope', name: 'Microscope (binocular, oil immersion)', price: 120, icon: 'microscope', color: '#5a6a8a', breaks: 0, note: 'Blood films for malaria and the cells, stool for worm eggs. Needs a lab bench and daylight or a lamp.' },
  { id: 'hb_scale', name: 'Haemoglobin colour scale', price: 3, icon: 'scroll-unfurled', color: '#c04040', breaks: 0, note: 'A drop of blood on the test paper, matched against ten shades: 3 to 10 g/dL, then 12 and 14.' },
  { id: 'sahli_set', name: 'Sahli haemoglobinometer', price: 14, icon: 'test-tubes', color: '#d08060', glass: true, breaks: 0.01, note: 'Blood turned brown with acid, diluted until it matches the glass standard. Cheap, slow, and rough.' },
  { id: 'neubauer', name: 'Counting chamber (Neubauer) and pipettes', price: 18, icon: 'eye-target', color: '#90b0d0', glass: true, breaks: 0.005, note: 'Diluted blood in a ruled chamber: count the white cells in the four corner squares.' },
  { id: 'hemocue', name: 'Haemoglobin meter (battery)', price: 160, icon: 'heart-beats', color: '#3a3a3a', breaks: 0.0005, note: 'A drop of blood in a cuvette; the reading in a minute, close to the laboratory\'s.' },
];
/** What the tests use up. */
export const LAB_SUPPLIES = [
  { id: 'lancet', name: 'Sterile lancets', price: 0.03, stack: 200, icon: 'syringe', color: '#d0d8e0', note: 'One finger prick each. Never used twice.' },
  { id: 'slide', name: 'Glass slides', price: 0.06, stack: 200, icon: 'stone-block', color: '#c8e0f0', note: 'One film or one stool smear each. Bought slides are clear; slides from your own kiln are cloudy and read worse.' },
  { id: 'giemsa', name: 'Giemsa stain', unit: 'ml', stack: 1000, price: 0.05, icon: 'vial', color: '#8040a0', note: 'Stains parasites and white cells. About 3 ml a film.' },
  { id: 'methanol', name: 'Methanol', unit: 'ml', stack: 1000, price: 0.01, icon: 'water-bottle', color: '#d0e8f0', note: 'Fixes a thin film before staining. Poison: never to drink.' },
  { id: 'immersion_oil', name: 'Immersion oil', unit: 'ml', stack: 100, price: 0.3, icon: 'water-drop', color: '#e8d080', note: 'A drop between the lens and the slide for the strongest lens.' },
  { id: 'hcl', name: 'Hydrochloric acid 0.1 N', unit: 'ml', stack: 1000, price: 0.01, icon: 'erlenmeyer', color: '#f0f0d0', note: 'For the Sahli method.' },
  { id: 'turk', name: "Türk's fluid", unit: 'ml', stack: 500, price: 0.03, icon: 'erlenmeyer', color: '#a0a0e0', note: 'Dilutes blood and bursts the red cells, leaving the white ones to count.' },
  { id: 'nmb', name: 'New methylene blue', unit: 'ml', stack: 250, price: 0.08, icon: 'vial', color: '#4060c0', note: 'Shows the young red cells (reticulocytes): how hard the marrow is working.' },
  { id: 'metabisulfite', name: 'Sodium metabisulfite', unit: 'g', stack: 500, price: 0.02, icon: 'powder-bag', color: '#f0f0f0', note: 'Takes the oxygen from a sealed drop of blood: sickle haemoglobin then bends its cells.' },
  { id: 'kk_kit', name: 'Kato-Katz kit (template and cellophane)', price: 0.15, stack: 100, icon: 'rolled-cloth', color: '#80c080', note: 'A measured 41.7 mg of stool under glycerol-soaked cellophane: count the worm eggs.' },
  { id: 'cuvette', name: 'Haemoglobin meter cuvettes', price: 0.6, stack: 100, icon: 'vial', color: '#e0e0e0', note: 'One a reading.' },
  { id: 'fbc_pack', name: 'Blood counter reagent pack', price: 1.2, stack: 50, icon: 'medical-pack', color: '#60a0c0', note: 'One full blood count. Each day the counter is used it needs a control run first (one pack).' },
  { id: 'counter_repair', name: 'Blood counter repair kit', price: 40, stack: 5, icon: 'cog', color: '#808080', note: 'Pump tubing, a valve and a fuse: what usually fails. Fitted when the counter next shows its fault.' },
];

/**
 * The tests. needs: instruments; uses: [[supply, n]]; bench: needs a lab bench within reach (microscopy, counts);
 * min: game minutes done by your own hand (a lab assistant's take theirs: core/lab.js); reveals: lab finding keys.
 * method: the error model (core/lab.js), with its source.
 */
export const LAB_TESTS = [
  { id: 'l_hb_scale', label: 'Haemoglobin: colour scale', needs: ['hb_scale'], uses: [['lancet', 1]], min: 2, reveals: ['lab_hb'], method: 'scale',
    ref: 'Stott GJ, Lewis SM. Bull World Health Organ 1995;73:369 (the WHO Haemoglobin Colour Scale)' },
  { id: 'l_hb_sahli', label: 'Haemoglobin: Sahli', needs: ['sahli_set'], uses: [['lancet', 1], ['hcl', 2]], min: 15, reveals: ['lab_hb'], method: 'sahli', ref: 'Whitehead RD et al. Ann N Y Acad Sci 2019;1450:147 (methods for haemoglobin)' },
  { id: 'l_hb_meter', label: 'Haemoglobin: meter', needs: ['hemocue'], uses: [['lancet', 1], ['cuvette', 1]], min: 2, reveals: ['lab_hb'], method: 'meter', ref: 'Whitehead RD et al. Ann N Y Acad Sci 2019;1450:147' },
  { id: 'l_thick', label: 'Thick blood film: malaria parasites', needs: ['microscope'], uses: [['lancet', 1], ['slide', 1], ['giemsa', 3], ['immersion_oil', 0.05]], bench: true, min: 40, reveals: ['lab_para'], method: 'thick',
    ref: 'WHO. Malaria microscopy quality assurance manual, version 2, 2016; WHO. Basic malaria microscopy, 2nd ed., 2010' },
  { id: 'l_thin', label: 'Thin blood film: red cells and differential', needs: ['microscope'], uses: [['lancet', 1], ['slide', 1], ['methanol', 1], ['giemsa', 3], ['immersion_oil', 0.05]], bench: true, min: 40, reveals: ['lab_morph', 'lab_diff'], method: 'thin',
    ref: 'CLSI H20-A2, Reference leukocyte differential count, 2007 (binomial error of a 100-cell count); WHO Basic malaria microscopy 2010' },
  { id: 'l_wbc', label: 'White cell count (counting chamber)', needs: ['neubauer', 'microscope'], uses: [['lancet', 1], ['turk', 0.4]], bench: true, min: 20, reveals: ['lab_wbc'], method: 'chamber',
    ref: 'Berkson J et al. Am J Physiol 1940;128:309 (the counting error of a haemocytometer)' },
  { id: 'l_retic', label: 'Reticulocyte count', needs: ['microscope'], uses: [['lancet', 1], ['slide', 1], ['nmb', 0.5], ['immersion_oil', 0.05]], bench: true, min: 35, reveals: ['lab_retic'], method: 'retic', ref: 'CLSI H44-A2, Methods for reticulocyte counting, 2004' },
  { id: 'l_sickle', label: 'Sickling test', needs: ['microscope'], uses: [['lancet', 1], ['slide', 1], ['metabisulfite', 0.2]], bench: true, min: 35, reveals: ['lab_sickle'], method: 'sickle', ref: 'WHO. Manual of basic techniques for a health laboratory, 2nd ed., 2003' },
  { id: 'l_stool', label: 'Stool for worm eggs (Kato-Katz)', needs: ['microscope'], uses: [['slide', 1], ['kk_kit', 1]], bench: true, min: 45, reveals: ['lab_eggs'], method: 'katokatz',
    ref: 'Nikolay B et al. Int J Parasitol 2014;44:765 (Kato-Katz sensitivity 53–80% in light infections, lowest for hookworm)' },
  { id: 'l_fbc', label: 'Full blood count (blood counter)', needs: [], station: 'analyser', uses: [['lancet', 1], ['fbc_pack', 1]], min: 8, reveals: ['lab_hb', 'lab_wbc', 'lab_mcv', 'lab_diff3'], method: 'counter', ref: 'Manufacturers\' precision for 3-part haematology analysers (estimate: Hb CV ~1.5%, WBC ~3%, MCV ~1%)' },
];
export const LAB_TEST = new Map(LAB_TESTS.map((x) => [x.id, x]));
// The laboratory in the clinic's growth: a bench for the microscope, a blood counter that runs on a small solar panel
// and a battery (both content/build.js PLACEABLES), and a kiln for glass.

/** How strongly each lab finding points toward each condition (encounter.js differential). */
export const LAB_POINTS = {
  lab_para: { malaria: 10 }, lab_eggs: { hookworm: 7, ascaris: 6 }, lab_hb: { anaemia: 6, hookworm: 2, malaria: 1 }, lab_wbc: { pneumonia: 2, meningitis: 2, typhoid: 1 },
  lab_morph: { anaemia: 3 }, lab_diff: { hookworm: 2, ascaris: 2, pneumonia: 1 }, lab_retic: { anaemia: 2, malaria: 1 }, lab_sickle: { anaemia: 2 }, lab_mcv: { anaemia: 2 }, lab_diff3: { pneumonia: 1 },
};

localize(LAB_TOOLS, ['name', 'note']);
localize(LAB_SUPPLIES, ['name', 'note']);
localize(LAB_TESTS, ['label']);
