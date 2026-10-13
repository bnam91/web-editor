// annotation-block.js — 펜툴 어노테이션 블록 팩토리 (block-factory.js에서 분리, 2026-06-14)
// section 좌상단 기준 절대좌표 points[] (마지막 점이 라벨 위치).
// 분리 사유: block-factory.js(4400+줄) 책임 분해 — 어노테이션 생성/렌더 SVG 헬퍼는 자기완결 단위.
// 외부 의존: window.genId 하나(전역). window.* 노출은 기존과 동일 유지(annotation-tool.js / prop-annotation.js 호환).

import { checkerBgBigColors } from '../checker-tokens.js';
import { stripCtlChars } from '../util/sanitize-rich-text.js';   // ★1013t2C6 — 라벨 글 정화(스티커 글과 같은 한 벌)

// ★«부를 때» 찾는다 — 모듈 로드 시점에 잡아두면 drag-utils 가 아직 window.genId 를
//   안 심었을 때 폴백에 고정돼, 여기서 만든 블록만 actorId 조각이 빠진다(협업에서 출처 불명).
const genId = (p) => (typeof window.genId === 'function'
  ? window.genId(p)
  : p + '_' + Math.random().toString(36).slice(2, 9));

const ANNOT_DEFAULTS = {
  strokeColor:     '#1a1a1a',    // 디폴트: 검정 (프리셋에서 빨강/파랑 등 선택 가능)
  strokeWidth:     1.5,
  anchorShape:     'circle',     // 'circle' | 'square' | 'triangle' | 'arrowhead' | 'glow' | 'none'
  anchorSize:      7,            // 시작점 도형 크기 (지름 또는 한 변)
  labelFontSize:   24,           // ★1013t1A2 현빈 「텍스트는 기본 24」 — 옛 저장본은 dataset.labelFontSize 를 들고 있어 그대로
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

/* ★1013t1A3 — 라벨 «개별 위치»(방사형 블럭 호의 항목 라벨 간격 labelDx/labelDy 를 차용 · b67106ab).
   뜻: 자동 위치(마지막 점 + 4방향 부착 transform)로부터의 차이(px, 섹션 좌표). 선 끝점은 그대로 두고 라벨만 떨어진다.
   저장: dataset.labelDx / labelDy — 0 이면 키를 안 단다(= 자동 배치). 그리기: CSS `translate` 속성
   (transform 과 따로 노는 속성이라 4방향 부착 transform 을 안 건드린다).
   ⛔style 에서 translate 는 «맨 끝»이다 — makeAnnotationBlock 도, 라이브 쓰기(annotApplyLabelOffset)도.
     순서가 갈리면 다시 그린 라벨과 라이브 라벨의 style 문자열이 달라 ⌘Z 유령 칸이 난다(아래 F2 주석과 같은 병). */
const ANNOT_LIMITS = { labelDx: { min: -600, max: 600 }, labelDy: { min: -600, max: 600 } };
window.ANNOT_LIMITS = ANNOT_LIMITS;
function _annClampOff(v, key) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.min(ANNOT_LIMITS[key].max, Math.max(ANNOT_LIMITS[key].min, n));
}
/** 라벨 오프셋 읽기 → { dx, dy } (없으면 0). */
function annotLabelOffsetOf(block) {
  const ds = block?.dataset || {};
  return { dx: _annClampOff(ds.labelDx || 0, 'labelDx'), dy: _annClampOff(ds.labelDy || 0, 'labelDy') };
}
/** 개별 위치가 있나. */
function annotLabelIsManual(block) {
  const o = annotLabelOffsetOf(block);
  return o.dx !== 0 || o.dy !== 0;
}
/** 라벨 DOM 에 오프셋을 칠한다 — translate 를 떼고 «맨 끝»에 다시 붙인다(0 이면 뗀 채). */
function annotApplyLabelOffset(block) {
  const label = block?.querySelector?.('.annot-label');
  if (!label) return;
  const { dx, dy } = annotLabelOffsetOf(block);
  label.style.removeProperty('translate');
  if (dx !== 0 || dy !== 0) label.style.translate = `${dx}px ${dy}px`;
}
/** 오프셋 쓰기(dataset + 그리기). 0 이면 키를 지운다. 바뀌었으면 true. */
function annotSetLabelOffset(block, dx, dy) {
  const before = annotLabelOffsetOf(block);
  const x = _annClampOff(dx, 'labelDx'), y = _annClampOff(dy, 'labelDy');
  if (x === 0) delete block.dataset.labelDx; else block.dataset.labelDx = String(x);
  if (y === 0) delete block.dataset.labelDy; else block.dataset.labelDy = String(y);
  annotApplyLabelOffset(block);
  return before.dx !== x || before.dy !== y;
}
/** 자동 배치로 되돌리기 — 바뀌었으면 true. */
function annotResetLabelOffset(block) {
  return annotSetLabelOffset(block, 0, 0);
}
Object.assign(window, { annotLabelOffsetOf, annotLabelIsManual, annotApplyLabelOffset, annotSetLabelOffset, annotResetLabelOffset });

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
  const labelDx          = _annClampOff(opts.labelDx ?? 0, 'labelDx');   // ★1013t1A3
  const labelDy          = _annClampOff(opts.labelDy ?? 0, 'labelDy');

  const block = document.createElement('div');
  block.className = 'annotation-block';
  block.dataset.type = 'annotation';
  block.id = genId('ant');

  /* ★[F2 · 2026-09-22] 「복원한 결과 = 복원의 입력」 — 여기서 «미리» 써 둬야 하는 여섯 줄.
     rebindAll(js/io/save-load.js, annotation 재구성)이 복원·페이지전환 «뒤»에 이 여섯을 그대로
     다시 쓴다. 그런데 삽입 시점의 블럭엔 없어서, ⌘Z 한 번만 지나면 «복원 직후 라이브 ≠ 방금
     복원한 스냅샷»(차이 = 이 style 속성 98바이트)이 되고 다음 표본이 칸을 하나 더 만든다.
     그 칸의 ⌘Z 는 화면을 못 바꾼다 — 값이 css/editor-blocks.css:2877 .annotation-block 과
     «같은 값»이라 눈에 보이는 차이가 애초에 없기 때문이다(도형의 T-131 ⑧ 과 같은 병, 다른 자리).
     ⛔순서를 바꾸지 마라 — rebindAll 이 쓰는 순서와 같아야 직렬화 문자열이 같다.
     ⛔CSS 에 있다고 지우지도 마라 — 내보낸 HTML 은 앱 CSS 를 안 싣는다(js/io/export-html.js:152). */
  block.style.position = 'absolute';
  block.style.left = '0'; block.style.top = '0';
  block.style.width = '100%'; block.style.height = '100%';
  block.style.pointerEvents = 'none';

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
  if (labelDx !== 0) block.dataset.labelDx = String(labelDx);   // ★1013t1A3 — 0 이면 키 없음(= 자동 배치)
  if (labelDy !== 0) block.dataset.labelDy = String(labelDy);

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
  // ★1013t1A3 — 개별 위치는 «맨 끝»(annotApplyLabelOffset 과 같은 자리)
  if (labelDx !== 0 || labelDy !== 0) labelStyle += `translate:${labelDx}px ${labelDy}px;`;
  const labelInner = _renderAnnotLabelInner(labelMode, { text, labelImageSrc, labelImageSize, labelImageRadius });
  const labelExtraClass = labelMode === 'image' ? ' annot-label-image' : '';
  block.innerHTML = `
    <svg class="annot-svg" xmlns="http://www.w3.org/2000/svg">
      <polyline class="annot-line" points="${ptsAttr}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>
      ${anchorSvg}
    </svg>
    <div class="annot-label${labelExtraClass}" contenteditable="false" style="${labelStyle}">${labelInner}</div>`;
  /* ★1013t2C6 — 글은 «항상 글자»로 넣는다(textContent). 예전엔 innerHTML 에 날로 넣어
     라벨에 `<b>x</b>` 를 치면 다시 그릴 때(rebindAll · 리로드 · ⌘Z 복원) 태그가 됐다.
     줄바꿈(\n)은 글자 그대로 두고 CSS(white-space: pre)가 줄로 그린다. */
  if (labelMode !== 'image') block.querySelector('.annot-label').textContent = text;
  return block;
}
window.makeAnnotationBlock = makeAnnotationBlock;

