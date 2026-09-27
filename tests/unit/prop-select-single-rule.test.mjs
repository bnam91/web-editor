/* prop-select-single-rule.test.mjs — `.prop-select` 는 «한 벌»이다. (T-233, 2026-09-27)
 *
 * ★★무엇이 있었나 — `css/editor-props.css` 에 `.prop-select { … }` 가 «두 벌»이었다(`:148`·`:655`).
 *   둘째 벌이 첫 벌의 «모든» 선언을 같은 값으로 갖고 ＋`appearance:none`·화살표·`padding-right:24px`
 *   를 더 들었다. 같은 특이도면 «나중»이 이기므로 ★첫 벌은 통째로 죽어 있었다.
 *   ★실측으로 확인했다 — 첫 벌을 지우기 «전/후» 의 `getComputedStyle` 27개 속성이 ★0바이트 차이.
 *
 * ★★왜 위험했나 — 두 벌은 «보이는 버그»를 안 내고도 ★판정을 틀리게 만든다.
 *   검사 `tests/dom/grid-panel-icon-spec.dom.spec.js` 의 `anchorCss()` 가 «첫» 블록을 떠서
 *   「이 드롭다운엔 화살표가 없다」로 읽었고, 그 때문에 «마지막» 블록을 뜨도록 고쳐야 했다.
 *   ⇒ ★죽은 중복은 «계측기를 눈멀게» 한다. 그것이 이 카드가 따로 선 까닭이다.
 *
 * ★무엇을 잠그나
 *   R1  ★`.prop-select` «기본 선언»이 CSS 전체에서 한 곳이다
 *   R2  ★그 한 곳이 화살표 셋을 다 든다(appearance:none ＋ 토큰 ＋ padding-right)
 *   R3  ★`:hover`/`:focus` 도 각각 한 곳이다 — 함께 두 벌이었다
 *   R4  ⛔화살표를 «리터럴 SVG» 로 다시 박지 않는다 — 토큰(`--ui-select-caret`) 한 곳에서 온다
 *   N1  음성대조 — 블록을 한 벌 더 붙이면 R1 이 빨개진다
 *
 * ⛔선택자 «수»만 세지 않는다 — `.prop-export-row .prop-select { flex: 1 }` 처럼 «조합 선택자»는
 *   다른 규칙이다(그것까지 세면 이 검사가 「두 벌」을 영원히 외친다). 그래서 줄머리로 잰다.
 *
 * 실행: node --test tests/unit/prop-select-single-rule.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const { makeStripper } = createRequire(import.meta.url)('./_strip-comments.js');

/** css/ 아래 모든 스타일시트 — ⛔한 파일만 보면 다른 파일로 «옮겨간» 두 벌을 놓친다. */
function cssFiles() {
  const dir = path.join(ROOT, 'css');
  return fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => path.join('css', f));
}

/** 줄머리가 그 선택자인 «선언 블록 머리»만 센다. 주석은 공용 부품으로 걷는다. */
function countRuleHeads(selector) {
  const re = new RegExp('^\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{');
  const hits = [];
  for (const rel of cssFiles()) {
    const strip = makeStripper();
    fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').forEach((line, i) => {
      if (re.test(strip(line))) hits.push(`${rel}:${i + 1}`);
    });
  }
  return hits;
}

test('R1 ★`.prop-select` 기본 선언은 «한 곳»이다', () => {
  const hits = countRuleHeads('.prop-select');
  assert.equal(hits.length, 1,
    `★★두 벌이면 «나중»이 이기고 앞엣것은 죽는다 — 그리고 계측기가 «첫» 블록을 떠서 눈먼다. 지금: ${hits.join(' · ') || '0곳'}`);
});

test('R2 ★그 한 곳이 화살표 셋을 다 든다 — 하나라도 빠지면 맥 기본 화살표가 섞인다', () => {
  const [where] = countRuleHeads('.prop-select');
  assert.ok(where, '★선언이 0곳이다 — 이 검사는 «안 재고» 있다');
  const [rel, lineNo] = where.split(':');
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  /* 그 블록만 떠낸다 — 여는 줄부터 닫는 `}` 까지. */
  let body = '';
  for (let i = Number(lineNo) - 1; i < lines.length; i++) {
    body += lines[i] + '\n';
    if (/^\s*\}/.test(lines[i])) break;
  }
  assert.match(body, /appearance:\s*none/, '★appearance:none 이 없다 — OS 기본 화살표가 뜬다');
  assert.match(body, /var\(--ui-select-caret\)/, '★우리 화살표 토큰을 안 쓴다');
  assert.match(body, /padding-right:\s*24px/, '★글자가 화살표에 겹친다(자리를 안 비웠다)');
});

test('R3 ★`:hover`/`:focus` 도 각각 한 곳이다 — 함께 두 벌이었다', () => {
  for (const sel of ['.prop-select:hover', '.prop-select:focus']) {
    const hits = countRuleHeads(sel);
    assert.equal(hits.length, 1, `★${sel} 이 ${hits.length} 곳이다: ${hits.join(' · ')}`);
  }
});

test('R4 ⛔화살표를 «리터럴 SVG» 로 다시 박지 않는다 — 토큰 한 곳에서 온다', () => {
  /* ★그 토큰이 사는 곳(editor-base.css)은 «정의»라 당연히 SVG 를 들고 있다 — 그 파일만 뺀다. */
  for (const rel of cssFiles()) {
    if (rel.endsWith('editor-base.css')) continue;
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const strip = makeStripper();
    const code = src.split('\n').map(l => strip(l)).join('\n');
    assert.equal(/background-image:\s*url\("data:image\/svg\+xml[^"]*polyline|background-image:\s*url\("data:image\/svg\+xml[^"]*M1 1l4 4/.test(code), false,
      `${rel}: ★화살표 SVG 를 리터럴로 박았다 — 토큰(--ui-select-caret)과 두 벌이 되어 따로 늙는다`);
  }
});

test('N1 ★음성대조 — 블록을 한 벌 더 붙이면 R1 이 빨개진다', () => {
  /* ⛔파일을 «고치지 않는다» — 문자열에만 붙여 세는 자를 시험한다(계측기 검사). */
  const rel = 'css/editor-props.css';
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doubled = src + '\n.prop-select {\n  color: red;\n}\n';
  const re = /^\s*\.prop-select\s*\{/;
  const strip = makeStripper();
  const n = doubled.split('\n').filter(l => re.test(strip(l))).length;
  assert.equal(n, 2, '★한 벌 더 붙였는데 2 가 아니다 — 세는 자가 고장났다(이 음성대조는 «안 재고» 있다)');
});
