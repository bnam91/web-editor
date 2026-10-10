/* tmproot-sole-owner — 「★임시 디렉터리를 ★치우는 자가 ★★`_tmproot.js` ★하나인가」의 ★자.
 *
 * ★★왜 있나 (2026-10-10 · 지디 ⑶)
 *   ★이 세션의 ★안전 훅이 ★`rm` 하나를 ★막았다 — ★「possibly-empty variable path: `"$D/$f"`」
 *   ⇒ ★전수로 세니 ★`tests/` 안에 ★`rmSync(변수, {recursive})` 꼴이 ★★40 파일 ★55 호출이었다
 *   ⇒ ★★그런데 ★처방이 ★★«가드를 ★40벌 복사»면 ★★그게 ★★«명부 둘»의 ★40배다
 *     ⇒ ★지디: 「⛔그대로는 안 된다 · ★★파생시켜 ★하나로 · ★일괄 sed 금지」
 *   ⇒ ★★그리고 ★★레포에 ★★이미 ★그 자가 ★있었다 — ★`tests/unit/_tmproot.js`
 *     ★그 자는 ★pid 우산 ＋ ★죽은 실행 회수 ＋ ★디스크 사전게이트 ＋ ★종료훅을 ★다 쥔다
 *     ⇒ ★★★부르는 쪽은 ★★지울 필요가 ★없다. ⇒ ★★«가드를 더하기»보다 ★★«지우는 줄을 없애기»가 ★낫다
 *
 * ★★★단위가 ★둘이다 — ★섞지 ★마라 (2026-10-10 · 지디가 ★제 처방을 ★고쳐 준 자리)
 *   ★★«칸»(PENDING·NOT_TMPROOT·DONE_EAGER)은 ★★«파일» 단위다 ⇒ ★「정확히 ★한 칸」 불변이 ★선다
 *   ★★«자»(아래 ★pairs())는 ★★★«rmSync ★한 줄» 단위다 ⇒ ★한 파일이 ★여러 쌍을 ★가질 수 ★있다
 * ★★★왜 갈라야 하나 — ★`operator-allow-cli.test.mjs` 가 ★★«섞였다»(★자가 ★찍는 ★참값):
 *   ★`rmSync(HOME)` ×2 = ★그 임시루트의 ★즉시치움(㉢) · ★`rmSync(inRepo)`·`rmSync(bad)` = ★그 검사의 ★주제(㉡)
 * ⚰️★★★내가 ★처음 ★이 자리에 ★`history-ipc` 를 ★적었고 ★★★틀렸다 — ★그 파일의 ★rmSync 는 ★★1건(eager)뿐이다.
 *   ★까닭: ★내 ★첫 걷기가 ★★주석을 ★떼지 ★않아 ★★주석 속 낱말(«진짜 영구삭제»)을 ★★rmSync ★대상으로 ★읽었다
 *   ⇒ ★★★「주석은 ★소스 파싱 게이트의 ★입력」 ★그 자리다. ★★그래서 ★`pairs()` 는 ★`stripComments` 를 ★먼저 쓴다
 *   ⇒ ★★그 파일을 ★★«파일 단위»로 ★⊇ 견주면 ★★㉢ 이기도 ㉡ 이기도 해서
 *     ★★「정확히 한 칸」과 ★그 ⊇ 견줌이 ★★서로 ★싸운다 ⇒ ★★★거짓 빨강이 ★난다
 * ⇒ ★★★칸은 ★파일로, ★자는 ★rmSync 줄로. ★★섞인 파일은 ★그 칸의 ★까닭에 ★★양쪽을 ★적는다
 *   (★★그게 ★「수가 갈리면 ★★단위부터」의 ★그 자리다 — ★T5 의 ⒡ 가 ★그것까지 ★잠근다)
 *
 * ★★이 자가 ★재는 것 — ★두 축
 *   ㉠ ★★위반 집합 ⊆ ★★명부 (★새 위반이 ★생기면 ★빨강)
 *   ㉡ ★★명부에 ★★«이미 옮긴» 칸이 ★남아 있으면 ★빨강 (★명부가 ★낡으면 ★다음 위반을 ★가린다)
 *   ⛔등호로 ★수를 ★박지 않는다 — ★∅ 가 ★일치로 ★둔갑한다(★이 레포의 ★census 선례와 ★같은 규율)
 *
 * ★★★그래서 ★★«몇 벌 ★남았나»는 ★★이 자가 ★찍는다 — ⛔사람이 ★세지 ★않는다.
 *   ★명부가 ★0 이 되는 날 ★★이 자는 ★★진짜 금지로 ★선다.
 *
 * ⚠️★`tools/` 는 ★★범위 ★밖이다 — ★그쪽 임시물은 ★★테스트 수명이 ★아니고(★스윕·프로브가 ★제 수명을 쥔다)
 *   ★`_tmproot` 의 ★pid 우산·종료훅 모형이 ★안 맞는다. ⇒ ★★별건이다(★지디 판정 자리).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const RM_RE = () => /\brmSync\s*\(/g;

/* ★★명부 — ★★«아직 ★손으로 ★치우는» 파일. ★이름으로 든다(⛔수를 박지 않는다).
   ★★옮길 때마다 ★여기서 ★뺀다. ★★그 수가 ★이 일의 ★남은 분량이다.
   ⛔까닭 없이 ★이름을 ★늘려 ★빨강을 ★끄지 ★마라 — ★늘릴 땐 ★«왜 공용 자를 못 쓰나»를 적어라. */
