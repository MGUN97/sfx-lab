import {
  AppliedLayerInfo,
  GenerationSettings,
  Layer,
  MainSound,
  MasterSettings,
  VariationConfig,
} from '../types/audio';
import { sliceAudioBuffer } from './audioDecoder';
import { computeLayerLinearGain, dbToGain, dryWetMultipliers, panToMinusOneOne } from './mixer';
import { pitchShiftBuffer } from './pitchShift';
import { resolveAllLayers } from './randomizer';
import { applyLimiter, normalizeBuffer } from './normalize';
import { friendlyRenderError } from '../utils/validation';

export interface RenderInput {
  mainSound: MainSound;
  layers: Layer[];
  generationSettings: GenerationSettings;
  masterSettings: MasterSettings;
  masterSeed: number;
  variationIndex: number;
}

export interface RenderOutput {
  buffer: AudioBuffer;
  appliedLayers: AppliedLayerInfo[];
  config: VariationConfig;
}

function computeOutputLength(input: RenderInput): number {
  const { mainSound, layers, generationSettings } = input;
  const remainingFromStart = Math.max(0, (mainSound.duration || 0) - (mainSound.sampleStart || 0));
  const mainAudibleDuration =
    mainSound.sampleLength != null ? Math.min(mainSound.sampleLength, remainingFromStart) : remainingFromStart;
  if (generationSettings.lengthMode === 'custom') {
    return Math.max(0.05, generationSettings.customLength);
  }
  if (generationSettings.lengthMode === 'longestLayer') {
    let longest = mainAudibleDuration;
    for (const l of layers) {
      if (l.audioBuffer) longest = Math.max(longest, l.startOffset + l.duration);
    }
    return Math.max(0.05, longest || 1);
  }
  // 'main'
  return Math.max(0.05, mainAudibleDuration || 1);
}

/**
 * Builds the offline audio graph and renders one variation to an AudioBuffer.
 * This is the shared core used both by full generation and by live preview
 * (preview simply feeds the resulting buffer into a normal AudioContext for playback).
 */
