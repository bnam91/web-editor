/* grid-circle-text.dom.spec.js — ★G20. 현빈 2026-10-07:
 *   「그리드 블럭에 ★칸에 ★원형 이미지에셋을 추가한 뒤, ★서클 에셋블럭처럼 ★색을 솔리드로 바꾸고 ★텍스트 입력이 가능하게 해 달라」
 *   「서클 에셋블럭이 어떤지 보고 ★그대로 하면 되는 거 아냐? 서클에셋 블럭이 ★그냥 줄로 들어가는 것과 같아서」
 *   길 = 지디 2026-10-07 ⒜「작은 길」(⛔⒝ 서클 에셋 순수함수화는 안 한다) ＋ ㉠-a(글자는 우측 패널) ＋ ㉢(사각으로 바꿀 때 안 뗀다).
 *
 * ★앞서 쟀고 ★이 카드가 뒤집는 것(기준 2866df63 실측):
 *     `patchCell{bg}` · `{text}` 가 ★원형 줄에서 ok:false/INVALID — 「none of bg is read by the renderer on a type:'image' line」
 *     원형 줄이 ★읽던 필드 = align · marginTop · height · imgShape ＋imgSrc ★다섯. (대조 body 줄 = text·bg·color·fontSize·weight·…)
 *
 * ══ ★양성대조 명부 — ★무엇을 무력화하면 ★어느 자가 빨강인가 ═══════════════════════════════
 *   판은 ★`GD1001_ROOT=<트리>` 로 갈아 끼운다(_root-harness.js). ★⛔판을 HEAD 로 두면 전부 초록이라 아무것도 안 잰다.
 *   ★아래는 ★예측이 아니라 ★실측이다(2026-10-07 · 판 ★7개 × ★각 3회 = ★21런 · 21/21 이 ★판마다 같은 집합).
 *   ⚠️★내가 처음 적은 예측은 ★둘에서 ★좁았다 — M-BG 를 「G20-2 만」, M-TEXT 를 「3·6·7 만」으로 셌다.
 *     실측은 ★더 넓었다(아래). ★치우침이 한 방향(덜 셈)이라 ★맨 예측을 지우고 ★잰 수로 바꿔 적는다.
 *
 *     판                                         ★빨강                              초록(남는 자)
 *     ㉠ ★핀 `2866df63` (고치기 전)              1·2·3·4·5·6·7                     ★8·9  ← ★바닥: 하네스가 멀쩡하다는 증거
 *     ㉡ M-BG    렌더러 `${cBgCss}` 제거          1·2·5·6·7                         3·4·8·9
 *     ㉢ M-TEXT  렌더러 `cTextHtml` 를 '' 고정    1·3·4·5·6·7                       2·8·9
 *     ㉣ M-INSET `GRID_CIRCLE_TEXT_INSET_PCT`→100 ★3 «하나만»                       1·2·4·5·6·7·8·9
 *     ㉤ M-PANEL 패널 `${circleRows}` 제거        4·5                               1·2·3·6·7·8·9
 *     ㉥ M-LEAK  `posCss` 를 늘 'position:relative' ★8 «하나만»                      1·2·3·4·5·6·7·9
 *     ㉦ M-EMPTY 빈 원에서 `grd-img-empty` 뗌     2·8·★9                            1·3·4·5·6·7
 *     ㉧ M-BEFORE  글자 핸들러를 ★push-before 로    ★10 «하나만»                      5·그 밖 전부
 *     ㉨ M-NOHIST  글자 핸들러의 pushHistory ★제거  ★5·★10                            그 밖 전부
 *   ★★㉧·㉨ 는 ★2026-10-07 ★머지 ⑤ 에서 더 세웠다 — ★`tests/unit/prop-push-after.test.mjs` ★PA-1 이
 *     ★소스 모양으로 결함을 잡았고(★「찍고 나서 바꾸는 핸들러」), ★쟀더니 ★참이었다:
 *       히스토리 ★칸 수 Δ — push-before ★＋0 · pushHistory 없음 ★＋0 · ★push-after ★＋1
 *     ⛔★그런데 ★⌘Z 는 ★세 꼴 ★전부에서 ★«동작했다»(ensureHistoryCheckpoint 가 구해 준다)
 *     ⇒ ★★옛 G20-5·G20-10 은 ★pos/len 을 ★읽어 ★메시지에만 썼다 ⇒ ★pushHistory 를 ★빼도 ★초록이었다
 *        (= ★걸음을 ★안 재고 있었다). ⇒ ★★«칸 수» 단언을 박고서야 ★이 둘이 ★이를 가졌다.
 *     ★역할이 갈린다 — ★G20-5 = 「그 제스처가 칸을 만드나」(㉨ 가 잡는다) ·
 *       ★G20-10 = 「★연달아 해도 각자 칸을 갖나」(㉧·㉨ 가 잡는다 — ★앞 편집이 push-after 일 때만 선다)
 *   ★★㉥·㉦ 를 ★나중에 더 세웠다 — ㉠~㉤ 에서 ★G20-8·9 가 ★한 번도 빨강이 아니었다.
 *     ⇒ 「음성대조는 ★죽은 자를 못 잡는다」. ★지키는 자도 ★빨개질 수 있어야 ★재고 있는 것이다.
 *     ⇒ ★지금 ★아홉 자 ★전부가 ★최소 한 판에서 빨강이다(★0건 없음).
 *   ★각 판 ★×3 — 이 파일이 ★고정 대기(waitForTimeout)를 쓰므로 ★첫 빨강이 «운»일 수 있다.
 *     조건: `--fully-parallel --workers=3`(한 파일이라 직렬이면 워커 1 고정). ⚠️직렬 1차와 ★다른 조건의 수다.
 *   ★★「주 단언」과 「전제」를 ★갈라 적었다 — [전제] 가 붙은 줄이 깨지면 그 시험은 ★아무것도 안 잰 것이다.
 *   ⛔변이는 ★md5 로 주입을 확인하고 돌렸다(before→after 해시) — 「조용히 안 주입」이 ★초록으로 새는 길을 막는다.
 *
 * ⛔못 재는 축(이 하네스는 electronAPI 가 가짜다 — _root-harness.js 머리말): 파일로 저장/불러오기 · PNG 내보내기 픽셀 ·
 *   단독 HTML 배송본 · Figma JSON. ⇒ ★원 안 글자가 그 넷을 ★타고 나가는지는 ★미측정이다(이름으로 적어 보고한다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/* 원 «없는» 사각 줄 대조용 2:1 그림 — E157 뒤 1×1 은 사각도 정사각이 되어 원/사각을 못 가른다(grid-img-circle C0 의 그 까닭). */
