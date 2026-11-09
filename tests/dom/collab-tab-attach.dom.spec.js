/* collab-tab-attach — COLLAB-SYNC-OLD-GAPS-01 ⑷: 협업 프로젝트로 탭을 옮겨 오면 동기화가 붙는다 · 보통 프로젝트로 가면 떨어진다 · 읽는 중엔 첫 재개를 미룬다(_resumeOwed)
 *   하니스 = switchtab-first-load-race-360 꼴(첫 로드를 시험이 푼다) + 가짜 collab(ref 는 proj_tb 만 연결).
 *   T1 A(보통) → B(협업, 첫 로드 붙잡힘): 붙는다(isActive · projectId B) · 읽는 중엔 재개 pull(wantSections) 0 · 저장 사건 push 0 · 로드 풀고 tick → 재개 1 · 다시 A 로 → 떨어진다
 *   T2 빠르게 B → A: 늦게 끝난 B 의 start 가 _cfg 를 B 로 세우지 않는다(A = 보통 → 비활성)
 * 양성대조: tab-system.js 의 autoStart 한 줄을 빼면 T1 빨강(B 로 와도 비활성) · sync.js 의 start 세대 검사를 빼면 T2 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B] = ['proj_ta', 'proj_tb'];
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));

async function setup(page) {
  await bootApp(page);
  await page.evaluate(([A, B]) => {
    const project = (id) => ({ ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}"><div class="section-inner"><div class="tb">${id}</div></div></div>` }] });
    const files = new Map([A, B].map(id => [id, project(id)]));
    window.__pending = {}; window.__ops = {}; window.__pulls = []; window.__pushes = []; window.__refHold = null;
    const fake = {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => { files.set(p.id, JSON.parse(JSON.stringify(p))); return { ok: true }; },
      saveProjectSync: () => ({ ok: true }),
      collab: {
        ref: async ({ projectId }) => { if (window.__refHold && window.__refHold.id === projectId) await window.__refHold.p; return projectId === B ? { ok: true, ref: { collabId: 'cb_tab', seq: 5, role: 'member' } } : { ok: true, ref: null }; },
        pull: async (q) => { window.__pulls.push({ want: !!q.wantSections }); return { ok: true, seq: 5, serverSeq: 5, patches: [], presence: [], sections: [] }; },
        push: async (q) => { window.__pushes.push(q.patches[0].sectionId); return { ok: true, seq: 6, accepted: [{ sectionId: q.patches[0].sectionId, seq: 6 }], conflicts: [] }; },
        seq: async () => ({ ok: true }), invites: async () => ({ ok: true, invites: [], projects: [] }),
      },
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
    window.loadProjectForOpen = (id) => new Promise((res, rej) => { window.__pending[id] = { done: () => res(JSON.parse(JSON.stringify(files.get(id)))), fail: () => rej(new Error('x')) }; });
    window.openTabs = [{ id: A, name: A, _cache: JSON.stringify(files.get(A)) }, { id: B, name: B }];
    window.activeProjectId = A; history.replaceState(null, '', '?project=' + A);
    window.applyProjectData(JSON.parse(JSON.stringify(files.get(A))));
    window.COLLAB_ENABLED = true;
  }, [A, B]);
  await settle(page);
}
const go = (page, id) => page.evaluate((id) => { window.__ops[id] = window.switchTab(id).catch(e => { window.__swErr = String(e); }); }, id);
const st = (page) => page.evaluate(() => ({ active: window.collabSync.isActive(), pid: window.collabSync.status().projectId || null }));

test('T1 협업 탭으로 오면 붙고 · 읽는 중엔 재개를 미루고 · 보통 탭으로 가면 떨어진다', async ({ page }) => {
  await setup(page);
  expect((await st(page)).active, '[전제] 보통 프로젝트 A 에선 비활성').toBe(false);
  await go(page, B);
  await page.waitForFunction((B) => !!window.__pending[B], B);
  await expect.poll(() => st(page), { message: '★협업 B 로 왔는데 동기화가 안 붙었다' }).toEqual({ active: true, pid: B });
  const during = await page.evaluate(async (B) => {
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { projectId: B, snap: window.serializeProject() } }));
    await window.collabSync.tick();
    await new Promise(r => setTimeout(r, 200));
    return { resumePulls: window.__pulls.filter(p => p.want).length, pushes: window.__pushes.length };
  }, B);
  expect(during, '읽는 중 = 재개·push 0(_resumeOwed)').toEqual({ resumePulls: 0, pushes: 0 });
  await page.evaluate(async (B) => { const q = window.__pending[B]; delete window.__pending[B]; q.done(); await window.__ops[B]; }, B);
  await settle(page);
  await page.evaluate(async () => { await window.collabSync.tick(); await window.collabSync.tick(); });
  expect(await page.evaluate(() => window.__pulls.filter(p => p.want).length), '로드 뒤 tick 이 재개했다').toBeGreaterThanOrEqual(1);
  await go(page, A); await page.evaluate((A) => window.__ops[A], A);
  await expect.poll(() => st(page), { message: '보통 A 로 가면 떨어진다' }).toEqual({ active: false, pid: null });
});

test('T2 빠르게 B → A — 늦게 끝난 B 의 start 가 앞 프로젝트로 붙지 않는다', async ({ page }) => {
  await setup(page);
  await page.evaluate((B) => { let rel; window.__refHold = { id: B, p: new Promise(r => { rel = r; }) }; window.__refRel = rel; }, B);
  await go(page, B);
  await page.waitForFunction((B) => !!window.__pending[B], B);
  await go(page, A); await page.evaluate((A) => window.__ops[A], A);
  await page.evaluate(() => { window.__refRel(); return new Promise(r => setTimeout(r, 300)); });
  expect(await st(page), '★늦은 B start 가 붙었다').toEqual({ active: false, pid: null });
});
