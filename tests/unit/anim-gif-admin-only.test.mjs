/* ═══════════════════════════════════════════════════════════════════════════
   anim-gif-admin-only.test.mjs — 「애니메이션 GIF 만들기」의 ★공개 범위를 잠근다.
   ───────────────────────────────────────────────────────────────────────────
   ★★2026-10-21 현빈: 「gif는 우선 ★어드민용으로만 ★공개」.
     ⚰️2026-08-28 에 현빈이 「이번 MVP 제외」로 껐던 킬스위치를 ★다시 켠 것이다.

   ★★이 벌이 막는 사고 = 「★킬스위치 한 글자만 켜고 끝내기」.
     `ANIM_GIF_ENABLED = true` 하나만 바꾸면 ★전 사용자에게 열린다 — 현빈 말보다 ★넓다.
     그래서 ★「깃발이 켜졌다」와 ★「그래도 어드민 아니면 안 보인다」를 ★같이 단언한다.

   ⚠️이 벌의 두 축은 ★자가 다르다 — 섞어 읽지 마라.
     ⒜ 술어(`animGifVisible`) = `js/feature-flags.js` 를 ★실어서 ★부른다(행위로 잰다).
     ⒝ 깃발(`ANIM_GIF_ENABLED`) = `js/globals.js` 를 ★글로 읽는다 — ★그 파일은 ESM 이고
        최상위에서 `document` 를 읽어 단위에서 ★실리지 않는다. ⇒ 소스 게이트다(약한 자).
        ★그래서 ⒝ 에는 ★양성대조를 붙였다(아래 — 금지 꼴이 ★잡히는지 먼저 본다).

   ⛔이것은 «공개 범위»이고 ★접근통제가 아니다. GIF 만들기는 서버를 안 타므로 거부할 서버가 없고,
     콘솔에서 `window.openAnimModal(…)` 은 여전히 부를 수 있다(feature-flags.js 주석 참조).
   ═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/* 레인의 관용구 — 플레인 스크립트를 창 더미에 실어 «부른다»(tests/unit/marking-glyph.test.mjs load()). */
function loadFlags() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('js/feature-flags.js'), ctx);
  return ctx;
}

test('A0 ★전제 — feature-flags.js 가 DOM 없이 실리고 animGifVisible 이 ★함수다', () => {
  const w = loadFlags();
  assert.equal(typeof w.animGifVisible, 'function',
    '★술어가 없다 ⇒ ★아래 수는 전부 «안 쟀다»다(자가 죽은 채 초록이 되는 자리)');
});

test('A1 ★★양성 — 깃발 켜짐 ＋ 어드민이면 ★보인다', () => {
  const { animGifVisible } = loadFlags();
  assert.equal(animGifVisible(true, { isAdmin: true }), true,
    '★어드민에게 안 보이면 현빈 지시(「어드민용으로만 공개」)의 ★절반이 안 된 것이다');
});

test('A2 ★★음성 넷 — ★깃발만 켜도 ★전 사용자에게 열리지 않는다', () => {
  const { animGifVisible } = loadFlags();
  const cases = [
    ['일반 사용자',            true,  { isAdmin: false }],
    ['상태 ∅(로그인·조회 전)',  true,  null],
    ['상태 undefined',          true,  undefined],
    ['깃발 꺼짐 ＋ 어드민',      false, { isAdmin: true }],
    ['깃발 undefined ＋ 어드민', undefined, { isAdmin: true }],
    ['깃발 truthy 1 ＋ 어드민',  1,     { isAdmin: true }],   /* ⛔=== true 를 쓰는지 */
    ['isAdmin truthy 1',        true,  { isAdmin: 1 }],       /* ⛔=== true 를 쓰는지 */
  ];
  const bad = cases.filter(([, e, a]) => animGifVisible(e, a) !== false).map(([n]) => n);
  assert.deepEqual(bad, [],
    `★이 칸이 true 면 현빈 말보다 ★넓게 열린 것이다: ${bad.join(' · ')}`);
});

test('A3 깃발 — `ANIM_GIF_ENABLED` 가 ★true 다 (★소스 게이트 ＋ ★양성대조)', () => {
  const RE = /export const ANIM_GIF_ENABLED = (true|false);/;
  const src = read('js/globals.js');
  /* ★★양성대조 먼저 — 이 자가 ★false 를 ★잡는가. 안 잡으면 아래 초록은 «안 쟀다»다. */
  assert.deepEqual('export const ANIM_GIF_ENABLED = false;'.match(RE)?.[1], 'false',
    '★자가 죽었다 — false 를 못 읽는다');
  assert.equal('export const ANIM_GIF_ENABLED = true;'.match(RE)?.[1], 'true', '★자가 죽었다 — true 를 못 읽는다');
  assert.equal(RE.test('export const FIGMA_ENABLED = false;'), false, '⛔음성대조 — 다른 깃발을 잡으면 안 된다');
  const m = src.match(RE);
  assert.ok(m, '★`export const ANIM_GIF_ENABLED = …` 줄을 못 찾았다 — 이름이 바뀌었으면 이 벌을 같이 고쳐라');
  assert.equal(m[1], 'true', '★현빈 2026-10-21 「gif는 우선 어드민용으로만 공개」 ⇒ 깃발은 true 다');
});

/* ★★«주석»을 빼고 «코드»만 남긴다.
   ⛔2026-10-21 실측: 이 벌의 첫 판은 ★주석을 같이 재어 ★빨개졌다 — prop-text 의 주석에 적힌
     「⛔여기서 isAdmin 을 손으로 다시 판정하지 않는다」가 ★금지 꼴로 ★잡혔다.
     ⇒ 「그 낱말을 주석에서 피하자」가 아니라 ★자를 고치는 것이 답이다(설명은 남아야 한다). */
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

