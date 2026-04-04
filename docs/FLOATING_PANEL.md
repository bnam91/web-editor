# 플로팅 패널 (Floating Panel)

> 기능 명세 + 디자인 규칙 매뉴얼
> HTML: `index.html` `#floating-panel` / 스타일: `css/editor-panels.css`

---

## 1. 개요

캔버스 좌측 하단에 고정 위치하는 빠른 블록 추가 패널.
선택된 섹션을 기준으로 블록을 삽입한다.

> **삽입 규칙**: 섹션이 선택된 상태에서 버튼 클릭 → 해당 섹션에 추가
> `window._activeSubSection`이 설정된 경우 → 서브섹션 안에 추가

---

## 2. 버튼 & 드롭다운 명세

### 2-1. 브랜치 인디케이터 `#branch-indicator`

| 항목 | 내용 |
|------|------|
| 아이콘 | 브랜치 SVG (`11×11`) |
| 표시 | `#branch-name` — 현재 브랜치명 |
| 동작 | `toggleBranchDropdown(event)` → `#branch-dropdown-menu` 표시 |
| 메뉴 | 브랜치 목록 — 클릭 시 전환 / 새 브랜치 생성 |

---

### 2-2. 레이아웃 그룹

| 버튼 | 함수 | 설명 |
|------|------|------|
| **Section** | `addSection()` | 새 섹션 추가 (primary 버튼) |
| **Grid ▾** | `toggleFpDropdown('fp-row-dropdown')` | 멀티컬럼 그리드 드롭다운 |
| **Frame** | `addFrameBlock()` | 프레임 추가 (Auto/Free 모드 전환 가능) |
| **Canvas** | `addCanvasBlock()` | 자유배치 캔버스 블록 |
| **Gap** | `addGapBlock()` | 여백 블록 |

#### Grid 드롭다운 옵션

| 메뉴 | 함수 | 설명 |
|------|------|------|
| 1 × 1 | `addRowBlock(1,1)` | 단일 컬럼 행 |
| 2 × 1 | `addRowBlock(2,1)` | 2열 1행 |
| 2 × 2 | `addRowBlock(2,2)` | 2열 2행 |
| 3 × 1 | `addRowBlock(3,1)` | 3열 1행 |
| 3 × 2 | `addRowBlock(3,2)` | 3열 2행 |

---

### 2-3. Text 드롭다운 `#fp-text-dropdown`

| 메뉴 | 함수 | 블록 타입 |
|------|------|-----------|
| Heading | `addTextBlock('h2')` | h2 텍스트 |
| Body | `addTextBlock('body')` | 본문 텍스트 |
| Caption | `addTextBlock('caption')` | 캡션 텍스트 |
| Label | `addTextBlock('label')` | 라벨 텍스트 |
| Tags | `addLabelGroupBlock()` | 태그 그룹 |
| Icon Text | `addIconTextBlock()` | 아이콘+텍스트 조합 |

---

### 2-4. Asset 드롭다운 `#fp-asset-dropdown`

| 메뉴 | 함수 | 비율 특성 |
|------|------|-----------|
| Standard | `addAssetBlock('standard')` | 일반 비율 |
| Square | `addAssetBlock('square')` | 정사각형 |
| Tall | `addAssetBlock('tall')` | 세로 긴 비율 |
| Wide | `addAssetBlock('wide')` | 가로 긴 비율 |
| Logo | `addAssetBlock('logo')` | 로고용 소형 |
| Asset-Circle | `addIconCircleBlock()` | 원형 에셋 프레임 |

---

### 2-5. Component 드롭다운 `#fp-component-dropdown`

| 메뉴 | 함수 | 설명 |
|------|------|------|
| Table | `addTableBlock()` | 비교표 |
| Card | `addCardBlock()` | 카드 블록 |
| Graph | `addGraphBlock()` | 그래프 |
| Divider | `addDividerBlock()` | 구분선 |

---

