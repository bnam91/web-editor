// annotation-block.js — 펜툴 어노테이션 블록 팩토리 (block-factory.js에서 분리, 2026-06-14)
// section 좌상단 기준 절대좌표 points[] (마지막 점이 라벨 위치).
// 분리 사유: block-factory.js(4400+줄) 책임 분해 — 어노테이션 생성/렌더 SVG 헬퍼는 자기완결 단위.
// 외부 의존: window.genId 하나(전역). window.* 노출은 기존과 동일 유지(annotation-tool.js / prop-annotation.js 호환).

import { checkerBgBigColors } from '../checker-tokens.js';
/* ★1013t2C6 — 라벨 글 정화(스티커 글과 같은 한 벌)
   ★1017t1h3 — ＋라벨 «부분 서식»(고른 글자만 색·크기·⌘B/I/U/S). ⛔새 거르개를 ★만들지 않았다 —
     스티커·그리드 줄·line-host 가 쓰는 ★그 모듈 ★한 벌을 그대로 들인다(그 파일 머리말 소비자 명부 ⑸). */
import { stripCtlChars, sanitizeRichTextHtml, richTextHasFormatting, richTextBlocksToBreaks } from '../util/sanitize-rich-text.js';

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
  labelPad:        null,         // ★1017t1h5 — 라벨 여백(px, 0..24, 사방 동일). null = CSS 기본(4px 8px) 유지 — 안 건드리면 키를 안 단다.
};
window.ANNOT_DEFAULTS = ANNOT_DEFAULTS;

/* ★★1017t1h3 — 라벨 글 «부분 서식» (현빈 원문: 「라벨의 텍스트인 경우 선택한 영역만 색지정 혹은
 *   폰트크기 등 각 다르게 입력할수 있게해줘. 일반 텍스트 블럭 처럼 말야.」) ─────────────────
 *
 * ★★«평문 한 덩이»는 ★그대로 산다 — `dataset.text` 가 ★정본이고 ★labelHtml 은 ★덧붙는 칸이다.
 *   ⇒ ★옛 저장본(labelHtml 키 없음)은 ★한 글자도 안 달라진다(아래 팩토리의 갈림 ＋ 스티커 `textHtml` 과 같은 규약).
 *
 * ★★1013t2C6 의 금지는 ★살아 있다 — 그 커밋이 막은 것은 ★«평문 글자열을 ★innerHTML 에 ★날로 넣기»다
 *   (라벨에 `<b>x</b>` 를 ★치면 다시 그릴 때 ★태그가 됐다). ★여기도 ★날로 넣지 않는다 —
 *   ★넣는 것은 ★«편집기가 만든 ★마크업»이고, ★그릴 때마다 ★다시 거른다(저장본·.gdt 변조 대비).
 *   ★사용자가 ★타이핑한 `<` 는 ★contenteditable 직렬화가 ★`&lt;` 로 내므로 ★글자로 남는다
 *   (⇒ 1013t2C6 의 ★증상이 ★돌아오지 않는다 — ★그 축을 검사가 잰다).
 *   ⛔«이스케이프 사본»도 ★여전히 금지다 — ★거르개는 ★공용 한 벌(sanitizeRichTextHtml) ★하나다.
 *
 * ★허용목록 — ★`font-size` 는 ★기본 명부(RICH_TEXT_ALLOWED_STYLE_PROPS)에 ★없다.
 *   ⛔기본 명부에 ★더하지 않았다 — 더하면 ★스티커·모달·그리드 줄·line-host ★네 소비자의 ★공격면이 ★같이 넓어진다.
 *   ⇒ ★`opts.styleProps` 로 ★이 소비자만 연다(점 찍기의 `--tb-dot-i` 선례). 값은 ★«수+px»만 —
 *     ★그 좁히기는 ★sanitize-rich-text.js 의 ★`RICH_TEXT_STRICT_STYLE_VALS` 가 한다(⛔VAL_WORD 를 안 탄다).
 *   ⛔`classes` 는 ★열지 않았다 — 라벨엔 ★형광펜·점이 ★없다(열 까닭이 ★지금 ★0 이다).
 */
