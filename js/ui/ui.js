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
import { stock, buy, sell, offer, LOT, lotPrice, nextVisit, CATALOGUE, catalogueItems, orderTotal, placeOrder } from '../core/economy.js';
import { startEncounter, ask, examine, differential, questionsFor, examsFor, remedies, rxLine, doseInfo, stockOf, finishEncounter, doProcedure, toolsAt, INSTRUCTIONS, PROCEDURES } from '../core/encounter.js';
import { EXAMS } from '../core/content/findings.js';
import { who, hamletOf, ageWords, OPEN, CLOSE, resistance } from '../core/clinic.js';
import { medianWeight } from '../core/patient.js';
import { bodySVG, REGIONS } from './body.js';
import { makeRng } from '../core/rng.js';
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
const amt = (it, n) => (it.unit === 'g' ? `${fmt(n)} g` : it.unit === 'ml' ? (n >= 1000 ? `${fmt(n / 1000)} L` : `${fmt(n)} ml`) : it.unit === 'app' ? `${fmt(n)} appl.` : `×${fmt(n)}`);
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.abs(n) >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100).toString();
const sh = (n) => `${fmt(n)} sh`;
const SEASON_CLASS = { cool_dry: 'cool', hot_dry: 'hot', rains: 'rain', late_rains: 'late' };

