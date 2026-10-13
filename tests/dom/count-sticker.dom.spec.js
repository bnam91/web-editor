/* count-sticker — 카운트 스티커(1012t1Z4 · 현빈 「누를 때마다 원 안에 넘버링된 숫자」).
 *
 * ★무엇을 잠그나
 *   C1 찍기(실제 메뉴 → 실제 마우스) · C2 찍힌 자리 = 누른 자리(배율을 먹는다) · C3 번호는 섹션별
 *   C4 표기 A/B/C(묶음) · C5 시작 번호(묶음) · C6 모양 원·사각·투명(「섹션 전체」 스위치를 끈 채 = 고른 것만) · C7 크기(폰트 비례)
 *   C8 ⌘Z 한 번 = 스티커 하나 · C9 Esc 종료 · C10 다시 그려도 같은 글자(리로드·undo 와 같은 길)
 *   C11 번호 다시 매기기 · C12 더블클릭해도 글자 편집이 안 열린다 · C13 일반 스티커 패널 무회귀(C13b 짝: A 블럭이면 Shape 5)
 *   C14·C15 크기를 키로 한 칸씩 바꿔도 폰트 비례 · C16·C17 다른 찍는 도구와 안 겹친다 · C18 키 리스너 짝·한 번에 하나
 *   C19 모서리를 찍어도 섹션 안 · C20 메뉴 재클릭·우클릭·⌘⇧Z · C21 시작 번호 칸은 확정 때 모델 값으로
 *   C23~C25 Esc(1013t2B2) — 패널 칸(슬라이더·숫자칸·색 hex)에 포커스가 있어도 한 번에 꺼진다 · 임자가 따로 있는 Esc(패널 밖 칸·인라인 편집·색 팝오버)는 안 끈다 · 선택은 둘째 Esc 가 푼다
 *   C26·C27 기본색(1013t2B4) — 빈 섹션 첫 찍기는 검정 배경·흰 글자 · 일반 Sticker 는 빨강 그대로 · 옛 저장본의 색은 그대로(색 키가 없어도 빨강)
 *   C28~C31 섹션 일괄(1013t2B3) — 모양·크기·폰트 크기·굵기·배경색·글자색이 같은 섹션 전부에(스위치 켬 · 기본) · ⌘Z 한 칸 · 스위치를 끄면 고른 것만 · 코너 드래그는 잡은 것만
 *   C22 이름(1013t2B1) — 보이는 이름은 Marking(마킹 블럭): 패널 절 제목·패널 머리·레이어 행. 저장 키(data-count*)는 그대로
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

/* 「섹션 전체」 스위치(1013t2B3)를 실제로 눌러 원하는 상태로 만든다. 칸(input)은 크기가 0 이라 감싼 label 을 누른다. */
async function groupSwitch(page, want) {
  const read = () => page.evaluate(() => document.getElementById('stk-count-group')?.checked ?? null);
  const now = await read();
  expect(now, '★전제: 「섹션 전체」 스위치가 패널에 있다').not.toBeNull();
  if (now !== want) await page.click('label.prop-toggle:has(#stk-count-group)');
  expect(await read(), `「섹션 전체」 스위치 = ${want}`).toBe(want);
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

test('C1 찍기 — 메뉴 「Marking」으로 켜고 섹션을 세 번 누르면 1·2·3 이 찍힌다', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Marking")');
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

test('C6 모양(스위치 끔) — 사각은 모서리 반경이 바뀌고, 투명은 배경이 비고 숫자가 배경색이 된다 · 고른 것만 바뀐다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);
  await stamp(page, SEC_A, 0.6, 0.5);
  /* 1013t2B3 — 기본은 섹션 일괄(C28)이다. 이 칸은 「섹션 전체」 스위치를 «끈» 채의 개별 동작을 잰다. */
  await groupSwitch(page, false);
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
  // ★1012t1J1(S4) 뒤 — Shape 의 형광펜 A(면) 단추는 «A 블럭일 때만» 보인다(새로 A 로 바꾸는 입구는 닫고, 옛 A 는 자기 자리를 본다).
  //   그래서 일반 스티커에선 4. 짝 칸 C13b 가 «A 블럭이면 5» 를 잰다.
  expect(r).toEqual({ count: false, shape: true, shapeBtns: 4, sizeRow: true, text: true, mode: true, txtRow: true, label: '배경색', hasCount: false, text0: 'NEW' });
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

/* ── 고침 뒤에 더한 칸(C14~C21 · 이벨류에이터가 짚은 결함 D1·D2 와 검사 구멍) ───────────────────────────── */

const SIZE0 = 56, FS0 = 26;                       // 기본 크기·폰트(C7 의 전제와 같은 값)
const wantFs = (size) => size * FS0 / SIZE0;      // 반올림 전 기대 폰트
const FS_TOL = 1;                                 // 허용 오차 = 반올림 1 이내
const STEPS = 28;                                 // 키 단계 수: 56 → 84 (기대 폰트 39 — 정수로 떨어진다)

const readSizeFs = (page) => page.evaluate(() => { const b = document.querySelector('#secA .sticker-block[data-count]');
  return { size: parseInt(b.dataset.sizeW, 10), sizeH: parseInt(b.dataset.sizeH, 10), fs: parseInt(b.dataset.fontSize, 10), w: b.offsetWidth,
    drawnFs: getComputedStyle(b).fontSize, num: document.getElementById('stk-count-size-num')?.value, fsNum: document.getElementById('stk-fs-num')?.value }; });

/* 스티커 하나를 찍고 도구를 끈 채(선택은 남는다) 패널이 떠 있는 상태로 만든다. */
async function oneSelected(page) {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.5, 0.5);
  await page.evaluate(() => window.exitCountStickerMode());
  const r = await readSizeFs(page);
  expect([r.size, r.fs, r.num], '★전제: 기본 크기 56 · 폰트 26 · 패널의 크기 칸이 떠 있다').toEqual([SIZE0, FS0, String(SIZE0)]);
}

async function pressN(page, sel, key, n) {
  await page.focus(sel);
  expect(await page.evaluate((s) => document.activeElement === document.querySelector(s), sel), `★전제: ${sel} 에 포커스`).toBe(true);
  for (let i = 0; i < n; i++) await page.keyboard.press(key);
}

test('C14 크기 키 단계(숫자칸) — ArrowUp 으로 한 칸씩 올려도 폰트가 비례한다(반올림 1 이내)', async ({ page }) => {
  await oneSelected(page);
  await pressN(page, '#stk-count-size-num', 'ArrowUp', STEPS / 2);
  await expect.poll(async () => (await readSizeFs(page)).size, '절반 뒤 크기').toBe(SIZE0 + STEPS / 2);
  const mid = await readSizeFs(page);
  expect(Math.abs(mid.fs - wantFs(mid.size)), `중간: 크기 ${mid.size} 에 폰트 ${mid.fs}(기대 ${wantFs(mid.size)})`).toBeLessThanOrEqual(FS_TOL);
  await pressN(page, '#stk-count-size-num', 'ArrowUp', STEPS / 2);
  await expect.poll(async () => (await readSizeFs(page)).size, '다 올린 뒤 크기').toBe(SIZE0 + STEPS);
  const up = await readSizeFs(page);
  expect(Math.abs(up.fs - wantFs(up.size)), `크기 ${up.size} 에 폰트 ${up.fs}(기대 ${wantFs(up.size)})`).toBeLessThanOrEqual(FS_TOL);
  expect([up.sizeH, up.w, up.drawnFs, up.fsNum], '높이·그려진 폭·그려진 폰트·폰트 칸이 같이 간다').toEqual([up.size, up.size, up.fs + 'px', String(up.fs)]);
  // 키로 올린 뒤 숫자를 쳐서 줄여도 비례가 남는다(고치기 전: 폰트 6)
  await typeNumber(page, '#stk-count-size-num', 30);
  await expect.poll(async () => (await readSizeFs(page)).size).toBe(30);
  const down = await readSizeFs(page);
  expect(Math.abs(down.fs - wantFs(30)), `크기 30 에 폰트 ${down.fs}(기대 ${wantFs(30)})`).toBeLessThanOrEqual(FS_TOL);
  // 폰트 크기 칸을 직접 고치면 그 값이 새 기준이 된다: 크기 30·폰트 20 → 크기 60 이면 폰트 40
  await typeNumber(page, '#stk-fs-num', 20);
  await expect.poll(async () => (await readSizeFs(page)).fs, '★전제: 폰트 칸이 먹었다').toBe(20);
  await typeNumber(page, '#stk-count-size-num', 60);
  await expect.poll(async () => (await readSizeFs(page)).size).toBe(60);
  expect((await readSizeFs(page)).fs, '폰트 칸으로 고친 비율(20/30)을 따른다').toBe(40);
});

test('C15 크기 키 단계(슬라이더) — ArrowRight 로 한 칸씩 · 중간에 패널을 다시 그려도 폰트가 비례한다', async ({ page }) => {
  await oneSelected(page);
  await pressN(page, '#stk-count-size', 'ArrowRight', 1);
  await expect.poll(async () => (await readSizeFs(page)).size, '1칸 뒤 크기').toBe(SIZE0 + 1);
  // 패널을 통째로 다시 그린다(다른 블럭을 골랐다 돌아온 것과 같은 길) — 소수 비율이 여기서 사라지면 끝이 38 이 된다(26/57×84)
  await page.evaluate(() => window.showStickerProperties(document.querySelector('#secA .sticker-block[data-count]')));
  await pressN(page, '#stk-count-size', 'ArrowRight', STEPS - 1);
  await expect.poll(async () => (await readSizeFs(page)).size, '다 올린 뒤 크기').toBe(SIZE0 + STEPS);
  const up = await readSizeFs(page);
  expect(up.fs, `크기 ${up.size} 에 폰트 ${up.fs} — 정확히 1.5배`).toBe(wantFs(SIZE0 + STEPS));
  expect([up.num, up.drawnFs]).toEqual([String(SIZE0 + STEPS), wantFs(SIZE0 + STEPS) + 'px']);
  await pressN(page, '#stk-count-size', 'ArrowLeft', STEPS);
  await expect.poll(async () => (await readSizeFs(page)).size, '도로 내린 크기').toBe(SIZE0);
  expect((await readSizeFs(page)).fs, '올렸다 내리면 폰트도 제자리').toBe(FS0);
});

test('C13b 짝 — 형광펜 A(면) 블럭을 고르면 Shape 단추가 5개(A 단추가 보인다), 일반 스티커는 4개', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('secA');
    const pick = (opts) => {
      const b = window.makeStickerBlock(opts);
      sec.appendChild(b); window.bindStickerSelect(b); window._selectSticker(b);
      return { shape: b.dataset.shape,
        btns: document.querySelectorAll('#stk-shape-group .prop-align-btn').length,
        aBtn: document.querySelectorAll('#stk-shape-group .prop-align-btn[data-shape="highlight"]').length,
        hlSec: !!document.getElementById('stk-hl-section') && getComputedStyle(document.getElementById('stk-hl-section')).display !== 'none' };
    };
    return { a: pick({ shape: 'highlight' }), circle: pick({ shape: 'circle' }) };
  });
  expect(r.a.shape, '★전제: A(면 형광펜) 블럭이 만들어졌다').toBe('highlight');
  expect(r.a.hlSec, '★전제: A 패널(Highlight Size)이 열렸다').toBe(true);
  expect(r, 'A 블럭이면 A 단추 포함 5, 일반 스티커면 4').toEqual({
    a: { shape: 'highlight', btns: 5, aBtn: 1, hlSec: true },
    circle: { shape: 'circle', btns: 4, aBtn: 0, hlSec: false },
  });
});