/* ★★★명부를 ★★«둘»로 갈랐다 (2026-10-10 · ★이전 ★2/5 뒤 ★실측)
 * ★★까닭: ★처음엔 ★★한 이름(`PENDING`)으로 ★★36벌을 ★묶었다 ⇒ ★★★그 수가 ★«무엇의 수»를 ★안 들었다
 *   ★★실측해 보니 ★★둘이 ★★전혀 다른 일이었다:
 *     ㉠ ★`mkdtempSync` 로 ★★«임시 루트»를 만들고 ★제 손으로 치운다  ⇒ ★★이전 ★대상이다
 *     ㉡ ★★`rmSync` 가 ★★«그 검사의 ★일 자체»다 — ★임시 루트가 ★아니다 ⇒ ★★★이전 대상이 ★아니다
 *        ★예: ★`recovery-collect` · ★`quit-save-window-gone` · ★e2e 셋 (★아래 ㉡ 칸의 ★까닭들)
 *            ★`recovery-collect` 는 ★★«사본이 ★없을 때»를 만들려 ★픽스처를 ★지운다
 *            ★`quit-save-window-gone` 의 ★`reset()` 은 ★시험 사이 ★★상태 파일을 ★씻는다
 *            ★e2e 셋은 ★★크롬 ★프로필 폴더(★`PROFILE`)를 ★치운다 — ★테스트 수명이 ★아니다
 *   ⇒ ★★★㉡ 를 ★«미이전»으로 ★세면 ★★★영원히 ★0 이 ★안 되는 수를 ★쫓는다
 *   ⇒ ★★그리고 ★★㉡ 를 ★`mkTmpRoot` 로 ★바꾸면 ★★★그 검사가 ★재던 것을 ★★부순다
 * ⚠️★㉡ 의 ★일부는 ★★`trackTmp` 로 ★갈 수 ★있을지도 ★모른다 — ★★그건 ★★파일별 판정이고
 *   ★★임자가 ★★내가 ★아니다. ⇒ ★★★조정자에게 ★올렸다. ⛔내가 ★고르지 ★않는다. */

/** ㉠ ★★이전 ★대상 — ★`mkdtempSync` 로 ★임시 루트를 ★만들고 ★제 손으로 ★치우는 자. */
const PENDING = {
  'tests/dom/scratch-folder-columns.dom.spec.js':  '★DOM — ★창 차례(지디 가름) · ★`npm test` 로 ★못 잰다',
  'tests/unit/win-portability.test.mjs':
    '미이전 — ⚠️★`goya-run-1` 을 ★★단언 문자열로 ★든다(:358) ＋ ★`os.homedir()` 경로를 ★잰다(:354~357) '
    + '⇒ ★★자리에 ★의존한다. ★★읽고 ★옮겨야 한다',
};

