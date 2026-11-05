// A deliberately small authorable example: shared events, two structural directions,
// analytic motion and explicit material choices. No generation service is involved.
import { fit, Rng, crystal, band, sparkle, clamp, smooth, ease, fly, TAU, PAL } from "../../../src/core/index.js";

export const meta = {
  name: "Cryo bloom", desc: "A cold point gathers, a wave spreads and a crown of crystals follows, sheds shards and sinks into frost.",
  tags: ["ice", "crystal", "propagation", "demo"], size: [208, 128], origin: [104, 100],
  duration: 2.4, loop: false, fps: 30, bg: "ground", actor: 2,
  options: { palette: PAL.ice, seed: 4, direction: "crown", reach: 82, glow: 0.35, secondary: true },
};
export const events = { charge: 0.12, release: 0.36, contact: 0.52, melt: 1.35, end: 2.4 };

function sites(o) {
  const r = new Rng(o.seed), count = o.direction === "wave" ? 16 : 10;
  return Array.from({ length: count }, (_, i) => {
    const side = i % 2 ? 1 : -1, q = 0.14 + (Math.floor(i / 2) + r.range(0.15, 0.85)) / (count / 2) * 0.73;
    const x = side * q * o.reach, h = (o.direction === "wave" ? 9 + 7 * q : 34 * (1 - q) + 6) * r.range(0.8, 1.2);
    return { x, h, w: h * r.range(0.22, 0.3), lean: side * h * 0.22, back: i % 4 < 2,
      birth: events.release + 0.42 * (1 - Math.cbrt(1 - q)), salt: r.next() };
  });
}

function paint(p, t, o, back) {
  if (t >= meta.duration) return;
  const C = fit(o.palette, 8), dim = [C[0], C[0], C[1], C[2], C[3], C[4], C[5], C[6]];
  const fade = 1 - smooth(1.8, 2.4, t), travel = clamp((t - events.release) / 0.42), front = o.reach * ease.outCubic(travel);
  if (t >= events.release && travel < 1) {
    band(p, 0, 1, Math.max(1, front), 0.16, Math.max(1, 4 * (1 - travel)), (1 - travel) * fade, C, (a) => (Math.sin(a) < 0) === back);
  }
  for (const s of sites(o)) {
    const age = t - s.birth;
    if (s.back !== back || age < 0) continue;
    const grow = ease.outBack(clamp(age / 0.14)), melt = 1 - smooth(events.melt, 2.1, t);
    if (melt > 0) crystal(p, s.x, 0, s.h * grow * melt, s.w * (0.45 + 0.55 * melt), s.lean * grow * melt, back ? dim : C, { white: age < 0.035, glint: age > 0.4 && age < 0.85 ? (age - 0.4) / 0.45 : -1 });
    if (o.secondary) {
      const r = new Rng(Math.round(s.salt * 1e8));
      for (let j = 0; j < 3; j++) {
        const vx = r.range(-23, 23), vy = -r.range(30, 65), life = r.range(0.3, 0.58);
        if (age >= life) continue;
        const [x, y] = fly(s.x, -3, vx, vy, age, 190, 0.5);
        if (y < 0) p.line(x, y - 2, x + 1, y, C[5 + (j % 2)], (1 - age / life) * fade);
      }
    }
    if (back && age < 1.6) p.dot(s.x, 1, C[4], (1 - age / 1.6) * fade);
  }
  if (!back && t < events.release) {
    const k = t / events.release;
    sparkle(p, 0, -23, 1 + 6 * k * k, C[6], C[4], 0);
    p.glow(0, -23, 12 + 10 * k, C[4], o.glow * k);
  }
  if (!back && t >= events.release && t < events.release + 0.1) {
    const k = 1 - (t - events.release) / 0.1;
    sparkle(p, 0, -23, 17 * k, C[7], C[5], o.glow);
  }
  if (back && t > events.release) p.glow(0, -3, 46, C[4], o.glow * fade * (1 - smooth(1.2, 2.1, t)));
}
export const drawBack = (p, t, o) => paint(p, t, o, true);
export const draw = (p, t, o) => paint(p, t, o, false);
