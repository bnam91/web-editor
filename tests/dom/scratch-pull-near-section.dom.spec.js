/* scratch-pull-near-section.dom.spec.js — 「당긴 것은 ★섹션에서 안 멀어진다」
 *
 * 현빈 2026-10-09 ① 원문:
 *   「스크래치패드 링크 더블클릭 → 스파이더맨 거미줄처럼 스크래치패드를 섹션 옆에 당기기.
 *     ★원래 좌표에 다른 스크래치패드 있거나 ★높이 문제로 밀려 다른 위치로 가 이상해지는 이슈 있어도
 *     ★섹션에서는 안 멀어져야 한다.」
 *   ⇒ 당기기 자체는 2026-09-30 부터 ★이미 돈다(tests/dom/scratch-link-pull). 여기서 재는 것은
 *      «밀렸을 때 ★얼마나 멀어지나» 하나다.
 *
 * ★무엇을 «멀어짐»으로 재나 — 셋을 같이 찍고, 단언은 앞의 둘에 건다.
 *   ⑴ dyGap  = 당긴 장과 섹션의 «세로 범위» 사이 빈틈(겹치면 0). ★0 이면 「섹션 ★옆」이다.
 *   ⑵ gap    = 두 직사각형의 ★최단 거리. 세로가 겹치면 이 값은 PULL_GAP 그 자체다.
 *   ⑶ lineLen= ★화면에 그려지는 연결선의 길이(섹션 세로변 중앙 ↔ 붙는 점). 사람이 보는 멀어짐.
 *   ★상한은 ★손으로 박지 않는다 — ★같은 장면에서 «막는 것을 뺀 채» 한 번 당겨 그 값을 재고(base),
 *     막은 뒤의 값을 그 base 와 견준다. 그래서 이 파일에는 거리 상수가 ★하나도 없다.
 *
 * ★핀 판(a3556b936f8f)에서 잰 값 — 이 파일의 빨강 근거(⚰️ 고치기 전 · ★--repeat-each=5 에서 전부 한 값):
 *                      dyGap   gap    centerDist  lineLen   ⟵ 막는 것을 «뺀» 같은 장면(base)
 *   N1 막힌 칼럼 5장   ★360   360.8    437.9      534.6     (0 / 24 / 124.0 / 130.3)
 *   N2 키 큰 장        ★272   273.1    585.3      683.3     (0 / 24 / 159.3 / 235.3)
 *   N3 그룹 묶음       ★136   138.1    330.2      406.7     (0 / 24 / 124.0 /  74.0)
 *   N4·N5 는 ★초록이었다(그물·보존 — 아래 주석). 15 빨강 / 10 초록 (5시험 × 5회).
 *
 * ⚠️★계측기 결함 하나를 ★쓰기 전에 잡았다(2026-10-09) — 처음 판에서는 `lineLen` 이 ★옛 선을 쟀다.
 *   같은 장면의 base.lineLen 이 130.3 과 ★600 둘로 갈렸고, 600 은 «당기기 ★전» 선 길이였다.
 *   ⇒ `LINE_FRESH` 로 «새 자리에 다시 그려짐»을 기다린 뒤에 잰다. ★위 수는 ★고친 자로 잰 것이다.
 *
 * ★양성대조(고친 뒤에 다시 빨강을 보는 자리) — ⛔판을 HEAD 로 쓰지 마라:
 *     mkdir -p /tmp/pull-pin && git archive a3556b936f8f js css | tar -x -C /tmp/pull-pin
 *     PULL_PIN=/tmp/pull-pin npx playwright test \
 *       --config=tests/dom/playwright.dom.config.js scratch-pull-near-section
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js scratch-pull-near-section
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.pullnear.test';
const BASE = process.env.PULL_PIN || REPO;
if (process.env.PULL_PIN) console.warn(`[pull-near] ★양성대조 모드 — 원본을 ${BASE} 에서 읽는다`);
const LINK_JS = fs.readFileSync(path.join(BASE, 'js', 'scratchpad-link.js'), 'utf8');

/* 앱의 층위를 그대로 옮긴다(scratch-link-pull 과 같은 꼴 — 선 SVG 가 섹션 «앞»이고 클릭을 안 받는다). */
const CSS = `
  * { box-sizing: border-box; } body { margin: 0; }
  #canvas-wrap { position: relative; width: 1600px; height: 2200px; overflow: hidden; }
  #canvas-scaler { position: relative; width: 1600px; height: 2200px; }
  #canvas { position: relative; width: 400px; }
  .spacer { position: relative; width: 400px; }
  .section-block { position: relative; width: 400px; background: #ddd; }
  .spl-edges { position: absolute; top: 0; left: 0; z-index: 90; pointer-events: none; overflow: visible; }
  .scratch-item { position: absolute; z-index: 100; background: #8ad; border: 0; }
`;

