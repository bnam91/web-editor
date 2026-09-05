/* 단위 하네스 — js/frame-geometry.js (P1: 회전 AABB 세로보정 + 프레임 정렬좌표 SSOT)
 * ★손으로 쓴 모델이 아니라 «실제 소스 파일»을 import 한다(save-reload-seal.test.mjs 관례).
 *   렌더러 파일은 ESM .js 인데 package type=commonjs라 Node가 직접 import 못한다
 *   → 바이트 그대로 .mjs 별칭으로 복사해 import.
 * ★기대값에 리터럴을 박지 않는다 — 회전 수식은 «독립 유도»(Math로 다시 세운 값)와 비교하고,
 *   호출부 검사는 «실제 소스 텍스트»를 읽어 센다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const srcPath = path.join(ROOT, 'js/frame-geometry.js');
const aliasPath = path.join(os.tmpdir(), `fgeom-alias-${process.pid}.mjs`);
fs.copyFileSync(srcPath, aliasPath);
const G = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── 최소 DOM 스텁: style(문자열 셋/게터) + dataset + offset*.
   ★style 은 «실제 CSSOM 처럼» removeProperty 로만 지워진다 — 코드가 마진을 정말
   지웠는지/안 지웠는지를 이 스텁이 갈라준다. */
function stubEl({ w = 0, h = 0, position = '', dataset = {}, style = {} } = {}) {
  const st = { ...style };
  return {
    offsetWidth: w, offsetHeight: h,
    dataset: { ...dataset },
    style: new Proxy(st, {
      get(t, k) {
        if (k === 'removeProperty') return p => { delete t[p.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; };
        if (k === 'position') return position;
        return t[k];
      },
      set(t, k, v) { t[k] = v; return true; },
    }),
    _raw: st,
  };
}

/* ═══ ① rotatedAABB — 독립 유도와 일치 ═══ */
test('①-a rotatedAABB 는 |w·cosθ|+|h·sinθ| / |w·sinθ|+|h·cosθ| 를 따른다 (독립 유도 대조)', () => {
  for (const [w, h, deg] of [[796,316,45],[860,520,30],[100,400,17],[796,316,-45],[200,50,123.4]]) {
    const t = deg * Math.PI / 180;
    const expW = Math.abs(w*Math.cos(t)) + Math.abs(h*Math.sin(t));
    const expH = Math.abs(w*Math.sin(t)) + Math.abs(h*Math.cos(t));
    const got = G.rotatedAABB(w, h, deg);
    assert.ok(Math.abs(got.w - expW) < 1e-9, `w ${deg}deg`);
    assert.ok(Math.abs(got.h - expH) < 1e-9, `h ${deg}deg`);
  }
});

test('①-b ★180의 배수는 «수식에 맡기면» 1px 을 만들어낸다 — 명시 분기가 살아있는지', () => {
  for (const deg of [0, 180, -180, 360]) {
    assert.deepEqual(G.rotatedAABB(796, 316, deg), { w: 796, h: 316 }, `${deg}deg AABB`);
    assert.equal(G.rotationMarginY(796, 316, deg), 0, `${deg}deg margin`);
  }
  // 왜 분기가 필요한지 — 부동소수 잔차가 실재함을 «증명»한다(이게 0이면 이 테스트는 무의미).
  assert.ok(Math.abs(Math.sin(Math.PI)) > 0, 'Math.sin(PI) 가 정확히 0이면 분기는 불필요');
  const naiveH = Math.abs(796*Math.sin(Math.PI)) + Math.abs(316*Math.cos(Math.PI));
  assert.ok(Math.ceil((naiveH - 316) / 2) === 1, '분기 없으면 180도에서 1px 이 생긴다');
});

test('①-c rotationMarginY 는 «한쪽» 보정량 = ceil((h\'-h)/2), 음수 없음', () => {
  const w = 796, h = 316, deg = 45;
  const expH = Math.abs(w*Math.sin(Math.PI/4)) + Math.abs(h*Math.cos(Math.PI/4));
  assert.equal(G.rotationMarginY(w, h, deg), Math.ceil((expH - h) / 2));
  assert.equal(G.rotationMarginY(0, 0, 45), 0);
  assert.equal(G.rotationMarginY(796, 0, 45), 0);   // 높이 0 → 0
  assert.ok(G.rotationMarginY(796, 316, 90) > 0);   // 90도는 실제 보정 필요
});

/* ═══ ② frameAlignOffset — «중앙»의 유일한 정의 ═══ */
test('②-a center/flex-end/flex-start 좌표', () => {
  assert.deepEqual(G.frameAlignOffset(860, 520, 400, 200, 'center', 'center'), { left: 230, top: 160 });
  assert.deepEqual(G.frameAlignOffset(860, 520, 400, 200, 'flex-end', 'flex-end'), { left: 460, top: 320 });
  assert.deepEqual(G.frameAlignOffset(860, 520, 400, 200, 'flex-start', 'flex-start'), { left: 0, top: 0 });
});
test('②-b null 축은 «계산 안 함»(null) — 한 축만 정렬하는 버튼과 계약이 같다', () => {
  assert.deepEqual(G.frameAlignOffset(860, 520, 400, 200, 'center', null), { left: 230, top: null });
  assert.deepEqual(G.frameAlignOffset(860, 520, 400, 200, null, 'center'), { left: null, top: 160 });
});
test('②-c 자식이 프레임보다 크면 음수 — 클램프하지 «않는» 기존 _setAlign 계약 유지', () => {
  assert.equal(G.frameAlignOffset(400, 200, 800, 400, 'center', 'center').left, -200);
});

/* ═══ ③ cascadeIfOccupied ═══ */
test('③ 같은 자리에 형제가 있으면 +20 대각 캐스케이드, 없으면 그대로', () => {
  assert.deepEqual(G.cascadeIfOccupied(230, 160, []), { left: 230, top: 160 });
  assert.deepEqual(G.cascadeIfOccupied(230, 160, [{ left: 230, top: 160 }]), { left: 250, top: 180 });
  assert.deepEqual(G.cascadeIfOccupied(230, 160, [{ left: 230, top: 160 }, { left: 250, top: 180 }]),
                   { left: 270, top: 200 });
  // 다른 자리 형제는 안 밀어낸다
  assert.deepEqual(G.cascadeIfOccupied(230, 160, [{ left: 0, top: 0 }]), { left: 230, top: 160 });
});

/* ═══ ④ applyFrameRotationMargin — «우리가 넣은 것만» 지운다 ═══ */
test('④-a 회전하면 marginTop/Bottom 을 세우고 표식(rotMarginY)을 남긴다', () => {
  const el = stubEl({ w: 796, h: 316, dataset: { rotateDeg: '45' } });
  const m = G.applyFrameRotationMargin(el);
  assert.ok(m > 0);
  assert.equal(el._raw.marginTop, m + 'px');
  assert.equal(el._raw.marginBottom, m + 'px');
  assert.equal(el.dataset.rotMarginY, String(m));
});

test('④-b 회전 0으로 되돌리면 «우리 마진»만 걷고 표식도 지운다', () => {
  const el = stubEl({ w: 796, h: 316, dataset: { rotateDeg: '45' } });
  G.applyFrameRotationMargin(el);
  el.dataset.rotateDeg = '0';
  assert.equal(G.applyFrameRotationMargin(el), 0);
  assert.equal(el._raw.marginTop, undefined);
  assert.equal(el._raw.marginBottom, undefined);
  assert.equal(el.dataset.rotMarginY, undefined);
});

test('④-c ★회전한 적 «없는» 프레임은 손대지 않는다 — `margin:0 auto` 를 longhand 로 재작성하면 안 된다', () => {
  // 자유배치 프레임의 인라인은 margin:0 auto → CSSOM 에서 style.marginTop 이 "0px"(truthy).
  // 표식 없이 truthy 만 보고 지우면 «모든 저장본»의 outerHTML 이 로드마다 바뀐다.
  const el = stubEl({ w: 796, h: 316, dataset: {}, style: { marginTop: '0px', marginBottom: '0px' } });
  G.applyFrameRotationMargin(el);
  assert.equal(el._raw.marginTop, '0px');
  assert.equal(el._raw.marginBottom, '0px');
  assert.equal(el.dataset.rotMarginY, undefined);
});

test('④-d ★배너 inner 프레임의 «자기 용도» 마진도 안 건드린다 (표식이 없으므로)', () => {
  // blocks/banner-block.js 는 inner.style.marginTop/Bottom 을 child.y 로 쓴다.
  const el = stubEl({ w: 860, h: 260, dataset: { fullWidth: 'true' }, style: { marginTop: '24px', marginBottom: '24px' } });
  G.applyFrameRotationMargin(el);
  assert.equal(el._raw.marginTop, '24px');
  assert.equal(el._raw.marginBottom, '24px');
});

test('④-e 절대배치 프레임(부모가 자유배치)은 마진 보정 «안 함» — 마진이 레이아웃에 안 먹는다', () => {
  const el = stubEl({ w: 400, h: 200, position: 'absolute', dataset: { rotateDeg: '45' } });
  el.style.position = 'absolute';
  assert.equal(G.applyFrameRotationMargin(el), 0);
  assert.equal(el._raw.marginTop, undefined);
});

test('④-f sizeHint 를 주면 offset* 대신 그걸 쓴다(리사이즈 중 리플로우 회피)', () => {
  const el = stubEl({ w: 0, h: 0, dataset: { rotateDeg: '45' } });   // offset* 는 0
  const m = G.applyFrameRotationMargin(el, { w: 796, h: 316 });
  assert.equal(m, G.rotationMarginY(796, 316, 45));
  assert.ok(m > 0);
});

/* ═══ ⑤ applyFrameTransform — identity 정책 3종이 «실제로 갈린다» ═══ */
test('⑤-a 비항등이면 세 정책 모두 같은 문자열을 쓴다', () => {
  for (const identity of ['clear', 'write', 'skip']) {
    const el = stubEl({ w: 796, h: 316, dataset: { rotateDeg: '45' } });
    G.applyFrameTransform(el, { identity });
    assert.equal(el._raw.transform, 'translate(0px,0px) rotate(45deg) scale(1,1)', identity);
  }
});

test('⑤-b ★항등일 때 세 정책이 «서로 다른 결과»를 낸다 — 합치면 그 자체가 회귀', () => {
  const mk = () => stubEl({ w: 796, h: 316, dataset: {}, style: { transform: 'translate(0px,0px) rotate(0deg) scale(1,1)' } });
  const a = mk(); G.applyFrameTransform(a, { identity: 'clear' });
  assert.equal(a._raw.transform, undefined, 'clear = 제거');
  const b = mk(); b._raw.transform = 'OLD'; G.applyFrameTransform(b, { identity: 'write' });
  assert.equal(b._raw.transform, 'translate(0px,0px) rotate(0deg) scale(1,1)', 'write = 기록');
  const c = mk(); c._raw.transform = 'OLD'; G.applyFrameTransform(c);
  assert.equal(c._raw.transform, 'OLD', 'skip(기본) = 무접촉');
});

test('⑤-c flip/translate 도 문자열에 반영', () => {
  const el = stubEl({ dataset: { translateX: '10', translateY: '-4', rotateDeg: '0', flipH: '1' } });
  G.applyFrameTransform(el, { identity: 'write' });
  assert.equal(el._raw.transform, 'translate(10px,-4px) rotate(0deg) scale(-1,1)');
});

/* ═══ ⑥ 호출부 전수 — «상수로 묶었으면 호출부를 세라» ═══ */
test('⑥-a 프레임 transform 문자열을 «직접» 조립하는 자리가 SSOT 밖에 남아있지 않다', () => {
  const files = ['js/overlay-handles.js', 'js/props/prop-frame.js', 'js/io/save-load.js', 'js/block-factory.js'];
  const re = /translate\(\$\{[^}]*\}px,\s*\$\{[^}]*\}px\)\s*rotate\(/;
  for (const f of files) {
    assert.ok(!re.test(read(f)), `${f} 에 손조립 transform 이 남아있다`);
  }
  // SSOT 는 «자기 안»에 조립식을 갖고 있어야 한다(음성 대조 — 이 정규식이 실제로 무언가를 잡는지)
  assert.ok(/translate\(\$\{tx\}px,\$\{ty\}px\) rotate\(/.test(read('js/frame-geometry.js')),
            'SSOT 안의 조립식을 정규식이 못 잡으면 ⑥-a 는 항상 초록이다');
});

test('⑥-b 네 호출부가 전부 applyFrameTransform 을 «부른다»', () => {
  for (const f of ['js/overlay-handles.js', 'js/props/prop-frame.js', 'js/io/save-load.js', 'js/block-factory.js']) {
    const src = read(f);
    assert.match(src, /from '\.\.?\/(\.\.\/)?frame-geometry\.js'/, `${f} import 누락`);
    assert.match(src, /applyFrameTransform\(/, `${f} 호출 누락`);
  }
});

test('⑥-c ★«중앙» 계산이 두 벌로 갈라져 있지 않다 — 정렬버튼과 삽입경로가 같은 술어를 쓴다', () => {
  const pf = read('js/props/prop-frame.js');
  const bf = read('js/block-factory.js');
  assert.match(pf, /frameAlignOffset\(/, 'prop-frame 이 술어를 안 쓴다');
  assert.match(bf, /frameAlignOffset\(/, 'block-factory 가 술어를 안 쓴다');
  // 옛 손계산식(=== 'center' ? Math.round((ssW - cw) / 2))이 남아있으면 두 벌이다
  assert.ok(!/alignItems === 'center' \? Math\.round\(\(ssW - cw\)/.test(pf), 'prop-frame 에 옛 손계산이 남아있다');
});

test('⑥-d 자유배치 삽입 3경로가 모두 _placeAtFrameCenter 를 부른다 (텍스트·빈줄·비텍스트)', () => {
  const bf = read('js/block-factory.js');
  const calls = (bf.match(/_placeAtFrameCenter\(/g) || []).length;
  // 정의 1 + 호출 3
  assert.ok(calls >= 4, `_placeAtFrameCenter 등장 ${calls}회 — 정의1+호출3 미만`);
  // ★명시좌표(MCP/드롭)는 «중앙으로 끌어가면 안 된다» — 호출이 hasAbsCoords 가드 뒤에 있는지
  assert.match(bf, /if \(!hasAbsCoords\) _placeAtFrameCenter\(tf, activeSS\)/, 'addTextBlock 가드 없음');
  assert.match(bf, /if \(!hasAbsCoords\) _placeAtFrameCenter\(block, ss\)/, '_insertToFlowFrame 가드 없음');
});

test('⑥-e 삽입 경로는 «음수 클램프» 를 한다 — 프레임보다 큰 블록을 밖으로 밀어내지 않는다', () => {
  const bf = read('js/block-factory.js');
  // 실측 근거: 에셋 프리셋 780px / 기본 프레임 520px → 순수 중앙은 top:-130px 이고
  // 프레임 overflow:hidden 이 윗부분을 자른다.
  assert.match(bf, /const baseL = Math\.max\(0, off\.left\)/, '좌 클램프 없음');
  assert.match(bf, /const baseT = Math\.max\(0, off\.top\)/, '상 클램프 없음');
  assert.match(bf, /cascadeIfOccupied\(baseL, baseT,/, '캐스케이드가 클램프된 좌표를 안 쓴다');
  // ★반대편 대조: «공유 술어»는 클램프하면 안 된다(정렬 버튼 계약이 깨진다).
  //   ⚠️파일 전체를 보면 rotationMarginY 의 Math.max(0, …) 에 걸린다 → frameAlignOffset «본문»만 본다.
  const fg = read('js/frame-geometry.js');
  const body = fg.slice(fg.indexOf('export function frameAlignOffset'),
                        fg.indexOf('export function cascadeIfOccupied'));
  assert.ok(body.length > 100, 'frameAlignOffset 본문을 못 잘랐다');
  assert.ok(!/Math\.max\(0,/.test(body), 'SSOT(frameAlignOffset)가 클램프를 흡수해버렸다');
  assert.equal(G.frameAlignOffset(400, 200, 800, 400, 'center', 'center').left, -200, '음수 계약 유지');
});

/* ═══ ⑦ CSS — 회전 규약 3갈래가 전부 overflow 해제 대상인지 ═══ */
test('⑦ 회전 자식 overflow 해제 셀렉터가 세 규약을 모두 덮는다 + 0도는 «안» 덮는다', () => {
  const css = read('css/editor-blocks.css');
  assert.match(css, /\.frame-block:has\(\[data-rotation\]\)/, 'data-rotation 규약 누락');
  assert.match(css, /\.frame-block:has\(\[data-rotate-deg\]:not\(\[data-rotate-deg="0"\]\)\)/, 'data-rotate-deg 규약 누락(또는 0 제외 없음)');
  assert.match(css, /\.frame-block:has\(\.shape-block\[data-shape-rotation\]\)/, 'shape 규약이 사라졌다');
});
