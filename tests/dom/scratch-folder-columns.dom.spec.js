/* scratch-folder-columns.dom.spec.js — ⑵ 「참고 이미지 일괄 추가」가 ★폴더 단위로 칼럼을 나누나
 * (현빈 2026-10-06 「여러폴더를 넣을 시, 한줄로 들어가는데, 폴더단위로, 칼럼나눠서 넣을 수 있지 않니?」)
 *
 * ★양성대조 판 = e7444dd3(고치기 전) → `GD1001_ROOT=<그 판 체크아웃> npx playwright test ...` 로 돌리면
 *   ★빨강이어야 할 것: R1(컬럼 3개) · R2(컬럼 안이 폴더로 뭉친다).
 *   2026-10-06 실측(그 판): 「항목 7 · 서로 다른 x = 1 [960] · y=[0,1820,2350,3310,5130,5660,6620]」
 *   = 컬럼 1개이고 쌓인 순서가 사용샷·모델컷·디테일·사용샷·… 로 ★폴더가 섞였다.
 *   R3·R4 는 ★지키는 검사(옛 판에서도 초록이어야 한다 — 바꾸지 않은 두 길).
 *
 * ★고정물을 왜 «만들어» 쓰나: webkitdirectory 입력은 ★실제 폴더가 있어야 webkitRelativePath 가 찬다
 *   (Playwright setInputFiles(디렉터리) 로 채워지는 것을 2026-10-06 실측). PNG 를 레포에 넣지 않고
 *   ★폴더마다 «다른 비율»로 생성한다 — 그래야 쌓인 «순서»를 displayH 역산으로 ★독립 측정할 수 있다
 *   (파일명이 폴더마다 겹쳐서 이름으로는 못 가린다 — 겹치는 것이 바로 섞임을 만든 조건이다).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { bootApp } = require('./_root-harness.js');
const { mkTmpRoot } = require('../unit/_tmproot.js');   /* ★임시 루트의 ★임자 — ★만들기·치우기를 ★그 자가 쥔다.
      ★잠그는 자 = ★`tests/unit/tmproot-sole-owner.test.mjs` (★`tests/` 전수를 ★걷는다) */

const WIDTH = 860, GAP_Y = 100, START_X = 960, GAP_X = 100;   // js/scratch-pad.js SCRATCH_PLACE
/* 폴더별 비율 → 표시높이. 쌓인 순서를 y 간격에서 역산하는 «표식»이다. */
const SPEC = [
  { dir: '01_모델컷', w: 100, h: 50,  n: 3 },   // displayH 430
  { dir: '02_디테일', w: 100, h: 100, n: 2 },   // displayH 860
  { dir: '03_사용샷', w: 100, h: 200, n: 2 },   // displayH 1720
];
const displayH = (s) => Math.round((s.h / s.w) * WIDTH);

function png(w, h) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : require('zlib').crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8bit truecolor
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 부모폴더 하나 아래에 SPEC 대로 하위폴더·이미지를 만든다. 파일명은 ★폴더마다 겹치게(img1.png …). */
function makeTree(root, specs) {
  fs.mkdirSync(root, { recursive: true });
  for (const s of specs) {
    const d = path.join(root, s.dir);
    fs.mkdirSync(d, { recursive: true });
    for (let i = 1; i <= s.n; i++) fs.writeFileSync(path.join(d, `img${i}.png`), png(s.w, s.h));
  }
  return root;
}

let TMP;
test.beforeAll(() => { TMP = mkTmpRoot('gd-reffolder-'); });
/* ⛔★여기 있던 ★afterAll 치움을 ★뺐다 — ★`mkTmpRoot` 가 ★치우기를 ★쥔다 */

async function setup(page, projectId) {
  await page.setViewportSize({ width: 1500, height: 800 });
  await bootApp(page);
  await page.evaluate(async (pid) => { await window.initScratchPad?.(pid, 'p1'); }, projectId);
  await page.waitForTimeout(300);
}

/** 그 폴더를 「참고 이미지 일괄 추가」 입력에 넣고 끝날 때까지 기다린다(실제 핸들러를 통과시킨다). */
async function pickFolder(page, dir) {
  await page.evaluate(() => {
    const inp = document.getElementById('scratchpad-folder-input');
    inp.removeAttribute('onchange');          // 인라인 핸들러와 두 번 돌지 않게
    window.__done = null;
    inp.addEventListener('change', (e) => { window.__done = window.loadScratchpadFolder(e).then(() => true); }, { once: true });
  });
  await page.setInputFiles('#scratchpad-folder-input', dir);
  await page.waitForFunction(() => window.__done !== null, null, { timeout: 15000 });
  await page.evaluate(() => window.__done);
  await page.waitForTimeout(600);
}

