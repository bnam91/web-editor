/* sticker-mark.dom.spec.js — 커스텀 인증마크(B3 · 현빈 261114 «아래 같은 커스텀 인증마크 가능한지»)
 *   실측(B3 전): 원·네모 스티커 + 글자·색·크기·굵기로 «99.9%»·«GO-UP»·«○○ FREE» 배지는 «이미» 된다(M1 이 그 증인).
 *     모자랐던 셋만 더했다 — 둘레 글자(원 따라 도는 글) · 테두리 링 · 작은 둘째 줄(부분 서식은 font-size 를 안 받는다 · 공용 세척기는 안 넓힘).
 *   M1 [증인] 원형 스티커 글 «99.9%» — 새 칸 없이 그려진다
 *   M2 둘레 글자 — 패널 «둘레 글자» → svg textPath 글 = 그 글 · path id 는 블럭마다 · 톱니(burst)에도
 *   M3 테두리 — 패널 «테두리» 4 → 원 테두리 선 두께 4
 *   M4 작은 줄 — 패널 «작은 줄» → .sticker-sub 가 .sticker-text «밖» · 더블클릭 편집 뒤에도 본문 글(dataset.text)에 안 섞인다
 *   M5 [보안] 둘레 글자·작은 줄에 태그 — 글자로만(script·img 0 · 핸들러 0)
 *   M6 마킹 블럭(data-count)은 이 층을 안 그린다(무회귀)
 *   M7 둘레 글자 «모든» 글자가 원 둘레 위(getStartPositionOfChar 전부 반지름 ±1) — 톱니 «PREMIUM QUALITY»(지디 실앱: 첫 «P» 가 0,0 = 경로 밖 · 글 106 / 경로 189 · 9시 시작 + 25%) · 원형도
 *      장면 = 실앱 값(크기 160 · 둘레 글자 크기 10) · [전제] 톱니 글 반 길이 > 둘레 25%(아이맥 1차 CTL: 기본 크기 9 장면은 이 조건이 안 서 옛 결함을 못 잡았다)
 * 양성대조:
 *   · js/blocks/sticker-block.js `_burstSvg + _mark.svg + (` 의 `_mark.svg + ` 를 지우면 M2·M3 빨강
 *   · 같은 파일 작은 줄을 .sticker-text «안»에 넣으면(`${bInner}${_mark.sub}` 꼴) M4 빨강
 *   · 같은 파일 _markLayers 의 `escHtml(ring)` 을 `ring` 으로 바꾸면 M5 빨강(작은 줄 `escHtml(sub)` 도 같은 식)
 *   · 같은 파일 둘레 글자 경로를 옛 꼴(`m -r,0` 9시 시작 + startOffset 25%)로 되돌리면 M7 빨강(톱니 0번 글자 0,0)
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
async function add(page, opts) {
  return page.evaluate((opts) => { const sec = document.querySelector('#canvas .section-block'); const before = new Set(sec.querySelectorAll('.sticker-block'));
    window.addStickerBlock(opts); const b = [...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)); return b.id; }, opts);
}
async function panel(page, id) { await page.evaluate((id) => window.showStickerProperties(document.getElementById(id)), id); await page.waitForSelector('#stk-mark-section'); }
async function setField(page, sel, v) { await page.fill(sel, v); await page.dispatchEvent(sel, 'change'); }

test('M1 [증인] 원형 «99.9%» — 새 칸 없이', async ({ page }) => {
  const errs = await boot(page);
  const id = await add(page, { shape: 'circle', text: '99.9%', bgColor: '#1e88e5', textColor: '#ffffff' });
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { t: b.querySelector('.sticker-text').textContent, mark: b.querySelectorAll('svg.stk-mark').length, bg: getComputedStyle(b).backgroundColor }; }, id);
  expect(r).toEqual({ t: '99.9%', mark: 0, bg: 'rgb(30, 136, 229)' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M2 둘레 글자 — 원·톱니', async ({ page }) => {
  const errs = await boot(page);
  for (const shape of ['circle', 'burst']) {
    const id = await add(page, { shape });
    await panel(page, id);
    await setField(page, '#stk-ring-text', 'TEST COMPLETED');
    const r = await page.evaluate((id) => { const b = document.getElementById(id); const tp = b.querySelector('svg.stk-mark textPath');
      const href = tp?.getAttribute('href') || ''; return { text: tp?.textContent ?? null, ok: !!b.querySelector(href), own: href === `#stkr-${id}` }; }, id);
    expect(r, shape).toEqual({ text: 'TEST COMPLETED', ok: true, own: true });
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M3 테두리 4', async ({ page }) => {
  const errs = await boot(page);
  const id = await add(page, { shape: 'circle' });
  await panel(page, id);
  await setField(page, '#stk-ring-bw-num', '4');
  const w = await page.evaluate((id) => document.getElementById(id).querySelector('svg.stk-mark circle')?.getAttribute('stroke-width'), id);
  expect(w).toBe('4');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M4 작은 줄 — 편집 span 밖 · 편집 뒤 본문에 안 섞임', async ({ page }) => {
  const errs = await boot(page);
  const id = await add(page, { shape: 'circle', text: '저자극' });
  await panel(page, id);
  await setField(page, '#stk-sub-text', 'COMPLETED');
  const inside = await page.evaluate((id) => !!document.getElementById(id).querySelector('.sticker-text .sticker-sub'), id);
  expect(inside, '★작은 줄이 편집 span 안에 있다').toBe(false);
  await expect(page.locator(`#${id} .sticker-sub`)).toHaveText('COMPLETED');
  await page.dblclick(`#${id} .sticker-text`);
  await expect(page.locator(`#${id} .sticker-text`)).toHaveAttribute('contenteditable', 'true');
  /* 캐럿을 글 끝으로 «직접» — 더블클릭은 누른 자리에 캐럿을 둔다(sticker-select.js _enterStickerEdit caretRangeFromPoint)
     · macOS 의 End 는 캐럿을 안 옮기고 문서를 굴린다(인텔 62365fd02: «저자!극»). 이 칸이 재는 것은 «작은 줄이 본문에 안 섞임»이다. */
  await page.evaluate((id) => { const t = document.querySelector(`#${id} .sticker-text`); const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }, id);
  await page.keyboard.type('!');
  await page.evaluate(() => document.activeElement?.blur());
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.text, id)).toBe('저자극!');
  await expect(page.locator(`#${id} .sticker-sub`)).toHaveText('COMPLETED');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M5 [보안] 둘레 글자·작은 줄의 태그', async ({ page }) => {
  const errs = await boot(page);
  const id = await add(page, { shape: 'circle' });
  const r = await page.evaluate((id) => { const b = document.getElementById(id);
    b.dataset.ringText = '<script>window.__pwnR=1</script>'; b.dataset.subText = '<img src=x onerror="window.__pwnS=1">'; b.dataset.ringBorderW = '3'; b.dataset.ringBorderColor = '" onload="window.__pwnC=1';
    window.renderStickerBlock(b);
    return { scripts: b.querySelectorAll('script').length, imgs: b.querySelectorAll('img').length, on: [...b.querySelectorAll('*')].filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length,
      ring: b.querySelector('svg.stk-mark textPath')?.textContent, sub: b.querySelector('.sticker-sub')?.textContent }; }, id);
  expect([r.scripts, r.imgs, r.on]).toEqual([0, 0, 0]);
  expect(r.ring).toBe('<script>window.__pwnR=1</script>');
  expect(r.sub).toBe('<img src=x onerror="window.__pwnS=1">');
  expect(await page.evaluate(() => ['__pwnR', '__pwnS', '__pwnC'].filter((k) => window[k]))).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M6 마킹 블럭은 이 층 없음', async ({ page }) => {
  const errs = await boot(page);
  const id = await add(page, { shape: 'circle' });
  const n = await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.count = '1'; b.dataset.ringText = 'X'; b.dataset.subText = 'Y'; window.renderStickerBlock(b);
    return b.querySelectorAll('svg.stk-mark, .sticker-sub').length; }, id);
  expect(n).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M7 둘레 글자 모든 글자가 원 둘레 위 — 톱니·원 «PREMIUM QUALITY» · 실앱 값(크기 160 · 둘레 글자 크기 10)', async ({ page }) => {
  const errs = await boot(page);
  for (const shape of ['burst', 'circle']) {
    const id = await add(page, { shape, size: 160 });
    await panel(page, id);
    await setField(page, '#stk-ring-text', 'PREMIUM QUALITY');
    await setField(page, '#stk-ring-size-num', '10');
    const r = await page.evaluate((id) => {
      const b = document.getElementById(id), t = b.querySelector('svg.stk-mark text'), path = b.querySelector('svg.stk-mark defs path');
      /* 반지름은 0 지점에서 재지 않는다 — d 가 «M 50,50 m …» 라 0 지점이 빈 첫 하위경로(중심)일 수 있다(아이맥 7e27d1a80+패치: 전제 빨강).
         둘레 1/8~7/8 일곱 점으로 재고 값을 메시지에 싣는다. */
      const L = path.getTotalLength(), pts = [1, 2, 3, 4, 5, 6, 7].map((k) => path.getPointAtLength(L * k / 8)), ds = pts.map((p) => Math.hypot(p.x - 50, p.y - 50));
      const rad = ds.reduce((a, x) => a + x, 0) / ds.length, p0 = path.getPointAtLength(0);
      /* 글 길이 = 같은 글꼴·크기·자간의 «곧은» 글(경로에서 빠진 글자도 센다) — 옛 꼴(9시 시작 · 12시 = 25%)에서 첫 글자가 빠지는 조건 = 반 길이 > 둘레 25% */
      const probe = t.cloneNode(false); probe.textContent = t.textContent; t.parentNode.appendChild(probe);
      const len = probe.getComputedTextLength(); probe.remove();
      const n = t.getNumberOfChars(), off = [];
      for (let i = 0; i < n; i++) { const p = t.getStartPositionOfChar(i); const d = Math.hypot(p.x - 50, p.y - 50); if (Math.abs(d - rad) > 1) off.push(`${i}:${p.x.toFixed(1)},${p.y.toFixed(1)}`); }
      return { n, off, len: +len.toFixed(1), L: +L.toFixed(1), fs: t.getAttribute('font-size'), rad: +rad.toFixed(2), circle: rad > 10 && ds.every((x) => Math.abs(x - rad) < 1),
        info: `d=${path.getAttribute('d')} · L=${L.toFixed(1)} · p0=${p0.x.toFixed(1)},${p0.y.toFixed(1)} · p(L/4)=${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)} · 반지름들=${ds.map((x) => x.toFixed(1)).join('/')}` };
    }, id);
    expect(r.n, `${shape} 글자 수`).toBe('PREMIUM QUALITY'.length);
    expect(r.circle, `[전제] ${shape} 경로가 원 — ${r.info}`).toBe(true);
    expect(r.fs, `[전제] ${shape} 둘레 글자 크기 = 실앱 10`).toBe('10');
    if (shape === 'burst') expect(r.len / 2, `[전제] 톱니: 글 반 길이 > 둘레 25%(옛 꼴이면 첫 글자가 경로 앞으로 빠지는 조건) — 글 ${r.len} · 둘레 ${r.L}`).toBeGreaterThan(r.L * 0.25);
    expect(r.off, `★${shape} 둘레 밖 글자(반지름 ${r.rad} · ${r.info})`).toEqual([]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});
