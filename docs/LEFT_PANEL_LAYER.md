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
├── Sub-Section (서브섹션)  ← 선택적, 섹션 안에 중첩 프레임
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
| Sub-Section | `.sub-section-block` | `#` (동일) | `layer-item-icon` |
| Text (h1/h2/h3) | `.text-block` | `H` (serif, bold) | text-anchor:middle |
| Text (body/caption) | `.text-block` | 가로선 3줄 / 2줄 | — |
| Asset (이미지) | `.asset-block` | 사각형 + 산 + 태양 | stroke-width:1 |
| Gap | `.gap-block` | 점선 2줄 | — |
| Label | `.label-group-block` | 둥근 사각형 1개 | — |
| Label Group | `.label-group` | 둥근 사각형 2개 | — |
| Icon Circle | `.icon-circle-block` | 원 + ★ | — |
| Table | `.table-block` | 격자 | — |
| Divider | `.divider-block` | 가로선 1줄 | — |
| Card | `.card-block` | 사각형 + 하단선 | — |
| Graph | `.graph-block` | 꺾은선 그래프 | — |
| Icon-Text | `.icon-text-block` | 작은 사각형 + 텍스트선 | — |
| Canvas | `.canvas-block` | 격자 점선 분할 | — |
| Row Group | — | 피그마 스타일 Row 아이콘 | `layer-item-icon` |

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
- [ ] active 상태 → `border-left: 2px solid rgba(45,111,232,0.4)` + `padding-left: 6px`

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

---

## 4. 상호작용 기능 체크리스트

### 4-1. 섹션

- [ ] 클릭 → `selectSection()` 호출 → 캔버스 섹션 선택 + 우측 프로퍼티 패널 갱신
- [ ] `active` 클래스 → 배경 `rgba(45,111,232,0.15)`
- [ ] 접기/펼치기 → `.layer-chevron` 클릭 → `.collapsed` 토글
- [ ] 눈 아이콘 → hover 시 표시 → 클릭 시 섹션 show/hide
- [ ] 더블클릭 이름 → 인라인 편집 (Enter 확정, Esc 취소)
- [ ] `syncLayerActive(sec)` → 레이어패널 active 상태를 섹션과 동기화

### 4-2. 서브섹션

- [ ] 클릭 → `deselectAll()` → 부모 섹션 수동 선택 → `ss.selected` 추가 → `_activeSubSection = ss`
- [ ] `selectSection()` **금지** (내부 `deselectAll()`이 서브섹션 selected를 날림)
- [ ] `window._activeSubSection` 설정 → 이후 블록 추가 시 서브섹션 안으로 삽입됨
- [ ] 레이어 클릭 시 `showSubSectionProperties(ss)` 호출
- [ ] save/load 후 `rebindAll()` → `bindSubSectionDropZone()` 재바인딩 필수

### 4-3. 블록 아이템

- [ ] 클릭 → `highlightBlock(block, layerItem)` → 캔버스 블록 하이라이트 + 우측 패널 갱신
- [ ] `active` 클래스 → 파란 왼쪽 테두리 + 배경 강조
- [ ] 더블클릭 이름 → 인라인 편집
- [ ] 삭제 시 레이어패널 자동 갱신 (`buildLayerPanel()` 재호출)

### 4-4. 드래그앤드롭 (레이어 내)

- [ ] `layer-dragging` 클래스 → 드래그 중 투명도 `0.3`
- [ ] `dragover` 핸들러 → `rAF` 적용 (드래그 중 `buildLayerPanel()` 호출 금지)
- [ ] 드롭 인디케이터 → `clearLayerIndicators()` / `getLayerDragAfterItem()` 사용
- [ ] 드래그로 섹션 순서 변경 가능

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
| `js/editor.js` | `selectSection()`, `deselectAll()`, `syncLayerActive()` |
