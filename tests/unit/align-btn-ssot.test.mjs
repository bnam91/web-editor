/* U-ALIGNSSOT — 정렬 버튼이 «한 곳»에서 나오는가. (2026-09-08)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는데
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다. 1662개가 안 돈 걸
 *     「하나 깨짐」으로 오독한다. 원인이 안 보이면 `--test-reporter=spec` 을 붙여라.
 *   ⚠️★이 검사를 «자동으로» 부르는 것은 아무것도 없다 — CI 도, 저장 훅도 안 부른다.
 *     dev 의 `npm test`(ad4c938)가 위 글롭을 그대로 쓰므로 이 파일도 «그 목록에는» 자동으로
 *     든다. 하지만 그 `npm test` 를 부르는 것이 없다 — 결국 «사람이» 쳐야 돈다.
 *     ⛔손으로 당기는 그물이라는 뜻이다. 안 치면 이 파일은 «없는 것»과 같다.
 *
 * ★왜 이 파일이 있나
 *   정렬 버튼이 레포에 146개 있고, 전부 innerHTML 템플릿 리터럴 «안»의 복붙이다.
 *   `js/props/_helpers.js` 의 `alignBtn`/`ALIGN_ICONS` 로 옮기는 중인데, 이관은
 *   「한 파일에서 몇 개만 옮기고 나머지를 리터럴로 남기는」 형태로 «반쯤» 끝나기 쉽다.
 *   그 반쯤을 초록으로 보내지 않는 것이 이 파일의 유일한 일이다.
 *
 * ★「이관된 파일」 목록을 사람이 관리하지 않는다
 *   MIGRATED = js/**\/*.js 중 `_helpers.js` 에서 `alignBtn` 을 import 한 파일.
 *   헬퍼를 import 한 «순간» 자동으로 검사 대상이 된다. 그래서 한 파일에서 버튼 1개만
 *   옮기고 5개를 리터럴로 두면, 그 파일이 스스로 MIGRATED 에 들어와 T1 에 걸린다.
 *
 * ⚠️이 파일은 «동작»과 «소스 문자열»을 둘 다 단언한다. 정상적인 리팩터링에도 빨강이 날 수
 *   있다 — 그때는 지우지 말고 「정렬 버튼이 여전히 한 곳에서 오는가」를 확인한 뒤 패턴을 고쳐라.
 *   선례: grid-callsite-ssot.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const HELPERS = 'js/props/_helpers.js';

/* ★이관 진행도 래칫 — 이관 커밋과 «같은 커밋»에서 올린다. 안 올리면 빨강이 뜬다.
 *   ⛔하한(≥)이 아니라 «등호»다. 하한은 까먹어도 초록이고, 등호는 까먹으면 빨강이다.
 *     그게 의도다 — 이 숫자를 고치는 손이 「내가 몇 개를 옮겼는지」를 한 번은 세게 만든다. */
const RATCHET = { calls: 10, files: 2 };   // ← B단계(Z계열 10개: image-handling 6 + prop-step 4) 직후 값

/* ── 소스 수집 ───────────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* ★주석 걷어내기는 «공용 부품»을 쓴다 — tests/unit/_strip-comments.js
 *   ⛔여기서 자기 벌을 만들면 안 된다(strip-comments-shared.test.js 의 S-6 가 막는다).
 *   ★이 파일은 처음에 자기 벌을 만들었었다 — 선례(grid-callsite-ssot)의 정규식이
 *     코드 안의 accept="image/[별]" 를 «블록주석 시작»으로 읽어 «그 다음 닫는 자리»까지 삼켰기 때문이다
 *     (여기에 그 두 글자를 «그대로» 못 쓴다 — 쓰면 이 주석이 거기서 닫힌다. 실제로 한 번 물렸다)
 *     (실측: 정렬 버튼 146 → 121, prop-frame 9·prop-section 3·prop-table 3 이 «없는 것»이 됐다).
 *   ⇒ 지디가 그 결함을 공용 부품에서 고쳤고 S-6 로 «자기 벌 금지»를 세웠다. 그래서 이제 공용을 쓴다.
 *     그리고 그게 맞다 — 벌이 여럿이면 «어느 벌로 쟀는지»에 따라 답이 갈린다. */
const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');

const FILES = walk(path.join(REPO, 'js')).map(p => path.relative(REPO, p).split(path.sep).join('/'));
const SRC = new Map(FILES.map(f => [f, stripComments(fs.readFileSync(path.join(REPO, f), 'utf8'))]));

