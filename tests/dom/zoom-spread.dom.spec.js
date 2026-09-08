/* zoom-spread.dom — 「벌림이 도형 선을 따라 미끄러지나」의 진짜 끝(런타임). 2026-09-08 신설
 *
 * ★왜 dom 이 따로 필요한가
 *   좌표 산식은 tests/unit/zoom-spread-outline.test.mjs 가 «실행»으로 잰다.
 *   여기서 잴 것은 둘이다 — 소스로는 못 재는 것들:
 *     D1 핸들이 «실제로 보라로 그려지나» (getComputedStyle. 소스 문자열이 아니다)
 *     D2 «슬라이더를 진짜 움직이면» 사다리꼴 점이 «둘레를 따라» 옮겨 가나
 *
 * ★D2 가 A·B 를 어떻게 읽나 — 첫 띠 <polygon> 의 «앞 두 점»이 곧 A·B 다.
 *   strips() 가 t0=0 에서 L0=lerp(A,a,0)=A, R0=lerp(B,b,0)=B 를 찍기 때문이다.
 *   좌표계는 도형 중심(0,0) 기준이라 viewBox 가 바뀌어도 «값끼리» 맞댈 수 있다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   (zoom-drop-shadow.dom.spec.js 의 page.route 하네스를 그대로 쓴다.)
 *
 * 실행: npm run test:dom
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ⚠️css/editor-base.css 를 «같이» 얹는다 — 안 얹으면 --ui-sel-overlay 가 안 살아
     stroke 가 빈 값/검정으로 읽힌다(이 레포가 이미 두 번 물린 함정). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px;height:520px"></div></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body" id="propPanel"></div></div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/blocks/zoom-block.js';
  import { showZoomProperties } from '/js/props/prop-zoom.js';
  window.__open = showZoomProperties;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 확대블럭 하나를 캔버스에 올린다. 기본 = rect 260(=260×140) · 광원 켬 · 테두리 없음. */
async function mount(page, ds = {}) {
  await page.evaluate((ds) => {
    document.getElementById('host').innerHTML = '';
    const z = document.createElement('div');
    z.className = 'zoom-block selected';
    Object.assign(z.dataset, {
      shape: 'rect', size: '260', x: '260', y: '200',
      shadow: 'on', angle: '0', length: '170', spread: '0',
      maxop: '30', curve: '100', narrow: '62', bd: 'off', fill: '#4a7cff',
    }, ds);
    document.getElementById('host').appendChild(z);
    window.renderZoomBlock(z);
    window.__z = z;
  }, ds);
}

/** 첫 띠 polygon 의 앞 두 점 = A·B (도형 중심 좌표계). */
const readAB = (page) => page.evaluate(() => {
  const poly = window.__z.querySelector('.zoom-shadow > polygon');
  if (!poly) return null;
  const n = poly.getAttribute('points').trim().split(/\s+/).slice(0, 2)
    .map(s => s.split(',').map(Number));
  return { A: { x: n[0][0], y: n[0][1] }, B: { x: n[1][0], y: n[1][1] },
           spread: Number(window.__z.dataset.spread) };
});

/* rect 260 · 테두리 없음 ⇒ 반치수 130 × 70. 「윤곽 위」 = 네 변 중 하나에 얹혀 있다. */
const HW = 130, HH = 70;
function onRect(P) {
  const dx = Math.min(Math.abs(P.x - HW), Math.abs(P.x + HW));
  const dy = Math.min(Math.abs(P.y - HH), Math.abs(P.y + HH));
  const inside = Math.abs(P.x) <= HW + 0.5 && Math.abs(P.y) <= HH + 0.5;
  return { on: inside && Math.min(dx, dy) < 0.5, inside, dx, dy };
}

