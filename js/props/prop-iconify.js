import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

export function showIconifyProperties(block) {
  const iconName = block.dataset.iconName || '';
  const size     = parseInt(block.dataset.size)     || 64;
  const rotation = parseInt(block.dataset.rotation) || 0;
  const color    = block.dataset.iconColor || '#000000';
  const colorAlpha = parseAlphaFromColor(color);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Icon'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Icon</div>
      <div class="prop-row" style="gap:6px;">
        <span class="prop-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#888;" title="${iconName}">${iconName || '(없음)'}</span>
        <button class="prop-btn" id="icn-replace-btn" title="Iconify에서 교체"
          style="width:auto;height:auto;padding:3px 8px;font-size:10px;">교체</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">Size</span>
        <input type="range"  class="prop-slider" id="icn-size-slider" min="16" max="512" step="8"  value="${size}">
        <input type="number" class="prop-number" id="icn-size-number" min="16" max="512" value="${size}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-color-row">
        <span class="prop-label">Color</span>
        ${colorFieldHTML({ idPrefix: 'icn-color', hex: color, alpha: colorAlpha })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-align-group" id="icn-rotation-group">
        <button class="prop-align-btn${rotation ===   0 ? ' active' : ''}" data-deg="0">0°</button>
        <button class="prop-align-btn${rotation ===  90 ? ' active' : ''}" data-deg="90">90°</button>
        <button class="prop-align-btn${rotation === 180 ? ' active' : ''}" data-deg="180">180°</button>
        <button class="prop-align-btn${rotation === 270 ? ' active' : ''}" data-deg="270">270°</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">내 SVG 프리셋</div>
      <div class="prop-row" style="gap:6px;">
        <span class="prop-label">카테고리</span>
        <select id="icn-preset-cat" class="prop-number" style="flex:1;width:auto;text-align:left;padding:0 6px;">
          <option value="">로딩중...</option>
        </select>
      </div>
      <div id="icn-preset-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin-top:6px;min-height:24px;"></div>
      <div class="prop-row" style="margin-top:6px;gap:6px;">
        <button class="prop-btn" id="icn-preset-save-btn" title="현재 SVG를 내 라이브러리에 저장" style="flex:1;height:24px;padding:0 8px;font-size:11px;">💾 라이브러리에 저장</button>
      </div>
    </div>

    <div class="prop-section">
      <button class="prop-btn-full" id="icn-open-modal-btn">Iconify에서 교체</button>
    </div>
  `;

  // ── SVG 프리셋 라이브러리 ────────────────────────────────────────────
  const presetCatSelect = propPanel.querySelector('#icn-preset-cat');
  const presetGrid      = propPanel.querySelector('#icn-preset-grid');
  let _presetCategories = [];

  const renderPresetGrid = (catName) => {
    presetGrid.innerHTML = '';
    const cat = _presetCategories.find(c => c.name === catName);
    if (!cat) return;
    cat.items.forEach(it => {
      const cell = document.createElement('button');
      cell.className = 'prop-btn';
      cell.title = `${catName} / ${it.name} — 클릭하면 적용`;
      cell.style.cssText = 'aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:4px;background:var(--ui-bg-input);border:1px solid transparent;border-radius:4px;cursor:pointer;overflow:hidden;';
      cell.dataset.cat = catName;
      cell.dataset.file = it.file;
      // 비동기 미리보기 로드
      window.electronAPI?.svgPresets?.read({ category: catName, file: it.file }).then(res => {
        if (res?.ok && res.svg) {
          cell.innerHTML = res.svg;
          const svg = cell.querySelector('svg');
          if (svg) { svg.setAttribute('width', '28'); svg.setAttribute('height', '28'); svg.style.color = block.dataset.iconColor || '#222'; }
        }
      });
      cell.addEventListener('click', async () => {
        const res = await window.electronAPI?.svgPresets?.read({ category: catName, file: it.file });
        if (!res?.ok) { window.showToast?.('SVG 로드 실패: ' + (res?.error || '')); return; }
        // 블록에 적용
        const svg = res.svg.trim();
        // 기존 SVG 교체
        const existingSvg = block.querySelector('svg');
        if (existingSvg) existingSvg.remove();
        block.insertAdjacentHTML('beforeend', svg);
        const newSvg = block.querySelector('svg');
        if (newSvg) {
          const sz = parseInt(block.dataset.size) || 64;
          newSvg.setAttribute('width', sz);
          newSvg.setAttribute('height', sz);
        }
        block.dataset.iconName = `preset:${catName}/${it.name}`;
        block.dataset.iconSvg = svg;
        if (block.dataset.iconColor) block.style.color = block.dataset.iconColor;
        window.pushHistory?.('SVG 프리셋 적용');
        window.scheduleAutoSave?.();
      });
      presetGrid.appendChild(cell);
    });
  };

  const loadPresets = async () => {
    const res = await window.electronAPI?.svgPresets?.list();
    if (!res?.ok) {
      presetCatSelect.innerHTML = '<option value="">(불러오기 실패)</option>';
      return;
    }
    _presetCategories = res.categories || [];
    presetCatSelect.innerHTML = _presetCategories.length
      ? _presetCategories.map(c => `<option value="${c.name}">${c.name} (${c.items.length})</option>`).join('')
      : '<option value="">(폴더 비어있음 — Application Support/Goya Design Editor/svg-presets/ 에 폴더+SVG 추가)</option>';
    if (_presetCategories.length > 0) {
      presetCatSelect.value = _presetCategories[0].name;
      renderPresetGrid(_presetCategories[0].name);
    }
  };

  presetCatSelect.addEventListener('change', () => renderPresetGrid(presetCatSelect.value));
  loadPresets();

  // 현재 SVG → 라이브러리에 저장
  propPanel.querySelector('#icn-preset-save-btn').addEventListener('click', async () => {
    const svg = block.dataset.iconSvg || block.querySelector('svg')?.outerHTML;
    if (!svg) { window.showToast?.('저장할 SVG 없음'); return; }
    const cat = (window.prompt && window.prompt('카테고리 이름:', _presetCategories[0]?.name || '내것')) || '';
    if (!cat.trim()) return;
    const name = (window.prompt && window.prompt('SVG 이름:', 'my-icon')) || 'my-icon';
    if (!name.trim()) return;
    const res = await window.electronAPI?.svgPresets?.save({ category: cat.trim(), name: name.trim(), svg });
    if (res?.ok) {
      window.showToast?.(`저장: ${res.category}/${res.file}`);
      await loadPresets();
    } else {
      window.showToast?.('저장 실패: ' + (res?.error || ''));
    }
  });

  // 크기
  const sSlider = propPanel.querySelector('#icn-size-slider');
  const sNumber = propPanel.querySelector('#icn-size-number');
  const applySize = v => {
    v = Math.min(512, Math.max(16, v));
    block.dataset.size = v;
    block.style.width  = v + 'px';
    block.style.height = v + 'px';
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', v); svg.setAttribute('height', v); }
    const img = block.querySelector('img');
    if (img) { img.width = v; img.height = v; }
    sSlider.value = v; sNumber.value = v;
  };
  sSlider.addEventListener('mousedown', () => window.pushHistory?.());
  sSlider.addEventListener('input',  () => applySize(parseInt(sSlider.value)));
  sNumber.addEventListener('change', () => { window.pushHistory?.(); applySize(parseInt(sNumber.value)); });
  sSlider.addEventListener('change', () => window.pushHistory?.());

  // 색상 (SVG currentColor 활용)
  wireColorField('icn-color', {
    initialAlpha: colorAlpha,
    onApply: (c) => {
      block.dataset.iconColor = c;
      block.style.color = c;
    },
    onCommit: () => window.pushHistory?.(),
  });

  // 회전
  const applyRotation = deg => {
    block.dataset.rotation = deg;
    block.style.transform  = deg > 0 ? `rotate(${deg}deg)` : '';
    propPanel.querySelectorAll('#icn-rotation-group .prop-align-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.deg) === deg);
    });
    window.pushHistory?.();
  };
  propPanel.querySelectorAll('#icn-rotation-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyRotation(parseInt(btn.dataset.deg)));
  });

  // 교체 버튼
  const openModal = () => window.openIconifyModal?.();
  propPanel.querySelector('#icn-replace-btn').addEventListener('click', openModal);
  propPanel.querySelector('#icn-open-modal-btn').addEventListener('click', openModal);

  // 초기 색상 적용
  if (block.dataset.iconColor) block.style.color = block.dataset.iconColor;
}

window.showIconifyProperties = showIconifyProperties;
