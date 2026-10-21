/* radial-t4-a-colors — S6 t4 ⒜ (t4-02 선 색 · t4-04 앞 절반 가운데 기본값) · 2026-10-21
 *
 * 현빈 원문(T4-ORIGINAL.txt):
 *   t4-02 「선 색이 왜 이걸로 되어있는지? C9BDF5이걸로 되어있는데 점색과 통일시켜줘 c9cdd6」
 *     ⇒ 점 색의 참값은 #c8cdd6 이다(radial-block.js 의 dotColor · 지디 확정). 선 색 기본 = 점 색.
 *   t4-04 「최초에 핵심효능 6가지라는 텍스트도 바꿔줘. 6B4DE0 배경색도 없애줘」
 *     ⇒ (해석) 가운데 글 저장값 '' + 안내문구 «내용을 입력하세요»(인용구 블럭 규약) · 가운데 배경 투명 · 그림자 없음 · 글자 색 #222222.
 *
 * 블럭은 «실제 문»으로 만든다 — 떠 있는 툴바 Component ▾ → 「Radial」(index.html 의 addRadialBlock 버튼).
 * 칸:
 *   P0 판 정체 — EXPECT_SHA(40 hex) = git -C ROOT rev-parse HEAD · 페이지가 받은 radial-block.js 바이트의 sha1
 *      = ROOT 디스크 파일 sha1 = EXPECT_FILE_SHA1(40 hex). (레인은 미커밋이라 핀과 HEAD 가 같다 — 파일 sha1 이 둘을 가른다.)
 *   A1 새 원 블럭 선 색 = 점 기본색 — .rdl-line stroke · dataset.lineColor · 패널 「선 색」 hex = c8cdd6 = RADIAL_DEFAULTS.dotColor
 *   A2 패널 「호」 뒤 — .rdl-line 계산 stroke = .rdl-cell--dot 계산 backgroundColor = rgb(200, 205, 214)
 *   A3 가운데 배경 없음 — .rdl-center 계산 backgroundColor rgba(0, 0, 0, 0) · boxShadow none · dataset.centerBg '' 또는 transparent
 *   A4 가운데 기본 글 = 안내문구 — dataset.centerText '' · [data-is-placeholder="true"] 1개 · 글 «내용을 입력하세요» · 흐림 0.45 · «핵심 효능» 0
 *   A5 글자 색이 흰색이 아니다 — 계산 color ≠ rgb(255, 255, 255) · = 라벨 색 rgb(34, 34, 34)
 * 좌표는 waitStableRect 로 멈춘 뒤 «두 번» 재서 같을 때만 누른다(고정 대기 없음). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const ID_FILE = 'js/blocks/radial-block.js';
const DOT_HEX = '#c8cdd6';
const DOT_RGB = 'rgb(200, 205, 214)';
const PH = '내용을 입력하세요';
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

/** 멈춘 사각형을 두 번 재서 같은지 본다 — 다르면 빨강(옛 좌표로 누르지 않는다). */
async function stableTwice(page, sel, opts = {}) {
  const a = await waitStableRect(page, sel, opts);
  const b = await waitStableRect(page, sel, opts);
  expect([b.left, b.top, b.width, b.height], `${sel}[${opts.index || 0}] 두 번 잰 사각형이 같다`).toEqual([a.left, a.top, a.width, a.height]);
  expect(a.width > 0 && a.height > 0, `${sel} 크기가 있다`).toBe(true);
  return b;
}

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const secId = await page.evaluate(async () => {
    await document.fonts?.ready;
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection?.();
    const sec = c.querySelector('.section-block');
    window.deselectAll?.();
    window.selectSection?.(sec);
    window.clearHistory?.();
    return sec?.id || null;
  });
  expect(secId, '전제: 섹션이 하나 있다').toBeTruthy();
  return { errs, secId };
}

