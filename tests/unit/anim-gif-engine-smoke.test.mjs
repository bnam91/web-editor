/* anim-gif-engine-smoke.test.mjs — animation-engine.js 를 «실제로 돌린다»(모달 열기 → 효과 고르기 → 미리보기 몇 프레임 → GIF 프레임 수).
 * 렌더 실행 단위다(e32eabd44 교훈) — DOM 스펙은 srv 에서 못 돈다. 엔진의 V2 연결(_plan)은 여기서만 srv 에서 실행된다.
 *   · 엔진·fx 두 파일을 공용 임시 우산(mkTmpRoot)에 .mjs 로 복사(js/ 의 .js 는 node 가 CommonJS 로 읽는다) · file: URL(win-portability ②-4).
 *   · export-image.js 하나만 대역(sectionBgColor) · 모달 DOM 은 엔진이 쓰는 만큼만 가짜.
 * F3 E3: 저장된 줄별 트랙(P076 꼴)으로 모달을 열면 미리보기가 «줄마다» 돈다 · «줄마다 따로» 켜기 = data-anim-gif 를 쓴다(한 번 · 같은 값이면 안 씀).
 * 양성대조(실측은 커밋 메시지): _plan 의 V2 갈래를 지우면(모두 _drawFrame 로) E1(흐림 0 — _drawFrame 엔 stamp 갈래가 없어 아무것도 안 그림) 빨강 ·
 *   _plan duration 을 1200/speed 로 되돌리면 E2(GIF 프레임 수) 빨강.
 * E5(0.9.12 QA GIF-PREVIEW-CLIPPED-01): 72px 한 줄 블럭(716×83)을 캔버스가 두 줄로 접으면 높이가 블럭 비율(480×56)이라 위아래가 잘렸다.
 *   양성대조(예측): fitCanvasH 가 H 를 그대로 돌려주면(return H) E5 빨강(미리보기 56 · 줄 위끝 < 0).
 * E6(같은 신고 후속 · 화면 == 내보낸 것): 블럭 글 안쪽 폭에서 접는다 — 블럭에서 한 줄이면 미리보기·GIF 도 한 줄 · 두 줄 블럭은 두 줄(음성).
 *   양성대조(실측은 커밋 메시지): textBox 를 옛 규칙(좌우 5%)만 쓰게 하면 E6 한 줄 칸 빨강.
 * E7(GIF-SPEED-REPEAT-SLIDER-REFERENCEERROR-01): index.html GIF 모달의 인라인 on* 이 부르는 함수 = 엔진이 window 에 붙인 함수(모듈이라 안 붙이면 ReferenceError).
 *   양성대조(실측은 커밋 메시지): window.restartAnimPreview 줄 삭제 → E7 빨강.
 * E8(RICHTEXT C2): 블럭 DOM 의 부분 꾸밈 span(색·굵기·기울임·크기) → 계산된 스타일 → 미리보기·GIF 저장 조각 그리기(실엔진 · V1 fade-in · V2 stamp).
 *   양성대조(실측은 커밋 메시지): 엔진 _runStyle 이 늘 null → E8 빨강.
 * E9(RICHTEXT C3): <u>(밑줄 색) · <s> · span.tb-hl(변수 색·높이) · 배경색 span → 미리보기·GIF 저장에 그 색 장식(실엔진 · fade-in).
 *   양성대조(실측은 커밋 메시지): 엔진 _runStyle 의 장식 거슬러 올라가기(for n = host …) 삭제 → E9 빨강.
 * E10(RICHTEXT C4): 범위 글로우 span(계산된 text-shadow 3겹) → 그 조각만 그림자 3층 · 블럭 전체 그림자(글 요소 text-shadow) → 모든 조각 · 미리보기 배율 29/24(그리는 글자 크기 비) · GIF 저장 배율 2.
 *   양성대조(아이맥 실측 예정): fillStyled 의 `_shadows(…)` 호출 줄 삭제 → E10 빨강.
 * E11(RICHTEXT C5): 글자마다 span.tb-dot(::before 계산 크기·색·transform) → 미리보기·GIF 저장에 그 글자마다 점 하나(배율 29/24 · 2).
 *   양성대조(아이맥 실측 예정): _decor 의 `if (st.dot) {` → `if (false) {` → E11 빨강.
 * E12(RICHTEXT C6): 효과 전부(V1 일곱 · V2 셋 · 줄마다 따로 슬롯) 끝 프레임에서 꾸밈 유지 — 빨강 조각 · 방점(안 잘림) · 글로우 층.
 *   양성대조(아이맥 실측 예정): 줄별 slot-machine 의 `const roll = r.frac > 0;` → `true` → E12(줄마다 따로 슬롯) 빨강.
 * E14(PLAY-ON-CANVAS-01): «캔버스에서 보기» — 모달 닫힘 · 덮개 캔버스는 document.body 에(블럭 안 X) · 크기 = 블럭 × 2 · 매 프레임 블럭 자리 · 같은 엔진 그림 ·
 *   아무 키 = 멈춤(덮개 걷힘 · 리스너 해제 · rAF 끊김 · 그 키는 막고 끊음) · 클릭 = 멈춤 + 따라오는 mousedown/mouseup/click 한 번 삼킴 · 블럭이 사라지면 스스로 멈춤 · 글 DOM 무변.
 *   양성대조(아이맥 실측 예정): playAnimOnCanvas 의 `document.body.appendChild(cv)` → `tb.appendChild(cv)` → E14 빨강(DOM P1 도).
 * E13(RICHTEXT ⑫): 글 요소 background-clip:text 그라데이션(제품 gradient-model.js 를 window.GradientModel 로) → 미리보기·GIF 저장 글 채움 = 캔버스 그라데이션(스탑 그대로) ·
 *   부분 단색 span(-webkit-text-fill-color) 은 단색 유지. 양성대조(아이맥 실측 예정): withGradFill 첫 줄 `return style;` → E13 빨강.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function fakeCtx() {
  const calls = [];
  const ctx = {
    calls, filter: 'none', globalAlpha: 1, font: '', fillStyle: '', textAlign: '', textBaseline: '', shadowBlur: 0, shadowColor: '',
    measureText: (s) => ({ width: String(s).length * 10 }),
    fillText: (s, x, y) => calls.push({ s: String(s), x, y, f: ctx.filter, fill: ctx.fillStyle, font: ctx.font, sc: ctx.shadowColor, sox: ctx.shadowOffsetX, soy: ctx.shadowOffsetY, sb: ctx.shadowBlur, clip: ctx._clip }),
    rects: [], fillRect: (x, y, w, h) => ctx.rects.push({ x, y, w, h, fill: ctx.fillStyle }), clearRect() {},
    arcs: [], arc: (x, y, r) => ctx.arcs.push({ x, y, r, fill: ctx.fillStyle, clip: ctx._clip }), fill() {}, _clip: false, _cs: [], save() { ctx._cs.push(ctx._clip); }, restore() { ctx._clip = ctx._cs.pop() ?? false; }, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() { ctx._clip = true; },
  };
  return ctx;
}
function fakeEl(extra = {}) {
  const el = {
    style: {}, dataset: {}, _l: {}, _html: '', value: '', textContent: '', disabled: false, title: '', checked: false,
    classList: { _s: new Set(), toggle(c, on) { (on ?? !this._s.has(c)) ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); }, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); } },
    append(...a) { (this._kids ??= []).push(...a); }, appendChild(a) { (this._kids ??= []).push(a); return a; },
    addEventListener(t, f) { (el._l[t] ??= []).push(f); }, setAttribute() {}, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [],
    set innerHTML(v) { el._html = String(v); }, get innerHTML() { return el._html; },
    ...extra,
  };
  return el;
}

async function loadEngine() {
  const dir = mkTmpRoot('anim-gif-engine-smoke-');
  fs.writeFileSync(path.join(dir, 'anim-gif-text.mjs'), read('js/fx/anim-gif-text.js'));
  const tracks = read('js/fx/anim-gif-tracks.js');
  assert.match(tracks, /from '\.\/anim-gif-text\.js'/, '[전제] tracks import 꼴');
  fs.writeFileSync(path.join(dir, 'anim-gif-tracks.mjs'), tracks.replace("from './anim-gif-text.js'", "from './anim-gif-text.mjs'"));
  let eng = read('js/animation-engine.js');
  const subs = [
    ["from './fx/anim-gif-text.js'", "from './anim-gif-text.mjs'"],
    ["from './fx/anim-gif-tracks.js'", "from './anim-gif-tracks.mjs'"],
    ["import { sectionBgColor } from './io/export-image.js';", "const sectionBgColor = () => '#ffffff';"],
  ];
  for (const [a, b] of subs) { assert.ok(eng.includes(a), `[전제] 엔진 import 꼴: ${a}`); eng = eng.replace(a, b); }
  fs.writeFileSync(path.join(dir, 'engine.mjs'), eng);

  // 가짜 문서 — 엔진이 쓰는 만큼
  const els = {};
  const ctx = fakeCtx();
  els['anim-preview-canvas'] = fakeEl({ width: 0, height: 0, getContext: () => ctx });
  els['anim-speed'] = fakeEl({ value: '1' });
  els['anim-repeat'] = fakeEl({ value: '1' });
  els['anim-list'] = fakeEl();
  els['anim-list'].querySelectorAll = () => [...els['anim-list']._html.matchAll(/data-id="([^"]+)"/g)].map((m) => {
    const it = fakeEl({ dataset: { id: m[1] }, classList: { toggle() {} } });
    it.querySelector = () => fakeEl();
    return it;
  });
  const btn = fakeEl({ textContent: 'GIF 저장' });
  const rafs = [];
  globalThis.document = {
    getElementById: (id) => (els[id] ??= fakeEl()),
    querySelector: (s) => (s === '.anim-export-btn' ? btn : null),
    querySelectorAll: () => [],
    createElement: () => fakeEl({ getContext: () => ctx }),
    body: fakeEl({ appendChild() {}, removeChild() {} }),
  };
  globalThis.window = globalThis;
  globalThis.requestAnimationFrame = (f) => { rafs.push(f); return rafs.length; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.getComputedStyle = () => ({ fontSize: '24px', color: '#111', fontFamily: 'sans-serif', fontWeight: '700', letterSpacing: '0px', textAlign: 'center', lineHeight: '33.6px' });
  globalThis.showToast = () => {};
  let gifFrames = 0, gifOpts = null;
  globalThis.GIF = class { constructor(o) { gifOpts = o; } addFrame() { gifFrames++; } on() {} render() {} };
  await import(pathToFileURL(path.join(dir, 'engine.mjs')).href);
  const textEl = fakeEl({ innerHTML: '오늘 주문하면?<br>네!', textContent: '오늘 주문하면?네!' });
  textEl.innerHTML = '오늘 주문하면?<br>네!';
  const tb = fakeEl({ offsetWidth: 400, offsetHeight: 120, closest: () => null, querySelector: (s) => (s === '[contenteditable]' ? textEl : null) });
  return { ctx, rafs, els, tb, textEl, frames: () => gifFrames, gifOpts: () => gifOpts };
}

test('E1 모달 → «도장 찍기» 고름 → 미리보기 프레임이 «실제로» 그려진다(앞 = 흐림 · 끝 = 선명 · 두 줄)', async () => {
  const E = await loadEngine();
  // _selectAnim 은 모듈 안 — 항목 클릭과 같은 길: 목록을 그리게 한 뒤 엔진이 그 항목에 건 click 리스너를 부른다
  const items = [];
  E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
  window.openAnimModal(E.tb);
  const stampItem = items.find((it) => it.dataset.id === 'stamp');
  assert.ok(stampItem?._l.click?.length, '[전제] 항목에 click 리스너');
  stampItem._l.click[0]();
  E.ctx.calls.length = 0;
  const tick = E.rafs.at(-1);
  assert.equal(typeof tick, 'function', '[전제] 미리보기 rAF');
  tick(1000);              // 시작 프레임(τ = 0)
  const first = E.ctx.calls.slice();
  E.ctx.calls.length = 0;
  E.rafs.at(-1)(1000 + 5000);   // 한 바퀴 뒤(끝 프레임)
  const last = E.ctx.calls.slice();
  assert.ok(first.length && first.every((c) => /^blur\(/.test(c.f)), `시작 = 흐림 ${JSON.stringify(first.map((c) => c.f))}`);
  assert.deepEqual(last.map((c) => [c.s, c.f]), [['오늘 주문하면?', 'none'], ['네!', 'none']], '끝 = 두 줄 선명');
});

test('E2 GIF 프레임 수 = 도장 한 바퀴(560ms · 20fps) + 끝 멈춤 1.5초 — V1(1200ms)과 다르다', async () => {
  const E = await loadEngine();
  const items = [];
  E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
  window.openAnimModal(E.tb);
  items.find((it) => it.dataset.id === 'stamp')._l.click[0]();
  await window.exportAnimGif();
  assert.equal(E.frames(), (Math.ceil((560 / 1000) * 20) + 1) + Math.ceil(20 * 1.5));
  assert.equal(E.els['anim-loop-info'].textContent, `한 바퀴 0.56초 · GIF ${E.frames()}프레임`, 'F4 안내 = 실제 GIF 프레임 수');
});

test('E3 F3 줄마다 따로 — 저장본 P076(질문 타이핑 0~1000 · 답 도장 1100~1660)으로 열면 τ=500 엔 질문만 · 끝엔 둘 다 선명 · 켜기 = data-anim-gif 쓰기', async () => {
  const E = await loadEngine();
  E.tb.dataset.animGif = JSON.stringify({ v: 2, tracks: [{ line: 0, fx: 'typewriter', at: 0, dur: 1000 }, { line: 1, fx: 'stamp', at: 1100, dur: 560 }], speed: 1, repeat: 1 });
  let pushes = 0; globalThis.pushHistory = () => { pushes++; };
  window.openAnimModal(E.tb);
  assert.equal(E.els['anim-per-line'].checked, true, '저장본이 있으면 «줄마다 따로» 켜짐');
  assert.equal(E.els['anim-list'].classList.contains('is-off'), true, '왼쪽 목록은 쉰다');
  const tick = (ms) => { E.ctx.calls.length = 0; E.rafs.at(-1)(ms); return E.ctx.calls.map((c) => [c.s, c.f]); };
  tick(1000);                       // 시작 시각을 박는다(τ = 0)
  const mid = tick(1000 + 500);
  assert.ok(mid.length && mid.every(([s]) => s !== '네!'), `★답이 시작 전에 보인다 ${JSON.stringify(mid)}`);
  const end = tick(1000 + 1660);
  assert.deepEqual(end.filter(([s]) => s === '오늘 주문하면?' || s === '네!'), [['오늘 주문하면?', 'none'], ['네!', 'none']]);
  window.closeAnimModal();
  assert.equal(pushes, 0, '안 바꾸고 닫으면 이력 0');
  // 저장본 없는 블럭에서 켜기
  const F = await loadEngine();
  let p2 = 0; globalThis.pushHistory = () => { p2++; };
  window.openAnimModal(F.tb);
  assert.equal(F.tb.dataset.animGif, undefined, '[전제] 처음엔 저장 0');
  window.setAnimPerLine(true);
  const saved = JSON.parse(F.tb.dataset.animGif);
  assert.deepEqual(saved.tracks.map((t) => [t.line, t.at]), [[0, 0], [1, 1000]], '켜면 줄마다 차례로(앞 줄 끝에 시작)');
  assert.equal(p2, 1, '이력 한 칸');
  window.setAnimPerLine(false);
  assert.equal(F.tb.dataset.animGif, undefined, '끄면 저장 지움');
});

test('E4 다시 열면 «저장값»을 읽는다 — 닫은 뒤 저장만 바꾸면(메모리와 다르게) 그 값으로 한 바퀴가 선다', async () => {
  const E = await loadEngine();
  globalThis.pushHistory = () => {};
  E.tb.dataset.animGif = JSON.stringify({ v: 2, tracks: [{ line: 0, fx: 'typewriter', at: 0, dur: 1000 }, { line: 1, fx: 'stamp', at: 1100, dur: 800 }], speed: 1, repeat: 1 });
  window.openAnimModal(E.tb);
  assert.equal(E.els['anim-loop-info'].textContent, `한 바퀴 1.90초 · GIF ${Math.ceil(1.9 * 20) + 1 + 30}프레임`, '[전제] 처음 열기 = 저장값');
  window.closeAnimModal();
  const o = JSON.parse(E.tb.dataset.animGif); o.tracks[1].dur = 900; o.speed = 2;
  E.tb.dataset.animGif = JSON.stringify(o);
  window.openAnimModal(E.tb);
  assert.equal(E.els['anim-speed'].value, '2', '속도 = 저장값');
  assert.equal(E.els['anim-loop-info'].textContent, `한 바퀴 1.00초 · GIF ${Math.ceil(1.0 * 20) + 1 + 30}프레임`, '★다시 열 때 저장값을 안 읽었다(메모리 1.90초)');
});

test('E5 잘림 0 — 72px 한 줄 블럭(716×83)이 캔버스에서 두 줄로 접혀도 미리보기·GIF 저장 둘 다 글 위아래가 캔버스 안(V1 fade-in · V2 stamp)', async () => {
  for (const fx of ['fade-in', 'stamp']) {
    const E = await loadEngine();
    globalThis.getComputedStyle = () => ({ fontSize: '72px', color: '#111', fontFamily: 'sans-serif', fontWeight: '700', letterSpacing: '0px', textAlign: 'center', lineHeight: '83px' });
    E.ctx.measureText = (s) => ({ width: String(s).length * (parseFloat(/([\d.]+)px/.exec(E.ctx.font)?.[1]) || 10) * 0.6 });   // 글자 폭 = 0.6em
    E.textEl.innerHTML = 'aaaaa bbbbb ccccc ddddd';
    E.tb.offsetWidth = 716; E.tb.offsetHeight = 83;
    const items = [];
    E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
    window.openAnimModal(E.tb);
    items.find((it) => it.dataset.id === fx)._l.click[0]();
    const inside = (calls, H, size, where) => {
      assert.equal(calls.length, 2, `[전제] ${fx} ${where}: 캔버스가 두 줄로 접는다 ${JSON.stringify(calls)}`);
      for (const c of calls) assert.ok(c.y - size / 2 >= 0 && c.y + size / 2 <= H, `★${fx} ${where} 잘림: y=${c.y} size=${size} H=${H}`);
    };
    const cv = E.els['anim-preview-canvas'];
    E.rafs.at(-1)(1000);
    E.ctx.calls.length = 0;
    E.rafs.at(-1)(1000 + 5000);   // 끝 프레임
    inside(E.ctx.calls.slice(), cv.height, Math.round(72 * 480 / 716), '미리보기');
    E.ctx.calls.length = 0;
    await window.exportAnimGif();
    assert.equal(E.gifOpts().width, 1432, '[전제] 저장 폭 = 블럭 2배');
    inside(E.ctx.calls.slice(-2), E.gifOpts().height, 144, 'GIF 저장');
    window.closeAnimModal();
  }
});

test('E6 블럭과 같은 줄바꿈 — 716 폭 72px: 블럭 한 줄(9.6em ≤ 안쪽 9.67em)은 미리보기·GIF 저장 한 줄 · 블럭 두 줄(13.8em)은 두 줄 유지(V1 fade-in · V2 stamp)', async () => {
  const cases = [['aaaaaaa bbbbbbbb', 1], ['aaaaa bbbbb ccccc ddddd', 2]];   // 글자 폭 0.6em ⇒ 16자 = 9.6em · 23자 = 13.8em
  for (const fx of ['fade-in', 'stamp']) for (const [text, want] of cases) {
    const E = await loadEngine();
    globalThis.getComputedStyle = () => ({ fontSize: '72px', color: '#111', fontFamily: 'sans-serif', fontWeight: '700', letterSpacing: '0px', textAlign: 'center', lineHeight: '83px', paddingLeft: '10px', paddingRight: '10px' });
    E.ctx.measureText = (s) => ({ width: String(s).length * (parseFloat(/([\d.]+)px/.exec(E.ctx.font)?.[1]) || 10) * 0.6 });
    E.textEl.innerHTML = text;
    E.textEl.clientWidth = 716;   // 안쪽 = 716 − 20 = 696px = 9.67em
    E.tb.offsetWidth = 716; E.tb.offsetHeight = want === 1 ? 83 : 166;
    const items = [];
    E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
    window.openAnimModal(E.tb);
    items.find((it) => it.dataset.id === fx)._l.click[0]();
    E.rafs.at(-1)(1000);
    E.ctx.calls.length = 0;
    E.rafs.at(-1)(1000 + 5000);   // 끝 프레임
    const prev = E.ctx.calls.map((c) => c.s);
    assert.equal(prev.length, want, `★${fx} «${text}» 미리보기 줄 수 ≠ 블럭(${want}) ${JSON.stringify(prev)}`);
    assert.equal(prev.join(' '), text, `${fx} 글 그대로`);
    E.ctx.calls.length = 0;
    await window.exportAnimGif();
    const out = E.ctx.calls.slice(-want).map((c) => c.s);   // 끝 멈춤 프레임의 마지막 want 조각 — 줄 수가 다르면 이어 붙인 글이 원문과 달라진다
    assert.equal(out.join(' '), text, `★${fx} «${text}» GIF 저장 줄 ≠ 블럭 ${JSON.stringify(E.ctx.calls.slice(-3).map((c) => c.s))}`);
    window.closeAnimModal();
  }
});

test('E7 GIF 모달 인라인 on* 이 부르는 함수는 전부 window 에 있다(속도·반복 슬라이더 restartAnimPreview 포함) · 부르면 미리보기가 다시 선다', async () => {
  const E = await loadEngine();
  const html = read('index.html');
  /* 모달 조각 = 여는 <div id="anim-gif-modal"> 부터 짝 닫는 </div> 까지(div 깊이) — 고정 창(«+ 200») 금지(fixed-window-census W1 · 2차 열차 07f8be554 빨강) */
  const s0 = html.lastIndexOf('<div', html.indexOf('id="anim-gif-modal"'));
  let depth = 0, end = -1;
  for (const m of html.slice(s0).matchAll(/<\/?div\b/g)) { depth += m[0][1] === '/' ? -1 : 1; if (!depth) { end = s0 + m.index; break; } }
  const modal = html.slice(s0, end);
  assert.ok(s0 >= 0 && end > s0 && modal.includes('anim-export-btn') && modal.includes('anim-play-canvas-btn'), '[전제] index.html 에서 GIF 모달 조각(짝 닫는 div 까지)을 찾음');
  const handlers = [...modal.matchAll(/\son\w+="([^"]*)"/g)].map((m) => m[1]);
  const called = new Set(handlers.flatMap((h) => [...h.matchAll(/(?:^|[;\s])([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1])));
  assert.ok(called.has('restartAnimPreview'), `[전제] 슬라이더 인라인이 restartAnimPreview 를 부른다 ${[...called]}`);
  for (const name of called) assert.equal(typeof window[name], 'function', `★인라인이 부르는 ${name} 이 window 에 없다(ReferenceError)`);
  window.openAnimModal(E.tb);
  const before = E.rafs.length;
  E.els['anim-speed'].value = '2';
  window.restartAnimPreview();
  assert.equal(E.rafs.length, before + 1, '미리보기 rAF 다시 걸림');
  assert.match(E.els['anim-loop-info'].textContent, /^한 바퀴 0\.60초/, '속도 2 = 1200ms/2 로 다시 셈');
  window.closeAnimModal();
});

