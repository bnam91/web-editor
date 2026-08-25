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
// export(HTML/figma/.gdt) 에서는 refLinks 를 strip 한다(死참조 = 배송본 쓰레기) — 저장경로엔 유지.
//   strip 은 export 경로 파일에서 처리(이 파일 아님).

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
    return true;
  }
  // 해제: refLinks 에서 제거(이미지는 스크래치에 그대로 → pane 자동복귀).
  function removeLink(scratchId) {
    const secId = sectionIdOf(scratchId);
    if (!secId) return false;
    window.pushHistory && window.pushHistory('참고이미지 연결 해제');
    const sec = _secEl(secId);
    _write(sec, _parse(sec).filter(l => l.scratchId !== scratchId));
    _clearAnchor(scratchId); // 해제 = 다시 완전 자유(오프셋 폐기)
    _rerender(); _save();
    return true;
  }
  // 접기/펼치기(경량 — history 없이 상태만·저장은 함; reload 는 dataset 로 유지)
  function setCollapsed(scratchId, val) {
    const secId = sectionIdOf(scratchId);
    if (!secId) return false;
    const sec = _secEl(secId);
    const arr = _parse(sec);
    const l = arr.find(x => x.scratchId === scratchId);
    if (!l || l.collapsed === !!val) return false;
    l.collapsed = !!val;
    _write(sec, arr);
    _rerender(); _save();
    return true;
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

  let _lastEdgePath = null; // diff-skip 캐시(좌표 불변 시 DOM 미변경)

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
      for (const { sectionId, scratchId } of allLinks()) {
        const sec = document.getElementById(sectionId);
        const item = _scEl(scratchId);
        if (!sec || !item) continue;
        const ir = item.getBoundingClientRect(), sr = sec.getBoundingClientRect();
        const ix = toLocalX(ir.left + ir.width / 2), iy = toLocalY(ir.top + ir.height / 2); // 스크래치 중심
        const attachRight = (ir.left + ir.width / 2) > (sr.left + sr.width / 2);
        const sx = toLocalX(attachRight ? sr.right : sr.left), sy = toLocalY(sr.top + sr.height / 2);
        s += '<line x1="' + ix.toFixed(1) + '" y1="' + iy.toFixed(1) + '" x2="' + sx.toFixed(1) + '" y2="' + sy.toFixed(1) + '"/>' +
             '<circle cx="' + ix.toFixed(1) + '" cy="' + iy.toFixed(1) + '" r="3.5" class="spl-edge-dot"/>';
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
        b.innerHTML = html; b.title = title; b.onclick = e => { e.stopPropagation(); fn(); };
        grp.appendChild(b);
      };
      if (!linked) {
        mk('spl-btn-link', '🔗', '섹션에 연결', () => {
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
  // 링크 모드 중 섹션 클릭 가로채기(capture) → 연결. 다른 클릭=취소.
  function _onDocClickCapture(e) {
    if (!_linkMode) return;
    const sec = e.target.closest && e.target.closest('.section-block');
    if (sec) {
      e.preventDefault(); e.stopPropagation();  // 일반 섹션 선택 차단
      const ids = _linkMode; endLinkMode();
      let any = false;
      ids.forEach(id => { if (addLink(sec.id, id)) any = true; });
      if (any) window.showToast?.('🔗 참고이미지 ' + ids.length + '개 연결됨');
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
    _installFollow();
    _installLinkUX();
    if (!_installSectionHook()) setTimeout(_installSectionHook, 300);
    __spLinkRerender();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_boot, 200));
  else setTimeout(_boot, 200);

  window.SPLink = {
    linksForSection, sectionIdOf, isLinked, linkedScratchIds, allLinks,
    addLink, removeLink, setCollapsed, setShowEdges,
    startLinkMode, endLinkMode,
    rerender: __spLinkRerender,
    resyncFollow,          // undo/redo 좌표복원 직후 추종 기준선 재동기화(scratch-pad.js 호출)
    _applyFollow,          // 테스트/강제 1회 적용
    // 내부 유틸(P2 렌더/테스트용)
    _parse, _write,
  };
})();
