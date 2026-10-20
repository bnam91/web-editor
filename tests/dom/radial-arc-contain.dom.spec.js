/* radial-arc-contain — 방사형 에셋 블럭 «호 모드» : 기본 꼴 = 반원 · 잘리지 않는다 (프로토 · 1013t2A3 V3 → V4 반원 · 2026-10-14)
 *
 * 현빈 원문 — 「방사블럭에 호가 왜 잘려있는지? 잘리지 않게 해주고 선풍기는 안보여도됨 / 시안 업데이트 해줘」
 * V3 반려(현빈) — ① 「반원 끝점이 왼쪽에 붙어야 되는데 윗변·아랫변에 있어서 잘려보인다는거야. 반원이 되도록 말야.」
 *                 ② 「칸그림은 일단 다 빼놔봐. 디폴트 모습이 어떤건지 좀 봐야되겠는데 더 복잡해 보여」
 *   ⇒ V3 은 «호가 블럭 밖으로 안 나간다»만 쟀다 — 그 자로는 «반원으로 보이나»를 못 잰다. V4 의 판정 자 = 세 수(RC8~RC10):
 *        끝점 둘의 x = 블럭 왼쪽 변 ±2px · 끝점 둘의 y 차 = 2R ±2px · 호의 가장 오른쪽 점 x = R ±2px
 *
 * 이 파일이 잠그는 것 — 실제 앱(index.html 통째) 위에서 «화면 좌표»로
 *   RC0 전제: 데모의 호 블럭 하나 · 원 블럭 하나가 그려졌다 · 오류 0
 *   RC1 데모 호 블럭 — 호 선 · 점 · 라벨이 스테이지 안, 스테이지가 블럭 안(변별 넘침 px = 0)
 *   RC2 호 선이 온전하다 — path 길이 = 반지름 × 구간(rad), 양 끝점이 svg 상자 안 · 라벨이 호 위에 안 얹힌다
 *   RC3 설정을 바꿔도 따라간다(V3 의 «상자에 담기»가 살아 있다) — 끝 각도 · 선 연장 · 항목 수 · 라벨 폭 · 반지름 · 원 중심 X
 *   RC4 온 원 모드는 V2 식 그대로 — 스테이지 치수 · 점 좌표
 *   RC5 데모 화면 — 선풍기 그림 0 · 「V4 반원」 표시 · 옛 이름 0(메뉴 풍선말 포함)
 *   RC6 폭이 바뀌면 다시 맞춘다 — 항목 끌기 둘 → ⌘Z ×2 → ⇧⌘Z ×2 뒤 넘침 0 · 폭을 줄였다 늘려도 따라온다 · 폭이 호보다 좁으면 반지름을 줄인다
 *   RC7 라벨을 화면에서 재서 한 번 더 맞춘다 — 어림보다 큰 라벨에서 스테이지 높이 > 어림 높이 · 넘침 0
 *   RC8 (V4) 데모 첫 섹션 = 기본 반원 하나 — 세 수 · 잘려 숨은 호 길이 0 · 원 중심 밀기 0 · 반지름 줄이기 0
 *   RC9 (V4) 새로 만든 호 블럭(addRadialBlock — 삽입 메뉴가 부르는 함수) — 같은 세 수 · 데모와 같은 상태(배경만 다르다)
 *   RC10 (V4) 패널 전환 길(원 블럭 → 패널 「호」 버튼) — 같은 세 수 · 원으로 돌아가면 원의 모습이 돌아온다
 *   RC11 (V4) 두 데모의 블럭 안 이미지 · 아이콘 · 배경 그림 = 0 — 항목은 점 + 글
 *   RC12 (V4) 옆 라벨이 오른쪽 변을 넘으면 반지름보다 라벨 폭을 먼저 죈다 — 반지름 그대로 · 세 수 그대로 · 넘침 0 / 바닥까지 죄고도 넘치면 반지름을 줄인다
 *
 * V3 칸에서 바뀐 것: 데모가 «기본 반원 하나»가 됐다(V3 의 판 ②③④ 삭제) ⇒ RC0·RC1·RC2 는 블럭 하나를 잰다(가운데 글 전제 삭제 — 가운데가 있는 호 판이 없어졌다).
 *   RC3 은 데모 설정에 기대지 않고 V3 판 ① 의 설정을 «검사 안에서» 입힌 뒤 잰다. RC6 의 «폭 줄였다 늘리기»는 같은 블럭에서 잰다(판 ④ 가 없어졌다).
 *
 * 안 재는 것(⛔「닫았다」로 적지 않는다)
 *   · 패널 숫자 칸을 사람이 고치는 길 — 여기서는 dataset 을 바꾸고 다시 그린다(모델 = dataset). RC10 의 버튼은 DOM click() 으로 누른다(포인터로 누르지 않는다).
 *   · 그리드·프레임 칸 안의 좁은 폭(row 폭만 줄인다) · 글꼴이 늦게 실려 라벨 크기가 바뀐 뒤.
 *   · ★되돌린 «중간» 상태(redo 꼬리가 있는 동안)의 넘침 — 그때는 블럭이 일부러 다시 맞추지 않는다(js/blocks/radial-block.js 「폭 관찰」 주석).
 *   · 눈으로 보는 모양(스샷) — 수로만 잰다. 점선 호 · 가운데가 있는 호 · 항목을 끝점으로 끈 뒤의 꼴.
 * 넘침은 «레이아웃 px»(화면 px ÷ 배율)로 잰다 — 배율이 작아도 허용 오차가 느슨해지지 않는다.
 * ★내용 상자 위 · 아래 · 오른쪽에 여유 16px 이 있어 «넘침 ≤ 허용 오차»는 그쪽 16px 까지의 어긋남은 못 본다(그 안쪽은 유닛 radial-arc-geom 의 몫). 왼쪽 여유는 0 이다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT, waitStableRect } = require('./_root-harness.js');

const ARC_ID = 'rdl_pz6aarc';
const ARC_IDS = [ARC_ID];
const ARC_SEC = 'sec_pz6aarc', CIRCLE_SEC = 'sec_pz6a';
const CIRCLE_ID = 'rdl_pz6a';
const TOL = 0.75;   // 레이아웃 px(화면 px ÷ 배율) — 소수 좌표 반올림
const HALF_TOL = 2;  // 반원의 세 수 — 현빈 판정 자의 허용 오차(레이아웃 px)

async function bootWithDemos(page) {
  const errs = await bootApp(page);
  const html = fs.readFileSync(path.join(ROOT, 'proto', 'demo-z6-a-arc.html'), 'utf8')
    + fs.readFileSync(path.join(ROOT, 'proto', 'demo-z6-a.html'), 'utf8');
  await page.evaluate((h) => {
    document.getElementById('canvas').insertAdjacentHTML('beforeend', h);
    window.rebindAll();
  }, html);
  await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`#${id} > .rdl-stage`)), [...ARC_IDS, CIRCLE_ID], { timeout: 15000 });
  // 글꼴이 실린 뒤의 라벨 크기로 한 번 더 맞춘다(렌더는 그릴 때의 라벨 크기를 잰다)
  await page.evaluate(async (ids) => {
    await document.fonts.ready;
    ids.forEach((id) => window.renderRadialBlock(document.getElementById(id)));
  }, [...ARC_IDS, CIRCLE_ID]);
  return errs;
}

/** 블럭 하나의 넘침 — 스테이지 사각형 밖으로 나간 «레이아웃 px»(변별 최대). 그려진 것마다 따로 센다. */
function overflowOf(page, id) {
  return page.evaluate((bid) => {
    const block = document.getElementById(bid);
    const stage = block && block.querySelector(':scope > .rdl-stage');
    if (!stage) throw new Error('스테이지가 없다: ' + bid);
    const S = stage.getBoundingClientRect(), B = block.getBoundingClientRect();
    const scale = S.width / (stage.offsetWidth || 1);
    const line = stage.querySelector('.rdl-line');
    if (!(scale > 0)) throw new Error('배율을 못 쟀다: ' + bid);
    const sw = (Number(line.getAttribute('stroke-width')) || 0) / 2;   // 레이아웃 px
    const worst = { top: 0, bottom: 0, left: 0, right: 0 }, who = {};
    const counts = { line: 0, cell: 0, label: 0, center: 0 };
    const take = (el, kind, grow) => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 || r.height > 0)) return;
      counts[kind]++;
      const o = { top: (S.top - r.top) / scale + grow, bottom: (r.bottom - S.bottom) / scale + grow, left: (S.left - r.left) / scale + grow, right: (r.right - S.right) / scale + grow };
      for (const k of Object.keys(o)) if (o[k] > worst[k]) { worst[k] = o[k]; who[k] = kind; }
    };
    // 호 선은 상자(getBoundingClientRect)로 재지 않는다 — 끝이 잘린 선(butt)은 끝점에서 «반지름 방향»으로만 두껍다(±90° 끝점은 왼쪽으로 0px 나간다).
    //   path 를 촘촘히 찍어 화면 좌표로 옮기고, 점마다 반지름 방향으로 두께 반을 더한다.
    if ((line.getAttribute('d') || '').length) {
      counts.line++;
      const M = line.getScreenCTM(), len = line.getTotalLength(), N = 720;
      const cx = Number(stage.dataset.rdlCx), cy = Number(stage.dataset.rdlCy);
      for (let i = 0; i <= N; i++) {
        const u = line.getPointAtLength(len * i / N), q = new DOMPoint(u.x, u.y).matrixTransform(M);
        const x = (q.x - S.left) / scale, y = (q.y - S.top) / scale;
        const a = Math.atan2(y - cy, x - cx), tx = sw * Math.abs(Math.cos(a)), ty = sw * Math.abs(Math.sin(a));
        const o = { top: ty - y, bottom: y + ty - S.height / scale, left: tx - x, right: x + tx - S.width / scale };
        for (const k of Object.keys(o)) if (o[k] > worst[k]) { worst[k] = o[k]; who[k] = 'line'; }
      }
    }
    stage.querySelectorAll('.rdl-cell').forEach((el) => take(el, 'cell', 0));
    stage.querySelectorAll('.rdl-label').forEach((el) => take(el, 'label', 0));
    stage.querySelectorAll('.rdl-center').forEach((el) => take(el, 'center', 0));
    const stageOut = Math.max(B.top - S.top, S.bottom - B.bottom, B.left - S.left, S.right - B.right, 0) / scale;
    return {
      worst, who, counts, stageOut, scale,
      cw: block.clientWidth, drawnW: Number(stage.querySelector('svg').getAttribute('width')),   // drawnW = 이 그림을 맞춘 폭
      stageOverflow: getComputedStyle(stage).overflow,
      fit: stage.dataset.rdlFit, shrunk: Number(stage.dataset.rdlShrunk), shift: Number(stage.dataset.rdlShift),
      R: Number(stage.dataset.rdlR), H: stage.offsetHeight, W: stage.offsetWidth,
    };
  }, id);
}
function expectContained(o, tag) {
  for (const side of ['top', 'bottom', 'left', 'right']) {
    expect(o.worst[side], `${tag} ${side} 넘침 px (누가: ${o.who[side] || '-'})`).toBeLessThanOrEqual(TOL);
  }
  expect(o.stageOut, `${tag} 스테이지가 블럭 밖으로 나간 px`).toBeLessThanOrEqual(TOL);
}
/** 반원의 세 수 — 호 path 의 «실제 끝점 둘»과 «가장 오른쪽 점»을 화면 좌표로 옮겨 블럭 레이아웃 px 로 잰다(블럭 왼쪽 위가 0,0).
 *  outsidePx = 스테이지(또는 블럭) 사각형 밖에 놓인 호 길이 — 스테이지가 넘침을 자르면 그만큼이 숨는다. */
