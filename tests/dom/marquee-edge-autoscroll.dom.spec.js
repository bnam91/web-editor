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
             /* ★가로 칸 — 좌우 자동 스크롤용. 세로와 ★같은 꼴(sl/maxL ↔ st/maxT). */
             sl: wrap.scrollLeft, maxL: Math.max(0, wrap.scrollWidth - wrap.clientWidth), sw: wrap.scrollWidth,
             cLeft: c.left, wTop: w.top, wBottom: w.bottom, wLeft: w.left, wRight: w.right,
             scale: (() => { const m = document.getElementById('canvas-scaler').style.transform?.match(/scale\(([^)]+)\)/); return m ? parseFloat(m[1]) : 1; })() };
  });
}

const probe = (page) => page.evaluate(() => {
  const m = document.querySelector('.scratch-marquee');
  const w = document.getElementById('canvas-wrap');
  return { st: w.scrollTop,
           maxT: Math.max(0, w.scrollHeight - w.clientHeight),
           /* ★가로 칸 — 세로와 같은 꼴 */
           sl: w.scrollLeft, maxL: Math.max(0, w.scrollWidth - w.clientWidth), sw: w.scrollWidth,
           boxH: m ? parseFloat(m.style.height) : null,
           boxW: m ? parseFloat(m.style.width) : null,
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

/* ★M6 의 «장면»을 사실대로 적는다 (지디 2026-10-07 판정 ⒝ — 「제목이 조건을 말하면 제목째 거짓이 된다」).
 *   ★이 장면은 끝 x 가 sx 518 + dx 1000 = ★1518 로, wrap 오른끝(실측 1260)보다 ★258px ★밖이다
 *   ⇒ 2026-10-07 에 좌우가 들어온 뒤로는 ★가로 띠에도 들어, ★세로와 ★가로가 ★같이 돈다
 *     (실측: 2000ms 동안 scrollLeft 980 → maxL 1960 까지 간다 — 그만큼 캔버스가 화면 왼쪽으로 빠진다).
 *   ★단언이 재는 것은 ★«놓은 뒤 섹션 2개 이상 ＋ mC 포함» 이고, ★그 성질은 ★가로가 돌아도 ★그대로다
 *     — 실측 ★초록 ×3회(고친 판 이 파일 전수 ×2 ＋ 단독 1).
 *   ⛔`dx: 1000` 을 ★줄이지 마라 — 그건 ★검사를 느슨하게 고쳐 통과시키는 것이다(지디 2026-10-07). */
test('M6 ★놓으면 자동 스크롤로 들어온 아래쪽 섹션이 실제로 골라진다 (★이 장면은 세로·가로가 «같이» 돈다)', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  expect(geo.maxT - geo.st).toBeGreaterThan(500);                       // ★전제 단언
  // 캔버스 폭을 넉넉히 덮어 섹션 면적비(MARQUEE_COVER_RATIO 0.5)를 넘기게 끈다.
  // ⚠️끝 x = sx + dx 가 wrap 오른끝 «밖»이라 ★가로 띠에도 든다(위 머리말) — ★의도대로 둔다.
  const { t0, t1 } = await dragAndHold(page, geo, geo.wBottom - 4, 2000, { dx: 1000 });
  expect(t1.st - t0.st, '스크롤이 돌았다').toBeGreaterThan(200);
  const sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block.multi-selected, #canvas .section-block.selected')].map(s => s.id).sort());
  expect(sel.length, `놓은 뒤 골라진 섹션 (잰 값: ${JSON.stringify(sel)})`).toBeGreaterThan(1);
  expect(sel, '아래쪽 섹션이 들어 있다').toContain('mC');
});

/* ══════════════════════════════════════════════════════════════════════════════════════════
 * ★M7·M8 — «위아래 무변 증인» (지디 2026-10-07 발주 ②: 「위아래가 안 깨졌음을 검사로 잠근다 —
 *   이게 더 중요하다」). ⛔좌우를 더하기 ★전에 썼고, 더하기 전 판에서 ★초록인 것을 먼저 확인했다.
 *   ⇒ 좌우를 더한 뒤 이 둘이 빨강이면 ★내가 깬 것이고, 초록이면 위아래는 그대로다.
 * ★이 둘은 「가로 변화 = 0」을 재므로, ★전제 셋을 ★스스로 단언한다 — 안 그러면 ⑴가로 여지가
 *   없거나 ⑵머무는 자리가 가로 띠 밖이 아니어서 «아무것도 안 재고» 통과한다.
 * ★머무는 x = wrap 가로 ★가운데 — 가로 띠(EDGE_BAND 40px) 양쪽에서 멀다(실측 1500×800 에서
 *   wrap 240~1260 ⇒ 가운데 750 · 양끝 510px). ⛔기존 M1~M6 의 dragAndHold 는 끝 x 를
 *   «sx+dx» 로 정하므로 여기서는 쓰지 않는다(M6 은 dx 1000 으로 ★wrap 오른끝 밖까지 간다). */

/** 빈 바닥에서 시작해 ★(targetX, targetY) 까지 끈 뒤 그 자리에 ms 동안 «머문다».
 * ★dragAndHold 와 ★같은 꼴 — 머무는 동안 마우스를 전혀 안 움직이고, CDP 왕복은 2회다.
 * 다른 점은 ★끝 x 를 «직접» 받는 것뿐(세로 전용 helper 는 dx 로 정한다). */
async function dragAndHoldAt(page, geo, targetX, targetY, ms) {
  const sx = Math.max(geo.wLeft + 10, geo.cLeft - 60);
  const sy = (geo.wTop + geo.wBottom) / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(sx + (targetX - sx) * i / 10, sy + (targetY - sy) * i / 10);
  const t0 = await probe(page);
  await page.waitForTimeout(ms);          // ★움직이지 않고 기다린다
  const t1 = await probe(page);
  await page.mouse.up();
  await page.waitForTimeout(150);
  return { t0, t1, sx, sy };
}

/** ★M7·M8 공용 전제 — 「가로 변화 0」이 «무언가를 재고» 있음을 단언한다. */
const assertHorizontalRoomAndMidX = (geo, holdX) => {
  expect(geo.maxL - geo.sl, `★전제 — 오른쪽 가로 여지 (잰 값: ${geo.maxL - geo.sl}px · sl ${geo.sl} / maxL ${geo.maxL})`).toBeGreaterThan(200);
  expect(geo.sl, `★전제 — 왼쪽 가로 여지 (잰 값: ${geo.sl}px)`).toBeGreaterThan(200);
  const edgeDist = Math.min(holdX - geo.wLeft, geo.wRight - holdX);
  expect(edgeDist, `★전제 — 머무는 x 가 가로 띠(40px) 밖 (잰 값: 끝에서 ${edgeDist}px · x ${holdX} · wrap ${geo.wLeft}~${geo.wRight})`).toBeGreaterThan(40);
};

test('M7 ★무변 증인 — 아래 끝에 머물면 «세로만» 움직이고 ★가로는 0 이다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  expect(geo.maxT - geo.st, `★전제 — 내려갈 여지 (잰 값: ${geo.maxT - geo.st}px)`).toBeGreaterThan(500);
  const holdX = (geo.wLeft + geo.wRight) / 2;
  assertHorizontalRoomAndMidX(geo, holdX);

  const { t0, t1 } = await dragAndHoldAt(page, geo, holdX, geo.wBottom - 4, 1200);
  expect(t0.boxH, '상자가 떴다(계측기 양성)').toBeGreaterThan(0);
  expect(t1.st - t0.st, `세로 증가 (잰 값: ${t1.st - t0.st}px · ${t0.st}→${t1.st})`).toBeGreaterThan(200);
  expect(t1.sl - t0.sl, `★가로 변화 (잰 값: ${t1.sl - t0.sl}px · ${t0.sl}→${t1.sl})`).toBe(0);
});

test('M8 ★무변 증인 — 위 끝에 머물면 «세로만» 움직이고 ★가로는 0 이다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'bottom' });
  expect(geo.st, `★전제 — 올라갈 여지 (잰 값: ${geo.st}px)`).toBeGreaterThan(500);
  const holdX = (geo.wLeft + geo.wRight) / 2;
  assertHorizontalRoomAndMidX(geo, holdX);

  const { t0, t1 } = await dragAndHoldAt(page, geo, holdX, geo.wTop + 4, 1200);
  expect(t0.boxH, '상자가 떴다(계측기 양성)').toBeGreaterThan(0);
  expect(t0.st - t1.st, `세로 감소 (잰 값: ${t0.st - t1.st}px · ${t0.st}→${t1.st})`).toBeGreaterThan(200);
  expect(t1.sl - t0.sl, `★가로 변화 (잰 값: ${t1.sl - t0.sl}px · ${t0.sl}→${t1.sl})`).toBe(0);
});

