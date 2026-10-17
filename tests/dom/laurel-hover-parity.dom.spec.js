/* laurel-hover-parity.dom.spec.js — 1017t1g1 laurel 블럭 hover 꼴을 이웃 18종과 같게 (2026-10-17 gd/w2g)
 *
 * ★현빈 원문(1017t1g1): 「laurel 블럭에 호버시에 왜 점선이 생기는지?」
 * ★실측(플래너 — CDP CSS.getMatchedStylesForNode): laurel 에 걸리는 hover 규칙은 `.laurel-block:hover { outline:1px
 *   dashed … }` 한 건뿐. 같은 판 이웃(step·chat·comparison …)은 outline 규칙 0건 · `:hover::after` 틴트 규약을 쓴다.
 *   「왜 뒀나」를 `git log -S` 로 찾았으나 결정 기록·까닭 주석 0건 — 「의도됨」의 근거를 코드에서 못 찾았다.
 *   ⇒ 정본(`_context/DESIGN_SYSTEM.md:230-240`)·이웃 18종을 따라 laurel 도 `:hover::after` 틴트로 바꾼다
 *     (css/editor-blocks.css — 점선 outline 제거 · `.frame-block:not(.selected) … :hover::after` 억제 명부에 추가).
 *   ★예외로 점선을 남기는 선례(`.zoom-block:hover`)는 «까닭 주석 네 줄»을 달아 둔다 — laurel 엔 그 주석이 0건이었다
 *     ⇒ 「의도적 예외」가 아니라 「빠짐」으로 판정했다.
 *
 * ★선택되면 `body.sel-ov` 중화 절(editor-blocks.css:328-396)이 outline-color 를 transparent 로 돌린다 — 값이 뜻을
 *   잃는다(플래너가 1차 실측에서 실제로 밟았다). ⇒ 이 파일의 모든 양성 단언은 «선택 안 된» 블록으로 잰다.
 *
 * ⛔고정 대기 0 — waitForFunction / expect.poll 로 «그 값»을 기다린다(tests/unit/dom-fixed-wait-census.test.mjs W3 래칫).
 *
 * ★음성대조(자가 살아 있음 — GD1001_ROOT 핀 판, HEAD 를 대조 판으로 쓰지 않는다):
 *   GD1001_ROOT=<be2d2602 체크아웃 경로> npx playwright test --config=tests/dom/playwright.dom.config.js laurel-hover-parity
 *   → T-G1-1·T-G1-2 가 빨갛다(점선 outline 이 살아 있고 억제 명부에 laurel 이 없다). ×3 실측(흔들림 없음 확인).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js laurel-hover-parity
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect, ROOT } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';

async function scene(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((sec) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    window.addLaurelBlock?.({ gridCols: 1, gridRows: 1 });
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    window.addStepBlock?.();
    window.__laurel = [...document.querySelectorAll('#sB .laurel-block')].pop();
    window.__step   = [...document.querySelectorAll('#sB .step-block')].pop();
    window.buildLayerPanel?.(); window.deselectAll?.();
  }, SEC);
  await page.waitForFunction(() => !!window.__laurel && window.__laurel.isConnected && !!window.__step && window.__step.isConnected
    && !window.__laurel.classList.contains('selected') && !window.__step.classList.contains('selected'), null, { timeout: 5000 });
  await waitStableRect(page, '#sB .laurel-block');
  await waitStableRect(page, '#sB .step-block');
  const zoom = await page.evaluate(() => window.currentZoom ?? null);
  return { errs, zoom };
}

/* el 위로 마우스를 올리고 :hover 가 실제로 걸릴 때까지 기다린다(고정 대기 0 — expect.poll).
 * ⛔여기서 마우스를 떼지 않는다 — 떼고 나서 재면 readHover 가 «이미 끝난 hover»를 잰다(1차 실수 — 실측으로 잡음). */
async function hoverAndWait(page, sel) {
  const box = await page.locator(sel).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate((s) => document.querySelector(s)?.matches(':hover') ?? false, sel),
    { timeout: 3000 }).toBe(true);
}
async function unhover(page) { await page.mouse.move(5, 5); }

const readHover = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  const cs = getComputedStyle(el);
  const after = getComputedStyle(el, '::after');
  return {
    selected: el.classList.contains('selected'),
    outlineStyle: cs.outlineStyle,
    afterContent: after.content,
    afterBg: after.backgroundColor,
  };
}, sel);

test('T-G1-0 전제 — zoom 100 · 선택 안 됨', async ({ page }) => {
  const { errs, zoom } = await scene(page);
  expect(errs, '콘솔 오류 0').toEqual([]);
  expect(zoom, '전제 — zoom 100').toBe(100);
  const sel = await page.evaluate(() => ({
    laurel: document.getElementById(window.__laurel?.id)?.classList.contains('selected'),
    step: document.getElementById(window.__step?.id)?.classList.contains('selected'),
  }));
  expect(sel.laurel, '전제 — laurel 미선택').toBe(false);
  expect(sel.step, '전제 — step 미선택').toBe(false);
});

