/* T-054 (2026-09-16, 작업목록매니저 코드감사 발견, 「필수」 플래그) — 페이지 배경 그라데이션이
 * 저장 후 다시 열면 솔리드로 돌아간다.
 *
 * 원인: js/io/save-load.js의 applyPageSettings()/initApp() 둘 다 _bgRgba(state.pageSettings)
 * 만 불렀다 — state.pageSettings.bgGradient(JSON {type,angle,stops}, prop-page.js의
 * goya-cp:gradient 핸들러가 씀)가 파일엔 저장돼도 다시 칠할 때는 한 번도 안 읽혔다.
 *
 * 고침: _bgGradient가 있으면 그걸 window.GradientModel.toCss()로 CSS 문자열로 만들어 우선
 * 쓰는 _bgCss(ps)를 새로 만들어 두 호출부에서 _bgRgba 대신 쓰게 했다.
 *
 * ★이 레포엔 save-load.js 전체를 로드하는 하네스가 없다(의존성이 너무 크다) — _slice-block으로
 * _bgRgba/_bgCss 두 함수만 원문 그대로 떠서 vm에서 돈다(선례: scratchpad-inv-zoom-cap.test.mjs
 * 가 applyZoom을 같은 방식으로 뜬다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { sliceBlock } from './_slice-block.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = readSrc(ROOT, 'js/io/save-load.js');

const BGRGBA_SRC = sliceBlock(SRC, 'function _bgRgba(ps) {', 'T-054: 검사가 옛 소스를 보고 있다(_bgRgba)');
const BGCSS_SRC = sliceBlock(SRC, 'function _bgCss(ps) {', 'T-054: 검사가 옛 소스를 보고 있다(_bgCss) — 회귀: 고침이 되돌려졌다');

/* applyPageSettings/initApp 둘 다 _bgCss를 쓰는지(옛 _bgRgba로 되돌아가지 않았는지) 소스 자체로 못박는다. */
test('T-054-0 ★applyPageSettings·initApp 둘 다 _bgRgba가 아니라 _bgCss를 부른다', () => {
  const applyBlock = sliceBlock(SRC, 'function applyPageSettings() {', 'T-054: applyPageSettings를 못 찾음');
  assert.match(applyBlock, /applyCanvasBackground\(_bgCss\(state\.pageSettings\)\)/,
    'applyPageSettings가 _bgCss를 안 쓴다 — 그라데이션이 다시 솔리드로 돌아가는 회귀');
  const initBlock = sliceBlock(SRC, 'function initApp() {', 'T-054: initApp을 못 찾음');
  assert.match(initBlock, /applyCanvasBackground\(_bgCss\(state\.pageSettings\)\)/,
    'initApp이 _bgCss를 안 쓴다 — 부팅 시 그라데이션이 솔리드로 그려지는 회귀');
});

function makeGradientModel() {
  return {
    toCss(model) {
      if (!model || !Array.isArray(model.stops)) return '';
      const parts = model.stops.map(s => `${s.color} ${Math.round((s.offset || 0) * 100)}%`);
      const type = model.type === 'radial' ? 'radial' : 'linear';
      if (type === 'radial') return `radial-gradient(circle, ${parts.join(', ')})`;
      return `linear-gradient(${Math.round(model.angle ?? 180)}deg, ${parts.join(', ')})`;
    },
  };
}

function runBgCss(ps) {
  const ctx = { window: { GradientModel: makeGradientModel() } };
  vm.createContext(ctx);
  vm.runInContext(`${BGRGBA_SRC}\n${BGCSS_SRC}\n;globalThis.__out = _bgCss(${JSON.stringify(ps)});`, ctx);
  return ctx.__out;
}

