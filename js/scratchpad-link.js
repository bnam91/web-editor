// scratchpad-link.js — #16 스크래치패드 참고이미지 ↔ 섹션 «노드연결»
//
// [P1 = 데이터 계층]  연결정보의 단일 진실원 = «섹션 DOM 의 data 속성».
//   · sec.dataset.refLinks = "s_1:0,s_2:1"   (scratchId:collapsedFlag, 콤마 구분)
//        - collapsedFlag: 0=펼침, 1=접힘.  값 없거나 속성 자체가 없으면 = 링크 0.
//   · ★왜 «섹션 data 속성»인가(설계 피벗, 지디 승인):
//        - canvas HTML 에 실려 serializeCleanRoot(임의 data-* 보존) → proj.json 저장/로드,
//          undo/redo, 협업 재렌더가 «전부 기존 캔버스 스냅샷 기계»로 자동 처리된다.
//          (외부 page.imageLinks + history sideEffects 경로는 undo() 의 ensureHistoryCheckpoint 가
//           «캔버스 변경(섹션삭제)» 시 SE 없는 '현재상태' 엔트리를 leaving snap 으로 끼워넣어
//           onUndo 가 안 불리는 근본 충돌이 있어 폐기 — 계측으로 확인.)
//        - ★#11 태그(sec.dataset.tags + bindSectionHitzone 재렌더)와 «동일 검증패턴».
//   · ★이미지 실체는 ScratchPadDB(scratch-pad-<pid>-<pageId>) 에 그대로 — refLinks 는 scratchId 참조만.
//     연결/해제/섹션삭제 모두 이미지 데이터를 절대 안 건드린다(_scratchRemoveById/_scratchAddAndSave 호출 0).
//   · 섹션 삭제 = sec.remove() 하나로 dataset.refLinks 동반삭제 + canvas 스냅샷 undo 가 섹션+refLinks
//     동시복원(특수 훅 불필요). 해제 시 그 이미지는 스크래치 pane 필터 해제로 자동 복귀(P2).
//   · undo = «표준 pushHistory(변경 전) + 변경» 패턴(block-factory 와 동일). SE 불필요.
//
// [P2+] 오버레이 렌더(사이드카/edges/positionTops)·연결 UX·fold/compare 는 후속 단계에서
//   window.__spLinkRerender() 훅에 주입. 이 파일은 데이터 CRUD + 그 훅 호출까지만.
//
// ★설계 «의도»: 배송본에서는 refLinks 를 strip 한다(死참조 = 배송본 쓰레기) — 저장경로엔 유지.
//   strip 은 export 경로 파일에서 처리(이 파일 아님).
// ⛔★2026-09-09 실측 정정 — 위 문장은 「HTML/figma/.gdt 에서는 strip 한다」고 «주장»했는데,
//   실제로 벗기는 곳은 «하나»뿐이다. 그건 안심을 주는 문장이라 경고 부재보다 나쁘다.
//     js/io/export-html.js:114   removeAttribute('data-ref-links')   ← 유일
//     js/io/export-figma-json.js  0건 (⚠️dataset 을 «필드별»로 골라 읽어 안 실을 «수도» 있다 — 안 쟀다)
//     .gdt (main/gdt/export.js)   0건 (project.json 을 그대로 담는다 ⇒ pages[].canvas 에 실린다)
//     템플릿 저장(js/panels/template-system.js) 0건
//       ↳ [SP1 2026-10-03] 템플릿은 이제 «삽입 때»·«등록 클론에서» SPLink.stripTokens 로 토큰을 벗긴다 — 현빈 확정
//         「템플릿에서 새로 들어오는 건 스크래치 없이」. 리터럴 removeAttribute 가 아니라 이 파일의 ATTR 로 벗기므로
//         아래 R1 명부(리터럴 strip 채널)는 그대로다. 라이브 섹션엔 안 부른다(원본 링크 보존).
//       ↳ serializeCleanRoot 는 선택 마커·contenteditable 은 «다» 벗기지만 refLinks 는 «안» 벗긴다(실측).
//   ⇒ 「템플릿·.gdt 가 배송인가 저장인가」는 «판단»이 필요해 안 고쳤다.
//     티켓 = _context/BACKLOG-reflinks-strip-channels.md · 집행 = tests/unit/reflinks-strip-channels.test.js