const PX2 = 'data:image/png;base64,iVBORw0KGgoAAAACAAAAAgCAIAAAB7QOjdAAAAD0lEQVR4nGNQSjujlHYGAAf/AqmCyMKsAAAAAElFTkSuQmCC';

async function setup(page, { lines = [{ type: 'body', text: 'A' }], colW = [1, 1] } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(([colW, lines]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({
      cols: colW.map((w, i) => ({ width: w, lines: i === 0 ? lines : [{ type: 'body', text: 'B' }] })),
      rows: [{ height: 'auto' }],
    });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, [colW, lines]);
  await page.waitForTimeout(220);
  return errs;
}
const CIRC = (extra = {}) => [Object.assign({ type: 'image', imgSrc: '', imgShape: 'circle', height: 120 }, extra)];

/** 0행 0열 칸의 원 프레임 — 모델 px(배율 무관) ＋ 안쪽 글자칸. */
const circ = (page) => page.evaluate(() => {
  const f = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-frame');
  if (!f) return null;
  const cs = getComputedStyle(f);
  const t = f.querySelector(':scope > .grd-img-circle-text');
  const tcs = t ? getComputedStyle(t) : null;
  const fr = f.getBoundingClientRect(), tr = t ? t.getBoundingClientRect() : null;
  return {
    w: Math.round(f.offsetWidth), h: Math.round(f.offsetHeight), radius: cs.borderTopLeftRadius,
    bg: cs.backgroundColor, bgImage: cs.backgroundImage === 'none' ? 'none' : 'SOME',
    empty: f.classList.contains('grd-img-empty'), hasImg: !!f.querySelector(':scope > img.grd-img'),
    text: t ? t.textContent : null,
    tColor: tcs ? tcs.color : null, tSize: tcs ? tcs.fontSize : null, tAlign: tcs ? tcs.textAlign : null,
    tWpct: (t && fr.width) ? Math.round(tr.width / fr.width * 10000) / 100 : null,
    /* 글자 상자가 ★원 안에 있나 — 원 사각형을 넘지 않는다(가장자리 잘림은 overflow 가 한다) */
    tInside: tr ? (tr.left >= fr.left - 0.5 && tr.right <= fr.right + 0.5) : null,
    tCenterOff: (tr && fr.width) ? Math.round(Math.abs((tr.left + tr.right) / 2 - (fr.left + fr.right) / 2) * 100) / 100 : null,
  };
});
/** 칸의 그 줄을 패널에 띄운다 — 캔버스 클릭 두 번(첫 = 블럭, 둘째 = 그 칸의 줄). grid-img-circle C4 와 같은 길. */
async function openLine(page) {
  const [x, y] = await page.evaluate(() => {
    const r = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-frame').getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  await page.mouse.click(x, y); await page.waitForTimeout(260);
  return [x, y];
}
const panelIds = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const secs = [...(body ? body.querySelectorAll('.prop-section') : [])];
  const img = secs.find(s => (s.querySelector('.prop-section-title')?.textContent || '').trim() === 'Image');
  return {
    there: !!img,
    rowN: img ? img.querySelectorAll('.prop-row').length : -1,
    colorRowN: img ? img.querySelectorAll('.prop-color-row').length : -1,
    has: ['grd-img-cbg-hex', 'grd-img-ctext', 'grd-img-ctcol-hex', 'grd-img-ctsize'].filter(id => !!document.getElementById(id)),
  };
});

/* ══ G20-1 ★입구 — ②의 «거절»이 «받는다»로 뒤집혔다 ═══════════════════════════════════ */
test('G20-1 ★원형 줄이 bg·text·color·fontSize 를 «받는다» — 기준 2866df63 에선 ok:false/INVALID 였다', async ({ page }) => {
  const errs = await setup(page, { lines: CIRC({ imgSrc: PX }) });
  expect(errs).toEqual([]);
  /* [전제] 장면이 ★정말 원이다 — 사각이면 아래 ok:true 가 «다른 까닭»으로 선다(사각도 height 를 읽는다) */
  expect(await page.evaluate(() => Object.keys(JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[0])),
    '[전제] 0열 그 줄에 imgShape 가 있다').toContain('imgShape');
  const r = await page.evaluate(() => {
    const call = (f) => window.updateGridBlock('gG', { patchCell: Object.assign({ r: 0, c: 0, lineIndex: 0 }, f) });
    return {
      bg:   call({ bg: '#ff0000' }),
      text: call({ text: '안녕' }),
      col:  call({ color: '#0000ff' }),
      fs:   call({ fontSize: 33 }),
      /* ★음성대조 — 원이 ★안 읽는 이름은 ★여전히 거절돼야 한다(받는 문을 통째로 열지 않았다) */
      bogus: call({ letterSpacing: 7 }),
    };
  });
  expect(r.bg.ok,   `★bg 를 아직 거절한다: ${r.bg.message || ''}`).toBe(true);
  expect(r.text.ok, `★text 를 아직 거절한다: ${r.text.message || ''}`).toBe(true);
  expect(r.col.ok,  `★color 를 아직 거절한다: ${r.col.message || ''}`).toBe(true);
  expect(r.fs.ok,   `★fontSize 를 아직 거절한다: ${r.fs.message || ''}`).toBe(true);
  expect(r.bogus.ok, '★음성대조 — 원이 안 읽는 letterSpacing 까지 받았다(문을 너무 열었다)').toBe(false);
  expect(r.bogus.code).toBe('INVALID');
});

/* ══ G20-2 ★채움색 ═══════════════════════════════════════════════════════════════════ */
test('G20-2 ★「색을 솔리드로」 — 빈 원에 bg 를 주면 그 색이 칠해지고 ★체커무늬가 진다 · 그림 든 원도 칠해진다', async ({ page }) => {
  await setup(page, { lines: CIRC() });
  /* [전제] 색 ★전에는 ★체커무늬다(무늬가 애초에 없었다면 「진다」가 아무것도 안 잰다) */
  const before = await circ(page);
  expect(before, '[전제] 빈 원이 떴다').toMatchObject({ empty: true, w: 120, h: 120, radius: '50%' });
  expect(before.bgImage, '[전제] 색 전에는 체커무늬가 있다').toBe('SOME');

  await page.evaluate(() => window.updateGridBlock('gG', { patchCell: { r: 0, c: 0, lineIndex: 0, bg: '#ff0000' } }));
  await page.waitForTimeout(200);
  const after = await circ(page);
  expect(after.bg, '★원이 솔리드 색으로 안 칠해졌다').toBe('rgb(255, 0, 0)');
  expect(after.bgImage, '★색을 칠했는데 ★체커무늬가 남았다 — 인라인 background 가 CSS 클래스를 못 이겼다').toBe('none');
  expect(after.radius, '★원이 깨졌다').toBe('50%');
  /* ★`grd-img-empty` 클래스는 ★그대로 둔다 — 떼면 캔버스 더블클릭이 «그림 없는 원»에서 크롭 편집기를 연다(G20-9) */
  expect(after.empty, '★grd-img-empty 를 뗐다 — 더블클릭 갈래가 바뀐다(까닭은 grid-block.js G20 주석)').toBe(true);

  // 그림이 든 원에도 색이 실린다(그림 뒤 배경 — 투명 PNG 가 비칠 때)
  await setup(page, { lines: CIRC({ imgSrc: PX, bg: '#00ff00' }) });
  const filled = await circ(page);
  expect(filled).toMatchObject({ bg: 'rgb(0, 255, 0)', hasImg: true, empty: false, radius: '50%' });
});

/* ══ G20-3 ★원 «안» 글자 ═════════════════════════════════════════════════════════════ */
test('G20-3 ★「텍스트 입력이 가능하게」 — 원 «안» 가운데에 글자 · 폭 = 지름 × 1/√2 · 원 밖으로 안 샌다', async ({ page }) => {
  await setup(page, { lines: CIRC({ bg: '#e8e8e8', text: '원글자' }) });
  const c = await circ(page);
  expect(c.text, '★원 안에 글자가 없다').toBe('원글자');
  expect(c.tAlign, '★가운데 정렬이 아니다(서클 에셋 자식 그릇과 같은 상수)').toBe('center');
  /* ★폭 = 내접 정사각형(1/√2). ⛔`70.71` 을 ★리터럴로 적지 않는다 — 적으면 ★세 번째 명부가 된다.
   *   ★같은 ★식에서 뜬다. 「JS 상수 == CSS `.icb-children` 폭」을 맞추는 ★정본 재는 자는 따로 있다:
   *   tests/unit/grid-circle-text-inset.test.mjs(I2 ＋ I3 양성대조). 이 자는 ★화면 폭만 본다. */
  const ideal = Math.round(10000 / Math.SQRT2) / 100;
  expect(Math.abs(c.tWpct - ideal), `★글자칸 폭이 지름의 ${ideal}%(내접 정사각형)가 아니다 — 쟀더니 ${c.tWpct}%`).toBeLessThanOrEqual(0.6);
  expect(c.tInside, '★글자 상자가 원 사각형을 넘었다').toBe(true);
  expect(c.tCenterOff, `★글자가 원 가운데가 아니다(가로 중심차 ${c.tCenterOff}px)`).toBeLessThanOrEqual(1);
  /* 글자색·크기도 ★읽힌다 */
  await setup(page, { lines: CIRC({ text: 'ZZ', color: '#0000ff', fontSize: 33 }) });
  const c2 = await circ(page);
  expect(c2).toMatchObject({ text: 'ZZ', tColor: 'rgb(0, 0, 255)', tSize: '33px' });
  /* ★그림 «위»에도 글자가 얹힌다(서클 에셋의 「사진 위 글자」와 같은 자리) */
  await setup(page, { lines: CIRC({ imgSrc: PX, text: 'ON' }) });
  const c3 = await circ(page);
  expect(c3, '★그림 든 원 위에 글자가 안 얹혔다').toMatchObject({ text: 'ON', hasImg: true });
});

/* ══ G20-4 ★패널 손잡이 (㉠-a) ═══════════════════════════════════════════════════════ */
test('G20-4 ★패널 — 원형 줄엔 「채움·글자」가 뜨고 글자를 넣으면 「글자색·크기」가 뜬다 · ★사각 줄엔 넷 다 없다(대조)', async ({ page }) => {
  // ★대조 먼저 — 사각 줄에서 넷이 «없다» ＋ 줄 수가 4(grid-img-crop P1 이 잠근 그 수)
  await setup(page, { lines: [{ type: 'image', imgSrc: PX2, height: 120 }] });
  await openLine(page);
  const sq = await panelIds(page);
  expect(sq.there, '[전제] 사각 줄에서 Image 절이 떴다 — 안 떴으면 아래 「없다」는 아무것도 안 잰다').toBe(true);
  expect(sq.has, '★대조 실패 — 사각 줄에 원 전용 손잡이가 떴다').toEqual([]);
  expect(sq.rowN, '★사각 줄의 Image 절 줄 수가 4(선택·폭·높이·반경)가 아니다 — grid-img-crop P1 과 같은 수').toBe(4);

  // 원형 줄 · 글자 «없음» → 채움 ＋ 글자 둘만
  await setup(page, { lines: CIRC() });
  await openLine(page);
  const c0 = await panelIds(page);
  expect(c0.there, '[전제] 원형 줄에서 Image 절이 떴다').toBe(true);
  expect(c0.has, '★원형 줄에 「채움·글자」가 안 떴다(또는 글자 없이 글자색/크기가 떴다)').toEqual(['grd-img-cbg-hex', 'grd-img-ctext']);

  // 원형 줄 · 글자 «있음» → 넷 다
  await setup(page, { lines: CIRC({ text: 'T' }) });
  await openLine(page);
  const c1 = await panelIds(page);
  expect(c1.has, '★글자가 있는데 「글자색·크기」가 안 떴다').toEqual(['grd-img-cbg-hex', 'grd-img-ctext', 'grd-img-ctcol-hex', 'grd-img-ctsize']);
  /* ★입력칸이 ★지금 값을 들고 있다(속성이 아니라 .value 로 넣는다 — 따옴표 안전) */
  expect(await page.evaluate(() => document.getElementById('grd-img-ctext').value), '★글자칸이 지금 글자를 안 보여 준다').toBe('T');
  /* ★따옴표가 든 글자도 깨지지 않는다 */
  await setup(page, { lines: CIRC({ text: 'a"b\'c<d' }) });
  await openLine(page);
  expect(await page.evaluate(() => document.getElementById('grd-img-ctext')?.value), '★따옴표/꺾쇠가 든 글자에서 입력칸이 깨졌다').toBe('a"b\'c<d');
  expect((await circ(page)).text, '★따옴표/꺾쇠가 든 글자가 화면에서 깨졌다').toBe('a"b\'c<d');
});

/* ══ G20-5 ★⌘Z — ★걸음 수 ════════════════════════════════════════════════════════════ */
test('G20-5 ★색 한 번 = ⌘Z ★한 걸음 · 글자 한 번 = ★한 걸음 (패널 손잡이로 · 수로 잰다)', async ({ page }) => {
  await setup(page, { lines: CIRC() });
  await openLine(page);
  /* [전제] 손잡이가 떴다 */
  expect((await panelIds(page)).has, '[전제] 패널 손잡이 둘이 떴다').toEqual(['grd-img-cbg-hex', 'grd-img-ctext']);

  // ── ⑴ 색 한 번(네이티브 색칸: input=적용 · change=커밋 — wireColorField 계약)
  const colorStep = await page.evaluate(async () => {
    const tip = () => window.getHistoryTip();
    const t0 = tip();
    const p = document.getElementById('grd-img-cbg-color');
    p.value = '#ff0000';
    p.dispatchEvent(new Event('input', { bubbles: true }));
    p.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 260));
    const t1 = tip();
    const bgNow = () => getComputedStyle(document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-frame')).backgroundColor;
    const painted = bgNow();
    const dLen = t1.len - t0.len;
    document.activeElement?.blur?.();
    window.undo();
    await new Promise(r => setTimeout(r, 260));
    return { t0, t1, painted, afterUndo: bgNow(), dLen, posSteps: t1.pos - t0.pos, tip2: tip() };
  });
  expect(colorStep.painted, '[전제] 색이 실제로 칠해졌다').toBe('rgb(255, 0, 0)');
  /* ★★칸 «수»를 단언한다 — ⌘Z 만 보면 못 가른다(아래 ⚠️). 색은 push-after 한 칸. */
  expect(colorStep.dLen, `★색 한 번이 히스토리 칸을 ★1개 안 만들었다(Δlen=${colorStep.dLen}) — ` +
    '0 이면 그 제스처는 자기 칸이 없다(앞 편집과 묶여 ⌘Z 한 번에 같이 사라질 수 있다)').toBe(1);
  expect(colorStep.afterUndo, `★⌘Z ★한 번으로 색이 안 돌아갔다 — 걸음이 1 이 아니다(pos ${colorStep.t0.pos}→${colorStep.t1.pos}, undo 뒤 ${colorStep.tip2.pos})`).not.toBe('rgb(255, 0, 0)');

  // ── ⑵ 글자 한 번
  await setup(page, { lines: CIRC() });
  await openLine(page);
  const textStep = await page.evaluate(async () => {
    const tip = () => window.getHistoryTip();
    const t0 = tip();
    const el = document.getElementById('grd-img-ctext');
    el.value = '글자';
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const t1 = tip();
    const txt = () => (document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-circle-text')?.textContent ?? null);
    const typed = txt();
    const dLen = t1.len - t0.len;
    document.activeElement?.blur?.();
    window.undo();
    await new Promise(r => setTimeout(r, 300));
    return { t0, t1, typed, dLen, afterUndo: txt(), tip2: tip() };
  });
  expect(textStep.typed, '[전제] 글자가 실제로 들어갔다').toBe('글자');
  /* ★★★여기가 이 검사의 «이가 있는» 자리다 (2026-10-07 실측으로 세웠다)
   *   ⛔옛 판은 pos/len 을 ★읽어 ★메시지에만 썼다 ⇒ ★`pushHistory` 를 ★아예 빼도 ★초록이었다
   *     (= ★이 검사가 ★걸음을 ★안 재고 있었다 · 「음성대조는 죽은 자를 못 잡는다」의 한 사례).
   *   ★쟀더니: push-before ＋0 · pushHistory 없음 ＋0 · ★push-after ★＋1.
   *   ⇒ ★이 단언 하나가 ★그 셋을 가른다. ⛔지우면 이 자리가 무방비가 된다. */
  expect(textStep.dLen, `★글자 한 번이 히스토리 칸을 ★1개 안 만들었다(Δlen=${textStep.dLen}) — ` +
    'prop-grid.js 의 그 핸들러가 push-before 로 되돌아갔거나 pushHistory 가 빠졌다(둘 다 Δlen 0 이다)').toBe(1);
  expect(textStep.afterUndo, `★⌘Z ★한 번으로 글자가 안 사라졌다 — 걸음이 1 이 아니다(pos ${textStep.t0.pos}→${textStep.t1.pos}, undo 뒤 ${textStep.tip2.pos})`).toBeNull();
});

/* ══ G20-10 ★두 제스처를 «연달아» — 각자 자기 칸을 갖나 ═══════════════════════════════ */
test('G20-10 ★색 → 글자를 «연달아» 하면 ⌘Z 가 ★두 걸음이다 (각 제스처가 자기 칸을 갖는다)', async ({ page }) => {
  /* ★★왜 이 자가 생겼나 — ★G20-5 는 색 한 번 / 글자 한 번을 ★«따로만» 쟀다. ★연달아 하는 장면을 ★안 쟀다.
   *   그 틈을 ★`tests/unit/prop-push-after.test.mjs` ★PA-1 이 ★소스에서 잡았다(2026-10-07):
   *     「★찍고 나서 바꾸는 핸들러가 생겼다 — ★앞 편집이 ★push-after 면 ★이 변경은 ★자기 칸을 못 갖고
   *       ★⌘Z 한 번에 ★«두 편집»이 ★같이 사라진다」
   *   ★이 레인에서 ★그 조건이 ★실제로 섰다: ★색은 push-after(wireColorField onCommit) ·
   *   ★글자는 push-before 였다 ⇒ ★색 직후 글자의 push-before 가 ★무변화 차단에 먹혀 ★칸을 못 만든다.
   * ⇒ ★처방은 ★PA-1 이 적은 그대로 — ★적용 먼저, pushHistory 나중(둘 다 push-after 로 맞춘다).
   * ★이 자는 ★그 결함의 ★«행위» 증인이다 — 소스 검사(PA-1)와 ★짝이다(한쪽만 두면 다음 사람이 한쪽만 본다). */
  await setup(page, { lines: CIRC() });
  await openLine(page);
  expect((await panelIds(page)).has, '[전제] 손잡이 둘이 떴다').toEqual(['grd-img-cbg-hex', 'grd-img-ctext']);
  const out = await page.evaluate(async () => {
    const read = () => {
      const f = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-frame');
      return { bg: getComputedStyle(f).backgroundColor,
               text: f.querySelector(':scope > .grd-img-circle-text')?.textContent ?? null };
    };
    const len0 = window.getHistoryTip().len;
    // ⑴ 색
    const p = document.getElementById('grd-img-cbg-color');
    p.value = '#ff0000';
    p.dispatchEvent(new Event('input', { bubbles: true }));
    p.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 280));
    const afterColor = read();
    const lenAfterColor = window.getHistoryTip().len;
    // ⑵ 글자 — ★같은 줄에, ★연달아
    const t = document.getElementById('grd-img-ctext');
    t.value = '연달아';
    t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 320));
    const afterText = read();
    const lenAfterText = window.getHistoryTip().len;
    document.activeElement?.blur?.();
    window.undo(); await new Promise(r => setTimeout(r, 300));
    const z1 = read();
    window.undo(); await new Promise(r => setTimeout(r, 300));
    const z2 = read();
    return { afterColor, afterText, z1, z2, len0, lenAfterColor, lenAfterText };
  });
  /* [전제] 두 제스처가 ★둘 다 실제로 먹었다 — 안 먹었으면 아래 걸음 수가 아무것도 안 잰다 */
  expect(out.afterColor.bg, '[전제] ⑴ 색이 먹었다').toBe('rgb(255, 0, 0)');
  expect(out.afterText, '[전제] ⑵ 글자가 먹었고 색은 그대로다').toMatchObject({ text: '연달아', bg: 'rgb(255, 0, 0)' });
  /* ★★주 단언 — ⌘Z ①은 «글자만» 되돌린다(색은 남는다). ⛔둘이 같이 사라지면 그게 PA-1 이 말한 그 결함이다 */
  expect(out.z1, `★⌘Z ① 이 «글자만» 안 되돌렸다 — 둘이 같이 사라졌으면 글자가 자기 칸을 못 가진 것이다: ${JSON.stringify(out.z1)}`)
    .toMatchObject({ text: null, bg: 'rgb(255, 0, 0)' });
  /* ★⌘Z ②가 색까지 */
  expect(out.z2.bg, `★⌘Z ② 가 색을 안 되돌렸다: ${JSON.stringify(out.z2)}`).not.toBe('rgb(255, 0, 0)');
  /* ★★★그리고 «칸 수»로도 — ⚠️위 ⌘Z 단언 ★셋만으로는 ★못 잡는다. 실측(2026-10-07):
   *   ★`pushHistory` 를 ★아예 뺀 판에서도 ★위 ⌘Z 단언이 ★전부 초록이었다
   *   (`ensureHistoryCheckpoint` 가 첫 되돌리기에서 «현재 상태» 칸을 만들어 ★구해 준다).
   *   ⇒ ★두 제스처가 ★각각 ★자기 칸을 갖는지는 ★«수»로만 보인다. ⛔이 둘을 지우지 마라. */
  expect([out.lenAfterColor - out.len0, out.lenAfterText - out.lenAfterColor],
    `★두 제스처의 히스토리 칸이 [1,1] 이 아니다 — 잰 값 [${out.lenAfterColor - out.len0}, ${out.lenAfterText - out.lenAfterColor}]. ` +
    '글자 쪽이 0 이면 prop-grid.js 의 그 핸들러가 push-before 다(앞 색 편집과 같은 상태를 찍어 무변화 차단에 먹힌다).')
    .toEqual([1, 1]);
});