test('A4 ★쓰는 자리가 ★한 자리다 — prop-text 가 술어를 ★부르고 권한을 ★손으로 판정하지 않는다', () => {
  const src = read('js/props/prop-text.js');
  assert.match(src, /window\.animGifVisible\(/,
    '★prop-text 가 술어를 안 부른다 ⇒ 게이트가 ★그 자리에 없다');
  /* ★★자 자신부터 — 주석은 지우고 코드는 ★남겨야 한다. 둘 다 재지 않으면 아래가 무의미하다. */
  assert.equal(codeOnly('/* isAdmin */ const a = 1;').includes('isAdmin'), false, '★자가 주석을 ★못 지운다');
  assert.equal(codeOnly('// isAdmin\nconst b = 2;').includes('isAdmin'), false, '★자가 줄 주석을 ★못 지운다');
  assert.equal(codeOnly('/* 설명 */ if (st.isAdmin) {}').includes('isAdmin'), true, '★★자가 ★코드까지 지운다(너무 먹는다)');

  const at = src.indexOf('open-anim-btn');
  assert.ok(at >= 0, '★앵커(open-anim-btn)를 못 찾았다 — 이 벌이 ★빈 글을 재고 있었다');
  const anim = codeOnly(src.slice(at, at + 3000));
  assert.ok(anim.replace(/\s+/g, '').length > 200, `★코드가 ${anim.length}자다 — ★주석만 남고 코드를 못 쟀다`);
  const HAND = /isAdmin|hasRoleField/;
  assert.equal(HAND.test(anim), false,
    '⛔이 블록의 ★코드가 권한 필드를 ★손으로 본다 — 판정은 feature-flags.js ★한 자리다');
  assert.equal(HAND.test(codeOnly('if (st.isAdmin === true) {}')), true, '★★양성대조 — 금지 꼴이 ★잡혀야 한다');
});

/* ═══ A5 ★「술어의 집」을 말하는 ★모든 줄이 ★참 집을 가리킨다 ════════════════
   ⛔2026-10-21 실측 사고: `prop-text.js:301` 주석이 「가르는 자리는 ★한 자리
     (js/globals.js animGifVisible)」라 적혀 있었다. ★참 집은 feature-flags.js 다.
     A3·A4 는 ★행위와 ★금지꼴을 재지만 ★「어디에 있다고 적혀 있나」는 ★안 쟀다.
   ★★왜 이게 검사거리인가 — 이 레포에서 ★주석은 «소스 파싱 게이트»의 ★입력이다.
     사람도 그 줄을 읽고 고칠 파일을 고른다. 틀린 주소는 ★다음 사람을 ★빈 파일로 보낸다.
   ★자의 꼴: 「animGifVisible 과 *.js 가 ★같은 줄에 있으면 그 파일명은 참 집이어야」.
     ⇒ 예외 없음. 코드 호출(window.animGifVisible(…))엔 파일명이 없어 ★안 걸린다. */
const ANIM_HOME = 'feature-flags.js';
const homeMisses = (lines) => {
  const out = [];
  lines.forEach((ln, i) => {
    if (!ln.includes('animGifVisible')) return;
    for (const hit of ln.match(/[\w-]+\.js/g) || []) if (hit !== ANIM_HOME) out.push(`${i + 1}:${hit}`);
  });
  return out;
};

test('A5 ★술어의 ★집을 가리키는 줄이 ★전부 참 집이다 — ⛔낡은 주석이 단언보다 오래 산다', () => {
  /* ⑴ ★자부터 — 같은 함수에 ★양성·음성을 걸어 ★살아 있음을 증명한다 */
  assert.deepEqual(homeMisses([' * 가르는 자리는 js/globals.js 의 animGifVisible 이다']), ['1:globals.js'],
    '★★자가 죽었다 — ★틀린 주소를 ★못 잡는다(이 아래 전수는 ★「안 쟀다」가 된다)');
  assert.deepEqual(homeMisses([' * 집은 js/feature-flags.js 의 animGifVisible 이다']), [],
    '⛔음성대조 — ★맞는 주소를 ★거짓으로 잡는다');
  assert.deepEqual(homeMisses(['      const v = window.animGifVisible(flag, st);']), [],
    '⛔음성대조 — ★파일명 없는 ★코드 호출을 잡는다');
  assert.deepEqual(homeMisses([' * js/globals.js 는 ESM 이다 (술어 얘기 아님)']), [],
    '⛔음성대조 — ★그 이름이 ★없는 줄을 잡는다');

  /* ⑵ ★참 집을 ★정의 자리로 센다 — ⛔사용 자리 grep 은 거짓양·음성이 ★같이 온다 */
  const FILES = ['js/feature-flags.js', 'js/globals.js', 'js/props/prop-text.js'];
  const defs = FILES.filter((f) => /\b(?:w|window)\.animGifVisible\s*=/.test(read(f)));
  assert.deepEqual(defs, ['js/feature-flags.js'],
    `★술어를 ★정의하는 파일이 ${defs.length}곳이다 — ★한 곳이어야 한다(명부가 둘이면 주석으론 못 막는다)`);

  /* ⑶ 전수 */
  const bad = FILES.flatMap((f) => homeMisses(read(f).split('\n')).map((h) => `${f}:${h}`));
  assert.deepEqual(bad, [],
    `★술어의 집을 ★틀리게 가리키는 줄 ${bad.length}건 (참 집 = js/${ANIM_HOME}):\n  ${bad.join('\n  ')}`);
});
