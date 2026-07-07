/* ══════════════════════════════════════
   Section Search — ⌘F 섹션 검색이동 팔레트
   - openSectionSearch() / closeSectionSearch() 글로벌
   - 상단 12vh 드롭다운형 커맨드 팔레트 (VSCode 스타일)
   - 섹션명(dataset.name → .section-label → id 순)만 검색하는 read-only 네비게이션
   - 블럭 ID(ab_/stk_/txt_ 등) 검색 시 소속 섹션으로 이동 + 오버레이 플래시
     (블럭 요소 자체는 미변형 — 플래시는 #canvas-scaler 위 임시 오버레이라 저장 직렬화에 안 섞임)
   - DOM/dataset 변형·저장 트리거 일절 없음
   ══════════════════════════════════════ */
(function () {
  let overlay = null;   // .section-search-overlay
  let input = null;     // input.ss-input
  let list = null;      // ul.ss-list
  let candidates = [];  // [{ el, name }]
  let blockCandidates = []; // [{ el, id, sec, secName }] — 섹션 내 id 가진 블럭들
  let rendered = [];    // 현재 리스트에 그려진 후보 (필터 결과)
  let activeIndex = -1;

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'section-search-overlay';

    const shell = document.createElement('div');
    shell.className = 'ss-shell';

    input = document.createElement('input');
    input.className = 'ss-input';
    input.type = 'text';
    input.placeholder = '섹션명 또는 블럭 ID로 이동…';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    list = document.createElement('ul');
    list.className = 'ss-list';

    shell.appendChild(input);
    shell.appendChild(list);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);

    // 배경(오버레이 자체) 클릭 시 닫기 — shell 내부 클릭은 무시
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) closeSectionSearch();
    });

    input.addEventListener('input', () => {
      renderList(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        jumpActive();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSectionSearch();
      }
    });
  }

  function sectionName(el) {
    const dn = el.dataset?.name;
    if (dn && dn.trim()) return dn.trim();
    const label = el.querySelector?.('.section-label');
    if (label && label.textContent.trim()) return label.textContent.trim();
    return el.id || '(이름 없음)';
  }

  // 블럭 ID 패턴: 접두어_영숫자 (ab_ncr8d9d, stk_p4wfa0, row_tzu5hu7 …)
  const BLOCK_ID_RE = /^[a-z0-9]{1,6}_[a-z0-9]{4,}$/i;

  function collectCandidates() {
    const sections = [...document.querySelectorAll('.section-block')]
      .filter((s) => s.dataset.ghost !== 'true');
    candidates = sections.map((el) => ({ el, name: sectionName(el) }));

    blockCandidates = [];
    sections.forEach((sec) => {
      const secName = sectionName(sec);
      sec.querySelectorAll('[id]').forEach((el) => {
        if (el.classList.contains('section-block')) return; // 섹션 자신 제외(섹션 후보에 이미 있음)
        if (!BLOCK_ID_RE.test(el.id)) return;
        blockCandidates.push({ el, id: el.id, sec, secName });
      });
    });
  }

  function setActive(idx) {
    activeIndex = idx;
    const items = list.querySelectorAll('.ss-item');
    items.forEach((it, i) => it.classList.toggle('active', i === idx));
    if (idx >= 0 && items[idx]) {
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function moveActive(delta) {
    if (!rendered.length) return;
    let next = activeIndex + delta;
    if (next < 0) next = rendered.length - 1;
    if (next >= rendered.length) next = 0;
    setActive(next);
  }

  function jumpActive() {
    if (activeIndex < 0 || activeIndex >= rendered.length) return;
    const entry = rendered[activeIndex];
    closeSectionSearch();
    if (entry.kind === 'block') {
      jumpToBlock(entry);
    } else {
      window.selectSection?.(entry.el, true);
    }
  }

  // 블럭 중앙이 뷰포트 중앙에 오게 스크롤 + 오버레이 플래시 (선택 상태 미변경)
  function jumpToBlock(entry) {
    const el = entry.el;
    if (!el.isConnected) return;
    const wrap = document.getElementById('canvas-wrap');
    if (!wrap) return;
    const r = el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    wrap.scrollTop += (r.top + r.height / 2) - (w.top + wrap.clientHeight / 2);
    wrap.scrollLeft += (r.left + r.width / 2) - (w.left + wrap.clientWidth / 2);
    flashBlock(el);
  }

  function flashBlock(el) {
    const scaler = document.getElementById('canvas-scaler');
    if (!scaler) return;
    scaler.querySelectorAll('.ss-flash-overlay').forEach((f) => f.remove());
    const sr = scaler.getBoundingClientRect();
    const scale = scaler.offsetWidth ? sr.width / scaler.offsetWidth : 1;
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'ss-flash-overlay';
    f.style.left = (r.left - sr.left) / scale + 'px';
    f.style.top = (r.top - sr.top) / scale + 'px';
    f.style.width = r.width / scale + 'px';
    f.style.height = r.height / scale + 'px';
    scaler.appendChild(f);
    f.addEventListener('animationend', () => f.remove());
    setTimeout(() => f.remove(), 3000); // animationend 유실 대비 안전망
  }

  const BLOCK_MATCH_CAP = 30; // 블럭 매칭 표시 상한 (짧은 쿼리 폭주 방지)

  function renderList(query) {
    const q = (query || '').toLowerCase().trim();
    const secMatches = q
      ? candidates.filter((c) => c.name.toLowerCase().includes(q))
      : candidates.slice();
    // 블럭 ID 매칭은 2자 이상 입력부터 (빈/1자 쿼리는 기존처럼 섹션만)
    const blkMatches = q.length >= 2
      ? blockCandidates
          .filter((b) => b.id.toLowerCase().includes(q))
          .slice(0, BLOCK_MATCH_CAP)
          .map((b) => ({ ...b, kind: 'block' }))
      : [];
    rendered = [...secMatches, ...blkMatches];

    list.innerHTML = '';

    if (!rendered.length) {
      const empty = document.createElement('li');
      empty.className = 'ss-empty';
      empty.textContent = q
        ? `'${query}'와 일치하는 섹션/블럭이 없습니다`
        : '섹션이 없습니다';
      list.appendChild(empty);
      activeIndex = -1;
      return;
    }

    rendered.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'ss-item';
      if (c.kind === 'block') {
        li.classList.add('ss-item-block');
        const idSpan = document.createElement('span');
        idSpan.textContent = c.id;
        const secSpan = document.createElement('span');
        secSpan.className = 'ss-sec-ref';
        secSpan.textContent = '→ ' + c.secName;
        li.appendChild(idSpan);
        li.appendChild(secSpan);
      } else {
        li.textContent = c.name;
      }
      li.addEventListener('mouseenter', () => setActive(i));
      li.addEventListener('mousedown', (e) => {
        // mousedown으로 처리 — overlay mousedown(배경 닫기)보다 우선, blur 방지
        e.preventDefault();
        setActive(i);
        jumpActive();
      });
      list.appendChild(li);
    });

    setActive(0);
  }

  function openSectionSearch() {
    ensureDom();
    collectCandidates();
    input.value = '';
    renderList('');
    overlay.style.display = 'flex';
    input.focus();
    input.select();
  }

  function closeSectionSearch() {
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  window.openSectionSearch = openSectionSearch;
  window.closeSectionSearch = closeSectionSearch;
})();