export function makeUI(G) {
  const root = $('#ui');
  root.innerHTML = '';
  const S = { panel: null, arg: null, sel: null, enc: null, encTab: 'talk', encRight: 'notes', region: null, rx: null, hbTab: 'conditions', hbSel: null, ledTab: 'patients', ledSel: null, makeSel: null, makeTimes: 1, helper: true, typing: false };
  const ui = {};

  // ———————————————————————————————————— HUD
  const info = h('div', { class: 'hud-info' });
  const waitBtn = h('button', { class: 'waitbtn hidden', onclick: () => G.scene.nextPatient() });
  const side = h('div', { class: 'sidebtns' },
    ...[['bag', 'knapsack', 'Bag', 'I'], ['make', 'pestle-mortar', 'Make', 'C'], ['build', 'hammer-nails', 'Build', 'B'], ['handbook', 'open-book', 'Book', 'H'], ['ledger', 'notebook', 'Ledger', 'L'], ['map', 'treasure-map', 'Map', 'M'], ['menu', 'cog', 'Menu', 'Esc']]
      .map(([p, ic, label, key]) => h('button', { class: 'hudbtn', title: `${label} (${key})`, onclick: () => ui.toggle(p) }, icon({ gi: ic, c: '#e8dcc0' }, 26), h('span', {}, label))));
  const hot = h('div', { class: 'hotbar' });
  const heldName = h('div', { class: 'heldname' });
  const toasts = h('div', { class: 'toasts' });
  const banner = h('div', { class: 'banner' });
  const panel = h('div', { class: 'panel hidden' });
  const touch = h('div', { class: 'touch hidden' }, h('div', { class: 'joyzone' }));
  const controls = h('div', { class: 'controls hidden' },
    h('button', { class: 'runbtn', onpointerdown: () => { G.input.sprint = !G.input.sprint; controls.querySelector('.runbtn').classList.toggle('on', G.input.sprint); } }, icon({ gi: 'sprint', c: '#e8dcc0' }, 28)),
    h('button', { class: 'mainhand', onclick: () => G.scene.useNearest() }, icon({ gi: 'hand', c: '#f4ead2' }, 48), h('span', {}, 'Use')));
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
    const t = G.W.time, cl = G.meta.clinic;
    const waiting = Object.values(cl.patients).filter((p) => p.status === 'waiting').length;
    const coming = Object.values(cl.patients).filter((p) => p.status === 'arriving').length;
    const m = minuteOfDay(t);
    const open = m >= OPEN && m <= CLOSE;
    info.innerHTML = '';
    info.append(
      h('b', {}, G.meta.name),
      h('div', { class: 'clock' }, h('span', { class: 'season ' + SEASON_CLASS[season(t)] }, SEASON_NAMES[season(t)]), ` · Day ${day(t)} · `, h('b', {}, clock(t)), open ? '' : h('span', { class: 'closed' }, ' · closed')),
      h('div', { class: 'money' }, icon({ gi: 'two-coins', c: '#e8c050' }, 18), ` ${sh(G.p.coins)}`),
      h('div', { class: 'rep', title: 'Your name in the valley' }, 'Name in the valley ', h('i', {}, h('u', { style: `width:${Math.round(cl.rep * 100)}%` }))));
    waitBtn.classList.toggle('hidden', !waiting && !coming);
    waitBtn.textContent = waiting ? `Next patient (${waiting} waiting)${coming ? ` · ${coming} coming` : ''}` : `${coming} on the way`;
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
    heldName.textContent = it ? it.name + (it.place ? ' — tap a spot to place it' : it.plant ? ' — use on a garden bed to plant' : '') : '';
    if (S.panel && S.panel !== 'encounter') render();
  };
  const shortAmt = (it, n) => (it.unit === 'ml' && n >= 1000 ? fmt(n / 1000) + 'L' : fmt(n));

  ui.toast = (text, cls = '') => {
    const t = h('div', { class: 'toast ' + cls }, text);
    toasts.append(t);
    while (toasts.children.length > 5) toasts.firstChild.remove();
    setTimeout(() => t.classList.add('fade'), cls ? 6000 : 3500);
    setTimeout(() => t.remove(), cls ? 7000 : 4500);
  };
  ui.banner = (big, small) => { banner.innerHTML = ''; banner.append(h('small', {}, small), h('b', {}, big)); banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); };
  ui.news = (n) => { ui.toast(n.text, n.kind === 'death' ? 'bad' : n.kind === 'recovered' ? 'good' : ''); if (n.kind === 'death') sfx('hurt'); if (n.kind === 'recovered') sfx('level'); };

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
    return h('div', { class: 'phead' }, h('h2', {}, title), extra || '', h('button', { class: 'x', onclick: ui.close, title: 'Close (Esc)' }, '✕'));
  }
  function render() {
    const keepScroll = [...panel.querySelectorAll('.scroll, .log, .detail')].map((e) => e.scrollTop);
    panel.innerHTML = '';
    panel.className = 'panel ' + S.panel;
    const f = PANELS[S.panel];
    if (f) f();
    [...panel.querySelectorAll('.scroll, .log, .detail')].forEach((e, i) => { if (keepScroll[i] !== undefined) e.scrollTop = keepScroll[i]; });
  }

  // ———————————————————————————————————— item detail
  function itemDetail(id, stack) {
    const it = G.C.items.get(id);
    const d = h('div', {}, h('div', { class: 'dhead' }, icon(it.icon, 56), h('div', {}, h('b', {}, it.name), h('small', {}, it.cat + (stack ? ' · ' + amt(it, stack.n) : '')))));
    const lines = [];
    if (it.herb) {
      const hb = HERB.get(it.herb);
      lines.push(h('li', {}, h('i', {}, hb.latin), ` — ${hb.part}. Evidence: ${hb.evidence}.`));
      if (it.form === 'fresh' && stack?.t !== undefined) { const age = (G.W.time - stack.t) / DAY; lines.push(h('li', {}, age > 2 ? `Picked ${fmt(age)} days ago — wilting, weaker each day.` : 'Fresh.')); }
    }
    if (it.actives && it.cat === 'medicine') for (const [a, mg] of Object.entries(it.actives)) lines.push(h('li', {}, `${ACTIVE.get(a).name}: ${fmt(mg)} mg per ${it.unit || 'tablet'}, as the label says. Sold in ${it.unit ? `bottles of ${it.pack} ${it.unit}` : `boxes of ${it.pack}`}.`));
    else if (it.actives) for (const [a, mg] of Object.entries(it.actives)) lines.push(h('li', {}, `${ACTIVE.get(a).name}: about ${fmt(mg)} mg per ${it.unit || 'unit'} (nominal — the real strength of this batch is unknown without an assay).`));
    if (it.ref) lines.push(h('li', { class: 'dim' }, `Where There Is No Doctor, Green Pages ${it.ref.replace('WTND ', '')}.`));
    if (it.topical) for (const a of Object.keys(it.topical)) lines.push(h('li', {}, `On the skin: ${ACTIVE.get(a).name} (${ACTIVE.get(a).class}).`));
    if (it.fluid) lines.push(h('li', {}, 'Replaces water and salt lost in diarrhoea and vomiting.'));
    if (stack?.t !== undefined && it.shelfDays && it.form !== 'fresh') { const age = (G.W.time - stack.t) / DAY; if (age > it.shelfDays) lines.push(h('li', { class: 'bad' }, 'Past its keeping time — weak or spoiled.')); else if (it.shelfDays < 5) lines.push(h('li', {}, `Keeps about ${it.shelfDays < 1 ? Math.round(it.shelfDays * 24) + ' hours' : it.shelfDays + ' days'}.`)); }
    if (it.note) lines.push(h('li', {}, it.note));
    if (it.plant) lines.push(h('li', {}, `Plant in a garden bed: ready in about ${it.growDays} days.`));
    if (it.place) lines.push(h('li', {}, 'Hold it and tap a spot near you to place it.'));
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
    const detail = h('div', { class: 'detail' + (s ? '' : ' empty') }, s ? itemDetail(s.id, s) : 'Choose something.');
    if (s) detail.append(h('div', { class: 'acts' }, h('button', { onclick: () => holdItem(S.sel) }, 'Hold')));
    panel.append(head('Bag', h('button', { onclick: () => { sortInv(G.p.inv, G.C, 8); render(); } }, 'Sort')), h('div', { class: 'pbody inv' }, h('div', { class: 'scroll' }, h('h3', {}, `Bag · ${sh(G.p.coins)}`), grid,
      h('p', { class: 'hint' }, 'The top row is your hotbar (keys 1–8). Hold an item to place, plant or use it.')), detail));
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
    const hint = od.dries ? 'Fresh herbs dry here (about a day in the hot season, three in the rains). Outside in the rains they can go mouldy — racks indoors are safe.' : od.stock ? 'Stock on these shelves can be dispensed during consultations.' : '';
    panel.append(head(od.name), h('div', { class: 'pbody single' }, ...mk(st.inv, G.p.inv, od.name), ...mk(G.p.inv, st.inv, 'Your bag (tap to move)'), h('p', { class: 'hint' }, hint)));
  };
  // ——— steeping jar
  PANELS.jar = () => {
    const { x, y } = S.arg;
    const st = G.W.container(x, y) || G.W.state(x, y) || {};
    const body = h('div', { class: 'pbody single' });
    if (st.brew) {
      const it = G.C.items.get(st.brew.out);
      const left = st.brew.readyAt - G.W.time;
      body.append(h('div', { class: 'dhead' }, icon(it.icon, 48), h('div', {}, h('b', {}, it.name), h('small', {}, `${amt(it, st.brew.n)} · ${left > 0 ? 'ready in ' + (left > DAY ? fmt(left / DAY) + ' days' : Math.ceil(left / HOUR) + ' hours') : 'ready'}`))),
        h('button', { class: 'primary', disabled: left > 0, onclick: () => { const r = collectBrew(G, x, y); ui.toast(r.ok ? `Collected ${G.C.items.get(r.out.out).name}.` : r.why); render(); ui.refresh(); } }, 'Collect'));
    } else {
      body.append(h('p', {}, 'Empty. Start a cold soak (a day) or a tincture (a week):'));
      const list = h('div', { class: 'rlist' });
      for (const r of G.C.recipes.filter((r) => r.hours)) {
        const why = blocker(G, r);
        list.append(h('button', { class: 'recipe' + (why ? ' miss' : ''), onclick: () => { G.nearJar = () => ({ x, y, st: G.W.container(x, y) || (G.W.setState(x, y, {}), G.W.state(x, y)) }); const res = make(G, r); G.nearJar = nearJar; if (!res.ok) ui.toast(res.why); else G.scene.handle(res.ev); render(); } },
          icon(G.C.items.get(r.out).icon, 30), h('span', {}, G.C.items.get(r.out).name), h('small', {}, why || r.in.map(([s, n]) => `${n} ${specName(G.C, s)}`).join(', '))));
      }
      body.append(list);
    }
    panel.append(head('Steeping jars'), body);
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
    const groups = [['Herbal remedies', G.C.recipes.filter((r) => r.herb && !r.hours)], ['Hand preparations', G.C.recipes.filter((r) => r.special)], ['Soaks & tinctures (at a steeping jar)', G.C.recipes.filter((r) => r.hours)]];
    for (const [title, rs] of groups) {
      list.append(h('h3', {}, title));
      const sorted = [...rs].sort((a, b) => (!!blocker(G, a) - !!blocker(G, b)) || a.out.localeCompare(b.out));
      for (const r of sorted) {
        if (r.herb && !G.p.known[r.herb] && !count(G.p.inv, 'fresh_' + r.herb) && !count(G.p.inv, 'dried_' + r.herb)) continue;
        const it = G.C.items.get(r.out), why = blocker(G, r);
        list.append(h('button', { class: 'recipe' + (why ? ' miss' : '') + (S.makeSel === r.id ? ' sel' : ''), onclick: () => { S.makeSel = r.id; S.makeTimes = 1; render(); } }, icon(it.icon, 30), h('span', {}, it.name), h('small', {}, why ? '—' : 'ready')));
      }
    }
    const r = G.C.recipes.find((x) => x.id === S.makeSel);
    const detail = h('div', { class: 'detail' + (r ? '' : ' empty') });
    if (!r) detail.append('Herbs you have found show their remedies here. Find plants in the valley — the Book tells you where they grow.');
    else {
      const it = G.C.items.get(r.out);
      const why = blocker(G, r, S.makeTimes);
      detail.append(itemDetail(r.out));
      detail.append(h('h4', {}, r.method ? METHODS[r.method].verb : 'Method'),
        h('ul', { class: 'ing' }, r.in.map(([s, n]) => { const have = s.startsWith('#') ? G.C.tags.get(s.slice(1)).reduce((a, id) => a + count(G.p.inv, id), 0) : count(G.p.inv, s); return h('li', { class: have >= n * S.makeTimes ? 'ok' : 'no' }, `${fmt(n * S.makeTimes)}${G.C.items.get(s.startsWith('#') ? G.C.tags.get(s.slice(1))[0] : s)?.unit === 'g' ? ' g' : G.C.items.get(s)?.unit === 'ml' ? ' ml' : ''} ${specName(G.C, s)} (have ${fmt(have)})`); }),
          r.station ? h('li', { class: G.stations.has(r.station) ? 'ok' : 'no' }, `At a ${stationName(r.station)}`) : null, r.tool ? h('li', { class: count(G.p.inv, r.tool) ? 'ok' : 'no' }, `With a ${G.C.items.get(r.tool).name.toLowerCase()}`) : null),
        h('p', { class: 'hint' }, `Makes about ${amt(it, r.yields * S.makeTimes)}${r.hours ? ` after ${r.hours >= 48 ? r.hours / 24 + ' days' : r.hours + ' hours'}` : ''}. Takes ${r.min * S.makeTimes} minutes.`),
        h('div', { class: 'acts' }, h('button', { onclick: () => { S.makeTimes = Math.max(1, S.makeTimes - 1); render(); } }, '−'), h('span', {}, `× ${S.makeTimes}`), h('button', { onclick: () => { S.makeTimes++; render(); } }, '+'),
          h('button', { class: 'primary', disabled: !!why, onclick: () => { const res = make(G, r, S.makeTimes); if (!res.ok) ui.toast(res.why); else G.scene.handle(res.ev); render(); } }, 'Make')),
        why ? h('p', { class: 'bad' }, why) : '');
    }
    panel.append(head('Make remedies'), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, list), detail));
  };
  // ——— build
  PANELS.build = () => {
    const list = h('div', { class: 'rlist' });
    for (const b of PLACEABLES) {
      const r = G.C.recipes.find((x) => x.id === 'make_' + b.id);
      const why = blocker(G, r);
      list.append(h('button', { class: 'recipe' + (why ? ' miss' : '') + (S.sel === b.id ? ' sel' : ''), onclick: () => { S.sel = b.id; render(); } }, icon(G.C.items.get(b.id).icon, 30), h('span', {}, b.name), h('small', {}, b.cost.map(([id, n]) => `${n} ${G.C.items.get(id).name.toLowerCase()}`).join(', '))));
    }
    const b = PLACEABLES.find((x) => x.id === S.sel);
    const detail = h('div', { class: 'detail' + (b ? '' : ' empty') });
    if (!b) detail.append('Build up the clinic. Materials come from the village shop — or cut poles and thatch yourself with a knife.');
    else {
      const r = G.C.recipes.find((x) => x.id === 'make_' + b.id);
      const why = blocker(G, r);
      detail.append(itemDetail(b.id), h('ul', { class: 'ing' }, b.cost.map(([id, n]) => h('li', { class: count(G.p.inv, id) >= n ? 'ok' : 'no' }, `${n} ${G.C.items.get(id).name.toLowerCase()} (have ${count(G.p.inv, id)})`)),
        r.station ? h('li', { class: G.stations.has(r.station) ? 'ok' : 'no' }, 'At the workbench') : null),
        h('div', { class: 'acts' }, h('button', { class: 'primary', disabled: !!why, onclick: () => { const res = make(G, r); if (!res.ok) { ui.toast(res.why); return; } G.scene.handle(res.ev); const i = G.p.inv.slots.findIndex((s) => s?.id === b.id); if (i >= 0) holdItem(i); ui.toast('Tap a spot near you to place it.'); } }, 'Make and place')),
        why ? h('p', { class: 'bad' }, why) : '');
    }
    panel.append(head('Build'), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, list), detail));
  };
  // ——— trade
  PANELS.trade = () => {
    const { v, key } = S.arg;
    const rows = h('div', { class: 'rlist' });
    for (const row of stock(G, v, key)) {
      const it = G.C.items.get(row.id);
      rows.append(h('div', { class: 'trow' }, icon(it.icon, 30), h('span', {}, it.name, h('small', {}, ` ${it.unit ? amt(it, LOT(it)) : ''} · ${row.n} left`)),
        h('button', { onclick: () => { const r = buy(G, v, key, row.id); if (!r.ok) ui.toast(r.why); else { sfx('coin'); ui.toast(`Bought ${it.name}.`); } render(); ui.refresh(); } }, sh(row.price))));
    }
    const sells = h('div', { class: 'rlist' });
    const seen = new Set();
    for (const s of G.p.inv.slots) {
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      const pr = offer(G, v, s.id);
      if (pr === null) continue;
      const it = G.C.items.get(s.id);
      sells.append(h('div', { class: 'trow' }, icon(it.icon, 30), h('span', {}, it.name, h('small', {}, ` have ${amt(it, count(G.p.inv, s.id))}`)),
        h('button', { onclick: () => { const r = sell(G, v, s.id); if (!r.ok) ui.toast(r.why); else sfx('coin'); render(); ui.refresh(); } }, `Sell ${it.unit ? amt(it, LOT(it)) : 1} for ${sh(pr)}`)));
    }
    panel.append(head(`${v.name} · ${sh(G.p.coins)}`), h('div', { class: 'pbody single' }, h('p', { class: 'note' }, `${v.who}: “${v.greet}”`), h('h3', {}, 'For sale'), rows,
      sells.children.length ? [h('h3', {}, 'They will buy'), sells] : null,
      v.adulterate ? h('p', { class: 'hint' }, 'Herbs from traders vary in strength — and are not always what they are said to be.') : null));
  };

  // ———————————————————————————————————— the consultation
  PANELS.encounter = () => {
    const enc = S.enc;
    const p = G.meta.clinic.patients[enc.pid];
    const tools = toolsAt(G);
    const mins = Math.round(G.W.time - enc.t0);
    const ham = hamletOf(G, p.hamlet);
    const title = h('div', { class: 'etitle' }, h('b', {}, p.name), h('small', {}, ` ${ageWords(p.age)} · ${p.sex === 'f' ? (p.age < 13 ? 'girl' : 'woman') : p.age < 13 ? 'boy' : 'man'} · from ${ham.name}${p.visits.length ? ` · visit ${p.visits.length + 1}` : ''}`));
    const timer = h('small', { class: 'etime' }, `${mins} min`);
    ui.encTime = () => { timer.textContent = `${Math.round(G.W.time - enc.t0)} min`; };
    // talk
    const log = h('div', { class: 'log' }, enc.log.map((l) => h('div', { class: 'line ' + (l.who === 'You' ? 'me' : l.who === 'Exam' ? 'exam' : 'them') }, h('b', {}, l.who === 'Exam' ? '' : l.who + ': '), l.text)));
    const chips = h('div', { class: 'chips qchips' }, questionsFor(p).map((q) => h('button', { class: enc.done.has(q.id) ? 'done' : '', onclick: () => { ask(G, enc, q.id); sfx('ui'); render(); } }, q.label)));
    const talk = h('section', { class: 'talk' }, h('h3', {}, 'Talk'), log, chips);
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
        regMenu.append(h('button', { class: (enc.done.has(x.id) ? 'done ' : '') + (need ? 'miss' : ''), disabled: need, title: need ? `Needs a ${G.C.items.get(x.tool).name.toLowerCase()}` : '', onclick: () => { const r = examine(G, enc, x.id); if (!r.ok) ui.toast(r.text); sfx('ui'); render(); } },
          x.tool ? icon(G.C.items.get(x.tool).icon, 20) : null, x.label, need ? h('small', {}, ` — needs ${G.C.items.get(x.tool).name.toLowerCase()}`) : x.better && !tools.has(x.better) ? h('small', {}, ` (a ${G.C.items.get(x.better).name.toLowerCase()} would help)`) : null));
      }
      const found = Object.entries(enc.found).filter(([k]) => regionOf(k) === S.region);
      if (found.length) regMenu.append(h('ul', {}, found.map(([, f]) => h('li', { class: f.pos ? 'abn' : '' }, f.v))));
    } else regMenu.append(h('p', { class: 'hint' }, 'Tap a part of the body to examine it.'));
    const tray = h('div', { class: 'tray' }, h('small', {}, 'Your tools: '), ...[...tools].map((t) => h('span', { class: 'tool', title: G.C.items.get(t).name }, icon(G.C.items.get(t).icon, 26))),
      tools.has('scale') ? h('button', { onclick: () => { examine(G, enc, 'x_weigh'); render(); } }, icon({ gi: 'scales', c: '#c0b080' }, 20), 'Weigh') : h('small', { class: 'dim' }, ' (no scale — weight is a guess)'));
    const exam = h('section', { class: 'exam' }, h('h3', {}, 'Examine'), h('div', { class: 'examgrid' }, svgWrap, regMenu), tray);
    // notes / differential
    const notes = h('div', { class: 'notesbox' });
    const ab = Object.entries(enc.found).filter(([, f]) => f.pos), nm = Object.entries(enc.found).filter(([, f]) => !f.pos && f.v !== '—');
    notes.append(h('h4', {}, `Found (${ab.length})`), h('ul', {}, ab.map(([, f]) => h('li', { class: 'abn' }, f.v))));
    if (nm.length) notes.append(h('h4', {}, 'Normal / absent'), h('ul', { class: 'dim' }, nm.map(([, f]) => h('li', {}, f.v))));
    if (S.helper) {
      const dd = differential(enc);
      notes.append(h('h4', {}, 'What it could be (helper)'), dd.length ? h('ol', {}, dd.map((d) => h('li', {}, d.name, h('small', {}, ` · ${d.score}`)))) : h('p', { class: 'hint' }, 'Ask and examine first.'));
    }
    notes.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.helper, onchange: (e) => { S.helper = e.target.checked; render(); } }), 'Show the differential helper'));
    // treat
    const treat = h('div', { class: 'treatbox' });
    treat.append(h('h4', {}, 'Working diagnosis'), h('div', { class: 'chips' }, CONDITIONS.map((c) => h('button', { class: enc.dx.includes(c.id) ? 'on' : '', onclick: () => { const i = enc.dx.indexOf(c.id); if (i >= 0) enc.dx.splice(i, 1); else enc.dx.push(c.id); render(); } }, c.name))));
    // prescription builder
    const rems = remedies(G);
    const R = S.rx;
    if (!R.item && rems.length) R.item = rems[0].id;
    const it = R.item && G.C.items.get(R.item);
    if (it && !it.route.includes(R.route)) R.route = it.route[0];
    const presets = !it ? [] : it.unit === 'ml' ? [['drop', 0.05], ['1 ml', 1], ['tsp', 5], ['tbsp', 15], ['½ cup', 125], ['cup', 250]] : it.unit === 'g' ? (it.id === 'honey' ? [['tsp', 7], ['tbsp', 20], ['dressing', 15]] : [['0.05 g', 0.05], ['0.1 g', 0.1], ['pinch', 0.3], ['tsp', 2], ['tbsp', 6]]) : it.cat === 'medicine' ? [['¼', 0.25], ['½', 0.5], ['1', 1], ['2', 2]] : [['1', 1]];
    const weighed = !!enc.found.weight;
    const estW = weighed ? p.weight : Math.round(medianWeight(p.age, p.sex) * 10) / 10;
    const line = it ? rxLine(G, R.item, R.amount, R.perDay, R.days, R.route) : null;
    const dinfo = line ? doseInfo(G, p, line, estW) : [];
    treat.append(h('h4', {}, 'Prescribe'),
      rems.length ? h('div', { class: 'rxform' },
        h('select', { onchange: (e) => { R.item = e.target.value; R.amount = 1; render(); } }, rems.map((r) => h('option', { value: r.id, selected: r.id === R.item }, `${r.name} — ${amt(r, stockOf(G, r.id))} in stock`))),
        it.route.length > 1 ? h('div', { class: 'chips' }, it.route.map((rt) => h('button', { class: R.route === rt ? 'on' : '', onclick: () => { R.route = rt; render(); } }, rt === 'oral' ? 'by mouth' : 'on the skin'))) : null,
        h('div', { class: 'row' }, h('span', {}, 'Each dose:'), h('input', { type: 'number', step: 'any', min: 0, value: R.amount, style: 'width:80px', onfocus: () => { S.typing = true; }, onblur: () => { S.typing = false; }, onchange: (e) => { R.amount = Math.max(0, +e.target.value || 0); render(); } }), h('span', {}, it.unit || 'each'),
          h('span', { class: 'chips' }, presets.map(([l, v]) => h('button', { class: R.amount === v ? 'on' : '', onclick: () => { R.amount = v; render(); } }, l)))),
        h('div', { class: 'row' }, h('span', {}, 'Times a day:'), h('span', { class: 'chips' }, [1, 2, 3, 4, 6].map((n) => h('button', { class: R.perDay === n ? 'on' : '', onclick: () => { R.perDay = n; render(); } }, n)))),
        h('div', { class: 'row' }, h('span', {}, 'For days:'), h('span', { class: 'chips' }, [1, 2, 3, 5, 7, 10, 14, 21].map((n) => h('button', { class: R.days === n ? 'on' : '', onclick: () => { R.days = n; render(); } }, n)))),
        dinfo.length ? h('div', { class: 'doseinfo' }, dinfo.map((d) => h('div', {}, `${d.name.split(' (')[0]}: ${fmt(d.mg)} mg a dose = ${fmt(d.mgkg)} mg/kg (${fmt(d.perDayKg)} mg/kg/day)`)),
          h('small', {}, `${weighed ? 'Weighed' : 'Guessed by age'}: ${estW} kg. ${it.cat === 'medicine' ? 'Strength as labelled.' : 'Nominal strength — this batch has not been assayed.'}`)) : null,
        h('div', { class: 'row' }, h('span', { class: 'hint' }, `Dispense ${amt(it, line.qty)} (in stock ${amt(it, stockOf(G, it.id))})`),
          h('button', { disabled: !R.amount || line.qty > stockOf(G, it.id), onclick: () => { enc.rx.push(line); render(); } }, 'Add'))) : h('p', { class: 'hint' }, 'No remedies in your bag or on the shelves.'),
      enc.rx.length ? h('ul', { class: 'rxlist' }, enc.rx.map((l, i) => h('li', {}, `${l.name}: ${amt(G.C.items.get(l.item), l.amount)} ${l.route === 'topical' ? 'applied' : ''} ${l.perDay}× a day for ${l.days} days`, h('button', { class: 'link', onclick: () => { enc.rx.splice(i, 1); render(); } }, ' remove')))) : '');
    treat.append(h('h4', {}, 'In the clinic'), h('div', { class: 'chips' }, PROCEDURES.filter((pr) => pr.applies(p)).map((pr) => h('button', { class: enc.proc.has(pr.id) ? 'on' : '', onclick: () => { const r = doProcedure(G, enc, pr.id); ui.toast(r.text); render(); } }, pr.label))));
    treat.append(h('h4', {}, 'Advice'), h('div', { class: 'checks' }, INSTRUCTIONS.map((ins) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: enc.instr.has(ins.id), onchange: (e) => { if (e.target.checked) enc.instr.add(ins.id); else enc.instr.delete(ins.id); } }), ins.label))));
    treat.append(h('div', { class: 'row' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: enc.refer, onchange: (e) => { enc.refer = e.target.checked; } }), 'Refer to the health centre (two days\' walk)')),
      h('div', { class: 'row' }, h('span', {}, 'Come back in:'), h('span', { class: 'chips' }, [0, 1, 2, 3, 7].map((n) => h('button', { class: enc.returnDays === n ? 'on' : '', onclick: () => { enc.returnDays = n; render(); } }, n ? n + ' d' : 'only if worse')))),
      h('div', { class: 'acts' }, h('button', { class: 'primary', onclick: () => finish() }, 'Finish and send home')));
    const rightTabs = h('div', { class: 'chips etabs2' }, [['notes', 'Notes'], ['treat', 'Treat']].map(([k, l]) => h('button', { class: S.encRight === k ? 'on' : '', onclick: () => { S.encRight = k; render(); } }, l)));
    const right = h('section', { class: 'right' }, rightTabs, S.encRight === 'notes' ? notes : treat);
    const tabs = h('div', { class: 'etabs' }, [['talk', 'Talk'], ['exam', 'Examine'], ['notes', 'Notes'], ['treat', 'Treat']].map(([k, l]) => h('button', { class: S.encTab === k ? 'on' : '', onclick: () => { S.encTab = k; if (k === 'notes' || k === 'treat') S.encRight = k; render(); } }, l)));
    const body = h('div', { class: 'ebody tab-' + S.encTab }, talk, exam, right);
    panel.append(h('div', { class: 'phead' }, title, timer, h('button', { class: 'x', title: 'Ask them to wait (Esc)', onclick: ui.close }, '✕')), tabs, body);
    const lg = $('.log', panel); if (lg) lg.scrollTop = lg.scrollHeight;
  };
  const regionOf = (k) => ({ temp: 'head', feels_hot: 'head', fontanel: 'head', alert: 'head', flushed: 'face', pupils: 'face', yellow_vision: 'face', sunken_eyes: 'face', dry_mouth: 'face', tears: 'face', pallor: 'face', thin: 'head',
    rr: 'chest', indrawing: 'chest', grunting: 'chest', crackles: 'chest', spleen: 'belly', pot_belly: 'belly', tender: 'belly', skin_pinch: 'belly', muac: 'arm', bp: 'arm', hr: 'wrist', pulse_regular: 'wrist',
    burrows: 'hands', skin_sores: 'hands', rash: 'hands', measles_rash: 'hands', ear_pus: 'head', neck_glands: 'head', tonsils: 'face', koplik: 'face', red_eyes: 'face',
    suprapubic: 'belly', rose_spots: 'belly', bloating: 'belly', loin_pain: 'back', edema: 'legs', back_exam: 'back', pus: 'wound', redness: 'wound', red_streaks: 'wound', glands: 'wound', wound_size: 'wound', burn_area: 'wound', blisters: 'wound', burn_deep: 'wound' }[k]);
  function finish() {
    const enc = S.enc;
    const p = G.meta.clinic.patients[enc.pid];
    if (!enc.dx.length && !confirm('No working diagnosis chosen. Send them home anyway?')) return;
    const res = finishEncounter(G, enc);
    S.enc = null;
    const pay = res.pay;
    ui.toast(`${p.name} paid ${sh(pay.cash)}${pay.kind.length ? ' and ' + pay.kind.map(([id, n]) => `${n} ${G.C.items.get(id).name.toLowerCase()}`).join(', ') : ''}${pay.debt ? ` (owes ${sh(pay.debt)})` : ''}.`);
    if (enc.refer) ui.toast(res.referWent ? 'They will go to the health centre.' : 'They cannot afford the journey to the health centre, and go home.');
    if (res.levelUp) ui.banner(`Diagnosis level ${res.levelUp}`, 'Skill');
    sfx('coin');
    G.scene.sendHome(p.id);
    S.panel = null; panel.classList.add('hidden'); panel.innerHTML = ''; document.body.classList.remove('panel-open');
    ui.refresh(); ui.tick(); G.save();
  }

  // ———————————————————————————————————— handbook
  PANELS.handbook = () => {
    const tabs = h('div', { class: 'chips' }, [['conditions', 'Illnesses'], ['plants', 'Plants'], ['compounds', 'Compounds'], ['germs', 'Germs'], ['methods', 'Preparing'], ['about', 'About']].map(([k, l]) => h('button', { class: S.hbTab === k ? 'on' : '', onclick: () => { S.hbTab = k; S.hbSel = null; render(); } }, l)));
    const list = h('div', { class: 'rlist' });
    const detail = h('div', { class: 'detail' });
    if (S.hbTab === 'conditions') {
      for (const c of CONDITIONS) list.append(h('button', { class: 'recipe' + (S.hbSel === c.id ? ' sel' : ''), onclick: () => { S.hbSel = c.id; render(); } }, icon({ gi: c.icon, c: c.color }, 28), h('span', {}, c.name), h('small', {}, c.ref)));
      const c = COND.get(S.hbSel) || CONDITIONS[0];
      detail.append(h('h3', {}, c.name), h('p', { class: 'note' }, c.learn), h('p', {}, h('b', {}, 'When to refer: '), c.teach.refer || '—'), h('p', { class: 'hint' }, `Also called: ${c.local.join(', ')}. Source: Where There Is No Doctor, ${c.ref.replace('WTND ', '')} (Hesperian), paraphrased.`));
    } else if (S.hbTab === 'plants') {
      for (const hb of HERBS) list.append(h('button', { class: 'recipe' + (S.hbSel === hb.id ? ' sel' : ''), onclick: () => { S.hbSel = hb.id; render(); } }, icon({ gi: hb.icon, c: hb.color }, 28), h('span', {}, hb.name, h('small', {}, ' ' + hb.latin)), h('small', {}, hb.evidence)));
      const hb = HERB.get(S.hbSel) || HERBS[0];
      detail.append(h('h3', {}, `${hb.name} — `, h('i', {}, hb.latin)), h('p', {}, `${hb.family}. Part used: ${hb.part}. Grows: ${Object.keys(hb.habitat).join(', ')}; ${hb.seasons === 'all' ? 'all year' : hb.seasons.map((s) => SEASON_NAMES[s].toLowerCase()).join(', ')}.`),
        h('p', {}, h('b', {}, 'Contains: '), Object.entries(hb.contains).map(([a, r]) => ACTIVE.get(a).channel === 'topical' ? ACTIVE.get(a).name : `${ACTIVE.get(a).name} ${r[0]}–${r[1]}% of dry weight`).join('; ')),
        h('p', {}, h('b', {}, 'Used for: '), hb.uses.join(', '), `. Evidence: ${hb.evidence}.`), h('p', { class: 'note' }, hb.note), hb.harms.length ? h('p', { class: 'bad' }, hb.harms.join(' ')) : null, h('p', { class: 'hint' }, hb.ref));
    } else if (S.hbTab === 'compounds') {
      for (const a of ACTIVES) list.append(h('button', { class: 'recipe' + (S.hbSel === a.id ? ' sel' : ''), onclick: () => { S.hbSel = a.id; render(); } }, h('span', {}, a.name), h('small', {}, a.class)));
      const a = ACTIVE.get(S.hbSel) || ACTIVES[0];
      detail.append(h('h3', {}, a.name), h('p', {}, `${a.class} · acts ${a.channel === 'systemic' ? 'through the blood' : a.channel === 'gut' ? 'in the gut' : a.channel === 'topical' ? 'on the skin' : 'as fluid'}`));
      if (a.pk) detail.append(h('p', {}, `Absorbed ${Math.round(a.pk.F * 100)}% · half-life ${a.pk.half} h · spreads into ${a.pk.vd} L/kg${a.pk.induce ? ' · the body learns to clear it faster over days of use' : ''}.`));
      if (a.abx) {
        const hits = ORGANISMS.filter((o) => a.id in o.mic), miss = ORGANISMS.filter((o) => !(a.id in o.mic));
        detail.append(h('p', {}, `Kills bacteria ${a.abx.hill >= 3 ? 'while the level stays above their MIC (time matters more than height)' : a.abx.kmax >= 0.3 ? 'faster the higher the level' : 'slowly: it mostly stops them growing and the body does the rest'}. Only the unbound part acts: ${Math.round(a.pk.fu * 100)}% is free in the blood.`),
          h('ul', {}, hits.map((o) => h('li', {}, `${o.name}: MIC ${o.mic[a.id]} mg/L; resistant strains ×${o.fold[a.id]}.`)), miss.map((o) => h('li', { class: 'dim' }, `${o.name}: no effect.`))));
      }
      for (const e of a.effects || []) detail.append(h('p', {}, e.prr ? `Kills malaria parasites while in the blood: at full strength about ${fmt(e.prr / 48)} log₁₀ (a ${fmt(10 ** (e.prr / 48))}-fold fall) an hour; half-effect at ${e.ec50} mg/L.` : `${e.on}: half its effect at ${e.ec50} mg/L.`));
      for (const tx of a.toxic || []) detail.append(h('p', { class: 'bad' }, `Above ${tx.at} mg/L: ${tx.text}.`));
      for (const c of a.cautions || []) detail.append(h('p', { class: 'bad' }, c));
      if (a.note) detail.append(h('p', { class: 'note' }, a.note));
      detail.append(h('p', { class: 'hint' }, a.ref));
    } else if (S.hbTab === 'germs') {
      for (const o of ORGANISMS) list.append(h('button', { class: 'recipe' + (S.hbSel === o.id ? ' sel' : ''), onclick: () => { S.hbSel = o.id; render(); } }, h('span', {}, o.name)));
      const o = ORG.get(S.hbSel) || ORGANISMS[0];
      detail.append(h('h3', {}, o.name), h('p', { class: 'note' }, 'The MIC is the lowest level of a medicine, in the blood and free of protein, that stops this germ growing. Keep the free level above it long enough and the germ dies; dose too low or stop too soon and the strong survivors are the ones that spread.'),
        h('ul', {}, Object.entries(o.mic).map(([d, m]) => h('li', {}, o.parasite ? `${ACTIVE.get(d).name}: resistant strains need ${o.fold[d]}× the level to be killed as fast` : `${ACTIVE.get(d).name}: ${m} mg/L (resistant strains ${fmt(m * o.fold[d])} mg/L)`))), h('p', { class: 'hint' }, o.ref));
    } else if (S.hbTab === 'methods') {
      for (const [k, m] of Object.entries(METHODS)) list.append(h('button', { class: 'recipe' + (S.hbSel === k ? ' sel' : ''), onclick: () => { S.hbSel = k; render(); } }, h('span', {}, m.name), h('small', {}, m.verb)));
      detail.append(h('p', { class: 'note' }, 'How much of a plant\'s medicine ends up in what you make depends on the method. Quinine hardly dissolves in plain water — boil cinchona with lime juice, or soak it in spirit. Artemisinin breaks down with long boiling. Powders keep everything, but the dose is bulky and bitter. These extraction figures are estimates from each compound\'s chemistry, not measurements.'),
        h('p', {}, 'Dry herbs on a rack before powdering or making tinctures. Fresh herbs lose strength after two days. Every plant differs: the same handful can be half or one and a half times the usual strength — which is why dosing crude herbs is uncertain, and why medicine moved to measured, assayed preparations.'));
    } else {
      detail.append(h('h3', {}, 'About this game'), h('p', {}, 'The illnesses, signs and home treatments follow Where There Is No Doctor by David Werner with Carol Thuman and Jane Maxwell (Hesperian Health Guides). Hesperian allows adaptation for free, non-profit use; this game is free. Text is paraphrased with page references; no illustrations are reused.'),
        h('p', {}, 'Pharmacology (absorption, half-lives, effective and toxic levels) is from the references shown on each compound. Some effect sizes are fitted to clinical trials and say so.'),
        h('p', { class: 'bad' }, 'This is a game, not medical advice. Do not treat anyone with what you learn here without proper training and current local guidelines.'),
        h('p', { class: 'credits' }, 'Art: Dungeon Crawl Stone Soup tiles (CC0) · game-icons.net (CC BY 3.0) · Phaser 3 · ZzFX · nipplejs · Pixelify Sans (OFL).'));
    }
    panel.append(head('Handbook'), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, tabs, list), detail));
  };
  // ———————————————————————————————————— ledger
  PANELS.ledger = () => {
    const cl = G.meta.clinic;
    const tabs = h('div', { class: 'chips' }, [['patients', 'Patients'], ['money', 'Money'], ['market', 'Traders'], ['post', 'Order by post'], ['report', 'Health office']].map(([k, l]) => h('button', { class: S.ledTab === k ? 'on' : '', onclick: () => { S.ledTab = k; S.ledSel = null; render(); } }, l)));
    const list = h('div', { class: 'rlist' });
    const detail = h('div', { class: 'detail' });
    const st = cl.stats;
    detail.append(h('p', {}, `Seen ${st.seen} · well again ${st.recovered} · died ${st.died}${st.harmed ? ` (${st.harmed} from a remedy)` : ''} · referred ${st.referred} · earned ${sh(st.income)}`));
    if (S.ledTab === 'patients') {
      const ps = Object.values(cl.patients).filter((p) => p.visits.length || p.status === 'waiting').sort((a, b) => (b.visits.at(-1)?.t || 0) - (a.visits.at(-1)?.t || 0));
      for (const p of ps) {
        const status = p.dead ? 'died' : p.recovered ? 'well' : p.status === 'hospital' ? 'at the health centre' : p.status;
        list.append(h('button', { class: 'recipe' + (S.ledSel === p.id ? ' sel' : '') + (p.dead ? ' dead' : p.recovered ? ' well' : ''), onclick: () => { S.ledSel = p.id; render(); } }, h('span', {}, who(p), h('small', {}, ' ' + hamletOf(G, p.hamlet).name)), h('small', {}, status)));
      }
      const p = cl.patients[S.ledSel];
      if (p) {
        detail.append(h('h3', {}, who(p)), h('p', {}, `${hamletOf(G, p.hamlet).name} · ${p.dead ? `died: ${p.cause}` : p.recovered ? 'recovered' : 'still unwell'}`));
        for (const v of p.visits) {
          detail.append(h('div', { class: 'entry' }, h('small', {}, `Day ${day(v.t)} ${clock(v.t)}`), h('b', {}, `You thought: ${v.dx.map((d) => COND.get(d).name).join(', ') || '—'}`),
            h('p', {}, v.rx.length ? 'Gave: ' + v.rx.join('; ') : 'No medicine.'), v.instr.length ? h('p', { class: 'dim' }, 'Advice: ' + v.instr.join(', ')) : null, v.refer ? h('p', {}, 'Referred.') : null,
            (p.dead || p.recovered) ? h('p', { class: v.judged.dxRight ? 'good' : 'bad' }, `In hindsight it was ${v.judged.truth}.${v.judged.helped.length ? ' What helped: ' + v.judged.helped.join(', ') + '.' : ''}${v.judged.harmed.length ? ' What harmed: ' + v.judged.harmed.join(', ') + '.' : ''}${v.judged.needless?.length ? ' No germ to kill: the ' + v.judged.needless.join(', ') + ' only bred resistance.' : ''}`) : null));
        }
      }
    } else if (S.ledTab === 'money') {
      for (const e of [...G.meta.ledger].reverse().slice(0, 120)) list.append(h('div', { class: 'lrow ' + e.kind }, h('small', {}, `D${day(e.t)} ${clock(e.t)}`), h('span', {}, e.text), e.amount ? h('b', {}, (e.amount > 0 ? '+' : '') + fmt(e.amount)) : null));
      detail.append(h('h4', {}, 'Your charges'), h('div', { class: 'row' }, h('span', {}, 'Consultation fee: '), h('span', { class: 'chips' }, [0, 1, 2, 3, 5].map((n) => h('button', { class: cl.fee === n ? 'on' : '', onclick: () => { cl.fee = n; render(); } }, sh(n))))),
        h('div', { class: 'row' }, h('span', {}, 'Medicines at cost ×'), h('span', { class: 'chips' }, [1, 1.3, 1.6, 2].map((n) => h('button', { class: cl.markup === n ? 'on' : '', onclick: () => { cl.markup = n; render(); } }, n)))),
        h('p', { class: 'hint' }, 'Higher fees keep the poorest away; they pay in eggs and maize when coins run short.'));
    } else if (S.ledTab === 'post') {
      const cart = (S.cart ||= {});
      for (const [title, cat] of [['Medicines', 'medicine'], ['Tools', 'tool']]) {
        list.append(h('h4', {}, title));
        for (const it of catalogueItems(G.C).filter((x) => x.cat === cat)) {
          const n = cart[it.id] || 0;
          list.append(h('div', { class: 'trow' }, icon(it.icon, 30), h('span', {}, it.name, h('small', {}, LOT(it) > 1 ? ` ${amt(it, LOT(it))}` : '')), h('small', {}, sh(lotPrice(it, CATALOGUE.mult))),
            h('button', { disabled: !n, onclick: () => { cart[it.id] = n - 1; render(); } }, '−'), h('b', {}, n), h('button', { onclick: () => { cart[it.id] = n + 1; render(); } }, '+')));
        }
      }
      const lines = Object.entries(cart).filter(([, n]) => n > 0);
      detail.append(h('h4', {}, 'Your order'), lines.length ? h('ul', {}, lines.map(([id, n]) => h('li', {}, `${n} × ${G.C.items.get(id).name}`))) : h('p', { class: 'hint' }, 'Nothing yet.'),
        h('p', {}, `Postage ${sh(CATALOGUE.postage)} · total ${sh(orderTotal(G.C, Object.fromEntries(lines)))}`),
        h('div', { class: 'acts' }, h('button', { class: 'primary', disabled: !lines.length, onclick: () => { const r = placeOrder(G, cart); if (!r.ok) ui.toast(r.why); else { sfx('coin'); ui.toast(`Order posted. Due about day ${day(r.due)}.`); S.cart = {}; } render(); ui.refresh(); } }, 'Post the order')),
        h('p', { class: 'hint' }, 'Paid when posted. The post runner brings it to the medicine shelf in 4–8 days. Sealed boxes from the city wholesaler, though no supply chain is perfect.'));
      const pend = G.meta.orders || [];
      if (pend.length) detail.append(h('h4', {}, 'On the way'), h('ul', {}, pend.map((o) => h('li', {}, `No. ${o.n}: ${o.goods.length} item${o.goods.length > 1 ? 's' : ''}, due day ${day(o.due)}`))));
    } else if (S.ledTab === 'report') {
      const r = healthReport();
      list.append(h('p', { class: 'note' }, `District health office, laboratory bulletin for ${SEASON_NAMES[r.season].toLowerCase()} (day ${r.day}). Share of germs from the valley that resist each medicine, from ${r.n} samples of each. A new bulletin comes each season.`));
      for (const o of ORGANISMS) list.append(h('h4', {}, o.name), h('ul', {}, Object.keys(o.mic).map((d) => { const v = r.data[o.id][d]; return h('li', { class: v >= 0.5 ? 'bad' : v >= 0.2 ? '' : 'good' }, `${ACTIVE.get(d).name}: ${Math.round(v * 100)}% resistant`); })));
      detail.append(h('p', { class: 'hint' }, 'Every course of an antibiotic, needed or not, breeds resistance in the germs people carry. Doses too small or stopped too soon breed it fastest. Left unused for a long time, a medicine slowly regains its power.'));
    } else {
      for (const v of VENDORS) { const n = nextVisit(G.meta.seed, v, G.W.time); list.append(h('div', { class: 'lrow' }, h('span', {}, v.name), h('small', {}, v.fixed ? `daily ${clock(v.open[0])}–${clock(v.open[1])}` : n ? (n === day(G.W.time) ? 'today' : `day ${n}`) : '—'))); }
    }
    panel.append(head('Ledger'), h('div', { class: 'pbody craft' }, h('div', { class: 'scroll' }, tabs, list), detail));
  };
  /** The season's lab bulletin: the valley's real resistance, sampled (n isolates each), fixed once issued. */
  function healthReport() {
    const cl = G.meta.clinic, s = Math.floor((day(G.W.time) - 1) / 10);
    if (cl.report?.s === s) return cl.report;
    const R = resistance(cl), rng = makeRng(G.meta.seed, 'report', s), n = 40, data = {};
    for (const o of ORGANISMS) { data[o.id] = {}; for (const d of Object.keys(o.mic)) { let k = 0; for (let i = 0; i < n; i++) if (rng() < (R[o.id][d] ?? 0)) k++; data[o.id][d] = k / n; } }
    cl.report = { s, day: s * 10 + 1, season: season(G.W.time), n, data };
    return cl.report;
  }
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
    ctx.font = '600 13px Pixelify Sans'; ctx.textAlign = 'center';
    for (const s of [R.village, ...R.hamlets]) { ctx.fillStyle = '#000'; ctx.fillText(s.name, s.x * 3 + 1, s.y * 3 - 13); ctx.fillStyle = s === R.village ? '#ffe08a' : '#f4ead2'; ctx.fillText(s.name, s.x * 3, s.y * 3 - 14); }
    ctx.fillStyle = '#ff5050'; ctx.fillRect(R.clinic.out.x * 3 - 3, R.clinic.out.y * 3 - 3, 7, 7);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(G.p.x * 3, G.p.y * 3, 4, 0, 7); ctx.fill();
    panel.append(head('The valley'), h('div', { class: 'pbody mapwrap' }, cv, h('p', { class: 'hint maplegend' }, 'White: you. Red: the clinic. Coloured dots: medicinal plants you know.')));
  };
  // ———————————————————————————————————— menu
  PANELS.menu = () => {
    const m = minuteOfDay(G.W.time);
    const canSleep = m > 17 * 60 || m < 5 * 60;
    panel.append(head('Menu'), h('div', { class: 'pbody single' },
      h('div', { class: 'acts' },
        h('button', { class: 'primary', disabled: !canSleep, onclick: () => { ui.close(); G.scene.sleep(); } }, canSleep ? 'Sleep until morning' : 'Sleep (after 17:00)'),
        h('button', { onclick: async () => { await G.save(); ui.toast('Saved.'); } }, 'Save'),
        h('button', { onclick: () => G.exportFile() }, 'Export save file'),
        h('button', { onclick: () => { G.save().then(() => location.reload()); } }, 'Back to title')),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: G.settings.sound !== false, onchange: (e) => { G.settings.sound = e.target.checked; setSound(e.target.checked, 0.5); G.saveSettings(); } }), 'Sound'),
      h('div', { class: 'help' }, h('h3', {}, 'How to play'),
        h('p', {}, 'Patients walk in from the hamlets and wait on the benches. Walk up and tap them (or press N / the "Next patient" button). Ask, examine the body, decide what it is, then treat: what you give, how much, how often and for how long all matter — the body does the rest, at home, after they leave.'),
        h('p', {}, 'Gather herbs in the valley (the Book says where and when). Dry them on the rack, then make teas, decoctions, powders and tinctures. Buy salt, sugar, honey and tools from the traders. Build up the clinic. Your name in the valley rises when people recover and falls when they die.'),
        h('p', {}, 'Keys: WASD move · click/tap to walk and use · Space/E use · N next patient · I bag · C make · B build · H handbook · L ledger · M map · Esc menu.'))));
  };
  return ui;
}
