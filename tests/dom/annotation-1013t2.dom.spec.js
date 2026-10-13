/* annotation-1013t2 — 스티커패널 어노테이션 블럭 (1013t2C6 라벨 줄바꿈).
 *
 * ★무엇을 잠그나
 *   AL1 라벨 편집 중 Enter = 줄바꿈(편집이 이어진다) · ⌘Enter 마침 → dataset 'A\nB' · white-space pre · 2줄
 *   AL2 마침 경로 — Esc · 섹션 빈 곳 클릭(blur) 둘 다 \n 을 지키고, <br> 잔재는 \n 으로 읽은 뒤 DOM 에서 걷는다
 *   AL3 저장 왕복(직렬화 → rebindAll) 뒤에도 'A\nB' · 2줄 · 라벨 style 이 라이브와 같다
 *   AL4 편집 한 번 = ⌘Z 한 걸음('어노테이션 글')
 *   AL5 한글 조합 중 Enter(isComposing · keyCode 229)는 줄바꿈을 넣지 않고 편집이 이어진다
 *   AL6 펜으로 만든 직후 편집도 같은 규약(만들기 → X · Enter · Y · Esc → 'X\nY' · 펜 종료)
 *   AL7 라벨 글은 «글자»다 — `<b>x</b>` 를 치고 다시 그려도 b 요소 0
 *   AR0 (1013t2C7-pre) 끌기(전체 이동 · 점 손잡이) 뒤에도 삼각형이 선 방향을 가리킨다 · 다시 그린 것과 같다
 * ★만드는 길은 «사람 손» 그대로 — 펜 단추 → 메뉴 「Annotation」 → 섹션 두 점 → Enter → Esc (annotation-1013 과 같은 꼴).
 * ⛔waitForTimeout 0 — 모든 대기는 «재는 값» 자체를 expect.poll 로 기다린다.
 * ⛔줄 수는 rect 가 아니라 offsetHeight ÷ line-height 로 잰다(배율에 안 곱해지는 값 · modal-enter-newline 꼴).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC = '[id="secA"]';

/* 빈 섹션 하나(annotation-1013 setup 과 같다). */
async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.applyPagePadX?.(window.state?.pageSettings?.padX);
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);
const penOn = (page) => page.evaluate(() => document.body.classList.contains('pen-mode'));

/* 펜 단추 → 「Annotation」 → 두 점 → Enter(라벨 편집 진입). 펜은 켜 둔 채 돌려준다. */
async function drawAnnotation(page, { p1 = [0.2, 0.3], p2 = [0.45, 0.6] } = {}) {
  const before = await annotCount(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => penOn(page), '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * p1[0], r.top + r.height * p1[1], { sel: SEC }, { label: '첫 점' });
  await clickAt(page, r.left + r.width * p2[0], r.top + r.height * p2[1], { sel: SEC }, { label: '둘째 점' });
  await page.keyboard.press('Enter');
  await expect.poll(() => annotCount(page), 'Enter 로 어노테이션 하나가 생겼다').toBe(before + 1);
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
  return page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
}
/* 만들고 Esc 로 펜을 끈다(글은 기본 '텍스트'). */
async function makeAnnotation(page, opts) {
  const id = await drawAnnotation(page, opts);
  await page.keyboard.press('Escape');
  await expect.poll(() => penOn(page), 'Esc 로 펜 모드 종료').toBe(false);
  return id;
}

const labelSel = (id) => `[id="${id}"] .annot-label`;

/* 캔버스에서 라벨을 눌러 고른다(진짜 마우스). */
async function selectByLabel(page, id) {
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected')
    && !!document.querySelector('#panel-right [data-prop-panel="annotation"]'), id), '★전제: 골랐고 어노테이션 패널이 떴다').toBe(true);
  return lr;
}

const editing = (page, id) => page.evaluate((id) => {
  const l = document.querySelector(`[id="${id}"] .annot-label`);
  return l.getAttribute('contenteditable') === 'true' && document.activeElement === l;
}, id);

/* 고른 라벨을 더블클릭해 편집에 들어간다(글 전체가 골라진 채). */
async function dblEdit(page, id) {
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 더블클릭', dbl: true });
  await expect.poll(() => editing(page, id), '더블클릭으로 라벨 편집에 들어갔다').toBe(true);
}

