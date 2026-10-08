/* coupon-presets — ★쿠폰 프리셋의 ★«명부가 하나인가»·★«칸이 명부를 읽는가» (2026-10-08 현빈 발주 · 지디 GO)
 *
 * ★이 파일이 재는 것 = ★「칩이 ★제 손으로 수·이름·글을 적지 않았나」 ＋ ★「허용값 명부가 ★하나인가」.
 *   ⛔칩이 ★뜨는지·★눌리는지·★그림이 바뀌는지는 ★DOM 수트 몫이다
 *     (tests/dom/coupon-presets.dom.spec.js — C-P4 누름 · C-P5 저장 왕복 · C-P7 badgeOn 2단계).
 *   ★★「칸이 뜬다」와 「기능이 돈다」를 ★섞지 않는다 — 섞으면 「깨졌다」로 읽히고 ★처방까지 틀린다.
 *
 * ★★왜 unit 이 이것을 재나 — ★발주의 ⛔가 ★「명부 하나 · ⛔label·수를 패널에 지어 박지 마라」였다.
 *   ⇒ ★★「읽었다」는 ★★«출처를 갈아 끼우면 ★출력이 따라온다»로만 증명된다(C-P2·C-P3).
 *     ⛔`칩 수 === 명부 키 수` ★하나로는 ★아무것도 안 잠근다 — ★둘이 ★같은 소스라 ★★항등식이고,
 *       ★★«손으로 다섯 줄 적은 판»도 ★초록으로 지나간다(그 덫: 2026-10-04).
 *
 * ★★하네스 — js/*.js 는 브라우저 ESM 인데 package.json 에 type:module 이 없어 Node 가 CJS 로 읽는다.
 *   ⇒ tmp 에 type:module 을 얹고 ★상대 경로 꼴을 ★그대로 유지해 옮긴다
 *     (`js/blocks/coupon-presets.js` → `../props/_helpers.js` 를 부르므로 ★두 층이 ★다 있어야 한다).
 *   ⛔`coupon-block.js`·`prop-coupon.js` 를 ★import 하지 않는다 — 전자는 `../drag-drop.js`,
 *     후자는 `../globals.js:4`(모듈 최상위 `document.querySelector`)를 물어 ★node 에서 ★죽는다.
 *     ⇒ ★그 둘은 ★«소스 읽기»(C-P6)와 ★DOM 수트로 잰다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/* ★window 대역 — 실앱에선 창 다리가 깔린다. ★그 주서를 흉내낸다(갈아끼우기도 이 창을 쓴다). */
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

