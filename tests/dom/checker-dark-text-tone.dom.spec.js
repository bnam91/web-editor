/* checker-dark-text-tone.dom.spec.js — ★T6. 현빈 2026-10-07:
 *   「★체커 어둡게 기능을 켜면, ★안에 텍스트도 ★밝기 자동바꾸기 (★특정 컬러 지정되어있으면 ★★예외)」
 *   판정(지디 2026-10-07): ★대상 = ⒜ ★섹션 ★직속 텍스트 블럭 · ★길 = ★좁은 길(CSS 변수 직접) ·
 *     예외 = ★인라인 판정(T7 과 ★같은 관용구) · ⛔`backdropRgbAt` 안 넓힌다(소비자 9).
 *
 * ══ ★검증 — ★잰 값으로 갈았다 (2026-10-07 · ★지디가 창을 열어 ★②번 순번으로 잰다) ═══════════
 *   ★조건을 ★내가 다시 재서 섰다: disk ★7G · load ★5.56 · ★내 headless ★0 · test-results ★비우고 시작.
 *   ★`npm test` ★3541 / 3541 / fail ★0 · ★MIN_FREE 문구 ★0건
 *     (⚠️앞 회차는 ★tests 3391 / fail 447 이었고 ★그건 ★디스크 게이트가 시작을 거부한 ★«무효»였다 —
 *      ★3541 과 ★같은 수가 나와야 ★「잰 것」이다. ★이번에 ★같았다)
 *   ★★C1~C4 ★4/4 ★초록 · ★타임아웃 ★0 · load 최댓 ★8.73 · disk 최저 ★7G
 *   ★핀 `4b36eb56` ★×3 → ★C1~C4 ★전부 빨강 ★3/3 ＋ ★타임아웃 ★0 (★T7 B1~B6 도 같이 빨강)
 *     ⇒ ★★`setTone` 의 전제 단언이 ★타임아웃을 ★즉시 빨강으로 바꿨다 —
 *       ★앞 T7 쓸이에서 ★타임아웃 ★5줄이 ★「안 쟀다」였던 자리가 ★이제 ★0 이다. ★그게 이 고침의 값이다.
 *
 * ⛔★★그리고 ★내 흠 ★하나 — ★첫 회차에 ★C1~C4 가 ★4/4 ★빨강이었다(★타임아웃 0 = ★단언 빨강)
 *   ★까닭: 내가 ★대상 셀렉터를 ★«경로»로 적었다 — `… > .row > .text-block` ＋ `… > .text-block`
 *   ★실측(행위로 찍었다): 실제 경로는 ★`section-inner > ★frame-block > text-block` 이었다(★row 안이 아니다)
 *     ⇒ ★내 셀렉터 ★둘 다 ★0개를 잡았다 ⇒ ★★동기화가 ★아무것도 안 했다
 *   ⇒ ★★처방은 ★「경로를 하나 더 적기」가 ★아니다 — ★그러면 ★또 다른 경로를 놓친다.
 *     ★★«포함»을 ★«제외»로 바꿨다: 섹션 안 글자 ★전부에서 ★«자기 톤 기계를 가진 블럭» 안만 ★뺀다.
 *     ★그 셋의 명부는 ★관측자가 보는 것과 ★같아야 하므로 ★`OWN_TONE_BLOCK_SEL` ★상수 하나로 뺐다(★명부 둘 금지).
 *
 * ══ ★착수 전 실측 — ★이 카드가 ★뒤집는 것 (★판 `4b36eb56`) ═══════════════════════════════
 *   ★「체커 어둡게」는 ★이미 있다 — `sec.dataset.checkerTone='dark'` ★하나(현빈 2026-10-06 R1 「섹션마다」).
 *     ★하는 일 = ★CSS 변수 ★둘 — `--goya-checker-secbg-a/b` : `#d8d8d8/#f0f0f0` → ★`#7c7c7c/#949494`.
 *     ★실측: 체커는 ★실제로 그려지고 ★어두워진다(`rgb(216,216,216)` → `rgb(124,124,124)`).
 *   ⚠️★내 1차 측정은 ★★무효였다 — ★체커가 ★안 그려진 섹션에서 쟀다(`sec-bg-empty` 가 없었다).
 *     ⇒ ★그래서 이 spec 의 장면은 ★`bgImgEmpty='1'` ＋ 그 클래스를 ★파생시켜 세운다(앱과 ★같은 식).
 *   ★그런데 ★글자는 ★안 바뀌었다 — ★세 겹:
 *     ⒜ 관측자 `installTextToneObserver` 의 `attributeFilter` 에 ★`data-checker-tone` 이 ★없다(소스)
 *     ⒝ ★★진짜 막힘 — ★관측자를 ★손으로 깨워도(style 변경) ★안 바뀐다(★행위).
 *        까닭: `backdropRgbAt` 의 `if (backgroundImage !== 'none') return null` ⇒ ★체커에서 ★null
 *     ⒞ 관측자 대상 = ★grid·table·graph ★셋뿐 ⇒ ★텍스트 블럭은 ★명부 밖
 *   ⇒ ★★그래서 ★⒝를 ★피해 간다 — ★체커 색이 ★사는 자리(CSS 변수)를 ★직접 보는 ★좁은 길.
 *   ⇒ ★⒝ 자체(grid·table·graph 가 체커에서 안 깨어남)는 ★★별건이다.
 *
 * ══ ★양성대조 명부 — ★칸 ★넷(빨강(단언)/★빨강(타임아웃=안 쟀다)/초록/안 쟀다) ＋ ★음성대조 ═══════
 *     ㉠ ★핀 `4b36eb56`(착수 전)          → ★C1·C2·C4 ★빨강 / ★C3 ★초록(지키는 자)
 *     ㉡ 변이 M-SYNC  동기화 호출 ★둘 제거 → ★C1·C4 빨강
 *     ㉢ 변이 M-EXC   인라인 예외 판정 제거 → ★★C3 빨강(지정 컬러를 덮는다 — ★가장 나쁜 결함)
 *     ㉣ 변이 M-CSS   `.tone-auto-light` 색 규칙 제거 → ★C1 빨강(클래스는 붙는데 색이 안 바뀐다)
 *     ㉤ ★★음성대조 M-NOOP 주석 한 줄만 → ★★전부 초록이 ★정답
 *   ★각 판 ★×3 · ★원복 ★해시 · ★판마다 `df` · ★★변이 뒤 `node --check`(ESM 은 ★`.mjs` 로 복사해야 통한다 — 실측)
 *   ⚠️★2026-10-07 T7 쓸이에서 ★★음성대조가 ★1/3 빨강이었다(load 69.91) ⇒ ★★계측기가 ★부하에 흔들린다
 *     ⇒ ★★이 spec 도 ★조용한 창(load 최댓값 ≤8)에서 재야 ★수가 선다. ⛔시끄러운 판의 빨강은 ★양성이 아니다.
 *
 * ★`clickLst` 꼴을 ★여기도 — ★패널 손잡이를 누르기 «전»에 ★있나를 ★단언한다(★타임아웃을 ★단언 빨강으로).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 섹션 하나 — ★체커가 «실제로 그려지는» 꼴로 세운다(⛔dataset 만 주면 안 그려진다 · 실측). */
