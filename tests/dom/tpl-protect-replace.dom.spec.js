/* tpl-protect-replace.dom.spec.js — ★★C1: ★★«잠긴 섹션»은 ★★교체되지 ★않는다
 *
 * ★★0.9.7 차단 ② — ★찾은 자 = 태양(코덱스 리뷰) · ★재현 = t1bstar · ★판정·발주 = 지디.
 *
 * ★★★재현 ★실측(★핀 `5954e4f4` · ★출처= ★내가 ★돌렸다 · `dom-out/probe0097-20261011-230415.log`):
 *   ★잠긴 섹션을 ★앵커로 ★두고 ★`Shift+Enter` ⇒ ★★`firstId` 가 ★바뀌고 ★★그 섹션이 ★★`{present:false}`
 *   ⇒ ★★★잠근 것이 ★★사라졌다. ★★알림 ★★`[]` — ★★조용히.
 *   ★★`⌘Z` 뒤 ★★`{present:true, len:1727, prot:"true"}` ⇒ ★★되돌릴 수는 ★있다.
 *   ⇒ ★★★그런데 ★지디 판정: ★★차단 ★유지다 — ★★«알림이 ★없으면 ★사용자가 ★알아챌 수가 ★없고,
 *     ★★복구는 ★알아챈 ★뒤에만 ★쓸 수 ★있다» ⇒ ★★복구 가능성이 ★위안이 ★안 된다.
 *
 * ★★★왜 ★가드가 ★★한 자리인가 — ★★★내가 ★셌다(★주석을 ★걷고 · `js/panels/*.js` ★전수):
 *   ★★«섹션을 ★통째로 ★지우거나 ★덮는» 길 = ★★★1곳 — ★`template-system.js` 의 ★`anchorSec.replaceWith(sec)`
 *   (★`:713` 의 ★`.remove()` 는 ★★`.section-tags` ★자식이다 — ★섹션이 ★아니다)
 *   ⇒ ★★★그러니 ★가드 ★한 자리가 ★★전수를 ★덮는다. ⛔둘째 명부가 ★안 생긴다.
 *
 * ★★★그리고 ★★«이어 불러라» — ★★`window.isSectionProtected` 를 ★★쓴다. ⛔다시 ★짜지 ★않는다.
 *   ★정의 = ★`js/section-protection.js` · ★선례 = ★`js/editor.js` ★3곳(★`|| (() => false)` 꼴).
 *
 * ⛔★★하네스의 ★`electronAPI` 는 ★★모든 키에 ★`null` 을 ★준다 ⇒ ★★더블 ★둘이 ★★필수다.
 *   ⇒ ★★그리고 ★★«더블이 ★살았나»를 ★★★단언한다 — ★★★죽은 더블은 ★★«제품이 ★막았다»로 ★둔갑한다.
 *     ★★261011 ★실측: ★내 탐침이 ★★그 둔갑에 ★★세 회차를 ★★잃었다.
 * ⛔`waitForTimeout` 금지 — ★조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** ★장면 — ★★`tpl-section-replace.dom.spec.js` 의 ★검증된 ★꼴. ★★더블 ★둘이 ★핵이다. */
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.waitForFunction(() => typeof window.addSection === 'function', null, { timeout: 20000 });

  const r = await page.evaluate(async () => {
    const S = (v) => { try { return String(v == null ? '' : v); } catch (e) { return '(문자화 실패)'; } };
    try {
      const store = new Map();
      const base = window.electronAPI;
      window.electronAPI = new Proxy({}, {
        get: (t, k) => {
          if (k === 'saveTemplateCanvas') return async (id, html) => { store.set(id, html); return { ok: true }; };
          if (k === 'loadTemplateCanvas') return async (id) => store.get(id) ?? null;
          return base[k];
        },
      });
      window.__alerts = [];
      window.alert = (m) => { window.__alerts.push(S(m)); };

      window.addSection({ skipDefaultBlock: true });
      window.addSection({ skipDefaultBlock: true });
      const canvas = document.getElementById('canvas');
      const secs = [...canvas.querySelectorAll('.section-block')];
      if (secs.length < 2) return { ok: false, why: '★섹션이 ★2 미만: ' + secs.length };

      const src = secs[secs.length - 1];
      src.dataset.tplMark = 'FROM-TEMPLATE';
      await window.saveAsTemplate(src, 'L-교체용', 'QA', 'demo', ['l'], 'section');
      const tpl = window.loadTemplates().find(t => t.name === 'L-교체용');
      if (!tpl) return { ok: false, why: '★템플릿이 ★명부에 ★없다' };
      /* ★★★더블이 ★참말 ★돌았나 — ⛔0 이면 ★아래가 ★전부 ★장면 실패다 */
      const got = await window._loadCanvas(tpl.id);
      return { ok: true, tplId: tpl.id, n: secs.length, canvasLen: got ? S(got).length : 0 };
    } catch (e) {
      return { ok: false, why: '★장면이 ★터졌다: ' + S(e && e.message), stack: S(e && e.stack).slice(0, 300) };
    }
  });
  return { errs, ...r };
}

