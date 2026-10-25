/* t4-10-radial-arc-hint.dom.spec.js
 *   ★`t4-10` — 「★다음의 프롭힌트는 ★없앨 것 [기본은 반원입니다 — …]」 (2026-10-25 신설 · 지디)
 *
 * ★원문(p10502 · ⛔내 요약 아님) : 「t4-10 ★다음의 프롭힌트는 ★없앨 것
 *   [기본은 반원입니다 — 시작 −90° · 끝 90° · 원 중심 X 0%(블럭 왼쪽 변)라서 호의 양 끝이
 *    왼쪽 변에 붙습니다. 원 중심 X 는 블럭 폭 대비 % 입니다. 항목은 시작~끝 각도 사이에 …]」
 *
 * ★찾은 이 = 레인 L1(전수 채점 261025) — 「★호모드 패널에 그 힌트 ★여전히 렌더(prop-radial.js:178)」
 *   ★양성대조도 L1 이 세웠다 : 「★다른 절(Data절 t4-03)은 ★제거됐다」 = ★제거는 ★일어난다.
 *
 * ★★이 파일은 ★「고침 ★전」에 ★빨강이어야 한다 — ★그게 ★이 자가 ★재고 있다는 증거다.
 *   ⇒ ★고친 뒤 ★초록이 되면 ★그 쌍이 ★`t4-10` 을 ★잠근다.
 *
 * ★★선례 = `fx-particles-panel.dom.spec.js` D10(1020t2-20·21·22 를 ★한 측정으로 잠근 그 칸).
 *   ★거기서 배운 것 ★둘을 ★그대로 쓴다 :
 *     ⑴ ★「★0건을 ★없다로 닫지 않는다」 — ★다른 힌트가 ★살아 있음을 ★같이 단언
 *     ⑵ ★범위를 ★넓히지 않는다 — ★현빈이 ★지목한 ★그 문장만
 *   ＋ ★L2 교훈(261025) : ★★패널 ★UI 는 ★`selectBlock` 말고 ★★실마우스 클릭으로 열어야 한다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t4-10-radial-arc-hint
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** ★섹션 ＋ 방사형 블럭을 ★앱 길로 만들고 ★★호 모드로 ★실클릭 전환한다. */
async function arcPanel(page) {
  const made = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec) return { fail: '섹션이 없다' };
    window.selectSection(sec);
    if (typeof window.addRadialBlock !== 'function') return { fail: 'addRadialBlock 없음' };
    window.addRadialBlock();
    const b = sec.querySelector('.radial-block');
    if (!b) return { fail: 'addRadialBlock 뒤에 .radial-block 이 없다' };
    b.id = b.id || 'rdlT410';
    return { id: b.id, shape: b.dataset.shape || '(없음)' };
  });
  if (made.fail) return made;
  /* ★★호 버튼을 ★실마우스로 누른다 — ⛔`selectBlock`·직접 호출로는 ★패널이 안 그려질 수 있다(L2 교훈) */
  const btn = page.locator('#rdl-shape-arc');
  if (await btn.count() === 0) return { fail: '#rdl-shape-arc 버튼이 패널에 없다 — 패널이 안 열렸다', made };
  await btn.click();
  const after = await page.evaluate(() => {
    const b = document.querySelector('.radial-block');
    /* ★★★261025 ★자가정정 : ★`#rdl-end` 는 ★★내가 ★지어낸 앵커였다(★실측 `hasEndRow: false`).
       ★`_pairRow(id,…)`(prop-radial.js:59)는 ★★`${id}-slider` 와 ★`${id}-number` 를 만든다
       ⇒ ★참 이름은 ★★`#rdl-end-number` 다. ⛔앵커를 ★지어내지 마라. */
    return {
      shape: b?.dataset.shape || '(없음)',
      hasEndRow: !!document.getElementById('rdl-end-number'),
      hasCxRow: !!document.getElementById('rdl-cx-number'),
    };
  });
  return { ...made, ...after };
}

const hintsOf = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#panel-right .prop-hint')].map(e => e.textContent.trim()));

