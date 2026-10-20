/* 1020t1d — ★화면 Δ → ★«담은 상자의 로컬» Δ 역변환. ★DOM 없이 ★순수 계산으로 잠근다.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ★실제 소스를 ★.mjs 별칭으로 import 한다(frame-geometry.test.mjs 관례 · ⛔손으로 쓴 모델 아님).
 *
 * ★왜 — 현빈 2026-10-20: 「프레임블럭 안에서 … ★플립을 했는데 … ★이동시키려고 보니 ★움직임도 ★반대」
 *   ★뿌리: 이동 드래그가 화면 Δ 를 ★캔버스 줌 ★하나로만 나눠 `style.left/top` 에 썼다.
 *   `left/top` 은 ★프레임 로컬 좌표인데 그 프레임엔 `scale(fx,fy)`·`rotate()` 가 걸릴 수 있다.
 *   ★실측(헤드리스 크롬 · 진짜 앱 · 줌 40% · 화면 (+60,+40) 끌기) — 고치기 ★전:
 *       변환없음 모델[150,100] 화면[+60,+40] / flipH 화면[★−60,+40] / flipV 화면[+60,★−40]
 *       flipH+V 화면[★−60,★−40] / rotate90 화면[★−40,+60]
 *     ★모델 Δ 가 ★언제나 [150,100] 인 것이 「조상 변환을 아예 안 본다」의 증거였다.
 *
 * ★★이 검사가 ★잠그는 것(★가장 중요한 것부터):
 *   ⑴ ★★«변환이 없으면 ★옛 식(`/scale`)과 ★한 치도 다르지 않다» ⇒ ★플립 안 쓴 문서는 ★안 바뀐다
 *   ⑵ 다섯 꼴(없음·flipH·flipV·둘다·rotate90)에서 ★왕복이 ★닫힌다 — ★기대값을 ★리터럴로 박지 않고
 *      ★기저로 ★되돌려 곱해 ★원래 화면 Δ 가 나오는지로 본다(★항등식이 아니다: 기저는 ★입력, 화면Δ는 ★독립 입력)
 *   ⑶ ★퇴화(det≈0 · 비수·결손)에서 ★null ⇒ ★부르는 자가 ★옛 식으로 ★떨어진다
 *   ⑷ ★호출부(block-drag.js)가 ⒜ ★제스처당 ★한 번만 재고 ⒝ ★폴백을 ★가졌나 — ★소스로
 *
 * ★★이 검사가 ★★못 하는 일(⛔「안전하다」로 읽지 마라):
 *   ⒤ ★«실제로 끌면 화면이 손짓과 같이 가나»는 ★여기서 못 잰다 — ★DOM/CDP 만이 잰다.
 *      행동 게이트는 ★레포 «밖»: `…/scratchpad/t1d/measure-flip.mjs`(헤드리스 크롬 · 진짜 index.html).
 *   ⒥ ★`measureLocalBasis` 의 ★DOM 측정(강제 레이아웃·기준선 가라앉음)은 ★여기서 못 잰다.
 *      ★실측으로만 확인했다: h=1·5·25·100 에서 기저가 ★모두 같았고, 5회 반복에 ★흔들림 0.
 *   ⒦ ★드래그 경로의 ★클램프·스냅은 ★이 함수 밖이다 — rotate90 에서 화면 Δy 가 ★0.8px 짧았다(미규명).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const aliasPath = path.join(os.tmpdir(), `fgeom-sdl-${process.pid}.mjs`);
fs.copyFileSync(path.join(ROOT, 'js/frame-geometry.js'), aliasPath);
const G = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* 기저 — ★앱이 실제로 거는 transform 에서 ★유도한다(⛔손으로 적은 숫자가 아니다).
   `composeFrameTransformString` 이 쓰는 꼴: translate() rotate(rd) scale(fx,fy) · 거기에 캔버스 줌 s.
   로컬 (1,0)·(0,1) 이 화면에서 가는 벡터 = s · R(rd) · S(fx,fy) 의 열벡터. */
const basisOf = (s, rdDeg, fx, fy) => {
  const th = rdDeg * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
  return { ex: [s * cos * fx, s * sin * fx], ey: [s * -sin * fy, s * cos * fy] };
};
const apply = (basis, d) => [basis.ex[0] * d.dx + basis.ey[0] * d.dy, basis.ex[1] * d.dx + basis.ey[1] * d.dy];
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

