# 상페마법사 웹에디터 — 기능 레지스트리 & 테스트 기준서

> **모든 스쿼드의 단일 소스 오브 트루스.**  
> "이 동작을 하면 → 이 결과가 나와야 한다" 수준의 구체적 기준.  
> feature 브랜치 → dev 머지 전 전체 체크 필수.

---

## ⚠️ 유지보수 프로토콜 (필독)

이 파일은 **기능이 추가/변경/삭제될 때마다 반드시 업데이트**해야 한다.  
오래된 기준서는 없는 것보다 나쁘다 — 잘못된 체크를 통과시킨다.

### 업데이트 시점
| 상황 | 해야 할 것 |
|------|-----------|
| 새 기능 추가 | 해당 섹션에 테스트 케이스 추가 |
| 기존 기능 수정 (범위값/동작 변경) | 해당 항목 수정 |
| 기능 제거 | `~~취소선~~` 처리 + 날짜 기록 |
| 버그 수정 후 | 해당 케이스에 `주의:` 항목 추가 |
| 새 prop 파일 추가 | 우측 패널 섹션에 새 항목 추가 |
| dataset 속성 추가/변경 | §22 dataset 레지스트리 업데이트 |

### 업데이트 방법
```
1. 해당 섹션 찾기
2. 테스트 케이스 추가/수정
3. 파일 맨 아래 "_최종 업데이트" 날짜 갱신
4. 변경된 기능이 의존 관계 맵(§23)에 영향을 주면 함께 수정
```

---

## 읽는 법

```
[ ] 기능명
    조건: 테스트 전제 (없으면 생략)
    동작: 사용자가 하는 행동
    기대: 반드시 나타나야 할 결과
    주의: 이 기능과 연동된 다른 기능 / 엣지케이스
```

---

## 1. 줌 / 뷰 제어

### 줌 범위 클램프
```
[ ] 줌 최솟값 25% 제한
    동작: zoomStep(-200) 으로 과도하게 줄임
    기대: currentZoom === 25, zoomDisplay 텍스트 = "25%"

[ ] 줌 최댓값 150% 제한
    동작: zoomStep(200) 으로 과도하게 키움
    기대: currentZoom === 150, zoomDisplay 텍스트 = "150%"

[ ] 줌 +10% 버튼
    조건: currentZoom = 100
    동작: zoomStep(10) 호출
    기대: currentZoom === 110, zoomDisplay = "110%"

[ ] Fit to View
    동작: zoomFit() 호출
    기대: currentZoom = floor((canvasWrap.clientWidth - 80) / 860 * 100)
    주의: 창 크기 바뀌면 결과가 달라짐
```

### 팬 모드 (Space + 드래그)
```
[ ] Space 키 다운 → 팬 모드 진입
    조건: 포커스가 contentEditable 요소가 아님
    동작: Space keydown
    기대: canvasWrap에 'pan-mode' 클래스 추가

[ ] Space 키 업 → 팬 모드 종료
    동작: Space keyup
    기대: 'pan-mode' 클래스 제거, panning = false

[ ] 팬 드래그 중 노치 위치 동기화
    동작: 팬 드래그 이동
    기대: notch X 위치 = max(4, min(76, 40 - panOffsetX/10))
    기대: |panOffsetX| < 5 && |panOffsetY| < 5 → notch에 'centered' 클래스
```

---

## 2. 실행 취소 / 다시 실행

### 히스토리 스택
```
[ ] 첫 히스토리 진입
    조건: clearHistory() 호출 직후
    기대: historyStack.length === 1, historyPos === 0
    기대: 첫 항목 action = '초기 상태'

[ ] pushHistory 일반 동작
    동작: pushHistory('블록 추가') 호출
    기대: historyStack 마지막 항목에 { action:'블록 추가', pageId, canvas, settings } 추가
    기대: historyPos 1 증가

[ ] pushHistory 미래 기록 제거
    조건: historyPos = 3, historyStack.length = 5 (언도 2번 후 상태)
    동작: pushHistory('새 작업') 호출
    기대: historyStack.length === 4 (3 이후 잘림 + 새 항목)
    기대: historyPos === 4 → 3+1

[ ] 히스토리 50개 초과 시 앞에서 제거
    조건: historyStack.length === 50
    동작: pushHistory() 호출
    기대: historyStack.length === 50 (shift 후 push)
    기대: 첫 번째 항목이 바뀜

[ ] _historyPaused = true 일 때 pushHistory 무시
    조건: _historyPaused = true
    동작: pushHistory('무시되어야 할 작업') 호출
    기대: historyStack 변화 없음

[ ] Cmd+Z (언도)
    조건: historyPos > 0
    동작: Cmd+Z
    기대: historyPos 1 감소, 이전 canvas/settings 복원
    기대: rebindAll(), deselectAll(), buildLayerPanel() 호출

[ ] 더 이상 언도 불가
    조건: historyPos === 0
    동작: Cmd+Z
    기대: 아무 변화 없음

[ ] Cmd+Shift+Z (리도)
    조건: historyPos < historyStack.length - 1
    동작: Cmd+Shift+Z
    기대: historyPos 1 증가, canvas 복원

[ ] 다른 페이지 스냅샷 복원
    조건: 스냅샷의 pageId ≠ state.currentPageId
    기대: flushCurrentPage() 먼저 실행, state.currentPageId 변경 후 복원
```

---

## 3. 선택 시스템

### 섹션 선택
```
[ ] 단일 클릭 선택
    동작: 섹션 클릭
    기대: 클릭한 섹션에 'selected' 클래스 추가
    기대: 기존 선택 섹션에서 'selected' 클래스 제거 (deselectAll)
    기대: 우측 패널에 섹션 프로퍼티 표시

[ ] Cmd+클릭 다중 선택 추가
    조건: 섹션A 선택됨
    동작: Cmd + 섹션B 클릭
    기대: A, B 모두 'selected' + 'multi-selected' 클래스
    기대: 우측 패널에 "N개 선택됨" 표시

[ ] Cmd+클릭 선택 해제
    조건: 섹션A, B 다중 선택됨
    동작: Cmd + 섹션A 클릭
    기대: 섹션A에서 'selected', 'multi-selected' 제거
    기대: 섹션B만 남음 → 단일 선택으로 전환

[ ] Shift+클릭 범위 선택
    조건: 섹션1 선택됨, 섹션5 존재
    동작: Shift + 섹션5 클릭
    기대: 섹션1~5 모두 'multi-selected' 클래스 추가

[ ] 다중 선택 Delete
    조건: 섹션A, B, C 다중 선택 (multiSel.sections.size > 1)
    동작: Delete 키
    기대: A, B, C 모두 DOM에서 제거
    기대: pushHistory() 호출
```

