import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return '#cccccc';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#cccccc';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

const SHAPE_ICONS = {
  star:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 9.8,6.2 14.5,6.2 10.8,8.9 12.2,13.5 8,10.8 3.8,13.5 5.2,8.9 1.5,6.2 6.2,6.2" fill="#888"/></svg>`,
  rectangle: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  ellipse:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  line:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  arrow:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/><polyline points="8,2 14,2 14,8" stroke="#888" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  polygon:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,12 2,12" stroke="#888" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>`,
};
const SHAPE_NAMES = {
  star: 'Star', rectangle: 'Rectangle', ellipse: 'Ellipse',
  line: 'Line', arrow: 'Arrow', polygon: 'Polygon',
};

export function showShapeProperties(block) {
  if (!block) return;

  const shapeType   = block.dataset.shapeType || 'rectangle';
  const rawColor    = block.dataset.shapeColor || '#cccccc';
  // 그라데이션 적용 상태: shapeGradient JSON 존재 또는 shapeColor가 linear-gradient(... CSS
  let gradientMeta = null;
  try { gradientMeta = block.dataset.shapeGradient ? JSON.parse(block.dataset.shapeGradient) : null; } catch (_) {}
  const isGradient  = !!gradientMeta || /gradient/.test(rawColor);
  const gradientCss = isGradient ? rawColor : '';
  // picker/hex 표시용 hex — 그라데이션이면 첫 stop, 아니면 그대로
  const color       = isGradient
    ? (gradientMeta?.stops?.[0]?.color || '#cccccc')
    : rawColor;
  const colorAlpha  = parseAlphaFromColor(color);
  const strokeWidth = parseInt(block.dataset.shapeStrokeWidth || '3');
  const strokeColor = block.dataset.shapeStrokeColor || color;
  const strokeColorAlpha = parseAlphaFromColor(strokeColor);
  const w           = parseInt(block.style.width)  || 100;
  const h           = parseInt(block.style.height) || 100;
  const iconSvg     = SHAPE_ICONS[shapeType] || SHAPE_ICONS.rectangle;
  const shapeName   = SHAPE_NAMES[shapeType] || shapeType;
  const id          = block.id || '';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">${iconSvg}</div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || shapeName}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${id}')">${id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'shape-color', hex: color, alpha: colorAlpha, gradientCss })}
      </div>
      <div class="prop-color-row" style="margin-top:8px;">
        <span class="prop-label">외곽선</span>
        ${colorFieldHTML({ idPrefix: 'shape-stroke-color', hex: strokeColor, alpha: strokeColorAlpha })}
      </div>
      <div class="prop-row" style="margin-top:8px;">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="shape-stroke-slider" min="0" max="20" step="1" value="${strokeWidth}">
        <input type="number" class="prop-number" id="shape-stroke-num" min="0" max="20" value="${strokeWidth}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="range" class="prop-slider" id="shape-w-slider" min="10" max="860" step="1" value="${w}">
        <input type="number" class="prop-number" id="shape-w-num" min="10" max="860" value="${w}">
      </div>
      <div class="prop-row">
        <span class="prop-label">H</span>
        <input type="range" class="prop-slider" id="shape-h-slider" min="10" max="860" step="1" value="${h}">
        <input type="number" class="prop-number" id="shape-h-num" min="10" max="860" value="${h}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="shape-rot-slider" min="-180" max="180" step="1" value="${parseInt(block.dataset.shapeRotation || '0')}">
        <input type="number" class="prop-number" id="shape-rot-num" min="-180" max="180" value="${parseInt(block.dataset.shapeRotation || '0')}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(id || null);

  const svg = block.querySelector('svg');
  // 부모 sub-section (shape frame)
  const ss = block.closest('.frame-block');

  // shape는 section padding을 무시하고 section 전체 폭(최대 860)까지 확장 가능 ───
  // wrap frame의 max-width 제한을 풀고, width가 inner를 넘으면 좌우 균등 음수 margin으로 padding 침범
  function _extendShapeFrameToSection() {
    if (!ss) return;
    const sec = block.closest('.section-block');
    if (!sec) return;
    const inner = sec.querySelector('.section-inner');
    if (!inner) return;
    // max-width / flex shrink 제한 풀기 — 한 번만 적용해도 OK
    if (ss.style.maxWidth !== 'none')   ss.style.maxWidth   = 'none';
    if (ss.style.flexShrink !== '0')    ss.style.flexShrink = '0';
    const innerW = inner.clientWidth;
    const secW = sec.offsetWidth || 860;
    const wrapW = parseFloat(ss.style.width) || parseInt(ss.dataset.width) || ss.offsetWidth || 0;
    if (wrapW > innerW) {
      // wrap이 inner content area를 넘으면 padding 침범 — section 좌/우 끝을 넘지 않게 clamp
      const maxOverflow = (secW - innerW) / 2;
      const half = Math.min((wrapW - innerW) / 2, maxOverflow);
      ss.style.marginLeft  = `-${half}px`;
      ss.style.marginRight = `-${half}px`;
    } else {
      if (ss.style.marginLeft)  ss.style.marginLeft  = '';
      if (ss.style.marginRight) ss.style.marginRight = '';
    }
  }
  _extendShapeFrameToSection();

  function applyColor(hex) {
    // perf: 동일 색이면 데이터·DOM 변경 자체를 스킵 → MutationObserver autosave 트리거 회피
    if (block.dataset.shapeColor === hex && !block.dataset.shapeGradient) return;
    block.dataset.shapeColor = hex;
    if (svg) {
      // 그라데이션이 적용돼 있을 때만 clear 수행 (대부분의 솔리드 드래그에선 no-op이라 skip)
      if (block.dataset.shapeGradient) _clearShapeGradient(block);
      // svg.style.color 도 값이 같으면 스킵 (실제로 같을 일은 드물지만 안전망)
      if (svg.style.color !== hex) svg.style.color = hex;
    }
    window.scheduleAutoSave?.();
  }

  function applyGradient(detail) {
    if (!svg || !detail) return;
    _applyShapeGradient(block, svg, detail);
    block.dataset.shapeColor = detail.css || '';
    block.dataset.shapeGradient = JSON.stringify({
      type: detail.type, angle: detail.angle, stops: detail.stops,
    });
    window.scheduleAutoSave?.();
  }

  function applyStroke(v) {
    block.dataset.shapeStrokeWidth = String(v);
    if (svg) svg.style.strokeWidth = String(v);
    // rectangle/ellipse: inner SVG geometry를 stroke에 맞춰 재계산 (stroke=0이면 풀폭)
    window.refreshShapeInnerSVG?.(block);
    window.scheduleAutoSave?.();
  }

  function applyStrokeColor(c) {
    block.dataset.shapeStrokeColor = c;
    if (svg) svg.style.stroke = c;
    window.scheduleAutoSave?.();
  }

  function applySize(newW, newH) {
    // frame(ss)만 리사이즈 — block/svg는 CSS 100%로 자동 추종
    if (ss) {
      ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW);
      ss.style.height = `${newH}px`; ss.dataset.height = String(newH);
    }
    // 폭이 inner를 넘으면 padding 침범 자동 적용
    _extendShapeFrameToSection();
    // 회전 적용 중이면 frame 잔존 보정만 정리 (크기는 사용자가 지정한 값 그대로 유지)
    const curRot = parseInt(block.dataset.shapeRotation || '0');
    if (curRot !== 0 && typeof _updateFrameForRotation === 'function') {
      _updateFrameForRotation(curRot);
    }
    window.scheduleAutoSave?.();
  }

  // ── 색상 피커 ──
  wireColorField('shape-color', {
    initialAlpha: colorAlpha,
    onApply: (c) => applyColor(c),
    onCommit: () => window.pushHistory?.(),
  });

  // ── 외곽선 색상 피커 ──
  wireColorField('shape-stroke-color', {
    initialAlpha: strokeColorAlpha,
    onApply: (c) => applyStrokeColor(c),
    onCommit: () => window.pushHistory?.(),
  });

  // 초기 svg.stroke 동기화 — 첫 mount 시 dataset.shapeStrokeColor가 있으면 즉시 적용
  if (svg && block.dataset.shapeStrokeColor) {
    svg.style.stroke = block.dataset.shapeStrokeColor;
  }

  // ── 그라데이션 이벤트 수신 (color-picker gradient 탭) ──
  // perf: 매 input마다 pushHistory 발생하던 것을 commit 이벤트로 분리.
  // goya-cp:gradient — 라이브 미리보기(매 프레임), pushHistory 호출 안 함.
  // goya-cp:gradient-commit — 사용자 확정(마우스업·select 변경), pushHistory 호출.
  const shapeColorInput = document.getElementById('shape-color-color');
  if (shapeColorInput && !shapeColorInput._gradWired) {
    shapeColorInput._gradWired = true;
    shapeColorInput.addEventListener('goya-cp:gradient', (e) => {
      applyGradient(e.detail);
      // detail.commit 플래그가 있을 때만 history 발행 — 평소엔 라이브 미리보기.
      if (e.detail && e.detail.commit) window.pushHistory?.();
    });
    shapeColorInput.addEventListener('goya-cp:gradient-commit', () => {
      window.pushHistory?.();
    });
  }

  // ── 스트로크 두께 ──
  const strokeSlider = document.getElementById('shape-stroke-slider');
  const strokeNum    = document.getElementById('shape-stroke-num');
  strokeSlider.addEventListener('input',  () => { strokeNum.value = strokeSlider.value; applyStroke(parseInt(strokeSlider.value)); });
  strokeSlider.addEventListener('change', () => window.pushHistory?.());
  strokeNum.addEventListener('input', () => {
    const v = Math.min(20, Math.max(0, parseInt(strokeNum.value) || 0));
    strokeSlider.value = v; applyStroke(v);
  });
  strokeNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 W ──
  const wSlider = document.getElementById('shape-w-slider');
  const wNum    = document.getElementById('shape-w-num');
  wSlider.addEventListener('input',  () => { wNum.value = wSlider.value; applySize(parseInt(wSlider.value), parseInt(hSlider.value)); });
  wSlider.addEventListener('change', () => window.pushHistory?.());
  wNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(wNum.value) || 10));
    wSlider.value = v; applySize(v, parseInt(hSlider.value));
  });
  wNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 H ──
  const hSlider = document.getElementById('shape-h-slider');
  const hNum    = document.getElementById('shape-h-num');
  hSlider.addEventListener('input',  () => { hNum.value = hSlider.value; applySize(parseInt(wSlider.value), parseInt(hSlider.value)); });
  hSlider.addEventListener('change', () => window.pushHistory?.());
  hNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(hNum.value) || 10));
    hSlider.value = v; applySize(parseInt(wSlider.value), v);
  });
  hNum.addEventListener('change', () => window.pushHistory?.());

  // ── 회전 ──
  // 사용자 의도: 회전해도 frame 자체 크기는 변하지 않아야 함.
  // 시각적 잘림은 부모 frame이 overflow:visible 되도록 CSS에서 처리 (회전된 shape를 가진 frame).
  // 이전 시도(boundedW/H minWidth/minHeight 보정)는 사용자가 "크기가 커진다"고 느끼게 했으므로 폐기.
  // 이 함수는 잔존 inline 보정값을 깨끗이 해제하는 용도로만 남긴다 (구버전 데이터 호환).
  function _updateFrameForRotation(_deg) {
    const frame = block.closest('.frame-block');
    if (!frame) return;
    // 이전 버전이 남긴 보정값 정리
    if (frame.style.minHeight) frame.style.removeProperty('min-height');
    if (frame.style.minWidth)  frame.style.removeProperty('min-width');
  }
  function applyRotation(deg) {
    const d = Math.max(-180, Math.min(180, parseInt(deg) || 0));
    // 기존 transform에서 rotate만 갱신 (translate, scale 등 다른 transform 보존)
    const existing = block.style.transform || '';
    const stripped = existing.replace(/rotate\([^)]*\)\s*/g, '').trim();
    if (d === 0) {
      // 회전 해제: transform/transform-origin/dataset 잔존을 깨끗이 정리
      block.style.transform = stripped;
      if (!block.style.transform) {
        block.style.removeProperty('transform');
        block.style.removeProperty('transform-origin');
      }
      delete block.dataset.shapeRotation;
    } else {
      block.dataset.shapeRotation = String(d);
      block.style.transform = stripped ? `${stripped} rotate(${d}deg)` : `rotate(${d}deg)`;
      block.style.transformOrigin = 'center center';
    }
    _updateFrameForRotation(d);
    window.scheduleAutoSave?.();
  }
  const rotSlider = document.getElementById('shape-rot-slider');
  const rotNum    = document.getElementById('shape-rot-num');
  if (rotSlider && rotNum) {
    rotSlider.addEventListener('input',  () => { rotNum.value = rotSlider.value; applyRotation(rotSlider.value); });
    rotSlider.addEventListener('change', () => window.pushHistory?.());
    rotNum.addEventListener('input', () => {
      const v = Math.min(180, Math.max(-180, parseInt(rotNum.value) || 0));
      rotSlider.value = v; applyRotation(v);
    });
    rotNum.addEventListener('change', () => window.pushHistory?.());
  }
}

