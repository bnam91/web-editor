/* annotation-1013t2 — 스티커패널 어노테이션 블럭 (1013t2C6 라벨 줄바꿈 · 1013t2C7 시작점 회전).
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
 *   AR1~AR7 (1013t2C7) 시작점 회전 — 패널 칸 · 캔버스 손잡이 · ⌘Z · 저장 왕복 · 되돌리기 · 미직렬화 · 점 이동 뒤 (아래 절 머리)
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

/* ══ 1013t2C7 본체 ═══════════════════════════════════════════════════════════════
 *   AR1 패널 「회전°」 — 삼각형·화살촉일 때만 줄이 선다 · 30 → anchorRot '30' · 다른 모양으로 가도 데이터는 남는다
 *   AR2 캔버스 회전 손잡이 — 삼각형·화살촉에서만 1개 · 진짜 마우스 90° → anchorRot≈+90 · 점 불변 · ⇧ = 절대각 45° 단위
 *   AR3 회전 끌기 한 번 = ⌘Z 한 걸음 · ⌘⇧Z 로 다시
 *   AR4 저장 왕복 — anchorRot 유지 · 시작점 outerHTML 이 라이브와 같다
 *   AR5 「자동 방향으로 되돌리기」 — 0 이면 꺼짐 · 누르면 키 삭제 · 히스토리 '시작점 방향 되돌리기'
 *   AR6 회전 손잡이는 저장 직렬화에 안 실린다
 *   AR7 점을 옮겨도 회전은 «선 방향 대비»로 따라 돈다(새 자동각 + rot)
 *   AR8 숫자칸 200 — 프로그램 커밋은 셋 다 −160(이벨 D2) · 사람 타이핑은 가드 클램프로 셋 다 180
 */
const ROT_NUM = '#annot-anchor-rot-num';
const rotRow = (page) => page.evaluate(() => ({ slider: !!document.getElementById('annot-anchor-rot'), num: !!document.getElementById('annot-anchor-rot-num'),
  reset: document.getElementById('annot-anchor-rot-reset') ? document.getElementById('annot-anchor-rot-reset').disabled : null }));

async function typeRot(page, v) {
  await page.click(ROT_NUM);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(String(v));
  await page.keyboard.press('Enter');
}

/* 회전 중심(시작점)의 화면 좌표 — 섹션 rect + 점 × 배율. */
const anchorScreen = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const sr = b.closest('.section-block').getBoundingClientRect();
  const p = JSON.parse(b.dataset.points)[0]; const z = (window.currentZoom || 40) / 100;
  return { x: sr.left + p[0] * z, y: sr.top + p[1] * z, z };
}, id);

/* 회전 손잡이를 진짜 마우스로 중심 둘레 deg° 만큼(화면 시계방향 +) 돌린다. */
async function rotateBy(page, id, deg, { shift = false } = {}) {
  const hsel = `[id="${id}"] .annot-rot-handle`;
  const h = await waitStableRect(page, hsel);
  expect(await hitIs(page, h.cx, h.cy, hsel), '★전제: 누르는 점이 회전 손잡이 위다').toBe(true);
  const c = await anchorScreen(page, id);
  const R = Math.hypot(h.cx - c.x, h.cy - c.y);
  expect(R > 4, `★전제: 손잡이가 중심에서 떨어져 있다(R=${R})`).toBe(true);
  const a0 = Math.atan2(h.cy - c.y, h.cx - c.x);
  await page.mouse.move(h.cx, h.cy);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const a = a0 + (deg * Math.PI / 180) * i / 12;
    await page.mouse.move(c.x + R * Math.cos(a), c.y + R * Math.sin(a));
  }
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}
const wrapDeg = (d) => ((d % 360) + 540) % 360 - 180;

