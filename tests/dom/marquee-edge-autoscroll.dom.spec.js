/* marquee-edge-autoscroll.dom.spec.js — ⑶ 선택상자를 끄는 중 «가장자리»에서 캔버스가 따라 스크롤된다
 * (현빈 2026-10-06 「캔버스에서 마우스에 드래그로 선택영역 아웃라인 만들수 있는데 화면 밑에 드래그를
 *  하면 화면 스크롤이 내려가면서 더 입력가능할수 있게 해줄래?」 · 위쪽도 = 지디 2026-10-06 판정)
 *
 * ★양성대조 판 = e7444dd3(고치기 전) → `GD1001_ROOT=<그 판 체크아웃> ...` 로 돌리면
 *   ★빨강: M1(아래 자동 스크롤) · M2(스크롤만큼 상자도 자란다) · M3(위 자동 스크롤).
 *   2026-10-06 실측(그 판): 하단 −4px 에서 1.2초 보유 → scrollTop 1552 그대로(여지 1876px), boxH 무변.
 *   ★M2 는 ★세 조각 중 ③(scalerRect 캐시 갱신)만 뺐을 때도 ★빨강이어야 한다 — 「스크롤은 되는데
 *     선택은 제자리」가 초록으로 통과하지 않게. (⛔①②만 넣으면 M1 초록 / M2 빨강)
 *   ★지키는 검사: M4(가운데에선 안 스크롤) · M5(스크롤 최대에서 멈춘다 · 팬 여지를 늘리지 않는다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SECS = `
<div class="section-block" id="mA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:700px"></div></div></div>
<div class="section-block" id="mB" data-section="2" data-name="B" data-bg="#eeeeee" style="background:#eee;">
  <div class="section-hitzone"><span class="section-label">B</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:900px"></div></div></div>
<div class="section-block" id="mC" data-section="3" data-name="C" data-bg="#dddddd" style="background:#ddd;">
  <div class="section-hitzone"><span class="section-label">C</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:900px"></div></div></div>`;

async function setup(page, { startAt = 'top' } = {}) {
  await page.setViewportSize({ width: 1500, height: 800 });
  await bootApp(page);
  await page.evaluate(([html, startAt]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    document.getElementById(startAt === 'top' ? 'mA' : 'mC').scrollIntoView({ block: 'start' });
  }, [SECS, startAt]);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const wrap = document.getElementById('canvas-wrap');
    const c = document.getElementById('canvas').getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    return { st: wrap.scrollTop, maxT: Math.max(0, wrap.scrollHeight - wrap.clientHeight),
             cLeft: c.left, wTop: w.top, wBottom: w.bottom, wLeft: w.left,
             scale: (() => { const m = document.getElementById('canvas-scaler').style.transform?.match(/scale\(([^)]+)\)/); return m ? parseFloat(m[1]) : 1; })() };
  });
}

const probe = (page) => page.evaluate(() => {
  const m = document.querySelector('.scratch-marquee');
  return { st: document.getElementById('canvas-wrap').scrollTop,
           maxT: Math.max(0, document.getElementById('canvas-wrap').scrollHeight - document.getElementById('canvas-wrap').clientHeight),
           boxH: m ? parseFloat(m.style.height) : null,
           hit: [...document.querySelectorAll('#canvas .marquee-hit')].map(e => e.id).sort() };
});

/** 캔버스 왼쪽 빈 바닥에서 시작해 targetY(화면 y)까지 끈 뒤, 그 자리에 ms 동안 «머문다».
 * ★머무는 동안 ★마우스를 전혀 안 움직인다 — 조각 ②(포인터가 멈춰 있어도 rAF 가 스스로 다시 돈다)를
 *   «정말로» 재려면 그래야 한다. 손떨림을 섞으면 mousemove 가 _update 를 깨워 ② 없이도 돌 수 있다.
 * ★CDP 왕복을 2회로 줄였다(옛 꼴은 100ms × N 회 move) — 이 맥은 여러 세션이 나눠 써서 부하가 높을 때
 *   왕복 수가 그대로 벽시계에 얹혔다(실측 2026-10-06: load 26.5 에서 M4 가 전수 1회 30s 타임아웃,
 *   같은 판 단독 재실행 3/3 초록 ⇒ 빨강이 아니라 부하였다). */
async function dragAndHold(page, geo, targetY, ms, { dx = 300 } = {}) {
  const sx = Math.max(geo.wLeft + 10, geo.cLeft - 60);
  const sy = (geo.wTop + geo.wBottom) / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(sx + dx * i / 10, sy + (targetY - sy) * i / 10);
  const t0 = await probe(page);
  await page.waitForTimeout(ms);          // ★움직이지 않고 기다린다
  const t1 = await probe(page);
  await page.mouse.up();
  await page.waitForTimeout(150);
  return { t0, t1 };
}

