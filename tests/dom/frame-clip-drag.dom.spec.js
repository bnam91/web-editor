/* frame-clip-drag — 「★죔은 ★★«정말 자르는 프레임»일 때만」을 ★진짜 드래그로 잰다 (2026-10-09)
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
async function scene(page, { clip = false, radius = null } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  const ids = await page.evaluate(({ clip, radius }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.();
    window.addSection();
    window.addFrameBlock();
    const fr = [...document.querySelectorAll('.frame-block')].find((f) => f.dataset.freeLayout === 'true');
    window.addTextBlock();
    if (clip) fr.dataset.clipContent = 'true';
    if (radius != null) fr.dataset.radius = String(radius);
    return { frameId: fr.id, childId: [...fr.children].map((k) => k.id).pop() };
  }, { clip, radius });
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
    /* ⚠️★`!!` 를 ★빼면 ★`undefined` 가 나온다(radius 가 없을 때) — ★2026-10-09 ★내 자의 흠으로
       ★K1 전제가 ★빨갰다. ★제품이 ★아니라 ★자가 ★틀렸던 자리다. */
    clips: !!(fr.dataset.clipContent === 'true' || (fr.dataset.radius && fr.dataset.radius !== '0')),
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

/** ★사람 순서 — ⑴ 프레임을 ★클릭해 고르고 ⑵ 자식을 ★끈다. ⛔⑴ 을 빼면 자식이 ★안 잡힌다. */
async function selectFrameThenDrag(page, frameId, childId, dx, dy = 0) {
  const f = await page.evaluate((id) => {
    const fr = document.getElementById(id); fr.scrollIntoView({ block: 'center' });
    const b = fr.getBoundingClientRect();
    return { x: Math.round(b.left + 8), y: Math.round(b.top + 8) };
  }, frameId);
  await page.mouse.click(f.x, f.y);
  await page.waitForTimeout(350);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), frameId),
    '★전제: 프레임을 ★못 골랐다 — ★자식이 ★안 잡혀 ★아래가 뜻이 없다').toBe(true);

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

/* ═══ ㉡ ★안 자르는 프레임(기본) — ★넘쳐야 한다 ═══════════════════════════ */

test('K1 ★★안 자르는 프레임(기본) — ★끌면 ★넘친다 ＋ ★밖에서 ★잡힌다 (현빈이 못 보던 그 꼴)', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page);
  const before = await geom(page, frameId, childId);
  expect(before.clips, '★전제: 기본 프레임인데 ★자르는 것으로 읽힌다').toBe(false);
  expect(before.ov, '★전제: 기본 프레임의 overflow 가 ★visible 이 아니다 — 이 건의 전제가 무너졌다').toBe('visible');

  const { plan, need, mid, after } = await dragToOverflow(page, frameId, childId);
  console.log(`K1 ★잰 계획 — 자식폭 ${plan.childW} · 프레임폭 ${plan.frameW} · maxLeft ${plan.maxLeft}`
    + ` · dragOutLeft ${plan.dragOutLeft} · target ${plan.target} · 더 끈 거리 ${need}`);

  expect(after.parentIsFrame, '★끌다가 ★프레임 밖으로 ★추출됐다 — ★이 칸은 ★«안에 남은 채 넘침»을 잰다').toBe(true);
  expect(after.over, `★★안 자르는 프레임인데 ★자식이 ★안 넘쳤다 (넘침 ${after.over}px · left ${after.left})`
    + ' — ★죔이 ★아직 ★전부를 가둔다').toBeGreaterThan(0);
  expect(mid.over, `★★끄는 중에도 ★안 넘쳤다 (${mid.over}px)`).toBeGreaterThan(0);
  expect(after.frameSelected, '★전제: 프레임이 ★선택 해제됐다 — ★아래 히트테스트가 ★뜻이 없다').toBe(true);
  expect(after.hit, `★★넘쳤는데 ★프레임 ★밖 점(${after.probe.x},${after.probe.y})에서 ★안 잡힌다`
    + ' — ★자리만 넘고 ★그려지지 않는다면 ★사용자에겐 ★같은 증상이다').toBe(true);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ ㉠ ★자르는 프레임 — ★여전히 ★가둬야 한다 (T-088 의 까닭은 ★여기서 산다) ═══ */

