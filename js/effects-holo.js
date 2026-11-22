/* ═══════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — 홀로그램(FX-GRADIENT-GAZE-01 v3 · 현빈 261121 «별도 이펙트 — 피그마에서도 플러그인으로 있잖아»)
   ───────────────────────────────────────────────────────────────────────
   ★«칠을 넣어 주는» 도구: 프리셋 16(js/fx/holo-palette.js GAZE_PRESETS) + 세기(= «덮는 정도» · 0 = 넣기 전 칠 그대로 · 100 = 홀로 · holoMixStops · 미카사 채점 261121 ③) → 그 블럭의 «그라데이션 칠»
     (도형 = 도형 칠 · 글자 = 글자 그라데이션)에 그대로 쓴다 ⇒ 색 고르기 그라데이션 탭·캔버스 바·PNG/HTML/Figma 는 옛 길 그대로.
   ★상태 = 블럭 data-fx-holo 한 키(JSON {k 프리셋, a 세기 0..100, off?, prev 넣기 전 칠}) — 카드 ✕ = prev 로 되돌림 · 눈 끔 = prev 를 보이고 키 보존.
   ★shortcut: 그림 칠 도형(data-shape-fill)은 목록에 안 뜬다(그림 src 를 키에 담으면 저장본이 커진다) · 켠 뒤 색 고르기로 칠을 바꿔도 ✕ 는 prev 로 되돌린다.
   ═══════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { GAZE_PRESETS, gazeSwatchCss, holoMixStops } from './fx/holo-palette.js';
import { toCss, parseGradient } from './props/gradient-model.js';

export const FX_HOLO_DEFAULT = 'aurora';
const _isShape = (el) => !!el?.classList?.contains('shape-block');
const _txtContent = (tb) => tb.querySelector('[contenteditable]')
  || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.itb-text');
const _clampA = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 100; };

export function fxHoloOf(el) {
  let o = null;
  try { o = JSON.parse(el?.dataset?.fxHolo || 'null'); } catch (_) { o = null; }
  if (!o || typeof o !== 'object') return { state: 'none' };
  const k = GAZE_PRESETS.some((p) => p.key === o.k) ? o.k : FX_HOLO_DEFAULT;
  return { state: o.off ? 'off' : 'on', k, a: _clampA(o.a ?? 100), prev: o.prev && typeof o.prev === 'object' ? o.prev : {} };
}

/* 지금 칠 — 도형 {c, g} · 글자 {g(css)} */
function _snapshot(el) {
  if (_isShape(el)) return { c: el.dataset.shapeColor || '', g: el.dataset.shapeGradient || null };
  const ce = _txtContent(el); const g = ce && window.getTextGradient?.(ce);
  return { g: g ? g.css : null, t: !g && ce ? getComputedStyle(ce).color : null };   // t = 그라데이션 없는 글자색(세기 섞기 바탕)
}
/* 넣기 전 칠 → 섞기 바탕(holoMixStops base) · 모르면 null(옛 셈 = 투명도) */
function _baseOf(el, prev) {
  if (!prev) return null;
  if (prev.g) {
    let m = null;
    if (_isShape(el)) { try { m = JSON.parse(prev.g); } catch (_) {} } else { try { m = parseGradient(prev.g); } catch (_) {} }
    return m && Array.isArray(m.stops) && m.stops.length ? { stops: m.stops } : null;
  }
  if (_isShape(el)) return prev.c && !/gradient\(/.test(prev.c) ? { solid: prev.c } : null;
  return prev.t ? { solid: prev.t } : null;
}
function _curAngle(el, type) {
  let g = null;
  if (_isShape(el)) { try { g = JSON.parse(el.dataset.shapeGradient || 'null'); } catch (_) {} } else { const ce = _txtContent(el); g = ce && window.getTextGradient?.(ce); }
  return g && g.type === type && Number.isFinite(g.angle) ? g.angle : (type === 'conic' ? 0 : 90);
}
function _paint(el, k, a, prev) {
  const base = _baseOf(el, prev);
  if (a === 0 && base) { _restore(el, prev); return; }   // 0 = 넣기 전 칠 «그대로»(그라데이션 위 근사 없이 · 키는 남는다)
  const p = GAZE_PRESETS.find((x) => x.key === k) || GAZE_PRESETS[0];
  const d = { type: p.type, angle: _curAngle(el, p.type), stops: holoMixStops(p.stops, a, base) };
  d.css = toCss(d);
  if (_isShape(el)) window._applyShapeGradientFill?.(el, d); else window.applyTextGradient?.(el, d);
}
function _restore(el, prev) {
  if (_isShape(el)) {
    if (prev.g) { let m = null; try { m = JSON.parse(prev.g); } catch (_) {} if (m) { window._applyShapeGradientFill?.(el, { ...m, css: prev.c || toCss(m) }); return; } }
    window._applyShapeSolidFill?.(el, prev.c && !/gradient\(/.test(prev.c) ? prev.c : '#cccccc');
    return;
  }
  if (prev.g) window.applyTextGradient?.(el, { css: prev.g });
  else { const ce = _txtContent(el); if (ce) window.clearTextGradient?.(ce); }
}

/** 바꾸는 문 하나 — patch: {state?, k?, a?} · 이력 = push-before(다른 카드와 같은 규약). */
export function setFxHolo(el, patch = {}, { history = true } = {}) {
  if (!el || !el.dataset) return { ok: false };
  if (history) window.pushHistory?.('효과');
  const cur = fxHoloOf(el);
  const want = patch.state || (cur.state === 'none' ? 'on' : cur.state);
  const k = patch.k || cur.k || FX_HOLO_DEFAULT, a = patch.a !== undefined ? _clampA(patch.a) : (cur.a ?? 100);
  if (want === 'none') {
    if (cur.state === 'on') _restore(el, cur.prev);
    delete el.dataset.fxHolo;
  } else if (want === 'off') {
    if (cur.state === 'on') _restore(el, cur.prev);
    el.dataset.fxHolo = JSON.stringify({ k, a, off: 1, prev: cur.prev || {} });
  } else {
    const prev = cur.state === 'on' ? cur.prev : _snapshot(el);   // 처음 켤 때·끈 뒤 다시 켤 때 = 지금 칠이 «되돌릴 칠»
    el.dataset.fxHolo = JSON.stringify({ k, a, prev });
    _paint(el, k, a, prev);
  }
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxHoloOf(el) };
}

function _cardHtml(el, P) {
  const fx = fxHoloOf(el), open = fxIsCardOpen(el, 'holo');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxholo-card" data-fx-type="holo">
        <div class="prop-cell-card-header" id="${P}-fxholo-head">
          <button class="prop-icon-btn" id="${P}-fxholo-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">홀로그램</span>
          <button class="prop-icon-btn" id="${P}-fxholo-del" title="효과 삭제(넣기 전 칠로)" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxholo-body"${open ? '' : ' hidden'}>
          <div class="fx-holo-swatches" id="${P}-fxholo-sws">${GAZE_PRESETS.map((p) => `<button type="button" class="fx-holo-sw" data-holo="${p.key}" data-holo-type="${p.type}" aria-pressed="${p.key === fx.k}" title="홀로그램 ${p.key}${p.type === 'conic' ? ' · 원뿔형' : ''}" aria-label="홀로그램 ${p.key}" style="background:${gazeSwatchCss(p)}"></button>`).join('')}</div>
          <div class="prop-row">
            <span class="prop-label">세기</span>
            <input type="range" class="prop-slider" id="${P}-fxholo-slider" min="0" max="100" step="1" value="${fx.a}">
            <input type="number" class="prop-number" id="${P}-fxholo-num" min="0" max="100" value="${fx.a}">
          </div>
        </div>
      </div>`;
}

function _wireCard(el, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxholo-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxHolo(el, { state: 'none' }); window.pushHistory?.('효과 끔'); again(); });
  $('fxholo-eye')?.addEventListener('click', (e) => { e.stopPropagation(); setFxHolo(el, { state: fxHoloOf(el).state === 'off' ? 'on' : 'off' }); again(); });
  $('fxholo-head')?.addEventListener('click', () => { const b = $('fxholo-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(el, 'holo', open); $('fxholo-card')?.classList.toggle('expanded', open); });
  $('fxholo-sws')?.addEventListener('click', (e) => { const b = e.target.closest('[data-holo]'); if (!b) return; setFxHolo(el, { state: 'on', k: b.dataset.holo }); again(); });
  const sl = $('fxholo-slider'), n = $('fxholo-num');
  if (!sl || !n) return;
  const keep = () => (fxHoloOf(el).state === 'off' ? 'off' : 'on');
  sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
  sl.addEventListener('input', () => { const a = _clampA(sl.value); setFxHolo(el, { state: keep(), a }, { history: false }); n.value = a; });
  sl.addEventListener('change', () => { window.pushHistory?.('효과'); again(); });
  n.addEventListener('change', () => { const a = _clampA(n.value); setFxHolo(el, { state: keep(), a }); n.value = a; sl.value = a; again(); });
}

registerFxType({
  key: 'holo',
  label: '홀로그램',
  /* 도형(그림 칠 아님) · 글자(그라데이션을 쓸 수 있는 글자칸 — 곡선·말풍선 뺌, 글로우와 같은 허용 목록) */
  supports: (el) => {
    if (!el?.classList) return false;
    if (_isShape(el)) return !el.dataset?.shapeFill || fxHoloOf(el).state !== 'none';   // dataset? — classList 만 있는 대역(effects-frame-shadow ㉡)이 목록 셈 전체를 던지게 했다(Electron 전수 261122)
    if (!el.classList.contains('text-block') || el.classList.contains('liner-block') || el.classList.contains('speech-bubble-block')) return false;
    const ce = _txtContent(el); return !!ce && (window.textGradientAllowed ? window.textGradientAllowed(ce) : true);
  },
  has: (el) => fxHoloOf(el).state !== 'none',
  add: (el) => setFxHolo(el, { state: 'on' }),
  card: _cardHtml,
  wire: _wireCard,
});

if (typeof window !== 'undefined') Object.assign(window, { fxHoloOf, setFxHolo });