const modes = (page) => page.evaluate(() => ({ count: document.body.classList.contains('count-stk-mode'), state: window._countStkState().mode,
  pen: document.body.classList.contains('pen-mode'), hlb: document.body.classList.contains('hlb-mode'), vpen: document.body.classList.contains('vpen-mode') }));
const OTHERS = [
  { name: 'Annotation', key: 'pen', on: (page) => penMenu(page, 'Annotation'), off: () => window.exitPenMode() },
  // ★1012t1J1(S4) 뒤 — 메뉴의 「HighlightB」 항목은 없어졌다(메뉴 「Highlight」 = 누르면 선 하나가 바로 생기는 블럭).
  //   두 클릭 «모드»는 설정 이스터에그 입구만 남았고, 그 입구가 부르는 것이 window.toggleHighlightBMode() 다
  //   (js/settings/settings-modal.js 이스터에그 표 trigger). ⇒ 그 실제 함수로 켜고, 겹침 규칙은 그대로 잰다.
  { name: 'HighlightB', key: 'hlb', on: hlbModeOn, off: () => window.exitHighlightBMode() },
  { name: '벡터 펜', key: 'vpen', on: (page) => page.evaluate(() => window.toggleVectorPenMode()), off: () => window.exitVectorPenMode() },
];
async function hlbModeOn(page) {
  const pre = await page.evaluate(() => ({
    egg: window.isEasterEggEnabled ? window.isEasterEggEnabled('highlightBMode') : true,
    fn: typeof window.toggleHighlightBMode,
    menuItems: [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].filter(b => b.textContent.trim() === 'HighlightB').length,
  }));
  expect(pre, '★전제: 메뉴엔 HighlightB 가 없고(J1), 이스터에그 입구 함수가 있고 켜져 있다').toEqual({ egg: true, fn: 'function', menuItems: 0 });
  await page.evaluate(() => window.toggleHighlightBMode());
}
async function penMenu(page, label) {
  await page.click('#fp-pen-btn');
  await page.click(`#fp-pen-menu .fp-menu-item:text-is("${label}")`);
}

