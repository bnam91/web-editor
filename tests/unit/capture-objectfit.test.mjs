/* U-CAPTUREFIT — 「html2canvas 경로의 object-fit 대체」의 «변이 책임».
 *
 * 숫자(마커 띠 행 수)는 tests/dom/thumbnail-object-fit.dom.spec.js 가 실제로 잰다.
 * 그런데 tests/dom 은 `npm test` 스위트에 «안» 들어간다 ⇒ 누가 이 자리를 되돌려도
 * 기본 검사에서는 조용히 지나간다. 그래서 «되돌리면 걸리는» 자리를 여기 박는다.
 *
 * 신고 (2026-09-21 최종통합 QA medium): 프로젝트 목록 썸네일이 이미지를 상자에 «찌그러뜨려»
 *   넣는다 — 동봉한 html2canvas 1.4.1 에 object-fit 구현이 없어서다. 화면·네이티브 PNG 는
 *   cover 로 가운데를 자르는데 썸네일만 전체 그림을 늘려 넣어 «다른 그림»이 된다.
 *
 * 지키는 것 넷
 *   F-1 전제 — 동봉 라이브러리에 object-fit 이 없다(있게 되면 이 대체가 이중처리가 된다).
 *   F-2 html2canvas 를 쓰는 «3경로»가 전부 중화를 부른다(한 벌 명부).
 *   F-3 ⛔네이티브(CDP) 경로에는 «없다» — 브라우저가 제대로 그리므로 거기서 자르면 두 번 잘린다.
 *   F-4 중화가 «안전 실패»다 — tainted canvas·디코드 실패는 원본을 그대로 둔다(퇴행 없음).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './_strip-comments.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const SAFETY = read('js', 'io', 'capture-safety.js');
const H2C    = read('vendor', 'html2canvas', 'html2canvas.min.js');

function bodyOf(src, label) {
  const i = src.indexOf(label);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', i);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(start, k + 1); }
  }
  assert.fail(`★"${label}" 의 몸통 끝을 못 찾았다`);
}

test('F-1 전제 — 동봉 html2canvas 에 object-fit 구현이 «없다»', () => {
  assert.match(H2C, /html2canvas 1\.4\.1/,
    '★라이브러리가 바뀌었다 — 이 대체의 «왜»부터 다시 확인해라');
  const hits = (H2C.match(/object-?[Ff]it/g) || []).length;
  assert.strictEqual(hits, 0,
    `★html2canvas 가 object-fit 을 알게 됐다(${hits}건) — 이제 중화가 «두 번 자르기»일 수 있다`);
});

test('F-2 html2canvas 3경로가 전부 object-fit 중화를 부른다', () => {
  const sites = [
    ['js/io/save-load.js',      '프로젝트 목록 썸네일(captureThumbnail)'],
    ['js/props/prop-mockup.js', '목업 캡처(_captureAndApply)'],
    ['js/io/export-image.js',   'PNG 내보내기의 html2canvas 폴백(웹 빌드)'],
  ];
  for (const [f, why] of sites) {
    const src = read(...f.split('/'));
    assert.match(src, /await\s+neutralizeObjectFitForH2C\s*\(\s*clone\s*\)/,
      `★${why} 가 중화를 안 부른다 — 그 경로만 «다른 그림»이 된다`);
    assert.match(src, /neutralizeObjectFitForH2C/,
      `★${why} 가 중화를 import 하지 않는다`);
  }
});

test('F-3 ⛔네이티브(CDP) 캡처에는 중화를 걸지 않는다 (두 번 자르기 방지)', () => {
  const src = read('js', 'io', 'export-image.js');
  const iNative = src.indexOf('captureSectionCdp 미지원');
  const iCall   = src.indexOf('await neutralizeObjectFitForH2C(clone)');
  assert.ok(iNative > 0, '★네이티브 분기를 못 찾았다 — 이 검사부터 고쳐라');
  assert.ok(iCall > iNative,
    '★중화 호출이 네이티브 분기보다 «앞»이다 — CDP 캡처에서 그림이 두 번 잘린다');
  // 공용 클론 준비(prepareCloneForCapture)에는 «없어야» 한다 — 그쪽은 두 경로가 같이 쓴다.
  const prep = stripComments(bodyOf(src, 'export async function prepareCloneForCapture'));
  assert.ok(!/neutralizeObjectFitForH2C/.test(prep),
    '★공용 클론 준비에 중화가 들어갔다 — 네이티브 경로까지 같이 잘린다');
});

test('F-4 중화는 «안전 실패» — 못 하면 원본을 그대로 둔다', () => {
  const fn = stripComments(bodyOf(SAFETY, 'export async function neutralizeObjectFitForH2C'));
  assert.match(fn, /cover/, '★cover 를 안 본다');
  assert.match(fn, /contain/, '★contain 을 안 본다');
  assert.match(fn, /toDataURL/, '★상자 크기대로 미리 잘라 끼우지 않는다');
  assert.match(fn, /catch/, '★tainted canvas·디코드 실패를 못 받는다 — 썸네일이 통째로 죽는다');
  /* 비율이 «같으면» 손대지 않는다 — 자를 것이 없는데 재인코딩하면 화질만 상한다. */
  assert.match(fn, /continue/, '★건너뛰는 갈래가 없다');
  /* 상자는 offsetWidth 로 잰다 — rect 는 캔버스 줌(transform)이 곱해질 수 있다. */
  assert.match(fn, /offsetWidth/, '★상자를 offsetWidth 로 안 잰다');
});
