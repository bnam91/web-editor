/* fix5-t417-x.dom.spec.js — t4-17 ⓑ 원형 「순위 글자」·「이름 글자」 크기 칸(#grb-pie-{rank,name}-fs)의 적대 검토 빨강 셋을 못 박는다.
 *
 * ★병(base 543f5de6)
 *   X1 (지디 16:11 정정) 좁은 조각은 grbPieFitTags 가 덧층 글자를 단계로 줄인다(끝 단계 8 · 설계) — 그런데 placeholder 는 «20» 만 보여 비운 뒤의 8 과 어긋났다.
 *      빈 칸 = 키 삭제 = 기본 복귀는 «설계»다(placeholder 가 그 뜻을 선언 · 지디 갈래 C 판정 2026-10-26) — 좁은 조각이면 8 로 그려지는 것이 맞다.
 *   X7 오타 「1e」 — type=number 는 무효 글자를 value '' 로 준다 ⇒ X1 과 같은 길로 키가 조용히 지워진다(30 → 기본).
 *   X4 placeholder 가 HTML 을 그릴 때 박힌 수(배지 0.7 은 JS 손글씨 · css 와 두 벌) — 패널을 연 채 라벨 크기를 28 로 바꿔도 20/14.
 * ★고침
 *   X1 = placeholder 「20(좁아서 n)」(갈래 ㉡ · _pieTagFsShown 이 그려진 덧층 글자에서 min 을 잰다 · grb-pie-fit 뒤에 다시 단다)
 *   X7 = 공용 가드(prop-number-commit-guard.js)의 badInput 갈래 «한 자리» — 칸이 무엇을 선언했든 오타는 커밋 없음 + 이전 표시값(핸들러 무변).
 *        여러 모듈 칸에서 같은 자리가 잡는지는 fix5-t417-x-badinput.dom.spec.js 가 잰다.
 *   X4 = 라벨 크기 배선(applyLabelSize)이 _syncPieTagPh 를 부른다 · placeholder 의 한 자리 _pieTagFsPh(prop-graph.js) · 배지 비는 css 변수 --grb-pie-rank-em 한 자리에서 읽는다 ·
 *        라벨 크기 배선·순위 토글이 _syncPieTagPh 로 다시 단다.
 * ★칸
 *   X1a 이름 30 넣고 · 비우고 Enter → 키 삭제 · 칸 '' · 그려진 크기 = 키 넣기 전 기본
 *   X1b 순위 — 같은 것
 *   X1c 이름 — 비우고 Tab(blur 커밋) → 같은 것
 *       (X1a~c 는 base 에서도 초록일 수 있다 — 빈 칸 = 키 삭제는 옛 판의 거동이기도 하다. 갈래 C 가 그것을 «안 깨뜨림»을 잠그는 칸)
 *   X1d 좁은 조각(grbPieFitTags 가 줄임) — placeholder 「20(좁아서 n)」 · n = 그려진 가장 작은 크기 · 넓은 원 「20」(갈래 ㉡)
 *   X7  이름 = 30 · 「1e」 Enter → 키 30 · 칸 30(되돌림) · 크기 그대로
 *   X4a 패널을 연 채 라벨 크기 28 → placeholder 28 / round(28 × 배지 비)
 *   X4b 배지 비를 css 변수로 바꾸면 placeholder 가 따른다(JS 에 0.7 이 다시 박히면 빨강) · 다시 그린 패널도 같은 값
 *   P1 양성대조 — 칸에 25 Enter → 키 25 · 그려진 크기 바뀜(규약이 정상 입력을 막지 않는다)
 * 양성대조: GD1001_ROOT=<543f5de6 사본> ⇒ X1d·X7·X4a·X4b 빨강 · X1a~c·P1 초록(빈 칸 = 키 삭제는 옛 판도 같다).
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fix5-t417-x.dom.spec.js --workers=1 --retries=0
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PIE_ITEMS = [{ label: '가', value: 40 }, { label: '나', value: 35 }, { label: '다', value: 25 }];
const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

async function setup(page, extra = {}) {
  await page.setViewportSize({ width: 1400, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(({ items, extra }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="pS" data-section="1" style="background:#fff"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;"></div></div>');
    const { row, block } = window.makeGraphBlock();
    block.id = 'pG';
    block.dataset.chartType = 'pie';
    block.dataset.items = JSON.stringify(items);
    Object.assign(block.dataset, { pieRank: '1', pieName: '1' }, extra);
    document.querySelector('#pS .section-inner').appendChild(row);
    window.renderGraph(block);
    window.applyZoom?.(100);
    window.deselectAll?.();
    block.classList.add('selected');
    window.showGraphProperties(block);
    window.pushHistory?.('시험 기준');
  }, { items: PIE_ITEMS, extra });
  await raf2(page);
  return errs;
}
const KEY = { name: 'pieNameFs', rank: 'pieRankFs' };
const SEL = { name: '.grb-pie-name', rank: '.grb-pie-rank' };
const read = (page, part) => page.evaluate(([k, sel, id]) => {
  const g = document.getElementById('pG'); const f = document.getElementById(id);
  return { key: g.dataset[k] ?? null, field: f.value, px: parseFloat(getComputedStyle(g.querySelector(sel)).fontSize) };
}, [KEY[part], SEL[part], `grb-pie-${part}-fs`]);
const phOf = (page) => page.evaluate(() => ({ name: document.getElementById('grb-pie-name-fs').placeholder, rank: document.getElementById('grb-pie-rank-fs').placeholder }));
/** 진짜 키보드 — 칸을 고르고 전부 지운 뒤(Backspace) 글자를 치고 확정 키. */
async function typeIn(page, part, text, commitKey = 'Enter') {
  await page.click(`#grb-pie-${part}-fs`);
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  if (text) await page.keyboard.type(text);
  await page.keyboard.press(commitKey);
  await raf2(page);
}

