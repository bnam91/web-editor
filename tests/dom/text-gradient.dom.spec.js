/* text-gradient.dom.spec.js — 0918r2 textgrad (T-059 확장): 글자 그라데이션 (현빈 결정 = 피그마 기준)
 *
 * ★«패널 경로»로 잰다 — 진짜 스와치를 진짜 마우스로 눌러 피커를 열고, 진짜 탭을 누른다.
 * ★되돌리기는 «HTML 스냅샷» 미니 히스토리로 잰다 — 앱 history.js 와 같은 성질(스냅샷 = 바뀐 뒤 상태, undo = 직전 스냅샷 복원).
 * ★보이는 것은 dataset 이 아니라 getComputedStyle 로 잰다(background-clip·text-fill·color).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다.
 * 실행: npm run test:dom -- text-gradient
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>#panel-right{position:fixed;left:0;top:0;width:240px;} #canvas{position:absolute;left:600px;top:0;width:600px;}</style>
</head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host">
  <div class="text-block" id="tb1" data-type="body"><div class="tb-body" contenteditable="false" style="font-size:40px;color:#cc2244">그라데이션 글자</div></div>
  <div class="text-block" id="tb2" data-type="heading"><div class="tb-h1" contenteditable="false" style="color:#1144aa">둘째 글자 블럭</div></div>
  <div class="text-block" id="tb3" data-type="label"><div class="tb-label" contenteditable="false">라벨</div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
<script type="module">
  import '/js/props/color-picker.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  import { neutralizeTextGradForH2C } from '/js/io/capture-safety.js';
  const host = document.getElementById('host');
  window.__snaps = [host.innerHTML];
  window.pushHistory = () => { window.__snaps.push(host.innerHTML); };
  window.__undo = () => {
    if (window.__snaps.length < 2) return false;
    window.__snaps.pop();
    host.innerHTML = window.__snaps[window.__snaps.length - 1];
    return true;
  };
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window.__text = showTextProperties;
  window.__h2c = neutralizeTextGradForH2C;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const snaps = (page) => page.evaluate(() => window.__snaps.length);
const tab = (page, name) => page.locator(`.goya-cp-tab[data-tab="${name}"]`);
const activeTab = (page) => page.evaluate(() => document.querySelector('.goya-cp-tab.active')?.dataset.tab);
const select = (page, id) => page.evaluate((i) => window.__text(document.getElementById(i)), id);
async function openTxtPicker(page) {
  await page.locator('#txt-color').locator('xpath=..').click();
  await expect(page.locator('.goya-cp-popover')).toBeVisible();
}
async function closePicker(page) {
  await page.evaluate(() => window.closeGoyaColorPicker());
  await expect(page.locator('.goya-cp-popover')).toBeHidden();
}
const look = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`#${i} [class^="tb-"]`);
  const c = getComputedStyle(el);
  return {
    clip: c.backgroundClip, fill: c.webkitTextFillColor, img: c.backgroundImage, color: c.color, caret: c.caretColor,
    tg: window.getTextGradient(el),
  };
}, id);

test('G1 탭 한 번 = 즉시 «지금 색 100%→0%» + 기록 1회 → 되돌리기 1회 = 원래 단색(글자색·배경 둘 다)', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  const before = await look(page, 'tb1');
  expect(before.clip).not.toBe('text');
  const s0 = await snaps(page);
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const g = await look(page, 'tb1');
  expect(g.clip).toBe('text');
  expect(g.fill).toBe('rgba(0, 0, 0, 0)');
  expect(g.tg.type).toBe('linear');
  expect(g.tg.angle).toBe(90);
  expect(g.tg.stops).toEqual([{ color: '#cc2244', offset: 0, opacity: 1 }, { color: '#cc2244', offset: 1, opacity: 0 }]);
  expect(g.caret, '캐럿 = 첫 스탑').toBe('rgb(204, 34, 68)');
  expect(g.color, '인라인 color = 마지막 단색(그대로)').toBe('rgb(204, 34, 68)');
  expect(await snaps(page) - s0, '탭 한 번 = 기록 한 번').toBe(1);
  await closePicker(page);
  await page.evaluate(() => window.__undo());
  const u = await look(page, 'tb1');
  expect(u.clip).not.toBe('text');
  expect(u.img).toBe('none');
  expect(u.fill).toBe('rgb(204, 34, 68)');
  expect(u.color).toBe('rgb(204, 34, 68)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 스탑 드래그: 움직이는 동안 기록 0, 마우스업에 1회 — 값은 드래그 중에도 캔버스에 실시간', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const s0 = await snaps(page);
  const thumb = page.locator('.goya-cp-grad-thumb').nth(1);
  const bb = await thumb.boundingBox();
  const bar = await page.locator('.goya-cp-grad-thumb').first().evaluate(t => t.parentElement.getBoundingClientRect().toJSON());
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width * 0.7, bb.y + bb.height / 2, { steps: 6 });
  await page.waitForTimeout(80);
  expect(await snaps(page) - s0, '드래그 중 기록이 쌓인다(되돌리기가 프레임 단위로 쪼개짐)').toBe(0);
  const mid = await look(page, 'tb1');
  expect(Math.round(mid.tg.stops[1].offset * 100)).toBeLessThan(90);
  await page.mouse.up();
  await page.waitForTimeout(80);
  expect(await snaps(page) - s0).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G3 솔리드 탭 복귀 = 직전 단색, 그라데이션·재오픈 시드 없음, 기록 1회', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const s0 = await snaps(page);
  await tab(page, 'solid').click();
  const s = await look(page, 'tb1');
  expect(s.clip).not.toBe('text');
  expect(s.img).toBe('none');
  expect(s.fill).toBe('rgb(204, 34, 68)');
  expect(await page.evaluate(() => document.getElementById('txt-color').dataset.cpGradient || null)).toBeNull();
  expect(await page.evaluate(() => document.querySelector('#tb1 .tb-body').getAttribute('style'))).not.toMatch(/caret-color|background-clip|text-fill/);
  expect(await snaps(page) - s0).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G4 다시 선택 → 피커가 그라데이션 탭으로, 스탑이 «실제 값»으로 열린다(기본값으로 덮지 않음) · 여는 것만으론 기록 0', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(45deg, #00aa55 0%, #3300ff 60%, rgba(255,136,0,0.500) 100%)' }, { commit: true }));
  await select(page, 'tb2');
  await select(page, 'tb1');
  const sw = await page.evaluate(() => document.getElementById('txt-color').closest('.prop-color-swatch').style.background);
  expect(sw, '스와치가 그라데이션을 안 보여준다').toContain('linear-gradient');
  const s0 = await snaps(page);
  await openTxtPicker(page);
  expect(await activeTab(page)).toBe('gradient');
  const ui = await page.evaluate(() => ({
    n: document.querySelectorAll('.goya-cp-grad-thumb').length,
    angle: document.querySelector('.goya-cp-popover [data-el="gradAngleNum"], .goya-cp-popover .goya-cp-grad-angle-num')?.value || null,
  }));
  expect(ui.n).toBe(3);
  const g = await look(page, 'tb1');
  expect(g.tg.angle).toBe(45);
  expect(g.tg.stops.map(s => [s.color, Math.round(s.offset * 100), s.opacity])).toEqual([['#00aa55', 0, 1], ['#3300ff', 60, 1], ['#ff8800', 100, 0.5]]);
  expect(await snaps(page) - s0, '열기만 했는데 기록이 쌓였다').toBe(0);
  // 그라데이션 탭을 다시 눌러도 사용자 값 유지(기본값 덮어쓰기 금지)
  await tab(page, 'gradient').click();
  const g2 = await look(page, 'tb1');
  expect(g2.tg.stops.length).toBe(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G5 저장→재로드(innerHTML → sanitizeCanvasHtml → 다시 넣기) 뒤에도 computed 가 같다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, rgba(204,34,68,0.000) 100%)' }, { commit: true }));
  const a = await look(page, 'tb1');
  const ok = await page.evaluate(async () => {
    await import('/js/io/save-load.js').catch(() => {});
    if (typeof window.sanitizeCanvasHtml !== 'function') return false;
    const host = document.getElementById('host');
    const html = host.innerHTML;
    host.innerHTML = '';
    host.innerHTML = window.sanitizeCanvasHtml(html);
    return true;
  });
  expect(ok, 'sanitizeCanvasHtml 을 못 불렀다(측정 불가)').toBe(true);
  const b = await look(page, 'tb1');
  expect(b.clip).toBe('text');
  expect(b).toEqual(a);
  expect(errs.filter(e => !/save-load/.test(e)), errs.join(' | ')).toEqual([]);
});

test('G6 단색 경로가 그라데이션을 푼다: 스포이드(applyTextBlockColor) · MCP 편집(editTextBlock) · hex 입력 · 라벨로 타입 전환', async ({ page }) => {
  const errs = await boot(page);
  const put = () => page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, rgba(204,34,68,0.000) 100%)' }, { commit: true }));
  await put();
  await page.evaluate(() => window.applyTextBlockColor(document.getElementById('tb1'), '#00ff00'));
  let s = await look(page, 'tb1');
  expect(s.clip, '스포이드 단색이 그라데이션에 가려진다').not.toBe('text');
  expect(s.fill).toBe('rgb(0, 255, 0)');

  await put();
  const r = await page.evaluate(() => window.editTextBlock('tb1', { color: '#0000ff' }));
  expect(r.ok).not.toBe(false);
  s = await look(page, 'tb1');
  expect(s.clip, 'MCP 단색이 그라데이션에 가려진다').not.toBe('text');
  expect(s.fill).toBe('rgb(0, 0, 255)');

  await put();
  await select(page, 'tb1');
  await page.fill('#txt-color-hex', '112233');
  s = await look(page, 'tb1');
  expect(s.clip, 'hex 입력 단색이 그라데이션에 가려진다').not.toBe('text');
  expect(s.fill).toBe('rgb(17, 34, 51)');

  await put();
  await select(page, 'tb1');
  await page.click('.prop-type-btn[data-cls="tb-label"]');
  s = await look(page, 'tb1');
  expect(s.clip, '라벨로 바꿨는데 그라데이션이 남아 박스 배경까지 잘린다').not.toBe('text');
  expect(await page.evaluate(() => document.getElementById('txt-color').dataset.cpModes)).toBe('solid');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G7 그라데이션 글자 안의 부분 단색 span 은 보인다(채움색 ≠ transparent) — 전체 단색으로 바꾸면 잔재 없음', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, #2244cc 100%)' }, { commit: true }));
  await page.evaluate(() => {
    const el = document.querySelector('#tb1 .tb-body');
    const t = el.firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 3);
    window.applyColorToSelection('#00ff00', el, r, null);
  });
  const span = await page.evaluate(() => {
    const sp = document.querySelector('#tb1 .tb-body span');
    return sp ? getComputedStyle(sp).webkitTextFillColor : null;
  });
  expect(span, '부분 단색 span 이 투명(상속)이라 글자가 사라진다').toBe('rgb(0, 255, 0)');
  await page.evaluate(() => window.applyTextBlockColor(document.getElementById('tb1'), '#000000'));
  expect(await page.evaluate(() => document.querySelector('#tb1 .tb-body').innerHTML)).not.toMatch(/text-fill/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G8 편집 모드 가시성: 캐럿 색 = 첫 스탑, 선택 영역(::selection)의 채움색이 transparent 가 아니다 · 형광펜 버튼 막힘', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #cc2244 0%, rgba(204,34,68,0.000) 100%)' }, { commit: true }));
  const v = await page.evaluate(() => {
    const el = document.querySelector('#tb1 .tb-body');
    el.contentEditable = 'true';
    return {
      caret: getComputedStyle(el).caretColor,
      selFill: getComputedStyle(el, '::selection').webkitTextFillColor,
    };
  });
  expect(v.caret).toBe('rgb(204, 34, 68)');
  expect(v.selFill, '선택하면 글자가 투명해 안 보인다').not.toBe('rgba(0, 0, 0, 0)');
  await select(page, 'tb1');
  const hl = await page.evaluate(() => { const b = document.getElementById('txt-highlight-btn'); return b ? { d: b.disabled, t: b.title } : null; });
  if (hl) { expect(hl.d).toBe(true); expect(hl.t).toContain('그라데이션'); }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G9 html2canvas 대체: neutralizeTextGradForH2C 뒤 clip 없음 · 글자색 = 첫 스탑(인라인 «마지막 단색» 아님) · 다른 요소 불변', async ({ page }) => {
  const errs = await boot(page);
  // 인라인 color(#cc2244 = 마지막 단색)와 다른 첫 스탑(#11aa33) — 대체색이 어디서 오는지 가른다.
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb1'),
    { css: 'linear-gradient(90deg, #2244cc 100%, #11aa33 0%)' }, { commit: true }));
  const r = await page.evaluate(() => {
    const clone = document.getElementById('host').cloneNode(true);
    document.body.appendChild(clone);
    window.__styleAttr = clone.querySelector('#tb1 .tb-body').getAttribute('style');
    const n = window.__h2c(clone);
    const el = clone.querySelector('#tb1 .tb-body');
    const c = getComputedStyle(el);
    const out = { n, clip: c.backgroundClip, img: c.backgroundImage, fill: c.webkitTextFillColor,
      live: getComputedStyle(document.querySelector('#host #tb1 .tb-body')).backgroundClip };
    clone.remove();
    return out;
  });
  expect(r.n, await page.evaluate(() => window.__styleAttr)).toBe(1);
  expect(r.clip).not.toBe('text');
  expect(r.img).toBe('none');
  expect(r.fill).toBe('rgb(17, 170, 51)');
  expect(r.live, '클론만 바뀌어야 하는데 라이브 캔버스가 바뀌었다').toBe('text');
  expect(errs, errs.join(' | ')).toEqual([]);
});


/* ── 픽스 라운드(이벨류 지적) ── */

