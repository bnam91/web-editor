/* U-MDLTXT — 모달 블록의 «글자 기본값»이 한 곳에서 오는가, 그리고 그게 실제로 박히는가. (2026-09-08)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는데
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다.
 *
 * ★왜 이 파일이 있나
 *   `fontSize` 기본값이 «세 곳»에 리터럴 14 로 적혀 있었다:
 *     js/blocks/modal-block.js  MODAL_DEFAULTS.fontSize
 *     js/props/prop-modal.js    _i('fontSize', …)          ← 패널이 보여 주는 값
 *     js/io/export-figma-json.js  parseInt(ds.fontSize) || …  ← 내보내기가 쓰는 값
 *   하나만 고치면 나머지 둘이 «조용히» 옛 값으로 남는다. 화면·패널·내보내기가 서로 다른 말을
 *   하는데 콘솔은 조용하다. 이 파일이 그 셋을 «같은 값»으로 묶는다.
 *
 * ★왜 import 로 안 묶고 검사로 묶나
 *   export-figma-json.js 는 «분리된 문서»(DOMParser 클론)를 걷는 경로다. 거기서 js/blocks/ 를
 *   import 하면 window/DOM 에 손대는 모듈이 딸려 온다. 결합을 만드는 대신 T1 이 세 자리의
 *   숫자가 같음을 소스에서 못박는다 — 한 자리만 고치면 여기가 빨개진다.
 *
 * ⚠️이 파일은 «동작»과 «소스 문자열»을 둘 다 단언한다. 정상적인 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 지우지 말고 「기본값이 여전히 한 곳에서 오는가」를 확인한 뒤 패턴을 고쳐라.
 *   선례: modal-variant-identity.test.mjs · align-btn-ssot.test.mjs.
 *
 * ⛔주석 걷어내기는 공용 부품(./_strip-comments.js)만 쓴다. 자기 벌을 만들면
 *   strip-comments-shared.test.js 의 S-6 가 즉시 빨강을 낸다 — 이 파일은 허용목록에 없다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { readSrc } = _req('./_srcread.js');
const { loadModalModule, fakeBlock } = _req('./_modal-harness.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M = loadModalModule();

/* ★현빈 발주 2026-09-08 — 모달 글자 기본값은 36 이다.
   ⛔「셋이 서로 같다」만 재면 셋을 «전부» 14 로 되돌려도 초록이 된다. 그래서 절대값을 못박는다.
     이 숫자를 바꾸는 손이 「내가 기본값을 바꾸는 중」임을 한 번은 알게 만든다. */
const WANT_FS = 36;

const SRC = {
  modal: stripComments(readSrc(ROOT, 'js/blocks/modal-block.js')),
  prop:  stripComments(readSrc(ROOT, 'js/props/prop-modal.js')),
  exp:   stripComments(readSrc(ROOT, 'js/io/export-figma-json.js')),
};

/* ── 소스 자르기 — «중괄호 균형»으로만 한다 ────────────────────────────────
 * ⛔`src.slice(i, i + 900)` 같은 고정 창 금지. 위쪽에 주석 한 줄만 들어가도 창이 밀려
 *   검사가 «엉뚱한 곳»을 보면서 조용히 통과한다. 경계는 문법으로 잡는다. */

