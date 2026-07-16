export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

export function assertMainSoundPresent(hasMainSound: boolean) {
  if (!hasMainSound) {
    throw new AppError(
      'NO_MAIN_SOUND',
      '메인 사운드가 없습니다. Generate를 실행하기 전에 먼저 메인 사운드 파일을 업로드해주세요.'
    );
  }
}

export function assertHasActiveLayer(activeLayerCount: number) {
  if (activeLayerCount === 0) {
    throw new AppError(
      'NO_ACTIVE_LAYER',
      '활성화된 레이어가 없습니다. 메인 사운드만으로도 생성은 가능하지만, 최소 1개 이상의 레이어를 켜는 것을 권장합니다.'
    );
  }
}

/** Ensures min <= max; if reversed, swap and return a note for the caller to surface as a warning. */
export function normalizeRange(min: number, max: number): { min: number; max: number; swapped: boolean } {
  if (min > max) {
    return { min: max, max: min, swapped: true };
  }
  return { min, max, swapped: false };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function friendlyDecodeError(fileName: string): AppError {
  return new AppError(
    'DECODE_FAILED',
    `"${fileName}" 파일을 디코딩하지 못했습니다. 파일이 손상되었거나 지원하지 않는 코덱일 수 있습니다.`
  );
}

export function friendlyUnsupportedTypeError(fileName: string): AppError {
  return new AppError(
    'UNSUPPORTED_TYPE',
    `"${fileName}"은(는) 지원하지 않는 파일 형식입니다. WAV, MP3, OGG, M4A 파일만 업로드할 수 있습니다.`
  );
}

export function friendlyTooLargeError(fileName: string, maxMb: number): AppError {
  return new AppError(
    'FILE_TOO_LARGE',
    `"${fileName}" 파일이 너무 큽니다. ${maxMb}MB 이하의 파일을 사용해주세요.`
  );
}

export function friendlyDuplicateError(fileName: string): AppError {
  return new AppError('DUPLICATE_FILE', `"${fileName}"은(는) 이미 업로드된 파일과 동일합니다.`);
}

export function friendlyMemoryError(): AppError {
  return new AppError(
    'OUT_OF_MEMORY',
    '브라우저 메모리가 부족합니다. 베리에이션 개수를 줄이거나 다른 탭을 닫은 뒤 다시 시도해주세요.'
  );
}

export function friendlyRenderError(detail?: string): AppError {
  return new AppError('RENDER_FAILED', `오디오 렌더링에 실패했습니다.${detail ? ` (${detail})` : ''}`);
}

export function friendlyEncodeError(): AppError {
  return new AppError('ENCODE_FAILED', 'WAV 인코딩에 실패했습니다. 다시 시도해주세요.');
}

export function friendlyCancelledError(): AppError {
  return new AppError('CANCELLED', '생성이 취소되었습니다.');
}
