// scene.js — the valley in Phaser: one tilemap (ground + objects), you and the villagers as layered
// Dungeon Crawl paperdolls, the clock, walking (keys, joystick, tap-to-walk with a path), and the
// rhythm of the day: patients walking in from the hamlets, traders setting up, night falling.
import { REAL_SEC_PER_MIN, DAY, HOUR, daylight, minuteOfDay, day, season, SEASON_NAMES, clock } from '../core/time.js';
import { useTile } from '../core/actions.js';
import { dueArrivals, tickHome, hamletOf, OPEN, CLOSE } from '../core/clinic.js';
import { presence, VENDORS } from '../core/economy.js';
import { STATION_RANGE } from '../core/content/build.js';
import { hash, makeRng } from '../core/rng.js';
import { IconAtlas, tileFrame } from './icons.js';
import { sfx } from './sfx.js';
import { t, getLang, personName } from '../core/i18n.js';

const Phaser = window.Phaser;
const T = 32;
const ICON_GID = 4096;
const SPEED = 4.2;          // tiles per real second
const WALKER_SPEED = 2.6;
const REACH = 1.8;
const FONT = "'Pixelify Sans', 'Galmuri', sans-serif"; // Galmuri11: the Korean pixel font
const lc = (s) => (getLang() === 'en' ? String(s).toLowerCase() : s);

const LOOKS_F = [['player/base/human_f', 'player/hair/long_red'], ['player/base/human2_f', 'player/hair/short_black'], ['player/base/human3_f', 'player/hair/long_yellow'], ['player/base/human2_f', 'player/hair/pigtails_brown']];
const LOOKS_M = [['player/base/human_m', 'player/hair/short_black'], ['player/base/human2_m', 'player/hair/brown1'], ['player/base/human3_m', 'player/hair/short_black'], ['player/base/human2_m', 'player/hair/mountain_man']];
const BODIES = ['player/body/leather_short', 'player/body/robe_white', 'player/body/robe_blue', 'player/body/robe_green', 'player/body/robe_red', 'player/body/shirt_white1', 'player/body/animal_skin'];

export class ClinicScene extends Phaser.Scene {
  constructor() { super('clinic'); }
  init(G) { this.G = G; G.scene = this; }
  preload() { this.load.spritesheet('tiles', 'assets/tiles.png', { frameWidth: T, frameHeight: T, margin: 1, spacing: 2 }); }

