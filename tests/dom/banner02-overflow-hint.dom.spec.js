/* banner02-overflow-hint.dom.spec.js — 배너02 «내용이 조용히 잘린다»의 진짜 끝. (2026-09-20, 0920b-banner)
 *
 * ★왜 DOM 검사인가
 *   넘침 판정(bn2OverflowInfo)은 «살아 있는 .bn2-text 의 offsetHeight» 를 잰다.
 *   ⇒ 「글자를 키운 그 순간 힌트가 뜨나」는 렌더러가 진짜로 그린 뒤에만 답이 나온다.
 *     소스 문자열 검사로는 «호출처가 몇 군데냐»까지밖에 모른다.
 *
 * ★재현 전제(적대적 검증자 실측, dev @20e50e3)
 *   높이(H)를 사람이 한 번이라도 만진 배너(dataset.autoHeight === 'false')만 증상이 있다.
 *   기본 배너는 렌더가 높이를 자동으로 키운다 — 그건 회귀로 지킨다(B4).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(pad-hint.dom.spec.js 하네스 그대로).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js banner02-overflow-hint
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script type="module">
  import '/js/blocks/banner02-block.js';
  import { showBanner02Properties } from '/js/props/prop-banner02.js';
  window.__open = showBanner02Properties;
  window.__ready = true;
</script></body>`);
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
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 캔버스에 진짜 배너02 를 넣는다. fixH=true 면 «사람이 H 를 만진» 상태(autoHeight='false'). */
async function addBanner(page, { fixH = true } = {}) {
  return page.evaluate((fix) => {
    const { row, block } = window.makeBanner02Block({});
    if (fix) block.dataset.autoHeight = 'false';
    const host = document.querySelector('#canvas') || document.body;
    host.appendChild(row);
    window.renderBanner02(block);
    block.classList.add('selected');
    window.__block = block;
    return block.id;
  }, fixH);
}

const openPanel = async (page) => {
  await page.evaluate(() => window.__open(window.__block));
  await page.waitForSelector('#bn2-hint-row', { state: 'attached' });
};

/** 힌트 줄의 «지금» 상태 — 보이나 / 뭐라고 쓰여 있나 / 맞추기 버튼이 있나. */
const hintOf = (page) => page.evaluate(() => {
  const row = document.getElementById('bn2-hint-row');
  const out = document.getElementById('bn2-hint');
  const over = window.bn2OverflowInfo?.(window.__block);
  return {
    visible: !!row && getComputedStyle(row).display !== 'none',
    text: out ? out.textContent : null,
    hasFit: !!document.getElementById('bn2-fit-h'),
    need: over ? over.need : null,
    cur: over ? over.cur : null,
    overflow: over ? over.overflow : null,
    bannerH: window.__block.dataset.bannerH,
    autoHeight: window.__block.dataset.autoHeight,
  };
});

