/* ── Duo(다단) 블록 프로퍼티 패널 ──
   구조(컬럼/라인 추가·삭제)는 CDP/updateDuoBlock 영역 — 패널은 텍스트·간격·정렬만 다룬다. */
import { propPanel } from '../globals.js';

export function showDuoProperties(block) {
  let cols = [];
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) {}
  const gap = parseInt(block.dataset.gap) || 24;
  const valign = block.dataset.valign || 'top';

  const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="2" width="4.5" height="8" rx="1"/><rect x="6.5" y="2" width="4.5" height="8" rx="1"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Duo Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="duo-gap-slider" min="0" max="120" step="4" value="${gap}">
        <input type="number" class="prop-number" id="duo-gap-number" min="0" max="120" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">세로 정렬</span>
        <div class="prop-type-group">
          <button class="prop-type-btn ${valign === 'top' ? 'active' : ''}" data-va="top">상단</button>
          <button class="prop-type-btn ${valign === 'middle' ? 'active' : ''}" data-va="middle">중앙</button>
          <button class="prop-type-btn ${valign === 'bottom' ? 'active' : ''}" data-va="bottom">하단</button>
        </div>
      </div>
    </div>
    ${cols.map((col, ci) => `
    <div class="prop-section">
      <div class="prop-section-title">Column ${ci + 1}</div>
      ${(Array.isArray(col.lines) ? col.lines : []).map((l, li) =>
        (l.type === 'image' || l.type === 'gap') ? '' : `
      <div class="prop-row">
        <span class="prop-label">${_esc(l.type || 'body')}</span>
        <input type="text" class="prop-input duo-line-input" data-col="${ci}" data-line="${li}" value="${_esc(l.text || '')}" style="flex:1;min-width:0">
      </div>`).join('')}
    </div>`).join('')}
    <div class="prop-section">
      <div class="prop-row"><span class="prop-label" style="opacity:.6">컬럼/라인 구조 변경은 updateDuoBlock API 사용</span></div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const gapS = document.getElementById('duo-gap-slider');
  const gapN = document.getElementById('duo-gap-number');
  const applyGap = (v) => {
    v = Math.min(120, Math.max(0, v || 0));
    block.dataset.gap = String(v);
    window.renderDuoBlock?.(block);
    gapS.value = v; gapN.value = v;
  };
  gapS.addEventListener('input', () => applyGap(parseInt(gapS.value)));
  gapS.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  gapN.addEventListener('change', () => { applyGap(parseInt(gapN.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });

  propPanel.querySelectorAll('[data-va]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.valign = btn.dataset.va;
    window.renderDuoBlock?.(block);
    window.pushHistory?.(); window.scheduleAutoSave?.();
    showDuoProperties(block);
  }));

  propPanel.querySelectorAll('.duo-line-input').forEach(inp => {
    inp.addEventListener('input', () => {
      try {
        const c = JSON.parse(block.dataset.cols || '[]');
        const l = c[+inp.dataset.col]?.lines?.[+inp.dataset.line];
        if (l) { l.text = inp.value; block.dataset.cols = JSON.stringify(c); window.renderDuoBlock?.(block); }
      } catch (_) {}
    });
    inp.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  });
}

window.showDuoProperties = showDuoProperties;