/* 라벨 상태 — 데이터 · 그려진 글 · 줄 수(offsetHeight ÷ line-height · 배율 무관) · white-space · <br> 수. */
const labelState = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const l = b.querySelector('.annot-label'); const cs = getComputedStyle(l);
  const inner = l.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
  return { data: b.dataset.text, text: l.textContent, ws: cs.whiteSpace, lines: Math.round(inner / parseFloat(cs.lineHeight)),
    els: l.childElementCount, ce: l.getAttribute('contenteditable'), css: l.style.cssText };
}, id);

const reloadCanvas = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  c.innerHTML = window.getSerializedCanvas();
  window.rebindAll();
});

/* 'A' Enter 'B' 를 치고(편집 중) 돌려준다. */
async function typeAB(page, id) {
  await page.keyboard.type('A');
  await page.keyboard.press('Enter');
  await expect.poll(() => editing(page, id), 'Enter 뒤에도 편집 중 · 초점 그대로(Enter = 줄바꿈)').toBe(true);
  await page.keyboard.type('B');
}

test('AL1 Enter = 줄바꿈 — 편집이 이어지고 ⌘Enter 로 마치면 dataset A\\nB · pre · 2줄', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const s0 = await labelState(page, id);
  expect([s0.data, s0.lines], '★전제: 기본 글 한 줄').toEqual(['텍스트', 1]);
  await dblEdit(page, id);
  await typeAB(page, id);
  await page.keyboard.press('Meta+Enter');
  await expect.poll(async () => (await labelState(page, id)).ce, '⌘Enter 로 마쳤다').toBe('false');
  const s = await labelState(page, id);
  expect({ data: s.data, text: s.text, ws: s.ws, lines: s.lines, els: s.els }, '줄바꿈이 데이터·화면에 남았다')
    .toEqual({ data: 'A\nB', text: 'A\nB', ws: 'pre', lines: 2, els: 0 });
  expect(errs).toEqual([]);
});

test('AL2 마침 경로 — Esc · 섹션 빈 곳 클릭 둘 다 \\n 을 지키고 <br> 잔재는 \\n 으로 읽어 걷는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  // ① Esc
  await dblEdit(page, id);
  await typeAB(page, id);
  await page.keyboard.press('Escape');
  await expect.poll(async () => { const s = await labelState(page, id); return [s.ce, s.data, s.lines]; }, 'Esc 로 마치고 \\n 이 남는다').toEqual(['false', 'A\nB', 2]);
  // ② 섹션 빈 곳 클릭 — 편집 중 <br> 잔재(서식 붙여넣기·끌어놓기가 남기는 꼴)를 일부러 넣는다
  await dblEdit(page, id);
  await page.keyboard.type('C');
  const br = await page.evaluate(() => { document.execCommand('insertHTML', false, 'X<br>Y'); return document.activeElement.querySelectorAll('br').length; });
  expect(br, '★전제: 편집 중 라벨에 <br> 이 들어갔다').toBeGreaterThan(0);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.9, r.top + r.height * 0.1, { sel: SEC, not: '.annot-label, .annot-handle' }, { label: '섹션 빈 곳' });
  await expect.poll(async () => (await labelState(page, id)).ce, '바깥 클릭(blur)으로 마쳤다').toBe('false');
  const s = await labelState(page, id);
  expect({ data: s.data, text: s.text, els: s.els, lines: s.lines }, '<br> 은 \\n 으로 읽히고 DOM 에선 걷혔다(textContent 로 다시 씀)')
    .toEqual({ data: 'CX\nY', text: 'CX\nY', els: 0, lines: 2 });
});

