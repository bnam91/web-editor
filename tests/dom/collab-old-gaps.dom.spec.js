/* collab-old-gaps — COLLAB-SYNC-OLD-GAPS-01 (S3 COLLAB2-204659 옛 칸 값). 하니스 = collab-push-cursor 꼴(가짜 ref/pull/push · 앱·서버 0).
 *   ⑴ C1 미저장 편집 중 상대 패치 → 붙이지 않고 미룸(내 글 그대로) · 미룬 건수 토스트 1번 · 저장하면 서버 충돌 → 충돌 토스트 + 충돌 기록 1 · 내 글 유지
 *      C2 저장이 «실패»한 채 미저장이면 미루지 않는다 — 붙이고 바로 충돌 토스트 · 덮인 내 판은 충돌 기록(replaced)에 남는다
 *      C3 [대조] 미저장 없으면 예전처럼 바로 붙고 토스트 없음
 *   ⑵ C4 올리는 중 두 번째 저장 → 버리지 않고 끝나면 올린다(서버 마지막 글 = A2 · 세 번째 저장 없이)
 * 양성대조: js/collab/sync.js 를 기준판(c1588d839)으로 되돌리면 C1(상대 글이 말없이 덮음)·C2(토스트 0)·C4(서버가 A1 에 머묾) 빨강 · C3 초록. */
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
