// prop-comparison.js — 비교 블록 우측 프로퍼티 패널 (prop-banner02 패턴)
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';

const _rows = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };

export function showComparisonProperties(block) {
  const d = block.dataset;
  const featured = d.featured === 'left' ? 'left' : 'right';

  const colSection = (side, labelTxt) => {
    const rows = _rows(d[side + 'Rows']);
    const rowInputs = rows.map((t, i) => `
      <div class="prop-row" style="gap:4px;">
        <input type="text" class="prop-input cmp-row-input" data-side="${side}" data-idx="${i}" value="${(t || '').replace(/"/g, '&quot;')}" style="flex:1;">
        <button class="prop-btn cmp-row-del" data-side="${side}" data-idx="${i}" style="width:28px;color:#e06c6c;">×</button>
      </div>`).join('');
    return `
      <div class="prop-section">
        <div class="prop-section-title">${labelTxt}${featured === side ? ' ★' : ''}</div>
        <textarea class="prop-textarea" id="cmp-${side}Title" rows="1" style="width:100%;box-sizing:border-box;">${(d[side + 'Title'] || '').replace(/</g, '&lt;')}</textarea>
        <div class="prop-color-row"><span class="prop-label">배경</span>${colorFieldHTML({ idPrefix: 'cmp-' + side + 'Bg', hex: d[side + 'Bg'] || '#ffffff' })}</div>
        <div class="prop-color-row"><span class="prop-label">텍스트</span>${colorFieldHTML({ idPrefix: 'cmp-' + side + 'Text', hex: d[side + 'Text'] || '#1a1a1a' })}</div>
        <div style="margin-top:6px;">${rowInputs}</div>
        <button class="prop-btn cmp-row-add" data-side="${side}" style="width:100%;margin-top:4px;">+ 행 추가</button>
      </div>`;
  };

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-info">
          <span class="prop-block-name">${d.layerName || 'Comparison'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="복사" onclick="_copyToClipboard && _copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">강조 칼럼 (떠보이는 쪽)</div>
      <div class="prop-align-group" id="cmp-feat-group" style="display:flex;gap:4px;">
        <button class="prop-align-btn${featured === 'left' ? ' active' : ''}" data-feat="left" style="flex:1;">왼쪽</button>
        <button class="prop-align-btn${featured === 'right' ? ' active' : ''}" data-feat="right" style="flex:1;">오른쪽</button>
      </div>
      <div class="prop-row"><span class="prop-label">띄움</span>
        <input type="range" class="prop-slider" id="cmp-elev" min="0" max="120" step="2" value="${parseInt(d.elevation) || 40}">
        <input type="number" class="prop-number" id="cmp-elev-num" min="0" max="120" value="${parseInt(d.elevation) || 40}"></div>
      <div class="prop-row"><span class="prop-label">겹침</span>
        <input type="range" class="prop-slider" id="cmp-ovl" min="0" max="80" step="2" value="${parseInt(d.overlap) || 32}">
        <input type="number" class="prop-number" id="cmp-ovl-num" min="0" max="80" value="${parseInt(d.overlap) || 32}"></div>
      <div class="prop-row"><span class="prop-label">반경</span>
        <input type="range" class="prop-slider" id="cmp-rad" min="0" max="40" step="1" value="${parseInt(d.radius) || 20}">
        <input type="number" class="prop-number" id="cmp-rad-num" min="0" max="40" value="${parseInt(d.radius) || 20}"></div>
    </div>
    ${colSection('left', '왼쪽 칼럼')}
    ${colSection('right', '오른쪽 칼럼')}`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  const rerender = () => window.renderComparison?.(block);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };

  propPanel.querySelectorAll('#cmp-feat-group [data-feat]').forEach(b =>
    b.addEventListener('click', () => { block.dataset.featured = b.dataset.feat; rerender(); commit(); showComparisonProperties(block); }));

  const pair = (sl, nm, dk, min, max) => {
    const s = propPanel.querySelector('#' + sl), n = propPanel.querySelector('#' + nm);
    const set = v => { v = Math.max(min, Math.min(max, parseInt(v) || 0)); block.dataset[dk] = v; s.value = v; n.value = v; rerender(); };
    s?.addEventListener('input', () => set(s.value)); n?.addEventListener('input', () => set(n.value));
    s?.addEventListener('change', commit); n?.addEventListener('change', commit);
  };
  pair('cmp-elev', 'cmp-elev-num', 'elevation', 0, 120);
  pair('cmp-ovl', 'cmp-ovl-num', 'overlap', 0, 80);
  pair('cmp-rad', 'cmp-rad-num', 'radius', 0, 40);

  ['left', 'right'].forEach(side => {
    const ta = propPanel.querySelector('#cmp-' + side + 'Title');
    ta?.addEventListener('input', () => { block.dataset[side + 'Title'] = ta.value; rerender(); });
    ta?.addEventListener('change', commit);
    wireColorField('cmp-' + side + 'Bg', { onApply: c => { block.dataset[side + 'Bg'] = c; rerender(); }, onCommit: commit });
    wireColorField('cmp-' + side + 'Text', { onApply: c => { block.dataset[side + 'Text'] = c; rerender(); }, onCommit: commit });
  });

  propPanel.querySelectorAll('.cmp-row-input').forEach(inp =>
    inp.addEventListener('input', () => {
      const arr = _rows(block.dataset[inp.dataset.side + 'Rows']);
      arr[+inp.dataset.idx] = inp.value; block.dataset[inp.dataset.side + 'Rows'] = JSON.stringify(arr); rerender();
    }));
  propPanel.querySelectorAll('.cmp-row-input').forEach(inp => inp.addEventListener('change', commit));
  propPanel.querySelectorAll('.cmp-row-del').forEach(btn =>
    btn.addEventListener('click', () => {
      const arr = _rows(block.dataset[btn.dataset.side + 'Rows']); arr.splice(+btn.dataset.idx, 1);
      block.dataset[btn.dataset.side + 'Rows'] = JSON.stringify(arr); rerender(); commit(); showComparisonProperties(block);
    }));
  propPanel.querySelectorAll('.cmp-row-add').forEach(btn =>
    btn.addEventListener('click', () => {
      const arr = _rows(block.dataset[btn.dataset.side + 'Rows']); arr.push('내용 입력');
      block.dataset[btn.dataset.side + 'Rows'] = JSON.stringify(arr); rerender(); commit(); showComparisonProperties(block);
    }));
}

window.showComparisonProperties = showComparisonProperties;
