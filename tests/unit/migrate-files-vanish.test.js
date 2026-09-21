/* T-065 — 「앱을 켜는 동안 옮기던 항목이 사라지면 부팅이 죽는다」
 *
 * ★무엇을 재나
 *   main.js 의 migrateFiles 는 앱이 «켜지는 길목»에서 세 번 통째로 돈다
 *   (projects · presets · templates). 목록을 한 번 읽어 두고(readdirSync) 그 이름으로
 *   파일 정보를 다시 묻는데(statSync/copyFileSync), 그 사이에 항목이 없어지면
 *   (다른 프로그램·클라우드 동기화) 예외가 그대로 위로 올라가 ★앱이 아예 안 켜진다.
 *
 * ★어떻게 재나 — «가짜 예외»를 던지지 않는다
 *   fs 를 통째로 흉내내면 「내가 만든 예외를 내가 잡았다」밖에 증명 못 한다.
 *   ⇒ 진짜 파일시스템 위에서 «진짜로 지운다». 목록을 읽은 «뒤», 그 이름을 쓰기 «전»에
 *     그 항목을 rmSync 한다. 그러면 ENOENT 는 커널이 만든 진짜다.
 *   ⇒ fs 껍데기가 하는 일은 «언제 지울지»(타이밍) 하나뿐이고, 나머지 호출은 전부
 *     진짜 fs 로 그대로 내려간다.
 *
 * ★main.js 는 Electron 없이 통째로 못 읽는다 ⇒ 그 함수 한 덩이만 «떼어내» 돌린다
 *   (선례: account-projects-root.test.js). 떼어내기는 공용 부품 _slice-block 하나로.
 *
 * ⛔이 검사를 「소스에 try 가 있나」로 바꾸지 마라 — 그건 «그렇게 적혀 있다»지
 *   «그렇게 돈다»가 아니다. 여기서 재는 것은 «돌린 결과»다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const realFs = require('fs');
const path = require('path');

const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { mkTmpRoot } = require('./_tmproot.js');

const SRC = readSrc(__dirname, '..', '..', 'main.js');
const BLOCK = sliceBlock(SRC, 'function migrateFiles(oldDir, newDir');

/** 진짜 fs 를 그대로 쓰되, 지정한 «순간»에 지정한 경로를 진짜로 지운다.
 *  hook = { on: 'readdirSync'|'statSync'|'mkdirSync', when: (arg)=>bool, kill: <경로> } */
function vanishingFs(hooks) {
  const fired = [];
  const shim = Object.create(realFs);
  for (const name of ['readdirSync', 'statSync', 'mkdirSync', 'existsSync', 'copyFileSync']) {
    shim[name] = (...args) => {
      const out = realFs[name](...args);
      for (const h of hooks) {
        if (h.on !== name || h.done) continue;
        if (!h.when(args[0])) continue;
        h.done = true;
        realFs.rmSync(h.kill, { recursive: true, force: true });   // ★진짜로 사라진다
        fired.push(h.kill);
      }
      return out;
    };
  }
  return { shim, fired };
}

/** 떼어낸 migrateFiles 를 주입한 fs·console 위에서 만든다. */
function load(fsImpl) {
  const logs = [];
  const factory = new Function('fs', 'path', 'console',
    BLOCK + '\n; return migrateFiles;');
  const fn = factory(fsImpl, path, {
    log: (...a) => logs.push(a.join(' ')),
    warn: (...a) => logs.push(a.join(' ')),
    error: (...a) => logs.push(a.join(' ')),
  });
  return { fn, logs };
}

/** 옛 자리에 파일 셋 + 하위폴더 하나를 깐다. */
function seed() {
  const root = mkTmpRoot('gdt-migrate-');
  const oldDir = path.join(root, 'old');
  const newDir = path.join(root, 'new');
  realFs.mkdirSync(path.join(oldDir, 'sub'), { recursive: true });
  realFs.writeFileSync(path.join(oldDir, 'a.json'), '{"a":1}');
  realFs.writeFileSync(path.join(oldDir, 'doomed.json'), '{"gone":true}');
  realFs.writeFileSync(path.join(oldDir, 'z.json'), '{"z":1}');
  realFs.writeFileSync(path.join(oldDir, 'sub', 'inner.json'), '{"in":1}');
  return { root, oldDir, newDir };
}

const read = p => realFs.readFileSync(p, 'utf8');

