// soundtouchjs does not ship TypeScript types. This is a minimal surface
// covering only what this project uses (the low-level SoundTouch + SimpleFilter
// pair for offline, non-realtime processing). If the installed version's API
// differs slightly, adjust here — src/audio/pitchShift.ts also guards against
// a couple of the most likely naming differences at runtime.
declare module 'soundtouchjs' {
  export class SoundTouch {
    pitch: number;
    pitchSemitones: number;
    tempo: number;
    rate: number;
    inputBuffer: unknown;
    outputBuffer: unknown;
    clear(): void;
  }

  export interface SoundSource {
    position: number;
    extract(target: Float32Array, numFrames: number, position: number): number;
  }

  export class SimpleFilter {
    constructor(sourceSound: SoundSource, pipe: SoundTouch);
    position: number;
    extract(target: Float32Array, numFrames: number): number;
  }

  export class PitchShifter {
    constructor(context: AudioContext | OfflineAudioContext, buffer: AudioBuffer, bufferSize?: number);
    pitch: number;
    pitchSemitones: number;
    tempo: number;
    connect(destination: AudioNode): void;
    disconnect(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
  }
}
