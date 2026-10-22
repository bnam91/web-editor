/* U-TFHOMO — ★글상자 자유변형 ★U1: ★네 점 호모그래피 ★순수 함수. (2026-10-22 · 지디)
 *   실행: `node tests/run-unit.mjs tests/unit/text-freetransform-homography.test.mjs`
 *
 * ★★★이 파일은 ★제품보다 ★«먼저» 섰다 — ★커밋 `11475a8a` 에서 ★`js/fx/homography.js` 는 ★★없었고,
 *   ★그때 이 벌은 ★★★«바닥 빨강»이었다(★그 판의 ★잰 값 = ★rc=1 · ✔8 · ✖2 = ★P-1·P-2).
 *   ★★261022 Generator 가 ★제품을 ★세웠다 ⇒ ★★P-1·P-2 는 ★이제 ★초록이고,
 *   ★★아래 `PRE` 는 ★★★«제품이 ★있다»를 ★거꾸로 ★단언한다(★「아직 없다」는 ★이제 ★거짓이라 ★고쳤다).
 *   ⛔위 「먼저 섰다」는 ★★역사 문장이다 — ★그때 센 수를 ★거짓으로 만들지 않게 ★그대로 둔다.
 *
 * ★★★그때의 빨강이 ★«약했다»(새 기능이라 ★없어서 빨강)는 것을 ★안다. ⇒ ★★대조를 ★같이 건다:
 *   ★시안 8판(`~/.gd-work/team-lead/sian/sian-08-text-freetransform-v8.html`)의 ★★«그 함수»를
 *   ★★참조 구현으로 ★떠서(⛔다시 타이핑하지 ★않는다) ★제품 함수와 ★★같은 값을 내는지 ★겨룬다.
 *   ⇒ ★★제품이 ★생기기 ★전에도 ★★★참조 구현 ★자체가 ★★단언을 ★★통과해야 한다(★자가 ★살아 있나).
 *
 * ★★★`js/fx/package.json` = `{"type":"module"}` 가 ★★이 벌의 ★★선행조건이다 —
 *   ★뿌리 `package.json` 이 ★`"type": "commonjs"` 라 ★Node 는 ★`.js` 안의 ★ESM 을 ★★«찾지 않는다»
 *   (★레포 선례: ★`js/blocks/*.js` 도 ★ESM 이라 ★`coupon-presets.test.mjs` 등은 ★임시 폴더에 ★그 shim 을 ★얹어 싣는다.
 *    ★여기선 ★P-1 이 ★★«제품 그 자리»를 ★집어 오니 ★폴더에 ★한 장 둔다 — ★`js/fx` 의 ★나머지는 ★고전 스크립트지만
 *    ★그 자들은 ★`vm.runInContext` 로 ★글자째 실리므로 ★이 shim 이 ★안 닿는다 · ★브라우저 `<script src>` 도 ★무관.)
 *   ★★261022 ★실측 = ★제품 파일을 ★놓고 ★그 shim ★하나만 ★없애면 ★P-1·P-2 가
 *   ★`SyntaxError: Unexpected token 'export'` 로 ★★빨강이다(★rc=1 · ✖2)
 *   ⇒ ★★★그 shim 은 ★★P-1 이 ★재고 있다 — ⛔지워도 ★조용히 ★통과하지 ★않는다.
 *
 * ★★발주 정본 = `~/.gd-work/team-lead/ORDER-text-freetransform.md` ⑤ 절
 *   ★여기 단언 이름(⒝ · 막힘 · 양성)은 ★★그 절의 것을 ★그대로 ★옮긴 것이다. ⛔발명하지 않았다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* ★★`PROD` 는 ★★file: ★URL ★객체다 — ⛔`.pathname` 문자열이 ★아니다.
   ★까닭 = ★레포 게이트 ★`tests/unit/win-portability.test.mjs` ②-4·②-5 (★261022 ★실측으로 ★둘 다 ★빨강이었다):
     ②-5 ★`new URL(import.meta.url).pathname` ⇒ ★윈도우에서 ★`'/C:/…'` 를 만든다
     ②-4 ★`import(<file:// 아닌 것>)` ⇒ ★윈도우에서 ★`ERR_UNSUPPORTED_ESM_URL_SCHEME` 로 ★파일이 ★통째로 죽는다
   ★★`fs.existsSync` 와 ★`import()` 는 ★둘 다 ★file: ★URL ★객체를 ★받는다 ⇒ ★★P-1·P-2 를 ★한 줄도 ★안 고치고 ★닫힌다.
   ⛔`.pathname`·맨 경로로 ★되돌리지 마라 — ★그 게이트가 ★다시 ★빨강이 된다. */
