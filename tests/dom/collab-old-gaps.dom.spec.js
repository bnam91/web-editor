/* collab-old-gaps — COLLAB-SYNC-OLD-GAPS-01 (S3 COLLAB2-204659 옛 칸 값). 하니스 = collab-push-cursor 꼴(가짜 ref/pull/push · 앱·서버 0).
 *   ⑴ C1 미저장 편집 중 상대 패치 → 붙이지 않고 미룸(내 글 그대로) · 미룬 건수 토스트 1번 · 저장하면 서버 충돌 → 충돌 토스트 + 충돌 기록 1 · 내 글 유지
 *      C2 저장이 «실패»한 채 미저장이면 미루지 않는다 — 붙이고 바로 충돌 토스트 · 덮인 내 판은 충돌 기록(replaced)에 남는다
 *      C3 [대조] 미저장 없으면 예전처럼 바로 붙고 토스트 없음
 *   ⑵ C4 올리는 중 두 번째 저장 → 버리지 않고 끝나면 올린다(서버 마지막 글 = A2 · 세 번째 저장 없이)
 *   ⑶ C5 읽는 중(gdtProjectReady loading) 저장 → push 0 · ready 뒤 tick 재개 → 진짜 차이 1 섹션만 · C6 첫 재개 실패 뒤 저장 → push 0 · 다음 tick 재개 → 차이만
 *   ⑸ C9 상대 번호(data-section=1)가 실린 secB 패치 → 붙인 뒤 저장해도 secB 를 다시 안 올린다(내 번호 2 유지)
 *   리뷰 1: C10 F1 재개가 묵은 패치(서버 지금 판 = 내 것)를 안 붙인다 · C11 F2 재개 받는 사이 다른 start → 앞 방 패치 안 붙음 · C12 F4 미저장 표시만 풀리고 push 전이면 미룬 패치를 안 푼다
 *          C13 F5 밀려난 start 는 'switched' · C14 F6 같은 프로젝트 다시 start 해도 충돌 기록이 남는다(양성대조: ⑸ 판 6921c9685 → C10~C14 빨강)
 * 양성대조: js/collab/sync.js 를 기준판(c1588d839)으로 되돌리면 C9(secB 되올림)· C1(상대 글이 말없이 덮음)·C2(토스트 0)·C4(서버가 A1 에 머묾)·C5·C6(모든 섹션 올림) 빨강 · C3 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await bootApp(page);
  await page.evaluate(() => {
    const sec = (id, t) => `<div class="section-block" id="${id}"><div class="section-inner"><div class="tb">${t}</div></div></div>`;
    document.getElementById('canvas').innerHTML = sec('secA', 'A0');
    const M = window.marketMerge;
    window.__hash = (html) => M.hash(M.normSection(new DOMParser().parseFromString(html, 'text/html').querySelector('.section-block')));
    window.__log = []; window.__server = 5; window.__toasts = []; window.__unsaved = false; window.__failed = false;
    const o = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); try { o?.(m); } catch (_) {} };
    window.hasUnsavedChanges = () => window.__unsaved;
    window.projectLastSaveFailed = () => window.__failed;
    window.saveProjectToFile = async () => ({ ok: true });
    window.__other = (id, t) => { const html = sec(id, t); const seq = ++window.__server; window.__log.push({ pageId: window.state.currentPageId, sectionId: id, html, hash: window.__hash(html), actorId: 'other', seq, baseSeq: 5 }); return seq; };
    window.electronAPI = Object.assign({}, window.electronAPI, { collab: {
      ref: async () => ({ ok: true, ref: { collabId: 'cb_t', seq: 5, role: 'member' } }),
      pull: async (q) => ({ ok: true, seq: window.__server, serverSeq: window.__server, patches: window.__log.filter(p => p.seq > q.sinceSeq && p.actorId !== q.actorId), presence: [] }),
      push: async (q) => {   // 진짜 서버처럼: 그 섹션의 마지막 seq 보다 baseSeq 가 앞이면 keep-both 충돌
        const p = q.patches[0]; const last = Math.max(0, ...window.__log.filter(x => x.sectionId === p.sectionId).map(x => x.seq));
        const seq = ++window.__server; const conflict = p.baseSeq < last;
        window.__log.push({ ...p, seq });
        return { ok: true, seq, accepted: [{ sectionId: p.sectionId, seq, conflict }], conflicts: conflict ? [{ sectionId: p.sectionId, otherActor: 'other' }] : [] };
      },
      seq: async () => ({ ok: true }), invites: async () => ({ ok: true, invites: [], projects: [] }),
    } });
    window.COLLAB_ENABLED = true;
    window.__save = () => new Promise((res) => {
      const off = window.collabSync.onEvent((e) => { if (e.type === 'pushed') { off(); res(); } });
      window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } }));
    });
    window.__edit = (id, t) => { document.querySelector(`#${id} .tb`).textContent = t; };
    window.__text = (id) => document.querySelector(`#${id} .tb`)?.textContent;
  });
}
const held = (ts) => ts.filter(t => /저장 뒤에 받습니다/.test(t)).length;
const conflictToasts = (ts) => ts.filter(t => /같은 섹션을 동시에 고쳤습니다/.test(t)).length;

test('C1 미저장 편집 중 상대 패치 → 미룸 · 건수 토스트 1번 · 저장하면 충돌로 알리고 내 글 유지', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    window.__unsaved = true; window.__edit('secA', '내글');
    window.__other('secA', '상대글');
    await window.collabSync.tick(); await window.collabSync.tick(); await window.collabSync.tick();
    const during = { text: window.__text('secA'), deferred: window.collabSync.status().deferred, toasts: [...window.__toasts] };
    window.__unsaved = false;
    await window.__save();
    await window.collabSync.tick();
    return { during, after: { text: window.__text('secA'), conflicts: window.collabSync.conflicts().length, toasts: [...window.__toasts] } };
  });
  expect(r.during.text, '★미저장 내 글이 상대 패치에 말없이 덮였다').toBe('내글');
  expect(r.during.deferred).toBe(1);
  expect(held(r.during.toasts), '미룬 건수 토스트 1번(틱 셋에도)').toBe(1);
  expect(conflictToasts(r.after.toasts), '★저장 뒤 충돌 토스트가 없다').toBeGreaterThanOrEqual(1);
  expect(r.after.text, '내 글 유지').toBe('내글');
  expect(r.after.conflicts, '상대 판은 충돌 기록에').toBeGreaterThanOrEqual(1);
});

test('C2 저장 실패 중 미저장 → 미루지 않고 붙이며 바로 충돌 토스트 · 내 판은 충돌 기록(replaced)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    window.__unsaved = true; window.__failed = true; window.__edit('secA', '내글');
    window.__other('secA', '상대글');
    await window.collabSync.tick();
    const c = window.collabSync.conflicts();
    return { text: window.__text('secA'), deferred: window.collabSync.status().deferred, toasts: [...window.__toasts], mine: c.map(x => x.mineHtml || '').join('|') };
  });
  expect(r.deferred, '실패 중엔 쥐고 있지 않는다').toBe(0);
  expect(r.text).toBe('상대글');
  expect(conflictToasts(r.toasts), '★조용히 덮였다(토스트 0)').toBe(1);
  expect(r.mine, '★덮인 내 판이 충돌 기록에 없다').toContain('내글');
});

test('C3 [대조] 미저장 없으면 바로 붙고 토스트 없음', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    window.__other('secA', '상대글');
    await window.collabSync.tick();
    return { text: window.__text('secA'), toasts: [...window.__toasts], deferred: window.collabSync.status().deferred };
  });
  expect({ text: r.text, deferred: r.deferred, conflict: conflictToasts(r.toasts), held: held(r.toasts) }).toEqual({ text: '상대글', deferred: 0, conflict: 0, held: 0 });   // 다른 안내 토스트(연결 등)는 이 칸의 뜻이 아니다
});

test('C4 올리는 중 두 번째 저장 — 버리지 않고 끝나면 올린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    const push = window.electronAPI.collab.push; let rel; let held = 0;
    window.electronAPI.collab.push = async (q) => { if (!held++) await new Promise((res) => { rel = res; }); return push(q); };
    window.__edit('secA', 'A1');
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } }));
    await new Promise((res) => { const iv = setInterval(() => { if (rel) { clearInterval(iv); res(); } }, 10); });   // 첫 push 가 붙잡혔다(올리는 중)
    window.__edit('secA', 'A2');
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } }));   // 올리는 중 두 번째 저장
    const pendingWhileHeld = held;
    rel();
    await new Promise((res) => { const t0 = Date.now(); const iv = setInterval(() => { const mine = window.__log.filter(p => p.actorId !== 'other' && p.sectionId === 'secA'); if (mine.length >= 2 || Date.now() - t0 > 3000) { clearInterval(iv); res(); } }, 20); });
    const mine = window.__log.filter(p => p.actorId !== 'other' && p.sectionId === 'secA');
    return { pendingWhileHeld, n: mine.length, last: mine.at(-1)?.html || '' };
  });
  expect(r.pendingWhileHeld, '[전제] 두 번째 저장 때 push 는 하나만 붙잡혀 있었다').toBe(1);
  expect(r.last, '★두 번째 저장이 버려져 서버가 A1 에 머묾').toContain('A2');
  expect(r.n, JSON.stringify(r)).toBeGreaterThanOrEqual(2);   // 자동저장 사건이 하나 더 올 수 있다 — 뜻은 «버리지 않음»
});

/* 세 섹션 · 서버는 secA·secB 를 지금 판 그대로 안다(secC 만 내가 바꿈) */
async function threeSecs(page) {
  await page.evaluate(() => {
    const sec = (id, t) => `<div class="section-block" id="${id}"><div class="section-inner"><div class="tb">${t}</div></div></div>`;
    document.getElementById('canvas').innerHTML = sec('secA', 'A0') + sec('secB', 'B0') + sec('secC', 'C0');
    const pid = window.state.currentPageId;
    const snap = JSON.parse(window.serializeProject());
    const html = (id) => { const d = new DOMParser().parseFromString(`<div>${(snap.pages.find(p => p.id === pid) || snap.pages[0]).canvas}</div>`, 'text/html'); return d.getElementById(id).outerHTML; };
    window.__srvSecs = ['secA', 'secB'].map(id => ({ pageId: pid, sectionId: id, hash: window.__hash(html(id)) }));
    window.__edit('secC', 'C1');
    const pull = window.electronAPI.collab.pull;
    window.__pullFail = 0;
    window.electronAPI.collab.pull = async (q) => { if (window.__pullFail > 0) { window.__pullFail--; return { ok: false, reason: 'offline' }; } const r = await pull(q); return { ...r, sections: window.__srvSecs }; };
  });
}
const myPushes = (page) => page.evaluate(() => window.__log.filter(p => p.actorId !== 'other').map(p => p.sectionId));
const saveEvt = (page) => page.evaluate(() => { window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } })); return new Promise(r => setTimeout(r, 300)); });

