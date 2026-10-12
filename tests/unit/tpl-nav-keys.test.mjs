/* tpl-nav-keys.test.mjs — ★설계 D(b1): ★★«결정» 쪽을 ★DOM 없이 ★잠근다
 *
 * ★★찾은 자 = t4quote · ★M1·M2·M3 ★판정 = 지디 · ★고친 자 = t1bstar.
 *
 * ★★★이 파일이 ★잠그는 ★범위 — ⛔D 전부가 ★아니다. ★★갈라 적는다:
 *   ★★여기(unit) : ★D2 ★양끝 멈춤 · ★D6·D8·D9 ★해제 ★판정 · ★M2 ★선택 ★기억 ·
 *                  ★키 ★필터가 ★넓어졌나 · ★★`preventDefault` 가 ★걸렸나(★소스로) ·
 *                  ★★`_treeItems()` 가 ★★DOM 에서 ★뽑나 · ★규약 주석 ★덧쓰기 · ★고전 스크립트
 *   ★★★DOM 에 ★남는 것 : ★D1(진입 자리) · ★D3(진입) · ★★D4(캐럿이 ★실제로 ★안 움직이나) ·
 *                  ★D5(배지가 ★보이나) · ★D7(차례 == ★화면)
 *   ⇒ ★★★그래서 ★★이 파일만 ★초록이라고 ★★«D 가 ★섰다»로 ★읽으면 ★틀린다.
 *     (★내 명부: 「★검사 머리말이 ★단언이 ★잠근 것보다 ★★넓게 ★말한다」)
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');

let _loadErr = null;
const W = (() => {
  const win = {};
  try {
    // eslint-disable-next-line no-new-func
    new Function('window', fs.readFileSync(path.join(ROOT, 'js/panels/_tpl-nav.js'), 'utf8'))(win);
  } catch (e) { _loadErr = e; }
  return win;
})();

/* ★★★«그 갈래»의 ★본문만 ★떼어 온다 — ★★중괄호를 ★세어 ★끝을 ★찾는다.
   ★★★왜 ★이렇게까지 — ★★261011 에 ★★창 때문에 ★★두 번 ★속았다:
     ⒜ ★고정 220자 ⇒ ★갈래가 ★짧아지자 ★★다음 갈래의 ★`preventDefault` 를 ★읽었다
     ⒝ ★«다음 `if (e.key ===` 에서 끊기» ⇒ ★★중간 갈래가 ★`if (_depth === 1 && (e.key ===` 꼴이라
        ★★그 자에 ★안 걸려 ★★이웃 ★둘을 ★더 ★먹었다
   ⇒ ★★★둘 다 ★★«무력화가 ★아무것도 ★못 빨갛게 ★한다»로 ★드러났다 — ★★그게 ★창이 ★넓다는 ★신호다.
   (★내 명부: ★「★부재를 잴 때 ★틀리는 건 ★«자»가 ★아니라 ★★«창»이다」) */
function branchBody(src, needle) {
  const i = src.indexOf(needle);
  if (i < 0) return null;
  let j = src.indexOf('{', i);
  if (j < 0) return null;
  let depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  return null;
}

const F = (folder, category, starred = false, tag = null) => ({ folder, category, starred, tag });

test('N0 ★전제 — ★순수 핵이 ★섰나 ＋ ★고전 스크립트인가', () => {
  assert.strictEqual(_loadErr, null, `★못 돌렸다: ${_loadErr && _loadErr.message}`);
  for (const k of ['tplNavMove', 'tplNavSameFilter', 'tplNavShouldClearSearch', 'tplNavShouldDropSelection']) {
    assert.strictEqual(typeof W[k], 'function', `★window.${k} 가 ★없다`);
  }
  const body = stripComments(readSrc(ROOT, 'js', 'panels', '_tpl-nav.js'));
  assert.ok(!/^\s*(export|import)\s/m.test(body), '★export·import 가 ★들어왔다 — ★별창이 ★죽는다');
});

test('D2 ★커서가 ★차례대로 ★움직이고 ★★양 끝에서 ★★멈춘다 — ⛔wrap ★안 한다', () => {
  assert.strictEqual(W.tplNavMove(0, 5, 1), 1);
  assert.strictEqual(W.tplNavMove(3, 5, 1), 4);
  assert.strictEqual(W.tplNavMove(4, 5, 1), 4, '★끝에서 ★wrap 했다');
  assert.strictEqual(W.tplNavMove(0, 5, -1), 0, '★처음에서 ★wrap 했다');
  assert.strictEqual(W.tplNavMove(2, 5, -1), 1);
  /* ★★범위 밖에서 ★들어설 때 — ★`←` 로 ★처음 들어오는 꼴 */
  assert.strictEqual(W.tplNavMove(-1, 5, 1), 0);
  assert.strictEqual(W.tplNavMove(-1, 5, -1), 4);
  assert.strictEqual(W.tplNavMove(99, 5, 1), 0);
  /* ★★빈 명부 — ⛔0 을 ★주면 ★`items[0]` 이 ★undefined 가 된다 ⇒ ★-1 로 ★가른다 */
  assert.strictEqual(W.tplNavMove(0, 0, 1), -1);
  assert.strictEqual(W.tplNavMove(0, -3, 1), -1);
});

