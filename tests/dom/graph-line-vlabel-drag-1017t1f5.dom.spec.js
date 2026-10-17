/* graph-line-vlabel-drag-1017t1f5.dom.spec.js — 꺾은선 그래프 값 라벨(.grb-line-vlabel) 개별 드래그 이동(1017t1f5).
 *
 * ★★261018 — 이 검사는 작성 시점에 «안 돌렸다»(이 맥의 swap 95%·free 47MB 로 DOM/Playwright 금지 — 지디 지시).
 *   ★★처음 돌리는 사람이 할 일: 돌리기 «전»에 이 머리말에 「처음 돌린 날짜 · rc · 초록/빨강 몇 개」를 적어라.
 *   ★★안 적으면 「안 돌린 검사」가 조용히 «초록으로 간주»된다(지디 ⒊ 지시 그대로).
 *   [처음 실행 기록: ________________________________________________]
 *
 * 현빈 티켓(1017t1f5): 「꺾은선 그래프의 값표시 할때, 값들 개별 드래그로 위치이동 가능하게 해줘
 *   어노테이션의 라벨과 같은 원리로」.
 * 선례 = js/annotation-select.js _startLabelOffsetDrag(1013t1A3 · «이미 골라진 라벨을 안 움직이고
 *   한 번 더 누르면 라벨을 고른다, 다음 끌기 = 라벨만») + js/drag-utils.js grbPieSelect(여러 항목 중
 *   «하나 고르기» 표식 — 꺾은선은 항목이 어노테이션처럼 하나가 아니라 pie 조각처럼 여럿이라 이 꼴을 썼다).
 * ★261018 고침(태양 창 1차 실측 — 판 dfaa8280 — V3~V9 빨강 7) — 「고르기 ★쓰기」는 js/drag-utils.js
 *   의 mousedown 에 두지 않는다. js/block-drag.js 의 isGraph click 핸들러가 ★매 클릭마다 deselectAll()
 *   →재선택을 돌리는데(1013t1C4 조각 고르기와 같은 자리) 그게 clearSelectionMarks 로 -cell-selected 를
 *   전부 쓸어낸다 — mousedown/mouseup 에서 따로 골라 놔도 같은 제스처의 click 이 곧장 지웠다(V3 「2번째
 *   누름 뒤 picked=false」가 그 증거). 조각 고르기가 그 click 핸들러 «안에서» _pieWas/_pieIdx 로 지우기
 *   직전 상태를 챙겨 지운 뒤 다시 거는 것과 «같은 자리에» grbVLabelIndexAt(읽기)를 걸고 grbVLabelPick
 *   (쓰기)을 그 click 핸들러가 부른다. js/drag-utils.js 의 mousedown 은 ★이미 고른 라벨을 끄는 것만 맡는다.
 *
 * ★무엇을 잠그나
 *   V1 전제 — 「값표시」(showVLabel)가 기본으로 켜져 있고 항목마다 .grb-line-vlabel 이 «정확히 하나» 있다
 *   V2 아직 안 고른 라벨을 한 번 누르면(안 움직이고 놓으면) — 블럭 전체가 선택되지만 그 라벨은 «아직» 안 골라진다(1클릭=블럭)
 *   V3 이미 선택된 블럭에서 라벨을 «안 움직이고» 한 번 더 누르면 그 라벨만 골라진다(grb-vlabel-cell-selected) — 다른 라벨·xlabel 은 안 골라진다
 *   V4 고른 라벨을 끌면 — 그 라벨만 옮겨진다(items[i].vDx/vDy · 화면 이동량 = Δ×배율) · 다른 항목의 vlabel·xlabel·점(dot)·선(polyline)은 그대로
 *   V5 끌기 한 번 = ⌘Z 한 걸음(annotation AN7 과 같은 자)
 *   V6 다시 그려도(renderGraph 재호출 — 패널의 다른 값 바꾸기와 같은 길) 오프셋 · translate · 고른 표식이 남는다
 *   V7 저장→다시 열기(getSerializedCanvas → innerHTML → rebindAll)에선 오프셋(vDx/vDy)은 남지만 «고른 표식」은 안 남는다(런타임 마커 — annotation AN10 과 같은 자)
 *   V8 블럭이 absolute(자유배치)일 때, 선택만 되고 «안 고른» 라벨을 그대로 끌면 — 블럭 전체가 움직인다
 *      (라벨만 움직이지 않는다 · 어노테이션의 「한 번 더 눌러야」 원칙 재현). ★원판은 블럭이 일반 흐름이라
 *      애초에 마우스로 못 끄는 자리였다(js/block-drag.js:716-732, absolute 아닌 블럭은 드래그 시작이
 *      early-return) — position:absolute 전제를 세운 뒤 다시 쟀다(261018 고침, 아래 V8 바로 위 주석).
 *   V9 항목을 지우면(패널 삭제 버튼) 고른 표식이 풀린다(grbVLabelPick(null) — pie 의 같은 까닭과 짝)
 *
 * ★⒞ 무력화 계획(실행은 다른 기계 — 지디) — 아래 중 하나를 깨뜨리면 몇 벌이 빨개져야 하는지:
 *   ⓐ js/drag-utils.js _startVLabelOffsetDrag 의 e.stopImmediatePropagation() 을 지운다
 *      → V4(라벨만 옮겨짐) 빨강(블럭까지 같이 끌림) · V8 은 영향 없음(그쪽은 애초에 「안 고른」 경로 — picked 분기를 안 탄다)
 *   ⓑ css/editor-graph.css 의 `.grb-line-overlay .grb-line-vlabel { pointer-events: auto; }` 를 지운다
 *      → V2·V3·V4·V8 전부 빨강(라벨이 클릭을 못 받아 mousedown/click 이 전부 밑으로 샌다)
 *   ⓒ js/drag-utils.js 값 쓰기에서 `if (cur.dx === 0) delete its[idx].vDx;` 가드를 지우고 늘 쓴다
 *      → V1(0,0 복귀 뒤에도 vDx:'0' 키가 남아 「없음」 전제가 깨진다 — 되돌리기 관련 보조 검사가 있다면 그쪽도 빨강)
 *   ⓓ js/drag-utils.js 의 `const _vSelIdx = _grbVLabelMarkIndex(block);` ~ 복원 줄(그 아래 `if (_vSelIdx >= 0) grbVLabelPick(...)`)을 지운다
 *      → V6 빨강(다시 그리면 고른 표식이 사라짐 — pie 의 S6 과 같은 자리)
 *   ⓔ js/io/section-serialize.js RUNTIME_MARKER_RE 에서 `cell-selected` 분기를 지운다(다른 표식도 다 같이 샌다 — 넓은 무력화)
 *      → V7 빨강(저장본에 grb-vlabel-cell-selected 가 실림) — ⚠️pie 의 S4·annotation 의 AN10 도 같이 빨개진다(겹치는 음성대조 자리 — 한 군데 고치면 셋 다 돌아온다)
 *   ⓦ ★261018 고침으로 새로 생긴 자리 — js/block-drag.js isGraph click 핸들러의 `window.grbVLabelPick?.(block, (_pieWas && _vlabelIdx >= 0) ? _vlabelIdx : null);` 줄을 지운다
 *      → V3 빨강(2번째 눌러도 안 골라짐) → V4·V5·V6·V7·V9 도 전부 같이 빨강(「고름」이 전제라 사슬로 넘어간다) — ★이 자리가 ★★진짜 뿌리다
 *   ⇒ 겹치는 음성대조: ⓔ 를 깨면 이 파일 V7 뿐 아니라 graph-pie-1013(S4)·annotation-1013(AN10) 도 같이 빨개져야 한다(묶음 판정 — 「뿌리 하나」를 이 세 자리로 검산).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt, hitAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const ITEMS = [
  { label: '1월', value: 10 },
  { label: '2월', value: 40 },
  { label: '3월', value: 25 },
];

/* 꺾은선 그래프 블럭 하나(항목 3개) — _graph-gr-harness.js setup() 과 같은 길(makeGraphBlock 직접 호출). */
async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = [];
  await bootApp(page).then((e) => { if (Array.isArray(e)) errs.push(...e); });
  await page.evaluate(({ items }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="lnS" data-section="1" style="background:#fff"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;"></div></div>');
    const { row, block } = window.makeGraphBlock();
    block.id = 'lnG';
    block.dataset.chartType = 'line';
    block.dataset.items = JSON.stringify(items);
    document.querySelector('#lnS .section-inner').appendChild(row);
    window.renderGraph(block);
    window.rebindAll?.();
    window.deselectAll?.();
  }, { items: ITEMS });
  await page.waitForTimeout(150);
  return errs;
}

