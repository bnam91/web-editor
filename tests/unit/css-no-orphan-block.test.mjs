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

/* ★★★261011 ⒝ — ★★★«범위»를 ★★넓혔다. ★★★까닭을 ★적는다:
 *   ★★내가 ★★지디에게 ★「★CSS/HTML ★★3개 ★파일이 ★걸렸다」라 ★적었다. ★★★그 수는 ★★틀렸다 —
 *   ★★그때 ★★이 자의 ★범위는 ★★★1개(★`css/editor-extra.css`)였다.
 *   ⇒ ★★★두 길이 ★있었다: ㉠ ★수를 ★「1」로 ★고친다  ㉡ ★★범위를 ★★참말 ★3으로 ★넓힌다
 *   ⇒ ★★★㉡ 를 ★골랐다. ★★까닭: ★★b2 가 ★손댄 ★파일이 ★★바로 ★★이 둘(★두 HTML)이고,
 *     ★★★둘 다 ★★인라인 `<style>` 을 ★품는다 ⇒ ★★★같은 병(★고아 블록)이 ★★살 수 ★있는 ★자리다.
 *     ★★그리고 ★★미리 ★쟀다: ★둘 다 ★고아 ★0 ⇒ ★★넓혀도 ★★남의 ★빨강을 ★★안 끌어온다.
 * ⛔⛔그런데 ★★★«넓혔다»가 ★★곧 ★«잰다»는 ★★아니다 —
 *   ★★뽑기(`<style>` ★긁기)가 ★★빗나가면 ★★빈 글이 ★들어와 ★★★조용히 ★초록이 ★된다(★0건이 ★초록).
 *   ⇒ ★★★그래서 ★★아래 ★O1h 가 ★★«뽑힌 ★규칙 수»를 ★★★먼저 ★단언한다. */
const HTML_TARGETS = ['index.html', 'pages/template-browser.html'];

/** ★HTML 에서 ★★인라인 ★`<style>` ★속을 ★긁는다 — ★★★«몇 덩이·몇 줄»까지 ★돌려준다.
 *  ⇒ ★★부르는 쪽이 ★★«뽑혔나»를 ★★수로 ★잴 수 ★있게. */
function inlineStyles(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const out = [];
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    out.push({ css: m[1], startLine: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

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

for (const rel of HTML_TARGETS) {
  test(`O1h ★${rel} — ★★★«뽑혔나»부터: ★인라인 ★규칙 수 ＋ ★중괄호 ★짝`, () => {
    const blocks = inlineStyles(rel);
    /* ★★★전제 ★하나 — ⛔0덩이면 ★«고아가 ★없다»가 ★아니라 ★★«안 쟀다»다 */
    assert.ok(blocks.length >= 1, `★<style> 덩이가 ★0 이다 — ★★뽑기가 ★빗나갔나? (${rel})`);
    let o = 0, c = 0;
    for (const b of blocks) {
      const code = stripCss(b.css);
      o += (code.match(/\{/g) || []).length;
      c += (code.match(/\}/g) || []).length;
    }
    /* ★★★전제 ★둘 — ★★뽑힌 ★속이 ★★빈 글이 ★아닌가 */
    assert.ok(o >= 3, `★뽑힌 ★규칙이 ★3 미만이다(잰 값 ${o}) — ★★빈 글을 ★재고 ★있다`);
    assert.strictEqual(o, c, `★★짝이 ★안 맞는다 — ★{ ${o} · } ${c} (차 ${o - c})`);
  });

  test(`O2h ★★★${rel} — ★★인라인 ★`+`<style>` + ` 안에 ★★«선택자 없는 ★선언»이 ★없다`, () => {
    const bad = [];
    for (const b of inlineStyles(rel)) {
      for (const o of orphanDeclarations(b.css)) bad.push(`:${b.startLine + o.line - 1} ${o.text}`);
    }
    assert.deepStrictEqual(bad, [],
      `★★★고아 선언이 ★있다 — ★★CSS 파서가 ★★다음 규칙을 ★삼킨다:\n     ` + bad.join('\n     '));
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

test('O4 ★★★HTML 길도 ★★무나 — ★★★깨진 ★인라인 `<style>` 을 ★먹여 ★본다', () => {
  /* ⛔O1h·O2h 가 ★★지금 ★초록인 것은 ★★«파일이 ★온전하다»와 ★★«이 길이 ★죽었다»를 ★★★구분하지 ★못한다.
     ⇒ ★★★뽑기＋찾기를 ★★이어 ★돌려 ★★빨강을 ★★★손으로 ★만든다.
     ★★그리고 ★★★«실물에서 ★뽑은 ★꼴»로 ★만든다 — ★★그날 ★내가 ★낸 ★고아가 ★★바로 ★이 꼴이었다. */
  const BROKEN_HTML = [
    '<html><head><style>',
    '  .x { color: red; }',
    '/* ★선택자가 ★빠졌다 */',
    '  outline: 1.5px solid var(--sel-color);',
    '}',
    '  .y { color: blue; }',
    '</style></head><body></body></html>',
  ].join('\n');
  /* ★뽑기와 ★같은 ★식 — ⛔다른 식을 ★쓰면 ★★이 대조는 ★«뽑기»를 ★★안 잰다 */
  const got = [...BROKEN_HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  assert.strictEqual(got.length, 1, `★덩이를 ★★1개 ★못 뽑았다(잰 값 ${got.length})`);
  const found = orphanDeclarations(got[0][1]);
  assert.ok(found.some(f => /outline/.test(f.text)),
    `★★깨진 ★인라인 ★글에서 ★고아를 ★★못 찾았다 — ★★HTML 길은 ★★아무것도 ★안 잡는다. ★잰 값: ${JSON.stringify(found)}`);

  /* ★★음성대조 — ★온전한 ★인라인 글에서는 ★0 */
  const OK_HTML = '<style>\n  .x { color: red; }\n  .y { outline: 1px solid red; }\n</style>';
  const ok = [...OK_HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  assert.strictEqual(ok.length, 1);
  assert.deepStrictEqual(orphanDeclarations(ok[0][1]), [], '★온전한 ★인라인 글에서 ★고아를 ★찾았다 — ★거짓 양성');
});
