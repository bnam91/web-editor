/* insert-seam-roster — 삽입 «끝 표본»(js/insert-history.js) 의 전제가 안 썩게 잠근다.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 있나 (T-131, 2026-09-21)
 *   js/insert-history.js 는 「window 에 달린 삽입 입구를 감싸 돌아온 직후에 pushHistory 를
 *   한 번 더 부른다」로 «삽입 → 우측 패널 커밋 → ⌘Z 가 삽입까지 먹던» 이음매를 메운다.
 *   그 고침이 계속 맞으려면 «세 가지»가 안 썩어야 한다:
 *     ⒜ 로스터 — 새 입구가 자동으로 걸리거나, 안 걸리면 «그날» 빨강이어야 한다.
 *     ⒝ window.pushHistory 를 «부를 때» 읽어야 한다(ai-section-fill 의 의도된 노옵).
 *     ⒞ 입구가 돌아온 «뒤»에 캔버스를 더 바꾸면 안 된다(비동기·지연 DOM 쓰기).
 *   ⒞ 가 깨지면 「삽입만 하고 ⌘Z」가 한 번에서 두 번으로 늘어난다 — 조용히 틀린다.
 *
 * ⚠️이 검사는 «소스 문자열»을 본다. 정상적인 리팩터링에도 빨강이 날 수 있다 — 그때는 지우지
 *   말고 js/insert-history.js 머리말의 규약 ①~④ 가 여전히 성립하는지 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc, toPosix } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { stripComments } = require('./_strip-comments.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

const IH_PATH = 'js/insert-history.js';
const IH = readSrc(REPO, IH_PATH);
const INDEX = readSrc(REPO, 'index.html');

/* ── js/** 전수 — 사람이 관리하는 목록이 아니다 ─────────────────────────── */
const JS_FILES = (function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.js')) acc.push(toPosix(path.relative(REPO, p)));
  }
  return acc;
})(path.join(REPO, 'js'), []).sort();

const SRC = new Map(JS_FILES.map(p => [p, readSrc(REPO, p)]));

/** SURFACE — window 에 «대입»된 add* 전부(비교 `===` 는 제외: `= [^=]`). */
const SURFACE = (() => {
  const m = new Map();   // name -> [{file, line}]
  for (const [p, s] of SRC) {
    const lines = s.split('\n');
    lines.forEach((l, i) => {
      const mm = /window\.(add[A-Za-z0-9_]+)\s*=\s*[^=]/.exec(l);
      if (mm) { if (!m.has(mm[1])) m.set(mm[1], []); m.get(mm[1]).push({ file: p, line: i + 1 }); }
    });
  }
  return m;
})();

/* index.html 툴바의 onclick="addXxx(" 도 «입구의 표면»이다 — window 대입이 없는데
   툴바가 부르는 이름이 생기면(=전역 함수 선언으로만 존재) 여기서 드러난다. */
const ONCLICK_NAMES = [...new Set(
  [...INDEX.matchAll(/onclick="[^"]*?\b(add[A-Za-z0-9]*Block)\s*\(/g)].map(m => m[1])
)].sort();