/* ── D1 ★손잡이가 «실제로» 제 색으로 그려진다 ────────────────────────────────
   ★2 → 3 : «요구가 바뀌었다»(현빈 승인 2026-09-09 「손잡이 셋」). 그리고 색이 «둘»이 됐다 —
     빛(L)=빨강(--ui-danger) · a·b=보라(--ui-sel-overlay). 하는 일이 다르면 색도 다르다.
   ⇒ 「전부 보라」로 훑던 루프를 «갈래별»로 나눈다. 안 나누면 빨강을 되돌려도 못 잡는다. */
test('D1 ★손잡이 색이 렌더 시점에 갈린다 — a·b 보라 / ★빛 빨강. 소스 문자열이 아니라 «칠»을 잰다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);

  const got = await page.evaluate(() => {
    const hs = [...window.__z.querySelectorAll('.zoom-handle')];
    const cs = getComputedStyle(document.documentElement);
    const probe = document.createElement('span');           // 토큰을 «실제 색»으로 풀어 본다
    document.body.appendChild(probe);
    const px = (tok) => { probe.style.color = ''; probe.style.color = `var(${tok})`; return getComputedStyle(probe).color; };
    const 보라 = px('--ui-sel-overlay'), 파랑 = px('--sel-color'), 빨강 = px('--ui-danger');
    const out = { 이름: hs.map(h => h.dataset.pt), 보라, 파랑, 빨강,
                  stroke: hs.map(h => getComputedStyle(h).stroke) };
    hs.forEach(h => h.setAttribute('data-picked', 'true'));
    out.집힌fill = hs.map(h => getComputedStyle(h).fill);
    probe.remove();
    return out;
  });

  // T0 ★입력이 살아 있다 — 잴 대상이 «있고», 세 색이 «실제로 다르다»
  expect(got.이름, '손잡이가 셋(a·b·빛)이 아니다 — 아래 단언이 빈 배열을 훑고 조용히 통과한다')
    .toEqual(['a', 'b', 'L']);
  expect(got.보라, '--ui-sel-overlay 토큰이 안 풀렸다 (editor-base.css 를 안 얹었다)').toMatch(/^rgb/);
  expect(got.파랑, '--sel-color 토큰이 안 풀렸다').toMatch(/^rgb/);
  expect(got.빨강, '--ui-danger 토큰이 안 풀렸다').toMatch(/^rgb/);
  expect(got.보라, '두 토큰이 «같은 색»이다 — 그러면 이 검사는 되돌림을 못 잡는다').not.toBe(got.파랑);
  expect(got.빨강, '★빛과 a·b 가 «같은 색»이면 손잡이 셋이 구별되지 않는다').not.toBe(got.보라);

  /* ★갈래별로 잰다 — 「전부 보라」로 훑으면 빛의 빨강을 되돌려도 안 잡힌다. */
  const 기대 = { a: got.보라, b: got.보라, L: got.빨강 };
  got.이름.forEach((pt, i) => {
    expect(got.stroke[i], `${pt} 손잡이 테두리 (${got.stroke[i]} · 보라=${got.보라} · 빨강=${got.빨강})`)
      .toBe(기대[pt]);
    expect(got.집힌fill[i], `${pt} 를 집었을 때 채움 (${got.집힌fill[i]})`).toBe(기대[pt]);
  });
  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});