/* ── V1 ★본론: 목록을 읽은 뒤 statSync 전에 사라져도 부팅이 안 죽는다 ───────── */
test('V1 statSync 직전에 항목이 사라져도 던지지 않는다 (= 앱이 계속 켜진다)', () => {
  const { oldDir, newDir } = seed();
  const doomed = path.join(oldDir, 'doomed.json');
  const { shim, fired } = vanishingFs([
    { on: 'readdirSync', when: d => d === oldDir, kill: doomed },   // 목록을 읽자마자 사라진다
  ]);
  const { fn } = load(shim);

  assert.doesNotThrow(() => fn(oldDir, newDir),
    '★목록을 읽은 뒤 항목이 사라지면 던진다 — 이게 부팅 실패의 본체다');
  assert.deepStrictEqual(fired, [doomed], '주입이 «실제로» 일어났는지부터 확인한다');
});

/* ── V2 멀쩡한 쪽은 그대로 옮겨진다 (하나 사라졌다고 나머지를 버리지 않는다) ── */
test('V2 사라진 항목만 건너뛰고 나머지는 전부 옮긴다', () => {
  const { oldDir, newDir } = seed();
  const doomed = path.join(oldDir, 'doomed.json');
  const { shim } = vanishingFs([{ on: 'readdirSync', when: d => d === oldDir, kill: doomed }]);
  const { fn } = load(shim);
  fn(oldDir, newDir);

  assert.strictEqual(read(path.join(newDir, 'a.json')), '{"a":1}');
  assert.strictEqual(read(path.join(newDir, 'z.json')), '{"z":1}');
  assert.strictEqual(read(path.join(newDir, 'sub', 'inner.json')), '{"in":1}');
  assert.ok(!realFs.existsSync(path.join(newDir, 'doomed.json')), '사라진 것은 당연히 안 생긴다');
});

/* ── V3 기록 — «조용히» 건너뛰면 안 된다 ────────────────────────────────── */
test('V3 건너뛴 항목이 ⑴돌려주는 보고 와 ⑵로그 «둘 다»에 남는다', () => {
  const { oldDir, newDir } = seed();
  const doomed = path.join(oldDir, 'doomed.json');
  const { shim } = vanishingFs([{ on: 'readdirSync', when: d => d === oldDir, kill: doomed }]);
  const { fn, logs } = load(shim);
  const report = fn(oldDir, newDir);

  assert.ok(report && Array.isArray(report.skipped), '보고를 돌려줘야 부르는 쪽이 셀 수 있다');
  assert.strictEqual(report.skipped.length, 1, `건너뛴 것은 1건이어야 한다 — 실제 ${JSON.stringify(report && report.skipped)}`);
  assert.strictEqual(report.skipped[0].path, doomed, '★«무엇을» 못 옮겼는지가 있어야 나중에 이을 수 있다');
  assert.strictEqual(report.skipped[0].code, 'ENOENT');
  const line = logs.find(l => l.includes(doomed));
  assert.ok(line, `★로그에 안 남으면 조용한 건너뛰기다 — 남은 로그: ${JSON.stringify(logs)}`);
});

/* ── V4 copyFileSync 직전에 사라지는 경우(다른 틈) ───────────────────────── */
test('V4 statSync 뒤 copyFileSync 직전에 사라져도 던지지 않는다', () => {
  const { oldDir, newDir } = seed();
  const doomed = path.join(oldDir, 'doomed.json');
  const { shim, fired } = vanishingFs([
    { on: 'statSync', when: p => p === doomed, kill: doomed },   // 정보는 받았는데 그 다음 순간 사라진다
  ]);
  const { fn } = load(shim);
  let report;
  assert.doesNotThrow(() => { report = fn(oldDir, newDir); });
  assert.deepStrictEqual(fired, [doomed]);
  assert.strictEqual(report.skipped.length, 1);
  assert.strictEqual(read(path.join(newDir, 'z.json')), '{"z":1}', '나머지는 계속 옮겨진다');
});

/* ── V5 ★재귀 «안쪽» — 하위폴더가 통째로 사라지는 경우 ───────────────────
   카드 함정: 같은 함수를 부르는 자리가 셋이고 폴더를 만나면 자기 자신을 다시 부른다.
   한 곳만 고치면 재귀 안쪽에 같은 구멍이 남는다 ⇒ 여기서 그 안쪽을 직접 찌른다. */
