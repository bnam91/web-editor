/* effects-frame-shadow.dom.spec.js — 10171a7 「프레임블럭에 이펙트에 쉐도우 추가기능 넣어줘」 (현빈 2026-10-17)
 *
 * ★착수 전 실측(Planner) — 프레임 패널엔 이펙트 절 자체가 ★0건이었다:
 *   `grep -n "fxSectionHtml|wireFxSection|watchAllFx|이펙트|Effects" js/props/prop-frame.js` → rc=1 n=0
 *   ★양성대조(같은 자, 같은 줄): `js/props/prop-shape.js` → rc=0 n=2
 *   ⇒ 그림자 식구(js/effects-shadow.js)는 ★이미 등록돼 있었지만 `supports` 가 도형·에셋만 ★허용했고,
 *     패널에 절 자체가 없어 ★「프레임에 그림자가 뜬다」를 재는 검사가 ★0건이었다.
 *   ★선례 = tests/dom/effects-registry.dom.spec.js A3(「supports — 목록은 블럭마다 다르다」) 의 ★꼴을 그대로.
 *
 * ★★이 파일이 잠그는 것 ⑥⑦ (지디 설계):
 *   ㉠ 전제 — window.fxTypesFor 다리가 산다 ＋ window.fxTypeKeys() 가 'shadow' 를 포함한다
 *   ㉡ window.fxTypesFor(<frame-block>) 가 'shadow' 를 포함한다(supports 가 프레임을 허용)
 *   ㉢ 패널 — prop-frame 가 그린 절에 #ss-fx-add 가 있고, 거기서 shadow 를 고르면 카드가 생긴다
 *   ㉣ 걸린 뒤 프레임 style.filter 에 drop-shadow 조각이 있다(⛔색 순서를 박지 않는다 — A6 이 적어 둔 그 함정)
 *   ㉤ 음성대조 보존 — 텍스트엔 ★여전히 안 뜬다(effects-registry A3 와 같은 단언을 여기도 한 줄)
 *
 * ★★음성대조(⒞ 무력화) — 아래 중 하나를 깨면 이 파일이 ★빨개져야 한다:
 *   변이 A: js/effects-shadow.js:177 supports 에서 .frame-block 을 뺀다        ⇒ ㉡·㉢ 빨강
 *   변이 B: js/props/prop-frame.js 의 wireFxSection 한 줄을 지운다              ⇒ ㉢ 빨강(select 가 있어도 고르면 아무 일 없음)
 *   변이 C: js/props/prop-frame.js 의 fxSectionHtml 호출만 지우고 wireFxSection 은 둔다 ⇒ ㉢ 빨강(#ss-fx-add 자체가 없다)
 *   ⇒ 실측 결과는 Generator 보고에 ⒞ 칸으로 적는다.
 *
 * ⛔앱 통째 헤드리스(bootApp). ⛔page.waitForTimeout 0곳 — waitForFunction 로만 기다린다(래칫 W3).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/effects-frame-shadow.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="fS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="fI"></div></div>`);
    /* ★프레임 — 평범한 흐름 프레임(자유배치 아님). 빈 채로도 그림자 식구는 「고를 수 있나」만 본다. */
    const fr = window.makeFrameBlock({ fullWidth: true });
    fr.id = 'fFr';
    fr.style.width = '300px'; fr.dataset.width = '300';
    fr.style.minHeight = '120px'; fr.dataset.height = '120'; fr.dataset.hMode = 'fixed';
    fr.style.background = '#e8e8ee';
    document.getElementById('fI').appendChild(fr);
    /* ★음성대조용 텍스트 — effects-registry A3 와 같은 자리를 여기서도 가진다. */
    const { block: tb } = window.makeTextBlock('body');
    const tf = window._makeTextFrame();
    window.applyTextOpts(tb, tf, {}, 'body');
    tf.appendChild(tb); tb.id = 'fT'; tf.id = 'fTF';
    document.getElementById('fI').appendChild(tf);
    window.rebindAll?.();
    window.deselectAll?.();
    window.showFrameProperties(fr);
    window.__fr = fr.id;
  });
  await page.waitForFunction(() => !!document.getElementById('ss-fx-section'), null, { timeout: 5000 });
  return errs;
}

