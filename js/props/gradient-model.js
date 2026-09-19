// gradient-model.js — on-canvas gradient annotator MODULE 1 (parse / serialize / geometry / target).
// Block-agnostic core for the "Gradient Annotator" direction line. The CSS string format MUST stay
// byte-identical to color-picker.js _buildGradientCSS()/_hexToRgba() so undo/autosave round-trip cleanly.
// ES module that ALSO exposes window.GradientModel and window.getGradientTarget for global-script callers.

/* ------------------------------------------------------------------ *
 * 1) parse
 * ------------------------------------------------------------------ */

// Split a gradient's inner argument list on TOP-LEVEL commas only.
// Stop colors are rgba(r,g,b,a) which themselves contain commas, so a naive
// str.split(',') would shatter them. We track paren depth and only break at depth 0.
function _splitTopLevel(s) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map(t => t.trim()).filter(Boolean);
}

// Pull the alpha out of an rgba(...)/rgb(...) color, else opacity 1.
function _colorOpacity(color) {
  const m = /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(color);
  if (m && m[1] !== undefined) {
    const a = parseFloat(m[1]);
    return isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
  }
  return 1;
}

// css -> { type, angle, stops:[{color, offset(0-1), opacity(0-1)}] } | null
function parseGradient(css) {
  if (typeof css !== 'string') return null;
  const str = css.trim();

  // Reject non-gradients (hex, rgb(), transparent, url(), multi-background with url, etc.).
  const m = /^(linear|radial)-gradient\((.*)\)$/is.exec(str);
  if (!m) return null;
  const type = m[1].toLowerCase() === 'radial' ? 'radial' : 'linear';
  const inner = m[2];

  // Multi-background like `linear-gradient(...), url(...)` survives the outer match because the
  // closing paren is the gradient's own; guard explicitly against trailing layers / url().
  if (/\burl\(/i.test(inner)) return null;

  const tokens = _splitTopLevel(inner);
  if (tokens.length < 2) return null;

  let angle = type === 'radial' ? 0 : 180;
  let idx = 0;
  const first = tokens[0];

  if (/^-?\d+(\.\d+)?deg$/i.test(first)) {
    angle = parseFloat(first);
    idx = 1;
  } else if (type === 'radial') {
    // radial: a leading shape token (circle / ellipse / "at ...") is not a stop — skip it
    // only when it lacks a color+position shape (no '%' and no color funcs).
    if (/^(circle|ellipse|at\b)/i.test(first) && !/%/.test(first)) idx = 1;
  }

  const stopTokens = tokens.slice(idx);
  if (stopTokens.length < 2) return null;

  const stops = [];
  for (const tk of stopTokens) {
    // "<color> <pos>%" — color may itself be rgba(...) with internal spaces, so grab the
    // trailing "<number>%" and treat everything before it as the color.
    const pm = /^(.*?)\s+(-?[\d.]+)%$/.exec(tk);
    let color, offset;
    if (pm) {
      color = pm[1].trim();
      offset = parseFloat(pm[2]) / 100;
    } else {
      color = tk.trim();
      offset = stops.length === 0 ? 0 : 1; // position-less stop fallback
    }
    if (!color) return null;
    stops.push({ color, offset, opacity: _colorOpacity(color) });
  }

  return { type, angle, stops };
}

/* ------------------------------------------------------------------ *
 * 2) serialize  (byte-identical to color-picker.js)
 * ------------------------------------------------------------------ */

function _hexToRgba(hex, a) {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// Emit a stop color string: rgba() only when opacity<1, matching the picker.
function _stopColor(stop) {
  const op = (stop.opacity == null) ? 1 : stop.opacity;
  const c = stop.color || '#000000';
  if (op < 1) {
    // Already an rgba()? re-emit through the picker's formatter so the alpha precision matches.
    const rgbM = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(c);
    if (rgbM) {
      const r = Math.round(parseFloat(rgbM[1])), g = Math.round(parseFloat(rgbM[2])), b = Math.round(parseFloat(rgbM[3]));
      return `rgba(${r},${g},${b},${op.toFixed(3)})`;
    }
    return _hexToRgba(c, op);
  }
  return c; // hex (or any solid color) passes through unchanged
}

function toCss(model) {
  if (!model || !Array.isArray(model.stops)) return '';
  const type = model.type === 'radial' ? 'radial' : 'linear';
  const parts = model.stops.map(s => `${_stopColor(s)} ${Math.round((s.offset || 0) * 100)}%`);
  if (type === 'radial') return `radial-gradient(circle, ${parts.join(', ')})`;
  const angle = Math.round(model.angle == null ? 180 : model.angle);
  return `linear-gradient(${angle}deg, ${parts.join(', ')})`;
}

/* ------------------------------------------------------------------ *
 * 3) geometry  (p coords normalized 0-1 within the block's local box)
 * ------------------------------------------------------------------ */

// CSS gradient convention: 0deg points UP, increases CLOCKWISE.
// With screen coords (y down), the direction vector for angle a is (sin a, -cos a).
// Inverting: atan2(dx, -dy) recovers a. e.g. p0 top -> p1 bottom => dx=0,dy>0 => atan2(0,-1)=180 ("to bottom"). OK.
function handlesToAngle(p0, p1) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

function angleToHandles(deg) {
  const rad = deg * Math.PI / 180;
  const ux = Math.sin(rad);
  const uy = -Math.cos(rad);
  const clamp = v => Math.max(0, Math.min(1, v));
  return {
    p0: { x: clamp(0.5 - 0.5 * ux), y: clamp(0.5 - 0.5 * uy) },
    p1: { x: clamp(0.5 + 0.5 * ux), y: clamp(0.5 + 0.5 * uy) },
  };
}

// Scalar projection of P onto segment p0->p1, clamped to [0,1].
function projectOffset(p0, p1, P) {
  const vx = p1.x - p0.x, vy = p1.y - p0.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-9) return 0;
  const t = ((P.x - p0.x) * vx + (P.y - p0.y) * vy) / len2;
  return Math.max(0, Math.min(1, t));
}

/* ------------------------------------------------------------------ *
 * 3b) canvas bar geometry (0918 canvasgrad — 피그마식 캔버스 그라데이션 바)
 *
 * 두 좌표 공간이 있다 — 어댑터(registerGradientTarget)의 space 필드로 고른다.
 *   · 'css'  : CSS background gradient(banner02/comparison). 색 선 길이
 *              L = |w·sinA| + |h·cosA| (px) — 박스 밖으로 나갈 수 있다 → «클램프 금지».
 *              각도·투영은 px 공간에서 한다(비정사각형에서 정규화 공간 각도 ≠ 렌더 각도).
 *   · 'bbox' : SVG objectBoundingBox(shape). prop-shape.js _applyShapeGradient 의
 *              x1,y1,x2,y2 = 0.5 ∓ 0.5·(sinA, −cosA) 와 «같은» 선. 각도·투영은 정규화 공간.
 * 점은 전부 정규화(0-1 = 타겟 박스) 좌표로 돌려준다. px 로 바꾸는 건 호출자(×w, ×h).
 * ------------------------------------------------------------------ */

// model → { p0, p1, radial } (정규화). radial: p0=중심, p1=오른쪽 반경 끝.
function gradientLine(model, { space = 'bbox', w = 1, h = 1 } = {}) {
  const W = w || 1, H = h || 1;
  if (model && model.type === 'radial') {
    if (space === 'css') {
      // radial-gradient(circle, …) 기본 크기 = farthest-corner → 반경 = 중심→모서리 거리(px)
      const r = Math.hypot(W / 2, H / 2);
      return { p0: { x: 0.5, y: 0.5 }, p1: { x: 0.5 + r / W, y: 0.5 }, radial: true };
    }
    return { p0: { x: 0.5, y: 0.5 }, p1: { x: 1, y: 0.5 }, radial: true }; // SVG r=50% bbox
  }
  const deg = (model && model.angle != null) ? Number(model.angle) : 180;
  const rad = deg * Math.PI / 180;
  const ux = Math.sin(rad), uy = -Math.cos(rad);
  if (space === 'css') {
    const L = Math.abs(W * ux) + Math.abs(H * uy);
    const hx = (ux * L / 2) / W, hy = (uy * L / 2) / H;
    return { p0: { x: 0.5 - hx, y: 0.5 - hy }, p1: { x: 0.5 + hx, y: 0.5 + hy }, radial: false };
  }
  return { p0: { x: 0.5 - 0.5 * ux, y: 0.5 - 0.5 * uy }, p1: { x: 0.5 + 0.5 * ux, y: 0.5 + 0.5 * uy }, radial: false };
}

// 중심→커서 방향으로 CSS 각도(0=위, 시계방향, 0~360). center/cursor 는 정규화.
function angleFromDrag(center, cursor, { space = 'bbox', w = 1, h = 1 } = {}) {
  const sx = space === 'css' ? (w || 1) : 1;
  const sy = space === 'css' ? (h || 1) : 1;
  return handlesToAngle({ x: center.x * sx, y: center.y * sy }, { x: cursor.x * sx, y: cursor.y * sy });
}

// 정규화 점 P 가 선 위 어느 offset(0~1)에 해당하나 — 공간에 맞게 투영.
function offsetOnLine(line, P, { space = 'bbox', w = 1, h = 1 } = {}) {
  const sx = space === 'css' ? (w || 1) : 1;
  const sy = space === 'css' ? (h || 1) : 1;
  const m = (p) => ({ x: p.x * sx, y: p.y * sy });
  return projectOffset(m(line.p0), m(line.p1), m(P));
}

// px 선(p0px→p1px) 위 offset 점에서 법선 n=(sinθ, −cosθ) 방향으로 d 만큼 띄운 칩 중심 + 회전각.
// θ = 선의 화면 각도(atan2(dy,dx)). θ=0(오른쪽으로 뻗은 선)이면 칩은 선 «위쪽»에 뜬다.
function chipPlacement(p0px, p1px, offset, dPx) {
  const dx = p1px.x - p0px.x, dy = p1px.y - p0px.y;
  const th = Math.atan2(dy, dx);
  const t = Math.max(0, Math.min(1, offset || 0));
  const px = p0px.x + dx * t, py = p0px.y + dy * t;
  return {
    x: px + Math.sin(th) * dPx,
    y: py - Math.cos(th) * dPx,
    rotDeg: th * 180 / Math.PI,
    onLine: { x: px, y: py },
  };
}

// ── 자유 끝점(0918 canvasgrad 픽스 — 현빈 «추가 2») ──────────────────────────
// 화면에 그리는 바(= view: 사용자가 끈 두 끝점, 정규화 좌표, 박스 밖 허용)와
// 실제 렌더 규칙이 정하는 선(= canon: gradientLine)은 다를 수 있다. 저장 스키마(각도+스탑 %)는
// 그대로 두고, 스탑 위치를 canon 기준으로 «다시 계산»해 표현한다(0% 미만·100% 초과 허용).
//   canon offset t' = a + b·t   (t = view 위 상대 위치 0~1)
// 두 선이 평행(각도가 view 방향에서 나옴)이라 투영 한 번으로 정확하다.

// 클램프 없는 스칼라 투영(공간 metric 반영).
function projectT(line, P, { space = 'bbox', w = 1, h = 1 } = {}) {
  const sx = space === 'css' ? (w || 1) : 1;
  const sy = space === 'css' ? (h || 1) : 1;
  const vx = (line.p1.x - line.p0.x) * sx, vy = (line.p1.y - line.p0.y) * sy;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-12) return 0;
  return ((P.x - line.p0.x) * sx * vx + (P.y - line.p0.y) * sy * vy) / len2;
}

