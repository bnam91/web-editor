/* anim-gif-engine-smoke.test.mjs — animation-engine.js 를 «실제로 돌린다»(모달 열기 → 효과 고르기 → 미리보기 몇 프레임 → GIF 프레임 수).
 * 렌더 실행 단위다(e32eabd44 교훈) — DOM 스펙은 srv 에서 못 돈다. 엔진의 V2 연결(_plan)은 여기서만 srv 에서 실행된다.
 *   · 엔진·fx 두 파일을 공용 임시 우산(mkTmpRoot)에 .mjs 로 복사(js/ 의 .js 는 node 가 CommonJS 로 읽는다) · file: URL(win-portability ②-4).
 *   · export-image.js 하나만 대역(sectionBgColor) · 모달 DOM 은 엔진이 쓰는 만큼만 가짜.
 * F3 E3: 저장된 줄별 트랙(P076 꼴)으로 모달을 열면 미리보기가 «줄마다» 돈다 · «줄마다 따로» 켜기 = data-anim-gif 를 쓴다(한 번 · 같은 값이면 안 씀).
 * 양성대조(실측은 커밋 메시지): _plan 의 V2 갈래를 지우면(모두 _drawFrame 로) E1(흐림 0 — _drawFrame 엔 stamp 갈래가 없어 아무것도 안 그림) 빨강 ·
 *   _plan duration 을 1200/speed 로 되돌리면 E2(GIF 프레임 수) 빨강.
 * E5(0.9.12 QA GIF-PREVIEW-CLIPPED-01): 72px 한 줄 블럭(716×83)을 캔버스가 두 줄로 접으면 높이가 블럭 비율(480×56)이라 위아래가 잘렸다.
 *   양성대조(예측): fitCanvasH 가 H 를 그대로 돌려주면(return H) E5 빨강(미리보기 56 · 줄 위끝 < 0).
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
    fillText: (s, x, y) => calls.push({ s: String(s), x, y, f: ctx.filter }),
    fillRect() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {},
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
