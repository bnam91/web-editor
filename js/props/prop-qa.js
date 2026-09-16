/* prop-qa.js — QA 블록(admin 전용) 우측 패널. 조작할 값이 없다(체크/피드백은 캔버스에서 직접) —
   블록 확인용 최소 정보(이름·breadcrumb·ID)만 보여준다. gap-block(prop-gap.js) 과 같은 얼개. */
import { propPanel } from '../globals.js';

export function showQAProperties(block) {
  const ticket = block.dataset.ticket || '';
  const title = block.dataset.title || '';
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="2.5" y="5.5" width="7" height="5" rx="1"/><path d="M4 5.5V3.5a2 2 0 0 1 4 0v2"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'QA Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">QA Ticket</div>
      <div class="prop-row"><span class="prop-label">티켓</span><span class="prop-value-text">${ticket || '—'}</span></div>
      <div class="prop-row"><span class="prop-label">제목</span><span class="prop-value-text">${title || '—'}</span></div>
      <p style="margin:8px 0 0;font-size:11px;color:var(--ui-text-dim);line-height:1.5;">
        체크리스트·피드백은 캔버스에서 직접 클릭/입력하세요. 이 블록은 admin QA 전용이며 내보내기(PNG/Figma/HTML)에서 자동 제외됩니다.
      </p>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
}

window.showQAProperties = showQAProperties;
