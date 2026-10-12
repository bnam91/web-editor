/* tpl-key-focus.dom.spec.js — ★★C2: ★★«포커스가 ★어디 있나»가 ★키를 ★가른다 (★0.9.7 차단 ③ ＋ ④)
 *
 * ★★찾은 자 = 태양(코덱스 리뷰) · ★재현·정정 = t1bstar · ★판정·발주 = 지디.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ★★★재현에서 ★★리뷰의 ★★방향이 ★★둘 ★틀렸다 — ★★그 정정이 ★★이 처방을 ★★바꿨다
 *   ★출처= ★내가 ★돌렸다 · `~/.gd-work/t1bstar/dom-out/probe0097-20261011-230613.log`
 *   ★③㉠ ★「select 포커스에서 ★Enter 가 ★캔버스에 ★넣는다」 ⇒ ★★★참이다(★섹션 ★2→3)
 *   ★③㉡ ★「↑↓ 가 ★★옵션 ★대신 ★★카드를 ★움직인다」   ⇒ ★★★거짓이다.
 *        ★★실측: ★★`selectedIndex` ★★0→0 ＋ ★★카드 선택도 ★★불변 ⇒ ★★★키가 ★★삼켜진다
 *        ⇒ ★★★그래서 ★★«카드 이동을 ★막는» 처방은 ★★틀린 처방이었다.
 *          ★★그걸 ★믿었으면 ★★헛된 곳을 ★고쳤다(★지디가 ★그 위험을 ★적었다)
 *   ★③⑶ ★「검색창 ★Shift+← 가 ★트리로 ★튄다」    ⇒ ★★★거짓이다(★`depth 2→2` · ★선택 3~4)
 *        ⇒ ★★명부에서 ★★뺐다. ⛔이 파일은 ★그것을 ★안 잰다
 *   ★④   ★「옛 트리 항목이 ★들어간다」            ⇒ ★★★거짓이다(★★아무것도 ★안 들어간다)
 *        ★★참 증상 = ★★★«마우스로 ★고른 것이 ★무시되고 ★Enter 가 ★삼켜진다» — ★★먹통이고 ★손실이 ★아니다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ★★★처방 ★둘 — ★★★지디: ★★«한 줄이 ★③의 ★둘을 ★고친다»
 *   ★③ = ★★거름 명부에 ★★`SELECT` 를 ★더한다 ⇒ ★처리기가 ★★일찍 ★return 한다
 *        ⇒ ★★㉠ ★Enter 가 ★★삽입을 ★안 하고 · ★★㉡ ★↑↓ 가 ★★select 에 ★★그대로 ★닿는다
 *        ⇒ ★★★그러나 ★★«빨강이 ★사라졌다»로 ★닫지 ★않는다 —
 *          ★★★`selectedIndex` 가 ★★★실제로 ★움직여야 ★★㉡ 가 ★닫힌다(★지디 ★판정선)
 *   ★④ = ★★카드를 ★고르면 ★★`_depth` 가 ★★카드 층으로 ★돌아온다(★한 줄)
 * ⛔★★수식키 거름에 ★★`Shift` 를 ★★★더하지 ★않는다 — ★★`_cmdDown` 이 ★★`!e.shiftKey` 를 ★요구한다
 *   ⇒ ★★더하면 ★★`Shift+Enter`(b2⒜ 섹션 교체)가 ★★죽는다. ★★그래서 ★★N2 가 ★★그것을 ★잠근다.
 *
 * ★★★내 ★장면이 ★★거짓 빨강을 ★냈다(★★고치기 ★전 ★회차1) — ★★여기 ★적어 ★둔다
 *   ★옛 ★N4 는 ★★한 판에서 ★★SELECT 와 ★검색창을 ★★이어 ★쟀다 ⇒ ★★앞의 ★삽입이 ★뒤를 ★먹었다
 *   (★검색창 ★3→3 으로 ★찍혔다). ★★탐침이 ★★갓 뜬 판에서 ★★2→3 을 ★냈다 ⇒ ★★제품은 ★멀쩡하다.
 *   ⇒ ★★★N4a·N4b 로 ★갈랐다. ★★조건이 ★둘이면 ★★«판»까지 ★갈라야 ★참이다.
 *
 * ★★★④ 를 ★★어디에 ★두나 — ★★`_selectBrowserTemplate` ★안이 ★★아니라 ★★click 에 ★둔다
 *   ★까닭: ★그 자는 ★★`_renderBrowserCards` 의 ★★첫카드 ★자동선택에서도 ★불린다
 *   ⇒ ★★뎁스1(트리)에서 ★카드가 ★다시 ★그려지면 ★★뎁스가 ★★조용히 ★2로 ★튄다.
 *   ⚠️★그 꼴은 ★★N3 가 ★★못 잡는다(★뎁스가 ★이미 ★2면 ★`→` 가 ★아무 일도 ★안 하고 ★단언은 ★참이다)
 *   ⇒ ★★★그래서 ★★«잡히지 ★않는 ★쪽»을 ★★고르지 ★않았다.
 *
 * ★★★미측정 ★하나를 ★적어 ★둔다 — ★★F2 는 ★★«패널이 ★안 삼킨다»까지만 ★잠근다.
 *   ★★«select 가 ★실제로 ★움직이나»는 ★★이 하네스가 ★★못 잰다(★맨 select 도 ★0→0) ⇒ ★★실기 ★QA 칸.
 *
 * ★★★음성대조 ★★넷이 ★★이 커밋의 ★핵이다(★지디) — ★★내가 ★더한 ★거름이 ★★이미 있던 것을 ★끄는 ★꼴이
 *   ★★261011 에 ★★하루 ★세 번 ★났다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.waitForFunction(() => typeof window.addSection === 'function', null, { timeout: 20000 });
  const r = await page.evaluate(async () => {
    const S = (v) => { try { return String(v == null ? '' : v); } catch (e) { return '?'; } };
    try {
      const store = new Map();
      const base = window.electronAPI;
      window.electronAPI = new Proxy({}, { get: (t, k) => {
        if (k === 'saveTemplateCanvas') return async (id, html) => { store.set(id, html); return { ok: true }; };
        if (k === 'loadTemplateCanvas') return async (id) => store.get(id) ?? null;
        return base[k];
      }});
      window.__alerts = []; window.alert = (m) => window.__alerts.push(S(m));
      window.addSection({ skipDefaultBlock: true });
      window.addSection({ skipDefaultBlock: true });
      const secs = [...document.querySelectorAll('#canvas .section-block')];
      if (secs.length < 2) return { ok: false, why: '★섹션 ★2 미만' };
      /* ★템플릿 ★둘 — ★★다른 폴더로. ★★트리 이동(N3)에 ★★폴더가 ★둘 ★필요하다 */
      await window.saveAsTemplate(secs[0], 'KA', 'FA', 'ca', ['ka'], 'section');
      await window.saveAsTemplate(secs[1], 'KB', 'FB', 'cb', ['kb'], 'section');
      const list = window.loadTemplates();
      const by = {};
      for (const t of list) by[S(t.name)] = S(t.id);
      const got = await window._loadCanvas(by.KA);
      return { ok: true, by, n: list.length, canvasLen: got ? S(got).length : 0 };
    } catch (e) { return { ok: false, why: '★터졌다: ' + S(e && e.message) }; }
  });
  return { errs, ...r };
}

