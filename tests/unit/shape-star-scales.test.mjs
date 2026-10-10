/* shape-star-scales.test.mjs — ★b2 의 ★«개별 크기» 축 (현빈 1010t1b2 · 지디 판정 ⑧)
 *
 * ★현빈 원문: 「…★모서리 핸들로 ★크기조절이 ★개별로 가능하게 해줄 것」
 *
 * ★★지디 판정 ⑧(2026-10-10) — ★★상태는 ★`dataset` 에 둔다. ★그 판정이 ★선 까닭:
 *   ★내 측정: ★points 는 ★저장·복원이 ★★된다(proj.json 에 글자 · star 는 dynamic 아님 · 로드 재생성 0건)
 *   ★★그런데 ★`_applyStarGeom` 이 ★사람이 ★아무 칸을 만질 때마다 ★dataset 에서 ★points 를 ★다시 만든다
 *   ⇒ ★★baked scale 은 ★«패널 한 번 만지면» ★죽는다 ⇒ ★★«저장되나»와 ★«살아남나»는 ★다른 물음이다
 *   ⇒ ★★㉠ 기하는 ★points · ★★㉡ 상태는 ★dataset (★둘을 ★갈랐다)
 *
 * ★★이 파일은 ★★«상태 → points» ★한 축이다. ⛔«모서리 핸들로 끌 수 있다»는 ★★안 잰다(DOM 몫 · 창 닫힘).
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const { mkTmpRoot } = require('./_tmproot.js');   /* ★임시 루트의 ★임자 — ★만들기·치우기를 ★그 자가 쥔다 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const M = await (async () => {
  const fs = (await import('node:fs')).default;
  const os = (await import('node:os')).default;
  const { pathToFileURL } = await import('node:url');
  /* ★★임시 루트는 ★★레포의 ★공용 자가 ★만든다 — ★`tests/unit/_tmproot.js` ★`mkTmpRoot`
     ⇒ ★★그 자가 ★pid 우산 ＋ ★죽은 실행 회수 ＋ ★디스크 사전게이트 ＋ ★종료훅을 ★다 쥔다
     ⇒ ★★★그래서 ★부르는 쪽이 ★지울 필요가 ★★없다. ⛔`rmSync` 를 ★여기 ★두지 ★마라 */
  const tmp = mkTmpRoot('gd-star-sc-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'm.js')).href);
  /* ⛔★여기 있던 ★`fs.rmSync(tmp, …)` 와 ★그 ★변수경로 가드를 ★★둘 다 ★뺐다(2026-10-10 지디 ⑴⑵).
     ★까닭: ★`mkTmpRoot` 가 ★★치우기를 ★쥔다 ⇒ ★★★지울 일이 ★없으니 ★가드도 ★뜻이 없다.
     ★★«가드를 더하는 것»보다 ★★«지우는 줄을 ★없애는 것»이 ★낫다 — ★지디 ⒝「백업은 더하기다」와 같은 결. */
  return m;
})();
const { clampStarScale, starScaleList, starScalesAttr, starPointsAt, starPointsList,
        starPoints, STAR_SCALE_MIN, STAR_SCALE_MAX, STAR_SCALE_DEFAULT,
        STAR_VB_W, STAR_VB_H, STAR_MIN, STAR_MAX, STAR_INNER_MIN, STAR_INNER_MAX } = M;
const RAW = readSrc(ROOT, 'js', 'shape-star.js');
const PANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-shape.js'));

/* ★★★㉠ 의 ★분모를 ★«패널»에서 ★★«레포 전수»로 ★올린다 (지디 판정 ⑩ ⒜ · 2026-10-10)
 * ★지디: 「★네가 ★«패널의 ★손 split/join ★0건»이라 적었다 ⇒ ★★창이 ★★패널이다
 *   ⇒ ★★«셋째 파일»이 ★그 dataset 을 ★손으로 쪼개는 날 ★0건이 ★그대로 ★유지된다
 *   ⇒ ★처방: ★★«정의 자리에서 세라» — ★읽는 자리 ★전수를 세고 ★명부 ★밖 ★0건을 ★단언해라
 *   ⛔등호 금지 — ★「명부 ⊇ 실패집합 ＋ ★명부 밖 ★0건」 꼴로. ★∅가 ★일치로 ★둔갑한다」 */
