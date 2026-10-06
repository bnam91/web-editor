/* effects-registry.dom.spec.js — 효과 «명부»와 ★「고르는 목록」 (현빈 2026-10-06 발주 · 지디 승인)
 *
 * ★발주 원문 — 「텍스트 블럭 등 이펙트 섹션에 지금은 ＋만 눌리면 바로 리플렉션이 적용되는데,
 *   바로 적용되는 것이 아니라 여기에 쉐도우도 넣어주고 리플렉션도 들어갈 것임(계속 이펙트는 추가예정)」
 * ★★이 파일이 재는 ★합격 기준 = 「효과를 ★명부에 ★한 줄 더하면 ★목록에 뜬다」(A1).
 *   ⇒ ★가짜 효과를 하나 «등록만» 해서 목록·카드에 뜨는지 단언한다. 그게 「계속 추가」의 ★자다.
 * ★자기 전제를 단언한다 — 명부의 «수»를 ⛔숫자로 박지 않고 ★판에서 읽어(window.fxTypeKeys) 등록 전/후를 견준다.
 * ★음성대조 A2 — 등록하지 «않은» 이름은 목록에 0건(목록을 무조건 전부 그리는 판을 잡는다).
 * ★A7 은 「그림자는 반사에 ★안 비친다」는 ★실측을 «기록»한다. 지디 1차 판정은 반대였으나 이 실측을 보고
 *   ★철회됐다(2026-10-06) ⇒ ⛔「미해결 어긋남」이 ★아니다. 비추게 만드는 길은 ★별건으로 뗐다.
 * ★양성대조(돌연변이) — ⛔핀은 «기능이 없어서» 빨강이라 약하다. ★같은 판에서 조건만 바꿔 빨강을 만들었다.
 *   ★실제로 돌렸다(2026-10-06 · 각 ×3 · ⛔1회로는 안 선다) — «어느 시험이 빨강이었나» 명부:
 *     ⓪ 돌연변이 «없이» 먼저        ⇒ A1·A3·A4 ★3 passed ×3  (★계측기 대조 — 이게 초록이어야 아래가 뜻이 있다)
 *     ㉠ `missing.map(...)` → 리터럴 `[reflect, shadow]`           ⇒ ★A1 빨강 3/3 「★목록도 «정확히 하나» 늘었다」
 *     ㉡ fxTypesFor 의 supports 가름 제거(전부 돌려줌)              ⇒ ★A3 빨강 3/3 「★텍스트 — 그림자 없음」
 *     ㉢ wireFxSection 을 옛 «누르면 즉시 추가»로 되돌림            ⇒ ★A4 빨강 3/3 「eT: ★열기만 해서는 키가 0개」
 *     ㉣ js/frame-geometry.js applyHostMarginY no-op               ⇒ ★여백 «소비자 둘»이 같이 빨강 3/3
 *        tests/unit/frame-geometry.test.mjs ④-a(pass 21/fail 1) ＋ effects-reflection.dom.spec.js R3(기대 "46px" / 받은 "")
 *        ⇒ 「공용 본문 무력화 → 소비자 수만큼 빨강」이 선다(지디 요구 쌍).
 *   ⛔내 대조 하네스도 한 번 틀렸다 — `set -e` 가 «빨강이 기대값인» 시험에서 스크립트를 죽였다(고쳐서 다시 돌렸다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/effects-registry.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

/* 장면: 섹션 하나 — [텍스트] [에셋(주황)] [도형 래퍼(100×100 초록)] [아래 텍스트] — 고정 id (effects-reflection 과 같은 꼴) */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="eS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="eI">
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR1" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR2" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR3" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:260px"></div></div></div>`);
    const { block: tb } = window.makeTextBlock('h1'); const tf = window._makeTextFrame();
    window.applyTextOpts(tb, tf, {}, 'h1'); tf.appendChild(tb); tb.id = 'eT'; tf.id = 'eTF';
    const h = tb.querySelector('[class^="tb-"]'); h.textContent = '███'; h.style.color = '#2d6fe8'; h.style.fontSize = '80px'; h.style.lineHeight = '1';
    document.getElementById('eR1').appendChild(tf);
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 120; const x = cv.getContext('2d'); x.fillStyle = '#ff6600'; x.fillRect(0, 0, 300, 120);
    const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'eA'; document.getElementById('eR2').appendChild(ab);
    window.rebindAll?.(); window.updateAssetBlock('eA', { imgSrc: cv.toDataURL('image/png') });
    const { block: sb } = window.makeShapeBlock('rectangle'); sb.id = 'eSh';
    const ss = document.createElement('div'); ss.className = 'frame-block'; ss.id = 'eShF';
    ss.dataset.width = '100'; ss.dataset.height = '100'; ss.style.width = '100px'; ss.style.height = '100px';
    ss.appendChild(sb); document.getElementById('eR3').appendChild(ss);
    sb.querySelectorAll('[fill]').forEach(n => { if (n.getAttribute('fill') !== 'none') n.setAttribute('fill', '#00aa44'); });
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  await page.waitForTimeout(300);
  return errs;
}

/** 블럭을 진짜 마우스로 고른다(패널이 그 블럭으로 바뀐다). */
const pick = async (page, id) => {
  const p = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + 6, q.top + q.height / 2]; }, id);
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(300);
};
/** 그 패널의 «추가 목록» 을 읽는다 — 머리 option 과 고를 수 있는 효과들. */
const addList = (page, P) => page.evaluate((P) => {
  const a = document.getElementById(`${P}-fx-add`);
  if (!a) return null;
  return { tag: a.tagName, head: a.options[0].value, opts: [...a.options].slice(1).map(o => ({ v: o.value, t: o.textContent.trim() })) };
}, P);
/** 그 블럭의 fx* dataset 키 전부. */
const ds = (page, id) => page.evaluate((id) => Object.fromEntries(Object.entries(document.getElementById(id).dataset).filter(([k]) => k.startsWith('fx'))), id);
/** 지금 패널에 뜬 효과 카드의 종류들. */
const cards = (page, P) => page.evaluate((P) => [...document.querySelectorAll(`#${P}-fx-list .prop-cell-card`)].map(e => e.dataset.fxType), P);

