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

test('D4 ★파이프 = ★치수선 방향에 ★수직 — ★a·b 를 끌면 ★각도가 ★따라 바뀐다', () => {
  /* ★★261021 현빈 2차 지적: 「치수선 양끝에 ★파이프인 경우 ★지금 너가 한건 ★무조건 90도만 되는데
       ★각도도 달라지겠지?」 ⇒ ★파이프는 ★(b−a) 에 ★수직이지 ★(c−d) 에 수직이 ★아니다. */
  const g0 = G([[0, 0], [100, 0]], { dimOffset: 20 });
  assert.ok(near(g0.pipeDeg[0], 90, 1e-6), `★평행한 판에서 파이프가 ★수직이 아니다 (${g0.pipeDeg[0]}°)`);

  /* ★치수선을 ★기울이면(a·b 를 각각 끌면) ★각도가 ★바뀌어야 한다 */
  const g1 = G([[0, 0], [100, 0]], { dimA: [-20, 60], dimB: [140, 20] });
  assert.ok(Math.abs(g1.pipeDeg[0] - 90) > 5,
    `★★자가 죽었다 — ★치수선을 기울였는데 파이프가 ★그대로다 (${g1.pipeDeg[0]}°)`);

  /* ★★단언으로 ★못 박는다 — 파이프와 ★치수선의 ★사잇각이 ★언제나 ★90° */
  const between = (deg, p, q) => {
    const ld = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
    return Math.abs(((deg - ld) % 360 + 360) % 360 - 90);
  };
  for (const g of [g0, g1, G([[10, 20], [90, 70]], { dimA: [0, 0], dimB: [50, 120] })]) {
    assert.ok(between(g.pipeDeg[0], g.line[0], g.line[1]) < 1e-6,
      `★파이프가 ★치수선에 ★수직이 아니다 (${g.pipeDeg[0]}° · line ${JSON.stringify(g.line)})`);
  }

  /* ⛔음성대조 — ★좌우(slide)는 ★평행이동이라 ★각도를 ★안 바꾼다(그게 ★맞다) */
  const g2 = G([[0, 0], [100, 0]], { dimOffset: 20, dimSlide: 40 });
  assert.ok(near(g2.pipeDeg[0], 90, 1e-6),
    `★좌우로 민 것은 ★평행이동이다 — 각도가 ★바뀌면 안 된다 (${g2.pipeDeg[0]}°)`);
});

