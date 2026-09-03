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
  /* ⑴ 섹션이 «이고 있던 것»을 통째로 옮긴다.
     ★한때 목록을 손으로 적었다가 세 가지를 잃었다(독립 검수 3인 지적, 실측 확인):
       · backgroundImage — 「이미지만」 배경은 shorthand 가 아니라 longhand 라
         style.background 가 빈 문자열이다. 목록에 없으면 «아무것도» 안 옮겨진다.
       · --preset-* 인라인 CSS 변수 + dataset.preset — 프리셋(Dark 등)의 글자색·글꼴이
         전부 위 섹션 것으로 바뀐다. 어두운 배경 + 검은 글자가 된다.
       · dataset.bgImg / bgSize / bgPos — 재로드 시 배경을 되살리는 «정본»이다.
     ⇒ 손으로 적은 «허용목록»을 버리고, 인라인 스타일과 dataset 을 «전부» 옮긴다.
       모르는 속성이 나중에 생겨도 안 잃는다. */
  for (const k of source.style) {                       // 인라인으로 «실제로 적힌» 것만 순회
    if (k === 'padding-bottom' || k.startsWith('padding')) continue;   // 여백은 아래에서 따로
    part.style.setProperty(k, source.style.getPropertyValue(k), source.style.getPropertyPriority(k));
  }
  for (const [k, v] of Object.entries(source.dataset)) {
    if (k === 'name' || k === 'variation' || k === 'variationGroup') continue;  // 섹션 «신원»은 안 옮긴다
    part.dataset[k] = v;
  }
  // 아래쪽 여백은 섹션이 이고 있던 것 — 상자가 이어받아야 밑 공간이 안 사라진다
  if (source.style.paddingBottom) part.style.paddingBottom = source.style.paddingBottom;

  /* ★인라인 배경이 «없는» 섹션도 흰색이다 — .section-block { background:#fff } (editor-canvas.css).
     그냥 두면 위 섹션이 네이비일 때 아래 몸이 네이비로 물든다.
     이 레포가 이미 두 번 밟고 주석까지 남긴 함정이다(export-image.js·export-figma-json.js). */
  if (!part.style.background && !part.style.backgroundColor && !part.style.backgroundImage) {
    const computed = window.getComputedStyle(source).backgroundColor;
    if (computed && computed !== 'rgba(0, 0, 0, 0)' && computed !== 'transparent') {
      part.style.backgroundColor = computed;
    }
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

  /* ── 이음매 접기 ────────────────────────────────────────────────────
     ★지우는 쪽은 «위 섹션의 꼬리 갭»이다. 아래 섹션의 «머리 갭»은 건드리지 않는다.
       한때 반대로 했다가 절대배치 요소가 내용 대비 44px 어긋났다(실측, 실제 프로젝트).
       이유: 상자는 아래 섹션의 «내용 시작점»에 원점을 세운다. 머리 갭을 지우면 그 원점이
       원래 .section-block top 과 달라져, top:342px 같은 좌표가 통째로 어긋난다.
       꼬리 갭(위 섹션 것)은 위 섹션 «내용 뒤»에 있어 아무 좌표의 기준도 아니다 — 지워도 안전하다. */
  /* ★«마지막 자식»이 아니라 «마지막 여백»을 찾아야 한다.
     2회차부터는 위 섹션의 마지막 자식이 이미 .section-merged-part(=먼저 합친 몸)라
     lastElementChild 로는 갭 판정이 실패하고, 이음매에 100+100=200px 이 그대로 남았다.
     (실측: 1회차 0px / 2회차 200px — 이 기능의 «핵심»이 두 번째부터 안 돌았다.)
     ⇒ 상자를 «뚫고» 내려가 진짜 마지막 여백을 찾는다. */
  const _lastGap = (el) => {
    let cur = el;
    while (cur) {
      const last = cur.lastElementChild;
      if (!last) return null;
      if (last.classList.contains('gap-block')) return last;
      if (last.classList.contains('section-merged-part')) { cur = last; continue; }
      return null;
    }
    return null;
  };
  const tailGap = _lastGap(tIn);
  const headGap = sIn.firstElementChild;
  if (tailGap && headGap?.classList.contains('gap-block')) {
    tailGap.remove();
  }

  // ── 내용 이동: 순서 그대로, 상자 안으로 ──
  while (sIn.firstChild) part.appendChild(sIn.firstChild);
  tIn.appendChild(part);

  /* ★.section-inner «밖»에 사는 것들도 옮긴다 — 스티커가 여기 산다.
     .section-block 의 직계 자식이라 inner 만 옮기면 «섹션과 함께 지워진다»
     (실측: 스티커 2개 → 1개. 현빈이 「스티커 넣고도 되냐」고 물어봐서 드러났다).
     ⚠️허용목록이 아니라 «제외목록»으로 옮긴다 — 모르는 블록이 새로 생겨도 안 잃는다.
       hitzone·toolbar 는 섹션마다 하나씩 있는 UI라 두고 온다.
     좌표는 절대배치라 상자(position:relative)가 새 기준이 되어 준다. */
  const KEEP_OUT = ['section-hitzone', 'section-toolbar', 'section-inner'];
  [...source.children].forEach((el) => {
    if (KEEP_OUT.some(c => el.classList.contains(c))) return;
    part.appendChild(el);
  });
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
