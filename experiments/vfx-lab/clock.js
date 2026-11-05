// Experimental clock adapter. Existing library playback is deliberately untouched.
import { createFx } from "../../src/core/index.js";

export const TICK_RATE = 120;

export function clockedFx(mod, options = {}) {
  const fx = createFx(mod, options);
  let elapsed = 0, ticks = 0;
  return {
    options: fx.options,
    get t() { return mod.create ? ticks / TICK_RATE : Math.round(elapsed * 1e10) / 1e10; },
    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new Error("dt must be finite, non-negative seconds");
      elapsed += dt;
      // Normalize summation noise at exact authored frame boundaries.
      if (!mod.create) return fx.update(Math.round(elapsed * 1e10) / 1e10 - fx.t);
      const target = Math.floor(elapsed * TICK_RATE + 1e-7);
      while (ticks < target) { fx.update(1 / TICK_RATE); ticks++; }
    },
    draw: (frame, layer) => fx.draw(frame, layer),
  };
}
