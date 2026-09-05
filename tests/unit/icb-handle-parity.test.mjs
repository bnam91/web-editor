/* U-ICB 하네스 — 아이콘 원형(«에셋서클») 블록과 에셋 블록의 «구조 동등성» 회귀 가드.
 *   실행: node --test "tests/unit/*.test.mjs"   ·  라이브 userData 무접촉(소스만 읽는다).
 *
 * ★왜 이 파일이 있나 — 실기에서 세 가지가 «갈렸다»(2026-09-05, 포트 9376 격리 실측).
 *   ① 블록 상자가 원의 «3배 폭»이었다 — 원 240px 인데 상자 716px.
 *      ⇒ 선택 아웃라인이 원과 무관한 직사각형, hover 틴트가 빈 여백까지, 원에서 먼 곳 클릭도 선택.
 *      에셋 블록(.asset-block)은 상자=보이는 면이라 셋이 일치한다. 여기만 어긋나 있었다.
 *   ② 핸들이 «한 개»(se)뿐이었다 — 에셋 블록은 네 모서리.
 *   ③ 같은 블록을 «다시 클릭»하면 핸들이 사라져 영영 안 돌아왔다(실측 4→0).
 *      원인 둘: (a) 핸들이 `.asset-overlay-handle` 클래스를 빌려 써서 남의 일괄정리에 쓸려갔고,
 *              (b) `deselectAll()` 이 이쪽 hide 를 안 불러 모듈 상태변수가 «해제된 블록»을 계속 가리켰다
 *                  → 동일블록 가드에 걸려 재생성이 no-op.
 *   기대값에 숫자를 박지 않는다 — 전부 «소스에서 가져온 것»으로 비교한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* js/overlay-handles.js 는 브라우저에서 `<script type=module>` 로 로드된다.
   Node 는 확장자 .js 를 CJS 로 읽어 `export` 에서 터진다 — 그래서 «소스에서 잘라» 같은 realm 에서 평가한다
   (section-bg-punchout.test.js 와 같은 방식). 이렇게 하면 기대값이 아니라 «실제 식»을 검사하게 된다. */
const OH_SRC = read('js/overlay-handles.js');
const _slice = (from, to) => {
  const i = OH_SRC.indexOf(from), j = OH_SRC.indexOf(to, i + 1);
  assert.ok(i !== -1 && j > i, `소스에서 ${from} … ${to} 구간을 못 찾음 — 리팩터링됐나?`);
  return OH_SRC.slice(i, j);
};
const OH = new Function(
  _slice('export const CORNER_DIRS', '/* ═')
    .replace(/^export /gm, '')
  + '\nreturn { CORNER_DIRS, cornerSign, circumferenceOffset };'
)();

test('ICB1 네 모서리 표는 «한 곳»에서 나온다 — 방향 4개가 서로 다르고 e/s 가 바깥(+)', () => {
  assert.equal(new Set(OH.CORNER_DIRS).size, OH.CORNER_DIRS.length, 'dir 중복');
  const pairs = OH.CORNER_DIRS.map(d => { const s = OH.cornerSign(d); return `${s.sx},${s.sy}`; });
  assert.equal(new Set(pairs).size, OH.CORNER_DIRS.length, '두 모서리가 같은 부호를 쓴다 — 드래그 방향이 겹친다');
  for (const d of OH.CORNER_DIRS) {
    const { sx, sy } = OH.cornerSign(d);
    assert.equal(sx, d.includes('e') ? 1 : -1, `${d} 가로 부호`);
    assert.equal(sy, d.includes('s') ? 1 : -1, `${d} 세로 부호`);
  }
});

test('ICB2 ★핸들은 원 «둘레»에 밀착한다 — 상자 꼭지점은 원 밖으로 뜬다(판별력 증명 포함)', () => {
  for (const R of [20, 48, 120, 200, 430]) {
    const off = OH.circumferenceOffset(R);
    for (const d of OH.CORNER_DIRS) {
      const { sx, sy } = OH.cornerSign(d);
      const dist = Math.hypot(off * sx, off * sy);
      assert.ok(Math.abs(dist - R) < 1e-9, `${d} R=${R}: 중심거리 ${dist} ≠ 반지름 ${R} (원에서 떴다)`);
    }
    /* ★이 축이 «갈리는지» 증명 — 고치기 전의 배치(상자 꼭지점 (R,R))는 반드시 원 밖이어야 한다.
       이게 성립 안 하면 위 단정은 무엇이든 통과하는 무의미한 측정이다. */
    const boxCorner = Math.hypot(R, R);
    assert.ok(boxCorner > R + 0.4 * R, `R=${R}: 상자 꼭지점이 원 밖이 아니다 — 측정축이 무의미`);
  }
});

