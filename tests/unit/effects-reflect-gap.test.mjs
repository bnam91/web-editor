/* effects-reflect-gap.test.mjs — ★반사 「간격」의 ★하한과 ★슬라이더 (현빈 2026-10-07 · 지디 판정)
 *
 * 현빈 원문: 「★반사 ★−20밖에 안되는데 ★더 되게 해주기. ★★슬라이드로 조절가능하게도 해주기」
 *
 * ★★이 검사가 ★«무엇을 잠그지 않는가»부터 적는다 — ★그게 이 건의 핵이다:
 *   ⛔「★−40 이 ★여백 0 바닥(−44)보다 안쪽이다」를 ★★안 건다.
 *     까닭: ★그 −44 는 ★h=80·len=55 ★한 조합의 수고, ★h=20·len=10 에서는 ★−2.0 이다.
 *     ⇒ ★그 단언은 ★★「한 환경에서만 참인 검사」가 되고 ★그 초록은 ★«안 재고 있다»와 ★구분이 안 된다.
 *   ⇒ ★대신 ★★«h·len 에 ★무관하게 참인» 것만 건다 — 아래 ⒜⒝⒞⒟.
 *
 * ★★실측(2026-10-07 · h×len 28조합 전수): 여백 0 바닥을 넘는 조합이
 *   ★−20 에서 ★이미 ★12 · ★−40 에서 ★17 · ★최악 h=20·len=10 → 바닥 ★−2.0
 *   ⇒ ★★「h·len 무관하게 안전한 음수 하한」은 ★★0 뿐이다 ⇒ ★★기하가 수를 정하지 않는다
 *   ⇒ ★★하한의 출처 = ★지디 결정(현빈이 −20 에 부딪혔고 ★두 배로 연다) — ★js/effects-reflect.js 머리말
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const RAW = readSrc(ROOT, 'js', 'effects-reflect.js');
const SRC = stripComments(RAW);

/** 범위 정본을 ★소스에서 뽑는다 — ⛔수를 손으로 베끼지 않는다. */
function ranges() {
  const m = SRC.match(/FX_REFLECT_RANGES = \{\s*gap:\s*\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]\s*,\s*len:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
  assert.ok(m, '★FX_REFLECT_RANGES 를 못 뽑았다 — 정본 꼴이 바뀌었나');
  return { gLo: +m[1], gHi: +m[2], lLo: +m[3], lHi: +m[4] };
}

/* ─────────────────────────────────────────────
   T0 ★입력이 살아 있다
   ───────────────────────────────────────────── */
test('T0 ★입력이 살아 있다 — 소스·거르개·형제 토큰', () => {
  assert.ok(SRC.trim().length > 1500, `주석을 턴 뒤 ${SRC.trim().length}자 — 거르개가 코드를 먹었다`);
  /* ★형제 토큰 — 이 건과 무관하게 존재한다. 0 이면 거르개가 코드를 삼켰다. */
  assert.ok((SRC.match(/webkitBoxReflect/g) || []).length >= 2,
    '★형제 토큰 webkitBoxReflect 가 2곳 미만 — 거르개가 코드를 먹었다');
  /* ★거르개가 «주석만» 턴다 — 양성대조 */
  const probe = "const a=1;\n/* FX_REFLECT_RANGES = { gap: [-9, 9] } */\nconst b = FX_REFLECT_RANGES;\n";
  assert.strictEqual((stripComments(probe).match(/gap: \[/g) || []).length, 0,
    '★거르개가 주석 속 범위를 남겼다 — 아래 정본 뽑기가 ★주석에 속는다');
});

/* ─────────────────────────────────────────────
   ⒜ 하한이 ★정본 «한 곳»에서만 온다
   ⇐ 되돌리면 빨강: 어느 소비자가 수를 손으로 적으면 터진다.
   ───────────────────────────────────────────── */
test('⒜ ★하한은 ★FX_REFLECT_RANGES ★한 곳에서만 온다 · 값은 ★−40', () => {
  const R = ranges();
  assert.strictEqual(R.gLo, -40,
    `★간격 하한이 ${R.gLo} 다 — 지디 결정(2026-10-07)은 ★−40 이다(현빈 −20 의 두 배)`);
  assert.strictEqual(R.gHi, 40, `★간격 상한이 ${R.gHi} 다 — 현빈은 ★음수만 말했다(상한 40 유지)`);

  /* ★정본 선언은 ★하나다 */
  assert.strictEqual((SRC.match(/FX_REFLECT_RANGES = \{/g) || []).length, 1,
    '★범위 정본 선언이 1곳이 아니다');
  /* ★소비자가 ★그 정본을 ★읽는다 — ⛔수를 손으로 적은 자리가 없다 */
  const consumers = (SRC.match(/FX_REFLECT_RANGES/g) || []).length;
  assert.ok(consumers >= 4,
    `★정본을 읽는 자리가 ${consumers} — ≥4 여야 한다(읽기·쓰기 클램프·패널·window 노출)`);
  /* ⛔하한 수를 ★손으로 적은 자리 — 정본 줄 ★하나를 빼면 ★0 이어야 한다 */
  const hand = (SRC.match(/-40/g) || []).length;
  assert.strictEqual(hand, 1,
    `★«−40» 이 소스에 ${hand}번 나온다 — ★정본 줄 ★하나뿐이어야 한다(손으로 적은 사본이 있다)`);
});

/* ─────────────────────────────────────────────
   ⒝ 슬라이더 `min` 이 ★그 정본과 같다 — ★UI ↔ 정본
   ⇐ 되돌리면 빨강: 간격을 slider 가 아닌 꼴로 되돌리거나, min 을 손으로 적으면 터진다.
   ───────────────────────────────────────────── */
test('⒝ ★간격이 ★슬라이더다(현빈 요청) · min·max 가 ★정본에서 온다', () => {
  /* ★현빈 「★슬라이드로 조절가능하게도 해주기」 — ★간격이 ★slider 헬퍼를 탄다 */
  assert.match(SRC, /\$\{slider\('간격', 'gap', fx\.gap, R\.gap\)\}/,
    '★간격이 slider 헬퍼를 안 탄다 — 현빈이 ★명시한 것이다');
  /* ⛔옛 꼴(.prop-icon-input 안 number 하나)이 ★안 남았다 */
  assert.doesNotMatch(SRC, /id="\$\{P\}-fx-gap"/,
    '★옛 간격 입력(fx-gap)이 남아 있다 — 두 꼴이 공존한다');

  /* ★slider 헬퍼가 ★min·max 를 ★인자로 받는다 = ★정본에서 온다(⛔손으로 적지 않는다) */
  assert.match(SRC, /const slider = \(lbl, key, val, \[lo, hi\]\) =>/,
    '★slider 헬퍼 서명이 바뀌었다 — min/max 가 정본에서 오는지 다시 봐야 한다');
  assert.match(SRC, /min="\$\{lo\}" max="\$\{hi\}"/,
    '★슬라이더 min/max 가 인자에서 오지 않는다 — 손으로 적힌 수가 있다');

  /* ★배선 — 간격이 ★같은 고리를 탄다(mousedown·input·change 셋을 얻는다) */
  const m = SRC.match(/for \(const key of \[([^\]]+)\]\)/);
  assert.ok(m, '★배선 고리를 못 찾았다');
  const keys = m[1].split(',').map(x => x.trim().replace(/'/g, ''));
  assert.deepStrictEqual(keys, ['gap', 'len', 'op'],
    `★배선 고리가 ${JSON.stringify(keys)} — gap 이 빠지면 ★끄는 «동안» 미리보기가 없다`);
});

/* ─────────────────────────────────────────────
   ⒞ ★여백이 ★음수가 안 된다 — ★h·len·gap ★전수(h 무관하게 참)
   ⇐ 되돌리면 빨강: `Math.max(0, …)` 를 빼면 터진다.
   ───────────────────────────────────────────── */
test('⒞ ★여백은 ★절대 음수가 아니다 — h·len·gap ★전수', () => {
  /* ★식을 ★소스에서 확인한다 — ⛔베끼지 않는다 */
  assert.match(SRC, /_setHostMargin\(host, Math\.max\(0, Math\.round\(fx\.gap \+ h \* fx\.len \/ 100\)\)\)/,
    '★여백 식이 바뀌었다 — 아래 전수가 ★다른 식을 재고 있을 수 있다');

  const R = ranges();
  const margin = (gap, h, len) => Math.max(0, Math.round(gap + h * len / 100));
  let n = 0, neg = [];
  for (const h of [0, 1, 20, 40, 60, 80, 120, 200, 400, 2000]) {
    for (let len = R.lLo; len <= R.lHi; len += 5) {
      for (const gap of [R.gLo, -20, -1, 0, 4, R.gHi]) {
        n++;
        const v = margin(gap, h, len);
        if (v < 0) neg.push({ gap, h, len, v });
      }
    }
  }
  assert.ok(n >= 500, `★전수 조합이 ${n} — ≥500 이어야 한다(범위가 좁아졌나)`);
  assert.deepStrictEqual(neg, [], `★음수 여백이 ${neg.length}건 — ${JSON.stringify(neg.slice(0, 3))}`);

  /* ★음성대조 — `max(0,…)` 를 뺀 식은 ★음수를 낸다(이 전수가 «산다»는 증인) */
  const raw = (gap, h, len) => Math.round(gap + h * len / 100);
  assert.ok(raw(R.gLo, 20, R.lLo) < 0,
    '★음성대조 실패 — max 를 뺀 식도 음수를 안 낸다. 위 0건이 뜻을 잃는다');
});

/* ─────────────────────────────────────────────
   ⒟ ★★−40 에서 ★여백이 ★0 이 되는 조합이 ★실재한다
   ★★왜 이 칸인가(지디 2026-10-07): ★그게 ★「★겹침은 ★결함이 아니라 ★동작이다」를
     ★★검사가 ★스스로 말하게 한다. ★주석보다 ★오래 산다.
   ⇐ 되돌리면 빨강: 하한을 0 이상으로 올리면(겹침을 금지하면) 터진다.
   ───────────────────────────────────────────── */
test('⒟ ★하한에서 ★여백 0 이 되는 조합이 ★실재한다 — ★겹침은 ★동작이다', () => {
  const R = ranges();
  const margin = (gap, h, len) => Math.max(0, Math.round(gap + h * len / 100));
  const H = [20, 40, 60, 80, 120, 200, 400];
  const L = [R.lLo, 25, 55, R.lHi];

  const zeroAt = (gap) => H.flatMap(h => L.map(len => ({ h, len, m: margin(gap, h, len) }))).filter(x => x.m === 0);
  const atLo = zeroAt(R.gLo);
  const atOld = zeroAt(-20);

  /* ★본 단언 — ★하한에서 ★여백 0 조합이 ★있다(= 자리를 안 민다 = 겹친다) */
  assert.ok(atLo.length > 0,
    `★하한 ${R.gLo} 에서 ★여백 0 조합이 ★0건이다 — 겹침이 사라졌다면 ★하한이 0 이상으로 올라간 것이다`);
  /* ★★그리고 ★그것이 ★«새로 생긴 것»이 아니다 — ★옛 하한 −20 에서도 ★이미 있었다 */
  assert.ok(atOld.length > 0,
    '★옛 하한 −20 에서 ★여백 0 조합이 0건이다 — 「겹침은 이미 동작이었다」는 근거가 깨졌다');
  /* ★수를 ★단언 메시지에 ★찍어 둔다 — ⛔다음 사람이 다시 안 재게 */
  assert.ok(atLo.length >= atOld.length,
    `★하한을 넓혔는데 ★여백 0 조합이 줄었다 — ${R.gLo}: ${atLo.length}건 / −20: ${atOld.length}건 (H=${JSON.stringify(H)} L=${JSON.stringify(L)})`);
  console.log(`  ⒟ ★실측 — 여백 0 조합: 하한 ${R.gLo} 에서 ★${atLo.length}건 / 옛 −20 에서 ★${atOld.length}건`
    + ` (전수 ${H.length * L.length}조합 · H=${JSON.stringify(H)} L=${JSON.stringify(L)})`);

  /* ★★그래서 ⛔「깨진다」를 하한의 근거로 쓰지 말라는 ★까닭이 ★머리말에 ★적혀 있나 */
  assert.match(RAW, /「깨진다」를 ★근거로 쓰지 마라/,
    '★머리말에서 ★그 경고가 사라졌다 — 다음 사람이 ★한 조합의 꺾임에서 ★또 파생한다');
  /* ⛔「시안 그대로」가 ★간격의 까닭으로 ★남아 있지 않다(그 까닭은 죽었다) */
  assert.doesNotMatch(RAW, /간격[^\n]*시안 슬라이더 그대로/,
    '★간격의 까닭이 아직 「시안 그대로」다 — 그 까닭은 ★현빈이 물렀다');
});
