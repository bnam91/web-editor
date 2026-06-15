// ── Vector Block ───────────────────────────────────────────────────────────────
// 임의 SVG 문자열을 색상 치환 + 100% 폭 강제로 렌더하는 블록.
//
// 의존성:
//   - genId, showNoSelectionHint, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window._insertToFlowFrame (block-factory.js 노출 헬퍼)

import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

function renderVector(block) {
  const svgStr = block.dataset.svg   || '';
  const color  = block.dataset.color || '#000000';
  const w      = parseInt(block.dataset.w) || 120;
  const h      = parseInt(block.dataset.h) || 120;

  block.style.width  = w + 'px';
  block.style.height = h + 'px';

  const inner = block.querySelector('.vb-inner');
  if (!inner) return;

  // fill 색상 치환: fill="black", fill="#000000", fill="currentColor" 등 → 지정 색상
  let processed = svgStr
    .replace(/fill="black"/gi,        `fill="${color}"`)
    .replace(/fill="#000000"/gi,      `fill="${color}"`)
    .replace(/fill="#000"/gi,         `fill="${color}"`)
    .replace(/fill="currentColor"/gi, `fill="${color}"`);

  // SVG 자체에 width/height 100% 강제 적용
  processed = processed.replace(/<svg([^>]*)>/i, (match, attrs) => {
    let a = attrs
      .replace(/\s*width="[^"]*"/gi, '')
      .replace(/\s*height="[^"]*"/gi, '');
    return `<svg${a} width="100%" height="100%">`;
  });

  inner.innerHTML = processed;

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
    block.dataset.color = String(partial.color).trim();
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
window.renderVector    = renderVector;
window.updateVectorBlock = updateVectorBlock;
window.rebuildPenSvg   = rebuildPenSvg;

export { makeVectorBlock, addVectorBlock, updateVectorBlock, renderVector, rebuildPenSvg };
