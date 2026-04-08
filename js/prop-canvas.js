import { propPanel } from './globals.js';

export function showCanvasProperties(block) {
  const w      = parseInt(block.dataset.canvasW)  || 360;
  const h      = parseInt(block.dataset.canvasH)  || 400;
  const bg     = block.dataset.bg     || 'transparent';
  const radius = parseInt(block.dataset.radius)   || 0;
  const layers = JSON.parse(block.dataset.layers  || '[]');

  const layerRows = layers.map((layer, i) => {
    if (layer.type === 'shape') {
      return `
        <div class="cvb-layer-row" data-index="${i}">
          <span class="cvb-layer-icon">▬</span>
          <span class="cvb-layer-name">${layer.label || 'Shape'}</span>
          <div class="prop-color-swatch cvb-layer-swatch" style="background:${layer.color || '#ccc'}">
            <input type="color" class="cvb-color-pick" data-index="${i}" value="${layer.color || '#cccccc'}">
          </div>
        </div>`;
    } else if (layer.type === 'image') {
      const hasSrc = !!layer.src;
      return `
        <div class="cvb-layer-row" data-index="${i}">
          <span class="cvb-layer-icon">🖼</span>
          <span class="cvb-layer-name">${layer.label || 'Image'}</span>
          <button class="cvb-img-upload-btn prop-btn" data-index="${i}" title="이미지 업로드">
            ${hasSrc ? '교체' : '추가'}
          </button>
          ${hasSrc ? `<button class="cvb-img-clear-btn prop-btn" data-index="${i}" title="이미지 제거" style="color:#e55;">✕</button>` : ''}
        </div>`;
    } else if (layer.type === 'text') {
      return `
        <div class="cvb-layer-row" data-index="${i}">
          <span class="cvb-layer-icon">T</span>
          <span class="cvb-layer-name">${(layer.content || '').slice(0, 12).replace(/\n/g, '↵') || 'Text'}</span>
          <div class="prop-color-swatch cvb-layer-swatch" style="background:${layer.color || '#000'}">
            <input type="color" class="cvb-color-pick" data-index="${i}" value="${layer.color || '#000000'}">
          </div>
          <span class="cvb-layer-tag">${layer.fontSize || 16}px</span>
        </div>`;
    }
    return '';
  }).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="2"/>
            <rect x="3" y="3" width="3" height="6" rx="0.5" fill="#888" stroke="none"/>
            <rect x="7" y="3" width="2" height="3" rx="0.5" fill="#888" stroke="none"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Canvas Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>

      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="cvb-w" value="${w}" min="100" max="1200">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="cvb-h" value="${h}" min="40" max="2000">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">배경</div>
      <div class="prop-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${bg === 'transparent' ? '#fff' : bg}">
          <input type="color" id="cvb-bg-pick" value="${bg === 'transparent' ? '#ffffff' : bg}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-bg-hex" value="${bg}" maxlength="20">
      </div>
      <div class="prop-row">
        <span class="prop-label">반경</span>
        <input type="range" class="prop-slider" id="cvb-radius-slider" min="0" max="60" step="1" value="${radius}">
        <input type="number" class="prop-number" id="cvb-radius-number" min="0" max="60" value="${radius}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">카드 간격</div>
      <div class="prop-row">
        <span class="prop-label">Gap</span>
        <input type="range" class="prop-slider" id="cvb-gap-slider" min="0" max="48" step="2" value="${parseInt(block.dataset.cardGap ?? 12)}">
        <input type="number" class="prop-number" id="cvb-gap-number" min="0" max="48" value="${parseInt(block.dataset.cardGap ?? 12)}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="cvb-padx-slider" min="0" max="80" step="4" value="${parseInt(block.dataset.padX ?? 0)}">
        <input type="number" class="prop-number" id="cvb-padx-number" min="0" max="80" value="${parseInt(block.dataset.padX ?? 0)}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">삽입 그리드</div>
      <div class="grid-picker" id="cvb-grid-picker"></div>
      <div class="grid-picker-label" id="cvb-grid-picker-label">—</div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">레이어 (${layers.length})</div>
      <div id="cvb-layer-list">${layerRows || '<div style="color:var(--ui-text-muted);font-size:11px;padding:6px 0">레이어 없음</div>'}</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // ── 그리드 피커 (4×4 매트릭스) ────────────────────────────────────────────
  const picker      = document.getElementById('cvb-grid-picker');
  const pickerLabel = document.getElementById('cvb-grid-picker-label');
  const MAX = 4;
  for (let r = 1; r <= MAX; r++) {
    for (let c = 1; c <= MAX; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-picker-cell';
      cell.dataset.r = r; cell.dataset.c = c;
      picker.appendChild(cell);
    }
  }
  const highlightCells = (maxR, maxC) => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      cl.classList.toggle('active', parseInt(cl.dataset.r) <= maxR && parseInt(cl.dataset.c) <= maxC);
    });
  };
  picker.addEventListener('mouseover', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    highlightCells(r, c);
    pickerLabel.textContent = `${c} × ${r}`;
  });
  picker.addEventListener('mouseleave', () => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => cl.classList.remove('active'));
    pickerLabel.textContent = '—';
  });
  picker.addEventListener('click', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const cols = parseInt(cell.dataset.c);
    const rows = parseInt(cell.dataset.r);
    insertCanvasGrid(block, cols, rows);
  });

  // ── 크기 ──────────────────────────────────────────────────────────────────
  const wInput = document.getElementById('cvb-w');
  const hInput = document.getElementById('cvb-h');
  wInput.addEventListener('change', () => {
    block.dataset.canvasW = wInput.value;
    window.renderCanvas(block);
    window.pushHistory?.();
  });
  hInput.addEventListener('change', () => {
    block.dataset.canvasH = hInput.value;
    window.renderCanvas(block);
    window.pushHistory?.();
  });

  // ── 배경 ──────────────────────────────────────────────────────────────────
  const bgPick = document.getElementById('cvb-bg-pick');
  const bgHex  = document.getElementById('cvb-bg-hex');
  const bgSwatch = bgPick.closest('.prop-color-swatch');
  const applyBg = v => {
    block.dataset.bg = v;
    window.renderCanvas(block);
    bgPick.value = (v === 'transparent' ? '#ffffff' : v);
    bgHex.value  = v;
    if (bgSwatch) bgSwatch.style.background = (v === 'transparent' ? '#fff' : v);
  };
  bgPick.addEventListener('input',  () => applyBg(bgPick.value));
  bgPick.addEventListener('change', () => window.pushHistory?.());
  bgHex.addEventListener('change', () => {
    const v = bgHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v) || v === 'transparent') { applyBg(v); window.pushHistory?.(); }
  });

  // ── 반경 ──────────────────────────────────────────────────────────────────
  const rSlider = document.getElementById('cvb-radius-slider');
  const rNumber = document.getElementById('cvb-radius-number');
  const applyRadius = v => {
    v = Math.min(60, Math.max(0, v));
    block.dataset.radius = v;
    window.renderCanvas(block);
    rSlider.value = v; rNumber.value = v;
  };
  rSlider.addEventListener('input',  () => applyRadius(parseInt(rSlider.value)));
  rNumber.addEventListener('change', () => { applyRadius(parseInt(rNumber.value)); window.pushHistory?.(); });
  rSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 카드 간격 ─────────────────────────────────────────────────────────────
  const gapSlider = document.getElementById('cvb-gap-slider');
  const gapNumber = document.getElementById('cvb-gap-number');
  const applyGap = v => {
    v = Math.min(48, Math.max(0, v));
    block.dataset.cardGap = v;
    window.renderCanvas(block);
    gapSlider.value = v; gapNumber.value = v;
  };
  gapSlider.addEventListener('input',  () => applyGap(parseInt(gapSlider.value)));
  gapNumber.addEventListener('change', () => { applyGap(parseInt(gapNumber.value)); window.pushHistory?.(); });
  gapSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 좌우 패딩 ─────────────────────────────────────────────────────────────
  const padxSlider = document.getElementById('cvb-padx-slider');
  const padxNumber = document.getElementById('cvb-padx-number');
  const applyPadX = v => {
    v = Math.min(80, Math.max(0, v));
    block.dataset.padX = v;
    window.renderCanvas(block);
    padxSlider.value = v; padxNumber.value = v;
  };
  padxSlider.addEventListener('input',  () => applyPadX(parseInt(padxSlider.value)));
  padxNumber.addEventListener('change', () => { applyPadX(parseInt(padxNumber.value)); window.pushHistory?.(); });
  padxSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 이미지 업로드 / 제거 ──────────────────────────────────────────────────
  document.getElementById('cvb-layer-list').addEventListener('click', e => {
    const uploadBtn = e.target.closest('.cvb-img-upload-btn');
    const clearBtn  = e.target.closest('.cvb-img-clear-btn');

    if (uploadBtn) {
      const idx = parseInt(uploadBtn.dataset.index);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const curLayers = JSON.parse(block.dataset.layers || '[]');
          if (curLayers[idx]) {
            curLayers[idx].src = ev.target.result;
            block.dataset.layers = JSON.stringify(curLayers);
            window.renderCanvas(block);
            window.pushHistory?.();
            window.scheduleAutoSave?.();
            window.showCanvasProperties?.(block);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    if (clearBtn) {
      const idx = parseInt(clearBtn.dataset.index);
      const curLayers = JSON.parse(block.dataset.layers || '[]');
      if (curLayers[idx]) {
        delete curLayers[idx].src;
        block.dataset.layers = JSON.stringify(curLayers);
        window.renderCanvas(block);
        window.pushHistory?.();
        window.scheduleAutoSave?.();
        window.showCanvasProperties?.(block);
      }
    }
  });

  // ── 레이어 색상 편집 ───────────────────────────────────────────────────────
  document.getElementById('cvb-layer-list').addEventListener('input', e => {
    const pick = e.target.closest('.cvb-color-pick');
    if (!pick) return;
    const idx = parseInt(pick.dataset.index);
    const curLayers = JSON.parse(block.dataset.layers || '[]');
    if (curLayers[idx]) {
      curLayers[idx].color = pick.value;
      const swatch = pick.closest('.cvb-layer-swatch');
      if (swatch) swatch.style.background = pick.value;
      block.dataset.layers = JSON.stringify(curLayers);
      window.renderCanvas(block);
    }
  });
  document.getElementById('cvb-layer-list').addEventListener('change', e => {
    if (e.target.closest('.cvb-color-pick')) window.pushHistory?.();
  });
}

window.showCanvasProperties = showCanvasProperties;

function insertCanvasGrid(block, cols, rows) {
  block.dataset.gridCols = cols;
  block.dataset.gridRows = rows;
  window.renderCanvas(block);
  window.pushHistory?.();
  window.scheduleAutoSave?.();
}