/* ══════════════════════════════════════════════════════════════════════════════════════════
 * ★M9·M10·M12 — «좌우» 자동 스크롤 (현빈 2026-10-07 「드래그 자동 스크롤은 위아래만 됩니다
 *   → 이것도 되면 해」). ★세로(M1·M3·M5)와 ★같은 꼴로 쓴다 — 축 이름만 바꿨다.
 * ★양성대조 판 = ★`2866df63`(= 좌우를 더하기 ★전 판). ⛔나중에 HEAD 를 핀으로 되돌려 쓰는 게
 *   아니라, ★이 검사들을 ★그 판에서 ★먼저 돌려 빨강을 떴다(2026-10-07 — 아래 커밋 메시지에 수).
 * ★가로 여지의 출처: #canvas-wrap 은 `overflow:auto` 이고 #canvas-scaler 에 ★좌우 대칭 팬 여백
 *   (margin-left/right = clientWidth)이 상시 있다 ⇒ 실측 1500×800 에서 maxL 1960 · 쉼 sl 980
 *   (양쪽 980px). ⛔팬 여지를 ★늘리지 않는다 — 세로 M5 와 같은 금지(M12 가 그것을 잠근다). */

/** ★M9·M10·M12 공용 전제 — 머무는 y 가 ★세로 띠(40px) ★밖이다.
 *  ⛔없으면 「세로 변화 0」 단언이 당연히 거짓이 되거나, 세로가 섞여 가로 증가를 못 가린다. */
