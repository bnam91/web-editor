/* icon-preset-empty-hint.dom.spec.js — U21 (UserLens 0.9.6 ⑷10 · 2026-10-05): Icon 패널 「내 SVG 프리셋」 안내문이 칸에서 잘렸다.
 *   옛: 폴더가 비면 <select> 의 <option> 하나에 안내 전문(「(폴더 비어있음 — Application Support/GODITOR/svg-presets/ 에 폴더+SVG 추가)」)
 *       → 칸 폭(flex:1)에서 「(폴더 비어있음 — Application S…」로 잘림.
 *   새: 칸엔 짧은 상태 「(비어 있음)」만 · 안내는 그 아래 그리드 자리(#icn-preset-grid)에 줄바꿈되는 .prop-hint 로.
 *   ⛔안내에 폴더 경로를 안 적는다 — 옛 「Application Support/GODITOR/…」는 맥 전용 길이었다(윈도우 = %APPDATA%\GODITOR · main.js:1714).
 * 시험 이름표: P0 = 전제(빈 폴더 답이 들어갔다) · P1·P2 = ★새 것(고치기 전 판 빨강) · P3 = 회귀 지킴(카테고리 있으면 안내 없음 — 고치기 전에도 초록).
 * ★양성대조: 고치기 전 판(origin/dev 772ccadc)에서 P1(칸 글자가 칸 폭 안)·P2(안내가 다 보임)가 빨강, P0(전제)은 초록이어야 한다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/icon-preset-empty-hint.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SVG = '<svg viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24" fill="currentColor"/></svg>';

async function openIconPanel(page, list) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ svg, list }) => {
    /* 하네스의 electronAPI 는 모든 호출이 null 이다 → svgPresets.list 만 «빈 폴더» 답으로 바꾼다. */
    const base = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (_, k) => (k === 'svgPresets' ? { list: async () => list } : base[k]) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="iS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="iR" data-layout="stack"></div></div></div>`);
    const { block } = window.makeIconifyBlock('mdi:star', svg, 80);
    block.id = 'iI'; document.getElementById('iR').appendChild(block); window.rebindAll?.();
    window.showIconifyProperties(block);
  }, { svg: SVG, list });
  return errs;
}

test('P0 전제 — 빈 폴더 답이면 카테고리 칸에 옵션이 «하나»이고 값이 비어 있다', async ({ page }) => {
  const errs = await openIconPanel(page, { ok: true, categories: [] });
  const sel = page.locator('#icn-preset-cat');
  await expect(sel.locator('option')).toHaveCount(1);
  await expect.poll(() => sel.evaluate(e => e.options[0].value)).toBe('');
  await expect.poll(() => sel.evaluate(e => e.options[0].textContent)).not.toBe('로딩중...');   // loadPresets 가 돌았다
  expect(errs).toEqual([]);
});

test('P1 ★칸 글자가 칸 폭 안에 든다(잘리지 않는다)', async ({ page }) => {
  await openIconPanel(page, { ok: true, categories: [] });
  const sel = page.locator('#icn-preset-cat');
  await expect.poll(() => sel.evaluate(e => e.options[0].textContent)).not.toBe('로딩중...');
  /* 칸의 글자 폭을 같은 글꼴로 재서 칸 안쪽 폭과 견준다(<select> 는 scrollWidth 가 글자를 안 따라간다). */
  const m = await sel.evaluate(e => {
    const cs = getComputedStyle(e);
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = e.options[e.selectedIndex].textContent;
    const inner = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16;   // 16 = 펼침 화살표 몫
    return { text, textW: Math.ceil(cv.measureText(text).width), inner: Math.floor(inner) };
  });
  test.info().annotations.push({ type: 'measured', description: JSON.stringify(m) });
  expect(m.textW, `칸 글자 «${m.text}» 폭 ${m.textW}px > 칸 안쪽 ${m.inner}px — 잘린다`).toBeLessThanOrEqual(m.inner);
});

test('P2 ★안내가 그리드 자리에 «다» 보인다 — 넘치지 않고, 앱 안의 길(+ · 라이브러리에 저장)을 가리킨다', async ({ page }) => {
  await openIconPanel(page, { ok: true, categories: [] });
  const hint = page.locator('#icn-preset-grid .prop-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('+ 로 만든 뒤');
  await expect(hint).toContainText('라이브러리에 저장');
  /* 안내가 가리키는 «라이브러리에 저장» 단추가 같은 패널에 실제로 있다(헛걸음 방지). */
  await expect(page.locator('#icn-preset-save-btn')).toContainText('라이브러리에 저장');
  await expect(page.locator('#icn-preset-new-cat-btn')).toHaveText('+');
  const r = await hint.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, gw: e.parentElement.clientWidth, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
  test.info().annotations.push({ type: 'measured', description: JSON.stringify(r) });
  expect(r.sw, `안내가 가로로 넘친다 scrollWidth=${r.sw} clientWidth=${r.cw}`).toBeLessThanOrEqual(r.cw);
  expect(r.w, `안내가 그리드 한 칸(1/3)에 갇혔다 w=${r.w} grid=${r.gw}`).toBeGreaterThan(r.gw * 0.9);
});

test('P3 지키는 시험 — 카테고리가 있으면 안내가 없고 첫 카테고리가 골라진다', async ({ page }) => {
  await openIconPanel(page, { ok: true, categories: [{ name: '아이콘', items: [] }] });
  const sel = page.locator('#icn-preset-cat');
  await expect.poll(() => sel.evaluate(e => e.value)).toBe('아이콘');
  await expect(page.locator('#icn-preset-grid .prop-hint')).toHaveCount(0);
});