test('E8 RICHTEXT C2 — 블럭 DOM 부분 꾸밈(span 색·굵기·기울임·크기 · <b>) → 미리보기·GIF 저장이 조각마다 제 스타일(V1 fade-in · V2 stamp)', async () => {
  for (const fx of ['fade-in', 'stamp']) {
    const E = await loadEngine();
    const txt = (d) => ({ nodeType: 3, data: d });
    const red = { nodeType: 1, tagName: 'SPAN', childNodes: [txt('빨강')] };
    const bold = { nodeType: 1, tagName: 'B', childNodes: [txt('굵게')] };
    E.textEl.innerHTML = '평글 <span>빨강</span> <b>굵게</b><br>둘째';
    E.textEl.childNodes = [txt('평글 '), red, txt(' '), bold, { nodeType: 1, tagName: 'BR', childNodes: [] }, txt('둘째')];
    const base = { fontSize: '24px', color: 'rgb(17, 17, 17)', fontFamily: 'sans-serif', fontWeight: '400', fontStyle: 'normal', letterSpacing: '0px', textAlign: 'center', lineHeight: '33.6px' };
    globalThis.getComputedStyle = (e) => (e === red ? { ...base, color: 'rgb(255, 0, 0)', fontStyle: 'italic', fontSize: '36px' } : e === bold ? { ...base, fontWeight: '700' } : base);
    const items = [];
    E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
    window.openAnimModal(E.tb);
    items.find((it) => it.dataset.id === fx)._l.click[0]();
    E.rafs.at(-1)(1000); E.ctx.calls.length = 0; E.rafs.at(-1)(1000 + 5000);
    const k = 480 / 400, sz = Math.round(24 * k);
    const want = [['평글 ', 'rgb(17, 17, 17)', `400 ${sz}px sans-serif`], ['빨강', 'rgb(255, 0, 0)', `italic 400 ${sz * 1.5}px sans-serif`], [' ', 'rgb(17, 17, 17)', `400 ${sz}px sans-serif`], ['굵게', 'rgb(17, 17, 17)', `700 ${sz}px sans-serif`], ['둘째', 'rgb(17, 17, 17)', `400 ${sz}px sans-serif`]];
    const got = E.ctx.calls.map((c) => [c.s, c.fill, c.font]);
    assert.deepEqual(got, want, `★${fx} 미리보기 조각 스타일 ${JSON.stringify(got)}`);
    E.ctx.calls.length = 0;
    await window.exportAnimGif();
    const last = E.ctx.calls.slice(-5).map((c) => [c.s, c.fill]);
    assert.deepEqual(last, want.map((w) => [w[0], w[1]]), `★${fx} GIF 저장 조각 스타일 ${JSON.stringify(last)}`);
    window.closeAnimModal();
  }
});

