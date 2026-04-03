# Goditor Window API Reference

CDP 에이전트 및 자동화 스크립트가 에디터를 제어하기 위해 사용하는 `window.*` 함수 레퍼런스.

> **규칙**: 모든 add 함수는 섹션이 선택된 상태에서 호출해야 한다.
> 선택된 섹션이 없으면 toast 알림만 뜨고 아무 일도 일어나지 않는다.

---

## 세션 초기화

```js
// 1. 섹션 생성
window.addSection()
window.addSection({ skipDefaultBlock: true })  // 빈 섹션 (기본 h2+asset 없음)

// 2. (다열 레이아웃의 경우) Row 생성
window.addRowBlock(cols, rows)  // cols: 열 수, rows: 행 수 (grid)

// 3. (다열 레이아웃의 경우) Col 활성화
window.activateCol(rowIdOrElement, colIndex)

// 4. 블록 추가
window.addTextBlock('h1', { content: '제목', align: 'center' })

// 5. 저장
window.triggerAutoSave()
```

---

## 섹션

### `window.addSection(opts?)`

새 섹션을 캔버스에 추가한다. 현재 선택된 섹션 다음에 삽입된다.

```js
window.addSection()
window.addSection({ skipDefaultBlock: true })
window.addSection({ skipDefaultBlock: true, paddingX: 80 })
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `skipDefaultBlock` | boolean | `false` | `true`이면 기본 h2+asset 블록 없이 빈 섹션 생성 |
| `bg` | hex | `undefined` | 섹션 배경색. 생략 시 투명(캔버스 배경색 노출) |
| `paddingX` | number (px) | `undefined` | 섹션 콘텐츠 좌우 여백. `.section-inner`에 `padding-left/right` 적용. 생략 시 기본 CSS 값 유지 |

**paddingX 저장/로드**: `.section-inner` 요소의 `dataset.paddingX`에 기록 → 재로드 시 자동 복원.

---

### `window.setSectionBg(sectionEl, color)`

섹션 배경색을 설정한다. 생성 후 별도로 호출하거나, `addSection` 내 `bg` 옵션 대신 사용 가능.

```js
// 현재 선택된 섹션에 배경색 적용
const sec = window.getSelectedSection()
window.setSectionBg(sec, '#1565C0')

// id로 지정
window.setSectionBg('sec_abc123', '#f5f5f5')

// 배경색 제거 (투명으로)
window.setSectionBg(sec, '')
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `sectionEl` | HTMLElement \| string | `.section-block` 요소 또는 섹션 id |
| `color` | hex string | 색상. `''` 또는 `null`이면 배경색 제거 |

**저장/로드**: `dataset.bg`에 함께 기록되어 재로드 시 자동 복원됨.

---

## Row / Col 제어

### `window.addRowBlock(cols, rows?)`

다열 Row를 생성한다. `addSection()` 직후, 블록 추가 전에 호출한다.

```js
window.addRowBlock(2)     // 2열 flex row
window.addRowBlock(3)     // 3열 flex row
window.addRowBlock(2, 3)  // 2열×3행 grid row
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `cols` | number | — | 열 수 (2~4) |
| `rows` | number | `1` | 행 수. 1이면 flex, 2 이상이면 grid |

**반환**: 없음. 생성된 row에 `row-active` 클래스가 자동으로 붙음.

---

### `window.activateCol(rowIdOrElement, colIndex?)`

특정 col을 활성화하여 이후 블록 추가의 삽입 타깃으로 지정한다.

```js
// row id로 지정
window.activateCol('row_abc123', 0)  // 첫 번째 col
window.activateCol('row_abc123', 1)  // 두 번째 col

// DOM 요소로 지정
const row = document.querySelector('.row.row-active')
window.activateCol(row, 1)
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `rowIdOrElement` | string \| HTMLElement | — | row의 id 또는 DOM 요소 |
| `colIndex` | number | `0` | col 인덱스 (0부터 시작) |

**반환**: `boolean` — 성공 시 `true`, col 없으면 `false`

