---
name: goditor-layout-planner
description: 이미지를 분석해 Goditor Spec v2 JSON 파일을 작성한다. 에디터 조립은 하지 않는다.
version: 1.0.0
---

# goditor-layout-planner

## 역할

이미지를 받아 Goditor Spec v2 JSON 파일로 변환한다.
**이 스킬은 분석과 문서화만 담당한다. 에디터 조립은 `/goditor-layout-generator`가 한다.**

---

## 입력

```
이미지 경로: /path/to/image.jpg
출력 경로: /tmp/goditor_spec_{이름}.json   (생략 시 이미지 파일명 기반으로 자동 결정)
```

---

## 실행 순서

1. **그리드 오버레이 생성** — 원본 이미지에 20열 그리드를 입힌 분석용 이미지 생성
2. Read 툴로 **그리드 오버레이 이미지** 열기 (원본 아님)
3. **목표 높이 계산** — `860 × (원본높이 / 원본너비)` px
4. **이미지 분석** — 그리드 좌표 기준으로 진행
5. **구현 가능성 분석** — API 지원 여부 확인
6. Spec v2 JSON 파일 저장
7. **자기검토** — 그리드 이미지를 다시 보고 아래 체크리스트 확인 (문제 발견 시 Spec 수정 후 재저장)
8. 저장 경로 출력 후 종료

### Step 1. 그리드 오버레이 생성

```bash
python3 /Users/a1/web-editor/scripts/goditor_grid_overlay.py "{이미지경로}"
```

출력 결과에서 아래 값을 반드시 기록한다:
- **출력 파일 경로** (이후 Read 툴에 사용)
- **col_w** (열 너비 px) — 좌표 변환 공식에 사용
- **row_h** (행 높이 px) — 좌표 변환 공식에 사용

### 그리드 좌표 변환 공식

```
x      = 열 인덱스(A=0, B=1, ...) × col_w
width  = 열 개수 × col_w
y      = (행 번호 - 1) × row_h
height = 행 개수 × row_h
```

예시 — col_w=43px, row_h=43px:
- `A1:E3` → x=0, width=215, y=0, height=129
- `F1:J3` → x=215, width=215, y=0, height=129
- `K2:T8` → x=430, width=430, y=43, height=301

---

## 이미지 분석 순서 (Step 3 세부)

### A. 격자 분석 (가장 먼저 — 공간 골격 확정)

**그리드 오버레이 이미지**를 기준으로 분석한다. 열 라벨(A~T)과 행 라벨(1~N)을 직접 읽어 좌표를 결정한다.

1. **좌우 마진** — 콘텐츠가 몇 번째 열부터 시작하는가
   - A열부터 시작 → paddingX 없음
   - B열 이후 시작 → `paddingX = 시작열인덱스 × col_w`
2. **칼럼 수** — 콘텐츠가 몇 개 열 구역으로 나뉘는가
   - 1구역 → `stack`
   - 2~3구역 → `frame`
3. **칼럼 범위** — 각 구역이 몇 열을 차지하는가
   - 예: 왼쪽 구역이 A~J(10열), 오른쪽이 K~T(10열) → flex 1:1
   - 예: 왼쪽 A~H(8열), 오른쪽 I~T(12열) → flex 2:3
4. **거터** — 칼럼 사이 빈 열이 있는가
   - 현재 API 미지원 → Spec `note`에 기록
5. **상하 마진** — 콘텐츠가 몇 행부터 시작/끝나는가
   - `y_start = (시작행 - 1) × row_h` → gap 높이로 사용

### B. 색상 (5단계 흑백 팔레트 고정)

레이아웃 카피 목적이므로 색상은 **아래 5단계만 사용**한다. 원본 색상을 그대로 쓰지 않는다.

| 레벨 | hex | 용도 |
|------|-----|------|
| L1 | `#222222` | 어두운 배경 |
| L2 | `#444444` | 보조 배경 (카드, 구분선) |
| L3 | `#888888` | 보조 요소 (icon-circle bgColor, 보조 텍스트) |
| L4 | `#cccccc` | 서브 텍스트 (caption, 부제목) |
| L5 | `#ffffff` | 메인 텍스트, 강조 |