test('C16 도구 겹침 — Count 를 켠 채 Annotation·HighlightB·벡터 펜을 켜면 Count 가 꺼지고 클릭이 번호를 안 찍는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  for (const o of OTHERS) {
    await toolOn(page);
    expect(await modes(page), `★전제(${o.name}): Count 만 켜져 있다`).toEqual({ count: true, state: true, pen: false, hlb: false, vpen: false });
    await o.on(page);
    const want = { count: false, state: false, pen: false, hlb: false, vpen: false }; want[o.key] = true;
    expect(await modes(page), `${o.name} 을 켜면 Count 는 내려간다`).toEqual(want);
    if (o.key !== 'vpen') expect(await page.evaluate(() => document.getElementById('fp-pen-btn').classList.contains('active')), `${o.name}: 스티커 단추는 켜진 채`).toBe(true);
    const r = await waitStableRect(page, SEC_A);
    await clickAt(page, r.left + r.width * 0.5, r.top + r.height * 0.5, { sel: SEC_A }, { label: `${o.name} 켠 뒤 클릭` });
    expect((await modes(page))[o.key], `★전제(${o.name}): 클릭 뒤에도 그 도구가 켜져 있다`).toBe(true);
    expect(await countIn(page, 'secA'), `${o.name} 이 켜진 동안의 클릭은 카운트 스티커를 안 만든다`).toBe(0);
    await page.evaluate(o.off);
    expect(await modes(page), `★전제(${o.name}): 다 껐다`).toEqual({ count: false, state: false, pen: false, hlb: false, vpen: false });
  }
});

test('C17 도구 겹침(반대 순서) — 다른 찍는 도구가 켜진 채 Count 를 켜면 그쪽이 꺼지고 번호가 찍힌다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  let n = 0;
  for (const o of OTHERS) {
    await o.on(page);
    expect((await modes(page))[o.key], `★전제: ${o.name} 이 켜졌다`).toBe(true);
    await toolOn(page);
    const want = { count: true, state: true, pen: false, hlb: false, vpen: false };
    expect(await modes(page), `Count 를 켜면 ${o.name} 은 내려간다`).toEqual(want);
    await stamp(page, SEC_A, 0.2 + 0.2 * n, 0.5);
    n += 1;
    expect(await countIn(page, 'secA')).toBe(n);
    await page.evaluate(() => window.exitCountStickerMode());
  }
  expect(await texts(page, 'secA')).toEqual(['1', '2', '3']);
});

test('C18 리스너 — 켜고 끄기를 되풀이해도 키 리스너가 짝이 맞고, 다시 켠 뒤 한 번 클릭 = 스티커 정확히 1개', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const N = 5;
  const log = await page.evaluate((N) => {
    const log = { add: 0, rm: 0 };
    const add = document.addEventListener, rm = document.removeEventListener;
    const mine = (t, f) => t === 'keydown' && !!f && f.name === '_cntOnKeydown';
    document.addEventListener = function (t, f, o) { if (mine(t, f)) log.add += 1; return add.call(this, t, f, o); };
    document.removeEventListener = function (t, f, o) { if (mine(t, f)) log.rm += 1; return rm.call(this, t, f, o); };
    try { for (let i = 0; i < N; i++) { window.enterCountStickerMode(); window.exitCountStickerMode(); } }
    finally { document.addEventListener = add; document.removeEventListener = rm; }
    return log;
  }, N);
  expect(log, '켠 수만큼 달고, 끈 수만큼 뗀다').toEqual({ add: N, rm: N });
  expect((await modes(page)).state, '★전제: 지금은 꺼져 있다').toBe(false);
  await toolOn(page);
  await stamp(page, SEC_A, 0.5, 0.5);
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  expect(await countIn(page, 'secA'), '한 번 누르면 정확히 하나(리스너가 겹쳐 둘이 찍히지 않는다)').toBe(1);
  expect(await texts(page, 'secA')).toEqual(['1']);
});

