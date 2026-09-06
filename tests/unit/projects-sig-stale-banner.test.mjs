/* 단위(정적) — pages/projects.html 의 E3-b ㉯ 배너 배선.
 *
 * ★★실기(CDP) 재현으로 «실제로» 잡은 회귀 하나를 여기 고정한다:
 *   처음엔 `<div id="sig-stale-banner" hidden>` + CSS `#sig-stale-banner{display:flex}` 로
 *   짰다. 그런데 «ID 셀렉터의 display:flex」가 «[hidden] 의 UA 규칙」보다 명시도가 높아서
 *   `hidden=true` 를 줘도 «빈 회색 줄」이 그대로 남았다 — 배너가 없어야 할 때 안 사라졌다.
 *   (단위검사는 진짜 CSS 를 안 그리니 이걸 «절대» 못 잡는다 — CDP 스크린샷으로만 잡혔다.)
 *   ⇒ 고침 = `hidden` 속성 대신 이 코드베이스의 기존 관례(`el.style.display`)를 그대로 쓴다
 *     (license.html·projects.html #acct 가 이미 이 패턴이다).
 * ⛔이 파일은 «정적» 검사다 — 진짜 렌더링은 CDP 스크린샷(보고에 첨부)이 증명했다.
 *   여기서는 «그 고침이 도로 hidden 으로 안 돌아가는지»만 기계로 잠근다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(__dirname, '../../pages/projects.html'), 'utf8');

test('PSB-1 ★배너 초기 마크업은 `hidden` 속성이 아니라 `style="display:none"` 이다', () => {
  const m = HTML.match(/<div id="sig-stale-banner"([^>]*)>/);
  assert.ok(m, '#sig-stale-banner 를 못 찾았다 — 마크업이 바뀌었다');
  assert.ok(!/\bhidden\b/.test(m[1]), '`hidden` 속성이 돌아왔다 — CSS display:flex 와 다시 충돌한다: ' + m[0]);
  assert.match(m[1], /style="display:\s*none"/, 'display:none 인라인 스타일이 없다: ' + m[0]);
});

test('PSB-2 CSS 규칙이 `[hidden]` 속성 셀렉터에 기대지 않는다(같은 함정 재발 방지)', () => {
  assert.ok(!/#sig-stale-banner\[hidden\]/.test(HTML),
    '[hidden] 속성 셀렉터로 되돌리는 중이면 이 검사가 안 잡아준다 — style.display 패턴을 유지해라(이 줄은 그 패턴이 없어졌을 때를 위한 안내일 뿐).');
  // ★핵심 확인 — JS 쪽이 .hidden 프로퍼티가 아니라 .style.display 를 쓰는지.
  assert.ok(!/document\.getElementById\('sig-stale-banner'\)\.hidden\s*=/.test(HTML),
    'JS 가 다시 el.hidden = ... 로 돌아갔다');
});

test('PSB-3 paintSigStaleBanner 가 정확히 두 호출부(부팅·새로고침)에 배선돼 있다', () => {
  // ⛔`function paintSigStaleBanner(st) {` «정의» 줄도 이 패턴에 걸린다 — 부르는 자리만 세려면 뺀다.
  const calls = (HTML.match(/paintSigStaleBanner\(/g) || []).length
    - (HTML.match(/function paintSigStaleBanner\(/g) || []).length;
  assert.equal(calls, 2, `호출부가 2곳이어야 하는데 ${calls}곳: 부팅 IIFE + 새로고침 버튼 핸들러`);
});

test('PSB-4 js/entitlement-banner.js 가 <script src> 로 실제 로드된다', () => {
  assert.match(HTML, /<script src="\.\.\/js\/entitlement-banner\.js"><\/script>/);
});

test('PSB-5 배너는 모달이 아니다 — showModal·confirm·alert 를 부르지 않는다', () => {
  const banner = HTML.match(/function paintSigStaleBanner[\s\S]*?\n}/);
  assert.ok(banner);
  assert.ok(!/showModal|confirm\(|alert\(/.test(banner[0]), '배너가 사용자 입력을 막는 호출을 쓴다 — 정보지 제한이 아니다');
});