/** ㉡ ★★이전 ★대상이 ★아니다 — ★`rmSync` 가 ★★«그 검사의 일»이다. ★까닭을 ★이름 옆에.
 *  ⛔여기 올리려면 ★★«그 rmSync 가 ★무엇을 ★지우나»를 ★읽고 ★적어라. ★«미이전»과 ★섞지 ★마라. */
const NOT_TMPROOT = {
  'tests/unit/put-image-path.test.js':
    '★★공용자불가 — ★그 루트가 ★`os.homedir()` ★아래여야 한다. ★이 검사의 ★주제가 ★«홈 ★밖은 ★막힌다»다(:93·:107). '
    + '★`mkTmpRoot` 는 ★tmpdir 아래라 ★★옮기면 ★그 전제가 ★깨진다(★:69 가 ★homedir 길이로 ★자른다). '
    + '★★꼴은 ㉠(mkdtempSync 루트를 ★손으로 치움)이지만 ★★뜻은 ㉡ 이다',
  'tests/unit/_tmproot.js':                   '★공용 자 ★자신 — ★치우기의 ★임자다',
  'tests/unit/tmproot.test.js':               '★그 자의 ★회수를 ★직접 재는 검사',
  'tests/e2e/12-insert-seam-settle.spec.js':  '★크롬 ★프로필 폴더(PROFILE) — ★테스트 수명이 아니다 · ★e2e',
  'tests/e2e/13-undo-family.spec.js':         '★크롬 ★프로필 폴더(PROFILE) · ★e2e',
  'tests/e2e/14-undo-depth.spec.js':          '★크롬 ★프로필 폴더(PROFILE) · ★e2e',
  'tests/unit/destructive-ipc.test.js':       '★`copy` — ★파괴적 IPC 가 ★무엇을 지우나가 ★주제다',
  'tests/unit/grid-gap-clamp.test.js':        '★`srtAlias` — ★별칭 파일을 ★지우는 것이 ★장면이다',
  'tests/unit/mcp-project-crud.test.js':      '★프로젝트 ★삭제 CRUD — ★그게 ★주제다',
  'tests/unit/migrate-files-vanish.test.js':  '★파일이 ★사라지는 장면을 ★만든다 — ★주제다',
  'tests/unit/migrator-vanish.test.js':       '★같은 축 — ★사라짐이 ★주제다',
  'tests/unit/quit-save-window-gone.test.mjs':'★`reset()` — ★시험 사이 ★상태 파일 씻기',
  'tests/unit/recovery-collect.test.mjs':     '★★«사본이 없을 때»를 만들려 ★픽스처를 지운다 — ★주제다',
};

/** ㉢ ★★이미 ★공용 자를 ★쓴다 — ★그 위에 ★★«즉시 치움»을 ★얹었다. ★★그게 ★의도다.
 *  ★★★이 칸이 ★★없어서 ★이 둘이 ★★㉡ 에 ★★«틀린 까닭»으로 ★앉아 있었다(2026-10-10 · 지디가 ★재서 잡았다).
 *    ★내가 적었던 까닭: ★`history-restart` → 「★`ud`(userData) — ★재시작 장면을 만든다」
 *    ★★참값: ★그 `ud` 는 ★★`mkTmpRoot('goya-restart-')` 다 ⇒ ★★★이미 ★공용 자다
 *    ⇒ ★★수는 ★안 틀렸다(★둘 다 ★«안 옮길 것») ★★그러나 ★★«무엇의 수인가»를 ★흐렸다
 *  ★★왜 ★즉시 치우나 — ★★`mkTmpRoot` 는 ★★종료훅에 ★맡긴다. ★그 사이 ★임시물이 ★남는다.
 *    ★한 파일이 ★★여러 벌을 ★연달아 만들면(★`history-restart` 는 ★셋) ★★그 사이에 ★쌓인다
 *    ⇒ ★★그래서 ★★«동기로» 치운다. ★`coupon-presets` 주석이 ★그 까닭을 ★이미 말한다.
 *  ⇒ ★★★즉 ★이 칸은 ★★결함이 ★아니다. ⛔여기 것을 ★`PENDING` 으로 ★옮기지 ★마라. */
