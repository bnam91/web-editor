/* page-name-edit-exit.dom.spec.js — RG-N5: 파일 패널 페이지 이름 편집이 «나가는 문»마다 끝나는가 (2026-10-06 lane-esweep · 태양 승인 «개정 2»)
 * 증상(잼 ×8): 이름을 더블클릭해 글자를 하나라도 치면 Enter/Escape 가 안 먹는다 — .editing·contentEditable 남음 · 다음 손짓 글자가 이름에 섞임.
 * 자리: js/file-page-section.js dblclick → blur commit + keydown onKey. onKey 가 «첫 키 하나» 뒤 스스로 떨어진다(:67).
 * 고침 꼴(문 하나): onKey 떼기 = commit(blur) 안 · Enter/Escape 는 blur 만 부른다 · 편집 중 다시 더블클릭은 무시.
 * ㉢ 은 둘로 잰다 — (ⅰ) 끝난 뒤 Escape → 이름 그대로 (ⅱ) 끝난 뒤 이름 칸 keydown 처리기 수 = 0 (CDP DOMDebugger.getEventListeners).
 *   (ⅰ)만으론 «남은 onKey» 를 못 본다(되돌릴 이름 = 방금 커밋한 이름) — 그래서 (ⅱ).
 * RG-N5b(측정만 · 고치지 않음): 편집 중 키가 항목(.file-page-item) keydown 으로 버블 → Space/Enter 에 switchPage. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
test.describe.configure({ timeout: 60000 });

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    window.switchToTab?.('file');
    window.__saves = 0; const s = window.scheduleAutoSave; window.scheduleAutoSave = (...a) => { window.__saves++; return s?.(...a); };
    window.__switches = 0; const w = window.switchPage; window.switchPage = (...a) => { window.__switches++; return w?.(...a); };
  });
  const name = await page.evaluateHandle(() => document.querySelector('.file-page-name'));
  expect(await name.evaluate(n => !!n), '[전제] 페이지 이름 칸').toBe(true);
  return { errs, name };
}
const nameXY = (name) => name.evaluate(n => { n.scrollIntoView({ block: 'center' }); const r = n.getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
async function startEdit(page, name, times = 1) {
  const [x, y] = await nameXY(name);
  for (let i = 0; i < times; i++) { await page.mouse.dblclick(x, y); await page.waitForTimeout(150); }
}
const st = (name) => name.evaluate(n => ({ editing: n.classList.contains('editing'), ce: n.contentEditable, text: n.textContent, pageName: window.state.pages[0].name, connected: n.isConnected, focused: document.activeElement === n }));
/** 바깥 클릭 — 이름 칸·항목이 아닌 빈 자리(캔버스 감싸개 왼쪽 아래 모서리) */
async function clickAway(page) {
  const [x, y] = await page.evaluate(() => { const w = document.getElementById('canvas-wrap') || document.body; const r = w.getBoundingClientRect(); return [r.left + 6, r.bottom - 6]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
}
async function keydownCount(page, name) {
  const cdp = await page.context().newCDPSession(page);
  await name.evaluate(n => { window.__rgN5Name = n; });
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__rgN5Name' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: 0 });
  await cdp.detach();
  return listeners.filter(l => l.type === 'keydown').length;
}

test('RG-N5 ㉠ [전제] 더블클릭 → 편집 중(.editing · contentEditable · 포커스)', async ({ page }) => {
  const { name } = await setup(page);
  await startEdit(page, name);
  const s = await st(name);
  expect({ editing: s.editing, ce: s.ce, focused: s.focused }).toEqual({ editing: true, ce: 'true', focused: true });
});

for (const exit of ['Enter', 'Escape', 'click-away']) {
  test(`RG-N5 ㉡ [새 것] 글자 «xy» 친 뒤 나가는 문 = ${exit} → 편집 끝 · 다음 손짓 g 가 안 섞임`, async ({ page }) => {
    const { name } = await setup(page);
    const orig = (await st(name)).pageName;
    await startEdit(page, name);
    await page.keyboard.press('End'); await page.keyboard.type('xy'); await page.waitForTimeout(100);
    if (exit === 'click-away') await clickAway(page); else { await page.keyboard.press(exit); await page.waitForTimeout(200); }
    const s = await st(name);
    const want = exit === 'Escape' ? orig : orig + 'xy';
    expect({ editing: s.editing, ce: s.ce, text: s.text, pageName: s.pageName }, `나간 뒤 · 원래 이름 «${orig}»`).toEqual({ editing: false, ce: 'false', text: want, pageName: want });
    await page.keyboard.press('g'); await page.waitForTimeout(150);
    expect((await st(name)).text, '다음 손짓이 이름에 안 섞임').toBe(want);
  });
}

test('RG-N5 ㉢ [새 것] 끝난 뒤(키 없이 바깥 클릭) — (ⅰ) Escape 보내도 이름 그대로 (ⅱ) 이름 칸 keydown 처리기 0', async ({ page }) => {
  const { name } = await setup(page);
  // 키 없이 바깥 클릭으로 끝낸다(옛 꼴이면 onKey 가 남는 길 — 첫 키에만 떨어지므로)
  await startEdit(page, name);
  await clickAway(page);
  const before = await st(name);
  expect(before.editing, '[전제] 편집이 끝났다').toBe(false);
  await name.evaluate(n => n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.waitForTimeout(150);
  const after = await st(name);
  expect({ text: after.text, pageName: after.pageName }, '(ⅰ) 끝난 뒤 Escape → 이름 그대로').toEqual({ text: before.text, pageName: before.pageName });
  expect(await keydownCount(page, name), '(ⅱ) 끝난 뒤 이름 칸 keydown 처리기 수').toBe(0);
});

test('RG-N5 ㉣ [새 것] 편집 중 더블클릭 ×3 → 바로 Enter → 끝 · 처리기 0 · 커밋 1 번', async ({ page }) => {
  const { name } = await setup(page);
  await startEdit(page, name, 3);
  const s0 = await page.evaluate(() => window.__saves);
  await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  const s = await st(name);
  const commits = await page.evaluate((s0) => window.__saves - s0, s0);
  expect({ editing: s.editing, ce: s.ce, listeners: await keydownCount(page, name), commits }).toEqual({ editing: false, ce: 'false', listeners: 0, commits: 1 });
});

test('RG-N5b [측정만 · 고치지 않음] 편집 중 Space/Enter 가 항목으로 버블 → switchPage 불림 · 공백이 들어가나', async ({ page }) => {
  const { name } = await setup(page);
  const orig = (await st(name)).pageName;
  await startEdit(page, name);
  await page.keyboard.press('End');
  const w0 = await page.evaluate(() => window.__switches);
  await page.keyboard.type('a b'); await page.waitForTimeout(150);
  const afterSpace = await st(name);
  const wSpace = await page.evaluate(() => window.__switches) - w0;
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const wEnter = await page.evaluate(() => window.__switches) - w0 - wSpace;
  const rec = { orig, typed: 'a b', textWhileEditing: afterSpace.text, spaceKept: afterSpace.text.endsWith('a b'), switchPageOnSpace: wSpace, switchPageOnEnter: wEnter, connected: (await st(name)).connected };
  test.info().annotations.push({ type: 'RG-N5b', description: JSON.stringify(rec) });
  console.log('[RG-N5b]', JSON.stringify(rec));
});
