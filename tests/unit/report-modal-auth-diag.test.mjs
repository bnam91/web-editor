/* 단위 — js/report-modal.js 의 `mergeAuthDiag` (E3 신고 배선).
 *
 * ★왜 필요한가 — main.js `report:context.authDiag`(services/entitlement.js `diagLine`)를
 *   신고 payload 에 실어야 하는데, 서버는 최상위 `auth` 같은 «모르는 필드»를 400 도 없이
 *   조용히 버린다(지디 실측). `errors[]` 여야 도달한다 — 이 함수가 그 배선의 «심장」이다.
 * ⛔함수 «단독»을 재지 않는다(U-GLOGIN-0 규약) — report-buffer.js 검사와 같은 방식으로,
 *   `js/report-modal.js` «원본 바이트»를 vm 으로 그대로 실행해 노출된 진짜 함수를 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { readSrc } from './_srcread.js';        // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function boot() {
  const w = {
    electronAPI: null,
    document: { addEventListener() {}, getElementById() { return null; } },
  };
  const code = readSrc(__dirname, '../../js/report-modal.js');
  vm.runInNewContext(code, { window: w, document: w.document, Date, JSON, Object, Array, String, Error, Image: function () {} });
  return w.reportModalMergeAuthDiag;
}

test('E3-DIAG-1 빈 배열 + 진단 한 줄 → errors 에 level:"auth" 로 한 건 추가', () => {
  const merge = boot();
  const out = merge([], 'ent:sig_absent cls=sig_missing pass=0');
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'auth');
  assert.equal(out[0].msg, 'ent:sig_absent cls=sig_missing pass=0');
  assert.ok(out[0].at, '타임스탬프가 있어야 재현에 도움이 된다');
});

test('E3-DIAG-2 원본 errors 배열을 «변형하지 않는다»(순수) — 링버퍼가 다른 데서 또 쓰인다', () => {
  const merge = boot();
  const original = [{ level: 'console.error', msg: 'x' }];
  const out = merge(original, 'diag-line');
  assert.equal(original.length, 1, '입력 배열이 제자리에서 변형되면 안 된다');
  assert.equal(out.length, 2);
});

test('E3-DIAG-3 ★20건 상한 — 넘치면 «가장 오래된 것»부터 밀어내고 진단은 반드시 남는다', () => {
  const merge = boot();
  const full = [];
  for (let i = 0; i < 20; i++) full.push({ level: 'console.error', msg: 'e' + i });
  const out = merge(full, 'auth-diag-line');
  assert.equal(out.length, 20, '20건 상한(서버 LIMITS.ERRORS)을 넘으면 안 된다');
  assert.equal(out[19].msg, 'auth-diag-line', '진단 줄이 밀려나면 신고가 무의미해진다');
  assert.equal(out[0].msg, 'e1', '가장 오래된 e0 이 밀려나고 나머지는 순서대로 남는다');
});

test('E3-DIAG-4 ★1000자 상한(서버 LIMITS.ERROR_LEN) — 넘는 문자열은 잘린다', () => {
  const merge = boot();
  const long = 'x'.repeat(2000);
  const out = merge([], long);
  assert.equal(out[0].msg.length, 1000);
});

test('E3-DIAG-5 null/undefined authDiag 도 죽지 않는다(빈 문자열로)', () => {
  const merge = boot();
  assert.equal(merge([], null)[0].msg, '');
  assert.equal(merge([], undefined)[0].msg, '');
});

/* ── 신고 payload 에 실제로 도달하는 자격 진단에 email 이 없다(@ 문자 0) ─── */
test('E3-DIAG-6 ★entitlement.js diagLine 은 «@」 문자(이메일)를 안 만든다 — 실제 모듈로 확인', async () => {
  const entPath = path.join(__dirname, '../../services/entitlement.js');
  const entitlement = (await import(entPath)).default || (await import(entPath));
  const now = Date.now();
  const v = entitlement.classify(
    { email: 'user@example.com', accessUntil: '2027-01-01T00:00:00.000Z', sub: 'u1' },
    now,
    entitlement.PUBLIC_KEYS,
    entitlement.CONSTANTS
  );
  const line = entitlement.diagLine({ ...v, diag: { ...v.diag, iatAgeDays: 3 } });
  assert.ok(!line.includes('@'), 'diagLine 에 «@」(이메일 흔적)이 있다: ' + line);

  const merge = boot();
  const out = merge([], line);
  assert.ok(!out[0].msg.includes('@'), 'errors[] 에 실린 뒤에도 «@」 이 없어야 한다');
});
