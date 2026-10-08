/* fx-particles-anim — 파티클 «움직임»(v1.5 ⑴)을 ★앱에서 ★진짜 층을 놓고 잰다.
 *
 * ★★단위(tests/unit/fx-particles-animate)는 ★셈만 잰다 — ★「정말 움직이나」는 ★여기 몫이다.
 *
 * ★★⛔프레임을 ★기다리지 않는다 — ★`ParticlesAnim.step(tMs)` 에 ★시각을 ★손으로 넣는다.
 *   ★까닭: ★부하는 ★느리게만이 아니라 ★★«틀리게»도 만든다(고정 대기 위의 검사는 값을 잃는다).
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다):
 *   · ★`prefers-reduced-motion` ⇒ ★★v1.5 ⑵ ★미착수
 *   · ★뷰포트 컬링 ⇒ ★★v1.5 ⑶ ★미착수 — ★지금 루프는 ★안 보이는 섹션도 ★돈다
 *   · ★사람 눈에 ★자연스러운가 ⇒ ★QA 몫
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const VIEW_W = 1440, VIEW_H = 1000;

/** 섹션 하나를 만들고 ★파티클을 ★켠다. ⛔층을 손으로 만들지 않는다 — ★앱이 그리는 그 길이다. */
async function setup(page, cfg) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  await page.evaluate((c) => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    canvas.insertAdjacentHTML('beforeend',
      '<div class="section-block" id="pS" data-section="1" style="background:#0A0A0C">'
      + '<div class="section-hitzone"></div>'
      + '<div class="section-inner" style="padding-left:40px;padding-right:40px">'
      + '<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    window.rebindAll?.();
    const sec = document.getElementById('pS');
    window.writeParticles(sec.dataset, { preset: 'party', seed: 7, ...c });
    window.applySectionParticles?.(sec) ?? window.watchAllParticles?.(document);
    /* ★★살아 있는 ★rAF 루프를 ★세운다 — ⛔안 세우면 ★그 루프가 ★내 step() 사이에 ★덮어쓴다.
       ★2026-10-09 실측: ★V2 의 ★결정성 줄이 ★그래서 ★빨갰다(★제품 흠이 아니라 ★내 자의 흠).
       ⇒ ★이 수트는 ★시각을 ★손으로 넣어 잰다 ⇒ ★★«쓰는 자»가 ★하나여야 한다. */
    window.ParticlesAnim?.stop?.();
  }, cfg);
  await page.waitForTimeout(150);
  return errs;
}

/** ★★전제 — ★지금 ★쓰는 자가 ★나 하나인가. ⛔이걸 안 세우면 ★아래 수가 ★누구 것인지 모른다. */
async function assertOnlyWriter(page) {
  const a = await marks(page);
  await page.waitForTimeout(250);                 /* ★살아 있는 루프라면 ★이 사이에 ★여러 프레임이 돈다 */
  const b = await marks(page);
  expect(b.t, '★★전제: 내가 안 썼는데 ★자리가 바뀌었다 — ★루프가 ★아직 돌고 있다').toEqual(a.t);
}

/** 알맹이들의 transform 을 ★그대로 떠 온다 — ★비교는 ★글자로(⛔눈으로 안 본다). */
const marks = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('.sec-fxpart-wrap [data-fxp]')];
  return { n: els.length, t: els.slice(0, 12).map((e) => e.getAttribute('transform') || '') };
});

