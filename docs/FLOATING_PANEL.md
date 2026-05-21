# 플로팅 패널 (Floating Panel)

> 기능 명세 + 디자인 규칙 매뉴얼
> HTML: `index.html` `#floating-panel` / 스타일: `css/editor-panels.css`

---

## 1. 개요

캔버스 좌측 하단에 고정 위치하는 빠른 블록 추가 패널.
선택된 섹션을 기준으로 블록을 삽입한다.

> **삽입 규칙**: 섹션이 선택된 상태에서 버튼 클릭 → 해당 섹션에 추가
> `window._activeFrame`이 설정된 경우 → 프레임 안에 추가

---

## 2. 버튼 & 드롭다운 명세

> **2026-05-21 갱신**: 실장 기준으로 명세를 일치시킴. (이전 명세에 있던 New Grid / Canvas / Gap 별도 버튼, Shelf 버튼은 제거되었거나 다른 진입점으로 통합됨)

### 2-1. 브랜치 인디케이터 `#branch-indicator`

| 항목 | 내용 |
|------|------|
| 아이콘 | 브랜치 SVG (`11×11`) |
| 표시 | `#branch-name` — 현재 브랜치명 |
| 동작 | `toggleBranchDropdown(event)` → `#branch-dropdown-menu` 표시 |
| 메뉴 | 브랜치 목록 — 클릭 시 전환 / 새 브랜치 생성 |
| **MVP 상태** | `.tb-hidden-mvp`로 **숨김**. 다음 divider도 같이 숨김 |

---

### 2-2. 레이아웃 그룹

| 버튼 | 함수 | 설명 |
|------|------|------|
| **Section** | `addSection()` | 새 섹션 추가 (`.fp-btn.primary` 강조) |
| **Frame** | `addFrameBlock()` | 프레임 추가 (Auto/Free 모드 전환 가능) |

---

### 2-3. Text 드롭다운 `#fp-text-dropdown`

| 메뉴 | 함수 | 블록 타입 |
|------|------|-----------|
| Heading | `addTextBlock('h2')` | h2 텍스트 |
| Body | `addTextBlock('body')` | 본문 텍스트 |
| Caption | `addTextBlock('caption')` | 캡션 텍스트 |
| Bullet | `addTextBlock('bullet')` | 불릿 텍스트 |
| Label | `addTextBlock('label')` | 라벨 텍스트 |
| Tags | `addLabelGroupBlock()` | 태그 그룹 |
| Icon Text | `addIconTextBlock()` | 아이콘+텍스트 조합 |
| Bubble | `addSpeechBubbleBlock('left')` | 말풍선 |

---

### 2-4. Asset 드롭다운 `#fp-asset-dropdown`

| 메뉴 | 함수 | 비율 특성 |
|------|------|-----------|
| Standard | `addAssetBlock('standard')` | 일반 비율 |
| Square | `addAssetBlock('square')` | 정사각형 |
| Tall | `addAssetBlock('tall')` | 세로 긴 비율 |
| Wide | `addAssetBlock('wide')` | 가로 긴 비율 |
| Object | `addAssetBlock('small')` | 소형 오브젝트 |
| Logo | `addAssetBlock('logo')` | 로고용 소형 |
| Circle | `addIconCircleBlock()` | 원형 에셋 프레임 |

---

### 2-5. Shape 드롭다운 `#fp-shape-dropdown`

| 메뉴 | 함수 | 설명 |
|------|------|------|
| Rectangle | `addShapeBlock('rectangle')` | 사각형 도형 |
| Line | `addShapeBlock('line')` | 직선 |
| Arrow | `addShapeBlock('arrow')` | 화살표 |
| Ellipse | `addShapeBlock('ellipse')` | 원 |
| Polygon | `addShapeBlock('polygon')` | 다각형 |
| Star | `addShapeBlock('star')` | 별 |

> 각 도형은 독립된 100×100 Frame 안에 생성됨. Frame의 `dataset.layerName`이 도형 타입명으로 자동 설정됨.

---

### 2-6. Pen / Sticker 드롭다운 `#fp-pen-dropdown`

| 메뉴 | 함수 | 설명 |
|------|------|------|
| Annotation | `togglePenMode()` | 펜툴 어노테이션 — 클릭으로 점 추가, 더블클릭/Enter 종료, ESC 취소 |
| Sticker | `addStickerBlock()` | 플로팅 스티커 (원형 NEW 뱃지) |
| Text Sticker | `addStickerBlock({shape:'text'})` | 텍스트 스티커 — 캔버스 자유 배치 (폰트/외곽선/그림자 풀 옵션) |
| Highlight | `addStickerBlock({shape:'highlight'})` | 형광펜 — 텍스트 뒤 색 사각형 |
| HighlightB | `toggleHighlightBMode()` | 선 형광펜 — 두 점 클릭으로 직선 형광펜 (ESC 취소) |

---

### 2-7. Component 드롭다운 `#fp-component-dropdown`

| 메뉴 | 함수 | 설명 |
|------|------|------|
| Table | `addTableBlock()` | 비교표 |
| Card | `addCanvasBlock()` | 자유 배치 카드 블록 (canvas-block) |
| Graph | `addGraphBlock()` | 그래프 |
| Divider | `addDividerBlock()` | 구분선 |
| Step | `addStepBlock()` | 번호형 스텝 가이드 |
| Chat | `addChatBlock()` | 카톡식 메시지 말풍선 리스트 |
| Banner | `addBannerBlock('frame_8')` | 좌우 분할 배너 (프리셋 frame_8) |
| Laurel | `addLaurelBlock()` | 월계관 배지 |