/* ★1013t1A3-pre — 「dataset → makeAnnotationBlock 의 opts」 한 벌.
   읽는 자리가 둘이었다(js/io/save-load.js rebindAll · js/props/prop-annotation.js _readState)인데
   rebindAll 쪽이 labelMode · labelImageSrc/Size/Radius · labelBorderStyle/Width 여섯을 «안 읽어»,
   리로드·⌘Z 복원(둘 다 rebindAll)마다 라벨이 기본값으로 다시 그려졌다
   (2026-10-13 실측: 선 스타일=대시 → 리로드 → dataset dashed · 화면 solid).
   ⛔새 칸을 더하면 «여기 한 곳»에만 더한다 — 두 자리가 다시 갈라지면 같은 병이 난다. */
const _annNum = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
function annotPropsFromDataset(block) {
  const ds = block.dataset, D = ANNOT_DEFAULTS;
  let points = null;
  try { points = JSON.parse(ds.points || 'null'); } catch (_) { points = null; }
  if (!Array.isArray(points) || points.length < 2) {
    points = [[_annNum(ds.anchorX, 0), _annNum(ds.anchorY, 0)], [_annNum(ds.labelX, 0), _annNum(ds.labelY, 0)]];
  } else {
    points = points.map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
  }
  const label = block.querySelector('.annot-label');
  const labelMode = ds.labelMode === 'image' ? 'image' : 'text';
  return {
    points,
    text:             ds.text || (label && labelMode === 'text' ? (label.textContent || '').trim() : '') || D.text,
    strokeColor:      ds.strokeColor      || D.strokeColor,
    strokeWidth:      _annNum(ds.strokeWidth, D.strokeWidth),
    anchorShape:      ds.anchorShape      || D.anchorShape,
    anchorSize:       _annNum(ds.anchorSize, D.anchorSize),
    labelFontSize:    _annNum(ds.labelFontSize, D.labelFontSize),
    labelColor:       ds.labelColor       || D.labelColor,
    labelBg:          ds.labelBg          || D.labelBg,
    labelBorderColor: ds.labelBorderColor || D.labelBorderColor,
    labelMode,
    labelImageSrc:    ds.labelImageSrc    || '',
    labelImageSize:   parseInt(ds.labelImageSize, 10) || D.labelImageSize,
    labelImageRadius: _annNum(ds.labelImageRadius, D.labelImageRadius),
    labelBorderStyle: ds.labelBorderStyle || D.labelBorderStyle,
    labelBorderWidth: _annNum(ds.labelBorderWidth, D.labelBorderWidth),
    labelDx:          annotLabelOffsetOf(block).dx,   // ★1013t1A3 — 안 읽으면 리로드·⌘Z 복원 때 오프셋이 화면에서 사라진다
    labelDy:          annotLabelOffsetOf(block).dy,
  };
}
window.annotPropsFromDataset = annotPropsFromDataset;
/* rebindAll 이 fresh 블럭에서 «되돌려 쓰는» dataset 키 — 팩토리가 쓰는 키 전부(순서 = 팩토리 순서). */
const ANNOT_DATA_KEYS = ['points', 'anchorX', 'anchorY', 'labelX', 'labelY', 'text', 'strokeColor', 'strokeWidth',
  'anchorShape', 'anchorSize', 'labelFontSize', 'labelColor', 'labelBg', 'labelBorderColor', 'labelMode',
  'labelBorderStyle', 'labelBorderWidth', 'labelImageSrc', 'labelImageSize', 'labelImageRadius', 'labelDx', 'labelDy'];
