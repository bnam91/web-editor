/* scratch-link-pull.dom.spec.js — 「연결선을 더블클릭하면 참고이미지가 섹션 옆으로 당겨진다」
 *
 * 현빈 2026-09-30: 「점선을 더블클릭하면 하나씩 당겨지는걸로 할까? 동적으로?」
 *   ＋「여러장인 경우 가져올때 겹치지 않게끔. 세로로 스택되면 밑에 다른거랑 또 겹칠 수 있으니
 *      동적으로 계산해서」
 *
 * ★재는 축 넷 — 전부 «진짜 브라우저 기하»다(소스 문자열이 아니다).
 *   ⑴ 당긴 자리가 «어느 스크래치와도 겹치지 않는다» — 그 섹션 것이든 남의 것이든 연결 안 된 것이든.
 *   ⑵ 선 위를 더블클릭하면 «그 한 장만» 온다(형제는 제자리).
 *   ⑶ ⛔선에서 먼 곳·섹션 «위»의 더블클릭은 «안» 먹는다.
 *      ★이것이 이 설계의 핵심 안전장치다: 연결선 SVG 는 z-index 90 으로 섹션보다 «앞»이라,
 *        선에 히트영역을 주면 블록 더블클릭(글자 인라인 편집)을 훔친다. 그래서 선은 끝까지
 *        pointer-events:none 이고, 판정은 «바깥틀에서 기하로» 한다. 그 사실을 여기서 문다.
 *   ⑷ 이미 와 있으면 «아무 일도 안 한다»(현빈 「또 더블클릭하면 아무 일 없음」).
 *
 * ★양성대조 — 작업 «직전» 판을 가리키면 ⑵⑷ 가 빨개진다(그 판엔 pullLink 가 아예 없다):
 *     mkdir -p /tmp/pull-before && git archive a5200c82 js css | tar -x -C /tmp/pull-before
 *     PULL_BEFORE=/tmp/pull-before npx playwright test \
 *       --config=tests/dom/playwright.dom.config.js scratch-link-pull
 *   ⛔판을 «HEAD» 로 쓰지 마라 — 고친 뒤엔 HEAD 가 곧 고친 판이라 대조가 전부 초록이 된다.
 *   ★실측(a5200c82 기준) — P1·P2·P4 빨강 / P0·P3 초록(그 둘은 «그물»이다, 아래 주석).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js scratch-link-pull
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BASE = process.env.PULL_BEFORE || REPO;
if (process.env.PULL_BEFORE) console.warn(`[scratch-link-pull] ★양성대조 모드 — 원본을 ${BASE} 에서 읽는다`);
const LINK_JS = fs.readFileSync(path.join(BASE, 'js', 'scratchpad-link.js'), 'utf8');

/* 앱의 층위를 그대로 옮긴다 — 연결선 SVG 가 섹션 «앞»(z 90)이라는 사실이 ⑶의 전제다. */
const CSS = `
  * { box-sizing: border-box; } body { margin: 0; }
  #canvas-wrap { position: relative; width: 1400px; height: 900px; overflow: hidden; }
  #canvas-scaler { position: relative; width: 1400px; height: 900px; }
  #canvas { position: relative; width: 400px; }
  .section-block { position: relative; width: 400px; background: #ddd; margin-bottom: 20px; }
  .spl-edges { position: absolute; top: 0; left: 0; z-index: 90; pointer-events: none; overflow: visible; }
  .scratch-item { position: absolute; z-index: 100; background: #8ad; }
`;

/* 섹션 하나(0,0 400×200) + 스크래치 셋.
 *   s1 : 섹션에 «연결» — 오른쪽 멀리 (900, 40) 200×120   → 당길 대상
 *   s2 : 섹션에 «연결» — 오른쪽 멀리 (900, 400) 200×120  → 형제(제자리여야 한다)
 *   s3 : ★연결 «안 된» 남의 이미지 — 당겨 갈 자리(424, 0) 를 «막고» 있다 200×90
 *        ⇒ s1 은 s3 아래로 비켜 앉아야 한다. 이게 현빈이 말한 「동적으로 계산」이다. */
