// main.js — boot: content, title screen (clinics, new clinic, import), then the game.
import { buildContent } from './core/content/index.js';
import { World, WORLD_VERSION, furnishClinic } from './core/world.js';
import { newPlayer } from './core/actions.js';
import { newClinic } from './core/clinic.js';
import { addItem } from './core/inventory.js';
import { strHash } from './core/rng.js';
import { START_TIME, day } from './core/time.js';
import { loadIconData, iconURL } from './game/icons.js';
import { ClinicScene } from './game/scene.js';
import { setSound, unlockAudio } from './game/sfx.js';
import { makeUI } from './ui/ui.js';
import { listWorlds, loadWorld, saveWorld, deleteWorld, exportWorld, importWorld } from './store.js';

const $ = (s) => document.querySelector(s);
const SETTINGS_KEY = 'nd.settings';
const loadSettings = () => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } };
const LOOKS = [['player/base/human_f', 'player/hair/long_red'], ['player/base/human_m', 'player/hair/short_black'], ['player/base/human2_f', 'player/hair/pigtails_brown'],
  ['player/base/human2_m', 'player/hair/brown1'], ['player/base/human3_f', 'player/hair/long_yellow'], ['player/base/human3_m', 'player/hair/short_black']];

async function boot() {
  const status = $('#boot');
  const fontsReady = Promise.all([document.fonts.load("15px 'Pixelify Sans'"), document.fonts.load("600 15px 'Pixelify Sans'")]).catch(() => {});
  await Promise.all([loadIconData(), fontsReady]);
  const C = buildContent();
  status.remove();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  title(C);
}

async function title(C) {
  const el = $('#title');
  el.classList.remove('hidden');
  const worlds = await listWorlds();
  const s = loadSettings();
  let look = s.look ?? 0;
  el.innerHTML = `
    <div class="tcard">
      <h1>A Clinic in the Valley</h1>
      <p class="tag">No doctor for two days' walk. Just you, the plants of the valley, the book — and whoever comes through the door.</p>
      ${worlds.length ? `<h3>Your clinics</h3><div class="worlds">${worlds.map((w) => `
        <div class="world"><button class="play" data-id="${w.id}"><b>${esc(w.name)}</b><small>Day ${day(w.time || 0)} · ${w.clinic?.stats?.seen ?? 0} patients seen · ${new Date(w.savedAt || w.created).toLocaleString()}</small></button>
        <button class="del" data-id="${w.id}" title="Delete">✕</button></div>`).join('')}</div>` : ''}
      <h3>A new clinic</h3>
      <div class="newworld">
        <input id="wname" placeholder="Clinic name" value="Valley Clinic ${worlds.length + 1}">
        <input id="wseed" placeholder="Valley seed (blank = random)">
        <div class="looks">${LOOKS.map(([b, hr], i) => `<button class="look${i === look ? ' on' : ''}" data-i="${i}"><img src="${iconURL({ d: b }, 48)}"><img class="hair" src="${iconURL({ d: hr }, 48)}"></button>`).join('')}</div>
        <button id="start" class="primary">Open the clinic</button>
      </div>
      <div class="row"><button id="import">Import save file</button></div>
      <p class="credits">Based on <i>Where There Is No Doctor</i> (David Werner, Hesperian Health Guides), adapted free of charge as Hesperian permits. A game — not medical advice.<br>
      Tiles: Dungeon Crawl Stone Soup (CC0) · Icons: game-icons.net (CC BY 3.0) · Phaser 3 · ZzFX · nipplejs</p>
    </div>`;
  el.querySelectorAll('.look').forEach((b) => b.onclick = () => { look = +b.dataset.i; el.querySelectorAll('.look').forEach((x) => x.classList.toggle('on', x === b)); });
  el.querySelectorAll('.play').forEach((b) => b.onclick = async () => { unlockAudio(); const { meta, records } = await loadWorld(b.dataset.id); start(C, meta, records.get('valley')); });
  el.querySelectorAll('.del').forEach((b) => b.onclick = async () => { if (confirm('Delete this clinic forever?')) { await deleteWorld(b.dataset.id); title(C); } });
  $('#start').onclick = () => {
    unlockAudio();
    const seedText = $('#wseed').value.trim() || Math.random().toString(36).slice(2, 10);
    const st = loadSettings(); st.look = look; localStorage.setItem(SETTINGS_KEY, JSON.stringify(st));
    const meta = { id: 'c' + Date.now().toString(36), name: $('#wname').value.trim() || 'Valley Clinic', seed: strHash(seedText), seedText, time: START_TIME, version: WORLD_VERSION, created: Date.now(),
      look: { base: LOOKS[look][0], hair: LOOKS[look][1] }, clinic: newClinic(), ledger: [], trade: {} };
    start(C, meta, null);
  };
  $('#import').onclick = () => pickFile(async (data) => { const meta = await importWorld(data); const w = await loadWorld(meta.id); start(C, w.meta, w.records.get('valley')); });
}

