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
 * ★t4-06(0.9.11) — 현빈 원문: 「컴패리전 블록 우측 패널의 텍스트 입력 영역 제거 … 캔버스에서 직접 텍스트를 편집할 수
 *   있으므로 우측 패널의 중복 텍스트 입력 UI 제거」. 「고른 글자 칸」 절(#cmp-text-section · Text 제목 + #cmp-text-input)을
 *   통째로 뺐다(절 안에 그 둘뿐이라 빈 껍데기도 같이). A1 은 «textarea 로 고침» → «캔버스 더블클릭으로 고침»으로 바꿔 쓴다.
 *
 * 양성대조(t4-06): prop-comparison.js 를 e7d97f1ec 로 되돌리면 A1 의 「절 0 · textarea 0 · Text 제목 0」 이 빨강.
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

/* ★t4-06 — 옛 A1(textarea 로 고침)을 캔버스로 옮겼다.
 * ⚰️옛 단언 → 새 단언:
 *   `#cmp-text-section` 1                  → 0(절이 없다) ＋ #cmp-text-input 0 ＋ 패널에 「Text」 제목 0
 *   textarea 초깃값 = 'a1'                → 캔버스 칸(0,1) textContent = 'a1'(편집 전 · 같은 출처 모델과 일치)
 *   textarea input → 모델 '바뀐글자'      → 캔버스 더블클릭 → 전체선택 → 타이핑 → blur → 모델 '바뀐글자'
 *   캔버스 칸 textContent = '바뀐글자'    → 같다(그대로)
 *   ＋새: ⌘Z 한 번 → 모델·캔버스 'a1'(히스토리 len 불변 · 구제 칸 0) · 저장 왕복(serializeProject→applyProjectData) 뒤 편집 생존 · 콘솔 에러 0 */
async function canvasEdit(page, c, r, text) {
  await page.locator(cellSel(c, r)).dblclick();
  await page.waitForFunction((s) => document.activeElement?.closest?.('.cmp-row') === document.querySelector(s), cellSel(c, r), { timeout: 3000 });
  await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete');
  await page.keyboard.type(text);
  await page.evaluate(() => document.activeElement?.blur?.());
}
const panelTextTitles = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#panel-right .prop-section-title')].filter(e => e.textContent.trim() === 'Text').length);

test('A1 글자 칸(0,1) 고름 → 패널에 글자 입력 절 0 · 캔버스 더블클릭 타이핑 → 모델·캔버스 갱신 · ⌘Z 한 번 복구 · 저장 왕복 생존', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await count(page, '#panel-right .prop-section'), '전제 — 패널이 그려졌다').toBeGreaterThan(0);
  expect(await count(page, '#cmp-text-section'), 't4-06 — 「고른 글자 칸」 절 0').toBe(0);
  expect(await count(page, '#cmp-text-input'), 't4-06 — textarea 0').toBe(0);
  expect(await panelTextTitles(page), 't4-06 — 패널 «Text» 제목 0').toBe(0);
  expect(await count(page, '#cmp-feat-group'), '이웃 절(강조 칼럼)은 그대로 산다').toBe(1);
  expect(await count(page, '.cmp-row-h'), '행 높이 칸 그대로 산다').toBeGreaterThan(0);
  expect(await page.evaluate((s) => document.querySelector(s)?.textContent, cellSel(0, 1)), '편집 전 캔버스 = a1').toBe('a1');

  const h0 = await page.evaluate(() => window.getHistoryTip());
  await canvasEdit(page, 0, 1, '바뀐글자');
  await expect.poll(async () => (await model(page))[0].rows[1].text, { timeout: 3000 }).toBe('바뀐글자');
  expect(await page.evaluate((s) => document.querySelector(s)?.textContent, cellSel(0, 1)), '캔버스도 갱신').toBe('바뀐글자');
  const h1 = await page.evaluate(() => window.getHistoryTip());
  expect(h1.pos - h0.pos >= 1 && h1.seq !== h0.seq, `편집 끝 표본이 쌓였다 ${JSON.stringify([h0, h1])}`).toBe(true);

  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await model(page))[0].rows[1].text, { timeout: 3000, message: '⌘Z 한 번 → a1' }).toBe('a1');
  await page.waitForFunction((s) => document.querySelector(s)?.textContent === 'a1', cellSel(0, 1), { timeout: 3000 });
  const h2 = await page.evaluate(() => window.getHistoryTip());
  expect([h2.len - h1.len, h2.pos - h1.pos], `⌘Z = 구제 칸 없이 정확히 한 칸 아래 ${JSON.stringify([h1, h2])}`).toEqual([0, -1]);

  /* 저장 왕복 — 다시 캔버스로 고친 뒤 serializeProject → applyProjectData */
  await canvasEdit(page, 0, 1, '저장글자');
  await expect.poll(async () => (await model(page))[0].rows[1].text, { timeout: 3000 }).toBe('저장글자');
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
  await page.waitForFunction((s) => document.querySelector(s)?.textContent === '저장글자', cellSel(0, 1), { timeout: 5000 });
  const re = await page.evaluate(() => window.getComparisonCols(document.querySelector('#sB .comparison-block').dataset));
  expect(re[0].rows[1].text, '왕복 뒤 모델 생존').toBe('저장글자');
  expect(re[0].rows[0].text, '이웃 칸 무변').toBe('a0');
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