function halfOf(page, id) {
  return page.evaluate((bid) => {
    const block = document.getElementById(bid);
    const stage = block && block.querySelector(':scope > .rdl-stage');
    const line = stage && stage.querySelector('.rdl-line');
    if (!line) throw new Error('호 선이 없다: ' + bid);
    const B = block.getBoundingClientRect(), S = stage.getBoundingClientRect();
    const k = B.width / (block.offsetWidth || 1);
    if (!(k > 0)) throw new Error('배율을 못 쟀다: ' + bid);
    const M = line.getScreenCTM(), len = line.getTotalLength();
    const at = (l) => { const u = line.getPointAtLength(l), q = new DOMPoint(u.x, u.y).matrixTransform(M); return { sx: q.x, sy: q.y, x: (q.x - B.left) / k, y: (q.y - B.top) / k }; };
    const a = at(0), b = at(len), N = 2000, eps = 0.75 * k;
    let right = -Infinity, rightY = 0, out = 0;
    for (let i = 0; i <= N; i++) {
      const p = at(len * i / N);
      if (p.x > right) { right = p.x; rightY = p.y; }
      const inS = p.sx >= S.left - eps && p.sx <= S.right + eps && p.sy >= S.top - eps && p.sy <= S.bottom + eps;
      const inB = p.sx >= B.left - eps && p.sx <= B.right + eps && p.sy >= B.top - eps && p.sy <= B.bottom + eps;
      if (!inS || !inB) out++;
    }
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return {
      d: line.getAttribute('d') || '', len: r3(len), points: N + 1,
      ax: r3(a.x), ay: r3(a.y), bx: r3(b.x), by: r3(b.y), dy: r3(Math.abs(b.y - a.y)), right: r3(right), rightY: r3(rightY),
      midY: r3((a.y + b.y) / 2), outsidePx: r3(len * out / (N + 1)),
      stageOverflow: getComputedStyle(stage).overflow,
      R: Number(stage.dataset.rdlR), wantR: Number(block.dataset.radius), cx: Number(stage.dataset.rdlCx),
      shift: Number(stage.dataset.rdlShift), shrunk: Number(stage.dataset.rdlShrunk), fit: stage.dataset.rdlFit,
      shape: block.dataset.shape, startDeg: block.dataset.startDeg, endDeg: block.dataset.endDeg, centerX: block.dataset.centerX, lineExtend: block.dataset.lineExtend,
      cap: line.getAttribute('stroke-linecap'), cw: block.clientWidth, stageH: stage.offsetHeight, k: r3(k),
    };
  }, id);
}
/** 세 수 + 그 꼴을 받치는 값들을 한꺼번에 단언한다(soft — 빨강이면 어긋난 수를 전부 찍는다). */
function expectHalfCircle(h, tag) {
  // 전제 — 잴 것이 있다
  expect(h.shape, `${tag} 전제: 호 모드`).toBe('arc');
  expect(h.d.length, `${tag} 전제: 호 path 가 있다`).toBeGreaterThan(0);
  expect(h.R, `${tag} 전제: 반지름`).toBeGreaterThan(0);
  expect(h.k, `${tag} 전제: 배율`).toBeGreaterThan(0);
  // ★세 수 — «반원으로 보이나»
  expect.soft(Math.abs(h.ax), `${tag} ① 시작 끝점 x = 블럭 왼쪽 변(0) ±${HALF_TOL} · 실제 ${h.ax}`).toBeLessThanOrEqual(HALF_TOL);
  expect.soft(Math.abs(h.bx), `${tag} ① 끝 끝점 x = 블럭 왼쪽 변(0) ±${HALF_TOL} · 실제 ${h.bx}`).toBeLessThanOrEqual(HALF_TOL);
  expect.soft(Math.abs(h.dy - 2 * h.R), `${tag} ② 끝점 둘의 y 차 = 2R(${2 * h.R}) ±${HALF_TOL} · 실제 ${h.dy}`).toBeLessThanOrEqual(HALF_TOL);
  expect.soft(Math.abs(h.right - h.R), `${tag} ③ 가장 오른쪽 점 x = R(${h.R}) ±${HALF_TOL} · 실제 ${h.right}`).toBeLessThanOrEqual(HALF_TOL);
  expect.soft(Math.abs(h.rightY - h.midY), `${tag} 가장 오른쪽 점이 두 끝점의 한가운데 높이다(지름이 세로) · 실제 ${h.rightY} 대 ${h.midY}`).toBeLessThanOrEqual(HALF_TOL);
  expect.soft(Math.abs(h.len - Math.PI * h.R), `${tag} 호 길이 = πR(${(Math.PI * h.R).toFixed(1)}) · 실제 ${h.len}`).toBeLessThanOrEqual(HALF_TOL);
  // 잘려 숨은 길이 0 — 호 전체가 스테이지 · 블럭 사각형 안이고, 스테이지는 넘침을 자르지 않는다
  expect.soft(h.outsidePx, `${tag} 스테이지 · 블럭 사각형 밖에 놓인 호 길이 px`).toBe(0);
  expect.soft(h.stageOverflow, `${tag} 스테이지 overflow`).toBe('visible');
  // 그 꼴이 «기본값»에서 온다 — 맞추기가 조용히 밀거나 줄여서 나온 꼴이 아니다
  expect.soft([h.startDeg, h.endDeg, h.centerX, h.lineExtend], `${tag} 시작 · 끝 · 원 중심 X · 선 연장`).toEqual(['-90', '90', '0', '0']);
  expect.soft(h.cx, `${tag} 원 중심 x(스테이지 좌표) = 0`).toBe(0);
  expect.soft(h.shift, `${tag} 원 중심을 밀지 않았다`).toBe(0);
  expect.soft(h.shrunk, `${tag} 반지름을 줄이지 않았다`).toBe(0);
  expect.soft(h.R, `${tag} 그린 반지름 = 설정 반지름`).toBe(h.wantR);
  expect.soft(h.fit, `${tag} 가로로 들어왔다`).toBe('1');
  expect.soft(h.cap, `${tag} 선 끝이 끝점에서 멎는다`).toBe('butt');
  // 끝점이 위 · 아래 변에 닿지 않는다 — 스테이지 안에서 위 · 아래로 여유가 있다
  expect.soft(h.stageH - 2 * h.R, `${tag} 스테이지 높이 − 지름(위 · 아래 여유의 합)`).toBeGreaterThanOrEqual(16);
}
const worstOf = (o) => Math.max(o.worst.top, o.worst.bottom, o.worst.left, o.worst.right, o.stageOut);
const itemsOf = (page, id) => page.evaluate((bid) => JSON.parse(document.getElementById(bid).dataset.items).map((it) => (typeof it.deg === 'number' ? it.deg : null)), id);

