# Goya Web Editor — Design System

> 에디터 UI의 시각적 언어와 컴포넌트 규칙을 기록한 **레퍼런스 문서**.
> CSS 변경 전 참고용으로 활용할 것.
>
> - 이 파일은 `_context/`에 위치하며 **매 세션 자동 로드되지 않음** (CLAUDE.md와 다름)
> - Claude 행동 규칙(변경 금지 사항 등)의 출처는 `CLAUDE.md`와 `js/CLAUDE.md`
> - 이 문서는 토큰·색상·블록 목록 등 **설계 레퍼런스** 역할만 담당

---

## 권역별 디자인 규칙 진입점

> 디자인 검수 시 해당 권역 문서만 열 것. 전체 읽지 말 것.

| 권역 | 참조 문서 | 주요 체크 항목 |
|------|---------|--------------|
| 🎨 **색상·토큰 시스템** | 이 문서 §1 | CSS 변수 계층, 배경·텍스트·보더·액션 색상 |
| 🖼️ **캔버스 — 블록·선택·레이아웃** | 이 문서 §2~5 | 선택 outline, hover tint, 블록 목록, 텍스트 기본값 |
| 🔲 **캔버스 — 핸들·오버레이** | 이 문서 §6 | 리사이즈·코너반경 핸들 크기·위치 |
| 🔍 **캔버스 — 줌·레퍼런스 모달** | 이 문서 §7~8 | 줌 보정(`--inv-zoom`), 모달 UI |
| 📋 **좌측 패널** (레이어·파일·브랜치) | `docs/LEFT_PANEL_LAYER.md` | 아이콘 크기·간격, 행 높이, 들여쓰기 |
| ⚙️ **우측 패널** (프로퍼티) | `docs/RIGHT_PANEL_PROPS.md` | 패널별 입력 UI, 공통 구조 |
| 🔝 **상단 바** | `docs/TOPBAR.md` | 버튼 명세, 인디케이터, 드롭다운 |
| ➕ **플로팅 패널** (블록 추가) | `docs/FLOATING_PANEL.md` | 레이아웃 버튼, 드롭다운 순서 |
| 📝 **스크래치패드** | `docs/SCRATCH_PAD.md` | 패널 UI 규칙 |

---

## 1. 색상 토큰 (CSS Variables)

### 토큰 계층 구조

```
design-tokens.css
  ├─ Primitive tokens  (--p-*)   ← 원시 값 (숫자·색상만)
  └─ Semantic tokens   (--color-*, --bg-*, --border-*, --text-*)  ← primitive 참조

editor-base.css
  └─ UI Shell tokens  (--ui-*)   ← 기존 호환용 (하드코딩된 값)
```

> 새 코드에서는 semantic token(`--color-*` 계열)을 우선 사용.
> `--ui-*`는 기존 컴포넌트와의 호환을 위해 유지.

---

### 1-A. UI Shell 토큰 (`editor-base.css :root`)

```css
/* 배경 계층 (어두운 순) */
--ui-bg-app:        #1a1a1a;   /* 앱 최하위 배경 (body) */
--ui-bg-base:       #1e1e1e;   /* 사이드 패널 배경 */
--ui-bg-elevated:   #242424;   /* topbar, elevated 요소 */
--ui-bg-card:       #252525;   /* 드롭다운, 팝업, 카드 */
--ui-bg-input:      #2a2a2a;   /* input, sunken/active 요소 */
--ui-bg-hover:      #2e2e2e;   /* hover 상태, 패널 border */

/* 보더 */
--ui-border:        #333333;
--ui-border-mid:    #3a3a3a;
--ui-border-strong: #444444;

/* 텍스트 */
--ui-text:          #e0e0e0;
--ui-text-sub:      #aaaaaa;
--ui-text-muted:    #777777;
--ui-text-dim:      #555555;

/* 시맨틱 액션 */
--ui-danger:        #e06c6c;
--ui-success:       #7fc87f;
--ui-accent:        #7cb8ff;          /* 브랜치/편집 배지 */
--ui-accent-primary: #2d6fe8;         /* 주요 액션/활성 */
--ui-accent-primary-hover: #3a7df0;   /* 주요 액션 hover */
```

**배경 계층:**
```
body (#1a1a1a) → 패널 (#1e1e1e) → topbar (#242424) → 팝업 (#252525) → input (#2a2a2a) → hover (#2e2e2e)
```

**버튼 3종 패턴:**
```css
/* Ghost */
.tb-btn { background: transparent; border-color: transparent; color: var(--ui-text-sub); }
.tb-btn:hover { background: var(--ui-border); border-color: var(--ui-border-strong); }

/* Danger */
.btn--danger:hover { background: #3a2020; color: var(--ui-danger); }

/* Accent */
.btn--accent:hover { background: #1a2a40; color: var(--ui-accent); }
```

