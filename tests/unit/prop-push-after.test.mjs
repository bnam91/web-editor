/* ══════════════════════════════════════════════════════════════════════════
   prop-push-after — 「속성 패널은 «바꾼 뒤» 찍는다」를 잠근다
   ──────────────────────────────────────────────────────────────────────────
   무슨 일이 있었나 (2026-09-21 실앱 실측, 커밋 fd8f85d):
     속성 핸들러 셋이 «찍고 나서» 바꾸고 있었다(push-before) — 실앱에서 재서 셋 다 결함 확인:
       js/props/prop-mockup.js  — 폭 숫자칸      js/props/prop-iconify.js — 크기 숫자칸
       js/props/prop-asset.js   — 정렬 단추
     ⛔★처음엔 「레포에 딱 셋」이라 적었는데 «틀렸다». 그 수는 `pushHistory?.();` 처럼
       «인자 없는» 꼴만 찾는 좁은 정규식에서 나왔다. 라벨을 넘기는 꼴(`pushHistory?.('…');`)을
       같이 세니 js/props 안에만 **15쌍 · 33자리**가 더 있다(아래 명부).
       ⇒ 그 33자리는 **결함이 아니라 «미측정»**이다. 실앱에서 안 쟀다.
     ⛔그리고 «push-before 자체»는 병이 아니다 — 삽입류(block-factory 109자리)는 그게 규약이다.
       병은 «속성 패널에서» 그 꼴이 쓰일 때다. 그래서 이 검사는 js/props 만 본다.
     증상: 앞 편집이 push-after 였으면 이 pushHistory 가 «꼭대기와 같은 상태»를 찍어 버려지고,
       그 변경은 자기 칸을 못 가진 채 다음 칸에 얹힌다 ⇒ ⌘Z 한 번에 «두 편집»이 같이 사라진다.
     대조: 순서를 뒤집으면(B) 정상, 같은 속성만 두 번이면(C) 정상 — 그래서 오래 안 보였다.
     결정적 단서는 «항목이 아예 안 생겼다»였다(pos/len 이 0/1 그대로).

   ★고친 뒤 실측: 세 자리 모두 편집이 «자기 칸»을 갖는다(0/1 → 1/2), ⌘Z 한 번이 한 편집만 되돌린다.

   ⛔이 파일은 «소스 모양»만 잰다. 행동은 실앱에서 따로 쟀다 — 여기 초록을 «행동까지 봤다»로 읽지 마라.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ★[T-123 · 2026-09-22] 블록주석 여는 자리를 «구분자 뒤»로 좁힌다 — 안 좁히면 검사가 눈을 감는다.
   실측: HTML 속성값의 와일드카드(accept 의 image 뒤에 오는 슬래시+별표)가 «여는 괄호»로 읽혀
     그 뒤 «처음 만나는 닫는 괄호»까지 통째로 걷혔다.
     js/props/prop-frame.js  41,493자 중 27,470자  ⇒ 남은 코드 12,736자(약 70%가 안 보였다)
     js/props/prop-table.js  21,078자
     js/props/prop-mockup.js  2,110자 — 여기 숨어 있던 `_applyScreenImage` 는 KNOWN 명부에
       «적혀는 있는데 한 번도 안 잡히던» 자리였다(명부가 검사를 이기고 있었다).
   ⇒ 좁힌 뒤 PA-1 의 적중은 32 → 33(늘어난 하나가 그 `_applyScreenImage`, 이미 명부에 있음).
   ⛔이건 진짜 파서가 아니다. 그래서 PA-6 이 «다시 눈을 감았는지»를 수로 지킨다. */
const BLOCK_COMMENT_RE = /(^|[\s;{}(),=:])\/\*[\s\S]*?\*\//g;

/** js/ 아래 모든 .js 를 읽는다(주석은 걷는다 — 산문은 코드가 아니다). */
function sources() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) {
        const raw = fs.readFileSync(p, 'utf8');
        const code = raw.replace(BLOCK_COMMENT_RE, '$1').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        out.push({ rel: path.relative(ROOT, p), raw, code });
      }
    }
  })(path.join(ROOT, 'js', 'props'));
  return out;
}

