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
