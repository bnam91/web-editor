/* grid-guide-radio.test.js — Grid 절의 «켬/끔 라디오»와 프리셋 줄 폭. (2026-09-09 신설)
 *
 * 발주(현빈): 「이건 라디오버튼으로 해주고 섹션이 깨지네」
 *
 * ⚠️왜 검사가 필요한가 — 체크박스에서 라디오로 옮기면 «조용한» 함정이 둘 생긴다:
 *   ⛔① change 는 «선택된 쪽»에서만 난다. 켬 라디오에만 리스너를 걸면
 *        사용자가 «끔»을 눌러도 아무 일이 안 일어난다(체크박스는 한 요소라 이 문제가 없었다).
 *   ⛔② 라디오는 `.checked = false` 로 못 끈다 — 그러면 «둘 다 안 켜진» 상태가 된다.
 *        끄려면 «끔 쪽»을 켜야 한다.
 *   ⇒ 둘 다 «화면에선 멀쩡해 보이고» 눌러야만 드러난다. 그래서 소스로 못박는다.
 *
 * ★섹션 깨짐(실측, 격리 인스턴스 240px 패널):
 *   그 줄의 나머지가 전부 flex-shrink:0 이라 프리셋 그룹 몫이 51px 인데
 *   공용 규칙 repeat(3,1fr) 이 칸을 14.3px 로 쪼갠다 — 버튼은 «둘»뿐인데 칸이 «셋».
 *   ⇒ [6]↔[12] 가 1.3px 겹치고 빈 칸에 18.3px 가 죽었다. flex+내용폭으로 겹침 0 · 47.7px.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { makeStripper } = require('./_strip-comments.js');
const readSrc = (rel) => { const s = makeStripper(); return fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').map(s).join('\n'); };

const PAGE = readSrc('js/props/prop-page.js');
const { sliceBlock } = require('./_slice-block.js');   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)
const CSS  = readSrc('css/editor-props.css');

const PAIRS = [
  { on: 'page-grid-on',     off: 'page-grid-off',     name: 'page-grid' },
  { on: 'page-pad-hint-on', off: 'page-pad-hint-off', name: 'page-pad-hint' },
];

/* ★기대 바뀜(현빈 261123 «온/오프 = 고디터 커스텀 체크 하나» — 옛 «켬/끔 라디오 쌍»(현빈 2026-09-09 «라디오버튼으로») 결정 대체) — R-1~R-3 은 «라디오 쌍»의 함정(끔 쪽 리스너 · 끔 쪽 켜기)을 지키던 자리다.
   체크 하나가 되며 그 함정이 사라졌다 ⇒ 이제 «체크 하나 · 끔 짝 없음 · 리스너는 그 체크에»를 잰다. */
test('R-1 ★Grid 절의 켬/끔이 «체크 하나»다 (끔 라디오 잔재 0)', () => {
  assert.equal(PAIRS.length, 2, '명부가 낡았다 — 루프가 한 벌을 안 보고 있다');
  for (const p of PAIRS) {
    assert.match(PAGE, new RegExp(`checkHTML\\(\\{ id: '${p.on}'`), `${p.on} 이 check 부품이 아니다`);
    assert.ok(!new RegExp(`id="${p.off}"`).test(PAGE), `${p.off}(옛 끔 라디오)가 남았다`);
    assert.ok(!new RegExp(`name="${p.name}"`).test(PAGE), `${p.name} 라디오가 남았다`);
  }
});

test('R-2 ★리스너가 «그 체크»에 걸린다', () => {
  assert.ok(/gridOn\.addEventListener\('change', refreshGrid\)/.test(PAGE), '그리드 가이드 체크에 change 가 없다');
  assert.ok(/padHintOn\.addEventListener\('change'/.test(PAGE), '패딩 비주얼 체크에 change 가 없다');
  assert.ok(!/_radioPair(On|Set)\(/.test(PAGE), '옛 라디오 짝 헬퍼가 남았다');
});

test('R-3 ★처음 값은 저장 값으로 «그 체크»에 세운다', () => {
  assert.ok(/gridOn\.checked = !!pref\.on;/.test(PAGE), '그리드: 처음 값을 안 세운다');
  assert.ok(/padHintOn\.checked = !!readPadHintOn\(\);/.test(PAGE), '패딩: 처음 값을 안 세운다');
});

test('R-4 ★프리셋 줄 폭 — #page-grid-col-presets 만 «내용폭»으로 예외 처리', () => {
  assert.ok(/#page-grid-col-presets[^{]*\{[^}]*display:\s*flex/.test(CSS),
    '★그 그룹이 여전히 3칸 그리드다 — [6]↔[12] 가 1.3px 겹친다(실측)');
});

test('R-5 ⛔공용 규칙을 «볼모로 잡지 않았다» — 프리셋 6개짜리 패널이 살아 있다', () => {
  assert.ok(/\.prop-type-group:has\(\.prop-preset-btn\)\s*\{[^}]*grid-template-columns:\s*repeat\(3/.test(CSS),
    '★공용 3칸 규칙이 사라졌다 — prop-asset.js 의 프리셋 «6개»가 한 줄로 쏟아진다');
  const asset = readSrc('js/props/prop-asset.js');
  const n = (asset.match(/prop-preset-btn prop-type-btn/g) || []).length;
  assert.ok(n >= 4, `양성대조 실패 — 에셋 프리셋을 ${n}개밖에 못 셌다. 이 검사는 아무것도 안 지킨다`);
});

test('R-6 ⛔전역 .prop-label(56px)은 «그대로»다 — 새 변형만 더했다', () => {
  /* U0(right-panel-unify) — 56px 리터럴이 토큰 var(--ui-form-label-w) 로 갔다. 값(56px)은 토큰 정의에서 잰다. */
  assert.ok(/\.prop-label \{[^}]*width:\s*var\(--ui-form-label-w\)/.test(CSS), '전역 라벨 폭이 토큰을 안 본다 — 패널 세로 정렬이 깨진다');
  assert.ok(/--ui-form-label-w:\s*56px/.test(readSrc('css/editor-base.css')), '★--ui-form-label-w 가 56px 이 아니다 — 전역 라벨 폭이 바뀌었다');
  assert.ok(/\.prop-label--auto \{[^}]*width:\s*auto/.test(CSS),
    '★prop-label--auto 가 없다 — 「그리드 가이드」(60px 필요)가 56px 라벨에서 잘린다(실측)');
});
