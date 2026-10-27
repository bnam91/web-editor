/* 단위 하네스 — ★1020t1b ㉲ 「그라데이션의 섹션 밖 크롭을 ★`--sec-clip` 레일로」
 *
 * ★무엇을 고쳤나 — ★값·식은 ★한 글자도 안 바뀌었다(같은 inset). ★«무엇에 실어 보내나»만 바뀌었다:
 *     `gradFill.style.clipPath = inset(…)`  →  `gradFill.style.setProperty('--sec-clip', inset(…))`
 *   ＋ CSS 세 자리(적용 · `.selected` 해제 · 「섹션 밖 보이기」 해제)에 `.gradient-block > .grad-fill` 추가.
 *
 * ★★이 파일이 잠그는 것 — ★셋이다(⛔하나로 뭉치지 마라. 깨지는 까닭이 다르다)
 *   ㉠ ①⌘Z — ★이력 비교자(`js/history.js` `_sameEdit`)를 ★실물에서 떠서 돌린다.
 *      ★★고친 꼴(`--sec-clip`)은 ★벗겨져 ★true · ★옛 꼴(맨 clip-path)은 ★false
 *      ⇒ ★그 둘을 ★같이 재는 것이 ★★«옮긴 까닭»의 양성대조다(⛔true 만 보이면 항등식일 수 있다).
 *   ㉡ ②③ — CSS ★세 자리에 ★들어갔나. ★하나라도 빠지면 ★절반만 닫힌다.
 *   ㉢ 옛 저장본 — ★로드가 ★모든 그라데이션을 ★다시 그리므로 ★인라인 `clip-path` 가 ★cssText 대입에
 *      ★쓸려 나가고 ★변수가 심긴다. ★그 ★«순서»가 계약이다.
 *
 * ⛔⛔㉲ 고침이 ★★«안 닫은 것»이었던 «무효화» — ★1020 W2A 에서 닫았다:
 *   ㉲ 때는 섹션이 자라도 이 값이 ★다시 계산되지 않았다(부르는 자가 전부 «그라데이션 자신» 또는 «로드»).
 *   ★W2A 가 섹션 감시자(ResizeObserver · border-box)를 달았다 — 행위 자는 grad-sec-clip-watch.test.mjs.
 *   ★㉢4 가 «문서가 지금 상태를 말하나»를 지킨다(옛 「감시자 0건」 문장이 남으면 빨강).
 *
 * ⛔닻에 ★매개변수 목록을 적지 마라 · ⛔닻을 ★변수에 담지 마라
 *   (집행 = tests/unit/anchor-signature-ratchet.test.mjs R1/R4 · 둘 다 ★내가 실제로 밟았다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { readSrc } = require_('./_srcread.js');
const { stripComments } = require_('./_strip-comments.js');
const ROOT = path.join(__dirname, '..', '..');
const SRC = {
  grad: readSrc(ROOT, 'js', 'blocks', 'gradient-block.js'),
  hist: readSrc(ROOT, 'js', 'history.js'),
  css: readSrc(ROOT, 'css', 'editor-blocks.css'),
  load: readSrc(ROOT, 'js', 'io', 'save-load.js'),
};

/* ── ㉠ ①⌘Z — 실물 비교자를 떠서 돌린다 ───────────────────────────────────── */
const grab = (re, name) => {
  const m = SRC.hist.match(re);
  assert.ok(m, `★앵커 실패: ${name} — history.js 가 바뀌었으면 이 파일부터 고쳐라`);
  return m[0];
};
/* ★130㉡(2026-10-26) — _sameEdit 이 꼭대기 memo 를 보려고 historyStack·historyPos 를 읽는다. 이 하네스는 함수만 떠 돌리므로
   «빈 스택»을 넣어 준다 ⇒ memo 갈래는 안 타고(꼭대기 없음) 옛 비교 그대로 = 이 파일이 재는 «실물 비교자»의 뜻은 같다. */
const _sameEdit = new Function([
  'const historyStack = []; const historyPos = -1;',
  grab(/const _NON_EDIT_ATTR_RE = [^\n]+/, '_NON_EDIT_ATTR_RE'),
  grab(/const _CHROME_RE = [^\n]+/, '_CHROME_RE'),
  grab(/function _stripNonEdit\([^)]*\) \{[\s\S]*?\n\}/, '_stripNonEdit'),
  grab(/function _sameEdit\([^)]*\) \{[\s\S]*?\n\}/, '_sameEdit'),
].join('\n') + '\nreturn _sameEdit;')();

