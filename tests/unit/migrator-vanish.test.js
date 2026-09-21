/* T-065(2) — 「번들 마이그레이션 도중 항목이 그새 사라지면」 main/project-store/migrator.js
 *
 * ★앞선 T-065(32cbf37)은 main.js 의 migrateFiles 를 고쳤다. 부팅 길목의 «다른 한 짝»인
 *   이 모듈은 그때 손대지 않았다. 여기서 재는 것은 그 나머지다.
 *
 * ★무엇이 달랐나 — 이쪽은 앱을 «죽이지는» 않는다(부르는 자리가 try 로 감싸져 있다).
 *   대신 더 조용한 값을 내놓았다. 실측(고치기 전, 진짜 fs 위에서 진짜로 지움):
 *     ⑴ proj_<id>_history 안의 파일 «한 개»가 사라지면 → 그 프로젝트 «통째로» failed.
 *        flat 은 남으니 읽히긴 하지만, 매 기동 같은 자리에서 같은 실패를 되풀이한다.
 *     ⑵ ★quarantine 이동 도중 사이드카(proj_<id>_meta.json)가 사라지면 →
 *        throw → 부르는 쪽 catch 가 _cleanupPartialNew 로 ★검증까지 끝난 신 위치를 지운다.
 *        flat 은 이미 quarantine 으로 옮겨진 뒤라 결과는
 *          newProj=false · flatProj=false  ⇒ ★그 프로젝트가 앱에서 통째로 사라진다.
 *        「앱이 안 켜진다」보다 조용하고, 그래서 더 나쁘다.
 *
 * ★어떻게 재나 — «가짜 예외»를 던지지 않는다 (선례: migrate-files-vanish.test.js)
 *   진짜 파일시스템 위에서 «진짜로 지운다». fs 껍데기가 하는 일은 «언제 지울지» 하나뿐이고
 *   나머지 호출은 전부 진짜 fs 로 내려간다. ENOENT 는 커널이 만든 진짜다.
 *   (유일한 예외가 M6 이고, 거기 왜 그런지 적어 두었다.)
 *
 * ⛔이 검사를 「소스에 try 가 있나」로 바꾸지 마라 — 여기서 재는 것은 «돌린 결과»다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const realFs = require('fs');
const path = require('path');

const { readSrc } = require('./_srcread.js');
const { mkTmpRoot } = require('./_tmproot.js');

const MIG_PATH = path.join(__dirname, '..', '..', 'main', 'project-store', 'migrator.js');
const SRC = readSrc(MIG_PATH);

/** migrator.js 를 «주입한 fs 위에서» 통째로 한 벌 만든다(진짜 require 캐시는 안 건드린다). */
function loadMigrator(fsImpl) {
  const mod = { exports: {} };
  const req = (id) => (id === 'fs' ? fsImpl : require(id));
  const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', SRC);
  fn(req, mod, mod.exports, path.dirname(MIG_PATH), MIG_PATH);
  return mod.exports;
}

/** 진짜 fs 를 그대로 쓰되, 지정한 «순간»에 지정한 경로를 진짜로 지운다.
 *  hook = { on:'<메서드>'|'p:<promises 메서드>', when:(첫인자)=>bool, kill:<경로>,
 *           at?:'pre'|'post' (기본 pre — 'post' 는 «그 호출이 끝난 뒤»), throwEacces?:<경로> }
 *  when 은 (첫인자, 인자전체) 를 받는다 — 같은 파일이 여러 단계에서 열릴 때 «어느 단계»인지 가른다. */