(function () {
  'use strict';

  const ATTR = 'refLinks'; // dataset key → data-ref-links

  // ── 섹션/파싱 ────────────────────────────────
  function _secEl(secId) {
    const el = typeof secId === 'string' ? document.getElementById(secId) : secId;
    return el && el.classList && el.classList.contains('section-block') ? el : null;
  }
  function _allSecs() { return [...document.querySelectorAll('.section-block')]; }

  // "s_1:0,s_2:1" → [{scratchId:'s_1',collapsed:false}, ...]
  function _parse(sec) {
    if (!sec) return [];
    const raw = sec.dataset[ATTR];
    if (!raw) return [];
    return raw.split(',').map(tok => tok.trim()).filter(Boolean).map(tok => {
      const i = tok.lastIndexOf(':');
      if (i < 0) return { scratchId: tok, collapsed: false };
      return { scratchId: tok.slice(0, i), collapsed: tok.slice(i + 1) === '1' };
    }).filter(l => l.scratchId);
  }
  // [{scratchId,collapsed}] → dataset 쓰기(빈 배열이면 속성 제거)
  function _write(sec, arr) {
    if (!sec) return;
    if (!arr || !arr.length) { delete sec.dataset[ATTR]; return; }
    sec.dataset[ATTR] = arr.map(l => l.scratchId + ':' + (l.collapsed ? '1' : '0')).join(',');
  }

  function _rerender() { try { window.__spLinkRerender && window.__spLinkRerender(); } catch (_) {} }
  function _save()     { try { window.scheduleAutoSave && window.scheduleAutoSave(); } catch (_) {} }

  // ── 조회 ────────────────────────────────
  function linksForSection(secId) { return _parse(_secEl(secId)); }
  function sectionIdOf(scratchId) {
    for (const sec of _allSecs()) if (_parse(sec).some(l => l.scratchId === scratchId)) return sec.id;
    return null;
  }
  function isLinked(scratchId) { return sectionIdOf(scratchId) !== null; }
  function linkedScratchIds() {
    const out = [];
    for (const sec of _allSecs()) for (const l of _parse(sec)) out.push(l.scratchId);
    return out;
  }
  function allLinks() {
    const out = [];
    for (const sec of _allSecs()) for (const l of _parse(sec)) out.push({ sectionId: sec.id, scratchId: l.scratchId, collapsed: l.collapsed });
    return out;
  }

  // ── 사용자 액션(표준 pushHistory = 변경 전 스냅) ────────────────────────────────
  // 연결: 스크래치 이미지 → 섹션. 이미 다른 섹션에 연결돼 있으면 «옮긴다»(이미지당 1섹션).
  function addLink(sectionId, scratchId) {
    const target = _secEl(sectionId);
    if (!target || !scratchId) return false;
    const curSecId = sectionIdOf(scratchId);
    if (curSecId === target.id) return false; // 이미 이 섹션에 연결됨 = no-op
    window.pushHistory && window.pushHistory('참고이미지 연결'); // 변경 «전» 캔버스 스냅(undo 타겟)
    // 기존 섹션에서 제거(옮기기)
    if (curSecId) {
      const old = _secEl(curSecId);
      _write(old, _parse(old).filter(l => l.scratchId !== scratchId));
    }
    const arr = _parse(target);
    arr.push({ scratchId, collapsed: false });
    _write(target, arr);
    // #16 follow — 새 섹션 기준으로 오프셋을 다시 잡아야 하므로 옛 앵커를 버린다.
    //   (다음 추종 프레임이 «현재 보이는 자리»에서 linkDy를 유도 → 연결 순간 이미지는 안 움직인다.)
    _clearAnchor(scratchId);
    _rerender(); _save();
    _emitSplChanged();
    return true;
  }
  /* ★[#16-G] 여러 장을 «한 걸음»으로 연결한다 — 그룹을 연결하면 ⌘Z 가 멤버 수만큼 쌓이던 것을 닫는다
   *   (실측 2026-10-09: 5장 그룹을 🔗→섹션 클릭으로 걸면 ⌘Z 가 ★5걸음이었다).
   * ★꼴은 `linkToNewSection` 이 이미 쓰는 그것이다 — 「변경 전」을 ★한 번 찍고, 안쪽 입구의 칸을
   *   노옵으로 막고, 끝에 되돌린다(규약 ①「pushHistory 는 «부를 때» 읽는다」가 이 자리를 보장한다).
   *   ⛔pushHistory 를 미리 변수로 잡지 마라(같은 규약).
   * ⚠️하나도 안 바뀌면 그 한 칸은 «헛돈다» — `linkToNewSection` 이 같은 성질을 같은 말로 적어 뒀다.
   *   ⇒ ★먼저 «바뀔 것이 있나»를 보고 없으면 칸을 아예 안 찍는다(여긴 쌀 수 있다).
   * @returns {number} 실제로 연결된 개수 */
  function addLinks(sectionId, scratchIds) {
    const target = _secEl(sectionId);
    if (!target) return 0;
    const list = (scratchIds || []).filter(Boolean).filter(id => sectionIdOf(id) !== target.id);
    if (!list.length) return 0;
    window.pushHistory && window.pushHistory('참고이미지 연결');   // ★「변경 전」 = 이 제스처의 ⌘Z 과녁
    const origPush = window.pushHistory;
    window.pushHistory = () => {};                                 // ★안쪽 입구들의 칸을 막는다
    let n = 0;
    try { for (const id of list) if (addLink(target.id, id)) n++; }
    finally { window.pushHistory = origPush; }                     // 규약 ② — 던져도 되돌린다
    /* ★★「끝 표본」 — ⛔빼면 «이음매»가 뚫린다(js/CLAUDE.md 의 ⑴ before→after).
       실측 2026-10-09: 이 줄이 없으면 ㉠ 앞 표본이 «무변화 중복 차단»에 걸려 아예 안 쌓이고
       (직전 조작이 끝 표본을 찍어 꼭대기 = 지금 화면), ㉡ 연결한 상태가 ★한 번도 스택에 안 남아
       ㉢ «다음 조작»의 ⌘Z 가 연결까지 같이 먹는다. 잰 값: 당기고 ⌘Z 한 번에 토큰 5→★0,
       지웠다 되살린 뒤 선 2→★1. ⇒ 연결이 «일어났다»를 스택에 적는다.
       ★선례 = `linkToNewSection` 의 「참고이미지 → 새 섹션 완료」· js/insert-history.js 의 끝 표본. */
    if (n) window.pushHistory && window.pushHistory('참고이미지 연결 완료');
    return n;
  }
  /* 해제: refLinks 에서 제거(이미지는 스크래치에 그대로 → pane 자동복귀).
   * ★[#16-G] 그룹이면 ★묶음 전부를 «한 번에·한 걸음으로» 끊는다 — 현빈 2026-10-09 ④
   *   「지금은 링크선을 각각 모두 언링크해줘야되는데 이게 잘못된듯해」(실측: 5장 그룹에 ⛓ 5번).
   *   선이 하나인데 끊기가 다섯 번이면 ★보이는 것과 할 일이 어긋난다.
   * ⛔한 장일 때는 토큰 하나만 지운다 = 오늘과 같다(묶음이 곧 자기 하나). */
  function removeLink(scratchId) {
    const unit = _unitOf(scratchId);
    if (!unit) return false;
    window.pushHistory && window.pushHistory('참고이미지 연결 해제');
    const sec = _secEl(unit.sectionId);
    const kill = new Set(unit.ids);
    _write(sec, _parse(sec).filter(l => !kill.has(l.scratchId)));
    unit.ids.forEach(_clearAnchor); // 해제 = 다시 완전 자유(오프셋 폐기)
    _rerender(); _save();
    _emitSplChanged();
    /* ★「끝 표본」 — addLinks 와 ★같은 까닭이다(위 주석). 한쪽만 찍으면 끊기는 다음 조작의
       ⌘Z 에 같이 먹힌다. ⛔「연결만 고치고 해제는 두자」로 반쪽만 고치지 마라. */
    window.pushHistory && window.pushHistory('참고이미지 연결 해제 완료');
    return true;
  }
  /* ★링크 «상태»가 바뀌었다고 알린다 — 개수(연결/해제)든 접힘이든 «둘 다» 이 하나로 쏜다.
       이 파일의 상태를 «보여주는» 화면이 낡은 채 남으면 그건 거짓말이 된다. 여기가 진실의 출처다.
     듣는 쪽(js/props/prop-page.js 의 _splSync)은 allLinks() 로 개수와 접힘을 «같이» 다시 읽어서
     무엇이 바뀌었는지 구분하지 않는다 ⇒ 이벤트를 쪼갤 이유가 없다.
     ⛔이름을 다시 좁히지 마라(예전 이름 gdt:spl-collapse-changed). addLink 는 링크를 옮길 때
       collapsed 를 false 로 되돌리므로 «접힘 전용»이 아니었다 — 반쯤 맞는 이름이 제일 위험하다.
       틀린 이름은 누가 고치지만 반쯤 맞는 이름은 아무도 의심하지 않는다.
     ⛔본체 로직은 건드리지 않는다 — 알림 한 줄만 더한다.
   ★★undo/redo 는 이 이벤트를 «지나지 않는다».
     js/history.js:240 undo() / :263 redo() 는 캔버스 DOM 스냅샷을 통째로 되돌리는데,
     refLinks 가 섹션 data 속성이라 그 스냅샷에 실려 있다(설계 의도대로) ⇒ addLink·setCollapsed 를
     «거치지 않고» 링크 상태가 바뀐다. 그래서 ⌘Z 뒤엔 패널의 개수·.active 가 낡은 채 남는다.
     막으려면 undo()/redo() 뒤에 이 이벤트를 한 번 쏘면 된다.
     ⇒ ★이번 라운드 범위 밖이라 «일부러» 안 했다. 빠뜨린 게 아니다. */
  function _emitSplChanged() {
    try { window.dispatchEvent(new CustomEvent('gdt:spl-changed')); } catch (_) {}
  }
  /* 접기/펼치기(경량 — history 없이 상태만·저장은 함; reload 는 dataset 로 유지)
   * ★[#16-G] 그룹이면 ★묶음 전부를 같이 접고 편다 — 선이 하나인데 접히는 것이 한 장뿐이면
   *   그 손잡이는 «어느 장의 것인지» 화면에서 알 수 없다(실측: 5장 그룹에서 － 한 번 = 1장만 접힘). */
  function setCollapsed(scratchId, val) {
    const unit = _unitOf(scratchId);
    if (!unit) return false;
    const sec = _secEl(unit.sectionId);
    const arr = _parse(sec);
    const want = !!val;
    const mine = new Set(unit.ids);
    let hit = 0;
    for (const l of arr) if (mine.has(l.scratchId) && l.collapsed !== want) { l.collapsed = want; hit++; }
    if (!hit) return false;
    _write(sec, arr);
    _rerender(); _save();
    _emitSplChanged();
    return true;
  }
  /* 일괄 접기/펼치기 — 페이지 전역(현재 캔버스의 모든 링크). → { changed, total }
     ★setCollapsed 를 루프로 부르지 «않는다». 그 안에서 매번 _rerender() 를 하는데
       그건 디바운스가 아니라 직통이고, _applyCollapsed 가 매 회 allLinks()(전 섹션 파싱)를
       돌기 때문에 N번이면 O(N²) 파싱이 된다. 여기서는 섹션마다 _parse/_write 를 «각 1회»만
       하고, 다시 그리기·저장은 루프가 «끝난 뒤» 한 번만 한다.
     ★changed===0 이면 아무것도 안 그리고 안 저장한다 — 안 바뀐 것을 다시 그릴 이유가 없다.
       (호출자는 changed 로 「이미 전부 접혀 있다」를 말할 수 있다. total 은 그 문장의 분모다.)
     ★pushHistory 는 «한다» — 개별 setCollapsed 와 갈리는 지점이다.
       개별은 한 번 더 누르면 되돌아가지만 일괄은 N개를 손으로 되돌려야 한다.
       refLinks 는 섹션 data-* 라 캔버스 스냅샷에 이미 실린다 ⇒ addLink/removeLink 와 같은
       «표준 pushHistory(변경 전) + 변경» 패턴이면 추가 기계 없이 undo 가 된다. */
  function setCollapsedAll(val) {
    const want = !!val;
    const secs = _allSecs();
    let total = 0, changed = 0;
    const pending = [];                       // [sec, arr] — 실제로 바뀐 섹션만
    for (const sec of secs) {
      const arr = _parse(sec);
      if (!arr.length) continue;
      total += arr.length;
      let hit = 0;
      for (const l of arr) if (l.collapsed !== want) { l.collapsed = want; hit++; }
      if (hit) { changed += hit; pending.push([sec, arr]); }
    }
    if (!changed) return { changed: 0, total };
    window.pushHistory && window.pushHistory(want ? '참고이미지 전부 접기' : '참고이미지 전부 펼치기');
    for (const [sec, arr] of pending) _write(sec, arr);
    /* ★접으면 아이템 «높이»가 바뀌는데, _applyFollow 는 섹션 top 이 그대로면 통째로 건너뛴다.
         그러면 1섹션:N 겹침 stack 이 옛 높이로 남아 겹치거나 빈칸이 생긴다.
         resyncFollow() 가 lastTop 을 무효화해 다음 프레임에 1회 재적용시킨다(이미 쓰는 관례). */
    resyncFollow();
    _rerender(); _save();
    _emitSplChanged();
    return { changed, total };
  }

  // ═══════════════════════════════════════════════════════════════════
  // [#16-DEL] 「링크된 섹션을 지우면 스크래치패드도 «같이» 지운다」
  //   현빈 2026-09-09 (★정정 — 처음엔 「물어라」였는데 알럿을 직접 보고 「그냥 같이 삭제」로 바꿨다.
  //   ⛔확인 대화상자를 다시 들이지 마라: `confirm` 호출 0건이 계약이다. 집행 = D4)
  //
  // ★★단 하나의 예외 = 「남이 쓰는 스크래치패드」.
  //   한 이미지를 «두 섹션»이 링크한 상태에서 한쪽만 지웠는데 이미지를 지우면
  //   남은 섹션의 refLinks 토큰이 死참조가 된다 — 화면엔 링크가 있다고 적혀 있는데 그림이 없다.
  //   ⇒ ★참조가 «0일 때만» 지운다. 그리고 그 수는 ⛔손으로 적지 않는다:
  //     `[data-ref-links]` 를 가진 섹션 «전수»를 훑어 «기계가» 센다(_holderSecs → refCount).
  //     («링크를 쥐고 있다»의 유일한 표식이 그 속성이다. .section-block 목록을 따로 적으면
  //      그 목록이 낡는 날 조용히 틀린다.)
  //
  // ★★순서가 «계약»이면서 동시에 «분모를 만든다» — ①링크 끊기 → ②고아만 삭제 → 호출자가 ③섹션 제거.
  //   ①을 먼저 하기 «때문에» ② 시점의 `[data-ref-links]` 에 남는 것이 정확히
  //   「이 삭제와 무관하게 그 이미지를 아직 쓰는 섹션」이 된다. 순서를 바꾸면 지우는 섹션이
  //   자기 자신을 세어 «항상 참조 ≥1» 이 되고, 고아가 하나도 안 지워진다.  ⛔거꾸로 하지 마라.
  //
  // ★왜 removeLink() 를 «안» 쓰나 — 그건 호출마다 pushHistory 를 따로 쌓는다. 섹션 삭제와
  //   합치면 ⌘Z 가 «두 번»으로 쪼개져 「한 번 눌렀는데 섹션만 돌아온다」가 된다.
  //   js/scratch-pad.js `_severLinks` 가 «같은 이유»로 dataset 을 직접 고친다 — 같은 관례를 쓴다.
  //
  // ★★undo 는 «데이터 손실 방지선»이다 — 이제 이미지가 «말없이» 지워지므로.
  //   이미지는 ScratchPadDB(캔버스 밖)라 캔버스 스냅샷이 못 되돌린다 ⇒ sideEffects 로 되살린다.
  //   붙여넣기 사본(#16-DUP)과 «정확히 같은» 기제·같은 id 보존 규칙을 쓴다.
  //   ⛔호출자는 이 sideEffects 를 «변경 뒤» pushHistory 에 실어야 한다(history.js 는 undo 때
  //     «떠나는 스냅»의 onUndo 를 부른다). push-before 항목에 실으면 «영영 안 탄다».
  // ═══════════════════════════════════════════════════════════════════

  /** 넘겨받은 섹션들이 «쥐고 있는» 링크 전수. 분모를 손으로 세지 않기 위한 유일한 출처. */
  function linksOfSections(secs) {
    const out = [];
    for (const sec of (secs || [])) {
      if (!sec || !sec.dataset) continue;
      for (const l of _parse(sec)) out.push({ sectionId: sec.id, scratchId: l.scratchId, collapsed: l.collapsed });
    }
    return out;
  }

  /* ★「링크를 쥐고 있는 섹션」의 «전수». ⛔.section-block 목록을 손으로 적지 않는다 —
     쥐고 있음의 표식은 `data-ref-links` 속성 하나뿐이고, _write 가 링크 0이면 그 속성을 지운다. */
  function _holderSecs() {
    try { return [...document.querySelectorAll('[data-ref-links]')]; } catch (_) { return []; }
  }
  /** 그 scratchId 를 «아직» 쥐고 있는 섹션 수. 0 이면 고아 = 지워도 아무도 안 잃는다. */
  function refCount(scratchId) {
    let n = 0;
    for (const sec of _holderSecs()) if (_parse(sec).some(l => l.scratchId === scratchId)) n++;
    return n;
  }

  /** ★①링크를 끊고 ②고아 이미지만 지운다. 섹션 제거는 «호출자가 이 뒤에» 한다.
   *  반환 { links, removedScratch, keptShared, sideEffects, order }
   *    · keptShared — 「남이 아직 쓰고 있어 «안» 지운 것」. 조용히 넘기지 않고 세어서 돌려준다.
   *
   *  ⛔deleteOrphans:false 는 «사용자 경로에서 쓰라고 만든 게 아니다». 유일한 손님은
   *    js/editor.js 의 deleteSection()(MCP·자동화)이고, 그 이유는 취향이 아니라 실측이다 —
   *    그 함수는 pushHistory 를 «변경 전»에 찍어서 sideEffects 가 «영영 안 탄다»
   *    ⇒ 지우면 ⌘Z 로 못 되살린다 = 데이터 손실. 그 자리 주석에 근거를 적어 뒀다.
   *    ★사용자 경로(Delete/Backspace)에서 이 옵션을 쓰면 발주(「그냥 같이 삭제」)를 어긴다. */
  function releaseSectionsForDelete(secs, { deleteOrphans = true } = {}) {
    const order = [];
    const links = linksOfSections(secs);
    if (!links.length) return { links: [], removedScratch: [], keptShared: [], sideEffects: null, order };

    /* ★① 링크 끊기 — 섹션이 «아직 DOM 에 있을 때». _clearAnchor 가 linkDy 를 버려야
       살아남는 이미지가 죽은 섹션을 가리키는 앵커를 안 물고 간다. */
    for (const sec of (secs || [])) {
      if (sec && sec.dataset && sec.dataset[ATTR]) _write(sec, []);
    }
    for (const l of links) _clearAnchor(l.scratchId);
    order.push('sever');

    /* ★② 고아만 지운다 — 참조를 «지금» 센다(①이 끝난 뒤라 분모가 「남이 쓰는 것」뿐이다). */
    const removedScratch = [], keptShared = [], seen = new Set();
    for (const l of (deleteOrphans ? links : [])) {
      if (seen.has(l.scratchId)) continue;          // 한 이미지를 여러 섹션이 쥔 경우 1회만
      seen.add(l.scratchId);
      const still = refCount(l.scratchId);
      if (still > 0) { keptShared.push({ scratchId: l.scratchId, stillUsedBy: still }); continue; }
      const it = _item(l.scratchId);
      if (!it) continue;                            // 다른 페이지·이미 삭제 = 조용히 넘긴다
      // ★레코드를 «먼저» 뜬다 — 지운 뒤엔 못 뜬다. 이게 onUndo 의 유일한 근거다.
      removedScratch.push({ id: it.id, src: it.src, x: it.x, y: it.y, w: it.w, linkDy: it.linkDy });
    }
    for (const rec of removedScratch) { try { window._scratchRemoveById?.(rec.id); } catch (_) {} }
    if (deleteOrphans) order.push('deleteOrphans');

    _rerender(); _save();
    _emitSplChanged();

    if (!removedScratch.length) return { links, removedScratch, keptShared, sideEffects: null, order };

    /* 크로스페이지 가드 — rewireClonedSection 과 «같은» 이유·같은 문구(history.js 가 페이지를
       바꾼 뒤 onUndo 를 부를 수 있고 ScratchPadDB 는 페이지별 키다). */
    const pageId = _curPageId();
    const recs = removedScratch.slice();
    const _samePage = () => {
      const now = _curPageId();
      if (now === pageId) return true;
      console.warn('[spl] 섹션삭제 undo/redo 를 건너뛴다 — 페이지가 다르다(당시 ' + pageId + ' / 지금 ' + now + ')');
      return false;
    };
    const sideEffects = {
      // ★id 를 «그대로» 되살린다 — 되돌아온 캔버스 스냅샷의 refLinks 토큰이 이 id 를 부른다.
      onUndo: () => {
        if (!_samePage()) return;
        for (const d of recs) { try { window._scratchRestoreItem?.(d); } catch (_) {} }
        _rerender(); _emitSplChanged();
      },
      onRedo: () => {
        if (!_samePage()) return;
        for (const d of recs) { try { window._scratchRemoveById?.(d.id); } catch (_) {} }
        _rerender(); _emitSplChanged();
      },
    };
    return { links, removedScratch, keptShared, sideEffects, order };
  }

  // ═══════════════════════════════════════════════════════════════════
  // [P2 = 오버레이 렌더]  사이드카(note-group·refimg 카드) + 연결선(SVG edges).
  //   · 오버레이는 #canvas-wrap «안», #canvas-scaler(줌/팬 transform) «밖»에 둔다(스크린 좌표).
  //     → serializeCleanRoot(#canvas 대상)가 못 봐서 export 오염0. 위치는 getBoundingClientRect
  //       (post-transform)로 계산 → 줌/팬/스크롤이 rect에 이미 반영돼 «자동 추종».
  //   · 스크래치 pane 필터: 연결된 .scratch-item[data-scratch-id]는 캔버스에서 display:none
  //     (데이터는 ScratchPadDB 그대로 → 해제 시 자동 복귀). 미연결만 캔버스에 남는다.
  //   · 이미지 src는 라이브 .scratch-item 의 <img>에서 «참조»(중복저장0).
  // ═══════════════════════════════════════════════════════════════════
  let _showEdges = true;              // 기어 토글(연결선 표시)
  let _relayoutRAF = null;
  const GROUP_PAD = 6;                // 묶음 테두리를 카드 바깥으로 미는 거리(scaler-local px)

  function _wrap()    { return document.getElementById('canvas-wrap'); }
  function _scaler()  { return document.getElementById('canvas-scaler'); }

  // 오버레이 = 연결선 SVG만(#link-edges). canvas-wrap 안·canvas-scaler «밖»(스크린좌표·export오염0).
  //   ★사이드카(#link-sidecar) 폐기(현빈 재설계) — 참고이미지는 스크래치 «제자리·비율 그대로», 연결은 «선»만.
  // ★edges는 «#canvas-scaler 안»에 둔다 — 섹션·스크래치와 같은 스택컨텍스트라 z로 층위 제어
  //   (섹션 < 선 < 스크래치). scaler transform(줌/팬)이 SVG에도 적용돼 «줌팬 자동 추종».
  //   좌표는 scaler-local(줌 전) = (elRect - scalerRect)/scale.
  function _ensureEdges() {
    const scaler = _scaler();
    if (!scaler) return null;
    const stale = document.getElementById('link-sidecar'); if (stale) stale.remove(); // 구 사이드카 잔재 제거
    let edges = document.getElementById('link-edges');
    if (!edges) {
      edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      edges.id = 'link-edges'; edges.setAttribute('class', 'spl-edges');
      scaler.insertBefore(edges, scaler.firstChild); // 이른 DOM(z-index로 층위 제어)
    } else if (edges.parentElement !== scaler) {
      scaler.insertBefore(edges, scaler.firstChild); // 구설계(wrap 소속)에서 이동
    }
    return edges;
  }

  function _scEl(scratchId) {
    return document.querySelector('.scratch-item[data-scratch-id="' + (window.CSS && CSS.escape ? CSS.escape(scratchId) : scratchId) + '"]');
  }

  /* ═══ [#16-G] 「연결의 단위는 ★묶음이다」 (현빈 2026-10-09) ══════════════════════════
   * 현빈 원문: 「그룹설정을 한 상태에서 섹션에 링크를 연결하면 선이 그룹과 섹션이 연결되니
   *   ★1개만 생겨야되는데 그룹안의 스크래치패드마다 모두 선이 연결이 되어버려 …
   *   ★링크도 그룹인 경우 섹션과 링크가 1개의 선만 보이면 되는데 지금은 링크선을 각각 모두
   *   언링크해줘야되는데 이게 잘못된듯해 … ★그룹설정이 됐는데도 링크 선을 만지면 각각 당겨지는 문제」
   *
   * ★★토큰(refLinks)은 ★그대로 «아이템 하나당 하나»다 — 바꾸지 않는다. 까닭 셋:
   *   ⑴ `_parse` 가 `lastIndexOf(':')` 로 자르므로 토큰에 칸을 더하면 id 가 깨진다(이 파일 머리말의 ⛔무변경).
   *   ⑵ `linkDy`(섹션 추종 앵커)는 ★아이템마다 다르다 — 묶어 버리면 5장이 한 자리에 포개진다.
   *   ⑶ ★현빈 ②「링크 연결된 상태에서 그룹해제를 하면 그제서야 각각의 링크들이 연결되던가」가
   *      ★공짜로 성립한다: 토큰이 원래 N개라, 그룹만 풀면 묶음이 N개로 «갈라지고» 선도 N개가 된다.
   *      ⇒ 그래서 `_scratchUngroup` 의 「링크도 같이 끊기」를 ★뺐다(js/scratch-pad.js 그 자리에 까닭을 적어 뒀다).
   * ⇒ 바꾸는 것은 «그리는·잡는·조작하는 ★단위» 하나다. 그것을 여기서 «묶음(unit)»이라 부른다.
   *
   * ★묶음 = «섹션 하나 × 그룹 하나». 그룹이 없는 아이템은 «자기 혼자인 묶음»이다 ⇒ 오늘 동작 그대로.
   *   같은 그룹이라도 ★섹션이 다르면 다른 묶음이다(한 그룹을 두 섹션에 나눠 걸 수 있다 — 그 경우 선은 둘).
   * ★그룹은 DOM 에서 읽는다(`el.dataset.scratchGroup`) — `_cmdLinkTargets` 가 쓰는 ★같은 출처다.
   *   이 파일은 플레인 스크립트라 scratch-pad.js 의 모듈 상태(_scratchItems)를 못 본다.
   * ⛔묶음 키에 그냥 `g` 를 쓰지 마라 — 그룹 id 와 scratchId 가 ★같은 문자열이면 둘이 한 묶음이 된다.
   *   그룹 없는 쪽은 `'#'+id` 로 ★다른 이름공간에 둔다.
   */
  function _groupOf(scratchId) {
    const el = _scEl(scratchId);
    return (el && el.dataset.scratchGroup) || null;
  }
  function _units() {
    const map = new Map();
    for (const { sectionId, scratchId, collapsed } of allLinks()) {
      const g = _groupOf(scratchId);
      /* ⛔구분자를 날 NUL(\u0000) 문자로 두지 마라 — 소스에 제어문자가 날것대로 들어간다(실측: 한 번 밟았다).
           '|' 로 충분하다 — 섹션 id(`sec_…`)와 그룹 id(`g_…`)에는 그 글자가 안 든다. */
      const key = sectionId + '|' + (g ? 'g:' + g : '#' + scratchId);
      let u = map.get(key);
      if (!u) { u = { sectionId, group: g, ids: [], collapsed: true }; map.set(key, u); }
      u.ids.push(scratchId);
      /* 묶음의 접힘 = «전부 접혔을 때만» 접힘. 손잡이(＋/－)가 「다음에 무엇을 할까」를 이것으로 고른다.
         ⇒ 섞여 있으면 «펼침»으로 읽혀 한 번 누르면 ★전부 접힌다(한 번에 가지런해진다). */
      if (!collapsed) u.collapsed = false;
    }
    return [...map.values()];
  }
  function _unitOf(scratchId) {
    for (const u of _units()) if (u.ids.includes(scratchId)) return u;
    return null;
  }
  /* 묶음의 «겉 상자» — `_edgeEnds` 에 ★요소 대신 넘기는 자다(getBoundingClientRect 만 있으면 된다).
     ★0×0(숨김·접힘) 멤버는 ★안 센다 — 「없다」가 아니라 「안 보인다」이고, 안 보이는 것을 상자에
       넣으면 선이 허공으로 뻗는다. 전원이 0×0 이면 상자도 0×0 ⇒ `_edgeEnds` 의 가드가 null 을 준다.
     splMembers = «보이는» 멤버 수. 1 이면 _edgeEnds 가 오늘처럼 «중심»에 붙인다. */
  function _unitBox(unit) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, n = 0;
    for (const id of unit.ids) {
      const el = _scEl(id);
      if (!el) continue;
      const q = el.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;
      if (q.left < l) l = q.left;
      if (q.top < t) t = q.top;
      if (q.right > r) r = q.right;
      if (q.bottom > b) b = q.bottom;
      n++;
    }
    const box = n
      ? { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }
      : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    return { splMembers: n, getBoundingClientRect: () => box };
  }

  // 연결된 스크래치 아이템에 접힘(spl-collapsed) 적용(refLinks의 collapsed). 선은 유지(아이템 위치 존재).
  function _applyCollapsed() {
    document.querySelectorAll('.scratch-item.spl-collapsed').forEach(el => {
      if (!isLinked(el.dataset.scratchId)) el.classList.remove('spl-collapsed'); // 해제된 것 복구
    });
    for (const { scratchId, collapsed } of allLinks()) {
      const el = _scEl(scratchId);
      if (el) el.classList.toggle('spl-collapsed', !!collapsed);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // [FOLLOW] 연결된 참고이미지가 «섹션을 따라» y 이동 (현빈 2026-08-25 실사용 확정)
  //   · y만 추종 / x는 스크래치 제자리(「제자리」 원칙을 x축에서 보존) / 해제하면 다시 완전 자유.
  //   · 앵커 = item.linkDy = (아이템 y) − (섹션 top, scaler-local). ★스크래치 «아이템 레코드»에 둔다 —
  //     refLinks dataset("sp_x:0")은 _parse가 lastIndexOf(':')라 필드를 더하면 id가 깨진다(⛔무변경).
  //   · 반영은 «섹션 top이 변한 프레임»에만(_edgeLoop diff-skip 패턴 재사용), 영속화는 디바운스.
  //   · 사용자가 연결된 이미지를 드래그하면 그 자리에서 «재앵커» — 추종이 조작을 되돌리지 않는다.
  // ═══════════════════════════════════════════════════════════════════
  const STACK_GAP = 12;                 // 1섹션:N 겹침 회피 간격
  const _follow = new Map();            // scratchId → { lastY, lastTop, stack }
  const _EPS = 0.5;

  function _item(id) { try { return window._scratchItemById ? window._scratchItemById(id) : null; } catch (_) { return null; } }
  function _domY(el) { const v = parseFloat(el.style.top); return isFinite(v) ? v : 0; }
  function _num(v)   { return typeof v === 'number' && isFinite(v); }

  // 연결 생성/해제 시 앵커 폐기 → 다음 프레임이 «현재 보이는 자리»에서 재유도(연결 순간 이미지 무이동).
  function _clearAnchor(scratchId) {
    _follow.delete(scratchId);
    const it = _item(scratchId);
    if (it) delete it.linkDy;
  }

  // undo/redo(_applyScratchGeomSnapshot)가 좌표+linkDy를 «스냅샷 값»으로 되돌린 직후 호출.
  //   lastY는 복원된 좌표로 맞춰 «재앵커 오인»을 막고, lastTop은 무효화해 복원된 linkDy를 1회 재적용시킨다.
  function resyncFollow() {
    for (const { scratchId } of allLinks()) {
      const it = _item(scratchId); const st = _follow.get(scratchId);
      if (!it || !it.el || !st) continue;
      st.lastY = _domY(it.el);
      st.lastTop = -1e9;   // 다음 프레임에 y = secTop + linkDy 재적용
      st.stack = 0;
    }
  }

  function _applyFollow() {
    if (!window._scratchItemById) return;
    const scaler = _scaler(); if (!scaler) return;
    const links = allLinks();
    if (!links.length) { if (_follow.size) _follow.clear(); return; }
    // 끊긴 링크의 잔여 상태 정리
    if (_follow.size) {
      const live = new Set(links.map(l => l.scratchId));
      for (const k of [..._follow.keys()]) if (!live.has(k)) _follow.delete(k);
    }
    const scale = (window.currentZoom || 100) / 100 || 1;
    const scRect = scaler.getBoundingClientRect();
    const bySec = new Map();
    for (const { sectionId, scratchId } of links) {
      if (!bySec.has(sectionId)) bySec.set(sectionId, []);
      bySec.get(sectionId).push(scratchId);
    }
    let dirty = false;
    for (const [sectionId, ids] of bySec) {
      const sec = document.getElementById(sectionId);
      if (!sec) continue;                                   // 고아 링크 = 무시(선도 안 그려짐)
      const secTop = (sec.getBoundingClientRect().top - scRect.top) / scale; // scaler-local
      const rows = [];
      for (const id of ids) {
        const it = _item(id);
        if (!it || !it.el || !it.el.isConnected) continue;
        const dy = _domY(it.el);
        let st = _follow.get(id);
        if (!st) {
          // 첫 관측(로드/undo 후 최초 프레임): 저장된 linkDy가 «정본» → lastTop 무효화로 1회 강제 적용
          //   (디바운스 저장이 못 나간 채 종료됐거나 다른 맥에서 온 프로젝트여도 재로드 후 자리 정합).
          st = { lastY: dy, lastTop: _num(it.linkDy) ? -1e9 : secTop, stack: 0 };
          _follow.set(id, st);
        }
        else if (Math.abs(dy - st.lastY) > _EPS) {
          // 우리가 쓴 값이 아니다 = 사용자 드래그/리사이즈/정렬 → 그 자리에서 재앵커
          it.linkDy = dy - secTop - st.stack;
          it.y = dy; st.lastY = dy; st.lastTop = secTop;
          dirty = true;
        }
        if (!_num(it.linkDy)) {                              // 첫 연결·구데이터(하위호환) → «현재 자리»에서 유도(무이동)
          it.linkDy = dy - secTop - st.stack;
          it.y = dy; st.lastY = dy;
          st.lastTop = -1e9;   // 1회 적용 강제 — 겹침 stack을 «연결 직후»에 해소(오프셋만으론 위치 불변)
          dirty = true;
        }
        rows.push({ id, it, st });
      }
      if (!rows.length) continue;
      if (!rows.some(r => Math.abs(secTop - r.st.lastTop) > _EPS)) continue; // ★섹션 top 불변 = 무작업
      // 목표 y = secTop + linkDy → 그다음 1섹션:N 겹침(가로범위 교차 시)만 아래로 stack
      const targets = rows.map(r => ({
        r,
        base: secTop + r.it.linkDy,
        h: r.it.el.offsetHeight || 0,
        x: _num(r.it.x) ? r.it.x : (parseFloat(r.it.el.style.left) || 0),
        w: r.it.w || r.it.el.offsetWidth || 0,
      })).sort((a, b) => a.base - b.base);
      const placed = [];
      for (const t of targets) {
        let y = t.base;
        for (const q of placed) {
          if (!(t.x < q.x + q.w && q.x < t.x + t.w)) continue;   // 가로 안 겹치면 세로 겹쳐도 무관
          if (y < q.y + q.h + STACK_GAP && y + t.h > q.y) y = q.y + q.h + STACK_GAP;
        }
        t.y = y; placed.push(t);
        if (Math.abs(y - t.r.st.lastY) > _EPS) {
          t.r.it.el.style.top = y + 'px';
          t.r.it.y = y;
          dirty = true;
        }
        t.r.st.lastY = y; t.r.st.lastTop = secTop; t.r.st.stack = y - t.base;
      }
    }
    if (dirty) { try { window._scratchSaveSoon && window._scratchSaveSoon(); } catch (_) {} } // ★디바운스(프레임마다 저장 금지)
  }

  // ═══════════════════════════════════════════════════════════════════
  // [#16-DUP] 「링크된 섹션의 «사본»에는 스크래치 사본을 딸려 보낸다」 (현빈 2026-09-08 발주)
  //
  // 증상: 링크된 섹션을 ⌘C→⌘V 하면 원본과 사본이 «같은 scratchId» 를 둘 다 쥐어
  //   allLinks() 가 그 이미지를 2건으로 세고 _drawEdges 가 한 이미지에서 선을 두 개 긋는다.
  //   («링크체인 2개»가 이것이다.) 이 파일의 자료구조는 처음부터 «이미지 1 : 섹션 1» 전제다.
  //
  // ★규칙은 «토큰 하나»마다 이 술어를 본다 — 「붙여넣는 순간 그 scratchId 를 «살아있는 섹션»이
  //   쥐고 있나」. 이 하나가 복사와 잘라내기를 «자동으로» 가른다:
  //     · 쥐고 있다      → 복사다   → 사본을 만들고 토큰을 새 id 로 바꾼다
  //     · 아무도 안 쥔다 → 이동이다 → 토큰 그대로(⌘X 로 원본이 사라진 뒤라 재연결이 맞다)
  //     · 아이템이 없다  → 토큰 그대로. ⛔지우지 않는다 — 다른 페이지이거나 «스크래치가 아직
  //       로드 전»일 수 있다. 「없다」를 「지워졌다」로 읽으면 링크를 영구 파괴한다.
  //   ⛔「붙여넣기면 무조건 복제」로 짜면 ⌘X→⌘V «이동»이 «복제»로 변한다.
  //
  // ★★부르는 자리 = 섹션을 DOM 에 «넣기 전»(분리 상태). 넣은 뒤에 부르면 sectionIdOf 가
  //   «사본 자신»을 찾아 복제를 건너뛴다. 그리고 그 실패는 «사용자의 선택 상태»에 따라 갈린다 —
  //   refSection = getSelectedSection() || _pickVisibleSection() 가 원본 «뒤»면 우연히 맞고
  //   원본 «앞»이면 버그가 남는다. 손으로 눌러 보면 대체로 고쳐져 보이는 제일 나쁜 종류다.
  // ⛔그래서 addLink 의 관용구(`if (curSecId === target.id) return false;`)를 여기에 베끼지 마라.
  //   그 자가 가드는 「대상 섹션이 이미 DOM 에 있다」를 전제한다. 여긴 정반대다. (금지선: T-U1-1b)
  //
  // 반환 { dups, sideEffects } — dups 가 비면 sideEffects=null 이고 «오늘과 동작이 같다».
  //   ★sideEffects 가 필요한 이유: 복사는 «이미지를 만드는» 조작이라 캔버스 스냅샷만으로는
  //   undo 가 성립하지 않는다(섹션삭제·링크해제와 갈리는 지점). 안 붙이면 ⌘Z 가 섹션만 지우고
  //   사본 이미지가 주인 없이 남는다 = 고아.
  // ═══════════════════════════════════════════════════════════════════
  function _curPageId() {
    try { return (window.state && window.state.currentPageId) || null; } catch (_) { return null; }
  }

  function rewireClonedSection(el) {
    const dups = [];
    if (!el) return { dups, sideEffects: null };
    /* ★오늘 N(한 번에 붙는 섹션 수)=1 이지만 «섹션 집합»으로 훑는다 — 비용 0이고,
       §7-A 형제 경로(section-variation·branch-system)를 나중에 붙이는 게 한 줄이 된다. */
    const secs = [];
    if (el.classList && el.classList.contains('section-block')) secs.push(el);
    if (el.querySelectorAll) secs.push(...el.querySelectorAll('.section-block'));

    for (const sec of secs) {
      const arr = _parse(sec);
      if (!arr.length) continue;
      const next = [];
      let changed = false;
      for (const l of arr) {
        const holder = sectionIdOf(l.scratchId);
        if (!holder) { next.push(l); continue; }   // 아무도 안 쥔다 = 이동(⌘X 뒤) → 재연결
        /* 사본은 원본 «옆»에 놓는다 — _applyFollow 의 겹침 회피는 가로가 겹칠 때만 도므로
           (scratchpad-link.js `if (!(t.x < q.x + q.w …)) continue;`) x 를 벌려 두면 세로가
           겹쳐도 서로 안 민다. x 는 추종이 안 건드리니 한 번 벌리면 유지된다.
           ⛔새 간격 상수를 만들지 않는다 — STACK_GAP 을 쓴다. */
        const srcIt = _item(l.scratchId);
        const dx = (srcIt && _num(srcIt.w) ? srcIt.w : 0) + STACK_GAP;
        /* ⛔y 는 계산하지 않는다 — linkDy 를 베끼면 _applyFollow 첫 프레임이
           y = 새 섹션 top + linkDy 를 1회 강제 적용한다. 붙여넣기 시점엔 레이아웃이 아직 없다. */
        const r = (typeof window._scratchDuplicateItem === 'function')
          ? window._scratchDuplicateItem(l.scratchId, { dx, dy: 0 })
          : { ok: false, code: 'NO_SOURCE' };   // 모듈 미로드 = 「아직 못 본다」와 같은 갈래
        if (!r || !r.ok) {
          /* ★처분은 같고(토큰 유지) «소리»가 다르다 — NO_SOURCE 는 정상 갈래(다른 페이지·
             로드 전)라 조용히, NO_SCALER 는 «만들다 실패»라 결함이므로 소리를 낸다. */
          if (r && r.code === 'NO_SCALER') {
            console.warn('[spl] 스크래치 사본 생성 실패(NO_SCALER) — 링크를 원본과 공유한 채 둔다:', l.scratchId);
          }
          next.push(l); continue;
        }
        dups.push(r.item);
        next.push({ scratchId: r.item.id, collapsed: l.collapsed });   // ★collapsed 보존
        changed = true;
      }
      if (changed) _write(sec, next);
    }

    if (!dups.length) return { dups, sideEffects: null };

    /* ★크로스페이지 가드 — restoreSnapshot 은 snap.pageId 가 다르면 «페이지를 바꾼 뒤»
       onUndo 를 부른다(history.js). ScratchPadDB 는 페이지별 키라 그때 지우면 못 찾고
       조용히 false 가 난다. 모르는 상태에서 «지우는» 쪽은 되돌릴 수 없다 —
       안 지우면 고아 하나가 남을 뿐이라 비대칭이 명확하다. 안 지우고 «소리를 낸다». */
    const pageId = _curPageId();
    const recs = dups.slice();
    const _samePage = () => {
      const now = _curPageId();
      if (now === pageId) return true;
      console.warn('[spl] 붙여넣기 undo/redo 를 건너뛴다 — 페이지가 다르다(당시 ' + pageId + ' / 지금 ' + now + ')');
      return false;
    };
    const sideEffects = {
      onUndo: () => {
        if (!_samePage()) return;
        for (const d of recs) { try { window._scratchRemoveById?.(d.id); } catch (_) {} }
      },
      onRedo: () => {
        if (!_samePage()) return;
        // ★id 를 «그대로» 되살린다 — redo 로 돌아온 스냅샷의 refLinks 토큰이 이 id 를 부른다.
        for (const d of recs) { try { window._scratchRestoreItem?.(d); } catch (_) {} }
      },
    };
    return { dups: recs, sideEffects };
  }

  let _lastEdgePath = null; // diff-skip 캐시(좌표 불변 시 DOM 미변경)

  /* ══ 연결선의 «두 끝» — 화면(client) 좌표. ★그리는 자와 «맞추는 자»가 같은 수를 봐야 한다.
   *   ⛔여기서 한 벌, 더블클릭 판정에서 한 벌 적으면 「보이는 선」과 「눌리는 선」이 갈린다 —
   *     사용자에겐 「선을 눌렀는데 안 먹는다」로 보이고, 그건 이 레포의 고질이다.
   *   돌려주는 값: 이미지 «중심» → 섹션의 가까운 세로변 «중앙». attachRight = 이미지가 오른쪽인가.
   *   null = 한쪽이 «안 그려졌다»(0×0 — 숨김/접힘). 그 경우 선도 안 긋고 판정도 안 한다. */
  function _edgeEnds(sec, item) {
    const ir = item.getBoundingClientRect(), sr = sec.getBoundingClientRect();
    if ((ir.width === 0 && ir.height === 0) || (sr.width === 0 && sr.height === 0)) return null;
    const icx = ir.left + ir.width / 2, icy = ir.top + ir.height / 2;
    const attachRight = icx > (sr.left + sr.width / 2);
    /* ★`item` 은 요소일 수도 있고 «묶음의 겉 상자»(_unitBox)일 수도 있다 — 둘 다 rect 만 준다.
       한 장(splMembers 없음 또는 1)이면 «중심»에 붙인다 = 2026-09-30 부터의 동작 ★그대로.
       여럿이면 «상자의 가까운 세로변 중앙»에 붙인다 — 중심에 붙이면 선이 가운데 한 장을 가리켜
       「★그룹과 연결」이 아니라 「그 한 장과 연결」로 읽힌다(현빈 2026-10-09 ①). */
    const ix = (item.splMembers > 1) ? (attachRight ? ir.left : ir.right) : icx;
    return { ix, iy: icy, sx: attachRight ? sr.right : sr.left, sy: sr.top + sr.height / 2, attachRight };
  }

  /* 점 → 선분 거리. ⛔직선(무한) 거리로 재지 마라 — 선분 «밖»의 먼 점이 가깝다고 나온다. */
  function _distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const qx = x1 + t * dx, qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  // 연결선(scaler-local 좌표): 스크래치 아이템 중심 → 섹션 가까운 세로변 중앙. SVG가 scaler 안이라
  //   좌표는 (elRect - scalerRect)/scale (줌 전). 줌/팬은 scaler transform이 SVG째 적용→자동 추종.
  function _drawEdges() {
    const scaler = _scaler(); const edges = _ensureEdges();
    if (!scaler || !edges) return;
    const scale = (window.currentZoom || 100) / 100 || 1;
    const scRect = scaler.getBoundingClientRect();
    const W = Math.max(scaler.scrollWidth, scRect.width / scale), H = Math.max(scaler.scrollHeight, scRect.height / scale);
    const toLocalX = (clientX) => (clientX - scRect.left) / scale;
    const toLocalY = (clientY) => (clientY - scRect.top) / scale;
    let s = '';
    if (_showEdges) {
      /* ★[#16-G] «링크»가 아니라 «묶음»을 돈다 — 그룹 하나에 선 하나(현빈 2026-10-09 ①).
         그룹이 없으면 묶음이 곧 아이템 하나라 오늘과 같은 선이 나온다. */
      for (const unit of _units()) {
        const sec = document.getElementById(unit.sectionId);
        const item = _unitBox(unit);
        if (!sec) continue;
        /* [#16-C] 안 그려진 쪽으로는 선을 긋지 않는다 — display:none 인 요소의 rect 는 «전부 0» 이라
         *   그대로 두면 선이 캔버스 좌상단(0,0)으로 뻗는 «허공 선»이 된다.
         *   ★스크래치 일괄 숨기기(window.toggleScratchHideAll)가 바로 이 상태를 만든다.
         *   ★특정 기능이 아니라 «rect 로» 판정한다 — 숨김 경로가 늘어도 이 문 하나로 닫힌다
         *     (클래스명으로 판정하면 다음 숨김 경로에서 같은 버그가 다시 난다).
         *   ⚠️0×0 은 「없다」가 아니라 「안 보인다」다 — 데이터·연결은 그대로 살아 있다.
         *   ★그 판정은 이제 _edgeEnds 안에 있다(null = 안 그려졌다) — 맞추는 자도 같은 문을 쓴다. */
        const _e = _edgeEnds(sec, item);
        if (!_e) continue;
        const ix = toLocalX(_e.ix), iy = toLocalY(_e.iy);   // 묶음이 붙는 점(한 장이면 중심)
        const sx = toLocalX(_e.sx), sy = toLocalY(_e.sy);
        s += '<line x1="' + ix.toFixed(1) + '" y1="' + iy.toFixed(1) + '" x2="' + sx.toFixed(1) + '" y2="' + sy.toFixed(1) + '"/>' +
             '<circle cx="' + ix.toFixed(1) + '" cy="' + iy.toFixed(1) + '" r="3.5" class="spl-edge-dot"/>';
        /* ★[#16-G] «선이 무엇을 가리키나» — 묶음이 둘 이상이면 그 겉상자를 ★한 겹 두른다.
         * ⛔이것은 ★「그룹을 보이게 하는 기능」이 ★아니다(그건 별 건 N1 — 링크 없는 그룹은 여전히
         *   화면에서 비그룹과 구분되지 않는다. ★손대지 않았다). 여기서 닫는 것은 ★«선의 대상»이다:
         *   세로로 쌓인 다섯이면 붙는 점이 «가운데 장 옆»이라 「3번 장과 연결」로 읽힌다(실측 사진).
         *   현빈 2026-10-09 ①「선이 ★그룹과 섹션이 연결」의 문자 그대로. 지디 판정 2026-10-09.
         * ★조건 — ⑴ «링크된» 묶음에만(_units 가 링크에서 나오므로 구조로 보장) ⑵ 보이는 멤버 ★2 이상
         *   ⑶ 선과 ★같은 색 1px ★점선, ⛔채우기·그림자 ★없음(CSS .spl-edge-group).
         * ★상자는 조금 바깥으로 민다(GROUP_PAD) — 카드 테두리 «위»에 그리면 카드 외곽선으로 읽힌다. */
        if (item.splMembers > 1) {
          const br = item.getBoundingClientRect();
          const gx = toLocalX(br.left) - GROUP_PAD, gy = toLocalY(br.top) - GROUP_PAD;
          const gw = br.width / scale + GROUP_PAD * 2, gh = br.height / scale + GROUP_PAD * 2;
          s += '<rect class="spl-edge-group" x="' + gx.toFixed(1) + '" y="' + gy.toFixed(1) +
               '" width="' + gw.toFixed(1) + '" height="' + gh.toFixed(1) + '" rx="4"/>';
        }
      }
    }
    const sizeKey = W.toFixed(0) + 'x' + H.toFixed(0);
    if (edges.dataset.size !== sizeKey) {
      edges.setAttribute('width', W); edges.setAttribute('height', H);
      edges.style.width = W + 'px'; edges.style.height = H + 'px';
      edges.dataset.size = sizeKey;
    }
    if (s !== _lastEdgePath) { edges.innerHTML = s; _lastEdgePath = s; } // 좌표 불변 시 DOM 미변경
  }

  // ★A: 연결이 있으면 rAF 상시 루프로 선을 재계산(섹션 드래그/재정렬/높이변경/블록추가삭제 «모든» 경로 추종).
  //   diff-skip이라 좌표 불변 프레임은 DOM 미변경(비용 낮음). 연결 0이면 루프 정지.
  function _edgeLoop() {
    _applyFollow();   // ★선보다 «먼저» — 같은 프레임에 이미지 y 확정 후 선을 그린다(1프레임 지연 없음)
    _drawEdges();
    if (allLinks().length > 0) _relayoutRAF = requestAnimationFrame(_edgeLoop);
    else { _relayoutRAF = null; }
  }
  function _ensureEdgeLoop() {
    if (allLinks().length > 0) { if (!_relayoutRAF) _relayoutRAF = requestAnimationFrame(_edgeLoop); }
    else if (_relayoutRAF) { cancelAnimationFrame(_relayoutRAF); _relayoutRAF = null; _drawEdges(); } // 마지막 1회로 선 제거
  }

  // 전체 재렌더(CRUD·로드·undo/redo·협업 호출) — 상태별 버튼 + 접힘 + 연결선 루프. ★사이드카/pane필터 폐기.
  function __spLinkRerender() {
    try {
      _ensureLinkButtons();
      _applyCollapsed();
      // ★추종을 rAF 루프에만 맡기지 않는다 — macOS에서 창이 «완전히 가려지면» visibilityState=hidden 이라
      //   rAF가 멈춘다(실측: 0 tick/s). 그 사이 로드/undo/협업이 들어오면 앵커가 안 잡힌다.
      //   로드·CRUD·undo/redo 시점에 «동기»로 한 번 적용해 앵커를 확정한다.
      _applyFollow();
      _drawEdges();
      _ensureEdgeLoop();
    } catch (e) { console.warn('[spl] rerender err:', e); }
  }
  window.__spLinkRerender = __spLinkRerender;
  window.__spLinkRelayout = () => { _lastEdgePath = null; _drawEdges(); };
  function setShowEdges(v) { _showEdges = !!v; _lastEdgePath = null; _drawEdges(); }

  /* [#16-B] 저장된 「연결선 표시」(환경설정 > 성능)를 «부팅 시» 한 번 적용한다.
   *   ★왜 여기서 읽나 — 스크립트 순서가 settings-store(948) → settings-modal(961) → 이 파일(1033)이고,
   *     settings:ready 는 main IPC 를 «기다렸다가» 뜬다. 즉 «둘 중 뭐가 먼저인지 보장이 없다».
   *     ⇒ 양쪽을 다 건다: (a) 이벤트가 나중이면 리스너가 받고, (b) 이벤트가 먼저였으면
   *        _boot 에서 window._settings 를 직접 읽는다. 한쪽만 걸면 부팅 때 값이 «가끔» 무시된다.
   *   ⚠️키가 «없으면» ON 이다 — 기본값이 true 이므로 undefined 를 OFF 로 읽으면 안 된다. */
  function _applySavedShowEdges() {
    try {
      const s = window._settings;
      if (!s) return false;                       // 아직 안 왔다 — 이벤트가 받아준다
      setShowEdges(s.showScratchLinkEdges !== false);
      return true;
    } catch (_) { return false; }
  }
  window.addEventListener('settings:ready',   _applySavedShowEdges);
  window.addEventListener('settings:changed', _applySavedShowEdges);

  // ── 추종 트리거: 스크롤/리사이즈/스케일러 transform 변화 → rAF 스로틀 relayout ──
  function _installFollow() {
    const scaler = _scaler(); if (!scaler || scaler.__splFollow) return true;
    scaler.__splFollow = true;
    // 스크래치 아이템 추가/제거(childList) → 버튼 주입·상태 갱신. (선 위치 추종은 rAF 루프가·줌팬은 scaler transform이 담당)
    const mo = new MutationObserver(muts => {
      for (const m of muts) if (m.type === 'childList') { _scheduleRerender(); break; }
    });
    mo.observe(scaler, { childList: true });
    return true;
  }

  // ── 재렌더 훅: bindSectionHitzone 래퍼(로드/undo/redo/협업) — #11 태그 패턴 ──
  let _rerenderDebounce = null;
  function _scheduleRerender() {
    if (_rerenderDebounce) return;
    _rerenderDebounce = setTimeout(() => { _rerenderDebounce = null; __spLinkRerender(); }, 0);
  }
  function _installSectionHook() {
    if (window.__splSectionHook) return true;
    const orig = window.bindSectionHitzone;
    if (typeof orig !== 'function') return false;
    window.bindSectionHitzone = function (sec) {
      const r = orig.apply(this, arguments);
      try { _scheduleRerender(); } catch (_) {}
      return r;
    };
    window.__splSectionHook = true;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // [P4 = 당기기]  연결선 «더블클릭» → 그 참고이미지 한 장을 섹션 옆 «빈 자리»로 당긴다.
  //   현빈 2026-09-30: 「점선을 더블클릭하면 하나씩 당겨지는걸로 · 동적으로」
  //   ＋「여러장인 경우 가져올때 겹치지 않게끔. 세로로 스택되면 밑에 다른거랑 또 겹칠 수
  //      있으니 동적으로 계산해서」
  //
  // ★확정된 동작 — 누른 «그 선»의 한 장만 온다(나머지는 제자리) · 거리는 한 번에 끝 ·
  //   이미 와 있으면 아무 일도 안 한다 · 되돌리기는 ⌘Z 한 번.
  //
  // ⛔★선에 pointer-events 를 «켜지 않는다». 실측(2026-09-30): 이 SVG 는 z-index 90 으로
  //   «섹션보다 앞»이다(css/editor-extra.css 의 .spl-edges — 그 줄 주석이 「섹션 앞 + 스크래치
  //   뒤」라고 못박아 뒀다). 선에 히트영역을 주면 섹션 위를 지나는 구간이 블록 더블클릭
  //   (글자 인라인 편집)을 훔친다 — 얻는 것보다 잃는 것이 크다.
  //   ⇒ 대신 «바깥틀에서 듣고 기하로 잰다». 선은 끝까지 pointer-events:none 이라
  //     남의 클릭을 훔칠 길이 «원리적으로» 없다.
  // ★잡는 폭은 «화면 px» 로 잰다 — 선은 2px 이고 편집 배율 40%면 화면상 0.8px 이다.
  //   오늘 구분선에서 겪은 것과 같은 함정이라, 보이는 굵기가 아니라 손에 닿는 굵기로 잰다.
  // ⛔펜·주석 도구가 켜져 있으면 여기 오지 않는다 — 그쪽이 capture 단계에서 stopPropagation
  //   한다(js/pen-tool.js · js/annotation-tool.js). 그래서 도구 판정을 «여기서 또» 하지 않는다.
  // ═══════════════════════════════════════════════════════════════════
  const DBL_HIT_PX = 8;     // 선에서 이만큼(화면 px) 안이면 「선을 눌렀다」
  const PULL_GAP   = 24;    // 섹션 세로변에서 바깥으로 띄울 거리(scaler-local px)

  /** 화면 한 점에 «가장 가까운» 연결선. 없으면 null.
   *  ★[#16-G] 도는 것이 «묶음»이라 _drawEdges 와 ★같은 선을 본다 — 보이는 선과 눌리는 선이 갈리지 않는다.
   *  ⚠️돌려주는 `link` 는 «대표 한 장»이다(호환용). 조작은 `unit` 으로 해야 그룹 전원에 간다. */
  function _linkAtPoint(cx, cy) {
    let best = null;
    for (const unit of _units()) {
      const sec = document.getElementById(unit.sectionId);
      const item = _unitBox(unit);
      if (!sec) continue;
      const e = _edgeEnds(sec, item);
      if (!e) continue;                                  // 안 그려진 선은 «없는 선»이다
      const d = _distToSeg(cx, cy, e.ix, e.iy, e.sx, e.sy);
      if (d <= DBL_HIT_PX && (!best || d < best.d)) {
        best = { d, unit, link: { sectionId: unit.sectionId, scratchId: unit.ids[0] }, sec, item, ends: e };
      }
    }
    return best;
  }

  /* ★당겨 놓을 자리 — 가로는 섹션 변 바깥 PULL_GAP, 세로는 «빈 자리를 찾아서».
   *   ⛔「세로로 한 칸씩 쌓기」로 하지 않는다 — 현빈 지적대로 그러면 «밑에 있던 다른 것»과
   *     또 겹친다. 그래서 매번 «지금 화면에 있는 모든» 스크래치 아이템을 보고 계산한다
   *     (그 섹션 것이든 남의 섹션 것이든 연결 안 된 것이든 전부).
   *   방식 = 스카이라인 한 줄: 세로로 겹칠 수 있는 것들(가로가 겹치는 것)을 위에서부터
   *     훑어 내려가며 y 를 «밀어 내린다». y 는 단조 증가라 한 번 지난 것과 다시 겹치지 않는다.
   *   ⛔가로가 안 겹치면 세로가 겹쳐도 상관없다 — 나란히 놓이는 것은 겹침이 아니다.
   *   ⚠️0×0(숨김·접힘) 아이템은 «피하지 못한다» — 높이를 «잴 수가 없어서»다(저장본에 폭만
   *     있고 높이는 그림 비율에서 나온다). 숨긴 것을 다시 켜면 겹칠 수 있고, 그때는 다시
   *     당기면 된다. ★모르는 값을 지어내 자리를 비우지 않는다.
   *   ★섹션은 막는 것에 안 넣는다 — 놓는 x 는 «모든 섹션의 가로 범위 밖»이다(같은 칼럼).
   *   @returns {{x:number,y:number}} scaler-local px */
  /* ★[#16-G] 두 번째·세 번째 인자가 늘었다 — 그룹을 통째로 당길 때 «묶음의 겉 크기»로 자리를 잡고
     «묶음 전원»을 막는 것에서 뺀다(자기 자신과 겹치는 자리를 피하느라 끝없이 밀려나지 않게).
     ⛔한 장일 때의 길은 그대로다 — size 를 안 주면 item.offsetWidth/Height 를 쓰고 exclude 는 자기 하나다. */
  function _pullDest(sec, item, attachRight, size, exclude) {
    const scaler = _scaler();
    const scale = (window.currentZoom || 100) / 100 || 1;
    const scRect = scaler.getBoundingClientRect();
    const sr = sec.getBoundingClientRect();
    const toLX = (v) => (v - scRect.left) / scale;
    const toLY = (v) => (v - scRect.top) / scale;
    /* ⛔`item` 이 null 일 수 있다(묶음 호출은 size·exclude 로 다 준다) — 옵셔널로 읽는다.
       「size 를 줬으니 item 은 안 본다」를 전제로 두면 size.w 가 0 인 판에서 조용히 터진다. */
    const w = (size && size.w) || item?.offsetWidth || 0, h = (size && size.h) || item?.offsetHeight || 0;
    const skip = exclude || new Set(item ? [item] : []);
    const x = attachRight ? toLX(sr.right) + PULL_GAP : toLX(sr.left) - PULL_GAP - w;
    let y = toLY(sr.top);
    const blockers = [...document.querySelectorAll('.scratch-item')]
      .filter(el => !skip.has(el))
      .map(el => ({
        x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0,
        w: el.offsetWidth || 0, h: el.offsetHeight || 0,
      }))
      .filter(b => b.w > 0 && b.h > 0)                         // 숨김은 잴 수 없다(위 ⚠️)
      .filter(b => x < b.x + b.w && b.x < x + w)               // 가로가 겹치는 것만 «막는다»
      .sort((a, b) => a.y - b.y);
    for (const b of blockers) {
      if (y < b.y + b.h + STACK_GAP && y + h > b.y) y = b.y + b.h + STACK_GAP;
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  /** 연결 하나를 당긴다. 자리·저장·되돌리기는 스크래치가 맡는다(window._scratchAnimateItemTo).
   *  ★[#16-G] 그룹이면 ★묶음 전원이 «상대 배치를 그대로 쥔 채» 함께 온다(현빈 2026-10-09 ⑤
   *    「그룹설정이 됐는데도 링크 선을 만지면 각각 당겨지는 문제」). 되돌리기는 ⌘Z ★한 번이다.
   *  ⛔한 장일 때는 길이 ★한 글자도 안 바뀐다 — `_scratchAnimateItemTo` 를 그대로 부른다
   *    (tests/dom/scratch-link-pull 의 하네스가 그 함수 하나를 가로채 「한 번만 불렸나」를 잰다).
   *  @returns {{ok:boolean, moved?:boolean, reason?:string}} */
  function pullLink(scratchId) {
    const unit = _unitOf(scratchId);
    if (!unit) return { ok: false, reason: 'NO_LINK' };
    const sec = document.getElementById(unit.sectionId);
    const box = _unitBox(unit);
    if (!sec || !box.splMembers) return { ok: false, reason: 'NO_EL' };
    const e = _edgeEnds(sec, box);
    if (!e) return { ok: false, reason: 'HIDDEN' };

    const scale = (window.currentZoom || 100) / 100 || 1;
    const scRect = _scaler().getBoundingClientRect();
    const secTop = (sec.getBoundingClientRect().top - scRect.top) / scale;
    /* 섹션 기준 세로 간격을 «목표 자리»로 다시 잡아 준다 — 안 하면 추종루프가 다음 프레임에
       옛 linkDy 로 되돌려 당긴 것이 «튕겨» 나간다. */

    if (unit.ids.length === 1) {
      const item = _scEl(scratchId);
      if (!item) return { ok: false, reason: 'NO_EL' };
      const dest = _pullDest(sec, item, e.attachRight);
      if (typeof window._scratchAnimateItemTo !== 'function') return { ok: false, reason: 'NO_API' };
      return window._scratchAnimateItemTo(scratchId, dest.x, dest.y,
        { label: '참고이미지 당기기', linkDy: dest.y - secTop });
    }

    if (typeof window._scratchAnimateItemsTo !== 'function') return { ok: false, reason: 'NO_API' };
    /* 묶음의 겉 상자를 scaler-local 로 옮긴다 — `_pullDest` 는 그 좌표계로 자리를 잡는다. */
    const br = box.getBoundingClientRect();
    const boxX = (br.left - scRect.left) / scale, boxY = (br.top - scRect.top) / scale;
    const size = { w: br.width / scale, h: br.height / scale };
    const members = unit.ids.map(id => _scEl(id)).filter(Boolean);
    const visible = members.filter(el => { const q = el.getBoundingClientRect(); return !(q.width === 0 && q.height === 0); });
    const dest = _pullDest(sec, null, e.attachRight, size, new Set(members));
    /* ★«상대 배치»는 묶음 겉 상자의 좌상단을 기준으로 잰다 — 각자 제 오프셋을 그대로 들고 간다.
       ⛔0×0(숨김·접힘) 멤버는 ★안 옮긴다: 상자에도 안 들어갔으니 기준이 없다(지어내지 않는다). */
    const moves = visible.map(el => {
      const q = el.getBoundingClientRect();
      const ox = (q.left - scRect.left) / scale - boxX;
      const oy = (q.top - scRect.top) / scale - boxY;
      const y = dest.y + oy;
      return { id: el.dataset.scratchId, x: Math.round(dest.x + ox), y: Math.round(y), linkDy: y - secTop };
    });
    return window._scratchAnimateItemsTo(moves, { label: '참고이미지 당기기' });
  }

  /* 더블클릭 — «바깥틀»에서 듣는다. ⛔블록·섹션·스크래치 아이템 위에서는 손을 떼라:
     그쪽에 이미 더블클릭의 뜻이 있다(글자 인라인 편집 등). 선은 섹션 변에서 이미지까지
     «둘의 밖»을 지나므로, 그 구간만으로도 잡을 데는 넉넉하다(실측으로 확인할 자리). */
  function _installPullDblClick() {
    const wrap = _wrap();
    if (!wrap || wrap.__splPullDbl) return true;
    wrap.__splPullDbl = true;
    wrap.addEventListener('dblclick', (e) => {
      if (!_showEdges) return;                       // 선이 안 보이면 당길 손잡이도 없다
      if (e.target.closest('.section-block, .scratch-item, [contenteditable="true"]')) return;
      const hit = _linkAtPoint(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault(); e.stopPropagation();
      pullLink(hit.unit.ids[0]);   // ★묶음의 아무 멤버나 — pullLink 가 묶음으로 되살려 전원을 옮긴다
    });
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // [P3 = 연결 UX]  스크래치 이미지 «선택/버튼» → [노드연결] → 섹션 클릭 → 연결.
  //   · 각 «미연결» .scratch-item 에 🔗 버튼 주입(scratch-pad.js 무편집). 클릭 시 링크 모드.
  //   · 링크 모드: body.spl-linking(섹션 점선=CSS 준비됨) + 배너. 섹션 클릭 → addLink → 종료.
  //     여러 개 선택(scratch-selected)돼 있으면 일괄 연결. Esc/빈 곳 클릭 = 취소.
  // ═══════════════════════════════════════════════════════════════════
  let _linkMode = null; // 연결 대기 중인 scratchId 배열 or null

  // 스크래치 아이템 버튼그룹(기존 ✕✨✂ 옆). 상태별: 미연결=🔗링크 / 연결=접기(－/＋)+끊기(⛓).
  function _ensureLinkButtons() {
    const linkMap = new Map(); // scratchId → collapsed
    for (const l of allLinks()) linkMap.set(l.scratchId, !!l.collapsed);
    document.querySelectorAll('.scratch-item').forEach(el => {
      const id = el.dataset.scratchId;
      let grp = el.querySelector(':scope > .spl-btns');
      if (!grp) {
        grp = document.createElement('div'); grp.className = 'spl-btns';
        grp.addEventListener('mousedown', e => e.stopPropagation()); // 드래그 방해 금지
        el.appendChild(grp);
      }
      const linked = linkMap.has(id);
      const collapsed = linked && linkMap.get(id);
      const want = linked ? ('L' + (collapsed ? 'c' : 'e')) : 'U';
      if (grp.dataset.state === want) return; // 상태 불변 → 재빌드 skip
      grp.dataset.state = want;
      grp.innerHTML = '';
      const mk = (cls, html, title, fn) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'spl-btn ' + cls;
        /* ★`fn` 에 «이벤트를 넘긴다» — ⌘(Meta) 를 보려면 손잡이가 이벤트를 받아야 한다(⌘＋🔗 = linkToNewSection).
           ⛔그냥 클릭의 길은 이것으로 «안» 바뀐다 — 받는 쪽이 metaKey 가 거짓이면 예전 그대로 startLinkMode 로 간다.
           (접기·끊기 손잡이는 인자를 안 쓰는 화살표라 늘어난 인자를 그냥 버린다.) */
        b.innerHTML = html; b.title = title; b.onclick = e => { e.stopPropagation(); fn(e); };
        grp.appendChild(b);
      };
      if (!linked) {
        mk('spl-btn-link', '🔗', '섹션에 연결', (ev) => {
          /* ★⌘(Meta)＋클릭 = «연결된 빈 섹션»을 바로 만든다(연결 모드를 안 켠다) — 현빈 2026-10-07 시안 ①.
             ⛔«그냥» 클릭의 두 줄은 한 글자도 안 바뀌었다(현빈 ②) — 아래 그대로다. 그걸 무는 검사 = tests/dom/cmd-link-new-section L1·L2. */
          if (ev && ev.metaKey) { linkToNewSection(_cmdLinkTargets(id)); return; }
          const selIds = [...document.querySelectorAll('.scratch-item.scratch-selected')].map(x => x.dataset.scratchId);
          const ids = (selIds.length > 1 && selIds.includes(id)) ? selIds : [id];
          startLinkMode(ids);
        });
      } else {
        mk('spl-btn-fold', collapsed ? '＋' : '－', collapsed ? '펼치기' : '접기(최소화)', () => setCollapsed(id, !collapsed));
        mk('spl-btn-cut', '⛓', '연결 끊기(이미지는 스크래치에 남음)', () => removeLink(id));
      }
    });
  }

  function _banner(on) {
    let el = document.getElementById('spl-banner');
    if (on) {
      if (!el) { el = document.createElement('div'); el.id = 'spl-banner'; el.className = 'spl-banner'; document.body.appendChild(el); }
      el.textContent = '🔗 연결 모드 — 캔버스에서 «섹션»을 클릭하세요 (취소: Esc)';
      el.style.display = 'block';
    } else if (el) { el.style.display = 'none'; }
  }

  function startLinkMode(ids) {
    if (!ids || !ids.length) return;
    _linkMode = ids.slice();
    document.body.classList.add('spl-linking');
    _banner(true);
  }
  function endLinkMode() {
    _linkMode = null;
    document.body.classList.remove('spl-linking');
    _banner(false);
  }
  /* ══ ⌘(Meta)＋🔗 = «연결된 빈 섹션»을 바로 만든다 ═══════════════════════════════════════
   * 현빈 2026-10-07 시안 승인 ①~⑤. 지금까지는 「섹션을 먼저 만들고 → 🔗 → 연결 모드에서 그 섹션을 찾아 클릭」
   * 이었다. 그 순서를 뒤집는다. ⛔«그냥» 🔗(연결 모드)는 그대로다 — 현빈 ②.
   *
   * ⑴ ★섹션은 «하나»다 — 그룹(④)이든 여러 장을 따로 골랐든(⑤) 전부 «그 한 섹션»에 연결한다.
   * ⑵ ★자리는 «캔버스 맨 아래»(⑤) — ⛔addSection 의 «기본»은 맨 아래가 아니다(block-factory.js:1528
   *    `.section-block.selected` 가 있으면 «그 다음»에 끼운다 — 실측). 🔗 는 섹션 선택을 안 바꾸므로
   *    옵션 없이 부르면 섹션이 «중간»에 생긴다. ⇒ afterId 로 «마지막 섹션»을 못박는다.
   *    ⛔ghost 섹션([data-ghost])을 그 명부에서 «뺀다» — addSection 이 자기 머리에서 ghost 를 먼저 지우므로
   *      그 id 를 afterId 로 주면 ref 가 «부모 없는» 노드가 되고 `ref.after(sec)` 는 조용히 아무 일도 안 하는데
   *      placed=true 가 돼 «새 섹션이 DOM 에 안 붙는다».
   * ⑶ ★★「빈 섹션」＝ ★캔버스에서 `s` 를 눌러 생기는 ★그 섹션이다 (현빈 2026-10-07 답 · 원문:
   *    「캔버스에서 's'를 누르면 섹션이 추가되잖아? 그걸 원하는거야 … [S눌러 섹션추가 > 링크연결] 이 과정을 패스하고 싶은 거야」).
   *    ⇒ ★`addSection` 에 ★옵션을 «더 주지 않는다» — `s` 의 길이 `window.addSection?.()` 를 ★인자 없이 부르므로
   *      (js/editor.js:2678~2686 `_isAddSection` · 기본 키 `KeyS` = js/settings/settings-store.js:28 — ★직접 확인),
   *      여기서도 `skipDefaultBlock` 을 ★주지 않아야 «같은 섹션»이 된다.
   *    ⛔한때 `skipDefaultBlock: true` 였다(레포가 그 옵션을 「빈 섹션」이라 부르고 — block-factory.js:1450 —
   *      «스크래치 → 새 섹션» 선례 js/canvas-scratch-drop.js:532 도 그 꼴이라). ★현빈이 ★「s 와 같은 것」으로 정정했다.
   *      ⇒ ★이 자리를 다시 「빈 섹션 옵션」으로 되돌리지 마라.
   *    ★높이는 그대로 «기본»이다(③) — ⛔스크래치패드 길이에 ★안 맞춘다. 재는 자 = L8(「`s` 가 만든 섹션과 ★같은 꼴인가」).
   * ⑷ ★★⌘Z 는 «한 걸음»이다(현빈 5). 이 제스처는 입구가 둘(addSection · addLink×N)이고 셋이 각자 pushHistory 를
   *    부르며, 게다가 window.addSection 은 js/insert-history.js 가 감싸 «끝 표본»을 한 칸 더 쌓는다(EXTRA 명부에 있다).
   *    그냥 부르면 ⌘Z 가 «두 걸음»이 되고 첫 걸음이 「섹션은 남고 연결만 풀림」이 된다.
   *    ⇒ 「변경 전」을 내가 «한 번» 찍고 → 안쪽 전부를 노옵으로 막고 → 끝에 「끝 표본」을 찍는다.
   *    ★선례 셋 — js/ai-section-fill.js:441(pushHistory 를 노옵으로 갈아끼운 뒤 입구를 N번 부른다. 두 래퍼가
   *      규약 ①「pushHistory 는 «부를 때» 읽는다」로 이 자리를 «일부러» 보장한다) · js/editor.js duplicateSelected
   *      ('복제'/'복제 완료' 양쪽 끝) · js/props/prop-grid.js grdMoveLineToCell(첫 문만 쌓고 나머지는 끈다 =
   *      그 한 칸이 «둘 다 바뀌기 전»을 담는다). ⛔pushHistory 를 미리 변수로 잡지 마라(같은 규약 ①).
   *    ★노옵이면 seq 가 안 움직여 insert-history 의 «끝 표본 갱신»(restamp)도 예약되지 않는다 — 그 파일이 적어 둔
   *      바로 그 가드다(ai-section-fill 자리에서 실측된 것). 즉 이 꼴은 그 파일이 «이미 알고 있는» 꼴이다.
   * ⑸ ★metaKey «만» 본다 — ctrlKey 는 안 받는다. 까닭: 이 레포의 «마우스» 수식어는 metaKey 단독이 관례이고
   *    (sticker-select.js:437 · overlay-float.js:617,636 · zoom-block.js:336 · mockup-block.js:155 · scratch-pad.js:484),
   *    둘 다 보는 꼴(90건 중 57건)은 전부 «키보드» 단축키다. 그리고 맥에서 Ctrl+클릭 = 보조 클릭(우클릭)이라
   *    넓히면 그 자리에서 샌다. (윈도/리눅스 배포에서 ⌘ 가 없다는 것은 아는 구멍이다 — 지디 보고 ⑦.)
   * ⛔sourceScratchIds 는 «안» 쓴다(섹션 메모에 「출처: sp_…」를 적는 옵션) — 지디 보고 ⑦.
   */

  /* ⌘＋🔗 의 «대상» — 선택(둘 이상·나를 포함) → 그룹(g) → 나 혼자.
     ★이 순서는 스크래치패드의 다른 제스처와 «같은 순서»다(js/scratch-pad.js:686 그룹 리사이즈의
       「복수 선택 > 그룹 > 단독」). ⛔여기서 새 순서를 발명하지 마라.
     ★그룹은 DOM 에서 읽는다 — el.dataset.scratchGroup 은 _createItem(js/scratch-pad.js:594)이 심고
       그룹·언그룹·되돌리기 스냅샷이 같이 고친다. 이 파일은 플레인 스크립트라 그쪽 모듈 상태(_scratchItems)를 못 본다. */
  function _cmdLinkTargets(id) {
    const sel = [...document.querySelectorAll('.scratch-item.scratch-selected')]
      .map(x => x.dataset.scratchId).filter(Boolean);
    if (sel.length > 1 && sel.includes(id)) return sel;
    const me = _scEl(id);
    const g = me && me.dataset.scratchGroup;
    if (g) {
      /* ⛔이 변수를 `esc` 라 부르지 마라 — 「esc」로 시작하는 이름은 레포에서 «꺾쇠를 막는 함수»의 이름이고,
         tests/unit/name-axes-to-markup.test.mjs XS3 이 그 이름을 가진 자가 진짜로 막는지 잰다(실측: 처음에 `esc`
         라 써서 그 게이트가 빨개졌다). 이것은 CSS 선택자 탈출이다 — 다른 일이다. */
      const gSel = (window.CSS && CSS.escape) ? CSS.escape(g) : g;
      const mem = [...document.querySelectorAll('.scratch-item[data-scratch-group="' + gSel + '"]')]
        .map(x => x.dataset.scratchId).filter(Boolean);
      if (mem.length) return mem;
    }
    return [id];
  }

  /* ★돌려주는 것은 «뜻»을 갖는다 — {ok:false,code} 어휘는 js/scratch-pad.js _scratchDuplicateItem 의 것을 빌린다.
     (검사가 「왜 안 됐나」를 이름으로 물을 수 있어야 한다 — 조용한 false 하나로 뭉치지 않는다.) */
  function linkToNewSection(ids) {
    if (!Array.isArray(ids) || !ids.length) return { ok: false, code: 'NO_IDS' };
    if (typeof window.addSection !== 'function') {
      console.warn('[spl] addSection 누락 — ⌘＋🔗 스킵');
      return { ok: false, code: 'NO_ADD_SECTION' };
    }
    const canvas = document.getElementById('canvas');
    if (!canvas) return { ok: false, code: 'NO_CANVAS' };
    const before = new Set(_allSecs().map(s => s.id));
    const tails = canvas.querySelectorAll('.section-block:not([data-ghost])');   // ⛔ghost 제외 — 위 ⑵
    const tailId = tails.length ? tails[tails.length - 1].id : null;

    window.pushHistory && window.pushHistory('참고이미지 → 새 섹션');   // ★「변경 전」 = 이 제스처의 ⌘Z 과녁
    const origPush = window.pushHistory;
    window.pushHistory = () => {};                                     // ★안쪽 입구들의 칸을 막는다(위 ⑷)
    let sec = null;
    try {
      window.addSection({ afterId: tailId || undefined });
      /* ★새 섹션을 «id 차집합»으로 집는다 — ⛔`sections[length-1]` 로 집지 마라(선례
         js/canvas-scratch-drop.js:530 이 그렇게 집는다). addSection 의 자리 규칙이 바뀌거나 ghost 가
         끼면 그 꼴은 «남의 섹션»을 집는다. 차집합은 어디에 생겨도 맞는다. */
      sec = _allSecs().find(s => !before.has(s.id)) || null;
      /* ★`addLinks` 를 쓴다 — 여기선 바깥이 이미 pushHistory 를 노옵으로 막아 두었으므로
         그 안쪽의 「변경 전」 한 칸도 같이 삼켜진다(두 겹이지만 ★한 걸음은 그대로다). */
      if (sec) addLinks(sec.id, ids);
    } finally {
      window.pushHistory = origPush;                                   // 규약 ② — 던져도 되돌린다
    }
    if (!sec) {
      /* ⚠️여기로 오면 위 「변경 전」 칸 하나가 «헛돈다»(화면이 안 바뀐 칸). 새로 생긴 성질이 아니다 —
         js/props/prop-grid.js grdMoveLineToCell 이 같은 성질을 같은 말로 적어 뒀다(첫 문만 쌓인 실패). */
      console.warn('[spl] 새 섹션을 못 찾았다 — 연결 스킵');
      return { ok: false, code: 'NO_SECTION' };
    }
    window.pushHistory && window.pushHistory('참고이미지 → 새 섹션 완료');   // ★「끝 표본」(위 ⑷ 선례)
    const n = _parse(sec).length;
    window.showToast?.('🔗 빈 섹션을 만들고 참고이미지 ' + n + '개를 연결했습니다');
    return { ok: true, sectionId: sec.id, linked: n };
  }

  // 링크 모드 중 섹션 클릭 가로채기(capture) → 연결. 다른 클릭=취소.
  function _onDocClickCapture(e) {
    if (!_linkMode) return;
    const sec = e.target.closest && e.target.closest('.section-block');
    if (sec) {
      e.preventDefault(); e.stopPropagation();  // 일반 섹션 선택 차단
      const ids = _linkMode; endLinkMode();
      /* ★[#16-G] `addLink` 를 N번이 아니라 `addLinks` 한 번 — ⌘Z 가 «한 걸음»이 된다. */
      const n = addLinks(sec.id, ids);
      if (n) window.showToast?.('🔗 참고이미지 ' + n + '개 연결됨');
    } else {
      // 배너/링크버튼 클릭이 아니면 취소
      if (!e.target.closest('#spl-banner') && !e.target.closest('.spl-btns')) endLinkMode();
    }
  }
  function _onKeyDown(e) { if (e.key === 'Escape' && _linkMode) { e.stopPropagation(); endLinkMode(); } }

  function _installLinkUX() {
    if (window.__splLinkUX) return;
    document.addEventListener('click', _onDocClickCapture, true); // capture: 섹션 핸들러보다 먼저
    document.addEventListener('keydown', _onKeyDown, true);
    window.__splLinkUX = true;
  }

  function _boot() {
    _applySavedShowEdges();   // [#16-B] 이벤트가 «이미» 지나갔을 경우의 두 번째 문
    _installFollow();
    _installLinkUX();
    _installPullDblClick();   // [P4] 연결선 더블클릭 = 당기기
    if (!_installSectionHook()) setTimeout(_installSectionHook, 300);
    __spLinkRerender();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_boot, 200));
  else setTimeout(_boot, 200);

  /* [SP1 템플릿 무링크] «분리된» 트리(템플릿 클론·삽입 직전 요소)에서 링크 토큰을 전부 벗긴다.
     ⛔라이브 요소에 쓰지 마라 — 링크를 «지우는» 함수다(removeLink 와 달리 history·스크래치·sideEffects 무접촉).
     ★속성 이름을 «여기서만» 안다(ATTR) — 호출자(template-system.js)는 문자열을 적지 않는다.
     루트 자신 + 모든 자손(섹션 루트가 아니라 블록·프레임 템플릿도 토큰을 실을 수 있다). 지운 개수를 돌려준다. */
  const _ATTR_KEBAB = 'data-' + ATTR.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  function stripTokens(root) {
    if (!root || !root.querySelectorAll) return 0;
    let n = 0;
    if (root.dataset && root.dataset[ATTR] !== undefined) { delete root.dataset[ATTR]; n++; }
    root.querySelectorAll('[' + _ATTR_KEBAB + ']').forEach((el) => { delete el.dataset[ATTR]; n++; });
    return n;
  }

  window.SPLink = {
    stripTokens,
    linksForSection, sectionIdOf, isLinked, linkedScratchIds, allLinks,
    addLink, addLinks, removeLink, setCollapsed, setCollapsedAll, setShowEdges,
    startLinkMode, endLinkMode,
    linkToNewSection,     // ⌘＋🔗 — «빈 섹션 하나»를 만들어 전부 거기에 연결(검사·프로그램 호출용)
    _cmdLinkTargets,      // 그 제스처의 대상 결정(선택>그룹>단독) — 검사용
    /* [#16-DUP] 「임의의 «분리 상태» 섹션 요소」를 받는 공개 API — 붙여넣기가 부른다.
       ⛔반드시 DOM 삽입 «전»에 부를 것(윗 주석 참조). §7-A 형제 경로 배선은 이번 범위 밖. */
    rewireClonedSection,
    /* [#16-DEL] 섹션 삭제의 «링크 처분» — 호출 순서가 계약이다:
         release(①링크 끊기 →②고아 삭제) → 호출자가 ③sec.remove() → pushHistory(…, sideEffects) */
    linksOfSections, refCount, releaseSectionsForDelete,
    rerender: __spLinkRerender,
    resyncFollow,          // undo/redo 좌표복원 직후 추종 기준선 재동기화(scratch-pad.js 호출)
    _applyFollow,          // 테스트/강제 1회 적용
    pullLink,              // [P4] 연결선 더블클릭 = 이 함수(프로그램 호출·검사용)
    // 내부 유틸(P2 렌더/테스트용 · P4 판정)
    _parse, _write, _edgeEnds, _distToSeg, _linkAtPoint, _pullDest,
    /* [#16-G] 연결의 «단위» — 검사가 「선이 몇 개여야 하나」를 소스 말고 ★여기로 물을 수 있게 연다.
       ⛔그룹 id 값을 기대하지 마라(`'g_'+Math.random()`) — 존재/개수로 재라. */
    _units, _unitOf, _unitBox, _groupOf,
  };
})();
