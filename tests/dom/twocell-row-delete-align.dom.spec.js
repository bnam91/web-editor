/* twocell-row-delete-align.dom.spec.js — NEW-현빈QA-GRID-TWOCELL-ROW-DELETE-AND-ALIGN-01(261110 · 현빈 직접 발견 · 미카사 곁 발견).
 * 장면 = 현빈 사본(fixtures/twocell-zvyrt-section.html · 칸(1,0) = duo 좌[글, 원 120] 우[글]) · 미카사 사본(fixtures/twocell-oval-mikasa-section.html · 좌[글,원,빈,원,사각,빈] — 원 120×41 타원 재현).
 * 잰다: C 두 칸 안 원은 빈 사진 자리와 같이 있어도 정원 · P 두 칸 안 줄 패널 [줄 삭제]·[줄 복사]·줄 종류 · A 줄 정렬(수평)·지름 — 저장→다시 열기·⌘Z 한 걸음 · M 우클릭 「이미지 삭제」 는 그림 든 줄에만.
 * ⌫·Delete 로 두 칸 안 줄 지우기(8종 × 좌/우 × 가운데/마지막)는 int-3 HBQA-TWOCELL-INNER 로 이미 된다 — hbqa-twocell-inner-edit 가 잰다(여기선 안 겹친다).
 * 양성대조: 고침 전 js 세 파일(grid-block.js · prop-grid.js · block-factory.js)로 돌리면 C·P·A·M 이 빨강. */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC_HB = fs.readFileSync(path.join(__dirname, 'fixtures/twocell-zvyrt-section.html'), 'utf8');
const SEC_MK = fs.readFileSync(path.join(__dirname, 'fixtures/twocell-oval-mikasa-section.html'), 'utf8');
const G = '#grd_zvyrt_7q5uuxx';
const NP = (np) => `${G} .grd-cell[data-r="1"][data-c="0"] [data-npath="${np}"]`;
const f2 = (page) => page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
async function click(page, sel, opts) { const r = await waitStableRect(page, sel); await page.mouse.click(r.cx, r.cy, opts); await f2(page); }
async function pick(page, sel) { await click(page, sel); await click(page, sel); }