function vanishingFs(hooks) {
  const fired = [];
  const bite = (name, args, at) => {
    for (const h of hooks) {
      if (h.on !== name || h.done) continue;
      if ((h.at || 'pre') !== at) continue;
      if (!h.when(args[0], args)) continue;
      h.done = true;
      if (h.kill) { realFs.rmSync(h.kill, { recursive: true, force: true }); fired.push(h.kill); }
      if (h.throwEacces) {
        fired.push(h.throwEacces);
        const e = new Error(`EACCES: permission denied, copyfile '${h.throwEacces}'`);
        e.code = 'EACCES';
        throw e;
      }
    }
  };
  const shim = Object.create(realFs);
  for (const n of ['readdirSync', 'statSync', 'existsSync', 'copyFileSync', 'mkdirSync',
                   'renameSync', 'readFileSync', 'writeFileSync', 'unlinkSync', 'rmSync', 'cpSync']) {
    shim[n] = (...a) => {
      bite(n, a, 'pre');                       // ★지우고 «나서» 진짜를 부른다
      const out = realFs[n](...a);
      bite(n, a, 'post');
      return out;
    };
  }
  const pshim = Object.create(realFs.promises);
  for (const n of ['readdir', 'copyFile', 'mkdir']) {
    pshim[n] = async (...a) => {
      if (n === 'readdir') { const out = await realFs.promises[n](...a); bite('p:' + n, a, 'pre'); return out; }
      bite('p:' + n, a, 'pre');
      const out = await realFs.promises[n](...a);
      bite('p:' + n, a, 'post');
      return out;
    };
  }
  Object.defineProperty(shim, 'promises', { value: pshim, configurable: true });
  return { shim, fired };
}

/** flat 레이아웃 프로젝트 둘(proj_A · proj_B)을 깐다. 각각 본체+백업+메타+history 3건. */
function seed() {
  const root = mkTmpRoot('gdt-migrator-');
  const pd = path.join(root, 'projects');
  realFs.mkdirSync(pd, { recursive: true });
  for (const id of ['proj_A', 'proj_B']) {
    realFs.writeFileSync(path.join(pd, `${id}.json`), JSON.stringify({ id, blocks: [1, 2, 3] }));
    realFs.writeFileSync(path.join(pd, `${id}_backup.json`), JSON.stringify({ id, bk: true }));
    realFs.writeFileSync(path.join(pd, `${id}_meta.json`), JSON.stringify({ id, m: 1 }));
    realFs.mkdirSync(path.join(pd, `${id}_history`), { recursive: true });
    for (let i = 0; i < 3; i++) realFs.writeFileSync(path.join(pd, `${id}_history`, `h${i}.json`), `{"h":${i}}`);
  }
  return { root, pd };
}

const P = (pd, id, ...rest) => path.join(pd, id, ...rest);
const has = p => realFs.existsSync(p);
/** ★「앱이 이 프로젝트를 아직 찾을 수 있나」 — 신 위치든 옛 위치든 본체 하나는 있어야 한다. */
const reachable = (pd, id) => has(P(pd, id, 'proj.json')) || has(path.join(pd, `${id}.json`));

function run(pd, shim, logs) {
  const m = loadMigrator(shim);
  return m.migrateAll(pd, { log: (lvl, msg, extra) => logs.push(`${lvl} ${msg} ${extra ? JSON.stringify(extra) : ''}`) });
}

/* ── M1 ★본론: history 파일 하나가 그새 사라져도 그 프로젝트는 «계속» 옮겨진다 ── */
test('M1 옮기는 도중 history 파일 하나가 사라져도 그 프로젝트가 주저앉지 않는다', async () => {
  const { pd } = seed();
  const doomed = path.join(pd, 'proj_A_history', 'h1.json');
  const { shim, fired } = vanishingFs([
    { on: 'p:readdir', when: p => String(p) === path.join(pd, 'proj_A_history'), kill: doomed },
  ]);
  const logs = [];
  const res = await run(pd, shim, logs);

  assert.deepStrictEqual(fired, [doomed], '주입이 «실제로» 일어났는지부터 확인한다');
  assert.deepStrictEqual(res.failed, [], `★파일 한 개 때문에 프로젝트 전체가 실패하면 안 된다: ${JSON.stringify(res.failed)}`);
  assert.ok(res.migrated.includes('proj_A'), 'proj_A 는 그 항목만 빼고 옮겨져야 한다');
  assert.ok(has(P(pd, 'proj_A', 'proj.json')), '본체는 신 위치로 갔다');
  assert.ok(has(P(pd, 'proj_A', 'proj_history', 'h0.json')), '멀쩡한 history 는 그대로 옮겨진다');
  assert.ok(has(P(pd, 'proj_A', 'proj_history', 'h2.json')), '멀쩡한 history 는 그대로 옮겨진다');
  assert.ok(!has(P(pd, 'proj_A', 'proj_history', 'h1.json')), '사라진 것은 당연히 안 생긴다');
});