/* ══ A0 전제 ══ */
test('A0 전제 — 명부 다리가 서고(window.fxTypeKeys 등) 식구에 반사·그림자가 있다 · ★수는 판에서 읽는다', async ({ page }) => {
  const errs = await setup(page);
  const api = await page.evaluate(() => ['registerFxType', 'unregisterFxType', 'fxTypeKeys', 'fxTypesFor', 'fxSectionHtml', 'wireFxSection', 'watchAllFx'].map(k => typeof window[k]));
  expect(api, '명부 다리 일곱').toEqual(Array(7).fill('function'));
  const keys = await page.evaluate(() => window.fxTypeKeys());
  expect(keys, '★반사·그림자가 등록돼 있다').toEqual(expect.arrayContaining(['reflect', 'shadow']));
  expect(keys.length, '★이 수는 이 판에서 읽은 값이다(⛔박지 않는다) — 최소 둘').toBeGreaterThanOrEqual(2);
  /* 효과 1개 = «새 파일 1 + index.html 1줄» 이 ★사실인지 — 패널 셋은 명부 다리만 부른다 */
  for (const f of ['js/props/prop-text-template.js', 'js/props/prop-asset.js', 'js/props/prop-shape.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    expect(src.includes('fxSectionHtml') || src.includes('wireFxSection'), `${f} 가 명부 다리를 부른다`).toBe(true);
    expect(/fxReflect|fxShadow/.test(src), `⛔${f} 가 «특정 효과»를 직접 알지 않는다`).toBe(false);
  }
  expect(errs).toEqual([]);
});

/* ══ A1 ★★합격 기준 — 「한 줄 더하면 목록에 뜬다」 ══ */
test('A1 ★★가짜 효과를 «등록만» 하면 목록에 뜬다(옵션 +1) · 고르면 카드가 생긴다 · 등록 취소하면 사라진다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eSh');
  const n0 = (await page.evaluate(() => window.fxTypeKeys())).length;
  const before = await addList(page, 'shape');
  expect(before, 'shape 패널에 추가 목록').not.toBeNull();
  expect(before.opts.map(o => o.v), '★전제 — 가짜는 아직 없다').not.toContain('__fake');

  /* ★등록만 한다 — 패널 파일·그리개를 한 줄도 안 건드린다 */
  const n1 = await page.evaluate(() => window.registerFxType({
    key: '__fake', label: '가짜효과',
    has: (el) => el.dataset.fxFakeOn === '1',
    add: (el) => { el.dataset.fxFakeOn = '1'; },
    card: (el, P) => `<div class="prop-cell-card" id="${P}-fxfake-card" data-fx-type="__fake"></div>`,
    wire: () => {},
  }));
  expect(n1, '★전제 — 명부가 «정확히 하나» 늘었다').toBe(n0 + 1);
  await pick(page, 'eT'); await pick(page, 'eSh');          // 패널 다시 그리기(사람이 하는 순서)
  const after = await addList(page, 'shape');
  expect(after.opts.length, '★목록도 «정확히 하나» 늘었다').toBe(before.opts.length + 1);
  const fake = after.opts.find(o => o.v === '__fake');
  expect(fake, '★가짜가 목록에 떴다 — 이것이 합격 기준이다').toBeTruthy();
  expect(fake.t, '★식구가 준 label 이 그대로 보인다').toBe('가짜효과');

  await page.selectOption('#shape-fx-add', '__fake'); await page.waitForTimeout(250);
  expect(await cards(page, 'shape'), '★고르면 그 식구의 카드가 생긴다').toContain('__fake');
  expect(await page.evaluate(() => document.getElementById('eSh').dataset.fxFakeOn)).toBe('1');

  const n2 = await page.evaluate(() => { document.getElementById('eSh').removeAttribute('data-fx-fake-on'); return window.unregisterFxType('__fake'); });
  expect(n2, '치운 뒤 = 처음 수').toBe(n0);
  await pick(page, 'eT'); await pick(page, 'eSh');
  expect((await addList(page, 'shape')).opts.map(o => o.v), '등록을 치우면 목록에서도 사라진다').not.toContain('__fake');
  expect(errs).toEqual([]);
});

