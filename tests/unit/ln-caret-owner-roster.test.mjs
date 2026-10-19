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
 *   ★셋 다 ★laurel 전용 시험이라 ★지금은 참이다(laurel 은 명부 밖 = 옛 동작 = 줄 끝).
 *   ★★명부에 주인을 ★더하면 ★이 셋을 ★먼저 보라 — ★그게 ★이 기록의 몫이다. */
const IMPLICIT_CARET_SPEC_LINES = [944, 954, 992];

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

test('⑶ HM3 공용 루프의 재편집은 ★캐럿을 ★키로 세운다(⛔암묵 전제 금지)', () => {
  const t = src(SPEC);
  const lines = t.split('\n');
  /* 꼴 — openEditSel 과 shiftLeft 가 같은 줄 */
  const sites = [];
  lines.forEach((l, k) => { if (/openEditSel\(/.test(l) && /shiftLeft\(/.test(l)) sites.push({ ln: k + 1, l }); });
  assert.ok(sites.length >= 3,
    '★그 꼴의 자리를 ' + sites.length + '곳 찾았다 — 3곳 이상이어야 이 검사가 뜻을 갖는다(spec 이 바뀌었는지 보라)');
  /* ★암묵 캐럿에 기대는 자리 = 기록과 ★정확히 같아야 한다 */
  const implicit = sites.filter(s => !/'End'/.test(s.l)).map(s => s.ln);
  assert.deepEqual(implicit, IMPLICIT_CARET_SPEC_LINES,
    '★암묵 캐럿 자리가 달라졌다. 지금: ' + JSON.stringify(implicit) + ' / 적힌 것: ' + JSON.stringify(IMPLICIT_CARET_SPEC_LINES) + '\n' +
    '  ★늘었으면 — ★그 자리가 ★명부 주인(지금 comparison)에서도 참인지 ★재라. 아니면 ArrowDown·End 로 ★세워라.\n' +
    '  ★줄었으면 — 좋은 일이다. ★이 줄을 고쳐라.\n' +
    '  ⚠️줄 번호로 적은 명부다 — spec 에 줄이 끼면 ★여기도 같이 고쳐야 한다(그게 ★사람에게 알리는 몫이다).');
  /* ★HM3(네 주인 공용)의 그 한 자리는 ★반드시 End 를 갖는다 — ★이 회귀의 ★바로 그 줄 */
  const hm3 = sites.filter(s => /'End'/.test(s.l));
  assert.ok(hm3.length >= 1,
    '★캐럿을 ★키로 세우는 자리가 ★0곳이다 ⇒ ★HM3(비교)가 ★다시 빨개진다. 실측으로 고른 손짓은 ' +
    "['ArrowDown', 'End', ...shiftLeft(3)] 이다(네 후보 중 ★주인 둘에서 모두 DDD 인 것은 이것뿐).");
  for (const s of hm3) assert.match(s.l, /'ArrowDown'/,
    '★' + s.ln + '행: End 는 있는데 ArrowDown 이 없다 ⇒ ★캐럿이 ★첫 시각 줄에 있으면 ★그 줄 끝으로 간다(실측: "BBB" 를 골랐다)');
});
