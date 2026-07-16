export const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
];

export const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.m4a'];

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB safety cap

export function isSupportedAudioFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const extOk = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (extOk) return true;
  return SUPPORTED_AUDIO_TYPES.includes(file.type);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00.0';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

/** Detect duplicate uploads by name + size, since we can't hash contents cheaply. */
export function isDuplicateFile(file: File, existing: Array<{ file: File | null }>): boolean {
  return existing.some((e) => e.file && e.file.name === file.name && e.file.size === file.size);
}