  create() {
    const { G } = this;
    const { W, p } = G;
    this.icons = new IconAtlas(this);
    const N = W.N;
    this.map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: N, height: N });
    const ts = this.map.addTilesetImage('tiles', 'tiles', T, T, 1, 2, 0);
    const ti = this.map.addTilesetImage('icons', 'icons', T, T, 0, 0, ICON_GID);
    this.gl = this.map.createBlankLayer('g', [ts, ti], 0, 0).setDepth(0);
    this.ol = this.map.createBlankLayer('o', [ts, ti], 0, 0).setDepth(5);
    this.gFrames = new Map([...G.C.grounds].map(([k, g]) => [k, g.sprites.map(tileFrame)]));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) this.drawTile(x, y);
    this.icons.flush();
    W.onChange = (x, y) => { this.drawTile(x, y); this.icons.flush(); };

    this.cam = this.cameras.main;
    this.cam.setBounds(0, 0, N * T, N * T);
    this.cam.setBackgroundColor('#0b0d12');
    this.zoom = G.settings.zoom || (Math.min(window.innerWidth, window.innerHeight) < 600 ? 1.6 : 2);
    this.cam.setZoom(this.zoom);
    this.player = this.makeDoll(G.meta.look.base, G.meta.look.hair, 'player/body/robe_white', 1);
    this.player.setDepth(20);
    this.cam.startFollow(this.player, true, 0.2, 0.2);
    this.marker = this.add.rectangle(0, 0, T, T).setStrokeStyle(2, 0xffe08a, 0.9).setOrigin(0).setDepth(15).setVisible(false);
    this.ghost = this.add.rectangle(0, 0, T, T, 0x80ff80, 0.25).setStrokeStyle(2, 0x80ff80, 0.8).setOrigin(0).setDepth(16).setVisible(false);
    this.dark = this.add.rectangle(0, 0, 10, 10, 0x0a0c20, 0).setOrigin(0).setDepth(900).setScrollFactor(0);

    this.walkers = new Map();   // id → { kind: 'patient'|'vendor', id, x, y, path, doll, label }
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,E', false);
    this.input.keyboard.on('keydown', (e) => this.onKey(e));
    this.input.on('pointerdown', (ptr) => this.onPointer(ptr));
    this.input.on('pointermove', (ptr) => { this.hover = this.ptrTile(ptr); });
    this.input.on('wheel', (ptr, o, dx, dy) => this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1)));
    this.acc = { arrive: 0, home: 0, catch: 0, save: 0, hud: 0, vend: 0 };
    this.moveTarget = null;
    // patients who were walking or waiting when the game was closed come back to the bench
    for (const pt of Object.values(G.meta.clinic.patients)) {
      if (pt.status === 'arriving' || pt.status === 'waiting' || pt.status === 'consult') { pt.status = 'arriving'; this.spawnPatient(pt, true); }
      if (pt.status === 'leaving') pt.status = 'home';
    }
    this.updateVendors(true);
    G.ui.ready(this);
  }

  // ———————————————————————————————————————— tiles
  drawTile(x, y) {
    const { C, W } = this.G;
    const gk = W.ground(x, y);
    const g = C.grounds.get(gk);
    const fr = this.gFrames.get(gk);
    const t = this.gl.putTileAt(fr[hash(7, x, y) % fr.length], x, y);
    t.tint = g.tint ? hex(g.tint) : 0xffffff;
    const ok = W.obj(x, y);
    if (!ok) { this.ol.removeTileAt(x, y); return; }
    const od = C.objects.get(ok);
    const st = W.state(x, y);
    let spr = od.sprite, tint = od.sprite.t;
    if ((od.kind === 'plant' && !W.plantReady(x, y)) || (od.gives && st?.regrowAt && W.time < st.regrowAt)) tint = '#8a8a7a';
    if (od.dries && st?.inv?.slots.some(Boolean)) spr = { gi: 'herbs-bundle', c: '#90b060' };
    if (od.brews && st?.brew) spr = { gi: 'mason-jar', c: W.time >= st.brew.readyAt ? '#80e080' : '#c09060' };
    const idx = spr.gi ? ICON_GID + this.icons.slot(spr) : tileFrame(spr.d);
    const ot = this.ol.putTileAt(idx, x, y);
    ot.tint = !spr.gi && tint ? hex(tint) : spr.gi && tint && od.kind === 'plant' ? hex(tint) : 0xffffff;
  }

  // ———————————————————————————————————————— people
  makeDoll(base, hair, body, scale = 1, bodyTint) {
    const c = this.add.container(0, 0);
    for (const [name, tint] of [[base], [body, bodyTint], [hair]]) {
      const f = name ? tileFrame(name) : -1;
      if (f < 0) continue;
      const im = this.add.image(0, 0, 'tiles', f);
      if (tint) im.setTint(tint);
      c.add(im);
    }
    c.setScale(scale);
    return c;
  }
  spawnPatient(pt, atBench = false) {
    const { G } = this;
    const R = G.W.R;
    if (this.walkers.has(pt.id)) return;
    const rng = makeRng(pt.seed, 'look');
    const [b, h] = (pt.sex === 'f' ? LOOKS_F : LOOKS_M)[Math.floor(rng() * 4)];
    const doll = this.makeDoll(b, h, BODIES[Math.floor(rng() * BODIES.length)], pt.age < 2 ? 0.55 : pt.age < 13 ? 0.72 : 1, 0xffffff - Math.floor(rng() * 0x404040));
    doll.setDepth(18);
    const home = hamletOf(G, pt.hamlet);
    const house = home.houses?.[Math.floor(rng() * (home.houses.length || 1))];
    const start = atBench ? this.waitSpot() : house ? { x: house.out.x, y: house.out.y } : { x: home.x, y: home.y };
    const w = { kind: 'patient', id: pt.id, x: start.x + 0.5, y: start.y + 0.5, doll, path: null, home: start };
    const bubble = this.add.image(0, 0, 'icons', String(this.icons.slot({ gi: 'hospital-cross', c: '#ff6060' }))).setScale(0.45).setDepth(19).setVisible(false);
    this.icons.flush();
    w.bubble = bubble;
    this.walkers.set(pt.id, w);
    this.walkTo(w, this.waitSpot(pt.id));
  }
  /** Bench seats near the clinic door, in queue order. */
  waitSpot(id) {
    const { W } = this.G;
    const seats = [];
    const c = W.R.clinic;
    for (let y = c.out.y - 2; y <= c.out.y + 6; y++) for (let x = c.out.x - 7; x <= c.out.x + 7; x++) if (W.objDef(x, y)?.seat) seats.push({ x, y });
    const queue = Object.values(this.G.meta.clinic.patients).filter((p) => p.status === 'waiting' || p.status === 'arriving').map((p) => p.id);
    const k = id ? Math.max(0, queue.indexOf(id)) : 0;
    if (k < seats.length) return seats[k];
    return { x: c.out.x - 3 + (k % 7), y: c.out.y + 3 + Math.floor(k / 7) };
  }
  walkTo(w, goal) {
    w.path = findPath(this.G.W, Math.floor(w.x), Math.floor(w.y), goal.x, goal.y, 30000) || [[goal.x, goal.y]];
    w.goal = goal;
  }
  updateVendors(first = false) {
    const { G } = this;
    const R = G.W.R;
    for (const v of VENDORS) {
      const key = presence(G.meta.seed, v, G.W.time);
      const id = 'v:' + v.id;
      const has = this.walkers.get(id);
      if (key && !has) {
        const spot = v.id === 'duka' ? R.duka.inside : v.id === 'market' ? R.stalls[0] : v.id === 'herbalist' ? R.stalls[1] : v.id === 'stores' ? R.stalls[3] : R.stalls[2];
        const doll = this.makeDoll(v.look.base, v.look.hair, v.id === 'duka' ? 'player/body/shirt_white1' : 'player/body/robe_green', 1).setDepth(18);
        const w = { kind: 'vendor', id, vendor: v, key, x: spot.x + 0.5, y: spot.y + 0.5, doll, path: null };
        this.walkers.set(id, w);
        if (!first && v.id !== 'duka') { this.G.ui.toast(t('{vendor}: {who} has come to the market square.', { vendor: v.name, who: lc(v.who) })); sfx('coin'); }
      } else if (!key && has) { has.doll.destroy(); this.walkers.delete(id); }
      else if (has) has.key = key;
    }
  }

  // ———————————————————————————————————————— input
  ptrTile(ptr) { const w = this.cam.getWorldPoint(ptr.x, ptr.y); return { x: Math.floor(w.x / T), y: Math.floor(w.y / T), wx: w.x / T, wy: w.y / T }; }
  walkerAt(wx, wy, r = 0.8) {
    let best = null, bd = r;
    for (const w of this.walkers.values()) { const d = Math.hypot(w.x - wx, w.y - 0.2 - wy); if (d < bd) { bd = d; best = w; } }
    return best;
  }
  onPointer(ptr) {
    const { G } = this;
    if (G.ui.modal()) return;
    const t = this.ptrTile(ptr);
    const w = this.walkerAt(t.wx, t.wy);
    if (G.placing) { this.act(t.x, t.y); return; }
    if (w) { this.moveTarget = { x: w.x, y: w.y, walker: w }; return; }
    const p = G.p;
    if (Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.y) <= REACH && G.W.obj(t.x, t.y)) { this.act(t.x, t.y); return; }
    const path = findPath(G.W, Math.floor(p.x), Math.floor(p.y), t.x, t.y, 6000, true);
    this.moveTarget = { path, tile: t, act: !!G.W.obj(t.x, t.y) };
  }
  onKey(e) {
    const ui = this.G.ui;
    if (ui.typing()) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (this.G.placing) { this.G.placing = null; this.ghost.setVisible(false); return; } ui.back(); return; }
    const panels = { i: 'bag', c: 'make', b: 'build', h: 'handbook', l: 'ledger', m: 'map', t: 'wait' };
    if (panels[k]) { ui.toggle(panels[k]); return; }
    if (ui.modal()) return;
    if (k >= '1' && k <= '8') { this.G.p.hot = +k - 1; ui.refresh(); return; }
    if (k === ' ' || k === 'e') this.useNearest();
    if (k === 'n') this.nextPatient();
    if (k === '+' || k === '=') this.setZoom(this.zoom * 1.15);
    if (k === '-') this.setZoom(this.zoom / 1.15);
  }
  setZoom(z) { this.zoom = Math.max(0.5, Math.min(4, z)); this.cam.setZoom(this.zoom); this.G.settings.zoom = this.zoom; }

  /** Space / the hand button: talk to whoever is near, else use what is in front. */
  useNearest() {
    const { G } = this;
    const p = G.p;
    const w = this.walkerAt(p.x, p.y + 0.2, 2);
    if (w) { this.talk(w); return; }
    for (const [dx, dy] of [[Math.round(Math.cos(p.face)), Math.round(Math.sin(p.face))], [0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
      if (G.W.obj(x, y) && !G.W.objDef(x, y)?.wall) { this.act(x, y); return; }
    }
  }
  talk(w) {
    const { G } = this;
    if (w.kind === 'vendor') { G.ui.trade(w.vendor, w.key); return; }
    const pt = G.meta.clinic.patients[w.id];
    if (!pt) return;
    if (pt.status === 'waiting' || pt.status === 'arriving') { G.ui.encounter(pt.id); return; }
    G.ui.toast(t('{name} is on the way home.', { name: personName(pt.name) }));
  }
  nextPatient() {
    const q = Object.values(this.G.meta.clinic.patients).filter((p) => p.status === 'waiting').sort((a, b) => a.arrivedAt - b.arrivedAt);
    if (q.length) this.G.ui.encounter(q[0].id); else this.G.ui.toast(t('Nobody is waiting.'));
  }
  act(x, y) {
    const { G } = this;
    const ev = useTile(G, x, y);
    this.handle(ev);
  }
  handle(ev) {
    const { G } = this;
    for (const e of ev) {
      if (e[0] === 'msg') G.ui.toast(e[1]);
      else if (e[0] === 'sound') sfx(e[1]);
      else if (e[0] === 'gain') { const [, id, n] = e; this.floatText(G.p.x, G.p.y - 0.6, () => t('+{n} {item}', { n, item: G.C.items.get(id).name }), '#e8f0c0'); }
      else if (e[0] === 'open') G.ui.openContainer(e[1], e[2]);
      else if (e[0] === 'brew') G.ui.openJar(e[1], e[2]);
      else if (e[0] === 'placed') { if (!G.p.inv.slots[G.p.hot] || G.p.inv.slots[G.p.hot].id !== e[3]) { G.placing = null; this.ghost.setVisible(false); } }
      else if (e[0] === 'level') { const n = e[2]; G.ui.banner(e[1] === 'herbal' ? t('Herbal craft level {n}', { n }) : e[1] === 'diagnosis' ? t('Diagnosis level {n}', { n }) : t('Building level {n}', { n }), t('Skill')); sfx('level'); }
    }
    G.ui.refresh();
  }
  /** A rising label. `text` is a string or a function giving it in the current language (so relabel() can redo it). */
  floatText(x, y, text, color) {
    const make = typeof text === 'function' ? text : () => text;
    const lb = this.add.text(x * T, y * T, make(), { fontFamily: FONT, fontSize: '12px', color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(950);
    lb.relabel = make;
    (this.labels ||= new Set()).add(lb);
    this.tweens.add({ targets: lb, y: lb.y - 24, alpha: 0, duration: 1400, onComplete: () => { this.labels.delete(lb); lb.destroy(); } });
  }
  /** After a language switch: redraw every canvas label in the current language. */
  relabel() {
    for (const lb of this.labels || []) if (lb.active) lb.setText(lb.relabel());
  }

  // ———————————————————————————————————————— frame
  update(time, deltaMs) {
    const { G } = this;
    const dt = Math.min(0.1, deltaMs / 1000);
    const modal = G.ui.modal();
    if (!modal && !G.sleeping) {
      G.meta.time += dt / REAL_SEC_PER_MIN;
      this.movePlayer(dt);
    }
    this.stepWalkers(dt, modal);
    this.acc.arrive += dt; this.acc.home += dt; this.acc.catch += dt; this.acc.save += dt; this.acc.hud += dt; this.acc.vend += dt;
    if (this.acc.arrive > 1) { this.acc.arrive = 0; for (const id of dueArrivals(G)) this.spawnPatient(G.meta.clinic.patients[id]); this.giveUp(); }
    if (this.acc.home > 8) { this.acc.home = 0; for (const n of tickHome(G)) G.ui.news(n); }
    if (this.acc.catch > 4) { this.acc.catch = 0; for (const e of G.W.catchUp()) G.ui.toast(e.text); }
    if (this.acc.vend > 2) { this.acc.vend = 0; this.updateVendors(); this.sampleStations(); }
    if (this.acc.save > 30) { this.acc.save = 0; G.save(); }
    this.player.setPosition(G.p.x * T, G.p.y * T - 4);
    this.drawGhost();
    const dl = daylight(G.W.time);
    this.dark.setSize(this.scale.width, this.scale.height).setFillStyle(0x0a0c20, (1 - dl) * 0.6);
    const day0 = day(G.W.time);
    if (this.lastDay !== undefined && day0 !== this.lastDay) this.newDay(day0);
    this.lastDay = day0;
    if (this.acc.hud > 0.25) { this.acc.hud = 0; G.ui.tick(); }
  }
  newDay(d) {
    const { G } = this;
    const s = season(G.W.time);
    if (s !== this.lastSeason && this.lastSeason) G.ui.banner(SEASON_NAMES[s], t('Day {n}', { n: d }));
    this.lastSeason = s;
    G.journalDay?.(d);
  }
  sampleStations() {
    const { G } = this;
    const { W, p } = G;
    const st = new Set();
    const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
    for (let dy = -STATION_RANGE; dy <= STATION_RANGE; dy++) for (let dx = -STATION_RANGE; dx <= STATION_RANGE; dx++) { const od = W.objDef(x0 + dx, y0 + dy); if (od?.station) st.add(od.station); }
    G.stations = st;
  }
  movePlayer(dt) {
    const { G } = this;
    const { W, p } = G;
    const k = this.keys, joy = G.input.joy;
    let mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0) + joy.x;
    let my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0) + joy.y;
    if (G.ui.typing()) { mx = 0; my = 0; }
    if (mx || my) this.moveTarget = null;
    else if (this.moveTarget) {
      const mt = this.moveTarget;
      if (mt.walker) {
        const d = Math.hypot(mt.walker.x - p.x, mt.walker.y - p.y);
        if (d < REACH) { this.moveTarget = null; this.talk(mt.walker); return; }
        mx = mt.walker.x - p.x; my = mt.walker.y - p.y;
      } else if (mt.path?.length) {
        const [nx, ny] = mt.path[0];
        const last = mt.path.length === 1;
        if (last && mt.act && Math.hypot(nx + 0.5 - p.x, ny + 0.5 - p.y) <= REACH) { this.moveTarget = null; this.act(nx, ny); return; }
        if (Math.hypot(nx + 0.5 - p.x, ny + 0.5 - p.y) < 0.2) { mt.path.shift(); if (!mt.path.length) this.moveTarget = null; return; }
        mx = nx + 0.5 - p.x; my = ny + 0.5 - p.y;
      } else this.moveTarget = null;
    }
    const len = Math.hypot(mx, my);
    if (len < 0.05) return;
    mx /= Math.max(1, len); my /= Math.max(1, len);
    p.face = Math.atan2(my, mx);
    if (mx) this.player.setScale(mx < 0 ? -1 : 1, 1);
    const g = W.groundDef(Math.floor(p.x), Math.floor(p.y));
    const sp = SPEED * (g?.walk || 1) * (G.input.sprint || k.SHIFT.isDown ? 1.5 : 1);
    const ox = p.x, oy = p.y;
    this.tryMove(p, mx * sp * dt, 0);
    this.tryMove(p, 0, my * sp * dt);
    p.stats.walked += Math.hypot(p.x - ox, p.y - oy);
    if (this.moveTarget && Math.hypot(p.x - ox, p.y - oy) < sp * dt * 0.1) { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 1) { this.moveTarget = null; this.stuck = 0; } } else this.stuck = 0;
  }
  tryMove(o, dx, dy) {
    const { W } = this.G;
    const r = 0.28, nx = o.x + dx, ny = o.y + dy;
    for (const [x, y] of [[nx - r, ny - r], [nx + r, ny - r], [nx - r, ny + r], [nx + r, ny + r]]) if (!W.passable(Math.floor(x), Math.floor(y))) return false;
    o.x = nx; o.y = ny;
    return true;
  }
  stepWalkers(dt, paused) {
    const { G } = this;
    const cl = G.meta.clinic;
    for (const [id, w] of this.walkers) {
      if (!paused && w.path?.length) {
        const [nx, ny] = w.path[0];
        const dx = nx + 0.5 - w.x, dy = ny + 0.5 - w.y, d = Math.hypot(dx, dy);
        const step = WALKER_SPEED * dt * (G.W.groundDef(Math.floor(w.x), Math.floor(w.y))?.walk || 1);
        if (d <= step) { w.x = nx + 0.5; w.y = ny + 0.5; w.path.shift(); } else { w.x += (dx / d) * step; w.y += (dy / d) * step; w.doll.setScale(Math.abs(w.doll.scaleX) * (dx < 0 ? -1 : 1), w.doll.scaleY); }
        if (!w.path.length) this.arrived(w);
      }
      w.doll.setPosition(w.x * T, w.y * T - 4);
      if (w.bubble) {
        const pt = cl.patients[w.id];
        w.bubble.setVisible(pt?.status === 'waiting').setPosition(w.x * T, w.y * T - 26 + Math.sin(this.time.now / 300) * 2);
      }
    }
  }
  arrived(w) {
    const { G } = this;
    if (w.kind !== 'patient') return;
    const pt = G.meta.clinic.patients[w.id];
    if (!pt) return;
    if (pt.status === 'arriving') {
      pt.status = 'waiting'; pt.arrivedAt = G.W.time;
      G.ui.toast(pt.age < 13 ? t('A mother with {name} is waiting at the clinic.', { name: personName(pt.name) }) : t('{name} is waiting at the clinic.', { name: personName(pt.name) }));
      sfx('ui');
    } else if (pt.status === 'leaving' || pt.status === 'hospital' || pt.status === 'gone') {
      if (pt.status === 'leaving') pt.status = 'home';
      w.doll.destroy(); w.bubble?.destroy(); this.walkers.delete(w.id);
    }
  }
  /** Send a patient home along the path they came by. */
  sendHome(pid) {
    const w = this.walkers.get(pid);
    if (w) this.walkTo(w, w.home);
  }
  /** Patients who wait too long give up and go home. */
  giveUp() {
    const { G } = this;
    const cl = G.meta.clinic;
    for (const pt of Object.values(cl.patients)) {
      if (pt.status !== 'waiting') continue;
      const closed = minuteOfDay(G.W.time) > CLOSE + 60;
      if (G.W.time - pt.arrivedAt > 4 * HOUR || closed) {
        pt.status = 'leaving';
        cl.rep = Math.max(0, cl.rep - 0.015);
        G.ui.toast(t('{name} got tired of waiting and went home.', { name: personName(pt.name) }));
        this.sendHome(pt.id);
      }
    }
  }
  drawGhost() {
    const { G } = this;
    const held = G.p.inv.slots[G.p.hot];
    const def = held && G.C.items.get(held.id);
    if (def?.place && this.hover && !G.ui.modal()) {
      const ok = !G.W.obj(this.hover.x, this.hover.y) && G.W.passable(this.hover.x, this.hover.y) && Math.hypot(this.hover.x + 0.5 - G.p.x, this.hover.y + 0.5 - G.p.y) <= 6;
      this.ghost.setPosition(this.hover.x * T, this.hover.y * T).setVisible(true).setFillStyle(ok ? 0x80ff80 : 0xff6060, 0.25).setStrokeStyle(2, ok ? 0x80ff80 : 0xff6060, 0.8);
      G.placing = def.id;
    } else { this.ghost.setVisible(false); G.placing = null; }
  }

  /** Sleep until morning: the night passes, everyone at home lives through it. */
  sleep() {
    const t = this.G.W.time, m = minuteOfDay(t);
    this.passTime(t - m + (m > 6 * 60 ? DAY : 0) + 6.5 * 60 - t);
  }
  /** Let `mins` game minutes pass at once, in 2-hour steps: everyone at home lives through them. */
  passTime(mins) {
    const { G } = this;
    const target = G.meta.time + mins;
    G.sleeping = true;
    while (G.meta.time < target) { G.meta.time = Math.min(target, G.meta.time + 2 * HOUR); for (const n of tickHome(G)) G.ui.news(n); }
    for (const e of G.W.catchUp()) G.ui.toast(e.text);
    G.sleeping = false;
    G.ui.banner(t('Day {n} · {time}', { n: day(G.W.time), time: clock(G.W.time) }), SEASON_NAMES[season(G.W.time)]);
    G.save();
  }
}

