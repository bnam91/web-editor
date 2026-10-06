/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS 식구② — 그림자 (2026-10-06 · 현빈 「쉐도우도 넣어주고」 · 지디 승인)
   ─────────────────────────────────────────────────────────────────────────────
   ★이 파일이 하는 일 = js/effects-registry.js 에 «식구 하나»를 등록하는 것. 그게 전부다.
     ⇒ 패널 세 곳·index.html 의 절 그리개는 ★한 줄도 안 바뀐다(「계속 추가예정」의 값).
   ★기법 = `filter: drop-shadow(x y blur color)` — 블럭 «자기» 인라인 속성 하나(반사와 같은 결).
     ⛔box-shadow 로 바꾸지 마라 — 도형은 svg 실루엣이고 에셋은 투명 png 가 올 수 있어
       «상자»에 그림자를 치면 모양이 틀린다(선례: js/blocks/modal-block.js:96 주석 — 줌은 clip-path 라
       box-shadow 를 못 써 drop-shadow 로 갔다).
     ★인라인이라 저장본에 그대로 남는다 ⇒ 문서를 열 때 다시 그릴 일이 없다(반사와 같다).
   ★대상 = ★도형·에셋만. ⛔텍스트에는 «안» 올린다 —
     텍스트는 「Shadow」 절이 Effects 절 «바로 위»에 이미 있다(js/props/prop-text-template.js:131).
     거기 또 카드를 만들면 같은 것이 두 벌이 된다(이 레포의 고질). 그리고 텍스트는 style.filter 를
     글자 그라데이션이 이미 쓴다(js/props/text-block-color.js:268,371) — 우리가 덮으면 그걸 끈다.
     ⇒ 명부의 `supports(el)` 가 그 가름을 «한 자리»에서 한다.
   ★값 — ⛔내가 지어내지 않았다. 텍스트 「Shadow」 절의 정본을 그대로 빌렸다:
     기본값 = js/props/prop-text-wireup-shadow.js `SHADOW_DEFAULTS`(x 2 · y 2 · blur 4 · #000000 · 50%)
     범위   = 그 절의 슬라이더 그대로(x·y −20~20 · blur 0~40 · 불투명도 0~100)
     라벨   = 그 절과 같은 말(X · Y · Blur · 색상) — 새 사용자 문장 0.
   ★정본 = dataset 키 여섯 `fxShadow`('on'|'off' · 없음 = 효과 없음) ·
     `fxShadowX` · `fxShadowY` · `fxShadowBlur` · `fxShadowColor` · `fxShadowOp`.
     키가 하나도 없고 흔적도 없으면 «아무것도 안 만진다» ⇒ 옛 문서 바이트 동일.
     'off' = 눈을 끈 상태(값 보존 · 그리지 않음) · ✕ = 키 «전부» 지움. (반사와 같은 규약 U8)
   ★여백 — 그림자는 ⛔자리를 «안» 먹는다(반사와 다르다). 아래 블럭을 밀지 않는다 —
     그림자가 이웃 위로 번지는 것이 정상이다(선례: js/blocks/mockup-block.js:109 가 그냥 번지게 둔다).
     ⇒ HOST_MARGIN_Y_KEYS 에 ★키를 더하지 않는다.
   ═══════════════════════════════════════════════════════════════════════════ */
import { registerFxType, fxIsCardOpen, fxSetCardOpen } from './effects-registry.js';

export const FX_SHADOW_KEYS = ['fxShadow', 'fxShadowX', 'fxShadowY', 'fxShadowBlur', 'fxShadowColor', 'fxShadowOp'];
/* ★텍스트 「Shadow」 절(prop-text-wireup-shadow.js SHADOW_DEFAULTS)에서 빌린 값 — 손으로 고른 수가 아니다. */
export const FX_SHADOW_DEFAULTS = { x: 2, y: 2, blur: 4, color: '#000000', op: 50 };
export const FX_SHADOW_RANGES = { x: [-20, 20], y: [-20, 20], blur: [0, 40], op: [0, 100] };

/** ★★「반사에 그림자가 비치나」 — ★결론: ★안 비친다(실측). ★이 줄이 참값이다.
 *  ★역사 — 지디 1차 판정(2026-10-06)은 「비치는 것이 맞다 · 진짜 거울이 그렇다」였다. 같은 판정이 건 조건
 *    ㉠(「★먼저 재라 · ★이상하면 멈추고 알려라」)대로 재 보니 반대였고, 멈추고 알렸다.
 *    ⇒ ★지디가 그 자리에서 ★자기 판정을 ★철회했다(2026-10-06 · 「내 『자연스러움』은 내 머릿속 모형이었고
 *      브라우저는 다르게 한다」). ⛔그러니 이 파일은 ★「지디 판정과 어긋난 상태」가 ★아니다 — ★합의된 사실이다.
 *  ★실측(2026-10-06 · 크로미움 · 도형 100×100 · 반사 gap0/len100/op100 · 그림자 x=30 y=0 blur=0 검정 100%):
 *      블럭 «옆»(y −60~−10, x +100~+110) = 진한 그림자 ✔
 *      반사 띠(y 0~+80, 같은 x)          = ★흰색 그대로(반사 자체는 그 띠에 또렷이 보인다 — 양성대조 됨)
 *    ⇒ 크로미움은 `-webkit-box-reflect` 에 `filter: drop-shadow()` 를 ★안 비춘다.
 *  ★지금 값 = 실측된 사실. ⛔「끄는 길」은 필요 없어졌다(이미 안 비친다) — 열어야 할 때 드는 길을 적어 둔다:
 *    비추게 하려면 그림자를 filter 가 아니라 «반사가 비추는 것»(블럭이 그리는 그림 자체)으로 만들어야 한다
 *    — 도형은 svg 안 feDropShadow, 에셋은 블럭 안 한 겹.
 *    ★★그건 ★«별건»으로 뗐다(지디 2026-10-06) — ⛔이 레인에서 하지 마라. 현빈께는 ★사실만 전한다.
 *  지키는 그물: tests/dom/effects-registry.dom.spec.js A7(양성·음성대조 포함 — 이 사실이 바뀌면 빨강). */
export const SHADOW_SHOWS_IN_REFLECTION = false;   /* ★«스위치»가 아니라 ★실측 기록이다(코드가 안 읽는다 · A7 이 읽어 잠근다) */

const _int = (raw, [lo, hi], d) => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (typeof raw === 'number' ? raw : NaN);
  if (!Number.isFinite(n)) return d;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};
