/* tab-name-edit-exit.dom.spec.js — RG-N5c: 프로젝트 탭 이름 편집이 «나가는 문»마다 끝나는가 (2026-10-06 lane-esweep · 지디 ⑴ 이번 판)
 * 증상(잼 ×8 · 917420e3): 탭 이름을 더블클릭해 한 글자 친 뒤 Enter → contentEditable 남음 8/8 · 다음 키 g 가 이름에 섞임 8/8 (바로 Enter 는 0/8).
 * 자리: js/io/save-load.js initApp #tab-bar 위임 dblclick → blur commit + keydown onKey. onKey 가 «첫 키 하나» 뒤 스스로 떨어진다.
 * 고침 꼴 = RG-N5(page-name-edit-exit) 와 같음 — 떼기는 나가는 문(commit) 안 · 편집 중 다시 더블클릭은 무시. stopPropagation 은 없음(탭은 항목 keydown 이 없다).
 * ★전제: 하네스에 진짜 탭 없음 — 손으로 지은 .proj-tab · dblclick 처리기는 앱 것(initApp 의 #tab-bar 위임). activeProjectId 를 그 탭 id 로.
 * 처리기 수는 RG-N5 와 같은 두 계기(CDP DOMDebugger · JS add/remove Set) + 양성대조. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
test.describe.configure({ timeout: 60000 });

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => {
    const M = new WeakMap(); const A = EventTarget.prototype.addEventListener, D = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (t, fn, o) { if (t === 'keydown' && fn) { let s = M.get(this); if (!s) M.set(this, s = new Set()); s.add(fn); } return A.call(this, t, fn, o); };
    EventTarget.prototype.removeEventListener = function (t, fn, o) { if (t === 'keydown') M.get(this)?.delete(fn); return D.call(this, t, fn, o); };
    window.__kdCount = (el) => M.get(el)?.size || 0;
  });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    window.activeProjectId = 'p_rgn5c';
    const bar = document.getElementById('tab-bar');
    const t = document.createElement('div'); t.className = 'proj-tab active'; t.dataset.id = 'p_rgn5c';
    const n = document.createElement('span'); n.className = 'proj-tab-name'; n.textContent = '탭'; t.appendChild(n); bar.appendChild(t);
    // commit 횟수 = 이름 칸 글자 갈아끼우기(commit 의 nameEl.textContent = newName) 횟수
    window.__writes = 0; new MutationObserver(ms => { window.__writes += ms.filter(m => m.type === 'childList').length; }).observe(n, { childList: true });
  });
  const name = await page.evaluateHandle(() => document.querySelector('.proj-tab[data-id="p_rgn5c"] .proj-tab-name'));
  expect(await name.evaluate(n => !!n), '[전제] 손으로 지은 탭 이름 칸').toBe(true);
  return { errs, name };
}
const xy = (name) => name.evaluate(n => { n.scrollIntoView({ block: 'center' }); const r = n.getBoundingClientRect(); return [r.left + 6, r.top + r.height / 2]; });
async function startEdit(page, name, times = 1) { const [x, y] = await xy(name); for (let i = 0; i < times; i++) { await page.mouse.dblclick(x, y); await page.waitForTimeout(150); } }
const st = (name) => name.evaluate(n => ({ ce: n.contentEditable, text: n.textContent, focused: document.activeElement === n }));
async function clickAway(page) {
  const [x, y] = await page.evaluate(() => { const w = document.getElementById('canvas-wrap') || document.body; const r = w.getBoundingClientRect(); return [r.left + 6, r.bottom - 6]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
}
async function kd(page, name) {
  const cdp = await page.context().newCDPSession(page);
  await name.evaluate(n => { window.__rgN5cName = n; });
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__rgN5cName' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: 0 });
  await cdp.detach();
  return { cdp: listeners.filter(l => l.type === 'keydown').length, js: await name.evaluate(n => window.__kdCount(n)) };
}

test('RG-N5c ㉠ [전제] 탭 이름 더블클릭 → 편집 중(contentEditable · 포커스)', async ({ page }) => {
  const { name } = await setup(page);
  await startEdit(page, name);
  const s = await st(name);
  expect({ ce: s.ce, focused: s.focused }).toEqual({ ce: 'true', focused: true });
});

for (const exit of ['Enter', 'Escape', 'click-away']) {
  test(`RG-N5c ㉡ [새 것] 한 글자 «x» 친 뒤 나가는 문 = ${exit} → 편집 끝 · 다음 키 g 가 안 섞임`, async ({ page }) => {
    const { name } = await setup(page);
    await startEdit(page, name);
    await page.keyboard.press('End'); await page.keyboard.type('x'); await page.waitForTimeout(100);
    if (exit === 'click-away') await clickAway(page); else { await page.keyboard.press(exit); await page.waitForTimeout(200); }
    const want = exit === 'Escape' ? '탭' : '탭x';
    expect(await st(name).then(s => ({ ce: s.ce, text: s.text })), '나간 뒤 · 원래 이름 «탭»').toEqual({ ce: 'false', text: want });
    await page.keyboard.press('g'); await page.waitForTimeout(150);
    expect((await st(name)).text, '다음 키가 이름에 안 섞임').toBe(want);
  });
}

test('RG-N5c ㉢ [새 것] 끝난 뒤(키 없이 바깥 클릭) — (ⅱ) keydown 처리기 0 · (ⅰ) Escape 보내도 이름 그대로', async ({ page }) => {
  const { name } = await setup(page);
  await startEdit(page, name);
  expect(await kd(page, name), '[양성대조] 편집 중 keydown 처리기 — CDP · JS 계기').toEqual({ cdp: 1, js: 1 });
  await clickAway(page);
  const before = await st(name);
  expect(before.ce, '[전제] 편집이 끝났다').toBe('false');
  expect.soft(await kd(page, name), '(ⅱ) 끝난 뒤 keydown 처리기 수 — CDP · JS (Escape 보내기 «전»에 센다)').toEqual({ cdp: 0, js: 0 });
  await name.evaluate(n => n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.waitForTimeout(150);
  expect.soft((await st(name)).text, '(ⅰ) 끝난 뒤 Escape → 이름 그대로').toBe(before.text);
});

test('RG-N5c ㉣ [새 것] 편집 중 더블클릭 ×3 → 바로 Enter → 끝 · 처리기 0 · 커밋(이름 칸 갈아끼우기) 1 번', async ({ page }) => {
  const { name } = await setup(page);
  await startEdit(page, name, 3);
  const w0 = await page.evaluate(() => window.__writes);
  await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  const s = await st(name);
  expect({ ce: s.ce, listeners: await kd(page, name), commits: await page.evaluate((w0) => window.__writes - w0, w0) }).toEqual({ ce: 'false', listeners: { cdp: 0, js: 0 }, commits: 1 });
});
