/* fx-particles-section — 섹션 배경 파티클이 ★내보내기 두 경로에 «산다» (2026-10-07 지디 발주 ㉡)
 *
 * ★무엇을 잠그나
 *   S0 ★전제 — 배선이 섰다(ParticlesFx·FxSeed·applySectionParticles 가 window 에 있다 · 콘솔 오류 0)
 *   S1 ★PNG(CDP 오프스크린 fixed = export-image.js:249 와 같은 꼴)에 파티클이 산다
 *   S2 ★썸네일(html2canvas · save-load.js captureThumbnail 과 같은 옵션)에 산다
 *   S3 ★후광(SVG filter)이 ★두 경로 다 산다 — ★모자이크가 죽은 자리를 «구조»로 막는 칸이다
 *   S4 ★두 경로가 ★갈리지 않는다(같은 자로 잰 수가 가깝다)
 *   S5 ★음성대조 — 갯수 0 이면 ★두 경로 다 «배경 그대로»
 *
 * ★★자를 «켜진 픽셀 수»로 둔다 — ⛔측정점을 미리 고르지 않는다
 *   까닭: 입자 위치가 ★시드에서 난다 ⇒ ★「후광 자리는 중심에서 15%」 같은 ★고정 점을 ★못 쓴다
 *     (글로우 spec `fx-glow-sticker.dom.spec.js:186~188` 이 그 점 고르기로 한 번 애를 먹었다 —
 *      거기선 스티커가 ★한 자리에 있어 가능했지만 ★여기선 아니다).
 *   ⇒ ★태양 M1 이 쓴 자를 그대로 쓴다: ★「배경과 휘도 차가 8 보다 큰 픽셀 수」(px8).
 *     ★대조는 ★같은 클론 안의 ★다른 섹션이다 — ⛔다른 판이 아니라 «같은 판 다른 조건».
 *
 * ★★★문턱(THRESH) — ★★2026-10-07 현재 ★미측정이다. ⛔「쟀다」로 읽지 마라.
 *   ★글로우가 그 흠을 겪었다(위 `:188`): 「처음엔 22% 에 문턱 20 을 걸어 36−17=19~20 으로
 *     ★«겨우» 갈렸다(★시험 설계의 흠) → 차가 큰 15%(61−17=44)로 옮기고 문턱은 ★그 절반 밑」
 *   ⇒ ★★「겨우 갈리는 문턱」은 ★시험 설계의 흠이다. ★차가 ★큰 자리를 고르고 ★문턱은 ★그 절반 밑으로.
 *   ★지금 값의 ★출처 = ★태양 M1 에서 ★유도한 ★어림이다(⛔실측이 아니다):
 *     태양: party 320 · 540×700(378,000 px) → 입자 px8 ★23,669 (= ★6.3%)
 *     우리: count = ★`MAX_COUNT` · 860×300(258,000 px)
 *       ★2026-10-07 판(상한 ★60): 입자 수가 태양의 ★1/5 ⇒ ★≈1.3% ⇒ ★≈3,300 px8
 *       ★★2026-10-08 판(상한 ★120 · 현빈 「120개까지하자 최대」): 입자가 ★2배 ⇒ ★≈2.6% ⇒ ★≈6,600 px8
 *     ⇒ 그래서 문턱을 ★★60 시절의 ★1/10 쯤(수백)에 뒀다 — ★차가 크다면 ★느슨해도 거짓 초록이 안 난다.
 *     ★★⚠️그러므로 ★120 에서는 ★문턱이 ★★«더» 느슨하다 — ★문턱은 ★«바닥»이라 ★입자가 늘면
 *       ★넘기기 ★쉬워진다 ⇒ ★★«거짓 빨강»은 ★안 난다. ⛔그러나 ★★잠그는 힘은 ★그만큼 ★약해졌다.
 *       ⇒ ★★120 기준으로 ★다시 재서 ★올려야 한다. ★★2026-10-08 현재 ★미측정이다.
 *   ★★⛔그러나 ★느슨한 문턱은 ★「무엇을 잠그나」가 ★약하다 ⇒ ★★첫 실행에서 ★★분포를 찍고
 *     ★그 수로 ★문턱을 ★다시 고른다. ★그 수가 ★이 머리말에 ★적히기 전까지 ★이 칸은 ★«미정»이다.
 *   ★그래서 ★모든 단언이 ★★잰 값을 ★메시지에 ★찍는다(「조사가 증거를 지운다」의 처방) ＋
 *     ★`t.diagnostic` 으로 ★분포를 ★한 줄 남긴다 — ★첫 실행 로그에서 ★그 수를 ★읽어 고친다.
 *
 * ★★이 효과는 «정지 한 장면»이다 ⇒ ★시드를 고정하고 잰다. ⛔requestAnimationFrame 을 기다리지 않는다
 *   (2026-10-07 규율: 부하는 느리게만이 아니라 ★틀리게도 만든다 · 현빈 「이건 왜 ★영상으로 나왔니?」)
 *
 * ★양성대조(판 sha 는 커밋 메시지·보고에): 층의 SVG 를 비우면 S1·S2 빨강 · 필터만 떼면 S3 빨강 ·
 *   seed 를 Math.random 으로 바꾸면 S4 가 흔들린다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 섹션 둘을 만든다 — 하나는 파티클, 하나는 ★대조(조건만 다르다). 돌려주는 값 = 섹션 id 들. */
