import React, { useCallback, useEffect, useRef } from 'react';
import { extractPeaks } from '../audio/audioDecoder';

interface WaveformProps {
  buffer: AudioBuffer | null;
  color?: string;
  height?: number;
  progress?: number; // 0-1, playhead position
  playheadColor?: string;

  /** When true, the waveform becomes a drag-to-select region editor (used for Sample Start/Length). */
  interactive?: boolean;
  /** Selection start, in seconds. Only meaningful when `interactive`. */
  selectionStart?: number;
  /** Selection end, in seconds, or null meaning "to the end of the file". Only meaningful when `interactive`. */
  selectionEnd?: number | null;
  /** Fired while dragging a handle, moving the region, or drawing a new one. */
  onSelectionChange?: (start: number, end: number | null) => void;
  /** Fired on any click/drag-start on this waveform, interactive or not — used to focus it for the Space-bar shortcut. */
  onFocusClick?: () => void;
}

const MIN_SELECTION_SECONDS = 0.01;
const HANDLE_TOLERANCE_PX = 8;

type DragMode = 'start' | 'end' | 'move' | 'create' | null;

interface DragState {
  mode: DragMode;
  anchorTime: number;
  originalStart: number;
  originalEnd: number; // resolved to buffer duration if selectionEnd was null
  moved: boolean;
}

export default function Waveform({
  buffer,
  color = '#ff8a3d',
  height = 48,
  progress,
  playheadColor = '#ffffff',
  interactive = false,
  selectionStart = 0,
  selectionEnd = null,
  onSelectionChange,
  onFocusClick,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState>({ mode: null, anchorTime: 0, originalStart: 0, originalEnd: 0, moved: false });

  const duration = buffer?.duration ?? 0;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 200;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (!buffer) {
      ctx.strokeStyle = '#2c2f38';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const bucketCount = Math.max(20, Math.floor(width));
    const peaks = extractPeaks(buffer, bucketCount);
    const mid = height / 2;
    const barWidth = width / bucketCount;

    const endSec = selectionEnd ?? duration;
    const hasSelection =
      interactive && duration > 0 && (selectionStart > 0.001 || (selectionEnd != null && selectionEnd < duration - 0.001));
    const selStartPx = duration > 0 ? (selectionStart / duration) * width : 0;
    const selEndPx = duration > 0 ? (endSec / duration) * width : width;

    for (let i = 0; i < bucketCount; i++) {
      const amp = Math.max(0.02, peaks[i]);
      const barHeight = amp * (height - 4);
      const x = i * barWidth;
      const inSelection = !hasSelection || (x + barWidth / 2 >= selStartPx && x + barWidth / 2 <= selEndPx);
      ctx.fillStyle = inSelection ? color : `${color}33`;
      ctx.fillRect(x, mid - barHeight / 2, Math.max(1, barWidth - 1), barHeight);
    }

    if (hasSelection) {
      ctx.fillStyle = `${color}18`;
      ctx.fillRect(selStartPx, 0, selEndPx - selStartPx, height);
    }

    if (interactive) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(selStartPx, 0);
      ctx.lineTo(selStartPx, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(selEndPx, 0);
      ctx.lineTo(selEndPx, height);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.fillRect(selStartPx - 2, height / 2 - 9, 4, 18);
      ctx.fillRect(selEndPx - 2, height / 2 - 9, 4, 18);
    }

    if (progress != null && progress >= 0 && progress <= 1) {
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progress * width, 0);
      ctx.lineTo(progress * width, height);
      ctx.stroke();
    }
  }, [buffer, color, height, progress, playheadColor, interactive, selectionStart, selectionEnd, duration]);

  useEffect(() => {
    draw();
  }, [draw]);

  const timeAtClientX = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.min(duration, Math.max(0, (x / rect.width) * duration));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    onFocusClick?.();
    if (!interactive || !buffer || !onSelectionChange || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = timeAtClientX(e.clientX);
    const endSec = selectionEnd ?? duration;
    const startPx = (selectionStart / duration) * rect.width;
    const endPx = (endSec / duration) * rect.width;

    let mode: DragMode = 'create';
    if (Math.abs(x - startPx) <= HANDLE_TOLERANCE_PX) mode = 'start';
    else if (Math.abs(x - endPx) <= HANDLE_TOLERANCE_PX) mode = 'end';
    else if (x > startPx && x < endPx) mode = 'move';

    dragRef.current = { mode, anchorTime: t, originalStart: selectionStart, originalEnd: endSec, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag.mode || !onSelectionChange || duration <= 0) return;
    const t = timeAtClientX(e.clientX);
    drag.moved = true;

    if (drag.mode === 'start') {
      const newStart = Math.max(0, Math.min(t, drag.originalEnd - MIN_SELECTION_SECONDS));
      onSelectionChange(newStart, selectionEnd);
    } else if (drag.mode === 'end') {
      const newEndRaw = Math.max(t, drag.originalStart + MIN_SELECTION_SECONDS);
      const newEnd = newEndRaw >= duration - 0.005 ? null : newEndRaw;
      onSelectionChange(selectionStart, newEnd);
    } else if (drag.mode === 'move') {
      const length = drag.originalEnd - drag.originalStart;
      const delta = t - drag.anchorTime;
      const newStart = Math.max(0, Math.min(duration - length, drag.originalStart + delta));
      const newEndRaw = newStart + length;
      const newEnd = newEndRaw >= duration - 0.005 ? null : newEndRaw;
      onSelectionChange(newStart, newEnd);
    } else if (drag.mode === 'create') {
      const a = Math.min(drag.anchorTime, t);
      const b = Math.max(drag.anchorTime, t);
      const newEnd = b >= duration - 0.005 ? null : b;
      onSelectionChange(a, newEnd);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'create' && !drag.moved && onSelectionChange) {
      // A plain click without dragging: move the start point here, keep playing to the end.
      onSelectionChange(drag.anchorTime, null);
    }
    dragRef.current = { mode: null, anchorTime: 0, originalStart: 0, originalEnd: 0, moved: false };
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, cursor: interactive ? 'ew-resize' : onFocusClick ? 'pointer' : 'default' }}
      className="block rounded"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