---

### 1-B. 캔버스 선택 토큰 (`design-tokens.css` → `editor-base.css`)

```css
/* editor-base.css에서 design-tokens.css 참조로 연결 */
--sel-color:       var(--color-selection);       /* = #2d6fe8 */
--sel-color-hover: var(--color-selection-hover); /* (예비) */
--sel-color-fill:  var(--color-selection-fill);  /* = rgba(45,111,232,0.08) */

/* 텍스트 프리셋 — 사용자 변경 가능 */
--preset-h1-color:      #111111;
--preset-h1-family:     'Noto Sans KR', sans-serif;
--preset-h2-color:      #1a1a1a;
--preset-h2-family:     'Noto Sans KR', sans-serif;
--preset-h3-color:      #333333;
--preset-h3-family:     'Noto Sans KR', sans-serif;
--preset-body-color:    #555555;
--preset-body-family:   'Noto Sans KR', sans-serif;
--preset-caption-color: #999999;

/* 레이블 블록 프리셋 */
--preset-label-bg:     #111111;
--preset-label-color:  #ffffff;
--preset-label-radius: 8px;
```

---

### 1-C. Semantic 토큰 요약 (`design-tokens.css`)

주요 의미 토큰. 원시값 대신 이쪽을 참조할 것.

```css
--color-accent              /* 주요 액션 (#2d6fe8) */
--color-accent-hover        /* (#3a7df0) */
--color-accent-edit         /* 편집 배지 (#7cb8ff) */

--color-selection           /* 캔버스 블록 선택 outline */
--color-selection-fill      /* 캔버스 블록 hover tint */
--color-selection-fill-dim  /* 더 연한 hover tint */

--color-handle              /* 이미지/CI 핸들 파랑 (#1592fe) */

--color-danger / --color-danger-hover / --color-danger-bg
--color-success / --color-success-bg
--color-saved               /* autosave 저장됨 (#4ecb7a) */
--color-focus / --color-focus-fill

--bg-app / --bg-base / --bg-elevated / --bg-card / --bg-input / --bg-hover
--border-default / --border-mid / --border-strong
--text-default / --text-sub / --text-muted / --text-dim / --text-hint
```

---

## 2. 블록 선택/호버 상태 (설계 레퍼런스)

> 변경 금지 규칙은 `CLAUDE.md`가 출처. 이 섹션은 패턴 참고용.

### 설계 원칙 — 두 가지 outline 표준

| 종류 | outline | offset | 이유 |
|------|---------|--------|------|
| **컴포넌트(component)** | `1px solid var(--sel-color)` | `-1px` | 콘텐츠 자체가 시각 정보 — outline이 콘텐츠를 가리지 않도록 얇게 |
| **컨테이너(container)** | `3px solid var(--sel-color)` | `0` | 자식들을 감싸는 영역 — 흰 배경에서도 잘 보이도록 두껍게 |

| 상태 | 방식 |
|------|------|
| **Hover** | `::after` pseudo로 `var(--sel-color-fill)` 배경 tint (GitHub row-highlight 스타일) |
| **Selected** | 위 두 표준 중 하나 선택 |

**색은 모두 동일** (`var(--sel-color)`). 두께만 다름.

### 블록 분류

**컨테이너** (3px / 0):
- `frame-block` (data-banner-preset 없는 일반 frame)

**컴포넌트** (1px / -1px):
- `text-block`, `asset-block`, `card-block`, `table-block`, `graph-block`, `divider-block`
- `step-block`, `icon-circle-block`, `icon-text-block`, `label-group-block`
- `frame-block[data-banner-preset]` (frame-block 구조 재사용 + 컴포넌트 단위 시각 표준)

### 적용 패턴

```css
/* hover (모든 블록 공통) */
.xxx-block:hover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--sel-color-fill);
  pointer-events: none;
  z-index: 0;
}

/* 컴포넌트 selected */
.xxx-block.selected {
  outline: 1px solid var(--sel-color);
  outline-offset: -1px;
}

/* 컨테이너 selected */
.frame-block.selected {
  outline: 3px solid var(--sel-color);
  outline-offset: 0;
}

/* frame-block 변형 컴포넌트 (data-xxx-preset 패턴) — 컨테이너 룰을 override해서 컴포넌트 표준 사용 */
.frame-block[data-banner-preset].selected {
  outline: 1px solid var(--sel-color);
  outline-offset: -1px;
}
```

