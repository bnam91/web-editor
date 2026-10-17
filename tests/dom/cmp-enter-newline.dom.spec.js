/* cmp-enter-newline.dom.spec.js — 1017t1c2 비교(comparison) 칸·헤더에 「텍스트 입력 후 엔터쳐서 줄바꿈이 안된다」. (2026-10-18)
 *
 * ★현빈 원문: 「텍스트 줄에 텍스트 입력 후 엔터쳐서 줄바꿈이 안된다」
 * ★두 자리에서 ★따로 죽는다(실측, modal-enter-newline.dom.spec.js 머리말과 같은 병):
 *   ⑴ 읽기: comparison-block.js 가 `el.textContent` 로 읽어 Enter 산출(<div>/<br>)을 줄로 못 읽는다
 *     (blur 에서 소실) ⇒ 고침 = js/drag-utils.js mdlReadText(옮긴 한 벌 · js/block-drag.js 와 사본 0).
 *   ⑵ 그리기: 행·헤더(header 모드) 인라인에 white-space 가 없어 모델의 \n 이 공백으로 접힌다
 *     ⇒ 고침 = 캡션 헤더(:392)와 같은 `white-space:pre-wrap;word-break:keep-all;`.
 * ★⑴·⑵ 는 ★독립된 결함이라 ★따로 잰다 — E1(읽기)·E3(헤더 읽기)·E4(사람 순서) 는 ★타이핑으로,
 *   E2(그리기)는 ★모델을 직접 세팅해 ★읽기와 무관하게 그림만 잰다.
 * ★전제 — 그 칸은 ★줄 없는 글자 칸(cols[c].rows[r].lines === undefined). 줄 칸(.cmp-lines)은 line-host
 *   경로(다른 자)를 쓴다 — 1017t1c2 범위 밖(설계서에 미측정으로 적힘).
 * ⛔고정 대기 0 — waitForTimeout 미사용.
 *
 * 음성대조(실측 — 아래 「돌린 결과」에 적는다):
 *   M6 comparison-block.js 의 `row.text = mdlReadText(el)` 를 `row.text = el.textContent` 로 되돌림.
 *   M7 comparison-block.js :443 행 인라인의 `white-space:pre-wrap;word-break:keep-all;` 만 제거.
 *   M8 js/drag-utils.js mdlReadText 의 BR 분기(`if (!ph) { pending = false; out += '\n'; }`) 한 줄 제거
 *      ⇒ E1 ＋ 모달 쪽(modal-enter-newline M1~M4·K1·K2) 같이 빨강이어야 한다(한 벌을 공유하는 증거).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-enter-newline
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const MAKE = `window.addComparisonBlock({ cols: [
  { title: '', rows: [{type:'text',text:''}] },
  { title: 'B', rows: [{type:'image',text:'',imgSrc:'${PX}',imgFit:'cover'}] }], featured: 1 });`;

const cellSel = (c, r) => `#sB .comparison-block .cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`;
const hdSel = (c) => `#sB .comparison-block .cmp-hd[data-col-idx="${c}"]`;

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
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 5000 });
  return errs;
}
const blk = 'document.getElementById(window.__bid)';
const model = (page) => page.evaluate(`window.getComparisonCols(${blk}.dataset)`);

async function at(page, sel) {
  const rc = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => {
    const e = document.elementFromPoint(x, y); const want = document.querySelector(s);
    return !!(e && want && (e === want || want.contains(e)));
  }, [rc.cx, rc.cy, sel]);
  expect(hit, `전제 — (${rc.cx},${rc.cy}) 가 ${sel} 위다`).toBe(true);
  return rc;
}
/* 그 요소의 텍스트가 ★시각적으로 몇 줄로 그려지는지 — Range.getClientRects (컨테이너 height 와 무관). */
const drawnLineCount = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  const r = document.createRange(); r.selectNodeContents(el);
  return [...r.getClientRects()].filter(x => x.height > 0.5 && x.width > 0.5).length;
}, sel);

