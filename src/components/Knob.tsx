import React, { useCallback, useRef, useState } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  color?: string;
  onChange: (value: number) => void;
  size?: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function Knob({
  label,
  value,
  min,
  max,
  step = 0.1,
  defaultValue = 0,
  unit = '',
  color = '#ff8a3d',
  onChange,
  size = 56,
}: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const startY = useRef(0);
  const startValue = useRef(0);

  const percent = (value - min) / (max - min);
  const angle = -135 + percent * 270;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editing) return;
      setDragging(true);
      startY.current = e.clientY;
      startValue.current = value;
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [value, editing]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const deltaY = startY.current - e.clientY;
      const range = max - min;
      const sensitivity = range / 150; // 150px drag = full range
      let next = startValue.current + deltaY * sensitivity;
      next = clamp(next, min, max);
      next = Math.round(next / step) * step;
      onChange(Number(next.toFixed(4)));
    },
    [dragging, min, max, step, onChange]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const handleDoubleClick = () => onChange(defaultValue);

  const commitInput = () => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed, min, max));
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col items-center gap-1 no-select">
      <div className="studio-label">{label}</div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{ width: size, height: size, cursor: dragging ? 'ns-resize' : 'grab' }}
        className="relative rounded-full flex items-center justify-center shadow-knob"
        title="드래그하여 조절, 더블클릭으로 초기화"
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${color} ${percent * 270}deg, #2c2f38 ${percent * 270}deg 270deg, transparent 270deg 360deg)`,
            transform: 'rotate(135deg)',
          }}
        />
        <div className="absolute rounded-full bg-[#1c1e24] border border-[#33353d]" style={{ inset: 6 }} />
        <div
          className="absolute w-[2px] rounded"
          style={{
            height: size / 2 - 10,
            background: color,
            top: 8,
            left: '50%',
            transformOrigin: `1px ${size / 2 - 14}px`,
            transform: `translateX(-50%) rotate(${angle}deg)`,
          }}
        />
      </div>
      {editing ? (
        <input
          autoFocus
          className="studio-input w-16 text-center"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInput();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button
          className="text-[11px] font-mono text-studio-text hover:text-studio-accent"
          onClick={() => {
            setInputVal(String(value));
            setEditing(true);
          }}
        >
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </button>
      )}
    </div>
  );
}
