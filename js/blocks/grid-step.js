/* grid-step.js — 그리드 블럭 «신호등»(칸 차례 강조) 움직임 · 0.9.13 MOTION-STEP-HIGHLIGHT-01(현빈 261116 · 설계 DESIGN-ty-0913-motion-step-261117.md · 지디 GO 261117)
 *   입구 = GIF 버튼 → GIF 패널(animation-engine.js 가 그리드면 효과 목록을 신호등 셋으로) · 정적 블럭은 그대로(저장·PNG·Figma 무변).
 *   데이터(그리드 dataset): data-anim-fx(step-fill|step-outline|step-pop) · data-anim-step='{"dwell","past","speed"}'(기본이면 키 없음). 새 블럭 종 아님.
 *   바탕 그림 = PNG 내보내기 길 그대로(export-gate.js captureTruth 와 같은 순서: prepareCloneForCapture → renderComponentsInClone → captureCloneToCanvas · withGuideOff)
 *     섹션을 한 번 찍어 블럭 사각형만 잘라 둔다 — 새 그림 길 0(오염 0 은 GIF 저장 시험이 getImageData 로 단언).
 *   강조 색 = 디자인 시스템 컬러 변수 «primary»(왼쪽 Design System · 없으면 그 기본값) — 앱 UI 파랑(--sel-color 등)이 결과물에 박히면 안 된다(지디 261117).
 *   칸 = 이 그리드의 .grd-cell(문서 순서 = 행 우선 · 자식 블럭 안 그리드 칸은 뺌). «체크리스트» = 체크 아이콘 줄을 넣은 그리드(따로 없음 · 지디 결정 ①).
 */
import { STEP_FX, STEP_ANIM_DEFAULT, normStep, stepLoopSec, stepAt, drawStep } from '../fx/step-motion.js';
import { diffFromDefault, gifPlan, slideInfoText } from '../fx/slide-motion.js';
import { prepareCloneForCapture, renderComponentsInClone, captureCloneToCanvas, isNativeCapture, sectionBgColor } from '../io/export-image.js';
import { withGuideOff } from '../io/capture-safety.js';

const _json = (s, d) => { try { const v = JSON.parse(s || ''); return v ?? d; } catch (_) { return d; } };
const _cellsOf = (grid) => [...grid.querySelectorAll('.grd-cell')].filter((c) => c.closest('.grid-block') === grid);

export function readStepState(block) {
  const d = block.dataset;
  return { fx: STEP_FX.includes(d.animFx) ? d.animFx : STEP_FX[0], anim: normStep(_json(d.animStep, {})) };
}
/** 움직임 값(GIF 패널) — 바뀌었으면 true(부르는 쪽이 이력 한 칸). */
export function setStepAnim(block, patch) {
  const before = block.dataset.animStep ?? null;
  const v = diffFromDefault(normStep({ ...readStepState(block).anim, ...patch }), STEP_ANIM_DEFAULT);
  if (Object.keys(v).length) block.dataset.animStep = JSON.stringify(v); else delete block.dataset.animStep;
  return (block.dataset.animStep ?? null) !== before;
}
export const stepHasCells = (block) => _cellsOf(block).length > 0;
/** 강조 색 — 디자인 시스템 primary(getColorVars 가 사용자 값 · 없으면 기본 3색의 primary 를 준다). shortcut: DesignSystem 이 없을 때만 그 기본값 글자를 씀(design-system.js DEFAULT_COLOR_VARS.primary 와 같아야). */
export const stepColor = () => window.DesignSystem?.getColorVars?.()?.primary || '#6b9eff';

