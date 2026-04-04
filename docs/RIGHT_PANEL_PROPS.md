# 우측 패널 — 프로퍼티 패널 (Properties Panel)

> 기능 명세 + 디자인 규칙 매뉴얼
> HTML: `index.html` `#panel-right` / 스타일: `css/editor-props.css`

---

## 1. 개요

선택된 요소에 따라 패널 내용이 동적으로 교체되는 **컨텍스트 민감형** 패널.
`propPanel.innerHTML`을 통해 각 `prop-*.js`가 콘텐츠를 주입한다.

### 표시 조건 → 담당 파일

| 선택 상태 | 표시 내용 | 담당 파일 |
|-----------|-----------|-----------|
| 아무것도 선택 안 됨 | 페이지 설정 | `prop-page.js` |
| `.section-block` | 섹션 프로퍼티 | `prop-section.js` |
| `.sub-section-block` | Frame 프로퍼티 | `prop-frame.js` (Auto/Free 모드 통합) |
| `.text-block` | 텍스트 프로퍼티 | `prop-text.js` |
| `.asset-block` | 에셋 프로퍼티 | `prop-asset.js` |
| `.gap-block` | Gap 프로퍼티 | `prop-gap.js` |
| `.icon-circle-block` | Asset-Circle 프로퍼티 | `prop-icon-circle.js` |
| `.shape-block` | Shape 프로퍼티 (Frame prop 패널에 통합) | `prop-frame.js` |
| `.table-block` | 테이블 프로퍼티 | `prop-table.js` |
| `.card-block` | 카드 프로퍼티 | `prop-card.js` |
| `.graph-block` | 그래프 프로퍼티 | `prop-graph.js` |
| `.divider-block` | 구분선 프로퍼티 | `prop-divider.js` |
| `.label-group-block` | 라벨그룹 프로퍼티 | `prop-label-group.js` |
| Row / Col | 레이아웃 프로퍼티 | `prop-row.js` / `prop-layout.js` |
| `.canvas-block` | 캔버스 프로퍼티 | `prop-canvas.js` |

---

## 2. 공통 UI 구조

모든 프로퍼티 패널이 공유하는 구조:

```html
<!-- 블록 헤더 (블록 종류 + 이름 + ID 배지) -->
<div class="prop-block-label">
  <div class="prop-block-icon">  ← 16×16 SVG 아이콘 (#, H, 이미지 등)
  <div class="prop-block-info">
    <span class="prop-block-name">블록명</span>
  </div>
  <span class="prop-block-id">block_abc123</span>  ← 클릭 시 클립보드 복사
</div>

<!-- 섹션 단위로 컨트롤 묶음 -->
<div class="prop-section">
  <div class="prop-section-title">섹션제목</div>
  <!-- 컨트롤들 -->
</div>
```

---

## 3. 프로퍼티 패널별 상세 명세

### 3-1. 페이지 설정 (`prop-page.js`)

**표시 조건**: 빈 캔버스 클릭 or 아무것도 선택 안 됨

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 배경 | 배경색 picker + hex | `state.pageSettings.bg` |
| 일괄 정렬 | left / center / right 버튼 | 모든 텍스트 블록 일괄 정렬 |
| 레이아웃 | 섹션 간격 슬라이더+숫자 | `state.pageSettings.gap` (0~200) |
| 레이아웃 | 좌우 패딩 슬라이더+숫자 | `state.pageSettings.padX` (0~200) — override 없는 모든 섹션의 `section-inner` `paddingLeft/Right` 일괄 적용 (`window.applyPagePadX(v)`) |
| 레이아웃 | 에셋블록 패딩 제외합니다. 체크박스 | `state.pageSettings.padXExcludesAsset` — 체크 시 캔버스 내 **모든** `.asset-block`에 `usePadx='true'` 일괄 설정 + negative margin(`-padX`) + `width: calc(100% + padX*2)` 적용. 신규 섹션/블록 추가 시에도 자동 적용됨 |
| 레이아웃 | 상하 패딩 슬라이더+숫자 | `state.pageSettings.padY` (0~200, 기본 0) |
| 내보내기 | 포맷 선택 (PNG/JPG) | `page-export-format` |
| 내보내기 | 전체 섹션 내보내기 버튼 | `window.exportAllSections(fmt)` |

