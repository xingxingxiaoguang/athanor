import { compatible, identity, finite, positive, fail, color, alpha, count } from './contract.js';
import { derive, change } from './mask.js';
import { unit } from './random.js';

function checkField(source, field) {
  if (source.kind !== 'Mask' || !field || !['ScalarField', 'RankField', 'ArrivalField'].includes(field.kind)) fail('image.dissolve', 'expected Mask and typed scalar/rank/arrival field');
  if (field.space !== source.space) fail('image.field.space', 'field and mask coordinates differ; transform explicitly');
  if (field.grid) {
    compatible(source, { ...field.grid, space: field.space });
    if (field.grid.revision !== source.revision) fail('image.field.grid', 'rank/arrival was built for a different mask revision; rebuild it for this source mask');
  }
}

/** Threshold stays in the field's declared unit; no implicit normalization. */
export function dissolve({ mask: source, field, threshold, edgeBand = 0, time = 0, previous }) {
  checkField(source, field); finite(threshold, 'image.threshold'); positive(edgeBand, 'image.edgeBand', true); finite(time, 'image.time');
  const values = new Float64Array(source.data.length);
  source.data.forEach((v, i) => { if (!v) return; const value = field.sample(source.origin[0] + i % source.w + 0.5, source.origin[1] + Math.floor(i / source.w) + 0.5, time); values[i] = finite(value, 'image.field.value'); });
  const keepMask = derive(source, `${source.id}/keep`, (x, y, i) => !!source.data[i] && values[i] > threshold);
  const edgeMask = derive(source, `${source.id}/edge`, (x, y, i) => !!keepMask.data[i] && values[i] - threshold <= edgeBand);
  const result = { time, threshold, fieldUnit: field.unit, keepMask, edgeMask };
  if (previous) Object.assign(result, change(previous.keepMask, keepMask, { id: `${source.id}/change`, fromTime: previous.time, toTime: time }));
  return result;
}

/** Each source pixel gets a first-arrival birth, independent of output fps or
 * jump order. This does not invent arrival times for arbitrary dynamic fields. */
export function dissolveEvents({ id, mask: source, arrival, density = 1, seed = 1, maxEvents = 10000 }) {
  identity(id, 'image.dissolveEvents.id'); checkField(source, arrival);
  if (arrival.kind !== 'ArrivalField' || !arrival.firstArrival) fail('image.dissolveEvents.arrival', 'requires a declared static first-arrival field', 'CAPABILITY_UNSUPPORTED');
  alpha(density, 'image.dissolveEvents.density'); count(maxEvents, 'image.dissolveEvents.maxEvents', 230400);
  const births = [];
  source.data.forEach((v, index) => {
    if (!v || unit({ seed, layer: id, id: index, channel: 'density' }) >= density) return;
    const position = [source.origin[0] + index % source.w + 0.5, source.origin[1] + Math.floor(index / source.w) + 0.5];
    const born = finite(arrival.sample(...position), 'image.dissolveEvents.born');
    births.push({ id: `${id}/pixel/${index}`, index, born, position, space: source.space, sourcePixel: index });
    if (births.length > maxEvents) fail('image.dissolveEvents', `event budget ${maxEvents} exceeded; choose an explicit density or budget`, 'BUDGET_EXCEEDED');
  });
  return births.sort((a, b) => a.born - b.born || a.index - b.index);
}

export function draw(painter, source, { color: paint, alpha: opacity = 1, transparency = 'dither' }) {
  if (source.kind !== 'Mask') fail('image.draw.mask', 'expected Mask');
  if (!['dither', 'soft'].includes(transparency)) fail('image.draw.transparency', 'expected dither or soft');
  source.data.forEach((v, i) => {
    if (!v) return;
    const x = source.origin[0] + i % source.w + 0.5, y = source.origin[1] + Math.floor(i / source.w) + 0.5;
    const c = color(typeof paint === 'function' ? paint(x, y, i) : paint, 'image.draw.color');
    const a = alpha(typeof opacity === 'function' ? opacity(x, y, i) : opacity, 'image.draw.alpha');
    if (transparency === 'soft') painter.blend(x, y, c, a); else painter.dot(x, y, c, a);
  });
}
