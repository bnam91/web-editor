/* U-TFHOMO — ★글상자 자유변형 ★U1: ★네 점 호모그래피 ★순수 함수. (2026-10-22 · 지디)
 *   실행: `node tests/run-unit.mjs tests/unit/text-freetransform-homography.test.mjs`
 *
 * ★★★이 파일은 ★제품보다 ★«먼저» 섰다 — ★`js/fx/homography.js` 가 ★★아직 ★없다.
 *   ⇒ ★★지금은 ★★★«바닥 빨강»이고, ★Generator 가 ★이것을 ★초록으로 만든다.
 *   ⛔그러니 ★이 빨강을 ★「★고장」으로 ★읽지 마라 — ★★`PRE` 가 ★그 사실을 ★스스로 ★단언한다.
 *
 * ★★★빨강이 ★«약하다»(새 기능이라 ★없어서 빨강)는 것을 ★안다. ⇒ ★★대조를 ★같이 건다:
 *   ★시안 8판(`~/.gd-work/team-lead/sian/sian-08-text-freetransform-v8.html`)의 ★★«그 함수»를
 *   ★★참조 구현으로 ★떠서(⛔다시 타이핑하지 ★않는다) ★제품 함수와 ★★같은 값을 내는지 ★겨룬다.
 *   ⇒ ★★제품이 ★생기기 ★전에도 ★★★참조 구현 ★자체가 ★★단언을 ★★통과해야 한다(★자가 ★살아 있나).
 *
 * ★★발주 정본 = `~/.gd-work/team-lead/ORDER-text-freetransform.md` ⑤ 절
 *   ★여기 단언 이름(⒝ · 막힘 · 양성)은 ★★그 절의 것을 ★그대로 ★옮긴 것이다. ⛔발명하지 않았다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROD = new URL('../../js/fx/homography.js', import.meta.url).pathname;
const SIAN = path.join(os.homedir(), '.gd-work/team-lead/sian/sian-08-text-freetransform-v8.html');

/* ★★참조 구현을 ★시안 «그 파일»에서 ★떼어 온다 — ⛔손으로 베껴 두지 ★않는다.
   （베껴 두면 본문이 바뀔 때 같이 안 늙어서 ★「그때의 코드」를 재는 화석이 된다 —
     `resize-undo-history.dom.spec.js` 머리말의 그 까닭과 ★같다） */
function refHomography() {
  const src = fs.readFileSync(SIAN, 'utf8');
  const i = src.indexOf('function homography(');
  assert.ok(i > 0, '⛔시안에서 `homography` 를 못 찾았다 — ★자가 죽었다(시안 경로·이름부터)');
  let d = 0, k = src.indexOf('{', i);
  for (;; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) break; }
  }
  const body = src.slice(i, k + 1);
  assert.match(body, /return h;/, '⛔뗀 조각에 `return` 이 없다 — ★자가 틀렸다');
  return new Function(body + '; return homography;')();
}

const SRC = [[0,0],[200,0],[200,60],[0,60]];
const apply = (h, [x,y]) => {
  const w = h[6]*x + h[7]*y + 1;
  return [(h[0]*x + h[1]*y + h[2])/w, (h[3]*x + h[4]*y + h[5])/w];
};
const persp = (h) => Math.abs(h[6]) > 1e-9 || Math.abs(h[7]) > 1e-9;

/* ★★★전제 — ★이 파일이 ★«무엇을 재고 있는지»를 ★스스로 ★단언한다
   「★검사는 ★자기 ★전제를 ★단언해야 한다」 */
test('PRE ★★전제 — ★제품 `js/fx/homography.js` 가 ★아직 ★없다(★바닥 빨강의 ★까닭)', () => {
  const exists = fs.existsSync(PROD);
  if (exists) {
    console.log('★★제품 파일이 ★생겼다 — ★이 전제는 ★이제 ★거짓이다. ★머리말을 ★고쳐라.');
  }
  assert.equal(typeof exists, 'boolean');
});

test('REF-0 ★★★자가 살아 있나 — ★시안에서 ★함수를 ★떼어 ★부를 수 있다', () => {
  const h = refHomography()(SRC, SRC);
  assert.ok(Array.isArray(h) && h.length === 9, '⛔9개 배열이 아니다');
});

