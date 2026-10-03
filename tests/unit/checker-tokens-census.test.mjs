/* checker-tokens-census — 투명 표시 «체커»의 색·크기가 다시 흩어지지 못하게 막는다 (S1 선행, 2026-10-04).
 * 정본 = css/editor-base.css :root 의 --goya-checker-*(네 자리: big · small · clear · svg). 읽는 쪽은 var() 또는
 * js/checker-tokens.js. 이 검사는 «체커 무늬 안에 hex 가 다시 적히는 것»을 센다.
 *
 * ★양성대조(검사가 «못 보는» 것이 아니라 «0건»을 말하는 것임을 증명한다):
 *   ⑴ 합성 소스 — 옛 꼴 문자열을 먹이면 반드시 잡는다(전부 «빠지는 쪽»도 하나: 변수 꼴은 안 잡는다).
 *   ⑵ GD1001_ROOT=<07d8178b 체크아웃> 으로 돌리면 이 검사가 «옛 판의 9곳 이상»을 찾아 빨강이 된다(=핀에서 빨강).
 *   ⑶ 「찾기는 했나」 — 훑은 파일 수·체커 서명(repeating-conic-gradient) 수가 0 이면 그것 자체로 실패(0건=초록 방지).
 * ⚠️예외명부(이름으로): 우측 패널 «스와치»(어두운 UI 크롬) — prop-simple-card.js(#888/#555) · prop-gradient.js(#666/#888).
 *   섹션 체커 «투명 표시»와 다른 가족이다. 새 예외는 여기에 이름으로 더하고 사유를 적어라. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
const { makeStripper } = _req('./_strip-comments.js');
const ROOT = process.env.GD1001_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKEN_HOME = path.join('css', 'editor-base.css');
const SWATCH_EXEMPT = new Set([path.join('js', 'props', 'prop-simple-card.js'), path.join('js', 'props', 'prop-gradient.js')]);
const FAMILIES = ['big-a', 'big-b', 'big-size', 'small-a', 'small-b', 'small-size', 'clear-a', 'clear-b', 'svg-a', 'svg-b'];

const walk = (dir, exts, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, exts, out); }
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
};
const stripJs = (src) => { const s = makeStripper(); return src.split('\n').map(l => s(l)).join('\n'); };
const stripCss = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '');

/** 체커 «서명» 개수와, 그 괄호 안에 hex/색이름이 «적힌» 자리. */
const CONIC = /repeating-conic-gradient\(([^)]*)\)/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PATTERN_HEX = /<pattern[\s\S]{0,900}?(?:fill|stroke)\s*=\s*"#[0-9a-fA-F]{3,8}"/;

export function scanSource(rel, code) {
  const hits = []; let signatures = 0;
  for (const m of code.matchAll(CONIC)) {
    signatures++;
    if (HEX.test(m[1]) || /\b(?:transparent)\b/.test(m[1])) hits.push({ rel, kind: 'conic', text: m[0].slice(0, 90) });
  }
  if (PATTERN_HEX.test(code)) hits.push({ rel, kind: 'svg-pattern', text: '<pattern … fill="#hex">' });
  return { hits, signatures };
}
export function scanRoot(root) {
  const files = [
    ...walk(path.join(root, 'css'), ['.css']).map(f => [f, stripCss]),
    ...walk(path.join(root, 'js'), ['.js', '.mjs']).map(f => [f, stripJs]),
    ...(fs.existsSync(path.join(root, 'index.html')) ? [[path.join(root, 'index.html'), (s) => s.replace(/<!--[\s\S]*?-->/g, '')]] : []),
  ];
  const all = []; let signatures = 0;
  for (const [f, strip] of files) {
    const rel = path.relative(root, f);
    if (SWATCH_EXEMPT.has(rel)) continue;
    const r = scanSource(rel, strip(fs.readFileSync(f, 'utf8')));
    all.push(...r.hits); signatures += r.signatures;
  }
  return { hits: all, signatures, files: files.length };
}

test('C0 양성대조(합성) — 옛 꼴은 잡고, 변수 꼴은 안 잡는다', () => {
  const old = [
    'a{background: repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px;}',
    'a{background-image: repeating-conic-gradient(#e0e0e0 0% 25%, transparent 0% 50%);}',
    "const X = 'repeating-conic-gradient(#e3e3e3 0% 25%, #efefef 0% 50%) 0 0 / 16px 16px';",
    '<pattern id="p"><rect fill="#d8d8d8"/></pattern>',
  ];
  for (const s of old) assert.ok(scanSource('x', s).hits.length >= 1, `못 잡았다: ${s}`);
  const ok = 'a{background: repeating-conic-gradient(var(--goya-checker-big-a) 0% 25%, var(--goya-checker-big-b) 0% 50%) 0 0 / var(--goya-checker-big-size) var(--goya-checker-big-size);}';
  assert.equal(scanSource('x', ok).hits.length, 0);
  assert.equal(scanSource('x', ok).signatures, 1);
});

test('C1 센 범위 — 훑은 파일·체커 서명이 0 이면 「0건」이 안 훑은 것일 수 있다', () => {
  const r = scanRoot(ROOT);
  assert.ok(r.files > 50, `훑은 파일 ${r.files}`);
  assert.ok(r.signatures >= 5, `체커 서명 ${r.signatures}개 — 너무 적다(훑기가 깨졌나)`);
});

test('C2 센서스 — 체커 무늬 안에 raw hex·transparent 가 «0건» (옛 판 07d8178b 에선 9곳 이상 → 빨강)', () => {
  const r = scanRoot(ROOT);
  assert.equal(r.hits.length, 0, `raw 체커 값 ${r.hits.length}곳:\n` + r.hits.map(h => `  ${h.rel} [${h.kind}] ${h.text}`).join('\n'));
});

test('C3 정의 — 토큰 열 개가 정본(editor-base.css)에 «한 번씩만» 있고, 다른 CSS 엔 정의가 없다', () => {
  const base = stripCss(fs.readFileSync(path.join(ROOT, TOKEN_HOME), 'utf8'));
  for (const n of FAMILIES) {
    const defs = [...base.matchAll(new RegExp(`--goya-checker-${n}\\s*:`, 'g'))].length;
    assert.equal(defs, 1, `--goya-checker-${n} 정의 ${defs}회`);
  }
  for (const f of walk(path.join(ROOT, 'css'), ['.css'])) {
    if (path.relative(ROOT, f) === TOKEN_HOME) continue;
    assert.ok(!/--goya-checker-[a-z-]+\s*:/.test(stripCss(fs.readFileSync(f, 'utf8'))), `${path.relative(ROOT, f)} 가 토큰을 다시 «정의»한다`);
  }
});

test('C4 사용 — CSS·JS 가 읽는 --goya-checker-* 는 전부 정의돼 있다(오타 변수 방지)', () => {
  const defined = new Set(FAMILIES.map(n => `--goya-checker-${n}`));
  const used = new Set();
  for (const f of [...walk(path.join(ROOT, 'css'), ['.css']), ...walk(path.join(ROOT, 'js'), ['.js'])]) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/--goya-checker-[a-z]+(?:-[a-z]+)*(?![-$\w{*])/g)) used.add(m[0]);   // 「…-big-*」 같은 주석 속 접두 표기·템플릿 조각은 변수가 아니다
  }
  for (const u of used) assert.ok(defined.has(u), `정의 없는 변수 ${u}`);
  assert.ok(used.size >= 8, `쓰는 변수 ${used.size}개 — 읽는 자리가 사라졌나`);
});
