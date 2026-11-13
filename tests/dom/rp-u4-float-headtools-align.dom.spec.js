/* rp-u4-float-headtools-align — U4(right-panel-unify) 플로팅 토글이 «틀 절 머리 손잡이(headTools)»가 된 뒤에도 세로 정렬 0.00.
 * 대상 = 플로팅 토글을 단 미디어/도형 패널 넷: icon-circle(Position 머리) · icon(Position 머리) · shape(Position 머리) · asset(Position 머리 · 몸통 빈 절).
 * 자 = prop-title-row-align.dom.spec.js 와 같은 «글자» 자: |토글 상자 세로중심 − 제목 글자 줄상자(Range) 세로중심| ≤ 0.5px.
 *   (⛔제목 «상자»로 재면 비대칭 padding 에도 0.00 이 나와 항등식이 된다 — 그 파일 D0b 참조)
 * ★내장 양성대조 P: 같은 머리에 비대칭 padding(8px 0 2px)을 인라인으로 심으면 이 자가 > 0.5 를 낸다 — 자가 살아 있다.
 * 바깥 양성대조: css/editor-props.css `.prop-section-title-row > .prop-section-title` 의 padding 을 `8px 0 4px` 로 되돌리면 A1 빨강.
 * ⛔화면 px 를 상수와 견주지 않는다 — 사각형끼리만 비교한다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { rosterOf, addKind } = require('./_block-roster-294.js');

const TOL = 0.5;
const KINDS = [
  { cls: 'icon-circle-block', toggle: 'icb-float-toggle', sec: 'position' },
  { cls: 'icon-block', toggle: 'icn-float-toggle', sec: 'position', entry: 'addIconifyBlock' },   // 로스터 추론 이름(addIconBlock)과 실물이 다르다
  { cls: 'shape-block', toggle: 'shape-overlay-toggle', sec: 'position' },
  { cls: 'asset-block', toggle: 'asset-float-toggle', sec: 'position' },   // 비플로팅이면 Position 몸통이 비어도 머리(토글)로 남는다(U0b)
];

/** 토글이 든 절 머리 줄 하나를 잰다. */
const readToggleRow = (page, toggleId) => page.evaluate((tid) => {
  const f = (v) => Math.round(v * 100) / 100;
  const tg = document.getElementById(tid);
  const row = tg?.closest('.prop-sec-head');
  const title = row?.querySelector(':scope > .prop-section-title');
  if (!tg || !row || !title || tg.parentElement !== row) return { found: false, inHead: !!row };
  const rg = document.createRange(); rg.selectNodeContents(title.querySelector('.prop-sec-title-text') || title);
  const g = rg.getBoundingClientRect(), cb = tg.getBoundingClientRect();
  return { found: true, sec: row.closest('.prop-section[data-sec]')?.dataset.sec || null, dGlyph: f((cb.top + cb.height / 2) - (g.top + g.height / 2)) };
}, toggleId);

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  return errs;
}

test('A1 플로팅 토글(headTools) — 넷 다 절 머리 안에 있고 |토글중심 − 제목글자중심| ≤ 0.5px', async ({ page }) => {
  const errs = await scene(page);
  const roster = await rosterOf(page);
  const out = [];
  for (const k of KINDS) {
    const kind = k.entry ? { cls: k.cls, entry: k.entry } : roster.find((r) => r.cls === k.cls);
    expect(kind?.entry, `[전제] ${k.cls} 입구`).toBeTruthy();
    const r = await addKind(page, kind);
    expect(r.err, `[전제] ${k.cls} 넣기`).toBeUndefined();
    await page.evaluate((id) => window.selectBlock(id), r.id);
    await expect(page.locator(`#${k.toggle}`), `[전제] ${k.cls} 패널에 토글`).toBeAttached();
    let m = null;
    await expect.poll(async () => { const a = await readToggleRow(page, k.toggle); const b = await readToggleRow(page, k.toggle); m = a; return JSON.stringify(a) === JSON.stringify(b) && a.found; }, `${k.cls} 두 번 읽어 같다`).toBe(true);
    out.push({ cls: k.cls, ...m });
    expect(m.sec, `${k.cls} 토글이 «${k.sec}» 절 머리에 있지 않다`).toBe(k.sec);
  }
  console.log('[A1] ' + JSON.stringify(out));
  const bad = out.filter((o) => Math.abs(o.dGlyph) > TOL);
  expect(bad, `어긋난 머리 ${bad.length}/${out.length} — 잰 값 ${JSON.stringify(out.map((o) => o.cls + '=' + o.dGlyph))}`).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A2 플로팅 «켠» 상태 — 토글을 누른 뒤(패널 다시 그림 · X/Y 줄 생김)에도 같은 머리 · |Δ| ≤ 0.5px', async ({ page }) => {
  const errs = await scene(page);
  const roster = await rosterOf(page);
  const out = [];
  for (const k of KINDS) {
    const kind = k.entry ? { cls: k.cls, entry: k.entry } : roster.find((r) => r.cls === k.cls);
    const r = await addKind(page, kind);
    expect(r.err, `[전제] ${k.cls} 넣기`).toBeUndefined();
    await page.evaluate((id) => window.selectBlock(id), r.id);
    await page.locator(`#${k.toggle}`).click();
    await expect(page.locator(`#${k.toggle}`), `[전제] ${k.cls} 플로팅 켜짐`).toHaveAttribute('aria-pressed', 'true');
    let m = null;
    await expect.poll(async () => { const a = await readToggleRow(page, k.toggle); const b = await readToggleRow(page, k.toggle); m = a; return JSON.stringify(a) === JSON.stringify(b) && a.found; }, `${k.cls} 두 번 읽어 같다`).toBe(true);
    out.push({ cls: k.cls, ...m });
    expect(m.sec, `${k.cls} 플로팅 뒤 토글이 Position 머리에 있지 않다`).toBe('position');
  }
  console.log('[A2] ' + JSON.stringify(out));
  expect(out.filter((o) => Math.abs(o.dGlyph) > TOL).map((o) => o.cls + '=' + o.dGlyph), '어긋난 머리(플로팅)').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P ★양성대조 — 머리 제목에 비대칭 padding 을 심으면 같은 자가 > 0.5px 를 낸다', async ({ page }) => {
  await scene(page);
  const roster = await rosterOf(page);
  const r = await addKind(page, roster.find((x) => x.cls === 'shape-block'));
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#shape-overlay-toggle')).toBeAttached();
  const before = await readToggleRow(page, 'shape-overlay-toggle');
  expect(Math.abs(before.dGlyph), '[전제] 고친 판은 0 근처').toBeLessThanOrEqual(TOL);
  await page.evaluate(() => { document.getElementById('shape-overlay-toggle').closest('.prop-sec-head').querySelector(':scope > .prop-section-title').style.padding = '8px 0 2px'; });
  const after = await readToggleRow(page, 'shape-overlay-toggle');
  expect(Math.abs(after.dGlyph), `★자가 비대칭을 못 본다(잰 값 ${after.dGlyph})`).toBeGreaterThan(TOL);
});
