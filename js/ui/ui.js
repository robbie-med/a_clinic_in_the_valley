// ui.js — the DOM interface over the Phaser canvas: HUD (day, season, clock, money, name in the
// valley, who is waiting), touch controls, toasts, and the panels: the consultation (talk, examine the
// body, notes, treat), bag, making remedies, building, traders, shelves/racks/jars, handbook, ledger,
// map, menu.
import { iconURL } from '../game/icons.js';
import { sfx, setSound } from '../game/sfx.js';
import { moveStack, sortInv, count, addItem } from '../core/inventory.js';
import { make, blocker, level, collectBrew, stationName, specName } from '../core/crafting.js';
import { clock, day, season, SEASON_NAMES, minuteOfDay, DAY, HOUR } from '../core/time.js';
import { CONDITIONS, COND } from '../core/content/conditions.js';
import { HERBS, HERB } from '../core/content/herbs.js';
import { ACTIVES, ACTIVE } from '../core/content/actives.js';
import { ORGANISMS, ORG } from '../core/content/organisms.js';
import { METHODS } from '../core/content/preparations.js';
import { PLACEABLES } from '../core/content/build.js';
import { VENDORS } from '../core/content/vendors.js';
import { stock, buy, sell, offer, LOT, lotPrice, nextVisit, CATALOGUE, IMPORT, catalogueItems, importItems, orderTotal, placeOrder, unitWord } from '../core/economy.js';
import { lookalikes, climateFit } from '../core/flora.js';
import { teaOf } from '../core/homecare.js';
import { CLIMATE } from '../core/content/flora_herbs.js';
import { startEncounter, ask, examine, differential, questionsFor, examsFor, remedies, rxLine, doseInfo, stockOf, finishEncounter, doProcedure, injectNow, toolsAt, adviceFor, PROCEDURES, INSTRUCTIONS } from '../core/encounter.js';
import { who, hamletOf, ageWords, OPEN, CLOSE, healthReport } from '../core/clinic.js';
import { medianWeight, say } from '../core/patient.js';
import { bodySVG, REGIONS } from './body.js';
import { makeRng } from '../core/rng.js';
import { t, tc, tm, cite, personName, loadLang, getLang, AVAILABLE, en } from '../core/i18n.js';
import { create as nipple } from '../../vendor/nipplejs.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
};
const icon = (ic, size = 40) => h('img', { src: iconURL(ic, size), alt: '' });
const amt = (it, n) => (it.unit === 'g' ? `${fmt(n)} g` : it.unit === 'ml' ? (n >= 1000 ? `${fmt(n / 1000)} L` : `${fmt(n)} ml`) : it.unit === 'app' ? t('{n} appl.', { n: fmt(n) }) : `×${fmt(n)}`);
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.abs(n) >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100).toString();
const sh = (n) => t('{n} sh', { n: fmt(n) });
const SEASON_CLASS = { cool_dry: 'cool', hot_dry: 'hot', rains: 'rain', late_rains: 'late' };
// ——— words for the interface (i18n.js): text from other modules may be a finished string or a msg
const txt = (x) => (x == null ? '' : typeof x === 'string' ? x : tm(x));
const lc = (s) => String(s).toLowerCase();
const unitName = (u) => unitWord(u);
const catName = (c) => ({ build: tc('category', 'build'), herb: tc('category', 'herb'), ingredient: tc('category', 'ingredient'), materia: tc('category', 'materia'), material: tc('category', 'material'),
  medicine: tc('category', 'medicine'), produce: tc('category', 'produce'), remedy: tc('category', 'remedy'), seed: tc('category', 'seed'), tool: tc('category', 'tool') })[c] ?? c;
const evidenceName = (e) => ({ strong: tc('evidence', 'strong'), some: tc('evidence', 'some'), traditional: tc('evidence', 'traditional'), harmful: tc('evidence', 'harmful') })[e] ?? e;
const habitatName = (k) => ({ village: tc('habitat', 'village'), field: tc('habitat', 'field'), scrub: tc('habitat', 'scrub'), forest: tc('habitat', 'forest'), riverbank: tc('habitat', 'riverbank'),
  swamp: tc('habitat', 'swamp'), highland: tc('habitat', 'highland') })[k] ?? k;
const partName = (k) => ({ bark: tc('part', 'bark'), leaf: tc('part', 'leaf'), seeds: tc('part', 'seeds'), root: tc('part', 'root'), silk: tc('part', 'silk'), fruit: tc('part', 'fruit'),
  flower: tc('part', 'flower'), plant: tc('part', 'plant'), seed: tc('part', 'seed'), rhizome: tc('part', 'rhizome'), shoot: tc('part', 'shoot'), bulb: tc('part', 'bulb'), stem: tc('part', 'stem'),
  tuber: tc('part', 'tuber'), wood: tc('part', 'wood') })[k] ?? k;
const lifeName = (k) => ({ herb: tc('life', 'herb'), shrub: tc('life', 'shrub'), tree: tc('life', 'tree'), climber: tc('life', 'climber'), geophyte: tc('life', 'geophyte'), epiphyte: tc('life', 'epiphyte'),
  succulent: tc('life', 'succulent') })[k] ?? k;
const statusName = (s) => ({ waiting: tc('status', 'waiting'), arriving: tc('status', 'arriving'), consult: tc('status', 'consult'), leaving: tc('status', 'leaving'), home: tc('status', 'home'),
  dead: tc('status', 'dead'), hospital: tc('status', 'hospital') })[s] ?? s;
// what a hindsight note names (actives, advice, procedures: conditions.js teach.treat/helps/harms)
const gaveName = (id) => ACTIVE.get(id)?.name ?? INSTRUCTIONS.find((x) => x.id === id)?.label ?? PROCEDURES.find((x) => x.id === id)?.label ?? (id === 'artemisinin_alone' ? t('artemisinin alone') : id);
// what a compound's effect acts on (actives.js `effects[].on`), as the handbook names it
const effectName = (k) => ({ acid: t('Stomach acid'), airway: t('Opening the airways'), antitoxin: t('Neutralising venom'), bp: t('Lowering blood pressure'), burn: t('Healing burns'),
  congestion: t('Blocked nose'), cough: tc('effect', 'Cough'), cramp: t('Cramps'), eye: t('Eye infection'), feed: t('Nourishment'), fever: tc('effect', 'Fever'), fits: t('Preventing fits'),
  fluid_out: t('Passing water (fluid out)'), folate: t('Folate'), gi_harm: t('Harm to the stomach'), heart: t('Heartbeat'), iodine: t('Iodine'), iron: t('Iron'), nausea: t('Nausea'), pain: tc('effect', 'Pain'),
  plasmodium: t('Malaria parasites'), scabies: t('Scabies mites'), seizure: t('Stopping a seizure'), spasm: t('Muscle spasm'), steroid: t('Swelling and inflammation'), stool: t('Loose stools'),
  tinea: t('Ringworm (tinea)'), uterus: t('Tightening the womb'), vita: t('Vitamin A'), worms_ascaris: t('Roundworm'), worms_hookworm: t('Hookworm'), worms_pinworm: t('Pinworm'), wound: t('Healing wounds') })[k] ?? k;
// the short form of a language for the HUD toggle: EN, 한
const langShort = ([code, label]) => (/^[A-Za-z]/.test(label) ? code.toUpperCase() : label.charAt(0));