export const ANNOT_RICH_TEXT_OPTS = Object.freeze({ styleProps: Object.freeze(['font-size']) });
window.ANNOT_RICH_TEXT_OPTS = ANNOT_RICH_TEXT_OPTS;

/** ★그릴 때 쓰는 거르개 — 저장본·.gdt 를 손대 넣은 script·on*·javascript:·url( 이 ★여기서 걸린다. */
function annotLabelHtml(raw) {
  return raw ? sanitizeRichTextHtml(String(raw), ANNOT_RICH_TEXT_OPTS) : '';
}
window.annotLabelHtml = annotLabelHtml;

/** ★편집기(contenteditable) 산출 → ★저장할 HTML. ★거르기 «전»에 블럭 경계(Enter 가 만든 `<div>`·자리표시 `<br>`)를
 *  `<br>` 로 ★먼저 편다 — 안 펴면 sanitize 가 DIV 를 ★언랩만 해 `text`(\n 둘)와 `labelHtml`(한 줄)이 ★줄 수에서 갈린다
 *  (line-host `_lnReadHtml` 과 ★같은 식 · 그쪽 LR8 과 ★같은 함정). */
function annotReadLabelHtml(el) {
  const raw = el && el.innerHTML != null ? String(el.innerHTML) : '';
  return raw ? sanitizeRichTextHtml(richTextBlocksToBreaks(raw), ANNOT_RICH_TEXT_OPTS) : '';
}
window.annotReadLabelHtml = annotReadLabelHtml;

/** ★저장할 값인가 — ★«서식이 ★실제로 있을 때»만 싣는다. 없으면 `''` ⇒ 부르는 자가 ★키를 ★지우고 ★평문 경로로 돌아간다
 *  (`<br>` 만 든 줄바꿈은 ★서식이 ★아니다 — 그건 `text` 의 \n 이 ★이미 들고 있다). */
function annotLabelHtmlToStore(html) {
  return richTextHasFormatting(html, ANNOT_RICH_TEXT_OPTS) ? html : '';
}
window.annotLabelHtmlToStore = annotLabelHtmlToStore;

/* ★1013t1A3 — 라벨 «개별 위치»(방사형 블럭 호의 항목 라벨 간격 labelDx/labelDy 를 차용 · b67106ab).
   뜻: 자동 위치(마지막 점 + 4방향 부착 transform)로부터의 차이(px, 섹션 좌표). 선 끝점은 그대로 두고 라벨만 떨어진다.
   저장: dataset.labelDx / labelDy — 0 이면 키를 안 단다(= 자동 배치). 그리기: CSS `translate` 속성
   (transform 과 따로 노는 속성이라 4방향 부착 transform 을 안 건드린다).
   ⛔style 에서 translate 는 «맨 끝»이다 — makeAnnotationBlock 도, 라이브 쓰기(annotApplyLabelOffset)도.
     순서가 갈리면 다시 그린 라벨과 라이브 라벨의 style 문자열이 달라 ⌘Z 유령 칸이 난다(아래 F2 주석과 같은 병). */
const ANNOT_LIMITS = { labelDx: { min: -600, max: 600 }, labelDy: { min: -600, max: 600 },
  anchorRot: { min: -180, max: 180 } };   // ★1013t2C7 — 시작점 회전(°) · −180..180 으로 감는다
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

/* ★1013t2C7 — 시작점(삼각형·화살촉) «회전». A3 라벨 위치와 같은 길이다.
   뜻: 자동 방향(첫 선분의 각 · _calcAnchorAngle)에 «더하는» 각(°). 선을 움직이면 화살촉이 따라 돈다.
   저장: dataset.anchorRot — 0 이면 키를 안 단다(= 자동 방향). −180..180 으로 감는다(asset-rotate.js 꼴).
   값은 소수 둘째 자리까지 — 보통 끌기·숫자칸은 정수, ⇧ 끌기는 «절대» 방향을 45° 에 맞추느라 소수가 남는다.
   그리기는 annotRedrawAnchor 한 벌(라이브 = rebindAll · F2 멱등). */
