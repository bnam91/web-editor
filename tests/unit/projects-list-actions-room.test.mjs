/* projects-list-actions-room.test.mjs — VISUAL-5-LIST-DATE-COVERED-01(현빈 261119 · 0.9.13 143행 · AUDIT-visual-svg #5)
 * 증상: 리스트 보기에서 공유(👥) 단추가 있는 카드에 마우스 → 단추 5개가 날짜 끝 26px 를 덮음(자리는 4개분 110px 만 비움).
 * 고침: 공유 단추가 있는 카드만 오른쪽 자리 136px(:has(.card-share)) · 나머지는 110px 그대로.
 * 자 = pages/projects.html 원문 — 단추 폭(.card-action width)·사이(.card-actions gap)·리스트의 오른쪽 띄움(right) 과
 *   카드 템플릿의 .card-actions 안 단추 수(고정 ☆·✕ + 조건부 📁·👥·⎘)로 «필요한 자리»를 셈해 CSS 값과 견준다.
 *   (손으로 136 을 적지 않는다 — 단추가 늘면 이 자가 먼저 빨개진다)
 * 양성대조 = :has(.card-share) 규칙을 빼면 빨강(_patches/visual5-143-CTL-no-has.patch).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'pages/projects.html'), 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (sel) => {
  const r = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, s]) => s.trim() === sel);
  assert.ok(r, `[전제] 규칙 «${sel}»`);
  return r[2];
};
const px = (b, k) => { const m = new RegExp(`(?:^|;|\\s)${k}\\s*:\\s*([^;]+)`).exec(b); assert.ok(m, `[전제] ${k}`); return m[1].trim(); };

test('143 공유 단추 있는 카드 = 단추 «전부» 자리 · 없는 카드 = 하나 적은 자리', () => {
  const w = parseFloat(px(body('.card-action'), 'width'));
  const gap = parseFloat(px(body('.card-actions'), 'gap'));
  const right = parseFloat(px(body('#project-grid.is-list .card-actions'), 'right'));
  const tpl = /<div class="card-actions">([\s\S]*?)<\/div>/.exec(html);
  assert.ok(tpl, '[전제] 카드 템플릿 .card-actions');
  const n = (tpl[1].match(/<button\b/g) || []).length + (tpl[1].match(/\$\{\w+BtnHtml\}/g) || []).length;
  assert.ok(/\$\{shareBtnHtml\}/.test(tpl[1]), '[전제] 공유 단추 자리');
  const need = (k) => k * w + (k - 1) * gap + right;
  const base = px(body('#project-grid.is-list .card-body'), 'padding').split(/\s+/)[1];
  assert.equal(parseFloat(base), need(n - 1), `기본 오른쪽 자리 = 공유 뺀 ${n - 1}개분`);
  const share = px(body('#project-grid.is-list .project-card:has(.card-share) .card-body'), 'padding-right');
  assert.equal(parseFloat(share), need(n), `공유 카드 오른쪽 자리 = ${n}개분`);
});