---

### 3-2. 섹션 프로퍼티 (`prop-section.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | 섹션 이름 + ID 배지 | 이름 인라인 편집 가능, ID 클릭 시 복사 |
| 배경 | 배경색 picker + hex | `sec.dataset.bg`, `sec.style.backgroundColor` |
| 배경 | 배경 이미지 선택 버튼 | FileReader → base64 → `sec.style.backgroundImage`, `sec.dataset.bgImg` |
| 배경 | 위치 편집 버튼 | 배경 이미지 있을 때만 표시. `enterBgPosDragMode(sec)` — 드래그로 `background-position` 조정, `sec.dataset.bgPos` 저장 |
| 배경 | 이미지 제거 버튼 | 배경 이미지 있을 때만 표시 |
| 크기 | 높이 슬라이더+숫자 | `min-height` 조정, `sec.dataset.height` |
| 크기 | 상/하 여백 | `paddingTop/Bottom`, `sec.dataset.padY` |
| 레이아웃 | 정렬 버튼 (left/center/right) | 섹션 내 블록 정렬 |
| 패딩 | 좌우 패딩 슬라이더+숫자 | `section-inner` `paddingLeft/Right` + `inner.dataset.paddingX` 저장. 값 있으면 페이지 padX 일괄적용에서 제외(override). 0으로 내리면 dataset 초기화 → 페이지 설정 따름. 슬라이더 조절 시 섹션 내 각 asset-block의 `usePadx` 값도 반영 |
| 라벨 | 섹션 라벨 선택 | Hook / Main / Detail / CTA / Event |
| 내보내기 | PNG/JPG 내보내기 버튼 | 단일 섹션 내보내기 |
| 변형 | 섹션 Variation 관리 | A/B 변형 추가/전환 |
| 템플릿 | 현재 섹션을 템플릿으로 저장 | `saveAsTemplate(sec, name, folder, category, tags, 'section')` |

---

### 3-3. Frame 프로퍼티 (`prop-frame.js`)

> Auto / Free 두 가지 모드를 통합 관리. `window.showSubSectionProperties`는 `prop-frame.js`가 override함.
> 헤더 이름: `el.dataset.layerName || 'Frame'`으로 표시. Shape Frame의 경우 도형명(star, rectangle 등) 자동 표시.
> 헤더 아이콘: 일반 Frame → Figma cross-frame 아이콘. Shape Frame → 도형별 아이콘 (star/rectangle/ellipse/line/arrow/polygon)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Frame 이름 + ID 배지 | `el.dataset.layerName || 'Frame'`으로 표시. 클릭 시 ID 클립보드 복사 |
| 헤더 | 캔버스 모드로 전환 버튼 | 단방향 전환 — 내부 블록을 절대좌표 canvas-item으로 변환 (되돌리기 불가, confirm 다이얼로그) |
| 배경 | 배경색 picker + hex | `ss.dataset.bg`, `ss.style.backgroundColor` |
| 배경 | 배경 이미지 선택 버튼 | FileReader → base64 → `ss.style.backgroundImage`, `ss.dataset.bgImg` |
| 배경 | 위치 편집 버튼 | 배경 이미지 있을 때만 표시. 클릭 시 `enterBgPosDragMode(ss)` — 드래그로 `background-position` 조정, `ss.dataset.bgPos` 저장 |
| 배경 | 이미지 제거 버튼 | 배경 이미지 있을 때만 표시. `bgImg`, `bgPos` dataset 모두 클리어 |
| 보더 | 두께 슬라이더+숫자 | 0~20px, `ss.style.border`, `ss.dataset.borderWidth` |
| 보더 | 스타일 선택 | solid / dashed / dotted, `ss.dataset.borderStyle` |
| 보더 | 색상 picker + hex | `ss.dataset.borderColor` |
| 보더 | 코너 슬라이더+숫자 | 0~80px, `ss.style.borderRadius`, `ss.dataset.radius` |
| 크기 | 너비 슬라이더+숫자 | 200~860px, `ss.style.width`, `ss.dataset.width` |
| 크기 | 높이 슬라이더+숫자 | 100~1200px, `ss.style.minHeight`, `ss.dataset.height` |
| 크기 | 상/하 여백 | 0~200px, `ss.style.paddingTop/Bottom`, `ss.dataset.padY` |
| 컴포넌트 | 폴더 선택 + 새 폴더 | 기존 템플릿 폴더 목록 + "새 폴더..." 옵션 |
| 컴포넌트 | 카테고리 선택 | Hero/Main/Feature/Detail/CTA/Event/기타 |
| 컴포넌트 | 이름 입력 + 저장 버튼 | `saveAsTemplate(ss, name, folder, category, [], 'subsection')` 호출. 템플릿 패널에 "컴포넌트" 배지로 표시 |
| 힌트 | 안내 텍스트 | "서브섹션 클릭 후 플로팅 패널에서 블록 추가" |

