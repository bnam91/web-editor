/* settings-debug-tab.dom.spec.js — 톱니바퀴 「디버깅」 탭 (현빈 2026-09-19)
 *
 * ★진짜 index.html 마크업·CSS + 진짜 js/settings/settings-modal.js 를 크로미움에 얹고,
 *   main 쪽(electronAPI.devtools)만 «가짜»로 꽂는다. 판정·해시 검증은 main 이 하므로
 *   여기선 「화면이 main 의 답을 제대로 그리나 / 입력이 에디터로 새지 않나」를 잰다.
 *   (판정 자체는 tests/unit/devtools-gate.test.js 가 진짜 모듈로 잰다.)
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉.
 * 실행: npm run test:dom -- settings-debug-tab
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script>
  /* 가짜 main — 코드 «정답»은 여기 없다. 'GOOD' 이라는 임의 문자열만 받아 준다(평문 금지 규약). */
  window.__calls = { state: 0, unlock: [], open: 0 };
  window.__st = { allowed: false, reason: 'locked', packaged: true };
  window.__fails = 0;
  window.electronAPI = { devtools: {
    state:  async () => { window.__calls.state++; return { ...window.__st }; },
    unlock: async (code) => {
      window.__calls.unlock.push(code);
      if (code === 'GOOD') { window.__st = { allowed: true, reason: 'unlocked', packaged: true }; return { ok: true }; }
      window.__fails++;
      return { ok: false, reason: window.__fails >= 5 ? 'rate_limited' : 'bad_code' };
    },
    open: async () => { window.__calls.open++; return window.__st.allowed ? { ok: true } : { ok: false, reason: 'locked' }; },
  } };
  /* 에디터 전역 단축키 대역 — document «버블» 단계에서 키를 받으면 기록한다(Backspace = 블럭 삭제 자리). */
  window.__docKeys = [];
  document.addEventListener('keydown', (e) => window.__docKeys.push(e.key));
</script>
<script src="/js/settings/settings-modal.js"></script>
<script>window.__ready = true;</script></body>`);
})();

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && typeof window.openSettingsModal === 'function');
  await page.evaluate(() => window.openSettingsModal());
  await page.waitForSelector('#settings-modal .settings-tab[data-tab="debug"]');
  return errs;
}

test('DBG1 디버깅 탭은 눌리고, 개발자·협업 탭은 여전히 비활성', async ({ page }) => {
  const errs = await boot(page);
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('#settings-modal .settings-tab'))
    .map((b) => ({ tab: b.dataset.tab, disabled: b.disabled, text: b.textContent.trim() })));
  const dbg = tabs.find((t) => t.tab === 'debug');
  expect(dbg, '디버깅 탭이 없다').toBeTruthy();
  expect(dbg.text).toBe('디버깅');
  expect(dbg.disabled).toBe(false);
  expect(tabs.find((t) => t.tab === 'dev').disabled, '개발자 탭은 계속 비활성이어야 한다').toBe(true);

  await page.click('#settings-modal .settings-tab[data-tab="debug"]');
  await page.waitForSelector('[data-debug-code]');
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('.settings-pane-debug')).display);
  expect(vis).toBe('block');
  expect(await page.locator('[data-debug-state]').textContent()).toBe('잠김');
  const attrs = await page.evaluate(() => {
    const i = document.querySelector('[data-debug-code]');
    return { type: i.type, inputmode: i.getAttribute('inputmode'), ac: i.getAttribute('autocomplete') };
  });
  expect(attrs).toEqual({ type: 'password', inputmode: 'numeric', ac: 'off' });
  expect(await page.locator('[data-debug-open]').count(), '잠김인데 열기 버튼이 있다').toBe(0);
  expect(errs).toEqual([]);
});

test('DBG2 ★입력칸 키(Backspace·숫자)는 document 로 새지 않는다 — 에디터 블럭 삭제 방지 (양성대조 포함)', async ({ page }) => {
  await boot(page);
  await page.click('#settings-modal .settings-tab[data-tab="debug"]');
  await page.waitForSelector('[data-debug-code]');
  // 양성대조: 입력칸 «밖»의 키는 document 에 닿는다(대역 리스너가 산다)
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => window.__docKeys.includes('Backspace')), '대역 리스너가 죽어 있다 — 검사가 헛돈다').toBe(true);
  await page.evaluate(() => { window.__docKeys = []; });

  await page.click('[data-debug-code]');
  await page.keyboard.type('12');
  await page.keyboard.press('Backspace');
  expect(await page.inputValue('[data-debug-code]')).toBe('1');
  expect(await page.evaluate(() => window.__docKeys)).toEqual([]);
});

test('DBG3 틀린 코드 → 「코드가 맞지 않습니다」, 5회째 → 「잠시 후 다시 시도하세요」', async ({ page }) => {
  await boot(page);
  await page.click('#settings-modal .settings-tab[data-tab="debug"]');
  await page.waitForSelector('[data-debug-code]');
  await page.fill('[data-debug-code]', 'bad');
  await page.click('[data-debug-unlock]');
  await expect(page.locator('[data-debug-msg]')).toHaveText('코드가 맞지 않습니다');
  expect(await page.inputValue('[data-debug-code]'), '틀린 코드는 비운다').toBe('');
  for (let i = 0; i < 4; i++) {
    await page.fill('[data-debug-code]', 'bad' + i);
    await page.press('[data-debug-code]', 'Enter');   // Enter 로도 제출된다
  }
  await expect(page.locator('[data-debug-msg]')).toHaveText('잠시 후 다시 시도하세요');
  expect(await page.evaluate(() => window.__calls.unlock.length)).toBe(5);
});

test('DBG4 맞는 코드 → 상태 「이 세션에서 해제됨」 + [개발자 도구 열기] → main.open 호출', async ({ page }) => {
  await boot(page);
  await page.click('#settings-modal .settings-tab[data-tab="debug"]');
  await page.waitForSelector('[data-debug-code]');
  await page.fill('[data-debug-code]', 'GOOD');
  await page.click('[data-debug-unlock]');
  await page.waitForSelector('[data-debug-open]');
  await expect(page.locator('[data-debug-state]')).toContainText('이 세션에서 해제됨');
  expect(await page.locator('[data-debug-code]').count()).toBe(0);
  await page.click('[data-debug-open]');
  await expect.poll(() => page.evaluate(() => window.__calls.open)).toBe(1);
});

test('DBG5 관리자 계정 로그인 상태면 코드 입력 없이 「관리자 계정으로 허용됨」 + 열기 버튼 · 탭 진입마다 다시 묻는다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.__st = { allowed: true, reason: 'admin-email', packaged: true }; });
  await page.click('#settings-modal .settings-tab[data-tab="debug"]');
  await page.waitForSelector('[data-debug-open]');
  await expect(page.locator('[data-debug-state]')).toHaveText('관리자 계정으로 허용됨');
  const n1 = await page.evaluate(() => window.__calls.state);
  // 로그아웃 뒤 다시 들어오면 잠김으로 바뀌어야 한다
  await page.evaluate(() => { window.__st = { allowed: false, reason: 'locked', packaged: true }; });
  await page.click('#settings-modal .settings-tab[data-tab="api"]');
  await page.click('#settings-modal .settings-tab[data-tab="debug"]');
  await page.waitForSelector('[data-debug-code]');
  expect(await page.evaluate(() => window.__calls.state)).toBeGreaterThan(n1);
  await expect(page.locator('[data-debug-state]')).toHaveText('잠김');
});
