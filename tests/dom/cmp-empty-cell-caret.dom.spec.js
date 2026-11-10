/* cmp-empty-cell-caret.dom.spec.js — NEW-현빈QA-CMP-EMPTY-CELL-CARET-01 (현빈 9502 · 지디 261110)
 *   손순서: 비교 블럭 «빈» 칸(안내 글 '내용을 입력하세요.') 더블클릭 → 캐럿이 안내 글 줄 «위»(칸 맨 위)에 그려짐.
 *     한 글자 치면 그 글자는 세로 가운데로 들어간다(= 캐럿 자리 ≠ 친 글자 자리).
 *   실측(워커2 격리앱 · 진짜 더블클릭 · 마젠타 캐럿 · 칸 rect 기준): 고치기 전 몸 칸 왼열 0/12 · 오른열 0/9 · 머리 0/3·0/3 (dMid −8~−10px)
 *     → 고친 뒤 12/12 · 9/9 · 3/3 · 3/3 (dMid ≤0.33) · 글 있는 칸 3/3 → 3/3(무변). dev 02f70b89e 도 같은 꼴(옛 버그).
 *   뿌리: 칸은 인라인 display:flex;align-items:center(comparison-block.js 칸 :470 · 머리 :428) · 안내 글은 :empty::before.
 *     Chromium 은 «빈» 편집 요소의 캐럿을 내용 상자 맨 위에 그린다(flex·align-content 정렬 무시 — 실측).
 *   고침: css/editor-blocks.css «편집 중 빈 칸»만 block + 위 패딩 (칸 높이 − 한 줄)/2 · 칸 높이 = 인라인 --cmp-h.
 *     캡션 모드 제목(.cmp-caption > .cmp-hd)은 flex 가 아니라 캐럿·안내 글·친 글자가 이미 같은 줄(위) → 뺐다(K6 가 잠근다).
 * 판정기: 캐럿을 caret-color 마젠타로 칠하고(배치 무변) 칸 rect ±12px 를 찍어 마젠타 픽셀 상자를 «칸 rect 기준» 좌표로 잰다
 *   (자른 영역 가장자리에 걸려 못 잡던 옛 판정기 고침 — 지디 261110). 깜박임 = 잡힐 때까지 여러 장.
 *   K1 몸 빈 칸(두 열 다) · K2 머리 빈 제목(두 열 다) — 캐럿 세로 가운데 = 칸 세로 가운데 ±2
 *   K3 [대조] 글 있는 칸 — 캐럿 세로 가운데 ±2(고침 전후 같음)
 *   K4 한 글자 친 뒤 캐럿 = 치기 전 캐럿 자리 ±2(몸 칸·머리)
 *   K5 쉬는 빈 칸(편집 아님) — 규칙 안 걸림(display flex · padding-top 0) = 안내 글 꼴 무변
 *   K6 [대조] 캡션 모드 빈 제목 — 캐럿 = 친 글자 자리 ±2(고침이 캡션을 건드리지 않음)
 * 양성대조(지디 인텔): css/editor-blocks.css 의 NEW-CMP-EMPTY-CELL-CARET-01 규칙 묶음(주석 + 선택자 둘 + 선언 셋)을 지우면
 *   K1·K2·K4 빨강 · K3·K5·K6 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-empty-cell-caret
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const MAKE = `window.addComparisonBlock({ cols: [
  { title: '', rows: [{type:'text',text:''},{type:'text',text:''}] },
  { title: '', rows: [{type:'text',text:''},{type:'text',text:'글 있는 칸'}] }], featured: 1 });`;
const cellSel = (c, r) => `#sB .comparison-block .cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`;
const hdSel = (c) => `#sB .comparison-block .cmp-hd[data-col-idx="${c}"]`;
const PAD = 12;

async function setup(page, { caption = false } = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([mk, sec, caption]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(mk);
    const b = [...document.querySelectorAll('#sB .comparison-block')].pop();
    if (caption) { b.dataset.captionPos = 'top'; window.renderComparison(b); }
    window.__blk = b;
    window.buildLayerPanel?.(); window.deselectAll?.();
    b.scrollIntoView({ block: 'center' });
    const st = document.createElement('style');   // 판정용 — 캐럿 색만(배치 무변)
    st.textContent = '#canvas .comparison-block [contenteditable]{caret-color:rgb(255,0,255) !important}';
    document.head.appendChild(st);
  }, [MAKE, SEC, caption]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 5000 });
  await page.bringToFront();
  return errs;
}
/** 마젠타 캐럿 상자 — 칸 rect 기준 CSS px. 깜박임 탓에 잡힐 때까지 여러 장(최대 ~2초). */
async function caretBox(page, sel) {
  const rc = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  let out = null;
  const grab = async () => {
    const png = await page.screenshot({ clip: { x: rc.x - PAD, y: rc.y - PAD, width: rc.w + 2 * PAD, height: rc.h + 2 * PAD }, caret: 'initial' });
    const box = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const d = cx.getImageData(0, 0, img.width, img.height).data;
      let y0 = 1e9, y1 = -1, x0 = 1e9;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] > 200) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); } }
      return y1 < 0 ? null : { y0, y1: y1 + 1, x0, W: img.width };
    }, png.toString('base64'));
    if (box) { const K = box.W / (rc.w + 2 * PAD); const top = box.y0 / K - PAD, bot = box.y1 / K - PAD; out = { top, bot, mid: (top + bot) / 2, h: rc.h }; }
    return !!box;
  };
  await expect.poll(grab, { intervals: [130], timeout: 2500, message: `캐럿(마젠타)이 안 잡힌다 ${sel}` }).toBe(true).catch(() => {});   // 못 잡으면 null → 부르는 쪽 [전제]가 빨강
  return out;
}
async function editAt(page, sel) {
  const rc = await waitStableRect(page, sel);
  await page.mouse.dblclick(rc.cx, rc.cy);
  await page.waitForFunction((s) => { const e = document.querySelector(s); return e?.getAttribute('contenteditable') === 'true' && document.activeElement === e; }, sel, { timeout: 3000 });
}
async function expectCentered(page, sel, label) {
  await editAt(page, sel);
  const c = await caretBox(page, sel);
  expect(c, `[전제] ${label} 캐럿이 그려졌다(마젠타)`).not.toBeNull();
  console.log(`CMPCARET ${label} ` + JSON.stringify(c));
  expect(Math.abs(c.mid - c.h / 2), `★${label} 캐럿 세로 가운데 ${c.mid.toFixed(2)} vs 칸 ${(c.h / 2).toFixed(2)} (위 ${c.top.toFixed(2)})`).toBeLessThanOrEqual(2);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); });
  return c;
}

