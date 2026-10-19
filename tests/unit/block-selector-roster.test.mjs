/* 1017t1a4 ⒈ — ★블럭 선택자 «명부»가 ★11곳에 흩어져 있다. ★그 어긋남을 ★표로 잠근다.
 *   (2026-10-18 지디 · 설계 정본 ~/.gd-work/team-lead/DESIGN-1017t1a4.md)
 *
 * ★왜 — 「오버레이된 블럭끼리 그룹설정이 안 된다」(📍10171a4)의 뿌리를 찾다가,
 *   ★같은 뜻의 선택자 목록이 ★11곳에 ★사본으로 있고 ★블럭 33종 중 ★20종이
 *   ★어딘가에서 ★빠져 있는 것을 쟀다. ★frame-block·sticker-block 은 ★11곳 중 ★2곳에만 있다.
 *
 * ★★그런데 ★경고 주석은 ★이미 있었다 — js/editor.js:1443 에 앞사람이 적어 뒀다:
 *     「⚠️이 목록은 MULTI_SEL·_ALL_BLOCK_SEL 과 «세 번째 사본»이다」
 *   ★그 주석이 ★있는 채로 ★사본이 ★11개까지 늘었다.
 *   ⇒ ★★「명부가 둘이면 ★경고 주석으로 ★못 막는다 — ★재는 자를 둬라」. ⛔주석을 ★더하지 않는다.
 *
 * ★★이 검사가 ★하지 않는 일(⛔「전부 잡는다」로 읽지 마라):
 *   ⒜ ★합치지 ★않는다 — ★종수가 16·17 인 명부 셋은 ★★«일부만»을 ★뜻한다(여러고르기 되는 블럭 ·
 *      자식으로 들어갈 수 있는 블럭). ★합치면 ★「프레임 안에 프레임」이 ★열린다.
 *      ⇒ ★합치는 일(⒉ 파생)은 ★핵심 파일 셋을 건드려 ★DOM 전수가 필요하다 ⇒ ★따로.
 *   ⒝ ★★새 블럭이 ★★«11곳 ★어디에도» 안 들어가면 ★★못 잡는다 — ★합집합에도 없기 때문이다.
 *      ⇒ ★그래서 ★ALL_SEEN 을 ★★손으로 박는다(⛔코드에서 ★합집합으로 ★구하지 않는다 —
 *        그러면 ★「명부가 저를 잰다」가 되어 ★★항등식이 된다).
 *      ⇒ ★블럭을 ★새로 만들면 ★ALL_SEEN 에 ★손으로 ★더해라. ★A1 이 ★그때 ★알려 준다.
 *   ⒞ ★「그룹설정이 안 된다」를 ★고치지 ★않는다 — ★이 검사는 ★현 상태를 ★잠글 뿐이다.
 *
 * ★★261020 ★갱신 — ★방사형 블럭 이식(`b8055ada` · 1018t1B-2)으로 ★ALL_SEEN 이 ★33 → ★34종.
 *   ★A1 이 ★설계대로 ★빨강을 내 ★알려 줬고(「★명부에만: radial-block」), ★A2 가 ★빠진 ★네 자리를 ★짚었다:
 *     editor.js BLOCK_MULTI_SEL · editor.js BLOCK_SEL#2 · block-drag.js CHILD_BLOCK_SEL · block-drag.js BLOCK_SEL
 *   ⇒ ★그 넷은 ★★«일부만»을 뜻하는 명부다(여러고르기 · 자식 가능) — ★원본 분기도 ★안 넣었다(양쪽 9자리로 확인).
 *   ⇒ ★그래서 ★«넣는» 것이 아니라 ★KNOWN_GAPS 에 ★★«지금 이러하다»로 ★적었다.
 *   ⚠️★★방사형을 ★여러고르기·자식 배치에 ★넣을지는 ★★현빈 뜻이다 — ★정해지면 ★그때 ★네 자리에 넣고 ★이 표에서 뺀다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = ['js/block-factory.js', 'js/editor.js', 'js/block-drag.js'];

/* ★명부를 ★★«꼴»로 찾는다 — ⛔«이름»으로 찾지 않는다.
   ★까닭: 261018 에 내가 `BLOCK_SEL` 이라는 ★이름으로 찾아 ★11곳 중 ★2곳만 보았다.
   ★`CANVAS_SEL_BLOCKS`·`MULTI_SEL`·`_ALL_BLOCK_SEL`·`_ALL`·`CHILD_BLOCK_SEL`·`BLOCK_MULTI_SEL`
   ★전부 ★같은 꼴인데 ★이름이 달라 ★안 걸렸다. ⇒ ★꼴 = 「블럭 선택자 10종 이상이 든 문자열 선언」. */