/** Grid BFS (4-neighbour) on passable tiles; returns [[x,y]…] excluding the start, or null. */
export function findPath(W, sx, sy, gx, gy, limit = 4000, toAdjacent = false) {
  const N = W.N;
  if (!W.inb(gx, gy)) return null;
  const goalOk = W.passable(gx, gy);
  const prev = new Map();
  const key = (x, y) => y * N + x;
  const q = [[sx, sy]];
  prev.set(key(sx, sy), -1);
  let found = null;
  for (let qi = 0; qi < q.length && qi < limit; qi++) {
    const [x, y] = q[qi];
    if ((x === gx && y === gy) || (!goalOk && toAdjacent && Math.abs(x - gx) + Math.abs(y - gy) === 1)) { found = [x, y]; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !W.inb(nx, ny)) continue;
      if (!W.passable(nx, ny) && !(nx === gx && ny === gy && goalOk)) continue;
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  if (!found) return null;
  const path = [];
  let k = key(found[0], found[1]);
  while (k !== key(sx, sy) && k !== -1) { path.push([k % N, Math.floor(k / N)]); k = prev.get(k); }
  path.reverse();
  if (toAdjacent && !goalOk) path.push([gx, gy]);
  return path;
}

const hex = (s) => parseInt(String(s).replace('#', ''), 16);
