/* comment-test-names.test.mjs — ★★제품 주석이 ★부르는 ★★«검사 이름»이 ★★★실재하나 (지디 ⑴ · 2026-10-11)
 *
 * ★★★왜 ★생겼나 — ★★하루에 ★★두 번, ★★★주석이 ★★«잠근다»고 ★말한 ★단언이 ★★없었다:
 *   ⑴ ★`template-browser.js` 가 ★★「★검사가 ★«이 글자 == tplSortDefault»를 ★잠근다」고 ★적었는데
 *      ★★★그 단언이 ★★없었다 ⇒ ★기본 열쇠가 ★바뀌자 ★★제품 ★세 자리가 ★거짓이 ★됐고 ★★전수는 ★초록이었다.
 *   ⑵ ★같은 파일 ★정렬 주석이 ★★「★(검사 F1)」이라 ★적었는데 ★★★F1 은 ★그 사이 ★★«다른 것»을 ★잠그게 ★됐다.
 *      ★★지디가 ★F4(제품 diff 전문 읽기)에서 ★잡았다 — ★★한 주석에 ★★참 하나 · ★거짓 둘이었다.
 *
 * ★★★그래서 ★★무엇을 ★잠그나 — ★★★«이름»이 ★아니라 ★★«이름 ＋ 자리»의 ★짝이다:
 *   ★제품 주석이 ★★«검사 파일 경로»를 ★부르면, ★★그 ★뒤에 ★딸린 ★★칸 이름들이
 *   ★★★정말 ★그 파일에 ★★`test('<칸>…` 으로 ★있나를 ★전수로 ★잰다.
 *   ⇒ ★★⛔«모든 ★`F\d+` 가 ★검사여야 한다»로 ★★안 걸었다 — ★★★거짓 빨강이 ★쏟아진다:
 *     ★제품 주석엔 ★★작업 이름(★`C11`)·★무력화 라벨(★`G4`)·★지디 게이트 이름(★`F4`)이 ★★섞여 산다.
 *     ★★그건 ★★검사가 ★아니고, ★★그걸 ★검사로 ★요구하면 ★★자가 ★거짓말을 한다.
 *   ⇒ ★★★«파일을 ★같이 ★부른 ★주장»만 ★★검증 가능하다 — ★★그 자리만 ★잰다. ★이게 ★★자의 ★«창»이다.
 *
 * ★★★이 자는 ★★제 전제를 ★★단언한다 — ★★★«잴 ★주장이 ★하나라도 ★있나».
 *   ⛔0건이면 ★★이 파일은 ★★«초록»이 ★아니라 ★★«안 재고 있다»다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');

/* ★★★과녁 = ★★이 레인이 ★손댄 ★제품 파일. ⛔레포 전수로 ★넓히지 ★않는다 —
   ★★남의 파일의 ★옛 주석까지 ★★내 묶음에서 ★빨갛게 ★만들면 ★★그건 ★★범위를 ★넓히는 것이다.
   ⇒ ★★넓히려면 ★★그건 ★★별 칸이고 ★★조정자 ★판단이다. */
const TARGETS = [
  'js/panels/template-browser.js',
  'js/panels/_tpl-sort.js',
  'js/panels/_tpl-search.js',
  'js/panels/_tpl-nav.js',
  'js/panels/_gallery-sort.js',
];

const FILEREF = /(tests\/[A-Za-z0-9_./-]+\.(?:test\.mjs|test\.js|spec\.js))/g;
const CELL = /\b([A-Z]{1,2}\d+[a-z]?)\b/g;

/** ★★주석 ★안의 ★«파일 ＋ 칸» 짝을 ★모은다.
 *  ★★★`stripComments` 의 ★★«반대»를 ★쓴다 — ★★여기선 ★★주석만이 ★과녁이다.
 *    ⇒ ★★코드에서 ★뺀 ★나머지가 ★주석이다: ★원본에서 ★`stripComments` 결과를 ★★줄별로 ★빼면
 *      ★★그 줄의 ★주석 부분이 ★남는다. ⛔정규식으로 ★주석을 ★★다시 ★긁지 ★않는다(★공용 부품을 ★쓴다). */
function commentOnly(src) {
  const code = stripComments(src).split('\n');
  return src.split('\n').map((line, i) => {
    const c = code[i] || '';
    return line.startsWith(c) ? line.slice(c.length) : line;
  }).join('\n');
}

function claimsIn(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const text = commentOnly(src);
  const out = [];
  const refs = [...text.matchAll(FILEREF)];
  refs.forEach((m, idx) => {
    const from = m.index + m[0].length;
    const to = idx + 1 < refs.length ? refs[idx + 1].index : Math.min(text.length, from + 240);
    const win = text.slice(from, Math.min(to, from + 240));
    const cells = [...new Set([...win.matchAll(CELL)].map(x => x[1]))];
    out.push({ rel, file: m[1], cells, win: win.slice(0, 80) });
  });
  return out;
}

const CLAIMS = TARGETS.flatMap(claimsIn);

