import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  color?: string;
  onChange: (value: number) => void;
  compact?: boolean;
}

export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  color = '#ff8a3d',
  onChange,
  compact = false,
}: SliderProps) {
  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-1'}>
      <div className="flex items-center justify-between">
        <span className="studio-label">{label}</span>
        <input
          type="number"
          className="studio-input w-16 text-right"
          value={Number(value.toFixed(2))}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color }}
        className="w-full h-1.5 cursor-pointer"
      />
      {unit && <div className="text-[10px] text-studio-dim text-right">{unit}</div>}
    </div>
  );
}