test('⑴ ★★변환이 없으면 ★옛 식(/scale)과 ★한 치도 다르지 않다 — 플립 안 쓴 문서는 ★안 바뀐다', () => {
  for (const s of [0.1, 0.25, 0.4, 1, 2, 4]) {           // 이 앱의 줌 범위(10~400%)
    const basis = basisOf(s, 0, 1, 1);
    for (const [dx, dy] of [[60, 40], [-7, 13], [0, 0], [1, 0], [0, -1], [333, -222]]) {
      const got = G.localDeltaFromBasis(basis, dx, dy);
      assert.ok(got, `★줌 ${s} · (${dx},${dy}) 에서 null 이 나왔다 — 변환이 없는 판은 ★반드시 값이 나와야 한다`);
      assert.ok(near(got.dx, dx / s) && near(got.dy, dy / s),
        `★줌 ${s} · 화면(${dx},${dy}): 새 식 (${got.dx},${got.dy}) ≠ 옛 식 (${dx / s},${dy / s}) — ` +
        '★변환 안 쓴 문서가 ★한 픽셀이라도 달라지면 ★그건 회귀다');
    }
  }
});

test('⑵ 다섯 꼴 — ★왕복이 닫힌다(기저로 되돌려 곱하면 ★원래 화면 Δ)', () => {
  const S = 0.4;                                          // 현빈 실사용 줌
  const CASES = [
    ['변환없음', basisOf(S, 0, 1, 1)],
    ['flipH', basisOf(S, 0, -1, 1)],
    ['flipV', basisOf(S, 0, 1, -1)],
    ['flipH+V', basisOf(S, 0, -1, -1)],
    ['rotate90', basisOf(S, 90, 1, 1)],
    ['rotate45+flipH', basisOf(S, 45, -1, 1)],            // ★섞인 꼴도 — 플립과 회전이 같이 걸릴 수 있다
  ];
  for (const [name, basis] of CASES) {
    for (const [dx, dy] of [[60, 40], [-25, 7]]) {
      const local = G.localDeltaFromBasis(basis, dx, dy);
      assert.ok(local, `${name}: null`);
      const back = apply(basis, local);
      assert.ok(near(back[0], dx, 1e-6) && near(back[1], dy, 1e-6),
        `${name}: 화면(${dx},${dy}) → 로컬(${local.dx.toFixed(3)},${local.dy.toFixed(3)}) → 되돌리니 (${back[0].toFixed(6)},${back[1].toFixed(6)})`);
    }
  }
  /* ★전제 — 이 꼴들이 ★서로 다른 답을 준다(안 그러면 위 단언이 ★항등식에 가깝다) */
  const answers = CASES.map(([, b]) => JSON.stringify(G.localDeltaFromBasis(b, 60, 40)));
  assert.equal(new Set(answers).size, CASES.length,
    `★여섯 꼴이 ★같은 답을 줬다 — 그러면 왕복 단언이 ★아무것도 안 가른다. 답: ${answers.join(' / ')}`);
  /* ★그리고 ★flip 은 ★부호만 뒤집는다 — 증상(「움직임이 반대」)과 ★같은 말인지 확인 */
  const base = G.localDeltaFromBasis(basisOf(S, 0, 1, 1), 60, 40);
  const fh = G.localDeltaFromBasis(basisOf(S, 0, -1, 1), 60, 40);
  const fv = G.localDeltaFromBasis(basisOf(S, 0, 1, -1), 60, 40);
  assert.ok(near(fh.dx, -base.dx) && near(fh.dy, base.dy), `flipH 는 ★x 부호만 뒤집어야 한다 ${JSON.stringify(fh)}`);
  assert.ok(near(fv.dx, base.dx) && near(fv.dy, -base.dy), `flipV 는 ★y 부호만 뒤집어야 한다 ${JSON.stringify(fv)}`);
});

test('⑶ 퇴화·결손에서 ★null — 부르는 자가 ★옛 식으로 떨어질 수 있게', () => {
  const S = 0.4;
  const BAD = [
    ['null 기저', null],
    ['빈 객체', {}],
    ['scale(0) 프레임', basisOf(0, 0, 1, 1)],
    ['x 축이 0 (width:0)', { ex: [0, 0], ey: [0, S] }],
    ['y 축이 0', { ex: [S, 0], ey: [0, 0] }],
    ['두 축이 평행(퇴화)', { ex: [S, S], ey: [2 * S, 2 * S] }],
    ['NaN', { ex: [NaN, 0], ey: [0, S] }],
    ['길이가 틀림', { ex: [S], ey: [0, S] }],
    ['배열이 아님', { ex: 'x', ey: [0, S] }],
  ];
  for (const [name, basis] of BAD) {
    assert.equal(G.localDeltaFromBasis(basis, 60, 40), null,
      `★${name}: null 이 아니다 ⇒ ★퇴화 변환에서 ★터지거나 ★엉뚱한 수가 모델에 들어간다`);
  }
  /* ★Δ 가 비수인 경우도 — 입력 쪽 결손 */
  assert.equal(G.localDeltaFromBasis(basisOf(S, 0, 1, 1), NaN, 40), null, '★화면 Δ 가 NaN 이면 null');
  /* ★★양성대조 — 위 BAD 를 거르는 그 자가 ★정상 기저는 ★통과시킨다(「전부 null」이면 아무것도 안 잰다) */
  assert.ok(G.localDeltaFromBasis(basisOf(S, 0, 1, 1), 60, 40), '★정상 기저가 null 이 됐다 — 자가 너무 좁다');
});