test('AL3 저장 왕복 — 다시 불러와도 A\\nB · 2줄 · 라벨 style 이 라이브와 같다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await dblEdit(page, id);
  await typeAB(page, id);
  await page.keyboard.press('Meta+Enter');
  await expect.poll(async () => (await labelState(page, id)).data, '★전제: 줄바꿈 글이 들어갔다').toBe('A\nB');
  const live = await labelState(page, id);
  expect(await page.evaluate(() => window.getSerializedCanvas().includes('data-text="A\nB"')), '★전제: 직렬화에 \\n 이 날 글자로 실렸다').toBe(true);
  await reloadCanvas(page);
  const after = await labelState(page, id);
  expect({ data: after.data, text: after.text, lines: after.lines, els: after.els }, '다시 그린 뒤에도 같은 글·같은 줄 수')
    .toEqual({ data: 'A\nB', text: 'A\nB', lines: 2, els: 0 });
  expect(after.css, '다시 그린 라벨 style = 라이브').toBe(live.css);
});

test('AL4 라벨 글 편집 한 번 = ⌘Z 한 걸음 (어노테이션 글)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const r = await expectOneUndoStep(page, async () => {
    await dblEdit(page, id);
    await typeAB(page, id);
    await page.keyboard.press('Meta+Enter');
    await expect.poll(async () => (await labelState(page, id)).data, '★전제: 편집이 확정됐다').toBe('A\nB');
  }, '어노테이션 글');
  expect(r.topAction, '끝 표본 이름').toBe('어노테이션 글');
  await expect.poll(async () => (await labelState(page, id)).data, '⌘Z 한 번에 원래 글').toBe('텍스트');
});

test('AL5 한글 조합 중 Enter 는 줄바꿈을 넣지 않고 편집이 이어진다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await dblEdit(page, id);
  await page.keyboard.type('가');
  const r = await page.evaluate((id) => {
    const l = document.querySelector(`[id="${id}"] .annot-label`);
    const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true });
    const notPrevented = l.dispatchEvent(ev);
    return { composing: ev.isComposing, notPrevented, text: l.innerText, ce: l.getAttribute('contenteditable'), focus: document.activeElement === l };
  }, id);
  expect(r.composing, '★전제: 합성 이벤트가 조합 중으로 실렸다').toBe(true);
  expect({ notPrevented: r.notPrevented, nl: r.text.includes('\n'), ce: r.ce, focus: r.focus }, '조합 중 Enter 는 그냥 지나간다(\\n 0 · 편집 이어짐)')
    .toEqual({ notPrevented: true, nl: false, ce: 'true', focus: true });
  await page.keyboard.press('Meta+Enter');
  await expect.poll(async () => (await labelState(page, id)).data, '마치면 한 줄 글').toBe('가');
});

test('AL6 펜으로 만든 직후 편집도 같은 규약 — X · Enter · Y · Esc → X\\nY · 펜 종료', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await drawAnnotation(page);
  await page.keyboard.type('X');
  await page.keyboard.press('Enter');
  await expect.poll(() => editing(page, id), 'Enter 뒤에도 편집 중(펜 경로)').toBe(true);
  expect(await penOn(page), '★전제: 펜은 아직 켜져 있다').toBe(true);
  await page.keyboard.type('Y');
  await page.keyboard.press('Escape');
  await expect.poll(() => penOn(page), 'Esc 로 펜 종료').toBe(false);
  const s = await labelState(page, id);
  expect({ data: s.data, text: s.text, ce: s.ce, lines: s.lines }, '펜 경로도 줄바꿈이 남는다').toEqual({ data: 'X\nY', text: 'X\nY', ce: 'false', lines: 2 });
});

test('AL7 라벨 글은 글자다 — <b>x</b> 를 치고 다시 그려도 b 요소 0', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await dblEdit(page, id);
  await page.keyboard.type('<b>x</b>');
  await page.keyboard.press('Meta+Enter');
  await expect.poll(async () => (await labelState(page, id)).data, '★전제: 태그 꼴 글이 데이터에 들어갔다').toBe('<b>x</b>');
  await reloadCanvas(page);
  const s = await labelState(page, id);
  expect({ text: s.text, els: s.els, b: await page.evaluate((id) => document.querySelectorAll(`[id="${id}"] .annot-label b`).length, id) },
    '다시 그린 뒤에도 리터럴 글 · 요소 0').toEqual({ text: '<b>x</b>', els: 0, b: 0 });
});

/* ══ 1013t2C7 시작점 회전 ═══════════════════════════════════════════════════════
 *   AR0 (C7-pre) 끌기(전체 이동 · 점 손잡이) 뒤에도 삼각형이 «선 방향»을 가리킨다 · 다시 그린 것과 같다
 */
