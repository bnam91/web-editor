/* css-comment-before-rule — ★★«주석이 ★진짜 규칙보다 ★먼저 집히는» 꼴을 ★기계가 막는다. (2026-10-10 t3frame)
 *
 * ★★왜 생겼나 — ★2026-10-10, ★내가 ★`css/editor-blocks.css` 주석에 ★선례 선택자를 ★★글자로 적었고
 *   `tests/unit/selection-overlay-ellipse.test.mjs` 의 ★`ruleOf()` 가 ★★`CSS.indexOf(sel)` 로
 *   ★«첫 등장»을 찾는 자라 ★★내 주석을 ★먼저 집었다 ⇒ ★뒤따르는 `{…}` 가 ★엉뚱한 규칙의 몸통이었다
 *   ⇒ ★★U-CIRCLE-12 가 ★빨개졌다(★제품은 ★멀쩡했다).
 *
 * ★★★그리고 ★그 파일 ★머리말이 ★★이미 ★경고하고 있었다 —
 *   「⛔주석에 «선택자 꼴»을 적지 마라 … ★2026-09-28 에 ★실제로 그래서 ★U-CIRCLE-12 가 ★빨개졌다」
 *   ★★나는 ★그 경고를 ★★그 세션에서 ★읽고도 ★★밟았다. ⇒ ★★★«적어 둔 것»과 ★«손이 ★그걸 쓰는 것»은 ★다른 양이다.
 *   ★★그 꼴이 ★★같은 날 ★팀 전체에서 ★다섯 번 났다(지디 집계).
 *   ⇒ ★★그래서 ★★사람 기억에 ★안 기대는 ★자를 ★세운다. ★★이 파일이 ★그 자다.
 *
 * ★★무엇을 재나 — ★★«검사가 ★`indexOf` 꼴로 ★찾는 선택자»에 ★한해,
 *   ★그 선택자가 ★★«진짜 규칙보다 ★앞»의 ★주석에 ★글자로 ★들어 있나.
 *   ★★선택자 목록을 ★★손으로 ★적지 ★않는다 — ★★검사 소스에서 ★파생한다(⛔명부가 둘이면 한쪽만 늙는다).
 *
 * ★★왜 ★이렇게 ★좁혔나 — ★실측(2026-10-10)으로 ★분모를 ★세 번 ★좁혔다:
 *   ⑴ 「주석에 선택자 글자가 있나」            → ★★34건 (★이미 그만큼 있다 ⇒ ★전면 금지는 ★못 쓴다)
 *   ⑵ 「그중 ★진짜 규칙보다 ★앞인가」          → ★★24건 (★여전히 ★못 쓴다)
 *   ⑶ 「그중 ★★검사가 ★실제로 ★찾는 선택자인가」 → ★★★0건  ⇒ ★★«반드시 0»으로 ★쓸 수 있다
 *   ★★⇒ ★앞 둘은 ★«재기 쉬운 양»이고 ★★셋째가 ★«재려던 양»이다. ★★그 24건은 ★무해하다 —
 *     ★아무 검사도 ★그것들을 ★`indexOf` 로 ★찾지 ★않는다.
 *
 * ⛔이 자가 ★안 재는 것 ★셋
 *   ⒤ ★`ruleOf`·`CSS.indexOf` ★꼴이 ★아닌 ★다른 파싱(정규식·CSSOM)은 ★안 본다
 *   ⅱ) ★JS·HTML 의 ★같은 병(★주석이 ★소스 파싱 게이트를 ★먹이는 것)은 ★안 본다 — ★이 자는 ★CSS 전용이다
 *   ⅲ) ★선택자를 ★★«쪼개 적은» 주석(예: `.shape-` ＋ `block.selected`)은 ★★안 잡는다.
 *       ★★그건 ★고의 회피이고, ★이 자는 ★★«실수»를 ★막는 자다
 *
 * 실행: node --test tests/unit/css-comment-before-rule.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMMENT = /\/\*[\s\S]*?\*\//g;

/** ★검사 소스에서 ★«indexOf 꼴로 찾는 선택자»를 ★파생한다. ⛔손으로 적지 않는다. */
function derivedSelectors() {
  const out = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(mjs|js)$/.test(e.name)) continue;
      const t = fs.readFileSync(p, 'utf8');
      for (const m of t.matchAll(/ruleOf\(\s*['"]([^'"]+)['"]|CSS\.indexOf\(\s*['"]([^'"]+)['"]/g)) {
        const s = (m[1] || m[2] || '').trim();
        if ((s.startsWith('.') || s.startsWith('#')) && !s.includes('{')) out.add(s);
      }
    }
  };
  walk(path.join(ROOT, 'tests'));
  return [...out];
}

