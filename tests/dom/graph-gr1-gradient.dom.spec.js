/* graph-gr1-gradient — GR1(그래프, 지디 2026-10-03): 막대마다 그라데이션(현빈 「그라데이션은 막대마다 따로」) + syncItems 색 덮어쓰기 수정
 * ──────────────────────────────────────────────────────────────────────────────────────
 * 설계 근거: scratchpad reports/GR-DESIGN.md(시제품 gr.spec.js) — 좌표 = «모델 수식 + CSS 앵커» 한 곳(js/drag-utils.js _barVPlotGeom).
 * 시험 이름 ↔ 잰 것
 *   GR1-sync ★«라벨만 고치면 색이 안 바뀐다» — 실제 키 입력(fill)으로 라벨·값을 고쳐도 그라데이션·단색·미지정 항목 색이 모델 그대로
 *            (핀 30984c67: syncItems 가 picker.value 를 다시 읽어 그라데이션 → #000000 — 빨강이어야 한다)
 *   GR1-unset 미지정 항목(= 프리셋 색) = 체커 스와치 + hex 칸 비움, 모델에 color 를 만들지 않는다(예전 swatch-none 동작 보존)
 *   GR1-pick 진짜 피커 경로(스와치 클릭 → 그라데이션 탭)로 «그 막대 하나»만 그라데이션, 다른 막대 불변
 *   GR1-rt   저장 왕복(serialize→apply→재렌더) 뒤에도 그 막대 그라데이션 · PNG 클론 픽셀(위·아래 색이 다르다) · HTML 내보내기 · 피그마 JSON items[].color
 *   GR1-safe 정화기 — url( · 따옴표 · 세미콜론 섞인 그라데이션은 버린다(프리셋 색으로)
 * ⛔못 재는 축: 실앱(Electron) · 피그마 렌더러(sangpe_to_figma, E11) · captureCloneToCanvas(CDP) · 회전한 띄운 그래프. */
const { test, expect } = require('@playwright/test');
const { BASE, bootBase, G_RB, ITEMS, setup, setZoom, openPanel, itemsOf, setDs, MEASURE, meas, ALL_ON } = require('./_graph-gr-harness.js');
/* ────────────────────────── GR1 ────────────────────────── */
test('GR1-sync ★라벨만 고치면 색이 안 바뀐다 — 그라데이션·단색·미지정 항목 색이 모델 그대로(실제 키 입력)', async ({ page }) => {
  const errs = await setup(page, { items: [{ label: 'a', value: 30, color: G_RB }, { label: 'b', value: 50, color: '#00aa00' }, { label: 'c', value: 40 }] });
  await openPanel(page);
  expect((await itemsOf(page))[0].color, '전제: 0번 항목은 그라데이션이다').toBe(G_RB);
  await page.locator('.grb-data-item[data-index="1"] .grb-data-label-input').fill('바뀐라벨');
  await page.locator('.grb-data-item[data-index="2"] .grb-data-val-input').first().fill('45');
  const it = await itemsOf(page);
  expect(it[1].label, '전제: 라벨 입력이 모델에 닿았다').toBe('바뀐라벨');
  expect(it[2].value, '전제: 값 입력이 모델에 닿았다').toBe(45);
  expect(it[0].color, '그라데이션 항목 색이 라벨 편집에 안 바뀐다').toBe(G_RB);
  expect(it[1].color, '단색 항목 색 불변').toBe('#00aa00');
  expect(it[2].color, '미지정 항목은 미지정 그대로(= 프리셋 색)').toBeUndefined();
  const fill0 = await page.evaluate(() => getComputedStyle(document.querySelector('#grG .grb-bar-col .grb-bar-fill')).backgroundImage);
  expect(fill0, '0번 막대는 여전히 그라데이션으로 칠해진다').toMatch(/linear-gradient/);
  expect(errs).toEqual([]);
});

