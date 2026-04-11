# Web Editor — Claude 작업 지침

> 이 파일은 프로젝트 전체에 적용되는 공통 원칙을 담는다.
> 특정 파일/모듈 전용 규칙은 해당 폴더의 CLAUDE.md에 작성한다.

## 참고 문서
- 디자인 시스템 규칙: `_context/DESIGN_SYSTEM.md` 참고

---

## 자동 검증 (훅)
- JS 파일 저장 시 `node --check` 자동 실행
- 문법 오류 있으면 저장 차단됨 → 오류 수정 후 재시도

---

## 작업 완료 후 QA 루틴

요청한 작업이 끝나면 반드시 아래 루틴을 수행한다.

### 포트 맵
| 스크립트 | 포트 |
|---|---|
| `npm run dev` | 9334 (메인) |
| `npm run dev:step2` | 9335 |
| `npm run dev:planning` | 9336 |
| `npm run dev:ui-polish` | 9337 |
| `npm run dev:design-token` | 9338 |
| `npm run dev:template-tag` | 9339 |

현재 실행 중인 포트는 MCP `chrome-devtools`(9334 고정) 또는 열려있는 포트로 접속한다.

### QA 루프
1. 작업 완료
2. CDP로 해당 포트에 접속해 직접 QA (스크린샷, JS 실행, 콘솔 오류 확인 등)
3. 이상 발견 시 → 코드 수정 → 재QA
4. 통과하면 결과 보고 (무엇을 확인했는지 포함)

---

## 스킬 라우팅

모든 스킬은 상페마법사 웹에디터 전용이다.
**가볍고 빠른 작업 → 단독 스킬 / 전문팀이 필요한 깊은 작업 → 스쿼드**

### 단독 스킬 (일상적·즉각 실행)
| 상황 | 스킬 |
|---|---|
| 버그 찾아서 즉시 수정 (Notion 디버깅 DB 기반) | `/webeditor-debug` |
| Notion QA DB 체크리스트 순차 검수 | `/webeditor-qa-checker` |
| 블록 생성·CDP 단위 테스트 | `/webeditor-block-tester` |
| 코드 수정 후 스모크 테스트 (회귀 확인) | `/webeditor-regression-guard` |

### 스쿼드 투입 (전문팀·병렬 에이전트)
| 상황 | 스킬 |
|---|---|
| 대규모·복잡한 버그 (10개 에이전트 병렬) | `/debug-squad` |
| 유저 시나리오 기반 사용성 검증 | `/qa-squad` |
| 비주얼 일관성·컬러·타이포 감사 | `/design-squad` |
| 사용자 흐름·인터랙션·정보구조 개선 | `/ux-squad` |
| FPS·메모리·로딩 성능 측정 및 병목 분석 | `/performance-squad` |
| 코드 중복 제거·모듈화·가독성 개선 | `/refactor-squad` |
| 빌드·버전 태깅·자동업데이트 배포 | `/release-squad` |
| 브랜치 충돌 해소·PR 생성·병합 관리 | `/merge-manager-squad` |
| 피그마·경쟁사 벤치마킹 기반 기능 발굴 | `/feature-scout-squad` |
| 아이디어 한 줄 → 시나리오·스펙 구체화 | `/idea-lab-squad` |

### 오케스트레이터
| 상황 | 스킬 |
|---|---|
| 복합 멀티태스크 (팀 자동 조립) | `/harness-manager` |

---

## 블록 선택 스타일 (변경 금지)

블록 hover/selected 시각 스타일은 아래 설계를 유지해야 한다. 임의로 바꾸지 말 것.

### 원칙
- **Hover**: `::after` pseudo-element로 배경 tint만 표시 (GitHub row-highlight 스타일)
- **Selected**: `outline: 2px solid var(--sel-color); outline-offset: 0` — 요소 경계에 딱 붙임 (Figma 스타일)
- **배경 fill 없음**: selected 상태에서는 배경색 변화 없이 outline만 표시

