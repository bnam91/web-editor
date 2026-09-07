/* 단위 하네스 — 확대블럭 «상태층»(readZoomState · a·b 읽기 · render 배선)
 * 실행: node --test tests/unit/*.test.js tests/unit/*.test.mjs
 *
 * ★왜 이 파일이 따로 있나 (Evaluator 사보타주 2026-09-08)
 *   기하를 zoom-geometry.js 로 «떼어낸» 판단은 옳았다 — 기하층 사보타주 12건이 전부 빨개졌다.
 *   그런데 «떼어내고 남은 쪽»(zoom-block.js 의 상태 읽기·배선)은 통째로 사각이었다:
 *     C16 readZoomState 의 shadow 를 'on' 고정  → 40/0 통과
 *     C17 bd 를 'off' 고정                      → 40/0 통과
 *     C20 shape 를 'circle' 고정                 → 40/0 통과
 *     C19 readPinnedShortEdge 가 항상 null       → 40/0 통과
 *     C15 renderZoomBlock 이 핸들 바인딩을 안 부름 → 40/0 통과
 *   ★C16 이 통과한다는 건 「그림자 기본 off」를 누가 내일 되돌려도 초록이라는 뜻이다.
 *     그 정정은 현빈이 «화면을 보고» 잡아준 것이다 — 같은 걸 두 번 잡게 하면 안 된다.
 *
 * ★수법은 tests/unit/grid-p1.test.js 를 «그대로» 따랐다(새로 발명하지 않았다):
 *   ⑴ 실제 소스를 바이트 그대로 tmp `.mjs` 로 복사
 *   ⑵ 브라우저 전용 import 두 줄만 no-op 스텁으로 치환 (+ 「못 찾았다」를 던지는 대조를 붙임)
 *   ⑶ 순수 모듈(zoom-geometry.js)은 «진짜 그 파일»을 절대 file:// URL 로 물린다 — 기하는 진짜다
 *   ⑷ globalThis.window/document 를 최소 표면으로 깔고 동적 import
 *   ⇒ readZoomState 는 `block.dataset` 만 읽으므로 jsdom 이 필요 없다. `{dataset:{…}}` 이면 잰다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { mkTmpRoot } = require('./_tmproot.js');

const ROOT = path.resolve(__dirname, '../..');
let M = null;   // 로드된 zoom-block 모듈

before(async () => {
  let src = readSrc(ROOT, 'js', 'blocks', 'zoom-block.js');

  // ⑵ 브라우저 전용 import → 스텁. ★«못 찾았다»면 던진다(건너뛴 검사는 통과가 아니다).
  const DRAG = "import { bindBlock } from '../drag-drop.js';";
  const SCALE = "import { _canvasScaleNow } from '../overlay-handles.js';";
  for (const [spec, stub] of [[DRAG, 'const bindBlock = () => {};'],
                              [SCALE, 'const _canvasScaleNow = () => 1;']]) {
    const before_ = src;
    src = src.replace(spec, stub);
    assert.notEqual(src, before_, `소스에서 «${spec}» 를 못 찾음 — 리팩터링됐나? 검사가 대상을 놓쳤다`);
  }

  /* ⑶ 기하는 «진짜 그 파일»을 문다 — 다만 두 가지를 넘어야 한다:
       ① 사본이 tmpdir 로 가면 상대경로 './zoom-geometry.js' 가 레포 밖을 가리킨다
       ② package.json 이 "type":"commonjs" 라 레포의 `.js` 를 절대 URL 로 물어도
          node 가 CommonJS 로 읽어 named export 를 못 준다(실제로 그 오류가 났다)
     ⇒ 전례(grid-p1 의 gcrAliasPath)대로 «별칭 .mjs 사본»을 만들어 그걸 문다.
       ★바이트 그대로 복사다 — 기하 로직은 손대지 않는다. */
  const dir0 = mkTmpRoot('zoom-state-geo-');
  const geoAlias = path.join(dir0, 'zoom-geometry.mjs');
  fs.copyFileSync(path.join(ROOT, 'js/blocks/zoom-geometry.js'), geoAlias);
  const GEO = "from './zoom-geometry.js'";
  const beforeGeo = src;
  src = src.replace(GEO, 'from ' + JSON.stringify(pathToFileURL(geoAlias).href));
  assert.notEqual(src, beforeGeo, '기하 모듈 import 를 못 찾음');

  // ⑷ 최소 전역 — zoom-block.js 는 window.* 를 대입하고, document 는 makeZoomBlock 만 쓴다
  globalThis.window = {};
  globalThis.document = { createElement: (tag) => makeEl(tag) };

  const dir = mkTmpRoot('zoom-state-');
  const mjs = path.join(dir, 'zoom-block.mjs');
  fs.writeFileSync(mjs, src, 'utf8');
  M = await import(pathToFileURL(mjs).href);
});

