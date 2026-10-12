/* text-stroke-filter.js — ★1012t1E1 텍스트 블럭 «내부(inside)» 외곽선의 SVG 필터 정의 보관소.
 *
 * 왜 필터인가 (실측 — scratchpad/e1 · E1-plan §2):
 *   CSS 만으로 «글자 안쪽에만» 획을 긋는 길이 없었다(mask-clip:text 는 획을 못 자름 · T3/T3b ❌).
 *   feMorphology erode(SourceAlpha, N) → (원본 − 깎은 것) = 안쪽 띠 → 색 칠 → 원본 «위»에 얹는다 (T4 ✅ 안쪽 ≈N · 바깥 0).
 *
 * 렌더 정본 = 글자칸 인라인 변수 `--gd-stroke-filter: url(#gdsk-in-…)` (css/editor-blocks.css 가 filter 로 건다).
 *   ⛔인라인 filter 를 직접 쓰지 마라 — clearTextEffect 가 인라인 filter 를 지운다(tgs 와 같은 까닭).
 *   ⛔외곽선을 text-shadow 로 그리지 마라 — 글로우(js/effects-glow.js fxComposeTextShadow)와 같은 자리를 다툰다.
 *
 * 보관소 = body 직속 <svg id="gdsk-svg-defs"> — 캔버스 «밖»이라 저장·undo 스냅샷에 안 실린다.
 *   ⇒ 로드·undo·붙여넣기로 [data-stroke-align="inside"] 글자가 들어오면 아래 관찰자가 «같은 id 로» 다시 만든다
 *     (text-block-color.js 의 tgs 보관소와 같은 병·같은 약).
 */

const SVGNS = 'http://www.w3.org/2000/svg';
const DEFS_ID = 'gdsk-svg-defs';
const _HARD_CAP = 64;