/** `pushHistory(…)` 바로 «뒤»에 또 다른 호출이 오는 꼴 = push-before 의심. */
const PUSH_BEFORE = /pushHistory\?\.\([^)]*\)\s*;\s*([A-Za-z_$][\w$]*)\s*\(/g;
/** 뒤따라도 «기록이 아닌» 것들 — 이건 push-before 가 아니다. */
const BENIGN = new Set(['scheduleAutoSave', 'triggerAutoSave', 'showZoomProperties', 'showToast', 'console',
  /* ★제어문은 «호출»이 아니다 — 안 빼면 if(·for( 가 잡혀 이 검사가 노이즈로 죽는다 */
  'if', 'for', 'while', 'switch', 'catch', 'return', 'do',
  /* ★패널만 다시 그린다(캔버스 무변) — 97행에서 기록이 쓰기 «뒤»로 오며 이 둘이 기록 바로 뒤에 섰다 */
  'showAnnotationProperties', 'rebindMsgList']);

/* ★명부 = «지금 있는 것»(15쌍 · 33자리). 전부 ★미측정이다 — 결함으로 읽지 마라.
   한 줄이라도 «늘면» 빨강이다 — 새 핸들러가 조용히 이 꼴을 갖고 못 들어온다.
   ⛔재서 «괜찮다»가 나오면 이유를 그 줄에 적고, «결함»이면 고치고 줄을 지워라.
   ⛔여기 넣을 땐 «자리(파일:줄)»가 아니라 «이유»를 반드시 같이 적어라. 이름만 적으면
     같은 이름의 다른 자리가 면제 뒤로 숨는다(2026-09-21 T-131 에서 실제로 그랬다). */
const KNOWN_PUSH_BEFORE = {
  'js/props/_font-picker.js::onPick': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-annotation.js::_writeProps': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-chat.js::rerender': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-grid.js::_applyRatioInput': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-laurel.js::showLaurelProperties': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-mockup.js::_applyScreenImage': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-multisel.js::showFlowMultiSelPanel': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-multisel.js::showFreeLayoutMultiSelPanel': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-shape.js::showShapeProperties': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-simple-card.js::setTextBgTransparentUI': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
};

test('PA-1 ★속성 패널에 «새» push-before 가 안 생긴다 (js/props 전수 · 명부 밖만)', () => {
  const hits = [];
  for (const { rel, code } of sources()) {
    for (const m of code.matchAll(PUSH_BEFORE)) {
      const callee = m[1];
      if (BENIGN.has(callee)) continue;
      const line = code.slice(0, m.index).split('\n').length;
      const key = `${rel}::${callee}`;
      if (key in KNOWN_PUSH_BEFORE) continue;
      hits.push(`${rel} — pushHistory() → ${callee}() (걷은 소스 기준 ${line}번째 줄)`);
    }
  }
  assert.deepEqual(hits, [],
    '★«찍고 나서 바꾸는» 핸들러가 생겼다. 앞 편집이 push-after 면 이 변경은 자기 칸을 못 갖고 ' +
    '⌘Z 한 번에 «두 편집»이 같이 사라진다. 순서를 뒤집어라 — 적용 먼저, pushHistory 나중.');
});

test('PA-2 ★음성대조 — 이 검사가 «옛 모양»을 실제로 잡는가', () => {
  /* 화석을 안 베낀다 — 지금 소스에서 옛 모양으로 되돌린 변형본을 만든다. */
  /* ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음): 목업(C3)·iconify(C2) 둘 다 부품 배선이 돼 옛 모양 표본이 사라짐 → 표준 절 갈래 밖 prop-infocard.js 숫자 칸(applyNum → pushHistory)을 표본으로(탑 통합 · C2·C3 병합 충돌 풀이) */
  const f = sources().find(s => s.rel.endsWith('prop-infocard.js'));
  assert.ok(f, '★prop-infocard.js 를 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다');
  const mutated = f.code.replace(
    /applyNum\(parseInt\(nN\.value\)\);\s*window\.pushHistory\?\.\(\);/,
    'window.pushHistory?.(); applyNum(parseInt(nN.value));');
  assert.notEqual(mutated, f.code, '★변환이 늙었다 — 폭 숫자칸 배선을 못 찾았다');
  const found = [...mutated.matchAll(PUSH_BEFORE)].filter(m => !BENIGN.has(m[1]));
  assert.ok(found.length > 0,
    '★되돌린 변형본을 이 정규식이 «못 잡는다» — PA-1 의 초록은 «없어서»가 아니라 «못 봐서»다');
});

test('PA-3 세 자리가 «지금 모양»으로 남아 있다 (고침이 되돌려지면 빨강)', () => {
  const want = [
    ['prop-mockup.js',  /wireLayoutSection\(\{ commit: \(\) => window\.pushHistory\?\.\(\), w: \{ numberId: 'mkp-width-number'/],   // ★기대 바뀜(C3 · 슬라이더 걷음) — 폭 칸 = 부품(change: apply → commit)
    /* ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C2) — 크기 칸은 부품 배선: wireLayoutSection 의 change 가 «apply → commit» 순서를 한 자리에서 지킨다(js/props/_layout-section.js) ⇒ 여기선 그 부품에 applySize·pushHistory 를 넘기는지 잠근다 */
    ['prop-iconify.js', /wireLayoutSection\(\{\s*commit:\s*\(\)\s*=>\s*window\.pushHistory\?\.\(\)\s*,\s*w:\s*\{\s*numberId:\s*'icn-size-number'[^}]*apply:\s*applySize\s*\}/],
    ['prop-asset.js',   /applyAlign\(btn\.dataset\.align\);\s*window\.pushHistory\?\.\(\)/],
  ];
  const all = sources();
  for (const [file, re] of want) {
    const f = all.find(s => s.rel.endsWith(file));
    assert.ok(f, `★${file} 을 못 찾았다 — 검사가 안 돈 것이다`);
    assert.match(f.code, re,
      `★${file} 의 순서가 되돌아갔다(찍기 → 적용) — 그 편집이 자기 칸을 잃는다`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   PA-4/PA-5 — ★[T-123 · 2026-09-22] «색 피커 그라데이션 커밋»은 PA-1 의 사각지대다.
   ──────────────────────────────────────────────────────────────────────────
   PA-1 의 정규식은 `pushHistory(…); 이름(` 꼴 — 기록 «뒤에 호출이 오는» 모양만 본다.
   그라데이션 핸들러는 기록 뒤에 «대입»이 온다(`ab.style.background = css`) ⇒ 순서를 뒤집어도
   PA-1 이 초록이다. 실측(2026-09-22): js/props/prop-asset.js 의 onGradient 를 push-before 로
   뒤집고 `node --test tests/unit/prop-push-after.test.mjs` → **3 pass / 0 fail**(못 본다).
   ⇒ 그 자리들을 «자리마다» 잠근다(PA-3 과 같은 관용구 — 이름만으론 다른 자리가 숨는다).

   ★왜 이 자리가 중요한가 — 색 피커는 탭 한 번에 «두 번 칠하고 한 번 찍는다»:
     goya-cp:gradient(commit=false) = 칠하기만 / goya-cp:gradient-commit(commit=true) = 칠하고 «나서» 기록.
     기록이 칠하기보다 «먼저» 가면 그 편집이 자기 칸을 잃고, 앞 편집과 함께 ⌘Z 한 번에 사라진다
     (이 파일 머리말의 병 그대로). 행동 쪽은 tests/dom/insert-seam-undo.dom.spec.js M10 이 잰다.
   ⛔이 검사는 «소스 모양»만 잰다.
═══════════════════════════════════════════════════════════════════════════ */

/** `{` 부터 짝이 맞는 `}` 까지 — 핸들러 «몸통»만 떼어낸다(주석은 sources() 가 이미 걷었다). */
function bodyFrom(code, fromIdx) {
  const open = code.indexOf('{', fromIdx);
  if (open < 0) return null;
  let d = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') d++;
    else if (code[i] === '}') { d--; if (d === 0) return code.slice(open + 1, i); }
  }
  return null;
}
/** 「기록한다」 = pushHistory 또는 이 파일들의 commit() 헬퍼. */
const RECORD_RE = /window\.pushHistory|(?:^|[^.\w])commit\s*\(/;
/** 「칠한다」 = 대입이 하나라도 있었다(==·===·=>·<=·>=·!= 는 대입이 아니다). */
const ASSIGN_RE = /[^=!<>]=[^=]/;

/* ★명부 = 「칠하고 나서 찍는」 자리들. 자리마다 «무엇을 여는 말인지»를 같이 적는다. */
const GRAD_APPLY_THEN_RECORD = [
  ['js/props/prop-asset.js',      'onGradient:'],
  ['js/props/prop-banner02.js',   'onGradient:'],
  ['js/props/prop-comparison.js', 'onGradient:'],
  ['js/props/prop-frame.js',      'onGradient:'],
];
/* ★«기록만» 하는 자리 — 칠하기는 바로 앞의 goya-cp:gradient 리스너가 이미 했다
   (js/props/prop-shape.js 주석: 「기록은 여기서 하지 않는다 … commit 이 «또» 온다」).
   그래서 여기 몸통엔 칠하기가 «없어야» 한다 — 생기면 순서 문제가 도로 들어온다. */
const GRAD_RECORD_ONLY = [
  ['js/props/prop-shape.js', "addEventListener('goya-cp:gradient-commit'"],
];

test('PA-4 ★그라데이션 커밋 핸들러는 «칠하고 나서» 찍는다 (PA-1 이 못 보는 자리)', () => {
  const all = sources();
  for (const [file, anchor] of GRAD_APPLY_THEN_RECORD) {
    const f = all.find(s => s.rel === file);
    assert.ok(f, `★${file} 을 못 찾았다 — 검사가 «안 돈» 것이지 통과가 아니다`);
    const at = f.code.indexOf(anchor);
    assert.ok(at >= 0, `★${file} 에서 «${anchor}» 를 못 찾았다 — 앵커가 늙었다. 고쳐라(초록으로 읽지 마라)`);
    const body = bodyFrom(f.code, at);
    assert.ok(body, `★${file} 의 «${anchor}» 몸통을 못 떼어냈다`);
    const rec = body.search(RECORD_RE);
    assert.ok(rec >= 0, `★${file} 의 «${anchor}» 가 «아예 기록하지 않는다» — 커밋이 칸을 못 만든다`);
    assert.match(body.slice(0, rec), ASSIGN_RE,
      `★${file} 의 «${anchor}» 가 «찍고 나서» 칠한다(push-before). 그 편집은 자기 칸을 잃고 ` +
      `앞 편집과 함께 ⌘Z 한 번에 사라진다 — 순서를 뒤집어라(적용 먼저, 기록 나중).`);
  }
  for (const [file, anchor] of GRAD_RECORD_ONLY) {
    const f = all.find(s => s.rel === file);
    assert.ok(f, `★${file} 을 못 찾았다 — 검사가 «안 돈» 것이지 통과가 아니다`);
    const at = f.code.indexOf(anchor);
    assert.ok(at >= 0, `★${file} 에서 «${anchor}» 를 못 찾았다 — 앵커가 늙었다`);
    const body = bodyFrom(f.code, at + anchor.length);
    assert.ok(body, `★${file} 의 «${anchor}» 몸통을 못 떼어냈다`);
    assert.match(body, RECORD_RE, `★${file} 의 «${anchor}» 가 기록을 안 한다`);
    assert.doesNotMatch(body, ASSIGN_RE,
      `★${file} 의 «${anchor}» 에 칠하기가 생겼다 — 이 자리는 «기록만» 하는 자리다(칠하기는 ` +
      `바로 앞 goya-cp:gradient 가 한다). 칠할 거면 기록보다 «먼저» 칠하게 옮겨라.`);
  }
});

test('PA-5 ★음성대조 — PA-4 가 «뒤집힌 모양»을 실제로 잡는가', () => {
  /* 화석을 안 베낀다 — 지금 소스에서 push-before 로 되돌린 변형본을 만든다. */
  const f = sources().find(s => s.rel === 'js/props/prop-asset.js');
  assert.ok(f, '★prop-asset.js 를 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다');
  const at = f.code.indexOf('onGradient:');
  assert.ok(at >= 0, '★변환이 늙었다 — onGradient 자리를 못 찾았다');
  const body = bodyFrom(f.code, at);
  assert.ok(body, '★변환이 늙었다 — onGradient 몸통을 못 떼어냈다');
  const rec = body.search(RECORD_RE);
  assert.ok(rec >= 0, '★변환이 늙었다 — 기록 줄을 못 찾았다');
  /* 기록 줄을 몸통 «맨 앞»으로 옮긴 변형본 = 옛(그리고 틀린) 모양 */
  const recLineEnd = body.indexOf(';', rec) + 1;
  const recLine = body.slice(body.lastIndexOf('\n', rec) + 1, recLineEnd);
  const mutated = recLine + body.slice(0, body.lastIndexOf('\n', rec) + 1) + body.slice(recLineEnd);
  assert.notEqual(mutated, body, '★변환이 아무것도 안 바꿨다');
  const mrec = mutated.search(RECORD_RE);
  assert.doesNotMatch(mutated.slice(0, mrec), ASSIGN_RE,
    '★되돌린 변형본을 PA-4 의 잣대가 «못 잡는다» — PA-4 의 초록은 «없어서»가 아니라 «못 봐서»다');
});

test('PA-6 ★검사가 «눈을 감지» 않았는가 — 주석 걷기가 코드를 통째로 삼키면 빨강', () => {
  /* 왜: 이 파일의 모든 검사는 «걷은 소스»를 본다. 걷기가 코드를 삼키면 적중 0건이 나오고
     그건 「없다」가 아니라 「못 봤다」다(2026-09-22 실측: prop-frame.js 27,470자가 그렇게 사라졌다).
     ★이 레포에서 제일 긴 «진짜» 블록주석은 2,236자(js/props/_helpers.js)다. 6,000 은 그 사이의 금이다. */
  const LIMIT = 6000;
  const fat = [];
  for (const { rel, raw } of sources()) {
    for (const m of raw.matchAll(BLOCK_COMMENT_RE)) {
      if (m[0].length > LIMIT) fat.push(`${rel} — ${m[0].length}자`);
    }
  }
  assert.deepEqual(fat, [],
    '★주석 하나가 6,000자를 넘게 걷혔다. 십중팔구 문자열 안의 «/*»(예: accept="image/*")를 ' +
    '여는 괄호로 읽은 것이고, 그만큼 PA-1~PA-4 가 그 파일을 «안 보고» 초록을 낸다.');

  /* ★음성대조 — 옛(좁히지 않은) 정규식으로 재면 이 검사가 «실제로» 빨강이 된다 */
  const LOOSE = /\/\*[\s\S]*?\*\//g;
  const loose = [];
  for (const { rel, raw } of sources()) {
    for (const m of raw.matchAll(LOOSE)) if (m[0].length > LIMIT) loose.push(rel);
  }
  assert.ok(loose.length > 0,
    '★옛 정규식으로도 6,000자 넘는 덩어리가 «안» 나온다 — 그러면 위 초록이 «없어서»인지 ' +
    '«못 봐서»인지 갈리지 않는다. 한계선(6000)이 늙었거나 원인이 사라진 것이니 다시 재고 고쳐라.');
});

/* ══════════════════════════════════════════════════════════════════════════
   PA-7/PA-8 — ★[0.9.14 80행 UNDO-CHECK-PUSH-BEFORE-01] 체크박스 칸 bindCheck(js/props/prop-zoom.js)
   ──────────────────────────────────────────────────────────────────────────
   PA-1 의 사각지대 둘째: 기록 뒤에 «대입»(`block.dataset[key] = …`)이 와서 PA-1 이 못 봤다.
   실앱(미카사 0913-d ⑥): 줌 «테두리 켬 → 굵기 14 → ⌘Z» 한 번에 off/6 — 켬이 자기 칸을 못 가졌다.
   ⇒ bindCheck 의 onChange 몸통을 PA-4 와 같은 잣대(기록 앞에 대입이 있다)로 잠근다.
   행동 쪽은 tests/dom/undo-check-push-after.dom.spec.js(U1·U2 · bindCheck 세 자리)가 잰다.
   ⛔이 검사는 «소스 모양»만 잰다.
═══════════════════════════════════════════════════════════════════════════ */
const CHECK_ANCHOR = ['js/props/prop-zoom.js', 'const bindCheck'];
/** 판정 — 몸통에 기록이 있고, 그 «앞»에 대입이 하나라도 있다(= 적용 먼저). */
const appliesBeforeRecord = (body) => { const rec = body.search(RECORD_RE); return rec >= 0 && ASSIGN_RE.test(body.slice(0, rec)); };
function checkBody() {
  const [file, anchor] = CHECK_ANCHOR;
  const f = sources().find(s => s.rel === file);
  assert.ok(f, `★${file} 을 못 찾았다 — 검사가 «안 돈» 것이지 통과가 아니다`);
  const at = f.code.indexOf(anchor);
  assert.ok(at >= 0, `★${file} 에서 «${anchor}» 를 못 찾았다 — 앵커가 늙었다`);
  const on = f.code.indexOf('onChange:', at);
  assert.ok(on > at, `★${file} bindCheck 에서 onChange 를 못 찾았다 — 앵커가 늙었다`);
  const body = bodyFrom(f.code, on);
  assert.ok(body, `★${file} bindCheck onChange 몸통을 못 떼어냈다`);
  return body;
}

test('PA-7 ★bindCheck(체크박스 칸)는 «바꾸고 나서» 찍는다', () => {
  const body = checkBody();
  assert.match(body, /window\.pushHistory\?\.\(label\)/, '★bindCheck 가 기록을 안 한다 — 켬/끔이 칸을 못 만든다');
  assert.ok(appliesBeforeRecord(body),
    '★bindCheck 가 «찍고 나서» 바꾼다(push-before). 앞 편집이 push-after 면 켬/끔이 자기 칸을 잃고 ' +
    '다음 편집과 함께 ⌘Z 한 번에 사라진다(줌 «테두리 켬 → 굵기 14 → ⌘Z» = off/6) — 적용 먼저, 기록 나중.');
});

test('PA-8 ★음성·양성대조 — PA-7 의 판정이 두 순서를 실제로 가르는가', () => {
  /* 화석을 안 베낀다 — 지금 몸통에서 기록 줄을 떼어 «맨 앞»(옛 모양)과 «맨 뒤»(고친 모양)에 붙인 변형본 둘을 만든다.
     ⇒ 지금 소스가 어느 순서든 두 변형본은 같다 — 이 대조는 판정 자체만 잰다. */
  const body = checkBody();
  const rec = body.search(RECORD_RE);
  assert.ok(rec >= 0, '★변환이 늙었다 — 기록 줄을 못 찾았다');
  const ls = body.lastIndexOf('\n', rec) + 1, le = body.indexOf(';', rec) + 1;
  const recLine = body.slice(ls, le), rest = body.slice(0, ls) + body.slice(le);
  assert.ok(ASSIGN_RE.test(rest), '★변환이 늙었다 — 몸통에 대입(적용)이 없다');
  assert.equal(appliesBeforeRecord(recLine + '\n' + rest), false, '★push-before 변형본을 판정이 «못 잡는다» — PA-7 의 초록은 «못 봐서»다');
  assert.equal(appliesBeforeRecord(rest + '\n' + recLine), true, '★push-after 변형본을 판정이 «틀렸다»고 한다 — PA-7 의 빨강은 잣대 탓이다');
});

/* ══════════════════════════════════════════════════════════════════════════
   PA-9/PA-10 — ★[0.9.14 94행 UNDO-CHECK-PUSH-BEFORE-OTHERS-01] 80행과 같은 병 · 다른 자리 열하나
   ──────────────────────────────────────────────────────────────────────────
   체크박스(켬/끔) change 여덟 + 줌 단일 선택 단추 무리 셋이 «찍고 나서» 바꿨다 — PA-7 과 같은 병.
   PA-1 은 기록 뒤 «대입»·«delete»를 못 본다. ⇒ 핸들러 몸통을 자리마다 잠근다.
   판정은 PA-7 보다 좁다: 앞의 `const x = …`(읽기)와 화살표 `=>`는 «쓰기»가 아니다 — 안 빼면 줌 단추의
     `const next = btn.dataset…` 가 쓰기로 읽혀 고치기 전에도 초록이 난다.
   행동 쪽은 tests/dom/undo-check-push-after-2.dom.spec.js 가 잰다. ⛔이 검사는 «소스 모양»만 잰다.
═══════════════════════════════════════════════════════════════════════════ */
/* [파일, 자리 앵커, 그 뒤 처음 오는 핸들러 머리] */
const CHECK_SITES_2 = [
  ['js/props/prop-asset.js',             "'asset-clip-toggle')",            "addEventListener('change'"],
  ['js/props/prop-asset.js',             'const applyTone',                 '=>'],
  ['js/props/prop-icon-circle.js',       "'#icb-clip-toggle')",             "addEventListener('change'"],
  ['js/props/prop-banner02.js',          "'#bn2-fullbleed-toggle')",        "addEventListener('change'"],
  ['js/props/prop-text-wireup-bubble.js', "'bubble-show-sender')",          "addEventListener('change'"],
  ['js/props/prop-frame.js',             "'ss-fullbleed-toggle')",          "addEventListener('change'"],
  ['js/props/prop-text-wireup-shadow.js', 'onChk.addEventListener',         "addEventListener('change'"],
  ['js/props/prop-page.js',              'padxAsset.addEventListener',      "addEventListener('change'"],
  ['js/props/prop-zoom.js',              "'#zm-shape-group .prop-align-btn').forEach", "addEventListener('click'"],
  ['js/props/prop-zoom.js',              "'#zm-drop-group .prop-align-btn').forEach",  "addEventListener('click'"],
  ['js/props/prop-zoom.js',              "'#zm-txa-group .prop-align-btn').forEach",   "addEventListener('click'"],
];
/** 판정 — 기록 «앞»에 블럭 쓰기(대입·delete)가 있다. 선언(`const x =`)과 `=>`·비교는 빼고 본다. */
const writesBeforeRecord = (body) => {
  const rec = body.search(RECORD_RE);
  if (rec < 0) return false;
  const pre = body.slice(0, rec).replace(/\b(?:const|let|var)\s+[\w$]+\s*=/g, '');
  return /[^=!<>]=(?![=>])/.test(pre) || /\bdelete\s/.test(pre);
};
function siteBody([file, anchor, hook]) {
  const f = sources().find(s => s.rel === file);
  assert.ok(f, `★${file} 을 못 찾았다 — 검사가 «안 돈» 것이지 통과가 아니다`);
  const at = f.code.indexOf(anchor);
  assert.ok(at >= 0, `★${file} 에서 «${anchor}» 를 못 찾았다 — 앵커가 늙었다`);
  const on = f.code.indexOf(hook, at);
  assert.ok(on >= at, `★${file} «${anchor}» 뒤에 «${hook}» 가 없다 — 앵커가 늙었다`);
  const body = bodyFrom(f.code, on);
  assert.ok(body, `★${file} «${anchor}» 몸통을 못 떼어냈다`);
  return body;
}

test('PA-9 ★켬/끔 체크 · 줌 단추 무리 열하나는 «바꾸고 나서» 찍는다', () => {
  const bad = [];
  for (const site of CHECK_SITES_2) {
    const body = siteBody(site);
    assert.match(body, RECORD_RE, `★${site[0]} «${site[1]}» 가 기록을 안 한다 — 칸을 못 만든다`);
    if (!writesBeforeRecord(body)) bad.push(`${site[0]} «${site[1]}»`);
  }
  assert.deepEqual(bad, [],
    '★«찍고 나서» 바꾼다(push-before). 앞 편집이 push-after 면 이 켬/끔은 자기 칸을 잃고 ' +
    '⌘Z 한 번에 다음 편집과 같이 사라진다 — 적용 먼저, 기록 나중.');
});

test('PA-10 ★음성·양성대조 — PA-9 의 판정이 자리마다 두 순서를 실제로 가르는가', () => {
  /* PA-8 과 같은 꼴: 지금 몸통에서 기록 줄을 떼어 «맨 앞»(옛 모양)·«맨 뒤»(고친 모양)에 붙인다 — 지금 순서와 무관하다. */
  for (const site of CHECK_SITES_2) {
    const body = siteBody(site);
    const rec = body.search(RECORD_RE);
    assert.ok(rec >= 0, `★변환이 늙었다 — ${site[0]} 기록 줄을 못 찾았다`);
    const ls = body.lastIndexOf('\n', rec) + 1, le = body.indexOf(';', rec) + 1;
    const recLine = body.slice(ls, le), rest = body.slice(0, ls) + body.slice(le);
    assert.equal(writesBeforeRecord(recLine + '\n' + rest), false, `★${site[0]} «${site[1]}» push-before 변형본을 판정이 «못 잡는다»`);
    assert.equal(writesBeforeRecord(rest + '\n' + recLine), true, `★${site[0]} «${site[1]}» push-after 변형본을 판정이 «틀렸다»고 한다`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   PA-11/PA-12 — ★[0.9.14 97행 UNDO-PUSH-BEFORE-BUTTONS-PICKERS-01] 80·94행과 같은 병 · 단추·피커·목록 더하기/지우기·올리기
   ──────────────────────────────────────────────────────────────────────────
   94행 전수(census)가 남긴 «찍고 나서 바꾸는» 자리들. 쓰기가 «함수 호출»(_writeProps·rerender·previewLine…)이라
   PA-9 의 대입 잣대로는 못 가른다 ⇒ 자리마다 «그 쓰기»를 이름으로 적고, 기록이 그 «뒤»에 오는지 본다.
   ⛔안 잠근 것(일부러 둠): prop-grid «적용 전에 한 번» 둘(규칙 줄 commit · 줄 정렬) · 양쪽 끝 핸들러 · 구조 전환(글 종류 · 인용구 → 글 · 스택).
   행동 쪽은 tests/dom/undo-push-after-3.dom.spec.js 가 잰다. ⛔이 검사는 «소스 모양»만 잰다.
═══════════════════════════════════════════════════════════════════════════ */
/* [파일, 자리 앵커, 그 뒤 처음 오는 핸들러 머리, 기록보다 앞에 와야 하는 쓰기] */
const PICK_SITES = [
  ['js/props/prop-annotation.js', "'#annot-label-mode-group .prop-align-btn').forEach", "addEventListener('click'", '_writeProps('],
  ['js/props/prop-annotation.js', 'reader.onload = ev =>',                     '=>',                         '_writeProps('],
  ['js/props/prop-annotation.js', 'removeBtn.addEventListener',                "addEventListener('click'",   '_writeProps('],
  ['js/props/prop-chat.js',       "'.chb-del-btn').forEach",                   "addEventListener('click'",   'rerender('],
  ['js/props/prop-chat.js',       "'#chb-add-msg')",                           "addEventListener('click'",   'rerender('],
  ['js/props/prop-frame.js',      'function _swapBannerChildren',              'function _swapBannerChildren', 'Array.from(ss.children).forEach'],
  ['js/props/prop-frame.js',      'bannerSel.addEventListener',                "addEventListener('change'",  '_applyBannerPreset'],
  ['js/props/prop-frame.js',      'bgSizeSel) bgSizeSel.addEventListener',     "addEventListener('change'",  'applyFrameBgImageInline('],
  ['js/props/prop-gap.js',        'presetBtns.forEach(btn',                    "addEventListener('click'",   'gb.style.height ='],
  ['js/props/prop-grid.js',       'const numWire = (id, field, lo = 0, hi = Infinity)', "addEventListener('change'", 'gridPreviewLine(block'],
  ['js/props/prop-grid.js',       "const gapH = document.getElementById('grd-line-gap-h')", "addEventListener('change'", 'H.previewLine('],
  ['js/props/prop-grid.js',       "const dvH = document.getElementById('grd-divider-h')",   "addEventListener('change'", 'H.previewLine('],
  ['js/props/prop-grid.js',       "getElementById('grd-line-reset')",          "addEventListener('click'",   'H.previewLine('],
  ['js/props/prop-grid.js',       "'.grd-row-h-item').forEach",                "addEventListener('change'",  'window.renderGridBlock'],
  ['js/props/prop-label-group.js', "styleSelect?.addEventListener('change'",   "addEventListener('change'",  '_applyPresetToItem('],
  ['js/props/prop-label-group.js', "applyAllBtn?.addEventListener('click'",    "addEventListener('click'",   '_applyPresetToItem('],
  ['js/props/prop-label-group.js', 'const _rebind = (name) =>',                '=>',                         'window.LabelShape?.unbindLabelItem'],
  ['js/props/prop-mockup.js',     "'#mkp-shadow-group .prop-align-btn').forEach", "addEventListener('click'", '_applyShadow(block'],
  ['js/props/prop-mockup.js',     'async function _captureAndApply',           'try',                        '_applyScreenImage(block'],
  ['js/props/prop-modal.js',      "getElementById('mdl-typo-color-chips')",    'onPick:',                    "setDs('textColor'"],
  ['js/props/prop-page.js',       'getElementById(`page-align-${align}`)',     "addEventListener('click'",   "'.label-group-block').forEach"],
  ['js/props/prop-section.js',    'const _chk = (dark) =>',                    '=>',                         '_applySectionBg(sec)'],
  ['js/props/prop-section.js',    'bgSizeEl.addEventListener',                 "addEventListener('change'",  '_applySectionBg(sec)'],
  ['js/props/prop-section.js',    'bgImgRemove.addEventListener',              "addEventListener('click'",   '_applySectionBg(sec)'],
  ['js/props/prop-sticker.js',    "'#stk-preset-select')",                     "addEventListener('change'",  'rerender('],
  ['js/props/prop-sticker.js',    "'#stk-icon-replace')",                      'openIconifyModal',           'rerender('],
  ['js/props/prop-text-wireup-bubble.js', "'bubble-style-select')",            "addEventListener('change'",  'applySpeechBubbleStyle'],
  ['js/props/prop-text-wireup-bubble.js', 'const _setTail = (dir) =>',         '=>',                         'replaceWith('],
  ['js/props/prop-text-wireup-bubble.js', 'const _setSize = (mode) =>',        '=>',                         'applyBubbleSize(tb)'],
  ['js/props/prop-text-wireup-bubble.js', 'const _wireDim = (input, key, min, max) =>', "addEventListener('change'", 'applyBubbleSize(tb)'],
  ['js/props/prop-text-wireup-label.js', "'label-shape-pill')",                "addEventListener('click'",   'if (rNumber2)'],
  ['js/props/prop-text-wireup-label.js', "'label-shape-box')",                 "addEventListener('click'",   'if (rNumber2)'],
  ['js/props/prop-text-wireup-label.js', "'label-shape-outline')",             "addEventListener('click'",   'if (rNumber2)'],
  ['js/props/prop-text-wireup-label.js', "'label-shape-circle')",              "addEventListener('click'",   'if (rNumber2)'],
  ['js/props/prop-text-wireup-label.js', "'label-shape-oval')",                "addEventListener('click'",   'if (rNumber2)'],
  ['js/props/prop-text-wireup-label.js', "'label-shape-text')",                "addEventListener('click'",   'if (rNumber2)'],
  ['js/props/prop-text-wireup-text-edit.js', 'container: chipContainer',       'onPick:',                    'applyColorToSel(cssRef)'],
  ['js/props/prop-zoom.js',       "'#zm-img-clear')",                          "addEventListener('click'",   'rerender('],
  ['js/props/prop-zoom.js',       "'#zm-ab-reset')",                           "addEventListener('click'",   'clearPinnedZoomShortEdge'],
];
/** 판정 — 몸통에 기록이 있고, 그 자리의 쓰기가 기록보다 «앞»에 있다. */
const writeBeforeRecord = (body, write) => { const rec = body.search(RECORD_RE), w = body.indexOf(write); return rec >= 0 && w >= 0 && w < rec; };

function checkPickSites(sites, tag) {
  const bad = [];
  for (const site of sites) {
    const body = siteBody(site);
    assert.match(body, RECORD_RE, `★${site[0]} «${site[1]}» 가 기록을 안 한다 — 칸을 못 만든다`);
    assert.ok(body.includes(site[3]), `★${site[0]} «${site[1]}» 몸통에 쓰기 «${site[3]}» 가 없다 — 앵커가 늙었다`);
    if (!writeBeforeRecord(body, site[3])) bad.push(`${site[0]} «${site[1]}»`);
  }
  assert.deepEqual(bad, [],
    `★${tag}: «찍고 나서» 바꾼다(push-before). 앞 편집이 push-after 면 이 조작은 자기 칸을 잃고 ` +
    '⌘Z 한 번에 다음 편집과 같이 사라진다 — 적용 먼저, 기록 나중.');
}
function controlPickSites(sites) {
  /* PA-10 과 같은 꼴: 지금 몸통에서 기록 줄을 떼어 «맨 앞»(옛 모양)·«맨 뒤»(고친 모양)에 붙인다 — 지금 순서와 무관하다. */
  for (const site of sites) {
    const body = siteBody(site);
    const rec = body.search(RECORD_RE);
    assert.ok(rec >= 0, `★변환이 늙었다 — ${site[0]} 기록 줄을 못 찾았다`);
    const ls = body.lastIndexOf('\n', rec) + 1, le = body.indexOf(';', rec) + 1;
    const recLine = body.slice(ls, le), rest = body.slice(0, ls) + body.slice(le);
    assert.equal(writeBeforeRecord(recLine + '\n' + rest, site[3]), false, `★${site[0]} «${site[1]}» push-before 변형본을 판정이 «못 잡는다»`);
    assert.equal(writeBeforeRecord(rest + '\n' + recLine, site[3]), true, `★${site[0]} «${site[1]}» push-after 변형본을 판정이 «틀렸다»고 한다`);
  }
}

test('PA-11 ★단추·피커·목록·올리기 서른아홉 자리는 «바꾸고 나서» 찍는다', () => checkPickSites(PICK_SITES, 'PA-11'));
test('PA-12 ★음성·양성대조 — PA-11 의 판정이 자리마다 두 순서를 실제로 가르는가', () => controlPickSites(PICK_SITES));
