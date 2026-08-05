/* ══════════════════════════════════════
   Marketplace 섹션 머지 엔진 (Phase 4)
   - 두 프로젝트(로컬/원격)의 섹션을 id 기준으로 비교(추가/삭제/변경).
   - 정규화: 런타임 클래스·편집 핸들·플레이스홀더·chrome 제거 후 비교 → 가짜 diff 방지.
   - 1차 정책: 분기 감지 시 keep-both(복사본 보존). resolve UI는 후속(Phase 4b).
   - DOMParser(렌더러) 사용. mergeBranch(#CSS.escape) 패턴 차용.
══════════════════════════════════════ */
(function () {
  const _RUNTIME_CLS = ['selected', 'img-editing', 'editing', 'dragging', 'group-selected', 'group-editing', 'ss-drag-over', 'drag-over'];

  // 섹션 1개의 정규화 outerHTML (비교용 안정 문자열)
  function normSection(secEl) {
    const el = secEl.cloneNode(true);
    el.querySelectorAll('.section-label, .section-toolbar, .variation-badge, .annotation-block, .annot-preview').forEach(n => n.remove());
    el.classList.remove(..._RUNTIME_CLS);
    el.querySelectorAll('.' + _RUNTIME_CLS.join(', .')).forEach(n => n.classList.remove(..._RUNTIME_CLS));
    el.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    // 공백 정규화(직렬화 비결정성 완화)
    return el.outerHTML.replace(/\s+/g, ' ').trim();
  }

  // 32-bit FNV 해시(빠른 비교용; 보안 무관)
  function _hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16);
  }

  function _asObj(d) { return typeof d === 'string' ? JSON.parse(d) : d; }

  // 프로젝트 → { 'pageId::secId': hash } 맵 + 섹션 순서
  function sectionMap(data) {
    const obj = _asObj(data);
    const map = {}; const order = [];
    const parser = new DOMParser();
    for (const pg of (obj.pages || [])) {
      const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
      const canvas = doc.getElementById('c');
      canvas.querySelectorAll('.section-block').forEach(sec => {
        const id = sec.id || ('noid_' + order.length);
        const key = `${pg.id}::${id}`;
        map[key] = _hash(normSection(sec));
        order.push(key);
      });
    }
    return { map, order };
  }

  // 로컬↔원격 2-way diff (base 없으면 변경/추가/삭제만; conflict 판정은 3-way에서)
  function diffProjects(localData, remoteData) {
    const L = sectionMap(localData), R = sectionMap(remoteData);
    const keys = new Set([...Object.keys(L.map), ...Object.keys(R.map)]);
    const sections = [];
    let same = 0, changed = 0, added = 0, removed = 0;
    for (const k of keys) {
      const inL = k in L.map, inR = k in R.map;
      let status;
      if (inL && inR) { status = L.map[k] === R.map[k] ? 'same' : 'changed'; }
      else if (inR) status = 'added';      // 원격에만 = 받으면 추가됨
      else status = 'removed';             // 로컬에만 = 원격엔 없음
      if (status === 'same') same++; else if (status === 'changed') changed++;
      else if (status === 'added') added++; else removed++;
      sections.push({ key: k, status });
    }
    const diverged = (changed + added + removed) > 0;
    return { sections, summary: { same, changed, added, removed, total: keys.size }, diverged };
  }

  // 'both' 시 원격 섹션 id 재발급(로컬과 충돌 방지)
  function _reId(outerHTML, parser) {
    const d = parser.parseFromString(`<div id="c">${outerHTML}</div>`, 'text/html').getElementById('c');
    const sec = d.firstElementChild;
    if (sec) sec.id = 'sec_m' + Math.random().toString(36).slice(2, 9);
    return d.innerHTML;
  }

  // 섹션별 선택(choices)으로 머지된 프로젝트 데이터 생성. 원본 불변(새 객체 반환).
  // choices: { 'pageId::secId': 'mine'|'theirs'|'both' }. 미지정 기본: changed/local-only→mine, remote-only(added)→theirs.
  function applyResolve(localData, remoteData, choices) {
    choices = choices || {};
    const Lo = _asObj(localData), Ro = _asObj(remoteData);
    const parser = new DOMParser();
    const result = JSON.parse(JSON.stringify(Lo));
    const Lp = Object.fromEntries((Lo.pages || []).map(p => [p.id, p]));
    const Rp = Object.fromEntries((Ro.pages || []).map(p => [p.id, p]));
    const pageIds = [...new Set([...(Lo.pages || []).map(p => p.id), ...(Ro.pages || []).map(p => p.id)])];
    result.pages = pageIds.map(pid => {
      const lpage = Lp[pid], rpage = Rp[pid];
      const base = JSON.parse(JSON.stringify(lpage || rpage));
      const lC = parser.parseFromString(`<div id="c">${lpage?.canvas || ''}</div>`, 'text/html').getElementById('c');
      const rC = parser.parseFromString(`<div id="c">${rpage?.canvas || ''}</div>`, 'text/html').getElementById('c');
      const lEls = [...lC.querySelectorAll('.section-block')], rEls = [...rC.querySelectorAll('.section-block')];
      const lById = Object.fromEntries(lEls.map(s => [s.id, s])), rById = Object.fromEntries(rEls.map(s => [s.id, s]));
      const order = [...lEls.map(s => s.id), ...rEls.map(s => s.id).filter(id => !(id in lById))];
      const out = [];
      for (const id of order) {
        const inL = id in lById, inR = id in rById;
        let c = choices[`${pid}::${id}`];
        if (!c) c = (inL && inR) ? 'mine' : (inR ? 'theirs' : 'mine');
        if (c === 'both') { if (inL) out.push(lById[id].outerHTML); if (inR) out.push(_reId(rById[id].outerHTML, parser)); }
        else if (c === 'theirs' && inR) out.push(rById[id].outerHTML);
        else if (c === 'mine' && inL) out.push(lById[id].outerHTML);
        else out.push((inL ? lById[id] : rById[id]).outerHTML);
      }
      base.canvas = out.join('');
      return base;
    });
    return JSON.stringify(result);
  }

  window.marketMerge = { normSection, sectionMap, diffProjects, applyResolve };
})();