const ST = (page) => page.evaluate(() => (window.__tplNavState ? window.__tplNavState() : null));
const canvasN = (page) => page.evaluate(() => ({
  n: document.querySelectorAll('#canvas .section-block').length,
  firstId: (document.querySelector('#canvas .section-block') || {}).id || null,
}));
const sortSel = (page) => page.evaluate(() => {
  const el = document.getElementById('tpl-browser-sort');
  if (!el) return null;
  return { idx: el.selectedIndex, value: el.value, options: el.options.length,
           active: document.activeElement ? document.activeElement.tagName : null,
           activeId: document.activeElement ? document.activeElement.id : null };
});

async function open(page) {
  await page.keyboard.press('Meta+t');
  await page.waitForFunction(() => {
    const p = document.getElementById('tpl-browser');
    return p && getComputedStyle(p).display === 'flex';
  }, null, { timeout: 5000 });
}

test('K0 ★전제 — ★장면 ＋ ★★더블 ★생존 ＋ ★select 가 ★옵션을 ★둘 이상 ★든다', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `★장면 — ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '★★`_loadCanvas` ★생존(⛔0 이면 ★아래 ★무효)').toBeGreaterThan(0);
  await open(page);
  const sel = await sortSel(page);
  expect(sel, '★★정렬 select 가 ★있다').not.toBeNull();
  expect(sel.options, `★옵션이 ★★2 이상 — ★★그래야 ★↑↓ 가 ★뜻이 ★있다. ★잰 값 ${JSON.stringify(sel)}`)
    .toBeGreaterThanOrEqual(2);
});

test('F1 ★★★select 에 ★포커스 ＋ ★Enter ⇒ ★★캔버스가 ★안 바뀐다 (★③㉠ · ★고치기 ★전 ★빨강)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.KA}"]`, { timeout: 5000 });

  const foc = await page.evaluate(() => {
    const el = document.getElementById('tpl-browser-sort');
    el.focus();
    return { active: document.activeElement.tagName, id: document.activeElement.id };
  });
  /* ★★★전제 — ★★활성 요소가 ★★정말 ★그 select 인가(★`.focus()` 는 ★조용히 ★실패한다) */
  expect(foc, `전제: ★활성=SELECT — ${JSON.stringify(foc)}`).toEqual({ active: 'SELECT', id: 'tpl-browser-sort' });

  const before = await canvasN(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction((b) => document.querySelectorAll('#canvas .section-block').length !== b.n,
    before, { timeout: 2500 }).catch(() => {});
  const after = await canvasN(page);
  expect(after.n,
    `★★★select 포커스에서 ★Enter 가 ★★캔버스에 ★넣었다 — ★전 ${before.n} → ★후 ${after.n}`)
    .toBe(before.n);
});