#### 서브섹션 저장/복원 규칙 (`save-load.js` `rebindAll`)
| dataset 키 | 복원 대상 |
|-----------|---------|
| `bgImg` | `backgroundImage` (없으면 `center`, `bgPos` 있으면 해당 값) |
| `bgPos` | `backgroundPosition` |
| `borderWidth` + `borderStyle` + `borderColor` | `border` 단축 속성 |
| `radius` | `borderRadius` |

#### 복사/붙여넣기
- **복사**: 서브섹션 선택 후 Cmd+C → 부모 `row` 단위로 클립보드 저장
- **붙여넣기**: Cmd+V → 현재 선택 섹션에 `insertAfterSelected`, `bindSubSectionDropZone` 재연결 + ID 재생성
- **레이어 패널 선택 후 복사**: 지원됨 (`.sub-section-block.selected` 감지)

---

### 3-4. 텍스트 프로퍼티 (`prop-text.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | 텍스트 타입명 + ID | h1/h2/h3/body/caption/label |
| 스타일 | 텍스트 타입 변경 | Heading/Body/Caption/Label 전환 |
| 서식 | Bold / Italic / Underline 토글 | 선택 영역 또는 전체 |
| 정렬 | left / center / right | `contentEl.style.textAlign` |
| 색상 | 글자색 picker + hex | `contentEl.style.color` |
| 크기 | 폰트 크기 | `font-size` |
| 패딩 | 좌우 패딩 | 개별 텍스트 블록 오버라이드 |

---

### 3-5. 에셋 프로퍼티 (`prop-asset.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Asset + ID | — |
| 이미지 | 이미지 업로드 버튼 | 파일 선택 → base64 저장 |
| 이미지 | 이미지 편집 | 위치/크기 조정 (CI 핸들) |
| 이미지 | 이미지 삭제 | `dataset.imgW/X/Y` 초기화 |
| 크기 | 비율 선택 | Standard / Square / Tall / Wide / Logo |
| 크기 | 높이 조정 | px 슬라이더 |
| 패딩 | 패딩 제외 토글 | `ab.dataset.usePadx` — ON 시 `section-inner` padX를 무시하고 full-width 표시. `margin-left/right: -padX`, `width: calc(100% + padX*2)` 적용. 소속 섹션의 override padX 우선, 없으면 `pageSettings.padX` 사용 |
| 배경 | 배경색 | 이미지 없을 때 배경 |
| 모서리 | border-radius | 0~40px |

---

### 3-6. Gap 프로퍼티 (`prop-gap.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Gap + ID | — |
| 크기 | 높이 슬라이더+숫자 | `0~1000px` |

