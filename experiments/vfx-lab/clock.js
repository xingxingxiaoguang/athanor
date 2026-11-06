// Experimental clock adapter. Existing library playback is deliberately untouched.
import { createFx } from "../../src/core/index.js";

export const TICK_RATE = 120;

export function clockedFx(mod, options = {}) {
  let elapsed = 0, ticks = 0, exact = false;
  // createFx accumulates its own floating-point time. Keep the saved adapter's
  // draw clock on tick-derived seconds too, so e.g. 24 ticks reaches exactly
  // 0.2 rather than leaving a one-shot visible just below its ending boundary.
  const drawTime = () => mod.meta.loop ? (ticks / TICK_RATE) % mod.meta.duration : Math.min(ticks / TICK_RATE, mod.meta.duration);
  const wrapped = mod.create ? { ...mod, create(o) {
    const impl = mod.create(o);
    return { update: impl.update ? (dt, opts) => impl.update(dt, opts) : undefined,
      draw: (p, t, opts) => impl.draw(p, drawTime(), opts),
      ...(impl.drawBack ? { drawBack: (p, t, opts) => impl.drawBack(p, drawTime(), opts) } : {}) };
  } } : mod;
  let fx = createFx(wrapped, options);
  return {
    options: fx.options,
    get t() { return mod.create ? ticks / TICK_RATE : exact ? elapsed : Math.round(elapsed * 1e10) / 1e10; },
    seek(time) {
      if (mod.create || !Number.isFinite(time) || time < 0) throw new Error('Absolute seek requires a pure effect and finite non-negative seconds');
      // A fresh pure wrapper starts at exactly zero. No accumulated dt or
      // decimal normalization can move an explicit event-time query left.
      elapsed = time; exact = true; fx = createFx(wrapped, options); fx.update(time);
    },
    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new Error("dt must be finite, non-negative seconds");
      elapsed += dt;
      exact = false;
      // Normalize summation noise at exact authored frame boundaries.
      if (!mod.create) return fx.update(Math.round(elapsed * 1e10) / 1e10 - fx.t);
      const target = Math.floor(elapsed * TICK_RATE + 1e-7);
      while (ticks < target) { fx.update(1 / TICK_RATE); ticks++; }
    },
    draw: (frame, layer) => fx.draw(frame, layer),
  };
}
