/* text-ft-handles-u3.dom.spec.js — 글상자 ★자유변형 ★U3 «모서리 손잡이» ★동작
 *   (2026-10-24 · 지디 · ★현빈 GO 「바로 시작하고」 · 발주 `ORDER-u3-handles-261023.md` ⑤)
 *
 * ★★★이 벌이 재는 것 = ★★«동작»뿐이다. ⛔«모양»은 ★여기 없다.
 *   ★까닭(실측 261024 · ★현빈 신고) : 「★왜 ★시안에서 ★보여준 거랑 ★모습이 ★다른가?
 *     ★격자가 ★안 ★보이고 ★보라색 ★아웃라인 ★두께도 ★다르네」
 *   ⇒ ★★★나는 ★그 ★시안을 ★★본 ★적이 ★없다 ⇒ ★★모양을 ★지어내 ★단언하면 ★★★거짓 초록이 된다.
 *   ⇒ ★그래서 ★★격자 모양·선 두께·기준선은 ★★★이 벌에 ★★없다. ★시안이 오면 ★★따로 ★얹는다.
 *     ★이름 = `U3-SHAPE-UNMEASURED-01` (★★«못 쟀다» 명부 · ⛔결함 아님)
 *
 * ★★장면은 ★앱 입구로만 — `addSection()`·`selectSection()`·`addTextBlock()` ＋ ★진짜 마우스 클릭.
 *   ⇒ 「그 꼴이 앱에서 생기나」가 ★구성상 참이다(★U2 벌 :16 의 규율 그대로).
 * ⛔고정 대기 0 — `waitForFunction`/`toPass` 로 «무엇을 기다리나»를 쓴다.
 *
 * ★★★U2 벌(text-freetransform.dom.spec.js) ★P0 의 ★범위 단언에 ★★한 칸이 ★비었다 — ★여기서 ★메운다:
 *   ★그 단언 : `document.querySelectorAll('[data-tf-resize-dir]').length === 0`
 *     「★U2 는 ★핸들이 ★없다 — ★떴다면 ★U3 가 ★섞였다」
 *   ★★★그런데 ★U3 의 손잡이는 ★`.tfh-handle`(`data-tfh`)이라 ★★그 자에 ★★안 ★걸린다(★실측: grep 0).
 *   ⇒ ★★★즉 ★U3 를 ★만든 ★지금도 ★그 단언은 ★★★초록이다 = ★★«항상 참»이 ★됐다.
 *   ⇒ ★★교훈 「★내가 건 단언이 «항상 참»이라 ★아무것도 안 잠갔다」 ⇒ ★★이름 `U2-SCOPE-ASSERT-WENT-ALWAYS-TRUE-01`
 *   ⛔그 단언을 ★지우지 ★마라 — ★★뜻을 ★뒤집어 ★다시 적는 것은 ★★★별건이다(선례 T5b 434ff0ef).
 *     ★여기서는 ★★«U3 의 손잡이가 ★실제로 ★몇 개인가»를 ★★제 이름으로 ★잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PANEL_OF = { ftTB: 'txt' };

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection();
    const sec = document.querySelector('.section-block');
    sec.id = 'ftS';
    window.selectSection(sec); window.addTextBlock('h1');
    const tbs = sec.querySelectorAll('.text-block');
    /* ★마지막 것이 우리 것 — `insertAfterSelected` 라 뒤에 붙는다(U2 벌 :47 의 까닭 그대로) */
    tbs[tbs.length - 1].id = 'ftTB';
  });
  return errs;
}

const pick = async (page, id) => {
  await expect(async () => {
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
    const p = await page.evaluate((i) => { const q = document.getElementById(i).getBoundingClientRect(); return [q.left + 6, q.top + q.height / 2]; }, id);
    await page.evaluate(() => { window.deselectAll?.(); });
    await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(([i, P]) => document.getElementById(i).classList.contains('selected') && !!document.getElementById(`${P}-fx-section`),
      [id, PANEL_OF[id]], { timeout: 3000 });
  }).toPass({ timeout: 20000 });
};

const addFt = async (page, P = 'txt') => {
  await page.selectOption(`#${P}-fx-add`, 'freetransform');
  await page.waitForFunction((p) => !!document.getElementById(`${p}-fxft-card`), P);
};

/** 손잡이·격자 수 ＋ 네 점 — ⛔칸마다 다른 자를 쓰지 않는다(자가 둘이면 수가 갈린다). */
const read = (page) => page.evaluate(() => {
  const tb = document.getElementById('ftTB');
  return {
    handle: document.querySelectorAll('.tfh-handle').length,
    grid: document.querySelectorAll('.tfh-grid').length,
    mine: tb ? tb.querySelectorAll(':scope > .tfh-handle').length : -1,
    selected: tb ? tb.classList.contains('selected') : null,
    corners: tb ? (tb.dataset.tfCorners || null) : null,
  };
});

