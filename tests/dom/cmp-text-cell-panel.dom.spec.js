/* cmp-text-cell-panel.dom.spec.js — 1017t1c1 비교(comparison) 「고른 글자 칸」 우측 패널 절. (2026-10-18)
 *
 * ★현빈 원문: 「우측패널에 칼럼별 플레이스홀더, 인풋박스들이 모두 있을 필요가 있을까? …
 *   특정 줄을 선택하면 우측에서 동적으로 배경이나 텍스트 수정가능하게」
 * ★c1 범위: 「텍스트 수정」만(배경은 open_questions ② — 모델에 그 칼럼 bg/col.bg만 있고 행에 없다 · 미구현).
 * ★뿌리: prop-comparison.js 의 글자 입력칸(.cmp-row-input · .cmp-col-title)을 걷고, 「Image」 절(:96-121)과
 *   같은 자리·같은 꼴로 「고른 글자 칸」 절(#cmp-text-section)을 짠다 — 활성 주소는 line-host.js 의
 *   grdGetActiveLine(li===null) 을 읽는다(이미지 칸의 cmpGetActiveCell 과는 다른 출처 — 섞으면 두 절이 동시에 뜬다).
 * ⛔고정 대기 0.
 *
 * 음성대조(공용 본문 무력화):
 *   · prop-comparison.js 의 `const textSection = (_lnActRow && ...)` 조건을 항상 거짓으로(M4) → A1·N5 빨강
 *     (N5 는 ★절이 아예 안 뜨니 음성은 그대로 초록일 수 있다 — 본문에 적은 수로 보고).
 *   · `#cmp-text-input` 의 input 배선만 제거(M5, 마크업은 유지) → A1 의 ★주 단언(모델이 바뀐다)만 빨강 —
 *     「칸은 섰는데 안 먹는다」를 잡는다(섹션 유무는 초록).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-text-cell-panel
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'text',text:'a0'},{type:'text',text:'a1'}] },
  { title: 'B', rows: [{type:'image',text:'',imgSrc:'${PX}',imgFit:'cover'},{type:'text',text:'b1'}] }], featured: 1 });`;

const cellSel = (c, r) => `#sB .comparison-block .cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([mk, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(mk);
    window.__blk = [...document.querySelectorAll('#sB .comparison-block')].pop();
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [MAKE, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected && !window.__blk.classList.contains('selected'), null, { timeout: 5000 });
  return errs;
}
const blk = 'document.getElementById(window.__bid)';
const model = (page) => page.evaluate(`window.getComparisonCols(${blk}.dataset)`);
const count = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

async function at(page, sel) {
  const rc = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => {
    const e = document.elementFromPoint(x, y); const want = document.querySelector(s);
    return !!(e && want && (e === want || want.contains(e)));
  }, [rc.cx, rc.cy, sel]);
  expect(hit, `전제 — (${rc.cx},${rc.cy}) 가 ${sel} 위다`).toBe(true);
  return rc;
}
async function pickCell(page, c, r) {
  const p = await at(page, cellSel(c, r));
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-line-add-kind') || document.querySelectorAll('.cmp-cell-selected').length > 0, null, { timeout: 3000 });
}

test('A1 글자 칸(0,1) 고름 → #cmp-text-section 1 · textarea 값 = 그 칸 글자 · 타이핑 → 모델·캔버스 갱신', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await count(page, '#cmp-text-section'), '절 1').toBe(1);
  const before = await page.evaluate(() => document.getElementById('cmp-text-input')?.value);
  expect(before, '초깃값 = 그 칸 글자').toBe('a1');
  await page.evaluate(() => {
    const ta = document.getElementById('cmp-text-input');
    ta.value = '바뀐글자'; ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(async () => (await model(page))[0].rows[1].text, { timeout: 3000 }).toBe('바뀐글자');
  const drawn = await page.evaluate((s) => document.querySelector(s)?.textContent, cellSel(0, 1));
  expect(drawn, '캔버스도 갱신').toBe('바뀐글자');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('A2 블럭만 고른 상태(클릭1) → #cmp-text-section 0 · 글자 입력칸 0 · 남긴 것들은 그대로 산다', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, cellSel(0, 1));
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  expect(await count(page, '#cmp-text-section'), '클릭1 — 절 없음').toBe(0);
  expect(await count(page, '.cmp-row-input'), '글자 입력칸 0').toBe(0);
  expect(await count(page, '.cmp-col-title'), '제목 입력칸 0').toBe(0);
  expect(await count(page, '.cmp-row-add'), '행 추가 — 대체 수단 없음 그대로 산다').toBeGreaterThan(0);
  expect(await count(page, '.cmp-row-del'), '행 삭제 — 그대로 산다').toBeGreaterThan(0);
  expect(await count(page, '.cmp-row-h'), '행 높이 칸(c4) — 그대로 산다').toBeGreaterThan(0);
  expect(await count(page, '.cmp-row-type'), '텍스트/이미지 토글 — 그대로 산다').toBeGreaterThan(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('A3 대체 수단 — 캔버스 헤더 더블클릭 → 타이핑 → blur 하면 칼럼 제목이 바뀐다(입력칸 없어도 고칠 길이 있다)', async ({ page }) => {
  const errs = await setup(page);
  const hd = page.locator('#sB .comparison-block .cmp-hd').first();
  await hd.dblclick();
  await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete');
  await page.keyboard.type('새제목');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(async () => (await model(page))[0].title, { timeout: 3000 }).toBe('새제목');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N5 이미지 칸(1,0) 고름 → #cmp-text-section 0 · #cmp-img-section 1(두 절이 동시에 안 뜬다)', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 1, 0);
  expect(await count(page, '#cmp-text-section'), '이미지 칸은 텍스트 절 0').toBe(0);
  expect(await count(page, '#cmp-img-section'), '이미지 절 1').toBe(1);
  expect(errs, errs.join('\n')).toEqual([]);
});