/* ── js/insert-history.js 에서 «실제 값»을 파싱한다(베껴 적지 않는다) ────── */
const MATCH_RE = (() => {
  const m = /var MATCH = (\/.+?\/);/.exec(IH);
  assert.ok(m, 'js/insert-history.js 에서 MATCH 정규식을 못 찾았다 — 이 검사가 늙었다');
  return eval(m[1]);   // 소스에서 읽은 리터럴 그대로
})();
const EXTRA = (() => {
  const m = /var EXTRA = (\[[^\]]*\]);/.exec(IH);
  assert.ok(m, 'js/insert-history.js 에서 EXTRA 를 못 찾았다 — 이 검사가 늙었다');
  return eval(m[1]);
})();
const DENY_SRC = sliceBlock(IH, 'var DENY = {');
const DENY = (() => {
  /* 이유 주석만 있고 항목이 없으면 {} 다. 항목이 생기면 «이름: '이유'» 꼴이어야 한다. */
  const out = {};
  for (const m of DENY_SRC.matchAll(/^\s*(?:'([\w$]+)'|"([\w$]+)"|([\w$]+))\s*:\s*(['"])([\s\S]*?)\4\s*,?\s*$/gm)) {
    out[m[1] || m[2] || m[3]] = m[5];
  }
  return out;
})();

const ROSTER = [...SURFACE.keys()].filter(n => MATCH_RE.test(n) && !DENY[n])
  .concat(EXTRA.filter(n => SURFACE.has(n)))
  .filter((v, i, a) => a.indexOf(v) === i).sort();

/* ═══ 게이트 A — 로스터가 안 썩는다 ════════════════════════════════════ */

test('A0 [기준선] 로스터는 비어 있지 않고, 실측 41자리를 덮는다', () => {
  assert.ok(ROSTER.length >= 41,
    `삽입 입구가 ${ROSTER.length}개로 줄었다(2026-09-21 실측 41). 입구가 «규칙 밖 이름»으로 옮겨간 게 아닌지 봐라:\n  ${ROSTER.join(' ')}`);
  for (const n of ['addSection', 'addPresetRow', 'addTextBlock', 'addAssetBlock', 'addStickerBlock', 'addTableBlock']) {
    assert.ok(ROSTER.includes(n), `${n} 이 로스터에서 빠졌다 — 현빈 제보 재현 경로다`);
  }
});

test('A1 ★SURFACE 의 모든 add* 는 MATCH 이거나 EXTRA 이거나 «이유 있는» DENY 다', () => {
  const orphans = [];
  for (const n of SURFACE.keys()) {
    if (MATCH_RE.test(n) || EXTRA.includes(n) || Object.hasOwn(DENY, n)) continue;
    orphans.push({ n, at: SURFACE.get(n) });
  }
  /* ⛔여기 이름이 떴다면 «삽입 입구인지» 먼저 보라. 삽입이면 EXTRA 에, 아니면
     js/insert-history.js 의 «비삽입 8자리» 주석 목록에 이유와 함께 더해라. */
  const KNOWN_NON_INSERT = [
    'addGhostSection', 'addPage', 'addSectionToScope', 'addStickerFavorite',
    'addToImageGallery', 'addChecklistItem', 'addChecklistSection', 'addVariation',
  ];
  const unexplained = orphans.filter(o => !KNOWN_NON_INSERT.includes(o.n));
  assert.deepEqual(unexplained.map(o => o.n), [],
    `규칙 밖 add* 가 생겼다 — 삽입 입구면 ⌘Z 가 조용히 틀린다:\n` +
    unexplained.map(o => `  ${o.n} @ ${o.at.map(a => a.file + ':' + a.line).join(', ')}`).join('\n'));
  /* 비삽입 8자리가 «여전히 비삽입인지»는 사람이 안 재도 되게 — 이름이 사라지면 아래 A2 가 잡는다 */
  for (const n of KNOWN_NON_INSERT) {
    assert.ok(SURFACE.has(n) || !MATCH_RE.test(n), `${n} 이 사라졌거나 패턴 안으로 들어왔다`);
  }
});

test('A2 DENY 의 항목은 «이유»가 있고 소스에 «아직 존재»한다 (죽은 제외 금지)', () => {
  for (const [n, why] of Object.entries(DENY)) {
    assert.ok(String(why).trim().length >= 4, `DENY['${n}'] 의 이유가 비어 있다`);
    assert.ok(SURFACE.has(n), `DENY['${n}'] 는 소스에 없는 «죽은 제외»다 — 지워라`);
  }
});

test('A3 EXTRA 의 모든 이름이 소스에 있다', () => {
  for (const n of EXTRA) {
    assert.ok(SURFACE.has(n), `EXTRA 의 ${n} 가 window 대입에 없다 — 이름이 바뀌었으면 EXTRA 도 고쳐라`);
  }
});

test('A4 index.html 에 js/insert-history.js script 태그가 «정확히 한 개» 있다', () => {
  const n = [...INDEX.matchAll(/<script[^>]*src="js\/insert-history\.js"/g)].length;
  assert.equal(n, 1, `script 태그가 ${n}개다 — 조용히 빠지면 고침이 통째로 없는 것과 같다`);
  /* 플레인 스크립트여야 한다(module 이면 실행 순서가 바뀌어 install 전제가 흔들린다) */
  const tag = /<script([^>]*)src="js\/insert-history\.js"[^>]*>/.exec(INDEX)[0];
  assert.ok(!/type\s*=\s*"module"/.test(tag), `insert-history 는 플레인 스크립트여야 한다: ${tag}`);
});

test('A5 툴바 onclick 의 add*Block 이름은 전부 window 대입이 있다 (래퍼가 덮는다)', () => {
  const unknown = ONCLICK_NAMES.filter(n => !SURFACE.has(n));
  assert.deepEqual(unknown, [],
    `index.html 이 window 대입 없는 add* 를 부른다(전역 선언만 있는 입구) — 래퍼가 못 덮는다: ${unknown.join(', ')}`);
});

/* ═══ 게이트 B — 비동기 금지 / 캡처 금지 / 정착 금지 ══════════════════ */

/** 입구 «구현»을 떠온다. 별칭(`window.a = b;`)은 원본으로 따라간다. */
function implOf(name, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  for (const [p, s] of SRC) {
    for (const hdr of [`\nfunction ${name}(`, `\nexport function ${name}(`,
                       `\nasync function ${name}(`, `\nexport async function ${name}(`]) {
      if (s.includes(hdr)) {
        const raw = sliceBlock(s, hdr.slice(1));
        /* ⛔주석을 안 걷으면 「⛔setTimeout 으로 되돌리지 마라」 같은 «경고 주석»이 검사를
           빨강으로 만든다 — 경고를 적을수록 빨개지는 검사는 못 쓴다. */
        return { file: p, header: hdr.trim(), body: stripComments(raw), raw };
      }
    }
    /* 별칭 — `window.addDuoBlock = addGridBlock;` / `const addX = addY;` */
    const al = new RegExp(`window\\.${name}\\s*=\\s*(add[A-Za-z0-9_]+)\\s*;`).exec(s);
    if (al) return implOf(al[1], seen);
  }
  return null;
}

const IMPLS = ROSTER.map(n => ({ n, impl: implOf(n) }));

test('B0 로스터의 모든 입구 구현을 «실제로» 떠올 수 있다 (부재를 통과로 안 읽는다)', () => {
  const missing = IMPLS.filter(x => !x.impl).map(x => x.n);
  assert.deepEqual(missing, [], `구현을 못 찾은 입구: ${missing.join(', ')} — 못 찾으면 B1~B3 이 «안 돈» 것이다`);
});

test('B1 ★입구는 «동기»다 — async·Promise 반환이 생기면 그날 빨강', () => {
  /* 비동기 입구가 생기면 「끝 표본을 resolve 뒤에 찍기」를 «근거를 갖고» 설계해야 한다.
     ⛔투기적으로 미리 넣지 마라 — resolve 시점엔 ai-section-fill 이 이미 origPush 를
       되돌려 놓아서 «의도된 노옵»(규약 ①)을 깨뜨린다. */
  const bad = [];
  for (const { n, impl } of IMPLS) {
    if (!impl) continue;
    if (/^(export\s+)?async function/.test(impl.header)) bad.push(`${n} (async) @ ${impl.file}`);
    if (/return\s+new\s+Promise\b/.test(impl.body)) bad.push(`${n} (return new Promise) @ ${impl.file}`);
    if (/return\s+[\w.$?]+\s*\.then\s*\(/.test(impl.body)) bad.push(`${n} (return ….then) @ ${impl.file}`);
  }
  assert.deepEqual(bad, [], `삽입 입구가 비동기가 됐다 — js/insert-history.js 규약 ④ 를 다시 설계해라:\n  ${bad.join('\n  ')}`);
});

test('B2 ★js/insert-history.js 는 window.pushHistory 를 «캡처»하지 않는다 (규약 ①)', () => {
  /* 근거: js/ai-section-fill.js 가 `const origPush = window.pushHistory; window.pushHistory = () => {};`
     로 «의도된 노옵»을 건다(한 번의 ⌘Z 로 AI 채우기 전체를 롤백). 같은 규약의 선례는
     js/table-cell-select.js 의 suppressAncestorDrag 주석. */
  const captures = [...IH.matchAll(/^.*?[=:]\s*window\.pushHistory\s*[;,)\]}]?.*$/gm)]
    .map(m => m[0].trim())
    .filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l));   // 주석 줄은 설명이다
  assert.deepEqual(captures, [],
    `window.pushHistory 를 변수에 담았다 — ai-section-fill 의 의도된 노옵이 깨진다:\n  ${captures.join('\n  ')}`);
  assert.ok(/window\.pushHistory\s*\(/.test(IH), 'window.pushHistory 를 «부르는» 줄이 사라졌다 — 고침이 통째로 없다');
  assert.ok(/typeof window\.pushHistory === 'function'/.test(IH), '호출 직전에 window 에서 «그때» 읽는 모양이 사라졌다');

  /* 그 «의도된 노옵» 자리가 실제로 살아 있는지도 같이 본다 — 전제가 사라지면 규약 ① 의 이유가 없다 */
  const AI = readSrc(REPO, 'js/ai-section-fill.js');
  assert.ok(/window\.pushHistory\s*=\s*\(\s*\)\s*=>\s*\{\s*\}/.test(AI),
    'js/ai-section-fill.js 의 노옵 교체가 사라졌다 — 그러면 규약 ① 의 근거가 바뀐 것이다(주석부터 고쳐라)');
});