test('C19 가장자리 — 섹션 모서리 바로 안쪽을 찍어도 스티커 전체가 섹션 안이다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  const INSET = 2;      // 모서리에서 안쪽으로 화면 2px
  const r = await waitStableRect(page, SEC_A);
  const pts = [
    { name: '왼쪽 위', x: r.left + INSET, y: r.top + INSET },
    { name: '오른쪽 아래', x: r.left + r.width - INSET, y: r.top + r.height - INSET },
  ];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    await clickAt(page, p.x, p.y, { sel: SEC_A }, { label: `모서리 ${p.name}` });
    await expect.poll(() => countIn(page, 'secA'), `${p.name}: 찍혔다`).toBe(i + 1);
    const g = await page.evaluate(([px, py, i]) => {
      const sec = document.getElementById('secA');
      const b = sec.querySelectorAll('.sticker-block[data-count]')[i];
      const box = sec.getBoundingClientRect();
      const scale = box.width / sec.offsetWidth;
      const lx = (px - box.left) / scale, ly = (py - box.top) / scale;      // 누른 점(레이아웃 px)
      const x = parseInt(b.dataset.x, 10), y = parseInt(b.dataset.y, 10), w = parseInt(b.dataset.sizeW, 10), h = parseInt(b.dataset.sizeH, 10);
      return { x, y, w, h, secW: sec.offsetWidth, secH: sec.offsetHeight, offW: b.offsetWidth, offL: b.offsetLeft, offT: b.offsetTop,
        edgeX: Math.min(lx, sec.offsetWidth - lx), edgeY: Math.min(ly, sec.offsetHeight - ly) };
    }, [p.x, p.y, i]);
    expect(g.edgeX < g.w / 2 && g.edgeY < g.h / 2, `★전제(${p.name}): 누른 점이 모서리에서 반지름보다 가깝다 — 안 가두면 삐져나간다(가로 ${g.edgeX} · 세로 ${g.edgeY} · 반지름 ${g.w / 2})`).toBe(true);
    expect([g.x >= 0, g.y >= 0, g.x + g.w <= g.secW, g.y + g.h <= g.secH], `${p.name}: x=${g.x} y=${g.y} 크기=${g.w} 섹션=${g.secW}×${g.secH}`).toEqual([true, true, true, true]);
    expect([g.offL, g.offT, g.offW], `${p.name}: 그려진 자리 = dataset`).toEqual([g.x, g.y, g.w]);
  }
});

test('C20 종료 갈래 — 메뉴를 다시 누르면 꺼진다 · 우클릭은 안 찍고 끈다 · ⌘⇧Z 는 되돌린 번호를 다시 살린다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  // 메뉴 재클릭
  await penMenu(page, 'Marking');
  await page.waitForFunction(() => window._countStkState().mode === true && window._countStkState().armed === true);
  await stamp(page, SEC_A, 0.2, 0.5);
  await penMenu(page, 'Marking');
  expect(await page.evaluate(() => ({ ...window._countStkState(), body: document.body.classList.contains('count-stk-mode'),
    btn: document.getElementById('fp-pen-btn').classList.contains('active') })), '메뉴를 다시 누르면 꺼진다').toEqual({ mode: false, armed: false, body: false, btn: false });
  expect(await countIn(page, 'secA'), '메뉴를 누른 것이 번호를 찍지 않는다').toBe(1);
  const r = await waitStableRect(page, SEC_A);
  await clickAt(page, r.left + r.width * 0.4, r.top + r.height * 0.5, { sel: SEC_A }, { label: '메뉴로 끈 뒤 클릭' });
  expect(await countIn(page, 'secA'), '꺼진 뒤 클릭은 안 찍는다').toBe(1);

  // 우클릭
  await toolOn(page);
  await clickAt(page, r.left + r.width * 0.6, r.top + r.height * 0.5, { sel: SEC_A }, { label: '우클릭', button: 'right' });
  await page.waitForFunction(() => window._countStkState().mode === false);
  expect([await countIn(page, 'secA'), await page.evaluate(() => document.body.classList.contains('count-stk-mode'))], '우클릭은 안 찍고 끈다').toEqual([1, false]);

  // ⌘Z → ⌘⇧Z
  await toolOn(page);
  await stamp(page, SEC_A, 0.5, 0.5);
  await stamp(page, SEC_A, 0.8, 0.5);
  expect(await texts(page, 'secA'), '★전제').toEqual(['1', '2', '3']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => texts(page, 'secA'), '★전제: ⌘Z 한 번에 하나가 준다').toEqual(['1', '2']);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => texts(page, 'secA'), '⌘⇧Z 가 되돌린 것을 다시 살린다').toEqual(['1', '2', '3']);
  expect(await page.evaluate(() => [...document.querySelectorAll('#secA [data-count]')].map(b => b.dataset.count))).toEqual(['1', '2', '3']);
  // 살아난 뒤의 다음 번호는 4 다
  expect((await modes(page)).state, '★전제: 되돌리기·다시하기 뒤에도 도구는 켜진 채다').toBe(true);
  await stamp(page, SEC_A, 0.5, 0.2);
  expect(await texts(page, 'secA')).toEqual(['1', '2', '3', '4']);
});

test('C21 시작 번호 칸 — 2.7 을 넣고 확정하면 칸이 모델 값(2)으로 되써진다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp3(page);
  await typeNumber(page, '#stk-count-start', '2.7');
  await expect.poll(() => texts(page, 'secA')).toEqual(['2', '3', '4']);
  const r = await page.evaluate(() => ({ field: document.getElementById('stk-count-start').value,
    model: [...document.querySelectorAll('#secA [data-count]')].map(b => b.dataset.countStart) }));
  expect(r.model, '★전제: 모델은 2').toEqual(['2', '2', '2']);
  expect(r.field, '칸에 2.7 이 남지 않는다').toBe('2');
});

/* ── 1013t2 B 묶음(마킹 블럭) ─────────────────────────────────────────────────────────────────────── */

/* 그 블럭의 레이어 행(.layer-item) — 행이 드는 _dragTarget 으로 «그 블럭의 행»을 집는다(이름으로 찾지 않는다). */
const layerRowOf = (page, sel) => page.evaluate((sel) => {
  window.buildLayerPanel?.();
  const b = document.querySelector(sel);
  const rows = [...document.querySelectorAll('.layer-item')].filter((it) => it._dragTarget === b);
  return rows.map((it) => ({ name: it.querySelector('.layer-item-name')?.textContent, type: it.querySelector('.layer-item-type')?.textContent, layerType: it.dataset.layerType }));
}, sel);

