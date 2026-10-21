/* ═══════════════════════════════════════════════════════════════════════════
   SHD — ★조각을 ★일반 `<script>` 로 심는 spec 은 ★★외부 이름 가드를 ★불러야 한다

   ★★왜 이 파일이 있나 — ★261021 사고(지디):
     `tests/dom/overlay-float-frame-drag-conflict.dom.spec.js` 가 `sliceBlock` 으로
     `bindFrameDropZone`(★555줄)을 떼어 ★일반 `<script>` 로 심는데, ★그 조각은
     ★`js/block-drag.js` 의 ★import 이름을 ★★17개 부른다. ★하네스는 ★8개를 ★안 줬다.
     ★그 8개는 ★안 닿는 갈래에 있어 ★조용했고 — ★`a42d76d5`(지디 · 1020t1d ⒞)가
     ★`localStartFromStyle` 을 ★닿는 갈래에 넣자 ★★ReferenceError 로 ★터졌다.
     ★★그 spec 엔 ★가드가 ★있었다(「하네스가 늙었다」) — ★가드 ★줄 하나만 봤다 ⇒ ★못 잡았다.
   ★★그리고 ★두 번째 사고 — ★내가 ★`_slice-block.js` 에 ★파생 가드 ★능력을 넣고
     ★한 벌에만 ★불러 넣은 뒤 ★「걸렸다」로 읽었다. ★`resize-undo-history.dom.spec.js` 의
     ★같은 병(★잠복 — 조건이 거짓이라 ★안 불린다)은 ★사람이 ★손으로 찾아야 했다(태양/S6).
     ⇒ ★★「★능력」과 ★「★집행」은 ★다르다. ★이 파일이 ★집행이다.

   ★무엇을 재나 — ★명부 구동(⛔파일 이름을 ★손으로 적지 않는다):
     ⑴ `tests/dom/**.spec.js` 중 `sliceBlock(` 을 쓰고
     ⑵ 그 결과를 ★`<script>`(type=module 없는) 안에 ★`${…}` 로 심는 것을 ★고르고
     ⑶ 그것이 ★`assertDepsProvided` 를 ★부르는지 단언한다
   ★예외는 ★이 파일 ★KNOWN_GAPS 에 ★까닭과 함께 적는다 — ⛔주석으로 눙치지 않는다
   ═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DOM = path.join(ROOT, 'tests/dom');
const read = (p) => fs.readFileSync(p, 'utf8');

/* ★★면제 명부 — ⛔「아직 안 고쳤다」를 ★여기 적어 두고 ★그 까닭을 ★같이 쓴다.
 *   ★비어 있는 것이 ★정상이고, ★한 줄이 늘면 ★누가·왜·언제 를 ★같이 적어라. */
const KNOWN_GAPS = {
  'frame-float-group.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
  'overlay-group-zorder.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
  'qa0919-fixes.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
  'redact-mosaic-killswitch.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
  'shape-frame-wrap-group.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
  'shape-handle-resize.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
  'shape-rotate-minheight.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
  'ul-groupdup.dom.spec.js':
    '★261021 — ★아직 안 걸었다. ★★검토 판 = ★`0.9.9`.'
    + ' ⚠️★막던 까닭은 ★죽었다 — ★「srv DOM 금지라 ★돌릴 창이 없다」였는데 ★261021 에 ★창이 ★둘 생겼다'
    + ' (아이맥 · 인텔). ⇒ ★★이제는 ★「아직 안 했다」이지 ★「못 한다」가 ★아니다.'
    + ' ★걸는 법 = `overlay-float-frame-drag-conflict` 와 같은 꼴(probe → sliceExternalDeps → assertDepsProvided).'
    + ' ★그때까지 ★이 spec 의 초록은 ★「안 재고 있다」일 수 있다.',
};