---

### 3-7. Asset-Circle 프로퍼티 (`prop-icon-circle.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Asset-Circle + ID | — |
| 이미지 | 원형 이미지 업로드 | `triggerCircleUpload` |
| 크기 | 원 크기 슬라이더 | 지름 px |
| 배경 | 원 배경색 | — |
| 배치 | 정렬 (left/center/right) | — |

---

### 3-8. 테이블 프로퍼티 (`prop-table.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Table + ID | — |
| 구조 | 행/열 추가·삭제 | 동적 테이블 편집 |
| 스타일 | 헤더 행 배경색 | — |
| 스타일 | 스트라이프 색상 | 짝수 행 배경 |
| 크기 | 폰트 크기 | 테이블 전체 |

---

### 3-9. 카드 프로퍼티 (`prop-card.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Card + ID | — |
| 배경 | 카드 배경색 | — |
| 모서리 | border-radius | — |
| 크기 | 높이 | — |
| 이미지 | 이미지 영역 높이 | — |

---

### 3-10. 그래프 프로퍼티 (`prop-graph.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Graph + ID | — |
| 데이터 | 데이터 편집 | 값, 라벨 입력 |
| 스타일 | 바 색상 | — |
| 스타일 | 배경 색상 | — |
| 타입 | 그래프 형태 | Bar / Line 등 |

---

### 3-11. 구분선 프로퍼티 (`prop-divider.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Divider + ID | — |
| 색상 | 선 색상 picker | — |
| 두께 | stroke-width | — |
| 스타일 | solid / dashed / dotted | — |
| 여백 | 상하 여백 | — |

---

### 3-12. 라벨그룹 프로퍼티 (`prop-label-group.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Label Group + ID | — |
| 정렬 | left / center / right | `justifyContent` |
| 태그 | 태그 추가·삭제 | 태그 문자열 편집 |
| 스타일 | 배경색, 글자색 | 개별 태그 색상 |
| 모서리 | border-radius | — |

---

### 3-13. Row / 레이아웃 (`prop-row.js`, `prop-layout.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| Row | 행 간격 | `gap` |
| Row | 정렬 | 수직 align-items |
| Col | 컬럼 너비 비율 | flex 비율 조정 |
| Col | 패딩 | 컬럼 내부 여백 |

---

### 3-14. 캔버스 프로퍼티 (`prop-canvas.js`)

| 섹션 | 컨트롤 | 설명 |
|------|--------|------|
| 헤더 | Canvas + ID | — |
| 크기 | 너비/높이 | `canvas-block` 크기 |
| 배경 | 배경색 | — |

---

## 4. 패딩 아키텍처

### 4-0. 구조 개요

```
페이지 padX (state.pageSettings.padX)
  └─ section-inner paddingLeft/Right  ← 모든 섹션 기본값
       └─ 섹션 override (inner.dataset.paddingX)  ← 섹션 슬라이더로 개별 지정 시 분리
```

- **CSS 변수 방식 폐기**: 구버전 `--page-padx` CSS 변수 방식 → `section-inner` physical padding으로 교체
- **2단계 상속**: 페이지 기본값 → 섹션 개별 override
- **override 조건**: `inner.dataset.paddingX`가 설정된 섹션은 `applyPagePadX()` 대상에서 제외

### 4-0-1. applyPagePadX 동작

```javascript
window.applyPagePadX(padX)
// dataset.paddingX 없는 섹션만 section-inner padding 적용
// 각 asset-block의 usePadx 값 읽어 negative margin 결정
```

### 4-0-2. 에셋블록 패딩 제외 (usePadx)

| 상태 | dataset | 적용 스타일 |
|------|---------|------------|
| 일반 (패딩 받음) | `usePadx` 없음 or `'false'` | margin/width 없음 |
| 패딩 제외 | `usePadx='true'` | `margin-left/right: -padX; width: calc(100% + padX*2)` |

