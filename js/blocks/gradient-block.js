// ── Gradient Block (플로팅 오버레이) ──────────────────────────────────────────
// 2026-05-21 sticker 패턴으로 재작성.
// 섹션 위에 absolute로 떠있는 그라데이션 페이드 오버레이.
// 용도: 이미지 끝선/섹션 경계의 부자연스러움을 페이드로 자연스럽게 연결.
//
// 부모: .section-block 직접 자식 (sticker와 동일 패턴)
// 위치: absolute, left/top dataset 기반
// 디폴트: 860 × 300, 좌상단 (0, 0), linear, 위→아래, 검정 100% → 검정 0%
// z-index: 2 (텍스트/콘텐츠 아래, 배경 위 — 페이드 용도)
//
// 의존성:
//   - window.getSelectedSection, window.showNoSelectionHint,
//     window.pushHistory, window.scheduleAutoSave,
//     window.bindGradientSelect (gradient-select.js)

const GRADIENT_DEFAULTS = {
  style:       'linear',
  direction:   'to bottom',
  startColor:  '#000000',
  endColor:    '#000000',
  startAlpha:  1,
  endAlpha:    0,
  width:       860,
  height:      300,
  x:           0,
  y:           0,
};

function _hexToRgba(hex, alpha) {
  const h = String(hex || '#000000').replace('#','');
  const r = parseInt(h.slice(0,2), 16) || 0;
  const g = parseInt(h.slice(2,4), 16) || 0;
  const b = parseInt(h.slice(4,6), 16) || 0;
  const a = Math.max(0, Math.min(1, parseFloat(alpha)));
  return `rgba(${r},${g},${b},${a})`;
}

// B24: stop 배열 정본. gradStops(JSON) 우선, 없으면 레거시 start/end 2-stop 합성(하위호환).
function _resolveStops(block) {
  const raw = block.dataset.gradStops;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length >= 2) {
        const clean = arr
          .map(s => ({
            color: /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '#000000',
            alpha: Math.max(0, Math.min(1, parseFloat(s.alpha))) || 0,
            offset: Math.max(0, Math.min(1, parseFloat(s.offset))) || 0,
          }))
          .sort((a, b) => a.offset - b.offset);
        if (clean.length >= 2) return clean;
      }
    } catch (_) { /* fall through to legacy */ }
  }
  const startColor = block.dataset.gradStart || GRADIENT_DEFAULTS.startColor;
  const endColor   = block.dataset.gradEnd   || GRADIENT_DEFAULTS.endColor;
  const sA = block.dataset.gradStartAlpha != null ? parseFloat(block.dataset.gradStartAlpha) : GRADIENT_DEFAULTS.startAlpha;
  const eA = block.dataset.gradEndAlpha   != null ? parseFloat(block.dataset.gradEndAlpha)   : GRADIENT_DEFAULTS.endAlpha;
  return [
    { color: startColor, alpha: Math.max(0, Math.min(1, sA)), offset: 0 },
    { color: endColor,   alpha: Math.max(0, Math.min(1, eA)), offset: 1 },
  ];
}

