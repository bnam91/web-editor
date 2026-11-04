/* market-no-overwrite — 마켓 받기·머지가 로컬 프로젝트를 안 덮는다. gh·네트워크 없음: electronAPI 를 페이지에서 대역으로 둔다, 클릭은 진짜 마우스.
 * 자: saveProject 에 넘어간 객체의 id·name · 내용. 앱 값은 격리 앱에서 쟀다(회신 S3-market). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const LOCAL = 'proj_1000000000001'; const M = 'mk_M';
const sec = (t) => `<div class="section-block" id="sec_a" data-section="1"><div class="section-inner"><div class="text-block" id="t_a"><div class="tb-body">${t}</div></div></div></div>`;
const data = (t, extra = {}) => ({ version: 2, currentPageId: 'p1', pages: [{ id: 'p1', name: 'p', canvas: sec(t) }], checklistItems: [], checklistSections: [], imageGallery: [], assetsTree: [], ...extra });

async function open(page, remote, remoteScratch = [], localCanvas = null) {
  await bootApp(page);
  await page.evaluate(async ({ LOCAL, M, local, remote, remoteScratch }) => {
    window.__saved = [];
    const api = window.electronAPI || {};
    const fake = { ...api,
      saveProject: async (p) => { window.__saved.push(JSON.parse(JSON.stringify(p))); return { ok: true }; },
      duplicateProject: async (a) => { window.__dup = { src: a.sourceProjectId, newName: a.newName }; const p = JSON.parse(JSON.stringify(a.sourceData)); p.id = 'proj_2000000000002'; p.name = a.newName; window.__saved.push(p); return { ok: true, newProjectId: p.id, newName: a.newName }; },
      loadProject: async (id) => (id === LOCAL ? JSON.parse(JSON.stringify(local)) : null),
      listProjects: async () => [{ id: LOCAL, name: local.name, marketRef: local.marketRef }],
      assetsReadAsDataUri: async ({ projectId }) => { if (projectId === 'proj_throw') throw new Error('일시'); if (projectId === 'proj_eio') return { ok: false, error: 'EIO' }; return projectId === 'proj_missing' ? { ok: false, error: 'not found' } : { ok: true, dataUri: 'data:image/png;base64,A' }; },
      market: { auth: async () => ({ ok: true }), list: async () => ({ ok: true, items: [{ account: 'acc', id: M, name: '원격 이름', version: 'v2', updatedAt: '2026-02-02' }] }), pull: async () => ({ ok: true, project: { id: M, name: '원격 이름', account: 'acc', version: 'v2', updatedAt: '2026-02-02', data: JSON.stringify(remote), scratch: JSON.stringify(remoteScratch) } }), push: async () => ({ ok: false }) } };
    Object.defineProperty(window, 'electronAPI', { value: fake, configurable: true, writable: true });
    const d = document.createElement('div'); d.id = 'mk-pane'; d.style.cssText = 'position:fixed;left:400px;top:100px;width:700px;height:500px;background:#111;z-index:99998;overflow:auto'; document.body.appendChild(d);
    window.renderMarketPane(d);
  }, { LOCAL, M, remote, remoteScratch, local: { id: LOCAL, name: '내 복사본', createdAt: '2020-01-02', ...data('내 글'), ...(localCanvas ? { pages: [{ id: 'p1', name: 'p', canvas: localCanvas }] } : {}), marketRef: { account: 'acc', id: M, version: 'v1', pulledAt: '2026-01-01' } } });
}
const saved = async (page) => { await expect.poll(() => page.evaluate(() => window.__saved.length)).toBe(1); return page.evaluate(() => window.__saved[0]); };
const body = (p) => p.pages[0].canvas;

test('받기: 받은 data 에 로컬 id·name 이 들어 있어도 새 id 로 저장한다', async ({ page }) => {
  await open(page, data('원격 글', { id: LOCAL, name: '원격이 심은 이름' }));
  await page.locator('.market-pull-btn').first().click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(p.id).toMatch(/^proj_\d+$/); expect(p.name).toBe('원격 이름 (받음)'); expect(body(p)).toContain('원격 글');
});
test('음성 받기: 올리는 꼴 그대로면 새 프로젝트, marketRef 박힘', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.locator('.market-pull-btn').first().click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(p.name).toBe('원격 이름 (받음)'); expect(p.marketRef.version).toBe('v2'); expect(p.pages.length).toBe(1);
});
test('머지 기본(내것): 내 복사본 id 로 저장하지 않는다', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(p.name).toBe('원격 이름 (머지)'); expect(body(p)).toContain('내 글'); expect(p.marketRef.version).toBe('v2');
  expect(await page.evaluate(() => window.__dup), '복제 길, 기준은 L').toEqual({ src: LOCAL, newName: '원격 이름 (머지)' });
});
test('머지 원격 고름: 새 프로젝트에 원격 글이 들어가고 내 복사본 id 로 안 간다', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-list input[type=radio][value=theirs]').first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  expect(p.id).not.toBe(LOCAL); expect(body(p)).toContain('원격 글');
});
test('preload 가 복제의 sourceData 를 버리지 않는다 — 버리면 머지본이 원본 내용이 된다', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../preload.js'), 'utf8');
  expect(src).toMatch(/duplicateProject:\s*\(\{[^}]*sourceData[^}]*\}\)\s*=>\s*ipcRenderer\.invoke\('projects:duplicate',\s*\{[^}]*sourceData[^}]*\}\)/);
});
const sA = 'data:image/png;base64,LOCAL'; const sB = 'data:image/png;base64,REMOTE';
const linked = (t) => sec(t).replace('data-section="1"', 'data-section="1" data-ref-links="s_1:0"');
async function sameIdScene(page, choice) {
  await open(page, { ...data('원격 글'), pages: [{ id: 'p1', name: 'p', canvas: linked('원격 글') }] }, [{ pageId: 'p1', items: [{ id: 's_r', src: sB, x: 1, y: 1, w: 9 }, { id: 's_1', src: sB, x: 2, y: 2, w: 9 }] }], linked('내 글'));
  await page.evaluate(({ L, sA }) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: sA, x: 3, y: 3, w: 9 }] }]), { L: LOCAL, sA });
  await page.locator('.market-merge-btn').first().click();
  if (choice) await page.locator(`#rsv-list input[type=radio][value=${choice}]`).first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  await expect.poll(() => page.evaluate(async () => (await window._scratchExportAll('proj_2000000000002', ['p1'])).length)).toBe(1);
  const items = await page.evaluate(async () => (await window._scratchExportAll('proj_2000000000002', ['p1'])).flatMap((b) => b.items.map((i) => [i.id, i.src])));
  const secs = p.pages[0].canvas.split('<div class="section-block"').slice(1).map((x) => { const tok = x.match(/data-ref-links="([^":]+)/)?.[1]; return [/원격 글/.test(x) ? '원격' : '내', items.find((i) => i[0] === tok)?.[1]]; });
  return { items, secs };
}
test('머지본 스크래치 내것: L 항목과 원격 항목이 다 들어가고, 링크는 L 그림이다, L 스크래치는 그대로', async ({ page }) => {
  const { items, secs } = await sameIdScene(page, null);
  /* 원격 s_r 과 s_1 은 같은 그림이라 s_r 하나로 들어온다, 새 항목을 안 만든다 */
  expect(items.map((i) => i[0]).sort()).toEqual(['s_1', 's_r']);
  expect(secs).toEqual([['내', sA]]);
  expect(await page.evaluate(async (L) => (await window._scratchExportAll(L, ['p1'])).flatMap((b) => b.items.map((i) => [i.id, i.src])), LOCAL)).toEqual([['s_1', sA]]);
});
test('머지본 스크래치 원격 고름: 같은 id 여도 그 섹션 링크는 원격 그림이다', async ({ page }) => {
  expect((await sameIdScene(page, 'theirs')).secs).toEqual([['원격', sB]]);
});
test('머지본 스크래치 둘다: 내 섹션은 L 그림, 원격 섹션은 원격 그림', async ({ page }) => {
  expect((await sameIdScene(page, 'both')).secs).toEqual([['내', sA], ['원격', sB]]);
});
test('음성 머지본 스크래치: 같은 id 같은 그림이면 이름을 안 바꾼다', async ({ page }) => {
  await open(page, { ...data('원격 글'), pages: [{ id: 'p1', name: 'p', canvas: linked('원격 글') }] }, [{ pageId: 'p1', items: [{ id: 's_1', src: sA, x: 2, y: 2, w: 9 }] }], linked('내 글'));
  await page.evaluate(({ L, sA }) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: sA, x: 3, y: 3, w: 9 }] }]), { L: LOCAL, sA });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-list input[type=radio][value=theirs]').first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  expect(p.pages[0].canvas).toContain('data-ref-links="s_1:0"');
  await expect.poll(() => page.evaluate(async () => (await window._scratchExportAll('proj_2000000000002', ['p1'])).flatMap((b) => b.items.map((i) => i.id)))).toEqual(['s_1']);
});
test('머지본 스크래치: 외부화된 항목의 src 는 머지본을 가리킨다, L 항목은 그대로', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.evaluate((L) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_e', src: `goya-asset://${L}/s.png`, x: 3, y: 3, w: 9 }] }]), LOCAL);
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  const src = (id) => page.evaluate(async (id) => (await window._scratchExportAll(id, ['p1'])).flatMap((b) => b.items).find((i) => i.id === 's_e')?.src, id);
  await expect.poll(() => src('proj_2000000000002')).toBe('goya-asset://proj_2000000000002/s.png');
  expect(await src(LOCAL)).toBe(`goya-asset://${LOCAL}/s.png`);
});
const toasts = (page) => page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (t, ...a) => { window.__toasts.push(String(t)); return o?.(t, ...a); }; });
const finals = (page) => page.evaluate(() => window.__toasts.filter((t) => !t.startsWith('⏳')));
test('스크래치를 못 옮기면 성공 토스트 대신 알린다, 머지본은 저장된다', async ({ page }) => {
  await open(page, data('원격 글')); await toasts(page);
  await page.evaluate(() => { window._scratchExportAll = async () => { throw new Error('대역 실패'); }; });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  await expect.poll(() => finals(page)).toEqual(['⚠️ 머지 완료, 스크래치는 못 옮겼습니다 — 홈에서 "원격 이름 (머지)" 열기']);
});
test('음성: 스크래치가 잘 옮겨지면 성공 토스트다', async ({ page }) => {
  await open(page, data('원격 글')); await toasts(page);
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  await expect.poll(() => finals(page)).toEqual(['✅ 머지 완료 — 홈에서 "원격 이름 (머지)" 열기']);
});
test('머지 적용을 두 번 눌러도 머지본은 하나다', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.locator('.market-merge-btn').first().click();
  const b = await page.locator('#rsv-apply').boundingBox();
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await expect.poll(() => page.evaluate(() => !document.querySelector('.market-resolve-modal'))).toBe(true);
  expect(await page.evaluate(() => window.__saved.length)).toBe(1);
});
test('음성: 저장에 실패하면 모달이 남고 단추가 다시 눌린다', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.evaluate(() => { const f = window.electronAPI.duplicateProject; let once = true; window.electronAPI.duplicateProject = async (a) => { if (once) { once = false; throw new Error('대역'); } return f(a); }; window.addEventListener('unhandledrejection', (e) => e.preventDefault()); });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await expect.poll(() => page.evaluate(() => document.querySelector('#rsv-apply')?.disabled)).toBe(false);
  await page.locator('#rsv-apply').click();
  await saved(page);
});
/* quota 꼴 — 쓰기 요청이 끝난 뒤 커밋에서 abort. error 이벤트 없이 abort 만 난다 */
const armAbort = (page) => page.evaluate(() => { const ot = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function (a, m, ...r) { const t = ot.call(this, a, m, ...r); if (m === 'readwrite') { const os = t.objectStore.bind(t); t.objectStore = (n) => { const st = os(n); const op = st.put.bind(st); st.put = (...x) => { const q = op(...x); q.addEventListener('success', () => { try { t.abort(); } catch (_) {} }); return q; }; return st; }; } return t; }; });
test('쓰기가 abort 나면 스크래치 넣기가 멈추지 않고 거절된다', async ({ page }) => {
  await open(page, data('원격 글')); await armAbort(page);
  const r = await page.evaluate(() => window._scratchImportAll('proj_3', [{ pageId: 'p1', items: [{ id: 'x', src: 'data:image/png;base64,A', x: 1, y: 1, w: 1 }] }]).then(() => '끝남', (e) => '거절').then((v) => v));
  expect(r).toBe('거절');
});
test('쓰기가 abort 나도 머지본은 저장되고 스크래치를 못 옮겼다고 알린다', async ({ page }) => {
  await open(page, data('원격 글')); await toasts(page);
  await page.evaluate((L) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: 'data:image/png;base64,LOCAL', x: 3, y: 3, w: 9 }] }]), LOCAL);
  await armAbort(page);
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  await expect.poll(() => finals(page)).toEqual(['⚠️ 머지 완료, 스크래치는 못 옮겼습니다 — 홈에서 "원격 이름 (머지)" 열기']);
  expect(await page.evaluate(() => !!document.querySelector('.market-resolve-modal'))).toBe(false);
});
test('linkDy: 머지본은 살리고, 받기는 그대로 뺀다', async ({ page }) => {
  await open(page, data('원격 글'), [{ pageId: 'p1', items: [{ id: 's_p', src: 'data:image/png;base64,P', x: 1, y: 300, w: 9, linkDy: 40 }] }]);
  await page.evaluate((L) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: 'data:image/png;base64,L', x: 3, y: 300, w: 9, linkDy: 30 }] }], { keepLinkDy: true }), LOCAL);
  const dy = (id) => page.evaluate(async (id) => Object.fromEntries((await window._scratchExportAll(id, ['p1'])).flatMap((b) => b.items.map((i) => [i.id, i.linkDy]))), id);
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  await expect.poll(() => dy('proj_2000000000002')).toEqual({ s_1: 30, s_p: 40 });
  await page.evaluate(() => { window.__saved.length = 0; });
  await page.locator('.market-pull-btn').first().click();
  const p = await saved(page);
  await expect.poll(() => dy(p.id)).toEqual({ s_p: undefined });
});
test('받기를 두 번 눌러도 받은본은 하나다, 끝나면 단추가 다시 눌린다', async ({ page }) => {
  await open(page, data('원격 글'));
  /* 대역은 바로 끝나 두 클릭 사이에 받기가 끝난다. 진짜 받기는 git·저장을 탄다 ⇒ 첫 받기를 늦춘다(꺼진 단추엔 click 이 안 와서 클릭 수로는 못 묶는다) */
  await page.evaluate(() => { const f = window.electronAPI.market.pull; window.__pulls = 0; window.electronAPI.market.pull = async (a) => { if (++window.__pulls === 1) await new Promise((r) => setTimeout(r, 800)); return f(a); }; });
  const b = await page.locator('.market-pull-btn').first().boundingBox();
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await saved(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('.market-pull-btn').disabled)).toBe(false);
  expect(await page.evaluate(() => window.__pulls), '받기는 한 번만 돈다').toBe(1);
  expect(await page.evaluate(() => window.__saved.length)).toBe(1);
  await page.locator('.market-pull-btn').first().click();
  await expect.poll(() => page.evaluate(() => window.__saved.length)).toBe(2);
});
test('받기: 스크래치를 못 옮기면 성공 토스트 대신 알린다, 받은본은 저장된다', async ({ page }) => {
  await open(page, data('원격 글'), [{ pageId: 'p1', items: [{ id: 's_r', src: 'data:image/png;base64,R', x: 1, y: 1, w: 9 }] }]); await toasts(page); await armAbort(page);
  await page.locator('.market-pull-btn').first().click();
  await saved(page);
  await expect.poll(async () => (await finals(page)).map((t) => t.split(' 열기')[0])).toEqual(['⚠️ 받기 완료, 스크래치는 못 옮겼습니다 — 홈에서 "원격 이름 (받음)"']);
});
test('음성 받기: 스크래치가 잘 오면 성공 토스트다', async ({ page }) => {
  await open(page, data('원격 글'), [{ pageId: 'p1', items: [{ id: 's_r', src: 'data:image/png;base64,R', x: 1, y: 1, w: 9 }] }]); await toasts(page);
  await page.locator('.market-pull-btn').first().click();
  await saved(page);
  await expect.poll(async () => (await finals(page)).map((t) => t.split(' 열기')[0])).toEqual(['✅ 받기 완료 — 홈에서 "원격 이름 (받음)"']);
});
async function resolveScene(page, picks) {
  const lc = sec('내 글') + sec('내것만').replace('id="sec_a"', 'id="sec_x" data-ref-links="s_1:0"').replace('id="t_a"', 'id="t_x"');
  const rc = sec('원격 글') + sec('원격만').replace('id="sec_a"', 'id="sec_y"').replace('id="t_a"', 'id="t_y"');
  await open(page, { ...data('x'), pages: [{ id: 'p1', name: 'p', canvas: rc }] }, [{ pageId: 'p1', items: [{ id: 's_1', src: 'data:image/png;base64,REMOTE', x: 1, y: 1, w: 9 }] }], lc);
  await page.evaluate((L) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: 'data:image/png;base64,LOCAL', x: 3, y: 3, w: 9 }] }]), LOCAL);
  await page.locator('.market-merge-btn').first().click();
  await page.evaluate((picks) => { for (const [s, v] of picks) { const e = [...document.querySelectorAll('#rsv-list input[type=radio]')].find((x) => x.name.endsWith('::' + s) && x.value === v); if (e) e.checked = true; } }, picks);
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  return { y: body(p).includes('id="sec_y"'), x: body(p).includes('id="sec_x"'), a: body(p).includes('id="sec_a"') };
}
test('무시·삭제: 새 섹션 무시와 지운 섹션 삭제가 먹는다', async ({ page }) => {
  expect(await resolveScene(page, [['sec_y', 'mine'], ['sec_x', 'theirs']])).toEqual({ y: false, x: false, a: true });
});
test('음성 무시·삭제: 받기·유지면 둘 다 남고, 기본도 둘 다 남는다, 내 섹션 토큰은 그대로다', async ({ page }) => {
  expect(await resolveScene(page, [['sec_y', 'theirs'], ['sec_x', 'mine']])).toEqual({ y: true, x: true, a: true });
  const p = await page.evaluate(() => window.__saved[0]);
  expect(body(p)).toContain('data-ref-links="s_1:0"');
});
test('음성 무시·삭제: 안 고르면 기본(받기·유지)으로 둘 다 남는다', async ({ page }) => {
  expect(await resolveScene(page, [])).toEqual({ y: true, x: true, a: true });
});
const PNG_A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
async function mergeLinked(page, localSrc, remoteSrc) {
  await open(page, { ...data('원격 글'), pages: [{ id: 'p1', name: 'p', canvas: linked('원격 글') }] }, [{ pageId: 'p1', items: [{ id: 's_1', src: remoteSrc, x: 2, y: 2, w: 9 }] }], linked('내 글'));
  await page.evaluate(({ L, s }) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: s, x: 3, y: 3, w: 9 }] }]), { L: LOCAL, s: localSrc });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-list input[type=radio][value=theirs]').first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  await expect.poll(() => page.evaluate(async () => (await window._scratchExportAll('proj_2000000000002', ['p1'])).length)).toBe(1);
  return { token: p.pages[0].canvas.match(/data-ref-links="([^":]+)/)?.[1], ids: await page.evaluate(async () => (await window._scratchExportAll('proj_2000000000002', ['p1'])).flatMap((b) => b.items.map((i) => i.id))) };
}
/* 이 하네스는 crypto.subtle 이 없어 해시를 못 낸다(그러면 _sameImage 는 «같다»). 해시 값은 앱에서 쟀다(회신). 여기선 그 한 벌을 부르고 답을 따르는지 본다. */
const spySame = (page, answer) => page.addInitScript((answer) => { Object.defineProperty(window, '_sameImage', { configurable: true, get: () => async (a, b) => { (window.__sameCalls = window.__sameCalls || []).push([a.slice(0, 5), b.slice(0, 5)]); return answer; }, set: () => {} }); }, answer);
test('같은 그림: L 은 goya, 원격은 data 면 _sameImage 를 묻고 같으면 _r 을 안 단다', async ({ page }) => {
  await spySame(page, true);
  expect(await mergeLinked(page, `goya-asset://${LOCAL}/h.png`, PNG_A)).toEqual({ token: 's_1', ids: ['s_1'] });
  expect(await page.evaluate(() => window.__sameCalls)).toEqual([['goya-', 'data:']]);
});
test('같은 그림: 둘 다 goya 면 프로젝트 id 가 달라도 파일명으로 같다', async ({ page }) => {
  expect(await mergeLinked(page, `goya-asset://${LOCAL}/abc.png`, 'goya-asset://proj_9/abc.png')).toEqual({ token: 's_1', ids: ['s_1'] });
});
test('음성 같은 그림: _sameImage 가 다르다면 _r 을 단다', async ({ page }) => {
  await spySame(page, false);
  const r = await mergeLinked(page, `goya-asset://${LOCAL}/h.png`, PNG_B);
  expect(r.token).toMatch(/^sp_[a-z0-9]{6}$/); expect(r.ids).toEqual(['s_1', r.token]);
  expect([...`#${r.token} `.matchAll(/#(sp_[a-z0-9]{6})\b/g)].length, 'AI 첨부 토큰에 맞는다').toBe(1);
});
test('음성 같은 그림: 둘 다 goya 인데 파일명이 다르면 다른 그림이다', async ({ page }) => {
  const r = await mergeLinked(page, `goya-asset://${LOCAL}/abc.png`, 'goya-asset://proj_9/def.png');
  expect(r.token).toMatch(/^sp_[a-z0-9]{6}$/); expect(r.ids).toEqual(['s_1', r.token]);
});
test('없는 goya: 원격 그림이 이 맥에 없으면 _r 을 안 달고 L 그림을 쓴다', async ({ page }) => {
  await spySame(page, false);
  expect(await mergeLinked(page, PNG_A, 'goya-asset://proj_missing/x.png')).toEqual({ token: 's_1', ids: ['s_1'] });
});
test('음성 없는 goya: 원격 그림이 이 맥에 있으면 다른 그림으로 _r 을 단다', async ({ page }) => {
  await spySame(page, false);
  const r = await mergeLinked(page, PNG_A, 'goya-asset://proj_here/x.png');
  expect(r.token).toMatch(/^sp_[a-z0-9]{6}$/); expect(r.ids).toEqual(['s_1', r.token]);
});
test('음성 없는 goya: 겹치지 않는 항목은 없는 그림이어도 지우지 않는다', async ({ page }) => {
  await open(page, data('원격 글'), [{ pageId: 'p1', items: [{ id: 's_n', src: 'goya-asset://proj_missing/n.png', x: 1, y: 1, w: 9 }] }]);
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  await expect.poll(() => page.evaluate(async () => (await window._scratchExportAll('proj_2000000000002', ['p1'])).flatMap((b) => b.items.map((i) => i.id)))).toEqual(['s_n']);
});
const LAST_TOAST = (page) => page.evaluate(() => window.__toasts.filter((t) => !t.startsWith('⏳')));
test('알림 없는 그림: 원격 섹션이 없는 그림을 쓰면 내 그림으로 뒀다고 알린다', async ({ page }) => {
  await spySame(page, false);
  await open(page, { ...data('원격 글'), pages: [{ id: 'p1', name: 'p', canvas: linked('원격 글') }] }, [{ pageId: 'p1', items: [{ id: 's_1', src: 'goya-asset://proj_missing/x.png', x: 2, y: 2, w: 9 }] }], linked('내 글'));
  await toasts(page);
  await page.evaluate(({ L, s }) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: s, x: 3, y: 3, w: 9 }] }]), { L: LOCAL, s: PNG_A });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-list input[type=radio][value=theirs]').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  await expect.poll(() => LAST_TOAST(page)).toEqual(['⚠️ 머지 완료, 원격 그림 1장이 이 맥에 없어 내 그림으로 두었습니다 — 홈에서 "원격 이름 (머지)" 열기']);
});
for (const pid of ['proj_throw', 'proj_eio']) test(`일시 읽기 실패(${pid})는 없음으로 안 친다: 원격 그림을 새 항목으로 둔다`, async ({ page }) => {
  await spySame(page, false);
  const r = await mergeLinked(page, PNG_A, `goya-asset://${pid}/x.png`);
  expect(r.token).toMatch(/^sp_[a-z0-9]{6}$/); expect(r.ids).toEqual(['s_1', r.token]);
});
test('음성 알림 없는 그림: 내 것을 고르면 없는 원격 그림은 쓸 일이 없어 안 알린다', async ({ page }) => {
  await spySame(page, false);
  await open(page, { ...data('원격 글'), pages: [{ id: 'p1', name: 'p', canvas: linked('원격 글') }] }, [{ pageId: 'p1', items: [{ id: 's_1', src: 'goya-asset://proj_missing/x.png', x: 2, y: 2, w: 9 }] }], linked('내 글'));
  await toasts(page);
  await page.evaluate(({ L, s }) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: s, x: 3, y: 3, w: 9 }] }]), { L: LOCAL, s: PNG_A });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  await expect.poll(() => finals(page)).toEqual(['✅ 머지 완료 — 홈에서 "원격 이름 (머지)" 열기']);
});
test('머지 시작을 두 번 눌러도 모달은 하나다, 취소하면 다시 열린다', async ({ page }) => {
  await open(page, data('원격 글'));
  await page.evaluate(() => { const f = window.electronAPI.market.pull; window.electronAPI.market.pull = async (a) => { await new Promise((r) => setTimeout(r, 500)); return f(a); }; });
  const b = await page.locator('.market-merge-btn').first().boundingBox();
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.market-resolve-modal').length)).toBe(1);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
  expect(await page.evaluate(() => document.querySelectorAll('.market-resolve-modal').length)).toBe(1);
  await page.locator('#rsv-cancel').click();
  await page.locator('.market-merge-btn').first().click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.market-resolve-modal').length)).toBe(1);
});
test('재머지: 앞 머지가 들여온 그림이면 새 항목을 안 만들고 그 항목을 가리킨다', async ({ page }) => {
  await open(page, { ...data('원격 글'), pages: [{ id: 'p1', name: 'p', canvas: linked('원격 글') }] }, [{ pageId: 'p1', items: [{ id: 's_1', src: 'goya-asset://proj_9/new.png', x: 2, y: 2, w: 9 }] }], linked('내 글'));
  await page.evaluate(({ L }) => window._scratchImportAll(L, [{ pageId: 'p1', items: [{ id: 's_1', src: 'goya-asset://proj_9/old.png', x: 3, y: 3, w: 9 }, { id: 'sp_aaaaaa', src: 'goya-asset://proj_8/new.png', x: 3, y: 3, w: 9 }] }]), { L: LOCAL });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-list input[type=radio][value=theirs]').first().click();
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  expect(p.pages[0].canvas).toContain('data-ref-links="sp_aaaaaa:0"');
  await expect.poll(() => page.evaluate(async () => (await window._scratchExportAll('proj_2000000000002', ['p1'])).flatMap((b) => b.items.map((i) => i.id)))).toEqual(['s_1', 'sp_aaaaaa']);
});
async function allGone(page) {
  await open(page, { ...data('x'), pages: [{ id: 'p1', name: 'p', canvas: sec('원격만').replace('id="sec_a"', 'id="sec_y"').replace('id="t_a"', 'id="t_y"') }] }, [], sec('내것만').replace('id="sec_a"', 'id="sec_x"').replace('id="t_a"', 'id="t_x"'));
  await page.locator('.market-merge-btn').first().click();
  await page.evaluate(() => { for (const [s, v] of [['sec_y', 'mine'], ['sec_x', 'theirs']]) { const e = [...document.querySelectorAll('#rsv-list input[type=radio]')].find((x) => x.name.endsWith('::' + s) && x.value === v); if (e) e.checked = true; } });
}
test('빈 머지본: 전부 무시·삭제면 적용 전에 묻고, 취소하면 저장 없이 모달이 남고 단추가 눌린다', async ({ page }) => {
  await allGone(page);
  const msgs = []; page.once('dialog', (d) => { msgs.push(d.message()); d.dismiss(); });
  await page.locator('#rsv-apply').click();
  await expect.poll(() => msgs).toEqual(['이대로 머지하면 1개 페이지가 빈 페이지가 됩니다. 계속할까요?']);
  await expect.poll(() => page.evaluate(() => document.querySelector('#rsv-apply')?.disabled)).toBe(false);
  expect(await page.evaluate(() => window.__saved.length)).toBe(0);
});
test('빈 머지본: 확인하면 저장한다', async ({ page }) => {
  await allGone(page);
  page.once('dialog', (d) => d.accept());
  await page.locator('#rsv-apply').click();
  const p = await saved(page);
  expect(body(p)).toBe('');
});
test('음성 빈 머지본: 섹션이 남으면 안 묻는다', async ({ page }) => {
  await open(page, data('원격 글'));
  const msgs = []; page.on('dialog', (d) => { msgs.push(d.message()); d.accept(); });
  await page.locator('.market-merge-btn').first().click();
  await page.locator('#rsv-apply').click();
  await saved(page);
  expect(msgs).toEqual([]);
});