test('T0 ★전제 — ★★잴 ★주장이 ★있나 (⛔0건은 ★«초록»이 ★아니라 ★«안 재고 있다»다)', () => {
  assert.ok(CLAIMS.length >= 3,
    `★★제품 주석이 ★검사 파일을 ★부르는 자리가 ★3 미만이다(잰 값: ${CLAIMS.length}) ⇒ ★★이 자가 ★★헛돈다`);
  /* ★★★그리고 ★★주석만 ★뽑는 자가 ★★살아 있나 — ★양성·음성 ★둘 다 */
  const probe = "const a = 1; // tests/unit/zzz.test.mjs Z9\nconst b = 'tests/unit/no.test.mjs';";
  const only = commentOnly(probe);
  assert.ok(only.includes('zzz.test.mjs'), '★★주석 뽑기가 ★죽었다 — ★주석의 ★경로를 ★못 봤다');
  assert.ok(!only.includes('no.test.mjs'),
    '★★주석 뽑기가 ★★«코드의 ★문자열»까지 ★먹는다 — ★★그러면 ★거짓 주장을 ★잰다');
});

test('T1 ★★★주석이 ★부르는 ★검사 ★파일이 ★실재하나', () => {
  const missing = [];
  for (const c of CLAIMS) {
    if (!fs.existsSync(path.join(ROOT, c.file))) missing.push(`${c.rel} → ${c.file}`);
  }
  assert.deepStrictEqual(missing, [],
    `★★주석이 ★부르는 ★검사 파일이 ★★없다:\n     ${missing.join('\n     ')}`);
});

test('T2 ★★★주석이 ★부르는 ★★칸 이름이 ★★그 파일에 ★실재하나', () => {
  const missing = [];
  for (const c of CLAIMS) {
    const p = path.join(ROOT, c.file);
    if (!fs.existsSync(p)) continue;              // ★T1 이 ★그 칸을 ★잡는다
    const body = fs.readFileSync(p, 'utf8');
    for (const cell of c.cells) {
      /* ★★`test('F1 …` 또는 ★`test('F1·…` 처럼 ★★이름 ★뒤에 ★숫자·소문자가 ★안 붙는 꼴.
         ⛔`F1` 로 ★`F10` 을 ★맞추지 ★않게 ★경계를 ★건다. */
      const re = new RegExp(`test\\(['"\`]${cell}(?![0-9A-Za-z])`);
      if (!re.test(body)) missing.push(`${c.rel} → ${c.file} 의 ★${cell}`);
    }
  }
  assert.deepStrictEqual(missing, [],
    `★★주석이 ★부르는 ★칸이 ★★그 파일에 ★★없다:\n     ${missing.join('\n     ')}`);
});

test('T3 ★★자가 ★★실제로 ★물나 — ★★가짜 주장을 ★★먹여 ★★뒤집힌다', () => {
  /* ★★★파일을 ★고치지 ★않고 ★★식으로 ★증명한다 — ⛔T1·T2 가 ★★«항상 참»이 ★아님을 ★여기서 ★잠근다.
     (★내 명부: ★「내가 ★건 ★단언이 ★«항상 참»이라 ★아무것도 ★안 잠갔다」) */
  const fake = '/* ★거짓 주장 — tests/unit/tpl-browser-sort.test.mjs 의 ★ZZ9 가 ★잠근다 */\nconst x = 1;';
  const text = commentOnly(fake);
  const refs = [...text.matchAll(FILEREF)];
  assert.strictEqual(refs.length, 1, '★전제 — ★가짜 주장에서 ★파일 참조 ★하나를 ★뽑아야 한다');
  const cells = [...new Set([...text.slice(refs[0].index + refs[0][0].length).matchAll(CELL)].map(x => x[1]))];
  assert.ok(cells.includes('ZZ9'), '★전제 — ★칸 이름을 ★뽑아야 한다(잰 값: ' + cells.join(' ') + ')');
  const body = fs.readFileSync(path.join(ROOT, 'tests/unit/tpl-browser-sort.test.mjs'), 'utf8');
  assert.ok(!new RegExp(`test\\(['"\`]ZZ9(?![0-9A-Za-z])`).test(body),
    '★★가짜 칸이 ★실재한다 — ★★대조가 ★안 선다(★이름을 ★바꿔라)');
  /* ★★그리고 ★★«F1 이 ★F10 을 ★맞추지 ★않나» — ★경계가 ★사나 */
  assert.ok(new RegExp(`test\\(['"\`]F1(?![0-9A-Za-z])`).test(body), '★전제 — ★F1 은 ★실재한다');
  assert.ok(new RegExp(`test\\(['"\`]F10(?![0-9A-Za-z])`).test(body), '★전제 — ★F10 도 ★실재한다');
  const onlyF1 = (body.match(new RegExp(`test\\(['"\`]F1(?![0-9A-Za-z])`, 'g')) || []).length;
  assert.strictEqual(onlyF1, 1, '★★F1 경계가 ★느슨해 ★여럿을 ★물었다(잰 값: ' + onlyF1 + ')');
});