- **개별 설정**: 에셋 프로퍼티 "패딩 제외" 토글
- **일괄 설정**: 페이지 프로퍼티 "에셋블록 패딩 제외합니다." 체크박스
- **신규 블록 자동 적용**: `padXExcludesAsset=true` 상태에서 `addSection()` / `addAssetBlock()` 호출 시 즉시 적용

---

## 5. 디자인 규칙 체크리스트

### 4-1. 공통 구조

- [ ] 블록 헤더 `.prop-block-label` → 아이콘(16px) + 이름 + ID 배지
- [ ] 헤더 아이콘 → `width/height: 16px`, Figma `#` 경로 (섹션/서브섹션/페이지) 또는 블록 타입 아이콘
- [ ] ID 배지 `.prop-block-id` → 클릭 시 클립보드 복사 (`navigator.clipboard.writeText`)
- [ ] 섹션 제목 `.prop-section-title` → `font-size: 11px`, `color: var(--text-hint)`
- [ ] 섹션 구분 `.prop-section` → 하단 border 또는 padding으로 구분
- [ ] `prop-block-name` 텍스트는 반드시 `block.dataset.layerName || 'DefaultName'`으로 읽어야 함 (하드코딩 금지)

### 4-2. 입력 컴포넌트

- [ ] 색상 행 `.prop-color-row` → 라벨 + 스와치 + hex 입력 3단 구성
- [ ] 스와치 `.prop-color-swatch` → color picker `input[type=color]` 포함
- [ ] 슬라이더+숫자 행 `.prop-row` → `prop-label` + `prop-slider` + `prop-number` 3단
- [ ] 슬라이더 `.prop-slider` → range input
- [ ] 숫자 `.prop-number` → number input, 직접 입력 가능
- [ ] 슬라이더↔숫자 양방향 동기화 필수

### 4-3. 버튼

- [ ] 정렬 버튼 `.prop-align-btn` → left/center/right, active 상태 `.active` 클래스
- [ ] 내보내기 버튼 `.prop-export-btn` → 전체 너비
- [ ] 선택 `.prop-select` → 전체 너비 드롭다운

### 4-4. 변경 이력

- [ ] 슬라이더 `mousedown` → `pushHistory()`
- [ ] 숫자 `change` → `pushHistory()`
- [ ] 값 변경 시 `scheduleAutoSave()` 호출
- [ ] 색상 `input` → 즉시 반영 / `change` → `pushHistory()`

### 4-5. 힌트 텍스트

- [ ] `.prop-hint` → `font-size: 11px`, `color: #999`, 안내 문구용

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `js/prop-page.js` | 페이지 설정 패널 |
| `js/prop-section.js` | 섹션 프로퍼티 |
| `js/prop-frame.js` | Frame 프로퍼티 (Auto/Free 통합, window.showSubSectionProperties 담당) |
| `js/prop-subsection.js` | 서브섹션 프로퍼티 (레거시, prop-frame.js로 대체됨) |
| `js/prop-text.js` | 텍스트 프로퍼티 |
| `js/prop-asset.js` | 에셋 프로퍼티 |
| `js/prop-gap.js` | Gap 프로퍼티 |
| `js/prop-icon-circle.js` | 아이콘서클 프로퍼티 |
| `js/prop-table.js` | 테이블 프로퍼티 |
| `js/prop-card.js` | 카드 프로퍼티 |
| `js/prop-graph.js` | 그래프 프로퍼티 |
| `js/prop-divider.js` | 구분선 프로퍼티 |
| `js/prop-label-group.js` | 라벨그룹 프로퍼티 |
| `js/prop-row.js` | Row 프로퍼티 |
| `js/prop-layout.js` | Col/레이아웃 프로퍼티 |
| `js/prop-canvas.js` | 캔버스 프로퍼티 |
| `js/globals.js` | `propPanel` DOM 참조 |
| `css/editor-props.css` | 프로퍼티 패널 스타일 전체 |
