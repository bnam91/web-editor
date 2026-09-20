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
  /* 2026-09-20 통합(int/0920b): T-052 가 이동 쪽 알맹이(탄성 곡선·위치 규약)를
     prop-text-wireup-overlay.js → js/overlay-float.js 로 옮겼다. «곡선의 단일 진실원»이라는
     이 스펙의 뜻은 그대로고, 그 원본이 사는 파일 이름만 바뀐다. */
  float:   readSrc(ROOT, 'js/overlay-float.js'),
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

/* ═══ 0920b 픽스 라운드 — 이벨류에이터 실측 3건을 «그물»로 ═══════════════ */

test('U10 ★편집 중 가드는 «파괴»가 아니라 «숨김»이다 (끝나면 스스로 돌아온다)', () => {
  const body = sliceBlock(SRC.handles, 'function _startTextOverlayResizeRaf()');
  /* 파괴형이면 rAF 가 멈추고 _tfoResizeEl 이 null 이 되어, 편집을 끝내도 다시 부르는
     자리가 없다 ⇒ 「선택돼 있는데 손잡이만 없는」 상태가 된다(2026-09-20 실측).
     레포 규약(asset-rotate.js:303)은 «매번 다시 재는 술어» 꼴이다 — 그 꼴을 따른다. */
  assert.match(body, /display = editing \? 'none' : ''/,
    '★편집 중을 display 로 숨기지 않는다 — 파괴형이면 편집을 끝내도 안 돌아온다');
  assert.match(body, /const editing = _tfoEditing\(posEl\)/,
    '편집 여부를 «매 프레임 다시 재는» 술어가 아니다');
  /* ★문자열 대조로는 부족하다(가드 안에 editing 이 «다른 뜻»으로 들어 있다) ⇒ 조건을
     소스에서 꺼내 «실행»한다. 파괴해야 할 때만 true 여야 한다. */
  const kill = destroyGuard(body);
  const P = (ov) => ({ isConnected: true, dataset: { overlayBlock: ov } });
  assert.equal(kill(P('true'), {}, true),  false, '★편집 중이라는 이유로 «파괴»한다 — 끝나도 안 돌아온다');
  assert.equal(kill(P('true'), {}, false), false, '선택돼 있고 편집도 아닌데 파괴한다');
  assert.equal(kill(P('true'), null, false), true, '선택이 풀렸는데 안 걷힌다');
  assert.equal(kill(P(''),     {}, true),  true, '오버레이를 껐는데 안 걷힌다');
  assert.equal(kill({ isConnected: false, dataset: { overlayBlock: 'true' } }, {}, false), true,
    'DOM 에서 빠졌는데 안 걷힌다');
});