const assertMidY = (geo, holdY) => {
  const edgeDist = Math.min(holdY - geo.wTop, geo.wBottom - holdY);
  expect(edgeDist, `★전제 — 머무는 y 가 세로 띠(40px) 밖 (잰 값: 끝에서 ${edgeDist}px · y ${holdY} · wrap ${geo.wTop}~${geo.wBottom})`).toBeGreaterThan(40);
};

test('M9 ★오른쪽 끝에 대고 멈춰 있으면 캔버스가 따라 «오른쪽»으로 간다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  const holdY = (geo.wTop + geo.wBottom) / 2;
  // ★전제 단언 — 오른쪽으로 갈 여지가 «실제로» 있다(없으면 이 검사는 아무것도 안 잰다)
  expect(geo.maxL - geo.sl, `★전제 — 오른쪽 가로 여지 (잰 값: ${geo.maxL - geo.sl}px · sl ${geo.sl} / maxL ${geo.maxL})`).toBeGreaterThan(500);
  assertMidY(geo, holdY);

  const { t0, t1 } = await dragAndHoldAt(page, geo, geo.wRight - 4, holdY, 1200);
  expect(t0.boxW, '상자가 떴다(계측기 양성)').toBeGreaterThan(0);
  expect(t1.sl - t0.sl, `★가로 증가 (잰 값: ${t1.sl - t0.sl}px · ${t0.sl}→${t1.sl})`).toBeGreaterThan(200);
  // ★세로는 안 움직인다 — 가로 손짓이 세로를 끌고 가지 않는다(M7·M8 의 거울상)
  expect(t1.st - t0.st, `★세로 변화 (잰 값: ${t1.st - t0.st}px · ${t0.st}→${t1.st})`).toBe(0);
});

