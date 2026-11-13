/* panel-contrast.test.mjs — 우측 패널 절 제목·힌트·라벨 글자색이 패널 배경 위에서 WCAG AA(≥4.5:1)인가. (right-panel-unify U0 · A-6)
 *   실행: node --test tests/unit/panel-contrast.test.mjs
 *
 * ★글자색은 «실제 규칙»에서 읽는다(css/editor-props.css 의 선택자 → var() → css/editor-base.css :root 토큰 사슬을 끝까지 푼다).
 *   ⛔토큰 이름을 여기 박아 두고 재면, 규칙이 다른 토큰(또는 리터럴)으로 바뀌어도 이 검사는 초록이다.
 *   C1 (절 제목 · 절 제목 hover · 힌트 · 라벨) × (--ui-bg-base · --ui-bg-card) ≥ 4.5
 *   N1 ★양성대조 — .prop-hint 를 옛 #5a5a5a 로 되돌린 판이면 C1 의 판정이 빨강(2.4:1)
 *   N2 ★양성대조 — 사슬 풀이가 산다: 존재하지 않는 토큰을 가리키면 던진다(조용히 0 이나 검정으로 안 떨어진다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { stripComments } = _req('./_strip-comments.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = stripComments(readSrc(ROOT, 'css/editor-base.css'));
const PROPS = stripComments(readSrc(ROOT, 'css/editor-props.css'));

/** :root 토큰 표 — 첫 정의가 이긴다. */
function tokens(css) {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(root, '★editor-base.css 에서 :root 블록을 못 찾았다');
  const t = {};
  for (const m of root[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) if (!(m[1] in t)) t[m[1]] = m[2].trim();
  return t;
}
/** 값 → #rrggbb. var(--x[, fb]) 사슬을 끝까지 푼다. */
function resolve(v, T, depth = 0) {
  assert.ok(depth < 10, `★var() 사슬이 너무 깊다: ${v}`);
  v = v.trim();
  const m = /^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
  if (m) {
    if (m[1] in T) return resolve(T[m[1]], T, depth + 1);
    if (m[2]) return resolve(m[2], T, depth + 1);
    throw new Error(`★정의 없는 토큰: ${m[1]}`);
  }
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (!h) throw new Error(`★색으로 못 읽는다: ${v}`);
  return h[1].length === 3 ? '#' + [...h[1]].map((c) => c + c).join('') : '#' + h[1];
}
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** 선택자 규칙의 color 값(첫 규칙). */
function colorOf(css, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  const m = re.exec(css);
  assert.ok(m, `★규칙을 못 찾았다: ${selector}`);
  const c = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(m[1]);
  assert.ok(c, `★${selector} 에 color 가 없다`);
  return c[1].trim();
}

const FG = [
  ['절 제목', '.prop-sec-head > .prop-section-title'],
  ['절 제목 hover', '.prop-sec-head > .prop-section-title:hover'],
  ['힌트', '.prop-hint'],
  ['라벨', '.prop-label'],
];
const BG = ['--ui-bg-base', '--ui-bg-card'];

function judge(propsCss) {
  const T = tokens(BASE);
  const rows = [];
  for (const [name, sel] of FG) for (const bg of BG) {
    const r = ratio(resolve(colorOf(propsCss, sel), T), resolve(`var(${bg})`, T));
    rows.push({ name, bg, r: +r.toFixed(2), ok: r >= 4.5 });
  }
  return rows;
}

test('C1 절 제목·hover·힌트·라벨 × 패널 배경 2종 ≥ 4.5:1', () => {
  const rows = judge(PROPS);
  assert.equal(rows.length, 8);
  const bad = rows.filter((x) => !x.ok);
  assert.deepEqual(bad, [], '★AA 미달:\n' + rows.map((x) => `  ${x.ok ? '✓' : '✗'} ${x.name} / ${x.bg} = ${x.r}`).join('\n'));
});

test('N1 ★양성대조 — .prop-hint 를 옛 #5a5a5a 로 되돌리면 빨강', () => {
  const before = colorOf(PROPS, '.prop-hint');
  assert.notEqual(before, '#5a5a5a', '[전제] 지금은 토큰이다');
  const mutated = PROPS.replace(/(\.prop-hint\s*\{[^}]*?color\s*:\s*)[^;]+/, '$1#5a5a5a');
  assert.equal(colorOf(mutated, '.prop-hint'), '#5a5a5a', '[전제] 변이가 실제로 들어갔다');
  const hint = judge(mutated).filter((x) => x.name === '힌트');
  assert.ok(hint.every((x) => !x.ok), `★옛 힌트색인데 통과했다 — 이 자는 «안 재고» 있다: ${JSON.stringify(hint)}`);
});

test('N2 ★양성대조 — 정의 없는 토큰은 던진다(조용히 통과 금지)', () => {
  assert.throws(() => resolve('var(--ui-no-such-token)', tokens(BASE)), /정의 없는 토큰/);
  assert.equal(resolve('var(--ui-no-such-token, #fff)', tokens(BASE)), '#ffffff', '★fallback 을 못 쓴다');
});
