/* frame-clip-drag — ★죔과 ★자름을 ★진짜 드래그로 잰다 (2026-10-09 · ★★2026-10-10 재서술)
 *
 * ★★2026-10-10 에 ★두 가지가 ★바뀌어 ★이 파일의 ★제목들이 ★거짓이 되었다 — ⛔지우지 않고 ★다시 적었다:
 *   ⒜ ★★«기본»이 ★뒤집혔다 — ★2026-09-28~10-09 ★기본 `visible` → ★이제 ★기본 ★`hidden`(현빈 t1-②)
 *      ⇒ 「안 자르는 프레임(★기본)」이라 ★이름 붙은 칸은 ★★이름째 ★거짓이 되었다 ⇒ `K1`/`K4`/`K5` 의 ★축 값을 ★갈았고
 *        ★그 칸들이 ★들고 있던 ★단언은 ★★`K1f` 로 ★옮겨 ★살렸다(⛔삭제 ★0건)
 *   ⒝ ★죔이 ★★«단계»로 갈렸다 — `frameClampsDrag(el, 'move'|'drop')`(현빈 2026-10-09 「끌 때는 보여야」)
 *      ⇒ ★옛 `K2` 한 칸이 ★`mid`(끄는 중)와 ★`after`(놓은 뒤)를 ★같이 단언해 ★★둘 중 하나는 ★반드시 거짓이 된다
 *        ⇒ ★★`K2-move` ＋ `K2-drop` ★둘로 ★다시 세웠다. ⛔하나를 ★옮긴 것이 ★아니다.
 *
 * ★현빈 원문 — 「프레임 블럭 안에 텍스트 블럭들 넣고 ★이동하면 ★프레임 안에서만 있고
 *   ★★안 잘려 보인다(★잘려야 하는데)」. ★앞 조건이 ★원인이고 ★뒤가 ★결과다(2026-10-09 실측).
 *
 * ★★고치기 ★전 실측(앱 9430 · 배율 100% · 진짜 마우스):
 *   ★오른쪽 170px ⇒ `style.left` 378px → ★378px(불변) · 넘침 ★0 · 끄는 중에도 ★0
 *   ★★음성대조 왼쪽 150px ⇒ 378 → ★228(정확히 −150) ⇒ ★끌기는 ★살아 있었다. ★죔이었다.
 *   ★더 끌면(400px) ★프레임 ★밖으로 ★추출된다(DRAGOUT_MARGIN 60) ⇒ ★넘친 채 ★남는 상태가 ★없다.
 * ★토글 자체는 ★멀쩡했다 — 넘친 자식을 ★손으로 만들어 재니 ★프레임 밖 ★글자 픽셀이
 *   ★끔 ★426 / ★켬 ★★0 (같은 띠를 서로 견준 차이 439px · 스샷 2880×1800 · DPR 2).
 *   ⇒ ★그 ★«그림» 측정은 ★실앱에서 ★했다. ★여기서는 ★★«자리»와 ★★«히트테스트»로 잰다.
 *
 * ★★자 둘과 ★그 한계:
 *   ⒜ ★넘친 px = child.right − frame.right (★자리)
 *   ⒝ ★프레임 ★밖 점의 ★히트테스트 — ⚠️★★«프레임이 ★선택돼 있을 때만» 유효하다.
 *      ★안 고르면 `.frame-block:not(.selected):not([data-text-frame]) * { pointer-events:none }`
 *      때문에 ★자식이 ★아예 ★안 잡힌다(2026-10-09 실측: 25점 중 ★0점) ⇒ ★★전제로 ★단언한다.
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다):
 *   · ★드래그아웃(더 끌면 밖으로 빠지는 것) — ★별 기능이다. ★문턱 변화만 ★별도로 쟀다
 *   · ★붙여넣기·삽입 경로(`js/editor.js` clampChildIntoFrame) — ★거기는 ★안 고쳤다
 *   · ★저장·내보내기에서의 꼴 · 다중선택 피어
 */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { bootApp } = require('./_root-harness.js');

const VIEW_W = 1440, VIEW_H = 1000;

/** 섹션 ＋ 자유배치 프레임 ＋ 그 안의 텍스트 블럭 하나. ⛔손으로 DOM 을 짓지 않는다 — 앱의 그 입구다. */
async function scene(page, { clipAttr = null, radius = null } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  const ids = await page.evaluate(({ clipAttr, radius }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.();
    window.addSection();
    window.addFrameBlock();
    const fr = [...document.querySelectorAll('.frame-block')].find((f) => f.dataset.freeLayout === 'true');
    window.addTextBlock();
    /* ★★축은 ★세 값이다 — ★`null` = ★속성 ★없음(= ★★기본) · `'false'` = ★끔 · `'true'` = ★콀.
       ⚠️2026-09-28 이후엘 ★★기본이 `visible` 이었으나, ★★2026-10-10(현빈 t1-②)부톰 ★기본이 ★★자른다.
       ⇒ ★`clip: false` 가 ★예전엘 「안 자름」이었지만 ★지금은 ★★「기본(=자름)」이다 — ★그 ★이름이 ★거짓이 되어 ★버렸다. */
    if (clipAttr != null) fr.dataset.clipContent = clipAttr;
    if (radius != null) fr.dataset.radius = String(radius);
    return { frameId: fr.id, childId: [...fr.children].map((k) => k.id).pop() };
  }, { clipAttr, radius });
  /* ★배율 100% — ⛔40% 에선 자식이 23px 라 ★집는 점이 ★흔들린다(2026-10-09 실측) */
  await page.evaluate(() => window.applyZoom?.(100));
  await page.waitForTimeout(350);
  return { errs, ...ids };
}