밝은 배경 섹션은 반전 적용 (L1↔L5).

**배경색 판단**: 원본이 어두우면 `bg: #222222`, 밝으면 `bg: #ffffff`, 중간이면 `bg: #444444`.

### C. 블록 위→아래 순서대로 식별

격자가 확정된 후, 각 col 안을 위→아래로:

| 블록 유형 | 확인 항목 |
|-----------|-----------|
| **텍스트** | 내용 그대로, style(h1~label 중), 색상 hex, 정렬(left/center/right), 줄 수 |
| **이미지/아이콘** | **형태를 먼저 판단** → 아래 이미지 블록 타입 선택 기준 참고 |
| **갭** | 위아래 여백이 목표 높이의 몇 % → px 환산 |
| **구분선** | 색상, 두께, 스타일(solid/dashed/dotted) |
| **라벨그룹** | 태그 텍스트 목록 |

### 이미지/아이콘 블록 타입 선택 기준 (형태 우선)

이미지 요소를 발견하면 **preset보다 형태를 먼저 본다.**

| 형태 | 블록 타입 | 비고 |
|------|-----------|------|
| **원형** (뱃지, 인장, 엠블럼, 원형 로고) | `icon-circle` | `size` = 목표높이 × 지름비율, `bgColor` 추정 |
| **가로형 로고** (텍스트+심볼 조합, 가로로 긴 형태) | `image: logo` | 200×64px 고정 |
| **정사각 또는 세로형 제품 이미지** | `image: standard/square/tall` | 높이 비율로 preset 선택 |
| **와이드 가로 이미지** | `image: wide` | |

**핵심 규칙**: 형태가 원형이면 `icon-circle`. 직사각형이면 `image`. 가로세로비로 착각하지 말 것.

### D. 수치 확정 (분석 후 한 번에 계산)

```
목표 섹션 높이  = 860 × (원본높이 / 원본너비)
paddingX       = 860 × (좌우 마진 / 전체 너비)
콘텐츠 너비    = 860 - 2 × paddingX   ← paddingX 있을 때 이 값 기준으로 이하 계산
flex 비율       = 칼럼 너비 / 콘텐츠 너비  →  정수비 변환
gap height     = 목표 높이 × (여백 세로 비율)
fontSize       = 목표 높이 × (텍스트 세로 비율) × 0.75
image preset   = 목표 높이 × 이미지 비율 → 가장 가까운 preset 선택

paddingX 적용 순서:
  1. section.settings.paddingX 에 px 값 명시 → 러너가 section-inner에 좌우 padding-left/right 직접 적용
     → dataset.paddingX에 저장되어 페이지 레벨 applyPagePadX() override 플래그 역할
  2. section.settings.paddingX 생략 시 → 페이지 레벨 applyPagePadX() 값이 해당 섹션에 적용됨
     (섹션 레벨 dataset.paddingX 없는 섹션만 일괄 적용 대상)
  3. 이후 모든 너비 계산은 콘텐츠 너비(860 - 2×paddingX) 기준으로 수행
  4. flex col 너비:
       col_gap = 12px (flex row의 gap 고정값)
       col 유효 너비 = (콘텐츠 너비 - col_gap × (열수-1)) × (해당 col flex / 전체 flex 합)
  5. fontSize 줄바꿈 체크: 위 col 유효 너비 기준으로 글자 수 확인
  6. 블록 개별 너비 제어 (asset/text 블록에 paddingX 지정 시):
       block_paddingX = (860 - desired_width) / 2 - section_paddingX
       → section-inner가 이미 좁혀진 상태이므로 section_paddingX를 반드시 빼야 함
       예) section_paddingX=60, 원하는 너비=430px
           block_paddingX = (860-430)/2 - 60 = 215 - 60 = 155px

paddingY (섹션 상하 여백):
  콘텐츠 높이 = 섹션 안 각 블록(gap + text row + image row 등) 높이 합산
               text row 높이 ≈ fontSize × 1.4  (line-height 포함)
               image row 높이 = preset 고정값 (standard 780 / wide 575 / logo 64 등)
               gap 높이 = 지정값 그대로
  paddingY   = (목표 섹션 높이 - 콘텐츠 높이) / 2
  → 음수이면 0으로 설정 (콘텐츠가 이미 목표보다 큼)
  → 섹션 상단·하단 gap 각각 paddingY px
```

