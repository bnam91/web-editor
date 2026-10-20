/* 1020t1a — line-host 「더블클릭 캐럿」 ★주인 명부와, ★그 동작을 ★전제하는 DOM spec 을 ★짝으로 잠근다.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 있나 — 2026-10-20, 내가 낸 ★회귀 하나 때문이다.
 *   `d9ead6e9`(현빈 1020t1a 「컴패리전 블럭 더블클릭시 텍스트 수정하려는데 커서가 적절한 곳에
 *   위치하지 않는 문제」)로 ★비교 줄은 ★누른 «그 글자»에 캐럿이 선다. 그 바꿈이
 *   `tests/dom/laurel-rich-text.dom.spec.js` 의 ★HM3(비교 칼럼1)을 ★깼다.
 *   ★까닭(실측 · 헤드리스 크롬 · 진짜 앱):
 *     그 spec 의 `openEditSel` 은 ★줄 상자의 ★«중심»을 더블클릭한다. 그 줄은 ★시각 두 줄
 *     ("AAABBB" / "CCCDDD" · 상자 높이 31.1px)이라 ★중심이 ★줄 경계다
 *     ⇒ 캐럿 off=3 («AAA|BBB») ⇒ ⇧←×3 이 ★"AAA" 를 골랐다(spec 기대 "DDD").
 *   ★형제 셋(laurel·버블·챗)이 초록이던 까닭 ★한 줄: ★아래 명부에 ★비교 ★하나만 있어서,
 *     나머지 셋은 ★옛 동작(줄 끝 캐럿)이라 ★그 spec 의 암묵 전제가 ★아직 참이었다.
 *
 * ★★이 검사가 ★하는 일 — ★«명부»와 ★«그 명부를 전제하는 글»을 ★어긋나지 않게 묶는다.
 * ★★이 검사가 ★★못 하는 일(⛔「이러면 안전하다」로 읽지 마라):
 *   ⒤ ★«캐럿이 어디 서나»는 ★여기서 못 잰다 — ★그건 ★DOM/CDP 만이 잰다.
 *      행동 게이트는 ★레포 «밖»에 있다: `…/scratchpad/t1a/gate-hm3.mjs`(헤드리스 크롬 · 진짜 index.html).
 *      ⇒ ★이 자가 초록이어도 ★그 게이트를 ★따로 돌려야 한다. ★그게 ★이번에 ★배운 값이다.
 *   ⒤′ ★★2026-10-20 ★«죽은 초록» 자백 — ★이 파일의 ⑶ 은 ★처음에 ★「HM3 재편집 캐럿을 ★키로 세운다」는
 *      ★이름을 달고 ★★«그 줄에 'End' 라는 글자가 있나»만 ★쟀다. ★그 사이 ★DOM 은 ★빨강이었다
 *      (받은 선택이 ★"CCC" — ★그 판에서 ★End 가 ★안 먹었다). ★★이름이 ★단언을 ★넘었다.
 *      ⇒ ★이름을 ★단언에 ★맞췄고(아래 ⑶), ★★이제 ★그 spec 은 ★캐럿을 ★아예 ★안 쓴다(pickText).
 *      ⇒ ★★교훈: ★★«효과»를 못 재는 자는 ★★«효과»를 ★이름에 ★담지 마라. ★그리고 ★초록을 ★양성으로 ★읽지 마라.
 *   ⒥ ★spec 의 ★다른 암묵 전제(스크롤·레이아웃)는 ★안 본다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const LH = 'js/blocks/line-host.js';
const SPEC = 'tests/dom/laurel-rich-text.dom.spec.js';

/* ★참 명부 — ★손으로 박는다(⛔소스에서 읽어 소스와 견주면 항등식이다). */
const OWNERS = ['comparison-block'];