/* ★MIGRATED 판정 — 「_helpers.js 에서 alignBtn 을 import 했는가」 하나뿐이다.
 *   이 정규식이 부서지면 MIGRATED 가 조용히 비고 T1·T2 가 «아무것도 안 보고» 초록이 된다.
 *   그래서 T0-c 가 크기를 «등호»로 못박는다. */
const IMPORT_ALIGNBTN = /import\s*\{[^}]*\balignBtn\b[^}]*\}\s*from\s*['"][^'"]*_helpers\.js['"]/;
const MIGRATED = new Set(FILES.filter(f => f !== HELPERS && IMPORT_ALIGNBTN.test(SRC.get(f))));

const LITERAL_BTN = /<button[^>]*class="[^"]*align-btn/g;
const CALL = /\balignBtn\s*\(/g;
const count = (s, re) => (s.match(re) || []).length;

const literalButtons = FILES.reduce((n, f) => n + count(SRC.get(f), LITERAL_BTN), 0);
const callCount = FILES.reduce((n, f) => n + (f === HELPERS ? 0 : count(SRC.get(f), CALL)), 0);

/* ── 헬퍼를 «실제로» 불러온다 (T3·T4·T1·T2 가 사전을 봐야 한다) ─────────────
 *   _helpers.js 는 확장자가 .js 인데 package.json 에 type:module 이 없어서 Node 는 CJS 로 읽는다.
 *   선례 grid-picker.test.mjs 와 같은 방식으로 .mjs 별칭에 복사해서 import 한다. */
const aliasPath = path.join(os.tmpdir(), `align-btn-ssot-alias-${process.pid}.mjs`);
fs.writeFileSync(aliasPath, fs.readFileSync(path.join(REPO, HELPERS), 'utf8'));
const { alignBtn, ALIGN_ICONS } = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

/* 사전의 «지문» — 그림 전체 + 그 안의 <line>·<path d="…"> 조각.
 * 조각까지 보는 이유: 아이콘을 통째로가 아니라 «반만» 호출부로 되돌려도 잡으려는 것이다. */
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const ICON_FINGERPRINTS = [];
for (const [family, keys] of Object.entries(ALIGN_ICONS)) {
  for (const [key, icon] of Object.entries(keys)) {
    ICON_FINGERPRINTS.push({ family, key, frag: norm(icon) });
    for (const m of icon.matchAll(/<line[^>]*\/>|<path[^>]*d="[^"]*"[^>]*\/>/g)) {
      ICON_FINGERPRINTS.push({ family, key, frag: norm(m[0]) });
    }
  }
}

/* ══ T0 — 「입력이 살아 있다」. 셋 다 세운다. ══════════════════════════════ */

test('T0-a ★정렬 버튼 총량이 «146 아래로 안 내려간다» (리터럴 + 호출)', () => {
  const sum = literalButtons + callCount;
  assert.ok(sum >= 146,
    `리터럴 ${literalButtons} + 호출 ${callCount} = ${sum} — 146 미만이다. ` +
    `이관은 1:1 치환이라 «합이 불변»이어야 한다. 줄었다면 (a) 버튼이 증발했거나 ` +
    `(b) 이 파일의 탐지 패턴이 못 따라간 것이다. 둘 다 조용히 넘어가면 안 되는 일이다.`);
});

test('T0-b ★alignBtn 호출 수가 래칫과 «정확히» 같다', () => {
  assert.equal(callCount, RATCHET.calls,
    `alignBtn( 호출이 ${callCount}개인데 RATCHET.calls 는 ${RATCHET.calls}다. ` +
    `버튼을 옮겼으면 «같은 커밋에서» 래칫을 올려라. 옮긴 걸 되돌렸다면 래칫을 내려라.`);
});

test('T0-c ★MIGRATED 파일 수가 래칫과 «정확히» 같다 (import 탐지가 살아 있다)', () => {
  assert.equal(MIGRATED.size, RATCHET.files,
    `MIGRATED = ${[...MIGRATED].join(', ') || '(비었다)'} — ${MIGRATED.size}개인데 ` +
    `RATCHET.files 는 ${RATCHET.files}다. ★비어 있다면 IMPORT_ALIGNBTN 정규식이 부서진 것이고, ` +
    `그 상태로는 T1·T2 가 아무 파일도 안 보면서 초록을 낸다 — 이 단언이 그걸 막는다.`);
});

/* ══ T1 — 이관된 파일에 리터럴 정렬 버튼이 남아 있지 않다 ═════════════════ */

test('T1 ★MIGRATED 파일에 «리터럴 정렬 버튼»이 0건이다', () => {
  assert.ok(MIGRATED.size > 0, 'MIGRATED 가 비었다 — T0-c 를 먼저 봐라');
  for (const f of MIGRATED) {
    const src = SRC.get(f);
    /* ⚠️`.prop-align-btn` 은 «정렬 전용 클래스가 아니다» — 모양 피커·테두리 스타일·회전·
     *   세그먼트 컨트롤(세로/가로, 기본/카드/원형/번호)도 같은 클래스를 쓴다(실측:
     *   prop-annotation.js, prop-simple-card.js, prop-step.js). 그래서 「align-btn 리터럴 0건」을
     *   글자 그대로 재면 정렬과 무관한 버튼까지 결함으로 세는 오탐이 난다.
     *   ★판정은 «내용물»로 한다: 그 버튼이 ALIGN_ICONS 의 그림을 담고 있으면 정렬 버튼이다.
     *     사전이 판정 기준이라 사람이 예외 목록을 관리할 일이 없고, 사전이 늘면 그물도 같이 넓어진다. */
    for (const m of src.matchAll(/<button[^>]*class="[^"]*align-btn[^"]*"[^>]*>([\s\S]*?)<\/button>/g)) {
      const inner = norm(m[1]);
      const hit = ICON_FINGERPRINTS.find(fp => inner.includes(fp.frag));
      assert.equal(hit, undefined,
        `${f} 에 리터럴 정렬 버튼이 남아 있다 (${hit?.family}/${hit?.key}):\n  ${norm(m[0]).slice(0, 200)}\n` +
        `→ alignBtn('${hit?.family}', '${hit?.key}', { label: '…' }) 로 부르라.`);
    }
  }
});

test('T1-b ★`active` 앞 공백은 «정확히 한 칸» (prop-align-btnactive 방지)', () => {
  // (1) 소스 — align-btn 바로 뒤에 붙는 템플릿 구멍이 내는 문자열은 공백으로 시작해야 한다.
  for (const f of FILES) {
    for (const m of SRC.get(f).matchAll(/align-btn\$\{([^}]*)\}/g)) {
      for (const lit of m[1].matchAll(/'([^']*)'|"([^"]*)"/g)) {
        const v = lit[1] ?? lit[2];
        if (!v.includes('active')) continue;
        assert.match(v, /^ active$/,
          `${f}: class="…align-btn\${…'${v}'…}" — align-btn 에 «붙어서» 나온다. ` +
          `'prop-align-btnactive' 라는 존재하지 않는 클래스가 되고 CSS 는 조용히 안 걸린다.`);
      }
    }
  }
  // (2) 동작 — 헬퍼가 내는 실물도 같은 규칙이다.
  const on = alignBtn('arrow-h', 'left', { label: 'L', active: true });
  assert.match(on, /class="prop-align-btn active"/, `active:true 출력이 이상하다: ${on}`);
  assert.doesNotMatch(on, /align-btnactive/, `공백이 죽었다: ${on}`);
  const off = alignBtn('arrow-h', 'left', { label: 'L', active: false });
  assert.match(off, /class="prop-align-btn"/, `active:false 인데 클래스가 이상하다: ${off}`);
});