### 절대 하지 말 것
- `.selected` 규칙에 `outline-offset` 값을 양수(outer gap)나 음수(inner)로 바꾸지 말 것
- `.text-block`에 `border-radius` 추가하지 말 것 (텍스트 블록은 직사각형이어야 함)
- `box-shadow: 0 0 0 2px` 방식으로 돌아가지 말 것 (overflow:hidden 간섭 위험)
- selected 상태에 `background` 추가하지 말 것

### 적용된 블록 목록
`section-block`, `text-block`, `label-group-block`, `label-item`, `asset-block`,
`overlay-tb`, `gap-block`, `table-block`, `graph-block`, `card-block`,
`strip-banner-block`, `divider-block`, `frame-block` — 모두 `outline-offset: 0` 통일

---

## 블록 구조 원칙 (변경 금지)

### 프레임 블록 = Figma Frame

`frame-block`은 피그마 Frame과 동일한 개념이다. 자식 블록들의 컨테이너 역할을 한다.

### 텍스트·쉐이프 블록 — 단일 최소 단위

텍스트 블록과 쉐이프 블록은 **하위 레이어 열람 불가, 내부에 다른 요소 추가 불가**한 최소 단위다.

| 블록 | 실제 DOM 구조 | 규칙 |
|------|-------------|------|
| 텍스트 | `frame-block[data-text-frame] > text-block` | text-frame은 투명 래퍼. 하위 트리 없음. |
| 쉐이프 | `frame-block > shape-block` | shape-frame은 투명 래퍼. 하위 트리 없음. |

- **너비 항상 동일**: `frame-block`(래퍼)과 `text-block`/`shape-block`(콘텐츠)은 항상 같은 너비. 별도로 제어하지 말 것.
- **한몸 이동**: DnD 시 래퍼와 콘텐츠는 반드시 함께 이동해야 한다. 절대 분리 금지.

### text-block 실제 구조

```html
div.text-block
  └─ div.tb-h1 (또는 tb-h2, tb-body, tb-caption, tb-label) [contenteditable]
```

타입에 관계없이 항상 이 두 겹. 추가 위치(섹션/프레임)가 달라도 text-block 자체 구조는 동일.

### text-frame 래퍼가 필요한 경우

| 위치 | text-frame 필요 여부 | 이유 |
|------|---------------------|------|
| freeLayout 프레임 안 | ✅ 필수 | `position:absolute + top/left` 를 text-frame이 보유 |
| 섹션 직속 / fullWidth 프레임 안 | 구조 통일 목적 | flow 배치라 위치 속성 불필요, 일관성을 위해 유지 |

### 레이어 패널 text-frame 투명 처리 — 전 레벨 적용

text-frame은 레이어 패널에서 **보이지 않아야** 한다. 내부 text-block을 직접 렌더링한다.
이 규칙은 **섹션 직속 자식과 프레임 내부 자식 모두에** 적용해야 한다.

- `layer-panel.js` 섹션 루프: 적용됨
- `layer-panel-items.js > makeLayerFrameItem` 프레임 내부 루프: **반드시 동일하게 적용**

#### 절대 하지 말 것
- `makeLayerFrameItem` 내부 자식 루프에서 `frame-block`을 만날 때 `data-text-frame` 체크 누락 금지
  → 누락 시 프레임 안 텍스트가 레이어 패널에 "Frame + Text" 두 겹으로 표시됨

### text-frame CSS·인터랙션 규칙 (변경 금지)

text-frame(`frame-block[data-text-frame]`)은 **절대 `.selected` 클래스를 받지 않는다.**
선택 상태는 항상 freeLayout 부모 `frame-block`이 보유한다.

#### CSS pointer-events 차단 규칙
```css
/* 올바름 — text-frame 제외 */
.frame-block:not(.selected):not([data-text-frame]) * { pointer-events: none; }

/* 금지 — text-frame이 selected 없어서 text-block까지 차단됨 */
.frame-block:not(.selected) * { pointer-events: none; }
```