async function setup(page, specs) {
  return page.evaluate((specs) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = specs.map((_, i) =>
      `<div class="section-block" id="secP${i}" style="position:relative;height:300px;background:#0A0A0C">`
      + '<div class="section-inner"></div></div>').join('');
    window.rebindAll?.();
    return specs.map((cfg, i) => {
      const sec = document.getElementById('secP' + i);
      if (cfg) { window.writeParticles(sec.dataset, cfg); window.applySectionParticles(sec); }
      return sec.id;
    });
  }, specs);
}

/** 섹션들을 ★앱과 같은 꼴(fixed · -99999)로 클론해 ★두 경로로 찍고, 섹션마다 ★px8 을 돌려준다.
 *  mutate(clone) — 클론에서만 조건을 바꾼다(필터 떼기 등). */
async function shootBoth(page, ids, mutateName) {
  const info = await page.evaluate(({ ids, mutateName }) => {
    const wrap = document.createElement('div');
    wrap.id = 'cap-root';
    wrap.style.cssText = 'position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;background:#0A0A0C;';
    const boxes = [];
    for (const id of ids) {
      const c = document.getElementById(id).cloneNode(true);
      c.id = id + '-clone';
      wrap.appendChild(c);
    }
    document.body.appendChild(wrap);
    /* ★클론에서만 조건을 바꾼다 — ⛔라이브를 안 건드린다 */
    if (mutateName === 'stripFilter') {
      wrap.querySelectorAll('.sec-fxpart-halo').forEach((g) => g.removeAttribute('filter'));
    }
    const r = wrap.getBoundingClientRect();
    for (const id of ids) {
      const c = document.getElementById(id + '-clone');
      const b = c.getBoundingClientRect();
      boxes.push({ id, x: Math.round(b.left - r.left), y: Math.round(b.top - r.top), w: Math.round(b.width), h: Math.round(b.height) });
    }
    return { rect: { x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height) }, boxes, bg: '#0A0A0C' };
  }, { ids, mutateName });

  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: info.rect.x, y: info.rect.y, width: info.rect.w, height: info.rect.h, scale: 1 } });
  const h2c = await page.evaluate(async (bg) => {
    const cv = await html2canvas(document.getElementById('cap-root'), { scale: 1, useCORS: true, backgroundColor: bg, logging: false });
    return cv.toDataURL('image/png').split(',')[1];
  }, info.bg);

  /** ★자 — 섹션 상자 안에서 «배경과 휘도 차 > 8」인 픽셀 수(태양 M1 의 px8). */
  const read = (b64) => page.evaluate(async ({ b64, info }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.width / info.rect.w;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const out = {};
    for (const bx of info.boxes) {
      const d = cx.getImageData(Math.round(bx.x * k), Math.round(bx.y * k), Math.round(bx.w * k), Math.round(bx.h * k)).data;
      /* 배경 휘도는 ★그 상자의 ★모서리 픽셀에서 뜬다 — ⛔수를 손으로 박지 않는다 */
      const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const base = lum(0);
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(lum(i) - base) > 8) n++;
      out[bx.id] = { px8: n, base: Math.round(base), total: d.length / 4 };
    }
    return out;
  }, { b64, info });

  const r = { cdp: await read(shot.data), h2c: await read(h2c) };
  await page.evaluate(() => document.getElementById('cap-root')?.remove());
  return r;
}

/* ★★문턱 명부 — ★한 자리. ⛔칸마다 흩어 박지 않는다(머리말의 «미정» 경고가 ★이 표를 가리킨다).
   ★첫 실행의 diagnostic 으로 ★분포를 보고 ★이 표만 고친다. */
