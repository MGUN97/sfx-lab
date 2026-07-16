import { SoundTouch, SimpleFilter, SoundSource } from 'soundtouchjs';
import { getAudioContext } from './audioDecoder';

/**
 * Feeds an AudioBuffer's samples to SoundTouch's SimpleFilter as interleaved
 * stereo Float32 pairs. Mono sources are duplicated to both channels and
 * collapsed back to mono when we write the result out.
 */
class BufferSampleSource implements SoundSource {
  position = 0;
  private left: Float32Array;
  private right: Float32Array;

  constructor(buffer: AudioBuffer) {
    this.left = buffer.getChannelData(0);
    this.right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : this.left;
  }

  extract(target: Float32Array, numFrames: number, position: number): number {
    this.position = position;
    const total = this.left.length;
    let extracted = 0;
    for (let i = 0; i < numFrames; i++) {
      const idx = position + i;
      if (idx >= total) break;
      target[i * 2] = this.left[idx];
      target[i * 2 + 1] = this.right[idx];
      extracted++;
    }
    return extracted;
  }
}

// Cache shifted results per (source buffer, rounded semitone) so repeated
// variations that reuse the same fixed pitch (e.g. the main sound, or a
// layer with pitch-randomization turned off) don't get reprocessed every time.
const shiftCache = new WeakMap<AudioBuffer, Map<number, AudioBuffer>>();

function cacheKey(semitones: number): number {
  return Math.round(semitones * 100); // 0.01 semitone resolution
}

/**
 * Pitch-shifts an AudioBuffer by `semitones` while preserving its duration
 * (tempo stays at 1.0 — only pitch changes). This replaces the naive
 * playbackRate approach used elsewhere for the "v1" strategy; see
 * pitchProcessor.ts for where the two are switched between.
 */
export async function pitchShiftBuffer(source: AudioBuffer, semitones: number): Promise<AudioBuffer> {
  if (Math.abs(semitones) < 0.005) {
    return source; // nothing to do
  }

  const key = cacheKey(semitones);
  const perBufferCache = shiftCache.get(source);
  const cached = perBufferCache?.get(key);
  if (cached) return cached;

  const sampleSource = new BufferSampleSource(source);
  const soundtouch = new SoundTouch();

  // Guard against minor API-surface differences between soundtouchjs versions.
  // Cast through `any` here on purpose — our .d.ts declares `pitchSemitones`
  // as always present, which would make TypeScript treat the "else" branch
  // below as unreachable (narrowing to `never`) if we checked `soundtouch`
  // directly. This is a runtime feature-check against the *actual* installed
  // library, not something the static types can express safely.
  const soundtouchAny = soundtouch as unknown as Record<string, unknown>;
  if ('pitchSemitones' in soundtouchAny) {
    soundtouchAny.pitchSemitones = semitones;
  } else {
    soundtouchAny.pitch = Math.pow(2, semitones / 12);
  }
  soundtouch.tempo = 1; // duration-preserving: only pitch changes, speed stays put

  const filter = new SimpleFilter(sampleSource, soundtouch);

  const BLOCK = 4096;
  const tmp = new Float32Array(BLOCK * 2);

  // Output length should land close to the input length since tempo === 1;
  // grow the arrays if the filter produces a little more than expected.
  let capacity = source.length + BLOCK * 2;
  let outLeft = new Float32Array(capacity);
  let outRight = new Float32Array(capacity);
  let writePos = 0;

  // Safety cap so a misbehaving filter can't spin forever on a bad buffer.
  const maxIterations = Math.ceil(source.length / BLOCK) * 4 + 32;
  let iterations = 0;

  while (iterations++ < maxIterations) {
    const framesExtracted = filter.extract(tmp, BLOCK);
    if (framesExtracted === 0) break;

    if (writePos + framesExtracted > capacity) {
      capacity = (writePos + framesExtracted) * 2;
      const grownLeft = new Float32Array(capacity);
      const grownRight = new Float32Array(capacity);
      grownLeft.set(outLeft.subarray(0, writePos));
      grownRight.set(outRight.subarray(0, writePos));
      outLeft = grownLeft;
      outRight = grownRight;
    }

    for (let i = 0; i < framesExtracted; i++) {
      outLeft[writePos + i] = tmp[i * 2];
      outRight[writePos + i] = tmp[i * 2 + 1];
    }
    writePos += framesExtracted;

    if (framesExtracted < BLOCK) break;
  }

  const ctx = getAudioContext();
  const outLength = Math.max(1, writePos);
  const result = ctx.createBuffer(source.numberOfChannels, outLength, source.sampleRate);
  result.getChannelData(0).set(outLeft.subarray(0, outLength));
  if (source.numberOfChannels > 1) {
    result.getChannelData(1).set(outRight.subarray(0, outLength));
  }

  const map = perBufferCache ?? new Map<number, AudioBuffer>();
  map.set(key, result);
  shiftCache.set(source, map);

  return result;
}
