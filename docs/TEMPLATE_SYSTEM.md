# 템플릿 시스템 (Template System)

> 기능 명세 + 구현 주의사항
> 담당 파일: `js/panels/template-system.js`, `js/panels/template-browser.js`

---

## 1. 개요

섹션 · 컴포넌트 · 블록을 저장하고 재삽입하는 시스템.
- **Electron**: 파일 기반 저장 (`index.json` + `canvas/{id}.html`)
- **비-Electron**: `localStorage` fallback (키 `sangpe-templates`)

### 저장 뿌리 — ★계정별로 갈린다
| 뿌리 | 경로 | 쓰기 |
|------|------|------|
| 공용(레거시) | `<userData>/templates/` | ⛔**읽기 전용** — 모든 계정이 함께 본다 |
| 개인 | `<userData>/accounts/<계정키>/templates/` | 읽기·쓰기 |
| 미해결 | `<userData>/accounts/_unresolved/templates/` | 계정을 못 읽었을 때의 착지점 |

목록 조회는 **공용 ∪ 개인**을 합쳐 돌려주고, 항목마다 런타임 표식 `_scope`(`'shared'` \| `'personal'`)가 붙는다.
⛔`_scope` 는 디스크에 쓰지 않는다. 저장 시 공용 항목은 걸러내고 **개인 뿌리에만** 기록한다.

---

## 2. 템플릿 타입

| 타입 | 대상 | 삽입 위치 |
|------|------|---------|
| `section` | `.section-block` | 선택 섹션 뒤 (없으면 캔버스 맨 아래) — ★`type` 이 없으면 이 분기로 온다(기본값) |
| `subsection` | `.frame-block` | 선택된 섹션 안에 `row > col` 을 새로 만들어 append |
| `block` | 개별 블록 | 선택된 섹션에 `row` 로 감싸 `insertAfterSelected` |

⛔**`frame` 이라는 `type` 값은 없다.** 예전 이름이며 지금은 `subsection` 이다.
저장본 루트가 구형 `.sub-section-block` 인 템플릿은 `section` 분기의 클래스 검사에서 걸러진다 —
그때 **조용히 끝나지 않고** 「섹션 템플릿이 아닙니다」를 토스트로 알린다.

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

### 캔버스 HTML (`canvas/{id}.html`)
- `section` 타입: `.section-block` outerHTML
- `subsection` 타입: `.frame-block` outerHTML
- `block` 타입: 해당 블록 outerHTML

### ★템플릿 안 «경로형 이름표» (`data-tpl-path`)
저장 시 노드마다 `data-tpl-path` 를 심는다 — MCP·클로드코드가 「그 아이디의 것」으로 가리키기 위한 것이다.
```
참조형  <템플릿id>#<경로>      예) tpl_1775018641878#row1/text1
경로    <종류><n> 을 «/» 로 잇는다 · 같은 부모·같은 종류 안에서 1-based
건너뜀  section-inner · col · sub-section-inner (순수 래퍼 + col 언랩 마이그레이션을 타고 넘기 위해)
```
- ★**계산이 정본이다.** 조회는 저장본을 파싱해 «그 자리에서» 경로를 만든다 —
  그래서 이름표가 저장돼 있지 않은 «옛 템플릿»도 마이그레이션 없이 조회된다.
- ⛔**캔버스에 삽입될 때 떼어낸다.** 템플릿 안에서만 쓰는 표식이라 캔버스·저장본에 남지 않는다.

---

## 4. 공개 API

전부 `window.*` 로 노출된다.

| 함수 | 설명 |
|------|------|
| `initTemplates()` | 앱 시작 시 1회 — 인덱스 로드 + localStorage → 파일 이관 |
| `loadTemplates()` | 캐시된 메타데이터 배열 반환 (공용 ∪ 개인) |
| `loadTemplatesPublic()` | 〃 (외부 호출용 별칭) |
| `saveTemplatesPublic()` | 인덱스 저장 |
| `saveAsTemplate(el, name, folder, category, tags, type)` | 섹션·컴포넌트를 클론 후 저장 |
| `saveBlockAsTemplate(el, name, folder, tags)` | 개별 블록을 저장 |
| `deleteTemplate(id)` | 메타 + canvas 파일 삭제 (⛔공용 항목은 거부) |
| `insertTemplate(tpl)` | 타입별 캔버스 삽입 |
| `renderTemplatePanel()` | 좌측 패널 템플릿 목록 갱신 |
| `showTemplatePreview(id)` | 미리보기 렌더 |
| `_loadCanvas(id)` | 저장본 HTML 로드 — 떼어낸 창(`pages/template-browser.html`)도 이걸 쓴다 |
| `listTemplateNodes(tplId)` | 템플릿 안 노드 목록 `[{path, kind, text}]` |
| `findTemplateNode(tplId, path)` | 경로로 노드 조회 `{path, kind, html, text} \| null` |
| `initTemplateBrowser()` | 브라우저 패널 초기화 |
| `openTemplateBrowser()` · `closeTemplateBrowser()` · `toggleTemplateBrowser()` | 브라우저 패널 여닫기 |