/* ── H0 ★전제 — ★모듈이 실렸고 ★U2 가 선다 ────────────────────────────── */
test('H0 ★전제 — U3 모듈이 ★실렸고 ★문(API)이 ★열려 있다 (⛔비면 아래 0건은 「안 재고 있다」다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => ({
    api: ['ftHandlesSync', 'ftHandlesClear', 'ftHandlesSyncAll'].filter(k => typeof window[k] === 'function'),
    script: [...document.querySelectorAll('script[src]')].some(s => s.src.indexOf('effects-ft-handles') >= 0),
    css: (() => { try { return [...document.styleSheets].some(ss => [...ss.cssRules].some(r2 => (r2.selectorText || '').indexOf('.tfh-handle') >= 0)); } catch (e) { return false; } })(),
  }));
  console.log('[H0]', JSON.stringify(r));
  expect(r.script, '⛔`js/effects-ft-handles.js` 가 index.html 에 안 실렸다').toBe(true);
  expect(r.api, '⛔window 에 U3 문이 셋 다 안 열렸다').toEqual(['ftHandlesSync', 'ftHandlesClear', 'ftHandlesSyncAll']);
  expect(r.css, '⛔`.tfh-handle` CSS 규칙이 없다 — 손잡이가 보여도 크기가 0 일 수 있다').toBe(true);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ── H1 ★켜면 ★손잡이가 ★뜬다 ＋ ★음성대조(켜기 전엔 0) ──────────────── */
