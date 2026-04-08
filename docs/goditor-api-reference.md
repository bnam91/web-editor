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

// 2. (다열 레이아웃의 경우) NewGrid 생성
window.addNewGridBlock(cols, rows)  // cols: 열 수, rows: 행 수

// 3. 블록 추가
window.addTextBlock('h1', { content: '제목', align: 'center' })

// 4. 저장
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
| `paddingY` | number (px) | `100` | 섹션 상단·하단 gap 높이. `skipDefaultBlock: true` 일 때 자동 생성되는 두 gap 블록의 높이로 사용. `0`이면 gap 없음 (풀블리드 sub-section에 사용) |

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

### `window.deleteSection(secIdOrEl)`

섹션을 삭제한다. id 문자열 또는 요소를 받는다.

```js
// id로 삭제
window.deleteSection('sec_abc123')

// 요소로 삭제
const sec = window.getSelectedSection()
window.deleteSection(sec)

// 여러 섹션 일괄 삭제
['sec_abc', 'sec_def', 'sec_ghi'].forEach(id => window.deleteSection(id))
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `secIdOrEl` | HTMLElement \| string | `.section-block` 요소 또는 섹션 id |

**반환값**: 삭제 성공 시 `true`, 유효하지 않은 섹션이면 `false`.

---

## NewGrid 제어

### `window.addNewGridBlock(cols?, rows?, opts?)`

기존 addRowBlock을 대체하는 그리드 프레임 블록 생성 함수.

```js
window.addNewGridBlock(2)     // 2열 그리드
window.addNewGridBlock(3)     // 3열 그리드
window.addNewGridBlock(2, 3)  // 2열×3행 그리드
```

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `cols` | number | `2` | 열 수 |
| `rows` | number | `1` | 행 수 |
| `opts` | object | `{}` | 추가 옵션 |

**반환**: 없음. 호출 후 생성된 frame이 선택되고 `window._activeFrame`에 설정됨.

addNewGridBlock 호출 후 각 셀에 블록을 추가하려면 셀을 클릭하거나 frame.querySelector를 통해 해당 셀의 frame-block을 직접 활성화한다. (activateCol은 삭제됨)

---

## 블록 추가

### `window.addTextBlock(style, opts?)`

텍스트 블록을 추가한다.

> **참고**: 모든 텍스트 블록은 자동으로 `frame-block[data-text-frame='true']` 컨테이너 안에 래핑됩니다. 이 wrapper는 레이어 패널에서 투명하게 처리되며(text-block이 직접 표시됨), 클릭 시 text-block이 선택됩니다.

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
| `content` | string | placeholder | 텍스트 초기값. 빈 문자열이면 placeholder 유지. `\n` 포함 시 줄바꿈 렌더링 (`white-space: pre-wrap` 자동 적용) |
| `align` | string | 섹션 정렬 상속 | `left` `center` `right` |
| `color` | hex | — | 텍스트 색상 (예: `'#ffffff'`) |
| `fontSize` | number (px) | — | 폰트 크기. 2열 col처럼 공간이 좁을 때 h1 기본값(104px)을 줄이는 용도 |
| `paddingX` | number (px) | — | 블록 좌우 여백. `.row` 요소(`.text-block`의 부모)에 `padding-left/right` 적용. `dataset.paddingX`에 저장 |
| `x` | number (px) | — | **freeLayout Frame 전용** — text-frame의 `left` 절대좌표. 지정 시 자동 스택 대신 고정 위치 사용. `dataset.offsetX`에 저장 |
| `y` | number (px) | — | **freeLayout Frame 전용** — text-frame의 `top` 절대좌표. 지정 시 자동 스택 대신 고정 위치 사용. `dataset.offsetY`에 저장 |
| `width` | number (px) | — | **freeLayout Frame 전용** — text-frame의 너비. 미지정 시 `100%` |

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

### `window.addAssetBlock(preset?, opts?)`

이미지 블록을 추가한다.

```js
window.addAssetBlock()
window.addAssetBlock('square')
window.addAssetBlock('tall')
window.addAssetBlock('wide', { paddingX: 215 })  // asset 실질 너비 = 860 - 2×215 = 430px
```

**preset 목록**

| preset | 크기 | 용도 |
|--------|------|------|
| `'standard'` (기본) | 780px 높이 | 일반 제품 이미지 |
| `'square'` | 860×860px | 정사각형 이미지 |
| `'tall'` | 1032px 높이 | 세로 긴 이미지 (2:3) |
| `'wide'` | 575px 높이 | 가로 배너 (16:9) |
| `'logo'` | 200×64px | 브랜드 로고, 인증 마크 |

**opts 옵션**

| 옵션 | 타입 | 기본 | 설명 |
|------|------|------|------|
| `paddingX` | number (px) | — | asset 블록 row의 좌우 padding. 섹션 paddingX와 독립적으로 동작. `dataset.paddingX`에 저장 → 재로드 시 자동 복원 |
| `width` | number (px) | — | asset-block 너비 직접 지정. **freeLayout Frame** 에서는 absolute 배치 너비로도 사용됨 |
| `height` | number (px) | — | asset-block 높이 직접 지정 |
| `x` | number (px) | — | **freeLayout Frame 전용** — asset-block의 `left` 절대좌표. 지정 시 자동 스택 대신 고정 위치 사용. `dataset.offsetX`에 저장 |
| `y` | number (px) | — | **freeLayout Frame 전용** — asset-block의 `top` 절대좌표. 지정 시 자동 스택 대신 고정 위치 사용. `dataset.offsetY`에 저장 |

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
window.addLabelGroupBlock({ labels: ['태그1', '태그2'], shape: 'circle' })
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `labels` | string[] | `['Tag', 'Tag', 'Tag']` | 라벨 텍스트 배열 |
| `shape` | `'pill'` \| `'circle'` | `'pill'` | `'pill'`: 직사각형(기본), `'circle'`: 원형 (100×100px, border-radius 50%) |

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

### 2열(NewGrid) 섹션 조립

```js
// 1. 빈 섹션 생성
window.addSection({ skipDefaultBlock: true })

