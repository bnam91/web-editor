/* grid-nested-ratio.dom.spec.js — ★S11 «중첩 줄 안 두 칸»의 비율을 ★마우스로.
 *   현빈 2026-10-07: 「우클릭 후 ★나란히 두칸으로 나누기를 통해서 추가되는 줄 ★간에 ★칸 비율 ★마우스로 조절」
 *   확답 ① 「줄 간에」 = ★그 줄 «안» 두 칸 사이 · ② ★줄마다 ★따로 · ③ ★마우스 «하나»(⛔패널 숫자칸 없음)
 *
 * ★머리표 — [새 것] 핀 `4b36eb56` 에서 ★빨강 · [회귀 지킴] 거기서도 ★초록 · [전제] 재기 위한 조건.
 *   ★양성대조: GD1001_ROOT=/tmp/t12-pinroot npx playwright test --config=tests/dom/playwright.dom.config.js \
 *                tests/dom/grid-nested-ratio.dom.spec.js
 *
 * ★★자 셋을 머리말에 못박는다(전부 ★이 레인이 ★틀려서 얻은 것):
 *  ㉠ ★높이·폭은 ★layout px 또는 ★«가중치»로 재라. ⛔`getBoundingClientRect` 로 ★판정하지 마라 —
 *     `#canvas-scaler` 가 `matrix(0.4)` 를 건다(zoom 은 100 인데도).
 *  ㉡ ★«닿나»는 ★`elementFromPoint` 로 재라 — 「선택이 안 된다」가 규칙이 아니라 ★«면적»인 꼴이 오늘만 둘이다.
 *  ㉢ ★undo 뒤에는 ★노드를 ★다시 찾아라(캔버스 DOM 이 통째로 바뀌어 쥔 노드가 detached 된다).
 *
 * ⛔이 스펙이 ★안 재는 축(이름으로): 중첩 ★2단계 깊이의 비율 · 중첩 안 ★행 · 터치/펜 입력 ·
 *   실앱(Electron) 저장·불러오기 왕복 · HTML/Figma 내보내기에서의 중첩 비율. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SCENE = '<div class="section-block" id="cS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="cI"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="cR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>';

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((S) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', S);
  }, SCENE);
  return errs;
}

/** 그리드 하나 + 칸(0,0)에 중첩 줄 nDuo 개. ★줄은 «우클릭 메뉴가 쓰는 같은 문»(grdAddLine)으로 넣는다. */
async function setup(page, { nDuo = 1, nCols = 2, outerCols = 1 } = {}) {
  return page.evaluate(([nDuo, nCols, outerCols]) => {
    const cols = Array.from({ length: outerCols }, () => ({ width: 1, lines: [{ type: 'body', text: 'base' }] }));
    const { block: g } = window.makeGridBlock({ cols });
    g.id = 'cG'; document.getElementById('cR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g);
    g.classList.add('selected');
    const made = [];
    for (let k = 0; k < nDuo; k++) {
      const res = window.grdAddLine(g, { r: 0, c: 0 }, null, {
        type: 'duo', gap: 8,
        cols: Array.from({ length: nCols }, (_, i) => ({ width: 1, lines: [{ type: 'body', text: `d${k}c${i}` }] })),
      });
      made.push(res);
    }
    window.showGridProperties?.(g);
    const model = window.getGridModel(g);
    return {
      made,
      // ★전제 — 우클릭 «나란히 두 칸으로 나누기» 항목이 제품에 ★실재한다(이 검사가 가짜 길을 쓰지 않는다)
      menuItemExists: !!document.getElementById('bcm-grid-nested'),
      lines: model.cells[0][0].lines.map(l => ({ type: l.type, widths: (l.cols || []).map(c => c.width) })),
    };
  }, [nDuo, nCols, outerCols]);
}

const gutters = (page) => page.evaluate(() => {
  const q = (ax) => [...document.querySelectorAll(`.grd-gutter[data-axis="${ax}"]`)];
  return {
    col: q('col').length, row: q('row').length,
    ncol: q('ncol').map(g => ({ r: +g.dataset.r, c: +g.dataset.c, li: +g.dataset.li, i: +g.dataset.i,
                                cx: g.getBoundingClientRect().left + g.getBoundingClientRect().width / 2,
                                cy: g.getBoundingClientRect().top + g.getBoundingClientRect().height / 2 })),
  };
});
const widthsOf = (page) => page.evaluate(() =>
  window.getGridModel(document.getElementById('cG')).cells[0][0].lines
    .map(l => (l.cols || []).map(c => Number(c.width))));

/* ═══ S1 [전제] + ④ 거터 ★개수 ═══ */
test('S1 nested gutters = (cols-1) per duo line, and the OUTER gutter count does not grow', async ({ page }) => {
  const errs = await scene(page);
  const s = await setup(page, { nDuo: 2, nCols: 2, outerCols: 1 });
  expect(s.menuItemExists, '[전제] 우클릭 「나란히 두 칸」 항목이 제품에 없다').toBe(true);
  expect(s.made.every(m => m.ok), `[전제] 중첩 줄 생성 실패 ${JSON.stringify(s.made)}`).toBe(true);
  expect(s.lines.filter(l => l.type === 'duo').length, '[전제] duo 줄 2개').toBe(2);

  const g = await gutters(page);
  console.log('### S1 ' + JSON.stringify({ s, g }));
  // ★주단언 — duo 2줄 × (2열−1) = 2개
  expect(g.ncol.length, `중첩 거터 수 ${JSON.stringify(g)}`).toBe(2);
  // ★바깥 1열이라 바깥 거터는 0 — ⛔내 변경이 남의 거터를 더 만들지 않는다
  expect(g.col, '★바깥 열 거터가 늘었다').toBe(0);
  expect(g.row, '★바깥 행 거터가 늘었다').toBe(0);
  // 3열짜리 duo 면 2개
  await page.evaluate(() => { document.getElementById('cG')?.remove(); });
  const s3 = await setup(page, { nDuo: 1, nCols: 3, outerCols: 1 });
  expect(s3.made[0].ok).toBe(true);
  const g3 = await gutters(page);
  console.log('### S1b ' + JSON.stringify(g3));
  expect(g3.ncol.length, '3열 duo → 거터 2개').toBe(2);
  expect(errs).toEqual([]);
});

/* ═══ S2 ② ★면적 — ⛔rect 로 판정하지 마라. elementFromPoint 로, ★배율 둘에서 ═══ */
test('S2 the gutter is actually HITTABLE at two different canvas scales (elementFromPoint)', async ({ page }) => {
  const errs = await scene(page);
  await setup(page, { nDuo: 1, nCols: 2, outerCols: 1 });
  const probe = () => page.evaluate(() => {
    window.showGridProperties?.(document.getElementById('cG'));
    const g = document.querySelector('.grd-gutter[data-axis="ncol"]');
    if (!g) return { gone: true };
    const r = g.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const sc = document.getElementById('canvas-scaler') || document.getElementById('canvas');
    const m = new DOMMatrixReadOnly(getComputedStyle(sc).transform);
    return {
      scale: Math.round((m.a || 1) * 1000) / 1000,
      screenW: Math.round(r.width * 100) / 100,          // ★스크린 폭 — 배율을 타면 줄어든다
      hitIsGutter: !!(hit && hit.classList && hit.classList.contains('grd-gutter')),
      /* ★가장자리 — CSS 폭 8px 의 안쪽 끝(±3px). 폭이 쪼그라들면 여기가 먼저 샌다. */
      edgeHit: (() => {
        const L = document.elementFromPoint(cx - 3, cy), R = document.elementFromPoint(cx + 3, cy);
        const ok = (e) => !!(e && e.classList && e.classList.contains('grd-gutter'));
        return ok(L) && ok(R);
      })(),
      hitAxis: hit && hit.dataset ? hit.dataset.axis : null,
      hitCls: hit ? hit.className : null,
    };
  });
  const a = await probe();
  // 배율을 바꾼다(캔버스 내용을 늘려 fit 배율이 달라지게)
  await page.evaluate(() => {
    document.getElementById('cI').insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" style="height:2600px"></div>');
    window.rebindAll?.();
  });
  await page.waitForTimeout(250);
  const b = await probe();
  console.log('### S2 ' + JSON.stringify({ a, b }));
  // ★전제 — 두 판의 배율이 ★실제로 다르다(아니면 아래 「배율 둘」이 거짓말이다)
  expect(a.scale, `[전제] 배율이 안 갈렸다 a=${a.scale} b=${b.scale}`).not.toBe(b.scale);
  // ★주단언 — 두 배율 ★모두에서 ★가운데가 거터에 닿는다
  expect(a.hitIsGutter, `배율 ${a.scale} 에서 안 닿는다: ${JSON.stringify(a)}`).toBe(true);
  expect(b.hitIsGutter, `배율 ${b.scale} 에서 안 닿는다: ${JSON.stringify(b)}`).toBe(true);
  expect(a.hitAxis).toBe('ncol');
  expect(b.hitAxis).toBe('ncol');
  /* ★★스크린 폭은 ★«절대 기준»으로 잰다 — ⛔`b === a` 로 재지 마라.
     ★2026-10-07 실측: 처음엔 `expect(b.screenW).toBe(a.screenW)` 라 적었는데, 폭을 배율에 타게
     만드는 ★변이를 넣어도 ★초록이었다(둘 다 3.19 로 «같이» 틀려서 통과). ★항등식이었다.
     ⇒ ★거터는 `position:fixed` 오버레이에 스크린 좌표로 앉으므로 ★CSS 폭 8px 이 ★그대로여야 한다.
       그것이 `.hlb-handle` 이 `--inv-zoom` 을 안 타서 4.8px 로 쪼그라든 그 함정의 ★반대편이다. */
  const CSS_W = 8;
  expect(a.screenW, `★배율 ${a.scale} 에서 거터 폭이 ${a.screenW}px — 8px 이어야 한다(배율을 탔다)`).toBe(CSS_W);
  expect(b.screenW, `★배율 ${b.scale} 에서 거터 폭이 ${b.screenW}px — 8px 이어야 한다(배율을 탔다)`).toBe(CSS_W);
  // ★그리고 ★가장자리»도 닿아야 한다 — 가운데만 재면 «쪼그라든 면적»을 못 본다
  expect(a.edgeHit, `★배율 ${a.scale} 에서 가장자리가 안 닿는다 ${JSON.stringify(a)}`).toBe(true);
  expect(b.edgeHit, `★배율 ${b.scale} 에서 가장자리가 안 닿는다 ${JSON.stringify(b)}`).toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ S3 ③ ★줄마다 ★따로 (현빈 ⒜ 의 본 단언) ＋ ① 합 보존 ＋ ⑤ patchCell 경유 ═══ */
test('S3 dragging ONE duo line changes only THAT line; sum preserved; write goes through patchCell', async ({ page }) => {
  const errs = await scene(page);
  await setup(page, { nDuo: 2, nCols: 2, outerCols: 1 });

  // ★⑤ 쓰는 문에 탐침 — 진짜 문을 감싼다(⛔소스 읽기로 닫지 않는다)
  await page.evaluate(() => {
    window.__calls = [];
    /* ★감싸는 자리를 ★`updateGridBlockRaw` 로 — 제품이 그 문을 쓰기 때문이다.
       ⛔`updateGridBlock` 을 감싸면 ★0건이 나오고 그 0건을 「안 썼다」로 ★오독한다. */
    const orig = window.updateGridBlockRaw;
    window.updateGridBlockRaw = function (id, partial, opts) {
      window.__calls.push({
        keys: Object.keys(partial || {}),
        patchCellKeys: partial && partial.patchCell ? Object.keys(partial.patchCell) : null,
        noHistory: !!(opts && opts.noHistory), keepPanel: !!(opts && opts.keepPanel),
      });
      return orig.apply(this, arguments);
    };
    window.__origUpdate = orig;
  });

  const before = await widthsOf(page);
  const g = await gutters(page);
  expect(g.ncol.length, '[전제] 거터 2개').toBe(2);
  const target = g.ncol.find(x => x.li === 0) || g.ncol[0];

  // ★진짜 마우스로 끈다
  await page.mouse.move(target.cx, target.cy);
  await page.mouse.down();
  await page.mouse.move(target.cx + 60, target.cy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const after = await widthsOf(page);
  const calls = await page.evaluate(() => window.__calls);
  console.log('### S3 before=' + JSON.stringify(before) + ' after=' + JSON.stringify(after)
    + ' calls=' + JSON.stringify(calls.slice(0, 3)) + ' n=' + calls.length);

  const duoIdx = before.map((w, i) => (w.length === 2 ? i : -1)).filter(i => i >= 0);
  expect(duoIdx.length, '[전제] duo 줄 둘').toBe(2);
  const [A, B] = duoIdx;
  const draggedIdx = target.li, otherIdx = duoIdx.find(i => i !== target.li);

  // ★주단언 ㉠ — 끈 줄은 ★바뀐다
  expect(after[draggedIdx], `★끈 줄이 안 바뀌었다 ${JSON.stringify({ before, after, target })}`).not.toEqual(before[draggedIdx]);
  // ★주단언 ㉡ — ★다른 줄은 ★그대로 (현빈 ⒜ 「줄마다 따로」)
  expect(after[otherIdx], `★★다른 줄까지 바뀌었다 — 「줄마다 따로」가 깨졌다`).toEqual(before[otherIdx]);
  // ★① 합 보존 — 바깥 열과 같은 순수함수를 쓰는지 «결과»로 잰다
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  expect(Math.round(sum(after[draggedIdx]) * 1000) / 1000,
    `★합이 안 지켜졌다 ${sum(before[draggedIdx])} → ${sum(after[draggedIdx])}`).toBe(Math.round(sum(before[draggedIdx]) * 1000) / 1000);
  // ★⑤ patchCell 경유 — dataset 직접 쓰기가 아니다
  const pc = calls.filter(c => c.patchCellKeys && c.patchCellKeys.includes('cols') && c.patchCellKeys.includes('lineIndex'));
  expect(pc.length, `★patchCell{lineIndex,cols} 로 안 썼다 — calls=${JSON.stringify(calls)}`).toBeGreaterThan(0);
  expect(pc.every(c => c.noHistory), '★드래그 중 호출이 이력을 쌓고 있다').toBe(true);
  expect(pc.every(c => c.keepPanel), '★keepPanel 이 없다 — 패널이 매 move 다시 서면 거터가 사라진다').toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ S3b ★음성대조 — ★안 끌면 ★둘 다 그대로 ═══ */
test('S3b negative control — without a drag, NOTHING changes', async ({ page }) => {
  const errs = await scene(page);
  await setup(page, { nDuo: 2, nCols: 2, outerCols: 1 });
  const before = await widthsOf(page);
  const g = await gutters(page);
  const t = g.ncol[0];
  // 누르기만 하고 ★안 끈다 — 그리고 떼기
  await page.mouse.move(t.cx, t.cy);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await widthsOf(page);
  console.log('### S3b ' + JSON.stringify({ before, after }));
  expect(after, '★안 끌었는데 비율이 바뀌었다').toEqual(before);
  expect(errs).toEqual([]);
});

/* ═══ S4 ★undo — ★«한 제스처 = 한 걸음»을 ★행위로 재라 ═══
 *  ⛔`historyPos` 증가를 자로 쓰지 ★않는다 — 이 레포가 ★스스로 그렇게 정해 뒀다
 *    (`grid-row0-save-undo:309` 「historyPos 가 줄었는지는 안 본다 — 아무것도 안 그려도 그건 참이 된다」,
 *     `block-factory:465` 「undo 첫머리의 ensureHistoryCheckpoint 가 매번 한 칸을 쌓았다가 곧바로 pos--」).
 *    ★덧붙여 `pushHistory` 는 «무변화 중복»을 차단하므로 ★증가가 0 일 수 있고 그래도 맞다.
 *    ★실측(2026-10-07): 중첩 드래그 0칸 · 바깥 거터 2칸 — ★출발 스택이 달라 ★견줄 수 없었다.
 *  ⇒ ★★대신 ★이렇게 잰다: ⌘Z ★한 번에 ★원래 비율로 돌아오고, ⌘Z ★두 번째는 ★«중간 비율»이
 *    ★나오면 안 된다(나오면 그 드래그가 ★여러 칸을 먹었다는 뜻이다 — ★고치기 전 판이 ★10칸이었다).
 *  ★㉢ undo 뒤에는 ★노드를 ★다시 찾는다(캔버스 DOM 이 통째로 바뀐다). */
test('S4 one drag = ONE undo step — a second ⌘Z must not reveal an intermediate ratio', async ({ page }) => {
  const errs = await scene(page);
  await setup(page, { nDuo: 1, nCols: 2, outerCols: 1 });
  const before = await widthsOf(page);
  const g = await gutters(page);
  const t = g.ncol[0];
  await page.mouse.move(t.cx, t.cy);
  await page.mouse.down();
  await page.mouse.move(t.cx + 70, t.cy, { steps: 10 });   // ★여러 mousemove — 칸이 새면 여기서 샌다
  await page.mouse.up();
  await page.waitForTimeout(200);
  const dragged = await widthsOf(page);

  const read = () => page.evaluate(() => {
    const q = document.getElementById('cG');   // ★매번 다시 찾는다(⛔쥔 노드 금지)
    if (!q) return null;
    const ls = window.getGridModel(q).cells?.[0]?.[0]?.lines;
    return Array.isArray(ls) ? ls.map(l => (l.cols || []).map(c => Number(c.width))) : null;
  });
  await page.evaluate(() => window.undo());
  const u1 = await read();
  await page.evaluate(() => window.undo());
  const u2 = await read();
  console.log('### S4 ' + JSON.stringify({ before, dragged, u1, u2 }));

  expect(dragged, '[전제] 끌어서 실제로 바뀌어야 한다').not.toEqual(before);
  // ★주단언 ㉠ — ⌘Z ★한 번에 ★원래 비율
  expect(u1, '★⌘Z 한 번에 비율이 안 돌아왔다').toEqual(before);
  /* ★주단언 ㉡ — ⌘Z ★두 번째가 ★«끌던 중간 비율»이면 ★그 드래그가 ★여러 칸을 먹은 것이다.
     ★중간 비율의 꼴: 두 값이 1:1 이 아니면서 끝값(dragged)도 아닌 것. */
  const duo1 = (u1 || []).find(w => w.length === 2);
  const duo2 = (u2 || []).find(w => w.length === 2);
  if (duo2) {
    const isIntermediate = duo2[0] !== duo1[0] && JSON.stringify(duo2) !== JSON.stringify(dragged.find(w => w.length === 2));
    expect(isIntermediate, `★★두 번째 ⌘Z 가 «중간 비율» ${JSON.stringify(duo2)} 을 냈다 — 드래그가 여러 칸을 먹었다`).toBe(false);
  }
  expect(errs).toEqual([]);
});

/* ═══ S5 [회귀 지킴] 중첩이 ★없으면 ncol 거터 0 · 바깥 거터는 ★그대로 ═══ */
test('S5 [회귀 지킴] a grid with no nested line gets ZERO ncol gutters and the usual outer ones', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => {
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }],
      rows: [{ height: 'auto' }, { height: 'auto' }],
      cells: [[{}, {}], [{ lines: [{ type: 'body', text: 'c' }] }, { lines: [{ type: 'body', text: 'd' }] }]],
    });
    g.id = 'cG'; document.getElementById('cR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); g.classList.add('selected');
    window.showGridProperties?.(g);
  });
  const g = await gutters(page);
  console.log('### S5 ' + JSON.stringify(g));
  expect(g.ncol.length, '★중첩이 없는데 ncol 거터가 생겼다').toBe(0);
  expect(g.col, '★바깥 열 거터 1개(2열)').toBe(1);
  expect(g.row, '★바깥 행 거터 1개(2행)').toBe(1);
  expect(errs).toEqual([]);
});
