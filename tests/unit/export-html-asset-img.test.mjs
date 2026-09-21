/* U-EXPHTMLASSETIMG — 「단독 HTML 내보내기의 손글씨 CSS 가 앱 CSS 를 이기면 안 된다」의 «변이 책임».
 *
 * 숫자(배송본 img 높이)는 tests/dom/export-html-app-css.dom.spec.js A5 가 실제로 잰다.
 * tests/dom 은 `npm test` 밖이라 되돌려도 조용히 지나간다 ⇒ 여기 못을 박는다.
 *
 * 신고 (2026-09-21 최종통합 QA medium)
 *   js/io/export-html.js 는 «손글씨 CSS 먼저, 수확한 앱 CSS 뒤» 로 싣는다. 커밋 머리말은
 *   「같은 특이도면 뒤가 이긴다」를 근거로 들었는데, 한 짝은 특이도부터 어긋나 있었다:
 *     손글씨 `.asset-block.has-image img { height:auto }` = (0,2,1)
 *     앱 CSS `.asset-img          { height:100% }`        = (0,1,0)
 *   ⇒ 뒤에 실어도 «손글씨가 이긴다». 상자 비율 ≠ 그림 비율인 에셋이 배송본에서만
 *     «가운데 cover 크롭»이 아니라 «위쪽만» 보였다(실측 400×150 상자 → img 251.2px,
 *     600×376.7 세로그림 → 955.5px, 나머지 9노드는 Δ0).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'io', 'export-html.js'), 'utf8');

test('E-1 손글씨 `.asset-block.has-image img` 가 .asset-img 를 덮지 않는다', () => {
  const m = /\.asset-block\.has-image img[^{\n]*\{[^}]*\}/.exec(SRC);
  assert.ok(m, '★규칙 자체가 사라졌다 — 앱 CSS 수확이 막혔을 때의 폴백까지 없어진다');
  assert.match(m[0], /:not\(\.asset-img\)/,
    '★`.asset-img` 를 제외하지 않는다 — 특이도 (0,2,1)이 앱 CSS (0,1,0)을 이겨 배송본만 다른 그림이 된다');
});

test('E-2 폴백은 남아 있다 — CSSOM 이 막혀 appCss 가 비어도 .asset-img 는 스스로 cover 다', () => {
  assert.match(SRC, /\.asset-img\{[^}]*width:100%[^}]*height:100%[^}]*object-fit:cover/,
    '★손글씨 .asset-img 폴백이 사라졌다 — 앱 CSS 수확이 실패하면 그림이 자연 크기로 터진다');
  assert.match(SRC, /\.asset-img-clip\{[^}]*overflow:hidden/,
    '★클리핑 임자(.asset-img-clip)의 폴백이 사라졌다');
});

test('E-3 순서는 그대로 — 손글씨 먼저, 수확한 앱 CSS 뒤', () => {
  const iBase = SRC.indexOf('<style>${css}</style>');
  const iApp  = SRC.indexOf('<style>${appCss}</style>');
  assert.ok(iBase > 0 && iApp > 0, '★두 <style> 자리를 못 찾았다');
  assert.ok(iApp > iBase, '★수확한 앱 CSS 가 손글씨보다 앞이다 — 손글씨 추정값이 화면을 이긴다');
});
