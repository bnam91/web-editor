// ── Vector Block ───────────────────────────────────────────────────────────────
// 임의 SVG 문자열을 색상 치환 + 100% 폭 강제로 렌더하는 블록.
//
// 의존성:
//   - genId, showNoSelectionHint, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window._insertToFlowFrame (block-factory.js 노출 헬퍼)

import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
/* ★SEC-VECTOR-SVG-RAW-01 (지디 261113 · 결정 A) — svg 문자열 거르개 한 벌(js/util/sanitize-svg.js)을 벡터도 탄다.
   상한만 벡터용으로 연다(SVG_MAX_LEN_CEIL · MCP 상한과 같다) · 허용태그는 아이콘과 같다(text·use·image·style·foreignObject 는 버린다). */
import { sanitizeSvgString, SVG_MAX_LEN_CEIL } from '../util/sanitize-svg.js';
import { svgImportSize } from '../util/svg-import-size.js';
import { posElOf, enterFloat, _applyOverlayPos } from '../overlay-float.js';   // 섹션 «밖» 드랍 = 기존 오버레이(Ignore Auto Layout) 그대로 — 새 층 0

/** data-svg 를 한 번 걸러 «되쓴다» — 다음 그리기엔 버릴 것이 없다(경고는 한 번). 버린 태그는 조용히 두지 않는다(console.warn). */
function _cleanVectorSvg(block) {
  const raw = block.dataset.svg || '';
  if (!raw) return '';
  const dropped = [];
  const clean = sanitizeSvgString(raw, { maxLen: SVG_MAX_LEN_CEIL, dropped });
  if (clean !== raw) block.dataset.svg = clean;
  if (dropped.length) console.warn(`[vector] ${block.id || '(새 블록)'} 세척으로 버린 태그: ${dropped.join(', ')}`);
  return clean;
}