/* ══ A2 음성대조 ══ */
test('A2 음성 — 등록하지 «않은» 이름은 목록에 0건(목록을 무조건 전부 그리는 판을 잡는다)', async ({ page }) => {
  await setup(page);
  await pick(page, 'eSh');
  const opts = (await addList(page, 'shape')).opts.map(o => o.v);
  expect(opts, '★유령 이름 없음').not.toContain('__ghost');
  const keys = await page.evaluate(() => window.fxTypeKeys());
  expect(opts.every(v => keys.includes(v)), '★목록의 모든 항목이 명부에 있다 — 명부 밖 0건').toBe(true);
});

/* ══ A3 supports — 목록은 블럭마다 다르다 ══ */
test('A3 ★supports — 그림자는 도형·에셋에만 뜨고 ★텍스트엔 «안» 뜬다(텍스트는 제 「Shadow」 절이 있다) · 반사는 셋 다', async ({ page }) => {
  const errs = await setup(page);
  const got = {};
  for (const [id, P] of [['eT', 'txt'], ['eSh', 'shape'], ['eA', 'asset']]) { await pick(page, id); got[P] = (await addList(page, P)).opts.map(o => o.v); }
  expect(got.txt, '★텍스트 — 그림자 없음').not.toContain('shadow');
  expect(got.txt, '텍스트 — 반사 있음').toContain('reflect');
  expect(got.shape, '도형 — 둘 다').toEqual(expect.arrayContaining(['reflect', 'shadow']));
  expect(got.asset, '에셋 — 둘 다').toEqual(expect.arrayContaining(['reflect', 'shadow']));
  /* ★그 가름이 «한 자리»에 있다 — supports 가 유일한 판정자다 */
  expect(await page.evaluate(() => {
    const t = window.fxTypesFor(document.getElementById('eT')).map(x => x.key);
    const s = window.fxTypesFor(document.getElementById('eSh')).map(x => x.key);
    return { t, s };
  }), 'fxTypesFor 가 같은 답을 준다').toEqual({ t: expect.not.arrayContaining(['shadow']), s: expect.arrayContaining(['shadow']) });
  expect(errs).toEqual([]);
});

