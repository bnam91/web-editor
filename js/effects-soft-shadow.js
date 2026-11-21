/* ════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — 부드러운 그림자 (TEXT-FX-BEAUTIFUL-SHADOW-01 · 현빈 261121 · 0.9.14_이펙트 · 피그마 «Beautiful Shadows» 결)
   ────────────────────────────────────────────────────────────────────────
   ★«그림자»(effects-shadow.js 텍스트 갈래 = 옛 텍스트 Shadow 절 · shadow* 키)는 ★한 줄도 안 바뀐다 — 옛 저장본은 그대로 «그림자» 카드.
     이것은 따로 고르는 «부드러운 그림자»: 각도·높이·세기·색 → 여러 겹(js/fx/soft-shadow.js).
   ★그리기 = 글자칸 인라인 text-shadow «합성 문»(effects-glow.js fxComposeTextShadow) 맨 뒤 겹으로 — [글로우, 사용자 그림자, 이것].
     ⇒ 하류(글자 그라데이션 syncTextGradShadow · Figma textShadowSource · CDP PNG · HTML)는 computed text-shadow 를 읽어 저절로 따라온다.
   ★정본 = .text-block dataset `fxSoft`('on'|'off' · 없음 = 효과 없음) · `fxSoftAngle`·`fxSoftHeight`·`fxSoftStrength`·`fxSoftColor`.
     ✕ = 키 전부 지움(켜기 전 바이트) · 눈 끔 = 값 보존(U8). 대상 = 글로우와 같음(텍스트 · 곡선·말풍선 제외).
   ════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { normSoft, softShadowCss, SOFT_RANGES, SOFT_DEFAULTS } from './fx/soft-shadow.js';

export const FX_SOFT_KEYS = ['fxSoft', 'fxSoftAngle', 'fxSoftHeight', 'fxSoftStrength', 'fxSoftColor'];
const _contentOf = (tb) => tb?.querySelector?.('[contenteditable]') || tb?.querySelector?.('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text') || null;

export function fxSoftOf(tb) {
  const ds = (tb && tb.dataset) || {};
  const state = ds.fxSoft === 'on' ? 'on' : (ds.fxSoft === 'off' ? 'off' : 'none');
  return { state, ...normSoft({ angle: ds.fxSoftAngle, height: ds.fxSoftHeight, strength: ds.fxSoftStrength, color: ds.fxSoftColor }) };
}
/** 합성 문이 부르는 겹 글(켜진 때만 · 아니면 '') — window 다리(effects-glow.js fxComposedTextShadowCss). */
export function fxSoftShadowLayers(tb) { const fx = fxSoftOf(tb); return fx.state === 'on' ? softShadowCss(fx) : ''; }

function _render(tb) {
  const ce = _contentOf(tb); if (!ce) return;
  window.fxComposeTextShadow?.(ce);
  if (ce.getAttribute('style') === '') ce.removeAttribute('style');   // ✕ 뒤 켜기 전 바이트
  window.syncTextGradShadow?.(ce);
}
export function setFxSoft(tb, patch = {}, { history = true } = {}) {
  if (!tb || !tb.dataset) return { ok: false };
  if (history) window.pushHistory?.('효과');
  const ds = tb.dataset;
  if (patch.state === 'none') FX_SOFT_KEYS.forEach((k) => { delete ds[k]; });
  else {
    if (patch.state === 'on' || patch.state === 'off') ds.fxSoft = patch.state; else if (!ds.fxSoft) ds.fxSoft = 'on';
    const n = normSoft({ ...fxSoftOf(tb), ...patch });
    ds.fxSoftAngle = String(n.angle); ds.fxSoftHeight = String(n.height); ds.fxSoftStrength = String(n.strength); ds.fxSoftColor = n.color;
  }
  _render(tb); window.scheduleAutoSave?.();
  return { ok: true, applied: fxSoftOf(tb) };
}
export function watchAllFxSoft(root = document) {
  const els = root?.querySelectorAll ? root.querySelectorAll('.text-block[data-fx-soft="on"]') : [];
  els.forEach(_render); return els.length;
}

