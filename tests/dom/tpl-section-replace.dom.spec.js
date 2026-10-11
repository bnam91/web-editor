/* tpl-section-replace.dom.spec.js — ★설계 H(b2): ★★«선택한 섹션을 ★그 템플릿으로 ★교체»
 *
 * ★★찾은 자 = t4quote(설계 H) · ★판정 = 지디 · ★고친 자 = t1bstar.
 * ★★현빈 ★원문(★지디가 ★노트앱에서 ★찾았다):
 *   「★특정 섹션 선택후 ★엔터를 치면 ★해당 섹션템플릿이 ★신규추가가된다.
 *    ★하지만 ★쉬프트 엔터를 치거나 ★혹은 ★신규로 ★섹션변경 버튼을 만들어서
 *    ★선택한 섹션을 ★신규 섹션으로 ★변경할 수 있게도 ★해줄 것」
 *   ⇒ ★★「…도 ★해줄 것」 ⇒ ★★★«추가»를 ★없애지 ★않는다. ★★둘 다 ★있어야 ★한다.
 *
 * ★★★이 파일의 ★차례가 ★뜻을 ★가른다(★지디 ③):
 *   ★★H0 ★먼저 — ★★`Enter` 는 ★★★그대로 ★«추가»다(★★무회귀). ⛔이 칸이 ★서기 전에 ★고치지 ★마라
 *   ★★H1 다음 — ★★`Shift+Enter` 는 ★★«교체»다. ★★★고치기 ★전 판에서 ★★반드시 ★빨강이다
 *     ★근거(★실측): ★`template-browser.js` 의 ★`shiftKey` = ★★1건이고 ★★그건 ★`_cmdDown`(★내 D 작업)이다
 *       ⇒ ★★Enter 갈래는 ★★shift 를 ★★안 본다 ⇒ ★★`Shift+Enter` 가 ★★언제나 ★Enter 였다
 *
 * ★★★⛔하네스의 ★`electronAPI` 는 ★★★모든 키가 ★truthy 다(★`new Proxy({}, { get: () => () => null })`)
 *   ⇒ ★★`saveAsTemplate` 가 ★★electronAPI 가지로 ★가서 ★★`_lsFullCache` 가 ★★빈다
 *   ⇒ ★★`_loadCanvas` 도 ★그 가지 ⇒ ★★★canvas = ★null ⇒ ★★`insertTemplate` 가 ★★섹션을 ★★못 짓는다
 *   ⇒ ★★★그래서 ★★«더블 ★둘»을 ★★손으로 ★채운다(★선례 = ★`e104-template-frame-insert.dom.spec.js`)
 *   ⇒ ★★이걸 ★안 하면 ★★★H0 조차 ★«장면 실패»로 ★빨개진다 — ★★제품 탓으로 ★읽힌다
 *
 * ★★★`insertTemplate` 는 ★★fire-and-forget 이다(★`_applySelectedBrowserTemplate:789` 가 ★await 안 한다)
 *   ⇒ ★★누른 ★뒤 ★★«섹션 수»를 ★★기다려야 ★한다. ⛔동기라고 ★가정하지 ★마라
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SECS = () => document.querySelectorAll('#canvas .section-block').length;

/** ★장면 — ★★앱의 ★제 문으로 ★세운다. ★★더블 ★둘을 ★먼저 ★꽂는다. */
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.waitForFunction(() => typeof window.addSection === 'function', null, { timeout: 20000 });

  const r = await page.evaluate(async () => {
    /* ★★더블 ★둘 — ★`saveTemplateCanvas`(쌓기) ＋ ★`loadTemplateCanvas`(꺼내기).
       ★나머지 키는 ★원래 가짜로 ★흘린다. */
    const store = new Map();
    const base = window.electronAPI;
    window.electronAPI = new Proxy({}, {
      get: (t, k) => {
        if (k === 'saveTemplateCanvas') return async (id, html) => { store.set(id, html); return { ok: true }; };
        if (k === 'loadTemplateCanvas') return async (id) => store.get(id) ?? null;
        return base[k];
      },
    });

    /* ★섹션 ★둘 — ★★«교체»가 ★«지우기»와 ★구분되게. ⛔하나면 ★수가 ★0/1 로만 움직여 ★약하다 */
    window.addSection({ skipDefaultBlock: true });
    window.addSection({ skipDefaultBlock: true });
    const canvas = document.getElementById('canvas');
    const secs = [...canvas.querySelectorAll('.section-block')];
    if (secs.length < 2) return { ok: false, why: '섹션이 2개가 안 된다: ' + secs.length };

    /* ★템플릿 ★하나 — ★★마지막 섹션에서 ★뜬다(★내용이 ★구분되게 ★이름표를 ★박는다) */
    const src = secs[secs.length - 1];
    src.dataset.tplMark = 'FROM-TEMPLATE';
    await window.saveAsTemplate(src, 'H-교체용', 'QA', 'demo', ['h'], 'section');
    const list = window.loadTemplates();
    const tpl = list.find(t => t.name === 'H-교체용');
    if (!tpl) return { ok: false, why: '템플릿이 명부에 없다' };
    /* ★★★더블이 ★★참말 ★돌았나 — ★★canvas 를 ★꺼내 ★본다. ⛔null 이면 ★아래가 ★전부 ★장면 실패다 */
    const got = await window._loadCanvas(tpl.id);
    return { ok: true, n: secs.length, tplId: tpl.id, canvasLen: got ? String(got).length : 0 };
  });
  return { errs, ...r };
}

