/* label-auto-color.test.mjs — 0920r5 polish2 (T-059)
 * 「라벨(Tag)이 넣은 글자색만 걷어낸다」 규칙의 핵심 로직.
 * DOM 없이 도는 순수 모듈이라 여기서 값 규칙을, 실제 클릭 흐름은 tests/dom/label-inline-color.dom.spec.js 에서 잰다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// package.json "type":"commonjs" 라 .js 를 직접 import 하면 CJS 로 잡힌다 → 원문을 임시 .mjs 로 복사해 로드
//   (선례: tests/unit/text-shadow-filter.test.mjs).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lac-'));
const MOD = path.join(TMP, 'label-auto-color.mjs');
fs.writeFileSync(MOD, fs.readFileSync(path.join(REPO, 'js/props/label-auto-color.js'), 'utf8'));
const { markLabelAutoColor, forgetLabelAutoColor, dropLabelAutoColor } = await import(pathToFileURL(MOD).href);
fs.rmSync(TMP, { recursive: true, force: true });
// 브라우저처럼 «정규화된» 값이 style.color 에 남는 상황을 그대로 쓴다(문자열 비교가 규칙의 전부).
const el = (color = '') => ({ style: { color }, dataset: {} });

test('U1 라벨이 넣은 색 그대로면 걷어낸다 — 인라인 color 가 비고 표식도 사라진다', () => {
  const e = el();
  e.style.color = 'rgb(255, 255, 255)';
  markLabelAutoColor(e);
  assert.equal(e.dataset.labelAutoColor, 'rgb(255, 255, 255)');
  assert.equal(dropLabelAutoColor(e), true);
  assert.equal(e.style.color, '');
  assert.equal(e.dataset.labelAutoColor, undefined);
});

test('U2 표식 뒤에 색이 바뀌었으면(사용자 선택) 보존한다', () => {
  const e = el();
  e.style.color = 'rgb(255, 255, 255)';
  markLabelAutoColor(e);
  e.style.color = 'rgb(17, 34, 51)';            // 사용자가 피커로 고름
  assert.equal(dropLabelAutoColor(e), false);
  assert.equal(e.style.color, 'rgb(17, 34, 51)');
  assert.equal(e.dataset.labelAutoColor, undefined, '표식은 어쨌든 폐기');
});

test('U3 표식이 없으면(옛 저장본·사용자 색) 절대 안 건드린다', () => {
  const e = el('rgb(255, 255, 255)');
  assert.equal(dropLabelAutoColor(e), false);
  assert.equal(e.style.color, 'rgb(255, 255, 255)');
});

test('U4 forget 은 표식만 폐기하고 색은 그대로 — 같은 색을 직접 골라도 보존된다', () => {
  const e = el();
  e.style.color = 'rgb(255, 255, 255)';
  markLabelAutoColor(e);
  forgetLabelAutoColor(e);                       // 사용자가 «흰색»을 직접 고른 경우
  assert.equal(dropLabelAutoColor(e), false);
  assert.equal(e.style.color, 'rgb(255, 255, 255)');
});

test('U5 색이 비어 있으면 표식을 달지 않는다(걷어낼 것이 없다)', () => {
  const e = el();
  markLabelAutoColor(e);
  assert.equal(e.dataset.labelAutoColor, undefined);
  assert.equal(dropLabelAutoColor(e), false);
});

test('U6 ★소스 가드: 라벨 전환은 표식을 달고, 라벨을 벗어나는 분기는 걷어내기를 부른다', () => {
  const src = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-type.js'), 'utf8');
  assert.match(src, /markLabelAutoColor\(contentEl\)/, '라벨 전환에서 표식을 안 단다');
  assert.match(src, /dropLabelAutoColor\(contentEl\)/, '라벨을 벗어나는 분기에서 안 걷어낸다');
  // 걷어내기는 «라벨이 아닌» 분기(배경·라운드를 비우는 else)에 있어야 한다
  const after = src.slice(src.indexOf("contentEl.style.backgroundColor = '';"));
  assert.ok(after.includes('dropLabelAutoColor(contentEl)'), '걷어내기가 else 분기 밖에 있다');
});
