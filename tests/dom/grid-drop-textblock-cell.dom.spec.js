/* grid-drop-textblock-cell.dom.spec.js — G9 (현빈 2026-10-03, 수지맥 건) 「텍스트블럭을 끌어 그리드 칸에 넣으려는데 안 들어간다」
 * 측정(604602cd, 진짜 마우스 끌기): 글자 블럭을 칸 위에 놓으면 칸 줄 수 1→1 · 블럭은 섹션 형제로 남아 «행 순서만» 바뀐다.
 *   칸이 블럭을 «받는» 길이 아예 없었다(원인=기능 부재, 칸 판정 오류 아님).
 * 고침: prop-grid.js grdDropTextBlockOnCell — 섹션/프레임 드롭 처리기가 먼저 부른다. 글자 블럭 하나뿐인 행/블럭 + 놓은 자리가 바깥 그리드 칸일 때만 받는다.
 * ★양성대조: GD1001_ROOT=<604602cd 체크아웃> → T1~T4 빨강 / T5·T6 초록(지키는 시험).
 * ★이 꼴(.row > .text-block)은 지금 앱에서 T▾ 로는 안 생긴다(복사·옛 문서만) — E126 · 실제 꼴 시험 = tests/dom/grid-drop-textframe-cell.dom.spec.js
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=2 grid-drop-textblock-cell */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;나&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;},{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;라&quot;}]}]';
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:60px"></div>
<div class="row" id="rT"><div class="text-block" data-type="heading" id="tT"><div class="tb-h2" style="color: rgb(200, 0, 0);">끌 글</div></div></div>
<div class="row" id="rA"><div class="asset-block" id="aA" data-align="center"><div class="asset-overlay"></div></div></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.renderGridBlock?.(document.getElementById('gG')); window.clearHistory?.(); }, SEC);
  await page.waitForTimeout(500);
  /* ★끌기 기록기(지디 07:4x · ROW-DROP-ON-GAP-NOOP-01) — 끌기 «전»에 한 번 심고, 놓은 «뒤»에 한 번 읽는다(drag() 안 evaluate 0 — 끌기 중
     page.evaluate 를 끼우면 머무름이 생겨 결과가 바뀌었다: 탐침 1/10 vs 원 꼴 5/6). document capture 라 행 dragstart 의
     stopPropagation(section-drag.js:371)보다 먼저 돈다. 선례: drag-shape-flow-overlay-frame.dom.spec.js:61 · free-frame-drop-keeps-siblings:120-121. */
  await page.evaluate(() => { window.__dg = [];
    for (const t of ['dragstart', 'drop']) document.addEventListener(t, (e) => window.__dg.push([t, e.target?.id || '']), true); });
}
const dragLog = (page) => page.evaluate(() => window.__dg || []);
const rect = (page, q) => page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, h: r.height }; }, q);
const cellTexts = (page, c) => page.evaluate((c) => [...document.querySelectorAll(`#gG [data-r="0"][data-c="${c}"][data-line]`)].map(e => e.textContent.trim()), c);
async function drag(page, srcSel, x, y, { pick = false } = {}) {
  const s = await rect(page, srcSel);
  if (pick) { await page.mouse.click(s.x, s.y); await page.waitForTimeout(200); }
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 10, s.y + 10, { steps: 3 });
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up(); await page.waitForTimeout(500);
}
const gone = (page, id) => page.evaluate((id) => !document.getElementById(id), id);
/* ★TITLE-CLAIMS-ROW-MOVE-UNMEASURED-01 (지디 2026-10-22) — 제목의 «종전대로 행 이동»을 «재는» 자. 이름 붙은 행(id 있는 .row)만 순서로 본다
   (갭 id 는 매번 새로 난다). 핀 bb57e3ac 실측 ×3: 갭/칸 위에 놓으면 그 행이 «행째» 섹션 맨 끝(마지막 갭 뒤)으로 간다.
   ⇒ 끌기 자체가 안 일어나면(하네스 mouse.up 지움 — ⑤⒜) 이 줄이 빨강이다 = 무변·부재 단언만으로는 못 재던 칸. */
const namedRows = (page) => page.evaluate(() => [...document.querySelector('#sG .section-inner').children].filter(e => e.classList.contains('row') && e.id).map(e => e.id));
const rowOf = (page, id) => page.evaluate((id) => document.getElementById(id)?.closest('.row')?.id ?? null, id);

