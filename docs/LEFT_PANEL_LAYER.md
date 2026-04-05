# 좌측 패널 (Left Panel)

> 기능 명세 + 디자인 규칙 체크리스트
> HTML: `index.html` `#project-name-bar`, `#panel-left` / JS: `js/tab-system.js`, `js/layer-panel.js`

---

## 0. 프로젝트 이름 바 `#project-name-bar`

좌측 패널 최상단에 고정 배치. 로고 + 프로젝트명 + 프로젝트 ID로 구성.

```
[★ GOYA DESIGN EDITOR  v0.5.0]   ← #editor-logo
[프로젝트명 (더블클릭 편집)]         ← #project-name-row
proj_1775041043520                ← #project-id-display
```

### 요소 명세

| 요소 | ID | 동작 |
|------|----|------|
| 프로젝트명 | `#project-name-display` | 더블클릭 → `startRenameProject()` 인라인 편집 |
| 이름 입력 | `#project-name-input` | 편집 중에만 표시. Enter/blur → `finishRenameProject()`, Escape → `cancelRenameProject()` |
| 프로젝트 ID | `#project-id-display` | 클릭 시 클립보드 복사 + 토스트 표시 |

### 구현 규칙

- 프로젝트명·ID 업데이트는 `updateProjectNameDisplay()` 단일 함수에서 처리 (`tab-system.js`)
- 탭 전환 시 `renderTabBar()` → `updateProjectNameDisplay()` 자동 호출
- `#project-id-display`는 `#project-name-row` **밖**에 위치 (분리된 줄로 표시)
- 클릭 복사: `navigator.clipboard.writeText(this.textContent)` + `showToast()`

---

# 좌측 패널 — 레이어 섹션 (Layer Panel)

> 기능 명세 + 디자인 규칙 체크리스트
> 파일: `js/layer-panel.js`, `js/layer-panel-items.js`, `css/editor-panels.css`

---

## 1. 구조 개요

```
좌측 패널
└── File 탭
    ├── Pages 섹션       ← 멀티페이지 목록
    └── Layers 섹션      ← 현재 페이지 레이어 트리  ← 이 문서의 범위
```

### 레이어 트리 계층

```
Section (섹션)
├── Frame (프레임)          ← 선택적, 섹션 안에 중첩 프레임
├── Row Group (멀티컬럼)   ← col이 2개 이상일 때 묶음
│   └── Col (컬럼)
│       └── Block (블록)
└── Block (단일컬럼 바로 배치)
```

---

## 2. 블록 타입 & 아이콘

| 블록 타입 | 클래스 | 레이어 아이콘 설명 | 비고 |
|-----------|--------|-------------------|------|
| Section | `.section-block` | `#` (Figma Frame 경로, filled) | `layer-section-icon` |
| Frame | `.sub-section-block` | `#` (동일) | 평면 아이템 (토글/chevron 없음), 일반 Block과 동일 구조 |

> Frame의 `dataset.layerName` 값이 레이어 이름으로 표시됨 (저장/복원 포함). Shape Frame은 도형 타입명이 자동 설정됨.

| Text (h1/h2/h3) | `.text-block` | `H` (serif, bold) | text-anchor:middle |
| Text (body/caption) | `.text-block` | 가로선 3줄 / 2줄 | — |
| Asset (이미지) | `.asset-block` | 사각형 + 산 + 태양 | stroke-width:1 |
| Gap | `.gap-block` | 점선 2줄 | — |
| Label | `.label-group-block` | 둥근 사각형 1개 | — |
| Label Group | `.label-group` | 둥근 사각형 2개 | — |
| Asset-Circle | `.icon-circle-block` | 원 + ★ | — |
| Table | `.table-block` | 격자 | — |
| Divider | `.divider-block` | 가로선 1줄 | — |
| Card | `.card-block` | 사각형 + 하단선 | — |
| Graph | `.graph-block` | 꺾은선 그래프 | — |
| Icon-Text | `.icon-text-block` | 작은 사각형 + 텍스트선 | — |
| Canvas | `.canvas-block` | 격자 점선 분할 | — |
| Row Group | — | 피그마 스타일 Row 아이콘 | `layer-item-icon` |
| Shape (Rectangle) | `.shape-block[data-shape-type="rectangle"]` | 사각형 outline | Frame 안에 포함됨 |
| Shape (Ellipse) | `.shape-block[data-shape-type="ellipse"]` | 정원 outline | Frame 안에 포함됨 |
| Shape (Line) | `.shape-block[data-shape-type="line"]` | 대각선 | Frame 안에 포함됨 |
| Shape (Arrow) | `.shape-block[data-shape-type="arrow"]` | 화살표 | Frame 안에 포함됨 |
| Shape (Polygon) | `.shape-block[data-shape-type="polygon"]` | 삼각형 | Frame 안에 포함됨 |
| Shape (Star) | `.shape-block[data-shape-type="star"]` | 별 polygon | Frame 안에 포함됨 |