test('D6·M1 ★★커서 이동은 ★★해제하지 ★않는다 — ★★«거름이 ★달라도» ★안 한다', () => {
  /* ★★★`'move'` 는 ★★어떤 짝에서도 ★false 여야 한다 — ★★그게 ★M1 의 ★왼쪽 팔이다 */
  assert.strictEqual(W.tplNavShouldClearSearch('move', F('알파', '전체'), F('베타', '전체')), false);
  assert.strictEqual(W.tplNavShouldClearSearch('move', F('알파', '전체'), F('알파', '전체')), false);
  assert.strictEqual(W.tplNavShouldDropSelection('move', F('알파', '전체'), F('베타', '전체')), false,
    '★★커서 이동이 ★선택을 ★버렸다 — ★M2(기억한다)가 ★깨진다');
});

test('D9 ★★같은 항목으로 ★재진입 ⇒ ★★해제 ★안 한다 (★★D8 의 ★음성대조)', () => {
  const same = F('알파', 'demo');
  assert.strictEqual(W.tplNavShouldClearSearch('enter', same, { ...same }), false,
    '★★거름이 ★안 바뀌는 ★재진입인데 ★해제했다');
  assert.strictEqual(W.tplNavShouldDropSelection('enter', same, { ...same }), false,
    '★★거름이 ★안 바뀌는 ★재진입인데 ★선택을 ★버렸다 — ★★둘째 카드 ★기억이 ★깨진다(D6)');
});

test('D8 ★★거름이 ★바뀌는 ★진입 ⇒ ★★해제한다 ＋ ★선택을 ★버린다', () => {
  assert.strictEqual(W.tplNavShouldClearSearch('enter', F('알파', 'demo'), F('감마', 'solo')), true);
  assert.strictEqual(W.tplNavShouldDropSelection('enter', F('알파', 'demo'), F('감마', 'solo')), true);
  /* ★★범주만 ★달라도 ★거름이 ★바뀐 것이다 */
  assert.strictEqual(W.tplNavShouldClearSearch('enter', F('알파', '전체'), F('알파', 'demo')), true);
  /* ★★즐겨찾기 ★토글도 ★거름이다 */
  assert.strictEqual(W.tplNavShouldClearSearch('enter', F('전체', '전체', false), F('전체', '전체', true)), true);
  /* ★★태그 축도 ★본다 */
  assert.strictEqual(W.tplNavShouldClearSearch('enter', F('알파', '전체', false, null), F('알파', '전체', false, 'qna')), true);
});

test('D8·D9 ★★★이 둘이 ★★«언제나 ★해제»·«아예 ★안 함»을 ★★둘 다 ★막나', () => {
  /* ★★★t4quote 의 ★무력화 ★둘을 ★★여기서 ★모의한다 — ★★한쪽만 두면 ★★항등식이 ★된다.
     ⒜ ★«언제나 해제» ⇒ ★D9 가 ★잡아야 ★한다
     ⒝ ★«아예 안 함»   ⇒ ★D8 이 ★잡아야 ★한다 */
  /* ★★★«가짜 구현 ★둘»을 ★세우고 ★★참 거동이 ★★둘 다와 ★★갈리는지를 ★잰다.
     ⛔앞서 쓴 꼴은 ★★상수 둘을 ★견주고 있었다(`always()` vs `false`) ⇒ ★★항등식이었다.
       ⇒ ★★그래서 ★★«사례 묶음»을 ★돌려 ★★«적어도 한 사례에서 ★갈린다»를 ★단언한다. */
  const same = F('알파', 'demo'), other = F('감마', 'solo');
  const CASES = [
    ['enter', same, { ...same }],   // ★같은 항목 ★재진입
    ['enter', same, other],         // ★거름이 ★바뀌는 ★진입
    ['move',  same, other],         // ★커서 ★이동
  ];
  const real  = CASES.map(c => W.tplNavShouldClearSearch(...c));
  const ALWAYS = CASES.map(() => true);
  const NEVER  = CASES.map(() => false);
  assert.notDeepStrictEqual(real, ALWAYS,
    `★★«언제나 해제»와 ★구분 안 된다 — ★D9 가 ★죽었다. ★잰 값: ${JSON.stringify(real)}`);
  assert.notDeepStrictEqual(real, NEVER,
    `★★«아예 안 함»과 ★구분 안 된다 — ★D8 이 ★죽었다. ★잰 값: ${JSON.stringify(real)}`);
  /* ★★그리고 ★★참 거동이 ★★무엇인지도 ★박아 둔다 — ⛔«둘과 다르다»만으론 ★★세 번째 틀린 꼴을 ★못 막는다 */
  assert.deepStrictEqual(real, [false, true, false], `★잰 값: ${JSON.stringify(real)}`);
});

