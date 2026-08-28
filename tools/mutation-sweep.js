#!/usr/bin/env node
/* 변이 스윕 — 「없애면 빨강이 되는 테스트의 수」를 잰다(팀 표준).
 * 사용: node tools/mutation-sweep.js [필터문자열]
 * ★244 는 의미 없는 숫자다. 의미는 «가드를 지웠을 때 죽는 테스트»에 있다.
 * 변이는 tools/mutations.json 에 {name,file,find,replace} 로 적는다.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const muts = JSON.parse(fs.readFileSync(path.join(__dirname, 'mutations.json'), 'utf8'));
const filter = process.argv[2];

/* ★이 도구는 «워킹트리를 고쳤다가 되돌린다». 그래서 두 가지를 반드시 지킨다:
 *   ⑴ 시작 전에 대상 파일이 «깨끗한지» 본다 — 안 그러면 앞선 실행이 죽으며 남긴 변이 위에서
 *      스윕이 돌아 결과가 통째로 오염된다(실제로 그랬다: 타임아웃으로 죽은 실행이 남긴
 *      「프룬 미호출」 변이 위에서 14건을 돌려 «생존» 판정이 전부 못 믿을 값이 됐다).
 *   ⑵ 어떻게 죽어도 되돌린다 — finally 만으로는 SIGTERM/SIGINT 를 못 잡는다.
 *   ★★측정 도구가 자기 실행 환경을 오염시키면 그 숫자는 «거짓말»이다. 실패보다 나쁘다. */
const targets = [...new Set(muts.map(m => m.file))];
{
  const st = cp.execSync('git status --porcelain -- ' + targets.map(t => JSON.stringify(t)).join(' '),
                         { cwd: ROOT, encoding: 'utf8' }).trim();
  if (st) {
    console.error('⛔변이 대상 파일이 이미 수정돼 있다 — 스윕을 시작하지 않는다(결과가 오염된다):\n' + st);
    console.error('   커밋하거나 `git checkout --` 로 되돌린 뒤 다시 돌려라.');
    process.exit(2);
  }
}
/** 변이 중인 파일을 어떤 종료 경로에서도 되돌린다. */
const pending = new Map();   // path → 원본
/* ⚠️★복원 «자체»가 실패할 수 있다 — 디스크가 꽉 차서 죽는 경우가 그렇다(실제로 났다:
 *   ENOSPC 로 스윕이 죽었고, 되돌리는 writeFileSync 도 같은 이유로 실패해 변이가 트리에 남았다).
 *   조용히 삼키면 «남은 변이 위에서» 다음 작업을 하게 된다. 크게 소리쳐 알린다.
 *   ⇒ 그래도 못 되돌리면 시작 전 청결검사가 다음 실행을 막아준다(2중 안전). */
function restoreAll() {
  for (const [p, orig] of pending) {
    try { fs.writeFileSync(p, orig); }
    catch (e) {
      console.error(`\n⛔⛔ 복원 실패 — «변이가 워킹트리에 남았다»: ${p}\n   ${e.message}\n`
        + `   ⇒ 즉시 \`git checkout -- ${p}\` 하라. 이 상태로 테스트를 믿으면 안 된다.`);
    }
  }
  pending.clear();
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { restoreAll(); process.exit(130); });
process.on('exit', restoreAll);
process.on('uncaughtException', (e) => { restoreAll(); throw e; });
const files = fs.readdirSync(path.join(ROOT, 'tests/unit'))
  .filter(f => /\.test\.(js|mjs)$/.test(f)).map(f => path.join(ROOT, 'tests/unit', f));

function runAll() {
  const dead = [];
  for (const f of files) {
    const r = cp.spawnSync(process.execPath, [f], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
    const out = (r.stdout || '') + (r.stderr || '');
    for (const m of out.matchAll(/^✖ (.+?) \(/gm)) dead.push(m[1].trim());
  }
  return dead;
}

let survivors = 0;
for (const m of muts) {
  if (filter && !m.name.includes(filter)) continue;
  const p = path.join(ROOT, m.file);
  const orig = fs.readFileSync(p, 'utf8');
  if (!orig.includes(m.find)) { console.log(`⚠️  SKIP  ${m.name} — find 문자열이 소스에 없다(변이 정의가 낡았다)`); continue; }
  pending.set(p, orig);
  fs.writeFileSync(p, orig.split(m.find).join(m.replace));
  let dead;
  try { dead = runAll(); } finally { fs.writeFileSync(p, orig); pending.delete(p); }
  if (dead.length === 0) { survivors++; console.log(`❌ 생존  ${m.name}  — «지워도 전부 초록»`); }
  else console.log(`✅ 사망  ${m.name}  (${dead.length}) ${dead.slice(0, 3).join(' / ')}`);
}
console.log(`\n생존(=구멍) ${survivors}건`);
process.exit(survivors ? 1 : 0);
