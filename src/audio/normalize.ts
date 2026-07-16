import { getAudioContext } from './audioDecoder';

/** Find the absolute peak sample value across all channels. */
export function findPeak(buffer: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** Scale the buffer in place so its peak hits `targetPeak` (default -0.3dBFS ~ 0.966). */
export function normalizeBuffer(buffer: AudioBuffer, targetPeak = 0.966): AudioBuffer {
  const peak = findPeak(buffer);
  if (peak <= 0 || peak >= targetPeak) {
    if (peak <= targetPeak) return buffer; // already quiet enough / silent
  }
  const scale = targetPeak / peak;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= scale;
    }
  }
  return buffer;
}

/** Soft-knee brickwall-ish limiter using a tanh soft clip above the threshold. */
export function applyLimiter(buffer: AudioBuffer, thresholdLinear = 0.95): AudioBuffer {
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      const absV = Math.abs(v);
      if (absV > thresholdLinear) {
        const sign = v < 0 ? -1 : 1;
        const over = absV - thresholdLinear;
        const compressed = thresholdLinear + Math.tanh(over * 4) * (1 - thresholdLinear);
        data[i] = sign * Math.min(0.999, compressed);
      }
    }
  }
  return buffer;
}

/** Copies an AudioBuffer (utility for chaining non-destructive processing steps). */
export function cloneAudioBuffer(buffer: AudioBuffer): AudioBuffer {
  const ctx = getAudioContext();
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buffer.getChannelData(ch));
  }
  return out;
}
