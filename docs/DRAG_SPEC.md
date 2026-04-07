# 드래그앤드롭 기능 명세 및 테스트 항목

> 이 문서는 드래그 관련 기능의 동작 명세와 QA 체크리스트를 정의한다.
> 코드 수정 후 반드시 이 문서의 테스트 항목을 CDP QA로 확인할 것.

---

## 1. 드래그 종류 및 구현 방식

| 드래그 종류 | 대상 요소 | 구현 방식 | 파일 |
|-----------|---------|---------|------|
| **freeLayout 내 이동** | text-frame (absolute) | 커스텀 mousemove | `drag-drop.js` |
| **섹션 내 블록 이동** | flow 블록 (row, text-frame 등) | HTML5 DnD | `drag-drop.js` |
| **섹션 순서 변경** | section-block 라벨 | HTML5 DnD | `drag-drop.js` |
| **프레임 순서 변경** | frame-block (selected) | HTML5 DnD | `drag-drop.js` |
| **freeLayout → 섹션 추출** | text-frame (absolute→flow) | 커스텀 mousemove + drag-out 감지 | `drag-drop.js` |
| **다중선택 동시 이동** | freeLayout 내 선택된 여러 블록 | 커스텀 mousemove (peers) | `drag-drop.js` |

---

## 2. 핵심 규칙

### absolute 요소 — HTML5 drag 완전 비활성화
- `frame-block[data-text-frame]`(text-frame), `shape-block` 등 `position:absolute` 요소는 `draggable` 속성 제거
- `draggable="true"` 잔류 시 HTML5 `dragstart` 발동 → `.dragging` 클래스 → `opacity:0.25` + `pointer-events:none` (벽돌 현상)
- `bindBlock` 호출 시 `needsHtml5Drag = dragTarget.style.position !== 'absolute' && block.style.position !== 'absolute'`로 판단
- freeLayout 드롭 후 반드시 `removeAttribute('draggable')` + `_dragBound = false` 리셋

### drag-out 감지 (freeLayout → 섹션)
- **cursor 화면 좌표 대신 요소 중심의 캔버스 좌표**로 판단 (scale 소수점 오탐 방지)
- `elCX = rawLeft + dragEl.offsetWidth/2`, `elCY = rawTop + dragEl.offsetHeight/2`
- `DRAGOUT_MARGIN = 60px (캔버스 단위)` — 의도치 않은 drag-out 방지
- 삽입 위치는 `_dropInsertBefore` closure 변수에 저장 (indicator DOM에 의존 금지)

### 다중선택 드래그
- `mousedown` 시점에 `multiPeers` 수집 (`.selected` 형제 absolute 요소)
- 다중선택 시 스마트 가이드 스냅 비활성화
- 각 peer는 `startLeft/startTop` 기준으로 동일 dx/dy 적용

### 스마트 가이드
- `showGuides()` 는 반드시 `dragEl.style.left/top` 업데이트 **후** 호출
- `SNAP_THRESHOLD = 10px`, `GUIDE_THRESHOLD = 12px`

---

## 3. 기능 테스트 항목 (CDP QA 스크립트: `/tmp/qa_drag_spec.js`)

아래 항목은 코드 수정 후 반드시 확인한다.

### [ ] T1. freeLayout 블록 정상 이동
- 프레임 블록 생성 → 텍스트 블록 추가 → 드래그 5회
- **확인**: 매 드래그 후 text-frame이 freeLayout frame 안에 있는가?
- **확인**: `.dragging` 클래스가 붙지 않는가?
- **확인**: `opacity:1`이 유지되는가?

### [ ] T2. freeLayout 블록 draggable 없음
- freeLayout에 텍스트 블록 추가 직후
- **확인**: `text-frame.getAttribute('draggable')` = null인가?
- **확인**: `text-frame.style.position` = 'absolute'인가?

### [ ] T3. 드래그 중 .dragging 클래스 없음
- 선택된 text-block에 mousedown → mousemove → (mouseup 전)
- **확인**: text-frame에 `.dragging` 클래스 없는가?
- **확인**: text-frame의 computed `opacity` = 1인가?

### [ ] T4. 다중선택 동시 이동
- shift+click으로 2개 블록 선택 → 드래그
- **확인**: 두 블록이 같은 dx/dy만큼 동시 이동하는가?
- **확인**: 미선택 블록은 이동하지 않는가?

### [ ] T5. Cmd+D 복제
- freeLayout 내 블록 선택 → Cmd+D
- **확인**: 복제 블록이 freeLayout 안에 생성되는가?
- **확인**: 복제 블록 위치 = 원본 + 20px offset인가?
- **확인**: 복제 블록 드래그 가능한가?

### [ ] T6. 위로 drag-out
- freeLayout 내 블록을 프레임 위쪽으로 드래그
- **확인**: 섹션 inner에 드롭 인디케이터 표시되는가?
- **확인**: mouseup 후 text-frame이 freeLayout frame **앞**에 있는가?
- **확인**: text-frame `position` 초기화 됐는가?

### [ ] T7. 아래로 drag-out
- freeLayout 내 블록을 프레임 아래쪽으로 드래그
- **확인**: mouseup 후 text-frame이 freeLayout frame **뒤**에 있는가?

### [ ] T8. 섹션→freeLayout 드롭 후 draggable 없음
- 섹션에 텍스트 블록 추가 → freeLayout 프레임에 드롭
- **확인**: 드롭 후 text-frame `draggable` 속성 없는가?
- **확인**: 드롭 후 정상 드래그 가능한가?

### [ ] T9. 스마트 가이드 스냅
- 두 블록 인접 배치 → 하나를 다른 것과 정렬 근처로 드래그
- **확인**: 10px 이내 접근 시 자석 스냅 발동하는가?
- **확인**: 가이드선이 표시되는가?

---

## 4. CDP 일괄 테스트 실행

```bash
node /tmp/qa_drag_spec.js
```

> 스크립트: `/tmp/qa_drag_spec.js` — T1~T9 항목 자동 검증

---

## 5. 알려진 이슈 및 대응

| 현상 | 원인 | 대응 |
|------|------|------|
| 텍스트 블록 드래그 후 연회색+이동불가 | 구버전 데이터의 `draggable="true"` 잔류 | 새 프로젝트에서는 재현 안 됨. 구버전 파일 열면 rebindAll에서 `removeAttribute` 처리 |
| drag-out이 의도치 않게 발동 | scale 소수점으로 인한 cursor 좌표 오탐 | 캔버스 좌표 기반 + 60px 마진으로 수정 |
| 섹션→freeLayout 드롭 후 다음 드래그 회색 | freeLayout 드롭 핸들러에서 draggable 미제거 | `removeAttribute('draggable')` + `_dragBound=false` 추가 |
