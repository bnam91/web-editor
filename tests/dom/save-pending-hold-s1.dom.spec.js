/* save-pending-hold-s1 — 자동저장 «대기 중에만» 창 억제를 푼다(S1, 2026-10-03 지디 «저장 대기 중에만»으로 좁힘)
 * 이 시험은 «렌더러 쪽 되돌림»을 잰다: 저장이 어떻게 끝나든(성공·실패·건너뜀·예외) setSavePending(false) 가 마지막에 온다.
 *   ★지디 조건 ①: 「풀렸다가 안 돌아오는」 꼴 = 12% 상시 세금(실측: 억제 끔 숨긴 앱 %CPU 평균 12.2 · 켬 0.06) ⇒ 실패 주입으로 잰다.
 * ⛔못 재는 축: 메인의 상한 타이머(SAVE_PENDING_MAX_MS)·창 파괴 정리 — Electron 메인이라 하네스 밖(실앱 측정은 커밋 본문).
 * 양성대조: 4ba5c791(상시 끔 판)에는 setSavePending 호출 자체가 없다 → S0~S4 빨강 · bf9161d0 도 같다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, saveImpl) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await bootApp(page);
  await page.evaluate((impl) => {
    window.__sp = [];
    const api = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (_, k) => {
      if (k === 'setSavePending') return (on) => window.__sp.push(!!on);
      if (k === 'saveProject') return (p) => (impl === 'reject' ? Promise.reject(new Error('주입 실패')) : impl === 'fail' ? Promise.resolve({ ok: false, reason: 'EACCES' }) : Promise.resolve({ ok: true }));
      return api[k];
    } });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sP" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;"><div class="gap-block" data-type="gap" id="gP" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    window.activeProjectId = 'proj_s1test';
  }, saveImpl);
}
const settle = (page) => expect.poll(() => page.evaluate(() => window._holdBackgroundForTest()), { timeout: 8000 }).toBe(false);

for (const [name, impl] of [['성공', 'ok'], ['ok:false 실패', 'fail'], ['예외(reject) 실패 주입', 'reject']])
  test(`S0 [${name}] 저장 대기에 풀고(true) 끝나면 반드시 되돌린다(false)`, async ({ page }) => {
    await setup(page, impl);
    await page.evaluate(() => window.scheduleAutoSave());
    expect(await page.evaluate(() => window._holdBackgroundForTest()), '★타이머를 걸 때 안 풀었다').toBe(true);
    await settle(page);
    const sp = await page.evaluate(() => window.__sp);
    expect(sp[0], '처음은 true').toBe(true);
    expect(sp[sp.length - 1], `★마지막이 false 가 아니다 — 풀린 채 남는다: ${JSON.stringify(sp)}`).toBe(false);
  });
test('S1 연타(디바운스 중 재호출) — true 는 한 번, 마지막에 false 한 번', async ({ page }) => {
  await setup(page, 'ok');
  await page.evaluate(async () => { for (let i = 0; i < 5; i++) { window.scheduleAutoSave(); await new Promise(r => setTimeout(r, 200)); } });
  await settle(page);
  expect(await page.evaluate(() => window.__sp)).toEqual([true, false]);
});
test('S2 건너뜀(빈 캔버스) 길에서도 되돌린다', async ({ page }) => {
  await setup(page, 'ok');
  await page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach(s => s.remove()); window.scheduleAutoSave(); });
  await settle(page);
  expect(await page.evaluate(() => window.__sp.slice(-1)[0])).toBe(false);
});
test('S3 건너뜀(타이머 사이 탭 전환) 길에서도 되돌린다', async ({ page }) => {
  await setup(page, 'ok');
  await page.evaluate(() => { window.scheduleAutoSave(); window.activeProjectId = 'proj_other'; });
  await settle(page);
  expect(await page.evaluate(() => window.__sp.slice(-1)[0])).toBe(false);
});
test('S4 직렬화 예외 길에서도 되돌린다', async ({ page }) => {
  await setup(page, 'ok');
  // 저장 직전 동기 구간의 localStorage.setItem 이 던지게 주입(용량 초과 꼴) — 저장 약속에 «넘기기 전» 예외
  await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).includes('proj_s1test')) throw new Error('주입 QuotaExceeded'); return o.call(this, k, v); }; window.scheduleAutoSave(); });
  await page.waitForTimeout(2200);
  const hold = await page.evaluate(() => window._holdBackgroundForTest());
  expect(hold, '★직렬화가 던지면 풀린 채 남는다').toBe(false);
});
