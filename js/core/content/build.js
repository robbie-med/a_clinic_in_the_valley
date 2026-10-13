// build.js — what you can build at the clinic: stations (where remedies are made), storage, places
// for patients, and walls. Each becomes an item (made at the workbench or bought) that you place.
// Tiers grow the clinic: the hut → consult room → dispensary → (later) lab, ward, theatre.

import { localize } from '../i18n.js';

export const STATION_RANGE = 2;

export const PLACEABLES = [
  { id: 'hearth', name: 'Hearth', station: 'hearth', blocks: true, sprite: { gi: 'campfire', c: '#e08040' }, cost: [['mud_brick', 6]], price: 3, tier: 0,
    note: 'Boil water, brew teas and decoctions, melt ointments.' },
  { id: 'drying_rack', name: 'Drying rack', station: 'rack', container: 8, dries: true, blocks: true, sprite: { gi: 'stick-frame', c: '#b08850' }, cost: [['pole', 4], ['thatch', 1]], price: 4, tier: 0,
    note: 'Fresh herbs dry here in a day or three. Under a roof they will not mould in the rains.' },
  { id: 'steeping_jar', name: 'Steeping jars', station: 'jar', brews: true, blocks: true, sprite: { gi: 'mason-jar', c: '#b07a50' }, cost: [['clay_jar', 3], ['plank', 1]], price: 5, tier: 0,
    note: 'Cold soaks (a day) and tinctures (a week) steep here.' },
  { id: 'workbench', name: 'Workbench', station: 'bench', blocks: true, sprite: { gi: 'table', c: '#a07a4a' }, cost: [['plank', 4], ['nails', 2]], price: 6, tier: 0,
    note: 'Make furniture and building parts.' },
  { id: 'shelf', name: 'Medicine shelf', container: 20, blocks: true, sprite: { gi: 'bookshelf', c: '#9a7040' }, cost: [['plank', 3], ['nails', 1]], price: 5, tier: 0,
    note: 'Stock. What is here can be dispensed during a consultation.' , stock: true },
  { id: 'bench', name: 'Waiting bench', seat: true, blocks: false, sprite: { gi: 'wooden-chair', c: '#a08050' }, cost: [['plank', 2], ['nails', 1]], price: 3, tier: 0,
    note: 'Patients wait here. More seats, more patients willing to wait.' },
  { id: 'exam_bed', name: 'Examination bed', bed: true, blocks: true, sprite: { gi: 'bed', c: '#c0a070' }, cost: [['plank', 4], ['nails', 2], ['cloth', 2]], price: 8, tier: 1,
    note: 'A clean place to lie the patient down: examining the belly and chest is easier and more accurate.' },
  { id: 'herb_bed', name: 'Garden bed', garden: true, blocks: false, flat: true, sprite: { gi: 'flower-pot', c: '#7a5a3a' }, cost: [['pole', 2]], price: 1, tier: 0,
    note: 'Plant cuttings, roots and seeds of garden herbs.' },
  { id: 'wall_mud', name: 'Mud-brick wall', wall: true, blocks: true, sprite: { d: 'dngn/wall/sandstone_wall2', t: '#d0a078' }, cost: [['mud_brick', 4]], price: 1, tier: 0 },
  { id: 'door_wood', name: 'Door', door: true, blocks: false, sprite: { d: 'dngn/doors/closed_door' }, cost: [['plank', 2], ['nails', 1]], price: 3, tier: 0 },
  { id: 'floor_packed', name: 'Packed earth floor', floor: true, flat: true, ground: 'clinic_floor', cost: [['mud_brick', 1]], price: 0.3, tier: 0 },
];
// Shown text translates on read (i18n.js); the Korean lives in i18n/ko/items.js.
localize(PLACEABLES, ['name', 'note']);
