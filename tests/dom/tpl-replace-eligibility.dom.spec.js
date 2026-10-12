/* tpl-replace-eligibility.dom.spec.js — ★★C3 ①: ★★«섹션 변경» ★자격을 ★★판정하는 자리가 ★★★하나다.
 *
 * ★★★찾은 자 = 태양(코덱스 리뷰) · ★재현·정정 = t1bstar · ★판정·발주 = 지디.
 *
 * ★★★이 묶음이 ★막는 ★꼴 — ★★★«단추는 ★열려 ★있는데 ★눌러도 ★거절»:
 *   ★고치기 ★전 ★`_syncInsertBtn` 은 ★★`!!_browserSelected && secN === 1` 로 ★★열고,
 *   ★`_applySelectedBrowserTemplate` 은 ★★섹션 수를 ★★제가 ★다시 ★세서 ★거절한다.
 *   ⇒ ★★판정이 ★★두 자리에 ★살아 ★★갈릴 ★수 ★있다. ★★그리고 ★★★템플릿 ★꼴(블록·컴포넌트)은
 *     ★★★어느 쪽도 ★★안 본다 ⇒ ★★블록 템플릿으로 ★«교체»를 ★부르면 ★★섹션 꼴이 ★★안 나온다.
 *
 * ★★★그래서 ★★이 벌은 ★★★«같은 말을 ★하나»를 ★★행위로 ★잰다(★R5) — ⛔소스를 ★안 읽는다.
 *   ★단추의 ★`title` 과 ★알림의 ★문구가 ★★같은 ★조건에서 ★★★같은 ★문자열이어야 ★한다.
 *   ⇒ ★★누가 ★다시 ★둘로 ★가르면 ★★R5 가 ★빨개진다. ⛔문구를 ★이 파일에 ★★또 ★적지 ★않는다
 *     (★★그러면 ★★★이 벌이 ★★둘째 명부가 ★된다 — ★★내 명부의 ★★첫 줄이 ★그것이다).
 *
 * ⛔블록 교체를 ★★구현하지 ★않는다 — ★★거절이 ★★맞는 거동이다(★지디 발주).
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
      /* ★★더블 — ★★하네스의 ★Proxy 는 ★★모든 키가 ★참이고 ★★`loadTemplateCanvas` 가 ★null 이다
         ⇒ ★★삽입이 ★★조용히 ★아무 일도 ★안 한다. ★선례 = ★`tpl-section-replace.dom.spec.js` */
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
      /* ★★★꼴을 ★★«정의 자리»에서 ★받는다 — ★`saveAsTemplate(el,name,folder,category,tags,type)`
         (★출처= js/panels/template-system.js ★선언 줄 · ★6번째가 ★type) */
      await window.saveAsTemplate(secs[0], 'SEC', 'FS', 'cs', [], 'section');
      await window.saveAsTemplate(secs[1], 'BLK', 'FB', 'cb', [], 'block');
      const list = window.loadTemplates();
      const by = {};
      for (const t of list) by[S(t.name)] = S(t.id);
      const types = {};
      for (const t of list) types[S(t.name)] = S(t.type);
      const got = await window._loadCanvas(by.SEC);
      return { ok: true, by, types, n: list.length, canvasLen: got ? S(got).length : 0 };
    } catch (e) { return { ok: false, why: '★터졌다: ' + S(e && e.message) }; }
  });
  return { errs, ...r };
}

const canvasN = (page) => page.evaluate(() => ({
  n: document.querySelectorAll('#canvas .section-block').length,
  ids: [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).join(','),
}));
const alerts = (page) => page.evaluate(() => (window.__alerts || []).slice());
const rbtn = (page) => page.evaluate(() => {
  const b = document.getElementById('tpl-browser-replace-btn');
  return b ? { disabled: !!b.disabled, title: String(b.title || '') } : null;
});
async function open(page) {
  await page.keyboard.press('Meta+t');
  await page.waitForFunction(() => {
    const p = document.getElementById('tpl-browser');
    return p && getComputedStyle(p).display === 'flex';
  }, null, { timeout: 5000 });
}
/* ★★섹션을 ★★«사람이 하듯» ★고른다 — ★★클릭. ⛔클래스를 ★손으로 ★붙이지 ★않는다 */
async function pickSection(page, idx) {
  const ids = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id));
  await page.click(`#${ids[idx]}`, { timeout: 5000 });
  return ids[idx];
}

