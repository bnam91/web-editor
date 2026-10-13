/* text-dot-frame-clip.dom.spec.js — 1012t1E4 「tb_tqvb0_hvh4swj 에 점효과를 적용했는데 안되네?」
 *
 * ★원인(잰 것) — 점은 그려지는데 텍스트 프레임의 overflow:hidden(2026-10-10 기본)이 잘라 낸다.
 *   큰 제목(104px · 줄간격 1.1)은 span 의 content 상자가 줄 상자보다 커서 span 위변이 프레임 위로 나가고,
 *   점(`bottom:100%`)은 그보다 더 위 ⇒ 점 전체가 프레임 위변 밖. 선택하면 선택 해제 규칙이 풀어 보이고,
 *   선택을 풀면 사라진다. text-dot-over D1/D2 는 body(줄간격 넉넉)라 이 판을 못 잡았다.
 * ★고침 = css/editor-blocks.css — 점이 든 텍스트 프레임은 비선택에도 안 자른다(모서리 규칙 «앞»).
 *
 * 재는 것 (점 색을 #22AA55 로 칠해 ★그림에서 센다 · 찍기 전 .selected/.editing 을 걷는다)
 *   F1 패널로 새로 건 h1 점 — 선택 해제 뒤에도 그려진 점 = 4.
 *      전제: span.tb-dot 4 · 점이 프레임 위변 «밖»(아니면 이 칸은 아무것도 안 잰다) · 비선택 · ::before 살아 있음.
 *   F2 현빈 블럭 꼴(사본 HTML · 반사 켬) — 비선택 그려진 점 = 4.
 *   F3 음성대조 — 「내용 자르기」 켬이면 0 (켬이 이긴다). 같은 칸에서 끄기 전 4 를 먼저 본다.
 *   F3b 「내용 자르기」 끔(false) 쪽 — 4 (frame-clip-axis-roster R2: 축을 만지는 spec 은 끔 쪽도 돌린다).
 *   F4 음성대조 — 점 없는 텍스트 프레임은 overflow hidden 그대로(10-10 결정 보존).
 *   F5 둥근 텍스트 프레임은 계속 자른다(0) — 규칙 «자리»(모서리 규칙 앞) 잠금. 둥글리기 전 4 를 먼저 본다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-dot-frame-clip
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff;padding:80px 0 0 80px"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';

/* 현빈 블럭(tb_tqvb0_hvh4swj) 사본의 최소 꼴 — 큰 제목 · 점 4 · 점 8px · 반사 켬 */
const COPY_ID = 'tb_e4copy';
const COPY_HTML = `<div class="frame-block" data-text-frame="true" id="ss_e4copy">
  <div class="text-block" data-type="heading" id="${COPY_ID}" style="--tb-dot-size: 8px; -webkit-box-reflect: below 4px linear-gradient(rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.35)); margin-bottom: 67px;" data-fx-reflect="on" data-rf-margin-y="67">
    <div class="tb-h1" style="text-align: center;"><span class="tb-dot" style="--tb-dot-i: -1.5;">품</span><span class="tb-dot" style="--tb-dot-i: -0.5;">질</span><span class="tb-dot" style="--tb-dot-i: 0.5;">혁</span><span class="tb-dot" style="--tb-dot-i: 1.5;">신</span></div>
  </div>
</div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    const st = document.createElement('style');
    st.textContent = '#canvas .text-block{--tb-dot-color:#22AA55 !important}';   // 점만 골라 세는 색
    document.head.appendChild(st);
  }, SEC);
  await page.waitForFunction(() => !!document.getElementById('inA'));
  return errs;
}

const insertCopy = (page) => page.evaluate((html) => {
  document.getElementById('inA').insertAdjacentHTML('beforeend', html);
  window.rebindAll?.();
}, COPY_HTML);

const deselect = (page) => page.evaluate(() => {
  window.deselectAll?.();
  document.querySelectorAll('#canvas .selected,#canvas .editing').forEach(e => e.classList.remove('selected', 'editing'));
});

/* 섹션을 찍어 #22AA55 덩어리를 센다 */
async function painted(page) {
  const b64 = (await (await page.$('#sA')).screenshot()).toString('base64');
  return page.evaluate(async (s) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const hit = (k) => Math.abs(d[k] - 34) < 40 && Math.abs(d[k + 1] - 170) < 46 && Math.abs(d[k + 2] - 85) < 46;
    const seen = new Uint8Array(c.width * c.height); let n = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (!hit((y * c.width + x) * 4) || seen[y * c.width + x]) continue;
      const st = [[x, y]]; let px = 0;
      while (st.length) {
        const [a, b] = st.pop();
        if (a < 0 || b < 0 || a >= c.width || b >= c.height || seen[b * c.width + a]) continue;
        if (!hit((b * c.width + a) * 4)) continue;
        seen[b * c.width + a] = 1; px++;
        st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
      }
      if (px > 3) n++;
    }
    return n;
  }, b64);
}

/* 전제 — 점이 «프레임 위변 밖»에 있는 판인가 · 비선택인가 · ::before 가 살아 있나 */
const premise = (page, id) => page.evaluate((i) => {
  const tb = document.getElementById(i); const fr = tb.closest('.frame-block');
  const sp = tb.querySelector('span.tb-dot'); const b = getComputedStyle(sp, '::before');
  const sr = sp.getBoundingClientRect(); const fTop = fr.getBoundingClientRect().top;
  const size = parseFloat(b.height); const bottom = parseFloat(b.bottom);
  /* ::before 는 span 기준 absolute — 점 아래변 = span 아래변 − bottom */
  const dotBottom = sr.bottom - bottom; const dotCy = dotBottom - size / 2;
  return {
    nSpan: tb.querySelectorAll('span.tb-dot').length,
    nSel: document.querySelectorAll('#canvas .selected,#canvas .editing').length,
    content: b.content, display: b.display, size,
    dotCyBelowFrameTop: dotCy - fTop,
    overflow: getComputedStyle(fr).overflow,
  };
}, id);

const pollPainted = (page, n) => expect.poll(() => painted(page), { timeout: 5000 }).toBe(n);

test('F1 패널로 새로 건 h1 점 — 선택 해제 뒤에도 4개 그려진다', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addTextBlock('h1', { content: '품질혁신' });
    const f = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
    return f.length ? f[f.length - 1].id : null;
  });
  expect(id).toBeTruthy();
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  await page.waitForSelector('#txt-dot-btn', { state: 'attached' });
  const bb = await page.locator('#txt-dot-btn').first().boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForFunction((i) => document.getElementById(i).querySelectorAll('span.tb-dot').length === 4, id);
  await deselect(page);
  await page.waitForFunction(() => !document.querySelector('#canvas .selected,#canvas .editing'));

  const p = await premise(page, id);
  expect(p.nSpan).toBe(4);
  expect(p.nSel).toBe(0);
  expect(p.content).toBe('""');
  expect(p.display).toBe('block');
  expect(p.dotCyBelowFrameTop).toBeLessThan(0);    // 점 중심이 프레임 위변 «위» — 자르면 안 보이는 판
  await pollPainted(page, 4);
  expect(errs).toEqual([]);
});

test('F2 현빈 블럭 꼴(반사 켬 · 8px) — 비선택에서 4개 그려진다', async ({ page }) => {
  const errs = await setup(page);
  await insertCopy(page);
  await deselect(page);
  const p = await premise(page, COPY_ID);
  expect(p.nSpan).toBe(4);
  expect(p.nSel).toBe(0);
  expect(p.content).toBe('""');
  expect(p.size).toBe(8);
  expect(p.dotCyBelowFrameTop).toBeLessThan(0);
  expect(await page.evaluate((i) => getComputedStyle(document.getElementById(i)).webkitBoxReflect, COPY_ID)).not.toBe('none');
  await pollPainted(page, 4);
  expect(errs).toEqual([]);
});

test('F3 음성대조 — 「내용 자르기」 켬이면 점은 잘린다(0)', async ({ page }) => {
  const errs = await setup(page);
  await insertCopy(page);
  await deselect(page);
  await pollPainted(page, 4);                      // 같은 칸의 양성 — 켜기 전엔 보인다
  await page.evaluate(() => { document.getElementById('ss_e4copy').dataset.clipContent = 'true'; });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('ss_e4copy')).overflow === 'hidden');
  expect((await premise(page, COPY_ID)).dotCyBelowFrameTop).toBeLessThan(0);
  await pollPainted(page, 0);
  expect(errs).toEqual([]);
});

test('F3b 「내용 자르기」 끔(false) — 점은 그대로 보인다(4)', async ({ page }) => {
  const errs = await setup(page);
  await insertCopy(page);
  await deselect(page);
  await page.evaluate(() => { document.getElementById('ss_e4copy').dataset.clipContent = 'false'; });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('ss_e4copy')).overflow === 'visible');
  expect((await premise(page, COPY_ID)).dotCyBelowFrameTop).toBeLessThan(0);
  await pollPainted(page, 4);
  expect(errs).toEqual([]);
});

test('F4 음성대조 — 점 없는 텍스트 프레임은 계속 자른다(hidden)', async ({ page }) => {
  const errs = await setup(page);
  await insertCopy(page);
  await deselect(page);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('ss_e4copy')).overflow === 'visible');
  await page.evaluate((i) => {
    document.getElementById(i).querySelectorAll('span.tb-dot').forEach(s => s.classList.remove('tb-dot'));
  }, COPY_ID);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('ss_e4copy')).overflow === 'hidden');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('ss_e4copy')).overflow)).toBe('hidden');
  expect(errs).toEqual([]);
});

test('F5 둥근 텍스트 프레임은 계속 자른다(0) — 규칙 자리 잠금', async ({ page }) => {
  const errs = await setup(page);
  await insertCopy(page);
  await deselect(page);
  await pollPainted(page, 4);                      // 둥글리기 전엔 보인다
  await page.evaluate(() => { document.getElementById('ss_e4copy').dataset.radius = '24'; });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('ss_e4copy')).overflow === 'hidden');
  await pollPainted(page, 0);
  expect(errs).toEqual([]);
});