const DONE_EAGER = {
  'tests/unit/operator-allow-cli.test.mjs':
    '★★섞였다 — ★HOME = mkTmpRoot(goditor-opallow-) 의 ★즉시치움 ★3 ＋ ★inRepo·bad(그 검사의 주제) ★2. '
    + '★★왜 ★즉시치움인가 = ★★그 폴더에 ★★개인키가 ★산다 ⇒ ★종료훅(★SIGKILL 에서 ★안 돈다)에 ★못 맡긴다. '
    + '★★그 약속을 ★★잠그는 칸 = ★★C-KEYGONE(★그 파일) — ⛔머리말 ★선언으로 ★안 닫았다',
  'tests/unit/history-restart.test.js':
    '★`ud` = mkTmpRoot(goya-restart{,2,3}-) ★셋 — ★rmSync ★3/3 이 ★그 임시루트의 ★즉시 치움이다',
  'tests/unit/history-ipc.test.js':
    '★`outside` = mkTmpRoot(goya-outside-) 의 ★즉시치움 ★1 — ★★그것뿐이다(★자가 ★쟀다). '
    + '⚰️★내가 ★처음 ★«섞였다»로 적었고 ★★틀렸다 — ★주석을 ★안 뗀 ★걷기가 ★주석 낱말을 ★대상으로 ★읽었다',
};

/** ★★«rmSync ★한 줄» 단위의 ★자 — ★{file, line, kind} ★쌍을 ★돌려준다.
 *  ★갈래 셋: ★`eager`(대상이 ★mkTmpRoot 결과) · ★`pending`(대상이 ★mkdtempSync 결과) · ★`subject`(그 밖)
 *  ⛔«파일이 ★mkTmpRoot 를 ★쓴다»만으로 ★판정하지 ★않는다 — ★`recovery-collect` 가 ★그 함정이다
 *    (★`mkTmpRoot` 를 쓰면서 ★`rmSync(em)` 으로 ★픽스처를 지운다 ⇒ ★★`subject`) */
function pairs() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { walk(q); continue; }
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      const src = stripComments(fs.readFileSync(q, 'utf8'));
      if (!RM_RE().test(src)) continue;
      const rel = path.relative(ROOT, q);
      const eagerVars = new Set(), pendVars = new Set();
      for (const m of src.matchAll(/(\w+)\s*=\s*mkTmpRoot\s*\(/g)) eagerVars.add(m[1]);
      for (const m of src.matchAll(/(\w+)\s*=\s*[\w.]*mkdtempSync\s*\(/g)) pendVars.add(m[1]);
      src.split('\n').forEach((ln, i) => {
        for (const m of ln.matchAll(/rmSync\(\s*([^,)]+)/g)) {
          const base = (m[1].trim().match(/^(\w+)/) || [])[1] || '';
          const kind = eagerVars.has(base) ? 'eager' : (pendVars.has(base) ? 'pending' : 'subject');
          out.push({ file: rel, line: i + 1, kind, target: m[1].trim().slice(0, 40) });
        }
      });
    }
  };
  walk(path.join(ROOT, 'tests'));
  return out;
}

/** tests/ 안에서 ★손으로 ★`rmSync` 를 쓰는 파일 — ★주석은 ★뗀다(★주석의 예시가 ★측정값이 되는 것 방지). */
function violations() {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      const n = (stripComments(fs.readFileSync(p, 'utf8')).match(RM_RE()) || []).length;
      if (n) out[path.relative(ROOT, p)] = n;
    }
  };
  walk(path.join(ROOT, 'tests'));
  return out;
}