const JS_FILES = (() => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) walk(q);
      else if (e.name.endsWith('.js')) out.push(q);
    }
  };
  walk(path.join(ROOT, 'js'));
  return out;
})();
/** 주석을 ★떼고 ★읽는다 — ★주석의 ★예시가 ★측정값이 되는 것을 ★막는다(261007 교훈). */
const JS_SRC = JS_FILES.map((f) => [path.relative(ROOT, f), stripComments(fs.readFileSync(f, 'utf8'))]);

/** ★«그 dataset 문자열에 ★바로 붙는 ★문자열 메서드» — ★★손 파싱의 ★자. ★한 자리에만 적는다.
 *  ★사이에 ★허용하는 것 = ★`)` ★여러 개 · ★`|| '…'` 한 벌 (★그 둘이 ★흔한 ★감싸기다)
 *  ⛔`f(x, n).slice(` 처럼 ★★«결과»에 붙는 것은 ★안 잡는다 — ★그게 ★첫 꼴의 ★거짓양성이었다 */
const HAND_PARSE_RE = () => new RegExp(
  'dataset\\.star(?:Colors|Scales)' +
  "(?:\\s*\\|\\|\\s*'[^']*')?" +
  '\\s*\\)*\\s*\\.(split|replace)\\(', 'g');
/* ★중심은 ★소스에서 뽑는다 — ⛔수를 손으로 베끼지 않는다(이 파일의 선례와 같은 규율) */
const CX = Number(RAW.match(/const CX = ([\d.]+)/)[1]);
const CY = Number(RAW.match(/, CY = ([\d.]+)/)[1]);
const pts = (s) => s.trim().split(/\s+/).map(p => p.split(',').map(Number));

test('S0 ★전제 — ★범위가 10~100 이고 ★기본이 100 이다 (⛔재기 전에 단언)', () => {
  assert.strictEqual(STAR_SCALE_MIN, 10, `잰 값: ${STAR_SCALE_MIN}`);
  assert.strictEqual(STAR_SCALE_MAX, 100, `잰 값: ${STAR_SCALE_MAX}`);
  assert.strictEqual(STAR_SCALE_DEFAULT, 100, `잰 값: ${STAR_SCALE_DEFAULT}`);
});

test('S1 ★미설정 = ★null · ★100 도 ★null 로 접힌다(=배율 없음)', () => {
  for (const v of [undefined, null, '']) {
    assert.strictEqual(clampStarScale(v), null, `★${JSON.stringify(v)} 가 null 이 아니다`);
  }
  /* ★★★내 ★첫 수는 ★`'  '`(공백)도 ★null 이라 걸었고 ★★틀렸다 — ★실측 ★10 이 나온다.
     ★까닭 = ★이 레포의 ★형제 clamp 들(`clampStarInner`·`clampStarGap`·`clampStarRating`)이
       ★전부 ★`v === ''` 로 ★재고 ★★trim 하지 ★않는다 ⇒ ★공백은 ★Number('  ')=0 → ★하한으로 조인다.
     ⇒ ★★`clampStarScale` 만 ★trim 하게 ★바꾸면 ★★형제와 ★어긋난다 ⇒ ★★관례를 ★따랐다.
     ⇒ ★★그리고 ★참 경로는 ★안전하다 — ★목록 함수가 ★칸마다 ★먼저 trim 한다(아래가 그것을 잰다). */
  assert.strictEqual(clampStarScale('  '), STAR_SCALE_MIN,
    `★공백은 ★형제 관례대로 ★하한이 된다 (잰 값: ${clampStarScale('  ')})`);
  assert.strictEqual(starScaleList(' , , ', 3), null,
    '★목록은 ★칸마다 ★trim 해서 ★공백을 ★미설정으로 접어야 한다');
  assert.strictEqual(starScaleList(undefined, 5), null, '★미설정인데 배열이 나왔다');
  /* ★100 만 든 목록은 ★«배율 없음»과 ★같다 — ⛔안 접으면 ★옛 길을 ★안 타서 ★바이트가 깨진다 */
  assert.strictEqual(starScaleList('100,100,100', 3), null, '★100 목록이 ★미설정으로 안 접혔다');
  assert.strictEqual(starScaleList(',,,', 5), null, '★빈 칸 목록이 ★미설정으로 안 접혔다');
});