export function makeUI(G) {
  const root = $('#ui');
  root.innerHTML = '';
  const S = { panel: null, arg: null, sel: null, enc: null, encTab: 'talk', encRight: 'notes', region: null, rx: null, hbTab: 'conditions', hbSel: null, ledTab: 'patients', ledSel: null, makeSel: null, makeTimes: 1, helper: true, typing: false };
  const ui = {};

  // ———————————————————————————————————— HUD
  // the language toggle stays put inside the info block (tick rebuilds everything before it)
  const langBtn = h('button', { class: 'langbtn', onclick: () => { const i = AVAILABLE.findIndex(([c]) => c === getLang()); ui.setLang(AVAILABLE[(i + 1) % AVAILABLE.length][0]); } });
  const info = h('div', { class: 'hud-info' }, langBtn);
  const waitBtn = h('button', { class: 'waitbtn hidden', onclick: () => G.scene.nextPatient() });
  const side = h('div', { class: 'sidebtns' });
  const SIDE = [['bag', 'knapsack', 'I'], ['make', 'pestle-mortar', 'C'], ['build', 'hammer-nails', 'B'], ['handbook', 'open-book', 'H'], ['ledger', 'notebook', 'L'], ['map', 'treasure-map', 'M'], ['wait', 'sun', 'T'], ['menu', 'cog', 'Esc']];
  const sideLabel = (p) => ({ bag: t('Bag'), make: t('Make'), build: t('Build'), handbook: t('Book'), ledger: t('Ledger'), map: t('Map'), wait: t('Wait'), menu: t('Menu') })[p];
  const hot = h('div', { class: 'hotbar' });
  const heldName = h('div', { class: 'heldname' });
  const toasts = h('div', { class: 'toasts' });
  const banner = h('div', { class: 'banner' });
  const panel = h('div', { class: 'panel hidden' });
  const touch = h('div', { class: 'touch hidden' }, h('div', { class: 'joyzone' }));
  const useLabel = h('span', {});
  const controls = h('div', { class: 'controls hidden' },
    h('button', { class: 'runbtn', onpointerdown: () => { G.input.sprint = !G.input.sprint; controls.querySelector('.runbtn').classList.toggle('on', G.input.sprint); } }, icon({ gi: 'sprint', c: '#e8dcc0' }, 28)),
    h('button', { class: 'mainhand', onclick: () => G.scene.useNearest() }, icon({ gi: 'hand', c: '#f4ead2' }, 48), useLabel));
  // the words on the fixed buttons (built once; again when the language changes)
  const label = () => {
    side.replaceChildren(...SIDE.map(([p, ic, key]) => h('button', { class: 'hudbtn', title: `${sideLabel(p)} (${key})`, onclick: () => ui.toggle(p) }, icon({ gi: ic, c: '#e8dcc0' }, 26), h('span', {}, sideLabel(p)))));
    useLabel.textContent = t('Use');
    langBtn.replaceChildren(...AVAILABLE.flatMap((l, i) => [i ? ' | ' : '', h(l[0] === getLang() ? 'b' : 'span', {}, langShort(l))]));
    langBtn.title = t('Language') + ': ' + AVAILABLE.map((l) => l[1]).join(' / ');
  };
  label();
  document.documentElement.lang = getLang(); // :lang(ko) rules in style.css
  root.append(info, waitBtn, side, hot, heldName, toasts, banner, controls, touch, panel);

  G.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (G.touch) {
    touch.classList.remove('hidden'); controls.classList.remove('hidden');
    document.body.classList.add('is-touch');
    // nipplejs 1.x: handlers get ONE event object; the stick data is on evt.data.
    const joy = nipple({ zone: $('.joyzone', touch), mode: 'dynamic', color: '#e8dcc0', size: 120, threshold: 0.05, fadeTime: 120 });
    joy.on('move', (evt) => {
      const d = evt.data;
      if (!d?.vector) return;
      const f = Math.min(1, d.force ?? 1), vx = d.vector.x, vy = -d.vector.y, m = Math.hypot(vx, vy) || 1;
      const k = f < 0.12 ? 0 : Math.min(1, f) / m;
      G.input.joy.x = vx * k * m; G.input.joy.y = vy * k * m;
    });
    joy.on('end', () => { G.input.joy.x = 0; G.input.joy.y = 0; });
  }

  ui.ready = () => { ui.refresh(); ui.tick(); };
  ui.modal = () => !!S.panel;
  ui.typing = () => S.typing || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  ui.tick = () => {
    const now = G.W.time, cl = G.meta.clinic;
    const waiting = Object.values(cl.patients).filter((p) => p.status === 'waiting').length;
    const coming = Object.values(cl.patients).filter((p) => p.status === 'arriving').length;
    const m = minuteOfDay(now);
    const open = m >= OPEN && m <= CLOSE;
    while (info.firstChild && info.firstChild !== langBtn) info.firstChild.remove();
    langBtn.before(
      h('b', {}, G.meta.name === 'Valley Clinic' ? t('Valley Clinic') : G.meta.name),
      h('div', { class: 'clock' }, h('span', { class: 'season ' + SEASON_CLASS[season(now)] }, SEASON_NAMES[season(now)]), ' · ' + t('Day {n}', { n: day(now) }) + ' · ', h('b', {}, clock(now)), open ? '' : h('span', { class: 'closed' }, ' · ' + t('closed'))),
      h('div', { class: 'money' }, icon({ gi: 'two-coins', c: '#e8c050' }, 18), ` ${sh(G.p.coins)}`),
      h('div', { class: 'rep', title: t('Your name in the valley') }, t('Name in the valley') + ' ', h('i', {}, h('u', { style: `width:${Math.round(cl.rep * 100)}%` }))));
    waitBtn.classList.toggle('hidden', !waiting && !coming);
    waitBtn.textContent = waiting ? (coming ? t('Next patient ({waiting} waiting) · {coming} coming', { waiting, coming }) : t('Next patient ({waiting} waiting)', { waiting })) : t('{coming} on the way', { coming });
    waitBtn.disabled = !waiting;
    if (S.panel === 'encounter') ui.encTime?.();
  };
  ui.refresh = () => {
    hot.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const s = G.p.inv.slots[i];
      const it = s && G.C.items.get(s.id);
      hot.append(h('button', { class: 'slot' + (i === G.p.hot ? ' sel' : ''), onclick: () => { G.p.hot = i; ui.refresh(); } }, h('small', {}, i + 1), it ? icon(it.icon) : null, it ? h('em', {}, it.unit ? shortAmt(it, s.n) : s.n > 1 ? s.n : '') : null));
    }
    const s = G.p.inv.slots[G.p.hot];
    const it = s && G.C.items.get(s.id);
    heldName.textContent = !it ? '' : it.place ? t('{item} — tap a spot to place it', { item: it.name }) : it.plant ? t('{item} — use on a garden bed to plant', { item: it.name }) : it.name;
    if (S.panel && S.panel !== 'encounter') render();
  };
  const shortAmt = (it, n) => (it.unit === 'ml' && n >= 1000 ? fmt(n / 1000) + 'L' : fmt(n));

  ui.toast = (text, cls = '') => {
    const el = h('div', { class: 'toast ' + cls }, txt(text));
    toasts.append(el);
    while (toasts.children.length > 5) toasts.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), cls ? 6000 : 3500);
    setTimeout(() => el.remove(), cls ? 7000 : 4500);
  };
  ui.banner = (big, small) => { banner.innerHTML = ''; banner.append(h('small', {}, txt(small)), h('b', {}, txt(big))); banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); };
  ui.news = (n) => { ui.toast(n.msg ?? n.text, n.kind === 'death' ? 'bad' : n.kind === 'recovered' ? 'good' : ''); if (n.kind === 'death') sfx('hurt'); if (n.kind === 'recovered') sfx('level'); };

  // Switch the language: load its pack, remember it, and redraw every word on screen (HUD, the open panel,
  // the canvas labels in the scene). main.js saves `lang` with the settings and applies it before the UI is built.
  ui.setLang = async (code) => {
    const got = await loadLang(code);
    G.settings.lang = got;
    G.saveSettings?.();
    document.documentElement.lang = got;
    label();
    ui.refresh();
    if (S.panel === 'encounter') render();
    ui.tick();
    G.scene?.relabel?.();
    return got;
  };

  // ———————————————————————————————————— panels
  ui.open = (name, arg) => { S.panel = name; S.arg = arg; S.sel = null; panel.classList.remove('hidden'); document.body.classList.add('panel-open'); render(); sfx('ui'); };
  ui.close = () => {
    if (S.panel === 'encounter' && S.enc) { const p = G.meta.clinic.patients[S.enc.pid]; if (p?.status === 'consult') p.status = 'waiting'; S.enc = null; }
    S.panel = null; panel.classList.add('hidden'); panel.innerHTML = ''; document.body.classList.remove('panel-open'); ui.refresh();
  };
  ui.toggle = (name) => (S.panel === name ? ui.close() : ui.open(name));
  ui.back = () => (S.panel ? ui.close() : ui.open('menu'));
  ui.trade = (v, key) => ui.open('trade', { v, key });
  ui.openContainer = (x, y) => ui.open('container', { x, y });
  ui.openJar = (x, y) => ui.open('jar', { x, y });
  ui.encounter = (pid) => {
    const p = G.meta.clinic.patients[pid];
    if (!p) return;
    S.enc = startEncounter(G, pid);
    S.encTab = 'talk'; S.encRight = 'notes'; S.region = null;
    S.rx = { item: null, amount: 1, perDay: 3, days: 5, route: 'oral' };
    S.woundSite = makeRng(p.seed, 'site')() < 0.5 ? 'arm' : 'legs';
    ui.open('encounter');
  };

  function head(title, extra) {
    return h('div', { class: 'phead' }, h('h2', {}, title), extra || '', h('button', { class: 'x', onclick: ui.close, title: t('Close (Esc)') }, '✕'));
  }
  function render() {
    const keepScroll = [...panel.querySelectorAll('.scroll, .log, .detail, .ebody > section, .qchips, .regmenu, .pbody.single')].map((e) => e.scrollTop);
    panel.innerHTML = '';
    panel.className = 'panel ' + S.panel;
    const f = PANELS[S.panel];
    if (f) f();
    [...panel.querySelectorAll('.scroll, .log, .detail, .ebody > section, .qchips, .regmenu, .pbody.single')].forEach((e, i) => { if (keepScroll[i] !== undefined) e.scrollTop = keepScroll[i]; });
  }

  // A search box for the long lists (hundreds of species, hundreds of imported goods).
  const searchBox = (key, placeholder) => {
    const inp = h('input', { type: 'search', placeholder, value: S[key] || '' });
    inp.addEventListener('input', () => { S[key] = inp.value; S.qFocus = key; render(); });
    if (S.qFocus === key) setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
    return h('div', { class: 'row' }, inp);
  };

  // ———————————————————————————————————— item detail
  function itemDetail(id, stack) {
    const it = G.C.items.get(id);
    const d = h('div', {}, h('div', { class: 'dhead' }, icon(it.icon, 56), h('div', {}, h('b', {}, it.name), h('small', {}, catName(en(it, 'cat')) + (stack ? ' · ' + amt(it, stack.n) : '')))));
    const lines = [];
    if (it.herb) {
      const hb = HERB.get(it.herb);
      lines.push(h('li', {}, h('i', {}, hb.latin), ' — ' + t('{part}. Evidence: {evidence}.', { part: partName(en(hb, 'part')), evidence: evidenceName(en(hb, 'evidence')) })));
      if (it.form === 'fresh' && stack?.t !== undefined) { const age = (G.W.time - stack.t) / DAY; lines.push(h('li', {}, age > 2 ? t('Picked {n} days ago — wilting, weaker each day.', { n: fmt(age) }) : t('Fresh.'))); }
    }
    if (it.actives && it.cat === 'medicine') for (const [a, mg] of Object.entries(it.actives)) lines.push(h('li', {}, it.unit ? t('{active}: {mg} mg per {unit}, as the label says. Sold in bottles of {pack} {unit}.', { active: ACTIVE.get(a).name, mg: fmt(mg), unit: unitName(it.unit), pack: it.pack }) : t('{active}: {mg} mg per tablet, as the label says. Sold in boxes of {pack}.', { active: ACTIVE.get(a).name, mg: fmt(mg), pack: it.pack })));
    else if (it.actives) for (const [a, mg] of Object.entries(it.actives)) lines.push(h('li', {}, it.unit ? t('{active}: about {mg} mg per {unit} (nominal — the real strength of this batch is unknown without an assay).', { active: ACTIVE.get(a).name, mg: fmt(mg), unit: unitName(it.unit) }) : t('{active}: about {mg} mg per unit (nominal — the real strength of this batch is unknown without an assay).', { active: ACTIVE.get(a).name, mg: fmt(mg) })));
    if (it.ref) lines.push(h('li', { class: 'dim' }, t('Where There Is No Doctor, Green Pages {ref}.', { ref: cite(it.ref.replace('WTND ', '')) })));
    if (it.topical) for (const a of Object.keys(it.topical)) lines.push(h('li', {}, t('On the skin: {active} ({class}).', { active: ACTIVE.get(a).name, class: ACTIVE.get(a).class })));
    if (it.fluid) lines.push(h('li', {}, t('Replaces water and salt lost in diarrhoea and vomiting.')));
    if (stack?.t !== undefined && it.shelfDays && it.form !== 'fresh') { const age = (G.W.time - stack.t) / DAY; if (age > it.shelfDays) lines.push(h('li', { class: 'bad' }, t('Past its keeping time — weak or spoiled.'))); else if (it.shelfDays < 5) lines.push(h('li', {}, it.shelfDays < 1 ? t('Keeps about {n} hours.', { n: Math.round(it.shelfDays * 24) }) : t('Keeps about {n} days.', { n: it.shelfDays }))); }
    if (it.note) lines.push(h('li', {}, it.note));
    if (it.plant) lines.push(h('li', {}, t('Plant in a garden bed: ready in about {n} days.', { n: it.growDays })));
    if (it.place) lines.push(h('li', {}, t('Hold it and tap a spot near you to place it.')));
    d.append(h('ul', {}, lines));
    return d;
  }
  function holdItem(slotIdx) {
    if (slotIdx < 8) { G.p.hot = slotIdx; } else { moveStack(G.p.inv, slotIdx, G.p.inv, G.p.hot, G.C); }
    ui.close();
  }

  const PANELS = {};
  // ——— bag
  PANELS.bag = () => {
    const grid = h('div', { class: 'grid' });
    G.p.inv.slots.forEach((s, i) => {
      const it = s && G.C.items.get(s.id);
      grid.append(h('button', { class: 'slot' + (S.sel === i ? ' sel' : '') + (i < 8 ? ' hotrow' : ''), onclick: () => { S.sel = i; render(); } }, it ? icon(it.icon) : null, it ? h('em', {}, it.unit ? shortAmt(it, s.n) : s.n > 1 ? s.n : '') : null));
    });
    const s = S.sel !== null ? G.p.inv.slots[S.sel] : null;
    const detail = h('div', { class: 'detail' + (s ? '' : ' empty') }, s ? itemDetail(s.id, s) : t('Choose something.'));
    if (s) detail.append(h('div', { class: 'acts' }, h('button', { onclick: () => holdItem(S.sel) }, t('Hold'))));
    panel.append(head(t('Bag'), h('button', { onclick: () => { sortInv(G.p.inv, G.C, 8); render(); } }, t('Sort'))), h('div', { class: 'pbody inv' }, h('div', { class: 'scroll' }, h('h3', {}, `${t('Bag')} · ${sh(G.p.coins)}`), grid,
      h('p', { class: 'hint' }, t('The top row is your hotbar (keys 1–8). Hold an item to place, plant or use it.'))), detail));
  };
  // ——— containers (shelves, drying racks)
  PANELS.container = () => {
    const { x, y } = S.arg;
    const od = G.W.objDef(x, y), st = G.W.container(x, y);
    const mk = (inv, other, label) => {
      const grid = h('div', { class: 'grid' });
      inv.slots.forEach((s, i) => {
        const it = s && G.C.items.get(s.id);
        let extra = null;
        if (od.dries && inv === st.inv && s?.id.startsWith('fresh_') && s.at !== undefined) extra = h('small', { class: 'dry' }, '…');
        grid.append(h('button', { class: 'slot', title: it ? it.name : '', onclick: () => { if (!s) return; const to = other.slots.findIndex((q) => !q || (q.id === s.id && !it.dur)); if (to >= 0) { moveStack(inv, i, other, to, G.C); if (od.dries && other === st.inv) other.slots[to].at ??= G.W.time; G.W.dirty = true; G.W.onChange?.(x, y); render(); ui.refresh(); } } }, it ? icon(it.icon) : null, it ? h('em', {}, it.unit ? shortAmt(it, s.n) : s.n > 1 ? s.n : '') : null, extra));
      });
      return [h('h3', {}, label), grid];
    };
    const hint = od.dries ? t('Fresh herbs dry here (about a day in the hot season, three in the rains). Outside in the rains they can go mouldy — racks indoors are safe.') : od.stock ? t('Stock on these shelves can be dispensed during consultations.') : '';
    panel.append(head(od.name), h('div', { class: 'pbody single' }, ...mk(st.inv, G.p.inv, od.name), ...mk(G.p.inv, st.inv, t('Your bag (tap to move)')), h('p', { class: 'hint' }, hint)));
  };
  // ——— steeping jar
  PANELS.jar = () => {
    const { x, y } = S.arg;
    const st = G.W.container(x, y) || G.W.state(x, y) || {};
    const body = h('div', { class: 'pbody single' });
    if (st.brew) {
      const it = G.C.items.get(st.brew.out);
      const left = st.brew.readyAt - G.W.time;
      body.append(h('div', { class: 'dhead' }, icon(it.icon, 48), h('div', {}, h('b', {}, it.name), h('small', {}, `${amt(it, st.brew.n)} · ${left <= 0 ? t('ready') : left > DAY ? t('ready in {n} days', { n: fmt(left / DAY) }) : t('ready in {n} hours', { n: Math.ceil(left / HOUR) })}`))),
        h('button', { class: 'primary', disabled: left > 0, onclick: () => { const r = collectBrew(G, x, y); ui.toast(r.ok ? t('Collected {item}.', { item: G.C.items.get(r.out.out).name }) : r.why); render(); ui.refresh(); } }, t('Collect')));
    } else {
      body.append(h('p', {}, t('Empty. Start a cold soak (a day) or a tincture (a week):')));
      const list = h('div', { class: 'rlist' });
      for (const r of G.C.recipes.filter((r) => r.hours)) {
        const why = blocker(G, r);
        list.append(h('button', { class: 'recipe' + (why ? ' miss' : ''), onclick: () => { G.nearJar = () => ({ x, y, st: G.W.container(x, y) || (G.W.setState(x, y, {}), G.W.state(x, y)) }); const res = make(G, r); G.nearJar = nearJar; if (!res.ok) ui.toast(res.why); else G.scene.handle(res.ev); render(); } },
          icon(G.C.items.get(r.out).icon, 30), h('span', {}, G.C.items.get(r.out).name), h('small', {}, txt(why) || r.in.map(([s, n]) => tc('ingredient', '{n} {item}', { n, item: specName(G.C, s) })).join(', '))));
      }
      body.append(list);
    }
    panel.append(head(t('Steeping jars')), body);
  };
  const nearJar = () => {
    const { W, p } = G;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
      if (W.objDef(x, y)?.brews) { const st = W.state(x, y) || {}; if (!st.brew) return { x, y, st }; }
    }
    return null;
  };
  G.nearJar = nearJar;

  // ——— make
  PANELS.make = () => {
    const list = h('div', { class: 'rlist' });
    const groups = [[t('Herbal remedies'), G.C.recipes.filter((r) => r.herb && !r.hours)], [t('Hand preparations'), G.C.recipes.filter((r) => r.special)], [t('Soaks & tinctures (at a steeping jar)'), G.C.recipes.filter((r) => r.hours)]];
    for (const [title, rs] of groups) {
      list.append(h('h3', {}, title));
      const mine = rs.filter((r) => !r.herb || G.p.known[r.herb] || count(G.p.inv, 'fresh_' + r.herb) || count(G.p.inv, 'dried_' + r.herb));
      const sorted = mine.sort((a, b) => (!!blocker(G, a) - !!blocker(G, b)) || a.out.localeCompare(b.out));
      for (const r of sorted) {
        const it = G.C.items.get(r.out), why = blocker(G, r);
        list.append(h('button', { class: 'recipe' + (why ? ' miss' : '') + (S.makeSel === r.id ? ' sel' : ''), onclick: () => { S.makeSel = r.id; S.makeTimes = 1; render(); } }, icon(it.icon, 30), h('span', {}, it.name), h('small', {}, why ? '—' : t('ready'))));
      }
    }
    const r = G.C.recipes.find((x) => x.id === S.makeSel);
    const detail = h('div', { class: 'detail' + (r ? '' : ' empty') });
    if (!r) detail.append(t('Herbs you have found show their remedies here. Find plants in the valley — the Book tells you where they grow.'));
    else {
      const it = G.C.items.get(r.out);
      const why = blocker(G, r, S.makeTimes);
      detail.append(itemDetail(r.out));
      const after = !r.hours ? '' : r.hours >= 48 ? t('{n} days', { n: r.hours / 24 }) : t('{n} hours', { n: r.hours });
      detail.append(h('h4', {}, r.method ? METHODS[r.method].verb : t('Method')),
        h('ul', { class: 'ing' }, r.in.map(([s, n]) => { const have = s.startsWith('#') ? G.C.tags.get(s.slice(1)).reduce((a, id) => a + count(G.p.inv, id), 0) : count(G.p.inv, s); return h('li', { class: have >= n * S.makeTimes ? 'ok' : 'no' }, t('{amount} {item} (have {have})', { amount: `${fmt(n * S.makeTimes)}${G.C.items.get(s.startsWith('#') ? G.C.tags.get(s.slice(1))[0] : s)?.unit === 'g' ? ' g' : G.C.items.get(s)?.unit === 'ml' ? ' ml' : ''}`, item: specName(G.C, s), have: fmt(have) })); }),
          r.station ? h('li', { class: G.stations.has(r.station) ? 'ok' : 'no' }, t('At a {station}', { station: stationName(r.station) })) : null, r.tool ? h('li', { class: count(G.p.inv, r.tool) ? 'ok' : 'no' }, t('With a {tool}', { tool: lc(G.C.items.get(r.tool).name) })) : null),
        h('p', { class: 'hint' }, (after ? t('Makes about {amount} after {time}.', { amount: amt(it, r.yields * S.makeTimes), time: after }) : t('Makes about {amount}.', { amount: amt(it, r.yields * S.makeTimes) })) + ' ' + t('Takes {n} minutes.', { n: r.min * S.makeTimes })),
        h('div', { class: 'acts' }, h('button', { onclick: () => { S.makeTimes = Math.max(1, S.makeTimes - 1); render(); } }, '−'), h('span', {}, `× ${S.makeTimes}`), h('button', { onclick: () => { S.makeTimes++; render(); } }, '+'),
          h('button', { class: 'primary', disabled: !!why, onclick: () => { const res = make(G, r, S.makeTimes); if (!res.ok) ui.toast(res.why); else G.scene.handle(res.ev); render(); } }, t('Make'))),
        why ? h('p', { class: 'bad' }, txt(why)) : '');
    }
    panel.append(head(t('Make remedies')), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, list), detail));
  };
  // ——— build
  PANELS.build = () => {
    const list = h('div', { class: 'rlist' });
    for (const b of PLACEABLES) {
      const r = G.C.recipes.find((x) => x.id === 'make_' + b.id);
      const why = blocker(G, r);
      list.append(h('button', { class: 'recipe' + (why ? ' miss' : '') + (S.sel === b.id ? ' sel' : ''), onclick: () => { S.sel = b.id; render(); } }, icon(G.C.items.get(b.id).icon, 30), h('span', {}, b.name), h('small', {}, b.cost.map(([id, n]) => t('{n} {item}', { n, item: lc(G.C.items.get(id).name) })).join(', '))));
    }
    const b = PLACEABLES.find((x) => x.id === S.sel);
    const detail = h('div', { class: 'detail' + (b ? '' : ' empty') });
    if (!b) detail.append(t('Build up the clinic. Materials come from the village shop — or cut poles and thatch yourself with a knife.'));
    else {
      const r = G.C.recipes.find((x) => x.id === 'make_' + b.id);
      const why = blocker(G, r);
      detail.append(itemDetail(b.id), h('ul', { class: 'ing' }, b.cost.map(([id, n]) => h('li', { class: count(G.p.inv, id) >= n ? 'ok' : 'no' }, t('{n} {item} (have {have})', { n, item: lc(G.C.items.get(id).name), have: count(G.p.inv, id) }))),
        r.station ? h('li', { class: G.stations.has(r.station) ? 'ok' : 'no' }, t('At the workbench')) : null),
        h('div', { class: 'acts' }, h('button', { class: 'primary', disabled: !!why, onclick: () => { const res = make(G, r); if (!res.ok) { ui.toast(res.why); return; } G.scene.handle(res.ev); const i = G.p.inv.slots.findIndex((s) => s?.id === b.id); if (i >= 0) holdItem(i); ui.toast(t('Tap a spot near you to place it.')); } }, t('Make and place'))),
        why ? h('p', { class: 'bad' }, txt(why)) : '');
    }
    panel.append(head(t('Build')), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, list), detail));
  };
  // ——— trade
  PANELS.trade = () => {
    const { v, key } = S.arg;
    const rows = h('div', { class: 'rlist' });
    for (const row of stock(G, v, key)) {
      const it = G.C.items.get(row.id);
      rows.append(h('div', { class: 'trow' }, icon(it.icon, 30), h('span', {}, it.name, h('small', {}, ` ${it.unit ? amt(it, LOT(it)) : ''} · ${t('{n} left', { n: row.n })}`)),
        h('button', { onclick: () => { const r = buy(G, v, key, row.id); if (!r.ok) ui.toast(r.why); else { sfx('coin'); ui.toast(t('Bought {item}.', { item: it.name })); } render(); ui.refresh(); } }, sh(row.price))));
    }
    const sells = h('div', { class: 'rlist' });
    const seen = new Set();
    for (const s of G.p.inv.slots) {
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      const pr = offer(G, v, s.id);
      if (pr === null) continue;
      const it = G.C.items.get(s.id);
      sells.append(h('div', { class: 'trow' }, icon(it.icon, 30), h('span', {}, it.name, h('small', {}, ' ' + t('have {amount}', { amount: amt(it, count(G.p.inv, s.id)) }))),
        h('button', { onclick: () => { const r = sell(G, v, s.id); if (!r.ok) ui.toast(r.why); else sfx('coin'); render(); ui.refresh(); } }, t('Sell {amount} for {price}', { amount: it.unit ? amt(it, LOT(it)) : 1, price: sh(pr) }))));
    }
    panel.append(head(`${v.name} · ${sh(G.p.coins)}`), h('div', { class: 'pbody single' }, h('p', { class: 'note' }, `${v.who}: “${v.greet}”`), h('h3', {}, t('For sale')), rows,
      sells.children.length ? [h('h3', {}, t('They will buy')), sells] : null,
      v.adulterate ? h('p', { class: 'hint' }, t('Herbs from traders vary in strength — and are not always what they are said to be.')) : null));

  };

  // ———————————————————————————————————— the consultation
  PANELS.encounter = () => {
    const enc = S.enc;
    const p = G.meta.clinic.patients[enc.pid];
    const tools = toolsAt(G);
    const mins = Math.round(G.W.time - enc.t0);
    const ham = hamletOf(G, p.hamlet);
    const sex = p.sex === 'f' ? (p.age < 13 ? t('girl') : t('woman')) : p.age < 13 ? t('boy') : t('man');
    const title = h('div', { class: 'etitle' }, h('b', {}, personName(p.name)), h('small', {}, ` ${txt(ageWords(p.age))} · ${sex} · ${t('from {place}', { place: personName(ham.name) })}${p.visits.length ? ' · ' + t('visit {n}', { n: p.visits.length + 1 }) : ''}`));
    const timer = h('small', { class: 'etime' }, t('{n} min', { n: mins }));
    ui.encTime = () => { timer.textContent = t('{n} min', { n: Math.round(G.W.time - enc.t0) }); };
    // talk: who speaks may be 'You', 'Exam', 'Mother', a patient's name, or a msg/person marker
    const speakerOf = (w) => (typeof w !== 'string' ? tm(w) : w === 'You' ? t('You') : w === 'Mother' ? t('Mother') : personName(w));
    const log = h('div', { class: 'log' }, enc.log.map((l) => h('div', { class: 'line ' + (l.who === 'You' ? 'me' : l.who === 'Exam' ? 'exam' : 'them') }, h('b', {}, l.who === 'Exam' ? '' : speakerOf(l.who) + ': '), say(l.text))));
    // questions by topic, in the order a history is taken
    const byGroup = (list) => [...new Set(list.map((x) => x.group))].map((g) => [g, list.filter((x) => x.group === g)]);
    const chips = h('div', { class: 'qchips' }, byGroup(questionsFor(p)).map(([g, qs]) => h('div', {}, h('small', { class: 'qhead' }, g),
      h('div', { class: 'chips' }, qs.map((q) => h('button', { class: enc.done.has(q.id) ? 'done' : '', onclick: () => { ask(G, enc, q.id); sfx('ui'); render(); } }, q.label))))));
    const talk = h('section', { class: 'talk' }, h('h3', {}, t('Talk')), log, chips);
    // examine
    const svgWrap = h('div', { class: 'bodywrap', html: bodySVG(p, enc.found, p.conds.some((c) => c.id.startsWith('wound') || c.id === 'burn_minor') ? (S.woundSite === 'arm' ? 'arm' : 'leg') : null) });
    svgWrap.addEventListener('click', (e) => {
      const r = e.target.closest('[data-region]');
      if (r) { S.region = r.dataset.region; render(); }
    });
    const regMenu = h('div', { class: 'regmenu' });
    if (S.region) {
      const R = REGIONS[S.region];
      regMenu.append(h('h4', {}, R.label));
      const avail = examsFor(p).filter((x) => R.exams.includes(x.id));
      for (const x of avail) {
        const need = x.tool && !tools.has(x.tool);
        const toolName = x.tool && lc(G.C.items.get(x.tool).name);
        regMenu.append(h('button', { class: (enc.done.has(x.id) ? 'done ' : '') + (need ? 'miss' : ''), disabled: need, title: need ? t('Needs a {tool}', { tool: toolName }) : '', onclick: () => { const r = examine(G, enc, x.id); if (!r.ok) ui.toast(r.text); sfx('ui'); render(); } },
          x.tool ? icon(G.C.items.get(x.tool).icon, 20) : null, x.label, need ? h('small', {}, ' — ' + t('needs {tool}', { tool: toolName })) : x.better && !tools.has(x.better) ? h('small', {}, ' (' + t('a {tool} would help', { tool: lc(G.C.items.get(x.better).name) }) + ')') : null));
      }
      const found = Object.entries(enc.found).filter(([k]) => regionOf(k) === S.region);
      if (found.length) regMenu.append(h('ul', {}, found.map(([, f]) => h('li', { class: f.pos ? 'abn' : '' }, say(f.m ?? f.v)))));
    } else regMenu.append(h('p', { class: 'hint' }, t('Tap a part of the body to examine it.')));
    const tray = h('div', { class: 'tray' }, h('small', {}, t('Your tools:') + ' '), ...[...tools].map((tl) => h('span', { class: 'tool', title: G.C.items.get(tl).name }, icon(G.C.items.get(tl).icon, 26))),
      tools.has('scale') ? h('button', { onclick: () => { examine(G, enc, 'x_weigh'); render(); } }, icon({ gi: 'scales', c: '#c0b080' }, 20), t('Weigh')) : h('small', { class: 'dim' }, ' (' + t('no scale — weight is a guess') + ')'));
    const exam = h('section', { class: 'exam' }, h('h3', {}, t('Examine')), h('div', { class: 'examgrid' }, svgWrap, regMenu), tray);
    // notes / differential
    const notes = h('div', { class: 'notesbox' });
    const ab = Object.entries(enc.found).filter(([, f]) => f.pos), nm = Object.entries(enc.found).filter(([, f]) => !f.pos && f.v !== '—');
    notes.append(h('h4', {}, t('Found ({n})', { n: ab.length })), h('ul', {}, ab.map(([, f]) => h('li', { class: 'abn' }, say(f.m ?? f.v)))));
    if (nm.length) notes.append(h('h4', {}, t('Normal / absent')), h('ul', { class: 'dim' }, nm.map(([, f]) => h('li', {}, say(f.m ?? f.v)))));
    if (S.helper) {
      const dd = differential(enc);
      notes.append(h('h4', {}, t('What it could be (helper)')), dd.length ? h('ol', {}, dd.map((d) => h('li', {}, COND.get(d.id)?.name ?? d.name, h('small', {}, ` · ${d.score}`)))) : h('p', { class: 'hint' }, t('Ask and examine first.')));
    }
    notes.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.helper, onchange: (e) => { S.helper = e.target.checked; render(); } }), t('Show the differential helper')));
    // treat
    const treat = h('div', { class: 'treatbox' });
    // working diagnosis: type to find (name or local name); Enter takes the first match; tap a chosen one to drop it
    const q = (S.dxq || '').trim().toLowerCase();
    // the name in the current language or in English, and the local names in both
    const hits = !q ? [] : CONDITIONS.filter((c) => !enc.dx.includes(c.id) && [c.name, ...(c.local || []), en(c, 'name'), ...(en(c, 'local') || [])].some((n) => n.toLowerCase().includes(q))).slice(0, 12);
    const addDx = (id) => { enc.dx.push(id); S.dxq = ''; S.qFocus = 'dxq'; render(); };
    const dxIn = h('input', { type: 'search', placeholder: t('Type a diagnosis…'), value: S.dxq || '' });
    dxIn.addEventListener('input', () => { S.dxq = dxIn.value; S.qFocus = 'dxq'; render(); });
    dxIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && hits.length) addDx(hits[0].id); });
    if (S.qFocus === 'dxq') setTimeout(() => { S.qFocus = null; dxIn.focus({ preventScroll: true }); dxIn.setSelectionRange(dxIn.value.length, dxIn.value.length); }, 0);
    treat.append(h('h4', {}, t('Working diagnosis')),
      enc.dx.length ? h('div', { class: 'chips' }, enc.dx.map((id) => h('button', { class: 'on', title: t('Remove'), onclick: () => { enc.dx.splice(enc.dx.indexOf(id), 1); render(); } }, COND.get(id).name + ' ✕'))) : '',
      h('div', { class: 'row' }, dxIn),
      hits.length ? h('div', { class: 'chips' }, hits.map((c) => h('button', { onclick: () => addDx(c.id) }, c.name))) : q ? h('p', { class: 'hint' }, t('Nothing by that name.')) : '');
    // prescription builder
    const rems = remedies(G);
    const R = S.rx;
    if (!R.item && rems.length) R.item = rems[0].id;
    const it = R.item && G.C.items.get(R.item);
    if (it && !it.route.includes(R.route)) R.route = it.route[0];
    const tsp = tc('measure', 'tsp'), tbsp = tc('measure', 'tbsp');
    const presets = !it ? [] : it.unit === 'ml' ? [[tc('measure', 'drop'), 0.05], ['1 ml', 1], [tsp, 5], [tbsp, 15], [tc('measure', '½ cup'), 125], [tc('measure', 'cup'), 250]] : it.unit === 'g' ? (it.id === 'honey' ? [[tsp, 7], [tbsp, 20], [tc('measure', 'dressing'), 15]] : [['0.05 g', 0.05], ['0.1 g', 0.1], [tc('measure', 'pinch'), 0.3], [tsp, 2], [tbsp, 6]]) : it.cat === 'medicine' ? [['¼', 0.25], ['½', 0.5], ['1', 1], ['2', 2]] : [['1', 1]];
    const weighed = !!enc.found.weight;
    const estW = weighed ? p.weight : Math.round(medianWeight(p.age, p.sex) * 10) / 10;
    const line = it ? rxLine(G, R.item, R.amount, R.perDay, R.days, R.route) : null;
    const dinfo = line ? doseInfo(G, p, line, estW) : [];
    const routeName = (rt) => ({ oral: t('by mouth'), topical: t('on the skin'), inj: t('injection') })[rt] ?? rt;
    const rxText = (l) => {
      const v = { item: G.C.items.get(l.item)?.name ?? l.name, amount: amt(G.C.items.get(l.item), l.amount), n: l.perDay, days: l.days };
      return l.given ? t('{item}: {amount} injected', v) : l.route === 'topical' ? t('{item}: {amount} applied {n}× a day for {days} days', v) : t('{item}: {amount} {n}× a day for {days} days', v);
    };
    treat.append(h('h4', {}, t('Prescribe')),
      rems.length ? h('div', { class: 'rxform' },
        h('select', { onchange: (e) => { R.item = e.target.value; R.amount = 1; render(); } }, rems.map((r) => h('option', { value: r.id, selected: r.id === R.item }, t('{item} — {amount} in stock', { item: r.name, amount: amt(r, stockOf(G, r.id)) })))),
        it.route.length > 1 ? h('div', { class: 'chips' }, it.route.map((rt) => h('button', { class: R.route === rt ? 'on' : '', onclick: () => { R.route = rt; render(); } }, routeName(rt)))) : null,
        h('div', { class: 'row' }, h('span', {}, t('Each dose:')), h('input', { type: 'number', step: 'any', min: 0, value: R.amount, style: 'width:80px', onfocus: () => { S.typing = true; }, onblur: () => { S.typing = false; }, onchange: (e) => { R.amount = Math.max(0, +e.target.value || 0); render(); } }), h('span', {}, it.unit ? unitName(it.unit) : t('each')),
          h('span', { class: 'chips' }, presets.map(([l, v]) => h('button', { class: R.amount === v ? 'on' : '', onclick: () => { R.amount = v; render(); } }, l)))),
        R.route === 'inj' ? null : h('div', { class: 'row' }, h('span', {}, t('Times a day:')), h('span', { class: 'chips' }, [1, 2, 3, 4, 6].map((n) => h('button', { class: R.perDay === n ? 'on' : '', onclick: () => { R.perDay = n; render(); } }, n)))),
        R.route === 'inj' ? null : h('div', { class: 'row' }, h('span', {}, t('For days:')), h('span', { class: 'chips' }, [1, 2, 3, 5, 7, 10, 14, 21].map((n) => h('button', { class: R.days === n ? 'on' : '', onclick: () => { R.days = n; render(); } }, n)))),
        dinfo.length ? h('div', { class: 'doseinfo' }, dinfo.map((d) => h('div', {}, t('{name}: {mg} mg a dose = {mgkg} mg/kg ({perDay} mg/kg/day)', { name: d.name.split(/\s*[(（]/)[0], mg: fmt(d.mg), mgkg: fmt(d.mgkg), perDay: fmt(d.perDayKg) }))),
          h('small', {}, (weighed ? t('Weighed: {w} kg.', { w: estW }) : t('Guessed by age: {w} kg.', { w: estW })) + ' ' + (it.cat === 'medicine' ? t('Strength as labelled.') : t('Nominal strength — this batch has not been assayed.')))) : null,
        h('div', { class: 'row' }, h('span', { class: 'hint' }, t('Dispense {amount} (in stock {stock})', { amount: amt(it, line.qty), stock: amt(it, stockOf(G, it.id)) })),
          R.route === 'inj'
            ? h('button', { disabled: !R.amount || R.amount > stockOf(G, it.id), onclick: () => { const r = injectNow(G, enc, R.item, R.amount); ui.toast(r.text); render(); } }, t('Inject now'))
            : h('button', { disabled: !R.amount || line.qty > stockOf(G, it.id), onclick: () => { enc.rx.push(line); render(); } }, t('Add')))) : h('p', { class: 'hint' }, t('No remedies in your bag or on the shelves.')),
      enc.rx.length ? h('ul', { class: 'rxlist' }, enc.rx.map((l, i) => h('li', {}, rxText(l), l.given ? null : h('button', { class: 'link', onclick: () => { enc.rx.splice(i, 1); render(); } }, ' ' + t('remove'))))) : '');
    treat.append(h('h4', {}, t('In the clinic')), h('div', { class: 'chips' }, PROCEDURES.filter((pr) => pr.applies(p)).map((pr) => h('button', { class: enc.proc.has(pr.id) ? 'on' : '', onclick: () => { const r = doProcedure(G, enc, pr.id); ui.toast(r.text); render(); } }, pr.label))));
    const teas = Object.keys(G.p.known).filter((id) => teaOf(G.C, id)).sort((a, b) => HERB.get(a).name.localeCompare(HERB.get(b).name));
    if (teas.length) treat.append(h('h4', {}, t('Send them to gather')), h('select', { onchange: (e) => { enc.gather = e.target.value || null; } },
      [h('option', { value: '' }, t('Nothing')), ...teas.map((id) => h('option', { value: id, selected: enc.gather === id }, t('{herb}: a cup of tea 3 times a day, 5 days', { herb: HERB.get(id).name })))]));
    treat.append(h('h4', {}, t('Advice')), h('div', { class: 'checks' }, byGroup(adviceFor(p)).map(([g, list]) => [h('small', { class: 'qhead' }, g), ...list.map((ins) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: enc.instr.has(ins.id), onchange: (e) => { if (e.target.checked) enc.instr.add(ins.id); else enc.instr.delete(ins.id); } }), ins.label))]).flat()));
    treat.append(h('div', { class: 'row' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: enc.refer, onchange: (e) => { enc.refer = e.target.checked; } }), t('Refer to the health centre (two days\' walk)'))),
      h('div', { class: 'row' }, h('span', {}, t('Come back in:')), h('span', { class: 'chips' }, [0, 1, 2, 3, 7].map((n) => h('button', { class: enc.returnDays === n ? 'on' : '', onclick: () => { enc.returnDays = n; render(); } }, n ? t('{n} d', { n }) : t('only if worse'))))),
      h('div', { class: 'acts' }, h('button', { class: 'primary', onclick: () => finish() }, t('Finish and send home'))));
    const rightTabs = h('div', { class: 'chips etabs2' }, [['notes', t('Notes')], ['treat', t('Treat')]].map(([k, l]) => h('button', { class: S.encRight === k ? 'on' : '', onclick: () => { S.encRight = k; render(); } }, l)));
    const right = h('section', { class: 'right' }, rightTabs, S.encRight === 'notes' ? notes : treat);
    const tabs = h('div', { class: 'etabs' }, [['talk', t('Talk')], ['exam', t('Examine')], ['notes', t('Notes')], ['treat', t('Treat')]].map(([k, l]) => h('button', { class: S.encTab === k ? 'on' : '', onclick: () => { S.encTab = k; if (k === 'notes' || k === 'treat') S.encRight = k; render(); } }, l)));
    const body = h('div', { class: 'ebody tab-' + S.encTab }, talk, exam, right);
    panel.append(h('div', { class: 'phead' }, title, timer, h('button', { class: 'x', title: t('Ask them to wait (Esc)'), onclick: ui.close }, '✕')), tabs, body);
    const lg = $('.log', panel); if (lg) lg.scrollTop = lg.scrollHeight;
  };
  const regionOf = (k) => ({ temp: 'head', feels_hot: 'head', fontanel: 'head', alert: 'head', flushed: 'face', pupils: 'face', yellow_vision: 'face', sunken_eyes: 'face', dry_mouth: 'face', tears: 'face', pallor: 'face', thin: 'head',
    rr: 'chest', indrawing: 'chest', grunting: 'chest', crackles: 'chest', spleen: 'belly', pot_belly: 'belly', tender: 'belly', skin_pinch: 'belly', muac: 'arm', bp: 'arm', hr: 'wrist', pulse_regular: 'wrist',
    burrows: 'hands', skin_sores: 'hands', rash: 'hands', measles_rash: 'hands', ear_pus: 'head', neck_glands: 'head', tonsils: 'face', koplik: 'face', red_eyes: 'face',
    suprapubic: 'belly', rose_spots: 'belly', bloating: 'belly', loin_pain: 'back', edema: 'legs', back_exam: 'back', pus: 'wound', redness: 'wound', red_streaks: 'wound', glands: 'wound', wound_size: 'wound', burn_area: 'wound', blisters: 'wound', burn_deep: 'wound', joints: 'hands', mastoid: 'head',
    wheeze: 'chest', weak_side: 'arm', face_droop: 'face', speech: 'face', urine_sugar: 'belly', goitre: 'head', ptosis: 'face', breath_smell: 'face', hair: 'hands', skin_patches: 'hands', foot_numb: 'legs',
    fang_marks: 'legs', sting_mark: 'hands', local_swelling: 'legs', bleeding: 'legs', sting_systemic: 'legs', deformity: 'hands', swollen_joint: 'legs',
    // ——— infections (WTND chapters 13–18, 21)
    stiff_neck: 'head', spasms: 'head', parotid: 'head', lockjaw: 'face', thrush: 'face', jaundice: 'face', follicles: 'face', eye_scratch: 'face', knee_jerk: 'legs',
    skin_patch: 'hands', patch_feeling: 'hands', thick_nerves: 'hands', claw: 'hands', nodules: 'hands', petechiae: 'hands', syph_rash: 'hands', crusts: 'hands', red_patch: 'hands', rings: 'hands', pox: 'hands',
    liver_tender: 'belly', pelvic_pain: 'belly', discharge: 'belly', genital_sore: 'belly', bubo: 'belly' }[k]);
  function finish() {
    const enc = S.enc;
    const p = G.meta.clinic.patients[enc.pid];
    if (!enc.dx.length && !confirm(t('No working diagnosis chosen. Send them home anyway?'))) return;
    const res = finishEncounter(G, enc);
    S.enc = null;
    const pay = res.pay;
    const v = { name: personName(p.name), cash: sh(pay.cash), goods: pay.kind.map(([id, n]) => t('{n} {item}', { n, item: lc(G.C.items.get(id).name) })).join(', '), debt: sh(pay.debt || 0) };
    ui.toast(pay.kind.length ? (pay.debt ? t('{name} paid {cash} and {goods} (owes {debt}).', v) : t('{name} paid {cash} and {goods}.', v)) : pay.debt ? t('{name} paid {cash} (owes {debt}).', v) : t('{name} paid {cash}.', v));
    if (enc.refer) ui.toast(res.referWent ? t('They will go to the health centre.') : t('They cannot afford the journey to the health centre, and go home.'));
    if (res.levelUp) ui.banner(t('Diagnosis level {n}', { n: res.levelUp }), t('Skill'));

    sfx('coin');
    G.scene.sendHome(p.id);
    S.panel = null; panel.classList.add('hidden'); panel.innerHTML = ''; document.body.classList.remove('panel-open');
    ui.refresh(); ui.tick(); G.save();
  }

  // ———————————————————————————————————— handbook
  PANELS.handbook = () => {
    const tabs = h('div', { class: 'chips' }, [['conditions', t('Illnesses')], ['plants', t('Plants')], ['compounds', t('Compounds')], ['germs', t('Germs')], ['methods', t('Preparing')], ['about', t('About')]].map(([k, l]) => h('button', { class: S.hbTab === k ? 'on' : '', onclick: () => { S.hbTab = k; S.hbSel = null; render(); } }, l)));
    const list = h('div', { class: 'rlist' });
    const detail = h('div', { class: 'detail' });
    if (S.hbTab === 'conditions') {
      for (const c of CONDITIONS) list.append(h('button', { class: 'recipe' + (S.hbSel === c.id ? ' sel' : ''), onclick: () => { S.hbSel = c.id; render(); } }, icon({ gi: c.icon, c: c.color }, 28), h('span', {}, c.name), h('small', {}, cite(c.ref))));
      const c = COND.get(S.hbSel) || CONDITIONS[0];
      detail.append(h('h3', {}, c.name), h('p', { class: 'note' }, c.learn), h('p', {}, h('b', {}, t('When to refer:') + ' '), c.teach.refer || '—'), h('p', { class: 'hint' }, t('Also called: {names}. Source: Where There Is No Doctor, {ref} (Hesperian), paraphrased.', { names: c.local.join(', '), ref: cite(c.ref.replace('WTND ', '')) })));
    } else if (S.hbTab === 'plants') {
      // the 12 plants of the valley, plus every species you have gathered or bought
      const known = [...new Set([...HERBS.map((x) => x.id), ...Object.keys(G.p.known || {})])].map((id) => HERB.get(id)).filter(Boolean);
      const q = (S.hbQ || '').toLowerCase().trim();
      // search the names in the current language and in English
      const plants = known.filter((x) => !q || `${x.name} ${en(x, 'name')} ${x.latin} ${x.family} ${partName(en(x, 'part'))} ${x.part} ${x.uses.join(' ')} ${(en(x, 'uses') || []).join(' ')}`.toLowerCase().includes(q))
        .sort((a, b) => (!!a.flora - !!b.flora) || a.name.localeCompare(b.name));
      list.append(searchBox('hbQ', t('Search {n} plants you know…', { n: known.length })));
      for (const hb of plants.slice(0, 150)) list.append(h('button', { class: 'recipe' + (S.hbSel === hb.id ? ' sel' : ''), onclick: () => { S.hbSel = hb.id; render(); } }, icon({ gi: hb.icon, c: hb.color }, 28), h('span', {}, hb.name, h('small', {}, ' ' + hb.latin)), h('small', {}, evidenceName(en(hb, 'evidence')))));
      if (plants.length > 150) list.append(h('p', { class: 'hint' }, t('…and {n} more. Type a name, a family or a use to narrow the list.', { n: plants.length - 150 })));
      const hb = (plants.includes(HERB.get(S.hbSel)) ? HERB.get(S.hbSel) : plants[0]) || HERBS[0];
      const fit = climateFit(hb.id);
      const when = hb.seasons === 'all' ? t('all year') : hb.seasons.map((s) => lc(SEASON_NAMES[s])).join(', ');
      const fitText = fit >= 0.9 ? t('At home in this valley.') : fit >= 0.6 ? t('It manages here.') : t('Out of its country here: what grows is thin and weak.');
      const evidence = evidenceName(en(hb, 'evidence'));
      detail.append(h('h3', {}, `${hb.name} — `, h('i', {}, hb.latin)), h('p', {}, t('{family}. Part used: {part}. Grows: {where}; {when}.', { family: hb.family, part: partName(en(hb, 'part')), where: Object.keys(hb.habitat).map(habitatName).join(', '), when })),
        hb.flora ? h('p', {}, t('A {climate} {life}.', { climate: CLIMATE[hb.climate].name, life: lifeName(en(hb, 'life')) }) + ' ' + fitText) : '',
        h('p', {}, h('b', {}, t('Contains:') + ' '), Object.entries(hb.contains).map(([a, r]) => ACTIVE.get(a).channel === 'topical' ? ACTIVE.get(a).name : t('{name} {lo}–{hi}% of dry weight', { name: ACTIVE.get(a).name, lo: r[0], hi: r[1] })).join('; ')),
        hb.estimated ? h('p', { class: 'hint' }, t('Some of those figures are the usual content of the compound, not a measurement of this plant: nobody has assayed it.')) : '',
        h('p', {}, h('b', {}, (hb.flora ? t('People use it for:') : t('Used for:')) + ' '), hb.uses.length ? t('{uses}. Evidence: {evidence}.', { uses: hb.uses.join(', '), evidence }) : t('nothing anyone wrote down. Evidence: {evidence}.', { evidence })),
        h('p', { class: 'note' }, hb.note));
      if (hb.harms.length) detail.append(h('p', { class: 'bad' }, hb.harms.join(' ')));
      for (const c of [...new Set(Object.keys(hb.contains).flatMap((a) => ACTIVE.get(a).cautions || []))]) detail.append(h('p', { class: 'bad' }, c));
      const look = lookalikes(hb.id, 5).filter((x) => known.some((k) => k.id === x.id));
      if (look.length) detail.append(h('p', {}, h('b', {}, t('Easily mistaken for:') + ' '), look.map((x) => `${HERB.get(x.id)?.name ?? x.name} (${({ 'same genus': t('same genus'), 'same family': t('same family') })[x.why] ?? txt(x.why)})`).join('; ')));
      detail.append(h('p', { class: 'hint cite' }, cite(hb.ref)));
    } else if (S.hbTab === 'compounds') {
      for (const a of ACTIVES) list.append(h('button', { class: 'recipe' + (S.hbSel === a.id ? ' sel' : ''), onclick: () => { S.hbSel = a.id; render(); } }, h('span', {}, a.name), h('small', {}, a.class)));
      const a = ACTIVE.get(S.hbSel) || ACTIVES[0];
      const acts = a.channel === 'systemic' ? t('acts through the blood') : a.channel === 'gut' ? t('acts in the gut') : a.channel === 'topical' ? t('acts on the skin') : t('acts as fluid');
      detail.append(h('h3', {}, a.name), h('p', {}, `${a.class} · ${acts}`));
      if (a.pk) { const v = { F: Math.round(a.pk.F * 100), half: a.pk.half, vd: a.pk.vd }; detail.append(h('p', {}, a.pk.induce ? t('Absorbed {F}% · half-life {half} h · spreads into {vd} L/kg · the body learns to clear it faster over days of use.', v) : t('Absorbed {F}% · half-life {half} h · spreads into {vd} L/kg.', v))); }
      if (a.abx) {
        const hits = ORGANISMS.filter((o) => a.id in o.mic), miss = ORGANISMS.filter((o) => !(a.id in o.mic));
        const kills = a.abx.hill >= 3 ? t('Kills bacteria while the level stays above their MIC (time matters more than height).') : a.abx.kmax >= 0.3 ? t('Kills bacteria faster the higher the level.') : t('Kills bacteria slowly: it mostly stops them growing and the body does the rest.');
        detail.append(h('p', {}, kills + ' ' + t('Only the unbound part acts: {fu}% is free in the blood.', { fu: Math.round(a.pk.fu * 100) })),
          h('ul', {}, hits.map((o) => h('li', {}, t('{germ}: MIC {mic} mg/L; resistant strains ×{fold}.', { germ: o.name, mic: o.mic[a.id], fold: o.fold[a.id] }))), miss.map((o) => h('li', { class: 'dim' }, t('{germ}: no effect.', { germ: o.name })))));
      }
      for (const e of a.effects || []) detail.append(h('p', {}, e.prr ? t('Kills malaria parasites while in the blood: at full strength about {log} log₁₀ (a {fold}-fold fall) an hour; half-effect at {ec50} mg/L.', { log: fmt(e.prr / 48), fold: fmt(10 ** (e.prr / 48)), ec50: e.ec50 }) : t('{effect}: half its effect at {ec50} mg/L.', { effect: effectName(e.on), ec50: e.ec50 })));
      for (const tx of a.toxic || []) {
        const v = { x: tx.atMgKg ?? tx.at, text: tx.text };
        detail.append(h('p', { class: 'bad' }, tx.atMgKg !== undefined ? (tx.dry ? t('Over {x} mg/kg in a day in someone dehydrated: {text}.', v) : t('Over {x} mg/kg in a day: {text}.', v)) : tx.dry ? t('Above {x} mg/L in someone dehydrated: {text}.', v) : t('Above {x} mg/L: {text}.', v)));
      }
      for (const c of a.cautions || []) detail.append(h('p', { class: 'bad' }, c));
      if (a.note) detail.append(h('p', { class: 'note' }, a.note));
      detail.append(h('p', { class: 'hint cite' }, cite(a.ref)));
    } else if (S.hbTab === 'germs') {
      for (const o of ORGANISMS) list.append(h('button', { class: 'recipe' + (S.hbSel === o.id ? ' sel' : ''), onclick: () => { S.hbSel = o.id; render(); } }, h('span', {}, o.name)));
      const o = ORG.get(S.hbSel) || ORGANISMS[0];
      detail.append(h('h3', {}, o.name), h('p', { class: 'note' }, t('The MIC is the lowest level of a medicine, in the blood and free of protein, that stops this germ growing. Keep the free level above it long enough and the germ dies; dose too low or stop too soon and the strong survivors are the ones that spread.')),
        h('ul', {}, Object.entries(o.mic).map(([d, m]) => h('li', {}, o.parasite ? t('{drug}: resistant strains need {fold}× the level to be killed as fast', { drug: ACTIVE.get(d).name, fold: o.fold[d] }) : t('{drug}: {mic} mg/L (resistant strains {rmic} mg/L)', { drug: ACTIVE.get(d).name, mic: m, rmic: fmt(m * o.fold[d]) })))), h('p', { class: 'hint' }, cite(o.ref)));
    } else if (S.hbTab === 'methods') {
      for (const [k, m] of Object.entries(METHODS)) list.append(h('button', { class: 'recipe' + (S.hbSel === k ? ' sel' : ''), onclick: () => { S.hbSel = k; render(); } }, h('span', {}, m.name), h('small', {}, m.verb)));
      detail.append(h('p', { class: 'note' }, t('How much of a plant\'s medicine ends up in what you make depends on the method. Quinine hardly dissolves in plain water — boil cinchona with lime juice, or soak it in spirit. Artemisinin breaks down with long boiling. Powders keep everything, but the dose is bulky and bitter. These extraction figures are estimates from each compound\'s chemistry, not measurements.')),
        h('p', {}, t('Dry herbs on a rack before powdering or making tinctures. Fresh herbs lose strength after two days. Every plant differs: the same handful can be half or one and a half times the usual strength — which is why dosing crude herbs is uncertain, and why medicine moved to measured, assayed preparations.')));
    } else {
      detail.append(h('h3', {}, t('About this game')), h('p', {}, t('The illnesses, signs and home treatments follow Where There Is No Doctor by David Werner with Carol Thuman and Jane Maxwell (Hesperian Health Guides). Hesperian allows adaptation for free, non-profit use; this game is free. Text is paraphrased with page references; no illustrations are reused.')),
        h('p', {}, t('Pharmacology (absorption, half-lives, effective and toxic levels) is from the references shown on each compound. Some effect sizes are fitted to clinical trials and say so.')),
        h('p', { class: 'bad' }, t('This is a game, not medical advice. Do not treat anyone with what you learn here without proper training and current local guidelines.')),
        h('p', { class: 'credits' }, t('Art: Dungeon Crawl Stone Soup tiles (CC0) · game-icons.net (CC BY 3.0) · Phaser 3 · ZzFX · nipplejs · Pixelify Sans (OFL).')));
    }
    panel.append(head(t('Handbook')), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, tabs, list), detail));

  };
  // ———————————————————————————————————— ledger
  PANELS.ledger = () => {
    const cl = G.meta.clinic;
    const tabs = h('div', { class: 'chips' }, [['patients', t('Patients')], ['money', t('Money')], ['market', t('Traders')], ['post', t('Order by post')], ['report', t('Health office')]].map(([k, l]) => h('button', { class: S.ledTab === k ? 'on' : '', onclick: () => { S.ledTab = k; S.ledSel = null; render(); } }, l)));
    const list = h('div', { class: 'rlist' });
    const detail = h('div', { class: 'detail' });
    const st = cl.stats;
    const sv = { seen: st.seen, recovered: st.recovered, died: st.died, harmed: st.harmed, referred: st.referred, earned: sh(st.income) };
    detail.append(h('p', {}, st.harmed ? t('Seen {seen} · well again {recovered} · died {died} ({harmed} from a remedy) · referred {referred} · earned {earned}', sv) : t('Seen {seen} · well again {recovered} · died {died} · referred {referred} · earned {earned}', sv)));
    if (S.ledTab === 'patients') {
      const ps = Object.values(cl.patients).filter((p) => p.visits.length || p.status === 'waiting').sort((a, b) => (b.visits.at(-1)?.t || 0) - (a.visits.at(-1)?.t || 0));
      for (const p of ps) {
        const status = p.dead ? tc('status', 'died') : p.recovered ? tc('status', 'well') : p.status === 'hospital' ? t('at the health centre') : statusName(p.status);
        list.append(h('button', { class: 'recipe' + (S.ledSel === p.id ? ' sel' : '') + (p.dead ? ' dead' : p.recovered ? ' well' : ''), onclick: () => { S.ledSel = p.id; render(); } }, h('span', {}, txt(who(p)), h('small', {}, ' ' + personName(hamletOf(G, p.hamlet).name))), h('small', {}, status)));
      }
      const p = cl.patients[S.ledSel];
      if (p) {
        detail.append(h('h3', {}, txt(who(p))), h('p', {}, `${personName(hamletOf(G, p.hamlet).name)} · ${p.dead ? t('died: {cause}', { cause: tm(p.cause) }) : p.recovered ? t('recovered') : t('still unwell')}`));
        for (const v of p.visits) {
          const j = v.judged, names = (ids) => ids.map(gaveName).join(', ');
          const hindsight = [t('In hindsight it was {truth}.', { truth: tm(j.truth) }),
            j.helped.length ? t('What helped: {list}.', { list: names(j.helped) }) : '',
            j.harmed.length ? t('What harmed: {list}.', { list: names(j.harmed) }) : '',
            j.needless?.length ? t('No germ to kill: the {list} only bred resistance.', { list: lc(names(j.needless)) }) : ''].filter(Boolean).join(' ');
          detail.append(h('div', { class: 'entry' }, h('small', {}, `${t('Day {n}', { n: day(v.t) })} ${clock(v.t)}`), h('b', {}, t('You thought: {dx}', { dx: v.dx.map((d) => COND.get(d)?.name ?? d).join(', ') || '—' })),
            h('p', {}, v.rx.length ? t('Gave: {list}', { list: v.rx.map(tm).join('; ') }) : t('No medicine.')), v.instr.length ? h('p', { class: 'dim' }, t('Advice: {list}', { list: v.instr.map(gaveName).join(', ') })) : null, v.refer ? h('p', {}, t('Referred.')) : null,
            (p.dead || p.recovered) ? h('p', { class: j.dxRight ? 'good' : 'bad' }, hindsight) : null));
        }
      }
    } else if (S.ledTab === 'money') {
      for (const e of [...G.meta.ledger].reverse().slice(0, 120)) list.append(h('div', { class: 'lrow ' + e.kind }, h('small', {}, `${t('D{n}', { n: day(e.t) })} ${clock(e.t)}`), h('span', {}, tm(e.msg ?? e.text)), e.amount ? h('b', {}, (e.amount > 0 ? '+' : '') + fmt(e.amount)) : null));
      detail.append(h('h4', {}, t('Your charges')), h('div', { class: 'row' }, h('span', {}, t('Consultation fee:') + ' '), h('span', { class: 'chips' }, [0, 1, 2, 3, 5].map((n) => h('button', { class: cl.fee === n ? 'on' : '', onclick: () => { cl.fee = n; render(); } }, sh(n))))),
        h('div', { class: 'row' }, h('span', {}, t('Medicines at cost ×')), h('span', { class: 'chips' }, [1, 1.3, 1.6, 2].map((n) => h('button', { class: cl.markup === n ? 'on' : '', onclick: () => { cl.markup = n; render(); } }, n)))),
        h('p', { class: 'hint' }, t('Higher fees keep the poorest away; they pay in eggs and maize when coins run short.')));
    } else if (S.ledTab === 'post') {
      const cart = (S.cart ||= {});
      for (const [title, cat] of [[t('Medicines'), 'medicine'], [t('Tools'), 'tool']]) {
        list.append(h('h4', {}, title));
        for (const it of catalogueItems(G.C).filter((x) => x.cat === cat)) {
          const n = cart[it.id] || 0;
          list.append(h('div', { class: 'trow' }, icon(it.icon, 30), h('span', {}, it.name, h('small', {}, LOT(it) > 1 ? ` ${amt(it, LOT(it))}` : '')), h('small', {}, sh(lotPrice(it, CATALOGUE.mult))),
            h('button', { disabled: !n, onclick: () => { cart[it.id] = n - 1; render(); } }, '−'), h('b', {}, n), h('button', { onclick: () => { cart[it.id] = n + 1; render(); } }, '+')));
        }
      }
      list.append(h('h4', {}, t('Town import house')), h('p', { class: 'hint' }, t('Dried herbs, seed and the animal and mineral goods of the far traditions: {n} listed, {min}-{max} days by post, priced by how far they come.', { n: importItems(G.C).length, min: IMPORT.baseDays, max: IMPORT.baseDays + IMPORT.perZone * 5 + 10 })), searchBox('impQ', t('Search by name: goldthread, antler, seed…')));
      const iq = (S.impQ || '').toLowerCase().trim();
      // names in the current language and in English
      const enough = iq.length >= (/[^\x00-\x7f]/.test(iq) ? 2 : 3); // a Hangul (or other non-Latin) syllable holds more than a letter
      const imports = enough ? importItems(G.C).filter((it) => it.name.toLowerCase().includes(iq) || String(en(it, 'name')).toLowerCase().includes(iq)) : [];
      if (!enough) list.append(h('p', { class: 'hint' }, t('Type three letters or more.')));
      for (const it of imports.slice(0, 40)) {
        const n = cart[it.id] || 0;
        list.append(h('div', { class: 'trow' }, icon(it.icon, 30), h('span', {}, it.name, h('small', {}, `${LOT(it) > 1 ? ' ' + amt(it, LOT(it)) : ''} · ${t('{n} days', { n: IMPORT.baseDays + IMPORT.perZone * (it.zone || 1) })}`)), h('small', {}, sh(lotPrice(it, IMPORT.mult))),
          h('button', { disabled: !n, onclick: () => { cart[it.id] = n - 1; render(); } }, '−'), h('b', {}, n), h('button', { onclick: () => { cart[it.id] = n + 1; render(); } }, '+')));
      }
      if (imports.length > 40) list.append(h('p', { class: 'hint' }, t('…and {n} more.', { n: imports.length - 40 })));
      const lines = Object.entries(cart).filter(([, n]) => n > 0);
      detail.append(h('h4', {}, t('Your order')), lines.length ? h('ul', {}, lines.map(([id, n]) => h('li', {}, `${n} × ${G.C.items.get(id).name}`))) : h('p', { class: 'hint' }, t('Nothing yet.')),
        h('p', {}, t('Postage {postage} · total {total}', { postage: sh(CATALOGUE.postage), total: sh(orderTotal(G.C, Object.fromEntries(lines))) })),
        h('div', { class: 'acts' }, h('button', { class: 'primary', disabled: !lines.length, onclick: () => { const r = placeOrder(G, cart); if (!r.ok) ui.toast(r.why); else { sfx('coin'); ui.toast(t('Order posted. Due about day {n}.', { n: day(r.due) })); S.cart = {}; } render(); ui.refresh(); } }, t('Post the order'))),
        h('p', { class: 'hint' }, t('Paid when posted. The post runner brings it to the medicine shelf in 4–8 days. Sealed boxes from the city wholesaler, though no supply chain is perfect.')),
        h('p', { class: 'hint' }, t('Imported herbs come weeks later, and about one sack in three holds another species altogether — far more for antler.') + ' ', h('span', { class: 'cite' }, cite(IMPORT.ref))));
      const pend = G.meta.orders || [];
      if (pend.length) detail.append(h('h4', {}, t('On the way')), h('ul', {}, pend.map((o) => h('li', {}, o.goods.length > 1 ? t('No. {n}: {count} items, due day {day}', { n: o.n, count: o.goods.length, day: day(o.due) }) : t('No. {n}: {count} item, due day {day}', { n: o.n, count: o.goods.length, day: day(o.due) })))));
    } else if (S.ledTab === 'report') {
      const r = healthReport(G);
      list.append(h('p', { class: 'note' }, t('District health office, laboratory bulletin for {season} (day {day}). Share of germs from the valley that resist each medicine, from {n} samples of each. A new bulletin comes each season.', { season: lc(SEASON_NAMES[r.season]), day: r.day, n: r.n })));
      for (const o of ORGANISMS) list.append(h('h4', {}, o.name), h('ul', {}, Object.keys(o.mic).map((d) => { const v = r.data[o.id][d]; return h('li', { class: v >= 0.5 ? 'bad' : v >= 0.2 ? '' : 'good' }, t('{drug}: {pct}% resistant', { drug: ACTIVE.get(d).name, pct: Math.round(v * 100) })); })));
      detail.append(h('p', { class: 'hint' }, t('Every course of an antibiotic, needed or not, breeds resistance in the germs people carry. Doses too small or stopped too soon breed it fastest. Left unused for a long time, a medicine slowly regains its power.')));
    } else {
      for (const v of VENDORS) { const n = nextVisit(G.meta.seed, v, G.W.time); list.append(h('div', { class: 'lrow' }, h('span', {}, v.name), h('small', {}, v.fixed ? t('daily {from}–{to}', { from: clock(v.open[0]), to: clock(v.open[1]) }) : n ? (n === day(G.W.time) ? t('today') : t('day {n}', { n })) : '—'))); }
    }
    panel.append(head(t('Ledger')), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, tabs, list), detail));
  };
  // ———————————————————————————————————— map
  PANELS.map = () => {
    const R = G.W.R, N = G.W.N;
    const cv = h('canvas', { class: 'bigmap', width: N * 3, height: N * 3 });
    const ctx = cv.getContext('2d');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const od = G.W.objDef(x, y);
      ctx.fillStyle = od?.kind === 'wall' ? '#d8b890' : od?.kind === 'plant' && G.p.known[od.herb] ? HERB.get(od.herb).color : od?.kind === 'tree' ? '#2a4a22' : G.W.groundDef(x, y).color;
      ctx.fillRect(x * 3, y * 3, 3, 3);
    }
    ctx.font = "600 13px 'Pixelify Sans', 'Galmuri'"; ctx.textAlign = 'center'; // Galmuri draws Hangul
    for (const s of [R.village, ...R.hamlets]) { const nm = personName(s.name); ctx.fillStyle = '#000'; ctx.fillText(nm, s.x * 3 + 1, s.y * 3 - 13); ctx.fillStyle = s === R.village ? '#ffe08a' : '#f4ead2'; ctx.fillText(nm, s.x * 3, s.y * 3 - 14); }
    ctx.fillStyle = '#ff5050'; ctx.fillRect(R.clinic.out.x * 3 - 3, R.clinic.out.y * 3 - 3, 7, 7);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(G.p.x * 3, G.p.y * 3, 4, 0, 7); ctx.fill();
    panel.append(head(t('The valley')), h('div', { class: 'pbody mapwrap' }, cv, h('p', { class: 'hint maplegend' }, t('White: you. Red: the clinic. Coloured dots: medicinal plants you know.'))));
  };
  // ———————————————————————————————————— let time pass
  PANELS.wait = () => {
    const m = minuteOfDay(G.W.time);
    const go = (mins) => { ui.close(); G.scene.passTime(mins); };
    const rows = [[t('1 hour'), HOUR], [t('{n} hours', { n: 3 }), 3 * HOUR], [t('Until morning'), (m > 6 * 60 ? DAY : 0) + 6.5 * 60 - m], [t('1 day'), DAY], [t('{n} days', { n: 3 }), 3 * DAY], [t('{n} days', { n: 7 }), 7 * DAY]];
    panel.append(head(t('Let time pass')), h('div', { class: 'pbody single' },
      h('p', {}, `${t('Day {n}', { n: day(G.W.time) })} · ${clock(G.W.time)}`),
      h('div', { class: 'acts' }, rows.map(([l, mins]) => h('button', { onclick: () => go(mins) }, l))),
      h('p', { class: 'hint' }, t('Everyone at home lives through it: medicines are taken (or not), illnesses run their course, babies come. Patients waiting at the clinic may give up and go home.'))));
  };
  // ———————————————————————————————————— menu
  PANELS.menu = () => {
    const m = minuteOfDay(G.W.time);
    const canSleep = m > 17 * 60 || m < 5 * 60;
    panel.append(head(t('Menu')), h('div', { class: 'pbody single' },
      h('div', { class: 'acts' },
        h('button', { class: 'primary', disabled: !canSleep, onclick: () => { ui.close(); G.scene.sleep(); } }, canSleep ? t('Sleep until morning') : t('Sleep (after 17:00)')),
        h('button', { onclick: async () => { await G.save(); ui.toast(t('Saved.')); } }, t('Save')),
        h('button', { onclick: () => G.exportFile() }, t('Export save file')),
        h('button', { onclick: () => { G.save().then(() => location.reload()); } }, t('Back to title'))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: G.settings.sound !== false, onchange: (e) => { G.settings.sound = e.target.checked; setSound(e.target.checked, 0.5); G.saveSettings(); } }), t('Sound')),
      h('div', { class: 'row langrow' }, h('span', {}, t('Language') + ':'), h('span', { class: 'chips' }, AVAILABLE.map(([c, l]) => h('button', { class: c === getLang() ? 'on' : '', lang: c, onclick: () => ui.setLang(c) }, l)))),
      h('div', { class: 'help' }, h('h3', {}, t('How to play')),
        h('p', {}, t('Patients walk in from the hamlets and wait on the benches. Walk up and tap them (or press N / the "Next patient" button). Ask, examine the body, decide what it is, then treat: what you give, how much, how often and for how long all matter — the body does the rest, at home, after they leave.')),
        h('p', {}, t('Gather herbs in the valley (the Book says where and when). Dry them on the rack, then make teas, decoctions, powders and tinctures. Buy salt, sugar, honey and tools from the traders. Build up the clinic. Your name in the valley rises when people recover and falls when they die.')),
        h('p', {}, t('Keys: WASD move · click/tap to walk and use · Space/E use · N next patient · I bag · C make · B build · H handbook · L ledger · M map · T wait · Esc menu.')))));

  };
  return ui;
}