/* ── 미니 DOM — 이 파일이 «실제로 쓰는» 표면만 (grid-p1 의 makeFakeDom 축소판) ── */
function makeEl(tag = 'div') {
  let _classes = new Set();
  const listeners = [];
  return {
    tagName: tag,
    dataset: {},
    style: { cssText: '' },
    innerHTML: '',
    id: '',
    listeners,
    get className() { return [..._classes].join(' '); },
    set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    classList: {
      contains: (c) => _classes.has(c),
      add: (...cs) => cs.forEach(c => _classes.add(c)),
      remove: (...cs) => cs.forEach(c => _classes.delete(c)),
    },
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    querySelector: () => null,
    closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    appendChild() {},
    scrollIntoView() {},
  };
}
const el = (ds = {}) => Object.assign(makeEl(), { dataset: { ...ds } });

/* ── C16·C17·C20 — 라디오/프리셋을 «고정»하면 잡힌다 ───────────────────────── */
test('S-1 [C16] shadow 는 dataset 을 «실제로» 읽는다 (고정하면 잡힌다)', () => {
  assert.equal(M.readZoomState(el({ shadow: 'on' })).shadow, 'on');
  assert.equal(M.readZoomState(el({ shadow: 'off' })).shadow, 'off');
  // 없으면 기본값 — ★현빈 2026-09-08 「기본적으로 그림자는 Off」
  assert.equal(M.readZoomState(el({})).shadow, 'off');
  // 모르는 값은 «조용히 통과시키지 않고» 기본으로 떨어뜨린다(저장본 변조 대비)
  assert.equal(M.readZoomState(el({ shadow: 'ON' })).shadow, 'off');
  assert.equal(M.readZoomState(el({ shadow: 'yes' })).shadow, 'off');
});

test('S-2 [C17] bd 도 마찬가지 — 기본은 off, 모르는 값은 기본으로', () => {
  assert.equal(M.readZoomState(el({ bd: 'on' })).bd, 'on');
  assert.equal(M.readZoomState(el({ bd: 'off' })).bd, 'off');
  assert.equal(M.readZoomState(el({})).bd, 'off');
  assert.equal(M.readZoomState(el({ bd: 'true' })).bd, 'off');
});

test('S-3 [C20] shape 는 프리셋 셋을 «다 구분»한다 (기본은 rect)', () => {
  for (const sh of ['rect', 'circle', 'square']) {
    assert.equal(M.readZoomState(el({ shape: sh })).shape, sh, sh);
  }
  assert.equal(M.readZoomState(el({})).shape, 'rect', '★기본은 사각형');
  assert.equal(M.readZoomState(el({ shape: 'triangle' })).shape, 'rect', '모르는 프리셋은 기본으로');
});

test('S-4 수치 필드도 dataset 을 읽고, 깨지면 기본값으로 떨어진다', () => {
  const s = M.readZoomState(el({ angle: '30', length: '250', maxop: '55', narrow: '10', curve: '200', spread: '12', size: '300', rot: '45' }));
  assert.deepEqual(
    { angle: s.angle, length: s.length, maxop: s.maxop, narrow: s.narrow, curve: s.curve, spread: s.spread, size: s.size, rot: s.rot },
    { angle: 30, length: 250, maxop: 55, narrow: 10, curve: 200, spread: 12, size: 300, rot: 45 });
  const d = M.readZoomState(el({ angle: 'zzz', length: '', maxop: undefined }));
  assert.equal(d.angle, M.ZOOM_DEFAULTS.angle);
  assert.equal(d.length, M.ZOOM_DEFAULTS.length);
  assert.equal(d.maxop, M.ZOOM_DEFAULTS.maxop);
  // ★기본 방향은 12시(위) — y 가 아래로 증가하는 좌표계라 «음수»다
  assert.equal(M.readZoomState(el({})).angle, -90);
});

test('S-5 w/h 는 «없음»이 뜻을 갖는다 — 0·음수·쓰레기는 «없음»이다', () => {
  assert.equal(M.readZoomState(el({})).w, null);
  assert.equal(M.readZoomState(el({ w: '0' })).w, null, '0 을 크기로 받으면 도형이 사라진다');
  assert.equal(M.readZoomState(el({ w: '-5' })).w, null);
  assert.equal(M.readZoomState(el({ w: 'abc' })).w, null);
  assert.equal(M.readZoomState(el({ w: '300', h: '120' })).w, 300);
  assert.equal(M.readZoomState(el({ w: '300', h: '120' })).h, 120);
});