function braceBody(src, from, what) {
  const open = src.indexOf('{', from);
  assert.ok(open >= 0, `${what}: 여는 중괄호를 못 찾았다 — 소스 모양이 바뀌었다`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  assert.fail(`${what}: 중괄호 짝이 안 맞는다`);
}

/** `function name(...) { … }` 의 «본문»만. 인자 목록의 `opts = {}` 를 본문으로 오인하지 않는다. */
function functionBody(src, name) {
  const i = src.indexOf(`function ${name}`);
  assert.ok(i >= 0, `function ${name} 을 못 찾았다 — 이 검사는 지금 아무것도 안 보고 있다`);
  let depth = 0, j = src.indexOf('(', i);
  assert.ok(j >= 0, `function ${name}: 인자 목록을 못 찾았다`);
  for (; j < src.length; j++) {
    if (src[j] === '(') depth++;
    else if (src[j] === ')' && --depth === 0) break;
  }
  return braceBody(src, j + 1, `function ${name}`);
}

/* ── 세 «자리»의 잣대 ──────────────────────────────────────────────────────
 * 각 잣대는 그 자리에 적힌 «토큰»(숫자 리터럴이거나 이름)을 돌려준다. 못 찾으면 null.
 * null 은 「그 자리가 사라졌다」는 뜻이고, T0-a 가 그걸 빨갛게 만든다. */

const TOKEN = /(\d+|[A-Za-z_$][\w$.]*)/.source;

const SITES = [
  {
    name: 'js/blocks/modal-block.js  MODAL_DEFAULTS.fontSize',
    src: () => SRC.modal,
    read: (src) => {
      const i = src.indexOf('const MODAL_DEFAULTS');
      if (i < 0) return null;
      const m = new RegExp(String.raw`\bfontSize\s*:\s*${TOKEN}`)
        .exec(braceBody(src, i, 'MODAL_DEFAULTS'));
      return m ? m[1] : null;
    },
  },
  {
    name: "js/props/prop-modal.js  _i('fontSize', …)",
    src: () => SRC.prop,
    read: (src) => {
      const m = new RegExp(String.raw`_i\(\s*'fontSize'\s*,\s*${TOKEN}\s*\)`).exec(src);
      return m ? m[1] : null;
    },
  },
  {
    name: 'js/io/export-figma-json.js  parseInt(ds.fontSize) || …',
    src: () => SRC.exp,
    read: (src) => {
      const m = new RegExp(String.raw`parseInt\(\s*ds\.fontSize\s*\)\s*\|\|\s*${TOKEN}`).exec(src);
      return m ? m[1] : null;
    },
  },
];

/* ── 정렬 버튼의 잣대 ──────────────────────────────────────────────────────
 * 호출은 «한 줄에 하나»다(레포 관례 — align-btn-ssot C3 도 같은 가정을 쓴다).
 * 그래서 줄 단위로 읽는다. 못 찾으면 빈 배열이고, T0-b 가 그걸 빨갛게 만든다. */

function alignCalls(src) {
  const out = [];
  for (const line of src.split('\n')) {
    if (!/\balignBtn\s*\(/.test(line) || !/data-al/.test(line)) continue;
    const fam = /alignBtn\(\s*'([^']+)'/.exec(line);
    const key = /alignBtn\(\s*'[^']+'\s*,\s*'([^']+)'/.exec(line);
    const al  = /'data-al'\s*:\s*'([^']+)'/.exec(line);
    const lbl = /\blabel\s*:\s*'([^']+)'/.exec(line);
    out.push({ family: fam && fam[1], key: key && key[1], al: al && al[1], label: lbl && lbl[1] });
  }
  return out;
}

/* 감싸개 — needle 을 «둘러싼» 가장 가까운 <div> 의 class.
 * ⛔고정 창으로 뒤를 훑지 않는다. 태그 균형으로 짚고, 못 짚으면 «못 짚었다»고 죽는다. */
function wrapperClassOf(src, needle, what) {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `${what}: «${needle}» 를 못 찾았다 — 이 잣대는 지금 아무것도 안 보고 있다`);
  const open = src.lastIndexOf('<div', at);
  assert.ok(open >= 0, `${what}: 감싸개 <div> 를 못 찾았다`);
  assert.equal(src.slice(open, at).includes('</div>'), false,
    `${what}: 가장 가까운 <div> 와 «${needle}» 사이에 </div> 가 있다 — 이 잣대가 엉뚱한 것을 짚고 있다`);
  const m = /<div[^>]*class="([^"]*)"/.exec(src.slice(open));
  return m ? m[1] : null;
}

/** 토큰 → 숫자. 이름은 «출처를 따라가서» 푼다 — 그게 이 검사가 재려는 것이다. */
function resolve(tok, where) {
  assert.notEqual(tok, null, `${where}: 자리를 못 찾았다`);
  if (/^\d+$/.test(tok)) return Number(tok);
  if (tok === 'MODAL_DEFAULTS.fontSize') return M.MODAL_DEFAULTS.fontSize;
  assert.fail(`${where}: 토큰 «${tok}» 를 못 푼다 — 새 출처가 생겼으면 resolve() 를 늘려라. ` +
    `못 푸는 채로 넘어가면 이 검사가 «아무것도 안 보고» 초록이 된다.`);
}

/* ══ T0 — 「입력이 살아 있다」. 본 단언 «앞»에 세운다. ════════════════════ */