### 블록 선택
```
[ ] 텍스트 블록 클릭
    동작: 텍스트 블록 클릭
    기대: 블록에 'selected' 추가
    기대: 우측 패널에 텍스트 프로퍼티 패널 표시

[ ] 텍스트 블록 더블클릭 → 편집 모드
    동작: 텍스트 블록 더블클릭
    기대: 'editing' 클래스 추가
    기대: contenteditable = "true" 설정
    기대: 클릭 위치에 커서 위치

[ ] 편집 모드 중 blur → 편집 종료
    조건: 편집 모드 진입
    동작: 블록 외부 클릭
    기대: 'editing' 클래스 제거
    기대: contenteditable = "false"

[ ] 편집 모드 중 Escape → 편집 종료
    조건: 편집 모드 진입
    동작: Escape 키
    기대: blur 호출, 'editing' 클래스 제거

[ ] 이미지 블록 더블클릭 — 이미지 있음
    조건: asset-block에 img 태그와 src 있음
    동작: 더블클릭
    기대: enterImageEditMode() 호출 (핸들 표시)

[ ] 이미지 블록 더블클릭 — 이미지 없음
    조건: asset-block에 이미지 없음
    동작: 더블클릭
    기대: 파일 업로드 다이얼로그 열림 (triggerAssetUpload)
```

---

## 4. 복사 / 붙여넣기

```
[ ] 섹션 복사
    조건: 섹션 선택됨
    동작: Cmd+C
    기대: clipboard = { type: 'section', html: 섹션 outerHTML }

[ ] 섹션 붙여넣기
    조건: clipboard.type = 'section'
    동작: Cmd+V
    기대: 새 섹션이 canvasEl 끝에 추가
    기대: 섹션 ID 재생성 (genIdFn('sec') 호출)
    기대: 내부 모든 [id] 요소도 ID 재생성
    기대: 모든 바인딩 재적용

[ ] 블록 붙여넣기
    조건: clipboard.type = 'block', 섹션 선택됨
    동작: Cmd+V
    기대: 선택된 섹션의 마지막 위치에 블록 삽입
    기대: pushHistory() 호출
```

---

## 5. 드래그 앤 드롭

### 블록 드래그
```
[ ] 같은 섹션 내 블록 순서 변경
    동작: 블록A를 블록B 아래로 드래그
    기대: 드래그 중 파란 drop-indicator 선 표시
    기대: 드롭 후 블록A가 블록B 아래 위치
    기대: dragSrc = null, indicator 제거

[ ] 다른 섹션으로 블록 이동
    동작: 섹션1의 블록을 섹션2로 드래그
    기대: 드롭 후 블록이 섹션2에 위치
    기대: 섹션1에서 블록 제거

[ ] 드래그 중 autoSave 억제
    동작: 드래그 시작
    기대: state._suppressAutoSave = true
    동작: 드래그 종료
    기대: state._suppressAutoSave = false

[ ] 이미지 파일 드래그드롭 (이미지 블록 위)
    조건: asset-block 존재
    동작: 이미지 파일을 asset-block 위에 드롭
    기대: 이미지가 로드되어 asset-block에 표시
    기대: 비이미지 파일은 무시됨 (image/* 타입 체크)
```

### 섹션 드래그
```
[ ] 섹션 순서 변경
    조건: 섹션이 2개 이상
    동작: 섹션 라벨(.section-label) 드래그
    기대: 드래그 중 'section-dragging' 클래스 추가
    기대: 드롭 후 섹션 순서 변경됨
    기대: sectionDragSrc = null, indicator 제거

[ ] 섹션 본문에서 드래그 불가
    동작: 섹션 내부 블록 영역 드래그
    기대: 섹션이 이동하지 않음 (라벨에서만 드래그 가능)
```

### 레이어 패널 드래그
```
[ ] 레이어 항목 드래그로 순서 변경
    동작: 레이어 패널 항목 드래그
    기대: 캔버스에서도 실제 순서 변경됨
    기대: buildLayerPanel() 재호출로 패널 갱신

[ ] 다중 선택 항목 드래그
    조건: 레이어 항목 여러 개 선택
    동작: 그룹 드래그
    기대: 선택된 모든 항목이 함께 이동
```

### 열/컬럼 드롭
```
[ ] 블록을 다른 컬럼으로 이동
    동작: 블록을 다른 col로 드래그
    기대: 블록이 대상 col에 이동
    기대: 소스 col이 비면 row 자동 제거
    주의: 같은 col 내부로 드롭은 무시됨
```

---

## 6. 저장 / 불러오기 (save-load.js)

### localStorage 키 구조 (반드시 확인)
```
SAVE_KEY_PREFIX  = 'web-editor-autosave'
→ 프로젝트별 키: 'web-editor-autosave__{activeProjectId}'
→ 타임스탬프 키: 'web-editor-autosave__{activeProjectId}_ts'

PROJECTS_KEY = 'sangpe-projects'
→ 브라우저 환경에서 프로젝트 목록 전체 저장

TAB_STATE_KEY = 'web-editor-open-tabs'
→ { tabs: [{ id, name }], activeId } — _cache 제외하고 저장
```

### 자동 저장 (scheduleAutoSave)
```
[ ] 캔버스 DOM 변경 → 자동 저장 트리거
    동작: 블록 추가/삭제/텍스트 수정 등 canvasEl 변경
    기대: MutationObserver(childList+subtree+characterData) 감지
    기대: scheduleAutoSave() 호출 → 1500ms debounce 시작
    기대: 탑바 인디케이터 '저장 중...' 표시
    기대: 1500ms 후 localStorage 저장 + 파일 저장 (skipThumbnail:true)
    기대: 인디케이터 '저장됨' → 2500ms 후 사라짐
    주의: attributes 변경은 감지 안 함 (드래그 클래스 토글 폭주 방지)

[ ] _suppressAutoSave = true 일 때 저장 완전 억제
    조건: state._suppressAutoSave = true
    동작: scheduleAutoSave() 호출
    기대: clearTimeout 없이 즉시 return — 타이머 시작 안 함

[ ] 탭 전환 중 억제 → 복원
    동작: switchTab() 실행
    기대: canvasEl.innerHTML = '' 직전 state._suppressAutoSave = true
    기대: 로드 완료 후 state._suppressAutoSave = false

[ ] 페이지 전환 중 억제 → 복원
    동작: switchPage() 실행
    기대: state._suppressAutoSave = true 설정 후 canvas 교체
    기대: 교체 완료 후 state._suppressAutoSave = false
    기대: scheduleAutoSave() 호출 (페이지 전환도 저장 트리거)

[ ] beforeunload — debounce 중 즉시 flush
    조건: autoSaveTimer가 남아있는 상태에서 창 닫기/새로고침
    기대: clearTimeout(autoSaveTimer)
    기대: serializeProject() → localStorage 즉시 저장
    기대: timestamp 충돌 방지: Math.max(existingTs, Date.now()) 저장
    주의: Cmd+R 핸들러(main.js)가 미리 lsTs+5000을 설정할 수 있어
          existingTs가 더 크면 그 값 유지 (레이스 컨디션 방지)
```

