/* ═══════════════════════════════════
   INSPECTOR PANEL
═══════════════════════════════════ */

// FIX: buildLayerPanel() 마지막에 Inspector 탭 활성 시 자동 갱신 추가 (layer-panel.js)
// FIX: step-block, canvas-block, shape-block 카운트 추가

/* ── Logo 개수 판정 ── ★이건 «근사»다. 근사인 이유와 걷어낼 조건을 여기 적어 둔다.
 *
 * 정본은 data-preset="logo" 표식이다. 그런데 옛 블록들은 그 표식을 «이미 잃었다» —
 * 패딩제외 토글이 preset 을 조건 없이 지웠기 때문이다(prop-asset.js, 2026-08-28 수정).
 *   실측(프로젝트 70개 «전수», 에셋 블록 934개):
 *     표식有 1 · 200x64 규격 7 · 둘 다 1 ⇒ ★표식有인데 200x64 아님 = 0 / 200x64인데 표식 없음 = 6
 *   ⇒ 표식만 세면 «6개를 놓친다». 그래서 「표식 ∪ 200x64」로 센다.
 *
 * ⚠️오탐: 우연히 200x64 인 일반 이미지가 로고로 잡힌다. 원리적으로 크기만으론 못 가른다.
 *   근거는 «위험이 낮다»지 «없다»가 아니다 — 에셋 934개 중 200x64 는 7개(0.7%)이고
 *   크기 상위 12위 안에 없다. 대부분 에셋은 height 만 잡혀 있는데 200x64 는 둘 다 명시라 드물다.
 *
 * ★★파일에는 «아무것도 안 쓴다» — 표시 전용이다.
 *   같은 오탐률이면 사용자 프로젝트 파일에 박는 쪽이 아니라 화면에만 있는 쪽을 고른다.
 *   화면은 틀려도 코드 한 줄로 걷어내지만, 파일에 박힌 오탐은 사용자가 발견할 방법이 없다.
 *
 * ⇒ 걷어낼 조건: 「표식만으로 세도 같은 수가 나오는 날」. 그때 || _isLogoSized 절을 지운다.
 * ★export 인 이유: 프로브가 이 술어를 «재구현»하면 여기를 고쳐도 프로브가 안 죽는다. */
export const LOGO_W = 200, LOGO_H = 64;
export const _isLogoSized = (ab) =>
  parseInt(ab.style.width) === LOGO_W && parseInt(ab.style.height) === LOGO_H;
/** 에셋 블록 목록에서 «로고로 셀 것»을 고른다(표식 ∪ 규격). 파일은 안 건드린다. */
export function logoBlocksOf(assetBlocks) {
  return [...assetBlocks].filter(ab => ab.dataset.preset === 'logo' || _isLogoSized(ab));
}

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
  const graphBlocks       = [...document.querySelectorAll('.graph-block')];
  const dividerBlocks     = [...document.querySelectorAll('.divider-block')];
  const iconTextBlocks    = [...document.querySelectorAll('.icon-text-block')];
  const stepBlocks        = [...document.querySelectorAll('.step-block')];
  const canvasBlocks      = [...document.querySelectorAll('.canvas-block')];
  const shapeBlocks       = [...document.querySelectorAll('.shape-block')];

  const logoBlocks = logoBlocksOf(assetBlocks);

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
    graphBlocks.length      ? `<div class="insp-stat-row"><span class="insp-stat-label">Graph</span><span class="insp-stat-value">${graphBlocks.length}</span></div>` : '',
    dividerBlocks.length    ? `<div class="insp-stat-row"><span class="insp-stat-label">Divider</span><span class="insp-stat-value">${dividerBlocks.length}</span></div>` : '',
    labelGroupBlocks.length ? `<div class="insp-stat-row"><span class="insp-stat-label">Tags</span><span class="insp-stat-value">${labelGroupBlocks.length}</span></div>` : '',
    iconTextBlocks.length   ? `<div class="insp-stat-row"><span class="insp-stat-label">Icon Text</span><span class="insp-stat-value">${iconTextBlocks.length}</span></div>` : '',
    stepBlocks.length       ? `<div class="insp-stat-row"><span class="insp-stat-label">Step</span><span class="insp-stat-value">${stepBlocks.length}</span></div>` : '',
    canvasBlocks.length     ? `<div class="insp-stat-row"><span class="insp-stat-label">Canvas</span><span class="insp-stat-value">${canvasBlocks.length}</span></div>` : '',
    shapeBlocks.length      ? `<div class="insp-stat-row"><span class="insp-stat-label">Shape</span><span class="insp-stat-value">${shapeBlocks.length}</span></div>` : '',
    // 0개면 «안 그린다» — 다른 줄과 같은 규율(없는 걸 0 으로 늘어놓지 않는다)
    logoBlocks.length       ? `<div class="insp-stat-row"><span class="insp-stat-label">Logo</span><span class="insp-stat-value">${logoBlocks.length}</span></div>` : '',
  ].join('');

  const colorSwatches = colors.length
    ? colors.map(hex => `
        <div class="insp-color-item" title="${hex}">
          <div class="insp-color-swatch" style="background:${hex}"></div>
          <span class="insp-color-hex">${hex}</span>
        </div>`).join('')
    : '<span class="insp-empty">색상 없음</span>';

  const totalBlocks = textBlocks.length + assetBlocks.length + gapBlocks.length + iconBlocks.length + tableBlocks.length + graphBlocks.length + dividerBlocks.length + labelGroupBlocks.length + iconTextBlocks.length + stepBlocks.length + canvasBlocks.length + shapeBlocks.length;

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