test('F2 ★★★select 에 ★포커스 ＋ ★↑↓ ⇒ ★★패널이 ★★그 키를 ★★★안 삼킨다 (★③㉡ · ★지디 ★판정선)', async ({ page }) => {
  /* ★★★★자를 ★바꿨다 — ★★까닭을 ★적는다(261012 ★실측).
     ★첫 판은 ★★`selectedIndex` 가 ★★움직였나로 ★쟀다(★지디 ★판정선 ★그대로).
     ★★그 안에 ★★계측기 ★양성대조를 ★박아 ★뒀더니 ★★★그것이 ★★터졌다:
       ★★제품과 ★무관한 ★★맨 `<select>` 조차 ★★이 브라우저에서 ★★`ArrowDown` 에 ★★0→0 이다.
     ⇒ ★★★즉 ★★«옵션이 ★움직이나»는 ★★이 하네스에서 ★★★잴 수 ★없다.
       ⛔그걸 ★★«③이 ★틀렸다»로 ★읽으면 ★★거짓 반박이 ★된다. ★★그 대조가 ★★그걸 ★막았다.
     ★★★그래서 ★★«우리 ★몫»을 ★잰다 — ★★★«패널이 ★그 키를 ★삼키나».
       ★고치기 ★전: ★뎁스2 의 ★↑↓ 갈래가 ★★`_tplNavMove` 뒤 ★★`preventDefault` 를 ★부른다
         ⇒ ★★select 는 ★★제 기본 ★동작을 ★★못 한다(★★그게 ★㉡의 ★병이다).
         ★★템플릿이 ★둘이고 ★끝에 ★닿으면 ★★`tplNavMove` 가 ★★«제자리»를 ★돌려주면서도 ★★참이다
         ⇒ ★★★그래서 ★★«카드도 ★안 움직이고 ★옵션도 ★안 움직인다»가 ★났다(★실측 ★idx 0→0).
       ★고친 ★뒤: ★거름이 ★먼저 ★서서 ★처리기가 ★★일찍 ★return 한다 ⇒ ★★`defaultPrevented` 가 ★거짓.
     ★★★그 뒤는 ★★브라우저의 ★몫이다 — ⛔우리가 ★잴 ★자리가 ★아니다.

     ★★★⛔이 칸의 ★한계를 ★적는다(★지디 ★요구 · 261012):
       ★★이 칸은 ★★★«안 삼킨다»까지만 ★잠근다.
       ★★★«고친 ★뒤 ★select 가 ★★실제로 ★움직이나»는 ★★★미측정이다 — ★★이 하네스가 ★★못 잰다.
       ⇒ ★★실기(앱)에서만 ★잴 수 ★있다. ★★지디가 ★★릴리스 ★뒤 ★실기 QA 칸으로 ★올렸다.
       ⛔그러니 ★★★«이 칸이 ★초록이니 ★옵션이 ★움직인다»로 ★★읽지 ★마라. */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.KA}"]`, { timeout: 5000 });

  /* ★★★`window` 의 ★버블 ★단계에 ★단다 — ★★패널 처리기는 ★★`document` 에 ★있고
     ★★`document` 의 ★버블이 ★★`window` 의 ★버블보다 ★먼저다 ⇒ ★★`defaultPrevented` 를 ★★맞게 ★읽는다.
     ⛔select 에 ★달면 ★★패널보다 ★★먼저 ★불려 ★★언제나 ★거짓이다. */
  const sel0 = await page.evaluate(() => {
    window.__keys = [];
    window.addEventListener('keydown', (e) => {
      window.__keys.push({ key: e.key, dp: e.defaultPrevented,
                           tgt: (e.target && e.target.id) || null });
    }, false);
    const el = document.getElementById('tpl-browser-sort');
    el.selectedIndex = 0; el.focus();
    return { idx: el.selectedIndex, options: el.options.length, active: document.activeElement.id };
  });
  expect(sel0.active, `전제: ★활성=정렬 select — ${JSON.stringify(sel0)}`).toBe('tpl-browser-sort');
  expect(sel0.options, `전제: ★옵션 ★2 이상 — ${JSON.stringify(sel0)}`).toBeGreaterThanOrEqual(2);

  await page.keyboard.press('ArrowDown');
  const got = await page.evaluate(() => ({
    keys: (window.__keys || []).slice(),
    idx: document.getElementById('tpl-browser-sort').selectedIndex,
  }));

  /* ★★★전제 — ★★★«이벤트가 ★왔나». ⛔안 왔으면 ★★«안 삼켰다»가 ★★공허하다(★거짓 초록) */
  const down = got.keys.filter((k) => k.key === 'ArrowDown');
  expect(down.length, `전제: ★★ArrowDown 이 ★★안 왔다 — ★잰 것 ${JSON.stringify(got.keys)}`)
    .toBeGreaterThanOrEqual(1);
  expect(down[0].tgt, `전제: ★과녁이 ★정렬 select 가 ★아니다 — ${JSON.stringify(down[0])}`)
    .toBe('tpl-browser-sort');

  /* ★★★주 단언 — ★★패널이 ★삼키지 ★않았다 */
  expect(down[0].dp,
    `★★★패널이 ★★↑↓ 를 ★★삼켰다(preventDefault) ⇒ ★★select 는 ★★제 일을 ★못 한다. `
    + `★잰 것 ${JSON.stringify(down[0])} · ★참고 idx ${sel0.idx}→${got.idx}`
    + `(⛔이 브라우저는 ★맨 select 도 ★안 움직인다 ⇒ ★idx 는 ★★판정에 ★안 쓴다)`)
    .toBe(false);
});