window.showShapeProperties = showShapeProperties;

/* ── SVG 그라데이션 적용 헬퍼 ──
 * shape SVG 내부에 <defs><linearGradient|radialGradient> 를 동적 inject 하고
 * fill 을 url(#id) 로 바꾼다. stroke 는 currentColor 유지.
 * id 는 block.id 기반으로 안정적으로 부여 — outerHTML 직렬화 후 재로드해도 충돌 없음.
 */
function _gradIdFor(block) {
  const base = block.id || 'shp_anon';
  return `grad-${base}`;
}

function _clearShapeGradient(block) {
  if (!block) return;
  const svg = block.querySelector('svg');
  if (!svg) return;
  const id = _gradIdFor(block);
  const def = svg.querySelector(`#${CSS.escape(id)}`);
  if (def) {
    const parentDefs = def.closest('defs');
    def.remove();
    if (parentDefs && !parentDefs.children.length) parentDefs.remove();
  }
  // fill="url(#..)" 인 요소들을 currentColor 로 복귀
  svg.querySelectorAll('[fill^="url(#grad-"]').forEach(el => {
    el.setAttribute('fill', 'currentColor');
  });
  delete block.dataset.shapeGradient;
}

// perf: 그라데이션 라이브 업데이트는 매 프레임 일어남. 기존 코드는 매번
// <linearGradient> 노드를 통째로 제거→재생성하고 모든 fillable에 setAttribute 호출.
// 같은 타입(linear/radial) + 같은 stop 개수가 유지될 때는 stop 요소만 재활용해서
// stop-color/offset 만 갱신하고, fill="url(#...)" 적용은 처음 한 번만 수행.
const SVG_NS = 'http://www.w3.org/2000/svg';
const FILLABLE_SEL = 'rect,ellipse,circle,polygon,path';

