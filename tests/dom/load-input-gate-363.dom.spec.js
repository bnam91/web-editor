/* load-input-gate-363 — 로드가 끝날 때까지 입력을 막고, 막아도 나갈 길은 산다 (J363A · 현빈 결정)
 * 왜: 로드 중 넣은 것은 곧 교체될 캔버스에 들어가 화면에도 파일에도 안 남고 말도 없었다(앱 실측 9/9 · ~/gd-lane/imac-gd-L1/341d).
 * 자: 앱 손잡이가 듣는 document 캡처(게이트는 window 캡처라 그보다 앞) 도착 수 + 진짜 마우스·키의 결과. 파일은 앱 탐침이 잰다.
 * 칸: G19 탭 이름 편집 막음 · G20 [음성] 로드 뒤 탭 이름 편집 | G1 섹션 추가·프레임 단추 · G2 단축키 · G3 붙여넣기 · G4 파일·스크래치 놓기 · G5 글자 키 · G6 스크래치 장 누름
 *     G7 적용 뒤 무장 전 창 · G8 [음성] 푼 뒤 끌기 억제로 다시 안 잠긴다 · G9 탭 전환 · G10 홈 · G11 스크롤 · G12 종료 키 기본 동작
 *     G13 읽기 실패 풀림 · G14 탭 읽기 실패 풀림 · G15 적용이 던져도 풀림 · G16 [음성] 프로젝트 없는 판 · G17 [음성] 모달 · G18 [음성] 로드 뒤 전부 지나감
 * ★처음 실행 기록: 2026-11-03 10:1x · 아이맥 · 판 8ac017c5 · w1 · retries 0 · 변이 각 ×1: 게이트 리스너 뺌 G1~G7·G12 빨강 | 토스트 뺌 G13·G14·G15 빨강 | switchTab 머리 finally 뺌 G15 빨강 | 무장 칸 뺌 G7 빨강 | 잠금을 isProjectReady 직결 G8 빨강 | PASS 비움 G9·G10 빨강 | ★error 칸 뺌은 처음에 전부 초록(free 가 20초를 기다려 15초 안전망이 풀어 줬다) → G14·G15 의 free 에 5초 한도를 넣자 G14·G15 빨강 · 고친 판 repeat-each 3 54/54
 */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const [A, B] = ['proj_363a', 'proj_363b'];
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==';

