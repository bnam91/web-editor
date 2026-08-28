/* _tmproot 자체 검증 — ★하네스가 «자기 자신»을 재는 일이라 특히 조심한다.
 * 오늘 배운 것: 「전부 실패시키는 하네스로는 부분실패를 못 잰다」.
 * 그래서 단언마다 «양성대조»(그 상황이 정말 성립하나)를 같이 둔다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const T = require('./_tmproot.js');

const TMP = os.tmpdir();
const RUNNER = path.join(__dirname, '_tmproot.js');

test('T1 임시루트는 «우산 아래»에 생긴다 — 회수 단위가 1개다', () => {
  const r = T.mkTmpRoot('t1-');
  assert.ok(r.startsWith(T.umbrella() + path.sep), `${r} 가 우산 밖이다`);
  assert.match(path.basename(T.umbrella()), T._UMBRELLA_RE, '우산 이름이 goya-run-<pid> 가 아니다');
});

test('T2 ★SIGKILL 로 죽여도 «다음 실행»이 잔재를 회수한다 (종료훅이 안 도는 경로)', () => {
  const src = [
    `const T=require(${JSON.stringify(RUNNER)});`,
    `const d=T.mkTmpRoot('t2-');`,
    `require('fs').writeFileSync(d+'/big.bin','x'.repeat(1024));`,
    `console.log(T.umbrella());`,
    `setTimeout(()=>{},60000);`,
  ].join('');
  const child = spawnSync(process.execPath, ['-e', src],
    { encoding: 'utf8', timeout: 4000, killSignal: 'SIGKILL' });
  const umb = String(child.stdout || '').trim().split('\n')[0];

  // ★양성대조: 잔재가 실제로 남아야 이 테스트가 성립한다.
  //   (종료훅이 돌아 이미 지워졌다면 SIGKILL 경로를 재는 게 아니다.)
  assert.ok(umb, '자식이 우산 경로를 못 찍었다');
  assert.equal(fs.existsSync(umb), true, '★잔재가 없다 — SIGKILL 경로를 재고 있지 않다');

  // ★★여기서 reapDeadUmbrellas() 를 «직접 부르지 않는다».
  //   직접 부르면 「함수가 동작한다」만 재고 「실행 시작 시 자동으로 돈다」는 «안 재진다».
  //   (실제로 그렇게 짰다가 변이 M2 「회수 호출 제거」가 살아남았다 — 배선을 안 재고 있었다.)
  //   그래서 «아무것도 모르는 새 프로세스»가 그냥 mkTmpRoot 를 부르게 하고, 그 부수효과로
  //   잔재가 사라지는지를 잰다.
  const fresh = spawnSync(process.execPath, ['-e',
    `require(${JSON.stringify(RUNNER)}).mkTmpRoot('t2b-');`
  ], { encoding: 'utf8', timeout: 8000 });
  assert.equal(fresh.status, 0, `새 실행이 실패했다: ${fresh.stderr}`);
  assert.equal(fs.existsSync(umb), false,
    `★새 실행이 죽은 pid 의 잔재를 회수하지 않았다(회수가 시작 경로에 배선 안 됨): ${umb}`);
});

test('T3 ★살아있는 pid 의 우산은 «절대» 안 건드린다 — 남의 병렬 실행을 죽이면 안 된다', () => {
  const mine = T.umbrella();
  const alivePid = process.ppid || 1;          // 확실히 살아있는 «다른» pid
  const aliveDir = path.join(TMP, `goya-run-${alivePid}`);
  fs.mkdirSync(aliveDir, { recursive: true });
  fs.writeFileSync(path.join(aliveDir, 'keep.txt'), 'x');
  try {
    T.reapDeadUmbrellas();
    assert.equal(fs.existsSync(aliveDir), true,
      '★살아있는 pid 의 우산을 지웠다 — 남의 작업을 죽이는 버그다');
    assert.equal(fs.existsSync(mine), true, '내 우산을 지웠다');
  } finally {
    fs.rmSync(aliveDir, { recursive: true, force: true });
  }
});

test('T4 ★디스크 여유가 모자라면 «시작을 거부»하고, 문구에 숫자가 있다', () => {
  const free = T.freeBytes();
  assert.ok(free > 0, 'freeBytes 를 못 쟀다 — 이 테스트가 성립 안 한다(양성대조)');

  const needGb = Math.ceil(free / 1024 ** 3) + 10;   // 지금 여유보다 확실히 큰 요구치
  assert.throws(() => T.requireFreeSpace(needGb), (e) => {
    assert.equal(e.code, 'GOYA_LOW_DISK', 'code 가 GOYA_LOW_DISK 가 아니다');
    assert.match(e.message, /여유 [\d.]+GB/, '★여유량 숫자가 없다 — 사람이 뭘 지울지 모른다');
    assert.match(e.message, /필요 [\d.]+GB/, '★필요량 숫자가 없다');
    assert.match(e.message, /goya-run-\*/, '무엇을 치우면 되는지 안 알려준다');
    return true;
  });

  // ★양성대조: 항상 던지는 게 아니다. 충분하면 통과한다.
  assert.equal(T.requireFreeSpace(0.001).ok, true);
});

test('T5 ★못 재는 경우를 «여유 있다»로도 «없다»로도 단정하지 않는다', () => {
  const missing = path.join(TMP, 'goya-nonexistent-for-test');
  assert.equal(T.freeBytes(missing), null, 'df 실패를 null 로 안 돌려준다');
  // 못 재면 «막지 않는다» — 오탐으로 남의 CI 를 세우지 않는다.
  assert.equal(T.requireFreeSpace(0.001).ok, true);
});

test('T6 정리하면 우산이 통째로 사라진다', () => {
  const u = T.umbrella();
  T.mkTmpRoot('t6-a-'); T.mkTmpRoot('t6-b-');
  assert.equal(fs.existsSync(u), true);
  T._cleanup();
  assert.equal(fs.existsSync(u), false, '우산이 남았다');
});
