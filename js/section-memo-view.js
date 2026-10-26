// section-memo-view.js — «메모 있는 섹션»을 한눈에 가르는 보기 (t3-06 · 현빈 ㄱ+ㄴ+ㄷ+㉱)
//
// 현빈 원문: 「노트가 있는 섹션과 없는 섹션을 구분해서 내가 좀 볼 수 있었으면 좋겠어 … 좌측의 투두 패널 …」
// 정본 시안: sian-11-section-memo-t306-v1 (taeyang-098/sian-t306) · 계획: reports/S6-FIX5/plan-t306.md
//
// ★판정은 하나 — `data-memo` 가 있고 빈 글이 아니면 «있음». 공백만 있는 메모도 «있음»이다
//   (제품 규칙 그대로: js/section-memo.js setSectionMemo 는 빈 글일 때만 속성을 지운다).
//   CSS 는 같은 뜻을 `[data-memo]:not([data-memo=""])` 로 쓴다(css/editor-layout.css ㉮).
//
// 이 파일이 맡는 셋:
//   ㉯ 메모 있는 섹션 왼쪽 «바깥 탭» — #section-memo-overlay(#canvas 밖 형제 · 선례 #todo-pin-overlay).
//      마우스를 올리면 메모 미리보기, 누르면 메모 창.
//   ㉰ 체크리스트 탭 맨 위 «📝 섹션 메모» 접이 묶음 — 누르면 selectSection(sec, true) + 번쩍.
//   ㉱ 레이어 패널 섹션 행의 📝 아이콘 (행을 지을 때 layer-panel.js 가 syncLayerHeader 를 부른다).
//   (㉮ 툴바 📝 단추 채움/빈 은 CSS 만 — DOM 쓰기 0)
//
// ⛔★#canvas 안에는 «아무것도 안 쓴다» (속성·class·자식 전부). 그래서
//   ⑴ 저장본(getSerializedCanvas)·내보내기·PNG 클론에 표식이 샐 길이 없고
//   ⑵ autoSave 의 MutationObserver(js/io/save-load.js autoSaveObserver — #canvas 하나만 본다)를 깨우지 않는다.
//   번쩍(도착 표시)도 섹션에 class 를 달지 않고 덧층에 그린다.
// ⛔★체크리스트(투두) 데이터·코드는 안 건드린다 — window._ckItems/_ckSections(js/checklist-data.js) ·
//   프로젝트 JSON checklistItems/checklistSections(js/io/save-load.js:663-664) 는 읽지도 않는다.
//   묶음은 #checklist-panel-body 의 «자식 갈이»를 지켜보다 다시 꽂는다(renderChecklistPanel 이 innerHTML 을 통째로 갈기 때문).
//   묶음은 #ck-list «밖»이라 목록 끌어놓기(#ck-list 에만 걸림)에 안 걸리고, 줄은 .ck-item 클래스를 안 쓴다.
//
// plain global script (ES module X). index.html 이 js/section-memo.js «뒤»에 싣는다.
// 시험: tests/dom/fix5-section-memo-t306.dom.spec.js