test('⑷ 호출부(block-drag.js) — ★제스처당 한 번만 재고 ★폴백을 가졌다', () => {
  const t = read('js/block-drag.js');
  /* ⒜ 재는 자리가 ★onMove 「밖」인가 — onMove 안에 있으면 ★틱마다 강제 레이아웃 2회가 된다 */
  const n = (t.match(/measureLocalBasis\(/g) || []).length;
  assert.equal(n, 1, `★measureLocalBasis 호출이 ${n}곳 — ★제스처당 한 번이어야 한다(1곳)`);
  const mi = t.indexOf('measureLocalBasis(dragEl)');
  assert.ok(mi > 0, '★앵커 measureLocalBasis(dragEl) 를 못 찾았다 — 이름이 바뀌면 ★이 검사도 같이 고쳐라');
  /* ⚠️★이 파일엔 `function onMove(ev)` 가 ★여럿이다(제스처마다 하나) — ⛔`indexOf` 로 ★첫 일치를 보면
     ★엉뚱한 제스처와 견준다(2026-10-20 에 ★실제로 그렇게 ★거짓 빨강이 났다).
     ⇒ ★★«그 측정 ★뒤에 오는 ★첫 onMove»와 ★그 ★앞에 오는 ★마지막 onMove 를 ★둘 다 본다. */
  const all = [...t.matchAll(/function onMove\(ev\)/g)].map(m => m.index);
  assert.ok(all.length >= 1, '★onMove 를 못 찾았다');
  const nextOnMove = all.find(i => i > mi);
  const prevOnMove = [...all].reverse().find(i => i < mi);
  assert.ok(nextOnMove !== undefined,
    `★측정(${mi}) ★뒤에 onMove 가 ★없다 ⇒ ★그 측정은 ★어느 제스처에도 안 속한다(또는 ★onMove 안에 있다)`);
  /* ★제스처 범위 판정 — 측정은 ★그 제스처의 onMove ★«앞»이어야 한다. 앞에 onMove 가 있어도
     ★그건 ★다른(이전) 제스처의 것이므로, ★판정은 ★«뒤에 onMove 가 있나»로 한다. */
  assert.ok(nextOnMove > mi,
    `★기저 측정이 onMove ★«안»에 있다(measure=${mi} 다음 onMove=${nextOnMove}) ⇒ ★드래그 틱마다 ★강제 레이아웃 2회. ` +
    '★mousedown 안 · onMove 밖에 둬라(_hist 와 같은 층).');
  /* ★그리고 ★그 제스처의 onMove 안에서 ★쓰인다(측정만 하고 ★안 쓰면 ★조용히 아무 일 없음) */
  const body = t.slice(nextOnMove, t.indexOf('function onUp', nextOnMove) > 0 ? t.indexOf('function onUp', nextOnMove) : nextOnMove + 6000);
  assert.match(body, /_toLocal\(/, '★그 제스처의 onMove 가 ★_toLocal 을 ★안 쓴다 — 재고 ★안 쓰면 ★고침이 ★죽는다');
  void prevOnMove;
  /* ⒝ 폴백 — null 이면 옛 식으로 */
  assert.match(t, /localDeltaFromBasis\(_localBasis,\s*sx,\s*sy\)\s*\|\|\s*\{\s*dx:\s*sx\s*\/\s*scale,\s*dy:\s*sy\s*\/\s*scale\s*\}/,
    '★폴백(`|| { dx: sx / scale, dy: sy / scale }`)이 없다 ⇒ ★퇴화 변환에서 ★이동이 ★죽는다(undefined 가 모델에 들어간다)');
  /* ⒞ 옛 식이 ★그 자리에 남아 있지 않은가 — 고친 두 줄이 ★진짜 바뀌었나 */
  assert.ok(!/const rawLeft = Math\.round\(startLeft \+ cdx \/ scale\)/.test(t),
    '★옛 식(`startLeft + cdx / scale`)이 ★그대로 있다 ⇒ ★고침이 ★안 걸렸다');
  assert.match(t, /const rawLeft = Math\.round\(startLeft \+ _d\.dx\)/, '★새 식이 없다');
});
