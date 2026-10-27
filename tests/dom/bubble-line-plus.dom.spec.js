/* bubble-line-plus.dom.spec.js — 1012t1M1 말풍선 캔버스 ＋ «줄 추가» (S4 유닛 M · 2026-10-12)
 *
 * ★현빈: 「말풍선 줄 추가가 그리드만큼 쾌적하지 않다」.
 * ★재현(9436 · zoom 100 · 진짜 클릭/키):
 *   그리드  = 넣기 → 고르자마자 캔버스 ＋ 2개(열·행) → 아래 ＋ 1클릭 = 행 1→2.
 *   말풍선 = 넣기 → 캔버스 ＋ 0개 · dataset.lines 없음 → 몸통 클릭 → T = «새 텍스트 블럭»(텍스트 1→2, 줄 0 그대로).
 *            첫 줄은 우측 패널 「+ 줄 추가…」 select 로만 생겼다.
 * ★고침: 말풍선이 «혼자» 골라지면 그리드 아래 ＋ 와 같은 꼴의 ＋ 를 몸통 가운데 · 블럭 아래 끝에 띄운다
 *   (js/blocks/line-host.js 「말풍선 캔버스 ＋」 절 · 층 = #grd-plus-layer).
 * ⛔고정 대기 없음 — waitForFunction / expect.poll 로 «무엇을» 기다리나를 쓴다.
 *
 * ★★1017t1m3 ㉡(현빈 · 261026 GO) — 「그리고 해당버튼은 없어도 돼. 줄추가하는건데 왜 이게 있는거야.?」 ⇒ 말풍선 캔버스 ＋ 를 ★없앴다
 *   (js/blocks/line-host.js BUBBLE_CANVAS_PLUS = false · 말풍선만 — 로렐·그리드 ＋ 무접촉).
 *   ⇒ LP0 은 «＋ 0» 으로 뒤집었다(뒤집은 것이 고친 증거) · LP1~LP6 은 ＋ 가 있어야 성립하는 칸이라 SKIP(까닭 아래 SKIP_WHY · 칸마다 옮겨 간 자리는 커밋 메시지 표).
 *   ★줄 추가 입구 = 우클릭 «아래에 줄 추가 (T)» — 그 손짓·⌘Z 는 tests/dom/t1017m3-bubble-no-plus R1·R2 가 잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COND_MS = 15000;
const SEC = `<div class="section-block" id="bL" data-section="1" data-name="L" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">L</span></div><div class="section-inner"></div></div>`;

async function waitFor(page, fn, arg, what) {
  try { await page.waitForFunction(fn, arg, { timeout: COND_MS }); }
  catch (e) { throw new Error(`전제 미달 — ${what}`, { cause: e }); }
}

/** 빈 섹션 → (배율) → 말풍선 하나(삽입 입구가 고른다). 돌려주는 값 = { errs, id } */
async function setup(page, zoom = 100) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ html, zoom }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(zoom);
    window.selectSection?.(document.getElementById('bL'));
    window.addSpeechBubbleBlock?.('left');
  }, { html: SEC, zoom });
  await waitFor(page, () => !!document.querySelector('#canvas .speech-bubble-block.selected'), undefined,
    '말풍선이 생기고 골라지지 않았다');
  /* ★1013 S1-LP1 — 배율 전환이 «끝난 뒤»에 잰다. #canvas-scaler 는 `transition: transform .15s`(css/editor-canvas.css)라
     applyZoom(40→100) 직후 한동안 «보간 중»이다. 그 사이 잰 ＋·줄 좌표는 클릭 순간엔 이미 15~23px 옮겨 가 있어
     클릭이 말풍선 몸통(tb-bubble)에 떨어졌다(실측 dev 366fd826 · w1 · 빨강 4/4 모두 잰 순간 scale 0.746 → 누른 순간 0.845/0.911 ·
     ＋ 는 교체 0 — 같은 요소). ⇒ «재는 그 값»(스케일러의 계산된 배율 = zoom/100 · 도는 전환 0)을 기다린다. ⛔고정 대기 없음. */
  await waitFor(page, (z) => {
    const S = document.getElementById('canvas-scaler');
    if (!S || S.getAnimations().length) return false;
    const tf = getComputedStyle(S).transform, m = /^matrix\(([^,]+),/.exec(tf);
    const k = tf === 'none' ? 1 : m ? Number(m[1]) : NaN;
    return Math.abs(k - z / 100) < 1e-3;
  }, zoom, `배율 ${zoom}% 전환이 안 끝났다(#canvas-scaler 보간 중)`);
  const id = await page.evaluate(() => {
    const b = document.querySelector('#canvas .speech-bubble-block.selected');
    b.scrollIntoView({ block: 'center' });
    return b.id;
  });
  expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${zoom}%`).toBe(zoom);
  /* ~~＋ 가 뜰 때까지 기다린다~~ ⇒ 1017t1m3 ㉡ 뒤 ＋ 는 안 뜬다(LP0 이 그것을 잰다) */
  return { errs, id };
}

/** ＋ 원 가운데(화면 px) + 그 점의 맨 위 요소가 ＋ 인가 */
const plusPoint = (page, id) => page.evaluate((id) => {
  const b = document.querySelector(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  return { x, y, onBtn: hit === b || b.contains(hit), w: r.width };
}, id);

const linesOf = (page, id) => page.evaluate((id) => {
  const raw = document.getElementById(id)?.dataset.lines;
  return raw ? JSON.parse(raw) : null;
}, id);

/** ＋ 를 기다렸다가 그 점이 ＋ 위인지 단언하고 진짜 클릭 한 번 */
async function clickPlus(page, id) {
  await expect.poll(async () => (await plusPoint(page, id))?.onBtn ?? false,
    { message: '전제 — ＋ 원 가운데의 맨 위 요소가 ＋ 다' }).toBe(true);
  const p = await plusPoint(page, id);
  await page.mouse.click(p.x, p.y);
}

const SKIP_WHY = '1017t1m3 ㉡ — 말풍선 캔버스 ＋ 를 없앴다(현빈). 줄 추가 = 우클릭 «아래에 줄 추가» → t1017m3-bubble-no-plus R1·R2';
/* ~~LP0 전제 — 줄 없는 말풍선을 고르면 ＋ 하나가 뜨고, 블럭 DOM 안엔 없다~~ ⇒ 1017t1m3 ㉡: ＋ 0 */
test('LP0 ★1017t1m3 ㉡ — 줄 없는 말풍선을 골라도 ＋ 0 · 블럭 DOM 에도 0', async ({ page }) => {
  const { errs, id } = await setup(page);
  const s = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return {
      lines: b.dataset.lines ?? null,
      sel: b.classList.contains('selected'),
      inLayer: document.querySelectorAll(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`).length,
      inCanvas: document.querySelectorAll('#canvas .ln-add-btn').length,
      gridCls: document.querySelectorAll('.grd-add-btn').length,
    };
  }, id);
  console.log('    LP0 ' + JSON.stringify(s));
  expect(s.lines, '전제 — 새 말풍선은 줄이 없다').toBeNull();
  expect(s.sel).toBe(true);
  expect(s.inLayer, '★말풍선 ＋ 가 붙었다(1017t1m3 ㉡ 로 없앰)').toBe(0);   /* 옛: 1 */
  expect(s.inCanvas, '＋ 가 #canvas 안(블럭 DOM)에 들어갔다 — 저장·PNG 로 샌다').toBe(0);
  expect(s.gridCls, '＋ 가 그리드 클래스(.grd-add-btn)를 달았다 — 그리드 ＋ 개수 시험이 깨진다').toBe(0);
  expect(errs).toEqual([]);
});