test('G10 ★재선택·재로드 뒤 솔리드 복귀 = 같은 세션과 같은 «마지막 단색» (첫 스탑 아님)', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');                        // #cc2244 본문
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  // 첫 스탑(선택 스탑 0) hex 를 FF8800 으로 — 진짜 입력칸
  await page.locator('.goya-cp-grad-thumb').first().click();
  await page.fill('.goya-cp-popover [data-el="gradStopHex"]', 'FF8800');
  await page.locator('.goya-cp-popover [data-el="gradStopHex"]').press('Enter');
  await page.waitForTimeout(60);
  const g = await look(page, 'tb1');
  expect(g.tg.stops[0].color).toBe('#ff8800');
  await closePicker(page);
  // ① 재선택
  await select(page, 'tb2');
  await select(page, 'tb1');
  await openTxtPicker(page);
  expect(await activeTab(page)).toBe('gradient');
  await tab(page, 'solid').click();
  let s = await look(page, 'tb1');
  expect(s.clip).not.toBe('text');
  expect(s.fill, '재선택 뒤 솔리드 복귀가 첫 스탑(#ff8800)으로 간다').toBe('rgb(204, 34, 68)');
  await closePicker(page);
  // ② 재로드(sanitize 왕복) 뒤
  await page.evaluate(() => window.__undo());       // 그라데이션 상태로
  expect((await look(page, 'tb1')).clip).toBe('text');
  const ok = await page.evaluate(async () => {
    await import('/js/io/save-load.js').catch(() => {});
    if (typeof window.sanitizeCanvasHtml !== 'function') return false;
    const host = document.getElementById('host');
    const html = host.innerHTML; host.innerHTML = ''; host.innerHTML = window.sanitizeCanvasHtml(html);
    return true;
  });
  expect(ok).toBe(true);
  await select(page, 'tb1');
  await openTxtPicker(page);
  expect(await activeTab(page)).toBe('gradient');
  await tab(page, 'solid').click();
  s = await look(page, 'tb1');
  expect(s.fill, '재로드 뒤 솔리드 복귀가 첫 스탑으로 간다').toBe('rgb(204, 34, 68)');
  expect(errs.filter(e => !/save-load/.test(e)), errs.join(' | ')).toEqual([]);
});