/** 항목 i 의 점(칸) 한가운데 화면 좌표 + 원 중심 화면 좌표 — 자리가 멈춘 뒤에 잰다. */
async function cellPoint(page, id, i) {
  const sel = `#${id} .rdl-item[data-rdl-idx="${i}"] .rdl-cell`;
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }), sel);
  await waitStableRect(page, sel);
  return page.evaluate(([bid, s]) => {
    const st = document.querySelector(`#${bid} > .rdl-stage`), cell = document.querySelector(s);
    const S = st.getBoundingClientRect(), k = S.width / st.offsetWidth, c = cell.getBoundingClientRect();
    const sx = c.left + c.width / 2, sy = c.top + c.height / 2;
    const scx = S.left + Number(st.dataset.rdlCx) * k, scy = S.top + Number(st.dataset.rdlCy) * k;
    const hit = document.elementFromPoint(sx, sy);
    return { sx, sy, scx, scy, Rk: Number(st.dataset.rdlR) * k, ang: Math.atan2(sy - scy, sx - scx) * 180 / Math.PI, onItem: !!(hit && hit.closest(`#${bid} .rdl-item`) === cell.parentElement) };
  }, [id, sel]);
}
/** 실제 마우스로 항목 i 를 고른 뒤 원 둘레를 따라 toDeg 까지 끈다. */
async function dragItemTo(page, id, i, toDeg) {
  let p = await cellPoint(page, id, i);
  expect(p.onItem, `전제: 누르는 점이 항목 ${i} 위다`).toBe(true);
  await page.mouse.click(p.sx, p.sy);   // 첫 클릭 = 고르기
  await expect.poll(() => page.evaluate((bid) => { const b = document.getElementById(bid); return b.classList.contains('selected') ? b._rdlSel : 'unselected'; }, id), `전제: 항목 ${i} 가 골라졌다`).toBe(i);
  p = await cellPoint(page, id, i);
  expect(p.onItem, `전제: 끌기 시작점이 항목 ${i} 위다`).toBe(true);
  await page.mouse.move(p.sx, p.sy);
  await page.mouse.down();
  for (let s = 1; s <= 10; s++) {
    const a = (p.ang + (toDeg - p.ang) * s / 10) * Math.PI / 180;
    await page.mouse.move(p.scx + p.Rk * Math.cos(a), p.scy + p.Rk * Math.sin(a));
  }
  await page.mouse.up();
  await expect.poll(async () => { const d = (await itemsOf(page, id))[i]; return d === null ? 'none' : Math.abs(d - toDeg) <= 2; }, `전제: 항목 ${i} 가 ${toDeg}° 로 끌렸다`).toBe(true);
}

