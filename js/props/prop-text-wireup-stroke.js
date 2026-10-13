/* prop-text-wireup-stroke.js — ★1012t1E1 텍스트 블럭 Stroke(외곽선) 절: 켜기 / 두께 / 색상 / 위치(내부·가운데·외부)
 *
 * 데이터(글자칸 .tb-* 위 · Shadow 의 data-shadow-* 와 같은 자리) — «패널 상태»:
 *   data-stroke-on    'true' | 없음
 *   data-stroke-w     보이는 두께 px (0.5 단위)          ⚠️data-stroke-width 는 스티커·도형·에셋이 다른 뜻으로 쓴다 → 피했다
 *   data-stroke-color '#rrggbb' | 'rgba(...)'
 *   data-stroke-align 'inside' | 'center' | 'outside'      (없으면 outside — 레거시)
 * 화면(정본 렌더) = 인라인 style:
 *   outside → -webkit-text-stroke: 2N color; paint-order: stroke fill   (실측 T2 — 스티커와 같은 시맨틱)
 *   center  → -webkit-text-stroke: N color  (paint-order 없음)           (실측 T1)
 *   inside  → 인라인 stroke 없음 · --gd-stroke-filter: url(#gdsk-in-…)  (실측 T4 · text-stroke-filter.js)
 * ⛔text-shadow 로 그리지 마라 — 글로우 합성(fxComposeTextShadow)과 충돌한다.
 *
 * 하위호환(E1-plan §3): addTextBlock({strokeWidth}) 저장본 = 인라인 `-webkit-text-stroke: Wpx; paint-order: stroke fill`,
 *   dataset 없음 ⇒ «외부 · 보이는 W/2» 로 «해석만» 한다(읽기는 아무것도 안 쓴다 — 로드 화면 바이트 그대로).
 *   패널에서 만지는 순간 새 형식으로 쓴다: 외부·W/2 → 2×(W/2)=W + stroke fill ⇒ 화면 동일.
 */

import { wireColorField } from './color-picker.js';
import { syncStrokeFilter, strokeColorParts } from './text-stroke-filter.js';

export const STROKE_ALIGNS = ['inside', 'center', 'outside'];
export const STROKE_DEFAULTS = { on: false, width: 2, color: '#000000', align: 'outside' };

const _half = v => Math.round((+v || 0) * 2) / 2;

function _cssColor(c) {
  const { hex, a } = strokeColorParts(c);
  if (a >= 1) return hex;
  const h = hex.slice(1);
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

/** 글자칸에서 외곽선 상태를 읽는다(쓰지 않는다). legacy:true = dataset 없이 인라인 stroke 만 있던 저장본. */
export function readStrokeState(contentEl) {
  if (!contentEl || !contentEl.style) return { ...STROKE_DEFAULTS, legacy: false };
  const ds = contentEl.dataset || {};
  if (ds.strokeAlign !== undefined || ds.strokeW !== undefined) {
    const w = parseFloat(ds.strokeW);
    return {
      on: ds.strokeOn === 'true',
      width: w > 0 ? _half(w) : STROKE_DEFAULTS.width,
      color: ds.strokeColor ? _cssColor(ds.strokeColor) : STROKE_DEFAULTS.color,
      align: STROKE_ALIGNS.includes(ds.strokeAlign) ? ds.strokeAlign : 'outside',
      legacy: false,
    };
  }
  const st = contentEl.style;
  const W = parseFloat(st.getPropertyValue('-webkit-text-stroke-width'));
  if (W > 0) {
    const col = st.getPropertyValue('-webkit-text-stroke-color') || '#000000';
    const stroke1st = /^\s*stroke\b/.test(st.getPropertyValue('paint-order') || '');
    return {
      on: true,
      width: stroke1st ? _half(W / 2) : _half(W),     // stroke 먼저 = 획 절반이 글자 밑에 숨는다 ⇒ 보이는 두께 W/2
      color: _cssColor(col),
      align: stroke1st ? 'outside' : 'center',
      legacy: true,
    };
  }
  return { ...STROKE_DEFAULTS, legacy: false };
}

/** 상태를 글자칸에 쓴다(dataset + 인라인 렌더 + 내부 필터 동기). */
export function applyStroke(el, s) {
  if (!el || !el.style) return;
  const st = el.style;
  const w = Math.max(0, _half(s.width));
  const color = _cssColor(s.color);
  const align = STROKE_ALIGNS.includes(s.align) ? s.align : 'outside';
  if (s.on) el.dataset.strokeOn = 'true'; else delete el.dataset.strokeOn;
  // off 여도 값은 남긴다(다시 켤 때 슬라이더 위치 유지 — Shadow 와 같은 꼴)
  el.dataset.strokeW = String(w);
  el.dataset.strokeColor = color;
  el.dataset.strokeAlign = align;
  st.removeProperty('-webkit-text-stroke');
  st.removeProperty('paint-order');
  if (s.on && w > 0) {
    if (align === 'outside') {
      st.setProperty('-webkit-text-stroke', `${w * 2}px ${color}`);
      st.setProperty('paint-order', 'stroke fill');
    } else if (align === 'center') {
      st.setProperty('-webkit-text-stroke', `${w}px ${color}`);
    }
  }
  syncStrokeFilter(el);
  // 내부 외곽선 + 그림자/글로우 = 그림자를 필터 사슬로 옮긴다(.tgs — text-block-color.js syncTextGradShadow)
  if (typeof window !== 'undefined') window.syncTextGradShadow?.(el);
}

/** 우측 패널 Stroke 절 배선 (prop-text-wireup-shadow.js 를 본떴다 · 히스토리는 전부 push-after) */
export function wireStrokeSection({ ctx, initial }) {
  const section = document.getElementById('txt-stroke-section');
  if (!section) return;
  const onChk = document.getElementById('txt-stroke-on');
  const wSli  = document.getElementById('txt-stroke-w-slider');
  const wNum  = document.getElementById('txt-stroke-w-number');
  const alSel = document.getElementById('txt-stroke-align');
  const ctrls = document.getElementById('txt-stroke-controls');

  const s = { ...STROKE_DEFAULTS, ...(initial || {}) };
  const _apply = () => { if (ctx.contentEl) applyStroke(ctx.contentEl, s); };

  onChk?.addEventListener('change', () => {
    s.on = !!onChk.checked;
    if (ctrls) ctrls.style.display = s.on ? 'block' : 'none';
    _apply();
    window.pushHistory?.();   // push-after (js/CLAUDE.md 히스토리 규약 — 우측 패널 다수파)
  });

  const _setW = (v) => {
    v = Math.max(0.5, Math.min(20, isNaN(v) ? STROKE_DEFAULTS.width : _half(v)));
    s.width = v;
    if (wSli) wSli.value = String(v);
    if (wNum) wNum.value = String(v);
    _apply();
  };
  wSli?.addEventListener('input',  e => _setW(parseFloat(e.target.value)));
  wSli?.addEventListener('change', () => window.pushHistory?.());
  wNum?.addEventListener('input',  e => _setW(parseFloat(e.target.value)));
  wNum?.addEventListener('change', () => window.pushHistory?.());

  alSel?.addEventListener('change', () => {
    s.align = STROKE_ALIGNS.includes(alSel.value) ? alSel.value : 'outside';
    _apply();
    window.pushHistory?.();
  });

  wireColorField('txt-stroke-color', {
    initialAlpha: Math.round(strokeColorParts(s.color).a * 100),
    onApply: (c) => { s.color = c; _apply(); },
    onCommit: () => window.pushHistory?.(),
  });
}