/* ── M2 ⛔조용히 삼키지 않는다: 건너뜀이 ⑴보고 ⑵로그 ⑶마커 «셋 다»에 남는다 ── */
test('M2 건너뛴 항목이 보고·로그·마커 «셋 다»에 남는다 (삼키지 않는다)', async () => {
  const { pd } = seed();
  const doomed = path.join(pd, 'proj_A_history', 'h1.json');
  const { shim } = vanishingFs([
    { on: 'p:readdir', when: p => String(p) === path.join(pd, 'proj_A_history'), kill: doomed },
  ]);
  const logs = [];
  const res = await run(pd, shim, logs);

  // ⑴ 돌려주는 보고
  assert.ok(Array.isArray(res.itemsSkipped), 'result.itemsSkipped 가 있어야 한다');
  assert.strictEqual(res.itemsSkipped.length, 1, `건너뜀 1건이 보고에 있어야 한다: ${JSON.stringify(res.itemsSkipped)}`);
  const rec = res.itemsSkipped[0];
  assert.strictEqual(rec.id, 'proj_A');
  assert.strictEqual(rec.path, doomed, '어떤 항목을 건너뛰었는지 «경로»로 지목해야 한다');
  assert.strictEqual(rec.code, 'ENOENT', '왜 건너뛰었는지 코드가 남아야 한다');
  assert.ok(rec.message && /h1\.json/.test(rec.message), '메시지도 같이 남는다');

  // ⑵ 로그 (options.log)
  assert.ok(logs.some(l => l.startsWith('warn') && l.includes('h1.json')),
    `★건너뜀이 로그에 한 줄도 안 남으면 「위 판정 거짓말」이다: ${JSON.stringify(logs)}`);

  // ⑶ 마커 — 나중에 「파일이 없어졌다」를 이 자리와 이을 수 있게
  const marker = JSON.parse(realFs.readFileSync(P(pd, 'proj_A', '.migrated.json'), 'utf8'));
  assert.ok(Array.isArray(marker.skipped) && marker.skipped.length === 1,
    `마커에도 건너뜀이 남아야 한다: ${JSON.stringify(marker.skipped)}`);
  assert.strictEqual(marker.skipped[0].path, doomed);

  // ⑷ 디스크의 migration-log.json 에도
  const disk = JSON.parse(realFs.readFileSync(res.logPath, 'utf8'));
  assert.ok(disk[disk.length - 1].itemsSkipped.some(r => r.path === doomed),
    'migration-log.json 에도 남아야 한다');
});