test('G11 ★인라인 색 없던 제목에 그라데이션 → 태그(라벨) 전환 = 기본 흰 글자(어두운 박스 위 어두운 글자 금지)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    const h = document.querySelector('#tb2 .tb-h1'); h.style.removeProperty('color');
    window.applyTextGradient(document.getElementById('tb2'), { css: 'linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.000) 100%)' }, { commit: true });
  });
  expect(await page.evaluate(() => document.querySelector('#tb2 .tb-h1').style.color), '그라데이션이 인라인 color 를 덮었다').toBe('');
  await select(page, 'tb2');
  await page.click('.prop-type-btn[data-cls="tb-label"]');
  const r = await page.evaluate(() => {
    const el = document.querySelector('#tb2 .tb-label');
    const c = getComputedStyle(el);
    return { color: c.color, fill: c.webkitTextFillColor, bg: c.backgroundColor, clip: c.backgroundClip,
      want: (getComputedStyle(document.documentElement).getPropertyValue('--preset-label-color').trim() || '#ffffff') };
  });
  expect(r.clip).not.toBe('text');
  expect(r.fill, `라벨 글자 ${r.fill} on ${r.bg}`).not.toBe('rgb(26, 26, 26)');
  expect(r.color).toBe(await page.evaluate((w) => { const d = document.createElement('div'); d.style.color = w; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, r.want));
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G12 ★칠하는 글자 효과(메탈릭 등)와 그라데이션은 함께 못 쓴다: 효과를 걸면 그라데이션이 풀리고, 효과 중엔 그라데이션 탭이 막힌다(이유)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.applyTextGradient(document.getElementById('tb2'),
    { css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)' }, { commit: true }));
  await select(page, 'tb2');
  await page.evaluate(() => window.applyTextEffect(document.getElementById('tb2'), { preset: 'metallic' }));
  const r = await page.evaluate(() => {
    const el = document.querySelector('#tb2 .tb-h1');
    return { tg: window.getTextGradient(el), inl: el.getAttribute('style'), img: getComputedStyle(el).backgroundImage,
      modes: document.getElementById('txt-color').dataset.cpModes, note: document.getElementById('txt-color').dataset.cpModesNote };
  });
  expect(r.tg, '효과를 걸었는데 사용자 그라데이션이 저장소에 남아 Figma 로 나간다').toBeNull();
  expect(r.inl).not.toMatch(/background-clip|text-fill/);
  expect(r.img).not.toContain('rgb(255, 0, 0)');
  expect(r.modes).toBe('solid');
  expect(r.note).toContain('글자 효과');
  // neon 은 칠하지 않는다 → 그라데이션 가능 그대로
  await page.evaluate(() => window.applyTextEffect(document.getElementById('tb1'), { preset: 'neon' }));
  expect(await page.evaluate(() => window.textGradientAllowed(document.querySelector('#tb1 .tb-body')))).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G13 ★스탑 썸네일 «클릭만»(안 움직임) = 기록 0 — 다음 ⌘Z 가 헛돌지 않는다', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tb1');
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const s0 = await snaps(page);
  await page.locator('.goya-cp-grad-thumb').nth(1).click();
  await page.locator('.goya-cp-grad-thumb').nth(0).click();
  await page.waitForTimeout(80);
  expect(await snaps(page) - s0, '움직이지 않은 클릭이 기록을 쌓았다').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G14 타입 전환(본문→H2) 뒤 그라데이션 탭 기본값 = «지금 보이는 색»(옛 타입 색이 시드되지 않음)', async ({ page }) => {
  const errs = await boot(page);
  // 앱 테마 변수 없이도 타입별 기본색이 갈리게(앱: 본문 #555 · H2 #1a1a1a)
  await page.addStyleTag({ content: '#tb1 .tb-body{color:#555555} #tb1 .tb-h2{color:#1a1a1a}' });
  await page.evaluate(() => document.querySelector('#tb1 .tb-body').style.removeProperty('color'));
  await select(page, 'tb1');
  const before = await page.evaluate(() => document.getElementById('txt-color').value);
  await page.click('.prop-type-btn[data-cls="tb-h2"]');
  const now = await page.evaluate(() => {
    const el = document.querySelector('#tb1 [class^="tb-"]');
    const m = getComputedStyle(el).color.match(/\d+/g).slice(0, 3);
    return '#' + m.map(n => (+n).toString(16).padStart(2, '0')).join('');
  });
  expect(now, '★양성대조: 본문과 H2 기본색이 같아 측정 불가').not.toBe(before);
  expect(await page.evaluate(() => document.getElementById('txt-color').value)).toBe(now);
  await openTxtPicker(page);
  await tab(page, 'gradient').click();
  const g = await look(page, 'tb1');
  expect(g.tg.stops[0].color, '그라데이션이 옛 타입(본문) 색으로 시작한다').toBe(now);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════
 * 0919r3 textshadow — 글자 그라데이션 + 그림자/네온: 그림자는 글자 «뒤»(피그마 DROP_SHADOW 처럼)
 *   고치기 전: text-shadow 가 배경(=그라데이션) «위»에 칠해져, 채움이 transparent 인 글자 안쪽까지
 *   그림자색이 보였다 → 0% 쪽 페이드가 그림자색으로 메워짐. ⇒ ★computed 가 아니라 «화면을 찍어» 잰다.
 * ═══════════════════════════════════════════════════════════ */

const RED_FADE = 'linear-gradient(90deg, #ff0000 0%, rgba(255,0,0,0) 100%)';

/** 픽셀 측정용 블럭 — 글자 폭 = 박스 폭(inline-block·nowrap)이라 그라데이션 0%~100% 가 글자 끝과 끝에 맞는다. */
async function addProbe(page) {
  await page.evaluate(() => {
    const host = document.getElementById('host');
    host.style.background = '#ffffff';
    host.insertAdjacentHTML('beforeend',
      '<div class="text-block" id="tb5" data-type="body" style="padding:24px;background:#fff">'
      + '<div class="tb-body" contenteditable="false" style="display:inline-block;white-space:nowrap;font:900 72px/1.1 sans-serif;color:#ff0000;letter-spacing:0">■■■■■■</div></div>');
    window.__snaps.push(host.innerHTML);
  });
}

/** contentEl 박스를 찍어 RGB 배열로. */
async function grab(page, sel = '#tb5 .tb-body') {
  const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, sel);
  const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) };
  const b64 = (await page.screenshot({ clip })).toString('base64');
  const px = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, d: Array.from(x.getImageData(0, 0, c.width, c.height).data) };
  }, b64);
  return px;
}
/** x 비율 구간 [a,b) 의 픽셀들 */
function cols(img, a, b) {
  const out = [];
  const x0 = Math.floor(img.w * a), x1 = Math.ceil(img.w * b);
  for (let y = 0; y < img.h; y++) for (let x = x0; x < Math.min(x1, img.w); x++) {
    const i = (y * img.w + x) * 4; out.push({ i, r: img.d[i], g: img.d[i + 1], b: img.d[i + 2] });
  }
  return out;
}
/** 진짜 패널 토글(숨은 체크박스를 감싼 라벨 트랙)을 마우스로 누른다. */
async function shadowToggle(page, on) {
  const cur = await page.locator('#txt-shadow-on').isChecked();
  if (cur !== on) await page.locator('#txt-shadow-section .prop-toggle-track').click();
  await expect(page.locator('#txt-shadow-on')).toBeChecked({ checked: on });
}
const minG = (px) => px.reduce((m, p) => Math.min(m, p.g), 255);
const tgsLook = (page, sel = '#tb5 .tb-body') => page.evaluate((s) => {
  const el = document.querySelector(s); const c = getComputedStyle(el);
  return { ts: c.textShadow, filter: c.filter, tgs: el.classList.contains('tgs'),
    src: el.style.getPropertyValue('--tgs-src'), f: el.style.getPropertyValue('--tgs-filter'), inlineTs: el.style.textShadow };
}, sel);