/** 장면 하나를 HTML 로. 전부 ★인라인 자리/크기 — _pullDest 가 style.left/top 을 읽는다. */
function bodyOf(sc) {
  const items = sc.items.map(it => `<div class="scratch-item" id="el_${it.id}" data-scratch-id="${it.id}"`
    + (it.group ? ` data-scratch-group="${it.group}"` : '')
    + ` style="left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;">${it.id}</div>`).join('\n');
  const links = sc.items.filter(it => it.link).map(it => `${it.id}:0`).join(',');
  return `<div id="canvas-wrap"><div id="canvas-scaler">
  <div id="canvas">
    <div class="spacer" style="height:${sc.secTop}px;"></div>
    <div class="section-block" id="sec1" data-ref-links="${links}" style="height:${sc.secH}px;"></div>
  </div>
  ${items}
</div></div>`;
}

/* 스크래치 쪽 대역 — 자리·저장·되돌리기는 이 검사의 관심이 아니다(scratch-pad.js 몫).
   ⛔애니메이션 시간 0 — 재는 것은 «어디로 가나»다. ★_scratchAnimateItemsTo(묶음)도 같이 싣는다
     (안 실으면 그룹 당기기가 NO_API 로 조용히 통과한다 — 「뜬다」≠「맞게 돈다」). */
const STUBS = (sc) => `
  window.currentZoom = 100;
  window.__items = {};
  ${sc.items.map(it => `window.__items['${it.id}'] = { id: '${it.id}', x: ${it.x}, y: ${it.y}, w: ${it.w},
      el: document.getElementById('el_${it.id}') };`).join('\n')}
  window._scratchItemById = (id) => window.__items[id] || null;
  window._scratchSaveSoon = () => {};
  window.pushHistory = () => {};
  window.__moves = [];
  window.__put = (id, x, y) => {
    const it = window.__items[id];
    if (!it) return false;
    if (Math.abs(x - it.x) < 1 && Math.abs(y - it.y) < 1) return false;
    window.__moves.push({ id, x, y });
    it.x = x; it.y = y; it.el.style.left = x + 'px'; it.el.style.top = y + 'px';
    return true;
  };
  window._scratchAnimateItemTo = (id, x, y, opts) => {
    const moved = window.__put(id, x, y);
    if (moved) window.__items[id].linkDy = opts && opts.linkDy;
    return { ok: true, moved };
  };
  window._scratchAnimateItemsTo = (moves) => {
    let n = 0;
    for (const m of moves) if (window.__put(m.id, m.x, m.y)) { n++; window.__items[m.id].linkDy = m.linkDy; }
    return { ok: true, moved: n > 0 };
  };
`;

/** 같은 page 를 장면만 바꿔 다시 띄운다(base 와 막힌 판을 ★같은 기하에서 재려면 두 번 띄워야 한다). */
async function boot(page, state, sc) {
  state.sc = sc;
  if (!state.routed) {
    state.routed = true;
    await page.route(`${ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__harness.html') {
        return route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
            <body>${bodyOf(state.sc)}<script>${STUBS(state.sc)}</script>
            <script src="/js/scratchpad-link.js"></script></body></html>`,
        });
      }
      if (url.pathname === '/js/scratchpad-link.js') {
        return route.fulfill({ contentType: 'application/javascript', body: LINK_JS });
      }
      return route.fulfill({ status: 404, body: '' });
    });
    page.on('pageerror', (e) => state.errs.push(String(e)));
  }
  await page.goto(`${ORIGIN}/__harness.html`);
  // _boot 은 setTimeout(200) 뒤 — 선이 그려지기를 «산출물»로 기다린다(⛔고정 대기 금지)
  await page.waitForFunction(() => !!document.querySelector('#link-edges line'), null, { timeout: 8000 });
}

/* 선의 중간점 — ★그려진 선에서 뽑는다(내가 계산한 값이 아니다). 묶음이면 선은 하나다. */
const MID = () => {
  const ln = document.querySelector('#link-edges line');
  if (!ln) return null;
  const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
  const x1 = +ln.getAttribute('x1'), y1 = +ln.getAttribute('y1');
  const x2 = +ln.getAttribute('x2'), y2 = +ln.getAttribute('y2');
  return { x: sc.left + (x1 + x2) / 2, y: sc.top + (y1 + y2) / 2, len: Math.hypot(x2 - x1, y2 - y1) };
};

