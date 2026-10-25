/* graph-person-preset-1012t1g2 — 「사람」 내장 실루엣을 화장실 픽토그램 꼴에서 부드러운 실루엣으로 (1012t1G2 · 2026-10-25)
 * 현빈: 「프리셋에 들어가있는 사람은 무슨 화장실픽토그램이니? 너무 짜쳐보이니, 사람은 없애거나 다른 이쁜 걸로 바꿔줘」 → 바꾼다.
 *   값 키 person · 라벨 「사람」 · viewBox 76×240 은 그대로(옛 저장 파일 · 상자 비가 안 깨진다) — 모양(path)만 바꾼다.
 * 잉크·여백·외부 참조 검사는 graph-shape-math U6 이 이미 잰다 — 여기는 «옛 꼴이 아니다»만 잰다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GRAPH_SHAPE_PRESETS, shapeSvgOf, shapeAspect } = require('../../js/graph-shape.js');

const OLD_BODY = 'M16 52H60Q76 52 76 68V132Q76 140 68 140Q60 140 60 132V84H56V232Q56 240 48 240Q40 240 40 232V150H36V232Q36 240 28 240Q20 240 20 232V84H16V132Q16 140 8 140Q0 140 0 132V68Q0 52 16 52Z';

test('P1 키·라벨·비 유지 — person / 「사람」 / viewBox 76×240', () => {
  const p = GRAPH_SHAPE_PRESETS.person;
  assert.ok(p, '전제: person 키가 남아 있다(옛 저장 파일의 barShape="person")');
  assert.equal(p.label, '사람');
  assert.equal(shapeSvgOf('person'), p.svg);
  assert.deepEqual(shapeAspect(p.svg), { w: 76, h: 240, ratio: 76 / 240 });
});

test('P2 옛 픽토그램 path 가 아니다 — 직각 팔·곧은 다리 꼴 0 · 몸통은 곡선(C)', () => {
  const svg = GRAPH_SHAPE_PRESETS.person.svg;
  const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
  assert.ok(ds.length >= 1, '전제: path 가 있다');
  assert.ok(!svg.includes(OLD_BODY), '옛 화장실 픽토그램 path 가 그대로다');
  assert.ok(!/V84H56|V84H16/.test(svg), '팔과 몸통 사이 직각 홈(V84H56 · V84H16) 0');
  assert.ok(ds.some(d => /C/.test(d)), '몸통 윤곽에 3차 곡선(C)이 있다(부드러운 어깨·옆선)');
  assert.ok(/<circle cx="38" cy="\d+" r="\d+"\/>/.test(svg), '둥근 머리(원)');
});
