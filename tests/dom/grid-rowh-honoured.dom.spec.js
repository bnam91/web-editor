/* grid-rowh-honoured.dom.spec.js — ⑦-A «적은 행 높이 = 실제 높이»(현빈 2026-11-13 · right-panel-unify U1 · ULTRAPLAN §4-2) — ★UI 층만.
 *
 * 설계(지디 평가 H1·M1 뒤 확정): 저장 rows[].height 는 «옛 뜻»(칸 위아래 여백 뺀 몫) 그대로 · 렌더 식(gridTrackMin = H + 2·cellPadY) 무변 ·
 *   패널만 «보이는 높이» = 저장 + 2·cellPadY 를 보이고 받는다(grid-block.js gridRowFullH / gridRowStoredH). 표식·로드 보정 없음.
 *   padY 를 바꾸면 행이 그만큼 커진다(제4안 높이 손잡이 그대로) — 그때도 패널 숫자 = 화면 높이.
 * 양성대조(되돌리면 빨강):
 *   R1/R2 ← prop-grid.js _rowHeightHtml 의 value 를 gridRowFullH(...) 대신 r.height(저장값)로 → 160 ≠ 100 · 숫자 ≠ 화면.
 *   R1b  ← 행 높이 change 의 gridRowStoredH 를 빼면(받은 값을 그대로 저장) → 화면 260 ≠ 적은 200.
 *   R3   ← grid-block.js gridTrackMin 의 `+ 2 * padY` 를 빼면(저장 뜻을 바꾼 옛 U1 판) → 2852c9f44 원문 식과 트랙이 갈려 빨강(padY 30/70).
 *   R4   ← rebindAll 경로에만 무언가를 더하는 로드 보정(옛 gridMigrateRowHeightsV7a)을 되살리면 → 붙여넣기 경로와 rebindAll 경로 높이가 갈려 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const path = require('path');
const { execFileSync } = require('child_process');
/* ★R3 의 자 — 판 2852c9f44(U1 이전 · 플랜 기준판)의 «그» 렌더 식 원문을 git 에서 꺼내 페이지에서 그대로 돌린다(손으로 셈한 상수가 아니다). */
let OLD_SRC;
try { OLD_SRC = execFileSync('git', ['show', '2852c9f44:js/blocks/grid-block.js'], { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (e) { throw new Error(`★R3 의 자(판 2852c9f44)를 못 꺼냈다 — base commit not reachable — shallow clone? (git fetch --unshallow 또는 그 판이 있는 클론에서 돌려라) · ${String(e.stderr || e.message).trim()}`); }
const OLD_FNS = ['export function gridTrackMin(', 'const _gridTrack = (', 'function _gridRowTemplate('].map((head) => {
  const i = OLD_SRC.indexOf(head); if (i < 0) throw new Error('2852c9f44 에서 못 찾음: ' + head);
  const j = OLD_SRC.indexOf('\n}', i) >= 0 && head.startsWith('const') ? OLD_SRC.indexOf(';\n', i) + 1 : OLD_SRC.indexOf('\n}', i) + 2;
  return OLD_SRC.slice(i, j).replace(/^export /, '');
}).join('\n');

async function setup(page) { await page.setViewportSize({ width: 1600, height: 1400 }); return bootApp(page); }
const SEC = '<div class="section-block" id="rS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="rR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>';
const mk = (page, opts) => page.evaluate(([opts, SEC]) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
  c.insertAdjacentHTML('beforeend', SEC);
  const { block: g } = window.makeGridBlock(opts); g.id = 'rG'; document.getElementById('rR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.applyZoom?.(100);
}, [opts, SEC]);
const rowPx = (page, id = 'rG') => page.evaluate((id) => [...document.querySelectorAll(`#${id} > .grd-inner > .grd-cell[data-c="0"]`)].map(c => c.offsetHeight), id);
const stored = (page) => page.evaluate(() => JSON.parse(document.getElementById('rG').dataset.rows).map(r => r.height));
const panelH = (page, ri = 0) => page.inputValue(`.grd-row-h-item[data-ri="${ri}"]`);
const ONE = [{ type: 'body', text: 'a' }];
const showPanel = (page) => page.evaluate(() => window.showGridProperties(document.getElementById('rG'), null));

test('R1 [새 것] 저장 100 + cellPadY 30 → 화면 160 · 패널 숫자 160(= 화면) · 저장은 100 그대로', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: ONE }], rows: [{ height: 100 }, { height: 'auto' }], cellPadY: 30 });
  expect((await rowPx(page))[0], '렌더 = 옛 식 그대로(H + 2·padY)').toBe(160);
  await showPanel(page);
  expect(await panelH(page), '★패널 숫자 = 화면 높이').toBe('160');
  expect(await stored(page), '저장 뜻 무변').toEqual([100, 'auto']);
  expect(errs).toEqual([]);
});