const geom = (page, frameId, childId) => page.evaluate(([f, c]) => {
  const fr = document.getElementById(f), ch = document.getElementById(c);
  const rf = fr.getBoundingClientRect(), rt = ch.getBoundingClientRect();
  const x = Math.round(rf.right + 25), y = Math.round((rt.top + rt.bottom) / 2);
  const top = document.elementFromPoint(x, y);
  return {
    /* ★★«사실»만 싣는다 — ⛔`clips` 같은 ★파생 술어를 ★여기서 ★다시 세지 ★않는다(2026-10-10).
       ★까닭: ★갈래를 ★제품의 ★지금 상태에서 ★끌어오면 ★★CSS 가 ★뒤집혀도 ★맞는 갈래가 ★골라져
         ★★빨강이 ★안 난다 — ★거의 ★항등식이다. ⇒ ★각 칸이 ★축 값을 ★★제 손으로 ★선언하고
         ⑴그 ★dataset 값 ⑵그것이 ★만든 ★computed overflow 를 ★★전제로 ★단언한 뒤, ★행위는 ★★갈래 ★없이 잰다.
       ⚰️★옛 꼴 = ★dataset 의 ★clip 속성과 ★radius 를 ★손으로 ★견주어 ★`clips` 를 ★만들었다 = ★제품 술어의 ★★둘째 명부.
       ⛔여기에 ★그 식을 ★글자대로 ★다시 적지 ★마라 — ★이 파일을 ★훑는 ★게이트가 ★주석을 ★★«진짜 코드»로 읽는다(2026-10-07).
       ⚰️★그 전의 흠: ★`!!` 를 빼 ★`undefined` 가 나와 ★K1 전제가 빨갰다(2026-10-09) — ★자의 흠이었다. */
    clipAttr: fr.dataset.clipContent ?? null,
    radiusAttr: fr.dataset.radius ?? null,
    ov: getComputedStyle(fr).overflow,
    frameSelected: fr.classList.contains('selected'),
    left: ch.style.left, parentIsFrame: ch.parentElement === fr,
    over: Math.round(rt.right - rf.right),
    probe: { x, y }, hit: !!(top && ch.contains(top)),
    band: { x: Math.round(rf.right + 2), y: Math.round(rt.top), width: 150, height: Math.max(6, Math.round(rt.height)) },
  };
}, [frameId, childId]);

/** ★★얼마나 끌어야 ★넘치나 — ★★장면에서 ★잰다. ⛔거리를 ★spec 에 ★박지 않는다.
 *  ★`maxLeft` = 프레임 안쪽 폭 − 자식 폭 (★죔이 ★물리는 그 자리)
 *  ★`dragOutLeft` = 자식 ★중심이 ★프레임 밖 `DRAGOUT_MARGIN`(60) 을 넘는 left
 *    ⇒ ★★목표는 ★그 ★둘 사이다 — ★★넘치되 ★추출되지 ★않는 창.
 *  ⚠️★D3(`_fitFullWidthTextFrame`)가 ★「폭 100%」 글자틀을 ★★첫 가로 틱에 ★내용 폭으로 줄인다
 *    ⇒ ★★먼저 ★조금 끌어 ★그 변신을 ★끝낸 뒤 ★재야 ★수가 ★맞는다. */
async function overflowPlan(page, frameId, childId) {
  return page.evaluate(([f, c]) => {
    const fr = document.getElementById(f), ch = document.getElementById(c);
    const maxLeft = Math.max(0, fr.clientWidth - ch.offsetWidth);
    const dragOutLeft = Math.round(fr.offsetWidth + 60 - ch.offsetWidth / 2);
    return { left: parseInt(ch.style.left || '0', 10), childW: ch.offsetWidth,
             frameW: fr.clientWidth, maxLeft, dragOutLeft,
             target: Math.round(maxLeft + Math.min(40, Math.max(8, (dragOutLeft - maxLeft) / 2))) };
  }, [frameId, childId]);
}

/** ★프레임을 ★사람처럼 ★클릭해 ★고른다. ⛔안 고르면 자식이 ★안 잡힌다
 *  (`.frame-block:not(.selected):not([data-text-frame]) * { pointer-events:none }`). */
async function selectFrame(page, frameId) {
  const f = await page.evaluate((id) => {
    const fr = document.getElementById(id); fr.scrollIntoView({ block: 'center' });
    const b = fr.getBoundingClientRect();
    return { x: Math.round(b.left + 8), y: Math.round(b.top + 8) };
  }, frameId);
  await page.mouse.click(f.x, f.y);
  await page.waitForTimeout(350);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), frameId),
    '★전제: 프레임을 ★못 골랐다 — ★자식이 ★안 잡혀 ★아래가 뜻이 없다').toBe(true);
}

/** ★사람 순서 — ⑴ 프레임을 ★클릭해 고르고 ⑵ 자식을 ★끈다. ⛔⑴ 을 빼면 자식이 ★안 잡힌다. */
async function selectFrameThenDrag(page, frameId, childId, dx, dy = 0) {
  await selectFrame(page, frameId);

  const g = await page.evaluate((id) => {
    const ch = document.getElementById(id); const b = ch.getBoundingClientRect();
    const x = Math.round(b.left + b.width * 0.5), y = Math.round(b.top + b.height * 0.3);
    const top = document.elementFromPoint(x, y);
    return { x, y, ok: !!(top && ch.contains(top)), top: top ? (top.id || top.tagName) : null };
  }, childId);
  expect(g.ok, `★전제: ★집는 점의 ★맨 위가 ★그 자식이 ★아니다 (맨 위=${g.top})`).toBe(true);

  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(g.x + Math.round(dx * i / 12), g.y + Math.round(dy * i / 12));
    await page.waitForTimeout(30);
  }
  const mid = await geom(page, frameId, childId);
  await page.mouse.up();
  await page.waitForTimeout(350);
  return { grab: g, mid };
}