---

## Spec v2 포맷

```json
{
  "schema": "goditor-spec",
  "version": 2,
  "sections": [
    {
      "label": "Hook|Main|Detail|CTA|Event|''",
      "settings": {
        "bg": "#ffffff",
        "paddingX": 80,
        "paddingY": 40
      },
      "rows": [
        {
          "layout": "stack|flex|grid|sub-section",
          "cols": [
            {
              "flex": 1,
              "blocks": []
            }
          ]
        }
      ]
    }
  ]
}
```

- `settings.bg`: 섹션 배경색 hex. 없으면 생략
- `settings.paddingX`: 섹션 좌우 안쪽 여백(px). 없으면 생략
- `settings.paddingY`: 섹션 상단·하단 gap 높이(px). `(목표높이 - 콘텐츠높이) / 2`로 계산. 없으면 기본 100px

> ⚠️ **`addSection`은 `paddingY` 높이의 gap block을 상/하에 자동 생성한다.**  
> Spec의 첫 번째 row 맨 앞과 마지막 row 맨 뒤에 gap block을 **절대 추가하지 말 것**.  
> 상하 여백은 반드시 `settings.paddingY`로만 제어한다.  
> 명시하지 않으면 기본값 100px gap이 자동 생성된다.

---

## 블록 타입

| 타입 | 필드 |
|------|------|
| `text` | `style`: h1/h2/h3/body/caption/label, `content`, `align`: left/center/right, `color`, `fontSize` |

### text style 선택 기준

style은 의미적 역할 기준으로 선택한다. 실제 크기는 `fontSize`로 별도 지정하므로 style의 기본 크기에 의존하지 않는다.

| style | 사용 기준 |
|-------|-----------|
| `h1` | 섹션에서 가장 큰 헤드라인 (브랜드명, 제품명, 메인 카피) |
| `h2` | 두 번째 수준 제목 (서브 카피, 섹션 소제목) |
| `h3` | 세 번째 수준 제목 (항목명, 기능명) |
| `body` | 본문 설명 텍스트 (2줄 이상 설명, 상세 내용) |
| `caption` | 보조 텍스트 (이미지 하단 주석, 작은 부연 설명) |
| `label` | 짧은 분류/태그 텍스트 (뱃지, 카테고리, 1~3단어) |
| `image` | `preset`: standard/square/tall/wide/logo |
| `gap` | `height`: px |
| `divider` | `color`, `lineStyle`: solid/dashed/dotted, `weight` |
| `icon-circle` | `size`, `bgColor` |
| `label-group` | `labels: []` |
| `table` | `showHeader`, `cellAlign` |
| `card` | `count`, `bgColor`, `radius` |
| `graph` | `chartType`: bar-v/bar-h, `items: [{label, value}]` |

---

## layout 선택 기준

| layout | 사용 시점 |
|--------|-----------|
| `stack` | 단일 열, 위→아래 블록 나열 |
| `frame` | 2~3열 가로 배치 (절대좌표 기반) |
| `sub-section` | **이미지 내 배경색이 2개 이상일 때** — 배경 구역별로 row를 분리 |

> `grid` 와 `flex` 는 사용하지 않는다. 다열 레이아웃은 모두 `frame` 으로 처리.

### frame layout 사용법

`frame` row는 **freeLayout Frame + 절대좌표 배치** 방식으로 동작한다.  
각 col이 계산된 x 위치에 고정되고, col 내부 블록은 y를 순차적으로 쌓는다.

```json
{
  "layout": "frame",
  "frameHeight": 580,
  "cols": [
    {
      "flex": 1,
      "blocks": [
        { "type": "gap", "height": 40 },
        { "type": "text", "style": "h2", "content": "제목", "fontSize": 48, "color": "#ffffff", "align": "center", "height": 67 },
        { "type": "image", "preset": "standard" }
      ]
    },
    {
      "flex": 1,
      "blocks": [
        { "type": "gap", "height": 60 },
        { "type": "text", "style": "body", "content": "본문 내용", "fontSize": 24, "color": "#cccccc", "height": 34 }
      ]
    }
  ]
}
```

