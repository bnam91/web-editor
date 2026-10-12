/* scratch-group-link.dom.spec.js — 「그룹은 ★한 묶음이다」 (현빈 2026-10-09 신고 다섯)
 *
 * 현빈 원문(요지):
 *   ① 그룹설정 상태에서 섹션에 링크를 연결하면 「선이 그룹과 섹션이 연결되니 ★1개만 생겨야되는데
 *      그룹안의 스크래치패드마다 모두 선이 연결이 되어버려」
 *   ② 「링크 연결된 상태에서 그룹해제를 하면 ★그제서야 각각의 링크들이 연결되던가 해야되지 않겠어?」
 *   ③ 「스크래치패드가 5개있었고 ★5번째 스크래치패드를 삭제하면 4개가 되니 ★4개인 그룹이 계속 유지되어야해」
 *   ④ 「링크도 그룹인 경우 섹션과 링크가 ★1개의 선만 보이면 되는데 지금은 링크선을 ★각각 모두 언링크해줘야되는데」
 *   ⑤ 「그룹설정이 됐는데도 ★링크 선을 만지면 각각 당겨지는 문제가 있어」
 *
 * ★실앱에서 먼저 쟀다(CDP 9424 · 진짜 마우스/키 · 줌 40%) — 그 수가 이 파일의 기대값이다:
 *     ① 선 5 · 토큰 5   ② 해제하면 토큰 5→0(연결이 통째로 날아갔다)   ③ ✕ 한 번에 아이템 5→0 ＋ 死참조 토큰 5
 *     ④ ⛓ 를 ★5번 눌러야 0   ⑤ 더블클릭에 ★1/5장만 이동
 *   ⇒ 맞는 값: ① 선 1   ② 토큰 5 유지 · 선 1→5   ③ 아이템 4 · 그룹 멤버 4 · 토큰 4   ④ ⛓ 1번에 0   ⑤ 5장 전원
 *
 * ★무엇으로 재나 — 앱 통째로 헤드리스(bootApp = 실제 모듈·실제 마우스·실제 ⌘Z·실제 ⌘G/⌘⇧G).
 *   ⛔SPLink 만 떼어 얹는 하네스로는 ③(✕ 삭제)·②(⌘⇧G)를 못 잰다 — 그 둘은 js/scratch-pad.js 의 것이다.
 *   ★세는 자리 셋을 «한 곳»에서 정한다(아래 `snap`): 선 = `#link-edges line` · 토큰 = 전 섹션 refLinks 토큰 수 ·
 *     그룹 = `[data-scratch-group]` 값별 멤버. ⛔시험마다 따로 세지 마라(두 벌이 되면 수가 조용히 갈린다).
 *   ★그룹 id 값(`'g_'+Math.random()`)은 ★기대하지 않는다 — 존재와 «개수»로만 잰다.
 *
 * ★★음성대조가 ★장면 안에 있다 — 그룹 아닌 단독 둘(sp_s1·sp_s2). 「묶음으로 올린 것」이
 *   «그룹 아닌 것»까지 묶어 버리면 그 둘의 선·끊기가 빨개진다. (전부 그룹인 장면이면 그 변이가 조용히 통과한다.)
 *
 * ★양성대조 명부는 파일 끝 주석에 있다(어느 판에서 무엇이 빨강인가 — 실측 수).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js scratch-group-link
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* 그룹 다섯(g_t) ＋ ★그룹 아닌 둘. 자리는 캔버스 «오른쪽»으로 몰아 둔다 — 섹션 클릭이 안 가리게. */
const GROUP = ['sp_g1', 'sp_g2', 'sp_g3', 'sp_g4', 'sp_g5'];
const SOLO  = ['sp_s1', 'sp_s2'];
const ITEMS = [
  ...GROUP.map((id, i) => [id, 1500, 80 + i * 200, 'g_t']),
  ...SOLO.map((id, i) => [id, 1900, 80 + i * 200, undefined]),
];