test('K2 ★★「내용 자르기」 켠 프레임 — ★많이 끌어도 ★가둬진다 (T-088 회귀 자)', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page, { clip: true });
  const before = await geom(page, frameId, childId);
  expect(before.clips, '★전제: 토글을 켰는데 ★안 자르는 것으로 읽힌다').toBe(true);
  expect(before.ov, '★전제: 토글을 켰는데 computed overflow 가 ★hidden 이 아니다').toBe('hidden');

  const { plan, mid, after } = await dragToOverflow(page, frameId, childId);
  console.log(`K2 ★잰 계획 — maxLeft ${plan.maxLeft} · target ${plan.target}(= ★K1 과 ★같은 거리를 끈다)`);
  expect(after.parentIsFrame, '★추출됐다 — 이 칸은 ★안에 남은 채를 잰다').toBe(true);
  expect(after.over, `★★자르는 프레임인데 ★자식이 ★넘쳤다 (${after.over}px) — ★T-088 이 막던 ★「사라지는 띠」가 ★돌아온다`)
    .toBeLessThanOrEqual(0);
  expect(mid.over, `★★끄는 중에 ★넘쳤다 (${mid.over}px)`).toBeLessThanOrEqual(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
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

/* ═══ ★★한 쌍이 ★같은 장면에서 ★갈리나 — ★그림으로도 ═══════════════════════ */

test('K4 ★★같은 끌기 · 같은 장면 — ★토글만 다른데 ★그림이 ★갈린다 (★양·음 한 쌍)', async ({ page }) => {
  const shots = {};
  const overs = {};
  for (const clip of [false, true]) {
    const { frameId, childId } = await scene(page, { clip });
    const { after: g } = await dragToOverflow(page, frameId, childId);
    overs[clip] = g.over;
    /* ★프레임 ★밖 띠를 ★그대로 찍는다 — ⛔「보인다」가 아니라 ★그려진 ★글자다 */
    shots[clip] = crypto.createHash('md5')
      .update(await page.screenshot({ clip: g.band })).digest('hex');
  }
  expect(overs[false], `★안 자르는 판이 ★안 넘쳤다 (${overs[false]}px)`).toBeGreaterThan(0);
  expect(overs[true], `★자르는 판이 ★넘쳤다 (${overs[true]}px)`).toBeLessThanOrEqual(0);
  expect(shots[true], '★★토글만 다른데 ★프레임 밖 띠의 ★그림이 ★같다'
    + ` (md5 ${shots[false]} vs ${shots[true]}) — ★자리는 갈렸는데 ★그림이 안 갈리면 ★사용자는 ★차이를 못 본다`)
    .not.toBe(shots[false]);
});

/* ═══ K5 — ★★«더 끌면 밖으로 빠진다»는 ★별 기능이다. ★문턱이 ★안 바뀌었나 ════════
 *  ★지디 지시 — 「⛔건드리지 마라. ★단 ★넘치게 두면 ★추출 문턱이 ★어떻게 되나를 ★한 번 재서 적어라」.
 *  ★★구조로 보면 ★안 바뀐다 — ★끌어내기 판정은 ★`rawLeft/rawTop`(★죔 ★전 좌표)로 서고,
 *    ★죔은 ★그 ★뒤에 온다(`tests/unit/frame-child-clamp-wiring` 이 ★그 순서를 ★이미 잠근다).
 *  ★★그러나 ★구조는 ★«무관해야 정상»까지만 말한다 ⇒ ★★행위로 ★잰다. */
test('K5 ★★더 끌면 ★여전히 ★프레임 밖으로 ★추출된다 — ★자르든 안 자르든 ★같다 (문턱 무변)', async ({ page }) => {
  const got = {};
  for (const clip of [false, true]) {
    const { frameId, childId } = await scene(page, { clip });
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
  console.log(`K5 ★추출 — 안 자르는 판 ${JSON.stringify(got[false])} · 자르는 판 ${JSON.stringify(got[true])}`);
  expect(got[false].out, `★★안 자르는 프레임에서 ★멀리 끌었는데 ★안 빠졌다 (부모 ${got[false].parent})`
    + ' — ★넘치게 둔 것이 ★추출을 ★막았다면 ★그게 ★새 불편이다').toBe(true);
  expect(got[true].out, `★★자르는 프레임에서 ★멀리 끌었는데 ★안 빠졌다 (부모 ${got[true].parent})`).toBe(true);
});
