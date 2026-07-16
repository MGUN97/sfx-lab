import {
  friendlyDecodeError,
  friendlyTooLargeError,
  friendlyUnsupportedTypeError,
} from '../utils/validation';
import { isSupportedAudioFile, MAX_FILE_SIZE_BYTES } from '../utils/fileUtils';

let sharedContext: AudioContext | null = null;

/** Lazily create one shared AudioContext used for decoding + preview playback. */
export function getAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === 'closed') {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    sharedContext = new Ctor();
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume().catch(() => {});
  }
  return sharedContext;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  if (!isSupportedAudioFile(file)) {
    throw friendlyUnsupportedTypeError(file.name);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw friendlyTooLargeError(file.name, MAX_FILE_SIZE_BYTES / (1024 * 1024));
  }

  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();

  try {
    // decodeAudioData detaches/consumes the buffer in some browsers, so pass a copy.
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return buffer;
  } catch (err) {
    throw friendlyDecodeError(file.name);
  }
}

/** Extract a new AudioBuffer that is a sub-region [startSec, startSec+lengthSec) of `source`. */
export function sliceAudioBuffer(source: AudioBuffer, startSec: number, lengthSec: number | null): AudioBuffer {
  const ctx = getAudioContext();
  const sr = source.sampleRate;
  const totalSamples = source.length;
  const startSample = Math.max(0, Math.min(totalSamples, Math.floor(startSec * sr)));
  const wantedLength = lengthSec != null ? Math.floor(lengthSec * sr) : totalSamples - startSample;
  const endSample = Math.max(startSample, Math.min(totalSamples, startSample + Math.max(1, wantedLength)));
  const outLength = Math.max(1, endSample - startSample);

  const out = ctx.createBuffer(source.numberOfChannels, outLength, sr);
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const srcData = source.getChannelData(ch);
    const dstData = out.getChannelData(ch);
    dstData.set(srcData.subarray(startSample, startSample + outLength));
  }
  return out;
}

/** Simple peak-based waveform extraction for canvas drawing. */
export function extractPeaks(buffer: AudioBuffer, bucketCount: number): Float32Array {
  const data = buffer.getChannelData(0);
  const peaks = new Float32Array(bucketCount);
  const bucketSize = Math.max(1, Math.floor(data.length / bucketCount));
  for (let i = 0; i < bucketCount; i++) {
    let max = 0;
    const start = i * bucketSize;
    const end = Math.min(data.length, start + bucketSize);
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}