/* ── C19 — a·b 는 «네 값이 다 있을 때만» 사람이 끈 것 ─────────────────────── */
test('S-6 [C19] a·b 는 네 값이 «다» 있어야 고정이다 (하나라도 없으면 자동)', () => {
  assert.deepEqual(M.readPinnedShortEdge(el({ ax: '1', ay: '2', bx: '3', by: '4' })),
                   { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
  assert.equal(M.readPinnedShortEdge(el({})), null);
  for (const k of ['ax', 'ay', 'bx', 'by']) {
    const ds = { ax: '1', ay: '2', bx: '3', by: '4' };
    delete ds[k];
    assert.equal(M.readPinnedShortEdge(el(ds)), null, `${k} 가 없는데 고정으로 읽었다 — 반은 고정·반은 자동이 된다`);
  }
  assert.equal(M.readPinnedShortEdge(el({ ax: 'x', ay: '2', bx: '3', by: '4' })), null, '깨진 값은 고정이 아니다');
  // 지우면 다시 «언제나 자동»
  const b = el({ ax: '1', ay: '2', bx: '3', by: '4' });
  M.clearPinnedShortEdge(b);
  assert.equal(M.readPinnedShortEdge(b), null);
});

test('S-7 크기 덧씌우개를 지우면 «다시 파생»이다', () => {
  const b = el({ w: '300', h: '120' });
  M.clearZoomSizeOverride(b);
  assert.equal(b.dataset.w, undefined);
  assert.equal(b.dataset.h, undefined);
  assert.equal(M.readZoomState(b).w, null);
});

/* ── C15 — 배선. «부르나»를 소스가 아니라 «결과»로 잰다 ────────────────────── */
test('S-8 [C15] renderZoomBlock 은 핸들·이동 드래그를 «실제로» 건다', () => {
  const b = el({});
  M.renderZoomBlock(b);
  const md = b.listeners.filter(l => l.type === 'mousedown');
  assert.equal(md.length, 2, `mousedown 바인딩이 ${md.length}개 — a·b 핸들과 이동 드래그 둘이어야 한다`);
  assert.ok(b.innerHTML.includes('zoom-svg'), '그림이 안 들어갔다');
  assert.ok(/position:absolute/.test(b.style.cssText), '플로팅 위치가 안 찍혔다');
  // 두 번 불러도 «중복 바인딩»되지 않는다(가드가 사는지)
  M.renderZoomBlock(b);
  assert.equal(b.listeners.filter(l => l.type === 'mousedown').length, 2, '재렌더마다 리스너가 쌓인다');
});

test('S-9 renderZoomBlock 이 쓰는 상자·회전이 dataset 을 따라간다', () => {
  const c = el({ shape: 'circle', size: '160' });
  M.renderZoomBlock(c);
  assert.match(c.style.cssText, /width:160\.00px;height:160\.00px;/);
  assert.match(c.style.cssText, /border-radius:50%/, '원인데 모서리가 원이 아니다 — 아웃라인이 사각으로 그려진다');
  assert.equal(c.dataset.rotation, undefined, '원은 돌려도 같은 모양이라 회전을 안 붙인다');

  const sq = el({ shape: 'square', size: '160', rot: '30' });
  M.renderZoomBlock(sq);
  assert.equal(sq.dataset.rotation, '30', '_cornerScreen 이 읽을 회전이 안 찍혔다');
  assert.equal(/transform:/.test(sq.style.cssText), false, 'CSS transform 을 걸면 안 SVG 까지 돌아 그림자 방향이 깨진다');

  // 회전을 0 으로 되돌리면 «지워야» 한다(남으면 아웃라인이 계속 기울어 있다)
  sq.dataset.rot = '0';
  M.renderZoomBlock(sq);
  assert.equal(sq.dataset.rotation, undefined);
});

/* ── 생성 — 기본값과 「a·b 는 안 박는다」를 «실행»으로 ─────────────────────── */
test('S-10 makeZoomBlock 의 기본값이 dataset 에 «실제로» 박힌다', () => {
  const b = M.makeZoomBlock();
  assert.equal(b.dataset.shape, 'rect');
  assert.equal(b.dataset.shadow, 'off');    // ★현빈 정정
  assert.equal(b.dataset.bd, 'off');
  assert.equal(b.dataset.angle, '-90');     // ★12시
  assert.equal(b.dataset.maxop, '30');
  assert.equal(b.dataset.fill, 'checker');  // ★체크패턴
  assert.equal(b.dataset.type, 'zoom');
  assert.equal(b.dataset.selVariant, 'sticker', '보라 갈래를 안 들고 간다');
  assert.match(b.id, /^zmb_/);
  // ⛔a·b 와 w/h 는 생성 시 «안» 박는다
  for (const k of ['ax', 'ay', 'bx', 'by', 'w', 'h']) {
    assert.equal(b.dataset[k], undefined, `생성 시 ${k} 를 박으면 프리셋·방향을 바꿔도 안 따라온다`);
  }
});

test('S-11 makeZoomBlock 은 «행(row)을 만들지 않는다» — 플로팅이라 섹션 직접 자식이다', () => {
  const b = M.makeZoomBlock();
  assert.equal(typeof b.dataset, 'object', '블록 «하나»를 돌려줘야 한다');
  assert.equal(b.row, undefined, '{row, block} 을 돌려주던 흐름 시절로 되돌아갔다');
  assert.match(b.style.cssText, /position:absolute;left:40px;top:40px;/);
});
