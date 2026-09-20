/* U-OVFLOAT — 오버레이(플로팅)가 «한 곳»에서 나오는가 + 세 패널이 실제로 그걸 부르는가.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는다.
 *
 * ★왜 이 파일이 있나 (2026-09-20, 0920b-overlay-extend / T-052)
 *   현빈: 「쉐이프 블럭과 에셋블럭도 오버레이 버튼과 기능이 있어야할 것」.
 *   진입/이탈/드래그 코드는 2026-09-15~16 사이 «후속 P0 수정만 11커밋»을 받은 자리다.
 *   도형·에셋용으로 베끼면 그 11개 버그를 두 번 더 만든다 ⇒ js/overlay-float.js 한 곳으로
 *   모으고 세 패널이 그걸 «부르게» 했다. 이 파일이 지키는 것은 둘이다:
 *     ⑴ 알맹이가 두 벌이 되지 않았다            (T1·T2)
 *     ⑵ 오버레이 판정이 «텍스트 전용»으로 남지 않았다 (T3·T4·T5)
 *   ⛔⑵ 가 없으면 복사/붙여넣기·Figma 내보내기·일반 드래그 가드가 텍스트에서만 초록이고
 *     도형·에셋은 «조용히» 옛 버그(절대배치 소실 · export 드롭 · 섹션 침범)를 그대로 겪는다.
 *
 * ⚠️이 파일은 «소스 문자열»을 단언한다. 정상적인 리팩터링에도 빨강이 날 수 있다 — 그때는
 *   지우지 말고 「오버레이가 여전히 한 곳에서 오는가 / 타입 비의존인가」를 확인한 뒤 패턴을 고쳐라.
 *
 * ⛔주석 걷어내기는 공용 부품(./_strip-comments.js)만 쓴다(S-6 가 자기 벌을 막는다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { readSrc } = _req('./_srcread.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const S = (rel) => stripComments(readSrc(ROOT, rel));

const SRC = {
  float:    S('js/overlay-float.js'),
  textWire: S('js/props/prop-text-wireup-overlay.js'),
  textTpl:  S('js/props/prop-text-template.js'),
  shape:    S('js/props/prop-shape.js'),
  asset:    S('js/props/prop-asset.js'),
  helpers:  S('js/props/_helpers.js'),
  drag:     S('js/block-drag.js'),
  editor:   S('js/editor.js'),
  figma:    S('js/io/export-figma-json.js'),
  geom:     S('js/frame-geometry.js'),
  handles:  S('js/overlay-handles.js'),
};

/* ══ T0 — 입력이 살아 있다. 본 단언 «앞»에 세운다. ═══════════════════════ */
test('T0 ★소스를 실제로 읽었다(빈 문자열끼리 비교하며 초록이 되는 것을 막는다)', () => {
  for (const [k, v] of Object.entries(SRC)) {
    assert.ok(v.length > 200, `${k} 소스가 ${v.length}자다 — 경로가 바뀌었거나 파일이 비었다`);
  }
});

/* ══ T1 — 알맹이가 «한 곳»에 있다 ═════════════════════════════════════════ */
test('T1 ★진입/이탈/드래그의 알맹이가 js/overlay-float.js 에만 있다', () => {
  // 알맹이의 지문 — 섹션 직속으로 올리는 appendChild + 탄성 상수
  assert.match(SRC.float, /sec\.appendChild\(posEl\)/, 'overlay-float.js 에 진입 구현이 없다');
  assert.match(SRC.float, /OVERLAY_RESIST_ZONE_SCREEN_PX/, 'overlay-float.js 에 탄성 상수가 없다');
  for (const k of ['textWire', 'shape', 'asset']) {
    assert.doesNotMatch(SRC[k], /OVERLAY_RESIST_ZONE_SCREEN_PX\s*=/,
      `${k} 에 탄성 상수 «사본»이 생겼다 — 알맹이는 js/overlay-float.js 한 곳이다`);
    assert.doesNotMatch(SRC[k], /dataset\.overlayReturnParent\s*=/,
      `${k} 에 진입/이탈 «사본»이 생겼다 — wireFloatToggle 을 불러라`);
  }
});