window.ANNOT_DATA_KEYS = ANNOT_DATA_KEYS;

// 라벨박스 내부 컨텐츠 — text 모드 = 텍스트, image 모드 = <img> 또는 체크패턴 placeholder
function _renderAnnotLabelInner(mode, { text, labelImageSrc, labelImageSize, labelImageRadius }) {
  if (mode === 'image') {
    const size  = parseInt(labelImageSize)   || ANNOT_DEFAULTS.labelImageSize;
    const rPct  = Math.max(0, Math.min(50, parseFloat(labelImageRadius) || 0));
    const rCss  = rPct + '%';
    if (!labelImageSrc) {
      // 다른 asset/icon-circle 블록과 동일한 체커보드 placeholder
      return `<div class="annot-label-img-placeholder" style="width:${size}px;height:${size}px;border-radius:${rCss};background:${checkerBgBigColors('16px')};display:flex;align-items:center;justify-content:center;color:#888;font-size:11px;"></div>`;
    }
    return `<img class="annot-label-img" src="${labelImageSrc}" style="width:${size}px;height:${size}px;border-radius:${rCss};display:block;object-fit:cover;" draggable="false">`;
  }
  return '';   // ★1013t2C6 — text 모드 글은 makeAnnotationBlock 이 textContent 로 넣는다(⛔innerHTML 로 되돌리지 마라 · 이스케이프 사본도 만들지 마라)
}
window._renderAnnotLabelInner = _renderAnnotLabelInner;

/* ★1013t2C6 — 라벨 글 «확정 값» 한 벌. 편집 확정(annotation-select.js annotBeginLabelEdit)이 쓴다.
   innerText 로 읽은 값을 받는다(<br>·<div> 잔재도 \n 으로 — textContent 는 <br> 을 잃는다).
   \r\n → \n · 제어문자(\t·\n 빼고) 걷기 · 폭 0 공백 걷기 · 앞뒤 빈 줄 trim(스티커 글과 같다). */
function annotNormalizeText(raw) {
  return stripCtlChars(String(raw ?? '').replace(/\r\n?/g, '\n')).replace(/\u200B/g, '').trim();
}
window.annotNormalizeText = annotNormalizeText;