// ── 칠 슬롯 걷기 (VECTOR-MONO-COLOR-DOM-WALK-P1-02) ───────────────────────────
const _SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);
const _BLACK = /^(black|#000|#000000|#000f|#000000ff|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(,\s*1(\.0*)?\s*)?\))$/;
/** 칠 값 → 소문자 값 | null(손대지 않음: 빈 값·none·currentColor·inherit·transparent·url()) */
function _paint(v) {
  v = String(v || '').trim().toLowerCase();
  return (!v || v === 'none' || v === 'currentcolor' || v === 'inherit' || v === 'transparent' || v.startsWith('url(')) ? null : v;
}
/** 거른 svg 글자 → 뿌리 <svg> 요소(못 읽으면 null). <template> 은 불활성(스크립트·그림 로드 0) — 이미 sanitize 를 지난 글자다. */
function _parseSvg(svgStr) {
  const t = document.createElement('template');
  t.innerHTML = svgStr;
  const svg = t.content.firstElementChild;
  return svg && svg.localName === 'svg' && t.content.childElementCount === 1 ? svg : null;
}
/** 칠 슬롯마다 visit(el, prop, where, value) — where = 'attr' | 'style' | 'implicit'(칠이 없어 기본 검정인 도형) */
function _walkPaints(svg, visit) {
  const go = (el, inhFill) => {
    let own = null;
    for (const prop of ['fill', 'stroke']) {
      const a = el.getAttribute(prop), st = el.style?.getPropertyValue(prop);
      if (a != null) visit(el, prop, 'attr', a);
      if (st) visit(el, prop, 'style', st);
      if (prop === 'fill') own = st || a;
    }
    const fill = own ? own : inhFill;
    if (!fill && _SHAPES.has(el.localName)) visit(el, 'fill', 'implicit', null);
    for (const c of el.children) go(c, fill);
  };
  go(svg, null);
}
function _setPaint(el, prop, where, v) { if (where === 'attr') el.setAttribute(prop, v); else el.style.setProperty(prop, v); }

/** 그리기: 검정 칠 → color (속성·style · 칠 없는 도형은 뿌리 fill). 못 읽는 글자는 옛 글자 치환으로(퇴행 방지). */
function _paintBlack(svgStr, color) {
  const svg = _parseSvg(svgStr);
  if (!svg) return svgStr.replace(/fill="(black|#000000|#000|currentColor)"/gi, `fill="${color}"`);
  let implicit = false;
  _walkPaints(svg, (el, prop, where, v) => {
    if (where === 'implicit') { implicit = true; return; }
    const p = _paint(v);
    if (p && _BLACK.test(p)) _setPaint(el, prop, where, color);
  });
  if (implicit) svg.setAttribute('fill', color);   // 칠 없는 도형이 있으면 뿌리에도 칠이 없다(있었다면 물려받았다)
  return svg.outerHTML;
}

/** 단색인 svg 의 그 한 색(검정 무리는 'black' · 칠 없는 도형 = 검정) · 여러 색·칠 0 이면 null */
function _monoPaint(svg) {
  const set = new Set();
  _walkPaints(svg, (el, prop, where, v) => {
    if (where === 'implicit') { set.add('black'); return; }
    const p = _paint(v);
    if (p) set.add(_BLACK.test(p) ? 'black' : p);
  });
  return set.size === 1 ? [...set][0] : null;
}

/** 색 바꾸기 한 문(패널·MCP) — 단색인데 검정이 아니면(빨강 아이콘 등) 그 색을 data-svg 에서 검정으로 한 번 고쳐 적고 color 를 쓴다.
 *  ⇒ 그리기는 «검정 → color» 하나로 모든 단색 SVG 를 칠한다 · 여러 색 SVG 는 그대로(VECTOR-MULTICOLOR-STROKE-P2-01 몫). */
function setVectorColor(block, c) {
  const svg = block.dataset.svg ? _parseSvg(block.dataset.svg) : null;
  const mono = svg && _monoPaint(svg);
  if (mono && mono !== 'black') {
    _walkPaints(svg, (el, prop, where, v) => { if (where !== 'implicit' && _paint(v) === mono) _setPaint(el, prop, where, '#000000'); });
    block.dataset.svg = svg.outerHTML;
  }
  block.dataset.color = c;
}

function renderVector(block) {
  /* ★렌더가 «유일한» innerHTML 자리다 — 열기 뒤 편집·MCP update·makeVectorBlock(data)·펜 재빌드가 전부 여기로 온다. */
  const svgStr = _cleanVectorSvg(block);
  const color  = block.dataset.color || '#000000';
  const w      = parseInt(block.dataset.w) || 120;
  const h      = parseInt(block.dataset.h) || 120;

  block.style.width  = w + 'px';
  block.style.height = h + 'px';

  const inner = block.querySelector('.vb-inner');
  if (!inner) return;

  /* VECTOR-MONO-COLOR-DOM-WALK-P1-02 — 글자 치환(fill="black" 등 넷) 대신 SVG 요소를 걸어 «검정 칠»만 고른 색으로:
     fill·stroke × 속성·style 둘 다 · 칠이 없는 도형(기본 검정)은 뿌리 fill 로 · currentColor 는 값은 두고 뿌리 color 로 풀린다 ·
     none·url()·검정 아닌 색은 안 건드린다(여러 색 SVG 를 조용히 한 색으로 만들지 않는다 — 단색 비검정은 setVectorColor 가 먼저 검정으로 고쳐 적는다). */
  const processed = svgStr ? _paintBlack(svgStr, color) : '';

  /* SVG 자체에 width/height 100% 강제 — 뿌리 덮어쓰기(opts.root)로. color = currentColor 가 풀릴 값.
     ★색 치환 «뒤»에 한 번 더 거른다: data-color 도 저장본에서 오는 값이라 `"><image onerror…` 가 치환으로 다시 끼어들 수 있다. */
  inner.innerHTML = processed
    ? sanitizeSvgString(processed, { maxLen: SVG_MAX_LEN_CEIL, root: { width: '100%', height: '100%', color } })
    : '';

}

// ── 펜 패스 SVG 재빌드 (공용) ──────────────────────────────────────────────────
// penNodes(viewBox 좌표) 보유 블록의 color/stroke/fill 변경 시 dataset.svg를 재생성.
// prop-vector.js의 rebuildPenSvg와 동일 로직 — 공용화(F6).
// 반환: 재빌드했으면 true (펜 블록), 아니면 false.
function rebuildPenSvg(block) {
  if (!block) return false;
  let nodes = null;
  try { nodes = JSON.parse(block.dataset.penNodes || 'null'); } catch (_) { return false; }
  if (!Array.isArray(nodes) || nodes.length < 2) return false;
  const closed = block.dataset.penClosed === '1';
  const sw     = parseFloat(block.dataset.strokeWidth) || 2;
  const fill   = block.dataset.penFill || 'none';
  const w      = parseInt(block.dataset.w) || 120;
  const h      = parseInt(block.dataset.h) || 120;
  const d      = window.nodesToSvgPath?.(nodes, closed) || '';
  if (!d) return false;
  const stroke   = block.dataset.color || '#1a1a1a';
  const fillAttr = (fill && fill !== 'none') ? fill : 'none';
  block.dataset.svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<path d="${d}" fill="${fillAttr}" stroke="${stroke}" stroke-width="${sw}" ` +
    `stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  return true;
}

function makeVectorBlock(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className      = 'vector-block';
  block.dataset.type   = 'vector';
  block.id             = genId('vb');
  block.setAttribute('draggable', 'true');
  block.dataset.svg    = data.svg   || '';
  block.dataset.color  = data.color || '#000000';
  block.dataset.w      = String(data.w || 120);
  block.dataset.h      = String(data.h || 120);
  block.dataset.layerName = data.label || 'Vector';
  // 펜툴 재편집 데이터 패스스루 (pen-tool.js가 commit 후 부착하기도 하지만,
  // 직렬화→복원 경로(makeVectorBlock(data))에서도 보존되도록 여기서 받는다)
  if (data.penNodes   !== undefined) block.dataset.penNodes   = String(data.penNodes);
  if (data.penClosed  !== undefined) block.dataset.penClosed  = String(data.penClosed);
  if (data.strokeWidth!== undefined) block.dataset.strokeWidth= String(data.strokeWidth);
  if (data.penFill    !== undefined) block.dataset.penFill    = String(data.penFill);

  const inner = document.createElement('div');
  inner.className = 'vb-inner';
  block.appendChild(inner);

  renderVector(block);

  row.appendChild(block);
  return { row, block };
}

function addVectorBlock(svgString = '', opts = {}) {
  // F1: 생성된 block을 반환해 호출측이 정확히 그 블록에 메타를 부착하게 한다
  // (querySelectorAll 마지막 집기 방식은 insertAfterSelected로 위치가 바뀌면 오부착됨).
  let created = null;
  if (window._insertToFlowFrame?.(() => {
    const { row, block } = makeVectorBlock({ svg: svgString, ...opts });
    created = block;
    return { row, block };
  })) return created;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return null; }
  window.pushHistory();
  const { row, block } = makeVectorBlock({ svg: svgString, ...opts });
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
  return block;
}

