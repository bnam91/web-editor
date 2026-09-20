/* 단위 하네스 — 오버레이(플로팅) 텍스트의 «모서리 리사이즈 핸들» (0920b-overlay-resize)
 *
 * 현빈 2026-09-20: 「오버레이 버튼 활성화 시키면 오버레이된 텍스트 블럭에 모서리 핸들이 필요하다」
 *
 * ★여기서 재는 것은 «배선이 실제로 있나»와 «식이 실제로 맞나»다.
 *   눈으로 보는 것(핸들이 4개 뜬다 · 끌면 커진다)은 tests/dom/text-overlay-resize.dom.spec.js 가
 *   playwright 로 «진짜 마우스»로 잰다. 이 파일은 그 DOM 검사가 «안 도는» node --test 스위트에서
 *   변이를 빨갛게 만드는 그물이다(modal-resize 의 두 갈래 분업과 같은 구조).
 *
 * ⛔단언을 «소스 문자열을 베껴» 적지 않는다 — 식은 소스에서 «꺼내 실행»한다(U4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { sliceBlock } from './_slice-block.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = {
  handles: readSrc(ROOT, 'js/overlay-handles.js'),
  editor:  readSrc(ROOT, 'js/editor.js'),
  drag:    readSrc(ROOT, 'js/block-drag.js'),
  wire:    readSrc(ROOT, 'js/props/prop-text-wireup-overlay.js'),
};

/* ═══ U1 showHandlesFor 에 «텍스트 오버레이 갈래»가 있다 ══════════════════ */
function handlesForBody() {
  return sliceBlock(SRC.handles, 'function showHandlesFor(block)');
}

test('U1 ★showHandlesFor 가 텍스트를 «가른다» — 오버레이면 show, 아니면 hide', () => {
  const body = handlesForBody();
  assert.match(body, /text-block/,
    'showHandlesFor 에 텍스트 갈래가 없다 — 불려도 no-op 이라 모서리 점이 안 뜬다(오늘의 증상)');
  assert.match(body, /showTextOverlayResizeHandles\(posEl\)/, 'show 호출이 없다');
  assert.match(body, /hideTextOverlayResizeHandles\(\)/,
    '비오버레이 텍스트에서 hide 로 «떨어지는» 갈래가 없다 — 흐름 텍스트에 손잡이가 남는다');
  assert.match(body, /dataset\.overlayBlock === 'true'/,
    '판정이 dataset.overlayBlock 이 아니다 — 말풍선·아이콘텍스트가 같은 토글에서 빠진다');
});

test('U1b [변이] 그 갈래를 지우면 이 검사가 «실제로» 빨개진다', () => {
  const body = handlesForBody();
  const mutated = body.replace(/\} else if \(block\.classList\.contains\('text-block'\)[\s\S]*$/, '}');
  assert.notEqual(mutated, body, '★하네스가 부서졌다 — 텍스트 갈래를 앵커로 못 찾았다');
  assert.ok(!/showTextOverlayResizeHandles/.test(mutated),
    '★변이를 넣었는데 여전히 show 호출이 남아 있다 — 이 검사는 아무것도 안 지킨다');
});

/* ═══ U2 deselectAll 이 정리한다 ══════════════════════════════════════════ */
function deselectBody() {
  return sliceBlock(SRC.editor, 'function deselectAll(');
}

test('U2 ★deselectAll 이 hideTextOverlayResizeHandles 를 부른다', () => {
  /* 빠지면 모듈 변수가 «해제된 블록»을 계속 가리켜 재클릭이 영영 no-op 이 된다
     (아이콘 원형이 실제로 밟은 사고 — editor.js 의 그 주석과 같은 자리). */
  assert.match(deselectBody(), /window\.hideTextOverlayResizeHandles\?\.\(\)/,
    'deselectAll 의 hide 목록에서 빠졌다');
});

test('U2b [변이] 그 한 줄을 빼면 빨개진다', () => {
  const mutated = deselectBody().replace(/window\.hideTextOverlayResizeHandles\?\.\(\);/, '');
  assert.ok(!/hideTextOverlayResizeHandles/.test(mutated), '★앵커를 못 찾았다 — 하네스가 부서졌다');
});

/* ═══ U3 pushHistory 가 «첫 DOM 변경 앞»에 온다 ═══════════════════════════ */
test('U3 ★pushHistory 가 첫 DOM 쓰기보다 «먼저» 온다 (resize-undo 와 같은 병 예방)', () => {
  const body = sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)');
  const iPush  = body.indexOf('window.pushHistory?.(');
  const iWrite = body.indexOf('posEl.style.width');
  assert.ok(iPush  > 0, 'pushHistory 호출 자체가 없다 — ⌘Z 가 크기를 못 되돌린다');
  assert.ok(iWrite > 0, '폭을 쓰는 자리를 못 찾았다 — 하네스가 부서졌다');
  assert.ok(iPush < iWrite,
    `pushHistory 가 첫 DOM 변경 «뒤»에 있다(push@${iPush} > write@${iWrite}) — ⌘Z 가 블록 삽입을 되돌린다`);
  assert.ok(/if \(!moved\) \{ moved = true; window\.pushHistory/.test(body),
    '드래그 «한 번»에 한 번만 쌓는 빗장(moved)이 없다 — 히스토리가 프레임 수만큼 쌓인다');
});