test('T0-a ★자리 목록이 «정확히 3»이고 셋 다 소스에서 실제로 잡힌다', () => {
  // 되돌리면 빨강: 세 자리 중 하나를 지우거나 문법을 바꿔 잣대가 못 찾게 되면.
  assert.equal(SITES.length, 3,
    `자리가 ${SITES.length}개다 — 3이어야 한다. 자리가 줄면 T1 이 «남은 것끼리만» 비교하면서 초록을 낸다.`);
  for (const s of SITES) {
    assert.notEqual(s.read(s.src()), null,
      `«${s.name}» 를 소스에서 못 찾았다. 그 자리가 사라졌거나 잣대가 낡았다 — ` +
      `둘 다 「T1 이 그 자리를 안 본다」는 뜻이고, 그 상태로 T1 은 조용히 통과한다.`);
  }
});

test('T0-b ★정렬 버튼 탐지가 «정확히 3»이다 (left/center/right)', () => {
  // 되돌리면 빨강: M4(정렬을 글자 버튼으로 되돌리기) — 탐지가 0 이 되면 T4·T5 가 자기통과한다.
  const calls = alignCalls(SRC.prop);
  assert.equal(calls.length, 3,
    `data-al 이 붙은 alignBtn 호출을 ${calls.length}개 찾았다 — 3이어야 한다. ` +
    `0이면 T4·T5 가 «아무것도 안 보고» 초록이 된다.`);
  assert.deepEqual(calls.map((c) => c.key), ['left', 'center', 'right'],
    `정렬 키가 left/center/right 순서로 셋이 아니다: ${JSON.stringify(calls.map((c) => c.key))}`);
  for (const c of calls) {
    assert.ok(c.label, `alignBtn('${c.family}', '${c.key}') 에 label 이 없다 — ` +
      `_helpers.js:275 가 throw 한다(패널이 통째로 안 뜬다). 소스에서 먼저 잡는다.`);
  }
});

test('T0-c ★양성대조 — 「14 를 넣은 가짜 소스」를 잣대에 먹이면 «실제로» 잡힌다', () => {
  // 되돌리면 빨강: 잣대 정규식이 부서져 아무것도 못 읽게 되면(그때 T1 은 자기통과한다).
  const FAKE = [
    "const MODAL_DEFAULTS = {\n  align: 'left', textColor: '#1c1c1e', fontSize: 14,\n};",
    "  const fontSize = _i('fontSize', 14);",
    "      const fs = parseInt(ds.fontSize) || 14;",
  ];
  assert.equal(FAKE.length, SITES.length, '가짜 소스 개수가 자리 수와 다르다 — 한 자리가 양성대조 없이 남는다');
  SITES.forEach((s, i) => {
    const tok = s.read(FAKE[i]);
    assert.notEqual(tok, null, `${s.name}: 가짜 소스에서 아무것도 못 읽었다 — 잣대가 죽어 있다`);
    assert.equal(resolve(tok, `${s.name}(가짜)`), 14,
      `${s.name}: 14 를 넣은 가짜 소스인데 잣대가 «${tok}» 를 읽었다. 이 잣대로는 M1~M3 변이를 못 잡는다.`);
  });

  // ★정렬 잣대도 같이 세운다 — 「틀린 소스를 먹였을 때 틀렸다고 말하는가」.
  const FAKE_WRONG = [
    `<div class="prop-type-group">`,
    `  \${alignBtn('object-h', 'left',   { label: 'L', attrs: { 'data-al': 'left' } })}`,
    `  \${alignBtn('object-h', 'center', { label: 'C', attrs: { 'data-al': 'center' } })}`,
    `</div>`,
  ].join('\n');
  assert.equal(wrapperClassOf(FAKE_WRONG, "alignBtn('object-h'", '가짜(감싸개)'), 'prop-type-group',
    '감싸개 잣대가 «prop-type-group» 을 못 읽었다 — 그러면 M6 변이를 못 잡는다');
  const fakeCalls = alignCalls(FAKE_WRONG);
  assert.equal(fakeCalls.length, 2, `가짜 소스에서 호출 ${fakeCalls.length}개를 읽었다 — 2여야 한다`);
  assert.deepEqual(fakeCalls.map((c) => c.family), ['object-h', 'object-h'],
    '계열 잣대가 «object-h» 를 못 읽었다 — 그러면 M5 변이를 못 잡는다');
});

/* ══ T1 — 기본값의 «출처가 하나» ═══════════════════════════════════════════ */

