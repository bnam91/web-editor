import { propPanel } from './globals.js';

export function showStepProperties(block) {
  const steps     = JSON.parse(block.dataset.steps || '[]');
  const numBg     = block.dataset.numBg    || '#222222';
  const numColor  = block.dataset.numColor || '#ffffff';
  const numSize   = parseInt(block.dataset.numSize)   || 36;
  const titleSize = parseInt(block.dataset.titleSize) || 18;
  const descSize  = parseInt(block.dataset.descSize)  || 14;
  const gap       = parseInt(block.dataset.gap)       || 24;
  const connector = block.dataset.connector !== 'false';

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

  function commit() {
    block.dataset.steps     = JSON.stringify(steps);
    block.dataset.numBg     = numBg;
    block.dataset.numColor  = numColor;
    block.dataset.numSize   = numSize;
    block.dataset.titleSize = titleSize;
    block.dataset.descSize  = descSize;
    block.dataset.gap       = gap;
    block.dataset.connector = String(connector);
    window.renderStepBlock?.(block);
    window.scheduleAutoSave?.();
  }

  // ── 색상 피커 헬퍼 ──
  function bindColor(pickerId, hexId, getVal, setVal) {
    const picker = propPanel.querySelector('#' + pickerId);
    const hexEl  = propPanel.querySelector('#' + hexId);
    if (!picker || !hexEl) return;
    picker.addEventListener('input', () => {
      setVal(picker.value);
      hexEl.value = picker.value;
      picker.closest('.prop-color-swatch').style.background = picker.value;
      commit();
    });
    hexEl.addEventListener('change', () => {
      const v = hexEl.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        setVal(v);
        picker.value = v;
        picker.closest('.prop-color-swatch').style.background = v;
        commit();
      }
    });
  }

  let _numBg    = numBg;
  let _numColor = numColor;
  let _numSize  = numSize;
  let _titleSize = titleSize;
  let _descSize  = descSize;
  let _gap       = gap;
  let _connector = connector;

  bindColor('stb-num-bg', 'stb-num-bg-hex',
    () => _numBg, v => { _numBg = v; block.dataset.numBg = v; });
  bindColor('stb-num-color', 'stb-num-color-hex',
    () => _numColor, v => { _numColor = v; block.dataset.numColor = v; });

  // ── 슬라이더 헬퍼 ──
  function bindSlider(sliderId, numberId, min, max, getVal, setVal) {
    const slider = propPanel.querySelector('#' + sliderId);
    const number = propPanel.querySelector('#' + numberId);
    if (!slider || !number) return;
    const update = val => {
      const v = Math.max(min, Math.min(max, parseInt(val) || min));
      slider.value = v;
      number.value = v;
      setVal(v);
      commit();
    };
    slider.addEventListener('input', () => update(slider.value));
    number.addEventListener('change', () => update(number.value));
  }

  bindSlider('stb-num-size-slider',   'stb-num-size-number',   20, 80,
    () => _numSize,   v => { _numSize   = v; block.dataset.numSize   = v; });
  bindSlider('stb-title-size-slider', 'stb-title-size-number', 12, 40,
    () => _titleSize, v => { _titleSize = v; block.dataset.titleSize = v; });
  bindSlider('stb-desc-size-slider',  'stb-desc-size-number',  10, 28,
    () => _descSize,  v => { _descSize  = v; block.dataset.descSize  = v; });
  bindSlider('stb-gap-slider',        'stb-gap-number',         8, 64,
    () => _gap,       v => { _gap       = v; block.dataset.gap       = v; });

  // ── 연결선 토글 ──
  propPanel.querySelector('#stb-connector').addEventListener('change', e => {
    _connector = e.target.checked;
    block.dataset.connector = String(_connector);
    window.renderStepBlock?.(block);
    window.scheduleAutoSave?.();
  });

  // ── 스텝 목록 이벤트 위임 ──
  function rebindStepsList() {
    const list = propPanel.querySelector('#stb-steps-list');
    if (!list) return;
    list.innerHTML = stepsHtml();

    propPanel.querySelectorAll('.stb-title-input').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.idx);
        steps[i].title = el.value;
        block.dataset.steps = JSON.stringify(steps);
        window.renderStepBlock?.(block);
        window.scheduleAutoSave?.();
      });
    });

    propPanel.querySelectorAll('.stb-desc-input').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.idx);
        steps[i].desc = el.value;
        block.dataset.steps = JSON.stringify(steps);
        window.renderStepBlock?.(block);
        window.scheduleAutoSave?.();
      });
    });

    propPanel.querySelectorAll('.stb-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        if (steps.length <= 1) return;
        window.pushHistory?.();
        steps.splice(i, 1);
        block.dataset.steps = JSON.stringify(steps);
        window.renderStepBlock?.(block);
        window.scheduleAutoSave?.();
        rebindStepsList();
      });
    });
  }

  rebindStepsList();

  propPanel.querySelector('#stb-add-step').addEventListener('click', () => {
    window.pushHistory?.();
    steps.push({ title: `${steps.length + 1}단계`, desc: '' });
    block.dataset.steps = JSON.stringify(steps);
    window.renderStepBlock?.(block);
    window.scheduleAutoSave?.();
    rebindStepsList();
  });
}

window.showStepProperties = showStepProperties;
