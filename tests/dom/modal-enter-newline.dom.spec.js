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
