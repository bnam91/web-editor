/* ═════════════════════════════════════════════════════════════════
   EFFECTS 식구 — 오블리크(롱섀도) (2026-11-21 · TEXT-FX-OBLIQUE-01 · 지디 발주 · 제니)
   ─────────────────────────────────────────────────────────────────
   ★무엇 = 피그마 플러그인 Oblique 꼴 — 각도·길이·색으로 글자 뒤에 «입체 깊이»(광고 배너 롱섀도).
   ★꼴 = js/effects-glow.js 를 그대로 본뜬다(명부 식구 한 벌 · 텍스트만 · 카드 = 같은 클래스).
   ★기법 = blur 0 겹을 각도 방향으로 1px 씩 len 장 — 인라인 text-shadow. ⛔따로 대입하지 않는다:
     글로우의 «합성 문»(fxComposedTextShadowCss)이 window.fxObliqueLayers 로 이 겹을 읽어 [글로우, 사용자 그림자, 오블리크] 로 쓴다.
     ⇒ 하류(PNG·HTML·GIF·그라데이션 .tgs)는 computed text-shadow 를 읽어 추가 배선 0.
   ★Figma = 그림자 8겹 상한 → fxFigmaTextShadow 가 오블리크 몫만 «고르게 솎아» 보낸다(다른 겹 수를 뺀 나머지).
   ★정본 = .text-block dataset `fxOblique`('on'|'off') · `fxObliqueAngle` · `fxObliqueLen` · `fxObliqueColor` · `fxObliqueOp`.
     ✕ = 키 전부 지움(켜기 전 바이트). 키 없음 = 아무것도 안 만진다(옛 문서 그대로).
   ★각도 = 화면 기준(0° = 오른쪽 · 90° = 아래 · 시계방향). 기본 45° = 오른쪽 아래.
   ═════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { fxComposeTextShadow, fxComposedTextShadowCss } from './effects-glow.js';
import { parseShadowList } from './props/text-shadow-filter.js';

export const FX_OBLIQUE_KEYS = ['fxOblique', 'fxObliqueAngle', 'fxObliqueLen', 'fxObliqueColor', 'fxObliqueOp'];
export const FX_OBLIQUE_DEFAULTS = { angle: 45, len: 12, color: '#1a1a1a', op: 100 };
export const FX_OBLIQUE_RANGES = { angle: [0, 360], len: [1, 40], op: [0, 100] };
export const FIGMA_SHADOW_MAX = 8;

const _int = (raw, [lo, hi], d) => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (typeof raw === 'number' ? raw : NaN);
  if (!Number.isFinite(n)) return d;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};
const _hex6 = (h) => {
  let s = String(h ?? '').trim();
  if (s && s[0] !== '#') s = '#' + s;
  if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : FX_OBLIQUE_DEFAULTS.color;
};
const _rgba = (color, op) => {
  const h = _hex6(color).slice(1);
  const a = Math.max(0, Math.min(1, op / 100));
  if (a >= 1) return '#' + h;
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};
const _r1 = (v) => { const r = Math.round(v * 10) / 10; return Object.is(r, -0) ? 0 : r; };

/** 글자칸 — effects-glow.js _contentOf 와 같은 순서. */
function _contentOf(tb) {
  if (!tb || !tb.querySelector) return null;
  return tb.querySelector('[contenteditable]')
    || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text');
}

/** 효과 읽기 — {state:'none'|'on'|'off', angle, len, color, op}. */
export function fxObliqueOf(tb) {
  const ds = (tb && tb.dataset) || {};
  const state = ds.fxOblique === 'on' ? 'on' : (ds.fxOblique === 'off' ? 'off' : 'none');
  const D = FX_OBLIQUE_DEFAULTS, R = FX_OBLIQUE_RANGES;
  return {
    state,
    angle: _int(ds.fxObliqueAngle, R.angle, D.angle),
    len: _int(ds.fxObliqueLen, R.len, D.len),
    color: _hex6(ds.fxObliqueColor || D.color),
    op: _int(ds.fxObliqueOp, R.op, D.op),
  };
}

