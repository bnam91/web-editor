/* cmp-placeholder-free.dom.spec.js — 비교(comparison) 블럭 ★기본문구 제거 그물. (2026-10-08 지디 발주 ①)
 *
 * ★현빈 요청(2차 전달 · ⛔원문 미확인): 「컴패리전 블럭 플레이스홀더 제거 — 캔버스 직접 입력 가능하니 불필요」
 *
 * ★무엇을 «제거»하나 — 셋으로 갈라 ⒜⒝만 한다(판정 근거는 커밋 메시지·지디 보고):
 *   ⒜ 모델에 글자를 «안 넣는다»  — 새 블럭(comparison-block.js makeComparisonBlock) ·
 *                                  새 칼럼/새 행(prop-comparison.js)
 *   ⒝ 빈 칸 blur 「되돌리기」를 «끈다» — _editableTitle / _editableRow
 *   ⒞ 식별 명부(CMP_PLACEHOLDERS · isCmpPlaceholderText) 삭제 = ★하지 «않는다».
 *      까닭: ⒜⒝ 뒤에도 ★이미 저장된 프로젝트의 모델엔 옛 기본문구가 남아 있다. 명부를 지우면
 *      그 칸의 「더블클릭=전체선택」이 조용히 죽어 첫 타이핑이 «이어붙는다»(U-26 이 고친 그 병의 재발).
 *      ⇒ 아래 D1 이 그 기전이 ★살아 있음을 «음성대조»로 잠근다.
 *   ⒟ ★⒜의 전제조건 — captionPos:'top' 의 제목(.cmp-hd)엔 height 가 «없다». 글자를 비우면
 *      ★0×0 이 되어 더블클릭이 안 닿는다(실측: header 모드 331×70 / 캡션 모드 ★0×0).
 *      ⇒ C1·C2 가 「빈 제목도 누를 수 있다」를 잰다. ⛔«안 보이게» 한 조치가 기능을 끄는 꼴을 막는다.
 *
 * ★전제 단언 — 「비워도 안 되살아난다」를 재려면 먼저 「비웠다」를 단언한다(B1·B2 의 mid).
 * ★음성대조 — D1(전체선택 기전 생존) · D2(사용자가 쓴 글은 blur 가 안 건드린다).
 * ★저장 왕복 — E1(빈 칸이 serializeProject → applyProjectData 를 견딘다).
 *
 * ⛔앱을 띄우지 않는다(bootApp = index.html 통째 · electronAPI 가짜).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-placeholder-free
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★옛 기본문구 명부 — ⛔여기 베끼지 «않는다». ★런타임 정본(window.CMP_PLACEHOLDERS)을 읽는다.
   ⚠️초판은 이 파일을 ★소스 파싱해 `'...'` 리터럴을 뽑았다. 그런데 ⒜ 커밋이 그 배열의 두 항목을
     ★상수 참조(CMP_PLACEHOLDER_ROW/TITLE)로 바꾸자 ★파서가 4개만 보게 됐다 — ★자가 ★조용히 줄었다.
     (「사라진 봄이 곧 멀어진 눈이다」) ⇒ ★값 자체를 ★앱에서 받아 온다.
   ★자가 살아있나 — 아래 guard 가 「문자열 ≥6개」를 ★단언한다. 명부가 비면 ★0건 초록이 아니라 ★빨강이다. */
async function legacyList(page) {
  const got = await page.evaluate(() => window.CMP_PLACEHOLDERS);
  expect(Array.isArray(got), `정본 window.CMP_PLACEHOLDERS 가 배열이 아니다 — 잰 값 ${JSON.stringify(got)}`).toBe(true);
  expect(got.every(x => typeof x === 'string' && x.length > 0), `명부에 문자열 아닌 항목이 있다 — ${JSON.stringify(got)}`).toBe(true);
  expect(got.length, `★자 생존 — 식별 명부 항목 수 ${got.length} (6 이상이어야 한다)`).toBeGreaterThanOrEqual(6);
  return got;
}

const SEC ='<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';

async function setup(page, make) {
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
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [make, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 5000 });
  return errs;
}