test('N1 ★`tplNavSameFilter` — ★★네 축을 ★다 본다(⛔하나라도 빠지면 ★해제 판정이 ★틀린다)', () => {
  const base = F('알파', 'demo', false, 'qna');
  assert.ok(W.tplNavSameFilter(base, { ...base }));
  for (const [k, v] of [['folder', '베타'], ['category', '다른'], ['starred', true], ['tag', 'war']]) {
    assert.ok(!W.tplNavSameFilter(base, { ...base, [k]: v }), `★축 ${k} 를 ★안 본다`);
  }
  /* ★★`tag` 의 ∅ — ★`null`·`undefined` 는 ★★같은 «없음»이어야 한다 */
  assert.ok(W.tplNavSameFilter(F('a', 'b', false, null), F('a', 'b', false, undefined)),
    '★`null` 과 ★`undefined` 태그가 ★다르게 ★읽힌다 ⇒ ★★거름이 ★안 바뀌었는데 ★해제한다');
});

test('N2 ★키 ★필터가 ★넓어졌나 ＋ ★`⌘↓` ★하나만 ★열렸나 (★소스로)', () => {
  const src = stripComments(readSrc(ROOT, 'js', 'panels', 'template-browser.js'));
  for (const k of ['ArrowLeft', 'ArrowRight']) {
    assert.ok(src.includes(k), `★${k} 를 ★아직 ★안 받는다 — ★옛 꼴은 ★셋만 ★통과시켰다`);
  }
  /* ★★★옛 꼴 — ★«수식키면 ★무조건 ★return»이 ★남아 있으면 ★`⌘↓` 가 ★영영 ★안 온다 */
  assert.ok(!/if\s*\(e\.metaKey\s*\|\|\s*e\.ctrlKey\s*\|\|\s*e\.altKey\)\s*return;/.test(src),
    '★★수식키 ★전면 차단이 ★남아 있다 — ★`⌘↓` 가 ★못 들어온다');
  assert.ok(/_cmdDown/.test(src), '★`⌘↓` 를 ★가르는 자가 ★없다');
  /* ★★D4 의 ★집행 — ★`←`·`→` 갈래에 ★`preventDefault` 가 ★있나 */
  /* ★★★★처음 쓴 자는 ★★엉뚱한 데를 ★겨눴다(261011) — ★`indexOf("e.key === 'ArrowLeft'")` 가
       ★★★위의 ★«키 필터» 줄(`const _navKey = … || e.key === 'ArrowLeft' || …`)을 ★★먼저 ★집었고
       ★★그 뒤 220자엔 ★`preventDefault` 가 ★없어 ★★빨개졌다 — ★★제품이 ★아니라 ★★자가 ★틀렸다.
     ⇒ ★★그래서 ★★«갈래»를 ★★꼴로 ★겨눈다: ★`if (e.key === 'X') {`.
     (★내 명부: ★「★«맞는 결함»≠«지목된 결함» — ★가리킨 말과 ★내가 고친 것을 ★나란히 놓아라」) */
  /* ★★★`⌘↓` 갈래도 ★★같이 ★잰다 — ★★안 재고 있었다(261011):
       ★`→` 갈래를 ★무력화하려고 ★걸은 ★변이가 ★★«같은 글»이 ★두 번 ★있어 ★★`⌘↓` 쪽을 ★고쳤는데
       ★★아무 칸도 ★안 빨개졌다 ⇒ ★★그 갈래의 ★`preventDefault` 는 ★★아무도 ★안 재고 있었다.
     ⇒ ★★«무력화가 ★아무것도 ★못 빨갛게 ★했다»가 ★★«구멍»을 ★가리킨 ★것이다. */
  {
    const seg = branchBody(src, 'if (_cmdDown) {');
    assert.ok(seg, '★`⌘↓` 갈래가 ★없다');
    assert.ok(seg.includes('preventDefault'),
      '★★`⌘↓` 갈래에 preventDefault 가 ★없다 — ★★캔버스의 ★다른 ⌘↓ 단축키가 ★같이 ★먹는다');
    assert.ok(seg.includes('_tplNavEnter'), '★`⌘↓` 갈래가 ★진입을 ★안 부른다');
  }
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    const needle = `if (e.key === '${key}') {`;
    const seg = branchBody(src, needle);
    assert.ok(seg, `★${key} 의 ★«갈래»가 ★없다(★키 필터에만 ★있고 ★처리가 ★없나)`);
    assert.ok(seg.includes('preventDefault'),
      `★★${key} 갈래에 preventDefault 가 ★없다 — ★★캐럿이 ★그대로 ★움직인다(★D4 가 ★이걸 잰다)`);
    assert.ok(seg.includes('_depth'), `★★${key} 갈래가 ★뎁스를 ★안 본다`);
  }
});

