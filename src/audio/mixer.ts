/** dB to linear amplitude. 0dB => 1.0 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/**
 * Volume vs Mix are deliberately different concepts:
 *  - `volumeDb` is the sample's own gain (how loud the source itself is).
 *  - `mixPercent` is how strongly that (already-gained) signal is folded into
 *    the final output, 0% = silent/absent, 100% = fully applied.
 */
export function computeLayerLinearGain(volumeDb: number, mixPercent: number): number {
  const vol = dbToGain(volumeDb);
  const mix = Math.max(0, Math.min(100, mixPercent)) / 100;
  return vol * mix;
}

/** Equal-power-ish pan (simple linear here; StereoPannerNode handles the curve in the graph). */
export function panToMinusOneOne(pan100: number): number {
  return Math.max(-100, Math.min(100, pan100)) / 100;
}

/**
 * Dry/Wet balance multipliers for the main (dry) path vs the layer (wet) path.
 * dryWet: 0 = fully dry (main sound centric), 100 = fully wet (layers dominate).
 * We soften the extremes so neither side is ever fully muted by this control alone —
 * per-layer Mix/Probability still governs whether a layer is heard at all.
 */
export function dryWetMultipliers(dryWet0to100: number): { dryMult: number; wetMult: number } {
  const w = Math.max(0, Math.min(100, dryWet0to100)) / 100;
  return {
    dryMult: 1 - w * 0.85,
    wetMult: 0.15 + w * 0.85,
  };
}