/* ⑸ 「0건·초록」이 나오면 자가 살아있나부터 — 모든 시험이 이걸 먼저 지난다. */
async function assertRuler(page) {
  const n = await page.evaluate(() => ({
    hd: window.__blk.querySelectorAll('.cmp-hd').length,
    rows: window.__blk.querySelectorAll('.cmp-row').length,
  }));
  expect(n.hd, `전제 — 비교블럭이 서고 헤더 칸이 그려졌다 (잰 값 ${JSON.stringify(n)})`).toBeGreaterThan(0);
  expect(n.rows, `전제 — 행 칸이 그려졌다 (잰 값 ${JSON.stringify(n)})`).toBeGreaterThan(0);
  return n;
}
const texts = (page, sel) => page.evaluate((s) => [...window.__blk.querySelectorAll(s)].map(e => e.textContent), sel);
/* 모델은 ★정본 읽기(getComparisonCols)로 — dataset.cols 직파싱은 문자열행/객체행 두 꼴에 물린다. */
const model = (page) => page.evaluate(() => window.getComparisonCols(window.__blk.dataset));

test('A1 ⒜ 새 비교블럭의 ★행 칸엔 기본문구가 없다', async ({ page }) => {
  const errs = await setup(page, 'window.addComparisonBlock({});');
  const n = await assertRuler(page);
  const LEGACY = await legacyList(page);
  const rows = await texts(page, '.cmp-row');
  const m = await model(page);
  const stuck = rows.filter(t => LEGACY.includes(t.trim()));
  expect(stuck, `행 ${n.rows}칸 중 옛 기본문구가 남은 칸 ${stuck.length}개 — 잰 값 ${JSON.stringify(rows)}`).toEqual([]);
  const modelStuck = m.flatMap(c => c.rows.map(r => r.text)).filter(t => LEGACY.includes(String(t).trim()));
  expect(modelStuck, `★모델(cols)에 박힌 기본문구 ${modelStuck.length}개 — ${JSON.stringify(modelStuck)}`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('A2 ⒜ 새 비교블럭의 ★헤더 칸에도 기본문구가 없다', async ({ page }) => {
  const errs = await setup(page, 'window.addComparisonBlock({});');
  const n = await assertRuler(page);
  const LEGACY = await legacyList(page);
  const hd = await texts(page, '.cmp-hd');
  const m = await model(page);
  const stuck = hd.filter(t => LEGACY.includes(t.trim()));
  expect(stuck, `헤더 ${n.hd}칸 중 옛 기본문구가 남은 칸 ${stuck.length}개 — 잰 값 ${JSON.stringify(hd)}`).toEqual([]);
  const titleStuck = m.map(c => c.title).filter(t => LEGACY.includes(String(t).trim()));
  expect(titleStuck, `★모델(cols[].title)에 박힌 기본문구 — ${JSON.stringify(titleStuck)}`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('A3 ⒜ 패널 「+ 칼럼 추가」로 만든 칼럼도 빈 칸이다', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ cols: [{ title: 'A', rows: [{type:'text',text:'a'}] }, { title: 'B', rows: [{type:'text',text:'b'}] }], featured: 1 });");
  await assertRuler(page);
  const before = (await model(page)).length;
  await page.evaluate(() => { window.showComparisonProperties(window.__blk); document.querySelector('#cmp-col-add').click(); });
  await page.waitForTimeout(150);
  const m = await model(page);
  expect(m.length, `전제 — 칼럼이 실제로 늘었다 ${before}→${m.length}`).toBe(before + 1);
  const added = m[0];   // 「+ 칼럼 추가」는 ★왼쪽에 넣는다(prop-comparison.js:148)
  expect(added.title.trim(), `새 칼럼 제목 — 잰 값 ${JSON.stringify(added.title)}`).toBe('');
  const rowTexts = added.rows.map(r => String(r.text));
  expect(rowTexts.filter(t => t.trim() !== ''), `새 칼럼 행 — 잰 값 ${JSON.stringify(rowTexts)}`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('A4 ⒜ 패널 「+ 행 추가」로 만든 행도 빈 칸이다', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ cols: [{ title: 'A', rows: [{type:'text',text:'a'}] }, { title: 'B', rows: [{type:'text',text:'b'}] }], featured: 1 });");
  await assertRuler(page);
  const before = (await model(page))[0].rows.length;
  await page.evaluate(() => { window.showComparisonProperties(window.__blk); document.querySelector('.cmp-row-add[data-col="0"]').click(); });
  await page.waitForTimeout(150);
  const m = await model(page);
  expect(m[0].rows.length, `전제 — 행이 실제로 늘었다 ${before}→${m[0].rows.length}`).toBe(before + 1);
  const added = m[0].rows[m[0].rows.length - 1];
  expect(String(added.text).trim(), `새 행 글자 — 잰 값 ${JSON.stringify(added.text)}`).toBe('');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('B1 ⒝ 행 칸을 비우고 blur → ★빈 칸으로 남는다(되살아나지 않는다)', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ cols: [{ title: 'A', rows: [{type:'text',text:'내가 쓴 글'}] }, { title: 'B', rows: [{type:'text',text:'b'}] }], featured: 1 });");
  await assertRuler(page);
  const cell = page.locator('#sB .comparison-block .cmp-row').first();
  await expect(cell, '전제 — 칸에 글자가 있다').toHaveText('내가 쓴 글');
  await cell.dblclick();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Delete');
  /* ★⑴ 전제 단언 — 「비웠다」를 먼저 재고서 「되살아나지 않는다」를 잰다. */
  const mid = await cell.textContent();
  expect(mid.trim(), `전제 — blur «전»에 칸이 실제로 비었다 (잰 값 ${JSON.stringify(mid)})`).toBe('');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(150);
  const after = await cell.textContent();
  const m = await model(page);
  expect(after.trim(), `blur 뒤 DOM — 잰 값 ${JSON.stringify(after)}`).toBe('');
  expect(String(m[0].rows[0].text).trim(), `blur 뒤 ★모델 — 잰 값 ${JSON.stringify(m[0].rows[0].text)}`).toBe('');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('B2 ⒝ 헤더 칸을 비우고 blur → ★빈 칸으로 남는다', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ cols: [{ title: '내 제목', rows: [{type:'text',text:'a'}] }, { title: 'B', rows: [{type:'text',text:'b'}] }], featured: 1 });");
  await assertRuler(page);
  const hd = page.locator('#sB .comparison-block .cmp-hd').first();
  await expect(hd, '전제 — 헤더에 글자가 있다').toHaveText('내 제목');
  await hd.dblclick();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Delete');
  const mid = await hd.textContent();
  expect(mid.trim(), `전제 — blur «전»에 헤더가 실제로 비었다 (잰 값 ${JSON.stringify(mid)})`).toBe('');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(150);
  const after = await hd.textContent();
  const m = await model(page);
  expect(after.trim(), `blur 뒤 DOM — 잰 값 ${JSON.stringify(after)}`).toBe('');
  expect(String(m[0].title).trim(), `blur 뒤 ★모델 title — 잰 값 ${JSON.stringify(m[0].title)}`).toBe('');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('C1 ⒟ 캡션(top) 모드의 ★빈 제목도 «누를 면적»이 있다 (0×0 유령 금지)', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ captionPos: 'top', cols: [{ title: '', rows: [{type:'text',text:''}] }, { title: '', rows: [{type:'text',text:''}] }], featured: 1 });");
  await assertRuler(page);
  const got = await page.evaluate(() => ({
    captionPos: window.__blk.dataset.captionPos,
    inCaption: [...window.__blk.querySelectorAll('.cmp-caption .cmp-hd')].length,
    boxes: [...window.__blk.querySelectorAll('.cmp-hd')].map(e => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }),
  }));
  expect(got.captionPos, `전제 — 캡션 모드로 그려졌다 (잰 값 ${JSON.stringify(got)})`).toBe('top');
  expect(got.inCaption, `전제 — 제목이 .cmp-caption «안»에 있다 (잰 값 ${got.inCaption})`).toBeGreaterThan(0);
  const dead = got.boxes.filter(b => b.w <= 0 || b.h <= 0);
  expect(dead, `빈 제목의 «누를 면적» — 잰 값 ${JSON.stringify(got.boxes)} · 0 짜리 ${dead.length}개`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('C2 ⒟ 캡션(top) 모드의 ★빈 제목을 더블클릭해 ★글자를 넣을 수 있다', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ captionPos: 'top', cols: [{ title: '', rows: [{type:'text',text:''}] }, { title: '', rows: [{type:'text',text:''}] }], featured: 1 });");
  await assertRuler(page);
  const hd = page.locator('#sB .comparison-block .cmp-caption .cmp-hd').first();
  const box = await hd.boundingBox();
  expect(box && box.width > 0 && box.height > 0, `전제 — 누를 사각형이 있다 (잰 값 ${JSON.stringify(box)})`).toBe(true);
  await hd.dblclick();
  const editable = await page.evaluate(() => !!document.activeElement?.isContentEditable);
  expect(editable, '전제 — 더블클릭으로 편집에 들어갔다').toBe(true);
  await page.keyboard.insertText('내 캡션');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(150);
  const m = await model(page);
  expect(String(m[0].title).trim(), `넣은 글자가 ★모델에 들어갔나 — 잰 값 ${JSON.stringify(m[0].title)}`).toBe('내 캡션');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('D1 ★음성대조: ★옛 저장본의 기본문구 칸은 여전히 「더블클릭=전체선택」이다 (⒞를 안 했다)', async ({ page }) => {
  /* 빈 블럭을 먼저 세워 ★런타임 명부를 읽고, ★그 값으로 «옛 저장본»을 다시 만든다
     (명부를 소스에서 베끼지 않으므로 앱이 뜬 뒤에야 알 수 있다). */
  const errs = await setup(page, 'window.addComparisonBlock({});');
  const LEGACY = await legacyList(page);
  const legacy = LEGACY[0];
  await page.evaluate((lg) => {
    const b = window.__blk;
    b.dataset.cols = JSON.stringify([{ title: 'A', bg: '#e9ebef', text: '#9aa0a8', rows: [{ type: 'text', text: lg }] },
                                     { title: 'B', bg: '#ffffff', text: '#1a1a1a', rows: [{ type: 'text', text: 'b' }] }]);
    b.dataset.featured = '1';
    window.renderComparison(b);
  }, legacy);
  await assertRuler(page);
  const cell = page.locator('#sB .comparison-block .cmp-row').first();
  await expect(cell, `전제 — 옛 기본문구 ${JSON.stringify(legacy)} 가 칸에 있다`).toHaveText(legacy);
  await cell.dblclick();
  const sel = await page.evaluate(() => (window.getSelection() || '').toString());
  expect(sel, `★전체선택 기전이 살아 있나 — 잰 값 ${JSON.stringify(sel)} (기대 ${JSON.stringify(legacy)})`).toBe(legacy);
  await page.keyboard.insertText('강아지 간식');
  const after = await cell.textContent();
  expect(after, `첫 타이핑이 «이어붙지» 않는다 — 잰 값 ${JSON.stringify(after)}`).toBe('강아지 간식');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('D2 ★음성대조: 사용자가 쓴 글자는 blur 가 안 건드린다', async ({ page }) => {
  const errs = await setup(page, "window.addComparisonBlock({ cols: [{ title: '내 제목', rows: [{type:'text',text:'내가 쓴 글'}] }, { title: 'B', rows: [{type:'text',text:'b'}] }], featured: 1 });");
  await assertRuler(page);
  const cell = page.locator('#sB .comparison-block .cmp-row').first();
  await cell.dblclick();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(150);
  const m = await model(page);
  expect(await cell.textContent(), '행 글자 보존').toBe('내가 쓴 글');
  expect(m[0].rows[0].text, `★모델 행 글자 보존 — 잰 값 ${JSON.stringify(m[0].rows[0].text)}`).toBe('내가 쓴 글');
  expect(m[0].title, `★모델 제목 보존 — 잰 값 ${JSON.stringify(m[0].title)}`).toBe('내 제목');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E1 ⑹ 저장 왕복 — 빈 칸이 저장→다시 열기 뒤에도 빈 칸이다', async ({ page }) => {
  await setup(page, 'window.addComparisonBlock({});');
  await assertRuler(page);
  const LEGACY = await legacyList(page);
  const id = await page.evaluate(() => window.__blk.id);
  const snap = await page.evaluate(() => window.serializeProject());
  /* ★저장본 자체에 기본문구가 실리지 않는다 — 「화면엔 없는데 데이터엔 있다」를 가른다. */
  for (const t of LEGACY) {
    expect(snap.includes(t), `저장본에 옛 기본문구 ${JSON.stringify(t)} 가 실렸다`).toBe(false);
  }
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(400);
  const after = await page.evaluate((bid) => {
    const b = document.getElementById(bid);
    if (!b) return { missing: true };
    window.__blk = b;
    return { hd: [...b.querySelectorAll('.cmp-hd')].map(e => e.textContent),
             rows: [...b.querySelectorAll('.cmp-row')].map(e => e.textContent) };
  }, id);
  expect(after.missing, '전제 — 불러온 뒤 그 블럭이 같은 id 로 있다').toBeUndefined();
  const stuck = [...after.hd, ...after.rows].filter(t => LEGACY.includes(t.trim()));
  expect(stuck, `왕복 뒤 옛 기본문구가 되살아난 칸 ${stuck.length}개 — 잰 값 ${JSON.stringify(after)}`).toEqual([]);
});
