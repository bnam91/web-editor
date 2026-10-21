/* ═══════════════════════════════════════════════════════════════════════════
   annot-dim-geometry.test.mjs — 사이즈 스티커(치수선)의 ★기하를 잠근다.
   ───────────────────────────────────────────────────────────────────────────
   ★★이 벌이 ★잴 수 있는 까닭 = `js/blocks/annot-dim-geometry.js` 가 ★플레인이라
     ★`vm` 으로 ★진짜로 실어 ★진짜로 ★부른다(⛔소스 게이트가 ★아니다 — 약한 자가 아니다).
     ★그 설계의 까닭은 그 파일 머리말에 있다(ESM 인 annotation-block.js 는 단위에서 안 실린다).

   ★★D0 가 ★전제를 단언한다 — ★그게 빨강이면 ★아래 전부 ★「안 쟀다」다.
   ★★양성대조를 ★단언마다 짝지었다 — 「값이 ★바뀌어야 하는 자리」에서 ★안 바뀌면 ★자가 죽은 것이다.
   ═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '../..');
const W = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/blocks/annot-dim-geometry.js'), 'utf8'), { window: W });
const G = W.annotDimGeometry;

/* ★★2026-10-21 실측 함정 — ★이 벌의 ★첫 판이 ★여기서 빨개졌다(2건).
   ★`vm` 으로 실은 코드가 낸 배열은 ★«다른 realm» 의 Array 다 ⇒ `deepStrictEqual`
     (= `node:assert/strict` 의 `deepEqual`)은 ★prototype 까지 비교해 ★거절한다.
   ⚠️★값은 ★맞았다 — `[[0,0],[100,0]]` 이 `[[0,0],[100,0]]` 과 ★같은데 ★빨강이었다.
     ⇒ ★★「빨강」을 ★제품 결함으로 읽으면 ★안 되는 자리였다(★자 설계의 흠이다).
   ⇒ ★처방: 건너온 값을 ★이 realm 꼴로 ★정규화해서 비교한다. ★D0 가 ★그 정규화 자신을 잰다. */
const norm = (v) => JSON.parse(JSON.stringify(v));

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const cross = (p, q) => p[0] * q[1] - p[1] * q[0];          /* 0 ⇒ 평행 */
const dot = (p, q) => p[0] * q[0] + p[1] * q[1];            /* 0 ⇒ 수직 */
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];

test('D0 ★전제 — 자가 ★실리고 ★부를 수 있다 (⛔이게 빨강이면 아래는 「안 쟀다」다)', () => {
  assert.equal(typeof G, 'function', '★annotDimGeometry 가 window 에 안 올랐다');
  assert.equal(W.ANNOT_DIM_SNAP, 12, '★자석 폭이 12 가 아니다 — D5 의 경계값이 ★틀린 자를 쓴다');
  const g = G([[0, 0], [100, 0]], {});
  assert.ok(g && Array.isArray(g.line) && g.line.length === 2, '★기본 판에서 ★치수선을 못 냈다');

  /* ★★realm 을 ★단언한다 — 이 벌이 ★무엇과 싸웠는지 다음 사람이 ★자로 알게 한다 */
  assert.equal(g.line instanceof Array, false,
    '★vm 이 ★같은 realm 을 줬다 — 그러면 ★norm() 이 ★필요 없고 ★위 주석이 ★거짓이 된다(자를 고쳐라)');
  assert.deepEqual(norm(g.line), [[0, 0], [100, 0]],
    '★★norm() 이 ★realm 을 ★못 건넌다 ⇒ ★아래 모든 deepEqual 이 ★거짓 빨강이 된다');
  assert.notDeepEqual(norm([[0, 0]]), [[0, 1]], '⛔음성대조 — norm 이 ★아무 것이나 같다고 한다');
});

