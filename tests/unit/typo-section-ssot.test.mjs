/* U-TYPOSSOT — Typography·Fill 절이 «한 곳»에서 나오는가. (2026-09-08, B단위)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는데
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다.
 *
 * ★왜 이 파일이 있나
 *   현빈: 「텍스트를 선택하면 … 타이포그라피 절이 들어가야지. 일반 텍스트블럭을 선택한 것처럼.」
 *   모달 패널에 텍스트 패널과 «같은» Typography·Fill 절을 붙이는 작업이다.
 *   그 마크업은 prop-text-template.js 의 거대 템플릿 리터럴 «안»에 박혀 있었다 —
 *   손으로 베끼면 두 벌이 되고, 두 벌은 조용히 갈라진다.
 *   ⇒ `_typo-section.js` 로 뽑았다. 이 파일이 지키는 것은 «둘»이다:
 *     ⑴ 뽑기가 «동작 무변경»이었다        → 골든 비교 (T1)
 *     ⑵ 두 패널이 «그 함수를» 실제로 부른다 → 호출 단언 (T2·T3)
 *   ⛔⑵ 가 없으면 다음 사람이 한쪽을 인라인 마크업으로 되돌려도 검사가 초록이다.
 *     선례: align-btn-ssot.test.mjs · grid-callsite-ssot.test.mjs.
 *
 * ⚠️이 파일은 «동작»과 «소스 문자열»을 둘 다 단언한다. 정상적인 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 지우지 말고 「절이 여전히 한 곳에서 오는가」를 확인한 뒤 패턴을 고쳐라.
 *
 * ⛔주석 걷어내기는 공용 부품(./_strip-comments.js)만 쓴다. 자기 벌을 만들면
 *   strip-comments-shared.test.js 의 S-6 가 즉시 빨강을 낸다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { readSrc } = _req('./_srcread.js');
const { loadTextTemplate, GOLDEN_STATE, GOLDEN_STATE_MIX } = _req('./_text-template-harness.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXDIR = path.join(ROOT, 'tests/fixtures');

const SRC = {
  template: stripComments(readSrc(ROOT, 'js/props/prop-text-template.js')),
  modal:    stripComments(readSrc(ROOT, 'js/props/prop-modal.js')),
  typo:     stripComments(readSrc(ROOT, 'js/props/_typo-section.js')),
  fontWire: stripComments(readSrc(ROOT, 'js/props/prop-text-wireup-font.js')),
  picker:   stripComments(readSrc(ROOT, 'js/props/_font-picker.js')),
};

const { buildTextPropsHtml } = loadTextTemplate();

/* ══ T0 — 「입력이 살아 있다」. 본 단언 «앞»에 세운다. ════════════════════ */

test('T0 ★하네스가 실제로 HTML 을 낸다 + 골든 픽스처가 둘 다 있다', () => {
  // 되돌리면 빨강: 하네스가 죽거나(빈 문자열) 픽스처가 지워지면.
  const out = buildTextPropsHtml(GOLDEN_STATE);
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 5000,
    `산출 HTML 이 ${out.length}자다 — 너무 짧다. 하네스가 죽었으면 T1 이 «빈 것끼리» 비교하며 초록이 된다.`);
  for (const f of ['text-props-golden.html', 'text-props-golden-mix.html']) {
    assert.ok(fs.existsSync(path.join(FIXDIR, f)), `골든 픽스처 ${f} 가 없다 — T1 이 아무것도 안 본다`);
  }
  // 두 상태가 «서로 다른» 결과를 내야 한다 — 같으면 mix/isLiner 분기를 안 보는 것이다.
  assert.notEqual(buildTextPropsHtml(GOLDEN_STATE), buildTextPropsHtml(GOLDEN_STATE_MIX),
    '두 골든 상태가 같은 HTML 을 낸다 — mix·isLiner 분기가 통째로 안 보이는 채로 초록이 된다');
});

/* ══ T1 — 뽑기는 «동작 무변경»이었다 ══════════════════════════════════════ */