const PRESETS_MOD = await (async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-cpnpreset-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.mkdirSync(path.join(tmp, 'blocks'));
  fs.mkdirSync(path.join(tmp, 'props'));
  fs.copyFileSync(path.join(REPO, 'js/props/_helpers.js'), path.join(tmp, 'props/_helpers.js'));
  fs.copyFileSync(path.join(REPO, 'js/blocks/coupon-presets.js'), path.join(tmp, 'blocks/coupon-presets.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'blocks/coupon-presets.js')).href);
  /* ★사본은 ★여기서 «동기로» 치운다 — ⛔exit 핸들러에 맡기면 ★남는다(파티클 선례의 실측). */
  fs.rmSync(tmp, { recursive: true, force: true });
  return m;
})();

const { CPN_PRESETS, CPN_PRESET_KEYS, COUPON_ENUMS, couponPresetChipsHTML, couponPresetOf } = PRESETS_MOD;

/** ★그리개를 ★«이 명부로» 한 번 돌린다 — ★출처를 갈아 끼우는 판(C-P2·C-P3)이 쓴다.
 *  ★선례 = tests/unit 의 파티클 짝 `htmlWith`(그 판 `window.ParticlesFx` 를 바꿔 끼운다). */
function chipsWith(roster, block) {
  const keep = globalThis.window.CouponPresets;
  globalThis.window.CouponPresets = roster;
  try { return couponPresetChipsHTML(block); }
  finally { globalThis.window.CouponPresets = keep; }
}
const chipKeys = (html) => (html.match(/data-cpn-preset="([^"]+)"/g) || []).map(s => s.slice(17, -1));
/** ⛔등호로 재지 않는다 — ★이름 집합차로 잰다(∅가 «일치»로 둔갑하지 않게 양방향). */
const diff = (a, b) => a.filter(x => !b.includes(x));

const mkBlock = (ds = {}) => ({ dataset: { ...ds } });

/* ═══ C-P1 전제 ═════════════════════════════════════════════════════════════ */

test('C-P1 전제 — 명부·칩 그리개·허용값 표가 실렸고 ★프리셋은 ★다섯이다', () => {
  assert.equal(typeof couponPresetChipsHTML, 'function', '★전제: 칩 그리개를 실제로 import 했다');
  assert.equal(typeof couponPresetOf, 'function', '★전제: 프리셋 읽는 문을 실제로 import 했다');
  assert.ok(CPN_PRESETS && typeof CPN_PRESETS === 'object', '★전제: 명부를 import 했다');

  /* ★★다섯이라는 ★래칫 — ⑥ naverpay 를 ★명부에 ★올리면 ★여기가 ★빨개진다.
     ★그때 고칠 것은 ★이 수가 아니라 ★`_cpnState` 의 `badgeOn`·`decoOn` ★리터럴이다
       (그 둘은 dataset 을 ★아예 안 읽어 ★배지 프리셋이 ★조용히 무시된다 — DOM C-P7 이 그 자리를 쥔다). */
  assert.equal(CPN_PRESET_KEYS.length, 5,
    `★프리셋 수가 ${CPN_PRESET_KEYS.length} 다 — ★다섯이어야 한다(⑥ naverpay 는 2단계: badge 9축·logo 5축이 제품에 없고 _cpnState 가 badgeOn 을 안 읽는다). 늘렸다면 그 축을 먼저 열어라`);
  assert.deepEqual(diff(CPN_PRESET_KEYS, Object.keys(CPN_PRESETS)), [], '★키 명부와 명부가 갈렸다');
  assert.deepEqual(diff(Object.keys(CPN_PRESETS), CPN_PRESET_KEYS), [], '★명부와 키 명부가 갈렸다(반대 방향)');

  /* ★label 은 ★정본 쪽에 있다 — ⛔패널이 글을 지어 박지 않게(effects-registry.js:14 의 그 규약) */
  const noLabel = CPN_PRESET_KEYS.filter(k => typeof CPN_PRESETS[k]?.label !== 'string' || !CPN_PRESETS[k].label);
  assert.deepEqual(noLabel, [], `★label 이 없는 프리셋이 있다 — 칩에 키가 그대로 뜬다(${noLabel.join(',')})`);
  const noV = CPN_PRESET_KEYS.filter(k => !CPN_PRESETS[k]?.v || typeof CPN_PRESETS[k].v !== 'object');
  assert.deepEqual(noV, [], `★값 묶음(v)이 없는 프리셋이 있다(${noV.join(',')})`);
});

/* ═══ C-P2 ★★칩이 ★명부를 ★읽는다 — ★지디가 콕 집은 ★양성대조 ══════════════════ */

test('C-P2 ★★명부가 늘면 ★칩이 ★저절로 생긴다 — ★가짜 키를 더한 판에서 ★칩이 ★하나 늘어난다', () => {
  /* ⛔`칩 수 === 키 수` ★하나로는 ★둘이 ★같은 소스라 ★항등식이고 ★손으로 적은 판도 통과한다.
     ⇒ ★★출처(명부)를 ★갈아 끼워 ★출력이 ★따라오는지로만 증명된다. */
  const block = mkBlock();
  const base = chipKeys(couponPresetChipsHTML(block));

  /* ★전제 ⑴ — ★실물에서 ★칩 == 명부 키(★이 자가 ★지금 맞게 서 있나). ⛔등호 아님 — 집합차 양방향 */
  assert.deepEqual(diff(base, CPN_PRESET_KEYS), [],
    `★명부에 없는 칩이 있다 — 칩이 제 손으로 이름을 적었다 (${diff(base, CPN_PRESET_KEYS).join(',')})`);
  assert.deepEqual(diff(CPN_PRESET_KEYS, base), [],
    `★명부에 있는데 칩이 안 났다 (${diff(CPN_PRESET_KEYS, base).join(',')})`);

  /* ★전제 ⑵ — ★가짜 이름이 ★실물 명부에 ★없다(있으면 아래가 뜻이 없다) */
  const FAKE = '__wobblepreset';
  assert.ok(!CPN_PRESET_KEYS.includes(FAKE), `★전제: ${FAKE} 가 실물 명부에 이미 있다 — 다른 이름을 골라라`);

  /* ★★갈아 끼운 판 — ★대역은 ★실물에서 ★파생시킨다(⛔이름을 지어내지 않는다) */
  const MORE = Object.freeze({ ...CPN_PRESETS, [FAKE]: Object.freeze({ label: '＠가짜＠', v: Object.freeze({}) }) });
  const got = chipKeys(chipsWith(MORE, block));

  /* ★★`base.length + 1` 이 ★아니라 ★★«정본 수 ＋ 1» 에 견준다 — 둘은 같지만 ★뜻이 다르다 */
  assert.equal(got.length, CPN_PRESET_KEYS.length + 1,
    `★명부에 키를 하나 더했는데 ★칩이 ${got.length} 개다 — ★★칩이 ★손으로 적은 명부를 쓴다 [${got.join(',')}]`);
  assert.ok(got.includes(FAKE), `★더한 키(${FAKE})의 칩이 ★안 생겼다 — [${got.join(',')}]`);

  /* ★음성대조 — ★줄인 판에서는 ★줄어든다(한 방향만 재면 「늘 전부 그린다」와 구분이 안 된다) */
  const ONE = Object.freeze({ [CPN_PRESET_KEYS[0]]: CPN_PRESETS[CPN_PRESET_KEYS[0]] });
  const few = chipKeys(chipsWith(ONE, block));
  assert.equal(few.length, 1, `★명부를 하나로 줄였는데 칩이 ${few.length} 개다 [${few.join(',')}]`);
});

test('C-P3 ★★label 을 ★읽는다 — ★글을 바꾼 판에서 ★칩 글이 따라오고 ★실물 글은 사라진다', () => {
  const k0 = CPN_PRESET_KEYS[0];
  const MARK = '＠검사용쿠폰프리셋글＠';
  const block = mkBlock();
  assert.ok(!couponPresetChipsHTML(block).includes(MARK),
    '★전제: 표식이 실물 출력에 ★이미 있다 — 다른 표식을 골라라');
  const real = CPN_PRESETS[k0].label;
  assert.ok(couponPresetChipsHTML(block).includes(real), `★전제: 실물 label(${real})이 출력에 없다 — 이 자가 글을 못 읽는다`);

  const FAKE = Object.freeze({
    ...CPN_PRESETS,
    [k0]: Object.freeze({ ...CPN_PRESETS[k0], label: MARK }),
  });
  const h = chipsWith(FAKE, block);
  assert.ok(h.includes(MARK), `★label 을 바꿨는데 칩이 안 따라왔다 — ★글을 ★제 손으로 적었다(${k0})`);
  /* ★음성대조 — ★실물 글은 ★사라졌다(안 사라졌으면 ★둘 다 적고 있는 것이다) */
  assert.ok(!h.includes(real), `★바꾼 판에 ★실물 글(${real})이 ★남아 있다 — 글이 두 자리에서 온다`);

  /* ★`|| key` ★폴백 — ★label 없는 키가 와도 ★조용히 ★빈칸이 되지 않는다 */
  const NOLBL = Object.freeze({ ...CPN_PRESETS, __nolabel: Object.freeze({ v: Object.freeze({}) }) });
  assert.ok(chipsWith(NOLBL, block).includes('__nolabel'), '★label 없는 키가 ★조용히 빈칸이 됐다 — `|| key` 폴백이 죽었다');
});

test('C-P3b ★지금 걸린 프리셋만 ★active 다 — ★명부 밖 값은 ★아무 칩도 안 켠다', () => {
  const k0 = CPN_PRESET_KEYS[0];
  const on = couponPresetChipsHTML(mkBlock({ preset: k0 }));
  /* ★자 — ★class 에 `active` 가 붙은 칩의 키를 센다. ⛔`aria-pressed` 로 재지 마라:
     ★그 속성은 ★«참/거짓 둘 다» 찍히므로 ★한 자로 ★둘을 못 가른다(★꼴만 보고 세면 전부 잡힌다). */
  const activeKeys = (html) => (html.match(/<button class="prop-align-btn active"[^>]*?data-cpn-preset="([^"]+)"/gs) || [])
    .map(s => (s.match(/data-cpn-preset="([^"]+)"/) || [])[1]);
  /* ★전제 — ★이 자가 ★«안 켜진 칩»을 ★안 잡는다(음성대조). ★아니면 아래 전부가 뜻이 없다 */
  assert.equal(activeKeys(couponPresetChipsHTML(mkBlock())).length, 0,
    '★이 자가 ★안 켜진 칩까지 ★잡는다 — 아래 단언이 뜻을 잃는다');
  assert.deepEqual(activeKeys(on), [k0], `★고른 칩 하나만 active 여야 한다 — [${activeKeys(on).join(',')}]`);
  assert.deepEqual(activeKeys(couponPresetChipsHTML(mkBlock())), [], '★프리셋이 없는 블럭에 ★active 칩이 있다');
  assert.deepEqual(activeKeys(couponPresetChipsHTML(mkBlock({ preset: '__nope' }))), [],
    '★명부 밖 값인데 ★칩이 켜졌다');
  assert.equal(couponPresetOf(mkBlock({ preset: '__nope' })), '', '★명부 밖 값을 ★그대로 돌려준다');
  assert.equal(couponPresetOf(mkBlock({ preset: k0 })), k0, '★명부 안 값을 ★못 돌려준다');
});

/* ═══ C-P6 ★★허용값 명부가 ★하나인가 — ★«소스 읽기»로만 잴 수 있는 자리 ═════════ */

test('C-P6 ★★`_cpnState` 가 ★COUPON_ENUMS ★한 표를 읽는다 — ★리터럴 화이트리스트 0건', () => {
  const src = readSrc(REPO, 'js/blocks/coupon-block.js');

  /* ★전제 — ★그 파일이 ★이 표를 ★실제로 들여온다 */
  assert.ok(/import\s*\{[^}]*COUPON_ENUMS[^}]*\}\s*from\s*'\.\/coupon-presets\.js'/.test(src),
    '★coupon-block.js 가 COUPON_ENUMS 를 ★안 들여온다 — 표가 둘이 된다');

  /* ★★소비자 전수 — ★표의 ★모든 축이 ★그 파일에서 ★쓰인다(★명부 ⊇ 실패집합 ＋ 명부 밖 0건) */
  const axes = Object.keys(COUPON_ENUMS);
  const used = axes.filter(a => src.includes(`COUPON_ENUMS.${a}`));
  assert.deepEqual(diff(axes, used), [],
    `★표에 있는데 ★안 쓰이는 축이 있다 — 그 축은 ★어딘가 리터럴로 남아 있다 (${diff(axes, used).join(',')})`);

  /* ★★양성대조 — ★이 자가 ★정말 «쓰임»을 보나. ★없는 축 이름은 ★0건이어야 한다 */
  assert.ok(!src.includes('COUPON_ENUMS.__nosuchaxis'),
    '★음성대조 깨짐 — 없는 축 이름이 소스에서 잡혔다(이 자는 아무거나 잡는다)');
  assert.ok(src.includes(`COUPON_ENUMS.${axes[0]}`), `★양성대조 깨짐 — ★있는 축(${axes[0]})을 못 잡는다`);

  /* ★★되살아난 리터럴 — ★`_cpnState` 본문에 ★표의 값들이 ★배열 꼴로 ★다시 적히면 ★빨강.
     ★자는 ★표에서 ★파생시킨다(⛔리터럴을 ★이 검사에 ★손으로 적지 않는다). */
  const body = src.slice(src.indexOf('function _cpnState('), src.indexOf('function cpnResponsiveSvg('));
  assert.ok(body.length > 200, '★전제: `_cpnState` 본문을 못 잘랐다 — 이 칸은 아무것도 재고 있지 않다');
  const revived = axes.filter((a) => {
    const lit = `[${COUPON_ENUMS[a].map(v => `'${v}'`).join(', ')}]`;
    return body.includes(lit);
  });
  assert.deepEqual(revived, [],
    `★_cpnState 안에 ★허용값 리터럴이 ★되살아났다 — 표가 둘이 됐다(${revived.join(',')})`);

  /* ★★`perfDir` ★동치 — ★전엔 `=== 'h' ? 'h' : D.perfDir` 였다.
     ★목록으로 바꿔도 ★행동이 같으려면 ⑴ 표가 ★{'v','h'} 뿐이고 ⑵ 기본이 ★'v' 여야 한다. */
  assert.deepEqual(Array.from(COUPON_ENUMS.perfDir).sort(), ['h', 'v'],
    '★perfDir 표가 ★{v,h} 가 아니다 — 옛 `=== h` 꼴과 ★행동이 갈린다');
  assert.ok(/perfOn:\s*false,\s*perfDir:\s*'v'/.test(src),
    '★COUPON_DEFAULTS.perfDir 이 ★\'v\' 가 아니다 — 옛 꼴의 ★else 가지와 갈린다');
  assert.ok(!/dataset\?\.perfDir\s*===\s*'h'/.test(src), '★옛 `=== h` 꼴이 ★아직 남아 있다');
});

