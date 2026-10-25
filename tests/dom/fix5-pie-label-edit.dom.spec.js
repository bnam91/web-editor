/* fix5-pie-label-edit.dom.spec.js — t4-17 「원형 그래프블럭 : 순위 및 이름표시 하는거 캔버스에서 직접 수정가능하게 (폰트 크기 및 스타일)」
 *
 * ★부모 실앱 실측(c278bc39 · 현빈 원 저장본 원 블럭 grb_84a7j_oruta47) — 이름 교집합 점 더블클릭이 블럭에 닿는데도 편집이 안 열렸다:
 *   블럭 _grbLabelEditBound = false. 위임 셋(라벨 · 축 눈금 더블클릭 · 값 라벨 끌기)은 renderGraph 만 걸었고, 불러오기(rebindAll)는
 *   그래프를 «방사형일 때만» 다시 그린다 ⇒ 저장본 그래프엔 위임이 0. 고침 = js/drag-utils.js bindGraphEdits «한 자리» + bindBlock(isGraph) 이 부른다.
 *
 * ★장면 «저장본» = 앱이 그린 섹션의 outerHTML 을 떠서 지우고, 그 글자를 새로 꽂은 뒤 rebindAll — 새 노드엔 JS 속성(_grb*Bound)이 없다(불러오기와 같은 꼴).
 * ★칸
 *   A0 불러온 원형 — 다시 안 그렸다(innerHTML 그대로) · 위임 가드 셋이 다 섰다
 *   A1 ⓐ 불러온 원형의 조각 안 이름(교집합 점)을 page.mouse 더블클릭 → 편집 열림 · 글 바꾸고 ⌘Enter(맨 Enter 는 줄바꿈 — 1017t1f6) ⇒ items[1].label · ⌘Z 한 번 = 옛 이름
 *   A2 불러온 막대(축 보이기) — 축 눈금 더블클릭 → 편집 열림(같은 길에서 빠져 있던 위임 ①)
 *   A3 불러온 꺾은선 — 값 라벨 고르고 끌면 items[i].vDx/vDy 가 선다(같은 길에서 빠져 있던 위임 ②)
 *   B1 ⓑ 패널 「이름 글자」 크기·굵기·기울임 → 이름 계산 스타일 · dataset · ⌘Z 한 번
 *   B2 ⓑ 패널 「순위 글자」 크기·굵기 → 순위 배지 계산 스타일 · dataset · ⌘Z 한 번
 *   B3 ⓑ 키가 없으면 인라인 0(옛 바이트) · 표시 토글이 꺼지면 그 글자 줄이 숨는다
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fix5-pie-label-edit.dom.spec.js --workers=1 --retries=0
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PIE_ITEMS = [{ label: '가', value: 40 }, { label: '나', value: 35 }, { label: '다', value: 25 }];
const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

/** 앱으로 그래프를 그린 뒤 그 섹션을 «글자»로 떠서 다시 꽂고 rebindAll — 저장본 불러오기와 같은 꼴(다시 그리기 0). */
async function setupSaved(page, { chartType, items, extra = {} }) {
  await page.setViewportSize({ width: 1400, height: 1100 });
  const errs = await bootApp(page);
  const r = await page.evaluate(({ chartType, items, extra }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="pS" data-section="1" style="background:#fff"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;"></div></div>');
    const { row, block } = window.makeGraphBlock();
    block.id = 'pG';
    block.dataset.chartType = chartType;
    block.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) block.dataset[k] = v;
    document.querySelector('#pS .section-inner').appendChild(row);
    window.renderGraph(block);
    const savedRow = row.outerHTML;
    row.remove();
    document.querySelector('#pS .section-inner').insertAdjacentHTML('beforeend', savedRow);   // ★새 노드 — _grb*Bound 0
    const g = document.getElementById('pG');
    const before = g.innerHTML;
    window.rebindAll?.();
    window.applyZoom?.(100);
    window.deselectAll?.();
    window.pushHistory?.('시험 기준');
    return { before, after: document.getElementById('pG').innerHTML, fresh: g === document.getElementById('pG') };
  }, { chartType, items, extra });
  await raf2(page);
  return { errs, ...r };
}
const bound = (page) => page.evaluate(() => { const g = document.getElementById('pG'); return [!!g._grbLabelEditBound, !!g._grbAxisTickEditBound, !!g._grbVLabelDragBound]; });
const itemsOf = (page) => page.evaluate(() => JSON.parse(document.getElementById('pG').dataset.items));