/* 색 → { hex:'#rrggbb', a:0..1 } (#rgb · #rrggbb · rgb() · rgba()) */
export function strokeColorParts(c) {
  const s = String(c || '').trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return { hex: '#' + m[1].toLowerCase(), a: 1 };
  m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return { hex: ('#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase(), a: 1 };
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const to = n => Math.max(0, Math.min(255, parseInt(n, 10) || 0)).toString(16).padStart(2, '0');
    const a = p.length >= 4 ? Math.max(0, Math.min(1, parseFloat(p[3]))) : 1;
    return { hex: '#' + to(p[0]) + to(p[1]) + to(p[2]), a: isNaN(a) ? 1 : a };
  }
  return { hex: '#000000', a: 1 };
}

/** 같은 (두께·색) = 같은 id. 소수점은 _ 로. */
export function strokeFilterId(w, color) {
  const { hex, a } = strokeColorParts(color);
  const ws = String(Math.round((+w || 0) * 2) / 2).replace('.', '_');
  return `gdsk-in-${ws}-${hex.slice(1)}${a < 1 ? '-' + Math.round(a * 100) : ''}`;
}

/** 내부 외곽선 필터 마크업 (E1-plan T4 와 같은 식) */
export function strokeFilterMarkup(id, w, color) {
  const { hex, a } = strokeColorParts(color);
  const r = Math.max(0, +w || 0);
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">`
    + `<feMorphology in="SourceAlpha" operator="erode" radius="${r}" result="er"/>`
    + `<feComposite in="SourceAlpha" in2="er" operator="out" result="band"/>`
    + `<feFlood flood-color="${hex}" flood-opacity="${a}"/>`
    + `<feComposite in2="band" operator="in" result="stroke"/>`
    + `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="stroke"/></feMerge>`
    + `</filter>`;
}

function _defs() {
  let svg = document.getElementById(DEFS_ID);
  if (!svg) {
    svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('id', DEFS_ID);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.appendChild(svg);
  }
  return svg;
}

export function ensureStrokeFilter(w, color) {
  try {
    const id = strokeFilterId(w, color);
    if (document.getElementById(id)) return id;
    const svg = _defs();
    const tpl = document.createElementNS(SVGNS, 'svg');
    tpl.innerHTML = strokeFilterMarkup(id, w, color);
    const f = tpl.firstElementChild;
    if (!f) return '';
    svg.appendChild(f);
    if (svg.childElementCount > _HARD_CAP) gcStrokeFilters(id);
    return id;
  } catch (_) { return ''; }
}

const _URL_ID = /url\(\s*["']?#(gdsk-in-[0-9a-z_-]+)["']?\s*\)/g;
function _usedIds(root) {
  const used = new Set();
  const scope = root || document;
  const list = [];
  if (scope.nodeType === 1 && scope.matches && scope.matches('[style*="--gd-stroke-filter"]')) list.push(scope);
  if (scope.querySelectorAll) list.push(...scope.querySelectorAll('[style*="--gd-stroke-filter"]'));
  for (const el of list) {
    const v = el.style ? el.style.getPropertyValue('--gd-stroke-filter') : '';
    for (const m of String(v).matchAll(_URL_ID)) used.add(m[1]);
  }
  return used;
}

/** 안 쓰이는 정의를 지운다(keepId 는 남김). 지운 수. */
export function gcStrokeFilters(keepId) {
  try {
    const svg = document.getElementById(DEFS_ID);
    if (!svg) return 0;
    const used = _usedIds(document);
    if (keepId) used.add(keepId);
    let n = 0;
    for (const f of [...svg.children]) if (!used.has(f.id)) { f.remove(); n++; }
    return n;
  } catch (_) { return 0; }
}

/** root 안 글자들이 쓰는 내부 외곽선 정의만 담은 <svg> — 내보낸 HTML 처럼 문서 밖으로 나가는 사본용. 없으면 ''. */
export function strokeDefsMarkup(root) {
  try {
    const used = _usedIds(root);
    if (!used.size) return '';
    let inner = '';
    for (const id of used) {
      const f = document.getElementById(id);
      if (f && f.closest('#' + DEFS_ID)) inner += f.outerHTML;
    }
    if (!inner) return '';
    return `<svg id="${DEFS_ID}" aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none">`
      + inner + '</svg>';
  } catch (_) { return ''; }
}

/** dataset(패널 상태) → 인라인 --gd-stroke-filter 를 맞춘다. 멱등. 속성만 바꾼다(관찰자 되먹임 없음). */
export function syncStrokeFilter(el) {
  if (!el || !el.style || !el.dataset) return false;
  const ds = el.dataset;
  const st = el.style;
  if (ds.strokeOn === 'true' && ds.strokeAlign === 'inside') {
    const w = parseFloat(ds.strokeW);
    if (w > 0) {
      const id = ensureStrokeFilter(w, ds.strokeColor || '#000000');
      const v = id ? `url(#${id})` : '';
      if (v && st.getPropertyValue('--gd-stroke-filter') !== v) st.setProperty('--gd-stroke-filter', v);
      return !!v;
    }
  }
  if (st.getPropertyValue('--gd-stroke-filter')) st.removeProperty('--gd-stroke-filter');
  return false;
}

const _SEL = '[data-stroke-align="inside"], [style*="--gd-stroke-filter"]';
function _syncTree(node) {
  if (!node || node.nodeType !== 1) return;
  if (node.matches && node.matches(_SEL)) syncStrokeFilter(node);
  if (node.querySelectorAll) node.querySelectorAll(_SEL).forEach(syncStrokeFilter);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.syncStrokeFilter = syncStrokeFilter;
  window.gcStrokeFilters = gcStrokeFilters;
  window.strokeDefsMarkup = strokeDefsMarkup;
  /* 로드·undo 복원(innerHTML)·붙여넣기로 들어온 노드의 정의를 다시 만든다 (E1-plan S7). */
  try {
    const _start = () => {
      _syncTree(document.body);
      new MutationObserver((muts) => {
        for (const m of muts) for (const n of m.addedNodes) _syncTree(n);
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) _start(); else document.addEventListener('DOMContentLoaded', _start, { once: true });
  } catch (_) {}
}
