/* modal-font.dom.spec.js — ★T1 「모달 기본 폰트 = 프리텐다드」의 ★지키는 검사
 *
 * ★★이 파일의 네 칸은 ★「무엇을 기본값으로 쓸 것인가」와 ★무관하다.
 *   발주(지디 2026-10-07)는 ⒝ 「디자인시스템의 `--preset-body-family` 를 읽어라」였는데
 *   ★그 토큰을 ★행위로 읽으니 ★부팅 기본이 `'Noto Sans KR', sans-serif` 였다(＝현빈 요구의 반대).
 *   ⇒ ★기전은 지디 판정을 기다린다. ★그 사이에도 ★이 넷은 ★어느 기전이 이겨도 ★같은 검사다.
 *
 * ★네 칸이 ★각각 ★무엇을 막나
 *   T1-NEG1 ★사용자가 고른 폰트를 ★새 기본값이 ★덮지 않는다  ← ★지디 「이게 이 건의 진짜 위험이다」
 *   T1-NEG2 ★dataset 이 ★없는 «옛» 모달은 ★선언이 ★안 나간다(⇒ 상속) — `MODAL_DEFAULTS.fontFamily === ''` 를 ★행위로 잠근다
 *   T1-GATE ★우리가 박으려는 값이 ★검문 자(`_MDL_FONT_RE`)를 ★통과한다 — ⛔거절되면 ★선언이 ★조용히 빠진다
 *   T1-RULER ★폰트 이름이 «진짜 먹나»는 ★폭으로만 안다 — ⛔이름이 틀리면 ★에러 없이 ★폴백한다
 *
 * ★★T1-RULER 를 둔 까닭(실측 2026-10-07, 100px 같은 글자 폭):
 *     'Pretendard' ★828.33 / 'NoSuchFontXyz123' 778.91 / ★'Noto Sans KR' ★778.91 / sans-serif 778.91
 *   ⇒ ★'Noto Sans KR' 은 이 환경에 ★없어서 ★가짜 이름과 ★폭이 같다. ★이름만 보고는 ★구분이 안 된다.
 *   ⛔`document.fonts.check()` 단독으로 닫지 마라 — @font-face 는 ★로드 전 false, CDN 은 ★로드 후 true 라
 *     한쪽만 쓰면 거짓양성·거짓음성이 ★같이 온다(그 까닭이 `js/io/gdt-import.js:22` 주석에 이미 적혀 있다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★모달 하나를 만든다 — `addModalBlock` 은 {row, block} 을 돌려준다(실측 2026-10-07).
   ⛔다른 입구는 아무것도 안 돌려주는 것이 있다(`addCanvasBlock` · canvas-block.js:1048) ⇒ DOM 길을 같이 둔다. */
async function setup(page, opts = {}) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((opts) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div>'
      + '<div class="section-inner" id="inner1"></div></div>');
    window.rebindAll?.();
    document.getElementById('sec1').classList.add('selected');
    const made = window.addModalBlock?.(opts);
    window.__b = (made && made.block) || document.querySelector('#inner1 .modal-block');
  }, opts);
  await page.waitForTimeout(300);
  const pre = await page.evaluate(() => ({
    exists: !!window.__b,
    inDom: !!(window.__b && window.__b.isConnected),
    isModal: !!(window.__b && window.__b.classList.contains('modal-block')),
    hasRender: typeof window.renderModalBlock === 'function',
  }));
  expect(pre.exists, '전제: addModalBlock 이 블럭을 안 돌려줬다').toBe(true);
  expect(pre.inDom, '전제: 블럭이 DOM 에 없다').toBe(true);
  expect(pre.isModal, `전제: .modal-block 이 아니다`).toBe(true);
  expect(pre.hasRender, '전제: window.renderModalBlock 이 없다 — 재렌더를 못 잰다').toBe(true);
  return errs;
}

/* ★폭 자 — 같은 글자를 ★그 스택으로 그려 ★가짜 이름과 ★견준다.
   ★한 판 안에서 ★둘을 같이 재야 한다(기계·버전마다 절대폭이 다르다 ⇒ ★차이만 쓴다). */
const WIDTH_PROBE = `(stack) => {
  const s = document.createElement('span');
  s.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:100px;white-space:pre;font-family:' + stack;
  s.textContent = 'Wig한글기준 12345';
  document.body.appendChild(s);
  const w = s.getBoundingClientRect().width;
  s.remove();
  return Math.round(w * 100) / 100;
}`;