---

## 3. 디자인 규칙 체크리스트

### 3-1. 아이콘 크기

- [ ] 섹션 아이콘 `.layer-section-icon` → `14×14px` (`--icon-layer-size: 14px`)
- [ ] 블록 아이콘 `.layer-item-icon` → `14×14px` (동일)
- [ ] 프로퍼티 패널 헤더 아이콘 → `16×16px` (`--icon-prop-size: 16px`)
- [ ] 섹션 `#` 아이콘 viewBox → `"1.5 1.5 13 13"` (크롭으로 시각 크기 조정)
- [ ] 일반 블록 아이콘 viewBox → `"0 0 12 12"`

### 3-2. 아이콘 스타일 일관성

- [ ] 섹션/서브섹션 아이콘: Figma Frame(`#`) filled path, `fill="currentColor"`
- [ ] 텍스트 계열 아이콘: `stroke="currentColor"`, `stroke-width="1.3"`, `fill="none"`
- [ ] Asset 아이콘: `stroke-width="1"` (다른 블록보다 얇게 → 시각 균형)
- [ ] H 아이콘: `fill="currentColor"`, `text-anchor="middle"`, `x="6"` 중앙 정렬

### 3-3. 아이콘↔텍스트 gap

- [ ] `.layer-section-header` gap → `8px` (`--icon-layer-gap-section`)
- [ ] `.layer-item` gap → `7px` (`--icon-layer-gap-item`)
- [ ] `.layer-row-header` gap → `6px` (`--icon-layer-gap-row`)
- [ ] opacity: 비활성 `0.5`, 활성(`.active`) `0.7`

### 3-4. 아이템 행 높이 & 패딩

- [ ] `.layer-section-header` height → `28px`, padding → `0 8px`
- [ ] `.layer-item` height → `28px`, padding → `0 8px`
- [ ] `.layer-row-header` height → `28px`, padding → `0 6px 0 8px`
- [ ] active 상태 → `border-left: 2px solid var(--color-selection-hover)` + `padding-left: 6px`

### 3-5. 텍스트 스타일

- [ ] 섹션 이름 `.layer-section-name` → `font-size: 11px`, `font-weight: 600`, 색상 `#ccc`
- [ ] 블록 이름 `.layer-item-name` → `font-size: 11px`, 색상 `#b0b0b0`
- [ ] 활성 상태 색상 → `#6fa3f7` (accent blue)
- [ ] Row 헤더 이름 → `font-weight: 600`

### 3-6. 들여쓰기 (depth)

- [ ] 피그마 스타일 `.layer-indent` 수직선 가이드 적용
- [ ] 깊이 1 → indent 1개 (`width: 16px`), 깊이 2 → indent 2개
- [ ] `.layer-indent:last-child::before` → border-left 없음 (끝선 제거)

#### 아이콘 수평 정렬 규칙

같은 깊이의 `layer-item`과 `layer-row-header`(서브섹션 등)는 **아이콘/텍스트가 동일 수평선에 정렬**되어야 한다.

| 요소 | 구조 | 아이콘 시작 위치 (depth 1) |
|------|------|--------------------------|
| `layer-item` | `padding(8) + indent(16) + gap(7)` | **31px** |
| `layer-row-header` (보정 전) | `padding(8) + indent(16) + gap(6) + chevron(12) + gap(6)` | **48px** — 17px 초과 |
| `layer-row-header` (보정 후) | chevron에 `margin-left: -18px` 적용 | **30px** ≈ 정렬 |