### 파일 저장 대기열 패턴 (saveProjectToFile)
```
[ ] 동시 저장 방지 — 대기열
    조건: _isSavingToFile = true (저장 진행 중)
    동작: saveProjectToFile() 재호출
    기대: _pendingSaveData = { snapshot, opts } 에 최신값 저장 후 return
    기대: 진행 중 저장 완료 후 _pendingSaveData 자동 소비 (재귀 호출)
    기대: _pendingSaveData는 마지막 요청만 유지 (중간 요청 버려짐)

[ ] opts.projectId — 탭 전환 race condition 방지
    조건: 탭A에서 탭B로 전환 직전 저장
    기대: opts.projectId = 탭A의 id (activeProjectId 변경 전 캡처)
    기대: 저장 대상이 탭B가 아닌 탭A 파일로 정확히 지정됨

[ ] 손상된 snapshot 안전 처리
    조건: JSON.parse 불가능한 snapshot 전달
    기대: console.warn 후 return (저장 취소)
    기대: 앱 크래시 없음

[ ] Electron 파일 저장 구조
    기대: electronAPI.loadProject(targetId) → 기존 데이터 로드
    기대: 기존 데이터에 새 snapshot 병합 (name 등 메타 유지)
    기대: proj.updatedAt = new Date().toISOString()
    기대: thumbnail 있으면 proj.thumbnail 업데이트

[ ] 브라우저 localStorage 저장 구조
    기대: PROJECTS_KEY 배열에서 id 매칭 → proj.snapshot 업데이트
    기대: proj.updatedAt 갱신
    기대: QuotaExceededError → showToast('⚠️ 저장 공간 부족') + 앱 계속 동작

[ ] 자동저장은 썸네일 생략
    기대: scheduleAutoSave → saveProjectToFile(snap, { skipThumbnail: true })
    기대: opts.skipThumbnail = true → captureThumbnail() 호출 안 함
    기대: 홈으로 이동(goHome) 시에만 썸네일 캡처 실행
```

### 썸네일 생성 (captureThumbnail)
```
[ ] 썸네일 캡처 조건
    기대: canvasEl의 첫 번째 .section-block 대상
    기대: .section-label, .section-toolbar 제거한 clone 사용
    기대: 'selected' 클래스 제거
    기대: fixed 위치로 DOM에 임시 추가 후 캡처 → 제거

[ ] 썸네일 크기/품질
    기대: html2canvas scale=1, useCORS=true
    기대: 배경색 = firstSec.style.background (없으면 '#ffffff')
    기대: 200px 너비로 축소, 비율 유지 높이
    기대: JPEG 0.7 품질로 toDataURL

[ ] 섹션 없을 때 안전 처리
    조건: canvasEl에 .section-block 없음
    기대: null 반환, 저장 계속 진행
```

### 직렬화 (serializeProject / getSerializedCanvas)
```
[ ] getSerializedCanvas — 상태 요소 제거 검증
    동작: 편집 중 상태에서 직렬화
    기대: .block-resize-handle 제거됨
    기대: .img-corner-handle 제거됨
    기대: .img-edit-hint 제거됨
    기대: [contenteditable] 속성 제거됨
    기대: .editing 클래스 제거됨
    기대: 원본 DOM 변경 없이 clone에서만 처리됨

[ ] getSerializedCanvas — section data-name 동기화
    조건: sec._name 이 있는 섹션
    기대: sec.dataset.name = sec._name 먼저 동기화 후 직렬화

[ ] serializeProject 출력 포맷
    기대: flushCurrentPage() 먼저 호출 (현재 페이지 canvas 저장)
    기대: JSON.stringify({ version: 2, currentPageId, pages }) 반환
    기대: pages 각 항목: { id, name, label, pageSettings, canvas }
    기대: pageSettings: { bg, gap, padX, padY }
```

### 복원 (applyProjectData)
```
[ ] v2 포맷 정상 복원
    동작: { version: 2, pages: [...], currentPageId: 'page_1' } 적용
    기대: state.pages = data.pages
    기대: state.currentPageId = data.currentPageId
    기대: 현재 페이지의 pageSettings → state.pageSettings 병합
    기대: canvasEl.innerHTML = page.canvas
    기대: .text-block-label, .asset-block-label 제거
    기대: rebindAll(), applyPageSettings(), deselectAll() 호출
    기대: buildLayerPanel(), showPageProperties() 호출

[ ] v2 — pages 빈 배열 방어
    조건: data.pages = []
    기대: pages = [{ id:'page_1', name:'Page 1', ... canvas:'' }] 자동 생성
    기대: 앱 크래시 없음

[ ] v1 하위 호환
    조건: { canvas: '<html>', pageSettings: {...} } v1 포맷
    기대: pages = [{ id:'page_1', canvas, pageSettings }] 로 변환
    기대: state.currentPageId = 'page_1'

[ ] currentPageId 없는 경우
    조건: data.currentPageId = undefined
    기대: data.pages[0].id 로 대체
```

### applyPageSettings (CSS 변수 적용)
```
[ ] CSS 변수 전체 적용
    기대: canvasWrap.style.background = state.pageSettings.bg
    기대: canvasEl.style.gap = state.pageSettings.gap + 'px'
    기대: canvasEl CSS --page-padx = padX + 'px'
    기대: canvasEl CSS --page-pady = padY + 'px'

[ ] asset-block usePadx 재계산
    조건: data-use-padx="true" 인 asset-block 존재
    기대: applyAssetPadX(ab, state.pageSettings.padX) 재호출
    기대: padX 변경 시 해당 블록 너비/높이 자동 재계산
```

### rebindAll — 재바인딩 체크리스트
```
[ ] asset-overlay contenteditable 오염 제거
    기대: .asset-overlay의 contenteditable 속성 제거
    기대: .asset-overlay 내 직접 text 노드 제거

[ ] 섹션 ID 없는 경우 자동 부여
    조건: sec.id = '' 인 섹션
    기대: sec.id = 'sec_' + random(7자리) 자동 생성

[ ] 섹션 배경 이미지 복원
    조건: sec.dataset.bgImg 있음, sec.style.backgroundImage 없음
    기대: backgroundImage/Size/Position/Repeat 복원

[ ] 섹션 이벤트 중복 바인딩 방지
    기대: sec._secClickBound = true 확인 후 바인딩
    기대: 이미 true면 click 리스너 추가 안 함

[ ] 섹션 툴바 구버전 버튼 정리
    기대: ↑ ↓ ✕ 버튼(st-btn 중 st-branch-btn/st-ab-btn 아닌 것) 제거
    기대: ⎇ 버튼 없으면 추가, 있으면 onclick 재바인딩

[ ] row ID 없는 경우 자동 부여
    기대: row.id = 'row_' + random(7자리)

[ ] text-block contenteditable 복원
    조건: .tb-h1/.tb-h2 등 내부 요소에 contenteditable 없음
    기대: contenteditable="false" 자동 추가 (편집 가능 상태 유지)

[ ] 블록 타입별 ID 자동 부여 prefix
    기대: text-block → tb_, asset-block → ab_, gap-block → gb_
    기대: icon-circle-block → icb_, label-group-block → lg_
    기대: card-block → cdb_, strip-banner-block → sbb_
    기대: graph-block → grb_, icon-text-block → itb_, divider-block → dvd_

[ ] group-block 라벨 복원
    기대: .group-block-label span 없으면 prepend
    기대: 텍스트 = g.dataset.name || 'Group'
    기대: bindGroupDrag(g) 재호출

[ ] col-placeholder 이벤트 재연결
    기대: 기존 .col-placeholder를 makeColPlaceholder() 새것으로 교체

[ ] strip-banner-block 구버전 마이그레이션
    조건: .sbb-gap-top 없는 strip-banner
    기대: .sbb-gap-top (height:20px) prepend
    기대: .sbb-gap-bottom (height:20px) append
```