const _hex6 = (h) => {
  let s = String(h ?? '').trim();
  if (s && s[0] !== '#') s = '#' + s;
  if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : FX_SHADOW_DEFAULTS.color;
};

/** 효과 읽기 — {state:'none'|'on'|'off', x, y, blur, color, op}. ★패널·그리개·시험이 «같은 이 함수»를 본다. */
export function fxShadowOf(el) {
  const ds = (el && el.dataset) || {};
  const state = ds.fxShadow === 'on' ? 'on' : (ds.fxShadow === 'off' ? 'off' : 'none');
  const D = FX_SHADOW_DEFAULTS, R = FX_SHADOW_RANGES;
  return { state, x: _int(ds.fxShadowX, R.x, D.x), y: _int(ds.fxShadowY, R.y, D.y),
    blur: _int(ds.fxShadowBlur, R.blur, D.blur), color: _hex6(ds.fxShadowColor || D.color), op: _int(ds.fxShadowOp, R.op, D.op) };
}

/** 그림자를 «거는 상자» — ★블럭 자신. 반사와 «같은 자리»지만 서로 다른 속성을 쓴다(filter ↔ -webkit-box-reflect).
 *  ⛔래퍼로 옮기지 마라 — 도형 래퍼(frame-block)는 높이가 고정이라 그림자가 실루엣이 아니라 «상자» 모양이 된다. */
function _target(el) { return el; }

