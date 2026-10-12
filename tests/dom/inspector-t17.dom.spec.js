/* inspector-t17.dom.spec.js — ★T17 인스펙터 「이미지」·「텍스트」 ★순차 이동 (현빈 2026-10-07)
 *
 * ★unit(tests/unit/inspector-t17.test.mjs)은 ★소스가 그 꼴인가까지만 안다.
 *   ⇒ 「★진짜 눌렀을 때 ★순차로 도나」·「★분모가 표시된 수와 같나」·「★머리 넷의 꼴이 같나」는
 *     ★렌더러가 그린 ★뒤에만 답이 나온다.
 *
 * ★「1/N」 표시는 ★의도된 꼴이다(js/inspector.js:131) — ⇒ ★「2/36」은 ★거짓이 아니다.
 *   ★거짓이 되는 길은 ★하나다: ★분모(N)가 ★갈 곳 수와 ★다를 때. ★I4 가 그걸 잰다.
 *
 * ★「읽히나」 자 ★셋을 ★같이 건다(지디 2026-10-07 · 쿠폰 레인이 두 번 갈아 얻은 값):
 *   ㉠ 자연폭(눌렸나) · ㉡ ★구별되는 y(쪼개졌나) · ㉢ ★elementFromPoint(가려졌나)
 *   ⛔scrollWidth>clientWidth 는 overflow:visible 에서 ★안 자란다 · getClientRects().length 는 ★글자 토막 수다
 *
 * ★★★레인 규율(지디 2026-10-07 · ★이 spec 이 낳았다):
 *   ★★«조건부 SKIP 은 ★제 칸을 ★따로 가져라. ⛔다른 단언과 ★한 칸에 두지 마라»
 *   ★까닭 — ★처음엔 ★I5 ★안에서 `test.skip()` 했다. ★그러자 ★러너가 ★그 시험을 ★`skipped` 로 세어
 *     ★★앞서 ★이미 돈 ★꼴 단언 ★넷이 ★«가려졌다»(★「돌았나」가 ★수에서 ★안 보인다).
 *   ⇒ ★★「★범위밖은 ★FAIL 아니라 ★SKIP」의 ★★숨은 흠이다 — ★SKIP 이 ★같은 칸의 ★다른 단언까지 ★먹는다.
 *   ⇒ ★그래서 ★I5(★항상 돈다 · ★꼴)와 ★I7(★조건부 SKIP · ★읽히나)을 ★갈랐다.
 *
 * ⛔앱을 «안» 띄운다 — 공용 하네스(tests/dom/_root-harness.js)만 쓴다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js inspector-t17
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 장면: 섹션 하나 · asset 3 · text 3 · gap 2 — ★수를 «여기 한 곳»에서 정한다(⛔두 벌 금지) */
const N_ASSET = 3, N_TEXT = 3, N_GAP = 2;

