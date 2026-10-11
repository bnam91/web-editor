/* tpl-expanded-model.test.mjs — ★★1011t1d: ★★«펴짐»의 ★★★단일 참값을 ★★구조로 ★잠근다
 *
 * ★★현빈 ★원문: 「폴더를 선태후 … 좌측을 누르면 토글이 닫히게 해줄래?」 · ★설계 = 지디 · ★고친 자 = t1bstar.
 *
 * ★★★이 파일이 ★잠그는 것 — ★★DOM spec(`tpl-tree-collapse.dom.spec.js`)이 ★★행위를 ★재고,
 *   ★★여기선 ★★★«구조»를 ★잰다. ★★★둘이 ★다른 ★이유:
 *     ★행위 검사는 ★★«지금 ★닫히나»를 ★잰다.
 *     ★★구조 검사는 ★★«내일 ★누가 ★`folderActive` 로 ★되돌려도 ★빨개지나»를 ★잰다.
 *   ⇒ ★★특히 ★★★«더하는 ★자리가 ★하나인가»는 ★★행위로 ★못 잰다 — ★★여섯 벌 ★명부여도 ★초록이다.
 *
 * ⛔⛔★★★이 파일은 ★★★주석을 ★★걷고 ★잰다. ★★까닭 — ★★★제품 주석이 ★★옛 꼴을 ★★인용한다:
 *   ★`template-browser.js` 의 ★1011t1d 머리말에 ★★`const isExpanded = folderActive;` 가
 *   ★★★«고치기 ★전은 ★이랬다»로 ★★글자 ★그대로 ★있다.
 *   ⇒ ★★안 걷으면 ★★★«옛 꼴이 ★아직 ★있다»로 ★읽혀 ★★★G1 이 ★★거짓 ★빨강이 된다.
 *   ⇒ ★★그리고 ★그 ★거꾸로도 ★있다 — ★★주석이 ★`_expandedFolders` 를 ★여러 번 ★부르니
 *     ★★★«자리 수»를 ★세는 ★G2 가 ★★거짓 ★빨강이 된다.
 *   ★★★261011 에 ★★이 레포에서 ★★★이 꼴을 ★★열 번 ★넘게 ★밟았다(★내 것 ★여럿 ＋ ★지디 ★넷).
 *   (★내 명부: ★「★주석은 ★«소스 파싱 게이트»의 ★★입력 — ★예시로 적은 ★필드명이 ★측정값이 됐다」)
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const REL = 'js/panels/template-browser.js';
const RAW = fs.readFileSync(path.join(ROOT, REL), 'utf8');
const SRC = stripComments(RAW);

test('G0 ★전제 — ★★걷기가 ★★실제로 ★★뭔가를 ★걷었나 (⛔0 이면 ★«맞다»가 ★아니라 ★«안 쟀다»다)', () => {
  assert.ok(SRC.length > 1000, `★걷은 뒤 ★소스가 ★너무 ★짧다(${SRC.length}자) — ★걷기가 ★깨졌다`);
  assert.ok(RAW.length > SRC.length,
    `★★걷기가 ★★아무것도 ★안 걷었다 — ★원문 ${RAW.length} · ★걷은 뒤 ${SRC.length}`);
  /* ★★★그리고 ★★«걷는 것이 ★★뜻이 ★있나» — ★★옛 꼴이 ★★주석에 ★★정말 ★있나.
     ⇒ ★★이 칸이 ★★★이 파일의 ★걷기 규약이 ★★«살아 있는 ★까닭»이다. ⛔없어지면 ★알려 줘야 한다. */
  const oldForm = /const isExpanded = folderActive;/;
  assert.ok(oldForm.test(RAW),
    '★★원문에 ★★옛 꼴(★`const isExpanded = folderActive;`)이 ★★없다 — ★★주석에서 ★사라졌나? '
    + '★★그러면 ★★이 파일의 ★«걷기»가 ★★더는 ★필요 없을 ★수 ★있다. ★★확인하고 ★이 칸을 ★고쳐라');
  assert.ok(!oldForm.test(SRC),
    '★★★걷은 ★뒤에도 ★옛 꼴이 ★★남았다 = ★★★주석이 ★아니라 ★★코드다 ⇒ ★★되돌아갔다');
});