test('K1 몸 빈 칸 — 두 열 다 · 캐럿 세로 가운데 ±2', async ({ page }) => {
  const errs = await setup(page);
  for (const [c, r] of [[0, 0], [0, 1], [1, 0]]) {
    expect(await page.evaluate((s) => document.querySelector(s).textContent, cellSel(c, r)), '[전제] 빈 칸').toBe('');
    await expectCentered(page, cellSel(c, r), `몸 ${c}:${r}`);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K2 머리 빈 제목 — 두 열 다 · 캐럿 세로 가운데 ±2', async ({ page }) => {
  const errs = await setup(page);
  for (const c of [0, 1]) await expectCentered(page, hdSel(c), `머리 ${c}`);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K3 [대조] 글 있는 칸 — 캐럿 세로 가운데 ±2(고침 전후 같음)', async ({ page }) => {
  const errs = await setup(page);
  await expectCentered(page, cellSel(1, 1), '글 있는 칸 1:1');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K4 한 글자 친 뒤 캐럿 = 치기 전 캐럿 자리 ±2 (몸·머리)', async ({ page }) => {
  const errs = await setup(page);
  for (const sel of [cellSel(0, 0), hdSel(1)]) {
    await editAt(page, sel);
    const a = await caretBox(page, sel);
    await page.keyboard.type('가');
    const b = await caretBox(page, sel);
    expect(a && b, '[전제] 캐럿 둘 다 잡힘').toBeTruthy();
    console.log(`CMPCARET K4 ${sel} ` + JSON.stringify({ a, b }));
    expect(Math.abs(b.mid - a.mid), `★치기 전 ${a.mid.toFixed(2)} → 친 뒤 ${b.mid.toFixed(2)} (${sel})`).toBeLessThanOrEqual(2);
    await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); });
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K5 쉬는 빈 칸(편집 아님) — 규칙 안 걸림 = 안내 글 꼴 무변', async ({ page }) => {
  const errs = await setup(page);
  const v = await page.evaluate(([a, b]) => [a, b].map((s) => { const e = document.querySelector(s); const cs = getComputedStyle(e);
    return { ce: e.getAttribute('contenteditable'), display: cs.display, pt: cs.paddingTop, before: getComputedStyle(e, '::before').content }; }), [cellSel(0, 0), hdSel(0)]);
  for (const x of v) {
    expect(x.ce === 'true', '[전제] 편집 아님').toBe(false);
    expect(x.display).toBe('flex');
    expect(x.pt).toBe('0px');
    expect(x.before).not.toBe('none');
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('K6 [대조] 캡션 모드 빈 제목 — 캐럿 = 친 글자 자리 ±2(캡션은 고침 밖)', async ({ page }) => {
  const errs = await setup(page, { caption: true });
  const sel = '#sB .comparison-block .cmp-caption > .cmp-hd[data-col-idx="0"]';
  await editAt(page, sel);
  const a = await caretBox(page, sel);
  await page.keyboard.type('가');
  const b = await caretBox(page, sel);
  expect(a && b, '[전제] 캐럿 둘 다 잡힘').toBeTruthy();
  console.log('CMPCARET K6 ' + JSON.stringify({ a, b }));
  expect(Math.abs(b.mid - a.mid), `캡션: 치기 전 ${a.mid.toFixed(2)} → 친 뒤 ${b.mid.toFixed(2)}`).toBeLessThanOrEqual(2);
  expect(errs, errs.join('\n')).toEqual([]);
});