test('E9 RICHTEXT C3 — <u> 파랑 밑줄 · <s> 취소선 · span.tb-hl 형광 · 배경색 span → 미리보기·GIF 저장 장식 색', async () => {
  const E = await loadEngine();
  const txt = (d) => ({ nodeType: 3, data: d });
  const mk = (tag, d) => ({ nodeType: 1, tagName: tag, childNodes: [txt(d)], parentElement: E.textEl, closest: () => null });
  const u = mk('U', '밑줄'), st = mk('S', '취소'), hl = mk('SPAN', '형광'), bg = mk('SPAN', '배경');
  hl.closest = (sel) => (sel === '.tb-hl' ? hl : null);
  E.textEl.contains = (n) => [u, st, hl, bg].includes(n);
  E.textEl.innerHTML = '<u>밑줄</u> <s>취소</s> <span>형광</span> <span>배경</span>';
  E.textEl.childNodes = [u, txt(' '), st, txt(' '), hl, txt(' '), bg];
  const base = { fontSize: '24px', color: 'rgb(17, 17, 17)', fontFamily: 'sans-serif', fontWeight: '400', fontStyle: 'normal', letterSpacing: '0px', textAlign: 'center', lineHeight: '33.6px', textDecorationLine: 'none', backgroundColor: 'rgba(0, 0, 0, 0)' };
  const vars = { '--tb-hl-color': 'rgba(255, 230, 0, 0.6)', '--tb-hl-h': '40%', '--tb-hl-y': '0px' };
  globalThis.getComputedStyle = (e) => (e === u ? { ...base, textDecorationLine: 'underline', textDecorationColor: 'rgb(0, 0, 255)' }
    : e === st ? { ...base, textDecorationLine: 'line-through', textDecorationColor: 'rgb(17, 17, 17)' }
    : e === hl ? { ...base, getPropertyValue: (k) => vars[k] || '' }
    : e === bg ? { ...base, backgroundColor: 'rgb(0, 255, 0)' } : base);
  const items = [];
  E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
  window.openAnimModal(E.tb);
  items.find((it) => it.dataset.id === 'fade-in')._l.click[0]();
  E.rafs.at(-1)(1000); E.ctx.rects.length = 0; E.rafs.at(-1)(1000 + 5000);
  const want = ['rgb(0, 0, 255)', 'rgb(17, 17, 17)', 'rgba(255, 230, 0, 0.6)', 'rgb(0, 255, 0)'];
  const deco = () => E.ctx.rects.filter((r) => !(r.x === 0 && r.y === 0));   // 프레임 바탕(캔버스 전체) 빼고
  assert.deepEqual(deco().map((r) => r.fill), want, `★미리보기 장식 ${JSON.stringify(E.ctx.rects)}`);
  E.ctx.rects.length = 0;
  await window.exportAnimGif();
  assert.deepEqual(deco().slice(-4).map((r) => r.fill), want, '★GIF 저장 장식');
  window.closeAnimModal();
});

