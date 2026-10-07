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
  grid:     stripComments(readSrc(ROOT, 'js/props/prop-grid.js')),
  chat:     stripComments(readSrc(ROOT, 'js/props/prop-chat.js')),
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

/* ⛔★이 골든이 «못 보는» 칸이 ★둘 있다 — 형광펜 «색 칸»(txt-hl-color*)과 ★점 «색 칸»(txt-dot-color*) 마크업.
 *   그 칸은 prop-text.js 가 colorFieldHTML 로 만들어 hlColorHtml 로 넘기는데, 이 하네스는 vm 에
 *   prop-text.js 를 안 올리므로 빈 문자열이 들어간다 ⇒ 골든엔 «빈 자리»로 찍힌다.
 *   ★그 칸이 실제로 서는지는 tests/dom/text-highlight-bar.dom.spec.js H3 ＋ tests/dom/text-dot-over.dom.spec.js D6 이
 *     «앱 통째로» 재고, id 가 안 샜는지는 아래 T1-b 가 본다. ⛔「골든이 초록이니 색 칸도 산다」로 읽지 마라. */
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
  /* ★2026-09-22 (T-049) — 절이 _helpers.js 의 escHtml 을 «실제로» 부른다(폰트 표시 이름은
     OS·설치 폰트에서 오는 글자다). 여기 안 올리면 ReferenceError 로 죽어 이 검사가
     «다른 이유»로 빨개진다. loadTextTemplate 하네스가 같은 이유로 이미 그렇게 한다. */
  const helpers = readSrc(ROOT, 'js/props/_helpers.js')
    .replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  const body = readSrc(ROOT, 'js/props/_typo-section.js')
    .replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(`${utils}\n;${helpers}\n;${body}\n;globalThis.__F = { buildTypographySectionHtml, buildFillSectionHtml };`,
    ctx, { filename: 'js/props/_typo-section.js' });
  return ctx.__F[name](arg);
}

/* ══ T2 — 두 패널이 «같은 함수»를 부른다 ══════════════════════════════════ */

const IMPORT_TYPO = /import\s*\{[^}]*\bbuildTypographySectionHtml\b[^}]*\}\s*from\s*['"][^'"]*_typo-section\.js['"]/;
const IMPORT_FILL = /import\s*\{[^}]*\bbuildFillSectionHtml\b[^}]*\}\s*from\s*['"][^'"]*_typo-section\.js['"]/;

/* ★U3(2026-09-08) — 그리드 «줄 단위» 타이포 패널이 3번째로 들어왔다.
   그리드는 「줄 하나」를 다루므로 mix 는 안 쓰지만, 절 마크업은 «같은 한 곳»에서 와야 한다.
   ★U4(2026-10-06 ⒝ · 현빈 「챗블럭 클릭하면 우측패널에서 동적으로 타이포 크기 조절 — 그리드 줄 블럭처럼」) —
     ★챗이 4번째다. ⛔그때까지 챗은 손으로 만든 <input type=number min=10 max=60> 을 들고 있었고,
       모델은 4~400 을 받았다(chat-block.js CHAT_NUM_BOUNDS) ⇒ 패널이 ★340 을 가렸다.
     ★★왜 이 검사가 그것을 못 봤나 — 이 명부가 «셋»이었고 아래 단언이 `PANELS.length === 3` 이었다.
       prop-chat.js 는 ★분모 밖이라, 「절을 베끼지 마라」가 초록인 채로 사본이 살았다.
       ⇒ 「검사가 있다」는 ★«그 분모 안에서만» 참이다. 명부를 늘릴 때 ★수만 고치면 또 못 본다.
     ⇒ 아래 단언을 «수»가 아니라 ★«이름 집합»으로 바꿨다 — 수만 올리고 줄을 안 넣으면 그 자리에서 빨개진다. */
const TYPO_PANELS = [
  ['prop-text-template.js', () => SRC.template],
  ['prop-modal.js', () => SRC.modal],
  ['prop-grid.js', () => SRC.grid],
  ['prop-chat.js', () => SRC.chat],
];
/** ★Fill(한 색) 절까지 쓰는 패널 — ⛔챗은 «빠진다»: 좌/우 글자색 «둘»이라 한 색 절로 못 담는다
 *  (prop-chat.js Color 절의 chb-color-left·chb-color-right). ⇒ 억지로 넣으면 «틀린 절»이 생긴다.
 *  ★파생이다 — 명부를 손으로 두 벌 적지 않는다. */
const FILL_PANELS = TYPO_PANELS.filter(([name]) => name !== 'prop-chat.js');

