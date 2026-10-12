/* highlight-entry-j1 — 1012t1J1 형광펜 메뉴를 «B 하나»로 정리하고, 누르면 바로 생긴다.
 *
 * 현빈(1012t1 J1): 「하이라이트 a / b 차이 · b가 최신이라면 b만 남겨줘 · 선2개인 거 찍으면 선이 되는데
 *   그냥 누르면 만들어지게 하고 그다음 조정시키는게 나을 것 같아」
 *
 * ★무엇을 잠그나
 *   HJ1 스티커 메뉴(#fp-pen-menu, HTML 주석을 벗긴 «살아 있는» 본문)에 형광펜 입구가 정확히 1개이고,
 *       그것이 addStickerBlock({shape:'highlightB'}) + toggleFpDropdown('fp-pen-dropdown') 이다.
 *       살아 있는 shape:'highlight' 입구 0 · 살아 있는 toggleHighlightBMode 입구 0.
 *   HJ2 A 는 «숨김»일 뿐 지우지 않았다 — 렌더 갈래 · 패널 절 · 두 클릭 도구 script 태그가 그대로다.
 * 음성대조(보고에 수): A 줄의 주석을 풀면 HJ1 빨강 · B 를 toggleHighlightBMode 로 되돌리면 HJ1 빨강 ·
 *   A 렌더 조건 문자열을 한 글자 깨면 HJ2 빨강.
 * 행동 쪽(실제 클릭 → 선 + 핸들 2 + 패널)은 tests/dom/highlight-line-j1j2.dom.spec.js J1-a.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/* 드롭다운 메뉴 하나를 떼어낸다(zoom-block-polish.test.mjs 와 같은 꼴). 메뉴 안은 <button> 과 주석뿐이라 첫 </div> 가 끝이다. */
function menuBody(html, id) {
  const at = html.indexOf(`id="${id}"`);
  assert.ok(at >= 0, `메뉴를 못 찾았다: #${id}`);
  const end = html.indexOf('</div>', at);
  assert.ok(end > at, `메뉴가 안 닫힌다: #${id}`);
  return html.slice(at, end);
}
const stripHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

test('HJ1 스티커 메뉴의 형광펜 입구는 «B 를 바로 만드는» 단추 하나뿐이다', () => {
  const live = stripHtmlComments(menuBody(read('index.html'), 'fp-pen-menu'));
  const buttons = live.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [];
  // ★전제: 메뉴를 실제로 떼어냈다(0바퀴 자기통과 방지)
  assert.ok(buttons.length >= 7, `스티커 메뉴 항목이 안 잡혔다 (${buttons.length}개)`);

  const hl = buttons.filter(b => /highlight/i.test(b));
  assert.equal(hl.length, 1, `살아 있는 형광펜 입구가 ${hl.length}개다 — 하나(B)만 남아야 한다:\n${hl.join('\n')}`);
  const onclick = (hl[0].match(/onclick="([^"]*)"/) || [])[1];
  assert.equal(onclick, "addStickerBlock({shape:'highlightB'});toggleFpDropdown('fp-pen-dropdown')",
    '형광펜 단추가 «누르면 바로 B 를 만든다»가 아니다');
  assert.match(hl[0], />\s*Highlight\s*<\/button>/, '레이블은 «Highlight» 하나(가정 A1 — «B» 꼬리표 없이)');

  assert.equal((live.match(/shape:'highlight'}/g) || []).length, 0, '살아 있는 면 형광펜 A 입구가 남아 있다');
  assert.equal((live.match(/toggleHighlightBMode/g) || []).length, 0, '메뉴가 아직 두 클릭 모드로 들어간다');
});

test('HJ2 A 는 «숨김»일 뿐 — 렌더·패널·두 클릭 도구는 그대로 있다(옛 프로젝트가 열려야 한다)', () => {
  const stk = read('js/blocks/sticker-block.js');
  assert.ok(stk.includes("shape === 'highlight'"), 'A 렌더 갈래(shape === \'highlight\')가 사라졌다');
  const prop = read('js/props/prop-sticker.js');
  assert.ok(prop.includes('id="stk-hl-section"'), 'A 패널 절(#stk-hl-section)이 사라졌다');
  const html = read('index.html');
  const tags = html.match(/<script\s+src="js\/highlight-line-tool\.js"><\/script>/g) || [];
  assert.equal(tags.length, 1, '두 클릭 도구(js/highlight-line-tool.js) script 태그가 1개가 아니다 — 설정 이스터에그 입구가 쓴다');
  // 숨긴 A 줄은 «주석 안에» 남아 있다(되돌리기 = 주석 풀기)
  const penRaw = menuBody(html, 'fp-pen-menu');
  assert.ok(/<!--[\s\S]*?addStickerBlock\(\{shape:'highlight'\}\)[\s\S]*?-->/.test(penRaw), '숨긴 A 줄이 주석 안에 없다');
});