function _cardHtml(tb, P) {
  const fx = fxSoftOf(tb), open = fxIsCardOpen(tb, 'soft');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  const slider = (lbl, key) => { const [lo, hi] = SOFT_RANGES[key]; return `
          <div class="prop-row">
            <span class="prop-label">${lbl}</span>
            <input type="range" class="prop-slider" id="${P}-fxsf-${key}-slider" min="${lo}" max="${hi}" step="1" value="${fx[key]}">
            <input type="number" class="prop-number" id="${P}-fxsf-${key}-num" min="${lo}" max="${hi}" value="${fx[key]}">
          </div>`; };
  const hex = window.formatHex6 ? window.formatHex6(fx.color) : fx.color.slice(1).toUpperCase();
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxsf-card" data-fx-type="soft">
        <div class="prop-cell-card-header" id="${P}-fxsf-head">
          <button class="prop-icon-btn" id="${P}-fxsf-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">부드러운 그림자</span>
          <button class="prop-icon-btn" id="${P}-fxsf-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxsf-body"${open ? '' : ' hidden'}>${slider('각도', 'angle')}${slider('높이', 'height')}${slider('세기', 'strength')}
          <div class="prop-color-row">
            <span class="prop-label">색상</span>
            <div class="prop-color-field">
              <div class="prop-color-swatch" style="background:${fx.color}"><input type="color" id="${P}-fxsf-color" value="${fx.color}"></div>
              <input type="text" class="prop-color-hex" id="${P}-fxsf-color-hex" value="${hex}" maxlength="7" aria-label="부드러운 그림자 색">
            </div>
          </div>
        </div>
      </div>`;
}
function _wireCard(tb, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxsf-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxSoft(tb, { state: 'none' }); window.pushHistory?.('효과 끔'); again(); });
  $('fxsf-eye')?.addEventListener('click', (e) => { e.stopPropagation(); setFxSoft(tb, { state: fxSoftOf(tb).state === 'off' ? 'on' : 'off' }); again(); });
  $('fxsf-head')?.addEventListener('click', () => { const b = $('fxsf-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(tb, 'soft', open); $('fxsf-card')?.classList.toggle('expanded', open); });
  for (const key of ['angle', 'height', 'strength']) {
    const sl = $(`fxsf-${key}-slider`), n = $(`fxsf-${key}-num`);
    if (!sl || !n) continue;
    sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
    sl.addEventListener('change', () => window.pushHistory?.('효과'));   /* 끝 표본 — 글로우 카드와 같은 규약 */
    sl.addEventListener('input', () => { setFxSoft(tb, { [key]: sl.value }, { history: false }); n.value = fxSoftOf(tb)[key]; });
    n.addEventListener('change', () => { setFxSoft(tb, { [key]: n.value }); const v = fxSoftOf(tb)[key]; n.value = v; sl.value = v; });
  }
  const col = $('fxsf-color'), hx = $('fxsf-color-hex');
  col?.addEventListener('input', () => setFxSoft(tb, { color: col.value }, { history: false }));
  col?.addEventListener('change', () => { window.pushHistory?.('효과'); again(); });
  hx?.addEventListener('change', () => { setFxSoft(tb, { color: hx.value.startsWith('#') ? hx.value : '#' + hx.value }); again(); });
}

registerFxType({
  key: 'soft',
  label: '부드러운 그림자',
  supports: (el) => !!(el && el.classList && el.classList.contains('text-block') && !el.classList.contains('liner-block') && !el.classList.contains('speech-bubble-block') && _contentOf(el)),
  has: (el) => fxSoftOf(el).state !== 'none',
  add: (el) => setFxSoft(el, { state: 'on', ...SOFT_DEFAULTS }),
  card: _cardHtml,
  wire: _wireCard,
  watchAll: watchAllFxSoft,
});

if (typeof window !== 'undefined') Object.assign(window, { fxSoftOf, fxSoftShadowLayers, setFxSoft, watchAllFxSoft, FX_SOFT_KEYS });
