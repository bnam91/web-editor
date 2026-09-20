/* 단위 하네스 — «호출부가 상수를 리터럴로 덮지 않는가»를 소스 문자열로 지킨다.
 *
 * ★왜 이 파일이 따로 있나 (적대검수 T1)
 * grid-cell-resize.test.mjs 에 「상한/최소폭은 «상수 한 곳»에서 온다 — 호출부 리터럴로 갈라지지
 * 않는다」는 이름의 테스트를 넣어놨는데, 본문이 «모듈 내부»만 봤다. 실제 결함은 호출부
 * (overlay-handles.js) 에 있었고, 결함을 그대로 되살려도 434/434 초록이었다 — 검수자가
 * 변이(리터럴 복원)로 실증했다. 값을 부르는 쪽을 안 보면 SSOT 는 지켜지지 않는다.
 *
 * ⚠️이 파일은 «동작»이 아니라 «소스 문자열»을 단언한다. 정상적인 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 이 파일을 지우지 말고, 「그 상수가 여전히 한 곳에서 오는가」를 확인한 뒤 패턴을 고쳐라.
 *   선례: grid-p1.test.js 가 같은 방식으로 import 2줄의 존재를 지킨다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { stripComments } from './_strip-comments.js';   // ★공용 주석 거르개(image/* 안전)

const read = (rel) => fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8');

/* 주석을 걷어낸다 — 주석에 적힌 옛 리터럴(설명문)을 결함으로 세면 오탐이다.
 * (이 레포의 design-gate 가 예전에 정확히 그 오탐을 냈다.)
 * ★2026-09-08 «공용 부품»으로 옮겼다 — 여기 있던 한 줄 정규식은
 *   `accept="image/*"` 의 /* 를 블록 주석 시작으로 읽고 뒤를 통째로 삼켰다.
 *   지금 훑는 두 파일엔 image/* 가 0건이라 «안 물렸지만», 생기는 날 조용히 반만 잰다.
 *   ⇒ 잠복을 두지 않고 부품으로 닫는다. 근거·한계는 ./_strip-comments.js 머리글. */

