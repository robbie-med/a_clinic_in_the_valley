// icons.js — draws item/structure icons. Two sources:
//   {gi, c}: a game-icons.net silhouette (Path2D from assets/icons.json), filled with colour c and outlined;
//   {d, t}:  a Dungeon Crawl tile from assets/tiles.png, optionally tinted with t.
// iconURL() gives cached data URLs for the DOM; IconAtlas packs them into a Phaser canvas texture
// so placed structures and dropped items render in the same batch as the world.
let PATHS = {}, TILE_IMG = null, TILE_INDEX = new Map(), TILE_COLS = 64, CELL = 34, PAD = 1;

export async function loadIconData() {
  const [icons, tiles] = await Promise.all([getJSON('assets/icons.json'), getJSON('assets/tiles.json')]);
  PATHS = Object.fromEntries(Object.entries(icons).map(([k, d]) => [k, new Path2D(d)]));
  TILE_COLS = tiles.cols; PAD = tiles.pad || 0; CELL = 32 + 2 * PAD;
  tiles.names.forEach((n, i) => TILE_INDEX.set(n, i));
  TILE_IMG = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'assets/tiles.png'; });
  return { tiles };
}
/** XHR rather than fetch(): Android WebView cannot fetch() file:// URLs, but XHR works (like Phaser's loader). */
function getJSON(url) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('GET', url); x.responseType = 'json';
    x.onload = () => (x.status === 200 || x.status === 0) && x.response ? res(x.response) : rej(new Error('load ' + url + ' ' + x.status));
    x.onerror = () => rej(new Error('load ' + url));
    x.send();
  });
}
export const tileFrame = (name) => TILE_INDEX.get(name) ?? -1;

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

/** Draw an icon into ctx at (x, y, size). */
export function drawIcon(ctx, icon, x, y, size) {
  ctx.save();
  if (icon.gi) {
    const p = PATHS[icon.gi];
    ctx.translate(x, y);
    ctx.scale(size / 512, size / 512);
    if (p) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 34; ctx.strokeStyle = 'rgba(10,8,6,0.9)'; ctx.stroke(p);
      const c = icon.c || '#cccccc';
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, shade(c, 1.25)); g.addColorStop(1, shade(c, 0.8));
      ctx.fillStyle = g; ctx.fill(p);
    } else { ctx.fillStyle = '#f0f'; ctx.fillRect(0, 0, 512, 512); }
  } else if (icon.d && TILE_IMG) {
    const f = TILE_INDEX.get(icon.d) ?? 0;
    ctx.imageSmoothingEnabled = false;
    if (icon.t) {
      const tmp = scratch(size);
      const t = tmp.getContext('2d');
      t.clearRect(0, 0, size, size); t.imageSmoothingEnabled = false;
      t.drawImage(TILE_IMG, (f % TILE_COLS) * CELL + PAD, Math.floor(f / TILE_COLS) * CELL + PAD, 32, 32, 0, 0, size, size);
      t.globalCompositeOperation = 'multiply'; t.fillStyle = icon.t; t.fillRect(0, 0, size, size);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(TILE_IMG, (f % TILE_COLS) * CELL + PAD, Math.floor(f / TILE_COLS) * CELL + PAD, 32, 32, 0, 0, size, size);
      t.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, x, y);
    } else ctx.drawImage(TILE_IMG, (f % TILE_COLS) * CELL + PAD, Math.floor(f / TILE_COLS) * CELL + PAD, 32, 32, x, y, size, size);
  }
  ctx.restore();
}
const scratches = new Map();
function scratch(size) {
  if (!scratches.has(size)) { const c = document.createElement('canvas'); c.width = c.height = size; scratches.set(size, c); }
  return scratches.get(size);
}

const urlCache = new Map();
export function iconURL(icon, size = 48) {
  if (!icon) return '';
  const k = (icon.gi ? 'g' + icon.gi + icon.c : 'd' + icon.d + (icon.t || '')) + '@' + size;
  let u = urlCache.get(k);
  if (u) return u;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawIcon(c.getContext('2d'), icon, 0, 0, size);
  u = c.toDataURL();
  urlCache.set(k, u);
  return u;
}

/** A growable Phaser canvas texture of 32×32 icon cells, addressed as tilemap indices too. */
export class IconAtlas {
  constructor(scene, key = 'icons', cells = 64) {
    this.scene = scene; this.key = key; this.cols = cells; this.size = 32;
    this.tex = scene.textures.createCanvas(key, cells * 32, cells * 32);
    this.ctx = this.tex.getContext();
    this.map = new Map(); this.next = 0; this.dirty = false;
  }
  /** Slot index for an icon (allocated + drawn on first use). */
  slot(icon) {
    const k = icon.gi ? 'g' + icon.gi + icon.c : 'd' + icon.d + (icon.t || '');
    let s = this.map.get(k);
    if (s !== undefined) return s;
    s = this.next++;
    if (s >= this.cols * this.cols) { console.warn('icon atlas full'); return 0; }
    const x = (s % this.cols) * 32, y = Math.floor(s / this.cols) * 32;
    drawIcon(this.ctx, icon, x + 3, y + 3, 26);
    this.tex.add(String(s), 0, x, y, 32, 32);
    this.map.set(k, s); this.dirty = true;
    return s;
  }
  flush() { if (this.dirty) { this.tex.refresh(); this.dirty = false; } }
}
