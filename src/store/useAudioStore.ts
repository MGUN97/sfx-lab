import { create } from 'zustand';
import {
  createEmptyLayer,
  createEmptyMainSound,
  defaultGenerationSettings,
  defaultMasterSettings,
  GenerationProgress,
  GenerationSettings,
  idleProgress,
  Layer,
  LayerRandomization,
  MainSound,
  MasterSettings,
  VariationResult,
} from '../types/audio';
import { decodeAudioFile } from '../audio/audioDecoder';
import { detectTransientOnset } from '../audio/transientDetect';
import { encodeWav } from '../audio/wavEncoder';
import { renderVariation, renderVariationBatch } from '../audio/audioRenderer';
import { generateRandomSeed } from '../utils/seedRandom';
import {
  AppError,
  assertHasActiveLayer,
  assertMainSoundPresent,
  friendlyDuplicateError,
} from '../utils/validation';
import { isDuplicateFile } from '../utils/fileUtils';

const LOCAL_STORAGE_KEY = 'sfx-lab-project-v1';

interface AudioStoreState {
  projectName: string;
  mainSound: MainSound;
  layers: Layer[];
  selectedLayerId: string | null;
  focusedPreviewId: string | null;
  masterSettings: MasterSettings;
  generationSettings: GenerationSettings;
  masterSeed: number;
  results: VariationResult[];
  progress: GenerationProgress;
  toast: { message: string; type: 'error' | 'info' | 'success' } | null;
  previewSeed: number | null;

  // Main sound
  setMainSoundFile: (file: File) => Promise<void>;
  removeMainSound: () => void;
  updateMainSound: (patch: Partial<MainSound>) => void;
  snapMainSoundToTransient: () => void;

  // Layers
  addLayer: () => void;
  setLayerFile: (layerId: string, file: File) => Promise<void>;
  removeLayerFile: (layerId: string) => void;
  snapLayerToTransient: (layerId: string) => void;
  updateLayer: (layerId: string, patch: Partial<Layer>) => void;
  updateLayerRandomization: (layerId: string, patch: Partial<LayerRandomization>) => void;
  removeLayer: (layerId: string) => void;
  duplicateLayer: (layerId: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  toggleMute: (layerId: string) => void;
  toggleSolo: (layerId: string) => void;
  selectLayer: (layerId: string | null) => void;
  /** Set by clicking a waveform (Main Sound or a layer) — separate from selectedLayerId, this is
   * what the Space-bar play/stop shortcut targets, so it only follows explicit waveform clicks. */
  setFocusedPreview: (id: string | null) => void;

  // Bulk randomization editing (apply the same randomization settings to several layers at once)
  bulkMode: boolean;
  bulkLayerIds: string[];
  toggleBulkMode: () => void;
  toggleBulkLayer: (id: string) => void;
  clearBulkLayers: () => void;
  applyBulkToLayers: (fields: Partial<LayerRandomization>, probability?: number) => void;
  randomizeAllLayerSeeds: () => void;
  unmuteAllLayers: () => void;

  // Master / generation settings
  updateMasterSettings: (patch: Partial<MasterSettings>) => void;
  updateGenerationSettings: (patch: Partial<GenerationSettings>) => void;
  setMasterSeed: (seed: number) => void;
  randomizeMasterSeed: () => void;

  // Generation
  generate: () => Promise<void>;
  cancelGeneration: () => void;

  // Results
  toggleFavorite: (id: string) => void;
  renameResult: (id: string, name: string) => void;
  removeResult: (id: string) => void;
  regenerateCard: (id: string) => Promise<void>;

  // Project persistence
  saveProjectToLocalStorage: () => void;
  loadProjectFromLocalStorage: () => void;
  exportProjectJson: () => any;
  resetAll: () => void;

  showToast: (message: string, type?: 'error' | 'info' | 'success') => void;
  clearToast: () => void;
}

let cancelFlag = { current: false };

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  projectName: 'Untitled Sound Project',
  mainSound: createEmptyMainSound(),
  layers: [createEmptyLayer(0), createEmptyLayer(1), createEmptyLayer(2)],
  selectedLayerId: null,
  focusedPreviewId: null,
  bulkMode: false,
  bulkLayerIds: [],
  masterSettings: defaultMasterSettings(),
  generationSettings: defaultGenerationSettings(),
  masterSeed: generateRandomSeed(),
  results: [],
  progress: idleProgress(),
  toast: null,
  previewSeed: null,