test('M10 ★왼쪽도 같이 — 왼쪽 끝에 대고 멈춰 있으면 캔버스가 «왼쪽»으로 간다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  const holdY = (geo.wTop + geo.wBottom) / 2;
  expect(geo.sl, `★전제 — 왼쪽 가로 여지 (잰 값: ${geo.sl}px)`).toBeGreaterThan(500);   // ★전제 단언
  assertMidY(geo, holdY);

  const { t0, t1 } = await dragAndHoldAt(page, geo, geo.wLeft + 4, holdY, 1200);
  expect(t0.boxW, '상자가 떴다(계측기 양성)').toBeGreaterThan(0);
  expect(t0.sl - t1.sl, `★가로 감소 (잰 값: ${t0.sl - t1.sl}px · ${t0.sl}→${t1.sl})`).toBeGreaterThan(200);
  expect(t1.st - t0.st, `★세로 변화 (잰 값: ${t1.st - t0.st}px · ${t0.st}→${t1.st})`).toBe(0);
});

test('M12 ★지키는 검사 — 가로 최대에서 멈춘다(가로 팬 여지를 늘리지 않는다)', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  const holdY = (geo.wTop + geo.wBottom) / 2;
  expect(geo.maxL - geo.sl, `★전제 — 오른쪽 가로 여지 (잰 값: ${geo.maxL - geo.sl}px)`).toBeGreaterThan(500);
  assertMidY(geo, holdY);
  const before = { sw: geo.sw, maxL: geo.maxL };
  // 끝까지 가도록 넉넉히 머문다(여지 980 ÷ 24px/frame → 60fps 에서 0.7초 · 2.5초를 준다)
  const { t0, t1 } = await dragAndHoldAt(page, geo, geo.wRight - 4, holdY, 2500);
  /* ★전제 단언 — 가로 스크롤이 «실제로» 돌았다. ⛔없으면 가로가 0인 판(고치기 전)에서도 maxL 이
     당연히 불변이라 이 검사가 «아무것도 안 재고» 초록이 된다(세로 M5 에서 실측된 거짓 초록과 같은 꼴). */
  expect(t1.sl - t0.sl, `★가로 증가 (잰 값: ${t1.sl - t0.sl}px)`).toBeGreaterThan(200);
  expect(t1.sl, `scrollLeft (잰 값: ${t1.sl} · 최대 ${t1.maxL})`).toBeLessThanOrEqual(t1.maxL);
  // ★가로 팬 여지(scrollWidth)가 자라지 않았다 — growPanRoom 을 안 불렀다는 뜻
  expect(t1.sw, `scrollWidth (시작 ${before.sw} → 끝 ${t1.sw})`).toBe(before.sw);
  expect(t1.maxL, `최대 가로 스크롤 (시작 ${before.maxL} → 끝 ${t1.maxL})`).toBe(before.maxL);
});

