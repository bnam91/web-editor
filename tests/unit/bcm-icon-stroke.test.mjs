/* bcm-icon-stroke.test.mjs — E29: 우클릭 메뉴 아이콘의 «화면에 그려지는» 선 두께가 한 값(1.3)인가 (2026-10-06 lane-esweep · 태양 승인)
 * 증상(기록): 항목마다 두께가 다르다(추가 1.114 · 삭제 1.3) — viewBox 14 를 12px 로 그린 svg 는 1.3 × 12/14 = 1.114.
 * 고침: css/editor-extra.css `#block-context-menu .bcm-item svg * { vector-effect: non-scaling-stroke; }` — 선 굵기가 화면 px 로 고정.
 * 예외 1(일부러 · 태양): bcm-icon-to-sticker 의 별 = 1.0.
 * 자 = index.html 의 #block-context-menu 안 svg «전수»(정규식 · 이 파일 안 이 꼴만) · 실효 두께 = non-scaling 규칙이 있으면 stroke-width, 없으면 stroke-width × width/viewBox폭.
 * [새 것] 고치기 전 빨강(1.114 셋) · 양성대조 = CSS 줄을 빼면 빨강.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(ROOT, 'css', 'editor-extra.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function menuSvgs() {
  const start = html.indexOf('<div id="block-context-menu"');
  assert.ok(start >= 0, '[전제] #block-context-menu 를 찾았다');
  // 메뉴 끝 = 다음 최상위 <div id=… 또는 <!-- 주석 (메뉴 안 항목은 들여쓰기된 bcm-item)
  const rest = html.slice(start);
  const end = rest.search(/\n<\/div>\s*\n/);
  const menu = end > 0 ? rest.slice(0, end) : rest;
  const out = [];
  const re = /<div class="bcm-item" id="([^"]+)"[\s\S]*?<svg([^>]*)>/g;
  let m;
  while ((m = re.exec(menu))) {
    const a = m[2];
    const num = (k) => { const x = new RegExp(`${k}="([^"]+)"`).exec(a); return x ? x[1] : null; };
    const vb = (num('viewBox') || '').split(/\s+/).map(Number);
    out.push({ id: m[1], w: Number(num('width')), vbW: vb[2], sw: num('stroke-width') === null ? null : Number(num('stroke-width')) });
  }
  return out;
}
test('E29 ★메뉴 아이콘 실효 선 두께 = 1.3 (별 1.0 은 일부러)', () => {
  const svgs = menuSvgs();
  assert.ok(svgs.length >= 12, `[전제] 메뉴 svg 를 셌다(${svgs.length})`);
  const nonScaling = /#block-context-menu\s+\.bcm-item\s+svg\s+\*\s*\{[^}]*vector-effect:\s*non-scaling-stroke/.test(css);
  const bad = [];
  for (const s of svgs) {
    if (s.sw === null) continue;   // 선 없는 그림(채움)
    const eff = nonScaling ? s.sw : s.sw * (s.w / s.vbW);
    const want = s.id === 'bcm-icon-to-sticker' ? 1.0 : 1.3;
    if (Math.abs(eff - want) > 0.01) bad.push(`${s.id}: ${eff.toFixed(3)} (stroke ${s.sw} · ${s.w}/${s.vbW})`);
  }
  assert.deepEqual(bad, [], `실효 두께가 다른 아이콘:\n${bad.join('\n')}`);
});
