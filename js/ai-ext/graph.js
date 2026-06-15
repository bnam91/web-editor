/* ══════════════════════════════════════
   AI fill 확장 — graph-block 슬롯 자동 확장
   payload 형태:
     { id: "grb_xxx", items: [{ label: "...", value: 0~100 }, ...] }
   동작:
     - 해당 그래프의 items 배열을 payload.items로 통째로 교체
     - renderGraph 호출
══════════════════════════════════════ */
(function () {
  function _aiApplyExt_graph(sec, ext) {
    if (!sec || !ext || !ext.id) return false;
    const grb = sec.querySelector(`#${CSS.escape(ext.id)}`);
    if (!grb || !grb.classList.contains('graph-block')) return false;
    if (!Array.isArray(ext.items)) return false;
    // 기존 items (value NaN fallback용)
    let prev = [];
    try { prev = JSON.parse(grb.dataset.items || '[]'); } catch (_) {}
    const next = ext.items.map((it, i) => {
      const out = { label: '', value: 0 };
      if (it && typeof it === 'object') {
        out.label = (it.label !== undefined && it.label !== null) ? String(it.label) : '';
        if (typeof it.value === 'number' && !Number.isNaN(it.value)) {
          out.value = it.value;
        } else {
          const n = parseFloat(it.value);
          if (!Number.isNaN(n)) {
            out.value = n;
          } else if (prev[i] && typeof prev[i].value === 'number' && !Number.isNaN(prev[i].value)) {
            out.value = prev[i].value;
          } else {
            out.value = 0;
          }
        }
      }
      return out;
    });
    grb.dataset.items = JSON.stringify(next);
    if (typeof window.renderGraph === 'function') {
      window.renderGraph(grb);
    }
    return true;
  }
  if (typeof window !== 'undefined') window._aiApplyExt_graph = _aiApplyExt_graph;
})();
