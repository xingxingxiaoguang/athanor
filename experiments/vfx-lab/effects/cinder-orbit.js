// Reference: sources at birth + overlapping/changing particle materials are
// extracted from fire/_lib.burn; velocity-facing sparks reuse that library.
import { fit } from '../../../src/core/index.js';
import { particle, texture, material, schedule, domain, motion, curve } from '../../../src/authoring/index.js';

export const meta = {
  name: 'Cinder orbit', desc: 'Two travelling nozzles shed asymmetric metal flecks into a broken seal. Its release throws hot fragments that cool into a soft smoke wake.',
  tags: ['particle', 'emitter', 'force', 'texture', 'lifetime', 'metal', 'smoke', '内收', '粒子', '贴图', '烟'],
  size: [160, 144], origin: [80, 116], duration: 2.8, loop: false,
  options: { seed: 7, curl: 1, spread: 1, glow: 0.03, palette: ['#281f2f', '#624148', '#bc623b', '#edaa67', '#fff1c4'] },
};
export const events = { gather: 0.25, seal: 0.8, release: 1.15, smoke: 1.65, clear: 2.8 };
export const authoring = { ending: 'clear' };
const fade = curve.scalar({ input: 'particle.age01', points: [[0, 0], [.1, 1], [.65, 1], [1, 0]] });
let cacheKey, cache;
function design(o) {
  const key = JSON.stringify([o.seed, o.curl, o.spread, o.palette]); if (key === cacheKey) return cache;
  const frames = [
    texture.ascii({ id: 'metal-solid', rows: ['.H.', 'HBo', '.o.'], palette: { H: '#fff', B: '#bbb', o: '#666' } }),
    texture.ascii({ id: 'metal-fray', rows: ['H..', '.B.', '..o'], palette: { H: '#fff', B: '#aaa', o: '#555' } }),
    texture.ascii({ id: 'metal-dust', rows: ['...', '.B.', '...'], palette: { B: '#999' } }),
  ];
  const chips = texture.sequence({ id: 'cooling-chip', frames, mode: 'lifetime' });
  const C = fit(o.palette, 5), cooling = curve.color({ points: [[0, C[4]], [.25, C[3]], [.55, C[2]], [.85, C[0]], [1, C[0]]] });
  const incoming = [-1, 1].map((side) => particle.emitter({ id: `nozzle-${side}`, seed: o.seed,
    births: schedule.rate({ id: `nozzle-${side}-born`, start: .02, end: .84, rate: side === -1 ? 22 : 15 }),
    domain: domain.sector({ id: `spray-${side}`, radius: 5, angle: side < 0 ? 0 : Math.PI, spread: 1.4 }),
    transform: (born) => ({ position: [side * (41 - born * 14), -53 + side * 15 * Math.sin(born * 2)], rotation: 0, velocity: [-side * 14, side * 30 * Math.cos(born * 2)] }),
    inheritVelocity: .35, direction: { mode: 'angle', angle: side < 0 ? .15 : Math.PI + .2, spread: .5 },
    initial: { life: [.65, .95], speed: [9, 20], scale: [.8, 1.5], rotation: [-2, 2], spin: [-6, 6], data: (c) => ({ warmth: c.rand('warmth') }) },
    motion: { drag: .5, forces: [motion.radial({ center: [0, -48], strength: -8, tangential: 65 * o.curl }), motion.attract({ target: [0, -48], startAge: .1, stiffness: 48, damping: 10 })],
      kill: (s) => s.age > .5 && Math.hypot(s.position[0], s.position[1] + 48) < 2 },
    material: { texture: chips, opacity: fade, tint: cooling },
  }));
  const released = particle.emitter({ id: 'release', seed: o.seed, births: schedule.burst({ id: 'release-born', at: events.release, count: 42, spread: .12 }),
    domain: domain.circle({ id: 'release-core', x: 0, y: -48, radius: 6 }), direction: { mode: 'angle', angle: -Math.PI / 2, spread: 3.8 * o.spread },
    initial: { life: [.65, 1.2], speed: [22, 58], scale: [.7, 1.5], data: (c) => ({ size: c.rand('size', 1.2, 2.8) }) },
    motion: { acceleration: [3, 65], drag: [.8, .3] }, material: { opacity: fade, tint: cooling },
  });
  cacheKey = key; return cache = { incoming, released, C };
}
export function draw(p, t, o) {
  if (t >= meta.duration) return;
  const d = design(o), C = d.C;
  for (const system of d.incoming) particle.draw(p, system, t);
  if (t > .25 && t < 1.4) {
    const k = Math.min(1, (t - .25) * 4) * Math.min(1, (1.4 - t) * 5);
    // A designed solid silhouette; particles supplement rather than replace it.
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7 - 1.8, r = 12 * k;
      p.arc(0, -48, r, 3, a, a + .54, C[i % 3 === 0 ? 3 : 1], k);
      p.line(Math.cos(a) * r, -48 + Math.sin(a) * r, Math.cos(a) * (r + 4), -48 + Math.sin(a) * (r + 4), C[2], k);
    }
    p.circle(0, -48, 3 * k, C[4], k);
    p.glow(0, -48, 23, C[3], o.glow * k);
  }
  particle.draw(p, d.released, t, { draw(p, s) {
    const colors = [C[4], C[3], C[2], C[0]];
    if (s.age01 < .42) material.spark(p, s, { colors, glow: o.glow });
    else material.smoke(p, { ...s, age01: (s.age01 - .42) / .58 }, { size: s.data.size, tint: C[1] });
  } });
}
export function observe(t, o) {
  const d = design(o); return { particles: [...d.incoming, d.released].map((system) => particle.observe(system, t)) };
}