const PROD = pathToFileURL(fileURLToPath(new URL('../../js/fx/homography.js', import.meta.url)));
/* ★★★261023 지디 — ★★시안을 ★★★«레포 안»으로 옮겼다. ★★까닭이 ★실측이다:
     ★이 벌은 ★`~/.gd-work/…` 를 ★`readFileSync` 했고 ⇒ ★★★★★«지디 맥에서만» 초록이었다.
     ★★잰 값(판 `c5551f64` ★한 판 · ★같은 명령 `npm test`):
       ★srv(지디 홈에 시안 ★있다)   : ★rc 0 · fail ★0
       ★수지(시안 ★없다)            : ★rc 1 · fail ★★8  ← ★REF-0·REF-1·⒝·⒝-음성대조 둘·막힘·양성·P-2 ★전부 ENOENT
     ⇒ ★★그 초록은 ★★★«안 재고 있다»와 ★구분이 ★안 됐다. ★★CI 도 ★같은 꼴로 ★빨강이 된다
       (★`npm test` 는 ★CI 에서 ★`on: push: tags:'v*'` 로만 ★도니 ★★★태그 미는 자리에서 ★처음 ★나타난다).

   ★★★U1 머리말의 ★규율(⛔「손으로 ★다시 타이핑하지 ★않는다 — ★베끼면 ★화석이 된다」)은 ★★그대로 ★산다:
     ⒜ ★사본은 ★★«바이트째»다(타이핑 ★0) · ★이름에 ★원본 ★해시 앞 8자를 ★박았다(`tests/fixtures/` 선례 = `grid-cell-border-edges-366fd826.json`)
     ⒝ ★★★그리고 ★★화석화를 ★★«재는 자»를 ★★같이 세웠다 — ★아래 `PRE-SIAN` 이
        ★★지디 홈에 ★원본이 ★있으면 ★★★바이트가 ★같은지 ★단언한다 ⇒ ★★시안이 ★9판으로 가면 ★★★내 맥에서 ★빨강이 된다.
        ★남의 맥·CI 에는 ★원본이 ★없으니 ★그 칸만 ★건너뛴다(★나머지 ★15 칸은 ★전부 ★돈다). */
const SIAN = fileURLToPath(new URL('../fixtures/sian-08-text-freetransform-v8-e1338e08.html', import.meta.url));
/* ★★원본(지디 맥에만 있다) — ⛔검사의 ★참값이 ★아니다. ★★«사본이 늙었나»를 ★재는 ★데만 쓴다. */
const SIAN_LIVE = path.join(os.homedir(), '.gd-work/team-lead/sian/sian-08-text-freetransform-v8.html');

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
test('PRE ★★전제 — ★제품 `js/fx/homography.js` 가 ★★있다(★제품이 ★섰다 · 261022)', () => {
  assert.ok(fs.existsSync(PROD),
    `⛔제품이 ★없다 — ★이 아래 ★일곱 벌(P-1·P-2·D_* 셋·matrix3d_shape·edge_nonlinear)은 ★★제품을 잰다.
   ⇒ ★이 빨강은 ★「제품이 사라졌다」이지 ★「셈이 틀렸다」가 ★아니다(★REF-* 는 ★시안만 재니 ★그대로 ★초록이다).
   ★기대 자리: ${PROD}`);
  /* ★★전제의 ★나머지 반 — ★제품을 ★ESM 으로 ★싣을 수 있어야 한다(★머리말의 ★그 shim).
     ⛔여기서 `import` 하지 ★않는다 — ★그 자리는 ★P-1 이다. ★여기선 ★shim 의 ★존재만 ★집어 둔다. */
  const shim = fileURLToPath(new URL('../../js/fx/package.json', import.meta.url));
  assert.ok(fs.existsSync(shim),
    `⛔ESM shim 이 ★없다 — ★P-1 이 ★SyntaxError 로 ★빨강이 된다(★머리말 참조): ${shim}`);
  const shimJson = JSON.parse(fs.readFileSync(shim, 'utf8'));
  assert.equal(shimJson.type, 'module', '⛔shim 의 `type` 이 `module` 이 ★아니다');
  /* ★★까닭 없는 파일은 ★다음 사람이 ★지운다(261022 지디 조건 ⑴) — JSON 이라 주석을 못 쓰니 `_why` 키로.
     ★이 줄이 ★그 규칙을 ★집행하는 자다. ⛔「필요해서 만들었다」로만 두지 마라. */
  assert.ok(typeof shimJson._why === 'string' && shimJson._why.length > 80,
    `⛔shim 에 ★까닭(`+"`_why`"+`)이 ★없다/너무 짧다 — 잰 값 ${JSON.stringify(shimJson._why)}`);
  assert.match(shimJson._why, /rc=0/, '⛔`_why` 에 ★잰 값이 ★없다');
});

