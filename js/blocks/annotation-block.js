// annotation-block.js — 펜툴 어노테이션 블록 팩토리 (block-factory.js에서 분리, 2026-06-14)
// section 좌상단 기준 절대좌표 points[] (마지막 점이 라벨 위치).
// 분리 사유: block-factory.js(4400+줄) 책임 분해 — 어노테이션 생성/렌더 SVG 헬퍼는 자기완결 단위.
// 외부 의존: window.genId 하나(전역). window.* 노출은 기존과 동일 유지(annotation-tool.js / prop-annotation.js 호환).

const genId = window.genId || ((p) => p + '_' + Math.random().toString(36).slice(2, 9));

const ANNOT_DEFAULTS = {
  strokeColor:     '#1a1a1a',    // 디폴트: 검정 (프리셋에서 빨강/파랑 등 선택 가능)
  strokeWidth:     1.5,
  anchorShape:     'circle',     // 'circle' | 'square' | 'triangle' | 'arrowhead' | 'glow' | 'none'
  anchorSize:      7,            // 시작점 도형 크기 (지름 또는 한 변)
  labelFontSize:   20,
  labelColor:      '#1a1a1a',
  labelBg:         '#ffffff',
  labelBorderColor:'#1a1a1a',
  text:            '텍스트',
  labelMode:       'text',       // 'text' | 'image'
  labelImageSrc:   '',           // image 모드일 때 dataURL 또는 URL
  labelImageSize:  120,          // image 모드 정사각 가로px (= 세로)
  labelImageRadius: 0,           // image 모드 border-radius (0~50, %)
  labelBorderStyle: 'solid',     // 'solid' | 'dashed' | 'dotted'
  labelBorderWidth: 1,           // border 두께 (px)
};
window.ANNOT_DEFAULTS = ANNOT_DEFAULTS;

// shape별 SVG anchor 노드 문자열
// angleDeg: 첫 segment 방향(도). triangle / arrowhead 회전에 사용. 그 외 shape는 무관.
function _renderAnchorSVG(shape, size, x, y, color, angleDeg = 0) {
  const s = Math.max(2, Number(size) || 7);
  const half = s / 2;
  if (shape === 'none') return '';
  if (shape === 'square') {
    return `<rect class="annot-anchor" x="${x - half}" y="${y - half}" width="${s}" height="${s}" fill="${color}"/>`;
  }
  if (shape === 'triangle') {
    // anchor 기준 오른쪽으로 향하는 정삼각형 — 회전은 angleDeg+180 (꼭지점이 anchor 위치를 가리키도록)
    const h = s * Math.sqrt(3) / 2;
    const tx1 = x + h * (2/3),       ty1 = y;            // 꼭지점 (끝)
    const tx2 = x - h * (1/3),       ty2 = y - half;     // 좌상
    const tx3 = x - h * (1/3),       ty3 = y + half;     // 좌하
    const adj = angleDeg + 180;
    return `<polygon class="annot-anchor" points="${tx1},${ty1} ${tx2},${ty2} ${tx3},${ty3}" fill="${color}" transform="rotate(${adj} ${x} ${y})"/>`;
  }
  if (shape === 'arrowhead') {
    // V자 stroke (선 두 개) — anchor에서 양쪽 뒤로 벌어짐. 회전 +180 (V 끝이 anchor 자체 위치를 가리키게)
    const len = s * 1.2;            // V 길이
    const spread = s * 0.85;        // V 폭
    const lx = x - len, lyTop = y - spread, lyBot = y + spread;
    const sw = Math.max(1.2, s * 0.22);
    const adj = angleDeg + 180;
    return `<g class="annot-anchor" transform="rotate(${adj} ${x} ${y})">`
         + `<line x1="${lx}" y1="${lyTop}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`
         + `<line x1="${lx}" y1="${lyBot}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`
         + `</g>`;
  }
  if (shape === 'glow') {
    // 그라데이션 서클 — 중심 진하고 가장자리로 갈수록 옅어짐 (radial gradient).
    // defs/circle 둘 다 같이 제거되도록 <g class="annot-anchor">로 묶음.
    const gradId = 'annot-glow-' + Math.random().toString(36).slice(2, 9);
    const r = s; // 글로우 반경 = size (시각상 일반 circle보다 부드럽게 더 큼)
    return `<g class="annot-anchor">`
         + `<defs><radialGradient id="${gradId}">`
         + `<stop offset="0%" stop-color="${color}" stop-opacity="0.95"/>`
         + `<stop offset="55%" stop-color="${color}" stop-opacity="0.45"/>`
         + `<stop offset="100%" stop-color="${color}" stop-opacity="0"/>`
         + `</radialGradient></defs>`
         + `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${gradId})"/>`
         + `</g>`;
  }
  // default circle
  return `<circle class="annot-anchor" cx="${x}" cy="${y}" r="${half}" fill="${color}"/>`;
}
window._renderAnnotAnchorSVG = _renderAnchorSVG;