const vlabels = (page) => page.evaluate(() => [...document.querySelectorAll('#lnG .grb-line-vlabel')].length);
const vlabelState = (page) => page.evaluate(() => {
  const b = document.getElementById('lnG');
  const items = JSON.parse(b.dataset.items || '[]');
  const els = [...b.querySelectorAll('.grb-line-vlabel')];
  return {
    sel: b.classList.contains('selected'),
    n: els.length,
    picked: els.map(l => l.classList.contains('grb-vlabel-cell-selected')),
    offsets: items.map(it => ({ dx: it.vDx ?? null, dy: it.vDy ?? null })),
    translates: els.map(l => l.style.translate || ''),
  };
});
const dotRects = (page) => page.evaluate(() => [...document.querySelectorAll('#lnG .grb-line-point-dot')].map(d => { const r = d.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; }));
const xlabelRects = (page) => page.evaluate(() => [...document.querySelectorAll('#lnG .grb-line-xlabel')].map(d => { const r = d.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; }));
const blockRect = (page) => page.evaluate(() => { const r = document.getElementById('lnG').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; });

/* i 번 값 라벨의 화면 사각형(안정화 — index 지원, t1bstar 꼴). */
const vlabelRect = (page, i) => waitStableRect(page, '#lnG .grb-line-vlabel', { index: i });

