/* COLLAB-PUSH-SEQ-SKIPS-UNPULLED-PATCH-01 — 내 push 뒤에도 안 받은 상대 패치를 빠짐없이 받고, 내 패치를 다시 받지 않는다.
 * 고치기 전 앱 값: 상대 패치 seq 2 → 내 push 답 seq 3 → 커서 3 → 상대 섹션 영영 없음(2/2 · 고친 줄 둘 위에서도 3/3).
 * 가짜 서버는 진짜 서버(api/_lib/collab-handlers/pull.js)처럼 sinceSeq 뒤·내 actorId 뺀 패치만 준다. 앱·서버 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page, { noExclude = false } = {}) {
  await bootApp(page);
  await page.evaluate((noExclude) => {
    const sec = (id, t) => `<div class="section-block" id="${id}"><div class="section-inner"><div class="tb">${t}</div></div></div>`;
    window.__sec = sec;
    document.getElementById('canvas').innerHTML = sec('secA', 'A0');
    const M = window.marketMerge;
    window.__hash = (html) => M.hash(M.normSection(new DOMParser().parseFromString(html, 'text/html').querySelector('.section-block')));
    window.__log = []; window.__pulls = []; window.__server = 5; window.__applied = 0;
    window.addEventListener('gd:collab-remote-applied', () => { window.__applied++; });
    window.saveProjectToFile = async () => ({ ok: true });
    window.__other = (id, t) => { const html = sec(id, t); const seq = ++window.__server; window.__log.push({ pageId: window.state.currentPageId, sectionId: id, html, hash: window.__hash(html), actorId: 'other', seq, baseSeq: 5 }); return seq; };
    window.electronAPI = Object.assign({}, window.electronAPI, { collab: {
      ref: async () => ({ ok: true, ref: { collabId: 'cb_t', seq: 5, role: 'member' } }),
      pull: async (q) => {
        window.__pulls.push(q.sinceSeq);
        const patches = window.__log.filter(p => p.seq > q.sinceSeq && (noExclude || p.actorId !== q.actorId));
        return { ok: true, seq: window.__server, serverSeq: window.__server, patches, presence: [] };
      },
      push: async (q) => {
        const p = q.patches[0]; const seq = ++window.__server;
        window.__log.push({ ...p, actorId: q.patches[0].actorId, seq });
        return { ok: true, seq, accepted: [{ sectionId: p.sectionId, seq, conflict: false }], conflicts: [] };
      },
      seq: async () => ({ ok: true }), invites: async () => ({ ok: true, invites: [], projects: [] }),
    } });
    window.COLLAB_ENABLED = true;
    window.__save = () => new Promise((res) => {
      const off = window.collabSync.onEvent((e) => { if (e.type === 'pushed') { off(); res(); } });
      window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } }));
    });
    window.__edit = (id, t) => { document.querySelector(`#${id} .tb`).textContent = t; };
    window.__count = (id) => document.querySelectorAll(`[id="${id}"]`).length;
  }, noExclude);
}

test('S1 상대가 먼저 올린 패치를 내 push 뒤에도 받는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    const cursor = window.collabSync.status().seq;
    window.__other('secB', '상대글');
    window.__edit('secA', 'A1');
    await window.__save();
    const afterPush = window.collabSync.status().seq;
    await window.collabSync.tick();
    return { cursor, afterPush, got: document.getElementById('secB')?.textContent, lastPull: window.__pulls.at(-1), status: window.collabSync.status().seq, server: window.__server };
  });
  expect(r.afterPush, 'push 답이 커서를 넘겼다').toBe(r.cursor);
  expect(r.lastPull).toBe(r.cursor);
  expect(r.got, '안 받은 상대 패치를 놓쳤다').toBe('상대글');
  expect(r.status, 'pull 뒤엔 서버까지 온다').toBe(r.server);
});

test('S2 내 패치를 내가 다시 받지 않는다 — 두 번 안 붙고 섹션이 안 겹치고 충돌이 안 생긴다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    const applied0 = window.__applied;
    for (const t of ['A1', 'A2', 'A3']) { window.__edit('secA', t); await window.__save(); }
    await window.collabSync.tick();
    await window.collabSync.tick();
    return { applied: window.__applied - applied0, count: window.__count('secA'), text: document.querySelector('#secA .tb').textContent, conflicts: window.collabSync.conflicts().length, pushes: window.__log.filter(p => p.actorId !== 'other').length };
  });
  expect(r.pushes, '★전제: 세 번 올렸다').toBeGreaterThanOrEqual(3);
  expect(r).toMatchObject({ applied: 0, count: 1, text: 'A3', conflicts: 0 });
});

test('S2 양성 대조 — 서버가 내 패치를 빼지 않으면 위 자가 잡는다', async ({ page }) => {
  await boot(page, { noExclude: true });
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    const applied0 = window.__applied;
    for (const t of ['A1', 'A2']) { window.__edit('secA', t); await window.__save(); }
    await window.collabSync.tick();
    return { seen: window.__applied - applied0 + window.collabSync.conflicts().length };
  });
  expect(r.seen, '내 패치를 다시 받았는데 자가 못 봤다').toBeGreaterThan(0);
});

test('S3 커서가 뒤에 있어도 baseSeq 는 내가 본 데까지다 — 안 받은 상대 패치와 같은 섹션이면 충돌로 남는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const c = window.electronAPI.collab; const push = c.push; const bases = [];
    c.push = (q) => { bases.push(q.patches[0].baseSeq); return push(q); };
    await window.collabSync.start('proj_x');
    const cursor = window.collabSync.status().seq;
    bases.length = 0;
    window.__edit('secA', 'A1');
    await window.__save();
    window.__edit('secA', 'A2');
    await window.__save();
    return { cursor, bases };
  });
  expect(r.bases).toEqual([r.cursor, r.cursor]);
});
