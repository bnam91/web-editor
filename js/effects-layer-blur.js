/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — «Layer blur» (0.9.13 172 t13E-06 · 현빈 22:43 GO «일단 레이어 블러라고 해» · 지디 조건)
   ─────────────────────────────────────────────────────────────────────────────
   ★가림(js/effects-blur.js · data-redact)과 흐림(js/effects-decor-blur.js · data-decor-blur)을 ＋ 목록 «한 항목»으로 합쳤다.
     FigCraft 꼴: 이름 = Effect::TYPES «Layer blur»(crates/doc/src/props.rs Effect::TYPES) · 몸 = 종류 드롭다운 Uniform/Progressive
     + Blur 한 칸(panels/right/effects.rs:203-235). Progressive = 다음 물결(앱에 시작/끝 값 없음 · ~/tp-briefs/out-blur-keys.md C).
   ★저장 키 새로 0 — 카드는 옛 두 키의 «꼴»만 바꾼다(out-blur-keys.md B):
     ☑ «원본 숨김» 켬 = data-redact(세기 1..100 = px×5 · 최대 20px) — 내보낼 때 원본을 뺀다(HTML·Figma·h2c 회색 덮개 · capture-safety)
     ☐ 끔            = data-decor-blur(1..40 px) — 원본 그대로 싣고 흐리게만(HTML CSS filter · Figma LAYER_BLUR)
     둘 다 있으면 가림이 이긴다(화면·내보내기와 같은 답) ⇒ 줄 하나 · 체크 켬 · 흐림 키는 건드리지 않고 둔다(옛 바이트).
   ★체크 바꿈 = 값을 옮겨 쓴다(px 그대로) · 이력 = push-before 한 칸(⌘Z 한 번에 되돌림).
   ★눈 = 값 보존 끔(걸린 키 «전부» — 둘 다 있으면 둘 다) · × = 네 키 다 지움.
   ★옛 두 파일의 읽기·쓰기 문(fxBlurOf·setFxBlur·fxDecorBlurOf·setFxDecorBlur · window 전역 · MCP/CDP 길)은 그대로 — 명부 등록만 이 파일로 옮겼다.
   ═══════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { fxBlurOf, setFxBlur } from './effects-blur.js';
import { fxDecorBlurOf, setFxDecorBlur, FX_DECOR_BLUR_DEFAULT } from './effects-decor-blur.js';
import { redactPx, REDACT_MAX_PX, DECOR_BLUR_MAX } from './effects/image-redact.js';

const NOH = { history: false };
const pxToRedact = (px) => Math.min(100, Math.max(1, Math.round(Math.min(px, REDACT_MAX_PX) * 100 / REDACT_MAX_PX)));
const pxToDecor = (px) => Math.min(DECOR_BLUR_MAX, Math.max(1, Math.round(px)));

/** 읽기 — {state:'none'|'on'|'off', hide, px}. 가림(켬이든 끔이든)이 있으면 가림 줄이다. */
export function fxLayerBlurOf(el) {
  const r = fxBlurOf(el);
  if (r.state !== 'none') return { state: r.state, hide: true, px: redactPx(r.v) };
  const d = fxDecorBlurOf(el);
  if (d.state !== 'none') return { state: d.state, hide: false, px: d.v };
  return { state: 'none', hide: false, px: 0 };
}

/** 쓰기 문 하나 — patch: {state?, hide?, px?} · 이력 push-before 한 칸. */
export function setFxLayerBlur(el, patch = {}, { history = true } = {}) {
  if (!el || !el.dataset) return { ok: false };
  if (history) window.pushHistory?.('효과');
  const cur = fxLayerBlurOf(el);
  const hide = patch.hide ?? cur.hide;
  const px = Number(patch.px ?? (cur.px || FX_DECOR_BLUR_DEFAULT));
  const state = patch.state || (cur.state === 'none' ? 'on' : cur.state);
  if (state === 'none' || !(px > 0)) {
    setFxBlur(el, { state: 'none' }, NOH); setFxDecorBlur(el, { state: 'none' }, NOH);
  } else if (patch.state && patch.hide === undefined && patch.px === undefined && cur.state !== 'none') {
    /* 눈만 — 걸린 키 전부의 켬/끔(값 무변) */
    if (fxBlurOf(el).state !== 'none') setFxBlur(el, { state }, NOH);
    if (fxDecorBlurOf(el).state !== 'none') setFxDecorBlur(el, { state }, NOH);
  } else if (hide) {
    setFxBlur(el, { state, v: pxToRedact(px) }, NOH);
    if (cur.state !== 'none' && !cur.hide) setFxDecorBlur(el, { state: 'none' }, NOH);   // 흐림 → 가림으로 옮김
  } else {
    setFxDecorBlur(el, { state, v: pxToDecor(px) }, NOH);
    if (cur.hide) setFxBlur(el, { state: 'none' }, NOH);                                   // 가림 → 흐림으로 옮김
  }
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxLayerBlurOf(el) };
}