**CSS 규칙:**
```css
.layer-row-header .layer-chevron {
  margin-left: -18px;   /* chevron을 flex 레이아웃에서 제거 (12px + gap 6px) */
  position: relative;   /* 수직선 가이드 위로 올라오도록 */
  z-index: 1;
}
```

- chevron은 시각적으로 마지막 indent 영역과 겹침 (피그마 동일 패턴)
- 이 규칙은 서브섹션, 그룹, Row 등 `layer-row-header`를 쓰는 모든 요소에 적용됨
- depth가 달라져도 자동으로 맞춰짐 (indent 단위가 동일하기 때문)

#### Frame 그룹 헤더 내부 `.layer-item` 레이아웃

`layer-row-header` 안에 있는 `.layer-item` (Frame 타입 표시 라벨 등)은 별도 CSS 보정이 필요하다.

```css
/* editor-panels.css */
.layer-row-header .layer-item {
  flex: 1;              /* row-header 전체 너비를 채워야 type 라벨이 우측으로 밀림 */
  padding: 0;           /* 외부 header의 padding과 중복 방지 */
  height: 100%;
  border-radius: 0;
}
.layer-row-header .layer-item:hover {
  background: transparent;   /* header hover 색상과 충돌 방지 */
}
```

> `flex: 1` 없으면 `.layer-item`이 내용 크기만큼만 차지해 "Frame" 타입 라벨이 이름 바로 옆에 붙는 시각적 오정렬 발생.

---

## 4. 상호작용 기능 체크리스트

### 4-1. 섹션

- [ ] 클릭 → `selectSection()` 호출 → 캔버스 섹션 선택 + 우측 프로퍼티 패널 갱신
- [ ] `active` 클래스 → 배경 `rgba(45,111,232,0.15)`
- [ ] 접기/펼치기 → `.layer-chevron` 클릭 → `.collapsed` 토글
- [ ] 눈 아이콘 → hover 시 표시 → 클릭 시 섹션 show/hide
- [ ] 더블클릭 이름 → 인라인 편집 (Enter 확정, Esc 취소)
- [ ] `syncLayerActive(sec)` → 레이어패널 active 상태를 섹션과 동기화

#### 섹션명 인라인 편집 규칙

- 편집 시작 시 `prevName` 저장
- `finish()` 종료 시 실제 변경(`newName !== prevName`)이 있을 때만 `window.pushHistory?.('섹션명 변경')` 호출
  - 변경 없이 blur/Esc 시 히스토리 push **금지** (불필요한 undo 스택 오염 방지)
- 현재 선택된 섹션(`sec.classList.contains('selected')`)이면 `.prop-block-name` 텍스트도 즉시 업데이트
- 이름 변경마다 개별 히스토리 항목 생성 → Cmd+Z가 한 단계씩 정상 동작

#### 프로퍼티 패널 섹션명 렌더링 규칙 (⚠️ 하드코딩 금지)

`prop-section.js`의 `showSectionProperties(sec)` 에서 섹션명을 반드시 동적으로 읽어야 함:

```js
// ❌ 잘못된 예
<span class="prop-block-name">Section</span>

// ✅ 올바른 예
<span class="prop-block-name">${sec._name || sec.dataset.name || 'Section'}</span>
```

> 섹션명 관련 버그 수정 시 **이벤트 핸들러(`finish()`)와 초기 렌더링(`showSectionProperties()`)을 반드시 함께 확인**할 것.

#### data-section 동기화

- `buildLayerPanel()` 재빌드 시 `sec.dataset.section = sIdx` 를 항상 갱신
- 캔버스 섹션 DOM의 `data-section` 인덱스와 레이어패널 `data-section`이 일치해야 함
- 섹션 추가/삭제/이동 후 반드시 `buildLayerPanel()` 호출

### 4-2. 서브섹션