test('AR1 패널 「회전°」 — 삼각형·화살촉일 때만 · 30 → anchorRot 30 · 모양을 바꿔도 데이터는 남는다', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.anchorShape, id), '★전제: 기본 모양 circle').toBe('circle');
  expect(await rotRow(page), 'circle 이면 회전 줄 0').toEqual({ slider: false, num: false, reset: null });
  await setShape(page, id, 'triangle');
  await expect.poll(() => rotRow(page), 'triangle 이면 회전 줄이 선다(되돌리기는 꺼짐)').toEqual({ slider: true, num: true, reset: true });
  await typeRot(page, 30);
  await expect.poll(async () => (await anchorState(page, id)).rotKey, '숫자칸 30 → dataset').toBe('30');
  const s = await anchorState(page, id);
  expect(s.tf, '그려진 방향 = 자동각 + 30 + 180').toBe(s.want);
  await setShape(page, id, 'arrowhead');
  await expect.poll(() => rotRow(page), 'arrowhead 도 회전 줄').toEqual({ slider: true, num: true, reset: false });
  expect((await anchorState(page, id)).tf, '화살촉도 같은 방향 산식').toBe((await anchorState(page, id)).want);
  await setShape(page, id, 'circle');
  await expect.poll(() => rotRow(page), 'circle 로 가면 줄이 사라진다').toEqual({ slider: false, num: false, reset: null });
  expect((await anchorState(page, id)).rotKey, '데이터는 남는다').toBe('30');
  expect(errs).toEqual([]);
});

test('AR2 캔버스 회전 손잡이 — 삼각형·화살촉에서만 · 90° 끌기 → +90 · 점 불변 · ⇧ 는 절대각 45° 단위', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  expect((await anchorState(page, id)).rotHandles, 'circle 이면 회전 손잡이 0').toBe(0);
  await setShape(page, id, 'arrowhead');
  await expect.poll(async () => (await anchorState(page, id)).rotHandles, 'arrowhead 이면 1').toBe(1);
  await setShape(page, id, 'triangle');
  await expect.poll(async () => (await anchorState(page, id)).rotHandles, 'triangle 이면 1').toBe(1);
  const s0 = await anchorState(page, id);
  expect(s0.rotKey, '★전제: 회전 없음').toBeNull();
  await rotateBy(page, id, 90);
  await expect.poll(async () => (await anchorState(page, id)).rotKey, '끌기로 회전이 생겼다').not.toBeNull();
  const s1 = await anchorState(page, id);
  expect(Math.abs(wrapDeg(s1.rot - 90)) <= 1, `90° 끌기 → anchorRot≈90 (잰 값 ${s1.rot})`).toBe(true);
  expect(s1.points, '점은 그대로').toBe(s0.points);
  expect(s1.tf, '그려진 방향 = 자동각 + rot + 180').toBe(s1.want);
  await rotateBy(page, id, 20, { shift: true });
  await expect.poll(async () => (await anchorState(page, id)).rot, '⇧ 끌기로 값이 바뀌었다').not.toBe(s1.rot);
  const s2 = await anchorState(page, id);
  const m = (((s2.auto + s2.rot) % 45) + 45) % 45;
  expect(Math.min(m, 45 - m) < 0.02, `⇧ = 절대각(자동각 ${s2.auto} + rot ${s2.rot})이 45° 단위`).toBe(true);
});

test('AR3 회전 끌기 한 번 = ⌘Z 한 걸음 · ⌘⇧Z 로 다시', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await setShape(page, id, 'triangle');
  await expect.poll(async () => (await anchorState(page, id)).rotHandles, '★전제: 회전 손잡이').toBe(1);
  const r = await expectOneUndoStep(page, () => rotateBy(page, id, 60), '어노테이션 시작점 회전');
  expect(r.topAction, '끝 표본 이름').toBe('어노테이션 시작점 회전');
  await expect.poll(async () => (await anchorState(page, id)).rotKey, '⌘Z 뒤 회전 없음').toBeNull();
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(async () => (await anchorState(page, id)).rotKey, '⌘⇧Z 한 번에 다시').not.toBeNull();
  const s = await anchorState(page, id);
  expect(s.tf, '다시 뒤 그려진 방향 = 산식').toBe(s.want);
});

test('AR4 저장 왕복 — anchorRot 유지 · 시작점 outerHTML 이 라이브와 같다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await setShape(page, id, 'triangle');
  await typeRot(page, -45);
  await expect.poll(async () => (await anchorState(page, id)).rotKey, '★전제: 회전 -45').toBe('-45');
  const live = await anchorState(page, id);
  await reloadCanvas(page);
  const after = await anchorState(page, id);
  expect(after.rotKey, '다시 그린 뒤 anchorRot').toBe('-45');
  expect(after.html, '다시 그린 시작점 outerHTML = 라이브').toBe(live.html);
  expect(after.tf, '다시 그린 방향 = 산식').toBe(after.want);
});

