/* anim-gif-text.test.mjs — js/fx/anim-gif-text.js(애니메이션 GIF 의 글자·숫자 계산)를 수로 잠근다.
 * 행위(실제 모달·미리보기)는 tests/dom/anim-gif-v1-defects.dom.spec.js 가 잰다 — 여기는 경계값.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { numToken, formatLike, countUpLine, reelDigit, lineStartX, typedLines } from '../../js/fx/anim-gif-text.js';

const easeOut = (p) => 1 - Math.pow(1 - p, 3);

test('N1 numToken — 콤마·소수까지 한 수 · 첫 수만 · 없으면 null', () => {
  assert.deepEqual(numToken('누적 12,345개'), { index: 3, raw: '12,345', value: 12345, dec: 0, comma: true });
  assert.deepEqual(numToken('평점 3.5'), { index: 3, raw: '3.5', value: 3.5, dec: 1, comma: false });
  assert.equal(numToken('1,234.50원').value, 1234.5);
  assert.equal(numToken('1,234.50원').dec, 2);
  assert.equal(numToken('12345').comma, false);
  assert.equal(numToken('A 7 B 9').raw, '7');
  assert.equal(numToken('숫자 없음'), null);
  assert.equal(numToken(''), null);
});

test('N2 formatLike — 원문 꼴(콤마·자릿수)을 따른다', () => {
  const t = numToken('1,234.50');
  assert.equal(formatLike(0, t), '0.00');
  assert.equal(formatLike(1234.5, t), '1,234.50');
  assert.equal(formatLike(1000000, numToken('1,000')), '1,000,000');
  assert.equal(formatLike(12345, numToken('99999')), '12345');   // 원문에 콤마가 없으면 안 붙인다
});

test('N3 countUpLine — 0 부터 끝값까지 «한 수»로 · 끝은 원문 그대로 · 끝값을 미리 안 보인다', () => {
  assert.equal(countUpLine('누적 판매 12,345개', 0), '누적 판매 0개');
  assert.equal(countUpLine('누적 판매 12,345개', 0.5), '누적 판매 6,172개');
  assert.equal(countUpLine('누적 판매 12,345개', 1), '누적 판매 12,345개');
  assert.equal(countUpLine('평점 3.5', 0), '평점 0.0');
  assert.equal(countUpLine('평점 3.5', 0.999), '평점 3.4');   // 내림 — 끝 전엔 끝값이 안 뜬다
  assert.equal(countUpLine('코드 007', 1), '코드 007');       // 끝은 원문(앞 0 꼴 보존)
  assert.equal(countUpLine('없음', 0.5), null);
});

test('N4 reelDigit — 끝에선 그 숫자로 멈춤 · 순서 r 이 클수록 늦게 멈춤 · 0~9 만', () => {
  for (let d = 0; d <= 9; d++) for (let r = 0; r < 4; r++) assert.deepEqual(reelDigit(d, r, 4, 1, easeOut), { cur: d, next: d, frac: 0 });
  const t = 0.7;
  const p = (r) => { const s = reelDigit(5, r, 4, t, easeOut); return s.frac === 0 && s.cur === 5; };
  assert.ok(p(0), 't=0.7 에 r=0(먼저 멈출 칸)은 멈췄다');
  assert.ok(!p(3), 't=0.7 에 r=3(마지막 칸)은 아직 돈다');
  for (let i = 0; i <= 20; i++) {
    const s = reelDigit(7, 1, 3, i / 20, easeOut);
    assert.ok(s.cur >= 0 && s.cur <= 9 && s.next >= 0 && s.next <= 9 && s.frac >= 0 && s.frac < 1, JSON.stringify(s));
  }
  assert.deepEqual(reelDigit(3, 0, 1, 1, easeOut), { cur: 3, next: 3, frac: 0 });   // 한 자리
});

test('N5 lineStartX — 줄 전체 폭 기준', () => {
  assert.equal(lineStartX('left', 24, 100), 24);
  assert.equal(lineStartX('right', 456, 100), 356);
  assert.equal(lineStartX('center', 240, 100), 190);
});

test('N6 typedLines — 줄을 넘어 이어 친다 · 0 이면 첫 줄 빈칸 · 1 이면 전부', () => {
  const L = ['가나다', '라마'];
  assert.deepEqual(typedLines(L, 0), ['']);
  assert.deepEqual(typedLines(L, 0.4), ['가나']);
  assert.deepEqual(typedLines(L, 0.8), ['가나다', '라']);
  assert.deepEqual(typedLines(L, 1), ['가나다', '라마']);
  assert.deepEqual(typedLines(['', 'ab'], 1), ['', 'ab']);
});