function _cardHtml(el, P) {
  const fx = fxLayerBlurOf(el), open = fxIsCardOpen(el, 'layerblur');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  const max = fx.hide ? REDACT_MAX_PX : DECOR_BLUR_MAX;
  const chk = window.checkHTML
    ? window.checkHTML({ id: `${P}-fxlb-hide`, label: '원본 숨김(내보낼 때 원본 빼기)', checked: fx.hide })
    : `<label><input type="checkbox" id="${P}-fxlb-hide"${fx.hide ? ' checked' : ''}> 원본 숨김(내보낼 때 원본 빼기)</label>`;
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxlb-card" data-fx-type="layerblur">
        <div class="prop-cell-card-header" id="${P}-fxlb-head">
          <button class="prop-icon-btn" id="${P}-fxlb-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">Layer blur</span>
          <button class="prop-icon-btn" id="${P}-fxlb-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxlb-body"${open ? '' : ' hidden'}>
          <div class="prop-row">
            <select class="prop-select" id="${P}-fxlb-type" style="flex:1;min-width:0;" aria-label="Blur type" title="Progressive = 다음 물결"><option value="uniform" selected>Uniform</option></select>
          </div>
          <div class="prop-row">${chk}</div>
          <div class="prop-row">
            <span class="prop-label">Blur</span>
            <input type="range" class="prop-slider" id="${P}-fxlb-slider" min="0" max="${max}" step="${fx.hide ? 0.2 : 1}" value="${fx.px}">
            <input type="number" class="prop-number" id="${P}-fxlb-num" min="0" max="${max}" step="${fx.hide ? 0.2 : 1}" value="${fx.px}">
          </div>
        </div>
      </div>`;
}

function _wireCard(el, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxlb-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxLayerBlur(el, { state: 'none' }); window.pushHistory?.('효과 끔'); again(); });
  $('fxlb-eye')?.addEventListener('click', (e) => { e.stopPropagation(); setFxLayerBlur(el, { state: fxLayerBlurOf(el).state === 'off' ? 'on' : 'off' }); again(); });
  $('fxlb-head')?.addEventListener('click', () => { const b = $('fxlb-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(el, 'layerblur', open); $('fxlb-card')?.classList.toggle('expanded', open); });
  $('fxlb-hide')?.addEventListener('change', (e) => { setFxLayerBlur(el, { hide: !!e.target.checked }); again(); });
  const sl = $('fxlb-slider'), n = $('fxlb-num');
  if (!sl || !n) return;
  const keep = () => (fxLayerBlurOf(el).state === 'off' ? 'off' : 'on');
  const hide = fxLayerBlurOf(el).hide;   // 슬라이더 끄는 동안(0 을 거침) 흐림/가림 갈래가 바뀌지 않게 카드를 그린 때 값으로 잡는다
  sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
  sl.addEventListener('input', () => { const v = Number(sl.value); if (v > 0) setFxLayerBlur(el, { state: keep(), hide, px: v }, NOH); n.value = v; });
  sl.addEventListener('change', () => { window.pushHistory?.('효과'); if (!(Number(sl.value) > 0)) { setFxLayerBlur(el, { state: 'none' }, NOH); again(); } });
  n.addEventListener('change', () => { const v = Math.min(Number(n.max), Number(n.value)); setFxLayerBlur(el, v > 0 ? { state: keep(), hide, px: v } : { state: 'none' }); n.value = v; sl.value = v; if (!(v > 0)) again(); });
}

registerFxType({
  key: 'layerblur',
  label: 'Layer blur',
  supports: (el) => !!(el && el.classList && el.classList.contains('asset-block') && el.classList.contains('has-image')),   // 옛 가림·흐림과 같은 대상(그림 든 에셋)
  has: (el) => fxLayerBlurOf(el).state !== 'none',
  add: (el) => setFxLayerBlur(el, { state: 'on', hide: false, px: FX_DECOR_BLUR_DEFAULT }),
  card: _cardHtml,
  wire: _wireCard,
});

if (typeof window !== 'undefined') Object.assign(window, { fxLayerBlurOf, setFxLayerBlur });