test('F3 ★★★마우스로 ★카드를 ★고르면 ★뎁스가 ★★카드 층으로 ★돌아온다 (★④ · ★고치기 ★전 ★빨강)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await open(page);
  const st0 = await ST(page);
  expect(st0.depth, '전제: ★열면 ★뎁스2').toBe(2);

  await page.keyboard.press('ArrowLeft');                    /* ★★트리로 */
  const st1 = await ST(page);
  expect(st1.depth, `전제: ★`+'`←`'+` 뒤 ★뎁스1 — ★잰 값 ${st1.depth}`).toBe(1);

  await page.click(`.tb-card[data-tpl-id="${s.by.KB}"]`, { timeout: 5000 });
  const st2 = await ST(page);
  /* ★★★전제 — ★★고른 것이 ★★그 카드다 */
  expect(st2.selected, `전제: ★고른 카드 — ★잰 값 ${st2.selected}`).toBe(s.by.KB);

  /* ★★★주 단언 — ★★뎁스가 ★★2 로 ★돌아왔다 */
  expect(st2.depth,
    `★★★마우스로 ★골랐는데 ★뎁스가 ★★${st2.depth} 다 ⇒ ★★Enter 가 ★★트리 길로 ★삼켜진다(★먹통). `
    + `★뎁스 ${st0.depth}→${st1.depth}→${st2.depth} · ★커서 ${st2.cursorClass}/${st2.cursorFolder}`)
    .toBe(2);

  /* ★★그리고 ★★그 뒤 ★Enter 가 ★★그 카드를 ★넣는다 — ★★먹통이 ★★풀렸나 */
  const before = await canvasN(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction((b) => document.querySelectorAll('#canvas .section-block').length !== b.n,
    before, { timeout: 9000 }).catch(() => {});
  const after = await canvasN(page);
  expect(after.n,
    `★★뎁스는 ★돌아왔는데 ★Enter 가 ★★안 넣는다 — ★전 ${before.n} → ★후 ${after.n}`)
    .toBe(before.n + 1);
});

