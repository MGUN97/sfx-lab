// Deterministic seeded RNG so the same seed + settings always reproduce
// the same variation. We avoid Math.random() for anything that affects output.

/** Simple, fast string hash (cyrb53-ish) that folds down to a 32-bit int. */
export function hashToInt(str: string): number {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0) ^ (h2 >>> 0);
}

/** mulberry32 — small, fast, decent-quality seeded PRNG. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RNG = () => number;

export function createRng(seed: number): RNG {
  return mulberry32(seed >>> 0);
}

/** Combine a master seed with a variation index and a layer id into one seed. */
export function combineSeed(masterSeed: number, variationIndex: number, layerId: string, layerSeedOverride?: number | null): number {
  const layerComponent = layerSeedOverride != null ? layerSeedOverride : hashToInt(layerId);
  const combinedString = `${masterSeed}_${variationIndex}_${layerComponent}`;
  return hashToInt(combinedString);
}

export function randomInRange(rng: RNG, min: number, max: number): number {
  const [lo, hi] = min <= max ? [min, max] : [max, min];
  return lo + rng() * (hi - lo);
}

export function randomIntInRange(rng: RNG, min: number, max: number): number {
  const [lo, hi] = min <= max ? [min, max] : [max, min];
  return Math.round(lo + rng() * (hi - lo));
}

export function randomBool(rng: RNG, chancePercent: number): boolean {
  return rng() * 100 < chancePercent;
}

export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}