test('T1 ★글자 블럭을 칸 아랫부분에 놓으면 칸의 «끝 줄»이 되고 블럭은 사라진다 (색·종류가 따라온다)', async ({ page }) => {
  await setup(page);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);                       // 전제: 놓기 전 칸 줄
  const last = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="1"]');
  await drag(page, '#tT', last.x, last.bottom - 2);
  expect(await cellTexts(page, 1)).toEqual(['다', '라', '끌 글']);
  expect(await gone(page, 'tT')).toBe(true);
  const m = await page.evaluate(() => { const l = document.querySelector('#gG [data-r="0"][data-c="1"][data-line="2"]'); return { color: l.style.color, size: parseFloat(l.style.fontSize) }; });
  expect(m.color).toBe('rgb(200, 0, 0)');
});
test('T2 ★칸 맨 윗부분에 놓으면 «첫 줄 앞»에 들어간다', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3);
  expect(await cellTexts(page, 1)).toEqual(['끌 글', '다', '라']);
});
test('T3 ★⌘Z 한 번이면 블럭이 돌아오고 칸은 원래대로 (이력 한 칸)', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3);
  expect(await gone(page, 'tT')).toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(600);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length)).toBe(1);
});
test('T4 ★먼저 눌러 고른 블럭을 끌어도 같다', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="0"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3, { pick: true });
  expect(await cellTexts(page, 0)).toEqual(['끌 글', '가', '나']);
});
test('T5 지키는 시험 — 칸 «밖»(갭)에 놓으면 종전대로 행 이동, 칸은 그대로', async ({ page }) => {
  await setup(page);
  const gap = await rect(page, '#sG .gap-block:last-child');
  expect(await namedRows(page), '전제: 놓기 전 행 순서').toEqual(['rT', 'rA', 'rG']);
  await drag(page, '#tT', gap.x, gap.y);
  expect(await cellTexts(page, 0)).toEqual(['가', '나']);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await gone(page, 'tT')).toBe(false);
  const ev = await dragLog(page); console.log('T5REC ' + JSON.stringify({ ev, rows: await namedRows(page) }));
  expect(ev.some(([t]) => t === 'dragstart'), '전제: 끌기가 시작되지 않았다(dragstart 0)').toBe(true);
  expect(ev.some(([t]) => t === 'drop'), '전제: 놓기가 일어나지 않았다(drop 0)').toBe(true);
  expect(await rowOf(page, 'tT'), '행 이동 — 블럭은 제 행(rT)째 옮겨진다').toBe('rT');
  expect(await namedRows(page), '행 이동 — rT 가 섹션 맨 끝으로(종전대로)').toEqual(['rA', 'rG', 'rT']);
});
test('T6 지키는 시험 — 에셋 블럭 행은 칸 위에 놓아도 칸이 받지 않는다(종전 행 이동)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { document.getElementById('aA').style.minHeight = '40px'; });
  /* 그리드 행 아래 절반에 놓는다 — 위 절반은 «rG 앞» 자리라 제자리다(T13). 옛 좌표의 «맨 끝»은 표시선이 없던 판의 우연이었다(177). */
  const last = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="1"]');
  expect(await namedRows(page), '전제: 놓기 전 행 순서').toEqual(['rT', 'rA', 'rG']);
  await drag(page, '#aA', last.x, last.bottom - 2);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await gone(page, 'aA')).toBe(false);
  const ev = await dragLog(page); console.log('T6REC ' + JSON.stringify({ ev, rows: await namedRows(page) }));
  expect(ev.some(([t]) => t === 'dragstart'), '전제: 끌기가 시작되지 않았다(dragstart 0)').toBe(true);
  expect(ev.some(([t]) => t === 'drop'), '전제: 놓기가 일어나지 않았다(drop 0)').toBe(true);
  expect(await rowOf(page, 'aA'), '행 이동 — 에셋은 제 행(rA)째 옮겨진다').toBe('rA');
  expect(await namedRows(page), '행 이동 — rA 가 섹션 맨 끝으로(종전대로)').toEqual(['rT', 'rG', 'rA']);
});

/* ★ROW-DROP-ON-GAP-NOOP-01 — 표시선은 rAF 로 늦게 따라온다. 놓는 순간 표시선이 낡았어도 «놓은 좌표»로 들어가야 한다.
   같은 task 에서 dragover·drop 을 쏴 rAF 가 끼어들 틈을 없앤다(T5·T6 의 흔들림을 결정적으로 재는 칸).
   변이: section-drag.js drop 의 _placeIndicator 한 줄을 빼면 T10·T11 빨강 · T12 는 늘 초록. */
