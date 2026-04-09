/* ═══════════════════════════════════
   INSPECTOR PANEL
═══════════════════════════════════ */

// FIX: buildLayerPanel() 마지막에 Inspector 탭 활성 시 자동 갱신 추가 (layer-panel.js)
// FIX: step-block, canvas-block, shape-block 카운트 추가

function renderInspectorPanel() {
  const panel = document.getElementById('inspector-stats-body');
  if (!panel) return;

  // ── 데이터 수집 ──
  const sections   = [...document.querySelectorAll('.section-block')];
  const textBlocks = [...document.querySelectorAll('.text-block')];
  const assetBlocks= [...document.querySelectorAll('.asset-block')];
  const gapBlocks  = [...document.querySelectorAll('.gap-block')];
  const iconBlocks = [...document.querySelectorAll('.icon-circle-block')];
  const tableBlocks= [...document.querySelectorAll('.table-block')];
  const labelGroupBlocks  = [...document.querySelectorAll('.label-group-block')];
  const cardBlocks        = [...document.querySelectorAll('.card-block')];
  const graphBlocks       = [...document.querySelectorAll('.graph-block')];
  const dividerBlocks     = [...document.querySelectorAll('.divider-block')];
  const iconTextBlocks    = [...document.querySelectorAll('.icon-text-block')];
  const stepBlocks        = [...document.querySelectorAll('.step-block')];
  const canvasBlocks      = [...document.querySelectorAll('.canvas-block')];
  const shapeBlocks       = [...document.querySelectorAll('.shape-block')];

  // 텍스트 variant 카운트
  const variantCount = { heading: 0, subheading: 0, body: 0, caption: 0, label: 0 };
  textBlocks.forEach(tb => {
    const v = tb.dataset.type;
    if (v in variantCount) variantCount[v]++;
  });

  // ── 컬러 수집 ──
  function normalizeColor(raw) {
    if (!raw) return null;
    raw = raw.trim();
    if (!raw || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return null;
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^rgb/.test(raw)) {
      const m = raw.match(/\d+/g);
      if (!m || m.length < 3) return null;
      return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
    return null;
  }

  const colorSet = new Set();

  sections.forEach(sec => {
    // 섹션 배경색
    const bgRaw = sec.style.backgroundColor || sec.style.background;
    const bgHex = normalizeColor(bgRaw);
    if (bgHex) colorSet.add(bgHex);

    // 텍스트 블록 색상
    sec.querySelectorAll('.text-block').forEach(tb => {
      const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-label') || tb.querySelector('div');
      if (!contentEl) return;

      // 인라인 색상 우선
      if (contentEl.style.color) {
        const c = normalizeColor(contentEl.style.color);
        if (c) colorSet.add(c);
      } else {
        const c = normalizeColor(window.getComputedStyle(contentEl).color);
        if (c) colorSet.add(c);
      }

      // 라벨 박스 배경색
      const labelEl = tb.querySelector('.tb-label');
      if (labelEl) {
        const lbg = labelEl.style.backgroundColor
          ? normalizeColor(labelEl.style.backgroundColor)
          : normalizeColor(window.getComputedStyle(labelEl).backgroundColor);
        if (lbg) colorSet.add(lbg);
      }
    });
  });

  const colors = [...colorSet];

  // ── HTML 렌더링 ──
  const variantLabels = {
    heading: 'Heading', subheading: 'Subheading',
    body: 'Body', caption: 'Caption', label: 'Label'
  };

  const variantRows = Object.entries(variantCount)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `
      <div class="insp-stat-row">
        <span class="insp-stat-label">${variantLabels[k]}</span>
        <span class="insp-stat-value">${n}</span>
      </div>`).join('');

  const extraBlockRows = [
    gapBlocks.length        ? `<div class="insp-stat-row"><span class="insp-stat-label">Gap</span><span class="insp-stat-value">${gapBlocks.length}</span></div>` : '',
    iconBlocks.length       ? `<div class="insp-stat-row"><span class="insp-stat-label">Icon Circle</span><span class="insp-stat-value">${iconBlocks.length}</span></div>` : '',
    tableBlocks.length      ? `<div class="insp-stat-row"><span class="insp-stat-label">Table</span><span class="insp-stat-value">${tableBlocks.length}</span></div>` : '',
    cardBlocks.length       ? `<div class="insp-stat-row"><span class="insp-stat-label">Card</span><span class="insp-stat-value">${cardBlocks.length}</span></div>` : '',
    graphBlocks.length      ? `<div class="insp-stat-row"><span class="insp-stat-label">Graph</span><span class="insp-stat-value">${graphBlocks.length}</span></div>` : '',
    dividerBlocks.length    ? `<div class="insp-stat-row"><span class="insp-stat-label">Divider</span><span class="insp-stat-value">${dividerBlocks.length}</span></div>` : '',
    labelGroupBlocks.length ? `<div class="insp-stat-row"><span class="insp-stat-label">Tags</span><span class="insp-stat-value">${labelGroupBlocks.length}</span></div>` : '',
    iconTextBlocks.length   ? `<div class="insp-stat-row"><span class="insp-stat-label">Icon Text</span><span class="insp-stat-value">${iconTextBlocks.length}</span></div>` : '',
    stepBlocks.length       ? `<div class="insp-stat-row"><span class="insp-stat-label">Step</span><span class="insp-stat-value">${stepBlocks.length}</span></div>` : '',
    canvasBlocks.length     ? `<div class="insp-stat-row"><span class="insp-stat-label">Canvas</span><span class="insp-stat-value">${canvasBlocks.length}</span></div>` : '',
    shapeBlocks.length      ? `<div class="insp-stat-row"><span class="insp-stat-label">Shape</span><span class="insp-stat-value">${shapeBlocks.length}</span></div>` : '',
  ].join('');

  const colorSwatches = colors.length
    ? colors.map(hex => `
        <div class="insp-color-item" title="${hex}">
          <div class="insp-color-swatch" style="background:${hex}"></div>
          <span class="insp-color-hex">${hex}</span>
        </div>`).join('')
    : '<span class="insp-empty">색상 없음</span>';

  const totalBlocks = textBlocks.length + assetBlocks.length + gapBlocks.length + iconBlocks.length + tableBlocks.length + cardBlocks.length + graphBlocks.length + dividerBlocks.length + labelGroupBlocks.length + iconTextBlocks.length + stepBlocks.length + canvasBlocks.length + shapeBlocks.length;

  panel.innerHTML = `
    <div class="insp-section">
      <div class="insp-section-title">개요</div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">섹션</span>
        <span class="insp-stat-value">${sections.length}</span>
      </div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">전체 블록</span>
        <span class="insp-stat-value">${totalBlocks}</span>
      </div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">텍스트</span>
        <span class="insp-stat-value">${textBlocks.length}</span>
      </div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">이미지</span>
        <span class="insp-stat-value">${assetBlocks.length}</span>
      </div>
      ${extraBlockRows}
    </div>

    <div class="insp-section">
      <div class="insp-section-title">텍스트 구성</div>
      ${variantRows || '<span class="insp-empty">텍스트 블록 없음</span>'}
    </div>

    <div class="insp-section">
      <div class="insp-section-title">
        컬러 팔레트
        <span class="insp-badge">${colors.length}색</span>
      </div>
      <div class="insp-color-grid">
        ${colorSwatches}
      </div>
    </div>
  `;
}

window.renderInspectorPanel = renderInspectorPanel;
