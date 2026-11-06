// Reuse the mature library implementations directly; their source attribution
// remains in fire/_lib.js, arcane/_lib.js and water/_lib.js. This adapter binds the public
// particle state to those pixel materials and restores Painter state afterward.
import { firePuff, smokePuff, ember as drawEmber, spark as drawSpark } from '../fx/fire/_lib.js';
import { mote as drawMote, streak as drawStreak } from '../fx/arcane/_lib.js';
import { bead, ring, WATER } from '../fx/water/_lib.js';
import { fit } from '../core/color.js';
import { color, alpha, positive, finite, point, fail } from './contract.js';

const palette = (colors, n) => {
  if (!Array.isArray(colors) || !colors.length) fail('material.colors', 'expected a nonempty ramp; fire/ember/spark use hot-first order');
  return fit(colors.map((c) => color(c, 'material.colors')), n);
};
function paint(p, state, glow, fn) {
  point(state.position, 'material.state.position'); alpha(state.age01, 'material.state.age01'); alpha(state.opacity, 'material.state.opacity'); positive(glow, 'material.glow', true);
  const fade = p.fade, lightK = p.lightK;
  try { p.fade *= state.opacity; p.lightK *= glow; fn(1 - state.age01); }
  finally { p.fade = fade; p.lightK = lightK; }
}
export function fire(p, state, { colors, size = 3, heatOffset = 0, glow = 1, direction = [0, -1] } = {}) {
  positive(size, 'material.size'); finite(heatOffset, 'material.heatOffset'); point(direction, 'material.direction');
  const H = palette(colors, 9);
  paint(p, state, glow, (k) => firePuff(p, ...state.position, k, size, heatOffset, H, 0.18, ...direction));
}
export function smoke(p, state, { size = 3, tint = null, big = false } = {}) {
  positive(size, 'material.size');
  paint(p, state, 0, (k) => smokePuff(p, ...state.position, k, size, tint === null ? 0 : color(tint, 'material.tint'), big));
}
export function ember(p, state, { colors, size = 1, phase = 0, glow = 1 } = {}) {
  positive(size, 'material.size'); finite(phase, 'material.phase'); const C = palette(colors, 4);
  paint(p, state, glow, (k) => drawEmber(p, ...state.position, k, size, C, phase));
}
export function spark(p, state, { colors, glow = 1 } = {}) {
  point(state.velocity, 'material.state.velocity'); const C = palette(colors, 4);
  paint(p, state, glow, (k) => drawSpark(p, ...state.position, ...state.velocity, k, C));
}
export function mote(p, state, { tint = state.tint, size = 1, glow = 0.4 } = {}) {
  point(state.velocity, 'material.state.velocity'); positive(size, 'material.size'); positive(glow, 'material.glow', true); const c = color(tint, 'material.tint');
  paint(p, state, 1, (k) => drawMote(p, ...state.position, ...state.velocity, c, size, k, glow));
}
export function streak(p, state, { tint = state.tint, maxLength = 7, glow = 0.4 } = {}) {
  point(state.velocity, 'material.state.velocity'); positive(maxLength, 'material.maxLength'); positive(glow, 'material.glow', true); const c = color(tint, 'material.tint');
  paint(p, state, 1, () => drawStreak(p, ...state.position, ...state.velocity, c, 1, maxLength, glow));
}

// Directly reuse water/_lib.bead/ring and Ripples' lifetime growth/decay.
// The original water helper retains its Sprite Fusion/Hugo Duprez MIT credit.
export function waterDrop(p, state, { colors = WATER, size = 2, glow = 0 } = {}) {
  point(state.velocity, 'material.state.velocity'); positive(size, 'material.size'); const C = palette(colors, 8);
  paint(p, state, glow, () => { bead(p, ...state.position, ...state.velocity, size, C); p.glow(...state.position, 2.5 + size, C[5], .1 + .05 * size); });
}
export function ripple(p, state, { colors = WATER, radius = 18, startRadius = 1, sy = .22, n = 2, gap = 3, strength = 1, hot = .1, glint = 0, seed = 1, glow = 0 } = {}) {
  positive(radius, 'material.ripple.radius', true); positive(startRadius, 'material.ripple.startRadius', true); positive(sy, 'material.ripple.sy');
  if (!Number.isInteger(n) || n < 1 || n > 16) fail('material.ripple.n', 'expected integer 1..16');
  for (const [name, value] of Object.entries({ gap, strength, hot, glint })) positive(value, `material.ripple.${name}`, true); finite(seed, 'material.ripple.seed');
  const C = palette(colors, 8), u = state.age01, r = startRadius + (radius - startRadius) * (1 - Math.pow(1 - u, 2.6)), k = strength * Math.pow(1 - u, 1.7);
  paint(p, state, glow, () => ring(p, ...state.position, r, sy, k, C, { n, gap: gap * (.55 + .6 * u), hot: (state.age ?? u * (state.life ?? 1)) < hot, glint: glint * k, seed }));
}
