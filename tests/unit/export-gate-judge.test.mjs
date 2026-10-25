/* 단위 — js/io/export-gate-core.js 의 «유일한 판정 술어» judgeExportDiff + 비교기 compareRGBA.
 *
 * ★이 파일의 이름이 지키겠다고 한 것: 「내보내기 검사가 사용자에게 무엇을 말하는가」.
 *   그래서 본문은 tier 를 «직접» 본다 — 내부 수치가 맞는지가 아니라, 그 수치로 사용자에게
 *   무슨 말이 나가는지를 잰다.
 * ★회귀 유효성은 «변이»로 확인했다(IMPL-export-gate.md ⑤). 초록만 보는 테스트는 무의미하다.
 *   ⛔실제 소스 파일을 import 한다 — 손으로 쓴 모델을 테스트하면 소스가 바뀌어도 안 깨진다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkTmpRoot } from './_tmproot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../../js/io/export-gate-core.js');
/* ★★261025 (t6-01) — ★사본을 ★«제 폴더»에 둔다. ★까닭 :
     ★`export-gate-core.js` 가 ★곁 모듈을 ★수입하게 됐다(`./export-formats.js` — ★꼴 명부 정본).
     ★예전처럼 ★`os.tmpdir()` 바닥에 ★한 파일만 ★베끼면 ★그 ★상대경로 수입이 ★깨진다
     (실측: `ERR_MODULE_NOT_FOUND … /T/export-formats.js`).
   ⇒ ★폴더를 ★하나 만들어 ★«수입하는 곁 파일까지» ★같이 베낀다.
     ⛔곁 파일을 ★손으로 ★열거하지 ★마라 — ★소스의 ★`from './…'` 를 ★읽어 ★따라간다(한 겹). */
const aliasDir = mkTmpRoot('exgate-core-');   /* ★치우기는 공용 자가 쥔다 — ⛔손으로 rmSync 금지(T2) */
const aliasPath = path.join(aliasDir, 'export-gate-core.mjs');
{
  const _src = fs.readFileSync(srcPath, 'utf8');
  const _sibs = [..._src.matchAll(/from\s+'\.\/([A-Za-z0-9._-]+)\.js'/g)].map(m => m[1]);
  for (const name of new Set(_sibs)) {
    fs.copyFileSync(path.join(path.dirname(srcPath), name + '.js'), path.join(aliasDir, name + '.js'));
  }
  /* ★사본은 ★.mjs 라 ★곁 수입도 ★.js 그대로 두면 ★CJS 로 읽힌다 ⇒ ★곁도 .mjs 로 베끼고 경로를 갈아끼운다 */
  for (const name of new Set(_sibs)) {
    fs.renameSync(path.join(aliasDir, name + '.js'), path.join(aliasDir, name + '.mjs'));
  }
  fs.writeFileSync(aliasPath, _src.replace(/from\s+'\.\/([A-Za-z0-9._-]+)\.js'/g, "from './$1.mjs'"));
}
const core = await import(pathToFileURL(aliasPath).href);
const { judgeExportDiff, compareRGBA, pilLuma, _setBlobMin } = core;

const img = (w, h, fill) => {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i*4] = fill[0]; data[i*4+1] = fill[1]; data[i*4+2] = fill[2]; data[i*4+3] = 255; }
  return { width: w, height: h, data };
};
const put = (im, x0, y0, w, h, c) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const i = (y * im.width + x) * 4; im.data[i]=c[0]; im.data[i+1]=c[1]; im.data[i+2]=c[2];
  }
};


const OK = { native: true, format: 'png', imgTimedOut: false, captureError: false, repro: null };
const M = (o = {}) => ({ measured: true, sizeMismatch: false, bandMismatch: false,
  total: 0, maxCell: 0, blobPx: 0, bandCount: 3, truthBandCount: 3, struct: 'PASS', ...o });

/* ── 등급 ───────────────────────────────────────────────────────────────── */
test('same — 다른 픽셀이 «정확히 0» 일 때만', () => {
  assert.equal(judgeExportDiff(M(), OK).tier, 'same');
});

