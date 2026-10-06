/* grid-line-bold-role.dom.spec.js — G13 그리드 줄 ⌘B(굵게 단추)가 «역할 기본»을 존중한다 (2026-10-04, 지디 처방 · 태양)
 *
 * 결함(4cb34b90): boldBtn 이 weight 를 「지금 ≥700 ? 400 : 700」 로 «박았다». 역할 기본이 600 인 줄(label·h2·h3)은
 *   600→700→400→700… 으로 600 에 영영 못 돌아오고, 400 이 데이터에 남아 역할을 바꿔도 새 역할 기본을 안 따라갔다(조용한 훼손).
 * 처방: ON = weight 700 · OFF = weight 키 «삭제»(역할 기본). 예외 — 역할 기본 ≥700(h1)은 옛 동작(OFF = 400) 그대로.
 * ① label·h2·h3: ON → 700 · OFF → 실효 600 + 저장 데이터에 weight 키 «없음»
 * ② h2 ON→OFF 뒤 역할을 h1 로 → 실효 700(새 역할을 따른다) ← 고침의 핵심
 * ③ h1·body·caption: ⌘B 세 번의 «실효 굵기·단추 켜짐» 순서가 핀 4cb34b90 과 같다(핀에서 잰 순서를 아래 PIN_SEQ 에 박았다).
 *    ⚠️body·caption 은 OFF 때 «저장 키»가 핀('400')과 다르다(이제 키 없음 = 역할 기본 400) — 실효는 같다. 키 열은 기록만 한다.
 * ④ ⌘B 한 번 = ⌘Z 한 걸음
 * 양성대조: 핀(GD1001_ROOT=<4cb34b90 사본>)에서 ①② 빨강 · OFF 가 400 을 쓰는 사본 변이에서 ①② 빨강 — 보고서 G13-FIX.
 * ⚠️이전 문서에 박힌 굵기는 옮기지 않는다(현빈 「새로 만드는 것만」) — 이 시험은 «새로 누르는» 길만 잰다.
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TYPES = ['label', 'h1', 'h2', 'h3', 'body', 'caption'];
async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate((TYPES) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="bS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="bI" style="padding-left:40px;padding-right:40px"></div></div>`);
    const { row, block } = window.makeGridBlock({ cols: [{ width: 1, lines: TYPES.map(t => ({ type: t, text: t + ' 글자' })) }], rows: [{ height: 'auto' }] });
    block.id = 'bG'; document.getElementById('bI').appendChild(row); window.rebindAll?.(); window.renderGridBlock(block);
    window.deselectAll?.();
  }, TYPES);
  await page.waitForTimeout(150);
  return errs;
}
/** 줄 li 를 골라 패널을 연다(블럭 클릭 처리기와 같은 문: showGridProperties(block, addr)). */
const openLine = (page, li) => page.evaluate((li) => {
  const b = document.getElementById('bG');
  window.deselectAll?.(); b.classList.add('selected');
  const addr = { r: 0, c: 0, li };
  window.grdSetActiveLine?.(b, addr); window.showGridProperties(b, addr);
}, li);
/** 저장 키·실효 굵기·단추·select 를 한 번에 읽는다. */
const read = (page, li) => page.evaluate((li) => {
  const b = document.getElementById('bG');
  const line = window.getGridModel(b).cells[0][0].lines[li];
  const el = b.querySelectorAll('.grd-cell')[0].querySelectorAll('.grd-line')[li];
  const btn = document.getElementById('grd-typo-bold-btn'), sel = document.getElementById('grd-typo-font-weight');
  return { type: line.type, hasKey: Object.prototype.hasOwnProperty.call(line, 'weight'), key: line.weight == null ? null : String(line.weight),
           eff: Number(getComputedStyle(el).fontWeight), active: !!btn?.classList.contains('active'), sel: sel?.value ?? null, selTitle: sel?.title ?? '' };
}, li);
const bold = async (page) => { await page.click('#grd-typo-bold-btn'); await page.waitForTimeout(120); };

test.setTimeout(120000);