/** ★★★«무엇이 ★일어나든» ★기다린다 — ⛔고정 대기가 ★아니다.
 *  ★★교체면 ★★첫 섹션 ★id 가 ★바뀌고, ★★추가면 ★★총수가 ★늘어난다 ⇒ ★★★둘 중 ★하나를 ★기다린다.
 *  ⇒ ★★★그래서 ★★고치기 ★전과 ★후에 ★★같은 자가 ★선다(★「빨강의 ★모양으로 ★겨누지 ★마라」).
 *  ★★아무 일도 ★안 나면 ★★timeout 이고 ★★그 뒤 ★단언이 ★★잰 값을 ★찍는다 — ★★그 자체가 ★뜻 있는 ★실패다.
 *  ⛔`waitForTimeout` 을 ★쓰지 ★않는다: ★★내 ★래칫(`dom-fixed-wait-census` W3)이 ★★그걸 ★센다
 *    ＋ ★★부하 아래서 ★★고정 대기는 ★★값을 ★잃는다(★261004 실측 · ★지디 명부). */
async function settled(page, before) {
  await page.waitForFunction((b) => {
    const secs = document.querySelectorAll('#canvas .section-block');
    const first = secs[0];
    return secs.length !== b.n || (first && first.id !== b.firstId);
  }, before, { timeout: 9000 }).catch(() => {});
}

/** ★카드를 ★고른다 — ★앱의 ★제 길(⌘T ＋ ★카드 ★클릭) */
async function pickCard(page, tplId) {
  await page.keyboard.press('Meta+t');
  await page.waitForFunction(() => {
    const p = document.getElementById('tpl-browser');
    return p && getComputedStyle(p).display === 'flex';
  }, null, { timeout: 5000 });
  await page.click(`.tb-card[data-tpl-id="${tplId}"]`, { timeout: 5000 });
  return await page.evaluate(() => window.__tplNavState ? window.__tplNavState().selected : null);
}

/** ★앵커 섹션을 ★고른다 — ★★«첫» 섹션(★교체되면 ★자리가 ★보인다) */
async function pickAnchor(page) {
  return await page.evaluate(() => {
    const first = document.querySelector('#canvas .section-block');
    window.deselectAll?.();
    window.selectSection?.(first);
    const sel = window.getSelectedSection?.();
    return { id: sel ? sel.id : null, idx: sel ? sel.dataset.section : null, same: sel === first };
  });
}

test('H0 ★★`Enter` 는 ★★★그대로 ★«추가»다 — ★★무회귀(⛔이 칸이 ★먼저다)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제 — ★장면이 ★섰나: ${s.why || ''}`).toBe(true);
  expect(s.n, '전제 — ★섹션이 ★2개').toBe(2);
  /* ★★★더블이 ★돌았나 — ⛔0 이면 ★아래 빨강은 ★★제품이 ★아니라 ★장면이다 */
  expect(s.canvasLen, '전제 — _loadCanvas 가 ★html 을 ★준다(잰 값 ' + s.canvasLen + ')').toBeGreaterThan(10);

  const a = await pickAnchor(page);
  expect(a.same, '전제 — ★첫 섹션이 ★골라졌다').toBe(true);
  const sel = await pickCard(page, s.tplId);
  expect(sel, '전제 — ★카드가 ★골라졌다').toBe(s.tplId);

  const before = await page.evaluate(SECS);
  await page.keyboard.press('Enter');
  /* ★★fire-and-forget ⇒ ★★기다린다 */
  await page.waitForFunction((n) => document.querySelectorAll('#canvas .section-block').length === n + 1,
    before, { timeout: 8000 }).catch(() => {});
  const after = await page.evaluate(SECS);
  expect(after, '★★Enter 가 ★★«추가»를 ★안 했다 — ★전 ' + before + ' → 후 ' + after + ' (★＋1 기대)').toBe(before + 1);
});