const THRESH = Object.freeze({
  bgNoise:   0.005,   // 대조(갯수 0) 섹션에서 허용하는 px8 비율 — 배경이면 거의 0 이어야 한다
  onVsOff:   200,     // 파티클 섹션 px8 − 대조 px8 (어림 3,300 의 1/16)
  haloMin:   300,     // 후광 켠 그림이 «찍혔다»는 전제
  haloGain:  100,     // 필터 있음 − 필터 뗌
  bothMin:   200,     // 두 경로 비교의 전제(CDP 에 찍혔다)
  bothRel:   0.15,    // 두 경로 상대차 상한
});

const CFG_ON  = { preset: 'party', seed: 20261007, glow: 0,  spread: 0 };   // 후광 꺼짐 — 조각만
const CFG_OFF = { preset: 'party', seed: 20261007, glow: 0,  spread: 0, count: 0 };  // ★대조: 갯수 0
const CFG_HALO = { preset: 'star', seed: 20261007, glow: 80, spread: 10 };  // 후광 켜짐

test('S0 ★전제 — 배선이 섰다(window 에 셋이 있고 콘솔 오류 0)', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({
    fx: typeof window.ParticlesFx?.svg, seed: typeof window.FxSeed?.mulberry32,
    apply: typeof window.applySectionParticles, write: typeof window.writeParticles,
    kinds: window.ParticlesFx?.KINDS,
  }));
  expect(r).toEqual({ fx: 'function', seed: 'function', apply: 'function', write: 'function',
    kinds: ['star', 'gold', 'party', 'dust'] });

  /* ★★상한을 ★여기서 ★«값»으로 ★잠그지 ★않는다 — ⛔2026-10-08 ★그것이 ★이 칸을 ★깼다.
     ★옛 판은 ★`cap: 60` ★맨숫자였다 ⇒ ★현빈이 ★「60개 말고 ★120개까지하자 최대」라 해
       ★`MAX_COUNT` 가 ★120 이 되자 ★★이 전제가 ★거짓이 됐다(★머지 게이트가 ★새 빨강 1건으로 잡았다).
       ★★그 spec 은 ★머지 diff 에 ★없었다 — ★★«남이 쓴 검사»가 ★남의 변경에 ★깨진 꼴이다.
     ★★값의 ★단일 잠금 자리 = ★`tests/unit/fx-particles-render.test.mjs:109` ★하나다.
       ★그 파일 `:107` 이 ★그 설계를 적어 뒀다: 「이 파일에서 「값」을 ★글자로 적는 자리는 ★여기 하나뿐이다
        — ⛔다른 칸까지 박으면 ★명부가 ★둘이고, ⛔전부 `F.MAX_COUNT` 로 쓰면 ★★항등식이라 아무것도 안 잠근다」
     ⇒ ★★그래서 ★여기는 ★«값»이 아니라 ★★«정본 한 줄이 ★세 자리에 ★닿았나»를 ★잠근다.
       ★셋은 ★★다른 경로로 난다 — `MAX_COUNT`(particles-render.js:37 ★리터럴) ·
       `RANGES.count.max`(`:78` 이 ★읽는다) · `PRESETS.star.count`(`:59` 가 ★읽는다).
       ⇒ ★★한 자리라도 ★수를 ★손으로 박으면 ★★여기가 ★빨개진다(⛔항등식이 아니다).
     ⛔★★다음에 ★상한을 바꾸는 사람에게 — ★이 줄은 ★안 고쳐도 된다. ★★맨숫자를 ★다시 넣지 마라. */
  const cap = await page.evaluate(() => ({
    max: window.ParticlesFx?.MAX_COUNT,
    range: window.ParticlesFx?.RANGES?.count?.max,
    preset: window.ParticlesFx?.PRESETS?.star?.count,
  }));
  /* ★전제 — ★상한이 ★수이고 ★양이다(⛔undefined 끼리 ★같아서 ★통과하는 길을 막는다) */
  expect(Number.isFinite(cap.max) && cap.max > 0,
    `★전제: 상한이 ★양의 수가 아니다 (${JSON.stringify(cap)})`).toBe(true);
  expect(cap.range,
    `★RANGES.count.max 가 ★상한과 다르다 — ★범위 표가 ★수를 손으로 박았다 ${JSON.stringify(cap)}`).toBe(cap.max);
  expect(cap.preset,
    `★PRESETS.star.count 가 ★상한과 다르다 — ★프리셋이 ★수를 손으로 박았다 ${JSON.stringify(cap)}`).toBe(cap.max);

  expect(errs, '배선이 콘솔 오류를 냈다').toEqual([]);
});

