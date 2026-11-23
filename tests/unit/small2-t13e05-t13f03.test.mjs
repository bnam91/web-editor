/* small2-t13e05-t13f03.test.mjs — 0.9.13 t13E-05 · t13F-03 (탑 · 지디 261124 배정 ①)
 *   t13E-05 «이너 그림자» → «Inner shadow»(이름만 — 보이는 라벨·이력 이름 · 상태 키·id·동작 그대로)
 *   t13F-03 에셋 모서리 radius 상한 120 → «블럭 짧은 변의 절반»(그보다 크면 CSS 가 더 둥글게 못 그린다 = 자연 상한)
 *            · 단 120 보다 작아지진 않는다(옛 저장값이 칸 밖으로 안 밀려남) · 패널 슬라이더·숫자칸·캔버스 모서리 손잡이 «한 자» */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('E05-1 원 효과 라벨 = «Inner shadow»(옛 «이너 그림자» 보이는 글 0)', () => {
  const s = rd('js/props/prop-shape.js');
  assert.match(s, /<span class="prop-label[^"]*">Inner shadow<\/span>/, '라벨이 Inner shadow 가 아니다');
  assert.doesNotMatch(s, />이너 그림자</, '보이는 라벨에 옛 이름이 남았다');
  assert.doesNotMatch(s, /pushHistory\?\.\('이너 그림자'\)/, '이력 이름에 옛 이름이 남았다');
  assert.match(s, /id="shape-ellipse-shadow-toggle"/, '[전제] id 그대로');
});

test('F03-1 상한 = 짧은 변 절반 · 바닥 120 — 한 자(asset-width-limits.js)', async () => {
  const m = await import('data:text/javascript,' + encodeURIComponent(rd('js/blocks/asset-width-limits.js')));   // .js = package type 없음 ⇒ 소스를 ESM 으로 싣는다
  assert.equal(typeof m.assetRadiusMax, 'function', 'assetRadiusMax 가 없다');
  assert.equal(m.assetRadiusMax(600, 600), 300, '600×600 = 300');
  assert.equal(m.assetRadiusMax(860, 400), 200, '860×400 = 200(짧은 변 400 의 절반)');
  assert.equal(m.assetRadiusMax(860, 120), 120, '짧은 변 절반 60 < 120 ⇒ 120(바닥)');
  assert.equal(m.assetRadiusMax(0, 0), 120, '크기 모름 ⇒ 120');
});

test('F03-2 쓰는 자리 셋이 그 한 자를 쓴다(⛔120 리터럴 남음 0)', () => {
  const p = rd('js/props/prop-asset.js'), o = rd('js/overlay-handles.js');
  assert.match(p, /assetRadiusMax\(/, '패널이 한 자를 안 쓴다');
  assert.doesNotMatch(p, /id="asset-r-slider"[^>]*max="120"/, '슬라이더 max 120 리터럴');
  assert.doesNotMatch(p, /id="asset-r-number"[^>]*max="120"/, '숫자칸 max 120 리터럴');
  assert.doesNotMatch(p, /Math\.min\(120, Math\.max\(0, parseInt\(rNumber\.value\)/, '숫자칸 clamp 120 리터럴');
  assert.match(o, /assetRadiusMax\(/, '캔버스 모서리 손잡이가 한 자를 안 쓴다');
  assert.doesNotMatch(o, /const newR = Math\.min\(120,/, '손잡이 clamp 120 리터럴');
});
