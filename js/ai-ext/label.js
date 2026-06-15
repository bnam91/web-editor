/* ══════════════════════════════════════
   AI fill 확장 — label-group-block 태그 수 자동 확장
   payload:
     { id: "lg_xxx", labels: ["태그1", "태그2", ...] }
   동작:
     - 기존 .label-item 모두 제거 (.label-group-add-btn은 유지)
     - payload.labels 배열을 순회하며 makeLabelItem(text, ...) 으로 새 .label-item 생성
     - .label-group-add-btn 앞에 삽입
══════════════════════════════════════ */
(function () {
  function _aiApplyExt_label(sec, ext) {
    if (!sec || !ext || !ext.id) return false;
    const lg = sec.querySelector(`#${CSS.escape(ext.id)}`);
    if (!lg || !lg.classList.contains('label-group-block')) return false;
    if (!Array.isArray(ext.labels)) return false;
    if (typeof window === 'undefined' || typeof window.makeLabelItem !== 'function') return false;

    // 기존 첫 .label-item 에서 dataset 추출 (없으면 기본값)
    const firstItem = lg.querySelector('.label-item');
    let bg     = '#e8e8e8';
    let color  = '#333333';
    let radius = 40;
    let shape  = 'pill';
    if (firstItem) {
      if (firstItem.dataset.bg)    bg    = firstItem.dataset.bg;
      if (firstItem.dataset.color) color = firstItem.dataset.color;
      if (firstItem.dataset.shape) shape = firstItem.dataset.shape;
      if (firstItem.dataset.radius) {
        const raw = firstItem.dataset.radius;
        if (raw === '50%') {
          // circle 은 makeLabelItem 이 shape='circle' 일 때 자동으로 50% 처리
        } else {
          const n = parseInt(raw, 10);
          if (!isNaN(n)) radius = n;
        }
      }
    }

    // 기존 label-item 모두 제거
    lg.querySelectorAll('.label-item').forEach(el => el.remove());

    const addBtn = lg.querySelector('.label-group-add-btn');
    ext.labels.forEach(text => {
      const t = (typeof text === 'string') ? text : String(text ?? '');
      const item = window.makeLabelItem(t, bg, color, radius, shape);
      if (!item) return;
      if (addBtn) lg.insertBefore(item, addBtn);
      else lg.appendChild(item);
    });
    return true;
  }
  if (typeof window !== 'undefined') window._aiApplyExt_label = _aiApplyExt_label;
})();