const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const fire = (page, types, sel, at) => page.evaluate(([types, sel, at]) => {
  const dataTransfer = window.__dt || (window.__dt = new DataTransfer());
  const box = document.querySelector(sel).getBoundingClientRect();
  const clientX = box.left + box.width / 2, clientY = at === 'top' ? box.top + 1 : box.top + box.height / 2;
  const el = document.elementFromPoint(clientX, clientY) || document.querySelector(sel);
  for (const t of types) (t === 'dragstart' ? document.querySelector(sel) : el).dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, composed: true, clientX, clientY, dataTransfer }));
}, [types, sel, at]);
const LAST_GAP = '#sG .gap-block:last-child';
test('T10 표시선이 위쪽에 낡아 있어도 갭에 놓으면 그 갭 자리로 간다', async ({ page }) => {
  await setup(page);
  await fire(page, ['dragstart'], '#rT'); await raf2(page);
  await fire(page, ['dragover'], '#rA', 'top'); await raf2(page);
  expect(await page.evaluate(() => document.querySelector('#sG .drop-indicator')?.nextElementSibling?.id), '전제: 표시선이 rA 앞에 낡아 있다').toBe('rA');
  await fire(page, ['dragover', 'drop', 'dragend'], LAST_GAP);
  expect(await namedRows(page)).toEqual(['rA', 'rG', 'rT']);
});
test('T11 표시선이 맨 끝에 낡아 있어도 위쪽에 놓으면 끝으로 안 간다', async ({ page }) => {
  await setup(page);
  await fire(page, ['dragstart'], '#rT'); await raf2(page);
  await fire(page, ['dragover'], LAST_GAP); await raf2(page);
  expect(await page.evaluate(() => document.querySelector('#sG .drop-indicator')?.nextElementSibling?.id), '전제: 표시선이 rA 뒤에 낡아 있다').not.toBe('rA');
  await fire(page, ['dragover', 'drop', 'dragend'], '#rA', 'top');
  expect(await namedRows(page)).toEqual(['rT', 'rA', 'rG']);
});
test('T12 [음성] 표시선이 놓는 자리까지 따라온 뒤 놓아도 결과가 같다', async ({ page }) => {
  await setup(page);
  await fire(page, ['dragstart'], '#rT'); await raf2(page);
  await fire(page, ['dragover'], LAST_GAP); await raf2(page);
  await fire(page, ['drop', 'dragend'], LAST_GAP);
  expect(await namedRows(page)).toEqual(['rA', 'rG', 'rT']);
});

test('T13 [음성] 에셋 행을 바로 아래 그리드 위 절반에 놓으면 표시선 자리(rG 앞) 그대로 제자리다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { document.getElementById('aA').style.minHeight = '40px'; });
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#aA', first.x, first.top + first.h * 0.3);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await namedRows(page)).toEqual(['rT', 'rA', 'rG']);
});

/* ── 적대QA 보강(63d653b0 에서 빨강이던 것) ── */
test('T7 ★말풍선 블럭은 칸이 받지 않는다 — 본문이 캔버스에서 사라지지 않는다(63d653b0: «Your name» 한 줄만 남고 본문 0건)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.getElementById('rT').insertAdjacentHTML('afterend',
      '<div class="row" id="rB"><div class="text-block speech-bubble-block" id="tB"><div class="tb-sender-name" style="display:none">Your name</div><div class="tb-bubble">말풍선 본문</div></div></div>');
    window.rebindAll?.();
  });
  await page.waitForTimeout(300);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tB', first.x, first.top + first.h * 0.3);
  expect(await cellTexts(page, 1)).toEqual(['다', '라']);
  expect(await page.evaluate(() => document.getElementById('canvas').innerText.includes('말풍선 본문'))).toBe(true);
});
test('T8 ★놓자마자 «바로» ⌘Z — 줄과 블럭이 둘 다 남지 않는다(줄 3 + 블럭 1 이 되던 것)', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  const s = await rect(page, '#tT');
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 10, s.y + 10, { steps: 3 });
  await page.mouse.move(first.x, first.top + first.h * 0.3, { steps: 12 });
  await page.mouse.up();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');                       // 기다리지 않는다
  const count = () => page.evaluate(() => ({ cell: document.querySelectorAll('#gG [data-r="0"][data-c="1"][data-line]').length, tb: document.querySelectorAll('#canvas .text-block').length }));
  const now = await count();
  await page.waitForTimeout(800);
  expect(now).toEqual({ cell: 2, tb: 1 });
  expect(await count()).toEqual({ cell: 2, tb: 1 });
});
test('T9 ★되돌린 뒤 ⌘⇧Z 로 다시 하면 줄 +1 · 블럭 0 (이력이 «한 칸»)', async ({ page }) => {
  await setup(page);
  const first = await rect(page, '#gG [data-r="0"][data-c="1"][data-line="0"]');
  await drag(page, '#tT', first.x, first.top + first.h * 0.3);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(600);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(600);
  expect(await cellTexts(page, 1)).toEqual(['끌 글', '다', '라']);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .text-block').length)).toBe(0);
});