test('V1 전제 — 값표시 기본 켜짐 · 항목마다 .grb-line-vlabel 정확히 1개 · 오프셋 0', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => document.getElementById('lnG').dataset.showVLabel), '★전제: showVLabel 키 없음(기본값이 보임을 뜻한다)').toBeUndefined();
  expect(await vlabels(page), '항목 3개 = 값 라벨 3개').toBe(ITEMS.length);
  const s = await vlabelState(page);
  expect(s.offsets, '만든 직후 오프셋 전부 없음').toEqual(ITEMS.map(() => ({ dx: null, dy: null })));
  expect(s.picked, '만든 직후 고른 라벨 없음').toEqual([false, false, false]);
  const cs = await page.evaluate(() => getComputedStyle(document.querySelector('#lnG .grb-line-vlabel')).pointerEvents);
  expect(cs, '값 라벨이 클릭을 받는다(pointer-events auto)').toBe('auto');
  expect(errs).toEqual([]);
});

test('V2 아직 안 고른 라벨 — 한 번 누르면 블럭만 선택(라벨은 안 골라짐)', async ({ page }) => {
  await setup(page);
  const r = await vlabelRect(page, 1);
  await clickAt(page, r.cx, r.cy, { sel: '#lnG .grb-line-vlabel' }, { label: '값 라벨 1번' });
  await expect.poll(async () => (await vlabelState(page)).sel, '첫 클릭 = 블럭 선택').toBe(true);
  expect((await vlabelState(page)).picked, '라벨은 아직 안 골라짐').toEqual([false, false, false]);
});