test('C22 이름 — 패널 절 제목·패널 머리·레이어 행이 Marking 이다 · 일반 스티커의 머리는 Sticker 그대로 · 저장 키는 count 그대로', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.4, 0.5);
  await page.evaluate(() => window.exitCountStickerMode());
  const m = await page.evaluate(() => {
    const b = document.querySelector('#secA .sticker-block[data-count]');
    return { n: document.querySelectorAll('#secA .sticker-block[data-count]').length, selected: b.classList.contains('selected'),
      title: document.querySelector('#stk-count-section .prop-section-title')?.textContent.trim(),
      head: document.querySelector('#panel-right .prop-block-name')?.textContent.trim(),
      keys: ['count', 'countStart', 'countStyle', 'countShape'].map((k) => k in b.dataset), type: b.dataset.type, cls: b.className.split(' ')[0] };
  });
  expect([m.n, m.selected], '★전제: 마킹 1개가 찍혔고 골라져 있다').toEqual([1, true]);
  expect(m.title, '패널 절 제목').toBe('Marking');
  expect(m.head, '패널 머리').toBe('Marking');
  expect([m.keys, m.type, m.cls], '저장 키·종류·클래스는 그대로다').toEqual([[true, true, true, true], 'sticker', 'sticker-block']);
  const rows = await layerRowOf(page, '#secA .sticker-block[data-count]');
  expect(rows.length, '★전제: 그 블럭의 레이어 행이 정확히 하나 있다').toBe(1);
  expect(rows[0], '레이어 행의 이름·종류').toEqual({ name: 'Marking', type: 'Sticker', layerType: 'marking' });

  /* 짝: 일반 스티커의 머리는 Sticker 그대로 */
  const plain = await page.evaluate(() => {
    const sec = document.getElementById('secA');
    const b = window.makeStickerBlock({ shape: 'circle', x: 20, y: 20 });
    b.id = 'stkPlainName';
    sec.appendChild(b); window.bindStickerSelect(b); window._selectSticker(b);
    return { hasCount: 'count' in b.dataset, selected: b.classList.contains('selected'),
      head: document.querySelector('#panel-right .prop-block-name')?.textContent.trim(), countSec: !!document.getElementById('stk-count-section') };
  });
  expect(plain, '일반 스티커: 머리는 Sticker · Marking 절 없음').toEqual({ hasCount: false, selected: true, head: 'Sticker', countSec: false });
  const plainRows = await layerRowOf(page, '[id="stkPlainName"]');
  expect(plainRows.length, '★전제: 일반 스티커의 레이어 행이 하나 있다').toBe(1);
  expect(plainRows[0].layerType, '일반 스티커의 레이어 행은 마킹으로 안 바뀐다(이번 범위 밖 · 표시 무변)').not.toBe('marking');
  expect(errs).toEqual([]);
});

const escState = (page) => page.evaluate(() => ({ mode: window._countStkState().mode, body: document.body.classList.contains('count-stk-mode'),
  btn: document.getElementById('fp-pen-btn').classList.contains('active') }));

test('C23 Esc — 패널 칸에 포커스가 있어도 한 번에 꺼진다(슬라이더 · 숫자칸 · 색 hex 칸)', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  /* ⛔여기서는 blur() 로 피해 가지 않는다(C9 는 다른 길) — 칸에 포커스가 있는 «채» Esc 를 누른다. */
  const FIELDS = ['stk-count-size', 'stk-count-start', 'stk-bg-hex'];
  for (const id of FIELDS) {
    await page.evaluate(() => { document.querySelectorAll('#secA .sticker-block').forEach((b) => b.remove()); });
    await toolOn(page);
    await stamp(page, SEC_A, 0.3, 0.5);
    await page.click('#' + id);
    const pre = await page.evaluate((id) => ({ active: document.activeElement?.id, inPanel: !!document.activeElement?.closest('#panel-right'), mode: window._countStkState().mode }), id);
    expect(pre, `★전제(${id}): 그 칸에 포커스가 있고 도구는 켜져 있다`).toEqual({ active: id, inPanel: true, mode: true });
    await page.keyboard.press('Escape');
    expect(await escState(page), `${id}: Esc 한 번에 도구가 꺼진다`).toEqual({ mode: false, body: false, btn: false });
    expect(await page.evaluate(() => document.activeElement === document.body || !document.activeElement?.closest('#panel-right')), `${id}: 포커스가 칸에서 빠졌다`).toBe(true);
    const r = await waitStableRect(page, SEC_A);
    await clickAt(page, r.left + r.width * 0.7, r.top + r.height * 0.5, { sel: SEC_A }, { label: `${id}: 꺼진 뒤 클릭` });
    expect(await countIn(page, 'secA'), `${id}: 꺼진 뒤 클릭은 개수를 안 바꾼다`).toBe(1);
  }
  expect(errs).toEqual([]);
});

test('C23b Esc(숫자칸) — 치던 값은 모델에 안 남고(되돌림) 도구는 같은 Esc 에 꺼진다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);
  await page.click('#stk-count-size-num');
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('200');
  const typed = await page.evaluate(() => ({ active: document.activeElement?.id, field: document.getElementById('stk-count-size-num').value }));
  expect(typed, '★전제: 숫자칸에 200 을 쳤고 포커스가 그 칸에 있다').toEqual({ active: 'stk-count-size-num', field: '200' });
  await page.keyboard.press('Escape');
  expect((await escState(page)).mode, 'Esc 한 번에 도구가 꺼진다').toBe(false);
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  const after = await page.evaluate(() => { const b = document.querySelector('#secA .sticker-block[data-count]'); return [b.dataset.sizeW, b.offsetWidth]; });
  expect(after, '치던 값(200)이 확정되지 않았다 — 크기는 기본 그대로').toEqual([String(SIZE0), SIZE0]);
});