/* ── D2 ★슬라이더를 «진짜» 움직이면 점이 둘레를 탄다 ─────────────────────── */
test('D2 ★벌림 슬라이더를 실제로 움직이면 A·B 가 «도형 선 위»를 미끄러진다 (허공으로 안 나간다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await page.evaluate(() => window.__open(window.__z));

  const slider = page.locator('#zm-spread');
  await expect(slider, '벌림 슬라이더가 패널에 없다 — 아래는 잴 것이 없다').toHaveCount(1);

  // T0 ★입력이 살아 있다 — 사다리꼴이 «그려져» 있고 좌표가 숫자다
  const base = await readAB(page);
  expect(base, '광원 사다리꼴 polygon 이 없다 — A·B 를 읽을 자리가 없다').not.toBeNull();
  expect(Number.isFinite(base.A.x) && Number.isFinite(base.A.y), `A 가 숫자가 아니다: ${JSON.stringify(base.A)}`).toBe(true);
  expect(onRect(base.A).on, `spread 0 에서 A 가 이미 윤곽 밖: ${JSON.stringify(base.A)}`).toBe(true);
  expect(Math.hypot(base.A.x - HW, base.A.y - HH), 'spread 0 의 A 가 오른쪽 아래 꼭짓점이 아니다').toBeLessThan(0.5);

  /* ★슬라이더를 «진짜» 움직인다 — dataset 을 손으로 쓰지 않는다.
     ⚠️fill() 은 range 입력에 input+change 를 둘 다 낸다(bindPair 가 input 으로 다시 그린다). */
  await slider.fill('300');
  await expect.poll(async () => (await readAB(page)).spread, { timeout: 2000 }).toBe(300);
  const mid = await readAB(page);

  expect(Math.hypot(mid.A.x - base.A.x, mid.A.y - base.A.y), '슬라이더를 움직였는데 A 가 안 움직였다')
    .toBeGreaterThan(10);
  expect(onRect(mid.A).on, `A 가 윤곽에서 떴다(허공) — 직선 밀어내기로 되돌아갔다: ${JSON.stringify(mid.A)}`).toBe(true);
  expect(onRect(mid.B).on, `B 가 윤곽에서 떴다: ${JSON.stringify(mid.B)}`).toBe(true);
  // ★옛 모델이었다면 |y| 가 70+150 = 220 이었다. 「윤곽 위」 단언이 그것을 잡는다는 증거:
  expect(Math.abs(mid.A.y), 'A 가 도형 세로 반치수 밖으로 나갔다 = 허공').toBeLessThanOrEqual(HH + 0.5);
  // 아래 변을 «왼쪽으로» 150 갔다 (둘레거리 spread/2)
  expect(Math.abs(mid.A.x - (HW - 150)), `아래 변 위를 150 만큼 안 갔다: x=${mid.A.x}`).toBeLessThan(0.5);

  // ★모서리를 넘어간다 — spread 700 ⇒ 둘레 350 > 아래 변 260
  await slider.fill('700');
  await expect.poll(async () => (await readAB(page)).spread, { timeout: 2000 }).toBe(700);
  const far = await readAB(page);
  expect(onRect(far.A).on, `모서리 넘은 뒤 윤곽 밖: ${JSON.stringify(far.A)}`).toBe(true);
  expect(Math.abs(far.A.x + HW), `왼쪽 변으로 못 넘어갔다(모서리에서 멈췄다): ${JSON.stringify(far.A)}`).toBeLessThan(0.5);

  // ★마그네틱 — 꼭짓점(둘레 260 ⇒ spread 520) 근처에서 «슬라이더를 움직여도 안 움직인다»
  const seen = [];
  for (const v of ['504', '520', '536']) {
    await slider.fill(v);
    await expect.poll(async () => (await readAB(page)).spread, { timeout: 2000 }).toBe(Number(v));
    seen.push((await readAB(page)).A);
  }
  for (const P of seen) {
    expect(Math.hypot(P.x - seen[0].x, P.y - seen[0].y), `걸림 구간인데 움직였다: ${JSON.stringify(P)}`).toBeLessThan(1e-6);
  }
  expect(Math.hypot(seen[0].x + HW, seen[0].y - HH), '걸린 자리가 «꼭짓점»이 아니다').toBeLessThan(0.5);

  // ★그리고 «넘어간다» — 스냅(영구 부착)이 아니다
  await slider.fill('600');
  await expect.poll(async () => (await readAB(page)).spread, { timeout: 2000 }).toBe(600);
  const past = await readAB(page);
  expect(Math.abs(past.A.y - HH), `꼭짓점에 붙어 버렸다(스냅): ${JSON.stringify(past.A)}`).toBeGreaterThan(20);
  expect(onRect(past.A).on, '넘어간 뒤 윤곽 밖').toBe(true);

  expect(errs, `콘솔 오류: ${errs.join(' | ')}`).toEqual([]);
});
