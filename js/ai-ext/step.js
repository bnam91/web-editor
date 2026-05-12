/* ══════════════════════════════════════
   AI fill 확장 — step-block 단계 수 자동 확장
   payload:
     { id: "stb_xxx", steps: [{title, desc}, ...] }
   동작:
     - step-block.dataset.steps = JSON.stringify(payload.steps)
     - window.renderStepBlock(sb) 호출
══════════════════════════════════════ */
(function () {
  function _aiApplyExt_step(sec, ext) {
    if (!sec || !ext || !ext.id) return false;
    const sb = sec.querySelector(`#${CSS.escape(ext.id)}`);
    if (!sb || !sb.classList.contains('step-block')) return false;
    if (!Array.isArray(ext.steps)) return false;
    const norm = ext.steps.map(s => ({
      title: (s && typeof s.title === 'string') ? s.title : '',
      desc:  (s && typeof s.desc  === 'string') ? s.desc  : ''
    }));
    sb.dataset.steps = JSON.stringify(norm);
    if (typeof window !== 'undefined' && typeof window.renderStepBlock === 'function') {
      window.renderStepBlock(sb);
    }
    return true;
  }
  if (typeof window !== 'undefined') window._aiApplyExt_step = _aiApplyExt_step;
})();