// 2. 2열 NewGrid 생성 → 자동으로 _activeFrame 설정
window.addNewGridBlock(2)

// 3. 첫 번째 셀 frame-block을 직접 활성화 → 블록 추가
const gridFrame = window._activeFrame
const cell0 = gridFrame.querySelector('.frame-block:nth-child(1)')
window.activateFrame(cell0)
window.addAssetBlock('square')

// 4. 두 번째 셀 활성화 → 블록 추가
const cell1 = gridFrame.querySelector('.frame-block:nth-child(2)')
window.activateFrame(cell1)
window.addTextBlock('label', { content: '브랜드명' })
window.addTextBlock('h1', { content: '제품명' })
window.addTextBlock('body', { content: '제품 설명입니다.' })

// 5. Frame 컨텍스트 해제 후 저장
window.deactivateFrame()
window.triggerAutoSave()
```

---

## Frame 블록

Figma의 오토레이아웃 없는 FRAME과 동일한 역할. 내부에 조커 블록을 자유 위치(absolute)로 배치하는 컨테이너.

### `window.addFrameBlock(opts?)`

새 Frame을 현재 선택된 섹션에 추가한다. 추가 직후 `window._activeFrame`에 등록된다.

**모드 1: 고정 크기 (기본)** — Figma 임포트, absolute 자식 배치용

```js
window.addFrameBlock()
// 생성 후 크기·배경 적용
const ss = window._activeFrame
ss.style.width    = '453px'
ss.style.height   = '241px'
ss.style.background = '#1e1e1e'
ss.dataset.bg     = '#1e1e1e'
```

**모드 2: fullWidth** — 이중 배경 섹션용. height: auto, text/image/gap 블록 삽입 가능

```js
window.addFrameBlock({ fullWidth: true, bg: '#222222' })
// 이후 addTextBlock / addAssetBlock / addGapBlock 호출 시 frame 내부에 삽입됨
window.addTextBlock('h1', { content: '제목', color: '#ffffff' })
window.addAssetBlock('standard')
window.deactivateFrame()   // 컨텍스트 해제 후 섹션 레벨로 복귀
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `fullWidth` | boolean | `false` | `true`: width 100%, height auto, 플로우 레이아웃 |
| `bg` | hex | `'transparent'` | 배경색 |
| `radius` | number | — | 코너 라운드(px). `border-radius` + `overflow:hidden` 적용. `dataset.radius`에 저장 |

