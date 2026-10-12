/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — 글로우 (2026-10-12 · 1012t1E3 · 현빈 원문:
     「글로우 효과는 이스트에그로도 있지만 >> 우측 패널 '이펙트'에 반사와 함께 글로우 이펙트에 넣어줘」)
   ─────────────────────────────────────────────────────────────────────────────
   ★이 파일이 하는 일 = js/effects-registry.js 에 «식구 하나»를 등록하는 것 + 텍스트 text-shadow «합성 문» 하나.
     ⇒ 패널 파일(prop-text-template · prop-text)은 ★한 줄도 안 바뀐다(명부 합격 기준 「등록만 하면 뜬다」).
   ★대상 = ★텍스트 블럭만(곡선 liner·말풍선 제외). 도형·에셋은 이번 범위 밖(그쪽 filter 는 그림자 식구가 쓴다).
   ★기법 = 글자칸(contentEl · .tb-h1 등)의 ★인라인 text-shadow — ★사용자 「Shadow」 절과 «합성»한다:
       text-shadow = [글로우 3겹, 사용자 그림자].filter(Boolean).join(', ')
     ⛔filter/drop-shadow 로 바꾸지 마라 — 글자 그라데이션(.tgs)이 contentEl 의 filter 를 이미 쓰고,
       h2c 썸네일에서 drop-shadow 가 죽는다(js/fx/glow-render.js 머리말 실측).
     ★하류 셋(그라데이션 syncTextGradShadow · Figma textShadowSource · CDP PNG)은 전부 computed text-shadow 를
       읽는다 ⇒ 추가 배선 0 으로 따라온다. 인라인이라 저장본에 그대로 남는다(반사와 같은 결).
   ★합성 문 «하나» — `fxComposeTextShadow(contentEl, userCss?)` (window 다리).
     텍스트 「Shadow」 절(js/props/prop-text-wireup-shadow.js `_apply`)도 이 문으로 쓴다 — ⛔둘이 따로 대입하면
       나중에 쓴 쪽이 다른 쪽을 지운다(Shadow 켜자 글로우가 사라지는 병 · 시험 G3).
     ★글로우가 없으면 산출 = 사용자 그림자 css «그대로»(옛 동작 바이트 동일 · 시험 G7).
     ★선택 영역 글로우(E2)도 이 문을 쓴다 — span 에 text-shadow 를 걸 때 «상위 목록»을 잃지 않게
       `fxComposedTextShadowCss(contentEl, userCss?)` (쓰지 않고 문자열만) 를 같이 낸다.
   ★겹 처방 = 이스트에그 네온(css .text-effect.tfx-neon 6/14/28px)의 ★«같은 색 3겹 반경 비»만 빌린다:
       0 0 B·0.21 c, 0 0 B·0.5 c, 0 0 B c   (흰 심·색수차·글자색 바꾸기는 안 빌린다 — 이스트에그 몫)
   ★정본 = .text-block 의 dataset 넷 `fxGlow`('on'|'off' · 없음 = 효과 없음) · `fxGlowBlur` · `fxGlowOp` · `fxGlowColor`.
     ⛔이스트에그 `dataset.textEffect`(JSON)를 재사용하지 않는다 — ✕ = «키 전부 지움» 규약(U8)을 못 지킨다.
     'off' = 눈을 끈 상태(값 보존 · 그리지 않음) · ✕ = 키 «전부» 지움 → 켜기 전 바이트(시험 G4).
   ★값 — 라벨·범위는 이웃 카드 그대로: Blur 0~40(그림자 식구·텍스트 Shadow 절) · 불투명도 0~100(반사·그림자).
     기본 Blur 20(≈ 네온 기본 intensity 0.7 × 28px) · 불투명도 100 · 색 #ff00ff(이스트에그 TEXT_EFFECT_DEFAULTS.glowColor).
   ═══════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';
import { textUserShadowCss } from './props/prop-text-wireup-shadow.js';