test('A0 불러온 원형 — 다시 안 그렸고 위임 가드 셋이 섰다', async ({ page }) => {
  const s = await setupSaved(page, { chartType: 'pie', items: PIE_ITEMS, extra: { pieRank: '1', pieName: '1' } });
  expect(s.fresh, '전제: 같은 노드').toBe(true);
  expect(s.after.replace(/ style="[^"]*--grb-[^"]*"/g, ''), '다시 그리지 않았다(저장본 바이트 무변 규약)').toBe(s.before.replace(/ style="[^"]*--grb-[^"]*"/g, ''));
  expect(await bound(page), '라벨 · 축 눈금 · 값 라벨 끌기 위임').toEqual([true, true, true]);
  expect(s.errs).toEqual([]);
});

test('A1 ⓐ 불러온 원형 — 조각 안 이름 교집합 점 더블클릭 → 편집 · ⌘Enter 확정 → items[1].label · ⌘Z 한 번', async ({ page }) => {
  const s = await setupSaved(page, { chartType: 'pie', items: PIE_ITEMS, extra: { pieRank: '1', pieName: '1' } });
  await waitStableRect(page, '#pG .grb-pie-name', { index: 1 });
  const pt = await page.evaluate(() => {
    const n = document.querySelectorAll('#pG .grb-pie-name')[1];
    const a = n.getBoundingClientRect(), b = n.closest('.grb-pie-tag').getBoundingClientRect();
    const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), t = Math.max(a.top, b.top), bt = Math.min(a.bottom, b.bottom);
    return (r > l && bt > t && n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) ? { x: (l + r) / 2, y: (t + bt) / 2 } : null;
  });
  expect(pt, '전제: 이름 1 이 보이고 상자와의 교집합이 있다').toBeTruthy();
  await page.mouse.dblclick(pt.x, pt.y);
  await page.waitForFunction(() => document.querySelectorAll('#pG .grb-pie-name')[1]?.isContentEditable === true, null, { timeout: 3000 });
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('새이름');
  await page.keyboard.press('Meta+Enter');
  await page.waitForFunction(() => !document.querySelector('#pG [contenteditable="true"]'));
  expect((await itemsOf(page))[1].label).toBe('새이름');
  expect((await itemsOf(page)).map(i => i.label), '다른 항목은 그대로').toEqual(['가', '새이름', '다']);
  expect(await page.evaluate(() => document.querySelectorAll('#pG .grb-pie-name')[1].textContent)).toBe('새이름');
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => JSON.parse(document.getElementById('pG')?.dataset.items || '[]')[1]?.label === '나', null, { timeout: 3000 });
  expect(s.errs).toEqual([]);
});

test('A2 불러온 막대(축 보이기) — 축 눈금 더블클릭 → 편집 열림', async ({ page }) => {
  const s = await setupSaved(page, { chartType: 'bar-v', items: PIE_ITEMS, extra: { showAxis: '1' } });
  const r = await waitStableRect(page, '#pG .grb-ov-tick', { index: 1 });
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForFunction(() => document.querySelectorAll('#pG .grb-ov-tick')[1]?.isContentEditable === true, null, { timeout: 3000 });
  await page.keyboard.press('Escape');
  expect(s.errs).toEqual([]);
});

test('A3 불러온 꺾은선 — 값 라벨 고르고 끌면 그 라벨 자리(vDx·vDy)가 선다', async ({ page }) => {
  const s = await setupSaved(page, { chartType: 'line', items: PIE_ITEMS });
  const r = await waitStableRect(page, '#pG .grb-line-vlabel', { index: 1 });
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.getElementById('pG').classList.contains('selected'));
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.querySelectorAll('#pG .grb-line-vlabel')[1].classList.contains('grb-vlabel-cell-selected'), null, { timeout: 3000 });
  await page.mouse.move(r.cx, r.cy);
  await page.mouse.down();
  await page.mouse.move(r.cx + 20, r.cy - 15, { steps: 6 });
  await page.mouse.move(r.cx + 40, r.cy - 30, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => { const it = JSON.parse(document.getElementById('pG').dataset.items)[1]; return !!(it.vDx || it.vDy); }, null, { timeout: 3000 });
  expect(s.errs).toEqual([]);
});

