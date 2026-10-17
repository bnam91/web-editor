/* U-Q1012 — 인용구(Quote) 1012t1 H1~H6 지킴이. (2026-10-12, 현빈 지시)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리 인자) 금지 — Node 24 에서 한 개도 안 돌고 「작은 실패」로 보인다.
 *
 * ★규율 — 「입력이 살아 있다」를 «먼저» 단언한다(훑는 목록이 비면 뒤의 검사가 0바퀴로 자기통과한다).
 * ⚠️이 파일은 «소스 문자열»을 단언한다. 행위 쪽은 tests/dom/quote-block.dom.spec.js Q21·Q22 가 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
/* ⛔주석 걷어내기는 «공용 부품»만 쓴다 — 자기 벌을 만들면 S-6(strip-comments-shared)가 빨강. */
const { stripCommentsTA, templateBalanced, stripHtmlComments } = require('./_strip-comments.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const F_HTML = 'index.html';
const F_PROP = 'js/props/prop-quote.js';
const F_BLK = 'js/blocks/quote-block.js';

function menuBody(html, id) {
  const at = html.indexOf(`id="${id}"`);
  assert.ok(at >= 0, `메뉴를 못 찾았다: #${id}`);
  const end = html.indexOf('</div>', at);
  assert.ok(end > at, `메뉴가 안 닫힌다: #${id}`);
  return html.slice(at, end);
}

/** prop-quote.js 의 «코드만» — 주석(⚰️ 되살리는 법이 낱말을 적는다)을 걷고, 걷기가 믿을 만한지 전제로 건다. */
function propCode() {
  const raw = read(F_PROP);
  assert.ok(templateBalanced(raw), 'prop-quote.js 의 템플릿 균형이 깨졌다 — 주석 걷기를 못 믿는다');
  const code = stripCommentsTA(raw);
  assert.ok(code.includes('showQuoteProperties'), '입력이 죽었다 — 코드 본문이 안 남았다');
  return code;
}

/* T-H1 — Quote 가 «텍스트» 메뉴 안이고 닫는 인자도 fp-text-dropdown 이다.
   되돌리면 빨강: 줄을 컴포넌트 메뉴로 되돌리거나 닫는 인자만 fp-component-dropdown 으로 두면. */
test('T-H1 Quote 가 #fp-text-menu 안이고, 닫는 인자도 fp-text-dropdown 이다', () => {
  const html = read(F_HTML);
  const text = stripHtmlComments(menuBody(html, 'fp-text-menu'));
  const comp = stripHtmlComments(menuBody(html, 'fp-component-menu'));
  const textItems = (text.match(/fp-menu-item/g) || []).length;
  const compItems = (comp.match(/fp-menu-item/g) || []).length;
  assert.ok(textItems >= 8, `텍스트 메뉴 항목이 안 잡혔다 (${textItems}개) — 아래 단언이 0바퀴로 자기통과한다`);
  assert.ok(compItems >= 5, `컴포넌트 메뉴 항목이 안 잡혔다 (${compItems}개)`);
  assert.ok(/addQuoteBlock\(\)/.test(text), 'addQuoteBlock 이 #fp-text-menu 안에 없다');
  assert.equal((comp.match(/addQuoteBlock/g) || []).length, 0,
    'addQuoteBlock 이 아직 #fp-component-menu 에 남아 있다 — 옮긴 게 아니라 복사했다');
  const closer = (text.match(/onclick="addQuoteBlock\(\);toggleFpDropdown\('([^']+)'\)"/) || [])[1];
  assert.equal(closer, 'fp-text-dropdown',
    `Quote 버튼이 닫으라는 드롭다운이 '${closer}' 이다 — 자기 메뉴('fp-text-dropdown')를 닫아야 한다`);
});

/* T-H6 — 「＋ 블럭 넣기 (인용구 밑)」 select 가 패널 코드에서 걷혔다. 입구 함수·명부는 살아 있다.
   되돌리면 빨강: qt-kid-add-kind / addQuoteChild 호출을 한 줄이라도 되살리면. */
test('T-H6 prop-quote.js 코드에 qt-kid-add-kind·addQuoteChild·QUOTE_CHILD_KINDS 가 0건이고, 입구 함수는 block-factory 에 산다', () => {
  const code = propCode();
  for (const needle of ['qt-kid-add-kind', 'addQuoteChild', 'QUOTE_CHILD_KINDS', 'qt-kids-section']) {
    assert.equal(code.split(needle).length - 1, 0, `${needle} 가 prop-quote.js 코드에 남아 있다`);
  }
  const fac = read('js/block-factory.js');
  assert.ok(/function addQuoteChild\(/.test(fac) || /addQuoteChild\s*=/.test(fac), 'addQuoteChild 정의가 사라졌다 — 자식 있는 저장본이 깨진다');
  assert.ok(/QUOTE_CHILD_KINDS/.test(fac), 'QUOTE_CHILD_KINDS 명부가 사라졌다');
});

/* T-H2 — 설명 문구 둘(「글 양옆에 부호가 섭니다」 · 「한 줄 꼴에서는 부호가 한 쌍」)과 #qt-lines-hint 가 코드에서 걷혔다.
   ⚠️2026-10-17 1017t1a1 이 「부호만 위아래로…」도 지웠다 — 이 단언을 뒤집는다(T-H7 이 그 교체 단언을 잇는다).
   되돌리면 빨강: 그 마크업을 한 줄이라도 되살리면. */
test('T-H2 prop-quote.js 코드에 삭제한 두 문장·qt-lines-hint 가 0건이다', () => {
  const code = propCode();
  for (const needle of ['글 양옆에 부호가', '한 줄 꼴에서는', 'qt-lines-hint']) {
    assert.equal(code.split(needle).length - 1, 0, `${needle} 가 prop-quote.js 코드에 남아 있다`);
  }
});

/* T-H7 — 1017t1a1: 「부호만 위아래로…」(1012t1H2 가 남겨 두었던 안내)도 이번에 지웠다.
   ⛔다른 prop-hint 를 쓸어가지 마라 — 스택 전용 안내(「세로 정렬은 스택에서 쓰지 않습니다…」, :233 선례)는 ★산다.
   양성: 지운 문장이 0건.
   음성: ⑴ 남긴 문장은 1건 생존 ⑵ 이 파일의 살아 있는 prop-hint 렌더 자리가 정확히 1(=그 남긴 것 하나)
         ⑶ 입력 전제(0바퀴 자기통과 방지, :39 와 같은 자) */
test('T-H7 prop-quote.js 코드에 「부호만 위아래로…」가 0건이고, 남긴 안내(세로 정렬)만 1건 산다', () => {
  const code = propCode();
  assert.equal(code.split('부호만 위아래로 밀립니다').length - 1, 0,
    '1017t1a1 이 지운 안내가 아직 코드에 있다');
  assert.equal(code.split('세로 정렬').length - 1 >= 1 && code.split('스택에서 쓰지 않습니다').length - 1 >= 1, true,
    '★남기기로 한 안내(스택 전용 세로 정렬)가 사라졌다 — 너무 많이 지웠다');
  const hintCount = code.split('class="prop-hint').length - 1;
  assert.equal(hintCount, 1, `prop-quote.js 안 살아 있는 prop-hint 가 1 이어야 한다(남은 것 하나). 잰 값 ${hintCount}`);
});

/* T-H5 — 글자색(qt-textcol)이 «Fill» 절 안, Typography 절 «뒤»에 있고, 「글」 절·「글자 색」 라벨은 0건이다.
   되돌리면 빨강: Fill 절을 Typography 앞으로 옮기거나 「글」 절을 되살리면. */
test('T-H5 prop-quote.js 의 Fill 절이 Typography 뒤에서 qt-textcol 을 담고, 「글」 절은 없다', () => {
  const code = propCode();
  const iTypo = code.indexOf('buildTypographySectionHtml({');
  const iFill = code.indexOf('prop-section-title">Fill<');
  const iCol = code.indexOf("idPrefix: 'qt-textcol'");
  assert.ok(iTypo > 0 && iFill > 0 && iCol > 0, `입력이 죽었다: typo ${iTypo} fill ${iFill} col ${iCol}`);
  assert.ok(iFill > iTypo, 'Fill 절이 Typography 절 앞에 있다 — 텍스트블럭은 Typography 바로 다음이다');
  assert.ok(iCol > iFill, 'qt-textcol 칸이 Fill 절 밖(앞)에 있다');
  assert.equal(code.split('prop-section-title">글<').length - 1, 0, '「글」 절이 되살아났다');
  assert.equal(code.split('>글자 색<').length - 1, 0, '라벨이 「글자 색」(띄어쓰기)로 돌아갔다 — 텍스트블럭은 「글자색」');
  assert.ok(code.includes('<span class="prop-label">글자색</span>'), '「글자색」 라벨이 없다');
});

/* T-H4 — 「정렬」(qt-align-group) 아이콘이 'object-h'(세로 정렬 'object-v' 와 같은 칠 그림 사전)이고 'text' 가 아니다.
   되돌리면 빨강: alignBtn('object-h', …) 를 'text' 로 되돌리면. */
test('T-H4 prop-quote.js 의 정렬 버튼 셋은 alignBtn(object-h) · 세로 정렬 셋은 alignBtn(object-v) · text 계열 0', () => {
  const code = propCode();
  const nH = (code.match(/alignBtn\('object-h'/g) || []).length;
  const nV = (code.match(/alignBtn\('object-v'/g) || []).length;
  const nT = (code.match(/alignBtn\('text'/g) || []).length;
  assert.equal(nV, 3, `입력이 죽었다 — 세로 정렬 alignBtn 이 ${nV}개(기대 3)`);
  assert.equal(nH, 3, `정렬 alignBtn('object-h') 이 ${nH}개(기대 3)`);
  assert.equal(nT, 0, `alignBtn('text') 가 ${nT}건 남아 있다 — 정렬 아이콘이 선 4줄로 돌아갔다`);
});

/* T-H3 — 간격 한도 표가 200 이고 패널에 80 리터럴이 없다.
   되돌리면 빨강: QUOTE_LIMITS.gap.max 를 80 으로 되돌리거나 패널에 max="80" 을 박으면. */
test('T-H3 QUOTE_LIMITS.gap.max 가 200 이고 prop-quote.js 에 max="80" 리터럴이 0건', () => {
  const blk = stripCommentsTA(read(F_BLK));
  const at = blk.indexOf('const QUOTE_LIMITS');
  assert.ok(at >= 0, 'QUOTE_LIMITS 표를 못 찾았다');
  const tbl = blk.slice(at, blk.indexOf('});', at));
  assert.ok(/markSize:\s*\{[^}]*max:\s*200/.test(tbl), '입력이 죽었다 — 형제 한도(markSize.max 200)가 안 읽힌다');
  assert.ok(/gap:\s*\{\s*min:\s*0,\s*max:\s*200/.test(tbl), 'gap 한도가 200 이 아니다');
  assert.equal((propCode().match(/max="80"/g) || []).length, 0, 'prop-quote.js 에 max="80" 리터럴이 있다');
});
