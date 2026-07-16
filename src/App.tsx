import React, { useEffect, useRef } from 'react';
import { useAudioStore } from './store/useAudioStore';
import MainSoundUploader from './components/MainSoundUploader';
import LayerRack from './components/LayerRack';
import RandomizationPanel from './components/RandomizationPanel';
import BulkRandomizationPanel from './components/BulkRandomizationPanel';
import MasterControls from './components/MasterControls';
import GenerationSettings from './components/GenerationSettings';
import ResultsPanel from './components/ResultsPanel';
import { downloadJson } from './utils/fileUtils';
import { togglePreview } from './utils/previewRegistry';

export default function App() {
  const projectName = useAudioStore((s) => s.projectName);
  const layers = useAudioStore((s) => s.layers);
  const selectedLayerId = useAudioStore((s) => s.selectedLayerId);
  const selectLayer = useAudioStore((s) => s.selectLayer);
  const bulkMode = useAudioStore((s) => s.bulkMode);
  const toast = useAudioStore((s) => s.toast);
  const clearToast = useAudioStore((s) => s.clearToast);
  const saveProjectToLocalStorage = useAudioStore((s) => s.saveProjectToLocalStorage);
  const loadProjectFromLocalStorage = useAudioStore((s) => s.loadProjectFromLocalStorage);
  const exportProjectJson = useAudioStore((s) => s.exportProjectJson);

  const loadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 3500);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  // Space bar: play/stop whichever waveform was last clicked (Main Sound or a
  // specific layer) — tracked separately from selectedLayerId so it only
  // follows explicit waveform clicks, not general card selection. Does
  // nothing until something has actually been clicked. Ignored while typing
  // in an input/textarea/select, or while a button has focus (so it doesn't
  // double-fire with the native space-activates-button behavior).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (target?.isContentEditable) return;
      const focusedId = useAudioStore.getState().focusedPreviewId;
      if (!focusedId) return;
      e.preventDefault();
      togglePreview(focusedId);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;

  const handleLoadFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    file.text().then((text) => {
      try {
        localStorage.setItem('sfx-lab-project-v1', text);
        loadProjectFromLocalStorage();
      } catch {
        useAudioStore.getState().showToast('프로젝트 파일을 읽지 못했습니다.', 'error');
      }
    });
  };

  return (
    <div className="min-h-screen bg-studio-bg text-studio-text font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-2.5 border-b border-studio-border bg-studio-panel">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎛️</span>
          <span className="text-sm font-bold tracking-wide text-studio-text">
            SFX<span className="text-studio-dim font-normal">—</span>LAB
          </span>
          <span className="text-studio-border">|</span>
          <input
            className="bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-studio-accent"
            value={projectName}
            onChange={(e) => useAudioStore.setState({ projectName: e.target.value })}
          />
        </div>
        <div className="flex-1" />
        <button className="studio-btn" onClick={saveProjectToLocalStorage}>
          Save
        </button>
        <button className="studio-btn" onClick={loadProjectFromLocalStorage}>
          Load
        </button>
        <button className="studio-btn" onClick={() => downloadJson(exportProjectJson(), 'project.json')}>
          Export JSON
        </button>
        <input
          ref={loadInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => handleLoadFile(e.target.files)}
        />
        <button className="studio-btn" onClick={() => loadInputRef.current?.click()}>
          Import JSON
        </button>
      </header>

      {/* Main layout */}
      <main className="p-4 grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 max-w-[1600px] mx-auto">
        {/* Left: main sound + layer rack */}
        <div className="space-y-4">
          <MainSoundUploader />
          <LayerRack />
        </div>

        {/* Right: selected layer detail + master + generation */}
        <div className="space-y-4">
          <div className="studio-panel p-4 min-h-[120px]">
            <h2 className="text-sm font-semibold tracking-wide text-studio-text mb-3">
              {bulkMode ? 'LAYER DETAIL (BULK)' : 'LAYER DETAIL'}
            </h2>

            {bulkMode ? (
              <BulkRandomizationPanel />
            ) : (
              <>
                {layers.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {layers.map((l) => (
                      <button
                        key={l.id}
                        className="studio-btn"
                        title={l.fileName || l.name}
                        onClick={() => selectLayer(l.id)}
                        style={
                          l.id === selectedLayerId
                            ? { backgroundColor: l.color, borderColor: l.color, color: '#15161a', fontWeight: 600 }
                            : {}
                        }
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5"
                          style={{ backgroundColor: l.id === selectedLayerId ? '#15161a' : l.color }}
                        />
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}

                {selectedLayer ? (
                  <div>
                    <div className="text-xs mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedLayer.color }} />
                      <span className="font-medium">{selectedLayer.name}</span>
                    </div>
                    <RandomizationPanel layer={selectedLayer} />
                  </div>
                ) : (
                  <div className="text-xs text-studio-dim">
                    위 목록에서 레이어를 선택하거나 Control Layers 카드를 클릭하면 여기에서 랜덤화 범위와 확률을
                    설정할 수 있습니다.
                    <br />
                    파형을 클릭하면 그게 <span className="text-studio-text">Space</span> 재생/정지 대상으로
                    포커스됩니다.
                  </div>
                )}
              </>
            )}
          </div>

          <MasterControls />
          <GenerationSettings />
        </div>
      </main>

      <div className="px-4 pb-6 max-w-[1600px] mx-auto">
        <ResultsPanel />
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg text-xs shadow-lg border ${
            toast.type === 'error'
              ? 'bg-[#2b1414] border-studio-danger text-studio-danger'
              : toast.type === 'success'
              ? 'bg-[#122a1e] border-studio-ok text-studio-ok'
              : 'bg-studio-panel2 border-studio-border text-studio-text'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