### 앱 초기 로드 우선순위 (Electron)
```
[ ] Electron — localStorage vs 파일 우선순위
    조건: lsTs(localStorage timestamp) >= fileTs(파일 updatedAt)
    기대: localStorage 데이터 우선 적용 (새로고침 데이터 보존)
    조건: lsTs < fileTs
    기대: 파일 데이터 적용 (더 최신 파일 우선)

[ ] Electron — 파일 v2 포맷
    기대: proj.version === 2 && proj.pages → applyProjectData(proj)

[ ] Electron — 파일 v1 snapshot
    기대: proj.snapshot 있음 → JSON.parse 후 applyProjectData

[ ] 브라우저 — localStorage에서 직접 로드
    기대: PROJECTS_KEY 목록에서 id 매칭 → proj.snapshot → applyProjectData

[ ] 프로젝트 ID 없음 (직접 index.html 진입)
    기대: openTabs = [], renderTabBar(), initEmpty() 호출
    기대: 단일 빈 페이지로 초기화
```

### 탭 관리 세부
```
[ ] 탭 최대 5개 제한
    조건: openTabs.length === 5
    동작: 6번째 프로젝트 열기 시도
    기대: showToast('탭은 최대 5개까지 열 수 있어요')
    기대: 탭 추가 안 됨

[ ] 탭 전환 전체 시퀀스 (switchTab)
    동작: 탭A → 탭B 전환
    기대 순서:
      1. curTab._cache = serializeProject() (현재 탭 메모리 캐시)
      2. saveProjectToFile(cache, { skipThumbnail:true, projectId:tabA.id }) 비동기 호출
      3. activeProjectId = tabB.id
      4. URL 업데이트 (history.replaceState)
      5. 이미지 편집 리스너 정리 (.pos-dragging 요소들)
      6. state._suppressAutoSave = true
      7. canvasEl.innerHTML = ''
      8. propPanel.innerHTML = ''
      9. buildLayerPanel() 호출
      10. renderTabBar(), saveTabState()
      11. tabB._cache 있음 → applyProjectData(cache) 즉시, 파일 I/O 없음
      11. tabB._cache 없음 → 파일/localStorage에서 로드
      12. state._suppressAutoSave = false
      13. initBranchStore()

[ ] 탭 전환 — 같은 탭 클릭
    동작: 현재 활성 탭 클릭
    기대: 즉시 return, 아무 변화 없음 (id === activeProjectId 분기)

[ ] 탭 닫기 — 마지막 탭
    조건: openTabs.length === 1
    동작: × 버튼 클릭
    기대: openTabs = [], saveTabState(), goHome() 호출

[ ] 탭 닫기 — 현재 활성 탭
    조건: 탭이 2개 이상, 현재 탭 닫기
    기대: 인접 탭(다음 또는 이전)으로 switchTab 후 제거

[ ] 탭 드래그 — 6px 미만 이동
    동작: 탭을 5px 이동 후 마우스업
    기대: 드래그 시작 안 됨, 클릭 이벤트로 처리

[ ] 탭 드래그 — 6px 이상
    동작: 탭을 6px 이상 드래그
    기대: ghost 요소 생성 (tab-ghost 클래스)
    기대: 삽입 위치 미리보기 (tab-drop-before/after 클래스)
    동작: 마우스업
    기대: openTabs.splice(fromIdx, 1) → splice(toIdx, 0, moved)
    기대: saveTabState(), renderTabBar() 호출

[ ] 탭 이름 더블클릭 변경
    조건: 현재 활성 탭의 이름 영역 더블클릭
    기대: .proj-tab-name contentEditable='true', focus, selectAll
    동작: 새 이름 입력 후 Enter
    기대: setProjectName(newName) 호출 → 탭 + 파일 동시 업데이트
    동작: 빈 문자열 입력 후 blur
    기대: 이전 이름으로 복원 (current 값 유지)
    동작: Escape
    기대: 원본 이름으로 복원, blur

[ ] 탭 상태 localStorage 저장 구조
    기대: { tabs: [{ id, name }], activeId } — _cache 제외
    기대: 앱 재시작 후 TAB_STATE_KEY 읽어 openTabs 복원
```

### v2 저장 포맷 / 재오픈 검증
```
[ ] 저장 → 재오픈 전체 복원
    동작: 편집 후 goHome → 재진입
    기대: version:2 포맷 유지
    기대: 멀티페이지 모두 복원 (페이지 수, 이름, 라벨)
    기대: 각 페이지 pageSettings (bg, gap, padX, padY) 복원
    기대: 각 페이지 canvas (블록 구조, dataset 속성) 복원
    기대: 현재 페이지(currentPageId) 그대로 진입

[ ] Cmd+R 새로고침 후 복원
    동작: 편집 중 Cmd+R
    기대: main.js Cmd+R 핸들러가 lsTs 미리 갱신
    기대: localStorage가 파일보다 최신으로 판정 → localStorage 우선 복원
    기대: 새로고침 직전 상태 100% 복원
```

---

## 7. 멀티페이지

```
[ ] 페이지 추가
    동작: + 버튼 클릭 (window.addPage())
    기대: state.pages 배열에 새 페이지 추가
    기대: id = 'page_' + Date.now()
    기대: pageSettings는 현재 페이지 설정 복사
    기대: switchPage() 호출되어 새 페이지로 전환

[ ] 페이지 전환 (switchPage)
    동작: 다른 페이지 클릭
    기대: flushCurrentPage() 먼저 호출 (현재 canvas 저장)
    기대: state._suppressAutoSave = true 동안 전환
    기대: canvasEl.innerHTML = 대상 페이지 canvas
    기대: .text-block-label, .asset-block-label 제거
    기대: rebindAll(), applyPageSettings(), buildLayerPanel() 호출
    기대: clearHistory() 호출 (히스토리 초기화)

[ ] 페이지 삭제
    조건: 페이지가 2개 이상
    동작: 현재 페이지 삭제
    기대: 이전 또는 다음 페이지로 자동 전환
    기대: 1개만 남으면 삭제 불가

[ ] 페이지 드래그 순서 변경
    동작: 페이지 항목 드래그
    기대: state.pages 배열 순서 변경
    기대: UI 목록 순서도 변경됨

[ ] 페이지 라벨 표시
    기대: Hook/Main/Detail/CTA/Event 라벨이 페이지 목록에 배지로 표시
    기대: 각 라벨마다 고유 색상 적용
```

---

## 8. 좌측 패널 — File 탭

### Pages 섹션
```
[ ] 활성 페이지 하이라이트
    동작: 페이지 전환
    기대: 활성 페이지 항목만 강조 스타일 적용

[ ] 섹션 펼침/접힘 토글
    동작: 섹션 헤더 클릭
    기대: 해당 섹션 body 표시/숨김 토글
```

### Layers 섹션
```
[ ] 레이어 트리 구조 반영
    동작: 블록 추가/삭제/이동
    기대: buildLayerPanel() 호출 시 DOM 구조와 트리가 일치
    기대: 섹션 > Row > Col > 블록 계층으로 표시

[ ] 블록 타입별 아이콘 표시
    기대: Text, Asset, Gap, Card, Banner, Graph, LabelGroup, Table, Divider, IconCircle 각각 고유 아이콘

[ ] 레이어 항목 클릭 → 블록 선택
    동작: 레이어 항목 클릭
    기대: 캔버스에서 해당 블록에 'selected' 클래스
    기대: 우측 프로퍼티 패널 열림

[ ] 레이어 항목 더블클릭 → 이름 인라인 편집
    동작: 더블클릭
    기대: 인라인 input 활성화
    동작: Enter 또는 blur
    기대: 블록 dataset.name 업데이트

[ ] 전체 펼침/접기 버튼
    동작: #layer-collapse-all 버튼 클릭
    기대: 모든 그룹 항목 일괄 collapse/expand 토글
```