---

## 블록 추가

### `window.addTextBlock(style, opts?)`

텍스트 블록을 추가한다.

```js
window.addTextBlock('h1')
window.addTextBlock('h1', { content: '제품명', align: 'center' })
window.addTextBlock('body', { content: '상세 설명입니다.' })
window.addTextBlock('h1', { content: '제목', paddingX: 60 })
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `style` | string | `h1` `h2` `h3` `body` `caption` `label` |

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `content` | string | placeholder | 텍스트 초기값. 빈 문자열이면 placeholder 유지 |
| `align` | string | 섹션 정렬 상속 | `left` `center` `right` |
| `color` | hex | — | 텍스트 색상 (예: `'#ffffff'`) |
| `fontSize` | number (px) | — | 폰트 크기. 2열 col처럼 공간이 좁을 때 h1 기본값(104px)을 줄이는 용도 |
| `paddingX` | number (px) | — | 블록 좌우 여백. `.row` 요소(`.text-block`의 부모)에 `padding-left/right` 적용. `dataset.paddingX`에 저장 |

**style 용도:**

| style | 설명 |
|-------|------|
| `h1` | 메인 헤드라인 (가장 큰 텍스트) |
| `h2` | 서브 헤드라인 |
| `h3` | 항목 제목 |
| `body` | 본문 설명 |
| `caption` | 이미지 하단 부연 설명, 주석 |
| `label` | 태그형 짧은 분류 텍스트 |

---

### `window.addAssetBlock(preset?)`

이미지 블록을 추가한다.

```js
window.addAssetBlock()
window.addAssetBlock('square')
window.addAssetBlock('tall')
```

| 파라미터 | 값 | 크기 | 용도 |
|----------|-----|------|------|
| `'standard'` (기본) | 780px 높이 | 일반 제품 이미지 |
| `'square'` | 860×860px | 정사각형 이미지 |
| `'tall'` | 1032px 높이 | 세로 긴 이미지 (2:3) |
| `'wide'` | 575px 높이 | 가로 배너 (16:9) |
| `'logo'` | 200×64px | 브랜드 로고, 인증 마크 |

---

### `window.addGapBlock(height?)`

빈 공간(여백) 블록을 추가한다.

```js
window.addGapBlock()       // 기본 높이
window.addGapBlock(40)     // 40px
window.addGapBlock(100)    // 100px
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `height` | number (px) | `40` | 여백 높이 |

---

### `window.addDividerBlock(opts?)`

구분선 블록을 추가한다.

```js
window.addDividerBlock()
window.addDividerBlock({ color: '#e0e0e0', lineStyle: 'dashed', weight: 2 })
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `color` | hex | `'#cccccc'` | 선 색상 |
| `lineStyle` | string | `'solid'` | `solid` `dashed` `dotted` |
| `weight` | number (px) | `1` | 선 두께 |

---

### `window.addIconCircleBlock(opts?)`

원형 아이콘 블록을 추가한다.

```js
window.addIconCircleBlock()
window.addIconCircleBlock({ size: 180, bgColor: '#f0f0f0' })
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `size` | number (px, **지름**) | `240` | 원 크기 |
| `bgColor` | hex | `'#e8e8e8'` | 원 배경색 |

---

### `window.addLabelGroupBlock(opts?)`

라벨 그룹(태그 묶음) 블록을 추가한다.

```js
window.addLabelGroupBlock()
window.addLabelGroupBlock({ labels: ['방수', '충격흡수', 'UV차단'] })
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `labels` | string[] | `['Tag', 'Tag', 'Tag']` | 라벨 텍스트 배열 |

---

### `window.addTableBlock(opts?)`

표 블록을 추가한다.

```js
window.addTableBlock()
window.addTableBlock({ showHeader: false, cellAlign: 'left' })
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `showHeader` | boolean | `true` | 헤더 행 표시 여부 |
| `cellAlign` | string | `'center'` | `left` `center` `right` |

---

### `window.addCardBlock(count?, opts?)`

