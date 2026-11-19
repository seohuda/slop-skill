/**
 * Zero-dependency deterministic Mulberry32 PRNG and sampling helpers.
 * Single source of truth: docs/CONTRACT.md
 */

/**
 * Create a deterministic Mulberry32 pseudo-random number generator.
 * @param {number} seed - Finite integer seed.
 * @returns {() => number} Function returning deterministic floats in [0, 1).
 */
export function createPrng(seed) {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`PRNG seed must be a finite integer (got ${String(seed)})`);
  }

  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Return a deterministic integer in the inclusive range [min, max].
 * @param {() => number} rng
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randInt(rng, min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new RangeError(`randInt bounds must be integers (got min=${String(min)}, max=${String(max)})`);
  }
  if (min > max) {
    throw new RangeError(`randInt min (${min}) must be <= max (${max})`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Pick one element uniformly at random from `items`.
 * Returns `null` if `items` is empty.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T | null}
 */
export function pick(rng, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const idx = Math.floor(rng() * items.length);
  return items[idx];
}

/**
 * Return a non-mutating Fisher-Yates shuffled copy of `items`.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function shuffle(rng, items) {
  if (!Array.isArray(items)) {
    throw new TypeError('shuffle expects an array');
  }
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Internal helper returning the chosen index for weighted selection.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @param {(item: T, index: number) => number} weightFn
 * @returns {number}
 */
function weightedPickIndex(rng, items, weightFn) {
  if (!Array.isArray(items) || items.length === 0) {
    return -1;
  }

  const weights = new Array(items.length);
  let totalWeight = 0;
  let lastPositiveIdx = -1;

  for (let i = 0; i < items.length; i += 1) {
    const w = Number(weightFn(items[i], i));
    if (!Number.isFinite(w) || w < 0) {
      throw new RangeError(`Weight at index ${i} must be a non-negative finite number (got ${String(w)})`);
    }
    weights[i] = w;
    if (w > 0) {
      totalWeight += w;
      lastPositiveIdx = i;
    }
  }

  if (totalWeight <= 0) {
    return Math.floor(rng() * items.length);
  }

  let threshold = rng() * totalWeight;
  for (let i = 0; i < items.length; i += 1) {
    if (weights[i] <= 0) continue;
    threshold -= weights[i];
    if (threshold < 0) {
      return i;
    }
  }

  return lastPositiveIdx >= 0 ? lastPositiveIdx : items.length - 1;
}

/**
 * Pick one element from `items` proportionally to positive weights returned by `weightFn`.
 * Returns `null` if `items` is empty.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @param {(item: T, index: number) => number} [weightFn]
 * @returns {T | null}
 */
export function weightedPick(rng, items, weightFn = () => 1) {
  const idx = weightedPickIndex(rng, items, weightFn);
  return idx === -1 ? null : items[idx];
}

/**
 * Sample up to `count` distinct elements without replacement using weighted selection.
 * Does not mutate `items`.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @param {number} count
 * @param {(item: T, index: number) => number} [weightFn]
 * @returns {T[]}
 */
export function weightedSampleWithoutReplacement(rng, items, count, weightFn = () => 1) {
  if (!Array.isArray(items)) {
    throw new TypeError('weightedSampleWithoutReplacement expects an array');
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Sample count must be a non-negative integer (got ${String(count)})`);
  }
  if (items.length === 0 || count === 0) {
    return [];
  }

  const pool = [...items];
  const target = Math.min(count, pool.length);
  const result = [];

  for (let i = 0; i < target; i += 1) {
    const idx = weightedPickIndex(rng, pool, weightFn);
    if (idx === -1) break;
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return result;
}
