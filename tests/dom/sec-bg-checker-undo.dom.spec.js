/* sec-bg-checker-undo.dom.spec.js — 현빈 2026-09-30 sec_owr55_db0u7q8
 *   「체크배경으로 두기를 눌렀는데 체크배경이 안 된다 · 투명으로 했는데 ⌘Z 가 안 된다」
 *
 * ★양성대조의 판 = 착수 직전 origin/dev **d82a6221** (⛔HEAD 아님).
 *   그 판에서 «빨강이어야 하는» 시험: S1 S2 A1
 *   실행: SBC_ROOT=<d82a6221 판 루트> npx playwright test … sec-bg-checker-undo
 * ⛔앱을 «안» 띄운다.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SBC_ROOT || path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
if (process.env.SBC_ROOT) console.warn(`[sec-bg-checker-undo] ★양성대조 모드 — ${ROOT}`);

async function boot(page, body) {
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/__h.html') return r.fulfill({ contentType: 'text/html', body });
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(f) });
  });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  return errs;
}

test('S1 ★체크 배경 — 색이 있어 인라인 background-image:none 이 박힌 섹션에서도 무늬가 깔린다', async ({ page }) => {
  await boot(page, `<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="/css/editor-base.css"><link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
    <!-- 체커 색은 editor-base.css :root 의 --goya-checker-* 토큰이다(S1 선행, 2026-10-04) — 토큰 파일 없이 blocks 만 얹으면 var() 가 비어 무늬가 사라진다(이 시험이 그걸 잡았다). -->
    <div class="section-block sec-bg-empty" id="s1" data-bg="rgba(255,255,255,0)" data-bg-img-empty="1"
         style="height:200px;background-image:none;background-color:rgba(255,255,255,0)"></div>
    <div class="section-block" id="s0" style="height:200px;background-image:none"></div>
    <script>window.__ready = true;</script></body></html>`);
  const r = await page.evaluate(() => ['s1', 's0'].map(id => getComputedStyle(document.getElementById(id)).backgroundImage));
  expect(r[0], '★클래스가 켜졌는데 무늬가 없다(규칙 부재 또는 인라인에 짐)').toMatch(/repeating-conic-gradient/);
  expect(r[1]).toBe('none');
});

test('S2 체크 배경은 편집 전용 — 캡처 클론(루트·자손)에서 클래스를 뗀다', async ({ page }) => {
  await boot(page, `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="canvas"><div class="section-block sec-bg-empty" id="s1"></div></div>
    <script type="module">
      const C = await import('/js/io/capture-safety.js');
      const root = document.getElementById('s1').cloneNode(true); C.stripEditorOnlyForCapture(root);
      const all = document.getElementById('canvas').cloneNode(true); C.stripEditorOnlyForCapture(all);
      window.__r = { root: root.classList.contains('sec-bg-empty'), kids: all.querySelectorAll('.sec-bg-empty').length,
                     live: document.querySelectorAll('.sec-bg-empty').length };
      window.__ready = true;
    </script></body></html>`);
  const r = await page.evaluate(() => window.__r);
  expect(r.root, '섹션 하나 클론(PNG 경로)').toBe(false);
  expect(r.kids, '캔버스 전체 클론(썸네일·HTML 경로)').toBe(0);
  expect(r.live, '라이브(저장 대상)는 안 건드린다').toBe(1);
});

test('A1 ★색 칸 투명도에서 Enter = 확정 1번 + 포커스 빠짐 ⇒ 이어 누른 ⌘Z 가 편집기로 간다', async ({ page }) => {
  await boot(page, `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <div id="host"></div>
    <script type="module">
      const P = await import('/js/props/color-picker.js');
      document.getElementById('host').innerHTML = P.colorFieldHTML({ idPrefix: 'tst', hex: '#ffffff', alpha: 100 });
      window.__commits = 0;
      P.wireColorField('tst', { initialAlpha: 100, onApply: () => {}, onCommit: () => window.__commits++ });
      window.__ready = true;
    </script></body></html>`);
  const a = page.locator('#tst-alpha');
  await a.click();
  await a.fill('0');
  await page.keyboard.press('Enter');
  const r = await page.evaluate(() => ({ commits: window.__commits, focus: document.activeElement?.id || '' }));
  expect(r.focus, '★Enter 뒤에도 투명도 칸에 포커스가 남으면 editor.js 가 ⌘Z 를 돌려보낸다').not.toBe('tst-alpha');
  expect(r.commits, '확정은 정확히 한 번(되돌리기 한 칸)').toBe(1);
});