/* ★멀어짐을 재는 자 ★한 벌 — 시험이 보는 수는 전부 여기서 나온다(⛔시험마다 따로 세지 마라).
     ids = 당겨지는 장(들). 묶음이면 그 겉 상자로 잰다. */
const DIST = (ids) => {
  const R = (el) => el.getBoundingClientRect();
  const s = R(document.getElementById('sec1'));
  const rs = ids.map(id => R(document.querySelector(`.scratch-item[data-scratch-id="${id}"]`)));
  const box = {
    left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)),
    top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)),
  };
  const dx = Math.max(s.left - box.right, box.left - s.right, 0);   // 가로 빈틈(겹치면 0)
  const dy = Math.max(s.top - box.bottom, box.top - s.bottom, 0);   // 세로 빈틈(겹치면 0)
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const nx = Math.min(Math.max(cx, s.left), s.right), ny = Math.min(Math.max(cy, s.top), s.bottom);
  const ln = document.querySelector('#link-edges line');
  return {
    dyGap: Math.round(dy * 10) / 10,
    gap: Math.round(Math.hypot(dx, dy) * 10) / 10,
    centerDist: Math.round(Math.hypot(cx - nx, cy - ny) * 10) / 10,
    lineLen: ln ? Math.round(Math.hypot(+ln.getAttribute('x2') - +ln.getAttribute('x1'),
      +ln.getAttribute('y2') - +ln.getAttribute('y1')) * 10) / 10 : null,
    pos: ids.reduce((o, id) => {
      const e = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`);
      o[id] = [parseFloat(e.style.left), parseFloat(e.style.top)]; return o;
    }, {}),
    secH: Math.round(s.height),
  };
};

/* ★★선이 «새 자리로 다시 그려졌나» — ⛔이걸 안 기다리면 lineLen 이 ★옛 선을 잰다.
     실측(핀 판 ×5, 2026-10-09): 같은 장면의 base.lineLen 이 130.3 과 ★600(=당기기 ★전» 선 길이)
     둘로 갈렸다. 선은 scratchpad-link.js 가 rAF 로 다시 그린다 ⇒ ★산출물을 기다린다(⛔고정 대기 아님).
   판정 = 선의 첫 끝점이 «당긴 묶음의 겉상자 가로 범위 안 · 세로 중앙»에 있다.
     한 장이면 붙는 점이 «중심», 묶음이면 «가까운 세로변 중앙» — ★둘 다 이 술어를 만족한다. */
const LINE_FRESH = (ids) => {
  const ln = document.querySelector('#link-edges line');
  if (!ln) return false;
  const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
  const rs = ids.map(id => document.querySelector(`.scratch-item[data-scratch-id="${id}"]`).getBoundingClientRect());
  const L = Math.min(...rs.map(r => r.left)) - sc.left, R = Math.max(...rs.map(r => r.right)) - sc.left;
  const T = Math.min(...rs.map(r => r.top)) - sc.top, B = Math.max(...rs.map(r => r.bottom)) - sc.top;
  const x1 = +ln.getAttribute('x1'), y1 = +ln.getAttribute('y1');
  return x1 >= L - 1.5 && x1 <= R + 1.5 && Math.abs(y1 - (T + B) / 2) <= 1.5;
};

/** 장면을 띄우고 «선을 더블클릭»해 당긴 뒤 거리를 잰다. */
async function pullAndMeasure(page, state, sc, ids) {
  await boot(page, state, sc);
  const mid = await page.evaluate(MID);
  expect(mid, '★선을 화면에서 못 찾았다 — 아래 단언이 전부 «다른 이유»로 돌아간다').not.toBeNull();
  await page.mouse.dblclick(mid.x, mid.y);
  await expect.poll(() => page.evaluate(() => window.__moves.length),
    { timeout: 3000, message: '★더블클릭이 당기기를 부르지 않았다' }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(LINE_FRESH, ids),
    { timeout: 3000, message: '★당긴 뒤 선이 새 자리로 다시 안 그려졌다 — lineLen 이 «옛 선»이 된다' }).toBe(true);
  return page.evaluate(DIST, ids);
}

/* ─── 장면들 ───────────────────────────────────────────────────────────
   공통: 섹션 400 폭. 당기는 자리 x = 섹션 오른쪽 변 + PULL_GAP. 막는 것은 ★그 칼럼에 둔다. */

/** ⑴ 막힌 칼럼 — 당겨 갈 자리 위에 «남의 스크래치» 다섯이 줄줄이 서 있다(현빈 「원래 좌표에 다른 스크래치패드」). */
const COLUMN = (withBlockers) => ({
  secTop: 0, secH: 200,
  items: [
    { id: 's1', x: 900, y: 40, w: 200, h: 120, link: true },
    ...(withBlockers ? [0, 112, 224, 336, 448].map((y, i) => ({ id: 'b' + i, x: 424, y, w: 200, h: 100 })) : []),
  ],
});

/** ⑵ 키 큰 장 — 당기는 장이 섹션보다 ★3배 키가 커서, 섹션 ★아래쪽을 막는 것 하나에도 통째로 밀려난다. */
const TALL = (withBlockers) => ({
  secTop: 400, secH: 200,
  items: [
    { id: 's1', x: 900, y: 40, w: 200, h: 600, link: true },
    ...(withBlockers ? [{ id: 'b0', x: 424, y: 560, w: 200, h: 300 }] : []),
  ],
});

/** ⑶ 그룹 묶음 — 셋이 한 그룹(선 1개·전원 이동). 그 칼럼이 막혀 있다. */
const GROUP = (withBlockers) => ({
  secTop: 0, secH: 200,
  items: [
    { id: 'g1', x: 900, y: 40, w: 200, h: 100, group: 'gX', link: true },
    { id: 'g2', x: 900, y: 160, w: 200, h: 100, group: 'gX', link: true },
    { id: 'g3', x: 900, y: 280, w: 200, h: 100, group: 'gX', link: true },
    ...(withBlockers ? [0, 112, 224].map((y, i) => ({ id: 'b' + i, x: 424, y, w: 200, h: 100 })) : []),
  ],
});

/* ─── 시험 ──────────────────────────────────────────────────────────── */

function expectNear(got, base, what) {
  /* ★상한의 근거 = «같은 장면에서 막는 것을 뺀 채» 잰 값(base). ⛔손으로 박은 수가 아니다. */
  expect(got.dyGap, `★${what}: 세로로 섹션에서 ${got.dyGap}px 떨어졌다 — 「섹션 옆」이 아니다`
    + ` (base dyGap=${base.dyGap} · got=${JSON.stringify(got)})`).toBe(base.dyGap);
  expect(got.gap, `★${what}: 섹션과의 최단거리 ${got.gap}px — 막는 것이 없을 때(${base.gap}px)보다 멀어졌다`)
    .toBeLessThanOrEqual(base.gap + 1);
  /* ★그려지는 선 길이의 상한 — 「옛 자리 + ★섹션 한 키」. 섹션은 세로로 쌓이므로 한 키를 넘어가면
     그 선은 «이웃 섹션»의 것으로 읽힌다. secH 도 ★장면에서 재서 쓴다. */
  expect(got.lineLen, `★${what}: 연결선이 ${got.lineLen}px — 상한 ${base.lineLen}+${base.secH} 를 넘었다`)
    .toBeLessThanOrEqual(base.lineLen + base.secH);
  /* ★「멀어지지 않게」 고치면서 ★위쪽으로 내보내는 길이 열렸다 — 스케일러 ★밖(음수 top)은
     화면에서 ★사라지는 자리다. ⛔이 칸이 없으면 「후보에서 음수 제외」를 지워도 조용히 초록이다(M4). */
  for (const [id, p] of Object.entries(got.pos)) {
    expect(p[1], `★${what}: ${id} 가 스케일러 ★위쪽 밖(top=${p[1]})으로 갔다 — 화면에서 사라진다`)
      .toBeGreaterThanOrEqual(0);
  }
}

test('N1 ★막힌 칼럼 다섯 — 밀려도 섹션에서 «안 멀어진다»', async ({ page }) => {
  const state = { errs: [], routed: false };
  const base = await pullAndMeasure(page, state, COLUMN(false), ['s1']);
  expect(base.dyGap, '전제 — 막는 것이 없으면 섹션 «옆»에 붙는다').toBe(0);
  const got = await pullAndMeasure(page, state, COLUMN(true), ['s1']);
  expect(state.errs).toEqual([]);
  console.log(`[N1] base=${JSON.stringify(base)}\n[N1] got =${JSON.stringify(got)}`);
  expectNear(got, base, '막힌 칼럼');
});

test('N2 ★키 큰 장 — 「높이 문제로 밀려」도 섹션에서 «안 멀어진다» (현빈 ① 둘째 까닭)', async ({ page }) => {
  const state = { errs: [], routed: false };
  const base = await pullAndMeasure(page, state, TALL(false), ['s1']);
  expect(base.dyGap, '전제 — 막는 것이 없으면 섹션 «옆»에 붙는다').toBe(0);
  const got = await pullAndMeasure(page, state, TALL(true), ['s1']);
  expect(state.errs).toEqual([]);
  console.log(`[N2] base=${JSON.stringify(base)}\n[N2] got =${JSON.stringify(got)}`);
  expectNear(got, base, '키 큰 장');
});

test('N3 ★그룹 묶음도 — 선 하나로 전원이 오고, 섹션에서 «안 멀어진다»', async ({ page }) => {
  const state = { errs: [], routed: false };
  const ids = ['g1', 'g2', 'g3'];
  const base = await pullAndMeasure(page, state, GROUP(false), ids);
  expect(base.dyGap, '전제 — 막는 것이 없으면 묶음이 섹션 «옆»에 붙는다').toBe(0);
  const got = await pullAndMeasure(page, state, GROUP(true), ids);
  expect(state.errs).toEqual([]);
  console.log(`[N3] base=${JSON.stringify(base)}\n[N3] got =${JSON.stringify(got)}`);
  /* 전제 — 묶음은 ★선 하나로 ★전원이 왔다(그러지 않으면 아래 거리는 «다른 것»을 잰다) */
  const rel = (p) => ids.map(id => [p[id][0] - p[ids[0]][0], p[id][1] - p[ids[0]][1]]);
  expect(rel(got.pos), '★묶음이 흩어졌다 — 상대 배치가 안 지켜졌다').toEqual(rel(base.pos));
  expectNear(got, base, '그룹 묶음');
});

/* ★★음성대조 둘 — 「상한」을 넣은 자가 ★비켜 앉기를 ★끄지 않았음을 문다.
   ⛔이 둘이 없으면 `_pullDest` 가 「언제나 섹션 위변」을 돌려주는 변이가 N1~N3 를 ★전부 초록으로
     통과한다(그 변이는 현빈의 옛 요구 「겹치지 않게」를 죽인다). */
test('N4 ★★비켜 앉기는 «여전히» 돈다 — 한 장이 막으면 그 아래로 (상한 안쪽)', async ({ page }) => {
  const state = { errs: [], routed: false };
  /* 막는 것 ★하나(섹션 위쪽 90px) — 상한 안에서 비켜 앉을 자리가 ★있는 판이다. */
  const sc = {
    secTop: 0, secH: 200,
    items: [
      { id: 's1', x: 900, y: 40, w: 200, h: 120, link: true },
      { id: 'b0', x: 424, y: 0, w: 200, h: 90 },
    ],
  };
  const got = await pullAndMeasure(page, state, sc, ['s1']);
  expect(state.errs).toEqual([]);
  const r = await page.evaluate(() => {
    const q = (id) => { const b = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`).getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    return { s1: q('s1'), b0: q('b0') };
  });
  console.log(`[N4] got =${JSON.stringify(got)} s1=${JSON.stringify(r.s1)}`);
  const over = r.s1.x < r.b0.x + r.b0.w && r.b0.x < r.s1.x + r.s1.w
            && r.s1.y < r.b0.y + r.b0.h && r.b0.y < r.s1.y + r.s1.h;
  expect(over, `★막는 것 위에 포개졌다 — 비켜 앉기가 죽었다. s1=${JSON.stringify(r.s1)} b0=${JSON.stringify(r.b0)}`)
    .toBe(false);
  expect(r.s1.y, '★막는 것 아래로 비켜 앉아야 한다').toBeGreaterThanOrEqual(r.b0.y + r.b0.h);
  expect(got.dyGap, '★비켜 앉고도 섹션 «옆»이어야 한다').toBe(0);
});

