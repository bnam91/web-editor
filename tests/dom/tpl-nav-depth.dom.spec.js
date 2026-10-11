/* tpl-nav-depth.dom.spec.js — ★설계 D(b1): ★★DOM 에만 ★남는 ★다섯 칸
 *
 * ★★찾은 자 = t4quote · ★M1·M2·M3 ★판정 = 지디 · ★고친 자 = t1bstar.
 *
 * ★★★이 파일이 ★잠그는 것 — ★★`tests/unit/tpl-nav-keys.test.mjs` 가 ★★못 재는 ★칸만:
 *   ★D1 ★`←` ⇒ ★`_depth`=1 ＋ ★커서가 ★★«지금 거르는 ★항목»에 ★선다
 *   ★D3 ★`→`·`⌘↓`·`Enter` ⇒ ★`_depth`=2 ＋ ★카드 ★하나가 ★골라진다
 *   ★★D4 ★★«캐럿이 ★★더 이상 ★안 움직인다» — ★★t4quote 가 ★★고치기 ★전 판에서 ★3→2→3 으로 ★쟀던 ★그 자리
 *   ★D5 ★★`←` 로 ★뎁스1 에 ★갔을 때 ★★«검색 중» ★배지가 ★★보인다(★검색어를 ★살려 둔 ★대가)
 *   ★D7 ★★`_treeItems()` 차례 == ★★화면에 ★보이는 차례 (★★폴더를 ★접고 ★세어 ★확인)
 *   ★D6·D8·D9 ★★«행위로» 한 번 더 — ★★순수 핵은 ★unit 이 ★쟀고, ★★여기선 ★★«앱이 ★그 판정을 ★쓰나»
 *
 * ★★★⚠️D4 는 ★★«고치기 ★전 판에서 ★반드시 ★빨강»인 ★단언이다(t4quote 설계).
 *   ⇒ ★★그래서 ★★이 파일의 ★초록만으로는 ★★«내 고침이 ★그걸 ★고쳤다»가 ★★안 선다 —
 *     ★★`origin/dev` ★핀에서 ★한 번 ★돌려 ★★그 빨강을 ★★먼저 ★봐야 ★뜻이 ★있다(★양성대조).
 *   ⇒ ★★그 대조는 ★★이 파일 ★밖의 ★일이고 ★★조정자 칸이다. ⛔여기서 ★«닫혔다»로 ★적지 ★않는다.
 *
 * ★누름 꼴 = ★`page.keyboard.press` ★전용. ⛔`dispatchEvent` 를 ★쓰지 ★않는다.
 * ★상태 읽기 = ★`window.__tplNavState()` (★읽기 전용 이음새 · ★선례: `window.__autoSaveDeferState`)
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/tpl-nav-depth.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★★장면 — ★★겹치지 ★않는 폴더를 ★하나 ★더 둔다(t4quote):
     `알파/demo/[qna]` · `베타/레거시/[war,qna]` ＋ ★`감마/solo/[xyz]`
   ⇒ ★★`qna` ∩ `solo` = ★★0 ⇒ ★★D8 이 ★★«0건이 ★아니다»를 ★잴 ★바닥이 ★생긴다 */
const SCENE = [
  ['QA 알파', 'QA알파', 'demo', ['qna']],
  ['QA 베타', 'QA베타', '레거시', ['war', 'qna']],
  ['QA 감마', 'QA감마', 'solo', ['xyz']],
];

/** ★앱의 ★제 문으로 ★템플릿을 ★심는다 — ⛔저장소를 ★손으로 ★건드리지 ★않는다.
 *  ★★id 가 ★다 ★달라야 한다(P3) — ★설계 C 가 ★섰으니 ★같은 ms 에도 ★안 겹친다. */