// view → canon 선형 사상 계수 {a, b}.
function viewMap(model, view, opts = {}) {
  const canon = gradientLine(model, opts);
  const a = projectT(canon, view.p0, opts);
  const b = projectT(canon, view.p1, opts) - a;
  return { a, b: Math.abs(b) < 1e-9 ? 1 : b, canon };
}

// 저장값만 있을 때(재선택·외부 변경) 화면 바: canon 선을 스탑 범위까지 늘린 것.
// 스탑이 전부 0~1 이면 canon 그대로(기존 동작과 동일).
function defaultView(model, opts = {}) {
  const canon = gradientLine(model, opts);
  if (!model || model.type === 'radial' || !Array.isArray(model.stops) || !model.stops.length) return { p0: canon.p0, p1: canon.p1 };
  const offs = model.stops.map(s => Number(s.offset) || 0);
  const lo = Math.min(0, ...offs), hi = Math.max(1, ...offs);
  const at = (t) => ({ x: canon.p0.x + (canon.p1.x - canon.p0.x) * t, y: canon.p0.y + (canon.p1.y - canon.p0.y) * t });
  return { p0: at(lo), p1: at(hi) };
}

const round2 = (v) => Math.round(v * 100) / 100; // 저장 CSS 가 정수 % 라 모델도 1% 단위로