test.describe('방사형 에셋 블럭 — 호 모드: 기본 꼴 = 반원 · 잘리지 않는다 (V4)', () => {
  test('RC0 전제 — 데모의 호 블럭 하나와 원 블럭 하나가 그려졌다 · 오류 0', async ({ page }) => {
    const errs = await bootWithDemos(page);
    const info = await page.evaluate((ids) => ids.map((id) => {
      const b = document.getElementById(id);
      return { id, shape: b.dataset.shape, items: b.querySelectorAll('.rdl-item').length, count: Number(b.dataset.count), arcStage: !!b.querySelector('.rdl-stage--arc') };
    }), [...ARC_IDS, CIRCLE_ID]);
    for (const i of info) {
      expect(i.items, `${i.id} 항목 수`).toBe(i.count);
      expect(i.arcStage, `${i.id} 호 스테이지`).toBe(i.shape === 'arc');
    }
    expect(info.filter((i) => i.shape === 'arc').length).toBe(1);
    expect(info.filter((i) => i.shape === 'circle').length).toBe(1);
    expect(await page.evaluate(() => document.querySelectorAll('#canvas .radial-block').length), '캔버스의 방사형 블럭 수 = 데모 둘').toBe(2);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('RC1 데모 호 블럭 — 호 선 · 점 · 라벨이 스테이지 안, 스테이지가 블럭 안', async ({ page }) => {
    await bootWithDemos(page);
    for (const id of ARC_IDS) {
      const o = await overflowOf(page, id);
      expect(o.counts.line, `${id} 전제: 호 선이 있다`).toBe(1);
      expect(o.counts.cell, `${id} 전제: 점/칸이 있다`).toBeGreaterThanOrEqual(3);
      expect(o.counts.label, `${id} 전제: 라벨이 있다`).toBeGreaterThanOrEqual(3);
      expect(o.fit, `${id} 가로로 들어왔다`).toBe('1');
      expectContained(o, id);
      // 자르기에 기대지 않는다 — 넘침 0 이 «잘려서 0»이 아니다
      expect(o.stageOverflow, `${id} 스테이지 overflow`).toBe('visible');
    }
  });

  test('RC2 호 선이 온전하다 — path 길이 = 반지름 × 구간, 양 끝점이 svg 상자 안', async ({ page }) => {
    await bootWithDemos(page);
    const want = { [ARC_ID]: 180 };
    for (const id of ARC_IDS) {
      const m = await page.evaluate((bid) => {
        const stage = document.querySelector(`#${bid} > .rdl-stage`), line = stage.querySelector('.rdl-line'), svg = stage.querySelector('svg');
        const len = line.getTotalLength(), a = line.getPointAtLength(0), b = line.getPointAtLength(len);
        const [, , vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
        return { len, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, vw, vh, R: Number(stage.dataset.rdlR), H: stage.offsetHeight };
      }, id);
      expect(m.R, `${id} 전제: 반지름`).toBeGreaterThan(0);
      const expectLen = m.R * want[id] * Math.PI / 180;
      expect(Math.abs(m.len - expectLen), `${id} 호 길이 — 기대 ${expectLen.toFixed(1)} · 실제 ${m.len.toFixed(1)}`).toBeLessThanOrEqual(1.5);
      expect(m.vh, `${id} svg 상자 높이 = 스테이지 높이`).toBe(m.H);
      for (const p of [m.a, m.b]) {
        // 반원의 끝점은 svg 상자의 왼쪽 변(x = 0) 위다 — path 길이 표본의 소수 오차만큼만 봐준다
        expect(p.x, `${id} 끝점 x`).toBeGreaterThanOrEqual(-0.05); expect(p.x).toBeLessThanOrEqual(m.vw);
        expect(p.y, `${id} 끝점 y`).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(m.vh);
      }
      // 데모 판 — 라벨이 호 선 위에 얹히지 않는다(호를 2000 등분해 찍은 점 가운데 라벨 사각형 안에 든 길이 · 레이아웃 px)
      const on = await page.evaluate((bid) => {
        const stage = document.querySelector(`#${bid} > .rdl-stage`), line = stage.querySelector('.rdl-line');
        const S = stage.getBoundingClientRect(), k = S.width / stage.offsetWidth;
        const labels = [...stage.querySelectorAll('.rdl-label')].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
          .map((r) => ({ x0: (r.left - S.left) / k, x1: (r.right - S.left) / k, y0: (r.top - S.top) / k, y1: (r.bottom - S.top) / k }));
        const len = line.getTotalLength(), N = 2000;
        let n = 0;
        for (let i = 0; i <= N; i++) { const p = line.getPointAtLength(len * i / N); if (labels.some((l) => p.x > l.x0 && p.x < l.x1 && p.y > l.y0 && p.y < l.y1)) n++; }
        return { labels: labels.length, px: len * n / (N + 1) };
      }, id);
      expect(on.labels, `${id} 전제: 라벨이 있다`).toBeGreaterThanOrEqual(3);
      expect(on.px, `${id} 라벨 밑으로 지나가는 호 길이 px`).toBeLessThanOrEqual(1);
    }
  });

  test('RC3 설정을 바꿔도 따라간다 — 끝 각도 · 선 연장 · 항목 수 · 라벨 폭 · 반지름', async ({ page }) => {
    const errs = await bootWithDemos(page);
    const id = 'rdl_pz6aarc';
    const set = (patch) => page.evaluate(([bid, p]) => {
      const b = document.getElementById(bid);
      Object.assign(b.dataset, p);
      window.renderRadialBlock(b);
    }, [id, patch]);
    // V3 판 ① 의 설정(좁은 각도 · 선 연장 · 원 중심이 왼쪽 바깥)을 입힌다 — 데모는 이제 기본 반원이라 여기서 바꾼다
    await set({ radius: '542', startDeg: '-38', endDeg: '38', centerX: '-11', lineExtend: '20', labelSize: '26', labelGap: '44', labelWidth: '300' });
    const base = await overflowOf(page, id);
    expect(base.R, '전제: 반지름 542 그대로').toBe(542);
    expect(base.counts.line, '전제: 호 선이 있다').toBe(1);
    expect(base.counts.label, '전제: 라벨 셋').toBe(3);
    expectContained(base, '처음');

    await set({ endDeg: '85', lineExtend: '60' });
    const a = await overflowOf(page, id);
    expectContained(a, '끝 각도 85 · 선 연장 60');
    expect(a.fit, '끝 각도 85 · 선 연장 60 — 가로로 들어왔다').toBe('1');
    // 호가 길어지면 폭이 먼저 모자란다 ⇒ 반지름을 줄여 맞춘다(그러면 높이는 오히려 줄 수 있다). 폭이 남으면 높이가 는다 — 둘 중 하나는 일어난다.
    expect(a.R < base.R || a.H > base.H, `반지름이 줄었거나(${base.R} → ${a.R}) 높이가 늘었다(${base.H} → ${a.H})`).toBe(true);

    await set({ startDeg: '-170', endDeg: '170', lineExtend: '0' });
    const wide = await overflowOf(page, id);
    expectContained(wide, '−170~170');
    expect(wide.fit).toBe('1');
    expect(wide.shrunk, '폭보다 큰 원 — 반지름을 줄였다').toBeGreaterThan(0);
    expect(wide.R).toBeLessThan(542);

    await set({ startDeg: '-38', endDeg: '38', lineExtend: '20', labelWidth: '480', labelGap: '60', radius: '800' });
    const big = await overflowOf(page, id);
    expectContained(big, '반지름 800 · 라벨 폭 480');

    await set({ radius: '300', labelWidth: '200', count: '9', items: JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ label: `항목 ${i + 1}`, img: '' }))) });
    const many = await overflowOf(page, id);
    expect(many.counts.cell).toBe(9);
    expectContained(many, '항목 9');

    await set({ centerX: '-100' });
    const pushed = await overflowOf(page, id);
    expectContained(pushed, '원 중심 X −100%');
    expect(pushed.shift, '들어올 만큼 오른쪽으로 밀었다').toBeGreaterThan(0);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('RC4 온 원 모드는 V2 식 그대로 — 스테이지 치수 · 점 좌표', async ({ page }) => {
    await bootWithDemos(page);
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid), stage = b.querySelector(':scope > .rdl-stage');
      return {
        avail: b.clientWidth, w: stage.style.width, h: stage.style.height, overflow: stage.style.overflow,
        fitAttr: stage.hasAttribute('data-rdl-fit'), R: Number(stage.dataset.rdlR), cx: Number(stage.dataset.rdlCx), cy: Number(stage.dataset.rdlCy),
        items: [...stage.querySelectorAll('.rdl-item')].map((el) => [parseFloat(el.style.left), parseFloat(el.style.top)]),
      };
    }, CIRCLE_ID);
    expect(m.avail, '전제: 블럭 폭').toBeGreaterThan(300);
    // V2(b67106ab) 원 가지의 식 — 점 18(V4 데모는 그림 칸 대신 점) · 라벨 「아래」 · 간격 10 · 글자 16 · 반지름 250
    const cell = 18, half = 9, gap = 10, fs16 = 16, want = 250;
    const wantX = Math.max(8, (Math.max(cell + 40, 120) - cell) / 2);
    const R = Math.min(want, Math.max(40, Math.floor(m.avail / 2 - half - 8)));
    const padX = Math.max(8, Math.min(wantX, Math.floor(m.avail / 2 - half - R)));
    const W = Math.round(2 * (R + half + padX)), H = Math.round(8 + 2 * (R + half) + Math.round(gap + fs16 * 2.6));
    expect(m.fitAttr, '원 모드에는 호 맞춤 표식이 없다').toBe(false);
    expect(m.R).toBe(R);
    expect(m.w).toBe(`${W}px`); expect(m.h).toBe(`${H}px`);
    expect(m.cx).toBe(W / 2); expect(m.cy).toBe(8 + R + half);
    expect(m.items.length).toBe(6);
    m.items.forEach(([l, t], i) => {
      const a = (-90 + 60 * i) * Math.PI / 180;
      expect(Math.abs(l - (W / 2 + R * Math.cos(a) - half)), `점 ${i} left`).toBeLessThanOrEqual(0.02);
      expect(Math.abs(t - (8 + R + half + R * Math.sin(a) - half)), `점 ${i} top`).toBeLessThanOrEqual(0.02);
    });
  });

  test('RC5 데모 화면 — 선풍기 그림 0 · 「V4 반원」 표시 · 옛 이름 0(메뉴 풍선말 포함)', async ({ page }) => {
    await bootWithDemos(page);
    const m = await page.evaluate(() => {
      const sec = document.getElementById('sec_pz6aarc');
      return {
        fan: sec.querySelectorAll('[data-radial-center="fan"]').length,
        fanData: sec.querySelectorAll('.radial-block[data-center-img="fan"]').length,
        label: sec.querySelector('.section-label').textContent,
        text: sec.innerText,
        oldTitles: [...document.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).filter((t) => /Z\s?-?6/i.test(t)),
        protoTitles: [...document.querySelectorAll('.fp-menu-item[title]')].map((e) => e.getAttribute('title')).filter((t) => t.includes('방사형 에셋 블럭')).length,
      };
    });
    expect(m.fan, '선풍기 그림').toBe(0);
    expect(m.fanData, '선풍기 설정').toBe(0);
    expect(m.label).toContain('V4 반원');
    expect(m.text).toContain('V4 반원');
    expect(/V3/.test(m.text), '옛 판 표시가 남지 않았다').toBe(false);
    expect(/Z6/i.test(m.text), '화면 글자에 옛 이름이 없다').toBe(false);
    /* ★261020 1020t2e1: 삽입 메뉴가 ★셋 → ★하나가 됐다(Proto: Graph·Radial / Proto: Radial Arrange 제거).
     * ★기대값 1 의 출처 = ★실브라우저 실측(남은 버튼 title 「방사형 에셋 블럭」 ★하나 · 앱의 제 문으로 눌러 ×3).
     * ⚠️이 spec ★자체는 그 변경 때 ★못 돌렸다(srv swap 98% · DOM 전수 금지) ⇒ ★인텔에서 재는 것이 ★남았다. */
    expect(m.protoTitles, '전제: 방사형 삽입 메뉴의 풍선말이 ★하나다').toBe(1);
    expect(m.oldTitles, '풍선말에 옛 이름이 없다').toEqual([]);
  });

  test('RC6 폭이 바뀌면 다시 맞춘다 — 항목 끌기 둘 → ⌘Z ×2 → ⇧⌘Z ×2 뒤 넘침 0 · 폭을 줄였다 늘려도 따라온다 · 호보다 좁으면 반지름을 줄인다', async ({ page }) => {
    test.setTimeout(90000);
    const errs = await bootWithDemos(page);
    const id = 'rdl_pz6aarc';
    const fitted = async (bid) => { const o = await overflowOf(page, bid); return { drawnIsBlockW: o.drawnW === o.cw, over: worstOf(o) <= TOL }; };
    const OK = { drawnIsBlockW: true, over: true };

    // 블럭 고르기(오른쪽 위 구석 — 항목이 없는 자리)
    await page.evaluate((bid) => document.getElementById(bid).scrollIntoView({ block: 'center', behavior: 'instant' }), id);
    const br = await waitStableRect(page, '#' + id);
    await page.mouse.click(br.left + br.width - 4, br.top + 3);
    await expect.poll(() => page.evaluate((bid) => document.getElementById(bid).classList.contains('selected'), id), '전제: 블럭이 골라졌다').toBe(true);

    const w0 = (await overflowOf(page, id)).cw;
    expect(await itemsOf(page, id), '전제: 처음엔 개별 각도가 없다').toEqual([null, null, null]);
    // 기본 반원의 항목 셋은 −60° · 0° · 60° 에 선다(끝점을 피한 등분) — 0 번을 −30° 로, 2 번을 80° 로 끈다
    await dragItemTo(page, id, 0, -30);
    await dragItemTo(page, id, 2, 80);
    const after = await itemsOf(page, id);
    expect(after[0] !== null && after[1] === null && after[2] !== null, `전제: 항목 0 · 2 만 끌렸다 ${JSON.stringify(after)}`).toBe(true);

    // ⌘Z ×2 — 걸음마다 한 칸씩 돌아간다(다시 맞추기가 되돌리기 걸음을 먹지 않는다)
    await page.keyboard.press('Meta+z');
    await expect.poll(() => itemsOf(page, id), '⌘Z 1 — 항목 2 의 끌기가 돌아갔다').toEqual([after[0], null, null]);
    const w1 = (await overflowOf(page, id)).cw;
    expect(w1, `전제: 되돌리면 블럭 폭이 바뀐다(섹션 좌우 패딩이 붙는다) — ${w0} → ${w1}`).toBeLessThan(w0);
    await page.keyboard.press('Meta+z');
    await expect.poll(() => itemsOf(page, id), '⌘Z 2 — 항목 0 의 끌기도 돌아갔다').toEqual([null, null, null]);
    // ⇧⌘Z ×2 — 다시 실행 꼬리가 살아 있다
    await page.keyboard.press('Meta+Shift+z');
    await expect.poll(() => itemsOf(page, id), '⇧⌘Z 1').toEqual([after[0], null, null]);
    await page.keyboard.press('Meta+Shift+z');
    await expect.poll(() => itemsOf(page, id), '⇧⌘Z 2 — 끌기 둘이 다 돌아왔다').toEqual(after);
    // 폭이 바뀐 뒤(w0 → w1)의 그림이 새 폭에 맞춰졌다 — 관찰자가 한 프레임 뒤에 다시 그리므로 기다린다
    await expect.poll(() => fitted(id), '⇧⌘Z 뒤: 그림을 맞춘 폭 = 블럭 폭 · 넘침 ≤ 0').toEqual(OK);
    const end = await overflowOf(page, id);
    expect(end.cw, '전제: 폭은 바뀐 채다').toBe(w1);
    expectContained(end, '⌘Z ×2 → ⇧⌘Z ×2 뒤');
    expect(end.fit).toBe('1');

    // 폭을 줄였다 늘린다(같은 블럭 — 다시 실행이 끝나 히스토리 꼭대기다) — 다시 그리라고 부르지 않는다
    const m0 = end;
    expect(m0.cw, '전제: 블럭 폭').toBeGreaterThan(600);
    expect(m0.R, '전제: 반지름 250 그대로').toBe(250);
    const setRowW = (w) => page.evaluate(([bid, ww]) => { document.getElementById(bid).closest('.row').style.width = ww; }, [id, w]);
    await setRowW('500px');
    await expect.poll(async () => (await overflowOf(page, id)).cw, '전제: 블럭 폭이 500 이 됐다').toBe(500);
    await expect.poll(() => fitted(id), '폭 500: 그림을 맞춘 폭 = 블럭 폭 · 넘침 ≤ 0').toEqual(OK);
    const narrow = await overflowOf(page, id);
    expectContained(narrow, '폭 500');
    expect(narrow.fit).toBe('1');
    expect(narrow.R, '폭 500 은 반원(반지름 250)보다 넓다 — 반지름 그대로(V4: 라벨이 먼저 양보한다)').toBe(m0.R);
    // 호보다 좁은 폭 — 반지름을 줄여 담는다(V3 의 «상자에 담기»가 살아 있다). 라벨은 끈다(라벨 폭이 수를 흔들지 않게).
    await page.evaluate((bid) => { const b = document.getElementById(bid); b.dataset.labelPos = 'none'; window.renderRadialBlock(b); }, id);
    await setRowW('200px');
    await expect.poll(async () => (await overflowOf(page, id)).cw, '전제: 블럭 폭이 200 이 됐다').toBe(200);
    await expect.poll(() => fitted(id), '폭 200: 그림을 맞춘 폭 = 블럭 폭 · 넘침 ≤ 0').toEqual(OK);
    const tight = await overflowOf(page, id);
    expect(tight.counts.label, '전제: 라벨을 껐다').toBe(0);
    expectContained(tight, '폭 200');
    expect(tight.fit).toBe('1');
    expect(tight.R, '호보다 좁은 폭 — 반지름을 줄였다').toBeLessThan(m0.R);
    expect(tight.R, '바닥(80) 위다').toBeGreaterThanOrEqual(80);
    await page.evaluate((bid) => { const b = document.getElementById(bid); b.dataset.labelPos = 'outside'; window.renderRadialBlock(b); }, id);
    await setRowW('');
    await expect.poll(async () => (await overflowOf(page, id)).cw, '전제: 블럭 폭이 돌아왔다').toBe(m0.cw);
    await expect.poll(() => fitted(id), '폭을 되돌린 뒤: 그림을 맞춘 폭 = 블럭 폭 · 넘침 ≤ 0').toEqual(OK);
    const back = await overflowOf(page, id);
    expect(back.R, '반지름이 돌아왔다').toBe(m0.R);
    expect(back.H, '높이가 돌아왔다').toBe(m0.H);
    // 온 원 모드는 폭을 보지 않는다 — 좁혀도 그대로(다시 그리라고 부를 때만 바뀐다)
    const circleBefore = await page.evaluate((bid) => document.querySelector(`#${bid} > .rdl-stage`).outerHTML, CIRCLE_ID);
    const circleW = await page.evaluate((bid) => document.getElementById(bid).clientWidth, CIRCLE_ID);
    await page.evaluate((bid) => { document.getElementById(bid).closest('.row').style.width = '420px'; }, CIRCLE_ID);
    await expect.poll(() => page.evaluate((bid) => document.getElementById(bid).clientWidth, CIRCLE_ID), `전제: 원 블럭 폭이 줄었다(${circleW} →)`).toBeLessThan(circleW);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));   // 관찰자가 올 틈(프레임 둘 + 매크로태스크)
    expect(await page.evaluate((bid) => document.querySelector(`#${bid} > .rdl-stage`).outerHTML, CIRCLE_ID), '온 원 모드는 그대로').toBe(circleBefore);
    // 관찰 상태가 저장본에 안 실린다
    const ser = await page.evaluate(() => window.getSerializedCanvas());
    expect(ser.includes('rdl_pz6aarc'), '전제: 저장본에 블럭이 있다').toBe(true);
    expect(/rdlW|_rdl|data-rdl-w(?![a-z])/.test(ser), '저장본에 관찰 상태가 없다').toBe(false);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('RC7 라벨을 화면에서 재서 한 번 더 맞춘다 — 어림보다 큰 라벨: 스테이지 높이 > 어림 높이 · 넘침 0', async ({ page }) => {
    const errs = await bootWithDemos(page);
    const id = 'rdl_pz6aarc';
    const words = '아주 긴 문장 하나를 여러 낱말로 나누어 적으면 줄바꿈이 낱말 단위로 일어난다 그래서 어림보다 줄 수가 많아질 수 있다';
    const m = await page.evaluate(async ([bid, label]) => {
      const mod = await import('/js/blocks/radial-block.js');
      const b = document.getElementById(bid);
      Object.assign(b.dataset, { labelWidth: '60', labelSize: '40', items: JSON.stringify(['leaf', 'sun', 'moon'].map((img) => ({ label, img }))) });
      const st = mod.radialStateOf(b);
      const est = mod.radialLayoutOf(b, st);   // 어림(라벨을 재지 않은 첫 맞춤)
      const estLabelH = mod.radialArcLabelRects(st).map((r) => Math.round(r.y1 - r.y0));
      window.renderRadialBlock(b);
      const stage = b.querySelector(':scope > .rdl-stage');
      return { estH: est.H, estLabelH,
        realLabelH: [...stage.querySelectorAll('.rdl-label')].map((el) => el.offsetHeight), H: stage.offsetHeight };
    }, [id, words]);
    expect(m.realLabelH.length, '전제: 라벨 셋').toBe(3);
    // 전제: 이 설정에서 실제 라벨이 어림보다 크다(낱말 단위 줄바꿈) — 여유 16px 을 넘게 차이 난다 ⇒ 다시 맞추지 않으면 넘친다
    expect(Math.max(...m.realLabelH) - Math.max(...m.estLabelH), `전제: 실측 라벨 높이 − 어림 (실측 ${m.realLabelH} · 어림 ${m.estLabelH})`).toBeGreaterThan(40);
    expect(m.H, `스테이지 높이가 어림 높이(${m.estH})보다 크다 = 재서 다시 맞췄다`).toBeGreaterThan(m.estH);
    const o = await overflowOf(page, id);
    expect(o.counts.label, '전제: 라벨이 그려졌다').toBe(3);
    expectContained(o, '낱말 많은 문장 · 라벨 폭 60 · 글자 40');
    expect(o.fit).toBe('1');
    expect(errs, 'pageerror').toEqual([]);
  });

  /* ══════ V4 — 판정 자 = «반원으로 보이나» ══════ */

  test('RC8 데모 첫 섹션 = 기본 반원 하나 — 끝점 둘이 블럭 왼쪽 변 · y 차 = 2R · 가장 오른쪽 x = R · 잘려 숨은 호 길이 0', async ({ page }) => {
    const errs = await bootWithDemos(page);
    // 전제: 데모 파일에 섹션 하나 · 방사형 블럭 하나(다른 각도 판이 없다) — 파일에서 직접 센다
    const file = fs.readFileSync(path.join(ROOT, 'proto', 'demo-z6-a-arc.html'), 'utf8');
    expect((file.match(/class="section-block"/g) || []).length, '데모 파일의 섹션 수').toBe(1);
    expect((file.match(/class="radial-block"/g) || []).length, '데모 파일의 방사형 블럭 수').toBe(1);
    const sec = await page.evaluate((sid) => {
      const s = document.getElementById(sid);
      const withRadial = [...document.querySelectorAll('#canvas .section-block')].filter((x) => x.querySelector('.radial-block'));
      return { first: withRadial[0] && withRadial[0].id, ids: [...s.querySelectorAll('.radial-block')].map((b) => b.id), label: s.querySelector('.section-label').textContent };
    }, ARC_SEC);
    expect(sec.first, '전제: 방사형 블럭이 든 첫 섹션 = 호 데모').toBe(ARC_SEC);
    expect(sec.ids, '전제: 그 섹션의 방사형 블럭은 하나다').toEqual([ARC_ID]);
    expect(sec.label, '섹션 라벨').toContain('V4 반원');

    const h = await halfOf(page, ARC_ID);
    expect(h.wantR, '전제: 데모 반지름 = 블럭 기본 반지름').toBe(250);
    expectHalfCircle(h, '데모');

    // 항목 — 끝점을 피해 선다: 점 셋의 각도 = −60° · 0° · 60°, 점(옅은 고리 5px 포함)이 블럭 왼쪽 변 안쪽이다
    const dots = await page.evaluate((bid) => {
      const block = document.getElementById(bid), stage = block.querySelector(':scope > .rdl-stage');
      const B = block.getBoundingClientRect(), S = stage.getBoundingClientRect(), k = B.width / block.offsetWidth;
      const cx = Number(stage.dataset.rdlCx), cy = Number(stage.dataset.rdlCy);
      return [...stage.querySelectorAll('.rdl-item .rdl-cell')].map((el) => {
        const r = el.getBoundingClientRect();
        const x = (r.left + r.width / 2 - S.left) / k, y = (r.top + r.height / 2 - S.top) / k;
        return { deg: Math.round(Math.atan2(y - cy, x - cx) * 1800 / Math.PI) / 10, left: Math.round((r.left - B.left) / k * 100) / 100, dot: el.classList.contains('rdl-cell--dot') };
      });
    }, ARC_ID);
    expect(dots.length, '전제: 점 셋').toBe(3);
    expect(dots.every((d) => d.dot), '항목은 점이다').toBe(true);
    dots.forEach((d, i) => {
      expect(Math.abs(d.deg - [-60, 0, 60][i]), `점 ${i} 각도 — 실제 ${d.deg}`).toBeLessThanOrEqual(0.5);
      expect(d.left, `점 ${i} 의 왼쪽 끝이 블럭 왼쪽 변에서 고리(5px)보다 안쪽이다`).toBeGreaterThanOrEqual(5);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('RC9 새로 만든 호 블럭(addRadialBlock) — 같은 세 수 · 데모와 같은 상태(배경만 다르다)', async ({ page }) => {
    const errs = await bootWithDemos(page);
    const made = await page.evaluate(async ([sid, bid]) => {
      const mod = await import('/js/blocks/radial-block.js');
      if (window.deselectAll) window.deselectAll();
      window.selectSection(document.getElementById(sid));
      const before = document.querySelectorAll('#canvas .radial-block').length;
      const r = window.addRadialBlock({ shape: 'arc' });   // 삽입 메뉴가 부르는 함수 — 모양만 호로
      if (!r || !r.block) return { ok: false, before };
      const split = (b) => { const st = { ...mod.radialStateOf(b) }; const bg = st.bg; delete st.bg; return { st, bg }; };
      const fresh = split(r.block), demo = split(document.getElementById(bid));
      return { ok: true, id: r.block.id, before, after: document.querySelectorAll('#canvas .radial-block').length,
        connected: r.block.isConnected, sec: r.block.closest('.section-block') && r.block.closest('.section-block').id,
        fresh: fresh.st, demo: demo.st, freshBg: fresh.bg, demoBg: demo.bg, seen: r.block.dataset.arcSeen };
    }, [ARC_SEC, ARC_ID]);
    expect(made.ok, '전제: 블럭이 만들어졌다').toBe(true);
    expect(made.connected, '전제: 문서에 붙었다').toBe(true);
    expect(made.after, '전제: 방사형 블럭이 하나 늘었다').toBe(made.before + 1);
    expect(made.sec, '전제: 고른 섹션에 들어갔다').toBe(ARC_SEC);
    expect(made.id, '전제: 데모 블럭과 다른 블럭이다').not.toBe(ARC_ID);
    await page.waitForFunction((id) => !!document.querySelector(`#${id} > .rdl-stage--arc`), made.id, { timeout: 15000 });

    const h = await halfOf(page, made.id);
    expect(h.wantR, '전제: 새 호 블럭의 반지름 = 기본 250').toBe(250);
    expectHalfCircle(h, '새 호 블럭');
    // 데모 = 블럭의 기본 모습 그대로(배경색 하나만 데모가 칠했다 — 블럭 변이 보이게)
    expect(made.fresh.marker, '기본 마커 = 점').toBe('dot');
    expect(made.fresh.centerMode, '기본 가운데 = 없음').toBe('none');
    expect(made.fresh.items.map((it) => [it.img, it.svg === undefined]), '기본 항목에 그림 · 아이콘이 없다').toEqual([['', true], ['', true], ['', true]]);
    expect(made.demo, '데모 블럭의 상태 = 새 호 블럭의 상태(배경 제외)').toEqual(made.fresh);
    expect([made.freshBg, made.demoBg], '배경 — 새 블럭은 투명 · 데모만 칠했다').toEqual(['', '#f3f4f6']);
    expect(made.seen, '호로 태어난 블럭은 «처음 바꾸기» 기본값을 다시 입지 않는다').toBe('1');
    expect(errs, 'pageerror').toEqual([]);
  });

  test('RC10 패널 전환 길(원 블럭 → 패널 「호」) — 같은 세 수 · 점 + 글 모습 · 원으로 돌아가면 원의 모습이 돌아온다', async ({ page }) => {
    const errs = await bootWithDemos(page);
    let madeId = '';
    const look = (id) => page.evaluate((bid) => {
      const b = document.getElementById(bid), d = b.dataset;
      return { shape: d.shape, marker: d.marker || 'cell', labelPos: d.labelPos, centerMode: d.centerMode, startDeg: d.startDeg, count: d.count,
        arcStage: !!b.querySelector(':scope > .rdl-stage--arc'), centers: b.querySelectorAll('.rdl-center').length, dots: b.querySelectorAll('.rdl-cell--dot').length, cells: b.querySelectorAll('.rdl-cell').length };
    }, id);
    // 패널을 이 블럭으로 (다시) 열고 그 버튼의 click 배선을 누른다 — 캔버스 클릭이 부르는 showRadialProperties 그대로. 포인터로 누르지는 않는다.
    const press = (btnId) => page.evaluate(([blockId, bid]) => {
      window.showRadialProperties(document.getElementById(blockId));
      const el = document.getElementById(bid);
      if (!el) return false;
      el.click();
      return true;
    }, [madeId, btnId]);
    const made = await page.evaluate((sid) => {
      if (window.deselectAll) window.deselectAll();
      window.selectSection(document.getElementById(sid));
      const r = window.addRadialBlock();   // 삽입 메뉴 「Radial」 이 부르는 꼴 그대로(원 · 261020 전 이름 「Proto: Radial Block」)
      return (r && r.block) ? { id: r.block.id, head: (document.querySelector('#rdl-shape-group') ? 1 : 0) } : null;
    }, CIRCLE_SEC);
    expect(made, '전제: 원 블럭이 만들어졌다').not.toBeNull();
    madeId = made.id;
    expect(made.head, '전제: 패널이 이 블럭으로 열렸다(모양 버튼 묶음이 있다)').toBe(1);
    const c0 = await look(made.id);
    expect([c0.shape, c0.marker, c0.labelPos, c0.centerMode, c0.count], '전제: 원 블럭의 기본 모습').toEqual(['circle', 'cell', 'below', 'text', '6']);

    expect(await press('rdl-shape-arc'), '전제: 「호」 버튼이 있다').toBe(true);
    await expect.poll(async () => (await look(made.id)).arcStage, '호로 바뀌어 다시 그려졌다').toBe(true);
    const a1 = await look(made.id);
    expect([a1.shape, a1.marker, a1.labelPos, a1.centerMode], '호로 처음 바꾸면 점 + 글').toEqual(['arc', 'dot', 'outside', 'none']);
    expect([a1.centers, a1.dots, a1.cells], '가운데 0 · 점 6 · 칸 6(전부 점)').toEqual([0, 6, 6]);
    const h1 = await halfOf(page, made.id);
    expectHalfCircle(h1, '패널 전환');

    // 원으로 돌아가면 원의 모습(그림 칸 · 가운데 글 · 라벨 아래)이 돌아온다
    expect(await press('rdl-shape-circle'), '전제: 「원」 버튼이 있다').toBe(true);
    await expect.poll(async () => (await look(made.id)).shape, '원으로 돌아갔다').toBe('circle');
    const c1 = await look(made.id);
    expect([c1.marker, c1.labelPos, c1.centerMode, c1.startDeg, c1.arcStage, c1.centers, c1.dots], '원의 모습이 돌아왔다').toEqual(['cell', 'below', 'text', '-90', false, 1, 0]);
    // 다시 호로 — 한 번 쓴 호의 꼴이 그대로 돌아온다(여전히 반원)
    expect(await press('rdl-shape-arc'), '전제: 「호」 버튼이 있다(다시)').toBe(true);
    await expect.poll(async () => (await look(made.id)).arcStage, '다시 호').toBe(true);
    const a2 = await look(made.id);
    expect([a2.marker, a2.labelPos, a2.centerMode], '호의 모습이 돌아왔다').toEqual(['dot', 'outside', 'none']);
    expectHalfCircle(await halfOf(page, made.id), '패널 전환(다시 호)');
    expect(errs, 'pageerror').toEqual([]);
  });

  test('RC11 두 데모의 블럭 안 이미지 · 아이콘 · 배경 그림 = 0 — 항목은 점 + 글', async ({ page }) => {
    const errs = await bootWithDemos(page);
    const m = await page.evaluate((secs) => secs.map((sid) => {
      const sec = document.getElementById(sid), inner = sec.querySelector('.section-inner');
      const blocks = [...sec.querySelectorAll('.radial-block')];
      const all = blocks.flatMap((b) => [b, ...b.querySelectorAll('*')]);
      const items = blocks.flatMap((b) => [...b.querySelectorAll('.rdl-item')]);
      return {
        sid, blocks: blocks.length, nodes: all.length,
        img: blocks.reduce((n, b) => n + b.querySelectorAll('img, picture, image, video, canvas, object, embed, iframe').length, 0),
        // 블럭 안의 svg 는 «호/궤도 선» 하나뿐이어야 한다(svg.rdl-lines > path.rdl-line 하나) — 그 밖의 svg = 아이콘 · 그림
        lineSvg: blocks.reduce((n, b) => n + b.querySelectorAll(':scope > .rdl-stage > svg.rdl-lines').length, 0),
        iconSvg: blocks.reduce((n, b) => n + [...b.querySelectorAll('svg')].filter((v) => !v.matches('.rdl-stage > svg.rdl-lines')).length, 0),
        lineSvgKids: blocks.flatMap((b) => [...b.querySelectorAll('svg.rdl-lines > *')].map((v) => `${v.tagName.toLowerCase()}.${v.getAttribute('class')}`)),
        bgImage: all.filter((el) => getComputedStyle(el).backgroundImage !== 'none').length,
        maskOrContent: all.filter((el) => { const c = getComputedStyle(el); return (c.maskImage && c.maskImage !== 'none') || (c.listStyleImage && c.listStyleImage !== 'none'); }).length,
        pics: blocks.reduce((n, b) => n + b.querySelectorAll('.rdl-cell-img, .rdl-label-ico, .rdl-ph, .rdl-center--image, [data-radial-center], [data-rdl-custom]').length, 0),
        dataPics: blocks.reduce((n, b) => n + JSON.parse(b.dataset.items).filter((it) => it.img || it.svg).length + (b.dataset.centerMode === 'image' ? 1 : 0) + (b.dataset.marker === 'dot' ? 0 : 1), 0),
        items: items.length,
        itemKinds: items.map((it) => [...it.children].map((c) => (c.classList.contains('rdl-cell--dot') ? 'dot' : (c.classList.contains('rdl-label') ? 'label' : c.className))).join('+')),
        labelKids: items.map((it) => [...it.querySelector('.rdl-label').children].map((c) => c.className).join('+')),
        emptyLabels: items.filter((it) => !(it.querySelector('.rdl-label-text') || { textContent: '' }).textContent.trim()).length,
        centers: blocks.flatMap((b) => [...b.querySelectorAll('.rdl-center')].map((c) => c.className)),
        innerImgs: inner.querySelectorAll('img').length,
        otherAssets: inner.querySelectorAll('.asset-block, .icon-block, .icon-circle-block, .icon-text-block, .shape-block, .vector-block, .graph-block').length,
      };
    }), [ARC_SEC, CIRCLE_SEC]);
    const wantItems = { [ARC_SEC]: 3, [CIRCLE_SEC]: 6 };
    for (const s of m) {
      expect(s.blocks, `${s.sid} 전제: 방사형 블럭 하나`).toBe(1);
      expect(s.items, `${s.sid} 전제: 항목 수`).toBe(wantItems[s.sid]);
      expect(s.nodes, `${s.sid} 전제: 블럭 안에 그려진 것이 있다`).toBeGreaterThan(s.items * 3);
      expect(s.lineSvg, `${s.sid} 전제: 선 svg 는 하나 있다(그건 세지 않는다)`).toBe(1);
      expect(s.lineSvgKids, `${s.sid} 선 svg 안에는 선 path 하나뿐이다`).toEqual(['path.rdl-line']);
      expect(s.img, `${s.sid} 블럭 안 img 류`).toBe(0);
      expect(s.iconSvg, `${s.sid} 블럭 안 아이콘 svg(선 svg 제외)`).toBe(0);
      expect(s.bgImage, `${s.sid} background-image 를 가진 칸`).toBe(0);
      expect(s.maskOrContent, `${s.sid} mask · list-style 그림을 가진 칸`).toBe(0);
      expect(s.pics, `${s.sid} 칸 그림 · 라벨 아이콘 · 빈 칸 그림 · 가운데 그림`).toBe(0);
      expect(s.dataPics, `${s.sid} 설정에 남은 그림(항목 그림 키 · 가운데 그림 · 그림 칸 마커)`).toBe(0);
      expect(s.itemKinds, `${s.sid} 항목 = 점 + 글`).toEqual(Array(s.items).fill('dot+label'));
      expect(s.labelKids, `${s.sid} 라벨 안에는 글뿐이다`).toEqual(Array(s.items).fill('rdl-label-text'));
      expect(s.emptyLabels, `${s.sid} 글이 빈 항목`).toBe(0);
      expect(s.innerImgs, `${s.sid} 섹션 안 img`).toBe(0);
      expect(s.otherAssets, `${s.sid} 섹션 안의 다른 에셋 블럭`).toBe(0);
    }
    expect(m[0].centers, '호 데모 — 가운데 없음').toEqual([]);
    expect(m[1].centers, '원 데모 — 가운데는 글뿐이다(그림 아님)').toEqual(['rdl-center rdl-center--text']);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('RC12 옆 라벨이 오른쪽 변을 넘으면 반지름보다 라벨 폭을 먼저 죈다 — 반지름 · 세 수 그대로 · 넘침 0 / 바닥까지 죄고도 넘치면 반지름을 줄인다', async ({ page }) => {
    const errs = await bootWithDemos(page);
    const id = ARC_ID;
    const words = '아주 긴 설명 글을 여러 낱말로 나누어 적으면 줄이 바뀐다';
    const narrow = async (w) => {
      await page.evaluate(([bid, ww, label]) => {
        const b = document.getElementById(bid);
        b.dataset.items = JSON.stringify([0, 1, 2].map(() => ({ label, img: '' })));
        b.closest('.row').style.width = ww + 'px';
      }, [id, w, words]);
      await expect.poll(() => page.evaluate((bid) => document.getElementById(bid).clientWidth, id), `전제: 블럭 폭이 ${w} 이 됐다`).toBe(w);
      return page.evaluate((bid) => {
        const b = document.getElementById(bid);
        window.renderRadialBlock(b);
        return [...b.querySelectorAll('.rdl-item .rdl-label')].map((el) => ({ maxW: el.style.maxWidth, w: el.offsetWidth, h: el.offsetHeight }));
      }, id);
    };
    const wide = await page.evaluate((bid) => [...document.getElementById(bid).querySelectorAll('.rdl-item .rdl-label')].map((el) => el.style.maxWidth), id);
    expect(wide, '전제: 넓은 폭에서는 라벨 폭 설정(240) 그대로').toEqual(['240px', '240px', '240px']);

    // 폭 420 — 가운데 항목(0°)의 라벨 자리: 420 − 여유 16 − (R 250 + 점 반 9 + 간격 20) = 125 ⇒ 라벨 폭 240 → 125 (바닥 120 위)
    const l420 = await narrow(420);
    expect(l420.map((l) => l.maxW), '폭 420 — 가운데 라벨만 죄였다').toEqual(['240px', '125px', '240px']);
    expect(l420[1].w, '가운데 라벨의 실제 폭 ≤ 125').toBeLessThanOrEqual(125);
    expect(l420[1].h, '전제: 가운데 라벨이 여러 줄로 접혔다(한 줄 29px)').toBeGreaterThan(50);
    const h420 = await halfOf(page, id);
    expectHalfCircle(h420, '폭 420');
    expect(h420.R, '폭 420 — 반지름 그대로').toBe(250);
    const o420 = await overflowOf(page, id);
    expect(o420.counts.label, '전제: 라벨 셋').toBe(3);
    expectContained(o420, '폭 420');

    // 폭 380 — 남는 자리 85 < 바닥 120 ⇒ 라벨은 120 에서 멎고, 그래도 넘치는 만큼은 반지름이 줄어든다(V3 의 «상자에 담기»)
    const l380 = await narrow(380);
    expect(l380[1].maxW, '폭 380 — 가운데 라벨은 바닥(라벨 폭의 절반 120)에서 멎는다').toBe('120px');
    const o380 = await overflowOf(page, id);
    expectContained(o380, '폭 380');
    expect(o380.fit, '폭 380 — 가로로 들어왔다').toBe('1');
    expect(o380.shrunk, '폭 380 — 반지름을 줄였다').toBeGreaterThan(0);
    expect(o380.R, '폭 380 — 바닥(80) 위다').toBeGreaterThanOrEqual(80);
    expect(errs, 'pageerror').toEqual([]);
  });
});