const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function setup(page, { noFile = false } = {}) {
  await page.addInitScript(([A, B, noFile]) => {
    const project = (id) => ({ id, name: id, version: 2, currentPageId: 'page_1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}_1"><div class="section-inner"></div></div>` }] });
    const files = new Map([[A, project(A)]]); if (!noFile) files.set(B, project(B));
    window.__pending = {};
    const fake = {
      isElectron: true,
      onForceSaveBeforeQuit: () => {}, quitReady: () => {},
      listProjects: async () => [...files.keys()].map(id => ({ id, name: id })),
      loadProject: (id, opts) => {
        const read = () => JSON.parse(JSON.stringify(files.get(id) || null));
        if (!(opts && opts.open === true)) return Promise.resolve(read());
        return new Promise((res, rej) => { window.__pending[id] = { done: () => res(read()), fail: () => rej(new Error('읽기 실패')) }; });
      },
      saveProject: async () => ({ ok: true }),
      saveProjectSync: () => ({ ok: true }),
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
    localStorage.setItem('web-editor-open-tabs', JSON.stringify({ tabs: [{ id: A, name: A }, { id: B, name: B }], activeId: B }));
    window.__seen = {}; window.__defaulted = [];
    for (const n of ['click', 'keydown', 'paste', 'drop', 'dragover', 'pointerdown', 'beforeinput', 'wheel']) document.addEventListener(n, (e) => { window.__seen[n] = (window.__seen[n] || 0) + 1; }, true);
    window.addEventListener('keydown', (e) => { setTimeout(() => window.__defaulted.push([e.key, e.defaultPrevented]), 0); }, true);
  }, [A, B, noFile]);
  const errs = await bootApp(page);
  errs.length = 0;
  return errs;
}
const open = async (page) => {
  await page.goto(`${ORIGIN}/index.html?project=${B}`);
  await page.waitForFunction((B) => window.__pending[B] && typeof window.addSection === 'function' && !!document.querySelector('#tab-bar .proj-tab'), B, { timeout: 20000 });
  await page.evaluate(() => { window.__seen = {}; });
};
const finish = (page, id, how = 'done') => page.evaluate(([id, how]) => { const q = window.__pending[id]; delete window.__pending[id]; q[how](); }, [id, how]);
const opened = (page, id) => page.waitForFunction((id) => window.__pending[id], id);
const loaded = (page, id) => page.waitForFunction((id) => !!document.getElementById(`sec_${id}_1`), id, { timeout: 10000 });
const free = (page, timeout = 20000) => page.waitForFunction(() => !window.LoadInputGate.isOn(), null, { timeout });
const seen = (page, n) => page.evaluate((n) => window.__seen[n] || 0, n);
const on = (page) => page.evaluate(() => window.LoadInputGate.isOn());
const secN = (page) => page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
const tab = (page, id) => page.locator(`#tab-bar .proj-tab[data-id="${id}"]`).first();
const count = (page, fn) => page.evaluate((fn) => { window.__n = window.__n || {}; window.__n[fn] = 0; const o = window[fn]; window[fn] = function () { window.__n[fn]++; return o.apply(this, arguments); }; }, fn);
const nOf = (page, fn) => page.evaluate((fn) => window.__n[fn], fn);
const dropFile = (page) => page.evaluate((b64) => { const u = Uint8Array.from(atob(b64), x => x.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([u], 'p.png', { type: 'image/png' }));
  const w = document.getElementById('canvas-wrap'); w.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); w.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, PNG);
const pasteFile = (page) => page.evaluate((b64) => { const u = Uint8Array.from(atob(b64), x => x.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([u], 'p.png', { type: 'image/png' }));
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, PNG);

test('G1 섹션 추가·프레임 단추 — 진짜 클릭이 안 먹고 덮개가 뜬다', async ({ page }) => {
  const errs = await setup(page); await open(page); await count(page, 'addSection'); await count(page, 'addFrameBlock');
  expect(await on(page), '[전제] 막는 중').toBe(true);
  await expect(page.locator('#proj-loading-overlay'), '★불러오는 중이 안 보인다').toBeVisible();
  await page.locator('button.fp-btn.primary[onclick="addSection()"]').click();
  await page.locator('button.fp-btn[onclick="addFrameBlock()"]').click();
  expect(await seen(page, 'click'), '★클릭이 손잡이까지 갔다').toBe(0);
  expect([await nOf(page, 'addSection'), await nOf(page, 'addFrameBlock')]).toEqual([0, 0]);
  await finish(page, B); await loaded(page, B); await free(page);
  await expect(page.locator('#proj-loading-overlay'), '★덮개가 안 닫힌다').toHaveCount(0);
  expect(await secN(page)).toBe(1);
  expect(errs).toEqual([]);
});

test('G2 단축키 — 손잡이까지 안 간다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  for (const k of ['t', 'g', 'Meta+d', 'Meta+s', 'Meta+z']) await page.keyboard.press(k);
  expect(await seen(page, 'keydown')).toBe(0);
  expect(await secN(page)).toBe(0);
  expect(errs).toEqual([]);
});

test('G3 붙여넣기 — 스크래치에 안 들어간다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await pasteFile(page); await settle(page);
  expect(await seen(page, 'paste')).toBe(0);
  await expect(page.locator('.scratch-item')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('G4 파일·스크래치 놓기 — 안 들어간다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await dropFile(page); await settle(page);
  expect([await seen(page, 'dragover'), await seen(page, 'drop')]).toEqual([0, 0]);
  await expect(page.locator('.scratch-item')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('G5 글자 키 — 포커스가 칸에 있어도 안 들어간다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'g5'; document.getElementById('panel-left').appendChild(i); i.focus(); });
  await page.keyboard.type('abc');
  expect(await page.inputValue('#g5')).toBe('');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'g5e'; d.contentEditable = 'true'; document.getElementById('panel-left').appendChild(d); d.focus(); });
  await page.keyboard.type('abc');
  expect(await page.textContent('#g5e')).toBe('');
  expect(errs).toEqual([]);
});

test('G6 스크래치 장 누름 — 끌기가 안 시작한다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await page.evaluate(() => { const d = document.createElement('div'); d.className = 'g6'; d.style.cssText = 'position:absolute;left:10px;top:10px;width:50px;height:50px'; document.getElementById('canvas-wrap').appendChild(d); });
  await page.locator('.g6').dispatchEvent('pointerdown');
  expect(await seen(page, 'pointerdown')).toBe(0);
  expect(errs).toEqual([]);
});

test('G7 적용 뒤 무장 전 창 — 아직 막고 덮개가 남는다 · 무장되면 풀린다', async ({ page }) => {
  const errs = await setup(page); await open(page); await count(page, 'addSection');
  await page.evaluate(() => { window.__tok = window.AutoSaveSuppress.begin('g7'); });
  await finish(page, B); await loaded(page, B); await settle(page);
  expect(await page.evaluate(() => window.gdtProjectReady.get().phase), '[전제] 확정됨').toBe('ready');
  expect(await page.evaluate(() => window.gdtProjectReady.get().autosaveArmed), '[전제] 무장 전').toBe(false);
  expect(await on(page), '★무장 전인데 풀렸다').toBe(true);
  await expect(page.locator('#proj-loading-overlay')).toBeVisible();
  await page.locator('button.fp-btn.primary[onclick="addSection()"]').click();
  expect(await nOf(page, 'addSection')).toBe(0);
  await page.evaluate(() => window.AutoSaveSuppress.end(window.__tok));
  await free(page);
  await page.locator('button.fp-btn.primary[onclick="addSection()"]').click();
  expect(await nOf(page, 'addSection')).toBe(1);
  expect(errs).toEqual([]);
});

test('G8 [음성] 푼 뒤엔 억제가 켜져도 안 잠긴다(끌기를 안 끊는다)', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await finish(page, B); await loaded(page, B); await free(page);
  await page.evaluate(() => { window.__tok = window.AutoSaveSuppress.begin('section-drag'); });
  expect(await on(page)).toBe(false);
  await count(page, 'addSection');
  await page.locator('button.fp-btn.primary[onclick="addSection()"]').click();
  expect(await nOf(page, 'addSection')).toBe(1);
  await page.evaluate(() => window.AutoSaveSuppress.end(window.__tok));
  expect(errs).toEqual([]);
});

test('G9 탭 전환 — 막는 동안에도 된다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  const n0 = await page.evaluate(() => window.LoadInputGate.blockedCount());
  await tab(page, A).click();
  await opened(page, A);
  expect(await page.evaluate(() => window.activeProjectId)).toBe(A);
  await finish(page, A); await loaded(page, A); await free(page);
  expect(await page.evaluate(() => window.LoadInputGate.blockedCount()), '★탭 클릭을 막았다').toBe(n0);
  await finish(page, B); await settle(page);   // 늦게 끝난 부트 로드 — 버려진다
  expect(await page.evaluate((id) => !!document.getElementById(id), `sec_${B}_1`), '★버린 로드가 화면에 들어왔다').toBe(false);
  expect(await on(page), '★늦은 끝이 다시 잠갔다').toBe(false);
  expect(errs).toEqual([]);
});

test('G10 홈 — 막는 동안에도 된다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await page.evaluate(() => { window.__home = 0; window.goHome = () => { window.__home++; }; });
  await page.locator('#home-btn').click();
  expect(await page.evaluate(() => window.__home)).toBe(1);
  expect(errs).toEqual([]);
});