/* ★세는 자 ★한 벌. 시험이 보는 수는 전부 여기서 나온다. */
const SNAP = () => ({
  lines: document.querySelectorAll('#link-edges line').length,
  dots: document.querySelectorAll('#link-edges .spl-edge-dot').length,
  boxes: document.querySelectorAll('#link-edges .spl-edge-group').length,
  tokens: [...document.querySelectorAll('#canvas .section-block')]
    .reduce((n, s) => n + (s.dataset.refLinks || '').split(',').filter(Boolean).length, 0),
  tokenIds: [...document.querySelectorAll('#canvas .section-block')]
    .flatMap(s => (s.dataset.refLinks || '').split(',').filter(Boolean).map(t => t.slice(0, t.lastIndexOf(':')))),
  groups: (() => {
    const m = {};
    document.querySelectorAll('.scratch-item[data-scratch-group]').forEach(e => {
      (m[e.dataset.scratchGroup] = m[e.dataset.scratchGroup] || []).push(e.dataset.scratchId);
    });
    return m;
  })(),
  itemIds: [...document.querySelectorAll('.scratch-item')].map(e => e.dataset.scratchId),
  collapsed: [...document.querySelectorAll('.scratch-item.spl-collapsed')].map(e => e.dataset.scratchId),
  pos: [...document.querySelectorAll('.scratch-item')].reduce((o, e) => {
    o[e.dataset.scratchId] = [parseFloat(e.style.left), parseFloat(e.style.top)]; return o;
  }, {}),
});
const snap = (page) => page.evaluate(SNAP);

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const secIds = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection({ skipDefaultBlock: true });
    window.addSection({ skipDefaultBlock: true });
    window.deselectAll?.();
    return [...c.querySelectorAll('.section-block:not([data-ghost])')].map(s => s.id);
  });
  await page.evaluate(async ({ px, items }) => {
    for (const [id, x, y, g] of items) await window._scratchAddAndSave(px, x, y, 180, g, id);
  }, { px: PX, items: ITEMS });
  // 손잡이가 «실제로 주입될 때까지» 산출물로 기다린다(⛔고정 대기 금지)
  await page.waitForFunction(() => document.querySelectorAll('.scratch-item .spl-btn-link').length === 7, null, { timeout: 15000 });
  return { errs, secIds };
}

/* ★누르기는 «화면 좌표 ＋ 무엇을 맞혔나 단언» 한 쌍이다.
   ⛔`locator.click()` 을 그냥 쓰지 마라(처음에 그렇게 썼다): 스크래치 카드는 자식(img·버튼) 위에서
     부모 `.scratch-item` 이 pointer 를 가로채고(「intercepts pointer events」), bootApp 직후엔 배율
     맞추기가 늦게 끝나 「element is not stable」로 ★아홉이 한꺼번에 30초 타임아웃이었다(실측).
   ⇒ ㉠ `waitStableRect` 로 «멈춘 뒤»의 자리를 받고 ㉡ `elementFromPoint` 로 «그 점이 정말 그것인가»를
     단언한 다음 ㉢ 진짜 마우스로 누른다. ⛔`force: true` 로 덮지 않는다 — 그러면 빗나간 클릭이 조용히 통과한다. */