test('S2 ★클램프 — ★10 아래·100 위는 ★조인다 · ★비수는 ★null', () => {
  assert.strictEqual(clampStarScale(1), STAR_SCALE_MIN, `잰 값: ${clampStarScale(1)}`);
  assert.strictEqual(clampStarScale(999), STAR_SCALE_MAX, `잰 값: ${clampStarScale(999)}`);
  assert.strictEqual(clampStarScale('abc'), null, '★비수가 null 이 아니다');
  assert.strictEqual(clampStarScale(63.4), 63, '★정수로 안 접혔다');
});

test('S3 ★★★㉣ ★옛 바이트 보존 — ★배율 미설정이면 ★points 가 ★한 글자도 ★안 바뀐다', () => {
  for (let n = STAR_MIN; n <= STAR_MAX; n++) {
    for (const inner of [null, 40, 48]) {
      for (const g of [0, 15, -40, 200]) {
        for (const i of [0, 1, 3]) {
          const was = starPointsAt(n, i, g, inner);              // ★배율 인자 ★없이(옛 서명)
          const now = starPointsAt(n, i, g, inner, undefined);   // ★미설정으로 ★명시
          assert.strictEqual(now, was, `★n${n} i${i} g${g} 에서 ★미설정이 ★옛 값과 다르다`);
          const at100 = starPointsAt(n, i, g, inner, 100);       // ★100 = ★배율 없음
          assert.strictEqual(at100, was, `★n${n} i${i} g${g} 에서 ★100 이 ★옛 값과 다르다`);
        }
      }
    }
  }
  /* ★목록 쪽도 — ★미설정이면 ★옛 한 벌 그대로 */
  assert.deepStrictEqual(starPointsList(5, 3, 15, 48, undefined), starPointsList(5, 3, 15, 48),
    '★목록이 ★미설정에서 ★옛 값과 다르다');
});

test('S4 ★★★㉡ ★양성대조 — ★배율 키를 ★«안 싣으면» ★크기가 ★참으로 ★안 바뀐다', () => {
  /* ★지디 ㉡ — ⛔없으면 ★«먹는다»와 ★«기본값이라 같아 보인다»가 ★구분 안 된다 */
  const WITHOUT = starPointsList(5, 3, 15, 48, undefined);
  const WITH    = starPointsList(5, 3, 15, 48, ',50');   // ★1번 별만 ★절반
  assert.notDeepStrictEqual(WITH, WITHOUT,
    '★★배율 키를 실었는데도 ★같은 points 다 — ★이 검사는 ★아무것도 안 재고 있다');
  assert.strictEqual(WITH[0], WITHOUT[0], '★0번 별은 ★안 건드려야 한다');
  assert.notStrictEqual(WITH[1], WITHOUT[1], '★1번 별이 ★안 바뀌었다');
  assert.strictEqual(WITH[2], WITHOUT[2], '★2번 별은 ★안 건드려야 한다');
});

