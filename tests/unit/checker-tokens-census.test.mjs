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
const FAMILIES = ['big-a', 'big-b', 'big-size', 'small-a', 'small-b', 'small-size', 'clear-a', 'clear-b', 'svg-a', 'svg-b', 'secbg-a', 'secbg-b'];

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

/* ★C3 (S1 체커 어둡게) — 토글의 값은 «같은 정본 파일»의 «이름 붙은 톤 선택자 하나» 안에서만 다시 정의된다.
 *   허용: `:root{…}` 에 정확히 1번(기본값) + 톤 선택자에 0~1번.
 *   ⛔그 밖의 선택자(섹션·블록 등)가 토큰을 재정의하면 빨강.
 *
 * ★2026-10-06 — 범위가 «전역»에서 «섹션마다»로 바뀌었다(현빈 「일괄이 아니라 섹션마다」 · R1 확정:
 *   섹션 ★배경 체커만 · 「빈 카드는 그대로」). 그래서 두 가지가 같이 바뀌었다:
 *     ⑴ 톤 선택자  :root[data-goya-checker-tone] → .section-block[data-checker-tone="dark"]
 *     ⑵ 톤이 덮는 토큰  «색 다섯» → ★전용 쌍(secbg-a/b) ★둘뿐
 *   ★⑵ 가 이 검사의 ★가장 날카로운 이빨이다 — 톤 규칙이 공용 색 토큰(big·small·clear 쌍)을 덮으면 빨강.
 *     까닭: 톤 선택자는 이제 «섹션»이고 CSS 변수는 ★자식에게 상속된다 ⇒ 공용 토큰을 덮는 순간
 *     그 섹션 «안»의 빈 카드·에셋·표칸까지 같이 어두워진다. 그건 R1 이 아니다.
 *     (DOM 쪽 짝 = tests/dom/checker-section-tone.dom.spec.js S3.)
 *   ⛔옛 전역 선택자(:root[data-goya-checker-tone])로 되돌리면 C4b 가 빨강이다. */