**radius 사용 예시:**

```js
// fullWidth 모드에서 라운드 카드 효과
window.addFrameBlock({ fullWidth: true, bg: '#ffffff', radius: 16 })

// 생성 후 직접 설정
const ss = window._activeFrame
ss.style.borderRadius = '16px'
ss.style.overflow = 'hidden'
ss.dataset.radius = '16'
```

**Spec v2 사용 예시 (layout: 'frame'):**

```json
{
  "layout": "frame",
  "bg": "#222222",
  "cols": [{ "blocks": [
    { "type": "image", "preset": "standard" },
    { "type": "text", "style": "h1", "content": "제목" }
  ]}]
}
```

### `window.activateFrame(ss)` / `window.deactivateFrame()`

```js
window.activateFrame(frameElement)  // _activeFrame 설정
window.deactivateFrame()            // _activeFrame = null
```

### `window._activeFrame`

현재 활성화된 Frame 참조.
- 고정 크기 모드: `addJokerBlock()` absolute 삽입
- fullWidth 모드: `addTextBlock/addAssetBlock/addGapBlock` 플로우 삽입

**Frame 내부 구조:**
```
.frame-block  (고정 모드: overflow hidden; fullWidth: width 100%)
  [freeLayout] .joker-block  (position: absolute)
  [freeLayout] .frame-block  (shape Frame, position: absolute)
  [fullWidth]  .frame-block[data-text-frame] > .text-block  (플로우)
  [fullWidth]  .asset-block / .gap-block  (플로우)
```
> `.frame-inner` 별도 래퍼 없음 — 자식 블록이 `.frame-block`에 직접 들어간다.

---

## 쉐이프(Shape) 블록

에디터 내 기본 도형(별, 다각형, 직사각형, 타원, 선, 화살표)을 삽입하는 블록. 항상 Frame(frame-block) 내부에 `position: absolute`로 삽입된다.

### `window.addShapeBlock(type)`

```js
window.addShapeBlock('star')       // 별
window.addShapeBlock('polygon')    // 삼각형
window.addShapeBlock('rectangle')  // 직사각형
window.addShapeBlock('ellipse')    // 타원
window.addShapeBlock('line')       // 선
window.addShapeBlock('arrow')      // 화살표
```

- 항상 현재 선택된 섹션에 100×100px Frame + shape-block 세트로 삽입
- `window._activeFrame`이 freeLayout Frame이면 그 안에 absolute로 삽입
- shape-block은 Frame(frame-block) 내부 `left:0, top:0`에 고정

**삽입 우선순위:**
1. `_activeFrame`이 freeLayout Frame(shape Frame 아님) → 해당 Frame 내부에 absolute 삽입
2. 선택된 frame-block이 shape Frame 아님 → 해당 Frame 내부에 삽입
3. 그 외 → 섹션 레벨(흐름 레이아웃)에 삽입

**dataset 저장 필드 (shape-block):**
- `dataset.shapeType` — 도형 타입 (`star` / `polygon` / `rectangle` / `ellipse` / `line` / `arrow`)
- `dataset.shapeColor` — 색상 hex (`#cccccc` 기본)
- `dataset.shapeStrokeWidth` — 선 두께 (`3` 기본)

**DOM 구조:**
```
section-inner
  └─ frame-block  (Frame, position: relative, 흐름 레이아웃)
       └─ shape-block  (position: absolute, left:0, top:0)
            └─ svg.shape-svg
```

**freeLayout Frame 안에 삽입된 경우 DOM 구조:**
```
section-inner
  └─ frame-block  (외부 Frame, freeLayout=true)
       └─ frame-block  (shape Frame, position: absolute)
            └─ shape-block  (position: absolute, left:0, top:0)
                 └─ svg.shape-svg
```
> `.frame-inner` 별도 래퍼 없음 — 자식 요소가 `.frame-block`에 직접 들어간다.