test('R1b [새 것] 패널에 200 을 적으면 화면 200 · 저장 140(= 200 − 2×30) · 되쓴 칸 200', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: ONE }], rows: [{ height: 100 }, { height: 'auto' }], cellPadY: 30 });
  await showPanel(page);
  await page.fill('.grd-row-h-item[data-ri="0"]', '200'); await page.press('.grd-row-h-item[data-ri="0"]', 'Enter');
  await expect.poll(() => rowPx(page).then(r => r[0]), { message: '★적은 값 = 화면 높이' }).toBe(200);
  expect(await stored(page)).toEqual([140, 'auto']);
  expect(await panelH(page)).toBe('200');
  // 숫자·auto 섞음 — auto 행에 180 을 적어도 화면 = 적은 값
  await page.fill('.grd-row-h-item[data-ri="1"]', '180'); await page.press('.grd-row-h-item[data-ri="1"]', 'Enter');
  await expect.poll(() => rowPx(page).then(r => r[1])).toBe(180);
  expect((await rowPx(page))[0], '다른 행 무변').toBe(200);
  // 여백보다 작게 적으면 저장 0(바닥) — 칸 위아래 여백만큼은 물리적으로 남는다
  await page.fill('.grd-row-h-item[data-ri="0"]', '20'); await page.press('.grd-row-h-item[data-ri="0"]', 'Enter');
  expect((await stored(page))[0], '바닥 0').toBe(0);
  expect(errs).toEqual([]);
});

test('R2 [새 것] cellPadY 30 → 50(제4안 손잡이·위아래 여백 칸) — 행이 그만큼 커지고(M2) 패널 숫자 = 화면 높이', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: ONE }], rows: [{ height: 100 }, { height: 'auto' }], cellPadY: 30 });
  expect((await page.evaluate(() => window.updateGridBlock('rG', { cellPadY: 50 }))).ok).toBe(true);
  const h = (await rowPx(page))[0];
  expect(h, '★여백 손잡이가 숫자 행을 키운다(무반응 아님)').toBe(200);
  await showPanel(page);
  expect(await panelH(page), '★패널 숫자 = 화면 높이').toBe(String(h));
  expect(await stored(page), '저장은 손대지 않는다').toEqual([100, 'auto']);
  expect(errs).toEqual([]);
});

test('R3 [회귀 지킴] 옛 뜻 문서 = 판 2852c9f44 렌더 식과 바이트 같은 트랙 — 숫자·auto·0 섞음 × padY 0/30/70 · 표식 없음', async ({ page }) => {
  const errs = await setup(page);
  const CASES = [0, 30, 70].map((padY) => ({ padY, rows: [{ height: 100 }, { height: 'auto' }, { height: 0 }, { height: 340 }] }));
  const out = [];
  for (const k of CASES) {
    await mk(page, { cols: [{ width: 1, lines: ONE }], rows: k.rows, ...(k.padY ? { cellPadY: k.padY } : {}) });
    out.push(await page.evaluate(([OLD_FNS, k]) => {
      const old = new Function(`${OLD_FNS}; return _gridRowTemplate;`)();   // 판 2852c9f44 원문
      const g = document.getElementById('rG');
      return { now: g.querySelector('.grd-inner').style.gridTemplateRows, want: old(k.rows.map(r => ({ height: r.height })), k.padY),
               mark: g.dataset.rowhFull ?? null, rows: JSON.parse(g.dataset.rows).map(r => r.height) };
    }, [OLD_FNS, k]));
  }
  for (const [i, r] of out.entries()) {
    const want = await page.evaluate((t) => { const d = document.createElement('div'); d.style.gridTemplateRows = t; return d.style.gridTemplateRows; }, r.want);   // 같은 직렬화 거쳐 비교
    expect(r.now, `★padY ${CASES[i].padY}: 새 렌더 ≠ 2852c9f44 식`).toBe(want);
    expect(r.rows, '저장값 무변').toEqual([100, 'auto', 0, 340]);
    expect(r.mark, '표식(data-rowh-full) 없음').toBe(null);
  }
  expect(errs).toEqual([]);
});

test('R4 [회귀 지킴] 붙여넣기·템플릿처럼 rebindAll 을 «안» 지나는 넣기 = rebindAll 경로와 같은 높이 · 저장값 무변', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: ONE }], rows: [{ height: 100 }, { height: 'auto' }], cellPadY: 30 });
  const r = await page.evaluate(() => {
    const g = document.getElementById('rG');
    const html = g.outerHTML.replace('id="rG"', 'id="rP"');
    document.getElementById('rR').insertAdjacentHTML('beforeend', html);   // 붙여넣기 문 꼴 — 재렌더만
    const p = document.getElementById('rP'); window.renderGridBlock(p);
    const a = [...p.querySelectorAll(':scope > .grd-inner > .grd-cell[data-c="0"]')].map(c => c.offsetHeight);
    window.rebindAll();                                                      // 로드·⌘Z 문 꼴
    const b = [...document.querySelectorAll('#rP > .grd-inner > .grd-cell[data-c="0"]')].map(c => c.offsetHeight);
    return { a, b, rows: JSON.parse(document.getElementById('rP').dataset.rows).map(x => x.height) };
  });
  expect(r.a, '붙여넣기 경로').toEqual(r.b);
  expect(r.a[0]).toBe(160);
  expect(r.rows, '★어느 문으로도 저장값이 안 바뀐다').toEqual([100, 'auto']);
  expect(errs).toEqual([]);
});
