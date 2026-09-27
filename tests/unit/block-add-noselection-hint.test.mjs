/* block-add-noselection-hint — «섹션을 안 고른 채 블럭을 추가하면 무슨 일이 일어나는가».
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 있나 (2026-09-21, 현빈 지시분 마무리 라운드 — 「툴바 도형 추가가 경고 없이 아무 일도
 *   안 한다」)
 *   실앱 실측(9516, 40% 줌)에서 «도형 추가»는 실제로는 경고를 띄웠다(⚠️ 섹션 또는 블록을
 *   먼저 선택하세요). 대신 «전수»로 재 보니 한 벌이 아니었다:
 *     ⑴ addStickerBlock 3입구 — 다른 문장·흔들림 없음(showToast('섹션을 선택하세요'))
 *     ⑵ addGradientBlock — 경고가 «아예» 없고 조용히 «마지막 섹션»에 넣었다(실측 delta=1)
 *   ★2026-09-21 현빈 결정: ⑵도 «한 벌»로 맞춘다 — 마지막-섹션 폴백을 걷어내고 다른 40곳처럼
 *     경고만 띄우고 아무것도 안 만든다. 그래서 이 파일엔 더 이상 «예외 입구»가 없다(T3 참고).
 *   이 파일은 그 «한 벌»을 못박는다. 입구 목록을 사람이 관리하지 않는다 —
 *   index.html 의 #floating-panel 에서 onclick 을 긁어 «지금 있는 입구 전부»를 센다.
 *   입구를 새로 달면 자동으로 이 검사 대상이 된다.
 *
 * ⚠️이 검사는 «소스 문자열»을 본다. 정상적인 리팩터링에도 빨강이 날 수 있다 — 그때는 지우지
 *   말고 「섹션 미선택 경고가 여전히 한 벌인가」를 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

const INDEX = readSrc(REPO, 'index.html');

/* ── 입구 긁기 — #floating-panel 안의 onclick="...add*Block(...)" ───────────── */
const FP = (() => {
  const s = INDEX.indexOf('<div id="floating-panel">');
  assert.ok(s > 0, '#floating-panel 을 index.html 에서 못 찾았다');
  const e = INDEX.indexOf('<!-- Plugin Panel', s);
  assert.ok(e > s, '#floating-panel 끝을 못 찾았다');
  /* ★HTML 주석으로 «가려 둔» 입구(Info Card·Inner Card — 현빈 2026-09-07 숨김)는 입구가
     아니다. 안 지우면 그 두 개까지 세서 T0 이 「정의를 못 찾았다」로 엉뚱하게 빨강이 된다. */
  return INDEX.slice(s, e).replace(/<!--[\s\S]*?-->/g, '');
})();

/** 툴바에서 «블럭을 만드는» 입구 이름들(모드 토글은 제외 — 그건 블럭을 안 만든다). */
const ENTRY_NAMES = [...new Set(
  [...FP.matchAll(/onclick="[^"]*?\b(add[A-Za-z0-9]*Block)\s*\(/g)].map(m => m[1])
)].filter(n => n !== 'addSection');

/* 입구 함수가 «어느 파일»에 정의돼 있는지 — 레포 전체를 훑지 않고 후보 파일만 읽는다. */
const SRC_FILES = [
  'js/block-factory.js',
  'js/blocks/iconify-block.js',
  'js/blocks/sticker-block.js',
  'js/blocks/gradient-block.js',
  'js/blocks/zoom-block.js',
  'js/blocks/canvas-block.js',
  'js/blocks/step-block.js',
  'js/blocks/chat-block.js',
  'js/blocks/grid-block.js',
  'js/blocks/modal-block.js',
  'js/blocks/banner02-block.js',
  'js/blocks/comparison-block.js',
  'js/blocks/laurel-block.js',
].map(p => ({ p, src: readSrc(REPO, p) }));

/** 함수 «구역»을 잘라낸다 — 정의 줄부터 «다음 최상위 선언» 직전까지.
 *  ⛔중괄호 균형으로 자르지 마라 — 이 파일들은 한글 주석·템플릿 리터럴에 짝 안 맞는
 *    중괄호가 흔해서 본문이 첫 주석에서 잘린다(실측: 19개 입구가 전부 「경고 없음」으로
 *    잘못 잡혔다). 최상위 `function`/`window.`/`export` 로 끊는 편이 이 레포에서 정확하다. */
function bodyOf(name) {
  for (const { p, src } of SRC_FILES) {
    const m = new RegExp(`\\nfunction ${name}\\s*\\(`).exec(src);
    if (!m) continue;
    const from = m.index + 1;
    const rest = src.slice(from + 1);
    const nx = /\n(?:function |window\.|export |const |\/\* ─)/.exec(rest);
    return { file: p, body: rest.slice(0, nx ? nx.index : rest.length) };
  }
  return null;
}

/* ★예외 입구는 «없다». 2026-09-21 현빈 결정으로 addGradientBlock 의 마지막-섹션 폴백을
   걷어내면서 비었다. 새 예외를 넣으려면 «이름»만 적지 말고 이유를 같이 적어라 —
   그리고 예외라도 «조용하면» 안 된다. */
