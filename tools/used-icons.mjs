// Prints every game-icons name the game uses (content + interface), one per line.
//   node tools/used-icons.mjs | python3 tools/build_icons.py <game-icons repo>
import { buildContent } from '../js/core/content/index.js';
import { CONDITIONS } from '../js/core/content/conditions.js';
import { UI_ICONS } from '../js/ui/icon-names.js';
const C = buildContent();
const names = new Set(UI_ICONS);
for (const it of C.items.values()) if (it.icon?.gi) names.add(it.icon.gi);
for (const o of C.objects.values()) if (o.sprite?.gi) names.add(o.sprite.gi);
for (const c of CONDITIONS) names.add(c.icon);
console.log([...names].sort().join('\n'));
