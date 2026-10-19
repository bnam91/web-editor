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
 * ⛔⛔이번 고침이 ★★«안 닫은 것» — ★크게 적는다:
 *   ★★«무효화»다. ★섹션이 자라도 이 값은 ★다시 계산되지 않는다(이 함수를 부르는 자가 전부
 *   «그라데이션 자신» 또는 «로드» · ★섹션 높이 감시자 ★0건). ⇒ ★★현빈이 겪은 ★그 증상은 ★남아 있다.
 *   ⇒ ★감시자는 ★다음 칸(설계 ㉯＋㉮). ⛔「세 얼굴을 닫았다」로만 읽지 마라.
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
const _sameEdit = new Function([
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
  assert.match(code, /window\.renderGradientBlock\?\.\(block\)/,
    '★로드가 renderGradientBlock 을 부르지 않는다 — 옛 인라인 clip-path 가 그대로 남는다');
});

test('㉢4 ⛔★이번에 ★안 닫은 것이 ★문서에 ★적혀 있다(앞자리가 넓어지지 않게)', () => {
  /* 내 명부: 「본문은 맞는데 ★앞자리가 넓다」. ★무효화를 ★안 닫았다는 사실이 ★소스에 남아야
     다음 사람이 「이미 다 고쳐졌다」로 읽지 않는다. ⇒ 그 문장을 ★기계가 지킨다. */
  assert.match(SRC.grad, /무효화/,
    '★gradient-block.js 에 「무효화는 안 닫았다」가 적혀 있지 않다 — 다음 사람이 다 고쳐진 줄 안다');
  assert.match(SRC.grad, /감시자/,
    '★감시자가 없다는 사실이 적혀 있지 않다');
});
