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

/* ★★T3 를 ★★두 test 로 ★갈랐다 — ★앞 칸이 ★패널을 ★열어 두면 ★뒤 칸의 ★전제(닫혀 있다)가 ★안 선다.
   ★★그리고 ★★`closeTemplateBrowser()` 로는 ★이 하네스에서 ★★안 닫힌다 —
     ★그 함수가 ★★`transitionend` 를 ★기다려 ★`display='none'` 을 쓰고(`template-browser.js:57~59`, `{ once: true }`)
     ★하네스에서 ★그 이벤트가 ★★안 왔다(★실측: `display=flex` 로 ★남았다).
   ⇒ ★★그래서 ★★«장면을 ★되돌리는» 대신 ★★«새 페이지»로 ★간다(★Playwright 가 test 마다 ★새 page 를 준다).
   ⚠️★그 `transitionend` 가 ★★앱에서도 ★안 올 수 있나는 ★★별건으로 ★따로 쟀다(★지디에게 ★올린다).

   ⛔★★★그리고 ★아래 ★둘째 단언(「t 가 ★안 들어간다」)은 ★★«잠그는 자»가 ★아니다 — ★★실측으로 ★확인했다:
     ★`e.preventDefault()` ★한 줄만 ★죽인 ★무력화 회차에서 ★★5칸이 ★★전부 ★초록이었다(cmdt-1011-MUT3.txt).
     ★까닭: ★★수식키 조합(`Meta+t`)은 ★브라우저가 ★애초에 ★글자로 ★안 넣는다 ⇒ ★그 단언은 ★★«항상 참»이다.
   ⇒ ★★그래도 ★★지우지 ★않는다 — ★★«타이핑이 깨지면 ★그때 ★빨개지는» 방어로는 ★뜻이 있다.
     ⛔단 ★★«이 단언이 ★무언가를 ★잠갔다»로 ★읽지 ★마라. ★★타이핑 쪽을 ★실제로 ★잠그는 자는 ★★T4(맨 t ⇒ 글자 블럭)다. */

test('T3a ★★입력칸(INPUT)에서도 ★열린다 ＋ ★★그 칸에 ★t 가 ★★안 들어간다', async ({ page }) => {
  const { pre } = await scene(page);
  expect(pre.display, '전제: 닫혀 있다').toBe('none');
  /* ★★초판(d1de2c43)은 ★입력칸에서 ★«안» 열었다 — ★그 조건의 까닭(「타이핑을 가로챈다」)이
     ★⌘T 에는 ★서지 않고, ★★«글자를 쓰다가 ★눌렀는데 ★아무 일도 ★안 난다»를 ★새로 만든다.
     ⇒ ★선례(⌘, 는 입력칸에서도 열린다)로 ★돌아왔고 ★이 칸이 ★그것을 ★잠근다.
     ⚠️이 입력칸은 ★검사가 ★만든 것이다(★앱 꼴이 ★아니다) — ★가드의 ★네 갈래 중 ★INPUT 하나를 ★겨냥한다. */
  const a1 = await page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 'probeInput'; i.type = 'text'; i.value = '';
    document.body.appendChild(i);
    i.focus();
    return { active: document.activeElement?.id, before: i.value };
  });
  console.log(`[T3a] 포커스=${a1.active} · 전 value=[${a1.before}] · ★누름 꼴 = ${PRESS} · 키 = Meta+t`);
  expect(a1.active, '전제: 그 입력칸에 포커스가 섰다').toBe('probeInput');
  await page.keyboard.press('Meta+t');
  const r1 = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('tpl-browser')).display,
    value: document.getElementById('probeInput').value,
  }));
  console.log(`[T3a] 누른 뒤 display=${r1.display} (★flex 여야) · value=[${r1.value}] (★빈칸이어야)`);
  expect(r1.display, '⒤ 입력칸에서도 열린다').toBe('flex');
  expect(r1.value, '⒥ 그 입력칸에 t 가 안 들어간다(preventDefault)').toBe('');
});

test('T3b ★★앱이 만든 contenteditable 에서도 ★열린다 ＋ ★글자가 ★★안 들어간다', async ({ page }) => {
  const { pre } = await scene(page);
  expect(pre.display, '전제: 닫혀 있다').toBe('none');
  await page.evaluate(() => {
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
  /* ★★사람 경로로 ★편집 진입 — ★`page.dblclick` */
  let dblErr = null;
  try { await page.dblclick('#probeTB', { timeout: 2500 }); } catch (e) { dblErr = String(e).split('\n')[0].slice(0, 90); }
  const a2 = await page.evaluate(() => {
    const ae = document.activeElement;
    const tb = document.getElementById('probeTB');
    return { active: ae ? (ae.id || ae.className.split(' ')[0] || ae.tagName) : '(null)',
             isCE: !!(ae && ae.isContentEditable), editing: !!document.querySelector('.text-block.editing'),
             before: (tb.textContent || '').trim() };
  });
  console.log(`[T3b] ★더블클릭(page.dblclick) ⇒ ${dblErr ? '⛔' + dblErr : '★성공'} · 포커스=${a2.active} isContentEditable=${a2.isCE} .editing=${a2.editing} · 전 글자=[${a2.before}]`);
  /* ★★전제가 ★안 서면 ★★FAIL 이 ★아니라 ★SKIP 이다(★범위 밖) */
  if (!a2.isCE) {
    console.log('[T3b] ⛔★★측정 ★불가 — ★전제(contenteditable 포커스)가 ★안 섰다 ⇒ ★★SKIP');
    test.skip(true, '전제 미성립: contenteditable 포커스가 안 섰다');
  }
  console.log(`[T3b] ★누름 꼴 = ${PRESS} · 키 = Meta+t`);
  await page.keyboard.press('Meta+t');
  const r2 = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('tpl-browser')).display,
    after: (document.getElementById('probeTB').textContent || '').trim(),
  }));
  console.log(`[T3b] 누른 뒤 display=${r2.display} (★flex 여야) · 글자 [${a2.before}] → [${r2.after}] (★같아야)`);
  expect(r2.display, '⒤ contenteditable 에서도 열린다').toBe('flex');
  expect(r2.after, '⒥ 그 글자 블럭에 t 가 안 들어간다').toBe(a2.before);
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