test('ICB3 ★아이콘 원형 핸들은 에셋 블록의 «일괄 제거»에 쓸려가지 않는다', () => {
  const src = read('js/overlay-handles.js');
  const icbFn = src.slice(src.indexOf('function showIconCircleResizeHandle'),
                          src.indexOf('function hideIconCircleResizeHandle'));
  assert.ok(icbFn.length > 200, 'showIconCircleResizeHandle 을 못 찾음 — 리팩터링됐나?');
  const cls = /className\s*=\s*`([a-z-]+)\s/.exec(icbFn);
  assert.ok(cls, '아이콘 원형 핸들의 className 을 못 읽음');

  const hideAsset = src.slice(src.indexOf('function hideAssetResizeHandles'),
                              src.indexOf('function _updateAssetResizeHandlePositions'));
  const sweep = /querySelectorAll\('\.([a-z-]+)'\)/.exec(hideAsset);
  assert.ok(sweep, 'hideAssetResizeHandles 의 제거 셀렉터를 못 읽음');
  assert.notEqual(cls[1], sweep[1],
    `아이콘 원형 핸들이 «${cls[1]}» 인데 hideAssetResizeHandles 가 «.${sweep[1]}» 를 전부 지운다 — 남의 정리에 쓸려간다`);
});

test('ICB4 ★deselectAll 이 아이콘 원형 핸들도 정리한다 — 안 하면 상태변수가 늙어 재선택이 no-op', () => {
  const src = read('js/editor.js');
  const i = src.indexOf('window.hideAssetResizeHandles?.()');
  assert.ok(i !== -1, 'deselectAll 의 핸들 정리 구간을 못 찾음');
  const near = src.slice(i, i + 900);
  assert.ok(/window\.hideIconCircleResizeHandle\?\.\(\)/.test(near),
    'deselectAll 의 핸들 정리 구간에 hideIconCircleResizeHandle 호출이 없다');
});

test('ICB5 ★블록 상자를 «원의 상자»에 못박는다 — 인라인 width:100% 를 이겨야 해서 !important', () => {
  const css = read('css/editor-blocks.css');
  const i = css.indexOf('.icon-circle-block {');
  assert.ok(i !== -1, '.icon-circle-block 기본 규칙을 못 찾음');
  /* 주석 안에도 'border-radius' 라는 «단어»가 있다 — 선언만 보려면 주석을 걷고 봐야 한다.
     (도구 출력의 첫 글자를 결론으로 쓰지 않기 위한 자리) */
  const rule = css.slice(i, css.indexOf('}', i)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/width:\s*fit-content\s*!important/.test(rule),
    '.icon-circle-block 이 원 크기로 줄지 않는다 — 아웃라인/hover/클릭영역이 다시 원의 3배가 된다');
  assert.ok(/align-self:\s*center/.test(rule) && /justify-self:\s*center/.test(rule),
    'stack/flex/grid 어느 한 레이아웃에서 stretch 가 살아난다');
  assert.ok(!/border-radius/.test(rule),
    '.icon-circle-block 에 border-radius 가 돌아왔다 — 선택 아웃라인 모서리가 다시 둥글어진다');
});

test('ICB6 ★회전 시 반지름을 «AABB»에서 뽑지 않는다 — 뽑으면 핸들이 원 밖으로 뜬다', () => {
  const src = read('js/overlay-handles.js');
  const fn = src.slice(src.indexOf('function showIconCircleResizeHandle'),
                       src.indexOf('function hideIconCircleResizeHandle'));
  const body = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const rAssign = /const\s+R\s*=\s*([^;]+);/.exec(body);
  assert.ok(rAssign, '핸들 반지름 계산식을 못 찾음 — 리팩터링됐나?');
  /* getBoundingClientRect 는 «회전된 요소의 축정렬 바운딩박스» 라 회전하면 부푼다.
     실측: 96px 원을 45° 돌리면 rect 가 135.8px → 반지름 67.9px 로 잡혀 핸들이 원 밖 19.9px.
     반지름은 transform 이 안 섞인 레이아웃 값(offsetWidth)에 캔버스 배율을 곱해 내야 한다. */
  assert.ok(!/rect\.(width|height)/.test(rAssign[1]),
    `반지름을 rect 에서 뽑는다(«${rAssign[1].trim()}») — 회전하면 AABB 가 부풀어 핸들이 원 밖으로 뜬다`);
  assert.ok(/offsetWidth/.test(rAssign[1]),
    `반지름이 레이아웃 폭(offsetWidth) 기반이 아니다(«${rAssign[1].trim()}»)`);
});