/* ══════════════════════════════════════════════════════════════════════════
   ★★★음성대조 ★셋 (★지디) — ★★내가 ★더한 ★거름이 ★★이미 있던 것을 ★끄지 ★않았나
   ══════════════════════════════════════════════════════════════════════════ */
test('N1 ★★음성대조 — ★★`⌘↓` 진입이 ★산다', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await open(page);
  await page.keyboard.press('ArrowLeft');
  const st1 = await ST(page);
  expect(st1.depth, '전제: ★뎁스1').toBe(1);
  await page.keyboard.press('Meta+ArrowDown');
  const st2 = await ST(page);
  expect(st2.depth, `★★`+'`⌘↓`'+` 진입이 ★죽었다 — ★뎁스 ${st1.depth}→${st2.depth}`).toBe(2);
});

test('N2 ★★★음성대조 — ★★`Shift+Enter` ★섹션 교체가 ★산다 (★b2⒜)', async ({ page }) => {
  /* ★★★이 칸이 ★★가장 ★중요하다 — ★★수식키 거름에 ★`Shift` 를 ★더하는 ★틀린 처방을 ★★막는 자다.
     ★★`_cmdDown` 이 ★★`!e.shiftKey` 를 ★요구하므로 ★★그 처방은 ★★이것을 ★죽인다(★지디 ★확정). */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '전제: ★더블 ★생존').toBeGreaterThan(0);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.KA}"]`, { timeout: 5000 });
  const anchor = await page.evaluate(() => {
    const first = document.querySelector('#canvas .section-block');
    window.deselectAll?.(); window.selectSection?.(first);
    if (typeof window.__syncReplace === 'function') window.__syncReplace();
    const a = window.getSelectedSection ? window.getSelectedSection() : null;
    return { id: a ? a.id : null, sel: document.querySelectorAll('#canvas .section-block.selected').length };
  });
  expect(anchor.sel, `전제: ★섹션 ★하나 — ${JSON.stringify(anchor)}`).toBe(1);

  const before = await canvasN(page);
  await page.keyboard.press('Shift+Enter');
  await page.waitForFunction((b) => {
    const secs = document.querySelectorAll('#canvas .section-block');
    const f = secs[0];
    return secs.length !== b.n || (f && f.id !== b.firstId);
  }, before, { timeout: 9000 }).catch(() => {});
  const after = await canvasN(page);
  /* ★★교체 = ★총수 ★불변 ＋ ★첫 id ★바뀜 */
  expect({ n: after.n, changed: after.firstId !== before.firstId },
    '★★★「Shift+Enter」 교체가 ★죽었다 ⇒ ★★수식키 거름에 ★「Shift」 를 ★더했나? — '
    + `★전 ${JSON.stringify(before)} → ★후 ${JSON.stringify(after)}`)
    .toEqual({ n: before.n, changed: true });
});

