/* ══════════════════════════════════════════════════════════════════════════
   history-diff.js — 협업 undo 의 «섹션 단위 스냅샷 diff» 순수 유틸.
   ───────────────────────────────────────────────────────────────────────────
   설계: PLAN §3.3 / §3.2. 두 인접 스냅샷의 캔버스 HTML 문자열을 섹션 단위로 비교해
     «그 스텝이 바꾼 섹션 집합»(changed/added/removed)을 낸다. 스코프 복원(history.js)이
     이 집합에서 원격 기여분(remoteKeys)·라이브 가드 실패분을 뺀 «내 섹션만» 되돌린다.

   ★변경 판정 = «raw outerHTML» 문자열 비교(R2). normSection 해시로 하면 normSection 이
     제거하는 것(annotation-block·section-label·contenteditable…)의 «변경»이 diff 에서
     사라져 주석/라벨 편집이 협업 중 undo 불능이 된다. 스냅샷끼리는 «같은 재료»
     (둘 다 getSerializedCanvas 산출)라 raw 비교가 안전하다.
   ★normSection 해시(sectionGuardHash)는 «라이브 vs 스냅샷» 비교(라이브 가드)에만 쓴다 —
     거긴 재료가 달라(라이브 DOM엔 lazy-bg·핸들·런타임 클래스) 세척 후 정규화가 필요.

   ★섹션 키 = 실제 id. id 없는 섹션은 'noid_<인덱스>' 로 폴백한다. 인덱스 키는 섹션이
     증감하면 «다른 물리 섹션»을 가리킬 수 있으므로(R6) — diffSnapshots 는 인덱스가 밀리면
     같은 물리 섹션이라도 서로 다른 noid 키가 되어 '변경/추가/삭제'로 잡힌다(«같음»으로
     오분류하지 않는다). 스코프 복원 쪽은 noid 키를 id 로 못 찾으므로 «건드리지 않는다»
     (엉뚱한 섹션 오염 방지). 실사용 섹션은 항상 id 가 있어 이 폴백은 방어용이다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  function _parser() {
    // 렌더러 컨텍스트엔 DOMParser 가 있다. sync.js collectSections 와 동일 패턴.
    return new DOMParser();
  }

  /* 캔버스 HTML 문자열 → 순서 보존 섹션 목록. 각 항목:
   *   { key, id, noid, html(raw outerHTML), idx } */
  function parseSections(canvasStr) {
    const doc = _parser().parseFromString(`<div id="c">${canvasStr || ''}</div>`, 'text/html');
    const root = doc.getElementById('c');
    const out = [];
    let i = 0;
    root.querySelectorAll('.section-block').forEach(sec => {
      const id = sec.id || '';
      out.push({ key: id || ('noid_' + i), id, noid: !id, html: sec.outerHTML, idx: i });
      i++;
    });
    return out;
  }

  /* 두 스냅샷(같은 페이지의 캔버스 HTML) diff. from→to 로 «to 가 담은 변화»를 낸다:
   *   changed: 양쪽에 있고 raw outerHTML 이 다른 키
   *   added  : to 에만 있는 키(=from→to 에서 «생겼다»)
   *   removed: from 에만 있는 키(=from→to 에서 «사라졌다»)
   *   orderChanged: 공통 섹션의 상대 순서가 달라졌나
   * from/to 는 key→{html,id,noid,idx} 맵. */
  function diffSnapshots(fromStr, toStr) {
    const F = parseSections(fromStr), T = parseSections(toStr);
    const fMap = new Map(F.map(s => [s.key, s]));
    const tMap = new Map(T.map(s => [s.key, s]));
    const changed = [], added = [], removed = [];
    for (const t of T) {
      const f = fMap.get(t.key);
      if (!f) added.push(t.key);
      else if (f.html !== t.html) changed.push(t.key);
    }
    for (const f of F) {
      if (!tMap.has(f.key)) removed.push(f.key);
    }
    const commonF = F.filter(s => tMap.has(s.key)).map(s => s.key).join('|');
    const commonT = T.filter(s => fMap.has(s.key)).map(s => s.key).join('|');
    return {
      changed, added, removed,
      orderChanged: commonF !== commonT,
      from: fMap, to: tMap,
      fromOrder: F.map(s => s.key), toOrder: T.map(s => s.key),
    };
  }

  /* 라이브 섹션 1개의 «정규화 해시» — 스냅샷 섹션과 «같은 재료»로 비교하기 위해
   *   ⑴ serializeSectionClone 으로 «스냅샷 안에서와 동일하게» 세척(R1) → outerHTML
   *   ⑵ 파싱해 marketMerge.normSection → hash (sync/market 과 동일 해시).
   * 실패 시 null(가드는 null 이면 «비교 불가»로 보수 처리). */
  function sectionGuardHash(liveSecEl) {
    const M = window.marketMerge;
    if (!liveSecEl || !M || typeof window.serializeSectionClone !== 'function') return null;
    const html = window.serializeSectionClone(liveSecEl);
    if (!html) return null;
    const doc = _parser().parseFromString(`<div id="c">${html}</div>`, 'text/html');
    const sec = doc.querySelector('.section-block');
    if (!sec) return null;
    return M.hash(M.normSection(sec));
  }

  /* 스냅샷 캔버스 문자열에서 섹션 1개의 «정규화 해시»(라이브 가드 비교 대상). */
  function snapshotSectionHash(canvasStr, sectionId) {
    const M = window.marketMerge;
    if (!M || !sectionId) return null;
    const doc = _parser().parseFromString(`<div id="c">${canvasStr || ''}</div>`, 'text/html');
    const sec = doc.getElementById(sectionId);
    if (!sec || !sec.classList.contains('section-block')) return null;
    return M.hash(M.normSection(sec));
  }

  window.historyDiff = { parseSections, diffSnapshots, sectionGuardHash, snapshotSectionHash };
})();
