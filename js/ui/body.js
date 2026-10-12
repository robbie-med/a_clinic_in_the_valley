// body.js — the patient as a tappable figure (SVG, drawn in code: no art needed). Proportions change
// for a baby, a child, an adult and a pregnant woman. Tapping a region offers the examinations that
// belong there (WTND ch.3 examines by body part); findings you have made are pinned to the body.

/** Regions: id → { label, exams, at:[x,y] for pins }. Coordinates in the 200×420 viewBox. */
export const REGIONS = {
  head: { label: 'Head', exams: ['x_general', 'x_forehead', 'x_fontanel', 'x_ears', 'x_neck'] },
  face: { label: 'Eyes & mouth', exams: ['x_eyes', 'x_throat', 'x_general'] },
  chest: { label: 'Chest', exams: ['x_chest', 'x_listen', 'x_rr'] },
  belly: { label: 'Belly', exams: ['x_belly', 'x_pinch'] },
  arm: { label: 'Upper arm', exams: ['x_thermo', 'x_muac', 'x_bp'] },
  wrist: { label: 'Wrist', exams: ['x_pulse'] },
  hands: { label: 'Hands & skin', exams: ['x_skin', 'x_joints'] },
  legs: { label: 'Legs & feet', exams: ['x_feet', 'x_joints'] },
  back: { label: 'Back', exams: ['x_back'] },
  wound: { label: 'Wound / burn', exams: ['x_wound'] },
};
/** Where each finding is pinned on the figure. */
const PIN = {
  temp: 'head', feels_hot: 'head', fontanel: 'head', alert: 'head', flushed: 'face', pupils: 'face',
  sunken_eyes: 'face', dry_mouth: 'face', tears: 'face', pallor: 'face', rr: 'chest', indrawing: 'chest', grunting: 'chest', crackles: 'chest',
  spleen: 'belly', pot_belly: 'belly', tender: 'belly', skin_pinch: 'belly', muac: 'arm', bp: 'arm', hr: 'wrist', pulse_regular: 'wrist',
  burrows: 'hands', skin_sores: 'hands', edema: 'legs', back_exam: 'back', pus: 'wound', redness: 'wound', red_streaks: 'wound', wound_size: 'wound', burn_area: 'wound', blisters: 'wound',
};

/**
 * SVG markup for the figure. p: patient; found: { finding: {v,pos} }; wound: 'arm'|'leg'|null.
 * Every region is a <path>/<g> with data-region; pins are drawn for abnormal findings.
 */
