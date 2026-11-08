// Extracted from fx/ice/_lib.js. Crack walk adapted from Sprite Fusion ice
// https://www.spritefusion.com/pixel-art-vfx/ice
// MIT License, Copyright (c) 2026 Hugo Duprez. Retain this attribution.
import { TAU } from './math.js';

// Preserve the original random draws, cumulative distance and postorder output.
// Metadata is recorded at the fork, never inferred from coincident coordinates.
export function fractureBranches(R, inside, x, y, n, opts = {}, onPoint) {
  const out = [], step = opts.step ?? [1.6, 2.6], len = opts.len ?? 18, fork = opts.fork ?? 0.16, a0 = opts.a0 ?? R.range(0, TAU), spread = opts.spread ?? TAU;
  const walk = (x, y, d, a, len, depth, id, parentId, attachPx) => {
    const pts = [[x, y, d]], start = d;
    onPoint?.();
    for (let s = 0; s < len; s++) {
      a += R.range(-0.55, 0.55);
      const st = R.range(step[0], step[1]), nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
      if (!inside(nx, ny)) break;
      (x = nx), (y = ny), (d += st);
      pts.push([x, y, d]); onPoint?.();
      if (depth < 2 && pts.length > 2 && R.chance(fork)) walk(x, y, d, a + R.sign() * R.range(0.6, 1.2), Math.ceil(len * 0.5), depth + 1, `${id}/${s}`, id, d - start);
    }
    if (pts.length > 1) out.push({ id, parentId, attachPx, points: pts });
  };
  for (let i = 0; i < n; i++) walk(x, y, 0, a0 + (i / n) * spread + R.range(-0.3, 0.3) * Math.min(1, spread / TAU), len, 0, String(i), null, 0);
  return out;
}