  // ── Main sound ─────────────────────────────────────────────────────
  setMainSoundFile: async (file: File) => {
    try {
      const audioBuffer = await decodeAudioFile(file);
      const { onsetSeconds, confidence } = detectTransientOnset(audioBuffer);
      set((state) => ({
        mainSound: {
          ...state.mainSound,
          file,
          fileName: file.name,
          audioBuffer,
          duration: audioBuffer.duration,
          // Same transient-alignment as layers get — if the main sound has
          // lead-in silence before its own "hit", trim to that point so it
          // lines up with layers that were snapped the same way.
          sampleStart: onsetSeconds,
          sampleLength: null,
          // Loading/replacing the file resets this sound's own knobs back to
          // default — Master Volume/Pitch/Dry-Wet are untouched, since those
          // are global mix controls, not per-sound settings.
          volume: 0,
          pitch: 0,
          mix: 100,
          pan: 0,
        },
      }));
      if (confidence < 0.3) {
        get().showToast(
          `"${file.name}"의 트랜지언트가 뚜렷하지 않아 자동 정렬이 부정확할 수 있어요. 필요하면 수동으로 조정해주세요.`,
          'info'
        );
      }
    } catch (err) {
      get().showToast(err instanceof AppError ? err.message : '메인 사운드 업로드에 실패했습니다.', 'error');
    }
  },
  removeMainSound: () => set({ mainSound: createEmptyMainSound() }),
  updateMainSound: (patch) => set((state) => ({ mainSound: { ...state.mainSound, ...patch } })),
  snapMainSoundToTransient: () =>
    set((state) => {
      if (!state.mainSound.audioBuffer) return state;
      const { onsetSeconds } = detectTransientOnset(state.mainSound.audioBuffer);
      return { mainSound: { ...state.mainSound, sampleStart: onsetSeconds } };
    }),

  // ── Layers ─────────────────────────────────────────────────────────
  addLayer: () =>
    set((state) => ({
      layers: [...state.layers, createEmptyLayer(state.layers.length)],
    })),