test('G11 스크롤 — 막는 동안에도 휠로 움직인다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  const id = await page.evaluate(() => { const c = document.getElementById('canvas'); const d = document.createElement('div'); d.style.height = '6000px'; c.appendChild(d);
    for (const x of ['canvas-area', 'canvas-wrap', 'canvas-scaler']) { const e = document.getElementById(x); if (e && e.scrollHeight > e.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return x; } return null; });
  expect(id, '[전제] 스크롤 칸').toBeTruthy();
  const box = await page.locator(`#${id}`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const t0 = await page.evaluate((id) => document.getElementById(id).scrollTop, id);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).scrollTop, id), { message: '★휠이 죽었다' }).toBeGreaterThan(t0);
  expect(errs).toEqual([]);
});

test('G12 종료 키·스크롤 키 — 기본 동작을 안 끊는다 · 칸 안 글자 키만 끊는다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await page.keyboard.press('Meta+q'); await page.keyboard.press('PageDown');
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'g12'; document.getElementById('panel-left').appendChild(i); i.focus(); });
  await page.keyboard.press('Meta+q'); await page.keyboard.press('x');
  await settle(page);
  const d = await page.evaluate(() => window.__defaulted.filter(x => ['q', 'PageDown', 'x'].includes(x[0])));
  expect(d).toEqual([['q', false], ['PageDown', false], ['q', false], ['x', true]]);
  expect(errs).toEqual([]);
});