/* ★M11 — ★모서리(오른쪽 아래 끝)에서 ★둘이 동시에 도는가, ★그때 세로 속도가 ★두 배가 되나
 *   (지디 2026-10-07 발주 5: 「모서리에서 둘이 동시에 도는지 재라 — 그때 속도가 두 배가 되면 안 된다」).
 *
 * ★자를 «증가량»이 아니라 ★«프레임당 걸음»으로 잡는다 — ⛔증가량 비는 ★못 쓴다(아래가 그 실측이다).
 *   2026-10-07 실측: ★헤드리스 Chromium 의 rAF 는 vsync 가 없어 ★프레임률이 흔들린다 —
 *   ★같은 700ms 머묾인데 축 증가량이 ★576px(≈69fps) 과 ★1008px(≈120fps) 로 나왔다(load 11~19).
 *   ⇒ 「끌기 둘의 증가량 비」는 ★1.74배까지 저절로 벌어져 ★「두 배」와 ★구분이 안 된다.
 *   ⇒ ★페이지 안에서 매 rAF 마다 scrollTop/scrollLeft 를 재어 ★프레임당 걸음의 ★중앙값을 쓴다.
 *     걸음은 EDGE_STEP·띠 깊이로만 정해지므로 ★프레임률과 무관하다.
 *   ⛔★«증가량»으로 ★되돌리지 마라 — ★그 자는 ★이 판에서 ★죽는다(576↔1008px, 같은 조건).
 *     (지디 2026-10-07 판정: 「내 문장의 ★단위가 틀렸다 — 잠그는 ★성질이 같고 자만 안 흔들리게 바뀐 것이
 *      ★더 나은 자다. 유지해라」. ★잠그는 성질 = 「모서리에서 세로가 세로만일 때와 같다 · 두 배가 아니다」)
 * ★첫 두 판은 ★전제 단언에서 빨강이었다(가로가 maxL 1960 으로 ★포화 ⇒ 비가 항등식이 된다) —
 *   ★그 전제가 ★내 검사 설계의 흠을 잡았다. 깊이 20px(걸음 12px) · 머묾 300ms ⇒ 최대 432px(여지 980).
 * ⚠️★이 검사가 ★잠그지 ★않는 것(솔직히 적는다): ⒞ 는 ★상한만 건다(두 배 금지). 「합성을 EDGE_STEP 으로
 *   ★정규화하는 꼴」(모서리에서 세로가 0.707배로 ★느려지는 설계)은 ★이 수로는 ★배제되지 않는다 —
 *   그 설계를 금지하는 것은 ★발주 1(⛔새 설계 금지)·★발주 2(위아래 무변)이고, 여기선 비를 ★단언
 *   메시지에 ★찍어 두어 지디가 눈으로 가를 수 있게 한다. ⛔내가 하한을 조여 결정을 가로채지 않는다. */

/** ★머무는 동안 ★페이지 안에서 매 rAF 마다 스크롤을 재어 ★프레임당 걸음의 중앙값을 돌려준다.
 *  ⛔마우스를 전혀 안 움직인다(조각 ② 를 재는 성질을 유지한다 — waitForTimeout 을 이것으로 갈아끼운 것뿐). */
async function dragHoldSteps(page, geo, targetX, targetY, ms) {
  const sx = Math.max(geo.wLeft + 10, geo.cLeft - 60);
  const sy = (geo.wTop + geo.wBottom) / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(sx + (targetX - sx) * i / 10, sy + (targetY - sy) * i / 10);
  const t0 = await probe(page);
  const r = await page.evaluate((ms) => new Promise((res) => {
    const w = document.getElementById('canvas-wrap');
    const dt = [], dl = [];
    let lt = w.scrollTop, ll = w.scrollLeft;
    const start = performance.now();
    const tick = () => {
      dt.push(w.scrollTop - lt); dl.push(w.scrollLeft - ll);
      lt = w.scrollTop; ll = w.scrollLeft;
      if (performance.now() - start < ms) requestAnimationFrame(tick); else res({ dt, dl });
    };
    requestAnimationFrame(tick);
  }), ms);
  const t1 = await probe(page);
  await page.mouse.up();
  await page.waitForTimeout(150);
  /* ★0 이 아닌 걸음의 중앙값 — 0 은 「그 프레임엔 앱 rAF 가 내 샘플러 뒤에 돌았다」이거나 멈춘 것이다. */
  const med = (a) => { const v = a.filter(x => x !== 0).sort((p, q) => p - q); return v.length ? Math.abs(v[Math.floor(v.length / 2)]) : 0; };
  return { t0, t1, stepV: med(r.dt), stepH: med(r.dl), frames: r.dt.length, nzV: r.dt.filter(x => x !== 0).length, nzH: r.dl.filter(x => x !== 0).length };
}