test('H1 ★★★`Shift+Enter` 는 ★★«교체»다 — ★★고치기 ★전 판에서 ★★반드시 ★빨강', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제 — ★장면이 ★섰나: ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '전제 — ★더블이 ★html 을 ★준다').toBeGreaterThan(10);

  const a = await pickAnchor(page);
  expect(a.same, '전제 — ★첫 섹션이 ★골라졌다').toBe(true);
  const sel = await pickCard(page, s.tplId);
  expect(sel, '전제 — ★카드가 ★골라졌다').toBe(s.tplId);

  const before = await page.evaluate(() => ({
    n: document.querySelectorAll('#canvas .section-block').length,
    firstId: document.querySelector('#canvas .section-block').id,
    firstIdx: document.querySelector('#canvas .section-block').dataset.section,
  }));
  await page.keyboard.press('Shift+Enter');
  /* ★★★«무엇이 ★일어나든» 기다린다 — ⛔«＋1 을 기다린다»로 ★겨누면 ★★고친 뒤에 ★영영 ★기다린다 */
  await settled(page, { n: before.n, firstId: before.firstId });
  const after = await page.evaluate(() => ({
    n: document.querySelectorAll('#canvas .section-block').length,
    firstId: document.querySelector('#canvas .section-block').id,
    firstIdx: document.querySelector('#canvas .section-block').dataset.section,
    marked: !!document.querySelector('#canvas .section-block [data-tpl-mark], #canvas .section-block[data-tpl-mark]'),
  }));

  /* ★★★⑴ ★총수가 ★안 변한다 — ★★«추가»면 ★＋1 이 된다 */
  expect(after.n,
    `★★★«교체»가 ★아니라 ★«추가»가 ★났다 — ★섹션 ★전 ${before.n} → 후 ${after.n} (★같아야 한다)`).toBe(before.n);
  /* ★★★⑵ ★첫 섹션이 ★★바뀌었다(★id 가 ★새것) — ★★그 자리가 ★교체됐다는 ★증거 */
  expect(after.firstId,
    `★첫 섹션 id 가 ★안 바뀌었다(${before.firstId}) — ★교체가 ★안 났다`).not.toBe(before.firstId);
  /* ★★★⑶ ★번호는 ★그 자리를 ★지킨다 */
  expect(after.firstIdx, `★첫 섹션 번호가 ★변했다 — 전 ${before.firstIdx} → 후 ${after.firstIdx}`).toBe(before.firstIdx);
});

