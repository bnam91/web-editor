/* redact-mode-seg-markup.test.js — 가림막 「방식」(블러/모자이크) 세그먼트 버튼 CSS 깨짐 회귀.
 *
 * ★원인(2026-09-19, fix/0918-redact): prop-shape.js 가 `.prop-segmented` / `.prop-segmented-btn`
 *   클래스를 썼는데 css/*.css 어디에도 정의가 없었다 → 블러/모자이크 버튼이 크롬 기본 버튼
 *   (outset 테두리, #efefef)으로 나오고 켜짐(.active) 표시도 안 보였다(실측 9502: 두 버튼 모두
 *   bg rgb(239,239,239), border outset).
 *   ⇒ 새 CSS 를 만들지 않고 앱의 기존 글자 세그먼트 컨트롤 `.prop-align-group`/`.prop-align-btn`
 *     (editor-props.css) 을 쓴다 — 같은 모양을 두 벌 관리하지 않기 위해.
 * 양성대조: 수정 전 dev 소스(37d583f)에서 S1·S2 가 빨강이다(prop-segmented 2+1건, align 클래스 0건).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeStripper } = require('./_strip-comments.js');

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const codeOnly = (src) => { const strip = makeStripper(); return src.split('\n').map(strip).join('\n'); };

const SHAPE = codeOnly(read('js/props/prop-shape.js'));
const CSS = read('css/editor-props.css');

test('S1 ★prop-shape.js 코드에 정의 없는 prop-segmented 클래스가 0건', () => {
  const hits = SHAPE.match(/prop-segmented/g) || [];
  assert.equal(hits.length, 0, `prop-segmented 가 ${hits.length}건 남아 있다 — CSS 정의가 없는 클래스라 기본 버튼 모양으로 깨진다`);
});

test('S2 ★shape-redact-mode-seg 는 prop-align-group, 안의 blur/mosaic 버튼은 prop-align-btn', () => {
  const m = SHAPE.match(/<div\s+class="([^"]*)"\s+id="shape-redact-mode-seg">([\s\S]*?)<\/div>/);
  assert.ok(m, 'id="shape-redact-mode-seg" 컨테이너를 못 찾았다(마크업 형태가 바뀌었으면 이 검사도 고쳐라)');
  assert.ok(m[1].split(/\s+/).includes('prop-align-group'), `컨테이너 class="${m[1]}" 에 prop-align-group 이 없다`);
  const btns = [...m[2].matchAll(/<button\b[^>]*>/g)].map(x => x[0]);
  const modes = btns.map(b => (b.match(/data-mode="([^"]+)"/) || [])[1]).sort();
  assert.deepEqual(modes, ['blur', 'mosaic'], `data-mode 버튼이 blur/mosaic 2개가 아니다: ${modes}`);
  for (const b of btns) {
    assert.match(b, /class="prop-align-btn(\$\{[^}]*\})?"/, `버튼 class 가 prop-align-btn 이 아니다: ${b}`);
    assert.match(b, /type="button"/, `type="button" 누락: ${b}`);
  }
});

test('S3 ★클릭 바인딩 선택자도 같은 클래스를 본다(마크업만 바꾸고 선택자를 안 바꾸면 버튼이 죽는다)', () => {
  assert.match(SHAPE, /redactModeSeg\.querySelectorAll\('\.prop-align-btn'\)/);
});

test('S4 ★쓰는 클래스가 css/editor-props.css 에 실제로 정의돼 있다(.active 포함)', () => {
  assert.match(CSS, /^\.prop-align-group\s*\{/m);
  assert.match(CSS, /^\.prop-align-btn\s*\{/m);
  assert.match(CSS, /^\.prop-align-btn\.active\s*\{/m);
});