const DECL = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*((?:'[^']*'|"[^"]*"|\s*\+\s*|\s*\n\s*)+);/g;
const MIN_TOKENS = 10;

/* ★★키에 «줄 번호»를 ★쓰지 않는다 — ★261018 S1 이 잡았다:
     editor.js 에 ★한 줄이 들어가자 ★아래 키가 ★전부 밀려 ★A2 가 ★엉뚱한 자리를 ★짝지었다.
   ★내 정본에 「줄번호 말고 앵커로 가리켜라」가 ★있는데 ★쓰고도 ★안 지켰다.
   ⇒ ★키 = `파일 이름#등장순번`. ★같은 파일에 ★같은 이름이 ★둘 있다(js/editor.js BLOCK_SEL ×2) ⇒ ★순번이 ★가른다.
   ★자리(줄 번호)는 ★★LINES 에 따로 담아 ★실패 메시지에만 쓴다 — ⛔단언에는 ★안 쓴다. */
const LINES = new Map();
function rosters(inject) {
  const out = new Map();
  const seen = new Map();
  if (!inject) LINES.clear();
  for (const rel of FILES) {
    const src = inject?.[rel] ?? readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of src.matchAll(DECL)) {
      const toks = new Set([...m[2].matchAll(/\.([a-z0-9][\w-]*-block)\b/g)].map((x) => x[1]));
      if (toks.size >= MIN_TOKENS) {
        const line = src.slice(0, m.index).split('\n').length;
        const base = `${rel} ${m[1]}`;
        const n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        const key = `${base}#${n}`;
        out.set(key, toks);
        if (!inject) LINES.set(key, line);
      }
    }
  }
  return out;
}
const at = (k) => `${k}${LINES.has(k) ? ` (${LINES.get(k)}행)` : ''}`;

/* ★★손으로 박은 참 명부 — ⛔코드에서 구하지 않는다(위 ⒝ 참조) */
const ALL_SEEN = [
  'asset-block', 'banner02-block', 'bridge-block', 'canvas-block', 'chat-block',
  'comparison-block', 'coupon-block', 'divider-block', 'frame-block', 'gap-block',
  'gradient-block', 'graph-block', 'grid-block', 'icon-block', 'icon-circle-block',
  'icon-text-block', 'infocard-block', 'innercard-block', 'joker-block', 'label-group-block',
  'laurel-block', 'mockup-block', 'modal-block', 'qa-block', 'quote-block', 'radial-block',
  'shape-block', 'speech-bubble-block', 'step-block', 'sticker-block', 'table-block',
  'text-block', 'vector-block', 'zoom-block',
];

/* ★★현 구멍 표 — 261018 ★실측. ★이 표가 ★「허용」이 아니라 ★★«지금 이러하다»의 ★기록이다.
   ⒉ 파생이 끝나면 ★이 표는 ★«전부 명부» 쪽에서 ★비어야 한다. */
