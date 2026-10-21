/* block-kinds-from-creation-site.test.mjs — ★RULER-01 (2026-10-21 지디)
 *
 * ★★무엇을 재나 — ★「★만드는 자리」에서 ★종류를 ★세어, ★★어느 명부에도 ★없는 종류가 ★0 인지.
 *   원천 = 제품 코드의 `className = '…-block'` · `classList.add('…-block')` (★주석은 걷는다)
 *   견주는 곳 = ⑴ 정본 `js/block-bind-kinds.js` ⑵ 제 바인더 셋 ⑶ ★아래 EXCEPT(까닭 적은 예외)
 *
 * ★★왜 — ★S3 독립평가(2026-10-21 · `S3-T4-BIND-eval.md` sha256 앞16 `b775434a8621def4`)의 ★변이 ⒁(m10):
 *   「★새 블럭 종류(`js/blocks/foo-block.js` · className 'foo-block' · bindBlock 부름)를
 *     ★어느 명부에도 ★안 넣기」 → ★★자 13개와 ★잠금 10개가 ★전부 초록(23/23).
 *   ⇒ ★까닭: ★기존 자들은 ★모두 ★「★명부」와 ★「★bindBlock 부르는 자리」를 ★본다.
 *     ★★「★종류가 ★태어나는 자리」를 ★보는 자가 ★★없었다. ★radial-block 이 잡힌 것은
 *     ★손 명부 7곳에 ★먼저 있어서였다 — ★★우연이다.
 *
 * ⛔★이 자가 ★닫는 것은 ★★⒁ ★하나다. ★그 밖은 ★안 닫는다(⛔「대부분」 금지):
 *   ⑽ 최상위 const 선택자 · ⑾ 배열 꼴 · ⑿ 둘로 이어 붙이기 · ⒀ bindBlock 별칭 · ⒂ 큰따옴표
 *     ⇒ ★그 다섯은 ★「bindBlock ★부르는 자리」를 훑는 ★R3 의 사각이고, ★이 자는 ★다른 축(만드는 자리)을 본다.
 *   ⑺b `if (0)` 로 감싸기 · ⑻ `_bindInsertedTree` 의 `bindBlock?.(b)` 줄 지움
 *     ⇒ ★★「글자는 남고 ★행위가 죽는」 꼴이라 ★소스 자로는 ★영원히 못 잡는다 ⇒ ★DOM 몫(⑻ = TPL-REG-01).
 *
 * ⛔⛔★이 자는 ★`_block-bind-lists-def.mjs` 의 ★K_BIND 를 ★쓰지 않는다 — ★일부러다.
 *   ★2026-10-21 에 내가 ★「K_BIND 를 정본에서 ★파생시켜 ★둘째 명부를 없애자」고 ★제안했다가 ★거뒀다.
 *   ★까닭: ★자 R1 이 ★「CANON ↔ K_BIND ★양방향」을 재므로, ★파생시키면 ★★「CANON ⊇ CANON」 =
 *     ★★항등식이 되어 ★변이 ⑴(정본에서 radial 뺌)을 ★★놓친다.
 *   ⇒ ★★「명부가 둘이면 ★파생시켜 하나로」는 ★★제품 코드의 규율이고,
 *     ★★「검사가 재는 ★기준표」는 ★★독립 ★증인이어야 한다. ★두 규율은 ★다른 자리에 산다.
 *   ⇒ ★이 자의 원천(`className`/`classList.add`)은 ★★정본도 ★기준표도 ★아닌 ★제품의 ★다른 자리다
 *     ⇒ ★★독립 증인이 ★맞다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
/* ⛔주석 걷개를 손으로 짜지 마라 — 레포 부품이 «하나» 있다(그 머리말: 11벌 중 9벌이 같은 꼴로 부서져 있었다). */
const { makeStripper, templateBalanced } = _req('./_strip-comments.js');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const strip = (src) => { const s = makeStripper(); return src.split('\n').map(s).join('\n'); };

/* ───────── EXCEPT — ★어느 명부에도 없지만 ★까닭이 있는 종류 (★전부 2026-10-21 에 ★실측) ─────────
 * 낱말은 잠금 시험(`block-bind-kinds-lock.test.mjs`)과 ★같은 것을 쓴다(⛔짐작 금지):
 *   own-binder  = 제 바인더를 따로 쓴다
 *   covered     = 다른 클래스로 이미 걸린다
 *   not-a-block = 캔버스에 사는 블럭이 아니다(직렬화되지 않는다)
 */