/** 오블리크 겹 css(켜진 때만 · 아니면 '') — 순수 함수.
 *  max < len 이면 1..len 에서 max 장을 고르게 뽑는다(끝 장 = 전체 길이는 늘 남는다 — 깊이가 줄지 않게). */
export function fxObliqueLayers(tb, max = Infinity) {
  const fx = fxObliqueOf(tb);
  if (fx.state !== 'on') return '';
  const n = Math.max(1, Math.min(fx.len, Math.floor(max) || 1));
  const rad = fx.angle * Math.PI / 180, dx = Math.cos(rad), dy = Math.sin(rad), c = _rgba(fx.color, fx.op);
  const out = [];
  for (let k = 1; k <= n; k++) {
    const i = Math.round(k * fx.len / n);
    out.push(`${_r1(dx * i)}px ${_r1(dy * i)}px 0px ${c}`);
  }
  return out.join(', ');
}

/** Figma 로 보낼 text-shadow — 오블리크가 안 켜졌으면 null(부르는 쪽이 옛 길 그대로). 켜졌으면 총 겹 ≤ 8. */
export function fxFigmaTextShadow(contentEl) {
  const tb = contentEl && contentEl.closest ? contentEl.closest('.text-block') : null;
  if (!tb || fxObliqueOf(tb).state !== 'on') return null;
  const others = (parseShadowList(fxComposedTextShadowCss(contentEl, undefined, { obliqueMax: 0 })) || []).length;
  return fxComposedTextShadowCss(contentEl, undefined, { obliqueMax: Math.max(1, FIGMA_SHADOW_MAX - others) });
}

function _dropEmptyStyle(el) { if (el && el.getAttribute && el.getAttribute('style') === '') el.removeAttribute('style'); }

function _render(tb) {
  const ce = _contentOf(tb);
  if (!ce) return;
  fxComposeTextShadow(ce);
  if (fxObliqueOf(tb).state !== 'on') _dropEmptyStyle(ce);
  window.syncTextGradShadow?.(ce);
}

export function applyFxOblique(tb) {
  if (!tb || !tb.dataset) return;
  if (fxObliqueOf(tb).state === 'none') return;
  _render(tb);
}

/** 바꾸는 문 «하나» — patch: {state?, angle?, len?, color?, op?} · state 'none' = 키 전부 지움(✕). 이력 push-before. */
export function setFxOblique(tb, patch = {}, { history = true } = {}) {
  if (!tb || !tb.dataset) return { ok: false, code: 'NOT_FOUND' };
  if (history) window.pushHistory?.('효과');
  const ds = tb.dataset;
  if (patch.state === 'none') { FX_OBLIQUE_KEYS.forEach(k => { delete ds[k]; }); }
  else {
    if (patch.state === 'on' || patch.state === 'off') ds.fxOblique = patch.state;
    else if (!ds.fxOblique) ds.fxOblique = 'on';
    const R = FX_OBLIQUE_RANGES, D = FX_OBLIQUE_DEFAULTS;
    if (patch.angle !== undefined) ds.fxObliqueAngle = String(_int(patch.angle, R.angle, D.angle));
    if (patch.len !== undefined) ds.fxObliqueLen = String(_int(patch.len, R.len, D.len));
    if (patch.op !== undefined) ds.fxObliqueOp = String(_int(patch.op, R.op, D.op));
    if (patch.color !== undefined) ds.fxObliqueColor = _hex6(patch.color);
  }
  _render(tb);
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxObliqueOf(tb) };
}

export function watchAllFxOblique(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  const els = root.querySelectorAll('.text-block[data-fx-oblique="on"]');
  els.forEach(applyFxOblique);
  return els.length;
}