#### prop-text.js
- width / X / Y 조작 시 `tb.closest('.frame-block[data-text-frame="true"]')` 로 text-frame 취득 후 수정
- text-block 직접 style 수정 금지 (position, width 등)

#### drag-drop.js — absolute 요소 draggable 규칙

- **absolute 요소(text-frame, shape-block 등)는 HTML5 drag 완전 비활성화**: `draggable` 속성 미설정 + `removeAttribute`
  → `draggable="true"` 설정 시 HTML5 dragstart가 발동해 `.dragging` 클래스가 붙어 opacity:0.25 적용됨
  → 기존 저장 HTML에 `draggable="true"`가 남아있을 수 있으므로 rebind 시 명시적 `removeAttribute('draggable')` 필요
  → 판단 조건: `dragTarget.style.position !== 'absolute' && block.style.position !== 'absolute'` 일 때만 `draggable="true"` 설정
- dragstart 차단 조건: `block.style.position === 'absolute' || dragTarget.style.position === 'absolute'` 양쪽 모두 포함
- 드래그 허용 조건: text-block 미선택이어도 freeLayout 부모 frame이 `.selected`이면 드래그 허용

#### 섹션 → freeLayout 드롭 시 draggable 잔류 버그 (2026-04-08 확인)

**현상**: 섹션에서 freeLayout으로 text-frame을 드롭 후, 다음 드래그 시 `.dragging` 클래스 → 연회색 고착

**원인 체인**:
1. 섹션에 text-block 추가 → `bindBlock`에서 `tf.style.position === ''` → `draggable="true"` 설정
2. freeLayout 드롭 핸들러에서 `position:absolute` 전환 후 draggable 제거 누락
3. `_dragBound = true` 플래그 때문에 `bindBlock` 재호출 시 draggable 업데이트 건너뜀

**수정 위치**: `drag-drop.js` — freeLayout drop 핸들러 내 text-frame 처리 블록
```js
dragSrc.removeAttribute('draggable');
dragSrc._dragBound = false;    // 재바인딩 허용
inner.appendChild(dragSrc);
const _tb = dragSrc.querySelector('.text-block');
if (_tb) { _tb._blockBound = false; bindBlock(_tb); }
```

**절대 하지 말 것**: text-frame을 freeLayout에 추가한 후 `draggable` 속성을 "그대로 유지"하는 주석 복원 금지

#### drag-drop.js — 드롭 인디케이터 위치 저장 규칙

드롭 인디케이터(`.drop-indicator`)를 기준으로 삽입 위치를 결정할 때, `onUp`에서 indicator를 DOM으로 다시 찾으면 이미 제거된 후일 수 있다.

**올바른 패턴**: `onMove`에서 삽입 기준 element를 closure 변수에 직접 저장.
```js
// onMove에서 저장
let _dropInsertBefore = null;
_dropInsertBefore = getDragAfterElement(inner, ev.clientY) || null;

// onUp에서 사용 (clearDropIndicators() 호출 후에도 유효)
const ref = _dropInsertBefore && _dropInsertBefore.parentNode === inner ? _dropInsertBefore : null;
if (ref) inner.insertBefore(dragEl, ref);
else     inner.appendChild(dragEl);
```

**절대 하지 말 것**: `indicator.nextSibling`을 onUp에서 저장하거나 `inner.querySelector('.drop-indicator')`를 `clearDropIndicators()` 이후에 호출하는 것.

#### 스마트 가이드 (`js/smart-guides.js`)

- `SNAP_THRESHOLD = 10px` — 이 범위 내 접근 시 정렬 위치로 자석 스냅
- `GUIDE_THRESHOLD = 12px` — 이 범위 내 접근 시 빨간 가이드선 표시
- `showGuides(dragEl, parentFrame, scale)` 는 반드시 **`dragEl.style.left/top` 업데이트 후** 호출할 것
  → 이전 위치 기준으로 가이드가 그려지는 버그 방지
- 가이드선은 `#ss-handles-overlay` (position:fixed)에 렌더링 — viewport 좌표 사용
- `hideGuides()` 는 mouseup에서 호출