/* ══ T2 — 정렬 그림이 사전 «밖»에 없다 ════════════════════════════════════ */

test('T2 ★MIGRATED 파일에 정렬 아이콘(SVG 조각·문자)이 «사전 밖»에 없다', () => {
  assert.ok(ICON_FINGERPRINTS.length > 0, 'ALIGN_ICONS 지문이 0개다 — 사전을 못 읽었다');
  for (const f of MIGRATED) {
    const src = norm(SRC.get(f));
    for (const fp of ICON_FINGERPRINTS) {
      assert.equal(src.includes(fp.frag), false,
        `${f} 에 ${fp.family}/${fp.key} 그림이 리터럴로 있다: ${fp.frag.slice(0, 120)}\n` +
        `→ 그림은 ALIGN_ICONS «한 곳»에만 산다. 호출부는 alignBtn(family, key, …) 로만 고른다.`);
    }
  }
});

/* ══ T3 — 헬퍼의 계약: aria-label 을 «내고», label 없이는 «죽는다» ════════ */

test('T3 ★alignBtn 은 aria-label 을 낸다 (소스 + 동작)', () => {
  const helperSrc = SRC.get(HELPERS);
  assert.match(helperSrc, /aria-label="\$\{label\}"/,
    '_helpers.js 의 alignBtn 이 aria-label 을 안 낸다 — 이 작업이 만들려던 값 그 자체다');

  const out = alignBtn('arrow-h', 'left', { label: '왼쪽' });
  assert.match(out, /aria-label="왼쪽"/, `aria-label 이 없다: ${out}`);
  assert.match(out, /^<button /, `버튼 문자열이 아니다: ${out}`);
  assert.ok(out.includes('←'), `arrow-h/left 는 «문자» ← 다. SVG 로 바뀌었나: ${out}`);
});

