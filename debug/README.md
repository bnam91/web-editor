# 상페마법사 웹에디터 심층 디버깅 매뉴얼

> 프로 레벨 디버깅 베스트 프랙티스 반영 (2026-03-28 업데이트)

---

## 실행 환경

- Electron 앱: `npm run dev` → `--remote-debugging-port=9334`
- CDP 접속: `http://localhost:9334`
- MCP: `mcp__chrome-devtools` (9334 고정)

---

## 에이전트 구성

| 에이전트 | 파일 | 담당 |
|---------|------|------|
| Agent-α | scenarios/alpha-figma-standards.md | 피그마 표준 기능 |
| Agent-β | scenarios/beta-state-contamination.md | 상태 오염 |
| Agent-γ | scenarios/gamma-ui-consistency.md | UI 일관성 |
| Agent-δ | scenarios/delta-history-integrity.md | 히스토리 무결성 |
| Agent-01 | scenarios/01-text-blocks.md | 텍스트/Gap/Divider |
| Agent-02 | scenarios/02-asset-circle.md | Asset/Circle 이미지 |
| Agent-03 | scenarios/03-card-table.md | Card/Table |
| Agent-04 | scenarios/04-banner-graph.md | Banner/Graph |
| Agent-05 | scenarios/05-row-col-section.md | Row/Col/Section/Page |
| Agent-06 | scenarios/06-layer-template-branch.md | Layer/Template/Branch |

---

## 프로 레벨 디버깅 체크리스트

### 1. dragover 성능 (가장 흔한 병목)

```javascript
// ❌ 안티패턴 — 매 픽셀마다 레이아웃 강제 재계산
element.addEventListener('dragover', (e) => {
  const rect = e.target.getBoundingClientRect(); // 매번 레이아웃 blocking
  updateDropIndicator(rect);
});

// ✅ rAF throttle로 수정
let rafId = null;
element.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    const rect = e.target.getBoundingClientRect();
    updateDropIndicator(rect);
    rafId = null;
  });
});
```

### 2. MutationObserver 누수 방지

```javascript
// ❌ attributes:true → 드래그 클래스 토글마다 autoSave 폭주 (실제 발생한 버그)
observer.observe(canvas, { childList: true, subtree: true, attributes: true });

// ✅ 구조 변경·텍스트 편집만 감지
observer.observe(canvas, { childList: true, subtree: true, characterData: true });

// ✅ 드래그 중 suppress 플래그 (이중 보호)
element.addEventListener('dragstart', () => state._suppressAutoSave = true);
element.addEventListener('dragend',   () => state._suppressAutoSave = false);
```

### 3. autoSave Race Condition 방지

```javascript
// ✅ 저장 중 변경 대기열 패턴
let isSaving = false, pendingData = null;
async function triggerSave(data) {
  if (isSaving) { pendingData = data; return; }
  isSaving = true;
  await save(data);
  isSaving = false;
  if (pendingData) { const d = pendingData; pendingData = null; await triggerSave(d); }
}
```

### 4. contentEditable IME (한국어 입력) 처리

> ⚠️ **이 프로젝트 해당 없음** (2026-03-28 검증)
> 텍스트 저장이 `input` 이벤트가 아닌 `blur` 이벤트 기반이라, `compositionend` 이후에만 트리거됨. 별도 가드 불필요.
> 타 프로젝트(`input` 이벤트로 저장 트리거)에는 아래 패턴 유효.

```javascript
// input 이벤트 기반 저장 시스템에만 해당
let isComposing = false;
editor.addEventListener('compositionstart', () => isComposing = true);
editor.addEventListener('compositionend', (e) => { isComposing = false; handleChange(e); });
editor.addEventListener('input', (e) => { if (!isComposing) handleChange(e); });
```

### 5. DOM-모델 동기화 검증 유틸리티

> ⚠️ **이 프로젝트 해당 없음** (2026-03-28 검증)
> 이 앱은 별도 JS 데이터 모델 없이 **DOM 자체를 소스**로 사용 (`innerHTML` 직렬화 구조).
> `data-id` 기반 검증 패턴은 React/Vue 같은 VDOM 기반 에디터에 적용.

```javascript
// VDOM 기반 에디터(React/Vue)에만 해당
function assertDOMModelSync(rootEl, dataModel) {
  const domIds = [...rootEl.querySelectorAll('[data-id]')].map(el => el.dataset.id);
  const modelIds = flattenTree(dataModel).map(n => n.id);
  const ghost  = domIds.filter(id => !modelIds.includes(id));
  const orphan = modelIds.filter(id => !domIds.includes(id));
  if (ghost.length || orphan.length) console.error('[SYNC BUG]', { ghost, orphan });
}
```

### 6. dragleave 오탐 방지

```javascript
// ✅ 자식 요소로 이동 시 dragleave 오발화 방지
dropzone.addEventListener('dragleave', (e) => {
  if (dropzone.contains(e.relatedTarget)) return; // 자식으로 이동 → 무시
  removeDropIndicator();
});
```

### 7. ghost image 타이밍 버그

```javascript
// ❌ dragstart에서 즉시 숨기면 ghost가 빈 화면
element.addEventListener('dragstart', () => { element.style.opacity = '0'; });

// ✅ setTimeout 0으로 다음 tick에 처리 (브라우저가 ghost 캡처한 후 실행)
element.addEventListener('dragstart', () => { setTimeout(() => { element.style.opacity = '0'; }, 0); });
```

### 8. drop 이벤트 중복 처리 방지

```javascript
// ✅ drop 시 브라우저 기본 DOM 조작 차단 (ProseMirror #1208 유형 — 복제 버그)
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();  // 브라우저 기본 drop 동작 차단
  e.stopPropagation(); // 부모로 버블링 차단
  // 반드시 데이터 모델을 통해서만 DOM 업데이트
});
```

### 9. IPC 리스너 누수 탐지 (Electron 특화)

```javascript
// main.js에 삽입 — 채널별 리스너 수 모니터링
setInterval(() => {
  const leaks = ipcMain.eventNames()
    .map(ch => ({ ch, count: ipcMain.listenerCount(ch) }))
    .filter(x => x.count > 3);
  if (leaks.length) console.warn('[IPC LEAK]', leaks);
}, 10000);
```

---

## Chrome DevTools 심층 활용 포인트

| 탭 | 주요 활용 |
|----|---------|
| **Performance** | INP 3단계 분해 (input delay / processing / presentation), Long Tasks (50ms+), CSS Selector Stats 체크박스 활성화 |
| **Memory** | 3-Snapshot 기법 (의심 동작 → GC 강제 → 스냅샷 비교), Retainer chain으로 누수 역추적 |
| **Coverage** | 초기 로딩 시 실행 안 되는 코드 파악 → lazy-load 후보 식별 |
| **Layers** | ghost element 합성 레이어 여부, 드롭존 hover가 전체 repaint 유발하는지 확인 |

---

## 심층 디버깅 시 우선 확인 순서

1. **dragover 안에 getBCR 있는가?** → rAF throttle
2. **MutationObserver attributes:true 있는가?** → 제거
3. **autoSave 중 pendingData 처리하는가?** → 대기열 패턴
4. **drop에 preventDefault+stopPropagation 있는가?** → 복제 버그 방지
5. **드래그 종료 후 상태 리셋 3곳(dragend/drop/dragleave) 호출되는가?**
6. **contentEditable isComposing 가드 있는가?** → 한국어 입력 안정화
7. **DOM-모델 ID 일치 검증 로직 있는가?** → 유령 노드 탐지

---

## 결과 확인

`debug/results/` 폴더의 JSON 파일 확인