test('T-G1-1 laurel hover — 점선 outline 이 아니다(이웃과 같은 길)', async ({ page }) => {
  await scene(page);
  await hoverAndWait(page, '#sB .laurel-block');
  const r = await readHover(page, '#sB .laurel-block');
  console.log('[T-G1-1] ' + JSON.stringify(r));
  expect(r.selected, '전제 — 선택 안 된 채로 쟀다(중화 절 회피)').toBe(false);
  expect(r.outlineStyle, '★점선(dashed) 이면 안 된다').not.toBe('dashed');
  await unhover(page);
});

test('T-G1-2 laurel hover — ::after 틴트가 이웃(step)과 같은 색', async ({ page }) => {
  await scene(page);
  await hoverAndWait(page, '#sB .step-block');
  const stepR = await readHover(page, '#sB .step-block');
  await unhover(page);
  await hoverAndWait(page, '#sB .laurel-block');
  const laurelR = await readHover(page, '#sB .laurel-block');
  await unhover(page);
  console.log('[T-G1-2] step=' + JSON.stringify(stepR) + ' laurel=' + JSON.stringify(laurelR));
  expect(stepR.afterContent, '전제 — 이웃(step) 은 ::after 틴트를 가진다').toBe('""');
  expect(laurelR.afterContent, '★laurel 도 ::after 틴트를 가져야 한다').toBe('""');
  /* ★기대값은 손으로 안 적는다 — 이웃에서 뜬 값과 같은지만 견준다(LL5 관용구와 같은 길). */
  expect(laurelR.afterBg, '★laurel ::after 배경색 = 이웃에서 읽은 값과 같다').toBe(stepR.afterBg);
});

test('T-G1-3 정본 전수 — 틴트 보유 블록(laurel 포함) 전부 억제 명부에 있다 · 점선은 zoom 1종뿐(까닭 주석 有)', async ({ page }) => {
  const fs = require('fs');
  const path = require('path');
  /* ★ROOT = _root-harness 의 ROOT(= GD1001_ROOT 핀 판일 수 있다) — ⛔__dirname 기준으로 고정하면
   *   음성대조(GD1001_ROOT)에서도 «이 레포(고친 판)의 CSS»를 읽어 거짓 초록이 난다(1차 실수 — 실측으로 잡음). */
  /* ★hover-suppress-parity.test.mjs 와 «같은 소스·같은 자(derivedSelectors 꼴)» — 명부를 손으로 안 적는다.
   *   ★그 파일 머리말: «.text-block 틴트는 editor-layout.css 에 있다 — editor-blocks.css 만 읽으면 거짓 0건». */
  const CSS_FILES = ['css/editor-blocks.css', 'css/editor-layout.css', 'css/editor-base.css', 'css/editor-extra.css'];
  const CSS = CSS_FILES.filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const tintOwners = new Set();
  for (const m of CSS.matchAll(/^\s*\.([a-z0-9-]+):hover::after\s*\{/gm)) { if (m[1].endsWith('-block')) tintOwners.add(m[1]); }
  const suppressed = new Set();
  for (const m of CSS.matchAll(/\.frame-block:not\(\.selected\)\s+\.([a-z0-9-]+):hover::after/g)) suppressed.add(m[1]);
  /* ★명부 ⊇ 실패집합 ＋ 명부 밖 0건 꼴 — ⛔== 금지(feedback_a_rule_needs_an_instrument_to_be_enforced). */
  expect(tintOwners.has('laurel-block'), '★laurel 이 ::after 틴트 보유 명부에 있다').toBe(true);
  expect(tintOwners.size, '틴트 보유 ★≥10(hover-suppress-parity.test.mjs 와 같은 하한 — 패턴이 낡았나 재확인용)').toBeGreaterThanOrEqual(10);
  const missing = [...tintOwners].filter(c => c !== 'text-block' && !suppressed.has(c));
  expect(missing, '틴트 보유 중 억제 명부 밖 — ALLOWED_MISSING(text-block) 제외 0건(laurel 포함)').toEqual([]);

  /* 점선 outline — editor-blocks.css «만»(zoom·laurel 이 사는 자리). */
  const blocksCss = fs.readFileSync(path.join(ROOT, 'css/editor-blocks.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const dashedOwners = new Set();
  for (const m of blocksCss.matchAll(/^\s*\.([a-z0-9-]+):hover\s*\{[^}]*outline:\s*1px dashed/gm)) { if (m[1].endsWith('-block')) dashedOwners.add(m[1]); }
  expect([...dashedOwners], '점선 outline 은 zoom 한 종만(laurel 은 걷혔다)').toEqual(['zoom-block']);
});
