/* t0-graph-vlabel-handles-1017t1f5.dom.spec.js — 1017t1f5 👉 뒤 ⓐⓑⓒ
 *
 * ★현빈 원문(T0-NOTE-ORIGINAL-261025.txt :13 의 👉 뒤)
 *   「잘되는데 해당 값 선택시 아웃라인에 모서리핸들 넣어서 크기 조절 및 텍스트 수정 가능하게해줘」
 *   ⇒ 칸 셋: ⓐ 고른 값 라벨의 아웃라인에 모서리 핸들 · ⓑ 그 핸들로 크기 조절 · ⓒ 텍스트 수정
 * ★잰 사람(S3 · t8 재채점 · 판 f62653ce) — 고르면 점선 아웃라인뿐 · 핸들 0 · 글자 21px 그대로 · 더블클릭해도 편집 안 됨(끌기는 됨 = 대조).
 * ★고침 — ⓐ 고른 라벨 둘레에 모서리 핸들 넷(캔버스 «밖» 고정 층 · 저장 대상 아님) · ⓑ 모서리를 끌면 그 라벨만 글자 크기가 바뀐다
 *   (items[i].vFs) · ⓒ 더블클릭 = 카테고리 라벨과 같은 편집 문(그 라벨만 · items[i].vText · 값은 안 바뀐다).
 *
 * ★칸
 *   P  전제 — 꺾은선(항목 셋) · 1번 라벨을 사람 길(두 번 누름)로 골랐다 · 끌기는 원래 된다(대조는 graph-line-vlabel-drag V4)
 *   H1 ⓐ 고르면 그 라벨 사각형 네 모서리 각각 6px 안에 «보이는 핸들»이 있다 · 고르기를 풀면(빈 데 누름) 핸들 0
 *   H2 ⓑ 오른아래 핸들을 바깥으로 (+40,+40) 끌면 그 라벨 글자가 커진다(계산된 font-size) · 다른 라벨은 그대로 ·
 *      다시 그려도(renderGraph) 남는다 · ⌘Z 한 번이면 끌기 전 크기
 *   H3 ⓒ 그 라벨을 더블클릭하면 편집이 열린다(isContentEditable) · 「40명」 + Enter ⇒ 그 라벨 글이 「40명」 · 다시 그려도 남는다 ·
 *      항목 값(value)과 다른 라벨 글은 그대로
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/t0-graph-vlabel-handles-1017t1f5.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const ITEMS = [{ label: '1월', value: 10 }, { label: '2월', value: 40 }, { label: '3월', value: 25 }];

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ items }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="lnS" data-section="1" style="background:#fff"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;"></div></div>');
    const { row, block } = window.makeGraphBlock();
    block.id = 'lnG';
    block.dataset.chartType = 'line';
    block.dataset.items = JSON.stringify(items);
    document.querySelector('#lnS .section-inner').appendChild(row);
    window.renderGraph(block);
    window.rebindAll?.();
    window.deselectAll?.();
  }, { items: ITEMS });
  await waitStableRect(page, '#lnG .grb-line-vlabel', { index: 1 });
  return errs;
}

/** 1번 라벨을 사람 길로 고른다 — 첫 누름 = 블럭, 같은 자리 한 번 더 = 그 라벨. */
async function pick1(page) {
  const r = await waitStableRect(page, '#lnG .grb-line-vlabel', { index: 1 });
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.getElementById('lnG').classList.contains('selected'));
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.querySelectorAll('#lnG .grb-line-vlabel')[1].classList.contains('grb-vlabel-cell-selected'), null, { timeout: 3000 });
}

