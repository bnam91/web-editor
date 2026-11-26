/* toolbar-shortcut-tip.dom.spec.js — 0.9.13 235 NEW-현빈QA-TOOLBAR-SHORTCUT-LABEL-01(현빈 QA 261126 01:01)
 *   중앙 플로팅 컨트롤러: 펜툴·브러쉬 옆 단축키 글자 걷고 툴팁(호버)으로 통일 · 다른 단추 툴팁 단축키도 같은 꼴.
 *   꼴 = FigCraft 도구 툴팁 «이름  단축키»(두 칸 · ~/ref/figcraft crates/ui-egui/src/toolbar.rs:210·382·415 format!("{}  {}", label, pretty_shortcut)).
 *   바꿀 수 있는 단축키(설정 addText·addAsset·addSection)는 «지금 묶인 키»를 보인다(settings-store getShortcut · _shortcutLabel).
 * 빨강 기대: f93500071 = T1·T2·T3 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const tipOf = (page, sel) => page.evaluate((s) => document.querySelector(s)?.getAttribute('title') ?? null, sel);
const ITEMS = [
  ['Pencil', `.fp-menu-item[onclick^="toggleFreehand('pencil')"]`, 'N'],
  ['Brush', `.fp-menu-item[onclick^="toggleFreehand('brush')"]`, '⇧B'],
  ['Pen(벡터 펜)', `.fp-menu-item[onclick^="toggleVectorPenMode()"]`, 'P'],   // P = editor.js toggleVectorPenMode(어노테이션 아님)
  ['Section', '.fp-btn[onclick="addSection()"]', 'S'],
  ['Text', `.fp-btn[onclick="toggleFpDropdown('fp-text-dropdown')"]`, 'T'],
  ['Asset', `.fp-btn[onclick="toggleFpDropdown('fp-asset-dropdown')"]`, 'A'],
];

test('T1 컨트롤러 단추·메뉴 글자에 단축키 «(N)» 꼴 없음', async ({ page }) => {
  const errs = await bootApp(page);
  const bad = await page.evaluate(() => [...document.querySelectorAll('.fp-btn, .fp-menu-item')]
    .map((b) => b.textContent.trim()).filter((t) => /\((?:[⇧⌘⌥⌃]|Shift\+|Ctrl\+)?[A-Z0-9]\)\s*$/.test(t)));
  expect(bad, '★단축키가 글자에 붙은 항목').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 툴팁 = «이름  단축키»(FigCraft 꼴 · 두 칸 · 괄호 없음)', async ({ page }) => {
  const errs = await bootApp(page);
  await page.waitForFunction(() => !!window._settings);
  for (const [name, sel, key] of ITEMS) {
    const t = await tipOf(page, sel);
    expect(t, `[전제] ${name} 단추 있음`).not.toBeNull();
    expect(t.endsWith(`  ${key}`), `★${name} 툴팁 «${t}» 끝 = «  ${key}»`).toBe(true);
    expect(t, `${name} 옛 «(…)» 꼴 없음`).not.toMatch(/\((?:[⇧⌘⌥⌃])?[A-Z]\)/);
  }
  /* AI 단추 옛 툴팁 «(⌘K)» = 묶인 키 없음(js/ai-prompt.js 는 창 안 ⌘Enter·Esc 뿐 · editor.js KeyK = 그리드 아이콘 줄) ⇒ 거짓 표기 걷음 */
  expect(await tipOf(page, '#ai-btn'), '★AI 툴팁에 없는 단축키 ⌘K 없음').not.toContain('⌘K');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 설정에서 바꾼 키 = 툴팁도 따라감(텍스트 T → Y)', async ({ page }) => {
  const errs = await bootApp(page);
  await page.waitForFunction(() => !!window._settings);
  const sel = ITEMS.find((i) => i[0] === 'Text')[1];
  await page.evaluate(() => { window._settings.shortcuts.addText = 'KeyY'; window.dispatchEvent(new CustomEvent('settings:changed', { detail: window._settings })); });
  await expect.poll(() => tipOf(page, sel), { message: '★바꾼 키가 툴팁에' }).toMatch(/  Y$/);
  expect((await tipOf(page, sel)).match(/  /g)?.length, '단축키 한 번만(겹쳐 붙지 않음)').toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});
