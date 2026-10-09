/* free-frame-flow-drag.dom.spec.js — B2 (현빈 2026-10-01 「프레임 안 그리드블럭이 자유 드래그로 좌표이동이 안 된다」)
 * 원인: 패널 삽입 공용 경로(insertAfterSelected)가 자유배치 프레임에 «absolute 아닌 .row» 째 넣었고,
 *       드래그 문(block-drag.js)은 position!=='absolute' 이면 빠졌다. 그리드만이 아니라 같은 경로의 컴포넌트 전부.
 * ★양성대조 판 = 7699ea33 → 실측 빨강: F1 F2 F3 F5 · 초록: F0(하네스) F4(지키는 시험).
 * 실제 모듈을 싣고(bindBlock) Playwright «진짜 마우스»로 끈다. ⛔앱 미기동.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./_root-harness.js');

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css"><link rel="stylesheet" href="/css/editor-layout.css"><link rel="stylesheet" href="/css/editor-blocks.css">
<style>body{margin:0} #canvas{position:relative;width:860px}</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">
 <div class="section-block" id="sec1"><div class="section-inner" id="inner1">
  <div class="frame-block" id="fr1" data-free-layout="true" style="position:relative;width:860px;height:600px;">
    <div class="row" id="rowOld" draggable="true"><div class="grid-block" id="grdOld" style="width:400px;height:120px;background:#ccd">그리드</div></div>
  </div>
  <div class="row" id="rowFlow"><div class="grid-block" id="grdFlow" style="width:400px;height:80px;background:#dcd">흐름 그리드</div></div>
 </div></div>
</div></div></div>
<script src="/js/panel-dispatch.js"></script>
<script type="module">
  const errs = [];
  try {
    await import('/js/drag-utils.js');
    await import('/js/block-drag.js');
  } catch (e) { errs.push(String(e)); }
  window.__loadErr = errs;
  window.pushHistory = window.pushHistory || (() => {});
  window.__ready = true;
</script></body></html>`;

const rel = (page, id, ref) => page.evaluate(([id, ref]) => {
  const a = document.getElementById(id).getBoundingClientRect(), b = document.getElementById(ref).getBoundingClientRect();
  return [Math.round(a.left - b.left), Math.round(a.top - b.top)];
}, [id, ref]);

test('F0 하네스 — 실제 모듈이 실린다', async ({ page }) => {
  await boot(page, PAGE);
  expect(await page.evaluate(() => ({ e: window.__loadErr, bind: typeof window.bindBlock, s: typeof window.settleRowInFreeFrame })))
    .toMatchObject({ e: [], bind: 'function' });
});

async function dragBy(page, id, dx, dy) {
  const b = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await page.mouse.move(b[0], b[1]);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b[0] + dx * i / 10, b[1] + dy * i / 10);
  await page.mouse.up();
}

test('F1 ★옛 꼴(프레임 안 흐름 row 의 그리드)을 진짜 마우스로 끌면 좌표가 따라온다', async ({ page }) => {
  await boot(page, PAGE);
  await page.evaluate(() => { const g = document.getElementById('grdOld'); window.bindBlock(g); g.classList.add('selected'); });
  const before = await rel(page, 'grdOld', 'fr1');
  await dragBy(page, 'grdOld', 100, 50);
  const after = await rel(page, 'grdOld', 'fr1');
  expect([after[0] - before[0], after[1] - before[1]], '★프레임 안인데 좌표 이동이 안 된다').toEqual([100, 50]);
});

test('F2 처음 끌 때 «그 자리 그대로» 세운다 — row 째 absolute · draggable 끔 · 첫 틱 점프 없음', async ({ page }) => {
  await boot(page, PAGE);
  await page.evaluate(() => { const g = document.getElementById('grdOld'); window.bindBlock(g); g.classList.add('selected'); });
  const before = await rel(page, 'grdOld', 'fr1');
  await dragBy(page, 'grdOld', 0, 0.4);          // 거의 안 움직임 — 세우기만 일어난다
  const r = await page.evaluate(() => { const row = document.getElementById('rowOld'); return { pos: row.style.position, drag: row.getAttribute('draggable'), parent: row.parentElement.id }; });
  expect(r).toEqual({ pos: 'absolute', drag: 'false', parent: 'fr1' });
  expect(await rel(page, 'grdOld', 'fr1'), '세우면서 자리가 튀면 안 된다').toEqual(before);
});

test('F3 ★패널 삽입 공용 경로 — 자유배치 프레임에 넣으면 처음부터 좌표 단위(row 째 absolute)', async ({ page }) => {
  await boot(page, PAGE);
  const r = await page.evaluate(() => {
    const fr = document.getElementById('fr1');
    document.getElementById('rowOld').remove();
    const a = document.createElement('div'); a.className = 'asset-block'; a.id = 'abAbs';
    a.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:150px;'; fr.appendChild(a);
    const row = document.createElement('div'); row.className = 'row'; row.id = 'rowNew';
    row.innerHTML = '<div class="grid-block" id="grdNew" style="width:300px;height:90px">새 그리드</div>';
    window._activeFrame = fr;
    window.insertAfterSelected(document.getElementById('sec1'), row);
    return { parent: row.parentElement.id, pos: row.style.position, top: row.style.top, drag: row.getAttribute('draggable') };
  });
  expect(r.parent).toBe('fr1');
  expect(r.pos, '★자유배치 프레임에 흐름 row 째 들어갔다').toBe('absolute');
  expect(r.top, '있는 absolute 자식(바닥 150) 밑 +16 — 끌어넣기와 같은 쌓기 규칙').toBe('166px');
  expect(r.drag).toBe('false');
});

test('F4 프레임 «밖» 흐름 그리드는 그대로 흐름(세우지 않는다)', async ({ page }) => {
  await boot(page, PAGE);
  await page.evaluate(() => { const g = document.getElementById('grdFlow'); window.bindBlock(g); g.classList.add('selected'); });
  await dragBy(page, 'grdFlow', 30, 0);
  expect(await page.evaluate(() => document.getElementById('rowFlow').style.position)).toBe('');
});

test('F5 세운 뒤 두 번째 끌기도 같은 거리만큼 — 매번 다시 세우지 않는다', async ({ page }) => {
  await boot(page, PAGE);
  await page.evaluate(() => { const g = document.getElementById('grdOld'); window.bindBlock(g); g.classList.add('selected'); });
  await dragBy(page, 'grdOld', 40, 0);
  const mid = await rel(page, 'grdOld', 'fr1');
  await dragBy(page, 'grdOld', 0, 60);
  const end = await rel(page, 'grdOld', 'fr1');
  expect([end[0] - mid[0], end[1] - mid[1]]).toEqual([0, 60]);
});

/* ── F6·F7 — «폭 100%» 픽스처 (F3 재발 건, 2026-10-03 · TASK-20261003-goditor-32 F3) ─────────────────────
 * ★위 F1~F5 가 초록이었던 것은 픽스처 그리드가 «400px» 였기 때문이다 — 한 환경에서만 참.
 *   실물 그리드는 renderGridBlock 이 100% 로 그려 «안의 내용» 폭 = 프레임 폭 → settleRowInFreeFrame 이 그 폭으로 세우고
 *   T-088 클램프 x 범위가 [0,0] 이 된다(Evaluator 36cbe872 실측: 602f57ed^ 100 → 49c74728·36cbe872 0).
 * ★그래서 여기 픽스처는 «진짜» 그리드 모듈을 싣는다(grid-block.js) — 폭 모델·렌더가 실물과 같다.
 * 양성대조: bf9161d0 에서 F6 빨강(Δx 0) · F7 초록(지키는 시험 — 400px 꼴은 옛 판도 정상). */