/* ═══ U4 앵커 동등성 — 확대블럭 구현과 «같은 답»을 낸다 ═══════════════════
   ⛔두 식을 공통 헬퍼로 «추출»하지 않았다: tests/unit/zoom-block.test.js 가 zoom 함수 «안에서»
     앵커 네 줄을 정규식으로 꺼내 실행하므로, 빼내면 그 검사가 약해진다.
   ⇒ 대신 여기서 «두 구현이 같은 답을 내는가»를 못박는다. 갈라지면 빨개진다.
   ═══════════════════════════════════════════════════════════════════════ */
function anchorFnFrom(body, xPat, yPat, what) {
  const sx = body.match(/const sx = (dir\.includes\('e'\) \? 1 : -1);/);
  const sy = body.match(/const sy = (dir\.includes\('s'\) \? 1 : -1);/);
  const ex = body.match(xPat);
  const ey = body.match(yPat);
  const dh = body.match(/(const dHW = [^;]+;)/);
  assert.ok(sx && sy, `★${what}: sx/sy(끄는 코너의 로컬 부호)를 못 찾았다`);
  assert.ok(ex && ey, `★${what}: 좌표를 «안 쓴다» — 끄는 코너가 손끝을 안 따라온다`);
  assert.ok(dh, `★${what}: 반치수(dHW/dHH) 줄을 못 찾았다`);
  return new Function('dir', 'th', 'startPosX', 'startPosY', 'startW', 'startH', 'newW', 'newH', `
    const sx = ${sx[1]}, sy = ${sy[1]};
    const cosT = Math.cos(th), sinT = Math.sin(th);
    ${dh[1]}
    return { x: ${ex[1]}, y: ${ey[1]} };
  `);
}
const tfoAnchor = () => anchorFnFrom(
  sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)'),
  /const nx = ([^;]+);/, /const ny = ([^;]+);/, '오버레이 텍스트');
const zoomAnchor = () => anchorFnFrom(
  sliceBlock(SRC.handles, 'function _onZoomResizeMouseDown(e, zb, dir)'),
  /zb\.dataset\.x = String\(([^;]+)\);/, /zb\.dataset\.y = String\(([^;]+)\);/, '확대블럭');

/** 코너 dir 의 «세계» 좌표 — _cornerScreen 과 같은 모형(중심 기준 회전). */
function cornerAt(x, y, w, h, th, dir) {
  const cx = x + w / 2, cy = y + h / 2;
  const lx = (dir.includes('e') ? 1 : -1) * w / 2;
  const ly = (dir.includes('s') ? 1 : -1) * h / 2;
  return { x: cx + lx * Math.cos(th) - ly * Math.sin(th),
           y: cy + lx * Math.sin(th) + ly * Math.cos(th) };
}
const OPP = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
const DIRS = ['nw', 'ne', 'sw', 'se'];
const THS  = [0, 30 * Math.PI / 180, 45 * Math.PI / 180];

test('U4 ★네 코너 × 세 각 — 끄는 코너의 «맞은편»이 안 움직인다 (12 표본)', () => {
  const anchor = tfoAnchor();
  const W0 = 300, H0 = 120, X0 = 90, Y0 = 40, W1 = 420, H1 = 168;
  let n = 0;
  for (const th of THS) for (const dir of DIRS) {
    const p = anchor(dir, th, X0, Y0, W0, H0, W1, H1);
    const a = cornerAt(X0, Y0, W0, H0, th, OPP[dir]);
    const b = cornerAt(p.x, p.y, W1, H1, th, OPP[dir]);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-9,
      `dir=${dir} θ=${(th * 180 / Math.PI).toFixed(0)}° — 맞은편(${OPP[dir]})이 움직였다: Δ=(${(b.x - a.x).toFixed(3)}, ${(b.y - a.y).toFixed(3)})`);
    n++;
  }
  assert.equal(n, 12, '표본 수가 12가 아니다 — 루프가 안 돌았다');
});

test('U4b ★두 구현(오버레이 텍스트 · 확대블럭)이 «같은 답»을 낸다', () => {
  const a = tfoAnchor(), b = zoomAnchor();
  for (const th of THS) for (const dir of DIRS) {
    const p = a(dir, th, 90, 40, 300, 120, 420, 168);
    const q = b(dir, th, 90, 40, 300, 120, 420, 168);
    assert.ok(Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9,
      `dir=${dir} θ=${(th * 180 / Math.PI).toFixed(0)}° 에서 갈라졌다: tfo=(${p.x},${p.y}) zoom=(${q.x},${q.y})`);
  }
});