test('minor — 픽셀은 다르지만 구조·면 위반이 없다 ⇒ 사용자에게 «문제»라고 말하지 않는다', () => {
  /* ★근거: 기준선 22행 중 2행(banner02 힌팅)이 TOTAL 3,960 / 19,972 인데 «같은 그림»이다.
     이 축을 그대로 노출하면 banner02 를 쓰는 모든 클라이언트에게 「실패」가 뜬다. */
  const v = judgeExportDiff(M({ total: 19972, maxCell: 220 }), OK);
  assert.equal(v.tier, 'minor');
  assert.deepEqual(v.reasons, []);
});

test('mismatch — 크기 불일치는 «그 자체로» 확인 대상(잘림/여백)', () => {
  const v = judgeExportDiff(M({ sizeMismatch: true, total: null }), OK);
  assert.equal(v.tier, 'mismatch');
  assert.ok(v.reasons.includes('sizeMismatch'));
});

test('★줄 밴드 «개수» 불일치는 P0 에서 사용자에게 말하지 «않는다» — 오탐이 실측됐다', () => {
  /* [실측 2026-09-05] 코퍼스 sec_84a7j_wc4zr06 @780 이 정상인데 밴드 17 vs 16 으로 뜬다.
     5/5 완전 재현 · truth 안정(diff 0) ⇒ 재검사로도 안 걸러지는 «진짜 오탐».
     플랜 §5 에 «미리» 박아 둔 규칙(음성 1건이라도 나오면 그 축을 뺀다)에 걸려 뺐다.
     ⛔이 테스트를 「밴드가 다르면 mismatch」로 되돌리려거든, 그 오탐부터 없애고 와라. */
  const v = judgeExportDiff(M({ total: 500, bandMismatch: true, bandCount: 4, truthBandCount: 3 }), OK);
  assert.equal(v.tier, 'minor');
  assert.deepEqual(v.reasons, []);
});

test('그래도 «값은 잰다» — bandCount/truthBandCount 는 로그에 남아 P1 이 다시 볼 수 있다', () => {
  const a = img(60, 60, [250, 250, 250]);
  put(a, 5, 10, 50, 6, [0,0,0]); put(a, 5, 30, 50, 6, [0,0,0]); put(a, 5, 48, 50, 6, [0,0,0]);
  const b = img(60, 60, [250, 250, 250]);
  put(b, 5, 10, 50, 6, [0,0,0]); put(b, 5, 30, 50, 6, [0,0,0]);
  const m = compareRGBA(a, b);
  assert.equal(m.bandCount, 3);
  assert.equal(m.truthBandCount, 2);
  assert.equal(m.bandMismatch, true, '측정은 계속한다 — 판정에만 안 쓴다');
});

test('mismatch — blob 축은 «켜져 있을 때만» 말한다(기본 Infinity = 꺼짐)', () => {
  const m = M({ total: 5000, blobPx: 4000 });
  assert.equal(judgeExportDiff(m, OK).tier, 'minor', '기본값에서는 blob 으로 «문제»라고 말하지 않는다');
  _setBlobMin(1000);
  try {
    const v = judgeExportDiff(m, OK);
    assert.equal(v.tier, 'mismatch');
    assert.ok(v.reasons.includes('blob'));
    assert.equal(judgeExportDiff(M({ total: 5000, blobPx: 999 }), OK).tier, 'minor', '임계 미만은 minor');
  } finally { _setBlobMin(Infinity); }
});

