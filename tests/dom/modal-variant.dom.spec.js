/* modal-variant.dom.spec.js — 모달 변형의 «진짜 끝». (2026-09-08 신설)
 *
 * ★왜 필요한가
 *   `dashed` 변형은 기능이 살아 있는 내내 «통째로 아무 일도 안 했다».
 *   프로퍼티 패널에서 고르면 `dataset.variant === 'dashed'` 는 되는데
 *   `getComputedStyle(el).borderTopStyle` 은 `none` 이었다. 변형 여섯 중 하나가 조용히 없었다.
 *   ⇒ ★★이 결함이 QA 를 통과했던 이유는 «dataset 만 봤기» 때문이다.
 *      dataset 은 «의도»고, computed style 은 «사람이 보는 것»이다. 둘이 갈라지는 게 이 결함이었다.
 *      그러니 여기서는 반드시 «계산된 스타일»로 잰다.
 *
 * ★그리고 «패널 경로»로 잰다 — 함수를 직접 부르지 않고 select 에 진짜 change 를 발사한다.
 *   결함이 살던 곳이 바로 그 핸들러였다(`block.dataset.variant = sel.value;` 한 줄).
 *   함수만 직접 부르면 그 한 줄을 되돌려도 초록이다.
 *
 * ⚠️⚠️★이 파일은 «변이를 잡는 그물이 아니다».
 *   tests/dom 은 playwright 라 검수자가 돌리는 `node --test "tests/unit/*"` 스위트에 «안 들어간다».
 *   ⇒ 변이(호출부 되돌리기·표에서 항목 제거)를 빨갛게 만드는 책임은
 *      tests/unit/modal-variant-identity.test.mjs 가 진다. 이 파일만 보고 「보호된다」고 믿지 마라.
 *      여기는 「진짜 계산 스타일로 «한 번은» 잰다」를 레포에 남기는 자리다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 * ⚠️렌더러 모듈이 ESM(import)이라 기존 dom spec 의 addScriptTag(content) 로는 못 올린다.
 *   ⇒ page.route 로 레포를 가짜 origin 에 얹어 «진짜 파일»을 그대로 import 시킨다(사본 없음).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js modal-variant
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 패널이 살 자리(#panel-right .panel-body)는 globals.js 가 «모듈 로드 시점»에 querySelector 한다
   ⇒ 모듈 script 보다 «먼저» DOM 에 있어야 한다. 그래서 script 를 body 끝에 둔다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  import { makeModalBlock } from '/js/blocks/modal-block.js';
  import { showModalProperties } from '/js/props/prop-modal.js';
  window.__mk = makeModalBlock;
  window.__open = showModalProperties;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({ contentType: 'text/html', body: HARNESS });
    }
    const file = path.join(REPO, url.pathname);
    // 레포 밖으로 새지 않게(경로 조작 방지) — 실패하면 404 로 두어 원인이 드러나게 한다
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  return errs;
}

/** 기본(plain) 모달 하나를 캔버스에 올리고 패널을 «연다» — 여기서부터는 사용자와 같은 경로다. */
async function mountAndOpen(page) {
  await page.evaluate(() => {
    const { row, block } = window.__mk({});
    document.getElementById('host').appendChild(row);
    window.__block = block;
    window.__open(block);
  });
}

/** ★계산된 스타일 — dataset 이 아니라 «사람이 보는 것»을 잰다. */
const computed = (page) => page.evaluate(() => {
  const s = getComputedStyle(window.__block);
  return { style: s.borderTopStyle, width: s.borderTopWidth, bg: s.backgroundColor };
});
const dataset = (page) => page.evaluate(() => ({ ...window.__block.dataset }));

/** 변형 select 에 «진짜» change 를 발사한다. 패널은 매번 다시 그려지므로 그때마다 새로 잡는다. */
const pickVariant = async (page, v) => {
  await page.selectOption('#mdl-variant', v);
  await expect(page.locator('#mdl-variant')).toHaveValue(v);
};

