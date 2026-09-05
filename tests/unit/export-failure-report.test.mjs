/* 단위 — js/io/export-report.js. 「내보내기 실패를 재현 가능한 형태로 남기는가」를 잰다.
 *
 * ★이 파일이 지키겠다고 한 것 셋:
 *   ⑴ 무엇을 «실패»로 담고 무엇을 안 담는가 (담는 축이 조용히 넓어지면 잡음이 는다)
 *   ⑵ 담은 줄에 «고객 내용»이 없는가 — ★실제 Error.stack 으로 «재서» 확인한다
 *   ⑶ 링버퍼 20칸을 우리가 다 먹지 않는가 (먹으면 신고가 껍데기가 된다)
 * ⛔실제 소스 파일을 import 한다. 세척기도 report-buffer.js «원본»을 실행해서 쓴다 —
 *   손으로 베낀 정규식을 테스트하면 원본이 바뀌어도 안 깨진다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../../js/io/export-report.js');
const alias = path.join(os.tmpdir(), `exreport-${process.pid}.mjs`);
fs.copyFileSync(srcPath, alias);
const R = await import(pathToFileURL(alias).href);
fs.unlinkSync(alias);
const { classifyExportOutcome, scrubErr, fmtError, buildFailureLine, buildRunLine,
        beginRun, endRun, noteExportOutcome, MAX_PER_RUN } = R;

/* ── report-buffer.js «원본»을 실행해 진짜 ReportBuffer 를 만든다 ──
   IIFE 라 window 하나만 주면 돈다. console.error 후킹도 원본 그대로 걸린다. */
function makeReportBuffer() {
  const listeners = [];
  const w = {
    console: { error: () => {}, log: () => {} },
    addEventListener: (t, f) => listeners.push([t, f]),
  };
  const code = fs.readFileSync(path.join(__dirname, '../../js/report-buffer.js'), 'utf8');
  vm.runInNewContext(code, { window: w, Date, JSON, Object, Array, String, Error });
  return w.ReportBuffer;
}

test('R0 report-buffer.js 원본이 실제로 로드된다 — 아니면 아래 세척 측정이 전부 헛것이다', () => {
  const rb = makeReportBuffer();
  assert.equal(typeof rb.note, 'function');
  assert.equal(typeof rb.scrubPaths, 'function');
  assert.equal(rb.max, 20);                    // ★상한이 바뀌면 MAX_PER_RUN 예산도 다시 봐야 한다
});

/* ── ⑴ 무엇을 «실패»로 보는가 ─────────────────────────────────────────── */
const G = (tier, reasons = []) => ({ gate: { tier, reasons } });

test('C1 예외 = fail — 파일이 안 나온 건 논쟁의 여지가 없다', () => {
  assert.equal(classifyExportOutcome({ error: new Error('boom') }).kind, 'fail');
});
test('C2 mismatch 는 담는다 (오탐이 실측 0인 축)', () => {
  const v = classifyExportOutcome(G('mismatch', ['sizeMismatch']));
  assert.equal(v.kind, 'mismatch');
  assert.deepEqual(v.why, ['sizeMismatch']);
});
test('C3 same·minor 는 «안» 담는다 — 정상까지 담으면 링버퍼가 정상으로 찬다', () => {
  assert.equal(classifyExportOutcome(G('same')), null);
  assert.equal(classifyExportOutcome(G('minor')), null);
});
test('C4 설계상 «못 재는» 것은 실패가 아니다 — gif·웹빌드·잉크없음', () => {
  assert.equal(classifyExportOutcome(G('unmeasured', ['gif'])), null);
  assert.equal(classifyExportOutcome(G('unmeasured', ['notNative'])), null);
  assert.equal(classifyExportOutcome(G('unmeasured', ['noInk'])), null);
});
test('C5 검사기가 «깨진» 것은 담는다 — 그건 우리 코드의 버그다', () => {
  assert.equal(classifyExportOutcome(G('unmeasured', ['captureError'])).kind, 'gateerr');
  assert.equal(classifyExportOutcome(G('unmeasured', ['noMetrics'])).kind, 'gateerr');
  assert.equal(classifyExportOutcome(G('unmeasured', ['imgTimeout'])).kind, 'imgto');
  assert.equal(classifyExportOutcome(G('unmeasured', ['unstable'])).kind, 'unstable');
});
test('C6 ★모르는 사유는 «조용히 버리지 않는다» — 코드 그대로 실어서 담는다', () => {
  const v = classifyExportOutcome(G('unmeasured', ['someFutureReason']));
  assert.equal(v.kind, 'gateerr');
  assert.deepEqual(v.why, ['someFutureReason']);
});
test('C7 게이트를 «안 건» 경로는 기록 대상이 아니다 (returnDataUrl·웹빌드)', () => {
  assert.equal(classifyExportOutcome({ gate: null }), null);
  assert.equal(classifyExportOutcome({}), null);
});

