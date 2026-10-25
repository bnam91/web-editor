/* t4-02-radial-dot-color.dom.spec.js
 *   ★`t4-02` — ★방사형 ★점·선 색을 ★현빈 요청값 `#c9cdd6` 으로. (2026-10-25 신설 · 지디)
 *
 * ★★이력(★숨기지 않는다)
 *   ★L1(전수 채점 261025) : 「`.rdl-line` stroke `#c8cdd6` === dotColor `#c8cdd6`
 *     (RADIAL_DOT_COLOR ★한 자리 파생) · ★★단 ★현빈 요청값 ★`c9cdd6` vs 실제 ★`c8cdd6`(★1자 차이)」
 *   ⇒ ★내 판정(261025) : ★한 문장에 ★조건이 ★둘이다 — ㉠「★통일하라」 ㉡「★그 값으로」.
 *     ㉠은 ★✅ 였고 ㉡은 ★☐ 였다 ⇒ ★`t4-02` 를 ★★✅ → ★◑ 로 ★내렸다
 *     ＋ ★이름 `RADIAL-DOT-COLOR-VALUE-OFF-BY-ONE-01`
 *   ⇒ ★★그리고 ★★내가 ★못 골랐다 — ★현빈 ★오타일 수도 있었다(★1자 · 눈 구분 거의 안 됨).
 *   ⇒ ★★server-manager 가 전한 바에 따르면 ★현빈 답이 ★「너가 봐서 맞춰놔」였다
 *     ⇒ ★★요청값 `c9cdd6` 으로 ★맞춘다. ⛔내가 ★현빈 말을 ★직접 들은 것은 ★아니다(★relay).
 *
 * ★★이 파일이 ★잠그는 것 ★둘
 *   ⑴ ★값이 ★`#c9cdd6` 이다 (★고침 전엔 ★빨강)
 *   ⑵ ★★«한 자리»에서 ★파생된다 — ★점 색과 ★선 색이 ★★같다
 *      ⇒ ★★⑵ 가 ★★⑴ 을 ★지킨다 : ★한쪽만 고치면 ★⑵ 가 ★빨개진다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t4-02-radial-dot-color
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

const WANT = '#c9cdd6';

test('C0 ★★«한 자리»인가 — ★소스에 ★그 색 리터럴이 ★★한 번만 나온다', () => {
  /* ★★★261025 — ★★자를 ★좁혔다. ★첫 판은 ★파일 ★전체를 ★읽어 ★★내가 ★고침 주석에 적은
     ★옛 색(`#c8…`)까지 ★세어 ★`n: 2` 로 ★빨개졌다 — ★★「★주석이 ★소스 파싱 게이트의 ★입력」이
     ★★오늘 ★세 번째 겹이다. ⇒ ★★주석을 ★떼고 센다 ＋ ★제품 주석에서도 ★그 리터럴을 ★뺐다. */
  const raw = fs.readFileSync(path.join(ROOT, 'js/blocks/radial-block.js'), 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const hits = (src.match(/#c[89]cdd6/gi) || []);
  console.log('[C0]', JSON.stringify({ hits, n: hits.length }));
  /* ★★전제 — ★하나라도 ★있어야 한다(⛔0 이면 ★이름이 바뀌었다) */
  expect(hits.length, '★그 색 리터럴이 0개다 — RADIAL_DOT_COLOR 가 사라졌나').toBeGreaterThan(0);
  /* ★★★⑵ ★한 자리 — ★★여러 번 나오면 ★다시 갈릴 수 있다(소스 주석이 그걸 경고한다) */
  expect(hits.length, `★그 색이 ★여러 자리에 있다 (${JSON.stringify(hits)}) — 한 자리에서 파생해야 한다`).toBe(1);
  /* ★★★⑴ ★값 */
  expect(hits[0].toLowerCase(), `★값이 ${WANT} 가 아니다 (${hits[0]}) — t4-02`).toBe(WANT);
});

test('C1 ★★행위로 — ★방사형 ★점 색과 ★선 색이 ★★같고 ★그 값이다', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec) return { fail: '섹션이 없다' };
    window.selectSection(sec);
    if (typeof window.addRadialBlock !== 'function') return { fail: 'addRadialBlock 없음' };
    window.addRadialBlock();
    const b = sec.querySelector('.radial-block');
    if (!b) return { fail: '.radial-block 이 없다' };
    const line = b.querySelector('.rdl-line');
    const norm = (v) => {
      if (!v) return '(없음)';
      const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(v);
      if (!m) return String(v).toLowerCase();
      return '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('');
    };
    return {
      dotColor: (b.dataset.dotColor || '').toLowerCase() || '(없음)',
      lineColor: (b.dataset.lineColor || '').toLowerCase() || '(없음)',
      lineStroke: line ? norm(getComputedStyle(line).stroke) : '(선 없음)',
      hasLine: !!line,
    };
  });
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  console.log('[C1]', JSON.stringify(r));
  /* ★★전제 — ★선이 ★그려졌나(⛔없으면 아래 비교가 ★뜻을 잃는다) */
  expect(r.hasLine, '★.rdl-line 이 안 그려졌다 — 아래 색 비교가 뜻을 잃는다').toBe(true);
  /* ★★★점·선이 ★같다(한 자리 파생) ＋ ★그 값이다 */
  expect(r.lineColor, `★선 색이 점 색과 다르다 (dot ${r.dotColor} · line ${r.lineColor})`).toBe(r.dotColor);
  expect(r.dotColor, `★점 색이 ${WANT} 가 아니다 (${r.dotColor}) — t4-02`).toBe(WANT);
  expect(r.lineStroke, `★화면 stroke 가 ${WANT} 가 아니다 (${r.lineStroke})`).toBe(WANT);
});
