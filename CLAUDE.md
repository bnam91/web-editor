# Web Editor — Claude 작업 지침

> 이 파일은 프로젝트 전체에 적용되는 공통 원칙을 담는다.
> 특정 파일/모듈 전용 규칙은 해당 폴더의 CLAUDE.md에 작성한다.

---

## 개발 명령어

```bash
npm run dev          # 개발 서버 (핫리로드 + DevTools, 포트 9334)
npm start            # 프로덕션 실행
npm run build:mac    # macOS 빌드
npm run release:mac  # macOS 배포 (auto-update)
npm run figma        # Figma WebSocket 서버 (포트 3055)
```

---

## 핵심 파일 책임

| 파일 | 책임 |
|------|------|
| `js/editor.js` | 선택·줌·키보드 단축키 |
| `js/block-factory.js` | 모든 블록 생성 (`make*`, `add*`) |
| `js/drag-drop.js` | DnD 조율 (block-drag / section-drag / drag-utils 통합) |
| `js/io/save-load.js` | 직렬화·로드·autoSave (MutationObserver + 1.5s debounce) |
| `js/io/export-figma-json.js` | Figma 업로드용 JSON 빌드 |
| `js/panels/layer-panel.js` | 레이어 패널 트리 렌더링 |
| `js/overlay-handles.js` | 리사이즈·코너반경 핸들 (`#ss-handles-overlay`) |

세부 JS 규칙: `js/CLAUDE.md` 참조

---

## 참고 문서

- 디자인 시스템: `_context/DESIGN_SYSTEM.md`
- 스킬 라우팅: `_context/SKILLS_GUIDE.md`
- 기능 명세·스펙: `docs/` 폴더

> 필요한 작업이 생겼을 때만 열 것. 매 작업마다 전부 읽지 말 것.

| 문서 | 읽어야 할 때 |
|------|------------|
| `docs/DRAG_SPEC.md` | 드래그앤드롭 버그 수정·기능 변경 시 |
| `docs/TEMPLATE_SYSTEM.md` | 템플릿 저장·삽입·브라우저 작업 시 |
| `docs/branch-system.md` | 브랜치 전환·병합·커밋 관련 작업 시 |
| `docs/project-storage.md` | 프로젝트 저장 구조 변경·디버깅 시 |
| `docs/goditor-api-reference.md` | CDP로 블록 생성·자동화 스크립트 작성 시 (32KB — 필요한 함수만 검색) |
| `docs/LEFT_PANEL_LAYER.md` | 레이어 패널 수정 시 |
| `docs/RIGHT_PANEL_PROPS.md` | 프로퍼티 패널 수정 시 |

---

## 자동 검증 (훅)

- JS 파일 저장 시 `node --check` 자동 실행
- 문법 오류 있으면 저장 차단됨 → 오류 수정 후 재시도

---

## 작업 완료 후 QA 루틴

**YOU MUST**: 요청한 작업이 끝나면 반드시 아래 루틴을 수행한다. 코드 수정 후 CDP QA 없이 "완료"를 보고하는 것은 금지.

### 포트 맵

| 스크립트 | 포트 |
|---|---|
| `npm run dev` | 9334 (메인) |
| `npm run dev:step2` | 9335 |
| `npm run dev:planning` | 9336 |
| `npm run dev:ui-polish` | 9337 |
| `npm run dev:design-token` | 9338 |
| `npm run dev:template-tag` | 9339 |

**접속 판단 기준:**
1. `chrome-devtools` MCP는 **9334 고정** — 별도 지시 없으면 항상 이쪽 사용
2. 사용자가 특정 포트/브랜치를 언급한 경우 해당 포트 사용
3. 어느 포트가 실행 중인지 모를 때 → `chrome-devtools` MCP `list_pages`로 먼저 확인

### QA 루프

1. 작업 완료
2. **CDP로 해당 포트에 접속해 직접 QA** (스크린샷, JS 실행, 콘솔 오류 확인 등)
3. 이상 발견 시 → 코드 수정 → 재QA
4. 통과하면 결과 보고 (무엇을 확인했는지 반드시 포함)

---

## 블록 선택 스타일 (변경 금지)

### 원칙
- **Hover**: `::after` pseudo-element로 배경 tint만 표시 (GitHub row-highlight 스타일)
- **Selected**: `outline: 2px solid var(--sel-color); outline-offset: 0` — 요소 경계에 딱 붙임 (Figma 스타일)
- **배경 fill 없음**: selected 상태에서는 배경색 변화 없이 outline만 표시

### 절대 하지 말 것
- `.selected` 규칙에 `outline-offset` 값을 양수(outer gap)나 음수(inner)로 바꾸지 말 것
- `.text-block`에 `border-radius` 추가하지 말 것
- `box-shadow: 0 0 0 2px` 방식으로 돌아가지 말 것 (overflow:hidden 간섭 위험)
- selected 상태에 `background` 추가하지 말 것

### 적용된 블록 목록
`section-block`, `text-block`, `label-group-block`, `label-item`, `asset-block`,
`overlay-tb`, `gap-block`, `table-block`, `graph-block`, `card-block`,
`strip-banner-block`, `divider-block`, `frame-block` — 모두 `outline-offset: 0` 통일

---

