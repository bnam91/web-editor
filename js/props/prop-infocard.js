/* ── InfoCard 블록 프로퍼티 패널 — countup(정적 빅넘버)/price/review 3변형 ── */
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const _VARIANTS = [
  { id: 'countup', label: '스탯' },
  { id: 'price',   label: '가격' },
  { id: 'review',  label: '리뷰' },
];
// variant별 텍스트 필드 정의 (data 키 → 라벨). countup의 stats 배열(N개 가로)은 API 영역.
const _FIELDS = {
  countup: [['label', '라벨'], ['value', '값'], ['unit', '단위'], ['caption', '각주']],
  price:   [['label', '라벨'], ['originalPrice', '기존가'], ['price', '할인가'], ['currency', '통화'], ['discountPct', '할인율'], ['extrasText', '뱃지(쉼표구분)']],
  review:  [['stars', '별점(0~5)'], ['author', '작성자'], ['body', '본문'], ['date', '날짜']],
};

export function showInfoCardProperties(block) {
  const variant = block.dataset.variant || 'countup';
  let data = {};
  try { data = JSON.parse(block.dataset.data || '{}'); } catch (_) {}
  const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const accent = block.dataset.accentColor || '#2d6fe8';
  const text = block.dataset.textColor || '#222222';
  const sub = block.dataset.subColor || '#888888';
  const numSize = parseInt(block.dataset.numSize) || 96;

  const fieldVal = (key) => key === 'extrasText'
    ? (Array.isArray(data.extras) ? data.extras.join(', ') : '')
    : (data[key] ?? '');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1.5" y="2" width="9" height="8" rx="1.5"/><path d="M3.5 7.5 H8.5 M3.5 5 H6.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Info Card'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Variant</div>
      <div class="prop-type-group">
        ${_VARIANTS.map(v => `<button class="prop-type-btn ${variant === v.id ? 'active' : ''}" data-variant="${v.id}">${v.label}</button>`).join('')}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Content</div>
      ${(_FIELDS[variant] || []).map(([key, label]) => `
      <div class="prop-row">
        <span class="prop-label">${label}</span>
        <input type="text" class="prop-input ifc-field" data-key="${key}" value="${_esc(fieldVal(key))}" style="flex:1;min-width:0">
      </div>`).join('')}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Style</div>
      ${variant === 'countup' ? `
      <div class="prop-row">
        <span class="prop-label">숫자 크기</span>
        <input type="range" class="prop-slider" id="ifc-num-slider" min="40" max="200" step="4" value="${numSize}">
        <input type="number" class="prop-number" id="ifc-num-number" min="40" max="200" value="${numSize}">
      </div>` : ''}
      <div class="prop-row"><span class="prop-label">강조색</span>${colorFieldHTML({ idPrefix: 'ifc-accent', hex: accent, alpha: parseAlphaFromColor(accent) })}</div>
      <div class="prop-row"><span class="prop-label">본문색</span>${colorFieldHTML({ idPrefix: 'ifc-text', hex: text, alpha: parseAlphaFromColor(text) })}</div>
      <div class="prop-row"><span class="prop-label">보조색</span>${colorFieldHTML({ idPrefix: 'ifc-sub', hex: sub, alpha: parseAlphaFromColor(sub) })}</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  propPanel.querySelectorAll('[data-variant]').forEach(btn => btn.addEventListener('click', () => {
    window.updateInfoCardBlock?.(block.id, { variant: btn.dataset.variant });
    showInfoCardProperties(block);
  }));

  propPanel.querySelectorAll('.ifc-field').forEach(inp => {
    inp.addEventListener('change', () => {
      const key = inp.dataset.key;
      const patch = key === 'extrasText'
        ? { extras: inp.value.split(',').map(s => s.trim()).filter(Boolean) }
        : key === 'stars'
          ? { stars: Math.max(0, Math.min(5, parseInt(inp.value) || 0)) }
          : { [key]: inp.value };
      window.updateInfoCardBlock?.(block.id, { data: patch });
    });
  });

  const nS = document.getElementById('ifc-num-slider');
  const nN = document.getElementById('ifc-num-number');
  if (nS) {
    const applyNum = (v) => {
      v = Math.min(200, Math.max(40, v || 96));
      block.dataset.numSize = String(v);
      window.renderInfoCardBlock?.(block);
      nS.value = v; nN.value = v;
    };
    nS.addEventListener('input', () => applyNum(parseInt(nS.value)));
    nS.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
    nN.addEventListener('change', () => { applyNum(parseInt(nN.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
  }

  const wireC = (prefix, key) => {
    if (!document.getElementById(prefix + '-color')) return;
    wireColorField(prefix, {
      initialAlpha: parseAlphaFromColor(block.dataset[key] || ''),
      onApply: (c) => { block.dataset[key] = c; window.renderInfoCardBlock?.(block); },
      onCommit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); },
    });
  };
  wireC('ifc-accent', 'accentColor');
  wireC('ifc-text', 'textColor');
  wireC('ifc-sub', 'subColor');
}

window.showInfoCardProperties = showInfoCardProperties;
