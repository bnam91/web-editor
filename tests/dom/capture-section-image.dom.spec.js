/* capture-section-image.dom.spec.js — G11 ① 공용 찍기 captureSectionImage(sec) 를 «실제로 불러» 잰다(행동 검사)
 *
 * 까닭(10-05 측정 · MX0): 공용 찍기 첫 줄에 `return {ok:false}` 를 넣어도 단위 3 파일 0 빨강 · DOM 2 스펙(mockup-recapture-guard ·
 *   thumbnail-object-fit) 10 초록이었다 — 그 시험들은 «소스 글자»만 읽어 죽은 코드도 통과한다. 이 파일이 그 구멍을 막는다.
 * 길: bootApp(index.html 통째 · vendor html2canvas 실림) → 동적 import('/js/io/capture-safety.js')(effects-reflection R4 선례)
 *   — 앱이 쓰는 «같은 모듈»을 부른다 · 제품 쪽 window 노출 없음.
 * ⛔B1 은 그림 sha 를 «안» 본다 — 하네스 html2canvas 가 실앱과 같은 픽셀을 내는지는 안 쟀다(미측정 · 태양 · 10-05).
 *   그래서 «ok · PNG · 판정기 참 · 크기 · 남은 클론 0» 만 본다. 픽셀 같음(바이트)은 실앱 cap.mjs(G11-C1) 몫.
 * 양성대조(이름으로 · dom-lock 아래): MX0(본문 무력화) → B1 · MX1(클론 display:block 뺌) → B2 · MX2(빈 그림 가드 뺌) → B3 빨강
 *   · MX3(공용 겹 stripEditorOnlyForCapture 부름 한 줄 뺌 · 194 R3) → B5 빨강.
 * 머리표: [전제] = 재기 위한 조건. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="cS" data-section="1" style="background-color:#f4f6fb"><div class="section-hitzone"></div><div class="section-inner" id="cS-in"><div class="gap-block" data-type="gap" style="height:30px"></div></div></div>');
    const sec = document.getElementById('cS'); window.rebindAll?.(); window.deselectAll?.(); window.selectSection?.(sec);
    window.addTextBlock?.('h2');
    const tb = sec.querySelector('.text-block [contenteditable], .text-block [class^="tb-"]'); if (tb) tb.textContent = '캡처 행동 검사 제목';
    window.deselectAll?.();
  });
  const pre = await page.evaluate(async () => {
    const m = await import('/js/io/capture-safety.js');
    return { h2c: typeof window.html2canvas, judge: typeof window.isUsableImageDataUrl, fn: typeof m.captureSectionImage,
      text: !!document.querySelector('#cS .text-block') };
  });
  expect(pre, '[전제] html2canvas · 판정기 · 공용 찍기 함수 · 장면 글자').toEqual({ h2c: 'function', judge: 'function', fn: 'function', text: true });
  return errs;
}
/** 공용 찍기를 부르고 결과를 «잴 수 있는 꼴»로 돌려준다 */
const shoot = (page) => page.evaluate(async () => {
  const m = await import('/js/io/capture-safety.js');
  const sec = document.getElementById('cS');
  const r = await m.captureSectionImage(sec);
  const left = [...document.body.children].filter(e => e.classList?.contains('section-block') && /-99999px/.test(e.style.cssText)).length;
  let w = 0, h = 0;
  if (r.ok && r.dataUrl) { const im = new Image(); im.src = r.dataUrl; try { await im.decode(); w = im.naturalWidth; h = im.naturalHeight; } catch (_) {} }
  return { ok: r.ok, reason: r.reason ?? null, png: r.ok ? /^data:image\/png/.test(r.dataUrl) : null, usable: r.ok ? window.isUsableImageDataUrl(r.dataUrl) : null,
    w, h, left, srcDisplay: sec.style.display };
});

test('B0 [전제] 하네스가 html2canvas·판정기·공용 찍기를 싣는다', async ({ page }) => {
  const errs = await setup(page);
  expect(errs).toEqual([]);
});