function renderGradientBlock(block) {
  const style       = block.dataset.gradStyle      || GRADIENT_DEFAULTS.style;
  const direction   = block.dataset.gradDirection  || GRADIENT_DEFAULTS.direction;
  const startColor  = block.dataset.gradStart      || GRADIENT_DEFAULTS.startColor;
  const endColor    = block.dataset.gradEnd        || GRADIENT_DEFAULTS.endColor;
  const startAlpha  = block.dataset.gradStartAlpha != null ? parseFloat(block.dataset.gradStartAlpha) : GRADIENT_DEFAULTS.startAlpha;
  const endAlpha    = block.dataset.gradEndAlpha   != null ? parseFloat(block.dataset.gradEndAlpha)   : GRADIENT_DEFAULTS.endAlpha;
  const width       = parseInt(block.dataset.gradWidth)  || GRADIENT_DEFAULTS.width;
  const height      = parseInt(block.dataset.gradHeight) || GRADIENT_DEFAULTS.height;
  const x           = parseInt(block.dataset.x) || 0;
  const y           = parseInt(block.dataset.y) || 0;

  const stops = _resolveStops(block);
  const stopCss = (arr) => arr
    .map(s => `${_hexToRgba(s.color, s.alpha)} ${Math.round(Math.max(0, Math.min(1, s.offset)) * 100)}%`)
    .join(', ');

  let bg;
  if (style === 'radial') {
    // 비네트: 중앙(0%)이 마지막 stop(투명), 외곽(100%)이 첫 stop(불투명) — 기존 2-stop 동작과 동일 순서 유지.
    // Codex 반영: 등간격 재배치 대신 user offset 보존 — radial은 방향만 반전(1-offset)해 중앙=마지막stop 유지.
    const radialStops = stops.map(s => ({ ...s, offset: Math.max(0, Math.min(1, 1 - s.offset)) })).sort((a, b) => a.offset - b.offset);
    bg = `radial-gradient(circle at center, ${stopCss(radialStops)})`;
  } else {
    bg = `linear-gradient(${direction}, ${stopCss(stops)})`;
  }

  // absolute floating overlay — 블록 자체는 배경 없음 (선택 outline + 핸들을 유지하기 위해)
  block.style.cssText = `position:absolute;left:${x}px;top:${y}px;`
    + `width:${width}px;height:${height}px;`
    + `user-select:none;cursor:move;z-index:2;pointer-events:auto;`
    + `box-sizing:border-box;`;

  // 그라데이션 fill은 별도 inner div에 적용 — 섹션 박스로 클리핑 가능하게 분리
  let gradFill = block.querySelector(':scope > .grad-fill');
  if (!gradFill) {
    gradFill = document.createElement('div');
    gradFill.className = 'grad-fill';
    block.insertBefore(gradFill, block.firstChild);
  }
  gradFill.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:0;background:${bg};`;

  // 섹션 박스를 기준으로 fill 클리핑 (선택 outline + 코너 핸들은 블록 요소에 있어 영향 없음)
  const sec = block.closest('.section-block');
  if (sec) {
    const secW = sec.offsetWidth;
    const secH = sec.offsetHeight;
    const clipTop    = Math.max(0, -y);
    const clipRight  = Math.max(0, (x + width)  - secW);
    const clipBottom = Math.max(0, (y + height) - secH);
    const clipLeft   = Math.max(0, -x);
    gradFill.style.clipPath =
      `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
  } else {
    gradFill.style.clipPath = '';
  }
}

function makeGradientBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'gradient-block';
  block.id = 'grad_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type           = 'gradient';
  block.dataset.gradStyle      = opts.style       ?? GRADIENT_DEFAULTS.style;
  block.dataset.gradDirection  = opts.direction   ?? GRADIENT_DEFAULTS.direction;
  block.dataset.gradStart      = opts.startColor  ?? GRADIENT_DEFAULTS.startColor;
  block.dataset.gradEnd        = opts.endColor    ?? GRADIENT_DEFAULTS.endColor;
  block.dataset.gradStartAlpha = String(opts.startAlpha ?? GRADIENT_DEFAULTS.startAlpha);
  block.dataset.gradEndAlpha   = String(opts.endAlpha   ?? GRADIENT_DEFAULTS.endAlpha);
  block.dataset.gradWidth      = String(opts.width  ?? GRADIENT_DEFAULTS.width);
  block.dataset.gradHeight     = String(opts.height ?? GRADIENT_DEFAULTS.height);
  block.dataset.x              = String(opts.x ?? GRADIENT_DEFAULTS.x);
  block.dataset.y              = String(opts.y ?? GRADIENT_DEFAULTS.y);
  block.dataset.layerName      = opts.layerName || 'Gradient';
  renderGradientBlock(block);
  return block;
}

function addGradientBlock(opts = {}) {
  // B12: 섹션 미선택이어도 먹통처럼 보이지 않게 — 마지막 섹션으로 폴백(텍스트 추가 동작과 일관). 섹션 0개일 때만 중단.
  const sec = window.getSelectedSection?.() || [...document.querySelectorAll('.section-block')].pop();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory?.('그라데이션 추가');
  const block = makeGradientBlock(opts);
  sec.appendChild(block); // 섹션 직접 자식 (absolute → 섹션 기준)
  window.bindGradientSelect?.(block);
  window.scheduleAutoSave?.();
  window.buildLayerPanel?.();
  return block;
}