// 끝점을 옮긴 view + 각 스탑의 view 상대 위치(rel) → 새 {angle, offsets}. 각도는 정수로(저장 규칙).
function applyView(view, rel, opts = {}) {
  const angle = Math.round(angleFromDrag(view.p0, view.p1, opts)) % 360;
  const model = { type: 'linear', angle };
  const { a, b } = viewMap(model, view, opts);
  return { angle, offsets: rel.map(t => round2(a + b * t)) };
}

// SVG 용 — <stop offset> 은 0~1 로 잘린다. 스탑이 범위 밖이면 선(x1..x2, bbox 정규화)을 스탑 범위까지
// 늘리고 offset 을 그 안으로 재매핑한다(CSS 와 같은 그림). 범위 안이면 입력 그대로(remap=null).
function svgStopRemap(line, offsets) {
  const offs = offsets.map(o => Number(o) || 0);
  const lo = Math.min(0, ...offs), hi = Math.max(1, ...offs);
  if (lo >= 0 && hi <= 1) return { ...line, offsets: offs, remap: null };
  const dx = line.x2 - line.x1, dy = line.y2 - line.y1, span = hi - lo;
  return {
    x1: line.x1 + dx * lo, y1: line.y1 + dy * lo,
    x2: line.x1 + dx * hi, y2: line.y1 + dy * hi,
    offsets: offs.map(o => (o - lo) / span),
    remap: { lo, span },
  };
}