- [ ] 클릭 → `deselectAll()` → 부모 섹션 수동 선택 → `ss.selected` 추가 → `_activeSubSection = ss`
- [ ] `selectSection()` **금지** (내부 `deselectAll()`이 서브섹션 selected를 날림)
- [ ] `window._activeSubSection` 설정 → 이후 블록 추가 시 서브섹션 안으로 삽입됨
- [ ] 레이어 클릭 시 `showSubSectionProperties(ss)` 호출
- [ ] save/load 후 `rebindAll()` → `bindSubSectionDropZone()` 재바인딩 필수
- [ ] `Cmd+C` / `Cmd+V` 복사·붙여넣기 지원 → `copySelected()`에서 `.sub-section-block.selected` 감지 → row 단위로 복사
- [ ] 붙여넣기 시 `_activeSubSection` 을 임시 null 처리 → 서브섹션 내부가 아닌 row 뒤에 삽입
- [ ] `Delete` / `Backspace` → row 단위 삭제 + `_activeSubSection = null` 초기화 (부모 섹션 삭제 방지)

#### 블록 추가 위치 규칙 (`insertAfterSelected`)

| 상황 | 삽입 위치 |
|------|---------|
| 서브섹션 자체가 `.selected` (레이어 패널 선택) | 서브섹션 row **바로 뒤** |
| 서브섹션 내부 블록이 선택된 상태 | 서브섹션 **내부** 선택 블록 뒤 |
| `_activeSubSection` 설정, 내부 선택 없음 | 서브섹션 내부 **맨 아래** |

> `insertAfterSelected` (`drag-utils.js`) 조건: `activeSS && !activeSS.classList.contains('selected')` 일 때만 내부 삽입 경로 진입.

### 4-3. 블록 아이템

- [ ] 클릭 → `highlightBlock(block, layerItem)` → 캔버스 블록 하이라이트 + 우측 패널 갱신
- [ ] `active` 클래스 → 파란 왼쪽 테두리 + 배경 강조
- [ ] 더블클릭 이름 → 인라인 편집
- [ ] 삭제 시 레이어패널 자동 갱신 (`buildLayerPanel()` 재호출)

#### 멀티셀렉트 (캔버스 블록 + 레이어 패널 동일 동작)

| 입력 | 동작 |
|------|------|
| 단순 클릭 | 단일 선택 (기존 선택 해제) |
| `Cmd+click` | 개별 토글 선택 (anchor 유지) |
| `Shift+click` | 범위 선택 — anchor 블록 ~ 클릭 블록 사이 전체 선택 |
| `Backspace` | 선택된 모든 블록 일괄 삭제 |
| `Cmd+C` | 선택된 모든 블록 복사 (`clipboard.type = 'multi-block'`) |
| `Cmd+V` | 복사된 블록들 순서 유지하며 붙여넣기 |

**구현 파일**: `js/editor.js` (`toggleBlockSelect`, `rangeSelectBlocks`, `setBlockAnchor`), `js/drag-drop.js` (각 블록 click 핸들러), `js/layer-panel-items.js` (`makeLayerBlockItem`, `makeLayerColItem` click 핸들러)

**anchor 규칙**: `setBlockAnchor(block)` — 단순 클릭 시 anchor 설정. `rangeSelectBlocks`는 anchor~target 구간을 `deselectAll()` 후 재선택. `deselectAll()` 내부에서 `_lastClickedBlock = null` 초기화되므로 anchor를 로컬 변수에 저장 후 복원.

**BLOCK_MULTI_SEL 셀렉터**: `.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .canvas-block, .shape-block` (sub-section-block 제외 — 서브섹션은 별도 선택 흐름)

### 4-4. 드래그앤드롭 (레이어 내)

- [ ] `layer-dragging` 클래스 → 드래그 중 투명도 `0.3`
- [ ] `dragover` 핸들러 → `rAF` 적용 (드래그 중 `buildLayerPanel()` 호출 금지)
- [ ] 드롭 인디케이터 → `clearLayerIndicators()` / `getLayerDragAfterItem()` 사용
- [ ] 드래그로 섹션 순서 변경 가능

#### 드롭 인디케이터 cleanup 규칙

`.layer-section-drop-indicator` 는 `dragend` 이벤트에서 **반드시** 제거되어야 함.

