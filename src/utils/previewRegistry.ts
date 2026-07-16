// Each MainSoundUploader/LayerCard registers its own play/stop toggle here,
// keyed by 'main' or the layer's id. This lets a single global keyboard
// shortcut (Space) trigger playback for whichever one is currently selected,
// without lifting all the preview-playback state/logic out of those
// components and into the store.

type PreviewHandle = {
  toggle: () => void;
};

const registry = new Map<string, PreviewHandle>();

/** Call from a useEffect; returns the cleanup function. */
export function registerPreviewHandle(id: string, handle: PreviewHandle): () => void {
  registry.set(id, handle);
  return () => {
    if (registry.get(id) === handle) {
      registry.delete(id);
    }
  };
}

export function togglePreview(id: string): void {
  registry.get(id)?.toggle();
}
