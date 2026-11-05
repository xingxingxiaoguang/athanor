import { finite, choice, color as checkedColor, fail } from './contract.js';

export function scalar({ points, input = 'local.seconds', outputUnit = 'unitless', interpolation = 'linear', extrapolation = 'clamp', limits } = {}) {
  choice(input, ['scene.seconds', 'local.seconds', 'particle.age01', 'path.s'], 'curve.input');
  choice(interpolation, ['linear', 'hold', 'smooth'], 'curve.interpolation');
  choice(extrapolation, ['clamp', 'extend', 'error'], 'curve.extrapolation');
  if (!Array.isArray(points) || points.length < 2) fail('curve.points', 'at least two increasing [input,value] knots are required');
  const knots = points.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 2) fail(`curve.points[${i}]`, 'expected [input,value]');
    p.forEach((v, j) => finite(v, `curve.points[${i}][${j}]`));
    if (i && p[0] <= points[i - 1][0]) fail('curve.points', 'input coordinates must be strictly increasing; knots are not silently sorted');
    return [...p];
  });
  if (limits && (!Array.isArray(limits) || limits.length !== 2 || !limits.every(Number.isFinite) || limits[0] > limits[1])) fail('curve.limits', 'expected finite [min,max]');
  const sample = (x) => {
    finite(x, 'curve.sample.input');
    let i = 0, outside = x < knots[0][0] || x > knots.at(-1)[0];
    if (outside && extrapolation === 'error') fail('curve.sample.input', 'outside declared knot domain');
    if (outside && extrapolation === 'clamp') x = Math.max(knots[0][0], Math.min(knots.at(-1)[0], x));
    while (i < knots.length - 2 && x >= knots[i + 1][0]) i++;
    const [x0, y0] = knots[i], [x1, y1] = knots[i + 1]; let u = (x - x0) / (x1 - x0);
    if (!(outside && extrapolation === 'extend')) u = interpolation === 'hold' ? (x >= x1 ? 1 : 0) : interpolation === 'smooth' ? u * u * (3 - 2 * u) : u;
    const value = y0 + (y1 - y0) * u;
    if (limits && (value < limits[0] || value > limits[1])) fail('curve.sample.output', `value ${value} outside declared limits [${limits}]`);
    return value;
  };
  knots.forEach(([x]) => sample(x));
  return { kind: 'ScalarCurve', input, outputUnit, points: knots, interpolation, extrapolation, limits, sample };
}

// Generalizes the stepped/blended cooling ramps used throughout the library.
export function color({ points, input = 'particle.age01', interpolation = 'hold', extrapolation = 'clamp' } = {}) {
  choice(extrapolation, ['clamp', 'error'], 'curve.color.extrapolation');
  if (!Array.isArray(points)) fail('curve.color.points', 'expected [input,Color32 or hex] knots');
  const knots = points.map(([x, c]) => [x, checkedColor(c, 'curve.color.points')]);
  const channels = [0, 8, 16, 24].map((shift) => scalar({ points: knots.map(([x, c]) => [x, (c >>> shift) & 255]), input, interpolation, extrapolation, limits: [0, 255] }));
  return { kind: 'ColorCurve', input, points: knots, interpolation, extrapolation,
    sample(x) { return channels.reduce((c, channel, i) => c | (Math.round(channel.sample(x)) << (i * 8)), 0); },
  };
}