test('T1 ★자가 살아있다 — ★양성·음성 대조 (⛔이것 없으면 아래 0건이 «안 재고 있다»와 같다)', () => {
  /* ★★★대조 문자열의 ★토큰을 ★★«짜 맞춘다» — ★★이 파일이 ★★제 자에 ★걸리지 ★않게.
     ★★실측(2026-10-10): ★처음엔 ★리터럴로 적었고 ⇒ ★★`T2` 가 ★★★이 파일을 ★위반으로 ★잡았다.
     ⇒ ★★고를 수 있던 ★두 길:
        ⒜ ★이 파일을 ★PENDING 에 ★영구 예외로 올린다
        ⒝ ★★소스에 ★리터럴이 ★없게 ★토큰을 ★짜 맞춘다
     ⇒ ★★★⒝ 를 ★골랐다. ★까닭: ★⒜ 는 ★★이 파일 안의 ★«참 호출»까지 ★★가려 준다(★서는 예외가 ★눈을 먼다)
     ⛔그리고 ★단언의 ★세기는 ★★안 낮췄다 — ★정규식에 ★대는 문자열은 ★★글자까지 ★같다 */
  const TOK = 'rm' + 'Sync(';
  assert.equal((stripComments('fs.' + TOK + 'x, {recursive:true});').match(RM_RE()) || []).length, 1,
    '★양성대조 실패 — ★그 호출 꼴을 ★못 잡는다');
  assert.equal((stripComments('/* fs.' + TOK + 'x) */ const a = 1;').match(RM_RE()) || []).length, 0,
    '★음성대조 실패 — ★★주석 안의 ★예시를 ★위반으로 ★센다');
  assert.equal((stripComments("const norm = 1; transform();").match(RM_RE()) || []).length, 0,
    '★음성대조 실패 — ★`norm`·`transform` 의 ★rm 글자를 ★잡는다');
  const v = violations();
  assert.ok(Object.keys(v).length >= 1,
    '★위반이 ★0 파일이다 — ★★걷는 자가 ★죽었거나 ★이름이 ★바뀌었다(★0 을 ★성공으로 읽지 않는다)');
});

test('T2 ㉠ ★위반은 ★«명부 안»에만 있다 — ★새 위반이 생기면 ★빨강', () => {
  const v = violations();
  const LISTED = { ...PENDING, ...NOT_TMPROOT, ...DONE_EAGER };
  const unlisted = Object.keys(v).filter((f) => !(f in LISTED)).sort();
  assert.deepEqual(unlisted, [],
    `★★명부 ★밖에서 ★손으로 ★임시물을 ★치우는 파일이 ★${unlisted.length}개 있다:\n  ` +
    unlisted.map((f) => `· ${f} (${v[f]}건)`).join('\n  ') +
    `\n  ⇒ ★`.concat("tests/unit/_tmproot.js` 의 ★`mkTmpRoot`/`trackTmp` 를 ★써라 — ★치우기는 ★그 자가 쥔다") +
    '\n  ⇒ ★공용 자를 ★못 쓰는 ★까닭이 있으면 ★이 파일 ★PENDING 에 ★그 까닭과 함께 올려라');
});

test('T3 ㉡ ★명부가 ★낡지 않았다 — ★이미 옮긴 칸이 ★남아 있으면 ★빨강', () => {
  const v = violations();
  const LISTED = { ...PENDING, ...NOT_TMPROOT, ...DONE_EAGER };
  const stale = Object.keys(LISTED).filter((f) => !(f in v)).sort();
  assert.deepEqual(stale, [],
    `★PENDING 에 ★«이제 ★안 치우는» 파일이 ★${stale.length}개 ★남았다 — ★낡은 명부가 ★다음 위반을 ★가린다:\n  ` +
    stale.map((f) => `· ${f}`).join('\n  ') +
    '\n  ⇒ ★옮겼으면 ★PENDING 에서 ★빼라');
});