카드 블록을 추가한다. grid row로 자동 생성된다.

```js
window.addCardBlock()
window.addCardBlock(3)
window.addCardBlock(2, { bgColor: '#ffffff', radius: 8 })
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `count` | number | `2` | 카드 수 (2~4) |

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `bgColor` | hex | `'#f5f5f5'` | 카드 배경색 |
| `radius` | number (px) | `12` | 모서리 반경 |

---

### `window.addGraphBlock(opts?)`

그래프 블록을 추가한다.

```js
window.addGraphBlock()
window.addGraphBlock({
  chartType: 'bar-v',
  items: [
    { label: '기능A', value: 90 },
    { label: '기능B', value: 75 },
    { label: '기능C', value: 60 }
  ]
})
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `chartType` | string | `'bar-v'` | `bar-v` (세로 막대) `bar-h` (가로 막대) |
| `items` | `{ label, value }[]` | 5개 샘플 | value 범위: 0~100. 빈 배열이면 기본값 사용 |

---

## paddingX 설계 노트

### 적용 범위 결정

paddingX는 **페이지 레벨 · 섹션 레벨 · 블록 레벨** 세 단계로 동작한다.

| 레벨 | 적용 대상 요소 | 우선순위 | 목적 |
|------|--------------|----------|------|
| 페이지 | 모든 섹션의 `.section-inner` (override 없는 것만) | 낮음 | 페이지 전체 좌우 여백 일괄 설정 |
| 섹션 | `.section-inner` | 높음 | 섹션별 개별 여백 override |
| 텍스트 블록 | `.row` (text-block 직계 부모) | — | 특정 텍스트 블록만 추가 여백 |

섹션 레벨 paddingX가 있으면 페이지 레벨 설정을 무시한다. 두 레벨이 없을 때만 페이지 레벨이 적용된다.

### CSS 구현 방식

```
// 섹션 레벨 — .section-inner에 직접 적용
sectionInner.style.paddingLeft  = paddingX + 'px'
sectionInner.style.paddingRight = paddingX + 'px'
sectionInner.dataset.paddingX   = paddingX   // 저장 키 (override 플래그 역할)

// 블록 레벨 — .row (text-block의 부모) 에 적용
rowEl.style.paddingLeft  = paddingX + 'px'
rowEl.style.paddingRight = paddingX + 'px'
rowEl.dataset.paddingX   = paddingX          // 저장 키
```

**margin 대신 padding을 쓰는 이유**: 섹션 내부 배경색(`bg`)이 있을 때 margin을 쓰면 배경이 잘려 보인다. padding은 배경색 안쪽에서 여백을 만들므로 시각적으로 올바른 결과를 낸다.

### dataset 저장 키

| 위치 | 키 | 타입 |
|------|----|------|
| `.section-inner` | `dataset.paddingX` | number (px, 정수) |
| `.section-inner` | `dataset.padXIncludesAsset` | `'true'` \| `'false'` \| `''` |
| `.row` | `dataset.paddingX` | number (px, 정수) |

### padXIncludesAsset

에셋(이미지) 블록 너비를 paddingX에 연동할지 결정하는 플래그.

| 레벨 | 저장 위치 | 값 타입 |
|------|-----------|---------|
| 페이지 | `state.pageSettings.padXIncludesAsset` | boolean |
| 섹션 | `inner.dataset.padXIncludesAsset` | `'true'` \| `'false'` \| `''` |

섹션 레벨 값이 `'true'` 또는 `'false'`이면 페이지 레벨보다 우선 적용된다. `''`(빈 문자열)이면 페이지 레벨을 따른다.

- `padXIncludesAsset = true` → `asset.style.width = (860 - padX * 2) + 'px'`
- `padXIncludesAsset = false` → `asset.style.width = ''` (기본값 복원)

### 사용 예시