test('N5 ★막는 것이 없으면 자리가 «한 픽셀도» 안 바뀐다 (옛 동작 보존)', async ({ page }) => {
  const state = { errs: [], routed: false };
  const got = await pullAndMeasure(page, state, COLUMN(false), ['s1']);
  expect(state.errs).toEqual([]);
  const r = await page.evaluate(() => {
    const s = document.getElementById('sec1').getBoundingClientRect();
    const i = document.querySelector('.scratch-item[data-scratch-id="s1"]').getBoundingClientRect();
    return { secTop: Math.round(s.top), itTop: Math.round(i.top), secRight: Math.round(s.right), itLeft: Math.round(i.left) };
  });
  console.log(`[N5] ${JSON.stringify(r)} got=${JSON.stringify(got)}`);
  // ★섹션 위변 맞춤 = 2026-09-30 부터의 자리다. 이 검사가 그것을 못박는다.
  expect(r.itTop, '★막는 것이 없는데 섹션 위변 맞춤이 아니다').toBe(r.secTop);
  expect(r.itLeft, '★섹션 오른쪽 변 바깥 PULL_GAP 자리가 아니다').toBeGreaterThan(r.secRight);
});

/* ══ ⑤ 옆으로도 겨룬다 — 현빈 2026-10-10 ════════════════════════════════════════════
 * 원문: 「★이미 당겨지는 자리에 다른 스크래치패드가 있으면 ★y값이 내려가는 게 나을지
 *        ★x값이 조절되는 게 나을지 ★비교를 해서 당겨지면 좋겠다」
 * ★★이 기능의 뜻 = ★「아래 대신 옆」이 ★아니라 ★★«겹친 채 앉는 일을 줄인다»다.
 *   ★옛 길은 비켜 앉을 자리가 ★하나도 없으면 ★막힌 제자리로 돌아가 ★★겹쳐 앉았다(①의 «겹침＜멀어짐» 선택).
 * ★★규칙 = ★«막는 것 ★하나를 지나간다». ⛔맨숫자 상한이 ★아니다 —
 *   ★상한을 200 으로 뒀더니 ★기본 패드 폭(220)에서 ★한 번도 안 섰다(gap = 폭＋36 = 256). 그 사고를 피한 꼴이다.
 * ⛔단언에 ★구현의 식을 ★그대로 쓰지 않는다 — ★항등식이 된다.
 *   ⇒ ★«자리를 얻었나 · ★몇 칸인가»로 잰다.
 * ★★⚰️2026-10-10 — 이 줄은 옛 구현식 `PULL_GAP+STACK_GAP+b.w` 를 가리켰다. ★그 식은 ★지워졌다:
 *   ★★«한 칸»을 ★거리로 재면 ★막는 것이 ★칼럼에 ★딱 붙은 경우(d=0)만 맞았다 ⇒ ★★수(지나간 칼럼)로 ★바꿨다.
 *   ★★그 흠을 ★★X0~X4 가 ★못 봤다 — ★표본이 ★전부 ★d=0 이었다. ⇒ ★★X5 가 ★그 축을 ★흔든다. */