---

## 9. 좌측 패널 — Branch 탭

```
[ ] 브랜치 목록 색상 구분
    기대: main → 초록색(#27ae60), dev → 주황색(#e07b2a), feature/* → 파란색(#2d6fe8)

[ ] 새 브랜치 생성
    동작: 브랜치명 입력 후 생성
    기대: store.branches에 새 항목 추가 (현재 상태 스냅샷 포함)
    기대: 중복 이름 → alert + 취소

[ ] 브랜치 전환
    동작: 다른 브랜치 클릭
    기대: 현재 브랜치 스냅샷 저장 (store.branches[current].snapshot 업데이트)
    기대: store.current = 새 브랜치명
    기대: 대상 브랜치 상태 로드 (applyProjectData)
    기대: clearHistory() 호출
    기대: 브랜치 인디케이터 업데이트

[ ] feature 브랜치 포커스 모드
    조건: feature/* 브랜치로 전환
    기대: applyFocusMode() 호출
    기대: 지정되지 않은 섹션은 숨김 처리

[ ] 브랜치 스토어 영속화
    기대: localStorage key = 'web-editor-branches-{activeProjectId}'
    기대: Electron 환경이면 프로젝트 파일에도 branches 저장
```

---

## 10. 좌측 패널 — Inspector 탭

### Design System 패널
```
[ ] 패널 펼침/접힘
    동작: #ds-panel-header 클릭
    기대: #ds-panel-body 표시/숨김 토글
    기대: chevron 방향 전환

[ ] 프리셋 적용 (Apply 버튼)
    동작: 프리셋 선택 후 Apply 클릭
    기대: 섹션에 기존 프리셋 CSS 변수 모두 제거
    기대: 새 프리셋 변수 적용
    기대: pushHistory() 호출

[ ] Color 섹션 색상 변경
    동작: Primary 색상 변경
    기대: 캔버스 전체에 --preset-primary CSS 변수 적용
```

### 통계 패널
```
[ ] 섹션/블록 카운트 정확성
    동작: 섹션 2개, 텍스트 3개, 이미지 1개 상태에서 Inspector 열기
    기대: 섹션 수 = 2, 텍스트 블록 = 3, 이미지 블록 = 1 표시

[ ] 컬러 팔레트 추출
    기대: 캔버스에 사용된 고유 색상만 HEX로 변환하여 스와치 표시
    기대: 중복 색상 제거됨
    기대: RGB → HEX 변환 정확 (#RRGGBB 형태)
```

---

## 11. 우측 패널 — 빈 캔버스 (prop-page.js)

```
[ ] 배경색 변경 즉시 반영
    동작: 컬러 피커 또는 HEX 입력 변경
    기대: canvasWrap 배경색 즉시 변경 (실시간)
    기대: state.pageSettings.bg 업데이트
    기대: scheduleAutoSave() 호출

[ ] HEX 유효성 검증
    동작: '#gg0000' 등 잘못된 HEX 입력
    기대: 변경 없음 (/^#[0-9a-f]{6}$/i 불통과)
    기대: 유효한 HEX만 적용

[ ] 일괄 정렬 — 좌/중/우
    동작: 정렬 버튼 클릭
    기대: 모든 섹션의 alignSelf 변경
    기대: left → flex-start, center → center, right → flex-end

[ ] 섹션 간격 변경
    범위: 0 ~ 200px, step 4
    동작: 슬라이더 또는 숫자 입력
    기대: canvasEl.style.gap 즉시 변경
    기대: state.pageSettings.gap 업데이트

[ ] 좌우/상하 패딩 변경
    범위: 0 ~ 200px, step 4
    기대: padX/padY → state.pageSettings 업데이트
    기대: applyPageSettings() 호출 → CSS 변수 반영

[ ] 전체 섹션 내보내기
    동작: 형식 선택 (PNG/JPG) 후 버튼 클릭
    기대: 각 섹션 순차적으로 html2canvas → 이미지 파일 저장
```

---

## 12. 우측 패널 — 섹션 선택 (prop-section.js)

```
[ ] 섹션 배경색 변경
    동작: 배경색 변경
    기대: sec.style.backgroundColor = 선택한 HEX

[ ] 배경 이미지 업로드
    동작: 파일 선택
    기대: sec.dataset.bgImg = base64 data URL
    기대: sec.style.backgroundImage = url(...)
    기대: backgroundSize/Position/Repeat 적용

[ ] 배경 이미지 제거
    동작: 제거 버튼
    기대: sec.dataset.bgImg 삭제
    기대: sec.style.backgroundImage 제거

[ ] 텍스트 컬러 일괄 변경
    동작: heading 컬러 피커 변경
    기대: 섹션 내 모든 tb-h1/h2/h3 contentEl 색상 변경

[ ] 아래 패딩 변경
    범위: 0 ~ 200px, step 4
    기대: sec.style.paddingBottom 업데이트
    주의: 0 입력 시 paddingBottom = '' (속성 제거)

[ ] 템플릿으로 저장
    조건: 이름 입력
    기대: saveAsTemplate(sec, name, ...) 호출
    기대: 선택 상태/핸들/contenteditable 제거 후 HTML 저장
```

---

## 13. 우측 패널 — Row 선택 (prop-row.js)

```
[ ] 열 추가 (+)
    조건: stack 레이아웃
    동작: + 버튼 클릭
    기대: stack → flex 레이아웃으로 자동 전환
    기대: 새 col 추가, buildLayerPanel() 갱신

[ ] 열 추가 (+)
    조건: grid 레이아웃
    동작: + 버튼 클릭
    기대: gridTemplateColumns = repeat(n+1, 1fr)

[ ] 열 제거 (−)
    조건: flex, col이 2개
    동작: − 버튼 클릭
    기대: 마지막 col 제거
    기대: col 1개만 남으면 flex → stack 자동 전환
    기대: 버튼 disabled 상태 (col === 1)

[ ] 행 높이 변경
    범위: minRowHeight ~ 1200px, step 8
    조건: stack 레이아웃
    기대: row.style.minHeight = value + 'px'
    조건: grid 레이아웃
    기대: gridTemplateRows = repeat(rowCount, perRowPx)
    기대: row.dataset.rowHeight 업데이트

[ ] 높이 auto (0 입력)
    동작: 높이 input에 0 또는 빈값
    기대: minHeight = '' (제거)
    기대: row.dataset.rowHeight = ''

[ ] Gap 변경 (flex/grid 전용)
    범위: 0 ~ 80px, step 4
    기대: row.style.gap 업데이트
    기대: row.dataset.gap 업데이트

[ ] 좌우 패딩 변경
    범위: 0 ~ 80px, step 4
    기대: row.style.paddingLeft = row.style.paddingRight = value + 'px'
    기대: row.dataset.padX 업데이트

[ ] 컬럼 비율 입력
    조건: flex, 입력 "1:2:1"
    기대: col[0].style.flex = 1, col[1].style.flex = 2, col[2].style.flex = 1
    기대: 각 col.dataset.flex 업데이트

[ ] 자식 블록 높이 일괄
    동작: 높이 값 입력
    기대: 모든 직계 자식 블록 minHeight 업데이트
    기대: 값이 다 다르면 input placeholder = "auto"
```

