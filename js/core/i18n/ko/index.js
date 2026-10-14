// Korean language pack. Each file maps English (the key, exactly as in the source) to Korean.
// Style and terms: glossary.md. Coverage: `node tools/i18n-check.mjs ko` (also run by npm test).
import { register, josa } from '../../i18n.js';
import { koName } from './names.js';
import ui from './ui.js';
import signs from './signs.js';
import clinic from './clinic.js';
import world from './world.js';
import conditionsA from './conditions_a.js';
import conditionsB from './conditions_b.js';
import actives from './actives.js';
import items from './items.js';
import flora from './flora.js';
import boot from './boot.js';
import village from './village.js';
import lab from './lab.js';

export const PARTS = { boot, ui, signs, clinic, world, conditionsA, conditionsB, actives, items, flora, village, lab };
// {who:이} with who = '저' (a patient speaking of themselves) reads 제가; an empty var takes no particle.
function attach(v, p) {
  if (v === '') return '';
  if ((v === '저' || v === '나' || v === '너') && (p === '이' || p === '가')) return { 저: '제가', 나: '내가', 너: '네가' }[v];
  return v + josa(v, p);
}
const cite = (s) => String(s).replace(/\bpp?\.\s?(\d[\d–\-,\s]*\d|\d)/g, (_, n) => `${n.trim()}쪽`);
register({ code: 'ko', label: '한국어', dict: Object.assign({}, ...Object.values(PARTS)), attach, name: koName, cite, listSep: ', ', sep: ' ' });
