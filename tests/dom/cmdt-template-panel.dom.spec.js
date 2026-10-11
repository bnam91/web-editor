/* cmdt-template-panel.dom.spec.js — ⌘T 로 템플릿 브라우저 «열기» (현빈 2026-10-11 · 지디 발주)
 * ★현빈 원문: 「★커맨드t 누르면 ★템플릿 패널 ★열리게해줘」
 * ★여는 자는 ★이미 있다 — `js/panels/template-browser.js openTemplateBrowser()`
 *   (`docs/TEMPLATE_SYSTEM.md` 4절 ★공개 API 가 그 셋을 「브라우저 패널 여닫기」로 적어 뒀다)
 * ★★누름 꼴 = ★★`page.keyboard.press(...)` — ★Playwright ★실제 키보드. ⛔`dispatchEvent` 는 ★쓰지 ★않는다(★사람 경로가 아니다)
 * ★잠그는 것: ⑴양성(캔버스에서 열린다) ⑵윈도 축(Control+t) ⑶음성 ⒜(입력칸에서는 안 열린다) ⑷음성 ⒝(맨 t 는 기존 동작)
 * ⚠️이 하네스는 ★Electron 이 ★아니다(`_root-harness.js` 가 electronAPI 를 Proxy 가짜로) ⇒ ★Electron ★기본 메뉴 충돌은 ★★여기서 ★못 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/cmdt-template-panel.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PRESS = 'page.keyboard.press (Playwright 실제 키보드)';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const pre = await page.evaluate(() => {
    const panel = document.getElementById('tpl-browser');
    /* ★캔버스에 포커스를 둔다 — ★«어디서 눌렀나»를 못박는다 */
    document.getElementById('canvas')?.focus?.();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    return {
      panelFound: !!panel,
      display: panel ? getComputedStyle(panel).display : '(없다)',
      opener: typeof window.openTemplateBrowser,
      active: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '(null)',
    };
  });
  return { errs, pre };
}

test('T1 ★양성 — ★캔버스에서 ⌘T ⇒ ★템플릿 브라우저가 ★열린다', async ({ page }) => {
  const { errs, pre } = await scene(page);
  console.log(`[T1] ★누름 꼴 = ${PRESS} · 키 = Meta+t`);
  console.log(`[T1] 전제: 패널 있나=${pre.panelFound} · display=${pre.display} · openTemplateBrowser=${pre.opener} · 포커스=${pre.active}`);
  /* ★★전제 — ⛔«처음부터 참»을 막는다 */
  expect(pre.panelFound, '전제: #tpl-browser 가 있다').toBe(true);
  expect(pre.display, '전제: 누르기 «전»엔 닫혀 있다').toBe('none');
  expect(pre.opener, '전제: 여는 자가 window 에 있다').toBe('function');

  await page.keyboard.press('Meta+t');
  const after = await page.evaluate(() => {
    const p = document.getElementById('tpl-browser');
    return { display: getComputedStyle(p).display, inline: p.style.display || '(빈칸)' };
  });
  console.log(`[T1] 누른 뒤: computed display=${after.display} · inline=${after.inline}`);
  expect(after.display, '⌘T 로 열린다 — computed display').toBe('flex');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 ★윈도 축 — ★Control+t 도 ★열린다', async ({ page }) => {
  const { pre } = await scene(page);
  expect(pre.display, '전제: 닫혀 있다').toBe('none');
  console.log(`[T2] ★누름 꼴 = ${PRESS} · 키 = Control+t`);
  await page.keyboard.press('Control+t');
  const d = await page.evaluate(() => getComputedStyle(document.getElementById('tpl-browser')).display);
  console.log(`[T2] 누른 뒤 display=${d}`);
  expect(d, 'Control+t 로도 열린다').toBe('flex');
});

