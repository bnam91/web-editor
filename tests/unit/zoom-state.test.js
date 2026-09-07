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
  /* ★배율을 «검사가» 정할 수 있게 둔다 — 지디 실측 당시 캔버스 배율은 «0.4» 였다.
     배율 1 로만 재생하면 「화면 델타 ÷ 배율」이 빠진 결함이 안 보인다(내가 그래서 못 재현했다). */
  for (const [spec, stub] of [[DRAG, 'const bindBlock = () => {};'],
                              [SCALE, 'const _canvasScaleNow = () => (globalThis.__zoomScale || 1);']]) {
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
  /* ★document 리스너를 «기록»한다 — 드래그는 document 에 mousemove 를 건다.
     기록하지 않으면 「드래그를 재생하는」 검사를 아예 못 쓴다. */
  globalThis.__docListeners = [];
  globalThis.document = {
    createElement: (tag) => makeEl(tag),
    addEventListener: (type, fn) => globalThis.__docListeners.push({ type, fn }),
    removeEventListener: (t, f) => {
      const i = globalThis.__docListeners.findIndex(l => l.type === t && l.fn === f);
      if (i >= 0) globalThis.__docListeners.splice(i, 1);
    },
  };
  /* ★rAF 를 «즉시 실행»으로 깐다 — 이게 있어야 「그린 뒤에 읽는다」를 검사가 보장한다.
     지디가 실기에서 정확히 이 함정에 빠졌다: 오버레이가 rAF 로 다시 그리는데 그 «앞»을 읽어
     판독 시점마다 답이 달랐다(arcs:4/dLen:150 → len:0). ⇒ 계측은 「그렸나」가 아니라
     「다시 그린 뒤에 읽었나」를 먼저 보장해야 한다. 여기선 rAF 를 동기로 만들어 그 순서를 «고정»한다. */
  globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };

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

test('S-8b [⑪] renderZoomBlock 이 «섹션 밖 크롭»을 실제로 다시 계산한다', () => {
  /* 스티커 계열의 규약이다. ⛔클립은 «블록»이 아니라 «그리는 층»(.zoom-clip)에 걸어야 한다 —
     블록 상자는 도형이라 거기 걸면 ①평상시 값 0 이라 안 잘리고 ②잘리는 순간 그림자가 끊긴다. */
  const seen = [];
  const prev = globalThis.window._updateStickerSecClip;
  globalThis.window._updateStickerSecClip = (el) => seen.push(el);
  try {
    const layer = makeEl('div');
    const b = el({});
    b.querySelector = (sel) => (sel === ':scope > .zoom-clip' ? layer : null);
    M.renderZoomBlock(b);
    assert.equal(seen.length, 1, '렌더가 크롭을 다시 계산하지 않는다 — 그림자가 섹션 밖으로 샌다');
    assert.equal(seen[0], layer, '★블록에 걸었다 — 그리는 층(.zoom-clip)에 걸어야 한다');
  } finally {
    globalThis.window._updateStickerSecClip = prev;
  }
});

test('S-8c [⑪] 층을 못 찾으면 «조용히 넘어간다»(던지지 않는다)', () => {
  const b = el({});
  b.querySelector = () => null;
  assert.doesNotThrow(() => M.updateZoomSecClip(b));
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
  assert.equal(b.dataset.size, '260');      // ★현빈 2026-09-08: 6.5:3.5 → 260×140
  assert.equal(b.dataset.fill, 'checker');  // ★체크패턴
  assert.equal(b.dataset.type, 'zoom');
  assert.equal(b.dataset.selVariant, 'sticker', '보라 갈래를 안 들고 간다');
  assert.match(b.id, /^zmb_/);
  // ⛔a·b 와 w/h 는 생성 시 «안» 박는다
  for (const k of ['ax', 'ay', 'bx', 'by', 'w', 'h']) {
    assert.equal(b.dataset[k], undefined, `생성 시 ${k} 를 박으면 프리셋·방향을 바꿔도 안 따라온다`);
  }
});

