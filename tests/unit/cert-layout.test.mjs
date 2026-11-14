/* cert-layout.test.mjs — js/blocks/cert-layout.js (인증서 블럭 A · 261114) · 글을 읽어 export 만 걷고 돌린다(루트 commonjs)
 *   L1 s17 4장 — 장마다 각도·위치가 다르다(대칭 부채 아님: 각도 모두 다름 · 좌우 대칭 아님) · 서로 겹친다(이웃 종이 상자 교차)
 *   L2 지시선 — 위쪽 글이면 종이 위끝에서 위로 · 아래 글이면 아래끝에서 아래로 · 세로선(x 같음) · 모든 좌표 ≥ 0 · 높이 안
 *   L3 시드 — 같은 시드·같은 입력 = 같은 배치 · jitter>0 이면 시드가 다르면 다르다 · jitter 0 이면 시드 무관(프리셋 그대로)
 *   L4 장 수 1~CERT_MAX_SHEETS(8 · ⑨) · 프리셋과 수가 다르면 auto · 상한 = 상수 · 위/아래 번갈아
 *   L9 용지 높이(⑫ ratio) — 없으면 A4 · 0.6/2.0 에서 h = w×ratio · 8장 모든 배치 가로·세로 밖 0 · gridLayout 도 같은 값
 *   L8 4·6·7·8장(⑨) — 모든 배치(fan·s17·stair·pile·auto · 흩뿌림 0/1)에서 가로 밖 0 · 위·아래 밖 0(높이 안) · 부채는 이웃 겹침·각도 단조
 *   L5 gridLayout — 열·간격대로 · 마지막 줄 가운데 · 높이
 *   L7 labels:false — 높이 = 종이만(콜아웃 끔 · A4 스택 기본) · 켜면 더 크다
 *   L6 fan(기본 · reframe «A4 스택») — 왼→오 각도가 커지고 좌우 대칭 · 이웃끼리 겹친다 · 오른쪽이 위 · 프리셋 미지정 = fan
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const src = readSrc(REPO, 'js/blocks/cert-layout.js');
assert.doesNotMatch(src, /^\s*import\s/m, '★전제: 순수 모듈(import 0)');
const names = [...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
const M = new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();

const box = (s) => ({ l: s.cx - s.w / 2, r: s.cx + s.w / 2, t: s.cy - s.h / 2, b: s.cy + s.h / 2 });
const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

test('L1 s17 — 제각각 각도·위치 · 겹친다', () => {
  const L = M.collageLayout({ n: 4, width: 600, preset: 's17', seed: 1 });
  const rots = L.sheets.map((s) => s.rot);
  assert.equal(new Set(rots).size, 4, '각도가 모두 다르다');
  const xs = L.sheets.map((s) => s.cx).sort((a, b) => a - b);
  assert.notDeepEqual(xs.map((x) => Math.round(600 - x)).sort((a, b) => a - b), xs.map(Math.round), '좌우 대칭이 아니다');
  const overl = L.sheets.some((a, i) => L.sheets.some((b, j) => i < j && hit(box(a), box(b))));
  assert.ok(overl, '서로 겹치는 종이가 있다');
  assert.deepEqual(L.sheets.map((s) => s.side), ['bottom', 'top', 'top', 'bottom']);
  assert.deepEqual([...new Set(L.sheets.map((s) => s.z))].sort(), [1, 2, 3, 4]);
});

test('L2 지시선 — 위/아래 · 세로 · 영역 안', () => {
  const L = M.collageLayout({ n: 4, width: 600, preset: 's17', seed: 1, lineLen: 50, labelH: 48 });
  for (const s of L.sheets) {
    assert.equal(s.line.x, s.cx);
    if (s.side === 'top') { assert.ok(s.line.y2 < s.line.y1); assert.ok(s.line.y1 < s.cy); assert.ok(s.label.y < s.line.y2); assert.ok(s.label.y - 48 >= 0, 'top 글 덩이가 영역 안'); }
    else { assert.ok(s.line.y2 > s.line.y1); assert.ok(s.line.y1 > s.cy); assert.ok(s.label.y > s.line.y2); assert.ok(s.label.y + 48 <= L.height, 'bottom 글 덩이가 영역 안'); }
    assert.ok(Math.abs(s.line.y2 - s.line.y1) >= 46);
  }
  assert.ok(L.sheets.every((s) => s.cy - s.h / 2 > -s.h * 0.2));
});

test('L3 시드 · jitter', () => {
  const a = M.collageLayout({ preset: 's17', seed: 7, jitter: 0.6 });
  assert.deepEqual(M.collageLayout({ preset: 's17', seed: 7, jitter: 0.6 }), a);
  assert.notDeepEqual(M.collageLayout({ preset: 's17', seed: 8, jitter: 0.6 }), a);
  assert.deepEqual(M.collageLayout({ preset: 's17', seed: 1 }).sheets.map((s) => s.rot), M.collageLayout({ preset: 's17', seed: 99 }).sheets.map((s) => s.rot));
  let r = M.seededRandom(3); const v = [r(), r(), r()]; r = M.seededRandom(3);
  assert.deepEqual([r(), r(), r()], v);
  assert.ok(v.every((x) => x >= 0 && x < 1));
});

test('L4 장 수', () => {
  for (const n of [1, 2, 3, 5, 6, 7, 8]) {
    const L = M.collageLayout({ n, preset: 's17', seed: 2 });
    assert.equal(L.sheets.length, n);
    assert.equal(new Set(L.sheets.map((s) => s.z)).size, n);
    assert.ok(L.sheets.every((s) => s.cx - s.w / 2 >= -0.01 && s.cx + s.w / 2 <= 600.01), `n=${n} 가로 안`);
  }
  assert.equal(M.CERT_MAX_SHEETS, 8, '⑨ 상한 8');
  assert.equal(M.collageLayout({ n: 99 }).sheets.length, M.CERT_MAX_SHEETS);
  assert.deepEqual(M.collageLayout({ n: 4, preset: 'auto', seed: 2 }).sheets.map((s) => s.side), ['bottom', 'top', 'bottom', 'top']);
  assert.ok(M.CERT_PRESET_NAMES.includes('auto') && M.CERT_PRESET_NAMES.includes('s17'));
});

test('L5 gridLayout', () => {
  const g = M.gridLayout({ n: 5, width: 600, cols: 3, gap: 12, captionH: 40 });
  assert.equal(g.cells.length, 5);
  const w = (600 - 24) / 3;
  assert.equal(g.cells[0].w, w);
  assert.equal(g.cells[1].x, w + 12);
  const rowH = w * M.CERT_SHEET_RATIO + 40 + 12;
  assert.equal(g.cells[3].y, rowH);
  assert.equal(g.cells[3].x, (w + 12) / 2, '마지막 줄 2칸 = 가운데로 반 칸 민다');
  assert.equal(g.height, Math.ceil(2 * rowH - 12));
});

test('L6 fan — 기본 · 각도 단조·대칭 · 이웃 겹침 · 오른쪽 위', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    const L = M.collageLayout({ n, width: 600 });
    const S = [...L.sheets].sort((a, b) => a.cx - b.cx);
    for (let i = 1; i < n; i++) {
      assert.ok(S[i].rot > S[i - 1].rot, `n=${n} 각도 단조`);
      assert.ok(hit(box(S[i - 1]), box(S[i])), `n=${n} 이웃 ${i - 1}·${i} 겹침`);
      assert.ok(S[i].z > S[i - 1].z, `n=${n} 오른쪽이 위`);
    }
    assert.ok(Math.abs(S[0].rot + S[n - 1].rot) < 1e-9, `n=${n} 좌우 대칭 각`);
  }
  assert.deepEqual(M.collageLayout({ n: 4 }), M.collageLayout({ n: 4, preset: 'fan' }));
  assert.equal(M.CERT_PRESET_NAMES[0], 'fan');
  assert.equal(M.collageLayout({ n: 1 }).sheets[0].rot, 0);
});

test('L7 labels:false — 종이만큼', () => {
  const on = M.collageLayout({ n: 4 }), off = M.collageLayout({ n: 4, labels: false });
  assert.ok(off.height < on.height, `${off.height} < ${on.height}`);
  const ext = Math.max(...off.sheets.map((s) => s.cy + (s.w / 2) * Math.abs(Math.sin(s.rot * Math.PI / 180)) + (s.h / 2) * Math.cos(s.rot * Math.PI / 180)));
  assert.ok(Math.abs(off.height - Math.ceil(ext + 12)) <= 1, `${off.height} vs ${ext}`);
});

test('L8 7·8장 — 모든 배치에서 화면 밖 0', () => {
  for (const n of [4, 6, 7, 8]) for (const preset of M.CERT_PRESET_NAMES) for (const jitter of [0, 1]) for (const labels of [false, true]) {
    const L = M.collageLayout({ n, width: 600, preset, seed: 3, jitter, labels });
    assert.equal(L.sheets.length, n);
    for (const s of L.sheets) {
      const r = Math.abs(s.rot * Math.PI / 180);
      const ex = (s.w / 2) * Math.cos(r) + (s.h / 2) * Math.sin(r), ey = (s.w / 2) * Math.sin(r) + (s.h / 2) * Math.cos(r);
      assert.ok(s.cx - ex >= -0.5 && s.cx + ex <= 600.5, `${preset} n=${n} j=${jitter} 가로 밖(회전한 모서리까지) cx=${s.cx.toFixed(1)}`);
      assert.ok(s.cy - ey >= -0.5 && s.cy + ey <= L.height + 0.5, `${preset} n=${n} 세로 밖`);
    }
  }
});

test('L9 용지 높이 ratio(⑫)', () => {
  const a4 = M.collageLayout({ n: 4, width: 600 }).sheets[0];
  assert.ok(Math.abs(a4.h / a4.w - M.CERT_SHEET_RATIO) < 1e-9, '없으면 A4');
  assert.deepEqual([M.CERT_SHEET_H.min, M.CERT_SHEET_H.max, M.CERT_SHEET_H.def], [60, 200, 141]);
  for (const ratio of [0.6, 2.0]) {
    for (const preset of M.CERT_PRESET_NAMES) for (const labels of [false, true]) {
      const L = M.collageLayout({ n: 8, width: 600, preset, seed: 3, jitter: 1, labels, ratio });
      for (const s of L.sheets) {
        assert.ok(Math.abs(s.h / s.w - ratio) < 1e-9, `${preset} h/w = ${ratio}`);
        const r = Math.abs(s.rot * Math.PI / 180);
        const ex = (s.w / 2) * Math.cos(r) + (s.h / 2) * Math.sin(r), ey = (s.w / 2) * Math.sin(r) + (s.h / 2) * Math.cos(r);
        assert.ok(s.cx - ex >= -0.5 && s.cx + ex <= 600.5, `${preset} r=${ratio} 가로 밖`);
        assert.ok(s.cy - ey >= -0.5 && s.cy + ey <= L.height + 0.5, `${preset} r=${ratio} 세로 밖`);
      }
    }
    const g = M.gridLayout({ n: 4, width: 600, cols: 2, gap: 0, captionH: 0, ratio });
    assert.ok(Math.abs(g.cells[0].h / g.cells[0].w - ratio) < 1e-9, 'gridLayout ratio');
  }
});
