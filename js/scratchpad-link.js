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
  function _ensureEdges() {
    const wrap = _wrap();
    if (!wrap) return null;
    // 구설계 사이드카 잔재 제거(리워크 후 남아있을 수 있음)
    const stale = document.getElementById('link-sidecar');
    if (stale) stale.remove();
    let edges = document.getElementById('link-edges');
    if (!edges) {
      edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      edges.id = 'link-edges'; edges.setAttribute('class', 'spl-edges');
      wrap.appendChild(edges);
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

  // 연결선: 스크래치 아이템(중심) → 연결된 섹션(가까운 세로변 중앙). 둘 다 #canvas-scaler(줌/팬) 안이라
  //   getBoundingClientRect(post-transform)로 스크린좌표 일관. edges는 wrap(스크린) → 일치·줌팬 자동추종.
  function _drawEdges() {
    const wrap = _wrap(); const edges = _ensureEdges();
    if (!wrap || !edges) return;
    const wrapRect = wrap.getBoundingClientRect();
    const W = Math.max(wrap.scrollWidth, wrapRect.width), H = Math.max(wrap.scrollHeight, wrapRect.height);
    edges.setAttribute('width', W); edges.setAttribute('height', H);
    edges.style.width = W + 'px'; edges.style.height = H + 'px';
    if (!_showEdges) { edges.innerHTML = ''; return; }
    let s = '';
    for (const { sectionId, scratchId } of allLinks()) {
      const sec = document.getElementById(sectionId);
      const item = _scEl(scratchId);
      if (!sec || !item) continue;
      const ir = item.getBoundingClientRect(), sr = sec.getBoundingClientRect();
      const ix = ir.left + ir.width / 2 - wrapRect.left + wrap.scrollLeft;   // 스크래치 아이템 중심
      const iy = ir.top + ir.height / 2 - wrapRect.top + wrap.scrollTop;
      const attachRight = (ir.left + ir.width / 2) > (sr.left + sr.width / 2); // 아이템이 섹션 오른쪽이면 우변에
      const sx = (attachRight ? sr.right : sr.left) - wrapRect.left + wrap.scrollLeft;
      const sy = sr.top + sr.height / 2 - wrapRect.top + wrap.scrollTop;      // 섹션 세로 중앙
      s += '<line x1="' + ix + '" y1="' + iy + '" x2="' + sx + '" y2="' + sy + '"/>' +
           '<circle cx="' + ix + '" cy="' + iy + '" r="3.5" class="spl-edge-dot"/>';
    }
    edges.innerHTML = s;
  }

  function _relayout() { _drawEdges(); }
  function _scheduleRelayout() {
    if (_relayoutRAF) return;
    _relayoutRAF = requestAnimationFrame(() => { _relayoutRAF = null; _relayout(); });
  }

  // 전체 재렌더(CRUD·로드·undo/redo·협업 호출) — 상태별 버튼 + 접힘 + 연결선. ★사이드카/pane필터 폐기.
  function __spLinkRerender() {
    try {
      _ensureLinkButtons();
      _applyCollapsed();
      _drawEdges();
    } catch (e) { console.warn('[spl] rerender err:', e); }
  }
  window.__spLinkRerender = __spLinkRerender;
  window.__spLinkRelayout = _scheduleRelayout; // 줌/팬 코드가 호출 가능
  function setShowEdges(v) { _showEdges = !!v; _drawEdges(); }

  // ── 추종 트리거: 스크롤/리사이즈/스케일러 transform 변화 → rAF 스로틀 relayout ──
  function _installFollow() {
    const wrap = _wrap(); if (!wrap || wrap.__splFollow) return true;
    wrap.__splFollow = true;
    wrap.addEventListener('scroll', _scheduleRelayout, { passive: true });
    window.addEventListener('resize', _scheduleRelayout, { passive: true });
    const scaler = _scaler();
    if (scaler) {
      // style(줌/팬 transform) 변경 → relayout / childList(스크래치 아이템 추가·제거) → 전체 재렌더(버튼 주입·필터).
      const mo = new MutationObserver(muts => {
        let child = false;
        for (const m of muts) if (m.type === 'childList') { child = true; break; }
        if (child) _scheduleRerender(); else _scheduleRelayout();
      });
      mo.observe(scaler, { attributes: true, attributeFilter: ['style'], childList: true });
    }
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
    // 내부 유틸(P2 렌더/테스트용)
    _parse, _write,
  };
})();
