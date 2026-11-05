// Reuse the mature library implementations directly; their source attribution
// remains in fire/_lib.js and arcane/_lib.js. This adapter only binds the public
// particle state to those pixel materials and restores Painter state afterward.
import { firePuff, smokePuff, ember as drawEmber, spark as drawSpark } from '../fx/fire/_lib.js';
import { mote as drawMote, streak as drawStreak } from '../fx/arcane/_lib.js';
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