### 2-6. Shape 드롭다운 `#fp-shape-dropdown`

| 메뉴 | 함수 | 설명 |
|------|------|------|
| Rectangle | `addShapeBlock('rectangle')` | 사각형 도형 |
| Line | `addShapeBlock('line')` | 직선 |
| Arrow | `addShapeBlock('arrow')` | 화살표 |
| Ellipse | `addShapeBlock('ellipse')` | 원 |
| Polygon | `addShapeBlock('polygon')` | 다각형 |
| Star | `addShapeBlock('star')` | 별 |

> 각 도형은 독립된 100×100 Frame 안에 생성됨. Frame의 `dataset.layerName`이 도형 타입명으로 자동 설정됨.

---

### 2-7. Shelf 버튼 `#fp-comp-shelf-btn`

| 항목 | 내용 |
|------|------|
| 동작 | `window.CompShelf.toggle()` |
| 역할 | 컴포넌트 선반 열기 — 저장된 블록 재사용 |

---

## 3. 전체 버튼 순서 (위→아래)

```
[브랜치 인디케이터 ▾]
──────────────────────
[Section]         ← primary (파란 강조)
[Grid ▾]
[Frame]
[Canvas]
[Gap]
──────────────────────
[Text ▾]
[Asset ▾]
[Shape ▾]
──────────────────────
[Component ▾]
──────────────────────
[Shelf]
```

---

## 4. 디자인 규칙 체크리스트

### 4-1. 버튼 공통

- [ ] 기본 버튼 클래스 → `.fp-btn`
- [ ] 드롭다운 트리거 → `.fp-btn.fp-dropdown-trigger`
- [ ] Section 버튼 → `.fp-btn.primary` (강조 배경색)
- [ ] 버튼 아이콘 → `11×11px` SVG, `stroke-width: 1.8`
- [ ] Frame 버튼 아이콘 → Figma 스타일 cross-frame SVG (`viewBox="1.5 1.5 13 13"`, `fill-rule: evenodd` path)
- [ ] 버튼 라벨 → 영문, 짧은 한 단어

### 4-2. 드롭다운

- [ ] 드롭다운 래퍼 → `.fp-dropdown`
- [ ] 메뉴 컨테이너 → `.fp-dropdown-menu`
- [ ] 메뉴 아이템 → `.fp-menu-item`
- [ ] 열기/닫기 → `toggleFpDropdown(id)` 전용 함수 사용
- [ ] 드롭다운 열 때 chevron → `.fp-chevron` 회전 (CSS transition)

### 4-3. 구분선

- [ ] 그룹 사이 구분 → `.fp-divider`
- [ ] 그룹: 레이아웃 / 텍스트+에셋 / 컴포넌트 / 선반

### 4-4. 위치

- [ ] `position: fixed` — 스크롤에 무관하게 고정
- [ ] 캔버스 좌측 하단 오버레이 위치
- [ ] z-index 캔버스보다 위

---

## 5. 삽입 로직 규칙

- [ ] 섹션 미선택 시 버튼 클릭 → 동작 없음 or 첫 섹션에 추가
- [ ] `window._activeSubSection` 있으면 → 서브섹션 안에 삽입
- [ ] `window._activeSubSection` 없으면 → 선택된 섹션 마지막에 삽입
- [ ] 섹션 추가(`addSection`) 는 캔버스 맨 아래 추가

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `index.html` (`#floating-panel`) | 구조 정의 |
| `css/editor-panels.css` | `.fp-btn`, `.fp-dropdown*` 스타일 |
| `js/drag-drop.js` | `addTextBlock`, `addAssetBlock`, `addSection` 등 |
| `js/block-factory.js` | `addSubSectionBlock`, `addCanvasBlock`, `addRowBlock` 등 |
| `js/branch-system.js` | `toggleBranchDropdown`, 브랜치 전환 |
| `js/editor.js` | `window._activeSubSection` 관리 |