test('H2 ★★섹션 ★번호 — ★★교체는 ★★총수를 ★안 바꾸고 ★★번호가 ★★자리를 ★지킨다', async ({ page }) => {
  /* ★★★t4quote 는 ★★「★`secList.length + 1` 이 ★틀린 번호를 ★준다 ⇒ ★물려받아라」라 ★적었다.
     ★★★내가 ★쟀더니 ★★그 결함이 ★★★없다 — ★`:648~650` 의 ★재번호 루프가 ★★자리로 ★다시 ★매긴다.
     ⇒ ★★그래서 ★★«물려받는» ★코드를 ★★★안 더했다(⛔없는 결함에 ★코드를 ★더하지 ★않는다).
     ⇒ ★★★그러나 ★이 칸은 ★★남긴다 — ★★«지금 맞다»와 ★★«앞으로도 맞다»는 ★다르다(★지디 ⑸). */
  const s = await scene(page);
  expect(s.ok, `전제 — ★장면: ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '전제 — ★더블이 ★html 을 ★준다').toBeGreaterThan(10);
  const a = await pickAnchor(page);
  expect(a.same, '전제 — ★첫 섹션이 ★골라졌다').toBe(true);
  const sel = await pickCard(page, s.tplId);
  expect(sel, '전제 — ★카드가 ★골라졌다').toBe(s.tplId);

  const before = await page.evaluate(() => ({
    n: document.querySelectorAll('#canvas .section-block').length,
    firstId: document.querySelector('#canvas .section-block').id,
    idxs: [...document.querySelectorAll('#canvas .section-block')].map(x => x.dataset.section),
  }));
  await page.keyboard.press('Shift+Enter');
  await settled(page, { n: before.n, firstId: before.firstId });
  const after = await page.evaluate(() => ({
    n: document.querySelectorAll('#canvas .section-block').length,
    idxs: [...document.querySelectorAll('#canvas .section-block')].map(x => x.dataset.section),
  }));
  expect(after.n, `★총수가 ★변했다 — 전 ${before.n} → 후 ${after.n}`).toBe(before.n);
  /* ★★★번호가 ★★«1..n» 으로 ★자리대로 ★서 있나 — ⛔«전과 같다»만 ★재면 ★★둘 다 ★틀려도 ★통과한다 */
  expect(after.idxs, `★번호가 ★자리대로가 ★아니다 — ★잰 값 ${JSON.stringify(after.idxs)}`)
    .toEqual(before.idxs.map((_, i) => String(i + 1)));
  expect(after.idxs, `★전후가 ★다르다 — 전 ${JSON.stringify(before.idxs)} 후 ${JSON.stringify(after.idxs)}`)
    .toEqual(before.idxs);
});

test('H3 ★★꼬리 ★순서 — ★`applyPageSettings` → `pushHistory` → `buildLayerPanel` → `selectSection`', async ({ page }) => {
  /* ★★★t4quote 는 ★★`_tplReapplyPagePad` → `pushHistory` → `scheduleAutoSave` 라 ★적었다.
     ★★★섹션 갈래는 ★★그 순서가 ★아니다 — ★`_tplReapplyPagePad` 호출자 ★둘은 ★★블록·서브섹션 갈래다(★실측).
     ⇒ ★★섹션 갈래의 ★참 꼬리는 ★위 ★넷이고 ★★`scheduleAutoSave` 는 ★★없다. ★★그걸 ★★행위로 ★잠근다. */
  const s = await scene(page);
  expect(s.ok, '전제 — ★장면').toBe(true);
  const a = await pickAnchor(page);
  expect(a.same, '전제 — ★섹션 골라짐').toBe(true);
  await pickCard(page, s.tplId);

  /* ★★네 자를 ★감싸 ★★부른 ★차례를 ★적는다 — ⛔호출 ★수가 ★아니라 ★★«차례»다 */
  await page.evaluate(() => {
    window.__ord = [];
    for (const k of ['applyPageSettings', 'pushHistory', 'buildLayerPanel', 'selectSection', 'scheduleAutoSave']) {
      const orig = window[k];
      window[k] = function (...args) { window.__ord.push(k); return typeof orig === 'function' ? orig.apply(this, args) : undefined; };
    }
  });
  await page.keyboard.press('Shift+Enter');
  /* ★★꼬리의 ★마지막 칸(`selectSection`)이 ★잡힐 때까지 — ⛔고정 대기가 ★아니다 */
  await page.waitForFunction(() => (window.__ord || []).includes('selectSection'), null, { timeout: 9000 })
    .catch(() => {});
  const ord = await page.evaluate(() => window.__ord.slice());
  /* ★★★«그 넷이 ★이 차례로 ★들어 있나» — ★★사이에 ★다른 것이 ★끼어도 ★된다(★부분 수열) */
  const want = ['applyPageSettings', 'pushHistory', 'buildLayerPanel', 'selectSection'];
  let i = 0;
  for (const k of ord) if (k === want[i]) i++;
  expect(i, `★꼬리 순서가 ★어긋났다 — ★기대 ${want.join(' → ')} · ★★잰 차례 ${JSON.stringify(ord)}`).toBe(want.length);
  /* ★★전제 — ★★감시자가 ★★살았나(⛔빈 배열이면 ★위가 ★0 으로 ★통과할 수 ★있다) */
  expect(ord.length, `★감시자가 ★★아무것도 ★못 잡았다 — ★★자가 ★죽었다`).toBeGreaterThan(0);
});

test('H4 ★★`undo` ★한 번에 ★★옛 섹션이 ★★그 자리에 ★돌아온다 (⛔히스토리 ★길이로 ★재지 ★않는다)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, '전제 — ★장면').toBe(true);
  const a = await pickAnchor(page);
  expect(a.same, '전제 — ★섹션 골라짐').toBe(true);
  await pickCard(page, s.tplId);

  /* ★★옛 섹션의 ★★«정체»를 ★잡아 둔다 — ★id ＋ ★자리 ＋ ★총수. ⛔«길이가 1 늘었다»로 ★재지 ★마라 */
  const before = await page.evaluate(() => {
    const f = document.querySelector('#canvas .section-block');
    return { id: f.id, idx: f.dataset.section, n: document.querySelectorAll('#canvas .section-block').length };
  });
  await page.keyboard.press('Shift+Enter');
  await settled(page, { n: before.n, firstId: before.id });
  const mid = await page.evaluate(() => ({
    id: document.querySelector('#canvas .section-block').id,
    n: document.querySelectorAll('#canvas .section-block').length,
  }));
  expect(mid.id, '전제 — ★교체가 ★났다(★id 가 ★바뀌었다)').not.toBe(before.id);

  await page.keyboard.press('Meta+z');
  /* ★★옛 id 가 ★돌아올 때까지 — ⛔안 돌아오면 ★timeout 이고 ★아래 단언이 ★잰 값을 ★찍는다 */
  await page.waitForFunction((id) => {
    const f = document.querySelector('#canvas .section-block');
    return f && f.id === id;
  }, before.id, { timeout: 9000 }).catch(() => {});
  const after = await page.evaluate(() => {
    const f = document.querySelector('#canvas .section-block');
    return { id: f ? f.id : null, idx: f ? f.dataset.section : null,
             n: document.querySelectorAll('#canvas .section-block').length };
  });
  expect(after.id, '★★undo 뒤 ★옛 섹션이 ★안 돌아왔다 — 전 ' + before.id + ' · 교체 ' + mid.id + ' · 후 ' + after.id)
    .toBe(before.id);
  expect(after.idx, `★★undo 뒤 ★자리가 ★다르다 — 전 ${before.idx} 후 ${after.idx}`).toBe(before.idx);
  expect(after.n, `★★undo 뒤 ★총수가 ★다르다 — 전 ${before.n} 후 ${after.n}`).toBe(before.n);
});

test('H6 ★★교체 뒤 ★★선택이 ★★새 섹션으로 ★옮겨 간다 (★지디 판정 ③)', async ({ page }) => {
  /* ★★«추가» 경로가 ★★이미 ★`selectSection(sec, true)` 를 ★부른다(★`:683` — ★소스로 ★읽었다).
     ⇒ ★★★그래서 ★★«읽은 것»으로 ★닫지 ★않고 ★★행위로 ★잰다(★지디 ③). */
  const s = await scene(page);
  expect(s.ok, '전제 — ★장면').toBe(true);
  const a = await pickAnchor(page);
  expect(a.same, '전제 — ★섹션 골라짐').toBe(true);
  await pickCard(page, s.tplId);

  const beforeId = await page.evaluate(() => document.querySelector('#canvas .section-block').id);
  await page.keyboard.press('Shift+Enter');
  await settled(page, { n: 2, firstId: beforeId });
  const r = await page.evaluate(() => {
    const sel = window.getSelectedSection?.();
    const first = document.querySelector('#canvas .section-block');
    return { selId: sel ? sel.id : null, firstId: first ? first.id : null,
             selCount: document.querySelectorAll('#canvas .section-block.selected').length };
  });
  expect(r.selId, `★선택이 ★★옛 섹션에 ★남았다(${beforeId})`).not.toBe(beforeId);
  expect(r.selId, `★선택이 ★★새 섹션이 ★아니다 — 선택 ${r.selId} · 첫 섹션 ${r.firstId}`).toBe(r.firstId);
  expect(r.selCount, `★★골라진 섹션이 ★하나가 ★아니다(잰 값 ${r.selCount})`).toBe(1);
});

test('H5 ★★«섹션 변경» ★단추가 ★★`Shift+Enter` 와 ★★★같은 일을 ★한다 (★원문의 ★«혹은»)', async ({ page }) => {
  /* ★★현빈 원문: 「★쉬프트 엔터를 치거나 ★★혹은 ★신규로 ★섹션변경 버튼을 만들어서 …」
     ⇒ ★★★«혹은»이 ★★둘을 ★★같은 일로 ★묶었다 ⇒ ★★판정하는 자리도 ★★한 자리여야 ★한다.
     ⇒ ★★그래서 ★★단추는 ★★`_applySelectedBrowserTemplate({ replace: true })` ★하나만 ★부른다.
     ★★이 칸은 ★★«결과가 ★같나»를 ★★행위로 ★잰다 — ⛔«같은 함수를 ★부른다»를 ★소스로 ★읽는 것이 ★아니다. */
  const s = await scene(page);
  expect(s.ok, `전제 — ★장면: ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '전제 — ★더블이 ★html 을 ★준다').toBeGreaterThan(10);
  const a = await pickAnchor(page);
  expect(a.same, '전제 — ★첫 섹션이 ★골라졌다').toBe(true);
  await pickCard(page, s.tplId);

  /* ★★★전제 — ★단추가 ★★«쓸 수 있게» 섰나. ⛔disabled 면 ★아래 클릭이 ★조용히 ★아무 일도 ★안 한다 */
  const btn = await page.evaluate(() => {
    const b = document.getElementById('tpl-browser-replace-btn');
    if (!b) return { exists: false };
    const r = b.getBoundingClientRect();
    return { exists: true, disabled: b.disabled, w: Math.round(r.width), h: Math.round(r.height), title: b.title };
  });
  expect(btn.exists, '전제 — ★단추가 ★DOM 에 ★있다').toBe(true);
  expect(btn.disabled, `전제 — ★단추가 ★★열려 ★있다(★섹션1 ＋ ★카드1) — ★잰 값 ${JSON.stringify(btn)}`).toBe(false);
  expect(btn.w, `전제 — ★면적이 ★있다(${btn.w}×${btn.h})`).toBeGreaterThan(0);

  const before = await page.evaluate(() => ({
    n: document.querySelectorAll('#canvas .section-block').length,
    firstId: document.querySelector('#canvas .section-block').id,
    firstIdx: document.querySelector('#canvas .section-block').dataset.section,
  }));
  /* ★★진짜 ★클릭 — ⛔`dispatchEvent` 가 ★아니다 */
  await page.click('#tpl-browser-replace-btn', { timeout: 5000 });
  await settled(page, { n: before.n, firstId: before.firstId });
  const after = await page.evaluate(() => ({
    n: document.querySelectorAll('#canvas .section-block').length,
    firstId: document.querySelector('#canvas .section-block').id,
    firstIdx: document.querySelector('#canvas .section-block').dataset.section,
  }));
  expect(after.n, `★★단추가 ★«추가»를 했다 — ★전 ${before.n} → 후 ${after.n} (★같아야 한다)`).toBe(before.n);
  expect(after.firstId, `★★단추가 ★교체를 ★안 했다(${before.firstId})`).not.toBe(before.firstId);
  expect(after.firstIdx, `★번호가 ★변했다 — 전 ${before.firstIdx} 후 ${after.firstIdx}`).toBe(before.firstIdx);
});

