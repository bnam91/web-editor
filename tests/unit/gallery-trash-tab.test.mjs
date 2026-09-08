/* 단위(정적) — pages/projects.html 갤러리 탭의 「휴지통」 아이콘화.
 *
 * ■현빈 지시 둘 (2026-09-08)
 *   「Projects 옆에 휴지통은 휴지통 이모지로 두자 한글로 휴지통 있으니 좀 보기 그러네」
 *   「휴지통에 숫자는 안 알려줘도 돼」
 *
 * ★이 파일이 «잠그는» 것은 셋이다.
 *   ⑴ 글자로 되돌아가지 않는다
 *   ⑵ ★아이콘이 되면서 «이름»을 잃지 않는다  ← 이게 이 레포의 기존 병이다
 *        실측(2026-09-08): 피그마 우측 패널 아이콘 버튼 32/32 «전부» aria-label 을 갖는다.
 *        고디터 정렬 버튼 146개 중 aria-label 0개, title 조차 없는 것이 56개.
 *        ⇒ 아이콘화는 «이름을 붙이는 일»과 «한 세트»여야 한다.
 *   ⑶ 배지를 걷어낸 자리가 «터지지» 않는다(죽은 함수의 guard)
 *
 * ⛔정적 검사다 — 이모지가 «글자를 안 누르는지»는 여기서 못 잰다(헤드리스 렌더로 눈으로 봤다).
 *   OS·폰트별 이모지 모양은 «미확인». 이 맥에서만 봤다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

/* ★주석 걷기는 «공용 부품»을 쓴다 — 자기 stripComments 를 만들지 않는다.
     이 레포엔 같은 일을 하는 벌이 11개 있었고 9개가 `accept="image/*"` 에서 부서져 있었다. */
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(__dirname, '../../pages/projects.html'), 'utf8');

/* 탭 버튼 하나를 여는 태그부터 닫는 태그까지 통째로 집는다. */
const TAB = (() => {
  const i = HTML.indexOf('id="gal-tab-trash"');
  if (i < 0) return null;
  const open = HTML.lastIndexOf('<button', i);
  const close = HTML.indexOf('</button>', i);
  return (open < 0 || close < 0) ? null : HTML.slice(open, close + '</button>'.length);
})();

/* ── GT-0 ★입력이 «살아 있다» ────────────────────────────────────────
   ⚠️이 검사가 없으면 아래가 통째로 «공회전»한다 — 버튼을 지워버리면
     GT-1(한글 없음)도 GT-4(배지 없음)도 «스스로» 초록이 된다.
   ★오늘 이 팀이 실제로 물린 병이다: 표를 비우니 루프 검사 6개가 전부 통과했다. */
test('GT-0 ★휴지통 탭 버튼이 실재한다 (이게 없으면 아래 검사들이 공회전한다)', () => {
  assert.ok(TAB, '#gal-tab-trash 버튼을 못 찾았다 — 탭이 사라졌거나 마크업이 바뀌었다');
  assert.match(TAB, /class="[^"]*\bgal-tab\b/, '.gal-tab 클래스가 빠졌다 — 탭 스타일을 통째로 잃는다');
});

test('GT-1 탭에 한글 「휴지통」이 «내용»으로 있지 않다', () => {
  const inner = TAB.replace(/<button[^>]*>/, '').replace(/<[^>]+>/g, '');
  assert.ok(!inner.includes('휴지통'),
    '탭 내용이 글자로 돌아갔다 — 같은 줄에 Projects(영문)와 휴지통(한글)이 다시 섞인다: ' + inner.trim());
});

test('GT-2 🗑 이모지가 «내용»이고, 스크린리더에는 감춰져 있다', () => {
  assert.ok(/🗑/.test(TAB), '휴지통 이모지가 없다 — 탭에 아무 그림도 없다');
  const span = TAB.match(/<span([^>]*)>[^<]*🗑/);
  assert.ok(span, '이모지가 <span> 안에 있지 않다');
  assert.match(span[1], /aria-hidden="true"/,
    '이모지에 aria-hidden 이 없다 — 스크린리더가 이름과 이모지를 «두 번» 읽는다');
});

/* ── GT-3 ★아이콘이 «이름»을 잃지 않는다 ────────────────────────────
   그림만 남으면 마우스로도(title) 스크린리더로도(aria-label) 이 버튼이 뭔지 알 수 없다. */
test('GT-3 ★이름이 둘 다 붙어 있다 — title(마우스) · aria-label(스크린리더)', () => {
  const open = TAB.match(/<button[^>]*>/)[0];
  assert.match(open, /title="휴지통"/,      'title 이 없다 — 마우스를 올려도 이름이 안 뜬다');
  assert.match(open, /aria-label="휴지통"/, 'aria-label 이 없다 — 스크린리더에 이름이 없는 버튼이 된다');
});