test('N3 ★★음성대조 — ★★`←`·`→` 트리 이동이 ★산다', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await open(page);
  const a = await ST(page);
  await page.keyboard.press('ArrowLeft');
  const b = await ST(page);
  expect(b.depth, `★`+'`←`'+` 가 ★죽었다 — ★뎁스 ${a.depth}→${b.depth}`).toBe(1);
  /* ★★↓ 로 ★커서를 ★걷고 ★→ 로 ★진입 — ★★둘 다 ★살아 있나 */
  await page.keyboard.press('ArrowDown');
  const c = await ST(page);
  expect(c.cursor, `★`+'`↓`'+` 가 ★커서를 ★안 움직였다 — ★${b.cursor}→${c.cursor}`).not.toBe(b.cursor);
  await page.keyboard.press('ArrowRight');
  const d = await ST(page);
  expect(d.depth, `★`+'`→`'+` 진입이 ★죽었다 — ★뎁스 ${c.depth}→${d.depth}`).toBe(2);
});

test('N4a ★★★거름 명부 ⊇ 실패집합 — ★SELECT 포커스에서 ★Enter 가 ★★안 먹는다 (★지디 ⒟ ★앞칸)', async ({ page }) => {
  /* ★★★지디: ★★«명부는 ★명부다 ⇒ ⛔등호 ★금지 · 「명부 ⊇ ★실패집합 ＋ ★명부 ★밖 ★0건」».
     ⇒ ★★앞칸(★N4a)이 ★★⊇ 를, ★★뒤칸(★N4b)이 ★★«명부 ★밖 ★0건»을 ★잰다.
     ★★★왜 ★★칸을 ★★갈랐나 — ★★한 칸에 ★두 조건을 ★두고 ★★한 판에서 ★★이어 ★쟀더니
       ★★앞의 ★삽입이 ★★뒤의 ★판을 ★바꿨다(★회차1 실측: ★검색창 ★3→3).
       ★★탐침으로 ★★갓 뜬 판에서 ★다시 재니 ★★★2→3 — ★★★제품이 ★아니라 ★★내 장면이 ★거짓 빨강을 ★냈다.
       ⇒ ★★★「한 문장에 ★조건이 ★둘이면 ★각각 ★따로 ★재라」 — ★★판까지 ★갈라야 ★참이다. */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.KA}"]`, { timeout: 5000 });

  const foc = await page.evaluate(() => {
    const el = document.getElementById('tpl-browser-sort');
    el.focus();
    return { active: document.activeElement.tagName, id: document.activeElement.id };
  });
  expect(foc, `전제: ★활성=SELECT — ${JSON.stringify(foc)}`).toEqual({ active: 'SELECT', id: 'tpl-browser-sort' });

  const b = await canvasN(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction((bb) => document.querySelectorAll('#canvas .section-block').length !== bb.n,
    b, { timeout: 2500 }).catch(() => {});
  const a = await canvasN(page);
  expect(a.n, `★★SELECT 가 ★★명부에 ★안 들었다 — ★캔버스 ${b.n}→${a.n}`).toBe(b.n);
});

test('N4b ★★★음성대조 — ★★명부 ★밖(★검색창)은 ★★★그대로 ★먹는다 ＋ ★명부 밖 ★0건 (★지디 ⒟ ★뒤칸)', async ({ page }) => {
  /* ★★★이 칸이 ★★★고치기 ★전에도 ★초록이어야 ★한다 — ★★그게 ★이 칸의 ★뜻이다.
     ⛔내가 ★더한 ★거름이 ★★이미 ★있던 ★것을 ★끄면 ★★여기가 ★빨개진다.
     ★★이 칸이 ★없으면 ★★«전부 ★막는 자»와 ★★«SELECT 만 ★막는 자»가 ★★구분 ★안 된다. */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.KA}"]`, { timeout: 5000 });

  const foc = await page.evaluate(() => {
    const i = document.getElementById('tpl-browser-search');
    if (!i) return { miss: true };
    i.focus(); i.value = '';
    return { active: document.activeElement.tagName, id: document.activeElement.id };
  });
  expect(foc, `전제: ★활성=검색창 — ${JSON.stringify(foc)}`).toEqual({ active: 'INPUT', id: 'tpl-browser-search' });

  const b = await canvasN(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction((bb) => document.querySelectorAll('#canvas .section-block').length !== bb.n,
    b, { timeout: 9000 }).catch(() => {});
  const a = await canvasN(page);
  expect(a.n, `★★★검색창 ★Enter 가 ★★죽었다 ⇒ ★★내 거름이 ★★예외까지 ★막았나? — ★캔버스 ${b.n}→${a.n}`)
    .toBe(b.n + 1);
});
