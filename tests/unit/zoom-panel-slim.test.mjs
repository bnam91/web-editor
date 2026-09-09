/* zoom-panel-slim — 확대블럭 우측 패널 «덜어내기». 현빈 2026-09-09
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리 인자)로 부르지 마라 — Node 24 에서 한 개도 안 돌고
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다.
 *
 * ★현빈 원문
 *   「벌림 음수 안 되게 양(陽) 간만 / 좁아짐 슬라이더는 기능 없어도 될 듯 /
 *     외 우측 패널에서 이펙트 섹션에서 대부분이 필요 없다. 왜냐면은 캔버스에서 조절하면 될 거
 *     같거든. 그래서 방향·길이·좁아짐 이거는 없어도 될 듯해」
 *
 * ★★이 파일의 규율 — 「입력이 살아 있다」를 «먼저» 단언한다.
 *   「없다」를 세는 검사는 훑을 것이 사라지면 «자기통과»한다. 패널이 통째로 비어도
 *   「zm-narrow 가 없다」는 초록이다. 그래서 각 검사의 첫 줄은 «무엇을 훑고 있는지»를 센다.
 *
 * ⚠️이 파일은 «소스 문자열»도 단언한다. 정상 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 지우지 말고 「현빈이 요구한 셋이 여전히 성립하는가」를 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sliceBlock } from './_slice-block.js';   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
/* ⛔주석 걷어내기는 «공용 부품»만 쓴다 — 자기 벌을 만들면 S-6 가 즉시 빨강. */
const { stripComments } = require('./_strip-comments.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const F_PROP  = 'js/props/prop-zoom.js';
const F_BLOCK = 'js/blocks/zoom-block.js';
const F_GEOM  = 'js/blocks/zoom-geometry.js';

const RAW  = { prop: read(F_PROP), block: read(F_BLOCK), geom: read(F_GEOM) };
const SRC  = { prop: stripComments(RAW.prop), block: stripComments(RAW.block), geom: stripComments(RAW.geom) };

/* 기하는 «진짜 실행»으로 잰다 — 이 레포는 package.json 이 "type":"commonjs" 라
   js/**.js 를 node 가 못 읽는다. tmp `.mjs` 사본을 동적 import 한다(집 관용구). */
let _modP = null;
function loadGeom() {
  if (!_modP) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoom-panel-slim-'));
    const mjs = path.join(dir, 'zoom-geometry.mjs');
    fs.copyFileSync(path.join(ROOT, F_GEOM), mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}

const ST = {
  shape: 'rect', angle: -90, length: 170, spread: 0,
  maxop: 30, curve: 100, narrow: 62, size: 260, rot: 0,
  fill: '#cfd6e0', shadow: 'on', bd: 'off', bdw: 6, bdc: '#ffffff', bdr: 0, w: null, h: null,
};
const key = (geo) => [geo.A, geo.B, geo.a, geo.b, geo.L]
  .map(P => P.x.toFixed(6) + ',' + P.y.toFixed(6)).join(' ');

/** `_pairRow('zm-xxx', …)` 한 줄의 «인자 목록»을 통째로 떼어낸다. 없으면 null. */
function pairRowArgs(src, id) {
  const at = src.indexOf(`_pairRow('${id}'`);
  if (at < 0) return null;
  let i = src.indexOf('(', at), depth = 0, from = i;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) break; }
  }
  assert.ok(depth === 0, `_pairRow 인자 괄호가 안 닫힌다: ${id}`);
  return src.slice(from + 1, i).split(',').map(s => s.trim());
}

/** `bindPair('zm-xxx', …)` 의 인자 목록. 없으면 null. */
function bindPairArgs(src, id) {
  const at = src.indexOf(`bindPair('${id}'`);
  if (at < 0) return null;
  const close = src.indexOf(')', at);
  assert.ok(close > at, `bindPair 인자 괄호가 안 닫힌다: ${id}`);
  return src.slice(src.indexOf('(', at) + 1, close).split(',').map(s => s.trim());
}