// 칩 드래그 후 정렬 — 배열을 offset 오름차순으로 «제자리» 정렬하고, 선택돼 있던 스탑 «객체»의
// 새 인덱스를 돌려준다(드래그 중엔 순서를 고정하므로 mouseup 에서 한 번만 부른다).
function sortStopsKeepSelection(stops, selectedIdx) {
  const sel = stops[selectedIdx];
  stops.sort((a, b) => (a.offset || 0) - (b.offset || 0));
  const i = stops.indexOf(sel);
  return i < 0 ? 0 : i;
}

// 정렬 «사본»과, 원본 인덱스 idx 가 정렬 사본에서 몇 번째인지(피커 _sortedStops 관례와 같은 안정 정렬).
function sortedIndexOf(stops, idx) {
  const order = stops.map((s, i) => ({ o: s.offset || 0, i })).sort((a, b) => a.o - b.o);
  return order.findIndex(e => e.i === idx);
}

/* ------------------------------------------------------------------ *
 * 4) getGradientTarget — block-agnostic adapter registry
 * ------------------------------------------------------------------ */

// Each entry: { match(blockEl) -> bool, make(blockEl) -> {rect, get, set} }.
// banner02 + comparison are required; push more here later.
const _registry = [];
function registerGradientTarget(entry) { _registry.push(entry); }

