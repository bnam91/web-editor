/* grid-gap-line-height.dom.spec.js — 현빈 「칸 > 갭 줄을 더하면 갭 높이 조절이 안 된다」(TASK-20261003-goditor-32 ②G3)
 * 칸 안 «여백 줄(type:gap)» 의 높이 — 패널 「높이(px)」 칸(grd-line-gap-h) → 렌더 높이 · dataset · ⌘Z · 저장 왕복.
 * 앱 통째(bootApp) · 줄 고르기·입력은 진짜 마우스·키. */
const { test, expect } = require('@playwright/test');
const { bootApp, ROOT } = require('./_root-harness.js');

async function setup(page, lines) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((lines) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, lines);
  await page.waitForTimeout(200);
}
const gapOff = (page) => page.evaluate(() => document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-gap')?.offsetHeight ?? null);
const model = (page) => page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines.map(l => l.type + ':' + (l.height ?? '')));
async function selectGap(page) {
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-gap').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  await page.mouse.click(x, y); await page.waitForTimeout(300);
}
async function typeHeight(page, v) {
  const box = await page.evaluate(() => { const e = document.getElementById('grd-line-gap-h'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  expect(box, '패널에 갭 줄 높이 칸(grd-line-gap-h)').not.toBeNull();
  await page.mouse.click(box[0], box[1]);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}
const LINES = [{ type: 'body', text: 'A' }, { type: 'gap', height: 16 }, { type: 'body', text: 'C' }];

test('G3-0 전제 — 갭 줄이 16px 로 그려지고 패널에 높이 칸이 있다', async ({ page }) => {
  await setup(page, LINES);
  expect(await gapOff(page)).toBe(16);
  await selectGap(page);
  expect(await page.evaluate(() => document.getElementById('grd-line-gap-h')?.value)).toBe('16');
  expect(await page.evaluate(() => document.getElementById('grd-line-gap-h')?.getBoundingClientRect().width), '★높이 칸이 «보인다»(접힌 절 안에 숨지 않는다)').toBeGreaterThan(0);
});
test('G3-1 ★높이 칸에 60 → 렌더 높이 60 · 모델 gap:60 · ⌘Z 로 16 · 저장 왕복 60', async ({ page }) => {
  await setup(page, LINES);
  await selectGap(page);
  await typeHeight(page, 60);
  expect(await gapOff(page)).toBe(60);
  expect(await model(page)).toEqual(['body:', 'gap:60', 'body:']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await gapOff(page)).toBe(16);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  expect(await gapOff(page)).toBe(60);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(400);
  expect(await gapOff(page)).toBe(60);
});
test('G3-2 ★두 번째로 바꿔도 먹는다(60 → 100)', async ({ page }) => {
  await setup(page, LINES);
  await selectGap(page); await typeHeight(page, 60);
  await selectGap(page); await typeHeight(page, 100);
  expect(await gapOff(page)).toBe(100);
});
test('G3-3 갭 줄만 든 칸 — 높이 칸이 뜨고 먹는다', async ({ page }) => {
  await setup(page, [{ type: 'gap', height: 16 }]);
  await selectGap(page); await typeHeight(page, 80);
  expect(await gapOff(page)).toBe(80);
});
test('G3-4 ★갭 줄은 처음부터 펼침 · 머리글을 누르면 접히고 다시 누르면 펴진다(첫 클릭에 튀지 않는다) · 글자 줄은 여전히 접힘 기본', async ({ page }) => {
  await setup(page, LINES);
  await selectGap(page);
  const tg = () => page.evaluate(() => { const e = document.getElementById('grd-line-toggle').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  const vis = () => page.evaluate(() => document.getElementById('grd-line-body').style.display);
  expect(await vis()).toBe('block');
  let t = await tg(); await page.mouse.click(t[0], t[1]); await page.waitForTimeout(200);
  expect(await vis()).toBe('none');
  t = await tg(); await page.mouse.click(t[0], t[1]); await page.waitForTimeout(200);
  expect(await vis()).toBe('block');
});
test('G3-5 대조 — 글자 줄은 여전히 접힘 기본(펼침 기본은 갭·구분선 줄만)', async ({ page }) => {
  await setup(page, LINES);
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-line').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('grd-line-body')?.style.display)).toBe('none');
});

/* G3-6 ★줄 종류마다 「줄 꾸미기 기본 펼침인가 접힘인가」가 «적혀 있다» — 새 줄 종류가 생기면 여기서 빨개진다.
 *   _GRD_LINE_OPEN_KINDS 는 손으로 적은 명부이고 도출이 안 된다(패널에 «줄 전용 영역» 경계가 없다 — 줄바·줄 꾸미기·Image·Typography 가
 *   칸·블록 절과 같은 깊이의 형제 .prop-section 이고 표식이 없어 「줄 꾸미기 밖 줄 전용 입력 0개」를 못 센다. 실측: 밖 입력 갭18·구분선18·그림21·글자26).
 *   ⛔「최솟값인 종류 == Set」은 시험을 Set 에 맞추는 꼴이라 쓰지 않았다. 대신 «명시 분류»: 종류 정본을 코드에서 «읽어 와»
 *   각 종류가 펼침(Set) 아니면 접힘(아래 FOLD) 어느 한쪽에 «반드시» 있게 한다. 종류가 늘면 «어느 쪽인가»를 정하게 강제한다.
 *   종류 정본 = 렌더러(grid-block.js)가 가지치는 줄 종류: GRID_ROLES 키 ∪ `line.type === '…'` 리터럴 ∪ GRID_NESTED_LINE_TYPE.
 *   (손으로 8개를 박지 않는다 — 코드가 말하는 종류 수는 이 시험이 센다.) */
test('G3-6 ★렌더러가 아는 모든 줄 종류가 「펼침 Set」 또는 「접힘 목록」 한쪽에 있다(둘 다·둘 다 아님 금지)', async ({ page }) => {
  const fs = require('fs'), path = require('path');
  const gb = fs.readFileSync(path.join(ROOT, 'js/blocks/grid-block.js'), 'utf8');   // ROOT = GD1001_ROOT(변이 사본) 또는 이 레포
  const pg = fs.readFileSync(path.join(ROOT, 'js/props/prop-grid.js'), 'utf8');
  const m = /_GRD_LINE_OPEN_KINDS\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(pg);
  expect(m, 'Set 선언을 찾았다').not.toBeNull();
  const OPEN = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  /* 접힘 목록 — 「줄 꾸미기 밖에도 줄 전용 손잡이가 있다」: 글자 줄(타이포 절) · 그림 줄(Image 절) · 중첩/그래프 줄(칸에서 그 줄 자체를 다룸) */
  const FOLD_NONROLE = ['image', 'duo', 'graph'];
  await bootApp(page);
  const { roles, nested } = await page.evaluate(async () => {
    const mod = await import('/js/blocks/grid-block.js');
    return { roles: Object.keys(mod.GRID_ROLES), nested: mod.GRID_NESTED_LINE_TYPE };
  });
  /* 출처를 «글자»가 아니라 «뜻»으로 넓혔다(적대QA — `ln.type === 'quote'` 와 패널 _GRD_KINDS 에만 넣은 종류가 빠져 나갔다):
   *   ① 렌더러의 `<아무 변수>.type === '…'`  ② 패널 종류 명부 _GRD_KINDS 의 문자열 리터럴  ③ GRID_ROLES 키  ④ GRID_NESTED_LINE_TYPE */
  const literals = [...gb.matchAll(/\.type\s*===\s*'([a-z][a-z0-9_-]*)'/g)].map(x => x[1]);
  const km = /_GRD_KINDS\s*=\s*\[([^\]]*)\]/.exec(pg);
  expect(km, '_GRD_KINDS 선언을 찾았다').not.toBeNull();
  const panelKinds = [...km[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  const known = [...new Set([...roles, nested, ...literals, ...panelKinds])].sort();
  expect(known.length, '종류를 읽어 왔다: ' + known.join(',')).toBeGreaterThan(8);
  const FOLD = new Set([...roles, ...FOLD_NONROLE]);
  const bad = known.filter(k => OPEN.includes(k) === FOLD.has(k));
  expect(bad, '펼침/접힘 «어느 쪽인지» 안 정해졌거나 양쪽에 있는 종류 — 정하라(prop-grid.js _GRD_LINE_OPEN_KINDS 머리 주석 참고)').toEqual([]);
  expect(OPEN.filter(k => !known.includes(k)), 'Set 에 있는데 렌더러가 모르는 종류').toEqual([]);
});

test('G3-7 ★글자 줄에서 「줄 꾸미기」를 열었다 닫아도 같은 그리드의 갭 줄은 접히지 않는다(접힘 기억은 종류별)', async ({ page }) => {
  await setup(page, LINES);
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-line').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  const tg = () => page.evaluate(() => { const e = document.getElementById('grd-line-toggle').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  let t = await tg(); await page.mouse.click(t[0], t[1]); await page.waitForTimeout(200);   // 글자 줄: 열기
  t = await tg(); await page.mouse.click(t[0], t[1]); await page.waitForTimeout(200);       // 글자 줄: 닫기
  expect(await page.evaluate(() => document.getElementById('grd-line-body').style.display), '글자 줄은 닫혔다(전제)').toBe('none');
  await selectGap(page);
  expect(await page.evaluate(() => document.getElementById('grd-line-body').style.display), '갭 줄은 안 접었으니 펼침').toBe('block');
  expect(await page.evaluate(() => document.getElementById('grd-line-gap-h').getBoundingClientRect().width), '높이 칸 폭 > 0').toBeGreaterThan(0);
});