const PAGE_GRID = PAGE.replace(
  "await import('/js/block-drag.js');",
  "await import('/js/block-drag.js');\n    await import('/js/blocks/grid-block.js');",
).replace(
  '<div class="row" id="rowOld" draggable="true"><div class="grid-block" id="grdOld" style="width:400px;height:120px;background:#ccd">그리드</div></div>',
  '<div class="row" id="rowOld" draggable="true"><div class="grid-block" id="grdOld" data-type="grid" style="background:#ccd"></div></div>',
);

test('F6 ★폭 100% 그리드(실물 렌더)도 처음 끌 때 좌우로 움직인다 ＋ ★울타리는 «자르는 프레임일 때만»', async ({ page }) => {
  await boot(page, PAGE_GRID);
  expect(PAGE_GRID.includes('grid-block.js') && !PAGE_GRID.includes('width:400px;height:120px'), '전제 — 픽스처 치환이 «먹었다»').toBe(true);
  const pre = await page.evaluate(() => {
    const g = document.getElementById('grdOld'); window.renderGridBlock(g); window.bindBlock(g); g.classList.add('selected');
    return { w: g.offsetWidth, fw: document.getElementById('fr1').clientWidth, err: window.__loadErr };
  });
  expect(pre, '전제 — 실물 렌더 그리드는 프레임 폭 그대로(=옛 꼴의 병)').toEqual({ w: 860, fw: 860, err: [] });
  const before = await rel(page, 'grdOld', 'fr1');
  await dragBy(page, 'grdOld', 100, 50);
  const after = await rel(page, 'grdOld', 'fr1');
  expect(after[1] - before[1], '전제 — 끌기가 먹었다(세로)').toBe(50);
  expect(after[0] - before[0], '★폭 100% 그리드가 수직으로만 움직였다').toBeGreaterThan(0);
  await dragBy(page, 'grdOld', 400, 0);
  const box = await page.evaluate(() => { const r = document.getElementById('rowOld'), f = document.getElementById('fr1');
    return { l: parseInt(r.style.left, 10), w: r.offsetWidth, fw: f.offsetWidth, p: r.parentElement.id,
             clips: f.dataset.clipContent === 'true' || !!(f.dataset.radius && f.dataset.radius !== '0'),
             ov: getComputedStyle(f).overflow }; });
  expect(box.p, '전제 — 끌어내기 안 났다').toBe('fr1');
  /* ══ ★울타리 — ★★«자르는 프레임일 때만» (2026-10-09 · 현빈 t1-① · 지디 판정 ㉮) ══════
     ⚰️★옛 단언(T-088 · 2026-09-22): ★★`box.l + box.w <= box.fw` ★조건 ★없이.
        ★글: 「프레임 오른쪽 밖으로 나갔다(T-088)」 · ★그때 센 수(2026-10-09 실측) ★`fw 860` · ★받은 값 ★`1188`.
     ⚰️★그 까닭 「`.frame-block` 은 ★overflow:hidden」은 ★★2026-09-28 ★현빈 지시로 ★죽었다(기본 `visible`).
     ⇒ ★단언을 ★지우지 ★않고 ★★«조건»을 ★더한다 — ★양쪽을 ★다 적는다(지디 ㉠). */
  expect(box.ov, '★전제: 이 프레임의 computed overflow 를 못 읽었다').toBeTruthy();
  if (box.clips) {
    expect(box.l + box.w, `★자르는 프레임인데 ★프레임 오른쪽 밖으로 나갔다 (오른끝 ${box.l + box.w} · fw ${box.fw})`)
      .toBeLessThanOrEqual(box.fw);
  } else {
    expect(box.l + box.w, `★★안 자르는 프레임인데 ★오른쪽 끝에 ★물렸다 — ★죔이 ★또 ★전부를 가둔다`
      + ` (오른끝 ${box.l + box.w} · fw ${box.fw} · overflow ${box.ov})`).toBeGreaterThan(box.fw);
  }
});

