/* t4-08-radial-arc-angle-reset.dom.spec.js
 *   ★`t4-08` — ★호 모드 ★각도 ★초기화 버튼. (2026-10-25 신설 · 지디)
 *
 * ★원문(p10502 · ⛔요약 아님) : 「t4-08 ★모양을 '호'로 하고 난뒤에는 ★시작각도 끝각도가
 *   슬라이드를 만지다가 ★다시 처음으로 돌리려는데, ★어디가 처음인지 ★★-90, 90이란 숫자를
 *   모르면 되돌리는데 시간이 좀 걸려. ★★초기화 버튼을 ★옆에 넣어주면 좋을 듯해」
 *
 * ★찾은 이 = 레인 L1(전수 채점 261025) — 「★호 각도 리셋 버튼 ★없음 · ★양성대조 : ★항목리셋
 *   `rdl-reset-all`·`rdl-item-reset` 은 ★있으나 ★★각도용이 ★아님」 ⇒ ★★진짜 미구현
 *
 * ★★★「★처음」의 ★정의를 ★가렸다 (261025 · ★한 번 ★헛짚었다)
 *   ★`RADIAL_DEFAULTS.endDeg` 는 ★★`60` 이라 ★★원문의 `90` 과 ★달라 ★나는 ★어긋남으로 ★의심했다.
 *   ★★그런데 ★그것은 ★★«원·다각형» 모드의 값이고, ★★호 모드의 ★「처음」은 ★따로 있었다 :
 *     `RADIAL_ARC_PRESET = { ...window.RADIAL_ARC_GEOM.HALF, … }`  (radial-block.js:65)
 *     `HALF = Object.freeze({ startDeg: ★-90, endDeg: ★90, centerX: 0, lineExtend: 0 })`
 *                                                        (js/radial-arc-geom.js:39 · ★★한 자리)
 *   ⇒ ★★원문의 ★`-90, 90` 이 ★맞았다. ⛔내가 ★잘못 의심했다.
 *   ⇒ ★★그래서 ★버튼은 ★★`RADIAL_ARC_PRESET` 에서 ★★파생해야 한다 —
 *     `js/props/prop-radial.js` 머리말이 ★이미 적는다 : 「★한도·기본값은 ★한 표에서 온다 —
 *       ★★여기 리터럴로 ★다시 적지 ★않는다」. ⇒ ★그 규율 ★그대로.
 *
 * ★★이 파일이 ★잠그는 것 ★셋
 *   ⑴ ★호 모드 패널에 ★그 버튼이 ★있다 (★고침 전엔 ★빨강)
 *   ⑵ ★누르면 ★시작·끝 각도가 ★★`HALF` 값으로 ★돌아간다
 *   ⑶ ★★⛔그 값이 ★패널에 ★리터럴로 ★박혀 있지 ★않다 — ★한 자리에서 ★파생한다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t4-08-radial-arc-angle-reset
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

/** ★섹션 ＋ 방사형 블럭을 만들고 ★호 모드로 ★실클릭 전환한다(t4-10 spec 과 같은 길). */
async function arcPanel(page) {
  const made = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec) return { fail: '섹션이 없다' };
    window.selectSection(sec);
    if (typeof window.addRadialBlock !== 'function') return { fail: 'addRadialBlock 없음' };
    window.addRadialBlock();
    const b = sec.querySelector('.radial-block');
    if (!b) return { fail: '.radial-block 이 없다' };
    return { id: b.id };
  });
  if (made.fail) return made;
  const btn = page.locator('#rdl-shape-arc');
  if (await btn.count() === 0) return { fail: '#rdl-shape-arc 가 없다 — 패널이 안 열렸다' };
  await btn.click();
  const st = await page.evaluate(() => {
    const b = document.querySelector('.radial-block');
    return {
      shape: b?.dataset.shape, start: b?.dataset.startDeg, end: b?.dataset.endDeg,
      hasStartRow: !!document.getElementById('rdl-start-number'),
      hasEndRow: !!document.getElementById('rdl-end-number'),
    };
  });
  return { ...made, ...st };
}