---

## 14. 우측 패널 — Text Block 선택 (prop-text.js)

```
[ ] 타입 전환 H1 → Body
    동작: Body 버튼 클릭
    기대: contentEl.className = 'tb-body'
    기대: tb.dataset.type = 'body'
    기대: 배경색/borderRadius 초기화

[ ] 타입 전환 → Tag (label)
    동작: Tag 버튼 클릭
    기대: contentEl.className = 'tb-label'
    기대: tb.dataset.type = 'label'
    기대: CSS 변수에서 --preset-label-bg/color 읽어 초기 배경색 적용
    기대: #label-style-section 표시됨

[ ] 타입 전환 Tag → H1
    기대: #label-style-section 숨김
    기대: backgroundColor = '', borderRadius = '' 초기화

[ ] 폰트 종류 변경
    동작: select 변경 (Pretendard 선택)
    기대: contentEl.style.fontFamily = "'Pretendard', sans-serif"
    기대: pushHistory() 호출

[ ] 폰트 굵기 변경
    동작: 700 선택
    기대: contentEl.style.fontWeight = '700'

[ ] Bold 버튼 (Cmd+B)
    조건: fontWeight ≠ '700'
    동작: Bold 버튼 클릭 또는 Cmd+B
    기대: fontWeight = '700', Bold 버튼 active 상태
    동작: 다시 클릭
    기대: fontWeight = '' (토글)

[ ] 선택 영역 있을 때 Bold
    조건: 텍스트 일부 선택 후 Cmd+B
    기대: document.execCommand('bold') 실행 (선택 영역만 적용)

[ ] 폰트 크기 범위
    범위: 8 ~ 400px
    동작: 400 초과 입력
    기대: 400으로 클램프

[ ] 폰트 크기 — 선택 영역 없음
    동작: 크기 슬라이더 이동
    기대: contentEl.style.fontSize = value + 'px'
    기대: slider/number 동기화

[ ] 폰트 크기 — 선택 영역 있음
    조건: 텍스트 일부 드래그 선택
    동작: 크기 변경
    기대: 선택 영역만 <span style="font-size:Vpx"> 감싸기

[ ] 글자색 — 컬러피커
    동작: 색상 선택
    기대: contentEl.style.color 즉시 변경
    기대: HEX input 동기화

[ ] 글자색 — HEX 직접 입력
    동작: '#ff0000' 입력
    기대: /^#[0-9a-f]{6}$/i 검증 통과 시만 적용
    기대: 컬러피커 동기화

[ ] 줄간격
    범위: 1 ~ 3 (배수), step 0.05
    기대: contentEl.style.lineHeight = value

[ ] 자간
    범위: -10 ~ 40, step 0.5
    기대: contentEl.style.letterSpacing = value + 'px'

[ ] 상하 패딩
    범위: 0 ~ 120px, step 4
    기대: tb.style.paddingTop = tb.style.paddingBottom = value + 'px'

[ ] 좌우 패딩 — 연동 ON
    조건: phLinked = true
    동작: 왼쪽 패딩 슬라이더 이동
    기대: paddingLeft = paddingRight = 동일 값
    기대: 오른쪽 슬라이더도 같은 값으로 동기화

[ ] 좌우 패딩 — 연동 OFF
    조건: phLinked = false
    동작: 왼쪽 패딩만 변경
    기대: paddingLeft만 변경, paddingRight 유지

[ ] 좌우 패딩 연동 체인 버튼
    동작: 체인 버튼 클릭
    기대: phLinked 토글 (Cmd+L과 동일)

[ ] 태그 스타일 — Pill
    조건: Tag 타입
    동작: Pill 버튼 클릭
    기대: borderRadius = '40px', paddingLeft = paddingRight = '20px'

[ ] 태그 스타일 — Box
    기대: borderRadius = '4px', paddingLeft = paddingRight = '12px'

[ ] 태그 스타일 — Circle
    기대: borderRadius = '50%', paddingLeft = paddingRight = '0'

[ ] 태그 스타일 — Text
    기대: backgroundColor = 'transparent', padding = '0'

[ ] 태그 배경색 — 없음 체크박스
    동작: '없음' 체크
    기대: backgroundColor = 'transparent'
    기대: HEX input placeholder = "없음"

[ ] 태그 높이 (Pill 전용)
    범위: 0 ~ 120px, step 2
    기대: paddingTop = paddingBottom = Math.round(value/2) + 'px'
```

---

## 15. 우측 패널 — Asset Block 선택 (prop-asset.js)

```
[ ] 프리셋 Standard 클릭
    기대: ab.style.height = '780px'
    기대: ab.dataset.baseHeight = '780' 갱신

[ ] 프리셋 Square / Tall / Wide
    기대: Square → 860px, Tall → 1032px, Wide → 575px

[ ] 높이 범위
    범위: 200 ~ 1600px, step 10
    동작: 1601 입력
    기대: 1600으로 클램프

[ ] 정렬 변경
    동작: 우측(→) 클릭
    기대: ab.dataset.align = 'right'
    기대: ab.style.alignSelf = 'flex-end'

[ ] 모서리 변경
    범위: 0 ~ 120px, step 2
    기대: ab.style.borderRadius = value + 'px'

[ ] 페이지 패딩 토글 ON
    동작: 토글 활성화
    기대: ab.dataset.usePadx = 'true'
    기대: ab.dataset.baseHeight 저장 (현재 높이)
    기대: applyAssetPadX() → 너비/높이 재계산

[ ] 페이지 패딩 토글 OFF
    기대: ab.dataset.usePadx = 'false'
    기대: 원래 baseHeight로 높이 복원
    기대: paddingLeft/Right/width 초기화

[ ] 텍스트 오버레이 활성화
    동작: 활성화 토글 ON
    기대: #asset-overlay-controls 표시
    기대: ab.dataset.overlay = 'true'

[ ] 오버레이 불투명도
    범위: 0 ~ 100, step 1
    기대: overlayEl.dataset.ovOpacity = value / 100
    기대: 예) 35 입력 → 0.35 저장

[ ] 오버레이 위치 — 상단
    기대: overlayEl.style.justifyContent = 'flex-start'

[ ] 오버레이 위치 — 중앙/하단
    기대: center → 'center', 하단 → 'flex-end'
```

---

## 16. 이미지 편집 모드 (image-handling.js)

