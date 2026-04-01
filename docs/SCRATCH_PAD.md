# 스크래치패드 (Scratch Pad)

> 기능 명세 + 디자인 규칙 매뉴얼
> 담당 파일: `js/scratch-pad.js`

---

## 1. 개요

캔버스 여백에 참고 이미지를 자유롭게 배치하는 임시 작업 공간.
프로젝트 직렬화(저장 파일)에 포함되지 않으며, **IndexedDB에 별도 저장** (앱 재시작 후에도 영구 보존).

> ⚠️ 이전 버전은 localStorage를 사용했으나, 이미지 데이터 5MB 한도 초과로 조용히 저장 실패하는 문제가 있어 IndexedDB로 마이그레이션함.

---

## 2. 저장 구조

```
IndexedDB 이름:  ScratchPadDB
objectStore:    scratch
key:            scratch-pad-{projectId}-{pageId}
value:          JSON 배열 [{ src, x, y, w }, ...]
  - src: base64 DataURL (이미지)
  - x/y: canvas-scaler 로컬 좌표 (px)
  - w: 아이템 너비 (px, 기본 220)
```

- **프로젝트 + 페이지 단위**로 독립 저장
- 용량 제한 없음 (디스크 여유 공간 한도)
- 앱 재시작 / 페이지 리로드 후 자동 복원
- 탭 전환 시 `switchScratch(projectId, pageId)` 호출
- 페이지 전환 시 `switchScratchPage(newPageId)` 호출

---

## 3. 이미지 추가 방법

| 방법 | 동작 |
|------|------|
| **드래그앤드롭** | Finder에서 이미지 파일을 canvas-wrap(캔버스 바깥 여백)에 드롭 |
| **Cmd+V 붙여넣기** | 클립보드에 이미지 있을 때 붙여넣기 — 뷰포트 중앙에 삽입 |

#### Cmd+V 붙여넣기 주의사항
- `contenteditable` / `input` / `textarea` 포커스 중이면 기본 동작 유지 (텍스트 편집 충돌 방지)
- 20MB 초과 파일 무시
- 복수 이미지 붙여넣기 시 24px 오프셋으로 겹쳐 배치

#### 드래그앤드롭 주의사항
- canvas-scaler 위에서의 드롭은 무시 (기존 블록 드롭과 분리)
- `scratch-drag-over` 클래스로 드롭 가능 영역 시각 피드백

---

## 4. 아이템 조작

| 조작 | 방법 |
|------|------|
| **이동** | 아이템 drag (mousedown + mousemove) — scale 보정, rAF 최적화 |
| **리사이즈** | 우하단 핸들 drag — 최소 너비 60px |
| **삭제** | 우상단 ✕ 버튼 클릭 |

---

## 5. 아이템 DOM 구조

```html
<div class="scratch-item" style="left:Xpx; top:Ypx; width:Wpx;">
  <img src="base64..." draggable="false">
  <button class="scratch-close">✕</button>
  <div class="scratch-resize"></div>  <!-- 우하단 리사이즈 핸들 -->
</div>
```

- `.scratch-item`: `position: absolute`, canvas-scaler 내 배치
- 이동/리사이즈 시 `item.x`, `item.y`, `item.w`를 직접 갱신 후 localStorage 저장

---

## 6. 공개 API

| 함수 | 호출 시점 |
|------|---------|
| `initScratchPad(projectId, pageId)` | 프로젝트 열기 시 1회 |
| `switchScratch(newProjectId, pageId)` | 탭 전환 (프로젝트 변경) |
| `switchScratchPage(newPageId)` | 같은 프로젝트 내 페이지 전환 |
| `clearScratchPad()` | 스크래치패드 전체 초기화 |

---

## 7. CDP 스킬 연동

대량 이미지를 스크래치패드에 삽입할 때는 `/goditor-images_to_scratchpad` 스킬 사용.

```
window._scratchAddAndSave(src, x, y, w)
```
- `_createItem()` 호출 후 즉시 IndexedDB에 저장
- CDP에서 호출 시 `awaitPromise: true` 필수 (비동기 저장 대기)
- 한 장씩 처리 (한 번에 전달 시 timeout 발생)

---

## 8. 제약 / 주의

- 파일 크기 **20MB** 제한 (FileReader 전 체크)
- 스크래치패드 아이템은 **내보내기(PNG/JPG)에 포함되지 않음**
- canvas-scaler 줌/이동에 따라 함께 스크롤 (scaler 내 position:absolute)
- `clearScratchPad()` 는 async — IndexedDB 삭제 완료까지 대기 필요