/* ═══ 카드 — 글로우 카드와 같은 꼴(slider 행 → 색 행) ═══ */
function _obliqueCardHtml(tb, P) {
  const fx = fxObliqueOf(tb);
  const open = fxIsCardOpen(tb, 'oblique');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  const R = FX_OBLIQUE_RANGES;
  const hex = (window.formatHex6 ? window.formatHex6(fx.color) : fx.color.replace('#', '').toUpperCase());
  const slider = (lbl, key, val, [lo, hi]) => `
          <div class="prop-row">
            <span class="prop-label">${lbl}</span>
            <input type="range" class="prop-slider" id="${P}-fxob-${key}-slider" min="${lo}" max="${hi}" step="1" value="${val}">
            <input type="number" class="prop-number" id="${P}-fxob-${key}-num" min="${lo}" max="${hi}" value="${val}">
          </div>`;
  /* ★내보내기 안내 — Figma 는 8겹 상한이라 길이가 길면 솎아 보낸다(못 그대로 나가는 것을 숨기지 않는다) */
  const hint = fx.len > FIGMA_SHADOW_MAX ? `
          <div class="prop-hint" id="${P}-fxob-figma-hint">Figma 내보내기는 그림자 ${FIGMA_SHADOW_MAX}겹까지라 깊이를 솎아 보냅니다</div>` : '';
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxob-card" data-fx-type="oblique">
        <div class="prop-cell-card-header" id="${P}-fxob-head">
          <button class="prop-icon-btn" id="${P}-fxob-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">오블리크</span>
          <button class="prop-icon-btn" id="${P}-fxob-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxob-body"${open ? '' : ' hidden'}>${slider('각도', 'angle', fx.angle, R.angle)}${slider('길이', 'len', fx.len, R.len)}${slider('불투명도', 'op', fx.op, R.op)}
          <div class="prop-color-row">
            <span class="prop-label">색상</span>
            <div class="prop-color-field">
              <div class="prop-color-swatch" style="background:${fx.color}">
                <input type="color" id="${P}-fxob-color" value="${fx.color}">
              </div>
              <input type="text" class="prop-color-hex" id="${P}-fxob-color-hex" value="${hex}" maxlength="7" aria-label="Oblique color">
            </div>
          </div>${hint}
        </div>
      </div>`;
}

function _wireObliqueCard(tb, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxob-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxOblique(tb, { state: 'none' }); window.pushHistory?.('효과 끔'); again(); });
  $('fxob-eye')?.addEventListener('click', (e) => { e.stopPropagation(); const cur = fxObliqueOf(tb).state; setFxOblique(tb, { state: cur === 'off' ? 'on' : 'off' }); again(); });
  $('fxob-head')?.addEventListener('click', () => { const b = $('fxob-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(tb, 'oblique', open); $('fxob-card')?.classList.toggle('expanded', open); });
  for (const key of ['angle', 'len', 'op']) {
    const sl = $(`fxob-${key}-slider`), n = $(`fxob-${key}-num`);
    if (!sl || !n) continue;
    sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
    sl.addEventListener('change', () => { window.pushHistory?.('효과'); if (key === 'len') again(); });   /* len 은 Figma 안내 줄이 바뀐다 */
    sl.addEventListener('input', () => { setFxOblique(tb, { [key]: sl.value }, { history: false }); n.value = fxObliqueOf(tb)[key]; });
    n.addEventListener('change', () => { setFxOblique(tb, { [key]: n.value }); const v = fxObliqueOf(tb)[key]; n.value = v; sl.value = v; if (key === 'len') again(); });
  }
  const col = $('fxob-color'), hex = $('fxob-color-hex');
  col?.addEventListener('input', () => { setFxOblique(tb, { color: col.value }); });
  col?.addEventListener('change', () => { again(); });
  hex?.addEventListener('change', () => { setFxOblique(tb, { color: hex.value }); again(); });
}

registerFxType({
  key: 'oblique',
  label: '오블리크',
  supports: (el) => !!(el && el.classList && el.classList.contains('text-block')
    && !el.classList.contains('liner-block') && !el.classList.contains('speech-bubble-block') && _contentOf(el)),
  has:  (el) => fxObliqueOf(el).state !== 'none',
  add:  (el) => setFxOblique(el, { state: 'on' }),
  card: _obliqueCardHtml,
  wire: _wireObliqueCard,
  watchAll: watchAllFxOblique,
});

if (typeof window !== 'undefined') {
  Object.assign(window, {
    fxObliqueOf, fxObliqueLayers, fxFigmaTextShadow, applyFxOblique, setFxOblique, watchAllFxOblique,
    FX_OBLIQUE_KEYS, FX_OBLIQUE_DEFAULTS, FX_OBLIQUE_RANGES,
  });
}