test('T1-NEG1 ★(음성대조) 사용자가 «고른» 폰트는 새 기본값이 와도 안 바뀐다', async ({ page }) => {
  /* ★serif 를 고른다 — Pretendard 는 sans 라 ★덮이면 ★폭까지 달라져 바로 드러난다.
     (fontChain 이 serif 계열엔 Pretendard 를 ★안 끼우는 까닭과 같은 이치 — prop-text-utils.js:30) */
  const CHOSEN = "'Noto Serif KR', serif";
  const errs = await setup(page, { fontFamily: CHOSEN });
  const got = await page.evaluate(() => {
    const b = window.__b;
    const before = { ds: b.dataset.fontFamily ?? null, inline: b.style.fontFamily };
    window.renderModalBlock(b);                       // ★재렌더 — cssText 를 통째로 갈아끼우는 길
    const after = { ds: b.dataset.fontFamily ?? null, inline: b.style.fontFamily };
    return { before, after };
  });
  console.log(`  T1-NEG1 before.ds=${JSON.stringify(got.before.ds)} after.ds=${JSON.stringify(got.after.ds)}`);
  console.log(`  T1-NEG1 before.inline=${JSON.stringify(got.before.inline)} after.inline=${JSON.stringify(got.after.inline)}`);
  expect(got.before.ds, `전제: 고른 폰트가 dataset 에 안 들어갔다 — 측정값 ${JSON.stringify(got.before.ds)}`).toBe(CHOSEN);
  expect(got.after.ds, `★고른 폰트가 바뀌었다 — ${JSON.stringify(got.after.ds)}`).toBe(CHOSEN);
  // ★인라인 선언까지 나가야 «화면»이 그 폰트다(dataset 만 맞고 선언이 빠지는 판을 막는다)
  expect(got.after.inline, `★인라인 font-family 선언이 안 나갔다 — 측정값 ${JSON.stringify(got.after.inline)}`).toContain('Noto Serif KR');
  expect(got.after.inline.toLowerCase(), `★고른 폰트 자리에 Pretendard 가 끼어들었다 — ${JSON.stringify(got.after.inline)}`).not.toContain('pretendard');
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

test('T1-NEG2 ★dataset 이 «없는» 옛 모달은 선언이 안 나간다 (⇒ 상속 · 기본값이 빈값임을 행위로)', async ({ page }) => {
  const errs = await setup(page, {});
  const got = await page.evaluate(() => {
    const b = window.__b;
    /* ★«옛 모달» 흉내 — 저장 파일에 그 키가 ★없던 블럭. 지우고 다시 그린다.
       ⛔이 칸은 ★T1 뒤에도 ★참이어야 한다: 새것은 ★만들 때 박고(makeModalBlock),
         ★기본값(MODAL_DEFAULTS.fontFamily)은 ★''  로 둔다 ⇒ 옛 블럭 화면이 ★안 움직인다.
         (같은 규약이 바로 옆 `iconColor` 주석에 적혀 있다 — modal-block.js:66~71) */
    delete b.dataset.fontFamily;
    window.renderModalBlock(b);
    return {
      ds: b.dataset.fontFamily ?? '(키없음)',
      inline: b.style.fontFamily,
      cssHasFont: /font-family/.test(b.style.cssText),
      computed: getComputedStyle(b).fontFamily,
    };
  });
  console.log(`  T1-NEG2 ds=${got.ds} inline=${JSON.stringify(got.inline)} cssHasFont=${got.cssHasFont}`);
  console.log(`  T1-NEG2 computed(상속) = ${JSON.stringify(got.computed)}`);
  expect(got.ds, '전제: dataset 키를 못 지웠다').toBe('(키없음)');
  expect(got.cssHasFont, `★dataset 이 없는데 font-family 가 박혔다 — 옛 모달 화면이 움직인다. cssText=${JSON.stringify(got.inline)}`).toBe(false);
  expect(got.computed.length, '전제: computed 를 못 읽었다').toBeGreaterThan(0);
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

test('T1-GATE ★박으려는 값이 검문 자를 통과한다 — 거절되면 선언이 «조용히» 빠진다', async ({ page }) => {
  const errs = await setup(page, {});
  /* ★`_MDL_FONT_RE`(modal-block.js:256) 는 모듈 안에 있어 ★직접 못 부른다 ⇒ ★행위로 잰다:
       dataset 에 넣고 → 재렌더 → ★선언이 나왔나. 나오지 않으면 ★그 값은 못 쓴다. */
  const CANDS = [
    "'Pretendard', sans-serif",                       // fontChain('Pretendard') — 이 레포 정본(prop-text-utils.js:39)
    "'Pretendard', 'Noto Sans KR', sans-serif",       // presets/*.json 네 개가 쓰는 값
    "'Noto Sans KR', sans-serif",                     // --preset-body-family 의 부팅 기본
  ];
  const got = await page.evaluate((cands) => {
    const b = window.__b;
    return cands.map(v => {
      b.dataset.fontFamily = v;
      window.renderModalBlock(b);
      return { v, inline: b.style.fontFamily, emitted: /font-family/.test(b.style.cssText) };
    });
  }, CANDS);
  for (const r of got) console.log(`  T1-GATE ${r.emitted ? '✅나갔다' : '⛔빠졌다'}  ${JSON.stringify(r.v)} → inline ${JSON.stringify(r.inline)}`);
  for (const r of got) {
    expect(r.emitted, `★검문 자가 거절했다(선언이 조용히 빠진다) — ${JSON.stringify(r.v)}`).toBe(true);
    expect(r.inline.length, `★선언이 비었다 — ${JSON.stringify(r.v)}`).toBeGreaterThan(0);
  }
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});

test('T1-RULER ★폰트 이름이 «진짜 먹나»는 폭으로만 안다 (＋이 자가 항등식이 아님을 같이 보인다)', async ({ page }) => {
  const errs = await setup(page, {});
  const w = await page.evaluate(async ({ probeSrc }) => {
    const probe = eval(probeSrc);
    try { await document.fonts.ready; } catch {}
    const b = window.__b;
    return {
      bogus:      probe("'NoSuchFontXyz123'"),
      sans:       probe('sans-serif'),
      pretendard: probe("'Pretendard'"),
      noto:       probe("'Noto Sans KR'"),
      modalStack: getComputedStyle(b).fontFamily,
      modalWidth: probe(getComputedStyle(b).fontFamily),
    };
  }, { probeSrc: WIDTH_PROBE });
  console.log(`  T1-RULER bogus=${w.bogus} sans=${w.sans} pretendard=${w.pretendard} noto=${w.noto}`);
  console.log(`  T1-RULER 모달 스택 = ${JSON.stringify(w.modalStack)} → 폭 ${w.modalWidth}`);

  /* ★★이 자가 ★항등식이 아님 — ★음성대조를 ★같은 판에서 같이 센다.
     ⛔`bogus !== sans` 를 기대하면 안 된다: ★가짜 이름은 ★generic 으로 떨어지므로 ★같아야 맞다.
        그 «같음»이 곧 ★이 자의 ★영점이다. */
  expect(w.bogus, `★영점이 깨졌다 — 가짜 이름이 generic 과 폭이 달랐다(bogus ${w.bogus} / sans ${w.sans})`).toBe(w.sans);

  // ★주 단언 — Pretendard 는 «진짜» 먹는다. 폭이 영점과 같으면 ★그 이름은 안 먹고 있다.
  expect(w.pretendard, `★Pretendard 가 영점(${w.bogus})과 폭이 같다 ⇒ ★안 먹는다(번들 @font-face 를 의심하라: index.html:35 · assets/fonts/pretendard.css)`).not.toBe(w.bogus);

  // ★모달이 «실제로 그려지는» 스택도 영점이 아니어야 한다 — 틀린 폰트 이름을 박으면 여기서 빨개진다
  expect(w.modalWidth, `★모달 스택 ${JSON.stringify(w.modalStack)} 이 영점(${w.bogus})과 폭이 같다 ⇒ ★아무 폰트도 안 먹고 generic 으로 간다`).not.toBe(w.bogus);

  /* ⛔'Noto Sans KR' 은 ★단언하지 않는다 — ★기계마다 다르다(설치돼 있으면 영점과 달라진다).
     ★「한 환경에서만 참인 검사」를 만들지 않는다. ★대신 ★매회차 로그에 ★값을 박아,
       이 레인에서 그것이 ★영점과 같았다는 사실(2026-10-07: 778.91 == 778.91)을 ★읽을 수 있게 둔다. */
  console.log(`  T1-RULER ⚠️'Noto Sans KR' == 영점 인가: ${w.noto === w.bogus}  (참이면 ★이 기계엔 Noto 가 없다 ⇒ 그 이름을 기본값으로 쓰면 조용히 generic)`);
  expect(errs, `pageerror: ${errs[0] || ''}`).toHaveLength(0);
});