const KNOWN_GAPS = {
  'js/block-factory.js BLOCK_SEL#1': ['gradient-block', 'modal-block', 'speech-bubble-block', 'sticker-block'],
  'js/editor.js CANVAS_SEL_BLOCKS#1': ['frame-block', 'shape-block'],
  'js/editor.js BLOCK_MULTI_SEL#1': ['banner02-block', 'canvas-block', 'chat-block', 'comparison-block', 'coupon-block', 'frame-block', 'gradient-block', 'icon-block', 'joker-block', 'laurel-block', 'mockup-block', 'quote-block', 'radial-block', 'speech-bubble-block', 'step-block', 'sticker-block', 'vector-block', 'zoom-block'],
  'js/editor.js FLOW_BLOCK_SEL_SELECTED#1': ['joker-block', 'shape-block'],
  'js/editor.js _ALL_BLOCK_SEL#1': ['frame-block', 'joker-block', 'sticker-block'],
  'js/editor.js MULTI_SEL#1': ['frame-block'],
  'js/editor.js BLOCK_SEL#1': ['frame-block', 'sticker-block'],
  'js/editor.js _ALL#1': ['frame-block', 'joker-block', 'sticker-block'],
  'js/editor.js BLOCK_SEL#2': ['banner02-block', 'canvas-block', 'chat-block', 'comparison-block', 'coupon-block', 'frame-block', 'gradient-block', 'icon-block', 'joker-block', 'laurel-block', 'mockup-block', 'quote-block', 'radial-block', 'speech-bubble-block', 'step-block', 'sticker-block', 'vector-block', 'zoom-block'],
  'js/block-drag.js CHILD_BLOCK_SEL#1': ['banner02-block', 'canvas-block', 'chat-block', 'comparison-block', 'coupon-block', 'frame-block', 'gradient-block', 'joker-block', 'laurel-block', 'qa-block', 'quote-block', 'radial-block', 'speech-bubble-block', 'step-block', 'sticker-block', 'vector-block', 'zoom-block'],
  'js/block-drag.js BLOCK_SEL#1': ['chat-block', 'coupon-block', 'frame-block', 'gradient-block', 'laurel-block', 'qa-block', 'quote-block', 'radial-block', 'speech-bubble-block', 'sticker-block', 'zoom-block'],
};
const EXPECT_ROSTERS = 11;

test('A1 ★전제 — ★명부를 ★꼴로 ★11곳 찾고, ★합집합이 ★손으로 박은 명부와 ★같다', () => {
  const R = rosters();
  /* ★이 단언이 ★먼저 서야 ★아래가 뜻을 갖는다 — ⛔찾은 것이 0곳이면 ★A2 는 ★빈 순회로 ★초록이 된다. */
  assert.equal(R.size, EXPECT_ROSTERS,
    `★명부를 ${R.size}곳 찾았다(기대 ${EXPECT_ROSTERS}) — ★늘었으면 ★KNOWN_GAPS 에 그 자리를 ★더해라, ★줄었으면 ★⒉ 파생이 ★돌았거나 ★자가 깨졌다. 찾은 것: ${[...R.keys()].join(' · ')}`);
  const union = [...new Set([...R.values()].flatMap((s) => [...s]))].sort();
  assert.deepEqual(union, [...ALL_SEEN].sort(),
    `★합집합이 ★ALL_SEEN 과 다르다 — ★새 블럭을 더했으면 ★ALL_SEEN 에 ★손으로 넣고 ★KNOWN_GAPS 를 ★갱신해라.\n  ★명부에만: ${union.filter((b) => !ALL_SEEN.includes(b)).join(',') || '없음'}\n  ★ALL_SEEN 에만: ${ALL_SEEN.filter((b) => !union.includes(b)).join(',') || '없음'}`);
});