/** ★두 걸음 끌기 — ⑴ 조금 끌어 ★D3 변신을 끝내고 ⑵ ★잰 거리만큼 ★더 끈다.
 *  @returns {{plan, mid, after}} */
async function dragToOverflow(page, frameId, childId) {
  const first = await selectFrameThenDrag(page, frameId, childId, 24, 0);
  const plan = await overflowPlan(page, frameId, childId);
  expect(plan.dragOutLeft, `★전제: ★넘치되 ★안 빠지는 ★창이 ★없다 (maxLeft ${plan.maxLeft} · dragOutLeft ${plan.dragOutLeft})`)
    .toBeGreaterThan(plan.maxLeft);
  const need = plan.target - plan.left;
  expect(need, `★전제: 더 끌 거리가 ★0 이하다 (left ${plan.left} · target ${plan.target})`).toBeGreaterThan(0);
  const second = await selectFrameThenDrag(page, frameId, childId, need, 0);
  return { plan, need, mid: second.mid, after: await geom(page, frameId, childId), first };
}

/* ═══ ★★축 = `data-clip-content` ★세 값. ★★2026-10-10 에 ★«기본»이 ★뒤집혔다 ═══════════
 *  ★속성 ★없음 ⇒ ★★자른다 — ★현빈 t1-② 「프레임 밖으로 나간부분은 ★안보여야되는거 아냐? 근데도 보이네」
 *  ★`'false'`  ⇒ ★★안 자른다 — ★현빈 ★2026-09-28 의 ★그 ★끔. ⛔죽이지 ★않았다(실측 18 중 1 프레임이 쓴다)
 *  ★`'true'`   ⇒ ★자른다 — ★켬. ★기본과 ★결과가 ★같고, `!important` 로 ★조상 해제까지 ★이긴다
 *  ⚰️★2026-09-28~10-09 ★사이엔 ★★기본이 `visible` 이었다 ⇒ ★그 시절 제목 「★안 자르는 프레임(기본)」은
 *     ★★제목째 ★거짓이 되었다. ⛔단언을 ★지우지 ★않고 ★★«조건»을 ★다시 적어 ★쪽을 ★옮겼다.
 *  ⚠️★★이 축을 ★못 재는 자리 둘(2026-10-10 실측 · ★명시도로 ★진다, ★순서와 ★무관):
 *     ㉠ `[data-radius]:not([data-radius="0"])` (0,3,0) ＞ `[data-clip-content="false"]` (0,2,0)
 *        ⇒ ★★둥근 프레임에선 ★끔이 ★안 먹는다 ⇒ ★아래 칸들은 ★`radius` ★없음을 ★전제로 ★단언한다
 *     ㉡ ★같은 까닭으로 `:has(> .frame-child-dragging)` (0,2,0) 도 ★진다 ⇒ ★둥근 프레임에선
 *        ★「끌 때는 보인다」(현빈 10-09)가 ★안 선다. ★K3 은 ★갇히는 쪽만 보므로 ★이 구멍에 ★눈이 가려져 있다.
 */

/** ★★끌지 ★않고 ★손으로 ★넘겨 둔다 — ★«그림/히트» 축은 ★이 장면이 ★아니면 ★못 잰다.
 *  ⚠️★★까닭: ★끌어서 만든 넘침은 ★놓는 순간 ★죔이 ★안으로 넣는다 ⇒ 「★놓은 뒤 ★밖에 ★안 잡힌다」가
 *    ★★밖에 ★아무것도 ★없어서 ★언제나 ★참이 된다(★항등식). ★그래서 ★전제로 ★`over > 25` 를 ★단언한다.
 *  ★현빈 t1-② 의 ★실제 꼴도 ★끌기가 ★아니라 ★★이미 밖에 ★나가 있던 자식이었다(`tb_ts0he_pqiz9l1`).
 *  ★`by` 는 ★히트 탐침(프레임 right＋25)보다 ★커야 한다 — ⛔작으면 ★탐침이 ★자식에 ★안 닿아 ★거짓음성. */
async function pushChildOut(page, frameId, childId, by = 60) {
  return page.evaluate(([f, c, d]) => {
    const fr = document.getElementById(f), ch = document.getElementById(c);
    ch.style.left = Math.round(Math.max(0, fr.clientWidth - ch.offsetWidth) + d) + 'px';
    return Math.round(ch.getBoundingClientRect().right - fr.getBoundingClientRect().right);
  }, [frameId, childId, by]);
}

/** ★세로 넘침 계획 — ★`overflowPlan` 의 ★밑변 짝. ⛔거리를 ★spec 에 ★박지 않는다. */
async function overflowPlanY(page, frameId, childId) {
  return page.evaluate(([f, c]) => {
    const fr = document.getElementById(f), ch = document.getElementById(c);
    const maxTop = Math.max(0, fr.clientHeight - ch.offsetHeight);
    const dragOutTop = Math.round(fr.offsetHeight + 60 - ch.offsetHeight / 2);
    return { top: parseInt(ch.style.top || '0', 10), childH: ch.offsetHeight, frameH: fr.clientHeight,
             maxTop, dragOutTop,
             target: Math.round(maxTop + Math.min(40, Math.max(8, (dragOutTop - maxTop) / 2))) };
  }, [frameId, childId]);
}

/** ★그 띠에 ★이 자식의 ★잉크가 ★있나 — ★같은 띠를 ★자식만 ★숨겨 ★다시 찍어 ★견준다.
 *  ★★이 자가 ★맞는지는 ★같은 칸의 ★`'false'` 다리가 ★증명한다(★그쪽은 ★달라야 한다) — ⛔양성대조 ★없이 쓰지 마라. */
async function inkInBand(page, childId, band) {
  const h = (buf) => crypto.createHash('md5').update(buf).digest('hex');
  const shown = h(await page.screenshot({ clip: band }));
  await page.evaluate((id) => { document.getElementById(id).style.visibility = 'hidden'; }, childId);
  const hidden = h(await page.screenshot({ clip: band }));
  await page.evaluate((id) => { document.getElementById(id).style.visibility = ''; }, childId);
  return { ink: shown !== hidden, shown, hidden };
}