async function seed(page) {
  return await page.evaluate(async (scene) => {
    /* ★★★★섹션을 ★★★먼저 ★만든다 — ⛔«이미 있다»고 ★가정하지 ★마라.
       ★★★261011 ★실측: ★★이 전제가 ★거짓이라 ★★★9칸 중 ★7칸이 ★빨개졌다
         (★`seed` 가 ★`.section-block` 을 ★못 찾아 ★★템플릿 ★0개 ⇒ ★★카드 0 · ★폴더 0).
       ⇒ ★★★`bootApp` 은 ★★빈 캔버스를 ★준다. ★★앱의 ★제 문으로 ★세운다.
       ★선례 = ★`window.addSection({ skipDefaultBlock: true })` — ★DOM spec ★★9곳이 ★이 꼴이다. */
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
    return { ok: true, n: list.length, ids: list.map(t => t.id),
             folders: [...new Set(list.map(t => t.folder))] };
  }, SCENE);
}

const ST = (page) => page.evaluate(() => window.__tplNavState());

/** ★검색칸에 ★글자를 ★넣고 ★캐럿을 ★★가운데에 ★둔다 — ★★D4 의 ★바닥 */
async function typeAndPark(page, text, caret) {
  await page.click('#tpl-browser-search');
  await page.fill('#tpl-browser-search', text);
  await page.evaluate((c) => {
    const i = document.getElementById('tpl-browser-search');
    i.focus(); i.setSelectionRange(c, c);
  }, caret);
  return await page.evaluate(() => document.getElementById('tpl-browser-search').selectionStart);
}

async function open(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const seeded = await seed(page);
  await page.keyboard.press('Meta+t');
  await page.waitForFunction(() => document.getElementById('tpl-browser')
    && getComputedStyle(document.getElementById('tpl-browser')).display === 'flex', null, { timeout: 4000 });
  return { errs, seeded };
}

test('D1 ★`←` ⇒ ★`_depth`=1 ＋ ★커서가 ★★«지금 거르는 항목»에 ★선다', async ({ page }) => {
  const { seeded } = await open(page);
  expect(seeded.ok, `전제: 장면이 섰나 — ${seeded.why || ''}`).toBe(true);
  expect(seeded.n, '전제 P2: 카드가 ★3 이상').toBeGreaterThanOrEqual(3);
  expect(new Set(seeded.ids).size, '전제 P3: id 가 ★전부 다르다').toBe(seeded.ids.length);

  const before = await ST(page);
  expect(before.depth, '전제: 열면 ★뎁스2 다').toBe(2);
  expect(before.itemCount, '전제: 뎁스1 항목이 ★있다').toBeGreaterThan(0);

  await page.keyboard.press('ArrowLeft');
  const after = await ST(page);
  expect(after.depth, '★`←` 가 ★뎁스1 로 ★안 보냈다').toBe(1);
  expect(after.cursor, `★커서가 ★안 섰다(잰 값 ${after.cursor})`).toBeGreaterThanOrEqual(0);
  /* ★★★«지금 거르는 항목»에 ★섰나 — ★★그 항목의 ★거름이 ★`_browserFilter` 와 ★같아야 ★한다 */
  const standsOnCurrent = await page.evaluate(() => {
    const el = document.querySelector('.tb-tree-cursor');
    if (!el) return { ok: false, why: '커서 class 가 ★DOM 에 ★없다' };
    const f = el.classList.contains('tb-tree-starred')
      ? { folder: '전체', category: '전체', tag: null, starred: true }
      : { folder: el.dataset.folder, category: el.dataset.cat, tag: null, starred: false };
    return { ok: window.tplNavSameFilter(f, window.__tplNavState().filter), f };
  });
  expect(standsOnCurrent.ok, `★커서가 ★«지금 거르는 항목»에 ★안 섰다: ${JSON.stringify(standsOnCurrent)}`).toBe(true);
});