/* ══ A4 ★「바로 적용」이 끝났다 ══ */
test('A4 ★목록을 열어도 아무것도 안 붙는다 — 고른 ★그것만 붙는다(반사 · 그림자 각각 · 도형·에셋·텍스트 전수)', async ({ page }) => {
  const errs = await setup(page);
  const open = async (P) => { const p = await page.evaluate((P) => { const e = document.getElementById(`${P}-fx-add`); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, P);
    await page.mouse.click(p[0], p[1]); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
  for (const [id, P] of [['eT', 'txt'], ['eSh', 'shape'], ['eA', 'asset']]) {
    await pick(page, id);
    await open(P);
    expect(await ds(page, id), `${id}: ★열기만 해서는 키가 0개`).toEqual({});
    expect(await cards(page, P), `${id}: 카드도 0개`).toEqual([]);
  }
  /* 도형에서 ★그림자를 고르면 — 그림자만 붙는다(반사 키는 0) */
  await pick(page, 'eSh');
  await page.selectOption('#shape-fx-add', 'shadow'); await page.waitForTimeout(250);
  expect(await ds(page, 'eSh'), '★그림자만').toEqual({ fxShadow: 'on' });
  expect(await cards(page, 'shape')).toEqual(['shadow']);
  /* 에셋에서 ★반사를 고르면 — 반사만 붙는다(그림자 키는 0) */
  await pick(page, 'eA');
  await page.selectOption('#asset-fx-add', 'reflect'); await page.waitForTimeout(250);
  expect(await ds(page, 'eA'), '★반사만').toEqual({ fxReflect: 'on' });
  expect(await cards(page, 'asset')).toEqual(['reflect']);
  expect(errs).toEqual([]);
});

/* ══ A5 겹침 — 종류당 하나 · 여러 종류는 겹친다 ══ */
test('A5 겹침 — 도형에 둘 다 걸면 카드 2개 · box-reflect 와 filter 가 ★둘 다 산다(서로 안 지운다) · 같은 종류는 목록에서 사라진다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eSh');
  await page.selectOption('#shape-fx-add', 'reflect'); await page.waitForTimeout(250);
  await page.selectOption('#shape-fx-add', 'shadow'); await page.waitForTimeout(250);
  expect(await cards(page, 'shape'), '카드 둘').toEqual(['reflect', 'shadow']);
  const st = await page.evaluate(() => { const e = document.getElementById('eSh'); return { r: e.style.webkitBoxReflect, f: e.style.filter }; });
  expect(st.r, '반사가 산다').toContain('below');
  expect(st.f, '그림자가 산다').toContain('drop-shadow');
  expect(await page.evaluate(() => window.fxTypesFor(document.getElementById('eSh')).filter(t => !t.has(document.getElementById('eSh'))).length), '둘 다 걸렸으면 더할 것이 없다').toBe(0);
  expect(await addList(page, 'shape'), '★더할 것이 없으면 목록 자체가 없다').toBeNull();
  /* 하나를 ✕ 하면 그 하나만 목록으로 돌아온다 */
  await page.evaluate(() => window.setFxShadow(document.getElementById('eSh'), { state: 'none' }));
  await pick(page, 'eT'); await pick(page, 'eSh');
  expect((await addList(page, 'shape')).opts.map(o => o.v)).toEqual(['shadow']);
  expect(await page.evaluate(() => document.getElementById('eSh').style.webkitBoxReflect), '★반사는 안 건드려졌다').toContain('below');
  expect(errs).toEqual([]);
});

