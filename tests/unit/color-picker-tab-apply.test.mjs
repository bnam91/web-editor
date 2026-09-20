/* color-picker-tab-apply — 0918 picker «탭 = 즉시 적용»의 소스 고정 핀.
 *
 * 동작은 tests/dom/color-picker-tab-apply.dom.spec.js 가 진짜 크로미움에서 잰다(playwright — npm test 에 안 들어간다).
 * 여기는 그 동작이 기대는 «배선 자리»가 조용히 되돌아가지 않게 npm test 안에 박아 두는 자리다.
 *
 * ⑴ 그라데이션 기록 이중 쌓임: goya-cp:gradient(commit=true) 와 goya-cp:gradient-commit 이 «둘 다» pushHistory 하면
 *    커밋 1번에 기록 2개 → 되돌리기 1번에 아무 변화 없음. 기록은 commit 리스너 «한 곳»에만.
 * ⑵ 첫 진입 기본값 = «지금 색 100%→같은 색 0%» — 옛 고정 2스톱(#ff5e3a→#1aa6ff)이 돌아오면 안 된다.
 * ⑶ 탭 «보여주기»(_showTab)와 «적용»(_activateTab) 분리 — seed/openPicker 가 _activateTab 을 부르면 열기만 해도 기록.
 * ⑷ 도형 이미지(바둑판) 모드는 모든 색 쓰기 경로에서 풀린다 — 안 풀면 «색을 바꿨는데 바둑판이 그대로».
 * ⑸ 바둑판은 편집 전용 — PNG 내보내기 clone 에서 떼인다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceBlock, sliceCall } from './_slice-block.js';   // ★구간 떠내기는 공용 부품 하나로
import { stripComments } from './_strip-comments.js';
import { readSrc } from './_srcread.js';                    // ★CRLF 방어
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (rel) => stripComments(readSrc(REPO, rel));

test('⑴ prop-shape: goya-cp:gradient 리스너 본문엔 pushHistory 가 없고, gradient-commit 리스너에만 있다', () => {
  const s = src('js/props/prop-shape.js');
  const live = sliceCall(s, "shapeColorInput.addEventListener('goya-cp:gradient',");
  const commit = sliceCall(s, "shapeColorInput.addEventListener('goya-cp:gradient-commit',");
  assert.ok(!/pushHistory/.test(live), '라이브 그라데이션 리스너가 기록을 쌓는다(이중 쌓임 회귀)');
  assert.ok(/pushHistory/.test(commit), '커밋 리스너가 기록을 안 쌓는다 — 그라데이션이 되돌리기에서 사라진다');
});

test('⑴ prop-page: 페이지 바탕도 같은 규약', () => {
  const s = src('js/props/prop-page.js');
  const live = sliceCall(s, "bgPicker.addEventListener('goya-cp:gradient',");
  const commit = sliceCall(s, "bgPicker.addEventListener('goya-cp:gradient-commit',");
  assert.ok(!/pushHistory/.test(live));
  assert.ok(/pushHistory/.test(commit));
});

test('⑵ color-picker: 옛 고정 2스톱이 없고, 기본 스톱은 지금 색에서 1→0', () => {
  const s = src('js/props/color-picker.js');
  assert.ok(!/#ff5e3a['"],\s*offset/i.test(s) && !/#1aa6ff/i.test(s), '고정 기본 스톱(#ff5e3a/#1aa6ff)이 돌아왔다');
  const open = sliceBlock(s, 'function openPicker(swatch)');
  assert.match(open, /grad:\s*null/, 'openPicker 가 grad 를 비우지 않는다 — 이전 스와치 스톱이 넘어온다');
  const def = sliceBlock(s, 'const _defaultGradStops = () =>');
  assert.match(def, /opacity:\s*1\s*}/);
  assert.match(def, /opacity:\s*0\s*}/);
  assert.match(def, /hexFromHsv\(_state\.h,\s*_state\.s,\s*_state\.v\)/, '기본 스톱이 «지금 색»에서 안 나온다');
});

test('⑶ color-picker: openPicker·seed 는 _showTab(보여주기)만, _activateTab(적용)은 탭 클릭에서만', () => {
  const s = src('js/props/color-picker.js');
  const open = sliceBlock(s, 'function openPicker(swatch)');
  assert.ok(!/_activateTab/.test(open), 'openPicker 가 _activateTab 을 부른다 — 열기만 해도 기록이 쌓인다');
  const seed = sliceCall(s, "pop.addEventListener('goya-cp:seed-gradient',");
  assert.ok(!/_activateTab/.test(seed));
  assert.match(seed, /_showTab\('gradient'\)/);
  const calls = s.match(/_activateTab\(/g) || [];
  assert.equal(calls.length, 2, `_activateTab 은 정의 1 + 탭 click 1 이어야 한다(실측 ${calls.length})`);
});

test('⑷ 도형 이미지 모드 해제 — MCP setShapeProps·캔버스 그라데이션 핸들·스포이드', () => {
  const bf = src('js/block-factory.js');
  const colorBranch = bf.slice(bf.indexOf('if (partial.shapeColor !== undefined'), bf.indexOf('if (partial.shapeStrokeColor !== undefined'));
  assert.ok(colorBranch.length > 0);
  assert.match(colorBranch, /_clearShapeImage/, 'MCP 로 색을 바꿔도 바둑판이 남는다');
  const gm = src('js/props/gradient-model.js');
  const shapeSet = gm.slice(gm.indexOf("match: (el) => el.classList.contains('shape-block')"));
  assert.match(shapeSet.slice(0, 3000), /_clearShapeImage/, '캔버스 그라데이션 핸들이 이미지 모드를 안 푼다');
  const ed = src('js/editor.js');
  const i = ed.indexOf('shapeTargets.forEach(sb =>');
  assert.ok(i > 0);
  assert.match(ed.slice(i, i + 800), /_clearShapeImage/, '스포이드가 이미지 모드를 안 푼다');
});

test('⑸ PNG 내보내기 clone 에서 바둑판 표식(data-shape-fill, 이미지 없음)을 뗀다', () => {
  const s = src('js/io/export-image.js');
  assert.match(s, /\.shape-block\[data-shape-fill="image"\]:not\(\[data-shape-image\]\)/);
  assert.match(s, /removeAttribute\('data-shape-fill'\)/);
});

test('⑹ 바둑판 CSS 는 가림막을 이기지 않는다(:not(.shape-redact))', () => {
  const css = readSrc(REPO, 'css/editor-blocks.css');
  const line = css.split('\n').find((l) => l.includes('[data-shape-fill="image"]') && l.includes('svg.shape-svg'));
  assert.ok(line, '바둑판 규칙이 없다');
  assert.match(line, /:not\(\.shape-redact\)/);
});

test('⑺ T-059 확장(0918r2 textgrad, 현빈 결정 = 피그마 기준 — 1라운드 ②안을 뒤집음): 글자색 피커는 역할별로 그라데이션을 선언하고 받는다', () => {
  const s = src('js/props/prop-text-wireup-text-edit.js');
  assert.match(s, /cpModes\s*=\s*ok\s*\?\s*'solid,gradient'\s*:\s*'solid'/, '글자색 피커가 역할별(본문=그라데이션 가능, 라벨 등=단색) 게이트를 안 한다');
  assert.match(s, /'goya-cp:gradient-commit'/, '글자색 피커가 그라데이션 확정 이벤트를 안 받는다');
  const t = src('js/props/text-block-color.js');
  assert.match(t, /export function clearTextGradient/);
  assert.match(t, /export function applyTextGradient/);
});

test('⑻ 이미지(바둑판) 모드 진입 시 shapeColor 에 그라데이션 CSS 를 남기지 않는다(마지막 단색으로)', () => {
  const s = src('js/props/prop-shape.js');
  const i = s.indexOf("'goya-cp:image'");
  assert.ok(i > 0);
  assert.match(s.slice(i, i + 1200), /_lastSolidOf\(block\)/, '이미지 모드 진입이 shapeColor 를 마지막 단색으로 안 되돌린다');
});

/* ⑹ 0920 polish1(T-059): 스탑 hex·각도 칸의 'change' 는 탭 버튼 mousedown 의 blur 로 «늦게» 온다.
 *   솔리드 적용 뒤에 깨어난 rAF 그라데이션 커밋이 캔버스·state 를 되덮던 결함 —
 *   방출은 «지금 모드가 그라데이션일 때»만. 동작은 tests/dom/color-picker-tab-apply.dom.spec.js T18/T18c 가 잰다. */
test('⑹ color-picker: 그라데이션 방출이 모드 게이트를 지난다(늦은 change 가 Solid 를 덮지 않게)', () => {
  const s = src('js/props/color-picker.js');
  const emit = sliceBlock(s, 'function _emitGradientNow(commit)');
  assert.match(emit, /_state\.mode\s*!==\s*'gradient'[\s\S]{0,20}return/,
    "_emitGradientNow 에 모드 게이트가 없다 — hex 를 치고 바로 Solid 탭을 누르면 그라데이션이 되살아난다");
  // 게이트는 CSS 계산보다 «먼저» — 늦은 커밋이 이벤트를 쏘기 전에 끊긴다
  assert.ok(emit.indexOf("_state.mode") < emit.indexOf('_buildGradientCSS'), '모드 게이트가 방출 뒤에 있다');
});