test('S5 ★배율의 ★중심이 ★«그 별의 중심»이다 — ⛔틀 원점이 아니다', () => {
  /* ★★★내 ★첫 수는 ★«바운딩박스 ★중점이 ★불변»이었고 ★★틀렸다 —
     ★별의 ★bbox 중점(≈90.0)은 ★★기하 중심(CY=98.66)이 ★아니다(위 꼭지 하나 vs 아래 둘).
     ⇒ ★CY 에서 ★줄이면 ★bbox 중점은 ★★CY 쪽으로 ★당겨지는 것이 ★맞다(90.00 → 97.79).
     ⇒ ★★그래서 ★참 불변은 ★«중심이 ★(CX＋dx, CY) 다»이고, ★그것은 ★★점마다 ★비로 ★재야 한다.
     ★★이 레인에서 ★«고친 뒤 ★첫 빨강이 ★시험 설계의 흠»이 ★두 번째다(앞 = W7 호출 수). */
  for (const i of [0, 1, 4]) {
    for (const s of [10, 50, 99]) {
      const k = s / 100;
      const cx = CX + (STAR_VB_W + 15) * i;         // gap 15 · i 번째 별의 중심
      const base = pts(starPointsAt(5, i, 15, 48));
      const scaled = pts(starPointsAt(5, i, 15, 48, s));
      assert.strictEqual(scaled.length, base.length, `★i${i} s${s}: 좌표쌍 수가 변했다`);
      base.forEach(([x0, y0], j) => {
        const [x1, y1] = scaled[j];
        /* ★(점 − 중심) 이 ★정확히 ★k 배여야 한다 — ★중심이 ★움직이면 ★여기서 ★어긋난다 */
        assert.ok(Math.abs((x1 - cx) - (x0 - cx) * k) < 0.02,
          `★i${i} s${s} 점${j}: ★가로가 ★중심에서 ★k 배가 아니다 (${(x1 - cx).toFixed(2)} vs ${((x0 - cx) * k).toFixed(2)})`);
        assert.ok(Math.abs((y1 - CY) - (y0 - CY) * k) < 0.02,
          `★i${i} s${s} 점${j}: ★세로가 ★중심에서 ★k 배가 아니다 (${(y1 - CY).toFixed(2)} vs ${((y0 - CY) * k).toFixed(2)})`);
      });
    }
  }
  /* ★★그리고 ★★«틀 원점에서 줬다»면 ★잡히나 — ★양성대조: 원점 기준이면 ★중심이 ★움직인다 */
  const i = 2, s = 50, k = 0.5, cx = CX + (STAR_VB_W + 15) * i;
  const scaled = pts(starPointsAt(5, i, 15, 48, s));
  const originBased = pts(starPointsAt(5, i, 15, 48)).map(([x, y]) => [x * k, y * k]);
  assert.notDeepStrictEqual(scaled.map(p => p.map(v => Math.round(v))),
    originBased.map(p => p.map(v => Math.round(v))),
    '★★중심 기준과 ★원점 기준이 ★같은 값이다 — ★이 칸이 ★구분을 ★못 한다');
  const midScaled = scaled.reduce((a, [x]) => a + x, 0) / scaled.length;
  assert.ok(Math.abs(midScaled - cx) < 1.0,
    `★줄인 별이 ★제 칸에 ★안 있다 — ★평균 x ${midScaled.toFixed(1)} vs ★중심 ${cx}`);
});

