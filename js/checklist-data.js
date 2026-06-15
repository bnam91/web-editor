// checklist-data.js
// checklist-panel.js에서 분리: 데이터 CRUD + 순수 헬퍼 (plain 글로벌 스크립트 — top-level function은 전역 접근)

// ── Items CRUD ────────────────────────────────────────────────────────────────
// 데이터는 프로젝트 JSON에 저장 (save-load.js serializeProject/applyProjectData와 연동)
// window._ckItems / window._ckSections 는 save-load.js의 applyProjectData가 설정함
function loadItems() {
  return window._ckItems || [];
}
function saveItems(arr) {
  window._ckItems = arr;
  window.triggerAutoSave?.();
}

// ── Sections CRUD ─────────────────────────────────────────────────────────────
function loadSections() {
  return window._ckSections || [];
}
function saveSections(arr) {
  window._ckSections = arr;
  window.triggerAutoSave?.();
}

function genCkId() { return 'ck_' + Math.random().toString(36).slice(2, 9); }

// ── 핀 번호 계산 (_renderList와 동일한 순서) ─────────────────────────────────
// 체크리스트 표시 순서(섹션 없는 것 → 섹션별)로 핀 있는 미완료 항목을 반환,
// 각 항목에 pinNum(1-based)을 추가. renderPins + _buildItemEl 두 곳에서 사용.
function _getPinnedItemsInOrder() {
  const items    = loadItems();
  const sections = loadSections();

  const ordered = [];
  items.filter(it => !it.sectionId).forEach(it => ordered.push(it));
  sections.forEach(sec => {
    items.filter(it => it.sectionId === sec.id).forEach(it => ordered.push(it));
  });

  let num = 0;
  const result = new Map(); // id → pinNum
  ordered.forEach(it => {
    if (!it.done && it.x != null && it.y != null) {
      num++;
      result.set(it.id, num);
    }
  });
  return result; // Map<id, pinNum>
}

// ── HTML 이스케이프 ──
function _escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 외부 API (MCP update_checklist_item) ─────────────────────────────────────
// 기존 체크리스트 항목의 text/done/urgent 등을 수정.
// PM이 done 토글, 텍스트 수정으로 todo를 운영할 수 있게 함.
// 보너스 기능 (P/G/E + Codex 리뷰).
window.updateChecklistItem = function updateChecklistItem({ id, text, done, urgent, x, y } = {}) {
  if (!id || typeof id !== 'string') return { ok: false, code: 'BAD_ARGS', message: 'id required' };
  // 동일 항목 인라인 편집 race 가드 (Codex 리뷰 #1):
  // 사용자가 같은 ck_xxx 행을 인라인 편집 중이면 거부 — render unmount + blur save 덮어쓰기 방지.
  // (main.js bridge에서도 1차 컷, 여기는 직접 호출/다른 경로 폴백)
  try {
    const ae = document.activeElement;
    if (ae) {
      const ckHost = (ae.closest && ae.closest('.ck-item, .todo-pin-popup')) || null;
      const editingId = ckHost && ckHost.dataset ? (ckHost.dataset.id || null) : null;
      if (editingId && editingId === id) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 이 항목을 편집 중입니다.', retryAfter: 2000 };
      }
    }
  } catch (_) { /* ignore — guard is best-effort */ }

  const items = loadItems();
  const idx = items.findIndex(it => it.id === id);
  if (idx === -1) return { ok: false, code: 'NOT_FOUND', message: 'checklist item not found: ' + id };
  const item = items[idx];
  // 부분 갱신 — 정의된 필드만 덮어씀
  if (text   !== undefined) item.text   = String(text || '');
  if (done   !== undefined) item.done   = !!done;
  if (urgent !== undefined) item.urgent = !!urgent;
  if (x !== undefined) item.x = (typeof x === 'number') ? x : null;
  if (y !== undefined) item.y = (typeof y === 'number') ? y : null;
  item.updatedAt = Date.now();
  saveItems(items);
  // 렌더 동기화 (renderChecklistPanel/renderTodoPins이 동시에 saveItems 트리거하지 않도록
  // saveItems가 먼저 호출되어 _ckItems 가 update된 후 렌더 함수 실행 → race 없음)
  if (typeof window.renderChecklistPanel === 'function') window.renderChecklistPanel();
  if (typeof window.renderTodoPins === 'function')       window.renderTodoPins();
  return { ok: true, itemId: id, item };
};

// ── 외부 API (MCP add_checklist_item) ────────────────────────────────────────
// text + 선택적 x/y(핀) + 선택적 sectionId + done/urgent flag.
// sectionId가 'sec_xxx'면 자동으로 그 섹션의 절대 좌표 옆에 핀 위치 계산 (x/y 명시 안 했을 때만).
window.addChecklistItem = function addChecklistItem({ text, x, y, sectionId, done = false, urgent = false } = {}) {
  const items = loadItems();
  let px = (typeof x === 'number') ? x : null;
  let py = (typeof y === 'number') ? y : null;
  // sectionId 주고 x/y 없으면 섹션 위치 기반 자동 핀 좌표
  if (sectionId && (px == null || py == null)) {
    const sec = document.getElementById(sectionId);
    if (sec) {
      const canvas = document.getElementById('canvas');
      const cRect = canvas?.getBoundingClientRect();
      const sRect = sec.getBoundingClientRect();
      if (cRect && sRect) {
        // 캔버스 우측 + 섹션 중앙 높이
        px = (cRect.width + 40);
        py = (sRect.top - cRect.top) + sRect.height / 2;
      }
    }
  }
  const newItem = {
    id: genCkId(),
    text: String(text || ''),
    done: !!done,
    urgent: !!urgent,
    x: px, y: py,
    sectionId: null, // checklist의 sectionId는 checklist 섹션 분류용, 자동 X
    createdAt: Date.now(),
  };
  items.push(newItem);
  saveItems(items);
  window.renderChecklistPanel?.();
  window.renderTodoPins?.();
  return newItem.id;
};
