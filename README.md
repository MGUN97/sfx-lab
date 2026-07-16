# SFX Lab — Variator

메인 오디오 샘플에 여러 개의 통제 조건(레이어) 샘플을 레이어링하고, 각 레이어의 볼륨 / 피치 / Mix / Pan / 확률과
랜덤 범위를 설정해 Generate를 누를 때마다 서로 다른 사운드 베리에이션을 만드는 브라우저 기반 사운드 디자인 툴입니다.
AI가 소리를 합성하지 않고, 업로드한 샘플들을 Web Audio API로 실제로 믹싱·랜덤 변형합니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속. 프로덕션 빌드는 `npm run build`.

## 사용 흐름

1. **Main Sound** 패널에 메인 오디오 파일을 업로드합니다 (WAV/MP3/OGG/M4A).
2. **Control Layers**에 타격음, 노이즈, 질감 등 보조 샘플을 추가합니다 (기본 3슬롯, `+ Add Layer`로 추가).
3. 각 레이어 카드에서 Volume / Pitch / Mix / Pan을 조절하고, 카드를 클릭하면 오른쪽 **Layer Detail** 패널에서
   해당 항목별 랜덤 범위(min~max)와 On/Off, Probability(적용 확률)를 설정할 수 있습니다.
4. **Master** 패널에서 전체 Volume/Pitch/Dry-Wet, Normalize/Limiter/Compressor, Master Seed를 설정합니다.
5. **Generation Settings**에서 베리에이션 개수, 출력 길이, 샘플레이트/비트뎁스/채널, Fade 등을 지정한 뒤
   `Preview` / `Random Preview`로 미리 들어보고 `Generate Variations`를 눌러 실제 렌더링합니다.
6. 결과는 **Results** 패널에 카드로 나열되며, 개별 WAV 다운로드, 설정 JSON 확인/다운로드, 동일/새 Seed로 재생성,
   즐겨찾기, 이름 변경, 삭제, 전체 ZIP 다운로드를 지원합니다.

## 핵심 개념: Volume vs Mix

- **Volume**: 샘플 자체의 게인(dB). 소스가 얼마나 큰 소리인지.
- **Mix**: 최종 결과물에서 해당 레이어가 얼마나 강하게 반영되는지(0~100%). 0%면 사실상 무음.
- 최종 게인 = `dbToGain(Volume) * (Mix / 100)` (자세한 내용은 `src/audio/mixer.ts`).

## 시드 기반 재현성

`src/utils/seedRandom.ts`의 `mulberry32` PRNG와 `combineSeed(masterSeed, variationIndex, layerId)`를 사용해
Math.random()에 의존하지 않고, 같은 Master Seed + 같은 설정이면 항상 동일한 베리에이션을 재현할 수 있습니다.
각 레이어는 별도의 Randomization Seed를 가질 수도 있습니다.

## 구현 단계 (요청서 18항 기준)

- ✅ 1단계: 업로드, 메인 사운드, 레이어 추가/삭제, Volume/Pitch/Mix, 실시간 프리뷰
- ✅ 2단계: 랜덤 범위, Probability, Seed 기반 랜덤, 다중 베리에이션 생성
- ✅ 3단계: OfflineAudioContext 렌더링, WAV 다운로드, 결과 목록, ZIP 다운로드
- 🚧 4단계: 프로젝트 JSON 저장/불러오기 + LocalStorage 자동 저장은 구현되어 있으나,
  IndexedDB에 오디오 Blob까지 저장하는 기능과 고급 마스터 이펙트(EQ, 리버브 등)는 다음 버전 과제로 남겨두었습니다.

## WAV 인코딩 디더링

16비트 인코딩이 반올림 없이 그냥 잘라내던(truncate) 결함을 고쳤습니다. 이제 16비트/24비트 모두 TPDF(삼각분포)
디더를 더한 뒤 반올림해서 양자화합니다(`src/audio/wavEncoder.ts`). 조용한 구간, 페이드 아웃 꼬리처럼 레벨이
낮은 부분에서 거친 양자화 잡음 대신 훨씬 부드러운 노이즈로 남아, DAW 익스포트와 동일한 방식입니다.

## 설치형 앱(PWA)으로 쓰기

이제 이 프로젝트는 PWA(Progressive Web App)로도 설치할 수 있습니다 (`vite-plugin-pwa`).

```bash
npm run build
npm run preview
```

`npm run preview`가 띄워주는 주소(`http://localhost:4173` 등)를 크롬/엣지로 열면, 주소창 오른쪽에 설치 아이콘이
뜹니다. 설치하면 브라우저 주소창 없이 독립된 창으로 실행되고, 바탕화면/시작메뉴/독에 아이콘도 생기며, 오프라인
에서도 열립니다(서버 통신이 원래 없는 앱이라 오프라인이어도 기능에 제약이 없습니다).