/* ★★위 F6 의 ★★«자르는 프레임» 갈래를 ★실제로 ★돌리는 칸 — ⛔안 두면 ★적었지만 ★안 잰 조건이 된다.
   ★F6 과 ★한 글자도 안 다르다. ★★「내용 자르기」만 ★켠다. */
test('F6c ★★「내용 자르기」 켠 프레임 — ★같은 끌기인데 ★울타리가 ★선다 (F6 과 ★토글만 다르다)', async ({ page }) => {
  await boot(page, PAGE_GRID);
  await page.evaluate(() => {
    document.getElementById('fr1').dataset.clipContent = 'true';   /* ★이 한 줄만 ★F6 과 다르다 */
    const g = document.getElementById('grdOld'); window.renderGridBlock(g); window.bindBlock(g); g.classList.add('selected');
  });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('fr1')).overflow),
    '★전제: 토글을 켰는데 computed overflow 가 ★hidden 이 아니다 — CSS 가 바뀌었다').toBe('hidden');
  await dragBy(page, 'grdOld', 100, 50);
  await dragBy(page, 'grdOld', 400, 0);
  const box = await page.evaluate(() => { const r = document.getElementById('rowOld'); return { l: parseInt(r.style.left, 10), w: r.offsetWidth, fw: document.getElementById('fr1').offsetWidth, p: r.parentElement.id }; });
  expect(box.p, '전제 — 끌어내기 안 났다').toBe('fr1');
  expect(box.l + box.w, `★자르는 프레임인데 ★밖으로 나갔다 (오른끝 ${box.l + box.w} · fw ${box.fw})`).toBeLessThanOrEqual(box.fw);
});

test('F7 지키는 시험 — 같은 실물 모듈 판에서 400px 꼴은 Δx 100 그대로(F6 과 «폭»만 다르다)', async ({ page }) => {
  await boot(page, PAGE_GRID);
  await page.evaluate(() => {
    const g = document.getElementById('grdOld'); window.renderGridBlock(g);
    document.getElementById('rowOld').style.width = '400px';   // ⛔모델 키를 안 쓴다 — 옛 판에도 같은 꼴
    window.bindBlock(g); g.classList.add('selected');
  });
  expect(await page.evaluate(() => document.getElementById('grdOld').offsetWidth), '전제 — 400').toBe(400);
  const before = await rel(page, 'grdOld', 'fr1');
  await dragBy(page, 'grdOld', 100, 50);
  const after = await rel(page, 'grdOld', 'fr1');
  expect([after[0] - before[0], after[1] - before[1]]).toEqual([100, 50]);
});
