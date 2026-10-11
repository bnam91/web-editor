/* popout-shim-deps.test.mjs — ★★별창 ★셔밍 ★주석의 ★★«수»가 ★★소스와 ★같나 (★지디 ⑵㉡ · 2026-10-11)
 *
 * ★★★왜 ★생겼나 — ★★그 주석의 ★수가 ★★★셋 중 ★둘이 ★틀렸다. ★★그리고 ★★전부터 ★틀렸다.
 *   ★`pages/template-browser.html` 의 ★셔밍 머리말:
 *     「★바깥 의존이 ★넷뿐이다: ★loadTemplates(8) · insertTemplate(4) · deleteTemplate(1) · _loadCanvas(1)」
 *   ★★참값(★내가 ★쟀다 · ★`origin/dev` 와 ★★같다 ⇒ ★★내 diff 가 ★만든 게 ★아니다):
 *     ★loadTemplates ★★6 · ★insertTemplate ★★3 · ★deleteTemplate ★1 · ★_loadCanvas ★1
 *
 * ★★★왜 ★검사로 ★두나 — ★★지디가 ★★두 길을 ★줬다:
 *   ㉠ ★수를 ★빼고 ★★이름만 ★남긴다      ㉡ ★★그 수를 ★재는 ★검사를 ★세운다
 *   ⇒ ★★★㉡ 를 ★골랐다(★그가 ★권했다). ★★까닭: ★★그 수는 ★★쓸모가 ★있다 —
 *     ★★«의존이 ★몇 자리에서 ★불리나»는 ★★셔밍을 ★고칠 때 ★★읽는 수다.
 *     ⇒ ★★그러니 ★★지우는 대신 ★★★썩지 ★않게 ★묶는다.
 *   ⇒ ★★그리고 ★★★«손으로 적은 수»를 ★★또 ★손으로 ★고치면 ★★그게 ★★둘째 명부다 —
 *     ★★이 칸이 ★★그 둘을 ★★한 자로 ★잠근다.
 *
 * ★★★이 레포에 ★★«주석의 수가 ★소스와 ★갈렸다»가 ★★오늘 ★★두 번째다(★내 ⒜ 주석 ★「다섯」 ＋ ★이 html)
 *   ⇒ ★★★꼴이다 ⇒ ★★자로 ★바꾼다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const HTML = 'pages/template-browser.html';
const JS = 'js/panels/template-browser.js';

const NAMES = ['loadTemplates', 'insertTemplate', 'deleteTemplate', '_loadCanvas'];
const PAIR = /\b(loadTemplates|insertTemplate|deleteTemplate|_loadCanvas)\((\d+)\)/g;

/** ★주석 ★안의 ★★«이름(수)» 짝을 ★뽑는다 — ★★★«넷이 ★다 든 ★그 한 줄»만 ★본다.
 *
 *  ★★★★첫 꼴은 ★★파일 ★전체를 ★훑어 ★★«마지막 일치»를 ★썼다 ⇒ ★★★빨강이 ★안 풀렸다(261011).
 *    ★까닭: ★★내가 ★★«옛 수가 ★틀렸다»를 ★★★이력으로 ★같은 주석에 ★적었고
 *      ★★그 줄에 ★★`loadTemplates(8)·insertTemplate(4)` 가 ★★글자로 ★있다
 *      ⇒ ★★★내 ★«역사 메모»가 ★★★선언으로 ★읽혔다.
 *  ⇒ ★★★그래서 ★★«명부 줄»을 ★★꼴로 ★고른다: ★★★네 이름이 ★★한 줄에 ★다 ★있는 줄.
 *    ⇒ ★★이력 줄은 ★★둘만 ★품으니 ★★안 걸린다 — ★★그게 ★★가름이다.
 *  (★내 명부: ★「★게이트는 ★«산문»이 ★아니라 ★«대상»을 ★재야 한다 — ★주석을 ★먼저 ★걷어내라」
 *    ⇒ ★★여기선 ★걷을 ★수가 ★없다(★선언 ★자체가 ★주석이다) ⇒ ★★★대신 ★★«줄»로 ★좁힌다) */
function documented() {
  const html = fs.readFileSync(path.join(ROOT, HTML), 'utf8');
  const lines = html.split('\n');
  const decl = lines.filter(l => NAMES.every(n => l.includes(n + '(')));
  if (decl.length !== 1) return { __declLines: decl.length };
  const out = {};
  for (const m of decl[0].matchAll(PAIR)) out[m[1]] = Number(m[2]);
  return out;
}

