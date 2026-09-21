/* U-HTOK — «블럭 모서리 사각 손잡이»의 크기·두께가 다시 갈라지면 빨강. [0921H-handleunify]
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스(css/*.css)만 읽는다. 라이브·앱 무접촉.
 *
 * ★현빈 2026-09-21: 「모서리 핸들의 크기가 다른 경우가 있는데 어떤건 두껍고 크기도 좀 다른거 같고」
 *   「에셋블럭에 들어가는 모서리 핸들정도가 좋은 거 같아」 ⇒ 기준 = 에셋 블럭 모서리 손잡이.
 *
 * ★고치기 «전» 실측(9516, 줌 40/100/150, 화면 px):
 *     에셋 계열 8종   테두리 1.5   ← 기준
 *     프레임·목업·iconify·배너·이미지편집   테두리 1.0   (−33%)
 *     그라데이션                             테두리 1.0
 *     스티커                                 테두리 0.4 / 1.0 / 1.5  ← 줌마다 달랐다
 *   뿌리 둘:
 *   ⑴ 토큰이 «둘»인데(`--ui-handle-border-w` 1px / `-round` 1.5px) 이름과 어긋나게 배정됐다.
 *      기준인 `.asset-overlay-handle` 은 border-radius:1px(=사각)인데 `-round` 를 썼다.
 *   ⑵ 같은 값을 규칙 아홉 곳에 «따로» 적어 뒀다. 2026-09-21 손잡이 탈출층이 들어갔을 때
 *      셋만 따라오고 넷이 남은 게 오늘의 증상이다.
 *
 * ★이 검사는 «이름 목록»을 안 박는다 — 목록은 자란다(`.asset-overlay-handle` 규칙에만 다섯이
 *   얹혀 있다). 대신 «모양»으로 고른다: width 7px(또는 calc(7px*--inv-zoom)) + border-radius:1px.
 *   새 손잡이가 그 모양으로 생기면 «자동으로» 이 검사의 사정권에 들어온다.
 *
 * ★음성대조(실제로 돌려 확인함, 2026-09-21):
 *   · `.sticker-corner-handle` 의 border 를 `1px solid …` 리터럴로 되돌림 ⇒ H2 빨강(종료코드 1).
 *   · `--ui-handle-border-w` 를 1.5px → 1px 로 되돌림 ⇒ 이 파일은 «초록»(같은 토큰을 쓰니까),
 *     실화면 검사 tests/dom/handle-size-parity.dom.spec.js 가 빨강. 둘이 «다른 것»을 잰다는 증거.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const CSS_DIR = path.join(ROOT, 'css');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ⛔tests/unit/_strip-comments.js 를 «안» 쓴다 — 그건 JS 용이라 따옴표 밖의 `//` 를 줄주석으로
   지운다. CSS 에는 줄주석이 없고 대신 `url(//cdn…)` 이 실재한다(이 레포 css 에 6줄).
   그걸로 걷으면 선언이 통째로 사라져 「0건 발견 = 통과」가 된다(그 함정이 이 레포에서 한 번
   검사를 눈멀게 했다 — _strip-comments.js 머리말 참조). CSS 는 블록 주석만 걷는다.
   ★줄 수를 보존하려고 주석을 «공백으로» 바꾼다 — 오류 메시지의 줄번호가 실제 줄이어야 한다. */
function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

/** css/*.css 전체에서 선택자에 `handle` 이 든 규칙을 긁는다(선언 4종만 본다). */
function collectHandleRules() {
  const out = [];
  for (const f of fs.readdirSync(CSS_DIR).filter(x => x.endsWith('.css')).sort()) {
    const src = stripCssComments(fs.readFileSync(path.join(CSS_DIR, f), 'utf8'));
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      const sel = m[1].trim().replace(/\s+/g, ' ');
      if (!/handle/i.test(sel)) continue;
      const body = m[2];
      const grab = p => {
        const r = new RegExp('(?:^|;)\\s*' + p + '\\s*:\\s*([^;]+)', 'i').exec(body);
        return r ? r[1].trim() : null;
      };
      out.push({
        file: f, line: src.slice(0, m.index).split('\n').length, sel,
        width: grab('width'), border: grab('border'),
        borderWidth: grab('border-width'), radius: grab('border-radius'),
      });
    }
  }
  return out;
}

const RULES = collectHandleRules();

/* «블럭 모서리 사각 손잡이» = 모양으로 고른다. 이름을 안 적는 것이 요점이다. */
const SIZE_RE  = /^(7px|calc\(\s*7px\s*\*\s*var\(--inv-zoom[^)]*\)\s*\))$/;
const isCornerSquare = r => !!r.width && SIZE_RE.test(r.width) && r.radius === '1px';
const CORNER = RULES.filter(isCornerSquare);

