/* grid-nested-inline-edit.test.mjs — 중첩(duo) «안»의 줄을 더블클릭으로 고친다. (현빈 0927 실기 지적)
 *
 * ★★무엇이 있었나 — 현빈: 「나란히 두 칸으로 두기 줄은 추가가 되는데, ★더블클릭 후 입력이 안 되네」.
 *   ⇒ 재 보니 중첩 «안» 줄은 `data-line` 을 ★안 가진다(속성은 data-r·data-c·data-nroot·data-npath 뿐).
 *     인라인 편집 판정 `_gridEditable` 은 `closest('[data-line]')` 로 찾으므로 그 줄을 못 집는다
 *     («품은 duo 줄»을 집거나 null 이 된다). ⇒ 더블클릭이 «아무 일도 안 했다».
 *
 * ★어떻게 고쳤나 — ⛔둘 다 «안 하는» 길을 골랐다:
 *   ⛔`_gridEditable` 을 넓히지 않는다 — block-drag.js 가 「넓히면 이미지/갭 줄에 contenteditable 이
 *     붙는 부작용」이라고 «두 번» 못 박아 뒀다.
 *   ⛔중첩 안 줄에 `data-line` 을 찍지 않는다 — grid-block.js 가 「그 이름의 뜻이 바뀐다」고 적어 뒀고
 *     세는 자(두 꼴)까지 남겨 뒀다.
 *   ⇒ ★«형제 가지»를 세운다 — 빈 이미지 슬롯·이미지 프레임이 이미 쓰는 그 패턴. 먼저 집고 return.
 *   ⇒ 커밋은 ★T-220 ① 이 낸 쓰기 길(`patchCell{lineIndex, np}`)을 그대로 쓴다.
 *
 * ★무엇을 잠그나
 *   C1  ★더블클릭에 «중첩 가지»가 있고 `_gridEditable` «앞»이다(뒤면 영영 안 닿는다)
 *   C2  ★`_gridBeginEdit` 이 np 를 들고 가 «패널»과 «커밋 주소»에 싣는다
 *   C3  ★★`_gridEndEdit` 이 np 가 «있을 때만» patchCell 에 싣는다 — 실물을 돌려 잰다
 *   C4  ⛔`_gridEditable` 을 «안 넓혔다»(그 경고가 산 채로 있다)
 *   N1  음성대조 — 중첩 가지를 떼면 C1 이 빨개진다
 *
 * 실행: node --test tests/unit/grid-nested-inline-edit.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const SRC = read('js/block-drag.js');

/** 함수 «전체»를 중괄호 균형으로 떠낸다 — 이 저장소의 공통 부품과 같은 꼴. */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  assert.ok(m, '함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

test('C1 ★중첩 가지가 있고 `_gridEditable` «앞»이다 — 뒤면 영영 안 닿는다', () => {
  const code = stripComments(SRC);
  const iNest = code.indexOf("closest('[data-r][data-c][data-nroot][data-npath]')");
  const iEdit = code.indexOf('const hit = _gridEditable(atPoint)');
  assert.ok(iNest >= 0, '★★중첩 가지가 없다 — 중첩 안 줄은 더블클릭해도 아무 일이 안 일어난다');
  assert.ok(iEdit >= 0, '_gridEditable 호출부가 사라졌다 — 이 검사는 «안 재고» 있다');
  assert.ok(iNest < iEdit,
    '★중첩 가지가 _gridEditable «뒤»다 — 그 술어가 먼저 null 을 내고 return 하므로 여기는 영영 안 닿는다');
  /* ★그 가지가 «글자를 담는 줄»만 받는지 — host 를 세우고 그것이 없으면 떨어져야 한다. */
  const branch = code.slice(iNest, iEdit);
  assert.match(branch, /grd-line/, '★host 규약(.grd-line)을 안 쓴다 — _gridEditable 과 가름이 갈린다');
  assert.match(branch, /_gridBeginEdit\(\{[^}]*np[^}]*\}/,
    '★_gridBeginEdit 에 np 를 안 넘긴다 — 커밋이 «바깥 줄»을 덮어쓴다');
});

