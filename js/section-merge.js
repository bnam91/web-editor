/* ═══════════════════════════════════════════════════════════════════════
   SECTION MERGE — 아래 섹션을 «바로 위» 섹션 안으로 합친다.

   입구는 둘, 하는 일은 하나:
     ⑴ 자석  — 라벨을 끌어 위 섹션 «밑단»에 대면 이음매가 초록으로 뜨고, 놓으면 합쳐진다
     ⑵ 단축키 — 섹션을 고르고 ⌘⇧↑

   ★단축키가 왜 ⌘↑ 가 아닌가
     ⌘↑ 는 이미 «섹션 순서 위로»다(editor.js). 같은 키에 두 뜻은 못 얹는다.
     그래서 합치기는 ⌘⇧↑ 로 두고, editor.js 의 기존 분기엔 !e.shiftKey 가드를 넣었다.

   ★이음매 처리 — 여기가 이 기능의 핵심이다
     섹션의 위아래 여백은 CSS 가 아니라 «gap-block 블록»(기본 100px)이다.
     그래서 그냥 이어붙이면 A의 끝 100 + B의 첫 100 = 이음매에 200px 흰 여백이 남고,
     화면은 「합쳐진 것 같지 않다」. ⇒ 이음매의 gap-block «한 쌍»만 하나로 접는다(높이는 큰 쪽).
     둘 다 지우지는 않는다 — 내용이 맞붙는 건 사용자가 손으로 만들 리 없는 모양이고,
     되돌리기 전엔 뭘 잃었는지 알아채기도 어렵다.
   ═══════════════════════════════════════════════════════════════════════ */

/* 드래그 중 «합치기»로 걸리는 띠 — 대상 섹션 아래쪽 이만큼.
   ★캔버스 배율(40% 등) 보정을 «따로 하지 않는다». getBoundingClientRect() 가 이미 화면
     좌표라, rect 기준으로만 재면 보정이 저절로 된다. 여기서 또 나누면 이중보정으로 틀어진다. */
const MERGE_BAND_PX    = 28;
const MERGE_BAND_RATIO = 0.25;   // 낮은 섹션에서 띠가 섹션을 다 먹지 않도록

function _inner(sec) { return sec?.querySelector(':scope > .section-inner'); }

function _gapH(el) {
  if (!el) return 0;
  return parseFloat(el.style.height) || el.offsetHeight || 0;
}

/** 합칠 수 있나 — {ok, reason} */
function canMergeSections(target, source) {
  if (!target || !source)          return { ok: false, reason: '섹션을 찾지 못했습니다' };
  if (target === source)           return { ok: false, reason: '같은 섹션입니다' };
  if (!_inner(target) || !_inner(source)) return { ok: false, reason: '섹션 구조가 아닙니다' };
  if (target.parentElement !== source.parentElement) return { ok: false, reason: '다른 캔버스의 섹션입니다' };
  // variation(A/B안) 그룹은 «묶음»으로 움직이는 것들이라 합치면 그룹이 깨진다
  if (target.dataset.variationGroup || source.dataset.variationGroup)
    return { ok: false, reason: '변형(A/B안) 섹션은 합칠 수 없습니다' };
  return { ok: true };
}

/**
 * source 의 내용을 target 안으로 옮기고 source 를 없앤다.
 * 살아남는 건 «위(target)» — id·이름·배경·프리셋·좌우패딩 전부 target 것.
 * @returns {boolean} 합쳤으면 true
 */
function mergeSectionInto(target, source) {
  const gate = canMergeSections(target, source);
  if (!gate.ok) { window.showToast?.(gate.reason); return false; }

  // ★변경 «전»에 찍는다 — 이 레포의 드롭 핸들러 관례이고, tip 상태는 undo 진입 시
  //   ensureHistoryCheckpoint 가 늦게 담으므로 이걸로 ⌘Z 한 번에 완전 복원된다.
  // 장식이 «내용으로» 딸려가지 않게 먼저 턴다(드롭 경로에선 이미 지웠지만 단축키 경로 방어)
  clearMergeAffordance();
  window.pushHistory?.('섹션 합치기');

  const tIn = _inner(target), sIn = _inner(source);

  // 버려지는 것을 «미리» 세어 둔다 — 합친 뒤엔 비교할 원본이 없다
  const lostBg  = (source.style.background || source.style.backgroundColor || '').trim();
  const keptBg  = (target.style.background || target.style.backgroundColor || '').trim();
  const bgDiffers  = !!lostBg && lostBg !== keptBg;
  const padDiffers = (sIn.style.paddingLeft || '') !== (tIn.style.paddingLeft || '');

  // ── 이음매 접기: A의 «마지막» gap 과 B의 «첫» gap 이 둘 다 gap 이면 하나로 ──
  const tailGap = tIn.lastElementChild;
  const headGap = sIn.firstElementChild;
  if (tailGap?.classList.contains('gap-block') && headGap?.classList.contains('gap-block')) {
    tailGap.style.height = Math.max(_gapH(tailGap), _gapH(headGap)) + 'px';
    headGap.remove();
  }

  // ── 내용 이동: 순서 그대로 ──
  while (sIn.firstChild) tIn.appendChild(sIn.firstChild);
  source.remove();

  // ── 뒷정리 ──
  document.querySelectorAll('.section-block.selected').forEach(s => s.classList.remove('selected'));
  target.classList.add('selected');
  target.classList.add('section-merge-flash');
  setTimeout(() => target.classList.remove('section-merge-flash'), 600);

  window.buildLayerPanel?.();
  window.scheduleAutoSave?.();

  // ★버린 걸 «말한다». 조용히 버리면 나중에 원인을 못 찾는다.
  const lost = [];
  if (bgDiffers)  lost.push('배경색');
  if (padDiffers) lost.push('좌우 여백');
  window.showToast?.(
    lost.length
      ? `섹션을 합쳤습니다 — 아래 섹션의 ${lost.join('·')}은 사라집니다 (⌘Z 되돌리기)`
      : '섹션을 합쳤습니다 (⌘Z 되돌리기)'
  );
  return true;
}

