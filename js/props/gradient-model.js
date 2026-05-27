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
  getGradientTarget,
  registerGradientTarget,
  GradientModel,
};
export default GradientModel;