const snap = (page) => page.evaluate(() => {
  const secs = [...document.querySelectorAll('#canvas .section-block')];
  return { n: secs.length, firstId: secs[0] ? secs[0].id : null,
           ids: secs.map(s => s.id), alerts: (window.__alerts || []).slice() };
});

/** ⛔고정 대기 ★금지 — ★★«무엇이 ★일어나든» 기다린다(★교체·추가·알림 ★셋 중 ★하나). */
async function settled(page, before) {
  await page.waitForFunction((b) => {
    const secs = document.querySelectorAll('#canvas .section-block');
    const first = secs[0];
    return secs.length !== b.n || (first && first.id !== b.firstId)
      || (window.__alerts && window.__alerts.length > b.alerts);
  }, { n: before.n, firstId: before.firstId, alerts: before.alerts.length }, { timeout: 9000 }).catch(() => {});
}

async function openAndPick(page, tplId) {
  await page.keyboard.press('Meta+t');
  await page.waitForFunction(() => {
    const p = document.getElementById('tpl-browser');
    return p && getComputedStyle(p).display === 'flex';
  }, null, { timeout: 5000 });
  await page.click(`.tb-card[data-tpl-id="${tplId}"]`, { timeout: 5000 });
  return await page.evaluate(() => window.__tplNavState ? window.__tplNavState().selected : null);
}

/** ★앵커를 ★★앱의 ★제 문으로 ★고른다. */
async function pickAnchor(page, which = 0) {
  return await page.evaluate((i) => {
    const secs = [...document.querySelectorAll('#canvas .section-block')];
    const t = secs[i];
    if (!t) return { ok: false, n: secs.length };
    window.deselectAll?.();
    window.selectSection?.(t);
    if (typeof window.__syncReplace === 'function') window.__syncReplace();
    return { ok: true, id: t.id, sel: document.querySelectorAll('#canvas .section-block.selected').length };
  }, which);
}

test('L0 ★전제 — ★장면이 ★서고 ★★더블이 ★★살아 있다 (⛔0 이면 ★아래는 ★★장면 실패다)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `★장면 — ${s.why || ''} ${s.stack || ''}`).toBe(true);
  expect(s.n, `★섹션 ★둘 — ★잰 값 ${s.n}`).toBeGreaterThanOrEqual(2);
  /* ★★★이 한 줄이 ★★«죽은 더블이 ★제품 판정으로 ★둔갑»을 ★막는다 */
  expect(s.canvasLen, `★★★`+`_loadCanvas` + ` 가 ★★0 이다 ⇒ ★★더블이 ★안 돌았다 — ★아래 ★전부 ★무효`)
    .toBeGreaterThan(0);
  /* ★★그리고 ★잠금 문이 ★있나 — ⛔없으면 ★L1 이 ★★«안 쟀다»가 된다 */
  const doors = await page.evaluate(() => ({
    set: typeof window.setSectionProtected === 'function',
    is: typeof window.isSectionProtected === 'function',
  }));
  expect(doors, `★잠금 문 — ★잰 값 ${JSON.stringify(doors)}`).toEqual({ set: true, is: true });
});

