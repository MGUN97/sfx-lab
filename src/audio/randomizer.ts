import { Layer, AppliedLayerInfo } from '../types/audio';
import { combineSeed, createRng, randomBool, randomInRange, randomIntInRange } from '../utils/seedRandom';

/**
 * Resolves a single layer's actual applied values for one variation, given the
 * master seed and variation index. Fully deterministic: same inputs -> same output.
 */
export function resolveLayerForVariation(
  layer: Layer,
  masterSeed: number,
  variationIndex: number,
  soloActive: boolean
): AppliedLayerInfo {
  const seed = combineSeed(masterSeed, variationIndex, layer.id, layer.randomization.seed ?? layer.seed);
  const rng = createRng(seed);

  const r = layer.randomization;

  const probabilityRoll = rng() * 100;

  const randomizedVolume = r.volume.enabled ? randomInRange(rng, r.volume.min, r.volume.max) : layer.volume;
  const randomizedPitch = r.pitch.enabled ? randomInRange(rng, r.pitch.min, r.pitch.max) : layer.pitch;
  const randomizedMix = r.mix.enabled ? randomInRange(rng, r.mix.min, r.mix.max) : layer.mix;
  const randomizedPan = r.pan.enabled ? randomInRange(rng, r.pan.min, r.pan.max) : layer.pan;
  const randomizedStartOffset = r.startOffset.enabled
    ? Math.max(0, randomInRange(rng, r.startOffset.min, r.startOffset.max))
    : layer.startOffset;
  const randomizedSampleStart = r.sampleStart.enabled
    ? Math.max(0, randomInRange(rng, r.sampleStart.min, r.sampleStart.max))
    : layer.sampleStart;
  const randomizedSampleLength = r.sampleLength.enabled
    ? Math.max(0.01, randomInRange(rng, r.sampleLength.min, r.sampleLength.max))
    : layer.sampleLength;
  const randomizedRepeatCount = r.repeatCount.enabled
    ? Math.max(1, randomIntInRange(rng, r.repeatCount.min, r.repeatCount.max))
    : Math.max(1, layer.repeatCount);

  // Solo logic: if any layer is soloed, only soloed layers may play.
  const soloGate = soloActive ? layer.solo : true;
  const passesProbability = randomBool(rng, layer.probability);
  const applied = layer.enabled && !layer.muted && soloGate && passesProbability && !!layer.audioBuffer;

  return {
    layerId: layer.id,
    name: layer.name,
    fileName: layer.fileName,
    applied,
    probabilityRoll,
    randomizedVolume,
    randomizedPitch,
    randomizedMix,
    randomizedPan,
    randomizedStartOffset,
    randomizedSampleStart,
    randomizedSampleLength,
    randomizedRepeatCount,
    layerSeed: seed,
  };
}

export function resolveAllLayers(
  layers: Layer[],
  masterSeed: number,
  variationIndex: number
): AppliedLayerInfo[] {
  const soloActive = layers.some((l) => l.solo);
  return layers.map((layer) => resolveLayerForVariation(layer, masterSeed, variationIndex, soloActive));
}
