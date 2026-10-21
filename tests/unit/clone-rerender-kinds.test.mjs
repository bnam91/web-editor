/* clone-rerender-kinds.test.mjs — CLONE-RERENDER-01: «다시 그릴 종류»는 한 벌(js/io/save-load.js RERENDER_KINDS)이고
 *   소비자 넷(rebindAll · _bindVariantClone · _bindInsertedTree · _bindPastedEl)은 그 한 벌만 부른다.
 *
 * 왜(실측 · reports/S5-CLONE-RERENDER-01.md): 네 자리가 손 명부를 따로 들고 있어 A/B 사본 · 템플릿 넣기 · 붙여넣기에서
 *   radial 칸 누르기 · zoom 끌기 · modal 아이콘 · chat/canvas/banner02/step 편집이 죽었다(핀 002d9725 · 명부 18 × 3 회 같음).
 *
 * 자 둘(이 축 규율):
 *   ⑴ 이름 주는 자 — 아래 WANT 는 «독립 증인»이다. ⛔RERENDER_KINDS 에서 파생하지 마라(파생하면 기대값을 못 잠근다).
 *      옛 rebindAll 세 구간(sticker · gradient · 17 종 · step)에서 손으로 옮겨 적은 이름 20 + 부르는 창 이름.
 *   ⑵ 패턴으로 뽑는 자 — window.(render…|ln…|apply…) 호출을 정규식으로 뽑는다. 접두 ln · apply 와 숫자(02)를 먼저 생각했고,
 *      아는 이름 셋(lnRenderBubble · applyBridgeFullBleed · renderBanner02)이 걸리는지 양성대조한다.
 * 소비자 몸에 다시 그리는 줄이 «따로» 있으면 두 번 그려진다(발주 ⒝) — 두 자 모두로 0 을 잰다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const { sliceBlock, sliceCall } = require('./_slice-block.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const SL = stripComments(readSrc(ROOT, 'js', 'io', 'save-load.js'));
const SL_RAW = readSrc(ROOT, 'js', 'io', 'save-load.js');
const SV = stripComments(readSrc(ROOT, 'js', 'section-variation.js'));
const TS = stripComments(readSrc(ROOT, 'js', 'panels', 'template-system.js'));
const ED = stripComments(readSrc(ROOT, 'js', 'editor.js'));

// ⑴ 독립 증인 — 종류 클래스 → 그 종류가 부르는 창 이름(들)
const WANT = [
  ['sticker-block', ['renderStickerBlock']],
  ['gradient-block', ['renderGradientBlock']],
  ['laurel-block', ['renderLaurelBlock']],
  ['coupon-block', ['renderCouponBlock']],
  ['quote-block', ['renderQuoteBlock']],
  ['radial-block', ['renderRadialBlock']],
  ['graph-block', ['renderGraph']],
  ['zoom-block', ['renderZoomBlock']],
  ['bridge-block', ['renderBridgeBlock', 'applyBridgeFullBleed']],
  ['grid-block', ['renderGridBlock']],
  ['infocard-block', ['renderInfoCardBlock']],
  ['innercard-block', ['renderInnerCardBlock']],
  ['modal-block', ['renderModalBlock']],
  ['chat-block', ['renderChatBlock']],
  ['speech-bubble-block', ['lnRenderBubble']],
  ['banner02-block', ['renderBanner02']],
  ['comparison-block', ['renderComparison']],
  ['canvas-block', ['renderCanvas']],
  ['qa-block', ['renderQABlock']],
  ['step-block', ['renderStepBlock']],
];
const WANT_FNS = WANT.flatMap(([, f]) => f);

/* 구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(지디 261022 · 끝은 균형괄호로 찾는다).
   sliceBlock: 함수 몸(매개변수 괄호 안 기본값 {} 는 몸으로 안 읽는다) · sliceCall: 배열 리터럴 [ … ] 통째. */
