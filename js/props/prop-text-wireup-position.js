import { wireRotRow } from './_helpers.js';
/* prop-text-wireup-position.js
 * width / X / Y (overlay-tb는 호출하지 않음)
 */

export function wirePositionSection({ tb }) {
  const wNumber = document.getElementById('txt-width-number');
  if (wNumber) {
    const applyW = v => {
      const row = tb.closest('.row');
      const tf  = tb.closest('.frame-block[data-text-frame="true"]');
      if (row) {
        row.style.width     = v + 'px';
        row.style.maxWidth  = '100%';
        row.style.margin    = '0 auto';
        row.style.alignSelf = 'center';
        row.dataset.width   = v;
      } else if (tf) {
        // text-frame이 래퍼인 경우 — text-frame에 width 적용
        tf.style.width    = v + 'px';
        tf.style.maxWidth = '100%';
        tf.dataset.width  = v;
      } else {
        tb.style.width = v + 'px';
        tb.dataset.width = v;
      }
      wNumber.value = v;
      window.scheduleAutoSave?.();
    };
    wNumber.addEventListener('input', () => applyW(Math.min(860, Math.max(80, parseInt(wNumber.value) || 80))));
    wNumber.addEventListener('change', () => window.pushHistory?.());
    /* 라벨 «너비»를 좌우로 끌면 1px = 1 (재설계 1차 ⑥ · Figma 라벨 끌기). 놓을 때 이력 한 칸 */
    const scrub = document.getElementById('txt-width-scrub');
    scrub?.addEventListener('pointerdown', (e) => {
      if (e.button) return;   // 왼쪽 단추만 끈다(오른쪽 클릭·가운데 클릭은 끌기 아님)
      const x0 = e.clientX, v0 = parseInt(wNumber.value) || 80;
      const move = (ev) => applyW(Math.min(860, Math.max(80, v0 + Math.round(ev.clientX - x0))));
      scrub.setPointerCapture(e.pointerId);
      scrub.addEventListener('pointermove', move);
      scrub.addEventListener('lostpointercapture', () => { scrub.removeEventListener('pointermove', move); window.pushHistory?.(); }, { once: true });
      e.preventDefault();
    });
  }

  window.OverlayFloat?.wireFloatAlign?.({ block: tb });   // 현빈 261123 S1-4② — 떠 있는 글자 정렬 6칸(떠 있지 않으면 무동작)
  const xNumber = document.getElementById('txt-x-number');
  const yNumber = document.getElementById('txt-y-number');
  if (xNumber) {
    xNumber.addEventListener('input', () => {
      const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
      el.style.left = (parseInt(xNumber.value) || 0) + 'px';
      el.dataset.offsetX = xNumber.value;
      window.scheduleAutoSave?.();
    });
    xNumber.addEventListener('change', () => window.pushHistory?.());
  }
  if (yNumber) {
    yNumber.addEventListener('input', () => {
      const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
      el.style.top = (parseInt(yNumber.value) || 0) + 'px';
      el.dataset.offsetY = yNumber.value;
      window.scheduleAutoSave?.();
    });
    yNumber.addEventListener('change', () => window.pushHistory?.());
  }

  // 회전 각도 칸 — text-frame(있으면) 또는 tb에 transform: rotate 적용 (Q20 · 슬라이더 없음 · 시안 v10)
  const rotNumber = document.getElementById('txt-rot-number');
  if (rotNumber) {
    const applyRot = (v, typing) => {
      v = Math.min(180, Math.max(-180, v || 0));
      const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
      window.writeRotation(el, v, { key: 'rotation' });   // 회전 쓰기 한 함수(js/block-flip.js writeRotation · rotate → scale 고정 · QA2 ③)
      if (!typing) rotNumber.value = v;
      window.scheduleAutoSave?.();
    };
    rotNumber.addEventListener('input', () => applyRot(parseInt(rotNumber.value) || 0, true));   // QA2 M4 — 치는 중엔 칸을 다시 안 쓴다(«-30» 을 칠 수 있게) · 끝낼 때(change) 범위로 정규화
    rotNumber.addEventListener('change', () => { applyRot(parseInt(rotNumber.value) || 0); window.pushHistory?.(); });
    /* Q17 — 90° · 좌우 · 상하 반전 · 아이콘 끌기(회전 줄 한 벌 · _helpers.js wireRotRow) */
    wireRotRow({ p: 'txt', numberId: 'txt-rot-number', host: () => tb.closest('.frame-block[data-text-frame="true"]') || tb });
  }
}
