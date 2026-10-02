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

/* ── 0920r6 labeltext (T-059): 라벨 «텍스트» 프리셋 색도 같은 표식 규약으로 + 표식 폐기 누락 3자리 ── */

test('U7 ★소스 가드: 라벨 «텍스트» 프리셋은 제 색에 표식을 달고, 프리셋 초기화는 표식을 폐기한다', () => {
  const src = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-label.js'), 'utf8');
  // 텍스트 프리셋이 넣는 #111111 «바로 뒤»에 표식이 붙어야 한다(붙는 값이 곧 표식이라 사이에 다른 색 쓰기가 끼면 안 됨)
  assert.match(src, /style\.color = '#111111';\s*\n\s*markLabelAutoColor\(ctx\.contentEl\)/,
    '텍스트 프리셋이 넣은 색에 표식을 안 단다 — 라벨을 벗어나도 검은 글자가 남는다');
  // 공통 초기화(_resetLabelInline)는 색을 비우므로 표식도 함께 폐기해야 다음 프리셋의 색만 표식으로 남는다
  assert.match(src, /style\.color = '';\s*\n\s*forgetLabelAutoColor\(ctx\.contentEl\)/,
    '프리셋 초기화가 색만 비우고 옛 표식을 남긴다');
});

test('U8 ★소스 가드: 글자색을 직접 정하는 3자리가 라벨 표식을 폐기한다(0920r5 QA 지적)', () => {
  // 세 곳 모두 «단색을 쓰는 경로» — 여기서 표식을 안 버리면 그 색이 «라벨이 넣은 색»으로 오인돼 타입 전환 때 걷힌다.
  const sites = [
    ['js/props/prop-section.js',   /contentEl\.style\.color = val;\s*\n\s*forgetLabelAutoColor\(contentEl\)/,        '섹션 일괄 글자색'],
    ['js/variable-binding.js',     /contentEl\.style\.color = val;\s*\n\s*window\.forgetLabelAutoColor\?\.\(contentEl\)/, '색 변수 바인딩'],
    ['js/block-edit.js',           /contentEl\.style\.color = opts\.color;\s*\n\s*window\.forgetLabelAutoColor\?\.\(contentEl\)/, 'MCP update_block'],
  ];
  for (const [file, re, what] of sites) {
    assert.match(fs.readFileSync(path.join(REPO, file), 'utf8'), re, `${what}(${file})가 라벨 표식을 안 버린다`);
  }
  // 클래식 스크립트 두 곳은 import 를 못 쓴다 → 모듈이 window 로 내보내는지 함께 확인(안 내보내면 위 호출이 영원히 no-op)
  const mod = fs.readFileSync(path.join(REPO, 'js/props/label-auto-color.js'), 'utf8');
  assert.match(mod, /window\.forgetLabelAutoColor\s*=\s*forgetLabelAutoColor/, 'window 노출이 없어 클래식 스크립트에서 no-op 이 된다');
});