test('M11 ★모서리 — 둘이 «동시에» 돌고, 그때 ★세로 걸음이 두 배가 아니다', async ({ page }) => {
  const geo = await setup(page, { startAt: 'top' });
  const midX = (geo.wLeft + geo.wRight) / 2;
  const DEPTH = 20;    // ★띠(40px) 안 «얕은» 깊이 — 걸음 = ceil(24 × 20/40) = ★12px/frame (두 축 같은 수)
  const HOLD = 300;    // ★최대 432px(120fps) — 여지 세로 1876·가로 980 에 ★안 닿는다
  expect(geo.maxT - geo.st, `★전제 — 세로 여지 (잰 값: ${geo.maxT - geo.st}px)`).toBeGreaterThan(500);
  expect(geo.maxL - geo.sl, `★전제 — 오른쪽 가로 여지 (잰 값: ${geo.maxL - geo.sl}px)`).toBeGreaterThan(500);

  const reset = () => page.evaluate(([st, sl]) => {
    const w = document.getElementById('canvas-wrap'); w.scrollTop = st; w.scrollLeft = sl;
    window.deselectAll?.();          // ★앞 끌기의 선택을 지운다 — 다음 끌기가 «섹션 끌기» 길로 새지 않게
  }, [geo.st, geo.sl]);

  // ⑴ ★세로만 — 아래 끝 · x 는 가로 띠 밖(가운데)
  await reset();
  const only = await dragHoldSteps(page, geo, midX, geo.wBottom - DEPTH, HOLD);
  expect(only.nzV, `★전제 — 「세로만」이 실제로 돌았다 (잰 값: 0 아닌 세로 프레임 ${only.nzV} / 전체 ${only.frames})`).toBeGreaterThan(3);
  expect(only.t1.st, `★전제 — 「세로만」이 세로 최대에 안 닿았다 (잰 값: ${only.t1.st} · 최대 ${only.t1.maxT})`).toBeLessThan(only.t1.maxT);
  expect(only.stepH, `「세로만」에선 가로 걸음이 0 (M7 과 같은 자 · 잰 값: ${only.stepH})`).toBe(0);

  // ⑵ ★모서리 — 오른쪽 아래 끝
  await reset();
  const c = await dragHoldSteps(page, geo, geo.wRight - DEPTH, geo.wBottom - DEPTH, HOLD);
  expect(c.t1.st, `★전제 — 모서리가 세로 최대에 안 닿았다 (잰 값: ${c.t1.st} · 최대 ${c.t1.maxT})`).toBeLessThan(c.t1.maxT);
  expect(c.t1.sl, `★전제 — 모서리가 가로 최대에 안 닿았다 (잰 값: ${c.t1.sl} · 최대 ${c.t1.maxL})`).toBeLessThan(c.t1.maxL);

  // ★주 단언 ⒜ — ★둘이 «동시에» 돈다
  expect(c.nzV, `모서리 — 세로가 돌았다 (잰 값: 0 아닌 세로 프레임 ${c.nzV} / ${c.frames})`).toBeGreaterThan(3);
  expect(c.nzH, `모서리 — ★가로도 «같이» 돌았다 (잰 값: 0 아닌 가로 프레임 ${c.nzH} / ${c.frames})`).toBeGreaterThan(3);
  // ★주 단언 ⒝ — 한 끌기 안에서 두 축 걸음이 같다(같은 EDGE_STEP · 같은 깊이) ★프레임률과 무관
  expect(c.stepV, `모서리 ★세로 걸음 vs 가로 걸음 (잰 값: 세로 ${c.stepV} · 가로 ${c.stepH})`).toBe(c.stepH);
  // ★주 단언 ⒞ — ★세로 걸음이 「세로만」일 때보다 ★두 배가 아니다 (발주 5 의 그 문장)
  expect(c.stepV / only.stepV, `★모서리 세로 걸음 ÷ 「세로만」 세로 걸음 (잰 값: ${c.stepV} / ${only.stepV} = ${(c.stepV / only.stepV).toFixed(3)} · ★2.0 이면 두 배)`).toBeLessThan(1.5);
});