test('S-13 [⑮] a·b 앵커 — 집으면 «채움»이 바뀌고, 그 상태는 «저장에 안 실린다»', () => {
  // ★그림자를 켜야 a·b 앵커가 «있다»(끄면 짧은 변 자체가 없다 — 기본은 끔).
  const b = el({ shadow: 'on' });
  M.renderZoomBlock(b);
  assert.match(b.innerHTML, /class="zoom-handle" data-pt="a"/, '전제: 앵커가 그려진다');
  assert.equal(/data-picked/.test(b.innerHTML), false, '아무것도 안 집었는데 집힌 표시가 있다');

  // 집은 상태를 주면 «그 하나»만 표시된다(현빈이 준 일러스트 그림: 하나만 파랗다)
  b._zoomPicked = 'a';
  M.renderZoomBlock(b);
  assert.match(b.innerHTML, /data-pt="a" data-picked="true"/);
  assert.equal(/data-pt="b" data-picked/.test(b.innerHTML), false, '둘 다 칠했다 — 그림은 하나만이다');

  /* ★여기까지는 「렌더가 표시를 그린다」만 잰다. 아래는 «실제로 집는 경로»를 태운다 —
     안 태우면 dataset 으로 새는 변이(M58)가 «통과한다»(실제로 통과했다). */
  const b2 = el({ shadow: 'on' });
  b2.classList.add('selected');
  M.renderZoomBlock(b2);
  /* ⚠️진짜 closest 는 «선택자 목록»('.a, .b')을 처리한다. 처음엔 정확일치로 흉내 냈다가
     이동 드래그의 가드('.zoom-handle, .asset-overlay-handle')를 «못 태워» 집은 상태가
     바로 지워졌다 — 가짜가 진짜보다 덜 하면 검사가 «없는 동작»을 재게 된다. */
  const handle = { dataset: { pt: 'b' },
    closest: (sel) => (String(sel).split(',').some(x => x.trim() === '.zoom-handle') ? handle : null) };
  b2.contains = () => true;
  b2.querySelector = (sel) => (sel === '.zoom-svg'
    ? { getAttribute: () => '0 0 100 100', getBoundingClientRect: () => ({ width: 100 }) }
    : (sel === ':scope > .zoom-clip' ? makeEl('div') : null));
  const md = b2.listeners.filter(l => l.type === 'mousedown');
  assert.equal(md.length, 2, '전제: mousedown 이 둘이다(앵커 드래그 + 이동 드래그)');
  md.forEach(l => l.fn({ button: 0, clientX: 0, clientY: 0, target: handle,
                         preventDefault() {}, stopImmediatePropagation() {} }));
  assert.equal(b2._zoomPicked, 'b', '집는 경로가 상태를 안 남긴다');
  assert.match(b2.innerHTML, /data-pt="b" data-picked="true"/, '집었는데 표시가 안 바뀐다');

  /* ⛔조작 중 상태라 dataset 에 «없어야» 한다 — 이 앱의 저장본은 캔버스 HTML 스냅샷이라
     dataset 에 넣으면 파일에 실린다(section-serialize 가 임시 클래스를 터는 것과 같은 이유). */
  for (const el2 of [b, b2]) {
    for (const k of Object.keys(el2.dataset)) {
      assert.equal(/pick/i.test(k), false, `집은 상태가 dataset.${k} 로 새어 저장본에 실린다`);
    }
  }
});

test('S-11 makeZoomBlock 은 «행(row)을 만들지 않는다» — 플로팅이라 섹션 직접 자식이다', () => {
  const b = M.makeZoomBlock();
  assert.equal(typeof b.dataset, 'object', '블록 «하나»를 돌려줘야 한다');
  assert.equal(b.row, undefined, '{row, block} 을 돌려주던 흐름 시절로 되돌아갔다');
  assert.match(b.style.cssText, /position:absolute;left:40px;top:40px;/);
});