test('A2 ★각 명부의 ★빠진 집합이 ★KNOWN_GAPS 와 ★같다 — ★양방향으로 재고 ★자리를 찍는다', () => {
  const R = rosters();
  const all = new Set(ALL_SEEN);
  const problems = [];
  for (const [where, toks] of R) {
    const missing = [...all].filter((b) => !toks.has(b)).sort();
    const known = (KNOWN_GAPS[where] ?? []).slice().sort();
    /* ⛔등호 하나로 끝내지 않는다 — ★양방향 차집합을 ★따로 적는다.
       ★새로 빠진 것 = ★누가 블럭을 더하며 ★이 자리를 ★안 고쳤다
       ★채워진 것   = ★누가 고쳤다 ⇒ ★★KNOWN_GAPS 를 ★줄여라(⛔표를 ★안 줄이면 ★다음 구멍을 ★가린다) */
    const fresh = missing.filter((b) => !known.includes(b));
    const fixed = known.filter((b) => !missing.includes(b));
    if (fresh.length) problems.push(`★${at(where)} — ★★새로 빠졌다: ${fresh.join(',')} (★블럭을 더했으면 ★이 자리에도 넣어라)`);
    if (fixed.length) problems.push(`★${at(where)} — ★채워졌다: ${fixed.join(',')} (★KNOWN_GAPS 에서 ★지워라)`);
    if (!(where in KNOWN_GAPS)) problems.push(`★${at(where)} — ★★표에 없는 명부다 (★KNOWN_GAPS 에 ★더해라)`);
  }
  assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}\n`);
});

test('A3 ★★KNOWN_GAPS 가 ★장식이 아니다 — ★표 자체가 ★비면 ★거절한다', () => {
  /* ★A2 는 ★「표와 같다」를 재므로 ★표가 ★비고 ★명부도 ★다 채워지면 ★초록이다 —
     ★그건 ★올바른 초록이다. ★그러나 ★표만 ★비우고 ★명부는 ★그대로면 ★A2 가 ★빨강이어야 한다.
     ★여기서는 ★그 표가 ★「지금 실재하는 구멍」을 ★가리키는지만 ★따로 잠근다 —
     ⛔표를 ★지워서 ★초록을 ★만드는 길을 ★막는다(★「검사가 싼 쪽 오답을 ★열어 준다」). */
  const n = Object.values(KNOWN_GAPS).reduce((a, v) => a + v.length, 0);
  assert.ok(Object.keys(KNOWN_GAPS).length === EXPECT_ROSTERS,
    `★KNOWN_GAPS 가 ${Object.keys(KNOWN_GAPS).length}곳 — ★명부 ${EXPECT_ROSTERS}곳 ★전부에 ★칸이 있어야 한다(★구멍 0 이면 ★빈 배열로)`);
  assert.ok(n > 0,
    '★KNOWN_GAPS 가 ★통째로 비었다 — ★구멍이 ★정말 0 이면 ★⒉ 파생이 끝난 것이니 ★이 단언을 ★지우고 그 사실을 ★적어라');
  /* ★가장 심한 둘을 ★이름으로 박는다 — ★이 검사가 ★무엇을 보고 생겼는지 ★남긴다 */
  const worst = ALL_SEEN.filter((b) => Object.values(KNOWN_GAPS).filter((v) => v.includes(b)).length >= 8);
  assert.deepEqual(worst.sort(), ['frame-block', 'sticker-block'],
    `★8곳 이상에서 빠진 블럭이 달라졌다: ${worst.join(',')} — ★261018 실측은 frame·sticker 둘이었다`);
});

test('A4 ★★키가 «줄 번호»에 ★안 묶였다 — ★줄이 밀려도 ★같은 키가 나온다 (261018 S1 이 잡은 흠)', () => {
  /* ★★양성대조 기록: ★이 단언을 ★고치기 «전» 판(aec88542)에 얹으니 ★★빨강이었다(fail 1 · rc 1).
     ★★⛔첫 시도는 ★초록이었다 — ★그때 rosters 가 ★inject 를 ★안 받아 ★★같은 것을 두 번 잰 ★항등식이었다.
     ⇒ ★단언을 걸기 전에 ★«이 식이 거짓이 되는 판»을 ★먼저 만들어라. */
  const base = [...rosters().keys()].sort();
  assert.equal(base.length, EXPECT_ROSTERS,
    `★전제 — ★먼저 ${EXPECT_ROSTERS}곳이 나와야 ★이 검사가 뜻을 갖는다(나온 수 ${base.length})`);
  const pad = {};
  for (const rel of FILES) pad[rel] = '\n'.repeat(7) + readFileSync(path.join(ROOT, rel), 'utf8');
  const moved = [...rosters(pad).keys()].sort();
  assert.deepEqual(moved, base,
    '★모든 파일을 ★7줄 밀었더니 ★키가 달라졌다 — ★키가 ★줄 번호에 ★묶여 있다(⛔KNOWN_GAPS 가 ★한 줄씩 밀린다)');
});