test('AR5 「자동 방향으로 되돌리기」 — 0 이면 꺼짐 · 누르면 키 삭제 · 히스토리 한 칸', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await setShape(page, id, 'triangle');
  await expect.poll(async () => (await rotRow(page)).reset, '★전제: 회전 없으면 단추가 꺼져 있다').toBe(true);
  await typeRot(page, 30);
  await expect.poll(async () => (await rotRow(page)).reset, '회전이 생기면 단추가 켜진다').toBe(false);
  const tip0 = await page.evaluate(() => window.getHistoryTip().pos);
  await page.click('#annot-anchor-rot-reset');
  await expect.poll(async () => (await anchorState(page, id)).rotKey, '되돌리기 → 키 없음').toBeNull();
  const s = await anchorState(page, id);
  expect(s.tf, '자동 방향(rot 0)으로 그려졌다').toBe(s.want);
  await expect.poll(async () => (await rotRow(page)).reset, '되돌린 뒤 단추가 꺼진다').toBe(true);
  expect(await page.evaluate(() => window.getHistoryTip().action), '히스토리 이름').toBe('시작점 방향 되돌리기');
  expect(await page.evaluate(() => window.getHistoryTip().pos), '꼭대기가 올라갔다').toBeGreaterThan(tip0);
});

test('AR6 회전 손잡이는 저장 직렬화에 안 실린다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await setShape(page, id, 'triangle');
  await expect.poll(async () => (await anchorState(page, id)).rotHandles, '★전제: 라이브엔 회전 손잡이 1').toBe(1);
  expect(await page.evaluate(() => (window.getSerializedCanvas().match(/annot-rot-handle/g) || []).length), '직렬화엔 0').toBe(0);
});

test('AR7 점을 옮겨도 회전은 선 방향 대비로 따라 돈다 (새 자동각 + rot)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await setShape(page, id, 'triangle');
  await typeRot(page, 30);
  await expect.poll(async () => (await anchorState(page, id)).rotKey, '★전제: 회전 30').toBe('30');
  const s0 = await anchorState(page, id);
  const hsel = `[id="${id}"] .annot-handle[data-point-idx="0"]`;
  const hr = await waitStableRect(page, hsel);
  expect(await hitIs(page, hr.cx, hr.cy, hsel), '★전제: 누르는 점이 시작점 손잡이 위다').toBe(true);
  await dragBy(page, hr.cx, hr.cy, -20, 25);
  await expect.poll(async () => (await anchorState(page, id)).auto, '점을 옮겨 자동각이 바뀌었다').not.toBe(s0.auto);
  const s1 = await anchorState(page, id);
  expect(s1.rotKey, '회전값은 그대로').toBe('30');
  expect(s1.tf, '그려진 방향 = 새 자동각 + 30 + 180').toBe(s1.want);
});

/* AR8 — 숫자칸 커밋 길은 둘이다.
 *   ① 프로그램 커밋(untrusted input·change — goditor-api·자동화) → 가드(js/props/prop-number-commit-guard.js)를 지나쳐
 *      핸들러가 200 을 그대로 받아 −160 으로 감는다 ⇒ 숫자칸도 −160 이어야 한다(이벨 D2 · 고친 자리).
 *   ② 사람 타이핑(trusted) → 가드가 max=180 으로 클램프해 칸에 되쓴 뒤 커밋 ⇒ 셋 다 180(감김 없음). */
test('AR8 숫자칸 200 — 프로그램 커밋은 셋 다 −160 · 사람 타이핑은 셋 다 180(가드 클램프)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await setShape(page, id, 'triangle');
  expect(await rotRow(page), '★전제: 회전 줄이 섰다').toEqual({ slider: true, num: true, reset: true });
  const three = () => page.evaluate((id) => [document.getElementById(id).dataset.anchorRot ?? null,
    document.getElementById('annot-anchor-rot').value, document.getElementById('annot-anchor-rot-num').value], id);
  // ① 프로그램 커밋
  await page.evaluate(() => { const n = document.getElementById('annot-anchor-rot-num'); n.value = '200';
    n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(three, '프로그램 커밋 200 → 데이터·슬라이더·숫자칸 셋 다 −160').toEqual(['-160', '-160', '-160']);
  // ② 사람 타이핑
  await typeRot(page, 200);
  await expect.poll(three, '사람 타이핑 200 → 가드가 180 으로 클램프 · 셋 다 180').toEqual(['180', '180', '180']);
});