/* ── ⑪ 공유 헬퍼 일반화가 «스티커를 안 바꿨나» ─────────────────────────────────
 * _updateStickerSecClip 은 스티커·목업이 쓰는 «남의 함수»다. 확대블럭의 층은 블록 «안»에
 * 있어 섹션까지 오프셋을 «누적»하도록 고쳤다. ⇒ 직속 자식(스티커)에서 «값이 같은지»를 잰다.
 * ★소스를 읽어 «식»을 그대로 실행한다 — 「같을 것이다」라고 논증하지 않는다.
 * ───────────────────────────────────────────────────────────────────────── */
const { test: t2 } = require('node:test');

t2('S-12 [⑪] 공유 클립 함수 — 섹션 «직속» 자식(스티커)에서 값이 예전과 같다', async () => {
  /* ⛔pathToFileURL 을 «별칭»으로 가리지 마라 — tests/unit/win-portability.test.mjs 의 ②-4 가
     「import() 호출 자리에 file:// 변환이 보이나」를 잰다. 내가 p2u 로 가렸다가 잡혔다.
     그 규칙이 옳다: 헬퍼로 감싸면 호출 자리에서 안 보이고, 윈도우에서 경로가 조용히 깨진다. */
  const dir = mkTmpRoot('sticker-clip-');

  // ★함수 본문만 떼어 «진짜 실행»한다(스티커 모듈 전체는 브라우저 의존이 커서 못 띄운다).
  const src = readSrc(ROOT, 'js', 'blocks', 'sticker-block.js');
  const i = src.indexOf('function _updateStickerSecClip(block) {');
  assert.notEqual(i, -1, '공유 클립 함수를 못 찾음 — 검사가 대상을 놓쳤다');
  const j = src.indexOf('\n}\n', i);
  assert.notEqual(j, -1, '함수 끝을 못 찾음');
  const body = src.slice(i, j + 3);
  const mjs = path.join(dir, 'clip.mjs');
  fs.writeFileSync(mjs, body + '\nexport { _updateStickerSecClip };\n', 'utf8');
  const { _updateStickerSecClip: fn } = await import(pathToFileURL(mjs).href);

  // 섹션 직속 스티커 — offsetParent 가 곧 섹션이다(누적 루프가 한 번 돈다)
  const sec = { clientWidth: 800, clientHeight: 400, contains: () => true };
  const props = {};
  const stk = {
    offsetWidth: 60, offsetHeight: 60, offsetLeft: -20, offsetTop: -30,
    offsetParent: sec, closest: () => sec,
    style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } },
  };
  fn(stk);
  // 예전 식: t=max(0,30)=30 · l=max(0,20)=20 · r=max(0,-20+60-800)=0 · b=max(0,-30+60-400)=0
  assert.equal(props['--sec-clip'], 'inset(30px 0px 0px 20px)', '직속 자식 값이 달라졌다 — 스티커가 바뀐다');

  // 섹션 «안»에 있으면 변수를 지운다(예전과 같다)
  const inside = { ...stk, offsetLeft: 10, offsetTop: 10 };
  fn(inside);
  assert.equal(props['--sec-clip'], undefined);

  // ★확대블럭 경우 — 한 단계 더 안(블록 안의 층)에서도 «누적»되어 값이 나온다
  const blk = { offsetLeft: 40, offsetTop: 40, offsetParent: sec, contains: () => true };
  sec.contains = (el) => el === blk || el === layer;
  const layer = {
    offsetWidth: 188, offsetHeight: 248, offsetLeft: -14, offsetTop: -134,
    offsetParent: blk, closest: () => sec,
    style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } },
  };
  fn(layer);
  // 층의 섹션 내 좌표 = (40-14, 40-134) = (26, -94) ⇒ t=94 · l=0
  assert.equal(props['--sec-clip'], 'inset(94px 0px 0px 0px)',
    '누적이 안 된다 — 그림자가 섹션 밖으로 나가도 «안 잘린다»(⑪ 이 그 결함이었다)');
});