/** ★조각을 ★페이지로 ★심는 spec 을 ★파생으로 고른다.
 *  ★★심는 길이 ★셋이다(★261021 실측) — ⛔「일반 script」로 좁히면 ★둘을 놓친다:
 *    ⑴ 인라인 `<script>` 안 보간            (overlay-float-frame-drag-conflict)
 *    ⑵ ★서빙되는 모듈 파일로 조립 → `<script type="module" src>`  (resize-undo-history)
 *    ⑶ ★`page.addScriptTag({ content })`     (redact-mosaic-killswitch)
 *  ⇒ ★★그래서 분모는 ★「`tests/dom` 의 spec 이 `sliceBlock` 을 쓰나」다.
 *    ★DOM spec 이 조각을 뜨는 까닭은 ★페이지에 심기 위함이고, ★단위검사처럼
 *    ★문자열만 단언하는 경우는 ★거의 없다. ⇒ ★넓게 잡고 ★예외는 ★명부로 적는다.
 *  ★★내 첫 고르개가 ★「일반 script」였다 — ★그래서 SHD2 가 ★거짓 초록을 냈다.
 *    ★그게 ★내가 잡으려던 ★그 병이었다(「초록 = 안 재고 있다」). ★고르개를 ★넓혔다. */
function sliceUsingDomSpecs() {
  return fs
    .readdirSync(DOM)
    .filter((n) => n.endsWith('.spec.js'))
    .sort()
    .map((f) => ({ file: f, src: read(path.join(DOM, f)) }))
    .filter((x) => x.src.includes('sliceBlock('));
}

test('SHD1 ★전제 — 조각을 일반 script 에 심는 spec 이 ★하나 이상 있다(★자가 안 죽었나)', () => {
  const list = sliceUsingDomSpecs();
  assert.ok(
    list.length >= 1,
    '★0건이다 — ★`sliceBlock` 관용구가 사라졌거나 ★내 고르개가 ★죽었다.\n' +
      '  ⛔「0건이라 통과」로 읽지 마라. ★고르개를 먼저 의심해라'
  );
});

test('SHD2 ★그 spec 들은 ★`assertDepsProvided` 를 ★부른다 (★파생 가드 집행)', () => {
  const bad = [];
  for (const { file, src } of sliceUsingDomSpecs()) {
    if (KNOWN_GAPS[file]) continue;
    if (!src.includes('assertDepsProvided(')) bad.push(file);
  }
  assert.deepEqual(
    bad,
    [],
    '★조각을 ★일반 script 에 심는데 ★외부 이름 가드를 ★안 부르는 spec 이 있다:\n' +
      bad.map((f) => `  · ${f}`).join('\n') +
      '\n  ⇒ `const { sliceExternalDeps, assertDepsProvided, declaresName } = require(\'../unit/_slice-block.js\')` 뒤\n' +
      '     ★하네스가 안 주는 이름을 ★원본에서 떼어 심고 ★`assertDepsProvided(...)` 로 ★단언해라.\n' +
      '  ⛔「지금은 안 깨진다」는 ★안전이 아니라 ★「안 재고 있다」다(261021 · resize-undo-history 잠복).\n' +
      '  ★면제가 필요하면 ★이 파일 KNOWN_GAPS 에 ★까닭과 함께 적어라'
  );
});

test('SHD3 ★공용 자가 ★그 셋을 ★내보낸다 (★능력이 살아 있나)', () => {
  const s = read(path.join(ROOT, 'tests/unit/_slice-block.js'));
  for (const n of ['sliceExternalDeps', 'assertDepsProvided', 'declaresName']) {
    assert.match(s, new RegExp(`\\bfunction ${n}\\b`), `★\`${n}\` 가 _slice-block.js 에 없다`);
    assert.match(s, new RegExp(`module\\.exports[\\s\\S]*\\b${n}\\b`), `★\`${n}\` 가 ★export 안 돼 있다`);
  }
});

test('SHD4 ★항등식 방지 — ★이 자가 ★정말 거를 수 있나(★전부를 고르지 않는다)', () => {
  const all = fs.readdirSync(DOM).filter((n) => n.endsWith('.spec.js'));
  const picked = new Set(sliceUsingDomSpecs().map((x) => x.file));
  assert.ok(picked.size > 0, '★0벌을 골랐다 — ★고르개가 죽었다');
  assert.ok(
    picked.size < all.length,
    `★전체 ${all.length}벌을 ★다 골랐다 — ★그러면 ★이 자는 ★아무것도 ★가르지 않는다`
  );
  /* ★골라진 것은 ★정말 sliceBlock 을 쓰고, ★안 골라진 것은 ★안 쓴다 — ★양쪽을 센다 */
  for (const { file, src } of sliceUsingDomSpecs()) {
    assert.ok(src.includes('sliceBlock('), `★${file} 이 골라졌는데 sliceBlock 이 없다`);
  }
  for (const f of all.filter((x) => !picked.has(x))) {
    assert.ok(
      !read(path.join(DOM, f)).includes('sliceBlock('),
      `★${f} 는 sliceBlock 을 쓰는데 ★안 골라졌다 — ★고르개가 ★좁다`
    );
  }
});

