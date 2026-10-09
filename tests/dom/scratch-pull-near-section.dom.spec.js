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
