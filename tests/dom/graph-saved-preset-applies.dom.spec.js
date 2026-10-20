/* graph-saved-preset-applies.dom.spec.js — 1020t2c2 ★「Preset 절(UI)을 지워도 ★저장본은 산다」를 ★잰다.
 *
 * ★현빈 2026-10-20 「우측 프로퍼티에 프리셋 ★절은 없어도 될듯」 ⇒ ★절(UI)만 지웠고 ★적용 코드는 ★남겼다.
 *   ⇒ ★그 판정의 ★근거는 「`data-preset="dark"` 로 저장된 그래프는 ★열 때 모습이 그대로다」인데,
 *     ⛔그것이 ★말로만 적혀 있으면 ★다음 사람이 CSS 64줄을 ★「고아」로 보고 지운다.
 *     ★★그러면 ★이미 저장된 사용자 프로젝트의 ★그림이 ★바뀐다(되돌리기 어려운 회귀).
 *   ⇒ ★여기서 ★측정으로 잠근다.
 *
 * ★★못 쟀다 — ★현빈의 ★실제 저장본(userData, 앱 바깥)은 ★내가 못 본다.
 *   ★레포 안 템플릿의 graph-block 은 `data-preset="default"` 1건뿐이고 dark/minimal/colorful 은 0건이다
 *   (행위로 센 것: `grep -o 'data-preset="\(dark\|minimal\|colorful\)"' templates/ presets/ pages/ proto/`).
 *   ⇒ ★그래서 ★이 검사가 ★저장본을 ★스스로 만든다 — ★앱의 ★제 문(updateGraphBlock)으로 값을 넣고,
 *     ★직렬화한 HTML 을 ★다시 실어(=로드가 하는 것) ★그림이 ★같은지 본다.
 *
 * ★UI 가 없어진 뒤 ★남은 「거는 길」 = `updateGraphBlock(id, { preset })` (PM/MCP 가 부르는 바로 그 문 ·
 *   js/block-factory.js 의 `const PRESETS` 가 ★값을 검증한다). ⇒ ★이 검사는 ★그 문을 쓴다.
 * ★소스 쪽 명부 대조(block-factory ↔ CSS ↔ MCP enum ★3곳)는 tests/unit/graph-preset-roster.test.mjs 가 잰다.
 *
 * ★양성대조 — 핀 `a42d76d59f45a70eb3ee0e1f68a8ed37650f7565` 에서 S1·S2 는 ★초록이어야 한다(적용 코드는 ★그때도 있었다).
 *   ⇒ ★이 검사는 ★「절을 지워도 안 깨졌다」를 ★재는 자다. ★빨개지는 것은 ★CSS 64줄이나 적용 코드를 ★지웠을 때다.
 *   ★S0 는 ★핀에서 ★빨강이다(그 판엔 Preset 절이 ★있다) — ★절이 ★되돌아오면 ★알려 주는 래칫.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-saved-preset-applies.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secG"]';
const SEC_HTML = '<div class="section-block" id="secG" style="position:relative;height:520px;background:#f4f4f6"><div class="section-inner"></div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); window.applyZoom?.(100); }, SEC_HTML);
  return errs;
}

/** ★사람 손 그대로 — 컴포넌트 목록 → 「Graph」. 돌려줌: 새 블럭 id. */
async function addGraph(page) {
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.9, r.top + r.height * 0.9, { sel: SEC }, { label: '섹션 고르기' });
  await expect.poll(() => page.evaluate(() => document.getElementById('secG').classList.contains('selected')), '★전제: 섹션이 골라졌다').toBe(true);
  await page.evaluate(() => window.toggleFpDropdown?.('fp-component-dropdown'));
  await page.locator('#fp-component-dropdown .fp-menu-item', { hasText: /^Graph$/ }).first().click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secG .graph-block').length), '★전제: 그래프 블럭이 하나 생겼다').toBe(1);
  return page.evaluate(() => document.querySelector('#secG .graph-block').id);
}

/** 그래프의 ★그려진 색 — 블럭 배경 ＋ 첫 막대 칠. ★computed 로 본다(인라인 style 이 아니라 ★CSS 가 준 값). */
const paint = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  const bar = b.querySelector('.grb-bar-fill, .grb-bar-h-fill');
  return {
    preset: b.dataset.preset || '(없음)',
    blockBg: getComputedStyle(b).backgroundColor,
    blockColor: getComputedStyle(b).color,
    barBg: bar ? getComputedStyle(bar).backgroundColor : '(막대 없음)',
  };
}, id);

test('S0 ★래칫 — 그래프 패널에 「Preset」 절이 ★0개다 (★핀에서는 단추 4개 · 제목 1개였다)', async ({ page }) => {
  const errs = await setup(page);
  await addGraph(page);
  const r = await page.evaluate(() => ({
    btns: document.querySelectorAll('[id^="grb-preset-"]').length,
    titles: [...document.querySelectorAll('#panel-right .prop-section-title')].filter((e) => e.textContent.trim() === 'Preset').length,
    sections: document.querySelectorAll('#panel-right .prop-section').length,
    presetGroups: document.querySelectorAll('#panel-right .prop-preset-group').length,
  }));
  console.log('[S0] ' + JSON.stringify(r));
  /* ★전제 — 패널이 ★떴다. ⛔0건을 「없다」로 닫지 않는다(패널이 안 떠도 0 이 나온다). */
  expect(r.sections, '★전제: 그래프 패널에 절이 떴다 — 이게 0이면 아래 0건은 ★「안 재고 있다」다').toBeGreaterThanOrEqual(4);
  expect(r.btns, '★Preset 단추가 되돌아왔다(핀에서는 4개)').toBe(0);
  expect(r.titles, '★「Preset」 절 제목이 되돌아왔다(핀에서는 1개)').toBe(0);
  expect(errs).toEqual([]);
});