test('D4 ★★★`←`·`→` 가 ★★검색창 ★캐럿을 ★★더 이상 ★움직이지 ★않는다', async ({ page }) => {
  await open(page);
  /* ★★t4quote 가 ★고치기 ★전 판에서 ★★3→2→3 을 ★쟀다 ⇒ ★★그 바닥을 ★그대로 ★만든다 */
  const parked = await typeAndPark(page, 'qna', 3);
  expect(parked, '전제: 캐럿이 ★3 에 ★섰다').toBe(3);

  await page.keyboard.press('ArrowLeft');
  const c1 = await page.evaluate(() => document.getElementById('tpl-browser-search').selectionStart);
  expect(c1, `★★ArrowLeft 가 ★캐럿을 ★움직였다 — ★preventDefault 가 ★안 걸렸다(잰 값 ${c1})`).toBe(3);

  await page.keyboard.press('ArrowRight');
  const c2 = await page.evaluate(() => document.getElementById('tpl-browser-search').selectionStart);
  expect(c2, `★★ArrowRight 가 ★캐럿을 ★움직였다(잰 값 ${c2})`).toBe(3);
});

test('D5 ★`←` 로 ★뎁스1 에 ★가도 ★★«검색 중» ★배지가 ★보인다 ＋ ★검색어가 ★살아 있다', async ({ page }) => {
  await open(page);
  await typeAndPark(page, 'qna', 3);
  await page.keyboard.press('ArrowLeft');
  const st = await ST(page);
  expect(st.depth, '전제: 뎁스1 이다').toBe(1);
  expect(st.searchQ, '★★커서 이동이 ★검색어를 ★지웠다 — ★M1 이 ★깨졌다').toBe('qna');
  const badge = await page.evaluate(() => {
    const el = document.getElementById('tb-search-clear');
    if (!el) return { shown: false, why: '배지가 ★DOM 에 ★없다' };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    /* ⛔«있다»로 ★닫지 ★않는다 — ★★«면적»과 ★«보임»을 ★같이 ★잰다(★0×0 유령을 ★막는다) */
    return { shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
             w: Math.round(r.width), h: Math.round(r.height), display: cs.display };
  });
  expect(badge.shown, `★★배지가 ★안 보인다 — ★검색어를 ★살려 둔 ★대가가 ★안 갚아진다: ${JSON.stringify(badge)}`).toBe(true);
});

for (const [label, key] of [['→', 'ArrowRight'], ['Enter', 'Enter'], ['⌘↓', 'Meta+ArrowDown']]) {
  test(`D3 ★뎁스1 에서 ★${label} ⇒ ★_depth=2 ＋ ★카드 ★하나가 ★골라진다`, async ({ page }) => {
    await open(page);
    await page.keyboard.press('ArrowLeft');
    const at1 = await ST(page);
    expect(at1.depth, '전제: 뎁스1 에 ★갔다').toBe(1);

    await page.keyboard.press(key);
    const at2 = await ST(page);
    expect(at2.depth, `★${label} 가 ★뎁스2 로 ★안 보냈다`).toBe(2);
    const picked = await page.evaluate(() => document.querySelectorAll('.tb-card.selected').length);
    expect(picked, `★카드가 ★★«하나» 골라져야 한다(잰 값 ${picked})`).toBe(1);
    /* ★★커서 표시는 ★★뎁스2 에선 ★★없어야 한다 — ⛔둘이 ★같이 ★보이면 ★사람이 ★어디 있는지 ★모른다 */
    const cursors = await page.evaluate(() => document.querySelectorAll('.tb-tree-cursor').length);
    expect(cursors, '★뎁스2 인데 ★트리 커서가 ★남아 있다').toBe(0);
  });
}