// ── 바깥 SVG 들여오기 (t3-06 P1 · 현빈 #19 ② «SVG 지원 먼저») ─────────────────────
// 문 하나: 에셋 «크게 보기» 창의 「벡터로 넣기」 · 캔버스 섹션에 .svg 파일 끌어 놓기 · SVG 글자 붙여넣기(Figma «Copy as SVG»).
// 거르개(sanitize-svg)를 넣기 «전»에 한 번 — 뿌리가 <svg> 가 아니거나 상한(200000)을 넘으면 넣지 않고 알린다(빈 블럭 0).
// 크기 = svgImportSize(뿌리 width·height → viewBox · 긴 변 400). 색 치환·다색(P1-2·P2)은 이번 범위 밖.
// place = { sec, clientX, clientY } 면 그 섹션에 넣고 «오버레이(떠 있음)»로 띄워 놓은 점(화면 좌표)에 가운데를 둔다 — 섹션 «밖» 드랍.
//   같은 입구 한 번 안에서 띄우므로 insert-history 끝 표본이 띄운 «뒤»를 찍는다(⌘Z 한 번).
function addVectorFromSvgText(text, label = 'SVG', place = null) {
  const clean = sanitizeSvgString(String(text || '').trim(), { maxLen: SVG_MAX_LEN_CEIL });
  if (!clean) { window.showToast?.('SVG 로 읽을 수 없습니다 — <svg> 로 시작하고 200KB 이하여야 합니다.'); return null; }
  const { w, h } = svgImportSize(clean);
  if (place?.sec) { window.deselectAll?.(); window.selectSection?.(place.sec); }
  const block = window.addVectorBlock(clean, { w, h, label });   // window 문 = 펜툴과 같은 입구(insert-select 선택 따라가기·insert-history 감싸기를 탄다)
  if (block && place?.sec && enterFloat(posElOf(block))) {
    const z = (window.currentZoom || 40) / 100, r = place.sec.getBoundingClientRect();
    /* 섹션 상자 안으로 조인다 — 캔버스 밖 회색에 놓아도 «그 섹션의» 오버레이다(밖에 두면 섹션 PNG 에서 잘리고 섹션 overflow 에 가린다) */
    const cl = (v, max) => Math.max(0, Math.min(Math.max(0, max), v));
    _applyOverlayPos(block, cl((place.clientX - r.left) / z - w / 2, place.sec.offsetWidth - w), cl((place.clientY - r.top) / z - h / 2, place.sec.offsetHeight - h));
  }
  return block;
}