/** Component ▾ → 「Radial」 을 진짜로 눌러 원 블럭 하나를 만든다. */
async function makeRadial(page) {
  const { errs, secId } = await setup(page);
  const trig = '#fp-component-dropdown .fp-dropdown-trigger';
  const t = await stableTwice(page, trig);
  await clickAt(page, t.cx, t.cy, { sel: trig }, { label: 'Component 펼치기' });
  await expect(page.locator('#fp-component-dropdown')).toHaveClass(/open/);
  const idx = await page.evaluate(() => [...document.querySelectorAll('#fp-component-menu .fp-menu-item')].findIndex((b) => b.textContent.trim() === 'Radial'));
  expect(idx, '전제: 삽입 메뉴에 「Radial」 이 있다').toBeGreaterThanOrEqual(0);
  const r = await stableTwice(page, '#fp-component-menu .fp-menu-item', { index: idx });
  const hit = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y)?.textContent || '').trim(), [r.cx, r.cy]);
  expect(hit, '누를 자리 = 「Radial」').toBe('Radial');
  await clickAt(page, r.cx, r.cy, { sel: '#fp-component-menu .fp-menu-item' }, { label: 'Radial 누르기' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .radial-block').length), { message: '전제: 방사형 블럭 1개' }).toBe(1);
  const id = await page.evaluate(() => document.querySelector('#canvas .radial-block').id);
  await page.waitForFunction((bid) => !!document.querySelector(`[id="${bid}"] > .rdl-stage`), id, { timeout: 15000 });
  await stableTwice(page, `[id="${id}"]`);
  const st = await page.evaluate((bid) => { const b = document.getElementById(bid); return { shape: b.dataset.shape, sec: b.closest('.section-block')?.id || null }; }, id);
  expect(st, '전제: 고른 섹션에 원 블럭').toEqual({ shape: 'circle', sec: secId });
  return { errs, id };
}

test.describe('S6 t4 ⒜ radial 기본 색 · 가운데', () => {
  test('P0 판 정체 — HEAD = EXPECT_SHA · 페이지가 받은 radial-block.js sha1 = 디스크 = EXPECT_FILE_SHA1', async ({ page }) => {
    const want = process.env.EXPECT_SHA || '';
    const wantFile = process.env.EXPECT_FILE_SHA1 || '';
    expect(/^[0-9a-f]{40}$/.test(want), `EXPECT_SHA 는 40 hex — 받은 값 «${want}»`).toBe(true);
    expect(/^[0-9a-f]{40}$/.test(wantFile), `EXPECT_FILE_SHA1 은 40 hex — 받은 값 «${wantFile}»`).toBe(true);
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(head, `git -C ${ROOT} rev-parse HEAD`).toBe(want);
    const disk = sha1(fs.readFileSync(path.join(ROOT, ID_FILE)));
    const errs = await bootApp(page);
    const b64 = await page.evaluate(async (rel) => {
      const res = await fetch('/' + rel, { cache: 'no-store' });
      if (!res.ok) return null;
      const u8 = new Uint8Array(await res.arrayBuffer());
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }, ID_FILE);
    expect(b64, '전제: 페이지가 파일을 받았다').toBeTruthy();
    const served = sha1(Buffer.from(b64, 'base64'));
    expect(served, '페이지가 받은 바이트 = 디스크 파일').toBe(disk);
    expect(served, '페이지가 받은 바이트 = EXPECT_FILE_SHA1').toBe(wantFile);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A1 새 원 블럭 선 색 = 점 기본색 #c8cdd6 (stroke · dataset · 패널 hex)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await expect(page.locator('#rdl-line-hex'), '전제: 패널 「선 색」 칸이 열렸다').toHaveCount(1);
    const m = await page.evaluate(async (bid) => {
      const mod = await import('/js/blocks/radial-block.js');
      const b = document.getElementById(bid);
      const lines = b.querySelectorAll('.rdl-line');
      return { lines: lines.length, stroke: (lines[0]?.getAttribute('stroke') || '').toLowerCase(), ds: (b.dataset.lineColor || '').toLowerCase(),
        hex: (document.getElementById('rdl-line-hex')?.value || '').toLowerCase(), dotDefault: String(mod.RADIAL_DEFAULTS.dotColor).toLowerCase() };
    }, id);
    expect(m.lines, '전제: 선 1개').toBe(1);
    expect(m.dotDefault, '점 기본색(참값)').toBe(DOT_HEX);
    expect(m.stroke, '.rdl-line stroke = 점 기본색').toBe(DOT_HEX);
    expect(m.ds, 'dataset.lineColor = 점 기본색').toBe(DOT_HEX);
    expect(m.hex, '패널 「선 색」 hex = 점 기본색').toBe(DOT_HEX.slice(1));
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A2 패널 「호」 뒤 — 선의 화면 색 = 점의 화면 색 rgb(200, 205, 214)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const r = await stableTwice(page, '#rdl-shape-arc');
    await clickAt(page, r.cx, r.cy, { sel: '#rdl-shape-arc' }, { label: '패널 「호」' });
    await page.waitForFunction((bid) => !!document.querySelector(`[id="${bid}"] > .rdl-stage--arc .rdl-cell--dot`), id, { timeout: 15000 });
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const line = b.querySelector('.rdl-line');
      const dots = [...b.querySelectorAll('.rdl-cell--dot')];
      return { shape: b.dataset.shape, line: line ? getComputedStyle(line).stroke : null, dots: dots.length, dotBgs: [...new Set(dots.map((d) => getComputedStyle(d).backgroundColor))] };
    }, id);
    expect(m.shape, '전제: 호로 바뀌었다').toBe('arc');
    expect(m.dots, '전제: 점이 있다').toBeGreaterThan(0);
    expect(m.dotBgs, '점 색 한 가지 = rgb(200, 205, 214)').toEqual([DOT_RGB]);
    expect(m.line, '선의 계산 stroke = 점의 계산 색').toBe(m.dotBgs[0]);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A3 새 원 블럭 가운데 — 배경 투명 · 그림자 없음', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const cs = [...b.querySelectorAll('.rdl-center')];
      const c = cs[0];
      return { n: cs.length, mode: b.dataset.centerMode, ds: b.dataset.centerBg, bg: c ? getComputedStyle(c).backgroundColor : null, shadow: c ? getComputedStyle(c).boxShadow : null };
    }, id);
    expect(m.n, '전제: 가운데 1개').toBe(1);
    expect(m.mode, '전제: 가운데 = 글').toBe('text');
    expect(m.bg, '가운데 계산 배경 = 투명').toBe('rgba(0, 0, 0, 0)');
    expect(m.shadow, '가운데 그림자 = none').toBe('none');
    expect(['', 'transparent'], `dataset.centerBg 는 '' 또는 transparent — 실제 «${m.ds}»`).toContain(m.ds);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A4 가운데 기본 글 = 안내문구 «내용을 입력하세요» (저장값 \'\' · 흐림 · 옛 글 0)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const phs = [...b.querySelectorAll('.rdl-center [data-is-placeholder="true"]')];
      return { ds: b.dataset.centerText, n: phs.length, text: phs[0] ? phs[0].textContent : null, opacity: phs[0] ? getComputedStyle(phs[0]).opacity : null,
        old: (b.textContent.match(/핵심 효능/g) || []).length };
    }, id);
    expect(m.ds, 'dataset.centerText = \'\'').toBe('');
    expect(m.n, '안내문구 표식 1개').toBe(1);
    expect(m.text, '안내문구 글').toBe(PH);
    expect(m.opacity, '인용구 블럭과 같은 흐림(editor-blocks.css #canvas [data-is-placeholder])').toBe('0.45');
    expect(m.old, '«핵심 효능» 0건').toBe(0);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A5 가운데 글자 색 ≠ 흰색 (= 라벨 색 #222222)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const c = b.querySelector('.rdl-center');
      return { color: c ? getComputedStyle(c).color : null, ds: b.dataset.centerColor };
    }, id);
    expect(m.color, '전제: 가운데가 있다').not.toBeNull();
    expect(m.color, '글자 색이 흰색이 아니다').not.toBe('rgb(255, 255, 255)');
    expect(m.color, '글자 색 = 라벨 색').toBe('rgb(34, 34, 34)');
    expect(m.ds, 'dataset.centerColor').toBe('#222222');
    expect(errs, 'pageerror').toEqual([]);
  });
});