test('T1 ★세 자리가 «같은 값»(36)을 본다 — 리터럴 14 는 한 자리도 없다', () => {
  // 되돌리면 빨강: M1(modal-block:29→14) · M2(prop-modal:32→14) · M3(export:750→14) 어느 하나라도.
  const got = SITES.map((s) => ({ name: s.name, v: resolve(s.read(s.src()), s.name) }));
  for (const { name, v } of got) {
    assert.notEqual(v, 14, `«${name}» 이 아직 14 다 — 옛 기본값이 그 자리에만 남았다. 화면·패널·내보내기가 갈린다.`);
    assert.equal(v, WANT_FS,
      `«${name}» 이 ${v} 다 — ${WANT_FS} 여야 한다. 세 자리는 «한 값»이다.\n  ` +
      got.map((g) => `${g.v}  ← ${g.name}`).join('\n  '));
  }
  // 런타임의 진짜 값과도 맞아야 한다(소스만 보고 모듈이 딴 값을 들고 있으면 소용없다)
  assert.equal(M.MODAL_DEFAULTS.fontSize, WANT_FS,
    `vm 으로 실제 실행한 MODAL_DEFAULTS.fontSize 가 ${M.MODAL_DEFAULTS.fontSize} 다`);
});

test('T1-b ★패널은 «자기 숫자»를 안 갖는다 — MODAL_DEFAULTS 를 import 해서 본다', () => {
  // 되돌리면 빨강: prop-modal.js 가 _i('fontSize', 36) 처럼 숫자를 «다시 적으면».
  assert.match(SRC.prop,
    /import\s*\{[^}]*\bMODAL_DEFAULTS\b[^}]*\}\s*from\s*['"]\.\.\/blocks\/modal-block\.js['"]/,
    'prop-modal.js 가 MODAL_DEFAULTS 를 import 하지 않는다 — 패널이 자기 숫자를 들면 ' +
    '모델을 고쳐도 패널만 옛 값을 «보여 주는» 상태가 된다(그리고 콘솔은 조용하다).');
  assert.match(SRC.prop, /_i\(\s*'fontSize'\s*,\s*MODAL_DEFAULTS\.fontSize\s*\)/,
    "prop-modal.js 의 폴백이 MODAL_DEFAULTS.fontSize 가 아니다");
});

/* ══ T2 — 생성 때 dataset 을 «항상» 박는다 ════════════════════════════════ */

test('T2 ★makeModalBlock({}) 이 dataset.fontSize 를 «무조건» 박는다', () => {
  // 되돌리면 빨강: M1(기본값 14) · M7(:212 를 if (opts.fontSize != null) 로 조건화).
  const { block } = M.makeModalBlock({});
  assert.equal(block.dataset.fontSize, String(WANT_FS),
    `makeModalBlock({}) 의 dataset.fontSize 가 «${block.dataset.fontSize}» 다 — «${WANT_FS}» 여야 한다. ` +
    `dataset 이 이 블록의 진실이라 여기서 비면 저장·로드 왕복에서 값이 «증발»한다.`);

  const body = functionBody(SRC.modal, 'makeModalBlock');
  const hits = body.split('\n').filter((l) => /\bblock\.dataset\.fontSize\s*=(?!=)/.test(l));
  assert.equal(hits.length, 1,
    `makeModalBlock 안의 dataset.fontSize 대입이 ${hits.length}줄이다 — 정확히 1줄이어야 한다`);
  assert.match(hits[0], /^\s*block\.dataset\.fontSize\s*=/,
    `대입 앞에 뭔가 붙어 있다 — 조건부가 됐다:\n  ${hits[0].trim()}\n` +
    `⛔조건부로 만들면 opts 에 fontSize 가 없는 «보통의» 생성에서 dataset 이 비고, ` +
    `renderModalBlock 의 폴백에만 기대게 된다 — 저장하면 그 값이 사라진다.`);

  // 중괄호 깊이 — 함수 본문 바로 아래(깊이 1)여야 한다. if 블록 안이면 2 이상이 된다.
  const at = body.indexOf('block.dataset.fontSize');
  let depth = 0;
  for (let i = 0; i < at; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') depth--;
  }
  assert.equal(depth, 1,
    `dataset.fontSize 대입이 중괄호 깊이 ${depth} 에 있다 — 함수 본문 바로 아래(1)여야 한다. ` +
    `블록 안에 들어갔다면 어떤 조건 아래에서만 박히는 것이다.`);
});

/* ══ T3 — 기존 블록은 «안 건드린다» ═══════════════════════════════════════ */

