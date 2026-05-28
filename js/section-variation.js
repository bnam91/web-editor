/* ═══════════════════════════════════
   A/B VARIATION
═══════════════════════════════════ */
const VARIATION_LABELS = ['A', 'B', 'C', 'D', 'E'];

function _addVariationBadge(sec) {
  sec.querySelector('.variation-badge')?.remove();
  const v = sec.dataset.variation;
  if (!v) return;
  const badge = document.createElement('div');
  badge.className = `variation-badge variation-badge-${v.toLowerCase()}`;
  badge.textContent = v;
  badge.title = `${v}안 — 클릭하여 다음 안으로 전환`;
  badge.addEventListener('click', e => { e.stopPropagation(); toggleVariation(sec); });
  sec.appendChild(badge);
}

function bindVariationToolbarBtn(sec) {
  const toolbar = sec.querySelector('.section-toolbar');
  if (!toolbar) return;
  if (sec.dataset.variationGroup) _addVariationBadge(sec);
  let abBtn = toolbar.querySelector('.st-ab-btn');
  if (sec.dataset.variationGroup) {
    if (!abBtn) {
      abBtn = document.createElement('button');
      abBtn.className = 'st-btn st-ab-btn';
      toolbar.insertBefore(abBtn, toolbar.firstChild);
    }
    const groupId = sec.dataset.variationGroup;
    const all = [...document.querySelectorAll(`.section-block[data-variation-group="${groupId}"]`)];
    const v = sec.dataset.variation || 'A';
    const idx = VARIATION_LABELS.indexOf(v);
    const nextV = VARIATION_LABELS[(idx + 1) % all.length];
    abBtn.textContent = `▷ ${nextV}`;
    abBtn.title = `${nextV}안으로 전환`;
    abBtn.onclick = e => { e.stopPropagation(); toggleVariation(sec); };
  } else {
    if (!abBtn) {
      abBtn = document.createElement('button');
      abBtn.className = 'st-btn st-ab-btn';
      abBtn.textContent = 'A/B';
      abBtn.title = 'A/B 베리에이션 생성';
      toolbar.insertBefore(abBtn, toolbar.firstChild);
    }
    abBtn.onclick = e => { e.stopPropagation(); createVariation(sec); };
  }
}

function createVariation(sec) {
  if (sec.dataset.variationGroup) return;
  window.pushHistory('A/B 베리에이션 생성');
  const groupId = 'vg_' + Math.random().toString(36).slice(2, 8);
  sec.dataset.variationGroup = groupId;
  sec.dataset.variation = 'A';
  sec.dataset.variationActive = '1';
  bindVariationToolbarBtn(sec);
  const clone = sec.cloneNode(true);
  clone.id = window.genId ? window.genId('sec') : 'sec_' + Math.random().toString(36).slice(2, 9);
  clone.querySelectorAll('[id]').forEach(el => {
    const prefix = el.id.split('_')[0];
    el.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
  });
  clone.dataset.variation = 'B';
  clone.dataset.variationActive = '0';
  sec.after(clone);
  clone.addEventListener('click', e => { e.stopPropagation(); window.selectSectionWithModifier(clone, e); });
  window.bindSectionDelete(clone);
  window.bindSectionOrder(clone);
  if (window.bindSectionDrag) window.bindSectionDrag(clone);
  if (window.bindSectionDropZone) window.bindSectionDropZone(clone);
  clone.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .icon-text-block').forEach(b => window.bindBlock && window.bindBlock(b));
  bindVariationToolbarBtn(clone);
  if (window.buildLayerPanel) window.buildLayerPanel();
}

function toggleVariation(sec) {
  const groupId = sec.dataset.variationGroup;
  if (!groupId) return;
  const all = [...document.querySelectorAll(`.section-block[data-variation-group="${groupId}"]`)]
    .sort((a, b) => VARIATION_LABELS.indexOf(a.dataset.variation) - VARIATION_LABELS.indexOf(b.dataset.variation));
  const activeIdx = all.findIndex(s => s.dataset.variationActive === '1');
  if (activeIdx === -1) return;
  const nextIdx = (activeIdx + 1) % all.length;
  all.forEach((s, i) => { s.dataset.variationActive = i === nextIdx ? '1' : '0'; });
  all.forEach(s => bindVariationToolbarBtn(s));
  window.selectSection(all[nextIdx]);
  if (window.buildLayerPanel) window.buildLayerPanel();
  window.pushHistory('베리에이션 전환');
}

function addVariation(sec) {
  const groupId = sec.dataset.variationGroup;
  if (!groupId) return;
  const all = [...document.querySelectorAll(`.section-block[data-variation-group="${groupId}"]`)];
  if (all.length >= VARIATION_LABELS.length) return;
  window.pushHistory(`${VARIATION_LABELS[all.length]}안 추가`);
  const nextLabel = VARIATION_LABELS[all.length];
  const active = all.find(s => s.dataset.variationActive === '1') || all[0];
  const clone = active.cloneNode(true);
  clone.id = window.genId ? window.genId('sec') : 'sec_' + Math.random().toString(36).slice(2, 9);
  clone.querySelectorAll('[id]').forEach(el => {
    const prefix = el.id.split('_')[0];
    el.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
  });
  clone.dataset.variation = nextLabel;
  clone.dataset.variationActive = '0';
  all[all.length - 1].after(clone);
  clone.addEventListener('click', e => { e.stopPropagation(); window.selectSectionWithModifier(clone, e); });
  window.bindSectionDelete(clone);
  window.bindSectionOrder(clone);
  if (window.bindSectionDrag) window.bindSectionDrag(clone);
  if (window.bindSectionDropZone) window.bindSectionDropZone(clone);
  clone.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .icon-text-block').forEach(b => window.bindBlock && window.bindBlock(b));
  bindVariationToolbarBtn(clone);
  all.forEach(s => bindVariationToolbarBtn(s));
  if (window.buildLayerPanel) window.buildLayerPanel();
}

function resolveVariation(sec) {
  const groupId = sec.dataset.variationGroup;
  if (!groupId) return;
  window.pushHistory('Variant 확정');
  const all = [...document.querySelectorAll(`.section-block[data-variation-group="${groupId}"]`)];
  const active = all.find(s => s.dataset.variationActive === '1') || all[0];
  all.forEach(s => { if (s !== active) s.remove(); });
  delete active.dataset.variationGroup;
  delete active.dataset.variation;
  delete active.dataset.variationActive;
  active.querySelector('.variation-badge')?.remove();
  active.querySelector('.st-ab-btn')?.remove();
  active.querySelector('.st-resolve-btn')?.remove();
  window.deselectAll?.();
  window.selectSection?.(active);
  if (window.buildLayerPanel) window.buildLayerPanel();
}

export { bindVariationToolbarBtn, createVariation, toggleVariation, addVariation, resolveVariation };

window.bindVariationToolbarBtn = bindVariationToolbarBtn;
window.createVariation         = createVariation;
window.toggleVariation         = toggleVariation;
window.addVariation            = addVariation;
window.resolveVariation        = resolveVariation;