test('A0 ★전제 — ★호 모드로 바꾸면 ★시작·끝 각도가 ★★`HALF` 값이다 (★「처음」의 정의)', async ({ page }) => {
  await bootApp(page);
  const r = await arcPanel(page);
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  console.log('[A0]', JSON.stringify(r));
  expect(r.shape, '★호 모드가 아니다').toBe('arc');
  expect(r.hasStartRow && r.hasEndRow, '★시작·끝 각도 줄이 안 그려졌다').toBe(true);
  /* ★★★「처음」 = `RADIAL_ARC_GEOM.HALF` (js/radial-arc-geom.js:39) — ★원문의 -90·90 과 같다 */
  expect(r.start, `★호의 시작 각도가 -90 이 아니다 (${r.start})`).toBe('-90');
  expect(r.end, `★호의 끝 각도가 90 이 아니다 (${r.end}) — ★RADIAL_DEFAULTS.endDeg(60)과 ★다르다`).toBe('90');
});

test('A1 ★★★t4-08 — ★호 모드 패널에 ★각도 ★초기화 버튼이 ★있다 (★고침 전엔 ★빨강)', async ({ page }) => {
  await bootApp(page);
  const r = await arcPanel(page);
  expect(r.fail).toBeUndefined();
  expect(r.shape, '★전제: 호 모드가 아니다').toBe('arc');
  const n = await page.locator('#rdl-angle-reset').count();
  /* ★★양성대조 — ★이미 있는 ★다른 리셋 버튼은 ★보인다(⛔「패널에 버튼이 아예 없다」가 아니다) */
  const other = await page.locator('#rdl-reset-all').count();
  console.log('[A1]', JSON.stringify({ angleReset: n, resetAll: other }));
  expect(other, '★`rdl-reset-all` 도 없다 — 패널이 안 열렸나(아래 0 이 뜻을 잃는다)').toBeGreaterThan(0);
  expect(n, '★각도 초기화 버튼(#rdl-angle-reset)이 ★없다 — t4-08').toBe(1);
});

test('A2 ★★누르면 ★`HALF` 값으로 ★돌아간다 (★행위로)', async ({ page }) => {
  await bootApp(page);
  const r = await arcPanel(page);
  expect(r.fail).toBeUndefined();
  if (await page.locator('#rdl-angle-reset').count() === 0) {
    test.skip(true, '★버튼이 없다 — A1 이 그것을 잡는다(★여기서 또 빨개뜨리지 않는다)');
  }
  /* ★★사람이 하는 그 순서 — ★값을 ★바꿔 두고 ★누른다.
     ★★261025 ★실측 : ★`dispatchEvent` 로만 바꾸니 ★패널이 ★다시 안 그려져 ★버튼이 ★`disabled` 로
       ★남아 ★클릭이 ★타임아웃했다(★`rdl-reset-all` 과 ★같은 꼴로 ★disabled 를 쓴다).
     ⇒ ★★`page.fill`(실마우스·실타이핑)로 바꾸고 ★★버튼이 ★★풀리기를 ★기다린다
       (★L2 교훈 : ★패널은 ★`selectBlock` 말고 ★실조작으로 움직인다). */
  await page.fill('#rdl-end-number', '30');
  await page.press('#rdl-end-number', 'Enter');
  await expect.poll(
    () => page.evaluate(() => document.querySelector('.radial-block')?.dataset.endDeg),
    { message: '★전제: 끝 각도가 30 으로 안 바뀌었다 — 아래 복원이 뜻을 잃는다' },
  ).toBe('30');
  /* ★★261025 — ★`disabled` 설계를 ★★버렸다(제품 주석에 까닭) ⇒ ★★언제나 ★누를 수 있어야 한다 */
  await expect.poll(
    () => page.evaluate(() => !document.getElementById('rdl-angle-reset')?.disabled),
    { message: '★버튼이 ★꺼져 있다 — ★`disabled` 를 ★쓰지 않기로 했는데 되살아났나' },
  ).toBe(true);
  await page.locator('#rdl-angle-reset').click();
  const after = await page.evaluate(() => {
    const b = document.querySelector('.radial-block');
    return { start: b?.dataset.startDeg, end: b?.dataset.endDeg };
  });
  console.log('[A2]', JSON.stringify(after));
  expect(after.start, `★시작이 -90 으로 안 돌아왔다 (${after.start})`).toBe('-90');
  expect(after.end, `★끝이 90 으로 안 돌아왔다 (${after.end})`).toBe('90');
  /* ★★★되돌린 뒤 ★또 눌러도 ★★아무 일 없다 — ★「조용히 아무 일 없음 = ★해당 없음」 */
  await page.locator('#rdl-angle-reset').click();
  const again = await page.evaluate(() => {
    const b = document.querySelector('.radial-block');
    return { start: b?.dataset.startDeg, end: b?.dataset.endDeg };
  });
  console.log('[A2-again]', JSON.stringify(again));
  expect(again, '★이미 처음 값인데 또 누르니 ★값이 움직였다').toEqual(after);
});