test('V0 ★전제 — 움직이개가 앱에 실렸고 ★층이 났다', async ({ page }) => {
  const errs = await setup(page, { speed: 58, spin: 190 });
  const has = await page.evaluate(() => typeof window.ParticlesAnim?.step);
  expect(has, '★ParticlesAnim 이 앱에 없다 — index.html 에 스크립트가 빠졌다').toBe('function');
  const m = await marks(page);
  expect(m.n, '★꼬리표 붙은 알맹이가 0개다 — 그리개가 data-fxp 를 안 붙였다').toBeGreaterThan(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('V1 ★★패닝 축이 ★전부 0 이면 ★루프가 ★건드리지 않는다 — ★옛 저장본 (★양·음 한 쌍)', async ({ page }) => {
  /* ⒜ ★음성 — ★축이 전부 0(= 옛 저장본이 받는 그 값) */
  const errs = await setup(page, { speed: 0, spin: 0, blur: 0 });
  const before = await marks(page);
  expect(before.n, '★전제: 축이 0 인데 ★꼬리표가 붙었다 — inert 가 깨졌다').toBe(0);

  const movedZero = await page.evaluate(() => window.ParticlesAnim.step(2000));
  expect(movedZero, '★★축이 전부 0 인데 ★루프가 ★알맹이를 건드렸다 — 옛 섹션이 움직인다').toBe(0);

  /* ★그림 자체도 ★그대로인가 — ★step 이 ★엉뚱한 것을 만졌을 수 있다 */
  const html0 = await page.evaluate(() => document.querySelector('.sec-fxpart-wrap').innerHTML);
  await page.evaluate(() => window.ParticlesAnim.step(9000));
  const html1 = await page.evaluate(() => document.querySelector('.sec-fxpart-wrap').innerHTML);
  expect(html1, '★축이 0 인데 ★층의 글자가 바뀌었다').toBe(html0);

  /* ⒝ ★★양성 — ★같은 자가 ★축이 있으면 ★움직여야 한다.
     ⛔이것이 없으면 ★「늘 0 을 내는 죽은 자」와 ★구분이 안 된다. */
  await setup(page, { speed: 58, spin: 190 });
  const movedSome = await page.evaluate(() => window.ParticlesAnim.step(2000));
  expect(movedSome, '★★축을 줬는데도 ★루프가 ★0개를 움직였다 — 이 자는 아무것도 안 재고 있다')
    .toBeGreaterThan(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('V2 ★★정말 움직인다 — ★시각이 다르면 ★자리가 다르고, ★같으면 ★같다(결정성)', async ({ page }) => {
  const errs = await setup(page, { speed: 58, spin: 190 });
  await assertOnlyWriter(page);

  await page.evaluate(() => window.ParticlesAnim.step(0));
  const a = await marks(page);
  await page.evaluate(() => window.ParticlesAnim.step(2000));
  const b = await marks(page);
  await page.evaluate(() => window.ParticlesAnim.step(0));
  const a2 = await marks(page);

  expect(a.n, '★전제: 잴 알맹이가 없다').toBeGreaterThan(0);
  expect(b.t, '★★2초 뒤인데 ★자리가 그대로다 — 안 움직인다').not.toEqual(a.t);
  /* ★★결정성 — ★같은 시각이면 ★같은 자리. ⛔시계를 읽으면 ★이 줄이 ★빨개진다 */
  expect(a2.t, '★★같은 시각으로 돌아왔는데 ★자리가 다르다 — step 이 ★시계를 읽고 있다').toEqual(a.t);

  /* ★★꼴 — ★translate 와 ★rotate 가 ★둘 다 들어간다(떨어짐 ＋ 회전) */
  expect(b.t[0], `★transform 꼴이 다르다 (${b.t[0]})`).toMatch(/^translate\(0,[-0-9.]+\) rotate\(/);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('V3 ★★회전만 켜면 ★돌고, ★떨어짐만 켜면 ★떨어진다 — 두 축이 ★따로 먹는다', async ({ page }) => {
  /* ⒜ ★회전만 */
  await setup(page, { speed: 0, spin: 300 });
  await page.evaluate(() => window.ParticlesAnim.step(0));
  const s0 = await marks(page);
  await page.evaluate(() => window.ParticlesAnim.step(2000));
  const s1 = await marks(page);
  const dy = (t) => Number((t.match(/^translate\(0,([-0-9.]+)\)/) || [])[1]);
  expect(s1.t, '★spin 만 켰는데 ★아무 변화가 없다').not.toEqual(s0.t);
  expect(dy(s1.t[0]), `★spin 만 켰는데 ★세로로 움직였다 (dy=${dy(s1.t[0])})`).toBe(0);

  /* ⒝ ★떨어짐만 — ★각도가 ★안 바뀌어야 한다(처음 각 그대로) */
  await setup(page, { speed: 100, spin: 0 });
  await page.evaluate(() => window.ParticlesAnim.step(0));
  const f0 = await marks(page);
  await page.evaluate(() => window.ParticlesAnim.step(2000));
  const f1 = await marks(page);
  const ang = (t) => Number((t.match(/rotate\(([-0-9.]+)/) || [])[1]);
  expect(dy(f1.t[0]), '★speed 만 켰는데 ★세로로 ★안 움직였다').not.toBe(0);
  expect(ang(f1.t[0]), '★speed 만 켰는데 ★각도가 ★바뀌었다').toBe(ang(f0.t[0]));
});

test('V4 ★★살아 있는 루프가 ★정말 돈다 — ★`step` 을 손으로 안 부른다 (★양·음 한 쌍)', async ({ page }) => {
  /* ★★위 셋은 ★루프를 ★세우고 ★시각을 ★손으로 넣는다 ⇒ ★★«루프가 도나»는 ★아무도 안 쟀다.
     ★이 칸이 ★그 구멍을 ★메운다 — ★여기서만 ★진짜 프레임을 ★쓴다.
     ⛔고정 대기로 ★재지 않는다 — ★`waitForFunction` 이 ★참이 될 때까지 ★«물어본다»
       (부하에서 ★느려도 ★값을 ★안 잃는다. ★거짓이면 ★타임아웃으로 ★빨개진다). */
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    canvas.insertAdjacentHTML('beforeend',
      '<div class="section-block" id="pS" data-section="1" style="background:#0A0A0C">'
      + '<div class="section-hitzone"></div>'
      + '<div class="section-inner" style="padding-left:40px;padding-right:40px">'
      + '<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    window.rebindAll?.();
    const sec = document.getElementById('pS');
    window.writeParticles(sec.dataset, { preset: 'party', seed: 7, speed: 80, spin: 200 });
    window.applySectionParticles(sec);           /* ⛔stop() 을 ★안 부른다 — ★루프가 ★살아 있어야 한다 */
  });
  const first = await page.evaluate(() => {
    const e = document.querySelector('.sec-fxpart-wrap [data-fxp]');
    return e ? (e.getAttribute('transform') || '') : null;
  });
  expect(first, '★전제: 잴 알맹이가 없다').not.toBeNull();

  /* ⒜ ★양성 — ★손 안 대고 ★기다리면 ★자리가 ★바뀐다 */
  await page.waitForFunction((t0) => {
    const e = document.querySelector('.sec-fxpart-wrap [data-fxp]');
    return !!e && (e.getAttribute('transform') || '') !== t0;
  }, first, { timeout: 5000 }).catch(() => { throw new Error('★★루프가 ★5초 동안 ★한 번도 ★안 움직였다'); });

  /* ⒝ ★★음성 — ★`stop()` 하면 ★멈춘다. ⛔이게 없으면 ★「무언가가 흔든다」와 ★구분이 안 된다 */
  await page.evaluate(() => window.ParticlesAnim.stop());
  const s0 = await page.evaluate(() => document.querySelector('.sec-fxpart-wrap [data-fxp]').getAttribute('transform'));
  await page.waitForTimeout(400);
  const s1 = await page.evaluate(() => document.querySelector('.sec-fxpart-wrap [data-fxp]').getAttribute('transform'));
  expect(s1, '★★stop() 했는데도 ★계속 움직인다 — 루프를 ★못 세운다').toBe(s0);

  /* ⒞ ★`kick()` 으로 ★다시 깨어난다 — ★다시 그린 뒤의 그 길 */
  await page.evaluate(() => window.ParticlesAnim.kick());
  await page.waitForFunction((t0) => {
    const e = document.querySelector('.sec-fxpart-wrap [data-fxp]');
    return !!e && (e.getAttribute('transform') || '') !== t0;
  }, s1, { timeout: 5000 }).catch(() => { throw new Error('★★kick() 뒤에도 ★안 깨어난다'); });

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
