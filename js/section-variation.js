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
  window.pushHistory('A/B 베리에이션 생성');   // ★머리에서 «변경 전»을 민다 — 아래 GAP 주석 참조
  let _spl = null;
  const groupId = 'vg_' + Math.random().toString(36).slice(2, 8);
  sec.dataset.variationGroup = groupId;
  sec.dataset.variation = 'A';
  sec.dataset.variationActive = '1';
  bindVariationToolbarBtn(sec);
  const clone = sec.cloneNode(true);
  // 편집 전용 임시 DOM 은 복제하지 않는다 — 사본에 클릭을 막는 투명 오버레이가 영구히 남는다
  clone.querySelectorAll('.sec-bg-proxy, .img-edit-hint, .img-boundary').forEach(el => el.remove());
  clone.classList.remove('sec-bg-editing');
  clone.id = window.genId ? window.genId('sec') : 'sec_' + Math.random().toString(36).slice(2, 9);
  clone.querySelectorAll('[id]').forEach(el => {
    const prefix = el.id.split('_')[0];
    el.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
  });
  clone.dataset.variation = 'B';
  clone.dataset.variationActive = '0';
/* [#16-DUP / BL-SPL-03] 링크된 섹션의 사본에는 «스크래치 사본»을 딸려 보낸다.
   안 그러면 한 이미지를 두 섹션이 쥐어 링크체인이 2개가 된다(SPLink 의 「이미지당 1섹션」 규약 위반).
   ★★반드시 여기 — clone 이 아직 «분리 상태»일 때. DOM 에 «넣은 뒤» 부르면 SPLink.sectionIdOf 가
     «사본 자신»을 찾아 복제를 건너뛴다. ⛔아래로 내리지 마라.
   ⛔인자는 clone «그대로» — clone.cloneNode(true) 를 넘기면 새 토큰이 «버려질 객체»에 적혀
     고치기 «전»보다 나빠진다(붙여넣기에서 실측된 변이A).
   ⛔비동기로 감싸지 마라(queueMicrotask/setTimeout/rAF) — 텍스트 순서는 그대로인데 실행만
     삽입 뒤로 밀린다(실측된 변이B). 지키는 검사: tests/unit/scratch-paste-dup.test.js T-U2-*. */
  _spl = window.SPLink?.rewireClonedSection?.(clone) || null;
  sec.after(clone);
  clone.addEventListener('click', e => { e.stopPropagation(); window.selectSectionWithModifier(clone, e); });
  window.bindSectionDelete(clone);
  window.bindSectionOrder(clone);
  if (window.bindSectionDrag) window.bindSectionDrag(clone);
  if (window.bindSectionDropZone) window.bindSectionDropZone(clone);
  clone.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .grid-block, .infocard-block, .innercard-block, .icon-text-block').forEach(b => window.bindBlock && window.bindBlock(b));
  bindVariationToolbarBtn(clone);
  if (window.buildLayerPanel) window.buildLayerPanel();
  /* ⛔[#16-DUP] 스크래치 사본의 undo 는 «안 배선했다» — 배선하려다 실물에서 깨뜨렸다(2026-09-09 실측).
     시도: 붙여넣기처럼 pushHistory 를 «꼬리»로 옮기고 _spl.sideEffects 를 실었다.
       근거는 맞았다 — sideEffects 는 «떠나는 스냅»에서 읽히므로(history.js undo:leavingSnap)
       머리에서 밀면 그 항목은 «변경 전» 상태라 onUndo 가 영영 안 탄다.
     ★그런데 실물에서 undo 가 «섹션을 둘 다» 지웠다(실측: 섹션 1 → A/B → 2 → undo → ★0).
       꼬리에서 밀면 tip 의 canvas 가 그 항목과 «같아» ensureHistoryCheckpoint 가 아무것도 안 쌓고,
       undo 가 「그 앞 항목」(= 섹션이 생기기도 «전»)으로 한 번에 건너뛴다.
       ⇒ 머리 push 는 앞 항목이 없어도 스스로 성립한다. 그게 더 튼튼하다.
     ⚠️회귀 1947건이 «전부 초록»인 채로 이 일이 났다 — 검사는 「문장이 어디 있나」만 봤다.
   ⇒ 그래서 머리 push 를 «되돌렸다». 남는 값: A/B 를 undo 하면 스크래치 사본 한 장이
     주인 없이 패널에 남는다(데이터 손실 아님 · 사용자가 지울 수 있음).
   ⇒ 제대로 고치려면 ensureHistoryCheckpoint 가 «대기 중인 sideEffects»를 실을 수 있어야 한다
     (지금은 sideEffects 를 아예 안 넣는다 — js/history.js). 그건 undo/redo 전체를 건드리므로
     별건 게이트다. 티켓 = tests/unit/scratch-paste-dup.test.js 의 BL-SPL-04.
   ⛔여기서 pushHistory 를 꼬리로 다시 옮기지 마라 — 위 실측이 그 답이다. */
  /* [#16-DUP] _installFollow 의 MutationObserver 는 #canvas-scaler 를 childList «만»(subtree 아님)
     보므로 #canvas 안에 섹션이 들어와도 안 터진다 ⇒ 사본을 넣은 뒤 한 번 직접 다시 그린다. */
  window.__spLinkRerender?.();
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
  if (window.buildLayerPanel) window.buildLayerPanel();
  window.selectSection(all[nextIdx]);
  window.pushHistory('베리에이션 전환');
}