test('A3 ★★⛔그 값이 ★패널에 ★리터럴로 ★박혀 있지 ★않다 — ★한 자리에서 ★파생 (★칸 둘)', () => {
  /* ★`prop-radial.js` 머리말 규율 : 「★한도·기본값은 ★한 표에서 온다 — ★여기 리터럴로 ★다시 적지 않는다」
     ★★★261025 ★자를 ★고쳤다 — ★첫 판은 ★★무력화를 ★못 잡았다 :
       ★변이 `const want = k === 'startDeg' ? '-90' : '90';` 를 심었는데 ★`A3` 가 ★★초록이었다.
       ★까닭 = ★옛 regex `(?:startDeg|endDeg)\s*[:=]\s*(-?\d+)` 는 ★★`===` ＋ 따옴표 꼴을 ★못 본다.
     ⇒ ★★자를 ★둘로 갈랐다 : ⑴ ★그 수의 ★리터럴이 ★없나 ⑵ ★★핸들러가 ★정말 ★PRESET 을 ★읽나
       ⇒ ★★⑵ 가 ★그 변이를 ★잡는다. */
  const raw = fs.readFileSync(path.join(ROOT, 'js/props/prop-radial.js'), 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  /* ★★전제 — ★그 파일이 ★`RADIAL_ARC_PRESET` 을 ★쓴다 */
  expect(/RADIAL_ARC_PRESET/.test(src), '★prop-radial.js 가 RADIAL_ARC_PRESET 을 안 쓴다').toBe(true);

  /* ⑴ ★★`-90` · `90` 이 ★★«각도 되돌리기 쪽»에 ★리터럴로 있나 —
       ★핸들러 블록만 잘라 본다(⛔파일 전체는 한도 -180/180/360 등이 섞여 자가 헛돈다) */
  const h = src.slice(src.indexOf("$('rdl-angle-reset')"));
  const body = h.slice(0, h.indexOf('});') + 3);
  expect(body.length, '★`rdl-angle-reset` 핸들러를 못 찾았다 — 자가 헛돈다').toBeGreaterThan(40);
  const lits = [...body.matchAll(/'-?90'|\b-?90\b/g)].map(m => m[0]);
  console.log('[A3-lits]', JSON.stringify({ body: body.length, lits }));
  expect(lits, `★핸들러에 각도 값이 ★리터럴로 박혀 있다 (${JSON.stringify(lits)}) — ★한 자리에서 파생하라`).toEqual([]);

  /* ⑵ ★★★핸들러가 ★정말 ★`RADIAL_ARC_PRESET` 을 ★읽나 — ★★이 칸이 ★변이를 ★잡는다 */
  expect(/RADIAL_ARC_PRESET\s*\[/.test(body),
    `★핸들러가 ★PRESET 을 ★안 읽는다 — ★값을 ★손으로 적었나\n  본문: ${body.slice(0, 300)}`
  ).toBe(true);
});