test('V5 하위폴더가 readdirSync 직전에 사라져도 던지지 않고 기록에 남는다', () => {
  const { oldDir, newDir } = seed();
  const subOld = path.join(oldDir, 'sub');
  const subNew = path.join(newDir, 'sub');
  // 재귀 안쪽 순서: existsSync(old) → existsSync(new) → mkdirSync(new) → readdirSync(old)
  const { shim, fired } = vanishingFs([
    { on: 'mkdirSync', when: d => d === subNew, kill: subOld },
  ]);
  const { fn } = load(shim);
  let report;
  assert.doesNotThrow(() => { report = fn(oldDir, newDir) },
    '★재귀 안쪽에도 같은 구멍이 있으면 여기서 던진다');
  assert.deepStrictEqual(fired, [subOld]);
  assert.strictEqual(report.skipped.length, 1);
  assert.strictEqual(report.skipped[0].path, subOld, '재귀 안쪽 건너뜀도 «한 보고»에 모여야 한다');
  assert.strictEqual(read(path.join(newDir, 'a.json')), '{"a":1}');
});

/* ── V6 뿌리 자체가 사라지는 경우(깊이 0 = 부르는 자리 셋이 그대로 맞는 모양) ── */
test('V6 옛 뿌리가 existsSync 뒤 readdirSync 직전에 사라져도 던지지 않는다', () => {
  const { oldDir, newDir } = seed();
  const { shim } = vanishingFs([{ on: 'mkdirSync', when: d => d === newDir, kill: oldDir }]);
  const { fn } = load(shim);
  let report;
  assert.doesNotThrow(() => { report = fn(oldDir, newDir); });
  assert.strictEqual(report.skipped.length, 1);
  assert.strictEqual(report.skipped[0].path, oldDir);
});

/* ── V7 ★정상일 때 예전과 «똑같이» 돈다 (멀쩡한 쪽을 안 건드렸는지) ──────── */
test('V7 아무것도 안 사라지면 전부 옮기고, 건너뜀 0건이다', () => {
  const { oldDir, newDir } = seed();
  const { fn, logs } = load(realFs);
  const report = fn(oldDir, newDir);

  assert.strictEqual(read(path.join(newDir, 'a.json')), '{"a":1}');
  assert.strictEqual(read(path.join(newDir, 'doomed.json')), '{"gone":true}');
  assert.strictEqual(read(path.join(newDir, 'z.json')), '{"z":1}');
  assert.strictEqual(read(path.join(newDir, 'sub', 'inner.json')), '{"in":1}');
  assert.strictEqual(report.skipped.length, 0, `정상인데 건너뛰면 안 된다 — ${JSON.stringify(report.skipped)}`);
  assert.deepStrictEqual(logs, [], '정상일 때 경고가 나면 로그가 노이즈가 된다');
});

/* ── V8 ★「이미 있는 것을 덮지 않는다」 규칙이 살아 있는가 ────────────────
   카드 함정: 고치면서 이 규칙을 깨면 «새 파일을 옛 파일로 덮어쓴다». */
test('V8 새 자리에 이미 있는 파일은 덮지 않는다', () => {
  const { oldDir, newDir } = seed();
  realFs.mkdirSync(newDir, { recursive: true });
  realFs.writeFileSync(path.join(newDir, 'a.json'), '{"new":"keep me"}');
  const { fn } = load(realFs);
  fn(oldDir, newDir);
  assert.strictEqual(read(path.join(newDir, 'a.json')), '{"new":"keep me"}',
    '★옛 파일이 새 파일을 덮어썼다 — 마이그레이션의 제1규칙이 깨졌다');
});

/* ── V9 사라짐이 «아닌» 오류도 부팅을 죽이지 않고 기록에 남는가 ──────────
   ⛔여기서 「ENOENT 만 봐준다」는 명부를 만들지 않는다. 마이그레이션은 «best-effort»고,
     한 항목 때문에 앱이 안 켜지는 것이 이 카드의 본체다. 대신 «전부 기록»한다. */
test('V9 사라짐이 아닌 오류(EACCES 등)도 삼키지 않고 «기록하며» 건너뛴다', () => {
  const { oldDir, newDir } = seed();
  const doomed = path.join(oldDir, 'doomed.json');
  const shim = Object.create(realFs);
  shim.copyFileSync = (src, dst) => {
    if (src === doomed) { const e = new Error('permission denied'); e.code = 'EACCES'; throw e; }
    return realFs.copyFileSync(src, dst);
  };
  const { fn, logs } = load(shim);
  let report;
  assert.doesNotThrow(() => { report = fn(oldDir, newDir); });
  assert.strictEqual(report.skipped.length, 1);
  assert.strictEqual(report.skipped[0].code, 'EACCES');
  assert.ok(logs.some(l => l.includes('EACCES')), '조용히 삼키면 «위 판정 거짓말»이 된다');
  assert.strictEqual(read(path.join(newDir, 'z.json')), '{"z":1}');
});
