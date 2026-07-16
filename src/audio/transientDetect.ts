// Detects the first strong transient ("hit") in an AudioBuffer, so layers with
// pre-roll silence or slightly different lead-in lengths can all be aligned to
// the moment they actually sound, rather than the raw start of the file.
//
// This matters a lot for multi-layer impact sounds: if each layer's file has
// its "tang" at a slightly different offset from sample 0, randomizing
// Start Offset on the main timeline alone won't line the hits up — you get
// several audible transients instead of one ("탱 탱 탱탱"). Aligning
// Sample Start to each layer's own detected onset fixes that at the source.
//
// Method: short-window RMS envelope → noise-floor-calibrated threshold →
// first rising-edge crossing. This is a standard lightweight onset-detection
// technique; it favors the *first* clear hit rather than the loudest one,
// since that's what we want for lead-in trimming.

export interface TransientDetectionResult {
  /** Seconds into the buffer where the detected onset begins. */
  onsetSeconds: number;
  /** 0-1 rough confidence score — low values mean the "hit" wasn't very distinct
   * from the surrounding noise floor (e.g. a soft swell rather than a sharp attack). */
  confidence: number;
}

export function detectTransientOnset(buffer: AudioBuffer): TransientDetectionResult {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;

  if (length === 0) {
    return { onsetSeconds: 0, confidence: 0 };
  }

  // Mix down to mono — only the timing of the onset matters here, not gain.
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / numChannels;
    }
  }

  const windowSize = Math.max(8, Math.round(sampleRate * 0.002)); // ~2ms
  const hopSize = Math.max(4, Math.round(sampleRate * 0.001)); // ~1ms
  const numWindows = Math.max(1, Math.floor((length - windowSize) / hopSize) + 1);

  const envelope = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    let sumSquares = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = mono[start + i] || 0;
      sumSquares += s * s;
    }
    envelope[w] = Math.sqrt(sumSquares / windowSize);
  }

  // Noise-floor calibration: use a low percentile instead of the minimum so a
  // handful of true-silence samples don't skew the threshold to zero.
  const sorted = Float32Array.from(envelope).sort();
  const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const peak = sorted[sorted.length - 1] ?? 0;

  if (peak <= 0 || peak - noiseFloor < 1e-6) {
    // Effectively silent or flat buffer — nothing meaningful to snap to.
    return { onsetSeconds: 0, confidence: 0 };
  }

  const threshold = noiseFloor + 0.25 * (peak - noiseFloor);

  let onsetWindow = -1;
  for (let w = 1; w < numWindows; w++) {
    if (envelope[w] >= threshold && envelope[w] > envelope[w - 1]) {
      onsetWindow = w;
      break;
    }
  }

  if (onsetWindow === -1) {
    // No clear rising edge found (e.g. a slow swell) — fall back to the
    // loudest window so we still land somewhere useful.
    onsetWindow = 0;
    for (let w = 1; w < numWindows; w++) {
      if (envelope[w] > envelope[onsetWindow]) onsetWindow = w;
    }
  }

  // Back up a couple of milliseconds so we keep a sliver of the natural
  // attack curve instead of cutting exactly at the detected peak.
  const backupSeconds = 0.002;
  const onsetSeconds = Math.max(0, (onsetWindow * hopSize) / sampleRate - backupSeconds);
  const confidence = Math.min(1, (peak - noiseFloor) / (peak + 1e-6));

  return { onsetSeconds, confidence };
}