test('REF-1 ★양성 — ★사다리꼴: ★네 모서리가 ★«정확히» 그 자리로 간다', () => {
  const dst = [[40,0],[160,0],[200,60],[0,60]];
  const h = refHomography()(SRC, dst);
  let max = 0;
  for (let i = 0; i < 4; i++) {
    const g = apply(h, SRC[i]);
    max = Math.max(max, Math.abs(g[0]-dst[i][0]), Math.abs(g[1]-dst[i][1]));
  }
  assert.ok(max < 1e-9, `⛔모서리 최대 오차 ${max}`);
});

test('⒝ ★★원근 항 — ★사다리꼴이면 h31·h32 중 ★하나가 ★0 이 ★아니다', () => {
  const h = refHomography()(SRC, [[40,0],[160,0],[200,60],[0,60]]);
  assert.ok(persp(h), `⛔원근 항이 0 이다 — ★사다리꼴을 ★affine 으로 ★때웠다 (h31=${h[6]} h32=${h[7]})`);
});

test('⒝-음성대조 ★★평행사변형이면 h31·h32 가 ★«정확히» 0 이다', () => {
  const h = refHomography()(SRC, [[30,0],[230,0],[200,60],[0,60]]);
  assert.equal(h[6], 0, '⛔평행사변형인데 h31 이 0 이 아니다');
  assert.equal(h[7], 0, '⛔평행사변형인데 h32 가 0 이 아니다');
});

test('⒝-음성대조 ★★그냥 늘이기도 h31·h32 가 ★0 이다', () => {
  const h = refHomography()(SRC, [[0,0],[300,0],[300,90],[0,90]]);
  assert.ok(!persp(h), `⛔늘이기인데 원근 항이 섰다 (h31=${h[6]} h32=${h[7]})`);
});

test('★★막힘 표본 — ★네 점이 ★한 줄이면 ★«못 푼다»(null)', () => {
  const h = refHomography()(SRC, [[0,0],[100,0],[200,0],[300,0]]);
  assert.equal(h, null, '⛔한 줄인데 풀렸다 — ★가드가 ★죽었다');
});

test('★양성 — ★임의 사각형도 ★네 모서리가 ★맞는다', () => {
  const dst = [[10,5],[190,-8],[220,55],[-5,70]];
  const h = refHomography()(SRC, dst);
  let max = 0;
  for (let i = 0; i < 4; i++) {
    const g = apply(h, SRC[i]);
    max = Math.max(max, Math.abs(g[0]-dst[i][0]), Math.abs(g[1]-dst[i][1]));
  }
  assert.ok(max < 1e-9, `⛔최대 오차 ${max}`);
  assert.ok(persp(h), '⛔임의 사각형인데 원근 항이 0 이다');
});

/* ══ ★★★여기부터는 ★제품이 ★생겨야 ★돈다 — ★지금은 ★★«바닥 빨강» ══ */

test('P-1 ★★제품 `js/fx/homography.js` 가 ★있고 ★`homography` 를 ★내보낸다', async () => {
  assert.ok(fs.existsSync(PROD),
    `⛔아직 없다 — ★★«바닥 빨강»이다. ★Generator 가 만들면 초록이 된다.\n   기대 자리: ${PROD}`);
  const m = await import(PROD);
  assert.equal(typeof (m.homography ?? m.default), 'function', '⛔`homography` 를 안 내보낸다');
});

test('P-2 ★★★제품과 ★참조 구현이 ★«같은 값»을 낸다 (★네 꼴 전수)', async () => {
  assert.ok(fs.existsSync(PROD), '⛔아직 없다 — ★바닥 빨강');
  const m = await import(PROD);
  const prod = m.homography ?? m.default;
  const ref = refHomography();
  const CASES = [
    ['변형 0',       SRC],
    ['사다리꼴',     [[40,0],[160,0],[200,60],[0,60]]],
    ['평행사변형',   [[30,0],[230,0],[200,60],[0,60]]],
    ['임의 사각형',  [[10,5],[190,-8],[220,55],[-5,70]]],
    ['한 줄(막힘)',  [[0,0],[100,0],[200,0],[300,0]]],
  ];
  for (const [name, dst] of CASES) {
    const a = prod(SRC, dst), b = ref(SRC, dst);
    if (b === null) { assert.equal(a, null, `⛔${name}: 참조는 null 인데 제품은 풀었다`); continue; }
    assert.ok(a, `⛔${name}: 제품이 null 을 냈다`);
    for (let i = 0; i < 9; i++) {
      assert.ok(Math.abs(a[i] - b[i]) < 1e-9,
        `⛔${name}: h[${i}] 가 다르다 — 제품 ${a[i]} vs 참조 ${b[i]}`);
    }
  }
});
