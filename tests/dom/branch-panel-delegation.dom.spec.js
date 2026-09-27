/* branch-panel-delegation.dom.spec.js — 브랜치 패널이 인라인 핸들러를 걷어낸 뒤에도
 * «눌리는가», 그리고 브랜치 이름이 화면에서 «글자로» 남는가. (T-049 덩이4)
 *
 * ★왜 이 검사가 있나
 *   이 축은 이스케이프로 못 닫힌다 — on* 속성값은 HTML 실체참조가 «먼저 풀린 뒤» JS 로
 *   읽히므로 따옴표를 실체참조로 바꿔도 인라인 JS 문자열이 안 닫힌다. 그래서 답이
 *   «핸들러 제거»였고, 제거는 «안 이어 놓으면» 조용히 죽는다. 둘 다 재야 한다:
 *     ① 양성 — 누르면 실제로 그 브랜치에 대해 동작이 일어난다(위임이 살아 있다)
 *     ② 음성 — 패널 안에 on* 속성이 0개다(인라인 JS 문맥이 사라졌다)
 *     ③ 회귀 — 따옴표·꺾쇠·한글·이모지가 든 «멀쩡한» 이름이 글자 그대로 보이고,
 *              그 이름에서 «생겨난 요소»가 0개다.
 *   ⛔공격 문자열은 안 쓴다 — 표식은 정의되지 않은 빈 커스텀 태그라 아무 것도 실행하지 않는다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(tests/dom 규약).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js branch-panel-delegation
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const PROBE_TAG = 'gd-nameprobe';
/* 「글자로 그려졌나 / 구조로 해석됐나」만 가르는 중립 표식 + 멀쩡한 이름들 */
const TRICKY = [
  `브랜치표식<${PROBE_TAG}></${PROBE_TAG}>끝`,
  '"큰" 따옴표',
  "작은 '따옴표'",
  'A & B 💡',
];

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-panels.css"></head><body>
<div id="canvas"><div id="canvas-wrap">
  <div class="section-block" id="sec_a"><span class="section-label">첫 섹션 &amp; "이름"</span></div>
</div></div>
<div id="focus-mode-bar" style="display:none"></div>
<div id="branch-dropdown-wrap"><div id="branch-dropdown-menu"></div></div>
<div id="branch-panel-body"></div>
<script>
  window.activeProjectId = null;     // getBranchKey 가 기본 키를 쓰게 한다
  window.IS_ELECTRON = false;        // _persistBranchesToFile 을 입구에서 끊는다
  window.__tabs = [];
  window.switchToTab = (t) => window.__tabs.push(t);
  window.__BRANCHES = ${JSON.stringify(TRICKY)};
</script>
<script type="module">
  await import('/js/branch-system.js');
  const store = { current: 'main', branches: { main: {}, dev: {} } };
  for (const n of window.__BRANCHES) store.branches[n] = { scope: ['sec_a'] };
  store.current = window.__BRANCHES[0];
  localStorage.setItem('web-editor-branches', JSON.stringify(store));
  window.renderBranchPanel();
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
}

test.describe('브랜치 패널 — 인라인 핸들러를 걷어내도 눌리고, 이름은 글자로 남는다', () => {
  test('① 양성 — 스코프 ✕ 를 누르면 «그 브랜치»의 스코프에서 그 섹션이 빠진다', async ({ page }) => {
    await boot(page);
    const cur = TRICKY[0];
    // 현재 브랜치의 행에만 ✕ 가 붙는다 — 먼저 «있다»를 확인해야 아래가 허공을 재지 않는다
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('web-editor-branches')).branches);
    expect(before[cur].scope).toEqual(['sec_a']);

    const x = page.locator('#branch-panel-body .branch-scope-remove');
    await expect(x).toHaveCount(1);
    await x.click();

    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('web-editor-branches')).branches);
    expect(after[cur].scope, '위임이 안 이어져 스코프가 그대로다').toEqual([]);
  });

  test('① 양성-b — 드롭다운 «브랜치 관리»도 위임으로 도달한다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.toggleBranchDropdown({ stopPropagation() {} }));
    await page.locator('#branch-dropdown-menu .branch-dd-manage').click();
    expect(await page.evaluate(() => window.__tabs)).toEqual(['branch']);
  });

  test('② 음성 — 패널·드롭다운 안에 on* 속성이 0개다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.toggleBranchDropdown({ stopPropagation() {} }));
    const found = await page.evaluate(() => {
      const out = [];
      for (const root of ['#branch-panel-body', '#branch-dropdown-menu']) {
        for (const el of document.querySelectorAll(`${root}, ${root} *`)) {
          for (const a of el.attributes) if (/^on/i.test(a.name)) out.push(`${root} ${el.className} ${a.name}`);
        }
      }
      return out;
    });
    expect(found).toEqual([]);
  });

  test('③ 회귀 — 멀쩡한/표식 든 이름이 글자 그대로 남고, 생겨난 요소는 0개다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.toggleBranchDropdown({ stopPropagation() {} }));
    const got = await page.evaluate((tag) => ({
      panel: [...document.querySelectorAll('#branch-panel-body .branch-item-name')].map(e => e.textContent),
      drop: [...document.querySelectorAll('#branch-dropdown-menu .branch-dd-item-name')].map(e => e.textContent),
      probeEls: document.querySelectorAll(`#branch-panel-body ${tag}, #branch-dropdown-menu ${tag}`).length,
      scopeLabel: document.querySelector('#branch-panel-body .branch-scope-tag')?.textContent ?? null,
    }), PROBE_TAG);

    for (const n of TRICKY) {
      expect(got.panel, `브랜치 패널에 «${n}» 이 원문 그대로 없다`).toContain(n);
      expect(got.drop, `드롭다운에 «${n}» 이 원문 그대로 없다`).toContain(n);
    }
    expect(got.probeEls, '이름에서 요소가 «생겨났다» — 구조로 해석된 것이다').toBe(0);
    // 섹션 이름표(사용자가 짓는 이름)도 글자로 들어간다 — ✕ 버튼 글자를 뺀 앞부분이 원문이다
    expect(got.scopeLabel.startsWith('첫 섹션 & "이름"')).toBe(true);
  });
});
