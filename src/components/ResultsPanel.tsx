import React, { useRef, useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { VariationResult } from '../types/audio';
import { downloadBlob, downloadJson, sanitizeFileName } from '../utils/fileUtils';

function ResultCard({ result }: { result: VariationResult }) {
  const toggleFavorite = useAudioStore((s) => s.toggleFavorite);
  const renameResult = useAudioStore((s) => s.renameResult);
  const removeResult = useAudioStore((s) => s.removeResult);
  const regenerateCard = useAudioStore((s) => s.regenerateCard);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(result.name);
  const [showConfig, setShowConfig] = useState(false);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="studio-panel p-3">
      <div className="flex items-center justify-between mb-1">
        {renaming ? (
          <input
            autoFocus
            className="studio-input flex-1 text-xs mr-2"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              renameResult(result.id, nameDraft || result.name);
              setRenaming(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <span className="text-xs font-medium truncate" onDoubleClick={() => setRenaming(true)} title="더블클릭하여 이름 변경">
            #{result.index} {result.name}
          </span>
        )}
        <button className="text-sm" onClick={() => toggleFavorite(result.id)} title="즐겨찾기">
          {result.favorite ? '★' : '☆'}
        </button>
      </div>

      <div className="text-[10px] text-studio-dim font-mono mb-1">
        seed: {result.seed} · {result.durationSeconds.toFixed(2)}s
      </div>

      <audio ref={audioRef} src={result.blobUrl} onEnded={() => setIsPlaying(false)} className="hidden" />

      <div className="flex flex-wrap gap-1.5 mt-2">
        <button className="studio-btn" onClick={togglePlay}>
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
        <button className="studio-btn" onClick={() => downloadBlob(result.wavBlob, `${sanitizeFileName(result.name)}.wav`)}>
          ⬇ WAV
        </button>
        <button className="studio-btn" onClick={() => setShowConfig((v) => !v)}>
          설정 {showConfig ? '숨기기' : '보기'}
        </button>
        <button
          className="studio-btn"
          onClick={() => regenerateCard(result.id)}
          title="이 카드만 새 Seed로 다시 생성 (범위는 그대로, 값만 새로 뽑음)"
        >
          ↺ New Seed
        </button>
        <button
          className="studio-btn"
          onClick={() => downloadJson(result.config, `${sanitizeFileName(result.name)}_config.json`)}
        >
          JSON
        </button>
        <button className="studio-btn danger" onClick={() => removeResult(result.id)}>
          삭제
        </button>
      </div>

      {showConfig && (
        <pre className="mt-2 max-h-56 overflow-auto text-[10px] bg-[#101114] rounded p-2 font-mono text-studio-dim">
          {JSON.stringify(result.config, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ResultsPanel() {
  const results = useAudioStore((s) => s.results);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const downloadAllAsZip = async () => {
    if (results.length === 0) return;
    setDownloadingZip(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      results.forEach((r) => {
        zip.file(`${sanitizeFileName(r.name)}.wav`, r.wavBlob);
        zip.file(`${sanitizeFileName(r.name)}_config.json`, JSON.stringify(r.config, null, 2));
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, 'sound-variations.zip');
    } finally {
      setDownloadingZip(false);
    }
  };

  if (results.length === 0) {
    return (
      <div className="studio-panel p-6 text-center text-xs text-studio-dim">
        아직 생성된 베리에이션이 없습니다. Generate Variations를 눌러 시작하세요.
      </div>
    );
  }

  return (
    <div className="studio-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-studio-text">RESULTS ({results.length})</h2>
        <button className="studio-btn active" onClick={downloadAllAsZip} disabled={downloadingZip}>
          {downloadingZip ? '압축 중...' : '⬇ Download All (ZIP)'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {results.map((r) => (
          <ResultCard key={r.id} result={r} />
        ))}
      </div>
    </div>
  );
}
