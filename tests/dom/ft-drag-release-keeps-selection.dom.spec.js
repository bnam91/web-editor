/* ft-drag-release-keeps-selection.dom.spec.js
 *   ★★`FT-DRAG-RELEASE-DESELECTS-01` — ★손잡이를 ★끌고 ★놓으면 ★선택이 ★풀린다. (2026-10-25 신설)
 *
 * ★★현빈 261025(자유변형 ③ 의 곁) : 「★다시 나간 모서리핸들을 ★조절해야되는 경우 ★찾기 힘든 문제」
 *   ★미카사 실측 : ★nw 를 끌면 ★선택이 ★풀린다 ⇒ ★`_shouldShow` 가 `.selected` 를 요구하므로
 *   ★★손잡이가 ★통째로 ★사라진다. ⇒ ★「찾기 힘들다」의 ★절반이 ★이것이다.
 *
 * ★★기전 — ★소스로 ★끝까지 ★추적됐다(⛔추측 아니다)
 *   `onUp`(effects-ft-handles.js) 에 ★click 삼키기가 ★없다
 *     → ★mouseup 뒤 ★브라우저가 ★합성 `click` 을 ★공통 조상에서 낸다
 *     → `js/editor.js` 의 `sec.addEventListener('click')` → `selectSectionWithModifier(sec)`
 *     → ★`deselectAll()`
 *   ★★이 사슬은 ★레포가 ★이미 적어 뒀다 — `js/block-drag.js:675~676` :
 *     「… deselectAll 한다. 그래서 «손잡이로 크기를 바꾼 바로 그 순간» 선택이 풀리고 …」
 *   ⇒ ★`block-drag` 는 ★제 자리에 ★killClick 을 ★박아 ★피했고(:684), ★자유변형은 ★안 박았다.
 *
 * ★★★왜 ★진짜 마우스를 ★쓰나 — ⛔`dispatchEvent` 로는 ★이 결함을 ★못 잡는다.
 *   ★`mousedown`·`mousemove`·`mouseup` 을 ★손으로 ★내도 ★브라우저는 ★`click` 을 ★안 만든다.
 *   ⇒ ★★그 합성 `click` 이 ★바로 ★범인이라, ★손으로 낸 장면에서는 ★★증상이 ★안 난다
 *     (= ★초록이 ★「고쳐졌다」가 ★아니라 ★「안 재고 있다」가 된다).
 *   ⇒ ★`page.mouse` (CDP Input) 로 ★★진짜 입력을 ★넣는다.
 *
 * ★단언
 *   D0 ★전제 — 손잡이 12 · `.selected` 가 ★켜져 있다 · nw 손잡이가 ★0×0 이 ★아니다
 *   D1 ★★주  — ★진짜로 ★끈 뒤(★네 점이 ★바뀌었음을 ★같이 단언) ★여전히 ★`.selected` 이고 ★손잡이 12
 *   ★양성대조 핀 = ★`4eff00ba` (⛔`b6c5f87d` 를 ★쓰지 마라 — ★거기엔 ★FT-1 빨강이 ★섞인다)
 *
 * ⚠️안 쟀다 — ★제자리 클릭(안 움직이고 ★누르고 ★떼기)이 ★어떻게 되어야 ★맞는지.
 *   ★지금 처방은 `!first` 로 ★끌림이 있을 때만 ★삼킨다. ★제자리는 ★옛 동작 그대로다.
 *   ★이름 = `FT-HANDLE-PLAIN-CLICK-BEHAVIOR-UNJUDGED-01`
 *
 * ★★★양성대조 — ★돌려 ★쟀다 (2026-10-25 · ★3회씩)
 *   ★핀 `b382ef53`(고치기 ★직전) : ★D1 ★★빨강 — `{sel:false, h:0}` ★선택이 풀리고 ★손잡이 ★전멸
 *   ★고친 판 `652a0c52`          : ★D1 ★초록 — `{sel:true, h:12}` ★★3/3 · flaky 0
 *
 * ★★★⛔내 ★첫 자는 ★«거짓음성»이었다 — ★이 글을 ★지우지 ★마라
 *   ★처음엔 ★nw 를 ★`+34,+23`(블럭 ★«안»쪽)으로 끌었다. ⇒ ★놓는 자리의 임자 사슬이
 *     `["tfh-handle corner","tfh-layer","text-block selected","frame-block","section-inner"]`
 *     = ★★«다른 ★손잡이 위»에 놓고 있었다 ⇒ ★click 이 ★블럭에 가서 ★deselect 가 ★안 났다
 *   ⇒ ★★핀에서도 ★3/3 ★초록이었다. ★그 초록은 ★「고쳐졌다」가 ★아니라 ★★«안 재고 있다»였다.
 *   ★무엇이 ★구해 줬나 : ★양성대조를 ★했다는 것 ★하나다. ⛔안 했으면 ★거짓 초록으로 ★닫았다.
 *   ★고침 : ★`-48,-34`(블럭 ★«밖») 로 끈다 ⇒ 임자 사슬 `["canvas-wrap","canvas-area",…]`
 *   ⇒ ★★그래서 ★«놓는 자리의 임자»를 ★로그에 ★박아 둔다 — ★이 자가 ★또 멀어지면 ★그 줄이 ★말한다.
 *
 * ⚠️★재현된 경로는 ★내가 추적한 것과 ★«다를 수 있다»
 *   ★소스 추적 : `sec` click → `selectSectionWithModifier` → `deselectAll`
 *   ★실제 재현 : 놓은 자리가 ★`canvas-wrap` 이었다(섹션 ★밖)
 *   ★★★`FT-DESELECT-HANDLER-ON-CANVASWRAP-UNIDENTIFIED-01` = ★★닫혔다 (261025 · 소스로 확인)
 *     ★그 click 을 받는 자 = ★`js/editor.js:4411` :
 *       `document.getElementById('canvas-wrap').addEventListener('click', e => {`
 *       `  if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll(); });`
 *     ⇒ ★내 대조가 ★놓은 자리의 ★`e.target.id` 가 ★`canvas-wrap` 이었으므로 ★★이 갈래가 ★맞다.
 *   ★다른 갈래(섹션 ★안에 놓을 때)도 ★같은 끝에 닿는다 :
 *     `js/editor.js:4392` 섹션 click → `:1382` → `selectSection`
 *     → ★`js/editor.js:3803` ★첫 줄이 ★`deselectAll()`
 *   ★그리고 ★손잡이가 ★0 이 되는 자리 = `js/editor.js:4015` ★`clearSelectionMarks` 안의
 *     ★`window.ftHandlesClear?.(t)` ⇒ ★손잡이 ＋ 테두리 ＋ 격자가 ★한꺼번에 걷힌다
 *     (★그래서 핀 대조의 값이 ★`h:0` 이었다 — ★수가 ★이 사슬로 ★설명된다)
 *   ⇒ ★★처방(document capture 에서 삼키기)은 ★두 갈래를 ★다 덮는다.
 *   ★처방은 ★양쪽을 ★다 덮는다(★document capture 에서 ★삼키므로) — ⛔그러나 ★「경로를 ★알았다」로
 *     ★적지 ★않는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-drag-release
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];

async function setup(page) {
  return await page.evaluate(async (corners) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'dtb';
    ft.setFxFreeTransform(tb, corners, { history: false });
    window.selectBlock?.(tb.id);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const nw = tb.querySelector('.tfh-layer > [data-tfh="nw"]');
    const q = nw ? nw.getBoundingClientRect() : null;
    return {
      handles: tb.querySelectorAll('.tfh-handle').length,
      selected: tb.classList.contains('selected'),
      corners: tb.dataset.tfCorners || '',
      nw: q ? { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height } : null,
    };
  }, TRAP);
}

async function read(page) {
  return await page.evaluate(() => {
    const tb = document.getElementById('dtb');
    if (!tb) return { gone: true };
    return {
      gone: false,
      handles: tb.querySelectorAll('.tfh-handle').length,
      selected: tb.classList.contains('selected'),
      corners: tb.dataset.tfCorners || '',
    };
  });
}

test('D0 ★전제 — 손잡이 12 · 선택 켜짐 · nw 가 0×0 이 아니다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  const errs = await bootApp(page);
  const r = await setup(page);
  expect(r.handles, '★손잡이가 12 가 아니다 — 자유변형이 안 켜졌다').toBe(12);
  expect(r.selected, '★`.selected` 가 꺼져 있다 — 아래 판정이 뜻을 잃는다').toBe(true);
  expect(r.nw, '★nw 손잡이를 못 찾았다').toBeTruthy();
  /* ★★0×0 «유령»이면 ★진짜 마우스가 ★닿지 ★않는다 — ★그 초록은 ★안 재고 있다 */
  expect(r.nw.w * r.nw.h, `★nw 손잡이가 0 면적이다 (${r.nw.w}×${r.nw.h}) — 끌 수 없다`).toBeGreaterThan(1);
  console.log('[D0] nw=', JSON.stringify(r.nw), '· 손잡이', r.handles);
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('D1 ★★★끌고 놓아도 선택이 ★살아 있다 (＝ 손잡이가 안 사라진다)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const a = await setup(page);
  expect(a.nw, '★전제 실패 — nw 가 없다').toBeTruthy();

  /* ★★★좌표를 ★끌기 ★직전에 ★다시 잰다 — ⛔`setup` 이 돌려준 값은 ★낡는다.
     ★261025 실측 : 낡은 좌표로 끌면 ★네 점이 ★안 바뀌고 검사가 ★흔들렸다(1 flaky).
     ★그래서 ★playwright 로 ★다시 재고, ★그 자리에 ★무엇이 있는지도 ★같이 찍는다 —
     ⛔「닿았다」를 ★가정하지 ★않는다(★0×0 유령·★위에 덮인 것 둘 다 ★여기서 드러난다). */
  /* ★★★«판이 섰나»를 ★기다린다 — ⛔고정 대기(waitFor`＋`Timeout)로 ★두지 ★않는다.
     ★261025 실측 : 배율이 ★아직 ★안 앉아 nw 손잡이가 ★7.496×7.496 로 읽혔고(앉은 뒤 ★7×7),
       ★좌표를 ★재고 ★마우스를 ★옮기는 ★사이에 ★배치가 ★움직여 ★7.5px 짜리를 ★빗나갔다
       ⇒ ★`tfCorners` 가 ★안 바뀌어 ★검사가 ★흔들렸다(1 flaky ★두 번).
     ⇒ ★★«같은 상자가 ★두 번 ★연속» 읽힐 때까지 ★기다리고, ★안 서면 ★빨강으로 ★말한다. */
  /* ⛔«고정 대기»(`waitFor`＋`Timeout`)로 ★기다리지 ★않는다 — `tests/unit/dom-fixed-wait-census` 가 ★그것을 ★잡는다
     ★★⚠️이 주석에서 ★그 이름을 ★★쪼개 ★쓰는 ★까닭 : ★그 자는 ★★주석까지 ★글자로 ★센다.
       ★그 파일이 ★제 머리말에서 ★같은 일을 ★겪고 ★「표본은 ★조립해서 ★써라」라고 ★적어 뒀다(:388).
       ⇒ ★★주석이 ★소스 파싱 게이트의 ★«입력»이다.
       (★그 자가 ★이 파일을 ★잡아서 ★고쳤다 · 2026-10-25 · 「★머지 18 에서 ★그랬다」 전례).
     ★레포 관용구는 ★`_root-harness.js:97` 의 ★`waitStableRect` 다(★94 파일에서 쓴다 —
       ★내가 ★손으로 ★다시 지은 것이 ★95번째 사본이었다).
     ⚠️★★그런데 ★그 자는 ★`Math.round` 를 쓴다 ⇒ ★★7.496 과 ★7 을 ★«같다»고 ★본다
       = ★★내 흔들림의 ★원인을 ★못 본다. ★이름 = `WAITSTABLERECT-ROUNDS-AWAY-SUBPIXEL-01`
     ⇒ ★그래서 ★`waitForFunction`(★인정되는 조건 대기)으로 ★★부분픽셀까지 ★같을 때까지 기다린다. */
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-tfh="nw"]');
    if (!el) return false;
    const b = el.getBoundingClientRect();
    const cur = [b.left, b.top, b.width, b.height].join(',');
    const same = window.__ftPrevRect === cur;
    window.__ftPrevRect = cur;
    return same && b.width > 1;        /* ★0×0 «유령»도 여기서 걸러진다 */
  }, null, { timeout: 5000 });
  const box = await page.locator('[data-tfh="nw"]').boundingBox();
  expect(box, '★nw 손잡이의 boundingBox 가 없다 — 화면에 없다').toBeTruthy();
  const hx = box.x + box.width / 2; const hy = box.y + box.height / 2;
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? ((el.getAttribute && el.getAttribute('data-tfh')) || el.className || el.tagName) : null;
  }, [hx, hy]);
  console.log('[D1] nw 상자=', JSON.stringify(box), '· 그 자리의 임자=', JSON.stringify(hit));
  /* ★★닿는가 — ★이 칸이 빨개지면 ★아래 끌기는 ★«일어나지도» 않는다 */
  expect(String(hit), `★nw 자리의 임자가 ★손잡이가 ★아니다 (${hit}) — ★끌어도 ★안 잡힌다`).toContain('nw');

  /* ★★진짜 입력 — ⛔dispatchEvent 로는 합성 click 이 안 나서 이 결함을 못 잡는다 */
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx - 24, hy - 18, { steps: 6 });
  /* ★★끌기 «중»에 ★정말 ★잡혔나 — ⛔「조용한 빗나감」을 ★또렷한 전제 실패로 바꾼다 */
  const mid = await page.evaluate(() => document.getElementById('dtb').dataset.tfCorners || '');
  expect(mid !== a.corners,
    `★끌기 «중»에 ★네 점이 ★안 바뀌었다 (${a.corners}) — ★손잡이를 ★못 잡았다(빗나감). ` +
    '★닿음 단언은 통과했으니 ★누른 «뒤»에 ★배치가 움직였다는 뜻이다'
  ).toBe(true);
  await page.mouse.move(hx - 48, hy - 34, { steps: 6 });
  /* ★★놓는 ★자리의 ★임자를 ★찍는다 — ★합성 click 이 ★누구에게 가나가 ★이 결함의 ★전부다 */
  const upHit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    const ch = []; for (let e = el; e; e = e.parentElement) ch.push((e.getAttribute && e.getAttribute('class')) || e.id || e.tagName);
    return ch.slice(0, 5);
  }, [hx - 48, hy - 34]);
  console.log('[D1] ★놓는 자리의 임자 사슬=', JSON.stringify(upHit));
  /* ★★★고정 대기 ★대신 ★«범인 사건»을 ★기다린다 — ⛔ms 로 재지 ★않는다.
     ★이 결함의 원인은 ★mouseup 뒤 ★브라우저가 내는 ★합성 `click` 이다.
     ⇒ ★그 click 을 ★★«봤을 때» ★재면 ★시간이 아니라 ★★인과로 ★맞춘다.
     ★내 처방은 ★document ★capture 에서 ★삼키는데, ★이 셈플러는 ★★mouseup «전»에 등록돼
       ★같은 target·같은 phase 에서 ★★먼저 돈다 ⇒ ★고친 판·핀 판 ★둘 다에서 ★click 을 ★본다
       (⛔안 보면 ★전제 실패로 ★말한다 — ★조용히 지나가지 ★않는다). */
  await page.evaluate(() => {
    window.__ftClicks = 0;
    document.addEventListener('click', () => { window.__ftClicks++; }, true);
  });
  await page.mouse.up();
  await page.waitForFunction(() => window.__ftClicks > 0, null, { timeout: 3000 })
    .catch(() => { throw new Error('★mouseup 뒤 ★합성 click 이 ★3초 안에 ★안 났다 — ★이 장면은 ★이 결함을 ★못 잰다'); });

  const b = await read(page);
  console.log('[D1] 끌기 전=', JSON.stringify({ sel: a.selected, h: a.handles }),
    '· 뒤=', JSON.stringify({ gone: b.gone, sel: b.selected, h: b.handles }),
    '· 네 점 바뀜=', a.corners !== b.corners);

  /* ★★전제에 ★이가 있다 — ★«정말 끌렸나». ⛔안 끌렸으면 「선택이 살아 있다」가 ★공짜 초록이다 */
  expect(b.gone, '★블럭이 사라졌다 — 장면이 무너졌다').toBe(false);
  expect(a.corners !== b.corners,
    `★네 점이 ★안 바뀌었다 (${a.corners} → ${b.corners}) — ★끌림이 없었으므로 ★아래 판정은 못 쓴다`
  ).toBe(true);

  expect(b.selected,
    '★★끌고 놓자 ★선택이 ★풀렸다 — ★`onUp` 이 ★합성 click 을 ★안 삼켜 ' +
    '★`block-drag` click → `deselectAll` 이 ★돌았다(`FT-DRAG-RELEASE-DESELECTS-01`)'
  ).toBe(true);
  expect(b.handles,
    `★손잡이가 ${b.handles} 개로 ★줄었다 — ★선택이 풀려 ★_shouldShow 가 ★꺼졌다`
  ).toBe(12);
});
