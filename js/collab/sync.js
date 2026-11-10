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
     Vercel 서버리스가 WebSocket 을 못 받는다(⚰️2026-10-06: 지금은 EC2 — WS 를 «못 받는»지는 안 쟀다). 전송계층(main/collab/transport.js)만
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

  /* ── 시드 재푸시 (U6-③ · §4-발견1 해소) ──────────────────────────────────
   * ★고치는 구멍: 서버엔 «스냅샷»이 없다. 문서는 패치 재생으로만 쌓이는데 패치는
   *   프로젝트당 500개 + TTL 7일로 잘린다. 그런데 resync 감지는 sinceSeq>0 일 때만이라
   *   («sinceSeq=0 인» 신규 합류자는 잘린 걸 «영영 모른 채» 이빨 빠진 문서를 받는다.
   *   목차(sections)는 오는데 내용을 받을 길이 없다 — 조용한 데이터 불완전.
   *
   * ★서버 무변경으로 성립시킨다. 클라 사이의 유일한 통로는 presence 다:
   *   pull 이 보내는 editingSectionId 는 서버가 «그대로 보관»했다가 다른 멤버의 pull 응답
   *   presence[] 에 실어준다(_lib/collab.presenceList). 즉 이미 있는 «종»이다.
   *   ⇒ 못 받은 섹션 id 를 그 칸에 «요청 마커»로 실어 보낸다. 오너가 그걸 보면
   *     해당 key 의 _sent 만 비우고 기존 pushChanged 가 알아서 다시 올린다.
   *     서버 저장소·엔드포인트 신설 0. 종을 놓쳐도 다음 폴링이 다시 울린다.
   *
   * ⚠️경계
   *   - 마커는 «편집 중이 아닐 때만» 보낸다. 진짜 편집표시를 덮지 않는다.
   *   - 받는 쪽은 마커를 «편집 중»으로 그리지 않는다(paintPresence 에서 걸러낸다).
   *   - 구버전 클라(≤v0.8.1-collab)는 마커를 모른다 → 툴팁에 마커 문자열이 잠깐 보일 뿐
   *     기능·데이터에 영향 0(하위호환 무해).
   *   - 서버 editingSectionId 는 100자로 잘린다 → 한 번에 담을 만큼만 담고 나머지는 다음 턴에. */
  const NEED_PREFIX = '!gd-need:';
  const NEED_FIELD_MAX = 100;        // 서버(pull.js)가 editingSectionId 를 자르는 길이
  const NEED_RESCAN_TICKS = 5;       // 결손이 남아 있는 동안 목차를 다시 받아오는 주기(틱)
  const NEED_SERVE_COOLDOWN_MS = 15000;  // 같은 섹션을 되풀이해 재푸시하지 않는다
  /* ★영원히 조르지 않는다. 못 받는 «구조적» 이유가 있을 수 있다 —
   *   대표적으로 그 섹션이 «내 프로젝트에 없는 페이지»에 속한 경우(페이지 생성은 아직 동기화 대상이 아니다).
   *   그때 요청을 무한 반복하면 오너가 15초마다 그 섹션을 통째로 다시 올린다(무의미한 트래픽).
   *   ⇒ 이 횟수만큼 물어보고 포기한다. 「조용히 어긋난 채로」가 아니라 «말하고» 포기한다. */
  const NEED_MAX_ASKS = 12;
  /* 서버 섹션 천장(api/_lib/collab.js MAX_SECTION_BYTES). 성공 답의 limits 로 갈아 쓴다. 넘는 섹션은 아예 안 보낸다 —
   * 그림을 되실은 글은 수십 MB 일 수 있는데 저장마다 올리면 413 만 받고 트래픽이 샌다. */
  let _sectionLimit = 700000;
  let _peerForm = new Map();          // 보낼 글이 goya-asset 인 섹션의 원본 hash → { hash, bytes } (저장마다 파일을 다시 읽지 않게)

  let _cfg = null;                    // { projectId, collabId, actorId, seq, role }
  let _lastSavedSnapAt = -Infinity;   // 마지막으로 받은 저장 알림의 스냅 시각 — 늦게 끝난 «옛 스냅» 알림이 새 것 뒤에 와 옛 본을 올리지 않게(FLUSH-EMPTY 리뷰 2 F1)
  let _serverSections = null;         // 마지막으로 받은 서버 목차(결손 판정의 기준)
  let _needIds = [];                  // «목차엔 있는데 나한테 없는» sectionId 들
  let _needTicks = 0;
  let _servedAt = Object.create(null); // sectionId → 마지막 재푸시 시각(오너측 쿨다운)
  let _asked = Object.create(null);    // sectionId → 내가 요청한 횟수(합류자측 포기 판정)
  let _gaveUp = new Set();             // 끝내 못 받은 섹션(사용자에게 «말한» 것)
  /* ★결손 판정은 «부트스트랩 창»에서만 한다(seq 0 으로 붙은 합류자).
   *   이미 따라잡은 멤버에게 켜두면 «내가 지운 섹션»을 결손으로 오판한다 —
   *   서버 목차(sections)는 삭제를 반영하지 않기 때문이다(mergeSections 는 합집합, 삭제 경로 없음).
   *   그러면 없는 사실을 경고하고, 남의 화면에 편집중 표시를 가리게 된다. */
  let _bootstrap = false;
  let _seedRepushes = 0;              // 계측용 — 내가 재푸시를 «몇 번» 태웠나
  let _timer = null;
  let _sent = Object.create(null);    // 'pageId::secId' → «서버가 아는» hash(목차·수신분 포함)
  let _localSnap = Object.create(null); // 'pageId::secId' → «마지막 자동저장 스냅샷»의 hash
                                        //   (덮어쓰기 경고 기준 — 서버 해시와 «같은 재료»로 계산돼야 비교가 성립한다)
  let _deferred = new Map();          // sectionId → patch (USER_BUSY 로 미뤄둔 것)
  let _heldNoticed = false;
  let _pushDone = 0;                  // 리뷰 1 F4 — 끝난 pushChanged 수. 미저장 때문에 미룬 패치는 «그 뒤 push 가 한 번 끝나야» 푼다           // ⑴ «저장 안 된 내 편집 때문에 미룬다»를 이번 미룸에 한 번 말했나
  /* ★SIX ⒜(2026-10-06 · 현빈 「동시에 고쳤는데 한쪽 작업량이 날라가네」 — 지디 서버 데이터로 확정):
   *   보류된 «묵은» 원격 패치가, 그 사이 내가 올린 더 새 판을 손 뗀 뒤 «경고 없이» 덮고 → 다음 저장이 그걸 다시 올렸다
   *   (서버 seq 13 A 3061 → 14 B 3481 → ★15 B 가 3061 을 그대로 → 16 B 3483 · 13↔15 바이트 동일 · conflicts 0).
   *   ⇒ 섹션마다 «내가 마지막으로 올린 seq» 를 기억해, 그보다 묵은 원격 패치는 붙이지 않고 «충돌»로 남긴다. */
  let _lastPushedSeq = Object.create(null);   // 'pageId::secId' → 내 push 가 받은 서버 seq
  let _conflicts = new Map();                 // 'pageId::secId' → { mode:'kept'|'replaced', mineHtml, theirsHtml, theirs:{actorId,email,seq} }
  const _conflictsByProject = new Map();      // 리뷰 1 F6 — ⑷ 로 탭마다 다시 start 하므로 충돌 기록(진 쪽 판)을 프로젝트별로 남긴다(메모리)
  let _inFlight = false;
  let _owedPush = null;
  let _resumed = false;
  let _startGen = 0;                 // ⑷ 탭을 빠르게 두 번 옮기면 늦게 끝난 앞 start 가 _cfg 를 앞 프로젝트로 세우지 않게              // ⑶ 재개가 서버 해시를 심었나 — 그 전 자동저장은 모든 섹션을 «바뀜»으로 본다              // ⑵ 올리는 중에 온 저장 스냅 — 버리지 않고 끝나면 한 번 더(최신 하나)
  let _lastError = null;
  let _seqSaved = 0;                  // 디스크에 남긴 진도
  /* COLLAB-RECEIVED-PATCH-LOST-ON-REOPEN-01 — 받은 내용은 화면에만 붙고(자동저장 억제) 진도만 디스크에 올라, 안 만지고 다시 열면 내용은 없고 다시 받지도 못했다.
   * ⇒ 진도는 «내용을 디스크에 쓴 데까지»만 남긴다. _cfg.seq 는 다음 pull 이 쓰는 커서이고, 디스크로 가는 값은 _seqDurable 이다. */
  let _seqDurable = 0;
  let _owedSeq = 0;                   // 마지막 pull 이 가져온 데까지
  let _owedSave = false;              // 화면에 붙였는데 아직 디스크에 안 쓴 내용이 있다
  let _saveFailed = false;            // 실패한 뒤엔 2초 폴링마다 말고 진도 타이머(10초)로만 다시 쓴다
  let _settling = false;
  let _resumeOwed = false;            // 프로젝트가 아직 읽히는 중이라 첫 받기를 미뤘다
  /* 진도와 함께 남기는 «그때 서버와 같았던 해시». 재개 때 서버 최신 해시만 보면 내가 닫혀 있는 사이 상대가 고친 섹션이
   * 「내가 고쳤다」로 보여 낡은 판을 올려 상대 것을 가린다. 이 값과 다를 때만 내 편집이다. */
  let _durableHashes = {};
  let _baseHashes = null;
  let _hashesDirty = false;
  let _replaced = Object.create(null);   // 'pageId::secId' → { h: 받은 패치가 덮기 직전의 내 해시, at: 붙인 때(performance.now) } — ㉮
  let _serverHashes = null;              // 재개 때 서버 목차 — 내 글이 이것과 같으면 올릴 것이 없다
  let _appliedLog = [];                  // 이 세션에 붙였고 아직 진도에 안 든 패치 { seq, key, before }
  let _rewound = null;                   // 되감았을 때: seq → 그 섹션의 첫 덮이기 전 해시
  let _nextSaveAt = 0;                   // 받은 저장 사이 간격 — 큰 프로젝트에서 저장이 쉬지 않고 돌지 않게
  let _seqTimer = null;
  const _listeners = new Set();       // 상태 변화 구독(탑바 표시 등)

  /* int-3(ls-file-base 토스트 4 — ⑷ 탭 전환 autoStart 뒤): electronAPI 를 Proxy 로 흉내 낸 곳(하니스·옛 preload)에선 collab 이 «함수»로 보여도 ref/pull/push 가 없어
     start 가 던지고 «동기화를 시작하지 못했습니다» 를 거짓으로 띄웠다 ⇒ 세 문이 다 «함수»일 때만 협업 API 로 본다(아니면 없는 것 = autoStart 조용히 끝). */
  const api = () => { const c = window.electronAPI && window.electronAPI.collab; return (c && typeof c.ref === 'function' && typeof c.pull === 'function' && typeof c.push === 'function') ? c : null; };
  const mm  = () => window.marketMerge || null;

  /* ★actorId 를 «읽기만» 하면 안 된다 — 아직 블록을 하나도 안 만든 사용자는 값이 없다.
   *   빈 actorId 로 pull 하면 서버가 내 패치를 못 걸러내고, 내가 보낸 걸 내가 다시 받는다.
   *   drag-utils 의 getActorId 가 정본이다(블록 ID 에 박히는 값과 «같은 값»이어야 한다).
   *   그게 아직 없으면 같은 키·같은 형식으로 여기서 만든다 — 나중에 drag-utils 가 그걸 읽는다. */
  function actorId() {
    if (typeof window.getActorId === 'function') return window.getActorId();
    let v = '';
    /* ★조용한 까닭: 저장소가 막힌 창(사생활 모드 등)이면 아래에서 «이번 세션 값»을 만들어 쓴다 — 동기화는 계속 된다. */
    try { v = localStorage.getItem('goditor.actorId') || ''; } catch (e) { console.debug('[collab] actorId 읽기 실패 — 새로 만든다:', e); }
    if (!/^[a-z0-9]{4,8}$/.test(v)) {
      v = Math.random().toString(36).slice(2, 7);
      try { localStorage.setItem('goditor.actorId', v); } catch (e) { console.debug('[collab] actorId 저장 실패 — 이번 세션 값으로 산다:', e); }
    }
    return v;
  }

  function emit(evt) {
    /* ★조용한 까닭(A11 · 지디 판정 2026-10-06): 구독자 하나가 던져도 다른 구독자·동기화 루프를 죽이지 않게 «격리»한다.
     *   ⛔삼키지는 않는다 — 콘솔에 남긴다(구독자 쪽 결함이다). */
    for (const fn of _listeners) { try { fn(evt); } catch (e) { console.error('[collab] 구독자 예외(격리됨):', e); } }
  }

  /* ★진도(seq)를 디스크에 남긴다 — 안 남기면 앱을 껐다 켤 때마다 0 부터 다시 받아
   *   이미 반영한 남의 변경을 통째로 되받는다(느리고, 지운 섹션이 되살아난다).
   * ★매 틱마다 쓰진 않는다: 2초마다 파일을 건드릴 값이 아니다. 10초에 한 번 + 닫을 때 한 번.
   *   중간에 죽어도 손해는 «몇 초치를 다시 받는 것»뿐이다 — 되받는 건 안전한 쪽 실패다. */
  function flushSeq() {
    const c = api();
    if (!c || !_cfg || !c.seq) return;
    if (_seqDurable <= _seqSaved && !_hashesDirty) return;
    const v = _seqDurable;
    _hashesDirty = false;
    /* ★조용한 까닭(A9 · 지디 판정): 진도 저장 실패의 대가는 «다음 시작 때 몇 초치를 다시 받는 것»뿐이다(되받는 건 안전한 쪽 실패 —
     *   위 주석). 사용자가 할 일이 없다 ⇒ 화면엔 안 띄우고 debug 로만 남긴다. */
    c.seq({ projectId: _cfg.projectId, seq: v, hashes: _durableHashes }).then(() => { _seqSaved = v; }).catch((e) => { console.debug('[collab] 진도(seq) 저장 실패 — 다음에 되받음:', e); });
  }

  /* 프로젝트가 아직 안 읽혔나 — 읽는 중에 붙인 패치는 로드가 덮어 사라지고, 그 캔버스를 저장하면 파일이 빈 판으로 덮인다.
   * 주소가 이 프로젝트면 «확정(ready)» 까지 기다린다(실패 phase 도 안 붙인다). */
  function projectLoading(projectId) {
    const s = window.gdtProjectReady && window.gdtProjectReady.get ? window.gdtProjectReady.get() : null;
    if (!s) return false;
    if (s.urlProject === projectId) return !(s.phase === 'ready' && s.projectId === projectId);
    return s.phase === 'loading';
  }

  /* 탭을 옮겨도 _cfg 는 앞 프로젝트다(tab-system 은 협업을 안 부른다). 그 사이 받으면 패치가 지금 탭 캔버스에 붙거나 버려지고 진도만 오른다. */
  function paused() {
    if (!_cfg) return true;
    const active = window.activeProjectId;
    return !!(active && active !== _cfg.projectId) || projectLoading(_cfg.projectId);
  }
  /* 붙였지만 못 쓴 채 화면이 떠났다 — 그 내용은 사라졌으니 쓴 데까지 되감아 돌아왔을 때 다시 받는다. */
  function rewindUnsaved() {
    if (!_owedSave) return;
    _owedSave = false;
    _cfg.seq = _owedSeq = _seqDurable;
    Object.assign(_sent, _durableHashes);
    const first = {};
    _rewound = new Map();
    for (const e of _appliedLog) { if (!(e.key in first)) first[e.key] = e.before; _rewound.set(e.seq, first[e.key]); }
    _appliedLog = [];
  }
  /* 되감아 다시 받는 패치의 판정 재료 — 돌아온 화면의 섹션 해시(그림은 보내는 꼴로 풀어 같은 재료로) */
  async function localHashesNow(cfg) {
    const out = {};
    const base = { ..._sent };
    for (const s of collectSections(JSON.parse(window.serializeProject()))) out[s.key] = (await forPeer(s, base, cfg.projectId)).hash;
    return out;
  }

  /* 받은 내용을 디스크에 쓰고 나서 진도를 올린다. 실패·미확정이면 진도를 그대로 둬서 다음에 열 때 다시 받는다.
   * ★되보내는 고리가 없다: sync.js 머리말의 무한 왕복은 자동저장 → gd:project-saved → push 길이다. 여기는 saveProjectToFile 을 직접 불러
   *   그 사건이 안 난다(사건은 scheduleAutoSave 타이머에서만 난다). 자동저장 억제는 그대로 둔다. */
  async function settleReceived(force) {
    if (_settling || !_cfg) return;
    const cfg = _cfg;
    _settling = true;
    try {
      let upTo = _owedSeq;
      let hashes = null;
      if (_owedSave) {
        if (typeof window.saveProjectToFile !== 'function' || typeof window.serializeProject !== 'function') return;
        const active = window.activeProjectId;
        if (projectLoading(cfg.projectId) || (active && active !== cfg.projectId)) return;   // 다른 내용을 이 프로젝트로 쓰지 않는다 — 진도 타이머가 다시 온다
        /* 미뤄도 안전하다 — 진도가 안 올라 다시 열면 다시 받는다. 92MB 본에서 저장 한 번 4초·멈춤 1.2초(앱 실측)라 연달아 쓰지 않는다. */
        if (!force && Date.now() < _nextSaveAt) return;
        _owedSave = false;   // 쓰는 사이 도착한 패치는 다시 세운다
        hashes = { ..._sent };   // 이 스냅샷에 든 판 — 쓰는 사이 도착한 패치의 해시가 섞이면 다시 열 때 그 섹션을 내 편집으로 본다
        let r = null;
        const t0 = Date.now();
        try { r = await window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: cfg.projectId, quietReject: true }); }
        catch (e) { console.error('[collab] 받은 내용 저장 예외 — 진도를 안 올린다:', e); }
        if (_cfg !== cfg) return;
        if (!r || r.ok !== true || r.skipped) {   // undefined = 줄 섰다(미확정) · skipped = 안 썼다
          _owedSave = true; _saveFailed = true;
          console.warn('[collab] 받은 내용을 디스크에 못 썼다 — 진도를 안 올린다:', r && r.reason);
          return;
        }
        _saveFailed = false;
        _nextSaveAt = Date.now() + Math.max(2000, (Date.now() - t0) * 5);
        _durableHashes = hashes; _hashesDirty = true;   // 진도가 보류 패치에 묶여도 이 판은 디스크에 있다
      }
      for (const p of _deferred.values()) if (Number.isFinite(+p.seq)) upTo = Math.min(upTo, +p.seq - 1);   // 보류한 패치는 아직 안 붙었다 — 그 앞까지만
      _appliedLog = _appliedLog.filter(e => e.seq > upTo);
      if (upTo > _seqDurable) { _seqDurable = upTo; if (!hashes) { _durableHashes = { ..._sent }; _hashesDirty = true; } }
    } finally {
      _settling = false;
    }
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

  /* ── 보내는 꼴 ──────────────────────────────────────────────────────────
   * goya-asset 주소는 이 기계 파일을 가리켜 상대 화면에서 깨진다. 받는 쪽이 저장·다시 열기를 거치면 같은 섹션이 그쪽 주소로
   * 바뀌어, 그대로 올리면 보낸 사람 그림까지 깨진다. ⇒ 비교·전송 둘 다 data URL 로 되돌린 글로 한다.
   * 같은 그림이면 어느 쪽 주소든 같은 글·같은 hash 가 되어 다시 올라가지 않는다. */
  /* ★COLLAB-BIG-IMAGE-SECTION-NOT-SENT-01 — 에셋 블럭은 같은 그림을 data-img-src 와 <img class="asset-img" src> «두 번» 든다(image-handling.js setAssetImageFromSrc).
     data URL 로 풀면 섹션에 base64 사본 2개 → 원본 ≈262KB 에서 서버 천장(700KB)에 닿아 섹션이 통째로 안 갔다.
     ⇒ 천장을 «넘을 때만» img src 를 빼 사본 1개로 보낸다(data-src-from="img-src" 표식). 받는 쪽은 붙이기 전에 data-img-src 로 되살린다(restoreSlim).
     «넘을 때만» = 지금 올라가는 섹션은 글·해시 그대로(올림 폭탄·옛 판 충돌 0). 옛 판 받는 쪽은 원래 못 받던 섹션만 그림 빈 채로 받는다(지디 OK).
     ⛔GIF(data-gif-src)·섹션 배경 사본은 이번 범위 밖(지디: 별 줄). 서버·천장 무변. */
  const SLIM_MARK = 'data-src-from';
  function slimIfOver(o) {
    const bytes = o.bytes != null ? o.bytes : new Blob([o.html]).size;
    if (bytes <= _sectionLimit || o.html.indexOf('data:') === -1) return { ...o, bytes };
    const M = mm(); if (!M) return { ...o, bytes };
    const sec = new DOMParser().parseFromString(`<div id="c">${o.html}</div>`, 'text/html').querySelector('.section-block');
    if (!sec) return { ...o, bytes };
    let n = 0;
    sec.querySelectorAll('img.asset-img[src^="data:"]').forEach(img => {
      const ab = img.closest('[data-img-src]');
      if (ab && ab.getAttribute('data-img-src') === img.getAttribute('src')) { img.removeAttribute('src'); img.setAttribute(SLIM_MARK, 'img-src'); n++; }
    });
    if (!n) return { ...o, bytes };
    const html = sec.outerHTML;
    return { ...o, html, hash: M.hash(M.normSection(sec)), bytes: new Blob([html]).size };
  }
  /** 받은 섹션의 빠진 img src 를 data-img-src 로 되살린다(해시는 받은 꼴 그대로 둔다 — 내 forPeer 가 같은 꼴을 다시 만든다). */
  function restoreSlim(html) {
    if (!html || html.indexOf(SLIM_MARK) === -1) return html;
    const sec = new DOMParser().parseFromString(`<div id="c">${html}</div>`, 'text/html').querySelector('.section-block');
    if (!sec) return html;
    sec.querySelectorAll(`img.asset-img[${SLIM_MARK}="img-src"]`).forEach(img => {
      const ab = img.closest('[data-img-src]');
      if (ab && !img.getAttribute('src')) { img.setAttribute('src', ab.getAttribute('data-img-src')); img.removeAttribute(SLIM_MARK); }
    });
    return sec.outerHTML;
  }

  async function forPeer(s, base, projectId) {
    /* 이미 data URL 인 섹션도 천장을 넘으면 같은 꼴(사본 1개)로 — 받은 쪽이 저장 전이면 이 꼴이다(다르면 되돌려 올린다).
       ★㉠(지디) 단, 로컬에서 미리 막지는 않는다(bytes 를 안 싣는다 = 옛 동작 · 서버가 정한다 — 서버 진짜 천장이 700KB 보다 크면 그 섹션이 간다). 미리 막기는 goya-asset 섹션만. */
    if (s.html.indexOf('goya-asset://') === -1) { const o = slimIfOver(s); return { ...o, bytes: undefined }; }
    const known = _peerForm.get(s.hash);
    if (known && (known.hash === base[s.key] || known.bytes > _sectionLimit)) return { ...s, hash: known.hash, bytes: known.bytes };
    if (typeof window.inlineAssetsForPeer !== 'function') return s;
    let r;
    /* 읽기가 던져도 이 섹션만의 일이다 — 뒤 섹션 push 까지 멈추면 안 된다 */
    try { r = await window.inlineAssetsForPeer(s.html, projectId, Math.floor(_sectionLimit * 3 / 4)); }
    catch (e) { console.error('[collab] 그림을 못 풀었다 — 주소 그대로 둔다:', s.sectionId, e); return s; }
    if (r.tooBig) {   // 파일이 이미 천장을 넘는다 — 안 읽고 끝낸다
      const big = { hash: s.hash + ':big', bytes: r.tooBig };
      _peerForm.set(s.hash, big);
      return { ...s, ...big };
    }
    const sec = new DOMParser().parseFromString(`<div id="c">${r.html}</div>`, 'text/html').querySelector('.section-block');
    const M = mm();
    const out = slimIfOver({ ...s, html: r.html, hash: M.hash(M.normSection(sec)), bytes: new Blob([r.html]).size });
    if (!r.unresolved) _peerForm.set(s.hash, { hash: out.hash, bytes: out.bytes });   // 못 읽은 그림은 기억하지 않는다 — 파일이 나중에 생길 수 있다
    return out;
  }

  /* ── 시드 재푸시: 결손 감지 ──────────────────────────────────────────────
   * 「내가 지금 가진 섹션 id 전부」. ⛔serializeProject() 를 쓰지 않는다 —
   * 인라인 base64 가 박힌 프로젝트에서 수십 MB 문자열을 10초마다 만들 이유가 없다.
   * 현재 페이지는 DOM 이 정본, 나머지 페이지는 state 의 canvas 문자열이 정본이다. */
  function localSectionIdSet() {
    const set = new Set();
    const st = window.state;
    const canvas = document.getElementById('canvas');
    if (canvas) canvas.querySelectorAll('.section-block').forEach(el => { if (el.id) set.add(el.id); });
    if (st && Array.isArray(st.pages)) {
      const parser = new DOMParser();
      for (const pg of st.pages) {
        if (!pg || pg.id === st.currentPageId) continue;
        const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
        const root = doc.getElementById('c');
        if (root) root.querySelectorAll('.section-block').forEach(el => { if (el.id) set.add(el.id); });
      }
    }
    return set;
  }

  /** 서버 목차 대비 «내게 없는» 섹션을 다시 센다. 패치가 붙을 때마다 줄어든다. */
  function refreshNeeds() {
    if (!_cfg || !_bootstrap || !Array.isArray(_serverSections)) return;
    const have = localSectionIdSet();
    const before = _needIds.length;
    _needIds = _serverSections
      .filter(s => s && s.sectionId && !have.has(s.sectionId) && !_gaveUp.has(s.sectionId))
      .map(s => s.sectionId);
    if (before !== _needIds.length) emit({ type: 'seed_needs', missing: _needIds.length });
    // ★목차를 한 번 받아봤고 결손이 0 이면 부트스트랩은 끝났다 — 더는 훑지 않는다.
    if (!_needIds.length) { _bootstrap = false; emit({ type: 'seed_done' }); }
  }

  /** presence 하트비트에 실어보낼 «재푸시 요청» 문자열(없으면 null). */
  function needMarker() {
    if (!_needIds.length) return null;
    if (currentEditingSectionId()) return null;   // 진짜 편집표시가 우선 — 다음 틱에 보낸다
    const picked = [];
    for (const id of _needIds) {
      const next = NEED_PREFIX + picked.concat(id).join(',');
      if (next.length > NEED_FIELD_MAX) break;
      picked.push(id);
    }
    if (!picked.length) return null;
    /* 물어본 횟수를 센다. 한도를 넘긴 건 포기하고 «사용자에게 말한다» —
     * 조용히 이빨 빠진 문서를 쓰게 두는 게 이 유닛이 고치려던 바로 그 문제다. */
    const done = [];
    for (const id of picked) {
      _asked[id] = (_asked[id] || 0) + 1;
      if (_asked[id] > NEED_MAX_ASKS) { _gaveUp.add(id); done.push(id); }
    }
    if (done.length) {
      refreshNeeds();
      const msg = `⚠️ 이 공동작업본의 일부 섹션(${done.slice(0, 3).join(', ')}${done.length > 3 ? ' 외 ' + (done.length - 3) : ''})을 받지 못했습니다 — 상대가 접속했을 때 다시 시도됩니다.`;
      if (typeof window.showToast === 'function') { try { window.showToast(msg); } catch (e) { console.error('[collab] 토스트 실패:', e); } }
      console.warn('[collab]', msg);
      emit({ type: 'seed_giveup', sections: done });
    }
    return NEED_PREFIX + picked.join(',');
  }

  const isNeedMarker = (v) => typeof v === 'string' && v.indexOf(NEED_PREFIX) === 0;

  /* ── 시드 재푸시: 응답(오너) ─────────────────────────────────────────────
   * ⛔로컬 문서는 «하나도» 안 건드린다. 서버가 아는 해시 기록(_sent)만 지운다 →
   *   기존 pushChanged 가 「바뀐 섹션」으로 보고 지금 내용을 그대로 다시 올린다.
   * ★오너만 응답한다. 아무나 응답하면 같은 섹션이 여러 사람에게서 동시에 올라와
   *   서버 충돌 판정(keep-both)이 헛돌고 경고 토스트가 튄다. */
  function serveNeeds(presence) {
    if (!_cfg || _cfg.role !== 'owner') return;
    const now = Date.now();
    const wanted = new Set();
    for (const p of (presence || [])) {
      if (!p || !isNeedMarker(p.editingSectionId)) continue;
      for (const raw of p.editingSectionId.slice(NEED_PREFIX.length).split(',')) {
        const sid = raw.trim();
        if (!sid) continue;
        if (_servedAt[sid] && now - _servedAt[sid] < NEED_SERVE_COOLDOWN_MS) continue;
        wanted.add(sid);
      }
    }
    if (!wanted.size) return;
    const mine = localSectionIdSet();
    let hit = 0;
    for (const sid of wanted) {
      _servedAt[sid] = now;                        // 응답 여부와 무관하게 쿨다운(요청 폭주 방어)
      if (!mine.has(sid)) continue;                // 나도 없는 섹션은 내가 못 준다
      hit++;
      for (const key of Object.keys(_sent)) {
        if (key.slice(key.indexOf('::') + 2) === sid) delete _sent[key];
      }
    }
    if (!hit) return;
    _seedRepushes++;
    emit({ type: 'seed_repush', sections: [...wanted], count: hit });
    if (typeof window.serializeProject === 'function') {
      /* ★조용한 까닭(A10): pushChanged 안의 실패(413·오프라인 등)는 그 안에서 emit 으로 말한다. 여기 걸리는 건 직렬화 «예외»뿐. */
      try { pushChanged(window.serializeProject()); } catch (e) { console.error('[collab] 재푸시 직렬화 실패:', e); }
    }
  }

  /* ★충돌은 «반드시 보여야» 한다.
   *   서버는 keep-both 로 둘 다 보관하지만 화면엔 나중에 적용된 쪽만 뜬다.
   *   조용히 넘기면 사용자는 「내가 쓴 게 어디 갔지」를 영영 모른다.
   *   (고르는 UI 는 아직 없다 — 그래서 최소한 «있었다»는 사실은 알린다.) */
  /* ★원격 패치를 «실제로 적용했다»는 사실만 밖으로 알린다(협업 undo 스코프가 청취).
   *   ⚠️N2 대칭: 이 발화는 applyPatch 의 «적용 성공» 경로에서«만» 불린다 —
   *   USER_BUSY 보류(return false)나 실패 경로에선 부르지 않는다. 보류분까지 알리면
   *   화면엔 아직 안 붙은 원격분이 히스토리 remoteKeys 를 오염시켜, 그 섹션을 「내가
   *   안 만졌다」로 잘못 스킵하게 된다(C8 재발 경로). 보류가 풀려 flushDeferred→applyPatch
   *   가 «실제 적용»할 때 그때 이 함수가 불린다(N2 의미론과 정합). */
  function emitRemoteApplied(p) {
    _owedSave = true;
    if (!p || !p.pageId || !p.sectionId) return;
    try {
      window.dispatchEvent(new CustomEvent('gd:collab-remote-applied', {
        detail: { key: p.pageId + '::' + p.sectionId, hash: p.hash, pageId: p.pageId, sectionId: p.sectionId },
      }));
    } catch (e) { console.error('[collab] gd:collab-remote-applied 발화 실패 — 협업 undo 스코프가 이 원격분을 모른다:', e); }
  }

  function notifyConflict(conflicts) {
    const ids = conflicts.map(c => c.sectionId).filter(Boolean);
    const msg = `⚠️ 같은 섹션을 동시에 고쳤습니다 (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ' 외 ' + (ids.length - 3) : ''}) — 상대 내용이 보일 수 있습니다. 서버엔 양쪽 다 남아 있습니다.`;
    if (typeof window.showToast === 'function') { try { window.showToast(msg); return; } catch (e) { console.error('[collab] 토스트 실패:', e); } }
    console.warn('[collab]', msg);
  }

  /* ── 보내기 ────────────────────────────────────────────────────────────── */
  async function pushChanged(snapStr, snapAt) {
    if (!_cfg) return;
    /* ★COLLAB-SYNC-OLD-GAPS ⑵ — 올리는 중에 온 두 번째 저장을 버리면 다음 저장까지 서버와 어긋났다 ⇒ 최신 스냅 하나를 기억했다가 끝나면 올린다(baseSeq 는 보낼 때 읽음) */
    if (_inFlight) { _owedPush = { snap: snapStr, cfg: _cfg, at: snapAt }; return; }
    const c = api(); if (!c) return;
    let obj;
    /* ★A8(지디 판정): 저장 스냅샷이 JSON 이 아니면 «내부 오류»다 — 사용자가 할 일이 없어 화면엔 안 띄우고 error 로 남긴다. */
    try { obj = typeof snapStr === 'string' ? JSON.parse(snapStr) : snapStr; } catch (e) { console.error('[collab] 저장 스냅샷 파싱 실패 — 이번 push 건너뜀:', e); return; }

    const cfg = _cfg;
    let attempted = false;
    _inFlight = true;
    try {
      const base = { ..._sent };   // 이 글과 견줄 판 — 파일을 읽는 사이 _sent 가 움직여도 옛 글을 내 편집으로 안 본다
      const secs = [];
      for (const s of collectSections(obj)) secs.push(await forPeer(s, base, cfg.projectId));
      if (_cfg !== cfg) return;   // 파일을 읽는 사이 탭이 바뀌었다 — 이 글을 다른 방에 올리지 않는다
      // ★모든 섹션의 «스냅샷 해시»를 기록해 둔다(바뀐 것만이 아니라). 덮어쓰기 경고가
      //   이걸 서버 해시와 비교한다 — 라이브 DOM 으로 계산하면 재료가 달라 오경보가 난다.
      const changed = [];
      for (const s of secs) {
        /* 받기 전에 찍힌 스냅샷의 옛 판이다 — 올리면 상대를 되돌린다. ★COLLAB-SYNC-OLD-GAPS ㉮ — «받기 전에 찍혔을 때만» 건너뛴다(snapAt < 붙인 때).
           옛 판은 붙인 뒤 내가 그 판으로 «되돌린»(⌘Z·같은 글) 편집까지 영영 건너뛰어, 그 위로 온 상대 패치가 토스트·기록 없이 덮었다. snapAt 이 없으면(직접 부름) 옛 동작. */
        const rep = _replaced[s.key];
        if (rep && rep.h === s.hash && !(Number.isFinite(snapAt) && snapAt > rep.at)) continue;
        delete _replaced[s.key];
        _localSnap[s.key] = s.hash;
        if (_serverHashes && _serverHashes[s.key] === s.hash) { _sent[s.key] = s.hash; continue; }   // 이미 서버와 같다
        if (base[s.key] !== s.hash) changed.push(s);
      }
      if (!changed.length) return;
      attempted = true;

      // ★한 요청에 한 섹션이다. 합쳐 보내면 큰 섹션 하나 때문에 «멀쩡한 섹션까지» 같이 막힌다.
      for (const s of changed) {
        if (_cfg !== cfg) break;   // 올리는 사이 방이 바뀌었다(초대 수락 등) — 남은 섹션은 앞 방 것이다
        const bytes = s.bytes || 0;
        if (bytes > _sectionLimit) {   // 서버 413 과 같은 말 — 그 섹션만 막히고 루프는 계속 간다
          _lastError = 'too_large';
          emit({ type: 'section_too_large', sectionId: s.sectionId, detail: { sectionId: s.sectionId, bytes, limit: _sectionLimit } });
          continue;
        }
        /* ★SIX ⓒ: 이 섹션에 «보류 중»인 원격 패치가 있으면 baseSeq 를 «그 패치 직전»으로 — 그래야 서버가 keep-both 충돌로 본다
         *   (옛 판은 _cfg.seq 를 그대로 실어, 보류 패치까지 «본 셈»이 돼 서버 충돌 판정이 «충돌 없음»으로 속았다). */
        const dp = _deferred.get(s.sectionId);
        const baseSeq = (dp && Number.isFinite(+dp.seq)) ? Math.min(cfg.seq, +dp.seq - 1) : cfg.seq;
        const r = await c.push({
          collabId: cfg.collabId,
          patches: [{
            pageId: s.pageId, sectionId: s.sectionId, html: s.html, hash: s.hash,
            baseSeq, actorId: cfg.actorId, ts: new Date().toISOString(),
          }],
        });
        if (_cfg !== cfg) break;   // 답이 왔을 땐 방이 바뀌어 있다 — 새 방 상태에 적지 않는다
        if (r && r.ok) {
          _sent[s.key] = s.hash;
          const acc = Array.isArray(r.accepted) ? r.accepted.find(a => a && a.sectionId === s.sectionId) : null;
          const mySeq = (acc && Number.isFinite(+acc.seq)) ? +acc.seq : (typeof r.seq === 'number' ? r.seq : null);
          if (mySeq != null) _lastPushedSeq[s.key] = mySeq;
          /* 받기 커서(_cfg.seq)는 pull 만 올린다 — push 답의 seq 는 아직 안 받은 상대 패치까지 넘는다(COLLAB-PUSH-SEQ-SKIPS-UNPULLED-PATCH-01).
           * 내 패치는 서버 pull 이 actorId 로 빼고 주므로 커서가 뒤에 있어도 다시 안 온다. */
          if (r.limits && r.limits.section > 0) _sectionLimit = r.limits.section;
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
      _pushDone++;
      if (attempted) emit({ type: 'pushed', error: _lastError });
      const owed = _owedPush; _owedPush = null;
      if (owed && owed.cfg === _cfg) pushChanged(owed.snap, owed.at);   // 빚진 스냅이 «지금» 방 것일 때만(리뷰 1 F3 — 앞 방 push 의 finally 가 새 방 재개 push 를 버리지 않게)
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
    /* 상대가 보낸 글이다 — 열 때와 같은 세척을 붙이기 전에 한다(img onerror 가 내 화면에서 실행됐다). 해시는 상대 글 그대로 둔다. */
    if (typeof window.sanitizeCanvasHtml === 'function') p = { ...p, html: window.sanitizeCanvasHtml(p.html) };
    p = { ...p, html: restoreSlim(p.html) };   // BIG-IMAGE — 사본 1개로 온 그림의 img src 를 되살린다(해시는 받은 꼴)

    // 다른 페이지의 섹션이면 DOM 이 아니라 state.pages[].canvas 문자열을 고친다.
    if (p.pageId && p.pageId !== st.currentPageId) {
      const page = (st.pages || []).find(x => x.id === p.pageId);
      /* ★A7(지디 판정 2026-10-06): 내게 없는 페이지로 온 패치는 버려진다 = 조용한 «유실»이라 무음 불가.
       *   설계상 한계다(위 NEED_MAX_ASKS 주석: 「페이지 생성은 아직 동기화 대상이 아니다」) ⇒ 고치지 않고 «말한다».
       *   notify.js 가 세션당 1회만 토스트 + 상태로 올린다(2초 폴링마다 뜨지 않게). */
      if (!page) { emit({ type: 'patch_dropped', reason: 'page_missing', pageId: p.pageId, sectionId: p.sectionId }); return false; }
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div id="c">${page.canvas || ''}</div>`, 'text/html');
      const root = doc.getElementById('c');
      const target = root.querySelector('#' + CSS.escape(p.sectionId));
      /* 지금 페이지 갈래의 SIX ⓐ 와 같은 판정 — 내가 더 새 판을 올렸으면 묵은 패치는 안 붙이고 충돌로 남긴다 */
      const pkey = p.pageId + '::' + p.sectionId, pmine = _lastPushedSeq[pkey], ppseq = Number.isFinite(+p.seq) ? +p.seq : null;
      if (target && pmine != null && ppseq != null && ppseq <= pmine) {
        _conflicts.set(pkey, { mode: 'kept', key: pkey, pageId: p.pageId, sectionId: p.sectionId,
          mineHtml: target.outerHTML, theirsHtml: p.html, theirs: { actorId: p.actorId, email: p.actorEmail || '', seq: ppseq } });
        emit({ type: 'conflict_kept', key: pkey, sectionId: p.sectionId, theirsSeq: ppseq, mineSeq: pmine });
        return 'kept';
      }
      if (target) target.outerHTML = p.html; else root.insertAdjacentHTML('beforeend', p.html);
      page.canvas = root.innerHTML;
      // ★B1: 다른 페이지 섹션은 DOM(→MutationObserver→scheduleAutoSave) 경로를 타지 않는다.
      //   여기서 자동저장을 «명시적으로» 예약하지 않으면 이 수신 변경이 디스크에 안 남아
      //   재기동 시 조용히 유실된다(치명①). scheduleAutoSave는 디바운스라, tick 루프가
      //   수신 직후 _sent[key]=p.hash 를 기록한 «뒤»에 저장→pushChanged 가 돌고,
      //   그때 _sent[key]===hash 이므로 받은 걸 되쏘는 echo 는 나지 않는다.
      if (window.scheduleAutoSave) window.scheduleAutoSave();
      emitRemoteApplied(p);
      return true;
    }

    const el = findSectionEl(p.sectionId);
    if (el && isUserBusyIn(el)) { _deferred.set(p.sectionId, p); return false; }
    /* ★COLLAB-SYNC-OLD-GAPS ⑴ — 아직 저장 안 된 내 편집이 있으면(자동저장 대기·저장 중) 붙이지 않고 미룬다. 옛 판은 덮어쓰기 경고가 «저장 뒤» 스냅만 봐
       그 편집이 말없이 상대 글에 졌다(토스트 0). 미루면 내 저장이 baseSeq 를 그 패치 앞으로 실어(SIX ⓒ) 서버가 충돌로 보고 기존 notifyConflict 가 말한다 ·
       풀릴 때는 SIX ⓐ(kept)로 내 판을 지키고 상대 판은 충돌 기록에 남는다. ⛔저장이 «실패»로 끝났으면 미루지 않는다(아래 — 조용히 안 받는 상태 0). */
    const pid = _cfg && _cfg.projectId;
    const unsaved = !!(el && window.hasUnsavedChanges && window.hasUnsavedChanges());
    const saveFailed = !!(unsaved && window.projectLastSaveFailed && window.projectLastSaveFailed(pid));
    if (unsaved && !saveFailed) { const prev = _deferred.get(p.sectionId); _deferred.set(p.sectionId, { ...p, _heldUnsaved: true, _heldPush: prev && prev._heldUnsaved ? prev._heldPush : _pushDone + (_inFlight ? 1 : 0),   /* 리뷰 2 #2 — 날아가는 push 는 내 편집 전 스냅이다 — 그 «다음» push 가 끝나야 */ _heldAt: prev && prev._heldUnsaved ? prev._heldAt : Date.now() }); return false; }

    /* ★SIX ⓐ — 이 섹션에 내가 이미 «더 새 판»을 올렸나(내 마지막 push seq ≥ 이 패치 seq).
     *   그렇다면 이 패치는 «묵었다»: 붙이면 내 새 글을 덮고, 다음 저장이 그 묵은 판을 다시 올린다(현빈 사고).
     *   ⇒ 붙이지 않는다(내 판 유지) · 상대 판은 충돌 기록에 남겨 «되살리기» 로 고를 수 있게 한다. */
    const ckey = (p.pageId || '') + '::' + p.sectionId;
    const mine = _lastPushedSeq[ckey];
    const pseq = Number.isFinite(+p.seq) ? +p.seq : null;
    if (el && mine != null && pseq != null && pseq <= mine) {
      _deferred.delete(p.sectionId);
      _conflicts.set(ckey, { mode: 'kept', key: ckey, pageId: p.pageId, sectionId: p.sectionId,
        mineHtml: el.outerHTML, theirsHtml: p.html, theirs: { actorId: p.actorId, email: p.actorEmail || '', seq: pseq } });
      emit({ type: 'conflict_kept', key: ckey, sectionId: p.sectionId, theirsSeq: pseq, mineSeq: mine });
      return 'kept';
    }
    /* ★SIX — 상대가 «내 마지막 push 를 못 본 채»(그 baseSeq < 내 push seq) 더 늦게 올린 패치: 붙이되(나중 쓴 쪽) 덮이는 내 판을 남긴다. */
    /* ⑴ 저장 실패 중 미저장 편집이 덮이면 그 판도 남긴다(충돌 목록 «되살리기»로 고를 수 있게) */
    /* 리뷰 2 #3(옛 결함) — 내 push 가 실패·천장 초과로 못 올라간 판(_localSnap ≠ _sent)이 덮이면 토스트만 나고 되살릴 판이 없었다 ⇒ 그 판도 남긴다 */
    /* 리뷰 3 — _localSnap 이 «받은 패치가 덮은 판»이면(연달아 두 상대 패치) 내 못 올라간 글이 아니다 — 거짓 replaced(되살리기로 상대 새 글을 되돌림)를 막는다 */
    const unpushedMine = !!(_localSnap[ckey] && _localSnap[ckey] !== _sent[ckey] && _localSnap[ckey] !== p.hash && _localSnap[ckey] !== (_replaced[ckey] && _replaced[ckey].h));
    const replacedMine = (el && ((mine != null && Number.isFinite(+p.baseSeq) && +p.baseSeq < mine) || saveFailed || unpushedMine)) ? el.outerHTML : null;

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
      if ((mine && mine !== _sent[key] && mine !== p.hash && mine !== (_replaced[key] && _replaced[key].h)) || saveFailed) {   // 리뷰 3 — 같은 까닭으로 거짓 덮어쓰기 토스트(옛)도 끈다
        notifyConflict([{ sectionId: p.sectionId, otherActor: p.actorId }]);
      }
    }

    /* ★[H6] 직접 대입 유지(허용목록) — 이미 try/finally + rAF 해제다. 그리고 이 파일은
       «고전 스크립트»라 import 가 안 된다. 새 자리는 window.AutoSaveSuppress 를 써라. */
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
    if (replacedMine) {
      _conflicts.set(ckey, { mode: 'replaced', key: ckey, pageId: p.pageId, sectionId: p.sectionId,
        mineHtml: replacedMine, theirsHtml: p.html, theirs: { actorId: p.actorId, email: p.actorEmail || '', seq: pseq } });
      emit({ type: 'conflict_replaced', key: ckey, sectionId: p.sectionId, theirsSeq: pseq, mineSeq: mine });
    }
    emitRemoteApplied(p);
    return true;
  }

  /* 적용한 것«만» 「서버가 아는 것」으로 기록한다 — 안 그러면 받은 내용을 그대로 되쏜다.
   * USER_BUSY 보류(false)·거절('kept')은 기록하지 않는다(N2). 덮이기 전 판을 남긴다 — 저장은 스냅샷을 찍고 몇 초 뒤 끝나므로, 그 스냅샷의 옛 판을 내 편집으로 볼 수 있다. */
  /* ★COLLAB-SYNC-OLD-GAPS ⑸ — data-section 은 «자리 번호»(layer-panel 이 위치대로 다시 매김)인데 해시에 들어간다. 상대 번호가 실린 패치를 붙이면
     내 레이어 패널이 내 번호로 되돌려 내 해시 ≠ 받은 해시 = 다음 저장이 그 섹션을 «바뀜»으로 한 번 되올렸다.
     ⇒ 붙이기 전에 받은 섹션의 data-section 을 «지금 내 번호»로 바꾸고 해시도 그 글로 다시 잰다(_sent 가 그 해시를 적는다).
     ⛔normSection 에서 data-section 을 빼는 뿌리 고침은 안 한다 — 모든 클라이언트의 해시가 바뀌어 섞인 판 사이 재개가 전부 올린다(지디 OK). */
  function localizeSectionNum(p) {
    const M = mm(); if (!M || !p || !p.html) return p;
    const st = window.state;
    let local = null;
    if (!p.pageId || !st || p.pageId === st.currentPageId) { const el = findSectionEl(p.sectionId); local = el ? (el.getAttribute('data-section')) : null; }
    else {
      const page = (st.pages || []).find(x => x.id === p.pageId);
      if (page && page.canvas) { const t = new DOMParser().parseFromString(`<div id="c">${page.canvas}</div>`, 'text/html').querySelector('#' + CSS.escape(p.sectionId)); local = t ? t.getAttribute('data-section') : null; }
    }
    if (local == null) return p;
    const sec = new DOMParser().parseFromString(`<div id="c">${p.html}</div>`, 'text/html').querySelector('.section-block');
    if (!sec || sec.getAttribute('data-section') === local) return p;
    sec.setAttribute('data-section', local);
    return { ...p, html: sec.outerHTML, hash: M.hash(M.normSection(sec)) };
  }

  function applyRecorded(p, local) {
    const origHash = p && p.hash;
    p = localizeSectionNum(p);
    const key = (p.pageId || '') + '::' + p.sectionId;
    /* ★리뷰 1 F1 — 재개 중: 서버의 지금 판이 «내 로컬과 같고» 이 패치는 그 판이 아니다 = 묵은 패치(내가 그 위에 고쳐 올린 뒤 다시 온 것 — ⑷ 탭 재시작·앱 재기동이
       _rewound·_lastPushedSeq 를 비워 옛 보호가 안 섰다). 붙이면 화면·디스크 = 옛 패치 · 서버 = 내 것으로 갈라지고 다음 편집이 옛 판 위에서 올라간다. */
    if (_serverHashes && _localSnap[key] && _localSnap[key] === _serverHashes[key] && p.hash !== _serverHashes[key] && origHash !== _serverHashes[key]) {
      _sent[key] = _serverHashes[key];
      return 'kept_local';
    }
    /* 되감아 다시 온 패치: 돌아온 글이 덮이기 전 판이면(또는 섹션이 없으면) 화면과 함께 사라진 것이라 다시 붙인다.
     * 그 밖이면 이 패치 위에 고친 내 글이 탭 전환 저장에 실려 돌아온 것이다 — 화면을 안 건드리고 서버가 아는 해시만 적는다. */
    if (_rewound && _rewound.has(+p.seq) && local && local[key] && local[key] !== _rewound.get(+p.seq)) { _sent[key] = p.hash; return 'kept_local'; }
    const before = _localSnap[key] || _sent[key];
    const applied = applyPatch(p);
    if (applied === true && p.pageId && p.sectionId && p.hash) {
      if (before) _replaced[key] = { h: before, at: performance.now() };   // ㉮ 붙인 때 — 이보다 먼저 찍힌 스냅만 echo 로 건너뛴다
      _sent[key] = p.hash;
      if (Number.isFinite(+p.seq)) _appliedLog.push({ seq: +p.seq, key, before });
    }
    return applied;
  }

  function flushDeferred() {
    if (!_deferred.size) return;
    for (const [sid, p] of [..._deferred]) {
      const el = findSectionEl(sid);
      /* 리뷰 1 F4 — 저장이 미저장 표시를 지운 뒤 gd:project-saved(→ 내 push)가 오기 전 틈에 풀면, 아직 안 올라간 내 글 위에 상대 판이 경고 없이 붙었다.
         ⇒ 미룬 뒤 push 가 한 번 끝나야 푼다(10초 넘으면 그래도 푼다 — 영영 쥐지 않게 · 커서는 그동안 그 앞에 묶여 있어 잃지 않는다). */
      if (p._heldUnsaved && _pushDone === p._heldPush && Date.now() - (p._heldAt || 0) < 10000) continue;
      if (!el || !isUserBusyIn(el)) { _deferred.delete(sid); applyRecorded(p); }
    }
  }

  async function tick() {
    if (!_cfg) return;
    const c = api(); if (!c) return;
    if (paused()) { rewindUnsaved(); return; }
    if (_inFlight) return;                        // 올리는 중엔 안 받는다 — 올릴 글과 _sent 가 어긋난다
    const cfg = _cfg;
    if (_resumeOwed) {
      _resumeOwed = false;
      const rs = await resumeSafely();
      if (!rs || !rs.ok) { if (_cfg !== cfg) return; _resumeOwed = true; _lastError = (rs && rs.reason) || 'unknown'; emit({ type: 'pull_error', reason: _lastError }); }   // 리뷰 2 #1 — 앞 방 재개가 'switched' 로 끝나면 새 방에 «연결 끊김»을 안 낸다
      else { _lastError = null; emit({ type: 'pulled', presence: [], applied: 0, deferred: _deferred.size, missing: _needIds.length }); }   // ⑶ 재개도 «받기 회복»이다 — 받기 실패 알림·상단바 «연결 끊김»이 풀린다(collab-notify W6)
      return;
    }
    flushDeferred();                              // ★손 뗀 섹션부터 먼저 갚는다
    /* ⑴ 미저장 편집 때문에 미룬 것 — 이번 미룸에 한 번 몇 건인지 말한다(기존 토스트 · 새 UI 0). 다 풀리면 다음 미룸에 다시 말한다. */
    const held = [..._deferred.values()].filter(x => x._heldUnsaved).length;
    if (!held) _heldNoticed = false;
    else if (!_heldNoticed) { _heldNoticed = true; try { window.showToast?.(`⏳ 저장 안 된 내 편집이 있어 상대 변경 ${held}건은 저장 뒤에 받습니다`); } catch (e) { console.warn('[collab] 토스트 실패:', e); } }
    /* ★결손이 남아 있는 동안만 목차를 다시 받는다(10초에 한 번). 매 틱마다 실으면
     *   2초 폴링에 목차가 계속 따라와 응답이 무거워진다(pull.js 주석의 그 이유). */
    const wantSections = _needIds.length > 0 && (_needTicks++ % NEED_RESCAN_TICKS === 0);
    const marker = needMarker();
    const r = await c.pull({
      collabId: _cfg.collabId,
      sinceSeq: _cfg.seq,
      actorId: _cfg.actorId,
      editingSectionId: marker || currentEditingSectionId(),
      ...(wantSections ? { wantSections: true } : {}),
    });
    if (_cfg !== cfg || paused()) return;         // 받는 사이 탭이 바뀌었다 — 안 붙이고 커서도 그대로
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
      _seqDurable = Math.max(_seqDurable, _cfg.seq);   // 서버에 그 구간이 없다 — 진도를 묶어 둬도 받을 것이 없다
      // ★resync 응답엔 목차가 함께 온다(pull.js: gapLost → wantSections). 결손 판정 기준을 갈아둔다.
      if (Array.isArray(r.sections)) { _serverSections = r.sections; refreshNeeds(); }
      emit({ type: 'resync_required', reason: r.reason || 'patches_pruned', patchFloorSeq: r.patchFloorSeq });
      console.warn('[collab] 서버가 오래된 변경분을 정리했다 — 내 섹션은 다시 올리고, 못 받은 남의 변경은 되찾을 수 없다.');
      return;
    }
    const local = (_rewound && (r.patches || []).length) ? await localHashesNow(cfg) : null;
    if (_cfg !== cfg || paused()) return;
    for (const p of (r.patches || [])) applyRecorded(p, local);
    _rewound = null;
    if (typeof r.seq === 'number') { _cfg.seq = r.seq; _owedSeq = r.seq; }
    if (!_saveFailed) settleReceived();
    /* ★시드 재푸시 — 목차가 왔으면 기준을 갈고, 패치가 붙었으면 결손을 다시 센다.
     *   그리고 «내가 오너면» 남이 올린 요청 마커에 답한다. */
    if (Array.isArray(r.sections)) _serverSections = r.sections;
    refreshNeeds();
    serveNeeds(r.presence || []);
    paintPresence(r.presence || []);
    emit({ type: 'pulled', presence: r.presence || [], applied: (r.patches || []).length, deferred: _deferred.size, missing: _needIds.length });
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
  /* ★A5(2026-10-06 지디: 「무음이 아니라 거짓 성공」): 결과를 «돌려준다» — 예전엔 첫 pull 이 실패해도 아무것도 안 돌려줘서
   *   start() 가 ok:true ＋ 「started」를 냈다. 이제 { ok } 로 답하고 start() 가 그걸 읽는다. */
  async function resumeSafely() {
    const c = api(); if (!c || !_cfg) return { ok: false, reason: 'unavailable' };
    const cfg = _cfg;   // 리뷰 1 F2 — 기다리는 사이 탭이 바뀌면(⑷ 재시작) 앞 방의 패치·표식을 새 방 상태에 쓰지 않는다
    let r;
    try {
      r = await c.pull({ collabId: _cfg.collabId, sinceSeq: _cfg.seq, actorId: _cfg.actorId, wantSections: true });
    } catch (e) { console.error('[collab] 첫 받기 예외:', e); return { ok: false, reason: 'exception' }; }
    if (_cfg !== cfg) return { ok: false, reason: 'switched' };
    if (!r || !r.ok) { _lastError = (r && r.reason) || 'unknown'; return { ok: false, reason: _lastError, status: r && r.status }; }

    // ① 서버가 아는 해시를 «이미 보낸 것»으로 심는다 → 안 바뀐 섹션은 다시 안 올라간다.
    for (const s of (r.sections || [])) {
      if (s && s.sectionId && s.hash) _sent[(s.pageId || '') + '::' + s.sectionId] = s.hash;
    }
    _serverHashes = { ..._sent };
    if (_baseHashes) Object.assign(_sent, _baseHashes);   // 옛 판이 남긴 진도엔 이 값이 없다 — 그땐 위 서버 해시로 간다
    /* ⛔COLLAB-BIG-IMAGE (b) «옛 진도 첫 재개에 상대가 고친 섹션은 안 올리고 받기»는 «넣었다가 뺐다»(리뷰 1): 충돌 기록은 메모리뿐이라 재기동 전에 «되살리기»를
       안 누르면 내 오프라인 편집이 디스크·서버·메모리 어디에도 안 남았다 · 다른 페이지 섹션은 기록조차 없이 덮였다. 옛 동작(올림 → 서버 keep-both 에 둘 다 남는 1회 충돌)이 잃지 않는다. */
    _resumed = true;   // ⑶ 이제부터 자동저장 push 는 진짜 차이만 본다
    // ② 내가 그 사이 바꾼 것만 올라간다.
    if (typeof window.serializeProject === 'function') {
      /* ★조용한 까닭(A10): pushChanged 안의 실패는 그 안에서 emit 으로 말한다 — 여기는 직렬화 예외만. */
      try { await pushChanged(window.serializeProject()); } catch (e) { console.error('[collab] 재개 push 직렬화 실패:', e); }
    }
    if (_cfg !== cfg) { _serverHashes = null; return { ok: false, reason: 'switched' }; }
    // ③ 이제 남의 것을 적용한다. ★리뷰 1 F1 — _serverHashes 는 ③ 뒤에 비운다: applyRecorded 가 «서버의 지금 판이 이미 내 것»인 섹션의 묵은 패치를 안 붙인다.
    for (const p of (r.patches || [])) applyRecorded(p);   // BUGS.md:275 — 보류·거절은 applyRecorded 가 기록 안 한다
    _serverHashes = null;
    if (typeof r.seq === 'number') { _cfg.seq = r.seq; _owedSeq = r.seq; }
    await settleReceived();
    /* ★합류 직후가 결손이 가장 크게 벌어지는 순간이다 — 여기서 «목차 대 내 문서»를 처음 맞춰본다.
     *   (패치가 prune 돼 목차만 있고 내용이 없는 섹션이 여기서 잡힌다 — §4-발견1) */
    if (Array.isArray(r.sections)) _serverSections = r.sections;
    refreshNeeds();
    serveNeeds(r.presence || []);
    paintPresence(r.presence || []);
    return { ok: true };
  }

  /* ── 수명 ──────────────────────────────────────────────────────────────── */
  async function start(projectId) {
    if (!window.COLLAB_ENABLED) return { ok: false, reason: 'collab_disabled' };  // ★킬스위치: 협업 비활성 시 동기화 시작 안 함
    stop();
    const gen = ++_startGen;
    const c = api(); if (!c || !projectId) return { ok: false, reason: 'unavailable' };
    const r = await c.ref({ projectId });
    if (gen !== _startGen) return { ok: false, reason: 'switched' };   // ⑷ 그사이 다른 start(탭 전환)가 왔다
    const ref = r && r.ref;
    if (!ref || !ref.collabId) return { ok: false, reason: 'not_linked' };
    /* ★role 을 싣는다 — 시드 재푸시에 «오너만» 응답한다(serveNeeds).
     *   register 가 심는 collabRef.role='owner', 수락 경로(collab/accept.js)는 'member'. */
    _cfg = { projectId, collabId: ref.collabId, actorId: actorId(), seq: ref.seq || 0, role: ref.role || '' };
    _lastSavedSnapAt = -Infinity;
    _seqSaved = _seqDurable = _owedSeq = ref.seq || 0;
    _baseHashes = ref.hashes || null; _durableHashes = ref.hashes || {};
    _owedSave = false; _saveFailed = false; _settling = false; _resumeOwed = false; _resumed = false;
    _sent = Object.create(null);
    _localSnap = Object.create(null);
    _deferred = new Map();
    _serverSections = null; _needIds = []; _needTicks = 0;
    _servedAt = Object.create(null); _asked = Object.create(null); _gaveUp = new Set();
    _lastPushedSeq = Object.create(null); _conflicts = _conflictsByProject.get(projectId) || new Map(); _conflictsByProject.set(projectId, _conflicts); _peerForm = new Map();
    _appliedLog = []; _rewound = null;
    _replaced = Object.create(null); _serverHashes = null; _nextSaveAt = 0; _hashesDirty = false;
    /* ★seq 0 = 「이 방의 문서를 처음부터 쌓아올리는 중」 = 결손이 생길 수 있는 유일한 구간.
     *   이미 진도가 있는 멤버는 목차 대조를 아예 안 한다(위 주석의 오판 방지). */
    _bootstrap = (ref.seq || 0) === 0;
    _resumeOwed = projectLoading(projectId) || _inFlight;      // 읽는 중이면 첫 받기를 tick 으로 미룬다 · 리뷰 1 F3 — 앞 방 push 가 아직 날아가는 중이면 그것도(tick 이 _inFlight 를 기다린다)
    const rs = _resumeOwed ? { ok: true } : await resumeSafely();              // ★먼저 내 것을 올리고, 그 다음에 남의 것을 받는다
    if (gen !== _startGen) return { ok: false, reason: 'switched' };   // 리뷰 1 F5 — 밀려난 start 가 타이머를 걸면 tick 이 겹쳐 돈다
    /* ★폴링은 «실패해도» 건다 — 첫 받기만 실패한 것(오프라인 등)이면 다음 tick 이 회복한다. 예전과 같은 동작이다.
     *   바뀐 것은 «거짓말을 안 하는 것»뿐이다: 실패면 ok:false ＋ reason, 「started」 대신 「start_failed」. */
    _timer = setInterval(tick, POLL_MS);
    _seqTimer = setInterval(() => { settleReceived().finally(flushSeq); }, 10000);
    if (!rs || !rs.ok) {
      _resumeOwed = true;   // ⑶ 첫 재개가 실패하면 tick 이 재개를 다시 한다(옛: 그냥 pull 로 넘어가 다음 저장이 모든 섹션을 올렸다)
      const reason = (rs && rs.reason) || 'unknown';
      emit({ type: 'start_failed', reason, status: rs && rs.status, collabId: ref.collabId });
      return { ok: false, reason, retrying: true, collabId: ref.collabId };
    }
    emit({ type: 'started', collabId: ref.collabId });
    return { ok: true, collabId: ref.collabId };
  }

  function stop() {
    flushSeq();                                   // 닫기 전에 진도부터 남긴다
    if (_timer) clearInterval(_timer);
    if (_seqTimer) clearInterval(_seqTimer);
    _timer = null; _seqTimer = null; _cfg = null; _deferred.clear(); _owedPush = null;
    _conflicts = new Map();   // 리뷰 2 #4 — 그 방 기록은 _conflictsByProject 에 남는다 · 보통 프로젝트로 가서 앞 방 충돌을 «되살리기»로 엉뚱한 곳에 쓰지 않게
    const el = document.getElementById('collab-topbar-badge');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
    emit({ type: 'stopped' });
  }

  // 자동저장이 «끝난 뒤» 발화한다(save-load.js). 저장 안 된 걸 남에게 보내지 않기 위해서다.
  window.addEventListener('gd:project-saved', (e) => {
    if (!_cfg) return;
    const d = e.detail || {};
    if (d.projectId && _cfg.projectId && d.projectId !== _cfg.projectId) return;  // 탭 전환 레이스
    /* ★COLLAB-SYNC-OLD-GAPS ⑶ — 재개(서버 해시 심기) 전엔 _sent 가 비어 모든 섹션을 «바뀜»으로 올렸다(읽는 중 · 재개 받는 중 · 첫 재개 실패 뒤).
       편집은 안 잃는다 — 재개가 그때 프로젝트를 다시 직렬화해 진짜 차이만 올린다. */
    if (!_resumed) return;
    /* ★FLUSH-EMPTY 리뷰 2 F1 — 저장 알림은 «끝난 순서»로 온다. ⌘S(flushSave)가 줄에서 기다리는 사이 타이머 저장이 더 새 스냅을 먼저 알리면,
       ⌘S 알림이 뒤늦게 옛 스냅을 올려 상대 화면이 내 파일보다 옛 판이 된다 ⇒ 이미 받은 것보다 옛(같은) 스냅 시각이면 버린다. 시각이 없으면 옛 동작. */
    if (Number.isFinite(d.snapAt)) { if (d.snapAt <= _lastSavedSnapAt) return; _lastSavedSnapAt = d.snapAt; }
    pushChanged(d.snap, d.snapAt);
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
      && (now - new Date(p.lastSeenAt || 0).getTime()) < PRESENCE_STALE_MS)
      /* ★시드 재푸시 요청 마커는 «편집 중»이 아니다 — 그렇게 그리면 없는 사실을 지어낸다.
       *   원본을 고치지 않고 «표시용 사본»을 만든다(serveNeeds 가 원본 마커를 봐야 한다). */
      .map(p => (isNeedMarker(p.editingSectionId) ? { ...p, editingSectionId: null } : p));
    if (!_cfg || !others.length) {
      el.style.display = 'none'; el.textContent = '';
      if (window.CollabPresenceUI) { try { window.CollabPresenceUI.paint([]); } catch (e) { console.error('[collab] 편집 중 표시 지우기 실패:', e); } }
      return;
    }
    const editing = others.filter(p => p.editingSectionId);
    el.textContent = editing.length
      ? `👥 ${others.length}명 · ${editing.length}명 편집 중`
      : `👥 ${others.length}명 접속`;
    const _lbl = (id) => (window.collabNotify && window.collabNotify.sectionLabel) ? window.collabNotify.sectionLabel(id) : id;   // 「N번째 섹션」(지디 SIX ②)
    el.title = others.map(p => `${p.email || p.actorId}${p.editingSectionId ? ' — ' + _lbl(p.editingSectionId) + ' 편집 중' : ''}`).join('\n');
    if (window.CollabPresenceUI) { try { window.CollabPresenceUI.paint(others.filter(p => p.editingSectionId)); } catch (e) { console.error('[collab] 편집 중 표시 실패:', e); } }
    el.style.display = '';
  }

  /* 열린 프로젝트가 «올려진 것»이면 알아서 붙는다. 아니면 조용히 아무것도 안 한다.
   * projectId 를 URL 에서 읽는 이유: 에디터는 index.html?project=<id> 로 열리고,
   * activeProjectId 는 save-load 의 모듈 지역변수라 여기서 못 본다(전역으로 끌어내면
   * 「누가 주인인가」가 흐려진다 — 이미 있는 경계를 존중한다). */
  function autoStart() {
    if (!window.COLLAB_ENABLED) return;   // ★킬스위치: 협업 비활성 시 프로젝트 열어도 동기화 시작 안 함
    let id = '';
    /* ★조용한 까닭: 주소에 project 가 없으면(목록·빈 탭) 붙을 프로젝트가 없다 — 할 일이 없다. */
    try { id = new URLSearchParams(location.search).get('project') || ''; } catch (e) { console.debug('[collab] 주소 읽기 실패:', e); }
    if (!id || !api()) return;
    /* ★A6(2026-10-06): 성공만 info 하고 실패를 «버리던» 자리.
     *   - 연결 «후» 실패(resumeSafely)는 start() 가 이미 start_failed 를 emit 했다 → 여기서 또 말하지 않는다.
     *   - 연결 «전» 갈래 셋은 조용하다 — 까닭: not_linked = 공동작업본이 아닌 보통 프로젝트(정상) ·
     *     unavailable = 데스크탑 앱이 아닌 화면 · collab_disabled = 킬스위치 off. 셋 다 사용자가 할 일이 없다.
     *   - start() 자체가 던지면(IPC 예외) 버리지 않고 start_failed 로 말한다. */
    start(id).then(r => {
      if (r && r.ok) console.info('[collab] 동기화 시작 —', r.collabId);
    }).catch((e) => {
      console.error('[collab] 동기화 시작 예외:', e);
      emit({ type: 'start_failed', reason: 'exception' });
    });
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', autoStart);
  else autoStart();
  window.addEventListener('beforeunload', stop);

  /* ★SIX ① — 충돌 «고르기»: 내 판 / 상대 판 중 하나를 그 섹션에 둔다. 둔 판은 보통 편집처럼 자동저장 → push 된다.
   *   (서버엔 둘 다 남아 있다 — keep-both. 여기서 고르는 건 «화면과 다음 판»이다.) */
  function resolveConflict(key, which) {
    const c = _conflicts.get(key);
    if (!c) return false;
    const el = findSectionEl(c.sectionId);
    if (!el) { _conflicts.delete(key); emit({ type: 'conflict_resolved', key, which, missing: true }); return false; }
    const html = which === 'theirs' ? c.theirsHtml : c.mineHtml;
    if (el.outerHTML !== html) {
      el.outerHTML = html;
      window.rebindAll && window.rebindAll({ preserveHistory: true });
      window.pushHistory && window.pushHistory('공동작업 판 고르기');
      window.scheduleAutoSave && window.scheduleAutoSave();
    }
    _conflicts.delete(key);
    emit({ type: 'conflict_resolved', key, which });
    return true;
  }

  window.collabSync = {
    start, stop, tick, autoStart,
    conflicts: () => [..._conflicts.values()].map(c => ({ ...c })),
    resolveConflict,
    isActive: () => !!_cfg,
    status: () => ({
      ..._cfg, deferred: _deferred.size, lastError: _lastError,
      // ★시드 재푸시를 «기계로» 판정하기 위한 창구(추측 금지 — 상태를 보고 판단한다)
      bootstrap: _bootstrap, missing: _needIds.length, missingIds: [..._needIds],
      serverSections: Array.isArray(_serverSections) ? _serverSections.length : null,
      seedRepushes: _seedRepushes,
    }),
    onEvent: (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); },
    // 검증용 — 테스트에서 폴링을 기다리지 않고 즉시 한 바퀴 돌린다.
    // 검증용 — 「왜 경고가 안 떴나」를 추측하지 않고 «상태를 보고» 판정하기 위한 창구.
    _internals: {
      collectSections, applyPatch, isUserBusyIn,
      maps: () => ({ sent: { ..._sent }, localSnap: { ..._localSnap } }),
      // 시드 재푸시 검증용 — 마커 생성/결손 계산을 «직접» 재보기 위한 창구
      needMarker, refreshNeeds, localSectionIdSet, NEED_PREFIX,
      // 받은 내용 저장·진도 순서 검증용
      settleReceived, flushSeq,
    },
  };
})();
