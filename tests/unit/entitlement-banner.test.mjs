/* 단위 — js/entitlement-banner.js (E3-b ㉯: 잠그기 전 exp−7일 예고 판정).
 *
 * ★U-GLOGIN-0 규약 — 실제 파일을 vm 으로 그대로 실행해서 잰다(report-buffer.js 검사와 같은 방식).
 * ★핵심 — legacy_grace(daysUntilSigStale===null)는 배너 대상에서 «자동으로» 빠져야 한다
 *   (지디 결정 ⒜). 창 밖(0~7일 밖)도 안 뜬다. 문구에 위협적 낱말이 없어야 한다(정보지 제한이 아니다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function boot() {
  const w = {};
  const code = fs.readFileSync(path.join(__dirname, '../../js/entitlement-banner.js'), 'utf8');
  vm.runInNewContext(code, { window: w });
  return w.EntitlementBanner;
}

const st = (over) => Object.assign({ status: 'signature_ok', daysUntilSigStale: 3 }, over);

test('EB-1 창 안(0~7일) + status:signature_ok → 배너 뜬다', () => {
  const B = boot();
  const r = B.decideExpiryBanner(st({ daysUntilSigStale: 3 }));
  assert.ok(r);
  assert.equal(r.days, 3);
  assert.match(r.text, /인터넷/);
});

test('EB-2 경계값 — 정확히 7일이면 뜨고, 8일이면 안 뜬다', () => {
  const B = boot();
  assert.ok(B.decideExpiryBanner(st({ daysUntilSigStale: 7 })));
  assert.equal(B.decideExpiryBanner(st({ daysUntilSigStale: 8 })), null);
});

test('EB-3 경계값 — 0일(오늘)은 뜨고, 음수(이미 지남 — 다른 화면 몫)는 안 뜬다', () => {
  const B = boot();
  assert.ok(B.decideExpiryBanner(st({ daysUntilSigStale: 0 })));
  assert.equal(B.decideExpiryBanner(st({ daysUntilSigStale: -1 })), null);
});

test('EB-4 ★★daysUntilSigStale:null(legacy_grace 의 모양) → 배너 안 뜬다(자동 제외)', () => {
  const B = boot();
  assert.equal(B.decideExpiryBanner(st({ daysUntilSigStale: null, status: 'legacy_grace' })), null);
});

test('EB-5 status 가 signature_ok 가 아니면(예: sig_expired) 숫자가 창 안이어도 안 뜬다', () => {
  const B = boot();
  assert.equal(B.decideExpiryBanner(st({ status: 'sig_expired', daysUntilSigStale: 2 })), null);
  assert.equal(B.decideExpiryBanner(st({ status: 'locked', daysUntilSigStale: 2 })), null);
  assert.equal(B.decideExpiryBanner(st({ status: 'signature_missing', daysUntilSigStale: 2 })), null);
});

test('EB-6 st 자체가 없으면 안전하게 null', () => {
  const B = boot();
  assert.equal(B.decideExpiryBanner(null), null);
  assert.equal(B.decideExpiryBanner(undefined), null);
});

test('EB-7 ★문구에 위협적 낱말이 없다(정보지 제한이 아니다) — 잠김·막힘·차단 0', () => {
  const B = boot();
  const banned = ['잠깁니다', '잠김', '막힙니다', '차단', '중단'];
  for (let d = 0; d <= 7; d++) {
    const r = B.decideExpiryBanner(st({ daysUntilSigStale: d }));
    for (const w of banned) assert.ok(!r.text.includes(w), `day=${d} 문구에 «${w}»: ${r.text}`);
  }
});

test('EB-8 daysUntilSigStale 이 숫자가 아니면(undefined·NaN·문자열) null', () => {
  const B = boot();
  assert.equal(B.decideExpiryBanner(st({ daysUntilSigStale: undefined })), null);
  assert.equal(B.decideExpiryBanner(st({ daysUntilSigStale: NaN })), null);
  assert.equal(B.decideExpiryBanner(st({ daysUntilSigStale: '3' })), null, '★문자열 "3" 은 Number.isFinite 가 false — 타입까지 본다');
});