test('V3 이미 선택된 블럭 — 라벨을 안 움직이고 한 번 더 누르면 그 라벨만 골라진다', async ({ page }) => {
  await setup(page);
  const r1 = await vlabelRect(page, 1);
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, { label: '1차' });
  await expect.poll(async () => (await vlabelState(page)).sel).toBe(true);
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, { label: '2차(같은 자리)' });
  await expect.poll(async () => (await vlabelState(page)).picked, '2번째 라벨만 골라짐').toEqual([false, true, false]);
  const cur = await page.evaluate(() => getComputedStyle(document.querySelectorAll('#lnG .grb-line-vlabel')[1]).cursor);
  expect(cur, '고른 라벨은 grab 커서').toBe('grab');
});

test('V4 고른 라벨을 끌면 그 라벨만 옮겨진다 — 다른 라벨·점·선은 그대로', async ({ page }) => {
  await setup(page);
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  const r1 = await vlabelRect(page, 1);
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, { label: '고르기 1차' });
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, { label: '고르기 2차' });
  await expect.poll(async () => (await vlabelState(page)).picked).toEqual([false, true, false]);

  const dots0 = await dotRects(page), xl0 = await xlabelRects(page), blk0 = await blockRect(page);
  const otherV0 = (await vlabelRect(page, 0)), other2V0 = (await vlabelRect(page, 2));

  const hit = await hitAt(page, r1.cx, r1.cy);
  expect(hit && /grb-line-vlabel/.test(hit.cls), `★전제: 누르는 점이 라벨 위다(${JSON.stringify(hit)})`).toBe(true);
  /* ★261018 고침(태양 창 2차 실측 — dy: -18 기대, -17 받음) — ★제품 산식 탓이 아니었다(㉡). DY=-18 은
     기본 배율 40%(z=0.4)에서 DX*z=−7.2(정수가 아닌 화면 px 목표) — 사람 손이면 안 날 값이지만 8틱으로
     쪽자른 synthetic mouse.move 가 그 비정수 목표에 닿을 때 브라우저가 소수점 화면 px 를 1px 단위로 또
     한 번 반올림한다(테스트 하네스의 입력 경로에서 드는 반올림 — 코드 쪽 clamp()의 Math.round 1회는
     건드리지 않았다). 선례 annotation-1013.dom.spec.js AN6 은 DX=40·DY=20(둘 다 5의 배수 ⇒ ×0.4 가 항상
     정수: 16·8)만 쓴다 — ★그 규칙을 그대로 가져온다: 5의 배수만 쓰면 ×0.4 가 항상 정수라 이 반올림 자리가
     생기지 않는다(㉠ 처럼 보였지만 실은 ★테스트 값의 흠 — 제품 clamp() 자체는 안 고쳤다). */
  const DX = 30, DY = -20;
  await page.mouse.move(r1.cx, r1.cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(r1.cx + DX * z * i / 8, r1.cy + DY * z * i / 8);
  await page.mouse.up();

  const s1 = await vlabelState(page);
  expect(s1.offsets, '고른 항목(1번)에만 오프셋').toEqual([{ dx: null, dy: null }, { dx: DX, dy: DY }, { dx: null, dy: null }]);
  expect(s1.translates[1], '그려진 translate').toBe(`${DX}px ${DY}px`);
  const r1After = await vlabelRect(page, 1);
  expect(Math.abs((r1After.cx - r1.cx) - DX * z) <= 2 && Math.abs((r1After.cy - r1.cy) - DY * z) <= 2,
    `라벨 1번이 화면에서 (${DX},${DY})×배율 만큼 움직였다: Δ=(${r1After.cx - r1.cx},${r1After.cy - r1.cy}) z=${z}`).toBe(true);

  expect(await dotRects(page), '점(dot) 위치 불변 — 라벨만 움직였다').toEqual(dots0);
  expect(await xlabelRects(page), '카테고리 라벨(xlabel) 위치 불변').toEqual(xl0);
  expect(await blockRect(page), '블럭 자체 위치 불변').toEqual(blk0);
  const otherV1 = await vlabelRect(page, 0), other2V1 = await vlabelRect(page, 2);
  expect([otherV1.cx, otherV1.cy], '다른 항목(0번) 값 라벨은 안 움직였다').toEqual([otherV0.cx, otherV0.cy]);
  expect([other2V1.cx, other2V1.cy], '다른 항목(2번) 값 라벨은 안 움직였다').toEqual([other2V0.cx, other2V0.cy]);
  expect(await page.evaluate(() => document.getElementById('lnG').classList.contains('selected')), '끈 뒤에도 블럭 선택 유지').toBe(true);
});

