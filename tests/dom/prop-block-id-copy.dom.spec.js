/* prop-block-id-copy.dom.spec.js — 블록 헤더의 «id 칸 복사»가 인라인 핸들러를 걷어낸
 * 뒤에도 여전히 «눌리는가». (T-049 덩이2 후속)
 *
 * ★왜 이 검사가 있나
 *   헤더 33벌을 _helpers.js 의 blockHeaderHTML 한 자리로 걷으면서
 *   `onclick="…('${id}')"`(HTML 속성 안의 인라인 JS 문자열)을 없애고
 *   `data-copy-id` + 문서 위임으로 바꿨다. 「문맥을 없앴다」는 소스로 잴 수 있지만
 *   「그래서 복사가 여전히 되는가」는 «눌러 봐야» 안다 — 안 되면 조용히 죽는다.
 *
 * ★두 축을 «둘 다» 센다
 *   ⑴ 양성 — 누르면 복사 함수가 그 id 로 «한 번» 불린다.
 *   ⑵ 음성 — 그 칸에 on* 속성이 «0개»다(인라인 JS 문맥이 실제로 사라졌다).
 *   ⑵ 만 재면 「없애기만 하고 안 이어 놓은」 상태가 초록이 된다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(tests/dom 규약).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js prop-block-id-copy
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-props.css"></head><body>
<div id="panel-right"><div class="panel-body"></div></div>
<script>
  window.__copied = [];
  window._copyToClipboard = (v) => window.__copied.push(v);
</script>
<script type="module">
  const H = await import('/js/props/_helpers.js');
  document.querySelector('#panel-right .panel-body').innerHTML =
    '<div class="prop-section">' + H.blockHeaderHTML({
      name: '가격표', defaultName: 'Block', crumb: '경로', id: 'blk_probe1',
    }) + '</div>';
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

test.describe('블록 헤더 id 칸 — 인라인 핸들러를 걷어내도 복사는 된다', () => {
  test('① 양성 — 누르면 그 id 로 복사가 «한 번» 불린다', async ({ page }) => {
    await boot(page);
    const badge = page.locator('#panel-right .prop-block-id');
    await expect(badge).toHaveText('blk_probe1');   // 칸이 안 그려졌으면 ②가 «허공»을 잰다
    await badge.click();
    expect(await page.evaluate(() => window.__copied)).toEqual(['blk_probe1']);
  });

  test('② 음성 — 그 칸에 on* 속성이 0개다 (인라인 JS 문맥이 사라졌다)', async ({ page }) => {
    await boot(page);
    const attrs = await page.evaluate(() => {
      const el = document.querySelector('#panel-right .prop-block-id');
      return el ? [...el.attributes].map(a => a.name) : null;
    });
    expect(attrs, 'id 칸 자체가 없다 — ①이 먼저 빨개져야 한다').not.toBeNull();
    expect(attrs.filter(n => /^on/i.test(n))).toEqual([]);
    expect(attrs).toContain('data-copy-id');
  });
});
