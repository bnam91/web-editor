/* tpl-sort-depth2.dom.spec.js — 1012t1Z2: 템플릿 브라우저의 정렬 옵션이 뎁스2(카드 칼럼) 머리에 선다
 *
 * 무엇을 고쳤나
 *   정렬 select 가 검색 줄 안에 있어 뎁스2 밖이었고, 검색 기준 select 의 고정 폭을 물려받아 옵션 글자가 잘렸다.
 *   ⇒ 카드 칼럼 머리의 정렬 줄(라벨 「정렬」 + select)로 옮기고, 폭을 글자에 맞추고, 고른 값을 기기에 기억한다.
 *
 * 이 파일이 재는 것 — `tests/unit/tpl-browser-sort.test.mjs` 가 못 재는 칸(배치·폭·행위)
 *   Z0 전제 / Z1 자리 / Z2 폭 / Z3 고르면 차례가 바뀐다 / Z4 닫았다 열어도 남는다 / Z5 많은 카드에서 목록만 구른다
 *   Z6 최근 추가순(createdAt 내림차순) / Z7 하한 폭(280px)에서 안 잘린다
 *
 * 안 재는 것: 별창(pages/template-browser.html)의 실제 배치 — 이 하네스는 index.html 만 띄운다.
 *   별창의 마크업 자리는 유닛 F13 이 글자로 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/tpl-sort-depth2.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 이름과 넣는 차례를 어긋나게 심는다 — 나·가·다. 기본 차례(넣은 역순)와 이름순이 같으면 Z3 은 항등식이다 */
const SCENE = [
  ['나', 'QA알파', 'demo', ['qna']],
  ['가', 'QA알파', 'demo', ['qna']],
  ['다', 'QA베타', '레거시', ['war']],
];

/** 앱의 제 문으로 템플릿을 심는다(tpl-nav-depth 의 seed 와 같은 꼴) */
async function seed(page, scene) {
  return await page.evaluate(async (sc) => {
    let sec = document.querySelector('.section-block');
    if (!sec) {
      window.addSection({ skipDefaultBlock: true });
      sec = document.querySelector('.section-block');
    }
    if (!sec) return { ok: false, why: 'addSection 뒤에도 .section-block 이 없다' };
    if (typeof window.saveAsTemplate !== 'function') return { ok: false, why: 'saveAsTemplate 가 없다' };
    for (const [name, folder, category, tags] of sc) {
      await window.saveAsTemplate(sec, name, folder, category, tags, 'section');
    }
    const list = window.loadTemplates ? window.loadTemplates() : [];
    return { ok: true, n: list.length, ids: list.map(t => t.id) };
  }, scene);
}

const isOpen = () => {
  const p = document.getElementById('tpl-browser');
  return !!p && getComputedStyle(p).display === 'flex';
};

async function open(page, scene = SCENE) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const seeded = await seed(page, scene);
  await page.keyboard.press('Meta+t');
  await page.waitForFunction(isOpen, null, { timeout: 4000 });
  return { errs, seeded };
}

const cardNames = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#tpl-browser-cards .tb-card-name')].map(e => e.textContent));

/** 화면 사각형을 한 번에 읽는다 — 견줄 때는 사각형끼리만 견준다 */
const rects = (page) => page.evaluate(() => {
  const R = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
  };
  return {
    panel: R('#tpl-browser'), tree: R('#tpl-browser-tree'), cards: R('#tpl-browser-cards'),
    sort: R('#tpl-browser-sort'), bar: R('.tpl-browser-sortbar'), label: R('.tpl-browser-sort-label'),
    wrap: R('.tpl-browser-search-wrap'),
  };
});