test('R0 ★전제 — ★장면 ＋ ★★더블 ★생존 ＋ ★★꼴이 ★★정말 ★block 으로 ★섰다', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `★장면 — ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '★★`_loadCanvas` ★생존(⛔0 이면 ★아래 ★전부 ★무효)').toBeGreaterThan(0);
  /* ★★★«블록 템플릿을 ★만들었다»를 ★★★믿지 ★않는다 — ★★읽어서 ★확인한다 */
  expect({ SEC: s.types.SEC, BLK: s.types.BLK },
    `★★꼴이 ★★안 섰다 — ★잰 값 ${JSON.stringify(s.types)}`)
    .toEqual({ SEC: 'section', BLK: 'block' });
  await open(page);
  expect(await rbtn(page), '★★«섹션 변경» 단추가 ★★이 창에 ★있다').not.toBeNull();
});

test('R1 ★★★블록 템플릿 ＋ ★섹션 하나 ⇒ ★★`Shift+Enter` 가 ★★캔버스를 ★안 바꾼다 ＋ ★알린다 (★①)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  const picked = await pickSection(page, 0);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.BLK}"]`, { timeout: 5000 });
  /* ★★★전제 — ★★섹션이 ★★하나 ★골라져 ★있다(⛔«수가 ★0이라 ★막혔다»와 ★갈라야 ★한다) */
  const pre = await page.evaluate(() => document.querySelectorAll('#canvas .section-block.selected').length);
  expect(pre, `전제: ★고른 섹션 ★하나 — ★잰 값 ${pre} · ★고른 것 ${picked}`).toBe(1);

  const before = await canvasN(page);
  await page.keyboard.press('Shift+Enter');
  await page.waitForFunction((b) => document.querySelectorAll('#canvas .section-block').length !== b.n,
    before, { timeout: 2500 }).catch(() => {});
  const after = await canvasN(page);
  const al = await alerts(page);
  /* ★★지디 ⒞ — ★★«흔적 없음»과 ★«알림 없음»은 ★★다른 축이다 ⇒ ★★둘을 ★같이 ★잰다 */
  expect({ ids: after.ids, alerted: al.length > 0 },
    `★★블록 템플릿으로 ★교체가 ★★돌았거나 ★★조용히 ★먹었다 — `
    + `★전 ${before.ids} → ★후 ${after.ids} · ★알림 ${JSON.stringify(al)}`)
    .toEqual({ ids: before.ids, alerted: true });
});

test('R2 ★★★같은 판에서 ★★단추도 ★막힌다 — ★★★«단추는 ★열려 ★있는데 ★거절»이 ★★없다 (★①)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await pickSection(page, 0);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.BLK}"]`, { timeout: 5000 });
  const b = await rbtn(page);
  expect(b.disabled, `★★블록 템플릿인데 ★단추가 ★★열려 ★있다 — ★잰 값 ${JSON.stringify(b)}`).toBe(true);
});