test('GR1-unset 미지정 항목 = 체커 스와치 + hex 칸 비움, 모델엔 color 없음', async ({ page }) => {
  await setup(page, { items: [{ label: 'a', value: 30 }, { label: 'b', value: 50, color: '#00aa00' }] });
  await openPanel(page);
  const r = await page.evaluate(() => [...document.querySelectorAll('.grb-data-item')].map(row => {
    const sw = row.querySelector('.grb-data-color .prop-color-swatch'); const hex = row.querySelector('.grb-data-color .prop-color-hex');
    return { none: sw?.classList.contains('swatch-none'), hex: hex?.value, hasField: !!row.querySelector('.grb-data-color .prop-color-field') };
  }));
  expect(r[0], '미지정 = 체커·빈 hex').toEqual({ none: true, hex: '', hasField: true });
  expect(r[1], '지정 = 체커 아님·hex 표시').toEqual({ none: false, hex: '00AA00', hasField: true });
});

async function pickGradientOnItem(page, i) {
  const pos = await page.evaluate((i) => {
    const sw = document.getElementById(`grb-data-color-${i}-color`)?.closest('.prop-color-swatch');
    if (!sw) return null; const r = sw.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  }, i);
  expect(pos, '전제: 항목 색 스와치가 패널에 있다').not.toBeNull();
  await page.mouse.click(pos.x, pos.y);
  await page.waitForFunction(() => { const p = document.querySelector('.goya-cp-popover'); return p && !p.hidden; }, null, { timeout: 4000 });
  const tab = page.locator('.goya-cp-popover .goya-cp-tab[data-tab="gradient"]');
  expect(await tab.isDisabled().catch(() => true), '그라데이션 탭이 열려 있다(onGradient 가 배선됐다)').toBe(false);
  await tab.click();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}
const fillsBg = (page, sel = '#grG') => page.evaluate((sel) => [...document.querySelectorAll(sel + ' .grb-bar-fill')].map(f => getComputedStyle(f).backgroundImage), sel);