/* ★★«암묵 캐럿»에 기대는 spec 자리 — ★지금 이러하다.
 *   꼴 = 한 줄에 openEditSel 과 shiftLeft 가 같이 있고 'End' 가 ★없다(= 캐럿 자리를 ★안 세운다).
 *   ★명부는 ★«줄 내용»으로 적는다(⛔줄 번호 금지 — 실제로 밀려 깨졌다).
 *   ★셋 다 ★laurel 전용 시험이라 ★지금은 참이다(laurel 은 명부 밖 = 옛 동작 = 줄 끝).
 *   ★★명부에 주인을 ★더하면 ★이 셋을 ★먼저 보라 — ★그게 ★이 기록의 몫이다. */
const IMPLICIT_CARET_SPEC_CODE = [
  "await openEditSel(page, KL.sel(id), id); await keys(page, shiftLeft(6)); await waitSel(page, 'BBBCCC');",
  "await openEditSel(page, KL.sel(id), id); await keys(page, shiftLeft(6)); await waitSel(page, 'BBBCCC');",
  "await openEditSel(page, sel, id); await keys(page, shiftLeft(3)); await waitSel(page, 'CCC');",
];
/* ⚠️★처음엔 ★줄 번호로 적었다(944·954·992). ★그러자 ★내가 ★헬퍼 26줄을 끼운 ★그 순간
   ★970·980·1018 로 밀려 ★이 검사가 ★빨개졌다 — ★자기 경고대로. ⇒ ★★«내용»으로 적는다.
   ★내 명부: 「★줄번호로 가리키지 마라 — ★앵커로」. */

test('⑴ 주인 명부가 ★손으로 박은 것과 같다(넓히면 ★일부러 넓힌 것이어야 한다)', () => {
  const t = src(LH);
  const m = /const\s+LN_CARET_AT_POINT_OWNERS\s*=\s*\[([^\]]*)\]/.exec(t);
  assert.ok(m, '★LN_CARET_AT_POINT_OWNERS 선언을 못 찾았다 — 이름/꼴이 바뀌면 ★이 검사도 같이 고쳐라');
  const got = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
  assert.deepEqual(got, OWNERS,
    '★명부가 달라졌다. 지금: ' + JSON.stringify(got) + ' / 적힌 것: ' + JSON.stringify(OWNERS) + '\n' +
    '  ★넓혔으면 ⑴ 이 줄을 고치고 ⑵ IMPLICIT_CARET_SPEC_LINES 의 세 자리가 ★그 주인에도 참인지 ★재고\n' +
    '  ⑶ 레포 밖 gate-hm3.mjs 를 ★그 주인으로 ★돌려라(이 자는 ★동작을 못 잰다).');
});

test('⑵ lnBeginEdit — 점 분기는 ★더블클릭 ＋ ★명부 주인일 때만, 폴백은 ★옛 동작(줄 끝)', () => {
  const t = src(LH);
  const i = t.indexOf('export function lnBeginEdit(');
  assert.ok(i >= 0, '★lnBeginEdit 선언을 못 찾았다');
  const body = t.slice(i, t.indexOf('\n/*', i) > i ? t.indexOf('\n/*', i) : i + 4000);
  /* 점 분기의 ★두 조건이 ★둘 다 있어야 한다 — 하나만 남으면 ★Enter 진입·★명부 밖 주인이 ★새 길로 샌다 */
  assert.match(body, /caretFrom/, '★opts.caretFrom 을 안 본다 ⇒ ★Enter 진입(lnEnterEdit)도 ★점 분기를 타게 된다');
  assert.match(body, /_lnCaretAtPointOwner\(block\)/, '★주인 명부를 안 본다 ⇒ ★버블·챗·laurel·심플카드까지 ★동작이 바뀐다');
  /* 폴백이 ★살아 있어야 한다 — 이게 ★옛 동작이고, ★명부 밖 주인과 ★Enter 진입이 ★여기로 떨어진다 */
  assert.match(body, /selectAllChildren\(el\)/, '★폴백(줄 끝 캐럿)이 사라졌다 ⇒ ★명부 밖 주인의 ★옛 동작이 ★깨진다');
  assert.match(body, /collapseToEnd\(\)/, '★폴백의 collapseToEnd 가 사라졌다 — ★줄 끝이 아니라 ★전체선택이 된다');
  /* 더블클릭 입구가 ★점을 ★넘겨야 한다 */
  assert.match(t, /lnBeginEdit\(block,\s*\{\s*r,\s*c,\s*li\s*\},\s*\{\s*caretFrom:\s*e\s*\}\)/,
    '★lnBindLineEdit 의 더블클릭이 ★caretFrom 을 안 넘긴다 ⇒ ★1020t1a 고침이 ★조용히 죽는다');
});