async function hits(page, x, y, sel) {
  return page.evaluate(([px, py, s]) => {
    const e = document.elementFromPoint(px, py);
    return { ok: !!(e && e.closest(s)), got: e ? (e.className || e.tagName) : 'null' };
  }, [x, y, sel]);
}
async function scrollTo(page, sid) {
  await page.evaluate((s) => document.querySelector('.scratch-item[data-scratch-id="' + s + '"]')
    ?.scrollIntoView({ block: 'center', inline: 'center' }), sid);
}
/** 카드 «본체»를 누른다 = 고르기(그룹이면 공동선택). */
async function selectItem(page, sid) {
  await scrollTo(page, sid);
  const sel = `.scratch-item[data-scratch-id="${sid}"]`;
  const r = await waitStableRect(page, sel);
  const h = await hits(page, r.cx, r.cy, sel);
  expect(h.ok, `★${sid} 카드 한가운데(${r.cx},${r.cy})가 다른 것에 가렸다 — 맞은 것: ${h.got}`).toBe(true);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForTimeout(200);
}
/** 카드의 손잡이(.spl-btn-link · .spl-btn-cut · .spl-btn-fold · .scratch-close)를 누른다. */
async function clickBtn(page, sid, cls) {
  await scrollTo(page, sid);
  const card = `.scratch-item[data-scratch-id="${sid}"]`;
  await waitStableRect(page, card);
  const btn = page.locator(`${card} .${cls}`);
  await expect(btn, `전제 — ${sid} 에 .${cls} 손잡이가 있다`).toHaveCount(1);
  const r = await waitStableRect(page, `${card} .${cls}`);
  const h = await hits(page, r.cx, r.cy, `.${cls}`);
  expect(h.ok, `★${sid} 의 .${cls} 가 가렸다(${r.cx},${r.cy}) — 맞은 것: ${h.got}`).toBe(true);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForTimeout(250);
}

async function clickSection(page, secId) {
  const r = await page.evaluate((id) => {
    const s = document.getElementById(id); s.scrollIntoView({ block: 'center' });
    const b = s.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + Math.min(20, b.height / 2) };
  }, secId);
  await page.mouse.click(r.x, r.y);
}

/** 그룹(또는 단독)을 섹션에 연결한다 — 사람이 하는 길: 멤버 클릭(그룹 공동선택) → 🔗 → 섹션 클릭. */
async function linkVia(page, sid, secId) {
  await selectItem(page, sid);
  await clickBtn(page, sid, 'spl-btn-link');
  await clickSection(page, secId);
  await page.waitForTimeout(400);
}

