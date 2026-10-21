/* dimension-sticker-t3-01 — 사이즈 스티커(치수선)를 ★사람 손 순서로 잠근다.
 *
 * ★★왜 이 벌이 있나 — 2026-10-21 에 ★내가 ★합성 드래그만 재고 ★「된다」고 했다가
 *   현빈이 ★「★아직 ★수직으로밖에 안 움직이는데 ★QA한 거야?」로 ★먼저 봤다.
 *   ★그때 ★안 잰 것이 ★★③클릭(자리 고르기)이었다 — ★사용자가 ★실제로 밟는 ★마지막 걸음.
 *   ⇒ ★이 벌은 ★펜 단추 → 메뉴 「Dimension」 → ★섹션 클릭 ★세 번으로만 만든다.
 *
 * ★무엇을 잠그나
 *   T1 ★3클릭 — ②에서는 ★안 생기고 ③에서 ★생긴다(★더블클릭 ★없이)
 *   T2 ★③클릭 자리가 ★치수선 ★중점 — ★아래뿐 아니라 ★★왼쪽 위로도(★2D)
 *   T3 ★손잡이 ★넷 — d·c(점) 둘 ＋ a·b(치수선 끝) 둘
 *   T4 ★a 를 끌면 ★두 보조선 길이가 ★갈린다 ＋ ★치수선이 ★기운다(현빈 2차 요구)
 *   T5 ⛔음성 — 「Annotation」으로 만든 것은 ★예전 그대로(치수선 요소 ★0 · 이름 Annotation)
 * ⛔waitForTimeout 금지 — expect.poll 만.
 *
 * ★★⚠️이 벌은 ★흔들린다 — 이름 ★`T3-01-DOM-LOAD-SENSITIVE`. ⛔「초록」으로 읽지 마라.
 *   ★13회 돌림(더러운 판 8 ＋ ★깨끗한 판 5): ★전부통과 6 · ★flaky 5 · ★failed 2
 *   ★★상관은 ★한결같다 — ★10~11초로 끝난 회차는 ★전부 통과 · ★18~38초 회차는 ★전부 흔들렸다.
 *   ★★원인으로 ★집었다가 ★★틀린 것 둘(★둘 다 ★상관만 보고 ★가까운 것을 집었다):
 *     ⑴ ★「내가 띄운 Electron 16 pid」 — ★그대로 둔 채 ★통과한 회차가 ★여럿이다.
 *     ⑵ ★「ecosystemd 90%(Spotlight 재색인)」 — ★그것이 ★0.0% 인 판에서도 ★flaky 2/5 였다.
 *   ⇒ ★★「무엇이 ★느리게 만드나」는 ★아직 ★안 갈렸다. ★느린 회차에 ★흔들린다는 ★사실만 섰다.
 *   ★★제품 결함일 가능성은 ★낮아졌다(★failed 0 · ★재시도에서 ★전부 복구) — ⛔다만 ★0 이라 하지 않는다.
 *   ★★대조를 돌렸다(태양 지적: 「★효과 없음」이 아니라 ★「효과를 ★안 쟀다」가 맞다):
 *     ★5초 ×5  — 전부통과 ★1 · flaky ★3 · failed ★2   (load 4.1~4.8)
 *     ★15초 ×5 — 전부통과 ★3 · flaky ★2 · failed ★0   (load 8.2~10.0)
 *     ⇒ ★★부하가 ★더 낮은 판에서 ★5초가 ★더 나빴다 ⇒ ★15초는 ★효과가 ★있다. ★그래서 ★유지한다.
 *     ⚠️⛔그래도 ★「기다리면 통과」는 ★약한 자다 — ★원인은 ★여전히 ★안 갈렸다.
 *   ★다음 걸음: ★흔들리는 칸이 ★T3·T4(★고르기를 거치는 둘)에 ★몰리는지 ★이름으로 세라.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';
const cnt = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

async function setup(page) {
  await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML =
      '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.buildLayerPanel?.();
  });
}

/** ★사람 손 그대로 — 펜 단추 → 메뉴 → 섹션 클릭 N 번. third 가 ∅ 면 ★두 번만 누른다. */
async function drawDim(page, { dx = 0, dy = 140, menu = 'Dimension', third = true } = {}) {
  await page.click('#fp-pen-btn');
  await page.click(`#fp-pen-menu .fp-menu-item:text-is("${menu}")`);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')),
    '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  const x1 = r.left + r.width * 0.3, y1 = r.top + r.height * 0.4;
  const x2 = r.left + r.width * 0.6, y2 = y1;
  await clickAt(page, x1, y1, { sel: SEC }, { label: '①점' });
  await clickAt(page, x2, y2, { sel: SEC }, { label: '②점' });
  const mid = { x: (x1 + x2) / 2 + dx, y: y1 + dy };
  /* ★★③자리는 ★섹션 ★밖일 수 있다 — ★치수선은 ★선 바깥으로 빼는 것이라 ★경계를 ★자주 넘는다.
     ★제품은 ★그 클릭을 ★받는다(자리 고르는 중이면 ★이미 정해진 섹션을 쓴다 · 261021 고침).
     ⇒ ⛔여기서 `{sel: SEC}` 를 ★걸면 ★검사 ★헬퍼가 ★제품보다 ★좁아 ★거짓 빨강이 난다(이 벌의 첫 판이 그랬다). */
  if (third) await clickAt(page, mid.x, mid.y, null, { label: '③자리' });
  return { r, x1, y1, x2, y2, mid };
}