function start(C, meta, record) {
  $('#title').classList.add('hidden');
  meta.ledger ||= []; meta.trade ||= {}; meta.clinic ||= newClinic();
  const W = new World(C, meta, record);
  let p = meta.player;
  if (!p) {
    furnishClinic(W);
    p = newPlayer(W.R.spawn.x, W.R.spawn.y);
    for (const [id, n] of [['knife', 1], ['cooking_pot', 1], ['mortar', 1], ['watch', 1]]) addItem(p.inv, C, id, n);
    meta.player = p;
    meta.ledger.push({ t: meta.time, kind: 'note', text: `Opened ${meta.name} in ${W.R.village.name}. Forty shillings, a knife, a pot, a mortar, a watch — and the book.` });
  }
  const settings = { sound: true, ...loadSettings() };
  setSound(settings.sound !== false, 0.5);
  const G = {
    C, W, p, meta, settings, input: { joy: { x: 0, y: 0 }, sprint: false }, stations: new Set(),
    saveSettings: () => { const s = loadSettings(); localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, sound: settings.sound, zoom: settings.zoom })); },
    seats: () => { let n = 0; const c = W.R.clinic; for (let y = c.out.y - 2; y <= c.out.y + 6; y++) for (let x = c.out.x - 7; x <= c.out.x + 7; x++) if (W.objDef(x, y)?.seat) n++; return n; },
  };
  G.save = async () => { meta.player = p; G.saveSettings(); W.lastSim = Math.min(W.lastSim, meta.time); return saveWorld(meta, [W.toRecord()]); };
  G.download = (name, text) => {
    if (window.AndroidBridge?.saveFile) { window.AndroidBridge.saveFile(name, text, 'application/json'); G.ui.toast('Saved to Downloads: ' + name); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  G.exportFile = async () => { await G.save(); const data = await exportWorld(meta.id); G.download(`${meta.name.replace(/\W+/g, '_')}_day${day(meta.time)}.clinic.json`, JSON.stringify(data)); };
  G.ui = makeUI(G);
  addEventListener('pagehide', () => G.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
  window.nd = G; // console handle
  new window.Phaser.Game({
    type: window.Phaser.AUTO, parent: 'game', pixelArt: true, backgroundColor: '#0b0d12',
    scale: { mode: window.Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { activePointers: 3, mouse: { preventDefaultWheel: true } }, disableContextMenu: true,
    render: { antialias: false, roundPixels: true, powerPreference: 'high-performance' },
    scene: [], callbacks: { postBoot: (game) => game.scene.add('clinic', ClinicScene, true, G) },
  });
}

function pickFile(cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { await cb(JSON.parse(await f.text())); } catch (e) { alert('Could not import: ' + e.message); } };
  inp.click();
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

boot().catch((e) => { console.error(e); const b = $('#boot'); if (b) b.textContent = 'Failed to start: ' + e.message; });