/** 화면에 ★실제로 그려진 선의 중간점(화면 좌표) — ⛔내가 계산한 값이 아니다. */
async function lineMids(page) {
  return page.evaluate(() => {
    const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
    const k = (window.currentZoom || 100) / 100 || 1;
    return [...document.querySelectorAll('#link-edges line')].map(l => {
      const x1 = +l.getAttribute('x1'), y1 = +l.getAttribute('y1');
      const x2 = +l.getAttribute('x2'), y2 = +l.getAttribute('y2');
      return { x: sc.left + ((x1 + x2) / 2) * k, y: sc.top + ((y1 + y2) / 2) * k };
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════ */

test('G0 전제 — 장면이 섰다(그룹 5 · 단독 2 · 선 0 · 토큰 0)', async ({ page }) => {
  const { errs } = await setup(page);
  const s = await snap(page);
  expect(errs).toEqual([]);
  expect(s.itemIds.sort(), '참고이미지 일곱').toEqual([...GROUP, ...SOLO].sort());
  expect(Object.keys(s.groups), '그룹은 한 종류').toHaveLength(1);
  expect(Object.values(s.groups)[0].sort(), '멤버 다섯').toEqual([...GROUP].sort());
  expect(s.lines, '아직 연결 0 ⇒ 선 0').toBe(0);
  expect(s.tokens, '아직 연결 0 ⇒ 토큰 0').toBe(0);
});

test('G1 ★그룹을 연결하면 선은 «하나» (현빈 ① · 잰 값 5 → 1)', async ({ page }) => {
  const { errs, secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  const s = await snap(page);
  expect(errs).toEqual([]);
  expect(s.tokens, '전제 — 다섯 장이 다 연결됐다(토큰은 장당 하나 그대로)').toBe(5);
  expect(s.lines, `★그룹에 선이 ${s.lines}개 — 그룹과 섹션은 선 «하나»로 이어져야 한다(현빈 ①)`).toBe(1);
  expect(s.dots, '붙는 점도 하나').toBe(1);

  /* ★선의 «그룹 쪽 끝»이 ★묶음 겉상자의 «섹션 쪽 변»에 붙는다 — 가운데 한 장을 가리키지 않는다.
     ⛔이 단언이 없으면 「묶음도 중심에 붙인다」로 되돌려도 ★아무 검사도 안 빨개진다(실측 변이 M6 = 0건).
     그룹은 섹션 «오른쪽»에 있으므로 붙는 점 = 상자의 ★왼쪽 변. */
  const end = await page.evaluate(() => {
    const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
    const k = (window.currentZoom || 100) / 100 || 1;
    const toL = (v) => (v - sc.left) / k;
    const l = document.querySelector('#link-edges line');
    const r = [...document.querySelectorAll('.scratch-item[data-scratch-group]')].map(c => c.getBoundingClientRect());
    const left = Math.min(...r.map(b => b.left)), right = Math.max(...r.map(b => b.right));
    return { x1: +l.getAttribute('x1'), boxLeft: toL(left), boxRight: toL(right), boxCx: toL((left + right) / 2) };
  });
  expect(Math.abs(end.x1 - end.boxLeft),
    `★선의 그룹 끝이 묶음의 왼쪽 변이 아니다 — x1=${end.x1} · 변=${end.boxLeft} · 중심=${end.boxCx}`).toBeLessThan(1.5);
  expect(Math.abs(end.x1 - end.boxCx), '★가운데(= 한 장의 중심)에 붙었다').toBeGreaterThan(5);

  /* ★★음성대조 — 그룹 아닌 단독 둘은 «각자» 선을 갖는다. 묶는 자가 남의 것까지 묶으면 여기서 빨개진다. */
  await linkVia(page, 'sp_s1', secIds[1]);
  await linkVia(page, 'sp_s2', secIds[1]);
  const s2 = await snap(page);
  expect(s2.tokens, '토큰 일곱').toBe(7);
  expect(s2.lines, '★그룹 1 ＋ 단독 2 = 선 3(단독을 묶어 버리면 2가 된다)').toBe(3);
});

test('G2 ★끊기는 «한 번» (현빈 ④ · 잰 값 5번 → 1번)', async ({ page }) => {
  const { errs, secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  await linkVia(page, 'sp_s1', secIds[1]);
  expect((await snap(page)).tokens, '전제 — 여섯 토큰').toBe(6);

  await page.evaluate(() => window.deselectAll?.());
  await clickBtn(page, 'sp_g1', 'spl-btn-cut');      // ⛓ ★한 번
  await page.waitForTimeout(300);
  const s = await snap(page);
  expect(errs).toEqual([]);
  expect(s.tokenIds.sort(), `★⛓ 한 번에 그룹 다섯이 다 끊겨야 한다 — 남은 토큰: ${s.tokenIds.join(',')}`).toEqual(['sp_s1']);
  expect(s.lines, '그룹 선은 사라지고 단독 선 하나만').toBe(1);
  /* ★★음성대조 — 단독의 ⛓ 는 «자기 하나»만 끊는다(묶는 자가 과하면 여기가 아니라 위가 0이 된다) */
  await clickBtn(page, 'sp_s1', 'spl-btn-cut');
  await page.waitForTimeout(300);
  expect((await snap(page)).tokens, '단독도 끊긴다').toBe(0);

  /* ★끊기도 «이음매»를 안 뚫는다 — ⌘Z 한 번이면 방금 끊은 그것이 돌아온다.
     (끝 표본이 빠지면 이 되돌리기가 «다음 조작»에 먹히거나 한 칸 더 건너뛴다.) */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(600);
  expect((await snap(page)).tokenIds.sort(), '★⌘Z 한 번이 방금 끊은 단독 하나를 되돌린다').toEqual(['sp_s1']);
});

test('G3 ★★선을 당기면 그룹 «전원»이 온다 — 상대 배치 그대로 (현빈 ⑤ · 잰 값 1/5장)', async ({ page }) => {
  const { errs, secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForTimeout(400);
  const before = (await snap(page)).pos;

  const mids = await lineMids(page);
  expect(mids, '전제 — 그려진 선이 «하나»다(그 중간점을 누른다)').toHaveLength(1);
  await page.mouse.dblclick(mids[0].x, mids[0].y);
  await page.waitForTimeout(700);

  const after = (await snap(page)).pos;
  expect(errs).toEqual([]);
  const moved = GROUP.filter(id => before[id][0] !== after[id][0] || before[id][1] !== after[id][1]);
  expect(moved.length, `★그룹 ${GROUP.length}장 중 ${moved.length}장만 움직였다 — 전원이 함께 와야 한다(현빈 ⑤)`).toBe(GROUP.length);
  /* ★«상대 배치»가 그대로다 — 첫 장 기준 오프셋이 before 와 after 에서 같다 */
  const rel = (p) => GROUP.map(id => [p[id][0] - p[GROUP[0]][0], p[id][1] - p[GROUP[0]][1]]);
  expect(rel(after), '★당겨 온 뒤 그룹이 흩어졌다(상대 배치가 안 지켜졌다)').toEqual(rel(before));
  /* ★섹션 바깥으로 왔다 — 「그냥 흩어진 것」이 아니라 «당겨진» 것이다 */
  expect(after[GROUP[0]][0], '★섹션 쪽으로 가까워지지 않았다').toBeLessThan(before[GROUP[0]][0]);
  /* ★단독 둘은 «한 픽셀도» 안 움직였다 */
  for (const id of SOLO) expect(after[id], `★남의 이미지(${id})가 같이 끌려왔다`).toEqual(before[id]);
});

test('G3b ★당기기 ⌘Z 는 «한 걸음» — 전원이 제자리로', async ({ page }) => {
  const { secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForTimeout(400);
  const before = (await snap(page)).pos;
  const mids = await lineMids(page);
  await page.mouse.dblclick(mids[0].x, mids[0].y);
  await page.waitForTimeout(700);
  const t0 = (await snap(page)).tokens;

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(800);
  const s = await snap(page);
  for (const id of GROUP) expect(s.pos[id], `★⌘Z 한 번이 ${id} 를 제자리로 안 돌렸다`).toEqual(before[id]);
  /* ★★⌘Z 가 «연결»까지 같이 날리지 않는다 — 실앱에서 토큰이 5→4 로 줄던 자리다(N3). */
  expect(s.tokens, `★⌘Z 가 링크를 같이 지웠다(당기기 전 ${t0} → ${s.tokens})`).toBe(t0);
});

test('G4 ★그룹을 풀면 링크는 «각자» 남고 선이 갈라진다 (현빈 ② · 잰 값 토큰 5→0)', async ({ page }) => {
  const { errs, secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  expect((await snap(page)).lines, '전제 — 선 하나').toBe(1);

  await selectItem(page, 'sp_g3');   // 그룹 공동선택
  await page.keyboard.press('Meta+Shift+g');
  await page.waitForTimeout(700);

  const s = await snap(page);
  expect(errs).toEqual([]);
  expect(Object.keys(s.groups), '★그룹이 풀렸다').toHaveLength(0);
  expect(s.tokens, '★★그룹을 푼다고 «연결»까지 버리지 않는다 — 각자 그대로 남는다(현빈 ②)').toBe(5);
  expect(s.lines, '★선이 다섯으로 «갈라진다» — 무슨 일이 일어났는지 화면이 말해 준다').toBe(5);
});

test('G5 ★그룹 멤버의 ✕ 는 «그 한 장»만 지운다 — 남은 넷이 그룹을 유지 (현빈 ③ · 잰 값 5→0장)', async ({ page }) => {
  const { errs, secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForTimeout(200);

  await clickBtn(page, 'sp_g5', 'scratch-close');     // ★5번째의 ✕
  await page.waitForTimeout(700);

  const s = await snap(page);
  expect(errs).toEqual([]);
  expect(s.itemIds.sort(), `★✕ 한 번에 ${7 - s.itemIds.length}장이 사라졌다 — 지운 그 장만 사라져야 한다(현빈 ③)`)
    .toEqual([...GROUP.slice(0, 4), ...SOLO].sort());
  expect(Object.keys(s.groups), '★그룹은 그대로 하나').toHaveLength(1);
  expect(Object.values(s.groups)[0].sort(), '★4개인 그룹이 계속 유지된다').toEqual(GROUP.slice(0, 4).sort());
  expect(s.lines, '선은 여전히 하나').toBe(1);
});

test('G6 ★지운 참고이미지의 «토큰»도 같이 사라진다 — 死참조 0 · ⌘Z 면 둘 다 돌아온다', async ({ page }) => {
  const { errs, secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  await linkVia(page, 'sp_s1', secIds[1]);
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForTimeout(200);

  await clickBtn(page, 'sp_g5', 'scratch-close');
  await page.waitForTimeout(700);
  const s = await snap(page);
  expect(errs).toEqual([]);
  expect(s.tokenIds, `★지운 장의 토큰이 섹션에 남았다(死참조) — 남은 토큰: ${s.tokenIds.join(',')}`).not.toContain('sp_g5');
  expect(s.tokens, '그룹 넷 ＋ 단독 하나').toBe(5);
  /* ★「화면엔 연결 없음, 데이터엔 연결 있음」이 안 생긴다 — 두 출처가 같은 수를 말한다 */
  const live = await page.evaluate(() => window.SPLink.allLinks().length);
  expect(live, '★SPLink 가 세는 연결 수와 화면 토큰 수가 갈렸다').toBe(s.tokens);

  /* ★★⌘Z — 이미지가 돌아오면 «연결»도 같이 돌아온다(안 그러면 그림만 돌고 선은 영영 안 돌아온다) */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(1000);
  const s2 = await snap(page);
  expect(s2.itemIds, '★⌘Z 가 지운 장을 안 되살렸다').toContain('sp_g5');
  expect(s2.tokenIds, '★⌘Z 가 그림만 돌려주고 연결은 안 돌려줬다').toContain('sp_g5');
  expect(s2.lines, '다시 그룹 선 1 ＋ 단독 선 1').toBe(2);
});

test('G7 ★접기도 묶음 «전원» — 선이 하나인데 한 장만 접히지 않는다', async ({ page }) => {
  const { errs, secIds } = await setup(page);
  await linkVia(page, 'sp_g3', secIds[0]);
  await linkVia(page, 'sp_s1', secIds[1]);
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForTimeout(200);

  await clickBtn(page, 'sp_g2', 'spl-btn-fold');
  await page.waitForTimeout(500);
  const s = await snap(page);
  expect(errs).toEqual([]);
  expect(s.collapsed.sort(), `★접힌 장이 ${s.collapsed.length} — 묶음 다섯이 같이 접혀야 한다`).toEqual([...GROUP].sort());
  /* ★★음성대조 — 남의 단독은 안 접힌다 */
  expect(s.collapsed, '★남의 참고이미지까지 접었다').not.toContain('sp_s1');
});

test('G8 ★그룹 연결은 ⌘Z «한 걸음» (잰 값 5걸음)', async ({ page }) => {
  const { secIds } = await setup(page);
  /* ⛔준비(고르기·🔗 누르기)는 action «밖»에서 끝낸다 — 선택이 action 안에 들면 조작 전 바이트가 흔들린다. */
  await selectItem(page, 'sp_g3');
  await clickBtn(page, 'sp_g3', 'spl-btn-link');

  /* ⛔`expectOneUndoStep` 을 ★안 쓴다 — 그 헬퍼의 A1 은 「조작 직후 꼭대기가 ★새 칸」을 요구하는데,
     연결의 «앞 표본»은 «무변화 중복 차단»에 ★걸려 안 쌓이는 것이 ★정상이다(직전 조작이 끝 표본을
     찍어 꼭대기 = 지금 화면). 실측: Δpos=0 · seqNew=false · top='섹션 추가'. 그 헬퍼로 재면
     ★제품이 아니라 «그 헬퍼의 전제»를 재게 된다.
     ⇒ 여기서는 사용자가 겪는 두 수를 ★직접 잰다: ㉠ 쌓인 «칸 수» ㉡ ⌘Z ★한 번 뒤의 토큰 수.
     ⛔옛 판(멤버마다 pushHistory)에서는 ㉠이 4~5, ㉡이 4 다 — 그래서 이 둘이 «재는 자»다. */
  const h0 = await page.evaluate(() => window.getHistoryTip());
  await clickSection(page, secIds[0]);
  await page.waitForTimeout(500);
  const h1 = await page.evaluate(() => window.getHistoryTip());
  expect((await snap(page)).tokens, '전제 — 다섯 장이 연결됐다').toBe(5);
  expect(h1.len - h0.len, `★연결 한 제스처가 히스토리 칸을 ${h1.len - h0.len}개 쌓았다 — «한 칸»이어야 한다(멤버마다 쌓으면 넷 이상)`).toBe(1);

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(600);
  const s = await snap(page);
  expect(s.tokens, '★⌘Z 한 번에 토큰 다섯이 통째로 사라져야 한다(5걸음이면 4가 남는다)').toBe(0);
  expect(s.lines, '선도 0').toBe(0);
});

test('G9 ★묶음 테두리 — «링크된» 그룹에만 하나 · 끊으면 0 · ★단독엔 안 그린다', async ({ page }) => {
  /* 지디 판정 2026-10-09(앞 판정 뒤집음): ⛔이것은 N1(그룹이 안 보인다)을 고치는 것이 ★아니다.
     닫는 것은 «선이 ★무엇을 가리키나»다 — 세로로 쌓인 다섯이면 붙는 점이 가운데 장 옆이라
     「3번 장과 연결」로 읽힌다. ⇒ ★링크가 있을 때만 그린다(링크 없는 그룹은 그대로 안 보인다). */
  const { errs, secIds } = await setup(page);
  expect((await snap(page)).boxes, '★전제 — 연결 0 이면 상자도 0(그룹은 이미 있다)').toBe(0);

  await linkVia(page, 'sp_g3', secIds[0]);
  let s = await snap(page);
  expect(errs).toEqual([]);
  expect(s.boxes, '★연결된 그룹에 상자 하나').toBe(1);
  expect(s.lines, '선은 여전히 하나').toBe(1);

  /* ★★음성대조 — 그룹 아닌 단독을 연결해도 상자는 ★안 는다(1 그대로) */
  await linkVia(page, 'sp_s1', secIds[1]);
  s = await snap(page);
  expect(s.lines, '선은 둘(그룹 1 ＋ 단독 1)').toBe(2);
  expect(s.boxes, '★단독에도 상자를 그렸다 — 묶음이 아닌 것에 두르면 안 된다').toBe(1);

  /* ★끊으면 0 — 「상자는 링크를 따라 산다」 */
  await page.evaluate(() => window.deselectAll?.());
  await clickBtn(page, 'sp_g1', 'spl-btn-cut');
  await page.waitForTimeout(400);
  s = await snap(page);
  expect(s.boxes, '★그룹 링크를 끊었는데 상자가 남았다').toBe(0);
  expect(s.lines, '단독 선 하나만 남는다').toBe(1);

  /* ★상자가 «묶음 겉상자»를 두른다 — 다섯 장을 다 품고, 한 장만 두르지 않는다 */
  await linkVia(page, 'sp_g3', secIds[0]);
  const geo = await page.evaluate(() => {
    const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
    const k = (window.currentZoom || 100) / 100 || 1;
    const toL = (v) => (v - sc.left) / k, toT = (v) => (v - sc.top) / k;
    const r = [...document.querySelectorAll('.scratch-item[data-scratch-group]')].map(c => c.getBoundingClientRect());
    const b = document.querySelector('#link-edges .spl-edge-group');
    return {
      x: +b.getAttribute('x'), y: +b.getAttribute('y'),
      w: +b.getAttribute('width'), h: +b.getAttribute('height'),
      left: toL(Math.min(...r.map(q => q.left))), top: toT(Math.min(...r.map(q => q.top))),
      right: toL(Math.max(...r.map(q => q.right))), bottom: toT(Math.max(...r.map(q => q.bottom))),
      oneH: (r[0].bottom - r[0].top) / k,
    };
  });
  expect(geo.x, '★상자 왼쪽이 묶음보다 안쪽이다').toBeLessThanOrEqual(geo.left);
  expect(geo.y, '★상자 위가 묶음보다 안쪽이다').toBeLessThanOrEqual(geo.top);
  expect(geo.x + geo.w, '★상자 오른쪽이 묶음을 못 덮는다').toBeGreaterThanOrEqual(geo.right);
  expect(geo.y + geo.h, '★상자 아래가 묶음을 못 덮는다').toBeGreaterThanOrEqual(geo.bottom);
  expect(geo.h, `★상자 높이가 한 장 높이(${geo.oneH}) 수준이다 — 다섯을 안 품었다`).toBeGreaterThan(geo.oneH * 2);
});

/* ══ 양성대조 명부 — ★핀 판에서 ★무엇이 빨강인가 (⛔HEAD 를 판으로 쓰지 마라) ═══════════
 * ⒜ 핀 판 = 이 일 «전»의 dev `e669b9c6` — ★실측: 빨강 **9** / 초록 **1**(G0 만).
 *       mkdir -p /tmp/grouplink-before && git archive e669b9c6 | tar -x -C /tmp/grouplink-before
 *       GD1001_ROOT=/tmp/grouplink-before npx playwright test \
 *         --config=tests/dom/playwright.dom.config.js scratch-group-link
 *     빨강 = G1 G2 G3 G3b G4 G5 G6 G7 G8   초록 = **G0**(«지키는 시험» — 장면이 서는 것은 옛 판에서도 맞다)
 * ⒝ 변이(이 판에서 한 자리씩 무력화) — 「무엇을 끄면 어느 검사가 빨강인가」 ★실측:
 *       M1 `_groupOf` → 늘 null (묶음층 무력화)        → G1 G2 G3 G4 G5 G6 G7   (7)
 *       M2 `_removeItem` 의 inSameGroup → false        → **G5 G6**              (2)
 *       M3 삭제가 토큰을 안 치움(`_severLinks` → [])   → **G6 만**              (1)
 *       M4 `addLinks` 의 「끝 표본」 제거               → **G3b G6 G8**          (3)
 *       M5 `_scratchUngroup` 에 `_severLinks` 복원     → **G4 만**              (1)
 *       M6 묶음 선도 «중심»에 붙임(옛 꼴)              → **G1 만**              (1)
 *     ⇒ 축마다 «재는 자»가 적어도 하나 있다. ★M6 은 ★처음엔 **0건**이었다 — 붙는 점을 ★아무도 안 쟀다.
 *       그래서 G1 에 「선의 그룹 끝 = 묶음의 왼쪽 변」 단언을 ★더한 뒤 다시 쟀다(그래서 1건이 됐다).
 *     ★뿌리 확인 — R1(묶음) 하나를 죽이면 현빈 ①(G1)·④(G2)·⑤(G3)가 ★전부 빨강이다. 그러나
 *       ③(G5 의 아이템 수)은 M2 에서만, 死참조(G6)는 M3 에서만 빨개진다 ⇒ ★뿌리는 하나가 아니라 ★셋이다.
 * ⒞ ⛔이 파일이 «안 재는» 것 — 이름으로 남긴다:
 *     · 한 그룹을 «두 섹션»에 나눠 걸었을 때 선이 둘인가(묶음 키에 섹션이 들어 있지만 ★안 쟀다).
 *     · 숨김(toggleScratchHideAll)·접힘으로 묶음 «전원»이 0×0 일 때 선이 사라지는가(G7 이 접기만 잰다).
 *     · IndexedDB 재기동 뒤 영속 — 이 하네스가 못 재는 축(_root-harness 머리말의 명부).
 *     · 섹션 ⌘C→⌘V 로 «링크된 그룹 섹션»을 복사했을 때 — 미측정.
 */