/* ══ G20-6 ★저장 → 다시 열기 ══════════════════════════════════════════════════════════ */
test('G20-6 ★저장→다시 열기 뒤에도 ★색과 글자가 남아 있다 (어제 「못 쟀음」으로 남긴 자리)', async ({ page }) => {
  await setup(page, { lines: CIRC({ imgSrc: PX, bg: '#123456', text: '남아라', color: '#abcdef', fontSize: 28 }) });
  const before = await circ(page);
  /* [전제] 왕복 ★전에 셋이 다 화면에 있다 */
  expect(before, '[전제] 왕복 전 상태').toMatchObject({ bg: 'rgb(18, 52, 86)', text: '남아라', tColor: 'rgb(171, 205, 239)', tSize: '28px' });
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const f = document.querySelector('.grd-img-frame.grd-img-circle');
    if (!f) return null;
    const t = f.querySelector(':scope > .grd-img-circle-text');
    const cs = getComputedStyle(f), tcs = t ? getComputedStyle(t) : null;
    return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, text: t ? t.textContent : null,
             tColor: tcs ? tcs.color : null, tSize: tcs ? tcs.fontSize : null,
             keys: Object.keys(JSON.parse(document.querySelector('.grid-block').dataset.cols)[0].lines[0]) };
  });
  expect(after, '★왕복 뒤 원이 아예 없다').not.toBeNull();
  expect(after).toMatchObject({ bg: 'rgb(18, 52, 86)', radius: '50%', text: '남아라', tColor: 'rgb(171, 205, 239)', tSize: '28px' });
  expect(after.keys, '★저장본 줄에서 키가 빠졌다').toEqual(expect.arrayContaining(['imgShape', 'bg', 'text', 'color', 'fontSize']));
});

