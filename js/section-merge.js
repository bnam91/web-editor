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

  /* ★lazy 로 «내려놓은» 섹션을 먼저 되살린다.
     화면 밖으로 스크롤된 섹션은 style.backgroundImage 가 'none' 이고 원본은
     data-lazy-bg 속성에 들어 있다(io/lazy-sections.js). 그 상태로 합치면
     상자엔 'none' 이 실리고, 되살리는 주체(_restoreSection)는 .section-block 만 보므로
     아무도 상자를 복원해 주지 않는다 ⇒ 배경이 «영구» 소실된다.
     복원은 «합치기 전»에 해야 한다 — 뒤에 하면 원본 섹션이 이미 없다. */
  if (target.classList.contains('lazy-unloaded') || source.classList.contains('lazy-unloaded')) {
    window.materializeAllSections?.();
  }

  /* ★섹션 «배경이미지 편집»(★2026-10-10 이름 변경)이 켜져 있으면 «먼저» 끈다.
     그 모드는 섹션 직계에 임시 프록시(.sec-bg-proxy)를 띄우는데, 아래 KEEP_OUT 이
     «제외목록»이라 모르는 직계 자식은 전부 상자로 옮겨진다 — 편집용 DOM 이 상자 안으로
     따라 들어가고, source 는 remove 되어 편집 세션이 죽은 노드를 붙들게 된다.
     끄면 커밋(dataset.bgSize/bgPos)까지 정상적으로 끝난 뒤 합쳐진다. */
  window.exitSectionBgEditMode?.(source);
  window.exitSectionBgEditMode?.(target);

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
  /* ★분리(splitMergedPart)용 «기록»만 더한다 — 합치기 동작은 그대로(D1, 2026-10-01).
     위 루프가 버리는 섹션 이름을 따로 적어 둔다. 이 칸이 «있다»는 것 자체가 「새 합치기라 왕복 기록이 있다」는 표시다
     (그래서 이름이 없어도 빈 문자열로 «적는다»). */
  part.dataset.mergedName = source.dataset.name || '';
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
  /* ★지우는 꼬리 갭의 높이를 «기록»한다(분리 때 되살린다). 안 지웠으면 0. */
  part.dataset.mergedTailGapH = '0';
  if (tailGap && headGap?.classList.contains('gap-block')) {
    part.dataset.mergedTailGapH = String(_gapH(tailGap));
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
  //   sec-bg-proxy 는 «편집 중에만» 사는 임시 UI — 위에서 이미 껐지만, 어떤 경로로든
  //   남아 있으면 상자로 옮기지 않는다(옮기면 저장·내보내기로 새어 나갈 자리가 하나 늘어난다).
  const KEEP_OUT = ['section-hitzone', 'section-toolbar', 'section-inner', 'sec-bg-proxy'];
  [...source.children].forEach((el) => {
    if (KEEP_OUT.some(c => el.classList.contains(c))) return;
    el.dataset.mergedOuter = '1';   // ★분리용 기록 — 섹션 «직속»이었다(분리 때 섹션 바로 아래로 돌려보낸다)
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
function syncMergedPartMargins(sec, opts = {}) {
  const inner = _inner(sec);
  if (!inner) return;
  const parts = inner.querySelectorAll(':scope > .section-merged-part');
  if (!parts.length) return;
  const padX = parseFloat(inner.style.paddingLeft) || 0;
  parts.forEach(p => {
    p.style.marginLeft = -padX + 'px';
    p.style.marginRight = -padX + 'px';
    /* ★사용자가 «직접» 좌우여백을 바꾼 경우엔 아래 몸까지 같은 값으로 맞춘다.
       규칙: «저절로 일어나는 일은 보존, 사용자가 직접 한 일은 전체 적용».
         · 합치기(자동) → 여백을 안 건드린다. 내 디자인이 멋대로 바뀌면 안 되니까.
         · 슬라이더(직접) → 「이 섹션 전체를 이렇게」라는 뜻이니 아래 몸도 따라간다.
       안 그러면 슬라이더가 «위쪽 몸만» 움직여 반쪽만 먹는 것처럼 보인다. */
    if (opts.applyPadding) {
      p.style.paddingLeft = padX + 'px';
      p.style.paddingRight = padX + 'px';
      p.dataset.padX = String(padX);
      // 상자 안의 상자(중첩 합치기)까지 내려간다
      p.querySelectorAll('.section-merged-part').forEach(q => {
        q.style.marginLeft = '0px'; q.style.marginRight = '0px';
        q.style.paddingLeft = '0px'; q.style.paddingRight = '0px';
        q.dataset.padX = '0';
      });
    }
  });
}

/** 캔버스 전체 — 패딩 일괄 변경(페이지 설정) 뒤에 부른다 */
function syncAllMergedPartMargins() {
  document.querySelectorAll('.section-block').forEach(syncMergedPartMargins);
}

/** 선택된 섹션을 «바로 위» 섹션과 합친다 — ⌘⇧↑ 가 부른다 */
function mergeSelectedSectionUp() {
  /* ★여러 개를 골랐으면 «전부» 합친다.
     한때 querySelector 단수라 문서상 첫 번째 하나만, 그것도 «고르지도 않은 바로 위 섹션»과
     합쳤다. 고른 게 3·4·5 인데 2 에 3 이 들어가는 식이라 결과를 예측할 수 없었다.
     규칙: 고른 것들 중 «맨 위» 하나로 나머지를 위에서 아래 순서대로 합친다.
       고른 게 하나뿐이면 예전대로 «그 위 섹션»과 합친다. */
  const sels = [...document.querySelectorAll('.section-block.selected')];
  if (!sels.length) { window.showToast?.('합칠 섹션을 먼저 고르세요'); return false; }

  if (sels.length >= 2) {
    const target = sels[0];                       // DOM 순서상 맨 위
    let n = 0;
    for (const s of sels.slice(1)) { if (mergeSectionInto(target, s)) n++; }
    return n > 0;
  }

  const sel = sels[0];
  let prev = sel.previousElementSibling;
  while (prev && !prev.classList.contains('section-block')) prev = prev.previousElementSibling;
  if (!prev) {
    // ★조용히 무시하지 않는다 — 아무 일도 안 일어나면 고장으로 읽힌다
    window.showToast?.('맨 위 섹션입니다 — 합칠 게 없습니다');
    return false;
  }
  return mergeSectionInto(prev, sel);
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION SPLIT — 합쳐 넣은 상자(.section-merged-part)를 다시 섹션으로 (D1, 현빈 2026-10-01)
   ═══════════════════════════════════════════════════════════════════════
   ★합치기가 남긴 발판을 그대로 쓴다: 상자는 원래 섹션의 인라인 스타일·dataset 을 이어받았고
     (mergeSectionInto ⑴), position:relative 라 좌표 기준이다. ⇒ 분리 = 상자를 섹션으로 다시 세우기.
   ★순서 보존: 상자 P «와 그 뒤 형제들»을 새 섹션으로 옮긴다. P 만 빼면 P 뒤에 있던 것(나중에 합친 상자 등)이
     원 섹션에 남아 화면 순서가 뒤집힌다.
   ★왕복 기록(합치기 쪽, 2026-10-01 부터): mergedName(이름) · mergedTailGapH(지운 이음매 갭 높이) · 섹션 직속이었던
     자식의 data-merged-outer. ⛔그 전에 합친 «옛 상자»엔 기록이 없다 ⇒ 이름 없음 · 갭 100px · 섹션 직속 판정은
     «absolute 직계»로 어림 — 그렇게 했다고 토스트로 알린다.
   ★묶기는 rebindAll 한 번 — 섹션 바인딩 목록을 여기 베끼지 않는다(addSection·insertTemplate 과 두 벌이 된다).
   ★히스토리: 합치기와 같은 규약(변경 «전»에 찍는다) ⇒ ⌘Z 한 번에 원복. */
const _SPLIT_RECORD_KEYS = ['mergedFrom', 'padX', 'mergedName', 'mergedTailGapH'];
const _SPLIT_DEFAULT_GAP = 100;

function splitMergedPart(part) {
  if (!part?.classList?.contains('section-merged-part')) { window.showToast?.('합쳐진 섹션 안을 골라 주세요'); return false; }
  const hostSec = part.closest('.section-block');
  const container = part.parentElement;
  if (!hostSec || !container) return false;
  if (hostSec.classList.contains('lazy-unloaded')) window.materializeAllSections?.();
  window.exitSectionBgEditMode?.(hostSec);

  window.pushHistory?.('섹션 분리');

  const legacy = !('mergedTailGapH' in part.dataset);
  const following = [];
  for (let n = part.nextElementSibling; n; n = n.nextElementSibling) following.push(n);

  const sec = document.createElement('div');
  sec.className = 'section-block';
  const want = part.dataset.mergedFrom;
  sec.id = (want && !document.getElementById(want)) ? want
         : (typeof window.genId === 'function' ? window.genId('sec') : 'sec_' + Math.random().toString(36).slice(2, 9));
  for (const k of part.style) {
    if (/^(padding-left|padding-right|margin-left|margin-right)$/.test(k)) continue;   // 상자용으로 덧씌운 것
    sec.style.setProperty(k, part.style.getPropertyValue(k), part.style.getPropertyPriority(k));
  }
  for (const [k, v] of Object.entries(part.dataset)) if (!_SPLIT_RECORD_KEYS.includes(k)) sec.dataset[k] = v;

  // 껍데기 — 머리(hitzone)·툴바는 원 섹션 것을 본떠 기본 단추만 남긴다(상태 단추는 rebind 가 다시 심는다)
  const hz = document.createElement('div');
  hz.className = 'section-hitzone';
  hz.innerHTML = '<span class="section-label"></span>';
  const tb = hostSec.querySelector(':scope > .section-toolbar')?.cloneNode(true) || document.createElement('div');
  tb.className = 'section-toolbar';
  [...tb.children].forEach(b => { if (!b.matches?.('.st-ai-fill-btn, .st-memo-btn')) b.remove(); });

  const inner = document.createElement('div');
  inner.className = 'section-inner';
  const padX = parseFloat(part.dataset.padX) || 0;
  inner.style.paddingLeft = padX + 'px';
  inner.style.paddingRight = padX + 'px';
  inner.dataset.paddingX = String(padX);

  const outer = [];
  [...part.children].forEach(el => {
    const wasOuter = el.dataset.mergedOuter === '1' || (legacy && el.style.position === 'absolute');
    if (wasOuter) { delete el.dataset.mergedOuter; outer.push(el); }
    else inner.appendChild(el);
  });
  following.forEach(el => inner.appendChild(el));   // 순서 보존 — P 뒤 형제들도 새 섹션으로

  // 이음매 갭 되살리기 — 원 섹션 내용의 끝에
  const gapH = legacy ? _SPLIT_DEFAULT_GAP : (parseFloat(part.dataset.mergedTailGapH) || 0);
  if (gapH > 0) {
    const g = document.createElement('div');
    g.className = 'gap-block';
    g.dataset.type = 'gap';
    g.dataset.gapAuto = '1';
    g.style.height = gapH + 'px';
    g.id = typeof window.genId === 'function' ? window.genId('gb') : 'gb_' + Math.random().toString(36).slice(2, 9);
    container.appendChild(g);
  }

  sec.append(hz, tb, inner, ...outer);
  part.remove();
  hostSec.after(sec);

  // 번호·이름
  const all = [...hostSec.parentElement.querySelectorAll(':scope > .section-block')];
  all.forEach((s, i) => { s.dataset.section = i + 1; });
  const name = (!legacy && part.dataset.mergedName) || `Section ${String(all.indexOf(sec) + 1).padStart(2, '0')}`;
  sec.dataset.name = name;
  sec._name = name;
  hz.querySelector('.section-label').textContent = name;

  syncMergedPartMargins(hostSec);
  syncMergedPartMargins(sec);
  /* ⛔rebindAll() 을 옵션 없이 부르면 «히스토리를 통째로 비운다»(save-load.js — 로드·페이지전환용).
     실측: 분리 직후 len 1(초기 상태)·⌘Z 불가 — 사용자 되돌리기 기록이 사라졌다. 협업 수신과 같은 가드를 쓴다. */
  window.rebindAll?.({ preserveHistory: true });
  window._ensureProtectionButton?.(sec);
  window.bindVariationToolbarBtn?.(sec);

  document.querySelectorAll('.section-block.selected').forEach(s => s.classList.remove('selected'));
  sec.classList.add('selected');
  window.buildLayerPanel?.();
  window.scheduleAutoSave?.();
  window.showToast?.(legacy
    ? '섹션을 분리했습니다 — 예전에 합친 섹션이라 이름·이음매 여백(100px)을 기본값으로 되돌렸어요 (⌘Z 되돌리기)'
    : '섹션을 분리했습니다 (⌘Z 되돌리기)');
  return sec;
}

window.splitMergedPart       = splitMergedPart;
window.mergeSectionInto      = mergeSectionInto;
window.mergeSelectedSectionUp = mergeSelectedSectionUp;
window.canMergeSections      = canMergeSections;

window.syncMergedPartMargins    = syncMergedPartMargins;
window.syncAllMergedPartMargins = syncAllMergedPartMargins;

export {
  splitMergedPart,
  mergeSectionInto,
  mergeSelectedSectionUp,
  canMergeSections,
  syncMergedPartMargins,
  syncAllMergedPartMargins,
};