test('E10 RICHTEXT C4 — 범위 글로우 span → 그 조각만 그림자 3층 · 블럭 전체 text-shadow → 모든 조각 · 배율(미리보기 29/24 · 저장 2)', async () => {
  const GLOW = 'rgb(255, 0, 255) 0px 0px 5.88px, rgb(255, 0, 255) 0px 0px 14px, rgb(255, 0, 255) 0px 0px 28px';
  for (const blockShadow of ['none', 'rgb(0, 200, 0) 2px 3px 8px']) {
    const E = await loadEngine();
    const txt = (d) => ({ nodeType: 3, data: d });
    const glow = { nodeType: 1, tagName: 'SPAN', childNodes: [txt('글로우')], parentElement: E.textEl, closest: () => null };
    E.textEl.innerHTML = '평글 <span>글로우</span>';
    E.textEl.childNodes = [txt('평글 '), glow];
    const base = { fontSize: '24px', color: 'rgb(17, 17, 17)', fontFamily: 'sans-serif', fontWeight: '400', fontStyle: 'normal', letterSpacing: '0px', textAlign: 'center', lineHeight: '33.6px', textDecorationLine: 'none', backgroundColor: 'rgba(0, 0, 0, 0)', textShadow: blockShadow };
    globalThis.getComputedStyle = (e) => (e === glow ? { ...base, textShadow: GLOW } : base);
    const items = [];
    E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
    window.openAnimModal(E.tb);
    items.find((it) => it.dataset.id === 'fade-in')._l.click[0]();
    E.rafs.at(-1)(1000); E.ctx.calls.length = 0; E.rafs.at(-1)(1000 + 5000);
    const layers = (calls, s) => calls.filter((c) => c.s === s && c.sox).map((c) => [c.sc, +(c.sb).toFixed(3), +(c.sox - 10000).toFixed(3), +(c.soy).toFixed(3)]);
    const k = Math.round(24 * 480 / 400) / 24, r3 = (v) => +v.toFixed(3);   // 배율 = 그리는 글자 크기 / 블럭 글자 크기(29/24)
    assert.deepEqual(layers(E.ctx.calls, '글로우'), [28, 14, 5.88].map((b) => ['rgb(255, 0, 255)', r3(b * k), 0, 0]), `★범위 글로우 층(${blockShadow}) ${JSON.stringify(E.ctx.calls)}`);
    assert.deepEqual(layers(E.ctx.calls, '평글 '), blockShadow === 'none' ? [] : [['rgb(0, 200, 0)', r3(8 * k), r3(2 * k), r3(3 * k)]], `★블럭 그림자(${blockShadow})`);
    E.ctx.calls.length = 0;
    await window.exportAnimGif();
    const tail = E.ctx.calls.slice(-12);
    assert.deepEqual(layers(tail, '글로우').at(-1), ['rgb(255, 0, 255)', 11.76, 0, 0], '★GIF 저장 = 배율 2');
    window.closeAnimModal();
  }
});