const kindsArray = () => sliceCall(SL, 'const RERENDER_KINDS = [', 'CLONE-RERENDER-01 한 벌');
// ⑵ 패턴 자 — window.<이름>( 또는 window.<이름>?.( 꼴의 render… / ln… / apply… 호출
const CALL_RE = /window\.((?:render|ln|apply)[A-Za-z0-9_]*)\s*(?:\?\.)?\s*\(/g;
const callsIn = (txt) => [...txt.matchAll(CALL_RE)].map(m => m[1]);

test('⒜ 한 벌의 종류 = 증인 20 (이름 · 순서 무관 · 빠짐 0 · 군더더기 0)', () => {
  const arr = kindsArray();
  const got = [...arr.matchAll(/\[\s*'([a-z0-9-]+-block)'\s*,/g)].map(m => m[1]);
  assert.deepStrictEqual([...got].sort(), WANT.map(([c]) => c).sort());
  assert.strictEqual(new Set(got).size, got.length, '같은 종류 두 번 0');
});

test('⒜ 종류마다 부르는 창 이름 = 증인 (bridge 는 둘 · 이름 주는 자)', () => {
  const arr = kindsArray();
  for (const [cls, fns] of WANT) {
    const line = arr.split('\n').find(l => l.includes(`'${cls}'`));
    assert.ok(line, `${cls} 줄이 있다`);
    assert.deepStrictEqual(callsIn(line).sort(), [...fns].sort(), `${cls} 가 부르는 창 = ${fns.join('+')}`);
  }
});

test('⒜ 조건 둘이 옮겨졌다 — graph 는 방사형일 때만 · 말풍선은 dataset.lines 있을 때만', () => {
  const lines = kindsArray().split('\n');
  assert.match(lines.find(l => l.includes("'graph-block'")), /chartType\s*===\s*'radial'/);
  assert.match(lines.find(l => l.includes("'speech-bubble-block'")), /dataset\.lines\s*!==\s*undefined/);
});

test('⑵ 패턴 자 양성대조 — 아는 이름 셋이 한 벌에서 뽑힌다 · 뽑힌 집합 = 증인 창 이름', () => {
  const got = callsIn(kindsArray());
  for (const known of ['lnRenderBubble', 'applyBridgeFullBleed', 'renderBanner02']) assert.ok(got.includes(known), `패턴이 ${known} 를 잡는다`);
  assert.deepStrictEqual([...new Set(got)].sort(), [...new Set(WANT_FNS)].sort());
});

const CONSUMERS = [
  ['rebindAll', () => sliceBlock(SL, 'function rebindAll(')],
  ['_bindVariantClone', () => sliceBlock(SV, 'function _bindVariantClone(')],
  ['_bindInsertedTree', () => sliceBlock(TS, 'function _bindInsertedTree(')],
  ['_bindPastedEl', () => sliceBlock(ED, 'function _bindPastedEl(')],
];

for (const [name, get] of CONSUMERS) {
  test(`⒝ 소비자 ${name} — 다시 그리는 창을 «따로» 안 부른다(이름 자 · 패턴 자 둘 다 0) · 한 벌을 부른다`, () => {
    const body = get();
    const byName = WANT_FNS.filter(f => new RegExp(`window\\.${f}\\s*(?:\\?\\.)?\\s*\\(`).test(body));
    assert.deepStrictEqual(byName, [], `이름 자: ${name} 안 따로 부름 0`);
    const byPat = callsIn(body).filter(f => WANT_FNS.includes(f));
    assert.deepStrictEqual(byPat, [], `패턴 자: ${name} 안 따로 부름 0`);
    if (name === 'rebindAll') assert.ok(/\brerenderBlock\(/.test(body), 'rebindAll 은 rerenderBlock 을 부른다');
    else assert.ok(/window\.rerenderTree\(/.test(body), `${name} 는 window.rerenderTree 를 부른다`);
  });
}

for (const [name, get] of CONSUMERS.slice(1)) {
  test(`⒠ 소비자 ${name} — 창이 없으면 ?. 로 건너뛰지 않고 던진다`, () => {
    const body = get();
    assert.ok(/typeof window\.rerenderTree !== 'function'\)\s*throw new Error/.test(body), '없으면 던진다');
    assert.ok(!/window\.rerenderTree\?\./.test(body), '?. 로 부르지 않는다');
  });
}

test('rebindAll 의 rerenderBlock 자리 = 셋(sticker 구간 · gradient 구간 · 블럭 구간) — step 따로 구간 0', () => {
  const body = sliceBlock(SL, 'function rebindAll(');
  assert.strictEqual((body.match(/\brerenderBlock\(/g) || []).length, 3);
  assert.ok(!/querySelectorAll\('\.step-block'\)/.test(body), 'step 만 따로 도는 구간 0');
});

test('창 노출 — window.rerenderTree · window.rerenderBlock · window.RERENDER_KIND_CLASSES', () => {
  for (const w of ['window.rerenderTree = rerenderTree', 'window.rerenderBlock = rerenderBlock', 'window.RERENDER_KIND_CLASSES =']) assert.ok(SL.includes(w), w);
});

test('⒡ 낡은 qa 주석(«재렌더가 … bindQABlockEvents 도 되살린다») 0 · 바른 주석(bindBlock 이 건다) 있다', () => {
  assert.ok(!SL_RAW.includes('재렌더가 체크박스/피드백/접기 클릭 위임(bindQABlockEvents)도 되살린다'));
  assert.ok(/bindQABlockEvents\)은 재렌더가 «아니라» bindBlock 이 건다/.test(SL_RAW));
});