test.skip('[SKIP 1017t1m3 ㉡ — 위 SKIP_WHY] LP1 손짓 수 — 고른 상태에서 ＋ 1클릭 = 줄 2개(구운 본문 + 새 본문) · 그리드 아래 ＋ 1클릭(행 +1)과 같은 수', async ({ page }) => {
  const { errs, id } = await setup(page);
  let bubbleClicks = 0;
  await clickPlus(page, id); bubbleClicks++;
  await waitFor(page, (id) => !!document.getElementById(id)?.dataset.lines, id, '＋ 를 눌렀는데 줄이 안 생겼다');
  const lines = await linesOf(page, id);
  const s = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { act: window.grdGetActiveLine?.(b), marks: b.querySelectorAll('.ln-line-selected').length, sel: b.classList.contains('selected') };
  }, id);
  /* 그리드 — 같은 섹션에 그리드를 넣고(삽입 입구가 고른다) 아래 ＋ 를 «한 번» 누른다 */
  const g = await page.evaluate(() => {
    window.selectSection?.(document.getElementById('bL'));
    window.addGridBlock?.();
    const gb = document.querySelector('#canvas .grid-block.selected');
    gb?.scrollIntoView({ block: 'center' });
    return gb ? { id: gb.id, rows: JSON.parse(gb.dataset.rows || '[{}]').length } : null;
  });
  expect(g, '전제 — 그리드가 생기고 골라졌다').not.toBeNull();
  await waitFor(page, (gid) => !!document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${gid}"][data-grd-add="row"]`), g.id, '그리드 아래 ＋ 가 안 떴다');
  const gp = await page.evaluate((gid) => {
    const b = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${gid}"][data-grd-add="row"]`);
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, g.id);
  let gridClicks = 0;
  await page.mouse.click(gp.x, gp.y); gridClicks++;
  await waitFor(page, ({ gid, n }) => JSON.parse(document.getElementById(gid).dataset.rows || '[{}]').length === n + 1,
    { gid: g.id, n: g.rows }, '그리드 아래 ＋ 1클릭이 행을 안 더했다');
  console.log('    LP1 ' + JSON.stringify({ lines: lines.length, act: s.act, marks: s.marks, bubbleClicks, gridClicks, gridRows: `${g.rows}→${g.rows + 1}` }));
  expect(lines.length, '＋ 1클릭 뒤 줄 수').toBe(2);
  expect(s.act).toEqual({ r: 0, c: 0, li: 1 });
  expect(s.marks, '새 줄에 줄 선택 표시가 하나').toBe(1);
  expect(s.sel, '＋ 를 눌러도 말풍선은 골라진 채').toBe(true);
  expect(bubbleClicks, '말풍선 줄 추가 손짓 = 그리드 행 추가 손짓').toBe(gridClicks);
  expect(errs).toEqual([]);
});

