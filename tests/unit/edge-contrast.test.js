/* edge-contrast — 링크 연결선 «캔버스 대비» 동적 산출. 2026-09-08 신설
 *
 * 발주(현빈) 「링크연결선이 캔버스 색때문에 잘안보여, 캔버스 색 고려해서 동적으로 계산해줄래?」
 *
 * ★이 검사가 겨누는 것 — 둘로 갈린다
 *   A0~A6  «계산기»가 맞나          (js/canvas-contrast.js 를 실제로 import 해서 돌린다)
 *   B1~B6  «배선»이 살아 있나        (소스 원문을 훑는다 — readSrc + makeStripper)
 *
 * ⛔이 검사가 «안» 보는 것 (정직하게 적는다)
 *   · 화면에 실제로 칠해지는 색 — tests/dom/edge-contrast.dom.spec.js 몫이다.
 *   · 실기(Electron)에서 «눈으로 보이나» — ⛔현빈 실사용 PC라 창을 안 띄웠다. «안 쟀다».
 *   · 그라데이션 stop «사이»의 보간색 — 설계상 안 본다(계획서 §4-2 한계).
 *   · 선이 «섹션 위»를 지나는 구간의 대비 — 캔버스 배경만 본다.
 *
 * ★「0건」을 적는 자리마다 «1 이상이 나오는 입력»(양성대조)을 같이 둔다.
 *   0 은 세 얼굴이다 — 「대상 부재」 / 「내가 못 잼」 / 「표본이 좁아서 난 0」.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { makeStripper } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '..', '..');

/* ── 계산기를 «진짜로» 싣는다 ────────────────────────────────────────────
   렌더러는 ESM .js 인데 package type=commonjs 라 Node 가 직접 import 못 한다.
   canvas-contrast.js 는 ./props/gradient-model.js 를 상대경로로 부르므로 «파일 하나만»
   복사하면 안 된다 → js/ 트리를 통째로 tmp 에 복사하고 type:module 을 얹는다
   (save-dirty-after-failure.test.mjs 관례). 프로세스당 한 번만 싣는다. */
