/* disclosure-chevron-ssot.test.mjs — 접이식 절 머리 쉐브론은 «한 벌»이다. (T-234, 2026-09-27)
 *
 * ★★무엇이 있었나 — 네 곳(prop-grid · prop-banner02 · prop-simple-card · prop-table)이 «들여쓰기까지
 *   똑같은» SVG 를 각자 인라인으로 그렸다. 다른 것은 «회전을 정하는 표현식» 하나뿐이었다.
 *   ★그리고 네 곳 주석이 「★네 곳에 같은 마크업으로 산다 … ⛔여기서 «따로» 그리지 마라」라고
 *   ★이미 적고 있었다 — 말은 있었고 «자리»가 없었다.
 *
 * ★★이 카드를 세는 과정에서 수가 세 번 갈렸다 — 그 까닭을 여기 남긴다:
 *   ⑴ 「전수 14 → 고칠 것 9」 ⛔그 아홉에 ★주석 «넷»이 섞여 있었다.
 *   ⑵ 내 첫 자는 «꼴 가족»(`M<x> <y>l<a> <a> <a>-<a>`)이라 10파일 29곳 — fill 삼각형·레이어 표식까지 셌다.
 *   ⑶ ★주석을 걷고 재니 참값 = **전수 14 = 코드 6 ＋ 주석 4 ＋ tests 4** · 고칠 것 = `M1 3l` **4곳**.
 *   ⇒ ★★주석을 안 걷으면 「네 파일이 둘씩 든다 ⇒ «쌍»이다 ⇒ 하나만 바꾸면 깨진다」로 읽히고,
 *     거기서 **「현빈께 여쭤야 한다」**까지 갔다. 걷어 보니 물음 자체가 측정 오류의 산물이었다.
 *
 * ⛔`--ui-select-caret` 토큰(10×6)으로는 못 모은다 — 그쪽은 CSS `background-image`, 이쪽은 인라인
 *   `<svg>` 요소다(★매체가 다르다). 억지로 모으면 «보이는 것»이 바뀐다 ⇒ 그 둘은 범위 밖이다.
 *
 * ★무엇을 잠그나
 *   C1  ★★산출이 «옛 마크업과 바이트 동일»이다 — 골든(옛 판 7c1371d0 의 문자열을 박아 둔다)
 *   C2  펼침 0° · 접힘 −90°
 *   C3  ★네 파일이 그 한 벌을 쓴다 ＋ ⛔인라인 SVG 지문이 되살아나면 빨강
 *   C4  ★`M1 3l4 4 4-4` 가 js/props/ «코드»에 한 곳뿐이다(주석은 공용 부품으로 걷는다)
 *   N1  음성대조 — 회전 분기를 떼면 C2 가 빨개진다
 *
 * 실행: node --test tests/unit/disclosure-chevron-ssot.test.mjs
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
const { makeStripper } = createRequire(import.meta.url)('./_strip-comments.js');

const HELPERS = read('js/props/_helpers.js');
/** ⛔`import` 로 못 가져온다 — package.json 에 `type:module` 이 없어 node 는 이 저장소의 `.js` 를
    CommonJS 로 본다. ⇒ 이 저장소 관례대로 «소스를 떠서» 돌린다. */
function chevronFn() {
  const m = /export function disclosureChevronHtml\(open\) \{[\s\S]*?\n\}/.exec(HELPERS);
  assert.ok(m, 'disclosureChevronHtml 을 못 찾았다 — 패턴을 갱신하라');
  return new Function(m[0].replace('export ', '') + '; return disclosureChevronHtml;')();
}

/* ★골든 — 판 `7c1371d0` 의 네 곳 인라인 마크업(회전값만 채운 꼴). ⛔한 자도 고치지 마라:
   이 문자열이 「보이는 것이 안 바뀌었다」의 증거다. 고치려면 «왜 화면이 바뀌어도 되나»를 먼저 적어라. */