const XGAP = 12;        // STACK_GAP — 장면이 쓰는 값(⛔구현에서 끌어오지 않는다)
const XCOL0 = 424;      // 섹션 오른쪽 변(400) ＋ PULL_GAP(24) = 당기는 칼럼
const XPULL = 24;       // PULL_GAP — 장면이 쓰는 값(⛔구현에서 끌어오지 않는다)
const XPAD_W = 200;     // 당기는 패드 s1 의 폭 — ★아래 장면이 ★그렇게 짓는다
/* ★★⒞ 의 표본을 ★★«선에서 뽑는다» — ⛔`600` 같은 ★맨숫자를 ★박지 않는다(지디 판정 2026-10-10).
   ★까닭 = ★오늘 ★맨숫자 상한을 ★두 번 틀렸다(★내 200 · ★지디의 2×) ⇒ ★표본도 ★같은 병에 걸린다.
   ★★한 칸의 gap = 막는것폭 ＋ (PULL_GAP ＋ STACK_GAP) ⇒ ★천장 걸리는 ★경계폭 = 배수×패드폭 − 그 합.
   ⚠️★★이 식은 ★«표본을 ★고르는» 데만 쓴다 — ★★단언은 ★«자리를 얻었나»로만 한다(★항등식 피하기).
   ★★그리고 ★이 배수(3)가 ★제품과 ★갈리면 ★★아래 ★두 표본 중 ★하나가 ★빨개진다 = ★자가 ★제 전제를 ★잰다. */
