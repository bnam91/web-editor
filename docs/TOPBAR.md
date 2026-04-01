# 상단 바 (Top Bar)

> 기능 명세 + 디자인 규칙 매뉴얼
> HTML: `index.html` `#topbar` / 스타일: `css/editor-panels.css`

---

## 1. 구조 개요

```
[홈] [탭바 ···] [+탭]   [spacer]   [캔버스크기] [자동저장] | [줌 − % + Fit] | [↩ ↪] | [Commit] | [✨AI] [Reference] | [Export ▾]
```

좌→우 순서로 고정 배치. `spacer`(`flex:1`)로 좌측 그룹과 우측 그룹 분리.

---

## 2. 버튼 & 컴포넌트 명세

### 2-1. 홈 버튼 `#home-btn`

| 항목 | 내용 |
|------|------|
| 아이콘 | 집 모양 SVG (`14×14`) |
| 동작 | `goHome()` → 프로젝트 목록 페이지로 이동 |
| 위치 | 탭바 왼쪽 끝 |

---

### 2-2. 탭바 `#tab-bar`

| 항목 | 내용 |
|------|------|
| 역할 | 열린 프로젝트 탭 목록 (멀티 프로젝트) |
| 동작 | 탭 클릭 → 해당 프로젝트 전환 |
| 드래그 | 탭 드래그로 순서 변경 가능 |
| 드롭 표시 | `--color-tab-drop` 인디케이터 |
| 활성 탭 | `.active` 클래스 |

---

### 2-3. 탭 추가 `#tab-add-btn`

| 항목 | 내용 |
|------|------|
| 아이콘 | `+` (`9×9`) |
| 동작 | `toggleTabAddMenu(event)` → `#tab-add-menu` 드롭다운 표시 |
| 메뉴 내용 | 다른 프로젝트 목록 — 클릭 시 새 탭으로 열기 |

---

### 2-4. 디자인/프리뷰 모드 토글

| 버튼 | ID | 동작 | 기본 표시 |
|------|-----|------|-----------|
| Design | `#mode-design-btn` | `exitPreview()` | `display:none` (프리뷰 중에만 표시) |
| Preview | `#mode-preview-btn` | `enterPreview()` | `display:none` (프리뷰 중에만 표시) |

> 기본(에디터) 상태에서는 숨김. 프리뷰 진입 시 토글 버튼 노출.

---

### 2-5. 캔버스 크기 레이블 `#canvas-size-label`

| 항목 | 내용 |
|------|------|
| 기본값 | `860px` |
| 역할 | 현재 캔버스 너비 표시 (읽기 전용) |

---

### 2-6. 자동저장 인디케이터 `#autosave-indicator`

| 상태 | 표시 | 색상 |
|------|------|------|
| 저장됨 | `Saved` 또는 체크 아이콘 | `--color-saved` (`#4ecb7a`) |
| 저장 중 | 스피너 | — |
| 미저장 변경 | 표시 없음 또는 점 | — |

---

### 2-7. 줌 컨트롤 `#zoom-ctrl`

| 요소 | 동작 |
|------|------|
| `−` 버튼 | `zoomStep(-10)` |
| `#zoom-display` | 현재 줌 % 표시 (기본 `40%`) |
| `+` 버튼 | `zoomStep(+10)` |
| `Fit` 버튼 | `zoomFit()` — 캔버스 맞춤 |

---

### 2-8. Undo / Redo

| 버튼 | ID | 단축키 | 동작 | 비활성 조건 |
|------|-----|--------|------|-------------|
| Undo | `#undo-btn` | `⌘Z` | `undo()` | 히스토리 없을 때 `disabled` |
| Redo | `#redo-btn` | `⌘⇧Z` | `redo()` | 앞으로 기록 없을 때 `disabled` |

> 아이콘: 반시계/시계 화살표 (`12×12`)

---

### 2-9. Commit 버튼

| 항목 | 내용 |
|------|------|
| 동작 | `saveProject()` → 커밋 모달 열기 |
| 역할 | 현재 상태를 히스토리에 저장 (브랜치 커밋) |

---

### 2-10. AI 버튼 `#ai-btn`

| 항목 | 내용 |
|------|------|
| 라벨 | `✨ AI` |
| 단축키 | `⌘K` |
| 동작 | `openAiPrompt()` → AI 섹션 자동생성 패널 열기 |
| 스타일 | `.tb-btn-ai` (강조 색상) |

---

### 2-11. Reference 버튼

| 항목 | 내용 |
|------|------|
| 단축키 | `⌘⇧R` |
| 동작 | `window._refModalToggle()` → 레퍼런스 이미지 모달 |

---

### 2-12. Export 드롭다운 `#publish-btn`

| 메뉴 항목 | 동작 |
|-----------|------|
| 불러오기 | `loadProjectFile(event)` — JSON 파일 선택 |
| 다른 이름으로 저장 | `saveProjectAs()` — JSON 다운로드 |
| Figma 업로드 | `openFigmaUploadModal()` — 채널 ID 입력 후 Figma에 섹션 전송 |

> 드롭다운 토글: `togglePublishDropdown(event)` / 닫기: `closePublishDropdown()`

---

## 3. 디자인 규칙 체크리스트

### 3-1. 버튼 공통

- [ ] 기본 버튼 클래스 → `.tb-btn`
- [ ] 아이콘만 버튼 → `.tb-btn.tb-btn--icon`
- [ ] AI 버튼 → `.tb-btn.tb-btn-ai` (별도 강조 색상)
- [ ] 비활성 상태 → `disabled` attribute + opacity 감소

### 3-2. 구분선

- [ ] `.divider` — 버튼 그룹 사이 구분 세로선
- [ ] 순서: 홈+탭 | spacer | 크기+저장 | 줌 | Undo/Redo | Commit | AI+Reference | Export

### 3-3. 높이 & 간격

- [ ] `#topbar` height → 고정 (`38px` or `40px` — CSS 확인)
- [ ] 버튼 padding → 균일
- [ ] 줌 컨트롤 내부 구분 → `.zoom-sep`

---

## 4. 관련 파일

| 파일 | 역할 |
|------|------|
| `index.html` (`#topbar`) | 구조 정의 |
| `css/editor-panels.css` | `.tb-btn`, `#topbar`, `.zoom-*` 스타일 |
| `js/editor.js` | `undo`, `redo`, `zoomStep`, `zoomFit` |
| `js/save-load.js` | `saveProject`, `saveProjectAs`, `loadProjectFile` |
| `js/export.js` | `openFigmaUploadModal`, `doFigmaUpload` |
| `js/preview.js` | `enterPreview`, `exitPreview` |
| `js/branch-system.js` | 탭 전환 및 커밋 히스토리 |
