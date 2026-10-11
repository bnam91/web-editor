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

⚠️⚠️**아래 29종 중 10종은 존재하지 않는다. 쓰기 전에 이 절의 경고를 읽어라.**
> **없는 10종** — 정의 **0건** ＋ 사용 **0건** 둘 다(2026-10-11 내가 쟀다):
> `--color-accent-edit` · `--color-selection-fill-dim` · `--color-danger-hover` ·
> `--color-danger-bg` · `--color-success-bg` · `--color-saved` · `--color-focus-fill` ·
> `--bg-base` · `--border-strong` · `--text-hint`
> 자 = 주석 걷은 `css/*.css` 에서 `--x:` 선언을 뽑고(194종), `var(--x)` 를 `css/`＋`js/` 에서 뽑아
> 둘 다 0인 것만. 항등식 **19(사는 것) ＋ 10(없는 것) = 29(이 블록의 명부)** 가 선다.
> 양성대조: 같은 자로 `--color-accent`·`--bg-app`·`--text-sub`·`--color-handle`·`--color-focus`·
> `--color-selection` 6종을 정의=있음으로 잡는다. 음성대조: `--bg-nope` 를 없음으로 잡는다.
>
> ⚠️**⒞㉡(§10 간격·반경)과 실패 방식이 다르다 — 따로 읽어라.** §10 은 «아무도 안 만들었다»다.
> 여기는 **이 줄이 「원시값 대신 이쪽을 참조할 것」이라고 시킨다** ⇒ 따르려는 사람이 더 많다.
>
> ⚠️⚠️**가장 위험한 한 쌍 — 이름이 한 글자 차이로 갈린다:**
> `--ui-bg-base` = **있다**(`css/editor-base.css` · #1e1e1e) ↔ `--bg-base` = **없다**(semantic 층).
> `--ui-border-strong` = **있다**(#444444) ↔ `--border-strong` = **없다**.
> ⇒ `--ui-` 접두를 떼면 **같은 뜻의 토큰이 사라진다**. semantic 층에만 구멍이다.
>
> ⛔**이 명부를 만든 자의 한계 — 쓰기 전에 읽어라.** 이 자는 `css/` 의 `--x:` 선언만 센다.
> **JS 가 런타임에 set 하는 토큰은 못 본다** — `--inv-zoom`·`--ui-scale` 은 `js/editor.js`
> `applyZoom()` 이 `documentElement` 에 걸어서 이 자엔 0건으로 뜬다. 그 둘을 「유령 아님」으로
> 뺀 것은 **자가 아니라 내 손**이다(§8·§9-A 가 「CSS 정의 없음이 정상」이라 적어 둔 것을 읽었다).
> ⇒ 다른 JS-set 토큰이 있으면 이 자는 그것도 유령으로 센다. **그 축은 안 쟀다.**
>
> ★손대기 전 이 파일 = blob `889803a2` · 24563바이트 · 524행
> (⛔내 워크트리 체크아웃이 파일 mtime 을 덮었으므로 정체는 blob 으로 적는다)

주요 의미 토큰. 원시값 대신 이쪽을 참조할 것 — ⚠️**단 위 10종은 빼고**(아래 `⛔없음` 표시).

```css
--color-accent              /* 주요 액션 (#2d6fe8) */
--color-accent-hover        /* (#3a7df0) */
--color-accent-edit         /* ⛔없음(제안) — 편집 배지 (#7cb8ff) */

--color-selection           /* 캔버스 블록 선택 outline */
--color-selection-fill      /* 캔버스 블록 hover tint */
--color-selection-fill-dim  /* ⛔없음(제안) — 더 연한 hover tint */

--color-handle              /* 이미지/CI 핸들 파랑 (#1592fe) */

--color-danger / --color-danger-hover⛔없음(제안) / --color-danger-bg⛔없음(제안)
--color-success / --color-success-bg⛔없음(제안)
--color-saved               /* ⛔없음(제안) — autosave 저장됨 (#4ecb7a) */
--color-focus / --color-focus-fill⛔없음(제안)

--bg-app / --bg-base⛔없음(제안·cf --ui-bg-base 있음) / --bg-elevated / --bg-card / --bg-input / --bg-hover
--border-default / --border-mid / --border-strong⛔없음(제안·cf --ui-border-strong 있음)
--text-default / --text-sub / --text-muted / --text-dim / --text-hint⛔없음(제안)
```

---

### 1-D. 체커(투명 표시) 토큰 (`editor-base.css :root`, 2026-10-04 S1 선행)

캔버스의 «빈 칸/투명» 표시 무늬 — 편집 전용(배송본·PNG 에는 안 나간다). 값·크기의 정본은 `editor-base.css :root` **한 곳**.

| 자리(가족) | 토큰 | 값(변수화 시점) | 쓰는 곳 |
|---|---|---|---|
| ① 큰 쌍 | `--goya-checker-big-a/-b/-size` | #d8d8d8 / #f0f0f0 / 72px | 섹션 체크배경 · 에셋 · 아이콘원 · 캔버스카드 · 목업 화면 · 확대블럭 · 주석 라벨(칸만 16px) · 도형 스와치(칸만 10px) |
| ② 작은 쌍 | `--goya-checker-small-a/-b/-size` | #e3e3e3 / #efefef / 16px | 배너 빈 이미지칸 · 그리드 빈 슬롯 |
| ③ 투명 쌍 | `--goya-checker-clear-a/-b` | #e0e0e0 / transparent (칸=small-size) | 표 «이미지 row» 빈 칸 |
| ④ SVG 패턴 | `--goya-checker-svg-a/-b` | = big-a/-b (alias — 따로 바꿀 수 있는 자리) | 도형 빈 면 `#goya-shape-checker` |

- ⛔한 변수로 합치지 않는다 — 큰 쌍(차 24)·작은 쌍(차 12)의 «작은 격자를 연하게»는 의도다.
- CSS 는 `var()` 로 읽는다. **JS 인라인**(저장 HTML 에 박히는 자리)은 `js/checker-tokens.js` 가 computed 값을 «읽어» 구체 값으로 박는다 — shorthand 안 `var()` 는 CSSOM longhand 가 비어 떼어낸 클론의 체커 서명(`/repeating-conic-gradient/`) 판정이 빗나가기 때문. SVG 패턴은 `style="fill:var(--goya-checker-svg-*)"`.
- 이 토큰 없이 `editor-blocks.css`/`editor-layout.css` 만 단독 로드하면 체커가 «사라진다»(var 비어 있음) — 시험 하네스는 `editor-base.css` 도 같이 얹는다.
- 센서스: `tests/unit/checker-tokens-census.test.mjs`(체커 무늬에 raw hex 재유입 금지) · 픽셀 잠금: `tests/dom/checker-pixel-identity.dom.spec.js`(골든 = 07d8178b).
- 제외(다른 가족): 우측 패널 스와치의 어두운 체커(`prop-simple-card.js` #888/#555 · `prop-gradient.js` #666/#888).

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
- `text-block`, `asset-block`, ~~`card-block`~~⚠️**반쪽**, `table-block`, `graph-block`, `divider-block`
  > ⚠️**`card-block` 에 이 「1px / -1px」을 걸 규칙이 없다.** `css/` 안 `.card-block` 선택자 **0건**
  > (2026-10-11 내가 쟀다). 아래 §4-D 참조 — 이 줄이 그 모순의 한쪽이다.
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
| ~~Card~~ | `.card-block` ⚠️**반쪽**(CSS 0 · js 93) | — | §4-D 참조 — CSS 규칙 0건 |
| ~~Strip Banner~~ | `.strip-banner-block` ⛔**없음**(레포 0건) | — | §4-D 참조 |
| Graph | `.graph-block` | `addGraphBlock()` | 막대 그래프 |
| Speech Bubble | `.speech-bubble-block` | `addSpeechBubbleBlock(tail)` | 말풍선 (tail: top/bottom/left/right) |
| Shape | `.shape-block` | `addShapeBlock(type)` | 도형 (rectangle/ellipse 등) |
| Group | `.group-block` | — | 블록 묶음 (다중 선택 후 그룹화) |

### 4-D. ⚠️ 이 문서가 든 «없는 블록» — 실패 방식이 둘이다

> ⛔**두 칸을 한 칸에 두지 마라.** 아래 ㉠과 ㉡은 고치는 길이 다르다.
> 센 날 = 2026-10-11 · 자 = 정의 자리(`css/` 선택자)와 사용 자리(`js/`)를 **둘 다** 봤다.
> ★손대기 전 이 파일 = blob `33c0132f` · 27186바이트 · 551행
> (출처= `git rev-parse 23e5ac7f:_context/DESIGN_SYSTEM.md` · ⛔워크트리 체크아웃이 파일 mtime 을
> 덮으므로 정체는 blob 으로 적는다)

#### ㉠ `.strip-banner-block` — **온전한 유령** (고칠 길: 이 행을 지운다)

`css/` **0건** · `js/` **0건** · `index.html`＋`pages/` **0건** ⇒ 레포 전체 **0건**.
⇒ 이 이름으로 된 물건은 **존재한 적이 없거나 흔적 없이 사라졌다**. 이 문서만 그것을 든다.

#### ㉡ `.card-block` — **반쪽**(스타일만 없다) (고칠 길: ㉠과 **다르다**)

`css/` 선택자 **0건** ↔ `js/` 언급 **93건**. ⇒ **코드는 이 이름을 아직 참조하고, 스타일은 없다.**
⇒ 지우면 안 된다. 「무엇이 남아 있나」를 먼저 세야 한다.

**코드가 제 입으로 적어 뒀다** — `js/block-bind-kinds.js:7` 원문:
> 「… `card-block` 은 만드는 자리 0 이라 뺐다(**옛 꼴 · 미확인**).」

⛔그 줄이 스스로 **「미확인」**이라 적었으므로 **여기서도 미확인으로 옮긴다.**
즉 「card-block 은 폐기됐다」는 **확정이 아니다** — 「만드는 자리가 0 이고, 왜인지는 안 쟀다」다.
(`js/goditor-api.js:134` 는 「중앙패널에서 제거됨」이라 적었다 — 이것도 그 파일의 주장이다.)

**⇒ 이 문서 안의 모순을 줄번호로 박는다** (아래 두 줄은 **지금 판**의 번호다):
- **§2 블록 분류 `:222`** — `card-block` 에 「컴포넌트 = 1px / -1px」을 **주라고 시킨다**
- **§4-B 표 `:350`** — `card-block` 을 「구현된 블록」으로 **들고 border-radius 12px 까지 적는다**
- **그런데 `css/` 에 `.card-block` 규칙이 0건** ⇒ **걸 자리가 없다.** 두 줄 다 집행 불가다.

⚠️**줄번호 주의** — 이 번호는 2026-10-11 의 이 판(551행)에서 쟀다. 위 절들에 ⚠️ 를 더하며
문서가 512 → 551 행으로 **밀렸다**(지디가 준 「§2:195 · §4-B:323」은 그 전 판의 번호다).
⇒ 다음 사람은 **번호를 믿지 말고 이름으로 찾아라**.

**자의 양성·음성 대조** — 같은 자로 `.text-block`·`.asset-block`·`.table-block` 은 CSS 정의
**있음**으로, `.zzz-block`(없는 이름)은 **없음**으로 잡힌다 ⇒ 그 0 은 「안 쟀다」가 아니다.

---

### 4-C. 고급/특수 블록

| 블록 | 클래스 | window 함수 | 용도 |
|------|--------|-------------|------|
| Canvas | `.canvas-block` | `addCanvasBlock()` | 자유 드로잉 캔버스 |
| Iconify | `.icon-block` | `addIconifyBlock(name, svg, size)` | SVG 아이콘 (Iconify) |
| Device Mockup | `.mockup-block` | `addDeviceMockupBlock(key, w)` | 디바이스 목업 |
| Step | `.step-block` | `addStepBlock()` | 번호형 스텝 가이드 |
| Vector | `.vector-block` | `addVectorBlock(svgString)` | 커스텀 SVG 벡터 |
| Joker | `.joker-block` | `addJokerBlock()` | 특수 목적 블록 |
<!-- ★2026-09-04 정정: 이전 행에 `.grid-block`/`addNewGridBlock(cols, rows)`가 「구현」으로 적혀 있었으나
     거짓 기재였다 — `.grid-block` 클래스는 (그 시점까지) 코드에 존재한 적이 없다.
     실체는 NewGrid(`data-new-grid`, frame-block 기반, 2026-04-07 구현 → 2026-06-08 봉인, 2026-09-04 스텁 삭제)였다.
     듀오 블록(`.duo-block`)이 이후 그 자리를 대신한다 — PLAN-gridblock.md 참조. -->
<!-- ★★2026-09-05 재정정(위 정정문에 «대비»로 세운다 — 위 문장을 지우지 않는다):
     이제 `.grid-block` 은 «실존한다». 다만 위가 말한 NewGrid 와는 «다른 물건»이다 —
     듀오 블록이 이 이름으로 개명됐다(PLAN-grid-rename.md). 셸 정체성 = `.grid-block` /
     `data-type="grid"` / 새 id 접두 `grd_`. `addNewGridBlock` 은 여전히 존재하지 않는다.
     ⛔옛 저장본의 `.duo-block` 은 파일을 고치지 않고 «열 때» 승격한다. 옛 id `duo_…` 는 그대로 둔다(참조라서). -->
| Grid | `.grid-block` | `addGridBlock({cols, rows?, cells?, gap?, valign?})` | 2~4열 × 1~4행 정형 그리드 (2026-09-05 개명 전 이름 = duo) |
| ~~NewGrid~~ | ~~`data-new-grid`~~ | ~~`addNewGridBlock(cols, rows)`~~ | **삭제(봉인·2026-09-04 스텁 삭제)** — 위 Grid 와 무관한 별개 물건 |

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

> 런타임 토큰: `--inv-zoom`, `--ui-scale`는 `editor.js`의 `applyZoom()`에서 `documentElement`에 set.
> CSS에 정의 없음이 정상 — 가드레일/미정의 검사에서 제외 대상.

---

## 9. 토큰 정식 소유 + canonical 매핑 (2026-05 일관성 작업)

### 9-A. 정식 소유 (어느 파일이 정의의 출처인가)

| 토큰 계열 | 정의 파일 | 비고 |
|---|---|---|
| `--p-*` (primitive) | `css/design-tokens.css` | 원시 값 |
| `--color-* / --bg-* / --border-* / --text-*` (semantic) | `css/design-tokens.css` | primitive 참조 |
| `--ui-*` (UI shell) | `css/editor-base.css :root` | 하드코딩 값 (기존 호환) |
| `--space-* / --radius-*` (간격·반경) | ⚠️**없다** — §10 참조 | §10 |
| `--inv-zoom / --ui-scale` (런타임) | `js/editor.js` (set) | CSS 정의 없음 = 정상 |

> 별칭/신규 토큰은 위 "정식 소유" 파일에만 추가할 것. 엉뚱한 계층에 정의 금지.

### 9-B. 미정의로 쓰이던 토큰 → canonical 별칭

이전에 정의 없이 `var(--ui-xxx, fallback)`으로만 쓰여 **fallback이 파일마다 달라 색이 갈리던** 토큰들.
`editor-base.css :root`에 별칭 정의로 **한 톤 통일** (사용처 코드는 그대로 두고 토큰만 정의 → 안전).

| 미정의였던 토큰 | → canonical | 이유 |
|---|---|---|
| `--ui-bg-panel` | `--ui-bg-card` (#252525) | 두 사용처(color-picker 팝오버·font-picker 드롭다운)가 **모두 팝업** → 팝업 표준 톤. 충돌하던 fallback(#2c2c2c/#1a1a1a)의 중간 |
| `--ui-bg-2` | `--ui-bg-base` (#1e1e1e) | grid-picker-cell 등 어두운 셀 배경 |
| `--ui-text-base` | `--ui-text` (#e0e0e0) | ai-image 패널 본문 텍스트 (fallback #f0f0f0/#ddd 불일치였음) |
| `--ui-text-main` | `--ui-text` (#e0e0e0) | color-adjust 헤더 — **fallback 없어 색이 깨지던 버그** 수정 |

> 신규 코드는 위 미정의 별칭 대신 **canonical 토큰(`--ui-bg-card` 등)을 직접** 사용할 것.

---

## 10. 간격·반경 스케일 (`--space-*` / `--radius-*`)

⚠️⚠️**이 토큰은 존재하지 않는다 — 쓰려면 먼저 만들어라.**
> 정의 **0건** · 사용 **0건** (2026-10-11 내가 쟀다 — `grep -rn -- '--space-[0-9] *:' css/` ＋
> `--radius-\(sm\|md\|lg\)`, 둘 다 0. `css/design-tokens.css` 안 「space」 글자도 **0**.
> 양성대조: 같은 자로 `--bg-app`·`--text-sub`·`--color-accent` 등 13종은 전부 정의=1 ⇒ 자는 산다).
> ⚠️**이 절의 거짓이 이미 사람을 속였다** — 2026-10-11 디자인시스템 일관성 대조에서 내가
> 아래 코드블록을 읽고 「`--space-1: 4px` 가 있다」고 적어, `css/editor-extra.css:1011`
> `margin-left:4px` 를 「토큰을 쓸 수 있는데 숫자로 박았다」는 흠으로 올렸다. 쓸 토큰이 없었다.
> ★손대기 전 이 파일 = blob `3a548c60` · 23195바이트 · 512행 (★저술 mtime 2026-10-10 09:45:16 · ⛔내 워크트리 체크아웃이 파일 mtime 을 덮었으므로 정체는 blob 으로 적는다)

~~`css/design-tokens.css` 정의.~~ **신규 UI 크롬** 코드의 padding/gap/margin/border-radius를
이 토큰으로 쓰려면 **먼저 `css/design-tokens.css` 에 정의를 만들어야 한다**(미결 — 판정 대기).

⚠️**아래는 «실재하는 정의»가 아니라 «제안된 값»이다 — 코드에 이 줄은 없다(2026-10-11 실측).**
```css
/* ⚠️⚠️ 미구현 — 이 10종은 css/ 어디에도 정의가 없다. 아래를 var() 로 쓰면 빈 값이 된다 */
--space-0: 2px;  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
--space-4: 16px; --space-5: 24px; --space-6: 32px;
--radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px;
```

**정책**
- 현재 CSS엔 px 리터럴 3078개 (흔한 값 4/8/6/10/12px 군집 + 5·11·3·7 난립). → **점진 이관** 대상이지 일괄 치환 X.
- 이관 우선순위: 색 토큰 안정화 후 → UI 크롬 CSS부터.
- ⚠️ **캔버스 콘텐츠(블록 내부 레이아웃·디자인 px)는 사용자 편집값** → 토큰 강제 금지. UI 크롬(패널/툴바/팝업)만.

---

## 11. 패널 공통 구조 + 타이포·대비 규칙

### 11-A. 패널 공통 구조
> 상세는 `docs/RIGHT_PANEL_PROPS.md §2` (단일 출처). 여기선 핵심만.

```html
<div class="prop-section">
  <div class="prop-section-title">제목</div>
  <div class="prop-row"><span class="prop-label">…</span> …입력…</div>
</div>
```
- 모든 우측 프로퍼티 패널은 `prop-section`(블록 단위) → `prop-section-title` → `prop-row`(라벨+컨트롤) 구조.
- 토글 버튼: `.prop-align-btn` (`flex:1; height:24px`) — **버튼그룹 전용**. 단독 텍스트 토글로 쓸 땐 `flex:0 0 auto` 필수(안 그러면 늘어남).
- 색 입력: `colorFieldHTML()` + `wireColorField()` (solid `onApply` / 그라데이션 `onGradient`).

### 11-B. 타이포·대비 (UI 크롬)

배경 톤별 권장 텍스트 토큰 (어두운 셸 위):

| 배경 | 본문 텍스트 | 서브/힌트 |
|---|---|---|
| `--ui-bg-base/elevated/card` (#1e~#25) | `--ui-text` (#e0e0e0) | `--ui-text-sub` (#aaa) / `--ui-text-muted` (#777) |
| `--ui-bg-input` (#2a2a2a) | `--ui-text` | `--ui-text-sub` |
| accent (`--ui-accent-primary` #2d6fe8) | `#fff` | — |

- 본문은 `--ui-text` 이상, 비활성/힌트만 `--ui-text-muted/dim`. 어두운 배경에 `--ui-text-dim`(#555) 본문 사용 금지(대비 부족).

### 11-C. 투명도(alpha/rgba) 정책
- hover tint·shadow·overlay 등 반투명은 의미 토큰 우선: `--color-selection-fill`(hover), `--color-focus-fill` 등.
- 토큰 없는 1회성 그림자/딤은 `rgba(0,0,0,α)` 허용하되 신규 반복 패턴은 토큰화 검토.

---

## 12. 가드레일 (일관성 회귀 방지)

`scripts/check-design-tokens.sh` — 신규 미정의 `--ui-*` 토큰 / 신규 UI 크롬 하드코딩 색 검출.
- 사용된 `var(--ui-*)` ∖ 정의된 `--ui-*` = 미정의 (런타임 `--ui-scale`/`--inv-zoom` 제외)
- 정의/사용 토큰 수, 하드코딩 색·px 카운트 출력 (회귀 추세 모니터)

---

## 13. ⚠️ 설계만 — §2 블록 분류 게이트 (★아직 만들지 않았다)

> **상태: 미구현.** 2026-10-11 지디 판정 = 「검사 파일 신설은 릴리스 뒤」.
> 이 절은 **무엇을 어떻게 재나**만 적는다. 만드는 사람이 이 절을 자로 쓴다.
> ★손대기 전 이 파일 = blob `4b5fa0f9` · 30162바이트 · 592행
> (출처= `git rev-parse HEAD:_context/DESIGN_SYSTEM.md` · ⛔mtime 은 워크트리가 덮는다)

### 13-A. 왜 필요한가 — 수로

2026-10-11 실측(내가 셌다): §2 가 분류한 블록 **11종** vs `.X-block.selected` 규칙을 가진
**실재 36종** ⇒ 덮개 **10/36 = 28%**(11 중 `card-block` 하나가 유령이라 실재는 10).
그 날 바뀐 `quote-block`·`modal-block`·`grid-block` 은 **셋 다 명부 밖**이었다
⇒ 「정본의 어느 줄을 어겼나」를 **댈 줄이 없었다**. 그래서 자가 필요하다.

### 13-B. 판정선 — ⛔등호(==) 금지

- **㉠ 명부 ⊇ 실재**: `실재 ∖ 명부 = ∅` ⇒ 새 블록이 §2 에 안 올라오면 빨강
- **㉡ 명부 밖 0건**: `명부 ∖ 실재 = ∅` ⇒ 문서가 없는 블록을 들면 빨강
- ⛔`명부 == 실재` 로 걸지 마라 — **∅ 를 「불일치」로 거절**해 두 방향을 못 가른다.
  두 축을 **따로** 세고, 빨강일 때 **어느 쪽인지**와 **그 이름들**을 찍어라.

**오늘(2026-10-11) 기준선** — 만든 직후 이 값이 나와야 자가 산다:
`실재 36` · `명부 11` · `실재 ∖ 명부 = 26` (㉠ **빨강**) · `명부 ∖ 실재 = 1` (㉡ **빨강**)

### 13-C. ★양성대조 — `card-block` 을 박아라

**`명부 ∖ 실재` 가 정확히 `['card-block']` 임을 단언하라.**
⇒ **그 단언이 지금 빨강이어야(=card-block 이 잡혀야) 이 자가 참이다.**
오늘 초록이 나오면 자가 **안 재고 있다**는 뜻이지 깨끗하다는 뜻이 아니다.
음성대조도 같이: 없는 이름(예: 실재에 없는 가짜 블록)을 명부에 끼워 ㉡ 가 빨개지는지 봐라.

㉠ 의 양성대조는 **고정 수로 걸지 마라** — `실재 ∖ 명부` 를 **래칫**(「26 보다 늘지 않는다」)으로
두고, 줄일 때만 기준선을 내려라. ⛔`== 26` 은 블록이 하나 늘면 «고친 사람»이 빨강을 본다.

### 13-D. ⛔⛔이 자를 만들 때의 함정 — 내가 이 문서에 **실제로 심었다**

**명부는 이 문서에서 «파생»시켜라**(⛔두 번째 손 명부를 만들지 마라). 그런데 그러면
**이 문서의 산문이 그 자의 입력이 된다.** 이 레포에서 2026-10-11 에 그 사고가 세 번 났다.

측정된 실례 — 내가 §4-D 를 쓰면서 **음성대조용 가짜 이름 `zzz-block` 을 이 문서에 들여왔다.**
그 결과 문서 전체에서 `-block` 이름을 긁는 순진한 파서는 **27 → 28종**을 본다
(2026-10-11 내가 `comm` 으로 전후를 견줘 쟀다). ⇒ 그 자는 `zzz-block` 을 명부로 센다.

**그래서 파싱 범위를 좁혀라:**
- §2 의 **「블록 분류」 절 안**만 읽어라 — `**컨테이너**` ~ `### 적용 패턴` 사이
- ⛔문서 전체 `grep` 금지 · ⛔`### 적용 패턴` 의 `.xxx-block`(자리말)을 넣지 마라
- `~~취소선~~`·`⚠️`·`⛔없음` 이 붙은 이름은 **여전히 긁힌다** — 명부에서 **뺄지 말지**를
  정하고 그 결정을 자 안에 적어라(지금 §2 의 `card-block` 이 그 꼴이다)
- 자를 만든 뒤 **「이 자가 읽는 글을 내가 고치면 명부가 움직이나」**를 한 번 흔들어 보라

### 13-E. 안 쟀다

- 이 설계는 **`.X-block.selected` 축 하나**만 본다. `:hover::after` tint·`outline-offset`·
  두께(1px/3px/1.5px)의 정합성은 **다른 자**가 필요하다.
- §2 가 말하는 **컨테이너/컴포넌트 구분**이 맞는지는 안 잰다 — 이 자는 「명부에 있나」만 센다.
