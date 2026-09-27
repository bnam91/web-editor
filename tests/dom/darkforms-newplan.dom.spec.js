/* darkforms-newplan.dom.spec.js — 0920b 두 건의 «그린 뒤».
 *
 *   tests/unit/darkforms-newplan.test.mjs 는 소스 문자열만 잰다.
 *   「브라우저가 라디오·체크박스를 진짜 다크로 계산하나」·「New Plan 을 진짜 눌러도 안 생기나」는
 *   크로미움이 «그린 뒤»에만 답이 나온다.
 *
 * ★하네스 = 진짜 pages/projects.html 그대로. window.electronAPI 만 메모리 목으로 갈아 끼운다.
 *   ★isAdmin: true — New Plan 버튼은 관리자에게만 «보인다»(projects.html 의 admin 게이트).
 *     비-admin 으로 재면 「안 보인다」와 「비활성이다」가 구분이 안 된다.
 *   ⛔앱을 «안» 띄운다 — 고디터 인스턴스 무접촉.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js darkforms-newplan
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function installMock() {
  window.__calls = [];
  const log = (name, arg) => { window.__calls.push({ name, arg: arg == null ? null : JSON.parse(JSON.stringify(arg)) }); };
  window.electronAPI = {
    isElectron: true,
    isAdmin: async () => true,
    listProjects: async () => [],
    trashList: async () => ({ ok: true, items: [] }),
    getAuthState: async () => ({ signedIn: false }),
    saveProject: async (p) => { log('saveProject', { id: p.id }); return { ok: true }; },
    folders: { list: async () => ({ ok: true, folders: [] }) },
  };
}

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.addInitScript(installMock);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => document.getElementById('btn-new-planning')
    && getComputedStyle(document.getElementById('btn-new-planning')).display !== 'none');
  return errs;
}

/* ── ① 다크 색 체계 ────────────────────────────────────────────────────────── */

test('①-1 문서의 색 체계가 dark 다 — :root·body 둘 다', async ({ page }) => {
  await boot(page);
  const cs = await page.evaluate(() => ({
    root: getComputedStyle(document.documentElement).colorScheme,
    body: getComputedStyle(document.body).colorScheme,
  }));
  expect(cs.root).toBe('dark');
  expect(cs.body).toBe('dark');   // 상속으로 내려간다 — 개별 선언 없이도 전 요소가 받는다
});

test('①-2 «체크 안 된» 라디오·체크박스가 다크로 계산된다 (앱 CSS 를 그대로 입은 채)', async ({ page }) => {
  await boot(page);
  const got = await page.evaluate(() => {
    // 우측 패널의 그 모양 그대로 — .prop-radio 안의 bare radio(js/props/prop-page.js:255)
    const host = document.createElement('div');
    host.innerHTML = '<label class="prop-radio"><input type="radio" name="t"></label>'
                   + '<label class="prop-none-check"><input type="checkbox"></label>'
                   + '<input type="checkbox">';
    document.body.appendChild(host);
    const [radio, check, bare] = host.querySelectorAll('input');
    const out = {
      radio: getComputedStyle(radio).colorScheme,
      check: getComputedStyle(check).colorScheme,
      bare: getComputedStyle(bare).colorScheme,
      // accent-color 는 «지정하지 않는다»는 선례(css/release-note.css:85~94)와 어긋나지 않는지 —
      // .prop-radio 는 체크된 색만 정하고, 안 체크된 동그라미 색은 색 체계가 정한다.
      radioAppearance: getComputedStyle(radio).appearance,
    };
    host.remove();
    return out;
  });
  expect(got.radio).toBe('dark');
  expect(got.check).toBe('dark');
  expect(got.bare).toBe('dark');
  expect(got.radioAppearance).toBe('auto');   // 네이티브로 그린다 = 색 체계가 색을 정한다
});

/* 저장된 «기획» 프로젝트 id 만 추린다 — 부팅 때 도는 initSampleProject(proj_sample)와 섞이지 않게. */
const plansSaved = (page) => page.evaluate(() =>
  window.__calls.filter((c) => c.name === 'saveProject' && /^plan_/.test(c.arg && c.arg.id)).map((c) => c.arg.id));

/* ── ② New Plan 비활성 ──────────────────────────────────────────────────────── */

test('②-1 관리자에게 «보이되» 비활성이다 — aria-disabled·흐림·이유 툴팁, disabled 속성은 안 쓴다', async ({ page }) => {
  await boot(page);
  const b = page.locator('#btn-new-planning');
  await expect(b).toBeVisible();                       // 숨기는 게 아니라 «비활성»이다
  await expect(b).toHaveAttribute('aria-disabled', 'true');
  const got = await b.evaluate((el) => ({
    disabledAttr: el.hasAttribute('disabled'),
    onclick: el.getAttribute('onclick'),
    title: el.getAttribute('title'),
    opacity: getComputedStyle(el).opacity,
    cursor: getComputedStyle(el).cursor,
  }));
  expect(got.disabledAttr).toBe(false);                // disabled 면 hover 가 안 와 툴팁이 안 뜬다
  expect(got.onclick).toBe(null);
  expect(got.title).toMatch(/준비 중/);
  expect(Number(got.opacity)).toBeLessThan(1);         // 흐림 — 폴더 메뉴 비활성과 같은 규율
  expect(got.cursor).toBe('not-allowed');
});

test('②-2 진짜로 눌러도 프로젝트가 안 생기고 페이지도 안 옮겨간다', async ({ page }) => {
  const errs = await boot(page);
  const before = page.url();
  await page.click('#btn-new-planning', { force: true });
  await page.waitForTimeout(300);
  expect(page.url()).toBe(before);
  // ★saveProject «호출 유무»로 재면 틀린다 — 부팅 때 initSampleProject 가 이미 한 번 부른다(proj_sample).
  //   재야 할 양은 «기획(plan_*) 프로젝트가 저장됐는가»다.
  expect(await plansSaved(page)).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('②-3 화면을 우회해 함수를 직접 불러도 안 생긴다 (입구가 하나여야 한다)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.createPlanningProject && window.createPlanningProject());
  await page.waitForTimeout(300);
  expect(await plansSaved(page)).toEqual([]);
  expect(page.url()).toContain('/pages/projects.html');
});