function _annWrapRot(v) {
  let n = Number(v);
  if (!Number.isFinite(n)) return 0;
  n = Math.round(n * 100) / 100;
  n = ((n % 360) + 360) % 360;
  if (n > ANNOT_LIMITS.anchorRot.max) n -= 360;
  n = Math.round(n * 100) / 100;
  return n === 0 ? 0 : n;   // −0 을 0 으로
}
/** 시작점 회전 읽기(없으면 0). */
function annotAnchorRotOf(block) {
  return _annWrapRot(block?.dataset?.anchorRot || 0);
}
/** 회전 쓰기(dataset + 시작점·회전 손잡이 다시 그리기). 0 이면 키를 지운다. 바뀌었으면 true. */
function annotSetAnchorRot(block, deg) {
  if (!block) return false;
  const before = annotAnchorRotOf(block);
  const r = _annWrapRot(deg);
  if (r === 0) delete block.dataset.anchorRot; else block.dataset.anchorRot = String(r);
  annotRedrawAnchor(block, annotPropsFromDataset(block).points);
  return before !== r;
}
/** 자동 방향으로 되돌리기 — 바뀌었으면 true. */
function annotResetAnchorRot(block) {
  return annotSetAnchorRot(block, 0);
}
Object.assign(window, { annotAnchorRotOf, annotSetAnchorRot, annotResetAnchorRot });

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

/* ★1013t2C7-pre — 시작점(.annot-anchor) «다시 그리기» 한 벌.
   그리는 자리가 셋이었다: 팩토리(각도 넘김) · 패널 재렌더(넘김) · 끌기 중 기하 갱신(js/annotation-select.js
   _updateBlockGeometry — ★각도를 «안» 넘겼다). 그래서 점·전체·⌘ 끌기 때마다 삼각형/화살촉이 0° 로 그려졌고
   onUp 도 다시 안 그려 그 틀린 방향이 히스토리·저장에 찍혔다(rebindAll 이 고쳐 그려 비멱등).
   ⛔시작점을 그리는 자리는 여기 «한 곳»이다 — 각도 규칙(annotAnchorAngleOf)이 갈라지면 같은 병이 난다.
   points 는 «지금 그릴» 점(끄는 중엔 dataset 보다 앞선다). 모양·크기·색은 dataset 에서 읽는다. */
function annotAnchorAngleOf(block, points) {
  return _calcAnchorAngle(points) + annotAnchorRotOf(block);   // ★1013t2C7 — 자동(선 방향) + 회전
}
/* ★1013t2C7 — 회전 손잡이(.annot-rot-handle · 고른 동안만 산다 · js/annotation-select.js _ensureHandles)의 자리.
   시작점에서 «화살촉이 가리키는 쪽»(그리는 각 + 180°)으로 anchorSize×1.5+14 캔버스 px. */