test('R3 ★★★한 명부 — ★★단추의 ★`title` 과 ★★알림의 ★문구가 ★★★같은 ★문자열이다 (★지디: ★파생)', async ({ page }) => {
  /* ★★★이 칸이 ★★«판정하는 자리가 ★하나»를 ★★행위로 ★잠근다.
     ⛔문구를 ★이 파일에 ★★적지 ★않는다 — ★★적으면 ★★이 벌이 ★★둘째 명부가 ★된다. */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  await pickSection(page, 0);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.BLK}"]`, { timeout: 5000 });
  const b = await rbtn(page);
  expect(b.title.length, `전제: ★title 이 ★비었다 — ${JSON.stringify(b)}`).toBeGreaterThan(0);

  await page.keyboard.press('Shift+Enter');
  await page.waitForFunction(() => (window.__alerts || []).length > 0, null, { timeout: 2500 }).catch(() => {});
  const al = await alerts(page);
  expect(al.length, `전제: ★알림이 ★★0건이다 — ★★R1 이 ★먼저 ★빨개져야 한다`).toBeGreaterThan(0);
  expect(al[al.length - 1],
    `★★★단추와 ★알림이 ★★다른 말을 ★한다 ⇒ ★★판정이 ★★두 자리에 ★산다. `
    + `★단추 title ${JSON.stringify(b.title)} · ★알림 ${JSON.stringify(al[al.length - 1])}`)
    .toBe(b.title);
});

test('R4 ★★음성대조 — ★★섹션 템플릿 ＋ ★섹션 하나면 ★★★그대로 ★바뀐다 ＋ ★알림 ★0건', async ({ page }) => {
  /* ★★★이 칸이 ★★고치기 ★전에도 ★초록이어야 ★한다 — ⛔내 가드가 ★★다 ★막으면 ★여기가 ★빨개진다 */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  const picked = await pickSection(page, 0);
  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.SEC}"]`, { timeout: 5000 });
  const before = await canvasN(page);
  await page.keyboard.press('Shift+Enter');
  /* ★★★기다리는 ★조건이 ★★★항등식이 ★아니어야 ★한다 — ★★NodeList 엔 ★`.map` 이 ★★없어서
     ★첫 판은 ★★★언제나 ★거짓이었다(★9초를 ★그냥 ★버리고 ★catch 로 ★떨어졌다). ⇒ ★★★id 로 ★잰다. */
  await page.waitForFunction((b) =>
    [...document.querySelectorAll('#canvas .section-block')].map((x) => x.id).join(',') !== b.ids,
    before, { timeout: 9000 }).catch(() => {});
  const after = await canvasN(page);
  const al = await alerts(page);
  /* ★★교체 = ★★수는 ★같고 ★★id 는 ★바뀐다(★선례 = ★b2 의 ★교체 축) */
  expect({ n: after.n, changed: after.ids !== before.ids, alerts: al },
    `★★섹션 교체가 ★죽었다 ⇒ ★★내 자격 판정이 ★★맞는 ★판까지 ★막았나? — `
    + `★전 ${before.ids} → ★후 ${after.ids} · ★고른 것 ${picked} · ★알림 ${JSON.stringify(al)}`)
    .toEqual({ n: before.n, changed: true, alerts: [] });
});