test('M1 ★아래 끝에 대고 멈춰 있으면 캔버스가 따라 내려간다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  // ★전제 단언 — 내려갈 여지가 «실제로» 있다(없으면 이 검사는 아무것도 안 잰다)
  expect(geo.maxT - geo.st, `내려갈 여지 (잰 값: ${geo.maxT - geo.st}px)`).toBeGreaterThan(500);

  const { t0, t1 } = await dragAndHold(page, geo, geo.wBottom - 4, 1200);
  expect(t0.boxH, '상자가 떴다(계측기 양성)').toBeGreaterThan(0);
  expect(t1.st - t0.st, `scrollTop 증가 (잰 값: ${t1.st - t0.st}px · ${t0.st}→${t1.st})`).toBeGreaterThan(200);
});

test('M2 ★★스크롤한 만큼 «상자도» 자란다 (「스크롤은 되는데 선택은 제자리」 금지)', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  expect(geo.maxT - geo.st).toBeGreaterThan(500);                       // ★전제 단언

  const { t0, t1 } = await dragAndHold(page, geo, geo.wBottom - 4, 1200);
  const dScroll = t1.st - t0.st;
  expect(dScroll, `scrollTop 증가 (잰 값: ${dScroll})`).toBeGreaterThan(200);   // ★전제 — ①②가 돌았다
  /* 상자는 «모델 px», 스크롤은 «화면 px» ⇒ 배율로 나눠 견준다. 허용 0.9~1.1배. */
  const grewModel = (t1.boxH - t0.boxH) * geo.scale;
  expect(grewModel / dScroll, `상자 증가 ÷ 스크롤 증가 (잰 값: boxH ${t0.boxH}→${t1.boxH} · 배율 ${geo.scale} · 비 ${(grewModel / dScroll).toFixed(3)})`)
    .toBeGreaterThan(0.9);
  expect(grewModel / dScroll).toBeLessThan(1.1);
});

test('M3 ★위쪽도 같이 — 위 끝에 대고 멈춰 있으면 캔버스가 올라간다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'bottom' });
  expect(geo.st, `올라갈 여지 (잰 값: ${geo.st}px)`).toBeGreaterThan(500);   // ★전제 단언

  const { t0, t1 } = await dragAndHold(page, geo, geo.wTop + 4, 1200);
  expect(t0.boxH, '상자가 떴다').toBeGreaterThan(0);
  expect(t0.st - t1.st, `scrollTop 감소 (잰 값: ${t0.st - t1.st}px · ${t0.st}→${t1.st})`).toBeGreaterThan(200);
});

test('M4 ★지키는 검사 — 가장자리 «밖»(가운데)에선 스크롤이 0이다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  const mid = (geo.wTop + geo.wBottom) / 2;
  const { t0, t1 } = await dragAndHold(page, geo, mid + 60, 1200);
  expect(t0.boxH, '상자가 떴다').toBeGreaterThan(0);
  expect(t1.st - t0.st, `scrollTop 변화 (잰 값: ${t1.st - t0.st})`).toBe(0);
});

test('M5 ★지키는 검사 — 스크롤 최대에서 멈춘다(팬 여지를 늘리지 않는다)', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  const before = await page.evaluate(() => {
    const w = document.getElementById('canvas-wrap');
    return { maxT: Math.max(0, w.scrollHeight - w.clientHeight) };
  });
  // 끝까지 가도록 넉넉히 머문다(여지 ÷ 최대 step 24px/frame → 60fps 에서 1.3초 · 2.5초를 준다)
  const { t0, t1 } = await dragAndHold(page, geo, geo.wBottom - 4, 2500);
  /* ★전제 단언 — 스크롤이 «실제로» 돌았다. ⛔없으면 스크롤이 0인 판(고치기 전)에서도 maxT 가
     당연히 불변이라 이 검사가 «아무것도 안 재고» 초록이 된다(실측: 핀 e7444dd3 에서 M5 초록). */
  expect(t1.st - t0.st, `scrollTop 증가 (잰 값: ${t1.st - t0.st})`).toBeGreaterThan(200);
  expect(t1.st, `scrollTop (잰 값: ${t1.st} · 최대 ${t1.maxT})`).toBeLessThanOrEqual(t1.maxT);
  // ★팬 여지(scrollHeight)가 자라지 않았다 — growPanRoom 을 안 불렀다는 뜻
  expect(t1.maxT, `최대 스크롤 (시작 ${before.maxT} → 끝 ${t1.maxT})`).toBe(before.maxT);
});

test('M6 ★놓으면 스크롤로 들어온 아래쪽 섹션이 실제로 골라진다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  expect(geo.maxT - geo.st).toBeGreaterThan(500);                       // ★전제 단언
  // 캔버스 폭을 넉넉히 덮어 섹션 면적비(MARQUEE_COVER_RATIO 0.5)를 넘기게 끈다
  const { t0, t1 } = await dragAndHold(page, geo, geo.wBottom - 4, 2000, { dx: 1000 });
  expect(t1.st - t0.st, '스크롤이 돌았다').toBeGreaterThan(200);
  const sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block.multi-selected, #canvas .section-block.selected')].map(s => s.id).sort());
  expect(sel.length, `놓은 뒤 골라진 섹션 (잰 값: ${JSON.stringify(sel)})`).toBeGreaterThan(1);
  expect(sel, '아래쪽 섹션이 들어 있다').toContain('mC');
});
