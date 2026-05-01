import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

export function showStepProperties(block) {
  const steps = JSON.parse(block.dataset.steps || '[]');

  function stepsHtml() {
    return steps.map((s, i) => `
      <div class="stb-prop-item" data-idx="${i}">
        <div class="prop-row" style="align-items:center">
          <span class="prop-label" style="font-weight:600">스텝 ${i + 1}</span>
          <button class="prop-btn prop-btn-danger stb-del-btn" data-idx="${i}" style="margin-left:auto;padding:3px 6px;line-height:0" title="삭제"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polyline points="1,3 10,3"/><path d="M2.5,3V9.5h6V3"/><line x1="4" y1="3" x2="4" y2="1.5"/><line x1="7" y1="3" x2="7" y2="1.5"/><line x1="4" y1="1.5" x2="7" y2="1.5"/></svg></button>
        </div>
        <div class="prop-row">
          <span class="prop-label">제목</span>
          <input type="text" class="prop-color-hex stb-title-input" data-idx="${i}" value="${(s.title || '').replace(/"/g, '&quot;')}" style="flex:1;width:auto;max-width:none">
        </div>
        <div class="prop-row">
          <span class="prop-label">설명</span>
          <input type="text" class="prop-color-hex stb-desc-input" data-idx="${i}" value="${(s.desc || '').replace(/"/g, '&quot;')}" style="flex:1;width:auto;max-width:none">
        </div>
      </div>`).join('');
  }

  const numBg      = block.dataset.numBg      || '#222222';
  const numColor   = block.dataset.numColor   || '#ffffff';
  const numSize    = parseInt(block.dataset.numSize)   || 36;
  const titleSize  = parseInt(block.dataset.titleSize) || 36;
  const descSize   = parseInt(block.dataset.descSize)  || 24;
  const gap        = parseInt(block.dataset.gap)       || 24;
  const connector      = block.dataset.connector      !== 'false';
  const connectorStyle = block.dataset.connectorStyle || 'line';
  const badgeGap       = parseInt(block.dataset.badgeGap) || 16;
  const titleColor = block.dataset.titleColor || '#222222';
  const descColor  = block.dataset.descColor  || '#555555';
  const stepOrient  = block.dataset.stepOrient  || 'vertical';
  const stepStyle   = block.dataset.stepStyle   || 'default';
  const stepCardBg  = block.dataset.stepCardBg  || '#f5f5f5';
  const stepAlign   = block.dataset.stepAlign   || 'left';
  const stepPadL    = parseInt(block.dataset.stepPadL ?? block.dataset.stepPadX) || 0;
  const stepPadR    = parseInt(block.dataset.stepPadR ?? block.dataset.stepPadX) || 0;
  const badgeFormat = block.dataset.badgeFormat || 'number';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <circle cx="2.5" cy="2.5" r="1.5"/>
            <line x1="4.5" y1="2.5" x2="11" y2="2.5"/>
            <circle cx="2.5" cy="6" r="1.5"/>
            <line x1="4.5" y1="6" x2="11" y2="6"/>
            <circle cx="2.5" cy="9.5" r="1.5"/>
            <line x1="4.5" y1="9.5" x2="11" y2="9.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Step Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Direction</div>
      <div class="prop-align-group" id="stb-orient-group">
        <button class="prop-align-btn${stepOrient === 'vertical'   ? ' active' : ''}" data-orient="vertical"   style="flex:1">세로</button>
        <button class="prop-align-btn${stepOrient === 'horizontal' ? ' active' : ''}" data-orient="horizontal" style="flex:1">가로</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Style</div>
      <div class="prop-align-group" id="stb-style-group">
        <button class="prop-align-btn${stepStyle === 'default' ? ' active' : ''}" data-style="default" style="flex:1">기본</button>
        <button class="prop-align-btn${stepStyle === 'card'    ? ' active' : ''}" data-style="card"    style="flex:1">카드</button>
        <button class="prop-align-btn${stepStyle === 'circle'  ? ' active' : ''}" data-style="circle"  style="flex:1">원형</button>
        <button class="prop-align-btn${stepStyle === 'number'  ? ' active' : ''}" data-style="number"  style="flex:1">번호</button>
      </div>
      <div class="prop-row" id="stb-card-bg-row" style="display:${stepStyle === 'card' ? 'flex' : 'none'}">
        <span class="prop-label">카드 배경</span>
        ${colorFieldHTML({ idPrefix: 'stb-card-bg', hex: stepCardBg, alpha: parseAlphaFromColor(stepCardBg) })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Align</div>
      <div class="prop-align-group" id="stb-align-group">
        <button class="prop-align-btn${stepAlign === 'left'   ? ' active' : ''}" data-align="left"   style="flex:1">←</button>
        <button class="prop-align-btn${stepAlign === 'center' ? ' active' : ''}" data-align="center" style="flex:1">↔</button>
        <button class="prop-align-btn${stepAlign === 'right'  ? ' active' : ''}" data-align="right"  style="flex:1">→</button>
        <button class="prop-align-btn${stepAlign === 'stack'  ? ' active' : ''}" data-align="stack"  style="flex:1">☰</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Badge</div>
      <div class="prop-row">
        <span class="prop-label">배경색</span>
        ${colorFieldHTML({ idPrefix: 'stb-num-bg', hex: numBg, alpha: parseAlphaFromColor(numBg) })}
      </div>
      <div class="prop-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stb-num-color', hex: numColor, alpha: parseAlphaFromColor(numColor) })}
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stb-num-size-slider" min="20" max="80" step="2" value="${numSize}">
        <input type="number" class="prop-number" id="stb-num-size-number" min="20" max="80" value="${numSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">배지 간격</span>
        <input type="range" class="prop-slider" id="stb-badge-gap-slider" min="4" max="200" step="4" value="${badgeGap}">
        <input type="number" class="prop-number" id="stb-badge-gap-number" min="4" max="200" value="${badgeGap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">배지 형식</span>
        <select id="stb-badge-fmt-select" class="prop-select" style="flex:1">
          <option value="number"  ${badgeFormat === 'number'  ? 'selected' : ''}>1, 2, 3</option>
          <option value="padded"  ${badgeFormat === 'padded'  ? 'selected' : ''}>01, 02, 03</option>
          <option value="alpha"   ${badgeFormat === 'alpha'   ? 'selected' : ''}>A, B, C</option>
          <option value="step"    ${badgeFormat === 'step'    ? 'selected' : ''}>STEP 01</option>
          <option value="point"   ${badgeFormat === 'point'   ? 'selected' : ''}>POINT 01</option>
        </select>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Text</div>
      <div class="prop-row">
        <span class="prop-label">제목 색</span>
        ${colorFieldHTML({ idPrefix: 'stb-title-color', hex: titleColor, alpha: parseAlphaFromColor(titleColor) })}
      </div>
      <div class="prop-row">
        <span class="prop-label">설명 색</span>
        ${colorFieldHTML({ idPrefix: 'stb-desc-color', hex: descColor, alpha: parseAlphaFromColor(descColor) })}
      </div>
      <div class="prop-row">
        <span class="prop-label">제목 크기</span>
        <input type="range" class="prop-slider" id="stb-title-size-slider" min="12" max="80" step="1" value="${titleSize}">
        <input type="number" class="prop-number" id="stb-title-size-number" min="12" max="80" value="${titleSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">설명 크기</span>
        <input type="range" class="prop-slider" id="stb-desc-size-slider" min="10" max="64" step="1" value="${descSize}">
        <input type="number" class="prop-number" id="stb-desc-size-number" min="10" max="64" value="${descSize}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="stb-gap-slider" min="8" max="200" step="4" value="${gap}">
        <input type="number" class="prop-number" id="stb-gap-number" min="8" max="200" value="${gap}">
      </div>
      <div class="prop-ph-header">
        <span class="prop-section-title" style="margin-bottom:0">L/R Padding</span>
        <button class="prop-chain-btn${stepPadL === stepPadR ? ' active' : ''}" id="stb-ph-chain" title="좌우 연동">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="4.5" y1="6" x2="7.5" y2="6" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="prop-row">
        <span class="prop-label" style="width:60px">왼쪽</span>
        <input type="range" class="prop-slider" id="stb-padl-slider" min="0" max="300" step="4" value="${stepPadL}">
        <input type="number" class="prop-number" id="stb-padl-number" min="0" max="300" value="${stepPadL}">
      </div>
      <div class="prop-row">
        <span class="prop-label" style="width:60px">오른쪽</span>
        <input type="range" class="prop-slider" id="stb-padr-slider" min="0" max="300" step="4" value="${stepPadR}">
        <input type="number" class="prop-number" id="stb-padr-number" min="0" max="300" value="${stepPadR}">
      </div>
      <div class="prop-row">
        <span class="prop-label">연결선</span>
        <label class="prop-toggle">
          <input type="checkbox" id="stb-connector" ${connector ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row" id="stb-connector-style-row" style="display:${connector ? 'flex' : 'none'}">
        <span class="prop-label">스타일</span>
        <select id="stb-connector-style-select" class="prop-select" style="flex:1">
          <option value="line"    ${connectorStyle === 'line'    ? 'selected' : ''}>선</option>
          <option value="arrow"   ${connectorStyle === 'arrow'   ? 'selected' : ''}>화살표</option>
          <option value="divider" ${connectorStyle === 'divider' ? 'selected' : ''}>가로 구분선</option>
        </select>
      </div>
    </div>

    <div class="prop-section">
      <div style="display:flex;align-items:center;margin-bottom:4px">
        <span class="prop-section-title" style="margin-bottom:0;flex:1">Steps</span>
        <button class="prop-btn" id="stb-add-step" style="padding:3px 6px;line-height:0" title="스텝 추가"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="5.5" y1="1" x2="5.5" y2="10"/><line x1="1" y1="5.5" x2="10" y2="5.5"/></svg></button>
      </div>
      <div id="stb-steps-list">${stepsHtml()}</div>
    </div>
  `;

  function rerender() {
    window.renderStepBlock?.(block);
    window.scheduleAutoSave?.();
  }

  // ── 방향 토글 ──
  propPanel.querySelector('#stb-orient-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-orient]');
    if (!btn) return;
    block.dataset.stepOrient = btn.dataset.orient;
    rerender();
    propPanel.querySelectorAll('#stb-orient-group [data-orient]').forEach(b => b.classList.toggle('active', b === btn));
    window.pushHistory?.();
  });

  // ── 스타일 토글 ──
  propPanel.querySelector('#stb-style-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-style]');
    if (!btn) return;
    block.dataset.stepStyle = btn.dataset.style;
    const cardBgRow = propPanel.querySelector('#stb-card-bg-row');
    if (cardBgRow) cardBgRow.style.display = btn.dataset.style === 'card' ? 'flex' : 'none';
    rerender();
    propPanel.querySelectorAll('#stb-style-group [data-style]').forEach(b => b.classList.toggle('active', b === btn));
    window.pushHistory?.();
  });

  // ── 정렬 토글 ──
  propPanel.querySelector('#stb-align-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-align]');
    if (!btn) return;
    block.dataset.stepAlign = btn.dataset.align;
    rerender();
    propPanel.querySelectorAll('#stb-align-group [data-align]').forEach(b => b.classList.toggle('active', b === btn));
    window.pushHistory?.();
  });

  // ── 색상 피커 ──
  function bindColor(idPrefix, datasetKey, initialVal) {
    wireColorField(idPrefix, {
      initialAlpha: parseAlphaFromColor(initialVal),
      onApply: (c) => { block.dataset[datasetKey] = c; rerender(); },
      onCommit: () => window.pushHistory?.(),
    });
  }

  bindColor('stb-card-bg',    'stepCardBg', stepCardBg);
  bindColor('stb-num-bg',     'numBg',      numBg);
  bindColor('stb-num-color',  'numColor',   numColor);
  bindColor('stb-title-color','titleColor', titleColor);
  bindColor('stb-desc-color', 'descColor',  descColor);

  // ── 슬라이더 ──
  function bindSlider(sliderId, numberId, min, max, datasetKey) {
    const slider = propPanel.querySelector('#' + sliderId);
    const number = propPanel.querySelector('#' + numberId);
    if (!slider || !number) return;
    const apply = raw => {
      const v = Math.max(min, Math.min(max, parseInt(raw) || min));
      slider.value = v;
      number.value = v;
      block.dataset[datasetKey] = v;
      rerender();
    };
    slider.addEventListener('input',  () => apply(slider.value));
    number.addEventListener('change', () => { apply(number.value); window.pushHistory?.(); });
    slider.addEventListener('change', () => window.pushHistory?.());
  }

  bindSlider('stb-num-size-slider',   'stb-num-size-number',   20, 80, 'numSize');
  bindSlider('stb-title-size-slider', 'stb-title-size-number', 12, 80, 'titleSize');
  bindSlider('stb-desc-size-slider',  'stb-desc-size-number',  10, 64, 'descSize');
  bindSlider('stb-gap-slider',        'stb-gap-number',         8, 200, 'gap');
  // ── 좌우 패딩 체인 ──
  {
    const CHAIN_LINKED = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="4.5" y1="6" x2="7.5" y2="6" stroke-linecap="round"/></svg>`;
    const CHAIN_BROKEN = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="5.2" y1="4.8" x2="6.8" y2="7.2" stroke-linecap="round"/></svg>`;
    let padLinked = stepPadL === stepPadR;
    const chainBtn = propPanel.querySelector('#stb-ph-chain');
    const plSlider = propPanel.querySelector('#stb-padl-slider');
    const plNum    = propPanel.querySelector('#stb-padl-number');
    const prSlider = propPanel.querySelector('#stb-padr-slider');
    const prNum    = propPanel.querySelector('#stb-padr-number');
    chainBtn.addEventListener('click', () => {
      padLinked = !padLinked;
      chainBtn.classList.toggle('active', padLinked);
      chainBtn.innerHTML = padLinked ? CHAIN_LINKED : CHAIN_BROKEN;
      if (padLinked) {
        const v = parseInt(plSlider.value);
        block.dataset.stepPadR = v; prSlider.value = v; prNum.value = v;
        rerender();
      }
    });
    const setL = v => {
      block.dataset.stepPadL = v; plSlider.value = v; plNum.value = v;
      if (padLinked) { block.dataset.stepPadR = v; prSlider.value = v; prNum.value = v; }
      rerender();
    };
    const setR = v => {
      block.dataset.stepPadR = v; prSlider.value = v; prNum.value = v;
      if (padLinked) { block.dataset.stepPadL = v; plSlider.value = v; plNum.value = v; }
      rerender();
    };
    plSlider.addEventListener('input',  () => setL(parseInt(plSlider.value)));
    plNum.addEventListener('change',    () => { setL(Math.min(300, Math.max(0, parseInt(plNum.value) || 0))); window.pushHistory?.(); });
    plSlider.addEventListener('change', () => window.pushHistory?.());
    prSlider.addEventListener('input',  () => setR(parseInt(prSlider.value)));
    prNum.addEventListener('change',    () => { setR(Math.min(300, Math.max(0, parseInt(prNum.value) || 0))); window.pushHistory?.(); });
    prSlider.addEventListener('change', () => window.pushHistory?.());
  }

  // ── 배지 형식 ──
  propPanel.querySelector('#stb-badge-fmt-select').addEventListener('change', e => {
    block.dataset.badgeFormat = e.target.value;
    rerender();
    window.pushHistory?.();
  });

  bindSlider('stb-badge-gap-slider', 'stb-badge-gap-number', 4, 200, 'badgeGap');

  // ── 연결선 토글 ──
  propPanel.querySelector('#stb-connector').addEventListener('change', e => {
    block.dataset.connector = String(e.target.checked);
    const styleRow = propPanel.querySelector('#stb-connector-style-row');
    if (styleRow) styleRow.style.display = e.target.checked ? 'flex' : 'none';
    rerender();
    window.pushHistory?.();
  });

  // ── 연결선 스타일 ──
  propPanel.querySelector('#stb-connector-style-select').addEventListener('change', e => {
    block.dataset.connectorStyle = e.target.value;
    rerender();
    window.pushHistory?.();
  });

  // ── 스텝 목록 ──
  function rebindStepsList() {
    const list = propPanel.querySelector('#stb-steps-list');
    if (!list) return;
    list.innerHTML = stepsHtml();

    propPanel.querySelectorAll('.stb-title-input').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.idx);
        steps[i].title = el.value;
        block.dataset.steps = JSON.stringify(steps);
        rerender();
      });
    });

    propPanel.querySelectorAll('.stb-desc-input').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.idx);
        steps[i].desc = el.value;
        block.dataset.steps = JSON.stringify(steps);
        rerender();
      });
    });

    propPanel.querySelectorAll('.stb-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        if (steps.length <= 1) return;
        window.pushHistory?.();
        steps.splice(i, 1);
        block.dataset.steps = JSON.stringify(steps);
        rerender();
        rebindStepsList();
      });
    });
  }

  rebindStepsList();

  propPanel.querySelector('#stb-add-step').addEventListener('click', () => {
    window.pushHistory?.();
    steps.push({ title: `${steps.length + 1}단계`, desc: '' });
    block.dataset.steps = JSON.stringify(steps);
    rerender();
    rebindStepsList();
  });
}

window.showStepProperties = showStepProperties;