test('★행 높이: overlay-handles 의 resizeRowHeight 호출이 min/max 를 «넘기지 않는다»', () => {
  const src = stripComments(read('js/overlay-handles.js'));
  const calls = [...src.matchAll(/resizeRowHeight\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(calls.length > 0, 'resizeRowHeight 호출을 못 찾았다 — 리팩터링됐나? 패턴을 갱신하라');
  for (const args of calls) {
    const n = args.split(',').length;
    assert.equal(n, 2,
      `resizeRowHeight(${args}) — 인자가 ${n}개다. min/max 를 넘기면 모듈 기본값(ROW_H_MIN/ROW_H_MAX)이 죽는다. ` +
      `패널은 4000, 드래그는 2000 으로 갈렸던 실제 결함이다.`);
  }
});

test('★열 최소폭: overlay-handles 의 resizeColBoundary 호출이 minPx 를 «넘기지 않는다»', () => {
  const src = stripComments(read('js/overlay-handles.js'));
  const calls = [...src.matchAll(/resizeColBoundary\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(calls.length > 0, 'resizeColBoundary 호출을 못 찾았다 — 패턴을 갱신하라');
  for (const args of calls) {
    const n = args.split(',').length;
    assert.equal(n, 4,
      `resizeColBoundary(${args}) — 인자가 ${n}개다. 5번째(minPx)를 넘기면 COL_MIN_PX 가 죽는다.`);
  }
});

test('★행 높이 상한 4000 은 «상수 밖»에 리터럴로 남아 있지 않다', () => {
  // 상수 정의 파일 자신은 제외. 나머지에서 행 높이 문맥의 4000 이 보이면 SSOT 가 깨진 것이다.
  const targets = ['js/blocks/grid-block.js', 'js/props/prop-grid.js', 'js/overlay-handles.js'];
  for (const rel of targets) {
    const src = stripComments(read(rel));
    assert.equal(/\b4000\b/.test(src), false,
      `${rel} 에 리터럴 4000 이 남아 있다 — ROW_H_MAX 를 import 해서 써라`);
    /* ★2026-09-08 패턴을 좁혔다. 옛 패턴 /\b2000\b/ 는 SVG 네임스페이스
         'http://www.w3.org/2000/svg' 의 2000 에도 걸린다.
       ⛔그런데도 초록이던 이유는 «주석 거르개가 부서져» 그 줄을 통째로 지웠기 때문이다
         (한 줄 정규식이 //  뒤를 몽땅 잘라 문자열 안의 URL 을 먹었다).
       ⇒ 거르개를 공용 부품으로 고치자 이 검사가 «잘못된 이유로 초록»이던 게 드러났다.
         숫자 앞뒤가 / . 이나 낱말이면 «경로·URL»이지 상한 리터럴이 아니다. */
    assert.equal(/(?<![\/.\w])2000(?![\/\w])/.test(src), false,
      `${rel} 에 리터럴 2000 이 남아 있다 — 드래그 상한이 혼자 절반이던 결함의 재발이다`);
  }
});

test('★피커 격자 폭은 CSS 가 아니라 상수에서 온다(축 하드코딩 방지)', () => {
  const src = stripComments(read('js/props/_helpers.js'));
  assert.match(src, /gridTemplateColumns/,
    'buildGridPicker 가 격자 열 수를 직접 정하지 않는다 — CSS 의 repeat(4,1fr) 이 「한 변 4」를 따로 알게 된다');
  // 행 루프가 행 상한(MAXR)을 쓰는지 — MAX(열 상한)로 돌면 alive 와 어긋난다(적대검수 G1)
  assert.match(src, /for\s*\(\s*let\s+r\s*=\s*1;\s*r\s*<=\s*MAXR/,
    '행 루프 상한이 MAXR 이 아니다 — 열 상한(MAX)으로 돌면 「살아있다는데 셀이 없는」 조합이 생긴다');
});

/* ═══ 0920b-grid-image — «호출부가 반환을 받는가» ════════════════════════════
 * ★이 파일의 존재 이유가 그대로 한 번 더 일어났다. grdAddLine 은 updateGridBlock 의 반환을
 *   «안 받고» 무조건 {ok:true} 를 돌려줬고, 우클릭 이미지 추가 호출부는 grdAddLine 의 반환을
 *   «또» 안 봤다. 두 겹이 겹쳐 TOO_LARGE 거절이 토스트 0건·콘솔 0건으로 사라졌다
 *   (= 현빈 2026-09-20 「그리드블럭 우클릭 후 이미지 삽입안되는 이슈」).
 * ⇒ 「검사 있다 ≠ 자동으로 돈다」와 같은 갈래 — 반환을 «버리는» 자리를 소스로 못박는다. */

/** 그 호출 앞에 무엇이 오는가 — 같은 구문 안에서 앞 텍스트를 뽑는다(빈 문자열 = 맨 statement). */
function _prefixOfCall(src, idx) {
  let i = idx - 1;
  while (i >= 0 && !'\n;{}'.includes(src[i])) i--;
  return src.slice(i + 1, idx).trim();
}

test('★그리드 커밋 호출부는 «반환을 버리지 않는다»(거짓 성공 재발 방지)', () => {
  const targets = ['js/block-factory.js', 'js/props/prop-grid.js', 'js/block-drag.js'];
  const CALL = /(?:window\.)?(updateGridBlock|grdAddLine)\s*\??\.?\(/g;
  let seen = 0;
  for (const rel of targets) {
    const src = stripComments(read(rel));
    for (const m of src.matchAll(CALL)) {
      const prefix = _prefixOfCall(src, m.index);
      if (/(?:export\s+)?function\s*$/.test(prefix)) continue;   // 정의부(prop-grid.js grdAddLine)
      seen++;
      assert.notEqual(prefix, '',
        `${rel}: \`${m[0]}\` 가 «맨 statement»다 — 반환을 받지 않으면 실패가 화면에 안 뜬다. ` +
        `grdToastImgFail(...) 로 감싸거나 const res = … 로 받아라.`);
    }
  }
  assert.ok(seen >= 8, `그리드 커밋 호출을 ${seen}개밖에 못 찾았다 — 패턴이 낡았나? 갱신하라`);
});

test('★imgSrc 문자열 캡 200000 은 grid-block.js 안에서 «상수 한 곳»에만 있다', () => {
  const src = stripComments(read('js/blocks/grid-block.js'));
  const hits = [...src.matchAll(/(?<![\/.\w])200000(?![\/\w])/g)];
  assert.equal(hits.length, 1, `grid-block.js 의 리터럴 200000 이 ${hits.length}곳이다 — GRID_IMG_MAX_CHARS 하나만 남겨라`);
  assert.match(src, /export const GRID_IMG_MAX_CHARS = 200000;/);
  // UI 쪽 바이트 상한도 상수여야 한다 — prop-grid.js 가 리터럴로 따로 들면 둘이 갈라진다.
  const pg = stripComments(read('js/props/prop-grid.js'));
  assert.match(pg, /GRID_IMG_MAX_BYTES/, 'prop-grid.js 가 UI 상한 상수를 import 하지 않는다');
  assert.equal(/5\s*\*\s*1024\s*\*\s*1024/.test(pg), false, 'prop-grid.js 에 5MB 리터럴이 복제됐다 — 상수를 써라');
});

test('★opts.trusted 는 «3번째 인자»로만 — partial 안으로 새지 않는다(MCP 뒷문 봉쇄)', () => {
  const gb = stripComments(read('js/blocks/grid-block.js'));
  assert.match(gb, /opts\s*&&\s*opts\.trusted === true/, 'trusted 판정이 opts 에서 오지 않는다');
  assert.equal(/partial\.trusted/.test(gb), false,
    'grid-block.js 가 partial.trusted 를 읽는다 — MCP 가 JSON 으로 보낼 수 있는 자리다(뒷문)');

  /* main.js 의 MCP 통로는 «2인자»여야 한다 — 3번째를 붙이는 순간 IPC 에 trusted 가 열린다. */
  const mainSrc = stripComments(read('main.js'));
  const calls = [...mainSrc.matchAll(/window\.updateGridBlock\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(calls.length > 0, 'main.js 의 updateGridBlock 호출을 못 찾았다 — 패턴을 갱신하라');
  for (const args of calls) {
    assert.equal(args.split(',').length, 2,
      `main.js: window.updateGridBlock(${args}) — MCP 통로는 2인자여야 한다(trusted 노출 금지)`);
  }
});

test('★UI 파일 입구 4곳은 «바이트 게이트 + trusted»를 «같이» 쓴다', () => {
  // 게이트 없이 trusted 만 쓰면 상한이 통째로 사라지고, 게이트만 쓰면 여전히 200000자에 걸린다.
  const files = ['js/block-factory.js', 'js/props/prop-grid.js', 'js/block-drag.js'];
  let gates = 0, trusted = 0;
  for (const rel of files) {
    const src = stripComments(read(rel));
    gates   += [...src.matchAll(/grdImageFileOk\s*\??\.?\(/g)].length;
    trusted += [...src.matchAll(/\{\s*trusted:\s*true\s*\}/g)].length;
  }
  assert.equal(gates, 4, `파일 크기 게이트가 ${gates}곳이다 — 우클릭·패널·빈슬롯 더블클릭 4 입구 전부 걸어라`);
  assert.equal(trusted, 4, `trusted 커밋이 ${trusted}곳이다 — 게이트와 «같은 수»여야 한다`);
});