export const TONE_SEL = '.section-block[data-checker-tone="dark"]';
export const TONE_FAMILIES = ['secbg-a', 'secbg-b'];
/** 정본 CSS 를 규칙 단위로 잘라 «선택자 → 그 안의 체커 토큰 정의 목록». 주석은 먼저 걷는다. */
export function tokenDefsBySelector(cssText) {
  const out = [];
  for (const m of stripCss(cssText).matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    const defs = [...m[2].matchAll(/--goya-checker-([a-z]+(?:-[a-z]+)*)\s*:\s*([^;]+)/g)].map(d => ({ name: d[1], value: d[2].trim() }));
    if (defs.length) out.push({ sel, defs });
  }
  return out;
}
export function checkTokenDefs(cssText) {
  const errs = [];
  const blocks = tokenDefsBySelector(cssText);
  for (const b of blocks) {
    if (b.sel === ':root' || b.sel === TONE_SEL) continue;
    errs.push(`선택자 «${b.sel}» 가 토큰을 재정의한다: ${b.defs.map(d => d.name).join(',')}`);
  }
  const count = (sel, n) => blocks.filter(b => b.sel === sel).flatMap(b => b.defs).filter(d => d.name === n).length;
  for (const n of FAMILIES) {
    const base = count(':root', n);
    if (base !== 1) errs.push(`--goya-checker-${n} 기본 정의 ${base}회(1회여야)`);
    const tone = count(TONE_SEL, n);
    if (tone > 1) errs.push(`--goya-checker-${n} 톤 정의 ${tone}회`);
    if (tone && !TONE_FAMILIES.includes(n)) errs.push(`톤 규칙이 «색 다섯» 밖의 --goya-checker-${n} 을 덮는다`);
  }
  for (const b of blocks.filter(b => b.sel === TONE_SEL)) {
    for (const d of b.defs) if (!/^#[0-9a-f]{6}$/i.test(d.value)) errs.push(`톤 값 --goya-checker-${d.name}: ${d.value} 은 #rrggbb 가 아니다`);
  }
  return errs;
}

test('C3 정의 — 기본 1번(:root) + 톤 규칙 안 «전용 쌍»만 다시 정의, 그 밖의 선택자·다른 CSS 엔 정의가 없다', () => {
  const errs = checkTokenDefs(fs.readFileSync(path.join(ROOT, TOKEN_HOME), 'utf8'));
  assert.deepEqual(errs, []);
  for (const f of walk(path.join(ROOT, 'css'), ['.css'])) {
    if (path.relative(ROOT, f) === TOKEN_HOME) continue;
    assert.ok(!/--goya-checker-[a-z-]+\s*:/.test(stripCss(fs.readFileSync(f, 'utf8'))), `${path.relative(ROOT, f)} 가 토큰을 다시 «정의»한다`);
  }
});

test('C3+ 양성대조(합성) — 넓힌 C3 이 «못 보는» 게 아니라 «0건»을 말한다', () => {
  const real = fs.readFileSync(path.join(ROOT, TOKEN_HOME), 'utf8');
  const tone = tokenDefsBySelector(real).filter(b => b.sel === TONE_SEL);
  assert.equal(tone.length, 1, `톤 규칙 ${tone.length}개 — 토글이 칠할 값이 없다`);
  assert.deepEqual(tone[0].defs.map(d => d.name).sort(), [...TONE_FAMILIES].sort(), '톤 규칙은 «색 다섯»을 전부 덮는다');
  // ⑴ 톤 선택자가 «아닌» 섹션 규칙이 토큰을 재정의 — 잡는다
  assert.ok(checkTokenDefs(real + '\n.section-block{--goya-checker-big-a:#000000}').some(e => /section-block/.test(e)));
  // ⑵ 톤 규칙이 크기를 덮음 — 잡는다
  assert.ok(checkTokenDefs(real + `\n${TONE_SEL}{--goya-checker-big-size:10px}`).some(e => /big-size/.test(e)));
  /* ⑵-b ★R1 경계 — 톤 규칙이 «공용» 색 토큰을 덮으면 잡는다.
     상속 때문에 같은 섹션 안의 빈 카드까지 어두워지는, 이 설계에서 가장 쉬운 사고다. */
  for (const n of ['big-a', 'small-a', 'clear-a']) {
    assert.ok(checkTokenDefs(real + `\n${TONE_SEL}{--goya-checker-${n}:#000000}`).some(e => new RegExp(n).test(e)),
      `톤 규칙이 공용 --goya-checker-${n} 을 덮는 것을 ★못 잡는다(R1 이 깨진다)`);
  }
  // ⑶ 기본 정의가 둘 — 잡는다
  assert.ok(checkTokenDefs(real + '\n:root{--goya-checker-small-a:#000000}').some(e => /small-a 기본 정의 2/.test(e)));
  // ⑷ 주석 속 정의는 정의가 아니다 — 안 잡는다
  assert.deepEqual(checkTokenDefs(real + '\n/* .x{--goya-checker-big-a:#000} */'), []);
});

/* ★C4b — CSS 선택자와 «JS 가 거는 속성»이 같은 글자인가. 오타면 단추가 조용히 아무것도 안 한다.
 *   2026-10-06: 거는 자리가 js/checker-tokens.js 의 상수에서 ★js/props/prop-section.js 의
 *   `sec.dataset.checkerTone = 'dark'` 로 옮겼다(전역 토글을 걷어내면서). ⇒ 거기를 읽는다.
 *   ★dataset 의 camelCase 는 HTML 속성에서 kebab 이 된다 — 그 변환까지 재야 «같은 글자»를 잰 것이다. */
test('C4b 톤 속성 이름 — CSS 선택자와 JS 가 거는 dataset 이 «같은 글자»다(오타면 단추가 조용히 아무것도 안 한다)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'js', 'props', 'prop-section.js'), 'utf8');
  const m = js.match(/sec\.dataset\.([A-Za-z0-9]+)\s*=\s*'dark'/);
  assert.ok(m, "js/props/prop-section.js 에 sec.dataset.<이름> = 'dark' 가 없다 — 켜는 문이 사라졌다");
  const attr = 'data-' + m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  assert.equal(`.section-block[${attr}="dark"]`, TONE_SEL);
  assert.ok(stripCss(fs.readFileSync(path.join(ROOT, TOKEN_HOME), 'utf8')).includes(TONE_SEL), '정본 CSS 에 톤 선택자가 없다');
  // ⛔전역 토글이 되살아나면 빨강 — 명부를 둘로 두지 않는다(2026-10-06 지디).
  for (const rel of ['js/checker-tokens.js', 'js/props/prop-page.js']) {
    const src = stripJs(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    assert.ok(!/gdt\.checkerDark|data-goya-checker-tone/.test(src), `${rel} 에 전역 보기설정이 되살아났다`);
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
