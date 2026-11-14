/* anim-gif-v2-fx — GIF V2 새 효과 F1 도장 찍기 · F2 흐림→선명 · 블러 휩(현빈 GO 261114 · BRIEF-ty-gif-v2-261114).
 * ★잰다: 실제 모달(window.openAnimModal) · 실제 효과 목록 클릭 · 미리보기 캔버스의 fillText(글·x·그 순간 ctx.filter·알파).
 *   rAF 는 V1 스펙(anim-gif-v1-defects)과 같은 «엔진 것만 손으로» 꼴 — 원하는 시각(ms)의 프레임을 그리게 한다(고정 대기 0).
 *   두 줄 글(P076 꼴 «오늘 주문하면?» / «네!») — 블럭 전체 모드에선 모든 줄이 0ms 에 같이 시작한다.
 * V1 도장 S1 «도장 찍기» 항목이 있다 · 시작(0ms) = 두 줄 모두 흐림(filter blur) · 끝 = 두 줄 선명(none) · 알파 1 · 끝 x = 줄 시작(가운데 정렬 좌끝)
 * V2 흐림 B1 «흐림→선명» 시작 흐림 · 끝 선명
 * V3 휩   W1 «블러 휩» 중간 = 한 줄에 여러 번(잔상) + 본 글이 끝 자리보다 왼쪽 · 끝 = 줄마다 한 번 · 제자리
 * V4 [지킴] V1 «페이드인» 은 옛 길 그대로 — 끝 프레임 두 줄 · filter 없음
 * ── F3 줄마다 따로 ──
 * L1 P076 — «줄마다 따로» 진짜 클릭 → 행 2 · 줄0 타이핑 0/1000 · 줄1 도장 1100/560 을 진짜 입력 → data-anim-gif 그대로 ·
 *    미리보기 τ=500 엔 «네!» 0(답은 시작 전) · τ=1660 엔 두 줄 선명
 * L2 저장 — ⓑ 모달 안에서 바꾼 값 ⌘Z 한 번 = 직전 값 · ⓐ 닫은 뒤 저장값만 바꿔(메모리와 다르게, 이력 단언 없음) 다시 열면 그 값(900·2) · 저장 없는 다른 블럭 = 꺼짐
 * L3 남이 준 저장본 — fx 에 «<img onerror>» · 범위 밖 수 · 없는 줄 → 소독(fade-in · 5000 등) · 행 안에 img 0 · pageerror 0
 * ── F4 ── I1 한 바퀴 안내 — V1 슬라이드업 «한 바퀴 1.20초 · GIF 55프레임»(1200ms · 20fps 25 + 끝 멈춤 30) · 도장 «0.56초 · 43» · P076 줄별 «1.66초 · 65»
 *   양성대조: anim-gif-tracks.js gifFrameCount 의 «+ 1» 삭제 → I1 빨강(단위 E2 도 — srv 실측)
 * 양성대조(F3):
 *   · animation-engine.js _plan 의 `if (_perLine && _tracks) {` → `if (false) {` ⇒ L1(τ=500 에 «네!» 보임) 빨강
 *   · _loadAnimGif 를 openAnimModal 에서 빼면 ⇒ L2(다시 열면 꺼짐) 빨강
 * 셀렉터 대조(F3): #anim-per-line · #anim-tracks(index.html) · .anim-track-row/.anim-track-fx/.anim-track-at/.anim-track-dur(animation-engine.js _renderTrackRows className)
 * 양성대조:
 *   · js/animation-engine.js _plan 의 V2 갈래를 지우면(`if (!V2_FX.includes(_animType))` → `if (true)`) V1·V2·V3 빨강(옛 _drawFrame 에 새 효과 갈래 없음 = 글 0) · V4 초록
 *   · js/fx/anim-gif-tracks.js FX.stamp 의 `_blur(ctx, m.blur)` 삭제 → V1(시작 흐림) 빨강
 * 셀렉터 대조(제품 소스 grep): #anim-list .anim-item[data-id](animation-engine.js _buildAnimList `data-id="${a.id}"`) · #anim-preview-canvas(index.html · 엔진 getElementById) · window.openAnimModal(엔진 끝)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, html) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = html;
    ce.style.textAlign = 'center';
    window.__tb = tb;   // ★L·I 칸이 이 블럭을 읽는다(6d7a9ed85 에서 빠져 L1~L3 «undefined.dataset»)
    const realRaf = window.requestAnimationFrame.bind(window), realCaf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if ((new Error().stack || '').includes('animation-engine.js')) { window.__cb = cb; return -1; } return realRaf(cb); };
    window.cancelAnimationFrame = (id) => { if (id === -1) window.__cb = null; else realCaf(id); };
    const orig = CanvasRenderingContext2D.prototype.fillText;
    window.__calls = [];
    CanvasRenderingContext2D.prototype.fillText = function (s, x, y, ...rest) {
      if (this.canvas.id === 'anim-preview-canvas') window.__calls.push({ s: String(s), x, y, f: this.filter, a: this.globalAlpha });
      return orig.call(this, s, x, y, ...rest);
    };
    window.__at = (ms) => { window.__calls = []; const cb = window.__cb; window.__cb = null; cb(1000 + ms); return window.__calls; };
    window.openAnimModal(tb);
  }, html);
  return errs;
}
async function at(page, ms) {
  await page.waitForFunction(() => typeof window.__cb === 'function', null, { timeout: 5000 });
  return page.evaluate((ms) => window.__at(ms), ms);
}
async function pick(page, id) {
  await expect(page.locator(`#anim-list .anim-item[data-id="${id}"]`), `[전제] 목록에 ${id}`).toHaveCount(1);
  await page.click(`#anim-list .anim-item[data-id="${id}"]`);
  await at(page, 0);   // 첫 tick = 시작 시각을 박는다
}
const TWO = '오늘 주문하면?<br>네!';

test('V1 도장 찍기 — 시작 흐림 · 끝 두 줄 선명·제자리', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'stamp');
  const f0 = await at(page, 0);
  expect(f0.length, '[전제] 시작 프레임에 글을 그렸다').toBeGreaterThan(0);
  expect(f0.every((c) => /^blur\(/.test(c.f)), `★시작이 흐리지 않다 ${JSON.stringify(f0.map((c) => c.f))}`).toBe(true);
  const fz = await at(page, 5000);
  expect(fz.map((c) => [c.s, c.f, c.a])).toEqual([['오늘 주문하면?', 'none', 1], ['네!', 'none', 1]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 흐림→선명 — 시작 흐림 · 끝 선명', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'blur-in');
  const f0 = await at(page, 0);
  expect(f0.length > 0 && f0.every((c) => /^blur\(/.test(c.f))).toBe(true);
  const fz = await at(page, 5000);
  expect(fz.map((c) => [c.s, c.f])).toEqual([['오늘 주문하면?', 'none'], ['네!', 'none']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V3 블러 휩 — 중간 잔상(한 줄에 여러 번) · 본 글은 끝 자리보다 왼쪽 · 끝 = 줄마다 한 번 제자리', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'blur-whip');
  const fm = await at(page, 150);
  const fz = await at(page, 5000);
  expect(fz.map((c) => c.s)).toEqual(['오늘 주문하면?', '네!']);
  const endX = fz.find((c) => c.s === '네!').x;
  const mid = fm.filter((c) => c.s === '네!');
  expect(mid.length, '★중간에 잔상이 없다').toBeGreaterThan(1);
  expect(mid[mid.length - 1].x, '★본 글이 아직 왼쪽에 있어야 한다').toBeLessThan(endX - 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V4 [지킴] V1 페이드인은 옛 길 — 끝 두 줄 · 흐림 없음', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'fade-in');
  const fz = await at(page, 1200);
  expect(fz.map((c) => c.s)).toEqual(['오늘 주문하면?', '네!']);
  expect(fz.every((c) => c.f === 'none')).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function setRow(page, i, { fx, at, dur }) {
  const row = `#anim-tracks .anim-track-row[data-line="${i}"]`;
  await page.selectOption(`${row} .anim-track-fx`, fx);
  await page.fill(`${row} .anim-track-at`, String(at)); await page.dispatchEvent(`${row} .anim-track-at`, 'change');
  await page.fill(`${row} .anim-track-dur`, String(dur)); await page.dispatchEvent(`${row} .anim-track-dur`, 'change');
}
const P076 = [{ line: 0, fx: 'typewriter', at: 0, dur: 1000 }, { line: 1, fx: 'stamp', at: 1100, dur: 560 }];

test('L1 P076 — 줄마다 따로 · 질문 타이핑 · 답 도장(1100ms 부터)', async ({ page }) => {
  const errs = await scene(page, TWO);
  await page.check('#anim-per-line');
  await expect(page.locator('#anim-tracks .anim-track-row')).toHaveCount(2);
  await setRow(page, 0, P076[0]);
  await setRow(page, 1, P076[1]);
  expect(await page.evaluate(() => JSON.parse(window.__tb.dataset.animGif).tracks)).toEqual(P076);
  await at(page, 0);
  const mid = await at(page, 500);
  expect(mid.length, '[전제] 질문은 치는 중').toBeGreaterThan(0);
  expect(mid.some((c) => c.s === '네!'), '★답이 시작 전에 보인다').toBe(false);
  const end = await at(page, 1660);
  expect(end.filter((c) => c.s === '오늘 주문하면?' || c.s === '네!').map((c) => [c.s, c.f])).toEqual([['오늘 주문하면?', 'none'], ['네!', 'none']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L2 저장 — ⓑ 모달 안에서 바꾼 값 ⌘Z 한 번 = 직전 값 · ⓐ 다시 열면 «저장값»을 읽는다(메모리와 다르게) · 저장 없는 블럭 = 꺼짐', async ({ page }) => {
  const errs = await scene(page, TWO);
  // ⓑ 이력 — 모달 «안에서» 바꿔 이력에 싣고 ⌘Z (손으로 고친 dataset 은 이력 밖이라 이 축에 섞지 않는다)
  await page.check('#anim-per-line');
  await setRow(page, 1, P076[1]);
  const before = await page.evaluate(() => window.__tb.dataset.animGif);
  await setRow(page, 1, { ...P076[1], dur: 800 });
  expect(await page.evaluate(() => window.__tb.dataset.animGif)).not.toBe(before);
  await page.evaluate(() => { window.closeAnimModal(); document.activeElement?.blur?.(); });   // 숨은 입력칸에 포커스가 남으면 ⌘Z 가 그 칸의 글자 되돌리기로 간다
  const id = await page.evaluate(() => window.__tb.id);
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(({ id, before }) => document.getElementById(id)?.dataset.animGif === before, { id, before }, { timeout: 5000 });
  // ⓐ 다시 열기 — 저장값만 바꿔(메모리 _tracks·_perLine 과 다르게) 연다 · 이력 단언 없음
  //   (모듈 변수가 닫아도 남아, 같은 값이면 저장을 안 읽어도 초록이었다 — 인텔 G4 = _loadAnimGif 빼도 옛 L2 초록)
  const r = await page.evaluate((id) => {
    const tb = document.getElementById(id); window.__tb = tb;   // ⌘Z 가 블럭을 갈아 끼웠을 수 있다 — id 로 다시 잡는다
    const o = JSON.parse(tb.dataset.animGif); o.tracks[1].dur = 900; o.speed = 2;
    tb.dataset.animGif = JSON.stringify(o);
    window.openAnimModal(tb);
    return { checked: document.getElementById('anim-per-line').checked, dur: document.querySelector('#anim-tracks .anim-track-row[data-line="1"] .anim-track-dur')?.value, speed: document.getElementById('anim-speed').value };
  }, id);
  expect(r, '★다시 열 때 저장값을 안 읽었다').toEqual({ checked: true, dur: '900', speed: '2' });
  // 저장 없는 다른 블럭 = 꺼짐(앞 블럭 메모리를 끌고 오지 않는다 — 이것도 저장값을 읽어야 참)
  const off = await page.evaluate(() => {
    window.closeAnimModal();
    const sec = document.querySelector('#canvas .section-block'); window.selectSection(sec); window.addTextBlock('body');
    const tb2 = [...sec.querySelectorAll('.text-block')].pop(); (tb2.querySelector('[contenteditable]') || tb2.querySelector('.tb-body')).textContent = '다른 글';
    window.openAnimModal(tb2);
    return { checked: document.getElementById('anim-per-line').checked, rows: document.querySelectorAll('#anim-tracks .anim-track-row').length, saved: tb2.dataset.animGif ?? null };
  });
  expect(off).toEqual({ checked: false, rows: 0, saved: null });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L3 남이 준 저장본 — 소독 · 행 안에 img 0', async ({ page }) => {
  const errs = await scene(page, TWO);
  await page.evaluate(() => {
    window.closeAnimModal();
    window.__tb.dataset.animGif = JSON.stringify({ v: 2, tracks: [{ line: 0, fx: '<img src=x onerror="window.__pwn=1">', at: -5, dur: 1e9 }, { line: 9, fx: 'stamp' }], speed: 99, repeat: 0 });
    window.openAnimModal(window.__tb);
  });
  await expect(page.locator('#anim-per-line')).toBeChecked();
  const r = await page.evaluate(() => ({
    fx: [...document.querySelectorAll('#anim-tracks .anim-track-fx')].map((s) => s.value),
    at: [...document.querySelectorAll('#anim-tracks .anim-track-at')].map((s) => s.value),
    img: document.querySelectorAll('#anim-tracks img').length, pwn: window.__pwn ?? 0, speed: document.getElementById('anim-speed').value,
  }));
  expect(r).toEqual({ fx: ['fade-in', 'fade-in'], at: ['0', '5000'], img: 0, pwn: 0, speed: '3' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('I1 한 바퀴 안내 — 효과·줄별 길이와 GIF 프레임 수', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'slide-up');
  await expect(page.locator('#anim-loop-info')).toHaveText('한 바퀴 1.20초 · GIF 55프레임');
  await pick(page, 'stamp');
  await expect(page.locator('#anim-loop-info')).toHaveText('한 바퀴 0.56초 · GIF 43프레임');
  await page.check('#anim-per-line');
  await setRow(page, 0, P076[0]);
  await setRow(page, 1, P076[1]);
  await expect(page.locator('#anim-loop-info')).toHaveText('한 바퀴 1.66초 · GIF 65프레임');
  expect(errs, errs.join(' | ')).toEqual([]);
});