test('C5 읽는 중 저장은 안 올린다 — ready 뒤 재개가 진짜 차이(secC)만 올린다', async ({ page }) => {
  await boot(page); await threeSecs(page);
  await page.evaluate(() => { window.__phase = 'loading'; window.gdtProjectReady = { get: () => ({ urlProject: 'proj_x', projectId: window.__phase === 'ready' ? 'proj_x' : null, phase: window.__phase }) }; });
  await page.evaluate(() => window.collabSync.start('proj_x'));
  await saveEvt(page);
  expect(await myPushes(page), '★읽는 중 자동저장이 섹션을 올렸다').toEqual([]);
  await page.evaluate(async () => { window.__phase = 'ready'; await window.collabSync.tick(); await new Promise(r => setTimeout(r, 200)); });
  expect(await myPushes(page), '재개는 진짜 차이만').toEqual(['secC']);
});
test('C6 첫 재개 실패 뒤 저장은 안 올린다 — 다음 tick 재개가 차이만 올린다', async ({ page }) => {
  await boot(page); await threeSecs(page);
  const st = await page.evaluate(async () => { window.__pullFail = 1; return window.collabSync.start('proj_x'); });
  expect(st.ok, '[전제] 첫 재개 실패').toBe(false);
  await saveEvt(page);
  expect(await myPushes(page), '★재개 전 저장이 모든 섹션을 올렸다').toEqual([]);
  await page.evaluate(async () => { await window.collabSync.tick(); await new Promise(r => setTimeout(r, 200)); });
  expect(await myPushes(page), '재개 재시도는 차이만').toEqual(['secC']);
});