/** rAF 루프의 «파괴» 조건을 소스에서 꺼내 실행 가능한 술어로 만든다. */
function destroyGuard(body) {
  const m = body.match(/if \((!posEl\.isConnected[\s\S]*?)\) \{\s*\n\s*hideTextOverlayResizeHandles\(\);/);
  assert.ok(m, '★하네스가 부서졌다 — 파괴 가드를 못 찾았다');
  return new Function('posEl', 'sel', 'editing', `return !!(${m[1]});`);
}

test('U10b [변이] 파괴 가드에 editing 을 도로 넣으면 U10 이 실제로 빨개진다', () => {
  const body = sliceBlock(SRC.handles, 'function _startTextOverlayResizeRaf()');
  const mutated = body.replace('if (!posEl.isConnected', 'if (editing || !posEl.isConnected');
  assert.notEqual(mutated, body, '★하네스가 부서졌다 — 가드 앵커를 못 찾았다');
  const m = mutated.match(/if \(editing \|\| (!posEl\.isConnected[\s\S]*?)\) \{\s*\n\s*hideTextOverlayResizeHandles\(\);/);
  assert.ok(m, '★변이 뒤 가드를 못 찾았다');
  const kill = new Function('posEl', 'sel', 'editing', `return !!(editing || ${m[1]});`);
  assert.equal(kill({ isConnected: true, dataset: { overlayBlock: 'true' } }, {}, true), true,
    '★변이를 넣었는데 파괴가 안 일어난다 — 이 검사는 아무것도 안 지킨다');
});

test('U11 ★폰트 스냅샷은 «복수»다 — 말풍선의 첫 tb- 는 본문이 아니라 이름표다', () => {
  const body = sliceBlock(SRC.handles, 'function _tfoFontSnapshot(posEl)');
  /* posEl.querySelector('[class^="tb-"]')(단수)는 말풍선 프레임에서 .tb-sender-name(16px)을
     돌려준다 — 본문 .tb-bubble(28px)은 인라인 font-size 가 없어 [style*="font-size"] 그물에도
     안 걸린다 ⇒ 「상자와 이름표만 커지고 말풍선 글자는 그대로」(2026-09-20 실측). */
  assert.ok(!/querySelector\('\[class\^="tb-"\]'\)/.test(body),
    '★단수 querySelector 로 첫 tb- 하나만 집는다 — 말풍선 본문이 통째로 빠진다');
  assert.match(body, /querySelectorAll\('\[class\^="tb-"\]'\)/,
    'tb- 칸을 «전수»로 담지 않는다');
  assert.match(body, /namespaceURI === 'http:\/\/www\.w3\.org\/2000\/svg'/,
    'SVG(말풍선 꼬리 .tb-bubble-tail)를 안 거른다 — font-size 를 써도 뜻이 없다');
});

/* ═══ 현빈 결정 2026-09-20 — 「크기조절도 섹션 폭 밖까지 나갈 수 있어야 한다」 ═════════
   이동(prop-text-wireup-overlay.js 의 탄성 클램프 + 마그네틱 캐치)과 «같은 결»로.        */

test('U12 ★상한을 «막지» 않는다 — 옛 하드 클램프(Math.min(secW, …))가 남아 있으면 빨강', () => {
  const body = sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)');
  /* ★주석을 걷고 «코드만» 본다 — 안 걷으면 「옛 상한은 Math.min(secW, room) 이었다」는
     설명 주석에 걸려 고쳐도 계속 빨갛다(실측: 이 검사가 처음에 그렇게 거짓 빨강이었다). */
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/Math\.min\(secW/.test(code),
    '★폭 상한이 아직 섹션 폭에 물려 있다 — 현빈 2026-09-20 결정(섹션 밖까지 나간다)과 어긋난다');
  assert.match(code, /const boundW = Math\.max\(TFO_MIN_W, room, startW\)/,
    '경계폭(boundW) 선언이 없다 — 탄성을 태울 기준이 없다');
  /* ★이미 섹션 밖에 나가 있는 블럭(이동으로)에서 boundW 가 startW 보다 작으면, 마우스를
     움직이기도 전에 폭이 «툭» 줄어 맞은편 코너 고정이 첫 프레임에 깨진다. */
  const boundOf = (secW, left, startW, sx) =>
    Math.max(60, sx > 0 ? (secW - left) : (left + startW), startW);
  assert.equal(boundOf(860, 0,   600, +1), 860, 'left 0 이면 경계 = 섹션 폭');
  assert.equal(boundOf(860, 72,  716, +1), 788, 'e 쪽: 왼쪽 고정 ⇒ 860-72');
  assert.equal(boundOf(860, 72,  716, -1), 788, 'w 쪽: 오른쪽 고정 ⇒ 72+716');
  assert.equal(boundOf(860, 400, 900, +1), 900,
    '★이미 밖에 나가 있는데 경계가 현재 폭보다 작다 — 마우스다운 순간 폭이 줄어든다');
});

test('U13 ★크기조절의 곡선은 이동의 _elasticAxis «그 함수»다 (사본 금지)', () => {
  /* 곡선을 여기서 다시 적으면 이동과 크기조절의 손맛이 «조용히» 갈라진다 —
     이 레포가 rotatedAABB 에서 한 번 밟은 병(prop-text-wireup-overlay.js:253 주석). */
  assert.match(SRC.handles, /import \{[^}]*_elasticAxis[^}]*\}\s*\n?\s*from '\.\/overlay-float\.js'/,
    '★_elasticAxis 를 이동 쪽에서 «가져다 쓰지» 않는다 — 곡선 사본이 생겼거나 직접 짰다');
  assert.match(SRC.handles, /OVERLAY_RESIST_ZONE_SCREEN_PX/,
    '저항폭 상수도 같은 곳에서 가져와야 한다');
  assert.match(SRC.float, /export function _elasticAxis/, '이동 쪽이 그 함수를 export 하지 않는다');
  assert.match(SRC.float, /export const OVERLAY_RESIST_ZONE_SCREEN_PX = 40/, '저항폭 상수 export 가 없다');
  /* ⛔사본 금지의 «반대편» 검사 — 얇아진 배선 파일에 곡선이 되살아나면 안 된다. */
  assert.doesNotMatch(SRC.wire, /function _elasticAxis/,
    '배선 파일에 곡선 사본이 되살아났다 — 알맹이는 js/overlay-float.js 한 곳이다');

  const body = sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)');
  /* ★zone 을 로컬 상수로 고정하면 줌 40% 에서 화면 16px 로 쪼그라들어 «사실상 없는» 저항이
     된다 — 이동 쪽이 2026-09-16l 에 실제로 밟은 병. 배율로 나눠야 한다. */
  assert.match(body, /OVERLAY_RESIST_ZONE_SCREEN_PX \/ \(scale \|\| 1\)/,
    '★저항폭을 화면px → 로컬로 환산하지 않는다 — 줌마다 손맛이 달라진다');
});