```
[ ] 편집 모드 진입
    조건: asset-block에 이미지 있음
    동작: 이미지 블록 더블클릭
    기대: ab._imgEditing = true
    기대: ab에 'img-editing' 클래스 추가
    기대: ab.draggable = false (블록 드래그 방지)
    기대: ab.style.overflow = 'visible' (핸들 노출)
    기대: 8개 핸들 표시

[ ] 이미지 드래그 (위치 이동)
    동작: 이미지 마우스다운 후 드래그
    기대: img.style.left/top 변경
    기대: zoom 배율 고려: delta / (currentZoom/100)

[ ] 핸들 리사이즈 — 코너
    동작: 모서리 핸들 드래그
    기대: 너비/높이 동시 변경, 비율 유지 (ratio = startW / startH)

[ ] 핸들 리사이즈 — 변 중앙
    동작: 변 핸들 드래그 (좌우)
    기대: 너비만 변경, 높이 유지

[ ] 편집 종료 후 dataset 저장
    동작: 편집 완료 (확인 버튼 또는 외부 클릭)
    기대: ab.dataset.imgW = 최종 너비
    기대: ab.dataset.imgX = 최종 left 값
    기대: ab.dataset.imgY = 최종 top 값

[ ] 저장 후 재로드 시 위치 복원 (applyImageTransform)
    조건: dataset.imgW 있음
    기대: img.style.position = 'absolute'
    기대: img.style.objectFit = 'cover'
    기대: width/left/top 복원됨

[ ] 저장 후 재로드 — dataset.imgW 없음
    기대: applyImageTransform 조기 반환 (object-fit 모드 유지)

[ ] 이미지 정렬 — 가로 중앙
    기대: img.style.left = (frameW - imgW) / 2 + 'px'

[ ] 이미지 정렬 — 세로 하단
    기대: img.style.top = frameH - imgH + 'px'
```

---

## 17. 우측 패널 — LabelGroup Block (prop-label-group.js)

```
[ ] Preset 선택 → Default
    기대: 첫 번째 label-item에 bg=#111111, color=#ffffff, border=none 적용

[ ] 전체 적용 버튼
    동작: Outline 선택 후 전체 적용 클릭
    기대: 모든 label-item에 동일 프리셋 적용

[ ] 정렬 변경
    기대: block.style.justifyContent 변경 (flex-start/center/flex-end)

[ ] Gap 변경
    범위: 0 ~ 60px
    기대: block.style.gap = value + 'px'

[ ] 라벨 추가 (+)
    동작: 그룹 내 + 버튼 클릭
    기대: 첫 번째 라벨 스타일 복사한 새 label-item 추가
    기대: showLabelGroupProperties 재렌더링

[ ] 라벨 삭제 (×)
    조건: 라벨이 2개 이상
    기대: 삭제됨

[ ] 라벨 삭제 — 1개 남음
    기대: 삭제 불가, 토스트 메시지 표시

[ ] 선택 라벨 배경색 변경
    조건: label-item 클릭 후
    기대: selectedItem.dataset.bg = hex 업데이트
    기대: selectedItem.style.backgroundColor 변경

[ ] 선택 라벨 모서리
    범위: 0 ~ 50
    기대: selectedItem.dataset.radius 업데이트
    기대: selectedItem.style.borderRadius = value + 'px'
```

---

## 18. 템플릿 시스템 (template-system.js)

```
[ ] 섹션을 템플릿으로 저장
    동작: 섹션 선택 후 저장 (이름/폴더/카테고리 입력)
    기대: 선택 상태, contenteditable, 핸들 요소 제거 후 저장
    기대: Electron: electronAPI.saveTemplateCanvas(id, html) 호출
    기대: _templatesCache에 메타 추가
    기대: renderTemplatePanel() 재호출

[ ] 템플릿 삽입
    동작: 미리보기 모달에서 삽입 클릭
    기대: 섹션 ID 재생성 (sec_ + Date.now() + random)
    기대: 섹션 번호 갱신 (data-section, section-label)
    기대: canvasEl 끝에 추가
    기대: bindSectionDrag, bindBlock, bindColDropZone 바인딩
    기대: applyPageSettings(), pushHistory() 호출

[ ] 템플릿 ID 충돌 방지
    조건: 같은 템플릿을 두 번 삽입
    기대: 두 섹션의 모든 ID가 서로 다름

[ ] 미리보기 모달
    동작: 템플릿 클릭
    기대: .tpl-preview-backdrop 생성
    기대: 모달 내부에 섹션 HTML 렌더링
    동작: 닫기 버튼 또는 backdrop 클릭
    기대: 모달 제거

[ ] localStorage → 파일 마이그레이션 (Electron)
    조건: localStorage에 기존 템플릿 데이터 있음
    기대: 파일로 이전 후 localStorage 항목 제거
```

---

## 19. 브랜치 시스템 세부 (branch-system.js)

### 핵심 구조 이해 (먼저 읽기)

```
브랜치는 별도 파일이 아니라 프로젝트 파일 하나 안에 모두 저장된다.

프로젝트.json
└─ branches
   ├─ main:    { snapshot: "{ version:2, pages:[...] }", createdAt, updatedAt }
   ├─ dev:     { snapshot: "{ version:2, pages:[...] }", createdAt, updatedAt }
   └─ feature/xxx: { snapshot: "..." }

브랜치 전환 = 현재 브랜치 snapshot 저장 → 다른 브랜치 snapshot 로드
→ 어느 브랜치에 있든 같은 프로젝트 파일을 읽고 씀
→ 보이는 캔버스 내용만 브랜치별로 다름
```

```
[ ] 브랜치 스토어 구조 검증
    기대: localStorage key = 'web-editor-branches-{activeProjectId}'
    기대: { current, branches: { [name]: { snapshot, createdAt, updatedAt } } }
    기대: Electron 환경 → 프로젝트 파일의 branches 필드에도 동일하게 저장

[ ] 브랜치 전환 — 현재 브랜치 snapshot 저장
    동작: main → dev 전환
    기대: store.branches['main'].snapshot = serializeProject() 결과
    기대: store.branches['main'].updatedAt 갱신
    기대: saveBranchStore() 호출 (localStorage + 파일 동기화)

[ ] 브랜치 전환 — 대상 브랜치 로드
    기대: store.branches['dev'].snapshot 파싱 후 applyProjectData() 호출
    기대: clearHistory() 호출 (새 브랜치 상태가 초기 스냅샷이 됨)
    기대: updateBranchIndicator() 호출 → 인디케이터 색상/이름 변경
    기대: applyFocusMode() 호출

[ ] 브랜치 전환 — 같은 브랜치 클릭
    동작: 현재 브랜치와 동일한 브랜치 클릭
    기대: 아무 동작 없음 (store.current === name 조건 분기)

[ ] 브랜치 생성
    동작: 이름 입력 후 생성
    기대: store.branches[name] = { snapshot: 현재상태, createdAt, updatedAt }
    기대: 중복 이름 → alert 후 취소

[ ] 브랜치 삭제
    조건: main/dev 이외의 브랜치
    기대: store.branches[name] 삭제
    기대: 삭제된 브랜치가 current였다면 dev로 자동 전환

[ ] 브랜치 병합 (merge)
    동작: feature → dev 병합
    기대: dev snapshot에 feature 변경사항 반영
    기대: store.branches['dev'].updatedAt 갱신
    기대: applyProjectData() 후 clearHistory() 호출

[ ] Electron 초기화 — 파일이 localStorage보다 최신
    동작: 앱 시작
    기대: electronAPI.loadProject() → proj.branches 확인
    기대: 파일이 더 최신이면 파일 기준으로 로드
    기대: localStorage가 더 최신이면 localStorage 기준 유지

[ ] 브랜치 섹션 연동 (⎇ 버튼)
    동작: 섹션의 ⎇ 버튼 클릭
    기대: 해당 섹션을 특정 브랜치에만 표시하도록 설정 가능

[ ] main 브랜치 포커스 모드
    조건: applyFocusMode('main')
    기대: 포커스 모드 비활성 (main은 잠금 없음)
    기대: feature/* → 지정된 섹션만 표시, 나머지 숨김
```

