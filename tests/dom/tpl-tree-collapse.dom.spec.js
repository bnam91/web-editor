/* tpl-tree-collapse.dom.spec.js — ★★1011t1d: ★★`←` 로 ★폴더 토글을 ★★닫는다
 *
 * ★★현빈 ★원문: 「템플릿 패널에 폴더를 선태후 우측을 누르면 하위 항목토글이 열리잖아?
 *                 좌측을 누르면 토글이 닫히게 해줄래?」
 * ★★찾은 자·설계 = 지디 · ★고친 자 = t1bstar.
 *
 * ★★★이 일감의 ★참 구조 — ★★«펴짐»에 ★★모델이 ★★없었다 (★지디가 ★쟀고 ★내가 ★다시 ★쟀다):
 *   ★`template-browser.js:331` ★★`const isExpanded = folderActive;`
 *     ⇒ ★★«펴짐»이 ★★«거름이 ★그 폴더인가»로 ★★만 ★정해진다
 *     ⇒ ★그래서 ★현빈이 ★본 ★「→ 누르니 ★열렸다」는 ★★참이지만 ★★★토글을 ★누른 ★것이 ★아니다 —
 *       ★`→`(`_tplNavEnter`)가 ★★거름을 ★바꾸고 ★다시 ★그린 ★결과다.
 *   ★`:395` ★폴더 헤더 ★클릭은 ★★`classList.toggle('expanded')` ⇒ ★★DOM 만 ★건드린다
 *     ⇒ ★★다음 ★`_renderBrowserTree()` 가 ★★`folderActive` 로 ★덮는다
 *     ⇒ ★★★그 자리가 ★★10곳이다(★내가 ★셌다: `_renderBrowserTree()` 호출 ★10 ＋ ★정의 1)
 *     ⇒ ★★★그러니 ★클릭 토글은 ★★«전부터 ★있던 ★흠»이다 — ★★E5 가 ★그것을 ★잰다
 *
 * ★★★그래서 ★★`←` 에서 ★★`classList.remove` 만 ★하면 ★★안 된다 — ★★다시 그리면 ★되돌아온다.
 *   ⇒ ★★★E2 가 ★★바로 ★그 처방을 ★★거절하는 ★칸이다(⛔DOM 만 ★고치면 ★빨강).
 *
 * ★누름 꼴 = ★`page.keyboard.press` ★전용. ⛔`dispatchEvent` 를 ★쓰지 ★않는다.
 * ★상태 읽기 = ★`window.__tplNavState()` — ★★`expanded`(DOM) 와 ★★`expandedModel`(모델)을 ★★따로 ★읽는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/tpl-tree-collapse.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SCENE = [
  ['QA 알파', 'QA알파', 'demo', ['qna']],
  ['QA 베타', 'QA베타', '레거시', ['war', 'qna']],
  ['QA 감마', 'QA감마', 'solo', ['xyz']],
];

/** ★앱의 ★제 문으로 ★템플릿을 ★심는다 — ⛔저장소를 ★손으로 ★건드리지 ★않는다.
 *  ★★`bootApp` 은 ★★빈 캔버스를 ★준다 ⇒ ★★섹션을 ★★먼저 ★만든다(★261011 ★실측: ★이 전제가 ★거짓이라 ★7칸이 ★빨개졌다). */
async function seed(page) {
  return await page.evaluate(async (scene) => {
    let sec = document.querySelector('.section-block');
    if (!sec) {
      window.addSection({ skipDefaultBlock: true });
      sec = document.querySelector('.section-block');
    }
    if (!sec) return { ok: false, why: '★`addSection` 뒤에도 ★`.section-block` 이 ★없다' };
    if (typeof window.saveAsTemplate !== 'function') return { ok: false, why: '★`saveAsTemplate` 가 ★없다' };
    for (const [name, folder, category, tags] of scene) {
      await window.saveAsTemplate(sec, name, folder, category, tags, 'section');
    }
    const list = window.loadTemplates ? window.loadTemplates() : [];
    return { ok: true, n: list.length, folders: [...new Set(list.map(t => t.folder))] };
  }, SCENE);
}

const ST = (page) => page.evaluate(() => window.__tplNavState());

async function open(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const seeded = await seed(page);
  await page.keyboard.press('Meta+t');
  await page.waitForFunction(() => document.getElementById('tpl-browser')
    && getComputedStyle(document.getElementById('tpl-browser')).display === 'flex', null, { timeout: 4000 });
  return { errs, seeded };
}

/** ★뎁스1 로 ★간 뒤 ★★커서를 ★★«폴더 헤더»에 ★세운다 — ★★↓ 로 ★걸어서.
 *  ⛔«몇 번째»를 ★손으로 ★박지 ★않는다(★장면이 ★바뀌면 ★썩는다) ⇒ ★★`cursorClass` 로 ★가린다. */
async function cursorToFolderHeader(page, wantFolder) {
  await page.keyboard.press('ArrowLeft');            // ★뎁스2 → ★뎁스1
  const seen = [];
  for (let i = 0; i < 30; i++) {
    const st = await ST(page);
    seen.push(`${st.cursorClass}/${st.cursorFolder}`);
    if (st.cursorClass === 'tb-tree-folder-header' && (!wantFolder || st.cursorFolder === wantFolder)) {
      return { ok: true, st, seen };
    }
    await page.keyboard.press('ArrowDown');
  }
  return { ok: false, seen };
}