export const EXCEPT = Object.freeze({
  'frame-block': 'own-binder — bindFrameDropZone · bindFrameOwnDrag (＋컨테이너). 2026-10-21 실측: 둘 다 js/ 에 있다',
  'section-block': 'own-binder — bindSectionDrag · bindSectionDropZone 등 ★7벌 (＋컨테이너). 2026-10-21 실측',
  'liner-block': "covered — block-factory.js:2958 `className = 'text-block liner-block'` ⇒ text-block 을 ★같이 단다 "
    + '(speech-bubble-block 과 ★같은 꼴). ⚠️★글자로 읽었다 · ★행위는 안 쟀다',
  'preview-page-block': 'not-a-block — js/preview.js:38·234. ★미리보기 화면의 것이다(에디터 캔버스가 아니다). '
    + '2026-10-21 실측: save-load·section-serialize 적중 ★0',
  'ss-item-block': 'not-a-block — js/section-search.js:209 `li.classList.add(…)` · overlay/shell/list 안의 ★목록 항목. '
    + '2026-10-21 실측: save-load·section-serialize 적중 ★0',
});

/** 소스 하나에서 «만들어지는» *-block 종류를 뽑는다. */
function kindsInSource(src) {
  const code = strip(src);
  const out = new Set();
  /* `className = 'a-block b-block'` — 한 줄에 여러 클래스가 올 수 있다(liner-block 이 그 꼴이다). */
  for (const m of code.matchAll(/className\s*=\s*'([a-z0-9][a-z0-9 -]*)'/g)) {
    for (const cls of m[1].split(/\s+/)) if (cls.endsWith('-block')) out.add(cls);
  }
  for (const m of code.matchAll(/classList\.add\(\s*'([a-z0-9-]+-block)'/g)) out.add(m[1]);
  return out;
}

/** {경로: 소스} 지도에서 종류 → 그 종류를 만드는 경로들. ★fixture 도 같은 함수로 재게 한다. */
function kindsInTree(files) {
  const made = new Map();
  for (const [p, src] of Object.entries(files)) {
    for (const k of kindsInSource(src)) {
      if (!made.has(k)) made.set(k, []);
      made.get(k).push(p);
    }
  }
  return made;
}

/** 정본 글자 → 종류 집합. ⛔정본 «배열 안»만 읽는다(파일 다른 곳의 '…-block' 을 안 센다). */
function canonKinds(src) {
  const code = strip(src);
  const m = code.match(/BLOCK_BIND_KINDS\s*=\s*Object\.freeze\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!m) return null;
  return new Set([...m[1].matchAll(/'([a-z0-9-]+-block)'/g)].map((x) => x[1]));
}

const OWN_BINDER = Object.freeze(['gradient-block', 'sticker-block', 'annotation-block']);

/** ★실파일 트리를 읽는다(js/**\/*.js). */
function readProductTree() {
  const files = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.js')) files[path.relative(REPO, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(path.join(REPO, 'js'));
  return files;
}

/** ★자 본체 — 양방향 차집합. */
function measure(files, canon, { except = EXCEPT, own = OWN_BINDER } = {}) {
  const made = kindsInTree(files);
  const known = new Set([...canon, ...own, ...Object.keys(except)]);
  const unlisted = [...made.keys()].filter((k) => !known.has(k)).sort();      // ★명부 밖에서 태어난 종류
  const exceptUnmade = Object.keys(except).filter((k) => !made.has(k)).sort(); // ★예외에 적었는데 안 만들어진다 = 표가 썩었다
  const canonUnmade = [...canon].filter((k) => !made.has(k)).sort();           // ★정본에 있는데 만드는 자리가 없다
  return { made, unlisted, exceptUnmade, canonUnmade };
}

/* ───────── fixture — ★자를 잠근다 ───────── */

const FIX_CANON = `
export const BLOCK_BIND_KINDS = Object.freeze([
  'text-block', 'asset-block',
]);
`;
const FIX_OK = {
  'js/blocks/text-block.js': "const b = document.createElement('div'); b.className = 'text-block';",
  'js/blocks/asset-block.js': "const b = document.createElement('div'); b.className = 'asset-block';",
  'js/blocks/gradient-block.js': "el.className = 'gradient-block';",      // 제 바인더
  'js/preview.js': "block.className = 'preview-page-block';",             // EXCEPT
};
const FIX_NEW_KIND = { ...FIX_OK, 'js/blocks/foo-block.js': "b.className = 'foo-block'; window.bindBlock?.(b);" };
const FIX_COMMENTED = { ...FIX_OK, 'js/blocks/zz.js': "// b.className = 'ghost-block';\n/* b.className = 'ghost2-block'; */" };
const FIX_MULTI = { ...FIX_OK, 'js/blocks/liner.js': "block.className = 'text-block liner-block';" };

test('B0 전제 — 부품이 살아 있고 실파일 트리가 읽히고 템플릿이 닫혀 있다', () => {
  assert.equal(typeof makeStripper, 'function');
  const files = readProductTree();
  const n = Object.keys(files).length;
  assert.ok(n > 50, `js/ 의 .js 파일이 읽혀야 한다 — ${n} 개`);
  const canonSrc = fs.readFileSync(path.join(REPO, 'js/block-bind-kinds.js'), 'utf8');
  assert.equal(templateBalanced(canonSrc), true, '정본의 템플릿 리터럴이 닫혀 있어야 한다(거르개의 전제)');
  assert.notEqual(canonKinds(canonSrc), null, '정본 배열을 찾아야 한다');
});

test('D1 자가 산다 — fixture 에서 명부 밖 종류가 0', () => {
  const r = measure(FIX_OK, canonKinds(FIX_CANON), { except: { 'preview-page-block': 'not-a-block (fixture)' } });
  assert.deepEqual(r.unlisted, [], `명부 밖이 없어야 한다 — 잡힌 것: ${JSON.stringify(r.unlisted)}`);
});

test('★D2 양성대조 — 새 종류를 어느 명부에도 안 넣으면 빨강 (★변이 ⒁ · m10 · 이 자가 있는 이유)', () => {
  const r = measure(FIX_NEW_KIND, canonKinds(FIX_CANON), { except: { 'preview-page-block': 'not-a-block (fixture)' } });
  assert.deepEqual(r.unlisted, ['foo-block'], `foo-block 이 잡혀야 한다 — 잡힌 것: ${JSON.stringify(r.unlisted)}`);
  assert.deepEqual(r.made.get('foo-block'), ['js/blocks/foo-block.js'], '★어느 파일이 만드는지도 말해야 한다');
});

test('⛔D3 음성대조 — 주석에 심은 종류는 안 센다(거르개가 도는지)', () => {
  const except = { 'preview-page-block': 'not-a-block (fixture)' };
  const r = measure(FIX_COMMENTED, canonKinds(FIX_CANON), { except });
  assert.deepEqual(r.unlisted, [], `주석은 안 세야 한다 — 잡힌 것: ${JSON.stringify(r.unlisted)}`);
  /* ★★이 칸이 ★사는지의 증거 — ★걷지 않으면 ★그 둘이 ★잡힌다. */
  const raw = kindsInTree({ 'x.js': FIX_COMMENTED['js/blocks/zz.js'] });
  const noStrip = new Set();
  for (const m of FIX_COMMENTED['js/blocks/zz.js'].matchAll(/className\s*=\s*'([a-z0-9][a-z0-9 -]*)'/g)) noStrip.add(m[1]);
  assert.equal(raw.size, 0, '걷으면 0 이다');
  assert.equal(noStrip.size, 2, `★걷지 않으면 2 가 잡힌다(= 거르개가 일을 한다) — ${[...noStrip]}`);
});

test('D4 한 줄 여러 클래스 — `text-block liner-block` 꼴을 둘로 센다', () => {
  const made = kindsInTree({ 'js/blocks/liner.js': FIX_MULTI['js/blocks/liner.js'] });
  assert.deepEqual([...made.keys()].sort(), ['liner-block', 'text-block']);
});

test('★D5 양성대조 — 예외 표가 썩으면(적었는데 안 만들어진다) 잡는다', () => {
  const r = measure(FIX_OK, canonKinds(FIX_CANON), { except: { 'zz-gone-block': '사라진 종류' } });
  assert.deepEqual(r.exceptUnmade, ['zz-gone-block'], '★예외 표의 썩음을 잡아야 한다');
});

test('★R1 실파일 — ★명부 밖에서 태어난 종류가 0 (정본 ∪ 제바인더 ∪ EXCEPT)', () => {
  const files = readProductTree();
  const canon = canonKinds(fs.readFileSync(path.join(REPO, 'js/block-bind-kinds.js'), 'utf8'));
  const r = measure(files, canon);
  /* ⛔★★읽개에 ★양성대조 — ★「0건」이 ★「못 읽어서 0」일 수 있다.
     ★알려진 종류가 ★알려진 파일에서 ★잡히는지 ★먼저 본다. ★이 칸이 없으면 ★R1 의 초록은
     ★「명부 밖이 없다」와 ★「★아무것도 안 읽었다」를 ★구분하지 못한다. */
  assert.ok(r.made.has('radial-block'), '★전제: 읽개가 radial-block 을 찾아야 한다(못 찾으면 트리를 안 읽은 것)');
  assert.ok(
    (r.made.get('radial-block') || []).some((f) => f.endsWith('js/blocks/radial-block.js')),
    `★전제: radial-block 을 ★만드는 파일이 잡혀야 한다 — 잡힌 것: ${JSON.stringify(r.made.get('radial-block'))}`,
  );
  assert.ok(r.made.size >= 30, `★전제: 만들어지는 종류가 30 이상이어야 한다 — ${r.made.size} 종`);
  /* ★잰 값을 단언에 찍는다 — 빨개질 때 «무엇이 새로 생겼나»가 로그에 남게. */
  assert.deepEqual(
    r.unlisted, [],
    `★어느 명부에도 없는 종류가 생겼다 — 정본에 넣거나 EXCEPT 에 ★까닭과 함께 적어라: `
    + JSON.stringify(r.unlisted.map((k) => ({ kind: k, madeIn: r.made.get(k) }))),
  );
});

test('★R2 실파일 — ★EXCEPT 표가 썩지 않았다(적은 다섯이 모두 아직 만들어진다)', () => {
  const files = readProductTree();
  const canon = canonKinds(fs.readFileSync(path.join(REPO, 'js/block-bind-kinds.js'), 'utf8'));
  const r = measure(files, canon);
  assert.deepEqual(
    r.exceptUnmade, [],
    `★EXCEPT 에 적혔는데 ★만드는 자리가 없다 ⇒ 그 줄을 ★지워라: ${JSON.stringify(r.exceptUnmade)}`,
  );
  assert.equal(Object.keys(EXCEPT).length, 5, `EXCEPT ${Object.keys(EXCEPT).length} 종(2026-10-21 실측 5)`);
});

test('★R3 실파일 — ★정본에 있는데 만드는 자리를 못 찾은 종류가 0 (★반대 방향)', () => {
  const files = readProductTree();
  const canon = canonKinds(fs.readFileSync(path.join(REPO, 'js/block-bind-kinds.js'), 'utf8'));
  const r = measure(files, canon);
  /* ⛔이 줄이 빨개지면 ★두 갈래다: ⑴ 그 종류가 ★죽었다(정본에서 빼라) ⑵ ★내 훑개가 ★그 만드는 꼴을 ★못 본다.
     ★둘을 ★갈라 보려면 ★그 종류를 ★js/ 에서 ★손으로 ★찾아라 — ⛔「죽었다」로 ★먼저 읽지 마라. */
  assert.deepEqual(
    r.canonUnmade, [],
    `★정본에 있는데 만드는 자리가 없다 — ⑴죽은 종류인가 ⑵내 훑개의 사각인가를 ★갈라라: ${JSON.stringify(r.canonUnmade)}`,
  );
});

test('⛔R4 — 이 자가 ★닫는 것과 ★안 닫는 것을 ★이름으로 박는다', () => {
  /* ★이 단언은 «글»이 아니라 «수»다 — 아래 이름들이 ★이 파일 머리말과 어긋나면 빨강이 된다.
     ⇒ ★「무엇을 닫나」가 ★주석에만 살지 않게 한다(★주석은 썩고 ★단언은 안 썩는다). */
  const CLOSES = ['⒁'];
  const NOT_CLOSES = ['⑽', '⑾', '⑿', '⒀', '⒂'];
  const DOM_ONLY = ['⑺b', '⑻'];
  const head = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').slice(0, 2600);
  assert.equal(CLOSES.length, 1, '닫는 것은 ⒁ 하나다');
  for (const n of [...CLOSES, ...NOT_CLOSES, ...DOM_ONLY]) {
    assert.ok(head.includes(n), `머리말이 ${n} 를 이름으로 적어야 한다`);
  }
  assert.equal(new Set([...CLOSES, ...NOT_CLOSES, ...DOM_ONLY]).size, 8, '★놓침 전수는 8 이다(⑽~⒂ 6 ＋ ⑺b · ⑻)');
});