test('Z0 전제 — 카드 3장 · id 전부 다름 · 뎁스2 · 옵션 3개', async ({ page }) => {
  const { errs, seeded } = await open(page);
  expect(seeded.ok, `장면이 안 섰다 — ${seeded.why || ''}`).toBe(true);
  expect(seeded.n, '템플릿 수').toBe(SCENE.length);
  expect(new Set(seeded.ids).size, 'id 가 전부 다르다').toBe(seeded.ids.length);
  expect((await cardNames(page)).length, '카드 수').toBe(SCENE.length);
  expect((await page.evaluate(() => window.__tplNavState())).depth, '열면 뎁스2').toBe(2);
  const opts = await page.evaluate(() => {
    const s = document.getElementById('tpl-browser-sort');
    return { values: [...s.options].map(o => o.value), keys: Object.keys(window.TPL_SORTS), value: s.value };
  });
  expect(opts.values, '옵션이 명부와 같다').toEqual(opts.keys);
  expect(opts.values.length, '옵션 수').toBe(3);
  expect(opts.value, '기억값이 없으면 기본 열쇠').toBe(await page.evaluate(() => window.tplSortDefault));
  expect(errs, `페이지 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('Z1 정렬 select 가 뎁스2 칼럼 안 · 카드 목록 위에 있고 라벨 「정렬」이 보인다', async ({ page }) => {
  await open(page);
  const r = await rects(page);
  for (const k of ['panel', 'tree', 'cards', 'sort', 'bar', 'label', 'wrap']) {
    expect(r[k], `전제: ${k} 요소가 있다`).not.toBeNull();
  }
  expect(r.sort.width, '전제: select 가 그려졌다').toBeGreaterThan(0);
  expect(r.tree.width, '전제: 트리(뎁스1)가 그려졌다').toBeGreaterThan(0);
  /* 가로 — 트리 오른쪽 끝 이후에서 시작한다 */
  expect(r.sort.left, 'select 가 트리(뎁스1) 칼럼과 겹친다').toBeGreaterThanOrEqual(r.tree.right);
  expect(r.label.left, '라벨이 트리(뎁스1) 칼럼과 겹친다').toBeGreaterThanOrEqual(r.tree.right);
  /* 세로 — 검색 줄 아래 · 카드 목록 위 */
  expect(r.sort.top, 'select 가 검색 줄 안(또는 위)에 있다').toBeGreaterThanOrEqual(r.wrap.bottom);
  expect(r.sort.bottom, 'select 가 카드 목록 위에 있지 않다').toBeLessThanOrEqual(r.cards.top);
  expect(r.bar.bottom, '정렬 줄이 카드 목록과 겹친다').toBeLessThanOrEqual(r.cards.top);
  /* 정렬 줄과 카드 목록이 같은 칼럼이다 */
  expect(r.bar.left, '정렬 줄과 카드 목록의 왼쪽 끝이 다르다').toBe(r.cards.left);
  expect(r.bar.right, '정렬 줄과 카드 목록의 오른쪽 끝이 다르다').toBe(r.cards.right);
  /* 라벨 */
  const label = page.locator('.tpl-browser-sort-label');
  await expect(label).toBeVisible();
  await expect(label).toHaveText('정렬');
  expect(await label.getAttribute('for'), '라벨이 select 에 묶였다').toBe('tpl-browser-sort');
  expect(r.label.right, '라벨이 select 왼쪽에 있지 않다').toBeLessThanOrEqual(r.sort.left);
  /* DOM 계층 — 검색 줄 밖 · 바디 안 */
  const where = await page.evaluate(() => {
    const s = document.getElementById('tpl-browser-sort');
    return { inWrap: !!s.closest('.tpl-browser-search-wrap'), inBody: !!s.closest('.tpl-browser-body'),
             sameCol: s.closest('.tpl-browser-cards-col') === document.getElementById('tpl-browser-cards').parentElement };
  });
  expect(where).toEqual({ inWrap: false, inBody: true, sameCol: true });
});

test('Z2 select 폭이 가장 긴 옵션 글자보다 넓다(글자가 안 잘린다)', async ({ page }) => {
  await open(page);
  const m = await page.evaluate(() => {
    const s = document.getElementById('tpl-browser-sort');
    const cs = getComputedStyle(s);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const widths = [...s.options].map(o => ({ text: o.textContent, w: ctx.measureText(o.textContent).width }));
    const longest = widths.reduce((a, b) => (b.w > a.w ? b : a));
    const inner = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { n: widths.length, longest, selectW: s.offsetWidth, inner,
             panelRight: document.getElementById('tpl-browser').getBoundingClientRect().right,
             selectRight: s.getBoundingClientRect().right };
  });
  expect(m.n, '전제: 옵션이 그려졌다').toBeGreaterThan(0);
  expect(m.longest.w, `전제: 가장 긴 옵션(「${m.longest.text}」)의 글자 폭을 쟀다`).toBeGreaterThan(0);
  expect(m.selectW, `select 폭 ${m.selectW} < 가장 긴 옵션 「${m.longest.text}」 ${m.longest.w}`).toBeGreaterThanOrEqual(m.longest.w);
  expect(m.inner, `select 안쪽 폭 ${m.inner} < 가장 긴 옵션 ${m.longest.w}`).toBeGreaterThanOrEqual(m.longest.w);
  expect(m.selectRight, 'select 가 패널 밖으로 나갔다').toBeLessThanOrEqual(m.panelRight);
});

test('Z3 「이름순」을 고르면 카드가 가·나·다 로 선다', async ({ page }) => {
  await open(page);
  const before = await cardNames(page);
  expect(before.slice().sort(), '전제: 심은 세 장이 다 있다').toEqual(['가', '나', '다']);
  expect(before, '전제: 고르기 전 차례가 이름순과 다르다').not.toEqual(['가', '나', '다']);
  await page.selectOption('#tpl-browser-sort', 'name');
  await expect.poll(() => cardNames(page)).toEqual(['가', '나', '다']);
  /* 기본으로 되돌리면 처음 차례다 */
  await page.selectOption('#tpl-browser-sort', await page.evaluate(() => window.tplSortDefault));
  await expect.poll(() => cardNames(page)).toEqual(before);
});

test('Z4 고른 정렬이 닫았다 열어도 남는다', async ({ page }) => {
  await open(page);
  const before = await cardNames(page);
  expect(before, '전제: 고르기 전 차례가 이름순과 다르다').not.toEqual(['가', '나', '다']);
  expect(await page.evaluate(() => document.getElementById('tpl-browser-sort').value),
    '전제: 처음엔 name 이 아니다').not.toBe('name');
  await page.selectOption('#tpl-browser-sort', 'name');
  await expect.poll(() => cardNames(page)).toEqual(['가', '나', '다']);

  await page.evaluate(() => window.closeTemplateBrowser());
  await page.waitForFunction(() => {
    const p = document.getElementById('tpl-browser');
    return !p.classList.contains('open') && getComputedStyle(p).display === 'none';
  }, null, { timeout: 4000 });

  await page.evaluate(() => window.openTemplateBrowser());
  await page.waitForFunction(isOpen, null, { timeout: 4000 });
  expect(await page.evaluate(() => document.getElementById('tpl-browser-sort').value),
    '다시 열었더니 정렬이 되돌아갔다').toBe('name');
  expect(await page.evaluate(() => document.getElementById('tpl-browser-sort').selectedOptions[0].value),
    '보이는 칸(selected option)이 name 이 아니다').toBe('name');
  await expect.poll(() => cardNames(page)).toEqual(['가', '나', '다']);
});

test('Z5 템플릿이 많아도 정렬 줄은 패널 안에 남고 카드 목록만 구른다', async ({ page }) => {
  const MANY = Array.from({ length: 30 }, (_, i) => [`많음${String(i).padStart(2, '0')}`, 'QA많음', 'bulk', ['qna']]);
  const { seeded } = await open(page, MANY);
  expect(seeded.ok, `장면이 안 섰다 — ${seeded.why || ''}`).toBe(true);
  expect(seeded.n, '전제: 템플릿 수').toBe(MANY.length);
  expect((await cardNames(page)).length, '전제: 카드 수').toBe(MANY.length);

  const s = await page.evaluate(() => {
    const c = document.getElementById('tpl-browser-cards');
    return { scrollH: c.scrollHeight, clientH: c.clientHeight, overflowY: getComputedStyle(c).overflowY };
  });
  expect(s.clientH, '전제: 카드 목록에 높이가 있다').toBeGreaterThan(0);
  expect(s.scrollH, `카드 목록이 안 구른다(scrollHeight ${s.scrollH} · clientHeight ${s.clientH})`).toBeGreaterThan(s.clientH);
  expect(s.overflowY, '구르는 자는 카드 목록이다').toBe('auto');

  const r = await rects(page);
  expect(r.bar.top, '정렬 줄이 패널 위로 나갔다').toBeGreaterThanOrEqual(r.panel.top);
  expect(r.bar.bottom, '정렬 줄이 패널 아래로 나갔다').toBeLessThanOrEqual(r.panel.bottom);
  expect(r.cards.bottom, '카드 목록이 패널 아래로 나갔다').toBeLessThanOrEqual(r.panel.bottom);
  /* 카드 목록이 한 장보다 높다 — 바닥 높이로 주저앉지 않았다 */
  const first = await page.evaluate(() => document.querySelector('#tpl-browser-cards > *').offsetHeight);
  expect(first, '전제: 첫 카드에 높이가 있다').toBeGreaterThan(0);
  expect(s.clientH, `카드 목록 높이 ${s.clientH} 가 카드 한 장 ${first} 보다 낮다`).toBeGreaterThan(first);

  /* 목록을 끝까지 굴려도 정렬 줄은 제자리다 */
  await page.evaluate(() => { const c = document.getElementById('tpl-browser-cards'); c.scrollTop = c.scrollHeight; });
  await page.waitForFunction(() => document.getElementById('tpl-browser-cards').scrollTop > 0, null, { timeout: 4000 });
  const r2 = await rects(page);
  expect(r2.bar.top, '목록을 굴리니 정렬 줄이 같이 움직였다').toBe(r.bar.top);
});

test('Z6 「최근 추가순」을 고르면 카드가 createdAt 내림차순으로 선다', async ({ page }) => {
  /* 심는 차례 다·가·나 ⇒ 기본(넣은 역순) 나·가·다 / 이름순 가·나·다 / 최근순 나·다·가 — 세 차례가 모두 다르다 */
  const STAMP = { 나: '2026-03-01T00:00:00.000Z', 다: '2026-02-01T00:00:00.000Z', 가: '2026-01-01T00:00:00.000Z' };
  const RECENT = ['나', '다', '가'];
  const NAME = ['가', '나', '다'];
  const { seeded } = await open(page, [
    ['다', 'QA알파', 'demo', ['qna']],
    ['가', 'QA알파', 'demo', ['qna']],
    ['나', 'QA베타', '레거시', ['war']],
  ]);
  expect(seeded.ok, `장면이 안 섰다 — ${seeded.why || ''}`).toBe(true);
  expect(seeded.n, '전제: 템플릿 수').toBe(3);
  /* 만든 시각을 앱의 제 문(loadTemplates → saveTemplatesPublic)으로 박는다 — 연달아 심으면 시각이 넣은 차례 그대로라 기본과 못 가른다 */
  const stamped = await page.evaluate((stamp) => {
    const list = window.loadTemplates().map(t => ({ ...t, createdAt: stamp[t.name] }));
    if (typeof window.saveTemplatesPublic !== 'function') return null;
    window.saveTemplatesPublic(list);
    return window.loadTemplates().map(t => [t.name, t.createdAt]);
  }, STAMP);
  expect(stamped, '전제: saveTemplatesPublic 이 있다').not.toBeNull();
  expect(Object.fromEntries(stamped), '전제: createdAt 이 박혔다').toEqual(STAMP);
  expect(new Set(stamped.map(s => s[1])).size, '전제: createdAt 이 전부 다르다').toBe(3);

  const before = await cardNames(page);
  expect(await page.evaluate(() => document.getElementById('tpl-browser-sort').value),
    '전제: 처음엔 기본 열쇠').toBe(await page.evaluate(() => window.tplSortDefault));
  expect(before.slice().sort(), '전제: 심은 세 장이 다 있다').toEqual(NAME);
  expect(before, '전제: 기본 차례가 최근순과 다르다').not.toEqual(RECENT);
  expect(before, '전제: 기본 차례가 이름순과 다르다').not.toEqual(NAME);

  await page.selectOption('#tpl-browser-sort', 'recent');
  await expect.poll(() => cardNames(page), '최근 추가순 = createdAt 내림차순').toEqual(RECENT);
  /* 이름순은 또 다른 차례다 — 최근순이 이름순의 다른 이름이 아니다 */
  await page.selectOption('#tpl-browser-sort', 'name');
  await expect.poll(() => cardNames(page)).toEqual(NAME);
  await page.selectOption('#tpl-browser-sort', 'recent');
  await expect.poll(() => cardNames(page)).toEqual(RECENT);
});

test('Z7 패널을 하한 폭(280px)으로 줄여도 select 가 패널 안에 남고 라벨이 한 줄이다', async ({ page }) => {
  await open(page);
  const NARROW = 280;
  const w = await page.evaluate((px) => {
    const p = document.getElementById('tpl-browser');
    p.style.width = px + 'px';
    return { style: p.style.width, offset: p.offsetWidth };
  }, NARROW);
  expect(w.style, '전제: 폭을 줬다').toBe(`${NARROW}px`);
  expect(w.offset, '전제: 패널 폭이 실제로 하한이 됐다').toBe(NARROW);

  const r = await rects(page);
  for (const k of ['panel', 'cards', 'sort', 'bar', 'label']) {
    expect(r[k], `전제: ${k} 요소가 있다`).not.toBeNull();
  }
  expect(r.sort.width, '전제: select 가 그려졌다').toBeGreaterThan(0);
  expect(r.label.width, '전제: 라벨이 그려졌다').toBeGreaterThan(0);
  expect(r.sort.right, `select 가 패널 오른쪽 밖으로 ${r.sort.right - r.panel.right} 나갔다`).toBeLessThanOrEqual(r.panel.right);
  expect(r.sort.right, `select 가 카드 칼럼 오른쪽 밖으로 ${r.sort.right - r.cards.right} 나갔다`).toBeLessThanOrEqual(r.cards.right);
  expect(r.label.right, '라벨이 select 와 겹친다').toBeLessThanOrEqual(r.sort.left);
  /* 한 줄 — 두 줄로 꺾이면 라벨이 select 보다 높아진다 */
  expect(r.label.height, `라벨 높이 ${r.label.height} > select 높이 ${r.sort.height} (두 줄로 꺾였다)`).toBeLessThanOrEqual(r.sort.height);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.tpl-browser-sort-label')).whiteSpace),
    '라벨이 줄바꿈을 막지 않는다').toBe('nowrap');
});