/* 시작점 상태 — 그려진 transform 과 «그래야 할» transform(같은 산식: 자동각 + 회전 + 180). */
const anchorState = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const a = b.querySelector('.annot-anchor');
  const pts = JSON.parse(b.dataset.points);
  const auto = window._calcAnnotAnchorAngle(pts);
  const rot = b.dataset.anchorRot === undefined ? 0 : Number(b.dataset.anchorRot);
  return { tf: a ? a.getAttribute('transform') : null, want: `rotate(${auto + rot + 180} ${pts[0][0]} ${pts[0][1]})`,
    auto, rot, rotKey: b.dataset.anchorRot ?? null, html: a ? a.outerHTML : null, points: b.dataset.points,
    rotHandles: b.querySelectorAll('.annot-rot-handle').length };
}, id);

async function setShape(page, id, shape) {
  await page.click(`#annot-shape-group .prop-align-btn[data-shape="${shape}"]`);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.anchorShape, id), `★전제: 시작점 모양 = ${shape}`).toBe(shape);
}

/* 진짜 마우스로 (x,y) 에서 (dx,dy) 화면 px 만큼 끈다(여덟 걸음). */
async function dragBy(page, x, y, dx, dy, { shift = false } = {}) {
  await page.mouse.move(x, y);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + dx * i / 8, y + dy * i / 8);
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}

/* 그 점이 정말 그 손잡이 위인가(SVG 라 hitAt 의 className 이 비어 직접 잰다). */
const hitIs = (page, x, y, sel) => page.evaluate(([x, y, sel]) => !!document.elementFromPoint(x, y)?.closest(sel), [x, y, sel]);

test('AR0 끌기 뒤에도 삼각형이 선 방향을 가리킨다 — 전체 이동 · 점 손잡이 · 다시 그린 것과 같다 (C7-pre)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await setShape(page, id, 'triangle');
  const s0 = await anchorState(page, id);
  expect(s0.tf, '★전제: 패널로 바꾼 직후엔 선 방향').toBe(s0.want);
  expect(Math.abs(Math.sin(s0.auto * Math.PI / 180)) > 0.1, `★전제: 대각선(자동각 ${s0.auto}° 가 0·180 이 아니다 — 아니면 결함이 안 보인다)`).toBe(true);
  // ① 라벨을 끌어 전체 이동(라벨을 «고르지» 않은 채)
  const lr = await waitStableRect(page, labelSel(id));
  expect(await hitIs(page, lr.cx, lr.cy, labelSel(id)), '★전제: 누르는 점이 라벨 위다').toBe(true);
  await dragBy(page, lr.cx, lr.cy, 30, 20);
  await expect.poll(async () => (await anchorState(page, id)).points, '전체 이동으로 점이 옮겨졌다').not.toBe(s0.points);
  const s1 = await anchorState(page, id);
  expect(s1.tf, '전체 이동 뒤 시작점 = 선 방향(각도 누락이면 rotate(180 …))').toBe(s1.want);
  // ② 시작점 손잡이를 끌어 선 방향을 바꾼다
  const hsel = `[id="${id}"] .annot-handle[data-point-idx="0"]`;
  const hr = await waitStableRect(page, hsel);
  expect(await hitIs(page, hr.cx, hr.cy, hsel), '★전제: 누르는 점이 시작점 손잡이 위다').toBe(true);
  await dragBy(page, hr.cx, hr.cy, 25, -15);
  await expect.poll(async () => (await anchorState(page, id)).auto, '점 손잡이로 선 방향이 바뀌었다').not.toBe(s1.auto);
  const s2 = await anchorState(page, id);
  expect(s2.tf, '점 끌기 뒤 시작점 = 새 선 방향').toBe(s2.want);
  // ③ 다시 그린 것(rebindAll)과 같다 — 끌기가 남긴 시작점이 «복원의 입력 = 결과»
  await reloadCanvas(page);
  const s3 = await anchorState(page, id);
  expect(s3.html, '다시 그린 시작점 outerHTML = 라이브').toBe(s2.html);
});
