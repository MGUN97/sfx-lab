import React, { useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { defaultRandomization, LayerRandomization, RandomRange } from '../types/audio';

interface BulkRowProps {
  label: string;
  unit: string;
  range: RandomRange;
  step?: number;
  onChange: (r: RandomRange) => void;
  included: boolean;
  onToggleIncluded: () => void;
}

function BulkRow({ label, unit, range, step = 0.1, onChange, included, onToggleIncluded }: BulkRowProps) {
  return (
    <div className={`flex items-center gap-2 py-1.5 border-b border-studio-border/60 ${included ? '' : 'opacity-50'}`}>
      <button
        className={`studio-btn ${included ? 'active' : ''}`}
        style={{ minWidth: 24, padding: '3px 5px', fontSize: 10 }}
        onClick={onToggleIncluded}
        title="이 항목을 일괄 적용에 포함"
      >
        {included ? '✓' : '·'}
      </button>
      <button
        className={`studio-btn ${range.enabled ? 'active' : ''}`}
        style={{ minWidth: 34, padding: '3px 6px' }}
        onClick={() => onChange({ ...range, enabled: !range.enabled })}
        disabled={!included}
      >
        {range.enabled ? 'ON' : 'OFF'}
      </button>
      <span className="studio-label w-20 shrink-0">{label}</span>
      <input
        type="number"
        className="studio-input w-16"
        value={range.min}
        step={step}
        disabled={!included || !range.enabled}
        onChange={(e) => onChange({ ...range, min: parseFloat(e.target.value) || 0 })}
      />
      <span className="text-studio-dim text-[10px]">~</span>
      <input
        type="number"
        className="studio-input w-16"
        value={range.max}
        step={step}
        disabled={!included || !range.enabled}
        onChange={(e) => onChange({ ...range, max: parseFloat(e.target.value) || 0 })}
      />
      <span className="text-[10px] text-studio-dim w-6">{unit}</span>
    </div>
  );
}

const FIELD_KEYS: (keyof LayerRandomization)[] = [
  'volume',
  'pitch',
  'mix',
  'pan',
  'startOffset',
  'sampleStart',
  'sampleLength',
  'repeatCount',
];

export default function BulkRandomizationPanel() {
  const layers = useAudioStore((s) => s.layers);
  const bulkLayerIds = useAudioStore((s) => s.bulkLayerIds);
  const clearBulkLayers = useAudioStore((s) => s.clearBulkLayers);
  const applyBulkToLayers = useAudioStore((s) => s.applyBulkToLayers);

  const [form, setForm] = useState<LayerRandomization>(defaultRandomization());
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [probabilityIncluded, setProbabilityIncluded] = useState(false);
  const [probability, setProbability] = useState(100);

  const selectedLayers = layers.filter((l) => bulkLayerIds.includes(l.id));

  const patch = (key: keyof LayerRandomization, value: RandomRange) => setForm((f) => ({ ...f, [key]: value }));
  const toggleIncluded = (key: string) => setIncluded((prev) => ({ ...prev, [key]: !prev[key] }));

  const includedCount = FIELD_KEYS.filter((k) => included[k]).length + (probabilityIncluded ? 1 : 0);

  const handleApply = () => {
    const fields: Partial<LayerRandomization> = {};
    FIELD_KEYS.forEach((k) => {
      if (included[k]) {
        (fields as Record<string, unknown>)[k] = form[k];
      }
    });
    applyBulkToLayers(fields, probabilityIncluded ? probability : undefined);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-studio-text">BULK RANDOMIZATION</h3>
        <button className="studio-btn" onClick={clearBulkLayers}>
          선택 해제
        </button>
      </div>

      {selectedLayers.length === 0 ? (
        <div className="text-xs text-studio-dim py-4">
          왼쪽 레이어 카드의 체크박스로 레이어를 2개 이상 선택하면, 여기서 값을 한 번 입력해 선택된 모든
          레이어에 동시에 적용할 수 있어요.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedLayers.map((l) => (
              <span
                key={l.id}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${l.color}22`, color: l.color, border: `1px solid ${l.color}55` }}
              >
                {l.name}
              </span>
            ))}
          </div>

          <div className="text-[10px] text-studio-dim mb-2">
            체크(✓)한 항목만 아래 값으로 <span className="text-studio-text">덮어씌워져요</span>. 체크 안 한
            항목은 각 레이어의 기존 설정이 그대로 유지됩니다.
          </div>

          <BulkRow label="Volume" unit="dB" step={0.5} range={form.volume} onChange={(r) => patch('volume', r)} included={!!included.volume} onToggleIncluded={() => toggleIncluded('volume')} />
          <BulkRow label="Pitch" unit="st" step={0.1} range={form.pitch} onChange={(r) => patch('pitch', r)} included={!!included.pitch} onToggleIncluded={() => toggleIncluded('pitch')} />
          <BulkRow label="Mix" unit="%" step={1} range={form.mix} onChange={(r) => patch('mix', r)} included={!!included.mix} onToggleIncluded={() => toggleIncluded('mix')} />
          <BulkRow label="Pan" unit="" step={1} range={form.pan} onChange={(r) => patch('pan', r)} included={!!included.pan} onToggleIncluded={() => toggleIncluded('pan')} />
          <BulkRow label="Start Offset" unit="s" step={0.05} range={form.startOffset} onChange={(r) => patch('startOffset', r)} included={!!included.startOffset} onToggleIncluded={() => toggleIncluded('startOffset')} />
          <BulkRow label="Sample Start" unit="s" step={0.05} range={form.sampleStart} onChange={(r) => patch('sampleStart', r)} included={!!included.sampleStart} onToggleIncluded={() => toggleIncluded('sampleStart')} />
          <BulkRow label="Sample Length" unit="s" step={0.05} range={form.sampleLength} onChange={(r) => patch('sampleLength', r)} included={!!included.sampleLength} onToggleIncluded={() => toggleIncluded('sampleLength')} />
          <BulkRow label="Repeat" unit="x" step={1} range={form.repeatCount} onChange={(r) => patch('repeatCount', r)} included={!!included.repeatCount} onToggleIncluded={() => toggleIncluded('repeatCount')} />

          <div className={`flex items-center gap-2 pt-3 mt-2 border-t border-studio-border ${probabilityIncluded ? '' : 'opacity-50'}`}>
            <button
              className={`studio-btn ${probabilityIncluded ? 'active' : ''}`}
              style={{ minWidth: 24, padding: '3px 5px', fontSize: 10 }}
              onClick={() => setProbabilityIncluded((v) => !v)}
              title="Probability를 일괄 적용에 포함"
            >
              {probabilityIncluded ? '✓' : '·'}
            </button>
            <span className="studio-label w-20 shrink-0">Probability</span>
            <input
              type="range"
              min={0}
              max={100}
              value={probability}
              disabled={!probabilityIncluded}
              onChange={(e) => setProbability(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <span className="font-mono text-xs w-9 text-right">{probability}%</span>
          </div>

          <button
            className="studio-btn w-full !py-2 mt-4 active"
            disabled={includedCount === 0}
            onClick={handleApply}
          >
            선택된 {selectedLayers.length}개 레이어에 적용
          </button>
        </>
      )}
    </div>
  );
}