/* ── M3 ★가장 나쁜 값: quarantine 도중 사라짐이 프로젝트를 «지워버리면» 안 된다 ── */
test('M3 quarantine 이동 도중 사이드카가 사라져도 프로젝트가 앱에서 사라지지 않는다', async () => {
  const { pd } = seed();
  const doomed = path.join(pd, 'proj_A_meta.json');
  // ★자기 existsSync 는 통과시키고, «자기 renameSync 직전»에 사라진다 = 진짜 경합 창
  const { shim, fired } = vanishingFs([
    { on: 'renameSync', when: p => String(p) === doomed, kill: doomed },
  ]);
  const logs = [];
  const res = await run(pd, shim, logs);

  assert.deepStrictEqual(fired, [doomed], '주입이 «실제로» 일어났는지부터 확인한다');
  assert.ok(reachable(pd, 'proj_A'),
    '★신 위치도 옛 위치도 없으면 그 프로젝트는 앱에서 통째로 사라진 것이다 — 부팅 실패보다 나쁘다');
  assert.ok(has(P(pd, 'proj_A', 'proj.json')), '검증까지 끝난 신 위치 사본을 지우면 안 된다');
  assert.deepStrictEqual(res.failed, [], `실패로 주저앉으면 안 된다: ${JSON.stringify(res.failed)}`);
  assert.ok(res.migrated.includes('proj_A'));
  // ⛔조용히는 아니다
  assert.ok(res.itemsSkipped.some(r => r.path === doomed && r.kind === 'quarantine-vanished'),
    `사라진 사이드카가 보고에 남아야 한다: ${JSON.stringify(res.itemsSkipped)}`);
  assert.ok(logs.some(l => l.startsWith('warn') && l.includes('proj_A_meta.json')),
    '로그에도 한 줄 남아야 한다');
});

/* ── M4 정상 경로 회귀: 아무것도 안 사라지면 «예전과 똑같이» 돈다 ────────────── */
test('M4 아무것도 안 사라지면 옮기기가 예전과 똑같다 (건너뜀 0건)', async () => {
  const { pd } = seed();
  const { shim, fired } = vanishingFs([]);
  const logs = [];
  const res = await run(pd, shim, logs);

  assert.deepStrictEqual(fired, [], '이 벌에서는 아무것도 안 사라진다');
  assert.deepStrictEqual(res.migrated.sort(), ['proj_A', 'proj_B']);
  assert.deepStrictEqual(res.failed, []);
  assert.deepStrictEqual(res.itemsSkipped, [], '멀쩡할 때 건너뜀이 «한 건이라도» 생기면 고침이 멀쩡한 쪽을 건드린 것이다');
  for (const id of ['proj_A', 'proj_B']) {
    assert.ok(has(P(pd, id, 'proj.json')), `${id} 본체`);
    assert.ok(has(P(pd, id, 'proj_backup.json')), `${id} 백업`);
    assert.ok(has(P(pd, id, 'proj_meta.json')), `${id} 메타`);
    for (let i = 0; i < 3; i++) assert.ok(has(P(pd, id, 'proj_history', `h${i}.json`)), `${id} history h${i}`);
    assert.ok(has(P(pd, id, '.migrated.json')), `${id} 마커`);
    assert.ok(!has(path.join(pd, `${id}.json`)), `${id} flat 원본은 quarantine 으로 갔다`);
  }
  const qroot = path.join(pd, '.quarantine');
  const qfiles = realFs.readdirSync(qroot).flatMap(d => realFs.readdirSync(path.join(qroot, d)));
  assert.deepStrictEqual(qfiles.sort(), [
    'proj_A.json', 'proj_A_backup.json', 'proj_A_history', 'proj_A_meta.json',
    'proj_B.json', 'proj_B_backup.json', 'proj_B_history', 'proj_B_meta.json',
  ], 'flat 8건이 전부 quarantine 에 보관된다 (지우지 않는다)');
});

/* ── M5 이웃은 안 건드린다: 하나가 사라져도 나머지 프로젝트는 온전하다 ──────── */
test('M5 한 프로젝트에서 사라짐이 나도 이웃 프로젝트는 온전히 옮겨진다', async () => {
  const { pd } = seed();
  const { shim } = vanishingFs([
    { on: 'p:readdir', when: p => String(p) === path.join(pd, 'proj_A_history'), kill: path.join(pd, 'proj_A_history', 'h1.json') },
  ]);
  const res = await run(pd, shim, []);

  assert.ok(res.migrated.includes('proj_B'));
  for (let i = 0; i < 3; i++) assert.ok(has(P(pd, 'proj_B', 'proj_history', `h${i}.json`)), `proj_B history h${i} 온전`);
  assert.ok(has(P(pd, 'proj_B', '.migrated.json')));
  assert.ok(!res.itemsSkipped.some(r => r.id === 'proj_B'), '이웃에는 건너뜀이 없어야 한다');
});

