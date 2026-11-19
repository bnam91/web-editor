/* layer-memo-icon-size.test.mjs — VISUAL-14-LAYER-EYE-MEMO-SIZE-01(현빈 261119 · 0.9.13 146행 · AUDIT-visual-svg #14)
 * 증상: 레이어 섹션 행에 나란히 서는 눈 아이콘 12px · 메모 아이콘 11px — 1px 차.
 * 자 = css/panels/_panel-layer.css 원문(주석 뺌)에서 두 규칙의 width·height 를 읽어 같은가.
 * 양성대조 = 메모를 11px 로 되돌리면 빨강(_patches/visual5-146-CTL-memo-11.patch).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'css/panels/_panel-layer.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const size = (sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `[전제] 규칙 «${sel}» 를 찾았다`);
  const v = (k) => (new RegExp(`(?:^|;|\\s)${k}\\s*:\\s*([^;]+)`).exec(m[1]) || [])[1]?.trim();
  return { w: v('width'), h: v('height') };
};

test('146 메모 아이콘 = 눈 아이콘 크기', () => {
  const eye = size('.layer-eye-btn svg'), memo = size('.layer-memo-ico svg');
  assert.ok(eye.w && eye.h, '[전제] 눈 아이콘 크기가 있다');
  assert.deepEqual(memo, eye);
});
