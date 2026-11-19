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
    const applyRot = v => {
      v = Math.min(180, Math.max(-180, v || 0));
      const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
      // 기존 transform에서 rotate만 교체 (position translate 등 보존)
      const base = (el.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
      el.style.transform = (base ? base + ' ' : '') + `rotate(${v}deg)`;
      el.style.transformOrigin = 'center center';
      if (v) el.dataset.rotation = v; else delete el.dataset.rotation;
      rotNumber.value = v;
      window.scheduleAutoSave?.();
    };
    rotNumber.addEventListener('input', () => applyRot(parseInt(rotNumber.value) || 0));
    rotNumber.addEventListener('change', () => window.pushHistory?.());
    /* Q17 — 90° · 좌우 · 상하 반전 · 아이콘 끌기(회전 줄 한 벌 · _helpers.js wireRotRow) */
    wireRotRow({ p: 'txt', numberId: 'txt-rot-number', host: () => tb.closest('.frame-block[data-text-frame="true"]') || tb });
  }
}