test('C24 Esc 충돌 없음 — 패널 밖 입력 칸·인라인 편집의 Esc 는 도구를 안 끈다 · 색 팝오버는 팝오버만 닫는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);

  /* ① 우측 패널 «밖»의 입력 칸(모달·이름 바꾸기와 같은 처지) */
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'c24-outside'; i.type = 'text'; document.body.appendChild(i); i.focus(); });
  expect(await page.evaluate(() => [document.activeElement?.id, !!document.activeElement?.closest('#panel-right')]), '★전제①: 패널 밖 칸에 포커스').toEqual(['c24-outside', false]);
  await page.keyboard.press('Escape');
  expect((await escState(page)).mode, '① 패널 밖 칸의 Esc 는 도구를 안 끈다').toBe(true);
  await page.evaluate(() => document.getElementById('c24-outside').remove());

  /* ② 인라인 편집(contenteditable) */
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'c24-edit'; d.setAttribute('contenteditable', 'true'); d.textContent = 'x'; document.body.appendChild(d); d.focus(); });
  expect(await page.evaluate(() => document.activeElement?.id), '★전제②: 편집 요소에 포커스').toBe('c24-edit');
  await page.keyboard.press('Escape');
  expect((await escState(page)).mode, '② 인라인 편집 중의 Esc 는 도구를 안 끈다').toBe(true);
  await page.evaluate(() => document.getElementById('c24-edit').remove());

  /* ③ 색 팝오버 — 첫 Esc 는 팝오버만, 둘째 Esc 가 도구 */
  const popOpen = () => page.evaluate(() => { const p = document.querySelector('.goya-cp-popover'); return !!p && !p.hidden; });
  await page.click('#stk-colors-section .prop-color-swatch');
  await expect.poll(popOpen, '★전제③: 색 팝오버가 열렸다').toBe(true);
  expect((await escState(page)).mode, '★전제③: 도구는 켜진 채다').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(popOpen, '③ 첫 Esc: 팝오버가 닫힌다').toBe(false);
  expect((await escState(page)).mode, '③ 첫 Esc: 도구는 그대로 켜져 있다').toBe(true);
  await page.keyboard.press('Escape');
  expect(await escState(page), '③ 둘째 Esc: 도구가 꺼진다').toEqual({ mode: false, body: false, btn: false });
});

test('C25 Esc 뒤 — 방금 찍은 것은 골라진 채, 두 번째 Esc 가 선택을 푼다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.3, 0.5);
  await page.click('#stk-count-size');
  expect(await page.evaluate(() => document.activeElement?.id), '★전제: 슬라이더에 포커스').toBe('stk-count-size');
  const sel = () => page.evaluate(() => document.querySelectorAll('#secA .sticker-block.selected').length);
  expect(await sel(), '★전제: 방금 찍은 것이 골라져 있다').toBe(1);
  await page.keyboard.press('Escape');
  expect([(await escState(page)).mode, await sel()], '첫 Esc: 도구만 꺼지고 선택은 남는다').toEqual([false, 1]);
  await page.keyboard.press('Escape');
  await expect.poll(sel, '둘째 Esc: 선택이 풀린다').toBe(0);
  expect(await countIn(page, 'secA'), '스티커는 그대로 있다').toBe(1);
});

const RED = 'rgb(231, 76, 60)';      // #e74c3c — 일반 스티커 기본(js/blocks/sticker-block.js STICKER_DEFAULTS)
const BLACK = 'rgb(0, 0, 0)', WHITE = 'rgb(255, 255, 255)';

test('C26 기본색 — 빈 섹션 첫 찍기는 검정 배경·흰 글자(그려진 색) · 일반 Sticker 는 빨강 그대로', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_A, 0.4, 0.5);
  const m = await page.evaluate(() => {
    const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')];
    const c = getComputedStyle(all[0]);
    return { n: all.length, bg: c.backgroundColor, color: c.color, dBg: all[0].dataset.bgColor, dTxt: all[0].dataset.textColor };
  });
  expect(m.n, '★전제: 마킹이 하나 찍혔다').toBe(1);
  expect([m.bg, m.color], '그려진 색 = 검정 배경 · 흰 글자').toEqual([BLACK, WHITE]);
  expect([m.dBg, m.dTxt], '색이 dataset 에 실린다(저장본에 그대로 간다)').toEqual(['#000000', '#ffffff']);
  /* 일반 스티커는 빨강 그대로 */
  const plain = await page.evaluate(() => {
    window.exitCountStickerMode();
    const sec = document.getElementById('secB');
    const b = window.makeStickerBlock({ shape: 'circle' });
    sec.appendChild(b);
    return { hasCount: 'count' in b.dataset, dBg: b.dataset.bgColor, bg: getComputedStyle(b).backgroundColor };
  });
  expect(plain, '일반 스티커의 기본색은 안 바뀐다').toEqual({ hasCount: false, dBg: '#e74c3c', bg: RED });
});

