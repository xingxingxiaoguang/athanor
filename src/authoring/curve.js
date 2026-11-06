import { finite, choice, color as checkedColor, fail } from './contract.js';

function sided(left, right, side, path) {
  choice(side, ['left', 'right', 'error'], `${path}.side`);
  left ??= right; right ??= left;
  for (const q of [left, right]) { finite(q.value, `${path}.value`); finite(q.derivative, `${path}.derivative`); }
  const differs = (a, b) => a !== b;
  const discontinuity = differs(left.value, right.value) ? 'jump' : differs(left.derivative, right.derivative) ? 'corner' : null;
  if (side === 'error' && discontinuity) fail(path, `${discontinuity}: a two-sided derivative does not exist`, 'CONTRACT_MISMATCH', 'Choose side:"left" or side:"right" explicitly, or use a continuous smooth curve. One-sided velocity does not describe motion through a jump.');
  return { ...(side === 'left' ? left : right), side, discontinuity };
}

function signal(value, path) {
  if (typeof value === 'number') { finite(value, path); return; }
  if (!['ScalarCurve', 'ScalarSignal'].includes(value?.kind) || typeof value.at !== 'function') fail(path, 'expected a finite number or scalar curve/signal');
  return value;
}
const atValue = (value, x, side) => typeof value === 'number' ? { value, derivative: 0 } : value.at(x, { side });

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
  // Keep sample()'s existing right-continuous values. at() pairs a selected
  // one-sided value with its actual derivative, including hold jumps/stops.
  const segment = (i, u) => {
    const [x0, y0] = knots[i], [x1, y1] = knots[i + 1], slope = (y1 - y0) / (x1 - x0);
    return { value: interpolation === 'hold' || u === 0 ? y0 : u === 1 ? y1 : y0 + (y1 - y0) * (interpolation === 'smooth' ? u * u * (3 - 2 * u) : u),
      derivative: interpolation === 'hold' ? 0 : interpolation === 'smooth' ? slope * 6 * u * (1 - u) : slope };
  };
  const outsideLimit = (end) => extrapolation === 'error' ? null : {
    value: knots[end ? knots.length - 1 : 0][1],
    derivative: extrapolation === 'clamp' ? 0 : (() => { const i = end ? knots.length - 2 : 0; return (knots[i + 1][1] - knots[i][1]) / (knots[i + 1][0] - knots[i][0]); })(),
  };
  const at = (x, { side = 'right' } = {}) => {
    const value = sample(x), knot = knots.findIndex(([t]) => t === x);
    if (knot >= 0) return sided(knot ? segment(knot - 1, 1) : outsideLimit(false), knot < knots.length - 1 ? segment(knot, 0) : outsideLimit(true), side, 'curve.derivative.input');
    let i = 0; while (i < knots.length - 2 && x >= knots[i + 1][0]) i++;
    const outside = x < knots[0][0] || x > knots.at(-1)[0];
    const derivative = outside ? (extrapolation === 'clamp' ? 0 : (knots[i + 1][1] - knots[i][1]) / (knots[i + 1][0] - knots[i][0])) : segment(i, (x - knots[i][0]) / (knots[i + 1][0] - knots[i][0])).derivative;
    return sided({ value, derivative }, { value, derivative }, side, 'curve.derivative.input');
  };
  return { kind: 'ScalarCurve', input, outputUnit, points: knots, interpolation, extrapolation, limits, sample, at,
    derivative: (x, { side = 'error' } = {}) => at(x, { side }).derivative };
}

/** Output remapping retains the input clock and applies the chain rule. */
export function affine(value, { scale = 1, offset = 0, outputUnit = value?.outputUnit ?? 'unitless' } = {}) {
  const base = signal(value, 'curve.affine.value'); finite(scale, 'curve.affine.scale'); finite(offset, 'curve.affine.offset');
  const at = (x, { side = 'right' } = {}) => {
    finite(x, 'curve.affine.input');
    const limit = (direction) => { const q = atValue(value, x, direction); return { value: finite(q.value * scale + offset, 'curve.affine.output'), derivative: finite(q.derivative * scale, 'curve.affine.derivative') }; };
    return sided(limit('left'), limit('right'), side, 'curve.affine.derivative');
  };
  return { kind: 'ScalarSignal', input: base?.input ?? 'local.seconds', outputUnit,
    sample: (x) => { finite(x, 'curve.affine.input'); return finite((base ? base.sample(x) : value) * scale + offset, 'curve.affine.output'); },
    at, derivative: (x, { side = 'error' } = {}) => at(x, { side }).derivative };
}

/** Reuse shared envelopes without hand-maintaining sum/product derivatives. */
export function combine({ operation = 'sum', values, outputUnit = 'unitless' }) {
  choice(operation, ['sum', 'product'], 'curve.combine.operation');
  if (!Array.isArray(values) || !values.length) fail('curve.combine.values', 'expected a nonempty list of scalar curves/signals or constants');
  const signals = values.map((v) => signal(v, 'curve.combine.values')).filter(Boolean), input = signals[0]?.input ?? 'local.seconds';
  if (signals.some((v) => v.input !== input)) fail('curve.combine.input', 'input clocks differ; explicitly construct curves in one shared clock');
  const evaluate = (samples) => {
    const value = operation === 'sum' ? samples.reduce((sum, q) => sum + q.value, 0) : samples.reduce((product, q) => product * q.value, 1);
    const derivative = operation === 'sum' ? samples.reduce((sum, q) => sum + q.derivative, 0) : samples.reduce((sum, q, i) => sum + q.derivative * samples.reduce((product, r, j) => i === j ? product : product * r.value, 1), 0);
    return { value: finite(value, 'curve.combine.output'), derivative: finite(derivative, 'curve.combine.derivative') };
  };
  const at = (x, { side = 'right' } = {}) => { finite(x, 'curve.combine.input'); return sided(evaluate(values.map((v) => atValue(v, x, 'left'))), evaluate(values.map((v) => atValue(v, x, 'right'))), side, 'curve.combine.derivative'); };
  return { kind: 'ScalarSignal', input, outputUnit, operation,
    sample: (x) => { finite(x, 'curve.combine.input'); return evaluate(values.map((v) => ({ value: typeof v === 'number' ? v : v.sample(x), derivative: 0 }))).value; },
    at, derivative: (x, { side = 'error' } = {}) => at(x, { side }).derivative };
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
