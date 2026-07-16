// ── Shared primitives ─────────────────────────────────────────────────────

export interface RandomRange {
  enabled: boolean;
  min: number;
  max: number;
}

export function makeRange(min: number, max: number, enabled = false): RandomRange {
  return { enabled, min, max };
}

// ── Layer randomization block ─────────────────────────────────────────────

export interface LayerRandomization {
  volume: RandomRange; // dB
  pitch: RandomRange; // semitones
  mix: RandomRange; // 0-100 %
  pan: RandomRange; // -100..100
  startOffset: RandomRange; // seconds, position on the main sound timeline
  sampleStart: RandomRange; // seconds, in-point inside the layer's own sample
  sampleLength: RandomRange; // seconds, how much of the sample to use
  repeatCount: RandomRange; // integer >= 1
  seed: number | null; // per-layer seed override, null = derive from master seed
}

export function defaultRandomization(): LayerRandomization {
  return {
    volume: makeRange(-6, 3),
    pitch: makeRange(-4, 7),
    mix: makeRange(20, 70),
    pan: makeRange(-40, 40),
    startOffset: makeRange(0, 0),
    sampleStart: makeRange(0, 0),
    sampleLength: makeRange(0, 0),
    repeatCount: makeRange(1, 1),
    seed: null,
  };
}

// ── Main sound ─────────────────────────────────────────────────────────────

export interface MainSound {
  file: File | null;
  fileName: string;
  audioBuffer: AudioBuffer | null;
  duration: number;
  volume: number; // dB, -60..12
  pitch: number; // semitones, -24..24
  mix: number; // 0-100
  pan: number; // -100..100
  sampleStart: number; // seconds, in-point inside the file (transient-aligned on upload)
  sampleLength: number | null; // seconds, null = play to the end of the file
}

export function createEmptyMainSound(): MainSound {
  return {
    file: null,
    fileName: '',
    audioBuffer: null,
    duration: 0,
    volume: 0,
    pitch: 0,
    mix: 100,
    pan: 0,
    sampleStart: 0,
    sampleLength: null,
  };
}

// ── Layer ────────────────────────────────────────────────────────────────

export interface Layer {
  id: string;
  name: string;
  color: string;
  file: File | null;
  fileName: string;
  audioBuffer: AudioBuffer | null;
  duration: number;

  enabled: boolean;
  muted: boolean;
  solo: boolean;

  volume: number; // dB, -60..12
  pitch: number; // semitones, -24..24
  mix: number; // 0-100
  pan: number; // -100..100
  startOffset: number; // seconds, where this layer starts on the main timeline

  sampleStart: number; // seconds, in-point inside the sample itself
  sampleLength: number | null; // seconds, null = play to the end of sample
  repeatCount: number; // integer >= 1

  probability: number; // 0-100, chance this layer is included at all

  randomization: LayerRandomization;
  seed: number;
}

const LAYER_COLORS = [
  '#ff8a3d', '#3ddcff', '#5ee89a', '#ffcf5c', '#c792ea', '#ff5c8a', '#7dd3fc', '#f0abfc',
];

let layerColorCursor = 0;
export function nextLayerColor(): string {
  const c = LAYER_COLORS[layerColorCursor % LAYER_COLORS.length];
  layerColorCursor += 1;
  return c;
}

export function createEmptyLayer(index: number): Layer {
  return {
    id: `layer_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name: `Layer ${index + 1}`,
    color: nextLayerColor(),
    file: null,
    fileName: '',
    audioBuffer: null,
    duration: 0,

    enabled: true,
    muted: false,
    solo: false,

    volume: 0,
    pitch: 0,
    mix: 50,
    pan: 0,
    startOffset: 0,

    sampleStart: 0,
    sampleLength: null,
    repeatCount: 1,

    probability: 100,

    randomization: defaultRandomization(),
    seed: Math.floor(Math.random() * 1e9),
  };
}

// ── Generation / output settings ────────────────────────────────────────

export type LengthMode = 'main' | 'longestLayer' | 'custom';
export type SampleRateOption = 44100 | 48000;
export type BitDepthOption = 16 | 24;
export type ChannelOption = 1 | 2;

export interface GenerationSettings {
  variationCount: number; // 1-50
  lengthMode: LengthMode;
  customLength: number; // seconds, used when lengthMode === 'custom'
  sampleRate: SampleRateOption;
  bitDepth: BitDepthOption;
  channels: ChannelOption;
  normalize: boolean;
  limiter: boolean;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  outputGain: number; // dB
}

export function defaultGenerationSettings(): GenerationSettings {
  return {
    variationCount: 5,
    lengthMode: 'main',
    customLength: 3,
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    normalize: true,
    limiter: true,
    fadeIn: 0,
    fadeOut: 0.02,
    outputGain: 0,
  };
}

// ── Master controls ─────────────────────────────────────────────────────

export interface MasterSettings {
  volume: number; // dB
  pitch: number; // semitones, applied globally via playback rate
  dryWet: number; // 0 = fully dry(main), 100 = fully wet(layers)
  normalize: boolean;
  limiter: boolean;
  compressor: boolean;
}

export function defaultMasterSettings(): MasterSettings {
  return {
    volume: 0,
    pitch: 0,
    dryWet: 50,
    normalize: false,
    limiter: false,
    compressor: false,
  };
}

// ── Randomization result / variation record ─────────────────────────────

export interface AppliedLayerInfo {
  layerId: string;
  name: string;
  fileName: string;
  applied: boolean; // whether it ended up in the mix (enabled + probability roll + solo state)
  probabilityRoll: number; // 0-100 value rolled against `probability`
  randomizedVolume: number;
  randomizedPitch: number;
  randomizedMix: number;
  randomizedPan: number;
  randomizedStartOffset: number;
  randomizedSampleStart: number;
  randomizedSampleLength: number | null;
  randomizedRepeatCount: number;
  layerSeed: number;
}

export interface VariationConfig {
  seed: number;
  masterSeed: number;
  variationIndex: number;
  createdAt: string;
  mainSound: {
    fileName: string;
    volume: number;
    pitch: number;
    mix: number;
    pan: number;
    sampleStart: number;
    sampleLength: number | null;
    duration: number;
  };
  layers: AppliedLayerInfo[];
  generationSettings: GenerationSettings;
  masterSettings: MasterSettings;
}

export interface VariationResult {
  id: string;
  index: number;
  name: string;
  seed: number;
  favorite: boolean;
  createdAt: string;
  durationSeconds: number;
  blobUrl: string;
  wavBlob: Blob;
  config: VariationConfig;
}

// ── Generation progress ──────────────────────────────────────────────────

export interface GenerationProgress {
  isGenerating: boolean;
  total: number;
  completed: number;
  currentLabel: string;
  cancelled: boolean;
  error: string | null;
}

export function idleProgress(): GenerationProgress {
  return { isGenerating: false, total: 0, completed: 0, currentLabel: '', cancelled: false, error: null };
}