test('C27 옛 저장본 — 색을 든 옛 마킹은 다시 그려도 그 색 · 색 키가 없는 옛 것도 빨강 · 그 섹션의 다음 찍기는 옛 색을 물려받는다', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    const old = (id, x, extra) => `<div class="sticker-block" id="${id}" data-type="sticker" data-shape="circle" data-size="56" data-size-w="56" data-size-h="56"`
      + ` data-text="1" data-font-size="26" data-font-weight="700" data-x="${x}" data-y="40" data-count="1" data-count-start="1" data-count-style="num" data-count-shape="circle"${extra}></div>`;
    document.getElementById('canvas').innerHTML =
        '<div class="section-block" id="secA" style="position:relative;height:320px;background:#f4f4f6"><div class="section-inner"></div>'
        + old('oldRed', 40, ' data-bg-color="#e74c3c" data-text-color="#ffffff"') + '</div>'
      + '<div class="section-block" id="secB" style="position:relative;height:320px;background:#e9eef4"><div class="section-inner"></div>'
        + old('oldBare', 40, '') + '</div>';
    window.rebindAll?.();
  });
  const read = () => page.evaluate(() => ['oldRed', 'oldBare'].map((id) => { const b = document.getElementById(id);
    return { drawn: !!b.querySelector('.sticker-text'), bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color, dBg: b.dataset.bgColor ?? null }; }));
  const r = await read();
  expect(r.map((x) => x.drawn), '★전제: 옛 마킹 둘이 다시 그려졌다').toEqual([true, true]);
  expect(r[0], '색을 든 옛 것: 그 색 그대로').toEqual({ drawn: true, bg: RED, color: WHITE, dBg: '#e74c3c' });
  expect(r[1], '색 키가 없는 옛 것: 빨강(폴백 무변) · 키를 지어 넣지 않는다').toEqual({ drawn: true, bg: RED, color: WHITE, dBg: null });
  /* 옛 빨강 섹션의 다음 찍기는 빨강을 물려받는다(그 섹션 묶음과 한 벌) */
  await toolOn(page);
  await stamp(page, SEC_A, 0.6, 0.5);
  const next = await page.evaluate(() => { const all = [...document.querySelectorAll('#secA .sticker-block[data-count]')]; const b = all[all.length - 1];
    return { n: all.length, count: b.dataset.count, dBg: b.dataset.bgColor, bg: getComputedStyle(b).backgroundColor }; });
  expect(next, '옛 빨강 섹션에 찍으면 빨강 · 번호는 2').toEqual({ n: 2, count: '2', dBg: '#e74c3c', bg: RED });
});