**필수 필드:**
- `frameHeight` (px): 전체 frame 높이. `max(각 col 블록 높이 합산)` 으로 계산
- 각 col의 `flex`: 너비 비율 (러너가 `860 × flex / totalFlex` 로 colW 계산)
- text 블록에 `height` 필드 필수: `Math.ceil(fontSize × lineCount × 1.4)`

**col x/width 계산 (러너가 자동 처리):**
```
totalFlex = sum of all col.flex
colW[i]   = Math.round(860 × col[i].flex / totalFlex)
colX[i]   = sum of colW[0..i-1]
```

**블록 y 계산 (러너가 자동 처리):**  
col 내 블록을 위→아래로 순회하면서 `y += getBlockHeight(block)`:
- `gap`: `block.height`
- `image`: preset 고정값 (standard 780 / square 860 / tall 1032 / wide 575 / logo 64)
- `text`: `block.height` (Spec에 명시 필수)
- `divider`: 2px
- `icon-circle`: `block.size`

**frameHeight 계산 방법:**
```
각 col의 블록 높이 합산 → maxColH = max(colHeights)
frameHeight = maxColH
```

### sub-section layout 사용법

이미지 내부에 배경색이 2개(예: 상단 어두움 + 하단 밝음)인 경우,
섹션은 **지배적 배경색(가장 넓은 영역)**으로 설정하고,
다른 배경 구역은 `layout: "sub-section"` row로 감싼다.

```json
{
  "label": "Hook",
  "settings": { "bg": "#ffffff" },
  "rows": [
    {
      "layout": "sub-section",
      "bg": "#222222",
      "cols": [{ "blocks": [
        { "type": "image", "preset": "standard" },
        { "type": "text", "style": "h1", "content": "제목", "color": "#ffffff" },
        { "type": "gap", "height": 40 }
      ]}]
    },
    {
      "layout": "stack",
      "cols": [{ "blocks": [
        { "type": "text", "style": "body", "content": "본문", "color": "#222222" }
      ]}]
    }
  ]
}
```

**규칙:**
- `sub-section` row는 `bg` 필드 필수
- `cols`는 반드시 1개 (단일 열 플로우 레이아웃, flex 미지원)
- `sub-section` 안 블록은 `text`, `image`, `gap`만 지원 (flex row, grid 불가)
- `sub-section` 밖의 배경이 섹션 bg — 즉, 섹션 bg는 sub-section이 **아닌** 구역의 색

---

## image preset 선택 기준

계산된 이미지 높이(`목표 섹션 높이 × 이미지 세로 비율`)를 아래 기준으로 매핑한다:

| 계산값 범위 | 선택 preset | 실제 높이 |
|-------------|-------------|-----------|
| ~ 650px | `wide` | 575px |
| 650 ~ 830px | `standard` | 780px |
| 830 ~ 950px | `square` | 860px |
| 950px ~ | `tall` | 1032px |
| 작은 로고/뱃지 | `logo` | 200×64px |

> ⚠️ **logo preset은 width가 200px으로 고정**이다. Spec에 `width` 필드를 쓰지 않는다.
> runner가 colW를 width로 전달하면 고정값이 깨진다 → runner는 logo일 때 width opts를 제외하도록 구현돼 있음.
> 참고: `/Users/a1/web-editor/docs/memo-logo-fixed-width-issue.md`

---

## text fontSize 기본값 (px)

| style | 기본값 |
|-------|--------|
| h1 | 104 |
| h2 | 72 |
| h3 | 48 |
| body | 28 |
| caption | 20 |
| label | 18 |

**fontSize 추정 방법**: 기본값을 그대로 쓰지 말고, 이미지에서 텍스트 높이를 섹션 전체 높이 대비 비율로 추정해 계산한다.

```
목표 섹션 높이 = 860 × (원본 이미지 높이 / 원본 이미지 너비)
텍스트 높이(px) ≈ 목표 섹션 높이 × (텍스트가 차지하는 세로 비율)
fontSize ≈ 텍스트 높이 / 1.10  (에디터 실측 line-height 계수)
```

예: 섹션 높이 300px, h1이 섹션의 약 20%를 차지 → 텍스트 높이 60px → fontSize ≈ 45

