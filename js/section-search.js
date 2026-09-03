/* ══════════════════════════════════════
   Section Search — ⌘F 섹션 검색이동 팔레트
   - openSectionSearch() / closeSectionSearch() 글로벌
   - 상단 12vh 드롭다운형 커맨드 팔레트 (VSCode 스타일)
   - 섹션명(dataset.name → .section-label → id 순) + 섹션 ID(sec_*)를 검색하는 read-only 네비게이션
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
    input.placeholder = '섹션명·ID · 블럭 ID · 스크래치패드 ID(sp_)로 이동…';
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

    /* ★스크래치패드 항목(2026-09-03 현빈) — 투두에 «#sp_xxxx» 로 적어둔 것을 찾아 이동한다.
       ⚠️여기만 «id 가 아니라 dataset.scratchId» 다. 그래서 아래 [id] 순회에 안 잡힌다 —
         이게 「검색해도 안 나오던」 이유다.
       ★섹션에 «속하지 않는다» — 캔버스 옆 작업대라 sec 가 없다. 표시는 「스크래치패드」로 고정.
       ⛔투두의 #sp_ 를 «누르게» 하지 않는다: 체크리스트 글은 인라인 편집 대상이라
         고치려는 클릭과 이동하려는 클릭이 부딪힌다(현빈 판단 2026-09-03). */
    document.querySelectorAll('#canvas-scaler .scratch-item[data-scratch-id]').forEach((el) => {
      blockCandidates.push({ el, id: el.dataset.scratchId, sec: null, secName: '스크래치패드' });
    });

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
    // ★맨 앞 «#» 는 떼고 찾는다 — 투두에 「#sp_ovqr99」 로 적혀 있어 그대로 붙여넣게 된다.
    const q = (query || '').toLowerCase().trim().replace(/^#+/, '');
    // 섹션은 이름 + 섹션 ID(sec_*) 양쪽으로 매칭 — ID로만 걸린 행은 idHit 표시해 id 병기
    let secMatches;
    if (q) {
      secMatches = [];
      candidates.forEach((c) => {
        const nameHit = c.name.toLowerCase().includes(q);
        const idHit = (c.el.id || '').toLowerCase().includes(q);
        if (!nameHit && !idHit) return;
        secMatches.push(!nameHit && idHit ? { ...c, idHit: true } : c);
      });
    } else {
      secMatches = candidates.slice();
    }
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
        ? `'${query}'와 일치하는 섹션·블럭·스크래치패드가 없습니다`
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
      } else if (c.idHit) {
        // 섹션 ID로만 매치된 행 — 사용자가 친 ID가 왜 이 행인지 muted로 병기
        li.classList.add('ss-item-sec-id');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = c.name;
        const idSpan = document.createElement('span');
        idSpan.className = 'ss-sec-ref';
        idSpan.textContent = '→ ' + (c.el.id || '');
        li.appendChild(nameSpan);
        li.appendChild(idSpan);
      } else {
        li.textContent = c.name;
      }
      // mousemove(실제 이동시만 발화) — mouseenter는 정지 커서 밑에 항목이 재렌더돼도 발화해
      // 팔레트 열자마자/타이핑마다 커서 밑 항목이 활성을 하이재킹함
      li.addEventListener('mousemove', () => { if (activeIndex !== i) setActive(i); });
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