test('D4b ★보조선 길이가 ★서로 달라도 된다 — d→a, c→b 를 ★직접 잇는다 (현빈 2차 요구)', () => {
  /* ★현빈 원문: 「★da, cb의 길이는 ★달라질수 있어」 */
  const g = G([[0, 0], [100, 0]], { dimA: [-20, 60], dimB: [140, 20] });
  const L = ([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const [da, cb] = g.ext.map(L);
  assert.ok(Math.abs(da - cb) > 5, `★두 보조선 길이가 ★같다 (${da.toFixed(1)} · ${cb.toFixed(1)}) — ★평행 모형이 살아 있다`);

  /* ★전제 — 보조선은 ★기준점에서 ★치수선 끝으로 ★간다(엉뚱한 곳을 잇지 않는다) */
  const near2 = (p, q, tol) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
  assert.ok(near2(g.ext[0][0], [0, 0], g.lift + 10), '★첫 보조선이 ★d 에서 ★안 떠난다');
  assert.ok(near2(g.ext[1][0], [100, 0], g.lift + 10), '★둘째 보조선이 ★c 에서 ★안 떠난다');

  /* ⛔음성 — a·b 를 ★안 주면 ★예전 꼴(평행·같은 길이)로 ★돌아간다(옛 저장본 회귀 0) */
  const flat = G([[0, 0], [100, 0]], { dimOffset: 40 });
  const [fa, fb] = flat.ext.map(L);
  assert.ok(Math.abs(fa - fb) < 1e-6, `★a·b 없는 판에서 길이가 ★갈렸다 (${fa} · ${fb})`);
  assert.deepEqual(norm(flat.line), [[0, 40], [100, 40]], '★a·b 없는 판이 ★예전 자리가 아니다');
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

test('D6b ★라벨이 ★치수선에 ★겹치지 않는다 — ★★261021 현빈 지적을 ★자로 잠근다', () => {
  /* ★현빈 원문: 「왜 라벨텍스트 박스가 ★바로 선 중간에 위치하는지??」
     ⇒ ★제도에서 치수 문자는 ★선 위에 ★겹치지 않는다. ★여기서는 ★선 바깥으로 ★띄우는 쪽을 골랐다. */
  const g = G([[0, 0], [100, 0]], { dimOffset: 24 });
  assert.deepEqual(norm(g.mid), [50, 24], '★전제: 중점은 그대로다(다른 것도 이 값을 쓴다)');
  const d = Math.hypot(g.labelAt[0] - g.mid[0], g.labelAt[1] - g.mid[1]);
  assert.ok(d > 6, `★라벨이 ★중점에서 ${d.toFixed(1)}px 밖에 안 떨어졌다 — ★선에 ★겹친다(현빈이 지적한 그 증상)`);
  assert.ok(Math.abs(d - g.lift) < 1e-6, `★띄운 거리가 ★lift(${g.lift}) 와 다르다 — 산식이 ★어긋났다`);

  /* ★★점과 ★선분의 거리로 ★겹침을 ★직접 잰다 — ⛔「떨어졌다」만으로는 ★선이 ★긴 쪽으로 못 잡는다 */
  const distToLine = (p, a, b) => {
    const vx = b[0] - a[0], vy = b[1] - a[1], L = Math.hypot(vx, vy) || 1;
    return Math.abs((p[0] - a[0]) * vy - (p[1] - a[1]) * vx) / L;
  };
  assert.ok(distToLine(g.labelAt, g.line[0], g.line[1]) > 6,
    '★라벨이 ★치수선 ★위에 있다 — ★문자가 선을 ★가린다');
  assert.ok(distToLine(g.mid, g.line[0], g.line[1]) < 1e-6, '★전제: 중점은 ★선 위에 있다(자가 산다)');

  /* ★치우침 ★부호를 뒤집으면 ★띄우는 쪽도 ★뒤집힌다 — ★선 ★안쪽으로 들어가면 안 된다 */
  const up = G([[0, 0], [100, 0]], { dimOffset: 24 });
  const dn = G([[0, 0], [100, 0]], { dimOffset: -24 });
  assert.ok((up.labelAt[1] - up.mid[1]) * (dn.labelAt[1] - dn.mid[1]) < 0,
    '★★자가 죽었다 — 치우침을 뒤집어도 ★라벨이 ★같은 쪽에 있다');

  /* ⛔음성대조 — ★치우침 0 이어도 ★겹치지 않는다(그때도 어딘가로 띄워야 한다) */
  const flat = G([[0, 0], [100, 0]], { dimOffset: 0 });
  assert.ok(distToLine(flat.labelAt, flat.line[0], flat.line[1]) > 6,
    '★치우침 0 일 때 ★라벨이 ★선에 겹친다 — ★그 갈래를 안 다뤘다');

  /* ★끄고 싶으면 ★0 으로 — ★그 길이 ★열려 있는지도 잰다(⒟ 패널이 쓸 칸) */
  const zero = G([[0, 0], [100, 0]], { dimOffset: 24, dimLabelLift: 0 });
  assert.deepEqual(norm(zero.labelAt), norm(zero.mid), '★lift 0 인데 ★중점과 다르다 — ★칸이 안 먹는다');
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

/* ═══ G2 ★패널 HTML 의 ★템플릿이 ★죽어 있지 않다 ════════════════════════════
   ★★2026-10-21 실측 사고 — 내가 치수 절을 ★heredoc 으로 써 넣으면서 `\${…}` 로 ★이스케이프했고,
     ★12 칸이 ★전부 ★글자 그대로 `${st.dimOffset}` 를 ★value 에 넣고 있었다.
   ⚠️★그런데 ★내 실측은 ★「칸 7/7 있다」로 ★초록이었다 — ★★존재만 재고 ★값을 ★안 쟀다.
   ⇒ ★★「칸이 ★있다」 ≠ 「칸이 ★맞는 값을 ★보여준다」. ★그 틈을 ★이 자가 막는다.
   ★소스 게이트(약한 자)지만 ★이 사고 꼴은 ★소스에 ★그대로 남으므로 ★잡힌다. */
test('G2 ★패널 소스에 ★죽은 템플릿(\\${…})이 ★0 건이다', () => {
  const src = readRoot('js/props/prop-annotation.js');
  const DEAD = /\\\$\{/g;
  const hits = src.match(DEAD) || [];
  assert.equal(hits.length, 0,
    `★이스케이프된 템플릿이 ${hits.length} 건 — ★그 칸은 ★글자 그대로 「\${…}」를 ★화면에 낸다`);

  /* ★★자 자신 — ★가짜 글에서 ★잡히는지 ★먼저 본다(⛔안 그러면 「0 건」이 ★「안 쟀다」와 구분 안 된다) */
  assert.equal(('value="\\${st.dimOffset}"'.match(DEAD) || []).length, 1,
    '★★자가 죽었다 — ★죽은 템플릿을 ★못 잡는다');
  assert.equal(('value="${st.dimOffset}"'.match(DEAD) || []).length, 0,
    '⛔음성대조 — ★살아 있는 템플릿을 ★잡는다');

  /* ★전제 — 그 파일이 ★정말 템플릿을 ★쓰고 있다(앵커가 살아 있다) */
  assert.ok((src.match(/\$\{st\./g) || []).length > 10,
    '★전제: 패널이 ★st.* 템플릿을 ★여럿 쓴다 — ★0 이면 ★이 벌이 ★빈 글을 재고 있다');

  /* ★치수 칸이 ★실제로 ★거기 있는지도 — ⛔이름이 바뀌면 ★위 전수가 ★다른 글을 잰다 */
  for (const id of ['annot-dim-val', 'annot-dim-unit', 'annot-dim-off', 'annot-dim-gap',
                    'annot-dim-over', 'annot-dim-lift', 'annot-dim-ext', 'annot-dim-axis']) {
    assert.ok(src.includes(id), `★패널에 ★${id} 칸이 ★없다`);
  }
});

/* ═══ D9 ★③클릭 자리가 ★치수선 ★중점이 된다 — ★2D 자유 ═══════════════════
   ★★★2026-10-21 현빈 3차 지적: 「★아직 ★수직으로밖에 안 움직이는데 ★QA한 거야?」
     ⛔내 ③클릭은 `annotDimOffsetFromPoint`(★수직 성분 ★하나)만 썼다 ⇒ ★선 밖으로만 밀렸다.
     ★2차 설계(a·b 자유)를 ★기하와 ★손잡이에는 넣고 ★③클릭에는 ★안 넣은 것이다.
   ★★그리고 ★내 QA 는 ★손잡이 드래그만 쟀다 — ★사용자가 ★실제로 하는 ★③클릭을 ★안 쟀다.
     ⇒ ★이 벌이 ★그 자리를 ★대신 잰다(★사람이 하는 순서의 ★마지막 걸음). */
test('D9 ★커서가 ★치수선 ★중점이 된다 — ★위아래뿐 아니라 ★좌우로도 (현빈 3차)', () => {
  const P = W.annotDimPlaceAt;
  assert.equal(typeof P, 'function', '★전제: annotDimPlaceAt 이 없다 — ③클릭이 ★쓸 자가 없다');
  const pts = [[0, 0], [100, 0]];
  const mid = (r) => [(r.dimA[0] + r.dimB[0]) / 2, (r.dimA[1] + r.dimB[1]) / 2];

  /* ★네 방향 — ⛔「아래·위」만 재면 ★수직만 되는 판도 ★통과한다 */
  for (const c of [[50, 60], [50, -40], [-30, -50], [180, 90]]) {
    const r = P(pts, c, {});
    assert.deepEqual(norm(mid(r)).map((v) => Math.round(v * 10) / 10), c,
      `★커서 ${JSON.stringify(c)} 인데 중점이 ${JSON.stringify(mid(r))} 다 — ★그 자리로 ★안 간다`);
  }

  /* ★★좌우가 ★진짜 먹는지 — ★같은 높이에서 ★x 만 옮기면 ★중점 x 가 ★따라와야 한다 */
  const a = mid(P(pts, [10, 60], {})), b = mid(P(pts, [190, 60], {}));
  assert.ok(Math.abs(b[0] - a[0] - 180) < 1e-6,
    `★★좌우가 ★안 먹는다 — x 를 180 옮겼는데 중점이 ${(b[0] - a[0]).toFixed(1)} 만 움직였다(=수직만 되는 판)`);

  /* ★길이는 ★잰 구간과 ★같다(치수선이 ★늘거나 줄면 ★「치수」의 뜻이 흔들린다) */
  const r = P(pts, [-30, -50], {});
  assert.ok(Math.abs(Math.hypot(r.dimB[0] - r.dimA[0], r.dimB[1] - r.dimA[1]) - 100) < 1e-6,
    '★놓은 치수선의 ★길이가 ★잰 구간과 ★다르다');

  /* ★그 결과를 ★기하에 ★넣으면 ★그 자리에 ★선다(★두 자가 ★이어진다) */
  const g = G(pts, P(pts, [-30, -50], {}));
  assert.deepEqual(norm(g.mid).map((v) => Math.round(v * 10) / 10), [-30, -50],
    '★annotDimPlaceAt 과 ★annotDimGeometry 가 ★서로 다른 자리를 말한다');

  /* ⛔음성 — 점이 모자라거나 커서가 없으면 ★∅ */
  assert.equal(P([[0, 0]], [10, 10], {}), null, '★점 하나로 ★자리를 냈다');
  assert.equal(P(pts, null, {}), null, '★커서 ∅ 인데 ★자리를 냈다');
});

test('D10 ★파이프(치수선 끝 막음) — ★꼴과 ★각도 (현빈 「파이프 같은 게 양끝에」)', () => {
  const src = readRoot('js/blocks/annotation-block.js');
  /* ★그리는 자리에 ★pipe 갈래가 ★있다 — ⛔없으면 ★circle 로 ★조용히 떨어진다 */
  assert.match(src, /shape === 'pipe'/, '★팩토리에 ★pipe 갈래가 ★없다');
  assert.match(src, /shape === 'slash'/, '★팩토리에 ★slash 갈래가 ★없다');
  /* ★⛔각도를 ★다시 90 더하지 않는다 — 부르는 쪽이 ★이미 수직으로 준다 */
  const at = src.indexOf("shape === 'pipe'");
  const blk = src.slice(at, at + 700);
  assert.match(blk, /rotate\(\$\{angleDeg\}/, '★pipe 가 ★angleDeg 를 ★그대로 안 쓴다(선과 나란해질 수 있다)');
  /* ★패널 고르개 명부에도 ★있어야 ★고를 수 있다 */
  const panel = readRoot('js/props/prop-annotation.js');
  const m = panel.match(/const SHAPES = (\[[^\]]*\]);/);
  assert.ok(m, '★전제: SHAPES 명부를 찾았다');
  const shapes = JSON.parse(m[1].replace(/'/g, '"'));
  for (const want of ['pipe', 'slash']) {
    assert.ok(shapes.includes(want), `★고르개 명부에 ★${want} 가 ★없다 — ★그리기만 되고 ★못 고른다`);
  }
  assert.equal(shapes.includes('ZZZ없는모양'), false, '⛔음성대조 — 명부 파싱이 죽었다');
});
