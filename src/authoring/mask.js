import { identity, point, count, fail, compatible, fingerprint, finite } from './contract.js';

export function make({ id, w, h, origin = [0, 0], space = 'effect', test }) {
  identity(id, 'mask.id'); identity(space, 'mask.space'); point(origin, 'mask.origin'); count(w, 'mask.w', 480); count(h, 'mask.h', 480);
  if (!w || !h || typeof test !== 'function') fail('mask.make', 'nonempty dimensions and test(x,y,index) are required');
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, value = test(origin[0] + x + 0.5, origin[1] + y + 0.5, i);
    if (typeof value !== 'boolean' && value !== 0 && value !== 1) fail('mask.test', 'expected boolean or 0/1, not alpha/NaN');
    data[i] = value ? 1 : 0;
  }
  return { kind: 'Mask', id, w, h, origin: [...origin], space, data, revision: fingerprint(data) };
}
export function derive(source, id, test) {
  if (source.kind !== 'Mask') fail('mask.source', 'expected Mask');
  return make({ ...source, id, test });
}
/** Even-odd polygon rasterization at art-pixel centers. Picking its vertices
 * is an art decision; repeating the inside/outside scan is SDK work. */
export function polygon({ id, points, origin, w, h, space = 'effect' }) {
  if (!Array.isArray(points) || points.length < 3) fail('mask.polygon.points', 'at least three finite [x,y] vertices are required');
  points.forEach((p, i) => point(p, `mask.polygon.points[${i}]`));
  origin ??= [Math.floor(Math.min(...points.map((p) => p[0]))), Math.floor(Math.min(...points.map((p) => p[1])))];
  point(origin, 'mask.polygon.origin');
  w ??= Math.ceil(Math.max(...points.map((p) => p[0]))) - origin[0];
  h ??= Math.ceil(Math.max(...points.map((p) => p[1]))) - origin[1];
  return make({ id, w, h, origin, space, test(x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  } });
}
export function at(mask, x, y) {
  const ix = Math.floor(x - mask.origin[0]), iy = Math.floor(y - mask.origin[1]);
  return ix >= 0 && iy >= 0 && ix < mask.w && iy < mask.h ? !!mask.data[iy * mask.w + ix] : false;
}
export function combine(a, b, { id, operation = 'union' }) {
  compatible(a, b); if (!['union', 'intersect', 'subtract', 'xor'].includes(operation)) fail('mask.operation', 'expected union/intersect/subtract/xor');
  return derive(a, id, (x, y, i) => operation === 'union' ? !!(a.data[i] || b.data[i]) : operation === 'intersect' ? !!(a.data[i] && b.data[i]) : operation === 'subtract' ? !!(a.data[i] && !b.data[i]) : !!a.data[i] !== !!b.data[i]);
}
export function outline(source, { id = `${source.id}/edge`, side = 'inside' } = {}) {
  if (!['inside', 'outside'].includes(side)) fail('mask.outline.side', 'expected inside or outside');
  // Outside outlines are clipped to this mask's grid. Expand the authored grid
  // explicitly if the silhouette touches an edge.
  return derive(source, id, (x, y, i) => {
    const neighbors = [at(source, x - 1, y), at(source, x + 1, y), at(source, x, y - 1), at(source, x, y + 1)];
    return side === 'inside' ? !!source.data[i] && neighbors.some((v) => !v) : !source.data[i] && neighbors.some(Boolean);
  });
}
export function change(previous, current, { id, fromTime, toTime }) {
  compatible(previous, current); identity(id, 'mask.change.id'); finite(fromTime, 'mask.change.fromTime'); finite(toTime, 'mask.change.toTime');
  if (toTime <= fromTime) fail('mask.change.interval', 'expected toTime > fromTime; this is an interval delta, not an inferred single-frame event');
  return { id, interval: [fromTime, toTime],
    removedMask: derive(current, `${id}/removed`, (x, y, i) => !!previous.data[i] && !current.data[i]),
    addedMask: derive(current, `${id}/added`, (x, y, i) => !previous.data[i] && !!current.data[i]),
    identity: `${id}/${previous.revision}/${current.revision}/${fromTime}/${toTime}` };
}