**리사이즈 핸들 (UI):**
- 선택 시 4코너에 핸들 자동 표시 (`.shape-handle.nw/ne/sw/se`)
- 드래그로 Frame + shape-block 동시 리사이즈 (좌·상·우·하 모두 가능)
- `left:0, top:0` 고정 — shape-block 내부 위치는 절대 변경되지 않음
- 핸들 크기: `calc(7px * var(--inv-zoom))` — 캔버스 배율 무관하게 시각적 7px 고정
- 저장 시 핸들 DOM 자동 제거 (`getSerializedCanvas` 내 `.shape-handle` 제거)

**프로퍼티 패널 (`window.showShapeProperties(block)`):**
- 색상 picker + hex 입력
- 선 두께 슬라이더
- W/H 크기 슬라이더 (Frame과 동기 리사이즈)

**DnD (섹션 내 재배치):**
- shape-block 클릭/드래그 시 Frame(frame-block) 전체가 HTML5 DnD로 이동
- shape-block 자체의 mousemove 드래그 없음 — joker 블록과 달리 내부 위치 고정

---

## Frame 블록 크기 및 위치 지정

### Frame 크기 설정

`addFrameBlock()` 또는 `addShapeBlock()` 호출 후 직접 스타일·dataset을 설정한다.

```js
const ss = window._activeFrame  // 방금 생성된 Frame

// 크기
ss.style.width     = '422px'   // 또는 '100%'
ss.style.height    = '276px'
ss.style.minHeight = '276px'
ss.style.maxWidth  = '100%'
ss.dataset.width   = '422'     // 숫자 문자열 (저장·복원용)
ss.dataset.height  = '276'

// 배경 (Frame 배경색)
ss.style.background    = '#1e1e1e'
ss.dataset.bg          = '#1e1e1e'
```

### freeLayout — Frame 내부 자유 배치 모드

`dataset.freeLayout = 'true'`로 설정하면 자식 블록을 `position: absolute`로 자유 배치할 수 있다.

```js
ss.dataset.freeLayout = 'true'
// frame-block 자체가 컨테이너 (별도 inner 없음)
ss.style.position = 'relative'
ss.style.width    = '100%'
ss.style.height   = '100%'
ss.style.overflow = 'hidden'
```

> **활용 패턴**: 캔버스 860px 기준 2×1 그리드를 그리드 블록 없이 구현할 때 — 외부 Frame(freeLayout) 하나를 만들고 내부에 shape Frame 2개를 x/y로 배치.

### 자식 블록 x/y 위치 지정 (freeLayout Frame 내부)

freeLayout Frame 안에 삽입된 블록(shape Frame, text-block 등)의 위치를 절대좌표로 지정한다.

```js
// addShapeBlock() 후 frame에서 방금 생성된 shape Frame 꺼내기
// (frame-block이 직접 컨테이너, frameInner 없음)
const shapeFrame = [...frame.children]
  .find(el => el.classList.contains('frame-block'))

// 위치 설정
shapeFrame.style.position  = 'absolute'
shapeFrame.style.left      = '0px'       // x 좌표
shapeFrame.style.top       = '0px'       // y 좌표
shapeFrame.dataset.offsetX = '0'         // 저장·복원용
shapeFrame.dataset.offsetY = '0'

// 크기 설정
shapeFrame.style.width     = '422px'
shapeFrame.style.height    = '276px'
shapeFrame.style.minHeight = '276px'
shapeFrame.style.margin    = '0'
shapeFrame.dataset.width   = '422'
shapeFrame.dataset.height  = '276'
```

### 2×1 레이아웃 예시 (Canvas 860px, gap 16px)