/** 섹션 하나 + 그라데이션. `varClip` = `--sec-clip` 값 · `rawClip` = 맨 clip-path 값(옛 꼴). */
function page({ varClip = '', rawClip = '', h = 300 } = {}) {
  return `<div class="section-block" id="s1" style="height:350px;">`
    + `<div class="gradient-block" id="g1" style="position:absolute;left:0px;top:0px;width:860px;height:${h}px;">`
    + `<div class="grad-fill" style="position:absolute;inset:0;background:linear-gradient(to bottom,#000,#0000);`
    + (varClip ? `--sec-clip:${varClip};` : '') + (rawClip ? `clip-path:${rawClip};` : '')
    + `"></div></div></div>`;
}

test('㉠0 ★전제 — 비교자가 살아 있다(진짜 편집은 ★다르다고 한다 · 같은 판은 ★같다고 한다)', () => {
  const a = page({ varClip: 'inset(0px 0px 50px 0px)' });
  assert.equal(_sameEdit(a, a), true, '같은 판을 다르다고 한다 — 비교자가 깨졌다');
  const b = page({ varClip: 'inset(0px 0px 50px 0px)', h: 301 });
  assert.equal(_sameEdit(a, b), false,
    '★블럭 높이 300→301 이라는 ★진짜 편집을 ★같다고 한다 — 이 비교자는 아무것도 안 잰다(아래 수가 전부 무의미)');
});

test('㉠1 ★★고친 꼴 — `--sec-clip` 만 다르면 ★안 쌓인다(⌘Z 먹통 한 칸이 안 생긴다)', () => {
  /* 섹션이 100 → 350 으로 자란 전/후의 파생값. 사용자가 편집한 것은 ★없다. */
  const before = page({ varClip: 'inset(0px 0px 300px 0px)' });
  const after = page({ varClip: 'inset(0px 0px 50px 0px)' });
  assert.equal(_sameEdit(before, after), true,
    '★`--sec-clip` 차이를 ★«편집»으로 읽는다 — history.js 의 _NON_EDIT_ATTR_RE 가 바뀌었나?');
});

test('㉠2 ★★양성대조 — ★옛 꼴(맨 clip-path)은 ★여전히 ★쌓인다 ⇒ 「옮긴 까닭」이 참이다', () => {
  /* ⛔이 단언을 지우지 마라 — 이것이 없으면 ㉠1 의 true 가 «항등식이라 늘 true」인지
     «우리가 레일로 옮겨서 true」인지 ★구분이 안 된다. */
  const before = page({ rawClip: 'inset(0px 0px 300px 0px)' });
  const after = page({ rawClip: 'inset(0px 0px 50px 0px)' });
  assert.equal(_sameEdit(before, after), false,
    '★맨 clip-path 차이도 벗겨진다 — 그럼 ㉠1 은 아무것도 증명하지 않는다(비교자가 너무 넓어졌다)');
});

test('㉠3 ⛔`js/history.js` 는 ★안 건드렸다 — `--sec-clip` 은 ★이미 벗겨지고 있었다', () => {
  const code = stripComments(SRC.hist);
  assert.match(code, /_NON_EDIT_ATTR_RE = \/ draggable="\(\?:true\|false\)"\|\\s\*--sec-clip:/,
    '★_NON_EDIT_ATTR_RE 가 바뀌었다 — 이 고침은 그 자를 ★건드리지 않는 것이 계약이었다');
  assert.equal(/clip-path/.test(code), false,
    '★history.js 가 맨 clip-path 를 벗기기 시작했다 — 그러면 도형 마스크(prop-shape)의 undo 한 칸도 같이 사라진다');
});

/* ── ㉡ ②③ — CSS 세 자리 ──────────────────────────────────────────────── */
/* ★주석을 ★먼저 걷는다.
   ⛔처음엔 «직전 닫는 중괄호 또는 ★주석 닫는 기호 뒤부터» 로 떠냈다 — 그랬더니 ★내가 선택자
     사이에 넣은 주석의 ★닫는 기호가 ★경계로 읽혀 ★형제 셋이 ★사라진 것처럼 보였다(★거짓 빨강 1회).
   ⇒ ★떠내기를 ★버리고, ★주석 걷은 글에서 ★«네 선택자가 ★붙어 있나»를 ★한 자로 본다.
   ⚠️그리고 ★이 주석 안에 ★주석 닫는 기호를 ★글자로 쓰지 마라 — ★이 파일을 ★일찍 닫는다
     (★그것도 ★내가 밟았다: 파일 전체가 ★파싱 오류로 ★0건 통과였다). */
