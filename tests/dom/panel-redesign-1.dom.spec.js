/* panel-redesign-1 — 우측 패널 재설계 «적용 1차»(현빈 확정 261120 · PLAN.md «적용 1차 261120»). 항목마다 한 칸 + CTL 패치(_patches/prd1-*.patch).
 * ★CTL = 제품 코드를 옛 꼴로 되돌린 패치 — 그 패치를 붙인 판에서 해당 칸이 빨강이어야 이 칸이 무엇을 잰다(사람이 돌린다 · 붙여 두지 않는다).
 * 앱 통째(bootApp) · 헤드리스 · CDP·라이브 인스턴스 무접촉.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; window.clearHistory?.(); });
  return errs;
}
async function open(page, cls, entry) {
  const r = await addKind(page, { cls, entry });
  expect(r.err, `[전제] ${cls} 를 넣었다`).toBeUndefined();
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#panel-right .prop-section[data-sec]').first(), `[전제] ${cls} 패널(틀)`).toBeAttached();
  return r.id;
}

/* ① 표준 절 머리 — 쉐브론·클릭 접기 없음. CTL prd1-01-chevron.patch(머리에 role/aria-expanded 되살림) → 빨강 */
test('P1 절 머리 = 제목만 · 눌러도 안 접힘(텍스트 패널 모든 절)', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec] > .prop-sec-head > .prop-section-title')]
    .map((h) => ({ id: h.id, svg: h.querySelectorAll('svg').length, exp: h.getAttribute('aria-expanded'), role: h.getAttribute('role') })));
  expect(r.length, '[전제] 절 머리가 있다').toBeGreaterThan(3);
  for (const h of r) expect([h.id, h.svg, h.exp, h.role], `★${h.id} 에 접기 손잡이가 남았다`).toEqual([h.id, 0, null, null]);
  for (const h of r) {
    await page.locator(`#${h.id}`).click();
    await expect(page.locator(`#${h.id.replace(/-head$/, '-body')}`), `★${h.id} 를 누르니 몸이 숨었다`).not.toHaveAttribute('hidden', '');
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ② 절 제목 색 한 규칙(빈 절도) + 간격 12 · 12 · 16. CTL prd1-02-title.patch(제목 색 토큰을 --ui-text-sub 로) → 빨강 */
test('P2 모든 절 제목 색 = --ui-text(빈 Stroke·Effects 도) · 머리 위아래 = --ui-space-3', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const probe = document.createElement('span'); probe.style.color = 'var(--ui-text)'; document.body.appendChild(probe);
    const want = getComputedStyle(probe).color; probe.remove();
    const sp3 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-space-3'));
    return { want, sp3, heads: [...document.querySelectorAll('#panel-right .prop-section[data-sec] > .prop-sec-head > .prop-section-title')].map((h) => {
      const t = h.querySelector('.prop-sec-title-text'), cs = getComputedStyle(h);
      return { id: h.id, color: getComputedStyle(t).color, op: getComputedStyle(t).opacity, pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom) };
    }) };
  });
  expect(r.heads.map((h) => h.id), '[전제] 빈 절(Effects) 머리도 쟀다').toContain('txt-fx-section-head');
  for (const h of r.heads) expect([h.id, h.color, h.op, h.pt, h.pb], `★${h.id} 제목 색·간격`).toEqual([h.id, r.want, '1', r.sp3, r.sp3]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑦ 숫자 칸 스피너 없음 · ↑↓ 키로 값이 바뀐다. CTL prd1-07-spin.patch(스피너 걷는 규칙 삭제) → 빨강 */
test('P7 우측 패널 숫자 칸 — 스피너 없음(appearance textfield) · ↑ 키로 1 오른다', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const ap = await page.evaluate(() => [...document.querySelectorAll('#panel-right input[type="number"]')].map((i) => getComputedStyle(i).appearance));
  expect(ap.length, '[전제] 숫자 칸이 있다').toBeGreaterThan(3);
  expect([...new Set(ap)], '★스피너가 남은 숫자 칸').toEqual(['textfield']);
  const n = page.locator('#txt-x-number');
  const v0 = Number(await n.inputValue());
  await n.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => Number(await n.inputValue()), '★↑ 키로 값이 안 바뀐다').toBe(v0 + 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑪ 정렬 · B I U S 켜짐 = Figma 식(파란 채움 없음) · 다른 묶음은 그대로. CTL prd1-11-active.patch(규칙 삭제) → 빨강 */
test('P11 켜진 정렬·B 단추 = border-mid 바탕 · border-strong 테두리 · ui-text 글자 / 대조: 타입 단추는 파란 채움 그대로', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  await page.locator('#txt-style-group .prop-style-btn').first().click();   // B 켜기
  const r = await page.evaluate(() => {
    const tok = (n, prop = 'color') => { const p = document.createElement('span'); p.style[prop] = `var(${n})`; document.body.appendChild(p); const v = getComputedStyle(p)[prop]; p.remove(); return v; };
    const look = (el) => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.borderTopColor, cs.color]; };
    return { want: [tok('--ui-border-mid', 'backgroundColor'), tok('--ui-border-strong'), tok('--ui-text')],
      align: look(document.querySelector('#txt-align-group .prop-align-btn.active')),
      style: look(document.querySelector('#txt-style-group .prop-style-btn.active')),
      kind: getComputedStyle(document.querySelector('.prop-type-btn.active[data-cls]')).backgroundColor, accent: tok('--ui-accent-primary', 'backgroundColor') };
  });
  expect(r.align, '★정렬 켜짐').toEqual(r.want);
  expect(r.style, '★B 켜짐').toEqual(r.want);
  expect(r.kind, '[대조] 타입 단추 켜짐은 파란 채움 그대로').toBe(r.accent);
  await page.locator('#txt-style-group .prop-style-btn').first().click();   // 되돌림
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑩ 텍스트 패널 «Font»·«글자색» 라벨 글 없음 · 칸은 그대로 · 색 칸이 줄 폭을 쓴다. CTL prd1-10-labels.patch(fontLabel:false 빼기) → 빨강 */
test('P10 텍스트 패널 — «Font»·«글자색» 라벨 없음 · 고르개 · 색 칸 그대로 · 색 칸 왼쪽 = 고르개 왼쪽', async ({ page }) => {
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const r = await page.evaluate(() => {
    const labs = [...document.querySelectorAll('#panel-right .prop-label, #panel-right .prop-field-label')].map((l) => l.textContent.trim());
    const fp = document.getElementById('txt-font-picker').getBoundingClientRect(), cf = document.getElementById('txt-color').closest('.prop-color-field').getBoundingClientRect();
    return { font: labs.includes('Font'), color: labs.includes('글자색'), dl: Math.round(cf.left - fp.left) };
  });
  expect([r.font, r.color], '★라벨 글이 남았다').toEqual([false, false]);
  expect(Math.abs(r.dl), '★색 칸이 라벨 자리만큼 들여졌다').toBeLessThanOrEqual(1);
  await expect(page.locator('#txt-font-trigger')).toHaveAttribute('aria-label', 'Font');
  await expect(page.locator('#txt-color')).toHaveAttribute('aria-label', '글자색');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⑥ 텍스트 Size — 너비 칸 · 라벨 끌기 · 높이 꺼짐(auto · 흐림). CTL prd1-06-scrub.patch(끌기 배선 삭제) → 빨강 */
test('P6 텍스트 Size — 너비 라벨을 오른쪽으로 끌면 너비가 는다 · ⌘Z 한 번에 되돌아감 · 높이 칸 꺼짐 auto 흐림', async ({ page }) => {
  const errs = await scene(page);
  const id = await open(page, 'text-block', 'addTextBlock');
  const h = page.locator('#txt-height-number');
  await expect(h).toBeDisabled();
  await expect(h).toHaveAttribute('placeholder', 'auto');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('txt-height-number').closest('.prop-icon-input')).opacity),
    '★꺼진 높이 칸이 안 흐리다').toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-disabled-opacity').trim()));
  const w0 = Number(await page.locator('#txt-width-number').inputValue());
  const box = await page.locator('#txt-width-scrub').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.locator('#txt-width-number').inputValue()), '★라벨을 끌어도 너비가 안 바뀐다').toBe(Math.min(860, w0 + 20));
  const after = await page.evaluate((id) => document.getElementById(id).closest('.row')?.style.width || document.getElementById(id).style.width, id);
  expect(after, '★끈 값이 블럭에 안 썼다').toBe(Math.min(860, w0 + 20) + 'px');
  await page.evaluate(() => window.undo());
  await expect.poll(() => page.evaluate((id) => { const b = document.getElementById(id); return b.closest('.row')?.style.width || b.style.width; }, id), '★⌘Z 한 번에 안 돌아간다').not.toBe(after);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ④ 텍스트 — Layout(가로 정렬)이 Size 위 · 게이트 판정(그 패널 순서) 통과. CTL prd1-04-order.patch(panel:'text' 빼기) → 빨강 */
test('P4 텍스트 패널 절 순서 Position → Layout(정렬) → Size → Padding · 게이트 위반 0', async ({ page }) => {
  const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');
  const errs = await scene(page);
  await open(page, 'text-block', 'addTextBlock');
  const secs = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-section[data-sec]')].map((s) => s.dataset.sec)
    .filter((k) => ['position', 'size', 'layout', 'padding'].includes(k)));
  expect(secs, '★텍스트 Layout(정렬)이 Size 위가 아니다').toEqual(['position', 'layout', 'size', 'padding']);
  expect(await page.evaluate(() => document.getElementById('txt-align-group').closest('.prop-section[data-sec]').dataset.sec)).toBe('layout');
  const SPEC = loadSectionSpec();
  expect(judgePanel(await readPanel(page, SPEC), SPEC), '게이트 판정').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
