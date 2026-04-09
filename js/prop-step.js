import { propPanel } from './globals.js';

export function showStepProperties(block) {
  const steps = JSON.parse(block.dataset.steps || '[]');

  function stepsHtml() {
    return steps.map((s, i) => `
      <div class="stb-prop-item" data-idx="${i}">
        <div class="prop-row" style="align-items:center">
          <span class="prop-label" style="font-weight:600">스텝 ${i + 1}</span>
          <button class="prop-btn prop-btn-danger stb-del-btn" data-idx="${i}" style="margin-left:auto;padding:2px 8px;font-size:11px">삭제</button>
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
  const stepPadX    = parseInt(block.dataset.stepPadX) || 0;
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

      <div class="prop-section-title">방향</div>
      <div class="prop-align-group" id="stb-orient-group">
        <button class="prop-align-btn${stepOrient === 'vertical'   ? ' active' : ''}" data-orient="vertical"   style="flex:1">세로</button>
        <button class="prop-align-btn${stepOrient === 'horizontal' ? ' active' : ''}" data-orient="horizontal" style="flex:1">가로</button>
      </div>

      <div class="prop-section-title" style="margin-top:10px">스타일</div>
      <div class="prop-align-group" id="stb-style-group">
        <button class="prop-align-btn${stepStyle === 'default' ? ' active' : ''}" data-style="default" style="flex:1">기본</button>
        <button class="prop-align-btn${stepStyle === 'card'    ? ' active' : ''}" data-style="card"    style="flex:1">카드</button>
        <button class="prop-align-btn${stepStyle === 'circle'  ? ' active' : ''}" data-style="circle"  style="flex:1">원형</button>
        <button class="prop-align-btn${stepStyle === 'number'  ? ' active' : ''}" data-style="number"  style="flex:1">번호</button>
      </div>

      <div class="prop-section-title" style="margin-top:10px">정렬</div>
      <div class="prop-align-group" id="stb-align-group">
        <button class="prop-align-btn${stepAlign === 'left'   ? ' active' : ''}" data-align="left"   style="flex:1">←</button>
        <button class="prop-align-btn${stepAlign === 'center' ? ' active' : ''}" data-align="center" style="flex:1">↔</button>
        <button class="prop-align-btn${stepAlign === 'right'  ? ' active' : ''}" data-align="right"  style="flex:1">→</button>
      </div>

      <div class="prop-row" id="stb-card-bg-row" style="display:${stepStyle === 'card' ? 'flex' : 'none'}">
        <span class="prop-label">카드 배경</span>
        <div class="prop-color-swatch" style="background:${stepCardBg}">
          <input type="color" id="stb-card-bg-pick" value="${stepCardBg}">
        </div>
        <input type="text" class="prop-color-hex" id="stb-card-bg-hex" value="${stepCardBg}" maxlength="7">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">배지</div>
      <div class="prop-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${numBg}">
          <input type="color" id="stb-num-bg" value="${numBg}">
        </div>
        <input type="text" class="prop-color-hex" id="stb-num-bg-hex" value="${numBg}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">글자색</span>
        <div class="prop-color-swatch" style="background:${numColor}">
          <input type="color" id="stb-num-color" value="${numColor}">
        </div>
        <input type="text" class="prop-color-hex" id="stb-num-color-hex" value="${numColor}" maxlength="7">
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
      <div class="prop-section-title">텍스트</div>
      <div class="prop-row">
        <span class="prop-label">제목 색</span>
        <div class="prop-color-swatch" style="background:${titleColor}">
          <input type="color" id="stb-title-color" value="${titleColor}">
        </div>
        <input type="text" class="prop-color-hex" id="stb-title-color-hex" value="${titleColor}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">설명 색</span>
        <div class="prop-color-swatch" style="background:${descColor}">
          <input type="color" id="stb-desc-color" value="${descColor}">
        </div>
        <input type="text" class="prop-color-hex" id="stb-desc-color-hex" value="${descColor}" maxlength="7">
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
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="stb-gap-slider" min="8" max="200" step="4" value="${gap}">
        <input type="number" class="prop-number" id="stb-gap-number" min="8" max="200" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="stb-padx-slider" min="0" max="120" step="4" value="${stepPadX}">
        <input type="number" class="prop-number" id="stb-padx-number" min="0" max="120" value="${stepPadX}">
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
      <div class="prop-section-title">스텝 목록</div>
      <div id="stb-steps-list">${stepsHtml()}</div>
      <button class="prop-btn" id="stb-add-step" style="width:100%;margin-top:8px">+ 스텝 추가</button>
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

  // ── 카드 배경색 ──
  bindColor('stb-card-bg-pick', 'stb-card-bg-hex', 'stepCardBg');

  // ── 색상 피커 ──
  function bindColor(pickerId, hexId, datasetKey) {
    const picker = propPanel.querySelector('#' + pickerId);
    const hexEl  = propPanel.querySelector('#' + hexId);
    if (!picker || !hexEl) return;
    const apply = v => {
      block.dataset[datasetKey] = v;
      picker.value = v;
      hexEl.value  = v;
      picker.closest('.prop-color-swatch').style.background = v;
      rerender();
    };
    picker.addEventListener('input',  () => apply(picker.value));
    hexEl.addEventListener('change',  () => {
      const v = hexEl.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) apply(v);
    });
  }

  bindColor('stb-num-bg',      'stb-num-bg-hex',      'numBg');
  bindColor('stb-num-color',   'stb-num-color-hex',   'numColor');
  bindColor('stb-title-color', 'stb-title-color-hex', 'titleColor');
  bindColor('stb-desc-color',  'stb-desc-color-hex',  'descColor');

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
  bindSlider('stb-padx-slider',       'stb-padx-number',        0, 120, 'stepPadX');

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
