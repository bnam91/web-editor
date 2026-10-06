/* modal-enter-newline.dom.spec.js — 모달 슬롯에서 Enter 로 낸 줄바꿈이 «포커스를 풀어도» 줄바꿈으로 남는가.
 *   (B4, 2026-10-03: 편집 중엔 두 줄인데 바깥을 클릭하면 한 줄로 합쳐진다)
 *
 * ★측정(36cbe872, 고치기 전):
 *   · 줄바꿈은 데이터에 «저장돼 있다» — dataset.textText 에 \n 이 있다(손실 아님). 렌더가 .tb-mdl-text 를
 *     textContent 로 그리는데 슬롯 CSS 에 white-space 가 없어 computed = normal → \n 이 공백으로 접힌다.
 * ★줄 수 = (offsetHeight − 위아래 padding) ÷ line-height — 배율(zoom)에 안 곱해지는 값이다.
 * ★양성대조: GD1001_ROOT=<36cbe872 체크아웃> 으로 돌리면 M1~M4·K1·K2 가 전부 빨강이어야 한다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const A = '가나다', B = '라마바';
const lines = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s); const cs = getComputedStyle(e);
  const lh = parseFloat(cs.lineHeight);
  const content = e.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  return { ws: cs.whiteSpace, lines: Math.round(content / lh), lh, content };
}, sel);

async function setup(page, variant) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await bootApp(page);
  await page.evaluate(([v, a, b]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sA" data-section="1" data-name="sA"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>');
    const { row, block } = window.makeModalBlock({ variant: v, title: a + '\n' + b, text: a + '\n' + b, cell1: a + '\n' + b, cell2: a + '\n' + b, wMode: 'full', fontSize: 20 });
    block.id = 'mdlT'; document.getElementById('inA').appendChild(row);
    window.renderModalBlock(block); window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('mdlT').scrollIntoView({ block: 'center' });
  }, [variant, A, B]);
  await page.waitForTimeout(300);
}

for (const [name, variant, sel] of [['M1 text(plain)', 'plain', '#mdlT .tb-mdl-text'], ['M2 title', 'titled', '#mdlT .tb-mdl-title'], ['M3 cell', 'grid-2', '#mdlT .tb-mdl-cell[data-mdl-slot="cell1"]']]) {
  test(`${name}: 저장된 \\n 이 렌더에서 두 줄이다`, async ({ page }) => {
    await setup(page, variant);
    const ds = await page.evaluate(() => { const b = document.getElementById('mdlT'); return b.dataset.textText || b.dataset.cell1; });
    expect(ds).toContain('\n');                       // 전제: 줄바꿈은 데이터에 있다
    const m = await lines(page, sel);
    expect(m.lines).toBe(2);
    expect(m.ws).toBe('pre-wrap');
  });
}

test('M4 아이콘 변형(icon-stack) 본문도 두 줄', async ({ page }) => {
  await setup(page, 'icon-stack');
  const m = await lines(page, '#mdlT .tb-mdl-text');
  expect(m.lines).toBe(2); expect(m.ws).toBe('pre-wrap');
});

test('K1 실제 키 입력: dblclick→글자→Enter→글자→바깥 클릭 뒤에도 두 줄', async ({ page }) => {
  await setup(page, 'plain');
  await page.evaluate(() => { const b = document.getElementById('mdlT'); b.dataset.textText = ''; window.renderModalBlock(b); });
  const slot = page.locator('#mdlT .tb-mdl-text');
  await slot.dblclick();
  expect(await page.evaluate(() => document.activeElement?.dataset?.mdlSlot)).toBe('text');   // 전제: 편집이 열렸다
  await page.keyboard.type(A); await page.keyboard.press('Enter'); await page.keyboard.type(B);
  await page.mouse.click(5, 5);                                                                  // 바깥 클릭 = blur
  await page.waitForTimeout(300);
  const ds = await page.evaluate(() => document.getElementById('mdlT').dataset.textText);
  expect(ds).toBe(A + '\n' + B);                      // 데이터엔 저장된다(원인이 렌더임을 가르는 줄)
  const m = await lines(page, '#mdlT .tb-mdl-text');
  expect(m.lines).toBe(2); expect(m.ws).toBe('pre-wrap');
});

test('K2 PNG 내보내기 경로: 수집된 CSS 만으로 그린 클론도 두 줄', async ({ page }) => {
  await setup(page, 'plain');
  const r = await page.evaluate(async () => {
    const { collectCanvasCss } = await import('/js/io/export-css-collect.js');
    const sec = document.getElementById('sA'); const css = collectCanvasCss(sec);
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:600px';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write('<!doctype html><style>' + css + '</style><body>' + sec.querySelector('.modal-block').outerHTML + '</body>'); f.contentDocument.close();
    const e = f.contentDocument.querySelector('.tb-mdl-text'); const cs = f.contentWindow.getComputedStyle(e);
    const out = { collected: /tb-mdl-text[^{]*\{[^}]*white-space:\s*pre-wrap/.test(css), ws: cs.whiteSpace,
      lines: Math.round((e.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight)) };
    f.remove(); return out;
  });
  expect(r.collected).toBe(true);                     // 전제: 수집기가 그 규칙을 실제로 집어 갔다
  expect(r.lines).toBe(2); expect(r.ws).toBe('pre-wrap');
});

/* ══ 적대QA 보강(2026-10-03) — innerText 가 빈 줄(Enter×2)을 «하나 더» 읽던 것 · 편집 중 줄 수 = blur 뒤 줄 수 ══
 *   측정(96988fd6): 가→Enter→Enter→나 : 편집 중 3줄(102px) → blur 뒤 4줄(136px), dataset "가\n\n\n나".
 *   처방 = 읽는 자리(_mdlReadText)가 div/br 를 «보이는 줄» 로. pre-wrap 은 유지(공백·탭도 편집 중 보이는 그대로 — pre-line 은
 *   "  가  나" 를 blur 뒤 6px 좁혀 편집 중과 갈린다, 실측). */
