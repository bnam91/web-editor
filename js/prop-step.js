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

  const numBg     = block.dataset.numBg    || '#222222';
  const numColor  = block.dataset.numColor || '#ffffff';
  const numSize   = parseInt(block.dataset.numSize)   || 36;
  const titleSize = parseInt(block.dataset.titleSize) || 18;
  const descSize  = parseInt(block.dataset.descSize)  || 14;
  const gap       = parseInt(block.dataset.gap)       || 24;
  const connector = block.dataset.connector !== 'false';

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
    </div>

    <div class="prop-section">
      <div class="prop-section-title">텍스트</div>
      <div class="prop-row">
        <span class="prop-label">제목 크기</span>
        <input type="range" class="prop-slider" id="stb-title-size-slider" min="12" max="40" step="1" value="${titleSize}">
        <input type="number" class="prop-number" id="stb-title-size-number" min="12" max="40" value="${titleSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">설명 크기</span>
        <input type="range" class="prop-slider" id="stb-desc-size-slider" min="10" max="28" step="1" value="${descSize}">
        <input type="number" class="prop-number" id="stb-desc-size-number" min="10" max="28" value="${descSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="stb-gap-slider" min="8" max="64" step="4" value="${gap}">
        <input type="number" class="prop-number" id="stb-gap-number" min="8" max="64" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">연결선</span>
        <label class="prop-toggle">
          <input type="checkbox" id="stb-connector" ${connector ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
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

  bindColor('stb-num-bg',    'stb-num-bg-hex',    'numBg');
  bindColor('stb-num-color', 'stb-num-color-hex', 'numColor');

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
  bindSlider('stb-title-size-slider', 'stb-title-size-number', 12, 40, 'titleSize');
  bindSlider('stb-desc-size-slider',  'stb-desc-size-number',  10, 28, 'descSize');
  bindSlider('stb-gap-slider',        'stb-gap-number',         8, 64, 'gap');

  // ── 연결선 토글 ──
  propPanel.querySelector('#stb-connector').addEventListener('change', e => {
    block.dataset.connector = String(e.target.checked);
    rerender();
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
