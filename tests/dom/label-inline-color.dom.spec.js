/* label-inline-color.dom.spec.js — 0920r5 polish2 (T-059)
 *
 * 증상: 텍스트 타입을 Tag(라벨)로 바꾸면 알약 위에서 읽히라고 인라인 color(--preset-label-color=#ffffff)를 넣는데,
 *   다른 타입으로 돌아와도 그 «흰색»이 인라인으로 남아 흰 섹션에서 글자가 안 보였다(배경·라운드만 걷어냈었다).
 * 고침: 라벨이 «직접 넣은» 색에만 표식(data-label-auto-color)을 달고, 라벨을 벗어날 때 그 값 그대로일 때만 걷어낸다.
 *   사용자가 라벨에서 직접 고른 색, 라벨 전에 갖고 있던 색은 보존.
 *
 * ★진짜 패널 타입 버튼을 진짜 마우스로 누른다. 보이는 것은 getComputedStyle 로 잰다.
 * ★각 검사에 음성대조(고치기 전 동작을 흉내 내 «이 검사가 결함을 잡을 수 있다»는 증명)를 붙였다.
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다.
 * 실행: npm run test:dom -- label-inline-color
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>#panel-right{position:fixed;left:0;top:0;width:240px;} #canvas{position:absolute;left:600px;top:0;width:600px;background:#fff;}</style>
</head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host">
  <div class="text-block" id="tb1" data-type="body"><div class="tb-body" contenteditable="false">기본색 글자</div></div>
  <div class="text-block" id="tb2" data-type="body"><div class="tb-body" contenteditable="false" style="color:#cc2244">내가 고른 색</div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
<script type="module">
  import '/js/props/color-picker.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  window.pushHistory = () => {};
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window.__text = showTextProperties;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const select = (page, id) => page.evaluate((i) => window.__text(document.getElementById(i)), id);
const typeBtn = (page, cls) => page.locator(`.prop-type-btn[data-cls="${cls}"]`);
const look = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`#${i} [class^="tb-"]`);
  return {
    inline: el.style.color,
    computed: getComputedStyle(el).color,
    mark: el.dataset.labelAutoColor || '',
    cls: el.getAttribute('class'),
  };
}, id);

test('L1 Body → Tag → Body: 라벨이 넣은 흰 글자색이 남지 않는다(+음성대조: 옛 동작이면 흰색 잔류)', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  const base = await look(page, 'tb1');
  expect(base.inline, '시작부터 인라인 색이 있다 — 검사 전제가 깨짐').toBe('');

  await typeBtn(page, 'tb-label').click();
  const lab = await look(page, 'tb1');
  expect(lab.inline, '★양성대조: 라벨이 인라인 흰색을 애초에 안 넣었다 — 이 검사는 아무것도 못 잰다').toBe('rgb(255, 255, 255)');
  expect(lab.mark, '라벨이 넣은 색 표식이 없다').toBe('rgb(255, 255, 255)');
  expect(lab.computed).toBe('rgb(255, 255, 255)');

  // ★음성대조: 고치기 전 동작(배경·라운드만 걷어내기)을 그대로 흉내 내면 흰 글자가 남는다
  const oldWay = await page.evaluate(() => {
    const el = document.querySelector('#tb1 [class^="tb-"]');
    const keepCls = el.getAttribute('class'), keepStyle = el.getAttribute('style'), keepMark = el.dataset.labelAutoColor;
    el.setAttribute('class', keepCls.replace('tb-label', 'tb-body'));
    el.style.backgroundColor = ''; el.style.borderRadius = '';   // ← 옛 else 분기
    const c = getComputedStyle(el).color;
    el.setAttribute('class', keepCls); el.setAttribute('style', keepStyle); el.dataset.labelAutoColor = keepMark;
    return c;
  });
  expect(oldWay, '★음성대조: 옛 동작에서도 흰색이 안 남는다 — 검사가 증상을 못 잡는다').toBe('rgb(255, 255, 255)');

  await typeBtn(page, 'tb-body').click();
  const back = await look(page, 'tb1');
  expect(back.cls.split(' ')[0]).toBe('tb-body');
  expect(back.inline, '라벨이 넣은 인라인 색이 남았다(흰 섹션에서 글자가 안 보인다)').toBe('');
  expect(back.mark, '표식이 안 지워졌다').toBe('');
  expect(back.computed, '본문 기본색(--preset-body-color)으로 돌아와야 한다').toBe('rgb(85, 85, 85)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L2 라벨 전에 «사용자가 고른 색»이 있으면 라벨도 그 색을 쓰고, 돌아와도 보존', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb2');
  await typeBtn(page, 'tb-label').click();
  const lab = await look(page, 'tb2');
  expect(lab.inline, '라벨이 사용자 색을 덮었다').toBe('rgb(204, 34, 68)');
  expect(lab.mark, '사용자 색에 «라벨이 넣은 색» 표식이 붙었다').toBe('');
  await typeBtn(page, 'tb-h2').click();
  const back = await look(page, 'tb2');
  expect(back.inline, '사용자가 고른 색이 걷혔다').toBe('rgb(204, 34, 68)');
  expect(back.computed).toBe('rgb(204, 34, 68)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L3 라벨 «안»에서 색을 직접 고르면(피커 hex) 타입을 바꿔도 그 색이 남는다', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await typeBtn(page, 'tb-label').click();
  expect((await look(page, 'tb1')).mark).toBe('rgb(255, 255, 255)');
  await page.fill('#txt-color-hex', '112233');
  const picked = await look(page, 'tb1');
  expect(picked.inline, '피커 hex 가 라벨 글자색에 안 먹었다 — 검사 전제가 깨짐').toBe('rgb(17, 34, 51)');
  expect(picked.mark, '사용자가 색을 고른 뒤에도 라벨 표식이 남았다').toBe('');
  await typeBtn(page, 'tb-caption').click();
  const back = await look(page, 'tb1');
  expect(back.inline, '사용자가 라벨에서 고른 색이 걷혔다').toBe('rgb(17, 34, 51)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L4 Tag → Tag 재진입: 두 번째 라벨도 같은 규칙(표식 갱신, 벗어나면 걷힘)', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await typeBtn(page, 'tb-label').click();
  await typeBtn(page, 'tb-h3').click();
  expect((await look(page, 'tb1')).inline).toBe('');
  await typeBtn(page, 'tb-label').click();
  expect((await look(page, 'tb1')).mark).toBe('rgb(255, 255, 255)');
  await typeBtn(page, 'tb-body').click();
  const back = await look(page, 'tb1');
  expect(back.inline).toBe('');
  expect(back.computed).toBe('rgb(85, 85, 85)');
  expect(errs, errs.join(' | ')).toEqual([]);
});
