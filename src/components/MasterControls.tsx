import React from 'react';
import { useAudioStore } from '../store/useAudioStore';
import Knob from './Knob';

export default function MasterControls() {
  const masterSettings = useAudioStore((s) => s.masterSettings);
  const updateMasterSettings = useAudioStore((s) => s.updateMasterSettings);
  const masterSeed = useAudioStore((s) => s.masterSeed);
  const setMasterSeed = useAudioStore((s) => s.setMasterSeed);
  const randomizeMasterSeed = useAudioStore((s) => s.randomizeMasterSeed);
  const randomizeAllLayerSeeds = useAudioStore((s) => s.randomizeAllLayerSeeds);
  const unmuteAllLayers = useAudioStore((s) => s.unmuteAllLayers);
  const resetAll = useAudioStore((s) => s.resetAll);

  return (
    <div className="studio-panel p-4">
      <h2 className="text-sm font-semibold tracking-wide text-studio-text mb-3">MASTER</h2>

      <div className="flex justify-around mb-3">
        <Knob label="VOLUME" value={masterSettings.volume} min={-60} max={12} step={0.5} defaultValue={0} unit="dB" onChange={(v) => updateMasterSettings({ volume: v })} />
        <Knob label="PITCH" value={masterSettings.pitch} min={-24} max={24} step={0.1} defaultValue={0} unit="st" color="#3ddcff" onChange={(v) => updateMasterSettings({ pitch: v })} />
        <Knob label="DRY/WET" value={masterSettings.dryWet} min={0} max={100} step={1} defaultValue={50} unit="%" color="#5ee89a" onChange={(v) => updateMasterSettings({ dryWet: v })} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button
          className={`studio-btn ${masterSettings.normalize ? 'active' : ''}`}
          onClick={() => updateMasterSettings({ normalize: !masterSettings.normalize })}
        >
          Normalize
        </button>
        <button
          className={`studio-btn ${masterSettings.limiter ? 'active' : ''}`}
          onClick={() => updateMasterSettings({ limiter: !masterSettings.limiter })}
        >
          Limiter
        </button>
        <button
          className={`studio-btn ${masterSettings.compressor ? 'active' : ''}`}
          onClick={() => updateMasterSettings({ compressor: !masterSettings.compressor })}
        >
          Compressor
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="studio-label">MASTER SEED</span>
        <input
          type="number"
          className="studio-input flex-1"
          value={masterSeed}
          onChange={(e) => setMasterSeed(parseInt(e.target.value, 10) || 0)}
        />
        <button className="studio-btn" title="랜덤 시드 생성" onClick={randomizeMasterSeed}>
          🎲
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="studio-btn" onClick={() => randomizeAllLayerSeeds()}>
          전체 레이어 Randomize
        </button>
        <button className="studio-btn" onClick={() => unmuteAllLayers()}>
          모든 Mute 해제
        </button>
        <button className="studio-btn col-span-2 danger" onClick={() => confirm('모든 설정을 초기화할까요?') && resetAll()}>
          모든 설정 초기화
        </button>
      </div>
    </div>
  );
}