/* ── ⑵ 세척 — ★«실제» Error.stack 으로 «잰다» ────────────────────────── */
/** 홈 비슷한 경로에 모듈을 만들어 «진짜» 예외를 던지게 한다. 손으로 쓴 스택 문자열이 아니다. */
async function realErrorFrom(userDirName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exrep-'));
  const dir = path.join(root, 'Users', userDirName, '작업', '여름세일');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'boom.mjs');
  fs.writeFileSync(f, "export function boom(){ throw new TypeError(\"Cannot read properties of null (reading 'style')\"); }\n");
  const mod = await import(pathToFileURL(f).href);
  try { mod.boom(); } catch (e) { return { err: e, root, dir }; }
  throw new Error('예외가 안 났다 — 이 테스트가 재는 게 없다');
}

test('S1 ★실제 stack 에 «사용자 이름»이 안 남는다 (공백 든 이름으로 잰다)', async () => {
  const rb = makeReportBuffer();
  const { err } = await realErrorFrom('kim minjae');
  /* ★[실측] ESM·렌더러 스택 프레임은 «퍼센트 인코딩된 file:// URL» 이다 —
     `file:///…/Users/kim%20minjae/%EC%9E%91%EC%97%85/boom.mjs:1:31`.
     공백도 한글도 «그 글자로는 안 보인다». 그래서 눈으로 「없네」 하면 오판한다.
     ⇒ 양성대조도 판정도 «인코딩된 꼴»로 잰다(인코딩은 되돌릴 수 있으니 남으면 유출이다). */
  const enc = encodeURIComponent('kim minjae');            // kim%20minjae
  assert.ok(err.stack.includes(enc), '양성대조: 원본 stack 엔 이름이 «있다» — ' + err.stack);
  const line = fmtError(err, rb.scrubPaths);
  for (const bad of ['kim', 'minjae', enc, '/Users/']) {
    assert.ok(!line.includes(bad), `«${bad}» 가 남았다: ` + line);
  }
});

test('S2 ★같은 stack 에서 «폴더 이름»(작업/여름세일)도 안 남는다 — 클라이언트 캠페인명이다', async () => {
  const rb = makeReportBuffer();
  const { err } = await realErrorFrom('hyunbin');
  const encWork = encodeURIComponent('작업'), encSale = encodeURIComponent('여름세일');
  assert.ok(err.stack.includes(encSale), '양성대조: 원본 stack 엔 폴더명이 «있다» — ' + err.stack);
  const line = fmtError(err, rb.scrubPaths);
  for (const bad of ['여름세일', '작업', encWork, encSale, 'hyunbin']) {
    assert.ok(!line.includes(bad), `«${bad}» 가 남았다: ` + line);
  }
});

test('S3 예외 «내용»은 남는다 — 안 남으면 재현할 게 없다', async () => {
  const rb = makeReportBuffer();
  const { err } = await realErrorFrom('a1');
  const line = fmtError(err, rb.scrubPaths);
  assert.ok(line.startsWith('TypeError: '), line);
  assert.ok(line.includes("reading 'style'"), line);
});

