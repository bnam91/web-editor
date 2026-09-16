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

/* ★2026-09-16b 현빈 실기 피드백 3건 반영 — 크기(16px 기준)·체크박스 클릭·항목별 코멘트.
   체크박스 실측: hover::after 오버레이(pointer-events:none)는 문제가 아니었다 — 원인은
   버튼 히트타깃이 16px(줌 축소 시 화면상 몇 px)뿐이라 실사용 클릭이 거의 안 먹혔던 것.
   ⇒ 체크박스 히트타깃을 22px로, 아이콘 자체도 16px로 키운다(아래 SVG·CSS 동반 수정). */
/* ★2026-09-16c — 히트타깃(css .qa-check, 22→33px)과 같이 1.5배로 키웠다. */
const QA_CHECK_SVG_DONE =
  '<svg width="24" height="24" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2,6 5,9 10,3"/></svg>';
const QA_CHECK_SVG_UNDONE =
  '<svg width="24" height="24" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="1.5" width="9" height="9" rx="2"/></svg>';
const QA_COMMENT_BADGE_SVG =
  '<svg class="qa-comment-badge" width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><path d="M1 2a1 1 0 011-1h8a1 1 0 011 1v5a1 1 0 01-1 1H6l-2.5 2.2V8H2a1 1 0 01-1-1V2z"/></svg>';

/* ★2026-09-16d 현빈 지시 — 체크리스트 완료여부와는 별개로, "내가 이 블록을 실제로 검토해서
   pass/fail 판정했는지"를 표시. qa-status(대기중/피드백있음/통과)는 항목 체크 진행률의
   자동계산값이고, verdict 는 현빈 본인이 명시적으로 누르는 최종 판정 — 서로 다른 축이다.
   ⇒ 완전히 별도 필드(dataset.verdict)로 둔다. 기본값 'none'(미정).
   ★2026-09-16e 추가 — «원래 스펙대로 안 됨»(fail)과 «스펙대로 됐지만 개선하고 싶다/방향을
   바꾸고 싶다»는 다른 얘기라 REVISE 를 별도 판정으로 뒀다(현빈 지시: 처리는 fail 과 같은
   흐름 — 같은 티켓에서 계속 이어간다. PASS 로 새로 «닫히기» 전까지 판정만 다를 뿐). */
const QA_VERDICT_VALUES = ['none', 'pass', 'fail', 'revise'];

function _escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** dataset.items(JSON) → 정규화된 배열. 깨진 JSON·비배열은 빈 배열로 폴백(화면이 죽지 않게).
 *  ★comment 는 2026-09-16b 신설 — 옛 저장본(comment 없음)은 빈 문자열로 승격(하위호환). */