/* ═══════════════════════════════════════════════════════════════════════════
   T1 — 벌림 슬라이더 하한이 «정확히» 0
     ⛔`>=` 로 재면 안 된다. −400 → −1 로 바꾼 변이도 통과해 버린다. 정확히 0 이어야 한다.
   ★변이(실행 확인): 하한을 −400 으로 되돌리면 빨강.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T1 ★벌림 슬라이더 하한 = «정확히» 0 — 음수를 «만들» 수 없다 (슬라이더·숫자·clamp 셋 다)', () => {
  // ★입력이 살아 있다 — 잴 컨트롤이 «있다»
  const row = pairRowArgs(SRC.prop, 'zm-spread');
  assert.ok(row, '벌림 슬라이더가 패널에서 사라졌다 — 아래는 잴 것이 없다');
  assert.equal(row.length, 6, `_pairRow(id,label,value,min,max,step) 여섯 인자가 아니다: ${row.join(' | ')}`);
  assert.equal(row[1], "'벌림'", `벌림 행을 잘못 짚었다: ${row.join(' | ')}`);

  // ⑴ 슬라이더·숫자 상자의 min (한 인자가 둘 다 먹인다 — _pairRow 를 보라)
  assert.equal(row[3], '0', `벌림 하한이 ${row[3]} 다 — 현빈: 「음수 안 되게 양(陽) 간만」`);
  assert.equal(row[4], '800', `벌림 상한이 바뀌었다(${row[4]}) — 현빈이 바꾸라 한 것은 «하한»뿐이다`);

  // ⑵ ★clamp 도 같이 올라갔나 — 숫자 상자에 −400 을 «타이핑»하면 여기가 막는다
  const bind = bindPairArgs(SRC.prop, 'zm-spread');
  assert.ok(bind, 'bindPair 가 사라졌다 — 슬라이더가 아무 일도 안 한다');
  assert.equal(bind.length, 5, `bindPair(id,key,label,min,max) 다섯 인자가 아니다: ${bind.join(' | ')}`);
  assert.equal(bind[1], "'spread'", `bindPair 가 다른 키에 붙었다: ${bind.join(' | ')}`);
  assert.equal(bind[3], '0',
    `bindPair 의 하한이 ${bind[3]} 다 — 슬라이더만 막고 «숫자 입력»은 음수를 그대로 받는다`);
  assert.equal(bind[4], '800', `bindPair 의 상한이 바뀌었다: ${bind[4]}`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T2 — ★옛 저장본의 «음수»를 어떻게 하기로 했나 (내가 고른 계약)
     ★고른 것: 「읽는 자리에서 0 으로 떨어뜨린다. ⛔저장본은 안 고친다.」
     ★왜 —
       ① 집 관용구다. zoom-block.js 의 _onOff · _dropShadow 가 이미 「모르는 값이 들어오면
          기본으로 떨어뜨린다(저장본 변조 대비)」로 산다. 새 방식을 안 만든다.
       ② 음수는 «진짜로 깨진다» — zoom-tangent T14 의 실측: 광원이 도형 «밖»인 60,672칸 중
          −30 에서 6,774칸이 계약을 깨고(최대 128.55px), 양수와 달리 「광원이 안」으로
          설명되는 칸이 0 이었다.
       ③ 안 자르면 «패널과 화면이 다른 말»을 한다 — range 입력은 min 아래 value 를 스스로
          0 으로 올려 잡지만 number 입력은 −30 을 그대로 보여 준다. 캔버스만 −30 으로 그린다.
     ⛔쓰지 않은 길: 「로드할 때 dataset 을 0 으로 덮어쓰기」. 그건 사람이 안 만진 저장본을
       말없이 고치는 것이라 되돌릴 값이 사라진다.
   ★변이(실행 확인): zoom-geometry 의 `Math.max(0, …)` 를 지우면 ⑵가 빨강,
     prop-zoom 의 `spreadShown` 을 `st.spread` 로 되돌리면 ⑴이 빨강.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T2 ★옛 음수 저장본 = 「보여 줄 때도 그릴 때도 0. ⛔저장본은 안 고친다」', async () => {
  /* ⑴ 패널이 «보여 주는 값»이 접혀 있다 */
  const row = pairRowArgs(SRC.prop, 'zm-spread');
  assert.ok(row, '벌림 행이 없다 — 잴 것이 없다');
  assert.equal(row[2], 'spreadShown',
    `벌림 행이 «날것»(${row[2]})을 그대로 보여 준다 — 옛 음수에서 슬라이더 0 · 숫자 −30 으로 갈린다`);
  assert.ok(/const spreadShown = Math\.max\(0, st\.spread\)/.test(SRC.prop),
    'spreadShown 이 「0 아래로 안 내려간다」로 정의돼 있지 않다');

  /* ⑵ ★기하도 «같은 자리»에서 0 으로 떨어진다 — 실행으로 잰다 */
  const g = await loadGeom();
  const base = g.computeZoomGeometry({ ...ST, spread: 0 }, null);
  // ★입력이 살아 있다 — 벌림이 «먹히는» 판에 서 있다(양수는 실제로 움직인다)
  const plus = g.computeZoomGeometry({ ...ST, spread: 120 }, null);
  assert.notEqual(key(plus), key(base),
    '전제가 깨졌다 — spread +120 이 0 과 같은 그림이다. 벌림이 안 먹는 판이면 아래 「같다」는 아무 뜻이 없다');
  for (const spread of [-1, -30, -400]) {
    assert.equal(key(g.computeZoomGeometry({ ...ST, spread }, null)), key(base),
      `spread=${spread} 가 0 과 «다른 그림»을 그린다 — 캔버스만 옛 음수로 그리고 패널은 0 을 말한다`);
  }

  /* ⑶ ⛔저장본을 말없이 고쳐 쓰지 «않는다» — 패널을 «여는 것»만으로 dataset 이 안 바뀐다.
     ★쓰는 자리는 bindPair 의 `block.dataset[key] = String(val)` «하나»뿐이고, 그건 사람이
       슬라이더를 실제로 만졌을 때만 돈다. 그 밖에 spread 를 직접 쓰는 줄이 있으면 안 된다. */
  assert.equal(/dataset\.spread\s*=/.test(SRC.prop), false,
    'prop-zoom 이 dataset.spread 를 «직접» 쓴다 — 패널을 열기만 해도 옛 값이 지워진다');
  assert.equal(/dataset\.spread\s*=/.test(SRC.geom), false,
    'zoom-geometry 가 dataset 을 만진다 — 이 파일은 «순수»여야 한다');
  assert.ok(/block\.dataset\[key\] = String\(val\)/.test(SRC.prop),
    '슬라이더가 값을 쓰는 «단 한 자리»가 사라졌다 — 그러면 벌림을 아예 못 고친다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   T3 — 방향° · 길이 · 좁아짐% 컨트롤이 패널에 «없다»
     ⛔「지웠다」가 아니라 「가렸다」다 — 원본에는 주석으로 남아 있어야 되돌릴 수 있다
       (bdr 이 남긴 선례 그대로. 검사 ⓑ-18 이 그 관용구를 못박는다).
   ★변이(실행 확인): 셋 중 하나라도 주석을 풀면 빨강.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T3 ★방향°·길이·좁아짐% 는 패널에 «없다» — 그러나 «지우지는» 않았다', () => {
  const p = SRC.prop;
  /* ★입력이 살아 있다 — 패널이 통째로 비어서 통과하는 것이 아니다.
     ⛔이 줄이 없으면 propPanel.innerHTML 을 통째로 지워도 아래가 전부 초록이다. */
  for (const alive of ['zm-spread', 'zm-maxop', 'zm-curve', 'zm-size', 'zm-rot', 'zm-bdw']) {
    assert.ok(pairRowArgs(p, alive), `전제가 깨졌다 — «남아야 할» ${alive} 가 패널에서 사라졌다`);
  }
  assert.ok(p.includes('prop-section-title'), '패널 마크업이 통째로 비었다');

  for (const [id, 이름] of [['zm-angle', '방향°'], ['zm-length', '길이'], ['zm-narrow', '좁아짐%']]) {
    // ⑴ 거른 소스(주석 제거본)에 «없어야» 가린 것이다
    assert.equal(new RegExp(id).test(p), false, `${이름}(${id}) 컨트롤이 아직 패널에 나온다`);
    // ⑵ ★그런데 지우지는 않았다 — 되돌릴 길이 원본에 남아 있다
    assert.ok(RAW.prop.includes(id), `${이름}(${id}) 를 지워버렸다 — 「가림」이 아니라 「없앰」이다`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   T4 — ★상태 키는 «살아 있다». 지우면 저장된 프로젝트가 깨진다.
     현빈이 뺀 것은 «입구»(슬라이더)지 «값»이 아니다. angle·length 는 광원 자리를,
     narrow 는 짧은 변(a·b)을 잡는다 — 셋 다 여전히 기하가 쓴다.
   ★변이(실행 확인): ZOOM_DEFAULTS 에서 narrow 를 지우면 ⑴이 빨강,
     computeZoomGeometry 가 narrow 를 안 쓰게 만들면 ⑵가 빨강.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T4 ★기본값·기하는 그대로 산다 — angle(−90) · length(170) · narrow(62)', async () => {
  /* ⑴ 기본값이 «단 한 자리»(ZOOM_DEFAULTS)에 그대로 있다 */
  const at = SRC.block.indexOf('const ZOOM_DEFAULTS = {');
  assert.ok(at >= 0, 'ZOOM_DEFAULTS 를 못 찾았다 — 아래 정규식이 전부 자기통과한다');
  const body = SRC.block.slice(at, SRC.block.indexOf('};', at));
  assert.ok(body.length > 100, `ZOOM_DEFAULTS 몸통이 비었다(${body.length}자)`);
  for (const [k, v] of [['angle', '-90'], ['length', '170'], ['narrow', '62']]) {
    const m = body.match(new RegExp(`${k}:\\s*(-?[0-9.]+)`));
    assert.ok(m, `기본값 ${k} 가 사라졌다 — 슬라이더를 가렸다고 값까지 지우면 저장본이 깨진다`);
    assert.equal(m[1], v, `기본값 ${k} 가 ${m[1]} 로 바뀌었다(기대 ${v})`);
  }
  // 읽는 자리도 살아 있다 — dataset 에서 셋을 «여전히» 읽는다
  for (const k of ['angle', 'length', 'narrow']) {
    assert.ok(new RegExp(`${k}:\\s*_num\\(d\\.${k}`).test(SRC.block),
      `readZoomState 가 dataset.${k} 를 안 읽는다 — 저장된 값이 로드에서 증발한다`);
  }

  /* ⑵ ★기하가 «실제로» 셋을 쓴다 — 값을 바꾸면 그림이 바뀐다(실행으로 잰다) */
  const g = await loadGeom();
  const base = g.computeZoomGeometry(ST, null);
  assert.ok(Number.isFinite(base.L.x), '전제: 기본 상태의 기하가 숫자다');
  for (const [k, v] of [['angle', 30], ['length', 400], ['narrow', 10]]) {
    assert.notEqual(key(g.computeZoomGeometry({ ...ST, [k]: v }, null)), key(base),
      `${k} 를 ${ST[k]} → ${v} 로 바꿨는데 기하가 «한 픽셀도» 안 움직인다 — 그 키가 죽었다`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   T5 — ★되돌릴 길이 있다
     방향°·길이 슬라이더를 뺄 수 있는 «유일한 근거»가 이것이다: 캔버스의 빨간 「빛」 손잡이로
     광원을 끌 수 있고, 「손잡이 자동으로 되돌리기」가 그 고정을 풀어 기본 방향으로 되돌린다.
     ⛔이 버튼이 사라지면 사람이 기본 각도로 돌아갈 길이 «아예» 없어진다.
   ★앱에서도 확인했다(포트 9360): 빛을 끌면 dataset.lx/ly 가 박히고 버튼이 켜지며,
     누르면 여섯 키가 사라지고 광원이 angle·length 자리로 돌아왔다.
   ★변이(실행 확인): 버튼이나 clearPinnedShortEdge 의 delete 줄을 지우면 빨강.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T5 ★「손잡이 자동으로 되돌리기」가 살아 있고 여섯 키를 «다» 푼다', () => {
  const p = SRC.prop;
  // ⑴ 버튼이 있다
  assert.ok(p.includes('id="zm-ab-reset"'), '되돌리기 버튼이 패널에서 사라졌다');
  assert.ok(/zm-ab-reset[\s\S]{0,400}?clearPinnedZoomShortEdge\?\.\(block\)/.test(p),
    '버튼이 clearPinnedZoomShortEdge 를 안 부른다 — 눌러도 아무 일도 안 난다');
  assert.ok(/zm-ab-reset[\s\S]{0,400}?rerender\(\)/.test(p),
    '되돌린 뒤 다시 그리지 않는다 — 값만 바뀌고 화면은 그대로다');

  // ⑵ ★그 함수가 «여섯 키»를 다 지운다 — 하나라도 남으면 반은 고정·반은 자동이 된다
  const fn = sliceBlock(SRC.block, 'function clearPinnedShortEdge(block)',
    'clearPinnedShortEdge 를 못 찾았다 — 아래가 자기통과한다');
  assert.ok(fn.length > 40, `함수 몸통이 비었다(${fn.length}자)`);
  for (const k of ['ax', 'ay', 'bx', 'by', 'lx', 'ly']) {
    assert.ok(new RegExp(`delete block\\.dataset\\.${k}\\b`).test(fn),
      `dataset.${k} 를 안 지운다 — 「자동으로 되돌리기」가 반만 돈다`);
  }

  // ⑶ ★빛 손잡이가 lx/ly 를 «읽는» 길도 살아 있다 (없으면 캔버스에서 끌 수가 없다)
  assert.ok(/lx = parseFloat\(d\.lx\)|const lx = parseFloat/.test(SRC.block.replace(/\s+/g, ' ')) ||
            /d\.lx/.test(SRC.block),
    'dataset.lx 를 읽는 자리가 없다 — 캔버스에서 광원을 끌어도 안 박힌다');
});