/** 블럭 바탕 그림 + 칸 사각형(블럭 px) — 같은 내용·폭이면 한 번만 찍는다. 실패 = base null(칸 덮개만 그림 · 경고). */
export async function stepPrepare(block) {
  const sec = block.closest('.section-block');
  const key = `${block.offsetWidth}|${block.innerHTML}`;
  if (block._stepBase && block._stepBase.key === key) return block._stepBase;
  let out = { key, base: null, err: null, cells: [], bw: Math.max(1, block.offsetWidth), bh: Math.max(1, block.offsetHeight) };
  if (sec && block.id) {
    const w = Math.round(sec.offsetWidth), native = isNativeCapture();
    try {
      out = await withGuideOff(async () => {
        const clone = await prepareCloneForCapture(sec, w, native);
        try {
          renderComponentsInClone(clone);
          await document.fonts.ready;
          const cb = clone.querySelector('#' + CSS.escape(block.id));
          if (!cb) return { ...out, err: '클론에서 블럭을 못 찾음' };
          const cr = clone.getBoundingClientRect(), br = cb.getBoundingClientRect();
          const cells = _cellsOf(cb).map((c) => { const r = c.getBoundingClientRect(); return { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height }; });
          const cap = await captureCloneToCanvas(clone, w, sectionBgColor(sec), native, sec);
          const s = cap.canvas.width / cr.width;
          const base = document.createElement('canvas');
          base.width = Math.max(1, Math.round(br.width * s)); base.height = Math.max(1, Math.round(br.height * s));
          base.getContext('2d').drawImage(cap.canvas, (br.left - cr.left) * s, (br.top - cr.top) * s, br.width * s, br.height * s, 0, 0, base.width, base.height);
          return { key, base, err: null, cells, bw: br.width, bh: br.height };
        } finally { if (clone.parentNode) clone.parentNode.removeChild(clone); }
      });
    } catch (e) {   // 찍기 실패를 조용히 삼키지 않는다 — 까닭을 _stepBase.err 에(그림 읽기 실패는 Error 가 아니라 Event 로 온다: captureCloneToCanvas 의 Image onerror)
      out.err = e instanceof Error ? e.message : (e && e.type ? `그림 읽기 실패(${e.type}) — 찍은 PNG 가 비었거나 깨짐` : String(e));
      console.warn('[grid-step] 바탕 그림 찍기 실패 — 칸 덮개만 그린다:', out.err);
    }
  }
  if (!out.cells.length) {   // 찍기 실패해도 칸 자리는 살아 있는 블럭에서(배율은 사각형 비율로 약분)
    const br = block.getBoundingClientRect(), z = br.width / out.bw || 1;
    out.cells = _cellsOf(block).map((c) => { const r = c.getBoundingClientRect(); return { x: (r.left - br.left) / z, y: (r.top - br.top) / z, w: r.width / z, h: r.height / z }; });
  }
  block._stepBase = out;
  return out;
}
/** 엔진이 쓰는 한 바퀴 계획 — slidePlan 과 같은 꼴(draw(ctx, W, H, _size, t) · hold 0). 그림은 stepPrepare 뒤 block._stepBase. */
export function stepPlan(block, anim, fxOverride) {
  const st = readStepState(block);
  const A = normStep(anim || st.anim), fx = STEP_FX.includes(fxOverride) ? fxOverride : st.fx;
  const S = block._stepBase || { base: null, cells: [], bw: Math.max(1, block.offsetWidth) };
  const n = Math.max(1, S.cells.length), sec = stepLoopSec(n, A), color = stepColor(), dim = window.slideBg ? window.slideBg(block) : '#ffffff';
  return {
    duration: sec * 1000, hold: 0, info: slideInfoText(sec), gif: gifPlan(sec), fx, anim: A,
    draw: (ctx, W, H, _size, t) => drawStep(ctx, W, H, S.base, S.cells, fx, stepAt(n, t), A.past, color, dim, W / S.bw),
  };
}

window.readStepState = readStepState;
window.setStepAnim = setStepAnim;
window.stepHasCells = stepHasCells;
window.stepPrepare = stepPrepare;
window.stepPlan = stepPlan;