test('S1 ★저장본이 산다 — updateGraphBlock(preset:"dark") → 직렬화 → ★다시 실으면 ★그림이 같다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGraph(page);
  const before = await paint(page, id);
  console.log('[S1 기본] ' + JSON.stringify(before));

  /* ⑴ ★남은 「거는 길」 — PM/MCP 가 부르는 바로 그 문. ★UI 가 없어도 값이 걸린다. */
  const res = await page.evaluate((id) => window.updateGraphBlock(id, { preset: 'dark' }), id);
  expect(res && res.ok, `★updateGraphBlock 이 실패했다: ${JSON.stringify(res)} — ★절을 지운 뒤 ★유일하게 남은 길이다`).toBe(true);
  await expect.poll(() => page.evaluate((i) => document.getElementById(i).dataset.preset, id), 'dark 가 걸렸다').toBe('dark');
  const dark = await paint(page, id);
  console.log('[S1 dark] ' + JSON.stringify(dark));
  expect(dark.blockBg, '★dark 프리셋의 블럭 배경(css/editor-graph.css `[data-preset="dark"]`)').not.toBe(before.blockBg);

  /* ⑵ ★저장 — 직렬화된 HTML 에 ★속성이 실린다(이게 ★저장본이다). */
  const saved = await page.evaluate(() => document.querySelector('#secG .section-inner').innerHTML);
  expect(saved.includes('data-preset="dark"'), '★직렬화에 data-preset="dark" 가 안 실렸다 — 저장본이 프리셋을 ★잃는다').toBe(true);

  /* ⑶ ★다시 열기 — 로드가 하는 것과 같게 ★HTML 을 다시 싣고 ★rebindAll. ★절(UI)이 없어도 ★CSS 가 그린다. */
  await page.evaluate((html) => {
    const inner = document.querySelector('#secG .section-inner');
    inner.innerHTML = '';
    inner.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
  }, saved);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secG .graph-block').length), '★다시 실은 뒤 그래프가 하나다').toBe(1);
  const id2 = await page.evaluate(() => document.querySelector('#secG .graph-block').id);
  const reopened = await paint(page, id2);
  console.log('[S1 다시 열기] ' + JSON.stringify(reopened));
  expect(reopened, '★★저장본을 다시 열었더니 그림이 달라졌다 — ★「절만 지운다」의 전제가 깨진 것이다').toEqual(dark);
  expect(errs).toEqual([]);
});

test('S2 ★네 프리셋이 ★전부 ★서로 다른 그림을 낸다 — ⛔「적용 코드가 남았다」를 ★이름으로 닫지 않는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGraph(page);
  /* ★명부를 ★손으로 적지 않는다 — ★block-factory 의 ★값 검증이 받아들이는 것을 ★그 문으로 ★가려낸다.
     ⛔네 이름을 리터럴로 베끼면 ★둘째 명부가 된다. */
  const CAND = ['default', 'dark', 'minimal', 'colorful', '__없는프리셋__'];
  const seen = {}, rejected = [];
  for (const p of CAND) {
    const res = await page.evaluate(([i, p]) => window.updateGraphBlock(i, { preset: p }), [id, p]);
    if (!res || !res.ok) { rejected.push(p); continue; }
    await expect.poll(() => page.evaluate((i) => document.getElementById(i).dataset.preset, id), `${p} 가 걸렸다`).toBe(p);
    seen[p] = await paint(page, id);
  }
  console.log('[S2] ' + JSON.stringify(seen, null, 1) + '\n[S2 거부된 값] ' + JSON.stringify(rejected));
  /* ⑴ ★음성대조 — ★없는 값은 ★거부된다. ⛔이게 없으면 「전부 통과」와 구분이 안 된다. */
  expect(rejected, '★없는 프리셋이 ★거부되지 않았다 — block-factory 의 값 검증(const PRESETS)이 죽었다').toEqual(['__없는프리셋__']);
  /* ⑵ ★전제 — 네 개가 ★다 걸렸다. */
  expect(Object.keys(seen).sort(), '★받아들여진 프리셋 명부').toEqual(['colorful', 'dark', 'default', 'minimal']);
  /* ⑶ ★본 단언 — ★그림이 ★서로 다르다. ★이름만 남고 CSS 가 지워지면 ★여기서 빨개진다. */
  const sig = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, `${v.blockBg}|${v.blockColor}|${v.barBg}`]));
  const uniq = new Set(Object.values(sig));
  expect(uniq.size, `★네 프리셋이 ★같은 그림을 낸다 — css/editor-graph.css 의 .graph-block[data-preset=…] 가 ★죽었다는 뜻이다. 잰 값: ${JSON.stringify(sig, null, 1)}`).toBe(4);
  expect(errs).toEqual([]);
});