### 에셋 블록 — 더블클릭 업로드

- **싱글 클릭**: 선택 전용. 선택 후 드래그로 이동 가능.
- **더블 클릭**: 이미지 업로드 파일 피커 열기 (빈 블록) / 이미지 편집 모드 진입 (이미지 있을 때).
- 프로퍼티 패널에서 너비·높이·모서리 조절 가능. 선택 시 4코너 핸들로 드래그 리사이즈 가능.
- **코너 반경 핸들**: 선택 시 `#ss-handles-overlay`에 `.asset-radius-handle` 4개 표시 (내부 코너 10px 안쪽). 드래그로 `border-radius` 실시간 조절, `asset-r-slider` 패널 동기화. `showAssetRadiusHandles(ab)` / `hideAssetRadiusHandles()` — `deselectAll`에서 자동 해제.

---

## DOM 계층 구조 (현재)

Col 개념이 제거된 후의 DOM 구조:

```
section-block
  └─ section-inner
       ├─ frame-block[data-text-frame]   ← 텍스트 블록 투명 래퍼 (자동 생성)
       │    └─ text-block
       ├─ asset-block
       ├─ frame-block                    ← 프레임 블록 (Auto/Free layout)
       │    ├─ frame-block[data-text-frame] > text-block
       │    ├─ asset-block / gap-block / ...
       │    └─ frame-block               ← 중첩 프레임 가능
       └─ ...
```
> `frame-inner` 별도 래퍼 없음 — 자식 요소가 `.frame-block`에 직접 들어간다.

**text-frame**: 모든 텍스트 블록은 `frame-block[data-text-frame="true"]`로 자동 래핑됩니다.
- 레이어 패널: text-frame은 투명 처리, text-block이 직접 표시
- 클릭 선택: text-frame 클릭 시 즉시 text-block 선택
- CDP 코드에서는 `window.addTextBlock(style, opts)` 호출만 하면 됨 (frame 래핑은 자동)

**frame-block**: 기존 `sub-section-block`의 새 이름. Auto/Free layout 모두 지원.
- `data-free-layout="true"` → freeLayout (절대 위치 배치)
- `data-full-width="true"` → 전체 너비 플로우
- `data-text-frame="true"` → 텍스트 전용 투명 래퍼

---

## 코너 반경 핸들 시스템

`#ss-handles-overlay` (position:fixed, z-index:9990)를 공유하는 Figma 스타일 캔버스 핸들.

### frame-block 핸들
- **리사이즈 핸들**: `.ss-resize-handle` × 4 (nw/ne/sw/se), 프레임 외부 코너에 위치
- **코너 반경 핸들**: `.ss-radius-handle` × 4 (nw/ne/sw/se), 프레임 내부 10px 안쪽
  - 드래그 → `dataset.radius` + `style.borderRadius` 동기화, `ss-radius-slider` 패널 연동
  - `showFrameHandles(ss)` 호출 시 두 세트 동시 생성
  - `hideFrameHandles()` → `.ss-resize-handle`, `.ss-radius-handle` 선택 제거 (asset 핸들 유지)

### asset-block 핸들
- **코너 반경 핸들**: `.asset-radius-handle` × 4 (nw/ne/sw/se), 블록 내부 10px 안쪽
  - 드래그 → `style.borderRadius`, `asset-r-slider` / `asset-r-number` 패널 연동
  - `showAssetRadiusHandles(ab)` — 에셋 클릭 핸들러에서 자동 호출
  - `hideAssetRadiusHandles()` — `deselectAll`에서 자동 해제
  - `img-corner-handle` (리사이즈용)과 완전히 독립적으로 동작

### 핸들 독립성 규칙
- `hideFrameHandles()`는 frame 관련 핸들만 제거, asset 핸들 유지
- `hideAssetRadiusHandles()`는 asset 관련 핸들만 제거, frame 핸들 유지
- 두 시스템이 동시에 overlay에 공존 가능 (다른 클래스 사용)