// 라벨 부착 모서리 = 마지막 segment 방향으로 결정 (좌/우/상/하 중앙 4방향)
// 중복점(같은 좌표) skip — 펜툴 더블클릭 종료 시 마지막 점이 중복으로 push되는 케이스 방어
function _calcLabelTransform(points) {
  if (!Array.isArray(points) || points.length < 2) return 'translate(0,-50%)';
  const last = points[points.length - 1];
  let prev = null;
  for (let i = points.length - 2; i >= 0; i--) {
    const p = points[i];
    if (p[0] !== last[0] || p[1] !== last[1]) { prev = p; break; }
  }
  if (!prev) return 'translate(0,-50%)';
  const dx = last[0] - prev[0];
  const dy = last[1] - prev[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'translate(0,-50%)' : 'translate(-100%,-50%)';
  }
  return dy >= 0 ? 'translate(-50%,0)' : 'translate(-50%,-100%)';
}
window._calcAnnotLabelTransform = _calcLabelTransform;

// 첫 segment(anchor → 두 번째 점) 방향(deg). triangle/arrowhead 회전에 사용.
// 중복점 skip.
function _calcAnchorAngle(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const first = points[0];
  let next = null;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p[0] !== first[0] || p[1] !== first[1]) { next = p; break; }
  }
  if (!next) return 0;
  return Math.atan2(next[1] - first[1], next[0] - first[0]) * 180 / Math.PI;
}
window._calcAnnotAnchorAngle = _calcAnchorAngle;

