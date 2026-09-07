/* U-CVBEXP — 빈 카드 이미지 표시가 «내보내기 결과물»로 새는지 감시한다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★왜 이 파일이 있나 — 적대검수(EVAL-batch-0905) 조건①.
 *   현빈 2026-09-05 「카드블럭에 이미지 영역 체크배경으로 해줘. 다른 이미지 에셋 블럭 배경처럼」
 *   1차 수정(M38)이 체커를 «인라인 style» 로 박았다. 인라인은 직렬화돼 저장본에 실리고
 *   내보낸 HTML 에도 체커와 '+' 가 그대로 찍힌다 — «편집 화면 표시»가 «배송물»이 된 것이다.
 *   ★정본인 .asset-block 은 체커를 CSS 에 둔다. 재사용해야 했던 것은 «값»이 아니라 «두는 자리».
 *   ★옛 코드(rgba(0,0,0,0.06))도 같은 인라인이었다 — 회색이라 안 보였을 뿐. 새 병이 아니라
 *     드러난 병이다. 그래서 이 검사는 «체커»가 아니라 «인라인이냐»를 잰다.
 *
 * ⚠️이 검사는 «결함이 다시 들어오는 문»을 지킨다. 값을 옮겨도 다음 사람이 인라인으로 되돌리면
 *   조용히 회귀하고, export-html 의 클래스 제거 줄은 그때 아무것도 안 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CVB    = strip(read('js/blocks/canvas-block.js'));
const CSS    = read('css/editor-blocks.css');
const EXPORT = strip(read('js/io/export-html.js'));

/* ★이 검사를 «한 번 틀리게» 썼다(2026-09-06). 처음엔 「그 줄에 repeating-conic-gradient 가
   있는가」로 셌는데, 옛 코드는 `style.background = _CVB_CHECKER_BG` 라 «그 줄에 그 글자가 없다».
   그래서 양성대조에서 옛 소스가 이 검사를 «통과»했다 — 지켜야 할 바로 그 회귀를 못 보는 검사였다.
   ⇒ 리터럴이 아니라 «체커를 담은 이름»까지 같이 본다. 값이 상수 뒤에 숨어도 잡힌다. */
test('★조건① — 빈 카드 이미지 체커를 «인라인 style» 로 박지 않는다(직렬화돼 결과물에 실린다)', () => {
  // 이 파일 안에서 체커 문자열을 담은 const 이름을 «소스에서» 찾아낸다(이름을 박지 않는다).
  const holders = [...CVB.matchAll(/const\s+([A-Za-z0-9_$]+)\s*=\s*'[^']*repeating-conic-gradient/g)]
    .map(m => m[1]);
  const rhs = ['repeating-conic-gradient', ...holders];
  const bad = CVB.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\.style\.(background|backgroundImage|cssText)\s*=/.test(l)
                    && rhs.some(r => l.includes(r)))
    .map(([n, l]) => `${n}: ${l.trim()}`);
  assert.deepEqual(bad, [],
    '체커가 인라인으로 돌아왔다 — 저장본·내보내기에 실린다. .cvb-img-empty 클래스를 쓸 것');
});

test('★자기검사 — 위 검사가 «상수 뒤에 숨은» 인라인도 잡는지 확인한다(양성대조를 코드로 고정)', () => {
  const FAKE = [
    "const _X_BG = 'repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px';",
    '  el.style.background = _X_BG;',
  ].join('\n');
  const holders = [...FAKE.matchAll(/const\s+([A-Za-z0-9_$]+)\s*=\s*'[^']*repeating-conic-gradient/g)]
    .map(m => m[1]);
  const rhs = ['repeating-conic-gradient', ...holders];
  const caught = FAKE.split('\n').filter(l =>
    /\.style\.(background|backgroundImage|cssText)\s*=/.test(l) && rhs.some(r => l.includes(r)));
  assert.equal(caught.length, 1,
    '검사식이 «상수 뒤에 숨은» 인라인을 못 본다 — 지켜야 할 회귀가 바로 이 모양이었다');
});

test("★조건① — '+' 안내문을 DOM 텍스트 노드로 넣지 않는다(클래스를 벗겨도 글자가 남는다)", () => {
  assert.doesNotMatch(CVB, /textContent\s*=\s*'\+'/,
    "'+' 가 텍스트 노드로 돌아왔다 — ::before 로 둘 것");
});

test('★체커는 CSS 에 «있다» — 옮기기만 하고 안 그리면 현빈 요구가 사라진다', () => {
  for (const cls of ['.cvb-img-empty', '.cvb-img-empty-plain']) {
    const i = CSS.indexOf(`.canvas-block ${cls} {`);
    assert.ok(i !== -1, `${cls} 규칙이 없다 — 체커가 아예 안 그려진다`);
    const body = CSS.slice(i, CSS.indexOf('}', i));
    assert.match(body, /repeating-conic-gradient/, `${cls} 에 체커가 없다`);
  }
  assert.match(CSS, /\.canvas-block \.cvb-img-empty::before\s*\{[^}]*content:\s*'\+'/,
    "'+' 안내문이 ::before 에 없다");
});

test('★정본과 «같은 값» — 빈 에셋 블록의 체커와 문자열이 일치한다(현빈: 「에셋 블럭 배경처럼」)', () => {
  const grab = (src, needle) => {
    const i = src.indexOf(needle);
    assert.ok(i !== -1, `못 찾음: ${needle}`);
    const m = src.slice(i, i + 400).match(/repeating-conic-gradient\([^)]*\)[^;]*/);
    return m && m[0].replace(/\s+/g, ' ').trim();
  };
  const asset = grab(read('css/editor-layout.css'), '.asset-block {');
  const card  = grab(CSS, '.canvas-block .cvb-img-empty {');
  assert.equal(card, asset, '카드 체커가 에셋 블록과 다른 값이다 — 「같은 배경처럼」이 깨진다');
});

test('★export 는 이 표시를 «편집 전용»으로 다룬다(.bn2-line-empty 와 같은 목록)', () => {
  assert.match(EXPORT, /cvb-img-empty/,
    'export-html 이 이 클래스를 모른다 — 편집 전용 표시라는 «의도»가 코드에 없다');
});