/** 첫 줄(라벨) 글자크기 슬라이더를 «진짜로» 끈다 — 사람이 끄는 것과 같은 input 이벤트 경로. */
async function slideSize(page, idx, v) {
  await page.evaluate(({ idx, v }) => {
    const s = document.querySelector(`[data-line-size="${idx}"]`);
    if (!s) throw new Error('글자크기 슬라이더가 없다 — 검사 전제가 깨졌다');
    s.value = String(v);
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, { idx, v });
}

test('B1 ★H 고정 배너에서 글자를 키우면 «그 순간» 넘침 힌트가 뜬다 (음성대조: 키우기 전엔 안 뜬다)', async ({ page }) => {
  const errs = await boot(page);
  await addBanner(page, { fixH: true });
  await openPanel(page);

  /* ★입력이 살아 있다 — 슬라이더가 진짜 있고, 만지기 «전»엔 안 넘치고 힌트도 없다.
     이 음성대조가 없으면 아래 「떴다」가 「원래 떠 있던 것」과 구별되지 않는다. */
  expect(await page.locator('[data-line-size="0"]').count(), '글자크기 슬라이더가 없다').toBe(1);
  const before = await hintOf(page);
  expect(before.autoHeight, '전제: H 가 사람손 고정이어야 한다').toBe('false');
  expect(before.overflow, '만지기 전인데 이미 넘쳐 있다 — 전제가 깨졌다').toBe(false);
  expect(before.visible, '만지기 전인데 힌트가 떠 있다').toBe(false);

  await slideSize(page, 0, 90);

  const after = await hintOf(page);
  expect(after.overflow, '글자를 90 으로 키웠는데 넘치지 않았다 — 검사 전제가 깨졌다').toBe(true);
  expect(after.bannerH, '★고정 높이를 멋대로 늘렸다 — 사람이 정한 값이다').toBe(before.bannerH);
  expect(after.visible, '★넘치기 시작했는데 힌트가 «그 순간» 안 떴다(조용히 잘린다)').toBe(true);
  expect(after.text, '★힌트 문구가 지금 필요한 높이를 안 말한다').toBe(`내용이 넘칩니다 (${after.need}px 필요)`);
  expect(after.hasFit, '★«맞추기» 버튼이 같이 안 나왔다').toBe(true);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('B2 ★힌트 수치가 «따라온다» — 줄이면 숫자가 줄고, 다 줄이면 사라진다(썩은 숫자 금지)', async ({ page }) => {
  const errs = await boot(page);
  await addBanner(page, { fixH: true });
  await openPanel(page);

  await slideSize(page, 0, 90);
  const big = await hintOf(page);
  expect(big.visible, '전제: 90 에서 힌트가 떠 있어야 한다').toBe(true);

  /* 중간값 — 아직 넘치지만 «덜» 넘친다. 문구의 숫자가 그때의 need 와 같아야 한다.
     (실측: 라벨이 두 줄로 접히는 경계가 80 이다 — 20/40/…/75 는 안 넘치고 80·85·90 이 넘친다.) */
  await slideSize(page, 0, 80);
  const mid = await hintOf(page);
  expect(mid.overflow, '전제: 80 에서도 아직 넘쳐야 한다').toBe(true);
  expect(mid.need, '전제: 80 의 need 가 90 보다 작아야 한다').toBeLessThan(big.need);
  expect(mid.text, '★힌트 숫자가 썩었다 — 글자를 줄였는데 옛 need 를 그대로 말한다').toBe(`내용이 넘칩니다 (${mid.need}px 필요)`);

  /* 원래대로 — 안 넘치면 힌트는 «사라져야» 한다. */
  await slideSize(page, 0, 20);
  const small = await hintOf(page);
  expect(small.overflow, '전제: 20 이면 안 넘쳐야 한다').toBe(false);
  expect(small.visible, '★안 넘치는데 힌트가 그대로 떠 있다(썩음)').toBe(false);
  expect(small.hasFit, '★안 넘치는데 «맞추기» 버튼이 남아 있다').toBe(false);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('B3 ★«맞추기» 를 누르면 넘침이 풀린다 — 그리고 높이는 지금 필요한 값이다', async ({ page }) => {
  const errs = await boot(page);
  await addBanner(page, { fixH: true });
  await openPanel(page);

  await slideSize(page, 0, 90);
  const over = await hintOf(page);
  expect(over.hasFit, '전제: 맞추기 버튼이 있어야 한다').toBe(true);
  const need90 = over.need;

  /* ★«썩은 버튼» 덫: 버튼이 처음 만들어질 때의 need 를 그대로 들고 있으면,
     글자를 줄인 뒤 누를 때 엉뚱한 높이가 박힌다. 그래서 «줄인 뒤에»(아직 넘치는 값으로) 누른다. */
  await slideSize(page, 0, 80);
  const mid = await hintOf(page);
  expect(mid.overflow, '전제: 80 에서도 아직 넘쳐야 한다').toBe(true);
  expect(mid.need, '전제: 80 의 need 가 90 보다 작아야 한다').toBeLessThan(need90);

  await page.click('#bn2-fit-h');
  const fixed = await hintOf(page);
  expect(fixed.overflow, '★맞추기를 눌렀는데 아직 넘친다').toBe(false);
  expect(parseInt(fixed.bannerH, 10), '★맞추기가 «지금» 필요한 높이가 아닌 옛 값을 박았다').toBe(mid.need);
  expect(fixed.visible, '★맞췄는데 힌트가 남아 있다').toBe(false);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('B4 ★회귀 — 자동높이 배너는 글자를 키우면 «기존대로» 높이가 자란다(힌트 없음)', async ({ page }) => {
  const errs = await boot(page);
  await addBanner(page, { fixH: false });
  await openPanel(page);

  const before = await hintOf(page);
  expect(before.autoHeight, '전제: 자동높이(플래그 없음)여야 한다').toBeUndefined();
  const h0 = parseInt(before.bannerH, 10);

  await slideSize(page, 0, 90);
  const after = await hintOf(page);
  expect(parseInt(after.bannerH, 10), '★자동높이 배너가 안 자랐다 — 회귀다').toBeGreaterThan(h0);
  expect(after.overflow, '★자동으로 자랐는데도 여전히 넘친다').toBe(false);
  expect(after.visible, '★자동높이 배너에 넘침 힌트가 떴다 — 있을 수 없는 경고다').toBe(false);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('B5 ★#bn2-h 에서 ↑ 연타가 «연속으로» 올라간다 — 패널 재생성이 포커스를 뺏지 않는다', async ({ page }) => {
  const errs = await boot(page);
  await addBanner(page, { fixH: true });
  await openPanel(page);

  await page.focus('#bn2-h');
  const start = await page.inputValue('#bn2-h');
  expect(start, '전제: H 칸에 고정값이 보여야 한다').not.toBe('');

  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');

  const focused = await page.evaluate(() => document.activeElement?.id || null);
  expect(focused, '★↑ 를 누르자 포커스가 H 칸을 떠났다 — 연속 조정이 안 된다').toBe('bn2-h');

  const end = await page.inputValue('#bn2-h');
  expect(Number(end), '★↑ 5번인데 값이 5 만큼 안 올라갔다(매번 포커스를 잃어 1 만 오른다)').toBe(Number(start) + 5);
  expect(await page.evaluate(() => window.__block.dataset.bannerH), '★칸은 올랐는데 블록에 안 반영됐다')
    .toBe(String(Number(start) + 5));

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('B6 ★캔버스에서 «타자 치는 중»에도 넘치는 순간 힌트가 뜬다 (렌더를 안 지나는 유일한 길)', async ({ page }) => {
  const errs = await boot(page);
  await addBanner(page, { fixH: true });
  await openPanel(page);
  expect((await hintOf(page)).visible, '전제: 치기 전엔 힌트가 없다').toBe(false);

  /* 캔버스 줄을 더블클릭해 편집 상태로 만들고, 사람이 치는 것과 같은 경로로 글자를 늘린다.
     ⚠️여기서 blur 는 «안» 한다 — 커밋 전, 「치는 도중」에도 알려주는지가 이 검사의 뜻이다. */
  await page.evaluate(() => {
    const el = window.__block.querySelector('[data-line-idx="1"]');
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    el.textContent = '제목을 입력합니다. '.repeat(12);
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  const typing = await hintOf(page);
  expect(typing.overflow, '전제: 글자를 잔뜩 쳤으면 넘쳐야 한다').toBe(true);
  expect(typing.visible, '★타자 치는 중에 넘쳤는데 아무 말이 없다(조용히 잘린다)').toBe(true);
  expect(typing.text, '★힌트 숫자가 지금 필요한 높이가 아니다').toBe(`내용이 넘칩니다 (${typing.need}px 필요)`);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});
