import React, { useEffect, useRef, useState } from 'react';
import { Layer } from '../types/audio';
import { useAudioStore } from '../store/useAudioStore';
import Waveform from './Waveform';
import Knob from './Knob';
import { formatDuration } from '../utils/fileUtils';
import { getAudioContext } from '../audio/audioDecoder';
import { registerPreviewHandle } from '../utils/previewRegistry';

interface LayerCardProps {
  layer: Layer;
  index: number;
  isSelected: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
}

export default function LayerCard({ layer, index, isSelected, onDragStart, onDragOver, onDragEnd }: LayerCardProps) {
  const setLayerFile = useAudioStore((s) => s.setLayerFile);
  const removeLayerFile = useAudioStore((s) => s.removeLayerFile);
  const snapLayerToTransient = useAudioStore((s) => s.snapLayerToTransient);
  const updateLayer = useAudioStore((s) => s.updateLayer);
  const removeLayer = useAudioStore((s) => s.removeLayer);
  const duplicateLayer = useAudioStore((s) => s.duplicateLayer);
  const toggleMute = useAudioStore((s) => s.toggleMute);
  const toggleSolo = useAudioStore((s) => s.toggleSolo);
  const selectLayer = useAudioStore((s) => s.selectLayer);
  const setFocusedPreview = useAudioStore((s) => s.setFocusedPreview);
  const focusedPreviewId = useAudioStore((s) => s.focusedPreviewId);
  const bulkMode = useAudioStore((s) => s.bulkMode);
  const bulkLayerIds = useAudioStore((s) => s.bulkLayerIds);
  const toggleBulkLayer = useAudioStore((s) => s.toggleBulkLayer);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(layer.name);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reorderArmed, setReorderArmed] = useState(false);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLayerFile(layer.id, files[0]);
  };

  const play = () => {
    if (!layer.audioBuffer || layer.muted) return;
    const buffer = layer.audioBuffer;
    stop();
    const ctx = getAudioContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, layer.pitch / 12);
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, layer.volume / 20) * (layer.mix / 100);
    const panner = ctx.createStereoPanner();
    panner.pan.value = layer.pan / 100;
    src.connect(gain).connect(panner).connect(ctx.destination);
    src.onended = () => setIsPlaying(false);
    src.start(0, Math.min(layer.sampleStart, Math.max(0, buffer.duration - 0.001)));
    sourceRef.current = src;
    setIsPlaying(true);
  };

  const stop = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        /* noop */
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    return registerPreviewHandle(layer.id, { toggle: () => (isPlaying ? stop() : play()) });
  });

  return (
    <div
      draggable={reorderArmed}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDragEnd={() => {
        setReorderArmed(false);
        onDragEnd();
      }}
      onClick={() => selectLayer(layer.id)}
      className={`studio-panel p-3 cursor-pointer transition-colors ${
        isSelected ? 'ring-1' : ''
      } ${!layer.enabled ? 'opacity-50' : ''}`}
      style={{
        borderLeftColor: layer.color,
        borderLeftWidth: 4,
        ...(isSelected ? { boxShadow: `0 0 0 1px ${layer.color}` } : {}),
        ...(bulkMode && bulkLayerIds.includes(layer.id) ? { boxShadow: `0 0 0 2px ${layer.color}`, background: `${layer.color}0f` } : {}),
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {bulkMode && (
          <input
            type="checkbox"
            checked={bulkLayerIds.includes(layer.id)}
            onChange={() => toggleBulkLayer(layer.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 shrink-0"
            style={{ accentColor: layer.color }}
            title="일괄 랜덤화 적용 대상으로 선택"
          />
        )}
        <span
          className="cursor-grab text-studio-dim text-xs select-none"
          title="드래그하여 순서 변경"
          onMouseDown={() => setReorderArmed(true)}
          onMouseUp={() => setReorderArmed(false)}
        >
          ⠿
        </span>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
        {renaming ? (
          <input
            autoFocus
            className="studio-input flex-1 text-xs"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              updateLayer(layer.id, { name: nameDraft || layer.name });
              setRenaming(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-xs font-medium truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenaming(true);
            }}
            title="더블클릭하여 이름 변경"
          >
            {layer.name}
          </span>
        )}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="studio-btn" title="레이어 복제" onClick={() => duplicateLayer(layer.id)}>
            ⧉
          </button>
          <button className="studio-btn danger" title="레이어 삭제 (카드 자체를 제거)" onClick={() => removeLayer(layer.id)}>
            ✕
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".wav,.mp3,.ogg,.m4a,audio/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => e.stopPropagation()}
      />

      {!layer.fileName ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors ${
            isDragOver ? 'border-studio-accent bg-studio-accent/5' : 'border-studio-border hover:border-studio-dim'
          }`}
        >
          <div className="text-xl">🎵</div>
          <div className="text-[11px] text-studio-dim">클릭하거나 파일을 드래그하여 오디오 추가</div>
          <div className="text-[9px] text-studio-dim">WAV / MP3 / OGG / M4A</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-[10px] text-studio-dim mb-1.5">
            <span className="truncate max-w-[45%] text-studio-text">{layer.fileName}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono">{formatDuration(layer.duration)}</span>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button className="studio-btn" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => inputRef.current?.click()}>
                  교체
                </button>
                <button
                  className="studio-btn danger"
                  style={{ padding: '2px 7px', fontSize: 10 }}
                  title="파일만 제거 (레이어 설정은 유지됩니다)"
                  onClick={() => removeLayerFile(layer.id)}
                >
                  파일 삭제
                </button>
              </div>
            </div>
          </div>
          <Waveform
            buffer={layer.audioBuffer}
            color={layer.color}
            height={44}
            interactive
            selectionStart={layer.sampleStart}
            selectionEnd={layer.sampleLength != null ? layer.sampleStart + layer.sampleLength : null}
            onSelectionChange={(start, end) =>
              updateLayer(layer.id, {
                sampleStart: start,
                sampleLength: end != null ? Math.max(0.01, end - start) : null,
              })
            }
            onFocusClick={() => setFocusedPreview(layer.id)}
          />
          <div className="flex items-center justify-between text-[9.5px] text-studio-dim mt-1" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono">
              {layer.sampleStart.toFixed(3)}s
              {layer.sampleLength != null ? ` ~ ${(layer.sampleStart + layer.sampleLength).toFixed(3)}s` : ' ~ 끝까지'}
              {focusedPreviewId === layer.id && <span className="text-studio-accent"> · 🎧 Space로 재생/정지</span>}
            </span>
            {(layer.sampleStart > 0.001 || layer.sampleLength != null) && (
              <button
                className="studio-btn"
                style={{ padding: '1px 6px', fontSize: 9 }}
                onClick={() => updateLayer(layer.id, { sampleStart: 0, sampleLength: null })}
              >
                전체 사용
              </button>
            )}
          </div>
        </>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <button
          className="studio-btn"
          disabled={!layer.audioBuffer || layer.muted}
          title={layer.muted ? '뮤트된 레이어는 재생되지 않습니다' : undefined}
          onClick={isPlaying ? stop : play}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <button
          className="studio-btn"
          disabled={!layer.audioBuffer}
          title="이 레이어의 트랜지언트(타격 지점)를 자동 감지해서 Sample Start를 다시 맞춥니다"
          onClick={() => snapLayerToTransient(layer.id)}
        >
          🎯 Snap to Transient
        </button>
        <button
          className={`studio-btn ${layer.enabled ? 'active' : ''}`}
          onClick={() => updateLayer(layer.id, { enabled: !layer.enabled })}
          title="레이어 활성화/비활성화"
        >
          {layer.enabled ? 'ON' : 'OFF'}
        </button>
        <button
          className={`studio-btn ${layer.muted ? 'active' : ''}`}
          onClick={() => {
            if (!layer.muted && isPlaying) stop();
            toggleMute(layer.id);
          }}
          style={layer.muted ? { backgroundColor: '#ff5c5c', borderColor: '#ff5c5c', color: '#15161a' } : {}}
        >
          MUTE
        </button>
        <button
          className={`studio-btn ${layer.solo ? 'active' : ''}`}
          onClick={() => toggleSolo(layer.id)}
          style={layer.solo ? { backgroundColor: '#ffcf5c', borderColor: '#ffcf5c', color: '#15161a' } : {}}
        >
          SOLO
        </button>
      </div>

      <div className="flex justify-around pt-2 mt-2 border-t border-studio-border">
        <Knob label="VOL" value={layer.volume} min={-60} max={12} step={0.5} defaultValue={0} unit="dB" color={layer.color} onChange={(v) => updateLayer(layer.id, { volume: v })} size={44} />
        <Knob label="PITCH" value={layer.pitch} min={-24} max={24} step={0.1} defaultValue={0} unit="st" color={layer.color} onChange={(v) => updateLayer(layer.id, { pitch: v })} size={44} />
        <Knob label="MIX" value={layer.mix} min={0} max={100} step={1} defaultValue={50} unit="%" color={layer.color} onChange={(v) => updateLayer(layer.id, { mix: v })} size={44} />
        <Knob label="PAN" value={layer.pan} min={-100} max={100} step={1} defaultValue={0} unit="" color={layer.color} onChange={(v) => updateLayer(layer.id, { pan: v })} size={44} />
      </div>
    </div>
  );
}