const X_CEIL_MULT = 3;
const XBOUND = X_CEIL_MULT * XPAD_W - (XPULL + XGAP);   // 경계폭 — 이보다 넓으면 천장이 막는다
const XB_SEAT = XBOUND - 24;    // 경계 ★안쪽 — ★앉아야 한다
const XB_OVER = XBOUND + 24;    // 경계 ★바깥 — ★앉지 못해야 한다

/** 막는 것 다섯을 ★세로로 빽빽이 — ★y 로 비킬 자리를 ★없앤다(그래야 x 가 재어진다). */
const XCOL = (bw, n = 5) => ({
  secTop: 0, secH: 200,
  items: [
    /* ★s1 의 ★처음 자리는 ★막는 칼럼 ★바깥에 둔다 — ⛔넓은 표본(경계 쌍)에서 ★겹치면
       ★「원래 겹쳐 있었다」가 ★결과에 섞인 것인지 ★가릴 수 없다. ★좁은 표본의 자리(900)는
       ★그대로 둔다(★X0·X1·X2 장면 ★무변 — bw 400 까지는 424＋bw＋40 < 900). */
    { id: 's1', x: Math.max(900, XCOL0 + bw + 40), y: 40, w: XPAD_W, h: 120, link: true },
    ...Array.from({ length: n }, (_, i) => ({ id: 'b' + i, x: XCOL0, y: i * 112, w: bw, h: 100 })),
  ],
});
/** 몇 «칸» 옆으로 갔나 — 0=칼럼 그대로 · 1=막는 것 하나를 지남 · 2 이상=그 너머 */
function xSteps(got, bw) {
  const left = got.pos.s1[0];
  const one = XCOL0 + bw + XGAP;
  if (left <= XCOL0 + 2) return 0;
  if (Math.abs(left - one) <= 2) return 1;
  return left > one ? 2 : -1;
}

