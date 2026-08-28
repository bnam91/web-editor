/* ══════════════════════════════════════════════════════════════════════════
   version-diff.js — 버전/백업 히스토리의 «손실 중심(loss-oriented)» diff. 순수 유틸.
   설계: _context/DESIGN-version-history.md §6
   ───────────────────────────────────────────────────────────────────────────
   ★이 모듈이 답하는 질문은 «v1 과 v2 가 뭐가 다른가»가 아니다.
     사용자는 «사고 직후»에 이 창을 연다. 묻는 건 하나다 —
        「내가 잃은 그것이 아직 살아 있는 버전이 어느 것인가」
     그래서 모든 판정의 헤드라인은 lost = «그 버전엔 있는데 지금은 없는 것» 이다.
     changed/gained 는 부속 정보다. 이 우선순위를 뒤집지 마라(§1, §6-1).

   ★★전제(precondition) — 호출측이 «양쪽을 이미 정규화해서» 넘긴다
     옛 스냅샷은 이미지를 `goya-asset://<pid>/<sha256_16>.<ext>` 로 갖는데
     현재본은 같은 이미지를 아직 `data:image/...;base64,...` 인라인으로 들고 있을 수 있다
     (실사용 프로젝트의 «대다수»가 미외부화 상태다 — 예외가 아니라 기본 케이스).
     이 둘을 그대로 비교하면 **이미지가 든 모든 섹션이 「변경」으로 뜬다** → 목록이 통째로
     노이즈에 덮여 도구가 무용해진다(§6-2).
     ⇒ main 이 `snapshot-store.canonicalize(..., {write:false})` 로 양쪽을 같은 좌표계로 몬 뒤
       `projects:history-diff-payload` 로 넘긴다. **이 모듈은 정규화를 «하지 않는다»**
       (렌더러에서 40MB base64 를 해싱할 수는 없다). 대신 어긋났을 때 changeDiff 가
       `mixedEncoding:true` 로 «가짜 변경의 벽»을 UI 에 경고한다.

   ★단독 동작 보장 — window.marketMerge 가 있으면 «그걸 쓰고», 없으면 로컬 사본으로 돈다.
     정규화·해시의 표준은 어디까지나 js/market-merge.js:12/23 이다. 저쪽이 바뀌면 여기 사본도
     같이 바꿔라 — 두 곳이 「바뀌었다」를 다르게 판정하면 diff 를 믿을 수 없게 된다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── market-merge.js:9~27 의 사본(표준은 저쪽). 테스트에서 DOM 이 없을 때·마켓 머지가
   *    로드되지 않은 컨텍스트에서도 이 모듈이 «혼자» 돌게 하려고만 둔다. ────────── */
  const _RUNTIME_CLS = ['selected', 'img-editing', 'editing', 'dragging', 'group-selected', 'group-editing', 'ss-drag-over', 'drag-over'];

  function _localNormSection(secEl) {
    const el = secEl.cloneNode(true);
    el.querySelectorAll('.section-label, .section-toolbar, .variation-badge, .annotation-block, .annot-preview').forEach(n => n.remove());
    el.classList.remove(..._RUNTIME_CLS);
    el.querySelectorAll('.' + _RUNTIME_CLS.join(', .')).forEach(n => n.classList.remove(..._RUNTIME_CLS));
    el.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    return el.outerHTML.replace(/\s+/g, ' ').trim();
  }

  // 32-bit FNV 해시(빠른 비교용; 보안 무관) — market-merge.js:23 과 동일.
  function _localHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16);
  }

  function _mm() {
    return (typeof window !== 'undefined' && window.marketMerge) ? window.marketMerge : null;
  }
  function _norm(secEl) {
    const M = _mm();
    return (M && typeof M.normSection === 'function') ? M.normSection(secEl) : _localNormSection(secEl);
  }
  function _hash(s) {
    const M = _mm();
    return (M && typeof M.hash === 'function') ? M.hash(s) : _localHash(s);
  }

  const NO_NAME = '(이름 없음)';

  /* ── L1: 손실 diff — 파일 읽기 0 · DOM 파싱 0 ────────────────────────────
   * 재료는 snapshot-store.js `fingerprint()` 가 이미 뽑아 index.json 에 넣어 둔 `secs`:
   *   [{ k: 'pageId::sectionId', n: '사람이 읽는 섹션 이름' }]
   * 그래서 **모든 버전의 손실을 모달 열 때 한 번에** 계산할 수 있다(§6-1 L1).
   *
   * ★★신원은 «섹션 id»다 — 페이지 부분은 «신원»이 아니라 «위치»다.
   *   sec_* id 는 genId 로 만들어져 프로젝트 안에서 고유하고 재발급되지 않는다(§6-3). 그래서 두 가지가 따라온다:
   *   ⒜ **섹션이 다른 페이지로 «옮겨간» 것은 손실이 아니다.** 키 전체(`pageId::secId`)로 비교하면
   *      멀쩡히 살아 있는 섹션을 「사라졌다」고 말한다 — 복구 도구에서 그건 거짓 경보다.
   *   ⒝ 대형 레거시 스냅샷은 JSON.parse 없이 raw 로 훑기 때문에 페이지 경계를 못 갈라 `?::secId` 로
   *      온다(snapshot-store.fingerprintRaw). 키 전체로 비교하면 **모든 섹션이 「사라졌다」**가 된다.
   *   ★실측으로 드러났다: 실프로젝트 60개 218버전 전수 스윕에서 **66건이 «전량 손실»**로 나왔는데
   *     섹션 id 만 비교하면 교집합이 17/17·2/2 였다. 합성 픽스처로는 절대 안 나오는 종류의 버그다.
   *   ⇒ **비교는 섹션 id 로 한다.** 페이지는 표시용으로만 남긴다(k 는 그대로 돌려준다).
   * 옛 키 규약 — `pageId::sectionId`.
   *   id 없는 섹션만 `noid_<전역인덱스>` 로 폴백한다. 이 폴백 키는 «위치»라서 섹션이 증감하면
   *   같은 물리 섹션이 다른 키가 된다 — 그러면 여기선 lost + gained 로 «드러난다».
   *   history-diff.js R6 과 같은 판단이다: 조용히 「같음」으로 접는 것보다 드러내는 쪽이 안전하다
   *   (복구 도구에서 거짓「같음」은 사용자가 살릴 수 있었던 걸 못 살리게 만든다).
   *
   * @returns {{lost:{k,n}[], gained:{k,n}[], renamed:{k,from,to}[], keptCount:number}}
   *   lost   : 그 버전엔 있고 «지금은 없다» ← 헤드라인
   *   gained : 지금만 있다(그 버전 이후에 만든 것) — 손실 숫자에 섞이면 안 된다
   *   renamed: 키는 같은데 이름만 다르다 = **손실이 아니다**
   *   순서는 «입력 순서»(=캔버스 순서)를 그대로 따른다. 정렬하지 않는다 — 사용자는 화면에서
   *   보던 순서로 섹션을 찾는다.
   */
  function lossDiff(entrySecs, currentSecs) {
    const E = _secMap(entrySecs);
    const C = _secMap(currentSecs);
    // 신원 = 섹션 id. 같은 id 가 양쪽에 있으면 «살아 있다» — 페이지가 어디든.
    const cById = new Map();
    for (const [k, n] of C) { const id = _idOf(k); if (!cById.has(id)) cById.set(id, { k, n }); }

    const lost = [], renamed = [];
    const matched = new Set();
    let keptCount = 0;
    for (const [k, n] of E) {
      const hit = cById.get(_idOf(k));
      if (hit) {
        keptCount++;
        matched.add(hit.k);
        if (hit.n !== n) renamed.push({ k, from: n, to: hit.n });
      } else {
        lost.push({ k, n });
      }
    }
    const gained = [];
    for (const [k, n] of C) if (!matched.has(k)) gained.push({ k, n });

    return { lost, gained, renamed, keptCount };
  }

  /* 키에서 «신원»(섹션 id)만 뽑는다. `pageId::secId` → `secId`, `::` 없으면 키 그대로.
   * ★noid_* 폴백은 «위치»라 신원이 아니다 — 페이지가 다르면 다른 섹션일 수 있으므로 키 전체를 쓴다
   *   (조용히 「같음」으로 접으면 사용자가 살릴 수 있었던 걸 못 살린다 — history-diff.js R6 과 같은 판단). */
  function _idOf(k) {
    const i = String(k).indexOf('::');
    if (i === -1) return String(k);
    const id = String(k).slice(i + 2);
    return id.startsWith('noid_') ? String(k) : id;
  }

  /* secs 배열 → Map(k → n). 입력 순서 보존(Map 은 삽입 순서를 지킨다).
   * 방어: 배열이 아님 / null 원소 / k 누락 / 중복 키(먼저 나온 것이 이긴다).
   * ★모달이 통째로 안 뜨는 것보다 «일부를 조용히 버리는» 편이 낫다 — 사고 직후다. */
  function _secMap(secs) {
    const m = new Map();
    if (!Array.isArray(secs)) return m;
    for (const s of secs) {
      if (!s || typeof s !== 'object') continue;
      const k = (s.k === undefined || s.k === null) ? '' : String(s.k);
      if (!k) continue;
      if (m.has(k)) continue;                       // 중복 키는 1회만
      let n = (s.n === undefined || s.n === null) ? '' : String(s.n);
      if (!n) {
        // fingerprint 규약(name→id→'(이름 없음)')과 같은 결. '::' 가 없으면 키 전체를 쓴다
        // (indexOf(-1)+2 로 첫 글자를 잘라먹던 버그를 여기서 막는다).
        const sep = k.indexOf('::');
        n = (sep === -1 ? k : k.slice(sep + 2)) || NO_NAME;
      }
      m.set(k, n);
    }
    return m;
  }

  /* ── L2: 변경 diff — 사용자가 그 줄을 «펼칠 때만» 돈다 ───────────────────
   * ⚠️ 문서화된 교환(§6-3): 변경 판정에 쓰는 normSection 은 `.annotation-block` 도 벗긴다.
   *    ⇒ **주석만 바뀐 섹션은 「같음」으로 나온다.** 이건 버그가 아니라 «선택»이다.
   *    버전 목록을 사고 직후에 «훑는» 상황에서는 거짓양성(전부 「변경」으로 보임)이
   *    거짓음성(주석 하나 놓침)보다 훨씬 해롭다 — 전자는 목록 전체를 못 믿게 만들고,
   *    후자는 그 섹션을 열어보면 보인다. UI 는 상세 패널에 「주석·라벨 변경은 비교에서
   *    제외됩니다」라고 표시한다(P-1 정직). 이 교환을 되돌리려면 §6-3 부터 읽어라.
   *
   * ★전제: snapCanvasMap / curCanvasMap 은 **둘 다 이미 goya-asset:// 정규형**이다(파일 상단).
   *    이 함수는 정규화를 시도하지 않는다. 대신 어긋난 낌새(한쪽만 data:image)를 싸게 재서
   *    `mixedEncoding:true` 를 얹는다 — UI 가 「가짜 변경의 벽」 대신 경고를 띄우게.
   *
   * @param {Object<string,string>} snapCanvasMap {pageId: canvasHtml}
   * @param {Object<string,string>} curCanvasMap  {pageId: canvasHtml}
   * @param {{DOMParser?:Function}} [opts] 테스트/비렌더러 컨텍스트용 파서 주입. 기본은 전역 DOMParser.
   * @returns {{changed:{k,n}[], lost:{k,n}[], gained:{k,n}[],
   *            summary:{same,changed,lost,gained,total}, mixedEncoding?:true}}
   */
  function changeDiff(snapCanvasMap, curCanvasMap, opts) {
    opts = opts || {};
    const DP = opts.DOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    if (typeof DP !== 'function') {
      // 조용히 «변경 0» 을 내면 「달라진 게 없다」는 거짓말이 된다 — 차라리 터뜨린다(P-1).
      throw new Error('version-diff.changeDiff: DOMParser 가 없다 (opts.DOMParser 로 주입하라)');
    }

    /* ★[C3검수 중대③] «신원»은 L1 과 «같은» 규약이어야 한다 — `_idOf(k)`(섹션 id) 다.
     *   초판은 여기서만 `pageId::id` 전체 키로 맞춰서, 섹션을 1페이지→2페이지로 드래그만 해도
     *   같은 행이 정반대를 말했다:
     *     행 요약(L1)  = 손실 줄 없음
     *     펼친 패널(L2) = − 지금은 없는 섹션 1 … / + 그 뒤에 생긴 섹션 1 …  ← 같은 섹션이다
     *   이 파일 헤더가 스스로 「키 전체로 비교하면 멀쩡히 살아 있는 섹션을 사라졌다고 말한다 —
     *   복구 도구에서 그건 거짓 경보」라고 적어놓고 L1 만 고친 상태였다.
     *   스냅샷 v1(page key 'page') ↔ 현재 v2('page_17') 조합에선 «전량 손실»까지 간다.
     *   ⇒ 두 층이 한 신원 규약을 쓴다. 페이지는 «위치»고 섹션 id 가 «신원»이다(설계 §6-3). */
    const byIdentity = (m) => {
      const o = new Map();
      for (const [k, v] of m) { const id = _idOf(k); if (!o.has(id)) o.set(id, v); }  // 먼저 나온 것이 이긴다(L1 과 같은 규율)
      return o;
    };
    const S = byIdentity(_collect(snapCanvasMap, DP));
    const C = byIdentity(_collect(curCanvasMap, DP));

    const changed = [], lost = [], gained = [];
    let same = 0;
    for (const [id, s] of S) {
      const c = C.get(id);
      if (!c) { lost.push({ k: s.k, n: s.n }); continue; }
      if (_hash(_norm(s.el)) === _hash(_norm(c.el))) same++;
      else changed.push({ k: c.k, n: c.n || s.n });   // 이름은 «지금» 것을 쓴다(사용자가 지금 보는 이름)
    }
    for (const [id, c] of C) if (!S.has(id)) gained.push({ k: c.k, n: c.n });

    const result = {
      changed, lost, gained,
      summary: {
        same,
        changed: changed.length,
        lost: lost.length,
        gained: gained.length,
        total: same + changed.length + lost.length + gained.length,
      },
    };
    // 싸구려 방어 — indexOf 2회. 정규화는 «시도하지 않는다»(호출측 책임).
    if (_hasFoldableBase64(snapCanvasMap) !== _hasFoldableBase64(curCanvasMap)) result.mixedEncoding = true;
    return result;
  }

  /* {pageId: html} → Map(k → {k, n, el}). 순서 보존.
   * ★noid 카운터는 «페이지를 가로지르는 전역»이다 — snapshot-store.fingerprint() 가 그렇게 매긴다.
   *   여기서 페이지별로 세면 L1(인덱스 기반)과 L2(캔버스 기반)의 키가 어긋나 같은 섹션이
   *   두 층에서 다른 것으로 보인다. */
  function _collect(canvasMap, DP) {
    const out = new Map();
    if (!canvasMap || typeof canvasMap !== 'object') return out;
    const parser = new DP();
    let nth = 0;
    for (const pid of Object.keys(canvasMap)) {
      const html = canvasMap[pid];
      if (typeof html !== 'string' || html === '') continue;
      let root = null;
      try {
        const doc = parser.parseFromString(`<div id="__vdroot__">${html}</div>`, 'text/html');
        root = doc.getElementById('__vdroot__');
      } catch (_) { root = null; }
      if (!root) continue;
      root.querySelectorAll('.section-block').forEach(sec => {
        const id = sec.id || '';
        const k = `${pid}::${id || ('noid_' + nth)}`;
        nth++;
        if (out.has(k)) return;                    // 중복 키는 먼저 나온 것이 이긴다(lossDiff 와 같은 규율)
        out.set(k, { k, n: _nameOf(sec, id), el: sec });
      });
    }
    return out;
  }

  /* 섹션 이름 = data-name → .section-label 텍스트 → id → '(이름 없음)'
   * (js/section-search.js:68~74 · snapshot-store.fingerprint 와 같은 규약) */
  function _nameOf(sec, id) {
    let n = '';
    try { n = (sec.getAttribute('data-name') || '').trim(); } catch (_) {}
    if (!n) {
      let label = null;
      try { label = sec.querySelectorAll('.section-label')[0] || null; } catch (_) {}
      if (label) n = String(label.textContent || '').trim();
    }
    return n || id || NO_NAME;
  }

  /* ★[C3검수 중대⑤] 물음은 「data:image 가 있나」가 아니라 «우리가 접는 것(base64)이 남았나»다.
   *   externalizer/canonicalize 는 base64 data URI «만» 접는다(비base64 SVG 는 대상 밖) —
   *   snapshot-store 의 canonOf 가 [M4] 로 이미 같은 교훈을 겪은 자리다.
   *   초판은 indexOf('data:image') 라서, 정규형 스냅샷에 비base64 SVG 가 «하나만» 있어도
   *   양쪽 모두 true → 대칭 비교가 false → «가짜 변경의 벽»이 필요한 바로 그때 경고가 사라졌다.
   *   ⇒ externalizer 와 같은 규약(js/io/asset-externalize.js:19)으로 잰다. */
  const FOLDABLE_B64 = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*/;
  function _hasFoldableBase64(canvasMap) {
    if (!canvasMap || typeof canvasMap !== 'object') return false;
    for (const pid of Object.keys(canvasMap)) {
      const v = canvasMap[pid];
      if (typeof v === 'string' && FOLDABLE_B64.test(v)) return true;
    }
    return false;
  }

  /* ── 목록 한 줄에 박는 짧은 요약 ─────────────────────────────────────────
   * 손실 0 이면 **빈 문자열** — UI 는 그 줄(경고 줄)을 아예 안 그린다(§7-3 「손실 0이면
   * 그 줄은 안 그린다」). 여기서 「변경 없음」 같은 말을 지어내면 노이즈가 다시 는다.
   * @param {{lost:{k,n}[]}|{k,n}[]} loss lossDiff 결과 또는 lost 배열
   */
  function formatLossSummary(loss) {
    let arr = null;
    if (Array.isArray(loss)) arr = loss;
    else if (loss && typeof loss === 'object' && Array.isArray(loss.lost)) arr = loss.lost;
    const n = arr ? arr.length : 0;
    return n > 0 ? `지금은 없는 섹션 ${n}` : '';
  }

  window.versionDiff = { lossDiff, changeDiff, formatLossSummary };
})();