test('T1 ★텍스트 패널 산출 HTML 이 추출 «전»과 한 글자도 다르지 않다 (골든)', () => {
  // 되돌리면 빨강: _typo-section.js 의 마크업을 한 글자라도 바꾸면(들여쓰기 포함).
  const CASES = [
    ['text-props-golden.html', GOLDEN_STATE, '보통 상태'],
    ['text-props-golden-mix.html', GOLDEN_STATE_MIX, 'Mix + isLiner 상태'],
  ];
  for (const [file, state, what] of CASES) {
    const want = fs.readFileSync(path.join(FIXDIR, file), 'utf8');
    const got = buildTextPropsHtml(state);
    if (got === want) continue;
    let at = 0;
    while (at < want.length && want[at] === got[at]) at++;
    assert.fail(
      `${what}: 텍스트 패널 산출 HTML 이 «추출 전»과 달라졌다 (${want.length} → ${got.length}자).\n` +
      `  첫 차이 ${at}번째 글자:\n` +
      `    전: ${JSON.stringify(want.slice(Math.max(0, at - 70), at + 70))}\n` +
      `    후: ${JSON.stringify(got.slice(Math.max(0, at - 70), at + 70))}\n` +
      `★이 픽스처는 «추출 직전»의 코드가 낸 실물이다. 텍스트 패널을 일부러 바꾼 것이 아니라면 ` +
      `_typo-section.js 가 원문과 어긋난 것이다. 일부러 바꿨다면 픽스처를 같은 커밋에서 다시 떠라.`);
  }
});

test('T1-b ★id 접두사만 갈아끼우면 «모달용» 마크업이 나온다 (txt- 가 안 샌다)', () => {
  // 되돌리면 빨강: 절 안에 'txt-' 를 하드코딩해 두면(그러면 모달에서 id 가 충돌한다).
  const typo = _req('node:vm');
  const mdl = buildSection('buildTypographySectionHtml', {
    p: 'mdl-typo', font: 'Georgia, serif', weight: '700', size: 36,
    isBold: false, isItalic: false, isStrike: false, isHighlight: false,
    lh: 1.7, ls: 0, sizeMin: 10, sizeMax: 60,
  });
  assert.ok(mdl.includes('id="mdl-typo-font-trigger"'), `모달 id 가 안 나왔다:\n${mdl.slice(0, 300)}`);
  assert.doesNotMatch(mdl, /id="txt-/,
    `p='mdl-typo' 인데 «txt-» id 가 새어 나왔다 — 접두사를 안 탄 자리가 있다. ` +
    `그 자리는 두 패널에서 id 가 겹쳐 «텍스트 패널의 입력»을 모달이 집어간다:\n` +
    (mdl.match(/id="txt-[a-z-]*"/g) || []).join(' · '));
  const fill = buildSection('buildFillSectionHtml', { p: 'mdl-typo', colorHex: '#1c1c1e', alpha: 100 });
  assert.ok(fill.includes('id="mdl-typo-color"'), `모달 Fill id 가 안 나왔다:\n${fill}`);
  assert.doesNotMatch(fill, /id="txt-/, `Fill 절에 «txt-» id 가 남았다: ${(fill.match(/id="txt-[a-z-]*"/g) || []).join(' · ')}`);
  void typo;
});

/* `_typo-section.js` 의 순수 함수를 «소스 그대로» 돌린다(베끼지 않는다). */
function buildSection(name, arg) {
  const vm = _req('node:vm');
  const utils = readSrc(ROOT, 'js/props/prop-text-utils.js')
    .replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  const body = readSrc(ROOT, 'js/props/_typo-section.js')
    .replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(`${utils}\n;${body}\n;globalThis.__F = { buildTypographySectionHtml, buildFillSectionHtml };`,
    ctx, { filename: 'js/props/_typo-section.js' });
  return ctx.__F[name](arg);
}

/* ══ T2 — 두 패널이 «같은 함수»를 부른다 ══════════════════════════════════ */

const IMPORT_TYPO = /import\s*\{[^}]*\bbuildTypographySectionHtml\b[^}]*\}\s*from\s*['"][^'"]*_typo-section\.js['"]/;
const IMPORT_FILL = /import\s*\{[^}]*\bbuildFillSectionHtml\b[^}]*\}\s*from\s*['"][^'"]*_typo-section\.js['"]/;

