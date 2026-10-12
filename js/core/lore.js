// lore.js — names for regions and places, and the notes a previous wanderer left in old caches.
// A tiny Tracery-style expander (#symbol# → random rule) driven by a seeded rng.
import { makeRng, pickBy } from './rng.js';

export function expand(text, grammar, rng, depth = 0) {
  if (depth > 8) return text;
  return text.replace(/#(\w+)(\.cap)?#/g, (_, k, capf) => {
    const opts = grammar[k];
    if (!opts) return k;
    let s = expand(pickBy(opts, rng()), grammar, rng, depth + 1);
    if (capf) s = s.charAt(0).toUpperCase() + s.slice(1);
    return s;
  });
}

const ROOTS = {
  meadow: ['Fair', 'Bright', 'Long', 'Clover', 'Lark', 'Honey', 'Sweet', 'Green', 'Hay', 'Wind'],
  forest: ['Oak', 'Elder', 'Hazel', 'Ash', 'Fern', 'Moss', 'Bramble', 'Thorn', 'Owl', 'Stag'],
  deepwood: ['Hollow', 'Gloam', 'Black', 'Whisper', 'Dim', 'Raven', 'Old', 'Night', 'Root', 'Shade'],
  taiga: ['Pine', 'Fir', 'Frost', 'Lynx', 'Needle', 'Grey', 'Cold', 'Elk', 'Spruce', 'Wolf'],
  tundra: ['White', 'Bleak', 'Rime', 'Wind', 'Bare', 'Skua', 'Lichen', 'Pale', 'Hoar', 'Still'],
  glacier: ['Ice', 'Glass', 'Frozen', 'Silent', 'Snow', 'Blue', 'Crystal', 'Starlit', 'Rime', 'Bitter'],
  swamp: ['Mire', 'Fen', 'Reed', 'Murk', 'Bog', 'Heron', 'Mist', 'Sedge', 'Toad', 'Drown'],
  jungle: ['Vine', 'Emerald', 'Orchid', 'Jade', 'Tangle', 'Parrot', 'Steam', 'Lush', 'Monkey', 'Rain'],
  savanna: ['Gold', 'Lion', 'Dust', 'Sun', 'Acacia', 'Amber', 'Wide', 'Thorn', 'Ochre', 'Zebra'],
  desert: ['Dune', 'Sun', 'Bone', 'Glass', 'Salt', 'Mirage', 'Scorch', 'Copper', 'Dry', 'Sand'],
  badlands: ['Red', 'Rust', 'Broken', 'Coyote', 'Canyon', 'Iron', 'Crag', 'Scar', 'Hollow', 'Mesa'],
  ashland: ['Ash', 'Cinder', 'Ember', 'Grey', 'Dead', 'Soot', 'Pyre', 'Hollow', 'Wraith', 'Burnt'],
  mountain: ['High', 'Stone', 'Eagle', 'Storm', 'Cloud', 'Granite', 'Thunder', 'Crown', 'Grey', 'Iron'],
  beach: ['Gull', 'Tide', 'Shell', 'Salt', 'Driftwood', 'Foam', 'Pearl', 'Wreck', 'Sand', 'Seal'],
};
const SUFFIX = {
  meadow: ['field', 'lea', 'meadow', 'downs', 'vale', 'mead'], forest: ['wood', 'holt', 'grove', 'weald', 'shaw', 'forest'],
  deepwood: ['wood', 'deep', 'hollow', 'tangle', 'wild', 'dark'], taiga: ['pines', 'wood', 'reach', 'forest', 'march'],
  tundra: ['waste', 'barrens', 'steppe', 'flats', 'moor'], glacier: ['ice', 'field', 'shelf', 'expanse', 'wastes'],
  swamp: ['fen', 'mire', 'marsh', 'bog', 'sink'], jungle: ['tangle', 'green', 'basin', 'deep', 'weald'],
  savanna: ['plain', 'veld', 'grass', 'reach', 'lands'], desert: ['sands', 'dunes', 'waste', 'erg', 'flats'],
  badlands: ['breaks', 'canyons', 'mesas', 'scar', 'reach'], ashland: ['wastes', 'barrens', 'ashes', 'pall', 'blight'],
  mountain: ['peaks', 'spires', 'range', 'heights', 'teeth', 'crags'], beach: ['strand', 'shore', 'coast', 'sands', 'bay'],
};

