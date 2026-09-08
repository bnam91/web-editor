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
const CSS  = readSrc('css/editor-props.css');

const PAIRS = [
  { on: 'page-grid-on',     off: 'page-grid-off',     name: 'page-grid' },
  { on: 'page-pad-hint-on', off: 'page-pad-hint-off', name: 'page-pad-hint' },
];

test('R-1 ★Grid 절의 토글이 «라디오 쌍»이다 (체크박스 잔재 0)', () => {
  assert.equal(PAIRS.length, 2, '쌍 명부가 낡았다 — 루프가 한 벌을 안 보고 있다');
  for (const p of PAIRS) {
    assert.ok(new RegExp(`type="radio"[^>]*id="${p.on}"|id="${p.on}"[^>]*type="radio"`).test(PAGE), `${p.on} 이 라디오가 아니다`);
    assert.ok(new RegExp(`id="${p.off}"`).test(PAGE), `${p.off}(끔) 이 없다 — 라디오는 «짝»이 있어야 끌 수 있다`);
    assert.ok(new RegExp(`name="${p.name}"[\\s\\S]{0,400}name="${p.name}"`).test(PAGE), `${p.name} 두 라디오가 같은 name 이 아니다 — 서로를 안 끈다`);
    assert.ok(!new RegExp(`type="checkbox"[^>]*id="${p.on}"`).test(PAGE), `${p.on} 에 체크박스 잔재가 있다`);
  }
});

test('R-2 ★★리스너가 «양쪽»에 걸린다 — 켬에만 걸면 «끔»을 눌러도 아무 일이 없다', () => {
  assert.ok(/function _radioPairOn\(/.test(PAGE), '_radioPairOn 헬퍼가 없다');
  /* 헬퍼가 «둘 다»에 거는지 본문으로 확인 — 이름만 보고 믿지 않는다 */
  const body = PAGE.slice(PAGE.indexOf('function _radioPairOn('));
  const end = body.indexOf('\n}');
  const fn = body.slice(0, end);
  assert.ok(/onEl\.addEventListener/.test(fn) && /offEl\.addEventListener/.test(fn),
    '★_radioPairOn 이 한쪽에만 건다 — 「끔」을 눌러도 반응이 없다');
  /* 실제 배선이 그 헬퍼를 «쓰는지» */
  assert.ok(/_radioPairOn\(gridOn, gridOff/.test(PAGE), '그리드 가이드가 헬퍼를 안 쓴다');
  assert.ok(/_radioPairOn\(padHintOn, padHintOff/.test(PAGE), '패딩 비주얼이 헬퍼를 안 쓴다');
});

test('R-3 ★끄기는 «끔 쪽을 켜는» 것이다 (.checked=false 로는 못 끈다)', () => {
  assert.ok(/function _radioPairSet\(/.test(PAGE), '_radioPairSet 헬퍼가 없다');
  const body = PAGE.slice(PAGE.indexOf('function _radioPairSet('));
  const fn = body.slice(0, body.indexOf('\n}'));
  assert.ok(/offEl\.checked\s*=\s*!val/.test(fn),
    '★끔 쪽을 «켜지» 않는다 — 둘 다 꺼진 상태가 생긴다');
  /* ★그리드 쪽은 «헬퍼를 못 쓴다» — grid-guide-tidy.test.js 의 runInit 이 초기화 구간을
       «떠내서 실행»하므로 조각 밖 함수를 부르면 ReferenceError 다. 그래서 인라인이다.
     ⇒ 검사는 «헬퍼 이름»이 아니라 «성질»(끔 쪽을 켠다)을 본다 — 이름을 보면 정당한 인라인을 벌한다. */
  assert.ok(/if \(gridOff\) gridOff\.checked = !gridOn\.checked;/.test(PAGE),
    '★그리드: 끔 라디오를 «켜지» 않는다 — 둘 다 꺼진 상태가 생긴다');
  assert.ok(/_radioPairSet\(padHintOn, padHintOff/.test(PAGE),
    '패딩: 초기 상태를 헬퍼로 안 세운다');
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
  assert.ok(/\.prop-label \{[^}]*width:\s*56px/.test(CSS), '전역 라벨 폭이 바뀌었다 — 패널 세로 정렬이 깨진다');
  assert.ok(/\.prop-label--auto \{[^}]*width:\s*auto/.test(CSS),
    '★prop-label--auto 가 없다 — 「그리드 가이드」(60px 필요)가 56px 라벨에서 잘린다(실측)');
});