const _rgba = ({ color, op }) => {
  const h = _hex6(color).slice(1);
  const a = Math.max(0, Math.min(1, op / 100));
  if (a >= 1) return '#' + h;
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};
const _css = (fx) => `drop-shadow(${fx.x}px ${fx.y}px ${fx.blur}px ${_rgba(fx)})`;

/** 우리가 걷어서 style 이 «빈 속성»만 남으면 속성째 지운다 — ✕ 뒤 outerHTML 이 켜기 전과 바이트 같게. */
function _dropEmptyStyle(el) { if (el && el.getAttribute && el.getAttribute('style') === '') el.removeAttribute('style'); }

/** 데이터 → 화면. ★키 없음·흔적 없음 = 아무것도 안 만진다(옛 문서 바이트 동일). */
export function applyFxShadow(el) {
  if (!el || !el.style) return;
  const fx = fxShadowOf(el);
  const t = _target(el);
  const trace = !!(t.style && t.style.filter);
  if (fx.state === 'none' && !trace) return;
  if (fx.state === 'on') t.style.filter = _css(fx);
  else { t.style.removeProperty('filter'); _dropEmptyStyle(t); }
}

/** 바꾸는 문 «하나» — 패널·시험이 이리로. patch: {state?:'on'|'off'|'none', x?, y?, blur?, color?, op?}
 *  ★이력: 부르기 «전»에 pushHistory(push-before · 반사와 같은 규약) — 한 제스처 한 걸음. */
export function setFxShadow(el, patch = {}, { history = true } = {}) {
  if (!el || !el.dataset) return { ok: false, code: 'NOT_FOUND' };
  if (history) window.pushHistory?.('효과');
  const ds = el.dataset;
  if (patch.state === 'none') { FX_SHADOW_KEYS.forEach(k => { delete ds[k]; }); }
  else {
    if (patch.state === 'on' || patch.state === 'off') ds.fxShadow = patch.state;
    else if (!ds.fxShadow) ds.fxShadow = 'on';
    const R = FX_SHADOW_RANGES, D = FX_SHADOW_DEFAULTS;
    if (patch.x !== undefined) ds.fxShadowX = String(_int(patch.x, R.x, D.x));
    if (patch.y !== undefined) ds.fxShadowY = String(_int(patch.y, R.y, D.y));
    if (patch.blur !== undefined) ds.fxShadowBlur = String(_int(patch.blur, R.blur, D.blur));
    if (patch.op !== undefined) ds.fxShadowOp = String(_int(patch.op, R.op, D.op));
    if (patch.color !== undefined) ds.fxShadowColor = _hex6(patch.color);
  }
  applyFxShadow(el);
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxShadowOf(el) };
}

/* ═══ 카드 — 반사 카드와 ★같은 꼴(.prop-cell-card · 눈 · ✕ · 접기) ═══════════ */
function _shadowCardHtml(el, P) {
  const fx = fxShadowOf(el);
  const open = fxIsCardOpen(el, 'shadow');
  const eye = (window.EYE_ICONS || {})[fx.state === 'off' ? 'hidden' : 'shown'] || '';
  const R = FX_SHADOW_RANGES;
  const hex = (window.formatHex6 ? window.formatHex6(fx.color) : fx.color.replace('#', '').toUpperCase());
  const slider = (lbl, key, val, [lo, hi]) => `
          <div class="prop-row">
            <span class="prop-label">${lbl}</span>
            <input type="range" class="prop-slider" id="${P}-fxsh-${key}-slider" min="${lo}" max="${hi}" step="1" value="${val}">
            <input type="number" class="prop-number" id="${P}-fxsh-${key}-num" min="${lo}" max="${hi}" value="${val}">
          </div>`;
  return `
      <div class="prop-cell-card${open ? ' expanded' : ''}" id="${P}-fxsh-card" data-fx-type="shadow">
        <div class="prop-cell-card-header" id="${P}-fxsh-head">
          <button class="prop-icon-btn" id="${P}-fxsh-eye" title="${fx.state === 'off' ? '효과 켜기' : '효과 끄기'}" aria-label="효과 켜기/끄기" aria-pressed="${fx.state === 'on'}">${eye}</button>
          <span class="prop-cell-card-title" style="flex:1;${fx.state === 'off' ? 'text-decoration:line-through;opacity:.6;' : ''}">그림자</span>
          <button class="prop-icon-btn" id="${P}-fxsh-del" title="효과 삭제" aria-label="효과 삭제">×</button>
        </div>
        <div class="prop-cell-card-body" id="${P}-fxsh-body"${open ? '' : ' hidden'}>${slider('X', 'x', fx.x, R.x)}${slider('Y', 'y', fx.y, R.y)}${slider('Blur', 'blur', fx.blur, R.blur)}${slider('불투명도', 'op', fx.op, R.op)}
          <div class="prop-color-row">
            <span class="prop-label">색상</span>
            <div class="prop-color-field">
              <div class="prop-color-swatch" style="background:${fx.color}">
                <input type="color" id="${P}-fxsh-color" value="${fx.color}">
              </div>
              <input type="text" class="prop-color-hex" id="${P}-fxsh-color-hex" value="${hex}" maxlength="7" aria-label="Shadow color">
            </div>
          </div>
        </div>
      </div>`;
}

