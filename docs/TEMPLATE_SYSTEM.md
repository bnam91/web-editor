# 템플릿 시스템 (Template System)

> 기능 명세 + 구현 주의사항
> 담당 파일: `js/template-system.js`, `js/template-browser.js`

---

## 1. 개요

섹션 또는 서브섹션 컴포넌트를 저장하고 재삽입하는 시스템.
- **Electron**: 파일 기반 저장 (`templates/index.json` + `templates/canvas/{id}.html`)
- **비-Electron**: `localStorage` fallback

---

## 2. 템플릿 타입

| 타입 | 대상 | 삽입 위치 |
|------|------|---------|
| `section` | `.section-block` | 캔버스 맨 아래 (또는 선택 섹션 뒤) |
| `subsection` | `.sub-section-block` | 선택된 섹션의 `section-inner` 안 |

---

## 3. 저장 구조

### 메타데이터 (`templates/index.json`)
```json
[
  {
    "id": "tpl_1234567890",
    "name": "배너 컴포넌트",
    "folder": "컴포넌트",
    "category": "배너",
    "tags": [],
    "createdAt": "ISO 날짜",
    "thumbnail": null,
    "type": "subsection"
  }
]
```

### 캔버스 HTML (`templates/canvas/{id}.html`)
- `section` 타입: `.section-block` outerHTML
- `subsection` 타입: `.sub-section-block` outerHTML

---

## 4. 공개 API

| 함수 | 설명 |
|------|------|
| `initTemplates()` | 앱 시작 시 1회 — 인덱스 로드 + localStorage → 파일 마이그레이션 |
| `loadTemplates()` | 캐시된 메타데이터 배열 반환 |
| `saveAsTemplate(el, name, folder, category, tags, type)` | 요소를 클론 후 저장 |
| `deleteTemplate(id)` | 메타 + canvas 파일 삭제 |
| `insertTemplate(tpl)` | 타입별 캔버스 삽입 |
| `renderTemplatePanel()` | 좌측 패널 템플릿 목록 갱신 |

---

## 5. 삽입 흐름 (`insertTemplate`)

### section 타입
1. canvas HTML 로드 → `<div>` 파싱
2. ID 재생성 (중복 방지)
3. **프리뷰 인라인 스타일 제거** (아래 주의사항 참고)
4. `selected` 클래스 제거
5. **섹션 라벨 = 템플릿 이름으로 설정**
   ```js
   sec.dataset.name = tpl.name;
   const labelEl = sec.querySelector('.section-label');
   if (labelEl) labelEl.textContent = tpl.name;
   ```
6. 이벤트 바인딩 (click, bindSectionDelete, bindSectionDrag 등)
7. `buildLayerPanel()` → `selectSection()`

### subsection 타입
1. canvas HTML 로드 → `.sub-section-block` 파싱
2. ID 재생성 (`ss_xxxxx`)
3. `row > col > sub-section-block` 구조로 감싸기
4. 선택된 섹션의 `section-inner`에 append
5. `bindSubSectionDropZone()` 재바인딩
6. `dataset.*` 기반 스타일 복원 (bgImg, radius, border)
7. `buildLayerPanel()`

---

## 6. 구현 주의사항

### ⚠️ 프리뷰 인라인 스타일 잔류 버그

`template-browser.js`의 미리보기 렌더링은 섹션 DOM에 직접 인라인 스타일을 적용한다:

```js
section.style.transform       = `scale(${scale})`;  // 예: scale(0.11)
section.style.transformOrigin = 'top left';
section.style.position        = 'relative';
section.style.left            = `${leftOffset}px`;
section.style.pointerEvents   = 'none';
section.style.userSelect      = 'none';
```

이 스타일이 제거되지 않은 채 캔버스에 삽입되면:
- 섹션이 10% 크기로 표시됨
- 클릭이 안 됨 (`pointer-events: none`)

**방지 코드 — `insertTemplate` 삽입 직전 필수:**
```js
sec.style.transform     = '';
sec.style.transformOrigin = '';
sec.style.position      = '';
sec.style.left          = '';
sec.style.pointerEvents = '';
sec.style.userSelect    = '';
```

