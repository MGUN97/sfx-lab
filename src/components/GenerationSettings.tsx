import React, { useRef, useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { LengthMode } from '../types/audio';
import { renderVariation } from '../audio/audioRenderer';
import { getAudioContext } from '../audio/audioDecoder';
import { generateRandomSeed } from '../utils/seedRandom';

export default function GenerationSettings() {
  const gs = useAudioStore((s) => s.generationSettings);
  const updateGenerationSettings = useAudioStore((s) => s.updateGenerationSettings);
  const progress = useAudioStore((s) => s.progress);
  const generate = useAudioStore((s) => s.generate);
  const cancelGeneration = useAudioStore((s) => s.cancelGeneration);

  const mainSound = useAudioStore((s) => s.mainSound);
  const layers = useAudioStore((s) => s.layers);
  const masterSettings = useAudioStore((s) => s.masterSettings);
  const masterSeed = useAudioStore((s) => s.masterSeed);
  const setMasterSeed = useAudioStore((s) => s.setMasterSeed);
  const showToast = useAudioStore((s) => s.showToast);

  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewSeed, setPreviewSeed] = useState<number | null>(null);

  const stopPreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch {
        /* noop */
      }
      previewSourceRef.current = null;
    }
    setPreviewing(false);
  };

  const runPreview = async (seedOverride?: number) => {
    if (!mainSound.audioBuffer) {
      showToast('먼저 메인 사운드를 업로드해주세요.', 'error');
      return;
    }
    stopPreview();
    const seed = seedOverride ?? masterSeed;
    setPreviewSeed(seed);
    try {
      const out = await renderVariation({
        mainSound,
        layers,
        generationSettings: gs,
        masterSettings,
        masterSeed: seed,
        variationIndex: 0,
      });
      const ctx = getAudioContext();
      const src = ctx.createBufferSource();
      src.buffer = out.buffer;
      src.connect(ctx.destination);
      src.onended = () => setPreviewing(false);
      src.start();
      previewSourceRef.current = src;
      setPreviewing(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '프리뷰 렌더링에 실패했습니다.', 'error');
    }
  };

  const randomPreview = () => runPreview(generateRandomSeed());

  const savePreviewAsSeed = () => {
    if (previewSeed != null) {
      setMasterSeed(previewSeed);
      showToast('프리뷰 시드가 Master Seed로 저장되었습니다.', 'success');
    }
  };

  return (
    <div className="studio-panel p-4">
      <h2 className="text-sm font-semibold tracking-wide text-studio-text mb-3">GENERATION SETTINGS</h2>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="studio-label mb-1">베리에이션 개수</div>
          <input
            type="number"
            min={1}
            max={50}
            className="studio-input w-full"
            value={gs.variationCount}
            onChange={(e) => updateGenerationSettings({ variationCount: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
          />
        </div>
        <div>
          <div className="studio-label mb-1">출력 길이</div>
          <select
            className="studio-input w-full"
            value={gs.lengthMode}
            onChange={(e) => updateGenerationSettings({ lengthMode: e.target.value as LengthMode })}
          >
            <option value="main">메인 사운드 길이</option>
            <option value="longestLayer">가장 긴 레이어 길이</option>
            <option value="custom">사용자 지정</option>
          </select>
        </div>

        {gs.lengthMode === 'custom' && (
          <div className="col-span-2">
            <div className="studio-label mb-1">지정 길이 (초)</div>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="studio-input w-full"
              value={gs.customLength}
              onChange={(e) => updateGenerationSettings({ customLength: parseFloat(e.target.value) || 1 })}
            />
          </div>
        )}

        <div>
          <div className="studio-label mb-1">샘플레이트</div>
          <select
            className="studio-input w-full"
            value={gs.sampleRate}
            onChange={(e) => updateGenerationSettings({ sampleRate: parseInt(e.target.value, 10) as 44100 | 48000 })}
          >
            <option value={44100}>44.1 kHz</option>
            <option value={48000}>48 kHz</option>
          </select>
        </div>
        <div>
          <div className="studio-label mb-1">비트 뎁스</div>
          <select
            className="studio-input w-full"
            value={gs.bitDepth}
            onChange={(e) => updateGenerationSettings({ bitDepth: parseInt(e.target.value, 10) as 16 | 24 })}
          >
            <option value={16}>16-bit</option>
            <option value={24}>24-bit</option>
          </select>
        </div>
        <div>
          <div className="studio-label mb-1">채널</div>
          <select
            className="studio-input w-full"
            value={gs.channels}
            onChange={(e) => updateGenerationSettings({ channels: parseInt(e.target.value, 10) as 1 | 2 })}
          >
            <option value={2}>Stereo</option>
            <option value={1}>Mono</option>
          </select>
        </div>
        <div>
          <div className="studio-label mb-1">출력 게인 (dB)</div>
          <input
            type="number"
            step={0.5}
            className="studio-input w-full"
            value={gs.outputGain}
            onChange={(e) => updateGenerationSettings({ outputGain: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <div className="studio-label mb-1">Fade In (초)</div>
          <input
            type="number"
            min={0}
            step={0.01}
            className="studio-input w-full"
            value={gs.fadeIn}
            onChange={(e) => updateGenerationSettings({ fadeIn: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <div className="studio-label mb-1">Fade Out (초)</div>
          <input
            type="number"
            min={0}
            step={0.01}
            className="studio-input w-full"
            value={gs.fadeOut}
            onChange={(e) => updateGenerationSettings({ fadeOut: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button className={`studio-btn ${gs.normalize ? 'active' : ''}`} onClick={() => updateGenerationSettings({ normalize: !gs.normalize })}>
          Normalize
        </button>
        <button className={`studio-btn ${gs.limiter ? 'active' : ''}`} onClick={() => updateGenerationSettings({ limiter: !gs.limiter })}>
          Limiter
        </button>
      </div>

      <div className="border-t border-studio-border pt-3 mb-3">
        <div className="studio-label mb-2">PREVIEW</div>
        <div className="flex flex-wrap gap-2">
          <button className="studio-btn" onClick={() => runPreview()}>▶ Preview</button>
          <button className="studio-btn" onClick={stopPreview} disabled={!previewing}>■ Stop</button>
          <button className="studio-btn" onClick={randomPreview}>🎲 Random Preview</button>
          <button className="studio-btn" onClick={savePreviewAsSeed} disabled={previewSeed == null}>
            프리뷰 Seed 저장
          </button>
        </div>
        {previewSeed != null && <div className="text-[10px] text-studio-dim mt-1 font-mono">preview seed: {previewSeed}</div>}
      </div>

      {progress.isGenerating ? (
        <div className="space-y-2">
          <div className="w-full h-2 bg-[#101114] rounded overflow-hidden">
            <div
              className="h-full bg-studio-accent transition-all"
              style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-studio-dim">
            <span>{progress.currentLabel}</span>
            <button className="studio-btn danger" onClick={cancelGeneration}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button className="studio-btn w-full !py-2.5 !text-sm active" onClick={() => generate()}>
          ⚡ Generate Variations
        </button>
      )}
      {progress.error && <div className="text-[11px] text-studio-danger mt-2">{progress.error}</div>}
    </div>
  );
}