test('G13 부트 읽기 실패 — 풀리고 말한다', async ({ page }) => {
  const errs = await setup(page); await open(page); await count(page, 'addSection');
  await finish(page, B, 'fail'); await free(page);
  await expect(page.locator('body'), '★실패를 말하지 않았다').toContainText('읽지 못했습니다');
  await expect(page.locator('#proj-loading-overlay')).toHaveCount(0);
  await page.locator('button.fp-btn.primary[onclick="addSection()"]').click();
  expect(await nOf(page, 'addSection')).toBe(1);
  expect(errs).toEqual([]);
});

test('G14 탭 읽기 실패 — 풀리고 말한다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await finish(page, B); await loaded(page, B); await free(page);
  await tab(page, A).click(); await opened(page, A);
  expect(await on(page), '[전제] 막는 중').toBe(true);
  await finish(page, A, 'fail'); await free(page, 5000);   // 15초 안전망이 아니라 실패 칸이 풀어야 한다
  await expect(page.locator('body')).toContainText('읽지 못했습니다');
  expect(await page.evaluate(() => window.gdtProjectReady.get().phase)).toBe('error');
  errs.length = 0;   // switchTab 이 일부러 다시 던진다(앞 판과 같다)
});

test('G15 적용이 던져도 — 영영 막히지 않는다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await finish(page, B); await loaded(page, B); await free(page);
  await tab(page, A).click(); await opened(page, A);
  await page.evaluate(() => { window.applyProjectData = () => { throw new Error('적용 실패'); }; });
  await finish(page, A); await free(page, 5000);
  await expect(page.locator('body')).toContainText('읽지 못했습니다');
  errs.length = 0;   // 던진 오류 자체는 이 칸의 값이 아니다
});

test('G16 [음성] 프로젝트 없는 판 — 안 막는다', async ({ page }) => {
  const errs = await bootApp(page);
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.addSection === 'function' && window.gdtProjectReady?.get().phase !== 'loading', null, { timeout: 20000 });
  expect(await page.evaluate(() => window.LoadInputGate.isOn())).toBe(false);
  expect(errs).toEqual([]);
});

test('G17 [음성] 모달은 막는 동안에도 눌린다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'g17'; d.style.cssText = 'position:fixed;left:400px;top:300px;width:100px;height:60px;z-index:99999;background:#888'; d.innerHTML = '<button id="g17b" style="width:100%;height:100%" onclick="window.__g17=1">x</button>'; document.body.appendChild(d); });
  await page.locator('#g17b').click();
  expect(await page.evaluate(() => window.__g17)).toBe(1);
  expect(errs).toEqual([]);
});

test('G18 [음성] 로드 뒤엔 같은 입력이 전부 지나간다(자 양성)', async ({ page }) => {
  const errs = await setup(page); await open(page); await finish(page, B); await loaded(page, B); await free(page);
  await page.evaluate(() => { window.__seen = {}; });
  await page.locator('button.fp-btn.primary[onclick="addSection()"]').click();
  expect(await secN(page), '★섹션이 안 들어갔다').toBe(2);
  await page.keyboard.press('Escape');
  await pasteFile(page); await dropFile(page);
  await expect(page.locator('.scratch-item').first(), '★놓기·붙여넣기가 안 들어갔다').toBeVisible();
  expect(await page.evaluate(() => [window.__seen.click > 0, window.__seen.keydown > 0, window.__seen.paste > 0, window.__seen.drop > 0, window.__seen.pointerdown > 0])).toEqual([true, true, true, true, true]);
  expect(errs).toEqual([]);
});

test('G19 탭 이름 더블클릭 — 막는 동안엔 편집이 안 열린다 · 로드가 안 끊긴다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  const name = page.locator(`#tab-bar .proj-tab[data-id="${B}"] .proj-tab-name`);
  await name.dblclick();
  expect(await name.evaluate(n => n.isContentEditable), '★로드 중 이름 칸이 열렸다').toBe(false);
  await finish(page, B); await loaded(page, B); await free(page);
  expect(await page.evaluate(() => window.gdtProjectReady.get().phase)).toBe('ready');
  expect(errs).toEqual([]);
});

test('G20 [음성] 로드 뒤엔 탭 이름 더블클릭이 된다', async ({ page }) => {
  const errs = await setup(page); await open(page);
  await finish(page, B); await loaded(page, B); await free(page);
  const name = page.locator(`#tab-bar .proj-tab[data-id="${B}"] .proj-tab-name`);
  await name.dblclick();
  expect(await name.evaluate(n => n.isContentEditable)).toBe(true);
  await page.keyboard.press('Escape');
  expect(errs).toEqual([]);
});
