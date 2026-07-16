// Pitch handling is isolated behind this module so the renderer never has to
// care which underlying technique is producing the pitch change.
//
// Two strategies exist:
//  - `playbackRatePitchStrategy` (v1): changes AudioBufferSourceNode.playbackRate.
//    Cheap, but duration changes along with pitch (a "tape speed" effect).
//    Not used by the renderer anymore, kept here as a fast/legacy fallback.
//  - `preserveDurationPitchStrategy` (v2): pre-processes a buffer with
//    SoundTouchJS (WSOLA) in pitchShift.ts, keeping tempo at 1.0 so length is
//    unaffected. audioRenderer.ts uses this for main sound pitch and each
//    layer's pitch (applied before scheduling), and also for Master Pitch —
//    there it's applied once as a post-render pass over the finished mix,
//    since "pitch-shift the whole mix" only makes sense after everything
//    else has already been combined.

/** Convert a semitone offset into a playbackRate multiplier (equal temperament). */
export function semitonesToPlaybackRate(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

export interface PitchStrategy {
  /** Returns the playbackRate to apply to an AudioBufferSourceNode. */
  getPlaybackRate(semitones: number): number;
  /** Whether this strategy also changes the perceived duration (true for playbackRate-based pitch). */
  affectsDuration: boolean;
}

/** v1 strategy: playbackRate-based pitch shift. Duration changes with pitch. Not used by the renderer. */
export const playbackRatePitchStrategy: PitchStrategy = {
  getPlaybackRate: semitonesToPlaybackRate,
  affectsDuration: true,
};

/**
 * v2 strategy: duration-preserving pitch shift (SoundTouchJS/WSOLA, see pitchShift.ts).
 * The buffer itself is re-synthesized ahead of scheduling (or, for Master
 * Pitch, after the final mixdown), so the resulting AudioBufferSourceNode
 * plays back at a normal rate of 1.
 */
export const preserveDurationPitchStrategy: PitchStrategy = {
  getPlaybackRate: () => 1,
  affectsDuration: false,
};

/** Used everywhere pitch is applied in this app: main sound, layers, and Master Pitch. */
export function activePitchStrategy(): PitchStrategy {
  return preserveDurationPitchStrategy;
}
