import { finite, identity } from './contract.js';

/** Stateless named channels. Property order and unrelated samples never matter. */
export function unit({ seed = 1, layer = 'effect', id, channel }) {
  finite(seed, 'random.seed'); identity(layer, 'random.layer'); identity(id, 'random.id'); identity(channel, 'random.channel');
  const text = JSON.stringify([seed, layer, id, channel]); let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function range(key, min, max) { finite(min, 'random.min'); finite(max, 'random.max'); return min + (max - min) * unit(key); }