export const FX_GLOW_KEYS = ['fxGlow', 'fxGlowBlur', 'fxGlowOp', 'fxGlowColor'];
export const FX_GLOW_DEFAULTS = { blur: 20, op: 100, color: '#ff00ff' };
export const FX_GLOW_RANGES = { blur: [0, 40], op: [0, 100] };
/* 네온 겹 반경 비(6:14:28 → 0.21:0.5:1) — 손으로 고른 수가 아니다(css/editor-blocks.css .tfx-neon). */
export const FX_GLOW_LAYER_RATIOS = [0.21, 0.5, 1];
/** ★「반사에 글로우가 비치나」 — 실측 기록(코드가 안 읽는다 · tests/dom/effects-glow.dom.spec.js G8 이 읽어 잠근다).
 *  ★결론: ★비친다(2026-10-12 실측 · 헤드리스 크로미움 · 반사 gap0/len100/op100 · 글로우 blur20 초록):
 *    글자 옆 변화 438(양성) · 반사 없이 거울 자리 변화 0(음성 — 글로우 자체는 거기 안 닿는다) · 반사 띠 변화 218.
 *  ⇒ text-shadow 는 글자칸이 «그리는 그림»이라 box-reflect 가 같이 비춘다(그림자 식구의 filter 는 안 비친다 — 반대). */
export const GLOW_SHOWS_IN_REFLECTION = true;

const _int = (raw, [lo, hi], d) => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (typeof raw === 'number' ? raw : NaN);
  if (!Number.isFinite(n)) return d;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};