export function bodySVG(p, found, woundSite) {
  const infant = p.age < 1.5, child = p.age < 13;
  const pregnant = p.pregnant > 16;
  // proportions: head bigger and limbs shorter in the young
  const headR = infant ? 34 : child ? 28 : 22;
  const top = 18, cx = 100;
  const neckY = top + headR * 2;
  const torsoH = infant ? 110 : child ? 120 : 135;
  const shoulder = infant ? 44 : child ? 48 : 56;
  const hip = infant ? 34 : child ? 36 : p.sex === 'f' ? 44 : 38;
  const legL = infant ? 110 : child ? 150 : 175;
  const armL = infant ? 95 : child ? 120 : 140;
  const tY = neckY + 8, bY = tY + torsoH;
  const skin = ['#8a5a3a', '#6a4028', '#a06a48', '#7a4a30'][Math.abs(p.seed) % 4];
  const cloth = p.sex === 'f' ? '#5a7a9a' : '#7a6a4a';
  const r = (id, cls = '') => `data-region="${id}" class="reg ${cls}"`;
  const belly = pregnant ? `<path ${r('belly')} d="M${cx - hip + 4},${tY + torsoH * 0.55} C${cx - hip - 8},${bY + 12} ${cx + hip + 30},${bY + 10} ${cx + hip + 6},${tY + torsoH * 0.5} Z" fill="${cloth}" />` : '';
  const pins = [];
  const at = {
    head: [cx + headR * 0.7, top + headR * 0.6], face: [cx - headR * 0.6, top + headR * 1.1], chest: [cx - shoulder * 0.5, tY + torsoH * 0.25],
    belly: [cx + hip * 0.5, tY + torsoH * 0.7], arm: [cx - shoulder - 8, tY + armL * 0.3], wrist: [cx + shoulder + 12, tY + armL * 0.75],
    hands: [cx - shoulder - 10, tY + armL + 4], legs: [cx + hip * 0.5, bY + legL - 20], back: [cx + shoulder * 0.6, tY + torsoH * 0.45],
    wound: woundSite === 'arm' ? [cx + shoulder + 6, tY + armL * 0.62] : [cx - hip * 0.5 - 4, bY + legL * 0.6],
  };
  const byRegion = {};
  for (const [k, f] of Object.entries(found)) {
    const reg = PIN[k];
    if (!reg || !f.pos) continue;
    (byRegion[reg] ||= []).push(k);
  }
  for (const [reg, ks] of Object.entries(byRegion)) {
    const [x, y] = at[reg];
    pins.push(`<g class="pin" data-region="${reg}"><circle cx="${x}" cy="${y}" r="9" /><text x="${x}" y="${y + 4}">${ks.length}</text></g>`);
  }
  const wound = woundSite ? `<g ${r('wound')}><ellipse cx="${at.wound[0]}" cy="${at.wound[1]}" rx="11" ry="8" fill="#b03030" stroke="#3a0a0a" stroke-width="2"/></g>` : '';
  const rash = found.burrows?.pos || found.itch_night?.pos ? `<g class="rash" pointer-events="none">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${cx - shoulder - 6 + (i % 3) * 5}" cy="${tY + armL + 2 + Math.floor(i / 3) * 6}" r="1.8" fill="#d04040"/>`).join('')}</g>` : '';
  const swell = found.edema?.pos ? `<g pointer-events="none"><ellipse cx="${cx - hip / 2}" cy="${bY + legL - 8}" rx="15" ry="10" fill="${skin}" opacity="0.9"/><ellipse cx="${cx + hip / 2}" cy="${bY + legL - 8}" rx="15" ry="10" fill="${skin}" opacity="0.9"/></g>` : '';
  const lw = infant ? 20 : child ? 22 : 26;                  // limb thickness
  const elbowY = tY + armL * 0.5, wristY = tY + armL - 6;
  const limb = (id, x1, y1, x2, y2, col, w = lw) => `<line data-region="${id}" class="reg limb" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const sh = shoulder - 2;
  return `<svg class="body" viewBox="0 0 200 ${bY + legL + 24}" xmlns="http://www.w3.org/2000/svg">
    <g class="figure">
      ${limb('legs', cx - hip / 2 - 2, bY - 4, cx - hip / 2 - 6, bY + legL, skin, lw + 4)}
      ${limb('legs', cx + hip / 2 + 2, bY - 4, cx + hip / 2 + 6, bY + legL, skin, lw + 4)}
      <path data-region="legs" class="reg" d="M${cx - hip - 4},${bY - 10} Q${cx},${bY + 26} ${cx + hip + 4},${bY - 10} L${cx + hip + 2},${bY + 22} L${cx - hip - 2},${bY + 22} Z" fill="${shade(cloth)}"/>
      <path ${r('chest')} d="M${cx - shoulder + 6},${tY + 2} Q${cx},${tY - 8} ${cx + shoulder - 6},${tY + 2} Q${cx + shoulder + 2},${tY + 8} ${cx + shoulder - 4},${tY + torsoH * 0.48} L${cx - shoulder + 4},${tY + torsoH * 0.48} Q${cx - shoulder - 2},${tY + 8} ${cx - shoulder + 6},${tY + 2} Z" fill="${cloth}" />
      <path ${r('belly')} d="M${cx - shoulder + 4},${tY + torsoH * 0.48} L${cx + shoulder - 4},${tY + torsoH * 0.48} Q${cx + hip + 8},${tY + torsoH * 0.8} ${cx + hip + 2},${bY} L${cx - hip - 2},${bY} Q${cx - hip - 8},${tY + torsoH * 0.8} ${cx - shoulder + 4},${tY + torsoH * 0.48} Z" fill="${shade(cloth)}" />
      ${belly}
      ${limb('arm', cx - sh, tY + 10, cx - sh - 16, elbowY, cloth)}
      ${limb('arm', cx + sh, tY + 10, cx + sh + 16, elbowY, cloth)}
      ${limb('wrist', cx - sh - 16, elbowY, cx - sh - 22, wristY, skin, lw - 4)}
      ${limb('wrist', cx + sh + 16, elbowY, cx + sh + 22, wristY, skin, lw - 4)}
      <g ${r('hands')}><circle cx="${cx - sh - 22}" cy="${wristY + 12}" r="${lw * 0.55}" fill="${skin}"/><circle cx="${cx + sh + 22}" cy="${wristY + 12}" r="${lw * 0.55}" fill="${skin}"/></g>
      <rect x="${cx - lw * 0.4}" y="${neckY - 6}" width="${lw * 0.8}" height="16" rx="4" fill="${skin}" pointer-events="none"/>
      <circle ${r('head')} cx="${cx}" cy="${top + headR}" r="${headR}" fill="${skin}" />
      <path d="M${cx - headR},${top + headR * 0.8} Q${cx},${top - headR * 0.25} ${cx + headR},${top + headR * 0.8} Q${cx},${top + headR * 0.2} ${cx - headR},${top + headR * 0.8} Z" fill="#1a1210" pointer-events="none"/>
      <g ${r('face')}><ellipse cx="${cx - headR * 0.35}" cy="${top + headR * 1.0}" rx="${headR * 0.15}" ry="${headR * (found.sunken_eyes?.pos ? 0.07 : 0.11)}" fill="#1a1010"/><ellipse cx="${cx + headR * 0.35}" cy="${top + headR * 1.0}" rx="${headR * 0.15}" ry="${headR * (found.sunken_eyes?.pos ? 0.07 : 0.11)}" fill="#1a1010"/><path d="M${cx - headR * 0.3},${top + headR * 1.45} Q${cx},${top + headR * 1.6} ${cx + headR * 0.3},${top + headR * 1.45}" stroke="#3a1a10" stroke-width="2" fill="none"/></g>
      ${swell}${rash}${wound}
    </g>
    <g ${r('back', 'backtab')}><rect x="150" y="4" width="46" height="22" rx="6"/><text x="173" y="19">Back</text></g>
    ${pins.join('')}
  </svg>`;
}
function shade(hex) { const n = parseInt(hex.slice(1), 16); const c = (s) => Math.round(((n >> s) & 255) * 0.85).toString(16).padStart(2, '0'); return '#' + c(16) + c(8) + c(0); }

export const pinRegion = (finding) => PIN[finding];