/** 치수선 중점을 ★섹션 좌표로 */
const dimMid = (page) => page.evaluate(() => {
  const l = document.querySelector('#secA .annot-dim-line');
  if (!l) return null;
  const N = (k) => Number(l.getAttribute(k));
  return [(N('x1') + N('x2')) / 2, (N('y1') + N('y2')) / 2];
});
const toSec = (page, cx, cy) => page.evaluate(([x, y]) => {
  const r = document.getElementById('secA').getBoundingClientRect();
  const z = (window.currentZoom || 40) / 100;
  return [(x - r.left) / z, (y - r.top) / z];
}, [cx, cy]);

/** ★만든 ★직후에는 ★라벨이 ★편집 상태다(_finalizeAnnotation 의 enterLabelEdit).
 *  ★그 상태에서 ★누르면 ★캐럿만 옮고 ★선택이 ★안 된다 — ★그 판이 ★flaky 였다(T3 1/3).
 *  ⇒ ★편집에서 ★빠져나온 것을 ★기다린 뒤 ★고른다. ★사람도 ★한 번 빠져나와야 고를 수 있다. */
async function selectDim(page) {
  /* ★★★261021 — ★이 벌의 ★흔들림은 ★여기 ★한 단언에 ★몰렸다(6회 중 T4 4 · T3 1 · 다른 칸 ★0).
     ★까닭: `Escape` 는 ★라벨에 ★걸린 keydown 이다(annotation-select.js:697 → label.blur() → finish).
       ⇒ ★★라벨에 ★포커스가 ★가기 ★전에 누르면 ★안 닿는다. ★사람은 ★포커스가 간 ★뒤에 누른다.
     ⇒ ★★「편집이 ★시작됐다」를 ★먼저 기다린다. ⛔그 전에 Escape 를 쏘면 ★제품이 아니라 ★검사가 ★빠른 것이다. */
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('#secA .annot-label')?.getAttribute('contenteditable') ?? 'none'),
    '★전제: 라벨이 ★편집에 ★들어갔다(만든 직후 enterLabelEdit)', { timeout: 15000 }).toBe('true');
  /* ★★261021 ★대조 실측 — ★「라벨 밖(섹션 빈 모서리) 클릭」으로 ★바꿔 봤더니 ★★6/6 이 ★빨강이었다
     (T3·T4 ★둘 다 · unexpected). ⇒ ★★되돌렸다. ★Escape 쪽이 ★낫다(T4 ★2/6).
     ⚠️`Escape` 는 ★두 곳이 듣는다(라벨 편집 :697 · 고르기 해제 :32) — ★그 경쟁이 ★남은 2/6 로 보이나
       ★★대조로 ★증명하지 ★못했다. ⛔「그래서다」라 ★적지 않는다. */
  await page.keyboard.press('Escape');                       // 라벨 편집 종료
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('#secA .annot-label')?.getAttribute('contenteditable') ?? 'none'),
    '★전제: 라벨이 ★편집에서 빠져나왔다', { timeout: 15000 }).not.toBe('true');
  await page.keyboard.press('Escape');                       // 펜 모드 종료
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')),
    '★전제: 펜 모드가 꺼졌다').toBe(false);
  /* ★★1.5px 선이 아니라 ★면적이 있는 ★라벨을 누른다 — ⛔「선택이 안 된다」를 규칙으로 읽지 마라, ★면적이다 */
  await page.click('#secA .annot-label', { force: true });
  /* ★★전제를 ★갈라 센다 — ⛔「손잡이 4」 하나만 재면 ★「★안 골랐다」와 ★「★손잡이가 ★안 선다」가 ★구분 안 된다.
     ★그리고 ★부하가 걸린 회차(18~24초)에서 ★흔들렸다 ⇒ ★★기다림을 ★넉넉히(15초) 준다.
     ⛔「기다리면 통과」는 ★약한 자다 — ★그래서 ★무엇을 기다리는지 ★이름을 ★붙여 ★갈라 둔다. */
  await expect.poll(() => page.evaluate(() =>
    !!document.querySelector('#secA .annotation-block.selected')),
    '★전제: 블럭이 ★골라졌다(클릭이 ★먹었다)', { timeout: 15000 }).toBe(true);
  await expect.poll(() => cnt(page, '#secA .annot-handle'),
    '★골랐는데 ★손잡이가 ★넷이 아니다', { timeout: 15000 }).toBe(4);
}