/** 선택된 섹션을 «바로 위» 섹션과 합친다 — ⌘⇧↑ 가 부른다 */
function mergeSelectedSectionUp() {
  const sel = document.querySelector('.section-block.selected');
  if (!sel) { window.showToast?.('합칠 섹션을 먼저 고르세요'); return false; }
  let prev = sel.previousElementSibling;
  while (prev && !prev.classList.contains('section-block')) prev = prev.previousElementSibling;
  if (!prev) {
    // ★조용히 무시하지 않는다 — 아무 일도 안 일어나면 고장으로 읽힌다
    window.showToast?.('맨 위 섹션입니다 — 합칠 게 없습니다');
    return false;
  }
  return mergeSectionInto(prev, sel);
}

/* ── 자석: 드래그 중 «어느 섹션의 밑단»에 걸렸는지 ─────────────────────── */

/**
 * @param {HTMLElement} canvasEl
 * @param {number} clientY  포인터 화면 Y
 * @param {HTMLElement} dragging  끌고 있는 섹션(대상에서 제외)
 * @returns {HTMLElement|null} 합칠 «위» 섹션
 */
function findMergeTarget(canvasEl, clientY, dragging) {
  const secs = [...canvasEl.querySelectorAll(':scope > .section-block')];
  for (const sec of secs) {
    if (sec === dragging) continue;
    if (!canMergeSections(sec, dragging).ok) continue;
    const r = sec.getBoundingClientRect();
    // 아래쪽 띠 — 섹션이 낮으면 비율로 줄여 섹션을 다 먹지 않게
    const band = Math.min(MERGE_BAND_PX, r.height * MERGE_BAND_RATIO);
    if (clientY >= r.bottom - band && clientY <= r.bottom + band) return sec;
  }
  return null;
}

/** 초록 이음매 표시 — 순서 인디케이터와 «동시에» 보이면 안 된다 */
function showMergeAffordance(sec) {
  if (!sec) { clearMergeAffordance(); return; }
  clearMergeAffordance(sec);                       // sec «말고» 다른 데 붙은 건 뗀다
  // ★dragover 는 «같은 대상에 매 프레임» 들어온다. 이미 온전히 붙어 있으면 손대지 않는다 —
  //   매번 지웠다 다시 그리면 초록이 깜빡인다.
  if (sec.classList.contains('section-merge-target')
      && sec.querySelector(':scope > .section-merge-seam')
      && sec.querySelector(':scope > .section-merge-chip')) return;
  sec.querySelectorAll(':scope > .section-merge-chip, :scope > .section-merge-seam').forEach(n => n.remove());
  sec.classList.add('section-merge-target');
  const seam = document.createElement('div');
  seam.className = 'section-merge-seam';
  sec.appendChild(seam);
  const chip = document.createElement('div');
  chip.className = 'section-merge-chip';
  chip.textContent = '놓으면 합쳐집니다 · ⌘⇧↑';
  sec.appendChild(chip);
}

/** @param {HTMLElement} [except] 이 섹션은 «건드리지 않는다» */
function clearMergeAffordance(except) {
  // ★한때 여기서 except 의 장식까지 지웠다 — 「빼놓을 대상」을 오히려 벗기는 꼴이라
  //   같은 자리에 계속 올려두면 초록이 매 프레임 사라졌다 나타났다 했다(2026-09-03 실측).
  document.querySelectorAll('.section-block.section-merge-target').forEach(s => {
    if (s === except) return;
    s.classList.remove('section-merge-target');
    s.querySelectorAll(':scope > .section-merge-chip, :scope > .section-merge-seam').forEach(n => n.remove());
  });
  // 클래스는 없는데 장식만 남은 «고아»도 턴다(except 는 제외)
  document.querySelectorAll('.section-merge-chip, .section-merge-seam').forEach(n => {
    if (except && n.parentElement === except) return;
    if (!n.parentElement?.classList.contains('section-merge-target')) n.remove();
  });
}

window.mergeSectionInto      = mergeSectionInto;
window.mergeSelectedSectionUp = mergeSelectedSectionUp;
window.canMergeSections      = canMergeSections;

export {
  mergeSectionInto,
  mergeSelectedSectionUp,
  canMergeSections,
  findMergeTarget,
  showMergeAffordance,
  clearMergeAffordance,
};
