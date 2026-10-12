/* count-sticker — 카운트 스티커(1012t1Z4 · 현빈 「누를 때마다 원 안에 넘버링된 숫자」).
 *
 * ★무엇을 잠그나
 *   C1 찍기(실제 메뉴 → 실제 마우스) · C2 찍힌 자리 = 누른 자리(배율을 먹는다) · C3 번호는 섹션별
 *   C4 표기 A/B/C(묶음) · C5 시작 번호(묶음) · C6 모양 원·사각·투명(개별) · C7 크기(폰트 비례)
 *   C8 ⌘Z 한 번 = 스티커 하나 · C9 Esc 종료 · C10 다시 그려도 같은 글자(리로드·undo 와 같은 길)
 *   C11 번호 다시 매기기 · C12 더블클릭해도 글자 편집이 안 열린다 · C13 일반 스티커 패널 무회귀
 * ★스티커는 기존 sticker-block(circle/square)의 변형이다 — data-count 가 붙었을 뿐이다.
 * ★자리 비교는 «레이아웃 px»로 한다(dataset.x·sizeW 와 offsetWidth). 화면 사각형은 «누를 점»을 정하는 데만 쓴다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC_A = '[id="secA"]';
const SEC_B = '[id="secB"]';

/* 빈 섹션 둘. */
async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:320px;background:#f4f4f6"><div class="section-inner"></div></div>'
      + '<div class="section-block" id="secB" style="position:relative;height:320px;background:#e9eef4"><div class="section-inner"></div></div>';
    window.rebindAll?.();
  });
}

/* 도구를 켜고, 진입 직후 가드(50ms)가 지나 «찍을 수 있는» 상태까지 기다린다. */
async function toolOn(page) {
  await page.evaluate(() => window.enterCountStickerMode());
  await page.waitForFunction(() => window._countStkState().mode === true && window._countStkState().armed === true);
}

const countIn = (page, secId) => page.evaluate((id) => document.querySelectorAll(`#${id} .sticker-block[data-count]`).length, secId);

/* 섹션의 (fx, fy) 비율 지점을 실제 마우스로 누르고, 스티커가 하나 늘 때까지 기다린다. 돌려줌: 누른 화면 좌표. */
async function stamp(page, secSel, fx, fy) {
  const secId = secSel === SEC_A ? 'secA' : 'secB';
  expect((await page.evaluate(() => window._countStkState())).mode, '★전제: 도구가 켜져 있다').toBe(true);
  const before = await countIn(page, secId);
  const r = await waitStableRect(page, secSel);
  const x = r.left + r.width * fx, y = r.top + r.height * fy;
  await clickAt(page, x, y, { sel: secSel }, { label: `stamp ${secId}` });
  await expect.poll(() => countIn(page, secId), `${secId}: 누른 뒤 스티커가 하나 늘었다`).toBe(before + 1);
  return { x, y };
}

