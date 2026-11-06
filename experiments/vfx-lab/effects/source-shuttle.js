// Source-at-birth sampling follows fire/_lib.burn; geometry and motion reuse
// authoring Path/ScalarCurve. No library effect is copied as a whole preset.
import { hex } from '../../../src/core/index.js';
import { curve, motion, path, particle, schedule, texture } from '../../../src/authoring/index.js';

export const meta = {
  name: 'Source shuttle', desc: 'A mechanical shuttle pauses, reverses, and turns two moving nibs. Flecks retain each nib’s velocity and cool through a three-frame sequence.',
  tags: ['source', 'velocity', 'trajectory', 'pause', 'reverse', '源轨迹', '速度继承', '移动源'],
  size: [176, 144], origin: [88, 118], duration: 3.2, loop: false,
  options: { seed: 7, radius: 15, light: .03, tint: '#dfb77e' },
};
export const events = { depart: .2, pause: .9, reverse: 1.25, turn: 1.8, stop: 2.4, clear: 3.2 };
export const authoring = { ending: 'clear' };
const progress = curve.scalar({ points: [[0, 0], [.9, .75], [1.25, .75], [1.8, .15], [2.4, .95]], interpolation: 'smooth' });
const angle = curve.scalar({ points: [[0, -.7], [.9, .65], [1.25, .65], [1.8, -.5], [2.4, 1.3]], outputUnit: 'radians', interpolation: 'smooth' });
const route = path.bezier({ id: 'shuttle-route', points: [[-48, -27], [-35, -88], [32, -18], [45, -65]], tolerancePx: .1 });
const carrier = motion.pathSource(route, { progress, rotation: angle });
const opacity = curve.scalar({ input: 'particle.age01', points: [[0, 1], [.65, 1], [1, 0]] });
const sequence = texture.sequence({ id: 'shuttle-flake', mode: 'lifetime', frames: [
  texture.ascii({ id: 'flake-solid', rows: ['.#.', '###', '.#.'], palette: { '#': '#fff' } }),
  texture.ascii({ id: 'flake-split', rows: ['#..', '.#.', '..#'], palette: { '#': '#fff' } }),
  texture.ascii({ id: 'flake-grain', rows: ['...', '.#.', '...'], palette: { '#': '#fff' } }),
] });
let key, cached;
function design(o) {
  const next = JSON.stringify([o.seed, o.radius, o.tint]); if (key === next) return cached;
  const nibs = [-1, 1].map((sign) => motion.source({ parent: carrier, position: [sign * o.radius, 0] }));
  const emitters = nibs.map((source, i) => particle.emitter({ id: `nib-${i}`, seed: o.seed,
    births: schedule.rate({ id: `nib-${i}-born`, start: .2, end: 2.4, rate: 14 }),
    transform: source, inheritVelocity: .8, direction: { mode: 'angle', angle: i ? 0 : Math.PI, spread: .4 },
    initial: { life: [.35, .6], speed: [5, 10], spin: [-2, 2] }, motion: { drag: 1.2, acceleration: [0, 15] },
    material: { texture: sequence, tint: o.tint, opacity },
  }));
  key = next; return cached = { nibs, emitters };
}
export function draw(p, t, o) {
  if (t >= meta.duration) return;
  const { nibs, emitters } = design(o), pivot = carrier.sample(t), tips = nibs.map((s) => s.sample(t));
  const alpha = Math.min(1, t / .2, (meta.duration - t) / .4), C = ['#282833', '#68616c', o.tint, '#fff1c2'].map(hex);
  path.strip(p, route, { width: 1, color: C[0], alpha: alpha * .6 });
  p.line(...tips[0].position, ...tips[1].position, C[1], alpha);
  for (const tip of tips) {
    const [x, y] = tip.position;
    p.poly([[x, y - 4], [x + 3, y], [x, y + 4], [x - 3, y]], C[1], alpha);
    p.line(x, y - 3, x, y + 2, C[2], alpha); p.dot(x, y, C[3], alpha);
    p.glow(x, y, 8, C[2], o.light * alpha);
  }
  p.ring(...pivot.position, 4, 2, C[2], alpha);
  for (const emitter of emitters) particle.draw(p, emitter, t);
}
export function observe(t, o) { const d = design(o); return { particles: d.emitters.map((e) => particle.observe(e, t)), sources: [motion.observeSource(carrier, t, { id: 'carrier' }), ...d.nibs.map((s, i) => motion.observeSource(s, t, { id: `nib-${i}` }))] }; }