for (const [id, part, commitKey] of [['X1a', 'name', 'Enter'], ['X1b', 'rank', 'Enter'], ['X1c', 'name', 'Tab']]) {
  test(`${id} ${part} 30 넣고 · 비우고 ${commitKey} → 키 삭제 = 기본 복귀(그려진 크기 = 넣기 전)`, async ({ page }) => {
    const errs = await setup(page);
    const def = await read(page, part);
    expect(def, '전제: 키 없음 · 칸 빈').toMatchObject({ key: null, field: '' });
    await typeIn(page, part, '30');
    expect((await read(page, part)).key, '전제: 30 이 들어갔다').toBe('30');
    await typeIn(page, part, '', commitKey);
    const after = await read(page, part);
    expect(after.key, '빈 칸 = 키 삭제(칸의 뜻 = 기본 복귀)').toBe(null);
    expect(after.field, '칸은 빈 채(placeholder 가 기본을 보인다)').toBe('');
    expect(after.px, `그려진 크기 = 키 넣기 전 기본(${def.px})`).toBe(def.px);
    expect(errs).toEqual([]);
  });
}

/* X1d — 좁은 조각은 grbPieFitTags 가 덧층 글자를 단계로 줄인다(설계 · 끝 단계 8). 키가 없을 때 칸의 placeholder 가 «20» 만 보이면 거짓이다
   ⇒ 갈래 ㉡: 「20(좁아서 n)」 · n = 보이는 라벨 중 «실제로 그려진» 가장 작은 크기(재는 자 = 그려진 computedStyle · 패널 함수와 따로 잰다). 넓은 원은 「20」 그대로. */
test('X1d 좁은 조각 — placeholder 가 줄인 크기를 알린다(「20(좁아서 n)」 · n = 그려진 가장 작은 크기) · 넓은 원은 「20」', async ({ page }) => {
  const items = [{ label: '가', value: 80 }, { label: '나', value: 14 }, { label: '아주아주긴이름입니다', value: 6, pieTag: 'on' }];
  const errs = await setup(page);
  expect(await phOf(page), '넓은 원(줄인 조각 0) = 기본 그대로').toEqual({ name: '20', rank: '14' });
  await page.evaluate((items) => { const g = document.getElementById('pG'); g.dataset.items = JSON.stringify(items); window.renderGraph(g); window.showGraphProperties(g); }, items);
  await raf2(page);
  const drawn = await page.evaluate(() => {
    const g = document.getElementById('pG'); const vis = (e) => e && getComputedStyle(e).display !== 'none' && getComputedStyle(e.closest('.grb-pie-tag')).display !== 'none';
    const px = (sel) => [...g.querySelectorAll(sel)].filter(vis).map(e => parseFloat(getComputedStyle(e).fontSize));
    return { name: px('.grb-pie-name'), rank: px('.grb-pie-rank') };
  });
  const nMin = Math.round(Math.min(...drawn.name)), rMin = Math.round(Math.min(...drawn.rank));
  expect(nMin, `전제: 좁은 조각의 이름이 줄어 그려졌다(${drawn.name})`).toBeLessThan(20);
  expect(await phOf(page), `그려진 가장 작은 크기 이름 ${drawn.name} · 순위 ${drawn.rank}`).toEqual({ name: `20(좁아서 ${nMin})`, rank: rMin < 14 ? `14(좁아서 ${rMin})` : '14' });
  expect(errs).toEqual([]);
});