const DOCUMENTED_FALLBACK = new Set([]);

test('T0 — 툴바 블럭 추가 입구를 index.html 에서 긁었다(전수 근거)', () => {
  assert.ok(ENTRY_NAMES.length >= 15, `입구가 너무 적게 잡혔다: ${ENTRY_NAMES.length}개 — 긁는 정규식을 의심하라`);
  for (const n of ENTRY_NAMES) assert.ok(bodyOf(n), `${n} 정의를 후보 파일에서 못 찾았다 — SRC_FILES 에 추가하라`);
});

test('T1 — 섹션 미선택 경고는 «한 벌»이다(showNoSelectionHint)', () => {
  const offenders = [];
  for (const n of ENTRY_NAMES) {
    if (DOCUMENTED_FALLBACK.has(n)) continue;
    const { file, body } = bodyOf(n);
    if (!/showNoSelectionHint/.test(body)) offenders.push(`${n} (${file})`);
  }
  assert.deepEqual(offenders, [], `이 입구들이 다른 경고를 쓰거나 아무 말도 안 한다: ${offenders.join(', ')}`);
});

test('T2 — 옛 문구 showToast(\'섹션을 선택하세요\') 는 입구에 남아 있지 않다', () => {
  const offenders = [];
  for (const n of ENTRY_NAMES) {
    const { file, body } = bodyOf(n);
    if (/showToast\?\.\(\s*['"]섹션을 선택하세요/.test(body)) offenders.push(`${n} (${file})`);
  }
  assert.deepEqual(offenders, [], `문구가 갈라진 입구: ${offenders.join(', ')}`);
});

test('T3 — 어떤 입구도 «마지막 섹션» 폴백을 쓰지 않는다(전수)', () => {
  /* ★음성대조: js/blocks/gradient-block.js 의 폴백을 되살리면 여기서 빨강이 난다.
     T1 로는 안 잡힌다 — 옛 판도 «섹션이 0개일 때»는 showNoSelectionHint 를 불렀기 때문에
     T1 은 초록이었다. 「경고를 하느냐」와 「몰래 만들어 버리느냐」는 다른 축이다. */
  const LAST_SECTION_FALLBACK = [
    /querySelectorAll\(\s*['"]\.section-block['"]\s*\)\s*\]\s*\.pop\(\)/,  // [...qsa('.section-block')].pop()
    /마지막 섹션에 추가/,                                                        // 그 폴백을 알리는 문장
  ];
  const offenders = [];
  for (const n of ENTRY_NAMES) {
    const { file, body } = bodyOf(n);
    for (const re of LAST_SECTION_FALLBACK) {
      if (re.test(body)) { offenders.push(`${n} (${file}) ← ${re}`); break; }
    }
  }
  assert.deepEqual(offenders, [],
    `섹션을 안 골랐는데 «마지막 섹션»에 몰래 넣는 입구: ${offenders.join(', ')}`);

  /* 예외 목록에 이름이 남아 있으면 그 입구는 «조용하지 않은지»까지 본다(예외가 생겼을 때 대비). */
  for (const n of DOCUMENTED_FALLBACK) {
    const { file, body } = bodyOf(n);
    assert.match(body, /showToast/, `${n}(${file}) 이 폴백으로 넣으면서 아무 말도 안 한다`);
    assert.match(body, /마지막 섹션/, `${n}(${file}) 의 알림에 «어디에 넣었는지»가 없다`);
  }
});

test('T4 — showNoSelectionHint 는 #floating-panel 이 없어도 토스트를 띄운다(침묵 실패 금지)', () => {
  const src = readSrc(REPO, 'js/drag-utils.js');
  const m = /function showNoSelectionHint\(\)\s*\{([\s\S]*?)\n\}/.exec(src);
  assert.ok(m, 'showNoSelectionHint 정의를 못 찾았다');
  const body = m[1];

  /* ★«가드된 안»은 빼고 본다 — if (fp) { … } 블록을 통째로 지운 뒤에도 fp 를 만지는
     자리가 남아 있으면, 그건 fp 가 null 일 때 던져서 토스트까지 «못 가는» 자리다. */
  let stripped = body;
  const g = stripped.indexOf('if (fp) {');
  if (g >= 0) {
    let depth = 0, end = -1;
    for (let i = stripped.indexOf('{', g); i < stripped.length; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    assert.ok(end > 0, 'if (fp) 블록의 끝을 못 찾았다');
    stripped = stripped.slice(0, g) + stripped.slice(end);
  }
  const bare = stripped.split('\n').filter(l => /\bfp\.[A-Za-z]/.test(l) && !/\bfp\?\./.test(l));
  assert.deepEqual(bare.map(l => l.trim()), [],
    `가드 밖에서 fp 를 역참조한다 — fp 가 없으면 여기서 던져 경고가 통째로 사라진다`);

  assert.match(body, /if \(fp\)|fp\?\./, 'fp 없음에 대한 가드가 없다');
  assert.match(body, /showToast\(/, 'showToast 호출이 없다');
});