test('U14 ★식을 «꺼내 실행» — 캐치/저항/자유 세 구간 + 하한은 하드', () => {
  const body = sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)');
  const m = body.match(/const over = ([^;]+);\s*\n[\s\S]*?const elasticW = ([^;]+);\s*\n\s*const newW = ([^;]+);/);
  assert.ok(m, '★하네스가 부서졌다 — 탄성 식 세 줄을 못 찾았다');
  const widthOf = new Function('rawW', 'boundW', 'zone', '_elasticAxis', 'TFO_MIN_W',
    `const over = ${m[1]};
const elasticW = ${m[2]};
return ${m[3]};`);
  /* 이동 쪽 곡선을 «독립으로» 다시 센다(원본을 import 하면 원본이 틀려도 늘 초록이다). */
  const axis = (raw, boundMax, zone) => {
    const magnet = zone * 0.25;
    if (raw < 0) { const o = -raw; return o <= magnet ? 0 : (o <= zone ? -((o - magnet) * 0.35) : -((zone - magnet) * 0.35 + (o - zone))); }
    if (raw > boundMax) { const o = raw - boundMax; return o <= magnet ? boundMax : (o <= zone ? boundMax + (o - magnet) * 0.35 : boundMax + (zone - magnet) * 0.35 + (o - zone)); }
    return raw;
  };
  const W = (rawW, boundW, zone) => widthOf(rawW, boundW, zone, axis, 60);

  assert.equal(W(800, 860, 40), 800, '경계 안인데 건드린다');
  assert.equal(W(860, 860, 40), 860, '경계 위에서 값이 튄다');
  assert.equal(W(866, 860, 40), 860, '★캐치 구간(6 ≤ 10) — 턱에 안 걸린다(경계에 붙어야 한다)');
  assert.equal(W(885, 860, 40), Math.round(860 + 15 * 0.35), '★탄성 구간 — 0.35배 저항이 아니다');
  assert.equal(W(940, 860, 40), Math.round(860 + 30 * 0.35 + 40), '★자유 구간 — 턱을 넘은 뒤 1:1 이 아니다');
  /* ★줌 40% (zone = 40/0.4 = 100 로컬px) — 같은 «화면» 오버슛엔 같은 «화면» 결과. */
  assert.equal(W(860 + 25 / 0.4, 860, 40 / 0.4) - 860, Math.round(15 / 0.4 * 0.35),
    '★줌 40% 에서 저항폭이 화면px 로 일정하지 않다');
  /* ★하한은 «하드» — 현빈: 「최소 폭·높이 하한은 그대로 둔다」. 탄성을 태우면 안 된다. */
  assert.equal(W(-500, 860, 40), 60, '★하한이 무너졌다 — 안쪽으로 끌면 글자가 무한히 작아진다');
  assert.equal(W(10, 860, 40), 60, '하한 아래를 60 으로 안 막는다');
});