/* 그 섹션의 카운트 스티커 글자(DOM 순) — «그려진» 글자와 dataset 을 같이 읽어 둘이 같은지도 본다. */
const texts = (page, secId) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .sticker-block[data-count]`)].map((b) => {
  const drawn = b.querySelector('.sticker-text')?.textContent;
  return drawn === b.dataset.text ? drawn : `그림(${drawn})≠dataset(${b.dataset.text})`;
}), secId);

async function stamp3(page, secSel = SEC_A) {
  await stamp(page, secSel, 0.2, 0.5);
  await stamp(page, secSel, 0.5, 0.5);
  await stamp(page, secSel, 0.8, 0.5);
}

/* 우측 패널 숫자칸에 «실제 키보드»로 값을 넣고 Enter. */
async function typeNumber(page, sel, value) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}

test('C0 전제 — 도구가 실렸고 켜고 끌 수 있다 · 오류 0건', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => {
    const t = { label: typeof window.CountSticker?.label, toggle: typeof window.toggleCountStickerMode, make: typeof window.makeStickerBlock,
      before: window._countStkState().mode };
    window.toggleCountStickerMode(); t.on = window._countStkState().mode; t.body = document.body.classList.contains('count-stk-mode');
    window.toggleCountStickerMode(); t.off = window._countStkState().mode; t.bodyOff = document.body.classList.contains('count-stk-mode');
    return t;
  });
  expect(r).toEqual({ label: 'function', toggle: 'function', make: 'function', before: false, on: true, body: true, off: false, bodyOff: false });
  expect(errs).toEqual([]);
});

test('C1 찍기 — 메뉴 「Count Sticker」로 켜고 섹션을 세 번 누르면 1·2·3 이 찍힌다', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Count Sticker")');
  await page.waitForFunction(() => window._countStkState().mode === true && window._countStkState().armed === true);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('secA')).cursor), '도구가 켜지면 십자 커서').toBe('crosshair');
  await stamp3(page);
  expect(await texts(page, 'secA')).toEqual(['1', '2', '3']);
  const r = await page.evaluate(() => {
    const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    return { counts: all.map(b => b.dataset.count), direct: all.every(b => b.parentElement.id === 'secA'),
      shapes: all.map(b => b.dataset.shape), radius: getComputedStyle(all[0]).borderRadius,
      selected: all.map(b => b.classList.contains('selected')), panel: !!document.getElementById('stk-count-section'),
      mode: window._countStkState().mode };
  });
  expect(r.counts).toEqual(['1', '2', '3']);
  expect(r.direct, '스티커는 섹션 직속이다').toBe(true);
  expect(r.shapes).toEqual(['circle', 'circle', 'circle']);
  expect(r.radius, '기본 모양은 원').toBe('50%');
  expect(r.selected, '방금 찍은 것이 골라진다').toEqual([false, false, true]);
  expect(r.panel, '찍으면 우측 패널에 Count 절이 뜬다').toBe(true);
  expect(r.mode, '찍은 뒤에도 도구는 켜진 채다').toBe(true);
  expect(errs).toEqual([]);
});

test('C2 찍힌 자리 — 스티커 중심이 누른 점이다(배율이 걸린 캔버스에서)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  const p = await stamp(page, SEC_A, 0.37, 0.42);
  const r = await page.evaluate(([px, py]) => {
    const sec = document.getElementById('secA');
    const b = sec.querySelector('.sticker-block[data-count]');
    const box = sec.getBoundingClientRect();
    const scale = box.width / sec.offsetWidth;          // 배율을 «그려진 것»에서 잰다(도구가 읽는 currentZoom 과 다른 출처)
    return { scale, wantX: (px - box.left) / scale, wantY: (py - box.top) / scale,
      gotX: parseInt(b.dataset.x, 10) + parseInt(b.dataset.sizeW, 10) / 2, gotY: parseInt(b.dataset.y, 10) + parseInt(b.dataset.sizeH, 10) / 2,
      styleLeft: b.style.left, dataX: b.dataset.x };
  }, [p.x, p.y]);
  expect(Math.abs(r.scale - 1), `★전제: 캔버스에 배율이 걸려 있다(scale=${r.scale}) — 1 이면 이 칸은 ÷배율을 못 잰다`).toBeGreaterThan(0.2);
  expect(Math.abs(r.gotX - r.wantX), `가로 중심 ${r.gotX} ≠ 누른 점 ${r.wantX}`).toBeLessThanOrEqual(1.5);
  expect(Math.abs(r.gotY - r.wantY), `세로 중심 ${r.gotY} ≠ 누른 점 ${r.wantY}`).toBeLessThanOrEqual(1.5);
  expect(r.styleLeft, '그려진 자리 = dataset').toBe(r.dataX + 'px');
});

test('C3 번호는 섹션별 — 둘째 섹션의 첫 찍기는 1 이다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);
  await stamp(page, SEC_A, 0.6, 0.5);
  await stamp(page, SEC_B, 0.4, 0.5);
  await stamp(page, SEC_A, 0.8, 0.5);
  expect(await texts(page, 'secA')).toEqual(['1', '2', '3']);
  expect(await texts(page, 'secB')).toEqual(['1']);
});

test('C4 표기 — 패널에서 A 를 누르면 같은 섹션이 전부 A·B·C, 다른 섹션은 그대로', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_B, 0.3, 0.5);
  await stamp(page, SEC_B, 0.6, 0.5);
  await stamp3(page, SEC_A);
  expect(await texts(page, 'secA'), '★전제').toEqual(['1', '2', '3']);
  await page.click('#stk-count-style [data-count-style="alpha"]');
  expect(await texts(page, 'secA')).toEqual(['A', 'B', 'C']);
  expect(await texts(page, 'secB'), '다른 섹션은 안 바뀐다').toEqual(['1', '2']);
  expect(await page.evaluate(() => document.querySelector('#stk-count-style .active')?.dataset.countStyle)).toBe('alpha');
  expect((await page.evaluate(() => window._countStkState())).mode, '패널을 만져도 도구는 켜진 채다').toBe(true);
  // 다음 찍기는 표기를 물려받는다
  await stamp(page, SEC_A, 0.5, 0.2);
  expect(await texts(page, 'secA')).toEqual(['A', 'B', 'C', 'D']);
  await page.click('#stk-count-style [data-count-style="num"]');
  expect(await texts(page, 'secA')).toEqual(['1', '2', '3', '4']);
});

test('C5 시작 번호 — 5 로 바꾸면 5·6·7, 알파벳에서 26 이면 Z·AA·AB', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp3(page);
  await typeNumber(page, '#stk-count-start', 5);
  await expect.poll(() => texts(page, 'secA')).toEqual(['5', '6', '7']);
  expect(await page.evaluate(() => [...document.querySelectorAll('#secA [data-count]')].map(b => b.dataset.countStart))).toEqual(['5', '5', '5']);
  await page.click('#stk-count-style [data-count-style="alpha"]');
  expect(await texts(page, 'secA')).toEqual(['E', 'F', 'G']);
  await typeNumber(page, '#stk-count-start', 26);
  await expect.poll(() => texts(page, 'secA')).toEqual(['Z', 'AA', 'AB']);
  // 다음 찍기는 시작 번호를 물려받는다
  await page.evaluate(() => document.activeElement?.blur?.());
  await stamp(page, SEC_A, 0.5, 0.2);
  expect(await texts(page, 'secA')).toEqual(['Z', 'AA', 'AB', 'AC']);
});

test('C6 모양 — 사각은 모서리 반경이 바뀌고, 투명은 배경이 비고 숫자가 배경색이 된다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);
  await stamp(page, SEC_A, 0.6, 0.5);
  const read = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    const probe = document.createElement('span'); probe.style.color = all[1].dataset.bgColor; document.body.appendChild(probe);
    const bgAsColor = getComputedStyle(probe).color; probe.remove();
    const cs = all.map(b => getComputedStyle(b));
    return { radius: cs.map(c => c.borderRadius), bg: cs.map(c => c.backgroundColor), color: cs.map(c => c.color), bgAsColor,
      shape: all.map(b => b.dataset.shape), countShape: all.map(b => b.dataset.countShape),
      label: document.querySelector('#stk-colors-section .prop-label')?.textContent.trim(),
      txtRow: getComputedStyle(document.getElementById('stk-txt-row')).display,
      active: document.querySelector('#stk-count-shape .active')?.dataset.countShape };
  });
  const r0 = await read();
  expect(r0.radius, '★전제: 둘 다 원').toEqual(['50%', '50%']);
  expect(r0.bg[1], '★전제: 배경이 칠해져 있다').toBe(r0.bgAsColor);
  expect(r0.label).toBe('배경색');

  await page.click('#stk-count-shape [data-count-shape="square"]');
  const r1 = await read();
  expect(r1.radius, '고른 것만 사각(개별 속성)').toEqual(['50%', '8px']);
  expect(r1.shape).toEqual(['circle', 'square']);
  expect(r1.active).toBe('square');

  await page.click('#stk-count-shape [data-count-shape="none"]');
  const r2 = await read();
  expect(r2.countShape).toEqual(['circle', 'none']);
  expect(r2.bg[1], '투명: 배경이 빈다').toBe('rgba(0, 0, 0, 0)');
  expect(r2.color[1], '투명: 숫자색 = 배경색').toBe(r2.bgAsColor);
  expect(r2.bg[0], '다른 스티커는 그대로').toBe(r0.bg[0]);
  expect(r2.label, '투명이면 색 칸의 이름이 숫자색').toBe('숫자색');
  expect(r2.txtRow, '투명이면 글자색 행은 숨는다').toBe('none');
  expect(r2.active).toBe('none');

  // 다음 찍기는 «순번이 가장 큰» 스티커의 모양을 물려받는다
  await stamp(page, SEC_A, 0.8, 0.5);
  const r3 = await read();
  expect(r3.countShape).toEqual(['circle', 'none', 'none']);

  await page.click('#stk-count-shape [data-count-shape="circle"]');
  const r4 = await page.evaluate(() => { const b = document.querySelector('#secA .sticker-block.selected'); const c = getComputedStyle(b);
    return { radius: c.borderRadius, bgSet: c.backgroundColor !== 'rgba(0, 0, 0, 0)', countShape: b.dataset.countShape, handles: b.querySelectorAll('.sticker-corner-handle').length }; });
  expect(r4).toEqual({ radius: '50%', bgSet: true, countShape: 'circle', handles: 4 });
});

test('C7 크기 — 크기 칸이 폭·높이와 폰트를 같은 비율로 바꾼다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.5, 0.5);
  const read = () => page.evaluate(() => { const b = document.querySelector('#secA .sticker-block[data-count]');
    return { sizeW: b.dataset.sizeW, sizeH: b.dataset.sizeH, size: b.dataset.size, fs: b.dataset.fontSize, w: b.offsetWidth, h: b.offsetHeight,
      drawnFs: getComputedStyle(b).fontSize, sizeRow: getComputedStyle(document.getElementById('stk-size-row')).display,
      num: document.getElementById('stk-count-size-num').value, slider: document.getElementById('stk-count-size').value }; });
  const r0 = await read();
  expect([r0.sizeW, r0.sizeH, r0.fs, r0.w], '★전제: 기본 크기 56 · 폰트 26').toEqual(['56', '56', '26', 56]);
  expect(r0.sizeRow, '일반 「크기」 행은 숨는다(Count 절의 크기 행이 대신한다)').toBe('none');
  await typeNumber(page, '#stk-count-size-num', 112);
  await expect.poll(async () => (await read()).sizeW).toBe('112');
  const r1 = await read();
  expect([r1.sizeW, r1.sizeH, r1.size, r1.fs, r1.w, r1.h, r1.drawnFs, r1.slider]).toEqual(['112', '112', '112', '52', 112, 112, '52px', '112']);
  // 다음 찍기는 크기·폰트를 물려받는다
  await page.evaluate(() => document.activeElement?.blur?.());
  await stamp(page, SEC_A, 0.2, 0.5);
  const r2 = await page.evaluate(() => [...document.querySelectorAll('#secA .sticker-block[data-count]')].map(b => [b.dataset.sizeW, b.dataset.fontSize]));
  expect(r2).toEqual([['112', '52'], ['112', '52']]);
});

test('C8 되돌리기 — ⌘Z 한 번에 스티커 하나 · 패널 표기 변경의 ⌘Z 는 스티커를 안 지운다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.2, 0.5);
  await stamp(page, SEC_A, 0.5, 0.5);
  /* 셋째 찍기 = 히스토리 한 걸음. 헬퍼의 A0·A1·A2 를 그대로 단언한다:
       A1 끝 표본이 있다(찍은 직후 꼭대기가 새 칸) · A2 ⌘Z 가 구제 칸을 안 만들고 정확히 한 칸 내려간다.
     A3(바이트가 찍기 전과 같다)은 여기서 안 쓴다 — 이 칸의 섹션은 맨몸 픽스처라 복원이 data-section·안쪽 여백을
       새로 붙인다(스티커와 무관한 차이). 대신 «스티커가 정확히 하나 줄었다»를 아래에서 글자로 단언한다. */
  const h = await expectOneUndoStep(page, async () => { await stamp(page, SEC_A, 0.8, 0.5); }, '카운트 스티커 찍기', { soft: true });
  expect(h.changed, 'A0 찍기가 화면을 바꿨다').toBe(true);
  expect(h.dPos >= 1 && h.seqNew, `A1 찍은 직후 꼭대기가 새 칸(끝 표본) — Δpos=${h.dPos}`).toBe(true);
  expect([h.undoDLen, h.undoDPos], 'A2 ⌘Z 가 구제 칸을 안 만들고 정확히 한 칸 내려간다').toEqual([0, -1]);
  expect(await texts(page, 'secA'), '⌘Z 한 번 뒤 둘이 남는다').toEqual(['1', '2']);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => texts(page, 'secA'), '한 번 더 = 하나 더').toEqual(['1']);

  // 찍기 → 패널에서 A → ⌘Z : 표기만 돌아오고 스티커 수는 그대로
  await page.evaluate(() => window.exitCountStickerMode());
  await toolOn(page);
  await stamp(page, SEC_A, 0.5, 0.5);
  expect(await texts(page, 'secA'), '★전제').toEqual(['1', '2']);
  await page.click('#stk-count-style [data-count-style="alpha"]');
  expect(await texts(page, 'secA'), '★전제: 표기가 바뀌었다').toEqual(['A', 'B']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => texts(page, 'secA'), '표기 변경만 되돌아간다').toEqual(['1', '2']);
});

test('C9 종료 — Esc 로 도구가 꺼지고 그 뒤 클릭은 스티커를 안 만든다 · 우클릭·V 도 끈다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Escape');
  const s = await page.evaluate(() => ({ mode: window._countStkState().mode, body: document.body.classList.contains('count-stk-mode'),
    btn: document.getElementById('fp-pen-btn').classList.contains('active') }));
  expect(s).toEqual({ mode: false, body: false, btn: false });
  const r = await waitStableRect(page, SEC_A);
  await clickAt(page, r.left + r.width * 0.7, r.top + r.height * 0.5, { sel: SEC_A }, { label: '꺼진 뒤 클릭' });
  expect(await countIn(page, 'secA'), '꺼진 뒤 클릭은 개수를 안 바꾼다').toBe(1);

  await toolOn(page);
  await page.keyboard.press('v');
  expect((await page.evaluate(() => window._countStkState())).mode, 'V 로 끈다').toBe(false);

  await toolOn(page);
  await clickAt(page, r.left + r.width * 0.7, r.top + r.height * 0.5, { sel: SEC_A }, { label: '우클릭', button: 'right' });
  await page.waitForFunction(() => window._countStkState().mode === false);
  expect(await countIn(page, 'secA'), '우클릭은 찍지 않고 끄기만 한다').toBe(1);
});

test('C10 다시 그려도 같은 글자·모양 — 리로드·undo 와 같은 길(renderStickerBlock 재호출)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp3(page);
  await page.click('#stk-count-style [data-count-style="alpha"]');
  await page.click('#stk-count-shape [data-count-shape="none"]');
  const r = await page.evaluate(() => [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((b) => {
    const first = { text: b.querySelector('.sticker-text').textContent, bg: b.style.background, color: b.style.color, radius: b.style.borderRadius };
    b.innerHTML = ''; b.removeAttribute('style');          // 저장본엔 dataset 만 산다고 치고
    window.renderStickerBlock(b);
    const again = { text: b.querySelector('.sticker-text').textContent, bg: b.style.background, color: b.style.color, radius: b.style.borderRadius };
    return { first, again };
  }));
  expect(r.map(x => x.first.text), '★전제').toEqual(['A', 'B', 'C']);
  expect(r[2].first.bg, '★전제: 셋째는 투명').toBe('transparent');
  for (const x of r) expect(x.again).toEqual(x.first);
});

test('C11 번호 다시 매기기 — 2 를 지운 뒤 1·3 이 1·2 가 된다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp3(page);
  await page.evaluate(() => {
    const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    all[1].remove();
    window._selectSticker(all[0]);
  });
  expect(await texts(page, 'secA'), '★전제: 지워도 저절로 다시 매기지 않는다').toEqual(['1', '3']);
  // 지운 뒤의 다음 번호는 max+1 이다(빈 번호를 메우지 않는다)
  expect(await page.evaluate(() => window.CountSticker.nextOrdinal(document.getElementById('secA')))).toBe(4);
  await page.click('#stk-count-renumber');
  expect(await texts(page, 'secA')).toEqual(['1', '2']);
  expect(await page.evaluate(() => [...document.querySelectorAll('#secA [data-count]')].map(b => b.dataset.count))).toEqual(['1', '2']);
  expect(await page.evaluate(() => window.CountSticker.nextOrdinal(document.getElementById('secA')))).toBe(3);
});

test('C12 더블클릭 — 카운트 스티커는 글자 편집이 안 열린다(일반 스티커는 열린다)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);
  await page.evaluate(() => {
    window.exitCountStickerMode();
    const sec = document.getElementById('secA');
    const plain = window.makeStickerBlock({ shape: 'circle', x: 600, y: 200 });
    plain.id = 'stkPlain';
    sec.appendChild(plain);
    window.bindStickerSelect(plain);
  });
  const editable = (sel) => page.evaluate((sel) => document.querySelector(sel + ' .sticker-text')?.getAttribute('contenteditable'), sel);
  // 대조: 같은 방법으로 일반 스티커를 더블클릭하면 편집이 열린다(이 칸의 계측기가 산다)
  const rp = await waitStableRect(page, '#stkPlain');
  await clickAt(page, rp.cx, rp.cy, { sel: '[id="stkPlain"]' }, { label: '일반 스티커', dbl: true });
  await expect.poll(() => editable('#stkPlain'), '★대조: 일반 스티커는 더블클릭으로 편집이 열린다').toBe('true');
  await page.keyboard.press('Escape');
  const rc = await waitStableRect(page, '#secA .sticker-block[data-count]');
  await clickAt(page, rc.cx, rc.cy, { sel: '.sticker-block[data-count]' }, { label: '카운트 스티커', dbl: true });
  await page.waitForFunction(() => document.querySelector('#secA .sticker-block[data-count]').classList.contains('selected'));
  expect(await editable('#secA .sticker-block[data-count]'), '카운트 스티커는 편집이 안 열린다').not.toBe('true');
  expect(await texts(page, 'secA')).toEqual(['1']);
});

test('C13 무회귀 — 일반 스티커 패널엔 Count 절이 없고 Shape·크기 행이 그대로 보인다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('secA');
    const b = window.makeStickerBlock({ shape: 'circle' });
    sec.appendChild(b); window.bindStickerSelect(b); window._selectSticker(b);
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
    return { count: !!document.getElementById('stk-count-section'), shape: vis(document.getElementById('stk-shape-section')),
      shapeBtns: document.querySelectorAll('#stk-shape-group .prop-align-btn').length,
      sizeRow: vis(document.getElementById('stk-size-row')), text: vis(document.getElementById('stk-text-section')),
      mode: vis(document.getElementById('stk-mode-section')), txtRow: vis(document.getElementById('stk-txt-row')),
      label: document.querySelector('#stk-colors-section .prop-label')?.textContent.trim(),
      hasCount: 'count' in b.dataset, text0: b.dataset.text };
  });
  expect(r).toEqual({ count: false, shape: true, shapeBtns: 5, sizeRow: true, text: true, mode: true, txtRow: true, label: '배경색', hasCount: false, text0: 'NEW' });
  // 카운트 스티커를 만든 뒤에도 일반 「Sticker」의 «마지막 스타일»은 안 물든다
  await toolOn(page);
  await stamp(page, SEC_A, 0.6, 0.5);
  const r2 = await page.evaluate(() => {
    window.exitCountStickerMode();
    window.addStickerBlock();
    const all = [...document.querySelectorAll('#secA .sticker-block')];
    const nb = all[all.length - 1];
    return { n: all.length, hasCount: 'count' in nb.dataset, size: nb.dataset.size, fs: nb.dataset.fontSize };
  });
  expect(r2, '카운트 스티커의 크기·폰트가 다음 일반 스티커로 새지 않는다').toEqual({ n: 3, hasCount: false, size: '60', fs: '14' });
});