test('D1 ★치수선이 ★두 점과 ★평행하다 — ＋★치우침을 주면 ★떨어진다(양성대조)', () => {
  for (const [A, B] of [[[0, 0], [100, 0]], [[10, 20], [90, 70]], [[0, 0], [0, 80]]]) {
    const g = G([A, B], { dimOffset: 14 });
    assert.ok(near(cross(sub(B, A), sub(g.line[1], g.line[0])), 0, 1e-6),
      `★치수선이 두 점과 ★안 평행하다 A=${A} B=${B} line=${JSON.stringify(g.line)}`);
  }
  /* ★양성대조 — 치우침 0 이면 치수선이 ★두 점 자리와 ★같아야 하고, 주면 ★달라야 한다 */
  const z = G([[0, 0], [100, 0]], { dimOffset: 0 });
  const o = G([[0, 0], [100, 0]], { dimOffset: 14 });
  assert.deepEqual(norm(z.line), [[0, 0], [100, 0]], '★치우침 0 인데 치수선이 두 점에 ★안 겹친다');
  assert.ok(!near(o.line[0][1], 0), '★★자가 죽었다 — ★치우침을 줘도 치수선이 ★안 움직인다');
});

test('D2 ★보조선이 ★치수선에 ★수직하다 — ＋★치우침 0 이면 ★길이 0(양성대조)', () => {
  const g = G([[10, 20], [90, 70]], { dimOffset: 20, dimGap: 4, dimOver: 6 });
  const dir = sub(g.line[1], g.line[0]);
  for (const [p0, p1] of g.ext) {
    assert.ok(near(dot(dir, sub(p1, p0)), 0, 1e-6),
      `★보조선이 치수선에 ★안 수직하다 ext=${JSON.stringify([p0, p1])}`);
    assert.ok(Math.hypot(...sub(p1, p0)) > 0, '★보조선 길이가 0 이다 — ★안 그려진다');
  }
  const flat = G([[10, 20], [90, 70]], { dimOffset: 0 });
  for (const [p0, p1] of flat.ext) {
    assert.ok(near(Math.hypot(...sub(p1, p0)), 0), '★치우침 0 인데 보조선이 ★길이를 갖는다(sgn=0 이어야)');
  }
});

test('D3 ★치우침 ★부호를 뒤집으면 ★보조선 쪽이 ★뒤집힌다 (★양성대조)', () => {
  const up = G([[0, 0], [100, 0]], { dimOffset: 20 });
  const dn = G([[0, 0], [100, 0]], { dimOffset: -20 });
  assert.equal(up.sgn, 1); assert.equal(dn.sgn, -1);
  assert.ok(up.line[0][1] * dn.line[0][1] < 0, '★치수선이 ★같은 쪽에 있다 — 부호가 ★안 먹었다');
  const uy = up.ext[0][1][1], dy = dn.ext[0][1][1];
  assert.ok(uy * dy < 0, `★★자가 죽었다 — 보조선이 ★안 뒤집혔다 (up=${uy} dn=${dy})`);
});

test('D4 ★좌우 0 ⇒ 파이프가 ★선에 수직 · ★밀면 ★각도가 바뀐다', () => {
  const g0 = G([[0, 0], [100, 0]], { dimOffset: 20, dimSlide: 0 });
  assert.ok(near(g0.pipeDeg[0], 90, 1e-6), `★좌우 0 인데 파이프가 ★수직이 아니다 (${g0.pipeDeg[0]}°)`);
  const g1 = G([[0, 0], [100, 0]], { dimOffset: 20, dimSlide: 40 });
  assert.ok(Math.abs(g1.pipeDeg[0] - 90) > 1,
    `★★자가 죽었다 — ★좌우를 40 밀어도 ★각도가 그대로다 (${g1.pipeDeg[0]}°)`);
});