test('U14b [변이] 탄성을 옛 하드 클램프로 되돌리면 U14 가 실제로 빨개진다', () => {
  const widthOf = (rawW, boundW) => Math.min(boundW, Math.max(60, Math.round(rawW)));
  assert.equal(widthOf(885, 860), 860, '전제: 하드 클램프는 경계에서 멈춘다');
  assert.notEqual(widthOf(885, 860), Math.round(860 + 15 * 0.35),
    '★하드 클램프와 탄성이 같은 답을 낸다 — U14 는 아무것도 안 지킨다');
});

test('U15 ★maxWidth:100% 를 «푼다» — 안 풀면 화면 폭이 섹션에서 잘린다', () => {
  const body = sliceBlock(SRC.handles, 'function _onTextOverlayResizeMouseDown(e, posEl, dir)');
  /* _enterOverlay(prop-text-wireup-overlay.js:136)가 maxWidth:100% 를 심는다 — 그대로 두면
     style.width 만 커지고 렌더 폭은 섹션에 잘려 「손잡이는 가는데 상자는 안 커진다」가 된다. */
  assert.match(body, /posEl\.style\.maxWidth = 'none'/,
    '★maxWidth 캡을 안 푼다 — 폭 숫자만 커지고 화면은 섹션에서 잘린다');
  assert.match(body, /posEl\.dataset\.overlayFreeWidth = 'true'/,
    '되돌릴 도장을 안 찍는다 — 오버레이를 꺼도 maxWidth:none 이 남는다');
  /* 2026-09-20 통합(int/0920b): 이탈 구현이 prop-text-wireup-overlay.js _exitOverlay →
     js/overlay-float.js exitFloat 으로 옮겨졌다(T-052). 뜻은 그대로, 자리만 바뀐다. */
  const exitBody = sliceBlock(SRC.float, 'export function exitFloat(posEl)');
  assert.match(exitBody, /overlayFreeWidth === 'true'/,
    '★이탈(exitFloat)이 그 도장을 안 본다 — 흐름 복귀 뒤에도 maxWidth:none 이 남는다');
  /* ⛔overlayIntroducedWidth 갈래(= _unfreezeWidth)에 얹으면 «절대 안 도는» 코드가 된다 —
     리사이즈는 그 도장을 떼고 가기 때문(폭을 남겨야 하니까, D7). 두 갈래가 따로 있어야 한다. */
  const unfreezeBody = sliceBlock(SRC.float, 'function _unfreezeWidth(posEl)');
  assert.doesNotMatch(unfreezeBody, /overlayFreeWidth/,
    '★두 도장이 한 갈래에 묶였다 — 리사이즈 경로에선 절대 안 돈다');
  assert.ok(/_unfreezeWidth\(posEl\)[\s\S]*?overlayFreeWidth === 'true'/.test(exitBody),
    '★freeWidth 되돌리기가 introducedWidth 되돌리기(_unfreezeWidth) «뒤»에 있지 않다');
});