/* ── «못 쟀다» — PASS 로도 FAIL 로도 세지 않는다 ─────────────────────────── */
test('unmeasured — 웹 빌드(native 아님)', () => {
  assert.equal(judgeExportDiff(M(), { ...OK, native: false }).tier, 'unmeasured');
});
test('unmeasured — GIF(정적·애니 둘 다) 는 팔레트 양자화라 이 판정기의 축이 아니다', () => {
  assert.equal(judgeExportDiff(M(), { ...OK, format: 'gif' }).tier, 'unmeasured');
  assert.equal(judgeExportDiff(M(), { ...OK, format: 'gif-anim' }).tier, 'unmeasured');
});
test('unmeasured — 이미지 대기 타임아웃: export 도 truth 도 빈 그림일 수 있어 «같아도» PASS 가 아니다', () => {
  const v = judgeExportDiff(M(), { ...OK, imgTimedOut: true });
  assert.equal(v.tier, 'unmeasured');
  assert.ok(v.reasons.includes('imgTimeout'));
});
test('unmeasured — 재검사 불일치(흔들리는 truth)', () => {
  const v = judgeExportDiff(M({ sizeMismatch: true }), { ...OK, repro: 'unstable' });
  assert.equal(v.tier, 'unmeasured');
  assert.ok(v.reasons.includes('unstable'));
});
test('unmeasured — 캡처 예외 / metrics 없음 / 잉크 0', () => {
  assert.equal(judgeExportDiff(null, { ...OK, captureError: true }).tier, 'unmeasured');
  assert.equal(judgeExportDiff(null, OK).tier, 'unmeasured');
  assert.equal(judgeExportDiff(M({ struct: 'N/A' }), OK).tier, 'unmeasured');
});
test('★재검사가 «문제» 판정을 덮는다 — 못 믿을 측정으로 사용자에게 경고하지 않는다', () => {
  const m = M({ total: 900, sizeMismatch: true });
  assert.equal(judgeExportDiff(m, OK).tier, 'mismatch');
  assert.equal(judgeExportDiff(m, { ...OK, repro: 'unstable' }).tier, 'unmeasured');
});

/* ── 비교기 — python(pixdiff.py) 과 «같은 수치»여야 한다 ─────────────────── */
test('PIL 루마식 — «채널 최대»가 아니라 (R*19595+G*38470+B*7471+0x8000)>>16', () => {
  assert.equal(pilLuma(255, 255, 255), 255);
  assert.equal(pilLuma(0, 0, 255), 29);      // ★파랑만 255 는 L=29 < 40 ⇒ 이 검사가 «안 보는 축»
  assert.equal(pilLuma(0, 255, 0), 150);
  assert.equal(pilLuma(255, 0, 0), 76);
});

test('★파랑만 다른 그림은 TOTAL 0 — 색상축은 이 검사가 못 본다(정직하게 테스트로 박는다)', () => {
  const a = img(40, 40, [0, 0, 0]);
  const b = img(40, 40, [0, 0, 0]);
  /* ★125 ㉮ 뒤 — 두 그림 다 «잉크 0»(검정 바탕 + 루마 29 파랑)이면 이제 «백지 둘»이라 noInk(못 잼)다.
     이 칸이 재려는 것(파랑 축은 TOTAL 0)을 그대로 두려고 ★양쪽에 같은 흰 띠(잉크)를 깐다. */
  put(a, 0, 30, 40, 4, [255, 255, 255]); put(b, 0, 30, 40, 4, [255, 255, 255]);
  put(b, 5, 5, 20, 20, [0, 0, 255]);
  const m = compareRGBA(a, b);
  assert.equal(m.total, 0);
  assert.equal(judgeExportDiff(m, OK).tier, 'same', '「같다」고 말한다 — 이게 이 검사의 한계다');
});

test('blobPx 는 «가는 선»을 지우고 «면»을 남긴다(축이 갈리는지)', () => {
  const a = img(40, 40, [255, 255, 255]);
  const line = img(40, 40, [255, 255, 255]); put(line, 20, 0, 1, 40, [0, 0, 0]);
  const area = img(40, 40, [255, 255, 255]); put(area, 5, 5, 20, 20, [0, 0, 0]);
  const ml = compareRGBA(a, line), ma = compareRGBA(a, area);
  assert.equal(ml.total, 40);   assert.equal(ml.blobPx, 0);
  assert.equal(ma.total, 400);  assert.equal(ma.blobPx, 324);
});

test('크기가 다르면 «픽셀 수치를 안 잰다» — 브라우저엔 PIL 의 LANCZOS 가 없다', () => {
  const m = compareRGBA(img(40, 40, [0,0,0]), img(40, 30, [0,0,0]));
  assert.equal(m.sizeMismatch, true);
  assert.equal(m.total, null, '없는 숫자를 지어내지 않는다');
  assert.equal(judgeExportDiff(m, OK).tier, 'mismatch');
});

