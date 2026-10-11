/* tpl-browser-close.dom.spec.js — ★템플릿 브라우저가 ★★«display:none 까지» 닫힌다 (t3frame 2026-10-11)
 *
 * ★무엇을 고쳤나 — `js/panels/template-browser.js closeTemplateBrowser`:
 *   초판은 `transitionend` ＋ `{ once: true }` «하나»에 `display='none'` 을 매달았다.
 *   `openTemplateBrowser` 가 `requestAnimationFrame` 으로 `.open` 을 붙으므로
 *   ★«열자마자 닫으면» opacity 가 아직 0 근처라 변화가 없고 ⇒ transitionend 가 안 온다
 *   ⇒ 그 리스너는 영영 안 깨어나고 `display` 가 ★`flex` 로 남는다.
 *   ⇒ ★끝내는 길을 ★둘로(transitionend ＋ 여유 타이머 260ms) ★멱등으로 두었다.
 *
 * ★★사람이 겪는 해악 = `pointer-events:none` 은 ★«탭 순서»를 안 뺀다 ⇒ 보이지 않는 패널의
 *   검색칸·단추로 ★키보드 포커스가 사라진다. ⇒ 그래서 단언을 ★★두 축으로 건다:
 *     ㉠ display === 'none'      ㉡ ★Tab 으로 패널 «안»에 안 들어간다
 *   ㉡은 ㉠이 참이면 자동이지만, ★★«고침이 ㉠을 우회하는 꼴»(예: opacity 만 건드리기)을 막는 자다.
 *
 * ★누름 꼴 = ★`page.keyboard.press` · ★진짜 `page.click`. ⛔`dispatchEvent` 를 쓰지 않는다.
 * ⚠️`reduced-motion` 은 ★무죄다 — 따로 재서 가렸다(C6). ★참 축은 «전환이 끝나기 전에 닫나»다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/tpl-browser-close.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const WAIT = 500;                      /* CSS 0.2s ＋ 폴백 260ms 보다 넉넉히 */
const READ = `() => { const p = document.getElementById('tpl-browser'); const cs = getComputedStyle(p);
  return { display: cs.display, opacity: cs.opacity, hasOpen: p.classList.contains('open'), inline: p.style.display || '(빈칸)' }; }`;

/** 앱을 띄우고 ⌘T 로 «연다» — 여는 길도 사람 경로다 */
async function openIt(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const pre = await page.evaluate(() => getComputedStyle(document.getElementById('tpl-browser')).display);
  await page.keyboard.press('Meta+t');
  const op = await page.evaluate(eval(READ));
  return { errs, pre, op };
}

/** ㉡ ★Tab 으로 패널 «안»에 들어가나 — 들어가면 그 요소 이름을 돌려준다 */
const TAB_IN = async (page) => {
  await page.evaluate(() => { document.body.focus?.(); if (document.activeElement?.blur) document.activeElement.blur(); });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(() => {
      const ae = document.activeElement;
      const p = document.getElementById('tpl-browser');
      return (ae && p && p.contains(ae)) ? (ae.id || ae.tagName) : null;
    });
    if (hit) return hit;
  }
  return null;
};

for (const [name, closeIt] of [
  ['B1 ★열자마자 ★함수로 닫기', async (page) => { await page.evaluate(() => window.closeTemplateBrowser?.()); }],
  ['B2 ★열자마자 ★Esc(사람 경로)', async (page) => { await page.keyboard.press('Escape'); }],
  ['B3 ★열자마자 ★닫는 단추(진짜 클릭)', async (page) => { await page.click('#tpl-browser-close', { timeout: 2500 }); }],
]) {
  test(`${name} ⇒ ★★display:none 까지 간다 ＋ ★Tab 이 패널 안에 ★안 들어간다`, async ({ page }) => {
    const { errs, pre, op } = await openIt(page);
    expect(pre, '전제: 열기 전엔 닫혀 있다').toBe('none');
    expect(op.display, '전제: ⌘T 로 열렸다').toBe('flex');
    /* ★★전제 — ★«열자마자»다: 전환이 ★아직 안 끝났다(opacity < 1) */
    expect(Number(op.opacity) < 1, `전제: 전환 중이다 (opacity=${op.opacity})`).toBe(true);
    await closeIt(page);
    await page.waitForTimeout(WAIT);
    const t = await page.evaluate(eval(READ));
    const tabHit = await TAB_IN(page);
    console.log(`[${name}] ${WAIT}ms 뒤: display=${t.display} opacity=${t.opacity} .open=${t.hasOpen} inline=${t.inline} · Tab 으로 들어간 것=${tabHit || '(없다)'}`);
    expect(t.display, '㉠ display 가 none 까지 간다').toBe('none');
    expect(tabHit, '㉡ Tab 으로 패널 안에 안 들어간다').toBeNull();
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('B4 ★음성 — ★전환이 ★끝난 뒤 닫기(Esc)도 ★그대로 닫힌다', async ({ page }) => {
  const { pre, op } = await openIt(page);
  expect(pre, '전제: 닫혀 있다').toBe('none');
  expect(op.display, '전제: 열렸다').toBe('flex');
  await page.waitForTimeout(WAIT);
  const mid = await page.evaluate(eval(READ));
  expect(mid.opacity, '전제: 전환이 끝나 opacity 1').toBe('1');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(WAIT);
  const t = await page.evaluate(eval(READ));
  console.log(`[B4] 전환 끝난 뒤 Esc ⇒ display=${t.display} opacity=${t.opacity}`);
  expect(t.display, '기존 길도 그대로다(무회귀)').toBe('none');
});

test('B5 ★음성 — ★★reduced-motion 에서도 ★닫힌다 (★그 축은 ★무죄다)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { op } = await openIt(page);
  const m = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(m, '전제: reduce 가 켜졌다').toBe(true);
  expect(op.display, '전제: 열렸다').toBe('flex');
  await page.evaluate(() => window.closeTemplateBrowser?.());
  await page.waitForTimeout(WAIT);
  const t = await page.evaluate(eval(READ));
  console.log(`[B5] reduce ＋ 열자마자 닫기 ⇒ display=${t.display} opacity=${t.opacity}`);
  expect(t.display, 'reduce 에서도 none 까지 간다').toBe('none');
});

test('B6 ★★×10 — ★바닥이 ★타이밍이라 ★1회 초록은 ★운일 수 있다', async ({ page }) => {
  const fails = [];
  for (let i = 1; i <= 10; i++) {
    const { op } = await openIt(page);
    if (op.display !== 'flex') { fails.push(`${i}회: 안 열렸다(${op.display})`); continue; }
    await page.keyboard.press('Escape');            /* ★열자마자 — ★그 흔들리던 장면 */
    await page.waitForTimeout(WAIT);
    const t = await page.evaluate(eval(READ));
    if (t.display !== 'none') fails.push(`${i}회: display=${t.display} opacity=${t.opacity} inline=${t.inline}`);
  }
  console.log(`[B6] ★10회 중 ★빨강 ${fails.length}건 ${fails.length ? '⇒ ' + fails.join(' · ') : '(0/10)'}`);
  expect(fails, `★0/10 이어야 한다 — ${fails.join(' · ')}`).toEqual([]);
});