function addVariation(sec) {
  const groupId = sec.dataset.variationGroup;
  if (!groupId) return;
  const all = [...document.querySelectorAll(`.section-block[data-variation-group="${groupId}"]`)];
  if (all.length >= VARIATION_LABELS.length) return;
  window.pushHistory(`${VARIATION_LABELS[all.length]}안 추가`);   // ★머리 — 아래 GAP 주석 참조
  let _spl = null;
  const nextLabel = VARIATION_LABELS[all.length];
  const active = all.find(s => s.dataset.variationActive === '1') || all[0];
  const clone = active.cloneNode(true);
  // 편집 전용 임시 DOM 은 복제하지 않는다 — 사본에 클릭을 막는 투명 오버레이가 영구히 남는다
  clone.querySelectorAll('.sec-bg-proxy, .img-edit-hint, .img-boundary').forEach(el => el.remove());
  clone.classList.remove('sec-bg-editing');
  clone.id = window.genId ? window.genId('sec') : 'sec_' + Math.random().toString(36).slice(2, 9);
  clone.querySelectorAll('[id]').forEach(el => {
    const prefix = el.id.split('_')[0];
    el.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
  });
  clone.dataset.variation = nextLabel;
  clone.dataset.variationActive = '0';
/* [#16-DUP / BL-SPL-03] 링크된 섹션의 사본에는 «스크래치 사본»을 딸려 보낸다.
   안 그러면 한 이미지를 두 섹션이 쥐어 링크체인이 2개가 된다(SPLink 의 「이미지당 1섹션」 규약 위반).
   ★★반드시 여기 — clone 이 아직 «분리 상태»일 때. DOM 에 «넣은 뒤» 부르면 SPLink.sectionIdOf 가
     «사본 자신»을 찾아 복제를 건너뛴다. ⛔아래로 내리지 마라.
   ⛔인자는 clone «그대로» — clone.cloneNode(true) 를 넘기면 새 토큰이 «버려질 객체»에 적혀
     고치기 «전»보다 나빠진다(붙여넣기에서 실측된 변이A).
   ⛔비동기로 감싸지 마라(queueMicrotask/setTimeout/rAF) — 텍스트 순서는 그대로인데 실행만
     삽입 뒤로 밀린다(실측된 변이B). 지키는 검사: tests/unit/scratch-paste-dup.test.js T-U2-*. */
  _spl = window.SPLink?.rewireClonedSection?.(clone) || null;
  all[all.length - 1].after(clone);
  clone.addEventListener('click', e => { e.stopPropagation(); window.selectSectionWithModifier(clone, e); });
  window.bindSectionDelete(clone);
  window.bindSectionOrder(clone);
  if (window.bindSectionDrag) window.bindSectionDrag(clone);
  if (window.bindSectionDropZone) window.bindSectionDropZone(clone);
  clone.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .grid-block, .infocard-block, .innercard-block, .icon-text-block').forEach(b => window.bindBlock && window.bindBlock(b));
  bindVariationToolbarBtn(clone);
  all.forEach(s => bindVariationToolbarBtn(s));
  if (window.buildLayerPanel) window.buildLayerPanel();
  /* ⛔[#16-DUP] 스크래치 사본의 undo 는 «안 배선했다» — 배선하려다 실물에서 깨뜨렸다(2026-09-09 실측).
     시도: 붙여넣기처럼 pushHistory 를 «꼬리»로 옮기고 _spl.sideEffects 를 실었다.
       근거는 맞았다 — sideEffects 는 «떠나는 스냅»에서 읽히므로(history.js undo:leavingSnap)
       머리에서 밀면 그 항목은 «변경 전» 상태라 onUndo 가 영영 안 탄다.
     ★그런데 실물에서 undo 가 «섹션을 둘 다» 지웠다(실측: 섹션 1 → A/B → 2 → undo → ★0).
       꼬리에서 밀면 tip 의 canvas 가 그 항목과 «같아» ensureHistoryCheckpoint 가 아무것도 안 쌓고,
       undo 가 「그 앞 항목」(= 섹션이 생기기도 «전»)으로 한 번에 건너뛴다.
       ⇒ 머리 push 는 앞 항목이 없어도 스스로 성립한다. 그게 더 튼튼하다.
     ⚠️회귀 1947건이 «전부 초록»인 채로 이 일이 났다 — 검사는 「문장이 어디 있나」만 봤다.
   ⇒ 그래서 머리 push 를 «되돌렸다». 남는 값: A/B 를 undo 하면 스크래치 사본 한 장이
     주인 없이 패널에 남는다(데이터 손실 아님 · 사용자가 지울 수 있음).
   ⇒ 제대로 고치려면 ensureHistoryCheckpoint 가 «대기 중인 sideEffects»를 실을 수 있어야 한다
     (지금은 sideEffects 를 아예 안 넣는다 — js/history.js). 그건 undo/redo 전체를 건드리므로
     별건 게이트다. 티켓 = tests/unit/scratch-paste-dup.test.js 의 BL-SPL-04.
   ⛔여기서 pushHistory 를 꼬리로 다시 옮기지 마라 — 위 실측이 그 답이다. */
  /* [#16-DUP] _installFollow 의 MutationObserver 는 #canvas-scaler 를 childList «만»(subtree 아님)
     보므로 #canvas 안에 섹션이 들어와도 안 터진다 ⇒ 사본을 넣은 뒤 한 번 직접 다시 그린다. */
  window.__spLinkRerender?.();
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