```js
// 치수 계산
const CANVAS_W = 860
const GAP      = 16
const shapeW   = Math.floor((CANVAS_W - GAP) / 2)   // 422
const shapeH   = Math.round(shapeW * 0.65 / 4) * 4  // 276

// 1. 외부 Frame 생성 (freeLayout)
window._activeFrame = null
window.addFrameBlock({})
const frame = window._activeFrame
frame.style.width     = CANVAS_W + 'px'
frame.style.height    = shapeH + 'px'
frame.style.minHeight = shapeH + 'px'
frame.style.margin    = '0 auto'
frame.dataset.freeLayout = 'true'
// frame-block 자체가 컨테이너 (별도 inner 없음)
frame.style.cssText += ';position:relative;overflow:hidden;'

// 2. Shape 1 (left)
window._activeFrame = frame
window.addShapeBlock('rectangle')
const ss0 = [...frame.children].find(el => el.classList.contains('frame-block'))
ss0.style.cssText = `position:absolute;left:0;top:0;width:${shapeW}px;height:${shapeH}px;min-height:${shapeH}px;margin:0;`
ss0.dataset.offsetX = '0'; ss0.dataset.offsetY = '0'
ss0.dataset.width = String(shapeW); ss0.dataset.height = String(shapeH)

// 3. Shape 2 (right)
window._activeFrame = frame
window.addShapeBlock('rectangle')
const ss1 = [...frame.children].find(el => el.classList.contains('frame-block') && el !== ss0)
const x1 = shapeW + GAP  // 438
ss1.style.cssText = `position:absolute;left:${x1}px;top:0;width:${shapeW}px;height:${shapeH}px;min-height:${shapeH}px;margin:0;`
ss1.dataset.offsetX = String(x1); ss1.dataset.offsetY = '0'
ss1.dataset.width = String(shapeW); ss1.dataset.height = String(shapeH)

window.buildLayerPanel?.()
window.triggerAutoSave?.()
```