test('T-054-1 ★핵심 — bgGradient가 있으면 그라데이션 CSS를 반환한다(솔리드가 아니라)', () => {
  const ps = { bg: '#111111', bgAlpha: 100, bgGradient: JSON.stringify({ type: 'linear', angle: 45, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] }) };
  const out = runBgCss(ps);
  assert.match(out, /^linear-gradient\(45deg, #ff0000 0%, #0000ff 100%\)$/, `그라데이션이 아니라 ${out} 이 나왔다 — T-054 재발`);
});

test('T-054-2 [양성대조] 옛 _bgRgba를 그대로 쓰면 bgGradient가 있어도 솔리드가 나온다(이 버그를 재현)', () => {
  const ps = { bg: '#111111', bgAlpha: 100, bgGradient: JSON.stringify({ type: 'linear', angle: 45, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] }) };
  const ctx = { window: { GradientModel: makeGradientModel() } };
  vm.createContext(ctx);
  vm.runInContext(`${BGRGBA_SRC}\n;globalThis.__out = _bgRgba(${JSON.stringify(ps)});`, ctx);
  assert.match(ctx.__out, /^rgba\(/, '양성대조가 그라데이션을 냈다 — 이 픽스처가 T-054를 못 본다는 뜻');
});

test('T-054-3 bgGradient가 없으면(솔리드 페이지) 기존과 완전히 동일한 rgba를 낸다 — 회귀 없음', () => {
  const ps = { bg: '#777777', bgAlpha: 80 };
  const out = runBgCss(ps);
  assert.equal(out, 'rgba(119,119,119,0.8)', `솔리드 경로가 바뀌었다: ${out}`);
});

test('T-054-4 bgGradient가 깨진 JSON이면 조용히 솔리드로 폴백한다(화면이 죽지 않는다)', () => {
  const ps = { bg: '#222222', bgAlpha: 100, bgGradient: '{not valid json' };
  assert.doesNotThrow(() => runBgCss(ps));
  const out = runBgCss(ps);
  assert.match(out, /^rgba\(/, `깨진 JSON인데 폴백 안 함: ${out}`);
});

/* ── prop-page.js: 재오픈 씨앗(dataset.cpGradient) — seedPageBgGradientPicker() ──
 * ★2026-09-16 실측 레이스 — wireCanvasBgControl()(부팅 시 «딱 한 번»만 불림) 안에서만
 *   씨앗을 채웠더니, 라이브 admin 인스턴스에서 실제로 재현됐다: 그 호출 시점엔
 *   state.pageSettings 가 아직 저장된 프로젝트에서 안 채워져 있어(로드 레이스) 씨앗이
 *   비어버렸다 — 캔버스는 (뒤에 다시 불리는) applyPageSettings()가 제대로 칠했는데도
 *   피커 재오픈 씨앗만 비어 있는 상태가 실제로 떴다(수동 재현 확인).
 *   ⇒ 시드 로직을 seedPageBgGradientPicker()로 떼어 applyPageSettings()가 «매번» 부르게
 *   했다 — 캔버스를 다시 칠하는 모든 경로(switchPage 등, 실제 프로젝트 로드 시점 포함)가
 *   이 함수도 같이 새로고침하므로 레이스가 사라진다. */
const PAGE_SRC = readSrc(ROOT, 'js/props/prop-page.js');
// vm.runInContext는 plain script라 ESM export 문법을 못 받는다 — 잘라낸 뒤 export만 벗긴다.
const SEED_SRC = sliceBlock(PAGE_SRC, 'export function seedPageBgGradientPicker() {', 'T-054: seedPageBgGradientPicker를 못 찾음')
  .replace(/^export\s+/, '');

test('T-054-6 ★applyPageSettings가 매 호출마다 seedPageBgGradientPicker를 부른다(부팅 1회 한정 아님)', () => {
  const applyBlock = sliceBlock(SRC, 'function applyPageSettings() {', 'T-054: applyPageSettings를 못 찾음(재확인)');
  assert.match(applyBlock, /window\.seedPageBgGradientPicker\?\.\(\)/,
    'applyPageSettings가 seedPageBgGradientPicker를 안 부른다 — 부팅 레이스로 씨앗이 비는 회귀 재발');
});

function seedRun({ bgGradient, hasElements = true, hasGM = true } = {}) {
  const bgPicker = { dataset: {}, closest: () => hasElements ? bgSwatch : null };
  const bgSwatch = { style: {} };
  const doc = { getElementById: (id) => (id === 'page-bg-color' && hasElements) ? bgPicker : null };
  const ctx = {
    document: doc,
    state: { pageSettings: { bgGradient } },
    window: hasGM ? { GradientModel: { toCss: (m) => m && Array.isArray(m.stops) ? `linear-gradient(${m.angle}deg, ${m.stops.map(s => s.color + ' ' + Math.round(s.offset * 100) + '%').join(', ')})` : '' } } : {},
  };
  vm.createContext(ctx);
  vm.runInContext(`${SEED_SRC}\n;globalThis.__run = seedPageBgGradientPicker;`, ctx);
  ctx.__run();
  return { cpGradient: bgPicker.dataset.cpGradient, swatchBg: bgSwatch.style.background };
}

test('T-054-7 ★핵심 — bgGradient가 있으면 dataset.cpGradient와 스와치를 둘 다 채운다', () => {
  const grad = JSON.stringify({ type: 'linear', angle: 45, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] });
  const out = seedRun({ bgGradient: grad });
  assert.equal(out.cpGradient, grad, '재오픈 씨앗이 안 채워졌다');
  assert.match(out.swatchBg, /^linear-gradient/, `스와치가 그라데이션이 아니다: ${out.swatchBg}`);
});

test('T-054-8 bgGradient가 없으면(솔리드) 남아있던 옛 씨앗을 지운다', () => {
  const bgPicker = { dataset: { cpGradient: '{"stale":true}' }, closest: () => ({ style: {} }) };
  const ctx = {
    document: { getElementById: () => bgPicker },
    state: { pageSettings: {} },   // bgGradient 없음
    window: { GradientModel: { toCss: () => '' } },
  };
  vm.createContext(ctx);
  vm.runInContext(`${SEED_SRC}\n;globalThis.__run = seedPageBgGradientPicker;`, ctx);
  ctx.__run();
  assert.equal(bgPicker.dataset.cpGradient, undefined, '솔리드로 복귀했는데 옛 그라데이션 씨앗이 남아있다');
});

test('T-054-9 DOM/스와치가 아직 없으면(초초기 부팅) 조용히 빠져나간다(죽지 않는다)', () => {
  assert.doesNotThrow(() => seedRun({ bgGradient: '{}', hasElements: false }));
});

test('T-054-10 [양성대조] 함수 본문 자체를 비우면 T-054-7이 실패한다(이 검사가 실제로 그 코드를 본다는 증거)', () => {
  const empty = 'function seedPageBgGradientPicker() {}';
  const grad = JSON.stringify({ type: 'linear', angle: 45, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] });
  const bgPicker = { dataset: {}, closest: () => ({ style: {} }) };
  const ctx = {
    document: { getElementById: () => bgPicker },
    state: { pageSettings: { bgGradient: grad } },
    window: { GradientModel: { toCss: () => 'linear-gradient(45deg, #ff0000 0%, #0000ff 100%)' } },
  };
  vm.createContext(ctx);
  vm.runInContext(`${empty}\n;globalThis.__run = seedPageBgGradientPicker;`, ctx);
  ctx.__run();
  assert.equal(bgPicker.dataset.cpGradient, undefined, '양성대조가 안 먹었다 — 빈 함수인데 씨앗이 채워졌다');
});

test('T-054-5 window.GradientModel이 아직 안 실려 toCss가 없으면(로드 순서 사고) 솔리드로 폴백한다', () => {
  const ps = { bg: '#333333', bgAlpha: 100, bgGradient: JSON.stringify({ type: 'linear', angle: 0, stops: [{ color: '#fff', offset: 0 }, { color: '#000', offset: 1 }] }) };
  const ctx = { window: {} };   // GradientModel 없음
  vm.createContext(ctx);
  vm.runInContext(`${BGRGBA_SRC}\n${BGCSS_SRC}\n;globalThis.__out = _bgCss(${JSON.stringify(ps)});`, ctx);
  assert.match(ctx.__out, /^rgba\(/, `GradientModel 없는데도 안 죽고 폴백 안 함: ${ctx.__out}`);
});
