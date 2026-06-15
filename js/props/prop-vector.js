import { propPanel } from '../globals.js';
import { pushHistory } from '../editor.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

export function showVectorProperties(block) {
  const w       = parseInt(block.dataset.w)        || 120;
  const h       = parseInt(block.dataset.h)        || 120;
  const color   = block.dataset.color              || '#000000';
  const colorAlpha = parseAlphaFromColor(color);
  const rotateDeg = parseFloat(block.dataset.rotateDeg) || 0;

  // 펜툴 패스 메타
  let penNodes = null;
  try { penNodes = JSON.parse(block.dataset.penNodes || 'null'); } catch (_) { penNodes = null; }
  const hasPen      = Array.isArray(penNodes) && penNodes.length >= 2;
  const penClosed   = block.dataset.penClosed === '1';
  const strokeWidth = parseFloat(block.dataset.strokeWidth) || 2;
  const penFill     = block.dataset.penFill || 'none';
  const fillOn      = penFill && penFill !== 'none';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M6 1L11 4.5L9 11H3L1 4.5Z" stroke-linejoin="round"/>
            <line x1="1" y1="4.5" x2="11" y2="4.5"/>
            <line x1="6" y1="1" x2="3" y2="4.5"/>
            <line x1="6" y1="1" x2="9" y2="4.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Vector'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="vb-w" value="${w}" min="10" max="1200">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="vb-h" value="${h}" min="10" max="2000">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-row">
        <span class="prop-label">Fill</span>
        ${colorFieldHTML({ idPrefix: 'vb', hex: color, alpha: colorAlpha })}
      </div>
    </div>

    ${hasPen ? `
    <div class="prop-section">
      <div class="prop-section-title">Path</div>
      <div class="prop-row">
        <button class="prop-btn-full" id="vb-pen-edit">패스 편집</button>
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">선 두께</span>
        <input type="range" class="prop-slider" id="vb-stroke-w" min="0.5" max="40" step="0.5" value="${strokeWidth}">
        <input type="number" class="prop-number" id="vb-stroke-w-num" min="0.5" max="40" step="0.5" value="${strokeWidth}">
      </div>
      ${penClosed ? `
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">채움</span>
        <label class="prop-toggle" title="닫힌 패스 채움 토글" style="margin-left:auto;">
          <input type="checkbox" id="vb-pen-fill" ${fillOn ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>` : ''}
    </div>` : ''}

    <div class="prop-section">
      <div class="prop-section-title">Rotate / Flip</div>
      <div class="prop-row" style="gap:4px;">
        <span class="prop-label" style="flex-shrink:0;">각도</span>
        <input type="number" class="prop-number" id="vb-rotate-deg" style="width:56px;" min="-360" max="360" value="${rotateDeg}">
        <span style="font-size:11px;color:#6b6b6b;flex-shrink:0;">°</span>
      </div>
      <div class="prop-row" style="gap:3px;justify-content:flex-end;margin-top:4px;">
        <button class="prop-align-btn" id="vb-rotate-90" title="90° 시계 방향 회전">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M11.5 4.5A5 5 0 1 0 13 8"/>
            <polyline stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" points="9,2 12,4.5 9.5,7.5"/>
          </svg>
        </button>
        <button class="prop-align-btn${block.dataset.flipH === '1' ? ' active' : ''}" id="vb-flip-h" title="좌우 반전">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8 2v12M4 4l-2 4 2 4M12 4l2 4-2 4"/>
            <path fill="currentColor" opacity=".35" d="M8 5v6l-4-3z"/>
          </svg>
        </button>
        <button class="prop-align-btn${block.dataset.flipV === '1' ? ' active' : ''}" id="vb-flip-v" title="상하 반전">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2 8h12M4 4l4-2 4 2M4 12l4 2 4-2"/>
            <path fill="currentColor" opacity=".35" d="M5 8h6l-3 4z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // ── transform 적용 ────────────────────────────────────────────────────────────
  function applyTransform() {
    const rd = parseFloat(block.dataset.rotateDeg) || 0;
    const fx = block.dataset.flipH === '1' ? -1 : 1;
    const fy = block.dataset.flipV === '1' ? -1 : 1;
    block.style.transform = `rotate(${rd}deg) scale(${fx},${fy})`;
    window.scheduleAutoSave?.();
  }

  // ── 크기 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-w')?.addEventListener('change', () => {
    block.dataset.w = parseInt(document.getElementById('vb-w').value) || w;
    window.renderVector(block);
    window.scheduleAutoSave?.();
    pushHistory();
  });
  document.getElementById('vb-h')?.addEventListener('change', () => {
    block.dataset.h = parseInt(document.getElementById('vb-h').value) || h;
    window.renderVector(block);
    window.scheduleAutoSave?.();
    pushHistory();
  });

  // ── 색상 ──────────────────────────────────────────────────────────────────────
  wireColorField('vb', {
    initialAlpha: colorAlpha,
    onApply: (c) => {
      block.dataset.color = c;
      // 펜 패스: stroke(및 fill ON이면 fill) 색을 penNodes 기반으로 재빌드
      if (hasPen) {
        if (block.dataset.penFill && block.dataset.penFill !== 'none') block.dataset.penFill = c;
        rebuildPenSvg();
      } else {
        window.renderVector(block);
      }
      window.scheduleAutoSave?.();
    },
    onCommit: () => pushHistory(),
  });

  // ── 펜 패스 ──────────────────────────────────────────────────────────────────
  // penNodes(viewBox 좌표) + 현재 stroke/fill로 SVG 재빌드 → dataset.svg 갱신 → renderVector
  function rebuildPenSvg() {
    // F6: 공용 window.rebuildPenSvg 재사용 (vector-block.js). 폴백 인라인 유지.
    if (window.rebuildPenSvg?.(block)) {
      window.renderVector(block);
      window.scheduleAutoSave?.();
      return;
    }
    let nodes = null;
    try { nodes = JSON.parse(block.dataset.penNodes || 'null'); } catch (_) { return; }
    if (!Array.isArray(nodes) || nodes.length < 2) return;
    const closed = block.dataset.penClosed === '1';
    const sw     = parseFloat(block.dataset.strokeWidth) || 2;
    const fill   = block.dataset.penFill || 'none';
    const w      = parseInt(block.dataset.w) || 120;
    const h      = parseInt(block.dataset.h) || 120;
    const d = window.nodesToSvgPath?.(nodes, closed) || '';
    const stroke = block.dataset.color || '#1a1a1a';
    const fillAttr = (fill && fill !== 'none') ? fill : 'none';
    block.dataset.svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
      `<path d="${d}" fill="${fillAttr}" stroke="${stroke}" stroke-width="${sw}" ` +
      `stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    window.renderVector(block);
    window.scheduleAutoSave?.();
  }

  document.getElementById('vb-pen-edit')?.addEventListener('click', () => {
    window.enterPenEditMode?.(block);
  });
  // F13: 선 두께 슬라이더 ↔ 숫자 동기 (annotation 패널과 동형). input=라이브, change=히스토리 1회.
  const strokeSlider = document.getElementById('vb-stroke-w');
  const strokeNum    = document.getElementById('vb-stroke-w-num');
  function applyStroke(v) {
    if (!Number.isFinite(v) || v <= 0) return;
    block.dataset.strokeWidth = String(v);
    if (strokeSlider) strokeSlider.value = v;
    if (strokeNum)    strokeNum.value    = v;
    rebuildPenSvg();
  }
  strokeSlider?.addEventListener('input', () => applyStroke(parseFloat(strokeSlider.value)));
  strokeNum?.addEventListener('input',    () => applyStroke(parseFloat(strokeNum.value)));
  strokeSlider?.addEventListener('change', () => pushHistory());
  strokeNum?.addEventListener('change',    () => pushHistory());
  // F9: 채움 토글 표준 스위치(checkbox change)
  document.getElementById('vb-pen-fill')?.addEventListener('change', (e) => {
    const on = e.target.checked;
    block.dataset.penFill = on ? (block.dataset.color || '#1a1a1a') : 'none';
    rebuildPenSvg();
    pushHistory();
  });

  // 색상이 바뀌면 fill이 ON인 경우 fill 색도 동기화 — wireColorField onApply 후 rebuild
  // (아래 색상 wiring의 onApply에 penFill 동기화 추가는 별도 — 여기서는 fill=색상 추종)

  // ── 회전 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-rotate-deg')?.addEventListener('input', e => {
    block.dataset.rotateDeg = parseFloat(e.target.value) || 0;
    applyTransform();
  });
  // 드래그 커밋(change) 1회 = undo 1액션 (input마다 히스토리 쌓지 않음)
  document.getElementById('vb-rotate-deg')?.addEventListener('change', () => pushHistory());
  document.getElementById('vb-rotate-90')?.addEventListener('click', () => {
    const cur  = parseFloat(block.dataset.rotateDeg) || 0;
    const next = (cur + 90) % 360;
    block.dataset.rotateDeg = next;
    const inp = document.getElementById('vb-rotate-deg');
    if (inp) inp.value = next;
    applyTransform();
    pushHistory();
  });

  // ── 반전 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-flip-h')?.addEventListener('click', () => {
    block.dataset.flipH = block.dataset.flipH === '1' ? '0' : '1';
    document.getElementById('vb-flip-h')?.classList.toggle('active', block.dataset.flipH === '1');
    applyTransform();
    pushHistory();
  });
  document.getElementById('vb-flip-v')?.addEventListener('click', () => {
    block.dataset.flipV = block.dataset.flipV === '1' ? '0' : '1';
    document.getElementById('vb-flip-v')?.classList.toggle('active', block.dataset.flipV === '1');
    applyTransform();
    pushHistory();
  });
}

window.showVectorProperties = showVectorProperties;