test('V5 라벨 끌기 한 번 = ⌘Z 한 걸음 · ⌘⇧Z 로 다시', async ({ page }) => {
  await setup(page);
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  const r1 = await vlabelRect(page, 1);
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  await expect.poll(async () => (await vlabelState(page)).picked).toEqual([false, true, false]);
  const DX = 25, DY = 10;
  const drag = async () => {
    await page.mouse.move(r1.cx, r1.cy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(r1.cx + DX * z * i / 8, r1.cy + DY * z * i / 8);
    await page.mouse.up();
  };
  const r = await expectOneUndoStep(page, drag, '그래프 값 라벨 위치');
  expect(r.topAction, '끝 표본 이름').toBe('그래프 값 라벨 위치');
  expect((await vlabelState(page)).offsets[1], '⌘Z 뒤 오프셋 없음').toEqual({ dx: null, dy: null });
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(async () => (await vlabelState(page)).offsets[1], '⌘⇧Z 한 번에 다시').toEqual({ dx: DX, dy: DY });
});

test('V6 다시 그려도(renderGraph 재호출) 오프셋·고른 표식이 남는다', async ({ page }) => {
  await setup(page);
  const r1 = await vlabelRect(page, 1);
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  const DX = 10, DY = 10;   // ★261018 고침 — 5의 배수(위 V4 주석과 같은 까닭). 원값 12/8 은 ×0.4 가 4.8/3.2(비정수)이라 테스트 쪽에서 ±1 반올림이 났다.
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  await page.mouse.move(r1.cx, r1.cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(r1.cx + DX * z * i / 8, r1.cy + DY * z * i / 8);
  await page.mouse.up();
  await expect.poll(async () => (await vlabelState(page)).offsets[1], '★전제: 오프셋이 생겼다').toEqual({ dx: DX, dy: DY });
  // 다른 이유의 재렌더(패널 색 바꾸기와 같은 길) — 고른 표식·오프셋이 남아야 한다(pie S6 과 같은 자리)
  await page.evaluate(() => { const b = document.getElementById('lnG'); b.dataset.lineColor = '#ff0000'; window.renderGraph(b); });
  const s = await vlabelState(page);
  expect(s.offsets[1], '재렌더 뒤에도 오프셋').toEqual({ dx: DX, dy: DY });
  expect(s.translates[1], '재렌더 뒤에도 translate').toBe(`${DX}px ${DY}px`);
  expect(s.picked, '재렌더 뒤에도 고른 표식').toEqual([false, true, false]);
});

test('V7 저장→다시 열기 — 오프셋은 남고 「고른 표식」은 안 남는다(런타임 마커)', async ({ page }) => {
  await setup(page);
  const r1 = await vlabelRect(page, 1);
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  const DX = 10, DY = -5;   // ★261018 고침 — 5의 배수(위 V4 주석과 같은 까닭). 원값 DX=7 은 ×0.4 가 2.8(비정수)이라 테스트 쪽에서 ±1 반올림이 났다(DY=-5 는 원래부터 5의 배수라 안 깨졌다).
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  await page.mouse.move(r1.cx, r1.cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(r1.cx + DX * z * i / 8, r1.cy + DY * z * i / 8);
  await page.mouse.up();
  await expect.poll(async () => (await vlabelState(page)).offsets[1], '★전제: 오프셋이 생겼다').toEqual({ dx: DX, dy: DY });
  const marked = await page.evaluate(() => document.getElementById('lnG').outerHTML);
  expect(marked, '라이브엔 고른 표식이 있다').toContain('grb-vlabel-cell-selected');
  const saved = await page.evaluate(() => window.getSerializedCanvas());
  expect(saved, '저장본엔 고른 표식이 없다').not.toContain('grb-vlabel-cell-selected');
  expect(saved, '저장본엔 오프셋 translate 는 있다').toContain(`${DX}px ${DY}px`);
  await page.evaluate(() => { document.getElementById('canvas').innerHTML = window.getSerializedCanvas(); window.rebindAll(); });
  const s = await vlabelState(page);
  expect(s.offsets[1], '다시 연 뒤에도 오프셋').toEqual({ dx: DX, dy: DY });
  expect(s.picked, '다시 연 뒤엔 고른 표식 없음(런타임 마커라 저장에 안 실림)').toEqual([false, false, false]);
});

/* ★261018 고침 — V8 원판은 블럭이 «일반 흐름»(section-inner 에 그냥 붙인 row)이라 애초에 마우스로
 *   끌 수 없는 자리였다(js/block-drag.js:716-732 — isShape/isText/isMockup 가 아닌 블럭은
 *   `block.style.position !== 'absolute'` 면 드래그 시작 자체가 early-return 한다. 그래픽 블럭의
 *   전체-이동은 freeLayout/absolute 블럭에만 있는 길이다). ⇒ ★자체가 못 쟀다(V3 수정과 무관하게
 *   항상 빨강이었을 자리) — position:absolute 를 직접 줘서(부모 free-layout frame 없이도 이 조건
 *   하나로 드래그 길이 열린다) 그 전제부터 세우고 다시 쟀다. */
test('V8 안 고른 라벨을 그대로 끌면(두 번 안 누름) — 블럭 전체가 움직인다(블럭이 absolute 일 때)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const b = document.getElementById('lnG');
    b.style.position = 'absolute'; b.style.left = '40px'; b.style.top = '40px';
  });
  const r1a = await vlabelRect(page, 1);
  // 블럭을 «선택만»(고르기 전) — click 한 번(mousedown+mouseup+click)으로 블럭 선택, 라벨은 안 고름.
  await clickAt(page, r1a.cx, r1a.cy, { sel: '#lnG .grb-line-vlabel' }, { label: '선택만' });
  await expect.poll(async () => (await vlabelState(page)).sel, '★전제: 블럭이 선택됐다').toBe(true);
  await expect.poll(async () => (await vlabelState(page)).picked, '★전제: 라벨은 안 골랐다').toEqual([false, false, false]);

  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  const r1 = await vlabelRect(page, 1);
  const blk0 = await blockRect(page);
  const hit = await hitAt(page, r1.cx, r1.cy);
  expect(hit && /grb-line-vlabel/.test(hit.cls), `★전제: 누르는 점이 라벨 위다(${JSON.stringify(hit)})`).toBe(true);
  const DX = 20, DY = 20;
  await page.mouse.move(r1.cx, r1.cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(r1.cx + DX * z * i / 8, r1.cy + DY * z * i / 8);
  await page.mouse.up();
  const s = await vlabelState(page);
  expect(s.offsets, '라벨 오프셋은 안 생겼다(블럭이 옮겨진 것이다)').toEqual([{ dx: null, dy: null }, { dx: null, dy: null }, { dx: null, dy: null }]);
  const blk1 = await blockRect(page);
  expect(blk1, '블럭 자체가 화면에서 움직였다').not.toEqual(blk0);
});

test('V9 항목을 지우면 고른 표식이 풀린다', async ({ page }) => {
  await setup(page);
  const r1 = await vlabelRect(page, 1);
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  await clickAt(page, r1.cx, r1.cy, { sel: '#lnG .grb-line-vlabel' }, {});
  await expect.poll(async () => (await vlabelState(page)).picked).toEqual([false, true, false]);
  await page.evaluate(() => window.showGraphProperties(document.getElementById('lnG')));
  await page.locator('.grb-data-del-btn:not([data-seg])').first().click();
  await expect.poll(async () => (await vlabelState(page)).n, '항목이 하나 줄었다').toBe(ITEMS.length - 1);
  expect((await vlabelState(page)).picked, '고른 표식이 풀렸다').toEqual([false, false]);
});