/* 그 섹션의 마킹 전부 — dataset 과 «그려진» 값을 같이 읽는다(둘이 따로 놀면 한쪽만 맞아도 초록이 되므로). */
const groupLook = (page, secId) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .sticker-block[data-count]`)].map((b) => {
  const c = getComputedStyle(b), d = b.dataset;
  return { countShape: d.countShape, sizeW: d.sizeW, fontSize: d.fontSize, fontWeight: d.fontWeight, bgColor: d.bgColor, textColor: d.textColor,
    radius: c.borderRadius, w: b.offsetWidth, drawnFs: c.fontSize, drawnFw: c.fontWeight, bg: c.backgroundColor, color: c.color };
}), secId);
const pluck = (rows, k) => rows.map((r) => r[k]);

/* secB 1개 + secA 3개(마지막에 찍은 secA 셋째가 골라져 있다). */
async function groupSetup(page) {
  const errs = await bootApp(page);
  await setup(page);
  await toolOn(page);
  await stamp(page, SEC_B, 0.4, 0.5);
  await stamp3(page, SEC_A);
  await page.evaluate(() => window.exitCountStickerMode());
  const pre = await page.evaluate(() => ({ a: document.querySelectorAll('#secA .sticker-block[data-count]').length, b: document.querySelectorAll('#secB .sticker-block[data-count]').length,
    sel: [...document.querySelectorAll('#secA .sticker-block[data-count]')].map((x) => x.classList.contains('selected')), sw: document.getElementById('stk-count-group')?.checked }));
  expect(pre, '★전제: secA 3 · secB 1 · secA 셋째가 골라졌고 스위치는 켜져 있다(기본)').toEqual({ a: 3, b: 1, sel: [false, false, true], sw: true });
  return errs;
}

async function typeHex(page, sel, hex) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(hex);
  await page.keyboard.press('Enter');
}

test('C28 일괄(켬 · 기본) — 모양 · 크기 · 폰트 크기 · 굵기 · 배경색 · 글자색이 같은 섹션 3개에 다 가고 다른 섹션은 그대로', async ({ page }) => {
  const errs = await groupSetup(page);
  const b0 = (await groupLook(page, 'secB'))[0];
  const a0 = await groupLook(page, 'secA');
  expect(pluck(a0, 'radius'), '★전제: 셋 다 원').toEqual(['50%', '50%', '50%']);

  await page.click('#stk-count-shape [data-count-shape="square"]');
  let a = await groupLook(page, 'secA');
  expect([pluck(a, 'countShape'), pluck(a, 'radius')], '모양: 셋 다 사각').toEqual([['square', 'square', 'square'], ['8px', '8px', '8px']]);

  await typeNumber(page, '#stk-count-size-num', 84);
  await expect.poll(async () => pluck(await groupLook(page, 'secA'), 'sizeW'), '크기: 셋 다 84').toEqual(['84', '84', '84']);
  a = await groupLook(page, 'secA');
  expect([pluck(a, 'w'), pluck(a, 'fontSize'), pluck(a, 'drawnFs')], '크기: 그려진 폭 · 폰트(비례 26→39) 도 셋 다').toEqual([[84, 84, 84], ['39', '39', '39'], ['39px', '39px', '39px']]);

  await typeNumber(page, '#stk-fs-num', 30);
  await expect.poll(async () => pluck(await groupLook(page, 'secA'), 'fontSize'), '폰트 크기: 셋 다 30').toEqual(['30', '30', '30']);
  expect(pluck(await groupLook(page, 'secA'), 'drawnFs'), '폰트 크기: 그려진 값').toEqual(['30px', '30px', '30px']);

  await page.selectOption('#stk-fw', '900');
  a = await groupLook(page, 'secA');
  expect([pluck(a, 'fontWeight'), pluck(a, 'drawnFw')], '굵기: 셋 다 900').toEqual([['900', '900', '900'], ['900', '900', '900']]);

  await typeHex(page, '#stk-bg-hex', 'F26B1F');
  await expect.poll(async () => pluck(await groupLook(page, 'secA'), 'bg'), '배경색: 셋 다').toEqual(Array(3).fill('rgb(242, 107, 31)'));
  await typeHex(page, '#stk-txt-hex', '00FF00');
  await expect.poll(async () => pluck(await groupLook(page, 'secA'), 'color'), '글자색: 셋 다').toEqual(Array(3).fill('rgb(0, 255, 0)'));
  a = await groupLook(page, 'secA');
  expect([new Set(pluck(a, 'bgColor')).size, new Set(pluck(a, 'textColor')).size], '색 dataset 도 셋이 같다').toEqual([1, 1]);

  expect((await groupLook(page, 'secB'))[0], '다른 섹션의 마킹은 처음 그대로').toEqual(b0);
  expect(await texts(page, 'secA'), '번호는 블럭마다의 것 — 안 섞인다').toEqual(['1', '2', '3']);
  expect(errs).toEqual([]);
});

test('C29 일괄 undo — 묶음 변경 한 번 = ⌘Z 한 번에 3개가 다 돌아오고 스티커 수는 그대로', async ({ page }) => {
  await groupSetup(page);
  const reselect = () => page.evaluate(() => { const all = document.querySelectorAll('#secA .sticker-block[data-count]'); window._selectSticker(all[all.length - 1]); return !!document.getElementById('stk-count-section'); });
  const CASES = [
    { name: '모양', key: 'countShape', act: () => page.click('#stk-count-shape [data-count-shape="square"]'), want: 'square' },
    { name: '크기', key: 'sizeW', act: () => typeNumber(page, '#stk-count-size-num', 84), want: '84' },
    { name: '배경색', key: 'bgColor', act: () => typeHex(page, '#stk-bg-hex', 'F26B1F'), want: '#f26b1f' },
  ];
  for (const c of CASES) {
    expect(await reselect(), `★전제(${c.name}): 셋째를 골랐고 패널이 떴다`).toBe(true);
    const before = pluck(await groupLook(page, 'secA'), c.key);
    const h = await expectOneUndoStep(page, async () => {
      await c.act();
      await expect.poll(async () => pluck(await groupLook(page, 'secA'), c.key).map((v) => String(v).toLowerCase()), `★전제(${c.name}): 셋 다 바뀌었다`).toEqual([c.want, c.want, c.want]);
    }, `마킹 일괄 ${c.name}`, { soft: true });
    expect(before.every((v) => String(v).toLowerCase() !== c.want), `★전제(${c.name}): 바꾸기 전 값이 달랐다`).toBe(true);
    expect(h.dPos >= 1 && h.seqNew, `${c.name}: 바꾼 직후 꼭대기가 새 칸 — Δpos=${h.dPos}`).toBe(true);
    expect([h.undoDLen, h.undoDPos], `${c.name}: ⌘Z 가 구제 칸 없이 정확히 한 칸`).toEqual([0, -1]);
    await expect.poll(async () => pluck(await groupLook(page, 'secA'), c.key), `${c.name}: ⌘Z 한 번에 셋 다 돌아온다`).toEqual(before);
    expect([await countIn(page, 'secA'), await countIn(page, 'secB')], `${c.name}: 스티커 수는 그대로`).toEqual([3, 1]);
  }
});

test('C30 개별(끔) — 스위치를 끄면 고른 것만 바뀐다 · 패널을 다시 그려도 스위치가 꺼진 채다', async ({ page }) => {
  await groupSetup(page);
  await groupSwitch(page, false);
  await page.click('#stk-count-shape [data-count-shape="square"]');      // 이 클릭이 패널을 통째로 다시 그린다
  expect(await page.evaluate(() => document.getElementById('stk-count-group').checked), '패널을 다시 그려도 꺼진 채다').toBe(false);
  let a = await groupLook(page, 'secA');
  expect(pluck(a, 'countShape'), '모양: 고른 것(셋째)만').toEqual(['circle', 'circle', 'square']);
  await typeNumber(page, '#stk-count-size-num', 84);
  await expect.poll(async () => pluck(await groupLook(page, 'secA'), 'sizeW'), '크기: 고른 것만').toEqual(['56', '56', '84']);
  await typeHex(page, '#stk-bg-hex', 'F26B1F');
  await expect.poll(async () => pluck(await groupLook(page, 'secA'), 'bg'), '배경색: 고른 것만').toEqual(['rgb(0, 0, 0)', 'rgb(0, 0, 0)', 'rgb(242, 107, 31)']);
  /* 표기는 스위치와 무관하게 항상 묶음이다 */
  await page.click('#stk-count-style [data-count-style="alpha"]');
  expect(await texts(page, 'secA'), '표기는 스위치가 꺼져 있어도 섹션 전부').toEqual(['A', 'B', 'C']);
  /* 다시 켜면 다음 변경부터 전부 */
  await groupSwitch(page, true);
  await page.click('#stk-count-shape [data-count-shape="circle"]');
  expect(pluck(await groupLook(page, 'secA'), 'countShape'), '다시 켠 뒤: 셋 다').toEqual(['circle', 'circle', 'circle']);
});

test('C31 일괄과 코너 드래그 — 손잡이로 키운 것은 그것만 변한다(스위치가 켜져 있어도)', async ({ page }) => {
  await groupSetup(page);
  const H = '#secA .sticker-block.selected .sticker-corner-handle[data-corner="br"]';
  const r = await waitStableRect(page, H);
  const onHandle = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y);
    return !!e && e.classList.contains('sticker-corner-handle') && e.dataset.corner === 'br'; }, [r.cx, r.cy]);
  expect(onHandle, '★전제: 누를 점의 맨 위 요소가 오른쪽 아래 손잡이다').toBe(true);
  const before = pluck(await groupLook(page, 'secA'), 'sizeW');
  await page.mouse.move(r.cx, r.cy);
  await page.mouse.down();
  await page.mouse.move(r.cx + 12, r.cy + 12, { steps: 4 });
  await page.mouse.move(r.cx + 24, r.cy + 24, { steps: 4 });
  await page.mouse.up();
  const after = pluck(await groupLook(page, 'secA'), 'sizeW');
  expect(before, '★전제: 끌기 전엔 셋이 같다').toEqual([String(SIZE0), String(SIZE0), String(SIZE0)]);
  expect(Number(after[2]) > Number(before[2]), `잡은 것(셋째)은 커졌다 — ${before[2]} → ${after[2]}`).toBe(true);
  expect(after.slice(0, 2), '안 잡은 둘은 그대로').toEqual(before.slice(0, 2));
  expect(await page.evaluate(() => document.getElementById('stk-count-group')?.checked), '★전제: 스위치는 켜진 채였다').toBe(true);
});