test('★TOTAL 0 이면 구조 위반은 «성립할 수 없다» — 잉크 마스크 인공물이 만들던 거짓 FAIL', () => {
  const a = img(40, 40, [200, 200, 200]); put(a, 0, 10, 40, 5, [10, 10, 10]);
  const m = compareRGBA(a, a);
  assert.equal(m.total, 0);
  assert.equal(m.bandMismatch, false);
  assert.equal(m.bandCount, 0);
  assert.equal(judgeExportDiff(m, OK).tier, 'same');
});

test('★크기 불일치는 P0 의 «유일한» 확인 필요 축이다 — 다른 축으로는 mismatch 가 안 난다', () => {
  /* 이 테스트가 지키는 것: 「P0 가 사용자에게 문제라고 말하는 조건이 하나뿐이다」.
     축이 몰래 늘면 오탐이 다시 들어온다 — 늘리려면 §5 규칙대로 «수치»부터 내라. */
  const big = M({ total: 999999, maxCell: 256, blobPx: 100000, bandMismatch: true, maxDx: 12 });
  assert.equal(judgeExportDiff(big, OK).tier, 'minor');
  assert.equal(judgeExportDiff(M({ sizeMismatch: true, total: null }), OK).tier, 'mismatch');
});

/* ── ★125 ㉮ — 비교 «전» 전제: 둘 다 백지면 «같다»가 아니라 «못 쟀다» ─────────────────────
 * FALSE-PASS-CHECKER-SAID-OK-WHILE-ANNOT-MISSING-01: 어노가 export·truth 에서 «같이» 빠진 판(8d10b079)에서
 * 게이트가 3/3 'same' 이었다. 그중 «둘 다 백지»는 잴 게 없는 판이다 ⇒ 기존 문 7(noInk)로 간다(새 문 없음).
 * 양성대조 = 아래 B1 을 고치기 전 판(68ba1f1b) 소스에 대면 'same' 으로 빨강(커밋 메시지·보고에 값). */
test('B1 ★125 ㉮ — 둘 다 백지(한 색) ⇒ same 이 아니라 unmeasured · noInk', () => {
  const m = compareRGBA(img(40, 40, [255, 255, 255]), img(40, 40, [255, 255, 255]));
  assert.equal(m.total, 0, '전제: 다른 점 0');
  assert.deepEqual(judgeExportDiff(m, OK), { tier: 'unmeasured', reasons: ['noInk'] }, '★둘 다 백지인데 판정이 «같다»다 — 거짓 통과');
});
test('B2 ★125 ㉮ — 바탕색이 흰색이 아니어도 백지는 백지(최빈 밝기 기준 · 어두운 섹션)', () => {
  const m = compareRGBA(img(40, 40, [40, 30, 20]), img(40, 40, [40, 30, 20]));
  assert.deepEqual(judgeExportDiff(m, OK), { tier: 'unmeasured', reasons: ['noInk'] });
});
test('B3 ★125 ㉮ 음성 — 같은 «잉크 있는» 그림 둘은 여전히 same (내용 있는 섹션의 정상 통과를 안 바꾼다)', () => {
  const a = img(40, 40, [255, 255, 255]); put(a, 4, 10, 30, 6, [10, 10, 10]);
  assert.equal(judgeExportDiff(compareRGBA(a, a), OK).tier, 'same');
});
test('B4 ★125 ㉮ 음성 — 한쪽만 백지면 N/A 로 덮지 않는다(그건 «차이»다 · 옛 길 그대로)', () => {
  const a = img(40, 40, [255, 255, 255]); const b = img(40, 40, [255, 255, 255]); put(b, 4, 10, 30, 6, [10, 10, 10]);
  const m = compareRGBA(a, b);
  assert.notEqual(m.struct, 'N/A');
  assert.notEqual(judgeExportDiff(m, OK).tier, 'same');
});
test('B5 ★125 ㉮ — 전제 칸 blank 가 metrics 에 실린다(로그·신고가 «왜 못 쟀나»를 말할 수 있게)', () => {
  const w = img(40, 40, [255, 255, 255]); const k = img(40, 40, [255, 255, 255]); put(k, 4, 10, 30, 6, [10, 10, 10]);
  assert.deepEqual(compareRGBA(w, w).blank, { exp: true, truth: true });
  assert.deepEqual(compareRGBA(w, k).blank, { exp: true, truth: false });
  assert.deepEqual(compareRGBA(k, k).blank, { exp: false, truth: false });
});
