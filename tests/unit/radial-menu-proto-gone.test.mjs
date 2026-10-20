/* radial-menu-proto-gone — 1020t2e1 고정.
 * 잠그는 것 넷:
 *   ⑴ 컴포넌트 드롭다운의 radial 관련 «버튼 줄»이 ★정확히 1개(addRadialBlock)
 *   ⑵ 그 버튼 이름 = "Radial" (Proto 접두 없음) · ★title 에도 「프로토」가 없다
 *   ⑶ RADIAL_DEFAULT_ITEMS 의 img 가 ★전부 '' — ★명부 구동(길이를 박지 않는다)
 *   ⑷ 그 명부의 label 은 ★남아 있다 (지디 판정 ⑶ · 라벨은 현빈 결정 대기)
 * ⛔항등식 방지 — index.html 을 읽어 「현재 값」을 기대값으로 삼지 않는다. 기대값은 이 파일에 문자로 박는다.
 * ⛔주석 오염 방지 — 메뉴 영역엔 다른 입구를 설명하는 ★주석 덩어리가 있다(Info/Inner Card 건).
 *    그래서 줄 추출은 ★`<button` 이 든 줄로만 한다(261007 교훈: 주석이 소스 파싱 게이트의 입력이 된다). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MENU_RE = /<div class="fp-dropdown-menu" id="fp-component-menu">([\s\S]*?)\n\s*<\/div>\s*\n\s*<\/div>/;
const RADIAL_CALL = /addRadialBlock\(\)|addGraphBlock\(\{chartType:'radial'\}\)|insertRadialArrangeFrame/;

function radialButtonLines(menuHtml) {
  return menuHtml.split('\n').filter(l => l.includes('<button') && RADIAL_CALL.test(l));
}
const buttonText = line => (line.match(/>([^<]*)<\/button>/) || [, null])[1]?.trim() ?? null;
const buttonTitle = line => (line.match(/title="([^"]*)"/) || [, null])[1] ?? null;

/* RADIAL_DEFAULT_ITEMS 를 ★정의 자리에서 파싱 — 길이는 ★파싱 결과에서 끌어온다(⛔하드코딩 금지) */
function parseDefaultItems() {
  const src = readFileSync(path.join(ROOT, 'js/blocks/radial-block.js'), 'utf8');
  const decls = src.match(/const RADIAL_DEFAULT_ITEMS = Object\.freeze\(\[[\s\S]*?\]\);/g) || [];
  const body = decls.length === 1 ? decls[0] : null;
  const entries = body
    ? [...body.matchAll(/\{\s*label:\s*(['"])((?:(?!\1).)*)\1\s*,\s*img:\s*(['"])((?:(?!\3).)*)\3\s*\}/g)]
        .map(m => ({ label: m[2], img: m[4] }))
    : [];
  // 「항목처럼 생긴 것」이 몇 개인지 ★따로 세서, 파서가 조용히 흘린 항목이 없음을 잠근다
  const looseCount = body ? (body.match(/\{\s*label:/g) || []).length : 0;
  return { declCount: decls.length, entries, looseCount };
}

test('T1 실측 — radial 메뉴 버튼이 1개뿐이고 이름이 "Radial" · title 에 「프로토」가 없다', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const menuMatch = html.match(MENU_RE);
  assert.ok(menuMatch, '★전제: #fp-component-menu 블록을 찾았다');
  const menu = menuMatch[1];
  assert.ok(menu.includes('<button'), '★전제: 메뉴 영역에 버튼 줄이 있다(추출기가 살아 있다)');

  const lines = radialButtonLines(menu);
  assert.equal(lines.length, 1, `radial 버튼 줄 수 — 실제 ${lines.length}(기대 1). 찾은 줄:\n${lines.join('\n')}`);
  assert.equal(buttonText(lines[0]), 'Radial', `버튼 글자 — 실제 ${JSON.stringify(buttonText(lines[0]))}(기대 "Radial", Proto 접두 없음)`);

  const title = buttonTitle(lines[0]);
  assert.ok(title !== null, '★전제: 그 버튼에 title 속성이 있다(없으면 아래 검사가 공허하게 통과한다)');
  assert.ok(!/프로토|Proto/i.test(title), `title 에 「프로토」가 남았다 — 실제 ${JSON.stringify(title)}`);

  assert.ok(/onclick="addRadialBlock\(\);/.test(lines[0]), '남는 버튼은 addRadialBlock() 을 불러야 한다');
  assert.equal(radialButtonLines(menu).filter(l => /chartType:'radial'/.test(l)).length, 0,
    "addGraphBlock({chartType:'radial'}) 버튼 줄이 0 이어야 한다(일반 addGraphBlock() 버튼은 남아도 된다)");
  assert.equal(radialButtonLines(menu).filter(l => /insertRadialArrangeFrame/.test(l)).length, 0,
    'insertRadialArrangeFrame 버튼 줄이 0 이어야 한다');
});

test('T4 샘플 img 가 0개다 — ★명부 구동(길이를 박지 않는다) · label 은 ★남아 있다', () => {
  const { declCount, entries, looseCount } = parseDefaultItems();
  assert.equal(declCount, 1, `★전제: RADIAL_DEFAULT_ITEMS 선언이 ★정확히 1개 — 실제 ${declCount}`);
  assert.ok(entries.length >= 1, `★전제: 항목을 ${entries.length}개 파싱했다 — 0이면 아래 「전부 비었다」가 ★공허하게 통과한다`);
  assert.equal(entries.length, looseCount,
    `★전제: 파서가 흘린 항목이 없다 — 파싱 ${entries.length} vs 「label:」 ${looseCount}`);

  const withImg = entries.filter(e => e.img !== '');
  assert.equal(withImg.length, 0,
    `샘플 img 가 남았다 — ${entries.length}개 중 ${withImg.length}개: ${JSON.stringify(withImg)}`);

  const emptyLabel = entries.filter(e => e.label.trim() === '');
  assert.equal(emptyLabel.length, 0,
    `★label 은 남겨야 한다(지디 판정 ⑶ · 현빈 결정 대기) — ${entries.length}개 중 ${emptyLabel.length}개가 비었다`);
});

/* ⛔항등식 방지 — 아래 고정문은 index.html 에서 읽어온 것이 ★아니라 수정 ★전 원문을 손으로 옮긴 것이다. */
const OLD_THREE_BUTTONS = `
      <button class="fp-menu-item" onclick="addRadialBlock();toggleFpDropdown('fp-component-dropdown')" title="방사형 에셋 블럭 (프로토)">Proto: Radial Block</button>
      <button class="fp-menu-item" onclick="addGraphBlock({chartType:'radial'});toggleFpDropdown('fp-component-dropdown')" title="방사형 에셋 블럭 — 그래프 「방사형」 안 (프로토)">Proto: Graph · Radial</button>
      <button class="fp-menu-item" onclick="window.insertRadialArrangeFrame?.();toggleFpDropdown('fp-component-dropdown')" title="방사형 에셋 블럭 — 방사 배치 안 (프로토)">Proto: Radial Arrange</button>
`;

test('T2 음성대조(반례) — 구 꼴(3버튼·Proto 이름·Proto title)은 같은 로직에서 ★다르게 나온다', () => {
  const lines = radialButtonLines(OLD_THREE_BUTTONS);
  assert.equal(lines.length, 3, `구 꼴 줄 수 실제 ${lines.length}(기대 3) — 1이 아니므로 T1 의 등호가 빨개진다`);
  assert.notEqual(buttonText(lines[0]), 'Radial', '구 꼴 첫 버튼 글자는 "Radial"이 아니다');
  assert.ok(buttonText(lines[0]).includes('Proto'), '구 꼴은 Proto 접두를 포함한다(이름 복귀 감지 능력 증명)');
  assert.ok(/프로토/.test(buttonTitle(lines[0])), '구 꼴 title 은 「프로토」를 포함한다(title 감지 능력 증명)');
});

test('T3 회귀 재현 — 「이름만 Proto 로 되돌린」 꼴도 1개짜리 줄에서 잡힌다', () => {
  const regressed = `      <button class="fp-menu-item" onclick="addRadialBlock();toggleFpDropdown('fp-component-dropdown')" title="방사형 에셋 블럭">Proto: Radial</button>\n`;
  const lines = radialButtonLines(regressed);
  assert.equal(lines.length, 1, '줄 수는 여전히 1(함수 재추가가 아니라 이름만 되돌린 경우)');
  assert.notEqual(buttonText(lines[0]), 'Radial', '이름에 "Proto"가 남으면 T1 의 등호가 빨개진다');
});

test('T5 회귀 재현 — 「title 만 되돌린」 꼴도 잡힌다(⛔글자만 재면 샌다)', () => {
  const titleOnly = `      <button class="fp-menu-item" onclick="addRadialBlock();toggleFpDropdown('fp-component-dropdown')" title="방사형 에셋 블럭 (프로토)">Radial</button>\n`;
  const lines = radialButtonLines(titleOnly);
  assert.equal(lines.length, 1, '줄 수 1 · 글자도 "Radial" 이라 글자 검사는 통과한다');
  assert.equal(buttonText(lines[0]), 'Radial', '글자만 보면 ★통과한다 — 그래서 title 을 따로 봐야 한다');
  assert.ok(/프로토/.test(buttonTitle(lines[0])), 'title 검사는 ★빨개진다(이것이 T1 의 title 단언을 지킨다)');
});

test('T6 음성대조 — 「주석에만 적힌 호출」은 버튼으로 세지 않는다(주석 오염 방지)', () => {
  const commentOnly = `      <!-- 구 입구였다: addRadialBlock() · insertRadialArrangeFrame() 은 지우지 않았다 -->\n`;
  assert.equal(radialButtonLines(commentOnly).length, 0, '주석 줄은 버튼 줄로 세지 않는다');
});