test('S4 ★우리 소스 파일명·줄번호는 «살린다» — 그게 재현의 핵심이다', () => {
  const rb = makeReportBuffer();
  const fake = { name: 'Error', message: 'toBlob failed',
    stack: 'Error: toBlob failed\n    at capture (/Users/kim minjae/app/js/io/export-image.js:703:24)\n    at x (/Users/kim minjae/app/js/io/export-gate.js:88:9)' };
  const line = fmtError(fake, rb.scrubPaths);
  assert.ok(line.includes('export-image.js:703'), '소스 프레임이 사라졌다: ' + line);
  assert.ok(!line.includes('kim'), line);
});

test('S7 ★file:// 프레임에서도 «우리 파일명»은 살아남는다 — 스킴만 떼야지 통째로 뭉개면 안 된다', async () => {
  const rb = makeReportBuffer();
  const { err } = await realErrorFrom('a1');
  assert.ok(err.stack.includes('file:///'), '양성대조: 실제 ESM 스택은 file:// URL 이다');
  const line = fmtError(err, rb.scrubPaths);
  assert.ok(line.includes('boom.mjs'), '소스 파일명이 사라졌다 — 재현 불가: ' + line);
});

test('S8 ★긴 스택에서도 «우리 파일명»이 안 잘린다 — 자르는 건 «씻은 뒤»여야 한다', () => {
  const rb = makeReportBuffer();
  /* 실기 9391 에서 나온 프레임 꼴(경로 그대로) 6개. 씻기 «전»에 320자로 자르면 뒤쪽 프레임이
     `…/export-im` 에서 끊겨 확장자를 잃고 ③ 규칙이 «f» 로 지워 버린다. */
  const base = 'file:///private/tmp/srv-%EC%A7%80%EB%94%94_exrep/js/io/export-image.js';
  const fake = { name: 'TypeError', message: "Cannot read properties of null (reading 'style')",
    stack: ['TypeError: x',
      '    at window.materializeAllSections (<anonymous>:9:11)',
      `    at renderComponentsInClone (${base}:317:27)`,
      `    at flattenCvbTransform (${base}:512:9)`,
      `    at bakeImgFilterToCanvas (${base}:640:11)`,
      `    at prepareCloneForCapture (${base}:233:7)`,
      `    at _exportSectionInner (${base}:474:3)`].join('\n') };
  const line = fmtError(fake, rb.scrubPaths);
  assert.ok(line.includes('_exportSectionInner'), '마지막 프레임이 사라졌다: ' + line);
  assert.ok(line.includes('export-image.js:474'), '마지막 프레임이 잘려 «f» 가 됐다: ' + line);
  assert.ok(!line.includes('«f»'), line);
  assert.ok(!line.includes('srv-'), '워크트리 경로가 남았다: ' + line);
});