test('L1 ★★★잠긴 섹션은 ★★교체되지 ★않는다 ＋ ★★«왜»를 ★말한다 (★★고치기 ★전 ★반드시 ★빨강)', async ({ page }) => {
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '전제: ★더블이 ★살아 있다').toBeGreaterThan(0);

  /* ★★앱의 ★제 문으로 ★잠근다 ＋ ★★«정말 ★잠겼나»를 ★★단언한다 */
  const locked = await page.evaluate(() => {
    const first = document.querySelector('#canvas .section-block');
    const r = window.setSectionProtected(first.id, true, 'C1 검사');
    return { ok: !!(r && r.ok), id: first.id, isProt: window.isSectionProtected(first.id),
             len: first.innerHTML.length };
  });
  expect(locked.ok, `전제: ★잠갔나 — ${JSON.stringify(locked)}`).toBe(true);
  expect(locked.isProt, `전제: ★`+`isSectionProtected` + `=참 — ${JSON.stringify(locked)}`).toBe(true);

  await openAndPick(page, s.tplId);
  const anchor = await pickAnchor(page, 0);
  expect(anchor.id, `전제: ★앵커 == ★잠긴 섹션 — ${anchor.id} vs ${locked.id}`).toBe(locked.id);
  expect(anchor.sel, `전제: ★섹션 ★하나만 ★골라졌다 — ★잰 값 ${anchor.sel}`).toBe(1);

  const before = await snap(page);
  await page.keyboard.press('Shift+Enter');
  await settled(page, before);
  const after = await snap(page);
  const survived = await page.evaluate((id) => {
    const el = document.getElementById(id);
    return el ? { present: true, len: el.innerHTML.length, prot: el.dataset.protected || null }
              : { present: false };
  }, locked.id);

  /* ★★★주 단언 ⑴ — ★★그 섹션이 ★★살아 있다 */
  expect(survived.present,
    `★★★잠긴 섹션이 ★★사라졌다 — ★전 ${JSON.stringify(before.ids)} → ★후 ${JSON.stringify(after.ids)} · `
    + `★그 섹션 ${JSON.stringify(survived)} · ★알림 ${JSON.stringify(after.alerts)}`)
    .toBe(true);
  /* ★★★주 단언 ⑵ — ★★«왜 ★안 되나»를 ★말했다. ⛔조용한 ★거절은 ★②의 ★둘째 결함이다 */
  expect(after.alerts.length,
    `★★★알림이 ★★없다 = ★★조용히 ★거절했다 — ★★사용자는 ★★알아챌 수가 ★없다. ★잰 값 ${JSON.stringify(after.alerts)}`)
    .toBeGreaterThan(0);
  /* ★★그리고 ★★자리도 ★안 밀렸다 */
  expect(after.n, `★섹션 ★수가 ★바뀌었다 — ★전 ${before.n} → ★후 ${after.n}`).toBe(before.n);
});

test('L2 ★★음성대조 — ★★안 잠긴 섹션은 ★★여전히 ★교체된다 (★★b2⒜ 가 ★산다)', async ({ page }) => {
  /* ★★★이 칸이 ★C1 의 ★핵이다 — ★★내가 ★더한 ★가드가 ★★이미 있던 ★기능을 ★★끄지 ★않았나.
     ★★261011 에 ★★그 꼴(★내 안전장치가 ★기존 것을 ★조용히 ★끔)이 ★★하루 ★세 번 ★났다. */
  const s = await scene(page);
  expect(s.ok, `전제: 장면 — ${s.why || ''}`).toBe(true);
  expect(s.canvasLen, '전제: ★더블이 ★살아 있다').toBeGreaterThan(0);

  await openAndPick(page, s.tplId);
  const anchor = await pickAnchor(page, 0);
  expect(anchor.sel, '전제: ★섹션 ★하나').toBe(1);
  /* ★★★전제 — ★★이 섹션은 ★★«안 잠겼다» */
  const prot = await page.evaluate((id) => window.isSectionProtected(id), anchor.id);
  expect(prot, `전제: ★앵커가 ★★안 잠겼다 — ★잰 값 ${prot}`).toBe(false);

  const before = await snap(page);
  await page.keyboard.press('Shift+Enter');
  await settled(page, before);
  const after = await snap(page);

  /* ★★교체 = ★★총수 ★불변 ＋ ★★첫 id 가 ★바뀐다 */
  expect({ n: after.n, firstChanged: after.firstId !== before.firstId },
    `★★★교체가 ★★안 됐다 ⇒ ★★내 가드가 ★★b2⒜ 를 ★끈 것이다 — `
    + `★전 ${JSON.stringify(before.ids)} → ★후 ${JSON.stringify(after.ids)} · ★알림 ${JSON.stringify(after.alerts)}`)
    .toEqual({ n: before.n, firstChanged: true });
});