test('E11 RICHTEXT C5 — 글자마다 span.tb-dot → 그 글자마다 점(계산된 ::before 크기·색) · 다른 글자 점 0 · 미리보기·GIF 저장', async () => {
  const E = await loadEngine();
  const txt = (d) => ({ nodeType: 3, data: d });
  const mk = (d) => { const n = { nodeType: 1, tagName: 'SPAN', childNodes: [txt(d)], parentElement: E.textEl }; n.closest = (sel) => (sel === '.tb-dot' ? n : null); return n; };
  const d1 = mk('방'), d2 = mk('점');
  E.textEl.contains = (n) => n === d1 || n === d2;
  E.textEl.innerHTML = '<span>방</span><span>점</span> 평글';
  E.textEl.childNodes = [d1, d2, txt(' 평글')];
  const base = { fontSize: '24px', color: 'rgb(17, 17, 17)', fontFamily: 'sans-serif', fontWeight: '400', fontStyle: 'normal', letterSpacing: '0px', textAlign: 'center', lineHeight: '33.6px', textDecorationLine: 'none', backgroundColor: 'rgba(0, 0, 0, 0)', textShadow: 'none' };
  const before = { width: '4px', backgroundColor: 'rgb(255, 0, 0)', transform: 'matrix(1, 0, 0, 1, -2, 0)', content: '""' };
  globalThis.getComputedStyle = (e, pseudo) => (pseudo === '::before' && (e === d1 || e === d2) ? before : base);
  const items = [];
  E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
  window.openAnimModal(E.tb);
  items.find((it) => it.dataset.id === 'fade-in')._l.click[0]();
  E.rafs.at(-1)(1000); E.ctx.arcs.length = 0; E.rafs.at(-1)(1000 + 5000);
  const k = Math.round(24 * 480 / 400) / 24;
  assert.deepEqual(E.ctx.arcs.map((a) => [a.fill, +a.r.toFixed(6)]), [['rgb(255, 0, 0)', +(2 * k).toFixed(6)], ['rgb(255, 0, 0)', +(2 * k).toFixed(6)]], `★미리보기 점 ${JSON.stringify(E.ctx.arcs)}`);
  const xs = E.ctx.arcs.map((a) => a.x), t = E.ctx.calls.filter((c) => c.s === '방' || c.s === '점');
  assert.ok(xs[0] < xs[1] && Math.abs(xs[0] - (t.find((c) => c.s === '방').x + 12)) < 30, '점 = 제 글자 위');
  E.ctx.arcs.length = 0;
  await window.exportAnimGif();
  assert.deepEqual(E.ctx.arcs.slice(-2).map((a) => a.r), [4, 4], '★GIF 저장 점(배율 2)');
  window.closeAnimModal();
});

