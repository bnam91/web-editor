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

/* ★★1020t1d-⒞ — ★기저를 쓰는 ★자리의 ★명부. ★★«수»를 손으로 세지 마라 — ★명부의 ★길이가 곧 기대값이다.
     ★새 자리를 더하면 ★여기 ★한 줄을 더해야 하고, 안 더하면 ⑷ 의 ★개수 단언이 ★빨개진다
     (2026-09-30 「명부가 둘이면 경고 주석으로 못 막는다 — 파생시켜 하나로」).
   ★각 칸의 뜻:
     anchor   = 기저를 ★재는 그 줄(제스처당 ★1회여야 한다)
     onMoveTok= 그 제스처의 onMove 를 ★여는 글(파일에 여러 벌이 있어 ★꼴이 다르다)
     toLocal  = 그 onMove 가 ★쓰는 변환 함수 이름(재고 ★안 쓰면 ★조용히 아무 일 없음)
     fallback = 기저를 ★못 구했을 때 ★옛 식으로 떨어지는 줄(★무회귀의 근거) */
const BASIS_SITES = [
  { name: '⒜⒝ 일반 블록 끌기',  anchor: 'measureLocalBasis(dragEl)', onMoveTok: 'function onMove(ev)', toLocal: '_toLocal(',  basisVar: '_localBasis' },
  { name: '⒞ 조커 끌기',        anchor: 'measureLocalBasis(block)',  onMoveTok: 'function onMove(ev)', toLocal: '_toLocalJ(', basisVar: '_jokerBasis' },
  { name: '⒞ 속프레임 끌기',     anchor: 'measureLocalBasis(ss)',     onMoveTok: 'const onMove = ev =>', toLocal: '_toLocalF(', basisVar: '_ssBasis' },
];