/* ═══ C-P9 ★★프리셋 ★전수 × ★허용값 — ★「조용히 떨어지는」 자리를 잠근다 ════════ */

/** ★한 명부를 ★허용값 표에 ★견준다 — ★★이 함수가 ★피검 대상이자 ★계측기다
 *  ⇒ ★★그래서 ★아래에서 ★«일부러 어긴 명부»로 ★같은 함수를 돌려 ★계측기부터 증명한다. */
function enumViolations(roster, enums) {
  const out = [];
  for (const k of Object.keys(roster)) {
    const v = (roster[k] && roster[k].v) || {};
    for (const ax of Object.keys(v)) {
      if (!enums[ax]) continue;                        /* 열거형이 아닌 축은 여기서 안 잰다 */
      if (!enums[ax].includes(v[ax])) out.push(`${k}.${ax}=${String(v[ax])}`);
    }
  }
  return out;
}

test('C-P9 ★★프리셋 전수의 ★열거형 값이 ★`_cpnState` 허용 목록 ★안에 있다', () => {
  /* ★★전제 — ★이 검사가 ★공집합으로 ★거짓통과하지 않게 ★«실제로 잰 칸 수»를 세어 ★단언한다 */
  let pairs = 0;
  const touched = new Set();
  for (const k of CPN_PRESET_KEYS) {
    for (const ax of Object.keys(CPN_PRESETS[k].v)) {
      if (COUPON_ENUMS[ax]) { pairs++; touched.add(ax); }
    }
  }
  assert.ok(pairs >= CPN_PRESET_KEYS.length,
    `★전제: 잰 (프리셋×열거형축) 칸이 ${pairs} 개다 — 프리셋 수(${CPN_PRESET_KEYS.length})보다 적으면 이 검사는 거의 아무것도 안 잰다`);

  /* ★주 단언 — ⛔허용 목록을 ★글자로 적지 않았다. ★표에서 ★뽑았다 */
  const bad = enumViolations(CPN_PRESETS, COUPON_ENUMS);
  assert.deepEqual(bad, [],
    `★프리셋 값이 ★_cpnState 허용 목록을 ★벗어났다 — ★칩을 눌러도 ★조용히 기본값으로 떨어진다(${bad.join(' · ')})`);

  /* ★★양성대조 — ★계측기부터 증명한다. ★한 값을 어긴 판에서 ★★그 이름이 나오나 */
  const k0 = CPN_PRESET_KEYS[0];
  const BAD = Object.freeze({
    ...CPN_PRESETS,
    [k0]: Object.freeze({ ...CPN_PRESETS[k0], v: Object.freeze({ ...CPN_PRESETS[k0].v, split: '__bad__' }) }),
  });
  const caught = enumViolations(BAD, COUPON_ENUMS);
  assert.deepEqual(caught, [`${k0}.split=__bad__`],
    `★일부러 어긴 값을 ★이 자가 ★못 잡는다 — ★주 단언의 초록은 ★「안 재고 있다」와 구분이 안 된다 [${caught.join(',')}]`);

  /* ★★음성대조 — ★열거형이 ★아닌 축(수·색)은 ★이 자가 ★건드리지 않는다(거짓양성 없음) */
  const NUM = Object.freeze({
    ...CPN_PRESETS,
    [k0]: Object.freeze({ ...CPN_PRESETS[k0], v: Object.freeze({ ...CPN_PRESETS[k0].v, pad: 9999 }) }),
  });
  assert.deepEqual(enumViolations(NUM, COUPON_ENUMS), [], '★열거형이 아닌 축을 ★이 자가 ★잡았다(거짓양성)');

  /* ★★안 재는 축을 ★이름으로 적는다 — ⛔「전수 통과」로 ★덮지 않는다.
     ★`bgKind` 는 ★다섯 프리셋 ★어느 것도 ★안 적는다(제품 기본 'coupon' 이 ★리셋으로 들어간다)
       ⇒ ★그 축은 ★이 검사가 ★★재고 있지 않다. */
  const untouched = Object.keys(COUPON_ENUMS).filter(a => !touched.has(a));
  assert.deepEqual(untouched, ['bgKind'],
    `★안 재는 열거형 축의 명부가 ★바뀌었다 — 잰 축 [${[...touched].join(',')}] · 안 잰 축 [${untouched.join(',')}]. 명부를 고치거나 그 축을 쓰는 프리셋을 올려라`);
});