/** 라벨 i 의 네 모서리 각각에 가장 가까운 «보이는 핸들»까지의 거리(px). 핸들이 없으면 Infinity. */
const cornerHandleDist = (page, i) => page.evaluate((i) => {
  const L = document.querySelectorAll('#lnG .grb-line-vlabel')[i].getBoundingClientRect();
  const hs = [...document.querySelectorAll('[class*="handle"]')].filter((h) => {
    const r = h.getBoundingClientRect(); const cs = getComputedStyle(h);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }).map((h) => { const r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  return [[L.left, L.top], [L.right, L.top], [L.right, L.bottom], [L.left, L.bottom]]
    .map(([x, y]) => hs.reduce((m, h) => Math.min(m, Math.hypot(h.x - x, h.y - y)), Infinity));
}, i);

const fontPx = (page) => page.evaluate(() => [...document.querySelectorAll('#lnG .grb-line-vlabel')].map((l) => parseFloat(getComputedStyle(l).fontSize)));

test('P·H1 ⓐ 고른 값 라벨 네 모서리에 핸들 · 풀면 0', async ({ page }) => {
  const errs = await setup(page);
  await pick1(page);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const d = await cornerHandleDist(page, 1);
  d.forEach((v, k) => expect(v, `H1 모서리 ${['nw', 'ne', 'se', 'sw'][k]} 핸들 거리 ${v}`).toBeLessThan(6));
  /* 고르기 풀기 — 섹션 빈 자리(블럭 밖)를 누른다 */
  const s = await waitStableRect(page, '#lnS');
  await page.mouse.click(s.left + 6, s.top + s.height - 6);
  await page.waitForFunction(() => !document.querySelector('#lnG .grb-vlabel-cell-selected'), null, { timeout: 3000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const d2 = await cornerHandleDist(page, 1);
  expect(d2.every((v) => v > 6), `H1 풀면 모서리 핸들 0 (${d2})`).toBe(true);
  expect(errs).toEqual([]);
});

test('H2 ⓑ 오른아래 핸들을 끌면 그 라벨만 커지고 · 다시 그려도 남고 · ⌘Z 한 번에 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await pick1(page);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const f0 = await fontPx(page);
  const se = await page.evaluate(() => {
    const L = document.querySelectorAll('#lnG .grb-line-vlabel')[1].getBoundingClientRect();
    const h = [...document.querySelectorAll('[class*="handle"]')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; })
      .filter((p) => p.w > 0).sort((a, b) => Math.hypot(a.x - L.right, a.y - L.bottom) - Math.hypot(b.x - L.right, b.y - L.bottom))[0];
    return h && Math.hypot(h.x - L.right, h.y - L.bottom) < 6 ? h : null;
  });
  expect(se, 'H2 전제: 오른아래 핸들').not.toBeNull();
  await page.mouse.move(se.x, se.y);
  await page.mouse.down();
  await page.mouse.move(se.x + 20, se.y + 20, { steps: 4 });
  await page.mouse.move(se.x + 40, se.y + 40, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction((f) => parseFloat(getComputedStyle(document.querySelectorAll('#lnG .grb-line-vlabel')[1]).fontSize) > f + 2, f0[1], { timeout: 3000 });
  const f1 = await fontPx(page);
  expect(f1[1], `H2 1번 글자 ${f0[1]} → ${f1[1]}`).toBeGreaterThan(f0[1] + 2);
  expect([f1[0], f1[2]], 'H2 다른 라벨 그대로').toEqual([f0[0], f0[2]]);
  await page.evaluate(() => window.renderGraph(document.getElementById('lnG')));
  expect((await fontPx(page))[1], 'H2 다시 그려도 남는다').toBe(f1[1]);
  await page.keyboard.press('Meta+z');
  await page.waitForFunction((f) => Math.abs(parseFloat(getComputedStyle(document.querySelectorAll('#lnG .grb-line-vlabel')[1]).fontSize) - f) < 0.01, f0[1], { timeout: 3000 });
  expect(errs).toEqual([]);
});

test('H3 ⓒ 더블클릭 ⇒ 편집 · 「40명」 Enter ⇒ 그 라벨 글만 바뀌고 값은 그대로', async ({ page }) => {
  const errs = await setup(page);
  await pick1(page);
  const r = await waitStableRect(page, '#lnG .grb-line-vlabel', { index: 1 });
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForFunction(() => document.querySelectorAll('#lnG .grb-line-vlabel')[1].isContentEditable, null, { timeout: 3000 });
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('40명');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const l = document.querySelectorAll('#lnG .grb-line-vlabel')[1]; return !l.isContentEditable && l.textContent.trim() === '40명'; }, null, { timeout: 3000 });
  await page.evaluate(() => window.renderGraph(document.getElementById('lnG')));
  const s = await page.evaluate(() => {
    const b = document.getElementById('lnG');
    return { texts: [...b.querySelectorAll('.grb-line-vlabel')].map((l) => l.textContent.trim()), values: JSON.parse(b.dataset.items).map((it) => it.value) };
  });
  expect(s.texts, 'H3 그 라벨만 「40명」 · 다시 그려도 남는다').toEqual(['10', '40명', '25']);
  expect(s.values, 'H3 값은 그대로').toEqual([10, 40, 25]);
  expect(errs).toEqual([]);
});
