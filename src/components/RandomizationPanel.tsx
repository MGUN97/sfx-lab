import React from 'react';
import { Layer, LayerRandomization, RandomRange } from '../types/audio';
import { useAudioStore } from '../store/useAudioStore';
import { generateRandomSeed } from '../utils/seedRandom';
import OffsetTimeline from './OffsetTimeline';

interface RangeRowProps {
  label: string;
  unit: string;
  range: RandomRange;
  min: number;
  max: number;
  step?: number;
  onChange: (r: RandomRange) => void;
  /** The actual value used when randomization is OFF — shown instead of the (irrelevant) min~max fields. */
  fixedValue: number | null;
  /** Text shown when fixedValue is null (e.g. "끝까지" for an unset Sample Length). */
  fixedValueLabel?: string;
  /** Where this fixed value comes from, shown as a small hint next to it. */
  sourceHint: string;
}

function RangeRow({ label, unit, range, min, max, step = 0.1, onChange, fixedValue, fixedValueLabel, sourceHint }: RangeRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-studio-border/60">
      <button
        className={`studio-btn ${range.enabled ? 'active' : ''}`}
        style={{ minWidth: 34, padding: '3px 6px' }}
        onClick={() => onChange({ ...range, enabled: !range.enabled })}
        title="랜덤화 켜기/끄기"
      >
        {range.enabled ? 'ON' : 'OFF'}
      </button>
      <span className="studio-label w-20 shrink-0">{label}</span>

      {range.enabled ? (
        <>
          <input
            type="number"
            className="studio-input w-16"
            value={range.min}
            step={step}
            onChange={(e) => onChange({ ...range, min: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-studio-dim text-[10px]">~</span>
          <input
            type="number"
            className="studio-input w-16"
            value={range.max}
            step={step}
            onChange={(e) => onChange({ ...range, max: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-[10px] text-studio-dim w-6">{unit}</span>
        </>
      ) : (
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] text-studio-text">
            {fixedValue != null ? `${fixedValue.toFixed(step < 1 ? 2 : 0)}${unit}` : fixedValueLabel}
          </span>
          <span className="text-[9px] text-studio-dim truncate">({sourceHint})</span>
        </div>
      )}
    </div>
  );
}

export default function RandomizationPanel({ layer }: { layer: Layer }) {
  const updateLayerRandomization = useAudioStore((s) => s.updateLayerRandomization);
  const updateLayer = useAudioStore((s) => s.updateLayer);
  const mainSound = useAudioStore((s) => s.mainSound);

  const patch = (key: keyof LayerRandomization, value: RandomRange) =>
    updateLayerRandomization(layer.id, { [key]: value } as Partial<LayerRandomization>);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-studio-text">RANDOMIZATION</h3>
        <div className="flex items-center gap-1.5">
          <span className="studio-label">SEED</span>
          <input
            type="number"
            className="studio-input w-24"
            value={layer.randomization.seed ?? layer.seed}
            onChange={(e) =>
              updateLayerRandomization(layer.id, { seed: parseInt(e.target.value, 10) || 0 })
            }
          />
          <button
            className="studio-btn"
            title="랜덤 시드 생성"
            onClick={() => updateLayerRandomization(layer.id, { seed: generateRandomSeed() })}
          >
            🎲
          </button>
        </div>
      </div>

      <RangeRow
        label="Volume"
        unit="dB"
        min={-60}
        max={12}
        step={0.5}
        range={layer.randomization.volume}
        onChange={(r) => patch('volume', r)}
        fixedValue={layer.volume}
        sourceHint="카드 노브 값"
      />
      <RangeRow
        label="Pitch"
        unit="st"
        min={-24}
        max={24}
        step={0.1}
        range={layer.randomization.pitch}
        onChange={(r) => patch('pitch', r)}
        fixedValue={layer.pitch}
        sourceHint="카드 노브 값"
      />
      <RangeRow
        label="Mix"
        unit="%"
        min={0}
        max={100}
        step={1}
        range={layer.randomization.mix}
        onChange={(r) => patch('mix', r)}
        fixedValue={layer.mix}
        sourceHint="카드 노브 값"
      />
      <RangeRow
        label="Pan"
        unit=""
        min={-100}
        max={100}
        step={1}
        range={layer.randomization.pan}
        onChange={(r) => patch('pan', r)}
        fixedValue={layer.pan}
        sourceHint="카드 노브 값"
      />
      <RangeRow
        label="Start Offset"
        unit="s"
        min={0}
        max={60}
        step={0.05}
        range={layer.randomization.startOffset}
        onChange={(r) => patch('startOffset', r)}
        fixedValue={layer.startOffset}
        sourceHint="아래 타임라인에서 드래그로 설정"
      />
      <OffsetTimeline
        timelineDuration={
          Math.max(mainSound.duration || 1, layer.startOffset + (layer.sampleLength ?? Math.max(0.05, layer.duration - layer.sampleStart))) *
          1.15
        }
        startOffset={layer.startOffset}
        clipLength={layer.sampleLength ?? Math.max(0.05, layer.duration - layer.sampleStart)}
        mainSoundDuration={mainSound.duration || 0}
        color={layer.color}
        onChange={(v) => updateLayer(layer.id, { startOffset: v })}
      />
      <div className="text-[9px] text-studio-dim -mt-1 pb-1.5 pl-1">
        타임라인 빈 곳 클릭 = 그 위치로 이동 · 블록 드래그 = 위치 조절 (숫자 직접 입력 대신 사용 가능)
      </div>
      {layer.randomization.startOffset.enabled &&
        Math.abs(layer.randomization.startOffset.max - layer.randomization.startOffset.min) > 0.02 && (
          <div className="text-[9.5px] text-studio-warn leading-snug pb-1.5 pl-1">
            ⚠️ 타격음처럼 트랜지언트가 뚜렷한 소리는 범위가 넓으면 레이어마다 "탱" 지점이 어긋나서 여러 번 겹쳐
            들릴 수 있어요. 좁은 범위(예: ±0.005s)를 권장하고, 레이어 카드의 🎯 Snap to Transient로 먼저 타격
            지점을 정렬해두면 더 안전해요.
          </div>
        )}
      <RangeRow
        label="Sample Start"
        unit="s"
        min={0}
        max={60}
        step={0.05}
        range={layer.randomization.sampleStart}
        onChange={(r) => patch('sampleStart', r)}
        fixedValue={layer.sampleStart}
        sourceHint="파형에서 지정한 값"
      />
      <RangeRow
        label="Sample Length"
        unit="s"
        min={0.01}
        max={60}
        step={0.05}
        range={layer.randomization.sampleLength}
        onChange={(r) => patch('sampleLength', r)}
        fixedValue={layer.sampleLength}
        fixedValueLabel="끝까지"
        sourceHint="파형에서 지정한 값"
      />
      <RangeRow
        label="Repeat"
        unit="x"
        min={1}
        max={16}
        step={1}
        range={layer.randomization.repeatCount}
        onChange={(r) => patch('repeatCount', r)}
        fixedValue={layer.repeatCount}
        sourceHint="고정값"
      />

      <div className="pt-3 mt-2 border-t border-studio-border">
        <div className="flex items-center justify-between">
          <span className="studio-label">PROBABILITY (재생 확률)</span>
          <span className="font-mono text-xs">{layer.probability}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={layer.probability}
          onChange={(e) => updateLayer(layer.id, { probability: parseInt(e.target.value, 10) })}
          className="w-full mt-1"
          style={{ accentColor: layer.color }}
        />
      </div>
    </div>
  );
}
