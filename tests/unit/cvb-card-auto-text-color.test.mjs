/* cvb-card-auto-text-color — 카드블럭 «글자색 자동»의 한 자리 cvbAutoTextColor (1020t1c)
 *
 * ★현빈 원문(261020 01:27) — 「★1020t1c 카드블럭 ★줄추가하면 ★텍스트 색이 ★바뀌네?」
 *
 * ★무엇이었나(실측 261020, 9334 실물 renderCanvas vs 줄추가 경로 · 배경 꼴 21가지):
 *   색을 정하는 식이 ★네 벌이었고 ★「휘도를 못 재는 배경」 갈래가 ★갈렸다.
 *     · 렌더 셋(밴드·칸·슬롯) — null 이면 ★«한 단계 위의 색»(밴드 색)으로 떨어진다
 *     · 줄추가(_cvbBeginAdd) — null 이면 ★'#1a1a1a'/'#555555' 를 ★손으로 박았다
 *   ⇒ ★어두운 밴드(textBg) ＋ ★휘도를 못 재는 칸 배경(그라데이션·transparent·이름색 navy·var())에서
 *     ★기존 줄은 ★#ffffff, ★새 줄은 ★#1a1a1a — ★21꼴 중 ★4꼴에서 갈렸다(명시 색 지정 시 0/21).
 *   ⛔내 회귀가 아니었다 — _cvbBeginAdd 몸통 md5 가 51e7d998^ · 51e7d998 · HEAD 에서 ★같다.
 *     색 식은 a4125856(2026-10-12)부터 있었다. 261019 의 카드블럭 손질은 ★입구만 옮겼다.
 *
 * ★무엇을 잠그나
 *   T0 전제 — 실물이 export 됐고 문턱이 우리가 아는 값이다(잴 것이 있는지 먼저 본다)
 *   T1 갈래 셋 — 어두움 · 밝음 · ★못 잼(=fallback 을 ★그대로 돌려준다) ＋ ★경계값 0.45
 *   T2 ★주범 — _cvbBeginAdd 가 fallback 으로 ★«밴드 색»을 넘긴다(손으로 박은 색이 아니다)
 *   T3 ★구조 — 식이 ★한 벌이다. ⛔주석으로는 못 막으므로 ★소스에서 센다
 *
 * ★이 칸들이 ★처방 전에 ★빨갰다(수로 — 주석 벗긴 코드에서 센 것):
 *   파일 전체   colorLuminance( ★4→1 · 0.45 ★8→1
 *   _cvbBeginAdd 몸통  0.45 ★2→0 · colorLuminance( ★1→0 · cvbAutoTextColor( ★0→3 · dataset.textBg ★0→1
 *   ⇒ T3 의 단언은 ★항등식이 아니다(처방 전 판에서 계산해 두고 걸었다).
 *
 * ★하네스 — cvb-card-add-slot.test.mjs 와 ★같은 stubCopy 꼴(사본을 베끼지 않고 ★실물을 싣는다).
 *   ⛔colorLuminance 는 drag-utils.js 안에 있고 그 모듈은 최상위에서 DOM 을 읽어 node 에서 못 싣는다
 *     ⇒ ★«숫자를 그대로 통과시키는» 스텁으로 갈아 ★문턱 비교 자체를 제품 코드로 재게 한다
 *       (색 리터럴·비교 방향·fallback 분기는 ★전부 제품 코드가 정한다).
 *   ⛔import 가 늘면 이 스텁 명부가 «못 찾음»으로 빨개진다(조용히 안 지나간다).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL = 'js/blocks/canvas-block.js';
const SRC = readSrc(path.join(__dirname, '../../', REL));

function stubCopy(relSrc, replacements, tag) {
  let src = readSrc(path.join(__dirname, '../../', relSrc));
  for (const [from, to] of replacements) {
    const prev = src;
    src = src.replace(from, to);
    assert.notEqual(src, prev, `${relSrc} 에서 다음을 못 찾음 — 리팩터링됐나?\n${from}`);
  }
  const out = path.join(os.tmpdir(), `${tag}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.mjs`);
  fs.writeFileSync(out, src);
  return pathToFileURL(out).href;
}

function makeEl(tag) {
  return { tagName: tag, className: '', dataset: {}, style: {}, textContent: '', children: [],
    appendChild(c) { this.children.push(c); return c; } };
}

/** 주석을 벗긴 코드 — ★주석에 적은 예시가 측정값이 되지 않게(261007 교훈). */
function codeOnly(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
/** 함수 하나의 몸통 — 최상위 `function 이름` 부터 최상위 `}` 까지. */
function bodyOf(name) {
  const m = new RegExp(`\\nfunction ${name}\\b[\\s\\S]*?\\n\\}\\n`).exec(SRC);
  assert.ok(m, `${name} 몸통을 못 찾았다 — 이름이 바뀌었나?`);
  return m[0];
}

let CVB;
before(async () => {
  const url = stubCopy(REL, [
    ["import { genId, showNoSelectionHint, insertAfterSelected, colorLuminance } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\nimport { checkerBg } from '../checker-tokens.js';",
     /* ★colorLuminance 스텁 — 「숫자꼴 글자면 그 수, 아니면 null」. 문턱 비교·색 리터럴·fallback 분기는
          ★제품 코드가 그대로 정한다(이 스텁은 «휘도를 재는 자»만 갈아낀 것이다). */
     "const checkerBg = () => ''; const genId = (p) => p + '_x'; const showNoSelectionHint = () => {}; const insertAfterSelected = () => {};"
     + " const colorLuminance = (s) => { const n = Number.parseFloat(s); return Number.isFinite(n) ? n : null; };"
     + " const bindBlock = () => {};"],
    ["import { effSectionPadX as _effSectionPadX } from './outer-pad.js';", 'const _effSectionPadX = () => 0;'],
    /* t5-16(261026) — canvas-block 이 카드 높이 자 card-limits.js 를 import 한다. 잎 모듈(값만)이라 스텁 대신 «진짜 파일»의 글을 그 자리에 싣는다(export 만 뗀다 · 값 사본 0 · .js 는 CJS 로 읽혀 URL import 가 안 된다). */
    ["import { CVB_H_MIN, CVB_H_MAX } from './card-limits.js';", fs.readFileSync(path.join(__dirname, '../../js/blocks/card-limits.js'), 'utf8').replace(/^export /gm, '')],
    ["import { lnHasLines, lnLinesHtml, lnValidateLines, lnRemark, LN_KINDS } from './line-host.js';",
     "const lnHasLines = () => false; const lnLinesHtml = () => ''; const lnValidateLines = () => null; const lnRemark = () => {}; const LN_KINDS = [];"],
  ], 'cvb-auto-text-color');
  globalThis.window = globalThis.window || globalThis;
  globalThis.document = globalThis.document || { createElement: makeEl, getElementById: () => null };
  CVB = await import(url);
});

test('T0 전제 — 실물이 export 됐고 문턱이 0.45 다', () => {
  assert.equal(typeof CVB.cvbAutoTextColor, 'function', 'cvbAutoTextColor 가 export 됐다');
  assert.equal(CVB.CVB_TEXT_LUM_DARK, 0.45, '문턱 — 이 수가 바뀌면 아래 경계값 칸의 뜻이 달라진다');
  /* ★스텁이 «살아 있는지» 먼저 본다 — 스텁이 늘 null 을 주면 T1 의 어두움·밝음 칸이
     「fallback 이 돌아온 것」과 구분되지 않는다(= 안 재고 있다). */
  assert.equal(CVB.cvbAutoTextColor('0.1', 'title', 'FB'), '#ffffff', '전제: 휘도 스텁이 수를 통과시킨다');
  assert.equal(CVB.cvbAutoTextColor('말이안되는색', 'title', 'FB'), 'FB', '전제: 휘도 스텁이 못 재면 null 을 준다');
});

test('T1 갈래 셋 — 어두움 · 밝음 · 못 잼(fallback 그대로)', () => {
  const A = CVB.cvbAutoTextColor;
  // 어두운 배경
  assert.equal(A('0.10', 'title', 'FB'), '#ffffff');
  assert.equal(A('0.10', 'desc',  'FB'), '#e0e0e0');
  // 밝은 배경
  assert.equal(A('0.90', 'title', 'FB'), '#1a1a1a');
  assert.equal(A('0.90', 'desc',  'FB'), '#555555');
  // ★못 잼 — fallback 을 ★그대로 돌려준다(⛔손으로 박은 색이 아니다). 이 칸이 1020t1c 의 심장이다.
  for (const bg of ['linear-gradient(180deg,#333,#000)', 'transparent', 'navy', 'var(--ui-accent-primary)', '', 'initial']) {
    assert.equal(A(bg, 'title', '#AA0001'), '#AA0001', `title — 휘도를 못 재는 "${bg}" 에서 fallback 이 와야 한다`);
    assert.equal(A(bg, 'desc',  '#AA0002'), '#AA0002', `desc — 휘도를 못 재는 "${bg}" 에서 fallback 이 와야 한다`);
  }
  // ★kind 가 'title' 이 아니면 설명 쪽이다(제품이 'desc' 만 넘기지만 갈림의 방향을 못박는다)
  assert.equal(A('0.10', 'desc', 'FB'), '#e0e0e0');
});

test('T1b 경계값 — 문턱 ★미만만 어둡다(0.45 는 밝은 쪽)', () => {
  const A = CVB.cvbAutoTextColor, T = CVB.CVB_TEXT_LUM_DARK;
  assert.equal(A(String(T - 0.0001), 'title', 'FB'), '#ffffff', '문턱 바로 아래 = 어두움');
  assert.equal(A(String(T),          'title', 'FB'), '#1a1a1a', '★문턱 그 값 = 밝음(미만 비교)');
  assert.equal(A(String(T + 0.0001), 'title', 'FB'), '#1a1a1a', '문턱 바로 위 = 밝음');
});

test('T2 ★주범 — _cvbBeginAdd 가 fallback 으로 «밴드 색»을 넘긴다', () => {
  const body = codeOnly(bodyOf('_cvbBeginAdd'));
  // ⒜ 밴드 색을 ★블럭 dataset.textBg 에서 뽑는다
  assert.match(body, /dataset\.textBg/, '밴드 배경(dataset.textBg)을 읽어야 한다 — 안 읽으면 fallback 을 지어낼 수밖에 없다');
  // ⒝ 영역 배경으로 자동색을 고르고, ★셋째 인자가 밴드 색 변수다
  assert.match(body, /cvbAutoTextColor\(\s*area\.style\.backgroundColor[^,]*,[^,]*,\s*_band\s*\)/,
    '영역 배경의 자동색을 고를 때 셋째 인자(fallback)가 _band 여야 한다');
  // ⒞ ★반례 짝 — 「손으로 박은 색이 없다」를 ★수로 못박는다(처방 전 2건이었다)
  const lit1a = (body.match(/'#1a1a1a'/g) || []).length;
  const lit55 = (body.match(/'#555555'/g) || []).length;
  assert.equal(lit1a, 1, "'#1a1a1a' 는 ★밴드 기본색 ★한 자리뿐이다(처방 전 2건 — 둘째가 자동색의 fallback 이었다)");
  assert.equal(lit55, 1, "'#555555' 는 ★밴드 기본색 ★한 자리뿐이다(처방 전 2건)");
  assert.equal((body.match(/'#ffffff'/g) || []).length, 0, "제목 흰색은 ★cvbAutoTextColor 안에서만 나온다(처방 전 1건)");
  assert.equal((body.match(/'#e0e0e0'/g) || []).length, 0, "설명 밝은색도 ★그 함수 안에서만(처방 전 1건)");
});

test('T3 ★구조 — 색 식이 한 벌이다(사본이 늘면 빨강)', () => {
  const code = codeOnly(SRC);
  assert.equal((code.match(/colorLuminance\(/g) || []).length, 1,
    '★colorLuminance 를 부르는 자리는 cvbAutoTextColor ★하나다(처방 전 4벌 — 밴드·칸·슬롯·줄추가)');
  assert.equal((code.match(/0\.45/g) || []).length, 1,
    '★문턱 숫자는 CVB_TEXT_LUM_DARK ★한 자리뿐이다(처방 전 8건)');
  /* ★소비자 전수 — ★실측 10건(261020, 주석 벗긴 코드에서 grep 으로 골랐다):
       정의 1 ＋ 줄추가 3(밴드 제목·밴드 설명·영역) ＋ 밴드 2 ＋ 칸 2 ＋ 슬롯 2.
     ⛔이 수가 바뀌면 「몇 개냐」로 닫지 말고 ★어느 자리가 늘거나 줄었는지 세라. */
  assert.equal((code.match(/cvbAutoTextColor\(/g) || []).length, 10,
    '★부르는 자리 10 — 정의 1 ＋ 줄추가 3 ＋ 밴드 2 ＋ 칸 2 ＋ 슬롯 2');
});
