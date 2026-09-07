/* U-H7 — «망가뜨리기» 하네스(tools/hardening)의 자체검사.
 *   실행: node --test "tests/unit/*.test.mjs"
 *
 * ★왜 하네스에 «검사»가 붙나
 *   이 하네스는 H2~H6 다섯 단위의 판정 도구다. 도구가 고장을 «못 잡으면» 그 다섯의
 *   초록이 전부 가짜가 된다. 그래서 판정기마다 «정상»과 «일부러 고장난» 두 상태를
 *   같이 통과시켜 «가르는지»를 본다 — 오탐 0 · 미탐 0 을 «검사»로 고정한다.
 *   ⛔「주의」 주석으로 닫지 않는다. 경고는 갈라짐을 못 막는다. 검사만 막는다.
 *
 * ⛔Electron 을 안 띄운다(여기서 재는 것은 «판정기»다). 실기는 tools/hardening/run.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMatrix, CHECKOUT } from '../../tools/hardening/selfcheck.mjs';
import { missingSymbols } from '../../tools/hardening/lib/loadcheck.mjs';
import { loadIsAllCanvasEmpty, EMPTY_HEAD } from '../../tools/hardening/judge/lost-window.mjs';
import { waitFor, HarnessError, EXIT } from '../../tools/hardening/lib/deadline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* 매트릭스는 한 번만 돌린다(픽스처를 만든다 — 반복하면 디스크를 먹는다). */
let M;
test('U-H7-0 ★하네스 자체검사 매트릭스가 «돈다»', async () => {
  M = await runMatrix();
  assert.ok(M.counts.total >= 30, `케이스가 너무 적다(${M.counts.total}) — 검사가 헐거워진 것이다`);
  assert.ok(M.counts.healthy >= 10 && M.counts.broken >= 15,
    `정상/고장 양쪽 표본이 있어야 «가르는지»를 말할 수 있다: ${JSON.stringify(M.counts)}`);
});

test('U-H7-1 ★오탐 0 — «정상»인데 빨간 판정기가 없다', () => {
  assert.deepEqual(M.falsePositives.map(r => r.id), [],
    '정상 상태를 고장이라고 말하는 판정기가 있다 — 그 자로는 H2~H6 을 못 잰다');
});

test('U-H7-2 ★미탐 0 — «고장»인데 초록인 판정기가 없다', () => {
  assert.deepEqual(M.falseNegatives.map(r => r.id), [],
    '고장을 못 잡는 판정기가 있다 — 가장 나쁜 실패다(가짜 초록의 원천)');
});

test('U-H7-3 ★「못 쟀다」를 «PASS 로 접지 않는다» (자체 실기가 두 번 잡은 자리)', () => {
  /* 실사고 둘:
     ⑴ PII 판정기가 표본 0개인데 pass:true 를 냈다(아무것도 안 찾아본 실행이 초록).
     ⑵ I7 판정기가 projects 를 chmod 000 한 상태에서 «스캔 0 → PASS» 를 냈다.
     둘 다 이 하네스가 막으려던 가짜 초록 그 자체다. 검사로 고정한다. */
  const ids = ['PII-notMeasured-isNotPass', 'I7-★notMeasured-when-denied', 'I7-★notMeasured-when-empty',
               'CRASHLOG-★notMeasured-when-denied'];
  for (const id of ids) {
    const row = M.rows.find(r => r.id === id);
    assert.ok(row, `케이스 ${id} 가 사라졌다 — 이 방어를 지우지 마라`);
    assert.notEqual(row.pass, true, `${id}: 「못 쟀다」가 PASS 로 나왔다`);
    assert.equal(row.verdict, 'NOT_MEASURED', `${id}: verdict 가 NOT_MEASURED 여야 한다(현재 ${row.verdict})`);
  }
});

test('U-H7-4 ★하네스가 잘라 쓰는 제품 코드의 «의존 선언»을 다 실었다', () => {
  /* 본보기 U-GLOGIN-0·U-M63-0. 사람이 DEPS 를 손으로 맞추면 반드시 갈라지고,
     갈라지면 잘라 넣은 코드가 던져 «무한 대기»가 된다 — 빨간 실패보다 나쁘다. */
  const { missing } = loadIsAllCanvasEmpty(CHECKOUT);
  assert.deepEqual(missing, [],
    `하네스가 «안 실은» 선언: ${missing.join(', ')} — judge/lost-window.mjs 의 provided 에 추가하라`);
});

test('U-H7-4b [양성대조] 적재 검사기가 «빠진 의존»을 실제로 잡는다', () => {
  const src = 'function _dep(a){return a;}\nfunction _use(b){return _dep(b);}\n';
  assert.deepEqual(missingSymbols('function _use(b){return _dep(b);}', src, ['_use']), ['_dep'],
    '적재 검사기가 «빠진 의존»을 못 잡는다 — 이 검사기의 초록은 의미가 없다');
  assert.deepEqual(missingSymbols('function _use(b){return _dep(b);}', src, ['_use', '_dep']), [],
    '다 실었는데도 «빠졌다»고 한다 — 오탐');
});

test('U-H7-5 ★자를 자리가 사라지면 «조용히» 넘어가지 않는다', () => {
  assert.throws(() => loadIsAllCanvasEmpty(path.join(__dirname, '..', '..', 'tools')),
    /못 찾음|ENOENT|EISDIR/, '소스가 없거나 바뀌었는데 던지지 않으면 검사가 «옛 소스»를 본다');
});

test('U-H7-6 ★모든 대기에 상한이 있다 — 상한 없는 대기는 «만들 수 없다»', async () => {
  await assert.rejects(() => waitFor(() => true, { label: '상한 없음' }),
    e => e instanceof HarnessError, '상한 없는 waitFor 가 통과했다 — 무한 대기의 문이 열려 있다');
  const t0 = Date.now();
  await assert.rejects(() => waitFor(() => false, { timeout: 400, interval: 40, label: '절대 안 옴' }),
    e => e instanceof HarnessError);
  assert.ok(Date.now() - t0 < 3000, '상한이 안 걸렸다(매달렸다)');
});

test('U-H7-7 ★종료코드 규약 — HARNESS_ERROR 를 FAIL 로 접지 않는다', () => {
  assert.equal(EXIT.PASS, 0);
  assert.equal(EXIT.FAIL, 1);
  assert.equal(EXIT.HARNESS_ERROR, 3);
  assert.notEqual(EXIT.FAIL, EXIT.HARNESS_ERROR,
    '접는 순간 「도구가 고장난 것」이 「제품이 멀쩡한 것」으로 읽힌다');
});

test('U-H7-8 ★원본·코퍼스·현빈 작업본에는 «쓸 수 없다»', () => {
  const ids = ['GUARD-broken-refusesOriginalUd', 'GUARD-broken-refusesCorpusOriginal',
               'GUARD-broken-refusesHyunbinWorktree'];
  for (const id of ids) {
    const row = M.rows.find(r => r.id === id);
    assert.ok(row && row.separated, `${id}: 금지 경로 게이트가 «안» 막았다 — 사고가 난다`);
  }
});

test('U-H7-9 EMPTY_HEAD 가 제품 소스에 «실재»한다(계약 고정)', () => {
  const { body } = loadIsAllCanvasEmpty(CHECKOUT);
  assert.ok(body.startsWith(EMPTY_HEAD), '_isAllCanvasEmpty 를 잘라낸 결과가 머리와 다르다');
  assert.match(body, /checklistItems/, '제품의 «빈 캔버스» 정의가 바뀌었다 — 하네스 판정을 재확인하라');
});