/* ═══ ⓑ 패널 — 이름/순위 글자 크기 · 굵기 · 기울임 ═══ */
const openPanel = (page) => page.evaluate(() => { const g = document.getElementById('pG'); window.deselectAll?.(); g.classList.add('selected'); window.showGraphProperties(g); });
const styleOf = (page, sel) => page.evaluate((sel) => {
  const e = document.querySelectorAll(sel)[0]; const cs = getComputedStyle(e); const tag = getComputedStyle(e.closest('.grb-pie-tag'));
  return { fs: parseFloat(cs.fontSize), tagFs: parseFloat(tag.fontSize), fw: cs.fontWeight, it: cs.fontStyle };
}, sel);
const dsOf = (page, k) => page.evaluate((k) => document.getElementById('pG').dataset[k] ?? null, k);
async function setNum(page, id, v) {
  await page.click(`#${id}`); await page.keyboard.press('Meta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
}

for (const [part, sel, Key] of [['name', '.grb-pie-name', 'pieName'], ['rank', '.grb-pie-rank', 'pieRank']]) {
  test(`B ${part} ⓑ 패널 「${part === 'name' ? '이름' : '순위'} 글자」 크기·굵기·기울임 → 계산 스타일 · dataset · ⌘Z 한 번`, async ({ page }) => {
    const s = await setupSaved(page, { chartType: 'pie', items: PIE_ITEMS, extra: { pieRank: '1', pieName: '1' } });
    await openPanel(page);
    await expect(page.locator(`#grb-pie-${part}-typo-row`)).toBeVisible();
    const labelSize = await page.evaluate(() => parseInt(document.getElementById('pG').dataset.labelSize) || window.GRAPH_LIMITS.LABEL_SIZE_DEFAULT);
    const base = await styleOf(page, `#pG ${sel}`);
    /* 크기 — 덧층 글자(= 라벨 크기 · 안 들면 단계로 줄인 크기) 대비 비로 싣는다 ⇒ 기대 px = v × 태그 글자 / 라벨 크기 */
    await setNum(page, `grb-pie-${part}-fs`, 30);
    await page.waitForFunction(([k]) => document.getElementById('pG').dataset[k + 'Fs'] === '30', [Key]);
    const a = await styleOf(page, `#pG ${sel}`);
    expect(Math.abs(a.fs - 30 * a.tagFs / labelSize), `크기 ${a.fs}px ≈ 30 × ${a.tagFs}/${labelSize}`).toBeLessThan(0.6);
    expect(a.fs, '크기가 실제로 바뀌었다').not.toBe(base.fs);
    await page.selectOption(`#grb-pie-${part}-fw`, '900');
    await page.click(`#grb-pie-${part}-it`);
    const b = await styleOf(page, `#pG ${sel}`);
    expect([b.fw, b.it]).toEqual(['900', 'italic']);
    expect([await dsOf(page, Key + 'Fw'), await dsOf(page, Key + 'It')]).toEqual(['900', '1']);
    /* 다시 그려도 남는다(값의 진실 = dataset) */
    await page.evaluate(() => window.renderGraph(document.getElementById('pG')));
    expect((await styleOf(page, `#pG ${sel}`)).it).toBe('italic');
    /* ⌘Z 한 번 = 기울임만 되돌린다 */
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await page.waitForFunction(([k]) => document.getElementById('pG')?.dataset[k + 'It'] === undefined, [Key], { timeout: 3000 });
    expect(await dsOf(page, Key + 'Fw'), '⌘Z 한 번은 한 걸음(굵기는 남는다)').toBe('900');
    expect((await styleOf(page, `#pG ${sel}`)).it).toBe('normal');
    expect(s.errs).toEqual([]);
  });
}

test('B3 ⓑ 키가 없으면 인라인 0(옛 바이트) · 표시 토글이 꺼지면 그 글자 줄이 숨는다', async ({ page }) => {
  const s = await setupSaved(page, { chartType: 'pie', items: PIE_ITEMS, extra: { pieRank: '1', pieName: '1' } });
  const h = await page.evaluate(() => document.getElementById('pG').innerHTML);
  expect(h).toMatch(/<span class="grb-pie-rank">/);
  expect(h).toMatch(/<span class="grb-pie-name">/);
  await openPanel(page);
  await expect(page.locator('#grb-pie-name-typo-row')).toBeVisible();
  await page.locator('#grb-pie-name-toggle').evaluate((el) => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('#grb-pie-name-typo-row')).toBeHidden();
  await expect(page.locator('#grb-pie-rank-typo-row')).toBeVisible();
  expect(s.errs).toEqual([]);
});