test('C-P9b ★슬롯 값도 ★제품 축 안에 있다 — ★칸 이름·글자 크기 바닥·천장', () => {
  const SLOT_KEYS = ['top', 'num', 'unit', 'bot', 'stub'];   /* ★출처 = js/blocks/coupon-block.js COUPON_SLOTS */
  const src = readSrc(REPO, 'js/blocks/coupon-block.js');
  /* ★전제 — ★위 다섯이 ★정본과 같다(⛔내가 지어낸 명부가 되지 않게 ★소스에서 확인) */
  for (const k of SLOT_KEYS) {
    assert.ok(src.includes(`key: '${k}'`), `★전제: 정본 COUPON_SLOTS 에 '${k}' 가 없다 — 이 검사의 명부가 틀렸다`);
  }
  const FS = { min: 6, max: 150 };                           /* ★출처 = 같은 파일 CPN_FS_MIN·CPN_FS_MAX */
  assert.ok(src.includes(`const CPN_FS_MIN = ${FS.min};`) && src.includes(`const CPN_FS_MAX = ${FS.max};`),
    '★전제: CPN_FS_MIN/MAX 가 소스와 다르다 — 이 검사가 틀린 자로 잰다');

  const bad = [];
  for (const k of CPN_PRESET_KEYS) {
    const slots = CPN_PRESETS[k].slots || {};
    for (const sk of Object.keys(slots)) {
      if (!SLOT_KEYS.includes(sk)) { bad.push(`${k}.slot:${sk}`); continue; }
      const s = slots[sk];
      if (!Number.isFinite(s.size) || s.size < FS.min || s.size > FS.max) bad.push(`${k}.${sk}.size=${s.size}`);
      if (typeof s.color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(s.color)) bad.push(`${k}.${sk}.color=${s.color}`);
      if (typeof s.on !== 'boolean') bad.push(`${k}.${sk}.on=${s.on}`);
      if (typeof s.text !== 'string') bad.push(`${k}.${sk}.text=${s.text}`);
    }
  }
  assert.deepEqual(bad, [], `★슬롯 값이 제품 축을 벗어났다 — applyCouponPreset 이 ★걸러 버린다(${bad.join(' · ')})`);

  /* ★양성대조 — ★다섯이 ★모두 ★칸 다섯을 ★다 적었나(빠지면 ★리셋 기본이 들어가 ★시안과 갈린다) */
  const missing = CPN_PRESET_KEYS.filter(k => diff(SLOT_KEYS, Object.keys(CPN_PRESETS[k].slots || {})).length);
  assert.deepEqual(missing, [], `★칸 다섯을 다 안 적은 프리셋이 있다 (${missing.join(',')})`);
});