test('D5 ★자석 — ★경계값 ★양쪽을 잰다 (|slide| < 12 ⇒ 0)', () => {
  const inside = G([[0, 0], [100, 0]], { dimSlide: 11.9 });
  const outside = G([[0, 0], [100, 0]], { dimSlide: 12 });
  assert.equal(inside.slide, 0, '★자석 안인데 ★0 으로 안 붙었다');
  assert.equal(inside.snapped, true, '★붙었는데 snapped 가 ★false 다 — UI 가 「붙었다」를 못 보여준다');
  assert.equal(outside.slide, 12, '★자석 ★밖인데 ★0 으로 붙였다 — ★영영 못 민다');
  assert.equal(outside.snapped, false);
  assert.equal(G([[0, 0], [100, 0]], { dimSlide: 0 }).snapped, false, '★처음부터 0 은 ★붙은 것이 아니다');
});

test('D6 ★라벨 자리 = ★치수선 ★중심 — ⛔`points[last]` 가 ★아니다 (★그 함정을 잠근다)', () => {
  const pts = [[0, 0], [100, 0]];
  const g = G(pts, { dimOffset: 24 });
  assert.deepEqual(norm(g.mid), [50, 24], `★중심이 틀렸다 mid=${JSON.stringify(g.mid)}`);
  /* ★★이 단언이 ★잠그는 것 — 중심과 ★마지막 점이 ★다르다(같으면 함정에 빠진 것이다) */
  const last = pts[pts.length - 1];
  assert.ok(g.mid[0] !== last[0] || g.mid[1] !== last[1],
    '★★라벨 자리가 ★마지막 점과 같다 — annotation-select.js:190-192 의 그 함정이다');
});

test('D7 ★axis 고정 — 비뚤은 두 점에 ★h 를 주면 ★수평으로 잰다', () => {
  const skew = [[0, 0], [100, 60]];
  const auto = G(skew, {});
  const hor = G(skew, { dimAxis: 'h' });
  const ver = G(skew, { dimAxis: 'v' });
  assert.ok(near(hor.line[0][1], hor.line[1][1]), '★h 인데 치수선이 ★수평이 아니다');
  assert.ok(near(hor.len, 100), `★h 의 길이가 ★가로 투영(100)이 아니다 (${hor.len})`);
  assert.ok(near(ver.len, 60), `★v 의 길이가 ★세로 투영(60)이 아니다 (${ver.len})`);
  assert.ok(!near(auto.len, 100) && !near(auto.len, 60), `★auto 가 ★투영값과 같다 — 고정이 ★안 먹는다 (${auto.len})`);
  assert.ok(near(auto.len, Math.hypot(100, 60)), '★auto 의 길이가 ★두 점 사이가 아니다');
});

test('D8 ⛔음성대조 — ★점이 ★모자라면 ★안 그린다 · ★겹친 점은 ★스스로 말한다', () => {
  assert.equal(G([[0, 0]], {}), null, '★점 하나로 ★치수선을 냈다');
  assert.equal(G([], {}), null, '★빈 점으로 ★치수선을 냈다');
  assert.equal(G(null, {}), null, '★null 로 ★치수선을 냈다');
  const same = G([[7, 7], [7, 7]], {});
  assert.equal(same.degenerate, true, '★겹친 두 점인데 ★degenerate 를 ★안 말한다 — ★조용히 NaN 이 흐른다');
  assert.ok(Number.isFinite(same.mid[0]) && Number.isFinite(same.mid[1]), '★겹친 점에서 ★NaN 이 나왔다');
  /* ★양성대조 — 이 자가 degenerate 를 ★아무 판에나 붙이지 않는다 */
  assert.equal(G([[0, 0], [100, 0]], {}).degenerate, false, '★★정상 판을 ★degenerate 라 한다');
});

/* ═══ G1 ★적재 — ★「쓰는 자리가 ★있다」를 잠근다 ══════════════════════════
   ★★왜 이 벌이 ★있어야 하나 — `annotation-block.js` 는 기하가 ∅ 면 ★console.warn 하고
     ★기존 꼴로 떨어진다(그 자리 주석에 ★「적재는 검사가 잠근다(G1)」이라 적었다).
     ⇒ ★그 문장을 ★참으로 만드는 자가 ★여기다. ⛔안 만들면 ★주석이 ★거짓이 된다.
   ★꼴: ⑴ index.html 이 ★플레인으로 싣는다 ⑵ ★ESM 모듈보다 ★먼저다(plain 즉시 · module defer)
        ⑶ 팩토리가 ★그 이름을 ★부른다 ⑷ 명부(ANNOT_DATA_KEYS)에 ★치수 칸이 있다 */
