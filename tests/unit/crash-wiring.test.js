/* U-H2-W — main.js 가 크래시 기록기를 «실제로 부르는가». (2026-09-06)
 *   실행: node --test "tests/unit/*.test.js"
 *
 * ★왜 파일이 따로인가
 *   main.js 는 프로세스당 한 번만 적재되고, 적재되는 순간 기록기가 «설치»된다.
 *   crash-record.test.mjs 는 설치를 여러 번 재현하며 재야 하므로 같이 못 산다.
 *
 * ★이 검사가 막는 것 — 「모듈은 완벽한데 아무도 안 부른다」
 *   오늘 이 프로젝트의 주된 실패 형태가 그것이다(신고 404 · 서버가 필드를 조용히 버림).
 *   main/crash/* 의 단위검사가 전부 초록이어도, main.js 의 두 줄이 지워지면 제품에는
 *   ★아무 일도 안 일어난다. 그 두 줄을 여기서 «부작용»으로 잰다 — 소스 문자열 검색이
 *   아니라(주석에 걸린다) 「적재했더니 설치돼 있더라」로.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();                                  // ★여기서 main.js 가 «진짜로» 돈다
const crash = require(path.join(__dirname, '../../main/crash'));

test('U-H2-W1 main.js 적재만으로 기록기가 «이미 설치돼» 있다', () => {
  const again = crash.install({});
  assert.equal(again.installed, false, '★main.js 가 install() 을 안 불렀다 — 모듈만 있고 제품엔 없다');
  assert.equal(again.reason, 'already');
});

test('U-H2-W2 기록처가 «앱의 userData» 안이고, 프로젝트 데이터와 섞이지 않는다', () => {
  const s = crash.stats();
  assert.equal(s.dir, path.join(H.userData, 'logs'), '기록처: ' + s.dir);
  assert.notEqual(s.dir, H.projectsDir);
  assert.ok(!s.dir.startsWith(H.projectsDir + path.sep), 'logs 가 projects 안에 있다 — 손상이 서로 옮는다');
  assert.ok(s.mainLogBytes >= 0, '부팅 한 줄이 안 남았다 — 설치가 도중에 죽었다는 뜻이다');
});

test('U-H2-W3 렌더러 미러 채널이 «main 에 등록»돼 있고, 실제로 붙는다', () => {
  assert.ok(H.hasSync('crash:mirror'), '★preload 가 부르는 crash:mirror 를 main 이 안 듣는다');
  H.invokeSync('crash:mirror', {}, {
    errors: [{ at: '2026-09-06T00:00:00.000Z', level: 'app', msg: '[W3-marker]' }], at: Date.now(),
  });
  crash.record('render-process-gone', { reason: 'crashed', wcId: 1 });
  const recent = crash.readRecent(1);
  assert.equal(recent.length, 1);
  assert.ok(JSON.stringify(recent[0].record.errors || []).includes('[W3-marker]'),
    '★미러가 채널을 타고 기록까지 «안 닿는다» — 배선 어딘가가 끊겼다');
});

test('U-H2-W4 메인 console.warn/error 가 logs/main.log 로도 흐른다', () => {
  console.warn('[U-H2-W4] 저장 실패 ' + path.join(require('os').homedir(), 'x/y.json'));
  const txt = fs.readFileSync(path.join(H.userData, 'logs', 'main.log'), 'utf8');
  assert.ok(txt.includes('[U-H2-W4]'), '메인이 «스스로 말한 것»이 파일에 안 남는다');
  assert.ok(!txt.includes(require('os').homedir()), '홈 경로가 그대로 남았다');
});