test('S12 ★«불변 꼬리»는 버린다 — exportSection/exportAllSections 는 어느 실패든 똑같이 나온다', () => {
  const rb = makeReportBuffer();
  const base = 'file:///app/js/io/export-image.js';
  const mk = (frames) => ({ name: 'TypeError', message: 'x', stack: ['TypeError: x', ...frames].join('\n') });

  // 실측 S-C(깊음) — 정보 프레임 3개에서 «정확히» 멈춘다
  const sc = fmtError(mk([
    '    at P.querySelectorAll (<anonymous>:16:65)',
    `    at renderComponentsInClone (${base}:317:27)`,
    `    at _exportSectionInner (${base}:474:3)`,
    `    at async exportSection (${base}:436:15)`,
    '    at async run (<anonymous>:8:11)']), rb.scrubPaths);
  assert.ok(sc.includes('renderComponentsInClone'), '정보 프레임이 잘렸다: ' + sc);
  assert.ok(sc.includes('_exportSectionInner'), sc);
  assert.ok(!sc.includes('exportSection ('), '불변 꼬리가 실렸다: ' + sc);
  assert.ok(!/\bexportAllSections\b/.test(sc), sc);
  assert.equal(sc.split(' | ').length, 3, '프레임 3개가 아니다: ' + sc);

  // 실측 S-A(얕음) — 2개. 고정 N=4 였다면 꼬리 2개가 더 붙었다
  const sa = fmtError(mk([
    '    at window.materializeAllSections (<anonymous>:9:11)',
    `    at _exportSectionInner (${base}:463:45)`,
    `    at exportSection (${base}:436:21)`,
    `    at exportAllSections (${base}:903:23)`]), rb.scrubPaths);
  assert.equal(sa.split(' | ').length, 2, '프레임 2개가 아니다: ' + sa);

  // 폭주 방지 — 정보 프레임이 아무리 깊어도 상한에서 멈춘다
  const deep = fmtError(mk(Array.from({ length: 30 }, (_, i) => `    at deepFn${i} (${base}:${100 + i}:1)`)), rb.scrubPaths);
  assert.equal(deep.split(' | ').length, 6, '상한이 안 걸렸다: ' + deep);

  // ★꼬리가 «첫 줄»이면(래퍼 자신이 던진 경우) 0개가 되면 안 된다 — 한 줄은 남긴다
  const only = fmtError(mk([`    at exportSection (${base}:436:21)`]), rb.scrubPaths);
  assert.ok(only.includes('exportSection'), '프레임이 통째로 사라졌다: ' + only);
});

test('S5a ★경로 «끝 이름»을 지운다 — scrubPaths 는 ~/…/롯데_2026여름 까지밖에 못 씻는다', () => {
  const rb = makeReportBuffer();
  const raw = '프로젝트 열기 실패: /Users/kim minjae/작업/롯데_2026여름';
  /* ★양성대조 — scrubPaths «단독»으로는 클라이언트 이름이 «그대로 남는다».
     확장자가 없어 ④(미디어 catch-all)도 안 닿는다 ⇒ 이 줄을 지키는 건 ③ 하나다. */
  assert.ok(rb.scrubPaths(raw).includes('롯데_2026여름'),
    '양성대조가 깨졌다 — scrubPaths 가 이미 지우면 이 테스트는 아무것도 안 잰다');
  assert.ok(!scrubErr(raw, rb.scrubPaths).includes('롯데'), scrubErr(raw, rb.scrubPaths));
});

test('S5b ★경로에 «안 붙은» 파일명도 지운다 — 「메인배너.png 로드 실패」 꼴', () => {
  const rb = makeReportBuffer();
  const raw = 'Image load failed: 여름세일_메인.png';
  /* ★양성대조 — 경로 구분자가 없어 ①②③ 이 «전부» 안 닿는다 ⇒ 이 줄을 지키는 건 ④ 하나다. */
  assert.equal(rb.scrubPaths(raw), raw, '양성대조가 깨졌다 — scrubPaths 가 이미 손대고 있다');
  const out = scrubErr(raw, rb.scrubPaths);
  assert.ok(!out.includes('여름세일_메인'), out);
  assert.ok(out.includes('Image load failed'), '재현에 필요한 «무슨 실패인지»는 남아야 한다: ' + out);
});

test('S6 URL·데이터 URI 는 «스킴만» 남는다 — 호스트·경로에 고객이 들어 있다', () => {
  const rb = makeReportBuffer();
  const out = scrubErr('GIF fetch failed: 404 https://shop.example.co.kr/img/2026여름/hero.gif', rb.scrubPaths);
  assert.ok(out.includes('404'), '재현에 필요한 상태코드는 남아야 한다: ' + out);
  assert.ok(!out.includes('shop.example'), out);
  assert.ok(!out.includes('hero.gif'), out);
  const d = scrubErr('decode failed data:image/png;base64,iVBORw0KGgoAAAANSUhEUg', rb.scrubPaths);
  assert.ok(!d.includes('iVBOR'), d);
  assert.ok(!scrubErr('blob:file:///abc-123', rb.scrubPaths).includes('abc-123'));
  assert.ok(!scrubErr('goya-asset://proj_9/여름_1.png', rb.scrubPaths).includes('여름_1'));
});