test('T3-b ★label 없이 부르면 throw 한다 (옵셔널로 만들면 값이 0 이 된다)', () => {
  assert.throws(() => alignBtn('arrow-h', 'left', {}), /label/,
    'label 없이도 통과한다 — 급한 호출부가 빠뜨리면 스크린리더가 다시 「왼쪽 화살표」를 읽는다');
  assert.throws(() => alignBtn('arrow-h', 'left'), /label/, '인자 자체가 없어도 throw 해야 한다');
  assert.throws(() => alignBtn('없는계열', 'left', { label: 'x' }), /계열/, '모르는 계열은 throw');
  assert.throws(() => alignBtn('arrow-h', '없는키', { label: 'x' }), /그림/, '모르는 키는 throw');
});

test('T3-c ★attrs 는 «해석되지 않고» 그대로 나간다 — data-align 자동생성 금지', () => {
  /* prop-text-wireup-align.js 가 .prop-align-btn 을 전부 잡아 dataset.align «유무»로만 거른다.
   * key 가 'left' 라는 이유로 헬퍼가 data-align 을 붙이면, 정렬이 아닌 버튼(모양·회전 피커)이
   * 조용히 정렬 버튼으로 «둔갑»한다 — 그것도 전 호출부에서 동시에. */
  const bare = alignBtn('arrow-h', 'left', { label: 'L' });
  assert.doesNotMatch(bare, /data-align/,
    `attrs 를 안 줬는데 data-align 이 나왔다 — 자동생성은 금지다: ${bare}`);
  const withAttrs = alignBtn('arrow-h', 'stack', { label: 'S', attrs: { 'data-align': 'stack' }, style: 'flex:1' });
  assert.match(withAttrs, /data-align="stack"/, `attrs 가 안 나갔다: ${withAttrs}`);
  assert.match(withAttrs, /style="flex:1"/,
    `style 이 죽었다 — prop-step.js 4곳이 이걸로 폭을 잡는다. 빠지면 버튼 폭이 눈에 띄게 바뀐다: ${withAttrs}`);
  // ⛔이스케이프는 호출부 책임이다(prop-banner02.js:167 이 이미 &quot; 로 바꿔 넘긴다).
  //   여기서 또 하면 &amp;quot; 가 화면에 보인다 — 현행 동작 보존.
  const t = alignBtn('arrow-h', 'left', { label: 'L', title: 'a&quot;b' });
  assert.match(t, /title="a&quot;b"/, `title 을 또 이스케이프했다: ${t}`);
});

/* ══ T4 — 계열이 «서로 다른 그림»을 갖는다 ════════════════════════════════ */

test('T4 ★text 와 object-h 는 같은 「left」라도 «다른 그림»이다', () => {
  assert.ok(ALIGN_ICONS.text, 'ALIGN_ICONS.text 가 없다');
  assert.ok(ALIGN_ICONS['object-h'], "ALIGN_ICONS['object-h'] 가 없다");
  assert.notEqual(ALIGN_ICONS.text.left, ALIGN_ICONS['object-h'].left,
    '텍스트 정렬(줄 4개)과 오브젝트 정렬(가이드선+상자)의 그림이 같아졌다. ' +
    '「아이콘을 통일하자」는 선의의 리팩터가 «뜻이 다른 버튼 둘»을 겹쳐놓은 것이다 — 되돌려라.');
  // 축이 다른 계열은 키 자체가 다르다(가로=left/center/right, 세로=top/middle/bottom).
  assert.deepEqual(Object.keys(ALIGN_ICONS['object-v']), ['top', 'middle', 'bottom']);
  assert.equal(ALIGN_ICONS['arrow-h'].stack, '☰',
    'arrow-h.stack 은 prop-step.js 의 4번째 버튼이 쓰는 그림이다 — 사라지면 그 버튼이 죽는다');
});
