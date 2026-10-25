/* export-gate-doors — `judgeExportDiff`(js/io/export-gate-core.js) 의 ★문(door) 명부를 ★순서대로 잠근다.
 *   (EXPORT-GATE-MINOR-ROUTES-TO-SAME-WORDING-01 의 빈칸 · 2026-10-22 imac-지디워커 · 발주 ② ⒝)
 *
 * ★빈칸이던 물음 — 「blob 꺼짐(BLOB_MIN = Infinity · :25) ∧ 크기 같음, ★둘이 같이 참이어야 minor 인가?」
 *   ⇒ ★답(소스 독해 ＋ 아래 D3 이 행위로 잰다): ★그렇다 — 그리고 그 둘만이 아니다.
 *      minor ⇔ ★앞의 «못 잼» 문 일곱이 ★전부 닫힘 ∧ ¬sizeMismatch ∧ ¬(blobPx ≥ BLOB_MIN) ∧ total > 0
 *   ⇒ 「total>0 인데 minor 가 ★아닌」 판 = ★문 1~7(unmeasured) · 문 8·9 가 연 문 10(mismatch) — ★아홉 갈래(D4 가 센다).
 *   ⚠️가장자리 하나: BLOB_MIN 이 Infinity 여도 ★blobPx === Infinity 면 `Infinity >= Infinity` 가 참이라 ★blob 문이 연다.
 *     structural() 이 세는 수라 실제로는 유한하다고 본다 — ★안 쟀다(D3 이 그 성질만 박는다).
 * ★그리고 minor 는 ★사용자 문구에서 same 과 ★같은 길로 간다 — 소비자 둘(D5): js/export-result-modal.js 의 한 줄 토스트 ·
 *   js/io/export-report.js 의 「신고 없음」. ⛔이 검사는 그 길을 ★고치지 않는다(문구는 현빈 칸) — ★지금 그렇다는 사실만 잠근다.
 * ★쌍 — 「문을 하나 빼면 → ★그 칸이 빨강」: D2(명부 ↔ 소스 순서) ＋ D6(문마다 빼 본 판을 ★같은 행위표에 먹인다).
 * ⛔실제 소스를 읽는다(손으로 쓴 모델 금지 — export-gate-judge.test.mjs 머리말과 같은 까닭). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/io/export-gate-core.js'), 'utf8').replace(/\r\n/g, '\n');

/** `export function judgeExportDiff(…) { … }` 를 중괄호 균형으로 떠낸다(매개변수 괄호 먼저 닫음). */
function fnText(src) {
  const m = /export function judgeExportDiff\s*\(/.exec(src);
  assert.ok(m, '★judgeExportDiff 가 없다');
  let i = src.indexOf(')', m.index);
  i = src.indexOf('{', i);
  let d = 0;
  for (let k = i; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(m.index, k + 1);
  }
  throw new Error('몸통이 안 닫힌다');
}
/** 그 함수를 ★BLOB_MIN 을 주입해 «돌린다». ⛔import 하지 않는 까닭 = D6 이 «문을 뺀 판»을 같은 길로 돌려야 해서. */
/* ★★261025 (t6-01) — ★`judgeExportDiff` 가 ★곁 모듈의 ★`isGifFormat` 을 ★쓰게 됐다.
     ★이 자는 ★함수 ★본문만 떠내 `new Function` 으로 ★다시 짓는다 ⇒ ★그 이름이 ★범위에 ★없으면
     ★문 2 부터 ★전부 ★죽는다(실측: 문2~문12 열셋이 한꺼번에 틀렸다).
   ⇒ ★★«진짜 정본»을 ★끌어와 ★인자로 ★넣는다. ⛔손으로 ★가짜를 ★짓지 마라 —
     ★가짜를 지으면 ★이 자는 ★「내가 만든 모형」을 ★재게 되고 ★제품과 ★갈려도 ★안 보인다.
   ★package.json 이 commonjs 라 ★tmp .mjs 사본으로 싣는다(이 집의 관례).
   ★★치우기는 ★공용 `mkTmpRoot` 가 ★쥔다 — ⛔손으로 `rmSync` 하지 마라
     (`tests/unit/tmproot-sole-owner.test.mjs` ★T2 가 막는다 · 261025 에 ★실제로 잡혔다). */
const _fmtTmp = path.join(mkTmpRoot('exgate-doors-'), 'export-formats.mjs');
fs.writeFileSync(_fmtTmp, fs.readFileSync(path.join(ROOT, 'js/io/export-formats.js'), 'utf8'));
const { isGifFormat } = await import(pathToFileURL(_fmtTmp).href);

const build = (text, blobMin = Infinity) =>
  new Function('BLOB_MIN', 'isGifFormat', text.replace(/^export /, '') + '\nreturn judgeExportDiff;')(blobMin, isGifFormat);

/* ★문 명부 — ★순서가 곧 우선순위다. key = 소스 줄 «코드 조각»(공백 하나로 접어 견준다). */
const DOORS = [
  { n: 1,  key: "if (c.native === false) return { tier: 'unmeasured', reasons: ['notNative'] };", tier: 'unmeasured', reasons: ['notNative'] },
  /* ★★261025 (t6-01) — ★문 2 의 ★문장이 바뀌었다. ★행위는 ★한 글자도 ★안 바뀐다 :
       옛 : if (c.format === 'gif' || c.format === 'gif-anim') …
       새 : if (isGifFormat(c.format)) …
     ★왜 — ★'gif'·'gif-anim' 명부가 ★`export-gate.js` 와 ★여기 ★둘이었다. ★webp 를 더하면서
       ★정본 `js/io/export-formats.js` ★한 자리로 모았다(★「명부가 둘이면 파생시켜 하나로」).
     ★★행위가 그대로임은 ★아래 ROWS 의 ★두 줄(door 2 · format 'gif' 와 'gif-anim')이 ★그대로 잰다.
     ⛔이 key 를 ★느슨한 정규식으로 ★바꾸지 마라 — ★이 자의 값은 ★「문장이 ★정확히 ★이것」이다. */
  { n: 2,  key: "if (isGifFormat(c.format)) return { tier: 'unmeasured', reasons: ['gif'] };", tier: 'unmeasured', reasons: ['gif'] },
  { n: 3,  key: "if (c.captureError) return { tier: 'unmeasured', reasons: ['captureError'] };", tier: 'unmeasured', reasons: ['captureError'] },
  { n: 4,  key: "if (c.imgTimedOut) return { tier: 'unmeasured', reasons: ['imgTimeout'] };", tier: 'unmeasured', reasons: ['imgTimeout'] },
  { n: 5,  key: "if (c.repro === 'unstable') return { tier: 'unmeasured', reasons: ['unstable'] };", tier: 'unmeasured', reasons: ['unstable'] },
  { n: 6,  key: "if (!m || m.measured !== true) return { tier: 'unmeasured', reasons: ['noMetrics'] };", tier: 'unmeasured', reasons: ['noMetrics'] },
  { n: 7,  key: "if (m.struct === 'N/A') return { tier: 'unmeasured', reasons: ['noInk'] };", tier: 'unmeasured', reasons: ['noInk'] },
  { n: 8,  key: "if (m.sizeMismatch) reasons.push('sizeMismatch');", tier: 'mismatch', reasons: ['sizeMismatch'] },
  { n: 9,  key: "if (typeof m.blobPx === 'number' && m.blobPx >= BLOB_MIN) reasons.push('blob');", tier: 'mismatch', reasons: ['blob'] },
  { n: 10, key: "if (reasons.length) return { tier: 'mismatch', reasons };", tier: 'mismatch', reasons: ['sizeMismatch', 'blob'] },
  { n: 11, key: "if (m.total > 0) return { tier: 'minor', reasons: [] };", tier: 'minor', reasons: [] },
  { n: 12, key: "return { tier: 'same', reasons: [] };", tier: 'same', reasons: [] },
];
const fold = (s) => s.replace(/\s+/g, ' ').trim();
/** 몸통에서 «문 줄» = `return {` 또는 `reasons.push(` 가 든 줄(주석 줄 제외) — ★기계로 뽑는다. */
const doorLines = (text) => text.split('\n').map(l => l.replace(/\/\/.*$/, '')).map(fold)
  .filter(l => l && !l.startsWith('*') && !l.startsWith('/*') && (/\breturn \{/.test(l) || /reasons\.push\(/.test(l)));

/* ★행위표 — 칸마다 «그 문을 정확히 여는» 입력. ★모두 total>0(= 문이 없으면 minor 로 «떨어질» 판)이다.
   블롭 칸(9·10b)만 BLOB_MIN 을 유한으로 켠다(기본 Infinity 에서는 열 수 없는 문이라). */
const M = (o = {}) => ({ measured: true, struct: 'ok', total: 5, sizeMismatch: false, blobPx: 0, ...o });
const ROWS = [
  { door: 1,  m: M(), ctx: { native: false } },
  { door: 2,  m: M(), ctx: { format: 'gif' } },
  { door: 2,  m: M(), ctx: { format: 'gif-anim' }, tag: 'gif-anim' },
  { door: 3,  m: M(), ctx: { captureError: new Error('x') } },
  { door: 4,  m: M(), ctx: { imgTimedOut: true } },
  { door: 5,  m: M(), ctx: { repro: 'unstable' } },
  { door: 6,  m: M({ measured: false }), ctx: {} },
  { door: 6,  m: null, ctx: {}, tag: 'null' },
  { door: 7,  m: M({ struct: 'N/A' }), ctx: {} },
  { door: 8,  m: M({ sizeMismatch: true }), ctx: {}, want: { tier: 'mismatch', reasons: ['sizeMismatch'] } },
  { door: 9,  m: M({ blobPx: 100 }), ctx: {}, blobMin: 50, want: { tier: 'mismatch', reasons: ['blob'] } },
  { door: 10, m: M({ sizeMismatch: true, blobPx: 100 }), ctx: {}, blobMin: 50, want: { tier: 'mismatch', reasons: ['sizeMismatch', 'blob'] } },
  { door: 11, m: M(), ctx: {} },
  { door: 12, m: M({ total: 0 }), ctx: {} },
];
const want = (r) => r.want || (({ tier, reasons }) => ({ tier, reasons }))(DOORS[r.door - 1]);
/** 행위표를 한 판(text)에 먹여 «틀린 칸»을 돌려준다. 던지면 그것도 틀린 칸. */
function wrongRows(text) {
  const out = [];
  for (const r of ROWS) {
    let got;
    try { got = build(text, r.blobMin ?? Infinity)(r.m, r.ctx); } catch (e) { got = { threw: e.message }; }
    try { assert.deepEqual(JSON.parse(JSON.stringify(got ?? null)), want(r)); }
    catch { out.push(`문${r.door}${r.tag ? '(' + r.tag + ')' : ''}`); }
  }
  return out;
}
const REAL = fnText(SRC);

test('D1 ★문 수 = 12 — 몸통에서 기계로 뽑은 문 줄 수(`return {` · `reasons.push(`)', () => {
  assert.equal(doorLines(REAL).length, 12, `★문 줄이 ${doorLines(REAL).length} 개다:\n  ${doorLines(REAL).join('\n  ')}`);
  assert.equal(DOORS.length, 12);
});

test('D2 ★명부 ↔ 소스 — 같은 문이 ★같은 순서로 (순서 = 우선순위)', () => {
  assert.deepEqual(doorLines(REAL), DOORS.map(d => fold(d.key)),
    '★judgeExportDiff 의 문이 명부와 다르다 — 문을 더하거나 빼거나 순서를 바꿨으면 DOORS 와 ROWS 를 같이 고쳐라');
  /* 줄 앵커 — 지금 판의 줄(사람이 찾아가는 길). ★정본은 위 key(글자) 다 */
  const at = (k) => SRC.split('\n').findIndex(l => fold(l.replace(/\/\/.*$/, '')) === fold(k)) + 1;
  assert.ok(DOORS.every(d => at(d.key) > 0), '★문 줄을 소스에서 못 찾는다');
  assert.ok(DOORS.every((d, i) => i === 0 || at(d.key) > at(DOORS[i - 1].key)), '★문 순서가 줄 순서와 다르다');
});

test('D3 ★행위 — 칸마다 ★그 문이 연다 · ★blob 문은 기본(Infinity)에서 유한 blobPx 로는 못 연다', () => {
  assert.deepEqual(wrongRows(REAL), [], '★지금 판에서 행위표가 틀렸다');
  const j = build(REAL);   // 기본 BLOB_MIN = Infinity (소스 :25 `export let BLOB_MIN = Infinity;`)
  assert.match(SRC, /^export let BLOB_MIN = Infinity;$/m, '★blob 축 기본값이 «꺼짐»이 아니다 — 위 답이 바뀐다');
  assert.deepEqual(j(M({ blobPx: 1e12 }), {}), { tier: 'minor', reasons: [] }, '★꺼진 blob 이 유한 값에서 열렸다');
  /* 가장자리(안 쟀다 — 실제로 나오는지는 모른다): blobPx === Infinity 면 꺼진 판에서도 연다 */
  assert.equal(j(M({ blobPx: Infinity }), {}).tier, 'mismatch');
  /* ★minor 의 조건은 «둘의 곱»이다 — 크기 같음만으로도, blob 꺼짐만으로도 안 된다 */
  assert.equal(j(M({ sizeMismatch: true }), {}).tier, 'mismatch', '★크기가 다른데 minor 다');
  assert.equal(build(REAL, 50)(M({ blobPx: 100 }), {}).tier, 'mismatch', '★blob 이 켜져 열렸는데 minor 다');
});

test('D4 ★「total>0 인데 minor 가 아닌」 판 = 아홉 갈래 (문 1~7 · 문 8·9 를 거친 문 10)', () => {
  const notMinor = ROWS.filter(r => (r.m && r.m.total > 0) && want(r).tier !== 'minor');
  const doors = [...new Set(notMinor.map(r => r.door))].sort((a, b) => a - b);
  assert.deepEqual(doors, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  /* 문 8·9 는 «돌려주지» 않고 문 10 이 돌려준다 ⇒ 돌려주는 갈래로 세면 1~7 ＋ 10 = 여덟 문 · 이유(reasons)로 세면 아홉 */
  const reasons = new Set(notMinor.flatMap(r => want(r).reasons.length ? want(r).reasons : []));
  assert.deepEqual([...reasons].sort(), ['blob', 'captureError', 'gif', 'imgTimeout', 'noInk', 'noMetrics', 'notNative', 'sizeMismatch', 'unstable']);
});

test('D5 ★minor 는 사용자 문구에서 same 과 같은 길이다 — 소비자 둘 (EXPORT-GATE-MINOR-ROUTES-TO-SAME-WORDING-01)', () => {
  const modal = fs.readFileSync(path.join(ROOT, 'js/export-result-modal.js'), 'utf8');
  const report = fs.readFileSync(path.join(ROOT, 'js/io/export-report.js'), 'utf8');
  assert.match(modal, /if \(tier === 'same' \|\| tier === 'minor'\) \{\s*window\.showToast\?\.\('내보냈습니다 · 캔버스와 같습니다'\);/,
    '★모달의 minor 길이 바뀌었다 — 이 칸의 «지금 그렇다»를 고쳐라(문구 결정은 현빈 칸)');
  assert.match(report, /if \(g\.tier === 'same' \|\| g\.tier === 'minor'\) return null;/, '★신고 쪽 minor 길이 바뀌었다');
});

test('D6 ★★쌍 — 문을 «하나» 빼면 ★그 문의 칸이 빨강 (12 문 전수 · 같은 행위표)', () => {
  const lines = REAL.split('\n');
  const miss = [];
  for (const d of DOORS) {
    const idx = lines.findIndex(l => fold(l.replace(/\/\/.*$/, '')) === fold(d.key));
    assert.ok(idx >= 0, `★문${d.n} 줄을 못 찾았다`);
    const cut = [...lines.slice(0, idx), ...lines.slice(idx + 1)].join('\n');
    assert.notEqual(doorLines(cut).length, 12, '★뺐는데 문 수가 그대로다 — 변이가 안 먹었다');
    const red = wrongRows(cut);
    if (!red.some(x => x === `문${d.n}` || x.startsWith(`문${d.n}(`))) miss.push(`문${d.n} 을 뺐는데 그 칸이 초록 (빨강: ${red.join(',') || '없음'})`);
  }
  assert.deepEqual(miss, [], '★문을 빼도 안 빨개지는 칸이 있다 — 그 문은 행위표가 안 잰다:\n  ' + miss.join('\n  '));
});
