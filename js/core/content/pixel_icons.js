// pixel_icons.js — which items get a pixel-art icon (CC0 tiles in the atlas, see CREDITS.md) instead of
// their game-icons.net glyph. Anything not matched keeps the glyph. Lookup order: item id, then
// `method:<method>`, then the glyph name. A value is the atlas tile; `raw` means "don't tint" (the tile
// already has its own colours). Otherwise the tile is tinted with a pale version of the item's colour.
const R = (tile) => ({ tile, raw: true });
export const PIXEL_ICONS = {
  // herbs and plant parts (by the glyph the part uses)
  'three-leaves': { tile: 'icon/rpg/leaf' },
  'curled-leaf': { tile: 'icon/herb/kekik' },
  flowers: { tile: 'icon/herb/kokuda' },
  'ground-sprout': { tile: 'icon/herb/mandragora' },
  'curling-vines': { tile: 'icon/herb/arandula' },
  seedling: { tile: 'icon/herb/arandula' },
  'plant-seed': { tile: 'icon/rpg/nut' },
  // preparations: tea, decoction, tincture, cold soak
  'method:infusion': { tile: 'icon/rpg/flask' },
  'method:cold_soak': { tile: 'icon/rpg/flask' },
  'method:decoction': { tile: 'icon/rpg/jar' },
  'method:acid_decoction': { tile: 'icon/rpg/jar' },
  'method:tincture': { tile: 'icon/rpg/bottle' },
  // bought medicine and drinks
  vial: R('icon/rpg/tube'),
  medicines: R('icon/potion/potion_2_brown'),
  'water-flask': R('icon/potion/potion_2_clear'),
};

const lighten = (hex, f = 0.35) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.round(((n >> s) & 255) * (1 - f) + 255 * f).toString(16).padStart(2, '0');
  return '#' + c(16) + c(8) + c(0);
};

/** The pixel icon `{d, t}` for an item, or null to keep its glyph icon. */
export function pixelIcon(it) {
  const e = PIXEL_ICONS[it.id] || (it.method && PIXEL_ICONS['method:' + it.method]) || (it.icon?.gi && PIXEL_ICONS[it.icon.gi]);
  if (!e) return null;
  return e.raw || !it.icon?.c ? { d: e.tile } : { d: e.tile, t: lighten(it.icon.c) };
}