const items = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item')]
  .map(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), h: el.offsetHeight })));
const colsOf = (list) => [...new Set(list.map(i => i.x))].sort((a, b) => a - b);

test('R1 ★하위폴더 3개를 한 번에 넣으면 컬럼 3개 · 폴더별 장수가 맞는다', async ({ page }) => {
  const root = makeTree(path.join(TMP, 'r1'), SPEC);
  await setup(page, 'projR1');
  await pickFolder(page, root);

  const list = await items(page);
  const total = SPEC.reduce((a, s) => a + s.n, 0);
  // ★전제 단언 — 계측기가 실제로 돌았다(한 장도 안 들어갔으면 아래 「컬럼 수」는 무의미하다)
  expect(list.length, `항목 수 (잰 값: ${list.length})`).toBe(total);

  const cols = colsOf(list);
  expect(cols.length, `서로 다른 x = 컬럼 수 (잰 값: ${JSON.stringify(cols)})`).toBe(SPEC.length);
  // 컬럼 x = START_X, +(WIDTH+GAP_X), +2(WIDTH+GAP_X) — 자리 규칙(_scratchNextSlot)이 그대로 돌았는지
  expect(cols).toEqual(SPEC.map((_, i) => START_X + i * (WIDTH + GAP_X)));
  // 폴더 순서(01→02→03)대로 컬럼이 열렸으므로 각 컬럼 장수도 그 순서여야 한다
  expect(cols.map(x => list.filter(i => i.x === x).length)).toEqual(SPEC.map(s => s.n));
});

test('R2 ★컬럼 «안»이 한 폴더로 뭉친다 — 쌓인 높이로 역산(이름이 겹쳐도 가린다)', async ({ page }) => {
  const root = makeTree(path.join(TMP, 'r2'), SPEC);
  await setup(page, 'projR2');
  await pickFolder(page, root);

  const list = await items(page);
  expect(list.length).toBe(SPEC.reduce((a, s) => a + s.n, 0));   // ★전제 단언
  for (const [ci, x] of colsOf(list).entries()) {
    const col = list.filter(i => i.x === x).sort((a, b) => a.y - b.y);
    const want = displayH(SPEC[ci]);
    // ⑴ 그 컬럼의 모든 항목이 «그 폴더의 비율»이다 ⇒ 섞이지 않았다
    expect(col.map(i => i.h), `컬럼${ci} 높이들 (잰 값: ${JSON.stringify(col.map(i => i.h))}, 기대 ${want})`)
      .toEqual(col.map(() => want));
    // ⑵ 세로 간격 = displayH + GAP_Y (쌓기 규칙)
    for (let k = 1; k < col.length; k++) {
      expect(col[k].y - col[k - 1].y, `컬럼${ci} 간격 #${k}`).toBe(want + GAP_Y);
    }
    expect(col[0].y, `컬럼${ci} 첫 항목 y`).toBe(0);
  }
});

test('R3 ★지키는 검사 — 하위폴더 «없는» 폴더는 옛 그대로 컬럼 1개', async ({ page }) => {
  const root = makeTree(path.join(TMP, 'r3'), [{ dir: 'flat', w: 100, h: 50, n: 3 }]);
  await setup(page, 'projR3');
  await pickFolder(page, path.join(root, 'flat'));

  const list = await items(page);
  expect(list.length).toBe(3);
  expect(colsOf(list)).toEqual([START_X]);
  const col = list.sort((a, b) => a.y - b.y);
  expect(col.map(i => i.y)).toEqual([0, 430 + GAP_Y, (430 + GAP_Y) * 2]);
});

test('R4 ★지키는 검사 — 폴더를 두 번 따로 넣으면 컬럼 2개(옛 판에서도 되던 길)', async ({ page }) => {
  const root = makeTree(path.join(TMP, 'r4'), SPEC);
  await setup(page, 'projR4');
  await pickFolder(page, path.join(root, SPEC[0].dir));
  expect(colsOf(await items(page))).toEqual([START_X]);
  await pickFolder(page, path.join(root, SPEC[1].dir));

  const list = await items(page);
  expect(list.length).toBe(SPEC[0].n + SPEC[1].n);
  expect(colsOf(list)).toEqual([START_X, START_X + WIDTH + GAP_X]);
});