/** 그 패널의 «추가 목록» — 머리 option 과 고를 수 있는 효과들. */
const addList = (page, P) => page.evaluate((P) => {
  const a = document.getElementById(`${P}-fx-add`);
  if (!a) return null;
  return { opts: [...a.options].slice(1).map((o) => o.value) };
}, P);
const cards = (page, P) => page.evaluate((P) => [...document.querySelectorAll(`#${P}-fx-list .prop-cell-card`)].map((e) => e.dataset.fxType), P);

test('㉠ 전제 — fxTypesFor 다리가 산다 · 명부에 shadow 가 있다', async ({ page }) => {
  const errs = await setup(page);
  const api = await page.evaluate(() => typeof window.fxTypesFor);
  expect(api, '★전제 — 다리가 없으면 아래 전부 뜻이 없다').toBe('function');
  const keys = await page.evaluate(() => window.fxTypeKeys());
  expect(keys, '★shadow 가 등록돼 있다').toEqual(expect.arrayContaining(['shadow']));
  expect(errs).toEqual([]);
});

test('㉡ fxTypesFor(frame-block) 가 shadow 를 포함한다(supports 가 프레임을 허용) · ㉤ 텍스트는 ★여전히 안 뜬다', async ({ page }) => {
  await setup(page);
  const frKeys = await page.evaluate(() => window.fxTypesFor(document.getElementById('fFr')).map((t) => t.key));
  expect(frKeys, '★프레임 — 그림자를 고를 수 있다').toEqual(expect.arrayContaining(['shadow']));
  const txtKeys = await page.evaluate(() => window.fxTypesFor(document.getElementById('fT')).map((t) => t.key));
  expect(txtKeys, '★음성대조 보존 — 텍스트는 안 된다(effects-registry A3 와 같은 사실)').not.toContain('shadow');
  const shapeAssetIntact = await page.evaluate(() => {
    const fake = { classList: { contains: (c) => c === 'shape-block' } };
    return window.fxTypesFor(fake).map((t) => t.key);
  });
  expect(shapeAssetIntact, '★도형은 여전히 된다(허용 목록에 더하기만 했다 — 기존 공급을 안 뺐다)').toEqual(expect.arrayContaining(['shadow']));
});

test('㉢ 패널에 #ss-fx-add 가 있고, shadow 를 고르면 카드가 생긴다 · ㉣ style.filter 에 drop-shadow', async ({ page }) => {
  const errs = await setup(page);
  const before = await addList(page, 'ss');
  expect(before, 'ss 패널에 추가 목록이 있다(프레임에 Effects 절이 그려졌다)').not.toBeNull();
  expect(before.opts, '★shadow 가 목록에 있다(아직 안 걸렸으니 목록 쪽)').toContain('shadow');
  expect(await cards(page, 'ss'), '★전제 — 아직 카드 0개').toEqual([]);

  await page.selectOption('#ss-fx-add', 'shadow');
  await page.waitForFunction(() => {
    const f = document.getElementById('fFr');
    return !!(f && f.style.filter && f.style.filter.includes('drop-shadow'));
  }, null, { timeout: 5000 });

  expect(await cards(page, 'ss'), '★고르면 카드가 생긴다').toEqual(['shadow']);
  const filter = await page.evaluate(() => document.getElementById('fFr').style.filter);
  expect(filter, '★filter 에 drop-shadow 조각(⛔색 순서를 박지 않는다)').toContain('drop-shadow');
  const ds = await page.evaluate(() => Object.fromEntries(Object.entries(document.getElementById('fFr').dataset).filter(([k]) => k.startsWith('fxShadow'))));
  expect(ds.fxShadow, '★dataset 정본도 켜졌다').toBe('on');
  expect(errs).toEqual([]);
});

test('음성 — 끄면(✕) filter 가 비고, 프레임이 그림자를 가진 ★유일한 컨테이너가 아니다(도형·에셋과 같은 한 자리를 공유)', async ({ page }) => {
  await setup(page);
  await page.selectOption('#ss-fx-add', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('fFr').style.filter, null, { timeout: 5000 });
  await page.evaluate(() => window.setFxShadow(document.getElementById('fFr'), { state: 'none' }));
  await page.waitForFunction(() => document.getElementById('fFr').style.filter === '', null, { timeout: 5000 });
  expect(await page.evaluate(() => document.getElementById('fFr').style.filter)).toBe('');
  expect(await page.evaluate(() => document.getElementById('fFr').dataset.fxShadow)).toBeUndefined();
});
