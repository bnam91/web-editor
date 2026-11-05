/* COLLAB-RECEIVED-PATCH-LOST-ON-REOPEN-01 — 받은 내용을 디스크에 쓴 뒤에 진도를 올린다.
 * 고치기 전 앱 값(다시 열기): B 디스크에 내용 0 · 진도 2 · 섹션 없음 · 다시 못 받음. 두 앱 값은 회신에 있다.
 * 하네스: bootApp + 가짜 electronAPI.collab·saveProjectToFile. 앱·서버 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await bootApp(page);
  await page.evaluate(() => {
    window.__SEC = (t) => `<div class="section-block" id="secX"><div class="section-inner"><div class="tb">${t}</div></div></div>`;
    document.getElementById('canvas').innerHTML = window.__SEC('BASE');
    const M = window.marketMerge;
    window.__hash = (html) => M.hash(M.normSection(new DOMParser().parseFromString(html, 'text/html').querySelector('.section-block')));
    window.__queue = []; window.__pushes = []; window.__seqCalls = []; window.__saves = []; window.__seq = 5; window.__saveAnswer = async () => ({ ok: true });
    window.electronAPI = Object.assign({}, window.electronAPI, { collab: {
      ref: async () => ({ ok: true, ref: { collabId: 'cb_t', seq: 5, role: 'member' } }),
      pull: async () => { const p = window.__queue; window.__queue = []; return { ok: true, patches: p, seq: window.__seq, presence: [] }; },
      push: async (q) => { window.__seq += 1; window.__pushes.push(q.patches[0].sectionId); return { ok: true, seq: window.__seq, accepted: [{ sectionId: q.patches[0].sectionId, seq: window.__seq }] }; },
      seq: async (p) => { window.__seqCalls.push(p.seq); return { ok: true }; },
      invites: async () => ({ ok: true, invites: [], projects: [] }),
    } });
    window.COLLAB_ENABLED = true;
    window.saveProjectToFile = (snap, o) => { window.__saves.push({ text: snap, o }); return window.__saveAnswer(); };
    window.__recv = (t) => { window.__seq += 1; const html = window.__SEC(t); window.__queue = [{ pageId: window.state.currentPageId, sectionId: 'secX', html, hash: window.__hash(html), actorId: 'aaaa', seq: window.__seq, baseSeq: 5 }]; return window.__seq; };
    window.__I = window.collabSync._internals;
    window.__settle = async () => { await window.__I.settleReceived(); window.__I.flushSeq(); await Promise.resolve(); };
  });
}

test('R1 쓰기가 끝나기 전엔 진도를 안 올리고, 끝나면 올린다 · 저장 글에 받은 내용이 있다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    let done; window.__saveAnswer = () => new Promise(res => { done = res; });
    const seq = window.__recv('받은글');
    await window.collabSync.tick();
    window.__I.flushSeq();
    const during = [...window.__seqCalls];
    const saved = window.__saves.at(-1)?.text.includes('받은글');
    done({ ok: true });
    await window.__settle();
    await window.__settle();
    return { seq, during, saved, after: [...window.__seqCalls], saves: window.__saves.length };
  });
  expect(r.saved, '받은 내용을 저장하지 않았다').toBe(true);
  expect(r.during, '쓰기 전에 진도가 디스크로 갔다').toEqual([]);
  expect(r.after).toEqual([r.seq]);
});

for (const [name, answer] of [['실패', { ok: false, reason: 'qa' }], ['줄 섬(미확정)', undefined], ['안 씀', { ok: true, skipped: true, reason: 'flushed' }]]) {
  test(`R2 저장 ${name} — 진도를 안 올리고 다음 번에 다시 쓴다`, async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (answer) => {
      await window.collabSync.start('proj_x');
      window.__saveAnswer = async () => answer;
      const seq = window.__recv('받은글');
      await window.collabSync.tick();
      await window.__settle();
      const failed = { seqCalls: [...window.__seqCalls], saves: window.__saves.length };
      window.__saveAnswer = async () => ({ ok: true });
      await window.__settle();
      await window.__settle();
      return { seq, failed, after: [...window.__seqCalls], saves: window.__saves.length };
    }, answer === undefined ? null : answer);
    expect(r.failed.seqCalls, '실패했는데 진도가 올랐다').toEqual([]);
    expect(r.failed.saves, '다시 쓰지 않았다').toBeGreaterThanOrEqual(1);
    expect(r.after).toEqual([r.seq]);
  });
}

test('R3 받아서 저장해도 되보내지 않는다 — 다음 저장에도 받은 섹션을 안 올린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    const before = window.__pushes.length;
    let events = 0; const on = () => { events++; }; window.addEventListener('gd:project-saved', on);
    window.__recv('받은글');
    await window.collabSync.tick();
    await window.__settle();
    window.removeEventListener('gd:project-saved', on);
    return { before, pushes: window.__pushes.length, events, saves: window.__saves.length };
  });
  expect(r.saves).toBeGreaterThanOrEqual(1);
  expect(r.pushes, '받은 내용을 되보냈다').toBe(r.before);
  expect(r.events, '받은 저장이 push 사건을 냈다').toBe(0);
});

test('R4 보류한 패치(만지는 중)가 있으면 그 앞까지만 올리고, 붙인 뒤에 마저 올린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    document.querySelector('#secX .tb').classList.add('selected');
    const seq = window.__recv('보류글');
    await window.collabSync.tick();
    await window.__settle();
    const during = { text: document.querySelector('#secX').textContent, calls: [...window.__seqCalls], saves: window.__saves.length };
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    await window.collabSync.tick();
    await window.__settle();
    await window.__settle();
    return { seq, during, text: document.querySelector('#secX').textContent, calls: [...window.__seqCalls], savedText: window.__saves.at(-1)?.text.includes('보류글') };
  });
  expect(r.during.text, '★전제: 보류됐다').toBe('BASE');
  expect(r.during.calls.filter(n => n >= r.seq), '안 붙인 패치를 넘어 진도가 올랐다').toEqual([]);
  expect(r.text).toBe('보류글');
  expect(r.savedText).toBe(true);
  expect(r.calls.at(-1)).toBe(r.seq);
});

test('R5 프로젝트를 읽는 중엔 받은 것을 안 붙이고 안 쓴다 — 확정 뒤에 받는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const real = window.gdtProjectReady.get;
    window.gdtProjectReady.get = () => ({ ...real(), phase: 'loading', projectId: 'proj_x' });
    /* 진짜 서버처럼 목차를 준다 — 없으면 재개 push 가 먼저 나가 이 패치가 «묵은 패치»로 갈린다 */
    const local = window.__I.collectSections(JSON.parse(window.serializeProject()))[0];
    const pull = window.electronAPI.collab.pull;
    window.electronAPI.collab.pull = async (q) => ({ ...(await pull(q)), sections: [{ pageId: local.pageId, sectionId: local.sectionId, hash: local.hash }] });
    window.__recv('읽는중글');
    await window.collabSync.start('proj_x');
    await window.collabSync.tick();
    const during = { text: document.querySelector('#secX').textContent, saves: window.__saves.length, queue: window.__queue.length };
    window.gdtProjectReady.get = real;
    await window.collabSync.tick();
    await window.__settle();
    return { during, text: document.querySelector('#secX').textContent, saves: window.__saves.length };
  });
  expect(r.during).toEqual({ text: 'BASE', saves: 0, queue: 1 });
  expect(r.text).toBe('읽는중글');
  expect(r.saves).toBeGreaterThanOrEqual(1);
});