async function scene(page, { checker = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((checker) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="cS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="row" id="cR" data-layout="stack"></div></div></div>`);
    const s = document.getElementById('cS');
    if (checker) {
      /* ★정본은 dataset 이고 클래스는 «거기서 파생»한다 — js/props/prop-section.js:111 ＋ save-load.js:1100 과 ★같은 식 */
      s.dataset.bgImgEmpty = '1';
      s.classList.toggle('sec-bg-empty', s.dataset.bgImgEmpty === '1' && !s.dataset.bgImg);
    }
  }, checker);
  await page.waitForTimeout(250);
  return errs;
}
/** 섹션 직속 텍스트 블럭 둘 — ⑴색을 ★안 고른 것 ⑵★인라인으로 고른 것(예외가 될 것). */
async function addTexts(page) {
  return page.evaluate(async () => {
    const s = document.getElementById('cS'); s.classList.add('selected');
    window.addTextBlock?.('body');
    await new Promise(r => setTimeout(r, 260));
    window.addTextBlock?.('body');
    await new Promise(r => setTimeout(r, 260));
    const els = [...document.querySelectorAll('#cS .text-block .tb-body')];
    if (els.length < 2) return { n: els.length };
    els[0].id = 'cAuto';                    // 자동 대상
    els[1].id = 'cPicked';
    els[1].style.color = '#1a1a1a';         // ★사람이 «인라인으로» 고른 색 — 이게 예외다
    return { n: els.length };
  });
}
/** ★체커가 ★정말 어두워졌나 ＋ 두 글자의 ★computed 색 ＋ 클래스. */
const read = (page) => page.evaluate(() => {
  const s = document.getElementById('cS');
  const a = document.getElementById('cAuto'), p = document.getElementById('cPicked');
  const cs = getComputedStyle(s);
  return {
    checkerImg: cs.backgroundImage === 'none' ? 'none' : cs.backgroundImage.slice(0, 44),
    secbgA: cs.getPropertyValue('--goya-checker-secbg-a').trim(),
    autoColor: a ? getComputedStyle(a).color : null,
    autoCls: a ? a.classList.contains('tone-auto-light') : null,
    pickedColor: p ? getComputedStyle(p).color : null,
    pickedCls: p ? p.classList.contains('tone-auto-light') : null,
    pickedInline: p ? (p.style.color || '') : null,
  };
});
/** ★패널 라디오를 누르기 «전»에 ★있나를 단언한다 — ⛔없는 셀렉터 click 은 30초 타임아웃으로 죽고
 *  그 빨강은 ★«단언 빨강»이 아니라 ★칸 ②「안 쟀다」가 된다(2026-10-07 T7 에서 실측한 흠). */