// ── 수정 ──────────────────────────────────────────────────────────────────────
// PM의 update_gradient_block(MCP) → main(_invokeRendererUpdateGradientBlock) → 여기.
// banner02 updateBanner02Block 패턴 미러: NOT_FOUND/INVALID 검증 + before snapshot + pushHistory +
//   dataset partial write + renderGradientBlock 재렌더 + showGradientProperties 갱신 + scheduleAutoSave.
// 지원 필드 (data-* 매핑):
//   - style → gradStyle (linear|radial)
//   - direction → gradDirection (8방향, linear 전용)
//   - startColor → gradStart (#RRGGBB만 — _hexToRgba 안전성)
//   - endColor   → gradEnd   (#RRGGBB만)
//   - startAlpha → gradStartAlpha (0~1 float)
//   - endAlpha   → gradEndAlpha   (0~1 float)
//   - width  → gradWidth  (200~1200 px)
//   - height → gradHeight (50~1500 px)
//   - x, y (섹션 기준 좌표, -4000~4000)
//   - layerName (≤100)
function updateGradientBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('gradient-block') || block.dataset.type !== 'gradient') {
    return { ok: false, code: 'NOT_FOUND', message: `gradient-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty — provide at least one field' };
  }

  // ── 동시수정 가드 (USER_BUSY) ───────────────────────────────────────────────
  // banner02 패턴: contenteditable / INPUT / TEXTAREA 활성 + 최근 키입력 1.5s 이내면 후퇴.
  try {
    const ae = document.activeElement;
    const userEditing = !!(ae && (
      ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
    ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
    const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
    if (userEditing || recentKey) {
      return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
    }
  } catch (_) { /* guard 실패는 무시 */ }

  // ── helpers ────────────────────────────────────────────────────────────────
  const _HEX6 = /^#[0-9a-fA-F]{6}$/;
  const _STYLES = ['linear', 'radial'];
  const _DIRS = ['to bottom','to top','to right','to left','to bottom right','to bottom left','to top right','to top left'];

  // before snapshot (mutate 전, pushHistory 전)
  const before = { ...block.dataset };

  // ── 1) 값 검증 (mutate 전 모두 검사 → 일부 fail시 부분반영 방지) ───────────
  const writes = {}; // datasetKey -> stringValue
  const applied = {};

  if (partial.style !== undefined) {
    if (!_STYLES.includes(partial.style)) {
      return { ok: false, code: 'INVALID', message: `invalid style: ${partial.style}. allowed: ${_STYLES.join('|')}` };
    }
    writes.gradStyle = String(partial.style);
    applied.style = partial.style;
  }
  if (partial.direction !== undefined) {
    if (!_DIRS.includes(partial.direction)) {
      return { ok: false, code: 'INVALID', message: `invalid direction: ${partial.direction}. allowed: ${_DIRS.join('|')}` };
    }
    writes.gradDirection = String(partial.direction);
    applied.direction = partial.direction;
  }
  if (partial.startColor !== undefined) {
    if (typeof partial.startColor !== 'string' || !_HEX6.test(partial.startColor)) {
      return { ok: false, code: 'INVALID', message: `startColor must be #RRGGBB hex (got: ${partial.startColor})` };
    }
    writes.gradStart = partial.startColor;
    applied.startColor = partial.startColor;
  }
  if (partial.endColor !== undefined) {
    if (typeof partial.endColor !== 'string' || !_HEX6.test(partial.endColor)) {
      return { ok: false, code: 'INVALID', message: `endColor must be #RRGGBB hex (got: ${partial.endColor})` };
    }
    writes.gradEnd = partial.endColor;
    applied.endColor = partial.endColor;
  }
  if (partial.startAlpha !== undefined) {
    const a = Number(partial.startAlpha);
    if (!Number.isFinite(a) || a < 0 || a > 1) {
      return { ok: false, code: 'INVALID', message: `startAlpha must be number 0~1 (got: ${partial.startAlpha})` };
    }
    writes.gradStartAlpha = String(a);
    applied.startAlpha = a;
  }
  if (partial.endAlpha !== undefined) {
    const a = Number(partial.endAlpha);
    if (!Number.isFinite(a) || a < 0 || a > 1) {
      return { ok: false, code: 'INVALID', message: `endAlpha must be number 0~1 (got: ${partial.endAlpha})` };
    }
    writes.gradEndAlpha = String(a);
    applied.endAlpha = a;
  }
  if (partial.width !== undefined) {
    const n = Number(partial.width);
    if (!Number.isFinite(n) || n < 200 || n > 1200) {
      return { ok: false, code: 'INVALID', message: `width must be 200~1200 (got: ${partial.width})` };
    }
    writes.gradWidth = String(Math.round(n));
    applied.width = Math.round(n);
  }
  if (partial.height !== undefined) {
    const n = Number(partial.height);
    if (!Number.isFinite(n) || n < 50 || n > 1500) {
      return { ok: false, code: 'INVALID', message: `height must be 50~1500 (got: ${partial.height})` };
    }
    writes.gradHeight = String(Math.round(n));
    applied.height = Math.round(n);
  }
  if (partial.x !== undefined) {
    const n = Number(partial.x);
    if (!Number.isFinite(n) || n < -4000 || n > 4000) {
      return { ok: false, code: 'INVALID', message: `x must be -4000~4000 (got: ${partial.x})` };
    }
    writes.x = String(Math.round(n));
    applied.x = Math.round(n);
  }
  if (partial.y !== undefined) {
    const n = Number(partial.y);
    if (!Number.isFinite(n) || n < -4000 || n > 4000) {
      return { ok: false, code: 'INVALID', message: `y must be -4000~4000 (got: ${partial.y})` };
    }
    writes.y = String(Math.round(n));
    applied.y = Math.round(n);
  }
  if (partial.layerName !== undefined && partial.layerName !== null) {
    if (typeof partial.layerName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'layerName must be string' };
    }
    if ([...partial.layerName].length > 100) {
      return { ok: false, code: 'INVALID', message: 'layerName too long (>100)' };
    }
    writes.layerName = partial.layerName;
    applied.layerName = partial.layerName;
  }

  if (Object.keys(writes).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no recognized fields in partial' };
  }

  // ── 2) pushHistory (변경 전 1회) ──────────────────────────────────────────
  try { window.pushHistory?.('그라데이션 수정'); } catch (_) {}

  // ── 3) dataset commit ─────────────────────────────────────────────────────
  for (const [k, v] of Object.entries(writes)) {
    block.dataset[k] = v;
  }

  // B24: 레거시 색/alpha 필드가 MCP로 들어오면 gradStops 정본을 비워 2-stop 레거시로 폴백(불일치 방지).
  if (['gradStart','gradEnd','gradStartAlpha','gradEndAlpha'].some(k => k in writes)) {
    delete block.dataset.gradStops;
  }

  // ── 4) 재렌더 ─────────────────────────────────────────────────────────────
  try {
    (window.renderGradientBlock || renderGradientBlock)(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // ── 5) 우측 패널 갱신 (선택 상태일 때만 — prop-gradient.js가 ID로 input 참조) ──
  if (block.classList.contains('selected')) {
    try { window.showGradientProperties?.(block); } catch (_) {}
  }

  // ── 6) 레이어 패널 (layerName 변경 가능성) ────────────────────────────────
  try { window.buildLayerPanel?.(); } catch (_) {}

  // ── 7) autosave ───────────────────────────────────────────────────────────
  try { window.scheduleAutoSave?.(); } catch (_) {}

  const after = { ...block.dataset };
  return { ok: true, blockId, before, applied, after };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeGradientBlock   = makeGradientBlock;
window.addGradientBlock    = addGradientBlock;
window.renderGradientBlock = renderGradientBlock;
window.updateGradientBlock = updateGradientBlock;
window.resolveGradientStops = _resolveStops;

export { makeGradientBlock, addGradientBlock, updateGradientBlock, renderGradientBlock, _resolveStops, GRADIENT_DEFAULTS };
