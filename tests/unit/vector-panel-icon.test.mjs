/* vector-panel-icon.test.mjs — VECTOR-PANEL-ICON-BROKEN-01(현빈 261119 · 0.9.13 148행)
 * 증상: 벡터 블럭 우측 패널 머리 아이콘이 깨져 보임. 렌더 확인(태양 261119): 12 칸 그림을 16px 로 키우는데
 *   오각형 + 안쪽 선 셋(가로 1 · 꼭대기에서 내려오는 빗선 2)이라 빗선이 윗변에 붙어 꼭대기가 덩어리로 뭉갰다.
 * 고침: 머리 아이콘 = 레이어 행 vector 아이콘과 «같은 오각형 하나»(다른 블럭 머리처럼 선 #888 · 1.3 · viewBox 12).
 * 자 = 두 파일의 원문(정규식) — 패널 머리 svg 의 도형 목록이 레이어 행 svg 의 도형 목록과 같은가 + 안쪽 선(line) 0.
 * 양성대조 = 옛 마크업(line 셋)으로 되돌리면 빨강(_patches/visual5-148-CTL-gem.patch).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const shapes = (svg) => [...svg.matchAll(/<(path|polygon|polyline|line|rect|circle|ellipse)\b([^>]*)\/?>/g)]
  .map(([, tag, a]) => `${tag}:${(/(?:points|d)="([^"]+)"/.exec(a) || [])[1] || ''}`);

test('148 벡터 패널 머리 아이콘 = 레이어 행 vector 오각형 하나', () => {
  const pv = read('js/props/prop-vector.js');
  const head = /icon:\s*`([\s\S]*?<\/svg>)/.exec(pv);
  assert.ok(head, '[전제] prop-vector.js 의 머리 icon svg 를 찾았다');
  const lay = /\bvector:\s*`(<svg[\s\S]*?<\/svg>)`/.exec(read('js/panels/layer-panel-items.js'));
  assert.ok(lay, '[전제] layer-panel-items.js 의 vector 아이콘을 찾았다');
  const svgTag = /<svg([^>]*)>/.exec(head[1])[1];
  assert.match(svgTag, /viewBox="0 0 12 12"/, '다른 머리 아이콘과 같은 viewBox 12');
  assert.match(svgTag, /stroke="#888"/);
  assert.match(svgTag, /stroke-width="1\.3"/);
  assert.equal(shapes(head[1]).filter((s) => s.startsWith('line:')).length, 0, '안쪽 선(line) 0 — 16px 에서 뭉갬');
  assert.deepEqual(shapes(head[1]), shapes(lay[1]), '도형 = 레이어 행 vector 아이콘과 같다');
});