test('C2 ★`_gridBeginEdit` 이 np 를 «패널»과 «커밋 주소»에 싣는다', () => {
  const fn = stripComments(extractFn(SRC, '_gridBeginEdit'));
  assert.match(fn, /const \{ block, host, r, c, li, np \} = hit;/, '★np 를 받지 않는다');
  assert.match(fn, /showGridProperties\?\.\(block, np \?/, '★패널에 np 를 안 넘긴다 — 우측 패널이 «바깥 줄»을 띄운다');
  assert.match(fn, /const addr = np \?/, '★커밋 주소에 np 를 안 싣는다');
});

/* ★허용목록 «표식» — ⛔내용을 베끼지 않는다. ★「넘겼나」만 재는 자다. */
const OPTS_MARK = Object.freeze({ __optsMark: 'sz7' });

/** 실물 `_gridEndEdit` 을 가짜 이웃으로 돌린다. @returns 보낸 patchCell */
function runEndEdit(addr, text, before) {
  const sent = [];
  const host = {
    _attrs: { contenteditable: 'true' },
    getAttribute(k) { return this._attrs[k]; },
    setAttribute(k, v) { this._attrs[k] = v; },
    removeAttribute(k) { delete this._attrs[k]; },
    textContent: text,
    _gridBefore: before,
    /* ★부분 서식(수지⑦ 2026-10-08) — `_gridEndEdit` 이 ★HTML 쪽도 읽고 견준다.
       ★이 장면은 ★평문뿐이다 ⇒ `textHtml` 은 ★`''` 로 나가고 ★모델 입구가 ★키를 지운다. */
    innerHTML: text,
    _gridBeforeHtml: before,
  };
  const block = { id: 'blk1', classList: { remove() {}, add() {} } };
  const scope = {
    window: { updateGridBlock: (id, partial) => { sent.push(partial); return { ok: true }; }, showToast: () => {} },
    _gridReadText: (h) => h.textContent,
    _gridReadHtml: (h) => h.innerHTML || '',
    /* ⛔판정자를 ★베껴 적지 ★않는다 — ★베끼면 ★명부가 둘이 되고 ★허용목록이 갈려도 ★여기가 ★안 빨개진다.
       ★실물을 ★정적 import 할 수도 ★없다: `sanitize-rich-text.js` 는 ★`.js` 인데 ★ESM 문법이라
         ★Node 가 ★CJS 로 읽어 ★`Named export not found` 로 ★죽는다(★실측 — 그래서 ★이 레포의
         ★그리드 하네스들이 ★전부 ★`.mjs` 사본을 ★떠서 ★올린다).
       ⇒ ★이 장면은 ★평문 전용이다. ★그 ★전제를 ★이 자리에서 ★단언한다 —
         ★서식이 들어오면 ★조용히 false 를 내지 ★않고 ★크게 운다(⛔거짓 통과 금지).
       ★서식 장면을 ★더하려면 ★실물을 ★`.mjs` 사본으로 올려 ★여기 꽂아라. */
    /* ★★커밋 경로가 ★허용목록을 ★«넘기는가»를 ★이 자리에서 ★같이 잰다(수지⑦ 2026-10-08).
       ⛔목록 ★내용을 ★베끼지 ★않는다 — ★«표식»을 ★넣고 ★그 표식이 ★판정자까지 ★닿는지만 본다.
       ★그러면 ★`_gridEndEdit` 이 ★opts 를 ★빼먹는 날 ★이 검사가 ★빨개진다
         (★빼먹으면 ★`span.tb-hl` 이 ★서식으로 ★안 보여 ★형광펜이 ★커밋되지 않는다). */
    GRID_RICH_TEXT_OPTS: OPTS_MARK,
    richTextHasFormatting: (html, opts) => {
      assert.equal(opts, OPTS_MARK,
        '★★커밋 경로가 ★허용목록(GRID_RICH_TEXT_OPTS)을 ★판정자에 ★안 넘겼다 — '
        + '★그러면 `span.tb-hl`·`span.tb-dot` 이 ★«서식»으로 ★안 보여 ★형광펜·점이 ★커밋되지 않는다');
      /* ★가름은 ★«마크업이 있나» ★하나뿐이다 — ⛔실물의 판정 규칙(어느 태그 · style 달린 span)을
         ★베끼지 ★않는다. ★평문이면 ★서식이 ★없는 것이 ★자명하고, ★마크업이 보이면 ★이 장면이
         ★판정할 자격이 ★없으므로 ★크게 운다. */
      if (/[<>]/.test(String(html || ''))) {
        throw new Error('★이 장면은 «평문 전용»이다 — 마크업이 들어왔다. 실물 판정자를 .mjs 사본으로 올려 꽂아라: ' + html);
      }
      return false;
    },
  };
  const names = Object.keys(scope);
  const fn = new Function(...names, `${extractFn(SRC, '_gridEndEdit')}; return _gridEndEdit;`)(...names.map(n => scope[n]));
  fn(block, host, addr);
  return sent;
}

test('C3 ★★np 가 «있을 때만» patchCell 에 실린다 — 실물을 돌려 잰다', () => {
  const nested = runEndEdit({ r: 1, c: 1, li: 2, np: '0.0' }, '새글자', '옛글자');
  assert.equal(nested.length, 1, '★중첩 줄인데 커밋이 안 나갔다');
  assert.deepEqual(nested[0].patchCell, { r: 1, c: 1, lineIndex: 2, np: '0.0', text: '새글자', textHtml: '' });

  const outer = runEndEdit({ r: 0, c: 0, li: 1 }, '새글자', '옛글자');
  assert.equal(outer.length, 1, '★바깥 줄 커밋이 안 나갔다');
  assert.deepEqual(outer[0].patchCell, { r: 0, c: 0, lineIndex: 1, text: '새글자', textHtml: '' });
  assert.ok(!('np' in outer[0].patchCell),
    '★★바깥 줄인데 np 를 실었다 — 모델 입구가 「np 는 lineIndex 와 같이 와야 한다」를 다시 재게 된다');

  /* ★안 바뀌었으면 «아무것도» 안 보낸다(옛 규약 그대로 — 빈 이력이 안 쌓인다). */
  assert.deepEqual(runEndEdit({ r: 1, c: 1, li: 2, np: '0.0' }, '같음', '같음'), []);
});

test('C4 ⛔`_gridEditable` 을 «안 넓혔다» — 그 경고가 산 채로 있다', () => {
  const fn = stripComments(extractFn(SRC, '_gridEditable'));
  assert.match(fn, /closest\('\[data-line\]'\)/, '★_gridEditable 의 셀렉터가 바뀌었다');
  assert.ok(!/data-npath/.test(fn),
    '★★_gridEditable 이 중첩까지 넓혀졌다 — 이미지/갭 줄에 contenteditable 이 붙는 부작용이 그 경고다');
  /* ★경고 «문장»도 지킨다 — 다음 사람이 「이제 필요 없네」로 지우지 못하게. */
  assert.match(SRC, /_gridEditable` 을 넓히지 «않는다»/,
    '★그 경고가 사라졌다 — 왜 형제 가지로 풀었는지가 기록에서 없어진다');
});

test('N1 ★음성대조 — 중첩 가지를 떼면 C1 이 빨개진다', () => {
  const ANCHOR = "closest('[data-r][data-c][data-nroot][data-npath]')";
  /* ★★이 닻은 «두 곳»에 있다 — ⑴클릭 «선택» 판정 `_gridAddrAt` ⑵오늘 세운 더블클릭 «편집» 가지.
     ⛔첫 판은 `replace`(첫 하나만)를 써서 «떼었는데도 남아» 빨개졌다. 그 빨강이 ★「같은 셀렉터가
       둘이다」를 알려 줬다 — 둘은 «다른 일»(선택 / 편집)이고 우연히 같은 주소를 본다. */
  const n = SRC.split(ANCHOR).length - 1;
  assert.equal(n, 2,
    `★그 셀렉터가 ${n} 곳이다 — 둘이어야 한다(선택 판정 _gridAddrAt ＋ 더블클릭 편집 가지). 수가 바뀌었으면 어느 쪽이 늘고 줄었는지 먼저 세라`);
  const mutated = stripComments(SRC.split(ANCHOR).join("closest('[data-never-matches]')"));
  assert.equal(mutated.indexOf(ANCHOR), -1, '★변이가 안 먹었다 — 이 음성대조는 «안 재고» 있다');
});