`npm run dev`로 개발 중에도 서비스워커가 등록되도록 설정해뒀지만(`devOptions.enabled: true`), 정식으로 테스트할
땐 `npm run build && npm run preview`를 권장합니다.

### 나중에 Tauri나 Electron으로 확장하려면

PWA는 순수 추가 설정(매니페스트 + 서비스워커)이라 기존 빌드 결과물(`npm run build`가 만드는 `dist/` 폴더)에는
전혀 손을 안 댑니다. Tauri나 Electron도 결국 이 `dist/` 폴더를 그대로 감싸서 네이티브 창으로 띄우는 방식이라,
지금 PWA 설정이 있다고 나중에 Tauri/Electron 추가하는 데 방해가 되지 않습니다 — 언제든 추가로 얹을 수 있어요.

## ON / MUTE / SOLO

- 렌더링(Generate/Preview) 단계에서 셋 다 정상 반영됩니다: `layer.enabled && !layer.muted && soloGate && ...`
  (`src/audio/randomizer.ts`). Solo가 하나라도 켜지면 나머지 비솔로 레이어는 자동 제외되고, Mute가 Solo보다
  우선합니다.
- ON/OFF와 MUTE는 렌더링 결과상 동일하게 동작하지만(둘 다 해당 레이어를 결과물에서 제외), DAW에 익숙한
  사용자를 위해 의도적으로 둘 다 유지하고 있습니다.
- 레이어 카드의 ▶ 프리뷰 버튼은 이제 **MUTE 상태를 존중**합니다 — 뮤트된 레이어는 프리뷰도 재생되지 않고,
  재생 중에 MUTE를 누르면 즉시 정지됩니다.

## Start Offset도 숫자 대신 드래그로

Sample Start/Length은 레이어 자체 파형에서 드래그로 잡을 수 있는데, Start Offset은 "메인 사운드 전체
타임라인에서 이 레이어가 언제 시작하는지"라 좌표계가 달라서 숫자 입력만 있었습니다. `OffsetTimeline.tsx`를
추가해서, Layer Detail의 Start Offset 아래에 메인 사운드 길이를 기준으로 한 미니 타임라인이 나오고, 그 위의
색깔 블록(이 레이어의 클립)을 드래그하거나 빈 곳을 클릭해서 위치를 바로 잡을 수 있습니다.

## 여러 레이어에 랜덤화 값 일괄 적용

레이어가 많아질수록 하나하나 Layer Detail을 열어서 같은 값을 반복 입력하는 게 번거로워서, **일괄 설정** 모드를
추가했습니다 (`BulkRandomizationPanel.tsx`, 스토어의 `bulkMode`/`bulkLayerIds`/`applyBulkToLayers`).

- Control Layers 상단의 **일괄 설정** 버튼을 누르면 각 레이어 카드에 체크박스가 생겨요.
- 레이어를 여러 개 체크하면, 오른쪽 LAYER DETAIL이 **BULK 모드**로 바뀌면서 같은 랜덤화 입력 폼이 하나 나와요.
- 각 항목(Volume/Pitch/Mix/Pan/Start Offset/Sample Start/Sample Length/Repeat/Probability) 옆의 `✓` 체크를
  켠 항목만 실제로 적용돼요 — 체크 안 한 항목은 각 레이어의 기존 설정이 그대로 유지됩니다.
- **선택된 N개 레이어에 적용** 버튼을 누르면 체크된 항목만 선택된 모든 레이어에 한 번에 덮어써집니다.

## 키보드 단축키

- **Space**: 마우스로 Main Sound나 특정 레이어의 **파형을 클릭해서 포커스한 뒤**, Space를 누르면 그것만
  재생/정지됩니다 (`focusedPreviewId`, `src/utils/previewRegistry.ts`). 레이어 카드를 클릭해 Layer Detail을
  여는 일반 선택(`selectedLayerId`)과는 별개 상태라, 아무 파형도 클릭한 적이 없으면 Space는 아무 동작도
  하지 않습니다. 입력창/버튼에 포커스가 가 있을 때는 기본 동작(타이핑, 버튼 클릭)과 겹치지 않도록 무시됩니다.

## 레이어 순서 변경(드래그) vs 파형 구간 드래그 충돌 수정

이전에는 레이어 카드 전체가 `draggable`이라, 파형 위에서 구간을 드래그하려고 하면 브라우저의 **네이티브
드래그(카드 전체가 반투명 이미지로 커서를 따라다니는 것)**가 먼저 반응해서 파형 드래그 선택이 제대로 안 되는
문제가 있었습니다. Main Sound는 애초에 드래그 정렬 기능이 없어서 이 문제가 없었어요.

이제 레이어 카드는 **`⠿` 손잡이를 마우스로 누른 상태에서만** `draggable`이 켜지도록 바꿨습니다
(`reorderArmed` 상태). 그 외 영역(특히 파형)에서 드래그하면 네이티브 드래그가 전혀 개입하지 않고, Cubase
같은 DAW의 기본 파형 편집처럼 커서를 파형 위에서 바로 드래그해 Sample Start/Length 구간을 지정할 수 있습니다.