test('D7 ★★`_treeItems()` 차례 == ★★화면에 ★보이는 차례 (★폴더를 ★접고 ★세어 ★확인)', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowLeft');

  /* ★★★★폴더를 ★★★먼저 ★진입해 ★★펴야 ★한다 — ⛔«열면 ★펴진 폴더가 ★있다»고 ★가정하지 ★마라.
     ★★★261011 ★실측: ★★이 가정이 ★거짓이라 ★D7 이 ★「펴진 폴더가 ★없다」로 ★빨개졌다.
     ★★참값(★소스): ★`isExpanded = folderActive` 이고 ★`folderActive = _browserFilter.folder === folder`
       ⇒ ★★거름이 ★`'전체'` 인 ★동안에는 ★★★어느 폴더도 ★안 펴진다.
     ⇒ ★★그래서 ★★앱의 ★제 길로 ★하나를 ★진입한다(★커서를 ★폴더 헤더까지 ★내리고 ★`→`).
       ⇒ ★★이 꼴이 ★★사람이 ★하는 ★순서이기도 ★하다. */
  const at0 = await ST(page);
  let entered = false;
  for (let i = 0; i < at0.itemCount + 2; i++) {
    const onFolder = await page.evaluate(() => {
      const el = document.querySelector('.tb-tree-cursor');
      return !!(el && el.classList.contains('tb-tree-folder-header'));
    });
    if (onFolder) { await page.keyboard.press('ArrowRight'); entered = true; break; }
    await page.keyboard.press('ArrowDown');
  }
  expect(entered, '★전제 — ★폴더 헤더에 ★커서를 ★세우지 ★못했다(★장면에 ★폴더가 ★없나)').toBe(true);
  const exp = await page.evaluate(() => document.querySelectorAll('.tb-tree-folder.expanded').length);
  expect(exp, '★전제 — ★진입한 뒤엔 ★펴진 폴더가 ★하나 이상이어야 한다').toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');   // ★다시 ★뎁스1 로 — ★차례를 ★재러

  /* ★★★«보이는 것»을 ★★자와 ★★무관하게 ★다시 센다 — ★★`offsetParent` 로(★접힌 것은 `display:none`)
     ⇒ ★★`_treeItems()` 와 ★★«다른 자»로 ★재야 ★대조가 ★선다. ⛔같은 식을 ★두 번 ★쓰면 ★항등식이다. */
  const seen = await page.evaluate(() => {
    const tree = document.getElementById('tpl-browser-tree');
    return [...tree.querySelectorAll('.tb-tree-starred, .tb-tree-all, .tb-tree-folder-header, .tb-tree-cat')]
      .filter(el => el.offsetParent !== null)
      .map(el => (el.querySelector('.tb-tree-label')?.textContent || '').trim());
  });
  const st = await ST(page);
  expect(st.itemLabels, `★차례가 ★어긋났다 — 자=${JSON.stringify(st.itemLabels)} 화면=${JSON.stringify(seen)}`)
    .toEqual(seen);
  expect(seen.length, '전제: 보이는 항목이 ★있다').toBeGreaterThan(0);

  /* ★★★그리고 ★★«접으면 ★줄어드나» — ★★그게 ★M3 판정(★접힌 폴더의 ★범주는 ★안 든다)의 ★행위 증거.
     ⛔안 재면 ★★«언제나 ★전부를 ★센다»와 ★구분이 ★안 된다. */
  const collapsed = await page.evaluate(() => {
    const f = document.querySelector('.tb-tree-folder.expanded');
    if (!f) return { did: false, why: '펴진 폴더가 ★없다' };
    const catsIn = f.querySelectorAll('.tb-tree-cat').length;
    f.classList.remove('expanded');
    return { did: true, catsIn, after: window.__tplNavState().itemCount };
  });
  if (collapsed.did && collapsed.catsIn > 0) {
    expect(collapsed.after, `★접었는데 ★명부가 ★안 줄었다(전 ${st.itemCount} → 후 ${collapsed.after}, 범주 ${collapsed.catsIn})`)
      .toBe(st.itemCount - collapsed.catsIn);
  } else {
    /* ⛔«해당 없음»을 ★★«통과»로 ★숨기지 ★않는다 — ★★왜 ★안 쟀는지를 ★찍는다 */
    expect(collapsed.did, `★이 장면에선 ★접기를 ★못 쟀다: ${JSON.stringify(collapsed)} — ★장면을 ★고쳐야 한다`).toBe(true);
  }
});