test('S6 ★배율만큼 ★작아진다 — ★폭·높이가 ★비례한다', () => {
  const span = (arr) => {
    const xs = arr.map(p => p[0]), ys = arr.map(p => p[1]);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  const [w1, h1] = span(pts(starPointsAt(5, 0, 0, 48)));
  for (const s of [10, 25, 50, 75, 99]) {
    const [w2, h2] = span(pts(starPointsAt(5, 0, 0, 48, s)));
    assert.ok(Math.abs(w2 / w1 - s / 100) < 0.005, `★s${s}: ★폭 비 ${(w2 / w1).toFixed(4)}`);
    assert.ok(Math.abs(h2 / h1 - s / 100) < 0.005, `★s${s}: ★높이 비 ${(h2 / h1).toFixed(4)}`);
  }
});

test('S7 ★★★상한 100 이 ★기하에서 나왔다 — ★전수에서 ★viewBox 를 ★안 넘는다', () => {
  /* ★★이 칸이 ★상한의 ★«까닭»이다. ⛔내가 고른 수가 ★아니다.
     ★실측 2026-10-10: ★세로가 viewBox 를 안 넘는 ★최대 배율 = ★1.0075 (★최악 n=4 · inner 미설정)
     ⇒ ★★그 내림이 ★100 이다. ★★이 칸이 빨개지면 ★상한의 근거가 ★사라진 것이다. */
  for (let n = STAR_MIN; n <= STAR_MAX; n++) {
    for (const inner of [null, STAR_INNER_MIN, 40, 48, 70, STAR_INNER_MAX]) {
      for (const s of [STAR_SCALE_MIN, 50, STAR_SCALE_MAX]) {
        pts(starPointsAt(n, 0, 0, inner, s)).forEach(([x, y]) => {
          assert.ok(y >= 0 && y <= STAR_VB_H,
            `★n${n} inner${inner} s${s}: ★y ${y} 가 ★viewBox(0~${STAR_VB_H}) 를 ★넘는다`);
        });
      }
    }
  }
  /* ★★그리고 ★상한 ★바로 위는 ★참으로 ★넘는다 — ⛔안 넘으면 ★상한이 ★필요 없다는 뜻이다
     ★(★n=4 · inner 미설정이 ★그 최악이다) */
  const over = pts(starPointsAt(4, 0, 0, null, 100)).some(([, y]) => y > STAR_VB_H * 0.995);
  assert.ok(over, '★★상한 100 에서도 ★여유가 많다 — ★상한의 ★근거(1.0075)가 ★안 맞는다');
});

test('S8 ★왕복 — ★목록 → 문자열 → ★목록 · ★100·빈칸은 ★버린다', () => {
  for (const l of [[null, 50, null], [25], [null, null, 75, null, 10]]) {
    const attr = starScalesAttr(l);
    assert.deepStrictEqual(starScaleList(attr, l.length), l,
      `★왕복이 깨졌다 — ${JSON.stringify(l)} → ${JSON.stringify(attr)}`);
  }
  assert.strictEqual(starScalesAttr([100, 100]), null, '★100 만 든 목록이 null 이 아니다');
  assert.strictEqual(starScalesAttr([null, null]), null, '★전부 null 인 목록이 null 이 아니다');
  assert.strictEqual(starScalesAttr([50, null, null]), '50', `★꼬리를 안 버렸다: ${starScalesAttr([50, null, null])}`);
});

test('S9 ★★★«꼴을 ★읽는 자»와 ★«그리는 자»가 ★각각 ★하나다 (지디 ⑧ 의 ★조건 — ★정밀화했다)', () => {
  /* ★★지디 조건 원문: 「⛔단 조건: ★`_applyStarGeom` ★한 곳만 ★그 둘을 ★읽게 해라
   *   ⇒ ★읽는 자가 ★둘이 되면 ★★그때 ★명부가 ★참으로 ★둘이 된다」
   * ★★★그 조건을 ★«occurrence 세기»로 ★걸었다가 ★★1010t1b2 ★입구(UI)에서 ★빨개졌다.
   *   ★까닭: ★입구가 ★⒜ 스와치에 ★«지금 색»을 ★보이려 ★읽고 ⒝ ★그 index 만 갈려고 ★읽는다
   *     ⇒ ★★둘 다 ★«그리는» 읽기가 ★아니다. ★★occurrence 는 ★그 차이를 ★못 센다.
   * ★★★그래서 ★조건을 ★★«정밀화»했다 — ⛔느슨하게 ★한 것이 ★아니다. ★두 축으로 ★쪼갰다:
   *   ㉠ ★★«꼴(문자열)을 ★해석하는 자»가 ★★`js/shape-star.js` ★하나다
   *      ⇒ ★패널이 ★손으로 ★`split`/`join` 하면 ★★그때 ★명부가 ★둘이 된다 — ★그것을 ★막는다
   *   ㉡ ★★«그리는 자»가 ★★`_applyStarGeom` ★하나다
   *      ⇒ ★`starPointsList`·`starFillsFor` 가 ★그 함수 ★밖에서 ★불리면 ★빨강
   * ★★★이게 ★지디 조건이 ★겨냥한 ★위험(★꼴 해석이 ★둘)을 ★★더 바로 ★잡는다.
   *   ⇒ ★★지디에 ★★올렸다 — ★★조건을 ★내가 ★바꿨으니 ★★그가 ★판정할 일이다. */

  /* ㉠ ★꼴 해석이 ★한 자리 — ★패널은 ★그 둘을 ★손으로 ★쪼개지 ★않는다 */
  /* ★★자를 ★S10 과 ★★공유한다(`HAND_PARSE_RE`) — ⛔여기 ★제 벌을 두면 ★★자가 ★둘이 된다 */
  const handParse = PANEL.match(HAND_PARSE_RE()) || [];
  assert.strictEqual(handParse.length, 0,
    `★패널이 ★꼴을 ★손으로 ★쪼갠다(${handParse.length}건) — ★해석 명부가 ★둘이 된다: ${handParse.join(' / ')}`);
  /* ★읽는 자리는 ★전부 ★공용 파서를 ★거친다 */
  for (const m of PANEL.matchAll(/(\w+)\(block\.dataset\.starScales/g)) {
    assert.ok(['starPointsList', 'starScaleList'].includes(m[1]),
      `★배율을 ★${m[1]}(…) 로 ★읽는다 — ★공용 파서(starScaleList)나 ★그리개를 ★거쳐야 한다`);
  }
  for (const m of PANEL.matchAll(/(\w+)\(block\.dataset\.starColors/g)) {
    assert.ok(['starColorList'].includes(m[1]),
      `★개별 색을 ★${m[1]}(…) 로 ★읽는다 — ★공용 파서(starColorList)를 ★거쳐야 한다`);
  }
  /* ★되돌려 쓰는 자도 ★공용 직렬화기를 ★쓴다 */
  assert.match(PANEL, /starColorsAttr\(list\)/,
    '★개별 색을 ★손으로 ★이어 붙인다 — ★`starColorsAttr` 를 ★써야 한다');

  /* ㉡ ★★그리는 자가 ★하나 — ★`starPointsList`·`starFillsFor` 가 ★그 함수 ★안에만 */
  const body = PANEL.match(/const _applyStarGeom = \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(body, '★_applyStarGeom 몸통을 ★못 떴다 — ★닻이 썩었다');
  for (const fn of ['starPointsList', 'starFillsFor']) {
    const all = (PANEL.match(new RegExp(fn + '\\(', 'g')) || []).length;
    const inside = (body[0].match(new RegExp(fn + '\\(', 'g')) || []).length;
    assert.strictEqual(all, inside,
      `★${fn} 가 ★_applyStarGeom ★밖에서도 불린다(전체 ${all} · 안 ${inside}) — ★그리는 자가 ★둘이다`);
    assert.strictEqual(inside, 1, `★${fn} 가 ★그 함수 안에서 ★${inside} 번 불린다 — ★하나여야 한다`);
  }
  /* ★그리개가 ★배율·색을 ★참으로 ★읽나(⛔안 읽으면 ★위 둘이 ★항등이 된다)
     ★★★⚠️지디 ⑩ ⒞ — ★★이 두 줄의 ★빨강은 ★«세기»가 ★다르다. ★갈라 적는다:
       ★`starColors` 쪽 = ★★사람 입구가 ★있다(★더블클릭 → 색 고르기 · ★DOM `E1` 이 ★행위로 잰다)
         ⇒ ★★«틀려서 ★빨강»이다
       ★`starScales` 쪽 = ★★★사람 입구가 ★아직 ★0건이다(★모서리 핸들 = ★Phase B · ★미착수)
         ⇒ ★★★«없어서 ★빨강»과 ★«틀려서 ★빨강»이 ★안 갈린다 ⇒ ★★이 칸의 ★빨강은 ★★약하다
       ⇒ ★★그래서 ★배율의 ★행위 증거는 ★★«검사가 ★dataset 을 ★손으로 ★심는» 꼴뿐이다
         (★DOM `D7` 이 ★그 꼴이다 — ★거기 머리말에도 ★같은 경고가 있다)
       ⇒ ★★★Phase B(모서리 핸들)가 ★서면 ★★그 칸을 ★★행위로 ★바꾼다. ★그때 ★이 주석을 ★지운다
     ⛔이 줄을 ★안 적으면 ★★다음 사람이 ★★이 초록을 ★«사람이 할 수 있다»로 ★읽는다 */
  assert.match(body[0], /dataset\.starScales/, '★그리개가 ★배율을 ★안 읽는다');
  assert.match(body[0], /dataset\.starColors/, '★그리개가 ★개별 색을 ★안 읽는다');
});

test('S10 ★★★㉠ ★레포 전수 — ★그 둘을 ★읽는 자리가 ★★«명부 안»에만 있다 (지디 ⑩ ⒜)', () => {
  /* ★★★분모가 ★«패널»이 아니라 ★★«js/ 전수»다 — ★★셋째 파일이 ★끼어드는 날 ★여기가 ★빨개진다.
   * ★★명부 = ★그 둘을 ★읽어도 되는 ★세 자리. ★★이름으로 든다(⛔수를 ★박지 않는다).
   * ★★판정 꼴 = ★「명부 ⊇ 실패집합 ＋ ★★명부 ★밖 ★0건」 — ⛔등호로 ★수를 ★박지 않는다(∅ 둔갑 금지). */
  const ALLOWED = {
    'js/props/prop-shape.js': '★㉡ 그리개(_applyStarGeom) ＋ ★㉠ 공용 파서 경유 ＋ ★입구(사람이 주는 자리) — 전부 이 파일',
  };
  /* ⒜ ★읽는 자리 ★전수를 ★센다 — ★정의 자리(js/ 전수)에서 */
  const readers = [];
  for (const [rel, src] of JS_SRC) {
    const n = (src.match(/dataset\.star(?:Colors|Scales)/g) || []).length;
    if (n > 0) readers.push([rel, n]);
  }
  /* ⒝ ★★명부 ★밖이 ★0건인가 — ★이것이 ★이 칸의 ★본 단언 */
  const outside = readers.filter(([rel]) => !(rel in ALLOWED)).map(([rel, n]) => `${rel}(${n})`);
  assert.deepEqual(outside, [],
    `★★그 둘을 ★읽는 자리가 ★명부 ★밖에 ★있다 — ★꼴 해석이 ★둘이 될 자리다:\n  ` + outside.join('\n  ') +
    '\n  ⇒ ★공용 파서(starColorList·starScaleList)를 ★거치게 하고, ★읽어도 되는 자리면 ★이 명부에 ★까닭과 함께 올려라');
  /* ⒞ ★★명부가 ★낡지 ★않았나 — ★명부에 ★있는데 ★이제 ★안 읽으면 ★그 칸은 ★거짓 안심이다 */
  const stale = Object.keys(ALLOWED).filter((rel) => !readers.some(([r]) => r === rel));
  assert.deepEqual(stale, [],
    `★명부에 ★«이제 안 읽는» 자리가 ★남았다 — ★낡은 명부가 ★다음 구멍을 ★가린다: ${stale.join(' ')}`);
  /* ⒟ ★★★자가 ★죽지 ★않았나 — ★★양성대조: ★읽는 자리가 ★★하나라도 ★있어야 한다
     ⛔0 건이면 ★「명부 밖 0건」이 ★★«아무것도 안 재고 있다»와 ★구분이 ★안 된다 */
  const total = readers.reduce((a, [, n]) => a + n, 0);
  assert.ok(total >= 1,
    `★읽는 자리가 ★★0건이다 — ★★이 칸은 ★아무것도 ★안 재고 있다(★정규식이 ★죽었거나 ★이름이 ★바뀌었다)`);
  /* ⒠ ★그리고 ★그 전수 중 ★★손 파싱이 ★0건 — ★★레포 전수로 (★앞서는 ★패널만 봤다) */
  /* ★★★이 술어를 ★한 번 ★고쳤다 — ★★첫 꼴은 ★★거짓양성을 냈다(지디 ⑩ 작업 중 실측):
       ★첫 꼴 = `dataset.starX[^;\n]*\.(split|replace|slice)\(`  ⇒ ★★같은 «문장»이면 ★다 잡았다
       ★걸린 것 = `(starColorList(block.dataset.starColors, count) || new Array(count).fill(null)).slice(0, count)`
         ⇒ ★★그 `.slice` 는 ★★«파서가 돌려준 ★배열»에 ★붙은 것이고 ★★문자열 ★해석이 ★아니다
     ⇒ ★★★제품을 ★자에 맞춰 ★고치지 ★않았다. ★★자를 ★고쳤다.
     ★새 꼴 = ★그 ★dataset ★읽기에 ★★«바로» 붙는 ★문자열 메서드만 — ★`)`·`|| '…'` 만 ★사이에 ★허용한다
       ⇒ ★`x.split(` · ★`String(x).split(` · ★`(x || '').split(` 은 ★잡고
         ★`f(x, n).slice(` 는 ★★안 잡는다. ★★S11 ⒝ 가 ★그 ★양성·음성을 ★둘 다 ★댄다 */
  const handParse = [];
  for (const [rel, src] of JS_SRC) {
    for (const m of src.matchAll(HAND_PARSE_RE())) {
      handParse.push(`${rel}: ${m[0].slice(0, 70)}`);
    }
  }
  assert.deepEqual(handParse, [],
    `★꼴을 ★손으로 ★쪼개는 자리가 ★있다(${handParse.length}건) — ★해석 명부가 ★둘이 된다:\n  ` + handParse.join('\n  '));
});

test('S11 ★★★음성대조 — ★★S9·S10 이 ★«언제나 빨강»이 ★아니다 (지디 ⑩ ⒝)', () => {
  /* ★★지디: 「★killer 4벌에 ★음성대조 ★한 칸 — ★★«언제나 빨강»이 ★아님을 ★보여라.
   *   ★★«방어는 ★세워둔 것이 아니라 ★★발동한 것으로 ★잰다»의 ★짝이다」
   * ★★꼴 = ★그 자들이 ★쓰는 ★★같은 술어를 ★★«깨끗한 입력»에 ★대어 ★★통과하는지 본다
   *   ⇒ ★★그러면 ★그 자가 ★★«무엇이든 ★거절하는 자»가 ★아님이 ★선다.
   * ★★★그리고 ★양성도 ★같이 — ⛔음성만 세우면 ★★죽은 자를 ★못 잡는다(★그 교훈이 ★이 레포의 것이다). */
  const READ_RE  = () => /dataset\.star(?:Colors|Scales)/g;
  const HAND_RE  = HAND_PARSE_RE;   // ★★같은 자를 ★댄다(⛔사본 금지)

  /* ⒜ ★S10 의 ★읽기 술어 — ★★깨끗한 소스(공용 파서만)는 ★★«읽는 자리»로 ★안 잡힌다 */
  const CLEAN_READ = 'const l = starColorList(raw, 5); const a = starColorsAttr(l);';
  assert.strictEqual((CLEAN_READ.match(READ_RE()) || []).length, 0,
    '★음성대조 실패 — ★dataset 을 ★안 읽는 줄을 ★읽는다고 ★센다');
  /* ★★양성 — ★참으로 ★읽는 줄은 ★잡는다 */
  const DIRTY_READ = 'const c = block.dataset.starColors;';
  assert.strictEqual((DIRTY_READ.match(READ_RE()) || []).length, 1,
    '★양성대조 실패 — ★읽는 줄을 ★못 잡는다(★자가 죽었다)');

  /* ⒝ ★S9·S10 의 ★손 파싱 술어 — ★★공용 파서만 쓰는 줄은 ★안 잡힌다 */
  const CLEAN_PARSE = 'const l = starColorList(block.dataset.starColors, count); const a = starColorsAttr(l);';
  assert.strictEqual((CLEAN_PARSE.match(HAND_RE()) || []).length, 0,
    '★음성대조 실패 — ★공용 파서만 쓰는 줄을 ★손 파싱으로 ★잡는다');
  /* ★★양성 — ★손 파싱은 ★잡는다 */
  const DIRTY_PARSE = "const l = block.dataset.starColors.split(',');";
  assert.strictEqual((DIRTY_PARSE.match(HAND_RE()) || []).length, 1,
    '★양성대조 실패 — ★손 파싱을 ★못 잡는다(★자가 죽었다)');

  /* ⒞ ★S9 의 ★«그리는 자가 하나» 술어 — ★★한 곳만 있는 소스는 ★통과한다 */
  const ONE_RENDER = 'const _applyStarGeom = () => { starPointsList(1); starFillsFor({}); };';
  for (const fn of ['starPointsList', 'starFillsFor']) {
    const n = (ONE_RENDER.match(new RegExp(fn + '\\(', 'g')) || []).length;
    assert.strictEqual(n, 1, `★음성대조 실패 — ★«한 곳만» 소스에서 ★${fn} 를 ★${n} 로 센다`);
  }
  /* ★★양성 — ★두 곳이면 ★참으로 ★둘로 센다 */
  const TWO_RENDER = ONE_RENDER + ' starPointsList(2);';
  assert.strictEqual((TWO_RENDER.match(/starPointsList\(/g) || []).length, 2,
    '★양성대조 실패 — ★둘인데 ★둘로 ★못 센다');

  /* ⒟ ★★그리고 ★★실제 제품 소스가 ★★지금 ★그 술어들을 ★★통과한다 — ★★이것이 ★«언제나 빨강이 아니다»의 ★참 증거다
     ⛔위 ⒜⒝⒞ 는 ★가짜 문자열이다. ★★이 줄이 ★★제품으로 ★그것을 ★확인한다. */
  let handTotal = 0;
  for (const [, src] of JS_SRC) handTotal += (src.match(HAND_RE()) || []).length;
  assert.strictEqual(handTotal, 0,
    `★제품 소스에 ★손 파싱이 ★${handTotal} 건 — ★S10 이 ★지금 ★빨강이어야 한다`);
});
