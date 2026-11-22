/* asset-reveal.js — 이미지(에셋) 블럭 «컬러 리빌» GIF 움직임 · SLIDE-FX-COLOR-REVEAL-01(현빈 «0.9.14» · 지디 GO 261121)
 *   입구 = 에셋 패널 Export 절 GIF 단추 → GIF 패널(animation-engine.js _MK.reveal 이 효과 목록을 컬러 리빌로) · 정적 블럭은 그대로(저장·PNG·HTML·Figma 무변 = 컬러 정지 그림).
 *   데이터(에셋 dataset): data-anim-reveal='{"mode","dwell","speed"}'(기본이면 키 없음) — 신호등 data-anim-step 과 같은 꼴. 새 블럭 종 아님.
 *   바탕 그림 = 신호등의 stepPrepare 재사용(PNG 내보내기 길로 블럭 사각형을 찍음 · 칸 0개면 칸 없이 바탕만) — 새 그림 길 0 · goya-asset·자르기·색보정이 PNG 와 같다.
 *   섹션 배경 그림 리빌은 이번 판 밖(다음 판 후보).
 */
import { REVEAL_FX, REVEAL_ANIM_DEFAULT, normReveal, revealLoopSec, revealAt, drawReveal } from '../fx/color-reveal.js';
import { diffFromDefault, gifPlan, slideInfoText } from '../fx/slide-motion.js';
import { stepPrepare } from './grid-step.js';

const _json = (s, d) => { try { const v = JSON.parse(s || ''); return v ?? d; } catch (_) { return d; } };

export function readRevealState(block) {
  return { fx: REVEAL_FX[0], anim: normReveal(_json(block.dataset.animReveal, {})) };
}
/** 움직임 값(GIF 패널) — 바뀌었으면 true(부르는 쪽이 이력 한 칸). */
export function setRevealAnim(block, patch) {
  const before = block.dataset.animReveal ?? null;
  const v = diffFromDefault(normReveal({ ...readRevealState(block).anim, ...patch }), REVEAL_ANIM_DEFAULT);
  if (Object.keys(v).length) block.dataset.animReveal = JSON.stringify(v); else delete block.dataset.animReveal;
  return (block.dataset.animReveal ?? null) !== before;
}
/** 그림이 든 에셋만(빈 칸·영상 대기는 GIF 막힘). */
export const revealHasImage = (block) => block.classList.contains('has-image') && block.dataset.assetType !== 'video-pending';
export const revealPrepare = (block) => stepPrepare(block);
/** 엔진이 쓰는 한 바퀴 계획 — stepPlan 과 같은 꼴(draw(ctx, W, H, _size, t) · hold 0). */
export function revealPlan(block, anim) {
  const A = normReveal(anim || readRevealState(block).anim), S = block._stepBase || { base: null };
  const sec = revealLoopSec(A);
  return {
    duration: sec * 1000, hold: 0, info: slideInfoText(sec), gif: gifPlan(sec), fx: REVEAL_FX[0], anim: A,
    draw: (ctx, W, H, _size, t) => drawReveal(ctx, W, H, S.base, A.mode, revealAt(A, t)),
  };
}

window.readRevealState = readRevealState;
window.setRevealAnim = setRevealAnim;
window.revealHasImage = revealHasImage;
window.revealPrepare = revealPrepare;
window.revealPlan = revealPlan;
