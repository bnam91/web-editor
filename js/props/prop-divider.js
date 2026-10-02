import { propPanel, state } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

export function showDividerProperties(block) {
  const lineColor  = block.dataset.lineColor  || '#cccccc';
  const lineAlpha  = parseAlphaFromColor(lineColor);
  const lineStyle  = block.dataset.lineStyle  || 'solid';
  const lineWeight = parseInt(block.dataset.lineWeight) || 1;
  const padV       = parseInt(block.dataset.padV)       || 12;
  const padH       = parseInt(block.dataset.padH)       || 0;
  const lineDir    = block.dataset.lineDir    || 'horizontal';
  const lineLength = parseInt(block.dataset.lineLength) || 80;
  const isVertical = lineDir === 'vertical';
  /* 가로 «너비» 슬라이더의 끝 = 지금 선이 펼 수 있는 전폭(블록 폭 − 좌우 패딩). 끝까지 올리면 «전폭»(값 없음)으로 돌아간다. */
  const fullW = Math.max(40, Math.round((block.clientWidth || 860) - padH * 2));
  const lineWidth = Math.min(fullW, parseInt(block.dataset.lineWidth) || fullW);

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="6" x2="11" y2="6"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Divider',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Direction</div>
      <div class="prop-align-group" id="dvd-dir-group">
        <button class="prop-align-btn${!isVertical?' active':''}" data-dir="horizontal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="1" y1="7" x2="13" y2="7"/></svg>
          가로
        </button>
        <button class="prop-align-btn${isVertical?' active':''}" data-dir="vertical">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="7" y1="1" x2="7" y2="13"/></svg>
          세로
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Line Style</div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'dvd', hex: lineColor, alpha: lineAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="dvd-style">
          <option value="solid"  ${lineStyle==='solid'  ?'selected':''}>실선</option>
          <option value="dashed" ${lineStyle==='dashed' ?'selected':''}>파선</option>
          <option value="dotted" ${lineStyle==='dotted' ?'selected':''}>점선</option>
          <option value="tick"   ${lineStyle==='tick'   ?'selected':''}>눈금(레일)</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="dvd-weight-slider" min="1" max="24" step="1" value="${lineWeight}">
        <input type="number" class="prop-number" id="dvd-weight-number" min="1" max="24" value="${lineWeight}">
      </div>
      <div class="prop-row" id="dvd-width-row" style="display:${isVertical?'none':'flex'}">
        <span class="prop-label" title="가로 선의 너비 — 끝까지 올리면 전폭">너비</span>
        <input type="range" class="prop-slider" id="dvd-width-slider" min="20" max="${fullW}" step="4" value="${lineWidth}">
        <input type="number" class="prop-number" id="dvd-width-number" min="20" max="${fullW}" value="${lineWidth}">
      </div>
      <div class="prop-row" id="dvd-length-row" style="display:${isVertical?'flex':'none'}">
        <span class="prop-label">길이</span>
        <input type="range" class="prop-slider" id="dvd-length-slider" min="20" max="400" step="4" value="${lineLength}">
        <input type="number" class="prop-number" id="dvd-length-number" min="20" max="400" value="${lineLength}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Padding</div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="dvd-pady-slider" min="0" max="120" step="4" value="${padV}">
        <input type="number" class="prop-number" id="dvd-pady-number" min="0" max="120" value="${padV}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="dvd-padx-slider" min="0" max="2000" step="4" value="${padH}">
        <input type="number" class="prop-number" id="dvd-padx-number" min="0" max="2000" value="${padH}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 방향 토글
  propPanel.querySelector('#dvd-dir-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    block.dataset.lineDir = btn.dataset.dir;
    const isVert = btn.dataset.dir === 'vertical';
    propPanel.querySelectorAll('#dvd-dir-group .prop-align-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.dir === btn.dataset.dir));
    propPanel.querySelector('#dvd-length-row').style.display = isVert ? 'flex' : 'none';
    propPanel.querySelector('#dvd-width-row').style.display = isVert ? 'none' : 'flex';
    window.applyDividerStyle(block);
    window.pushHistory();
  });

  // 길이 슬라이더 (세로 전용)
  const lenSlider = propPanel.querySelector('#dvd-length-slider');
  const lenNumber = propPanel.querySelector('#dvd-length-number');
  const applyLength = v => {
    v = Math.min(400, Math.max(20, v));
    block.dataset.lineLength = v;
    window.applyDividerStyle(block);
    lenSlider.value = v; lenNumber.value = v;
  };
  lenSlider.addEventListener('input',  () => applyLength(parseInt(lenSlider.value)));
  lenNumber.addEventListener('change', () => { applyLength(parseInt(lenNumber.value)); window.pushHistory(); });
  lenSlider.addEventListener('change', () => window.pushHistory());

  // 너비 슬라이더 (가로 전용) — 끝(전폭)이면 값을 지운다: «전폭»은 숫자가 아니라 «없음»이다(섹션 폭이 바뀌어도 따라간다)
  const wdSlider = propPanel.querySelector('#dvd-width-slider');
  const wdNumber = propPanel.querySelector('#dvd-width-number');
  const applyWidth = v => {
    v = Math.min(fullW, Math.max(20, Number.isFinite(v) ? v : fullW));
    if (v >= fullW) delete block.dataset.lineWidth; else block.dataset.lineWidth = v;
    window.applyDividerStyle(block);
    wdSlider.value = v; wdNumber.value = v;
  };
  wdSlider.addEventListener('input',  () => applyWidth(parseInt(wdSlider.value)));
  wdNumber.addEventListener('change', () => { applyWidth(parseInt(wdNumber.value)); window.pushHistory(); });
  wdSlider.addEventListener('change', () => window.pushHistory());

  const applyAll = () => window.applyDividerStyle(block);
  wireColorField('dvd', {
    initialAlpha: lineAlpha,
    onApply: (c) => { block.dataset.lineColor = c; applyAll(); },
    onCommit: () => window.pushHistory(),
  });

  document.getElementById('dvd-style').addEventListener('change', e => {
    block.dataset.lineStyle = e.target.value;
    applyAll(); window.pushHistory();
  });

  const wSlider = document.getElementById('dvd-weight-slider');
  const wNumber = document.getElementById('dvd-weight-number');
  const applyWeight = v => {
    v = Math.min(24, Math.max(1, v));
    block.dataset.lineWeight = v;
    applyAll();
    wSlider.value = v; wNumber.value = v;
  };
  wSlider.addEventListener('input',  () => applyWeight(parseInt(wSlider.value)));
  wNumber.addEventListener('change', () => { applyWeight(parseInt(wNumber.value)); window.pushHistory(); });
  wSlider.addEventListener('change', () => window.pushHistory());

  const pySlider = document.getElementById('dvd-pady-slider');
  const pyNumber = document.getElementById('dvd-pady-number');
  const applyPadV = v => {
    v = Math.min(120, Math.max(0, v));
    block.dataset.padV = v;
    applyAll();
    pySlider.value = v; pyNumber.value = v;
  };
  pySlider.addEventListener('input',  () => applyPadV(parseInt(pySlider.value)));
  pyNumber.addEventListener('change', () => { applyPadV(parseInt(pyNumber.value)); window.pushHistory(); });
  pySlider.addEventListener('change', () => window.pushHistory());

  const pxSlider = document.getElementById('dvd-padx-slider');
  const pxNumber = document.getElementById('dvd-padx-number');
  const applyPadH = v => {
    v = Math.min(2000, Math.max(0, v));
    block.dataset.padH = v;
    applyAll();
    pxSlider.value = v; pxNumber.value = v;
  };
  pxSlider.addEventListener('input',  () => applyPadH(parseInt(pxSlider.value)));
  pxNumber.addEventListener('change', () => { applyPadH(parseInt(pxNumber.value)); window.pushHistory(); });
  pxSlider.addEventListener('change', () => window.pushHistory());
}

// Backward compat: classic scripts call these via window.*

window.showDividerProperties = showDividerProperties;