const CSSCODE = stripComments(SRC.css).replace(/\s+/g, ' ');

test('㉡1 ★적용 — 네 식구가 ★한 묶음에 붙어 `clip-path: var(--sec-clip…)` 를 받는다', () => {
  assert.match(CSSCODE,
    /\.sticker-block, \.mockup-block, \.zoom-block > \.zoom-clip, \.gradient-block > \.grad-fill \{ clip-path: var\(--sec-clip, none\); \}/,
    '★적용 묶음이 「스티커·목업·zoom-clip·grad-fill」 넷이 아니다 — 그라데이션이 빠졌거나 남의 줄을 지웠다');
});

test('㉡2 ★③선택 중 해제 — `.gradient-block.selected > .grad-fill` 이 있다', () => {
  assert.match(CSSCODE, /\.zoom-block\.selected > \.zoom-clip, \.gradient-block\.selected > \.grad-fill \{ clip-path: none; \}/,
    '★선택 중 해제 묶음에 그라데이션이 없다 — 섹션 밖으로 나간 부분을 잡아 끌 수 없다(형제 셋은 푼다)');
});

test('㉡3 ★②섹션 밖 보이기 해제 — `[data-overflow-visible]` 묶음에 있다', () => {
  assert.match(CSSCODE,
    /\.section-block\[data-overflow-visible="true"\] \.zoom-block > \.zoom-clip, \.section-block\[data-overflow-visible="true"\] \.gradient-block > \.grad-fill \{ clip-path: none; \}/,
    '★「섹션 밖 보이기」 해제 묶음에 그라데이션이 없다 — 체크를 켜도 그라데이션만 잘린 채 남는다');
});