/* ── ⑲ dataset ↔ style «항상 같다» ────────────────────────────────────────────
 * 지디 실기: 섹션 간 드래그 뒤 dataset.y=114 인데 style.top=960px 로 갈렸다.
 *   저장되는 건 dataset 이므로 «화면과 저장본이 다르다» — 치명 부류다.
 * ★한 경로만 막으면 다른 경로에서 또 난다 ⇒ 이동·섹션이동·되돌림·재렌더를 «다» 훑어
 *   불변식 하나로 못박는다.
 * ⛔이 검사는 «우리 코드 경로»만 덮는다 — 담는 상자(offsetParent)가 섹션이 아닌 경우는
 *   여기서 못 잰다(브라우저 레이아웃이라 헤드리스로는 재현 불가). 보고에 그렇게 적었다.
 * ───────────────────────────────────────────────────────────────────────── */
const { test: t3 } = require('node:test');

/* ★offsetTop 은 지디 실측값(섹션 offsetTop = [0, 463, 846])을 쓴다 — 「절대 y 를 썼다」는
   변이가 «정확히 그 846» 만큼 어긋나야 이 검사가 실제 결함을 재현한 것이 된다. */
function mkSection(name, left, top, w, h, offsetTop = 0) {
  return { name, clientWidth: w, clientHeight: h, offsetTop, offsetLeft: 0,
    getBoundingClientRect: () => ({ left, top, width: w, height: h }),
    appendChild(b) { b._parent = this; }, contains: () => true };
}

t3('S-14 [⑲] 드래그·섹션이동·재렌더 «전부»에서 dataset.x/y 와 style.left/top 이 같다', async () => {
  /* _clampToSection 은 «진짜» 것을 떼어 쓴다 — 식을 베끼면 두 정본이 된다(S-12 와 같은 수법). */
  const src = readSrc(ROOT, 'js', 'sticker-select.js');
  const i = src.indexOf('function _clampToSection');
  assert.notEqual(i, -1, '클램프 함수를 못 찾음 — 검사가 대상을 놓쳤다');
  const j = src.indexOf('\n}\n', i);
  const dir = mkTmpRoot('zoom-clamp-');
  const mjs = path.join(dir, 'clamp.mjs');
  fs.writeFileSync(mjs, src.slice(i, j + 3) + '\nexport { _clampToSection };\n', 'utf8');
  const { _clampToSection } = await import(pathToFileURL(mjs).href);

  // ★지디 실측 배치 그대로
  const sec0 = mkSection('sec0', 545, 84, 344, 145, 0);
  const sec2 = mkSection('sec2', 545, 422, 344, 193, 846);
  const prevClamp = globalThis.window._clampToSection;
  const prevFind = globalThis.window._findSectionAt;
  globalThis.window._clampToSection = _clampToSection;
  globalThis.window._findSectionAt = (x, y) => {
    for (const s of [sec0, sec2]) {
      const r = s.getBoundingClientRect();
      if (x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) return s;
    }
    return null;
  };
  globalThis.__docListeners.length = 0;
  try {
    const b = M.makeZoomBlock({ x: 40, y: 40 });
    b._parent = sec0;
    b.closest = () => b._parent;
    const W = 260, H = 140;
    b.offsetWidth = W; b.offsetHeight = H;
    b.getBoundingClientRect = () => {
      const r = b._parent.getBoundingClientRect();
      return { left: r.left + Number(b.dataset.x), top: r.top + Number(b.dataset.y), width: W, height: H };
    };
    /* ★가짜 style 이 cssText 를 «풀어» left/top 에 담아야 한다 — 진짜 브라우저가 그렇게 한다.
       안 풀면 재렌더 뒤 style.left 가 undefined 라 불변식이 «가짜로» 깨진다(실제로 그랬다). */
    const raw = b.style;
    b.style = {
      get cssText() { return raw.cssText; },
      set cssText(v) {
        raw.cssText = v;
        for (const d of String(v).split(';')) {
          const [k, val] = d.split(':');
          if (k && val) this[k.trim()] = val.trim();
        }
      },
      left: '', top: '',
    };
    M.renderZoomBlock(b);

    const same = (tag) => {
      assert.equal(b.style.left, `${b.dataset.x}px`, `${tag}: x 가 갈렸다`);
      assert.equal(b.style.top, `${b.dataset.y}px`, `${tag}: ★y 가 갈렸다 — 저장본과 화면이 다르다`);
    };
    same('생성·렌더 직후');

    const md = b.listeners.filter(l => l.type === 'mousedown');
    assert.equal(md.length, 2, '전제: mousedown 이 둘이다');
    const start = { clientX: 545 + 40 + W / 2, clientY: 84 + 40 + H / 2 };
    md.forEach(l => l.fn({ button: 0, ...start, target: { closest: () => null },
                           preventDefault() {}, stopImmediatePropagation() {} }));
    const move = () => globalThis.__docListeners.filter(l => l.type === 'mousemove');
    assert.ok(move().length >= 1, '전제: 드래그가 document 에 mousemove 를 건다');

    move().forEach(l => l.fn({ clientX: start.clientX, clientY: 422 + 100, metaKey: false }));
    assert.equal(b._parent.name, 'sec2', '전제: 섹션2 로 옮겨졌다');
    same('섹션2 로 이동');

    move().forEach(l => l.fn({ clientX: start.clientX + 50, clientY: 422 + 150, metaKey: false }));
    same('섹션2 안에서 이동');

    move().forEach(l => l.fn({ clientX: start.clientX, clientY: 84 + 60, metaKey: false }));
    assert.equal(b._parent.name, 'sec0', '전제: 섹션0 으로 되돌아왔다');
    same('섹션0 으로 되돌림');

    // ⌘ 자유이동(클램프 없음)에서도 갈리면 안 된다
    move().forEach(l => l.fn({ clientX: start.clientX, clientY: 84 - 200, metaKey: true }));
    same('⌘ 자유이동');

    M.renderZoomBlock(b);
    same('재렌더 뒤');

    // 크기가 바뀌어도(핸들 경로) 위치 표기는 안 갈린다
    b.dataset.w = '400'; b.dataset.h = '200';
    M.renderZoomBlock(b);
    same('크기 바꾼 뒤');
  } finally {
    globalThis.window._clampToSection = prevClamp;
    globalThis.window._findSectionAt = prevFind;
  }
});

