/* ═══════════════════════════════════════════════════════════════════════════
   collab/accept.js — 「초대 수락」과 「편집 가능」 사이의 빈 칸을 메운다. (U6)
   ───────────────────────────────────────────────────────────────────────────
   ★왜 있나 (버그⑦, 2026-08-15 실시연에서 잡힘)
     서버 respond 는 { ok, collabId, name, seq } 를 정상적으로 돌려주는데,
     앱은 그걸 «상태문구»로만 쓰고 버렸다(settings-modal.js). 그래서 수락한 사람은
     ⑴ 로컬에 프로젝트를 «손으로» 만들고 ⑵ proj_meta.json 에 collabRef 를 «손으로» 심어야
     비로소 동기화가 시작됐다. 시연에서 실제로 그 두 단계를 수동 주입으로 넘겼다.
     ⇒ 「수락 = 클릭 한 번」이 되도록 그 두 단계를 여기로 옮긴다.

   ★이 파일이 «하지 않는» 것 (레드라인)
     - 로컬 프로젝트를 지우거나 덮어쓰지 않는다. 만드는 건 «새 id» 뿐이고,
       id 충돌 가능성은 만들기 «전에» 목록으로 배제한다(같은 ms 에 만든 프로젝트가
       있으면 projects:save 가 남의 프로젝트를 통째로 덮는다 — 치명①).
     - 이미 그 방에 연결된 로컬 프로젝트가 있으면 «새로 만들지 않는다»(멱등).
       그리고 그 프로젝트의 collabRef 를 다시 쓰지도 않는다 — seq 를 0 으로 되감으면
       이미 반영한 남의 변경을 통째로 되받는다(느리고, 지운 섹션이 되살아난다).
     - 서버를 부르지 않는다. respond 응답을 «받아서» 쓸 뿐이다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  /** collabId → 진행 중인 link() 프로미스. 두 번 눌러도 프로젝트는 하나다.
   *  ⚠️서버 respond 는 「같은 초대 두 번 수락」을 status:'pending' 조건으로 막지만,
   *    «정확히 동시에» 들어온 두 요청은 둘 다 200+collabId 를 받을 수 있다
   *    (findOne 두 번이 updateOne 보다 먼저 도는 창). 그때 여기서 두 프로젝트가 생긴다. */
  const _inflight = new Map();

  const api = () => (typeof window !== 'undefined' && window.electronAPI) || null;

  /** 이 설치에 이미 그 방과 연결된 프로젝트가 있나?
   *  → { id } 찾음 · { id:null } 없음 · { listFailed } 목록 못 읽음 · { unreadable:[ids] } meta 못 읽은 후보 있음.
   *  ★B3·B4(2026-10-06 지디 판정 ㉠): 예전엔 실패를 전부 「없다」(null)로 뭉갰다 ⇒ 이미 연결된 방인데 «또» 만들어
   *    같은 방에 로컬 프로젝트가 둘 생겼다(중복 카드 — 「어느 게 진짜냐」를 사용자에게 떠넘김).
   *    meta 를 못 읽으면 그 프로젝트가 «이 방과 관련 있나»를 가릴 수 없다 ⇒ 가릴 수 없으면 «닫는 쪽».
   *  ⚠️맞바꿈: 데이터 꼬임(중복 생성)을 막는 대신 가용성을 깎는다 — 무관한 프로젝트 하나의 meta 가 깨져 있으면
   *    수락이 계속 실패한다. 그래서 «몇 개·어느 id» 를 실어 사용자가 손쓸 길을 남긴다. 얼마나 자주 나나 = 미측정. */
  async function scanLinked(collabId) {
    const a = api();
    if (!a || !a.listProjects || !collabId) return { id: null };
    let list = [];
    try { list = await a.listProjects() || []; } catch (e) { console.error('[collab/accept] 프로젝트 목록 읽기 실패:', e); return { id: null, listFailed: true }; }
    // ① 목록이 이미 collabRef 를 실어준다(신 레이아웃) — 파일을 다시 안 읽는다.
    for (const p of list) {
      if (p && p.collabRef && p.collabRef.collabId === collabId) return { id: p.id, list };
    }
    // ② 구 레이아웃(flat)은 목록에 collabRef 칸 자체가 «없다»(undefined). 그것만 meta 를 읽는다.
    //    null 은 「읽어봤고 연결 없음」이라 다시 읽을 이유가 없다.
    const unreadable = [];
    for (const p of list) {
      if (!p || p.collabRef !== undefined) continue;
      try {
        const meta = await a.loadProjectMeta(p.id);
        if (meta && meta.collabRef && meta.collabRef.collabId === collabId) return { id: p.id, list };
      } catch (e) {
        console.error('[collab/accept] 프로젝트 meta 읽기 실패 — 이 방과 관련 있는지 가릴 수 없다:', p.id, e);
        unreadable.push(p.id);
      }
    }
    if (unreadable.length) return { id: null, unreadable, list };
    return { id: null, list };
  }

  /** 옛 이름(window.collabAccept.findLinkedProject) — projectId 또는 null.
   *  ⚠️null 이 「없다」와 「못 읽었다」를 못 가른다 ⇒ link() 는 이걸 쓰지 않고 scanLinked 를 쓴다. 바깥 호출 0(2026-10-06 grep). */
  async function findLinkedProject(collabId) {
    return (await scanLinked(collabId)).id || null;
  }

  /** 겹치지 않는 새 projectId. ⚠️같은 ms 충돌 시 projects:save 는 «덮어쓴다» — 먼저 배제한다. */
  function freshProjectId(list) {
    const taken = new Set((list || []).map(p => p && p.id).filter(Boolean));
    let id = 'proj_' + Date.now();
    let n = 0;
    while (taken.has(id) && n < 1000) { id = 'proj_' + (Date.now() + (++n)); }
    return taken.has(id) ? null : id;
  }

  /** 빈 프로젝트 한 벌 — ⛔여기서 «새로 만들지» 않는다.
   *  「새 프로젝트」의 정본 모양은 tab-system.js buildEmptyProject 하나뿐이다.
   *  복사해 두면 언젠가 갈린다(실제로 projects.html 복사본은 배경색이 이미 다르다).
   *  없으면 만들지 «않고» 실패로 답한다 — 조용히 다른 모양을 만드느니 낫다. */
  function emptyProject(id, name) {
    if (typeof window.buildEmptyProject !== 'function') return null;
    return window.buildEmptyProject(id, name || '공동작업');
  }

  /**
   * 수락 응답 → 「열면 바로 편집되는」 로컬 프로젝트.
   * @param {{collabId:string, name?:string, owner?:string}} resp  collab/respond 응답
   * @returns {Promise<{ok:boolean, projectId?:string, name?:string, reused?:boolean, reason?:string}>}
   */
  function link(resp) {
    const collabId = resp && resp.collabId;
    if (!collabId) return Promise.resolve({ ok: false, reason: 'no_collab_id' });
    if (_inflight.has(collabId)) return _inflight.get(collabId);
    const job = (async () => {
      const a = api();
      if (!a || !a.saveProject || !a.saveProjectMeta) return { ok: false, reason: 'unavailable' };

      const scan = await scanLinked(collabId);
      if (scan.id) return { ok: true, projectId: scan.id, name: resp.name || '', reused: true };
      /* ★B4: 목록을 못 읽으면 아래 id 충돌 검사(freshProjectId)가 «빈 집합»과 견주어 항상 통과한다 = 잠그는 길 0.
       *   같은 id 면 projects:save 가 남의 프로젝트를 덮는다(위 머리 주석 · 치명①) ⇒ 만들지 않는다. */
      if (scan.listFailed) return { ok: false, reason: 'list_failed' };
      /* ★B3: meta 를 못 읽은 후보가 있으면 이미 연결된 방일 수 있다 ⇒ 만들지 않는다(중복 방지). 몇 개·어느 id 를 싣는다. */
      if (scan.unreadable) return { ok: false, reason: 'meta_unreadable', count: scan.unreadable.length, projectIds: scan.unreadable };

      const list = scan.list || [];
      const id = freshProjectId(list);
      if (!id) return { ok: false, reason: 'id_collision' };

      const proj = emptyProject(id, resp.name);
      if (!proj) return { ok: false, reason: 'no_project_factory' };
      const sr = await a.saveProject(proj);
      if (sr && sr.ok === false) return { ok: false, reason: sr.reason || 'save_failed' };

      /* collabRef 는 proj_meta.json 에 산다(main/collab/index.js setRef 와 «같은 꼴»).
       * seq:0 — 합류자는 0부터 당겨야 방의 초기 상태를 쌓아올린다(respond 의 seq 를 쓰면 안 된다). */
      const ref = {
        collabId,
        seq: 0,
        role: 'member',
        owner: resp.owner || '',
        joinedAt: new Date().toISOString(),
      };
      await a.saveProjectMeta(id, { collabRef: ref });

      // 심었는지 «확인»한다. 못 심었는데 「열기」를 주면 열어도 동기화가 안 붙는다.
      let ok = false;
      try {
        const meta = await a.loadProjectMeta(id);
        ok = !!(meta && meta.collabRef && meta.collabRef.collabId === collabId);
      } catch (e) { console.error('[collab/accept] 심은 collabRef 확인 실패:', e); }   // ok=false → ref_not_saved 로 말한다
      if (!ok) return { ok: false, reason: 'ref_not_saved', projectId: id };

      return { ok: true, projectId: id, name: proj.name, reused: false };
    })();
    _inflight.set(collabId, job);
    job.then(() => _inflight.delete(collabId), () => _inflight.delete(collabId));
    return job;
  }

  /**
   * 연결된 프로젝트를 «편집 가능 상태로» 연다.
   * 탭 시스템이 있으면 탭으로(열려 있는 다른 탭을 잃지 않는다) — switchTab 이 URL 도 갱신한다.
   * ⚠️탭 상한(MAX_TABS) 등으로 «전환이 실패»할 수 있다. 그때 동기화만 켜면 남의 캔버스에
   *   원격 패치를 붙인다(치명①). 그래서 «URL 이 실제로 그 프로젝트인지» 확인한 뒤에만 켠다.
   */
  async function open(projectId) {
    if (!projectId) return false;
    /* ★조용한 까닭: 주소를 못 읽으면 ''(=「그 프로젝트가 아니다」) — 동기화를 «안» 켜는 쪽으로 넘어진다(남의 캔버스에 붙지 않게). */
    const cur = () => { try { return new URLSearchParams(location.search).get('project') || ''; } catch (e) { console.debug('[collab/accept] 주소 읽기 실패:', e); return ''; } };
    if (typeof window.openTabForProject === 'function' && window.collabSync && typeof window.collabSync.start === 'function') {
      try {
        await window.openTabForProject(projectId);
        /* start() 실패는 start() 가 start_failed 로 말한다(sync.js A5) — 여기서 또 말하지 않는다(B1). */
        if (cur() === projectId) { await window.collabSync.start(projectId); return true; }
      } catch (e) {
        /* ★조용한 까닭(B2 · 지디 판정): 탭 전환이 실패하면 아래 «주소 이동»으로 연다 — 의도된 폴백이다. */
        console.debug('[collab/accept] 탭으로 열기 실패 — 주소 이동으로 연다:', e);
      }
    }
    location.href = 'index.html?project=' + encodeURIComponent(projectId);
    return true;
  }

  window.collabAccept = { link, open, findLinkedProject };
})();
