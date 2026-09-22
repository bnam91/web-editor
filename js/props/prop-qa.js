/* prop-qa.js — QA 블록(admin 전용) 우측 패널. 조작(체크·피드백 입력)은 여전히 캔버스에서 직접 —
   여기는 «읽기 전용 전문(全文) 보기»다. 캔버스의 제목(.qa-title)은 한 줄 말줄임(ellipsis)이고
   항목 텍스트도 카드 폭에 눌려 읽기 힘들 수 있어(현빈 2026-09-16 지적, qa_ts0he_3hihtxr),
   패널에서는 줄바꿈 제한 없이 전체 텍스트를 보여준다. gap-block(prop-gap.js) 과 같은 얼개. */
import { propPanel } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';

/* qa-block.js 의 _escHtml 과 동일 — 모듈이 갈려 있어 import 대신 짧은 사본을 둔다(5종 이스케이프뿐). */
function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function _items(block) {
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

const _VERDICT_LABEL = { none: '미정', pass: 'PASS', fail: 'FAIL', revise: 'REVISE' };

export function showQAProperties(block) {
  const ticket = block.dataset.ticket || '';
  const title = block.dataset.title || '';
  const feedback = block.dataset.feedback || '';
  const items = _items(block);
  const verdict = _VERDICT_LABEL[block.dataset.verdict] ? block.dataset.verdict : 'none';

  const itemsHtml = items.length ? items.map((it, i) => `
    <div class="prop-row" style="align-items:flex-start; gap:8px; padding:4px 0;">
      <span style="flex:0 0 auto; margin-top:1px; opacity:.7;">${it.done ? '☑' : '☐'}</span>
      <span class="prop-value-text" style="white-space:normal; word-break:break-word; ${it.done ? 'text-decoration:line-through; opacity:.6;' : ''}">${_esc(it.text)}</span>
    </div>
    ${it.comment.trim() ? `<div style="margin:0 0 6px 22px; font-size:11px; color:var(--ui-text-dim); white-space:normal; word-break:break-word;">💬 ${_esc(it.comment)}</div>` : ''}
  `).join('') : '<p class="prop-value-text" style="opacity:.6;">체크리스트 항목 없음</p>';

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="2.5" y="5.5" width="7" height="5" rx="1"/><path d="M4 5.5V3.5a2 2 0 0 1 4 0v2"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'QA Block',
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: block.id,
    })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">QA Ticket</div>
      <div class="prop-row"><span class="prop-label">티켓</span><span class="prop-value-text">${_esc(ticket) || '—'}</span></div>
      <div class="prop-row" style="align-items:flex-start;">
        <span class="prop-label" style="padding-top:2px;">제목</span>
        <span class="prop-value-text" style="white-space:normal; word-break:break-word;">${_esc(title) || '—'}</span>
      </div>
      <div class="prop-row"><span class="prop-label">판정</span><span class="prop-value-text">${_esc(_VERDICT_LABEL[verdict])}</span></div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">체크리스트 (전문)</div>
      ${itemsHtml}
    </div>
    ${feedback.trim() ? `
    <div class="prop-section">
      <div class="prop-section-title">피드백</div>
      <p class="prop-value-text" style="white-space:normal; word-break:break-word;">${_esc(feedback)}</p>
    </div>` : ''}
    <div class="prop-section">
      <p style="margin:0;font-size:11px;color:var(--ui-text-dim);line-height:1.5;">
        체크·피드백 입력은 캔버스에서 직접 하세요(여기는 전문 확인용). 이 블록은 admin QA 전용이며 내보내기(PNG/Figma/HTML)에서 자동 제외됩니다.
      </p>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
}

window.showQAProperties = showQAProperties;
