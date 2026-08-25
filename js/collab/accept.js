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

  /** 이 설치에 이미 그 방과 연결된 프로젝트가 있나? → 있으면 그 projectId. */
  async function findLinkedProject(collabId) {
    const a = api();
    if (!a || !a.listProjects || !collabId) return null;
    let list = [];
    try { list = await a.listProjects() || []; } catch (_) { return null; }
    // ① 목록이 이미 collabRef 를 실어준다(신 레이아웃) — 파일을 다시 안 읽는다.
    for (const p of list) {
      if (p && p.collabRef && p.collabRef.collabId === collabId) return p.id;
    }
    // ② 구 레이아웃(flat)은 목록에 collabRef 칸 자체가 «없다»(undefined). 그것만 meta 를 읽는다.
    //    null 은 「읽어봤고 연결 없음」이라 다시 읽을 이유가 없다.
    for (const p of list) {
      if (!p || p.collabRef !== undefined) continue;
      try {
        const meta = await a.loadProjectMeta(p.id);
        if (meta && meta.collabRef && meta.collabRef.collabId === collabId) return p.id;
      } catch (_) {}
    }
    return null;
  }

  /** 겹치지 않는 새 projectId. ⚠️같은 ms 충돌 시 projects:save 는 «덮어쓴다» — 먼저 배제한다. */
  function freshProjectId(list) {
    const taken = new Set((list || []).map(p => p && p.id).filter(Boolean));
    let id = 'proj_' + Date.now();
    let n = 0;
    while (taken.has(id) && n < 1000) { id = 'proj_' + (Date.now() + (++n)); }
    return taken.has(id) ? null : id;
  }

  /** 빈 프로젝트 한 벌. tab-system.createNewProjectTab 과 «같은 모양»이다 —
   *  모양이 갈리면 어떤 경로로 만든 프로젝트냐에 따라 에디터가 다르게 군다. */
  function emptyProject(id, name) {
    const now = new Date().toISOString();
    const page = {
      id: 'page_1', name: 'Page 1', label: '',
      pageSettings: { bg: '#9b9b9b', gap: 100, padX: 72, padY: 32, padXExcludesAsset: true },
      canvas: '',
    };
    const emptySnap = JSON.stringify({ version: 2, currentPageId: 'page_1', pages: [page] });
    return {
      id, name: name || '공동작업',
      createdAt: now, updatedAt: now,
      version: 2,
      currentPageId: 'page_1',
      pages: [JSON.parse(JSON.stringify(page))],
      currentBranch: 'dev',
      branches: {
        main: { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() },
        dev:  { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() },
      },
    };
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

      const existing = await findLinkedProject(collabId);
      if (existing) return { ok: true, projectId: existing, name: resp.name || '', reused: true };

      let list = [];
      try { list = await a.listProjects() || []; } catch (_) {}
      const id = freshProjectId(list);
      if (!id) return { ok: false, reason: 'id_collision' };

      const proj = emptyProject(id, resp.name);
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
      } catch (_) {}
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
    const cur = () => { try { return new URLSearchParams(location.search).get('project') || ''; } catch (_) { return ''; } };
    if (typeof window.openTabForProject === 'function' && window.collabSync && typeof window.collabSync.start === 'function') {
      try {
        await window.openTabForProject(projectId);
        if (cur() === projectId) { await window.collabSync.start(projectId); return true; }
      } catch (_) {}
    }
    location.href = 'index.html?project=' + encodeURIComponent(projectId);
    return true;
  }

  window.collabAccept = { link, open, findLinkedProject };
})();
