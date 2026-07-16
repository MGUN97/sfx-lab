import { friendlyEncodeError } from '../utils/validation';
import { BitDepthOption } from '../types/audio';

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Triangular-PDF dither: sum of two independent uniform randoms in [0,1)
 * gives a triangular distribution in (-1, 1), the standard, cheap way to
 * dither before quantizing float samples down to integer PCM. This is what
 * keeps low-level detail (fades, reverb tails, quiet passages) from turning
 * into harsh/grainy quantization distortion instead of soft noise — the same
 * reason DAWs apply dither on bounce/export rather than truncating.
 */
function tpdfDither(): number {
  return Math.random() - Math.random();
}

/** Encode an AudioBuffer to a WAV Blob. Supports 16-bit and 24-bit PCM. */
export function encodeWav(buffer: AudioBuffer, bitDepth: BitDepthOption = 16): Blob {
  try {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
    const bytesPerSample = bitDepth === 24 ? 3 : 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = numFrames * blockAlign;
    const headerSize = 44;
    const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(arrayBuffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // audio format = PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channelData.push(buffer.getChannelData(ch));
    }

    let offset = headerSize;
    if (bitDepth === 16) {
      const posScale = 0x7fff;
      const negScale = 0x8000;
      for (let i = 0; i < numFrames; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
          const raw = (sample < 0 ? sample * negScale : sample * posScale) + tpdfDither();
          const intSample = Math.max(-0x8000, Math.min(0x7fff, Math.round(raw)));
          view.setInt16(offset, intSample, true);
          offset += 2;
        }
      }
    } else {
      // 24-bit
      const posScale = 0x7fffff;
      const negScale = 0x800000;
      for (let i = 0; i < numFrames; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
          const raw = (sample < 0 ? sample * negScale : sample * posScale) + tpdfDither();
          const intSample = Math.max(-0x800000, Math.min(0x7fffff, Math.round(raw)));
          view.setUint8(offset, intSample & 0xff);
          view.setUint8(offset + 1, (intSample >> 8) & 0xff);
          view.setUint8(offset + 2, (intSample >> 16) & 0xff);
          offset += 3;
        }
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  } catch (err) {
    throw friendlyEncodeError();
  }
}