test('T4 ★★남은 분량을 ★자가 찍는다 — ⛔사람이 세지 않는다', () => {
  const v = violations();
  /* ★★★«남은 수»를 ★★두 갈래로 ★따로 찍는다 — ⛔한 수로 묶으면 ★«무엇의 수»를 ★안 든다 */
  const pend = Object.keys(PENDING).filter((f) => f in v);
  const pendCalls = pend.reduce((a, f) => a + v[f], 0);
  const notTmp = Object.keys(NOT_TMPROOT).filter((f) => f in v);
  const doneE = Object.keys(DONE_EAGER).filter((f) => f in v);
  console.log(`    ★★㉠ 이전 대상 ★남음 = ★파일 ${pend.length} · ★호출 ${pendCalls}`);
  console.log(`    ★★㉡ 이전 대상 ★아님  = ★파일 ${notTmp.length} (★`.concat('rmSync 가 ★그 검사의 ★일이다)'));
  console.log(`    ★★㉢ 이미 ★공용 자 ＋ 즉시치움 = ★파일 ${doneE.length} (★의도다)`);
  /* ★★내 네 파일은 ★★이미 ★옮겼다 — ★그것만은 ★★단언으로 ★못박는다(★되돌아가면 ★빨강) */
  for (const f of ['tests/unit/shape-star-rating.test.mjs', 'tests/unit/shape-star-colors.test.mjs',
                   'tests/unit/shape-star-scales.test.mjs', 'tests/unit/shape-star-frame-width.test.mjs']) {
    assert.ok(!(f in v), `★${f} 가 ★다시 ★손으로 치운다 — ★이미 ★`.concat("mkTmpRoot` 로 옮긴 파일이다"));
    assert.ok(!(f in PENDING), `★${f} 가 ★PENDING 에 ★남아 있다 — ★옮겼으니 ★빼야 한다`);
  }
  /* ★★★두 명부가 ★겹치지 ★않는다 — ⛔겹치면 ★같은 파일이 ★«이전 대상»이면서 ★«아니다»가 된다.
     ★★앞서 여기 ★`left.length >= 0` 이라 ★적었다가 ★지웠다 — ★★그건 ★★항등이라 ★아무것도 ★안 잠갔다. */
  /* ★★★세 칸이 ★서로 ★겹치지 ★않는다 — ⛔겹치면 ★한 파일이 ★두 뜻을 ★갖는다 (지디 ⑶ 의 ★그 불변) */
  const MAPS = { PENDING, NOT_TMPROOT, DONE_EAGER };
  const names = Object.keys(MAPS);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const dup = Object.keys(MAPS[names[i]]).filter((f) => f in MAPS[names[j]]);
      assert.deepEqual(dup, [],
        `★${names[i]} 와 ★${names[j]} 에 ★같이 든 파일: ${dup.join(' ')}`);
    }
  }
  /* ★★그리고 ★모든 위반이 ★★정확히 ★한 칸에 ★든다 */
  for (const f of Object.keys(v)) {
    const hits = names.filter((n) => f in MAPS[n]);
    assert.equal(hits.length, 1,
      `★${f} 가 ★${hits.length} 칸에 든다(${hits.join(',') || '없음'}) — ★정확히 ★하나여야 한다`);
  }
});