function annotRotHandlePos(block, points) {
  const eff = (annotAnchorAngleOf(block, points) + 180) * Math.PI / 180;
  const d = _annNum(block.dataset.anchorSize, ANNOT_DEFAULTS.anchorSize) * 1.5 + 14;
  return [points[0][0] + d * Math.cos(eff), points[0][1] + d * Math.sin(eff)];
}
function annotRedrawAnchor(block, points) {
  if (!block || !Array.isArray(points) || points.length < 2) return;
  const svg = block.querySelector('.annot-svg');
  block.querySelectorAll('.annot-anchor').forEach(n => n.remove());
  const rh = block.querySelector('.annot-rot-handle');   // ★1013t2C7 — 회전 손잡이도 같이 따라간다
  if (rh) { const [hx, hy] = annotRotHandlePos(block, points); rh.setAttribute('cx', String(hx)); rh.setAttribute('cy', String(hy)); }
  const ds = block.dataset;
  const shape = ds.anchorShape || ANNOT_DEFAULTS.anchorShape;
  if (!svg || shape === 'none') return;
  const html = _renderAnchorSVG(shape, _annNum(ds.anchorSize, ANNOT_DEFAULTS.anchorSize), points[0][0], points[0][1],
    ds.strokeColor || ANNOT_DEFAULTS.strokeColor, annotAnchorAngleOf(block, points));
  if (!html) return;
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.innerHTML = html;
  const node = tmp.firstElementChild;
  if (!node) return;
  // 선 다음 · 손잡이 앞(손잡이가 위에 그려져야 눌린다)
  const firstHandle = svg.querySelector('.annot-handle');
  if (firstHandle) svg.insertBefore(node, firstHandle); else svg.appendChild(node);
}
Object.assign(window, { annotAnchorAngleOf, annotRedrawAnchor, annotRotHandlePos });

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
  /* ★1017t1h3 — 부분 서식 HTML. ★받은 값을 ★그대로 믿지 않는다: ★거른 뒤 ★«서식이 남았을 때»만 든다.
     ⇒ 키가 없던 옛 저장본은 `''` 이고, 아래 dataset·렌더 ★두 갈래가 ★예전 그대로 돈다. */
  const labelHtml        = annotLabelHtmlToStore(annotLabelHtml(opts.labelHtml ?? ''));
  const labelMode        = opts.labelMode        ?? ANNOT_DEFAULTS.labelMode;
  const labelImageSrc    = opts.labelImageSrc    ?? ANNOT_DEFAULTS.labelImageSrc;
  const labelImageSize   = opts.labelImageSize   ?? ANNOT_DEFAULTS.labelImageSize;
  const labelImageRadius = opts.labelImageRadius ?? ANNOT_DEFAULTS.labelImageRadius;
  const labelBorderStyle = opts.labelBorderStyle ?? ANNOT_DEFAULTS.labelBorderStyle;
  const labelBorderWidth = opts.labelBorderWidth ?? ANNOT_DEFAULTS.labelBorderWidth;
  const labelPad         = opts.labelPad         ?? ANNOT_DEFAULTS.labelPad;   // ★1017t1h5
  const labelDx          = _annClampOff(opts.labelDx ?? 0, 'labelDx');   // ★1013t1A3
  const labelDy          = _annClampOff(opts.labelDy ?? 0, 'labelDy');
  const anchorRot        = _annWrapRot(opts.anchorRot ?? 0);           // ★1013t2C7

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
  if (anchorRot !== 0) block.dataset.anchorRot = String(anchorRot);   // ★1013t2C7 — 0 이면 키 없음(= 자동 방향)
  if (labelPad != null) block.dataset.labelPad = String(labelPad);   // ★1017t1h5 — null 이면 키 없음(= CSS 기본 4px 8px 유지)
  /* ★1017t1h3 — 서식이 ★없으면 키를 ★안 단다(= 옛 저장본과 ★같은 바이트). 이미지 모드엔 ★글이 없다.
     ⛔순서는 ANNOT_DATA_KEYS 의 ★마지막과 ★같아야 한다(위 F2 주석 — 직렬화 문자열이 갈리면 ⌘Z 유령 칸이 난다). */
  if (labelMode !== 'image' && labelHtml) block.dataset.labelHtml = labelHtml;

  const ptsAttr = points.map(p => `${p[0]},${p[1]}`).join(' ');
  const anchorAngle = _calcAnchorAngle(points) + anchorRot;   // ★1013t2C7 — annotAnchorAngleOf 와 같은 산식(F2 멱등)
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
  } else if (labelPad != null) {
    // ★1017t1h5 — 사용자가 「여백」을 건드렸을 때만 사방 동일 padding 으로 CSS 기본(4px 8px)을 이긴다.
    labelStyle += `padding:${labelPad}px;`;
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
     줄바꿈(\n)은 글자 그대로 두고 CSS(white-space: pre)가 줄로 그린다.
     ★★1017t1h3 — ★그 금지는 ★그대로다. 달라진 것은 ★«부분 서식이 ★있을 때»의 ★한 갈래뿐이고,
       그때 넣는 것도 ★날것이 아니라 ★`annotLabelHtml` 로 ★다시 거른 ★마크업이다(위 머리말).
       ⇒ 서식 ★없으면 ★이 줄은 ★예전과 ★한 글자도 다르지 않다. */
  if (labelMode !== 'image') {
    const labelEl = block.querySelector('.annot-label');
    if (labelHtml) labelEl.innerHTML = labelHtml;
    else labelEl.textContent = text;
  }
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
    /* ★1017t1h3 — ★안 읽으면 리로드·⌘Z 복원(둘 다 rebindAll)마다 ★부분 서식이 사라진다(labelDx 가 밟은 그 함정).
       ⛔라이브 DOM(`label.innerHTML`)으로 ★폴백하지 않는다 — 평문 저장본의 ★`<` 가 ★태그로 되살아나는 길이 된다(1013t2C6). */
    labelHtml:        ds.labelHtml || '',
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
    labelPad:         (ds.labelPad != null && ds.labelPad !== '') ? _annNum(ds.labelPad, D.labelPad) : D.labelPad,   // ★1017t1h5 — 키 없으면 null(CSS 기본)
    labelDx:          annotLabelOffsetOf(block).dx,   // ★1013t1A3 — 안 읽으면 리로드·⌘Z 복원 때 오프셋이 화면에서 사라진다
    labelDy:          annotLabelOffsetOf(block).dy,
    anchorRot:        annotAnchorRotOf(block),        // ★1013t2C7 — 안 읽으면 리로드·⌘Z 복원 때 회전이 사라진다
  };
}
window.annotPropsFromDataset = annotPropsFromDataset;
/* rebindAll 이 fresh 블럭에서 «되돌려 쓰는» dataset 키 — 팩토리가 쓰는 키 전부(순서 = 팩토리 순서). */
const ANNOT_DATA_KEYS = ['points', 'anchorX', 'anchorY', 'labelX', 'labelY', 'text', 'strokeColor', 'strokeWidth',
  'anchorShape', 'anchorSize', 'labelFontSize', 'labelColor', 'labelBg', 'labelBorderColor', 'labelMode',
  'labelBorderStyle', 'labelBorderWidth', 'labelImageSrc', 'labelImageSize', 'labelImageRadius', 'labelDx', 'labelDy', 'anchorRot', 'labelPad',
  'labelHtml'];   // ★1017t1h3 — 팩토리가 «맨 끝»에 쓴다(순서 = 팩토리 순서)
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
  /* ★1013t2C6 — text 모드 글은 makeAnnotationBlock 이 넣는다(⛔여기서 innerHTML 로 되돌리지 마라 · 이스케이프 사본도 만들지 마라).
     ★1017t1h3 — 그 자리는 이제 ★두 갈래다: 서식 없으면 ★textContent(예전 그대로) · 있으면 ★거른 labelHtml.
       ⛔그래도 ★이 함수는 ★글을 ★안 뱉는다 — ★여기서 뱉으면 `${labelInner}` 로 ★템플릿에 박혀 ★날것이 된다(그게 1013t2C6 의 병이다). */
  return '';
}
window._renderAnnotLabelInner = _renderAnnotLabelInner;

/* ★1013t2C6 — 라벨 글 «확정 값» 한 벌. 편집 확정(annotation-select.js annotBeginLabelEdit)이 쓴다.
   innerText 로 읽은 값을 받는다(<br>·<div> 잔재도 \n 으로 — textContent 는 <br> 을 잃는다).
   \r\n → \n · 제어문자(\t·\n 빼고) 걷기 · 폭 0 공백 걷기 · 앞뒤 빈 줄 trim(스티커 글과 같다). */
function annotNormalizeText(raw) {
  return stripCtlChars(String(raw ?? '').replace(/\r\n?/g, '\n')).replace(/\u200B/g, '').trim();
}
window.annotNormalizeText = annotNormalizeText;