/* ═══ C-P10 ★패널이 ★칩을 ★한 자리에서 부른다 (★선례 = 파티클 P10) ════════════ */

test('C-P10 ★패널이 ★칩 그리개를 ★부르고 ★배선을 ★한 쌍으로 건다 ＋ ★index.html 이 싣는다', () => {
  const src = readSrc(REPO, 'js/props/prop-coupon.js');
  /* ★★둘 중 하나만 있으면 ★칩은 ★뜨는데 ★안 눌린다(또는 반대) — ★그 반쪽 고장을 ★이름으로 잠근다 */
  assert.ok(src.includes('couponPresetChipsHTML('), 'prop-coupon.js 가 ★칩 그리개를 안 부른다 — 칩이 안 뜬다');
  assert.ok(src.includes('[data-cpn-preset]'), 'prop-coupon.js 가 ★칩 배선을 안 건다 — 칩이 안 눌린다');
  assert.ok(src.includes('window.applyCouponPreset'), 'prop-coupon.js 가 ★적용 문을 안 부른다');

  /* ★★그리개 호출이 ★「Coupon」 절 ★안인가 — 제목 뒤, ★다음 절 제목 앞 */
  const sec  = src.indexOf('>Coupon<');
  const call = src.indexOf('couponPresetChipsHTML(block)');
  const next = src.indexOf('글자 칸 ', sec);
  assert.ok(sec > 0, '★전제: 「Coupon」 절 제목을 못 찾았다 — 이 검사가 자리를 못 잰다');
  assert.ok(next > sec, '★전제: 다음 절을 못 찾았다 — 구간을 못 만든다');
  assert.ok(call > sec && call < next,
    `★칩 호출이 ★「Coupon」 절 밖에 있다 (절 ${sec} · 호출 ${call} · 다음 절 ${next})`);

  /* ★한 자리인가 — ⛔두 자리에서 부르면 칩이 ★두 벌 뜬다 */
  const n = (src.match(/couponPresetChipsHTML\(block\)/g) || []).length;
  assert.equal(n, 1, `★칩 그리개를 ★${n} 자리에서 부른다 — ★한 자리여야 한다`);

  /* ★★index.html 이 ★싣는다 — ⛔배선이 빠져 앱에서 죽은 ★그 사고의 자리(파티클 P10 의 그 줄) */
  const html = readSrc(REPO, 'index.html');
  assert.ok(html.includes('js/blocks/coupon-presets.js'),
    '★index.html 이 ★명부를 안 싣는다 — ★「머지됐다 ≠ 앱에 있다」의 그 자리다');

  /* ★★다시 그릴 때 ★`reopen()` 을 쓴다 — ⛔`showCouponProperties(block, openKey)` 는 ★토글이라 칸을 닫는다 */
  const wire = src.slice(src.indexOf('[data-cpn-preset]'), src.indexOf('[data-cpn-on]'));
  assert.ok(wire.length > 60, '★전제: 칩 배선 구간을 못 잘랐다');
  assert.ok(wire.includes('reopen()'), '★칩 배선이 ★reopen() 을 안 쓴다 — 열려 있던 칸이 조용히 닫힌다');
  assert.ok(!/showCouponProperties\(block,/.test(wire),
    '★칩 배선이 ★showCouponProperties(block, …) 를 직접 부른다 — 토글이 또 돌아 칸이 닫힌다');

  /* ★★히스토리는 ★한 번 — ⛔`applyCouponPreset` 이 스스로 쌓지 않는다(한 제스처 = 한 칸) */
  const blk = readSrc(REPO, 'js/blocks/coupon-block.js');
  const fn = blk.slice(blk.indexOf('function applyCouponPreset('), blk.indexOf('window.applyCouponPreset'));
  assert.ok(fn.length > 400, '★전제: applyCouponPreset 본문을 못 잘랐다');
  assert.ok(!fn.includes('pushHistory'), '★applyCouponPreset 이 ★스스로 히스토리를 쌓는다 — ⌘Z 가 두 번이 된다');
  assert.ok(wire.includes('commit()'), '★칩 배선이 ★push-after 를 안 한다 — ⌘Z 가 칩을 못 되돌린다');

  /* ★★이름 — ⛔`update*Block` 이면 model-update-history 래퍼가 물어 히스토리가 두 번이 된다 */
  assert.ok(!/function\s+updateCouponBlock\b/.test(blk), '★`updateCouponBlock` 이름을 ★쓰면 안 된다(래퍼가 물어 ⌘Z 가 두 번)');
});

/* ═══ C-P11 ★「되돌린 뒤 덮는다」 — ★명부가 ★기본값을 ★또 적지 않았다 ══════════ */

test('C-P11 ★명부가 ★기본값을 ★다시 적지 않았다 — ⛔둘째 명부의 싹을 잰다', () => {
  const src = readSrc(REPO, 'js/blocks/coupon-block.js');
  /* ★적용 문이 ★먼저 ★되돌리나 — ★그래야 ★명부에 ★기본값을 ★안 적어도 된다 */
  const fn = src.slice(src.indexOf('function applyCouponPreset('), src.indexOf('window.applyCouponPreset'));
  assert.ok(fn.includes('Object.keys(COUPON_DEFAULTS)'), '★적용 문이 ★COUPON_DEFAULTS 전 축을 ★안 되돌린다 — 앞 프리셋 값이 남는다');
  assert.ok(/k === 'width'/.test(fn), "★`width` 예외가 ★없다 — ★사용자가 끈 폭이 ★프리셋에 ★덮인다");
  assert.ok(fn.includes('for (const s of COUPON_SLOTS)'), '★적용 문이 ★칸 다섯을 ★안 되돌린다');
  /* ★★쓰기 «전»에 거르나 — ⛔쓰고 나서 고치면 ★저장본과 화면이 ★갈린다 */
  assert.ok(fn.includes('skipped.push'), '★걸러 낸 것을 ★안 알린다 — 조용히 떨어진다');
  assert.ok(/continue;/.test(fn), '★못 받는 값을 ★건너뛰지 않는다 — dataset 에 쓰레기가 쓰인다');
});