(function () {
  'use strict';

  const SVG_MEMO = '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 1.5 H3 A1 1 0 0 0 2 2.5 V9.5 A1 1 0 0 0 3 10.5 H9 A1 1 0 0 0 10 9.5 V4.1"/><path d="M8.2 1.3 L10.7 3.8 L7.2 7.3 L5.6 7.7 L6 6.1 Z"/></svg>';
  const SVG_CHEV = '<svg class="ck-section-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="2,3 5,7 8,3"/></svg>';
  const TIP_MAX = 220;   // 미리보기 글자 상한 (시안 그대로)

  // ── 판정 · 목록 ────────────────────────────────────────────────────────────
  function sectionHasMemo(sec) {
    if (!sec || typeof sec.getAttribute !== 'function') return false;
    const v = sec.getAttribute('data-memo');
    return v != null && v !== '';
  }
  /* 차례·번호는 레이어 패널과 같은 자 — 유령(data-ghost) 은 빼고 캔버스 순 (js/panels/layer-panel.js buildLayerPanel) */
  function _sections() {
    const c = document.getElementById('canvas');
    return c ? [...c.querySelectorAll('.section-block:not([data-ghost])')] : [];
  }
  /* 숨긴 섹션 = 눈 끔(data-hidden="1") 또는 비활성 변형(data-variation-active="0" · display:none) */
  function _isHiddenSec(sec) {
    return sec.dataset.hidden === '1' || sec.dataset.variationActive === '0';
  }
  function _num(i) { return String(i + 1).padStart(2, '0'); }
  function _name(sec) { return sec._name || sec.dataset.name || sec.id || 'Section'; }

  /* 메모 평문 → 미리보기 글 · 체크 수. 글자 규칙은 js/section-memo-format.js 한 자리(tokenizeMemo). */
  function _digest(memo) {
    const F = window.SectionMemoFormat;
    const toks = F && typeof F.tokenizeMemo === 'function' ? F.tokenizeMemo(memo) : [{ type: 'text', text: String(memo || '') }];
    let text = '', all = 0, done = 0;
    for (const t of toks) {
      if (t.type === 'text') text += t.text;
      else if (t.type === 'br') text += '\n';
      else if (t.type === 'check') { all++; if (t.checked) done++; text += t.checked ? '☑' : '☐'; }
      else if (t.type === 'img') text += '[그림]';
    }
    return { text, all, done };
  }

  // ── 메모 창 · 선택 ─────────────────────────────────────────────────────────
  function _openMemo(sec) {
    let btn = sec.querySelector(':scope > .section-toolbar .st-memo-btn');
    if (!btn) { window._ensureMemoButton?.(sec); btn = sec.querySelector(':scope > .section-toolbar .st-memo-btn'); }
    if (btn) window.toggleSectionMemoPopover?.(btn);
  }
  /* 도착 표시 — 섹션 위에 덧층 사각형을 한 번 번쩍인다(⛔섹션에 class 를 달지 않는다: #canvas 무접촉) */
  function _flash(sec) {
    const ov = _overlay();
    const p = ov && _offsetIn(sec, ov.parentElement);
    if (!p) return;
    ov.querySelectorAll('.smemo-flash').forEach(el => el.remove());
    const f = document.createElement('div');
    f.className = 'smemo-flash';
    f.style.left = p.x + 'px';
    f.style.top = p.y + 'px';
    f.style.width = sec.offsetWidth + 'px';
    f.style.height = sec.offsetHeight + 'px';
    ov.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }
  function _goTo(sec) {
    if (typeof window.selectSection !== 'function' || !sec.isConnected) return;
    /* 비활성 변형은 display:none 이라 잴 자리가 없다 — 고르기만 하고 스크롤은 안 한다 */
    const visible = sec.offsetParent !== null;
    window.selectSection(sec, visible);
    if (visible) _flash(sec);
    _syncSelected();
  }

  // ── ㉯ 덧층 바깥 탭 ────────────────────────────────────────────────────────
  function _overlay() {
    let ov = document.getElementById('section-memo-overlay');
    if (ov) return ov;
    const scaler = document.getElementById('canvas-scaler');
    const canvas = document.getElementById('canvas');
    if (!scaler || !canvas || canvas.parentElement !== scaler) return null;
    ov = document.createElement('div');
    ov.id = 'section-memo-overlay';
    scaler.insertBefore(ov, canvas);
    return ov;
  }
  /* 레이아웃 좌표(offset 사슬)로 잰다 — #canvas-scaler 의 transform(배율·팬)과 무관해서
     배율이 바뀌어도 다시 잴 필요가 없다. 탭 «크기»는 CSS 가 --inv-zoom 으로 맞춘다. */
  function _offsetIn(el, anc) {
    let x = 0, y = 0, e = el;
    while (e && e !== anc) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return e === anc ? { x, y } : null;
  }

  let _tip = null;
  function _hideTip() { if (_tip) { _tip.remove(); _tip = null; } }
  function _moveTip(ev) {
    if (!_tip) return;
    const r = _tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 10;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    _tip.style.left = Math.max(8, x) + 'px';
    _tip.style.top = Math.max(8, y) + 'px';
  }
  function _showTip(sec, idx, ev) {
    _hideTip();
    const tip = document.createElement('div');
    tip.className = 'smemo-tip';
    const nm = document.createElement('span');
    nm.className = 'smemo-tip-name';
    nm.textContent = _num(idx) + ' · ' + _name(sec);
    const tx = document.createElement('div');
    tx.className = 'smemo-tip-text';
    const p = _digest(sec.getAttribute('data-memo')).text;
    tx.textContent = p.length > TIP_MAX ? p.slice(0, TIP_MAX) + '…' : p;
    tip.appendChild(nm);
    tip.appendChild(tx);
    document.body.appendChild(tip);
    _tip = tip;
    _moveTip(ev);
  }

  /* 같은 판이면 다시 짓지 않는다 — 크기 감시가 자주 깨워도 마우스 아래 탭·미리보기가 안 깜빡이게 */
  let _tabSig = '';
  function _renderTabs(all) {
    const ov = _overlay();
    if (!ov) return;
    const scaler = ov.parentElement;
    const want = [];
    all.forEach((sec, idx) => {
      if (!sectionHasMemo(sec)) return;
      const p = _offsetIn(sec, scaler);
      if (p) want.push({ sec, idx, p });   // p 없음 = display:none(비활성 변형) — 자리가 없다
    });
    const sig = want.map(w => [w.sec.id, w.idx, w.p.x, w.p.y, _isHiddenSec(w.sec) ? 1 : 0, w.sec.getAttribute('data-memo'), _name(w.sec)].join('\u0001')).join('\u0002');
    if (sig === _tabSig && ov.querySelectorAll('.smemo-tab').length === want.length) return;
    _tabSig = sig;
    _hideTip();
    ov.querySelectorAll('.smemo-tab').forEach(el => el.remove());
    want.forEach(({ sec, idx, p }) => {
      const tab = document.createElement('div');
      tab.className = 'smemo-tab' + (_isHiddenSec(sec) ? ' is-hidden-sec' : '');
      tab.dataset.secId = sec.id || '';
      tab.style.left = p.x + 'px';
      tab.style.top = p.y + 'px';
      tab.innerHTML = SVG_MEMO;
      tab.addEventListener('mouseenter', e => _showTip(sec, idx, e));
      tab.addEventListener('mousemove', _moveTip);
      tab.addEventListener('mouseleave', _hideTip);
      /* 캔버스 끌기 선택·빈 곳 해제로 새지 않게 (선례: js/checklist-panel.js renderPins 의 핀 mousedown) */
      tab.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
      tab.addEventListener('click', e => {
        e.stopPropagation();
        _hideTip();
        if (typeof window.selectSection === 'function') window.selectSection(sec, false);
        _syncSelected();
        _openMemo(sec);
      });
      ov.appendChild(tab);
    });
  }

  // ── ㉰ 체크리스트 탭 맨 위 묶음 ────────────────────────────────────────────
  /* 보기 상태는 이 창 메모리에만 둔다 — ⛔새 저장 키를 만들지 않는다(투두 저장 자리 무접촉 단언과 같은 결) */
  const _view = { open: true, preview: true };

  function _groupEl() {
    const panel = document.getElementById('checklist-panel-body');
    if (!panel) return null;
    let g = panel.querySelector(':scope > #smemo-group');
    if (!g) {
      g = document.createElement('div');
      g.id = 'smemo-group';
      g.className = 'smemo-group';
    }
    /* 자리 = 투두 툴바와 #ck-list 사이(시안의 «목록 맨 위»). ck-list 가 없으면 몸통 맨 앞. */
    const list = panel.querySelector(':scope > #ck-list');
    const want = list || panel.firstChild;
    if (g.parentElement !== panel || (list && g.nextElementSibling !== list)) panel.insertBefore(g, want);
    return g;
  }

  function _rowEl(sec, idx) {
    const row = document.createElement('div');
    row.className = 'smemo-item' + (_isHiddenSec(sec) ? ' is-hidden-sec' : '');
    row.dataset.secId = sec.id || '';
    row.title = _isHiddenSec(sec) ? '숨긴 섹션 · 클릭 = 이 섹션 선택' : '클릭 = 이 섹션으로 이동';
    const num = document.createElement('span');
    num.className = 'smemo-num';
    num.textContent = _num(idx);
    const body = document.createElement('div');
    body.className = 'smemo-body';
    const nm = document.createElement('div');
    nm.className = 'smemo-name';
    nm.textContent = _name(sec);
    body.appendChild(nm);
    const d = _digest(sec.getAttribute('data-memo'));
    if (_view.preview) {
      const pv = document.createElement('div');
      pv.className = 'smemo-preview';
      pv.textContent = d.text;
      body.appendChild(pv);
    }
    row.appendChild(num);
    row.appendChild(body);
    if (d.all) {
      const ch = document.createElement('span');
      ch.className = 'smemo-chk' + (d.done === d.all ? ' all-done' : '');
      ch.textContent = d.done + '/' + d.all;
      ch.title = '메모 속 체크 ' + d.done + '개 끝 / ' + d.all + '개';
      row.appendChild(ch);
    }
    const ob = document.createElement('button');
    ob.className = 'smemo-open';
    ob.type = 'button';
    ob.title = '메모 열기';
    ob.innerHTML = SVG_MEMO;
    ob.addEventListener('click', e => { e.stopPropagation(); _goTo(sec); _openMemo(sec); });
    row.appendChild(ob);
    row.addEventListener('click', () => _goTo(sec));
    return row;
  }

  function _renderGroup(all) {
    const g = _groupEl();
    if (!g) return;
    const rows = [];
    all.forEach((sec, idx) => { if (sectionHasMemo(sec)) rows.push([sec, idx]); });
    const sig = [_view.open, _view.preview, all.length].concat(rows.map(([sec, idx]) =>
      [sec.id, idx, _isHiddenSec(sec) ? 1 : 0, sec.getAttribute('data-memo'), _name(sec)].join('\u0001'))).join('\u0002');
    if (g.firstChild && g._sig === sig) { _syncSelected(); return; }
    g._sig = sig;
    g.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'ck-section-header smemo-group-head';
    head.setAttribute('role', 'button');
    head.setAttribute('aria-expanded', _view.open ? 'true' : 'false');
    head.innerHTML = SVG_CHEV + '<span class="ck-section-name">📝 섹션 메모</span><span class="smemo-group-badge"></span>';
    if (!_view.open) head.querySelector('.ck-section-chevron').classList.add('collapsed');
    head.querySelector('.smemo-group-badge').textContent = rows.length + ' / ' + all.length;
    head.addEventListener('click', () => { _view.open = !_view.open; _renderGroup(_sections()); });
    g.appendChild(head);

    if (_view.open) {
      const ctrls = document.createElement('div');
      ctrls.className = 'smemo-ctrls';
      const seg = document.createElement('span');
      seg.className = 'smemo-seg';
      [['1', '미리보기'], ['0', '이름만']].forEach(([v, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.v = v;
        b.textContent = label;
        b.classList.toggle('on', (v === '1') === _view.preview);
        b.addEventListener('click', () => { _view.preview = v === '1'; _renderGroup(_sections()); });
        seg.appendChild(b);
      });
      ctrls.appendChild(seg);
      g.appendChild(ctrls);

      const list = document.createElement('div');
      list.className = 'smemo-list';
      if (!rows.length) {
        const em = document.createElement('div');
        em.className = 'smemo-empty';
        em.textContent = '메모가 있는 섹션이 없습니다. 섹션을 선택하고 툴바의 📝 로 메모를 달면 여기 나옵니다.';
        list.appendChild(em);
      } else {
        rows.forEach(([sec, idx]) => list.appendChild(_rowEl(sec, idx)));
      }
      g.appendChild(list);
    }
    const dv = document.createElement('div');
    dv.className = 'smemo-divider';
    g.appendChild(dv);
    _syncSelected();
  }

  /* 목록 줄의 «지금 고른 섹션» 표시 — 섹션 .selected 를 읽기만 한다 */
  function _syncSelected() {
    document.querySelectorAll('#smemo-group .smemo-item').forEach(row => {
      const sec = row.dataset.secId ? document.getElementById(row.dataset.secId) : null;
      row.classList.toggle('smemo-item--selected', !!(sec && sec.classList.contains('selected')));
    });
  }

  // ── ㉱ 레이어 패널 섹션 행 아이콘 ──────────────────────────────────────────
  function syncLayerHeader(header, sec) {
    if (!header || !sec) return;
    const want = sectionHasMemo(sec);
    let ico = header.querySelector(':scope > .layer-memo-ico');
    if (want && !ico) {
      ico = document.createElement('span');
      ico.className = 'layer-memo-ico';
      ico.title = '메모 있음';
      ico.innerHTML = SVG_MEMO;
      const eye = header.querySelector(':scope > .layer-eye-btn');
      header.insertBefore(ico, eye || null);
    } else if (!want && ico) {
      ico.remove();
    }
  }
  function _syncLayerIcons() {
    document.querySelectorAll('#layer-panel-body .layer-section[data-sec-id]').forEach(ls => {
      const sec = document.getElementById(ls.dataset.secId);
      const header = ls.querySelector(':scope > .layer-section-header');
      if (sec && header) syncLayerHeader(header, sec);
    });
  }

  // ── 다시 그리기 · 감시 ─────────────────────────────────────────────────────
  function refresh() {
    const all = _sections();
    _renderTabs(all);
    _renderGroup(all);
    _syncLayerIcons();
  }
  let _raf = 0;
  function schedule() {
    if (_raf) return;
    _raf = requestAnimationFrame(() => { _raf = 0; refresh(); });
  }

  /* ★감시자 셋 — 모두 «읽기만» 한다. #canvas 에 쓰지 않으므로 autoSaveObserver 와 엮이지 않는다.
     ⑴ 속성: 메모·숨김·이름·변형 (subtree · attributeFilter 로 좁힌다 — 글자 입력·class 토글엔 안 깬다)
     ⑵ 자식: #canvas 직계(섹션 추가·삭제·이동·페이지 전환의 innerHTML 갈이)
     ⑶ 크기: #canvas + 각 섹션(높이 변화·숨김·비활성 변형)
     ⑷ 체크리스트 몸통 자식 갈이 → 묶음을 다시 꽂는다 */
  let _ro = null;
  function _reobserveSections() {
    if (!_ro) return;
    _ro.disconnect();
    const c = document.getElementById('canvas');
    if (c) _ro.observe(c);
    _sections().forEach(s => _ro.observe(s));
  }
  function init() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    new MutationObserver(schedule).observe(canvas, {
      subtree: true, attributes: true,
      attributeFilter: ['data-memo', 'data-hidden', 'data-name', 'data-variation-active', 'data-ghost'],
    });
    new MutationObserver(() => { _reobserveSections(); schedule(); }).observe(canvas, { childList: true });
    if (typeof ResizeObserver === 'function') { _ro = new ResizeObserver(schedule); _reobserveSections(); }
    const panel = document.getElementById('checklist-panel-body');
    if (panel) {
      new MutationObserver(() => {
        const g = panel.querySelector(':scope > #smemo-group');
        const list = panel.querySelector(':scope > #ck-list');
        if (!g || (list && g.nextElementSibling !== list)) _renderGroup(_sections());
      }).observe(panel, { childList: true });
    }
    /* 고른 섹션이 바뀌면 목록 줄 표시만 맞춘다(섹션 class 를 감시하지 않는다 — 그건 너무 잦다) */
    document.addEventListener('click', () => { if (document.getElementById('smemo-group')) requestAnimationFrame(_syncSelected); });
    refresh();
  }

  window.sectionHasMemo = sectionHasMemo;
  window.SectionMemoView = { has: sectionHasMemo, refresh, syncLayerHeader };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