test('C9 상대 자리 번호가 실린 패치 — 붙인 뒤 저장해도 그 섹션을 다시 안 올린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const sec = (id, n, t) => `<div class="section-block" id="${id}" data-section="${n}"><div class="section-inner"><div class="tb">${t}</div></div></div>`;
    document.getElementById('canvas').innerHTML = sec('secA', 1, 'A0') + sec('secB', 2, 'B0');
    window.rebindAll?.({ preserveHistory: true }); window.buildLayerPanel?.();   // 묶인 꼴(히트존 등)로 시작 — 받은 섹션도 그 꼴이다
    await window.collabSync.start('proj_x');
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } })); await new Promise(r => setTimeout(r, 300));   // 시작 판을 서버가 안다(_sent) — 바뀐 게 없으면 pushed 가 안 난다
    const before = window.__log.filter(p => p.actorId !== 'other').length;
    const pg = JSON.parse(window.serializeProject()).pages.find(x => x.id === window.state.currentPageId);
    const cur = new DOMParser().parseFromString(`<div>${pg.canvas}</div>`, 'text/html').getElementById('secB');
    cur.querySelector('.tb').textContent = 'B1'; cur.setAttribute('data-section', '1');   // 상대 화면에선 secB 가 첫째 · 글만 바뀜
    const html = cur.outerHTML;
    window.__log.push({ pageId: window.state.currentPageId, sectionId: 'secB', html, hash: window.__hash(html), actorId: 'other', seq: ++window.__server, baseSeq: 5 });
    await window.collabSync.tick();
    window.buildLayerPanel?.();
    const num = document.getElementById('secB').getAttribute('data-section');
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } }));
    await new Promise(r => setTimeout(r, 400));
    return { num, text: window.__text('secB'), re: window.__log.filter(p => p.actorId !== 'other').slice(before).map(p => p.sectionId) };
  });
  expect(r.text, '[전제] 상대 글이 붙었다').toBe('B1');
  expect(r.num, '내 자리 번호').toBe('2');
  expect(r.re, '★받은 섹션을 번호 차이로 다시 올렸다').toEqual([]);
});

