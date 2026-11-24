/* ★기대 바뀜(현빈 261123 ①②③ · 태양 §2c check) — 바뀐 칸의 토글 스위치(label.prop-toggle · .prop-toggle-track) → check 부품(label.ui-check · input.ui-check-box) */
/* sticker-burst.dom.spec.js — 톱니(버스트) 스탬프 = 스티커 모양 burst (B2 · 현빈 261114 «BEST 처럼 톱니모양 마크»)
 *   진짜 길: 펜 ▾ «Sticker» → 우측 패널 Shape «톱니» · Burst 절(톱니 수·깊이·끝 둥글기·안쪽 링)
 *   Z1 ★뒤집음(현빈 QA 261116 NEW-현빈QA-STICKER-BURST-NO-SEPARATE-MENU-ROUNDNESS-01): 옛 Z1 «메뉴 BEST 스탬프로 만든다» → 펜 ▾ 에 «BEST 스탬프»(#fp-add-burst) 없음 ·
 *      진짜 «Sticker» 클릭 → 패널 «톱니» → 다각형 48 · 안쪽 링. (addStickerBlock({shape:'burst'}) 입구는 그대로 — 글 «BEST» · 바탕 투명은 Z1b 가 잰다)
 *   Z7 끝 둥글기 — 패널 «끝 둥글기 %» 50 → 톱니 끝(바깥 꼭짓점)이 반지름 50 보다 안쪽 · 점은 꼭짓점마다 곡선(48×7) · 0 으로 되돌리면 48·끝 50(옛 꼴) ·
 *      data-burst-round 저장 · 다시 그려도(renderStickerBlock) 같은 점 · Figma 내보내기 generic svg 에도 같은 점(화면==Figma)
 *   Z2 패널 — 톱니 수 12 → 꼭짓점 24 · 깊이 30 → 골 반지름 35(100 상자) · 링 끔 → circle 0
 *   Z3 모양 바꾸기 — 원형 스티커에서 «톱니» 누르면 다각형이 생기고 기본 톱니 값 · 다시 «원형» 이면 다각형 0 · 바탕색 복귀
 *   Z4 바탕색 = 다각형 칠 · 글자색 = 링 선
 *   Z5 [보안] 손댄 bgColor(«"/><script>…») — 다각형 속성이 깨지지 않는다(script 0 · 칠은 안전값)
 *   Z6 캔버스에서 글자 더블클릭 편집(기존 sticker-text 길 그대로)
 * 양성대조:
 *   · (CTL 예측) index.html 의 뺀 자리에 «BEST 스탬프» 단추(#fp-add-burst)를 되살리면 Z1 빨강 · sticker-block.js burstPoints 의 `round: block.dataset.burstRound` 를 빼면 Z7 빨강
 *   · js/blocks/sticker-block.js 의 `_burstSvg + (` 에서 `_burstSvg + ` 를 지우면 Z1·Z2·Z3·Z4 빨강
 *   · js/blocks/burst-geometry.js burstPoints 의 `teeth * 2` 를 `teeth` 로 바꾸면 Z1·Z2 빨강(꼭짓점 수)
 *   · js/blocks/sticker-block.js _escAttrBurst 가 그대로 돌려주게(`return s;`) 하면 Z5 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.deselectAll?.(); window.selectSection(c.querySelector('.section-block'));
  });
  return errs;
}
async function addBurst(page) {   // 메뉴 단추는 뺐다(Z1) — 같은 입구 함수를 부른다(MCP·옛 길 그대로)
  await page.evaluate(() => window.addStickerBlock({ shape: 'burst' }));
  await page.waitForSelector('#canvas .sticker-block[data-shape="burst"] svg.stk-burst polygon');
  return page.evaluate(() => { const b = [...document.querySelectorAll('#canvas .sticker-block[data-shape="burst"]')].pop(); b.id = b.id || 'stk_qa'; return b.id; });
}
const read = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const poly = b.querySelector('svg.stk-burst polygon');
  const pts = poly ? poly.getAttribute('points').split(' ').map((p) => p.split(',').map(Number)) : [];
  return { n: pts.length, valley: pts[1] ? +Math.hypot(pts[1][0] - 50, pts[1][1] - 50).toFixed(1) : null, ring: b.querySelectorAll('svg.stk-burst circle').length,
    fill: poly?.getAttribute('fill') ?? null, ringStroke: b.querySelector('svg.stk-burst circle')?.getAttribute('stroke') ?? null,
    text: b.querySelector('.sticker-text')?.textContent ?? null, bg: getComputedStyle(b).backgroundColor, scripts: b.querySelectorAll('script').length };
}, id);
async function panel(page, id) {
  await page.evaluate((id) => { const b = document.getElementById(id); window.selectBlock?.(id); window.showStickerProperties(b); }, id);
}

test('Z1 펜 ▾ 에 «BEST 스탬프» 없음 · Sticker → 톱니로 만든다', async ({ page }) => {
  const errs = await boot(page);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await expect(page.locator('#fp-pen-menu .fp-menu-item').first(), '[전제] 펜 메뉴가 열렸다').toBeVisible();
  expect(await page.evaluate(() => [document.querySelectorAll('#fp-add-burst').length, [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].filter((b) => /BEST/.test(b.textContent)).length]),
    '★펜 ▾ 에 «BEST 스탬프» 가 남아 있다').toEqual([0, 0]);
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .sticker-block')].map((b) => b.id));
  await page.locator('#fp-pen-menu .fp-menu-item').filter({ hasText: /^Sticker$/ }).click();
  const id = await page.evaluate((before) => { const b = [...document.querySelectorAll('#canvas .sticker-block')].find((x) => !before.includes(x.id)); if (!b) return null; b.id = b.id || 'stk_menu'; return b.id; }, before);
  expect(id, '[전제] Sticker 메뉴로 스티커가 생겼다').toBeTruthy();
  await panel(page, id);
  await page.click('#stk-shape-group .prop-align-btn[data-shape="burst"]');
  const r = await read(page, id);
  expect([r.n, r.ring], '모양 «톱니» = 다각형 48 · 안쪽 링').toEqual([48, 1]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z1b addStickerBlock({shape:"burst"}) 입구 그대로 — 글 BEST · 바탕 투명', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  const r = await read(page, id);
  expect([r.n, r.ring, r.text, r.bg]).toEqual([48, 1, 'BEST', 'rgba(0, 0, 0, 0)']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z2 패널 — 톱니 수·깊이·링', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await panel(page, id);
  await expect(page.locator('#stk-burst-section')).toHaveCount(1);
  await page.fill('#stk-burst-teeth-num', '12'); await page.dispatchEvent('#stk-burst-teeth-num', 'change');
  await page.fill('#stk-burst-depth-num', '30'); await page.dispatchEvent('#stk-burst-depth-num', 'change');
  // 체크박스는 .prop-toggle 안에 숨어 있다(css/editor-props.css:242 opacity 0 · width 0) — 다른 스펙처럼 라벨을 누른다
  await page.click('label.ui-check:has(#stk-burst-ring)');
  await expect(page.locator('#stk-burst-ring')).not.toBeChecked();
  const r = await read(page, id);
  expect([r.n, r.valley, r.ring]).toEqual([24, 35, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z3 원형 ↔ 톱니', async ({ page }) => {
  const errs = await boot(page);
  const id = await page.evaluate(() => { const sec = document.querySelector('#canvas .section-block'); const before = new Set(sec.querySelectorAll('.sticker-block'));
    window.addStickerBlock({ shape: 'circle' }); const b = [...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)); b.id = 'stk_c'; return b.id; });
  await panel(page, id);
  await page.click('#stk-shape-group .prop-align-btn[data-shape="burst"]');
  let r = await read(page, id);
  expect(r.n, '★톱니로 바꿨는데 다각형이 없다').toBe(48);
  expect(await page.evaluate((id) => [document.getElementById(id).dataset.burstTeeth, document.getElementById(id).dataset.burstDepth], id)).toEqual(['24', '14']);
  await page.click('#stk-shape-group .prop-align-btn[data-shape="circle"]');
  r = await read(page, id);
  expect(r.n).toBe(0);
  expect(r.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z4 바탕색 = 다각형 칠 · 글자색 = 링', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.bgColor = '#1e88e5'; b.dataset.textColor = '#ffeb3b'; window.renderStickerBlock(b); }, id);
  const r = await read(page, id);
  expect([r.fill, r.ringStroke]).toEqual(['#1e88e5', '#ffeb3b']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z5 [보안] 손댄 바탕색', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.bgColor = '"/><script>window.__pwnB=1</script><x a="'; b.dataset.textColor = 'red" onload="window.__pwnR=1'; window.renderStickerBlock(b); }, id);
  const r = await read(page, id);
  expect(r.scripts).toBe(0);
  expect([r.fill, r.ringStroke]).toEqual(['#000000', '#000000']);
  expect(await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('*')].filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length, id)).toBe(0);
  expect(await page.evaluate(() => ['__pwnB', '__pwnR'].filter((k) => window[k]))).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z6 캔버스 글자 더블클릭 편집', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await page.dblclick(`#${id} .sticker-text`);
  await expect(page.locator(`#${id} .sticker-text`)).toHaveAttribute('contenteditable', 'true');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z7 끝 둥글기 — 톱니 끝이 안쪽으로 둥글어짐 · 0 = 옛 꼴 · 저장 키 · 다시 그려도 같음 · Figma 같은 점', async ({ page }) => {
  const errs = await boot(page);
  const id = await addBurst(page);
  await panel(page, id);
  await expect(page.locator('#stk-burst-round-num'), '[전제] «끝 둥글기» 칸').toHaveCount(1);
  const geo = () => page.evaluate((id) => {
    const pts = document.getElementById(id).querySelector('svg.stk-burst polygon').getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
    return { n: pts.length, rMax: +Math.max(...pts.map(([x, y]) => Math.hypot(x - 50, y - 50))).toFixed(1)   /* 점은 소수 2자리로 적힌다(burstPoints toFixed(2)) — 반지름 50 꼭짓점이 50.01 로 읽힌다(아이맥 패치판 1회 빨강). 0.1 단위로 견준다 */, points: pts.map((p) => p.join(',')).join(' ') };
  }, id);
  const g0 = await geo();
  expect([g0.n, g0.rMax], '[전제] 기본 = 뾰족(끝 반지름 50)').toEqual([48, 50]);
  await page.fill('#stk-burst-round-num', '50'); await page.dispatchEvent('#stk-burst-round-num', 'change');
  const g1 = await geo();
  expect(g1.n, '★꼭짓점마다 곡선(48 × 7)').toBe(48 * 7);
  expect(g1.rMax, '★톱니 끝이 안 둥글다(끝 반지름 50 그대로)').toBeLessThan(49.5);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.burstRound, id), '저장 키').toBe('50');
  await page.evaluate((id) => window.renderStickerBlock(document.getElementById(id)), id);
  expect((await geo()).points, '다시 그려도 같은 점(저장 왕복)').toBe(g1.points);
  const fig = await page.evaluate((id) => { const all = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.type) all.push(o); Object.values(o).forEach(walk); } };
    window.flushCurrentPage?.(); walk(window.buildFigmaExportJSON(null)); const b = all.find((x) => x.id === id); return b ? (/points="([^"]*)"/.exec(b.svg || '') || [])[1] || null : null; }, id);
  expect(fig, '★Figma 내보내기 다각형 = 화면').toBe((await page.evaluate((id) => document.getElementById(id).querySelector('svg.stk-burst polygon').getAttribute('points'), id)));
  await page.fill('#stk-burst-round-num', '0'); await page.dispatchEvent('#stk-burst-round-num', 'change');
  expect([(await geo()).n, (await geo()).rMax], '0 = 옛 꼴').toEqual([48, 50]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
