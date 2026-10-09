/* frame-clip-axis-roster — 「★`data-clip-content` 축은 ★★«양쪽»이 ★서야 한다」를 ★재는 자 (2026-10-10)
 *
 * ★★왜 있나 — ★사람 말로 적어 둔 규율이 ★★두 번 ★안 지켜졌다:
 *   ⑴ ★2026-09-22 `T-088` 이 ★죔을 ★조건 ★없이 단언했다 → ★2026-09-28 ★현빈이 ★기본을 ★`visible` 로
 *      바꾸자 ★그 단언의 ★까닭이 ★죽었다. ★문만 ★한 해 ★남았다.
 *   ⑵ ★2026-10-09 ★그 자리를 ★`if (clips)` ★갈래로 고쳤다 — ★★거의 ★항등식이었다. ★제품의 ★지금 상태에서
 *      ★갈래를 끌어오면 ★기본이 ★또 뒤집혀도 ★맞는 갈래가 ★골라진다. ★그리고 ★2026-10-10 에 ★뒤집혔다.
 *   ★★그때 ★전수로 센 수: ★DOM spec 에서 `clipContent='false'`(= ★현빈 2026-09-28 의 ★끔)를 ★돌리는 칸이
 *      ★★0건이었다. ★「양쪽을 적었다」는 ★주석이 ★여섯 자리에 ★있었는데 ★한쪽은 ★한 번도 ★안 돌았다.
 *   ⇒ ★★규칙은 ★«재는 자»가 ★있어야 ★집행된다. ★이 파일이 ★그 자다.
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다)
 *   · ★단언의 ★내용이 ★맞나 — ★그건 ★DOM 칸들이 ★행위로 잰다. ★여기는 ★★«돌기는 하나»만 잰다
 *   · ★★«속성 없음»(기본) 쪽의 ★수 — ★꼴이 `scene(page)` 처럼 ★암시적이라 ★소스로 ★못 센다.
 *     ⇒ ★그쪽은 ★R2 가 ★아니라 ★각 칸의 ★«전제 단언»(computed overflow)이 ★지킨다 ⇒ ★R4 가 ★그것을 ★센다
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { stripCommentsTA, templateBalanced } = createRequire(import.meta.url)('./_strip-comments.js');

const DOM = new URL('../dom/', import.meta.url);
const read = (f) => readFileSync(new URL(f, DOM), 'utf8');

/** ★★「끔 쪽 칸」을 ★세는 ★단 하나의 자. ⛔명부를 ★손으로 ★적지 않는다 — ★꼴로 ★찾는다.
 *  ⚠️한계(★단언하지 않고 적는다): ★아래 ★꼴 ★밖의 ★새 표기는 ★안 보인다
 *    ⇒ ★그래서 ★R3 이 ★양성대조로 ★「이 자가 ★정말 ★0 을 낼 수 있나」를 ★같이 잰다. */