test('DOM-① ★패널에서 dashed 를 고르면 «계산된 스타일»이 실제로 점선이 된다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);

  const before = await computed(page);
  console.log('  고르기 전:', before);
  expect(before.style).toBe('none');          // 기본 변형은 테두리 없음

  await pickVariant(page, 'dashed');

  const after = await computed(page);
  console.log('  dashed 고른 뒤:', after);
  /* ★★여기가 결함이 살던 자리다. dataset.variant 만 바꾸면 이 셋이 전부 옛 값으로 남는다. */
  expect(after.style).toBe('dashed');
  expect(after.width).toBe('2px');
  expect(after.bg).toBe('rgba(0, 0, 0, 0)');  // transparent

  // dataset 도 같이 확인 — 「의도」와 「보이는 것」이 일치하는지가 이 결함의 핵심이었다
  expect(await dataset(page)).toMatchObject({ variant: 'dashed', borderW: '2', borderStyle: 'dashed', bg: 'transparent' });
  expect(errs).toEqual([]);
});

test('DOM-② ★되돌리기 — 다시 기본 변형을 고르면 테두리가 «벗겨진다»', async ({ page }) => {
  await boot(page);
  await mountAndOpen(page);

  await pickVariant(page, 'dashed');
  expect((await computed(page)).style).toBe('dashed');

  await pickVariant(page, 'plain');
  const back = await computed(page);
  console.log('  plain 으로 되돌린 뒤:', back);
  /* ⛔MODAL_DEFAULTS 와만 비교하는 구현이면 borderW=2 가 «사용자 값»으로 오판돼 여기서 2px 로 남는다. */
  expect(back.style).toBe('none');
  expect(back.width).toBe('0px');
  expect(back.bg).toBe('rgb(246, 247, 249)');
});

test('DOM-③ ★사용자가 맞춘 5px 은 변형을 오가도 «양방향»으로 살아남는다', async ({ page }) => {
  await boot(page);
  await mountAndOpen(page);

  // 패널의 두께 입력으로 «사용자처럼» 5 를 넣는다(wireNum 이 change 를 듣는다)
  const bw = page.locator('#mdl-bw-number');
  await bw.fill('5');
  await bw.dispatchEvent('change');
  expect((await computed(page)).width).toBe('5px');

  await pickVariant(page, 'dashed');
  const atDashed = await computed(page);
  console.log('  5px 인 채로 dashed:', atDashed);
  expect(atDashed.width).toBe('5px');         // ★사용자 값은 안 덮는다
  expect(atDashed.style).toBe('dashed');      // ★안 건드린 스타일은 정체를 따라간다

  await pickVariant(page, 'plain');
  const atPlain = await computed(page);
  console.log('  되돌린 뒤:', atPlain);
  expect(atPlain.width).toBe('5px');          // ★되돌릴 때도 사용자 값은 지킨다
  expect(atPlain.style).toBe('solid');
});

test('DOM-④ ★실제 CSS 를 얹고도 인라인 테두리가 살아 있다 (CSS 가 값을 덮지 않는다)', async ({ page }) => {
  await boot(page);
  await mountAndOpen(page);
  await pickVariant(page, 'dashed');

  /* css/editor-blocks.css 는 「스타일 «값»은 여기 두지 않는다 — dataset 이 진실」이라고 적고
     .modal-block 에 outline 만 준다. 그 약속이 깨져 border 를 주기 시작하면 여기서 걸린다. */
  const seen = await page.evaluate(() => {
    const s = getComputedStyle(window.__block);
    return { border: s.borderTopStyle + ' ' + s.borderTopWidth, outlineW: s.outlineWidth };
  });
  console.log('  실제 CSS 아래:', seen);
  expect(seen.border).toBe('dashed 2px');
  expect(await page.evaluate(() => !!document.querySelector('link[href*="editor-blocks.css"]'))).toBe(true);
});