test('SHD5 ★래칫 — ★면제 명부는 ★줄기만 한다(⛔늘면 빨강)', () => {
  const picked = sliceUsingDomSpecs();
  const unguarded = picked.filter((x) => !x.src.includes('assertDepsProvided(')).map((x) => x.file);
  const listed = Object.keys(KNOWN_GAPS).sort();
  /* ★명부 ⊇ 실패집합 — ★명부에 없는 미호출이 ★0건이어야 한다 */
  assert.deepEqual(
    unguarded.filter((f) => !KNOWN_GAPS[f]),
    [],
    '★면제 명부에 ★없는데 ★가드를 안 부르는 spec 이 ★생겼다 — ★걸거나 ★명부에 ★까닭과 함께 적어라'
  );
  /* ★명부 밖 0건 — ★이미 고친 것이 ★명부에 남아 있으면 ★지워라(★썩은 면제다) */
  const stale = listed.filter((f) => !unguarded.includes(f));
  assert.deepEqual(
    stale,
    [],
    '★면제 명부에 ★썩은 줄이 있다(★이미 가드를 부르거나 ★sliceBlock 을 안 쓴다) — ★지워라:\n' +
      stale.map((f) => `  · ${f}`).join('\n')
  );
  /* ★수를 ★찍어 둔다 — ★다음 사람이 ★「몇 개 남았나」를 ★바로 본다 */
  assert.ok(
    unguarded.length <= listed.length,
    `★미호출 ${unguarded.length} > 명부 ${listed.length}`
  );
});

/* ★★★SHD7 — ★면제에 ★«상대 참조»를 ★못 쓰게 ★구조로 막는다 (261021)
 *   ★까닭: 같은 날 `tests/dom/EXPECT_N.md` 에서 ★「떼는 조건 = ★«다음 버전»」으로 미뤄 둔 것 ★둘을 찾았다.
 *     ★그 ★«다음 버전»이 ★이미 ★0.9.9(= 지금 만드는 판)였는데 ★★아무도 안 꺼냈다 — ★한 건은
 *     ★이미 한도를 ★4~6 넘어 ★두 칸이 ★영구 빨강이었다(modal-frameify-pixel `빈칸` px 704~706 vs 700).
 *   ★★까닭의 까닭: ★「다음」은 ★★상대 참조다. ★판 번호로 ★고정되지 않으면 ★그 판이 ★조용히 지나간다.
 *   ⇒ ★그리고 ★★이 파일의 면제 8줄도 ★같은 병이었다 — ★「그 레인이 ★손댈 때」였다. ★판 번호로 바꿨다.
 *   ⇒ ★★이 자가 ★그 재발을 막는다: ★면제 줄에 ★판 번호가 ★없으면 ★빨강.
 *   ⛔「다음 버전」·「나중에」·「그때」·「손댈 때」로 ★미루지 마라 — ★★재는 자가 없는 조건은 ★안 지켜진다. */
test('SHD7 ★면제 줄은 ★«판 번호»를 ★갖는다 (⛔「다음 버전」 같은 상대 참조 금지)', () => {
  const REL = ['다음 버전', '다음번', '나중에', '그때 가서', '손댈 때', '언젠가', '추후'];
  const bad = [];
  for (const [f, why] of Object.entries(KNOWN_GAPS)) {
    if (!/0\.\d+\.\d+/.test(why)) bad.push(`  · ${f} — ★판 번호가 없다`);
    const hit = REL.filter((r) => why.includes(r));
    if (hit.length) bad.push(`  · ${f} — ★상대 참조: ${hit.join(', ')}`);
  }
  assert.deepEqual(
    bad, [],
    '★면제 줄에 ★판 번호가 없거나 ★상대 참조가 있다 — ★★「다음 버전」은 ★조용히 지나간다'
      + '(261021 EXPECT_N.md 실사고: ★그 «다음»이 이미 0.9.9 였고 두 칸이 영구 빨강이었다):\n'
      + bad.join('\n')
  );
  /* ★★자가 사는지 — ★양성·음성 ★둘 다 ★이 자리에서 */
  const probe = (why) => !/0\.\d+\.\d+/.test(why) || REL.some((r) => why.includes(r));
  assert.equal(probe('★검토 판 = 0.9.9 · 아직 안 걸었다'), false, '★음성대조: 판 번호가 있으면 ★통과해야 한다');
  assert.equal(probe('★다음 버전에 뗀다'), true, '★★양성대조: 「다음 버전」은 ★잡혀야 한다');
  assert.equal(probe('★그 레인이 손댈 때'), true, '★★양성대조: 「손댈 때」는 ★잡혀야 한다');
  assert.equal(probe('★아직 안 걸었다'), true, '★★양성대조: 판 번호가 ★없으면 ★잡혀야 한다');
});

