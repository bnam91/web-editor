/* frame-bg-edit-wiring — ③ 「★프레임 배경도 ★에셋블럭처럼 ★위치·크기」의 ★배선을 ★재는 자 (2026-10-10)
 *
 * ★현빈 원문 ③ — 「프레임블럭에 배경을 넣고 위치를 움직이고 하는게, ★일반 에셋블럭에 이미지
 *   넣었을때처럼 되어야되는데 ★다르네 동작이. ★에셋블럭처럼 프레임블럭의 배경도 ★면 프레임안에서
 *   이미지 ★위치나 ★크기 조절되게 해줘」
 *
 * ★★이 파일이 ★잠그는 것 — ⛔「고쳤다」가 ★아니라 ★★«어긋나면 ★빨개질 자리»다:
 *   ⑴ ★본문이 ★★«한 벌»인가 (⛔185줄 사본이 ★생기지 않았나)
 *   ⑵ ★대리 요소의 ★★이름을 ★안 바꿨나 — ★★이것이 ★제일 ★중요하다(아래 B2 의 까닭)
 *   ⑶ ★프레임의 `twoLayer` 가 ★★false 인가 (섹션에서 ★베끼면 ★틀린다)
 *   ⑷ ★패널이 ★옛 %-전용 모드를 ★더 안 부르나
 *   ⑸ ★CSS 해제 규칙이 ★있고 ★★«순서»가 ★맞나 (!important 동률은 ★나중이 이긴다)
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다)
 *   · ★편집기가 ★실제로 ★위치·크기를 ★바꾸나 — ★그건 ★DOM 의 몫이다. ★여기는 ★★배선만 잰다
 *   · ★현빈에게 ★«에셋블럭처럼 ★느껴지나» — ★손잡이·힌트 글이 ★다를 수 있다(★눈의 물음)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { stripCommentsTA, templateBalanced } = req('./_strip-comments.js');

const R = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, R), 'utf8');
/** ⛔주석을 ★걷고 ★센다 — ★내 ⛔주석에 ★옛 함수 이름이 ★글자로 ★들어 있다.
 *  ★안 걷으면 ★★내 산문이 ★측정값이 된다(2026-10-07 에 ★실제로 그랬다). */
const code = (p) => {
  const src = read(p);
  assert.equal(templateBalanced(src), true, `★전제: ${p} 의 템플릿이 ★안 닫혔다 — ★그 뒤를 ★«안 본» 것이다`);
  return stripCommentsTA(src);
};

const IH = 'js/image-handling.js';