/* 서버 목차(sections)를 로그의 섹션별 마지막 판으로 — 재개(wantSections)가 받는 꼴 */
async function withSections(page) {
  await page.evaluate(() => {
    const pull = window.electronAPI.collab.pull;
    window.electronAPI.collab.pull = async (q) => {
      const r = await pull(q);
      if (!q.wantSections) return r;
      const last = new Map(); for (const p of window.__log) last.set(p.sectionId, p);
      return { ...r, sections: [...last.values()].map(p => ({ pageId: p.pageId, sectionId: p.sectionId, hash: p.hash })) };
    };
  });
}
test('C10 F1 — 재개가 «서버 지금 판 = 내 것»인 섹션의 묵은 패치를 안 붙인다', async ({ page }) => {
  await boot(page); await withSections(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    window.__other('secA', '상대글');
    await window.collabSync.tick();
    const applied = window.__text('secA');
    window.__edit('secA', '내글'); await window.__save();          // 그 위에 고쳐 올림(서버 지금 판 = 내 것)
    window.collabSync.stop(); await window.collabSync.start('proj_x');   // ⑷ 탭 재시작·재기동 — ref.seq 5(진도 저장 전) → 상대 패치가 다시 온다
    return { applied, after: window.__text('secA') };
  });
  expect(r.applied, '[전제] 처음엔 상대 글이 붙었다').toBe('상대글');
  expect(r.after, '★묵은 상대 패치가 내 글을 덮었다(서버엔 내 글)').toBe('내글');
});
test('C11 F2 — 재개 받는 사이 다른 start 가 오면 앞 방 패치를 안 붙인다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__other('secA', '앞방글');
    const pull = window.electronAPI.collab.pull; let rel; let first = true;
    window.electronAPI.collab.pull = async (q) => { if (first) { first = false; await new Promise(res => { rel = res; }); } return pull(q); };
    const ref = window.electronAPI.collab.ref;
    window.electronAPI.collab.ref = async ({ projectId }) => projectId === 'proj_y' ? { ok: true, ref: null } : ref({ projectId });
    const a = window.collabSync.start('proj_x').catch(e => ({ ok: false, reason: 'threw:' + e.message }));
    await new Promise(res => { const iv = setInterval(() => { if (rel) { clearInterval(iv); res(); } }, 10); });
    await window.collabSync.start('proj_y');   // 보통 프로젝트로 — 앞 동기화 멈춤
    rel(); const ra = await a;
    return { text: window.__text('secA'), ra, active: window.collabSync.isActive() };
  });
  expect(r.text, '★다른 방으로 옮긴 뒤 앞 방 패치가 붙었다').toBe('A0');
  expect(r.active).toBe(false);
});
test('C12 F4 — 미저장 표시만 풀리고 내 push 전이면 미룬 패치를 안 푼다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    window.__unsaved = true; window.__edit('secA', '내글');
    window.__other('secA', '상대글');
    await window.collabSync.tick();
    window.__unsaved = false;                  // 저장이 표시를 지웠다 · gd:project-saved 는 아직
    await window.collabSync.tick();
    const gap = window.__text('secA');
    await window.__save(); await window.collabSync.tick();
    return { gap, after: window.__text('secA'), conflicts: window.collabSync.conflicts().length };
  });
  expect(r.gap, '★저장 표시가 풀린 틈에 미룬 패치가 내 글을 덮었다').toBe('내글');
  expect(r.after).toBe('내글');
  expect(r.conflicts).toBeGreaterThanOrEqual(1);
});
test('C13 F5 — 밀려난 start 는 switched 로 물러난다(타이머를 안 건다)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const pull = window.electronAPI.collab.pull; let rel; let first = true;
    window.electronAPI.collab.pull = async (q) => { if (first) { first = false; await new Promise(res => { rel = res; }); } return pull(q); };
    const a = window.collabSync.start('proj_x');
    await new Promise(res => { const iv = setInterval(() => { if (rel) { clearInterval(iv); res(); } }, 10); });
    const b = await window.collabSync.start('proj_x');
    rel(); const ra = await a;
    return { ra, b };
  });
  expect(r.b.ok, '[전제] 뒤 start 는 붙었다').toBe(true);
  expect(r.ra.reason, '★밀려난 start 가 끝까지 가 타이머를 걸었다').toBe('switched');
});
test('C14 F6 — 같은 프로젝트를 다시 start 해도 충돌 기록(진 쪽 판)이 남는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    window.__unsaved = true; window.__failed = true; window.__edit('secA', '내글');
    window.__other('secA', '상대글'); await window.collabSync.tick();
    const n0 = window.collabSync.conflicts().length;
    window.collabSync.stop(); window.__unsaved = false; window.__failed = false;
    window.electronAPI.collab.ref = async () => ({ ok: true, ref: { collabId: 'cb_t', seq: window.__server, role: 'member' } });   // 진도 저장됨 = 다시 안 받는다(새 충돌이 안 생긴다)
    await window.collabSync.start('proj_x');
    const c = window.collabSync.conflicts();
    return { n0, n1: c.length, mine: c.map(x => x.mineHtml || '').join('|') };
  });
  expect(r.n0, '[전제] 충돌 기록 1').toBeGreaterThanOrEqual(1);
  expect(r.n1, '★탭 재시작에 충돌 기록이 사라졌다').toBe(r.n0);
  expect(r.mine, '진 쪽(내) 판이 남았다').toContain('내글');
});