function _qaItems(block) {
  try {
    const arr = JSON.parse(block.dataset.items || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.map(it => ({
      text: String((it && it.text) != null ? it.text : ''),
      done: !!(it && it.done),
      comment: String((it && it.comment) != null ? it.comment : ''),
    }));
  } catch (_) { return []; }
}

/** 지금 펼쳐진 코멘트 아코디언의 항목 인덱스 집합 — ★저장 대상이 아니다(전적으로 화면 상태).
 *  block 엘리먼트의 JS 프로퍼티로만 살아서 재렌더를 견딘다(block._qaBound 와 같은 자리). */
function _qaExpanded(block) {
  if (!(block._qaExpanded instanceof Set)) block._qaExpanded = new Set();
  return block._qaExpanded;
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
    ? opts.items.map(it => ({ text: String((it && it.text) != null ? it.text : ''), done: false, comment: '' }))
    : [];
  block.dataset.items = JSON.stringify(items);
  block.dataset.feedback = '';
  block.dataset.collapsed = 'false';
  block.dataset.verdict = 'none';
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
  const verdict = QA_VERDICT_VALUES.includes(block.dataset.verdict) ? block.dataset.verdict : 'none';
  const status = _qaStatus(items, feedback);
  const pct = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  const expanded = _qaExpanded(block);
  const checklistHtml = items.map((it, i) => {
    const isExpanded = expanded.has(i);
    const hasComment = !!it.comment.trim();
    return `
    <div class="qa-item-wrap">
      <div class="qa-item${it.done ? ' qa-item--done' : ''}" data-idx="${i}" tabindex="0">
        <button type="button" class="qa-check" title="완료 토글">${it.done ? QA_CHECK_SVG_DONE : QA_CHECK_SVG_UNDONE}</button>
        <span class="qa-item-num">${i + 1}.</span>
        <span class="qa-item-text">${_escHtml(it.text)}</span>
        ${hasComment ? QA_COMMENT_BADGE_SVG : ''}
      </div>
      ${isExpanded ? `
      <div class="qa-item-comment">
        <textarea class="qa-item-comment-input" data-idx="${i}" placeholder="이 항목에 대한 코멘트...">${_escHtml(it.comment)}</textarea>
      </div>` : ''}
    </div>`;
  }).join('');

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
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="5.5" width="7" height="5" rx="1"/><path d="M4 5.5V3.5a2 2 0 0 1 4 0v2"/></svg>
      <span>ADMIN QA</span>
    </div>
    <div class="qa-verdict" title="현빈 검수 판정">
      <button type="button" class="qa-verdict-btn qa-verdict-btn--pass${verdict === 'pass' ? ' qa-verdict-btn--active' : ''}" data-verdict="pass">PASS</button>
      <button type="button" class="qa-verdict-btn qa-verdict-btn--revise${verdict === 'revise' ? ' qa-verdict-btn--active' : ''}" data-verdict="revise">REVISE</button>
      <button type="button" class="qa-verdict-btn qa-verdict-btn--fail${verdict === 'fail' ? ' qa-verdict-btn--active' : ''}" data-verdict="fail">FAIL</button>
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
  block.classList.toggle('qa-verdict-pass', verdict === 'pass');
  block.classList.toggle('qa-verdict-fail', verdict === 'fail');
  block.classList.toggle('qa-verdict-revise', verdict === 'revise');
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
        return { ok: false, code: 'INVALID', message: 'each item must be {text:string, done:boolean, comment?:string}' };
      }
      if (it.comment !== undefined && typeof it.comment !== 'string') {
        return { ok: false, code: 'INVALID', message: 'item.comment must be a string' };
      }
      normItems.push({ text: it.text, done: it.done, comment: typeof it.comment === 'string' ? it.comment : '' });
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
  if (partial.verdict !== undefined) {
    if (!QA_VERDICT_VALUES.includes(partial.verdict)) {
      return { ok: false, code: 'INVALID', message: `verdict must be one of ${QA_VERDICT_VALUES.join('/')}` };
    }
    next.verdict = partial.verdict;
    applied.verdict = partial.verdict;
  }
  if (Object.keys(next).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no recognized fields — expected one of items/feedback/collapsed/verdict' };
  }

  const before = { items: block.dataset.items, feedback: block.dataset.feedback, collapsed: block.dataset.collapsed, verdict: block.dataset.verdict };
  const restore = (snap) => {
    ['items', 'feedback', 'collapsed', 'verdict'].forEach(k => {
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
    const verdictBtn = e.target.closest('.qa-verdict-btn');
    if (verdictBtn) {
      e.stopPropagation();
      const clicked = verdictBtn.dataset.verdict;   // 'pass' | 'fail'
      const current = QA_VERDICT_VALUES.includes(block.dataset.verdict) ? block.dataset.verdict : 'none';
      window.pushHistory?.();
      block.dataset.verdict = current === clicked ? 'none' : clicked;   // 다시 누르면 미정으로 해제
      renderQABlock(block);
      try { window.buildLayerPanel?.(); } catch (_) {}
      window.scheduleAutoSave?.();
      return;
    }
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
        // ★체크박스 클릭 = 토글 + «항목 행»에 포커스(버튼 자신이 아니라) — Enter 로 코멘트를
        //   열 수 있게. 재렌더가 DOM 을 통째로 갈아치우므로 idx 로 새 노드를 다시 찾는다.
        block.querySelector(`.qa-item[data-idx="${idx}"]`)?.focus();
        try { window.buildLayerPanel?.(); } catch (_) {}
        window.scheduleAutoSave?.();
      }
      return;
    }
    if (e.target.closest('.qa-feedback-input, .qa-item-comment-input')) return;   // 입력 중 — 선택/토글 개입 금지
    // 항목 «텍스트/행» 클릭 — 완료 토글은 없고, tabindex 덕에 브라우저가 알아서 포커스만 준다.
    if (e.target.closest('.qa-item')) return;
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

  // ★항목별 코멘트 아코디언 — Enter 로 토글(현빈 2026-09-16b 지시).
  //   ⛔e.target 이 «정확히» .qa-item 자신일 때만 반응한다 — closest 로 느슨하게 잡으면
  //     코멘트 textarea 안에서 줄바꿈하려고 누른 Enter 까지 아코디언을 접어버린다.
  block.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!e.target.classList || !e.target.classList.contains('qa-item')) return;
    e.preventDefault();
    const idx = Number(e.target.dataset.idx);
    if (!Number.isFinite(idx)) return;
    const expanded = _qaExpanded(block);
    const willExpand = !expanded.has(idx);
    if (willExpand) expanded.add(idx); else expanded.delete(idx);
    renderQABlock(block);
    if (willExpand) {
      // 펼치자마자 바로 타이핑할 수 있게 코멘트 입력창에 포커스.
      block.querySelector(`.qa-item-comment-input[data-idx="${idx}"]`)?.focus();
    } else {
      block.querySelector(`.qa-item[data-idx="${idx}"]`)?.focus();
    }
  });

  // blur 는 버블링하지 않는다 — focusout(버블) 으로 위임해서 재렌더에도 살아남게 한다.
  block.addEventListener('focusout', e => {
    const feedbackTa = e.target.closest?.('.qa-feedback-input');
    if (feedbackTa) {
      if (feedbackTa.value === (block.dataset.feedback || '')) return;   // 변화 없으면 커밋하지 않는다
      window.pushHistory?.();
      block.dataset.feedback = feedbackTa.value;
      renderQABlock(block);
      window.scheduleAutoSave?.();
      return;
    }
    const commentTa = e.target.closest?.('.qa-item-comment-input');
    if (commentTa) {
      const idx = Number(commentTa.dataset.idx);
      const items = _qaItems(block);
      if (!Number.isFinite(idx) || !items[idx]) return;
      if (commentTa.value === items[idx].comment) return;   // 변화 없으면 커밋하지 않는다
      window.pushHistory?.();
      items[idx].comment = commentTa.value;
      block.dataset.items = JSON.stringify(items);
      renderQABlock(block);
      try { window.buildLayerPanel?.(); } catch (_) {}
      window.scheduleAutoSave?.();
      return;
    }
  });
}

window.makeQABlock = makeQABlock;
window.addQABlock = addQABlock;
window.updateQABlock = updateQABlock;
window.renderQABlock = renderQABlock;
window.bindQABlockEvents = bindQABlockEvents;

export { makeQABlock, addQABlock, updateQABlock, renderQABlock, bindQABlockEvents };