let _mod = null;
async function M() {
  if (_mod) return _mod;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-edgec-'));
  fs.cpSync(path.join(ROOT, 'js'), path.join(tmp, 'js'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  _mod = await import(pathToFileURL(path.join(tmp, 'js', 'canvas-contrast.js')).href);
  return _mod;
}

/* ── ★검사 «자기» 산술 — 계산기에서 import 하지 않는다 ─────────────────
   같은 함수를 쓰면 계산기의 버그가 검사를 통과해 «세탁»된다. 여기는 WCAG 정의를 다시 쓴다. */
const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const LUM = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
const CR = (a, b) => { const x = LUM(a), y = LUM(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const OVER = (f, b, a) => f.map((c, i) => a * c + (1 - a) * b[i]);
const RGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** 기본 테마 값을 «명시로» 준다 — Node 에는 DOM 이 없어 라이브 변수를 못 읽는다.
    (라이브 읽기는 D2/실앱이 잰다. 여기서 «못 쟀다»를 초록으로 위장하지 않으려고 못박는다.) */
const ACCENT = '#7cb8ff';   // css/editor-base.css:61 의 :root 실값
const SHELL  = '#1a1a1a';   // css/editor-base.css:40 --ui-bg-app
const OPT = { accent: ACCENT, shell: SHELL };

// ══════════════════════════════════════════════════════════════════
// A. 계산기
// ══════════════════════════════════════════════════════════════════

/* ── A0 ★위생 — 합성식의 «인자 순서»를 못박는다 ───────────────────────
   계획 단계에서 두 사람이 서로 다른 답을 낸 «바로 그 자리»다. 뒤집히면 여기서 운다.

   ⚠️★A0 은 «단독으로는 짝이 없다» — 자기 자신과의 일관성만 본다.
     _L 이 상수를 뱉는 변이라면 L(합성)==L(전경) 이 «공허하게» 참이 되어 A0 은 초록이다.
     그 갈래를 실제로 받아 주는 것은 ★A1(골든 표)이다(실측: 그 변이에서 A1·A2·A3·A4·A6 다섯이 동시에 빨강).
     ⇒ ⛔A1 을 지우면 A0 이 혼자 남아 아무것도 안 지킨다. 지우려거든 A0 부터 다시 세워라. */
test('A0 ★위생 — α=1 이면 합성색 == 전경, α=0 이면 == 배경 (합성식 인자순서)', async () => {
  const { compositeOver, relativeLuminance } = await M();
  assert.strictEqual(typeof compositeOver, 'function', '★합성 함수를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const cands = ['#7cb8ff', '#ffffff', '#000000'].map(RGB);
  const bgs = ['#828282', '#00c3f0', '#d40000', '#ff00ff', '#1a1a1a'].map(RGB);
  let n = 0;
  for (const c of cands) for (const bg of bgs) {
    n++;
    assert.ok(Math.abs(relativeLuminance(compositeOver(c, bg, 1)) - relativeLuminance(c)) < 1e-12,
      `★α=1 인데 합성색이 전경이 아니다 — 인자가 뒤집혔다 (c=${c} bg=${bg})`);
    assert.ok(Math.abs(relativeLuminance(compositeOver(c, bg, 0)) - relativeLuminance(bg)) < 1e-12,
      `★α=0 인데 합성색이 배경이 아니다 — 인자가 뒤집혔다 (c=${c} bg=${bg})`);
  }
  assert.strictEqual(n, 15, '★표본이 비었다 — 위 단언은 잴 것이 없는 채 통과한다');
});

/* ── A1 ★골든 표 — «정확히 그 색» ────────────────────────────────────
   ⛔「≥3 인가」만 재는 게이트는 감마 없는 근사(M1)를 통과시킨다.
     그래서 하한이 아니라 «고른 색 자체»를 못박는다. ★#ff00ff 한 줄이 검사력을 짊어진다
     (근사는 «흰»을 고르는데 그 흰의 진짜 대비는 1.957). 지우지 마라. */
const GOLDEN = [
  ['#ffffff', '#000000'],
  ['#000000', '#7cb8ff'],   // 어두운 캔버스는 브랜드색을 «지킨다»
  ['#828282', '#000000'],   // ★기본 pageSettings.bg — 현빈이 본 화면
  ['#acacac', '#000000'],
  ['#6aa8f0', '#000000'],
  ['#e11d48', '#000000'],
  ['#d40000', '#000000'],   // ★24비트 전수 최악 배경
  ['#00b8a9', '#000000'],
  ['#ff00ff', '#000000'],   // ★M1 킬러
];
test('A1 ★골든 표 9종 — 배경마다 «정확히 그 색»을 고른다 (하한만 재면 감마 근사를 놓친다)', async () => {
  const { edgeColorFor } = await M();
  for (const [bg, want] of GOLDEN) {
    assert.strictEqual(edgeColorFor(bg, OPT), want,
      `★배경 ${bg} 에서 고른 색이 달라졌다 — 휘도 공식이나 후보 순서가 움직였다`);
  }
  assert.strictEqual(GOLDEN.length, 9, '★표가 줄었다 — 줄이려면 왜 줄였는지 적어라');
});

/* ── A2 하한 — α 회귀를 잡는다 ───────────────────────────────────────
   α=.55 로는 이 배경들에서 3:1 이 «불가능»하다(최선 2.435~2.937). */
test('A2 하한 — 최악 배경 4종에서 min(선,점) ≥ 3.0 (α=.55 로 되돌리면 도달 불가)', async () => {
  const { edgeColorFor, EDGE_ALPHA } = await M();
  assert.strictEqual(EDGE_ALPHA, 0.70, '★EDGE_ALPHA 가 .70 이 아니다 — 3:1 하한과 배타적인 값이다');
  for (const bg of ['#d40000', '#ca0000', '#828282', '#ff00ff']) {
    const pick = edgeColorFor(bg, OPT);
    assert.ok(pick, `★${bg} 에서 색을 못 골랐다`);
    const P = RGB(pick), B = RGB(bg);
    const line = CR(OVER(P, B, EDGE_ALPHA), B);   // 선 = α 얹힌 실효색
    const dot = CR(P, B);                          // 점 = α=1
    assert.ok(Math.min(line, dot) >= 3.0,
      `★배경 ${bg}: 선 ${line.toFixed(3)} · 점 ${dot.toFixed(3)} — 3:1 미달`);
  }
});

/* ── A3 ★그라데이션 = «최악 stop» ────────────────────────────────────
   ⚠️계획서 §6-1 의 A3 은 「grad(#000,#828282) 가 #828282 단색과 같은 답」이라 했으나
     실측은 그렇지 «않다»(grad → #ffffff, 단색 → #000000). 계획의 그 문장은 틀렸다.
     겨누려던 것(첫 stop만·양끝만·평균 을 잡는다)은 아래처럼 «갈라지는 값»으로 못박는다. */
test('A3 ★그라데이션은 «최악 stop» 으로 잰다 — 첫 stop만/양끝만/평균 전부와 답이 갈린다', async () => {
  const { edgeColorFor } = await M();
  const g1 = 'linear-gradient(90deg,#000000 0%,#828282 100%)';
  const truth = edgeColorFor(g1, OPT);
  assert.strictEqual(truth, '#ffffff', '★최악 stop 판정이 바뀌었다');
  // 세 오답이 «각각 다른 값»이라는 것까지 못박는다 — 어느 쪽으로 퇴행해도 빨개진다.
  assert.strictEqual(edgeColorFor('#000000', OPT), '#7cb8ff', '전제: 첫 stop 단독 답');
  assert.strictEqual(edgeColorFor('#828282', OPT), '#000000', '전제: 끝 stop 단독 답');
  assert.strictEqual(edgeColorFor('#414141', OPT), '#7cb8ff', '전제: 평균색 단독 답');
  assert.notStrictEqual(truth, '#7cb8ff', '★첫 stop(또는 평균)만 보고 있다');
  assert.notStrictEqual(truth, '#000000', '★끝 stop 만 보고 있다');

  // ★양끝만 보면 «한가운데 흰 구간»을 통째로 놓친다 — parseGradient 가 중간 stop 을 준다.
  const g2 = 'linear-gradient(90deg,#000000 0%,#ffffff 50%,#000000 100%)';
  assert.strictEqual(edgeColorFor(g2, OPT), '#ffffff', '★중간 stop 을 버렸다 — 양끝만 보면 accent 가 나온다');

  /* ★★X1 — stop 의 «알파»가 살아 있는 그라데이션 (2026-09-09 적대검수가 찾은 구멍)
     위의 g1·g2·g3 는 stop 이 «전부 불투명»이라 `_over(c, sh, 1) === c` 다.
     ⇒ shell 합성을 통째로 빼는 변이(`out.push(_over(c, sh, s.opacity))` → `out.push(c)`)를 넣어도
       계산이 «한 글자도» 안 달라져 A3 가 초록이었다. 검사가 «없던» 게 아니라 그 자리를 «안 밟았다».
     도달 경로는 특수 상태가 아니다 — color-picker.js:194/201 의 gradStartAlpha·gradEndAlpha
     (그라데이션 탭의 기본 컨트롤)를 100 아래로 내리면 된다.
     심각도: stop α=0.15 면 화면의 «진짜» 캔버스색은 rgb(60,60,60)(거의 검정)인데
     변이판은 불투명 흰색으로 착각해 «검은 선»을 고른다 → 선 1.698 · 점 1.904.
     ⚠️현빈이 「잘 안 보여」라 하신 그 화면이 1.41 이었다. 1.71 은 그 옆자리다. */
  assert.strictEqual(
    edgeColorFor('linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.2) 100%)', OPT),
    '#ffffff', '★stop 의 opacity 를 shell 위에 합성하지 않았다 — 흰 stop 을 «불투명»으로 읽고 있다');
  /* ★짝(양성대조) — ⛔지우지 마라. 이게 없으면 위의 '#ffffff' 가
     «알파를 합성해서» 나온 건지 «어차피 흰색이라» 나온 건지 구분이 안 된다. */
  assert.strictEqual(
    edgeColorFor('linear-gradient(90deg,#ffffff 0%,#ffffff 100%)', OPT), '#000000',
    '★같은 색을 «불투명»으로 쓰면 답이 달라야 한다 — 짝이 죽으면 위 단언이 공허해진다');

  // ★양성대조 — 모든 stop 이 3:1 을 «실제로» 넘는 그라데이션이 있다(하한이 도달 가능한 목표다).
  const g3 = 'linear-gradient(90deg,#ffffff 0%,#acacac 100%)';
  const p3 = RGB(edgeColorFor(g3, OPT));
  let checked = 0;
  for (const bg of ['#ffffff', '#acacac']) {
    const B = RGB(bg);
    assert.ok(Math.min(CR(OVER(p3, B, 0.70), B), CR(p3, B)) >= 3.0, `★${bg} stop 에서 3:1 미달`);
    checked++;
  }
  assert.strictEqual(checked, 2, '★양성대조가 한 번도 안 돌았다');
});

/* ── A4 알파 바탕 — 뒤에 비치는 것은 --ui-bg-app 이다 ────────────────── */
test('A4 배경 알파가 0 이면 shell(--ui-bg-app) 단색과 «같은 답» — 합성을 빠뜨리면 갈린다', async () => {
  const { edgeColorFor } = await M();
  assert.strictEqual(edgeColorFor('rgba(130,130,130,0)', OPT), edgeColorFor(SHELL, OPT),
    '★알파 0 인데 shell 위 합성을 안 했다 — 앞색을 그대로 배경으로 썼다');
  assert.strictEqual(edgeColorFor('rgba(130,130,130,0)', OPT), '#7cb8ff', '★shell(#1a1a1a) 위 답이 바뀌었다');
  // 알파 1 이면 «그 색 그대로» — 위 단언이 늘 참이 되는 위장을 막는다.
  assert.strictEqual(edgeColorFor('rgba(130,130,130,1)', OPT), edgeColorFor('#828282', OPT),
    '★알파 1 인데 단색과 답이 다르다');
  assert.notStrictEqual(edgeColorFor('rgba(130,130,130,0)', OPT), edgeColorFor('rgba(130,130,130,1)', OPT),
    '★알파 0 과 1 이 «같은 답» 이다 — 알파를 아예 안 읽고 있다');
});

/* ── A5 «못 쟀다» 는 null 이다 — 색으로 때우지 않는다 ────────────────── */
test('A5 못 재는 배경은 null (투명이 아니라 «못 쟀다») + ★양성대조로 non-null 이 나온다', async () => {
  const { edgeColorFor } = await M();
  const unreadable = ['url(x.png)', '', '   ', 'transparent', 'papayawhip', null, undefined, 42];
  for (const css of unreadable) {
    assert.strictEqual(edgeColorFor(css, OPT), null,
      `★${JSON.stringify(css)} 에서 null 이 아니다 — 못 잰 것을 색으로 때우면 CSS 폴백이 안 받는다`);
  }
  /* ★양성대조 — 「전부 null」이 «함수가 늘 null 을 뱉어서» 난 것이 아님을 보인다. */
  const positives = ['#828282', 'rgba(130,130,130,0.5)', '#fff', 'linear-gradient(90deg,#000000 0%,#ffffff 100%)'];
  let nonNull = 0;
  for (const css of positives) if (edgeColorFor(css, OPT)) nonNull++;
  assert.strictEqual(nonNull, positives.length,
    `★양성대조가 ${nonNull}/${positives.length} 다 — 이 방법으로는 「1 이상」이 안 나온다(측정법 오류)`);
});

/* ── A6 ★점 하한 — 「알파가 크면 점은 당연히 안전」은 정리가 «아니다» ── */
test('A6 ★임의 accent 512종 × 배경 512종에서 min(선,점) ≥ 3 — 선만 보는 판은 양성대조로 «실제로» 깨진다', async () => {
  const { edgeColorFor, EDGE_ALPHA } = await M();

  /* ★고정 입력 — 이 한 쌍이 «선은 통과, 점은 미달» 인 실측 반례다. 표본이 좁아도 여기서 운다. */
  {
    const acc = RGB('#ff00ee'), bg = RGB('#00ee00');
    const line = CR(OVER(acc, bg, EDGE_ALPHA), bg), dot = CR(acc, bg);
    assert.ok(line >= 3.0, `★전제가 깨졌다 — 반례의 «선»이 3 미만(${line.toFixed(3)})이면 이 검사는 아무것도 안 겨눈다`);
    assert.ok(dot < 3.0, `★전제가 깨졌다 — 반례의 «점»이 3 이상(${dot.toFixed(3)})`);
    assert.notStrictEqual(edgeColorFor('#00ee00', { accent: '#ff00ee', shell: SHELL }), '#ff00ee',
      '★선만 보고 accent 를 채택했다 — 점(α=1)이 2.040 으로 묻힌다');
  }

  const lv = [0, 36, 73, 109, 146, 182, 219, 255];
  const grid = [];
  for (const r of lv) for (const g of lv) for (const b of lv) grid.push([r, g, b]);
  assert.strictEqual(grid.length, 512, '★격자가 512 가 아니다');
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

  /* ★양성대조 — «선만» 보는 판정기를 같은 격자에 돌려 위반이 «실제로» 나오는지 먼저 본다.
     여기서 0 이 나오면 아래의 0 은 「대상 부재」가 아니라 「표본이 좁아서 난 0」이다. */
  const W = [255, 255, 255], K = [0, 0, 0];
  const pickLineOnly = (acc, bg) => {
    const s = (c) => CR(OVER(c, bg, EDGE_ALPHA), bg);
    if (s(acc) >= 3.0) return acc;
    return s(W) >= s(K) ? W : K;
  };
  let control = 0;
  for (const acc of grid) for (const bg of grid) {
    const p = pickLineOnly(acc, bg);
    if (CR(p, bg) < 3.0 - 1e-9) control++;
  }
  assert.ok(control > 0,
    `★양성대조 0 — 「선만 보는 판」이 이 격자에서 아무 위반도 못 낸다면 아래 0 은 아무 뜻이 없다`);

  /* 본문 — 진짜 계산기 */
  let bad = 0, worstLine = Infinity, worstDot = Infinity, ex = null;
  for (const acc of grid) for (const bg of grid) {
    const p = RGB(edgeColorFor(hex(bg), { accent: hex(acc), shell: SHELL }));
    const line = CR(OVER(p, bg, EDGE_ALPHA), bg), dot = CR(p, bg);
    if (line < worstLine) worstLine = line;
    if (dot < worstDot) { worstDot = dot; ex = { acc: hex(acc), bg: hex(bg), pick: hex(p), line, dot }; }
    if (Math.min(line, dot) < 3.0 - 1e-9) bad++;
  }
  assert.strictEqual(bad, 0,
    `★${bad} 쌍이 3:1 미달 (최악 예: ${JSON.stringify(ex)}) — 점(α=1) 항이 빠졌다`);
  assert.ok(worstDot >= 3.0 && worstLine >= 3.0,
    `★최악 선 ${worstLine.toFixed(3)} · 최악 점 ${worstDot.toFixed(3)}`);
});

// ══════════════════════════════════════════════════════════════════
// B. 배선 — 소스 원문을 훑는다 (readSrc + makeStripper, ⛔고정 창 금지)
// ══════════════════════════════════════════════════════════════════

/** js/ 아래 .js 를 전부 모은다(재귀). */
function jsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
/** 파일 하나를 «주석 걷고» 줄 단위로 돌려준다. ★파일마다 새 stripper (블록 상태를 든다). */
function codeLines(file) {
  const strip = makeStripper();
  return readSrc(file).split('\n').map(strip);
}
/** js/ 전체에서 정규식에 걸리는 줄을 센다. skip 에 해당하는 파일은 뺀다. */
function scanJs(re, skipBase) {
  const hits = [];
  for (const f of jsFiles(path.join(ROOT, 'js'))) {
    if (skipBase && path.basename(f) === skipBase) continue;
    codeLines(f).forEach((line, i) => { if (re.test(line)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`); });
  }
  return hits;
}

/* ── B1 ★깔때기 — 직접 writer 가 «0개»인가 (손으로 적은 목록이 아니라 allowlist) ── */
test('B1 ★깔때기 — 캔버스 배경 직접 대입이 canvas-contrast.js 밖에서 0건 (+ 양성대조 2종)', () => {
  /* ★양성대조 ① — 같은 스캐너가 «파일을 실제로 읽고 있다». 0 이 나오면 아래 0 은 「못 잼」이다. */
  const anyBg = scanJs(/\.style\.background\s*=/);
  assert.ok(anyBg.length > 0,
    '★양성대조 0 — 스캐너가 js/ 를 못 읽고 있다(「대상 부재」가 아니라 「측정 실패」)');

  /* ★양성대조 ② — 깔때기 호출이 «4건» 있다. 5번째 writer 가 생겨도 ①이 아니라 여기가 움직인다. */
  const funnel = scanJs(/applyCanvasBackground\s*\(/, 'canvas-contrast.js');
  assert.strictEqual(funnel.length, 4,
    `★깔때기 호출이 4건이 아니다 (${funnel.length}건: ${funnel.join(', ')})`);

  /* 본문 — 직접 대입 0건. 두 렌즈로 본다(식별자 형 · getElementById 형). */
  const direct = scanJs(/canvasWrap\s*\.\s*style\s*\.\s*background\s*=/, 'canvas-contrast.js');
  assert.deepStrictEqual(direct, [],
    `★캔버스 배경을 직접 칠하는 자리가 남았다 — 거기선 연결선 대비가 안 돈다: ${direct.join(', ')}`);
  const byId = scanJs(/canvas-wrap[\s\S]*\.style\.background\s*=/, 'canvas-contrast.js');
  assert.deepStrictEqual(byId, [],
    `★getElementById('canvas-wrap') 형 직접 대입이 남았다: ${byId.join(', ')}`);
});

/* ── B2 호출처 4곳이 «어디인지»까지 못박는다 ────────────────────────── */
test('B2 깔때기 호출처 — prop-page.js 2 · save-load.js 2 (한 자리라도 빠지면 그 경로만 색이 썩는다)', () => {
  const count = (rel, re) => codeLines(path.join(ROOT, rel)).filter((l) => re.test(l)).length;
  const call = /applyCanvasBackground\s*\(/;
  const imp = /import\s*\{[^}]*applyCanvasBackground[^}]*\}\s*from\s*'[^']*canvas-contrast\.js'/;
  for (const [rel, want] of [['js/props/prop-page.js', 2], ['js/io/save-load.js', 2]]) {
    assert.strictEqual(count(rel, call), want,
      `★${rel} 의 깔때기 호출이 ${want}건이 아니다`);   /* import 줄은 '(' 가 없어 안 걸린다 */
    assert.strictEqual(count(rel, imp), 1, `★${rel} 에 import 가 없다 — 번들이 조용히 깨진다`);
  }
  /* 테마 훅 — applyTheme 이 --ui-accent 와 --ui-bg-app 을 «둘 다» 바꾼다. 여기서 재산출 안 하면 색이 썩는다. */
  assert.strictEqual(count('js/theme-system.js', /window\.__updateEdgeContrast\s*\?\.\s*\(/), 1,
    '★theme-system.js 에 재산출 훅이 없다 — 테마를 바꾸면 옛 배경 기준 색으로 굳는다');
  assert.strictEqual(count('js/canvas-contrast.js', /window\.__updateEdgeContrast\s*=/), 1,
    '★canvas-contrast.js 가 window 에 훅을 안 노출한다 — 위 호출이 «조용히» 아무 일도 안 한다');
});

/* ── B3 선과 점이 «같은 변수»를 읽는다 ─────────────────────────────── */
test('B3 CSS — 선(stroke)과 점(fill)이 «같은» --spl-edge-color 를 읽는다 (+ 오늘 색 폴백 유지)', () => {
  const css = readSrc(path.join(ROOT, 'css', 'editor-extra.css'));
  const line = /\.spl-edges line\s*\{([^}]*)\}/.exec(css);
  const dot = /\.spl-edges \.spl-edge-dot\s*\{([^}]*)\}/.exec(css);
  assert.ok(line, '★.spl-edges line 규칙이 없다');
  assert.ok(dot, '★.spl-edge-dot 규칙이 없다');
  assert.match(line[1], /stroke:\s*var\(--spl-edge-color,\s*var\(--ui-accent, #4f6bed\)\)/,
    '★선이 --spl-edge-color 를 안 읽는다');
  assert.match(dot[1], /fill:\s*var\(--spl-edge-color,\s*var\(--ui-accent, #4f6bed\)\)/,
    '★점이 --spl-edge-color 를 안 읽는다 — 한쪽만 고치면 선과 점이 «다른 물건»이 된다');
  assert.doesNotMatch(dot[1], /opacity/,
    '★점에 opacity 가 붙었다 — 점은 α=1 유지가 §5 min(선,점) 의 전제다');
});

/* ── B4 opacity 가 «.70» 이다 (삭제 아님·값까지) ───────────────────── */
test('B4 CSS — .spl-edges line 의 opacity 가 .70 이다 (지운 것도 .55 로 되돌린 것도 아니다)', () => {
  const css = readSrc(path.join(ROOT, 'css', 'editor-extra.css'));
  const line = /\.spl-edges line\s*\{([^}]*)\}/.exec(css);
  assert.ok(line, '★.spl-edges line 규칙이 없다');
  const m = /opacity:\s*(0?\.\d+|1|0)\s*;/.exec(line[1]);
  assert.ok(m, '★opacity 선언이 사라졌다 — 지우는 것은 처방이 아니다(선이 배경을 완전히 가린다)');
  assert.strictEqual(parseFloat(m[1]), 0.70, `★opacity 가 ${m[1]} 다 — .55 로는 3:1 이 «불가능»하다(최악 2.435)`);
  assert.match(line[1], /stroke-dasharray:\s*5 5/, '★점선을 잃었다 — 이미 있던 것을 지우지 마라');
});

/* ── B5 전역 강조색을 «안» 오염시킨다 ──────────────────────────────── */
test('B5 canvas-contrast.js 는 --ui-accent 를 안 쓴다(0건) + ★양성대조 --spl-edge-color 1건', () => {
  const lines = codeLines(path.join(ROOT, 'js', 'canvas-contrast.js'));
  const setProp = (name) => lines.filter((l) => new RegExp(`setProperty\\(\\s*'${name}'`).test(l));

  /* ★양성대조 먼저 — 이 방법으로 «1 이상»이 나온다. */
  const ours = setProp('--spl-edge-color');
  assert.strictEqual(ours.length, 1,
    `★양성대조가 ${ours.length} 다 — setProperty 스캔 자체가 안 먹고 있다면 아래 0 은 뜻이 없다`);

  assert.strictEqual(setProp('--ui-accent').length, 0,
    '★앱 전역 강조색(--ui-accent)을 덮어쓰고 있다 — 링크선 하나 고치려다 앱 전체 색이 움직인다');
  assert.strictEqual(setProp('--ui-bg-app').length, 0, '★앱 배경 변수를 덮어쓰고 있다');
  /* 변수는 «칠하는 원소와 같은 원소»에 건다 — documentElement 에 걸면 캔버스가 둘이 되는 날 틀린다. */
  assert.strictEqual(lines.filter((l) => /documentElement\.style\.setProperty/.test(l)).length, 0,
    '★documentElement 에 변수를 걸고 있다 — 칠하는 원소(#canvas-wrap)와 스코프가 어긋난다');
});

/* ── B6 ★같은 값이 두 군데 산다 — 갈라지면 잡는다 (DEPLOY_SHA 형) ──── */
test('B6 ★α 가 CSS 와 JS 에서 «안 갈라진다» — .spl-edges line 의 opacity == EDGE_ALPHA', async () => {
  const { EDGE_ALPHA } = await M();
  const css = readSrc(path.join(ROOT, 'css', 'editor-extra.css'));
  const line = /\.spl-edges line\s*\{([^}]*)\}/.exec(css);
  assert.ok(line, '★.spl-edges line 규칙이 없다');
  const m = /opacity:\s*(0?\.\d+|1|0)\s*;/.exec(line[1]);
  assert.ok(m, '★CSS 에 opacity 선언이 없다 — 대조할 값이 없다');

  /* JS 쪽은 «원문 리터럴»도 같이 본다 — import 값만 보면 상수 이름이 바뀌었을 때 못 잡는다. */
  const jsSrc = codeLines(path.join(ROOT, 'js', 'canvas-contrast.js')).join('\n');
  const jm = /export const EDGE_ALPHA\s*=\s*([\d.]+)\s*;/.exec(jsSrc);
  assert.ok(jm, '★js/canvas-contrast.js 에 EDGE_ALPHA 선언이 없다');

  assert.strictEqual(parseFloat(m[1]), EDGE_ALPHA,
    `★CSS opacity(${m[1]}) 와 EDGE_ALPHA(${EDGE_ALPHA}) 가 갈렸다 — 한쪽만 갱신하면 계산이 «없는 알파»로 돈다`);
  assert.strictEqual(parseFloat(jm[1]), EDGE_ALPHA, '★JS 원문 리터럴과 실행값이 갈렸다');
});