// banner02: bg lives on block.dataset.bg, painted directly on the block element.
registerGradientTarget({
  match: (el) => el.classList.contains('banner02-block'),
  make: (block) => ({
    space: 'css',
    rect: () => {
      const inner = block.querySelector('.bn2-inner');
      // The visible background is painted on `block` itself; .bn2-inner is a 0-origin scaled
      // overlay. Prefer the block rect (the actual painted surface), fall back is the same.
      return (inner && inner.getBoundingClientRect().width > 0)
        ? block.getBoundingClientRect()
        : block.getBoundingClientRect();
    },
    get: () => block.dataset.bg || '',
    set: (css, commit) => {
      block.dataset.bg = css;
      window.renderBanner02?.(block);
      window.scheduleAutoSave?.();
      if (commit) window.pushHistory?.();
    },
  }),
});

// comparison: bg lives on the ACTIVE column (default = featured) — cols[i].bg.
registerGradientTarget({
  match: (el) => el.classList.contains('comparison-block'),
  make: (block) => {
    const activeIdx = () => {
      const cols = window.getComparisonCols?.(block.dataset) || [];
      const n = cols.length || 1;
      return window.getComparisonFeaturedIdx?.(block.dataset, n) ?? (n - 1);
    };
    const colEl = () => {
      const i = activeIdx();
      return block.querySelector(`.cmp-col[data-col-idx="${i}"]`)
          || block.querySelectorAll('.cmp-col')[i]
          || block;
    };
    return {
      space: 'css',
      rect: () => colEl().getBoundingClientRect(),
      get: () => {
        const cols = window.getComparisonCols?.(block.dataset) || [];
        return cols[activeIdx()]?.bg || '';
      },
      set: (css, commit) => {
        const cols = window.getComparisonCols?.(block.dataset) || [];
        const i = activeIdx();
        if (!cols[i]) return;
        cols[i].bg = css;
        window.setComparisonCols?.(block, cols);
        window.renderComparison?.(block);
        window.scheduleAutoSave?.();
        if (commit) window.pushHistory?.();
      },
    };
  },
});

