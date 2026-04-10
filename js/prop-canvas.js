import { propPanel } from './globals.js';

export function showCanvasProperties(block) {
  if (block.dataset.cardMode === 'simple') {
    showSimpleCardProperties(block);
    return;
  }

  // ── 기존 레이어 모드 (Figma import 등 free-placement) ─────────────────────
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

// ── Simple Card Properties ────────────────────────────────────────────────────
function showSimpleCardProperties(block) {
  const w         = parseInt(block.dataset.canvasW)  || 360;
  const h         = parseInt(block.dataset.canvasH)  || 508;
  const radius    = parseInt(block.dataset.radius)   || 12;
  const imgRatio  = parseInt(block.dataset.imgRatio) ?? 65;
  const isTextBgTransparent = block.dataset.textBg === 'transparent';
  const textBgLast = block.dataset.textBgLast || '#f5f5f5';
  const textBg    = isTextBgTransparent ? textBgLast : (block.dataset.textBg || '#f5f5f5');
  const titleColor = block.dataset.titleColor || '#ffffff';
  const descColor  = block.dataset.descColor  || '#ffffffbf';
  const titleSize = parseInt(block.dataset.titleSize) || 20;
  const descSize  = parseInt(block.dataset.descSize)  || 14;
  const textAlign = block.dataset.textAlign || 'left';
  const cards     = JSON.parse(block.dataset.cards   || '[]');
  const gridCols  = parseInt(block.dataset.gridCols) || 1;
  const gridRows  = parseInt(block.dataset.gridRows) || 1;
  const cardGap   = parseInt(block.dataset.cardGap ?? 12);
  const padX      = parseInt(block.dataset.padX ?? 0);

  const cardItemsHtml = cards.map((card, i) => `
    <div class="cvb-card-item" data-card-index="${i}" style="padding:8px 0;border-bottom:1px solid #2a2a2a;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <span style="font-size:10px;color:#666;font-weight:600;flex:1;">카드 ${i + 1}</span>
        <div class="prop-color-swatch cvb-card-bg-swatch" style="width:16px;height:16px;border-radius:3px;flex-shrink:0;background:${card.cellBg || textBg};" title="개별 배경색">
          <input type="color" class="cvb-card-cell-bg" data-card-index="${i}" value="${card.cellBg || textBg}">
        </div>
        <button class="prop-btn cvb-card-img-btn" data-card-index="${i}" style="width:auto;height:auto;font-size:10px;padding:2px 6px;">${card.imgSrc ? '이미지 교체' : '이미지 추가'}</button>
        ${card.imgSrc ? `<button class="prop-btn cvb-card-img-clear" data-card-index="${i}" style="width:auto;height:auto;font-size:10px;padding:2px 4px;color:#e55;" title="이미지 제거">✕</button>` : ''}
      </div>
      <textarea class="cvb-card-title-input" data-card-index="${i}" placeholder="제목 입력..." rows="2" style="width:100%;resize:none;background:#1e1e1e;color:#ddd;border:1px solid #333;border-radius:4px;padding:4px 6px;font-size:11px;box-sizing:border-box;font-family:Pretendard,sans-serif;margin-bottom:4px;">${_escHtml(card.title || '')}</textarea>
      <input type="text" class="cvb-card-desc-input" data-card-index="${i}" placeholder="설명 입력..." value="${_escHtml(card.desc || '')}" style="width:100%;background:#1e1e1e;color:#ddd;border:1px solid #333;border-radius:4px;padding:4px 6px;font-size:11px;box-sizing:border-box;">
    </div>
  `).join('');

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
          <span class="prop-block-name">${block.dataset.layerName || 'Card'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">카드 크기</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="cvb-w" value="${w}" min="100" max="1200">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="cvb-h" value="${h}" min="40" max="2000">
      </div>
      <div class="prop-row">
        <span class="prop-label">이미지 비율</span>
        <input type="range" class="prop-slider" id="cvb-img-ratio-slider" min="20" max="90" step="1" value="${imgRatio}">
        <input type="number" class="prop-number" id="cvb-img-ratio-number" min="20" max="90" value="${imgRatio}">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="cvb-radius-slider" min="0" max="60" step="1" value="${radius}">
        <input type="number" class="prop-number" id="cvb-radius-number" min="0" max="60" value="${radius}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">텍스트 영역</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색 (일괄)</span>
        <div class="prop-color-swatch" style="background:${isTextBgTransparent ? 'transparent' : textBg}; ${isTextBgTransparent ? 'background-image:repeating-conic-gradient(#888 0% 25%,#555 0% 50%);background-size:8px 8px;' : ''}">
          <input type="color" id="cvb-textbg-pick" value="${textBg}" ${isTextBgTransparent ? 'disabled' : ''}>
        </div>
        <input type="text" class="prop-color-hex" id="cvb-textbg-hex" value="${isTextBgTransparent ? 'transparent' : textBg}" maxlength="11" ${isTextBgTransparent ? 'disabled' : ''}>
        <button class="prop-align-btn${isTextBgTransparent ? ' active' : ''}" id="cvb-textbg-transparent-btn" style="width:36px;flex-shrink:0;">투명</button>
      </div>
      <div class="prop-color-row">
        <span class="prop-label">제목 색</span>
        <div class="prop-color-swatch" style="background:${titleColor}">
          <input type="color" id="cvb-title-color-pick" value="${titleColor.startsWith('rgba') ? '#ffffff' : titleColor}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-title-color-hex" value="${titleColor}" maxlength="7">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">설명 색</span>
        <div class="prop-color-swatch" style="background:${descColor}">
          <input type="color" id="cvb-desc-color-pick" value="${descColor.startsWith('rgba') ? '#ffffff' : descColor}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-desc-color-hex" value="${descColor}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">제목 크기</span>
        <input type="range" class="prop-slider" id="cvb-title-slider" min="12" max="80" step="1" value="${titleSize}">
        <input type="number" class="prop-number" id="cvb-title-number" min="12" max="80" value="${titleSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">설명 크기</span>
        <input type="range" class="prop-slider" id="cvb-desc-slider" min="10" max="40" step="1" value="${descSize}">
        <input type="number" class="prop-number" id="cvb-desc-number" min="10" max="40" value="${descSize}">
      </div>
      <div class="prop-section-title" style="margin-top:6px;">텍스트 정렬</div>
      <div class="prop-align-group" id="cvb-align-group">
        <button class="prop-align-btn${textAlign==='left'?' active':''}"   data-align="left">←</button>
        <button class="prop-align-btn${textAlign==='center'?' active':''}" data-align="center">↔</button>
        <button class="prop-align-btn${textAlign==='right'?' active':''}"  data-align="right">→</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">카드 간격</div>
      <div class="prop-row">
        <span class="prop-label">Gap</span>
        <input type="range" class="prop-slider" id="cvb-gap-slider" min="0" max="48" step="2" value="${cardGap}">
        <input type="number" class="prop-number" id="cvb-gap-number" min="0" max="48" value="${cardGap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="cvb-padx-slider" min="0" max="80" step="4" value="${padX}">
        <input type="number" class="prop-number" id="cvb-padx-number" min="0" max="80" value="${padX}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">카드 그리드 (${gridCols}×${gridRows})</div>
      <div class="grid-picker" id="cvb-grid-picker"></div>
      <div class="grid-picker-label" id="cvb-grid-picker-label">—</div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">카드 항목 (${cards.length}개)</div>
      <div id="cvb-card-items">${cardItemsHtml}</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // ── Grid picker ─────────────────────────────────────────────────────────────
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
  picker.addEventListener('mouseover', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      cl.classList.toggle('active', parseInt(cl.dataset.r) <= r && parseInt(cl.dataset.c) <= c);
    });
    pickerLabel.textContent = `${c} × ${r}`;
  });
  picker.addEventListener('mouseleave', () => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => cl.classList.remove('active'));
    pickerLabel.textContent = '—';
  });
  picker.addEventListener('click', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const cols  = parseInt(cell.dataset.c);
    const rows  = parseInt(cell.dataset.r);
    const total = cols * rows;
    const curCards = JSON.parse(block.dataset.cards || '[]');
    while (curCards.length < total) curCards.push({ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' });
    while (curCards.length > total) curCards.pop();
    block.dataset.cards    = JSON.stringify(curCards);
    block.dataset.gridCols = cols;
    block.dataset.gridRows = rows;
    window.renderCanvas(block);
    window.pushHistory?.();
    window.scheduleAutoSave?.();
    showSimpleCardProperties(block);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getCards = () => JSON.parse(block.dataset.cards || '[]');
  const setCards = (arr, skipHistory) => {
    block.dataset.cards = JSON.stringify(arr);
    window.renderCanvas(block);
    window.scheduleAutoSave?.();
    if (!skipHistory) window.pushHistory?.();
  };

  // ── 카드 크기 ────────────────────────────────────────────────────────────────
  const wInput = document.getElementById('cvb-w');
  const hInput = document.getElementById('cvb-h');
  wInput.addEventListener('change', () => { block.dataset.canvasW = wInput.value;  window.renderCanvas(block); window.pushHistory?.(); });
  hInput.addEventListener('change', () => { block.dataset.canvasH = hInput.value;  window.renderCanvas(block); window.pushHistory?.(); });

  // ── 이미지 비율 ──────────────────────────────────────────────────────────────
  const ratioSlider = document.getElementById('cvb-img-ratio-slider');
  const ratioNumber = document.getElementById('cvb-img-ratio-number');
  const applyRatio = v => {
    v = Math.min(90, Math.max(20, v));
    block.dataset.imgRatio = v;
    window.renderCanvas(block);
    ratioSlider.value = v; ratioNumber.value = v;
  };
  ratioSlider.addEventListener('input',  () => applyRatio(parseInt(ratioSlider.value)));
  ratioNumber.addEventListener('change', () => { applyRatio(parseInt(ratioNumber.value)); window.pushHistory?.(); });
  ratioSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 모서리 ───────────────────────────────────────────────────────────────────
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

  // ── 텍스트 배경색 (일괄) ─────────────────────────────────────────────────────
  const textBgPick  = document.getElementById('cvb-textbg-pick');
  const textBgHex   = document.getElementById('cvb-textbg-hex');
  const textBgSwatch = textBgPick.closest('.prop-color-swatch');
  const textBgTransBtn = document.getElementById('cvb-textbg-transparent-btn');

  const setTextBgTransparentUI = on => {
    textBgTransBtn.classList.toggle('active', on);
    textBgPick.disabled = on;
    textBgHex.disabled  = on;
    if (on) {
      textBgHex.value = 'transparent';
      textBgSwatch.style.background = '';
      textBgSwatch.style.backgroundImage = 'repeating-conic-gradient(#888 0% 25%,#555 0% 50%)';
      textBgSwatch.style.backgroundSize = '8px 8px';
    } else {
      const v = block.dataset.textBgLast || '#f5f5f5';
      textBgHex.value = v;
      textBgPick.value = v;
      textBgSwatch.style.backgroundImage = '';
      textBgSwatch.style.background = v;
    }
  };

  const applyTextBg = v => {
    block.dataset.textBgLast = v;
    block.dataset.textBg = v;
    window.renderCanvas(block);
    textBgPick.value = v;
    textBgHex.value  = v;
    if (textBgSwatch) textBgSwatch.style.background = v;
  };

  textBgTransBtn.addEventListener('click', () => {
    const on = !textBgTransBtn.classList.contains('active');
    if (on) {
      block.dataset.textBgLast = block.dataset.textBg || '#f5f5f5';
      block.dataset.textBg = 'transparent';
    } else {
      block.dataset.textBg = block.dataset.textBgLast || '#f5f5f5';
    }
    window.renderCanvas(block);
    window.pushHistory?.();
    setTextBgTransparentUI(on);
  });

  textBgPick.addEventListener('input',  () => applyTextBg(textBgPick.value));
  textBgPick.addEventListener('change', () => window.pushHistory?.());
  textBgHex.addEventListener('change',  () => {
    const v = textBgHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyTextBg(v); window.pushHistory?.(); }
  });

  // ── 제목/설명 텍스트 색상 ─────────────────────────────────────────────────────
  const bindTextColor = (pickId, hexId, datasetKey) => {
    const pick  = document.getElementById(pickId);
    const hex   = document.getElementById(hexId);
    const swatch = pick.closest('.prop-color-swatch');
    const apply = v => {
      block.dataset[datasetKey] = v;
      window.renderCanvas(block);
      pick.value = v;
      hex.value  = v;
      if (swatch) swatch.style.background = v;
    };
    pick.addEventListener('input',  () => apply(pick.value));
    pick.addEventListener('change', () => window.pushHistory?.());
    hex.addEventListener('change',  () => {
      const v = hex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { apply(v); window.pushHistory?.(); }
    });
  };
  bindTextColor('cvb-title-color-pick', 'cvb-title-color-hex', 'titleColor');
  bindTextColor('cvb-desc-color-pick',  'cvb-desc-color-hex',  'descColor');

  // ── 제목 크기 ────────────────────────────────────────────────────────────────
  const titleSlider = document.getElementById('cvb-title-slider');
  const titleNumber = document.getElementById('cvb-title-number');
  const applyTitleSize = v => {
    v = Math.min(80, Math.max(12, v));
    block.dataset.titleSize = v;
    window.renderCanvas(block);
    titleSlider.value = v; titleNumber.value = v;
  };
  titleSlider.addEventListener('input',  () => applyTitleSize(parseInt(titleSlider.value)));
  titleNumber.addEventListener('change', () => { applyTitleSize(parseInt(titleNumber.value)); window.pushHistory?.(); });
  titleSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 설명 크기 ────────────────────────────────────────────────────────────────
  const descSlider = document.getElementById('cvb-desc-slider');
  const descNumber = document.getElementById('cvb-desc-number');
  const applyDescSize = v => {
    v = Math.min(40, Math.max(10, v));
    block.dataset.descSize = v;
    window.renderCanvas(block);
    descSlider.value = v; descNumber.value = v;
  };
  descSlider.addEventListener('input',  () => applyDescSize(parseInt(descSlider.value)));
  descNumber.addEventListener('change', () => { applyDescSize(parseInt(descNumber.value)); window.pushHistory?.(); });
  descSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 텍스트 정렬 ──────────────────────────────────────────────────────────────
  propPanel.querySelectorAll('#cvb-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.align;
      block.dataset.textAlign = a;
      window.renderCanvas(block);
      window.pushHistory?.();
      propPanel.querySelectorAll('#cvb-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
    });
  });

  // ── Gap / PadX ───────────────────────────────────────────────────────────────
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

  // ── 카드별 항목 편집 ─────────────────────────────────────────────────────────
  const cardItemsEl = document.getElementById('cvb-card-items');

  // 텍스트 입력 (실시간, 히스토리 없음)
  cardItemsEl.addEventListener('input', e => {
    const titleInput = e.target.closest('.cvb-card-title-input');
    const descInput  = e.target.closest('.cvb-card-desc-input');
    const bgPick     = e.target.closest('.cvb-card-cell-bg');

    if (titleInput) {
      const idx = parseInt(titleInput.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) { arr[idx].title = titleInput.value; setCards(arr, true); }
    }
    if (descInput) {
      const idx = parseInt(descInput.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) { arr[idx].desc = descInput.value; setCards(arr, true); }
    }
    if (bgPick) {
      const idx = parseInt(bgPick.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        arr[idx].cellBg = bgPick.value;
        const swatch = bgPick.closest('.cvb-card-bg-swatch');
        if (swatch) swatch.style.background = bgPick.value;
        setCards(arr, true);
      }
    }
  });

  // change → pushHistory
  cardItemsEl.addEventListener('change', e => {
    if (e.target.closest('.cvb-card-title-input, .cvb-card-desc-input, .cvb-card-cell-bg')) {
      window.pushHistory?.();
    }
  });

  // 이미지 업로드 / 제거 버튼
  cardItemsEl.addEventListener('click', e => {
    const imgBtn   = e.target.closest('.cvb-card-img-btn');
    const clearBtn = e.target.closest('.cvb-card-img-clear');

    if (imgBtn) {
      const idx = parseInt(imgBtn.dataset.cardIndex);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const arr = getCards();
          if (arr[idx] !== undefined) {
            arr[idx].imgSrc = ev.target.result;
            setCards(arr);
            showSimpleCardProperties(block);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    if (clearBtn) {
      const idx = parseInt(clearBtn.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        arr[idx].imgSrc = '';
        setCards(arr);
        showSimpleCardProperties(block);
      }
    }
  });
}

// HTML 특수문자 이스케이프 (textarea/input value 안전 삽입)
function _escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.showCanvasProperties = showCanvasProperties;

function insertCanvasGrid(block, cols, rows) {
  // Simple card mode: cards 배열 크기도 함께 조정
  if (block.dataset.cardMode === 'simple') {
    const total    = cols * rows;
    const curCards = JSON.parse(block.dataset.cards || '[]');
    while (curCards.length < total) curCards.push({ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' });
    while (curCards.length > total) curCards.pop();
    block.dataset.cards = JSON.stringify(curCards);
  }
  block.dataset.gridCols = cols;
  block.dataset.gridRows = rows;
  window.renderCanvas(block);
  window.pushHistory?.();
  window.scheduleAutoSave?.();
}