test('⑶ HM3 공용 루프의 재편집은 ★캐럿에 ★안 매달린다 — ★«꼴»만 잠근다(⛔효과는 여기서 못 잰다)', () => {
  const t = src(SPEC);
  const lines = t.split('\n');
  /* ★이 자가 ★잠그는 것 ★딱 하나: ★HM3 의 재진입이 ★«키로 캐럿을 옮겨» 글자를 고르지 ★않는다.
     ⛔이 자는 ★«그래서 DDD 가 골라지나»를 ★못 잰다 — ★그건 DOM(이 spec 자신)과 ★레포 밖 gate-hm3.mjs 의 몫이다. */
  const reopen = lines
    .map((l, k) => ({ ln: k + 1, l }))
    .filter(x => /openEditSel\(/.test(x.l));
  assert.ok(reopen.length >= 4,
    '★재진입 자리를 ' + reopen.length + '곳 찾았다 — 4곳 이상이어야 뜻을 갖는다(spec 꼴이 바뀌었는지 보라)');
  /* ★HM3 공용 루프의 그 줄 — ★pickText 로 ★곧장 집는다 */
  const hm3 = reopen.filter(x => /pickText\(/.test(x.l));
  assert.ok(hm3.length >= 1,
    '★HM3 재진입이 ★pickText(명시 선택)를 ★안 쓴다 ⇒ ★캐럿 위치에 ★다시 매달린다.\n' +
    '  ★실측으로 ★두 번 틀렸다: ⇧←×3 → "AAA" · ↓·End·⇧←×3 → "CCC". ⇒ ★Range 로 곧장 집어라.');
  for (const x of hm3) assert.ok(!/shiftLeft\(/.test(x.l),
    '★' + x.ln + '행: pickText 와 shiftLeft 가 ★같이 있다 — ★둘 중 하나만. 키를 섞으면 ★다시 캐럿에 기댄다.');
  /* ★아직 ★캐럿에 기대는 자리 = 기록과 ★정확히 같아야 한다(★laurel 전용이라 지금은 참) */
  const implicit = reopen.filter(x => /shiftLeft\(/.test(x.l) && !/'End'/.test(x.l)).map(x => x.l.trim());
  assert.deepEqual(implicit, IMPLICIT_CARET_SPEC_CODE,
    '★캐럿에 기대는 자리가 달라졌다. 지금: ' + JSON.stringify(implicit, null, 1) + '\n  적힌 것: ' + JSON.stringify(IMPLICIT_CARET_SPEC_CODE, null, 1) + '\n' +
    '  ★늘었으면 — ★그 자리가 ★명부 주인(지금 comparison)에서도 참인지 ★재라. 아니면 pickText 로 바꿔라.\n' +
    '  ★줄었으면 — 좋은 일이다. ★이 줄을 고쳐라.\n' +
    '  ★★«내용»으로 적은 명부다 — ★줄이 끼어도 안 흔들린다(앞서 줄번호로 적었다가 ★헬퍼를 끼운 순간 깨졌다).\n' +
    '  ⚠️★이 꼴은 ★«openEditSel 과 같은 줄»만 본다 — ★A1 단계처럼 ★다음 줄에서 키를 누르는 자리는 ★★안 보인다.');
});