async function boot(page, html) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    c.querySelectorAll('.section-block').forEach((s, i) => { s.dataset.section = String(i + 1); });   // 사본 섹션은 data-section 2 — 앱은 다시 그릴 때 1 로 매긴다(⌘Z 바이트 비교가 그 차이에 걸린다)
    window.rebindAll?.(); window.applyPageSettings?.();   // 사본 섹션 안쪽 여백(42)을 이 판 설정으로 — ⌘Z 복원이 그 값으로 다시 그린다
    window.applyZoom?.(100); window.deselectAll?.(); window.clearHistory?.();
  }, html);
  await f2(page); await f2(page);
  return errs;
}
/** 현빈 사본 duo 의 두 열 줄 */
const cols = (page) => page.evaluate((G) => JSON.parse(JSON.stringify(window.getGridModel(document.querySelector(G)).cells[1][0].lines[0].cols.map((c) => c.lines))), G);
const kinds = (cs) => cs.map((L) => L.map((l) => l.type + (l.imgShape ? ':' + l.imgShape : '')));
const active = (page) => page.evaluate((G) => JSON.parse(JSON.stringify(window.grdGetActiveLine(document.querySelector(G)) || null)), G);
const reopen = (page) => page.evaluate(async () => { window.deselectAll?.(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });

test('C1 두 칸 안 원 + 빈 사진 자리 — 원은 정원(미카사 사본 · 원 둘)', async ({ page }) => {
  const errs = await boot(page, SEC_MK);
  await page.waitForFunction(() => [...document.querySelectorAll('#canvas .grd-nested img')].every((i) => i.complete));
  const circles = () => page.evaluate(() => [...document.querySelectorAll('#canvas .grd-nested .grd-img-circle')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  const a = await circles();
  console.log('[C1] ' + JSON.stringify(a));
  expect(a.length, '[전제] 두 칸 안 원 셋(좌 둘 · 우 하나)').toBe(3);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .grd-nested .grd-img-empty:not(.grd-img-circle)').length), '[전제] 같은 열에 빈 사진 자리 둘').toBe(2);
  for (const [w, h] of a) expect(Math.abs(w - h), `원이 타원이다 ${w}×${h}`).toBeLessThanOrEqual(1);
  // 다시 열어도
  await reopen(page); await f2(page);
  await page.waitForFunction(() => [...document.querySelectorAll('#canvas .grd-nested img')].every((i) => i.complete));
  for (const [w, h] of await circles()) expect(Math.abs(w - h), `다시 연 뒤 타원 ${w}×${h}`).toBeLessThanOrEqual(1);
  // 내보내기 산출(저장 HTML)에도 같은 규칙이 인라인으로 실린다 — 에디터 CSS 없는 길(단독 HTML)도 같게
  const ser = await page.evaluate(() => window.serializeProject());
  const nCircle = (ser.match(/grd-img-circle\b/g) || []).length;
  expect(nCircle, '[전제] 저장본에 원 틀이 있다(두 칸 안 셋 + 바깥)').toBeGreaterThanOrEqual(3);
  expect((ser.match(/grd-img-circle[^>]*?flex-shrink:0/g) || []).length, '저장본 원 틀 «전부»에 flex-shrink:0 인라인').toBe(nCircle);
  expect(errs).toEqual([]);
});

test('P1 두 칸 안 줄 — 패널 [줄 삭제] 좌·우 · ⌘Z 한 걸음', async ({ page }) => {
  const errs = await boot(page, SEC_HB);
  const a = await cols(page);
  expect(kinds(a), '[전제] 좌[글, 원] 우[글]').toEqual([['body', 'image:circle'], ['body']]);
  await pick(page, NP('0.0'));
  await expect(page.locator('#grd-line-del-btn'), '두 칸 안 줄에도 [줄 삭제]').toBeVisible();
  await expectOneUndoStep(page, async () => {
    await page.click('#grd-line-del-btn'); await f2(page);
    expect(kinds(await cols(page)), '왼 열 글 줄이 지워졌다').toEqual([['image:circle'], ['body']]);
    expect(await active(page), '활성 줄 = 같은 열 다음 줄(원)').toMatchObject({ r: 1, c: 0, li: 0, np: '0.0' });
  }, '두 칸 안 줄 삭제(패널)');
  expect(await cols(page), '⌘Z 한 번에 그대로').toEqual(a);
  // 오른 열
  await pick(page, NP('1.0'));
  await page.click('#grd-line-del-btn'); await f2(page);
  expect(kinds(await cols(page)), '오른 열 줄이 지워졌다(왼 열 무손)').toEqual([['body', 'image:circle'], []]);
  expect(errs).toEqual([]);
});

test('P2 두 칸 안 줄 — 패널 [줄 복사] 는 그 열 안 바로 아래 · 줄 종류 바꾸기는 그 줄만', async ({ page }) => {
  const errs = await boot(page, SEC_HB);
  await pick(page, NP('0.1'));
  await expectOneUndoStep(page, async () => {
    await page.click('#grd-line-dup-btn'); await f2(page);
    expect(kinds(await cols(page)), '원이 그 열 안에 한 벌 더').toEqual([['body', 'image:circle', 'image:circle'], ['body']]);
  }, '두 칸 안 줄 복사(패널)');
  await pick(page, NP('0.0'));
  if (!(await page.locator('#grd-line-kind').isVisible())) await page.click('#grd-line-toggle');   // 「줄 꾸미기」 절(접힘)
  await page.selectOption('#grd-line-kind', 'h2'); await f2(page);
  const b = await cols(page);
  expect(kinds(b), '그 줄만 제목으로(바깥 duo 줄 무손)').toEqual([['h2', 'image:circle'], ['body']]);
  expect(await page.evaluate((G) => window.getGridModel(document.querySelector(G)).cells[1][0].lines.map((l) => l.type), G), '바깥 줄은 duo 하나 그대로').toEqual(['duo']);
  expect(errs).toEqual([]);
});

test('A1 두 칸 안 원 — 줄 정렬(수평) · 지름 · ⌘Z 한 걸음씩 · 저장→다시 열기', async ({ page }) => {
  const errs = await boot(page, SEC_HB);
  await pick(page, NP('0.1'));
  await expect(page.locator('#grd-img-height'), '두 칸 안 원에도 지름 칸').toBeVisible();
  const before = await cols(page);
  /* 숫자 칸·줄 정렬 select 는 «앞 표본만»(pushHistory → gridPreviewLine · 바깥 줄과 같은 배선 numWire) — 끝 표본 규약은 HISTORY-BOTH-ENDS-01 몫이라
     여기선 사용자가 보는 것(⌘Z 한 번 = 조작 전 모델)을 잰다. */
  const undo1 = async () => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await f2(page); };
  await page.fill('#grd-img-height', '80'); await page.locator('#grd-img-height').dispatchEvent('change'); await f2(page);
  expect((await cols(page))[0][1].height, '지름 = 80').toBe(80);
  const d = await page.evaluate(() => { const e = document.querySelector('#canvas .grd-nested .grd-img-circle'); const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  expect(d, '그려진 원 80×80').toEqual([80, 80]);
  await undo1();
  expect(await cols(page), '⌘Z 한 번으로 지름 복귀').toEqual(before);

  await pick(page, NP('0.1'));
  if (!(await page.locator('#grd-line-align').isVisible())) await page.click('#grd-line-toggle');
  await page.selectOption('#grd-line-align', 'right'); await f2(page);
  expect((await cols(page))[0][1].align, '그 원 줄만 오른쪽').toBe('right');
  const pos = () => page.evaluate(() => { const e = document.querySelector('#canvas .grd-nested .grd-img-circle'); const col = e.parentElement.getBoundingClientRect(); const r = e.getBoundingClientRect(); return Math.round(col.right - r.right); });
  expect(await pos(), '원이 열 오른쪽 끝에 붙었다').toBeLessThanOrEqual(1);
  expect((await cols(page))[1], '오른 열 무손').toEqual(before[1]);
  const aligned = await cols(page);
  await undo1();
  expect(await cols(page), '⌘Z 한 번으로 정렬 복귀').toEqual(before);
  await page.keyboard.press('Meta+Shift+z'); await f2(page);
  expect(await cols(page), '⌘⇧Z 로 다시 오른쪽').toEqual(aligned);
  await reopen(page); await f2(page);
  expect((await cols(page))[0][1].align, '다시 열어도 오른쪽').toBe('right');
  expect(await pos(), '다시 연 뒤에도 오른쪽 끝').toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('M1 우클릭 「이미지 삭제」 — 빈 자리엔 안 뜨고 · 그림 든 두 칸 안 원에선 그림만 비운다', async ({ page }) => {
  const errs = await boot(page, SEC_HB);
  await pick(page, NP('0.1')); await click(page, NP('0.1'), { button: 'right' });
  expect(await page.locator('#bcm-grid-img-del').isVisible(), '빈 원엔 «이미지 삭제» 없음(할 일이 없다)').toBe(false);
  expect(await page.locator('#bcm-grid-img').isVisible(), '[음성] 이미지 넣기 항목은 그대로').toBe(true);
  await page.keyboard.press('Escape');
  const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await page.evaluate(([G, PX]) => { const b = document.querySelector(G); const H = window.grdNestColHost(b, 1, 0, 0, 0); const L = H.getLines(); L[1] = { ...L[1], imgSrc: PX }; return H.commitLines(1, 0, L); }, [G, PX]);
  await f2(page);
  await pick(page, NP('0.1')); await click(page, NP('0.1'), { button: 'right' });
  await expect(page.locator('#bcm-grid-img-del'), '그림 든 원엔 «이미지 삭제»').toBeVisible();
  await click(page, '#bcm-grid-img-del');
  const L = (await cols(page))[0];
  expect([L.length, L[1].type, L[1].imgShape, L[1].imgSrc || ''], '그림만 비고 원 자리는 남는다').toEqual([2, 'image', 'circle', '']);
  expect(errs).toEqual([]);
});

/* ═══ D1⒜ · D2ⓐ (현빈 결정 261110) · EMPTY-CELL-HINT-LIGHTER ═══ */
const FAINT = 'rgb(224, 224, 224)';   // --text-hint-canvas-faint = --p-gray-50 #e0e0e0 (옛 #ccc = rgb(204, 204, 204))
const before = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e, '::before'); return { content: cs.content, color: cs.color, h: Math.round(e.getBoundingClientRect().height) }; }, sel);
const EMPTY_COL = `${G} .grd-nested-col-empty[data-ncol="0"]`;

test('E1 열 마지막 줄을 지우면 빈 열이 «누를 자리»로 남고 · 누르면 그 열에 줄 하나 · ⌘Z 한 걸음 · 산출물엔 안 나간다', async ({ page }) => {
  const errs = await boot(page, SEC_HB);
  await page.evaluate((G) => { const b = document.querySelector(G); const H = window.grdNestColHost(b, 1, 0, 0, 0); H.commitLines(1, 0, [{ type: 'body', text: '' }]); window.clearHistory?.(); }, G);
  await f2(page);
  await pick(page, NP('0.0'));
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Backspace'); await f2(page);
  expect(kinds(await cols(page)), '[전제] 왼 열이 비었다(D1⒜ = 빈 열 유지)').toEqual([[], ['body']]);
  const ph = await before(page, EMPTY_COL);
  expect(ph, '빈 열에 누를 자리가 있다').not.toBeNull();
  expect([ph.content, ph.color], '자리 표시 = 빈 칸과 같은 연한 안내').toEqual(['"+ 내용 추가"', FAINT]);
  expect(ph.h, '누를 만한 높이').toBeGreaterThanOrEqual(24);
  await expectOneUndoStep(page, async () => {
    await click(page, EMPTY_COL);
    expect(kinds(await cols(page)), '누르면 그 열에 글 줄 하나').toEqual([['body'], ['body']]);
    expect(await active(page), '그 줄로 간다').toMatchObject({ r: 1, c: 0, li: 0, np: '0.0' });
  }, '빈 열 자리 눌러 줄 추가');
  expect(kinds(await cols(page)), '⌘Z 한 번에 다시 빈 열').toEqual([[], ['body']]);
  // 산출물(에디터 CSS 의 #canvas 밖) — 글자 없음 · 높이 0
  const out = await page.evaluate((G) => {
    const host = document.createElement('div'); host.innerHTML = document.querySelector(G).outerHTML.replace(/id="[^"]*"/g, '');
    document.body.appendChild(host); const e = host.querySelector('.grd-nested-col-empty'); const cs = getComputedStyle(e, '::before');
    const r = { content: cs.content, h: e.getBoundingClientRect().height }; host.remove(); return r;
  }, G);
  expect(out, '#canvas 밖(산출물)엔 안내 글자·높이 0 — 오늘의 빈 열과 같다').toEqual({ content: 'none', h: 0 });
  expect(errs).toEqual([]);
});

test('V1 열 세로 정렬(열마다) — 칸 세로 정렬과 같은 세 단추 · 그 열만 · ⌘Z 한 걸음 · 다시 열기', async ({ page }) => {
  const errs = await boot(page, SEC_HB);
  await pick(page, NP('1.0'));
  await expect(page.locator('#grd-nest-valign-group [data-nva="bottom"]'), '두 칸 안 줄에 «열 세로» 세 단추').toBeVisible();
  expect(await page.locator('#grd-nest-valign-group [data-nva]').count(), '단추 셋').toBe(3);
  const jc = () => page.evaluate((G) => [...document.querySelectorAll(`${G} .grd-nested-col`)].map((c) => getComputedStyle(c).justifyContent), G);
  const j0 = await jc();
  await expectOneUndoStep(page, async () => {
    await page.click('#grd-nest-valign-group [data-nva="bottom"]'); await f2(page);
    expect(await page.evaluate((G) => window.getGridModel(document.querySelector(G)).cells[1][0].lines[0].cols.map((c) => c.valign ?? null), G), '오른 열만 bottom').toEqual([null, 'bottom']);
    expect(await jc(), '오른 열 내용이 아래로').toEqual([j0[0], 'flex-end']);
  }, '두 칸 열 세로 정렬');
  await pick(page, NP('1.0'));
  await page.click('#grd-nest-valign-group [data-nva="middle"]'); await f2(page);
  await reopen(page); await f2(page);
  expect(await jc(), '다시 열어도 오른 열 가운데').toEqual([j0[0], 'center']);
  expect(errs).toEqual([]);
});

test('H1 빈 칸 안내 «+ 내용 추가 (T/G/K)» — 더 연한 색(토큰)', async ({ page }) => {
  const errs = await boot(page, SEC_HB);
  await page.evaluate((G) => window.updateGridBlock(document.querySelector(G).id, { patchCell: { r: 1, c: 1, lines: [] } }), G);
  await f2(page);
  const h = await before(page, `${G} .grd-cell-empty[data-r="1"][data-c="1"]`);
  expect(h && [h.content, h.color], '빈 칸 안내 = 연한 토큰 색').toEqual(['"+ 내용 추가 (T/G/K)"', FAINT]);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-hint-canvas-faint').trim()), '토큰이 풀린다').not.toBe('');
  expect(errs).toEqual([]);
});
