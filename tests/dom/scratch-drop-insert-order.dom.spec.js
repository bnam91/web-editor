/* scratch-drop-insert-order.dom.spec.js — D6 / E162 (lane-drag · 2026-10-05 · 현빈 «내가 놓은 자리에 추가되어야지»)
 *
 * 노트패널 이미지를 섹션 «블록 사이»에 놓으면 섹션 «맨 끝»에 들어갔다(실앱 실측 z40·z100: A 아래 75% · B 가운데 등 5/12).
 * 기구(계측 ㉠): 미리보기(previewScratchDropAt)가 섹션 inner 에 안내선 `.sp2c-insert-indicator` 를 꽂는다 → 놓을 때 commit 의
 *   getDragAfterElement(inner) 가 그 «안내선»을 기준으로 돌려준다(.drop-indicator 만 걸렀다) → 곧이은 _clearGuides 가 안내선을 떼고
 *   → `after.parentNode === inner` 가드에서 떨어져 appendChild = 맨 끝.
 * ⒡1 = 거르개에 `.sp2c-insert-indicator` 를 더한다(«안내선은 기준이 아니다» — .drop-indicator 와 같은 까닭).
 *
 * ⛔앱을 «안» 띄운다 — section-drag.js(getDragAfterElement) · canvas-scratch-drop.js 를 진짜 모듈로 얹고, 사람 손과 같은 순서
 *   (미리보기 → 놓기)로 «진짜» previewScratchDropAt · commitScratchDropAt 를 부른다. makeAssetBlock 만 가짜(그릇만 돌려줌).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/scratch-drop-insert-order.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 실앱 장면 꼴: section-inner 직속 [gap · A글자프레임 · gap · B · gap · C · gap] (글 6번 반복 = 키 큰 글자) */
const TB = (k) => `<div class="frame-block" id="tf${k}" data-text-frame="true" style="width:100%"><div class="text-block" id="tb${k}"><div class="tb-body">${('블럭 ' + k + ' ').repeat(30)}</div></div></div>`;
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; font: 20px/1.5 sans-serif; }
  #canvas-wrap { position:relative; width:1000px; height:1400px; background:#555; }
  .section-block { position:relative; width:800px; background:#fff; }
  .section-inner { padding: 0 72px; display:flex; flex-direction:column; }
  .gap-block { height: 24px; }
  .sp2c-insert-indicator { height: 2px; background: #6c5ce7; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner" id="inner">
    <div class="gap-block" id="g0"></div>${TB('A')}<div class="gap-block" id="g1"></div>${TB('B')}<div class="gap-block" id="g2"></div>${TB('C')}<div class="gap-block" id="g3"></div>
  </div></div>
</div></div></div>
<script>
  window.state = { pageSettings: { padX: 72 } };
  window.makeAssetBlock = () => { const row = document.createElement('div'); row.className = 'row'; row.id = 'row_new'; const block = document.createElement('div'); block.className = 'asset-block'; block.id = 'ab_new'; block.style.height = '40px'; row.appendChild(block); return { row, block }; };
  window.applyPadXToSection = () => {}; window.setAssetImageFromSrc = () => {}; window.buildLayerPanel = () => {}; window.bindBlock = () => {};
</script>
<script type="module">
  import '/js/section-drag.js';            // window.getDragAfterElement
  import '/js/canvas-scratch-drop.js';     // window.previewScratchDropAt · commitScratchDropAt
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && typeof window.commitScratchDropAt === 'function' && typeof window.getDragAfterElement === 'function');
  return errs;
}

/** 사람 순서: 놓을 점 위에서 미리보기(dragover 가 하는 일) 한 번 → 같은 점에서 놓기. 새 그림 앞뒤 이웃을 돌려준다. */
async function dropAt(page, aim) {
  return page.evaluate((aim) => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const A = r('tfA'), B = r('tfB'), C = r('tfC');
    const y = aim === 'A-lower75' ? A.top + A.height * 0.75 : aim === 'A-upper25' ? A.top + A.height * 0.25
            : aim === 'B-center' ? B.top + B.height / 2 : (B.bottom + C.top) / 2;
    const x = A.left + A.width / 2;
    const kind = window.previewScratchDropAt(x, y);
    const ind = document.querySelector('.sp2c-insert-indicator');
    const ok = window.commitScratchDropAt(x, y, 'data:image/png;base64,AA');
    const row = document.getElementById('row_new');
    const ids = [...document.getElementById('inner').children].map(e => e.id).filter(i => !/^g\d$/.test(i));
    return { kind, indicatorWasAt: ind ? (ind.nextElementSibling?.id || 'end') : null, ok, order: ids.join(' ') };
  }, aim);
}

test('전제 — 두 모듈이 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

for (const [aim, want] of [['A-upper25', 'row_new tfA tfB tfC'], ['A-lower75', 'tfA row_new tfB tfC'], ['B-center', 'tfA row_new tfB tfC'], ['BC-boundary', 'tfA tfB row_new tfC']]) {
  test(`F1[${aim}] ★블록 사이에 놓으면 «그 자리»에 들어간다(맨 끝 아님)`, async ({ page }) => {
    await boot(page);
    const r = await dropAt(page, aim);
    expect(r.kind, '판정').toBe('insert');
    expect(r.order, `순서=${r.order} · 미리보기 안내선 자리(다음 형제)=${r.indicatorWasAt} (고치기 전 실앱 실측: A아래75·B가운데 = 맨 끝)`).toBe(want);
  });
}
