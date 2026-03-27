import { propPanel, state } from './globals.js';

export function showGraphProperties(block) {
  const chartType  = block.dataset.chartType  || 'bar-v';
  const preset     = block.dataset.preset     || 'default';
  const items      = JSON.parse(block.dataset.items || '[]');
  const chartH     = parseInt(block.dataset.chartHeight) || 240;
  const labelSize  = parseInt(block.dataset.labelSize)   || 13;

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
          <span class="prop-block-name">Graph Block</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">크기</div>
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
    <div class="prop-section">
      <div class="prop-section-title">차트 타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${chartType === 'bar-v' ? 'active' : ''}" id="grb-type-v">세로 막대</button>
        <button class="prop-type-btn ${chartType === 'bar-h' ? 'active' : ''}" id="grb-type-h">가로 막대</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">프리셋</div>
      <div class="prop-preset-group">
        ${presets.map(p => `
          <button class="prop-preset-btn ${preset === p.id ? 'active' : ''}" data-preset-id="${p.id}" id="grb-preset-${p.id}">
            ${p.label}
          </button>`).join('')}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">데이터</div>
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