```js
// drag-drop.js 전역 dragend 핸들러 (capture phase)
document.addEventListener('dragend', () => {
  clearLayerSectionIndicators(); // ← 반드시 포함
  clearDropIndicators();
}, true);
```

- `dragleave`만으로는 ESC 취소, 패널 밖 드롭, 빠른 동작 등에서 cleanup 누락 가능
- `dragend`는 드래그 종료를 보장하므로 최종 cleanup은 항상 여기서 처리

### 4-5. 그룹

- [ ] Row Group 헤더 → `.layer-row-header`
- [ ] 그룹 해제 버튼 (`.layer-ungroup-btn`) → hover 시만 표시
- [ ] `Cmd+G` → 그룹 생성 → 레이어패널 즉시 갱신
- [ ] `Cmd+Shift+G` → 그룹 해제 → 레이어패널 즉시 갱신

---

## 5. CSS 토큰 참조

```css
/* design-tokens.css */
--icon-layer-size:        14px;
--icon-layer-gap-section: 8px;
--icon-layer-gap-item:    7px;
--icon-layer-gap-row:     6px;
--icon-prop-size:         16px;

--color-selection:          /* 선택 테두리 (#2d6fe8) */
--color-selection-hover:    /* 호버 아웃라인 (rgba 0.40) */
--color-selection-fill:     /* 선택 배경 (rgba 0.08) */
--color-selection-fill-dim: /* 캔버스 아이템 호버 bg (rgba 0.06) */
--color-selection-outline:  /* 호버 아웃라인 (rgba 0.35) */
--color-selection-glow:     /* 드래그 핸들 glow (rgba 0.70) */
```

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `js/layer-panel.js` | `buildLayerPanel()` — 트리 전체 재빌드 |
| `js/layer-panel-items.js` | `makeLayer*()` 렌더러, `layerIcons` 아이콘 맵 |
| `css/editor-panels.css` | `.layer-*` 스타일 (line ~980~1085) |
| `css/design-tokens.css` | 아이콘 크기·gap 토큰 |
| `js/drag-drop.js` | `bindSubSectionDropZone()` — 서브섹션 클릭/드롭 |
| `js/save-load.js` | `rebindAll()` — 로드 후 바인딩 복원 |
| `js/editor.js` | `selectSection()`, `deselectAll()`, `syncLayerActive()`, `copySelected()`, `pasteClipboard()` |
| `js/drag-utils.js` | `insertAfterSelected()` — 블록 삽입 위치 결정 (서브섹션 selected 분기 포함) |

---

## 7. 구현 주의사항

### 레이어 트리 렌더링 — `appendRowToLayer` 처리 순서

`layer-panel.js` 의 `appendRowToLayer(row, container, depth)` 에서 단일 col 블록 분기:

```js
// 반드시 sub-section-block 체크를 asset-block 앞에 두어야 함
if (block.classList.contains('sub-section-block')) {
  container.appendChild(makeLayerSubSectionItem(block, sec, appendRowToLayer));
} else if (block.classList.contains('asset-block')) { ... }
```

서브섹션은 자체적으로 하위 트리를 가지므로 `makeLayerBlockItem` 이 아닌 `makeLayerSubSectionItem` 으로 렌더링해야 한다. 이 순서가 뒤바뀌면 템플릿에서 컴포넌트를 삽입해도 레이어 패널에 표시되지 않는다.

### 삭제 핸들러 — 서브섹션 우선 처리

`editor.js` Delete/Backspace 핸들러에서 `allSelBlocks` 셀렉터에 `.sub-section-block`이 없으므로, 서브섹션 selected 상태에서 Delete 시 `allSelBlocks.length === 0` → **부모 섹션 삭제** 로 떨어지는 버그가 발생한다.

반드시 `allSelBlocks` 체크 **앞에** 서브섹션 전용 분기를 먼저 처리해야 한다:

```js
const selSS = document.querySelector('.sub-section-block.selected');
if (selSS) {
  // row 단위 삭제 + _activeSubSection 초기화
  const ssRow = selSS.closest('.row') || selSS;
  ssRow.remove();
  window._activeSubSection = null;
  // ... deselectAll, buildLayerPanel
  return; // ← 반드시 return으로 부모 섹션 삭제 방지
}
```