/* ══ A6 그림자 — 눈 · ✕ · ⌘Z 한 걸음 · 저장 왕복 · 범위/기본값은 텍스트 「Shadow」 절에서 빌린 값 ══ */
test('A6 그림자 카드 — 값(X·Y·Blur·불투명도·색상)이 텍스트 「Shadow」 절 정본에서 왔다 · 눈 끔 = 값 보존 · ⌘Z 한 걸음 · 저장 왕복', async ({ page }) => {
  const errs = await setup(page);
  /* ★전제 — 기대값을 손으로 박지 않고 «빌려온 그 소스»에서 읽는다 */
  const txtSrc = fs.readFileSync(path.join(ROOT, 'js/props/prop-text-wireup-shadow.js'), 'utf8');
  const m = txtSrc.match(/export const SHADOW_DEFAULTS = \{([\s\S]*?)\};/);
  expect(m, '전제 — 텍스트 Shadow 정본이 있다').toBeTruthy();
  const want = {};
  /* ⛔matchAll 의 항목은 [전체, 키, 값] 이다 — [k,v] 로 분해하면 k=전체·v=키가 된다(2026-10-06 내가 당했다). */
  for (const mm of m[1].matchAll(/(\w+):\s*([^,\n]+)/g)) want[mm[1]] = mm[2].trim().replace(/['"]/g, '').replace(/\s*\/\/.*$/, '').trim();
  expect(want.x, '★전제 — 정본에서 «값»을 뽑았다(⛔undefined 를 기대값으로 쓰지 않는다)').toBeDefined();
  expect([want.x, want.y, want.blur, want.color, want.alpha].every(v => v !== undefined), '★전제 — 다섯 칸 다 뽑혔다').toBe(true);
  const mine = await page.evaluate(() => window.FX_SHADOW_DEFAULTS);
  expect([mine.x, mine.y, mine.blur, mine.color, mine.op].map(String), '★그 절의 기본값 그대로(⛔내가 고른 수가 아니다)')
    .toEqual([want.x, want.y, want.blur, want.color, want.alpha]);

  await pick(page, 'eA');
  await page.selectOption('#asset-fx-add', 'shadow'); await page.waitForTimeout(250);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#asset-fxsh-body .prop-label')].map(e => e.textContent.trim()));
  expect(rows, '칸 = 그 절과 같은 말').toEqual(['X', 'Y', 'Blur', '불투명도', '색상']);
  /* ⚠️브라우저가 색을 «앞»으로 돌려 적는다(drop-shadow(rgba(...) 2px 2px 4px)) — 순서를 박지 않고 조각으로 잰다 */
  const f0 = await page.evaluate(() => document.getElementById('eA').style.filter);
  expect(f0, '기본값이 그대로 그려졌다').toContain('2px 2px 4px');
  expect(f0, '불투명도 50% = rgba 0.5').toContain('0.5');

  await page.evaluate(() => window.setFxShadow(document.getElementById('eA'), { x: 9, blur: 20, op: 80, color: '#112233' }));
  expect(await ds(page, 'eA')).toEqual({ fxShadow: 'on', fxShadowX: '9', fxShadowBlur: '20', fxShadowOp: '80', fxShadowColor: '#112233' });
  await page.evaluate(() => window.setFxShadow(document.getElementById('eA'), { state: 'off' }));
  expect((await ds(page, 'eA')).fxShadow, '눈 끔').toBe('off');
  expect(await page.evaluate(() => document.getElementById('eA').style.filter), '끄면 안 그린다').toBe('');
  expect((await ds(page, 'eA')).fxShadowX, '★값은 남는다').toBe('9');

  /* ⌘Z 한 걸음 — 눈 끔 → 되돌리면 켠 상태 */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect((await ds(page, 'eA')).fxShadow, '⌘Z 1 = 끄기 전').toBe('on');

  /* 저장 왕복 */
  const st0 = await page.evaluate(() => document.getElementById('eA').style.filter);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.evaluate(() => window.applyZoom?.(100)); await page.waitForTimeout(400);
  expect(await ds(page, 'eA'), '저장 왕복 — 키 유지').toEqual({ fxShadow: 'on', fxShadowX: '9', fxShadowBlur: '20', fxShadowOp: '80', fxShadowColor: '#112233' });
  expect(await page.evaluate(() => document.getElementById('eA').style.filter), '저장 왕복 — 인라인 유지').toBe(st0);
  expect(errs).toEqual([]);
});

/* ══ A7 ★실측 기록 — 그림자는 반사에 «안» 비친다 (⚠️지디 판정과 ★다르다 — 미해결) ══ */
test('A7 ⚠️실측 — 크로미움은 반사(-webkit-box-reflect)에 그림자(filter)를 ★안 비춘다 · 양성＋음성대조 · ⛔이 사실이 바뀌면 여기서 빨강', async ({ page }) => {
  const errs = await setup(page);
  /* ★지디 1차 판정은 「비치는 것이 맞다」였고, 조건 ㉠(「먼저 재라 · 이상하면 멈추고 알려라」)대로 재 보니 반대라
     멈추고 알렸다 ⇒ ★판정이 철회됐다(2026-10-06). ⛔이 시험은 «결정»이 아니라 «지금 사실»을 잠근다.
     비추게 고치면(별건) 여기가 빨강이 되고, 그때 이 기록을 다시 쓴다.
     ★계측기 — 그림자를 ★가로로(x=+30 · blur 0) 민다 ⇒ 「진짜」 그림자는 블럭 ★옆에만 있고 반사 띠에 못 닿는다(음성대조 ㉡).
       반사가 그림자를 비춘다면 ★같은 x 자리가 반사 띠 안에서도 어두워져야 한다. */
  const sh = (patch) => page.evaluate((p) => window.setFxShadow(document.getElementById('eSh'), p), patch);
  const rf = (patch) => page.evaluate((p) => window.setFxReflect(document.getElementById('eSh'), p), patch);
  await page.evaluate(() => { document.getElementById('eSh').scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(250);
  const P = await page.evaluate(() => {
    const q = document.getElementById('eSh').getBoundingClientRect();
    const xs = Math.round(q.right + 10);                                   /* x=+30 그림자가 덮는 자리(블럭 밖) */
    return { side: Array.from({ length: 6 }, (_, i) => [xs, Math.round(q.top + 10 + i * 14)]),   /* 블럭 «옆» */
             band: Array.from({ length: 8 }, (_, i) => [xs, Math.round(q.bottom + 6 + i * 9)]),   /* 반사 «띠» */
             inner: Array.from({ length: 8 }, (_, i) => [Math.round(q.left + q.width / 2), Math.round(q.bottom + 6 + i * 9)]) };
  });
  const read = async (pts) => {
    const buf = await page.screenshot();
    return page.evaluate(async ({ b64, pts }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      return pts.map(([X, Y]) => { const d = x.getImageData(X, Y, 1, 1).data; return [d[0], d[1], d[2]]; });
    }, { b64: buf.toString('base64'), pts });
  };
  const diff = (a, b) => a.reduce((n, p, i) => n + Math.abs(p[0] - b[i][0]) + Math.abs(p[1] - b[i][1]) + Math.abs(p[2] - b[i][2]), 0);

  const base = { side: await read(P.side), band: await read(P.band), inner: await read(P.inner) };
  await rf({ state: 'on', gap: 0, len: 100, op: 100 }); await page.waitForTimeout(300);
  const ref = { band: await read(P.band), inner: await read(P.inner) };
  /* ★양성대조 — 반사가 «정말로» 그 띠에 있다(없으면 아래 「안 비친다」는 «안 재고 있다»와 구분이 안 된다) */
  const dRefInner = diff(ref.inner, base.inner);
  expect(dRefInner, '★양성대조 — 반사가 띠에 보인다').toBeGreaterThan(60);

  await sh({ state: 'on', x: 30, y: 0, blur: 0, op: 100, color: '#000000' }); await page.waitForTimeout(300);
  const both = { side: await read(P.side), band: await read(P.band) };
  /* ★양성대조 ② — 그림자가 «정말로» 그려졌다(블럭 옆이 까매졌다) */
  const dSide = diff(both.side, base.side);
  expect(dSide, '★양성대조② — 그림자가 블럭 옆에 그려졌다').toBeGreaterThan(200);
  /* ★주 단언(실측 기록) — 같은 x 인데 ★반사 띠는 안 바뀐다 */
  const dBand = diff(both.band, ref.band);
  console.log(`[A7] 양성①반사 ${dRefInner} · 양성②그림자(옆) ${dSide} · ★반사 띠 변화 ${dBand} ⇒ 그림자는 반사에 ${dBand > 60 ? '비친다' : '안 비친다'}`);
  expect(dBand, '⚠️실측 — 반사 띠는 그림자로 안 바뀐다(= 반사에 그림자가 «안» 비친다)').toBeLessThan(60);

  /* ★그 사실이 코드에도 적혀 있다 — 기록과 코드가 갈리지 않게 */
  const src = fs.readFileSync(path.join(ROOT, 'js/effects-shadow.js'), 'utf8');
  expect(/SHADOW_SHOWS_IN_REFLECTION\s*=\s*false/.test(src), '★코드의 실측 기록도 false').toBe(true);
  expect(errs).toEqual([]);
});

/* ══ A8 옛 문서 바이트 동일 ══ */
test('A8 ★그림자 키가 없는 블럭은 «안 만진다» · 켰다 ✕ 하면 블럭·섹션 outerHTML 이 켜기 전과 바이트 동일', async ({ page }) => {
  await setup(page);
  const snap = () => page.evaluate(() => ({ a: document.getElementById('eA').outerHTML, s: document.getElementById('eShF').outerHTML, sec: document.getElementById('eS').outerHTML }));
  /* ★기준선은 «패널을 한 번 연 뒤»에 뜬다 — 패널 열기는 그림자와 무관하게 캔버스에 쓴다(실측 2026-10-06:
     showShapeProperties 의 _extendShapeFrameToSection 이 frame-block 에 max-width·flex-shrink 를, 손잡이에 style="" 을 쓴다).
     ⛔그걸 그림자 탓으로 돌리지 않는다. 여기서 재는 것은 «그림자가 켜기 전으로 돌아오나» 하나다. */
  for (const id of ['eT', 'eSh', 'eA']) await pick(page, id);
  await page.evaluate(() => window.deselectAll?.());
  const before = await snap();
  for (const id of ['eSh', 'eA']) await page.evaluate((id) => window.setFxShadow(document.getElementById(id), { state: 'on', x: 7, y: 7, blur: 12, op: 70 }), id);
  expect((await snap()).sec, '전제 — 켠 동안은 다르다').not.toBe(before.sec);
  for (const id of ['eSh', 'eA']) await page.evaluate((id) => window.setFxShadow(document.getElementById(id), { state: 'none' }), id);
  expect(await snap(), '★✕ 뒤 = 켜기 전 바이트').toEqual(before);
});