/** ④ 정착 — 돌아온 뒤에 DOM 을 더 바꾸는 입구는 «이유와 함께» 여기 있어야 한다. */
const SETTLE_KNOWN = {
  addStickerBlock:
    'rAF 로 _enterStickerEdit(편집 진입) — 부착 뒤 틱이 있어야 focus/캐럿이 선다. ' +
    '대신 그 쓰기가 «직렬화에서 세척»된다: contenteditable 은 원래 세척되고, ' +
    'user-select·cursor 는 js/io/section-serialize.js 가 .sticker-text 에서 걷는다.',
};

test('B3 ★입구가 돌아온 «뒤»에 DOM 을 더 바꾸면(setTimeout·rAF) 빨강 — 아는 자리만 예외', () => {
  const offenders = [];
  for (const { n, impl } of IMPLS) {
    if (!impl) continue;
    const defers = /\bsetTimeout\s*\(/.test(impl.body) || /\brequestAnimationFrame\s*\(/.test(impl.body);
    if (defers && !SETTLE_KNOWN[n]) offenders.push(`${n} @ ${impl.file}`);
  }
  assert.deepEqual(offenders, [],
    '삽입 입구가 «지연 DOM 쓰기»를 들였다 ⇒ 끝 표본 뒤에 캔버스가 바뀌어 「삽입만 하고 ⌘Z」가 ' +
    '한 번에서 두 번이 된다(먹통 한 칸). 동기로 펴거나, 직렬화 불변임을 «만들고» ' +
    `SETTLE_KNOWN 에 이유와 함께 적어라:\n  ${offenders.join('\n  ')}`);

  /* 죽은 예외 금지 — 목록에 있는데 더 이상 지연을 안 걸면 지워라 */
  for (const n of Object.keys(SETTLE_KNOWN)) {
    const impl = IMPLS.find(x => x.n === n)?.impl;
    assert.ok(impl, `SETTLE_KNOWN 의 ${n} 이 로스터에 없다 — 죽은 예외다`);
    assert.ok(/\bsetTimeout\s*\(|\brequestAnimationFrame\s*\(/.test(impl.body),
      `SETTLE_KNOWN 의 ${n} 이 더 이상 지연을 안 건다 — 예외를 지워라`);
  }
});

test('B3-b ★addTableBlock 의 테마적용은 «동기»다 (되돌리면 여기서 빨강)', () => {
  const BF = readSrc(REPO, 'js/block-factory.js');
  const body = stripComments(sliceBlock(BF, 'function addTableBlock('));
  assert.ok(!/\bsetTimeout\s*\(/.test(body),
    'addTableBlock 에 setTimeout 이 돌아왔다 — 「어두운 섹션 + 프레임 안 표 삽입 → ⌘Z」가 두 번이 된다');
  assert.ok(/_applyTableThemeDefaults\(_tblBlock, opts\)/.test(body),
    'flow-frame 경로의 동기 테마적용이 사라졌다 — 다크 섹션 표가 안 보이게 된다(BL-CDD-05 재발)');
});

test('B3-c ★SETTLE_KNOWN(addStickerBlock) 의 «이유»가 실제로 성립한다 (짝 검사)', () => {
  /* 이유가 「직렬화에서 세척된다」이므로, 그 세척이 실제로 소스에 있어야 한다.
     이게 없으면 B3 의 예외는 «설명으로 닫은 의심»이 된다. */
  const SS = readSrc(REPO, 'js/io/section-serialize.js');
  const clean = stripComments(sliceBlock(SS, 'function serializeCleanRoot('));
  assert.ok(/querySelectorAll\('\.sticker-text'\)/.test(clean),
    '직렬화가 .sticker-text 를 안 씻는다 — addStickerBlock 의 rAF 예외 근거가 사라졌다');
  assert.ok(/removeProperty\('user-select'\)/.test(clean) && /removeProperty\('cursor'\)/.test(clean),
    'user-select·cursor 세척이 빠졌다 — _enterStickerEdit 가 쓰는 «그 둘»이다');
  assert.ok(/removeAttribute\('contenteditable'\)/.test(clean), 'contenteditable 세척이 사라졌다');

  const SK = readSrc(REPO, 'js/sticker-select.js');
  const enter = stripComments(sliceBlock(SK, 'function _enterStickerEdit('));
  const inline = [...enter.matchAll(/textEl\.style\.([A-Za-z]+)\s*=/g)].map(m => m[1]).sort();
  assert.deepEqual(inline, ['cursor', 'userSelect'],
    `_enterStickerEdit 가 쓰는 인라인 스타일이 바뀌었다(${inline.join(',')}) — 세척 목록도 같이 고쳐라`);
});