test('S1·S2·S5 ★두 경로에 파티클이 산다 — 대조(갯수 0)는 배경 그대로', async ({ page }, ti) => {
  await bootApp(page);
  const ids = await setup(page, [CFG_ON, CFG_OFF]);
  const m = await shootBoth(page, ids, null);
  /* ★★분포를 ★남긴다 — ★문턱(THRESH)을 ★이 수로 고친다(머리말의 «미정» 칸) */
  for (const path of ['cdp', 'h2c']) {
    const on = m[path][ids[0]], off = m[path][ids[1]];
    ti?.diagnostic?.(`[분포] ${path} 파티클 px8=${on.px8} · 대조 px8=${off.px8} · 전체=${on.total} · 비율=${(on.px8 / on.total * 100).toFixed(2)}%`);
  }
  for (const path of ['cdp', 'h2c']) {
    const on = m[path][ids[0]], off = m[path][ids[1]];
    expect(off.px8, `★대조(${path}): 갯수 0 인 섹션은 «배경 그대로»여야 한다(px8 ${off.px8} / ${off.total})`)
      .toBeLessThan(off.total * THRESH.bgNoise);
    expect(on.px8, `${path}: 파티클이 안 찍혔다(px8 ${on.px8} · 대조 ${off.px8})`).toBeGreaterThan(off.px8 + THRESH.onVsOff);
  }
});

test('S3 ★후광(SVG filter)이 두 경로 다 산다 — 대조는 «클론에서만 필터를 뗀» 같은 층', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [CFG_HALO, CFG_HALO]);
  const withF = await shootBoth(page, ids, null);
  const noF   = await shootBoth(page, ids, 'stripFilter');
  for (const path of ['cdp', 'h2c']) {
    const a = withF[path][ids[0]].px8, b = noF[path][ids[0]].px8;
    expect(a, `★전제(${path}): 후광 켠 그림이 찍혔다(px8 ${a})`).toBeGreaterThan(THRESH.haloMin);
    expect(a - b, `${path}: 후광이 내보내기에서 사라졌다(필터 있음 ${a} · 뗌 ${b}) — 모자이크와 같은 함정`)
      .toBeGreaterThan(THRESH.haloGain);
  }
});

test('S4 ★두 경로가 갈리지 않는다 — 같은 자로 잰 수가 가깝다', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [CFG_ON, CFG_HALO]);
  const m = await shootBoth(page, ids, null);
  for (const id of ids) {
    const c = m.cdp[id].px8, h = m.h2c[id].px8;
    expect(c, `★전제: CDP 에 찍혔다(${id} · px8 ${c})`).toBeGreaterThan(THRESH.bothMin);
    const rel = Math.abs(c - h) / Math.max(c, h);
    expect(rel, `★두 경로가 갈린다(${id}) — CDP ${c} · html2canvas ${h} (상대차 ${(rel * 100).toFixed(1)}%)`)
      .toBeLessThan(THRESH.bothRel);
  }
});

test('S6 ★같은 시드 = 같은 그림 — 다시 그려도 글자가 한 톨도 안 다르다(리로드·썸네일·undo 가 다시 그린다)', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [CFG_ON]);
  const r = await page.evaluate((id) => {
    const sec = document.getElementById(id);
    const first = sec.querySelector('.sec-fxpart-wrap').innerHTML;
    sec.querySelector('.sec-fxpart-wrap').remove();          // 저장본엔 dataset 만 산다고 치고
    window.applySectionParticles(sec);
    const again = sec.querySelector('.sec-fxpart-wrap').innerHTML;
    /* ★다른 시드면 ★달라야 한다(자가 «언제나 같다» 가 아니다) */
    window.writeParticles(sec.dataset, { preset: 'party', seed: 999, glow: 0, spread: 0 });
    window.applySectionParticles(sec);
    return { same: again === first, len: first.length, other: sec.querySelector('.sec-fxpart-wrap').innerHTML !== first };
  }, ids[0]);
  expect(r.len, '★전제: 그림이 있다').toBeGreaterThan(500);
  expect(r.same, '다시 그렸더니 모습이 바뀌었다 — 리로드·썸네일·undo 마다 다른 그림이 된다').toBe(true);
  expect(r.other, '다른 시드인데 같은 그림이다 — 시드가 그림에 안 닿는다').toBe(true);
});
