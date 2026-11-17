/* annot-panel-marker — 어노테이션 패널 «표식»이 머리 마크업(blockHeaderHTML)에 기대지 않는다. (U4 평가자 ⑨)
 *   hideAnnotationProperties 는 propPanel 에서 표식을 찾아 «지금 패널이 어노테이션인가»를 가른다 — 표식이 사라지면 다른 블록을 고른 뒤에도
 *   어노테이션 숨기기가 패널을 안 비우거나, 반대로 헤더 꼴이 바뀌는 순간 조용히 못 찾는다.
 * A1 표식은 renderPanel 의 sections(절 몸통) 안에 있다 · 머리(header:) 안에도, blockHeaderHTML 문자열 치환으로도 붙지 않는다.
 * A2 hide 가 찾는 선택자 == 패널이 내는 표식(같은 이름·값).
 * 양성대조: prop-annotation.js 의 `<span hidden data-prop-panel="annotation">` 줄을 지우면 A1 빨강 · hide 의 선택자 값을 바꾸면 A2 빨강. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = readFileSync(path.join(ROOT, 'js/props/prop-annotation.js'), 'utf8');

const show = SRC.slice(SRC.indexOf('export function showAnnotationProperties'), SRC.indexOf('export function hideAnnotationProperties'));
const hide = SRC.slice(SRC.indexOf('export function hideAnnotationProperties'), SRC.indexOf('window.hideAnnotationProperties'));

test('A1 표식은 절 몸통 안 — 머리·헤더 치환에 기대지 않는다', () => {
  assert.ok(show.length > 1000 && hide.length > 50, '[전제] show/hide 함수를 잘라 냈다');
  const at = show.indexOf('sections: [');
  const header = show.slice(show.indexOf('header:'), at);
  assert.ok(at > 0 && header.length > 0, '[전제] renderPanel 의 header/sections 를 찾았다');
  const m = show.slice(at).match(/data-prop-panel="([^"]+)"/);
  assert.ok(m, '★패널 표식(data-prop-panel)이 절 몸통에 없다');
  assert.equal(/data-prop-panel/.test(header), false, '★표식이 머리(header) 칸에 있다 — 헤더 마크업에 기댄다');
  assert.equal(/blockHeaderHTML\([\s\S]*?\)\s*\.replace\(/.test(show), false, '★blockHeaderHTML 결과를 문자열 치환한다');
});

test('A2 hide 가 찾는 선택자 == 패널이 내는 표식', () => {
  const made = show.slice(show.indexOf('sections: [')).match(/data-prop-panel="([^"]+)"/)?.[1];
  const sought = hide.match(/\[data-prop-panel="([^"]+)"\]/)?.[1];
  assert.ok(made && sought, '[전제] 양쪽에서 값을 읽었다');
  assert.equal(sought, made, '★hide 가 다른 표식을 찾는다 — 어노테이션 패널을 못 알아본다');
});
