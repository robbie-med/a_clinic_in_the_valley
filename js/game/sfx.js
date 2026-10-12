// sfx.js — every sound is synthesised by ZzFX (vendored), so there are no audio files to ship.
// Presets were shaped in the ZzFX designer (https://killedbyapixel.github.io/ZzFX/).
import { ZZFX } from '../../vendor/zzfx.js';

const P = {
  chop:   [1.2, , 160, .01, .02, .08, 4, 1.6, , , , , , .8, , .3, , .6, .03],
  mine:   [1.1, , 600, .01, .01, .09, 4, 2.2, , , , , , 1.2, , .5, , .5, .02],
  dig:    [.9, , 90, .02, .05, .1, 4, 1.2, , , , , , 1.5, , .2, , .5, .05],
  pick:   [.6, , 900, .01, .03, .06, , 1.6, , , 300, .03],
  fall:   [1.4, , 80, .03, .25, .45, 4, 2.5, -2, , , , , 1.2, , .4, .1, .5, .2],
  hit:    [1.1, , 300, .01, .02, .08, 3, 1.8, -6, , , , , .9, , .2, , .7, .02],
  hurt:   [1.4, , 220, .02, .05, .18, 2, 2.4, -4, , , , , 1.4, , .3, .1, .6, .06],
  kill:   [1, , 140, .03, .1, .3, 1, 1.6, -3, , , , , .6, , .2, .1, .5, .1],
  bow:    [.7, , 1200, , .02, .05, 3, 1.4, -24, , , , , , , , , .5],
  place:  [.8, , 200, .02, .03, .06, 4, 1.3, , , , , , 1.1, , .2],
  craft:  [.8, , 520, .02, .06, .12, 1, 1.6, , , 260, .05, , , , , , .7, .04],
  eat:    [.7, , 300, .02, .04, .06, 4, 1.2, , , , , .06, 2, , .4, , .5],
  drink:  [.8, , 400, .02, .05, .15, , 1.2, 4, 8, , , , , , , .1, .6, .08],
  splash: [1, , 600, .02, .1, .25, 4, 2, , , , , , 1.6, , .4, .1, .4, .1],
  door:   [.8, , 120, .02, .04, .12, 4, 1.3, 2, , , , , .8, , .1],
  level:  [1, , 523, .03, .2, .4, 1, 1.4, , , 261, .08, .1, , , , , .7, .05],
  ui:     [.4, , 1600, , .01, .02, , 1.7, , , , , , , , , , .5],
  step:   [.15, , 120, , .01, .02, 4, 1.2, , , , , , 2.5, , .3, , .4],
  coin:   [.7, , 1400, .01, .03, .12, 1, 1.6, , , 700, .05],
};
let enabled = true, volume = 0.5;
const cache = {};
export function setSound(on, vol) { enabled = on; if (vol !== undefined) volume = vol; ZZFX.volume = volume * 0.6; }
export function sfx(name) {
  if (!enabled) return;
  const p = P[name];
  if (!p) return;
  try {
    // cache three randomised renders per sound; synthesising on every hit is wasteful on phones
    const c = cache[name] ||= [0, 1, 2].map(() => ZZFX.buildSamples(...p));
    ZZFX.playSamples([c[Math.floor(Math.random() * 3)]]);
  } catch { /* audio not ready yet */ }
}
/** Browsers start audio suspended until a gesture. */
export function unlockAudio() {
  try { if (ZZFX.audioContext?.state === 'suspended') ZZFX.audioContext.resume(); } catch { /* ignore */ }
}