test('H1 ★자유변형을 켜면 ★모서리 손잡이가 ★뜬다 — ⛔켜기 «전»엔 0 (★음성대조 한 쌍)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  const before = await read(page);
  console.log('[H1-before]', JSON.stringify(before));
  expect(before.handle, '★음성대조: 켜기 전에 손잡이가 있다 — 이 벌이 켜짐을 안 재고 있다').toBe(0);
  expect(before.corners, '★음성대조: 켜기 전에 tfCorners 가 있다').toBe(null);

  await addFt(page);
  await page.waitForFunction(() => document.querySelectorAll('.tfh-handle').length > 0, null, { timeout: 5000 });
  const after = await read(page);
  console.log('[H1-after]', JSON.stringify(after));
  /* ⛔「12」를 박지 않는다 — ★지금 판은 ★모서리 넷뿐이다(`homography.js:22` 가 `i<4` · 4점 전용).
     ★변 여덟(1/3·2/3)은 ★현빈 결정 대기다(⒜ 변 전체 밀기 / ⒝ Warp=메시 필요).
     ⇒ ★그래서 ★★«수를 판에서 읽어» 적고, ★★«4 이상»만 단언한다. ★결정이 오면 이 칸을 뒤집어 적는다.
     ★이름 = `U3-EDGE-HANDLES-UNDECIDED-01` */
  expect(after.handle, '⛔켰는데 손잡이가 0 — U3 가 안 붙는다').toBeGreaterThanOrEqual(4);
  expect(after.mine, '⛔손잡이가 그 블럭의 «자식»이 아니다 — 명부(editor-ui-roster)가 못 걷는다').toBe(after.handle);
  expect(after.grid, '⛔격자가 안 붙었다').toBeGreaterThanOrEqual(1);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ── H2 ★놓으면 ★걷힌다 ＋ ★다시 고르면 ★다시 뜬다 ──────────────────── */
test('H2 ★놓으면 ★걷히고 ★다시 고르면 ★다시 뜬다 (★★현빈 신고 둘을 ★한 쌍으로)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  await page.waitForFunction(() => document.querySelectorAll('.tfh-handle').length > 0, null, { timeout: 5000 });
  const on = await read(page);

  /* ★놓는다 — ★앱 제 문으로(`deselectAll`). ★사람이 ★빈 곳을 ★누르는 ★그 길이다. */
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForFunction(() => document.querySelectorAll('.tfh-handle').length === 0, null, { timeout: 5000 })
    .catch(() => {});
  const off = await read(page);
  console.log('[H2]', JSON.stringify({ on, off }));
  /* ★★현빈 261024 신고 : 「★tb_… 편집 끝났는데 ★보라색 아웃라인이 ★아직 보인다」 */
  expect(off.handle, '⛔놓았는데 손잡이가 남는다 — 현빈 신고 그 자리(보라색이 안 걷힌다)').toBe(0);
  expect(off.grid, '⛔놓았는데 격자가 남는다').toBe(0);
  expect(off.corners, '★네 점은 ★남아야 한다 — 걷는 것은 «표시»지 «값»이 아니다').toBe(on.corners);

  /* ★다시 고른다 — ★★현빈 : 「★걷혔는데 ★선택하면 ★다시 보여야 되는 거 아냐?」 */
  await pick(page, 'ftTB');
  await page.waitForFunction(() => document.querySelectorAll('.tfh-handle').length > 0, null, { timeout: 5000 });
  const again = await read(page);
  console.log('[H2-again]', JSON.stringify(again));
  expect(again.handle, '⛔다시 골랐는데 손잡이가 안 뜬다 — 현빈 신고 그 자리').toBe(on.handle);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ── H3 ★끌면 ★네 점이 ★바뀐다 (★항등 → ★안 항등) ─────────────────── */
test('H3 ★모서리를 ★끌면 ★`tfCorners` 가 ★바뀐다 — ★항등이 ★깨진다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  await page.waitForFunction(() => document.querySelectorAll('.tfh-handle').length > 0, null, { timeout: 5000 });

  const isIdent = (s) => { const a = (s || '').split(',').map(Number); if (a.length !== 8) return null;
    const W = a[2], H = a[5]; return a[0] === 0 && a[1] === 0 && a[3] === 0 && a[4] === W && a[6] === 0 && a[7] === H; };
  const c0 = (await read(page)).corners;
  /* ★전제 — ★끌기 «전»은 ★항등이다(⛔안 걸면 「원래 찌그러져 있었다」와 구분이 안 된다) */
  expect(isIdent(c0), '★전제: 켠 직후 네 점이 ★항등이 아니다').toBe(true);

  /* ★진짜 마우스로 ★se 모서리를 ★끈다 */
  const box = await page.evaluate(() => {
    const h = document.querySelector('#ftTB > .tfh-handle[data-tfh="se"]') || document.querySelector('#ftTB > .tfh-handle');
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, which: h.dataset.tfh };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((prev) => (document.getElementById('ftTB').dataset.tfCorners || '') !== prev, c0, { timeout: 5000 });

  const c1 = (await read(page)).corners;
  console.log('[H3]', JSON.stringify({ which: box.which, c0, c1 }));
  expect(c1, '⛔끌었는데 네 점이 그대로다 — 손잡이가 문을 안 부른다').not.toBe(c0);
  expect(isIdent(c1), '⛔끌었는데 여전히 항등이다 — 값이 안 산다(튕김 함정)').toBe(false);
  expect((c1 || '').split(',').length, '★네 점 여덟 숫자 꼴이 깨졌다').toBe(8);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ── H4 ★✕ 면 ★손잡이도 ★걷힌다 ────────────────────────────────────── */
test('H4 ★✕(효과 삭제) 면 ★손잡이·격자도 ★같이 걷힌다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  await page.waitForFunction(() => document.querySelectorAll('.tfh-handle').length > 0, null, { timeout: 5000 });
  await page.click('#txt-fxft-del');
  await page.waitForFunction(() => !document.getElementById('ftTB').dataset.tfCorners, null, { timeout: 5000 });
  const r = await read(page);
  console.log('[H4]', JSON.stringify(r));
  expect(r.corners, '★✕ 인데 네 점이 남았다').toBe(null);
  expect(r.handle, '⛔✕ 인데 손잡이가 남는다 — `_strip` 이 안 걷는다').toBe(0);
  expect(r.grid, '⛔✕ 인데 격자가 남는다').toBe(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ── H5 ★★음성대조 — ★저장본에 ★손잡이가 ★안 실린다 (★명부가 막는다) ── */
test('H5 ★★저장본에 `.tfh-*` 가 ★0 — ★명부(editor-ui-roster ＋ serializeCleanRoot)가 ★막는다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  await page.waitForFunction(() => document.querySelectorAll('.tfh-handle').length > 0, null, { timeout: 5000 });

  const r = await page.evaluate(() => {
    const live = { handle: document.querySelectorAll('.tfh-handle').length, grid: document.querySelectorAll('.tfh-grid').length };
    const s = window.getSerializedCanvas ? window.getSerializedCanvas() : null;
    const str = typeof s === 'string' ? s : JSON.stringify(s || '');
    return { live, len: str.length,
      handle: (str.match(/tfh-handle/g) || []).length,
      grid: (str.match(/tfh-grid/g) || []).length,
      /* ★양성대조 — ★콘텐츠는 ★있다(⛔비면 「저장본을 못 읽었다」다) */
      textBlock: (str.match(/text-block/g) || []).length };
  });
  console.log('[H5]', JSON.stringify(r));
  expect(r.live.handle, '★전제: 살아 있는 손잡이가 0 이면 이 칸은 아무것도 안 잰다').toBeGreaterThan(0);
  expect(r.len, '★양성대조: 저장본이 비었다 — 자를 못 댔다').toBeGreaterThan(200);
  expect(r.textBlock, '★양성대조: 저장본에 text-block 이 0 — 엉뚱한 것을 읽었다').toBeGreaterThan(0);
  expect(r.handle, '⛔저장본에 `.tfh-handle` 이 실렸다 — `EXPORT-SELECTED-HANDLE-BAKED-IN-01` 의 그 병').toBe(0);
  expect(r.grid, '⛔저장본에 `.tfh-grid` 가 실렸다').toBe(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
