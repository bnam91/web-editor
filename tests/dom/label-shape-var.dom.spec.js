/* label-shape-var.dom.spec.js — 라벨 «모양 변수»(B1 · 현빈 261114: 타원·커스텀 라벨 모양을 좌측 디자인 관리에 변수로 → 새 라벨마다 적용 → 우측 패널 «변수 사용 중»)
 *   진짜 길: 좌측 Inspector 탭 → «Design System» 펼침 → «라벨 모양 변수» «＋ 라벨 모양 추가» → 이름 → 행 · ☆ 기본 · 텍스트 ▾ «Tags»
 *   V1 좌측 패널에서 만든다 — 이름 «oval» → 행 · 미리보기 칩 · 종류 기본 «타원»
 *   V2 ☆ 기본 → 새 라벨 블럭(텍스트 ▾ Tags)의 칸 전부 data-label-shape=oval · 그려진 모서리 = 타원(50%) · 배경 = 변수 값
 *   V3 변수를 고치면(좌측 배경색) 이미 쓰는 라벨이 따라 바뀐다(그려진 배경)
 *   V4 우측 패널 — 칸을 고르면 «변수 oval 사용 중» · 배경/모서리 칸 대신 · 끊기 → 표식 0 · 그려진 꼴 그대로 · 배경 칸이 돌아온다
 *   V5 바꾸기 — 변수 둘이면 select 로 다른 변수에 다시 건다(꼴이 그 변수로)
 *   V6 «＋» 로 칸을 더하면 새 칸도 같은 변수(참조)
 *   V7 기본이 없으면 새 라벨 블럭은 예전 그대로(표식 0 · 옛 기본색) — 무회귀
 *   V8 지우면 쓰던 라벨은 지금 꼴 그대로 남고 표식만 빠진다
 * 양성대조:
 *   · js/block-factory.js `_labelDefaultShape(block, opts);` 세 줄을 지우면 V2·V6 빨강(V6 은 전제에서)
 *   · js/design-system.js _setLabelShapes 의 `applyLabelShapes();` 를 지우면 V3 빨강(:root 변수도 칸 대체값도 안 바뀐다)
 *   · js/props/prop-label-group.js `_rebind(null)` 의 unbind 줄을 지우면 V4 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    try { localStorage.removeItem('we_label_shapes_v1'); } catch {}
    await window.DesignSystem.restoreLabelShapesFromMeta(null);   // 빈 목록으로(하네스는 프로젝트 없음)
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.deselectAll?.(); window.selectSection(c.querySelector('.section-block'));
  });
  return errs;
}
async function openDs(page) {
  await page.click('.panel-tab[data-tab="inspector"]');
  const open = await page.evaluate(() => document.getElementById('design-system-panel').classList.contains('open'));
  if (!open) await page.click('#ds-panel-header');
  await expect(page.locator('#ds-labelshape-add-btn')).toBeVisible();
}
async function addShape(page, name) {
  await page.click('#ds-labelshape-add-btn');
  // 입력칸 id = «id + '-input'»(js/design-system.js _openInlineNameForm — 폼은 '-form') · 인텔 961de8832: '#ds-labelshape-name' 로 기다리다 30s
  await page.fill('#ds-labelshape-name-input', name);
  await page.press('#ds-labelshape-name-input', 'Enter');
  await page.waitForSelector(`#ds-labelshapes-list .ds-labelshape-row[data-name="${name}"]`);
}
async function addTags(page) {
  const before = await page.locator('#canvas .label-group-block').count();
  await page.click('#fp-text-dropdown .fp-dropdown-trigger');
  await page.click('#fp-text-dropdown .fp-menu-item:has-text("Tags")');
  await expect(page.locator('#canvas .label-group-block')).toHaveCount(before + 1);
  return page.evaluate(() => { const b = [...document.querySelectorAll('#canvas .label-group-block')].pop(); b.id = b.id || 'lg_qa'; return b.id; });
}
const looks = (page, id) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .label-item`)].map((i) => {
  const cs = getComputedStyle(i); return { shape: i.dataset.labelShape ?? null, bg: cs.backgroundColor, r: cs.borderTopLeftRadius };
}), id);

test('V1 좌측 패널에서 만든다', async ({ page }) => {
  const errs = await boot(page);
  await openDs(page);
  await addShape(page, 'oval');
  const r = await page.evaluate(() => { const row = document.querySelector('.ds-labelshape-row[data-name="oval"]');
    return { kind: row.querySelector('.ds-labelshape-kind').value, prev: !!row.querySelector('.ds-labelshape-preview'), store: Object.keys(window.DesignSystem.getLabelShapes().shapes) }; });
  expect(r).toEqual({ kind: 'ellipse', prev: true, store: ['oval'] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 기본 → 새 라벨 블럭에 자동', async ({ page }) => {
  const errs = await boot(page);
  await openDs(page);
  await addShape(page, 'oval');
  await page.click('.ds-labelshape-row[data-name="oval"] .ds-labelshape-default');
  expect(await page.evaluate(() => window.DesignSystem.getLabelShapes().defaultName)).toBe('oval');
  const id = await addTags(page);
  const L = await looks(page, id);
  expect(L.length, '[전제] 칸 3').toBe(3);
  for (const x of L) { expect(x.shape).toBe('oval'); expect(x.bg).toBe('rgb(17, 17, 17)'); expect(x.r).toBe('50%'); }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V3 변수를 고치면 쓰는 라벨이 따라 바뀐다', async ({ page }) => {
  const errs = await boot(page);
  await openDs(page);
  await addShape(page, 'oval');
  await page.click('.ds-labelshape-row[data-name="oval"] .ds-labelshape-default');
  const id = await addTags(page);
  await page.evaluate(() => { const i = document.querySelector('.ds-labelshape-row[data-name="oval"] .ds-labelshape-bg'); i.value = '#ff0000'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(async () => (await looks(page, id)).map((x) => x.bg)).toEqual(['rgb(255, 0, 0)', 'rgb(255, 0, 0)', 'rgb(255, 0, 0)']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function boundBlock(page, names = ['oval']) {
  for (const n of names) await addShape(page, n);
  await page.click(`.ds-labelshape-row[data-name="${names[0]}"] .ds-labelshape-default`);
  const id = await addTags(page);
  await page.evaluate((id) => { const b = document.getElementById(id); const it = b.querySelector('.label-item'); it.classList.add('item-selected'); window.showLabelGroupProperties(b, it); }, id);
  return id;
}

test('V4 우측 패널 «변수 사용 중» · 끊기', async ({ page }) => {
  const errs = await boot(page);
  await openDs(page);
  const id = await boundBlock(page);
  await expect(page.locator('#lg-shape-bound')).toContainText('oval');
  await expect(page.locator('#lg-item-bg-color'), '변수 쓰는 동안은 배경 칸이 없다').toHaveCount(0);
  const before = (await looks(page, id))[0];
  await page.click('#lg-shape-unlink');
  const after = (await looks(page, id))[0];
  expect(after.shape, '★끊었는데 표식이 남았다').toBeNull();
  expect([after.bg, after.r], '끊어도 겉모양은 그대로').toEqual([before.bg, before.r]);
  await expect(page.locator('#lg-item-bg-color')).toHaveCount(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V5 바꾸기 — 다른 변수로', async ({ page }) => {
  const errs = await boot(page);
  await openDs(page);
  const id = await boundBlock(page, ['oval', 'tagx']);
  await page.evaluate(() => { const s = document.querySelector('.ds-labelshape-row[data-name="tagx"] .ds-labelshape-kind'); s.value = 'round'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate((id) => { const b = document.getElementById(id); window.showLabelGroupProperties(b, b.querySelector('.label-item')); }, id);
  await page.selectOption('#lg-shape-switch', 'tagx');
  const first = (await looks(page, id))[0];
  expect(first.shape).toBe('tagx');
  expect(first.r).toBe('8px');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V6 «＋» 새 칸도 같은 변수', async ({ page }) => {
  const errs = await boot(page);
  await openDs(page);
  const id = await boundBlock(page);
  // ＋ 는 블럭의 click 위임(block-drag.js)이 받는다 — 보이기 조건(선택)과 무관하게 그 단추의 click 을 낸다
  await page.evaluate((id) => document.querySelector(`#${id} .label-group-add-btn`).click(), id);
  const L = await looks(page, id);
  expect(L.length).toBe(4);
  expect(L[3].shape, '★＋ 로 더한 칸이 변수에 안 걸렸다').toBe('oval');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V7 기본 없음 → 예전 그대로', async ({ page }) => {
  const errs = await boot(page);
  const id = await addTags(page);
  const L = await looks(page, id);
  expect(L.every((x) => x.shape === null)).toBe(true);
  expect(L[0].bg).toBe('rgb(232, 232, 232)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V8 지우면 쓰던 라벨은 꼴 그대로 · 표식만 빠짐', async ({ page }) => {
  const errs = await boot(page);
  await openDs(page);
  const id = await boundBlock(page);
  const before = (await looks(page, id))[0];
  page.once('dialog', (d) => d.accept());
  await page.click('.ds-labelshape-row[data-name="oval"] .ds-colorvar-del[title^="삭제"]');
  await page.waitForFunction(() => !document.querySelector('.ds-labelshape-row[data-name="oval"]'));
  const after = (await looks(page, id))[0];
  expect(after.shape).toBeNull();
  expect([after.bg, after.r]).toEqual([before.bg, before.r]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
