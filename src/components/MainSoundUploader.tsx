import React, { useEffect, useRef, useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import Waveform from './Waveform';
import Knob from './Knob';
import { formatDuration } from '../utils/fileUtils';
import { getAudioContext } from '../audio/audioDecoder';
import { registerPreviewHandle } from '../utils/previewRegistry';

export default function MainSoundUploader() {
  const mainSound = useAudioStore((s) => s.mainSound);
  const setMainSoundFile = useAudioStore((s) => s.setMainSoundFile);
  const removeMainSound = useAudioStore((s) => s.removeMainSound);
  const updateMainSound = useAudioStore((s) => s.updateMainSound);
  const snapMainSoundToTransient = useAudioStore((s) => s.snapMainSoundToTransient);
  const setFocusedPreview = useAudioStore((s) => s.setFocusedPreview);
  const focusedPreviewId = useAudioStore((s) => s.focusedPreviewId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMainSoundFile(files[0]);
  };

  const play = () => {
    if (!mainSound.audioBuffer) return;
    const buffer = mainSound.audioBuffer;
    stop();
    const ctx = getAudioContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, mainSound.pitch / 12);
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, mainSound.volume / 20) * (mainSound.mix / 100);
    const panner = ctx.createStereoPanner();
    panner.pan.value = mainSound.pan / 100;
    src.connect(gain).connect(panner).connect(ctx.destination);
    src.onended = () => setIsPlaying(false);
    const offset = Math.min(mainSound.sampleStart, Math.max(0, buffer.duration - 0.001));
    if (mainSound.sampleLength != null) {
      src.start(0, offset, Math.min(mainSound.sampleLength, buffer.duration - offset));
    } else {
      src.start(0, offset);
    }
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
    return registerPreviewHandle('main', { toggle: () => (isPlaying ? stop() : play()) });
  });

  return (
    <div className="studio-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-studio-text">MAIN SOUND</h2>
        {mainSound.fileName && (
          <div className="flex gap-1.5">
            <button className="studio-btn" onClick={() => inputRef.current?.click()}>
              교체
            </button>
            <button className="studio-btn danger" onClick={removeMainSound} title="파일만 제거">
              파일 삭제
            </button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".wav,.mp3,.ogg,.m4a,audio/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!mainSound.fileName ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-10 cursor-pointer transition-colors ${
            isDragOver ? 'border-studio-accent bg-studio-accent/5' : 'border-studio-border hover:border-studio-dim'
          }`}
        >
          <div className="text-3xl">🎵</div>
          <div className="text-sm text-studio-dim">클릭하거나 파일을 드래그하여 메인 사운드 업로드</div>
          <div className="text-[10px] text-studio-dim">WAV / MP3 / OGG / M4A</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate max-w-[50%] text-studio-text">{mainSound.fileName}</span>
            <span className="font-mono text-studio-dim">{formatDuration(mainSound.duration)}</span>
          </div>

          <Waveform
            buffer={mainSound.audioBuffer}
            color="#ff8a3d"
            height={56}
            interactive
            selectionStart={mainSound.sampleStart}
            selectionEnd={mainSound.sampleLength != null ? mainSound.sampleStart + mainSound.sampleLength : null}
            onSelectionChange={(start, end) =>
              updateMainSound({
                sampleStart: start,
                sampleLength: end != null ? Math.max(0.01, end - start) : null,
              })
            }
            onFocusClick={() => setFocusedPreview('main')}
          />
          <div className="flex items-center justify-between text-[10px] text-studio-dim">
            <span className="font-mono">
              {mainSound.sampleStart.toFixed(3)}s
              {mainSound.sampleLength != null ? ` ~ ${(mainSound.sampleStart + mainSound.sampleLength).toFixed(3)}s` : ' ~ 끝까지'}
              {focusedPreviewId === 'main' && <span className="text-studio-accent"> · 🎧 Space로 재생/정지</span>}
            </span>
            {(mainSound.sampleStart > 0.001 || mainSound.sampleLength != null) && (
              <button
                className="studio-btn"
                style={{ padding: '1px 6px', fontSize: 9 }}
                onClick={() => updateMainSound({ sampleStart: 0, sampleLength: null })}
              >
                전체 사용
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="studio-btn" onClick={isPlaying ? stop : play}>
              {isPlaying ? '■ Stop' : '▶ Play'}
            </button>
            <button
              className="studio-btn"
              title="메인 사운드의 트랜지언트(타격 지점)를 자동 감지해서 Sample Start를 다시 맞춥니다"
              onClick={snapMainSoundToTransient}
            >
              🎯 Snap to Transient
            </button>
          </div>

          <div className="flex justify-around pt-2 border-t border-studio-border">
            <Knob
              label="VOLUME"
              value={mainSound.volume}
              min={-60}
              max={12}
              step={0.5}
              defaultValue={0}
              unit="dB"
              onChange={(v) => updateMainSound({ volume: v })}
            />
            <Knob
              label="PITCH"
              value={mainSound.pitch}
              min={-24}
              max={24}
              step={0.1}
              defaultValue={0}
              unit="st"
              color="#3ddcff"
              onChange={(v) => updateMainSound({ pitch: v })}
            />
            <Knob
              label="MIX"
              value={mainSound.mix}
              min={0}
              max={100}
              step={1}
              defaultValue={100}
              unit="%"
              color="#5ee89a"
              onChange={(v) => updateMainSound({ mix: v })}
            />
            <Knob
              label="PAN"
              value={mainSound.pan}
              min={-100}
              max={100}
              step={1}
              defaultValue={0}
              unit=""
              color="#c792ea"
              onChange={(v) => updateMainSound({ pan: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