test.skip('[SKIP 1017t1m3 ㉡ — 위 SKIP_WHY] LP2 고른 줄 다음 — 줄 3개 중 0번을 고르고 ＋ → 새 줄이 1번 자리', async ({ page }) => {
  const { errs, id } = await setup(page);
  await page.evaluate((id) => window.updateSpeechBubbleBlock(id, {
    lines: [{ type: 'body', text: 'A' }, { type: 'body', text: 'B' }, { type: 'body', text: 'C' }],
  }), id);
  await waitFor(page, (id) => document.querySelectorAll(`#${id} .ln-row`).length === 3, id, '줄 3개가 안 그려졌다');
  /* 줄 0 을 진짜 클릭 — 이미 «이것 하나»가 골라져 있으니 2단 선택으로 그 줄이 잡힌다 */
  const r0 = await page.evaluate((id) => {
    const r = document.querySelector(`#${id} .ln-row[data-ln="0"]`).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  await page.mouse.click(r0.x, r0.y);
  await waitFor(page, (id) => window.grdGetActiveLine?.(document.getElementById(id))?.li === 0, id, '줄 0 이 안 골라졌다');
  /* ★전제 둘을 «단언»으로도 찍는다(1013 S1 · FLAKY 명부 LP2 ⒤) — 「＋ 직전 고른 줄 = 0」·「＋ 직전 줄 = 3 (데이터)」.
     ⇒ 빨강이 나면 «＋ 의 자리 계산»인지 «전제(고르기·줄 수)»인지 줄 번호로 갈린다. */
  const pre = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { li: window.grdGetActiveLine?.(b)?.li ?? null, n: JSON.parse(b.dataset.lines || '[]').length };
  }, id);
  expect(pre.li, '전제 — ＋ 직전 고른 줄 = 0').toBe(0);
  expect(pre.n, '전제 — ＋ 직전 줄 수(dataset.lines) = 3').toBe(3);
  await clickPlus(page, id);
  await waitFor(page, (id) => JSON.parse(document.getElementById(id).dataset.lines).length === 4, id, '＋ 를 눌렀는데 줄이 안 늘었다');
  const texts = (await linesOf(page, id)).map(l => l.text);
  console.log('    LP2 ' + JSON.stringify(texts));
  expect(texts).toEqual(['A', '', 'B', 'C']);
  expect(errs).toEqual([]);
});