test('N3 ★★`_treeItems()` 가 ★★DOM 에서 ★뽑고 ★★접힌 폴더를 ★★뺀다 (★소스로)', () => {
  const src = stripComments(readSrc(ROOT, 'js', 'panels', 'template-browser.js'));
  const i = src.indexOf('function _treeItems(');
  assert.ok(i > 0, '★`_treeItems` 가 ★없다');
  const body = src.slice(i, i + 900);
  assert.ok(/querySelectorAll/.test(body), '★★DOM 에서 ★안 뽑는다 — ★모델에서 ★세면 ★펴짐과 ★어긋난다');
  assert.ok(/expanded/.test(body), '★★`expanded` 를 ★안 본다 — ★★접힌 폴더의 ★범주가 ★★명부에 ★든다(D7 이 ★빨개진다)');
  /* ★★★명부가 ★★하나인가 — ★키 처리 쪽이 ★제 식으로 ★또 ★세면 ★갈라진다 */
  const picks = (src.match(/querySelectorAll\('\.tb-tree-starred/g) || []).length;
  assert.strictEqual(picks, 1,
    `★★뎁스1 항목을 ★뽑는 자리가 ★★하나가 ★아니다(잰 값: ${picks}) — ★★명부가 ★둘이면 ★갈라진다`);
});

test('N4 ★★규약 주석을 ★★덮어썼나 — ⛔지우지도, ★«폐기»라 ★적지도 ★않았나', () => {
  const raw = readSrc(ROOT, 'js', 'panels', 'template-browser.js');
  /* ★★옛 줄이 ★★그대로 ★살아 있어야 ★한다(★덧쓰기다) */
  assert.ok(raw.includes('⑵트리 항목을 고르면 검색을 자동 해제'),
    '★★옛 규약 줄이 ★★사라졌다 — ★★덧쓰기가 ★아니라 ★★지우기를 했다');
  assert.ok(raw.includes('«거름이 바뀌는 진입»'), '★정밀화한 절이 ★없다');
  assert.ok(raw.includes('커서 이동(←·↑·↓)은 «고르는» 것이 아니므로'), '★커서 이동 조항이 ★없다');
  assert.ok(!/⑵\s*는?\s*폐기/.test(raw), '★★«폐기»라 ★적었다 — ⛔그렇게 ★적지 ★말라 했다');
  /* ★★★클릭 경로는 ★한 줄도 ★안 건드렸나 — ★M1 까닭 ⒥ */
  const clicks = (raw.match(/_clearBrowserSearch\(\);/g) || []).length;
  assert.ok(clicks >= 3,
    `★★클릭 경로의 ★\`_clearBrowserSearch()\` 가 ★줄었다(잰 값: ${clicks}) — ★★그건 ★다른 요구다`);
});

test('N5 ★★두 창이 ★★이 자를 ★★둘 다 ★싣나', () => {
  for (const rel of [['index.html'], ['pages', 'template-browser.html']]) {
    const html = readSrc(ROOT, ...rel);
    assert.ok(html.includes('_tpl-nav.js'), `★${rel.join('/')} 가 _tpl-nav.js 를 ★안 싣는다`);
  }
});

test('N6 ★커서 표시가 ★★`active` 와 ★★다른 class 인가 — ⛔«거름»과 ★«가리킴»을 ★섞지 ★않는다', () => {
  const src = stripComments(readSrc(ROOT, 'js', 'panels', 'template-browser.js'));
  assert.ok(/tb-tree-cursor/.test(src), '★커서 class 가 ★없다');
  /* ★★커서를 ★칠하는 자가 ★`active` 를 ★★건드리면 ★★D1(둘이 ★같이 선다)이 ★깨진다 */
  const i = src.indexOf('function _paintTreeCursor(');
  assert.ok(i > 0, '★`_paintTreeCursor` 가 ★없다');
  const body = src.slice(i, i + 520);
  assert.ok(!body.includes("'active'"), '★★커서 칠하는 자가 ★`active` 를 ★건드린다');
  /* ★★CSS 가 ★그 class 를 ★실제로 ★꾸미나 — ⛔«면적 0»·«안 보임»을 ★막는다 */
  const css = readSrc(ROOT, 'css', 'editor-extra.css');
  assert.ok(/\.tb-tree-cursor\s*\{|tb-tree-cursor,/.test(css),
    '★★CSS 에 ★`tb-tree-cursor` 규칙이 ★없다 — ★★커서가 ★★안 보인다');
});