t3('S-15 [⑲] ★«잡은 지점»이 커서를 따라간다 — 섹션이 바뀌어도, ★배율 1·0.4 둘 다', async () => {
  /* ⛔S-14(dataset↔style 일치)만으론 부족하다. 둘이 «같이» 틀리면 통과한다 —
     변이 M62(섹션이 바뀌었는데 «옛 섹션» 기준)가 실제로 S-14 를 통과했다.
     ★그게 ⑲의 «모양»이다: 값은 서로 맞는데 «자리»가 섹션 간 차이만큼 어긋난다.
     ⇒ 진짜 불변식 = 드래그 내내 「커서 − 블록 좌상단」이 처음 잡은 오프셋 그대로다.
       비교 대상 하나가 «바깥»(커서)에 있어야 둘이 같이 틀려도 눈이 안 먼다.
     ★★그리고 «배율»을 함께 돈다 — 지디 실측 당시 0.4 였고, 나는 1 로만 재생해 못 재현했다.
       화면 좌표에는 배율이 곱해져 있으므로 가짜 DOM 도 그렇게 굴어야 진짜를 잰다. */
  const src = readSrc(ROOT, 'js', 'sticker-select.js');
  const i = src.indexOf('function _clampToSection');
  const j = src.indexOf('\n}\n', i);
  const dir = mkTmpRoot('zoom-grab-');
  const mjs = path.join(dir, 'clamp.mjs');
  fs.writeFileSync(mjs, src.slice(i, j + 3) + '\nexport { _clampToSection };\n', 'utf8');
  const { _clampToSection } = await import(pathToFileURL(mjs).href);

  const prevClamp = globalThis.window._clampToSection;
  const prevFind = globalThis.window._findSectionAt;
  const prevScale = globalThis.__zoomScale;
  globalThis.window._clampToSection = _clampToSection;
  try {
    for (const S of [1, 0.4]) {          // ★배율 둘
      globalThis.__zoomScale = S;
      // 화면 rect — 레이아웃 거리 846 이 배율에 따라 화면에선 846·S 로 보인다(실측 338 ≈ 846×0.4)
      const sec0 = mkSection('sec0', 545, 84, 900, 900, 0);
      const sec2 = mkSection('sec2', 545, 84 + 846 * S, 900, 900, 846);
      globalThis.window._findSectionAt = (x, y) => {
        for (const sc of [sec2, sec0]) {   // 아래쪽 섹션을 먼저 본다(겹치면 그쪽)
          const r = sc.getBoundingClientRect();
          if (x >= r.left && x <= r.left + r.width * S && y >= r.top && y <= r.top + r.height * S) return sc;
        }
        return null;
      };
      globalThis.__docListeners.length = 0;

      const b = M.makeZoomBlock({ x: 100, y: 100 });
      b._parent = sec0;
      b.closest = () => b._parent;
      const W = 260, H = 140;
      b.offsetWidth = W; b.offsetHeight = H;
      // ★화면 rect = 섹션 화면원점 + 레이아웃좌표 × 배율
      const rectOf = () => {
        const r = b._parent.getBoundingClientRect();
        return { left: r.left + Number(b.dataset.x) * S, top: r.top + Number(b.dataset.y) * S };
      };
      b.getBoundingClientRect = () => ({ ...rectOf(), width: W * S, height: H * S });

      const md = b.listeners.filter(l => l.type === 'mousedown');
      const GRAB = { x: 60, y: 30 };                    // «레이아웃» 단위
      const start = { clientX: 545 + (100 + GRAB.x) * S, clientY: 84 + (100 + GRAB.y) * S };
      md.forEach(l => l.fn({ button: 0, ...start, target: { closest: () => null },
                             preventDefault() {}, stopImmediatePropagation() {} }));
      const move = () => globalThis.__docListeners.filter(l => l.type === 'mousemove');
      assert.ok(move().length >= 1, `배율 ${S}: 전제 — 드래그가 mousemove 를 건다`);

      const grabOk = (tag, ev) => {
        const r = rectOf();
        assert.ok(Math.abs((ev.clientX - r.left) / S - GRAB.x) <= 1,
          `배율 ${S} · ${tag}: 가로가 ${((ev.clientX - r.left) / S).toFixed(0)} 로 밀렸다(기대 ${GRAB.x})`);
        assert.ok(Math.abs((ev.clientY - r.top) / S - GRAB.y) <= 1,
          `배율 ${S} · ${tag}: ★세로가 ${((ev.clientY - r.top) / S).toFixed(0)} 로 밀렸다(기대 ${GRAB.y}) — 블록이 커서에서 떨어졌다`);
        assert.equal(b.style.left, `${b.dataset.x}px`, `배율 ${S} · ${tag}: dataset↔style x`);
        assert.equal(b.style.top, `${b.dataset.y}px`, `배율 ${S} · ${tag}: ★dataset↔style y`);
      };

      let ev = { clientX: start.clientX + 30 * S, clientY: start.clientY + 40 * S, metaKey: false };
      move().forEach(l => l.fn(ev)); grabOk('같은 섹션 안 이동', ev);

      ev = { clientX: start.clientX, clientY: 84 + (846 + 300) * S, metaKey: false };   // ★섹션2 로
      move().forEach(l => l.fn(ev));
      assert.equal(b._parent.name, 'sec2', `배율 ${S}: 전제 — 섹션2 로 옮겨졌다`);
      grabOk('★섹션2 로 이동', ev);

      ev = { clientX: start.clientX + 80 * S, clientY: 84 + (846 + 500) * S, metaKey: false };
      move().forEach(l => l.fn(ev)); grabOk('섹션2 안에서 이동', ev);

      ev = { clientX: start.clientX, clientY: 84 + 300 * S, metaKey: false };
      move().forEach(l => l.fn(ev));
      assert.equal(b._parent.name, 'sec0', `배율 ${S}: 전제 — 섹션0 으로 되돌아왔다`);
      grabOk('섹션0 으로 되돌림', ev);
    }
  } finally {
    globalThis.window._clampToSection = prevClamp;
    globalThis.window._findSectionAt = prevFind;
    globalThis.__zoomScale = prevScale;
  }
});
