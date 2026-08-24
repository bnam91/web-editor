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

  function _ensureOverlay() {
    const wrap = _wrap();
    if (!wrap) return null;
    let edges = document.getElementById('link-edges');
    let side  = document.getElementById('link-sidecar');
    if (!edges) {
      edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      edges.id = 'link-edges'; edges.setAttribute('class', 'spl-edges');
      wrap.appendChild(edges);
    }
    if (!side) {
      side = document.createElement('div');
      side.id = 'link-sidecar'; side.className = 'spl-sidecar';
      wrap.appendChild(side);
    }
    return { edges, side };
  }

  // 라이브 스크래치 아이템의 이미지 src(참조). 없으면 null.
  function _scratchSrc(scratchId) {
    const it = document.querySelector('.scratch-item[data-scratch-id="' + (window.CSS && CSS.escape ? CSS.escape(scratchId) : scratchId) + '"] img');
    return it ? it.getAttribute('src') : null;
  }

  // 스크래치 pane 필터 — 연결된 아이템은 캔버스에서 숨김(데이터 무손상).
  function _filterScratchPane() {
    const linked = new Set(linkedScratchIds());
    document.querySelectorAll('.scratch-item').forEach(el => {
      const id = el.dataset.scratchId;
      if (linked.has(id)) { if (el.style.display !== 'none') { el.dataset.splHidden = '1'; el.style.display = 'none'; } }
      else if (el.dataset.splHidden) { el.style.display = ''; delete el.dataset.splHidden; } // 우리가 숨긴 것만 복구
    });
  }

  // 사이드카 카드/그룹 재구성(데모 reconcile 포팅). 그룹=섹션별, 카드=refimg.
  function _renderSidecar() {
    const ov = _ensureOverlay(); if (!ov) return;
    const side = ov.side;
    const bySec = new Map(); // secId → [{scratchId,collapsed}]
    for (const sec of _allSecs()) {
      const ls = _parse(sec);
      if (ls.length) bySec.set(sec.id, ls);
    }
    const wantG = new Set();
    bySec.forEach((ls, secId) => {
      wantG.add(secId);
      let g = side.querySelector(':scope > .spl-note-group[data-sec="' + secId + '"]');
      if (!g) { g = document.createElement('div'); g.className = 'spl-note-group'; g.dataset.sec = secId; side.appendChild(g); }
      const wantC = new Set();
      ls.forEach(l => {
        wantC.add(l.scratchId);
        let card = g.querySelector(':scope > .spl-refimg[data-scratch-id="' + l.scratchId + '"]');
        if (!card) {
          card = document.createElement('div');
          card.dataset.scratchId = l.scratchId;
          g.appendChild(card);
        }
        card.className = 'spl-refimg' + (l.collapsed ? ' collapsed' : '');
        const src = _scratchSrc(l.scratchId) || '';
        card.innerHTML =
          '<div class="spl-thumb"><img src="' + src.replace(/"/g, '&quot;') + '" draggable="false" onerror="var c=this.closest(&quot;.spl-refimg&quot;);if(c)c.classList.add(&quot;spl-missing&quot;)"></div>' +
          '<div class="spl-cap">' +
            '<button class="spl-ic" data-a="fold" title="' + (l.collapsed ? '펼치기' : '접기') + '">' + (l.collapsed ? '＋' : '－') + '</button>' +
            '<button class="spl-ic" data-a="unlink" title="연결 해제(스크래치로 복귀)">⛌</button>' +
          '</div>';
        card.querySelector('[data-a=fold]').onclick   = e => { e.stopPropagation(); setCollapsed(l.scratchId, !l.collapsed); };
        card.querySelector('[data-a=unlink]').onclick = e => { e.stopPropagation(); removeLink(l.scratchId); };
      });
      // 사라진 카드 제거
      g.querySelectorAll(':scope > .spl-refimg').forEach(card => { if (!wantC.has(card.dataset.scratchId)) card.remove(); });
    });
    // 사라진 그룹 제거
    side.querySelectorAll(':scope > .spl-note-group').forEach(g => { if (!wantG.has(g.dataset.sec)) g.remove(); });
  }

  // 댓글 레일 push-down(데모 positionTops 포팅) — 섹션 top에 붙되 위 그룹과 안 겹치게 밀어냄.
  function _positionTops() {
    const wrap = _wrap(); const side = document.getElementById('link-sidecar');
    if (!wrap || !side) return;
    const wrapRect = wrap.getBoundingClientRect();
    const scaler = _scaler();
    // 사이드카 x = 캔버스(#canvas) 우변 + gap (스크린 좌표를 wrap 기준 상대로)
    const canvas = document.getElementById('canvas');
    const cRect = (canvas || scaler || wrap).getBoundingClientRect();
    const leftPx = Math.round(cRect.right - wrapRect.left + wrap.scrollLeft + 16); // content-space

    let minTop = -1e9;
    // DOM 순서(=섹션 순서)대로 그룹 배치
    _allSecs().forEach(sec => {
      const g = side.querySelector(':scope > .spl-note-group[data-sec="' + sec.id + '"]');
      if (!g) return;
      const secRect = sec.getBoundingClientRect();
      const secTop = secRect.top - wrapRect.top + wrap.scrollTop;
      const top = Math.max(secTop, minTop);
      g.style.left = leftPx + 'px';
      g.style.top  = top + 'px';
      minTop = top + g.offsetHeight + 12;
    });
  }

  function _drawEdges() {
    const wrap = _wrap(); const edges = document.getElementById('link-edges');
    if (!wrap || !edges) return;
    const wrapRect = wrap.getBoundingClientRect();
    const W = Math.max(wrap.scrollWidth, wrapRect.width), H = Math.max(wrap.scrollHeight, wrapRect.height); // content-space 전체
    edges.setAttribute('width', W); edges.setAttribute('height', H);
    edges.style.width = W + 'px'; edges.style.height = H + 'px';
    if (!_showEdges) { edges.innerHTML = ''; return; }
    let s = '';
    for (const { sectionId, scratchId } of allLinks()) {
      const sec = document.getElementById(sectionId);
      const card = document.querySelector('#link-sidecar .spl-refimg[data-scratch-id="' + scratchId + '"]');
      if (!sec || !card) continue;
      const sr = sec.getBoundingClientRect(), nr = card.getBoundingClientRect();
      const x1 = sr.right - wrapRect.left + wrap.scrollLeft, y1 = sr.top + sr.height / 2 - wrapRect.top + wrap.scrollTop;
      const x2 = nr.left - wrapRect.left + wrap.scrollLeft,  y2 = nr.top + Math.min(nr.height, 52) / 2 + 2 - wrapRect.top + wrap.scrollTop;
      s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    }
    edges.innerHTML = s;
  }

  function _relayout() { _positionTops(); _drawEdges(); }
  function _scheduleRelayout() {
    if (_relayoutRAF) return;
    _relayoutRAF = requestAnimationFrame(() => { _relayoutRAF = null; _relayout(); });
  }

  // 전체 재렌더(P1 CRUD·로드·undo/redo·협업이 호출) — 필터 + 사이드카 + 레이아웃.
  function __spLinkRerender() {
    try {
      _filterScratchPane();
      _ensureLinkButtons();
      _renderSidecar();
      _relayout();
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

  function _ensureLinkButtons() {
    document.querySelectorAll('.scratch-item').forEach(el => {
      if (el.dataset.splHidden) return;                 // 연결된(숨김) 아이템엔 불필요
      if (el.querySelector(':scope > .spl-link-btn')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'spl-link-btn'; b.innerHTML = '🔗'; b.title = '섹션에 노드연결';
      b.addEventListener('mousedown', e => e.stopPropagation()); // 드래그 방해 금지
      b.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.scratchId;
        // 선택셋에 이 아이템 포함 다중선택이면 선택셋 전체, 아니면 이 아이템만
        const selIds = [...document.querySelectorAll('.scratch-item.scratch-selected')].map(x => x.dataset.scratchId);
        const ids = (selIds.length > 1 && selIds.includes(id)) ? selIds : [id];
        startLinkMode(ids);
      });
      el.appendChild(b);
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
      if (!e.target.closest('#spl-banner') && !e.target.closest('.spl-link-btn')) endLinkMode();
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