const FREE_FORMS = [
  /clipContent\s*=\s*'false'/,          /* dataset 직접 */
  /clipAttr\s*:\s*'false'/,             /* scene() 축 */
  /\[\s*'false'\s*,/,                   /* 두 다리 루프 */
  /side\s*:\s*'free'/,                  /* judge() 선언 */
];
/** 칸 단위로 쪼갠다 — ★주석을 ★걷은 ★뒤에. ⛔안 걷으면 ★내 산문이 ★측정값이 된다(2026-10-07). */
function freeCells(src) {
  const code = stripCommentsTA(src);
  return code.split(/\btest\s*\(/).slice(1).filter((b) => FREE_FORMS.some((re) => re.test(b)));
}

/* ★명부를 ★파생시킨다 — ⛔파일 이름을 ★손으로 ★적지 않는다(둘째 명부가 된다). */
const ROSTER = readdirSync(DOM).filter((f) => f.endsWith('.spec.js'))
  .filter((f) => /clipContent/.test(stripCommentsTA(read(f))));

test('R1 ★명부가 ★파생된다 — ★축을 ★코드로 ★만지는 spec 을 ★전수로 찾는다', () => {
  assert.ok(ROSTER.length >= 3, `★축을 만지는 spec 이 ${ROSTER.length} 벌 — ★3 벌보다 적다. 명부: ${ROSTER.join(' · ')}`);
  for (const f of ROSTER) {
    assert.equal(templateBalanced(read(f)), true,
      `★전제: ${f} 의 템플릿 중첩이 ★안 닫혔다 — ★그 뒤 줄을 ★«안 본» 것이고 ★아래 초록은 ★「괜찮다」가 아니다`);
  }
  console.log(`R1 ★명부 ${ROSTER.length} 벌 — ${ROSTER.join(' · ')}`);
});

test('R2 ★★축을 만지는 spec ★전부가 ★«끔(false)» 쪽 칸을 ★★하나 이상 ★돌린다', () => {
  const miss = [];
  const got = {};
  for (const f of ROSTER) { const n = freeCells(read(f)).length; got[f] = n; if (n === 0) miss.push(f); }
  console.log('R2 ★끔 쪽 칸 — ' + ROSTER.map((f) => `${f.replace('.dom.spec.js', '')} ${got[f]}`).join(' · '));
  assert.deepEqual(miss, [],
    '★★이 spec 들이 ★`clipContent="false"`(현빈 2026-09-28 의 ★끔) 쪽을 ★★한 번도 ★안 돌린다'
    + ' ⇒ ★그쪽 단언은 ★«적었지만 ★안 잰 조건»이다. ★2026-10-10 전에 ★이 수가 ★0·0·0 이었다.');
});

test('R3 ★★양성대조 — ★끔 쪽 칸을 ★지우면 ★이 자가 ★정말 ★0 을 낸다 (＋음성대조)', () => {
  /* ⛔양성대조 ★없이 ★R2 의 초록을 ★믿지 마라 — ★꼴 명부가 ★어긋나면 ★R2 는 ★언제나 ★초록이다. */
  const both = "test('a', () => { fr.dataset.clipContent = 'false'; });\ntest('b', () => { x; });";
  assert.equal(freeCells(both).length, 1, '★음성대조: ★끔 칸이 ★하나인데 ★그걸 ★못 셌다');
  const none = "test('a', () => { x; });\ntest('b', () => { y; });";
  assert.equal(freeCells(none).length, 0, '★★양성대조: ★끔 칸이 ★없는데 ★있다고 센다 — ★이 자는 ★아무것도 ★안 잠근다');
  /* ★★그리고 ★주석에 ★적힌 꼴은 ★★안 세야 한다(2026-10-07 — ★주석이 ★측정값이 된 그 자리) */
  const inComment = "/* clipContent = 'false' 라고 ★적어만 둔다 */\ntest('a', () => { x; });";
  assert.equal(freeCells(inComment).length, 0,
    '★★주석에 ★적은 꼴을 ★«진짜 칸»으로 셌다 — ★내 산문이 ★측정값이 되었다');
});

test('R4 ★★각 spec 이 ★«축 값이 ★먹었나»를 ★제품의 computed overflow 로 ★전제 단언한다', () => {
  /* ★이것이 ★«속성 없음»(기본) 쪽을 ★지키는 자다 — ★소스로 ★셀 수 없는 쪽이다.
     ★끔 칸은 `'visible'` 을, ★자르는 칸은 `'hidden'` 을 ★전제로 ★단언해야 한다.
     ⛔없으면 ★CSS 가 ★뒤집혀도 ★칸이 ★조용히 ★반대 갈래를 ★재고 ★초록이 된다. */
  const bad = [];
  for (const f of ROSTER) {
    const code = stripCommentsTA(read(f));
    const hasOv = /getComputedStyle\([^)]*\)\.overflow|\bov\b|\boverflow\b/.test(code);
    const hasVisible = /'visible'/.test(code), hasHidden = /'hidden'/.test(code);
    if (!(hasOv && hasVisible && hasHidden)) bad.push(`${f}(ov ${hasOv} · visible ${hasVisible} · hidden ${hasHidden})`);
  }
  assert.deepEqual(bad, [],
    '★★이 spec 들이 ★«축 값이 ★overflow 를 ★정했나»를 ★양쪽으로 ★전제 단언하지 ★않는다'
    + ' ⇒ ★기본이 ★또 뒤집히면 ★조용히 ★반대쪽을 ★잰다');
});

test('R5 ★★spec 이 ★제품 술어를 ★손으로 ★다시 세지 ★않는다 (명부 ★하나)', () => {
  /* ⚰️2026-10-09~10 ★세 파일이 `dataset.clipContent` 를 ★손으로 ★견주어 ★`clips` 를 만들었다 =
       ★`js/frame-geometry.js` 의 ★`frameClipsPaint` 의 ★둘째·셋째·넷째 ★명부.
     ★대신 ★각 칸이 ★축 값을 ★★«선언»하고 ★그 값을 ★전제로 ★단언한다. */
  const hits = [];
  for (const f of readdirSync(DOM).filter((x) => x.endsWith('.spec.js'))) {
    stripCommentsTA(read(f)).split('\n').forEach((l, i) => {
      if (/clipContent\s*[!=]==?\s*'/.test(l)) hits.push(`${f}:${i + 1} ${l.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(hits, [],
    '★★spec 이 ★제품의 ★자름 술어를 ★손으로 ★다시 센다 — ★갈래를 ★제품 상태에서 ★끌어오면 ★거의 ★항등식이다'
    + ' (★CSS·기본값이 ★뒤집혀도 ★맞는 갈래가 ★골라져 ★빨강이 ★안 난다)');
});
