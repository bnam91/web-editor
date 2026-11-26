/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS 식구⑥ — 블러(Redact) (2026-10-26 · 1012t1C1 · 현빈 발주)
   ─────────────────────────────────────────────────────────────────────────────
   ★현빈 원문 — 「이미지블럭에 그레인 이펙트 들어가는 것 처럼 블러 (Redact)기능도 있으면 좋겠음
     👉 이펙트 드랍다운에 추가해줘야지 않니? 에셋블럭의 이펙트 드랍다운 혹은 여기에 추가할까? <div id="color-adjust-header">」
   ★해석(태양 발주) — 둘 중 «Effects 드롭다운»으로 정했다 ⇒ #asset-fx-add 에 「블러」 한 줄.
     옛 자리(prop-asset.js 의 따로 떨어진 «블러 (Redact)» 절)는 ★지웠다 — 두 곳에 두지 않는다.
   ★이 파일이 하는 일 = js/effects-registry.js 에 «식구 하나»를 등록하는 것. 그게 전부다(반사·그림자와 같은 결).

   ★값·의미·저장 키는 ★옛 블러 그대로다 — ⛔새 키를 만들지 않았다(옛 저장본 마이그레이션 0):
     상태 = 에셋 블럭 자신의 data-redact(1..100) + 인라인 --redact-blur(px) · 쓰는 문 = js/effects/image-redact.js applyRedact.
     ⇒ 그림 filter 합성(writeImgFilter) · 바닥 CSS(css/editor-layout.css) · 내보내기 안전실패(capture-safety.js)
       · Figma 덮개(export-figma-json.js) · 이미지 교체/스크래치 이동(image-handling.js) 은 ★한 줄도 안 바뀐다.
     ⇒ 옛 파일을 열면 data-redact 가 있으니 has() 가 참 ⇒ ★저절로 «효과 카드»로 보인다.
   ★눈(끄기) — 반사·그림자 카드와 같은 규약(U8: 끔 = 값 보존 · 안 그림). 블러는 «켬»의 정본이 data-redact 하나라
     끈 동안은 그 값을 data-redact-off 로 «옮겨» 둔다(data-redact 는 지운다).
     ⇒ 끈 블럭은 모든 소비자(CSS·합성·h2c 덮개·Figma)에게 «블러 없음»으로 보인다 — 따로 가르칠 곳 0.
     ⛔그래서 data-redact-off 는 «끈 상태»에만 있다. 옛 저장본엔 없다(옛 판엔 끄기가 없었다).
   ★✕ = 두 키 «모두» 지움(applyRedact 0 = 속성·변수 흔적 0 — 옛 «강도 0» 과 같은 바이트).
   ★강도 0 = 지움(옛 절과 같은 뜻 · image-redact.js 「0/없음 = 끔」). 숫자칸에 0 을 넣으면 카드가 목록으로 돌아간다.
   ★고를 때 기본 강도 = 40 ⇒ 8px — 도형 가림막의 기본 블러(8px)·바닥 CSS 폴백(var(--redact-blur, 8px))과 같은 값.
   ★대상 = 그림이 든 에셋(=이미지) 블럭만(옛 절의 hasImage 조건 그대로 — 빈 에셋엔 흐릴 것이 없다).
     ⛔비교(comparison) 셀의 «블러 (Redact)» 절은 이 파일과 무관하다 — 그 칸은 블럭이 아니라 Effects 명부가 없다(D4 그대로).
   ═══════════════════════════════════════════════════════════════════════════ */
import { applyRedact, readRedact, normalizeRedact } from './effects/image-redact.js';

export const FX_BLUR_DEFAULT = 40;   /* 강도 40 ⇒ 8px (REDACT_MAX_PX 20 × 0.4) — 위 머리말 */

/** 효과 읽기 — {state:'none'|'on'|'off', v}. ★패널·시험이 «같은 이 함수»를 본다.
 *  켬이 이긴다 — 바깥(MCP·스크래치 되얹기)이 끈 블럭에 applyRedact 를 불러도 화면과 같은 답을 준다. */
export function fxBlurOf(el) {
  const on = readRedact(el);
  if (on > 0) return { state: 'on', v: on };
  const off = normalizeRedact(el?.dataset?.redactOff);
  if (off > 0) return { state: 'off', v: off };
  return { state: 'none', v: 0 };
}

/** 바꾸는 문 «하나» — patch: {state?:'on'|'off'|'none', v?}. ★이력 = push-before(반사·그림자 카드와 같은 규약). */
export function setFxBlur(el, patch = {}, { history = true } = {}) {
  if (!el || !el.dataset) return { ok: false, code: 'NOT_FOUND' };
  if (history) window.pushHistory?.('효과');
  const cur = fxBlurOf(el);
  const want = patch.v !== undefined ? normalizeRedact(patch.v) : (cur.v || FX_BLUR_DEFAULT);
  const state = patch.state || (cur.state === 'none' ? 'on' : cur.state);
  if (state === 'none' || want <= 0) {
    delete el.dataset.redactOff;
    applyRedact(el, 0);
  } else if (state === 'off') {
    applyRedact(el, 0);
    el.dataset.redactOff = String(want);
  } else {
    delete el.dataset.redactOff;
    applyRedact(el, want);
  }
  window.scheduleAutoSave?.();
  return { ok: true, applied: fxBlurOf(el) };
}

/* ★카드·명부 등록은 «Layer blur» 식구로 옮겼다(js/effects-layer-blur.js · 0.9.13 172 t13E-06 현빈 22:43 GO) — ＋ 목록에 «가림» 항목은 이제 없다.
   이 파일은 «가림» 상태의 읽기·쓰기 문(fxBlurOf·setFxBlur · window 전역 · MCP/CDP 길)만 지킨다 — 저장 키 data-redact·data-redact-off 그대로. */

if (typeof window !== 'undefined') {
  Object.assign(window, { fxBlurOf, setFxBlur, FX_BLUR_DEFAULT });
}
