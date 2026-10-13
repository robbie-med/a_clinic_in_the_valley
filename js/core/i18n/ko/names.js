// names.js — generated people and hamlet names (patient.js, region.js: Swahili-like syllables) written in
// Hangul, the way Korean writes East African names: Tundo → 툰도, Ngobale → 응고발레, Mwatama → 므와타마.
const L = { g: 0, n: 2, d: 3, r: 5, l: 5, m: 6, b: 7, s: 9, '': 11, j: 12, z: 12, ch: 14, k: 15, t: 16, p: 17, f: 17, h: 18, c: 9 };
const V = { a: 0, e: 5, i: 20, o: 8, u: 13 };
const GLIDE = { y: { a: 2, e: 7, o: 12, u: 17, i: 20 }, w: { a: 9, e: 15, i: 16, o: 14, u: 13 } };
const T = { '': 0, n: 4, m: 16, ng: 21, l: 8 };
const syl = (l, v, t = 0) => String.fromCharCode(0xac00 + (l * 21 + v) * 28 + t);
const isV = (c) => c in V;

export function koName(name) {
  return String(name).split(/(\s+|-)/).map(word).join('');
}
function word(w) {
  const s = w.toLowerCase();
  if (!/^[a-z]+$/.test(s)) return w;
  const out = []; // [l, v, t]
  let i = 0;
  const lead = (txt) => out.push([11, 18, T[txt] ?? 0]); // a lone nasal at the start: 은/음/응
  while (i < s.length) {
    let on = '', glide = '';
    const rest = s.slice(i);
    // a nasal before a consonant closes the syllable before it (or stands alone at the start)
    const nas = /^ng/.test(rest) ? ['ng', 'ng'] : /^(n|m)(?=[bcdfghjklmnpqrstvwxyz])/.exec(rest);
    if (nas && !/^(ny|mw)/.test(rest) && !(nas[1] === 'n' && rest[1] === 'y')) {
      const coda = nas[1] === 'ng' ? 'ng' : nas[1];
      const keep = nas[1] === 'ng' ? 1 : nas[1].length; // "ng": the g starts the next syllable
      if (out.length && out[out.length - 1][2] === 0) out[out.length - 1][2] = T[coda === 'ng' ? 'ng' : coda];
      else lead(coda === 'ng' ? 'ng' : coda);
      i += keep;
      continue;
    }
    if (rest.startsWith('sh')) { on = 's'; glide = 'y'; i += 2; }
    else if (rest.startsWith('ch')) { on = 'ch'; i += 2; }
    else if (rest.startsWith('ny')) { on = 'n'; glide = 'y'; i += 2; }
    else if (rest.startsWith('mw')) { out.push([6, 18, 0]); on = ''; glide = 'w'; i += 2; } // 므와
    else if (/^[bcdfghjklmnprstz]/.test(rest)) { on = rest[0]; i += 1; if (s[i] === 'y' || s[i] === 'w') glide = s[i++]; }
    else if (rest[0] === 'y' || rest[0] === 'w') { glide = rest[0]; i += 1; }
    const v = s[i];
    if (!isV(v)) { // a consonant with no vowel after it: write it with ㅡ (or as a final n/m)
      if ((on === 'n' || on === 'm') && out.length && out[out.length - 1][2] === 0) { out[out.length - 1][2] = T[on]; continue; }
      if (on) out.push([L[on] ?? 11, 18, 0]);
      continue;
    }
    i += 1;
    // intervocalic l doubles in Korean spelling (Lani → 라니, Ela → 엘라)
    if (on === 'l' && out.length && out[out.length - 1][2] === 0) out[out.length - 1][2] = 8;
    const vow = glide ? (GLIDE[glide][v] ?? V[v]) : V[v];
    const lidx = on === 's' && glide === 'y' && v === 'i' ? 9 : L[on] ?? 11;
    out.push([lidx, vow, 0]);
  }
  return out.map(([l, v, t]) => syl(l, v, t)).join('');
}