test('D6·D9 ★★같은 폴더 ★왕복(`←` `→`) ⇒ ★★검색 ★유지 ＋ ★★카드 ★기억', async ({ page }) => {
  await open(page);
  await typeAndPark(page, 'qna', 3);
  /* ★★둘째 카드로 ★내려 둔다 — ★★«기억»을 ★잴 ★표식 */
  await page.keyboard.press('ArrowDown');
  const picked = await page.evaluate(() => document.querySelector('.tb-card.selected')?.dataset.tplId || null);
  expect(picked, '전제: 카드가 ★골라져 있다').toBeTruthy();

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');       // ★★같은 항목으로 ★재진입 — ★거름이 ★안 바뀐다
  const st = await ST(page);
  expect(st.searchQ, '★★같은 항목 ★재진입인데 ★검색어가 ★지워졌다 — ★D9 가 ★깨졌다').toBe('qna');
  const after = await page.evaluate(() => document.querySelector('.tb-card.selected')?.dataset.tplId || null);
  expect(after, '★★카드 ★기억이 ★깨졌다 — ★M2 판정이 ★안 섰다').toBe(picked);
});

test('D8 ★★다른 폴더로 ★진입(`←` `↓` `→`) ⇒ ★★검색 ★해제 ＋ ★배지 ★사라짐 ＋ ★★카드가 ★0건이 ★아니다', async ({ page }) => {
  await open(page);
  await typeAndPark(page, 'qna', 3);
  await page.keyboard.press('ArrowLeft');
  const at1 = await ST(page);

  /* ★★★커서를 ★★«거름이 ★달라지는» 항목까지 ★내린다 — ★★그 자리를 ★★찾아서 ★누른다
     (⛔«↓ 한 번»으로 ★되리라 ★가정하지 ★않는다 — ★항목 차례는 ★장면에 ★달렸다) */
  let moved = 0;
  for (let i = 0; i < at1.itemCount + 2; i++) {
    const diff = await page.evaluate(() => {
      const el = document.querySelector('.tb-tree-cursor');
      if (!el) return null;
      const f = el.classList.contains('tb-tree-starred')
        ? { folder: '전체', category: '전체', tag: null, starred: true }
        : { folder: el.dataset.folder, category: el.dataset.cat, tag: null, starred: false };
      return !window.tplNavSameFilter(f, window.__tplNavState().filter);
    });
    if (diff) break;
    await page.keyboard.press('ArrowDown');
    moved++;
  }
  const standing = await page.evaluate(() => {
    const el = document.querySelector('.tb-tree-cursor');
    const f = el && !el.classList.contains('tb-tree-starred')
      ? { folder: el.dataset.folder, category: el.dataset.cat, tag: null, starred: false } : null;
    return { f, cur: window.__tplNavState().filter };
  });
  expect(standing.f, `★★거름이 ★달라지는 항목을 ★못 찾았다(${moved}칸 내렸다) — ★장면이 ★모자라다`).toBeTruthy();

  await page.keyboard.press('ArrowRight');
  const st = await ST(page);
  expect(st.searchQ, '★★거름이 ★바뀌는 ★진입인데 ★검색어가 ★안 지워졌다 — ★D8 이 ★깨졌다').toBe('');
  const badge = await page.evaluate(() => !!document.getElementById('tb-search-clear'));
  expect(badge, '★검색이 ★해제됐는데 ★배지가 ★남아 있다').toBe(false);
  /* ★★★그리고 ★★«0건이 ★아니다» — ★★규약 ⑵ 의 ★목적이 ★지켜졌나 */
  const cards = await page.evaluate(() => document.querySelectorAll('.tb-card').length);
  expect(cards, '★★진입했는데 ★카드가 ★0건이다 — ★규약의 ★목적(0건 방지)이 ★깨졌다').toBeGreaterThan(0);
});