test('X0 ⒟전제 — 그 장면에서 막는 것이 ★정말 막는다(★안 그러면 아래 단언이 헛돈다)', async ({ page }) => {
  const state = { errs: [], routed: false };
  const got = await pullAndMeasure(page, state, XCOL(220), ['s1']);
  expect(state.errs).toEqual([]);
  const r = await page.evaluate(() => {
    const q = (id) => { const e = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`);
      return { x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: e.offsetWidth, h: e.offsetHeight }; };
    return { b0: q('b0'), b4: q('b4') };
  });
  console.log(`[X0] got=${JSON.stringify(got)} b0=${JSON.stringify(r.b0)}`);
  /* 제자리(칼럼 · 섹션 위변)가 ★막는 것에 ★덮여 있다 — 그래야 «비켜 앉기»가 돌 장면이다 */
  expect(r.b0.x <= XCOL0 && XCOL0 < r.b0.x + r.b0.w, '★b0 가 칼럼을 덮는다').toBe(true);
  expect(r.b0.y <= 0 && 0 < r.b0.y + r.b0.h, '★b0 가 섹션 위변 높이를 덮는다').toBe(true);
  expect(got.dyGap, '★그래도 섹션 «옆»이다(①)').toBe(0);
});

test('X1 ⒜★★한 칸은 ★막는 것 폭이 얼마든 ★선다 — 120·220·400 (⛔한 폭에서만 참이면 안 잰 것이다)', async ({ page }) => {
  for (const bw of [120, 220, 400]) {
    const state = { errs: [], routed: false };
    const got = await pullAndMeasure(page, state, XCOL(bw), ['s1']);
    expect(state.errs, `bw ${bw}`).toEqual([]);
    const steps = xSteps(got, bw);
    console.log(`[X1 bw=${bw}] left=${got.pos.s1[0]} steps=${steps} dyGap=${got.dyGap} gap=${got.gap}`);
    expect(steps, `★bw ${bw} — ★한 칸 옆에 앉았다(잰 left=${got.pos.s1[0]})`).toBe(1);
    expect(got.dyGap, `★bw ${bw} — ①: 섹션 «옆»을 지킨다(세로로 안 멀어졌다)`).toBe(0);
  }
});

test('X2 ⒝★두 칸은 ★절대 안 간다 — 막는 것을 ★나란히 둘', async ({ page }) => {
  const bw = 200;
  const sc = {
    secTop: 0, secH: 200,
    items: [
      { id: 's1', x: 900, y: 40, w: 200, h: 120, link: true },
      ...Array.from({ length: 5 }, (_, i) => ({ id: 'a' + i, x: XCOL0, y: i * 112, w: bw, h: 100 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: 'c' + i, x: XCOL0 + bw + XGAP, y: i * 112, w: bw, h: 100 })),
    ],
  };
  const state = { errs: [], routed: false };
  const got = await pullAndMeasure(page, state, sc, ['s1']);
  expect(state.errs).toEqual([]);
  const steps = xSteps(got, bw);
  console.log(`[X2] left=${got.pos.s1[0]} steps=${steps}`);
  expect(steps, `★두 칸(${XCOL0 + 2 * (bw + XGAP)} 쯤)으로 ★안 간다 — 잰 left=${got.pos.s1[0]}`).not.toBe(2);
});

test('X3 ⒞★폭주 천장 — ★경계에서 ★뽑은 ★두 표본: ★안쪽은 앉고 ★바깥은 ★못 앉는다', async ({ page }) => {
  /* ★★왜 ★한 쌍인가 — ★표본 ★하나(옛 `bw=600`)는 ★★«천장이 ★더 높아진 판»만 잡고
     ★★«천장이 ★더 낮아진 판»은 ★★못 잡았다. ⇒ ★경계를 ★양쪽에서 ★집는다.
     ★이 쌍은 ★천장이 ★★«있나»가 아니라 ★★«어디 있나»를 잰다 — 2× 로 내려도, 4× 로 올려도 ★빨개진다. */
  console.log(`[X3] 경계폭=${XBOUND} 안쪽=${XB_SEAT} 바깥=${XB_OVER} (배수 ${X_CEIL_MULT} · 패드폭 ${XPAD_W})`);
  const st1 = { errs: [], routed: false };
  const g1 = await pullAndMeasure(page, st1, XCOL(XB_SEAT), ['s1']);
  expect(st1.errs, `bw ${XB_SEAT}`).toEqual([]);
  const s1 = xSteps(g1, XB_SEAT);
  console.log(`[X3 안쪽 bw=${XB_SEAT}] left=${g1.pos.s1[0]} steps=${s1} gap=${g1.gap}`);
  expect(s1, `★경계 ★안쪽(bw ${XB_SEAT})은 ★한 칸 앉는다 — 잰 left=${g1.pos.s1[0]}`).toBe(1);
  expect(g1.dyGap, '★①: 섹션 «옆»을 지킨다').toBe(0);

  const st2 = { errs: [], routed: false };
  const g2 = await pullAndMeasure(page, st2, XCOL(XB_OVER), ['s1']);
  expect(st2.errs, `bw ${XB_OVER}`).toEqual([]);
  const s2 = xSteps(g2, XB_OVER);
  console.log(`[X3 바깥 bw=${XB_OVER}] left=${g2.pos.s1[0]} steps=${s2} gap=${g2.gap}`);
  expect(s2, `★경계 ★바깥(bw ${XB_OVER})은 ★한 칸을 ★못 얻는다(천장) — 잰 left=${g2.pos.s1[0]}`).not.toBe(1);
});

/** 막는 칼럼을 ★칼럼에서 ★d 만큼 ★오른쪽으로 ★밀어 둔 장면 — ★실제 앱에서 ★흔한 꼴이다. */
const XCOLD = (bw, d, n = 5) => ({
  secTop: 0, secH: 200,
  items: [
    { id: 's1', x: Math.max(900, XCOL0 + d + bw + 40), y: 40, w: XPAD_W, h: 120, link: true },
    ...Array.from({ length: n }, (_, i) => ({ id: 'b' + i, x: XCOL0 + d, y: i * 112, w: bw, h: 100 })),
  ],
});

test('X5 ⒡★★막는 것이 ★칼럼에 ★딱 붙어 있지 ★않아도 ★한 칸은 ★선다 — d 를 ★흔든다', async ({ page }) => {
  /* ★★왜 이 칸이 ★있나 — ★X0~X4 표본은 ★★전부 ★d=0(막는 것이 ★당기는 칼럼에 ★딱 붙음)이었다.
     ★옛 구현(거리로 잰 「한 칸」)은 ★★d=0 에서만 ★통과했고 ★d≥1 에서 ★전부 ★거절했다 —
     ★그런데 ★d=1~199 에서도 ★그 막는 것은 ★집 자리를 ★여전히 ★막는다.
     ⇒ ★★옛 꼴은 ★실제 앱에서 ★거의 ★안 섰다. ★★이 칸이 ★그 축(d)을 ★흔들어 ★그 흠을 ★잡는다.
     ⛔「여러 d 에서 참」을 ★한 d 로 ★줄이지 마라 — ★그게 ★이 칸의 ★존재 이유다. */
  const bw = 220;
  for (const d of [0, 1, 20, 76, 150]) {
    const state = { errs: [], routed: false };
    const got = await pullAndMeasure(page, state, XCOLD(bw, d), ['s1']);
    expect(state.errs, `d ${d}`).toEqual([]);
    const left = got.pos.s1[0];
    const want = XCOL0 + d + bw + XGAP;          // ★그 칼럼 ★오른쪽 변 ＋ 틈 = ★한 칸
    console.log(`[X5 d=${d}] left=${left} 바라는자리=${want} dyGap=${got.dyGap} gap=${got.gap}`);
    expect(Math.abs(left - want) <= 2, `★d ${d} — ★한 칸 옆에 앉았다(잰 left=${left} · 바라는 ${want})`).toBe(true);
    expect(got.dyGap, `★d ${d} — ①: 섹션 «옆»을 지킨다`).toBe(0);
  }
});

test('X4 ⒠★음성대조 — 막는 것이 ★없으면 x 는 ★한 픽셀도 ★안 움직인다', async ({ page }) => {
  const state = { errs: [], routed: false };
  const got = await pullAndMeasure(page, state, { secTop: 0, secH: 200,
    items: [{ id: 's1', x: 900, y: 40, w: 200, h: 120, link: true }] }, ['s1']);
  expect(state.errs).toEqual([]);
  console.log(`[X4] left=${got.pos.s1[0]} (칼럼 ${XCOL0})`);
  expect(Math.abs(got.pos.s1[0] - XCOL0) <= 1, `★칼럼 그대로 — 잰 left=${got.pos.s1[0]}`).toBe(true);
  expect(got.dyGap, '★섹션 옆').toBe(0);
});
