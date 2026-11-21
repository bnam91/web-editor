/* ════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — 흐림(꾸밈 블러) (IMG-FX-BLUR-01 · 현빈 261121 결정 ⓑ · 발주2 #2)
   ────────────────────────────────────────────────────────────────────────
   ★«가림»(js/effects-blur.js · data-redact · 원본을 안 내보냄)과 «다른» 효과다 — 꾸밈용: 원본을 그대로 싣고 흐리게 «보이게»만.
     드롭다운 이름도 갈랐다: 가림 = «가림» · 이것 = «흐림». 옛 저장본의 블러(data-redact)는 계속 가림.
   ★상태 = 에셋 블럭 data-decor-blur(1..40 px 정수) · 끈 동안 = data-decor-blur-off(값 보존) — 블러 카드와 같은 눈 규약.
   ★그림 = 합성 한 자리 js/effects/image-redact.js writeImgFilter(색보정 + 가림 + 흐림 · 가림이 켜지면 가림만) · 가장자리 = css/editor-layout.css 3σ 키우기.
   ★내보내기: PNG = 화면 그대로 · HTML = 인라인 CSS filter 그대로 · Figma = 원본 src + LAYER_BLUR(js/io/export-figma-json.js · figma-renderer).
   ════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { recomposeHost, normalizeDecorBlur, DECOR_BLUR_MAX } from './effects/image-redact.js';

export const FX_DECOR_BLUR_DEFAULT = 8;   // 가림 기본(강도 40 ⇒ 8px)과 같은 눈높이

export function fxDecorBlurOf(el) {
  const on = normalizeDecorBlur(el?.dataset?.decorBlur);
  if (on > 0) return { state: 'on', v: on };
  const off = normalizeDecorBlur(el?.dataset?.decorBlurOff);
  if (off > 0) return { state: 'off', v: off };
  return { state: 'none', v: 0 };
}

/** 바꾸는 문 하나 — patch: {state?, v?} · 이력 = push-before(블러 카드와 같은 규약). */
export function setFxDecorBlur(el, patch = {}, { history = true } = {}) {
  if (!el || !el.dataset) return { ok: false };
  if (history) window.pushHistory?.('효과');
  const cur = fxDecorBlurOf(el);
  const v = patch.v !== undefined ? normalizeDecorBlur(patch.v) : (cur.v || FX_DECOR_BLUR_DEFAULT);
  const state = patch.state || (cur.state === 'none' ? 'on' : cur.state);
  delete el.dataset.decorBlur; delete el.dataset.decorBlurOff;
  if (state === 'on' && v > 0) el.dataset.decorBlur = String(v);
  else if (state === 'off' && v > 0) el.dataset.decorBlurOff = String(v);
  recomposeHost(el);
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxDecorBlurOf(el) };
}

function _cardHtml(el, P) {
  const fx = fxDecorBlurOf(el), open = fxIsCardOpen(el, 'decorblur');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxdb-card" data-fx-type="decorblur">
        <div class="prop-cell-card-header" id="${P}-fxdb-head">
          <button class="prop-icon-btn" id="${P}-fxdb-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">흐림</span>
          <button class="prop-icon-btn" id="${P}-fxdb-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxdb-body"${open ? '' : ' hidden'}>
          <div class="prop-row">
            <span class="prop-label">Blur</span>
            <input type="range" class="prop-slider" id="${P}-fxdb-slider" min="0" max="${DECOR_BLUR_MAX}" step="1" value="${fx.v}">
            <input type="number" class="prop-number" id="${P}-fxdb-num" min="0" max="${DECOR_BLUR_MAX}" value="${fx.v}">
          </div>
        </div>
      </div>`;
}

function _wireCard(el, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxdb-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxDecorBlur(el, { state: 'none' }); window.pushHistory?.('효과 끔'); again(); });
  $('fxdb-eye')?.addEventListener('click', (e) => { e.stopPropagation(); const cur = fxDecorBlurOf(el).state; setFxDecorBlur(el, { state: cur === 'off' ? 'on' : 'off' }); again(); });
  $('fxdb-head')?.addEventListener('click', () => { const b = $('fxdb-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(el, 'decorblur', open); $('fxdb-card')?.classList.toggle('expanded', open); });
  const sl = $('fxdb-slider'), n = $('fxdb-num');
  if (!sl || !n) return;
  const keep = () => (fxDecorBlurOf(el).state === 'off' ? 'off' : 'on');
  sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
  sl.addEventListener('change', () => { window.pushHistory?.('효과'); if (normalizeDecorBlur(sl.value) <= 0) { setFxDecorBlur(el, { state: 'none' }, { history: false }); again(); } });
  sl.addEventListener('input', () => { const v = normalizeDecorBlur(sl.value); if (v > 0) setFxDecorBlur(el, { state: keep(), v }, { history: false }); n.value = v; });
  n.addEventListener('change', () => { const v = normalizeDecorBlur(n.value); setFxDecorBlur(el, v > 0 ? { state: keep(), v } : { state: 'none' }); n.value = v; sl.value = v; if (v <= 0) again(); });
}

registerFxType({
  key: 'decorblur',
  label: '흐림',
  supports: (el) => !!(el && el.classList && el.classList.contains('asset-block') && el.classList.contains('has-image')),   // 가림과 같은 대상(그림 든 에셋)
  has: (el) => fxDecorBlurOf(el).state !== 'none',
  add: (el) => setFxDecorBlur(el, { state: 'on', v: FX_DECOR_BLUR_DEFAULT }),
  card: _cardHtml,
  wire: _wireCard,
});

if (typeof window !== 'undefined') Object.assign(window, { fxDecorBlurOf, setFxDecorBlur, FX_DECOR_BLUR_DEFAULT });