### ❌ 하지 말 것
- 컴포넌트 블록에 컨테이너 두께(3px) 적용 금지 (frame-block 변형도 마찬가지 — override 필수)
- `selected`에 `background` 추가 금지
- `box-shadow: 0 0 0 2px` 방식 사용 금지 (overflow:hidden 간섭)
- 텍스트 블록에 `border-radius` 추가 금지

---

## 3. 레이아웃 구조

### 3-A. 전체 DOM 계층

```
section-block
  └─ section-inner
       ├─ row[data-layout]              ← Row (선택적 래퍼)
       │    ├─ 콘텐츠 블록...
       │    └─ frame-block              ← 프레임 블록
       ├─ frame-block[data-text-frame]  ← 텍스트 블록 투명 래퍼 (자동 생성)
       │    └─ text-block
       ├─ asset-block
       └─ frame-block                   ← Auto/Free layout 컨테이너
            ├─ frame-block[data-text-frame] > text-block
            └─ asset-block / gap-block / ...
```

> Col(`.col`) 개념 제거됨. 너비 분할은 Row `data-layout` 또는 frame-block으로 대체.

---

### 3-B. Row 레이아웃 (`data-layout`)

```css
.row[data-layout="stack"]  { flex-direction: column; }
.row[data-layout="flex"]   { flex-direction: row; gap: 12px; align-items: stretch; }
.row[data-layout="grid"]   { display: grid; gap: 12px; }
/* grid-template-columns은 JS에서 inline style로 설정 */
```

---

### 3-C. frame-block 레이아웃 모드

| 속성 | 의미 |
|------|------|
| _(없음)_ | Auto layout — `flex-direction: column`, 자식 flow 배치 |
| `data-free-layout="true"` | Free layout — 자식 `position: absolute`, Figma freeform |
| `data-full-width="true"` | 전체 너비 flow 배치 |
| `data-text-frame="true"` | 텍스트 전용 투명 래퍼 (레이어 패널 비표시) |
| `data-shape-frame="true"` | 쉐이프 전용 투명 래퍼 |

**선택 규칙**:
- `data-text-frame`은 절대 `.selected` 클래스를 받지 않음
- 선택 상태는 항상 freeLayout 부모 `frame-block`이 보유

---

## 4. 콘텐츠 블록 목록

### 4-A. 기본 블록

| 블록 | 클래스 | window 함수 | 용도 |
|------|--------|-------------|------|
| Text | `.text-block` | `addTextBlock(type)` | h1/h2/h3/body/caption/label |
| Asset | `.asset-block` | `addAssetBlock()` | 이미지/배경 이미지 (비어있을 때 72px 체커 패턴 placeholder) |
| Gap | `.gap-block` | `addGapBlock()` | 여백 |
| Frame | `.frame-block` | `addFrameBlock()` | 컨테이너 (Auto/Free layout) |
| Divider | `.divider-block` | `addDividerBlock()` | 구분선 |

### 4-A-1. asset-block placeholder 규칙

이미지가 비어 있는 `.asset-block` (배경이미지 미지정 상태)은 항상 동일한 체커 패턴이 보여야 한다.

```css
.asset-block {
  background: repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px;
}
```

- **타일 사이즈 72px 고정** — asset 크기와 무관하게 일관된 시각 언어
- 컴포넌트 내부에서 asset을 합성 사용할 때(예: banner 프리셋의 placeholder asset) `style.backgroundImage`로 임의의 회색/단색 이미지를 덮어쓰지 말 것. `src` 미지정으로 두면 위 CSS 규칙이 자동 적용된다.

---

### 4-B. 복합 콘텐츠 블록

| 블록 | 클래스 | window 함수 | 용도 |
|------|--------|-------------|------|
| Icon Circle | `.icon-circle-block` | `addIconCircleBlock()` | 원형 아이콘+텍스트 |
| Icon Text | `.icon-text-block` | `addIconTextBlock()` | 아이콘+텍스트 인라인 |
| Table | `.table-block` | `addTableBlock()` | 비교표/데이터 테이블 |
| Label Group | `.label-group-block` | `addLabelGroupBlock()` | 태그/뱃지 그룹 |
| Card | `.card-block` | — | 이미지+제목+설명 카드 (border-radius: 12px) |
| Strip Banner | `.strip-banner-block` | — | 좌우 분할 배너 |
| Graph | `.graph-block` | `addGraphBlock()` | 막대 그래프 |
| Speech Bubble | `.speech-bubble-block` | `addSpeechBubbleBlock(tail)` | 말풍선 (tail: top/bottom/left/right) |
| Shape | `.shape-block` | `addShapeBlock(type)` | 도형 (rectangle/ellipse 등) |
| Group | `.group-block` | — | 블록 묶음 (다중 선택 후 그룹화) |

