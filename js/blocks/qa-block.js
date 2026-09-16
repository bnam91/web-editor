/* ═══════════════════════════════════
   QA BLOCK — admin 전용 체크리스트 (2026-09-16 신설)
   ★일반 고객은 이 블록을 만들 수 없다 — UI 블록 추가 팔레트에 노출하지 않는다.
     생성/조작은 MCP 도구(add_qa_block / update_qa_block, main.js·mcp-server.js) «둘뿐»이다.
     별도 권한 체크 시스템은 두지 않는다 — 만들 «경로 자체»가 없으면 충분하다.
   용도: 현빈이 GODITOR 캔버스에서 티켓별 QA 체크리스트를 직접 클릭·기입하는 도구.
   export(PNG/Figma/HTML) 어디에도 나가면 안 된다 — 콘텐츠가 아니라 작업 메타데이터다.
═══════════════════════════════════ */

import { insertAfterSelected, genId } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const QA_CHECK_SVG_DONE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="2,6 5,9 10,3"/></svg>';
const QA_CHECK_SVG_UNDONE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="1.5" width="9" height="9" rx="2"/></svg>';

function _escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** dataset.items(JSON) → 정규화된 배열. 깨진 JSON·비배열은 빈 배열로 폴백(화면이 죽지 않게). */
function _qaItems(block) {
  try {
    const arr = JSON.parse(block.dataset.items || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.map(it => ({ text: String((it && it.text) != null ? it.text : ''), done: !!(it && it.done) }));
  } catch (_) { return []; }
}

/** items·feedback 으로 상태칩을 정한다 — 대기중(파랑)/피드백있음(주황)/통과(초록). */
function _qaStatus(items, feedback) {
  const total = items.length;
  const done = items.filter(it => it.done).length;
  let cls = 'wait', label = '대기중';
  if (total > 0 && done === total) { cls = 'pass'; label = '통과'; }
  else if (String(feedback || '').trim()) { cls = 'feedback'; label = '피드백있음'; }
  return { total, done, cls, label };
}

function makeQABlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'qa-block';
  block.id = genId('qa');
  block.dataset.type = 'qa';
  block.dataset.ticket = String(opts.ticket || '');
  block.dataset.title = String(opts.title || '');
  const items = Array.isArray(opts.items)
    ? opts.items.map(it => ({ text: String((it && it.text) != null ? it.text : ''), done: false }))
    : [];
  block.dataset.items = JSON.stringify(items);
  block.dataset.feedback = '';
  block.dataset.collapsed = 'false';
  renderQABlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addQABlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory();
  const { row, block } = makeQABlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

/** 순수 렌더 — dataset 을 읽어 innerHTML 을 다시 그린다. side-effect(이벤트 배선) 없음. */
function renderQABlock(block) {
  const ticket = block.dataset.ticket || '';
  const title = block.dataset.title || '';
  const items = _qaItems(block);
  const feedback = block.dataset.feedback || '';
  const collapsed = block.dataset.collapsed === 'true';
  const status = _qaStatus(items, feedback);
  const pct = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  const checklistHtml = items.map((it, i) => `
    <div class="qa-item${it.done ? ' qa-item--done' : ''}" data-idx="${i}">
      <button type="button" class="qa-check" title="완료 토글">${it.done ? QA_CHECK_SVG_DONE : QA_CHECK_SVG_UNDONE}</button>
      <span class="qa-item-num">${i + 1}.</span>
      <span class="qa-item-text">${_escHtml(it.text)}</span>
    </div>`).join('');

  const bodyHtml = collapsed ? '' : `
    <div class="qa-body">
      <div class="qa-checklist">${checklistHtml}</div>
      <div class="qa-divider"></div>
      <div class="qa-feedback">
        <div class="qa-feedback-label">피드백</div>
        <textarea class="qa-feedback-input" placeholder="이상 있으면 적어주세요...">${_escHtml(feedback)}</textarea>
      </div>
      <div class="qa-footer">
        <span class="qa-id-chip" title="클릭하여 복사">${block.id || ''}</span>
      </div>
    </div>`;

  block.innerHTML = `
    <div class="qa-badge">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="5.5" width="7" height="5" rx="1"/><path d="M4 5.5V3.5a2 2 0 0 1 4 0v2"/></svg>
      <span>ADMIN QA</span>
    </div>
    <div class="qa-header">
      <span class="qa-ticket">${_escHtml(ticket)}</span>
      <span class="qa-title">${_escHtml(title)}</span>
      <span class="qa-status qa-status--${status.cls}">${status.label} ${status.done}/${status.total}</span>
      <svg class="qa-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,4.5 6,7.5 9,4.5"/></svg>
    </div>
    <div class="qa-progress"><div class="qa-progress-fill${pct >= 100 ? ' qa-progress-fill--done' : ''}" style="width:${pct}%"></div></div>
    ${bodyHtml}`;
  block.classList.toggle('qa-collapsed', collapsed);
}

/** updateStepBlock/updateGridBlock 미러 — validate-then-commit. */
function updateQABlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('qa-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `qa-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty' };
  }

  const next = {};
  const applied = {};

  if (partial.items !== undefined) {
    if (!Array.isArray(partial.items)) {
      return { ok: false, code: 'INVALID', message: 'items must be an array' };
    }
    const normItems = [];
    for (const it of partial.items) {
      if (!it || typeof it !== 'object' || typeof it.text !== 'string' || typeof it.done !== 'boolean') {
        return { ok: false, code: 'INVALID', message: 'each item must be {text:string, done:boolean}' };
      }
      normItems.push({ text: it.text, done: it.done });
    }
    next.items = JSON.stringify(normItems);
    applied.items = normItems;
  }
  if (partial.feedback !== undefined) {
    if (typeof partial.feedback !== 'string') {
      return { ok: false, code: 'INVALID', message: 'feedback must be a string' };
    }
    next.feedback = partial.feedback;
    applied.feedback = partial.feedback;
  }
  if (partial.collapsed !== undefined) {
    if (typeof partial.collapsed !== 'boolean') {
      return { ok: false, code: 'INVALID', message: 'collapsed must be a boolean' };
    }
    next.collapsed = String(partial.collapsed);
    applied.collapsed = partial.collapsed;
  }
  if (Object.keys(next).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no recognized fields — expected one of items/feedback/collapsed' };
  }

  const before = { items: block.dataset.items, feedback: block.dataset.feedback, collapsed: block.dataset.collapsed };
  const restore = (snap) => {
    ['items', 'feedback', 'collapsed'].forEach(k => {
      if (snap[k] === undefined) delete block.dataset[k]; else block.dataset[k] = snap[k];
    });
  };
  window.pushHistory?.();
  Object.assign(block.dataset, next);
  try {
    renderQABlock(block);
  } catch (e) {
    restore(before);
    try { renderQABlock(block); } catch (_) {}
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }
  try { window.buildLayerPanel?.(); } catch (_) {}
  window.scheduleAutoSave?.();
  return { ok: true, blockId, before, applied };
}