async function setup(page, { assets = N_ASSET, texts = N_TEXT, gaps = N_GAP } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ assets, texts, gaps }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="iS" data-section="1">
      <div class="section-hitzone"></div><div class="section-inner" id="iI"></div></div>`);
    const inner = document.getElementById('iI');
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 60;
    const x = cv.getContext('2d'); x.fillStyle = '#ff6600'; x.fillRect(0, 0, 120, 60);
    const png = cv.toDataURL('image/png');
    for (let i = 0; i < assets; i++) {
      const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'iA' + i;
      inner.appendChild(ab);
    }
    for (let i = 0; i < texts; i++) {
      const { block: tb } = window.makeTextBlock('h1');
      const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h1');
      tf.appendChild(tb); tb.id = 'iT' + i;
      tb.querySelector('[class^="tb-"]').textContent = 'T' + i;
      inner.appendChild(tf);
    }
    for (let i = 0; i < gaps; i++) {
      const g = document.createElement('div');
      g.className = 'gap-block'; g.dataset.type = 'gap'; g.style.height = '30px'; g.id = 'iG' + i;
      inner.appendChild(g);
    }
    window.rebindAll?.();
    for (let i = 0; i < assets; i++) window.updateAssetBlock?.('iA' + i, { imgSrc: png });
    window.deselectAll?.(); window.applyZoom?.(100);
  }, { assets, texts, gaps });
  /* ★전제 — 장면이 «실제로» 들어갔나. 0 이면 아래가 통째로 공회전이다. */
  expect(await page.locator('#iI .asset-block').count(), '★전제 — asset 이 안 들어갔다').toBe(assets);
  expect(await page.locator('#iI .text-block').count(), '★전제 — text 가 안 들어갔다').toBe(texts);
  await page.evaluate(() => window.renderInspectorPanel());
  return errs;
}

/** 라벨로 그 줄을 집는다 — 꼴·점프 여부·표시값을 한 번에. */
const rowOf = (page, label) => page.evaluate((lab) => {
  const el = [...document.querySelectorAll('.insp-stat-label')].find(e => e.textContent.trim() === lab);
  if (!el) return { found: false };
  const row = el.closest('.insp-stat-row');
  const val = row.querySelector('.insp-stat-value');
  const r = row.getBoundingClientRect();
  /* ★자 ㉡ — «구별되는 y»(쪼개졌나). ⛔px 를 박지 않는다. */
  const lines = (node) => {
    const rg = document.createRange(); rg.selectNodeContents(node);
    return new Set([...rg.getClientRects()].map(x => Math.round(x.y))).size;
  };
  /* ★자 ㉢ — elementFromPoint(가려졌나). 줄 가운데를 눌러 «그 줄 안»이 나오나. */
  const hitEl = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return {
    found: true,
    jump: row.classList.contains('insp-jump'),
    dataJump: row.dataset.jump || null,
    hasJumpValue: !!row.querySelector('[data-jump-value]'),
    text: val ? val.textContent.trim() : null,
    w: Math.round(r.width), h: Math.round(r.height),
    labelLines: lines(el), valueLines: val ? lines(val) : 0,
    hitInside: !!hitEl && (row === hitEl || row.contains(hitEl)),
    hitTag: hitEl ? (hitEl.className || hitEl.tagName) : 'NULL',
  };
}, label);

const clickRow = (page, label) => page.evaluate((lab) => {
  const el = [...document.querySelectorAll('.insp-stat-label')].find(e => e.textContent.trim() === lab);
  el.closest('.insp-stat-row').click();
  const sel = document.querySelector('#canvas .selected');
  return { value: el.closest('.insp-stat-row').querySelector('.insp-stat-value')?.textContent?.trim(),
           selectedId: sel ? sel.id : null,
           flashId: document.querySelector('.insp-jump-flash')?.id || null };
}, label);

/* ═══ I1 ★점프가 붙는다 — ★양성대조로 「자가 산다」를 먼저 ═══ */
test('I1 ★「이미지」·「텍스트」 줄에 점프가 붙는다 (양성대조: 「Gap」은 전부터 붙는다)', async ({ page }) => {
  const errs = await setup(page);
  /* ★양성대조 — 전부터 되던 「Gap」이 ★이 하네스에서 ★진짜로 점프를 갖나.
     ⇐ 이게 false 면 하네스가 인스펙터를 제대로 안 그린 것이고 아래는 공회전이다. */
  const gap = await rowOf(page, 'Gap');
  expect(gap.found, '★양성대조 실패 — 「Gap」 줄이 없다(인스펙터가 안 그려졌다)').toBe(true);
  expect(gap.jump, '★양성대조 실패 — 「Gap」에 insp-jump 가 없다').toBe(true);

  for (const [lab, key, n] of [['이미지', 'assetBlocks', N_ASSET], ['텍스트', 'textBlocks', N_TEXT]]) {
    const r = await rowOf(page, lab);
    expect(r.found, `★「${lab}」 줄이 없다`).toBe(true);
    expect(r.jump, `★「${lab}」 에 insp-jump 가 안 붙었다 — 현빈 ①의 그 자리다`).toBe(true);
    expect(r.dataJump, `★「${lab}」 의 data-jump 키가 다르다`).toBe(key);
    expect(r.hasJumpValue, `★「${lab}」 에 data-jump-value 가 없다 — 「1/N」을 못 보여준다`).toBe(true);
    expect(r.text, `★「${lab}」 이 찍은 수가 장면과 다르다`).toBe(String(n));
  }
  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ I2·I3 ★순차 ＋ ★한 바퀴 돌기 ═══ */
test('I2 ★순차로 돈다 — 누를 때마다 다음 것 · ★마지막에서 처음으로', async ({ page }) => {
  const errs = await setup(page);
  const seen = [];
  for (let i = 0; i < N_ASSET + 1; i++) seen.push(await clickRow(page, '이미지'));
  console.log('I2 ★잰 값:', JSON.stringify(seen));

  /* ★표시가 1/N → 2/N → … 로 간다 */
  for (let i = 0; i < N_ASSET; i++) {
    expect(seen[i].value, `★${i + 1}번째 클릭의 표시가 다르다`).toBe(`${i + 1}/${N_ASSET}`);
  }
  /* ★한 바퀴 — N+1 번째는 ★다시 1/N */
  expect(seen[N_ASSET].value, '★마지막에서 처음으로 안 돈다').toBe(`1/${N_ASSET}`);
  /* ★★간 곳이 ★매번 달라진다 — 표시만 바뀌고 ★안 움직이는 꼴을 막는다 */
  const ids = seen.slice(0, N_ASSET).map(s => s.selectedId);
  expect(new Set(ids).size, `★간 곳이 안 달라진다 — ${JSON.stringify(ids)}`).toBe(N_ASSET);
  expect(ids.every(id => /^iA\d$/.test(String(id))),
    `★간 곳이 asset 이 아니다 — ${JSON.stringify(ids)}`).toBe(true);
  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ I4 ★분모 = 갈 곳 수 — ★「2/36」이 거짓이 되는 ★유일한 길 ═══ */
test('I4 ★표시된 분모가 ★갈 곳 수와 같다 (⛔거짓 표시의 유일한 길)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.insp-stat-label')].find(e => e.textContent.trim() === '이미지');
    const row = el.closest('.insp-stat-row');
    row.click();
    const shown = row.querySelector('.insp-stat-value').textContent.trim();
    return { shown, real: document.querySelectorAll('#canvas .asset-block').length };
  });
  const denom = Number(String(r.shown).split('/')[1]);
  console.log('I4 ★표시', r.shown, '· 실제 .asset-block', r.real);
  expect(denom, `★표시 분모(${denom})가 실제 수(${r.real})와 다르다 — 「${r.shown}」 이 거짓 표시다`).toBe(r.real);
  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ I5 ★머리 통계 ★넷의 ★꼴이 같다 — ★이 결정(㉡)의 ★본체 ═══
 * ⚠️★2026-10-07 실측으로 ★설계를 고쳤다 — ★첫 판은 ★폭·구별되는 y·elementFromPoint 로 쟀고
 *   ★3/3 빨강이었다. ★까닭은 ★제품이 아니라 ★★이 하네스가 ★인스펙터 패널을 ★«레이아웃에 안 올린다»다:
 *   ★실측(probe): ★머리 넷 ★전부 ★w=0 h=0 — ★「섹션」만이 아니라 ★★넷 다였다.
 * ⇒ ★★「고친 뒤 첫 빨강은 ★시험 설계의 흠일 수 있다」의 ★그 자리다.
 * ⇒ ★처방 — ★★«내가 잴 수 있는 것»과 ★«못 재는 것»을 ★갈랐다:
 *     ★잰다   = ★DOM ★«꼴»(클래스·자식 구성) — ★레이아웃이 ★필요 없다. ★★㉡ 의 본체가 ★이것이다
 *     ★안 잰다 = ★「★읽히나」(폭·줄 쪼개짐·가려짐) — ★패널이 ★보이는 판이 ★필요하다
 *   ⇒ ★★그 셋은 ★★FAIL 이 아니라 ★★SKIP 으로 ★남기고 ★★그 사실을 ★찍는다
 *     (「★범위밖 검사는 ★FAIL 아니라 ★SKIP」 · ⛔0×0 을 ★결함으로 읽지 않는다)
 */
test('I5 ★머리 넷(섹션·전체 블록·텍스트·이미지)이 ★같은 «꼴»이다 (＋읽히나는 ★SKIP·까닭 명시)', async ({ page }) => {
  const errs = await setup(page);
  const LABELS = ['섹션', '전체 블록', '텍스트', '이미지'];
  const r = await page.evaluate((LABELS) => {
    const out = { rows: [], laidOut: false };
    for (const lab of LABELS) {
      const el = [...document.querySelectorAll('.insp-stat-label')].find(e => e.textContent.trim() === lab);
      if (!el) { out.rows.push({ lab, found: false }); continue; }
      const row = el.closest('.insp-stat-row');
      const b = row.getBoundingClientRect();
      out.rows.push({
        lab, found: true,
        cls: [...row.classList].sort().join(' '),
        kids: [...row.children].map(c => c.className.split(' ')[0]).join('+'),
        jump: row.classList.contains('insp-jump'),
        w: Math.round(b.width), h: Math.round(b.height),
      });
    }
    out.laidOut = out.rows.some(x => x.found && x.w > 0 && x.h > 0);
    return out;
  }, LABELS);
  console.log('I5 ★잰 값:', JSON.stringify(r));

  /* ★전제 — 넷을 «실제로» 찾았나. 못 찾으면 아래가 통째로 공회전이다. */
  for (const x of r.rows) expect(x.found, `★「${x.lab}」 줄이 없다 — ㉡(머리 넷의 꼴 유지)이 깨졌다`).toBe(true);

  /* ★본 단언 ⑴ — ★자식 «구성»이 넷 다 같다 (라벨 ＋ 값) · ★레이아웃과 무관하다 */
  const kids = r.rows.map(x => x.kids);
  expect(new Set(kids).size,
    `★넷의 자식 구성이 갈렸다 — ${JSON.stringify(r.rows.map(x => [x.lab, x.kids]))}`).toBe(1);

  /* ★본 단언 ⑵ — ★클래스는 ★「insp-stat-row」가 ★공통이고, ★insp-jump 만 ★둘에 더 붙는다(★의도) */
  for (const x of r.rows) {
    expect(x.cls.includes('insp-stat-row'), `★「${x.lab}」 에 insp-stat-row 가 없다`).toBe(true);
  }
  const jumped = r.rows.filter(x => x.jump).map(x => x.lab);
  expect(jumped, `★점프가 붙은 줄이 「텍스트·이미지」 둘이 아니다 — ${JSON.stringify(jumped)}`)
    .toEqual(['텍스트', '이미지']);

  /* ★「읽히나」 세 자는 ★★I7 로 ★떼어냈다 — ★까닭은 그 시험 머리말에.
     ⛔여기서 skip 하면 ★★이 꼴 단언들이 ★「돌았나」가 ★러너 수에서 ★안 보인다
       (★실측: I5 가 ★`skipped` 로 세어져 ★위 단언 넷이 ★가려졌다). */
  expect(r.laidOut, '★전제 기록 — 이 하네스에서 패널이 레이아웃에 올랐나(I7 이 그걸로 갈린다)').toBe(r.laidOut);
  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ I7 ★「읽히나」 세 자 — ★패널이 ★보이는 판에서만 선다 ═══
 * ★자 ★셋(지디 2026-10-07 · 쿠폰 레인이 두 번 갈아 얻은 값):
 *   ㉠ 자연폭(눌렸나) · ㉡ ★구별되는 y(쪼개졌나) · ㉢ ★elementFromPoint(가려졌나)
 *   ⛔scrollWidth>clientWidth 는 overflow:visible 에서 ★안 자란다 · getClientRects().length 는 ★글자 토막 수다
 * ⚠️★이 하네스는 ★인스펙터 패널을 ★«레이아웃에 안 올린다» — ★실측 ★머리 넷 ★전부 w=0 h=0.
 *   ⇒ ★★그래서 ★여기서 ★SKIP 한다. ⛔0×0 을 ★결함으로 읽지 않는다
 *     (「★범위밖 검사는 ★FAIL 아니라 ★SKIP」). ★재려면 ★패널이 보이는 판이 ★필요하다(★별건).
 *   ⇒ ★★그리고 ★이 시험은 ★«그 판이 생기면 저절로 돈다» — ★조건이 ★laidOut 하나다.
 */
test('I7 ★「읽히나」 — 폭·구별되는 y·elementFromPoint (★패널이 0×0 이면 SKIP)', async ({ page }) => {
  const errs = await setup(page);
  const LABELS = ['섹션', '전체 블록', '텍스트', '이미지'];
  const rows = [];
  for (const lab of LABELS) rows.push([lab, await rowOf(page, lab)]);
  const laidOut = rows.some(([, r]) => r.found && r.w > 0 && r.h > 0);
  console.log('I7 ★잰 값:', JSON.stringify(rows.map(([l, r]) => [l, r.w, r.h, r.labelLines, r.valueLines, r.hitInside])));
  test.skip(!laidOut,
    '★인스펙터 패널이 이 하네스에서 ★0×0 이다 — 「읽히나」는 ★범위 밖(패널이 보이는 판이 필요하다 · 별건)');

  for (const [lab, r] of rows) {
    expect(r.w > 0 && r.h > 0, `★「${lab}」 이 0×0 이다 — ${JSON.stringify(r)}`).toBe(true);
    expect(r.labelLines, `★「${lab}」 라벨이 ${r.labelLines}줄로 쪼개졌다`).toBe(1);
    expect(r.valueLines, `★「${lab}」 값이 ${r.valueLines}줄로 쪼개졌다`).toBe(1);
    expect(r.hitInside, `★「${lab}」 이 가려졌다 — elementFromPoint 가 ${r.hitTag} 를 돌려줬다`).toBe(true);
  }
  const hs = rows.map(([, r]) => r.h);
  expect(new Set(hs).size, `★넷의 높이가 갈렸다 — ${JSON.stringify(rows.map(([l, r]) => [l, r.h]))}`).toBe(1);
  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ I6 ★0 이면 ★줄은 남고 ★점프는 ⛔안 붙는다 — ★always 의 본체 ═══ */
test('I6 ★이미지 0개 — ★줄은 남고 ⛔점프는 안 붙는다 (always:true 의 뜻)', async ({ page }) => {
  const errs = await setup(page, { assets: 0 });
  const img = await rowOf(page, '이미지');
  console.log('I6 ★잰 값(이미지 0):', JSON.stringify(img));
  expect(img.found, '★이미지 0 인데 ★줄이 사라졌다 — always:true 가 안 섰다(㉠ 로 떨어졌다)').toBe(true);
  expect(img.text, '★0 이 아니라 다른 수를 찍는다').toBe('0');
  expect(img.jump, '⛔갈 곳이 0 인데 insp-jump 가 붙었다 — ★거짓 약속이다(손 모양이 뜬다)').toBe(false);
  expect(img.dataJump, '⛔갈 곳이 0 인데 data-jump 가 붙었다').toBe(null);
  expect(img.hasJumpValue, '⛔갈 곳이 0 인데 data-jump-value 가 붙었다').toBe(false);

  /* ★음성대조 — ★같은 판에서 ★텍스트는 ★있으니 ★점프가 ★붙어야 한다(자가 산다) */
  const txt = await rowOf(page, '텍스트');
  expect(txt.jump, '★음성대조 실패 — 텍스트도 점프가 없다. 위 false 가 뜻을 잃는다').toBe(true);
  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});
