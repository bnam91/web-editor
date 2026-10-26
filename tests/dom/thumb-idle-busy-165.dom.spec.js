/* thumb-idle-busy-165.dom.spec.js — 별건 165 썸네일 html2canvas 가 «바쁠 때» 메인을 잡음 · ㉠+㉡(지디 21:21) · 범위 = «언제»만
 *
 * ★잰 값(S3 실앱 fa57bed6 · 수지 사본 sha256 22d1bbcce7bd1933 · 스택 = async _runIdleThumbnail save-load.js:460):
 *   ✕ → ⌘Z 장면 — 썸네일 캡처 둘이 겹침(둘째 시작 38.3s < 첫째 끝 57.6s) / 행 거터 끌기 장면 — 마우스 눌린 채 캡처 시작.
 *   ⇒ 길을 안 타서가 아니라 idle 길(scheduleIdleThumbnail)이 «바쁨»을 안 봤다.
 * ★처방 — js/io/save-load.js scheduleIdleThumbnail 의 fire·go: 바쁨(_autoSaveDeferred · state._suppressAutoSave · _thumbRunning)이면
 *   찍지 않고 THUMB_IDLE_MS 뒤 다시 본다(«버리지 않고 미룬다» 꼴) · _runIdleThumbnail 은 도는 동안 _thumbRunning(finally 로 내림).
 *
 * ★칸
 *   C1 ⑴ 캡처 안 겹침 — 첫 캡처가 도는 중에 편집(scheduleIdleThumbnail)이 와도 둘째 캡처가 «같이» 시작하지 않는다
 *   B1 ⑵ 끄는 중(deferAutoSave) 안 찍음 → 놓은 뒤(resumeAutoSave) 찍힘
 *   B2 ⑵ 억제 창(state._suppressAutoSave — ⌘Z 복원이 여는 창) 안 찍음 → 창 닫힌 뒤 찍힘
 *   N1 (음성대조) 바쁘지 않으면 «여전히» 찍힌다 · 미룸 0
 * ★«아무 일 없음»을 고정 대기로 재지 않는다 — save-load.js 의 fire·go 가 거는 8000ms 타이머(= «미뤘다», postpones)를 센다.
 *   ⚠️8000ms 를 «전부» 세면 안 된다(첫 판 실측): 섹션 삽입 → 자동저장 → scheduleIdleThumbnail 도 같은 8000ms 를 건다 — 그걸 미룸으로 읽어 B1·B2 가 옛 판에서 거짓 초록이었다.
 * ⚠️못 재는 축: 진짜 ⌘Z 의 억제 창은 «동기 복원 + rAF 한 번»이라 fire 가 그 안에 들지 «경합»이다 → 그 장면은 실앱 값으로만(보고서).
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { INSTALL_FAKE_META_SRC } = require('./_fake-meta.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((src) => {
    (new Function(src))();
    window.activeProjectId = 'pA'; window.__meta.pA = {};
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sT" data-section="1"><div class="section-inner"><div class="gap-block" data-type="gap" style="height:120px"></div></div></div>');
    /* 썸네일 캡처만 센다(captureThumbnail 스택) · hold 면 풀어 줄 때까지 붙잡아 «오래 걸리는 캡처»를 만든다 */
    const T = window.__t165 = { caps: [], live: 0, maxLive: 0, postpones: 0, hold: false, waiters: [] };
    const h2 = window.html2canvas;
    window.html2canvas = function (...a) {
      if (!String(new Error().stack).includes('captureThumbnail')) return h2.apply(this, a);
      const rec = { start: performance.now(), end: null, deferred: window.__autoSaveDeferState().deferred, suppressed: !!window.state._suppressAutoSave };
      T.caps.push(rec); T.live++; T.maxLive = Math.max(T.maxLive, T.live);
      const gate = T.hold ? new Promise((r) => T.waiters.push(r)) : Promise.resolve();
      return gate.then(() => h2.apply(this, a)).finally(() => { T.live--; rec.end = performance.now(); });
    };
    T.release = () => { T.hold = false; T.waiters.splice(0).forEach((r) => r()); };
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms, ...rest) { if (ms === 8000 && /at (fire|go) \([^)]*save-load\.js/.test(String(new Error().stack))) T.postpones++; return st.call(this, fn, ms, ...rest); };
  }, INSTALL_FAKE_META_SRC);
  return errs;
}
const S = (page) => page.evaluate(() => { const T = window.__t165; return { caps: T.caps.length, live: T.live, maxLive: T.maxLive, postpones: T.postpones, first: T.caps[0] || null }; });
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 25000, polling: 100 });

