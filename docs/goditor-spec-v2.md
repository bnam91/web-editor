# Goditor Section Spec — v2

이미지 분석 봇(GPT/Gemini)이 출력하고, CDP 에이전트가 실행하는 섹션 조립 계약서.

> **v1 → v2 주요 변경**
> - Block 타입명 코드 기준으로 통일 (`asset`→`image`, `iconCircle`→`icon-circle` 등)
> - Col이 flex 비율을 직접 소유 (Row.ratio 제거)
> - version 정수 필드 + minCompatVersion 추가
> - Section.label 판단 기준 명문화
> - layout 선택 규칙 명문화
> - 단위 전부 명시 (px, 지름 등)

---

## 최상위 구조

```json
{
  "schema": "goditor-spec",
  "version": 2,
  "minCompatVersion": 1,
  "sections": [ <Section>, ... ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `schema` | string | 항상 `"goditor-spec"` 고정 |
| `version` | number | 이 JSON의 스펙 버전 (현재 2) |
| `minCompatVersion` | number | 파서 최소 지원 버전 (하위호환 범위 선언) |
| `sections` | Section[] | 1개 이상 |

---

## Section

```json
{
  "label": "Hook",
  "settings": {
    "bg": "#ffffff",
    "padX": 32,
    "padY": 32
  },
  "rows": [ <Row>, ... ]
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `label` | string | No | `""` | Hook / Main / Detail / CTA / Event — 아래 판단 기준 참조 |
| `settings` | object | No | — | 생략 시 에디터 현재 설정 유지 |
| `settings.bg` | hex | No | `"#ffffff"` | 섹션 배경색 |
| `settings.padX` | number (px) | No | `32` | 섹션 좌우 패딩. `.section-inner`의 `padding-left/right`에 직접 적용. 명시하면 페이지 레벨 `applyPagePadX` 설정을 override함 |
| `settings.padY` | number (px) | No | `32` | 상하 패딩 |
| `rows` | Row[] | **Yes** | — | 1개 이상 |

### Section.label 판단 기준

이미지 분석 봇이 섹션 목적을 판단할 때 아래 기준을 사용한다.

| label | 사용 기준 |
|-------|-----------|
| `Hook` | 제품 첫인상, 감성 어필, 브랜드 카피, 히어로 이미지 중심 |
| `Main` | 핵심 기능·스펙 소개, 제품의 why·what 설명 |
| `Detail` | 소재·사용법·세부 정보, 스펙 표, 성분 등 |
| `CTA` | 구매 유도, 가격 정보, 버튼, 프로모션 문구 |
| `Event` | 기간 한정 할인, 이벤트, 증정품 안내 |
| `""` (빈 문자열) | 판단 불가 또는 위 5가지에 해당하지 않는 경우 |

---

## Row

```json
{
  "layout": "flex",
  "cols": [ <Col>, ... ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `layout` | enum | **Yes** | `stack` \| `flex` \| `grid` |
| `cols` | Col[] | **Yes** | 열 배열 (layout별 개수 규칙 아래 참조) |

### layout 선택 규칙

이미지 분석 봇이 어떤 layout을 선택할지 판단하는 기준:

| layout | 선택 조건 | cols 개수 |
|--------|-----------|-----------|
| `stack` | 가로 분할 없이 위→아래로만 쌓이는 구조 | 정확히 1개 |
| `flex` | 2~3개 영역이 한 행에 가로로 나란히 있는 구조 | 2~3개 |
| `grid` | 동일한 카드/셀이 격자(2×2, 2×3 등)로 반복되는 구조 | `gridCols × gridRows` 개 |

**grid 사용 시 추가 필드:**

```json
{
  "layout": "grid",
  "gridCols": 2,
  "gridRows": 3,
  "cols": [ <Col>, ... ]  // gridCols × gridRows 개
}
```

---

## Col

```json
{
  "id": "col_001",
  "flex": 2,
  "blocks": [ <Block>, ... ]
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `id` | string | No | 자동 생성 | 실행 봇이 타깃 지정 시 사용 |
| `flex` | number | No | `1` | `layout: "flex"` 일 때 비율 (상대값) |
| `widthPct` | number | No | `100` | `layout: "stack"` 일 때 col 너비 % — 가능한 값: `100` `75` `66` `50` `33` `25` |
| `blocks` | Block[] | **Yes** | — | 0개 이상 (빈 col 허용) |

**flex 비율 예시:**
- `"1:2"` 레이아웃 → `[{ "flex": 1 }, { "flex": 2 }]`
- `"1:1:1"` 레이아웃 → `[{ "flex": 1 }, { "flex": 1 }, { "flex": 1 }]`
- `"1:2:1"` 레이아웃 → `[{ "flex": 1 }, { "flex": 2 }, { "flex": 1 }]`

---

## Block 공통 구조

모든 Block은 `type` 필드를 반드시 포함한다.

```json
{ "type": "<block-type>", ...타입별 필드 }
```

---

## Block 타입 목록

### `text`

```json
{ "type": "text", "style": "h1", "content": "제목 텍스트", "align": "center" }
```

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `style` | 아래 표 참조 | `"body"` | 텍스트 스타일 |
| `content` | string | `""` | 텍스트 내용. 추출 불가 시 `""` |
| `align` | `"left"` \| `"center"` \| `"right"` | `"left"` | 정렬 |

**style 판단 기준 (이미지 분석 봇용):**

| style | 용도 | 판단 기준 |
|-------|------|-----------|
| `h1` | 섹션 메인 헤드라인 | 섹션에서 가장 큰 텍스트 |
| `h2` | 서브 헤드라인 | h1보다 작고 강조된 제목 |
| `h3` | 항목 제목 | 리스트 항목 또는 소항목 제목 |
| `body` | 본문 설명 | 일반 문장, 설명 단락 |
| `caption` | 부연 설명 | 이미지 하단 설명, 작은 주석 |
| `label` | 태그형 텍스트 | 칩/뱃지 형태의 짧은 분류 텍스트 |

---

### `image`

> v1의 `asset` → v2에서 `image`로 변경

```json
{ "type": "image", "preset": "standard", "alt": "제품 이미지" }
```

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `preset` | 아래 표 참조 | `"standard"` | 이미지 영역 크기 프리셋 |
| `alt` | string | `""` | 이미지 내용 설명 (이미지 분석 봇이 채울 것) |

**preset 판단 기준:**

| preset | 크기 | 용도 / 선택 기준 |
|--------|------|-----------------|
| `standard` | 780px 높이 | 일반 제품 이미지, 기본값 |
| `square` | 860×860px | 정사각형 비율 이미지 |
| `tall` | 1032px 높이 | 세로가 긴 이미지 (3:4, 2:3 비율) |
| `wide` | 575px 높이 | 가로가 넓은 이미지 (배너, 16:9) |
| `logo` | 200×64px | 브랜드 로고, 인증 마크 등 작은 이미지 |

---

### `gap`

```json
{ "type": "gap", "height": 40 }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `height` | number (px 단위, 지름 아님) | `40` |

---

### `divider`

```json
{ "type": "divider", "color": "#cccccc", "lineStyle": "solid", "weight": 1 }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `color` | hex | `"#cccccc"` |
| `lineStyle` | `"solid"` \| `"dashed"` \| `"dotted"` | `"solid"` |
| `weight` | number (px 단위) | `1` |

> v1의 `style` → v2에서 `lineStyle`로 변경 (Block 공통 `type` 필드와 혼동 방지)

---

### `icon-circle`

> v1의 `iconCircle` → v2에서 `icon-circle`로 변경

```json
{ "type": "icon-circle", "size": 240, "bgColor": "#e8e8e8" }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `size` | number (px 단위, **지름** 기준) | `240` |
| `bgColor` | hex | `"#e8e8e8"` |

---

### `label-group`

> v1의 `labelGroup` → v2에서 `label-group`으로 변경

```json
{ "type": "label-group", "labels": ["특징1", "특징2", "특징3"] }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `labels` | string[] | `["라벨"]` |

---

### `table`

```json
{ "type": "table", "showHeader": true, "cellAlign": "center" }
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `showHeader` | boolean | `true` |
| `cellAlign` | `"left"` \| `"center"` \| `"right"` | `"center"` |

> 표 내용(headers, rows 데이터)은 v3에서 추가 예정. 현재는 빈 표 생성 후 수동 편집.

---

### `card` (DEPRECATED → `canvas-card`)

> **폐기**: 구 `cdb` 카드 블록(`addCardBlock`)은 제거됨. 카드는 `canvas-card`(canvas-block, `cardMode: "simple"`)로 재정의됨. 신규 spec은 아래 `canvas-card`를 사용할 것.

```json
{ "type": "canvas-card", "cardMode": "simple", "gridCols": 1, "gridRows": 1,
  "cards": [ { "title": "카드 제목", "desc": "", "imgSrc": "", "cellBg": "" } ] }
```

`canvas-card`는 canvas-block의 Simple Card Mode다. 자세한 필드는 아래 `canvas` 타입 참조.

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `cardMode` | `"simple"` | — | simple 카드 모드 (지정 시 `cards[]` 그리드) |
| `gridCols` | number | `1` | 카드 그리드 열 수 |
| `gridRows` | number | `1` | 카드 그리드 행 수 |
| `cardGap` | number (px) | `12` | 카드 간 간격 |
| `cards` | `{ title, desc, imgSrc, cellBg }[]` | 1개 샘플 | 카드 데이터 (gridCols × gridRows 개) |
| `bg` | hex \| `"transparent"` | `"transparent"` | 블록 배경 |
| `radius` | number (px 단위) | `12` | 모서리 반경 |

---

### `graph`

```json
{
  "type": "graph",
  "chartType": "bar-v",
  "items": [
    { "label": "항목A", "value": 80 },
    { "label": "항목B", "value": 60 }
  ]
}
```

| 필드 | 값 | 기본값 |
|------|----|--------|
| `chartType` | `"bar-v"` \| `"bar-h"` | `"bar-v"` |
| `items` | `{ label: string, value: number(0~100) }[]` | 5개 샘플 |

> **이미지 분석 봇 주의**: 이미지에서 수치 추출이 불확실할 경우 `items: []`로 빈 배열 전달. 실행 봇이 에디터 기본값으로 생성.

---

## 신규 블록 타입 (v2.4)

> v2.4에서 추가된 컴포넌트 블록. 모두 에디터 `window.add*Block` 함수에 1:1 매핑되며, PM/MCP `update_*_block` 도구로 수정 가능. 각 add/update API 시그니처는 `goditor-api-reference.md` 참조.

### `comparison`

제품 비교표 블록. (DOM `.comparison-block`)

```json
{ "type": "comparison", "featured": 0,
  "cols": [ { "title": "A사", "bg": "#fff", "rows": ["항목1", "항목2"] }, { "title": "우리", "rows": [] } ] }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `cols` | `{ title, bg?, rows[] }[]` | 칼럼 2~8개. `rows` 항목은 문자열 또는 `{type:'text'\|'image', text?, imgSrc?, imgFit?}` |
| `featured` | number | 강조 칼럼 index |

---

### `canvas-card` (cvb)

자유 배치(layers) 또는 Simple Card Mode 겸용 캔버스 블록. (DOM `.canvas-block`, id prefix `cvb_`)

```json
{ "type": "canvas-card", "cardMode": "simple",
  "gridCols": 1, "gridRows": 1,
  "cards": [ { "title": "카드 제목", "desc": "", "imgSrc": "", "cellBg": "" } ] }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `cardMode` | `"simple"` (생략 시 레이어 모드) | simple = `cards[]` 그리드, 미지정 = `layers[]` 자유배치 |
| `cards` | `{ title, desc, imgSrc, cellBg }[]` | simple 모드 카드 데이터 |
| `gridCols` / `gridRows` | number | 카드 그리드 크기 |
| `layers` | object[] | 레이어 모드 자유배치 요소 |

> 옵션 없이 호출하면 기본 심플 카드 템플릿(width 360 / height 480 / cardMode simple)으로 생성됨.

---

### `chat`

말풍선 대화형 블록. (DOM `.chat-block`)

```json
{ "type": "chat", "messages": [ { "text": "안녕하세요", "align": "left" }, { "text": "네!", "align": "right" } ] }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `messages` | `{ text, align: 'left'\|'right' }[]` | 메시지 배열 |
| `bgLeft` / `bgRight` | hex | 좌/우 말풍선 배경 |
| `showProfile` | boolean | 프로필 표시 |

---

### `step`

단계(스텝) 안내 블록. (DOM `.step-block`)

```json
{ "type": "step", "steps": [ { "title": "1단계", "desc": "설명" }, { "title": "2단계" } ] }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `steps` | `{ title, desc? }[]` | 1~10개 |
| `stepStyle` / `stepOrient` / `stepAlign` | enum | 스타일/방향/정렬 |
| `connector` | boolean | 단계 연결선 |

---

### `laurel`

월계관(인증/수상) 블록. (DOM `.laurel-block`, id prefix `lrb_`)

```json
{ "type": "laurel", "gridCols": 1, "gridRows": 1,
  "cells": [ { "lines": [ { "text": "1위", "fontSize": 40 } ], "leafFill": "gold" } ] }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `cells` | `{ lines[], leafColor?, leafFill?, gap?, height? }[]` | 월계관 셀 |
| `gridCols` / `gridRows` | number | 셀 그리드 |

---

### `mockup`

디바이스 목업 블록. (DOM `.mockup-block`)

```json
{ "type": "mockup", "deviceKey": "iphone", "width": 360, "imgSrc": "", "shadow": "soft" }
```

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `deviceKey` | `window.MOCKUP_DEVICES` 키 | `"iphone"` | 디바이스 종류 |
| `width` | number (px) | 디바이스 기본값 | 100~860 clamp |
| `imgSrc` | string | `""` | 스크린 이미지 |
| `shadow` | string | `"soft"` | 그림자 |

---

### `banner`

프리셋 기반 배너(frame) 블록. (DOM `.frame-block`, `dataset.bannerPreset`)

```json
{ "type": "banner", "preset": "frame_8" }
```

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `preset` | `window.BANNER_PRESETS` 키 | `"frame_8"` | 배너 프리셋 |

---

### `banner02`

텍스트+이미지 변형 배너 블록. (DOM `.banner02-block`)

```json
{ "type": "banner02", "variant": "default", "title": "제목", "sub": "부제", "imgSrc": "" }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `variant` | `window.BANNER02_VARIANTS` 키 | 배너 변형 |
| `label` / `title` / `sub` | string | 텍스트 |
| `imgSrc` | string | 이미지 |
| `layout` | `"left"` \| `"right"` | 텍스트/이미지 좌우 배치 |

---

### `gradient`

그라데이션 배경 블록 (섹션 직속 absolute). (DOM `.gradient-block`)

```json
{ "type": "gradient", "style": "linear", "direction": "to bottom",
  "startColor": "#ffffff", "endColor": "#000000", "width": 600, "height": 300 }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `style` | `"linear"` \| `"radial"` | 그라데이션 종류 |
| `direction` | 8방향 enum | linear 전용 |
| `startColor` / `endColor` | `#RRGGBB` | 시작/끝 색 |
| `startAlpha` / `endAlpha` | 0~1 | 투명도 |
| `width` / `height` | number (px) | 크기 |

---

### `sticker`

스티커(절대 위치) 블록. (DOM `.sticker-block`, 섹션 직속 absolute)

```json
{ "type": "sticker", "shape": "circle", "text": "NEW", "x": 40, "y": 40 }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `shape` | `"circle"` \| `"square"` \| `"text"` \| `"highlight"` \| `"highlightB"` | 스티커 형태 (polymorphic — shape별 활성 필드 상이) |
| `text` | string | 텍스트 |
| `x` / `y` | number (px) | 섹션 기준 좌표 (미지정 시 cascade offset) |

---

### `liner`

라이너(텍스트 강조선) 블록.

```json
{ "type": "liner" }
```

> `window.addLinerBlock`으로 생성. 세부 필드는 에디터 기본값 사용 후 속성 패널/`update`로 편집.

---

### `vector` (1급 타입)

> v2.2의 `joker`(Figma 패스스루)와 별개로, **vector를 1급 블록 타입으로 승격**. SVG 패스/펜툴 도형을 에디터 네이티브 블록으로 보존·편집. (DOM `.vector-block`)

```json
{ "type": "vector", "svg": "<svg ...>...</svg>", "color": "#000000", "w": 200, "h": 200 }
```

| 필드 | 값 | 설명 |
|------|----|------|
| `svg` | string (≤200000) | SVG 마크업 |
| `color` | hex/rgb(a)/hsl(a)/transparent | 색상 |
| `w` / `h` | int 10~4000 | 크기 |

> **joker vs vector**: `joker`는 Figma 임포트 시 변환 불가 요소의 읽기 위주 패스스루 컨테이너(frame children). `vector`는 섹션 플로우에 들어가는 편집 가능한 1급 블록.

---

### `speech-bubble`

말풍선 단일 블록.

```json
{ "type": "speech-bubble" }
```

> `window.addSpeechBubbleBlock`으로 생성 (block-factory). 세부 필드는 에디터 기본값/속성 패널 편집.

---

### `iconify`

Iconify 아이콘 블록. (DOM `.icon-block`)

```json
{ "type": "iconify", "iconName": "mdi:home", "size": 64 }
```

| 필드 | 값 | 기본값 | 설명 |
|------|----|--------|------|
| `iconName` | `"prefix:icon-name"` | — | Iconify 아이콘 ID |
| `size` | number (px) | `64` | 16~512 |
| `iconColor` | hex/rgb(a)/hsl(a)/transparent | — | 색상 (currentColor) |
| `rotation` | `0`\|`90`\|`180`\|`270` | `0` | 회전 |

---

### `frame`

> v2.2에서 `sub-section`으로 도입된 타입. v2.3에서 `frame`으로 변경 (에디터 `.frame-block` 명칭 통일).

Auto-layout frame 또는 free-layout frame 컨테이너. 내부에 `joker` 블록을 절대 위치로 포함하거나 auto-layout으로 블록을 배치한다.

```json
{
  "type": "frame",
  "label": "Frame 2",
  "width": 453,
  "height": 241,
  "x": 204,
  "bg": "#1e1e1e",
  "children": [
    {
      "type": "joker",
      "label": "Star 1",
      "svg": "<svg>...</svg>",
      "width": 174,
      "height": 174,
      "x": 53,
      "y": 33
    }
  ]
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `label` | string | No | `"Frame"` | 레이어 패널 이름 |
| `width` | number (px) | **Yes** | — | frame 너비 |
| `height` | number (px) | **Yes** | — | frame 높이 (클리핑 기준) |
| `x` | number (px) | No | `0` | 섹션 내 X 위치 (marginLeft) |
| `bg` | hex | No | `"#f5f5f5"` | 배경색 |
| `children` | joker[] | No | `[]` | 내부 조커 블록 배열 |

> **에디터 DOM**: `.frame-block` / `.frame-inner` 구조 사용. `overflow: hidden` 적용 — frame 경계 밖으로 나간 자식은 잘려서 보이지 않음 (Figma 프레임 클리핑과 동일)

---

### `joker`

Figma에서 에디터 기본 블록으로 표현 불가능한 요소(VECTOR, STAR, POLYGON, CONNECTOR, GROUP 등)를 SVG로 보존하는 패스스루 블록.

```json
{
  "type": "joker",
  "label": "Arrow 1",
  "svg": "<svg width=\"325\" height=\"15\" ...>...</svg>",
  "width": 325,
  "height": 15,
  "x": 268,
  "y": 0
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `label` | string | No | `"Figma Component"` | 레이어 패널 이름 |
| `svg` | string | No | `""` | SVG 마크업 전체. 없으면 회색 placeholder |
| `width` | number (px) | **Yes** | — | 렌더 너비 |
| `height` | number (px) | **Yes** | — | 렌더 높이 |
| `x` | number (px) | No | `0` | X 오프셋. 섹션 직계 자식이면 `transform: translateX`, 서브섹션 자식이면 `left` |
| `y` | number (px) | No | `0` | Y 오프셋. 서브섹션 자식일 때만 유효 (`top`) |

**Figma 노드 → joker 변환 기준:**

| Figma 타입 | 처리 |
|-----------|------|
| ELLIPSE, VECTOR, STAR, POLYGON, BOOLEAN_OPERATION | joker (SVG 추출) |
| CONNECTOR, LINE 등 얇은 요소 | joker (SVG 자연 크기 우선 — bbox가 hit area 포함 시 SVG dims 사용) |
| GROUP | joker (그룹 전체 SVG 추출, 단일 블록으로) |
| FRAME (레벨 1) | frame (재귀 처리) |
| 기타 | joker (SVG 추출 시도, 실패 시 빈 joker) |

---

## 전체 예시 — 이미지+텍스트 2열 섹션

```json
{
  "schema": "goditor-spec",
  "version": 2,
  "minCompatVersion": 1,
  "sections": [
    {
      "label": "Hook",
      "settings": { "bg": "#f9f9f9", "padX": 32, "padY": 48 },
      "rows": [
        {
          "layout": "flex",
          "cols": [
            {
              "id": "col_001",
              "flex": 1,
              "blocks": [
                { "type": "image", "preset": "square", "alt": "제품 정면 이미지" }
              ]
            },
            {
              "id": "col_002",
              "flex": 2,
              "blocks": [
                { "type": "text", "style": "label", "content": "브랜드명", "align": "left" },
                { "type": "text", "style": "h1", "content": "메인 카피라이팅", "align": "left" },
                { "type": "gap", "height": 16 },
                { "type": "text", "style": "body", "content": "제품 설명 문장이 들어갑니다.", "align": "left" },
                { "type": "label-group", "labels": ["특징1", "특징2", "특징3"] }
              ]
            }
          ]
        },
        {
          "layout": "stack",
          "cols": [
            {
              "widthPct": 100,
              "blocks": [
                { "type": "divider", "color": "#e0e0e0" },
                { "type": "text", "style": "caption", "content": "주의사항 문구", "align": "center" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 이미지 분석 봇 지시 요약

GPT/Gemini에게 전달할 시스템 프롬프트 핵심 포인트:

1. **섹션 목적 판단** → `label` (Hook/Main/Detail/CTA/Event/"")
2. **레이아웃 구조 파악** → `layout` 결정 규칙 (단열=stack, 가로분할=flex, 격자=grid)
3. **Col 비율 추정** → `flex` 값 (예: 왼쪽이 좁으면 1, 오른쪽이 넓으면 2)
4. **블록 타입 식별** → text/image/gap/divider/icon-circle/label-group/table/graph + 신규: comparison/canvas-card/chat/step/laurel/mockup/banner/banner02/gradient/sticker/liner/vector/speech-bubble/iconify (구 `card`는 `canvas-card`로 대체)
5. **텍스트 스타일 판단** → h1/h2/h3/body/caption/label 기준표 참조
6. **이미지 preset 선택** → standard/square/tall/wide/logo 기준표 참조
7. **수치 추출 불확실 시** → `content: ""`, `items: []` 등 빈 값 사용
8. **출력 규칙** → JSON만 출력, 설명 텍스트 없이, `"schema": "goditor-spec"` 필드 반드시 포함

---

## v1 → v2 마이그레이션 가이드

| v1 | v2 | 비고 |
|----|----|----|
| `"schema": "goditor-spec/v1"` | `"schema": "goditor-spec"` + `"version": 2` | 버전 분리 |
| `"type": "asset"` | `"type": "image"` | 코드 기준 통일 |
| `"type": "iconCircle"` | `"type": "icon-circle"` | kebab-case |
| `"type": "labelGroup"` | `"type": "label-group"` | kebab-case |
| `Row.ratio: "1:2"` | `Col.flex: 1` / `Col.flex: 2` | Col 소유 구조 |
| `Row.ratio: "100"` | `Col.widthPct: 100` | 필드명 명확화 |
| `divider.style` | `divider.lineStyle` | type 충돌 방지 |
| `"type": "sub-section"` | `"type": "frame"` | 클래스명 통일 (web editor rename) |
| `"type": "card"` (cdb) | `"type": "canvas-card"` (cvb, `cardMode: "simple"`) | 카드 블록 → canvas-block 통합 (v2.4) |

---

## 버전 히스토리

| 버전 | 날짜 | 변경 |
|------|------|------|
| v1 | 2026-04-03 | 초안 |
| v2 | 2026-04-03 | 타입명 통일, Col flex 소유, 버전 필드, label/layout 판단 기준, 단위 명시 |
| v2.1 | 2026-04-03 | `settings.padX` 설명 갱신 — 섹션 레벨 override 동작 명시 (페이지 레벨 `applyPagePadX` 우선순위 구조 반영) |
| v2.2 | 2026-04-03 | `sub-section`, `joker` 블록 타입 추가 (Figma 임포트 파이프라인 대응) |
| v2.3 | 2026-04-07 | `sub-section` 타입 → `frame` 타입으로 변경 (에디터 frame-block 명칭 통일) |
| v2.4 | 2026-06-15 | 신규 블록 타입 14종 추가 (comparison/canvas-card(cvb)/chat/step/laurel/mockup/banner/banner02/gradient/sticker/liner/vector/speech-bubble/iconify). 구 `card`(cdb) 타입 폐기 → `canvas-card`(canvas-block `cardMode: "simple"`)로 재정의. `vector`를 1급 타입으로 승격(joker 패스스루와 구분) |