/* ══ G20-7 ★원 → 사각 → 원 (㉢ 판정: ★안 뗀다) ════════════════════════════════════════ */
test('G20-7 ★「사각으로 바꾸기」가 색·글자를 ★안 뗀다 — 다시 원으로 바꾸면 ★그대로 돌아온다(지디 ㉢)', async ({ page }) => {
  /* ★왜 이 쪽인가 — 두 실패를 견줬다: ⒜ 사각 줄 저장본에 ★안 읽히는 bg/text 가 남는다(작은 비용)
   *   vs ⒝ ★사람이 쓴 글자가 ★말없이 사라진다(되돌릴 길 없음). ⇒ ⒜. ★저장본이 커지는 것은 작은 비용이다.
   * ★코드 0줄로 그렇다 — `_gridMergeLine` 의 종류 청소는 `fields.type !== undefined` 일 때만 돌고,
   *   「사각으로」 길은 `{imgShape: undefined}` 만 준다. ★이 자가 그 사실을 잠근다. */
  await setup(page, { lines: CIRC({ imgSrc: PX, bg: '#ff00ff', text: '안뗀다' }) });
  expect((await circ(page)).text, '[전제] 원에 글자가 있다').toBe('안뗀다');
  const [x, y] = await page.evaluate(() => {
    const r = document.querySelector('#gG .grd-img-frame').getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  const menu = async () => {
    await page.mouse.click(x, y, { button: 'right' });
    return page.evaluate(() => {
      const el = document.getElementById('bcm-grid-img-circle'); const r = el.getBoundingClientRect();
      return { vis: getComputedStyle(el).display, label: el.textContent.trim(), xy: [r.left + 20, r.top + r.height / 2] };
    });
  };
  let m = await menu();
  expect(m, '[전제] 우클릭 메뉴가 「사각으로 바꾸기」를 보인다').toMatchObject({ vis: 'flex', label: '사각으로 바꾸기' });
  await page.mouse.click(m.xy[0], m.xy[1]); await page.waitForTimeout(250);
  const sqKeys = await page.evaluate(() => Object.keys(JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[0]));
  expect(sqKeys, '★grid-img-circle C4 와 같은 사실 — imgShape 키는 «빠진다»').not.toContain('imgShape');
  expect(sqKeys, '★★사각으로 바꿀 때 bg·text 를 ★뗐다 — 사람이 쓴 글자가 말없이 사라진다(㉢ 판정 위반)').toEqual(expect.arrayContaining(['bg', 'text']));
  /* ★사각 줄에서는 그 글자가 ★안 그려진다(사각 가지는 text 를 안 읽는다) — 「안 뗀다」는 «데이터»의 말이다 */
  expect(await page.evaluate(() => !!document.querySelector('#gG .grd-img-circle-text')), '사각 줄에 글자칸이 그려졌다').toBe(false);
  // 다시 원으로
  m = await menu();
  expect(m.label).toBe('원형으로 바꾸기');
  await page.mouse.click(m.xy[0], m.xy[1]); await page.waitForTimeout(250);
  const back = await circ(page);
  expect(back, '★다시 원으로 바꿨는데 색·글자가 안 돌아왔다').toMatchObject({ bg: 'rgb(255, 0, 255)', text: '안뗀다', radius: '50%' });
});

/* ══ G20-8 ★음성대조 — 안 준 줄의 산출은 ★바이트 동일 ════════════════════════════════ */
test('G20-8 ★지키는 자 — bg·text 가 둘 다 «없는» 원의 산출은 ★예전과 바이트 동일 · 사각 줄도 그대로', async ({ page }) => {
  /* ★이 자가 ★핀(2866df63)에서도 ★초록이어야 한다 — 그래야 「G20-1~7 빨강」이 «기능이 없어서»이고
   *   «하네스가 깨져서»가 아님을 가른다. ⇒ ⛔여기 단언을 바꾸면 양성대조의 바닥이 사라진다. */
  await setup(page, { lines: CIRC({ imgSrc: PX, height: 100 }) });
  const htmlCircle = await page.evaluate(() =>
    document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-frame').outerHTML);
  expect(htmlCircle, '★장식 없는 원의 산출이 바뀌었다(position/background 가 샜다)').toBe(
    '<div data-r="0" data-c="0" data-line="0" class="grd-img-frame grd-img-circle" style="width:100px;max-width:100%;aspect-ratio:1/1;border-radius:50%;overflow:hidden;">'
    + `<img class="grd-img" src="${PX}" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover;">`
    + '</div>');
  expect(await page.evaluate(() => !!document.querySelector('#gG .grd-img-circle-text')), '★글자를 안 줬는데 글자칸이 생겼다').toBe(false);

  // 빈 원(장식 없음)도 그대로
  await setup(page, { lines: CIRC({ height: 120 }) });
  expect(await page.evaluate(() => document.querySelector('#gG .grd-img-frame').outerHTML),
    '★장식 없는 «빈» 원의 산출이 바뀌었다').toBe(
    '<div data-r="0" data-c="0" data-line="0" class="grd-img-frame grd-img-empty grd-img-circle" style="width:120px;max-width:100%;aspect-ratio:1/1;border-radius:50%;"></div>');

  // 사각 줄 — bg·text 를 줘도 원 가지를 안 탄다(사각 산출은 한 글자도 안 바뀐다)
  await setup(page, { lines: [{ type: 'image', imgSrc: PX2, height: 120, bg: '#ff0000', text: 'X' }] });
  const sq = await page.evaluate(() => {
    const f = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-frame');
    return { radius: getComputedStyle(f).borderTopLeftRadius, bg: getComputedStyle(f).backgroundColor,
             hasText: !!f.querySelector('.grd-img-circle-text') };
  });
  expect(sq, '★사각 이미지 줄이 원 가지의 색·글자를 먹었다').toMatchObject({ radius: '0px', hasText: false });
  expect(sq.bg, '★사각 이미지 줄에 배경색이 샜다').toBe('rgba(0, 0, 0, 0)');
});

/* ══ G20-9 ★더블클릭 갈래 무변화 ═════════════════════════════════════════════════════ */
test('G20-9 ★지키는 자 — 색을 칠한 «빈» 원도 더블클릭은 ★그림 넣기(파일 선택기)다 · 그림 든 원은 크롭 편집', async ({ page }) => {
  /* ★이게 `grd-img-empty` 를 ★안 뗀 까닭이다 — 떼면 그림 없는 원에서 크롭 편집기가 열린다(갈래가
   *   `.grd-img-frame[data-line]:not(.grd-img-empty)` 다 — js/block-drag.js). ⛔클래스를 떼는 「정리」 금지. */
  await setup(page, { lines: CIRC({ bg: '#ff0000', text: '글자' }) });
  const marks = await page.evaluate(() => {
    const f = document.querySelector('#gG .grd-img-frame');
    return { empty: f.classList.contains('grd-img-empty'),
             matchesCropBranch: f.matches('.grd-img-frame[data-line]:not(.grd-img-empty)') };
  });
  expect(marks.empty, '[전제] 색·글자가 있어도 그림이 없으면 빈 슬롯이다').toBe(true);
  expect(marks.matchesCropBranch, '★색 칠한 빈 원이 ★크롭 편집 갈래에 걸린다 — 그림 넣는 길이 사라졌다').toBe(false);
  /* ★실제로 더블클릭해서 ★크롭 편집기가 ★안 열리는 것을 본다.
     ★표식은 ★`block._grdImgEdit` ＋ 대역 요소 `[data-grd-img-proxy]` 다(js/image-handling.js 실측 —
     클래스가 아니다. ⛔「img-editing」 같은 이름으로 재면 ★늘 0 이라 아무것도 안 잰다). */
  const dbl = async () => {
    const [x, y] = await page.evaluate(() => {
      const r = document.querySelector('#gG .grd-img-frame').getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    await page.mouse.click(x, y); await page.waitForTimeout(180);
    await page.mouse.dblclick(x, y); await page.waitForTimeout(300);
    return page.evaluate(() => ({
      editing: !!document.getElementById('gG')?._grdImgEdit,
      proxies: document.querySelectorAll('[data-grd-img-proxy]').length,
    }));
  };
  expect(await dbl(), '★색 칠한 «빈» 원에서 크롭 편집 모드가 열렸다 — 그림 넣는 길이 사라졌다').toEqual({ editing: false, proxies: 0 });

  /* ★★양성대조(같은 판 · 조건만 바꿈) — 그림을 ★넣으면 ★같은 제스처가 ★크롭 편집기를 ★연다.
     ⛔이게 없으면 위 「열리지 않았다」가 ★«더블클릭이 아예 안 먹는다»와 구분되지 않는다. */
  await setup(page, { lines: CIRC({ imgSrc: PX, bg: '#ff0000', text: '글자' }) });
  expect(await page.evaluate(() => document.querySelector('#gG .grd-img-frame').matches('.grd-img-frame[data-line]:not(.grd-img-empty)')),
    '★그림 든 원이 크롭 갈래에서 빠졌다').toBe(true);
  const opened = await dbl();
  expect(opened.editing, '★★양성대조 실패 — 그림 든 원에서도 크롭 편집기가 안 열렸다. ⇒ 위 음성 결과는 ' +
    '「색 칠한 빈 원은 안 연다」를 ★안 재고 있었다(더블클릭 자체가 안 먹는 것일 수 있다)').toBe(true);
});