const _hex6 = (h) => {
  let s = String(h ?? '').trim();
  if (s && s[0] !== '#') s = '#' + s;
  if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : FX_GLOW_DEFAULTS.color;
};
const _rgba = ({ color, op }) => {
  const h = _hex6(color).slice(1);
  const a = Math.max(0, Math.min(1, op / 100));
  if (a >= 1) return '#' + h;
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

/** 텍스트 블럭의 글자칸 — prop-text.js showTextProperties 와 같은 순서(contenteditable 먼저, 없으면 tb-* 칸). */
function _contentOf(tb) {
  if (!tb || !tb.querySelector) return null;
  return tb.querySelector('[contenteditable]')
    || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text');
}

/** 효과 읽기 — {state:'none'|'on'|'off', blur, op, color}. ★패널·그리개·시험이 «같은 이 함수»를 본다. */
export function fxGlowOf(tb) {
  const ds = (tb && tb.dataset) || {};
  const state = ds.fxGlow === 'on' ? 'on' : (ds.fxGlow === 'off' ? 'off' : 'none');
  const D = FX_GLOW_DEFAULTS, R = FX_GLOW_RANGES;
  return { state, blur: _int(ds.fxGlowBlur, R.blur, D.blur), op: _int(ds.fxGlowOp, R.op, D.op), color: _hex6(ds.fxGlowColor || D.color) };
}

/** 글로우 겹 css(켜진 때만 · 아니면 '') — 순수 함수. */
export function fxGlowLayers(tb) {
  const fx = fxGlowOf(tb);
  if (fx.state !== 'on') return '';
  const c = _rgba(fx);
  return FX_GLOW_LAYER_RATIOS.map(k => `0 0 ${Math.round(fx.blur * k * 10) / 10}px ${c}`).join(', ');
}

/** ★합성 결과 문자열(쓰지 않는다) — [글로우 겹, 사용자 그림자]. userCss 를 안 주면 글자칸 dataset 에서 읽는다. */
export function fxComposedTextShadowCss(contentEl, userCss) {
  if (!contentEl) return '';
  const tb = contentEl.closest ? contentEl.closest('.text-block') : null;
  const u = userCss === undefined ? textUserShadowCss(contentEl) : (userCss || '');
  return [tb ? fxGlowLayers(tb) : '', u].filter(Boolean).join(', ');
}

/** ★합성 문 «하나» — 글자칸 인라인 text-shadow 를 합성 결과로 쓴다. 텍스트 「Shadow」 절도 이리로 온다.
 *  ★글로우가 없으면 `el.style.textShadow = userCss` 와 «같은 일»만 한다(옛 동작 바이트 동일 · G7). */
export function fxComposeTextShadow(contentEl, userCss) {
  if (!contentEl || !contentEl.style) return '';
  const css = fxComposedTextShadowCss(contentEl, userCss);
  contentEl.style.textShadow = css;
  return css;
}

/** 우리가 걷어서 style 이 «빈 속성»만 남으면 속성째 지운다 — ✕ 뒤 outerHTML 이 켜기 전과 바이트 같게. */
function _dropEmptyStyle(el) { if (el && el.getAttribute && el.getAttribute('style') === '') el.removeAttribute('style'); }

function _render(tb) {
  const ce = _contentOf(tb);
  if (!ce) return;
  fxComposeTextShadow(ce);
  if (fxGlowOf(tb).state !== 'on') _dropEmptyStyle(ce);
  /* 글자 그라데이션이면 text-shadow 목록을 글자 «뒤»(SVG 필터)로 — Shadow 절 _apply 와 같은 자리 */
  window.syncTextGradShadow?.(ce);
}

/** 데이터 → 화면. ★키 없음 = 아무것도 안 만진다(옛 문서 바이트 동일). */
export function applyFxGlow(tb) {
  if (!tb || !tb.dataset) return;
  if (fxGlowOf(tb).state === 'none') return;
  _render(tb);
}

/** 바꾸는 문 «하나» — 패널·시험이 이리로. patch: {state?:'on'|'off'|'none', blur?, op?, color?} · state 'none' = 키 전부 지움(✕).
 *  ★이력: 부르기 «전»에 pushHistory(push-before · 반사·그림자와 같은 규약) — 한 제스처 한 걸음. */
export function setFxGlow(tb, patch = {}, { history = true } = {}) {
  if (!tb || !tb.dataset) return { ok: false, code: 'NOT_FOUND' };
  if (history) window.pushHistory?.('효과');
  const ds = tb.dataset;
  if (patch.state === 'none') { FX_GLOW_KEYS.forEach(k => { delete ds[k]; }); }
  else {
    if (patch.state === 'on' || patch.state === 'off') ds.fxGlow = patch.state;
    else if (!ds.fxGlow) ds.fxGlow = 'on';
    const R = FX_GLOW_RANGES, D = FX_GLOW_DEFAULTS;
    if (patch.blur !== undefined) ds.fxGlowBlur = String(_int(patch.blur, R.blur, D.blur));
    if (patch.op !== undefined) ds.fxGlowOp = String(_int(patch.op, R.op, D.op));
    if (patch.color !== undefined) ds.fxGlowColor = _hex6(patch.color);
  }
  _render(tb);               /* ★none 이어도 그린다 — ✕ 는 «걷어내는» 그림이다 */
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxGlowOf(tb) };
}

/** 문서를 연 뒤·붙여넣은 뒤 — 켜진 블럭을 «다시 합성»(멱등). 돌려주는 수 = 걸린 블럭 수. */
export function watchAllFxGlow(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  const els = root.querySelectorAll('.text-block[data-fx-glow="on"]');
  els.forEach(applyFxGlow);
  return els.length;
}