**추가 주의**: flex 레이아웃에서 col 너비가 좁으면 기본 fontSize가 줄바꿈을 일으킨다.
col 너비(860px × flex 비율)와 텍스트 글자 수를 함께 고려해 fontSize를 반드시 명시한다.

---

## 자연 줄바꿈 fontSize 계산 엔진

텍스트를 `\n` 없이 연속으로 쓰고 너비+fontSize로 자연 줄바꿈에 맡긴다.
원본에서 줄바꿈 위치가 맞으려면 fontSize를 역산해야 한다.

### Pretendard 문자 너비 계수 (fontSize 대비)

| 문자 종류 | 계수 | 예시 |
|-----------|------|------|
| 한글 | 1.00 | 가나다 |
| 영문 대문자 | 0.72 | ABC |
| 영문 소문자 | 0.58 | abc |
| 숫자 | 0.62 | 0123 |
| 공백 | 0.28 | ` ` |
| 특수문자 `.,:!?` | 0.35 | . , ! |
| 특수문자 `★/()` | 0.80 | ★ |

### 한 줄 픽셀 계산

```
한 줄 너비(px) = Σ (각 문자 × 계수) × fontSize
```

예: `"프렌디드는 제품력과 고객만족을"` (15한글 + 1공백)
```
= (15 × 1.00 + 1 × 0.28) × fontSize
= 15.28 × fontSize
```

### fontSize 역산 (줄바꿈 위치 맞추기)

원본에서 **1줄로 표시되는 텍스트**를 기준으로 역산한다:

```
콘텐츠 너비 = 860 - 2 × paddingX
문자 너비 합계 = Σ (각 문자 × 계수)
fontSize_max = 콘텐츠 너비 / 문자 너비 합계
```

이 값 이하로 fontSize를 설정하면 해당 텍스트가 1줄에 들어간다.

**실전 예시** — paddingX=80, 콘텐츠 너비=700px:

```
"프렌디드는 제품력과 고객만족을 인정받아"  (18한글 + 2공백)
문자 합계 = 18×1.00 + 2×0.28 = 18.56
fontSize_max = 700 / 18.56 ≈ 37px   → 이 줄이 1줄에 들어오는 최대 fontSize
```

### 여러 줄 텍스트의 줄바꿈 예측

fontSize가 결정된 후, 텍스트가 몇 줄로 나뉠지 예측:

```
1. 전체 텍스트를 단어(어절) 단위로 분리
2. 현재 줄에 다음 어절을 추가했을 때 콘텐츠 너비 초과 여부 확인
3. 초과하면 줄바꿈 → 다음 줄로
4. 총 줄 수 = 원본 줄 수와 일치해야 함
```

**줄 수 불일치 시 조정:**
- 예측 줄 수 > 원본 줄 수 → fontSize 줄이기
- 예측 줄 수 < 원본 줄 수 → fontSize 키우기

### 실전 적용 순서

```
1. 원본 이미지에서 텍스트 블록별 줄 수 파악
2. 가장 긴 줄(1줄짜리 중 글자 수 가장 많은 것)으로 fontSize_max 역산
3. 역산값을 fontSize로 설정
4. 전체 텍스트 줄바꿈 예측 → 원본 줄 수와 비교
5. 불일치 시 fontSize ±2px 조정 반복
```

---

## 섹션 분리 기준

**핵심 규칙: 이미지 파일 1개 = Goditor 섹션 1개**

원본 이미지 파일 하나가 하나의 섹션으로 매핑된다. 이미지 내부에 배경색이 여러 개여도 섹션을 분리하지 않는다.

- **배경색 선택**: 이미지에서 가장 넓은 영역의 배경색을 섹션 bg로 사용
- **텍스트 색상**: 선택된 배경색 기준으로 가독성에 맞게 조정 (밝은 bg → 어두운 텍스트, 어두운 bg → 밝은 텍스트)
- 이미지 내부의 시각적 배경 변화는 row 구성(gap, 텍스트 색 전환)으로 표현

하나의 섹션 안에 `stack`, `flex`, `grid` rows를 혼합할 수 있다.

**같은 배경색이 유지되면 → rows 배열에 계속 추가. 절대 섹션 분리 금지.**