test('E12 RICHTEXT C6 — 효과 전부(V1 7 · V2 3 · 줄마다 따로 슬롯) 끝 프레임: 빨강 조각 · 방점(안 잘림) · 글로우 층', async () => {
  const E = await loadEngine();
  const txt = (d) => ({ nodeType: 3, data: d });
  const mk = (d) => ({ nodeType: 1, tagName: 'SPAN', childNodes: [txt(d)], parentElement: E.textEl, closest: () => null });
  const g = mk('할'), d = mk('5'), r = mk('원');
  d.closest = (sel) => (sel === '.tb-dot' ? d : null);
  E.textEl.contains = (n) => n === d;
  E.textEl.innerHTML = '<span>할</span>인 12,34<span>5</span><span>원</span>';
  E.textEl.childNodes = [g, txt('인 12,34'), d, r];
  const base = { fontSize: '24px', color: 'rgb(17, 17, 17)', fontFamily: 'sans-serif', fontWeight: '400', fontStyle: 'normal', letterSpacing: '0px', textAlign: 'center', lineHeight: '33.6px', textDecorationLine: 'none', backgroundColor: 'rgba(0, 0, 0, 0)', textShadow: 'none' };
  const before = { width: '4px', backgroundColor: 'rgb(0, 0, 255)', transform: 'matrix(1, 0, 0, 1, -2, 0)', content: '""' };
  globalThis.getComputedStyle = (e, pseudo) => (pseudo === '::before' ? (e === d ? before : base)
    : e === g ? { ...base, textShadow: 'rgb(255, 0, 255) 0px 0px 6px' } : e === r ? { ...base, color: 'rgb(255, 0, 0)' } : base);
  globalThis.pushHistory = () => {};
  for (const id of ['slide-up', 'typewriter', 'slot-machine', 'fade-in', 'word-pop', 'glow-pulse', 'count-up', 'stamp', 'blur-in', 'blur-whip', '줄마다:slot-machine']) {
    const items = [];
    E.els['anim-list'].querySelectorAll = ((orig) => () => { const x = orig(); items.push(...x); return x; })(E.els['anim-list'].querySelectorAll);
    if (id.startsWith('줄마다')) E.tb.dataset.animGif = JSON.stringify({ v: 2, tracks: [{ line: 0, fx: 'slot-machine', at: 0, dur: 900 }], speed: 1, repeat: 1 });
    else delete E.tb.dataset.animGif;
    window.openAnimModal(E.tb);
    if (!id.startsWith('줄마다')) items.find((it) => it.dataset.id === id)._l.click[0]();
    E.rafs.at(-1)(1000); E.ctx.calls.length = 0; E.ctx.arcs.length = 0; E.rafs.at(-1)(1000 + 5000);
    const t = E.ctx.calls;
    assert.ok(t.some((c) => c.s === '원' && c.fill === 'rgb(255, 0, 0)'), `★${id} 빨강 조각 ${JSON.stringify(t.map((c) => [c.s, c.fill]))}`);
    assert.ok(E.ctx.arcs.length === 1 && !E.ctx.arcs[0].clip, `★${id} 방점(안 잘림) ${JSON.stringify(E.ctx.arcs)}`);
    assert.ok(t.some((c) => c.s === '할' && c.sox), `★${id} 글로우 층`);
    window.closeAnimModal();
  }
});

