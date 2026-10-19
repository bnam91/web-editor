/* 1020t1a-⑤ — ★«편집 중» 표식 `.editing` 의 ★명부가 ★어긋난 것을 ★표로 잠근다.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 — 2026-10-20, 「비교 블럭 더블클릭 커서」(1020t1a)를 고치다가 ★덤으로 쟀다:
 *   ★자유배치 프레임 안 비교 블럭의 ★평문 칸을 ★편집하는 ★중에 ★끌면 ★★블럭이 ★움직였다
 *   (실측 · 진짜 앱 · 헤드리스 크롬: 단위 좌표 `0px,0px → 150px,100px` = 화면 60/40px ÷ 배율 0.4).
 *   ★같은 블럭 ★안에서 갈렸다 — ★줄모드 칸(line-host 가 `.editing` 을 붙인다)은 ★안 움직이고
 *   ★평문 칸(comparison-block.js)만 ★움직였다 ⇒ ★차이는 ★`.editing` ★하나.
 *
 * ★★그런데 ★전수로 세 보니 ★`.editing` 은 ★«한 규약»이 ★아니었다 — ★소비자가 ★두 갈래다:
 *   ⒜ ★타입 ★무관 — `block.classList.contains('editing')` · CSS `:not(.editing)`.
 *      ★여기서 ★`.editing` 이 ★★«단독 가드»인 자리는 ★셋이다:
 *        · `js/block-drag.js:680`  공통 mousedown 절대배치 ★이동 드래그   ← ★사람이 보는 그것
 *        · `js/history.js:170`     `_captureSelection` — 편집 중엔 ★선택 복원을 ★안 찍는다
 *        · `css/editor-blocks.css` `:not(.editing)` ★중화 절            ← ★아웃라인 시각
 *      ⛔나머지는 ★이미 ★`contenteditable` ★OR 로 보강돼 있어 ★`.editing` 없이도 막힌다:
 *        · dragstart = `block-drag.js:515` `activeElement.contentEditable`
 *        · Delete/Backspace = `editor.js:3227` `e.target.isContentEditable`
 *      ⚠️★그래서 ★`block-drag.js:404` 의 주석 「공통 mousedown 드래그·dragstart·★삭제키 가드가
 *        이걸 본다」는 ★★지금 사실이 아니다 — ★삭제키 가드는 ★`.editing` 을 ★안 본다(아래 ⑶이 잠근다).
 *   ⒝ ★타입이 ★손으로 ★박힌 명부 — `'.text-block.editing, .label-group-block.editing'` 꼴.
 *      ★`.editing` 을 ★붙여도 ★★안 켜진다. ★이름이 ★안 적힌 블럭은 ★영영 빠진다.
 *      ⇒ ★★그리드·모달·laurel·비교가 ★「편집 중 단축키 차단」에서 ★전부 빠져 있다 = ★★별 카드(본체).
 *
 * ★★이 검사가 ★하지 않는 일(⛔「전부 잡는다」로 읽지 마라 — 선례 block-selector-roster.test.mjs ⒝ 와 같은 규율):
 *   ⒤ ★합치지 ★않는다. ⒝ 갈래 명부 ★여럿을 ★한 명부로 모으는 설계는 ★따로다(DOM 전수가 필요하다).
 *   ⒥ ★`js/block-drag.js` 는 ★★타입 가름이 ★`if (isX)` ★범위라 ★«꼴»로 못 쪼갠다 ⇒ ★이 표에서 ★뺀다.
 *      ⇒ ★거기 빠진 타입은 ★이 검사가 ★★못 잡는다. ★그래서 EDIT_FILES 를 ★손으로 박는다.
 *   ⒦ ★★«움직이나»를 ★안 잰다 — ★그건 행동 게이트의 몫이다
 *      (하네스: 레포 밖 `…/scratchpad/t1a/gate-editing.mjs` · 진짜 index.html · 헤드리스 크롬).
 *      ★이 자는 ★그 행동을 ★떠받치는 ★«소스 조건»만 잠근다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/* ★★주석을 ★걷고 재는 자 — ⛔이게 ★없으면 ★★«주석이 ★측정값»이 된다.
 *   ★실제로 밟았다(2026-10-20): 이 검사를 처음 돌릴 때 ⑷의 ★순서 단언이 ★빨개졌는데,
 *   ★까닭은 ★내가 ★제품 주석에 ★「`window.pushHistory()` ★앞이다」라고 ★적어 둔 그 글자였다
 *   ⇒ `indexOf('pushHistory')` 가 ★주석을 ★먼저 집어 ★push < off 가 됐다.
 *   ★교훈: ★«소스를 파싱하는 게이트»의 입력엔 ★산문이 섞인다 ⇒ ★★코드만 남겨 재라.
 *   ⚠️한계 — 문자열 리터럴 안의 `/*`·`//` 는 ★안 가린다. 이 파일들엔 그런 자리가 없다(지금). */
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ★«꼴» — ⛔이름으로 찾지 않는다(선례의 그 교훈). */
const EDIT_ON = /setAttribute\(\s*['"]contenteditable['"]\s*,\s*['"]true['"]\s*\)|contentEditable\s*=\s*['"]true['"]/g;
const EDIT_ADD = /classList\.add\(\s*['"]editing['"]\s*\)/g;
const count = (re, t) => (t.match(new RegExp(re.source, 'g')) || []).length;

/* ★★«편집 길을 여는 블럭 파일» 명부 — ★손으로 박는다.
 *   ⛔코드에서 «합집합»으로 구하면 ★자기를 재는 항등식이 된다(선례 ALL_SEEN 과 같은 까닭).
 *   ★블럭을 새로 만들어 더블클릭 글자 편집을 열면 ★여기에 ★손으로 더해라 — ★A1 이 그때 알려 준다. */
const EDIT_FILES = [
  'js/blocks/comparison-block.js',
  'js/blocks/chat-block.js',
  'js/blocks/banner02-block.js',
  'js/blocks/step-block.js',
  'js/blocks/canvas-block.js',
  'js/blocks/line-host.js',
  'js/sticker-select.js',
];

/* ★★«지금 이러하다» — ★편집 길은 ★여는데 ★`.editing` 을 ★안 붙이는 자리.
 *   ★★이 표가 ★줄어드는 것이 ★진척이다(⛔늘어나면 ★새 구멍이다).
 *   ⚠️파일 단위 판정이다 — 한 파일 안에 ★붙이는 길과 ★안 붙이는 길이 ★섞이면 'PARTIAL' 로 적는다. */
const ADD_GAPS = [
  'js/blocks/chat-block.js',      // 보낸이 이름·본문(줄 모드 아닌 길) — ⛔안 쟀다
  'js/blocks/banner02-block.js',  // ⛔안 쟀다
  'js/blocks/step-block.js',      // ⛔안 쟀다
  'js/sticker-select.js',         // block-drag.js 주석은 「스티커는 bindBlock 을 안 탄다」지만 ⛔안 쟀다
  // ★1020t1a-⑤ 로 ★빠졌다: 'js/blocks/comparison-block.js' — ★재현한 뒤 ★고쳤다
  // ★line-host.js 는 ★원래 붙인다(:788) — 그래서 이 표에 없다
];

/* ★★이 자가 ★★«못 재는» 구멍 — ★수를 세는 자로는 ★안 보인다. ⛔「0건이니 없다」로 읽지 마라.
 *   ⒜ `js/blocks/canvas-block.js` — 심플카드(:328)는 붙이고 ★«층» 글자칸(:1350)은 ★안 붙인다.
 *      ★한 파일에 ★두 길이 섞여 있어 ★«add 가 1 이상»으로 ★통과한다.
 *   ⒝ `js/block-drag.js` — 타입 가름이 `if (isX)` ★범위라 ★꼴로 못 쪼갠다(머리말 ⒥).
 *   ⇒ ★둘은 ★«각각 재현한 뒤» 고치는 별 카드다. ★이 줄이 ★그 기억이다. */
const KNOWN_UNMEASURABLE = ['js/blocks/canvas-block.js', 'js/block-drag.js'];

test('⑴ 전제 — 명부의 파일이 실제로 편집 길을 연다(0이면 이 검사가 뜻을 잃는다)', () => {
  for (const f of EDIT_FILES) {
    const n = count(EDIT_ON, src(f));
    assert.ok(n > 0, `★${f} 에서 «편집 켜는 자리»를 0개 찾았다 — ★꼴이 바뀌었거나 파일이 옮겨졌다(EDIT_ON 정규식을 다시 보라)`);
  }
});

test('⑵ 편집 길을 여는데 `.editing` add 가 ★0건인 파일 = ADD_GAPS 와 ★정확히 같다', () => {
  const now = EDIT_FILES.filter(f => count(EDIT_ADD, src(f)) === 0).sort();
  assert.deepEqual(now, [...ADD_GAPS].sort(),
    `\n★표가 달라졌다.\n  지금: ${JSON.stringify(now)}\n  적힌 것: ${JSON.stringify([...ADD_GAPS].sort())}\n` +
    '  ★줄었으면 ★고친 것이다 — ★ADD_GAPS 에서 그 줄을 지우고 ★무엇을 쟀는지 머리말에 적어라.\n' +
    '  ★늘었으면 ★새 구멍이다 — ★행동으로 재서(편집 중 드래그가 움직이나) ★고치거나, 못 고칠 까닭을 적어라.\n' +
    '  ⚠️이 자는 ★«파일에 add 가 한 건이라도 있나»만 본다 — ★KNOWN_UNMEASURABLE 의 둘은 ★못 잡는다.');
  /* ★전제 — ADD_GAPS 가 ★비어 있지 않아야 이 단언이 뜻을 갖는다(비면 「전부 고쳤다」는 뜻이므로 그때는 이 줄을 지워라) */
  assert.ok(ADD_GAPS.length > 0, '★ADD_GAPS 가 비었다 — 전부 고쳤으면 이 검사와 머리말을 같이 닫아라');
  /* ★못 재는 둘은 ★명부에 ★있기만 하면 된다 — ★이 자가 그 둘을 ★재고 있다고 ★착각하지 않게 */
  for (const f of KNOWN_UNMEASURABLE) assert.ok(EDIT_FILES.includes(f) || f === 'js/block-drag.js',
    `★${f} 이 어디에도 안 적혔다 — ★못 재는 구멍의 기억이 사라진다`);
});

test('⑶ `.editing` 을 ★타입으로 박은 명부들 — 비교·그리드·laurel 이 ★빠져 있음을 ★기록한다', () => {
  const EDITOR = src('js/editor.js');
  const ALT = src('js/alt-click-layer-select.js');
  /* 명부 = `.editing` 과 `-block.` 을 같이 품은 문자열 리터럴 */
  const ROS = /['"]([^'"]*-block\.editing[^'"]*)['"]/g;
  const rosters = new Set();
  for (const t of [EDITOR, ALT]) for (const m of t.matchAll(ROS)) rosters.add(m[1]);
  assert.ok(rosters.size >= 5,
    `★명부를 ${rosters.size}개 찾았다 — ★5개 이상이어야 이 검사가 뜻을 갖는다(꼴이 깨졌는지 보라). 찾은 것: ${[...rosters].join(' | ')}`);
  /* ★이 셋은 ★편집 길이 있는데 ★어느 명부에도 ★없다 — ★「지금 이러하다」의 기록 */
  const MISSING_EVERYWHERE = ['comparison-block', 'grid-block', 'laurel-block'];
  const union = new Set();
  for (const r of rosters) for (const m of r.matchAll(/\.([a-z0-9-]+-block)\.editing/g)) union.add(m[1]);
  for (const t of MISSING_EVERYWHERE) {
    assert.ok(!union.has(t),
      `★${t} 이 ★타입 명부에 ★들어왔다 — ★좋은 일이다. ★그러면 ★이 줄(MISSING_EVERYWHERE)에서 빼고, ` +
      '★「편집 중 단축키 차단」이 그 블럭에서 실제로 도는지 ★행동으로 재라.');
  }
  /* ⛔삭제키 가드가 `.editing` 을 본다는 주석은 ★사실이 아니다 — editor.js 에 그 술어가 ★0건임을 잠근다 */
  assert.equal(count(/classList\.contains\(\s*['"]editing['"]\s*\)/, EDITOR), 0,
    '★editor.js 에 `classList.contains(\'editing\')` 가 생겼다 — ★그러면 삭제키·단축키 가드의 뜻이 바뀐다. ' +
    '★block-drag.js:404 의 주석과 ★이 검사 머리말 ⒜ 를 ★같이 고쳐라.');
});

test('⑷ 비교 — 짝(켜기/끄기)이 ★두 편집 길에 ★다 있고, ★끄기가 ★pushHistory 보다 ★앞이다', () => {
  const t = src('js/blocks/comparison-block.js');
  /* 함수 본문을 ★꼴로 떠낸다 — ⛔줄 번호로 가리키지 않는다(주석 한 줄에 전부 밀린다) */
  const bodyOf = (name) => {
    const i = t.indexOf(`function ${name}(`);
    assert.ok(i >= 0, `★${name} 을 못 찾았다 — 이름이 바뀌었으면 ★이 검사도 같이 고쳐라`);
    const j = t.indexOf('\nfunction ', i + 1);
    return t.slice(i, j < 0 ? t.length : j);
  };
  for (const fn of ['_editableTitle', '_editableRow']) {
    const b = codeOnly(bodyOf(fn));   // ★주석을 걷고 — 위 codeOnly 머리말의 그 까닭
    assert.ok(/_cmpEditingOn\(block\)/.test(b), `★${fn}: 편집에 들어갈 때 «.editing» 을 ★안 켠다 ⇒ 편집 중 드래그로 블럭이 움직인다`);
    const off = b.indexOf('_cmpEditingOff(block)');
    const push = b.indexOf('pushHistory');
    assert.ok(off >= 0, `★${fn}: 편집을 나올 때 «.editing» 을 ★안 끈다 ⇒ ★편집이 끝났는데 드래그가 ★영영 안 된다`);
    assert.ok(push >= 0, `★${fn}: pushHistory 가 없다 — ★이 검사의 전제가 깨졌다(그 함수가 이력을 안 찍는다면 아래 순서 단언은 뜻이 없다)`);
    assert.ok(off < push,
      `★${fn}: ★끄기가 ★pushHistory ★뒤에 있다(off=${off} push=${push}) ⇒ ★js/history.js:170 «_captureSelection» 이 ` +
      '`canvas.querySelector(\'.editing\')` 를 보고 ★«선택 복원»을 null 로 돌린다 ⇒ ★★⌘Z 뒤 선택이 안 돌아온다(조용한 회귀).');
  }
  /* 끄기는 ★무조건 remove 가 아니다 — 살아 있는 편집칸이 있으면 ★안 끈다(편집 길이 둘이다) */
  const offBody = codeOnly(t.slice(t.indexOf('function _cmpEditingOff('), t.indexOf('function _editableTitle(')));
  assert.ok(/querySelector\(\s*['"]\[contenteditable="true"\]['"]\s*\)/.test(offBody),
    '★_cmpEditingOff 가 ★«살아 있는 contenteditable» 을 ★안 본다 ⇒ 한쪽 칸의 blur 가 ★다른 칸의 편집 표식을 끈다. ' +
    '★선례: js/blocks/canvas-block.js `_cvbHealEditing` · js/block-drag.js 의 같은 세 줄.');
  /* 자가치유는 ★다시 그린 ★뒤여야 한다 — 시작 자리면 아직 살아 있는 칸을 보고 안 걷어 고착된다 */
  /* ⚠️`export function` 이 아니다 — 이 파일은 ★아래에서 `export { … }` 로 내보낸다(실측). ★꼴을 맞춰 집는다. */
  const rStart = t.indexOf('function renderComparison(');
  assert.ok(rStart >= 0, '★renderComparison 선언을 못 찾았다 — 이름/꼴이 바뀌면 ★이 검사도 같이 고쳐라');
  const rEnd = t.indexOf('function _cmpLinesApproxH(', rStart);
  assert.ok(rEnd > rStart, '★renderComparison 뒤 경계(_cmpLinesApproxH)를 못 찾았다 — ★경계를 다시 잡아라');
  const render = codeOnly(t.slice(rStart, rEnd));
  const healAt = render.indexOf('_cmpEditingOff(block)');
  const scaleAt = render.indexOf('applyScale();');
  assert.ok(healAt > 0 && scaleAt > 0 && healAt > scaleAt,
    `★renderComparison 의 자가치유가 ★applyScale 뒤가 아니다(heal=${healAt} scale=${scaleAt}) — ` +
    '★다시 그리기 «전»에 걷으면 ★아직 살아 있는 칸을 보고 ★안 걷어 `.editing` 이 고착된다.');
});

test('⑸ 비교 — CSS 아웃라인 중화 명부에 `.comparison-block.selected.editing` 이 ★있다', () => {
  const css = src('css/editor-blocks.css');
  /* `outline-color: transparent` 를 주는 그 규칙 ★한 덩이를 떠낸다(⛔파일 전체 포함검사로 닫지 않는다) */
  const m = /((?:\.[a-z0-9-]+\.selected\.editing\s*,\s*(?:\/\*[\s\S]*?\*\/\s*)?)+\.[a-z0-9-]+\.selected\.editing)\s*\{\s*outline-color:\s*transparent;?\s*\}/.exec(css);
  assert.ok(m, '★`…selected.editing { outline-color: transparent }` 규칙을 ★못 찾았다 — 규칙이 옮겨졌으면 ★이 검사도 같이 고쳐라');
  const members = [...m[1].matchAll(/\.([a-z0-9-]+)\.selected\.editing/g)].map(x => x[1]);
  assert.ok(members.includes('comparison-block'),
    `★명부에 comparison-block 이 없다(지금: ${members.join(' · ')}) ⇒ ★편집 중 ★파란 테두리가 ★새로 생긴다. ` +
    '★실측(2026-10-20): `.editing` 없을 때 `solid 2px rgba(0,0,0,0)` → 붙이면 `solid 2px rgb(45,111,232)`. ' +
    '★위 css/editor-blocks.css:383 의 `:not(.editing)` 중화 절이 풀리기 때문이다.');
  /* ★전제 — 그 규칙이 ★진짜 여럿을 품는 명부다(혼자면 위 단언이 항등식에 가까워진다) */
  assert.ok(members.length >= 3, `★명부 원소가 ${members.length}개 — 3개 이상이어야 «명부»다(지금: ${members.join(' · ')})`);
});
