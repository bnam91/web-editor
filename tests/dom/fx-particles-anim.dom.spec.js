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

  /* ★★잡음대조 — ★★«움직임 0» 의 ★바닥을 ★먼저 잰다.
     ⛔없으면 ★★«1px 떨림»을 ★★«안 움직임»으로 ★읽는다. ★참 Δ 가 ★구조적으로 ★0 인 자리다:
       ★아무도 ★안 썼는데 ★두 번 읽으면 ★같아야 한다. ★여기서 ★0 이 안 나오면 ★아래 수는 ★못 쓴다. */
  const z0 = await marks(page);
  await page.waitForTimeout(300);
  const z1 = await marks(page);
  expect(z1.t, '★★잡음 바닥: ★아무도 안 썼는데 ★자리가 바뀐다 — ★아래 「0」은 ★뜻이 없다').toEqual(z0.t);

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

  /* ⒞ ★★«행위»가 ★«설정»과 ★갈리는 자리 — ★자리가 ★정말 바뀌었나(★수가 아니라 ★글자로).
     ★★P14c(unit)는 ★«PRESETS 기본»을 잰다 ⇒ ★★«설정이 0»까지다.
     ★이 줄이 ★★«행위가 0»을 잰다 — ★그 둘은 ★다른 것이다. */
  const after = await marks(page);
  expect(after.t.some((t) => /^translate\(0,[-0-9.]+\) rotate\(/.test(t)),
    '★움직였다는데 ★transform 꼴이 안 났다').toBe(true);
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

test('V1b ★★낡은 꼬리표 ＋ 축 0 — ★`scan` 의 ★0 판정이 ★홀로 막는 ★유일한 자리', async ({ page }) => {
  /* ★★왜 이 칸이 ★따로 있나 (2026-10-09 ★무력화 대조가 ★가르쳐 줬다):
     ★`scan` 의 ★`if (speed <= 0 && spin <= 0) continue;` ★한 줄을 ★죽였더니 ★★V1 이 ★그대로 ★초록이었다.
     ★까닭: ★축이 0 이면 ★그리개가 ★꼬리표를 ★안 붙이고, ★꼬리표가 없으면 ★`readLayer` 가 ★0개를 돌려줘
       ★`scan` 이 ★어차피 ★건너뛴다 ⇒ ★★방어가 ★둘이고 ★V1 은 ★뒤엣것만 재고 있었다.
     ⇒ ★★이 칸은 ★★«꼬리표는 있는데 축이 0 인» 판을 ★만들어 ★앞엣것을 ★홀로 세운다.
     ★그 판이 ★실제로 나는 자리 = ★★움직이던 섹션의 ★축을 ★0 으로 ★되돌렸는데 ★층이 ★아직 ★안 그려졌을 때
       (★저장본 왕복·undo·외부 쓰기). ⇒ ★그때 ★알맹이가 ★튀면 ★안 된다. */
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
    /* ⑴ ★움직이는 판으로 ★그린다 ⇒ ★꼬리표가 ★붙는다 */
    window.writeParticles(sec.dataset, { preset: 'party', seed: 7, speed: 80, spin: 200 });
    window.applySectionParticles(sec);
    window.ParticlesAnim.stop();
    /* ⑵ ★축만 ★0 으로 ★되돌린다 — ⛔다시 ★안 그린다. ★그래서 ★꼬리표가 ★남는다 */
    window.writeParticles(sec.dataset, { preset: 'party', seed: 7, speed: 0, spin: 0 });
  });
  await page.waitForTimeout(120);

  const n = await page.evaluate(() => document.querySelectorAll('.sec-fxpart-wrap [data-fxp]').length);
  expect(n, '★전제: ★낡은 꼬리표가 ★안 남았다 — 이 칸이 재려는 판이 ★아니다').toBeGreaterThan(0);
  const cfg = await page.evaluate(() => window.readParticles(document.getElementById('pS').dataset));
  expect(cfg.speed, '★전제: 축이 0 으로 안 돌아갔다').toBe(0);
  expect(cfg.spin, '★전제: 축이 0 으로 안 돌아갔다').toBe(0);

  const before = await page.evaluate(() =>
    [...document.querySelectorAll('.sec-fxpart-wrap [data-fxp]')].slice(0, 8).map((e) => e.getAttribute('transform') || ''));
  const moved = await page.evaluate(() => window.ParticlesAnim.step(5000));
  const after = await page.evaluate(() =>
    [...document.querySelectorAll('.sec-fxpart-wrap [data-fxp]')].slice(0, 8).map((e) => e.getAttribute('transform') || ''));

  expect(moved, '★★꼬리표는 남았지만 ★축이 0 이다 — ★루프가 ★건드리면 ★알맹이가 튄다').toBe(0);
  expect(after, '★★축이 0 인데 ★자리가 바뀌었다 — ★낡은 꼬리표가 알맹이를 ★튀게 했다').toEqual(before);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('V5 ★★저장본에 ★«시각»이 ★안 들어간다 — ★언제 저장해도 ★같은 글자 (★양·음 한 쌍)', async ({ page }) => {
  /* ★★2026-10-09 ★내가 ★낸 회귀를 ★잡는 자리다.
     ★움직이개가 ★매 프레임 `transform` 을 ★덮는데, ★그 `dy` 는 ★★«시각»이다.
     ★실측: 세척 전 `serializeSectionClone` 에 ★`translate(0,-N) rotate(…)` 가 ★그대로 있었다.
     ⇒ ⒜ 「같은 시드 = 같은 그림」이 깨지고 ⒝ 히스토리 스냅샷이 프레임마다 다르고
       ⒞ ★비교 채널이 ★「손도 안 댔는데 변경됨」 ★오탐을 낸다.
     ★처방 = `js/io/section-serialize.js` 의 ★`restParticleMotion`(세척 한 자리). */
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    canvas.insertAdjacentHTML('beforeend',
      '<div class="section-block" id="pS" data-section="1" style="background:#0A0A0C">'
      + '<div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px">'
      + '<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    window.rebindAll?.();
    const sec = document.getElementById('pS');
    window.writeParticles(sec.dataset, { preset: 'party', seed: 7, speed: 80, spin: 200 });
    window.applySectionParticles(sec);
    window.ParticlesAnim.stop();
  });

  const save = (t) => page.evaluate((tt) => {
    window.ParticlesAnim.step(tt);
    return window.serializeSectionClone(document.getElementById('pS'));
  }, t);

  /* ★전제 — ★그 시각에 ★정말 움직였나(⛔안 움직이면 ★아래가 ★공짜로 초록이다) */
  const moved = await page.evaluate(() => {
    window.ParticlesAnim.step(4000);
    const e = document.querySelector('.sec-fxpart-wrap [data-fxp]');
    return e.getAttribute('transform') || '';
  });
  expect(moved, `★전제: ★step 뒤에도 ★안 움직였다 (${moved})`).toMatch(/^translate\(0,[-0-9.]+\) rotate\(/);

  /* ⒜ ★★본 단언 — ★다른 시각에 저장해도 ★★글자가 ★같다 */
  const s0 = await save(0);
  const s1 = await save(4000);
  const s2 = await save(97531);
  expect(s0.length, '★전제: 저장 글자가 비었다').toBeGreaterThan(500);
  expect(s1, '★★4초에 저장한 글자가 0초와 ★다르다 — ★저장본에 ★시각이 들어갔다').toBe(s0);
  expect(s2, '★★97초에 저장한 글자가 0초와 ★다르다 — ★저장본에 ★시각이 들어갔다').toBe(s0);

  /* ⒝ ★★«움직인 꼴»이 ★저장본에 ★없다 */
  expect(/translate\(0,[-0-9.]+\) rotate\(/.test(s1),
    '★★저장본에 ★translate(움직임)이 ★박혔다').toBe(false);

  /* ⒞ ★★그런데 ★화면은 ★그대로 움직이고 있어야 한다 — ⛔세척이 ★살아있는 DOM 을 ★건드리면 안 된다
     (★클론을 씻는 것이지 ★제자리를 ★멈추는 것이 ★아니다) */
  const live = await page.evaluate(() =>
    document.querySelector('.sec-fxpart-wrap [data-fxp]').getAttribute('transform') || '');
  expect(live, '★★세척이 ★살아있는 층을 ★멈췄다 — 클론만 씻어야 한다').toMatch(/^translate\(0,/);

  /* ⒟ ★★음성대조 — ★정지 섹션(축 0)의 저장본과 ★꼴이 같은가(★rotate 만) */
  const stillSave = await page.evaluate(() => {
    const sec = document.getElementById('pS');
    window.writeParticles(sec.dataset, { preset: 'party', seed: 7, speed: 0, spin: 0 });
    window.applySectionParticles(sec);
    return window.serializeSectionClone(sec);
  });
  expect(/translate\(0,/.test(stillSave), '★정지 섹션 저장본에 translate 가 있다').toBe(false);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('V6 ★★움직임이 ★자동저장을 ★깨우지 않는다 — ★문서가 ★영원히 dirty 가 되면 안 된다 (★양·음 한 쌍)', async ({ page }) => {
  /* ★★실측(2026-10-09 · 고치기 전): 움직이는 ★1.5초에 ★«의미 있는» mutation ★21,724건 · 멈추면 ★0건.
     ⇒ ★문서가 ★영원히 dirty ⇒ ★자동저장이 ★1.5초마다 ★프로젝트를 ★통째로 다시 쓴다.
     ★이 칸은 ★제품의 감시자를 ★가로채지 않는다 — ★★«같은 조건»의 관찰자를 ★따로 달아 ★센다. */
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  const r = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    canvas.insertAdjacentHTML('beforeend',
      '<div class="section-block" id="pS" data-section="1" style="background:#0A0A0C">'
      + '<div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px">'
      + '<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    window.rebindAll?.();
    const sec = document.getElementById('pS');

    let meaningful = 0, raw = 0;
    const isUi = (m) => {
      const t = m.target?.nodeType === 1 ? m.target : m.target?.parentElement;
      return !!(t?.closest?.(window.NON_CONTENT_UI_SELECTOR));
    };
    /* ★제품의 그 판정과 ★같은 꼴 — ★`transform` ＋ `data-fxp` */
    const isParticleMotion = (m) => m.type === 'attributes' && m.attributeName === 'transform'
      && m.target?.nodeType === 1 && m.target.hasAttribute?.('data-fxp');
    const obs = new MutationObserver((ms) => {
      for (const m of ms) {
        raw++;
        if (m.type === 'attributes' && m.attributeName === 'class') continue;
        if (isUi(m)) continue;
        if (isParticleMotion(m)) continue;
        meaningful++;
      }
    });
    obs.observe(canvas, { childList: true, subtree: true, attributes: true, characterData: true });

    window.writeParticles(sec.dataset, { preset: 'party', seed: 7, speed: 80, spin: 200 });
    window.applySectionParticles(sec);
    await new Promise((res) => setTimeout(res, 300));
    raw = 0; meaningful = 0;                       /* ★다시그리기(진짜 편집)는 ★안 센다 — ★움직임만 */
    await new Promise((res) => setTimeout(res, 1200));
    const moveRaw = raw, moveMeaningful = meaningful;

    /* ★★양성대조 — ★같은 관찰자가 ★«진짜 편집»은 ★잡나. ⛔없으면 ★「늘 0 인 죽은 자」다 */
    raw = 0; meaningful = 0;
    sec.querySelector('.gap-block').style.height = '301px';
    await new Promise((res) => setTimeout(res, 200));
    const editMeaningful = meaningful;

    obs.disconnect();
    window.ParticlesAnim.stop();
    return { moveRaw, moveMeaningful, editMeaningful };
  });

  /* ★전제 — ★그 1.2초에 ★움직임이 ★정말 있었나(⛔없으면 ★0 이 ★공짜다) */
  expect(r.moveRaw, '★전제: 1.2초 동안 ★DOM 쓰기가 ★0건이다 — 루프가 안 돌았다').toBeGreaterThan(100);
  /* ★★본 단언 */
  expect(r.moveMeaningful, `★★움직임이 ★편집으로 세어졌다 (${r.moveMeaningful}건 / 날것 ${r.moveRaw}건)`
    + ' — ★문서가 ★영원히 dirty 가 되어 ★자동저장이 ★멈추지 않는다').toBe(0);
  /* ★★양성대조 — ★진짜 편집은 ★여전히 잡힌다 */
  expect(r.editMeaningful, '★★진짜 편집(높이 변경)을 ★못 잡았다 — 이 자는 ★아무것도 안 재고 있다')
    .toBeGreaterThan(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