> Component Shelf 버튼(`#fp-comp-shelf-btn`)은 현재 주석 처리되어 비활성. CompShelf 기능은 보류 상태.

---

### 2-8. Plugin 버튼 `#fp-plugin-btn`

| 항목 | 내용 |
|------|------|
| 아이콘 | 플러그인 SVG (`18×18`) |
| 동작 | `toggleFpPluginPanel()` — 플러그인 패널 토글 (Iconify · Mockup 등) |

---

### 2-9. AI 버튼 `#ai-btn`

| 항목 | 내용 |
|------|------|
| 라벨 | `✨` |
| 단축키 | `⌘K` |
| 동작 | `openAiPrompt()` → AI 섹션 자동생성 패널 열기 |
| 스타일 | `.fp-btn.fp-btn-ai` (보라 강조) |

> 토픽바의 `#ai-btn`과는 별도 — 플로팅 패널에 별도 마운트됨.

---

### 2-10. Claude PM 버튼 `#claude-pm-btn`

| 항목 | 내용 |
|------|------|
| 아이콘 | 라운드 사각 말풍선 + 우상단 스파클 (`16×16`) |
| 동작 | `window.onClickClaudePMBtn()` → Claude PM 패널 토글 |
| 역할 | Claude Code 프로젝트 매니저 연동 (Phase 1 UI, Phase 2 백엔드 작업 중) |

---

## 3. 전체 버튼 순서 (위→아래, 2026-05-21 실장 기준)

```
[브랜치 ▾]                     (.tb-hidden-mvp — MVP 숨김)
──────────────────────         (.tb-hidden-mvp)
[Section]                       primary (파란 강조)
[Frame]
──────────────────────
[Text ▾]
[Asset ▾]
[Shape ▾]
──────────────────────
[Pen / Sticker ▾]
[Component ▾]
──────────────────────
[Plugin]
──────────────────────
[AI ✨]                         보라 강조
[Claude PM]
```

---

## 4. 디자인 규칙 체크리스트

### 4-1. 버튼 공통

- [ ] 기본 버튼 클래스 → `.fp-btn` (32×32)
- [ ] 드롭다운 트리거 → `.fp-btn.fp-dropdown-trigger` (chevron SVG `9×9` 포함)
- [ ] Section 버튼 → `.fp-btn.primary` (강조 배경색)
- [ ] AI 버튼 → `.fp-btn.fp-btn-ai` (보라 강조)
- [ ] 버튼 아이콘 SVG 크기 (2026-05-21 실장 기준):
  - Section / Frame: `14~16×14~16` (Frame은 Figma viewBox 1.5 1.5 13 13 사용)
  - Text / Asset / Shape / Pen / Component 드롭다운: `14×14` viewBox(0~24 또는 0~11)
  - Plugin / Claude PM: `16~18×16~18`
  - chevron: `9×9` stroke 1.1
- [ ] 버튼 라벨 → 영문, 짧은 한 단어 (Text Sticker / Icon Text 등 두 단어 예외 허용)

> 이전 명세의 `11×11 / stroke 1.8` 규격은 현실에 맞춰 폐기. 아이콘 크기 통일이 필요하면 별도 디자인 의사결정 후 일괄 정규화할 것.

### 4-2. 드롭다운

- [ ] 드롭다운 래퍼 → `.fp-dropdown`
- [ ] 메뉴 컨테이너 → `.fp-dropdown-menu`
- [ ] 메뉴 아이템 → `.fp-menu-item`
- [ ] 열기/닫기 → `toggleFpDropdown(id)` 전용 함수 사용
- [ ] 드롭다운 열 때 chevron → `.fp-chevron` 회전 (CSS transition)

### 4-3. 구분선

- [ ] 그룹 사이 구분 → `.fp-divider`
- [ ] 그룹: 레이아웃 / 텍스트+에셋 / 컴포넌트 / 선반

### 4-4. 위치

- [ ] `position: fixed` — 스크롤에 무관하게 고정
- [ ] 캔버스 좌측 하단 오버레이 위치
- [ ] z-index 캔버스보다 위

---

## 5. 삽입 로직 규칙

- [ ] 섹션 미선택 시 버튼 클릭 → 동작 없음 or 첫 섹션에 추가
- [ ] `window._activeFrame` 있으면 → 프레임 안에 삽입
- [ ] `window._activeFrame` 없으면 → 선택된 섹션 마지막에 삽입
- [ ] 섹션 추가(`addSection`) 는 캔버스 맨 아래 추가

> **Text Frame 자동 래핑**: 모든 텍스트 블록(`.text-block`)은 투명한 `frame-block[data-text-frame="true"]` 컨테이너 안에 자동으로 래핑된다. 이 래퍼는 레이어 패널에서는 투명하게 처리되어 텍스트 블록이 직접 노출된다. 특정 프레임 안에 있지 않은 텍스트 블록도 예외 없이 동일하게 래핑된다.

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `index.html` (`#floating-panel`) | 구조 정의 |
| `css/editor-panels.css` | `.fp-btn`, `.fp-dropdown*` 스타일 |
| `js/drag-drop.js` | `addTextBlock`, `addAssetBlock`, `addSection` 등 |
| `js/block-factory.js` | `addFrameBlock`, `addCanvasBlock`, `addNewGridBlock` 등 |
| `js/branch-system.js` | `toggleBranchDropdown`, 브랜치 전환 |
| `js/editor.js` | `window._activeFrame` 관리 |
