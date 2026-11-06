// Composable landing reference: floor crossing from fire/_lib.sparkAt,
// one-shot response from sim.BRAND/Drops.onLand, and actual water bead/ring
// implementations through material. Original helpers retain MIT attribution.
import { hex, fit } from '../../../src/core/index.js';
import { particle, contact, schedule, curve, material } from '../../../src/authoring/index.js';

export const meta = {
  name: 'Landing relay', desc: 'A split basin receives cool droplets and bouncing metal flecks; each true contact starts an independently editable ring or dust response.',
  tags: ['contact', 'collision', 'secondary', 'water', '落地', '接触', '涟漪', '二次发射'],
  size: [176, 144], origin: [88, 108], duration: 3.2, loop: false,
  options: { seed: 19, glow: .03, palette: ['#162331', '#305264', '#608794', '#95bac4', '#e9f7ea'] },
};
export const events = { release: .3, settle: 2.5, clear: 3.2 };
export const authoring = { ending: 'clear' };
const fade = curve.scalar({ input: 'particle.age01', points: [[0, 1], [.6, 1], [1, 0]] });
let cached, key;
function design(o) {
  const next = String(o.seed); if (next === key) return cached;
  const drops = particle.emitter({ id: 'drops', seed: o.seed, births: schedule.rate({ id: 'drop', start: .1, end: 1.3, rate: 8 }),
    transform: { position: [28, -42] }, initial: { life: 1.8, velocity: (c) => [c.rand('vx', -18, -7), c.rand('vy', -20, -8)] },
    motion: { acceleration: [0, 145], drag: [.15, .25], contact: contact.floor({ id: 'water', response: 'kill' }) } });
  const metal = particle.emitter({ id: 'metal', seed: o.seed, births: schedule.burst({ id: 'metal', at: .3, count: 5, spread: .1 }),
    transform: { position: [-38, -28] }, initial: { life: 2, velocity: (c) => [c.rand('vx', 20, 30), c.rand('vy', -40, -20)] },
    motion: { acceleration: [0, 160], drag: .4, contact: contact.floor({ id: 'stone', restitution: .4, tangentRetention: .72, settleSpeed: 4 }) } });
  const rings = particle.emitter({ id: 'rings', seed: o.seed, births: contact.births({ id: 'ring', events: contact.events(drops) }),
    initial: { life: .65, data: (c) => ({ radius: c.rand('radius', 9, 16) }) } });
  const dust = particle.emitter({ id: 'dust', seed: o.seed, births: contact.births({ id: 'dust', events: contact.events(metal), count: 2 }),
    initial: { life: [.2, .35], velocity: (c) => [c.rand('vx', -8, 8), c.rand('vy', -12, -4)], data: (c) => ({ size: Math.min(2.2, 1 + c.birth.event.velocityBefore[1] / 90) }) },
    motion: { drag: 2 }, material: { opacity: fade } });
  key = next; return cached = { drops, metal, rings, dust };
}
export function draw(p, t, o) {
  if (t >= meta.duration) return;
  const d = design(o), C = fit(o.palette, 8), alpha = Math.min(1, t * 10, (meta.duration - t) * 5);
  p.poly([[-64, 0], [60, 0], [54, 12], [-58, 12]], C[0], alpha);
  p.beam(-62, 0, 58, 0, 3, C[2], alpha); p.line(-62, -2, 58, -2, C[4], alpha);
  p.rect(-44, -30, 11, 5, C[1], alpha); p.line(-43, -31, -33, -31, C[4], alpha);
  p.rect(21, -45, 12, 4, C[1], alpha); p.line(22, -46, 32, -46, C[5], alpha);
  particle.draw(p, d.drops, t, { draw: (p, s) => material.waterDrop(p, s, { colors: C, glow: o.glow }) });
  particle.draw(p, d.metal, t, { draw: (p, s) => { p.rect(s.position[0] - 1, s.position[1] - 1, 2, 2, C[5], s.opacity); if (s.contact.phase === 'resting') p.px(...s.position, C[2]); } });
  particle.draw(p, d.rings, t, { draw: (p, s) => material.ripple(p, s, { colors: C, radius: s.data.radius, glow: o.glow }) });
  particle.draw(p, d.dust, t, { draw: (p, s) => material.smoke(p, s, { size: s.data.size, tint: C[2] }) });
}
export function observe(t, o) {
  const d = design(o); return { particles: Object.values(d).map((e) => particle.observe(e, t)), contacts: [contact.observe(d.drops), contact.observe(d.metal)] };
}