test('T1-b ★회전각 읽기가 한 곳이다(frame-geometry.js) — 규약 셋이 갈라지지 않는다', () => {
  assert.match(SRC.geom, /export function blockRotationDeg/, 'blockRotationDeg 가 frame-geometry.js 에 없다');
  assert.match(SRC.geom, /shapeRotation/, 'blockRotationDeg 가 도형 규약(shapeRotation)을 안 본다');
  // overlay-handles.js 는 «자기 벌»을 갖지 않고 그 함수를 import 해서 쓴다
  assert.match(SRC.handles, /import \{[^}]*blockRotationDeg[^}]*\} from '\.\/frame-geometry\.js'/,
    'overlay-handles.js 가 blockRotationDeg 를 import 하지 않는다 — 사본이 남았다');
  assert.doesNotMatch(SRC.handles, /function _blockRotationDeg\s*\(/,
    'overlay-handles.js 에 옛 사본 함수가 남아 있다');
  assert.match(SRC.float, /blockRotationDeg/, 'overlay-float.js 가 회전각 SSOT 를 안 쓴다');
});

/* ══ T2 — 세 패널이 «그 함수를» 실제로 부른다 ════════════════════════════ */
test('T2 ★텍스트·도형·에셋 세 패널이 전부 같은 토글 버튼·같은 배선을 쓴다', () => {
  assert.match(SRC.helpers, /export function overlayToggleBtnHTML/, '버튼 SSOT 함수가 없다');
  // 버튼 «그림»
  for (const k of ['textTpl', 'shape', 'asset']) {
    assert.match(SRC[k], /overlayToggleBtnHTML\(\s*\{/, `${k} 이 overlayToggleBtnHTML 을 안 부른다`);
    assert.doesNotMatch(SRC[k], /class="prop-chain-btn prop-chain-btn--overlay/,
      `${k} 에 버튼 «리터럴 사본»이 남아 있다 — overlayToggleBtnHTML 로 부르라`);
  }
  // 클릭 «배선»
  for (const k of ['textWire', 'shape', 'asset']) {
    assert.match(SRC[k], /wireFloatToggle\(\s*\{/, `${k} 이 wireFloatToggle 을 안 부른다`);
  }
});

test('T2-b ★버튼 id 셋이 서로 다르고, 에셋은 Text Overlay 의 id 를 «재사용하지 않는다»', () => {
  const idOf = (src) => [...src.matchAll(/overlayToggleBtnHTML\(\s*\{\s*id:\s*'([^']+)'/g)].map(m => m[1]);
  const ids = [...idOf(SRC.textTpl), ...idOf(SRC.shape), ...idOf(SRC.asset)];
  assert.equal(ids.length, 3, `토글 호출이 3개가 아니다: ${JSON.stringify(ids)}`);
  assert.equal(new Set(ids).size, 3, `버튼 id 가 겹친다: ${JSON.stringify(ids)}`);
  /* ⛔asset-overlay-toggle 은 「이미지 위 어두운 막+텍스트」(Text Overlay)가 이미 쓰는 id 다.
     같은 id 를 쓰면 getElementById 가 먼저 것을 잡아 두 기능이 서로를 눌러 버린다. */
  assert.ok(!ids.includes('asset-overlay-toggle'),
    '플로팅 토글이 Text Overlay 의 id(asset-overlay-toggle)를 가로챘다');
  assert.match(SRC.asset, /id="asset-overlay-toggle"/, 'Text Overlay 체크박스가 사라졌다 — 기존 기능 회귀');
  assert.match(SRC.asset, /asset-float-toggle/, '에셋 플로팅 토글 id 가 없다');
});

/* ══ T3~T5 — 판정이 «텍스트 전용»으로 남지 않았다 ═════════════════════════ */
test('T3 ★복사/붙여넣기의 오버레이 판정에 textFrame 하드코딩이 0건이다', () => {
  const copy = SRC.editor.match(/const _overlayWrapper =[^\n]*\n[^\n]*/);
  assert.ok(copy, '복사 쪽 오버레이 판정을 못 찾았다 — 패턴을 고쳐라');
  assert.doesNotMatch(copy[0], /textFrame/, `복사 판정이 아직 텍스트 전용이다: ${copy[0]}`);
  assert.match(copy[0], /data-overlay-block/, '복사 판정이 data-overlay-block 을 안 본다');

  const paste = SRC.editor.match(/\} else if \([^)]*overlayBlock === 'true'\) \{/);
  assert.ok(paste, '붙여넣기 쪽 오버레이 분기를 못 찾았다');
  assert.doesNotMatch(paste[0], /textFrame/, `붙여넣기 분기가 아직 텍스트 전용이다: ${paste[0]}`);
});

test('T4 ★Figma 내보내기의 오버레이 분기가 도형 래퍼(frame-block)도 집는다', () => {
  /* ⛔_TRAVERSE_SKIP 이 frame-block 을 통째로 제외하므로, 도형 오버레이는 이 분기에 안 걸리면
     «화면엔 멀쩡한데 내보내기에서만 사라진다» — 가장 늦게 발견되는 부류다. */
  const idx = SRC.figma.indexOf("dataset?.overlayBlock === 'true'");
  assert.ok(idx > 0, '내보내기에 타입 비의존 오버레이 판정이 없다');
  const seg = SRC.figma.slice(idx, idx + 700);
  assert.match(seg, /shape-block/, '오버레이 분기가 도형(.shape-block)을 안 집는다');
  assert.match(seg, /offsetX/, '오버레이 좌표 규약(offsetX/offsetY)을 안 읽는다');
  // 일반 플로팅 순회는 오버레이를 «제외»해야 한다(에셋이 두 번 실리는 것 방지)
  assert.match(SRC.figma, /overlayBlock !== 'true' && _isContentBlock\(c\)/,
    '일반 플로팅 순회가 오버레이를 제외하지 않는다 — 에셋 오버레이가 중복으로 실린다');
});

test('T5 ★일반 드래그 가드가 타입 비의존이고, 도형·에셋에도 전용 드래그가 걸린다', () => {
  assert.match(SRC.drag, /_floatPosElOf\(block\)\?\.dataset\.overlayBlock === 'true'\) return;/,
    'block-drag.js 의 일반 드래그에 타입 비의존 오버레이 가드가 없다 — 섹션 침범 P0 가 도형·에셋에서 재발한다');
  assert.match(SRC.drag, /if \(isShape \|\| isAsset\) \{/,
    'block-drag.js 가 도형·에셋에 전용 이동 드래그를 안 건다');
  assert.match(SRC.drag, /_bindFloatMoveDrag\(_posForFloat\)/, '전용 드래그 바인딩 호출이 없다');
});

test('T5-b ★띄우는 동안 음수 마진을 걷어내고 이탈 때 되돌린다(풀블리드 좌표 점프)', () => {
  assert.match(SRC.float, /function _freezeMargins/, '음수 마진 처리가 없다 — 풀블리드 에셋이 좌로 뛴다');
  assert.match(SRC.float, /function _unfreezeMargins/, '되돌리기가 없다 — 이탈하면 풀블리드가 안 돌아온다');
  /* ⛔순서가 규약이다: 좌표를 «재고 난 뒤» 걷어내야 한다(먼저 걷어내면 어긋난 자리를 굳힌다). */
  assert.ok(SRC.float.indexOf('const elRect  = posEl.getBoundingClientRect();') < SRC.float.indexOf('_freezeMargins(posEl);'),
    '마진을 좌표 측정 «전»에 걷어낸다 — 그 순서면 마진만큼 어긋난 자리가 정답으로 굳는다');
});

test('T6 ★CSS z-index 규칙이 타입 비의존이다(도형 래퍼·에셋도 클릭이 닿는다)', () => {
  const css = readSrc(ROOT, 'css/editor-blocks.css');
  assert.match(css, /\.section-block > \[data-overlay-block="true"\] \{[\s\S]{0,1400}?z-index: 80 !important;/,
    'z-index 규칙이 타입 한정이거나 선택 상태 규칙에 진다 — 고르는 순간 본문 밑으로 깔린다\n' +
    '  (2026-09-20 라이브 실측: .asset-block.selected{z-index:2} · .frame-block[data-text-frame]:has(.text-block.selected){z-index:2} 가 이겼다)');
  assert.doesNotMatch(css, /^\[data-overlay-block="true"\] \{/m,
    '특이도 낮은 옛 규칙이 되살아났다 — 선택하는 순간 다시 밑으로 깔린다');
});