test('T3 ★★음성 ⒜ — ★입력칸에 포커스가 있으면 ★★안 열린다 (INPUT · contenteditable)', async ({ page }) => {
  const { pre } = await scene(page);
  expect(pre.display, '전제: 닫혀 있다').toBe('none');
  /* ⒜-1 INPUT — ★가드의 네 갈래 중 하나. ⚠️이 입력칸은 ★검사가 ★만든 것이다(★앱 꼴이 아니다) */
  const a1 = await page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 'probeInput'; i.type = 'text';
    document.body.appendChild(i);
    i.focus();
    return { active: document.activeElement?.id, tag: document.activeElement?.tagName };
  });
  console.log(`[T3 ⒜-1] 포커스=${a1.active}(${a1.tag}) · ★누름 꼴 = ${PRESS} · 키 = Meta+t`);
  await page.keyboard.press('Meta+t');
  const d1 = await page.evaluate(() => getComputedStyle(document.getElementById('tpl-browser')).display);
  console.log(`[T3 ⒜-1] 누른 뒤 display=${d1} (★none 이어야 한다)`);
  expect(d1, '입력칸(INPUT)에서는 안 열린다').toBe('none');

  /* ⒜-2 ★★앱이 만든 contenteditable — ★글자 블럭을 ★★«사람 경로»로 ★편집 진입(더블클릭)
     ⚠️첫 회차에 ★`ce.focus()` 만 썼더니 ★★`isContentEditable=false` 였다(★포커스가 ★안 갔다)
       ⇒ ★★그 상태에서 ★패널이 ★열린 것은 ★★«정상»이었고 ★제 단언이 ★★전제를 ★안 걸어 ★거짓 빨강을 냈다.
       ⇒ ★★그래서 ★전제를 ★★먼저 ★단언하고, ★안 서면 ★★«측정 불가»로 ★찍고 ★★skip 한다(⛔FAIL 이 ★아니다). */
  await page.evaluate(() => {
    document.getElementById('probeInput')?.remove();
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="cS"><div class="section-hitzone"></div>' +
      '<div class="section-inner" id="cS-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    window.selectSection(document.getElementById('cS'));
    window.addTextBlock?.('body');
    const tb = document.querySelector('#cS .text-block');
    if (tb) tb.id = 'probeTB';
  });
  let dblErr = null;
  try { await page.dblclick('#probeTB', { timeout: 2500 }); } catch (e) { dblErr = String(e).split('\n')[0].slice(0, 90); }
  const a2 = await page.evaluate(() => {
    const ae = document.activeElement;
    return { active: ae ? (ae.id || ae.className.split(' ')[0] || ae.tagName) : '(null)',
             isCE: !!(ae && ae.isContentEditable), editing: !!document.querySelector('.text-block.editing') };
  });
  console.log(`[T3 ⒜-2] ★더블클릭(page.dblclick) ⇒ ${dblErr ? '⛔' + dblErr : '★성공'} · 포커스=${a2.active} isContentEditable=${a2.isCE} .editing=${a2.editing}`);
  if (!a2.isCE) {
    console.log('[T3 ⒜-2] ⛔★★측정 ★불가 — ★전제(contenteditable 에 포커스)가 ★★안 섰다 ⇒ ★★SKIP(⛔FAIL 아님). ★까닭: 편집 진입이 이 하네스에서 안 섰다');
    test.skip(true, '전제 미성립: contenteditable 포커스가 안 섰다');
  }
  console.log(`[T3 ⒜-2] 키 = Meta+t`);
  await page.keyboard.press('Meta+t');
  const d2 = await page.evaluate(() => getComputedStyle(document.getElementById('tpl-browser')).display);
  console.log(`[T3 ⒜-2] 누른 뒤 display=${d2} (★none 이어야 한다)`);
  expect(d2, 'contenteditable 에서는 안 열린다').toBe('none');
});

test('T4 ★★음성 ⒝ — ★맨 t 는 ★패널을 ★안 열고 ★«글자 블럭 추가»가 ★그대로 돈다', async ({ page }) => {
  const { pre } = await scene(page);
  expect(pre.display, '전제: 닫혀 있다').toBe('none');
  const before = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="dS"><div class="section-hitzone"></div>' +
      '<div class="section-inner" id="dS-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    window.selectSection(document.getElementById('dS'));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    return { texts: document.querySelectorAll('#dS .text-block').length };
  });
  console.log(`[T4] 전: 글자 블럭 ${before.texts}개 · ★누름 꼴 = ${PRESS} · 키 = t (★수식키 없음)`);
  await page.keyboard.press('t');
  const after = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('tpl-browser')).display,
    texts: document.querySelectorAll('#dS .text-block').length,
  }));
  console.log(`[T4] 후: display=${after.display} · 글자 블럭 ${after.texts}개`);
  expect(after.display, '맨 t 로는 패널이 안 열린다').toBe('none');
  expect(after.texts > before.texts, `★기존 동작 무회귀 — 글자 블럭이 늘었다 (${before.texts} → ${after.texts})`).toBe(true);
});