/* ═══ ㉠ ★그림/히트 축 — ★한 장면 · ★속성 ★한 값만 다르다 (K1 ↔ K1f) ═══════════ */

test('K1 ★★기본(속성 없음) = ★자르는 프레임 — ★손으로 ★넘겨 둔 자식이 ★프레임 밖 점에서 ★안 잡힌다 (현빈 t1-②)', async ({ page }) => {
  /* ⚠️★이 칸의 자 = ★★히트테스트다. ★★«그려지는가»는 ★이 자가 ★아니라 ★K4 가 ★픽셀로 잰다. */
  const { errs, frameId, childId } = await scene(page);
  const g0 = await geom(page, frameId, childId);
  expect(g0.clipAttr, '★전제: `data-clip-content` 가 ★붙어 있다 — ★이 칸은 ★★«속성 없음»을 잰다').toBe(null);
  expect(g0.radiusAttr, '★전제: `data-radius` 가 ★붙어 있다 — ★그러면 ★radius 규칙이 ★자름을 정해 ★이 칸이 ★축을 ★못 잰다').toBe(null);
  expect(g0.ov, '★★전제: ★속성이 ★없는데 ★자르지 ★않는다 — ★2026-10-10 의 ★«기본 = 자름»이 ★죽었다').toBe('hidden');

  await selectFrame(page, frameId);
  const by = await pushChildOut(page, frameId, childId);
  const g1 = await geom(page, frameId, childId);
  expect(g1.over, `★전제: ★손으로 넘겼는데 ★탐침까지 ★안 넘쳤다 (넘침 ${g1.over}px · 잰 값 ${by}px · 탐침은 right＋25)`)
    .toBeGreaterThan(25);
  expect(g1.frameSelected, '★전제: 프레임이 ★선택 해제됐다 — ★안 고르면 자식이 ★아예 ★안 잡혀 ★거짓음성이다').toBe(true);
  expect(g1.hit, `★★자르는데 ★프레임 밖 점(${g1.probe.x},${g1.probe.y})에서 ★자식이 ★잡힌다`
    + ` (넘침 ${g1.over}px · overflow ${g1.ov}) — ★현빈 t1-② 의 ★그 증상이다`).toBe(false);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ★★위 K1 의 ★반대쪽 — ⛔없으면 ★「끔」이 ★한 번도 ★안 돌아 ★★«적었지만 ★안 잰 조건»이 된다(지디 ㉠).
   ★장면은 ★K1 과 ★한 값만 다르다 — ★`clipContent="false"`.
   ★여기에 ★옛 K1 의 ★단언(「끌면 ★넘친다」)을 ★★옮겨 ★살려 둔다 — ⛔지운 것이 ★아니다. */
test('K1f ★★`clipContent="false"`(현빈 09-28 의 끔) — ★끌면 ★놓아도 ★넘친 채 남고 ＋ ★밖에서 ★잡힌다', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page, { clipAttr: 'false' });
  const g0 = await geom(page, frameId, childId);
  expect(g0.clipAttr, '★전제: `false` 를 ★넣었는데 ★안 붙었다').toBe('false');
  expect(g0.radiusAttr, '★전제: radius 가 붙어 있다 — ★radius 가 ★끔을 ★이겨 ★이 칸이 ★뜻을 잃는다').toBe(null);
  expect(g0.ov, '★★전제: ★끔인데 computed overflow 가 ★visible 이 ★아니다 — ★끔이 ★안 먹는다').toBe('visible');

  /* ⒜ ★옛 K1 의 그 단언 — ★놓은 뒤에도 ★넘친 채 ★남는다(★죔이 ★전부를 가두면 ★여기가 ★빨강이다) */
  const { plan, need, mid, after } = await dragToOverflow(page, frameId, childId);
  console.log(`K1f ★잰 계획 — 자식폭 ${plan.childW} · 프레임폭 ${plan.frameW} · maxLeft ${plan.maxLeft}`
    + ` · dragOutLeft ${plan.dragOutLeft} · target ${plan.target} · 더 끈 거리 ${need}`);
  expect(after.parentIsFrame, '★끌다가 ★프레임 밖으로 ★추출됐다 — ★이 칸은 ★«안에 남은 채 넘침»을 잰다').toBe(true);
  expect(mid.over, `★★끄는 중에 ★안 넘쳤다 (${mid.over}px)`).toBeGreaterThan(0);
  expect(after.over, `★★끔인데 ★놓으니 ★넘침이 ★사라졌다 (넘침 ${after.over}px · left ${after.left})`
    + ' — ★죔이 ★끔까지 ★가둔다').toBeGreaterThan(0);

  /* ⒝ ★그리고 ★K1 과 ★같은 자로 — ★같은 장면 · ★같은 탐침 · ★결과만 ★반대 */
  const by = await pushChildOut(page, frameId, childId);
  const g1 = await geom(page, frameId, childId);
  expect(g1.over, `★전제: ★손으로 넘겼는데 ★탐침까지 ★안 넘쳤다 (${g1.over}px · 잰 값 ${by}px)`).toBeGreaterThan(25);
  expect(g1.frameSelected, '★전제: 프레임이 ★선택 해제됐다').toBe(true);
  expect(g1.hit, `★★끔인데 ★프레임 밖 점(${g1.probe.x},${g1.probe.y})에서 ★자식이 ★안 잡힌다`
    + ` (넘침 ${g1.over}px · overflow ${g1.ov}) — ★자리만 넘고 ★그려지지 않으면 ★사용자에겐 ★자른 것과 같다`).toBe(true);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ ㉡ ★★«단계»로 쪼갠 축 — ★옛 K2 하나를 ★★둘로 ★다시 세웠다 (2026-10-10) ═════════
 *  ⚰️★옛 K2 = 「★많이 끌어도 ★가둬진다」 ★한 칸에 ★`mid`(끄는 중)와 ★`after`(놓은 뒤)를 ★같이 단언했다.
 *  ★★그 둘은 ★이제 ★★반대다 — ★세 날짜가 ★한 칸 안에서 ★부딪친다:
 *     ★2026-09-28 — `T-088` 이 ★열렸다(죔이 ★없어 자식이 ★프레임 밖으로 ★사라지는 띠)
 *     ★2026-10-09 — ★현빈이 「★끄는 ★동안에는 ★죄지 ★마라」를 ★요구했다(끌 때는 ★보여야 한다)
 *     ★2026-10-10 — ★그래서 ★죔을 ★★«단계»로 갈랐다(`frameClampsDrag(el, 'move'|'drop')`)
 *  ⇒ ★한 칸으론 ★★둘 중 하나가 ★반드시 ★거짓이 된다. ⛔하나를 ★옮긴 것이 ★아니라 ★★둘을 ★세웠다. */

test('K2-move ★★「내용 자르기」 켠 프레임 — ★★끄는 ★동안에는 ★안 죈다 ＋ ★그 동안 ★보인다 (현빈 2026-10-09 의 파수꾼)', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page, { clipAttr: 'true' });
  const before = await geom(page, frameId, childId);
  expect(before.clipAttr, '★전제: 토글을 ★켰는데 ★속성이 ★안 붙었다').toBe('true');
  expect(before.ov, '★전제: 토글을 켰는데 computed overflow 가 ★hidden 이 ★아니다').toBe('hidden');

  const { plan, mid } = await dragToOverflow(page, frameId, childId);
  console.log(`K2-move ★잰 계획 — maxLeft ${plan.maxLeft} · target ${plan.target}`);
  expect(mid.over, `★★끄는 ★중에 ★죄었다 (넘침 ${mid.over}px) — ★현빈 ★2026-10-09 요구가 ★죽었다`
    + ' (「끌 때는 보여야 한다」)').toBeGreaterThan(0);
  /* ★★2026-10-10 2차 — ★이 단언을 ★`'visible'` 에서 ★`'hidden'` 으로 ★바꿨다. ⛔기준을 ★낮춘 것이 ★아니다:
       ★★주 단언(위 `mid.over > 0` = ★현빈 10-09 「끌 때는 ★죄지 마라」)은 ★★1차에서도 ★통과했다.
       ★빨간 것은 ★★이 둘째 단언이었고, ★잰 값은 ★`hidden` 이다(탐침 D: ★기본 ⇒ visible · ★★켬 ⇒ hidden).
     ★★그 `hidden` 은 ★★결함이 아니라 ★★★현빈 ★2026-09-30 ★결정이다 —
       「★켠 것은 ★풀어 주는 ★예외들보다 ★이겨야 한다」(그래서 `!important`).
     ⇒ ★★그래서 ★★«켬에서는 ★안 풀린다»를 ★★단언해 ★★그 결정을 ★잠근다. ★풀리면 ★★이 칸이 ★빨개져
       ★「현빈 09-30 을 ★누가 ★뒤집었나」를 ★묻게 한다.
     ★★그리고 ★「기본 프레임에서는 ★풀린다」는 ★★아래 `K2-move-default` 가 ★따로 잠근다 —
       ⛔한 칸에 ★두 축을 ★다시 넣지 ★마라(★그것이 ★옛 K2 의 흠이었다).
     ⚠️★★10-09(끌 때는 보인다)와 ★09-30(켬이 이긴다)은 ★★다른 ★단계를 말하는 ★두 지시다
       ⇒ ★★어느 쪽이 ★이기나는 ★★현빈 판정 ★대기다. ⛔내가 ★고르지 ★않았다. */
  expect(mid.ov, '★★켬 프레임인데 ★끌는 중 overflow 가 ★풀렸다 — ★★현빈 2026-09-30 결정(`!important` 로'
    + ' ★예외들을 ★이긴다)이 ★뒤집혔다. ★뒤집은 것이 ★뜻이었다면 ★★이 칸과 ★그 CSS 주석을 ★같이 고쳐라'
    + ` (overflow ${mid.ov})`).toBe('hidden');
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ★★`K2-move` 의 ★반대쪽 ★축 — ★★«해제가 ★먹는 자리»를 ★잠근다 (2026-10-10 2차 · 지디 ㉡).
   ⛔없으면 ★`K2-move` 의 ★`hidden` 단언만 남아 ★★«해제 규칙이 ★아예 ★죽어도» ★초록이 된다
     = ★★양성대조 ★없는 ★음성 단언이다. ★그 꼴을 ★이 팀은 ★여러 번 ★밟았다. */
test('K2-move-default ★★기본(속성 없음) 프레임 — ★★끌는 ★동안 ★overflow 가 ★풀린다 (해제 규칙의 ★양성대조)', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page);
  const before = await geom(page, frameId, childId);
  expect(before.clipAttr, '★전제: 이 칸은 ★«속성 없음»을 잰다').toBe(null);
  expect(before.radiusAttr, '★전제: radius 가 붙어 있다 — ★다른 규칙이 ★자름을 정한다').toBe(null);
  expect(before.ov, '★전제: 기본이 ★hidden 이 ★아니다').toBe('hidden');

  const { mid, after } = await dragToOverflow(page, frameId, childId);
  expect(mid.ov, '★★기본 프레임인데 ★끌는 중 ★overflow 가 ★안 풀렸다 — ★`.frame-child-dragging` 마커 또는'
    + ` ★그 CSS 규칙이 ★죽었다 (overflow ${mid.ov}) ⇒ ★현빈 2026-10-09 「끌 때는 ★보인다」가 ★죽는다`).toBe('visible');
  expect(mid.over, `★★끌는 중에 ★죄었다 (${mid.over}px)`).toBeGreaterThan(0);
  expect(after.ov, '★★놓았는데 ★overflow 가 ★visible 그대로다 — ★마커를 ★안 뗐다 ⇒ ★영구 visible').toBe('hidden');
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('K2-drop ★★「내용 자르기」 켠 프레임 — ★★놓은 ★뒤에는 ★가둬진다 ＋ ★마커가 ★떼어졌다 (T-088 의 파수꾼)', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page, { clipAttr: 'true' });
  const before = await geom(page, frameId, childId);
  expect(before.clipAttr, '★전제: 토글을 ★켰는데 ★속성이 ★안 붙었다').toBe('true');
  expect(before.ov, '★전제: 토글을 켰는데 computed overflow 가 ★hidden 이 ★아니다').toBe('hidden');

  const { plan, after } = await dragToOverflow(page, frameId, childId);
  console.log(`K2-drop ★잰 계획 — maxLeft ${plan.maxLeft} · target ${plan.target}(= ★K2-move 와 ★같은 거리)`);
  expect(after.parentIsFrame, '★추출됐다 — 이 칸은 ★«안에 남은 채»를 잰다').toBe(true);
  expect(after.over, `★★자르는 프레임인데 ★놓은 뒤에도 ★넘쳤다 (${after.over}px) — ★T-088 이 막던 ★「사라지는 띠」가 ★돌아온다`)
    .toBeLessThanOrEqual(0);
  expect(after.ov, '★★놓았는데 overflow 가 ★visible 그대로다 — ★`.frame-child-dragging` 을 ★안 뗐다'
    + ' ⇒ ★영구 visible = ★고치기 ★전과 ★같다').toBe('hidden');
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ⒝ ★★`T-088` 증상을 ★★«놓은 뒤»에 ★행위로 잰다 — ★값만이 ★아니라 ★★화면까지.
 *  ★지디 지시 — 「밑변 너머로 끌었다 → 놓았다 → ★값과 ★화면이 ★둘 다 프레임 안이다」.
 *  ★★두 다리로 세운다 — `'true'`(가둬진다)와 `'false'`(안 가둬진다). ★후자는 ★★잉크 자의 ★양성대조다:
 *    ⛔없으면 「★띠에 ★잉크가 ★없다」가 ★자가 ★먹통일 때도 ★참이 되어 ★아무것도 ★안 잠근다. */
test('K2b ★★밑변 너머로 끌었다 → ★놓았다 ⇒ ★★값도 ★화면도 ★프레임 ★안이다 (T-088 증상 · 양·음 한 쌍)', async ({ page }) => {
  const got = {};
  for (const clipAttr of ['true', 'false']) {
    const { errs, frameId, childId } = await scene(page, { clipAttr });
    expect((await geom(page, frameId, childId)).clipAttr, `★전제: ${clipAttr} 가 ★안 붙었다`).toBe(clipAttr);

    /* ⑴ ★가로로 ★조금 — ★D3(`_fitFullWidthTextFrame`)의 ★폭 변신을 ★먼저 끝낸다 */
    await selectFrameThenDrag(page, frameId, childId, 24, 0);
    const planY = await overflowPlanY(page, frameId, childId);
    expect(planY.dragOutTop, `★전제: ★밑변을 ★넘되 ★안 빠지는 ★창이 ★없다 (maxTop ${planY.maxTop} · dragOutTop ${planY.dragOutTop})`)
      .toBeGreaterThan(planY.maxTop);
    const need = planY.target - planY.top;
    expect(need, `★전제: 더 끌 거리가 ★0 이하다 (top ${planY.top} · target ${planY.target})`).toBeGreaterThan(0);
    /* ⑵ ★★밑변 ★너머로 */
    await selectFrameThenDrag(page, frameId, childId, 0, need);

    const v = await page.evaluate(([f, c]) => {
      const fr = document.getElementById(f), ch = document.getElementById(c);
      const r = fr.getBoundingClientRect();
      window.deselectAll?.();   /* ⛔손잡이·테두리가 ★띠에 ★찍히면 ★잉크 자가 ★더럽다 */
      return { parentIsFrame: ch.parentElement === fr,
               bottomOver: Math.round((parseInt(ch.style.top || '0', 10) + ch.offsetHeight) - fr.clientHeight),
               band: { x: Math.round(r.left), y: Math.round(r.bottom + 1), width: Math.round(r.width), height: 40 } };
    }, [frameId, childId]);
    await page.waitForTimeout(150);
    expect(v.parentIsFrame, `[${clipAttr}] ★추출됐다 — 이 칸은 ★«안에 남은 채»를 잰다`).toBe(true);
    expect(v.band.y + v.band.height, `[${clipAttr}] ★전제: ★프레임 ★아래 띠가 ★보는 창 ★밖이다 (y ${v.band.y})`)
      .toBeLessThanOrEqual(VIEW_H);
    got[clipAttr] = { ...v, ...(await inkInBand(page, childId, v.band)), errs };
  }

  /* ★★`'true'` — ★값과 ★화면이 ★둘 다 ★안이다 */
  expect(got['true'].bottomOver, `★★값: ★자르는데 ★자식 ★밑변이 ★프레임 밑변을 ★넘었다 (${got['true'].bottomOver}px)`)
    .toBeLessThanOrEqual(0);
  expect(got['true'].ink, '★★화면: ★자르는데 ★프레임 ★아래 띠에 ★자식의 ★잉크가 ★있다'
    + ` (보인 md5 ${got['true'].shown} / 숨긴 md5 ${got['true'].hidden}) — ★값은 안인데 ★그림이 ★밖이다`).toBe(false);
  /* ★★`'false'` — ★★잉크 자의 ★양성대조. ⛔이 쪽이 ★초록이면 ★위의 ★`false` 는 ★«안 재고 있다» */
  expect(got['false'].bottomOver, `★★양성대조(값): ★끔인데 ★밑변이 ★안 넘었다 (${got['false'].bottomOver}px) — ★죔이 ★끔까지 가둔다`)
    .toBeGreaterThan(0);
  expect(got['false'].ink, '★★양성대조(화면): ★끔인데 ★프레임 ★아래 띠에 ★잉크가 ★없다'
    + ` (보인 md5 ${got['false'].shown} / 숨긴 md5 ${got['false'].hidden})`
    + ' — ★★이 자가 ★아무것도 ★못 재는 ★먹통이라는 뜻이다. ⛔위 칸의 ★초록을 ★믿지 마라').toBe(true);
  expect([...got['true'].errs, ...got['false'].errs], '★앱이 오류를 냈다').toEqual([]);
});

test('K3 ★★둥근 모서리 프레임 — ★CSS 가 ★hidden 으로 두는 자리라 ★같이 가둬진다', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page, { radius: 24 });
  const before = await geom(page, frameId, childId);
  expect(before.ov, '★전제: 둥근 프레임인데 computed overflow 가 ★hidden 이 아니다 — CSS 가 바뀌었다').toBe('hidden');

  const { after } = await dragToOverflow(page, frameId, childId);
  expect(after.parentIsFrame, '★추출됐다').toBe(true);
  expect(after.over, `★★둥근 프레임인데 ★넘쳤다 (${after.over}px)`).toBeLessThanOrEqual(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ★★`K3` 가 ★못 보던 자리를 ★메운다 (2026-10-10 2차 · 지디 ㉡⒞).
   ★★까닭 — ★`K3` 는 ★둥근 프레임에서 ★★«갇히는 쪽»만 ★단언한다 ⇒ ★★«끔이 ★먹나»에 ★눈이 ★가려져 있었다.
     ⇒ ★그래서 ★2026-09-29~10-10 내내 ★★둥근 프레임에서 ★현빈의 ★끔이 ★안 먹는 것을 ★아무도 ★안 봤다.
   ★★잰 값(탐침 · 고치기 ★전): ★radius 없음 ⇒ visible · 잉크 ★있다 / ★★radius 24 ⇒ ★hidden · 잉크 ★★없다.
   ★★이 칸은 ★그 ★두 다리를 ★같이 세운다 — ⛔한쪽만 두면 ★자가 ★먹통일 때도 ★초록이다. */
test('K3f ★★둥근 프레임 ＋ ★「내용 자르기」 ★끔 — ★★끔이 ★이긴다 (★radius 유무 ★양·음 한 쌍 · ★픽셀)', async ({ page }) => {
  const got = {};
  for (const radius of [null, 24]) {
    const key = radius == null ? '모서리없음' : '둥근';
    const { frameId, childId } = await scene(page, { clipAttr: 'false', radius });
    const g0 = await geom(page, frameId, childId);
    expect(g0.clipAttr, `[${key}] ★전제: 끔이 ★안 걸렸다`).toBe('false');
    expect(g0.radiusAttr, `[${key}] ★전제: radius 축이 ★안 걸렸다`).toBe(radius == null ? null : String(radius));

    await selectFrame(page, frameId);
    const by = await pushChildOut(page, frameId, childId);
    /* ★자식에 ★단색을 깐다 — ⛔글자는 ★왼쪽에 몰려 ★넘친 폭이 ★빈칸이 되어 ★★양성대조가 ★죽는다
       (2026-10-10 ★1차 탐침에서 ★실제로 ★죽었다: ink false/false) */
    const v = await page.evaluate(([f, c]) => {
      const fr = document.getElementById(f), ch = document.getElementById(c);
      ch.style.background = '#0000ff';
      window.deselectAll?.();
      const rf = fr.getBoundingClientRect(), rt = ch.getBoundingClientRect();
      const over = Math.round(rt.right - rf.right);
      return { ov: getComputedStyle(fr).overflow, over,
               band: { x: Math.round(rf.right + 1), y: Math.round(rt.top + 2),
                       width: Math.max(4, over - 2), height: Math.max(4, Math.round(rt.height) - 4) } };
    }, [frameId, childId]);
    await page.waitForTimeout(150);
    expect(v.over, `[${key}] ★전제: ★손으로 넘겼는데 ★안 넘쳤다 (${v.over}px · 잰 값 ${by}px)`).toBeGreaterThan(4);
    got[key] = { ...v, ...(await inkInBand(page, childId, v.band)) };
  }
  console.log(`K3f ★잰 값 — ${JSON.stringify(got)}`);
  /* ★★양성대조 먼저 — ⛔이쪽이 빨강이면 ★아래 ★본 단언은 ★뜻이 ★없다 */
  expect(got['모서리없음'].ov, '★★양성대조: radius 없는데 ★끔이 ★안 먹는다 — ★끔 규칙 ★자체가 ★죽었다').toBe('visible');
  expect(got['모서리없음'].ink, '★★양성대조(픽셀): radius 없는데 ★프레임 밖에 ★잉크가 ★없다 — ★★잉크 자가 ★먹통이다').toBe(true);
  /* ★★본 단언 — ★모서리 규칙(★속성 둘 = ★명시도 한 칸 높다)을 ★끔이 ★이겨야 한다 */
  expect(got['둥근'].ov, '★★★둥근 프레임에서 ★현빈의 ★「내용 자르기 ★끔」이 ★안 먹는다'
    + ' — ★모서리 규칙이 ★명시도로 ★이긴다(★순서와 ★무관) ⇒ ★토글이 ★거짓이 된다').toBe('visible');
  expect(got['둥근'].ink, '★★★둥근 프레임에서 ★프레임 밖에 ★잉크가 ★없다 = ★끔이 ★안 먹는다 (★값은 ★위에서 ★쟀고'
    + ' ★이 줄은 ★★그림을 ★잰다 — ★둘이 ★갈리면 ★«자리는 넘었는데 ★안 그려진다»다)').toBe(true);
});

/* ═══ ★★한 쌍이 ★같은 장면에서 ★갈리나 — ★그림으로도 ═══════════════════════ */

test('K4 ★★같은 끌기 · 같은 장면 — ★★«끔»과 ★«기본»만 다른데 ★그림이 ★갈린다 (★양·음 한 쌍)', async ({ page }) => {
  /* ⚠️★2026-10-10 ★축 값 교체 — ★옛 꼴은 `[false, true]`(= ★기본 ↔ ★켬)였다.
     ★★이제 ★기본 ≡ ★켬 이라 ★그 둘은 ★★«사본»이다(그림이 ★같아 ★이 칸이 ★언제나 ★빨강).
     ⇒ ★갈리는 ★참 축은 ★★`'false'` ↔ ★속성 ★없음 이다. */
  const shots = {};
  const overs = {};
  for (const clipAttr of ['false', null]) {
    const key = clipAttr === null ? '기본' : clipAttr;
    const { frameId, childId } = await scene(page, { clipAttr });
    const g0 = await geom(page, frameId, childId);
    expect(g0.clipAttr, `[${key}] ★전제: ★축 값이 ★안 걸렸다`).toBe(clipAttr);
    expect(g0.ov, `[${key}] ★전제: ★축 값이 ★overflow 를 ★안 정했다`).toBe(clipAttr === 'false' ? 'visible' : 'hidden');
    const { after: g } = await dragToOverflow(page, frameId, childId);
    overs[key] = g.over;
    /* ★프레임 ★밖 띠를 ★그대로 찍는다 — ⛔「보인다」가 아니라 ★그려진 ★글자다 */
    shots[key] = crypto.createHash('md5')
      .update(await page.screenshot({ clip: g.band })).digest('hex');
  }
  expect(overs['false'], `★★끔인데 ★안 넘쳤다 (${overs['false']}px)`).toBeGreaterThan(0);
  expect(overs['기본'], `★★기본(속성 없음)인데 ★넘쳤다 (${overs['기본']}px)`).toBeLessThanOrEqual(0);
  expect(shots['기본'], '★★끔과 ★기본인데 ★프레임 밖 띠의 ★그림이 ★같다'
    + ` (md5 ${shots['false']} vs ${shots['기본']}) — ★자리는 갈렸는데 ★그림이 안 갈리면 ★사용자는 ★차이를 못 본다`)
    .not.toBe(shots['false']);
});

/* ═══ K5 — ★★«더 끌면 밖으로 빠진다»는 ★별 기능이다. ★문턱이 ★안 바뀌었나 ════════
 *  ★지디 지시 — 「⛔건드리지 마라. ★단 ★넘치게 두면 ★추출 문턱이 ★어떻게 되나를 ★한 번 재서 적어라」.
 *  ★★구조로 보면 ★안 바뀐다 — ★끌어내기 판정은 ★`rawLeft/rawTop`(★죔 ★전 좌표)로 서고,
 *    ★죔은 ★그 ★뒤에 온다(`tests/unit/frame-child-clamp-wiring` 이 ★그 순서를 ★이미 잠근다).
 *  ★★그러나 ★구조는 ★«무관해야 정상»까지만 말한다 ⇒ ★★행위로 ★잰다. */
test('K5 ★★더 끌면 ★여전히 ★프레임 밖으로 ★추출된다 — ★자르든 안 자르든 ★같다 (문턱 무변)', async ({ page }) => {
  const got = {};
  /* ⚠️★2026-10-10 ★축 값 교체 — ★옛 꼴 `[false, true]` 는 ★이제 ★★[기본, 켬] = ★★같은 뜻이다.
     ★★그 꼴은 ★빨개지지 ★않고 ★조용히 ★눈이 ★감긴다(두 다리가 ★사본이라 ★축을 ★안 잰다). */
  for (const clipAttr of ['false', null]) {
    const clip = clipAttr === 'false' ? '끔' : '기본';
    const { frameId, childId } = await scene(page, { clipAttr });
    expect((await geom(page, frameId, childId)).clipAttr, `[${clip}] ★전제: ★축 값이 ★안 걸렸다`).toBe(clipAttr);
    /* ★끌어내기가 ★확실히 나는 거리 — ★자식 ★중심이 ★프레임 밖 ★60px 를 ★넘게 */
    const far = await page.evaluate(([f, c]) => {
      const fr = document.getElementById(f), ch = document.getElementById(c);
      return fr.offsetWidth + 60 - ch.offsetWidth / 2 + 80;
    }, [frameId, childId]);
    await selectFrameThenDrag(page, frameId, childId, Math.round(far), 0);
    got[clip] = await page.evaluate(([f, c]) => {
      const fr = document.getElementById(f), ch = document.getElementById(c);
      return { out: ch.parentElement !== fr, parent: ch.parentElement ? (ch.parentElement.id || ch.parentElement.className) : null };
    }, [frameId, childId]);
  }
  console.log(`K5 ★추출 — 끔 ${JSON.stringify(got['끔'])} · 기본(자름) ${JSON.stringify(got['기본'])}`);
  expect(got['끔'].out, `★★끔인 프레임에서 ★멀리 끌었는데 ★안 빠졌다 (부모 ${got['끔'].parent})`
    + ' — ★넘치게 둔 것이 ★추출을 ★막았다면 ★그게 ★새 불편이다').toBe(true);
  expect(got['기본'].out, `★★기본(자르는) 프레임에서 ★멀리 끌었는데 ★안 빠졌다 (부모 ${got['기본'].parent})`
    + ' — ★죔이 ★추출 ★문턱까지 ★먹었다면 ★그게 ★새 불편이다').toBe(true);
});
