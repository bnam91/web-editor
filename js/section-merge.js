/* ═══════════════════════════════════════════════════════════════════════
   SECTION MERGE — 아래 섹션을 «바로 위» 섹션 안으로 합친다.

   ★입구는 «⌘M» 하나다.
     editor.js 의 ⌘M 은 이미 「병합」키다 — 갭 선택이면 갭 병합, 셀 선택이면 셀 병합.
     섹션 합치기는 그 «세 번째 갈래»로 들어간다(맨 뒤 = 폴백). 새로 배울 키가 없다.
     ⚠️섹션은 블록을 고르면 같이 selected 로 남는 일이 많아서 «맨 뒤»여야 한다.
       앞에 두면 셀·갭 병합을 가로챈다.
     ⌘↑ 는 손대지 않았다 — 그건 「섹션 순서 위로」다.

   ★드래그 자석은 «두지 않는다»(현빈 판단 2026-09-03)
     ⌘ 를 눌러야 하는 순간 드래그도 「알아야 쓰는」 기능이 돼서, 자석의 유일한 장점인
     발견성이 사라진다. 반면 순서 바꾸기와 손짓이 겹치는 위험은 그대로 남는다.
     («커밋 98366c1» 에 구현본이 있다 — 되살릴 일이 있으면 거기서.)

   ★이음매 처리 — 여기가 이 기능의 핵심이다
     섹션의 위아래 여백은 CSS 가 아니라 «gap-block 블록»(기본 100px)이다.
     그래서 그냥 이어붙이면 A의 끝 100 + B의 첫 100 = 이음매에 200px 흰 여백이 남고,
     화면은 「합쳐진 것 같지 않다」. ⇒ 이음매의 gap-block «한 쌍»만 하나로 접는다(높이는 큰 쪽).
     둘 다 지우지는 않는다 — 내용이 맞붙는 건 사용자가 손으로 만들 리 없는 모양이고,
     되돌리기 전엔 뭘 잃었는지 알아채기도 어렵다.
   ═══════════════════════════════════════════════════════════════════════ */

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
  window.pushHistory?.('섹션 합치기');

  const tIn = _inner(target), sIn = _inner(source);

  /* ── 아래 섹션의 «몸»을 감싸는 상자 ──────────────────────────────────────
     그냥 블록만 옮기면 세 가지가 무너진다(실측):
       ⑴ 배경   — 아래 섹션의 배경이 통째로 사라진다
       ⑵ 좌우여백 — 위 섹션 것으로 바뀐다
       ⑶ 절대좌표 — ★좌표 기준은 .section-inner 가 아니라 «.section-block»(position:relative)이다.
                    기준이 B→A 로 갈아타서 y 307 → -76 로 튀었다.
     ⇒ 상자가 그 셋을 그대로 이어받는다. position:relative 라 «좌표 기준»도 여기서 다시 선다. */
  const part = document.createElement('div');
  part.className = 'section-merged-part';
  part.dataset.mergedFrom = source.id || '';
  // ⑴ 배경 — prop-section.js 가 쓰는 네 가지를 같이 옮긴다(이미지 배경도 살아야 한다)
  for (const k of ['background', 'backgroundColor', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat']) {
    if (source.style[k]) part.style[k] = source.style[k];
  }
  // ⑵ 좌우여백 — 상자는 «위 섹션의 패딩을 지우고» 자기 패딩을 다시 준다.
  //    안 지우면 A패딩 + B패딩 이 겹쳐 두 배로 들어간다.
  const srcPadX = sIn.dataset.paddingX !== undefined && sIn.dataset.paddingX !== ''
    ? parseFloat(sIn.dataset.paddingX)
    : (parseFloat(sIn.style.paddingLeft) || 0);
  part.dataset.padX = String(srcPadX);
  part.style.paddingLeft = srcPadX + 'px';
  part.style.paddingRight = srcPadX + 'px';
  syncMergedPartMargins(target);   // 위 섹션 패딩을 상쇄하는 음수 마진

  // ── 이음매 접기: A의 «마지막» gap 과 B의 «첫» gap 이 둘 다 gap 이면 하나로 ──
  const tailGap = tIn.lastElementChild;
  const headGap = sIn.firstElementChild;
  if (tailGap?.classList.contains('gap-block') && headGap?.classList.contains('gap-block')) {
    tailGap.style.height = Math.max(_gapH(tailGap), _gapH(headGap)) + 'px';
    headGap.remove();
  }

  // ── 내용 이동: 순서 그대로, 상자 안으로 ──
  while (sIn.firstChild) part.appendChild(sIn.firstChild);
  tIn.appendChild(part);
  syncMergedPartMargins(target);   // 붙인 뒤 한 번 더(상자가 이제 DOM 에 있다)
  source.remove();

  // ── 뒷정리 ──
  document.querySelectorAll('.section-block.selected').forEach(s => s.classList.remove('selected'));
  target.classList.add('selected');
  target.classList.add('section-merge-flash');
  setTimeout(() => target.classList.remove('section-merge-flash'), 600);

  window.buildLayerPanel?.();
  window.scheduleAutoSave?.();
  window.showToast?.('섹션을 합쳤습니다 (⌘Z 되돌리기)');
  return true;
}

/**
 * 합쳐 넣은 상자들의 «음수 마진»을 그 섹션의 현재 좌우 패딩에 맞춘다.
 * ★섹션 좌우 패딩이 나중에 바뀌면 상자도 따라와야 한다 — 안 그러면 아래쪽 몸만 어긋난다.
 *   그래서 패딩을 바꾸는 화면(prop-section·prop-page)에서 이 함수를 부른다.
 */
function syncMergedPartMargins(sec) {
  const inner = _inner(sec);
  if (!inner) return;
  const parts = inner.querySelectorAll(':scope > .section-merged-part');
  if (!parts.length) return;
  const padX = parseFloat(inner.style.paddingLeft) || 0;
  parts.forEach(p => {
    p.style.marginLeft = -padX + 'px';
    p.style.marginRight = -padX + 'px';
  });
}

/** 캔버스 전체 — 패딩 일괄 변경(페이지 설정) 뒤에 부른다 */
function syncAllMergedPartMargins() {
  document.querySelectorAll('.section-block').forEach(syncMergedPartMargins);
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

window.mergeSectionInto      = mergeSectionInto;
window.mergeSelectedSectionUp = mergeSelectedSectionUp;
window.canMergeSections      = canMergeSections;

window.syncMergedPartMargins    = syncMergedPartMargins;
window.syncAllMergedPartMargins = syncAllMergedPartMargins;

export {
  mergeSectionInto,
  mergeSelectedSectionUp,
  canMergeSections,
  syncMergedPartMargins,
  syncAllMergedPartMargins,
};
