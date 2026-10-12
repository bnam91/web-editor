#!/usr/bin/env node
/* 변이 스윕 — 「없애면 빨강이 되는 테스트의 수」를 잰다(팀 표준).
 * 사용: node tools/mutation-sweep.js [필터문자열]
 *
 * ★★2026-10-10 — ★진단이 ★한 번 ★뒤집혔다. ★★다음 사람이 ★옛 티켓을 ★선례로 쓰지 ★않게 적는다:
 *   ★옛 진단: ★`:71` 의 `split/join` = ★전부치환 ⇒ ★★«결함»
 *   ★★실측(54 닻 전수): ★2회+ = ★★0건 ⇒ ★★오늘 ★물지 ★않는다 ⇒ ★★«결함»이 아니라 ★★«잠재 위험»이었다
 *   ⇒ ★★«코드 꼴»로 ★★«행동»을 ★단정한 것이다. ★그래서 ★아래 ★닻 수 검사로 ★★0건을 ★영구히 ★0건으로 잠갔다
 *   ★★★참 결함은 ★딴 데 있었다: ★★닻 ★3건이 ★이미 ★죽어 ★★«⛔를 찍으며 rc 0»이었다(★그 셋이 ★안 재고 초록)
 *     ⇒ ★54건 중 ★3건이 ★아무것도 ★무력화하지 ★않았는데 ★「전부 사망」으로 ★읽혔다 — ★★N 이 ★틀린 수였다
 * ★244 는 의미 없는 숫자다. 의미는 «가드를 지웠을 때 죽는 테스트»에 있다.
 * 변이는 tools/mutations.json 에 {name,file,find,replace} 로 적는다.
 * ★짝 — 이 자는 「가드를 지우면 검사가 죽나」를 잰다. 「검사의 «단언»이 제자리에서
 *   약해졌나」는 안 잰다(약해진 뒤에도 여기선 계속 «사망»으로 나온다).
 *   그 축은 tools/assert-strength.mjs 가 본다(T-177).
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

let survivors = 0, stale = 0, ambiguous = 0;
for (const m of muts) {
  if (filter && !m.name.includes(filter)) continue;
  const p = path.join(ROOT, m.file);
  const orig = fs.readFileSync(p, 'utf8');
  /* ★★닻을 «세어서» 가른다 — ⛔`includes`(있나)로는 ★두 가지를 ★못 가린다.
   *   ★0회 = ★★«낡은 닻»(소스가 바뀌었다) ⇒ ★그 항목은 ★★아무것도 ★무력화하지 ★않는다
   *   ★2회+ = ★★«겨눈 것보다 ★넓다» — ★아래 `split/join` 이 ★★전부 치환하므로 ★★딴 자리도 바뀐다
   *   ★★★그리고 ★둘 다 ★★rc 에 ★반영한다. ⛔옛 꼴은 ★★SKIP 만 찍고 ★`continue` 했고
   *     ★끝이 `survivors ? 1 : 0` 이라 ★★«⛔를 찍으며 rc 0»이었다(★2026-10-10 실측 · 3건).
   *     ⇒ ★★그러면 ★「54건 전부 사망」이 ★실은 ★51건인데 ★회차가 ★초록이다 — ★★N 이 ★틀린 수가 된다. */
  const hits = orig.split(m.find).length - 1;
  if (hits === 0) {
    stale++;
    console.log(`⚠️  SKIP(낡은 닻)  ${m.name} — find 가 소스에 ★0회(정의가 낡았다) ⇒ ★★이 항목은 아무것도 안 잰다`);
    continue;
  }
  if (hits > 1) {
    ambiguous++;
    console.log(`⛔ SKIP(모호한 닻)  ${m.name} — find 가 ★${hits}회 ⇒ split/join 이 ★전부 치환해 ★겨눈 것보다 넓다`);
    continue;
  }
  pending.set(p, orig);
  fs.writeFileSync(p, orig.split(m.find).join(m.replace));
  let dead;
  try { dead = runAll(); } finally { fs.writeFileSync(p, orig); pending.delete(p); }
  if (dead.length === 0) { survivors++; console.log(`❌ 생존  ${m.name}  — «지워도 전부 초록»`); }
  else console.log(`✅ 사망  ${m.name}  (${dead.length}) ${dead.slice(0, 3).join(' / ')}`);
}
console.log(`\n생존(=구멍) ${survivors}건 · ★낡은 닻 ${stale}건 · ★모호한 닻 ${ambiguous}건`);
/* ★★rc — ⛔«자는 ★마지막이 exit»이다. ★★«안 쟀다»를 ★★«초록»으로 ★내보내지 않는다.
 *   0 = 구멍 0 ＋ 닻 전부 1회      1 = ★생존(구멍)이 있다
 *   2 = 대상 트리가 더럽다 / 복원 실패(위)   ★★3 = ★★닻이 낡거나 모호하다(= ★그만큼 ★안 쟀다)
 * ⇒ ★★`survivors ? 1 : 0` 하나로는 ★★★«3건을 안 재고 초록»이 된다. ★그 자리를 막는다. */
if (stale || ambiguous) {
  console.error(`❌ 닻이 ★낡거나 ★모호한 항목 ${stale + ambiguous}건 — ★그만큼은 ★★«안 쟀다»다(⛔초록 아님).`);
  console.error(`   ⇒ ★낡은 닻은 ★지금 소스에 맞춰 ★되살려라. ★모호한 닻은 ★더 좁혀라.`);
  process.exit(survivors ? 1 : 3);
}
process.exit(survivors ? 1 : 0);