> **카드가 여러 개 반복되어도** 각 카드의 배경색이 페이지 배경과 같다면 **전체를 1개 섹션**으로 묶고, 카드 간 여백은 `gap` 블록(stack row)으로 처리한다.

```json
// ✅ 올바른 예: 같은 배경, stack + flex를 한 섹션에 (카드 4개 반복)
{
  "sections": [{
    "settings": { "bg": "#ffffff" },
    "rows": [
      { "layout": "stack", "cols": [{ "blocks": [{ "type": "gap", "height": 33 }] }] },
      { "layout": "flex",  "cols": [{ "blocks": [...] }, { "blocks": [...] }] },
      { "layout": "stack", "cols": [{ "blocks": [{ "type": "gap", "height": 33 }] }] },
      { "layout": "flex",  "cols": [{ "blocks": [...] }, { "blocks": [...] }] }
    ]
  }]
}

// ❌ 잘못된 예: 같은 배경인데 카드처럼 보인다는 이유로 섹션 분리
{
  "sections": [
    { "settings": { "bg": "#ffffff" }, "rows": [{ "layout": "flex", ... }] },
    { "settings": { "bg": "#ffffff" }, "rows": [{ "layout": "flex", ... }] }
  ]
}

// ❌ 잘못된 예: 갭을 만들려고 빈 gap 섹션을 별도로 추가
{
  "sections": [
    { "settings": { "bg": "#ffffff" }, "rows": [...] },
    { "settings": {},                   "rows": [{ "layout": "stack", "cols": [{ "blocks": [{ "type": "gap" }] }] }] },
    { "settings": { "bg": "#ffffff" }, "rows": [...] }
  ]
}
```

---

## label 판단 기준

- **Hook**: 첫인상, 감성 어필, 히어로 이미지, 메인 카피
- **Main**: 핵심 기능·스펙 소개
- **Detail**: 소재, 사용법, 세부 정보, 스펙 표
- **CTA**: 구매 유도, 가격, 버튼
- **Event**: 할인, 기간 한정, 프로모션
- **""**: 판단 불가

---

## 열 레이아웃 비율 레퍼런스 (frame layout)

| 구성 | flex 값 | colW (860px 기준) |
|------|---------|-------------------|
| 1열 | → stack 사용 | - |
| 2열 균등 | 1 : 1 | 430 : 430 |
| 2열 좌소우대 | 1 : 3 | 215 : 645 |
| 2열 좌대우소 | 3 : 1 | 645 : 215 |
| 2열 황금비 | 2 : 3 | 344 : 516 |
| 3열 균등 | 1 : 1 : 1 | 287 : 287 : 286 |

---

## 구현 가능성 분석 (핵심)

각 블록/효과에 대해 아래를 판단한다:

| 판단 항목 | 확인 방법 |
|-----------|-----------|
| 블록 타입 지원 여부 | 이 스킬의 블록 타입 표 확인 |
| API 미지원 기능 | `/Users/a1/web-editor/docs/goditor-api-reference.md` 확인 후 없으면 `/goditor-api` 스킬로 요청 |
| 대체 표현 | 구현 불가 시 가장 근접한 블록으로 대체 방안을 Spec `note` 필드에 명시 |

**`note` 필드로 대체 방안 기록 예시:**
```json
{ "type": "image", "preset": "standard", "note": "원본은 그라데이션 오버레이이나 현재 미지원 → asset-block으로 대체" }
```

플래너 단계가 충실할수록 제너레이터는 Spec 그대로 실행만 하면 된다.

---

## 자기검토 체크리스트

Spec 저장 후 이미지를 다시 열고 아래 항목을 순서대로 확인한다.
하나라도 불일치하면 Spec을 수정하고 재저장한 뒤 검토를 다시 통과해야 한다.