/* 통일 대상 «밖»이라고 손으로 적어 두는 자리 — 이유 없이 못 들어온다.
   ⚠️.img-edge-handle 은 현빈 확인 전까지 «임의로 바꾸지 마라»(2026-09-21 경계). */
const OUT_OF_SCOPE = [
  ['.img-edge-handle',  '이미지 가장자리 흰 동그라미 — 흰색 고정·원형(50%). 성격이 다른 부품이고 현빈 확인 대기.'],
  ['.hlb-handle',       'highlightB 선 «끝점» — 12px 원형. 모서리 손잡이가 아니다.'],
  ['.outpaint-handle',  'AI 스크래치 아웃페인트 — 12px 보라 원.'],
  ['.vtrim-handle',     '영상 트림 바 손잡이 — 12px.'],
  ['radius-handle',     '코너 반경 손잡이 — 원형(50%). 크기·두께는 이미 기준과 같고 모양은 건드리지 않는다.'],
  ['rotate-handle',     '회전 손잡이 — 20px, 테두리 없음.'],
];

test('H1 ★고르개가 «판별력»이 있다 — 사각 모서리 손잡이만 잡고 경계 부품은 안 잡는다', () => {
  assert.ok(RULES.length >= 15, `css 에서 손잡이 규칙을 ${RULES.length}건밖에 못 읽었다 — 파서가 눈멀었나?`);
  /* 양성대조: 기준(.asset-overlay-handle)이 반드시 «잡혀야» 한다. 안 잡히면 이 검사는 빈 검사다. */
  assert.ok(CORNER.some(r => r.sel.includes('.asset-overlay-handle')),
    '기준 `.asset-overlay-handle` 이 고르개에 안 걸린다 — 아래 단정이 전부 무의미해진다');
  assert.ok(CORNER.length >= 8,
    `사각 모서리 손잡이 규칙이 ${CORNER.length}건 — 너무 적다(고치기 전 9건이었다). 고르개가 늙었나?`);
  /* 음성대조: 경계 부품은 «안» 걸려야 한다 — 걸리면 토큰을 강요해 현빈 경계를 넘는다. */
  for (const [name, why] of OUT_OF_SCOPE) {
    const hit = CORNER.find(r => r.sel.includes(name));
    assert.ok(!hit, `${name} 이 통일 대상에 «잘못» 걸렸다(${why}) — ${hit && hit.file + ':' + hit.line}`);
  }
});

test('H2 ★테두리 두께는 «토큰 하나»에서 나온다 — 리터럴 px 는 한 건도 없다', () => {
  const tokens = new Set();
  const bad = [];
  for (const r of CORNER) {
    const decl = r.borderWidth || r.border;
    assert.ok(decl, `${r.file}:${r.line} ${r.sel} — border 선언이 없다`);
    const refs = [...decl.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(x => x[1]);
    const widthRefs = refs.filter(t => /border-w/.test(t));
    if (widthRefs.length !== 1) { bad.push(`${r.file}:${r.line} ${r.sel} → 두께 토큰 ${widthRefs.length}개 «${decl}»`); continue; }
    tokens.add(widthRefs[0]);
    /* var() «밖»의 생 px 가 남아 있으면 토큰을 무력화한다. var(--x, 1.5px) 의 폴백은 뒤에서 따로 본다. */
    const outside = decl.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '');
    if (/\d*\.?\d+px/.test(outside)) bad.push(`${r.file}:${r.line} ${r.sel} → var() 밖 리터럴 px «${decl}»`);
  }
  assert.deepEqual(bad, [], '테두리 두께가 토큰 하나에서 안 나온다:\n  ' + bad.join('\n  '));
  assert.equal(tokens.size, 1,
    `사각 모서리 손잡이가 두께 토큰을 ${tokens.size}종 쓴다(${[...tokens]}) — 2026-09-21 이전이 정확히 이 상태였다(1px 계열 vs 1.5px 계열)`);
});

test('H3 ★폴백이 토큰 «선언값»과 같다 — 늙은 폴백은 조용한 두 번째 출처다', () => {
  const base = read('css/editor-base.css');
  const decl = /--ui-handle-border-w\s*:\s*([^;]+);/.exec(stripCssComments(base));
  assert.ok(decl, 'css/editor-base.css 에서 --ui-handle-border-w 선언을 못 찾음');
  const val = decl[1].trim();
  assert.match(val, /^\d*\.?\d+px$/, `--ui-handle-border-w 가 길이값이 아니다: «${val}»`);
  const bad = [];
  for (const r of CORNER) {
    const d = r.borderWidth || r.border;
    const fb = /var\(\s*--ui-handle-border-w\s*,\s*([^)]+)\)/.exec(d);
    if (fb && fb[1].trim() !== val) bad.push(`${r.file}:${r.line} ${r.sel} → 폴백 «${fb[1].trim()}» ≠ 선언 «${val}»`);
  }
  assert.deepEqual(bad, [], '폴백이 토큰 선언값과 어긋난다:\n  ' + bad.join('\n  '));
  /* 하위호환 별칭 `-round` 는 «값을 따로 들면» 안 된다 — 들면 갈라질 수 있는 두 번째 출처가 된다. */
  const round = /--ui-handle-border-w-round\s*:\s*([^;]+);/.exec(stripCssComments(base));
  if (round) assert.match(round[1].trim(), /var\(\s*--ui-handle-border-w/,
    `--ui-handle-border-w-round 가 «${round[1].trim()}» 로 제 값을 들고 있다 — 별칭이 아니면 언젠가 갈라진다`);
});