test('전제 — 칸(0,0)은 줄 없는 글자 칸(lines undefined)', async ({ page }) => {
  const errs = await setup(page);
  const m = await model(page);
  expect(m[0].rows[0].lines, '전제').toBeUndefined();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E1 모델(읽기) — 더블클릭→가→Enter→나→바깥클릭 ⇒ rows[0].text === "가\\n나"(끝에 \\n\\n 아님)', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, cellSel(0, 0));
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', cellSel(0, 0), { timeout: 3000 });
  await page.keyboard.type('가');
  await page.keyboard.press('Enter');
  await page.keyboard.type('나');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(async () => (await model(page))[0].rows[0].text, { timeout: 3000 }).toBe('가\n나');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E2 그리기(모델을 직접 세팅 — 읽기와 무관) — rows[0].text="가\\n나" → 그 칸이 시각적으로 2줄', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate((s) => {
    const b = document.getElementById(window.__bid);
    const cols = window.getComparisonCols(b.dataset);
    cols[0].rows[0].text = '가\n나';
    window.setComparisonCols(b, cols); window.renderComparison(b);
  }, cellSel(0, 0));
  await expect.poll(() => drawnLineCount(page, cellSel(0, 0)), { timeout: 3000 }).toBe(2);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E3 헤더(읽기) — 헤더 더블클릭→가→Enter→나→바깥클릭 ⇒ cols[0].title === "가\\n나"', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, hdSel(0));
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', hdSel(0), { timeout: 3000 });
  await page.keyboard.type('가');
  await page.keyboard.press('Enter');
  await page.keyboard.type('나');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(async () => (await model(page))[0].title, { timeout: 3000 }).toBe('가\n나');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E4 사람이 하는 순서 — 고르기·입력 → 저장(serializeProject) → 다시 열기 뒤에도 "가\\n나" + 2줄', async ({ page }) => {
  await setup(page);
  const p = await at(page, cellSel(0, 0));
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', cellSel(0, 0), { timeout: 3000 });
  await page.keyboard.type('가'); await page.keyboard.press('Enter'); await page.keyboard.type('나');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(async () => (await model(page))[0].rows[0].text, { timeout: 3000 }).toBe('가\n나');
  const snap = await page.evaluate(() => window.serializeProject());
  const bid = await page.evaluate(() => window.__bid);
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction((id) => !!document.getElementById(id)?.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]'), bid, { timeout: 5000 });
  const after = await page.evaluate((id) => window.getComparisonCols(document.getElementById(id).dataset)[0].rows[0].text, bid);
  expect(after, '왕복 뒤 모델').toBe('가\n나');
  const n = await drawnLineCount(page, `#${bid} .cmp-row[data-col-idx="0"][data-row-idx="0"]`);
  expect(n, '왕복 뒤 그려진 줄 2').toBe(2);
});

test('E5 배송본(PNG 클론) — 모델을 세팅하고 클론해 renderComparison 다시 부르면 클론도 2줄', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    const cols = window.getComparisonCols(b.dataset);
    cols[0].rows[0].text = '가\n나';
    window.setComparisonCols(b, cols); window.renderComparison(b);
  });
  const n = await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    const c = b.cloneNode(true); c.id = 'cmp-clone-e5';
    document.body.appendChild(c); window.renderComparison(c);
    const e = c.querySelector('.cmp-row[data-col-idx="0"][data-row-idx="0"]');
    const r = document.createRange(); r.selectNodeContents(e);
    const out = [...r.getClientRects()].filter(x => x.height > 0.5 && x.width > 0.5).length;
    c.remove(); return out;
  });
  expect(n, '클론도 2줄(인라인 스타일이라 수집 CSS 불필요)').toBe(2);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N6 끝 Enter×2 — 끝 빈 줄은 text 끝에 \\n 으로 안 남는다', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, cellSel(0, 0));
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', cellSel(0, 0), { timeout: 3000 });
  await page.keyboard.type('가'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(async () => (await model(page))[0].rows[0].text, { timeout: 3000 }).toBe('가');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N7 더블클릭만 하고 손 안 대고 블러 — text 무변(빈 칸을 안 덮는다)', async ({ page }) => {
  const errs = await setup(page);
  const p = await at(page, cellSel(0, 0));
  await page.mouse.dblclick(p.cx, p.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', cellSel(0, 0), { timeout: 3000 });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') !== 'true', cellSel(0, 0), { timeout: 3000 });
  const m = await model(page);
  expect(m[0].rows[0].text, 'text 무변').toBe('');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N8 이미지 칸은 영향 0(imgSrc 유지)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    const b = document.getElementById(window.__bid);
    const cols = window.getComparisonCols(b.dataset);
    cols[0].rows[0].text = '가\n나';
    window.setComparisonCols(b, cols); window.renderComparison(b);
  });
  const m = await model(page);
  expect(m[1].rows[0].imgSrc, '이미지 칸 무변').toBe(PX);
  expect(errs, errs.join('\n')).toEqual([]);
});
