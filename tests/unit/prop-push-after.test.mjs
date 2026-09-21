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

/** js/ 아래 모든 .js 를 읽는다(주석은 걷는다 — 산문은 코드가 아니다). */
function sources() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) {
        const raw = fs.readFileSync(p, 'utf8');
        const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
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
  'if', 'for', 'while', 'switch', 'catch', 'return', 'do']);

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
  'js/props/prop-grid.js::gridPreviewLine': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-label-group.js::_applyPresetToItem': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-laurel.js::showLaurelProperties': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-mockup.js::_applyScreenImage': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-modal.js::setDs': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-multisel.js::showFlowMultiSelPanel': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-multisel.js::showFreeLayoutMultiSelPanel': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-shape.js::showShapeProperties': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-simple-card.js::setTextBgTransparentUI': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-text-wireup-label.js::_resetLabelInline': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
  'js/props/prop-text-wireup-text-edit.js::applyColorToSel': '★미측정 — 실앱에서 «이 자리가 정말 자기 칸을 잃는가»를 안 쟀다(2026-09-21)',
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
  const f = sources().find(s => s.rel.endsWith('prop-mockup.js'));
  assert.ok(f, '★prop-mockup.js 를 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다');
  const mutated = f.code.replace(
    /applyWidth\(parseInt\(wNumber\.value\)\);\s*window\.pushHistory\?\.\(\);/,
    'window.pushHistory?.(); applyWidth(parseInt(wNumber.value));');
  assert.notEqual(mutated, f.code, '★변환이 늙었다 — 폭 숫자칸 배선을 못 찾았다');
  const found = [...mutated.matchAll(PUSH_BEFORE)].filter(m => !BENIGN.has(m[1]));
  assert.ok(found.length > 0,
    '★되돌린 변형본을 이 정규식이 «못 잡는다» — PA-1 의 초록은 «없어서»가 아니라 «못 봐서»다');
});

test('PA-3 세 자리가 «지금 모양»으로 남아 있다 (고침이 되돌려지면 빨강)', () => {
  const want = [
    ['prop-mockup.js',  /applyWidth\(parseInt\(wNumber\.value\)\);\s*window\.pushHistory\?\.\(\)/],
    ['prop-iconify.js', /applySize\(parseInt\(sNumber\.value\)\);\s*window\.pushHistory\?\.\(\)/],
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