test('H4 ★크기와 두께가 «같은 축»에 탄다 — --inv-zoom 을 한쪽만 곱하면 줌마다 갈라진다', () => {
  const bad = [];
  for (const r of CORNER) {
    const wInv = /--inv-zoom/.test(r.width);
    const bInv = /--inv-zoom/.test(r.borderWidth || r.border || '');
    if (wInv !== bInv) {
      bad.push(`${r.file}:${r.line} ${r.sel} → width ${wInv ? '는' : '는 안'} --inv-zoom 을 쓰는데 border 는 ${bInv ? '쓴다' : '안 쓴다'}`);
    }
  }
  assert.deepEqual(bad, [], '캔버스 «안» 손잡이의 크기·두께 축이 갈렸다(고치기 전 스티커가 정확히 이 상태: 크기는 화면 7px 고정인데 테두리만 0.4→1.5px 로 요동):\n  ' + bad.join('\n  '));
});

test('H5 ★탈출층은 --inv-zoom 을 «되돌린다» — 안 되돌리면 고정층에서 거꾸로 부푼다', () => {
  /* 이 검사가 H4 의 짝이다. H4 가 「캔버스 안에서는 곱해라」를 강요하는데, --inv-zoom 은
     :root 에 걸려(js/editor.js: documentElement.setProperty('--inv-zoom', …)) #ss-handles-overlay
     까지 «상속된다». 그래서 탈출한 손잡이에서는 그 곱이 거꾸로 부푼다.
     실측(줌 40, border-width 줄을 뺀 채): 그라데이션 손잡이 테두리 1.5px → 3.75px. */
  const css = stripCssComments(read('css/editor-blocks.css'));
  const js  = read('js/overlay-handles.js');
  const specs = /const HANDLE_ESCAPE_SPECS\s*=\s*\[([\s\S]*?)\];/.exec(js);
  assert.ok(specs, 'js/overlay-handles.js 에서 HANDLE_ESCAPE_SPECS 를 못 찾음 — 리팩터링됐나?');
  const escaped = [...specs[1].matchAll(/handle:\s*'([^']+)'/g)].map(x => x[1]);
  assert.ok(escaped.length >= 1, '탈출 대상 손잡이 목록이 비었다');

  /* --inv-zoom 을 쓰는(=캔버스 안 축) 손잡이만 되돌림이 «필요»하다. */
  const needsUndo = escaped.filter(h => CORNER.some(r => r.sel.includes(h) && /--inv-zoom/.test(r.width)));
  assert.ok(needsUndo.length >= 1,
    `탈출 대상 중 --inv-zoom 축인 손잡이가 없다(${escaped}) — 이 검사가 무의미해졌다면 지워라`);

  const ovRules = RULES.filter(r => r.sel.includes('#ss-handles-overlay'));
  for (const h of needsUndo) {
    const rule = ovRules.find(r => r.sel.includes(h));
    assert.ok(rule, `${h} 가 탈출하는데 #ss-handles-overlay 오버라이드 규칙이 없다 — 고정층에서 줌만큼 부푼다`);
    assert.ok(rule.width && !/--inv-zoom/.test(rule.width),
      `${h} 탈출층 규칙의 width 가 --inv-zoom 을 되돌리지 않는다(«${rule.width}»)`);
    const bw = rule.borderWidth || rule.border;
    assert.ok(bw, `${h} 탈출층 규칙에 border-width 되돌림이 없다 — 줌 40 에서 테두리가 1.5px 대신 3.75px 이 된다`);
    assert.ok(!/--inv-zoom/.test(bw),
      `${h} 탈출층 규칙의 테두리가 아직 --inv-zoom 을 곱한다(«${bw}»)`);
    assert.match(bw, /var\(\s*--ui-handle-border-w/,
      `${h} 탈출층 테두리가 토큰이 아니라 «${bw}» 다 — 두 번째 출처가 생긴다`);
  }
  assert.ok(css.includes('#ss-handles-overlay'), '탈출층 규칙 자체가 사라졌다');
});