test('B1 ★글자 섹션을 찍으면 ok · PNG · 판정기 참 · 폭 860×2 · 남은 클론 0', async ({ page }) => {
  const errs = await setup(page);
  const r = await shoot(page);
  expect(r.ok, `★공용 찍기가 실패를 돌려준다 ${JSON.stringify(r)}`).toBe(true);
  expect([r.png, r.usable], 'PNG · 쓸 만한 그림').toEqual([true, true]);
  expect(r.w, '디코드 폭 = 클론 폭 860 × scale 2').toBe(1720);
  expect(r.h, '디코드 높이 > 0').toBeGreaterThan(0);
  expect(r.left, '★찍은 뒤 body 에 화면 밖 클론이 남았다(finally 치우기)').toBe(0);
  expect(errs).toEqual([]);
});

test('B2 ★가드 ㉠ — 숨긴 섹션(display:none)을 다시 찍어도 ok · 원본은 그대로 숨김', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const s = document.getElementById('cS'); s.style.display = 'none'; s.dataset.mockupHidden = 'true'; });
  const r = await shoot(page);
  expect(r.ok, `★숨긴 섹션을 못 찍는다(클론 display:block 이 빠졌나) ${JSON.stringify(r)}`).toBe(true);
  expect(r.usable, '쓸 만한 그림').toBe(true);
  expect(r.srcDisplay, '원본 sec 의 display 는 안 건드린다').toBe('none');
  expect(r.left).toBe(0);
  expect(errs).toEqual([]);
});

test('B3 ★가드 ㉡ — 높이 0 섹션은 ok:false · degenerate(빈 그림을 «성공»으로 안 돌려준다)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const s = document.getElementById('cS'); s.querySelector('.section-inner').innerHTML = ''; s.style.height = '0px'; s.style.minHeight = '0px'; s.style.padding = '0'; });
  const r = await shoot(page);
  expect([r.ok, r.reason], `★빈 그림을 성공으로 돌려준다 ${JSON.stringify(r)}`).toEqual([false, 'degenerate']);
  expect(r.left).toBe(0);
  expect(errs).toEqual([]);
});

test('B4 html2canvas 가 없으면 ok:false · no-h2c', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const m = await import('/js/io/capture-safety.js'); const keep = window.html2canvas;
    window.html2canvas = undefined;
    try { return await m.captureSectionImage(document.getElementById('cS')); } finally { window.html2canvas = keep; }
  });
  expect([r.ok, r.reason]).toEqual([false, 'no-h2c']);
  expect(errs).toEqual([]);
});

/* ★194 R3(2026-10-29 지디 18:3x 처방 확정) — 목업 찍기가 공용 겹(stripEditorOnlyForCapture)을 안 불러 A/B 배지가 그림에 찍혔다.
   ★앱 실측(Electron · html2canvas 감쌈): 3/3 클론에 배지 1 · 결과 캔버스 그 자리 평균 픽셀 [63,123,234] ≈ 배지 배경 rgb(45,111,232).
   ★뿌리: 16a0798c «동작 무변 리팩터»가 옛 목업 줄을 옮겼고 공용 겹이 그 뒤에 자랐는데 안 따라갔다 ⇒ ⛔제 손 명부를 늘리지 말고 공용 겹을 부른다.
   자 = window.html2canvas 를 감싸(제품이 넘긴 클론·돌려받은 캔버스를 그대로 본다) ⑴ 클론의 배지 수 ⑵ 캔버스의 «배지 자리» 픽셀이 배지색인가
     ⑶ ★음성대조 = 같은 크기 «배지 없는 자리»(오른쪽 위 모서리)가 배지색으로 안 읽힌다 — 픽셀 자가 «아무 데나 맞다»고 하지 않는다.
   한 쌍: 고치기 전(333aa3d9) 빨강 · 고친 뒤 초록 · 고친 판에서 captureSectionImage 의 공용 겹 부름 한 줄 뺀 사본(MX3) → 빨강(태양 문턱 GO 뒤). */
