// Reference composition: path/ribbon and mask/arrival share ordinary editable
// code. Shape, bend, rank, material and timing remain independent art choices.
import { fit } from '../../../src/core/index.js';
import { path, curve, random, domain, schedule, motion, mask, field, image, light } from '../../../src/authoring/index.js';

export const meta = {
  name: 'Ember weave', desc: 'Two inward streams weave a copper shell; a continuous pulse peels away as an ordered burn edge sheds cooling fragments.',
  tags: ['path', 'ribbon', 'dissolve', 'arrival', 'mask', 'copper', '内收', '消融', '边缘'],
  size: [128, 112], origin: [40, 92], duration: 2.1, loop: false,
  options: { seed: 7, bend: 1, burnAxis: 1, glow: 0.16, palette: ['#170f19', '#47252c', '#99452f', '#e77c3d', '#ffd387', '#fff3d4'] },
};
export const events = { gather: 0.15, release: 0.72, crack: 0.9, shellGone: 1.45, end: 2.1 };
export const authoring = { ending: 'clear' };
const head = curve.scalar({ points: [[0, 0], [0.36, 1]], outputUnit: 'path.s', interpolation: 'smooth' });
const tail = curve.scalar({ points: [[0.09, 0], [0.65, 1]], outputUnit: 'path.s', interpolation: 'smooth' });
let cacheKey, cache;
function design(o) {
  const key = `${o.seed}/${o.bend}/${o.burnAxis}`;
  if (key === cacheKey) return cache;
  const shell = mask.make({ id: 'shell', w: 44, h: 44, origin: [-22, -51], test(x, y) {
    const r = Math.hypot(x * 0.91, y + 29), angle = Math.atan2(y + 29, x);
    return r < 18 + 2 * Math.sin(angle * 3 + 0.5) && r > 10 + Math.cos(angle * 2) && !(x > 11 && y < -35);
  } });
  const noise = field.noise({ id: 'burn-grain', seed: o.seed, scalePx: 6 });
  const rank = field.rank({ id: 'burn-order', mask: shell, score: (x, y) => o.burnAxis * x + 9 * noise.sample(x, y) + y * 0.12 });
  const arrival = field.arrival({ id: 'burn-time', rank, start: 0.9, end: events.shellGone });
  cache = {
    shell, arrival, births: image.dissolveEvents({ id: 'cooling-copper', mask: shell, arrival, density: 0.055, seed: o.seed }),
    gather: schedule.burst({ id: 'gather', at: 0, count: 30, spread: 0.36 }),
    places: domain.sample({ domain: shell, measure: 'boundary', count: 30, seed: o.seed }),
    routes: [path.bezier({ id: 'left', points: [[-31, -51], [-25, -4], [13, -53], [0, -29]] }), path.bezier({ id: 'right', points: [[37, -12], [35, -52], [-14, -12], [0, -29]] })],
    pulse: path.bezier({ id: 'pulse', points: [[0, -29], [24, -48 - 7 * o.bend], [49, -6 + 10 * o.bend], [70, -17]] }),
  };
  cacheKey = key; return cache;
}
export function draw(p, t, o) {
  if (t >= meta.duration) return;
  const d = design(o), C = fit(o.palette, 6);
  for (const b of schedule.alive(d.gather, t, { life: 0.5 })) {
    const progress = Math.min(1, b.age / 0.5), route = d.routes[b.index % 2];
    const q = motion.along(route, { age: b.age, duration: 0.5, easing: (u) => u * u });
    const offset = d.places[b.index].position, k = 0.14 * (1 - progress);
    const x = q.position[0] + offset[0] * k, y = q.position[1] + (offset[1] + 29) * k;
    p.rect(x - 1, y - 1, 2 + b.index % 2, 2, C[2 + b.index % 2]);
  }
  if (t >= 0.28 && t < events.shellGone) {
    const dissolved = image.dissolve({ mask: d.shell, field: d.arrival, threshold: t, edgeBand: 0.04, time: t });
    image.draw(p, dissolved.keepMask, { color: (x, y) => C[x + (y + 29) * 0.6 > 1 ? 3 : 1], alpha: Math.min(1, (t - 0.28) / 0.3) });
    image.draw(p, dissolved.edgeMask, { color: C[4] });
    light.fromMask(p, dissolved.edgeMask, { color: C[4], radius: 2, intensity: o.glow * 0.13 });
  }
  const elapsed = t - events.release, from = tail.sample(elapsed), to = head.sample(elapsed);
  if (elapsed > 0 && to > from) {
    path.strip(p, d.pulse, { from, to, width: (s) => 2 + 8 * Math.sin(Math.PI * s), color: (s, across) => C[Math.abs(across) < 0.38 ? 4 : 2] });
    path.strip(p, d.pulse, { from, to, width: 1, color: C[5], alpha: 0.6 });
  }
  for (const b of schedule.alive(d.births, t, { life: 0.6 })) {
    const key = { seed: o.seed, layer: 'cooling-copper', id: b.id, channel: 'velocity' };
    const q = motion.ballistic({ position: b.position, velocity: [random.range(key, -14, 22), random.range({ ...key, channel: 'lift' }, -20, -6)], acceleration: [0, 64], drag: 0.8, age: b.age });
    p.rect(q.position[0], q.position[1], b.index % 5 === 0 ? 2 : 1, 1, C[b.age01 < 0.25 ? 4 : b.age01 < 0.65 ? 2 : 1], 1 - b.age01);
  }
}