⛔이 모듈이 `window.showToast` 와 `window.bindSectionHitzone` 에도 대입하지만 **그 둘은 이 모듈의 API 가 아니다** —
전자는 편집기 응답을 회수하려고 «잠시» 가로챈 뒤 `finally` 로 원복하는 것이고, 후자는 기존 함수를 감싸는 훅이다.
정본은 각각 `js/drag-utils.js` · `js/editor.js` 에 있다.

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
1. 선택된 섹션이 없으면 **안내하고 끝낸다**
2. canvas HTML 로드 → 루트 파싱. `.frame-block` 이 아니면 **「컴포넌트 템플릿이 아닙니다」를 알리고** 끝낸다
3. ID 재생성 (`ss_xxxxx`)
4. `row > col` 을 새로 만들어 그 안에 넣고, 섹션의 `section-inner` 에 append
5. `bindFrameDropZone()` · `migrateGridIdentity()` · 내부 블록 `bindBlock()` 재바인딩
6. `dataset.*` 기반 스타일 복원 (bg, bgImg, radius, border)
7. `pushHistory()` → `buildLayerPanel()`

### block 타입
1. 선택된 섹션이 없으면 **안내하고 끝낸다**
2. canvas HTML 로드 → 루트 파싱. 비었으면 **「비었거나 손상됐습니다」를 알리고** 끝낸다
3. `row` 로 감싸 `insertAfterSelected()`
4. `migrateGridIdentity()` · `bindBlock()` · (grid 면) `renderGridBlock()`
5. `pushHistory()` → `buildLayerPanel()` → `scheduleAutoSave()`

> ★**세 분기 모두 «조용히 끝나지 않는다».** 파싱 결과가 없거나 루트 클래스가 어긋나면
> 그 이유를 토스트로 말한다 — 예전엔 아무 말 없이 `return` 해서 「눌렀는데 아무 일도 안 남」이 됐다.

---

## 6. 구현 주의사항

### ⚠️ 프리뷰 인라인 스타일 잔류 버그

**방어는 3층이고, 세 층이 각각 다른 파일에 있다:**

| 층 | 어디 | 언제 |
|----|------|------|
| ① 방지 | `js/panels/template-system.js` `insertTemplate` | 삽입 직전 |
| ② 복구 | `js/io/save-load.js` `rebindAll()` | 로드할 때마다 |
| ③ 최후 | `js/io/section-serialize.js` `serializeCleanRoot()` | 저장 직전 clone |

`js/panels/template-browser.js` 의 미리보기 렌더링은 섹션 DOM에 직접 인라인 스타일을 적용한다:

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

**최후 방어선 — `serializeCleanRoot` (저장 직전 clone 정리):**

⚠️이 3층은 예전에 `getSerializedCanvas` 안에 있었으나, 지금은 세척 파이프라인의 단일 진실원인
`js/io/section-serialize.js` 의 `serializeCleanRoot()` 로 **옮겨졌다**. `getSerializedCanvas` 는 그 함수를 부른다.
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
| `js/panels/template-system.js` | 저장/로드/삽입 로직 · 경로형 이름표 |
| `js/panels/template-browser.js` | 템플릿 브라우저 UI + 미리보기 렌더링 |
| `js/io/save-load.js` | `rebindAll()` — 로드 시 잔류 스타일 정리 |
| `js/io/section-serialize.js` | `serializeCleanRoot()` — 저장 직전 세척(방어 3층) |
| `js/props/prop-section.js` | 섹션을 템플릿으로 저장하는 입구 |
| `js/props/prop-frame.js` | 컴포넌트(`subsection`)를 저장하는 입구 |
| `js/block-factory.js` | 블록(`block`)을 저장하는 입구 |
| `pages/template-browser.html` | 떼어낸 창(뷰어) — 같은 브라우저 코드를 그대로 싣는다 |
| `main.js` | `templates:*` IPC · 계정별 저장 뿌리 |
| `preload.js` | 렌더러 ↔ main 브리지 |
| `templates/index.json` | 저장소에 시드되는 기본 메타데이터 |
| `templates/canvas/` | 시드 HTML 파일 디렉토리 |
| `css/editor-extra.css` | 브라우저 패널 CSS (태그칩, 즐겨찾기 버튼 포함) |
| `index.html` | `#tpl-browser-tag-chips` 태그칩 컨테이너 |