test('⑷ 호출부(block-drag.js) — ★자리마다 ★제스처당 한 번만 재고 ★쓰고 ★폴백을 가졌다', () => {
  const t = read('js/block-drag.js');
  /* ⒜ ★재는 횟수 = ★명부의 길이. ⛔맨숫자를 적지 않는다 */
  const n = (t.match(/measureLocalBasis\(/g) || []).length;
  assert.equal(n, BASIS_SITES.length,
    `★measureLocalBasis 호출이 ${n}곳인데 명부는 ${BASIS_SITES.length}줄이다 — ` +
    '★자리를 더했으면 ★BASIS_SITES 에도 ★한 줄 더해라(안 그러면 그 자리는 ★아무도 안 잰다).');

  for (const S of BASIS_SITES) {
    /* ⒝ 앵커가 ★꼭 하나 — 둘이면 제스처당 2회가 되고, 없으면 이름이 바뀐 것이다 */
    const hits = [...t.matchAll(new RegExp(S.anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map(m => m.index);
    assert.equal(hits.length, 1, `★[${S.name}] 앵커 «${S.anchor}» 가 ${hits.length}곳 — 1곳이어야 한다`);
    const mi = hits[0];

    /* ⒞ ★그 측정은 ★onMove 「밖」이어야 한다 — 안이면 ★틱마다 강제 레이아웃 2회.
       ⚠️이 파일엔 onMove 가 ★여럿이라 ⛔첫 일치를 보면 ★엉뚱한 제스처와 견준다(2026-10-20 거짓 빨강).
       ⇒ ★그 측정 ★뒤에 오는 ★첫 onMove 를 ★그 제스처의 것으로 본다. */
    const all = [...t.matchAll(new RegExp(S.onMoveTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map(m => m.index);
    const nextOnMove = all.find(i => i > mi);
    assert.ok(nextOnMove !== undefined,
      `★[${S.name}] 측정(${mi}) ★뒤에 «${S.onMoveTok}» 가 ★없다 ⇒ 어느 제스처에도 안 속하거나 ★onMove 안에 있다`);

    /* ⒟ ★그 제스처의 onMove 가 ★정말 그 변환을 쓴다 — ★재고 안 쓰면 ★고침이 죽는다 */
    const endTok = Math.min(...['function onUp', 'const onUp'].map(k => {
      const i = t.indexOf(k, nextOnMove); return i > 0 ? i : t.length;
    }));
    const body = t.slice(nextOnMove, endTok);
    assert.ok(body.includes(S.toLocal),
      `★[${S.name}] 그 제스처의 onMove 가 «${S.toLocal}» 을 ★안 쓴다 — 재고 ★안 쓰면 ★조용히 아무 일 없음이다`);

    /* ⒠ ★폴백 — null 이면 ★옛 식(`/ scale`)으로. ★이것이 ★무회귀의 근거다 */
    const fb = new RegExp('localDeltaFromBasis\\(' + S.basisVar + ',\\s*sx,\\s*sy\\)\\s*\\|\\|\\s*\\{\\s*dx:\\s*sx\\s*/\\s*scale,\\s*dy:\\s*sy\\s*/\\s*scale\\s*\\}');
    assert.match(t, fb,
      `★[${S.name}] 폴백이 없다 ⇒ ★퇴화 변환(scale(0) 등)에서 ★이동이 죽고 undefined 가 모델에 들어간다`);
  }
});

test('⑸ ⒞ — ★고친 ★네 자리가 ★옛 식을 ★안 남겼다(★새 꼴 ＋ ★반례를 ★한 쌍으로)', () => {
  const t = read('js/block-drag.js');
  /* ★각 줄마다 ⒤ ★새 꼴이 있다 ⒥ ★옛 꼴이 ★없다 — ★둘을 ★한 쌍으로 건다.
     ⛔「없다」만 걸면 ★이름을 바꾸기만 해도 통과한다(2026-10-09 이스케이프 1글자 = 항등식).
     ★실측 근거는 각 줄 옆 주석에 — ★전부 c97ee65c 판에서 ★빨강이던 칸이다. */
  const PAIRS = [
    { name: '피어 동시이동(일반 끌기)',
      now: /const scaledDx = Math\.round\(_d\.dx\);/,
      old: /const scaledDx = Math\.round\(cdx \/ scale\);/ },
    { name: '피어 동시이동(일반 끌기) y',
      now: /const scaledDy = Math\.round\(_d\.dy\);/,
      old: /const scaledDy = Math\.round\(cdy \/ scale\);/ },
    { name: '조커 새 자리',
      now: /const newLeft = Math\.round\(startLeft \+ _dj\.dx\);/,
      old: /const newLeft = Math\.round\(startLeft \+ cdx \/ scale\);/ },
    { name: '속프레임 새 자리',
      now: /let newLeft = Math\.round\(origLeft \+ _df\.dx\);/,
      old: /let newLeft = Math\.round\(origLeft \+ cdx \/ scale\);/ },
    { name: '속프레임 피어',
      now: /peer\.el\.style\.left = Math\.round\(peer\.startLeft \+ _df\.dx\) \+ 'px';/,
      old: /peer\.el\.style\.left = Math\.round\(peer\.startLeft \+ cdx \/ scale\) \+ 'px';/ },
  ];
  for (const P of PAIRS) {
    assert.match(t, P.now, `★[${P.name}] ★새 꼴이 없다 — 고침이 ★안 걸렸거나 이름이 바뀌었다`);
    assert.ok(!P.old.test(t), `★[${P.name}] ★옛 꼴(\`/ scale\`)이 ★그대로 남아 있다 ⇒ ★그 자리는 ★안 고쳐졌다`);
  }

  /* ★★시작 «자리»도 고쳤다 — 속프레임의 origLeft/origTop 은 ★화면 rect 차가 ★아니라
       ★style.left/top 이 ★먼저다. ★실측(c97ee65c · style.left='0px'):
         플립없음 origLeft 0 / flipH ★496 / flipV origTop ★100 / 둘다 ★496·100 / rot90 ★100
       ⇒ 첫 틱에 ★496px 이 더해져 속프레임이 ★튀었다(모델 0 → 521).
     ⛔rect 길을 ★지우면 안 된다 — 그 길은 ★style.left 가 ★아예 없는 흐름 자식을 막는 자리다. */
  assert.match(t, /const origLeft = localStartFromStyle\(ss\.style\.left, \(_ssRect\.left - _parentRect\.left\) \/ scale\);/,
    '★속프레임 시작 자리가 ★localStartFromStyle 를 안 쓴다 ⇒ ★플립 프레임에서 ★첫 틱에 ★튄다');
  assert.match(t, /const origTop  = localStartFromStyle\(ss\.style\.top,  \(_ssRect\.top  - _parentRect\.top\)  \/ scale\);/,
    '★속프레임 시작 자리(top)가 ★localStartFromStyle 를 안 쓴다');
  assert.ok(!/const origLeft = \(_ssRect\.left - _parentRect\.left\) \/ scale;/.test(t),
    '★옛 식(rect 차 단독)이 ★그대로 남아 있다 ⇒ ★시작자리가 ★안 고쳐졌다');
  assert.match(t, /import \{[^}]*localStartFromStyle[^}]*\} from '\.\/frame-geometry\.js'/,
    '★localStartFromStyle 를 ★import 안 했다 — 쓰는 줄만 있으면 ★런타임에 터진다');
  assert.ok(!/const _pxOf = /.test(t),
    '★단위 거르개를 ★block-drag 안에서 ★제 벌로 다시 세고 있다 ⇒ ★둘째 명부다(판정은 frame-geometry 한 자리)');
  assert.match(t, /_ssRect\.left - _parentRect\.left/,
    '★rect 폴백이 ★사라졌다 — ★style.left 가 ★없는(흐름 자식) 요소가 ★마우스에 붙어 이동한다');
});

test('⑹ ⒞ — flip/rotate 에서 ★옛 식과 ★달라야 한다(여기서 같아지면 ★고침이 죽은 것)', () => {
  const S = 0.4;
  /* ★⑴ 이 「변환 없으면 ★같다」를 잠그므로, ★그 짝으로 「변환 있으면 ★다르다」를 잠근다.
     ★이 둘이 ★같이 있어야 ⑴ 이 ★항등식으로 죽지 않는다. */
  const SHAPES = [
    ['flipH',    basisOf(S, 0, -1, 1)],
    ['flipV',    basisOf(S, 0, 1, -1)],
    ['flipH+V',  basisOf(S, 0, -1, -1)],
    ['rotate90', basisOf(S, 90, 1, 1)],
  ];
  for (const [name, basis] of SHAPES) {
    const got = G.localDeltaFromBasis(basis, 60, 40);
    assert.ok(got, `★${name}: null 이 나왔다`);
    const old = { dx: 60 / S, dy: 40 / S };          // 옛 식 — 캔버스 줌 하나만 본다
    assert.ok(Math.abs(got.dx - old.dx) > 1e-6 || Math.abs(got.dy - old.dy) > 1e-6,
      `★${name}: 새 식 (${got.dx},${got.dy}) 이 ★옛 식 (${old.dx},${old.dy}) 과 ★같다 ⇒ ★아무것도 안 고친 것이다`);
  }

  /* ★★피어 불변식 — ★같은 프레임의 ★형제는 ★같은 기저를 쓴다 ⇒ ★같은 화면 Δ 는 ★같은 로컬 Δ.
     ★이것이 ★:937·:3027 을 `_d`/`_df` 로 ★파생시킨 ★까닭이다(둘째 명부 금지).
     ⛔「둘을 같은 식으로 계산했으니 같다」는 ★항등식이다 ⇒ ★옛 식과 ★견준다. */
  const basis = basisOf(S, 0, -1, 1);                 // flipH
  const shared = G.localDeltaFromBasis(basis, 60, 40);
  const peerOld = { dx: 60 / S, dy: 40 / S };         // 피어가 ★제 벌로 세던 옛 식
  assert.ok(Math.sign(shared.dx) !== Math.sign(peerOld.dx),
    `★flipH 에서 피어의 옛 식(${peerOld.dx})과 새 식(${shared.dx})이 ★같은 방향이다 — ` +
    '★그러면 「끄는 놈은 맞고 피어만 반대로 날아간다」를 ★못 잡는다');
});

test('⑺ ⒞ ★동반 고친 ★네 자리의 ★무회귀 — ★변환 없음에서 ★고치기 전 판과 ★한 픽셀도 다르지 않다', () => {
  /* ★왜 이 검사가 있나 — ★이 네 자리는 ★재현을 ★안 쟀고(㉧ 참조) ★까닭만 보고 고쳤다:
       `block-drag.js:3027·3028` 피어   — ss 와 ★같은 부모의 형제라 ★기저가 같다
       `block-drag.js:1126`·`:3004` 히스토리Δ — js/CLAUDE.md 가 ★「캔버스 좌표」를 요구한다
     ⇒ ★재현을 못 세웠으니 ★최소한 ★무회귀는 ★잠근다(지디 판정 2026-10-20 §3).
     ★★기대값은 ★«고치기 전 판의 식»(`Δ / scale`)으로 ★따로 계산해 ★리터럴로 박았다.
       ⛔피검 대상(localDeltaFromBasis)에서 뽑지 ★않았다 — 뽑으면 ★항등식이 되어 ★아무것도 안 잠근다.
     ★이 단언이 ★거짓이 되는 판: ★변환 없는 문서에서 ★한 픽셀이라도 달라지는 ★모든 고침. */

  /* 피어 자리 — pre-fix: `Math.round(startLeft + cdx / scale)` · [줌, 시작, cdx, cdy, 기대left, 기대top] */
  const PEER_PREFIX = [
    [0.1, 80, 60, 40, 680, 480],      [0.1, 0, -25, 7, -250, 70],     [0.1, 1234, 333, -222, 4564, -986],
    [0.25, 80, 60, 40, 320, 240],     [0.25, 0, -25, 7, -100, 28],    [0.25, 1234, 333, -222, 2566, 346],
    [0.4, 80, 60, 40, 230, 180],      [0.4, 0, -25, 7, -62, 18],      [0.4, 1234, 333, -222, 2067, 679],
    [1, 80, 60, 40, 140, 120],        [1, 0, -25, 7, -25, 7],         [1, 1234, 333, -222, 1567, 1012],
    [2, 80, 60, 40, 110, 100],        [2, 0, -25, 7, -12, 4],         [2, 1234, 333, -222, 1401, 1123],
    [4, 80, 60, 40, 95, 90],          [4, 0, -25, 7, -6, 2],          [4, 1234, 333, -222, 1317, 1179],
  ];
  for (const [s, start, cdx, cdy, wantL, wantT] of PEER_PREFIX) {
    const d = G.localDeltaFromBasis(basisOf(s, 0, 1, 1), cdx, cdy);
    assert.ok(d, `★줌 ${s}: 변환 없는 판에서 null 이 나왔다`);
    const gotL = Math.round(start + d.dx), gotT = Math.round(start + d.dy);
    assert.equal(gotL, wantL,
      `★피어 left — 줌 ${s} · start ${start} · cdx ${cdx}: 새 식 ${gotL} ≠ ★고치기 전 ${wantL} ⇒ ★변환 안 쓴 문서가 ★움직였다(회귀)`);
    assert.equal(gotT, wantT,
      `★피어 top — 줌 ${s} · start ${start} · cdy ${cdy}: 새 식 ${gotT} ≠ ★고치기 전 ${wantT} ⇒ ★회귀`);
  }

  /* 히스토리Δ 자리 — pre-fix: `(dx / scale, dy / scale)` ★반올림 없음 */
  const HIST_PREFIX = [
    [0.1, 60, 40, 600, 400],    [0.1, -7, 13, -70, 130],
    [0.25, 60, 40, 240, 160],   [0.25, -7, 13, -28, 52],
    [0.4, 60, 40, 150, 100],    [0.4, -7, 13, -17.5, 32.5],
    [1, 60, 40, 60, 40],        [1, -7, 13, -7, 13],
    [2, 60, 40, 30, 20],        [2, -7, 13, -3.5, 6.5],
    [4, 60, 40, 15, 10],        [4, -7, 13, -1.75, 3.25],
  ];
  for (const [s, dx, dy, wantX, wantY] of HIST_PREFIX) {
    const d = G.localDeltaFromBasis(basisOf(s, 0, 1, 1), dx, dy);
    assert.ok(d, `★줌 ${s}: null`);
    assert.ok(near(d.dx, wantX) && near(d.dy, wantY),
      `★히스토리Δ — 줌 ${s} · 화면(${dx},${dy}): 새 식 (${d.dx},${d.dy}) ≠ ★고치기 전 (${wantX},${wantY}) ⇒ ` +
      '★⌘Z 가 되돌리는 거리가 ★변환 없는 문서에서 ★달라진다(js/CLAUDE.md 히스토리 규약)');
  }

  /* ★전제 — ★이 표가 ★항등식이 아니다: ★같은 입력에 ★플립을 걸면 ★기대값이 ★틀려야 한다.
     ⛔이 칸이 없으면 위 단언이 「언제나 참」인지 ★알 수 없다. */
  const flipped = G.localDeltaFromBasis(basisOf(0.4, 0, -1, 1), 60, 40);
  assert.notEqual(Math.round(80 + flipped.dx), 230,
    '★flipH 에서도 230 이 나왔다 ⇒ 위 표는 ★기저와 무관한 ★항등식이다(아무것도 안 잠근다)');
});

test('⑻ ⒞ ★시작자리 — ★보더 너비를 ★안 먹고 ★px 아닌 단위는 ★폴백으로 (localStartFromStyle)', () => {
  /* ★★기대값의 출처 = ★실앱 실측(2026-10-20 · 헤드리스 크롬 · 줌 40% · style.left='120px' 인 속프레임).
       ★가라앉기를 기다린 뒤 ×3 동일 · 두 번 읽어 같음:
         꾸밈 없음   rect길 120  style길 120  → 어긋남 [0,0]
         보더 2px    rect길 122  style길 120  → 어긋남 ★[2,2]   ← ★보더 너비
         패딩 8px    rect길 120  style길 120  → 어긋남 [0,0]    ← 패딩은 ★무관
     ⇒ ★옛 식(rect 차)은 ★보더가 있으면 122 를 준다. ★새 식은 ★120 을 줘야 한다.
     ⛔이 수를 피검 대상에서 뽑지 않았다 — ★앱에서 ★재서 적었다. */
  const STYLE = '120px', TRUE_LOCAL = 120;
  const RECT_NO_BORDER = 120;     // 실측 — 꾸밈 없음(두 길이 ★같다)
  const RECT_BORDER2   = 122;     // 실측 — 보더 2px(옛 식이 주던 값)

  /* ⒜ ★보더가 있어도 ★style 값을 준다 = ★보더 너비를 ★안 먹는다 */
  assert.equal(G.localStartFromStyle(STYLE, RECT_BORDER2), TRUE_LOCAL,
    `★보더 2px 판에서 시작자리가 ${RECT_BORDER2} 가 나왔다 ⇒ ★보더 너비를 먹었다. ` +
    '★그러면 보더 있는 프레임이 ★첫 끌기 틱에 ★2px 튄다(핀 실측 [27,17] vs 기대 [25,15]).');

  /* ⒝ ★항등식 방지 — ★보더 0 인 판에서는 ★두 길이 ★같다.
     ⛔이 칸이 없으면 ⒜ 가 「언제나 style 을 준다」는 ★뻔한 말이 되어 ★보더를 안 재는 것과 구분이 안 된다.
     ⇒ ★두 폴백이 ★서로 다른 값이고(120 vs 122), ⒜ 가 ★그 차를 ★가른다는 것을 ★여기서 보인다. */
  assert.notEqual(RECT_NO_BORDER, RECT_BORDER2,
    '★실측 두 값이 같다 ⇒ 위 단언은 ★보더를 안 가른다(기대값 출처를 다시 재라)');
  assert.equal(G.localStartFromStyle(STYLE, RECT_NO_BORDER), TRUE_LOCAL, '★보더 0 판에서도 style 값');
  /* ★그리고 ★폴백이 ★정말 쓰이는가 — ★안 쓰이면 「흐름 자식이 마우스에 붙어 이동」이 되살아난다 */
  assert.equal(G.localStartFromStyle('', RECT_BORDER2), RECT_BORDER2,
    "★style.left 가 ★빈 문자열('')일 때 ★폴백을 안 쓴다 ⇒ `js/overlay-float.js:484` 가 비운 프레임에서 ★터진다");

  /* ⒞ ★단위 거르개 — ★px 만. ★실측 표(헤드리스 크롬이 ★정규화한 뒤의 값) */
  const UNITS = [
    ['0px', 0, '브라우저가 `0` 을 `0px` 로 정규화한다'],
    ['120px', 120, '보통 꼴'],
    ['100.5px', 100.5, '소수'],
    ['100px', 100, '`1e2px` 가 `100px` 로 정규화된다'],
  ];
  for (const [v, want, why] of UNITS)
    assert.equal(G.localStartFromStyle(v, 999), want, `★${v} (${why}) → ${want} 이어야 한다`);

  const FALLBACK = [
    ['50%', '★퍼센트를 ★픽셀로 읽으면 ★새 손상이다 — parseFloat 단독은 50 ＋ isFinite true 다'],
    ['calc(100% - 10px)', 'calc 는 숫자가 아니다'],
    ['', "overlay-float.js:484 가 ★비운다"],
    ['auto', '초기값'],
    [undefined, '칸이 아예 없다'],
    [null, '널'],
  ];
  for (const [v, why] of FALLBACK)
    assert.equal(G.localStartFromStyle(v, 777), 777,
      `★${JSON.stringify(v)} (${why}) 에서 ★폴백(777)으로 안 떨어졌다`);
});
