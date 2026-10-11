/* css-no-orphan-block.test.mjs — ★★★«선택자 없는 ★고아 선언»이 ★없다 (2026-10-11 · ★실물로 ★났다)
 *
 * ★★★왜 ★생겼나 — ★★★내가 ★냈다. ★★그리고 ★★★검사 아홉 칸이 ★전부 ★초록이었다.
 *   ★`781d5f28`(설계 D) 이 ★`css/editor-extra.css` 에 ★★★같은 블록을 ★★두 번 ★넣었다:
 *     ★앞쪽 = ★★주석 ＋ ★`outline:…` ＋ ★`outline-offset:…` ＋ ★`}`  ⇐ ★★★여는 `{` 와 ★선택자가 ★★없다
 *     ★뒤쪽 = ★온전한 ★규칙(★선택자 ★넷 ＋ ★본문)
 *   ⇒ ★★★CSS 파서는 ★★맨 위에서 ★`outline:` 를 ★만나 ★★«망가진 선택자»로 ★읽고
 *     ★★★다음 ★`{…}` 까지 ★먹어 ★치운다 ⇒ ★★★뒤쪽의 ★진짜 규칙이 ★★삼켜졌다
 *   ⇒ ★★현빈 앱에서 ★★★커서가 ★★안 보였다(★`outlineStyle: "none"` · ★styleSheets 에 ★그 규칙 ★0건)
 *     ★★그런데 ★★기능은 ★돌았다(`__tplNavState()` ⇒ `depth:1 cursor:5`) ⇒ ★★«클래스는 ★붙었다»
 *
 * ★★★왜 ★아무도 ★못 잡았나 — ★★자가 ★★전부 ★★«다른 것»을 ★재고 ★있었다:
 *   ★`node --check` — ★★CSS 를 ★안 본다
 *   ★주석 짝 — ★여는 것 108 : ★닫는 것 108 ⇒ ★★맞는다 ⇒ ★★눈으로 ★안 보인다
 *     ⚠️★이 줄에 ★그 두 글자를 ★★그대로 ★쓰면 ★★★이 주석이 ★거기서 ★끝난다 —
 *       ★★261011 에 ★★실제로 ★그래서 ★★이 파일이 ★★안 풀렸다(★`node --test` 가 ★★0칸)
 *   ★내 ★`N6` — ★★「CSS 에 ★그 선택자가 ★있나」를 ★★★파일 글자로 ★쟀다 ⇒ ★★뒤쪽 블록에 ★맞아 ★★초록
 *   ★내 ★DOM 9칸 — ★★«클래스가 ★붙었나»만 ★쟀다 ⇒ ★★«보이나»는 ★★0칸
 *   ★지디 ★F4 — ★★제품 diff 를 ★★`template-browser.js` 만 ★읽었다(★CSS ＋16 을 ★안 읽었다)
 *   ★★★내 ★복구 검산 — ★★«지워진 줄»을 ★셌다(★3). ★★★이건 ★★더하기만 한 ★중복이라 ★★거기에 ★안 뜬다
 *   ⇒ ★★★여섯 자가 ★★전부 ★★과녁을 ★★빗겼다. ⇒ ★★그래서 ★★이 자를 ★★구조로 ★둔다
 *
 * ★★★무엇을 ★재나 — ★★«고아»를 ★★꼴로 ★잡는다(⛔그 한 블록만 ★잡지 ★않는다):
 *   ⑴ ★주석을 ★걷은 뒤 ★★중괄호 ★짝이 ★맞나 (★`{` 수 == ★`}` 수)
 *   ⑵ ★★★최상위에 ★★«선언»이 ★떠 있지 ★않나 — ★★`prop: value;` 가 ★★블록 ★밖에 ★있나
 *   ⇒ ★★★둘째가 ★핵이다. ★★⑴ 만으로는 ★★«짝은 맞는데 ★선택자가 ★빠진» 꼴을 ★★놓친다
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.join(import.meta.dirname, '..', '..');

/* ★★이 레인이 ★손댄 ★CSS. ⛔레포 전수로 ★넓히지 ★않는다 —
   ★★남의 옛 파일까지 ★내 묶음에서 ★빨갛게 ★만들면 ★★범위를 ★넓히는 것이다.
   ⇒ ★★넓히려면 ★★별 칸이고 ★★조정자 판단이다. */
const TARGETS = ['css/editor-extra.css'];

/** ★주석을 ★걷는다 — ★CSS 의 ★주석은 ★★한 꼴뿐이다(⛔`//` 는 ★CSS 주석이 ★아니다). */
const stripCss = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '');

