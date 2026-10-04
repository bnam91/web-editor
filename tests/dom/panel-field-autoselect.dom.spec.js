/* panel-field-autoselect.dom.spec.js — E66 「클릭 직후 친 첫 글자가 덮인다」 (2026-10-04, 지디 승인 · 태양)
 *
 * 무엇을 지키나: js/editor.js focusin 의 «값 전체 선택»(_AUTO_SELECT_SEL 다섯 클래스)이 «바로» 일어나,
 *   칸을 누르고 «곧바로» 친 글자가 첫 글자부터 온전히 남는다.
 *   옛 판은 select() 를 setTimeout(…,0) 으로 미뤘고, Chromium 이 입력 이벤트를 타이머보다 먼저 돌려
 *   첫 키 «뒤»에 select() 가 끼었다 → 「12AB34」→「2AB34」 · 「64」→「4」 (dcc8361c 원본 기계 타이핑 5/15 빨강).
 * C  클릭 → 즉시 타이핑 → 확정 «전» 칸 값 = 친 값 전체. 세 칸(.prop-number · .prop-color-hex · .prop-color-alpha-input) ×5.
 * C5 피커 팝업의 .goya-cp-hex · .goya-cp-alpha-input — 픽스처(섹션 배경 스와치)로 닿으면 같은 단언, 못 닿으면 skip(까닭 적음).
 * T  Tab 으로 칸에 들어가 즉시 타이핑 → 같은 단언(현재 동작 기록: Tab 도착 때 값 전체가 선택돼 있나).
 * 양성대조 = select 를 setTimeout(…,100) 으로 되돌린 사본에서 C 가 빨강(메시지: 기대값·실제값·포커스) — 보고서 E66-FIX.
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스, ⛔Electron 아님 — Electron 은 실앱 확인으로 따로).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="eS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px;padding-right:40px"><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    window.rebindAll?.(); window.deselectAll?.();
    const s = document.getElementById('eS'); s.classList.add('selected'); window.showSectionProperties(s);
  });
  await page.waitForTimeout(200);
  return errs;
}
const FIELDS = [
  ['number(.prop-number)', '#sec-padb-number', '64', '0'],
  ['hex(.prop-color-hex)', '#sec-bg-hex', '12AB34', 'FFFFFF'],
  ['alpha(.prop-color-alpha-input)', '#sec-bg-alpha', '45', '100'],
];
const focusInfo = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : null; });
/** 칸을 «떠난 상태»로 만들고 값을 시작값으로 되돌린다(매 회 같은 출발점). */
const reset = (page, sel, v0) => page.evaluate(([sel, v0]) => { document.activeElement?.blur?.(); document.querySelector(sel).value = v0; }, [sel, v0]);

for (const [name, sel, text, v0] of FIELDS) {
  test(`C 클릭 → 즉시 «${text}» — 첫 글자부터 온전 ×5 · ${name}`, async ({ page }) => {
    const errs = await setup(page);
    const got = [];
    for (let i = 0; i < 5; i++) {
      await reset(page, sel, v0);
      const r = await page.evaluate((sel) => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.left + Math.min(10, b.width / 3), b.top + b.height / 2]; }, sel);
      await page.mouse.click(r[0], r[1]);
      await page.keyboard.type(text);            // ⛔기다림 없음 — 이게 이 시험의 요점이다
      const v = await page.evaluate((sel) => document.querySelector(sel).value, sel);
      const ae = await focusInfo(page);
      got.push(v);
      expect(v, `${sel} 회차 ${i + 1}: 기대 «${text}» · 실제 «${v}» · 포커스=${ae}`).toBe(text);
      await page.keyboard.press('Escape');
    }
    expect(errs).toEqual([]);
  });
}

for (const [cls, text, v0] of [['.goya-cp-hex', '12AB34', 'FFFFFF'], ['.goya-cp-alpha-input', '45', '100']]) {
  test(`C5 피커 팝업 ${cls} — 클릭 → 즉시 «${text}» ×5`, async ({ page }) => {
    await setup(page);
    /* 섹션 배경 스와치를 누르면 Figma 식 피커가 뜬다(color-picker.js — 5f6be93e 「모든 .prop-color-swatch 클릭 시 … 피커 오픈」). */
    const sw = await page.evaluate(() => { const e = document.querySelector('#sec-bg-color')?.closest('.prop-color-swatch'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    test.skip(!sw, '픽스처에 섹션 배경 스와치가 없다 — goya-cp 칸에 닿을 길이 없음');
    await page.mouse.click(sw[0], sw[1]); await page.waitForTimeout(300);
    const sel = `.goya-cp-popover ${cls}`;
    const has = await page.evaluate((sel) => !!document.querySelector(sel), sel);
    test.skip(!has, `피커 팝업에 ${cls} 가 안 떴다 — 이 픽스처로는 미측정`);
    for (let i = 0; i < 5; i++) {
      await page.evaluate(([sel, v0]) => { const e = document.querySelector(sel); if (document.activeElement === e) e.blur(); e.value = v0; }, [sel, v0]);
      const r = await page.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return [b.left + Math.min(10, b.width / 3), b.top + b.height / 2]; }, sel);
      await page.mouse.click(r[0], r[1]);
      await page.keyboard.type(text);
      const v = await page.evaluate((sel) => document.querySelector(sel).value, sel);
      const ae = await focusInfo(page);
      expect(v, `${cls} 회차 ${i + 1}: 기대 «${text}» · 실제 «${v}» · 포커스=${ae}`).toBe(text);
    }
  });
}

for (const [name, sel, text, v0] of FIELDS) {
  test(`T Tab 으로 들어가 즉시 «${text}» — 온전 ×5 · ${name}`, async ({ page }) => {
    const errs = await setup(page);
    for (let i = 0; i < 5; i++) {
      await reset(page, sel, v0);
      /* 탭 순서에서 «바로 앞» 칸에 포커스를 두고 Tab 한 번 — 패널 안 보이는 포커스 가능 요소 순서 그대로. */
      const prevOk = await page.evaluate((sel) => {
        const t = document.querySelector(sel);
        const all = [...document.querySelectorAll('#panel-right input, #panel-right select, #panel-right button, #panel-right textarea, #panel-right [tabindex]')]
          .filter(e => !e.disabled && e.tabIndex >= 0 && e.offsetParent !== null);
        const k = all.indexOf(t);
        if (k <= 0) return null;
        all[k - 1].focus();
        return all[k - 1].id || all[k - 1].className || all[k - 1].tagName;
      }, sel);
      expect(prevOk, '전제 — 탭 순서에서 앞 칸이 있다').toBeTruthy();
      await page.keyboard.press('Tab');
      const arrived = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), sel);
      expect(arrived, `Tab 이 ${sel} 에 닿았다(앞 칸 ${prevOk} · 실제 포커스 ${await focusInfo(page)})`).toBe(true);
      await page.keyboard.type(text);
      const v = await page.evaluate((sel) => document.querySelector(sel).value, sel);
      const ae = await focusInfo(page);
      if (i === 0) console.log(`T ${name} Tab 도착 후 즉시 타이핑 → «${v}» (기대 «${text}», 시작값 «${v0}»)`);
      expect(v, `${sel} Tab 회차 ${i + 1}: 기대 «${text}» · 실제 «${v}» · 포커스=${ae}`).toBe(text);
      await page.keyboard.press('Escape');
    }
    expect(errs).toEqual([]);
  });
}
