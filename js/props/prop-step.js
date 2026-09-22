import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { alignBtn } from './_helpers.js';

function _stepToken(name, fallback) {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// ⑨ 캔버스에서 선택된 스텝 — 우측 패널이 그 스텝만 펼친다(prop-banner02.js의 activeLine 선례와 동일 메커니즘).
//   activeIdx = null 이면 «전체 보기»(옛 동작: 모든 스텝을 한꺼번에 펼침) — 무손실 원칙상 그대로 남긴다.
const _stbActiveStep = new WeakMap();
export function stbSetActiveStep(block, idx) { _stbActiveStep.set(block, idx); }
export function stbGetActiveStep(block) { return _stbActiveStep.has(block) ? _stbActiveStep.get(block) : 0; }
if (typeof window !== 'undefined') {
  window.stbSetActiveStep = stbSetActiveStep;
  window.stbGetActiveStep = stbGetActiveStep;
}

// 캔버스에서 «지금 패널이 보고 있는 스텝»에 아웃라인 — 기존 선택 토큰만 쓴다(bn2SyncLineMark 미러).
function _stbSyncMark(block, activeIdx) {
  /* ★이름은 «-line-selected» 로 끝나야 한다(2026-09-15 현빈 제보: 선택 해제해도 테두리가 안 사라짐).
   *   옛 이름 stb-step-selected 는 이 레포의 규칙(section-serialize.js RUNTIME_MARKER_RE)에 안 걸려
   *   선택 해제 sweep·저장·PNG 어디서도 안 걷혔다. 옛 이름도 같이 걷는다(이미 저장된 프로젝트). */
  block.querySelectorAll('.stb-line-selected, .stb-step-selected').forEach(el => el.classList.remove('stb-line-selected', 'stb-step-selected'));
  if (activeIdx == null) return;
  block.querySelector(`[data-step-idx="${activeIdx}"]`)?.classList.add('stb-line-selected');
}
if (typeof window !== 'undefined') window._stbSyncMark = _stbSyncMark;

export function showStepProperties(block, activeIdxArg) {
  const steps = JSON.parse(block.dataset.steps || '[]');

  // ⑨ 어느 스텝을 펼칠지 — 인자 > 기억값 > 0번. 스텝이 삭제돼 범위를 벗어나면 보정한다.
  let activeIdx = (activeIdxArg !== undefined) ? activeIdxArg : stbGetActiveStep(block);
  if (activeIdx != null) {
    if (!steps.length) activeIdx = null;
    else if (activeIdx < 0 || activeIdx >= steps.length) activeIdx = steps.length - 1;
  }
  stbSetActiveStep(block, activeIdx);
  _stbSyncMark(block, activeIdx);

  // 스텝 선택 칩 — 기존 정렬 세그먼트(.prop-align-group/.prop-align-btn)를 그대로 쓴다(신규 룩 없음).
  const chipStrip = steps.length ? `
    <div class="prop-align-group" id="stb-step-chips" style="flex-wrap:wrap;margin-bottom:6px;">
      ${steps.map((s, i) => `<button class="prop-align-btn${activeIdx === i ? ' active' : ''}" data-step-chip="${i}" style="flex:0 1 auto;min-width:0;font-size:11px;padding:2px 8px;white-space:nowrap;" title="${(s.title || '').replace(/"/g, '&quot;').slice(0, 40) || '(빈 스텝)'}">스텝 ${i + 1}</button>`).join('')}
      <button class="prop-align-btn${activeIdx === null ? ' active' : ''}" data-step-chip="all" style="flex:0 1 auto;min-width:0;font-size:11px;padding:2px 8px;white-space:nowrap;" title="모든 스텝을 한꺼번에 펼칩니다">전체</button>
    </div>` : '';

  function stepsHtml() {
    return steps.map((s, i) => (activeIdx === null || activeIdx === i) ? `
      <div class="stb-prop-item" data-idx="${i}">
        <div class="prop-row" style="align-items:center">
          <span class="prop-label" style="font-weight:600">스텝 ${i + 1}</span>
          <button class="prop-btn prop-btn-danger stb-del-btn" data-idx="${i}" style="margin-left:auto" title="삭제"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polyline points="1,3 10,3"/><path d="M2.5,3V9.5h6V3"/><line x1="4" y1="3" x2="4" y2="1.5"/><line x1="7" y1="3" x2="7" y2="1.5"/><line x1="4" y1="1.5" x2="7" y2="1.5"/></svg></button>
        </div>
        <div class="prop-row">
          <span class="prop-label">제목</span>
          <input type="text" class="prop-input stb-title-input" data-idx="${i}" value="${(s.title || '').replace(/"/g, '&quot;')}" style="flex:1;min-width:0">
        </div>
        <div class="prop-row">
          <span class="prop-label">설명</span>
          <input type="text" class="prop-input stb-desc-input" data-idx="${i}" value="${(s.desc || '').replace(/"/g, '&quot;')}" style="flex:1;min-width:0">
        </div>
      </div>` : '').join('');
  }

  const numBg      = block.dataset.numBg      || _stepToken('--preset-step-num-bg', '#222222');
  const numColor   = block.dataset.numColor   || _stepToken('--preset-step-num-color', '#ffffff');
  const numSize    = parseInt(block.dataset.numSize)   || 36;
  const titleSize  = parseInt(block.dataset.titleSize) || 36;
  const descSize   = parseInt(block.dataset.descSize)  || 24;
  const gap        = parseInt(block.dataset.gap)       || 24;
  const connector      = block.dataset.connector      !== 'false';
  const connectorStyle = block.dataset.connectorStyle || 'line';
  const badgeGap       = parseInt(block.dataset.badgeGap) || 16;
  const titleColor = block.dataset.titleColor || _stepToken('--preset-step-title', '#222222');
  const descColor  = block.dataset.descColor  || _stepToken('--preset-step-desc', '#555555');
  const stepOrient  = block.dataset.stepOrient  || 'vertical';
  const stepStyle   = block.dataset.stepStyle   || 'default';
  const stepCardBg  = block.dataset.stepCardBg  || _stepToken('--preset-step-card-bg', '#f5f5f5');
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
        ${alignBtn('arrow-h', 'left',   { label: '왼쪽 정렬',   active: stepAlign === 'left',   attrs: { 'data-align': 'left'   }, style: 'flex:1' })}
        ${alignBtn('arrow-h', 'center', { label: '가운데 정렬', active: stepAlign === 'center', attrs: { 'data-align': 'center' }, style: 'flex:1' })}
        ${alignBtn('arrow-h', 'right',  { label: '오른쪽 정렬', active: stepAlign === 'right',  attrs: { 'data-align': 'right'  }, style: 'flex:1' })}
        ${alignBtn('arrow-h', 'stack',  { label: '세로로 쌓기', active: stepAlign === 'stack',  attrs: { 'data-align': 'stack'  }, style: 'flex:1' })}
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
      <div class="prop-row" title="시작: 이 step-block의 첫 번호 (다른 step-block과 01/02/03 순차 표시) · 형식: 배지 표기 방식">
        <span class="prop-label" style="width:auto;flex:0 0 auto">시작</span>
        <input type="number" class="prop-number" id="stb-start-number" min="1" max="99" value="${parseInt(block.dataset.startNumber) || 1}" style="width:44px;flex:0 0 auto">
        <select id="stb-badge-fmt-select" class="prop-select" style="flex:1;min-width:0;margin-left:4px">
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
      ${chipStrip}
      <div id="stb-steps-list">${stepsHtml()}</div>
    </div>
  `;

  // ⚠️renderStepBlock은 innerHTML을 통째로 갈아끼운다 → 선택 스텝 아웃라인 마커도 같이 날아간다.
  //   모든 재렌더 경로가 이 헬퍼를 통과하므로 여기서 한 번만 복구한다(bn2 rerender와 동일 규약).
  function rerender() {
    window.renderStepBlock?.(block);
    _stbSyncMark(block, activeIdx);
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

  // ── 시작 번호 (이 step-block 첫 번호) ──
  const startNumInput = propPanel.querySelector('#stb-start-number');
  if (startNumInput) {
    startNumInput.addEventListener('input', () => {
      const v = Math.max(1, Math.min(99, parseInt(startNumInput.value) || 1));
      block.dataset.startNumber = v;
      rerender();
    });
    startNumInput.addEventListener('change', () => {
      window.pushHistory?.('시작 번호');
      window.scheduleAutoSave?.();
    });
  }

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

    /* ★[R1 · 2026-09-22 · T-005 ④ · T-030 ⑤] 이 두 칸은 `input` 하나뿐이라 히스토리에
       칸을 «한 번도» 안 만들었다. 그래서 제목·설명을 고친 뒤 ⌘Z 를 누르면 그 편집이 아니라
       «그 앞 동작»이 풀렸다(스텝 추가 10→9 와 설명 되돌림이 «동시에»).
       고침 = 같은 파일 #stb-start-number(위 :372~:380)와 «같은 꼴»로 맞춘다 —
         `input` = 적용(타자마다) · `change` = 히스토리 한 칸(포커스 떠날 때 한 번).
       ⛔`input` 쪽에 pushHistory 를 달지 마라 — 글자 하나마다 칸이 생긴다.
       ⛔updateStepBlock 을 타게 바꾸지도 마라 — 그러면 js/model-update-history.js 가
         끝 표본을 찍어 주므로 여기서 또 찍는 꼴이 된다(중복은 무변화 차단이 삼키지만
         라벨이 엉킨다). rerender() 는 renderStepBlock 이라 그 통로를 안 탄다. */
    propPanel.querySelectorAll('.stb-title-input').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.idx);
        steps[i].title = el.value;
        block.dataset.steps = JSON.stringify(steps);
        rerender();
      });
      el.addEventListener('change', () => {
        window.pushHistory?.('스텝 제목');
        window.scheduleAutoSave?.();
      });
    });

    propPanel.querySelectorAll('.stb-desc-input').forEach(el => {
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.idx);
        steps[i].desc = el.value;
        block.dataset.steps = JSON.stringify(steps);
        rerender();
      });
      el.addEventListener('change', () => {
        window.pushHistory?.('스텝 설명');
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
        rerender();
        // 삭제된 스텝이 보고 있던 스텝이면 한 칸 앞으로(bn2 삭제 핸들러와 동일 규약) — 칩도 같이 갱신되니 전체 재렌더.
        showStepProperties(block, activeIdx === null ? null : Math.max(0, i - 1));
        /* ★[R1 · 2026-09-22] «끝 표본» — 위 :444 push-before 와 짝. 「스텝 추가」와 같은 병이라
           같이 닫는다(지운 «뒤» 상태가 스택에 없으면 다음 편집과 함께 풀린다). */
        window.pushHistory?.('스텝 삭제');
      });
    });
  }

  rebindStepsList();

  // ⑨ 스텝 선택 칩 — 클릭한 스텝만 펼친다("전체"는 옛 동작인 일괄 펼침으로 복귀)
  propPanel.querySelectorAll('#stb-step-chips [data-step-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.stepChip;
      showStepProperties(block, v === 'all' ? null : parseInt(v, 10));
    });
  });

  propPanel.querySelector('#stb-add-step').addEventListener('click', () => {
    // ★UI도 API(updateStepBlock, step-block.js:419)와 같은 상한(10) — QA 실측(적대적 QA)
    //   에서 UI만 무제한이라 36개까지 만들어져 상태 불일치가 났다(2026-09-15).
    if (steps.length >= 10) { window.showToast?.('스텝은 최대 10개까지입니다'); return; }
    window.pushHistory?.();
    /* ★기본 설명도 넣는다 — 캔버스는 설명이 비면 설명 칸 자체를 안 그려(step-block.js 변형 9곳)
     *   캔버스에서 설명을 넣을 자리가 없었다(2026-09-15 현빈 제보: 4단계 추가 시 설명 없음).
     *   기본 3단계(step-block.js:15~17)와 같은 말투. 상한 10(위) 까지만 필요하다. */
    const _ORD = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
    const _n = steps.length;
    steps.push({ title: `${_n + 1}단계`, desc: `${_ORD[_n] || (_n + 1)} 번째 단계 설명` });
    block.dataset.steps = JSON.stringify(steps);
    rerender();
    // 새로 추가한 스텝을 바로 펼쳐준다(전체 보기 중이면 전체 유지) — bn2-line-add와 동일 규약.
    showStepProperties(block, activeIdx === null ? null : steps.length - 1);
    /* ★[R1 · 2026-09-22 · T-030 ⑤] «끝 표본» — 위 :468 push-before 하나로는 그 카드가 안 닫힌다.
       push-before 는 «9개» 상태를 찍는다. 그러면 「10개인데 설명은 기본값」 표본이 한 번도 없어서,
       설명을 고치고 ⌘Z 하면 «10→9 와 설명 되돌림»이 한꺼번에 일어난다(현빈 제보 그대로).
       ⇒ 늘리고 «난 뒤»에 한 번 더 찍는다(⛔옮기기가 아니라 더하기). */
    window.pushHistory?.('스텝 추가');
  });
}

window.showStepProperties = showStepProperties;