function _applyShapeGradient(block, svg, detail) {
  const id = _gradIdFor(block);
  const targetType = detail.type === 'radial' ? 'radialGradient' : 'linearGradient';
  const stops = detail.stops || [];

  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  let gradNode = svg.querySelector(`#${CSS.escape(id)}`);

  // 재사용 조건: 같은 element 이름 + 같은 stop 개수 → 속성·자식 stop 갱신만
  const reuse = gradNode && gradNode.tagName === targetType && gradNode.children.length === stops.length;

  if (!reuse) {
    if (gradNode) gradNode.remove();
    gradNode = document.createElementNS(SVG_NS, targetType);
    gradNode.setAttribute('id', id);
    for (let i = 0; i < stops.length; i++) {
      gradNode.appendChild(document.createElementNS(SVG_NS, 'stop'));
    }
    defs.appendChild(gradNode);
  }

  // 좌표/축 갱신
  if (targetType === 'radialGradient') {
    gradNode.setAttribute('cx', '50%');
    gradNode.setAttribute('cy', '50%');
    gradNode.setAttribute('r', '50%');
  } else {
    const a = ((detail.angle ?? 90) - 90) * Math.PI / 180;
    const x1 = 0.5 - Math.cos(a) * 0.5;
    const y1 = 0.5 - Math.sin(a) * 0.5;
    const x2 = 0.5 + Math.cos(a) * 0.5;
    const y2 = 0.5 + Math.sin(a) * 0.5;
    gradNode.setAttribute('x1', x1.toFixed(4));
    gradNode.setAttribute('y1', y1.toFixed(4));
    gradNode.setAttribute('x2', x2.toFixed(4));
    gradNode.setAttribute('y2', y2.toFixed(4));
  }

  // stop 갱신 (같은 값이면 setAttribute 스킵해 mutation 폭주 방지)
  const stopNodes = gradNode.children;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const off = Math.round((s.offset ?? 0) * 100) + '%';
    const col = s.color;
    const op = (s.opacity == null) ? '1' : String(Math.max(0, Math.min(1, +s.opacity)));
    const n = stopNodes[i];
    if (n.getAttribute('offset') !== off) n.setAttribute('offset', off);
    if (n.getAttribute('stop-color') !== col) n.setAttribute('stop-color', col);
    if (n.getAttribute('stop-opacity') !== op) n.setAttribute('stop-opacity', op);
  }

  // fill="url(#id)" 는 한 번만 적용 — 같은 url이면 setAttribute 자체를 스킵.
  // querySelectorAll 결과는 라이브가 아니라 매번 새로 만들지만, fillable 셰이프 한 개당
  // 보통 element 수가 적어 cost는 미미. 다만 같은 url이면 노드 mutation 자체 회피.
  const urlVal = `url(#${id})`;
  const nodes = svg.querySelectorAll(FILLABLE_SEL);
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const f = el.getAttribute('fill');
    if (f === 'none') continue;
    if (f !== urlVal) el.setAttribute('fill', urlVal);
  }
}

window._applyShapeGradient = _applyShapeGradient;
window._clearShapeGradient = _clearShapeGradient;