const BODY = `
<div id="canvas-wrap">
  <div id="canvas-scaler">
    <div id="canvas">
      <div class="section-block" id="sec1" data-ref-links="s1:0,s2:0" style="height:200px;">
        <div class="text-block" id="blk1" style="height:60px;background:#fc6;">글자</div>
      </div>
      <div class="section-block" id="sec2" style="height:150px;"></div>
    </div>
    <div class="scratch-item" id="el_s1" data-scratch-id="s1" style="left:900px;top:40px;width:200px;height:120px;">s1</div>
    <div class="scratch-item" id="el_s2" data-scratch-id="s2" style="left:900px;top:400px;width:200px;height:120px;">s2</div>
    <div class="scratch-item" id="el_s3" data-scratch-id="s3" style="left:424px;top:0px;width:200px;height:90px;">s3(남의 것)</div>
  </div>
</div>`;

/* 스크래치 쪽 대역 — 자리·저장·되돌리기는 이 검사의 관심이 아니다(그건 scratch-pad.js 몫).
   ⛔애니메이션 시간은 0 으로 준다 — 이 검사가 재는 것은 «어디로 가나»이지 «어떻게 가나»가 아니다. */
const STUBS = `
  window.currentZoom = 100;
  window.__items = {
    s1: { id: 's1', x: 900, y: 40,  w: 200, el: document.getElementById('el_s1') },
    s2: { id: 's2', x: 900, y: 400, w: 200, el: document.getElementById('el_s2') },
    s3: { id: 's3', x: 424, y: 0,   w: 200, el: document.getElementById('el_s3') },
  };
  window._scratchItemById = (id) => window.__items[id] || null;
  window._scratchSaveSoon = () => {};
  window.pushHistory = () => {};
  window.__moves = [];
  window._scratchAnimateItemTo = (id, x, y, opts) => {
    const it = window.__items[id];
    if (!it) return { ok: false, reason: 'NOT_FOUND' };
    if (Math.abs(x - it.x) < 1 && Math.abs(y - it.y) < 1) return { ok: true, moved: false };
    window.__moves.push({ id, x, y, linkDy: opts && opts.linkDy });
    it.x = x; it.y = y;
    it.el.style.left = x + 'px'; it.el.style.top = y + 'px';
    return { ok: true, moved: true };
  };
`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
          <body>${BODY}<script>${STUBS}</script><script src="/js/scratchpad-link.js"></script></body></html>`,
      });
    }
    if (url.pathname === '/js/scratchpad-link.js') {
      return route.fulfill({ contentType: 'application/javascript', body: LINK_JS });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  // _boot 은 setTimeout(200) 뒤에 돈다 — 선이 그려지기를 «산출물»로 기다린다(고정 대기 금지)
  await page.waitForFunction(() => !!document.querySelector('#link-edges line'), null, { timeout: 5000 });
  return errs;
}

/* 선의 «중간점»(화면 좌표) — 내가 계산한 값이 아니라 «실제로 그려진» 선에서 뽑는다.
   ⛔문자열로 넘기지 마라 — playwright 의 evaluate 는 문자열을 «식»으로 보고 인자를 안 넘긴다
     (처음에 그렇게 썼고 id 가 undefined 가 되어 넷이 한꺼번에 빨갰다). */
function midOf(id) {
  const ln = [...document.querySelectorAll('#link-edges line')];
  const it = document.querySelector('.scratch-item[data-scratch-id="' + id + '"]').getBoundingClientRect();
  const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
  const icx = it.left + it.width / 2 - sc.left, icy = it.top + it.height / 2 - sc.top;
  const mine = ln.find(l => Math.abs(+l.getAttribute('x1') - icx) < 1.5 && Math.abs(+l.getAttribute('y1') - icy) < 1.5);
  if (!mine) return null;
  const x1 = +mine.getAttribute('x1'), y1 = +mine.getAttribute('y1');
  const x2 = +mine.getAttribute('x2'), y2 = +mine.getAttribute('y2');
  return { x: sc.left + (x1 + x2) / 2, y: sc.top + (y1 + y2) / 2 };
}

function rects() {
  const r = (id) => { const b = document.getElementById(id).getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { s1: r('el_s1'), s2: r('el_s2'), s3: r('el_s3'), sec: r('sec1') };
}

const OVERLAP = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* ⚠️P0·P3 은 «증상 계측기»가 아니다 — 작업 전에도 초록이다(P0 은 전제, P3 은 그때 기능이 아예
 *   없어서 훔칠 것도 없었다). 둘은 그물이다: 나중에 누가 선에 pointer-events 를 켜거나 잡는 폭을
 *   넓히면 그 자리에서 빨개진다. 증상을 재는 것은 P1·P2·P4 셋이고, 그 셋이 양성대조에서
 *   실제로 빨개진다(파일 머리말의 실측). */
test('P0 전제 — 연결선 둘이 실제로 그려지고, 선 레이어는 «클릭을 안 받는다»', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => ({
    lines: document.querySelectorAll('#link-edges line').length,
    pe: getComputedStyle(document.getElementById('link-edges')).pointerEvents,
    z: getComputedStyle(document.getElementById('link-edges')).zIndex,
  }));
  expect(errs).toEqual([]);
  expect(r.lines).toBe(2);
  // ★이 둘이 ⑶의 «까닭»이다 — 선이 섹션보다 앞인데 클릭을 안 받으므로 남의 더블클릭을 못 훔친다
  expect(r.pe).toBe('none');
  expect(Number(r.z)).toBe(90);
});

test('P1 ★선을 더블클릭하면 «그 한 장»이 섹션 옆으로 온다 — 형제는 제자리', async ({ page }) => {
  const errs = await boot(page);
  const before = await page.evaluate(rects);
  const mid = await page.evaluate(midOf, 's1');
  expect(mid, '★s1 의 연결선을 화면에서 못 찾았다 — 아래 단언이 전부 «다른 이유»로 돌아간다').not.toBeNull();
  await page.mouse.dblclick(mid.x, mid.y);
  const after = await page.evaluate(rects);
  const moves = await page.evaluate(() => window.__moves);
  expect(errs).toEqual([]);
  expect(moves.length, '★더블클릭이 당기기를 «한 번»만 불러야 한다').toBe(1);
  expect(moves[0].id).toBe('s1');
  // 섹션 오른쪽 변 바깥으로 왔다
  expect(after.s1.x).toBeGreaterThan(before.sec.x + before.sec.w);
  expect(after.s1.x).toBeLessThan(before.s1.x);
  // ★형제(s2)와 남의 것(s3)은 «한 픽셀도» 안 움직였다
  expect(after.s2).toEqual(before.s2);
  expect(after.s3).toEqual(before.s3);
});

test('P2 ★★당긴 자리가 «어느 스크래치와도» 겹치지 않는다 — 남의 이미지가 막고 있어도', async ({ page }) => {
  const errs = await boot(page);
  const mid1 = await page.evaluate(midOf, 's1');
  await page.mouse.dblclick(mid1.x, mid1.y);
  const afterOne = await page.evaluate(rects);
  expect(errs).toEqual([]);
  /* s3(남의 것)이 섹션 오른쪽 위를 막고 있다 ⇒ s1 은 그 아래로 비켜 앉아야 한다.
     ⛔「세로로 한 칸씩 쌓기」였다면 s3 을 못 보고 그 위에 포개진다 — 현빈이 지적한 바로 그 자리. */
  expect(OVERLAP(afterOne.s1, afterOne.s3),
    `★당긴 자리가 남의 이미지와 겹친다. s1=${JSON.stringify(afterOne.s1)} s3=${JSON.stringify(afterOne.s3)}`).toBe(false);
  expect(afterOne.s1.y).toBeGreaterThanOrEqual(afterOne.s3.y + afterOne.s3.h);

  // 이어서 형제(s2)도 당긴다 — 이번엔 «방금 온 s1» 까지 피해야 한다
  const mid2 = await page.evaluate(midOf, 's2');
  expect(mid2).not.toBeNull();
  await page.mouse.dblclick(mid2.x, mid2.y);
  const afterTwo = await page.evaluate(rects);
  expect(OVERLAP(afterTwo.s2, afterTwo.s1),
    `★두 번째로 당긴 것이 첫 번째와 겹친다. s2=${JSON.stringify(afterTwo.s2)} s1=${JSON.stringify(afterTwo.s1)}`).toBe(false);
  expect(OVERLAP(afterTwo.s2, afterTwo.s3), '★두 번째로 당긴 것이 남의 이미지와 겹친다').toBe(false);
});

test('P3 ⛔남의 더블클릭을 훔치지 않는다 — 선에서 먼 곳·블록 «위»에서는 안 먹는다', async ({ page }) => {
  const errs = await boot(page);
  const mid = await page.evaluate(midOf, 's1');
  // ㈎ 선에서 40px 떨어진 곳
  await page.mouse.dblclick(mid.x, mid.y + 40);
  const far = await page.evaluate(() => window.__moves.length);
  // ㈏ 블록 «위» — 선이 섹션 오른쪽 변에서 출발하므로 블록 내부를 지나지는 않지만,
  //    그 위에서의 더블클릭이 당기기로 새지 않는다는 것을 못박는다(글자 인라인 편집의 자리다).
  const blk = await page.evaluate(() => {
    const b = document.getElementById('blk1').getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.dblclick(blk.x, blk.y);
  const onBlock = await page.evaluate(() => window.__moves.length);
  expect(errs).toEqual([]);
  expect(far, '★선에서 40px 떨어진 더블클릭이 당기기를 불렀다 — 잡는 폭이 너무 넓다').toBe(0);
  expect(onBlock, '★블록 위 더블클릭이 당기기로 샜다 — 글자 편집이 죽는다').toBe(0);
});

/* ✔흔들림 고침 · 2026-10-02 (v0.9.5 맥 CI 빨강으로 이름표 → 고침, 지디 지시 「skip 으로 덮지 마라」).
 *   옛 이름표: 2026-10-01 전수 4번 중 2 빨강 · 단독 3번 중 1 · --repeat-each=12 중 1 · 꼴 = 당긴 뒤 midOf(s1) null.
 *   원인(진단 실측 2026-10-02, ×40 중 1 빨강을 잡아 찍음): 실패 순간 선은 옛 자리, 몇 ms 뒤엔 새 자리(524,162 = 상자 중심)에 있었다
 *     ⇒ 선이 rAF 로 «다시 그려지기 전에» 찾았다. 제품 결함이 아니라 시험이 산출물을 안 기다린 것. ⚠️CPU 늦춤(4·10배)으론 재현 안 됐다.
 *   고침 = 선이 새 자리에 그려질 때까지 expect.poll(3초). 고친 뒤 수는 커밋 본문. */
test('P4 ★이미 와 있으면 «아무 일도 안 한다» (현빈 「또 더블클릭하면 아무 일 없음」)', async ({ page }) => {
  const errs = await boot(page);
  const mid = await page.evaluate(midOf, 's1');
  await page.mouse.dblclick(mid.x, mid.y);
  const firstN = await page.evaluate(() => window.__moves.length);
  const restAt = await page.evaluate(rects);
  // 온 자리에서 «다시» 그 선을 더블클릭
  /* ★선이 «새 자리로 다시 그려진 뒤»에 찾는다(2026-10-02 고침). 선은 scratchpad-link.js 가 rAF 로 다시 그린다 —
     옮긴 «바로 다음» 읽으면 선이 아직 옛 자리라 midOf 가 null 이었다(진단 실측: 실패 순간 null, 몇 ms 뒤 같은 선이 새 자리 524,162 에 있었다).
     ⛔고정 대기 아님 — 다시 그려진 «산출물»을 기다린다. 3초 안에 안 그려지면 그건 진짜 빨강이다. */
  await expect.poll(() => page.evaluate(midOf, 's1'), { timeout: 3000, message: '★당긴 뒤 선이 새 자리로 다시 안 그려졌다' }).not.toBeNull();
  const mid2 = await page.evaluate(midOf, 's1');
  await page.mouse.dblclick(mid2.x, mid2.y);
  const secondN = await page.evaluate(() => window.__moves.length);
  const stillAt = await page.evaluate(rects);
  expect(errs).toEqual([]);
  expect(firstN).toBe(1);
  expect(secondN, '★이미 와 있는데 또 옮겼다 — 히스토리가 쌓이고 자리가 흔들린다').toBe(1);
  expect(stillAt.s1).toEqual(restAt.s1);
});