test('G15 ★그라데이션 + 일반 그림자: 0% 쪽 글자 안쪽은 배경색, 불투명 쪽 글자 안쪽은 그림자 없는 그림과 같다 (화면 픽셀)', async ({ page }) => {
  const errs = await boot(page);
  await addProbe(page);
  const solid = await grab(page);
  // ★양성대조: 오른쪽 끝 구간에 글자 잉크가 «있다»(없으면 이 검사는 아무것도 못 잰다)
  expect(minG(cols(solid, 0.88, 1)), '★양성대조: 오른쪽 끝에 글자가 없다(측정 불가)').toBeLessThan(60);
  await page.evaluate((css) => window.applyTextGradient(document.getElementById('tb5'), { css }, { commit: true }), RED_FADE);
  const ref = await grab(page);
  // 진짜 패널로 그림자 켜기(기본 2,2,4,#000 50%)
  await select(page, 'tb5');
  await shadowToggle(page, true);
  const L = await tgsLook(page);
  expect(L.inlineTs, '원본 인라인 text-shadow 는 그대로 보존').toBe('rgba(0, 0, 0, 0.5) 2px 2px 4px');
  expect(L.ts, '그라데이션 글자인데 text-shadow 가 살아 있다(글자 «위»에 칠해짐)').toBe('none');
  expect(L.filter).toBe('drop-shadow(rgba(0, 0, 0, 0.5) 2px 2px 2px)');
  expect(L.tgs).toBe(true);
  const img = await grab(page);
  const right = minG(cols(img, 0.88, 1));
  expect(right, `0% 쪽 글자 안쪽이 그림자색으로 메워졌다 (min G=${right})`).toBeGreaterThanOrEqual(200);
  // 불투명 쪽: 그림자 없는 그림(ref)에서 진한 빨강인 글자 안쪽 픽셀이 그대로인가
  const inner = cols(ref, 0, 0.12).filter(p => p.r > 220 && p.g < 40 && p.b < 40);
  expect(inner.length, '★양성대조: 불투명 쪽 글자 안쪽 픽셀이 없다').toBeGreaterThan(200);
  const same = inner.filter(p => Math.abs(img.d[p.i] - p.r) <= 25 && Math.abs(img.d[p.i + 1] - p.g) <= 25 && Math.abs(img.d[p.i + 2] - p.b) <= 25).length;
  expect(same / inner.length, `불투명 쪽 글자색이 그림자에 덮였다 (${same}/${inner.length})`).toBeGreaterThanOrEqual(0.97);
  // 그림자가 «있기는» 하다 — 글자 밖(오른쪽 아래) 어딘가 회색이 생겼다
  const diffOutside = cols(img, 0, 0.5).filter(p => ref.d[p.i + 1] > 240 && p.g < 235).length;
  expect(diffOutside, '그림자가 아예 사라졌다').toBeGreaterThan(50);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G16 그림자 끄기/켜기/값 변경마다 파생값(--tgs-*) 갱신 · 되돌리기 · 그라데이션 해제 = 원래 text-shadow 복귀', async ({ page }) => {
  const errs = await boot(page);
  await addProbe(page);
  await page.evaluate((css) => window.applyTextGradient(document.getElementById('tb5'), { css }, { commit: true }), RED_FADE);
  await select(page, 'tb5');
  await shadowToggle(page, true);
  expect((await tgsLook(page)).f).toBe('drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.5))');
  await page.evaluate(() => window.pushHistory());                 // 스냅샷 A = 켜짐·x2
  await page.locator('#txt-shadow-x-number').fill('7');
  await page.locator('#txt-shadow-x-number').dispatchEvent('input');
  const b = await tgsLook(page);
  expect(b.f, 'X 를 바꿨는데 drop-shadow 가 안 따라왔다').toBe('drop-shadow(7px 2px 2px rgba(0, 0, 0, 0.5))');
  expect(b.filter).toContain('7px 2px 2px');
  await page.evaluate(() => window.pushHistory());                 // 스냅샷 B = x7
  await page.evaluate(() => window.__undo());                      // → A
  const u = await tgsLook(page);
  expect(u.f).toBe('drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.5))');
  expect(u.filter).toBe('drop-shadow(rgba(0, 0, 0, 0.5) 2px 2px 2px)');
  expect(u.ts).toBe('none');
  // 끄기
  await select(page, 'tb5');
  await shadowToggle(page, false);
  const off = await tgsLook(page);
  expect(off.tgs, '그림자를 껐는데 .tgs 가 남았다').toBe(false);
  expect(off.f).toBe('');
  expect(off.filter).toBe('none');
  // 다시 켜고 → 그라데이션 해제(단색) → 원래 text-shadow 로
  await shadowToggle(page, true);
  expect((await tgsLook(page)).tgs).toBe(true);
  await page.evaluate(() => window.applyTextBlockColor(document.getElementById('tb5'), '#0044ff'));
  const solid = await tgsLook(page);
  expect(solid.tgs, '단색으로 바꿨는데 .tgs 가 남았다').toBe(false);
  expect(solid.src + solid.f).toBe('');
  expect(solid.ts, '단색 글자는 원래 text-shadow 로').toBe('rgba(0, 0, 0, 0.5) 2px 2px 4px');
  expect(solid.filter).toBe('none');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G17 저장→재로드(innerHTML → sanitizeCanvasHtml) 뒤에도 computed·픽셀이 같다 · 파생값 없는 옛 저장본도 열면 글자 뒤 그림자', async ({ page }) => {
  const errs = await boot(page);
  await addProbe(page);
  await page.evaluate((css) => window.applyTextGradient(document.getElementById('tb5'), { css }, { commit: true }), RED_FADE);
  await select(page, 'tb5');
  await shadowToggle(page, true);
  const a = await tgsLook(page);
  const imgA = await grab(page);
  const reload = (strip) => page.evaluate(async (strip) => {
    await import('/js/io/save-load.js').catch(() => {});
    if (typeof window.sanitizeCanvasHtml !== 'function') return false;
    const host = document.getElementById('host');
    let html = host.innerHTML;
    if (strip) {   // 이 변경 «전»에 저장된 모양: 그라데이션 + 인라인 text-shadow, .tgs·--tgs-* 없음
      const t = document.createElement('div'); t.innerHTML = html;
      t.querySelectorAll('.tgs').forEach(e => { e.classList.remove('tgs'); e.style.removeProperty('--tgs-src'); e.style.removeProperty('--tgs-filter'); });
      html = t.innerHTML;
    }
    host.innerHTML = '';
    host.innerHTML = window.sanitizeCanvasHtml(html);
    await new Promise(r => setTimeout(r, 30));   // 관찰자(마이크로태스크) 뒤
    return true;
  }, strip);
  expect(await reload(false), 'sanitizeCanvasHtml 을 못 불렀다(측정 불가)').toBe(true);
  expect(await tgsLook(page)).toEqual(a);
  const imgB = await grab(page);
  let diff = 0; for (let i = 0; i < imgA.d.length; i++) diff = Math.max(diff, Math.abs(imgA.d[i] - imgB.d[i]));
  expect(diff, '재로드 뒤 화면이 달라졌다').toBeLessThanOrEqual(2);
  expect(await reload(true)).toBe(true);
  const legacy = await tgsLook(page);
  expect(legacy.tgs, '옛 저장본을 열었는데 그림자가 여전히 글자 «위»').toBe(true);
  expect(legacy.ts).toBe('none');
  expect(errs.filter(e => !/save-load/.test(e)), errs.join(' | ')).toEqual([]);
});