/** ★★커서를 ★★«범주»에 ★세운다(★E4 용) — ★★펴진 폴더 ★아래에만 ★범주가 ★있다(D7). */
async function cursorToCat(page) {
  const seen = [];
  for (let i = 0; i < 30; i++) {
    const st = await ST(page);
    seen.push(`${st.cursorClass}/${st.cursorFolder}`);
    if (st.cursorClass === 'tb-tree-cat') return { ok: true, st, seen };
    await page.keyboard.press('ArrowDown');
  }
  return { ok: false, seen };
}

/* ══════════════════════════════════════════════════════════════════════════
   ★★E0 — ★★무회귀. ★★★이 칸이 ★먼저다(★지디).
   ★`_depth === 2` 에서 ★`←` 는 ★★지금 그대로 ★«트리로» 여야 한다.
   ⇒ ★★내가 ★`←` 에 ★갈래를 ★더하면서 ★★이 길을 ★★막지 ★않았음을 ★잠근다.
   ══════════════════════════════════════════════════════════════════════════ */
test('E0 ★★무회귀 — ★`_depth`=2 에서 ★`←` ⇒ ★★뎁스1 로 ★간다 (★★이 칸이 ★먼저다)', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면이 섰나 — ${seeded.why || ''}`).toBe(true);
  expect(seeded.n, '전제: 카드가 ★3 이상').toBeGreaterThanOrEqual(3);

  const before = await ST(page);
  expect(before.depth, '전제: 열면 ★뎁스2 다').toBe(2);
  await page.keyboard.press('ArrowLeft');
  const after = await ST(page);
  expect(after.depth, `★★`+`←` + ` 가 ★뎁스1 로 ★안 갔다(잰 값 ${after.depth})`).toBe(1);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★E1 — ★★★«고치기 ★전 판에서 ★반드시 ★빨강»인 ★칸.
   ★지금은 ★`_depth === 1` 에서 ★`←` 가 ★★아무것도 ★안 한다(`:1187~1189`).
   ⇒ ★★전제를 ★★두 칸 ★걸고(★펴져 ★있었다 ＋ ★항목 수 N) ★★그 뒤에 ★잰다.
   ══════════════════════════════════════════════════════════════════════════ */
test('E1 ★★★폴더 헤더에 ★커서 ＋ ★펴져 있음 ⇒ ★`←` ⇒ ★★`.expanded` 가 ★사라지고 ★항목 수가 ★줄어든다', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  const got = await cursorToFolderHeader(page);
  expect(got.ok, `전제: ★커서를 ★폴더 헤더에 ★못 세웠다 — ★걸은 자리: ${got.seen.join(' → ')}`).toBe(true);
  const folder = got.st.cursorFolder;
  expect(folder, '전제: ★커서가 ★폴더 이름을 ★들고 ★있다').toBeTruthy();

  /* ★★그 폴더를 ★★«펴진» 상태로 ★만든다 — ★★앱의 ★제 문(`→` = 진입)으로. */
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');            // ★다시 ★뎁스1 로(★커서는 ★그 폴더에 ★선다)
  const mid = await ST(page);

  /* ★★★전제 ⑴ — ★누르기 ★전에 ★★정말 ★펴져 ★있었나. ⛔이 칸 없이는 ★「사라졌다」가 ★뜻이 ★없다 */
  expect(mid.expanded, `전제⑴: ★`+`${folder}` + ` 가 ★펴져 ★있어야 한다 — ★잰 값: ${JSON.stringify(mid.expanded)}`)
    .toContain(folder);
  /* ★★★전제 ⑵ — ★커서가 ★★그 폴더 헤더에 ★있나(★`→`·`←` 뒤에 ★옮겨졌을 ★수 ★있다) */
  expect(mid.cursorClass, `전제⑵: ★커서가 ★폴더 헤더다 — ★잰 값 ${mid.cursorClass}/${mid.cursorFolder}`)
    .toBe('tb-tree-folder-header');
  expect(mid.cursorFolder, '전제⑵: ★커서가 ★그 폴더다').toBe(folder);
  /* ★★★전제 ⑶ — ★★항목 수를 ★★«수»로 ★박는다(★줄어듦을 ★재려면 ★바닥이 ★있어야 한다) */
  const N = mid.itemCount;
  expect(N, `전제⑶: ★항목이 ★★3 이상이어야 한다(잰 값 ${N})`).toBeGreaterThanOrEqual(3);

  await page.keyboard.press('ArrowLeft');
  const after = await ST(page);

  expect(after.expanded, `★★`+`←` + ` 뒤에도 ★`+`${folder}` + ` 가 ★펴져 ★있다 — ★잰 값: ${JSON.stringify(after.expanded)}`)
    .not.toContain(folder);
  expect(after.itemCount, `★★항목 수가 ★안 줄었다 — ★전 ${N} · ★후 ${after.itemCount}`).toBeLessThan(N);
  /* ★★커서는 ★★그 폴더에 ★남는다(★파인더 관례 · ★지디 ㉯⑴) */
  expect(after.cursorFolder, `★커서가 ★그 폴더를 ★떠났다 — ★잰 값 ${after.cursorClass}/${after.cursorFolder}`)
    .toBe(folder);
  expect(after.depth, '★★`←` 가 ★뎁스를 ★건드렸다').toBe(1);

  /* ★★★«닫기»는 ★★«보기»이지 ★★«고르기»가 ★아니다 — ★★거름도 ★선택도 ★★안 건드린다.
     ★★구조로도 ★쟀다: ★`_tplNavCollapse` 안에 ★`_browserFilter`·`_browserSelected` 를 ★건드리는 줄 ★★0
       (★출처= ★내가 ★`sed`+`grep -c` 로 ★셌다 · 261011)
     ⇒ ★★그런데 ★★구조는 ★★«지금»만 ★말한다 ⇒ ★★★행위로도 ★걸어 ★둔다.
     ★★그리고 ★★이 칸이 ★없으면 ★★«접으면서 ★거름을 ★전체로 ★돌리는» ★처방이 ★★통과한다 —
       ★★그러면 ★카드가 ★★통째로 ★바뀌어 ★★사용자가 ★★«닫기»로 ★★자리를 ★잃는다. */
  expect(after.filter, `★★닫기가 ★거름을 ★바꿨다 — ★전 ${JSON.stringify(mid.filter)} · ★후 ${JSON.stringify(after.filter)}`)
    .toEqual(mid.filter);
  expect(after.selected, '★★닫기가 ★선택을 ★버렸다').toBe(mid.selected);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★★E2 — ★★«모델이 ★없다»를 ★잠그는 ★칸. ⛔`classList.remove` 만 ★하면 ★★빨강이다.
   ══════════════════════════════════════════════════════════════════════════ */
test('E2 ★★★다시 그려도 ★★닫힌 채 ★남는다 — ★★모델이 ★없으면 ★★이 칸이 ★빨개진다', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  const got = await cursorToFolderHeader(page);
  expect(got.ok, `전제: ★커서 — ${got.seen.join(' → ')}`).toBe(true);
  const folder = got.st.cursorFolder;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  expect((await ST(page)).expanded, '전제: ★펴져 있었다').toContain(folder);

  await page.keyboard.press('ArrowLeft');            // ★닫는다
  const closed = await ST(page);
  expect(closed.expanded, '전제: ★일단 ★닫혔다').not.toContain(folder);

  /* ★★★앱의 ★제 문으로 ★★다시 ★그린다 — ⛔«내부 함수를 ★부른다»가 ★아니라 ★★그 함수를 ★★그대로 */
  const redrew = await page.evaluate(() => {
    if (typeof window._renderBrowserTree === 'function') { window._renderBrowserTree(); return 'window'; }
    return 'none';
  });
  /* ★★★이음새가 ★없으면 ★★«사람이 ★하는 ★다른 행동»으로 ★다시 그린다 — ★즐겨찾기 ★클릭이 ★그 길이다 */
  if (redrew === 'none') {
    const starred = await page.$('.tb-tree-starred');
    expect(starred, '전제: ★다시 그릴 ★길이 ★하나는 ★있어야 한다(★`_renderBrowserTree` 도 ★즐겨찾기도 ★없다)').toBeTruthy();
    await starred.click();
  }

  const after = await ST(page);
  expect(after.expanded, `★★다시 그리니 ★`+`${folder}` + ` 가 ★★되살아났다 — ★★★«펴짐»에 ★모델이 ★없다. ★잰 값: ${JSON.stringify(after.expanded)}`)
    .not.toContain(folder);

  /* ★★★그리고 ★★DOM 과 ★모델이 ★★같은 말을 ★하나 — ⛔«DOM 만 ★고친 ★처방»을 ★거절한다 */
  expect(after.expandedModel,
    '★★★`expandedModel` 이 ★`null` 이다 = ★★모델이 ★★없다 ⇒ ★★DOM 만 ★고쳤다').not.toBeNull();
  expect([...after.expandedModel].sort(),
    `★★DOM 과 ★모델이 ★갈렸다 — ★DOM ${JSON.stringify(after.expanded)} · ★모델 ${JSON.stringify(after.expandedModel)}`)
    .toEqual([...after.expanded].sort());
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★E3 — ★★접힌 폴더에서 ★`←` ⇒ ★★아무것도 ★안 바뀐다(★항목 수·거름·선택 ★셋)
   ══════════════════════════════════════════════════════════════════════════ */
test('E3 ★★접힌 폴더에서 ★`←` ⇒ ★★아무것도 ★안 바뀐다 (★항목 수·거름·선택 ★셋)', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  const got = await cursorToFolderHeader(page);
  expect(got.ok, `전제: ★커서 — ${got.seen.join(' → ')}`).toBe(true);
  const folder = got.st.cursorFolder;

  /* ★★★전제 — ★★그 폴더가 ★★«접혀» 있어야 한다. ★★열지 ★않았으니 ★접혀 ★있는 것이 ★맞다 */
  const before = await ST(page);
  expect(before.expanded, `전제: ★`+`${folder}` + ` 는 ★접혀 ★있어야 한다 — ★잰 값 ${JSON.stringify(before.expanded)}`)
    .not.toContain(folder);

  await page.keyboard.press('ArrowLeft');
  const after = await ST(page);
  expect(after.itemCount, `★항목 수가 ★바뀌었다 — ★전 ${before.itemCount} · ★후 ${after.itemCount}`)
    .toBe(before.itemCount);
  expect(after.filter, '★거름이 ★바뀌었다').toEqual(before.filter);
  expect(after.selected, '★선택이 ★바뀌었다').toBe(before.selected);
  expect(after.cursorFolder, '★커서가 ★움직였다').toBe(before.cursorFolder);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★E4 — ★★커서가 ★«범주»일 때. ★★★갈래를 ★★내가 ★골랐다 — ★까닭을 ★적는다:

   ★지디가 ★두 갈래를 ★줬다: ⒜ ★부모로 ★올리고 ★★같이 ★접는다  ⒝ ★★커서만 ★부모로
   ⇒ ★★★⒝ 를 ★골랐다. ★까닭 ★셋:
     ⑴ ★★파인더가 ★그렇다 — ★자식에서 ★`←` 는 ★★부모로 ★올라가고, ★★접는 것은 ★★그 다음 ★`←` 다
     ⑵ ★★한 키가 ★★두 일을 ★하면 ★★되돌리기가 ★★없다 — ★★올라간 것만 ★취소할 ★길이 ★없다
     ⑶ ★★★현빈이 ★요구한 것은 ★★«닫기»다. ⒜ 는 ★★«닫기 ＋ 커서 이동»을 ★묶어 ★★요구보다 ★넓다
   ⇒ ★★그러니 ★★두 번 ★누르면 ★⒜ 와 ★같은 끝에 ★닿는다 — ★★그 길이 ★★사용자 손에 ★있다.
   ══════════════════════════════════════════════════════════════════════════ */
test('E4 ★★범주에 커서 ⇒ ★`←` ⇒ ★★★«커서만 ★부모 폴더로»(★내가 ★고른 갈래) ＋ ★★한 번 더 ⇒ ★★접힌다', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  const got = await cursorToFolderHeader(page);
  expect(got.ok, `전제: ★커서 — ${got.seen.join(' → ')}`).toBe(true);
  const folder = got.st.cursorFolder;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  expect((await ST(page)).expanded, '전제: ★펴져 있었다').toContain(folder);

  const cat = await cursorToCat(page);
  expect(cat.ok, `전제: ★커서를 ★범주에 ★못 세웠다 — ★걸은 자리: ${cat.seen.join(' → ')}`).toBe(true);
  const catFolder = cat.st.cursorFolder;
  const N = cat.st.itemCount;

  await page.keyboard.press('ArrowLeft');
  const up = await ST(page);
  /* ★★★고른 갈래 ⒝ — ★★커서만 ★올라간다. ★★★접히지 ★않는다 */
  expect(up.cursorClass, `★★커서가 ★부모 폴더 헤더로 ★안 갔다 — ★잰 값 ${up.cursorClass}/${up.cursorFolder}`)
    .toBe('tb-tree-folder-header');
  expect(up.cursorFolder, '★★커서가 ★★그 범주의 ★부모가 ★아니다').toBe(catFolder);
  expect(up.expanded, `★★★한 번에 ★접혔다 — ★★내가 ★고른 갈래는 ★★«커서만»이다. ★잰 값 ${JSON.stringify(up.expanded)}`)
    .toContain(catFolder);
  expect(up.itemCount, `★★항목 수가 ★바뀌었다(★접히면 ★안 된다) — ★전 ${N} · ★후 ${up.itemCount}`).toBe(N);

  /* ★★한 번 ★더 ⇒ ★★이제 ★접힌다(★⒜ 와 ★같은 끝) */
  await page.keyboard.press('ArrowLeft');
  const closed = await ST(page);
  expect(closed.expanded, `★★두 번째 `+'`←`'+` 가 ★안 접었다 — ★잰 값 ${JSON.stringify(closed.expanded)}`)
    .not.toContain(catFolder);
  expect(closed.itemCount, `★★두 번째 뒤 ★항목 수가 ★안 줄었다 — ★전 ${N} · ★후 ${closed.itemCount}`).toBeLessThan(N);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★E5 — ★★★«전부터 ★있던 ★흠»: ★클릭 토글이 ★★다시 그리면 ★사라진다.
   ⇒ ★★고치기 ★전 판에서 ★★빨강인지 ★★★재서 ★적는다(★지디). ★빨강이면 ★★«덤으로 고친 흠»이다.
   ══════════════════════════════════════════════════════════════════════════ */
test('E5 ★★클릭 토글도 ★★다시 그려도 ★남는다 — ★★«전부터 있던 흠»(★고치기 전 ★빨강이면 ★덤)', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  /* ★★사람이 ★하는 ★순서 — ★폴더 헤더를 ★★클릭한다(★★한 번: ★진입 ＋ ★펴짐) */
  const headers = await page.$$('.tb-tree-folder-header');
  expect(headers.length, `전제: ★폴더 헤더가 ★있나(잰 값 ${headers.length})`).toBeGreaterThanOrEqual(2);
  await headers[0].click();
  const opened = await ST(page);
  const folder = opened.expanded[0];
  expect(folder, `전제: ★클릭 뒤 ★펴진 폴더가 ★있어야 한다 — ★잰 값 ${JSON.stringify(opened.expanded)}`).toBeTruthy();

  /* ★★★같은 헤더를 ★★또 ★클릭 ⇒ ★★접힌다(★`:395` 의 ★`toggle`) */
  await page.$eval('.tb-tree-folder-header', el => el.click());
  const toggled = await ST(page);
  expect(toggled.expanded, `전제: ★두 번째 ★클릭이 ★접어야 한다 — ★잰 값 ${JSON.stringify(toggled.expanded)}`)
    .not.toContain(folder);

  /* ★★★★첫 꼴은 ★여기서 ★★«즐겨찾기»를 ★눌러 ★다시 그렸다 ⇒ ★★★거짓 초록이었다(261011 ★실측).
       ★까닭: ★그 클릭이 ★거름을 ★★`{folder:'전체'}` 로 ★옮긴다 ⇒ ★★`isExpanded = folderActive` 가
         ★★그 폴더에 ★★`false` ⇒ ★★접힌 채 ★남는다 ⇒ ★★★«모델이 ★있어서»가 ★아니라
         ★★★«거름이 ★딴 데로 ★가서» ★남은 것이다 ⇒ ★★모델 ★없이도 ★초록 = ★★아무것도 ★안 잠근다.
     ⇒ ★★★그래서 ★★거름을 ★★«그 폴더에 ★둔 채» ★다시 그려야 한다.
     (★내 명부: ★「★같은 결과라도 ★«까닭»이 ★다르면 ★실패방식이 ★다르다」
                ＋ ★「★검사가 ★«한 환경에서만» ★참이면 ★그 초록은 ★«안 재고 있다»와 ★구분 안 된다」) */
  const st0 = await ST(page);
  expect(st0.filter.folder,
    `전제: ★다시 그리기 ★전에 ★거름이 ★★그 폴더여야 한다(★그래야 ★`+`folderActive` + ` 가 ★참이고 ★★되살아날 ★판이다) — ★잰 값 ${st0.filter.folder}`)
    .toBe(folder);

  const redrew = await page.evaluate(() => {
    if (typeof window._renderBrowserTree === 'function') { window._renderBrowserTree(); return 'ok'; }
    return 'none';
  });
  expect(redrew, '전제: ★`_renderBrowserTree` 를 ★부를 ★길이 ★있어야 한다').toBe('ok');

  const after = await ST(page);
  /* ★★★다시 그린 ★뒤에도 ★거름은 ★그 폴더다 — ★★«되살아날 ★판»이 ★★섰음을 ★확인 */
  expect(after.filter.folder, '★다시 그리기가 ★거름을 ★움직였다 — ★★판이 ★안 섰다').toBe(folder);
  expect(after.expanded, `★★다시 그리니 ★클릭으로 ★접은 ★`+`${folder}` + ` 가 ★★되살아났다 — ★잰 값 ${JSON.stringify(after.expanded)}`)
    .not.toContain(folder);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★E6 — ★★`→` ★무접촉. ★★★지디 판정: ★현빈 원문은 ★«닫기»뿐이고 ★`→` 는 ★이미 ★만족하고 ★있다
   ⇒ ★★`→` 의 ★뜻을 ★★바꾸지 ★않는다(★`1011t1d-b` 로 ★남긴다).
   ⇒ ★★여기선 ★★«`→` 가 ★여전히 ★진입이다»를 ★잠근다 — ★★D3 가 ★재는 ★그 성질.
   ══════════════════════════════════════════════════════════════════════════ */
test('E6 ★★`→` 무접촉 — ★★접힌 폴더에서 ★`→` 는 ★★«펴기»가 ★아니라 ★★그대로 ★«진입»이다', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  const got = await cursorToFolderHeader(page);
  expect(got.ok, `전제: ★커서 — ${got.seen.join(' → ')}`).toBe(true);
  const folder = got.st.cursorFolder;
  const before = await ST(page);
  expect(before.expanded, `전제: ★`+`${folder}` + ` 는 ★접혀 ★있다`).not.toContain(folder);
  expect(before.depth, '전제: ★뎁스1 이다').toBe(1);

  await page.keyboard.press('ArrowRight');
  const after = await ST(page);
  /* ★★★«진입»이 ★그대로인가 — ⛔«펴기만 하고 ★머문다»로 ★바뀌면 ★★이 칸이 ★빨개진다 */
  expect(after.depth, `★★`+`→` + ` 가 ★진입을 ★멈췄다 — ★★`+`1011t1d-b` + ` 를 ★먼저 ★하지 ★마라(잰 값 ${after.depth})`)
    .toBe(2);
  expect(after.filter.folder, '★★진입이 ★거름을 ★그 폴더로 ★안 바꿨다').toBe(folder);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★★E7 — ★★«폴더가 ★아닌 것»이 ★★모델에 ★들면 ★안 된다 (★지디 ⑷ ★겨눔)

   ★★`_browserFilter.folder` 는 ★★★`'전체'` 가 ★될 ★수 ★있다(★즐겨찾기·전체 ★갈래).
   ⇒ ★★그것을 ★★폴더 ★이름으로 ★`add` 하면 ★★★`folderMap` 에 ★없는 ★이름이 ★Set 에 ★든다.
   ⇒ ★★★이 흠을 ★★내가 ★★실제로 ★냈다 — ★★E2 가 ★★`DOM [] · 모델 ["전체"]` 로 ★★빨강이었다.
     ★★그때는 ★★E2 가 ★우연히 ★잡았다(★DOM 과 ★모델을 ★견주는 ★칸이라서).
   ⇒ ★★★그러나 ★★«우연히 ★잡힌 것»은 ★★다음에 ★또 ★잡힌다는 ★보장이 ★없다
     ⇒ ★★그래서 ★★★«그 성질»을 ★★제 이름으로 ★세운다. (★지디: ★「E7 로 ★세워라」)
   ══════════════════════════════════════════════════════════════════════════ */
test('E7 ★★★«전체»·«즐겨찾기»는 ★★모델에 ★★안 든다 — ★★모델 ⊆ ★★진짜 ★폴더', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);
  /* ★★★전제 — ★★«진짜 폴더» 명부를 ★★★장면에서 ★받는다(⛔손으로 ★박지 ★않는다) */
  expect(Array.isArray(seeded.folders) && seeded.folders.length >= 2,
    `전제: ★폴더가 ★★2 이상이어야 한다 — ★잰 값 ${JSON.stringify(seeded.folders)}`).toBe(true);
  const real = new Set(seeded.folders);

  /* ⑴ ★먼저 ★폴더 ★하나에 ★진입해 ★★모델이 ★★비지 ★않게 한다(★∅ 위의 ★참을 ★피한다) */
  const got = await cursorToFolderHeader(page);
  expect(got.ok, `전제: ★커서 — ${got.seen.join(' → ')}`).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  const mid = await ST(page);
  expect(mid.expandedModel, '전제: ★모델이 ★있다').not.toBeNull();
  expect(mid.expandedModel.length, '전제: ★모델이 ★★비지 ★않았다').toBeGreaterThan(0);

  /* ⑵ ★★이제 ★★«전체»와 ★«즐겨찾기»를 ★★사람이 ★하는 ★순서로 ★★누른다 */
  for (const sel of ['.tb-tree-all', '.tb-tree-starred']) {
    const el = await page.$(sel);
    expect(el, `전제: ★${sel} 가 ★있어야 한다`).toBeTruthy();
    await el.click();
    const st = await ST(page);
    const ghosts = (st.expandedModel || []).filter(f => !real.has(f));
    expect(ghosts,
      `★★★${sel} 를 ★누르니 ★★모델에 ★★«폴더가 ★아닌 이름»이 ★들었다 — ★잰 값 ${JSON.stringify(ghosts)} `
      + `(★모델 ${JSON.stringify(st.expandedModel)} · ★진짜 폴더 ${JSON.stringify([...real])})`)
      .toEqual([]);
    /* ★★그리고 ★★DOM 과 ★모델이 ★★여전히 ★같은 말을 ★하나 */
    expect([...(st.expandedModel || [])].sort(),
      `★★DOM 과 ★모델이 ★갈렸다 — ★DOM ${JSON.stringify(st.expanded)} · ★모델 ${JSON.stringify(st.expandedModel)}`)
      .toEqual([...st.expanded].sort());
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★★E8 — ★★★«솎기 ★단독 구역»: ★★폴더가 ★사라진 ★뒤 ★★모델에서 ★유령이 ★솎이나 (★지디 ⑶ ★판정)

   ★★★왜 ★이 칸이 ★따로 ★필요한가 — ★★★두 자가 ★★이 구역을 ★★안 잰다:
     ★`G7`(unit) 은 ★★「★접어 둔 것을 ★안 펴나」를 ★잰다 — ★★«사라진 뒤»는 ★★안 잰다.
     ★`E7`(DOM) 은 ★★「★`전체`·`즐겨찾기` 가 ★모델에 ★안 드나」를 ★잰다 — ★★«폴더 소멸»은 ★★안 잰다.
   ⇒ ★★그 ★공백에 ★★★`_startRenameFolder` 가 ★★앉아 있다 —
     ★★그 자리는 ★★`G6` 의 ★★★예외 명부에 ★올라가 ★있다(★재렌더가 ★호출자에 ★있어 ★창으로 ★안 보인다).
   ⇒ ★★★그래서 ★★이 칸이 ★★그 ★예외의 ★★«귀결»을 ★잰다.
     ⇒ ★★★이로써 ★그 예외는 ★★«영구»가 ★아니라 ★★★«조건부»가 된다 — ★★두 자가 ★서로를 ★가리킨다.

   ★★★그리고 ★이 칸은 ★★★«고치기 ★전에도 ★초록»이다(★솎기가 ★이미 ★있다) ⇒ ★★그것만으로는 ★뜻이 ★없다.
     ⇒ ★★★그래서 ★★«왜 ★초록인가»를 ★★무력화로 ★가렸다 — ★★솎기를 ★떼면 ★★★이 칸이 ★빨개진다.
     ⇒ ★★그 수를 ★★커밋 글에 ★적었다. ⛔«세웠다»가 ★아니라 ★★«문다»로.
   ══════════════════════════════════════════════════════════════════════════ */
test('E8 ★★★이름을 ★바꾸면 ★★옛 이름이 ★모델에서 ★솎인다 (★이름변경 쪽 · ★G6 예외의 ★귀결)', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  /* ★★★앱의 ★제 문이 ★있나 — ⛔없으면 ★★«안 쟀다»다.
     ★★★★첫 꼴은 ★★`window._deleteFolder` / `window._startRenameFolder` 를 ★불렀고 ★★★빨개졌다(261011):
       ★`index.html:1060` 이 ★★`template-browser.js` 를 ★★★`type="module"` 로 ★싣는다
       ⇒ ★★★최상위 ★`function` ★36개가 ★★★모듈 스코프다 — ★★`window` 에 ★안 달린다.
       ★★`window` 에 ★달린 것은 ★★아홉뿐이고(★`:224`·`:226`·`:1474~1481`) ★★그중에 ★★`_renderBrowserTree` 가
       ★★있어서 ★★E2·E5 는 ★돌았다. ⇒ ★★★그래서 ★«어떤 건 되고 어떤 건 안 되는» 꼴이었다.
     ⇒ ★★★처방: ⛔제품에 ★★`window._deleteFolder` 를 ★★더하지 ★않는다 — ★★검사 편의로 ★★«표면»을 ★넓히는 일이다.
       ⇒ ★★대신 ★★★«사람 경로»를 ★★그대로 ★밟는다: ★★★트리에서 ★★우클릭 ⇒ ★메뉴 항목 ★클릭.
         ★`_wireTreeContextMenu`(`:618`) 가 ★★`[data-tree-act="rename"|"delete"]` 를 ★그린다.
     (★내 명부: ★「★검사 장면이 ★«사람이 ★하는 ★순서»를 ★안 밟는다」 ＋ ★「★자를 ★위해 ★제품을 ★고치지 ★마라」) */
  const doors = await page.evaluate(() => ({
    del: typeof window.deleteTemplateFolder === 'function',
    ren: typeof window.renameTemplateFolder === 'function',
    tree: !!document.getElementById('tpl-browser-tree'),
  }));
  expect(doors, `전제: ★앱의 ★제 문 — ★잰 값 ${JSON.stringify(doors)}`)
    .toEqual({ del: true, ren: true, tree: true });

  /** ★★폴더 헤더에 ★우클릭하고 ★메뉴 항목을 ★누른다 — ★★사람 경로. */
  const ctxAct = async (folderName, act) => {
    const sel = `.tb-tree-folder-header[data-folder="${folderName}"]`;
    const el = await page.$(sel);
    if (!el) return { ok: false, why: `★헤더가 ★없다: ${folderName}`,
                      seen: await page.$$eval('.tb-tree-folder-header', a => a.map(e => e.dataset.folder)) };
    await el.click({ button: 'right' });
    const item = await page.$(`[data-tree-act="${act}"]`);
    if (!item) return { ok: false, why: `★메뉴 항목이 ★없다: ${act}` };
    await item.click();
    return { ok: true };
  };

  /* ⑴ ★폴더 ★하나를 ★★펴 둔다 — ★모델에 ★든다 */
  const got = await cursorToFolderHeader(page);
  expect(got.ok, `전제: ★커서 — ${got.seen.join(' → ')}`).toBe(true);
  const folder = got.st.cursorFolder;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  const mid = await ST(page);
  expect(mid.expandedModel, '전제: ★모델이 ★있다').not.toBeNull();
  expect(mid.expandedModel, `전제: ★`+`${folder}` + ` 가 ★모델에 ★있다`).toContain(folder);

  /* ⑵ ★★★이름변경 — ★★사람 ★경로로(★`_startRenameFolder` ⇒ ★인라인 입력 ⇒ ★Enter).
     ⇒ ★★그 콜백이 ★★`:605` 의 ★거름 갱신을 ★타고 ★★`finish()` 가 ★다시 그린다 */
  const NEWNAME = folder + '-ren';
  const renamed = await ctxAct(folder, 'rename');
  expect(renamed.ok, `전제: ★이름변경 ★메뉴 — ${renamed.why || ''} ${JSON.stringify(renamed.seen || [])}`).toBe(true);
  await page.waitForSelector('.tb-tree-editing input', { timeout: 4000 });
  await page.fill('.tb-tree-editing input', NEWNAME);
  await page.keyboard.press('Enter');
  await page.waitForFunction((old) => {
    const s = window.__tplNavState();
    return !(s.expandedModel || []).includes(old);
  }, folder, { timeout: 4000 }).catch(() => {});

  const afterRen = await ST(page);
  expect(afterRen.expandedModel,
    `★★★옛 이름 ★`+`${folder}` + ` 이 ★★모델에 ★★남았다 — ★★솎기가 ★★안 돌았다. `
    + `★잰 값 ${JSON.stringify(afterRen.expandedModel)}`)
    .not.toContain(folder);
  /* ★★★그리고 ★★DOM 과 ★모델이 ★★여전히 ★같은 말을 ★한다 */
  expect([...(afterRen.expandedModel || [])].sort(),
    `★★DOM 과 ★모델이 ★갈렸다 — ★DOM ${JSON.stringify(afterRen.expanded)} · ★모델 ${JSON.stringify(afterRen.expandedModel)}`)
    .toEqual([...afterRen.expanded].sort());

  /* ⑶ ★★★삭제 ★절은 ★★★여기서 ★끊고 ★★다음 칸(E8b)으로 ★옮겼다 — ★★까닭을 ★수로 ★적는다.
     ★★이 장면의 ★폴더는 ★★템플릿을 ★★들고 ★있다 ⇒ ★★★제품이 ★삭제를 ★★거절한다(★그게 ★맞는 거동이다):
       `template-system.js` ★`deleteTemplateFolder` — ★★`cnt > 0` 이면 ★★`{ok:false, reason:…}`
       (★문구: 「'<이름>' 에 ★템플릿 N개가 ★들어 ★있어 ★지울 수 ★없습니다」)
     ⇒ ★★그래서 ★★여기서 ★«지워졌을 것»을 ★★재면 ★★★제품이 ★아니라 ★★내 장면이 ★틀린다.
     ⇒ ★★★솎기(★삭제 쪽)는 ★★★«빈 폴더»에서만 ★★장면이 ★선다 — ★★E8b 가 ★그것을 ★잰다. */
});

test('E8b ★★★빈 폴더를 ★지우면 ★★모델에서 ★유령이 ★솎인다 (★★삭제 쪽 · ★E8 에서 ★갈라냈다)', async ({ page }) => {
  /* ★★★왜 ★갈랐나 — ★★261012 에 ★★이 자리에서 ★★★세 번 ★틀렸고 ★★셋 다 ★★«장면 ★가정»이었다:
       ⒜ ★헤더 ★클릭으로 ★펴려 ★했다 ⇒ ★★이미 ★펴져 ★있어 ★★★접었다(★클릭 = ★토글 · ★E5)
       ⒝ ★`cursorToFolderHeader` ＋ ★`→`·`←` 로 ★펴려 ★했다 ⇒ ★★그 자의 ★첫 ★`←` 가 ★★또 ★접었다
          (★★전제에 ★★«들어가기 ★전 ★모델»을 ★찍어 ★뒀더니 ★★`["<새이름>"]` 이 ★나와 ★★한 회차에 ★갈렸다)
       ⒞ ★그래서 ★★아무것도 ★안 누르고 ★지웠다 ⇒ ★★★이번엔 ★★삭제가 ★★거절됐다(★폴더에 ★템플릿이 ★있다)
     ⇒ ★★★즉 ★★★«내 장면»이 ★세 번 ★틀렸고 ★★제품은 ★★세 번 ★맞았다.
     ⇒ ★★처방: ★★★`window.createTemplateFolder` 로 ★★★빈 폴더를 ★★★만들어 ★쓴다.
       ★★빈 폴더도 ★★트리에 ★뜬다 — ★`_renderBrowserTree` 가 ★★`listTemplateFolders()`(★★등록부)에서
       ★★`folderMap` 을 ★★먼저 ★채운다 ⇒ ★★템플릿이 ★0개여도 ★★헤더가 ★있다.
     ⛔각 단계의 ★모델을 ★★전제 메시지에 ★찍는다 — ★★그게 ★★세 번째 회차에 ★★답을 ★줬다. */
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면 — ${seeded.why || ''}`).toBe(true);

  const EMPTY = 'QA빈폴더';
  const made = await page.evaluate((nm) => {
    if (typeof window.createTemplateFolder !== 'function') return { ok: false, why: '★createTemplateFolder 가 ★없다' };
    const r = window.createTemplateFolder(nm);
    if (typeof window._renderBrowserTree === 'function') window._renderBrowserTree();
    const hdrs = [...document.querySelectorAll('.tb-tree-folder-header')].map((e) => e.dataset.folder);
    const cnt = (window.loadTemplates() || []).filter((t) => (t.folder || '기타') === nm).length;
    return { ok: true, r: r && r.ok, hdrs, cnt };
  }, EMPTY);
  expect(made.ok, `전제: ★만들 문 — ${made.why || ''}`).toBe(true);
  /* ★★★전제 — ★★«빈»이 ★★정말 ★비었나 ＋ ★★헤더가 ★떴나. ⛔둘 중 ★하나만 ★참이면 ★아래가 ★무효다 */
  expect({ empty: made.cnt === 0, shown: made.hdrs.includes(EMPTY) },
    `전제: ★빈 폴더가 ★섰나 — ★템플릿 ${made.cnt}개 · ★헤더 ${JSON.stringify(made.hdrs)}`)
    .toEqual({ empty: true, shown: true });

  /* ★★모델에 ★넣는다 — ★★⑴ 과 ★★같은 길(★커서 ⇒ ★`→` ⇒ ★`←`) */
  const got = await cursorToFolderHeader(page, EMPTY);
  expect(got.ok, `전제: ★빈 폴더 ★헤더에 ★커서 — ★본 것 ${got.seen.join(' → ')}`).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  const mid = await ST(page);
  expect(mid.expandedModel, `전제: ★모델에 ★들었나 — ★잰 값 ${JSON.stringify(mid.expandedModel)} · ★뎁스 ${mid.depth}`)
    .toContain(EMPTY);

  /* ★★지운다 — ★★사람 경로(★우클릭 ⇒ ★메뉴) */
  const sel = `.tb-tree-folder-header[data-folder="${EMPTY}"]`;
  const el = await page.$(sel);
  expect(el, `전제: ★헤더가 ★있다 — ${sel}`).toBeTruthy();
  await el.click({ button: 'right' });
  const item = await page.$('[data-tree-act="delete"]');
  expect(item, '전제: ★삭제 ★메뉴 항목').toBeTruthy();
  await item.click();
  await page.waitForFunction((nm) => {
    const st = window.__tplNavState();
    return !(st.expandedModel || []).includes(nm);
  }, EMPTY, { timeout: 4000 }).catch(() => {});

  /* ★★★그리고 ★★«정말 ★지워졌나»를 ★★따로 ★잰다 — ⛔거절돼도 ★모델은 ★그대로니 ★★두 축을 ★갈라라 */
  const after = await page.evaluate((nm) => ({
    st: window.__tplNavState(),
    hdrs: [...document.querySelectorAll('.tb-tree-folder-header')].map((e) => e.dataset.folder),
    registered: (window.listTemplateFolders?.() || []).includes(nm),
  }), EMPTY);
  expect(after.registered,
    `전제: ★★삭제가 ★거절됐다 — ★★등록부에 ★★아직 ★있다. ★헤더 ${JSON.stringify(after.hdrs)}`)
    .toBe(false);
  expect(after.st.expandedModel,
    `★★★지운 ★${EMPTY} 이 ★★모델에 ★★남았다 — ★★솎기가 ★★안 돌았다. `
    + `★잰 값 ${JSON.stringify(after.st.expandedModel)}`)
    .not.toContain(EMPTY);
  expect([...(after.st.expandedModel || [])].sort(),
    `★★삭제 뒤 ★DOM 과 ★모델이 ★갈렸다 — ★DOM ${JSON.stringify(after.st.expanded)} · `
    + `★모델 ${JSON.stringify(after.st.expandedModel)}`)
    .toEqual([...after.st.expanded].sort());
});