test('G1 ★★★`isExpanded` 는 ★★★모델에서만 ★나온다 — ⛔`folderActive` 로 ★되돌리면 ★빨강', () => {
  const m = [...SRC.matchAll(/const\s+isExpanded\s*=\s*([^;]+);/g)];
  /* ★★★전제 — ★★한 자리여야 한다. ⛔둘이면 ★★어느 것이 ★참인지 ★모른다 */
  assert.strictEqual(m.length, 1,
    `★`+`isExpanded` + ` 를 ★정하는 자리가 ★★1 이 ★아니다(잰 값 ${m.length}) — ★★참값이 ★둘이 ★됐다`);
  const rhs = m[0][1].trim();
  assert.match(rhs, /_expandedFolders\.has\(/,
    `★★`+`isExpanded` + ` 가 ★모델을 ★안 읽는다 — ★잰 값: ${rhs}`);
  /* ★★★`folderActive ||` 를 ★★붙이면 ★★«거름인 폴더»를 ★★못 닫는다 — ★지디가 ★제 설계를 ★스스로 ★반려한 ★그 칸 */
  assert.ok(!/folderActive/.test(rhs),
    `★★★`+`folderActive` + ` 가 ★★다시 ★섞였다 — ★★그러면 ★★«거름인 ★폴더»를 ★★영영 ★못 닫는다. ★잰 값: ${rhs}`);
});

/* ★★★제목을 ★고쳤다(261011) — ★첫 꼴은 ★「★더하는 자리가 ★★딱 ★하나다」였는데
   ★★단언은 ★★`add` ★★2 를 ★걸고 ★있었다 ⇒ ★★★제목이 ★단언보다 ★★넓었다.
   ★★참값: ★★«진입 ★파생»이 ★한 자리 · ★★`add` 는 ★둘(★파생 ＋ ★클릭 토글).
   (★내 명부: ★「★검사 ★머리말이 ★단언이 ★잠근 것보다 ★넓다」 ＋ ★「★제목이 ★조건을 ★말하면 ★제목째 ★거짓이 된다」) */
test('G2 ★★«진입 파생»은 ★★한 자리 ＋ ★★`add` 는 ★★둘(★파생·클릭) — ★★명부가 ★★여섯이 ★되지 ★않게', () => {
  const adds = [...SRC.matchAll(/_expandedFolders\.add\(/g)];
  /* ★★★왜 ★★수로 ★거나 — ★★거름을 ★★재대입하는 자리가 ★★★6곳이다(★주석 걷은 뒤).
     ★★거기마다 ★`add` 하면 ★★여섯 벌 ★명부다 ⇒ ★★한 자리로 ★파생시킨 것이 ★이 설계의 ★핵이다.
     ⛔★★그 ★6 을 ★★«`= {` 한 꼴»로 ★세면 ★★★5 가 ★나온다 — ★★`= next` 를 ★놓친다(★261011 ★내 흠).
       ⇒ ★★아래 ★`filterSites` 는 ★★★넓은 꼴로 ★센다. ★★그래야 ★★이 까닭이 ★★안 썩는다. */
  assert.strictEqual(adds.length, 2,
    `★`+`_expandedFolders.add(` + ` 자리가 ★★2 가 ★아니다(잰 값 ${adds.length}) — `
    + '★★★뜻한 ★둘 = ⑴ ★`_renderBrowserTree` 의 ★«진입» 파생 ⑵ ★클릭 토글. '
    + '★★늘었으면 ★★«명부가 ★둘이 ★됐나»를 ★먼저 ★보라');

  /* ★★★그 ★«진입» 파생이 ★★정말 ★★«거름이 ★바뀌었나»로 ★가리나 */
  assert.match(SRC, /_browserFilter\.folder\s*!==\s*_expansionDecidedFor/,
    '★★«진입»을 ★가리는 ★자(★`_expansionDecidedFor` 대조)가 ★없다 — '
    + '★★그러면 ★★다시 그릴 ★때마다 ★다시 ★`add` 되어 ★★★닫기가 ★무효가 된다');
  /* ★★★그 자를 ★맞추는 ★자리가 ★★★둘이어야 한다 — ★★이것이 ★261011 ★E5 ★빨강의 ★참 까닭이다:
       ⑴ ★`_renderBrowserTree`   ⑵ ★★클릭 갈래(★★트리를 ★다시 ★안 그리므로 ★★스스로 ★맞춰야 한다)
     ⛔하나만 ★있으면 ★★클릭으로 ★접은 것이 ★★다음 ★다시 그리기에 ★★되살아난다. */
  const decided = [...SRC.matchAll(/_expansionDecidedFor\s*=\s*_browserFilter\.folder/g)].length;
  assert.strictEqual(decided, 2,
    `★`+`_expansionDecidedFor` + ` 를 ★맞추는 자리가 ★★2 가 ★아니다(잰 값 ${decided}) — `
    + '★★뜻한 ★둘 = ⑴ ★다시 그리기 ⑵ ★클릭 갈래. ★★⑵ 가 ★빠지면 ★★E5 가 ★빨개진다');

  /* ★★★모델의 ★«영역»이 ★★진짜 폴더로 ★묶였나 — ★★모델에만 ★있는 ★이름을 ★막는다(★261011 ★E2 ★빨강) */
  assert.match(SRC, /hasOwnProperty\.call\(folderMap, _browserFilter\.folder\)/,
    '★★★`folderMap` 에 ★있는 ★폴더인지 ★★안 가린다 — ★★`전체`·`즐겨찾기` 가 ★모델에 ★들어가 '
    + '★★DOM 과 ★갈린다(★실측: ★DOM [] · ★모델 ["전체"])');
  assert.match(SRC, /_expandedFolders\.delete\(f\)/,
    '★★★묵은 이름을 ★솎는 ★줄이 ★없다 — ★폴더를 ★지우면 ★모델에 ★유령이 ★남아 ★DOM 과 ★갈린다');

  /* ★★그리고 ★★거름 ★자리 수를 ★★같이 ★찍는다 — ★★이 수가 ★늘면 ★★위 설계를 ★다시 ★읽어야 한다 */
  /* ★★★«할당하는 ★모든 꼴» — ⛔`= \{` 로 ★좁히지 ★마라(★`= next` 를 ★놓친다).
     ★★★그리고 ★★★«선언»을 ★★두 쪽에서 ★똑같이 ★빼라 — ★★★첫 꼴이 ★★여기서 ★틀렸다(261011):
       ★넓은 쪽은 ★`-1` 했고 ★★좁은 쪽은 ★★안 했다 ⇒ ★★6 vs 6 ⇒ ★★★거짓 ★빨강.
       ★★`let _browserFilter = { … }` 도 ★★`= {` 꼴이라 ★★좁은 쪽에 ★★들어 있었다.
     (★내 명부: ★「★수가 ★갈리면 ★«순서»가 ★있다 — ⑴ ★둘 다 ★셌나 ⑵ ★★단위 ⑶ ★창」
       ⇒ ★★이번은 ★★★⑵ ★단위였다. ★★한쪽만 ★선언을 ★뺀 것이 ★★«단위 ★어긋남»이다.) */
  const DECL = /(?:let|const|var)\s+_browserFilter\s*=/;
  const assignAll = [...SRC.matchAll(/_browserFilter\s*=/g)];
  const braceAll = [...SRC.matchAll(/_browserFilter\s*=\s*\{/g)];
  /* ★★선언을 ★★«같은 자»로 ★가려 ★★양쪽에서 ★뺀다 */
  const isDecl = (src, i) => DECL.test(src.slice(Math.max(0, i - 12), i + 20));
  const reassign = assignAll.filter(m => !isDecl(SRC, m.index)).length;
  const reassignBrace = braceAll.filter(m => !isDecl(SRC, m.index)).length;

  assert.ok(reassign >= 6,
    `★전제: ★거름을 ★★재대입하는 자리가 ★★6 이상이어야 한다(잰 값 ${reassign} · ★★선언은 ★뺐다) — `
    + '★★★이 수가 ★작으면 ★★«한 자리로 ★파생»의 ★까닭이 ★약해진다. ★★다시 ★세라');
  /* ★★★«좁은 꼴»이 ★★«넓은 꼴»보다 ★작아야 한다 — ★★그 차가 ★곧 ★★`= next` 다.
     ⇒ ★★★이 한 줄이 ★★내가 ★밟은 ★흠(★한 꼴로만 ★센 것)을 ★★다음 사람에게 ★★보여 준다. */
  assert.ok(reassignBrace < reassign,
    `★★«좁은 꼴»(${reassignBrace})이 ★★«재대입 전수»(${reassign})와 ★같다 — `
    + '★★`= next` 꼴이 ★★없어졌나? ★★그러면 ★★이 칸의 ★까닭을 ★다시 ★적어라');
  assert.strictEqual(reassign - reassignBrace, 1,
    `★★★«중괄호가 ★아닌 ★재대입»이 ★★1 이 ★아니다(잰 값 ${reassign - reassignBrace}) — `
    + '★★뜻한 ★하나 = ★`_tplNavEnter` 의 ★`_browserFilter = next;`. ★★늘었으면 ★★전수를 ★다시 ★보라');
});

test('G3 ★★클릭 토글이 ★★★모델을 ★고친다 — ⛔`classList` 만 ★고치면 ★다음 ★다시 그리기가 ★덮는다', () => {
  /* ★★★«전부터 ★있던 ★흠» — ★★`:395` 가 ★★DOM 만 ★건드렸다.
     ★★실측: ★★고치기 ★전 판에서 ★★E5 가 ★★빨강이었다(★출처= ★내가 ★돌렸다 · ★dom-out 로그). */
  const del = [...SRC.matchAll(/_expandedFolders\.delete\(/g)].length;
  assert.ok(del >= 2,
    `★`+`_expandedFolders.delete(` + ` 가 ★★2 미만이다(잰 값 ${del}) — `
    + '★★뜻한 ★둘 = ⑴ ★`←` 닫기 ⑵ ★클릭 토글의 ★접기');
  /* ★★★`classList.toggle('expanded')` 를 ★★«인자 없이» 부르면 ★★모델과 ★갈릴 ★수 ★있다
     ⇒ ★★둘째 인자로 ★★모델을 ★먹이는 ★꼴이어야 한다 */
  const bare = [...SRC.matchAll(/classList\.toggle\(\s*'expanded'\s*\)/g)].length;
  assert.strictEqual(bare, 0,
    `★★`+`classList.toggle('expanded')` + ` 를 ★★인자 ★없이 ★부르는 자리가 ★${bare}곳 ★있다 — `
    + '★★그 꼴은 ★★DOM 을 ★★모델과 ★따로 ★뒤집는다. ★★둘째 인자로 ★모델을 ★먹여라');
  assert.match(SRC, /classList\.toggle\(\s*'expanded'\s*,\s*_expandedFolders\.has\(/,
    '★★클릭 토글이 ★★모델을 ★★둘째 인자로 ★안 먹인다');
});

test('G4 ★★`→` 무접촉 — ★★`ArrowRight` 는 ★★여전히 ★`_tplNavEnter` ★하나만 ★부른다 (★`1011t1d-b` 선)', () => {
  /* ★★지디 판정: ★현빈 원문은 ★«닫기»뿐이고 ★`→` 는 ★이미 ★만족한다 ⇒ ★★뜻을 ★바꾸지 ★않는다.
     ⇒ ★★누가 ★★«접힌 폴더에서 ★→ = ★펴기만»을 ★넣으면 ★★이 칸이 ★알린다(★DOM 쪽은 ★E6). */
  const m = SRC.match(/if \(e\.key === 'ArrowRight'\) \{([\s\S]{0,220}?)\n    \}/);
  assert.ok(m, '★`ArrowRight` 갈래를 ★★못 찾았다 — ★★이 칸을 ★다시 ★맞춰라');
  const body = m[1];
  assert.match(body, /_tplNavEnter\(\)/, '★`ArrowRight` 가 ★`_tplNavEnter` 를 ★안 부른다');
  assert.ok(!/_expandedFolders/.test(body),
    `★★★`+`→` + ` 갈래가 ★★«펴짐»을 ★건드린다 — ★★그건 ★`+`1011t1d-b` + ` 다. ★잰 값: ${body.trim().slice(0, 120)}`);
});

test('G5 ★★★이 자가 ★실제로 ★무나 — ★★★옛 꼴을 ★먹여 ★뒤집힌다', () => {
  /* ⛔「지금 ★맞다」만으로는 ★★정규식이 ★★죽었는지 ★모른다(★0건이 ★초록).
     ⇒ ★★★«고치기 ★전»의 ★그 줄을 ★★손으로 ★만들어 ★★G1 의 ★식에 ★먹인다. */
  const OLD = 'const folderActive = x;\n    const isExpanded = folderActive;\n';
  const m = [...stripComments(OLD).matchAll(/const\s+isExpanded\s*=\s*([^;]+);/g)];
  assert.strictEqual(m.length, 1, `★옛 꼴에서 ★한 자리를 ★못 뽑았다(${m.length})`);
  assert.ok(!/_expandedFolders\.has\(/.test(m[0][1]),
    '★★옛 꼴을 ★★«모델을 ★읽는다»로 ★읽는다 — ★★G1 은 ★★아무것도 ★안 잡는다');
  assert.ok(/folderActive/.test(m[0][1]), '★옛 꼴에서 ★`folderActive` 를 ★못 봤다');

  /* ★★음성대조 — ★★새 꼴은 ★★통과해야 한다(★거짓 양성 ★아님) */
  const NEW = "const isExpanded = _expandedFolders.has(folder);\n";
  const m2 = [...stripComments(NEW).matchAll(/const\s+isExpanded\s*=\s*([^;]+);/g)];
  assert.strictEqual(m2.length, 1);
  assert.match(m2[0][1], /_expandedFolders\.has\(/, '★새 꼴을 ★거절한다 — ★거짓 양성');
  assert.ok(!/folderActive/.test(m2[0][1]), '★새 꼴에서 ★`folderActive` 를 ★봤다');
});