test('E13 RICHTEXT ⑫ — 글자 그라데이션 블럭 → 미리보기·GIF 저장 글 채움 = 캔버스 그라데이션 · 부분 단색 span 은 단색', async () => {
  const E = await loadEngine();
  const dir = mkTmpRoot('anim-gif-grad-smoke-');
  fs.writeFileSync(path.join(dir, 'gradient-model.mjs'), read('js/props/gradient-model.js'));
  await import(pathToFileURL(path.join(dir, 'gradient-model.mjs')).href);   // window.GradientModel 을 세운다(window = globalThis)
  assert.equal(typeof window.GradientModel?.parseGradient, 'function', '[전제] window.GradientModel');
  const made = [];
  E.ctx.createLinearGradient = (x0, y0, x1, y1) => { const g = { x0, y0, x1, y1, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; made.push(g); return g; };
  E.ctx.createRadialGradient = () => { throw new Error('radial 아님'); };
  const txt = (d) => ({ nodeType: 3, data: d });
  const solid = { nodeType: 1, tagName: 'SPAN', childNodes: [txt('단색')], parentElement: E.textEl, closest: () => null };
  E.textEl.innerHTML = '그라 <span>단색</span>';
  E.textEl.childNodes = [txt('그라 '), solid];
  const base = { fontSize: '24px', color: 'rgb(255, 0, 0)', fontFamily: 'sans-serif', fontWeight: '400', fontStyle: 'normal', letterSpacing: '0px', textAlign: 'center', lineHeight: '33.6px',
    textDecorationLine: 'none', backgroundColor: 'rgba(0, 0, 0, 0)', textShadow: 'none', webkitTextFillColor: 'rgba(0, 0, 0, 0)',
    backgroundClip: 'text', webkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)' };
  globalThis.getComputedStyle = (e) => (e === solid ? { ...base, color: 'rgb(0, 200, 0)', webkitTextFillColor: 'rgb(0, 200, 0)' } : base);
  try {
    const items = [];
    E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
    window.openAnimModal(E.tb);
    items.find((it) => it.dataset.id === 'fade-in')._l.click[0]();
    E.rafs.at(-1)(1000); E.ctx.calls.length = 0; made.length = 0; E.rafs.at(-1)(1000 + 5000);
    assert.ok(made.length >= 1, '★캔버스 그라데이션을 안 만들었다');
    const g = made.at(-1);
    assert.deepEqual(g.stops, [[0, 'rgb(255, 0, 0)'], [1, 'rgb(0, 0, 255)']]);
    const by = (s) => E.ctx.calls.find((c) => c.s === s);
    assert.ok(by('그라 ') && made.includes(by('그라 ').fill), `★글 채움이 그라데이션이 아니다 ${JSON.stringify(E.ctx.calls.map((c) => [c.s, typeof c.fill]))}`);
    assert.equal(by('단색').fill, 'rgb(0, 200, 0)', '부분 단색 span 은 단색');
    assert.ok(g.x0 < g.x1 && Math.abs(g.y0 - g.y1) < 1e-6, '90deg = 왼→오른 가로선');
    E.ctx.calls.length = 0; made.length = 0;
    await window.exportAnimGif();
    assert.ok(made.length >= 1 && made.includes(E.ctx.calls.filter((c) => c.s === '그라 ').at(-1).fill), '★GIF 저장 글 채움 = 그라데이션');
    window.closeAnimModal();
  } finally { delete globalThis.GradientModel; delete globalThis.getGradientTarget; }
});

test('E14 PLAY-ON-CANVAS — 덮개는 body 에 · 블럭×2 · 블럭 자리 · 같은 엔진 그림 · 키 = 멈춤 · 블럭 사라지면 멈춤 · 글 DOM 무변', async () => {
  const E = await loadEngine();
  const appended = [], listeners = {};
  document.body.appendChild = (n) => { appended.push(n); n.isInBody = true; return n; };
  globalThis.addEventListener = (t, f) => { (listeners[t] ??= new Set()).add(f); };   // window = globalThis — 멈춤 리스너는 window capture
  globalThis.removeEventListener = (t, f) => { listeners[t]?.delete(f); };
  E.tb.appendChild = () => { throw new Error('★덮개를 블럭 안에 넣었다(글 DOM 변경)'); };
  E.tb.isConnected = true;
  E.tb.getBoundingClientRect = () => ({ left: 30, top: 70, width: 200, height: 60 });
  const html0 = E.textEl.innerHTML;
  const items = [];
  E.els['anim-list'].querySelectorAll = ((orig) => () => { const r = orig(); items.push(...r); return r; })(E.els['anim-list'].querySelectorAll);
  window.openAnimModal(E.tb);
  items.find((it) => it.dataset.id === 'fade-in')._l.click[0]();
  window.playAnimOnCanvas();
  assert.equal(E.els['anim-gif-modal'].style.display, 'none', '모달 닫힘');
  const cv = appended.find((n) => n.id === 'anim-canvas-play');
  assert.ok(cv && cv.isInBody, '★덮개가 body 에 없다');
  assert.deepEqual([cv.width, cv.height], [800, 240], '덮개 = 블럭(400×120) × 2');
  let removed = 0; cv.remove = () => { removed++; };
  E.ctx.calls.length = 0;
  E.rafs.at(-1)(1000); E.rafs.at(-1)(1000 + 5000);
  assert.deepEqual([cv.style.left, cv.style.top, cv.style.width, cv.style.height], ['30px', '70px', '200px', '60px'], '블럭 자리·크기');
  assert.deepEqual(E.ctx.calls.slice(-2).map((c) => c.s), ['오늘 주문하면?', '네!'], '같은 엔진 그림(두 줄)');
  assert.equal(E.textEl.innerHTML, html0, '글 DOM 무변');
  assert.ok(listeners.keydown?.size === 1 && listeners.pointerdown?.size === 1, '[전제] 멈춤 리스너');
  const nRaf = E.rafs.length;
  const ev = (type) => { const e = { type, key: 'Escape', blocked: 0 }; e.preventDefault = () => { e.blocked++; }; e.stopImmediatePropagation = () => { e.blocked++; }; return e; };
  const esc = ev('keydown');
  [...listeners.keydown][0](esc);
  assert.equal(removed, 1, '★키로 안 멈춘다(덮개 남음)');
  assert.equal(esc.blocked, 2, '★멈춘 Esc 가 에디터로 넘어간다(선택 해제 등)');
  assert.ok(!listeners.keydown.size && !listeners.pointerdown.size, '리스너 해제');
  E.rafs.at(-1)(9000);
  assert.equal(E.rafs.length, nRaf, '멈춘 뒤 rAF 0');
  // 블럭이 사라지면 스스로 멈춘다
  window.openAnimModal(E.tb);
  window.playAnimOnCanvas();
  const cv2 = appended.filter((n) => n.id === 'anim-canvas-play').at(-1);
  let removed2 = 0; cv2.remove = () => { removed2++; };
  E.tb.isConnected = false;
  E.rafs.at(-1)(1000);
  assert.equal(removed2, 1, '블럭이 사라지면 덮개도');
  // 클릭으로 멈춤 — 그 클릭의 mousedown/mouseup/click 은 에디터로 안 간다(한 번)
  E.tb.isConnected = true;
  window.openAnimModal(E.tb);
  window.playAnimOnCanvas();
  appended.filter((n) => n.id === 'anim-canvas-play').at(-1).remove = () => {};
  const pd = ev('pointerdown');
  [...listeners.pointerdown][0](pd);
  assert.equal(pd.blocked, 2, '★멈춘 클릭이 에디터로 넘어간다');
  for (const t of ['mousedown', 'mouseup']) { const e = ev(t); [...listeners[t]][0](e); assert.equal(e.blocked, 2, `★${t} 를 안 삼켰다`); }
  const ck = ev('click'); [...listeners.click][0](ck);
  assert.ok(ck.blocked === 2 && !listeners.click.size && !listeners.mousedown.size, '클릭까지 삼키고 풀림');
  delete globalThis.addEventListener; delete globalThis.removeEventListener;
});