/** ★주석을 ★«자리를 지키며» 지운 사본 — ⇒ ★오프셋 비교가 성립한다 */
function maskComments(src) {
  return src.replace(COMMENT, (m) => ' '.repeat(m.length));
}

/** ★그 css 글자에서 ★«검사가 찾는 선택자»가 ★규칙보다 ★앞 주석에 든 자리 전수 */
function offenders(src, sels) {
  const code = maskComments(src);
  const out = [];
  for (const sel of sels) {
    const at = code.indexOf(sel);
    if (at < 0) continue;                       /* ★그 파일엔 ★그 규칙이 ★없다 */
    for (const m of src.matchAll(COMMENT)) {
      if (m.index < at && m[0].includes(sel)) {
        out.push({ sel, commentLine: src.slice(0, m.index).split('\n').length,
                   ruleLine: src.slice(0, at).split('\n').length });
      }
    }
  }
  return out;
}

test('X1 ★전제 — ★검사가 ★찾는 선택자가 ★0 이 아니다 (⛔0 이면 ★아래가 ★공회전한다)', () => {
  const sels = derivedSelectors();
  /* ⛔메시지 안에 ★백틱을 ★쓰지 ★마라 — ★템플릿 리터럴을 ★끊는다(★오늘 ★세 번째로 밟았다) */
  assert.ok(sels.length >= 3,
    '★파생된 선택자가 ' + sels.length + '건이다 — indexOf 꼴 자가 사라졌으면 ★이 자도 옮겨라');
});

test('X2 ★★주석이 ★그 규칙보다 ★먼저 집히는 자리가 ★★0건이다', () => {
  const sels = derivedSelectors();
  const all = [];
  const dir = path.join(ROOT, 'css');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.css')).sort()) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const o of offenders(src, sels)) all.push(`${f}:${o.commentLine} 주석이 «${o.sel}» (그 규칙은 ${o.ruleLine}행)`);
  }
  assert.deepEqual(all, [],
    '★★주석이 ★진짜 규칙보다 ★먼저 집힌다 — ★indexOf 로 찾는 검사가 ★주석을 ★규칙으로 읽는다.\n'
    + '  ⇒ ★그 선택자를 ★주석에서 ★걷고 ★말로 적어라(예: «도형을 고르는 동안 조상 프레임의 overflow 를 푸는 규칙»).\n  '
    + all.join('\n  '));
});

test('X3 ★★양성대조 — ★지어낸 «앞 주석»을 ★자가 ★잡는다 (⛔없으면 X2 의 0건은 «안 재고 있다»와 같다)', () => {
  const sels = derivedSelectors();
  const victim = sels[0];
  /* ★★내 2026-10-10 사고를 ★그대로 ★재현한 ★합성 판 */
  const fake = `/* ★선례 = 이 파일 아래 ${victim} — 조상 overflow 해제 */\n`
             + `.frame-block:has(> .x) { overflow: visible; }\n`
             + `${victim} { outline-offset: 0; }\n`;
  const hit = offenders(fake, sels);
  assert.ok(hit.length >= 1, `★자가 ★지어낸 앞 주석을 ★못 잡는다 (victim=${victim})`);
  assert.equal(hit[0].sel, victim);
});

test('X4 ★★음성대조 — ★규칙 ★«뒤»의 주석은 ★안 잡는다 (⛔거짓양성이면 ★멀쩡한 주석 24건을 ★막는다)', () => {
  const sels = derivedSelectors();
  const victim = sels[0];
  /* ★실측(2026-10-10): ★이 레포엔 ★«규칙 뒤»에서 그 글자를 품은 주석이 ★24건 있고 ★★무해하다 */
  const fake = `${victim} { outline-offset: 0; }\n`
             + `/* 아래에서 ${victim} 를 참조한다 — 규칙보다 ★뒤이므로 indexOf 가 ★규칙을 먼저 집는다 */\n`;
  assert.deepEqual(offenders(fake, sels), [], '★자가 ★규칙 뒤 주석까지 ★잡는다 — 거짓양성');
});