test('B5 [새 것] A/B 배지 든 섹션을 찍으면 클론에 배지 0 · 그림의 배지 자리가 배지색이 아니다(음성대조 자리도 아님)', async ({ page }) => {
  const errs = await setup(page);
  const pre = await page.evaluate(() => {
    window.deselectAll?.(); window.createVariation(document.getElementById('cS'));   // 제품 함수 = 툴바 A/B 단추가 부르는 그것(section-variation.js :81)
    const s = document.getElementById('cS'); const b = s.querySelector(':scope > .variation-badge');
    if (!b) return { badge: false };
    const S = s.getBoundingClientRect(), R = b.getBoundingClientRect(), cs = getComputedStyle(b);
    const rgb = (cs.backgroundColor.match(/\d+/g) || []).slice(0, 3).map(Number);
    return { badge: true, shown: getComputedStyle(s).display !== 'none', rgb, secBg: getComputedStyle(s).backgroundColor,
      rel: { x: R.left - S.left, y: R.top - S.top, w: R.width, h: R.height }, secW: S.width };
  });
  expect(pre.badge, '[전제] 섹션에 A/B 배지가 바로 붙었다').toBe(true);
  expect(pre.shown, '[전제] 그 섹션이 보인다').toBe(true);
  expect(pre.rel.w > 4 && pre.rel.h > 4, `[전제] 배지가 자리를 차지한다 ${JSON.stringify(pre.rel)}`).toBe(true);
  const r = await page.evaluate(async (pre) => {
    const m = await import('/js/io/capture-safety.js'); const real = window.html2canvas; const seen = [];
    window.html2canvas = async function (el, opt) {
      const rec = { badges: el.querySelectorAll('.variation-badge').length, w: el.getBoundingClientRect().width };
      const c = await real.apply(this, arguments);
      const k = c.width / rec.w, g = c.getContext('2d');
      const mean = (x, y, w, h) => { const d = g.getImageData(Math.floor(x * k), Math.floor(y * k), Math.max(1, Math.floor(w * k)), Math.max(1, Math.floor(h * k))).data; const s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; } const n = d.length / 4; return s.map((v) => Math.round(v / n)); };
      rec.atBadge = mean(pre.rel.x, pre.rel.y, pre.rel.w, pre.rel.h);
      rec.atControl = mean(rec.w - pre.rel.x - pre.rel.w, pre.rel.y, pre.rel.w, pre.rel.h);   // 오른쪽 위 · 같은 크기 · 배지 없는 자리
      seen.push(rec); return c; };
    try { const res = await m.captureSectionImage(document.getElementById('cS')); return { ok: res.ok, seen }; } finally { window.html2canvas = real; }
  }, pre);
  expect(r.ok, '[전제] 찍기가 섰다').toBe(true);
  expect(r.seen.length, '[전제] 감싼 html2canvas 를 지났다(자가 산 판)').toBe(1);
  const dist = (a) => Math.hypot(a[0] - pre.rgb[0], a[1] - pre.rgb[1], a[2] - pre.rgb[2]);
  const [s] = r.seen;
  expect(dist(s.atControl), `[음성대조] 배지 없는 자리가 배지색으로 읽힌다 — 픽셀 자가 죽었다 ${JSON.stringify(s)} · 배지 ${pre.rgb}`).toBeGreaterThan(60);
  expect(s.badges, `클론에 A/B 배지가 남았다(공용 겹을 안 불렀나) ${JSON.stringify(s)}`).toBe(0);
  expect(dist(s.atBadge), `그림의 배지 자리가 배지색이다 = 배지가 찍혔다 ${JSON.stringify(s)} · 배지 ${pre.rgb}`).toBeGreaterThan(60);
  expect(errs).toEqual([]);
});
