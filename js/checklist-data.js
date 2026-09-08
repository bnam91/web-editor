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
window.updateChecklistItem = function updateChecklistItem({ id, text, done, urgent, x, y, ckSectionId } = {}) {
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
  /* ★★이름이 겹치는 두 가지를 «가른다» (2026-09-07).
       · addChecklistItem 의 `sectionId` = «캔버스 섹션»(sec_xxx) — 핀 좌표를 잡으려고 받는다.
       · item.sectionId               = «체크리스트 섹션»(ck_xxx) — 패널 안 분류다.
     같은 이름이라 섞이면 「투두를 캔버스 섹션으로 분류」하는 «없는 개념»이 생긴다.
     ⇒ 밖에서 오는 «분류» 지정은 ckSectionId 로만 받는다. */
  if (ckSectionId !== undefined) {
    if (ckSectionId === null || ckSectionId === '') {
      item.sectionId = null;                       // 섹션에서 뺀다
    } else {
      const secs = loadSections();
      if (!secs.some(sc => sc.id === ckSectionId)) {
        /* ⛔없는 섹션이면 «조용히 null» 로 가지 않는다 — 그러면 「분류했다」고 믿는데 안 돼 있다 */
        return { ok: false, code: 'SECTION_NOT_FOUND',
                 message: 'checklist section not found: ' + ckSectionId,
                 hint: 'Get ids from listChecklistSections / list_checklist_items(sections). NOTHING was changed.' };
      }
      item.sectionId = ckSectionId;
    }
  }
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
window.addChecklistItem = function addChecklistItem({ text, x, y, sectionId, ckSectionId, done = false, urgent = false } = {}) {
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
    /* ★item.sectionId 는 «체크리스트 섹션»(ck_xxx) 분류다. 위 인자 sectionId(sec_xxx)는
       «캔버스 섹션»이라 여기 넣으면 안 된다 — 그래서 예전엔 무조건 null 이었다.
       ⇒ «분류»는 ckSectionId 로 «명시»했을 때만 넣는다(검증은 아래에서). */
    sectionId: null,
    createdAt: Date.now(),
  };
  if (ckSectionId != null && ckSectionId !== '') {
    const secs = loadSections();
    if (!secs.some(sc => sc.id === ckSectionId)) {
      /* ⛔없는 섹션이면 «만들지 않고» 거절한다 — 「분류해서 넣었다」는 거짓말을 만들지 않는다 */
      return { ok: false, code: 'SECTION_NOT_FOUND',
               message: 'checklist section not found: ' + ckSectionId,
               hint: 'Create it first (edit_checklist_section op:create). NOTHING was added.' };
    }
    newItem.sectionId = ckSectionId;
  }
  items.push(newItem);
  saveItems(items);
  window.renderChecklistPanel?.();
  window.renderTodoPins?.();
  return newItem.id;
};

// ── 외부 API (MCP list_checklist_items) ──────────────────────────────────────
// INV-B3 결손 #2 — add/update만 있고 조회가 없어 세션이 끊기면(id를 잊으면) 만든 항목을
// 다시 찾을 방법이 없었다. loadItems() 그대로 노출(방어적 얕은 복사 — 호출측이 배열을
// 변형해도 _ckItems 원본에 영향 없게).
window.listChecklistItems = function listChecklistItems({ includeDone = true, sectionId } = {}) {
  let items = loadItems().slice();
  if (includeDone === false) items = items.filter(it => !it.done);
  if (sectionId != null) items = items.filter(it => it.sectionId === sectionId);
  return items;
};

// ── 외부 API (MCP delete_checklist_item) ─────────────────────────────────────
// UI(js/checklist-panel.js .ck-delete)와 같은 패턴: saveItems(loadItems().filter(...)).
// list와 짝을 이뤄야 "만들었는데 못 보고 못 지우는" 이중 결손이 해소된다.
window.deleteChecklistItem = function deleteChecklistItem({ id } = {}) {
  if (!id || typeof id !== 'string') return { ok: false, code: 'BAD_ARGS', message: 'id required' };
  const items = loadItems();
  const idx = items.findIndex(it => it.id === id);
  if (idx === -1) return { ok: false, code: 'NOT_FOUND', message: 'checklist item not found: ' + id };
  const [removed] = items.splice(idx, 1);
  saveItems(items);
  if (typeof window.renderChecklistPanel === 'function') window.renderChecklistPanel();
  if (typeof window.renderTodoPins === 'function')       window.renderTodoPins();
  return { ok: true, itemId: id, item: removed };
};


/* ── 외부 API (MCP edit_checklist_section / list) ──────────────────────────────
   ⛔패널(js/checklist-panel.js)과 «같은 규칙»을 쓴다. 두 벌이 되면 화면과 MCP 가 갈린다.
     · 만들기 : sections.push({ id: genCkId(), name, collapsed: false })   (panel :893)
     · 이름   : map(s => s.id === id ? { ...s, name } : s)                 (panel :961)
     · 지우기 : ★소속 «항목은 안 지운다» — sectionId 만 null 로 뗀다        (panel :627~629)
   ⇒ 규칙이 바뀌면 «패널 쪽»이 정본이다. 여기를 먼저 고치지 마라. */
window.listChecklistSections = function listChecklistSections() {
  const items = loadItems();
  return loadSections().map(s => ({
    id: s.id, name: s.name, collapsed: !!s.collapsed,
    count: items.filter(it => it.sectionId === s.id).length,
    doneCount: items.filter(it => it.sectionId === s.id && it.done).length,
  }));
};

window.addChecklistSection = function addChecklistSection({ name } = {}) {
  const nm = String(name == null ? '' : name).trim();
  if (!nm) return { ok: false, code: 'BAD_ARGS', message: 'name required' };
  const sections = loadSections();
  const sec = { id: genCkId(), name: nm, collapsed: false };
  sections.push(sec);
  saveSections(sections);
  window.renderChecklistPanel?.();
  return { ok: true, sectionId: sec.id, name: sec.name };
};

window.renameChecklistSection = function renameChecklistSection({ id, name } = {}) {
  const nm = String(name == null ? '' : name).trim();
  if (!id || !nm) return { ok: false, code: 'BAD_ARGS', message: 'id and name required' };
  const sections = loadSections();
  if (!sections.some(s => s.id === id)) {
    return { ok: false, code: 'NOT_FOUND', message: 'checklist section not found: ' + id };
  }
  saveSections(sections.map(s => (s.id === id ? { ...s, name: nm } : s)));
  window.renderChecklistPanel?.();
  return { ok: true, sectionId: id, name: nm };
};

window.deleteChecklistSection = function deleteChecklistSection({ id } = {}) {
  if (!id) return { ok: false, code: 'BAD_ARGS', message: 'id required' };
  const sections = loadSections();
  if (!sections.some(s => s.id === id)) {
    return { ok: false, code: 'NOT_FOUND', message: 'checklist section not found: ' + id };
  }
  /* ★항목은 «살린다» — 패널과 같은 규칙(섹션만 없어지고 항목은 «섹션 없음»으로 내려간다) */
  const items = loadItems();
  const detached = items.filter(it => it.sectionId === id).length;
  saveItems(items.map(it => (it.sectionId === id ? { ...it, sectionId: null } : it)));
  saveSections(loadSections().filter(s => s.id !== id));
  window.renderChecklistPanel?.();
  return { ok: true, sectionId: id, detachedItems: detached };
};