const GOLDEN_OPEN = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round"
             style="flex:0 0 auto;transform:rotate(0deg);transition:transform .12s;">
          <path d="M1 3l4 4 4-4"/>
        </svg>`;
const GOLDEN_SHUT = GOLDEN_OPEN.replace('rotate(0deg)', 'rotate(-90deg)');

test('C1 ★★산출이 «옛 마크업과 바이트 동일»이다 — 보이는 것이 안 바뀌었다는 증거', () => {
  const f = chevronFn();
  assert.equal(f(true), GOLDEN_OPEN, '★펼침 산출이 옛 마크업과 다르다');
  assert.equal(f(false), GOLDEN_SHUT, '★접힘 산출이 옛 마크업과 다르다');
  /* ★길이까지 적어 둔다 — 공백 하나 차이도 여기서 드러난다. */
  assert.equal(f(true).length, 272);
  assert.equal(f(false).length, 274);
});

test('C2 펼침 0° · 접힘 −90° — 방향을 뒤집으면 화살표가 딴 데를 가리킨다', () => {
  const f = chevronFn();
  assert.match(f(true), /rotate\(0deg\)/);
  assert.match(f(false), /rotate\(-90deg\)/);
});

const USERS = ['js/props/prop-grid.js', 'js/props/prop-banner02.js',
               'js/props/prop-simple-card.js', 'js/props/prop-table.js'];

test('C3 ★네 파일이 그 한 벌을 쓴다 — ⛔인라인 SVG 가 되살아나면 빨개진다', () => {
  for (const rel of USERS) {
    const src = read(rel);
    assert.match(src, /disclosureChevronHtml\(/, `${rel}: ★한 벌을 안 부른다`);
    assert.match(src, /from '\.\/_helpers\.js'/, `${rel}: ★_helpers 를 안 쓴다`);
    /* ⛔옛 지문 — 이 조각을 «다시» 인라인으로 쓰면 네 벌로 돌아간다. 주석은 걷고 본다
       (네 곳 주석이 이 그림을 «인용»하고 있어서, 안 걷으면 이 단언이 늘 빨개진다). */
    const strip = makeStripper();
    const code = src.split('\n').map(l => strip(l)).join('\n');
    assert.equal(/<svg width="10" height="10" viewBox="0 0 10 10"/.test(code), false,
      `${rel}: ★★인라인 쉐브론 SVG 가 되살아났다 — 네 곳이 «따로 늙는다»(그래서 이 카드가 섰다)`);
  }
});

test('C4 ★`M1 3l4 4 4-4` 는 js/props/ «코드»에 한 곳뿐이다', () => {
  const dir = path.join(ROOT, 'js/props');
  const hits = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const strip = makeStripper();
    read(path.join('js/props', f)).split('\n').forEach((line, i) => {
      if (/M1 3l4 4 4-4/.test(strip(line))) hits.push(`js/props/${f}:${i + 1}`);
    });
  }
  /* ⛔여기에 «자기 자신과 비교하는» 줄을 한 번 썼다(아무것도 단언하지 않는 «검사처럼 생긴 문장»).
     지웠다 — 세는 것은 아래 두 줄이 전부다. */
  assert.equal(hits.length, 1, `★코드에 ${hits.length} 곳이다: ${hits.join(' · ')}`);
  assert.match(hits[0], /_helpers\.js/, `★그 한 곳이 «공용 자리»가 아니다: ${hits[0]}`);
});

test('N1 ★음성대조 — 회전 분기를 떼면 C2 가 빨개진다', () => {
  const ANCHOR = 'rotate(${open ? 0 : -90}deg)';
  assert.ok(HELPERS.includes(ANCHOR), '★변이 닻을 못 찾았다 — 이 음성대조는 «안 재고» 있다');
  const m = /export function disclosureChevronHtml\(open\) \{[\s\S]*?\n\}/
    .exec(HELPERS.replace(ANCHOR, 'rotate(0deg)'));
  const f = new Function(m[0].replace('export ', '') + '; return disclosureChevronHtml;')();
  assert.equal(/rotate\(-90deg\)/.test(f(false)), false,
    '★분기를 떼었는데도 −90 이 나온다 — 이 음성대조는 «안 재고» 있다');
});