// shape-block: fill is painted via SVG <linearGradient>/<radialGradient> defs (not CSS
// background), but block.dataset.shapeColor still stores the CSS gradient string for
// display/round-trip (byte-identical to prop-shape.js applyGradient()). set() replays the
// same write path prop-shape.js uses (window._applyShapeGradient + dataset + autosave/history)
// so on-canvas drags stay indistinguishable from popup edits.
//
// ★rect(): unlike banner02/comparison (never rotated), shape-block carries its own CSS
// transform:rotate(deg) (prop-shape.js _updateFrameForRotation). getBoundingClientRect() on a
// rotated element returns the axis-aligned bounding box, which is INFLATED vs the shape's true
// local size for any non-90°-multiple angle (×√2 at 45°) — using that directly as the overlay's
// box size makes the handle line render oversized/detached from the visible shape. Position
// (left/top) still comes from getBoundingClientRect() since blockEl's own rect is computed the
// same (equally inflated) way in gradient-line-overlay.js's _computeBox, so the (cr-br) offset
// still cancels out; only width/height must come from the untransformed layout box.
registerGradientTarget({
  match: (el) => el.classList.contains('shape-block'),
  make: (block) => {
    const svg = () => block.querySelector('svg');
    return {
      space: 'bbox',
      rotation: () => parseFloat(block.dataset.shapeRotation) || 0,
      rect: () => {
        const el = svg() || block;
        const r = el.getBoundingClientRect();
        // ★block.offsetWidth/Height, not el's — el may be the <svg>, and SVGElement doesn't
        // implement offsetWidth/offsetHeight (undefined, not 0) so `el.offsetWidth || r.width`
        // silently falls through to the inflated rotated rect every time. block is always a
        // plain HTMLElement (the .shape-block div) and its offsetWidth/Height are unaffected by
        // the CSS rotate() transform regardless of which element (svg or block) painted `r`.
        // ★단위 맞춤(0918 리뷰 high): offsetWidth/Height 는 «줌 적용 전» 캔버스 px 인데 left/top 은
        //   화면 px 이고, _computeBox 는 rect() 전체를 «화면 px»로 보고 ÷zoom 한다. 그래서 줌 40%
        //   에서 오버레이가 도형의 2.5배로 그려졌다(100% 에서만 우연히 맞음). → 화면 px 로 되돌려 준다.
        //   배율은 getGradientTarget 쪽 전역 줌(window.currentZoom)과 같은 값.
        const z = (Number(window.currentZoom) > 0 ? Number(window.currentZoom) : 100) / 100;
        const w = block.offsetWidth ? block.offsetWidth * z : r.width;
        const h = block.offsetHeight ? block.offsetHeight * z : r.height;
        return { left: r.left, top: r.top, width: w, height: h, right: r.left + w, bottom: r.top + h };
      },
      get: () => block.dataset.shapeColor || '',
      set: (css, commit) => {
        const s = svg();
        const g = parseGradient(css);
        if (!s || !g) return;
        // 이미지(에셋)/바둑판 모드였다면 해제 — 그라데이션이 칠해지는 순간 이미지 모드가 아니다(0918 picker)
        if (block.dataset.shapeFill) {
          window._clearShapeImage?.(block);
          delete block.dataset.shapeFill;
          delete block.dataset.shapeImage;
        }
        window._applyShapeGradient?.(block, s, { css, type: g.type, angle: g.angle, stops: g.stops });
        block.dataset.shapeColor = css;
        block.dataset.shapeGradient = JSON.stringify({ type: g.type, angle: g.angle, stops: g.stops });
        window.scheduleAutoSave?.();
        if (commit) window.pushHistory?.();
      },
    };
  },
});

// getGradientTarget(blockEl) -> { rect(), get(), set(css, commit) } | null
// null for excluded blocks (.gradient-block has its own system) or non-gradient backgrounds.
function getGradientTarget(blockEl) {
  if (!blockEl || !blockEl.classList) return null;
  if (blockEl.classList.contains('gradient-block')) return null; // excluded — owns its own annotator

  const entry = _registry.find(e => e.match(blockEl));
  if (!entry) return null;

  const target = entry.make(blockEl);
  if (!target) return null;
  // Only expose targets whose current bg is actually a gradient string.
  if (!parseGradient(target.get())) return null;
  return target;
}

/* ------------------------------------------------------------------ *
 * exports + window globals
 * ------------------------------------------------------------------ */

const GradientModel = {
  parseGradient,
  toCss,
  handlesToAngle,
  angleToHandles,
  projectOffset,
  gradientLine,
  angleFromDrag,
  offsetOnLine,
  chipPlacement,
  sortStopsKeepSelection,
  sortedIndexOf,
  projectT,
  svgStopRemap,
  viewMap,
  defaultView,
  applyView,
  getGradientTarget,
  registerGradientTarget,
};

if (typeof window !== 'undefined') {
  window.GradientModel = GradientModel;
  window.getGradientTarget = getGradientTarget;
}

export {
  parseGradient,
  toCss,
  handlesToAngle,
  angleToHandles,
  projectOffset,
  gradientLine,
  angleFromDrag,
  offsetOnLine,
  chipPlacement,
  sortStopsKeepSelection,
  sortedIndexOf,
  projectT,
  svgStopRemap,
  viewMap,
  defaultView,
  applyView,
  getGradientTarget,
  registerGradientTarget,
  GradientModel,
};
export default GradientModel;