test('T2 ★텍스트 패널과 모달 패널이 «둘 다» _typo-section.js 를 import 해서 부른다', () => {
  // 되돌리면 빨강: 한쪽을 인라인 마크업으로 되돌리면(이 파일의 존재 이유 그 자체다).
  for (const [name, src] of [['prop-text-template.js', SRC.template], ['prop-modal.js', SRC.modal]]) {
    assert.match(src, IMPORT_TYPO,
      `${name} 이 buildTypographySectionHtml 을 import 하지 않는다 — 인라인 마크업으로 되돌아갔나. ` +
      `두 패널이 «다른 벌»을 들면 한쪽만 고쳐도 조용히 갈라진다.`);
    assert.match(src, IMPORT_FILL, `${name} 이 buildFillSectionHtml 을 import 하지 않는다`);
    assert.match(src, /\$\{buildTypographySectionHtml\(/,
      `${name} 이 buildTypographySectionHtml 을 «부르지» 않는다 — import 만 하고 안 쓰면 소용없다`);
    assert.match(src, /\$\{buildFillSectionHtml\(/, `${name} 이 buildFillSectionHtml 을 «부르지» 않는다`);
  }
});

test('T2-b ★절의 «알맹이»가 _typo-section.js 밖에 리터럴로 없다', () => {
  /* 지문 = 그 절에만 있는 id 조각들. 호출부에 이게 «글자로» 있으면 마크업이 되돌아온 것이다.
     ⛔`id="txt-font-picker"` 처럼 접두사 박힌 형태로 재면 모달 쪽 복붙을 못 잡는다 —
       그래서 «접두사 없는 꼬리»로 잰다. */
  const TAILS = ['-font-trigger"', '-font-dropdown"', '-style-group"', '-lh-number"', '-ls-col"', '-color-chips"'];
  assert.ok(TAILS.length >= 5, '지문이 너무 적다 — 이 검사가 헐거워진다');
  for (const [name, src] of [['prop-text-template.js', SRC.template], ['prop-modal.js', SRC.modal]]) {
    for (const t of TAILS) {
      assert.equal(src.includes(t), false,
        `${name} 에 «${t}» 가 리터럴로 있다 — Typography/Fill 마크업이 호출부로 되돌아왔다. ` +
        `그림도 id 도 _typo-section.js «한 곳»에만 산다.`);
    }
  }
  // 양성대조 — 지문은 실제로 _typo-section.js «안»에는 있어야 한다(잣대가 살아 있다는 증거).
  for (const t of TAILS) {
    assert.ok(SRC.typo.includes(t),
      `지문 «${t}» 가 _typo-section.js 에도 없다 — 잣대가 낡았다. 이 상태로는 위 루프가 «아무것도» 안 보고 초록이 된다.`);
  }
});

/* ══ T3 — 폰트 피커 위젯도 «한 곳»에서 온다 ═══════════════════════════════ */

test('T3 ★폰트 피커 위젯이 _font-picker.js 한 곳에 있고, 텍스트 배선은 그걸 부른다', () => {
  // 되돌리면 빨강: 위젯을 prop-text-wireup-font.js 로 되돌리거나 모달이 자기 벌을 만들면.
  assert.match(SRC.picker, /export function wireFontPicker/, '_font-picker.js 에 wireFontPicker 가 없다');
  assert.match(SRC.fontWire, /import\s*\{[^}]*\bwireFontPicker\b[^}]*\}\s*from\s*['"][^'"]*_font-picker\.js['"]/,
    'prop-text-wireup-font.js 가 wireFontPicker 를 import 하지 않는다 — 위젯이 두 벌이 됐나');
  assert.match(SRC.fontWire, /\bwireFontPicker\s*\(/, 'prop-text-wireup-font.js 가 wireFontPicker 를 «부르지» 않는다');

  /* 위젯의 «알맹이»가 호출부에 남아 있지 않다 — 이게 「반쯤 옮김」을 막는다. */
  const GUTS = ['goditor_font_pins', 'goditor_font_recent', 'font-item-pin', 'queryLocalFonts', '_fpBuildList', '_fpClose'];
  for (const g of GUTS) {
    assert.ok(SRC.picker.includes(g), `지문 «${g}» 가 _font-picker.js 에 없다 — 잣대가 낡았다(그러면 아래가 자기통과한다)`);
    assert.equal(SRC.fontWire.includes(g), false,
      `prop-text-wireup-font.js 에 위젯 알맹이 «${g}» 가 남아 있다 — 위젯이 반만 옮겨졌다.`);
  }
});
