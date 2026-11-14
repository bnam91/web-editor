/* tab-font-size-1114.dom.spec.js — 텍스트 블럭 고름 → Tab → 우측 패널 «글자 크기» 칸 (현빈 직접 · 261114 · 예시 «88» 고정)
 * 고침(js/editor.js): 전역 keydown 에 Tab 갈래(_tabToFontSize) — 텍스트 블럭 «하나만» 골랐고 편집·입력칸·패널 밖일 때
 *   #txt-size-number 에 포커스 + 전체 선택. Enter/Esc 로 끝나면 window 캡처 리스너가 한 틱 뒤 칸을 떠나 캔버스로(블럭은 골라진 채).
 *   크기 적용은 칸의 기존 핸들러(prop-text-wireup-text-edit.js sizeNumber · 커밋 가드) 그대로.
 * 칸
 *   T1 고름 → Tab → activeElement=#txt-size-number · «88» 치면 값 88(전체 선택이라 덮어씀) · Enter → 글자 크기 88px · 캔버스로 · 블럭 골라진 채
 *   T2 Tab → «50» → Esc = 크기 무변 · 캔버스로 · 블럭 골라진 채
 *   N1 음성 — 글자 편집 중 Tab 은 칸으로 안 간다(크기 무변)
 *   N2 음성 — 표 칸 편집 중 Tab 은 다음 칸으로(block-drag.js 기존)
 *   N3 음성 — 고른 것 없음 · 표(텍스트 아님) 고름 · 텍스트 둘 고름 → 칸으로 안 간다
 * 양성대조: ⑴ editor.js 의 `if (e.key === 'Tab' … _tabToFontSize())` 줄 삭제 → T1·T2 빨강(포커스가 칸에 안 감)
 *   ⑵ editor.js 의 window 캡처 keydown(_tabFromCanvas → blur) 삭제 → T1 빨강(커밋 가드가 칸에 포커스를 되돌린다) · T2 빨강(칸에 남음)
 *   ⑶ _tabToFontSize 의 `!sel[0].classList.contains('text-block')` 삭제 → N3 표 고름 빨강(표 패널엔 칸이 없으면 초록 — 실측 기록)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  const ids = await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
    const add = (fn, cls) => {
      const before = new Set([...document.querySelectorAll('#canvas .' + cls)].map(e => e.id));
      document.getElementById('sA').classList.add('selected'); fn();
      return [...document.querySelectorAll('#canvas .' + cls)].find(e => !before.has(e.id))?.id || null;
    };
    const t1 = add(() => window.addTextBlock('body', { content: 'AAA BBB' }), 'text-block');
    const t2 = add(() => window.addTextBlock('body', { content: 'CCC DDD' }), 'text-block');
    const tbl = add(() => window.addTableBlock({}), 'table-block');
    window.deselectAll?.(); document.activeElement?.blur?.();
    return { t1, t2, tbl };
  }, SEC);
  await page.waitForTimeout(250);
  return { errs, ...ids };
}

async function clickCenter(page, sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(250);
}

const st = (page, id) => page.evaluate((id) => {
  const tb = document.getElementById(id), ce = tb.querySelector('[contenteditable]') || tb;
  const ae = document.activeElement;
  return { ae: ae?.id || ae?.tagName, selected: tb.classList.contains('selected'), editing: tb.classList.contains('editing'),
    fs: getComputedStyle(ce).fontSize, field: document.getElementById('txt-size-number')?.value ?? null };
}, id);

test('T1 고름 → Tab → 글자 크기 칸 · «88» Enter → 88px · 캔버스로 · 골라진 채', async ({ page }) => {
  const { errs, t1 } = await setup(page);
  await clickCenter(page, '#' + t1);
  const s0 = await st(page, t1);
  expect(s0, '[전제] 고름(편집 아님) · 칸 있음').toMatchObject({ selected: true, editing: false });
  expect(s0.field, '[전제] 패널에 #txt-size-number').not.toBeNull();
  expect(s0.fs).not.toBe('88px');
  await page.keyboard.press('Tab');
  expect((await st(page, t1)).ae, 'Tab → 글자 크기 칸').toBe('txt-size-number');
  await page.keyboard.type('88');
  expect((await st(page, t1)).field, '전체 선택이라 «88» 로 덮인다(이어붙지 않는다)').toBe('88');
  await page.keyboard.press('Enter');
  await expect.poll(() => st(page, t1), 'Enter 뒤 — 88px · 칸을 떠남 · 골라진 채')
    .toMatchObject({ fs: '88px', field: '88', selected: true, editing: false, ae: 'BODY' });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('T2 Tab → «50» → Esc = 크기 무변 · 캔버스로 · 골라진 채', async ({ page }) => {
  const { errs, t1 } = await setup(page);
  await clickCenter(page, '#' + t1);
  const s0 = await st(page, t1);
  await page.keyboard.press('Tab');
  expect((await st(page, t1)).ae).toBe('txt-size-number');
  await page.keyboard.type('50');
  await page.keyboard.press('Escape');
  await expect.poll(() => st(page, t1), 'Esc 뒤').toMatchObject({ fs: s0.fs, selected: true, ae: 'BODY' });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 음성 — 글자 편집 중 Tab 은 칸으로 안 간다', async ({ page }) => {
  const { errs, t1 } = await setup(page);
  await clickCenter(page, '#' + t1);
  const b = await page.locator('#' + t1).boundingBox();
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(250);
  const s0 = await st(page, t1);
  expect(s0.editing, '[전제] 편집 중').toBe(true);
  await page.keyboard.press('Tab');
  const s1 = await st(page, t1);
  expect(s1.ae, '편집 중 Tab 이 칸을 뺏었다').not.toBe('txt-size-number');
  expect(s1.fs).toBe(s0.fs);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N2 음성 — 표 칸 편집 중 Tab 은 다음 칸으로(기존)', async ({ page }) => {
  const { errs, tbl } = await setup(page);
  await clickCenter(page, '#' + tbl);
  const cell = page.locator(`#${tbl} td, #${tbl} th`).first();
  const b = await cell.boundingBox();
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(250);
  const first = await page.evaluate((id) => { const all = [...document.querySelectorAll(`#${id} th, #${id} td`)]; return all.indexOf(document.activeElement); }, tbl);
  expect(first, '[전제] 칸 편집 중').toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Tab');
  const r = await page.evaluate((id) => { const all = [...document.querySelectorAll(`#${id} th, #${id} td`)]; return { idx: all.indexOf(document.activeElement), ae: document.activeElement?.id || '' }; }, tbl);
  expect(r.ae).not.toBe('txt-size-number');
  expect(r.idx, '다음 칸').toBe(first + 1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N3 음성 — 고른 것 없음 · 표 고름 · 텍스트 둘 고름 → 칸으로 안 간다', async ({ page }) => {
  const { errs, t1, t2, tbl } = await setup(page);
  const aeAfterTab = async () => { await page.keyboard.press('Tab'); const ae = await page.evaluate(() => document.activeElement?.id || ''); await page.evaluate(() => document.activeElement?.blur?.()); return ae; };
  expect(await aeAfterTab(), '고른 것 없음').not.toBe('txt-size-number');
  await clickCenter(page, '#' + tbl);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), tbl), '[전제] 표 고름').toBe(true);
  expect(await aeAfterTab(), '표(텍스트 아님) 고름').not.toBe('txt-size-number');
  // 둘 고름 — 상태로 만든다(패널은 그 상태로 다시 그린다 · 실측: 칸 유무를 기록)
  const field = await page.evaluate(([a, b]) => {
    window.deselectAll?.(); document.getElementById(a).classList.add('selected'); document.getElementById(b).classList.add('selected');
    window.showMultiSelectPanel?.(); return !!document.getElementById('txt-size-number');
  }, [t1, t2]);
  test.info().annotations.push({ type: '실측', description: `텍스트 둘 고름 — #txt-size-number ${field ? '있음' : '없음'}` });
  expect(await aeAfterTab(), '텍스트 둘 고름').not.toBe('txt-size-number');
  expect(errs, errs.join('\n')).toEqual([]);
});