async function setTone(page, dark) {
  const id = dark ? 'sec-checker-tone-on' : 'sec-checker-tone-off';
  // 섹션을 골라 패널을 띄운다(사람이 하는 순서)
  await page.evaluate(() => {
    document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
    const s = document.getElementById('cS'); s.classList.add('selected');
    window.showSectionProperties?.(s);
  });
  await page.waitForTimeout(340);
  const there = await page.evaluate((id) => !!document.getElementById(id), id);
  expect(there, `[전제] 섹션 패널의 「체커 어둡게」 라디오(${id})가 없다 — 누를 수 없다`).toBe(true);
  await page.click(`#${id}`);
  await page.waitForTimeout(360);
}

/* ══ C1 ★자동 전환이 먹나 ═════════════════════════════════════════════════════════════ */
test('C1 ★체커 어둡게를 켜면 ★섹션 직속 글자가 ★밝아진다', async ({ page }) => {
  const errs = await scene(page, { checker: true });
  expect(errs).toEqual([]);
  expect((await addTexts(page)).n, '[전제] 글자 블럭 둘을 만들었다').toBe(2);
  const before = await read(page);
  /* ★[전제] 체커가 ★실제로 그려져 있고 ★아직 밝다 — 안 그려진 섹션에서 재면 아무것도 안 잰다(내 1차 흠) */
  expect(before.checkerImg, '[전제] 체커가 그려져 있다').toContain('conic-gradient');
  expect(before.secbgA, '[전제] 아직 밝은 체커다').toBe('#d8d8d8');
  expect(before.autoCls, '[전제] 아직 자동 클래스가 없다').toBe(false);

  await setTone(page, true);
  const after = await read(page);
  expect(after.secbgA, '★체커가 안 어두워졌다 — 이 카드와 무관한 자리가 깨졌다').toBe('#7c7c7c');
  expect(after.autoCls, '★자동 클래스가 안 붙었다 — 동기화가 안 불렸다').toBe(true);
  expect(after.autoColor, '★클래스는 붙었는데 ★색이 안 바뀌었다 — CSS 규칙이 안 먹는다')
    .toBe('rgb(242, 242, 242)');
});