test('R5 ★★음성대조 — ★★«고른 섹션이 ★둘»이면 ★★여전히 ★거절한다 (★b2 ★회귀 ★가드 · ★★상태 ★주입)', async ({ page }) => {
  /* ★★★왜 ★★«주입»인가 — ★★손짓으로는 ★★★두 번 ★못 만들었다(★261012 ★실측):
       ⒜ ★`#<id>` 를 ★`Shift` 로 ★클릭 ⇒ ★★`.selected` ★★1
       ⒝ ★선례의 ★손짓(★`#<id> > .section-hitzone` ＋ ★`{modifiers:['Meta'],force:true}`) ⇒ ★★`.selected` ★★0 · ★`.multi-selected` ★★0
          (★선례 = ★`tests/dom/multisel-save-and-copy.dom.spec.js` 의 ★`cmdClickSections`)
     ★★★그리고 ★소스가 ★★까닭을 ★말한다: ★`editor.js:1349` 는 ★★덧고른 섹션에 ★★`multi-selected` 를 ★붙이고,
       ★자격 판정(＋ ★선례 ★`section-merge.js:238`)은 ★★`selected` 를 ★센다.
     ⇒ ★★★그래서 ★★★«사람이 ★`.selected` ★둘을 ★만들 수 ★있나»는 ★★★미측정이다 — ★★따로 ★알렸다.
       ⛔그걸 ★★이 칸에 ★섞지 ★않는다. ★★이 칸이 ★잠그는 것은 ★★★«둘이면 ★거절한다»는 ★거동뿐이다.
     ⇒ ★★상태를 ★★손으로 ★★주입한다 — ★★그래야 ★★고치기 ★전·후 ★모두에서 ★★같은 축을 ★잰다.
       ★★주입은 ★★자격 판정이 ★★읽는 ★그 자리(★`#canvas .section-block.selected`)에 ★정확히 ★맞춘다.

     ★★★⛔이 칸의 ★한계 — ★★지디 ★요구(261012). ★★★한 줄로 ★못 박는다:
       ★★★이 칸의 ★초록은 ★★★«자격 판정의 ★축»만 ★잠근다.
       ⛔★★«사람이 ★섹션 ★둘을 ★고를 수 ★있다»는 ★★★아니다 — ★★그건 ★★★미측정이다.
       ★★★까닭: ★★`.selected` ★둘이 ★닿는다는 ★판단은 ★★★«소스를 ★읽어» ★섰다
         (★`editor.js:1340~1355` — ★⌘클릭한 섹션이 ★★`selected` ＋ `multi-selected` ★둘 다 ★받고
          ★앞서 ★단일 선택이던 것도 ★★`selected` 를 ★그대로 ★들고 ★`multi-selected` 가 ★더해진다).
         ⇒ ★★★행위로는 ★★안 쟀다. ★★내 손짓은 ★★두 번 ★실패했고 ★★그 까닭도 ★★미측정이다.
       ⇒ ★★그래서 ★★이 주입이 ★★«앱에서 ★생기는 ★꼴»인지는 ★★이 벌이 ★★★증명하지 ★않는다.
         ★★★그 칸은 ★★실기(앱) ★QA 로 ★올렸다(★지디).
       (★★내 명부: 「★검사가 ★제 장면을 ★손으로 ★만들면 ★★«그 꼴이 ★앱에서 ★생기나»부터」) */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  const pre = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('#canvas .section-block')];
    secs.forEach((x) => x.classList.remove('selected'));
    secs.slice(0, 2).forEach((x) => x.classList.add('selected'));
    return {
      sel: document.querySelectorAll('#canvas .section-block.selected').length,
      total: secs.length,
    };
  });
  expect(pre, `전제: ★주입이 ★섰나 — ★잰 값 ${JSON.stringify(pre)}`).toEqual({ sel: 2, total: 2 });

  await open(page);
  await page.click(`.tb-card[data-tpl-id="${s.by.SEC}"]`, { timeout: 5000 });
  /* ★★★카드를 ★고르면 ★다시 그려진다 — ★★주입이 ★살아 ★있나 ★★다시 ★센다(⛔믿지 ★않는다) */
  const still = await page.evaluate(() => document.querySelectorAll('#canvas .section-block.selected').length);
  expect(still, `전제: ★카드 고른 ★뒤에도 ★주입이 ★살아야 ★한다 — ★잰 값 ${still}`).toBe(2);

  const before = await canvasN(page);
  await page.keyboard.press('Shift+Enter');
  await page.waitForFunction((b) =>
    [...document.querySelectorAll('#canvas .section-block')].map((x) => x.id).join(',') !== b.ids,
    before, { timeout: 2500 }).catch(() => {});
  const after = await canvasN(page);
  const al = await alerts(page);
  expect({ ids: after.ids, alerted: al.length > 0 },
    `★★둘을 ★고른 판에서 ★★교체가 ★돌았거나 ★★조용히 ★먹었다 — `
    + `★전 ${before.ids} → ★후 ${after.ids} · ★알림 ${JSON.stringify(al)}`)
    .toEqual({ ids: before.ids, alerted: true });
});
