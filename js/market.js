/* ══════════════════════════════════════
   Marketplace (bnam91/goditor-market) — 렌더러 UI
   - 현재 프로젝트를 깃 레포에 올리기(push)
   - 계정별 마켓 목록 보기(list) + 선택 프로젝트 받기(pull → 새 프로젝트로 import)
   main: market:push/list/pull (preload electronAPI.market)
   설정 모달의 "마켓" 탭에서 renderMarketPane(container) 호출.
══════════════════════════════════════ */
(function () {
  const ACCOUNT_KEY = 'goditor.marketAccount';
  const getAccount = () => localStorage.getItem(ACCOUNT_KEY) || 'bnam91';
  const setAccount = (v) => localStorage.setItem(ACCOUNT_KEY, v);

  function _toast(msg) { try { window.showToast?.(msg); } catch (_) { console.log(msg); } }

  async function pushCurrent(account) {
    if (!window.electronAPI?.market) { _toast('⚠️ 마켓 API 없음 (앱 재시작 필요)'); return; }
    const id = window.activeProjectId;
    if (!id) { _toast('⚠️ 열린 프로젝트가 없습니다'); return; }
    const name = (typeof window.getProjectName === 'function' ? window.getProjectName() : '') || id;
    const data = window.serializeProject?.();
    if (!data) { _toast('⚠️ 프로젝트 직렬화 실패'); return; }
    // Phase 1: 전 페이지 스크래치 동봉 (state.pages[].id를 진실소스로 열거)
    let scratch = [];
    try {
      const pageIds = (window.state?.pages || []).map(p => p.id).filter(Boolean);
      scratch = (await window._scratchExportAll?.(id, pageIds)) || [];
    } catch (_) {}
    _toast('⏳ 마켓에 올리는 중…');
    const res = await window.electronAPI.market.push({ account, id, name, data, scratch });
    if (res?.ok) _toast(res.skipped ? `⚠️ 업로드 완료, 에셋·갤러리 그림 ${res.skipped}장은 파일이 없어 빠졌습니다: ${account}/${name}` : `✅ 마켓 업로드 완료: ${account}/${name}`);
    else _toast(`❌ 업로드 실패: ${res?.message || '알 수 없음'}`);
    return res;
  }

  /* 받은 패널·갤러리 항목은 남이 쓴 값이다. src·thumbSrc 는 깐깐한 data 그림만, blobPath 는 제 폴더 바로 아래 파일만 남긴다.
     src 가 그대로 남으면 캔버스로 보낼 때 innerHTML 에 들어가고, https 면 패널이 밖으로 요청하고, blobPath=proj.json 은 지우기 단추가 받은 본 파일을 지운다(S3 MKT3). svg 는 안 받는다.
     동봉 무늬(ast_notebg_*)는 svg 라 지워져도 열 때 시드가 되채우니 안 센다(js/io/save-load.js seedNoteBgPatterns). 돌려주는 값 = 못 받은 그림 수. */
  const _IMAGE_SIG = { png: '\x89PNG', jpeg: '\xFF\xD8\xFF', gif: 'GIF8', webp: 'RIFF' };
  function _isSafeImageSrc(src) {
    if (typeof src !== 'string') return false;
    const m = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
    if (!m) return false;
    try { const head = atob(m[2].slice(0, 16)); return head.startsWith(_IMAGE_SIG[m[1]]) && (m[1] !== 'webp' || head.slice(8, 12) === 'WEBP'); } catch (_) { return false; }
  }
  function _sanitizeReceivedImages(proj) {
    let bad = 0;
    const walk = (list, folder) => {
      for (const n of Array.isArray(list) ? list : []) {
        if (!n || typeof n !== 'object') continue;
        if ('src' in n && !_isSafeImageSrc(n.src)) { delete n.src; delete n.carried; if (!String(n.id).startsWith('ast_notebg_')) bad++; }
        if ('thumbSrc' in n && !_isSafeImageSrc(n.thumbSrc)) delete n.thumbSrc;
        if ('blobPath' in n && !(typeof n.blobPath === 'string' && n.blobPath.startsWith(folder + '/') && /^[^/\\]+$/.test(n.blobPath.slice(folder.length + 1)) && !n.blobPath.endsWith('/..'))) { delete n.blobPath; bad++; }
        walk(n.children, folder);
      }
    };
    walk(proj.assetsTree, 'assets');
    walk(proj.imageGallery, 'images');
    return bad;
  }

  /* 올린 본에 실려 온 패널·갤러리 그림(main.js _carryProjectImages)을 새 프로젝트의 파일로 풀어 보통 항목으로 만든다. 못 풀면 센다: 패널은 src 로 남아 그림이 보이고, 갤러리는 못 읽는다. */
  async function _unpackCarriedImages(proj, newId) {
    let failed = 0;
    const walk = async (list, save) => {
      for (const n of Array.isArray(list) ? list : []) {
        if (!n) continue;
        if (n.carried) {
          delete n.carried;
          const m = /^data:([^;]+);base64,(.*)$/s.exec(n.src || '');
          const r = m ? await save({ projectId: newId, b64: m[2], mime: m[1], originalName: n.originalName || n.name }).catch(() => null) : null;
          if (r?.ok && r.blobPath) { n.blobPath = r.blobPath; delete n.src; } else failed++;
        }
        await walk(n.children, save);
      }
    };
    await walk(proj.assetsTree, window.electronAPI.assetsSaveFile);
    await walk(proj.imageGallery, window.electronAPI.aiSaveImage);
    return failed;
  }

  async function pullProject(account, id, name) {
    if (!window.electronAPI?.market) { _toast('⚠️ 마켓 API 없음 (앱 재시작 필요)'); return; }
    _toast('⏳ 받는 중…');
    const res = await window.electronAPI.market.pull({ account, id });
    if (!res?.ok) { _toast(`❌ 받기 실패: ${res?.message || '없음'}`); return; }
    let parsed;
    try { parsed = JSON.parse(res.project.data); } catch { _toast('❌ 프로젝트 데이터 손상'); return; }
    // Phase 4: 같은 마켓 프로젝트의 로컬 복사본이 있으면 섹션 diff (1차 정책 = keep-both: 복사본으로 안전 보존)
    let divergeNote = '';
    try {
      if (window.marketMerge) {
        const projs = await window.electronAPI.listProjects?.();
        const mine = (Array.isArray(projs) ? projs : []).filter(p => p && p.marketRef && p.marketRef.id === id);
        if (mine.length) {
          const local = await window.electronAPI.loadProject(mine[0].id);
          if (local && local.pages) {
            const d = window.marketMerge.diffProjects(local, parsed);
            divergeNote = d.diverged
              ? ` · ⚠️분기(변경 ${d.summary.changed}·추가 ${d.summary.added}·삭제 ${d.summary.removed}) → 양쪽 보존`
              : ' · 로컬과 동일';
          }
        }
      }
    } catch (_) {}
    const newId = 'proj_' + Date.now();
    // Phase 2: 받은 시점의 마켓 버전을 marketRef로 박제 → 이후 "내 복사본이 최신인지" 비교 근거
    /* ⛔id·name 은 ...parsed 뒤에 둔다 — 앞에 두면 받은 data 의 id 가 이겨 그 id 의 로컬 프로젝트를 덮는다(S3 market). 시험: tests/dom/market-no-overwrite.dom.spec.js */
    const proj = { ...parsed, id: newId, name: (res.project.name || name || '마켓 프로젝트') + ' (받음)',
      marketRef: { account, id, version: res.project.version || null, updatedAt: res.project.updatedAt || null, pulledAt: new Date().toISOString() } };
    const rejected = _sanitizeReceivedImages(proj);
    const carryFailed = rejected + await _unpackCarriedImages(proj, newId);
    const saved = await window.electronAPI.saveProject(proj);
    // Phase 1: 받은 스크래치를 새 projectId 키로 복원
    let scratchFailed = false;
    try {
      let scratch = res.project.scratch;
      if (typeof scratch === 'string') scratch = JSON.parse(scratch);
      if (Array.isArray(scratch) && scratch.length) await window._scratchImportAll?.(newId, scratch);
    } catch (e) { scratchFailed = true; console.warn('[market] 받은 스크래치 복원 실패:', e.message); }
    if (saved?.ok === false) _toast('❌ 저장 실패');
    else if (scratchFailed) _toast(`⚠️ 받기 완료, 스크래치는 못 옮겼습니다 — 홈에서 "${proj.name}" 열기${divergeNote}`);
    else if (carryFailed) _toast(`⚠️ 받기 완료, 에셋·갤러리 그림 ${carryFailed}장은 못 옮겼습니다 — 홈에서 "${proj.name}" 열기${divergeNote}`);
    else _toast(`✅ 받기 완료 — 홈에서 "${proj.name}" 열기${divergeNote}`);
  }

  /* 같은 그림인가 — 그림 주소는 저장 때 data → goya 로 바뀌니 글자로 안 견준다(재머지마다 _r 이 늘었다, S3 market5 ①). 뜻은 save-load.js _sameImage 한 벌을 쓴다.
     둘 다 goya 면 파일명(내용 해시)으로 본다: 올린 data 의 goya 는 다른 프로젝트 id 를 달고 온다. */
  const _goyaFile = u => u.split('/').pop();
  async function _sameScratchImage(a, b) {
    if (a === b) return true;
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.startsWith('goya-asset:') && b.startsWith('goya-asset:')) return _goyaFile(a) === _goyaFile(b);
    return window._sameImage ? window._sameImage(a, b) : false;
  }
  /* 이 맥에 없는 goya(다른 맥의 프로젝트 폴더)면 못 그린다. «없다» 는 main 이 not found 라고 답할 때만이다 — 일시 읽기 실패를 없음으로 치면 있는 그림을 버린다(S3 scratch ②). 읽기 문이 없으면(웹) 있다고 친다. */
  async function _goyaMissingHere(src) {
    const m = /^goya-asset:\/\/([^/]+)\/(.+)$/.exec(String(src || ''));
    if (!m || !window.electronAPI?.assetsReadAsDataUri) return false;
    try {
      const r = await window.electronAPI.assetsReadAsDataUri({ projectId: decodeURIComponent(m[1]), filename: decodeURIComponent(m[2]) });
      return r?.ok === false && r.error === 'not found';
    } catch (_) { return false; }
  }
  /* 머지본 스크래치 계획 = L 의 것 + 원격 것(페이지별). 같은 id 인데 그림이 다르면 원격 쪽에 새 id 를 달고, 원격에서 온 섹션의 refLinks 토큰만 그 이름으로 바꾼다
     (안 그러면 원격 고른 섹션 링크가 L 이미지를 가리킨다, 둘다면 두 섹션이 한 항목을 나눠 쓴다). parsed.pages[].canvas 를 고치므로 저장 «전»에 부른다. 시험: tests/dom/market-no-overwrite.dom.spec.js */
  async function _planMergedScratch(parsed, local, choices, remoteScratch) {
    const pages = parsed.pages || [];
    const mine = (await window._scratchExportAll?.(local.id, pages.map(p => p.id))) || [];
    let theirs = remoteScratch;
    if (typeof theirs === 'string') theirs = JSON.parse(theirs);
    const mineOf = new Map(mine.map(b => [b.pageId, b.items]));
    const theirsOf = new Map((Array.isArray(theirs) ? theirs : []).map(b => [b.pageId, b.items || []]));
    const plan = [];
    for (const page of pages) {
      const items = [...(mineOf.get(page.id) || [])];
      const byId = new Map(items.map(i => [i.id, i]));
      const renamed = new Map();
      const missing = new Set();
      for (const it of theirsOf.get(page.id) || []) {
        const same = byId.get(it.id);
        if (!same) { items.push(it); byId.set(it.id, it); continue; }
        if (await _sameScratchImage(same.src, it.src)) continue;
        if (await _goyaMissingHere(it.src)) { missing.add(it.id); continue; }   // 깨진 원격이 멀쩡한 L 그림을 대신하지 않게 — 토큰은 그대로 L 항목을 가리킨다(S3 market5 ②). 원격 섹션이 쓰면 알린다
        /* 앞 머지가 이미 들여온 그림이면 그 항목을 쓴다 — 안 그러면 재머지마다 같은 그림의 항목이 는다 */
        let nid = null;
        for (const mineIt of items) if (await _sameScratchImage(mineIt.src, it.src)) { nid = mineIt.id; break; }
        if (nid) { renamed.set(it.id, nid); continue; }
        nid = window._scratchNewId();
        while (byId.has(nid)) nid = window._scratchNewId();
        renamed.set(it.id, nid);
        const copy = { ...it, id: nid };
        items.push(copy); byId.set(nid, copy);
      }
      if (renamed.size || missing.size) {
        const used = new Set();
        page.canvas = window.marketMerge.renameRemoteRefLinks(page, local, choices, renamed, used);
        for (const id of missing) if (used.has(id)) plan.missingShown = (plan.missingShown || 0) + 1;
      }
      if (items.length) plan.push({ pageId: page.id, items });
    }
    return plan;
  }
  /* 외부화된 항목은 goya-asset://L 이다. 파일은 복제가 옮겼으니 src 도 M 으로 — 안 바꾸면 L 을 지울 때 scratch-missing 이 된다. */
  async function _importMergedScratch(newId, localId, plan) {
    const from = `goya-asset://${localId}/`, to = `goya-asset://${newId}/`;
    const reSrc = it => (typeof it.src === 'string' && it.src.startsWith(from) ? { ...it, src: to + it.src.slice(from.length) } : it);
    await window._scratchImportAll?.(newId, plan.map(({ pageId, items }) => ({ pageId, items: items.map(reSrc) })), { keepLinkDy: true });
  }

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Phase 4b: 인터랙티브 resolve 모달 빌더 — 섹션별 [내것/원격/둘다] → applyResolve → 새 머지 프로젝트로 원자 저장(원본 불변).
  // 데이터 fetch와 분리(테스트 가능). saveFn 주입(기본 electronAPI.saveProject).
  function buildResolveModal(meta, local, remoteData, saveFn) {
    if (!window.marketMerge) { _toast('⚠️ 머지 엔진 없음 (앱 재시작 필요)'); return; }
    /* 머지본은 원본 L 의 에셋을 쓴다. goya-asset URL 이 hostname 에 프로젝트 id 를 박으니 saveProject 로 새 id 에 저장하면 L 을 지울 때 이미지·패널·갤러리가 깨진다 ⇒ 복제 길(에셋 하드링크·URL 재매핑·날짜)을 탄다. 시험: tests/dom/market-no-overwrite.dom.spec.js */
    saveFn = saveFn || (p => window.electronAPI.duplicateProject({ sourceProjectId: local.id, newName: p.name, sourceData: p }));
    const { account, id, name } = meta;
    const diverged = window.marketMerge.diffProjects(local, remoteData).sections.filter(s => s.status !== 'same');
    if (!diverged.length) { _toast('변경점 없음 — 로컬이 최신과 동일'); return; }
    const LABELS = { changed: ['내것', '원격', '둘다'], added: ['무시', '받기', '둘다'], removed: ['유지', '삭제', '—'] };
    const def = { changed: 'mine', added: 'theirs', removed: 'mine' };
    const ov = document.createElement('div');
    ov.className = 'market-resolve-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `<div style="background:#222;border:1px solid #3a3a3a;border-radius:8px;width:560px;max-height:80vh;display:flex;flex-direction:column;color:#e8e8e8;font-size:13px;">
      <div style="padding:14px 16px;border-bottom:1px solid #3a3a3a;font-weight:600;">🔀 섹션 머지 — ${_esc(name)} (분기 ${diverged.length}섹션)</div>
      <div id="rsv-list" style="overflow:auto;padding:8px 16px;flex:1;"></div>
      <div style="padding:12px 16px;border-top:1px solid #3a3a3a;display:flex;gap:8px;justify-content:flex-end;">
        <button id="rsv-cancel" class="settings-btn settings-btn-secondary">취소</button>
        <button id="rsv-apply" class="settings-btn settings-btn-primary">머지 적용(새 프로젝트로 저장)</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#rsv-list').innerHTML = diverged.map(s => {
      const secId = s.key.split('::').slice(-1)[0];
      const opts = LABELS[s.status] || ['내것', '원격', '둘다'];
      return `<div style="padding:7px 0;border-bottom:1px solid #2c2c2c;display:flex;align-items:center;gap:8px;">
        <span style="flex:1;font-family:monospace;">${_esc(secId)} <em style="color:#888;font-style:normal;">(${s.status})</em></span>
        ${opts.map((lbl, i) => { const v = ['mine', 'theirs', 'both'][i]; return lbl === '—' ? '' : `<label style="font-size:12px;"><input type="radio" name="r-${_esc(s.key)}" value="${v}" ${v === def[s.status] ? 'checked' : ''}> ${lbl}</label>`; }).join('')}
      </div>`;
    }).join('');
    ov.querySelector('#rsv-cancel').onclick = () => ov.remove();
    const applyBtn = ov.querySelector('#rsv-apply');
    applyBtn.onclick = async () => {
      if (applyBtn.disabled) return;
      applyBtn.disabled = true;   // 두 번 누르면 머지본이 둘 생겼다(S3 market3 ④, 저장을 기다리는 사이 다음 클릭이 들어온다)
      try { await _applyMerge(); } finally { if (ov.isConnected) applyBtn.disabled = false; }
    };
    const _applyMerge = async () => {
      const choices = {};
      // 체크된 radio를 직접 순회(키에 '::' 포함 → 셀렉터 이스케이프 회피). name = 'r-'+key.
      ov.querySelectorAll('#rsv-list input[type=radio]:checked').forEach(r => { choices[r.name.slice(2)] = r.value; });
      const parsed = JSON.parse(window.marketMerge.applyResolve(local, remoteData, choices));
      /* 전부 무시·삭제면 빈 페이지가 말없이 저장됐다(S3 scratch2) ⇒ 적용 전에 묻는다. 원래 비어 있던 페이지는 안 센다 */
      const hadSections = (d, pid) => String((d.pages || []).find(p => p.id === pid)?.canvas || '').includes('section-block');
      const emptied = (parsed.pages || []).filter(p => !String(p.canvas || '').includes('section-block') && (hadSections(local, p.id) || hadSections(remoteData, p.id)));
      if (emptied.length && !window.confirm(`이대로 머지하면 ${emptied.length}개 페이지가 빈 페이지가 됩니다. 계속할까요?`)) return;
      /* id 를 ...parsed 에서 안 쓴다 — applyResolve 는 local(id·name 있음)을 복사한다. 새 id 는 복제 길이 정한다(S3 market). */
      const proj = { ...parsed, name: (name || '머지') + ' (머지)',
        marketRef: { account, id, version: meta.version || null, updatedAt: meta.updatedAt || null, pulledAt: new Date().toISOString() } };
      let plan = null, scratchFailed = false;
      try { plan = await _planMergedScratch(proj, local, choices, meta.scratch); }
      catch (e) { scratchFailed = true; console.warn('[market] 머지본 스크래치 계획 실패:', e.message); }
      const saved = await saveFn(proj);
      if (saved?.newProjectId && plan) {
        try { await _importMergedScratch(saved.newProjectId, local.id, plan); }
        catch (e) { scratchFailed = true; console.warn('[market] 머지본 스크래치 복사 실패:', e.message); }
      }
      ov.remove();
      if (saved?.ok === false) _toast('❌ 저장 실패');
      else if (scratchFailed) _toast(`⚠️ 머지 완료, 스크래치는 못 옮겼습니다 — 홈에서 "${proj.name}" 열기`);
      else if (plan?.missingShown) _toast(`⚠️ 머지 완료, 원격 그림 ${plan.missingShown}장이 이 맥에 없어 내 그림으로 두었습니다 — 홈에서 "${proj.name}" 열기`);
      else _toast(`✅ 머지 완료 — 홈에서 "${proj.name}" 열기`);
    };
    return ov;
  }
  async function openResolveModal(account, id, name, localProjId) {
    if (!window.marketMerge) { _toast('⚠️ 머지 엔진 없음 (앱 재시작 필요)'); return; }
    _toast('⏳ 머지 준비 중…');
    const res = await window.electronAPI.market.pull({ account, id });
    if (!res?.ok) { _toast(`❌ 받기 실패: ${res?.message || ''}`); return; }
    let remoteData; try { remoteData = JSON.parse(res.project.data); } catch { _toast('❌ 원격 데이터 손상'); return; }
    const local = await window.electronAPI.loadProject(localProjId);
    if (!local || !local.pages) { _toast('❌ 로컬 프로젝트 로드 실패'); return; }
    buildResolveModal({ account, id, name, version: res.project.version, updatedAt: res.project.updatedAt, scratch: res.project.scratch }, local, remoteData);
  }
  window.marketOpenResolve = openResolveModal;
  window.marketBuildResolveModal = buildResolveModal;

  async function renderMarketPane(container) {
    const account = getAccount();
    container.innerHTML = `
      <div class="settings-section-title">마켓플레이스 (bnam91/goditor-market)</div>
      <div class="settings-help">현재 프로젝트를 깃 레포에 올리고, 계정별 마켓에서 다른 프로젝트를 받을 수 있습니다.</div>
      <div class="market-row" style="display:flex;align-items:center;gap:8px;margin:10px 0;">
        <label style="font-size:12px;color:var(--ui-text-sub,#888)">내 계정</label>
        <input id="market-account" type="text" value="${_esc(account)}" style="flex:0 0 160px;height:28px;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:4px;color:#ddd;padding:0 8px;font-size:12px">
        <button id="market-push-btn" class="settings-btn settings-btn-primary" style="height:30px">현재 프로젝트 올리기</button>
        <button id="market-refresh-btn" class="settings-btn settings-btn-secondary" style="height:30px">목록 새로고침</button>
      </div>
      <div id="market-list" style="margin-top:8px;max-height:340px;overflow:auto;border-top:1px solid #2a2a2a;padding-top:8px;">
        <div style="color:#888;font-size:12px;padding:12px 0;">목록 불러오는 중…</div>
      </div>`;

    const accInput = container.querySelector('#market-account');
    accInput.addEventListener('change', () => setAccount(accInput.value.trim() || 'bnam91'));
    container.querySelector('#market-push-btn').addEventListener('click', async () => {
      await pushCurrent(accInput.value.trim() || 'bnam91');
      loadList();
    });
    container.querySelector('#market-refresh-btn').addEventListener('click', () => loadList());

    async function loadList() {
      const listEl = container.querySelector('#market-list');
      listEl.innerHTML = `<div style="color:#888;font-size:12px;padding:12px 0;">목록 불러오는 중…</div>`;
      if (!window.electronAPI?.market) { listEl.innerHTML = `<div style="color:#c66;font-size:12px;">마켓 API 없음 — 앱 재시작 필요</div>`; return; }
      // Phase 3: gh 인증 선점검 (미인증이면 list/pull이 통째 죽으므로 먼저 안내)
      const auth = await window.electronAPI.market.auth?.();
      if (auth && auth.ok === false) { listEl.innerHTML = `<div style="color:#c66;font-size:12px;">${_esc(auth.message)}</div>`; return; }
      const res = await window.electronAPI.market.list();
      if (!res?.ok) { listEl.innerHTML = `<div style="color:#c66;font-size:12px;">목록 실패: ${_esc(res?.message)}</div>`; return; }
      const items = res.items || [];
      if (!items.length) { listEl.innerHTML = `<div style="color:#888;font-size:12px;padding:12px 0;">아직 올라온 프로젝트가 없습니다.</div>`; return; }
      // Phase 2: 내 로컬 복사본 marketRef ↔ 마켓 version 비교 → 최신여부 배지
      const localRefs = {};
      try {
        const projs = await window.electronAPI.listProjects?.();
        (Array.isArray(projs) ? projs : []).forEach(p => {
          const r = p && p.marketRef;
          if (r && r.id && (!localRefs[r.id] || (r.pulledAt || '') > (localRefs[r.id].pulledAt || ''))) localRefs[r.id] = { ...r, _localProjId: p.id };
        });
      } catch (_) {}
      const _fresh = (it) => {
        const r = localRefs[it.id]; if (!r) return '';
        if (!it.version || !r.version) return `<span style="font-size:10px;color:#888;">받음</span>`;
        return r.version === it.version
          ? `<span style="font-size:10px;color:#3ec46d;" title="내 복사본이 마켓 최신과 동일">✓ 최신</span>`
          : `<span style="font-size:10px;color:#e0b020;" title="마켓에 더 새 버전 있음(다시 받기)">⬇ 업데이트</span>`;
      };
      // 계정별 그룹
      const byAcc = {};
      items.forEach(it => { (byAcc[it.account] = byAcc[it.account] || []).push(it); });
      listEl.innerHTML = Object.keys(byAcc).sort().map(acc => `
        <div class="market-acc" style="margin-bottom:10px;">
          <div style="font-size:12px;font-weight:600;color:#aaa;margin-bottom:4px;">👤 ${_esc(acc)}</div>
          ${byAcc[acc].map(it => `
            <div class="market-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:5px;margin-bottom:4px;">
              <span style="flex:1;font-size:12px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(it.name)}</span>
              ${_fresh(it)}
              <span style="font-size:10px;color:#666;">${_esc((it.updatedAt || '').slice(0, 10))}</span>
              <button class="settings-btn settings-btn-secondary market-pull-btn" data-acc="${_esc(it.account)}" data-id="${_esc(it.id)}" data-name="${_esc(it.name)}" style="height:26px;font-size:11px;">받기</button>
              ${(localRefs[it.id] && it.version && localRefs[it.id].version && localRefs[it.id].version !== it.version) ? `<button class="settings-btn settings-btn-secondary market-merge-btn" data-acc="${_esc(it.account)}" data-id="${_esc(it.id)}" data-name="${_esc(it.name)}" data-local="${_esc(localRefs[it.id]._localProjId)}" style="height:26px;font-size:11px;" title="로컬 복사본과 섹션 머지">🔀머지</button>` : ''}
            </div>`).join('')}
        </div>`).join('');
      listEl.querySelectorAll('.market-pull-btn').forEach(b => {
        b.addEventListener('click', async () => {
          if (b.disabled) return;
          b.disabled = true;   // 두 번 누르면 받은본이 둘 생겼다(S3 market4, 머지 적용 단추와 같은 꼴)
          try { await pullProject(b.dataset.acc, b.dataset.id, b.dataset.name); } finally { b.disabled = false; }
        });
      });
      listEl.querySelectorAll('.market-merge-btn').forEach(b => {
        b.addEventListener('click', async () => {
          if (b.disabled || document.querySelector('.market-resolve-modal')) return;   // 두 번 누르면 모달이 둘 떴다(S3 scratch)
          b.disabled = true;
          try { await openResolveModal(b.dataset.acc, b.dataset.id, b.dataset.name, b.dataset.local); } finally { b.disabled = false; }
        });
      });
    }
    loadList();
  }

  window.renderMarketPane = renderMarketPane;
  window.marketPushCurrent = pushCurrent;
})();