test('B1 ★★본문이 ★«한 벌»이다 — ★섹션·프레임이 ★같은 자에 ★위임한다 (⛔사본 0)', () => {
  const c = code(IH);
  assert.equal((c.match(/function _enterBgEditMode\(/g) || []).length, 1, '★공용 본문이 ★1개가 아니다');
  for (const n of ['enterSectionBgEditMode', 'enterFrameBgEditMode']) {
    const m = c.match(new RegExp('function ' + n + '\\(\\w+\\)\\s*\\{[^}]*\\}'));
    assert.ok(m, `★${n} 정의를 ★못 찾았다`);
    assert.match(m[0], /_enterBgEditMode\(/, `★★${n} 이 ★공용 본문을 ★안 부른다 — ★사본이 ★생겼다`);
  }
  /* ★대리를 ★«짓는» 자리가 ★하나여야 한다 — ★그게 ★사본 여부의 ★참 측정이다 */
  assert.equal((c.match(/className\s*=\s*'sec-bg-proxy'/g) || []).length, 1,
    '★★대리를 ★짓는 자리가 ★1곳이 아니다 — ★185줄이 ★복사됐다');
  assert.equal((c.match(/_teardownBgEdit\s*\(/g) || []).length >= 3, true, '★철거를 ★부르는 자리가 ★너무 적다');
  assert.equal((c.match(/function _teardownBgEdit\(/g) || []).length, 1, '★철거 본문이 ★1개가 아니다');
});

test('B2 ★★대리의 ★이름을 ★안 바꿨다 — ★★소독기가 ★이름으로 ★지운다(js+css 11벌)', () => {
  /* ★★까닭 — ⛔프레임용 ★새 이름을 지으면 ★저장·내보내기 ★소독기가 ★★눈이 ★멀고
     ★임시 대리가 ★★현빈 프로젝트에 ★저장되거나 ★내보낸 HTML 에 ★섞인다.
     ★이름이 ★조금 어긋나는 값(「sec-」)보다 ★★그 사고가 ★비싸다. */
  const NAMES = ['sec-bg-proxy', 'sec-bg-ghost-wrap', 'sec-bg-ghost', 'sec-bg-editing'];
  const dirs = ['js', 'css'];
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(new URL(d + '/', R), { withFileTypes: true })) {
      if (e.isDirectory()) walk(d + '/' + e.name);
      else if (/\.(js|css)$/.test(e.name)) files.push(d + '/' + e.name);
    }
  };
  dirs.forEach(walk);
  const users = files.filter((f) => NAMES.some((n) => read(f).includes(n)));
  console.log(`B2 ★이름을 쓰는 파일 ${users.length} 벌 — ${users.slice(0, 6).join(' · ')} …`);
  /* ★★수에 ★«판»을 ★붙인다 — ⛔맨숫자 금지. ★이 11 은 ★★`js/` ＋ `css/` 판이고 ★이름 ★셋만 센 것이다
     (실측 2026-10-10: ★js+css ★11 벌 · ★js+css+tests+pages+main ★18 벌).
     ⚠️★내가 ★처음 적은 「19벌 83행」은 ★★또 다른 판이었다 — `_secBg*` 상태키와 `sec-bg-pos-done` 까지
       넣고 ★«행»으로 센 수였다. ★그 수를 ★이 칸에 ★그대로 썼더니 ★이 칸이 ★빨개졌다(★판이 섞인 수).
     ⇒ ★★`>=` 로 둔다 — ★소독기가 ★늘면 ★통과, ★사라지면 ★빨강. */
  assert.ok(users.length >= 11,
    `★이름을 쓰는 파일이 ${users.length} 벌 — ★★11(js+css 판 · 2026-10-10 실측) 보다 적다.`
    + ` ★소독기가 ★사라졌나. 명부: ${users.join(' · ')}`);
  /* ★★그리고 ⛔프레임용 ★새 대리 이름이 ★생기지 ★않았나 — ★★이것이 ★이 칸의 ★본 단언이다 */
  const bad = [];
  for (const f of files) {
    const c = stripCommentsTA(read(f));
    for (const m of c.matchAll(/['"]((?:frame|frm|fr)-bg-(?:proxy|ghost)[\w-]*)['"]/g)) bad.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(bad, [],
    '★★프레임용 ★새 대리 이름이 ★생겼다 — ★★저장·내보내기 소독기가 ★그것을 ★못 본다'
    + ' ⇒ ★임시 대리가 ★저장본에 ★남는다');
});

test('B3 ★★프레임의 `twoLayer` 는 ★false 다 — ⛔섹션에서 ★베끼면 ★틀린다', () => {
  const c = code(IH);
  const tbl = c.slice(c.indexOf('const BG_EDIT_HOSTS'), c.indexOf('function _enterBgEditMode'));
  assert.ok(tbl.includes('section:') && tbl.includes('frame:'), '★어댑터 표에 ★두 숙주가 ★없다');
  const secPart = tbl.slice(tbl.indexOf('section:'), tbl.indexOf('frame:'));
  const frPart  = tbl.slice(tbl.indexOf('frame:'));
  assert.match(secPart, /twoLayer:\s*\(el\)\s*=>\s*!!\(el\.dataset\.bg\s*&&\s*el\.dataset\.bgImg\)/,
    '★섹션의 ★두 층 판정이 ★바뀌었다 — ★섹션은 ★dataset 으로 ★판정해야 한다');
  assert.match(frPart, /twoLayer:\s*\(\)\s*=>\s*false/,
    '★★프레임의 `twoLayer` 가 ★false 상수가 ★아니다 — ★프레임의 ★색과 ★그림은 ★«두 배경 레이어»가'
    + ' ★아니라 ★따로 사는 ★속성이다(`js/frame-bg.js`) ⇒ ★둘씩 쓰면 ★첫 레이어가 ★없어 ★칸이 ★어긋난다');
  assert.ok(!/dataset\.bg\b/.test(frPart.slice(0, frPart.indexOf('writeLive'))),
    '★프레임 `twoLayer` 가 ★dataset 을 ★읽는다 — ★섹션 꼴을 ★베꼈다');
});

test('B4 ★★패널이 ★옛 %-전용 모드를 ★더 안 부른다 ＋ ★정의가 ★사용보다 ★앞이다', () => {
  const c = code('js/props/prop-frame.js');
  assert.equal((c.match(/enterBgPosDragMode/g) || []).length, 0,
    '★★패널이 ★아직 ★옛 모드를 ★부른다 — ★그 모드엔 ★★크기 축이 ★없어 ★③ 이 ★다시 열린다');
  const uses = [...c.matchAll(/_frameBgEdit\(/g)].map((m) => m.index);
  const def = c.indexOf('const _frameBgEdit');
  assert.equal(uses.length, 2, `★토글을 부르는 자리가 ${uses.length} 곳 — ★두 곳이어야 한다(「위치 편집」 버튼이 ★둘)`);
  assert.ok(def >= 0, '★토글 정의가 ★없다');
  assert.ok(def < Math.min(...uses),
    `★★정의(${def})가 ★첫 사용(${Math.min(...uses)})보다 ★뒤다 — `
    + '★`const` 는 ★안 올라간다(hoisting). ★모듈 평가 중에 ★그 함수가 불리면 ★죽는다');
  /* ★섹션도 ★같은 꼴인가 — ★선례를 ★따랐음을 ★잰다(⛔두 쪽이 ★다른 꼴이면 ★하나만 고쳐진다) */
  const sc = code('js/props/prop-section.js');
  assert.match(sc, /_secBgEditing\s*\)\s*window\.exitSectionBgEditMode/, '★섹션 토글 꼴이 ★바뀌었다');
});

test('B5 ★★CSS 해제 규칙이 ★있고 ★«순서»가 ★맞다 — ★!important 동률은 ★나중이 ★이긴다', () => {
  const css = read('css/editor-blocks.css');
  const iOn  = css.indexOf('.frame-block[data-clip-content="true"]');
  const iOff = css.indexOf('.frame-block:has(> .sec-bg-proxy)');
  assert.ok(iOn  >= 0, '★「켬」 규칙이 ★사라졌다');
  assert.ok(iOff >= 0, '★★배경 편집 중 ★overflow 해제 규칙이 ★없다 — ★손잡이가 ★잘려 ★못 집는다');
  assert.ok(iOff > iOn,
    `★★해제 규칙(${iOff})이 ★「켬」 규칙(${iOn})보다 ★앞에 있다 — ★명시도·무게가 ★같으므로`
    + ' ★★조용히 ★진다(빨강 없이 ★기능만 ★죽는다)');
  const blk = css.slice(iOff, iOff + 120);
  assert.match(blk, /overflow:\s*visible\s*!important/,
    '★해제 규칙에 ★`!important` 가 ★없다 — ★「켬」의 !important 를 ★못 이긴다');
});

test('B6 ★★내가 ★더한 `position` 을 ★되돌린다 — ⛔안 되돌리면 ★저장본에 ★남는다', () => {
  const c = code(IH);
  const frPart = c.slice(c.indexOf('frame:'), c.indexOf('function _enterBgEditMode'));
  assert.match(frPart, /prepare:\s*\(el\)\s*=>/, '★프레임 어댑터에 ★`prepare` 가 ★없다 — ★대리가 ★엉뚱한 조상에 ★붙는다');
  assert.match(frPart, /el\.style\.position\s*=\s*had/, '★`position` 을 ★되돌리는 줄이 ★없다');
  /* ★되돌리개가 ★클로저에만 ★살면 ★공개 exit 경로에서 ★샌다 ⇒ ★숙주에도 ★매달았나 */
  assert.match(c, /host\._secBgRestore\s*=\s*_restore/, '★되돌리개를 ★숙주에 ★안 매달았다');
  assert.match(c, /restore\s*\?\?\s*host\._secBgRestore/, '★철거가 ★숙주의 ★되돌리개를 ★안 쓴다');
});

test('B7 ★★양성대조 — ★이 자들이 ★정말 ★빨개질 수 있나 (＋주석은 ★안 센다)', () => {
  /* ⛔없으면 ★위 여섯 칸의 ★초록이 ★「안 재고 있다」와 ★구분이 ★안 된다. */
  const asCode = (s) => stripCommentsTA(s);
  assert.equal((asCode("/* enterBgPosDragMode 라 적어만 둔다 */\nconst x = 1;").match(/enterBgPosDragMode/g) || []).length, 0,
    '★★주석에 적은 이름을 ★셌다 — ★내 산문이 ★측정값이 되었다');
  assert.equal((asCode("window.enterBgPosDragMode?.(ss);").match(/enterBgPosDragMode/g) || []).length, 1,
    '★★진짜 호출을 ★못 셌다 — ★B4 는 ★언제나 ★초록이다');
  /* ★순서 자(B5)도 ★뒤집으면 ★잡히나 */
  const fake = 'B{}\nA{}';
  assert.ok(!(fake.indexOf('A') > fake.indexOf('B')) === false, '★순서 비교 자가 ★항등식이다');
  assert.ok(fake.indexOf('A') > fake.indexOf('B'), '★순서 자가 ★거꾸로 읽는다');
});