/* ── ㉢ 소스 계약 · 옛 저장본 ──────────────────────────────────────────── */
test('㉢1 ★쓰는 꼴이 ★변수 하나다 — 맨 `style.clipPath` 쓰기가 ★0건', () => {
  const code = stripComments(SRC.grad);
  assert.equal(/style\.clipPath\s*=/.test(code), false,
    '★gradient-block.js 가 아직 맨 clip-path 를 인라인으로 쓴다 — 그러면 ①②③ 이 다시 열린다');
  assert.match(code, /setProperty\('--sec-clip',/, '★`--sec-clip` 을 심지 않는다 — 아무것도 안 잘린다');
  assert.match(code, /removeProperty\('--sec-clip'\)/,
    '★섹션이 없을 때 변수를 ★안 지운다 — 옛 값이 남아 엉뚱하게 잘린다');
});

test('㉢2 ★★순서 계약 — `cssText` 대입이 ★변수 심기보다 ★앞이다', () => {
  /* cssText 는 인라인 스타일을 ★통째로 갈아치운다 ⇒ 뒤에 심어야 변수가 산다.
     순서를 바꾸면 ★조용히 사라진다(스티커가 sticker-block.js:140 에 같은 함정을 적어 뒀다). */
  const code = stripComments(SRC.grad);
  const iCss = code.indexOf('gradFill.style.cssText');
  const iVar = code.indexOf("setProperty('--sec-clip'");
  assert.notEqual(iCss, -1, 'gradFill 의 cssText 대입을 못 찾았다 — 패턴을 갱신하라');
  assert.notEqual(iVar, -1, '변수 심기를 못 찾았다');
  assert.ok(iCss < iVar, '★cssText 대입이 변수 심기 ★뒤에 있다 — 변수가 조용히 지워진다');
});

test('㉢3 ★★[옛 저장본 무회귀] 로드가 ★모든 그라데이션을 ★다시 그린다 ⇒ 옛 인라인이 ★갈린다', () => {
  /* 옛 저장본엔 `.grad-fill` 에 ★맨 `clip-path` 가 글자로 박혀 있다. 로드가 다시 그리면
     위 ㉢2 의 cssText 대입이 ★그 인라인을 쓸어내고 변수가 대신 심긴다 ⇒ 왕복이 닫힌다.
     ⛔이 단언이 깨지면 「옛 저장본은 ★옛 꼴 그대로 남는다」가 되어 ①②③ 이 그 문서에서만 열린다. */
  const code = stripComments(SRC.load);
  assert.match(code, /querySelectorAll\('\.gradient-block'\)\.forEach/,
    '★로드가 그라데이션 전수를 돌지 않는다');
  /* ★CLONE-RERENDER-01(261022) — 다시 그리기가 한 벌(RERENDER_KINDS)로 옮겨 갔다: 로드의 그라데이션 구간은 rerenderBlock(block) 을 부르고,
     그 한 벌의 gradient 줄이 window.renderGradientBlock 을 부른다 ⇒ 두 자리를 다 잰다(어느 하나가 빠져도 옛 인라인이 남는다). */
  assert.match(code, /querySelectorAll\('\.gradient-block'\)\.forEach\(block => \{[^}]*rerenderBlock\(block\)/,
    '★로드의 그라데이션 구간이 rerenderBlock 을 부르지 않는다 — 옛 인라인 clip-path 가 그대로 남는다');
  assert.match(code, /\['gradient-block',\s*\(b\) => \{ window\.renderGradientBlock\?\.\(b\); \}\]/,
    '★다시 그리기 한 벌에 gradient → renderGradientBlock 줄이 없다 — 옛 인라인 clip-path 가 그대로 남는다');
});

test('㉢4 ★무효화의 «지금 상태»가 ★문서와 코드에서 ★같은 말을 한다(1020 W2A 에 갱신)', () => {
  /* 내 명부: 「본문은 맞는데 ★앞자리가 넓다」. ㉲ 때는 「무효화는 안 닫았다 · 감시자 0건」을 박았다.
     ★1020 W2A 가 감시자를 달아 닫았다 ⇒ ★그 옛 문장이 남으면 ★문서가 거짓이 된다(다음 사람이 또 고치러 온다).
     ⇒ ⑴ 코드에 감시자가 «있고» ⑵ 주석이 「닫았다」를 말하고 ⑶ 옛 「감시자 0건 · 증상 남아 있다」가 ★없다.
     ⚠️남은 빈틈(그려지지 않는 창)은 주석에 적혀 있어야 한다 — 「다 고쳐졌다」로 넓어지지 않게.
     행위 자는 tests/unit/grad-sec-clip-watch.test.mjs(W0~W4 · G1·G2 · S1 · 변이 M1~M6 · N1). */
  const code = stripComments(SRC.grad);
  assert.match(code, /new ResizeObserver\(/, '★섹션 감시자(ResizeObserver)가 코드에 없다 — 무효화가 다시 열렸다');
  assert.match(code, /_watchGradSec\(s\);/, '★등록점(_gradSecOnAdded)이 감시자에 올리지 않는다');
  /* ★D2(평가) — 「닫았다」는 ★잰 문 수와 함께만 말한다. ⛔범위 없는 「닫았다」는 실제보다 넓게 읽힌다. */
  assert.match(SRC.grad, /«무효화»를 ★잰 문 \d+곳에서 닫았다/, '★주석이 「무효화를 잰 문 N곳에서 닫았다」를 말하지 않는다(범위 없는 「닫았다」 금지)');
  assert.doesNotMatch(SRC.grad, /«무효화»를 ★닫았다/, '★범위 없는 「«무효화»를 ★닫았다」가 남았다(D2)');
  assert.doesNotMatch(SRC.grad, /섹션 높이 감시자 ★0건/,
    '★「섹션 높이 감시자 0건」이라는 옛 문장이 남았다 — 감시자가 있는데 문서가 없다고 한다');
  assert.doesNotMatch(SRC.grad, /그 증상은 ★남아 있다/,
    '★「현빈이 겪은 그 증상은 남아 있다」가 남았다 — 고친 뒤의 문서가 거짓이 된다');
  assert.match(SRC.grad, /안 그려지는 창/, '★남은 빈틈(그려지지 않는 창에선 감시자가 안 온다)이 주석에 없다');
  /* ★재작업(평가 D1) — render 를 안 부르는 넣기 길(⌘D·A/B·템플릿)까지 덮는 것은 ★#canvas 등록점이 있어야 참이다.
     그리고 ★잰 문·안 잰 문이 이름으로 주석에 적혀 있어야 한다. */
  assert.match(code, /new MutationObserver\(/, '★넣기 감시자(#canvas MutationObserver)가 없다 — ⌘D 사본·붙여넣기는 render 를 안 타서 감시에 안 오른다(D1)');
  assert.match(code, /subtree: true/, '★넣기 감시자가 subtree 를 안 본다 — 섹션 안에 붙여넣은 그라데이션을 못 본다');
  /* ★L1(2차 평가 · 1021) — 옛 꼴은 이름을 «파일 어디든» includes 로 봤다 ⇒ 목록에서 빼도 다른 주석에 같은 낱말이 있으면 초록.
     ⇒ ⑴ 이름은 ★그 목록 «블럭 안»에 있어야 하고 ⑵ 잰 문마다 ★그 문의 «코드 자리»(주석 걷은 코드)가 살아 있어야 한다. */
  assert.deepEqual(doorDocViolations(SRC.grad, DOOR_CODE), [], '★문 목록·코드 자리 검사가 빨강이다(아래 목록)');
});

/* ── ㉢4 의 문 검사 — 함수로 뽑아 «변이 칸»이 같은 자를 쓴다(⛔둘째 자 금지) ─────────────── */
const DOORS_MEASURED = [
  /* [주석 목록의 이름, 코드 자리 파일, 그 파일 «코드»(주석 걷음)에 있어야 하는 꼴] */
  ['메뉴 추가', 'grad', /sec\.appendChild\(block\);/],
  ['저장→재열기', 'load', /function applyProjectData\(/],
  ['페이지 전환', 'load', /async function switchPage\(/],
  ['⌘z 되돌리기', 'hist', /canvasEl\.innerHTML = snap\.canvas/],
  ['섹션 복제 ⌘D', 'editor', /function _insertPastedSection\(/],
  ['A/B 사본', 'variation', /function createVariation\(/],
  ['섹션 템플릿 넣기', 'template', /async function insertTemplate\(/],
  ['섹션 사이 끌어 옮기기', 'gradsel', /hoverSec\.appendChild\(block\)/],
];
const DOORS_UNMEASURED = ['블럭 붙여넣기', 'A/B 셋째 안', '블럭 템플릿 넣기', '탭(프로젝트) 전환', '브랜치 전환', '협업 원격 반영', 'MCP/AI 채우기', '스코프 되돌리기', '프레임·그룹 감싸기'];
const DOOR_CODE = {
  grad: SRC.grad, load: SRC.load, hist: SRC.hist,
  editor: readSrc(ROOT, 'js', 'editor.js'),
  variation: readSrc(ROOT, 'js', 'section-variation.js'),
  template: readSrc(ROOT, 'js', 'panels', 'template-system.js'),
  gradsel: readSrc(ROOT, 'js', 'gradient-select.js'),
};
/** 어긋남 목록(빈 배열 = 초록). grad = gradient-block.js 원문 · code = {파일키: 원문}. */
function doorDocViolations(grad, code) {
  const out = [];
  /* 목록 블럭 = 「★잰 문 N곳(」 머리 ~ 「(같은 섹션」 덧말(없으면 「⛔안 잰 문」) · 「⛔안 잰 문」 ~ 「⚠️남은 빈틈」.
     ⛔파일 전체를 보지 않는다 — 덧말·머리말에도 같은 낱말이 있다(:155 · :166 — 그래서 옛 꼴이 L1 이었다). */
  const mm = grad.match(/★잰 문 \d+곳\(/);
  const iM = mm ? mm.index : -1, iU = grad.indexOf('⛔안 잰 문'), iEnd = grad.indexOf('⚠️남은 빈틈');
  if (iM < 0 || iU < 0 || iEnd < 0 || !(iM < iU && iU < iEnd)) return ['목록 머리(★잰 문 N곳( · ⛔안 잰 문 · ⚠️남은 빈틈)의 차례가 깨졌다'];
  const iNote = grad.indexOf('(같은 섹션', iM);
  const measuredBlock = grad.slice(iM, (iNote > iM && iNote < iU) ? iNote : iU), unmeasuredBlock = grad.slice(iU, iEnd);
  const n = Number((measuredBlock.match(/^★잰 문 (\d+)곳\(/) || [])[1]);
  if (n !== DOORS_MEASURED.length) out.push(`잰 문 수 ${n} ≠ 명부 ${DOORS_MEASURED.length}`);
  if (!/^⛔안 잰 문\(\d+\.\d+\.\d+ 에 잰다\):/.test(unmeasuredBlock)) out.push('안 잰 문 머리에 «X.Y.Z 에 잰다» 가 없다(⛔「다음 판」 같은 상대 말 · ⛔「고친다」 금지)');
  for (const [name, file, re] of DOORS_MEASURED) {
    if (!measuredBlock.includes(name)) out.push(`잰 문 「${name}」이 «잰 문» 목록 블럭에 없다`);
    if (!re.test(stripComments(code[file] || ''))) out.push(`잰 문 「${name}」의 코드 자리(${file} ${re})가 코드에 없다`);
  }
  for (const name of DOORS_UNMEASURED) {
    if (!unmeasuredBlock.includes(name)) out.push(`안 잰 문 「${name}」이 «안 잰 문» 목록 블럭에 없다`);
  }
  return out;
}
/** 옛 꼴(1020 재작업판) — 이름을 파일 «어디든» 본다. ★L1 양성대조용으로만 남긴다(⛔게이트로 쓰지 마라). */
function oldDoorCheckPasses(grad) {
  return ['메뉴 추가', '저장→재열기', '페이지 전환', '⌘z 되돌리기', '섹션 복제 ⌘D', 'A/B 사본', '섹션 템플릿 넣기', '섹션 사이 끌어 옮기기']
    .every(d => grad.includes(d)) && /★잰 문 \d+곳\(/.test(grad);
}

test('㉢4-L1a ★변이: «잰 문» 블럭에서 「메뉴 추가 · 」만 빼면(낱말은 다른 주석에 남음) — 옛 꼴은 초록 · 새 꼴은 빨강', () => {
  const needle = '         메뉴 추가 · 저장→재열기';
  assert.ok(SRC.grad.includes(needle), '★변이 바늘을 못 찾았다 — 목록 줄이 바뀌었다');
  const m = SRC.grad.replace(needle, '         저장→재열기');
  assert.ok(m.includes('메뉴 추가'), '[전제] 「메뉴 추가」 낱말이 다른 주석에 남아 있어야 이 변이가 뜻이 있다');
  assert.equal(oldDoorCheckPasses(m), true, '[양성대조] 옛 꼴이 이 변이를 잡는다 — 그럼 L1 은 처음부터 없었다');
  const v = doorDocViolations(m, DOOR_CODE);
  assert.ok(v.some(x => x.includes('「메뉴 추가」이 «잰 문» 목록 블럭에 없다')), `★새 꼴이 이 변이를 못 잡는다 — 실측 ${JSON.stringify(v)}`);
});

test('㉢4-L1b ★변이: 이름은 주석에 두고 «코드 자리»(js/editor.js _insertPastedSection 정의)만 지우면 — 새 꼴은 빨강', () => {
  const code = { ...DOOR_CODE, editor: DOOR_CODE.editor.replace(/function _insertPastedSection\(/g, 'function _insertPastedSectionGONE(') };
  assert.notEqual(code.editor, DOOR_CODE.editor, '[전제] 변이가 editor.js 사본에 안 들어갔다');
  assert.equal(oldDoorCheckPasses(SRC.grad), true, '[양성대조] 옛 꼴은 주석만 보므로 이 변이에 초록이어야 한다');
  const v = doorDocViolations(SRC.grad, code);
  assert.ok(v.some(x => x.includes('「섹션 복제 ⌘D」의 코드 자리')), `★코드 자리를 지웠는데 새 꼴이 초록 — 실측 ${JSON.stringify(v)}`);
});

test('㉢4-L1c ★변이: «안 잰 문» 블럭에서 「프레임·그룹 감싸기」를 빼면 빨강 · 「0.9.9 에 잰다」 머리를 빼거나 「고친다」로 바꾸면 빨강', () => {
  const a = SRC.grad.replace(' · 프레임·그룹 감싸기.', '.');
  assert.notEqual(a, SRC.grad, '[전제] 바늘 「 · 프레임·그룹 감싸기.」를 못 찾았다');
  assert.ok(doorDocViolations(a, DOOR_CODE).some(x => x.includes('「프레임·그룹 감싸기」')), '★안 잰 문 이름을 뺐는데 초록');
  const b = SRC.grad.replace('⛔안 잰 문(0.9.9 에 잰다):', '⛔안 잰 문:');
  assert.notEqual(b, SRC.grad, '[전제] 바늘 「⛔안 잰 문(0.9.9 에 잰다):」를 못 찾았다');
  assert.ok(doorDocViolations(b, DOOR_CODE).some(x => x.includes('에 잰다')), '★「0.9.9 에 잰다」 머리를 뺐는데 초록');
  const c = SRC.grad.replace('⛔안 잰 문(0.9.9 에 잰다):', '⛔안 잰 문(0.9.9 에 고친다):');
  assert.ok(doorDocViolations(c, DOOR_CODE).some(x => x.includes('에 잰다')), '★「고친다」로 바꿨는데 초록 — 머리는 «잰다»만 받는다');
});
