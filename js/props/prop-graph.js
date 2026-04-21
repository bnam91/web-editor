import { propPanel, state } from '../globals.js';

export function showGraphProperties(block) {
  const chartType    = block.dataset.chartType    || 'bar-v';
  const preset       = block.dataset.preset       || 'default';
  const items        = JSON.parse(block.dataset.items || '[]');
  const chartH       = parseInt(block.dataset.chartHeight)  || 240;
  const labelSize    = parseInt(block.dataset.labelSize)    || 13;
  const barThickness = parseInt(block.dataset.barThickness) || 24;
  const padX         = parseInt(block.dataset.padX)         || 0;
  const barColor     = block.dataset.barColor || '#222222';
  const itemGap      = parseInt(block.dataset.itemGap)      || 24;
  const pctSize      = parseInt(block.dataset.pctSize)      || 60;

  const presets = [
    { id: 'default',  label: '기본' },
    { id: 'dark',     label: '다크' },
    { id: 'minimal',  label: '미니멀' },
    { id: 'colorful', label: '컬러풀' },
  ];

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="5" width="2" height="6" rx="0.5"/>
            <rect x="5" y="2" width="2" height="9" rx="0.5"/>
            <rect x="9" y="4" width="2" height="7" rx="0.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Graph Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">SIZE</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="grb-h-slider" min="80" max="600" step="8" value="${chartH}">
        <input type="number" class="prop-number" id="grb-h-number" min="80" max="600" value="${chartH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">라벨</span>
        <input type="range" class="prop-slider" id="grb-label-slider" min="8" max="28" step="1" value="${labelSize}">
        <input type="number" class="prop-number" id="grb-label-number" min="8" max="28" value="${labelSize}">
      </div>
    </div>
    ${chartType === 'bar-h' ? `
    <div class="prop-section">
      <div class="prop-section-title">BAR SETTINGS</div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="grb-bar-thickness-slider" min="8" max="48" step="2" value="${barThickness}">
        <input type="number" class="prop-number" id="grb-bar-thickness-number" min="8" max="48" value="${barThickness}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="grb-padx-slider" min="0" max="80" step="4" value="${padX}">
        <input type="number" class="prop-number" id="grb-padx-number" min="0" max="80" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">항목 간격</span>
        <input type="range" class="prop-slider" id="grb-item-gap-slider" min="8" max="80" step="4" value="${itemGap}">
        <input type="number" class="prop-number" id="grb-item-gap-number" min="8" max="80" value="${itemGap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">숫자 크기</span>
        <input type="range" class="prop-slider" id="grb-pct-size-slider" min="20" max="120" step="2" value="${pctSize}">
        <input type="number" class="prop-number" id="grb-pct-size-number" min="20" max="120" value="${pctSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">바 색상</span>
        <div class="prop-color-swatch" style="background:${barColor}">
          <input type="color" id="grb-bar-color" value="${barColor}">
        </div>
        <input type="text" class="prop-color-hex" id="grb-bar-color-hex" value="${barColor}" maxlength="7">
      </div>
    </div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">CHART TYPE</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${chartType === 'bar-v' ? 'active' : ''}" id="grb-type-v">세로 막대</button>
        <button class="prop-type-btn ${chartType === 'bar-h' ? 'active' : ''}" id="grb-type-h">가로 막대</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">PRESET</div>
      <div class="prop-preset-group">
        ${presets.map(p => `
          <button class="prop-preset-btn ${preset === p.id ? 'active' : ''}" data-preset-id="${p.id}" id="grb-preset-${p.id}">
            ${p.label}
          </button>`).join('')}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">DATA</div>
      <div class="grb-data-list" id="grb-data-list">
        ${items.map((item, i) => `
          <div class="grb-data-item" data-index="${i}">
            <input type="text" class="grb-data-label-input" value="${item.label}" placeholder="라벨">
            <input type="number" class="grb-data-val-input" value="${item.value}" min="0" max="9999">
            <button class="grb-data-del-btn" data-index="${i}">✕</button>
          </div>`).join('')}
      </div>
      <button class="prop-btn-full" id="grb-add-item">+ 항목 추가</button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 타입 토글
  document.getElementById('grb-type-v').addEventListener('click', () => {
    block.dataset.chartType = 'bar-v';
    window.renderGraph(block);
    showGraphProperties(block);
  });
  document.getElementById('grb-type-h').addEventListener('click', () => {
    block.dataset.chartType = 'bar-h';
    window.renderGraph(block);
    showGraphProperties(block);
  });

  // 프리셋
  presets.forEach(p => {
    document.getElementById('grb-preset-' + p.id).addEventListener('click', () => {
      block.dataset.preset = p.id;
      window.renderGraph(block);  // 차트도 갱신
      showGraphProperties(block);
    });
  });

  // 데이터 편집
  function syncItems() {
    const list = document.getElementById('grb-data-list');
    if (!list) return;
    const newItems = [...list.querySelectorAll('.grb-data-item')].map(row => ({
      label: row.querySelector('.grb-data-label-input').value || '',
      value: parseFloat(row.querySelector('.grb-data-val-input').value) || 0,
    }));
    block.dataset.items = JSON.stringify(newItems);
    window.renderGraph(block);
  }

  const dataList = document.getElementById('grb-data-list');
  dataList.addEventListener('input', syncItems);
  dataList.addEventListener('click', e => {
    const btn = e.target.closest('.grb-data-del-btn');
    if (!btn) return;
    const curItems = JSON.parse(block.dataset.items || '[]');
    if (curItems.length <= 1) return;
    curItems.splice(parseInt(btn.dataset.index), 1);
    block.dataset.items = JSON.stringify(curItems);
    window.renderGraph(block);
    showGraphProperties(block);
  });

  document.getElementById('grb-add-item').addEventListener('click', () => {
    const curItems = JSON.parse(block.dataset.items || '[]');
    curItems.push({ label: '항목 ' + (curItems.length + 1), value: 50 });
    block.dataset.items = JSON.stringify(curItems);
    window.renderGraph(block);
    showGraphProperties(block);
  });

  // 차트 높이
  const hSlider = document.getElementById('grb-h-slider');
  const hNumber = document.getElementById('grb-h-number');
  const applyChartH = v => {
    v = Math.min(600, Math.max(80, v));
    block.dataset.chartHeight = v;
    window.renderGraph(block);
    hSlider.value = v; hNumber.value = v;
  };
  hSlider.addEventListener('input',  () => applyChartH(parseInt(hSlider.value)));
  hNumber.addEventListener('change', () => { applyChartH(parseInt(hNumber.value)); window.pushHistory(); });
  hSlider.addEventListener('change', () => window.pushHistory());

  // 항목 간격 (bar-h 전용)
  const igSlider = document.getElementById('grb-item-gap-slider');
  const igNumber = document.getElementById('grb-item-gap-number');
  if (igSlider) {
    const applyItemGap = v => {
      v = Math.min(80, Math.max(8, v));
      block.dataset.itemGap = v;
      window.renderGraph(block);
      igSlider.value = v; igNumber.value = v;
    };
    igSlider.addEventListener('input',  () => applyItemGap(parseInt(igSlider.value)));
    igNumber.addEventListener('change', () => { applyItemGap(parseInt(igNumber.value)); window.pushHistory(); });
    igSlider.addEventListener('change', () => window.pushHistory());
  }

  // 숫자 크기 (bar-h 전용)
  const psSlider = document.getElementById('grb-pct-size-slider');
  const psNumber = document.getElementById('grb-pct-size-number');
  if (psSlider) {
    const applyPctSize = v => {
      v = Math.min(120, Math.max(20, v));
      block.dataset.pctSize = v;
      window.renderGraph(block);
      psSlider.value = v; psNumber.value = v;
    };
    psSlider.addEventListener('input',  () => applyPctSize(parseInt(psSlider.value)));
    psNumber.addEventListener('change', () => { applyPctSize(parseInt(psNumber.value)); window.pushHistory(); });
    psSlider.addEventListener('change', () => window.pushHistory());
  }

  // 바 두께 (bar-h 전용)
  const btSlider = document.getElementById('grb-bar-thickness-slider');
  const btNumber = document.getElementById('grb-bar-thickness-number');
  if (btSlider) {
    const applyBarThickness = v => {
      v = Math.min(48, Math.max(8, v));
      block.dataset.barThickness = v;
      window.renderGraph(block);
      btSlider.value = v; btNumber.value = v;
    };
    btSlider.addEventListener('input',  () => applyBarThickness(parseInt(btSlider.value)));
    btNumber.addEventListener('change', () => { applyBarThickness(parseInt(btNumber.value)); window.pushHistory(); });
    btSlider.addEventListener('change', () => window.pushHistory());
  }

  // 좌우 패딩 (bar-h 전용)
  const pxSlider = document.getElementById('grb-padx-slider');
  const pxNumber = document.getElementById('grb-padx-number');
  if (pxSlider) {
    const applyPadX = v => {
      v = Math.min(80, Math.max(0, v));
      block.dataset.padX = v;
      window.renderGraph(block);
      pxSlider.value = v; pxNumber.value = v;
    };
    pxSlider.addEventListener('input',  () => applyPadX(parseInt(pxSlider.value)));
    pxNumber.addEventListener('change', () => { applyPadX(parseInt(pxNumber.value)); window.pushHistory(); });
    pxSlider.addEventListener('change', () => window.pushHistory());
  }

  // 바 색상 (bar-h 전용)
  const barColorPicker = document.getElementById('grb-bar-color');
  const barColorHex    = document.getElementById('grb-bar-color-hex');
  if (barColorPicker) {
    const barColorSwatch = barColorPicker.closest('.prop-color-swatch');
    const applyBarColor = hex => {
      block.dataset.barColor = hex;
      window.renderGraph(block);
      barColorPicker.value = hex;
      barColorHex.value = hex;
      if (barColorSwatch) barColorSwatch.style.background = hex;
    };
    barColorPicker.addEventListener('input',  () => applyBarColor(barColorPicker.value));
    barColorPicker.addEventListener('change', () => window.pushHistory());
    barColorHex.addEventListener('change', () => {
      const v = barColorHex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyBarColor(v); window.pushHistory(); }
    });
  }

  // 라벨 크기
  const lSlider = document.getElementById('grb-label-slider');
  const lNumber = document.getElementById('grb-label-number');
  const applyLabelSize = v => {
    v = Math.min(28, Math.max(8, v));
    block.dataset.labelSize = v;
    window.renderGraph(block);
    lSlider.value = v; lNumber.value = v;
  };
  lSlider.addEventListener('input',  () => applyLabelSize(parseInt(lSlider.value)));
  lNumber.addEventListener('change', () => { applyLabelSize(parseInt(lNumber.value)); window.pushHistory(); });
  lSlider.addEventListener('change', () => window.pushHistory());
}


window.showGraphProperties = showGraphProperties;