test('C1 ⑴ 첫 캡처가 도는 중 편집이 와도 둘째 캡처가 같이 시작하지 않는다', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await setup(page);
  await page.evaluate(() => { window.__t165.hold = true; window.scheduleIdleThumbnail(); });
  await until(page, () => window.__t165.caps.length === 1);
  expect((await S(page)).live, '전제: 첫 캡처가 붙잡혀 도는 중').toBe(1);
  await page.evaluate(() => window.scheduleIdleThumbnail());   // 캡처 도중 편집
  await until(page, () => window.__t165.postpones > 0 || window.__t165.caps.length > 1);
  const s = await S(page);
  expect({ caps: s.caps, maxLive: s.maxLive }, 'C1 겹침 0 — 도는 중이면 미룸').toEqual({ caps: 1, maxLive: 1 });
  await page.evaluate(() => window.__t165.release());
  await until(page, () => window.__t165.caps[0].end != null);
  expect(errs).toEqual([]);
});

test('B1 ⑵ 끄는 중(deferAutoSave)엔 안 찍고 · 놓은 뒤 찍힌다', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await setup(page);
  await page.evaluate(() => { window.scheduleIdleThumbnail(); window.deferAutoSave(); });   // 끌기 «전»에 걸린 타이머 → 끌기 시작
  await until(page, () => window.__t165.postpones > 0 || window.__t165.caps.length > 0);
  const s1 = await S(page);
  expect({ caps: s1.caps, deferred: s1.first?.deferred ?? null }, 'B1 끄는 중 캡처 0').toEqual({ caps: 0, deferred: null });
  const tUp = await page.evaluate(() => { window.resumeAutoSave(); return performance.now(); });
  await until(page, () => window.__t165.caps.length > 0);
  const s2 = await S(page);
  expect({ afterUp: s2.first.start > tUp, deferred: s2.first.deferred }, 'B1 놓은 뒤 찍힘').toEqual({ afterUp: true, deferred: false });
  expect(errs).toEqual([]);
});

test('B2 ⑵ 억제 창(⌘Z 복원이 여는 _suppressAutoSave) 안엔 안 찍고 · 닫힌 뒤 찍힌다', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await setup(page);
  await page.evaluate(() => { window.scheduleIdleThumbnail(); window.state._suppressAutoSave = true; });
  await until(page, () => window.__t165.postpones > 0 || window.__t165.caps.length > 0);
  const s1 = await S(page);
  expect({ caps: s1.caps, suppressed: s1.first?.suppressed ?? null }, 'B2 억제 창 안 캡처 0').toEqual({ caps: 0, suppressed: null });
  const tOpen = await page.evaluate(() => { window.state._suppressAutoSave = false; return performance.now(); });
  await until(page, () => window.__t165.caps.length > 0);
  const s2 = await S(page);
  expect({ afterOpen: s2.first.start > tOpen, suppressed: s2.first.suppressed }, 'B2 닫힌 뒤 찍힘').toEqual({ afterOpen: true, suppressed: false });
  expect(errs).toEqual([]);
});

test('N1 (음성대조) 바쁘지 않으면 여전히 찍힌다 · 미룸 0 · meta 에 실림', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await setup(page);
  await page.evaluate(() => window.scheduleIdleThumbnail());
  await until(page, () => window.__t165.caps.length > 0 && window.__t165.caps[0].end != null && typeof window.__meta.pA.thumbnail === 'string');
  const s = await S(page);
  expect({ caps: s.caps, postpones: s.postpones, maxLive: s.maxLive }, 'N1 한 번 · 미룸 0').toEqual({ caps: 1, postpones: 0, maxLive: 1 });
  expect(errs).toEqual([]);
});