/* ── ⑵-b ★던져지는 게 «항상 Error 는 아니다» (실기 실측 D7·D8) ────────── */
test('S9 ★DOMException — stack 이 «없다». 「잘린 것」과 「원래 없는 것」을 가른다', () => {
  const rb = makeReportBuffer();
  const e = { name: 'SecurityError', message: 'The operation is insecure.' };  // stack 없음
  const line = fmtError(e, rb.scrubPaths);
  assert.ok(line.startsWith('SecurityError: The operation is insecure.'), line);
  assert.ok(line.endsWith('@nostack'), '스택 부재가 «표시»돼야 한다: ' + line);
});

test('S10 ★Event 로 reject 되면 String(e) 는 «[object Event]» 다 — 그대로 두면 기록이 무정보', () => {
  const rb = makeReportBuffer();
  class FakeEvent {}                     // node 엔 DOM Event 가 없다 → 전역을 세워 실제 분기를 태운다
  globalThis.Event = FakeEvent;
  try {
    const ev = new FakeEvent();
    ev.type = 'error';
    ev.target = { tagName: 'IMG', currentSrc: 'data:image/png;base64,iVBORw0KGgo', naturalWidth: 0, naturalHeight: 0 };
    // ★양성대조 — 손대지 않으면 이 문자열이 그대로 기록된다
    assert.equal(String(ev), '[object Object]');
    const line = fmtError(ev, rb.scrubPaths);
    assert.ok(line.includes('Event(error)'), line);
    assert.ok(line.includes('img'), '무엇이 실패했는지가 없다: ' + line);
    assert.ok(line.includes('src=data:'), '소스 «스킴»이 없다: ' + line);
    assert.ok(line.includes('nat=0x0'), line);
    // ⛔URL 본문은 실리면 안 된다
    assert.ok(!line.includes('iVBOR'), '이미지 데이터가 샜다: ' + line);
    assert.ok(!line.includes('base64'), line);
  } finally { delete globalThis.Event; }
});

test('S11 ★스킴 없는 src 는 «rel» 이다 — split(":")[0] 이면 `src=«f»:` 라는 뜻 없는 글자가 남는다', () => {
  const rb = makeReportBuffer();
  class FakeEvent {}
  globalThis.Event = FakeEvent;
  try {
    const mk = (src) => { const e = new FakeEvent(); e.type = 'error';
      e.target = { tagName: 'IMG', currentSrc: src, naturalWidth: 0, naturalHeight: 0 }; return e; };
    const bare = fmtError(mk('여름세일_메인.png'), rb.scrubPaths);
    assert.ok(bare.includes('src=rel'), '스킴 없는 src 가 안 읽힌다: ' + bare);
    assert.ok(!bare.includes('«f»:'), '세척된 파일명이 «스킴 자리»에 남았다: ' + bare);
    assert.ok(!bare.includes('여름세일'), bare);
    // 스킴이 있으면 스킴을 쓴다
    assert.ok(fmtError(mk('goya-asset://p/여름_1.png'), rb.scrubPaths).includes('src=goya-asset:'));
    assert.ok(!fmtError(mk('https://shop.example.co.kr/a/b.png'), rb.scrubPaths).includes('shop.example'));
  } finally { delete globalThis.Event; }
});

