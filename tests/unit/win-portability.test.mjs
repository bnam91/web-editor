/* U-WP — ★검사 자체의 «윈도우 이식성»을 «맥에서» 지킨다.
 *
 * ★이 파일이 생긴 이유 (미니4호기 윈도우 실기, b9edc92)
 *   맥  90파일 1215 tests / 1215 pass / 0 fail
 *   윈도우 90파일 1108 tests / 1056 pass / 52 fail   ← 제품 결함 0건. 전부 «검사 쪽» 이식성.
 *   ★★그리고 더 나쁜 것: 10개 파일이 «한 줄도 안 돌았다». 「검사가 통과했다」와
 *     「윈도우에서 검사가 돌았다」는 다른 문장이다. 여기가 그 둘을 가르는 자리다.
 *
 * ★설계 규약
 *   ⑴ 윈도우 없이 도는 형태로 잰다 — 그래야 맥 게이트가 윈도우 퇴행을 «미리» 잡는다.
 *   ⑵ 「없다」를 쓸 땐 «어디를 셌는지»를 같이 적는다 → 스캔 대상 파일 수를 단언에 싣는다.
 *   ⑶ 양성대조를 같이 둔다 — 「틀린 고침」이 정말 틀렸는지 이 자리에서 실행해 보인다.
 *
 * ★변이(고친 자리를 되돌리면 빨강인가)
 *   ㉮ 아무 검사에서 `readSrc(...)` 를 `fs.readFileSync(...,'utf8')` 로 되돌린다 → ①-3 빨강
 *   ㉯ `await import(pathToFileURL(p).href)` 를 `await import(p)` 로 되돌린다      → ②-4 빨강
 *   ㉰ `fileURLToPath(import.meta.url)` 를 `new URL(import.meta.url).pathname` 로  → ②-5 빨강
 *   ㉱ `toPosix(path.relative(...))` 에서 toPosix 를 벗긴다                        → ④-1 빨강
 *   ㉲ `_tmproot.freeBytes` 에서 statfsSync 분기를 지운다                          → ③-1 빨강(윈도우에서만)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const { normalizeEol, readSrc, toPosix } = require_('./_srcread.js');
const { sliceTopLevel, sliceConstLine, normalizeEol: normEolLib } =
  await import(pathToFileURL(path.join(ROOT, 'tools/hardening/lib/loadcheck.mjs')).href);

/* ── 스캔 범위: 검사·하네스 소스 전부 (⑵ 「어디를 셌는지」) ────────────────── */
function walk(dir, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(mjs|cjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
/* ⛔계측기가 «자기 자신»을 대상으로 착각하지 않게 — 이 파일은 규약을 «문자열로» 들고 있다. */
const SELF = fileURLToPath(import.meta.url);
const SCANNED = [...walk(path.join(ROOT, 'tests')), ...walk(path.join(ROOT, 'tools'))]
  .filter(f => f !== SELF);
const rel = p => toPosix(path.relative(ROOT, p));
/** 주석은 벗긴다 — 규약 문장이 자기 «설명»에 걸리면 안 된다. */
const codeOnly = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ═══ ① CRLF ═══════════════════════════════════════════════════════════════ */

test('①-1 [양성대조] CRLF 소스에서는 옛 자르기(indexOf("\\n}\\n"))가 «정말» 못 찾는다', () => {
  const lf = 'function f(a) {\n  return a;\n}\n';
  assert.ok(lf.indexOf('\n}\n') > 0, '전제 미달 — LF 에서는 찾아야 한다');
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.equal(crlf.indexOf('\n}\n'), -1,
    '★이 단언이 깨지면 CRLF 재현 자체가 안 되는 것이다 — 이 파일의 전제가 무너진다');
});

test('①-2 loadcheck 의 자르기가 CRLF 를 먹어도 «LF 와 같은 값»을 낸다', () => {
  const lf = "const X = 1;\nfunction f(a) {\n  return a;\n}\n";
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.equal(sliceTopLevel(crlf, 'function f(a) {'), sliceTopLevel(lf, 'function f(a) {'));
  assert.equal(sliceConstLine(crlf, 'X'), sliceConstLine(lf, 'X'));
  assert.equal(normEolLib(crlf), lf);
  assert.equal(normalizeEol(crlf), lf, '_srcread 와 loadcheck 이 «다른 답»을 내면 안 된다');
});

test('①-3 ★소스를 «문자열로 자르는» 검사는 전부 readSrc/openSource 를 탄다', () => {
  /* ★규칙은 «변수 단위»다 — 「이 파일 어딘가에 정규화가 있다」로는 못 잡는다
     (실제로 그렇게 짰다가 변이 ㉮ 가 살아남았다: 같은 파일의 «다른» 읽기가 면죄부가 됐다).
     ⇒ 날 것으로 읽은 «그 변수»가 잘리는지를 본다. rename 한 홉(`const c = s.replace(…)`)까지 따라간다. */
  const RAW_DECL = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?fs\.readFileSync\([^;]*?['"]utf8['"]\s*\)/g;
  const RENAME = (src) => new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${src}\\s*\\.(?:replace|toString|normalize)\\(`, 'g');
  const slicedBy = (code, name) =>
    new RegExp(`\\b${name}\\s*\\.indexOf\\(\\s*['"]\\\\n\\}`).test(code)
    || new RegExp(`sliceTopLevel\\(\\s*${name}\\b`).test(code)
    || new RegExp(`sliceConstLine\\(\\s*${name}\\b`).test(code);
  const bad = [];
  for (const f of SCANNED) {
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    for (const m of code.matchAll(RAW_DECL)) {
      const names = [m[1]];
      for (const r of code.matchAll(RENAME(m[1]))) names.push(r[1]);   // 한 홉
      if (names.some(n => slicedBy(code, n))) bad.push(`${rel(f)}:${m[1]}`);
    }
  }
  assert.deepEqual(bad, [],
    `★CRLF 체크아웃에서 «자르기가 던져» 파일이 통째로 안 도는 자리 (${SCANNED.length}개 파일을 셌다)`);
});

/* ═══ ② 절대경로 → URL/모듈 ════════════════════════════════════════════════ */

test('②-1 [양성대조] 윈도우 절대경로를 그대로 import() 하면 «거절당한다»', async () => {
  await assert.rejects(
    () => import('C:\\repo\\tools\\hardening\\judge\\crashlog.mjs'),
    (e) => {
      const s = `${e.code} ${e.message}`;
      assert.match(s, /ERR_UNSUPPORTED_ESM_URL_SCHEME|Only file and data URLs/,
        `기대한 거절이 아니다: ${s}`);
      return true;
    },
    '★맥에서도 재현된다 — 윈도우에서 10개 파일을 죽인 그 오류다');
});

test('②-2 [양성대조] «틀린 고침» 두 개는 정말 틀렸다 (실측된 오답)', async () => {
  for (const wrong of ['/C:/repo/tools/x.mjs', '\\C:\\repo\\tools\\x.mjs']) {
    await assert.rejects(() => import(wrong), (e) => {
      assert.notEqual(e.code, undefined, `${wrong} 가 그냥 로드됐다 — 오답이 통과하면 안 된다`);
      return true;
    }, `${wrong} 는 «되면 안 되는» 모양이다`);
  }
});

test('②-3 pathToFileURL ⇄ fileURLToPath 왕복이 이 플랫폼의 실제 경로를 보존한다', () => {
  const p = path.join(ROOT, 'tools', 'hardening', 'lib', 'loadcheck.mjs');
  const u = pathToFileURL(p).href;
  assert.match(u, /^file:\/\//, `file:// 가 아니다: ${u}`);
  assert.equal(fileURLToPath(u), p);
  /* ★그리고 «틀린 고침»(new URL(u).pathname)은 왕복이 깨질 수 있다 —
     POSIX 에선 같지만 윈도우에선 '/C:/…' 가 되어 require 가 못 찾는다. 그 모양을 이름 붙여 둔다. */
  assert.equal(new URL(u).pathname.startsWith('/'), true);
});

test('②-4 ★import() 에 «file:// URL 이 아닌 것»을 주는 자리가 0건이다', () => {
  /* ★변이 ㉯ 가 살아남아서 고친 자리: 헬퍼(`const modUrl = …`)로 감싸면 호출 자리에서
     pathToFileURL 이 «안 보인다». ⇒ 규칙은 「호출 자리에 보이게 두라」로 바꿨다.
     ⛔검사 대상은 «Node 쪽» 파일만 — tests/measure/* 는 브라우저에서 도는 `import('/js/…')` 다. */
  const argOf = (code, at) => {                       // 괄호 균형으로 인자 원문을 뜬다
    let d = 0, i = at;
    for (; i < code.length; i++) {
      if (code[i] === '(') d++;
      else if (code[i] === ')') { d--; if (d === 0) return code.slice(at + 1, i); }
    }
    return code.slice(at);
  };
  const LITERAL_OK = /^\s*['"`][^'"`]*['"`]\s*$/;    // 'node:fs' · './x.js' 같은 정적 지정자
  const bad = [];
  for (const f of SCANNED) {
    if (!/(^|\/)(tests\/unit|tools)\//.test(rel(f)) || /\/measure\//.test(rel(f))) continue;
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    for (const m of code.matchAll(/(?<![.\w$])import\s*\(/g)) {
      const arg = argOf(code, m.index + m[0].length - 1);
      if (LITERAL_OK.test(arg)) continue;                       // 정적 지정자는 문제없다
      if (/pathToFileURL\(|import\.meta\.resolve\(/.test(arg)) continue;   // ★file:// 로 바꿨다
      /* 인자가 이름이거나 헬퍼 호출이면 «만든 자리»를 한 홉 따라간다:
           const entUrl = pathToFileURL(...).href;   → import(entUrl)   ✔
           function stubCopy(){ … pathToFileURL(…) } → import(cvbUrl)   ✔ (cvbUrl = stubCopy(…))
           const modUrl = (...s) => path.join(...s); → import(modUrl(…)) ✖ (변이 ㉯ 가 이 모양)
         ⚠️추적 창은 «그 선언의 몸통»까지다 — 처음엔 «뒤 1500자»로 잡았다가
           `const modUrl = (...s) => path.join(...s);` 가 «다음 줄의» pathToFileURL 을 훔쳐 통과했다. */
      const id = arg.trim();
      const producers = [];
      const asName = id.match(/^([A-Za-z_$][\w$]*)$/);
      const asCall = id.match(/^([A-Za-z_$][\w$]*)\s*\(/);
      if (asName) {
        producers.push(asName[1]);
        const from = code.match(new RegExp(`(?:const|let|var)\\s+${asName[1]}\\s*=\\s*(?:await\\s+)?([A-Za-z_$][\\w$]*)\\s*\\(`));
        if (from) producers.push(from[1]);
      } else if (asCall) producers.push(asCall[1]);

      const makesFileUrl = (name) => {
        for (const d of code.matchAll(new RegExp(`(?:function\\s+${name}\\b|(?:const|let|var)\\s+${name}\\s*=)`, 'g'))) {
          const start = d.index;
          /* 선언 «머리»가 `{` 로 끝나면 몸통형 → 0열 `}` 까지, 아니면 한 줄형 → `;` 까지.
             (머리로 안 가르고 `;`/`}` 중 «먼저 오는 것»을 쓰면 함수 몸통이 첫 문장에서 잘린다.) */
          const head = code.slice(start, code.indexOf('\n', start) + 1 || undefined).trimEnd();
          const term = head.endsWith('{') ? '\n}' : ';\n';
          const at = code.indexOf(term, start);
          const end = at >= 0 ? at + term.length : start + 1500;
          if (/pathToFileURL\(|import\.meta\.resolve\(/.test(code.slice(start, Math.min(end, start + 4000)))) return true;
        }
        return false;
      };
      if (producers.some(makesFileUrl)) continue;
      bad.push(`${rel(f)}: import(${id.slice(0, 60)})`);
    }
  }
  assert.deepEqual(bad, [],
    `★윈도우에서 ERR_UNSUPPORTED_ESM_URL_SCHEME 로 «파일이 통째로» 죽는 자리 (${SCANNED.length}개 파일을 셌다)`);
});

test('②-5 ★new URL(import.meta.url).pathname 으로 파일경로를 만드는 자리가 0건이다', () => {
  const RE = /import\.meta\.url\s*\)\s*\.pathname|import\.meta\.url\s*\)\s*\)\s*\.pathname/;
  const bad = [];
  for (const f of SCANNED) {
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    if (RE.test(code)) bad.push(rel(f));
  }
  assert.deepEqual(bad, [],
    `★윈도우에서 '/C:/…' 를 만들어 require 가 못 찾는 자리 — fileURLToPath 를 써라 (${SCANNED.length}개 파일을 셌다)`);
});

/* ═══ ③ POSIX 전용 (쓰기 거부 · 디스크 여유) ═══════════════════════════════ */

test('③-1 freeBytes 는 «양쪽 플랫폼에서 도는 자»를 쓴다 — 그리고 못 재면 null 이다', () => {
  const T = require_('./_tmproot.js');
  const free = T.freeBytes();
  assert.ok(typeof free === 'number' && free > 0,
    '★여유를 못 쟀다 — T4 의 양성대조가 성립 안 한다(윈도우에 df 가 없던 그 자리)');
  assert.equal(T.freeBytes(path.join(os.tmpdir(), 'goya-nonexistent-for-wp')), null,
    '없는 경로를 «여유 있다»로 읽었다');
  /* ★★「statfsSync 라는 글자가 있나」로 재지 않는다 — `if (false)` 한 줄에 살아남는다(변이 ㉲).
     ⇒ 윈도우의 실제 조건(«df 가 없다»)을 PATH 를 비운 자식 프로세스로 «진짜로» 만든다. */
  const r = require_('child_process').spawnSync(process.execPath, ['-e',
    `process.stdout.write(String(require(${JSON.stringify(path.join(__dirname, '_tmproot.js'))}).freeBytes()))`,
  ], { encoding: 'utf8', env: { ...process.env, PATH: '' }, timeout: 15000 });
  assert.equal(r.status, 0, `자식이 실패했다: ${r.stderr}`);
  assert.ok(Number(r.stdout) > 0,
    `★df 가 없으면 «못 잰다»로 떨어진다(윈도우가 바로 그 상황) — 받은 값: ${JSON.stringify(r.stdout)}`);
});

test('③-2 쓰기 거부는 플랫폼별 «동등한 동작»이고, ★읽기는 «살아남는다»', () => {
  const D = require_('../../tools/hardening/lib/denywrite.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-wp-deny-'));
  try {
    fs.writeFileSync(path.join(dir, 'pre.txt'), 'hello');       // ★미리 있던 파일 = 읽기 확인용
    assert.equal(D.probeAccess(dir).write, true, '전제 미달 — 막기 전부터 못 쓴다');
    const h = D.denyWrite(dir);
    try {
      if (process.platform === 'win32') {
        assert.match(h.how, new RegExp(`^icacls /deny .+:\\(${D.WIN_DENY_RIGHTS.replace(/,/g, ',')}\\)$`), h.how);
      } else {
        assert.equal(h.how, 'chmod 0500');
      }
      assert.equal(h.after.write, false, '★막았다는데 «여전히 써진다» — 가짜 초록이다');
      assert.equal(h.after.list, true, '★나열까지 죽었다 — 가짜 빨강이다(재려던 건 「못 쓰는」 상황이다)');
      assert.equal(h.after.read, true, '★읽기까지 죽었다 — 가짜 빨강이다');
      assert.equal(fs.readFileSync(path.join(dir, 'pre.txt'), 'utf8'), 'hello', '막힌 폴더의 파일을 못 읽는다');
      assert.deepEqual(h.denied, [dir], '막은 경로를 «선언»하지 않으면 「못 쟀다」가 「없다」가 된다');
      assert.ok(/EACCES|EPERM/.test(h.errCode), `거부 코드가 없다: ${h.errCode}`);
    } finally { h.restore(); }
    assert.equal(D.probeAccess(dir).write, true, '되돌리지 못했다 — 뒷 검사를 오염시킨다');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Ⓑ-1 ★판정 자가 «가짜 초록»과 «가짜 빨강»을 «둘 다» 잡는다 (윈도우 없이 잰다)', () => {
  const { denialShapeProblem } = require_('../../tools/hardening/lib/denywrite.cjs');
  const before = { list: true, read: true, write: true, listCode: null, readCode: null, writeCode: null };
  const ok = { list: true, read: true, write: false, listCode: null, readCode: null, writeCode: 'EACCES' };
  assert.equal(denialShapeProblem(before, ok, 'chmod 0500'), null, '정상 모양을 문제로 본다');

  /* ⑴ 가짜 초록 — 안 막혔다 */
  assert.match(String(denialShapeProblem(before, { ...ok, write: true }, 'x')), /가짜 초록/);
  /* ⑵ 가짜 빨강 — 나열이 죽었다 (icacls `(W)` 가 실제로 만든 상황) */
  assert.match(String(denialShapeProblem(before, { ...ok, list: false, listCode: 'EPERM' }, 'icacls /deny u:(W)')),
    /가짜 빨강/);
  /* ⑶ 가짜 빨강 — 읽기가 죽었다 */
  assert.match(String(denialShapeProblem(before, { ...ok, read: false, readCode: 'EPERM' }, 'icacls /deny u:(W)')),
    /가짜 빨강/);
});

test('Ⓑ-2 ★윈도우 deny 권한 집합에 `(W)`·`(OI)(CI)` 를 다시 들이지 않는다', () => {
  const D = require_('../../tools/hardening/lib/denywrite.cjs');
  /* `(W)` = FILE_GENERIC_WRITE 는 READ_CONTROL·SYNCHRONIZE 를 포함해 «여는 것 자체»를 막는다.
     `(OI)(CI)` 는 이미 있는 자식 파일까지 건드려 POSIX chmod 0500 과 어긋난다. */
  assert.equal(/(^|,)W(,|$)/.test(D.WIN_DENY_RIGHTS), false,
    `★generic (W) 가 돌아왔다 — 읽기가 다시 죽는다: ${D.WIN_DENY_RIGHTS}`);
  for (const r of ['WD', 'AD']) {
    assert.ok(D.WIN_DENY_RIGHTS.split(',').includes(r), `쓰기 거부의 핵심 권한 ${r} 이 빠졌다`);
  }
  const src = readSrc(ROOT, 'tools/hardening/lib/denywrite.cjs');
  assert.equal(/\(OI\)\(CI\)/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), false,
    '★상속 플래그가 돌아왔다 — POSIX chmod 0500 과 다른 상황을 재게 된다');
  assert.equal(D.POSIX_DENY_MODE, 0o500);
});

test('③-3 ★윈도우에서 «건너뛰는» 쓰기-거부 검사가 0건이다 (skip 은 초록이 아니다)', () => {
  const RE = /skip\s*:[^\n]*win32|process\.platform\s*===\s*'win32'\s*\?[^\n]*skip/;
  const bad = [];
  for (const f of SCANNED) {
    if (!/\.test\.(mjs|js)$/.test(f)) continue;
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    if (RE.test(code)) bad.push(rel(f));
  }
  assert.deepEqual(bad, [],
    `★윈도우에서 건너뛰면 그 검사는 거기서 «영영 안 돈다» — 오늘 우리가 skipped 를 초록으로 읽어 게이트를 놓쳤다 (${SCANNED.length}개 파일을 셌다)`);
});

/* ═══ Ⓐ 경로를 «'/' 로» 다루는 자리 (윈도우 실기 31a7723 이 잡은 뿌리 A) ═════════
   ★④갈래가 `autosave-suppress` «하나»만 고치고 여기를 빼먹었다. 하나 고치고 나머지를
     놓치는 게 이 갈래의 함정이다 — 그래서 규칙을 «전수»로 박는다. */

test('Ⓐ-1 [양성대조] 옛 식은 윈도우 임시경로에서 «언제나» 던졌다 (판정기가 하나도 못 돌았다)', () => {
  const W = 'C:\\Users\\darli\\AppData\\Local\\Temp\\goya-run-1\\h4-x';
  assert.equal(W.split('/').length, 1, '전제 미달 — 윈도우 경로엔 `/` 가 하나도 없다');
  assert.equal(W.split('/').length < 4, true,
    '★옛 `real.split("/").length < 4` 는 «모든» 윈도우 경로를 「위험한 경로」로 던졌다 (실측 14건)');
});

test('Ⓐ-2 새 깊이 판정은 윈도우 경로를 «통과»시킨다 (맥에서 path.win32 로 잰다)', async () => {
  const { pathDepth, isRootPath } = await import(pathToFileURL(path.join(ROOT, 'tools/hardening/lib/fixture.mjs')).href);
  const W = 'C:\\Users\\darli\\AppData\\Local\\Temp\\goya-run-1\\h4-x';
  assert.equal(pathDepth(W, path.win32), 7, '윈도우 경로의 깊이를 못 센다');
  assert.equal(isRootPath('C:\\', path.win32), true, '볼륨 루트를 못 알아본다');
  assert.equal(isRootPath('C:\\Temp', path.win32), false);
  assert.equal(pathDepth('C:\\Temp', path.win32) < 3, true, '★얕은 윈도우 경로는 «여전히» 막아야 한다');
});

test('Ⓐ-3 ★POSIX 판정은 «한 글자도» 안 바뀌었다 (옛 식과 표본 전수 동치)', async () => {
  const { pathDepth, isRootPath } = await import(pathToFileURL(path.join(ROOT, 'tools/hardening/lib/fixture.mjs')).href);
  const samples = ['/', '/a', '/a/b', '/a/b/c', '/x/y/z/w', '/tmp/goya-run-1/h4', '/Users/a1/x/y'];
  for (const p of samples) {
    const old = !(p === '/' || p.split('/').length < 4);
    const neu = !(isRootPath(p, path.posix) || pathDepth(p, path.posix) < 3);
    assert.equal(neu, old, `POSIX 판정이 갈렸다: ${p} (옛=${old} 새=${neu})`);
  }
});

test('Ⓐ-4 ★«파일 경로»를 `/` 로 쪼개거나 붙이는 자리가 0건이다 (URL 은 제외)', () => {
  /* 대상 = 이름이 «경로»라고 말하는 것들. URL(`u`·`m[0]`·`location.pathname`)은 `/` 가 맞다. */
  const PATHY = /(?:^|[.\])(?:[A-Za-z_$][\w$]*)?(?:[Pp]ath|[Dd]ir|[Rr]oot|[Hh]ome|real|cwd|tmpdir\(\)|homedir\(\))[\w$]*$/;
  /* ⛔`pathname` 은 URL API 라 «항상» `/` 가 맞다 — 이름이 닮았을 뿐이니 뺀다. */
  const URLISH = /pathname$|^location\./;
  const OPS = /\.(?:split|join|startsWith|endsWith)\(\s*['"]\/['"]\s*\)/g;
  const bad = [];
  for (const f of SCANNED) {
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    for (const m of code.matchAll(OPS)) {
      /* 연산 «앞»의 수신자 표현식을 뜬다 */
      const before = code.slice(Math.max(0, m.index - 80), m.index);
      const recv = (before.match(/([A-Za-z_$][\w$.()]*)$/) || [''])[0];
      if (PATHY.test(recv) && !URLISH.test(recv)) bad.push(`${rel(f)}: ${recv}${m[0]}`);
    }
  }
  assert.deepEqual(bad, [],
    `★윈도우에서 «안 쪼개지거나 섞인 구분자»가 되는 자리 (${SCANNED.length}개 파일을 셌다)`);
});

/* ═══ ④ 경로 구분자 ════════════════════════════════════════════════════════ */

test('④-1 [양성대조] 소스 스캔 키는 posix 로 정규화된다 — 윈도우 `js\\a.js` 도 `js/a.js`', () => {
  assert.equal(toPosix('js/io/save-load.js'), 'js/io/save-load.js');
  assert.equal(toPosix(['js', 'io', 'save-load.js'].join(path.sep)), 'js/io/save-load.js');
  /* ★그리고 실제 스캐너가 그 규약을 지킨다 — autosave-suppress 의 허용목록 키는 전부 `js/…` 다. */
  const src = readSrc(__dirname, 'autosave-suppress.test.js');
  assert.match(src, /toPosix\(path\.relative\(/,
    '★스캔 키가 다시 «날 것»이 됐다 — 윈도우에서 허용목록이 통째로 안 맞는다');
});

test('④-2 ★검사 키로 쓰는 path.relative 가 posix 정규화 없이 남은 자리가 0건이다', () => {
  const bad = [];
  for (const f of SCANNED) {
    if (!/\.test\.(mjs|js)$/.test(f)) continue;
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    for (const m of code.matchAll(/(\w+)\.push\(\s*path\.relative\(/g)) bad.push(`${rel(f)}:${m[1]}`);
  }
  assert.deepEqual(bad, [],
    `★path.relative 결과를 키로 모으면 윈도우에서 \`js\\a.js\` 가 된다 — toPosix 를 씌워라 (${SCANNED.length}개 파일을 셌다)`);
});