/** ★★최상위(★블록 ★밖)에 ★떠 있는 ★«선언»을 ★모은다.
 *  ★★깊이를 ★세며 ★훑고, ★★깊이 ★0 에서 ★`:` 뒤 ★`;` 가 ★오면 ★★그건 ★★선언이다.
 *  ⛔`@media`·`@supports` 의 ★머리말에도 ★`:` 가 ★올 수 ★있어 ★★`@` 로 ★시작하는 ★덩이는 ★건너뛴다. */
function orphanDeclarations(src) {
  const s = stripCss(src);
  const out = [];
  let depth = 0, buf = '', line = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\n') line++;
    if (c === '{') { depth++; buf = ''; continue; }
    if (c === '}') { depth = Math.max(0, depth - 1); buf = ''; continue; }
    if (depth === 0) {
      if (c === ';') {
        const t = buf.trim();
        /* ★★«선언»의 꼴 = ★`prop: value` · ⛔`@import url(...)` 류는 ★뺀다 */
        if (t && !t.startsWith('@') && /^[-a-zA-Z]+\s*:/.test(t)) out.push({ line, text: t.slice(0, 70) });
        buf = '';
      } else buf += c;
    }
  }
  return out;
}

for (const rel of TARGETS) {
  test(`O1 ★${rel} — ★★주석 걷은 뒤 ★중괄호 ★짝이 ★맞나`, () => {
    const code = stripCss(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const o = (code.match(/\{/g) || []).length;
    const c = (code.match(/\}/g) || []).length;
    assert.strictEqual(o, c, `★★짝이 ★안 맞는다 — ★{ ${o} · } ${c} (차 ${o - c})`);
    /* ★★전제 — ★★셀 것이 ★있나. ⛔0 이면 ★«맞다»가 ★아니라 ★«안 쟀다»다 */
    assert.ok(o > 50, `★전제 — ★규칙이 ★50 이상이어야 한다(잰 값 ${o})`);
  });

  test(`O2 ★★★${rel} — ★★최상위에 ★★«선택자 없는 ★선언»이 ★없다`, () => {
    const orphans = orphanDeclarations(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    assert.deepStrictEqual(orphans, [],
      `★★★고아 선언이 ★있다 — ★★CSS 파서가 ★★다음 규칙을 ★삼킨다:\n     ` +
      orphans.map(o => `:${o.line} ${o.text}`).join('\n     '));
  });
}

test('O3 ★★★이 자가 ★★실제로 ★무나 — ★★★그날의 ★깨진 글을 ★먹여 ★본다', () => {
  /* ★★★양성대조 — ★★«그 블록»을 ★★손으로 ★만들어 ★먹인다.
     ⛔「지금 파일이 ★초록이다」만으로는 ★★이 자가 ★★산 것인지 ★모른다(★0건이 ★초록). */
  const BROKEN = [
    '.a:hover { background: #222; }',
    '/* ★주석 — ★선택자가 ★빠진 ★블록이 ★아래에 ★온다 */',
    '  outline: 1.5px solid var(--sel-color);',
    '  outline-offset: -1.5px;',
    '}',
    '.b.cursor, .c.cursor {',
    '  outline: 1.5px solid var(--sel-color);',
    '}',
  ].join('\n');
  const found = orphanDeclarations(BROKEN);
  assert.ok(found.length >= 1,
    `★★깨진 글에서 ★고아를 ★★못 찾았다(잰 값 ${found.length}) — ★★이 자는 ★★아무것도 ★안 잡는다`);
  assert.ok(found.some(f => /outline/.test(f.text)), `★잰 값: ${JSON.stringify(found)}`);

  /* ★★음성대조 — ★★온전한 글에서는 ★0 이어야 한다 */
  const OK = '.a:hover { background: #222; }\n.b.cursor, .c.cursor {\n  outline: 1px solid red;\n}\n';
  assert.deepStrictEqual(orphanDeclarations(OK), [], '★온전한 글에서 ★고아를 ★찾았다 — ★거짓 양성');

  /* ★★★`@media` 를 ★★고아로 ★읽지 ★않나 — ★★거짓 양성의 ★가장 ★흔한 꼴 */
  const MEDIA = '@media (prefers-color-scheme: dark) {\n  .a { color: red; }\n}\n@import url("x.css");\n';
  assert.deepStrictEqual(orphanDeclarations(MEDIA), [], '★`@media`·`@import` 를 ★고아로 ★읽는다');
});
