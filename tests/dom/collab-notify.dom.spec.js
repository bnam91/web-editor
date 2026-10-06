/* collab-notify — 협업 «배선»(2026-10-06 지디 발주 TWO ⒜): 진짜 index.html 에서
 *   ⑴ 공용 문장 표(js/collab/reasons.js)가 실린다
 *   ⑵ 사건을 듣는 단 하나의 자리(js/collab/notify.js)가 collabSync 에 «실제로» 붙어 사건을 듣는다
 *   ⑶ S7 술어(isSettingsTabEnabled)가 초대 배지 boot 시점(DOMContentLoaded)에 «이미» 닿는다
 *
 * ★하네스 = bootApp(진짜 index.html · electronAPI 는 null 을 돌려주는 가짜). 앱·포트·서버 0.
 * ⛔COLLAB_ENABLED·MVP_DISABLED_TABS 값은 건드리지 않는다 — 지금 값(false · ['dev','collab'])에서 잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('W1 — reasons.js 가 실리고 notify.js 가 collabSync 에 붙어 있다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({
    reasons: typeof window.CollabReasons?.text,
    notify: typeof window.collabNotify?.attached,
    attached: window.collabNotify?.attached?.(),
    sync: typeof window.collabSync?.onEvent,
    flag: window.COLLAB_ENABLED,
  }));
  expect(r.flag, '★전제: 킬스위치는 «꺼진 채» 잰다').toBe(false);
  expect(r.reasons).toBe('function');
  expect(r.sync, '★전제: sync.js 가 실렸다').toBe('function');
  expect(r.notify).toBe('function');
  expect(r.attached, 'notify.js 가 collabSync.onEvent 에 붙었다').toBe(true);
  expect(errs).toEqual([]);
});

test('W2 — notify.js 가 sync.js 의 사건을 «실제로» 듣는다(stop → stopped)', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    const before = window.collabNotify.heard().length;
    window.collabSync.stop();                       // _cfg 없이도 'stopped' 를 낸다(sync.js stop) — 서버·스위치 무관
    const after = window.collabNotify.heard();
    return { before, n: after.length, last: after[after.length - 1] };
  });
  expect(r.n, '들은 사건 수가 하나 늘었다').toBe(r.before + 1);
  expect(r.last.type).toBe('stopped');
  expect(r.last.cls).toBe('status');
});

test('W3 — S7 술어가 DOMContentLoaded 순간에 «이미» 정의돼 있다(배지 boot 가 그때 읽는다)', async ({ page }) => {
  /* 이 리스너는 addInitScript 라 «어느 스크립트보다 먼저» 붙는다 ⇒ 배지의 DOMContentLoaded 리스너보다 먼저 돈다.
   * 여기서 정의돼 있으면 배지가 읽을 때도 정의돼 있다(같은 사건 · 더 이른 순번). */
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      window.__s7AtDCL = {
        type: typeof window.isSettingsTabEnabled,
        collab: typeof window.isSettingsTabEnabled === 'function' ? window.isSettingsTabEnabled('collab') : null,
        api: typeof window.isSettingsTabEnabled === 'function' ? window.isSettingsTabEnabled('api') : null,
      };
    });
  });
  await bootApp(page);
  const r = await page.evaluate(() => ({ dcl: window.__s7AtDCL, inbox: window.collabInvites?.inboxOpen?.() }));
  expect(r.dcl, '★전제: DOMContentLoaded 에서 잰 값이 있다').toBeTruthy();
  expect(r.dcl.type).toBe('function');
  expect(r.dcl.collab, '협업 탭 = MVP 문 안(현빈 08-28) ⇒ 닫힘').toBe(false);
  expect(r.dcl.api, '음성대조: MVP 밖 탭은 열림').toBe(true);
  expect(r.inbox, '배지 술어 = COLLAB_ENABLED(false) && 탭 열림(false)').toBe(false);
});

test('W4 — 배지가 안 뜬다(문이 닫힌 동안 «못 받을 초대»를 알리지 않는다)', async ({ page }) => {
  await bootApp(page);
  const disp = await page.evaluate(() => getComputedStyle(document.getElementById('collab-invite-badge')).display);
  expect(disp).toBe('none');
});