const _isSvgFile = (f) => !!f && (f.type === 'image/svg+xml' || /\.svg$/i.test(f.name || ''));
const _svgSec = (e) => e.target?.closest?.('#canvas .section-block') || null;
/* 끌어 놓기 — 블럭이 자기 drop 을 가지면(에셋·원형 이미지·인증서 칸) 그쪽이 stopPropagation 으로 먼저 가져간다 · 여기는 «그 밖 섹션 바탕»만.
   ⛔스크래치(캔버스 밖) drop 은 그대로 이미지 — 그 처리기는 #canvas-scaler 안이면 손을 뗀다(scratch-pad.js).
   shortcut: 프레임 안(block-drag.js 프레임 inner drop 이 stopPropagation)에 놓으면 안 온다 — 섹션 바탕만 · 프레임 안 넣기가 필요해지면 그 처리기에 파일 갈래를 더한다. */
document.addEventListener('dragover', (e) => {
  if (!_svgSec(e) || ![...(e.dataTransfer?.items || [])].some((it) => it.kind === 'file' && it.type === 'image/svg+xml')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('drop', async (e) => {
  const sec = _svgSec(e);
  if (!sec) return;   /* ⛔defaultPrevented 로 거르지 않는다 — section-inner drop(section-drag.js)이 파일 drop 도 늘 preventDefault 만 하고 올려 보낸다 */
  const files = [...(e.dataTransfer?.files || [])].filter(_isSvgFile);
  if (!files.length) return;
  e.preventDefault();
  window.selectSection?.(sec);
  for (const f of files) addVectorFromSvgText(await f.text(), (f.name || '').replace(/\.svg$/i, '') || 'SVG');
});
/* 섹션 «밖» 드랍(섹션 사이·캔버스 밖 회색 바탕) — .svg 만 실린 drop 은 «가장 가까운 섹션»의 오버레이 벡터로.
   캡처 단계로 #canvas-wrap 에서 먼저 받아 스크래치 그림 처리기(scratch-pad.js wrap drop · 버블)에 안 가게 한다.
   ⛔.svg 아닌 파일이 하나라도 섞이면 손대지 않는다 — 종전대로 스크래치가 그림으로 받는다. 섹션 위 drop 은 위 섹션 처리기(흐름 블럭) 몫.
   shortcut: 가까운 섹션 = 놓은 높이가 걸친 섹션, 없으면 위·아래 가장 가까운 것 — 가로는 안 따진다(섹션은 한 줄로 쌓인다). */
const _svgOnlyFiles = (dt) => { const it = [...(dt?.items || [])].filter((x) => x.kind === 'file'); return it.length > 0 && it.every((x) => x.type === 'image/svg+xml'); };
function _nearestSection(clientY) {
  let best = null, bd = Infinity;
  for (const s of document.querySelectorAll('#canvas .section-block')) {
    const r = s.getBoundingClientRect();
    const d = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
const _canvasWrap = document.getElementById('canvas-wrap');
_canvasWrap?.addEventListener('dragover', (e) => {
  if (_svgSec(e) || !_svgOnlyFiles(e.dataTransfer)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}, true);
_canvasWrap?.addEventListener('drop', async (e) => {
  if (_svgSec(e)) return;
  const files = [...(e.dataTransfer?.files || [])];
  if (!files.length || !files.every(_isSvgFile)) return;
  const sec = _nearestSection(e.clientY);
  if (!sec) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const { clientX, clientY } = e;
  for (const [i, f] of files.entries()) addVectorFromSvgText(await f.text(), (f.name || '').replace(/\.svg$/i, '') || 'SVG', { sec, clientX: clientX + i * 24, clientY: clientY + i * 24 });
}, true);
/* 붙여넣기 — 글자가 SVG 일 때만. 그림 항목이 같이 오면 종전대로 스크래치가 그림으로 받는다(두 번 붙지 않게 여기서 손을 뗀다).
   ⌘V keydown 의 고디터 안 붙여넣기(editor.js · 30ms 뒤)는 스크래치와 같은 깃발로 양보시킨다. */
const _SVG_TEXT_RE = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i;
document.addEventListener('paste', (e) => {
  const a = document.activeElement;
  if (a && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
  if ([...(e.clipboardData?.items || [])].some((it) => it.type.startsWith('image/'))) return;
  const text = e.clipboardData?.getData('text/plain') || '';
  if (!_SVG_TEXT_RE.test(text) || window.clipboardPrefersInternal?.(e)) return;
  e.preventDefault();
  window._scratchJustHandledPaste = true;
  setTimeout(() => { window._scratchJustHandledPaste = false; }, 100);
  addVectorFromSvgText(text, 'SVG');
});

// ── 수정 ──────────────────────────────────────────────────────────────────────
// PM의 update_vector_block(MCP) → main(_invokeRendererUpdateVectorBlock) → 여기.
// banner02 updateBanner02Block 패턴 미러: pushHistory + dataset partial write + renderVector 재렌더 + scheduleAutoSave.
// 지원 필드 (data-* 매핑):
//   - svg       (string, ≤200000)
//   - color     (hex/rgb(a)/hsl(a)/transparent)
//   - w, h      (int 10~4000, dataset에는 String으로 저장)
//   - layerName (string, ≤200)
function updateVectorBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('vector-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `vector-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // ── 동시수정 가드 (renderer 단 self-defense — main의 atomic IIFE 가드와 별개 second-line) ──
  try {
    const ae = document.activeElement;
    const userEditing = !!(ae && (
      ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
    ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
    const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
    if (userEditing || recentKey) {
      return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
    }
  } catch (_) {}

  // 허용된 필드만 추출해서 partial이 실제로 의미있는지 확인
  const ALLOWED = ['svg', 'color', 'w', 'h', 'layerName', 'penNodes', 'penClosed', 'strokeWidth', 'penFill'];
  const keys = Object.keys(partial).filter(k => ALLOWED.includes(k) && partial[k] !== undefined);
  if (keys.length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one of svg/color/w/h/layerName' };
  }

  // ── 입력 검증 (banner02 _validate 패턴 미러: throw → INVALID 반환) ──
  // 색상: hex/rgb(a)/hsl(a)/transparent만 허용 (banner02 _color 정규식)
  const _colorOk = (v) => {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s || s.length > 64) return false;
    return (
      /^#[0-9a-fA-F]{3,8}$/.test(s) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(s) ||
      s === 'transparent'
    );
  };

  if (partial.svg !== undefined && partial.svg !== null) {
    if (typeof partial.svg !== 'string') {
      return { ok: false, code: 'INVALID', message: 'svg must be string' };
    }
    if (partial.svg.length > 200000) {
      return { ok: false, code: 'TOO_LARGE', message: 'svg too long (>200000)' };
    }
    // XSS 가드: <script> 차단 (SVG raw → innerHTML 경로)
    if (/<script[\s>]/i.test(partial.svg)) {
      return { ok: false, code: 'INVALID', message: 'svg contains <script> (blocked)' };
    }
    /* ★SEC-VECTOR-SVG-RAW-01 — 거르개가 비우는 것(뿌리가 <svg> 아님 등)은 «조용히 빈 그림»이 아니라 거절. 핸들러·버린 태그는 renderVector 가 걷고 알린다. */
    if (partial.svg && !sanitizeSvgString(partial.svg, { maxLen: SVG_MAX_LEN_CEIL })) {
      return { ok: false, code: 'INVALID', message: 'svg rejected by sanitizer (root must be <svg>)' };
    }
  }
  if (partial.color !== undefined && partial.color !== null) {
    if (!_colorOk(partial.color)) {
      return { ok: false, code: 'INVALID', message: 'color invalid (allowed: #hex | rgb(a)/hsl(a)() | transparent)' };
    }
  }
  if (partial.w !== undefined && partial.w !== null) {
    const n = Number(partial.w);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 10 || n > 4000) {
      return { ok: false, code: 'INVALID', message: 'w must be integer in [10,4000]' };
    }
  }
  if (partial.h !== undefined && partial.h !== null) {
    const n = Number(partial.h);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 10 || n > 4000) {
      return { ok: false, code: 'INVALID', message: 'h must be integer in [10,4000]' };
    }
  }
  if (partial.layerName !== undefined && partial.layerName !== null) {
    if (typeof partial.layerName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'layerName must be string' };
    }
    if ([...partial.layerName].length > 200) {
      return { ok: false, code: 'INVALID', message: 'layerName too long (>200 code points)' };
    }
  }

  // ── before 스냅샷 (mutate 전, undo 푸시 전) ──
  const before = {
    svg:       block.dataset.svg,
    color:     block.dataset.color,
    w:         block.dataset.w,
    h:         block.dataset.h,
    layerName: block.dataset.layerName,
  };

  window.pushHistory?.();

  const applied = {};

  if (partial.svg !== undefined && partial.svg !== null) {
    block.dataset.svg = String(partial.svg);
    applied.svg = block.dataset.svg;
  }
  if (partial.color !== undefined && partial.color !== null) {
    setVectorColor(block, String(partial.color).trim());
    applied.color = block.dataset.color;
  }
  if (partial.w !== undefined && partial.w !== null) {
    block.dataset.w = String(Number(partial.w));
    applied.w = Number(partial.w);
  }
  if (partial.h !== undefined && partial.h !== null) {
    block.dataset.h = String(Number(partial.h));
    applied.h = Number(partial.h);
  }
  // 펜툴 재편집 메타 (검증 최소 — 문자열/길이 가드만)
  if (partial.penNodes !== undefined && partial.penNodes !== null) {
    const s = String(partial.penNodes);
    if (s.length <= 200000) { block.dataset.penNodes = s; applied.penNodes = s; }
  }
  if (partial.penClosed !== undefined && partial.penClosed !== null) {
    block.dataset.penClosed = String(partial.penClosed); applied.penClosed = block.dataset.penClosed;
  }
  if (partial.strokeWidth !== undefined && partial.strokeWidth !== null) {
    block.dataset.strokeWidth = String(partial.strokeWidth); applied.strokeWidth = block.dataset.strokeWidth;
  }
  if (partial.penFill !== undefined && partial.penFill !== null) {
    block.dataset.penFill = String(partial.penFill); applied.penFill = block.dataset.penFill;
  }
  let layerNameChanged = false;
  if (partial.layerName !== undefined && partial.layerName !== null) {
    const ln = String(partial.layerName).trim() || 'Vector';
    block.dataset.layerName = ln;
    applied.layerName = ln;
    layerNameChanged = true;
  }

  // ── F6: 펜 패스 블록은 color/stroke/fill 변경 시 SVG 재빌드 ──
  // (renderVector는 fill 치환만 하므로 stroke 색·두께가 반영 안 됨.)
  // svg를 명시적으로 넘기지 않은 경우에만 재빌드(명시 svg가 우선).
  if (partial.svg === undefined &&
      (applied.color !== undefined || applied.strokeWidth !== undefined ||
       applied.penFill !== undefined || applied.penClosed !== undefined)) {
    try {
      if (rebuildPenSvg(block)) applied.svg = block.dataset.svg;
    } catch (_) {}
  }

  // ── 재렌더 (svg/color/w/h 어느 것이 바뀌어도 idempotent) ──
  try {
    if (typeof window.renderVector === 'function') {
      window.renderVector(block);
    } else {
      renderVector(block);
    }
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // ── 레이어 패널 (layerName 바뀐 경우) ──
  if (layerNameChanged) {
    try { window.buildLayerPanel?.(); } catch (_) {}
  }

  try { window.scheduleAutoSave?.(); } catch (_) {}

  return { ok: true, blockId, before, applied };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeVectorBlock = makeVectorBlock;
window.addVectorBlock  = addVectorBlock;
window.addVectorFromSvgText = addVectorFromSvgText;
window.renderVector    = renderVector;
window.setVectorColor  = setVectorColor;   // 색 바꾸기 한 문(prop-vector · MCP update)
/* ⌘G 묶음 손잡이가 벡터를 늘린다 — 크기 정본은 dataset.w·h 이고 renderVector 가 style 을 그 키로 다시 쓴다(VECTOR-GROUP-SCALE-SNAP-CHECK-01).
   ⛔style 만 쓰면 다음 렌더에 옛 크기로 튄다. 줌(_scaleZoomFromSnap)·그라데이션과 같은 꼴 — «쥔 때 값» d0 에서 재고, 바닥 8px만 · 범위(20~4000)로는 안 조임.
   자리는 벡터가 dataset.x·y 를 안 쓰니 손잡이 바닥 길과 같은 style.left·top + offsetX·Y. */
function _scaleVectorFromSnap(block, d0, sx, sy, left, top) {
  const L = Math.round(left * sx), T = Math.round(top * sy);
  block.style.left = L + 'px'; block.dataset.offsetX = String(L);
  block.style.top  = T + 'px'; block.dataset.offsetY = String(T);
  block.dataset.w = String(Math.max(8, Math.round((parseInt(d0.w) || 120) * sx)));
  block.dataset.h = String(Math.max(8, Math.round((parseInt(d0.h) || 120) * sy)));
  renderVector(block);
}
window._scaleVectorFromSnap = _scaleVectorFromSnap;
window.updateVectorBlock = updateVectorBlock;
window.rebuildPenSvg   = rebuildPenSvg;

export { makeVectorBlock, addVectorBlock, addVectorFromSvgText, updateVectorBlock, renderVector, rebuildPenSvg };