---

## 20. 미리보기 모드 (preview.js)

```
[ ] Design → Preview 전환
    동작: 미리보기 버튼 클릭
    기대: 편집 UI 숨김, 미리보기 오버레이 표시
    기대: 모든 페이지의 canvas가 순서대로 렌더링

[ ] Preview → Design 복귀
    동작: 'Design' 버튼 또는 Escape 키
    기대: 미리보기 오버레이 제거
    기대: 편집 UI 복원

[ ] 페이지 네비게이터 클릭
    동작: 페이지 버튼 클릭
    기대: 해당 페이지 위치로 스크롤
    기대: 클릭한 버튼 active 상태

[ ] 스크롤 → 네비게이터 자동 하이라이트
    동작: 미리보기 스크롤
    기대: 현재 뷰포트에 있는 페이지 버튼 자동 active

[ ] Side-by-Side 모드
    동작: SBS 버튼 클릭
    기대: 두 페이지가 가로로 나란히 표시
    기대: 윈도우 너비에 맞춰 자동 스케일링
    동작: 창 크기 변경
    기대: 스케일 자동 재계산

[ ] 줌 조절
    범위: 50 ~ 200%
    동작: 줌 슬라이더 조작
    기대: 미리보기 콘텐츠 크기 변경

[ ] 탑바 토글
    동작: 미리보기 탑바 클릭
    기대: 탑바 표시/숨김 토글
```

---

## 21. 블록 생성 검증 (block-factory.js)

```
[ ] makeTextBlock('h1') 구조
    기대: row.dataset.layout = 'stack'
    기대: row > col > text-block > div.tb-h1 계층
    기대: contenteditable 없음 (편집 모드 아닐 때)
    기대: tb.dataset.type = 'heading'

[ ] makeTextBlock 플레이스홀더
    기대: h1 → '제목을 입력하세요'
    기대: body → '본문 내용을 입력하세요.'
    기대: label → 'Label'

[ ] makeAssetBlock() 초기 상태
    기대: ab.dataset.align = 'center'
    기대: ab.dataset.overlay = 'false'
    기대: ab.style.alignSelf = 'center'
    기대: .asset-overlay div 포함

[ ] makeGapBlock()
    기대: row 없이 gb 단독 반환
    기대: gb.dataset.type = 'gap'

[ ] makeIconCircleBlock()
    기대: icb.dataset.size = '240'
    기대: icb.dataset.bgColor = '#e8e8e8'
    기대: .icb-circle (240x240) + .icb-placeholder 포함

[ ] makeLabelGroupBlock('pill')
    기대: 3개 label-item 포함
    기대: 각 item: bg='#e8e8e8', color='#333333', borderRadius=40px
    기대: + 버튼 포함

[ ] makeTableBlock()
    기대: tb.dataset.style = 'default'
    기대: tb.dataset.showHeader = 'true'
    기대: 기본 2열 × 7행 구조

[ ] addRowBlock(3, 2) — grid
    기대: row.dataset.layout = 'grid'
    기대: gridTemplateColumns = 'repeat(3, 1fr)'
    기대: gridTemplateRows = 'repeat(2, Hpx)'
    기대: 총 6개 col 생성

[ ] 그룹화 — 선택 블록 2개 이상
    조건: 같은 섹션, 2개 이상 블록 선택
    동작: 그룹화 실행
    기대: .group-block > .group-inner 구조 생성
    기대: 선택 블록들이 group-inner로 이동
    기대: bindGroupDrag() 호출

[ ] 그룹화 — 중첩 불가
    조건: 이미 그룹 블록 선택 포함
    기대: 그룹화 실행 안 됨 (중첩 방지)
```

---

## 22. dataset 속성 완전 레지스트리

> 이 속성들은 저장/복원 시 반드시 유지되어야 함

| 요소 | 속성 | 타입 | 유효값 |
|------|------|------|--------|
| Section | `name` | string | 임의 문자열 |
| Section | `preset` | string | default\|dark\|brand\|minimal |
| Section | `bgImg` | string | data URL |
| Section | `bgSize` | string | cover\|contain\|auto |
| Text Block | `type` | string | heading\|body\|caption\|label |
| Asset Block | `align` | string | left\|center\|right |
| Asset Block | `overlay` | string | 'true'\|'false' |
| Asset Block | `usePadx` | string | 'true'\|'false' |
| Asset Block | `baseHeight` | number | px |
| Asset Block | `imgW` | number | px |
| Asset Block | `imgX` | number | px |
| Asset Block | `imgY` | number | px |
| Row | `layout` | string | stack\|flex\|grid |
| Row | `ratioStr` | string | 'cols*rows' |
| Row | `rowHeight` | number | px |
| Row | `gap` | number | px |
| Row | `padX` | number | px |
| Col | `flex` | number | flex 비율 |
| Col | `width` | number | 0~100 |
| IconCircle | `size` | number | px |
| IconCircle | `bgColor` | string | hex |
| IconCircle | `border` | string | none\|... |
| LabelItem | `bg` | string | hex |
| LabelItem | `color` | string | hex |
| LabelItem | `radius` | number | px |
| Card Block | `radius` | number | px |
| Table Block | `style` | string | default\|... |
| Table Block | `showHeader` | string | 'true'\|'false' |
| Table Block | `cellAlign` | string | left\|center\|right |
| Group Block | `name` | string | 임의 문자열 |

---

## 23. 기능 간 의존 관계 (훼손 전파 맵)

> 이 기능을 수정하면 → 이것들을 반드시 재확인

```
canvasEl.innerHTML 변경
  → rebindAll() 누락 시: 드래그/클릭/편집 모두 죽음
  → buildLayerPanel() 누락 시: 레이어 패널 불일치

pushHistory() 누락
  → Undo/Redo에서 해당 작업 복원 불가

flushCurrentPage() 누락 (페이지 전환 전)
  → 현재 페이지 편집 내용 소실

scheduleAutoSave() 누락 (프로퍼티 변경 후)
  → pageSettings 변경이 저장 안 됨

applyPageSettings() 누락 (로드/복원 후)
  → CSS 변수 적용 안 됨 → 배경색/간격 깨짐

clearHistory() 누락 (브랜치/페이지 전환 후)
  → 다른 브랜치/페이지의 히스토리가 섞임

_suppressAutoSave 미복원
  → 탭 전환 후 자동 저장 영구 중단

applyImageTransform() 누락 (재로드 후)
  → 이미지 위치/크기 초기화됨
```

---

## 24. 머지 전 게이트 체크리스트

feature 브랜치 → dev 머지 요청 시 아래를 반드시 확인:

```
[ ] 내 작업 기능의 테스트 케이스 전부 통과
[ ] 의존 관계 맵에서 영향 가능한 기능들 재확인
[ ] 페이지 전환 → 내용 소실 없음
[ ] 탭 전환 → 내용 소실 없음
[ ] 언도/리도 → 내 작업 영역에서 정상 동작
[ ] 자동 저장 → 수정 후 1.5초 내 저장 됨
[ ] 저장 후 재오픈 → dataset 속성 포함 상태 완전 복원
[ ] 브랜치 관리 DB 머지로그에 변경 내용 기록
```

---

_최종 업데이트: 2026-03-31_