/** "Hollowmere Wood" style region name. */
export function regionName(seed, rx, ry, biome) {
  const rng = makeRng(seed, 'region', rx, ry);
  const roots = ROOTS[biome] || ROOTS.meadow, suf = SUFFIX[biome] || SUFFIX.meadow;
  const a = pickBy(roots, rng()), b = pickBy(roots, rng());
  const style = rng();
  if (style < 0.4) return `${a}${b.toLowerCase()} ${cap(pickBy(suf, rng()))}`;
  if (style < 0.75) return `The ${a} ${cap(pickBy(suf, rng()))}`;
  return `${a}${pickBy(['mere', 'ford', 'stead', 'wick', 'hold', 'dale', 'combe', 'more'], rng())} ${cap(pickBy(suf, rng()))}`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Name for a point of interest. */
export function placeName(seed, x, y, kind, biome) {
  const rng = makeRng(seed, 'place', x, y);
  const r = pickBy(ROOTS[biome] || ROOTS.meadow, rng());
  const base = {
    camp: ['Camp', 'Hearth', 'Bivouac', 'Rest'], ruin: ['Ruins', 'Walls', 'Keep', 'Hall'], stones: ['Stones', 'Circle', 'Ring', 'Henge'],
    statue: ['Watcher', 'Sentinel', 'Idol', 'Statue'], spring: ['Spring', 'Well', 'Font', 'Pool'], vault: ['Vault', 'Archive', 'Undercroft', 'Sanctum'],
    meteor: ['Starfall', 'Crater', 'Scar', 'Fallen Star'], bones: ['Boneyard', 'Ossuary', 'Graveyard', 'Bones'],
  }[kind] || ['Place'];
  return `${r}${rng() < 0.5 ? ' ' : pickBy(['s ', 'en ', 'ing ', ' '], rng())}${pickBy(base, rng())}`.replace(/\s+/g, ' ');
}

const NOTE = {
  origin: ['#open# #body# #close#'],
  open: ['Day #num#.', 'If you are reading this, I made it this far.', 'Whoever finds this —', 'Note to myself, in case I come back:', 'The #weather# has not let up for #num# days.', 'Third time I have passed this way.'],
  body: ['I left #thing# here and went #dir# toward the #land#.', 'The #beast# came at dusk. I do not think it will forget my smell.', 'Follow the river #dir#; there is #thing# where it bends.',
    'Do not trust the #land# at night. Something walks there that is not a #beast#.', 'I marked the way with cairns. Count them: #num#, then turn #dir#.', 'Found the old road again. It runs #dir# for longer than I can walk in a day.',
    'There is #thing# buried under the #tree# with the split trunk. Take it if you need it more than I do.', 'The #beast# tracks lead #dir#. I am going the other way.', 'Ran out of #need#. Ate #food# and prayed.',
    'I keep seeing the same #landmark#. Either I am walking in circles or there are many of them.', 'Whoever built the #landmark# knew the stars. It points #dir#.'],
  close: ['Do not get lost.', 'Keep the fire lit.', 'I will come back for the rest.', 'Leave something for the next one.', '— W.', 'Tell no one about the #landmark#.', 'Walk light.'],
  num: ['two', 'three', 'four', 'seven', 'nine', 'eleven', 'forty'], dir: ['north', 'south', 'east', 'west', 'north-east', 'south-west', 'downhill', 'upstream'],
  land: ['ash wastes', 'red canyons', 'pine country', 'fens', 'high passes', 'grey moors', 'dunes', 'deep wood'],
  beast: ['wolf', 'bear', 'warg', 'wyvern', 'ghoul', 'manticore', 'big cat that is not a cat', 'thing with too many legs'],
  thing: ['salt and a good knife', 'seed for next spring', 'my spare boots', 'a map I could not finish', 'copper, two bars', 'a little food'],
  tree: ['oak', 'pine', 'birch', 'dead tree', 'yew'], need: ['salt', 'water', 'thread', 'courage', 'arrows'], food: ['bark', 'roots', 'old jerky', 'snow'],
  weather: ['rain', 'snow', 'ash-fall', 'wind', 'heat'], landmark: ['standing stone', 'statue', 'ruined tower', 'cairn', 'stone circle'],
};
export function cacheNote(seed, x, y) {
  return expand('#origin#', NOTE, makeRng(seed, 'note', x, y));
}