## Sample Start / Length을 파형에서 직접 드래그로 지정

**Main Sound와 레이어 카드 둘 다** 파형(`Waveform.tsx`)이 드래그 가능한 구간 선택기예요.

- 빈 곳을 드래그하면 새 구간을 그릴 수 있고, 구간 가장자리를 잡고 끌면 시작/끝을 각각 조절, 구간 안쪽을
  잡고 끌면 길이를 유지한 채 통째로 이동해요.
- 그냥 한 번 클릭만 하면(드래그 없이) 그 지점을 Sample Start로 옮기고 끝까지 재생하도록 설정돼요.
- 오른쪽 끝까지 드래그하면 "고정 길이"가 아니라 다시 "끝까지 재생"(`sampleLength: null`) 상태로 자동 전환돼요.
- 파형 아래 `전체 사용` 버튼으로 언제든 Sample Start 0 / 전체 길이로 초기화할 수 있어요.

## 긴 소스 파일에 대한 처리량 안전장치

레이어가 몇 분짜리 긴 파일이고 Sample Length를 따로 지정하지 않았다면, `audioRenderer.ts`가 실제로 결과물에서
들릴 수 있는 최대 길이(`출력 길이 − 그 레이어의 Start Offset`)만큼만 잘라서 피치 시프트 연산에 넘깁니다.
사용자가 직접 지정한 Sample Length가 이 값보다 짧으면 그 값을 그대로 존중합니다. 이 덕분에 몇 분짜리 파일을
레이어로 올려도 몇 초짜리 처리만 실제로 발생해서 브라우저가 느려지거나 멈추는 걸 방지합니다.

## 트랜지언트(타격 지점) 자동 정렬

타격음/임팩트음 레이어를 여러 개 겹칠 때, 각 파일의 실제 "탱" 지점이 파일 맨 앞과 조금씩 다르면 `Start Offset`을
아무리 잘 맞춰도 탱 소리가 여러 번 겹쳐 들리는 문제가 생길 수 있습니다 (`src/audio/transientDetect.ts`).

- 레이어에 파일을 올리거나 교체할 때, 짧은 구간 RMS 에너지 엔벨로프 기반으로 첫 번째 뚜렷한 트랜지언트를
  자동 감지해서 `Sample Start`를 그 지점으로 맞춰줍니다 (파일 맨 앞이 아니라 실제 "히트" 지점부터 재생).
  **메인 사운드도 동일하게 적용됩니다** — 메인 사운드 파일 자체에 리드인 침묵이 있어도 그 지점부터 재생되도록
  자동 정렬돼요.
- 레이어 카드와 Main Sound 패널 둘 다 **🎯 Snap to Transient** 버튼으로 언제든 다시 정렬할 수 있습니다.
- 트랜지언트가 뚜렷하지 않은 소스(부드러운 스웰 등)는 신뢰도가 낮다는 안내 토스트가 뜹니다 — 이 경우 수동으로
  `Sample Start`를 조정해주세요.
- Layer Detail의 `Start Offset` 랜덤 범위를 넓게(20ms 이상) 잡으면, 정렬을 해뒀어도 다시 타이밍이 어긋날 수
  있다는 경고 문구가 표시됩니다. 여러 번 때리는 느낌을 의도한 게 아니라면 좁은 범위를 권장합니다.

## 알려진 제한사항

- **메인 사운드 / 레이어 / Master Pitch**: `soundtouchjs`(WSOLA 기반)로 길이를 유지하면서 피치만 바꾸도록 구현되어 있습니다 (`src/audio/pitchShift.ts`). 메인/레이어 Pitch는 스케줄링 전에, Master Pitch는 최종 믹스가 렌더링된 뒤 한 번 더 적용됩니다. 같은 (버퍼, 세미톤) 조합은 캐시되지만, 매 베리에이션마다 랜덤 피치가 달라지는 레이어가 많으면 연산량이 늘어나 생성 속도가 느려질 수 있습니다.
- 프로젝트 저장은 파일명·설정값만 저장합니다(브라우저 보안상 원본 파일을 JSON에 담을 수 없음). 다시 불러오면
  오디오 파일을 직접 재연결해야 합니다. (IndexedDB Blob 저장은 다음 버전 과제)
- Web Worker를 이용한 병렬 렌더링 대신, 취소 가능한 순차 렌더링(큐)으로 브라우저 멈춤을 방지합니다.
- `soundtouchjs`는 공식 TypeScript 타입을 제공하지 않아 `src/types/soundtouchjs.d.ts`에 최소한의 타입을 직접 선언해두었습니다. 설치된 버전의 실제 API(특히 `pitchSemitones` 프로퍼티명)가 다르면 `src/audio/pitchShift.ts`의 방어 코드와 이 타입 선언을 함께 확인해주세요.