| # | 항목 | 확인 내용 |
|---|------|-----------|
| 1 | **배경색** | 각 섹션의 `settings.bg`가 이미지 배경색과 일치하는가 |
| 3 | **레이아웃** | stack/frame/sub-section 선택이 이미지 구조와 맞는가. grid/flex는 사용하지 않았는가 |
| 4 | **열 비율** | frame row의 col flex 비율이 원본 좌우 비율과 맞는가 |
| 5 | **paddingX** | 이미지에서 좌우 여백이 보이면 `settings.paddingX` 명시했는가. 명시했으면 이하 모든 너비 계산을 `860-2×paddingX` 기준으로 했는가 |
| 6 | **블록 순서** | 각 col 안 블록 순서가 위→아래로 원본과 일치하는가 |
| 7 | **블록 누락** | 이미지에 있는 요소가 Spec에서 빠진 것은 없는가 |
| 8 | **섹션 높이** | stack row: `paddingY × 2 + 콘텐츠 높이`가 목표 높이 ±10% 이내인가. frame row: `frameHeight = max(각 col 블록 높이 합산)` 이 올바른가 |
| 9 | **fontSize** | 기본값 쓰지 않았는가. frame 내 text 블록에 `fontSize`를 명시했는가 |
| 10 | **fontSize 줄바꿈** | col 너비(860 × flex/totalFlex) 대비 텍스트 글자 수로 줄바꿈이 생기지 않는가 |
| 11 | **텍스트 색상** | 각 텍스트 블록의 `color`가 이미지와 일치하는가 |
| 12 | **image/icon 블록 타입** | 원형 요소를 `image`로 분류하지 않았는가. 원형 → `icon-circle`, 직사각형 → `image` (preset 확인) |
| 13 | **이중 배경** | 섹션 내 배경색이 2개 이상인 경우 `sub-section` layout을 사용했는가. 단순히 섹션 bg만 지정하고 넘어가지 않았는가 |
| 14 | **logo preset width** | `logo` preset 블록에 `width` 필드를 쓰지 않았는가. logo는 200px 고정 — width 명시하면 runner가 colW로 덮어씌워 너비가 깨진다 |
| 15 | **이중 gap 금지** | 첫 번째 row 맨 앞과 마지막 row 맨 뒤에 gap block을 추가하지 않았는가. 섹션 상하 여백은 `settings.paddingY`만 사용한다 |

---

## frame layout — Y 오프셋 동작 (중요)

freeLayout frame 내 블록 Y 좌표는 **runner가 블록 추가 후 실제 DOM 높이를 읽어 누적**한다.
추정값(`fontSize × lineCount × 1.10`)을 쓰지 않는다.

```
colY = 0
블록 추가 → DOM offsetHeight 읽기 → colY += 실제높이
블록 추가 → DOM offsetHeight 읽기 → colY += 실제높이
...
```

**텍스트 블록 간 겹침이 절대 발생하지 않는 이유**: 각 블록의 `top` 값이 이전 블록의 실제 `offsetHeight` 합산값으로 결정되기 때문이다.

→ Spec에서 `height`를 직접 계산해 명시할 필요 없다. `fontSize`와 `lineCount`만 정확하면 된다.

---

## Spec 작성 금지 사항

Spec JSON에는 **API에 실제 존재하는 opts만** 기재한다. 존재하지 않는 파라미터를 임의로 추가하면 에디터 동작이 예측 불가해진다.

| 금지 항목 | 이유 |
|-----------|------|
| frame 내 text 블록에 `paddingX` 추가 | text-frame 너비(colW)와 내부 content 너비가 달라져 bounding box 불일치 발생 |
| API 문서에 없는 필드 임의 추가 | generator가 무시하거나 오동작 유발 |
| 개별 블록 `paddingX`로 들여쓰기 구현 | section 레벨 `settings.paddingX`만 사용 가능. 블록 개별 paddingX 금지 |

→ 텍스트를 들여쓰고 싶으면 section `settings.paddingX`를 사용하거나 col flex 비율로 공간을 조정할 것.

---

## 출력

- Spec JSON 파일 경로 출력 (예: `/tmp/goditor_spec_frendied.json`)
- 구현 불가 항목이 있으면 대체 방안 요약
- 에디터 조립은 하지 않음 — `/goditor-layout-generator`에 Spec 경로 전달

---

## API 문서 위치

| 문서 | 경로 |
|------|------|
| API 레퍼런스 (최신) | `/Users/a1/web-editor/docs/goditor-api-reference.md` |
| Spec v2 정의 | `/Users/a1/web-editor/docs/goditor-spec-v2.md` |
