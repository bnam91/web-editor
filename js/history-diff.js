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
    const doc = _parser().parseFromString(`<div id="__hdroot__">${canvasStr || ''}</div>`, 'text/html');
    const root = doc.getElementById('__hdroot__');
    if (!root) return null;
    // ★root 스코프 querySelector 는 descendant 만 본다 → 래퍼 id 와의 충돌 불가.
    //   (getElementById(sectionId) 는 섹션 id 가 래퍼와 겹치면 래퍼를 반환하는 버그가 있었다.)
    let sec = null;
    try { sec = root.querySelector('#' + CSS.escape(sectionId)); } catch (_) {}
    if (!sec) sec = [...root.querySelectorAll('.section-block')].find(s => s.id === sectionId) || null;
    if (!sec || !sec.classList.contains('section-block')) return null;
    return M.hash(M.normSection(sec));
  }

  /* ── 스코프 복원 «계획» — 순수함수(DOM 미접촉, 테스트 가능) ──────────────────
   * fromStr→toStr 로 라이브를 옮기기 위한 «연산 목록»과 스킵 건수를 낸다. DOM 수술은
   * 호출측(history.js)이 이 계획을 «실행»만 한다 — 결정 로직을 여기 모아 단위테스트한다.
   *
   * env(호출측이 주입):
   *   remoteHas(secId) → 이 섹션이 «그 스텝의 원격 기여분»인가(later 항목 remoteKeys 조회).
   *                      ★[redo★] 대칭은 호출측이 어느 항목의 remoteKeys 를 넘기냐로 결정 —
   *                        undo=leaving(S[n]), redo=new(S[n+1]). 여기선 remoteHas 만 본다.
   *   liveHashOf(secId) → 라이브 섹션의 세척·정규화 해시(없거나 계산불가면 null).
   *   liveExists(secId) → 라이브에 그 id 섹션이 실재하나.
   *
   * 라이브 가드(R1): changed/removed 는 라이브가 fromStr 상태와 같아야 «내 것»으로 확정.
   *   liveHashOf==null 이거나 fromStr 해시와 다르면 = 체크포인트 후 원격변경 → 스킵(보호).
   * 반환: { ops:[{op:'remove'|'replace'|'insert', id, html?, anchorAfterId?}], skipped, diff }.
   *   ⛔전체 innerHTML 재구성 없음(C8 재도입 금지) — 섹션 단위 연산만. */
  function planScopedUndo(fromStr, toStr, env) {
    env = env || {};
    const remoteHas  = typeof env.remoteHas  === 'function' ? env.remoteHas  : () => false;
    const liveHashOf = typeof env.liveHashOf === 'function' ? env.liveHashOf : () => null;
    const liveExists = typeof env.liveExists === 'function' ? env.liveExists : () => false;
    const diff = diffSnapshots(fromStr, toStr);
    const ops = [];
    let skipped = 0;

    const guardOk = (secId) => {
      const lh = liveHashOf(secId);
      const fh = snapshotSectionHash(fromStr, secId);
      if (lh == null || fh == null) return false;   // 비교불가 → 보수적 스킵(원격 보호 우선)
      return lh === fh;
    };

    // removed: from 에만 = 이 스텝에서 «내가 추가» → 라이브에서 제거
    for (const key of diff.removed) {
      const m = diff.from.get(key);
      if (!m || m.noid) { skipped++; continue; }          // R6: id 없으면 미접촉
      if (remoteHas(m.id) || !guardOk(m.id)) { skipped++; continue; }
      ops.push({ op: 'remove', id: m.id });
    }
    // changed: 양쪽 + html 다름 = «내가 편집» → toSnap 내용으로 교체
    for (const key of diff.changed) {
      const m = diff.to.get(key);
      if (!m || m.noid) { skipped++; continue; }
      if (remoteHas(m.id) || !guardOk(m.id)) { skipped++; continue; }   // 원격분/체크포인트후 변경 보호
      ops.push({ op: 'replace', id: m.id, html: m.html });
    }
    // added: to 에만 = 이 스텝에서 «내가 삭제» → 앵커 재삽입
    const order = diff.toOrder || [];
    for (const key of diff.added) {
      const m = diff.to.get(key);
      if (!m || m.noid) { skipped++; continue; }
      if (liveExists(m.id)) { skipped++; continue; }       // 이미 존재(원격 재생성) — 중복금지
      let anchorAfterId = null;
      const idx = order.indexOf(key);
      for (let i = idx - 1; i >= 0; i--) {
        const pm = diff.to.get(order[i]);
        if (!pm || pm.noid) continue;
        if (liveExists(pm.id)) { anchorAfterId = pm.id; break; }
      }
      ops.push({ op: 'insert', id: m.id, html: m.html, anchorAfterId });
    }
    return { ops, skipped, diff: { changed: diff.changed.length, added: diff.added.length, removed: diff.removed.length, orderChanged: diff.orderChanged } };
  }

  window.historyDiff = { parseSections, diffSnapshots, sectionGuardHash, snapshotSectionHash, planScopedUndo };
})();