for (const t of ['label', 'h2', 'h3']) {
  test(`① ${t}(역할 기본 600): ⌘B ON → 700 · OFF → 실효 600 + weight 키 없음`, async ({ page }) => {
    const errs = await setup(page);
    const li = TYPES.indexOf(t);
    await openLine(page, li);
    const s0 = await read(page, li);
    expect(s0, '전제 — 역할 기본 600 · 키 없음').toMatchObject({ eff: 600, hasKey: false, active: false });
    await bold(page);
    expect(await read(page, li), 'ON').toMatchObject({ eff: 700, key: '700', active: true, sel: '700' });
    await bold(page);
    const off = await read(page, li);
    expect(off, `OFF — 실효 600 · 키 없음(실제 키=${off.key})`).toMatchObject({ eff: 600, hasKey: false, active: false, sel: '600', selTitle: '역할 기본값' });
    await openLine(page, li);   // 패널을 다시 그려도 같은 말
    expect(await read(page, li), '패널 다시 그림').toMatchObject({ eff: 600, hasKey: false, active: false, sel: '600' });
    expect(errs).toEqual([]);
  });
}

test('② h2 ⌘B ON→OFF 뒤 역할을 h1 로 → 실효 700(새 역할 기본을 따른다)', async ({ page }) => {
  const errs = await setup(page);
  const li = TYPES.indexOf('h2');
  await openLine(page, li);
  await bold(page); await bold(page);
  const off = await read(page, li);
  expect(off.eff, '전제 — OFF 뒤 600').toBe(600);
  /* 역할 바꾸기 = 패널 「종류」 select(#grd-line-kind) 의 change 배선 그대로. 글자 줄은 그 절이 «접힌 채» 열려 마우스로는 안 보여서
     값을 넣고 change 를 쏜다 — 바꾸는 문(_grdWireKindSelects)은 실제 것이다. */
  const has = await page.evaluate(() => { const s = document.getElementById('grd-line-kind'); if (!s) return false; s.value = 'h1'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; });
  expect(has, '전제 — 패널에 종류 select 가 있다').toBe(true);
  await page.waitForTimeout(250);
  const s = await read(page, li);
  expect(s.type, '전제 — 역할이 h1 로 바뀌었다').toBe('h1');
  expect(s, `역할 h1 → 실효 700 (키=${s.key})`).toMatchObject({ eff: 700, hasKey: false });
  expect(errs).toEqual([]);
});

/* ③ 핀 4cb34b90 에서 잰 순서(GD1001_ROOT 판 — 보고서 G13-FIX 표). [실효, 단추 켜짐] × (처음, ⌘B 1·2·3번). */
const PIN_SEQ = {
  h1:      [[700, true], [400, false], [700, true], [400, false]],
  body:    [[400, false], [700, true], [400, false], [700, true]],
  caption: [[400, false], [700, true], [400, false], [700, true]],
};
for (const t of ['h1', 'body', 'caption']) {
  test(`③ ${t}: ⌘B 세 번의 실효·단추 순서가 핀과 같다`, async ({ page }) => {
    const errs = await setup(page);
    const li = TYPES.indexOf(t);
    await openLine(page, li);
    const seq = [], keys = [];
    let s = await read(page, li); seq.push([s.eff, s.active]); keys.push(s.key);
    for (let i = 0; i < 3; i++) { await bold(page); s = await read(page, li); seq.push([s.eff, s.active]); keys.push(s.key); }
    console.log(`③ ${t} seq=${JSON.stringify(seq)} keys=${JSON.stringify(keys)}`);
    expect(seq, `${t} 순서 — 핀 ${JSON.stringify(PIN_SEQ[t])}`).toEqual(PIN_SEQ[t]);
    expect(errs).toEqual([]);
  });
}

test('④ ⌘B 한 번 = ⌘Z 한 걸음 (ON 도 OFF 도)', async ({ page }) => {
  const errs = await setup(page);
  const li = TYPES.indexOf('h3');
  await openLine(page, li);
  await page.evaluate(() => window.pushHistory?.('판'));
  await bold(page);                                         // ON
  expect((await read(page, li)).eff).toBe(700);
  await bold(page);                                         // OFF
  expect((await read(page, li))).toMatchObject({ eff: 600, hasKey: false });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await read(page, li), '⌘Z 한 번 = OFF 만 되돌림 → 700').toMatchObject({ eff: 700, key: '700' });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await read(page, li), '⌘Z 두 번 = ON 도 되돌림 → 600 · 키 없음').toMatchObject({ eff: 600, hasKey: false });
  expect(errs).toEqual([]);
});