/* ★★★전제의 ★남은 반 — ★★★«사본이 ★원본과 ★같은가». ★이 칸이 ★★화석화를 ★재는 자다.
   ★원본이 ★없는 맥(남의 맥·CI)에서는 ★★★건너뛴다 — ★★범위 밖은 ★FAIL 이 아니라 ★SKIP 이다.
   ⛔이 칸을 ★지우면 ★시안이 ★9판으로 바뀌어도 ★★아무도 ★모른다(★U1 머리말이 ★막으려 한 ★그 화석). */
test('PRE-SIAN ★★전제 — ★사본이 ★★원본과 ★«바이트째» 같다(원본 없는 맥은 ★건너뛴다)', (t) => {
  assert.ok(fs.existsSync(SIAN), `⛔레포 안 ★사본이 ★없다 — ★★REF-* 와 ★P-2 가 ★ENOENT 로 ★죽는다: ${SIAN}`);
  if (!fs.existsSync(SIAN_LIVE)) {
    t.skip(`원본이 ★이 맥에 ★없다(★지디 맥에만 있다) ⇒ ★★사본 대조는 ★범위 밖. 사본은 ★있다: ${SIAN}`);
    return;
  }
  const a = fs.readFileSync(SIAN, 'utf8'), b = fs.readFileSync(SIAN_LIVE, 'utf8');
  assert.equal(a.length, b.length,
    `⛔사본이 ★늙었다 — ★길이가 ★다르다(사본 ${a.length} · 원본 ${b.length}).
   ⇒ ★원본을 ★다시 떠서 ★★★«새 해시 이름»으로 ★넣고 ★위 ${'`'}SIAN${'`'} 의 ★이름도 ★같이 ★고쳐라.`);
  assert.equal(a, b, '⛔사본이 ★늙었다 — ★길이는 같은데 ★내용이 ★다르다(위와 같은 처방)');
  /* ★★음성대조 — ★이 칸이 ★«항등식»이 아님을 ★그 자리에서 ★보인다.
     ⛔없으면 ★「같은 파일을 ★두 번 읽어 ★비교했다」와 ★구분이 ★안 된다(261004 의 그 병). */
  assert.notEqual(SIAN, SIAN_LIVE, '⛔두 경로가 ★같다 — ★대조가 ★자기 자신을 ★재고 있다');
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

/* ══ ★★★여기부터는 ★제품을 ★잰다 — ★제품이 ★없으면 ★여기 ★전부가 ★빨강이다(★`PRE` 가 ★그 까닭을 ★말한다) ══ */

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
/* ══════════════════════════════════════════════════════════════════════════
   ★★★U1 의 ★나머지 넷 — ★`normalizeCorners` · `boxFromCorners` · `cornerMatrix3d` · `edgePointAt`.
   ★참값은 ★시안 8판 `draw()` 의 ★그 식이다(⛔수식을 ★바꾸지 ★않았다 — ★다섯 표본으로 ★검산된 것).
   ══════════════════════════════════════════════════════════════════════════ */

/** ★제품을 ★싣는다 — ⛔최상위 `await import` 로 두지 ★마라:
 *  ★제품이 ★없으면 ★파일 ★전체가 ★죽어 ★REF-* 의 ★«자가 산다»까지 ★같이 ★꺼진다(= ★자를 ★잃는다). */
async function loadProd() {
  assert.ok(fs.existsSync(PROD), `⛔제품이 없다 — ${PROD}`);
  return import(PROD);
}

/* ★네 꼴 — ★발주 ⑤ 절의 ★그 넷.
   ⛔「왼·위로 나감」을 ★빼지 마라: ★`D_contain_neg` 에서 ★★빨강이 ★나오는 ★«유일한» 꼴이다
     (★261022 ★실측 — ★정규화를 걷었을 때 ★나머지 ★셋은 ★그대로 ★초록이다). */
const SHAPES = [
  ['변형 0',         [[0,0],[200,0],[200,60],[0,60]]],
  ['왼·위로 나감',   [[-30,-20],[180,-10],[200,60],[-10,70]]],
  ['모서리 하나 밖', [[0,0],[260,0],[200,60],[0,60]]],
  ['사다리꼴',       [[40,0],[160,0],[200,60],[0,60]]],
];
/* ★★자 ★하나 — ★`D_contain_x4` 와 ★`D_contain_neg` 가 ★★«같은 자»를 쓴다(★정규화만 ★걷는다). */
const contained = (D) => D.every(([x, y]) => x >= 0 && y >= 0);

test('D_contain_x4 ★★네 꼴에서 ★`normalizeCorners` 의 ★D 가 ★전부 ★0 이상', async () => {
  const { normalizeCorners } = await loadProd();
  assert.equal(SHAPES.length, 4, `⛔이름이 x4 인데 꼴이 ${SHAPES.length} 이다 — ★제목이 ★거짓이 된다`);
  const red = [];
  for (const [name, C] of SHAPES) {
    const { D, mnx, mny } = normalizeCorners(C);
    if (!contained(D)) red.push(`${name} ⇒ ${JSON.stringify(D)}`);
    /* ★「0 이상」만으로는 ★★«안 당기고 그대로 돌려줘도» 세 꼴이 초록이다 ⇒ ★최소가 ★«정확히 0» 까지 ★잠근다. */
    assert.equal(Math.min(...D.map(q => q[0])), 0, `⛔${name}: 당긴 뒤 x 의 최소가 0 이 아니다`);
    assert.equal(Math.min(...D.map(q => q[1])), 0, `⛔${name}: 당긴 뒤 y 의 최소가 0 이 아니다`);
    assert.equal(mnx, Math.min(...C.map(q => q[0])), `⛔${name}: mnx 가 C 의 x 최소가 아니다`);
    assert.equal(mny, Math.min(...C.map(q => q[1])), `⛔${name}: mny 가 C 의 y 최소가 아니다`);
  }
  assert.deepEqual(red, [], `⛔음수가 남은 꼴: ${red.join(' · ')}`);
});

test('D_contain_neg ★★음성대조 — ★정규화를 ★걷으면(D=C) ★「왼·위로 나감」 ★한 꼴에서만 ★빨강', async () => {
  const { normalizeCorners } = await loadProd();
  /* ★★★같은 자(`contained`)를 ★그대로 쓰고 ★★«정규화만» ★걷는다.
     ⇒ ★여기서 ★빨강이 ★나와야 ★위 `D_contain_x4` 의 ★초록이 ★★«안 재고 있다»와 ★구분된다. */
  const redRaw  = SHAPES.filter(([, C]) => !contained(C)).map(([n]) => n);
  const redNorm = SHAPES.filter(([, C]) => !contained(normalizeCorners(C).D)).map(([n]) => n);
  assert.deepEqual(redRaw, ['왼·위로 나감'],
    `⛔걷었을 때 ★빨강 명부가 ★다르다 — ${JSON.stringify(redRaw)} (★0 건이면 ★이 자는 ★아무것도 ★안 잡는다)`);
  assert.deepEqual(redNorm, [], `⛔정규화를 ★했는데도 ★빨강 — ${JSON.stringify(redNorm)}`);
});

test('D_zero_same_as_base ★★변형 0 이면 `boxFromCorners` 가 ★바탕(W+OX, H+OY)과 ★같다', async () => {
  const { normalizeCorners, boxFromCorners, homography, cornerMatrix3d } = await loadProd();
  const W = 200, H = 60;
  const { D } = normalizeCorners([[0,0],[W,0],[W,H],[0,H]]);
  for (const [OX, OY] of [[0,0],[4,2],[12,7]]) {
    const box = boxFromCorners(D, W, H, OX, OY);
    assert.equal(box.w, W + OX, `⛔OX=${OX}: 폭이 ★바탕과 ★다르다 — 잰 값 ${box.w} vs 바탕 ${W + OX}`);
    assert.equal(box.h, H + OY, `⛔OY=${OY}: 높이가 ★바탕과 ★다르다 — 잰 값 ${box.h} vs 바탕 ${H + OY}`);
  }
  /* ★★★이것이 ★「켜기 ★전인데 ★`matrix(0.952,0,0,0.795)`」 결함을 ★잡는 자다 —
     ★변형 0 에서 ★행렬은 ★★단위행렬이어야 한다(★배율 ★1 · ★원근 ★0 · ★평행이동 ★0). */
  const h = homography([[0,0],[W,0],[W,H],[0,H]], D);
  assert.ok(h, '⛔변형 0 인데 못 풀었다');
  assert.deepEqual(h, [1,0,0, 0,1,0, 0,0,1],
    `⛔변형 0 인데 ★단위행렬이 ★아니다 — 잰 값 ${JSON.stringify(h)}`);
  assert.equal(cornerMatrix3d(h), 'matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)',
    `⛔변형 0 의 ★CSS 가 ★단위가 ★아니다 — 잰 값 ${cornerMatrix3d(h)}`);
});

test('matrix3d_shape ★★`cornerMatrix3d` 가 ★16 값 · ★열 우선 · ★h31=m[3] · h32=m[7]', async () => {
  const { homography, cornerMatrix3d } = await loadProd();
  const h = homography(SRC, [[40,0],[160,0],[200,60],[0,60]]);
  assert.ok(h, '⛔전제 — 사다리꼴이 풀려야 한다');
  /* ★★전제 — ★h12 ≠ h21 이어야 ★★«열 우선»과 ★«행 우선»이 ★갈린다(★같으면 ★이 표본으로는 ★못 잰다). */
  assert.notEqual(h[1], h[3], `⛔전제 — h12 와 h21 이 같다(${h[1]}) ⇒ ★표본을 ★바꿔라`);
  const s = cornerMatrix3d(h);
  assert.match(s, /^matrix3d\(/, `⛔'matrix3d(' 로 시작하지 않는다 — ${s}`);
  /* ⛔`s.match(/-?[\d.e+-]+/g)` 로 파싱하지 ★마라 — ★`matrix3d` 의 ★`3` 을 ★숫자로 ★먹는다.
     ★261022 ★실측: ★그 regex 는 ★★17 개를 내고 ★★첫 칸이 ★`'3'` 이다 ⇒ ★★괄호 ★«안»만 `split(',')`.
     ★아래 한 줄이 ★그 덫이 ★아직 ★살아 있음을 ★잰다(★썩으면 ★이 주석을 ★고쳐라). */
  const naive = s.match(/-?[\d.e+-]+/g);
  assert.equal(naive[0], '3', `⛔덫이 ★썩었다 — 이제 ★첫 칸이 ${JSON.stringify(naive[0])} 다. ★위 ⛔주석을 ★고쳐라`);
  assert.equal(naive.length, 17, `⛔덫이 ★썩었다 — ★그 regex 가 ★${naive.length} 개를 낸다(★17 이었다)`);
  const m = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')).split(',').map(v => Number(v.trim()));
  assert.equal(m.length, 16, `⛔16 값이 ★아니다 — ${m.length} 개 · ${s}`);
  assert.ok(m.every(Number.isFinite), `⛔숫자가 ★아닌 칸이 있다 — ${s}`);
  /* ★★열 우선 — 1열 h11,h21,0,h31 · 2열 h12,h22,0,h32 · 3열 0,0,1,0 · 4열 h13,h23,0,1.
     ⛔`deepEqual` 을 ★쓰지 않는다: ★`-0` 과 ★`0` 을 ★가려 ★엉뚱한 빨강이 난다. */
  const WANT = [h[0], h[3], 0, h[6],  h[1], h[4], 0, h[7],  0, 0, 1, 0,  h[2], h[5], 0, 1];
  const NAME = ['m[0]=h11','m[1]=h21','m[2]=0','m[3]=h31', 'm[4]=h12','m[5]=h22','m[6]=0','m[7]=h32',
                'm[8]=0','m[9]=0','m[10]=1','m[11]=0', 'm[12]=h13','m[13]=h23','m[14]=0','m[15]=1'];
  for (let i = 0; i < 16; i++) {
    assert.equal(m[i], WANT[i], `⛔${NAME[i]} 자리가 ★다르다 — 잰 값 ${m[i]} vs 기대 ${WANT[i]} · ${s}`);
  }
  assert.notEqual(m[7], 0,
    `⛔사다리꼴인데 ★원근 칸(m[7]=h32)이 ★0 이다 — ★affine 으로 ★때웠다 · ${s}`);
});

test('edge_nonlinear ★★사다리꼴에서 `edgePointAt(h,"n",1/3)` 이 ★두 모서리의 ★선형보간과 ★다르다', async () => {
  const { homography, edgePointAt } = await loadProd();
  const W = 200, H = 60;
  /* ★★★표본을 ★이렇게 ★고른 ★까닭(261022 ★실측) — ★위아래 ★대칭 사다리꼴 `[[40,0],[160,0],[200,60],[0,60]]`은
     ★h31 이 ★★0 이라 ★★«위 변»이 ★그대로 ★선형이다(★gap = ★0 이었다 ⇒ ★그 표본으로는 ★못 잰다).
     ⇒ ★`n` 변이 ★휘려면 ★★좌우가 ★좁아져야 한다(★여기서 ★h31 = ★5.0e-3 · ★gap = ★33.4 px). */
  const dst = [[0,0],[200,15],[200,45],[0,60]];
  const h = homography([[0,0],[W,0],[W,H],[0,H]], dst);
  assert.ok(h, '⛔전제 — 풀려야 한다');
  assert.notEqual(h[6], 0, `⛔전제 — h31 이 0 이면 ★위 변은 ★선형이다(★이 표본으로는 ★못 잰다)`);
  const p   = edgePointAt(h, 'n', 1/3, W, H);
  const lin = [dst[0][0] + (dst[1][0] - dst[0][0]) / 3, dst[0][1] + (dst[1][1] - dst[0][1]) / 3];
  const gap = Math.hypot(p[0] - lin[0], p[1] - lin[1]);
  assert.ok(gap > 1,
    `⛔★선형보간과 ★같다 — ★원근이 ★안 걸렸다(잰 값 gap=${gap} · p=${JSON.stringify(p)} lin=${JSON.stringify(lin)})`);
  /* ★★위 `p` 는 ★★실제 판의 ★W=200 · H=60 으로 쟀다 — ⛔`1` 로 재면 ★우리 판을 ★안 재는 것이다.
     ★그 사실을 ★여기서 ★단언한다(★「200×60 에서」라 적었으면 ★그 값이 ★섰음을 ★같이 잠근다). */
  assert.equal(W, 200, '⛔전제 — W 가 200 이 아니다');
  assert.equal(H, 60,  '⛔전제 — H 가 60 이 아니다');
  assert.notEqual(W, 1, '⛔W 가 1 이면 ★우리 판(수백 px)을 ★안 재고 있다');

  /* ★★★음성대조 — ★W·H 를 ★안 넘기면 ★★«던진다»(261022 지디 ㉠).
     ⛔기본값(W=1·H=1)을 ★되돌리지 마라: ★던지지 않고 ★★«그럴듯한 틀린 좌표»가 나온다
       — ★한 판 그렇게 있었고 ★걷었다. ★이 줄이 ★그 되돌림을 ★막는 자다. */
  assert.throws(() => edgePointAt(h, 'n', 1/3), /W·H 가 필요하다/,
    '⛔W·H 없이 불렀는데 ★안 던졌다 — ★기본값이 ★살아 있다(조용히 틀린 값)');
  assert.throws(() => edgePointAt(h, 'n', 1/3, W), /W·H 가 필요하다/,
    '⛔H 를 빼먹었는데 ★안 던졌다');
  assert.throws(() => edgePointAt(h, 'N', 1/3, W, H), /side 는/,
    '⛔없는 변 이름인데 ★안 던졌다');
  assert.equal(edgePointAt.length, 5,
    `⛔다섯 칸 서명이 ★아니다 — arity ${edgePointAt.length} (★기본값을 ★달면 ★이 수가 ★줄어든다)`);
  /* ★★휘는 것은 ★«사이»다 — ★t=0·1 은 ★여전히 ★그 모서리. ★이 줄이 ★n·e·s·w 의 ★순서도 ★같이 ★잠근다. */
  for (const [side, i0, i1] of [['n',0,1],['e',1,2],['s',2,3],['w',3,0]]) {
    const a = edgePointAt(h, side, 0, W, H), b = edgePointAt(h, side, 1, W, H);
    assert.ok(Math.hypot(a[0]-dst[i0][0], a[1]-dst[i0][1]) < 1e-9,
      `⛔'${side}' 변의 t=0 이 ★모서리 ${i0} 가 ★아니다 — ${JSON.stringify(a)} vs ${JSON.stringify(dst[i0])}`);
    assert.ok(Math.hypot(b[0]-dst[i1][0], b[1]-dst[i1][1]) < 1e-9,
      `⛔'${side}' 변의 t=1 이 ★모서리 ${i1} 가 ★아니다 — ${JSON.stringify(b)} vs ${JSON.stringify(dst[i1])}`);
  }
});
