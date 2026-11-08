// Shared seconds-channel evaluator extracted verbatim from motion.source.
import { finite, fail } from './contract.js';
export function secondsSignal(value, name) {
  if (typeof value === 'number') { finite(value, name); return (time) => ({ value, derivative: 0, discontinuity: null }); }
  if (!['ScalarCurve', 'ScalarSignal'].includes(value?.kind) || typeof value.at !== 'function') fail(name, 'expected a finite number or scalar curve/signal with derivatives');
  if (!['local.seconds', 'scene.seconds'].includes(value.input)) fail(name, 'source curves must use seconds, not particle.age01/path.s', 'CONTRACT_MISMATCH', 'Construct the source curve with local.seconds or scene.seconds; its derivative is then per second.');
  return (time, side) => value.at(time, { side });
}