/* ★★★SHD8 (261021) — ★SHD7 의 자를 ★`tests/dom/EXPECT_N.md` 까지 넓힌다.
 *   ★까닭(★실측): SHD7 은 ★이 파일의 `KNOWN_GAPS` ★만 재고, ★미룸 장부인 EXPECT_N.md 는 ★안 쟀다.
 *     그 사이 그쪽 두 줄은 ★「떼는 조건 = ★«다음 버전»」으로 남아 있었다.
 *   ★★그 「다음」이 ★몇 판 지나갔나 — ★태그로 쟀다:
 *     `DEFER_PX` 들인 날 ★2026-10-12(eaab4bbe) · 그때 나간 판 ★0.9.6(v0.9.6 = 10-06)
 *     ⇒ 당시 「다음 버전」 = ★0.9.7 → ★v0.9.7 이 ★10-13 에 나갔다 · ★v0.9.8 도 ★10-19 에 나갔다
 *   ⇒ ★★★「다음 버전」이 ★★두 판 지나갔다. ⛔내가 261021 아침 SHD7 주석에 「그 다음이 이미 0.9.9」라
 *     적은 것은 ★★한 판 ★덜 센 것이다 — 그 수를 여기서 고친다.
 *   ⇒ ★★재는 자가 없는 조건은 ★안 지켜진다. 그래서 ★장부 쪽에도 자를 둔다. */