test('H5b ★★단추가 ★★«섹션이 ★없거나 ★여럿»이면 ★★★`disabled` 다 (★지디 판정 ①②)', async ({ page }) => {
  /* ★★★키는 ★막을 ★수 ★없고(★사람이 ★언제든 ★누른다) ★★단추는 ★막을 ★수 ★있다 ⇒ ★★입구마다 ★제 꼴.
     ⇒ ★★키 쪽은 ★`alert`(★제품에 ★있다) · ★★단추 쪽은 ★★이 칸이 ★잰다. */
  const s = await scene(page);
  expect(s.ok, '전제 — ★장면').toBe(true);
  await pickCard(page, s.tplId);

  /* ⒜ ★섹션 ★0개 */
  const none = await page.evaluate(() => {
    window.deselectAll?.();
    window.__syncReplace?.();
    const b = document.getElementById('tpl-browser-replace-btn');
    return { n: document.querySelectorAll('#canvas .section-block.selected').length, disabled: b ? b.disabled : null, title: b ? b.title : null };
  });
  /* ⒝ ★섹션 ★둘 */
  const many = await page.evaluate(() => {
    document.querySelectorAll('#canvas .section-block').forEach(x => x.classList.add('selected'));
    window.__syncReplace?.();
    const b = document.getElementById('tpl-browser-replace-btn');
    return { n: document.querySelectorAll('#canvas .section-block.selected').length, disabled: b ? b.disabled : null, title: b ? b.title : null };
  });
  expect(none.n, '전제 — ★0개로 만들었다').toBe(0);
  expect(many.n, '전제 — ★둘로 만들었다').toBeGreaterThan(1);
  expect(none.disabled, `★섹션 0 인데 ★단추가 ★열려 ★있다 — ${JSON.stringify(none)}`).toBe(true);
  expect(many.disabled, `★섹션 ${many.n} 인데 ★단추가 ★열려 ★있다 — ${JSON.stringify(many)}`).toBe(true);
});