test('T2 ★텍스트·모달·그리드·챗 패널이 «전부» _typo-section.js 를 import 해서 부른다', () => {
  // 되돌리면 빨강: 한쪽을 인라인 마크업으로 되돌리면(이 파일의 존재 이유 그 자체다).
  /* ★★⛔`length === N` 으로 닫지 «않는다» — 수만 올리고 줄을 안 넣으면 루프가 한 벌을 조용히 건너뛴다
     (2026-10-06 실측: 그래서 챗이 분모 밖에 1개월 넘게 있었다). 이름 집합으로 잠근다. */
  assert.deepEqual(TYPO_PANELS.map(([name]) => name),
    ['prop-text-template.js', 'prop-modal.js', 'prop-grid.js', 'prop-chat.js'],
    '패널 명부가 낡았다 — 루프가 한 벌을 안 보고 있다. ★수가 아니라 «이름»을 맞춰라');
  assert.deepEqual(FILL_PANELS.map(([name]) => name),
    ['prop-text-template.js', 'prop-modal.js', 'prop-grid.js'],
    'Fill 명부가 낡았다 — 챗은 좌/우 색 «둘»이라 한 색 절을 안 쓴다(까닭은 바로 위 주석)');
  for (const [name, get] of TYPO_PANELS) {
    const src = get();
    assert.match(src, IMPORT_TYPO,
      `${name} 이 buildTypographySectionHtml 을 import 하지 않는다 — 인라인 마크업으로 되돌아갔나. ` +
      `두 패널이 «다른 벌»을 들면 한쪽만 고쳐도 조용히 갈라진다.`);
    assert.match(src, /\$\{buildTypographySectionHtml\(/,
      `${name} 이 buildTypographySectionHtml 을 «부르지» 않는다 — import 만 하고 안 쓰면 소용없다`);
  }
  for (const [name, get] of FILL_PANELS) {
    const src = get();
    assert.match(src, IMPORT_FILL, `${name} 이 buildFillSectionHtml 을 import 하지 않는다`);
    assert.match(src, /\$\{buildFillSectionHtml\(/, `${name} 이 buildFillSectionHtml 을 «부르지» 않는다`);
  }
});

test('T2-d ★끈 칸이 «정말» 꺼진다 — 챗이 쓰는 조합에서 ㉠ 크기칸만 보이고 ㉡ 나머지는 숨고 ㉢ 기본 호출은 그대로다', () => {
  /* ★왜 재나 — ⒝ 에서 「렌더러가 안 읽는 칸은 끄고 까닭을 적어라」가 조건이었다(지디). 그 조건은
     «무엇으로 아나»가 같이 걸려야 집행된다 ⇒ 여기가 그 자다.
     ⛔「숨겼다」를 눈으로 믿지 마라 — 끄는 인자 이름을 하나 잘못 적어도 산출은 멀쩡해 보인다(그냥 펴진 채다). */
  const H = buildSection('buildTypographySectionHtml', {
    p: 'chb-typo', size: 32, sizeMin: 4, sizeMax: 400,
    showFont: false, showWeight: false, showStyleGroup: false,
    showLetterSpacing: false, showLineHeight: false, showHighlight: false,
  });
  // ㉠ 전제 — 이 조합에서 «크기칸은 산다». 이게 거짓이면 아래 ㉡ 는 「아무것도 없다」를 재는 것이 된다.
  assert.match(H, /id="chb-typo-size-number"[^>]*min="4" max="400"/, '전제: 크기칸이 모델 경계로 나와야 한다');
  assert.match(H, /id="chb-typo-size-number"[^>]*display:block/, '전제: 크기칸은 보여야 한다');
  // ㉡ 끈 것 — 다섯. ★이름으로 센다(수로만 세면 하나가 조용히 켜져도 안 보인다).
  const OFF = [
    ['Font 라벨',   /class="prop-field-label" style="display:none">Font</],
    ['Font 피커',   /id="chb-typo-font-picker" style="display:none"/],
    ['굵기 select', /id="chb-typo-font-weight" style="flex:1;display:none"/],
    ['B\/I\/S 그룹', /id="chb-typo-style-group"[^>]*display:none/],
    ['줄간격 열',   /class="prop-lhls-col" style="display:none"/],
    ['자간 열',     /id="chb-typo-ls-col"[^>]*display:none/],
  ];
  for (const [label, re] of OFF) assert.match(H, re, `★«${label}» 이 안 꺼졌다 — 챗 렌더러는 그 값을 «안 읽는다»(눌리는데 아무 일도 안 난다)`);
  assert.equal(/highlight-btn/.test(H), false, '형광펜(H) 단추가 남았다 — showHighlight:false 가 안 먹었다');
  /* ★밑줄(U) — 안 주면 ★없다(⑤ · 2026-10-08). 이게 모달·그리드·챗 마크업의 «바이트 동일»을 지키는 자다. */
  assert.equal(/underline-btn/.test(H), false,
    '★밑줄(U) 단추가 챗 조합에 생겼다 — showUnderline 기본값이 false 가 아니다. ' +
    '그러면 모달·그리드·챗 골든(tests/dom/fixtures/grid-panel-golden.json 등 ★공유 픽스처)이 통째로 갈린다');
  assert.equal(/dot-btn|dot-size-row/.test(H), false,
    '★점 찍기 단추·칸이 챗 조합에 생겼다 — showDots/showDotOpts 기본값이 false 가 아니다(위와 같은 까닭)');
  /* ㉢ ★음성대조 — 기본 호출(끄는 인자 없음)에서는 그 숨김이 «한 글자도» 안 찍힌다.
     ⛔이게 없으면 위 ㉡ 가 「언제나 숨는다」(= 텍스트·모달·그리드를 망가뜨린 상태)와 구분되지 않는다. */
  const D = buildSection('buildTypographySectionHtml', { p: 'txt', size: 32 });
  assert.equal(/style="display:none">Font</.test(D), false, '기본 호출에서 Font 가 숨었다 — 세 패널이 망가진다');
  assert.equal(/id="txt-font-picker" style="display:none"/.test(D), false, '기본 호출에서 Font 피커가 숨었다');
  assert.match(D, /id="txt-font-weight" style="flex:1">/, '기본 호출의 굵기 select 가 예전과 달라졌다');
  assert.match(D, /<div class="prop-lhls-col">\s*\n\s*<span class="prop-field-label">Line Height<\/span>/,
    '기본 호출의 줄간격 열이 예전과 달라졌다');
  assert.equal(/underline-btn/.test(D), false,
    '★기본 호출에 밑줄(U) 단추가 찍혔다 — 이전과 «바이트 동일»이 깨진다(모달·그리드·챗 세 패널)');
  /* ★★양성대조 — 켜면 ★실제로 나온다. ⛔이게 없으면 위 두 「없다」가 «언제나 없다»(= 기능이 통째로
     죽은 상태)와 ★구분되지 않는다. 그리고 ★id 접두사를 타는지도 같이 본다(txt- 하드코딩 방지). */
  const U = buildSection('buildTypographySectionHtml', { p: 'mdl-typo', size: 32, showUnderline: true, isUnderline: true });
  assert.match(U, /<button class="prop-style-btn active" id="mdl-typo-underline-btn"/,
    `★showUnderline:true 인데 밑줄 단추가 «안» 나왔다(또는 active 가 안 붙었다) — 위 음성대조가 공짜로 참이 된다:\n${(U.match(/<button[^>]*>/g) || []).join('\n')}`);
  const U0 = buildSection('buildTypographySectionHtml', { p: 'mdl-typo', size: 32, showUnderline: true, isUnderline: false });
  assert.match(U0, /<button class="prop-style-btn " id="mdl-typo-underline-btn"/,
    '★isUnderline:false 인데 active 가 붙었다 — 단추 표시가 «늘 켜짐»이면 다음 클릭이 거꾸로 간다');
  assert.equal(/dot-btn/.test(D), false,
    '★기본 호출에 점 찍기 단추가 찍혔다 — 이전과 «바이트 동일»이 깨진다(모달·그리드·챗 세 패널)');
  assert.equal(/dot-size-row/.test(D), false, '★기본 호출에 점 손잡이 칸이 찍혔다');
  /* ★★양성대조 — 켜면 ★나온다 ＋ ★네 수가 ★제 칸으로 간다(칸이 뒤바뀌면 여기서 빨개진다). */
  const DT = buildSection('buildTypographySectionHtml', {
    p: 'mdl-typo', size: 32, showDots: true, showDotOpts: true, isDot: true,
    dotSize: 7, dotGap: 3, dotX: -2, dotY: 5,
  });
  assert.match(DT, /<button class="prop-style-btn active" id="mdl-typo-dot-btn"/,
    `★showDots:true 인데 점 단추가 «안» 나왔다 — 위 음성대조가 공짜로 참이 된다:\n${(DT.match(/<button[^>]*>/g) || []).join('\n')}`);
  for (const [id, val] of [['dot-size-num', 7], ['dot-gap-num', 3], ['dot-x', -2], ['dot-y', 5]]) {
    assert.match(DT, new RegExp(`id="mdl-typo-${id}"[^>]*value="${val}"`),
      `★«${id}» 칸에 ${val} 가 안 들어갔다 — 네 수가 서로 다른 칸으로 가고 있나:\n${(DT.match(/<input[^>]*dot[^>]*>/g) || []).join('\n')}`);
  }
  assert.match(DT, /id="mdl-typo-dot-size-row" style="display:flex"/, '★isDot:true 인데 손잡이 칸이 닫혀 있다');
  const DT0 = buildSection('buildTypographySectionHtml', { p: 'mdl-typo', size: 32, showDots: true, showDotOpts: true, isDot: false });
  assert.match(DT0, /id="mdl-typo-dot-size-row" style="display:none"/,
    '★isDot:false 인데 손잡이 칸이 열려 있다 — 「정할 것이 없는데 칸이 있다」가 된다');
});

test('T2-c ★챗 패널 범위가 ★모델 경계 표에서 «파생»한다 — 패널이 모델보다 좁으면 빨강', () => {
  /* ★⒝ 의 본 결함: 패널 min/max 가 모델과 «두 벌»이라 조용히 갈렸다(fontSize 10~60 vs 4~400 등 일곱 자리).
     ⇒ 명부를 chat-block.js 한 자리로 모았다. 이 검사는 「패널이 그 표를 «읽어» 쓰나」를 본다.
     ⛔숫자 리터럴로 재지 마라 — 그러면 이 검사가 ★둘째 명부가 된다. */
  /* ★출처는 «의존 0» 인 chat-bounds.js 다 — ⛔chat-block.js 에서 끌면 number-field-contract 하네스의
     모듈 그래프가 통째로 커져 __ready 가 안 켜진다(실측 14/14 타임아웃 · 까닭은 chat-bounds.js 머리말). */
  assert.match(SRC.chat, /import\s*\{[^}]*\bCHAT_NUM_BOUNDS\b[^}]*\}\s*from\s*['"][^'"]*chat-bounds\.js['"]/,
    'prop-chat.js 가 chat-bounds.js 에서 CHAT_NUM_BOUNDS 를 import 하지 않는다 — 경계가 다시 두 벌이 됐나');
  assert.doesNotMatch(SRC.chat, /from\s*['"][^'"]*blocks\/chat-block\.js['"]/,
    '⛔prop-chat.js 가 chat-block.js 를 import 한다 — 그 한 간선이 number-field-contract 하네스를 통째로 죽인다');
  const bounds = stripComments(readSrc(ROOT, 'js/blocks/chat-bounds.js'));
  assert.match(bounds, /export const CHAT_NUM_BOUNDS = Object\.freeze\(/,
    'chat-bounds.js 에 CHAT_NUM_BOUNDS 가 없다 — 이 검사의 겨냥이 빗나갔다(양성대조)');
  /* ★그 파일이 «의존 0» 임을 잠근다 — import 가 하나라도 생기면 위 함정이 되돌아온다. */
  assert.equal((bounds.match(/^\s*import\s/gm) || []).length, 0,
    '⛔chat-bounds.js 에 import 가 생겼다 — 「표만 들고 의존 0」이 이 파일의 존재 이유다');
  const chatBlk = stripComments(readSrc(ROOT, 'js/blocks/chat-block.js'));
  assert.match(chatBlk, /import\s*\{[^}]*\bCHAT_NUM_BOUNDS\b[^}]*\}\s*from\s*['"]\.\/chat-bounds\.js['"]/,
    'chat-block.js 가 표를 되적었나 — 모델도 같은 표에서 파생해야 한다');
  /* ★패널 마크업에 «맨 숫자» min/max 가 남아 있지 않다 — 하나라도 남으면 그 칸이 다시 갈린다.
     ⛔'chb-' 가 붙은 input 줄만 본다(공용 절·색 피커는 이 파일 밖에서 온다). */
  const bare = (SRC.chat.match(/<input[^>]*id="chb-[^"]*"[^>]*>/g) || [])
    .filter(t => /\b(?:min|max)="-?\d+"/.test(t));
  assert.deepEqual(bare, [],
    `챗 패널에 «맨 숫자» min/max 가 남았다 — 경계는 CHAT_NUM_BOUNDS 에서만 온다:\n${bare.join('\n')}`);
});

test('T2-b ★절의 «알맹이»가 _typo-section.js 밖에 리터럴로 없다', () => {
  /* 지문 = 그 절에만 있는 id 조각들. 호출부에 이게 «글자로» 있으면 마크업이 되돌아온 것이다.
     ⛔`id="txt-font-picker"` 처럼 접두사 박힌 형태로 재면 모달 쪽 복붙을 못 잡는다 —
       그래서 «접두사 없는 꼬리»로 잰다. */
  const TAILS = ['-font-trigger"', '-font-dropdown"', '-style-group"', '-lh-number"', '-ls-col"', '-color-chips"'];
  assert.ok(TAILS.length >= 5, '지문이 너무 적다 — 이 검사가 헐거워진다');
  for (const [name, get] of TYPO_PANELS) {
    const src = get();
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