test('T3 ★data-font-size="14" 인 기존 블록은 여전히 14px 로 그려진다', () => {
  // 되돌리면 빨강: renderModalBlock 이 dataset 을 무시하고 기본값을 우선하도록 바뀌면.
  const legacy = fakeBlock({ variant: 'plain', fontSize: '14' });
  M.renderModalBlock(legacy);
  assert.match(legacy.style.cssText, /font-size:14px/,
    `저장돼 있던 14 를 ${WANT_FS} 로 덮어썼다 — 사용자가 «고른» 값일 수 있다.\n  실제: ${legacy.style.cssText}`);
  assert.doesNotMatch(legacy.style.cssText, new RegExp(`font-size:${WANT_FS}px`),
    `기존 블록에 새 기본값이 새어 들어왔다: ${legacy.style.cssText}`);

  // 반대쪽 — dataset 이 «비어 있는» 블록은 새 기본값으로 간다(폴백이 살아 있다).
  const bare = fakeBlock({ variant: 'plain' });
  M.renderModalBlock(bare);
  assert.match(bare.style.cssText, new RegExp(`font-size:${WANT_FS}px`),
    `dataset 이 빈 블록의 폴백이 ${WANT_FS} 가 아니다: ${bare.style.cssText}`);
});

/* ══ T4·T5 — 정렬 «세 버튼» (2026-09-08 ⑵) ════════════════════════════════ */

test('T4 ★계열은 «text» 다 — object-h 가 아니다', () => {
  // 되돌리면 빨강: M5(계열 text → object-h).
  const calls = alignCalls(SRC.prop);
  assert.equal(calls.length, 3, 'T0-b 를 먼저 봐라 — 입력이 죽었다');
  for (const c of calls) {
    assert.equal(c.family, 'text',
      `alignBtn 계열이 «${c.family}» 다 — 'text' 여야 한다.\n` +
      `★근거는 취향이 아니라 코드다: js/blocks/modal-block.js 의 renderModalBlock 이 이 값을 ` +
      `\`text-align:\${align}\` 으로 쓴다 — 정렬되는 것은 «상자»가 아니라 상자 «안의 글»이다. ` +
      `object-h(가이드선+칠한 판)를 쓰면 그림이 뜻과 어긋난다.`);
  }
  // 코드가 정말 그렇게 쓰는지도 «같이» 확인한다 — 근거가 낡으면 이 단언이 먼저 알려 준다.
  assert.match(SRC.modal, /text-align:\$\{align\}/,
    'modal-block.js 가 align 을 text-align 으로 안 쓴다 — 계열 판단의 근거가 사라졌다. ' +
    '무엇이 정렬되는지를 다시 보고 계열을 고르라.');
});

test('T5 ★감싸개가 .prop-align-group 이고 data-al 3값이 «그대로» 실린다', () => {
  // 되돌리면 빨강: M6(감싸개 → .prop-type-group) · M4(글자 버튼 되돌리기).
  const wrap = wrapperClassOf(SRC.prop, "alignBtn('text'", 'prop-modal 정렬 감싸개');
  assert.equal(wrap, 'prop-align-group',
    `정렬 버튼의 감싸개가 «${wrap}» 다 — 'prop-align-group' 이어야 한다.\n` +
    `★240px 패널 실측: 감싸개를 prop-type-group 으로 두고 아이콘만 갈아끼우면 줄에 빈자리가 ` +
    `93px 벌어진다. prop-align-group + prop-align-btn 이면 0px(163px flex 3등분)다.`);

  // ★data-al 은 «원문 그대로» 실려야 한다 — prop-modal 의 핸들러가
  //   propPanel.querySelectorAll('[data-al]') 로 «속성 기반»이라 이름이 바뀌면 배선이 통째로 죽는다.
  const calls = alignCalls(SRC.prop);
  assert.deepEqual(calls.map((c) => c.al), ['left', 'center', 'right'],
    `data-al 값이 left/center/right 가 아니다: ${JSON.stringify(calls.map((c) => c.al))}`);
  for (const c of calls) {
    assert.equal(c.al, c.key,
      `alignBtn('text','${c.key}') 인데 data-al 이 «${c.al}» 다 — 그림과 실제 정렬이 어긋난다`);
  }
  assert.match(SRC.prop, /querySelectorAll\(\s*'\[data-al\]'\s*\)/,
    "핸들러가 '[data-al]' 로 안 잡는다 — 속성 이름을 바꿨다면 버튼 3개가 조용히 죽는다");
});
