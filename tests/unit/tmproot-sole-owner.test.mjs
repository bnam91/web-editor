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
const PENDING = {
  'tests/unit/_tmproot.js':                        '★공용 자 ★자신 — ★치우기의 ★임자다(★영구 예외)',
  'tests/dom/scratch-folder-columns.dom.spec.js':  'DOM spec — 임자 다름',
  'tests/e2e/12-insert-seam-settle.spec.js':       'e2e — 임자 다름',
  'tests/e2e/13-undo-family.spec.js':              'e2e — 임자 다름',
  'tests/e2e/14-undo-depth.spec.js':               'e2e — 임자 다름',
  'tests/unit/account-projects-root.test.js':      '미이전',
  'tests/unit/destructive-ipc.test.js':            '미이전',
  'tests/unit/grid-gap-clamp.test.js':             '미이전',
  'tests/unit/grid-line-add.test.mjs':             '미이전',
  'tests/unit/history-ipc.test.js':                '미이전',
  'tests/unit/history-restart.test.js':            '미이전',
  'tests/unit/mcp-auth-gate.test.js':              '미이전',
  'tests/unit/mcp-project-crud.test.js':           '미이전',
  'tests/unit/migrate-files-vanish.test.js':       '미이전',
  'tests/unit/migrator-vanish.test.js':            '미이전',
  'tests/unit/name-axes-to-markup.test.mjs':       '미이전',
  'tests/unit/operator-allow-cli.test.mjs':        '미이전',
  'tests/unit/put-image-path.test.js':             '미이전',
  'tests/unit/quit-save-window-gone.test.mjs':     '미이전',
  'tests/unit/recovery-collect.test.mjs':          '미이전',
  'tests/unit/renderer-js-parses.test.mjs':        '미이전',
  'tests/unit/save-dirty-after-failure.test.mjs':  '미이전',
  'tests/unit/tmproot.test.js':                    '★공용 자를 ★재는 검사 — ★그 자의 ★회수를 ★직접 잰다(★영구 예외)',
  'tests/unit/win-portability.test.mjs':           '미이전',
};

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
  const unlisted = Object.keys(v).filter((f) => !(f in PENDING)).sort();
  assert.deepEqual(unlisted, [],
    `★★명부 ★밖에서 ★손으로 ★임시물을 ★치우는 파일이 ★${unlisted.length}개 있다:\n  ` +
    unlisted.map((f) => `· ${f} (${v[f]}건)`).join('\n  ') +
    `\n  ⇒ ★`.concat("tests/unit/_tmproot.js` 의 ★`mkTmpRoot`/`trackTmp` 를 ★써라 — ★치우기는 ★그 자가 쥔다") +
    '\n  ⇒ ★공용 자를 ★못 쓰는 ★까닭이 있으면 ★이 파일 ★PENDING 에 ★그 까닭과 함께 올려라');
});

test('T3 ㉡ ★명부가 ★낡지 않았다 — ★이미 옮긴 칸이 ★남아 있으면 ★빨강', () => {
  const v = violations();
  const stale = Object.keys(PENDING).filter((f) => !(f in v)).sort();
  assert.deepEqual(stale, [],
    `★PENDING 에 ★«이제 ★안 치우는» 파일이 ★${stale.length}개 ★남았다 — ★낡은 명부가 ★다음 위반을 ★가린다:\n  ` +
    stale.map((f) => `· ${f}`).join('\n  ') +
    '\n  ⇒ ★옮겼으면 ★PENDING 에서 ★빼라');
});

test('T4 ★★남은 분량을 ★자가 찍는다 — ⛔사람이 세지 않는다', () => {
  const v = violations();
  const PERMANENT = ['tests/unit/_tmproot.js', 'tests/unit/tmproot.test.js'];
  const left = Object.keys(v).filter((f) => !PERMANENT.includes(f));
  const calls = left.reduce((a, f) => a + v[f], 0);
  /* ★이 줄은 ★«실패»가 아니라 ★★«보고»다 — ★남은 수를 ★로그에 ★박는다 */
  console.log(`    ★★남은 미이전 = ★파일 ${left.length} · ★호출 ${calls}  (★영구 예외 ${PERMANENT.length}개 제외)`);
  /* ★★내 네 파일은 ★★이미 ★옮겼다 — ★그것만은 ★★단언으로 ★못박는다(★되돌아가면 ★빨강) */
  for (const f of ['tests/unit/shape-star-rating.test.mjs', 'tests/unit/shape-star-colors.test.mjs',
                   'tests/unit/shape-star-scales.test.mjs', 'tests/unit/shape-star-frame-width.test.mjs']) {
    assert.ok(!(f in v), `★${f} 가 ★다시 ★손으로 치운다 — ★이미 ★`.concat("mkTmpRoot` 로 옮긴 파일이다"));
    assert.ok(!(f in PENDING), `★${f} 가 ★PENDING 에 ★남아 있다 — ★옮겼으니 ★빼야 한다`);
  }
  assert.ok(left.length >= 0, '산술 불변');
});