test('T0 ★전제 — ★앱 길로 ★방사형 블럭을 만들고 ★★호 모드로 ★실클릭 전환된다', async ({ page }) => {
  await bootApp(page);
  const r = await arcPanel(page);
  expect(r.fail, `★전제: ${r.fail} ${JSON.stringify(r.made || {})}`).toBeUndefined();
  console.log('[T0]', JSON.stringify(r));
  /* ★★전제 둘 — ⛔하나라도 안 서면 아래 힌트 판정이 ★«안 재고 있다»다 */
  expect(r.shape, '★호 모드로 안 바뀌었다').toBe('arc');
  /* ★호 전용 줄 ★둘 — ⛔하나만 보면 ★이름을 또 틀릴 수 있다 */
  expect(r.hasEndRow, '★호 전용 줄 #rdl-end-number(끝 각도)가 안 그려졌다 — 패널이 그 분기를 안 탔다').toBe(true);
  expect(r.hasCxRow, '★호 전용 줄 #rdl-cx-number(원 중심 X)가 안 그려졌다').toBe(true);
});

test('T1 ★★★t4-10 — ★호 모드 패널에 ★「기본은 반원입니다」 힌트가 ★없다 (★고침 전엔 ★빨강)', async ({ page }) => {
  await bootApp(page);
  const r = await arcPanel(page);
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  expect(r.shape, '★전제: 호 모드가 아니다').toBe('arc');

  const hints = await hintsOf(page);
  console.log('[T1]', JSON.stringify({ n: hints.length, hints: hints.map(h => h.slice(0, 44)) }));

  /* ★★⑴ ★0건을 ★「없다」로 ★닫지 않는다 — ★이 패널에 ★.prop-hint 가 ★하나라도 있나를 ★먼저 본다.
     ⛔없으면 ★「힌트 선택자가 바뀌었다」와 ★구분이 안 된다 ⇒ ★그때는 ★이 자가 ★죽은 것이다. */
  const anyHint = await page.evaluate(() => document.querySelectorAll('#panel-right .prop-hint').length);
  expect(anyHint,
    '★이 패널에 .prop-hint 가 0개다 — ★선택자가 바뀌었나(그러면 아래 「없다」는 ★안 재고 있다)'
  ).toBeGreaterThanOrEqual(1);

  /* ★★★⑵ ★본 단언 — ★현빈이 ★지목한 ★그 문장만. ⛔「radial 힌트 전부」로 ★넓히지 않는다. */
  expect(hints.some(t => t.includes('기본은') && t.includes('반원')),
    '★「기본은 반원입니다」 힌트가 ★아직 있다 — ★t4-10 이 ★안 고쳐졌다 (prop-radial.js:178)'
  ).toBe(false);
});

test('T2 ★★양성대조 — ★제거는 ★일어난다 (★L1 이 세운 그 대조: Data 절은 ★이미 없다)', async ({ page }) => {
  await bootApp(page);
  const r = await arcPanel(page);
  expect(r.fail).toBeUndefined();
  /* ★★이 칸이 ★T1 을 ★뜻 있게 만든다 — ⛔없으면 「★패널에서 ★아무것도 ★제거되지 않는다」와 ★구분이 ★안 된다.
     ★L1 실측(261025) : ★`t4-03` 의 ★Data 절은 ★★제거됐다(reset-all 을 Shape 절로 옮겼다). */
  const r2 = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('#panel-right .prop-section-title')].map(e => e.textContent.trim());
    return { titles, hasData: titles.some(t => /^Data$/i.test(t)), n: titles.length };
  });
  console.log('[T2]', JSON.stringify(r2));
  expect(r2.n, '★전제: 패널에 절 제목이 0개다 — 패널이 안 열렸다').toBeGreaterThanOrEqual(1);
  expect(r2.hasData,
    '★Data 절이 ★되돌아왔다 — ★t4-03 이 ★풀렸다(그러면 T1 의 「없다」도 다시 재라)'
  ).toBe(false);
});