test('G18 ★네온 + 그라데이션: 글로우가 글자 뒤(0% 쪽 글자 안쪽 = 배경 근처) · 네온 해제 = .tgs 해제', async ({ page }) => {
  const errs = await boot(page);
  await addProbe(page);
  await page.evaluate((css) => window.applyTextGradient(document.getElementById('tb5'), { css }, { commit: true }), RED_FADE);
  await page.evaluate(() => window.applyTextEffect(document.getElementById('tb5'), { preset: 'neon', color: '#0033ff', glowColor: '#0033ff', intensity: 100 }));
  const L = await tgsLook(page);
  expect(L.tgs).toBe(true);
  expect(L.ts).toBe('none');
  // 여러 겹 = SVG 필터(겹 누적 없음) — 6겹이 전부 SourceAlpha 에서 따로 만들어지는가
  expect(L.f).toMatch(/^url\(#tgs-f-[0-9a-z]+\)$/);
  const fx = await page.evaluate((f) => { const id = f.slice(5, -1); const n = document.getElementById(id);
    return n ? { alpha: n.querySelectorAll('[in="SourceAlpha"]').length, merge: [...n.querySelectorAll('feMergeNode')].map(m => m.getAttribute('in')).pop(), inCanvas: !!n.closest('#canvas') } : null; }, L.f);
  expect(fx, 'SVG 필터 정의가 문서에 없다').toBeTruthy();
  expect(fx.alpha, '네온 6겹이 전부 옮겨지지 않았다').toBe(6);
  expect(fx.merge).toBe('SourceGraphic');
  expect(fx.inCanvas, '필터 정의가 캔버스(저장 대상) 안에 들어갔다').toBe(false);
  const img = await grab(page);
  // 0% 쪽 글자 안쪽: 파란 글로우(#0033ff → R 이 떨어진다)가 글자 안에 칠해지면 R 이 낮아진다
  const right = cols(img, 0.9, 1).reduce((m, p) => Math.min(m, p.r), 255);
  expect(right, `0% 쪽 글자 안쪽에 네온 글로우가 칠해졌다 (min R=${right})`).toBeGreaterThanOrEqual(200);
  // 해제(진짜 패널 «효과 제거») — 패널이 fixed 라 버튼이 기본 뷰포트 아래로 나간다 → 뷰포트를 키운다
  await page.setViewportSize({ width: 1280, height: 2400 });
  await select(page, 'tb5');
  await page.locator('#tfx-remove').click();
  const off = await tgsLook(page);
  expect(off.tgs, '네온을 뺐는데 .tgs 가 남았다').toBe(false);
  expect(off.filter).toBe('none');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G20 html2canvas 대체(neutralizeTextGradForH2C) 뒤 .tgs·--tgs-* 없음, 원래 text-shadow 가 살아 있다', async ({ page }) => {
  const errs = await boot(page);
  await addProbe(page);
  await page.evaluate((css) => window.applyTextGradient(document.getElementById('tb5'), { css }, { commit: true }), RED_FADE);
  await select(page, 'tb5');
  await shadowToggle(page, true);
  expect((await tgsLook(page)).tgs).toBe(true);
  const r = await page.evaluate(() => {
    const clone = document.getElementById('tb5').cloneNode(true);
    clone.id = 'tb5c';
    window.__h2c(clone);
    document.getElementById('host').appendChild(clone);
    const el = clone.querySelector('.tb-body'); const c = getComputedStyle(el);
    return { tgs: el.classList.contains('tgs'), style: el.getAttribute('style'), ts: c.textShadow, filter: c.filter, color: c.color };
  });
  expect(r.tgs).toBe(false);
  expect(r.style).not.toMatch(/--tgs-/);
  expect(r.ts).toBe('rgba(0, 0, 0, 0.5) 2px 2px 4px');
  expect(r.filter).toBe('none');
  expect(r.color).toBe('rgb(255, 0, 0)');
  expect(errs, errs.join(' | ')).toEqual([]);
});