## speech-bubble-block 선택 outline (변경 금지)

일반 블록과 구조가 달라 `frame-block::after` z-index:10 방식을 사용한다.

```css
/* 선택 시 frame-block에 ::after로 outline 오버레이 */
.frame-block[data-text-frame="true"]:has(.speech-bubble-block.selected)::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--sel-color);
  z-index: 10;
  pointer-events: none;
  box-sizing: border-box;
}
.speech-bubble-block.selected { outline: none !important; }
```

```css
/* 정렬은 tb-bubble margin으로 처리 */
.speech-bubble-block { width: 100%; }
.speech-bubble-block[data-tail="right"]  .tb-bubble { margin-left: auto; }
.speech-bubble-block[data-tail="center"] .tb-bubble { margin-left: auto; margin-right: auto; }
.tb-bubble { display: block; width: fit-content; max-width: 80%; }
```

**이 패턴으로 돌아가지 말 것**: `width: fit-content`, `outline` 직접 적용, `z-index` 제거

---

## 블록 구조 원칙 (변경 금지)

### 프레임 블록 = Figma Frame

`frame-block`은 피그마 Frame과 동일한 개념. 자식 블록들의 컨테이너 역할.

### 텍스트·쉐이프 블록 — 단일 최소 단위

하위 레이어 열람 불가, 내부에 다른 요소 추가 불가한 최소 단위.

| 블록 | DOM 구조 | 규칙 |
|------|---------|------|
| 텍스트 | `frame-block[data-text-frame] > text-block` | text-frame은 투명 래퍼 |
| 쉐이프 | `frame-block > shape-block` | shape-frame은 투명 래퍼 |

- **너비 항상 동일**: `frame-block`(래퍼)과 내부 블록은 항상 같은 너비
- **한몸 이동**: DnD 시 래퍼와 콘텐츠는 반드시 함께 이동. 절대 분리 금지

### text-block 실제 구조

```html
div.text-block
  └─ div.tb-h1 (또는 tb-h2, tb-body, tb-caption, tb-label) [contenteditable]
```

### 레이어 패널 text-frame 투명 처리 — 전 레벨 적용

text-frame은 레이어 패널에서 **보이지 않아야** 한다. 내부 text-block을 직접 렌더링.

- `layer-panel.js` 섹션 루프: 적용됨
- `layer-panel-items.js > makeLayerFrameItem` 프레임 내부 루프: **반드시 동일하게 적용**
- **금지**: `makeLayerFrameItem` 내 자식 루프에서 `data-text-frame` 체크 누락 → "Frame + Text" 두 겹 표시됨

### text-frame CSS·인터랙션 규칙 (변경 금지)

text-frame은 **절대 `.selected` 클래스를 받지 않는다.**

```css
/* 올바름 — text-frame 제외 */
.frame-block:not(.selected):not([data-text-frame]) * { pointer-events: none; }

/* 금지 — text-block까지 pointer-events 차단됨 */
.frame-block:not(.selected) * { pointer-events: none; }
```

**`prop-text.js`**: width / X / Y 조작 시 `tb.closest('.frame-block[data-text-frame="true"]')` 로 text-frame 취득 후 수정. text-block 직접 style 수정 금지.

**drag-drop 세부 규칙**: `js/CLAUDE.md` 참조

### 에셋 블록 — 더블클릭 업로드

- **싱글 클릭**: 선택 전용
- **더블 클릭**: 이미지 업로드 파일 피커 (빈 블록) / 이미지 편집 모드 (이미지 있을 때)

---

## DOM 계층 구조 (현재)

```
section-block
  └─ section-inner
       ├─ frame-block[data-text-frame]   ← 텍스트 블록 투명 래퍼
       │    └─ text-block
       ├─ asset-block
       ├─ frame-block                    ← 프레임 블록 (Auto/Free layout)
       │    ├─ frame-block[data-text-frame] > text-block
       │    ├─ asset-block / gap-block / ...
       │    └─ frame-block               ← 중첩 프레임 가능
       └─ ...
```

- `data-free-layout="true"` → freeLayout (절대 위치 배치)
- `data-full-width="true"` → 전체 너비 플로우
- `data-text-frame="true"` → 텍스트 전용 투명 래퍼

---

## 코너 반경 핸들 시스템

`#ss-handles-overlay` (position:fixed, z-index:9990) 공유.

### frame-block 핸들
- **리사이즈**: `.ss-resize-handle` × 4 (nw/ne/sw/se)
- **코너 반경**: `.ss-radius-handle` × 4, 프레임 내부 10px 안쪽
  - `showFrameHandles(ss)` → 두 세트 동시 생성
  - `hideFrameHandles()` → `.ss-resize-handle`, `.ss-radius-handle` 제거 (asset 핸들 유지)

### asset-block 핸들
- **코너 반경**: `.asset-radius-handle` × 4, 블록 내부 10px 안쪽
  - `showAssetRadiusHandles(ab)` — 에셋 클릭 시 자동 호출
  - `hideAssetRadiusHandles()` — `deselectAll`에서 자동 해제

### 핸들 독립성 규칙
- `hideFrameHandles()`는 frame 핸들만 제거, asset 핸들 유지
- `hideAssetRadiusHandles()`는 asset 핸들만 제거, frame 핸들 유지
