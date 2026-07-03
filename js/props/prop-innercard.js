/* ── InnerCard 블록 프로퍼티 패널 — 카드 컨테이너(bg/radius/padding/그림자) + 라인 텍스트 ──
   라인 구조 변경(추가/삭제/이미지)은 updateInnerCardBlock API 영역. */
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

export function showInnerCardProperties(block) {
  let lines = [];
  try { lines = JSON.parse(block.dataset.lines || '[]'); } catch (_) {}
  const bg = block.dataset.bg || '#ffffff';
  const radius = parseInt(block.dataset.radius) || 0;
  const padding = parseInt(block.dataset.padding) || 0;
  const shadow = block.dataset.shadow || 'none';
  const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1.5" y="1.5" width="9" height="9" rx="2"/><path d="M4 5 H8 M4 7 H6.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Inner Card'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Card</div>
      <div class="prop-row"><span class="prop-label">배경색</span>${colorFieldHTML({ idPrefix: 'icd-bg', hex: bg, alpha: parseAlphaFromColor(bg) })}</div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="icd-radius-slider" min="0" max="60" step="2" value="${radius}">
        <input type="number" class="prop-number" id="icd-radius-number" min="0" max="60" value="${radius}">
      </div>
      <div class="prop-row">
        <span class="prop-label">패딩</span>
        <input type="range" class="prop-slider" id="icd-pad-slider" min="0" max="120" step="4" value="${padding}">
        <input type="number" class="prop-number" id="icd-pad-number" min="0" max="120" value="${padding}">
      </div>
      <div class="prop-row">
        <span class="prop-label">그림자</span>
        <div class="prop-type-group">
          <button class="prop-type-btn ${shadow === 'none' ? 'active' : ''}" data-sh="none">없음</button>
          <button class="prop-type-btn ${shadow === 'soft' ? 'active' : ''}" data-sh="soft">소프트</button>
          <button class="prop-type-btn ${shadow === 'strong' ? 'active' : ''}" data-sh="strong">강하게</button>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Content</div>
      ${lines.map((l, li) => (l.type === 'image' || l.type === 'gap') ? '' : `
      <div class="prop-row">
        <span class="prop-label">${_esc(l.type || 'body')}</span>
        <input type="text" class="prop-input icd-line-input" data-line="${li}" value="${_esc(l.text || '')}" style="flex:1;min-width:0">
      </div>`).join('')}
      <div class="prop-row"><span class="prop-label" style="opacity:.6">라인 추가/삭제는 updateInnerCardBlock API</span></div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  if (document.getElementById('icd-bg-color')) {
    wireColorField('icd-bg', {
      initialAlpha: parseAlphaFromColor(bg),
      onApply: (c) => { block.dataset.bg = c; window.renderInnerCardBlock?.(block); },
      onCommit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); },
    });
  }
  const wireNum = (prefix, key, min, max) => {
    const s = document.getElementById(`icd-${prefix}-slider`);
    const n = document.getElementById(`icd-${prefix}-number`);
    if (!s) return;
    const apply = (v) => {
      v = Math.min(max, Math.max(min, v || 0));
      block.dataset[key] = String(v);
      window.renderInnerCardBlock?.(block);
      s.value = v; n.value = v;
    };
    s.addEventListener('input', () => apply(parseInt(s.value)));
    s.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
    n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
  };
  wireNum('radius', 'radius', 0, 60);
  wireNum('pad', 'padding', 0, 120);

  propPanel.querySelectorAll('[data-sh]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.shadow = btn.dataset.sh;
    window.renderInnerCardBlock?.(block);
    window.pushHistory?.(); window.scheduleAutoSave?.();
    showInnerCardProperties(block);
  }));

  propPanel.querySelectorAll('.icd-line-input').forEach(inp => {
    inp.addEventListener('input', () => {
      try {
        const ls = JSON.parse(block.dataset.lines || '[]');
        if (ls[+inp.dataset.line]) { ls[+inp.dataset.line].text = inp.value; block.dataset.lines = JSON.stringify(ls); window.renderInnerCardBlock?.(block); }
      } catch (_) {}
    });
    inp.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  });
}

window.showInnerCardProperties = showInnerCardProperties;