test('GR1-pick 진짜 피커(스와치 클릭 → 그라데이션 탭)로 «그 막대 하나»만 그라데이션', async ({ page }) => {
  const errs = await setup(page, { items: [{ label: 'a', value: 30, color: '#ff0000' }, { label: 'b', value: 50, color: '#00aa00' }, { label: 'c', value: 40 }] });
  await openPanel(page);
  const before = await fillsBg(page);
  expect(before.every(b => b === 'none'), '전제: 처음엔 그라데이션 막대가 없다').toBe(true);
  await pickGradientOnItem(page, 1);
  const it = await itemsOf(page);
  expect(it[1].color, '1번 항목 모델 = 그라데이션').toMatch(/^linear-gradient\(/);
  expect(it[0].color, '0번 불변').toBe('#ff0000');
  expect(it[2].color, '2번 미지정 그대로').toBeUndefined();
  const after = await fillsBg(page);
  expect(after[1], '1번 막대만 그라데이션으로 칠해진다').toMatch(/linear-gradient/);
  expect([after[0], after[2]], '다른 막대는 그라데이션 아님').toEqual(['none', 'none']);
  expect(errs).toEqual([]);
});

test('GR1-rt 그라데이션 막대 — 저장 왕복·PNG 클론 픽셀·HTML 내보내기·피그마 JSON', async ({ page }) => {
  const errs = await setup(page, { items: [{ label: 'a', value: 80, color: G_RB }, { label: 'b', value: 60, color: '#00aa00' }] });
  // 저장 왕복 — 다시 렌더까지 해서 정화기를 지나도 남는가(핀에선 재렌더에서 사라졌다)
  const rt = await page.evaluate(() => {
    window.applyProjectData(JSON.parse(window.serializeProject()));
    const g = document.getElementById('grG'); window.renderGraph(g);
    return { color0: JSON.parse(g.dataset.items)[0].color, bg: [...g.querySelectorAll('.grb-bar-fill')].map(f => getComputedStyle(f).backgroundImage) };
  });
  expect(rt.color0, '저장 왕복 뒤 모델').toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
  expect(rt.bg[0], '왕복+재렌더 뒤 0번 막대 그라데이션').toMatch(/linear-gradient/);
  expect(rt.bg[1], '1번 막대는 단색').toBe('none');
  // PNG 클론 — 제품 캡처 준비 경로(prepareCloneForCapture + renderComponentsInClone) 뒤 화소
  await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('grS'), 860, true);
    ex.renderComponentsInClone(clone); clone.id = '__g1'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.zIndex = '2147483647';
  });
  const box = await page.evaluate(() => { const f = document.querySelector('#__g1 .grb-bar-fill').getBoundingClientRect(); const c = document.getElementById('__g1').getBoundingClientRect(); return { x: f.left - c.left, y: f.top - c.top, w: f.width, h: f.height }; });
  expect(box.h, '전제: 클론 막대가 높이를 갖는다').toBeGreaterThan(20);
  const shot = await page.locator('#__g1').screenshot();
  const px = await page.evaluate(async ([b64, box]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const at = (fy) => Array.from(ctx.getImageData(Math.round(box.x + box.w / 2), Math.round(box.y + box.h * fy), 1, 1).data.slice(0, 3));
    return { top: at(0.1), bot: at(0.9) };
  }, [shot.toString('base64'), box]);
  expect(px.top[0], `PNG 클론 막대 위쪽은 빨강 쪽 ${px.top}`).toBeGreaterThan(150);
  expect(px.bot[2], `PNG 클론 막대 아래쪽은 파랑 쪽 ${px.bot}`).toBeGreaterThan(150);
  await page.evaluate(() => document.getElementById('__g1')?.remove());
  // HTML 내보내기
  const html = await page.evaluate(async () => {
    let captured = null; const orig = URL.createObjectURL;
    URL.createObjectURL = (b) => { captured = b; return orig.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () {};
    await window.exportHTMLFile(); URL.createObjectURL = orig;
    return captured ? await captured.text() : null;
  });
  expect(html, '전제: HTML 내보내기 본문을 잡았다').toBeTruthy();
  const p2 = await page.context().newPage(); await p2.setContent(html, { waitUntil: 'load' });
  const hbg = await p2.evaluate(() => [...document.querySelectorAll('.grb-bar-fill')].map(f => getComputedStyle(f).backgroundImage));
  await p2.close();
  expect(hbg[0], 'HTML 배송본 0번 막대 그라데이션').toMatch(/linear-gradient/);
  // 피그마 JSON — items[].color 에 실린다(렌더러가 쓰는지는 E11, 범위 밖)
  const fj = await page.evaluate(() => { const s = JSON.stringify(window.buildFigmaExportJSON()); return s.includes('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)'); });
  expect(fj, '피그마 JSON items[].color 에 그라데이션 문자열').toBe(true);
  expect(errs).toEqual([]);
});

test('GR1-safe 정화기 — url(·따옴표·세미콜론 섞인 그라데이션은 버리고, 깨끗한 것만 칠한다', async ({ page }) => {
  await setup(page, { items: [
    { label: 'ok', value: 50, color: G_RB },
    { label: 'url', value: 50, color: 'linear-gradient(red, blue), url(http://x/y.png)' },
    { label: 'q', value: 50, color: 'linear-gradient(red, blue)" onmouseover="alert(1)' },
    { label: 'semi', value: 50, color: 'linear-gradient(red, blue);background:url(x)' },
    { label: 'bad', value: 50, color: 'linear-gradient(nonsense)' },
  ] });
  const r = await page.evaluate(() => [...document.querySelectorAll('#grG .grb-bar-fill')].map(f => f.getAttribute('style')));
  expect(r[0]).toContain('background:linear-gradient(180deg, #ff0000 0%, #0000ff 100%);');
  for (const i of [1, 2, 3, 4]) expect(r[i], `${i}번은 버려진다`).not.toMatch(/gradient|url|onmouseover/);
  expect(await page.evaluate(() => document.querySelectorAll('#grG [onmouseover]').length)).toBe(0);
});