/* ⚠️★처음 이 검사는 «주석을 안 걷고» 통짜로 봐서 «빨갛게» 떴다 —
     걸린 것은 되살리는 법을 적어둔 주석 속 `<span id="gal-trash-count">` 였다.
   ⇒ 배지는 실제로 없었는데 검사가 있다고 했다. 오늘 세 번째로 만난 «재는 자리가 틀린» 병이다
     (그 반대 — 아무것도 안 보고 초록 — 만 위험한 게 아니다). */
const CODE = stripComments(HTML);

test('GT-4 개수 배지가 마크업에도 CSS 에도 남아 있지 않다 (주석은 «걷고» 본다)', () => {
  assert.ok(!/id="gal-trash-count"/.test(CODE),
    '#gal-trash-count 요소가 돌아왔다 — 현빈: 「휴지통에 숫자는 안 알려줘도 돼」');
  assert.ok(!/#gal-trash-count\s*\{/.test(CODE),
    '#gal-trash-count CSS 규칙이 남았다 — 붙일 데 없는 규칙이 쌓인다');
  assert.ok(!/gal-trash-count/.test(TAB),
    '탭 버튼 안에 배지가 다시 들어왔다');
});

/* ★GT-4 가 «주석을 걷어서» 통과하는 것이지, 주석까지 통째로 사라져서 통과하는 게 아님을 못박는다.
   ⛔이게 없으면 stripComments 가 파일을 통째로 비워도 GT-4 는 초록이다. */
test('GT-4b ★주석 걷기가 «파일을 지워버린» 게 아니다 (GT-4 의 공회전 방지)', () => {
  assert.ok(CODE.includes('id="gal-tab-trash"'),
    '주석을 걷었더니 마크업까지 사라졌다 — GT-4 의 「없다」는 이제 아무 뜻이 없다');
  assert.ok(/gal-trash-count/.test(HTML),
    '되살리는 법을 적은 주석이 사라졌다 — 그러면 GT-4 는 주석을 걷을 필요도 없어 «걷는지»를 못 잰다');
});

/* ── GT-5 «크기만» 낮췄다 ───────────────────────────────────────────
   .gal-tab-icon 이 색·hover·is-on 을 자기 것으로 새로 정하면 탭 둘의 색이 갈라진다. */
test('GT-5 .gal-tab-icon 은 크기만 손댄다 (색을 새로 정하지 않는다)', () => {
  const m = HTML.match(/\.gal-tab-icon\s*\{([^}]*)\}/);
  assert.ok(m, '.gal-tab-icon 규칙이 없다 — 이모지가 h1 크기를 그대로 상속해 글자를 누른다');
  assert.match(m[1], /font-size\s*:/, 'font-size 가 없다 — 크기를 안 낮추면 규칙을 둘 이유가 없다');
  assert.ok(!/(^|[;\s])(color|background)\s*:/.test(m[1]),
    '.gal-tab-icon 이 색을 스스로 정한다 — .gal-tab 의 색·hover·is-on 과 갈라진다: ' + m[1].trim());
});

/* ── GT-6 배지를 걷어낸 자리가 «터지지» 않는다 ─────────────────────
   refreshTrashCount 는 호출부 3곳이 살아 있는 채로 «아무 일도 안 하는» 함수가 됐다.
   guard 가 빠지면 부팅 때마다 null 참조로 터진다. */
test('GT-6 ★refreshTrashCount 가 요소 없음을 «막고» 있다 (호출부가 살아 있다)', () => {
  const i = HTML.indexOf('async function refreshTrashCount()');
  assert.ok(i > 0, 'refreshTrashCount 가 없다 — 지웠다면 호출부 3곳도 같이 지웠는지 확인해라');
  const body = HTML.slice(i, i + 400);
  assert.match(body, /getElementById\('gal-trash-count'\)/, '배지를 찾는 줄이 없다');
  assert.match(body, /if\s*\(!\s*el\s*\)\s*return/,
    '★guard 가 빠졌다 — 배지가 없는 지금, 이 함수가 불릴 때마다 터진다');

  const calls = (HTML.match(/refreshTrashCount\(/g) || []).length
              - (HTML.match(/function refreshTrashCount\(/g) || []).length;
  assert.ok(calls > 0,
    '부르는 곳이 0곳이다 — 그러면 guard 검사도 «공회전»이다. 함수를 아예 지우고 이 검사도 지워라');
});