  setLayerFile: async (layerId: string, file: File) => {
    const { layers } = get();
    if (isDuplicateFile(file, layers)) {
      get().showToast(friendlyDuplicateError(file.name).message, 'error');
      return;
    }
    try {
      const audioBuffer = await decodeAudioFile(file);
      const { onsetSeconds, confidence } = detectTransientOnset(audioBuffer);
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                file,
                fileName: file.name,
                audioBuffer,
                duration: audioBuffer.duration,
                // Auto-align to this file's own detected "hit" instead of
                // sample 0, so multiple layers' transients line up on the
                // main timeline instead of landing at slightly different times.
                sampleStart: onsetSeconds,
                sampleLength: null,
                // Loading/replacing the file resets this layer's own knobs
                // back to default — Master Volume/Pitch/Dry-Wet are untouched.
                volume: 0,
                pitch: 0,
                mix: 50,
                pan: 0,
              }
            : l
        ),
      }));
      if (confidence < 0.3) {
        get().showToast(
          `"${file.name}"의 트랜지언트가 뚜렷하지 않아 자동 정렬이 부정확할 수 있어요. 필요하면 수동으로 Sample Start를 조정해주세요.`,
          'info'
        );
      }
    } catch (err) {
      get().showToast(err instanceof AppError ? err.message : '레이어 업로드에 실패했습니다.', 'error');
    }
  },

  snapLayerToTransient: (layerId) =>
    set((state) => {
      const layer = state.layers.find((l) => l.id === layerId);
      if (!layer || !layer.audioBuffer) return state;
      const { onsetSeconds } = detectTransientOnset(layer.audioBuffer);
      return {
        layers: state.layers.map((l) => (l.id === layerId ? { ...l, sampleStart: onsetSeconds } : l)),
      };
    }),

  updateLayer: (layerId, patch) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
    })),

  removeLayerFile: (layerId) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layerId
          ? {
              ...l,
              file: null,
              fileName: '',
              audioBuffer: null,
              duration: 0,
              sampleStart: 0,
              sampleLength: null,
              // Same reset as loading/replacing a file — only this layer's knobs.
              volume: 0,
              pitch: 0,
              mix: 50,
              pan: 0,
            }
          : l
      ),
    })),

  updateLayerRandomization: (layerId, patch) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layerId ? { ...l, randomization: { ...l.randomization, ...patch } } : l
      ),
    })),

  removeLayer: (layerId) =>
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== layerId),
      selectedLayerId: state.selectedLayerId === layerId ? null : state.selectedLayerId,
    })),

  duplicateLayer: (layerId) =>
    set((state) => {
      const original = state.layers.find((l) => l.id === layerId);
      if (!original) return state;
      const copy: Layer = {
        ...original,
        id: `layer_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        name: `${original.name} copy`,
        seed: generateRandomSeed(),
      };
      const idx = state.layers.findIndex((l) => l.id === layerId);
      const newLayers = [...state.layers];
      newLayers.splice(idx + 1, 0, copy);
      return { layers: newLayers };
    }),

  reorderLayers: (fromIndex, toIndex) =>
    set((state) => {
      const newLayers = [...state.layers];
      const [moved] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, moved);
      return { layers: newLayers };
    }),

  toggleMute: (layerId) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === layerId ? { ...l, muted: !l.muted } : l)),
    })),

  toggleSolo: (layerId) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === layerId ? { ...l, solo: !l.solo } : l)),
    })),

  selectLayer: (layerId) => set({ selectedLayerId: layerId }),
  setFocusedPreview: (id) => set({ focusedPreviewId: id }),

  toggleBulkMode: () =>
    set((state) => ({
      bulkMode: !state.bulkMode,
      bulkLayerIds: state.bulkMode ? [] : state.bulkLayerIds, // clear selection when turning bulk mode off
    })),
  toggleBulkLayer: (id) =>
    set((state) => ({
      bulkLayerIds: state.bulkLayerIds.includes(id)
        ? state.bulkLayerIds.filter((x) => x !== id)
        : [...state.bulkLayerIds, id],
    })),
  clearBulkLayers: () => set({ bulkLayerIds: [] }),
  applyBulkToLayers: (fields, probability) =>
    set((state) => {
      const count = state.bulkLayerIds.length;
      if (count === 0) return state;
      return {
        layers: state.layers.map((l) =>
          state.bulkLayerIds.includes(l.id)
            ? {
                ...l,
                randomization: { ...l.randomization, ...fields },
                ...(probability != null ? { probability } : {}),
              }
            : l
        ),
      };
    }),

  randomizeAllLayerSeeds: () =>
    set((state) => ({
      layers: state.layers.map((l) => ({ ...l, seed: generateRandomSeed() })),
    })),

  unmuteAllLayers: () =>
    set((state) => ({
      layers: state.layers.map((l) => ({ ...l, muted: false, solo: false })),
    })),

  // ── Master / generation settings ───────────────────────────────────
  updateMasterSettings: (patch) => set((state) => ({ masterSettings: { ...state.masterSettings, ...patch } })),
  updateGenerationSettings: (patch) =>
    set((state) => ({ generationSettings: { ...state.generationSettings, ...patch } })),
  setMasterSeed: (seed) => set({ masterSeed: seed }),
  randomizeMasterSeed: () => set({ masterSeed: generateRandomSeed() }),

  // ── Generation ────────────────────────────────────────────────────
  generate: async () => {
    const state = get();
    try {
      assertMainSoundPresent(!!state.mainSound.audioBuffer);
      const activeCount = state.layers.filter((l) => l.enabled && l.audioBuffer).length;
      assertHasActiveLayer(activeCount);
    } catch (err) {
      if (err instanceof AppError) {
        if (err.code === 'NO_ACTIVE_LAYER') {
          get().showToast(err.message, 'info');
        } else {
          get().showToast(err.message, 'error');
          return;
        }
      }
    }

    cancelFlag = { current: false };
    const count = state.generationSettings.variationCount;
    set({ progress: { isGenerating: true, total: count, completed: 0, currentLabel: '준비 중...', cancelled: false, error: null } });

    try {
      const outputs = await renderVariationBatch(
        {
          mainSound: state.mainSound,
          layers: state.layers,
          generationSettings: state.generationSettings,
          masterSettings: state.masterSettings,
          masterSeed: state.masterSeed,
        },
        count,
        (completed, total) => {
          set({ progress: { isGenerating: true, total, completed, currentLabel: `베리에이션 ${completed}/${total} 생성 중`, cancelled: false, error: null } });
        },
        () => cancelFlag.current
      );

      const newResults: VariationResult[] = outputs.map((out, i) => {
        const wavBlob = encodeWav(out.buffer, state.generationSettings.bitDepth);
        const blobUrl = URL.createObjectURL(wavBlob);
        return {
          id: `var_${Date.now()}_${i}_${Math.floor(Math.random() * 1e6)}`,
          index: get().results.length + i + 1,
          name: `Variation ${get().results.length + i + 1}`,
          seed: state.masterSeed,
          favorite: false,
          createdAt: new Date().toISOString(),
          durationSeconds: out.buffer.duration,
          blobUrl,
          wavBlob,
          config: out.config,
        };
      });

      set((s) => ({
        results: [...s.results, ...newResults],
        progress: idleProgress(),
      }));
      get().showToast(`${newResults.length}개의 베리에이션이 생성되었습니다.`, 'success');
    } catch (err) {
      const message = err instanceof AppError ? err.message : '베리에이션 생성 중 오류가 발생했습니다.';
      set({ progress: { ...idleProgress(), error: message } });
      get().showToast(message, 'error');
    }
  },

  cancelGeneration: () => {
    cancelFlag.current = true;
    set((state) => ({ progress: { ...state.progress, cancelled: true, isGenerating: false, currentLabel: '취소됨' } }));
  },

  // ── Results ───────────────────────────────────────────────────────
  toggleFavorite: (id) =>
    set((state) => ({
      results: state.results.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)),
    })),

  renameResult: (id, name) =>
    set((state) => ({
      results: state.results.map((r) => (r.id === id ? { ...r, name } : r)),
    })),

  removeResult: (id) =>
    set((state) => {
      const target = state.results.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.blobUrl);
      return { results: state.results.filter((r) => r.id !== id) };
    }),

  regenerateCard: async (id) => {
    const state = get();
    const target = state.results.find((r) => r.id === id);
    if (!target) return;

    try {
      assertMainSoundPresent(!!state.mainSound.audioBuffer);
    } catch (err) {
      get().showToast(err instanceof AppError ? err.message : '메인 사운드가 없습니다.', 'error');
      return;
    }

    // A fresh random seed, rolled within whatever ranges are currently set
    // in each layer's Randomization panel — only this one card is touched,
    // its position/id/name/favorite status are preserved.
    const newSeed = generateRandomSeed();

    try {
      const out = await renderVariation({
        mainSound: state.mainSound,
        layers: state.layers,
        generationSettings: state.generationSettings,
        masterSettings: state.masterSettings,
        masterSeed: newSeed,
        variationIndex: 0,
      });
      const wavBlob = encodeWav(out.buffer, state.generationSettings.bitDepth);
      const blobUrl = URL.createObjectURL(wavBlob);

      set((s) => ({
        results: s.results.map((r) =>
          r.id === id
            ? {
                ...r,
                seed: newSeed,
                createdAt: new Date().toISOString(),
                durationSeconds: out.buffer.duration,
                blobUrl,
                wavBlob,
                config: out.config,
              }
            : r
        ),
      }));
      URL.revokeObjectURL(target.blobUrl);
      get().showToast(`${target.name} 카드를 새 Seed로 다시 생성했습니다.`, 'success');
    } catch (err) {
      get().showToast(err instanceof AppError ? err.message : '재생성에 실패했습니다.', 'error');
    }
  },

  // ── Project persistence ───────────────────────────────────────────
  exportProjectJson: () => {
    const state = get();
    return {
      projectName: state.projectName,
      masterSeed: state.masterSeed,
      mainSound: {
        fileName: state.mainSound.fileName,
        volume: state.mainSound.volume,
        pitch: state.mainSound.pitch,
        mix: state.mainSound.mix,
        pan: state.mainSound.pan,
        sampleStart: state.mainSound.sampleStart,
        sampleLength: state.mainSound.sampleLength,
      },
      layers: state.layers.map((l) => ({ ...l, file: undefined, audioBuffer: undefined })),
      masterSettings: state.masterSettings,
      generationSettings: state.generationSettings,
      savedAt: new Date().toISOString(),
    };
  },

  saveProjectToLocalStorage: () => {
    try {
      const json = get().exportProjectJson();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json));
      get().showToast('프로젝트가 브라우저에 저장되었습니다.', 'success');
    } catch (err) {
      get().showToast('프로젝트 저장에 실패했습니다 (저장 공간 부족일 수 있습니다).', 'error');
    }
  },

  loadProjectFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        get().showToast('저장된 프로젝트가 없습니다.', 'info');
        return;
      }
      const parsed = JSON.parse(raw);
      set({
        projectName: parsed.projectName ?? 'Untitled Sound Project',
        masterSeed: parsed.masterSeed ?? generateRandomSeed(),
        layers: (parsed.layers ?? []).map((l: Layer) => ({ ...l, file: null, audioBuffer: null })),
        masterSettings: parsed.masterSettings ?? defaultMasterSettings(),
        generationSettings: parsed.generationSettings ?? defaultGenerationSettings(),
      });
      get().showToast('프로젝트를 불러왔습니다. 오디오 파일을 다시 연결해주세요.', 'info');
    } catch (err) {
      get().showToast('프로젝트 불러오기에 실패했습니다.', 'error');
    }
  },

  resetAll: () =>
    set({
      projectName: 'Untitled Sound Project',
      mainSound: createEmptyMainSound(),
      layers: [createEmptyLayer(0), createEmptyLayer(1), createEmptyLayer(2)],
      selectedLayerId: null,
      focusedPreviewId: null,
      masterSettings: defaultMasterSettings(),
      generationSettings: defaultGenerationSettings(),
      masterSeed: generateRandomSeed(),
      progress: idleProgress(),
    }),

  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}));