function makeAnnotationBlock(opts = {}) {
  // backward compat: ax/ay/lx/ly 입력 지원
  let points = opts.points;
  if (!Array.isArray(points) || points.length < 2) {
    const ax = Number(opts.ax) || 0;
    const ay = Number(opts.ay) || 0;
    const lx = Number(opts.lx) || 0;
    const ly = Number(opts.ly) || 0;
    points = [[ax, ay], [lx, ly]];
  } else {
    points = points.map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
  }
  const last = points[points.length - 1];
  const first = points[0];

  const strokeColor      = opts.strokeColor      ?? ANNOT_DEFAULTS.strokeColor;
  const strokeWidth      = opts.strokeWidth      ?? ANNOT_DEFAULTS.strokeWidth;
  const anchorShape      = opts.anchorShape      ?? ANNOT_DEFAULTS.anchorShape;
  const anchorSize       = opts.anchorSize       ?? ANNOT_DEFAULTS.anchorSize;
  const labelFontSize    = opts.labelFontSize    ?? ANNOT_DEFAULTS.labelFontSize;
  const labelColor       = opts.labelColor       ?? ANNOT_DEFAULTS.labelColor;
  const labelBg          = opts.labelBg          ?? ANNOT_DEFAULTS.labelBg;
  const labelBorderColor = opts.labelBorderColor ?? ANNOT_DEFAULTS.labelBorderColor;
  const text             = opts.text             ?? ANNOT_DEFAULTS.text;
  const labelMode        = opts.labelMode        ?? ANNOT_DEFAULTS.labelMode;
  const labelImageSrc    = opts.labelImageSrc    ?? ANNOT_DEFAULTS.labelImageSrc;
  const labelImageSize   = opts.labelImageSize   ?? ANNOT_DEFAULTS.labelImageSize;
  const labelImageRadius = opts.labelImageRadius ?? ANNOT_DEFAULTS.labelImageRadius;
  const labelBorderStyle = opts.labelBorderStyle ?? ANNOT_DEFAULTS.labelBorderStyle;
  const labelBorderWidth = opts.labelBorderWidth ?? ANNOT_DEFAULTS.labelBorderWidth;

  const block = document.createElement('div');
  block.className = 'annotation-block';
  block.dataset.type = 'annotation';
  block.id = genId('ant');

  // dataset 저장
  block.dataset.points           = JSON.stringify(points);
  block.dataset.anchorX          = String(first[0]); // backward compat
  block.dataset.anchorY          = String(first[1]);
  block.dataset.labelX           = String(last[0]);
  block.dataset.labelY           = String(last[1]);
  block.dataset.text             = text;
  block.dataset.strokeColor      = strokeColor;
  block.dataset.strokeWidth      = String(strokeWidth);
  block.dataset.anchorShape      = anchorShape;
  block.dataset.anchorSize       = String(anchorSize);
  block.dataset.labelFontSize    = String(labelFontSize);
  block.dataset.labelColor       = labelColor;
  block.dataset.labelBg          = labelBg;
  block.dataset.labelBorderColor = labelBorderColor;
  block.dataset.labelMode        = labelMode;
  block.dataset.labelBorderStyle = labelBorderStyle;
  block.dataset.labelBorderWidth = String(labelBorderWidth);
  if (labelMode === 'image') {
    block.dataset.labelImageSrc    = labelImageSrc;
    block.dataset.labelImageSize   = String(labelImageSize);
    block.dataset.labelImageRadius = String(labelImageRadius);
  }

  const ptsAttr = points.map(p => `${p[0]},${p[1]}`).join(' ');
  const anchorAngle = _calcAnchorAngle(points);
  const anchorSvg = _renderAnchorSVG(anchorShape, anchorSize, first[0], first[1], strokeColor, anchorAngle);
  // 이미지 원형(라운드 50% 또는 충분히 큰 라운드) 모드면 라벨 중앙에 부착 — 원에 모서리 없으니 중앙이 자연스러움
  const isImgCircleish = labelMode === 'image' && (parseFloat(labelImageRadius) || 0) >= 25;
  const labelTf = isImgCircleish ? 'translate(-50%,-50%)' : _calcLabelTransform(points);
  // 이미지 모드 + radius > 0이면 라벨박스 padding 0 + border-radius 동기화 → 이미지+테두리가 같은 모양
  const imgWrapping = labelMode === 'image' && (parseFloat(labelImageRadius) || 0) > 0;
  let labelStyle = `left:${last[0]}px;top:${last[1]}px;`
    + `transform:${labelTf};`
    + `font-size:${labelFontSize}px;`
    + `color:${labelColor};`
    + `background:${labelBg};`
    + `border-color:${labelBorderColor};`
    + `border-style:${labelBorderStyle};`
    + `border-width:${labelBorderWidth}px;`;
  if (imgWrapping) {
    const r = Math.max(0, Math.min(50, parseFloat(labelImageRadius) || 0));
    labelStyle += `padding:0;border-radius:${r}%;overflow:hidden;`;
  }
  const labelInner = _renderAnnotLabelInner(labelMode, { text, labelImageSrc, labelImageSize, labelImageRadius });
  const labelExtraClass = labelMode === 'image' ? ' annot-label-image' : '';
  block.innerHTML = `
    <svg class="annot-svg" xmlns="http://www.w3.org/2000/svg">
      <polyline class="annot-line" points="${ptsAttr}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>
      ${anchorSvg}
    </svg>
    <div class="annot-label${labelExtraClass}" contenteditable="false" style="${labelStyle}">${labelInner}</div>`;
  return block;
}
window.makeAnnotationBlock = makeAnnotationBlock;

// 라벨박스 내부 컨텐츠 — text 모드 = 텍스트, image 모드 = <img> 또는 체크패턴 placeholder
function _renderAnnotLabelInner(mode, { text, labelImageSrc, labelImageSize, labelImageRadius }) {
  if (mode === 'image') {
    const size  = parseInt(labelImageSize)   || ANNOT_DEFAULTS.labelImageSize;
    const rPct  = Math.max(0, Math.min(50, parseFloat(labelImageRadius) || 0));
    const rCss  = rPct + '%';
    if (!labelImageSrc) {
      // 다른 asset/icon-circle 블록과 동일한 체커보드 placeholder
      return `<div class="annot-label-img-placeholder" style="width:${size}px;height:${size}px;border-radius:${rCss};background:repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 16px 16px;display:flex;align-items:center;justify-content:center;color:#888;font-size:11px;"></div>`;
    }
    return `<img class="annot-label-img" src="${labelImageSrc}" style="width:${size}px;height:${size}px;border-radius:${rCss};display:block;object-fit:cover;" draggable="false">`;
  }
  return text;
}
window._renderAnnotLabelInner = _renderAnnotLabelInner;
