import React, { useRef } from 'react';

interface OffsetTimelineProps {
  /** Total width of the timeline, in seconds — sized to comfortably fit the main sound + this clip. */
  timelineDuration: number;
  /** Where this layer's clip currently starts, in seconds, on that timeline. */
  startOffset: number;
  /** How long this layer's clip plays for (Sample Length if set, else its trimmed duration). */
  clipLength: number;
  /** Where the main sound itself ends, in seconds — drawn as a reference marker. */
  mainSoundDuration: number;
  color: string;
  onChange: (startOffset: number) => void;
}

export default function OffsetTimeline({
  timelineDuration,
  startOffset,
  clipLength,
  mainSoundDuration,
  color,
  onChange,
}: OffsetTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dragging: boolean; anchorX: number; anchorStart: number }>({
    dragging: false,
    anchorX: 0,
    anchorStart: 0,
  });

  const safeDuration = Math.max(0.05, timelineDuration);
  const safeClipLength = Math.max(0.02, clipLength);
  const maxStart = Math.max(0, safeDuration - safeClipLength);

  const leftPct = (Math.min(startOffset, maxStart) / safeDuration) * 100;
  const widthPct = Math.max(1.5, (safeClipLength / safeDuration) * 100);
  const mainEndPct = Math.min(100, (mainSoundDuration / safeDuration) * 100);

  const timeAtClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.min(safeDuration, Math.max(0, (x / rect.width) * safeDuration));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    track.setPointerCapture(e.pointerId);

    const t = timeAtClientX(e.clientX);
    const clickedInsideBlock = t >= startOffset && t <= startOffset + safeClipLength;

    if (!clickedInsideBlock) {
      // Click on empty timeline: jump the clip so it starts there.
      const next = Math.max(0, Math.min(maxStart, t));
      onChange(Number(next.toFixed(3)));
      dragRef.current = { dragging: true, anchorX: e.clientX, anchorStart: next };
    } else {
      dragRef.current = { dragging: true, anchorX: e.clientX, anchorStart: startOffset };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return;
    const deltaSec =
      ((e.clientX - dragRef.current.anchorX) / (trackRef.current?.getBoundingClientRect().width || 1)) * safeDuration;
    const next = Math.max(0, Math.min(maxStart, dragRef.current.anchorStart + deltaSec));
    onChange(Number(next.toFixed(3)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.dragging = false;
    try {
      trackRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="mt-1 mb-2">
      <div
        ref={trackRef}
        className="relative h-7 rounded bg-[#101114] border border-studio-border cursor-ew-resize select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Main sound reference span */}
        <div
          className="absolute top-0 bottom-0 border-r border-dashed border-studio-dim/40 bg-white/[0.03]"
          style={{ left: 0, width: `${mainEndPct}%` }}
        />
        {/* This layer's clip, positioned by Start Offset */}
        <div
          className="absolute top-1 bottom-1 rounded flex items-center justify-center overflow-hidden"
          style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color, opacity: 0.85 }}
        >
          <span className="text-[8px] font-mono text-black/70 truncate px-1">{startOffset.toFixed(2)}s</span>
        </div>
      </div>
      <div className="flex justify-between text-[9px] text-studio-dim font-mono mt-0.5">
        <span>0s</span>
        <span>메인 사운드 끝 {mainSoundDuration.toFixed(2)}s</span>
        <span>{safeDuration.toFixed(2)}s</span>
      </div>
    </div>
  );
}
