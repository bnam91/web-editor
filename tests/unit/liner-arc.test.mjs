/* liner-arc — LINETEXT-ARC-RESEARCH-01(현빈 261121 발주2 #4) 라이너 빈 곳: 반지름 px(반원 넘는 호) · 원 안쪽 뒤집기 · 외곽선 — 경로 셈·저장 꼴.
 * A1 buildRadiusPathD — 위/아래 · 바로/뒤집기 4꼴의 시작점·sweep(원 두 반호 · 50% = 글 가운데)
 * A2 기존 buildLinerPathD 무변(옛 4 프리셋 꼴 그대로)
 * A3 저장 꼴 — 새 칸은 기본값이면 dataset.liner 에 «안 씀»(옛 저장본 바이트 무변) · 쓸 때만 radius/flip/stroke*
 * (DOM 의 실제 렌더·잘림·패널은 tests/dom/liner-arc.dom.spec.js)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = readSrc(ROOT, 'js', 'liner-transform.js');
/* 고전 스크립트 — 최상위가 document·MutationObserver 를 만진다 ⇒ 대역 창에 싣고 window 다리로 꺼낸다 */
const ctx = { window: {}, document: { readyState: 'complete', querySelectorAll: () => [], body: {} }, MutationObserver: class { observe() {} }, console };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(SRC, ctx);
const W = ctx.window;

test('A1 buildRadiusPathD 4꼴', () => {
  assert.equal(W.buildRadiusPathD(100, 80, 50, false, false), 'M 100,130 A 50,50 0 1 1 100,30 A 50,50 0 1 1 100,130', '위·바로 = 6시 시작 시계(옛 circle 과 같은 길)');
  assert.equal(W.buildRadiusPathD(100, 80, 50, false, true), 'M 100,130 A 50,50 0 1 0 100,30 A 50,50 0 1 0 100,130', '위·뒤집기 = 반시계');
  assert.equal(W.buildRadiusPathD(100, 80, 50, true, false), 'M 100,30 A 50,50 0 1 0 100,130 A 50,50 0 1 0 100,30', '아래·바로 = 12시 시작 반시계(6시 = 50%)');
  assert.equal(W.buildRadiusPathD(100, 80, 50, true, true), 'M 100,30 A 50,50 0 1 1 100,130 A 50,50 0 1 1 100,30', '아래·뒤집기 = 시계');
});

test('A2 옛 buildLinerPathD 무변', () => {
  assert.equal(W.buildLinerPathD('arc-up', 0, 400, 80, 12, 40, 0), 'M 12,40 L 388,40');
  assert.equal(W.buildLinerPathD('arc-up', 100, 400, 80, 12, 200, 188), 'M 12,200 A 188,188 0 0 1 388,200');
  assert.equal(W.buildLinerPathD('arc-down', 100, 400, 80, 12, 40, 188), 'M 12,40 A 188,188 0 0 0 388,40');
  assert.equal(W.buildLinerPathD('circle', 50, 400, 400, 12, 200, 100), 'M 200,300 A 100,100 0 1 1 200,100 A 100,100 0 1 1 200,300');
});

test('A3 저장 꼴 — 기본값은 안 씀', () => {
  assert.deepEqual(Object.keys(W.LINER_DEFAULTS).sort(), ['curvature', 'flip', 'letterSpacing', 'preset', 'radius', 'startAngle', 'strokeColor', 'strokeWidth']);
  assert.match(SRC, /const out = \{ preset: cfg\.preset, curvature: cfg\.curvature, letterSpacing: cfg\.letterSpacing, startAngle: cfg\.startAngle \};\n\s*if \(cfg\.radius\) out\.radius = cfg\.radius;[^\n]*\n\s*if \(cfg\.flip\) out\.flip = true;\n\s*if \(cfg\.strokeWidth && cfg\.strokeColor\) \{ out\.strokeColor = cfg\.strokeColor; out\.strokeWidth = cfg\.strokeWidth; \}\n\s*block\.dataset\.liner = JSON\.stringify\(out\);/);
});