test.describe('t3-01 사이즈 스티커 — 사람 손 순서', () => {
  test('T1 ★②에서는 ★안 생기고 ★③에서 ★생긴다 (더블클릭 없이)', async ({ page }) => {
    await setup(page);
    await drawDim(page, { third: false });
    expect(await cnt(page, '#secA .annotation-block'), '★②까지 눌렀는데 ★벌써 만들어졌다').toBe(0);
    expect(await cnt(page, '#secA .annot-preview-dim'), '★②뒤 ★임시 치수선이 ★안 보인다').toBeGreaterThan(0);

    const r = await waitStableRect(page, SEC);
    await clickAt(page, r.left + r.width * 0.45, r.top + r.height * 0.4 + 140, null, { label: '③자리' });
    await expect.poll(() => cnt(page, '#secA .annotation-block'), '★③에서 ★안 생겼다').toBe(1);
    expect(await cnt(page, '#secA .annot-dim-line'), '★치수선이 ★없다').toBe(1);
    expect(await cnt(page, '#secA .annot-line'), '⛔폴리라인이 ★있다 — 치수 분기가 ★안 먹었다').toBe(0);
    expect(await cnt(page, '#secA .annot-dim-ext'), '★보조선이 ★둘이 아니다').toBe(2);
    expect(await cnt(page, '#secA .annot-preview-dim'), '★만든 뒤 ★임시선이 ★남았다').toBe(0);
  });

  test('T2 ★③클릭 자리가 ★치수선 중점 — ★아래 ＋ ★★왼쪽 위(2D)', async ({ page }) => {
    for (const [name, dx, dy] of [['아래', 0, 140], ['왼쪽 위', -160, -90]]) {
      await setup(page);
      const { mid } = await drawDim(page, { dx, dy });
      await expect.poll(() => cnt(page, '#secA .annotation-block'), `★${name}: 안 생겼다`).toBe(1);
      const want = await toSec(page, mid.x, mid.y);
      const got = await dimMid(page);
      expect(got, `★${name}: 치수선이 ★없다`).not.toBeNull();
      const d = Math.hypot(got[0] - want[0], got[1] - want[1]);
      expect(d, `★${name}: 커서 ${JSON.stringify(want.map(Math.round))} 인데 중점 ${JSON.stringify(got.map(Math.round))} (차 ${d.toFixed(1)})`)
        .toBeLessThan(8);
    }
  });

  test('T3 ★손잡이 ★넷 — d·c 둘 ＋ a·b 둘', async ({ page }) => {
    await setup(page);
    await drawDim(page);
    await selectDim(page);
    expect(await cnt(page, '#secA .annot-dim-handle'), '★치수선 끝 손잡이가 ★둘이 아니다').toBe(2);
    expect(await page.evaluate(() =>
      [...document.querySelectorAll('#secA .annot-handle')].filter((h) => h.dataset.pointIdx != null).length),
      '★점 손잡이가 ★둘이 아니다').toBe(2);
  });

  test('T4 ★a 를 끌면 ★두 보조선 길이가 ★갈리고 ★치수선이 ★기운다', async ({ page }) => {
    await setup(page);
    await drawDim(page);
    await selectDim(page);
    await expect.poll(() => cnt(page, '#secA .annot-dim-handle'), '★치수선 끝 손잡이가 ★둘이 아니다').toBe(2);

    const extLens = () => page.evaluate(() => [...document.querySelectorAll('#secA .annot-dim-ext')]
      .map((l) => { const N = (k) => Number(l.getAttribute(k)); return Math.hypot(N('x2') - N('x1'), N('y2') - N('y1')); }));
    const before = await extLens();
    expect(Math.abs(before[0] - before[1]), '★전제: 끌기 ★전에는 ★두 보조선이 ★같은 길이다').toBeLessThan(1);

    const h = await page.locator('#secA .annot-dim-handle').first().boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    for (const k of [1, 2, 3]) await page.mouse.move(h.x - 40 * k, h.y + 30 * k);
    await page.mouse.up();

    const after = await extLens();
    expect(Math.abs(after[0] - after[1]), `★두 보조선이 ★그대로 같다 (${after.map((v) => v.toFixed(0)).join(' · ')}) — a·b 가 ★안 갈렸다`).toBeGreaterThan(5);
    const tilted = await page.evaluate(() => {
      const l = document.querySelector('#secA .annot-dim-line');
      return Math.abs(Number(l.getAttribute('y1')) - Number(l.getAttribute('y2')));
    });
    expect(tilted, '★치수선이 ★안 기울었다').toBeGreaterThan(2);
  });

  test('T5 ⛔음성 — 「Annotation」은 ★예전 그대로다', async ({ page }) => {
    await setup(page);
    await drawDim(page, { menu: 'Annotation', third: false });
    await page.keyboard.press('Enter');                        // 어노테이션은 2점에서 Enter 로 끝낸다
    await expect.poll(() => cnt(page, '#secA .annotation-block'), '★어노테이션이 ★안 생겼다').toBe(1);
    expect(await cnt(page, '#secA .annot-dim-line'), '⛔일반 어노테이션에 ★치수선이 ★생겼다').toBe(0);
    expect(await cnt(page, '#secA .annot-dim-ext'), '⛔일반 어노테이션에 ★보조선이 ★생겼다').toBe(0);
    expect(await cnt(page, '#secA .annot-line'), '★폴리라인이 ★없다 — 어노테이션이 ★깨졌다').toBe(1);
    expect(await page.evaluate(() => document.querySelector('#secA .annotation-block').dataset.annotKind ?? ''),
      '⛔일반 어노테이션에 ★annotKind 가 붙었다').toBe('');
  });
});
