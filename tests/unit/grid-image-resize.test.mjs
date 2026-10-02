/* 단위 하네스 — js/grid-cell-resize.js 의 resizeGridImage (그리드 이미지/아이콘 줄 코너 리사이즈, T-C)
 * ★손으로 쓴 모델이 아니라 «실제 소스 파일»을 import 한다(grid-cell-resize.test.mjs 선례와 동일
 *   패턴 — ESM .js 를 package type=commonjs 인 Node 가 못 읽어 바이트 그대로 .mjs 별칭 복사).
 * P6 대조(grid-patchcell-reject.test.js)와 짝 — GRID_LINE_FIELDS 에 widthPct 가 있는지는
 *   거기서 «렌더러가 읽는 것」과의 대조로 이미 지킨다. 여기는 순수함수 resizeGridImage 만 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../../js/grid-cell-resize.js');
const aliasPath = path.join(os.tmpdir(), `grid-cell-resize-img-alias-${process.pid}.mjs`);
fs.copyFileSync(srcPath, aliasPath);
const { resizeGridImage, IMG_MIN_PX, IMG_MIN_PCT, ROW_H_MAX } = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

test('기본: 오른쪽 아래(se)로 끌면 폭·높이 둘 다 커진다', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 50, dy: 30, cellW: 400 });
  assert.ok(r.widthPct > 50, `widthPct=${r.widthPct} — 200/400=50% 에서 커져야 한다`);
  assert.ok(r.height > 100, `height=${r.height} — 100 에서 커져야 한다`);
});

test('기본: 왼쪽 위(nw)로 끌면(음의 방향) 폭·높이 둘 다 줄어든다', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'nw', dx: 40, dy: 20, cellW: 400 });
  // nw: dx>0(오른쪽 이동)은 w 쪽에서 -dx, h 쪽에서 -dy 로 작용
  assert.ok(r.widthPct < 50, `widthPct=${r.widthPct}`);
  assert.ok(r.height < 100, `height=${r.height}`);
});

test('폭 상한 클램프: cellW(=100%)를 넘지 않는다', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 100000, dy: 0, cellW: 400 });
  assert.equal(r.widthPct, 100);
});

test('폭 하한 클램프: cellW 가 충분히 크면 IMG_MIN_PCT(5%)가 진짜 하한이 된다', () => {
  // cellW=1000 → 5% = 50px > IMG_MIN_PX(24px) ⇒ 퍼센트 하한이 이긴다(위 IMG_MIN_PX 케이스와 대칭).
  const r = resizeGridImage({ startW: 500, startH: 100, dir: 'se', dx: -100000, dy: 0, cellW: 1000 });
  assert.equal(r.widthPct, IMG_MIN_PCT);
});

test('폭 하한: cellW 가 작아 IMG_MIN_PCT 계산치가 IMG_MIN_PX 보다 작으면 IMG_MIN_PX 를 하한으로 쓴다', () => {
  // cellW=100 → IMG_MIN_PCT(5%) = 5px < IMG_MIN_PX(24px) → 24px 가 진짜 하한
  const r = resizeGridImage({ startW: 100, startH: 100, dir: 'se', dx: -100000, dy: 0, cellW: 100 });
  const expectedPct = Math.round((IMG_MIN_PX / 100) * 100); // 24/100*100 = 24%
  assert.equal(r.widthPct, expectedPct);
});

test('높이 하한 클램프: IMG_MIN_PX(24px) 밑으로 안 줄어든다', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 0, dy: -100000, cellW: 400 });
  assert.equal(r.height, IMG_MIN_PX);
});

test('높이 상한 클램프: ROW_H_MAX 위로 안 늘어난다(행 드래그와 «같은 상한» — SSOT)', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 0, dy: 1000000, cellW: 400 });
  assert.equal(r.height, ROW_H_MAX);
});

test('Shift(lockAspect): 종횡비를 고정한 채 더 큰 델타 축을 따라간다', () => {
  // aspect = 2 (가로가 세로의 2배). 가로 델타가 더 크면 가로 기준으로 세로를 유도한다.
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 40, dy: 5, cellW: 400, aspect: 2, lockAspect: true });
  assert.equal(Math.round(r.widthPct * 400 / 100 / r.height * 100) / 100, 2, `비율이 안 지켜졌다: widthPct=${r.widthPct}, height=${r.height}`);
});

test('Shift(lockAspect): 세로 델타가 더 크면 세로 기준으로 가로를 유도한다', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 5, dy: 40, cellW: 400, aspect: 2, lockAspect: true });
  const wPx = r.widthPct * 400 / 100;
  assert.equal(Math.round(wPx / r.height * 100) / 100, 2, `비율이 안 지켜졌다: widthPct=${r.widthPct}, height=${r.height}`);
});

test('Shift(lockAspect)도 폭 상한(cellW)을 넘지 않는다', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 100000, dy: 0, cellW: 400, aspect: 2, lockAspect: true });
  assert.ok(r.widthPct <= 100, `widthPct=${r.widthPct} 가 100 을 넘었다`);
});

test('반환 계약: widthPct 와 height 두 키만 돌려준다', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 10, dy: 10, cellW: 400 });
  assert.deepEqual(Object.keys(r).sort(), ['height', 'widthPct']);
  assert.equal(Number.isInteger(r.widthPct), true);
  assert.equal(Number.isInteger(r.height), true);
});

test('가드: dx/dy 가 NaN/Infinity 여도 결과를 망가뜨리지 않는다(항상 유한수)', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined]) {
    const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: bad, dy: bad, cellW: 400 });
    assert.equal(Number.isFinite(r.widthPct), true, `dx/dy=${String(bad)} 에서 widthPct 가 유한수가 아니다`);
    assert.equal(Number.isFinite(r.height), true, `dx/dy=${String(bad)} 에서 height 가 유한수가 아니다`);
  }
});

test('가드: cellW 가 0/음수/NaN 이어도 나눗셈이 깨지지 않는다', () => {
  for (const bad of [0, -100, NaN, undefined]) {
    const r = resizeGridImage({ startW: 20, startH: 10, dir: 'se', dx: 5, dy: 5, cellW: bad });
    assert.equal(Number.isFinite(r.widthPct), true, `cellW=${String(bad)}`);
    assert.equal(Number.isFinite(r.height), true, `cellW=${String(bad)}`);
  }
});

test('델타 0 은 시작 크기를 그대로 보존한다(반올림 오차 허용)', () => {
  const r = resizeGridImage({ startW: 200, startH: 100, dir: 'se', dx: 0, dy: 0, cellW: 400 });
  assert.equal(r.widthPct, 50);
  assert.equal(r.height, 100);
});

test('방향(dir)별 부호: e/w 는 폭만, n/s 는 높이만 바꾼다(자유 비율, lockAspect 없음)', () => {
  const base = { startW: 200, startH: 100, cellW: 400 };
  const e = resizeGridImage({ ...base, dir: 'ne', dx: 40, dy: 40 });
  // ne: e→+dx(폭 증가), n→-dy(위로 끌면 높이 증가, 아래로 끌면 감소) — dy=40(아래) ⇒ 높이 감소
  assert.ok(e.widthPct > 50);
  assert.ok(e.height < 100);
});