function _wireShadowCard(el, P, again) {
  const $ = (id) => document.getElementById(`${P}-${id}`);
  $('fxsh-del')?.addEventListener('click', (e) => { e.stopPropagation(); setFxShadow(el, { state: 'none' }); again(); });
  $('fxsh-eye')?.addEventListener('click', (e) => { e.stopPropagation(); const cur = fxShadowOf(el).state; setFxShadow(el, { state: cur === 'off' ? 'on' : 'off' }); again(); });
  $('fxsh-head')?.addEventListener('click', () => { const b = $('fxsh-body'); if (!b) return; const open = b.hidden; b.hidden = !open; fxSetCardOpen(el, 'shadow', open); $('fxsh-card')?.classList.toggle('expanded', open); });
  for (const key of ['x', 'y', 'blur', 'op']) {
    const sl = $(`fxsh-${key}-slider`), n = $(`fxsh-${key}-num`);
    if (!sl || !n) continue;
    sl.addEventListener('mousedown', () => window.pushHistory?.('효과'));
    sl.addEventListener('input', () => { setFxShadow(el, { [key]: sl.value }, { history: false }); n.value = fxShadowOf(el)[key]; });
    n.addEventListener('change', () => { setFxShadow(el, { [key]: n.value }); const v = fxShadowOf(el)[key]; n.value = v; sl.value = v; });
  }
  const col = $('fxsh-color'), hex = $('fxsh-color-hex');
  col?.addEventListener('input', () => { setFxShadow(el, { color: col.value }); });
  col?.addEventListener('change', () => { again(); });
  hex?.addEventListener('change', () => { setFxShadow(el, { color: hex.value }); again(); });
}

/* ═══ 명부의 둘째 식구 ══════════════════════════════════════════════════════
   ★이 한 벌이 전부다 — 목록·＋·접힘·배선은 명부가 한다(패널 파일 0줄 변경). */
registerFxType({
  key: 'shadow',
  label: '그림자',
  /* ★도형·에셋만 — 텍스트는 제 「Shadow」 절이 있다(위 머리말). ⛔허용 목록으로 적는다(막는 목록은 블럭이 늘면 샌다). */
  supports: (el) => !!(el && el.classList && (el.classList.contains('shape-block') || el.classList.contains('asset-block'))),
  has:  (el) => fxShadowOf(el).state !== 'none',
  add:  (el) => setFxShadow(el, { state: 'on' }),
  card: _shadowCardHtml,
  wire: _wireShadowCard,
});

if (typeof window !== 'undefined') {
  Object.assign(window, { fxShadowOf, applyFxShadow, setFxShadow, FX_SHADOW_KEYS, FX_SHADOW_DEFAULTS, FX_SHADOW_RANGES });
}