test('SHD8 ★EXPECT_N.md 의 ★미룸 절도 ★«판 번호»를 ★갖는다 (⛔상대 참조 금지)', () => {
  const REL = ['다음 버전', '다음번', '나중에', '그때 가서', '손댈 때', '언젠가', '추후'];
  const VER = /0\.\d+\.\d+/;
  /* ★분모 — 「미룸 절」의 ★정의 자리를 여기 둔다. ⛔낱말 하나로 grep 하지 않는다. */
  const DEFERRING = /미룬다|미룬 것|가리는 이름|떼는 법/;
  const judge = (md) => {
    const secs = md.split(/^## /m).slice(1).filter((b) => DEFERRING.test(b));
    const bad = [];
    for (const b of secs) {
      const title = b.split('\n')[0].slice(0, 60);
      const lines = b.split('\n').filter((l) => l.includes('떼는 조건'));
      if (!lines.length) { bad.push(`  · ${title} — ★「떼는 조건」 줄이 ★없다`); continue; }
      for (const l of lines) {
        if (!VER.test(l)) bad.push(`  · ${title} — ★판 번호가 없다: ${l.trim().slice(0, 70)}`);
        const hit = REL.filter((r) => l.includes(r));
        if (hit.length) bad.push(`  · ${title} — ★상대 참조(${hit.join(', ')})`);
      }
    }
    return { n: secs.length, bad };
  };

  /* ★★자가 사는지 — ★양성 셋 ＋ ★음성 하나를 ★이 자리에서.
     ⛔★261021 실측: 첫 판은 양성 ⒜ 의 기대값을 ★`1` 이라 적어 ★스스로 빨개졌다 — 참값은 ★`2` 다
       (「떼는 조건 = 다음 버전」은 ★⑴판 번호 없음 ＋ ⑵상대 참조 ★둘을 낸다).
       ⇒ ★★양성대조가 묻는 것은 「★몇 건이냐」가 아니라 「★잡혔나」다 ⇒ ★`> 0` 으로 적는다.
       ★「대조군을 돌리는 자도 대조가 필요하다」 — 그 비석이다. */
  assert.ok(judge('## ★미룬 것 A\n- 떼는 조건 = ★«다음 버전»\n- 떼는 법 = 한 줄\n').bad.length > 0,
    '★★양성대조: 「다음 버전」이 ★잡혀야 한다');
  assert.ok(judge('## ★미룬 것 B\n- 떼는 법 = 한 줄\n').bad.length > 0,
    '★★양성대조: 「떼는 조건」 줄이 ★없으면 잡혀야 한다');
  assert.equal(judge('## ★미룬 것 C\n- 떼는 조건 = ★판 0.9.9\n- 떼는 법 = 한 줄\n').bad.length, 0,
    '★음성대조: 판이 박혀 있으면 ★통과해야 한다');
  assert.equal(judge('## 현재값\n- 아무 미룸도 없다\n').n, 0,
    '⛔음성대조: 미룸이 아닌 절을 ★분모에 넣으면 안 된다');

  const md = read(path.join(ROOT, 'tests/dom/EXPECT_N.md'));
  const got = judge(md);
  assert.ok(got.n > 0,
    '★★EXPECT_N.md 에서 ★미룸 절을 ★0개 찾았다 ⇒ ★★아래 초록은 «안 쟀다»다(제목 꼴이 바뀌었으면 ★분모를 고쳐라)');
  assert.deepEqual(got.bad, [],
    `★EXPECT_N.md 의 미룸 절 ${got.n}개 중 ★판이 안 박힌 곳이 있다 — ★★「다음」은 ★조용히 지나간다`
      + '(★실측: 2026-10-12 에 쓴 「다음 버전」이 ★v0.9.7·v0.9.8 ★두 판을 지나쳤다):\n'
      + got.bad.join('\n'));
});

test('SHD6 ★★가드 ★자체를 ★잰다 — ⛔「세워 둔 방어」는 ★「발동한 방어」가 아니다', async () => {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const { sliceExternalDeps, assertDepsProvided, declaresName } = req('./_slice-block.js');

  /* ★가짜 원본 — import 둘 · 조각이 ★하나만 부른다 */
  const SRC = [
    "import { alpha, beta } from './x.js';",
    "import gamma from './y.js';",
    'function target() { return alpha(1) + gamma(2); }',
  ].join('\n');
  const SLICE = 'function target() { return alpha(1) + gamma(2); }';

  /* ⑴ ★파생이 ★부르는 것만 고르나 — `beta` 는 ★안 불린다 */
  assert.deepEqual(sliceExternalDeps(SRC, SLICE), ['alpha', 'gamma'],
    '★조각이 부르는 외부 이름만 골라야 한다(beta 는 import 됐지만 ★안 불린다)');

  /* ⑵ ★★양성 — ★하나가 빠지면 ★던진다 */
  assert.throws(
    () => assertDepsProvided(SLICE, SRC, 'function alpha(){}', 'SHD6-양성'),
    (e) => /gamma/.test(e.message) && /빠짐/.test(e.message),
    '★`gamma` 가 없는데 ★안 던졌다 — ★가드가 ★죽었다'
  );

  /* ⑶ ★음성 — ★다 주면 ★안 던진다 */
  assert.doesNotThrow(
    () => assertDepsProvided(SLICE, SRC, 'function alpha(){}\nconst gamma = () => {}', 'SHD6-음성'),
    '★다 줬는데 ★던졌다 — ★가드가 ★과하다'
  );

  /* ⑷ ★`declaresName` 의 ★세 꼴을 ★따로 — ⛔한 꼴만 보면 ★대역을 못 알아본다 */
  assert.ok(declaresName('function a(){}', 'a'), 'function 꼴');
  assert.ok(declaresName('const a = () => {}', 'a'), '화살표 꼴');
  assert.ok(declaresName('window.a = function(){}', 'a'), 'window 꼴');
  assert.ok(!declaresName('a(1)', 'a'), '★호출만 있는 것을 ★선언으로 읽으면 안 된다');
  assert.ok(!declaresName('/* a */', 'a'), '★주석을 ★선언으로 읽으면 안 된다');

  /* ⑸ ★★항등식 방지 — ★위 ⑵ 가 ★「언제나 던진다」면 ⑶ 이 ★그것을 ★가른다.
   *   ★그 둘이 ★한 쌍이라야 ★이 자가 ★무엇을 잠그는지 ★말할 수 있다 */
});