export async function renderVariation(input: RenderInput): Promise<RenderOutput> {
  const { mainSound, layers, generationSettings, masterSettings, masterSeed, variationIndex } = input;

  if (!mainSound.audioBuffer) {
    throw friendlyRenderError('메인 사운드가 디코딩되지 않았습니다.');
  }

  const durationSeconds = computeOutputLength(input);
  const sampleRate = generationSettings.sampleRate;
  const numberOfChannels = generationSettings.channels;
  const length = Math.max(1, Math.ceil(durationSeconds * sampleRate));

  let offlineCtx: OfflineAudioContext;
  try {
    offlineCtx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  } catch (err) {
    throw friendlyRenderError('OfflineAudioContext 생성 실패 (메모리 부족일 수 있습니다)');
  }

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = dbToGain(masterSettings.volume) * dbToGain(generationSettings.outputGain);

  let masterOutput: AudioNode = masterGain;
  if (masterSettings.compressor) {
    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    masterGain.connect(comp);
    masterOutput = comp;
  }
  masterOutput.connect(offlineCtx.destination);

  const { dryMult, wetMult } = dryWetMultipliers(masterSettings.dryWet);

  // ── Main sound path (dry) ────────────────────────────────────────────
  // Pitch is applied by re-synthesizing the buffer (duration-preserving);
  // Master Pitch is now handled the same way, as a post-render pass below —
  // so every source in the graph plays back at a plain rate of 1.
  const slicedMain = sliceAudioBuffer(mainSound.audioBuffer, mainSound.sampleStart, mainSound.sampleLength);
  const mainShiftedBuffer = await pitchShiftBuffer(slicedMain, mainSound.pitch);

  const mainSource = offlineCtx.createBufferSource();
  mainSource.buffer = mainShiftedBuffer;

  const mainGainNode = offlineCtx.createGain();
  mainGainNode.gain.value = computeLayerLinearGain(mainSound.volume, mainSound.mix) * dryMult;

  mainSource.connect(mainGainNode);

  let mainOutput: AudioNode = mainGainNode;
  if (numberOfChannels === 2) {
    const mainPanner = offlineCtx.createStereoPanner();
    mainPanner.pan.value = panToMinusOneOne(mainSound.pan);
    mainGainNode.connect(mainPanner);
    mainOutput = mainPanner;
  }
  mainOutput.connect(masterGain);
  mainSource.start(0);

  // ── Layer paths (wet) ─────────────────────────────────────────────────
  const appliedLayers = resolveAllLayers(layers, masterSeed, variationIndex);

  for (let idx = 0; idx < appliedLayers.length; idx++) {
    const applied = appliedLayers[idx];
    const layer = layers[idx];
    if (!applied.applied || !layer.audioBuffer) continue;

    try {
      // Never process more than what could actually be audible: whatever the
      // user explicitly set for Sample Length (if any) still wins if it's the
      // shorter of the two — this only kicks in when a much longer file was
      // left at "to the end" and would otherwise get fully pitch-shifted for
      // nothing beyond where the output already ends.
      const maxUsefulLength = Math.max(0, durationSeconds - applied.randomizedStartOffset);
      const cappedLength =
        applied.randomizedSampleLength != null
          ? Math.min(applied.randomizedSampleLength, maxUsefulLength)
          : maxUsefulLength;

      const slicedBuffer = sliceAudioBuffer(layer.audioBuffer, applied.randomizedSampleStart, cappedLength);
      const sourceBuffer = await pitchShiftBuffer(slicedBuffer, applied.randomizedPitch);

      const repeatCount = Math.max(1, Math.round(applied.randomizedRepeatCount));
      const effectiveDuration = sourceBuffer.duration;

      const layerGain = offlineCtx.createGain();
      layerGain.gain.value = computeLayerLinearGain(applied.randomizedVolume, applied.randomizedMix) * wetMult;

      let layerOutput: AudioNode = layerGain;
      if (numberOfChannels === 2) {
        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = panToMinusOneOne(applied.randomizedPan);
        layerGain.connect(panner);
        layerOutput = panner;
      }
      layerOutput.connect(masterGain);

      for (let rep = 0; rep < repeatCount; rep++) {
        const startTime = applied.randomizedStartOffset + rep * effectiveDuration;
        if (startTime >= durationSeconds) break;
        const src = offlineCtx.createBufferSource();
        src.buffer = sourceBuffer;
        src.connect(layerGain);
        src.start(startTime);
      }
    } catch (err) {
      // Skip this layer on failure but keep rendering the rest of the graph.
      // eslint-disable-next-line no-console
      console.warn(`Layer "${layer.name}" failed to schedule:`, err);
    }
  }

  // Fades on the master path
  if (generationSettings.fadeIn > 0) {
    masterGain.gain.setValueAtTime(0, 0);
    masterGain.gain.linearRampToValueAtTime(
      dbToGain(masterSettings.volume) * dbToGain(generationSettings.outputGain),
      Math.min(generationSettings.fadeIn, durationSeconds)
    );
  }
  if (generationSettings.fadeOut > 0) {
    const fadeStart = Math.max(0, durationSeconds - generationSettings.fadeOut);
    const baseGain = dbToGain(masterSettings.volume) * dbToGain(generationSettings.outputGain);
    masterGain.gain.setValueAtTime(baseGain, fadeStart);
    masterGain.gain.linearRampToValueAtTime(0, durationSeconds);
  }

  let rendered: AudioBuffer;
  try {
    rendered = await offlineCtx.startRendering();
  } catch (err) {
    throw friendlyRenderError('startRendering 실패');
  }

  // Master Pitch: applied once to the finished mix (duration-preserving, same
  // WSOLA-based approach as the per-source pitch above) rather than during
  // graph construction, so it no longer needs playbackRate and no longer
  // risks truncating/leaving gaps in a fixed-length OfflineAudioContext buffer.
  if (Math.abs(masterSettings.pitch) >= 0.005) {
    try {
      rendered = await pitchShiftBuffer(rendered, masterSettings.pitch);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Master Pitch shift failed, falling back to unshifted mix:', err);
    }
  }

  if (generationSettings.normalize || masterSettings.normalize) {
    normalizeBuffer(rendered);
  }
  if (generationSettings.limiter || masterSettings.limiter) {
    applyLimiter(rendered);
  }

  const config: VariationConfig = {
    seed: masterSeed,
    masterSeed,
    variationIndex,
    createdAt: new Date().toISOString(),
    mainSound: {
      fileName: mainSound.fileName,
      volume: mainSound.volume,
      pitch: mainSound.pitch,
      mix: mainSound.mix,
      pan: mainSound.pan,
      sampleStart: mainSound.sampleStart,
      sampleLength: mainSound.sampleLength,
      duration: mainSound.duration,
    },
    layers: appliedLayers,
    generationSettings,
    masterSettings,
  };

  return { buffer: rendered, appliedLayers, config };
}

/**
 * Renders a sequence of variations one at a time (not in parallel) so the
 * browser stays responsive and memory usage stays bounded. Supports cancellation
 * and progress callbacks.
 */
export async function renderVariationBatch(
  baseInput: Omit<RenderInput, 'variationIndex'>,
  count: number,
  onProgress: (completed: number, total: number) => void,
  isCancelled: () => boolean
): Promise<RenderOutput[]> {
  const results: RenderOutput[] = [];
  for (let i = 0; i < count; i++) {
    if (isCancelled()) break;
    const result = await renderVariation({ ...baseInput, variationIndex: i });
    results.push(result);
    onProgress(i + 1, count);
    // Yield to the event loop between renders so the UI (progress bar, cancel button) stays responsive.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return results;
}