/** 캔버스 인터랙션 배선 — 헤더(접기/펼치기) · 체크박스(완료 토글) · 피드백(텍스트) · 블록ID(복사).
 *  ⛔renderQABlock 은 순수 렌더다 — 배선은 여기 한 곳(block 루트에 위임)에서만 한다. */
function bindQABlockEvents(block) {
  if (block._qaBound) return;
  block._qaBound = true;

  block.addEventListener('click', e => {
    const idChip = e.target.closest('.qa-id-chip');
    if (idChip) {
      e.stopPropagation();
      window._copyToClipboard?.(block.id);
      return;
    }
    const checkBtn = e.target.closest('.qa-check');
    if (checkBtn) {
      e.stopPropagation();
      const itemEl = checkBtn.closest('.qa-item');
      const idx = Number(itemEl?.dataset.idx);
      const items = _qaItems(block);
      if (Number.isFinite(idx) && items[idx]) {
        window.pushHistory?.();
        items[idx].done = !items[idx].done;
        block.dataset.items = JSON.stringify(items);
        renderQABlock(block);
        try { window.buildLayerPanel?.(); } catch (_) {}
        window.scheduleAutoSave?.();
      }
      return;
    }
    if (e.target.closest('.qa-feedback-input')) return;   // 입력 중 — 선택/토글 개입 금지
    const header = e.target.closest('.qa-header');
    if (header) {
      e.stopPropagation();
      window.pushHistory?.();
      block.dataset.collapsed = String(block.dataset.collapsed !== 'true');
      renderQABlock(block);
      try { window.buildLayerPanel?.(); } catch (_) {}
      window.scheduleAutoSave?.();
      return;
    }
  });

  // blur 는 버블링하지 않는다 — focusout(버블) 으로 위임해서 재렌더에도 살아남게 한다.
  block.addEventListener('focusout', e => {
    const ta = e.target.closest?.('.qa-feedback-input');
    if (!ta) return;
    if (ta.value === (block.dataset.feedback || '')) return;   // 변화 없으면 커밋하지 않는다
    window.pushHistory?.();
    block.dataset.feedback = ta.value;
    renderQABlock(block);
    window.scheduleAutoSave?.();
  });
}

window.makeQABlock = makeQABlock;
window.addQABlock = addQABlock;
window.updateQABlock = updateQABlock;
window.renderQABlock = renderQABlock;
window.bindQABlockEvents = bindQABlockEvents;

export { makeQABlock, addQABlock, updateQABlock, renderQABlock, bindQABlockEvents };