/* ═══ 카드 — 반사·그림자 카드와 ★같은 꼴(.prop-cell-card · 눈 · ✕ · 접기 · slider 행 → 색 행) ═══ */
function _glowCardHtml(tb, P) {
  const fx = fxGlowOf(tb);
  const open = fxIsCardOpen(tb, 'glow');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  const R = FX_GLOW_RANGES;
  const hex = (window.formatHex6 ? window.formatHex6(fx.color) : fx.color.replace('#', '').toUpperCase());
  const slider = (lbl, key, val, [lo, hi]) => `
          <div class="prop-row">
            <span class="prop-label">${lbl}</span>
            <input type="range" class="prop-slider" id="${P}-fxgl-${key}-slider" min="${lo}" max="${hi}" step="1" value="${val}">
            <input type="number" class="prop-number" id="${P}-fxgl-${key}-num" min="${lo}" max="${hi}" value="${val}">
          </div>`;
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxgl-card" data-fx-type="glow">
        <div class="prop-cell-card-header" id="${P}-fxgl-head">
          <button class="prop-icon-btn" id="${P}-fxgl-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">글로우</span>
          <button class="prop-icon-btn" id="${P}-fxgl-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxgl-body"${open ? '' : ' hidden'}>${slider('Blur', 'blur', fx.blur, R.blur)}${slider('불투명도', 'op', fx.op, R.op)}
          <div class="prop-color-row">
            <span class="prop-label">색상</span>
            <div class="prop-color-field">
              <div class="prop-color-swatch" style="background:${fx.color}">
                <input type="color" id="${P}-fxgl-color" value="${fx.color}">
              </div>
              <input type="text" class="prop-color-hex" id="${P}-fxgl-color-hex" value="${hex}" maxlength="7" aria-label="Glow color">
            </div>
          </div>
        </div>
      </div>`;
}

function _wireGlowCard(tb, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxgl-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxGlow(tb, { state: 'none' }); again(); });
  $('fxgl-eye')?.addEventListener('click', (e) => { e.stopPropagation(); const cur = fxGlowOf(tb).state; setFxGlow(tb, { state: cur === 'off' ? 'on' : 'off' }); again(); });
  $('fxgl-head')?.addEventListener('click', () => { const b = $('fxgl-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(tb, 'glow', open); $('fxgl-card')?.classList.toggle('expanded', open); });
  for (const key of ['blur', 'op']) {
    const sl = $(`fxgl-${key}-slider`), n = $(`fxgl-${key}-num`);
    if (!sl || !n) continue;
    sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
    sl.addEventListener('input', () => { setFxGlow(tb, { [key]: sl.value }, { history: false }); n.value = fxGlowOf(tb)[key]; });
    n.addEventListener('change', () => { setFxGlow(tb, { [key]: n.value }); const v = fxGlowOf(tb)[key]; n.value = v; sl.value = v; });
  }
  const col = $('fxgl-color'), hex = $('fxgl-color-hex');
  col?.addEventListener('input', () => { setFxGlow(tb, { color: col.value }); });
  col?.addEventListener('change', () => { again(); });
  hex?.addEventListener('change', () => { setFxGlow(tb, { color: hex.value }); again(); });
}

/* ═══ 명부 식구 — 글로우 ═══════════════════════════════════════════════════
   ★이 한 벌이 전부다 — 목록·＋·접힘·배선은 명부가 한다(패널 파일 0줄 변경). */
registerFxType({
  key: 'glow',
  label: '글로우',
  /* ★텍스트만 — ⛔허용 목록으로 적는다(막는 목록은 블럭이 늘면 샌다). 곡선(liner)·말풍선은 글자칸 구조가 달라 뺀다. */
  supports: (el) => !!(el && el.classList && el.classList.contains('text-block')
    && !el.classList.contains('liner-block') && !el.classList.contains('speech-bubble-block') && _contentOf(el)),
  has:  (el) => fxGlowOf(el).state !== 'none',
  add:  (el) => setFxGlow(el, { state: 'on' }),
  card: _glowCardHtml,
  wire: _wireGlowCard,
  watchAll: watchAllFxGlow,
});

if (typeof window !== 'undefined') {
  Object.assign(window, {
    fxGlowOf, fxGlowLayers, applyFxGlow, setFxGlow, watchAllFxGlow,
    fxComposeTextShadow, fxComposedTextShadowCss,
    FX_GLOW_KEYS, FX_GLOW_DEFAULTS, FX_GLOW_RANGES, FX_GLOW_LAYER_RATIOS,
  });
}