const readRoot = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('G1 ★적재 — index.html 이 기하를 ★싣고 ★모듈보다 ★먼저다', () => {
  const html = readRoot('index.html');
  const geo = html.indexOf('js/blocks/annot-dim-geometry.js');
  const mod = html.indexOf('js/blocks/annotation-block.js');
  assert.ok(geo >= 0, '★index.html 이 기하 파일을 ★안 싣는다 ⇒ 치수선은 ★조용히 기존 꼴로 떨어진다');
  assert.ok(mod >= 0, '★전제: index.html 이 annotation-block.js 를 싣는다(앵커가 살아 있다)');
  assert.ok(geo < mod, `★기하가 ★모듈보다 ★뒤에 있다 (geo=${geo} mod=${mod})`);

  /* ★플레인이어야 vm 으로 잴 수 있다 — ⛔type="module" 이면 이 벌 전체가 ★못 돈다 */
  const tag = html.slice(geo - 120, geo + 60);
  assert.equal(/type\s*=\s*["']module["']/.test(tag), false,
    '★기하를 ★모듈로 싣고 있다 — 그러면 ★D0~D8 이 재는 그 파일과 ★다른 것이 앱에서 돈다');

  /* ★★플레인임을 ★파일 자신에서도 잰다(★두 자리가 어긋나는 것을 막는다) */
  assert.equal(/^\s*(import|export)\b/m.test(readRoot('js/blocks/annot-dim-geometry.js')), false,
    '★기하 파일에 ESM 낱말이 생겼다 — 플레인이 ★깨졌다');
});

test('G1b ★부르는 자리 ＋ ★명부 — ⛔안 걸면 리로드에서 ★조용히 사라진다', () => {
  const src = readRoot('js/blocks/annotation-block.js');
  assert.match(src, /window\.annotDimGeometry\(/,
    '★팩토리가 기하를 ★안 부른다 ⇒ 게이트가 ★그 자리에 없다');

  /* ★명부를 ★소스에서 파생한다 — ⛔손으로 옮겨 적지 않는다(둘째 명부가 된다) */
  const m = src.match(/const ANNOT_DATA_KEYS = (\[[\s\S]*?\]);/);
  assert.ok(m, '★전제: ANNOT_DATA_KEYS 리터럴을 찾았다');
  const keys = JSON.parse(m[1].replace(/'/g, '"'));
  const DIM = ['annotKind', 'dimAxis', 'dimOffset', 'dimSlide', 'dimGap', 'dimOver', 'dimShowExt'];
  const missing = DIM.filter((k) => !keys.includes(k));
  assert.deepEqual(missing, [], `★명부에 없는 치수 칸 = ${JSON.stringify(missing)} ⇒ ★리로드·⌘Z 에서 사라진다`);

  /* ★★순서 — 치수 칸은 ★labelHtml ★앞이어야 한다(그 키가 「맨 끝」이라는 단언이 ★따로 있다) */
  assert.ok(keys.indexOf('dimShowExt') < keys.indexOf('labelHtml'),
    '★치수 칸이 labelHtml ★뒤에 있다 — 1017t1h3 의 「맨 끝」 단언과 ★부딪친다');

  /* ⛔음성대조 — 이 자가 ★아무 이름이나 있다고 하지 않는다 */
  assert.equal(keys.includes('ZZZ없는칸'), false, '★★명부 파싱이 죽었다 — 허수 칸을 ★있다고 한다');
  assert.ok(keys.length >= 24, `★명부가 ${keys.length}개다 — ★너무 적다(파싱이 잘렸다)`);
});