const typeSeq = async (page, seq) => { for (const s of seq) { if (s === 'E') await page.keyboard.press('Enter'); else await page.keyboard.type(s); } };
async function editFlow(page, seq) {
  await setup(page, 'plain');
  await page.evaluate(() => { const b = document.getElementById('mdlT'); b.dataset.textText = ''; window.renderModalBlock(b); });
  await page.locator('#mdlT .tb-mdl-text').dblclick();
  expect(await page.evaluate(() => document.activeElement?.dataset?.mdlSlot)).toBe('text');
  await typeSeq(page, seq);
  const during = await lines(page, '#mdlT .tb-mdl-text');
  await page.mouse.click(5, 5); await page.waitForTimeout(300);
  const after = await lines(page, '#mdlT .tb-mdl-text');
  const ds = await page.evaluate(() => document.getElementById('mdlT').dataset.textText);
  return { during, after, ds };
}
for (const [name, seq, expLines, expData] of [
  ['N1 Enter×2(빈 줄 하나)', ['가', 'E', 'E', '나'], 3, '가\n\n나'],
  ['N2 Enter×3', ['가', 'E', 'E', 'E', '나'], 4, '가\n\n\n나'],
  ['N3 맨 앞 Enter', ['E', '가'], 2, '\n가'],
  ['N4 Enter 한 번', ['가', 'E', '나'], 2, '가\n나'],
]) {
  test(`${name}: 편집 중 줄 수 = blur 뒤 줄 수`, async ({ page }) => {
    const r = await editFlow(page, seq);
    expect(r.during.lines).toBe(expLines);            // 전제: 편집 중 줄 수
    expect(r.ds).toBe(expData);
    expect(r.after.lines).toBe(expLines);
  });
}
test('N5 끝 Enter×2 — 끝의 빈 줄은 떼어 낸다(높이가 한 줄 늘지 않는다)', async ({ page }) => {
  const r = await editFlow(page, ['가', 'E', 'E']);
  expect(r.ds).toBe('가');
  expect(r.after.lines).toBe(1);
});
test('N6 공백·탭 꼴 — 앞뒤·연속 공백이 편집 중 입력한 그대로 저장·표시', async ({ page }) => {
  const r = await editFlow(page, ['  가  나', 'E', '다   ']);
  expect(r.ds).toBe('  가  나\n다   ');
  expect(r.after.ws).toBe('pre-wrap');
  expect(r.after.lines).toBe(2);
});
for (const stored of ['가나다\n라마바', '가나다\n\n라마바', '가\n\n']) {
  test(`P1 dblclick→blur 만으로 데이터 안 덮인다(${JSON.stringify(stored)})`, async ({ page }) => {
    await setup(page, 'plain');
    await page.evaluate((t) => { const b = document.getElementById('mdlT'); b.dataset.textText = t; window.renderModalBlock(b); window.__h = 0; const ph = window.pushHistory; window.pushHistory = (...a) => { window.__h++; return ph?.(...a); }; }, stored);
    await page.locator('#mdlT .tb-mdl-text').dblclick();
    await page.mouse.click(5, 5); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ ds: document.getElementById('mdlT').dataset.textText, h: window.__h }));
    expect(r.ds).toBe(stored); expect(r.h).toBe(0);
  });
}