test('X7 이름 = 30 · 오타 「1e」 Enter → 거부 · 키 30 · 칸 30 으로 되돌림', async ({ page }) => {
  const errs = await setup(page, { pieNameFs: '30' });
  const before = await read(page, 'name');
  await typeIn(page, 'name', '1e');
  const after = await read(page, 'name');
  expect(after.key, '오타가 키를 조용히 지우지 않는다').toBe('30');
  expect(after.field, '칸 = 이전 값').toBe('30');
  expect(after.px).toBe(before.px);
  expect(errs).toEqual([]);
});

test('X4a 패널을 연 채 라벨 크기 28 → placeholder 가 따른다(이름 28 · 순위 = 그려진 배지)', async ({ page }) => {
  const errs = await setup(page);
  const ph0 = await phOf(page);
  /* 배지 비 = «그려진» 배지 ÷ 덧층 글자(키 없음) — 변수 이름에 기대지 않는다(옛 판에서도 같은 자로 잰다) */
  const em = await page.evaluate(() => { const g = document.getElementById('pG');
    return parseFloat(getComputedStyle(g.querySelector('.grb-pie-rank')).fontSize) / parseFloat(getComputedStyle(g.querySelector('.grb-pie-tag')).fontSize); });
  expect(em, '전제: 배지가 덧층보다 작게 그려진다').toBeGreaterThan(0);
  expect(em).toBeLessThan(1);
  expect(ph0, '전제: 라벨 20 의 기본').toEqual({ name: '20', rank: String(Math.round(20 * em)) });
  await page.click('#grb-label-number');
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('28');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('pG').dataset.labelSize === '28');
  /* 앞 수 = 기본(라벨 크기 기준) · 큰 라벨이면 좁은 조각이 줄어 「(좁아서 n)」 이 붙을 수 있다(X1d 가 따로 잰다) ⇒ 앞 수만 본다 */
  const ph = await phOf(page);
  expect({ name: parseInt(ph.name), rank: parseInt(ph.rank) }, `라벨 28 → 이름 28 · 순위 round(28 × 비) (${JSON.stringify(ph)})`).toEqual({ name: 28, rank: Math.round(28 * em) });
  /* 키가 없으면 placeholder = 그려진 크기(덧층을 안 줄인 판에서) — 이름은 그대로 맞는다 */
  const namePx = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#pG .grb-pie-name')).fontSize));
  const tagPx = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#pG .grb-pie-tag')).fontSize));
  if (tagPx === 28) expect(namePx, '이름 그려진 크기 = placeholder').toBe(28);
  expect(errs).toEqual([]);
});

test('X4b 배지 비를 css 변수로 바꾸면 placeholder 가 따른다 · 다시 그린 패널도 같은 값(한 자리)', async ({ page }) => {
  const errs = await setup(page);
  await page.addStyleTag({ content: '#pG .grb-pie-rank { --grb-pie-rank-em: 0.5; }' });
  await raf2(page);
  const rankPx = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#pG .grb-pie-rank')).fontSize));
  expect(rankPx, '전제: 그려진 배지가 그 변수를 읽는다(20 × 0.5)').toBe(10);
  await page.evaluate(() => window.showGraphProperties(document.getElementById('pG')));
  expect(parseInt((await phOf(page)).rank), '다시 그린 패널 — 배지 placeholder 앞 수 = 그려진 배지 10').toBe(10);
  /* 패널을 연 채 라벨 크기 → 같은 함수 */
  await page.click('#grb-label-number');
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('24');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('pG').dataset.labelSize === '24');
  const ph = await phOf(page);
  expect({ name: parseInt(ph.name), rank: parseInt(ph.rank) }, `라벨 24 · 비 0.5 → 24 / 12 (${JSON.stringify(ph)})`).toEqual({ name: 24, rank: 12 });
  expect(errs).toEqual([]);
});

test('P1 양성대조 — 칸에 25 Enter → 키 25 · 그려진 크기 바뀜(규약이 정상 입력을 안 막는다)', async ({ page }) => {
  const errs = await setup(page, { pieNameFs: '30' });
  const before = await read(page, 'name');
  await typeIn(page, 'name', '25');
  const after = await read(page, 'name');
  expect(after).toMatchObject({ key: '25', field: '25' });
  expect(after.px).not.toBe(before.px);
  expect(errs).toEqual([]);
});
