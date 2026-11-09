/* settings-higgsfield.dom.spec.js — 환경설정 «API 토큰» 탭의 Higgsfield 키·모델 (t2-03 · 0.9.11)
 *
 * ★진짜 index.html 마크업·CSS + 진짜 settings-store.js·settings-modal.js 에 main 쪽만 «가짜»로 꽂는다
 *   (settings-debug-tab.dom.spec.js 꼴). 암호화 자체는 tests/unit/higgsfield-key.test.js 가 진짜 모듈로 잰다.
 * ★지디 보안 기준: 흐름 뒤 pane innerHTML·localStorage·sessionStorage·window._settings·console 어디에도 전체 키가 없다.
 * ⛔앱을 «안» 띄운다. 키는 가짜(hf_TESTKEY_…).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };
const KEY = 'hf_TESTKEY_abcd1234';

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script>
  /* 가짜 main — 키는 «클로저 안»에만 둔다(window 를 훑는 검사가 가짜 자신을 잡지 않게). */
  window.__calls = { set: 0, clear: 0, patches: [] };
  (function () {
    let stored = '', hfModel = '';
    const st = () => stored ? { hasKey: true, masked: '••••' + stored.slice(-4) } : { hasKey: false, masked: '' };
    window.electronAPI = {
      getSettings: async () => ({ apiKeys: {}, shortcuts: {}, easterEggs: {}, higgsfieldModel: hfModel }),
      setSettings: async (patch) => { window.__calls.patches.push(JSON.parse(JSON.stringify(patch))); if ('higgsfieldModel' in patch) hfModel = patch.higgsfieldModel; return { ...patch }; },
      higgsfield: {
        status:   async () => st(),
        setKey:   async (k) => { window.__calls.set++; stored = String(k).trim(); return { ok: true, ...st() }; },
        clearKey: async () => { window.__calls.clear++; stored = ''; return { ok: true, ...st() }; },
      },
    };
  })();
  /* console 대역 — 화면 코드가 찍는 것을 모은다 */
  window.__logs = [];
  ['log', 'info', 'warn', 'error', 'debug'].forEach((m) => { const o = console[m]; console[m] = (...a) => { window.__logs.push(a.map(String).join(' ')); o.apply(console, a); }; });
</script>
<script src="/js/settings/settings-store.js"></script>
<script src="/js/settings/settings-modal.js"></script>
<script>window.__ready = true;</script></body>`);
})();

async function boot(page) {
  const errs = [];
  const pageLogs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => pageLogs.push(m.text()));
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
  await page.waitForFunction(() => window.__ready === true && typeof window.openSettingsModal === 'function' && !!window._settings);
  await page.evaluate(() => window.openSettingsModal());
  await page.waitForSelector('.settings-api-row[data-provider="higgsfield"]');
  return { errs, pageLogs };
}

const ROW = '.settings-api-row[data-provider="higgsfield"]';

test('HF1 키 저장·삭제 흐름 + ★전체 키가 화면·저장소·console 어디에도 없다', async ({ page }) => {
  const { errs, pageLogs } = await boot(page);
  const input = page.locator(`${ROW} input.settings-api-input`);
  const save = page.locator(`${ROW} [data-hf-save]`);
  const del = page.locator(`${ROW} [data-hf-clear]`);
  const status = page.locator(`${ROW} .settings-api-status`);

  expect(await input.getAttribute('type')).toBe('password');
  expect(await input.getAttribute('placeholder')).toBe('Higgsfield API 키');
  await expect(del).toBeHidden();
  expect(await page.locator(`${ROW} .settings-api-eye`).count(), '눈 단추는 없다(Q2)').toBe(0);
  expect(await page.locator(`${ROW} [data-action="test"]`).count(), '테스트 단추는 없다(Q2)').toBe(0);

  await input.fill(KEY);
  await save.click();
  await expect(status).toHaveText('✓ 저장됨 ••••1234');
  expect(await page.evaluate(() => window.__calls.set)).toBe(1);
  expect(await input.inputValue(), '저장 뒤 칸을 비운다').toBe('');
  expect(await input.getAttribute('placeholder')).toBe('••••1234');
  await expect(del).toBeVisible();
  expect(await page.locator('.settings-pane-api').innerHTML()).not.toContain(KEY);

  // 모델 + footer 저장 → settings:set 패치
  const model = page.locator(`${ROW} select.settings-api-input`);
  expect(await model.locator('option').evaluateAll((os) => os.map((o) => [o.value, o.textContent])), '현빈 7271 목록 · 기본 (미선택)').toEqual([
    ['', '(미선택)'], ['gpt_image_2_6', 'GPT Image 2.6'], ['flux_3_image', 'FLUX 3 Image'],
    ['seedream_v5_pro', 'Seedream 5.0 Pro'], ['flux_2', 'FLUX.2'], ['marketing_studio_image', 'Marketing Studio Image']]);
  expect(await model.inputValue()).toBe('');
  await model.selectOption('flux_2');
  await page.click('#settings-save-btn');
  await expect.poll(() => page.evaluate(() => window.__calls.patches.length)).toBe(1);
  const patch = await page.evaluate(() => window.__calls.patches[0]);
  expect(patch).toHaveProperty('higgsfieldModel', 'flux_2');
  expect(JSON.stringify(patch)).not.toContain(KEY);

  // 다시 열어 삭제
  await page.evaluate(() => window.openSettingsModal());
  await expect(status).toHaveText('✓ 저장됨 ••••1234');
  await expect(model, '저장한 모델이 다시 열어도 골라져 있다').toHaveValue('flux_2');
  await del.click();
  await expect(del).toBeHidden();
  await expect(status).toHaveText('');
  expect(await page.evaluate(() => window.__calls.clear)).toBe(1);
  expect(await input.getAttribute('placeholder')).toBe('Higgsfield API 키');

  const scan = await page.evaluate(() => JSON.stringify({
    ls: Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]),
    ss: Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)]),
    settings: window._settings,
    logs: window.__logs,
    html: document.documentElement.outerHTML,
  }));
  expect(scan, '전체 키가 localStorage·sessionStorage·_settings·console·DOM 어딘가에 있다').not.toContain(KEY);
  expect(pageLogs.join('\n')).not.toContain(KEY);
  expect(errs).toEqual([]);
});

test('HF2 디자인 parity — 새 줄의 입력·단추 글꼴·크기·여백이 기존 OpenAI 줄과 같다', async ({ page }) => {
  await boot(page);
  const css = (sel) => page.evaluate((s) => {
    const c = getComputedStyle(document.querySelector(s));
    return { fs: c.fontSize, ff: c.fontFamily, pad: c.padding, h: c.height, bg: c.backgroundColor, br: c.borderRadius, color: c.color };
  }, sel);
  expect(await css(`${ROW} input.settings-api-input`)).toEqual(await css('.settings-api-row[data-provider="openai"] input.settings-api-input'));
  expect(await css(`${ROW} [data-hf-save]`)).toEqual(await css('.settings-api-row[data-provider="openai"] [data-action="test"]'));
  const lab = (sel) => page.evaluate((s) => { const c = getComputedStyle(document.querySelector(s)); return [c.fontSize, c.color]; }, sel);
  expect(await lab(`${ROW} .settings-api-label`)).toEqual(await lab('.settings-api-row[data-provider="openai"] .settings-api-label'));
});