### 4-C. 고급/특수 블록

| 블록 | 클래스 | window 함수 | 용도 |
|------|--------|-------------|------|
| Canvas | `.canvas-block` | `addCanvasBlock()` | 자유 드로잉 캔버스 |
| Iconify | `.icon-block` | `addIconifyBlock(name, svg, size)` | SVG 아이콘 (Iconify) |
| Device Mockup | `.mockup-block` | `addDeviceMockupBlock(key, w)` | 디바이스 목업 |
| Step | `.step-block` | `addStepBlock()` | 번호형 스텝 가이드 |
| Vector | `.vector-block` | `addVectorBlock(svgString)` | 커스텀 SVG 벡터 |
| Grid | `.grid-block` | `addNewGridBlock(cols, rows)` | 격자형 레이아웃 |
| Joker | `.joker-block` | `addJokerBlock()` | 특수 목적 블록 |

---

## 5. 텍스트 블록 타입별 기본값

| 타입 | 클래스 | 크기 | 굵기 | 색상 | line-height |
|------|--------|------|------|------|------------|
| H1 | `.tb-h1` | 104px | 700 | `--preset-h1-color` | 1.1 |
| H2 | `.tb-h2` | 72px | 600 | `--preset-h2-color` | 1.15 |
| H3 | `.tb-h3` | 52px | 600 | `--preset-h3-color` | 1.2 |
| Body | `.tb-body` | 36px | 400 | `--preset-body-color` | 1.6 |
| Caption | `.tb-caption` | 26px | 400 | `--preset-caption-color` | 1.6 |
| Label | `.tb-label` | — | — | `--preset-label-color` | — |

텍스트 블록 기본 패딩: `32px 20px` (상하 패딩은 `txt-pv-slider`로 상하 동시 조절)

**Label 타입**: `inline-block` 스타일, 배경(`--preset-label-bg`), 패딩, `border-radius`가 적용되는 뱃지형.

---

## 6. 핸들 오버레이 시스템 (`#ss-handles-overlay`)

Figma 스타일 캔버스 핸들. `position:fixed; z-index:9990`으로 항상 최상위에 렌더링.

### 6-A. frame-block 핸들

| 클래스 | 형태 | 용도 |
|--------|------|------|
| `.ss-resize-handle` | 7×7px 흰 정사각형, 파란 테두리 | 4코너 리사이즈 (nw/ne/sw/se) |
| `.ss-radius-handle` | 8×8px 흰 원형, 파란 테두리 | 코너 반경 조절 (내부 10px) |

`showFrameHandles(frameEl)` 호출 시 두 세트 동시 생성.
`hideFrameHandles()` → `.ss-resize-handle`, `.ss-radius-handle` 제거 (asset 핸들 유지).

### 6-B. asset-block 핸들

| 클래스 | 형태 | 용도 |
|--------|------|------|
| `.asset-handle` | 7×7px 흰 정사각형 | 4코너 리사이즈 |
| `.asset-radius-handle` | 8×8px 흰 원형, 파란 테두리 | 코너 반경 조절 (내부 10px) |

`showAssetRadiusHandles(assetEl)` — 에셋 클릭 시 자동 호출.
`hideAssetRadiusHandles()` — `deselectAll`에서 자동 해제.

### 핸들 독립성 규칙
- 두 시스템은 다른 클래스를 사용 → overlay 위에 공존 가능
- `hideFrameHandles()`는 asset 핸들을 건드리지 않음 (반대도 동일)

---

## 7. 레퍼런스 모달 (`#reference-modal`)

- 툴바: `position:absolute` 오버레이 — 이미지 영역 크기 영향 없음
- 표시 조건: modal `mouseenter` → height 0 → 32px 슬라이드다운
- 이미지 영역 전체 드래그 가능 (`mousedown` on `#ref-image-wrap`)
- 드래그 차단 대상: `button, input, label, #ref-resize-handle`
- 리사이즈 핸들: 우하단 `#ref-resize-handle` (z-index: 3)
- 불투명도: 최소 30%, 최대 100%

---

## 8. 줌 보정 (`--inv-zoom`)

에디터 캔버스가 CSS scale로 줌이 적용될 때, UI 레이블/툴바 등은 줌에 반비례하여 실제 크기를 유지.

```css
transform: scale(var(--inv-zoom, 1));
transform-origin: left center; /* 또는 맥락에 맞게 */
```

적용 대상: `.section-label`, `.st-btn` 계열, 이미지 편집 핸들 등