test('U4c [변이] dHW 의 «/2» 를 빼면 U4 가 실제로 빨개진다', () => {
  const body = sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)');
  const mutated = body.replace('const dHW = (newW - startW) / 2, dHH = (newH - startH) / 2;',
                               'const dHW = (newW - startW), dHH = (newH - startH);');
  assert.notEqual(mutated, body, '★하네스가 부서졌다 — 반치수 줄을 못 찾았다');
  const anchor = anchorFnFrom(mutated, /const nx = ([^;]+);/, /const ny = ([^;]+);/, '변이');
  const p = anchor('nw', 0, 90, 40, 300, 120, 420, 168);
  const a = cornerAt(90, 40, 300, 120, 0, 'se');
  const b = cornerAt(p.x, p.y, 420, 168, 0, 'se');
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1,
    '★변이를 넣었는데 맞은편 코너가 그대로다 — 이 검사는 식을 안 재고 있다');
});

/* ═══ U5 rAF 가드 · 클래스 · 입구 ═══════════════════════════════════════ */
test('U5 ★rAF 가드를 tf 의 .selected 로 재지 않는다 (가장 밟기 쉬운 함정)', () => {
  const body = sliceBlock(SRC.handles, 'function _startTextOverlayResizeRaf()');
  assert.ok(!/posEl\.classList\.contains\('selected'\)/.test(body),
    '★tf 에는 .selected 가 «안» 붙는다 — 이렇게 재면 핸들이 첫 프레임에 스스로 사라진다');
  assert.match(body, /_tfoSelectedChild\(posEl\)/, '선택된 «아이»로 재는 가드가 없다');
  assert.match(body, /editing/, '편집 중에 손잡이를 숨기는 가드가 없다(레포 규약)');
  assert.match(body, /overlayBlock !== 'true'/, '오버레이를 끄면 걷히는 가드가 없다');
});

test('U6 ★클래스를 «빌리지» 않는다 — .asset-overlay-handle 일괄 remove 에 안 쓸린다', () => {
  const show = sliceBlock(SRC.handles, 'function showTextOverlayResizeHandles(posEl)');
  assert.match(show, /tfo-overlay-handle/, '전용 클래스가 아니다');
  assert.ok(!/asset-overlay-handle/.test(show),
    '★.asset-overlay-handle 을 빌렸다 — hideAssetResizeHandles() 가 내 핸들을 쓸어간다(두 번 밟은 함정)');
  const hide = sliceBlock(SRC.handles, 'function hideTextOverlayResizeHandles()');
  assert.match(hide, /_tfoResizeEl = null/,
    'hide 가 자기 상태변수를 null 로 안 되돌린다 — 재클릭이 동일블록 가드에 걸려 영영 no-op');
});

test('U7 ★클릭 입구 두 곳 — block-drag(캔버스) · wireOverlaySection(토글)', () => {
  const dragBody = sliceBlock(SRC.drag, "block.addEventListener('click', e => {\n      e.stopPropagation();\n      // 편집 모드 중 클릭은 무시");
  assert.match(dragBody, /window\.showHandlesFor\?\.\(block\)/,
    '캔버스 텍스트 클릭 경로에서 showHandlesFor 를 «안 부른다» — 이게 오늘의 증상 자리다');
  const wire = sliceBlock(SRC.wire, 'export function wireOverlaySection({ tb })');
  assert.match(wire, /window\.showHandlesFor\?\.\(tb\)/,
    '오버레이 토글 직후에 손잡이가 안 뜬다(끌 때도 같은 호출이 hide 로 떨어진다)');
});

test('U8 ★_exitOverlay 가 폭을 지워버리지 않도록 «도장»을 뗀다', () => {
  const body = sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)');
  assert.match(body, /delete posEl\.dataset\.overlayIntroducedWidth/,
    '★안 떼면 오버레이 해제 시 _exitOverlay 가 style.width·dataset.width 를 지워 정한 폭이 증발한다');
  assert.ok(!/posEl\.style\.height/.test(body),
    '★tf 에 height 를 쓰면 줄일 때 글자가 조용히 잘린다(overflow:hidden) — A안은 높이를 안 쓴다');
});

test('U9 ★Mix 텍스트 — 폰트 스냅샷이 contentEl «하나»에 머물지 않는다', () => {
  const body = sliceBlock(SRC.handles, 'function _tfoFontSnapshot(posEl)');
  assert.match(body, /\[style\*="font-size"\]/,
    '부분 서식 span 을 안 담는다 — Mix 텍스트에서 일부 글자만 안 커진다(그룹 경로의 기존 미비)');
});