```js
// 페이지 전체 패딩 일괄 적용 (섹션 레벨 override 없는 섹션에만 적용)
window.applyPagePadX(60)

// 섹션 좌우 80px 여백 (페이지 설정 override)
window.addSection({ skipDefaultBlock: true, paddingX: 80 })

// 텍스트 블록 좌우 60px 여백
window.addTextBlock('h1', { content: '섹션 제목', align: 'center', paddingX: 60 })

// 섹션 paddingX + 블록 paddingX 혼합 (겹침 — 의도적으로 다른 들여쓰기 구현 가능)
window.addSection({ skipDefaultBlock: true, paddingX: 40 })
window.addTextBlock('h1', { content: '더 들여쓴 제목', paddingX: 40 })  // 실질적 80px 여백
window.addTextBlock('body', { content: '본문은 섹션 기준 40px 여백만 적용됨' })
```

---

## 페이지 설정 API

### `window.applyPagePadX(padX)`

페이지 전체 좌우 패딩을 일괄 적용한다. 섹션 레벨 override(`dataset.paddingX`)가 없는 모든 섹션의 `section-inner`에 `padding-left/right`를 설정한다.

```js
window.applyPagePadX(32)   // 기본값
window.applyPagePadX(60)   // 넓은 여백
window.applyPagePadX(0)    // 여백 없음 (풀블리드)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `padX` | number (px) | 적용할 좌우 패딩 값 |

**동작 규칙**:
- `dataset.paddingX`가 설정된 섹션(섹션 레벨 override)은 건너뜀
- `state.pageSettings.padXIncludesAsset`이 `true`이면 에셋 블록 너비도 `860 - padX * 2`로 함께 조절
- 섹션 레벨 `dataset.padXIncludesAsset`이 `'true'`/`'false'`이면 섹션별로 개별 적용

---

## 저장

### `window.triggerAutoSave()`

자동저장을 즉시 트리거한다. 모든 작업 완료 후 반드시 호출.

```js
window.triggerAutoSave()
```

---

## CDP 에이전트 사용 패턴

### 단열(stack) 섹션 조립

```js
// 1. 빈 섹션 생성
window.addSection({ skipDefaultBlock: true })

// 2. 블록 순서대로 추가 (섹션 자동 선택 상태)
window.addTextBlock('h1', { content: '제품 메인 타이틀', align: 'center' })
window.addTextBlock('body', { content: '제품 설명 문장입니다.', align: 'center' })
window.addGapBlock(24)
window.addAssetBlock('standard')
window.addGapBlock(24)
window.addLabelGroupBlock({ labels: ['특징1', '특징2', '특징3'] })

// 3. 저장
window.triggerAutoSave()
```

### 2열(flex) 섹션 조립

```js
// 1. 빈 섹션 생성
window.addSection({ skipDefaultBlock: true })

// 2. 2열 row 생성 → 자동으로 row-active
window.addRowBlock(2)

// 3. 첫 번째 col 활성화 → 블록 추가
const row = document.querySelector('.row.row-active')
window.activateCol(row, 0)
window.addAssetBlock('square')

// 4. 두 번째 col 활성화 → 블록 추가
window.activateCol(row, 1)
window.addTextBlock('label', { content: '브랜드명' })
window.addTextBlock('h1', { content: '제품명' })
window.addTextBlock('body', { content: '제품 설명입니다.' })

// 5. 저장
window.triggerAutoSave()
```

### col-active 해제

다열 col 작업 후 일반 섹션 레벨로 돌아오려면:

```js
document.querySelectorAll('.col.col-active').forEach(c => c.classList.remove('col-active'))
```

---

## Sub-Section 블록

Figma의 오토레이아웃 없는 FRAME과 동일한 역할. 내부에 조커 블록을 자유 위치(absolute)로 배치하는 컨테이너.

### `window.addSubSectionBlock()`

새 서브섹션을 현재 선택된 섹션에 추가한다. 추가 직후 `window._activeSubSection`에 등록된다.

```js
window.addSubSectionBlock()
```

서브섹션 생성 후 크기·배경 적용:

```js
const ss = window._activeSubSection
ss.style.width    = '453px'
ss.style.height   = '241px'
ss.style.minHeight = '241px'
ss.style.padding  = '0'           // Figma 임포트 시 패딩 제거
ss.style.background = '#1e1e1e'
ss.dataset.bg     = '#1e1e1e'
ss.style.marginLeft  = '204px'   // X 위치 (섹션 기준 상대)
ss.style.marginRight = 'auto'
```

### `window._activeSubSection`

현재 활성화된 서브섹션 참조. `addJokerBlock()` 호출 시 이 값이 있으면 서브섹션 내부에 absolute 위치로 삽입된다.

```js
window._activeSubSection = null   // 서브섹션 활성화 해제
```

**서브섹션 내부 구조:**
```
.sub-section-block  (overflow: hidden, position: relative)
  .sub-section-inner  (position: relative, height: 100%)
    .joker-block  (position: absolute, left: Xpx, top: Ypx)
    .joker-block  (position: absolute, left: Xpx, top: Ypx)