**복구 코드 — `rebindAll` 내 안전장치 (저장된 데이터 자동 정리):**

조건부 체크 없이 6개 속성을 **무조건** 초기화 (조건부 체크는 `transformOrigin` 누락, `position` 조건 버그 가능):
```js
sec.style.transform       = '';
sec.style.transformOrigin = '';
sec.style.position        = '';
sec.style.left            = '';
sec.style.pointerEvents   = '';
sec.style.userSelect      = '';
```

**최후 방어선 — `getSerializedCanvas` 저장 직전 clone 정리:**
```js
// 저장 clone에서 임시 스타일 제거 → 오염된 스타일이 파일에 포함되지 않도록
clone.querySelectorAll('.section-block').forEach(sec => {
  sec.style.transform = sec.style.transformOrigin = '';
  sec.style.position  = sec.style.left            = '';
  sec.style.pointerEvents = sec.style.userSelect  = '';
});
```

---

## 7. 태그 칩 필터

검색창 아래 현재 필터된 템플릿들의 태그 칩 목록을 표시한다.

- **위치**: `#tpl-browser-tag-chips` (검색창 wrap 아래, body 위)
- **렌더 함수**: `_renderTagChips(filteredTemplates)` — `_renderBrowserCards()` 내에서 태그 필터 적용 **전** 호출
- **활성 태그**: `_browserFilter.tag` 로 관리 (토글 — 같은 태그 클릭 시 null로 해제)
- 태그가 없는 필터 결과에서는 칩 영역이 숨겨진다 (`display:none`)

### 태그 칩 상태 클래스

| 클래스 | 의미 |
|--------|------|
| `.tb-tag-chip` | 기본 칩 |
| `.tb-tag-chip.active` | 현재 선택된 태그 (파란색) |

---

## 8. 즐겨찾기(★) 기능

### 저장소
- `localStorage` 키: `tpl-starred`
- 형식: JSON 배열 (template id 문자열)
- 헬퍼: `_getStarred()` → `Set<string>`, `_setStarred(set)` → 저장

### 카드 ★ 버튼
- 각 카드의 `.tb-card-btns` 영역에 `.tb-card-star-btn` 버튼 포함
- 버튼과 카드 모두 `data-tpl-id` 속성으로 템플릿 ID 보유 (`data-id` 아님)
- 클릭 시 즐겨찾기 토글 → localStorage 즉시 저장 → 버튼 UI 즉시 반영
- `.starred` 클래스: 노란색(`#f5a623`), 기본: 회색(`#444`)
- 클릭 이벤트는 카드 선택/드래그와 **독립적** (`.tb-card-star-btn` 체크로 버블링 차단)

### 트리 패널 즐겨찾기 항목
- `_renderBrowserTree()` 최상단에 `.tb-tree-starred` 항목 렌더
- 클릭 시 `_browserFilter.starred = true` 설정 → 즐겨찾기 템플릿만 카드에 표시
- 다른 폴더/카테고리 클릭 시 `starred: false` 로 자동 해제
- 즐겨찾기 카운트는 `loadTemplates()` 기준 실시간 계산

### `_browserFilter` 확장
```js
let _browserFilter = { folder: '전체', category: '전체', tag: null, starred: false };
```

---

## 9. 관련 파일

| 파일 | 역할 |
|------|------|
| `js/template-system.js` | 저장/로드/삽입 로직 |
| `js/template-browser.js` | 템플릿 브라우저 UI + 미리보기 렌더링 |
| `js/save-load.js` | `rebindAll()` — 로드 시 잔류 스타일 정리 |
| `templates/index.json` | 메타데이터 인덱스 |
| `templates/canvas/` | 섹션 HTML 파일 저장 디렉토리 |
| `css/editor-extra.css` | 브라우저 패널 CSS (태그칩, 즐겨찾기 버튼 포함) |
| `index.html` | `#tpl-browser-tag-chips` 태그칩 컨테이너 |