/* ══ C3 ★★음성대조 — 지정 컬러는 ★안 건드린다 (현빈이 ★괄호로 적은 그 예외) ═══════════ */
test('C3 ★★지정 컬러는 ★안 건드린다 — 인라인으로 고른 글자는 ★그대로다(현빈의 예외)', async ({ page }) => {
  await scene(page, { checker: true });
  expect((await addTexts(page)).n, '[전제]').toBe(2);
  const before = await read(page);
  expect(before.pickedInline, '[전제] 사람이 인라인으로 색을 골랐다').toBe('rgb(26, 26, 26)');

  await setTone(page, true);
  const after = await read(page);
  /* ★★이게 이 카드의 ★핵이다 — ⑴만 하면 ★사람이 고른 색을 ★덮는다(★그게 더 나쁜 결함이다 · 지디) */
  expect(after.pickedCls, '★★지정 컬러에 자동 클래스가 붙었다 — 사람이 고른 색을 덮는다').toBe(false);
  expect(after.pickedColor, '★★지정 컬러가 바뀌었다 — 현빈이 괄호로 적은 그 예외가 깨졌다')
    .toBe('rgb(26, 26, 26)');
  /* ★대조 — 같은 섹션의 «안 고른» 글자는 ★바뀌었다(둘이 같이 안 바뀌면 이 자는 아무것도 안 잰다) */
  expect(after.autoColor, '[대조] 안 고른 글자는 밝아져야 한다 — 안 바뀌면 C3 가 「아무것도 안 함」을 통과시킨다')
    .toBe('rgb(242, 242, 242)');
});

/* ══ C4 ★끄면 되돌아온다 ══════════════════════════════════════════════════════════════ */
test('C4 ★체커를 ★끄면 글자가 ★되돌아온다(클래스도 걷힌다)', async ({ page }) => {
  await scene(page, { checker: true });
  expect((await addTexts(page)).n, '[전제]').toBe(2);
  const orig = await read(page);
  await setTone(page, true);
  expect((await read(page)).autoCls, '[전제] 먼저 켜서 붙였다').toBe(true);

  await setTone(page, false);
  const off = await read(page);
  expect(off.secbgA, '[전제] 체커가 밝게 돌아왔다').toBe('#d8d8d8');
  expect(off.autoCls, '★끄었는데 자동 클래스가 남았다 — 흰 배경에 흰 글자가 된다').toBe(false);
  expect(off.autoColor, `★끄었는데 색이 원래로 안 돌아왔다(처음 ${orig.autoColor})`).toBe(orig.autoColor);
});

/* ══ C2 ★저장 → 다시 열기 ════════════════════════════════════════════════════════════ */
test('C2 ★저장→다시 열기 뒤에도 ★자동 밝기가 선다(로드 자리가 다시 맞춘다)', async ({ page }) => {
  await scene(page, { checker: true });
  expect((await addTexts(page)).n, '[전제]').toBe(2);
  await setTone(page, true);
  const before = await read(page);
  expect(before, '[전제] 켜진 상태').toMatchObject({ autoCls: true, autoColor: 'rgb(242, 242, 242)', pickedCls: false });

  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(450);
  const after = await page.evaluate(() => {
    const s = document.querySelector('.section-block[data-checker-tone="dark"]');
    const a = document.getElementById('cAuto'), p = document.getElementById('cPicked');
    return {
      secThere: !!s,
      autoCls: a ? a.classList.contains('tone-auto-light') : null,
      autoColor: a ? getComputedStyle(a).color : null,
      pickedCls: p ? p.classList.contains('tone-auto-light') : null,
      pickedColor: p ? getComputedStyle(p).color : null,
    };
  });
  expect(after.secThere, '★왕복 뒤 체커 톤 dataset 이 사라졌다').toBe(true);
  /* ★★클래스는 ★저장본에 실릴 수도, 걷힐 수도 있다 — ★그래서 로드 자리가 ★다시 세운다(save-load.js).
     ⇒ ★여기서 재는 것은 ★«클래스가 살아 돌아왔나»가 아니라 ★★«결과 색이 맞나»다. */
  expect(after.autoColor, '★왕복 뒤 자동 밝기가 안 섰다 — 로드 자리가 다시 안 맞췄다').toBe('rgb(242, 242, 242)');
  expect(after.autoCls, '★왕복 뒤 클래스가 안 붙었다').toBe(true);
  expect(after.pickedCls, '★왕복 뒤 지정 컬러에 클래스가 붙었다 — 예외가 깨졌다').toBe(false);
  expect(after.pickedColor, '★왕복 뒤 지정 컬러가 바뀌었다').toBe('rgb(26, 26, 26)');
});
