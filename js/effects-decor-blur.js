/* ════════════════════════════════════════════════════════════════════════
   EFFECTS 식구 — 흐림(꾸밈 블러) (IMG-FX-BLUR-01 · 현빈 261121 결정 ⓑ · 발주2 #2)
   ────────────────────────────────────────────────────────────────────────
   ★«가림»(js/effects-blur.js · data-redact · 원본을 안 내보냄)과 «다른» 효과다 — 꾸밈용: 원본을 그대로 싣고 흐리게 «보이게»만.
     드롭다운 이름도 갈랐다: 가림 = «가림» · 이것 = «흐림». 옛 저장본의 블러(data-redact)는 계속 가림.
   ★상태 = 에셋 블럭 data-decor-blur(1..40 px 정수) · 끈 동안 = data-decor-blur-off(값 보존) — 블러 카드와 같은 눈 규약.
   ★그림 = 합성 한 자리 js/effects/image-redact.js writeImgFilter(색보정 + 가림 + 흐림 · 가림이 켜지면 가림만) · 가장자리 = css/editor-layout.css 3σ 키우기.
   ★내보내기: PNG = 화면 그대로 · HTML = 인라인 CSS filter 그대로 · Figma = 원본 src + LAYER_BLUR(js/io/export-figma-json.js · figma-renderer).
   ════════════════════════════════════════════════════════════════════════ */
import { recomposeHost, normalizeDecorBlur } from './effects/image-redact.js';

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
  window.applyHalftone?.(el);   // 하프톤 켜진 그림이면 흐린 사진으로 다시 굽기(sig 에 흐림 값 · 꺼진 블럭은 덮개 치움만)
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxDecorBlurOf(el) };
}

/* ★카드·명부 등록은 «Layer blur» 식구로 옮겼다(js/effects-layer-blur.js · 0.9.13 172 t13E-06) — ＋ 목록에 «흐림» 항목은 이제 없다. 읽기·쓰기 문·전역은 그대로. */

if (typeof window !== 'undefined') Object.assign(window, { fxDecorBlurOf, setFxDecorBlur, FX_DECOR_BLUR_DEFAULT });