```

---

## 조커(Joker) 블록

Figma에서 에디터 블록으로 직접 표현이 불가능한 요소(VECTOR, STAR, POLYGON, CONNECTOR 등)를 SVG로 그대로 보존하는 패스스루 컨테이너. 서브섹션 내부에서 자유 위치로 배치된다.

### `window.addJokerBlock(opts)`

```js
window.addJokerBlock({
  label:  'Star 1',           // 레이어 패널 표시 이름
  svg:    '<svg>...</svg>',   // SVG 문자열 (없으면 회색 placeholder)
  width:  174,                // 렌더 너비 (px)
  height: 174,                // 렌더 높이 (px)
  x:      53,                 // X 오프셋 (px)
  y:      33,                 // Y 오프셋 (px)
})
```

- `window._activeSubSection`이 설정된 상태에서 호출하면 서브섹션 inner에 `position: absolute`로 삽입
- 그 외에는 현재 선택된 섹션에 일반 블록으로 삽입 (`row > col > joker` 구조)

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | string | `'Figma Component'` | 레이어 패널 이름 |
| `svg` | string | `''` | SVG 마크업 전체 |
| `width` | number (px) | `860` | 렌더 너비 |
| `height` | number (px) | `200` | 렌더 높이 |
| `x` | number (px) | `0` | X 오프셋 |
| `y` | number (px) | `0` | Y 오프셋 (서브섹션 내 absolute 모드에서 `top` 값) |

**dataset 저장 필드:**
- `dataset.offsetX` — X 오프셋 (저장/복원용)
- `dataset.offsetY` — Y 오프셋 (저장/복원용)
- `dataset.origWidth` — 원본 너비
- `dataset.origHeight` — 원본 높이
- `dataset.label` — 이름
- `dataset.svg` — SVG 문자열

---

## 주의 사항

1. `addSection()` 호출 직후 섹션이 자동 선택됨 — 별도의 `selectSection()` 불필요
2. `addRowBlock()` 호출 직후 row에 `row-active` 자동 부여 — `activateCol()` 바로 호출 가능
3. `activateCol()` 후 블록 추가 시 `col-active`가 유지되므로, 다른 col로 전환하려면 다시 `activateCol()` 호출
4. `addTextBlock`에 `content: ''` 전달 시 placeholder 텍스트 유지 (빈 문자열은 무시됨)
5. 모든 작업 완료 후 `triggerAutoSave()` 필수 호출

---

## 변경 이력

| 날짜 | 버전 | 변경 |
|------|------|------|
| 2026-04-03 | v1 | 초안 — 기본 add 함수 파라미터 추가, activateCol 신규 |
| 2026-04-03 | v1.1 | paddingX 옵션 추가 — `addSection`, `addTextBlock` 양쪽 지원 |
| 2026-04-03 | v1.2 | 패딩 아키텍처 변경 반영 — `applyPagePadX` 신규 API, 페이지/섹션/블록 3단계 우선순위, `padXIncludesAsset` 플래그 추가 |
| 2026-04-03 | v1.3 | Sub-Section 블록 API, 조커 블록 API 추가 (Figma 임포트 파이프라인 대응) |