test.skip('[SKIP 1017t1m3 ㉡ — 위 SKIP_WHY] LP3 새지 않음 — ＋ 클릭 뒤 선택 유지 · 블럭 수 불변 · 저장 문자열에 ＋ 없음', async ({ page }) => {
  const { errs, id } = await setup(page);
  const count = () => page.evaluate(() => document.querySelectorAll('#canvas .section-inner > *').length);
  const n0 = await count();
  await clickPlus(page, id);
  await waitFor(page, (id) => !!document.getElementById(id)?.dataset.lines, id, '＋ 를 눌렀는데 줄이 안 생겼다');
  const s = await page.evaluate((id) => ({
    sel: document.getElementById(id).classList.contains('selected'),
    selN: document.querySelectorAll('#canvas .selected').length,
    inCanvas: document.querySelectorAll('#canvas .ln-add-btn').length,
    ser: /ln-add-btn/.test(window.getSerializedCanvas?.() ?? ''),
    serOk: typeof window.getSerializedCanvas === 'function',
  }), id);
  const n1 = await count();
  console.log('    LP3 ' + JSON.stringify({ ...s, n0, n1 }));
  expect(s.serOk, '전제 — 직렬화 문(getSerializedCanvas)이 있다').toBe(true);
  expect(s.sel, '＋ 클릭이 캔버스로 새서 선택이 풀렸다').toBe(true);
  expect(n1, '＋ 클릭이 블럭을 더했다(전역 T/G 로 샜다)').toBe(n0);
  expect(s.inCanvas).toBe(0);
  expect(s.ser, '저장 문자열에 ln-add-btn 이 들어갔다').toBe(false);
  expect(errs).toEqual([]);
});

test.skip('[SKIP 1017t1m3 ㉡ — 위 SKIP_WHY] LP4 ⌘Z 한 걸음 — ＋ 한 번 → ⌘Z 한 번 → 줄 없음으로 복원', async ({ page }) => {
  const { errs, id } = await setup(page);
  await clickPlus(page, id);
  await waitFor(page, (id) => !!document.getElementById(id)?.dataset.lines, id, '＋ 를 눌렀는데 줄이 안 생겼다');
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => {
    const b = document.getElementById(id);
    return b ? (b.dataset.lines ?? null) : 'gone';
  }, id), { message: '⌘Z 한 번이 줄 추가를 안 되돌렸다(또는 블럭까지 지웠다)' }).toBeNull();
  expect(errs).toEqual([]);
});

test.skip('[SKIP 1017t1m3 ㉡ — 위 SKIP_WHY] LP5 걷힘 — 선택 해제·블럭 삭제 → ＋ 0개', async ({ page }) => {
  const { errs, id } = await setup(page);
  await page.evaluate(() => window.deselectAll?.());
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.ln-add-btn').length),
    { message: '선택을 풀었는데 ＋ 가 남았다' }).toBe(0);
  /* 다시 고른 뒤 블럭을 문서에서 뺀다 */
  await page.evaluate((id) => { const b = document.getElementById(id); window.deselectAll?.(); b.click(); }, id);
  await waitFor(page, (id) => document.querySelectorAll(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`).length === 1, id, '다시 골랐는데 ＋ 가 안 떴다');
  await page.evaluate((id) => document.getElementById(id).closest('.frame-block').remove(), id);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.ln-add-btn').length),
    { message: '블럭을 지웠는데 ＋ 가 남았다' }).toBe(0);
  expect(errs).toEqual([]);
});

for (const z of [40, 100]) {
  test.skip(`[SKIP 1017t1m3 ㉡ — 위 SKIP_WHY] LP6 배율 ${z}% — ＋ 원 중심 = (몸통 가로 가운데, 블럭 아래 끝) ± 2 화면px`, async ({ page }) => {
    const { errs, id } = await setup(page, z);
    expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${z}`).toBe(z);
    await expect.poll(() => page.evaluate((id) => {
      const b = document.getElementById(id), q = b.querySelector('.tb-bubble').getBoundingClientRect(), br = b.getBoundingClientRect();
      const p = document.querySelector(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`).getBoundingClientRect();
      /* 기준점 = 원 «위 가운데»(translateX(-50%) — 그리드 아래 ＋ 와 같다) */
      const dx = Math.abs((p.left + p.width / 2) - (q.left + q.width / 2));
      const dy = Math.abs(p.top - br.bottom);
      return Math.round(Math.max(dx, dy) * 10) / 10;
    }, id), { message: `배율 ${z}% 에서 ＋ 자리가 어긋났다(화면 px)` }).toBeLessThanOrEqual(2);
    expect(errs).toEqual([]);
  });
}