test('T5 ★★★자(rmSync 단위)와 ★명부(파일 단위)가 ★맞물린다 — ⛔등호 ★금지 (지디 ⑵ 정정)', () => {
  /* ★★지디가 ★제 처방을 ★★고쳤다: 「★그 ⊇ 견줌을 ★★«rmSync 단위»로 돌려라 —
   *   ★단위 = (파일, rmSync 줄) ★쌍 ⇒ ★한 파일이 ★두 쌍을 ★가질 수 있다」
   * ★★까닭: ★★파일 단위로 ★돌리면 ★★섞인 파일(★history-ipc)에서 ★★거짓 빨강이 ★난다
   * ⛔등호로 ★수를 ★박지 ★않는다 — ★★«⊇ ＋ ★밖 0건» 꼴이다 */
  const P = pairs();
  /* ⒜ ★★자가 ★살아있나 — ★세 갈래가 ★다 ★한 번은 ★나와야 한다(⛔하나라도 0 이면 ★못 가른다) */
  const kinds = new Set(P.map((x) => x.kind));
  for (const k of ['eager', 'pending', 'subject']) {
    assert.ok(kinds.has(k), `★갈래 «${k}» 가 ★0건 — ★자가 ★그 축을 ★못 가른다(★전체 ${P.length} 쌍)`);
  }
  /* ⒝ ★`eager` 쌍을 ★가진 파일 ⊆ ★`DONE_EAGER` */
  const eagerFiles = [...new Set(P.filter((x) => x.kind === 'eager').map((x) => x.file))].sort();
  const eagerOutside = eagerFiles.filter((f) => !(f in DONE_EAGER));
  assert.deepEqual(eagerOutside, [],
    `★임시루트를 ★즉시 치우는데 ★㉢ 명부 ★밖이다:\n  ` + eagerOutside.join('\n  '));
  /* ⒞ ★`DONE_EAGER` 에 ★`eager` 쌍이 ★없는 파일이 ★남으면 ★명부가 ★낡았다 */
  const eagerStale = Object.keys(DONE_EAGER).filter((f) => !eagerFiles.includes(f));
  assert.deepEqual(eagerStale, [], `★㉢ 명부가 ★낡았다: ${eagerStale.join(' ')}`);
  /* ⒟ ★`pending` 쌍을 ★가진 파일 ⊆ ★(`PENDING` ∪ `NOT_TMPROOT`)
     ★★★이 칸이 ★처음엔 ★`⊆ PENDING` 이었고 ★★`put-image-path` 에서 ★★빨개졌다 — ★★그게 ★맞는 빨강이었다:
       ★그 파일은 ★`mkdtempSync` 루트를 ★손으로 치운다(★꼴은 ★㉠) ★★그러나 ★★★옮기면 ★안 된다
         ⇒ ★그 루트가 ★★`os.homedir()` ★아래여야 ★한다(★이 검사의 ★주제가 ★«홈 밖은 막힌다»다)
       ⇒ ★★즉 ★★«꼴은 ㉠ · ★뜻은 ㉡» 인 ★자리가 ★★실재한다
     ⇒ ★★그래서 ★★㉡ 도 ★받는다. ⛔단 ★★«왜 공용 자를 ★못 쓰나»를 ★★그 칸에 ★적어야 한다
       ★★규약: ★그 까닭에 ★★`공용자불가` 를 ★한 번 ★적는다 — ★★그러면 ★grep 으로 ★찾을 수 있고
         ★★새 사례가 ★그 표시 ★없이 ★들어오면 ★★이 칸이 ★빨개져 ★사람이 ★정하게 된다 */
  const pendFiles = [...new Set(P.filter((x) => x.kind === 'pending').map((x) => x.file))].sort();
  const pendOutside = pendFiles.filter((f) => !(f in PENDING) && !(f in NOT_TMPROOT));
  assert.deepEqual(pendOutside, [],
    `★mkdtempSync 루트를 ★손으로 치우는데 ★두 명부 ★밖이다:\n  ` + pendOutside.join('\n  '));
  /* ⒟-b ★★㉡ 에 ★앉은 ★`pending` 파일은 ★★«공용자불가» 까닭을 ★들어야 한다 */
  for (const f of pendFiles.filter((x) => x in NOT_TMPROOT)) {
    assert.match(NOT_TMPROOT[f], /공용자불가/,
      `★${f} 는 ★꼴이 ★㉠(mkdtempSync 루트를 손으로 치움)인데 ★㉡ 에 있다 — `
      + `★★«왜 공용 자를 ★못 쓰나»를 ★그 칸에 ★`.concat('«공용자불가» 와 함께 적어라'));
  }
  /* ⒠ ★★섞인 파일 수를 ★찍는다 — ⛔단언이 아니라 ★보고다(★있어도 ★정상이다) */
  const byFile = {};
  for (const x of P) (byFile[x.file] = byFile[x.file] || new Set()).add(x.kind);
  const mixed = Object.keys(byFile).filter((f) => byFile[f].size > 1).sort();
  console.log(`    ★★쌍 ${P.length} — eager ${P.filter((x) => x.kind === 'eager').length}`
    + ` · pending ${P.filter((x) => x.kind === 'pending').length}`
    + ` · subject ${P.filter((x) => x.kind === 'subject').length}`);
  console.log(`    ★★섞인 파일 ${mixed.length}: ${mixed.map((f) => f.split('/').pop()).join(' ') || '없음'}`);
  /* ⒡ ★★섞인 파일은 ★그 칸의 ★까닭에 ★★양쪽이 ★적혀 있어야 한다 — ⛔반쪽 진실 금지 */
  const ALL = { ...PENDING, ...NOT_TMPROOT, ...DONE_EAGER };
  for (const f of mixed) {
    assert.match(ALL[f] || '', /섞였다/,
      `★${f} 는 ★섞였는데 ★칸의 ★까닭이 ★«섞였다»를 ★안 말한다 — ★반쪽 진실이 된다`);
  }
});
