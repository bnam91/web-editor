/* ══════════════════════════════════════
   Section Search — ⌘F 섹션 검색이동 팔레트
   - openSectionSearch() / closeSectionSearch() 글로벌
   - 상단 12vh 드롭다운형 커맨드 팔레트 (VSCode 스타일)
   - 섹션명(dataset.name → .section-label → id 순)만 검색하는 read-only 네비게이션
   - DOM/dataset 변형·저장 트리거 일절 없음
   ══════════════════════════════════════ */
(function () {
  let overlay = null;   // .section-search-overlay
  let input = null;     // input.ss-input
  let list = null;      // ul.ss-list
  let candidates = [];  // [{ el, name }]
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
    input.placeholder = '섹션명으로 이동…';
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

  function collectCandidates() {
    candidates = [...document.querySelectorAll('.section-block')]
      .filter((s) => s.dataset.ghost !== 'true')
      .map((el) => ({ el, name: sectionName(el) }));
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
    const target = rendered[activeIndex].el;
    closeSectionSearch();
    window.selectSection?.(target, true);
  }

  function renderList(query) {
    const q = (query || '').toLowerCase().trim();
    rendered = q
      ? candidates.filter((c) => c.name.toLowerCase().includes(q))
      : candidates.slice();

    list.innerHTML = '';

    if (!rendered.length) {
      const empty = document.createElement('li');
      empty.className = 'ss-empty';
      empty.textContent = q
        ? `'${query}'와 일치하는 섹션이 없습니다`
        : '섹션이 없습니다';
      list.appendChild(empty);
      activeIndex = -1;
      return;
    }

    rendered.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'ss-item';
      li.textContent = c.name;
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