/* ── ⑶ 담기는 줄 ─────────────────────────────────────────────────────── */
test('L1 줄에 순번·형식·폭·블록구성이 들어간다 (재현 단서)', () => {
  const l = buildFailureLine({ kind: 'mismatch', why: ['sizeMismatch'], idx: 3, total: 22,
    format: 'png', width: 860, secH: 1240, blocks: 'text:4,asset:2', imgs: 2, ms: 812, gateMs: 430,
    expSize: [860, 1240], truthSize: [860, 1280], total_: null, maxCell: null, blobPx: null,
    bandCount: null, truthBandCount: null, reproDiff: 0, err: null });
  assert.match(l, /k=mismatch/); assert.match(l, /n=3\/22/);
  assert.match(l, /fmt=png/);    assert.match(l, /w=860/);
  assert.match(l, /blk=text:4,asset:2/);
  assert.match(l, /sz=860x1240>860x1280/);
  assert.match(l, /why=sizeMismatch/);
});

test('L2 ★줄에 섹션 «이름»도 «id» 도 없다 — 이름은 사람이 쓴 말이고 id 엔 설치 식별자가 있다', () => {
  const l = buildFailureLine({ kind: 'fail', why: [], idx: 3, total: 22, format: 'png', width: 860,
    secH: 900, blocks: 'text:1', imgs: 0, ms: 10, err: 'Error: x' });
  assert.ok(!/sec_/.test(l), l);
  assert.ok(!/name/.test(l), l);
});

/* ── ⑷ 링버퍼 예산 ───────────────────────────────────────────────────── */
function drain(rb) { const l = rb.list().map(e => e.msg); rb.clear(); return l; }

test('B1 ★22섹션이 «전부» 실패해도 링버퍼(20칸)를 다 먹지 않는다 — 상한 + 요약 1줄', () => {
  const rb = makeReportBuffer();
  global.window = { ReportBuffer: rb };
  try {
    beginRun(22, 'png', 860);
    for (let i = 1; i <= 22; i++) noteExportOutcome(null, { format: 'png', width: 860, idx: i, total: 22, ms: 5, error: new Error('boom ' + i) });
    endRun();
    const lines = drain(rb);
    assert.equal(lines.length, MAX_PER_RUN + 1, '담긴 줄: ' + lines.length);
    assert.ok(lines.length < rb.max, '링버퍼를 다 먹었다');
    const run = lines[lines.length - 1];
    assert.match(run, /bad=22/);
    assert.match(run, /omitted=17/);          // ★생략을 «조용히» 하지 않는다
    assert.match(run, /kind=fail=22/);
  } finally { delete global.window; }
});

test('B2 실패가 0이면 «아무것도» 안 남는다 — 정상 내보내기는 버퍼를 안 건드린다', () => {
  const rb = makeReportBuffer();
  global.window = { ReportBuffer: rb };
  try {
    beginRun(22, 'png', 860);
    for (let i = 1; i <= 22; i++) noteExportOutcome(null, { format: 'png', width: 860, idx: i, total: 22, ms: 5, gate: { tier: 'same', reasons: [] } });
    endRun();
    assert.equal(rb.size(), 0);
  } finally { delete global.window; }
});

test('B3 요약 줄이 «어떤 종류»가 몇 건인지 말한다 — 현빈이 경우의 수를 세는 자리', () => {
  assert.match(buildRunLine({ format: 'png', width: 860, total: 5, bad: 3,
    kinds: { fail: 1, mismatch: 2 }, skipped: 0 }), /kind=fail=1,mismatch=2/);
});

test('B4 판을 «안 열고» 불러도 기록은 남는다 (단일 섹션 내보내기 경로)', () => {
  const rb = makeReportBuffer();
  global.window = { ReportBuffer: rb };
  try {
    noteExportOutcome(null, { format: 'jpg', width: 640, idx: 2, total: 9, ms: 7, error: new Error('x') });
    endRun();
    const lines = drain(rb);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /k=fail n=2\/9 fmt=jpg w=640/);
  } finally { delete global.window; }
});

test('B5 ★ReportBuffer 가 없어도(웹 빌드·로드 순서 사고) 던지지 않는다', () => {
  assert.doesNotThrow(() => { noteExportOutcome(null, { format: 'png', width: 860, idx: 1, total: 1, error: new Error('x') }); endRun(); });
});