/* ── M6 ⛔삼키기 금지의 반대편: «있는데 못 옮긴» 것은 여전히 실패로 잡는다 ────
 *   ★여기 하나만 예외적으로 «만든 예외»(EACCES)를 쓴다. 이유를 적어 둔다 —
 *     재는 것이 「예외를 누가 만들었나」가 아니라 ★「끝난 뒤의 상태」이기 때문이다.
 *     그 파일은 «지금도 src 에 있다». 그러면 _verifyDirCopy 가 반드시 잡아야 하고,
 *     그 프로젝트는 migrated 가 아니라 failed 여야 하며 flat 이 보존돼야 한다.
 *     ⇒ 이 벌이 초록이면 「사라짐 봐주기」가 「전부 봐주기」로 번지지 않았다는 뜻이다.
 *   (⚠️진짜 커널 EACCES 로는 못 쟀다 — chmod 는 root 로 돌면 안 물린다.) */
test('M6 «사라짐이 아닌» 오류는 여전히 실패로 잡는다 (삼키기가 번지지 않았다)', async () => {
  const { pd } = seed();
  const blocked = path.join(pd, 'proj_A_history', 'h1.json');
  const { shim, fired } = vanishingFs([
    { on: 'p:copyFile', when: p => String(p) === blocked, throwEacces: blocked },
  ]);
  const res = await run(pd, shim, []);

  assert.deepStrictEqual(fired, [blocked], '주입이 «실제로» 일어났는지부터 확인한다');
  assert.ok(realFs.existsSync(blocked), '이 벌의 전제 — 그 파일은 «사라지지 않았다»');
  assert.ok(!res.migrated.includes('proj_A'),
    '★있는데 못 옮긴 파일을 두고 migrated 라고 하면 그게 「위 판정 거짓말」이다');
  assert.ok(res.failed.some(f => f.id === 'proj_A'), `failed 로 잡혀야 한다: ${JSON.stringify(res)}`);
  assert.ok(has(path.join(pd, 'proj_A.json')), 'flat 원본은 보존된다 (다음 기동에 재시도)');
  assert.ok(!has(P(pd, 'proj_A', '.migrated.json')), '마커를 남기면 안 된다 — 남기면 재시도를 못 한다');
});

/* ── M7 멱등: 건너뜀이 있었어도 두 번째 기동은 조용히 skip 한다 ──────────────── */
test('M7 건너뜀이 있었어도 다음 기동은 다시 옮기지 않는다 (멱등)', async () => {
  const { pd } = seed();
  const { shim } = vanishingFs([
    { on: 'p:readdir', when: p => String(p) === path.join(pd, 'proj_A_history'), kill: path.join(pd, 'proj_A_history', 'h1.json') },
  ]);
  await run(pd, shim, []);
  const again = await run(pd, vanishingFs([]).shim, []);

  assert.deepStrictEqual(again.migrated, [], '두 번째엔 옮길 것이 없다');
  assert.deepStrictEqual(again.skipped.sort(), ['proj_A', 'proj_B'], '둘 다 marker 로 skip');
  assert.deepStrictEqual(again.failed, []);
  assert.deepStrictEqual(again.itemsSkipped, []);
});