/** ★★소스에서 ★★참말 ★부르는 ★수 — ★★★주석을 ★걷고 ★센다.
 *  ⛔주석을 ★안 걷으면 ★★«설명에 적힌 이름»이 ★★호출로 ★세어진다(★내 명부: ★주석은 ★게이트의 ★입력). */
function actual() {
  const code = stripComments(fs.readFileSync(path.join(ROOT, JS), 'utf8'));
  const out = {};
  for (const n of NAMES) {
    out[n] = (code.match(new RegExp('\\b' + n + '\\s*\\(', 'g')) || []).length;
  }
  return out;
}

test('P0 ★전제 — ★★주석에서 ★★네 짝을 ★뽑았나 (⛔0 이면 ★«맞다»가 ★아니라 ★«안 쟀다»다)', () => {
  const doc = documented();
  /* ★★★«명부 줄»이 ★★딱 ★하나인가 — ⛔둘이면 ★★어느 것이 ★선언인지 ★모른다 */
  assert.strictEqual(doc.__declLines, undefined,
    `★★네 이름이 ★다 든 ★줄이 ★하나가 ★아니다(잰 값: ${doc.__declLines}) — ★★명부가 ★둘이 ★됐다`);
  const keys = Object.keys(doc).sort();
  assert.deepStrictEqual(keys, ['_loadCanvas', 'deleteTemplate', 'insertTemplate', 'loadTemplates'],
    `★주석에서 ★뽑힌 이름이 ★넷이 ★아니다 — ★잰 값: ${JSON.stringify(doc)}`);
  /* ★★주석 뽑기가 ★★살았나 — ★★양성대조(★수가 ★★전부 ★0 이면 ★정규식이 ★죽었다) */
  assert.ok(Object.values(doc).every(v => Number.isInteger(v) && v >= 0),
    `★수가 ★정수가 ★아니다 — ${JSON.stringify(doc)}`);
});

test('P1 ★★★주석의 ★수 == ★★소스의 ★참 호출 수', () => {
  const doc = documented(), act = actual();
  const bad = Object.keys(doc).filter(k => doc[k] !== act[k]);
  assert.deepStrictEqual(bad, [],
    '★★주석의 ★수가 ★소스와 ★갈렸다:\n     ' +
    bad.map(k => `${k}: ★주석 ${doc[k]} vs ★★소스 ${act[k]}`).join('\n     ') +
    `\n     ⇒ ★`+`${HTML}` + ` 의 ★그 줄을 ★★잰 값으로 ★고쳐라`);
});

test('P2 ★★★이 자가 ★실제로 ★무나 — ★★가짜 수를 ★먹여 ★뒤집힌다', () => {
  /* ⛔「지금 ★맞다」만으로는 ★★이 자가 ★★산 것인지 ★모른다(★0건이 ★초록).
     ⇒ ★★★주석 꼴을 ★★손으로 ★만들어 ★★식에 ★먹인다. */
  const fakeHtml = '/* 바깥 의존: loadTemplates(99) · insertTemplate(3) */';
  const got = {};
  for (const m of fakeHtml.matchAll(/\b(loadTemplates|insertTemplate|deleteTemplate|_loadCanvas)\((\d+)\)/g)) {
    got[m[1]] = Number(m[2]);
  }
  assert.strictEqual(got.loadTemplates, 99, `★가짜 수를 ★못 뽑았다 — ${JSON.stringify(got)}`);
  const act = actual();
  assert.notStrictEqual(got.loadTemplates, act.loadTemplates,
    '★★가짜 99 가 ★참값과 ★같다 — ★★대조가 ★안 선다(★다른 수를 ★골라라)');
  /* ★★그리고 ★★주석을 ★걷는 것이 ★★뜻이 ★있나 — ★★원문과 ★걷은 것의 ★수가 ★같을 ★수도 ★있다.
     ⇒ ★★그때도 ★★걷는 쪽이 ★★맞다(★★앞으로 ★주석에 ★그 이름을 ★더 적으면 ★갈린다) ⇒ ★★적어만 ★둔다. */
  const raw = fs.readFileSync(path.join(ROOT, JS), 'utf8');
  const rawN = (raw.match(/\bloadTemplates\s*\(/g) || []).length;
  assert.ok(rawN >= act.loadTemplates,
    `★원문 수(${rawN})가 ★걷은 수(${act.loadTemplates})보다 ★작다 — ★★걷기가 ★거꾸로 돈다`);
});