**레이어 패널 표시:**
```
Frame  [Frame]          ← 외부 frame (addFrameBlock)
  rectangle  [Shape]   ← shape 1 (addShapeBlock)
  rectangle  [Shape]   ← shape 2 (addShapeBlock)
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

- `window._activeFrame`이 설정된 상태에서 호출하면 해당 frame-block에 `position: absolute`로 직접 삽입
- 그 외에는 현재 선택된 섹션에 일반 블록으로 삽입 (`row > col > joker` 구조)

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | string | `'Figma Component'` | 레이어 패널 이름 |
| `svg` | string | `''` | SVG 마크업 전체 |
| `width` | number (px) | `860` | 렌더 너비 |
| `height` | number (px) | `200` | 렌더 높이 |
| `x` | number (px) | `0` | X 오프셋 |
| `y` | number (px) | `0` | Y 오프셋 (frame 내 absolute 모드에서 `top` 값) |

**dataset 저장 필드:**
- `dataset.offsetX` — X 오프셋 (저장/복원용)
- `dataset.offsetY` — Y 오프셋 (저장/복원용)
- `dataset.origWidth` — 원본 너비
- `dataset.origHeight` — 원본 높이
- `dataset.label` — 이름
- `dataset.svg` — SVG 문자열

---

## 스크래치패드 API

캔버스 여백에 참고 이미지를 배치하는 임시 작업 공간. IndexedDB에 저장되므로 새로고침/재시작 후에도 유지.

> 상세 명세 → `docs/SCRATCH_PAD.md`

### CDP에서 이미지 삽입

```js
// 이미지 1장 삽입 + IndexedDB 저장
window._scratchAddAndSave(src, x, y, w)
// src: base64 DataURL (data:image/png;base64,...)
// x/y: canvas-scaler 로컬 좌표 px (캔버스 오른쪽 여백 권장: x=960)
// w:   표시 너비 px (기본 860)
// 반환: Promise — awaitPromise: true 필수
// ⚠️ 반드시 한 장씩 순차 호출 (동시 전달 시 timeout 발생)
```

### 전체 초기화

```js
await window.clearScratchPad()   // 현재 프로젝트+페이지 스크래치 전체 삭제
```

### 프로젝트/페이지 전환 시

```js
window.initScratchPad(projectId, pageId)   // 프로젝트 열기 시 1회 호출 (자동 복원)
window.switchScratch(projectId, pageId)    // 다른 프로젝트로 전환
window.switchScratchPage(newPageId)        // 같은 프로젝트 내 페이지 전환
```

### 저장 구조

```
IndexedDB: ScratchPadDB / store: scratch
key:   scratch-pad-{projectId}-{pageId}
value: [{ src, x, y, w }, ...]
```

---

## 주의 사항

1. `addSection()` 호출 직후 섹션이 자동 선택됨 — 별도의 `selectSection()` 불필요
2. `addNewGridBlock()` 호출 직후 `window._activeFrame`에 생성된 frame이 자동 설정됨
3. Frame 내 셀 작업 후 섹션 레벨로 복귀하려면 `deactivateFrame()` 호출
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
| 2026-04-04 | v1.4 | `addSection paddingY` 옵션 추가. `addTextBlock content` `\n` 줄바꿈 지원(pre-wrap). `addLabelGroupBlock shape: 'circle'` 추가. Sub-Section `fullWidth` 모드 신규 (이중 배경 섹션용). `activateSubSection` / `deactivateSubSection` 공개 API 추가. 다크모드 텍스트 커서 색상 수정 (`caret-color: var(--ui-text-dim)`) |
| 2026-04-04 | v1.5 | **버그 수정**: (1) Frame(sub-section) 내부에 블록 DnD 삽입 가능 — `bindSubSectionDropZone` 정상화. (2) 플로팅 패널에서 Frame 선택 상태에서도 내부 삽입 동작 — `insertAfterSelected` `selected` 조건 제거. (3) Shape 블록(`position:absolute`) HTML5 drag 허용 — `sub-section-inner` 내부는 dragstart 차단 해제. (4) 텍스트 블록 PPT 스타일 플레이스홀더 — `data-is-placeholder="true"` 속성, 더블클릭 시 전체선택, blur 시 복원. (5) 전 블록 아웃라인 통일 — `1px solid, outline-offset: -1px`, 이중 outline(box-shadow) 제거 |
| 2026-04-07 | v1.7 | 스크래치패드 API 섹션 추가 — `_scratchAddAndSave`, `clearScratchPad`, `initScratchPad`, `switchScratch`, `switchScratchPage` |
| 2026-04-07 | v1.8 | **API 리네임**: `addSubSectionBlock` → `addFrameBlock`, `activateSubSection` → `activateFrame`, `deactivateSubSection` → `deactivateFrame`, `_activeSubSection` → `_activeFrame`, `.sub-section-block` → `.frame-block`, `.sub-section-inner` 제거됨 (frame-block이 직접 컨테이너 역할). **신규**: `addNewGridBlock(cols, rows, opts)` — 기존 `addRowBlock` 대체. `addTextBlock` wrapper 자동 래핑 명세 추가. **삭제**: `addRowBlock`, `activateCol`, `col-active` |
| 2026-04-08 | v2.0 | **`addFrameBlock` radius 옵션 추가**: `radius: number` 파라미터 추가 — `border-radius` + `overflow:hidden` 적용, `dataset.radius` 저장. fullWidth/freeLayout 양쪽 지원. `goditor_runner.js` frame/sub-section layout에서 `row.radius` 필드 자동 적용 |
| 2026-04-08 | v1.9 | **freeLayout 절대좌표 지원**: `addTextBlock` / `addAssetBlock`에 `x`, `y`, `width` 옵션 추가. freeLayout Frame 내부에서 해당 값이 있으면 absolute 고정 위치로 배치, 없으면 기존 자동 스택 동작 유지. `dataset.offsetX` / `dataset.offsetY` 저장으로 재로드 시 복원 보장. `_insertToFlowFrame(makeBlockFn, opts)` 시그니처 확장 |
| 2026-04-05 | v1.6 | **Shape 블록 완성**: (1) `deselectAll()`에 `.shape-block` 누락 추가 — 선택/해제 정상화. (2) `prop-shape.js` 신규 — `showShapeProperties(block)` 구현 (색상/두께/W·H). (3) 4코너 리사이즈 핸들 추가 — `calc(7px * var(--inv-zoom))` 배율 독립 크기, 저장 시 자동 제거. (4) 핸들 리사이즈 시 `block.left/top` 고정(0,0) — Frame(ss)만 리사이즈하도록 수정. (5) shape DnD: mousedown 드래그 제거, `isInnerBlock`에서 제외 → Frame 전체 HTML5 DnD로 이동. (6) 호버 `::after { background: var(--sel-color-fill) }` 추가 — 다른 블록과 일관성. |