/* ── M8 반대 방향의 경합: «복사한 «뒤»에» 사라져도 멀쩡한 옮기기를 실패로 만들지 않는다 ──
 *   ★옛 판의 검증은 src·dst 의 «개수»를 비교했다. 그러면 이 방향에서 틀린다 —
 *     다 옮겨 놓고 원본만 없어졌는데 src=n-1, dst=n 이라 「entries mismatch」로 샜다.
 *     즉 개수 비교는 «양쪽으로» 틀린다. 이 벌이 그 두 번째 쪽을 잡는다. */
test('M8 복사가 끝난 «뒤»에 원본이 사라져도 멀쩡한 옮기기를 실패로 만들지 않는다', async () => {
  const { pd } = seed();
  const doomed = path.join(pd, 'proj_A_history', 'h1.json');
  const { shim, fired } = vanishingFs([
    { on: 'p:copyFile', at: 'post', when: p => String(p) === doomed, kill: doomed },
  ]);
  const res = await run(pd, shim, []);

  assert.deepStrictEqual(fired, [doomed], '주입이 «실제로» 일어났는지부터 확인한다');
  assert.ok(has(P(pd, 'proj_A', 'proj_history', 'h1.json')), '이 벌의 전제 — 복사는 «성공했다»');
  assert.deepStrictEqual(res.failed, [], `★다 옮겨 놓고 실패로 새면 안 된다: ${JSON.stringify(res.failed)}`);
  assert.ok(res.migrated.includes('proj_A'));
  assert.deepStrictEqual(res.itemsSkipped, [], '건너뛴 것이 없다 — 있다고 적으면 그것도 거짓 기록이다');
});

/* ── M9 quarantine 이 «시작된 뒤» 진짜 이동 실패가 나면 신 위치를 지우지 않는다 ──
 *   ★M3 이 잡는 것은 「사라짐」이고, 이 벌이 잡는 것은 그 «다음 칸»이다 —
 *     사라짐이 아닌 진짜 실패(EACCES/EXDEV)로 이동이 중간에 멈췄을 때.
 *     그 시점엔 flat 본체가 이미 quarantine 으로 갔을 수 있어,
 *     신 위치를 지우면 ★유일하게 남은 사본을 지우는 것이 된다.
 *   (여기도 예외는 «만든 것»이다 — M6 과 같은 이유로 재는 것은 «끝난 뒤의 상태»다.) */
test('M9 quarantine 도중 진짜 이동 실패가 나도 유일본(신 위치)을 지우지 않는다', async () => {
  const { pd } = seed();
  const stuck = path.join(pd, 'proj_A_meta.json');
  const { shim, fired } = vanishingFs([
    { on: 'renameSync',   when: p => String(p) === stuck, throwEacces: stuck },
    // ⚠️같은 파일이 [b]복사 단계에서도 copyFileSync 로 열린다 — 목적지로 «단계»를 가른다.
    { on: 'copyFileSync', when: (p, a) => String(p) === stuck && String(a[1]).includes('.quarantine'), throwEacces: stuck },
  ]);
  const res = await run(pd, shim, []);

  assert.strictEqual(fired.length, 2, '주입이 «실제로» 두 번 일어났는지부터 확인한다');
  assert.ok(realFs.existsSync(stuck), '이 벌의 전제 — 그 파일은 «사라지지 않았다»');
  assert.ok(res.failed.some(f => f.id === 'proj_A'), `진짜 이동 실패는 failed 로 잡혀야 한다: ${JSON.stringify(res)}`);
  assert.ok(!has(path.join(pd, 'proj_A.json')), '이 벌의 전제 — flat 본체는 이미 quarantine 으로 갔다');
  assert.ok(reachable(pd, 'proj_A'),
    '★flat 이 옮겨진 뒤 신 위치까지 지우면 그 프로젝트는 앱에서 통째로 사라진다');
  assert.ok(has(P(pd, 'proj_A', 'proj.json')), '유일하게 남은 사본을 보존해야 한다');
  assert.ok(!has(P(pd, 'proj_A', '.migrated.json')), '마커는 안 남긴다 — 다음 기동이 이어서 판정한다');
});
