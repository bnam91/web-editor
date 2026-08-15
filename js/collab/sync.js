/* ═══════════════════════════════════════════════════════════════════════════
   collab/sync.js — 원격 동시협업의 «루프».
   ───────────────────────────────────────────────────────────────────────────
   ★동기화 단위는 «섹션 1개»다.
     캔버스가 HTML 문자열이라 CRDT 를 못 얹는다(중앙 store 도 없다). 그래서 문자 단위가
     아니라 섹션 단위로 «통째 교체»한다. 대신 섹션이 작을수록 충돌이 줄어든다.

   ★보내는 시점 = 「저장이 «끝난» 뒤」
     저장 전에 보내면 «내 디스크엔 없는 것»을 남에게 준다. save-load 가 자동저장을 마치고
     쏘는 gd:project-saved 를 듣는다.

   ★받는 시점 = 2초 폴링
     Vercel 서버리스가 WebSocket 을 못 받는다. 전송계층(main/collab/transport.js)만
     갈아끼우면 WS 로 옮길 수 있게 여기서는 「부르면 온다」만 안다.

   ★에코 가드가 2겹이다 — 하나로는 못 막는다
     ⑴ 서버가 내 actorId 패치를 빼고 준다.
     ⑵ 원격 패치를 DOM 에 붙일 땐 state._suppressAutoSave 를 세운다.
        안 세우면 MutationObserver → scheduleAutoSave → 다시 push 로 «무한 왕복»한다.
        해제는 requestAnimationFrame 뒤에 — 동기 해제하면 잔여 mutation 이 샌다
        (history.js restoreSnapshot 이 같은 이유로 같은 패턴을 쓴다).

   ★내가 만지고 있는 섹션엔 원격 패치를 «지금» 안 붙인다 (USER_BUSY)
     타이핑 중에 문단이 통째로 바뀌면 커서와 입력이 날아간다. 미뤘다가 손을 뗀 뒤 붙인다.
     ⚠️미루기만 하고 «다시 붙이는 길»이 없으면 그 섹션은 영영 안 갱신된다 — 그래서
       보류함(_deferred)을 두고 매 폴링마다 다시 시도한다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const POLL_MS = 2000;
  const BUSY_KEY_WINDOW_MS = 1200;   // 마지막 키 입력 후 이 시간 안이면 「편집 중」

  let _cfg = null;                    // { projectId, collabId, actorId, seq }
  let _timer = null;
  let _sent = Object.create(null);    // 'pageId::secId' → «서버가 아는» hash(목차·수신분 포함)
  let _localSnap = Object.create(null); // 'pageId::secId' → «마지막 자동저장 스냅샷»의 hash
                                        //   (덮어쓰기 경고 기준 — 서버 해시와 «같은 재료»로 계산돼야 비교가 성립한다)
  let _deferred = new Map();          // sectionId → patch (USER_BUSY 로 미뤄둔 것)
  let _inFlight = false;
  let _lastError = null;
  let _seqSaved = 0;                  // 디스크에 남긴 진도
  let _seqTimer = null;
  const _listeners = new Set();       // 상태 변화 구독(탑바 표시 등)

  const api = () => (window.electronAPI && window.electronAPI.collab) || null;
  const mm  = () => window.marketMerge || null;

  /* ★actorId 를 «읽기만» 하면 안 된다 — 아직 블록을 하나도 안 만든 사용자는 값이 없다.
   *   빈 actorId 로 pull 하면 서버가 내 패치를 못 걸러내고, 내가 보낸 걸 내가 다시 받는다.
   *   drag-utils 의 getActorId 가 정본이다(블록 ID 에 박히는 값과 «같은 값»이어야 한다).
   *   그게 아직 없으면 같은 키·같은 형식으로 여기서 만든다 — 나중에 drag-utils 가 그걸 읽는다. */
  function actorId() {
    if (typeof window.getActorId === 'function') return window.getActorId();
    let v = '';
    try { v = localStorage.getItem('goditor.actorId') || ''; } catch (_) {}
    if (!/^[a-z0-9]{4,8}$/.test(v)) {
      v = Math.random().toString(36).slice(2, 7);
      try { localStorage.setItem('goditor.actorId', v); } catch (_) {}
    }
    return v;
  }

  function emit(evt) {
    for (const fn of _listeners) { try { fn(evt); } catch (_) {} }
  }

  /* ★진도(seq)를 디스크에 남긴다 — 안 남기면 앱을 껐다 켤 때마다 0 부터 다시 받아
   *   이미 반영한 남의 변경을 통째로 되받는다(느리고, 지운 섹션이 되살아난다).
   * ★매 틱마다 쓰진 않는다: 2초마다 파일을 건드릴 값이 아니다. 10초에 한 번 + 닫을 때 한 번.
   *   중간에 죽어도 손해는 «몇 초치를 다시 받는 것»뿐이다 — 되받는 건 안전한 쪽 실패다. */
  function flushSeq() {
    const c = api();
    if (!c || !_cfg || !c.seq) return;
    if (_cfg.seq <= _seqSaved) return;
    const v = _cfg.seq;
    c.seq({ projectId: _cfg.projectId, seq: v }).then(() => { _seqSaved = v; }).catch(() => {});
  }

  /* ── 「사용자가 지금 이 섹션을 만지고 있나」 ──────────────────────────────
   * main.js 의 USER_BUSY 가드와 «같은 판정»을 쓴다(activeElement + 최근 키 입력).
   * 두 곳이 다르게 판정하면 MCP 는 막히는데 협업은 밀어넣는 상황이 생긴다. */
  function isUserBusyIn(sectionEl) {
    if (!sectionEl) return false;
    const ae = document.activeElement;
    const editing = !!(ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'));
    if (editing && sectionEl.contains(ae)) return true;
    // 선택만 해둔 상태도 「만지는 중」으로 본다 — 속성패널로 값을 바꾸는 중일 수 있다.
    if (sectionEl.querySelector('.selected, .editing, .img-editing, .group-selected')) return true;
    if (sectionEl.classList.contains('selected')) return true;
    const lastKey = window._lastUserKeydown || 0;
    if (Date.now() - lastKey < BUSY_KEY_WINDOW_MS && editing) return true;
    return false;
  }

  function currentEditingSectionId() {
    const ae = document.activeElement;
    const sec = (ae && ae.closest) ? ae.closest('.section-block') : null;
    if (sec && sec.id) return sec.id;
    const sel = document.querySelector('.section-block .selected, .section-block.selected');
    const s2 = sel ? (sel.closest ? sel.closest('.section-block') : null) : null;
    return s2 && s2.id ? s2.id : null;
  }

  /* ── 프로젝트 → 섹션 목록(내용 포함) ────────────────────────────────────
   * 해시는 marketMerge 것을 «그대로» 쓴다. 같은 판정을 두 번 구현하면 언젠가 갈린다. */
  function collectSections(obj) {
    const out = [];
    const M = mm();
    if (!M) return out;
    const parser = new DOMParser();
    for (const pg of (obj.pages || [])) {
      const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
      const root = doc.getElementById('c');
      let i = 0;
      root.querySelectorAll('.section-block').forEach(sec => {
        const sectionId = sec.id || ('noid_' + (i++));
        out.push({
          key: pg.id + '::' + sectionId,
          pageId: pg.id,
          sectionId,
          html: sec.outerHTML,
          hash: M.hash(M.normSection(sec)),
        });
      });
    }
    return out;
  }

  /* ★충돌은 «반드시 보여야» 한다.
   *   서버는 keep-both 로 둘 다 보관하지만 화면엔 나중에 적용된 쪽만 뜬다.
   *   조용히 넘기면 사용자는 「내가 쓴 게 어디 갔지」를 영영 모른다.
   *   (고르는 UI 는 아직 없다 — 그래서 최소한 «있었다»는 사실은 알린다.) */
  function notifyConflict(conflicts) {
    const ids = conflicts.map(c => c.sectionId).filter(Boolean);
    const msg = `⚠️ 같은 섹션을 동시에 고쳤습니다 (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ' 외 ' + (ids.length - 3) : ''}) — 상대 내용이 보일 수 있습니다. 서버엔 양쪽 다 남아 있습니다.`;
    if (typeof window.showToast === 'function') { try { window.showToast(msg); return; } catch (_) {} }
    console.warn('[collab]', msg);
  }

  /* ── 보내기 ────────────────────────────────────────────────────────────── */
  async function pushChanged(snapStr) {
    if (!_cfg || _inFlight) return;
    const c = api(); if (!c) return;
    let obj;
    try { obj = typeof snapStr === 'string' ? JSON.parse(snapStr) : snapStr; } catch (_) { return; }

    const secs = collectSections(obj);
    // ★모든 섹션의 «스냅샷 해시»를 기록해 둔다(바뀐 것만이 아니라). 덮어쓰기 경고가
    //   이걸 서버 해시와 비교한다 — 라이브 DOM 으로 계산하면 재료가 달라 오경보가 난다.
    for (const s of secs) _localSnap[s.key] = s.hash;
    const changed = secs.filter(s => _sent[s.key] !== s.hash);
    if (!changed.length) return;

    _inFlight = true;
    try {
      // ★한 요청에 한 섹션이다. 합쳐 보내면 큰 섹션 하나 때문에 «멀쩡한 섹션까지» 같이 막힌다.
      for (const s of changed) {
        const r = await c.push({
          collabId: _cfg.collabId,
          patches: [{
            pageId: s.pageId, sectionId: s.sectionId, html: s.html, hash: s.hash,
            baseSeq: _cfg.seq, actorId: _cfg.actorId, ts: new Date().toISOString(),
          }],
        });
        if (r && r.ok) {
          _sent[s.key] = s.hash;
          if (typeof r.seq === 'number') _cfg.seq = r.seq;
          _lastError = null;
          if (r.conflicts && r.conflicts.length) { emit({ type: 'conflict', conflicts: r.conflicts }); notifyConflict(r.conflicts); }
        } else {
          _lastError = (r && r.reason) || 'unknown';
          // ★섹션 하나가 한도를 넘은 건 «그 섹션만»의 문제다 — 루프를 멈추지 않는다.
          //   대신 어떤 섹션이 왜 막혔는지 위로 올린다(사용자에게 짚어줘야 한다).
          if (_lastError === 'section_too_large' || _lastError === 'too_large') {
            emit({ type: 'section_too_large', sectionId: s.sectionId, detail: r });
            continue;
          }
          break; // 세션·오프라인·서버오류면 이번 턴은 접는다. 다음 저장에서 다시 온다.
        }
      }
    } finally {
      _inFlight = false;
      emit({ type: 'pushed', error: _lastError });
    }
  }

  /* ── 받기 ──────────────────────────────────────────────────────────────── */
  function findSectionEl(sectionId) {
    const canvas = document.getElementById('canvas');
    if (!canvas || !sectionId) return null;
    // id 에 CSS 특수문자가 들어갈 수 있다 — querySelector 대신 getElementById 로 찾고 캔버스 안인지 본다.
    const el = document.getElementById(sectionId);
    return (el && canvas.contains(el) && el.classList.contains('section-block')) ? el : null;
  }

  /** 한 패치를 지금 붙일 수 있으면 붙이고, 사용자가 만지는 중이면 보류함에 넣는다. */
  function applyPatch(p) {
    const st = window.state;
    if (!st || !p || !p.html) return false;

    // 다른 페이지의 섹션이면 DOM 이 아니라 state.pages[].canvas 문자열을 고친다.
    if (p.pageId && p.pageId !== st.currentPageId) {
      const page = (st.pages || []).find(x => x.id === p.pageId);
      if (!page) return false;
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div id="c">${page.canvas || ''}</div>`, 'text/html');
      const root = doc.getElementById('c');
      const target = root.querySelector('#' + CSS.escape(p.sectionId));
      if (target) target.outerHTML = p.html; else root.insertAdjacentHTML('beforeend', p.html);
      page.canvas = root.innerHTML;
      // ★B1: 다른 페이지 섹션은 DOM(→MutationObserver→scheduleAutoSave) 경로를 타지 않는다.
      //   여기서 자동저장을 «명시적으로» 예약하지 않으면 이 수신 변경이 디스크에 안 남아
      //   재기동 시 조용히 유실된다(치명①). scheduleAutoSave는 디바운스라, tick 루프가
      //   수신 직후 _sent[key]=p.hash 를 기록한 «뒤»에 저장→pushChanged 가 돌고,
      //   그때 _sent[key]===hash 이므로 받은 걸 되쏘는 echo 는 나지 않는다.
      if (window.scheduleAutoSave) window.scheduleAutoSave();
      return true;
    }

    const el = findSectionEl(p.sectionId);
    if (el && isUserBusyIn(el)) { _deferred.set(p.sectionId, p); return false; }

    /* ⚠️★덮어쓰기 경고 — 이쪽이 더 위험한 쪽이다.
     *   충돌을 «올린 사람»은 서버 응답으로 알게 되지만, «덮이는 사람»은 자기 화면의 글이
     *   말없이 남의 것으로 바뀐다. 아무 신호가 없으면 「내가 쓴 게 어디 갔지」로 끝난다.
     *   판정: 마지막으로 «올린» 해시와 지금 로컬 해시가 다르면 = 아직 못 올린 내 변경이 있다. */
    if (el) {
      const M = mm();
      /* ★비교는 «같은 재료»끼리 해야 한다.
       *   서버 해시는 «저장 스냅샷»에서 나왔다. 라이브 DOM 으로 계산해 비교하면 미세한 차이로
       *   손도 안 댄 섹션까지 경고가 뜬다(실측: 무관한 섹션 1건 오경보). 경고가 늑대소년이 되면
       *   진짜 충돌 때 아무도 안 본다.
       *   ⇒ 마지막 자동저장 스냅샷 해시(_localSnap)와 서버가 아는 해시(_sent)를 비교한다.
       *      다르면 = 아직 서버에 못 올린 내 작업이 이 섹션에 있다 → 지금 덮인다. */
      const key = (p.pageId || '') + '::' + p.sectionId;
      const mine = _localSnap[key];
      if (mine && mine !== _sent[key] && mine !== p.hash) {
        notifyConflict([{ sectionId: p.sectionId, otherActor: p.actorId }]);
      }
    }

    st._suppressAutoSave = true;
    try {
      if (el) {
        el.outerHTML = p.html;
      } else {
        const canvas = document.getElementById('canvas');
        if (!canvas) return false;
        canvas.insertAdjacentHTML('beforeend', p.html);   // 상대가 «새로 만든» 섹션
      }
      // restoreSnapshot 과 같은 순서 — 다만 캔버스 전체가 아니라 이 섹션만 바뀐 상태에서.
      // ★C7: 원격 수신은 로컬 undo 이력을 보존해야 한다 — rebindAll 이 clearHistory 를 부르지 않도록
      //   preserveHistory 를 넘긴다(안 그러면 원격 패치 하나가 로컬 커맨드 스택을 통째로 리셋).
      window.rebindAll && window.rebindAll({ preserveHistory: true });
      window.deselectAll && window.deselectAll();
      window.buildLayerPanel && window.buildLayerPanel();
      window.gdtFontPaintBadge && window.gdtFontPaintBadge();
    } finally {
      requestAnimationFrame(() => { st._suppressAutoSave = false; });
    }
    _deferred.delete(p.sectionId);
    return true;
  }

  function flushDeferred() {
    if (!_deferred.size) return;
    for (const [sid, p] of [..._deferred]) {
      const el = findSectionEl(sid);
      if (!el || !isUserBusyIn(el)) { _deferred.delete(sid); applyPatch(p); }
    }
  }

  async function tick() {
    if (!_cfg) return;
    const c = api(); if (!c) return;
    flushDeferred();                              // ★손 뗀 섹션부터 먼저 갚는다
    const r = await c.pull({
      collabId: _cfg.collabId,
      sinceSeq: _cfg.seq,
      actorId: _cfg.actorId,
      editingSectionId: currentEditingSectionId(),
    });
    if (!r || !r.ok) { _lastError = (r && r.reason) || 'unknown'; emit({ type: 'pull_error', reason: _lastError }); return; }
    _lastError = null;

    /* ★서버가 「네가 요구하는 구간은 이미 지웠다」(resync)고 말할 수 있다 —
     *   collab_patches 는 무한히 안 쌓이고 오래된 것부터 정리된다.
     *   ⛔이걸 무시하고 seq 만 올리면 «조용히 어긋난 채로» 계속 산다. 그게 제일 나쁘다.
     *   서버엔 그 구간의 내용이 «없다»(목차만 있다) → 복구는 두 갈래뿐이다:
     *     ⑴ 내가 가진 섹션은 다시 올려서 서버를 채운다(_sent 를 비운다).
     *     ⑵ 내가 못 받은 남의 변경은 되찾을 길이 없다 → 사람에게 «말한다». */
    if (r.resync) {
      _sent = Object.create(null);
      _localSnap = Object.create(null);
      _cfg.seq = typeof r.serverSeq === 'number' ? r.serverSeq : _cfg.seq;
      emit({ type: 'resync_required', reason: r.reason || 'patches_pruned', patchFloorSeq: r.patchFloorSeq });
      console.warn('[collab] 서버가 오래된 변경분을 정리했다 — 내 섹션은 다시 올리고, 못 받은 남의 변경은 되찾을 수 없다.');
      return;
    }
    for (const p of (r.patches || [])) {
      const applied = applyPatch(p);
      // ★적용한 것«만» 「내가 보낸 것」으로 기록한다 — 안 그러면 받은 내용을 그대로 되쏜다.
      //   ★N2(치명①): applyPatch 가 USER_BUSY 로 보류(=false)한 패치까지 기록하면
      //   화면/로컬=구버전인데 _sent=신버전이 되어, 나중에 그 섹션을 저장할 때
      //   collectSections 가 로컬 구버전을 changed 로 오판 → 내 구버전을 서버로 push 해
      //   상대의 신버전을 덮는다(남의 작업 능동 소실). 보류가 풀려 실제 적용될 때
      //   (flushDeferred→applyPatch=true) 기록된다.
      if (applied && p.pageId && p.sectionId && p.hash) _sent[p.pageId + '::' + p.sectionId] = p.hash;
    }
    if (typeof r.seq === 'number') _cfg.seq = r.seq;
    paintPresence(r.presence || []);
    emit({ type: 'pulled', presence: r.presence || [], applied: (r.patches || []).length, deferred: _deferred.size });
    // ★서버가 한 번에 주는 양엔 천장이 있다(hasMore). 남았으면 2초를 기다리지 않는다 —
    //   밀린 상태에서 2초씩 쉬면 따라잡는 데 분 단위가 걸린다.
    if (r.hasMore) setTimeout(tick, 0);
  }

  /* ── 재개 ────────────────────────────────────────────────────────────────
   * ⚠️★실측으로 잡은 데이터 유실: 연결이 끊긴 «동안»(앱 종료·오프라인·수동 정지) 내가 한 편집은
   *   push 되지 못한 채 남아 있는데, 재개하자마자 pull 이 상대 패치를 그 섹션에 덮어썼다.
   *   내 작업이 «조용히» 사라진다 — 서버 기록에도 안 남아서 되찾을 길이 없다.
   *
   * ⇒ 재개 순서를 뒤집는다: ①서버 목차를 먼저 받아 «서버가 아는 해시»를 _sent 에 심고
   *   ②내 로컬이 그와 다르면 push 한다(서버가 baseSeq 로 충돌을 판정해 keep-both 로 «둘 다» 보관)
   *   ③그제서야 남의 패치를 적용한다.
   *
   * ⚠️남은 한계(정직하게): 화면에는 결국 «나중에 적용된 쪽»이 뜬다. 서버엔 둘 다 남지만
   *   고르는 UI 는 아직 없다 — 그래서 충돌은 반드시 사용자에게 «보이게» 알린다.
   */
  async function resumeSafely() {
    const c = api(); if (!c || !_cfg) return;
    let r;
    try {
      r = await c.pull({ collabId: _cfg.collabId, sinceSeq: _cfg.seq, actorId: _cfg.actorId, wantSections: true });
    } catch (_) { return; }
    if (!r || !r.ok) { _lastError = (r && r.reason) || 'unknown'; return; }

    // ① 서버가 아는 해시를 «이미 보낸 것»으로 심는다 → 안 바뀐 섹션은 다시 안 올라간다.
    for (const s of (r.sections || [])) {
      if (s && s.sectionId && s.hash) _sent[(s.pageId || '') + '::' + s.sectionId] = s.hash;
    }
    // ② 내가 그 사이 바꾼 것만 올라간다.
    if (typeof window.serializeProject === 'function') {
      try { await pushChanged(window.serializeProject()); } catch (_) {}
    }
    // ③ 이제 남의 것을 적용한다.
    for (const p of (r.patches || [])) {
      applyPatch(p);
      if (p.pageId && p.sectionId && p.hash) _sent[p.pageId + '::' + p.sectionId] = p.hash;
    }
    if (typeof r.seq === 'number') _cfg.seq = r.seq;
    paintPresence(r.presence || []);
  }

  /* ── 수명 ──────────────────────────────────────────────────────────────── */
  async function start(projectId) {
    stop();
    const c = api(); if (!c || !projectId) return { ok: false, reason: 'unavailable' };
    const r = await c.ref({ projectId });
    const ref = r && r.ref;
    if (!ref || !ref.collabId) return { ok: false, reason: 'not_linked' };
    _cfg = { projectId, collabId: ref.collabId, actorId: actorId(), seq: ref.seq || 0 };
    _seqSaved = ref.seq || 0;
    _sent = Object.create(null);
    _localSnap = Object.create(null);
    _deferred = new Map();
    await resumeSafely();                         // ★먼저 내 것을 올리고, 그 다음에 남의 것을 받는다
    _timer = setInterval(tick, POLL_MS);
    _seqTimer = setInterval(flushSeq, 10000);
    emit({ type: 'started', collabId: ref.collabId });
    return { ok: true, collabId: ref.collabId };
  }

  function stop() {
    flushSeq();                                   // 닫기 전에 진도부터 남긴다
    if (_timer) clearInterval(_timer);
    if (_seqTimer) clearInterval(_seqTimer);
    _timer = null; _seqTimer = null; _cfg = null; _deferred.clear();
    const el = document.getElementById('collab-topbar-badge');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
    emit({ type: 'stopped' });
  }

  // 자동저장이 «끝난 뒤» 발화한다(save-load.js). 저장 안 된 걸 남에게 보내지 않기 위해서다.
  window.addEventListener('gd:project-saved', (e) => {
    if (!_cfg) return;
    const d = e.detail || {};
    if (d.projectId && _cfg.projectId && d.projectId !== _cfg.projectId) return;  // 탭 전환 레이스
    pushChanged(d.snap);
  });

  /* ── 「상대가 지금 뭘 하고 있나」 상단바 표시 ─────────────────────────────
   * ★자리를 새로 만들지 않는다 — 상단바 공용 .tb-badge 를 쓴다(글꼴대체·MCP 배지와 같은 줄).
   * ★없는 정보를 지어내지 않는다: presence 는 상대가 «폴링한» 순간의 기록이다.
   *   10초 넘게 소식이 없으면 「접속 중」이라고 말하지 않는다(거짓 안심을 준다).
   * ★[hidden] 대신 style.display 로 껐다 켠다 — display 를 가진 클래스에 [hidden] 이 지는
   *   사고가 이 조직에서 실제로 있었다(죽은 버튼이 라이브 직전까지 갔다). */
  const PRESENCE_STALE_MS = 10000;
  function paintPresence(presence) {
    const el = document.getElementById('collab-topbar-badge');
    if (!el) return;
    const me = _cfg && _cfg.actorId;
    const now = Date.now();
    const others = (presence || []).filter(p => p.actorId && p.actorId !== me
      && (now - new Date(p.lastSeenAt || 0).getTime()) < PRESENCE_STALE_MS);
    if (!_cfg || !others.length) { el.style.display = 'none'; el.textContent = ''; return; }
    const editing = others.filter(p => p.editingSectionId);
    el.textContent = editing.length
      ? `👥 ${others.length}명 · ${editing.length}명 편집 중`
      : `👥 ${others.length}명 접속`;
    el.title = others.map(p => `${p.email || p.actorId}${p.editingSectionId ? ' — ' + p.editingSectionId + ' 편집 중' : ''}`).join('\n');
    el.style.display = '';
  }

  /* 열린 프로젝트가 «올려진 것»이면 알아서 붙는다. 아니면 조용히 아무것도 안 한다.
   * projectId 를 URL 에서 읽는 이유: 에디터는 index.html?project=<id> 로 열리고,
   * activeProjectId 는 save-load 의 모듈 지역변수라 여기서 못 본다(전역으로 끌어내면
   * 「누가 주인인가」가 흐려진다 — 이미 있는 경계를 존중한다). */
  function autoStart() {
    let id = '';
    try { id = new URLSearchParams(location.search).get('project') || ''; } catch (_) {}
    if (!id || !api()) return;
    start(id).then(r => {
      if (r && r.ok) console.info('[collab] 동기화 시작 —', r.collabId);
    });
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', autoStart);
  else autoStart();
  window.addEventListener('beforeunload', stop);

  window.collabSync = {
    start, stop, tick, autoStart,
    isActive: () => !!_cfg,
    status: () => ({ ..._cfg, deferred: _deferred.size, lastError: _lastError }),
    onEvent: (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); },
    // 검증용 — 테스트에서 폴링을 기다리지 않고 즉시 한 바퀴 돌린다.
    // 검증용 — 「왜 경고가 안 떴나」를 추측하지 않고 «상태를 보고» 판정하기 위한 창구.
    _internals: { collectSections, applyPatch, isUserBusyIn, maps: () => ({ sent: { ..._sent }, localSnap: { ..._localSnap } }) },
  };
})();
