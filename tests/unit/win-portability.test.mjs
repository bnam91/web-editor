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
  /* 자르기 신호 = `x.indexOf('\n}` (0열 `}` 로 최상위 선언을 끊는 관용구) · sliceTopLevel.
     ⚠️규칙은 «파일 단위»다 — 정규화를 «전혀 안 쓰면서» 자르는 파일만 잡는다.
       (한 파일 안에서 정규화된 읽기와 날 읽기를 섞으면 못 잡는다. 알고 이렇게 둔다:
        정밀도를 올리려면 taint 추적이 필요한데, 그건 이 게이트가 감당할 일이 아니다.) */
  const SLICE_RE = /indexOf\(\s*['"]\\n\}|sliceTopLevel\(/;
  const RAW_READ_RE = /readFileSync\([^)]*,\s*['"]utf8['"]\s*\)/;
  const NORMALIZED_RE = /readSrc\(|readSourceLF\(|normalizeEol\(|openSource\(/;
  const bad = [];
  for (const f of SCANNED) {
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    if (!SLICE_RE.test(code)) continue;
    if (NORMALIZED_RE.test(code)) continue;          // 정규화를 «쓰고 있다»
    if (RAW_READ_RE.test(code)) bad.push(rel(f));
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
  const bad = [];
  const PAT = [
    /\bimport\(\s*path\.(?:join|resolve)\(/,          // import(path.join(...))
    /\bimport\(\s*[A-Za-z_$][\w$]*Path\b\s*\)/,        // import(entPath)
  ];
  for (const f of SCANNED) {
    const code = codeOnly(fs.readFileSync(f, 'utf8'));
    if (PAT.some(re => re.test(code))) bad.push(rel(f));
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
  /* ★구조 고정: statfsSync 분기가 있어야 윈도우에서도 «잰다»(건너뛰는 게 아니다). */
  const src = readSrc(__dirname, '_tmproot.js');
  assert.match(src, /statfsSync/, '★윈도우 조회 경로(statfsSync)가 사라졌다 — 거기선 다시 «못 잰다»가 된다');
});

test('③-2 쓰기 거부는 플랫폼별 «동등한 동작»이고, 「막았다」를 «써 봐서» 확인한다', () => {
  const D = require_('../../tools/hardening/lib/denywrite.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-wp-deny-'));
  try {
    assert.equal(D.probeWritable(dir).writable, true, '전제 미달 — 막기 전부터 못 쓴다');
    const h = D.denyWrite(dir);
    try {
      assert.equal(h.how, process.platform === 'win32' ? 'icacls /deny (OI)(CI)(W)' : 'chmod 0500');
      assert.equal(D.probeWritable(dir).writable, false, '★막았다는데 «여전히 써진다» — 가짜 초록이다');
      assert.deepEqual(h.denied, [dir], '막은 경로를 «선언»하지 않으면 「못 쟀다」가 「없다」가 된다');
      assert.ok(/EACCES|EPERM/.test(h.errCode), `거부 코드가 없다: ${h.errCode}`);
    } finally { h.restore(); }
    assert.equal(D.probeWritable(dir).writable, true, '되돌리지 못했다 — 뒷 검사를 오염시킨다');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
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
