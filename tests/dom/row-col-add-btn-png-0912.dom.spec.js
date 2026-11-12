/* row-col-add-btn-png-0912.dom.spec.js — ROW-COL-ADD-BTN-IN-PNG-EXPORT-01 (미카사 t2-06 재채점 곁)
 * 옛 공용 템플릿 11개(templates/canvas · 예 tpl_1775031581782 「급하게 제품이 필요하신가요?」)에 «죽은» 열 추가 단추
 *   <button class="row-col-add-btn">(만드는 코드는 c8aff4a06 col 제거 때 사라짐)가 저장 HTML 째 박혀 있다.
 *   단독 HTML 은 export-html.js:112 가 걷는데 PNG·썸네일 공용 겹(capture-safety stripEditorOnlyForCapture)엔 없었다 → PNG 에 «+» 가 찍혔다.
 * 칸
 *   B1 실템플릿 HTML 을 그대로 얹기(insertTemplate 안 거침 — ㉯ 가 넣을 때 걷으므로) → 라이브엔 단추가 있다(전제) → PNG 클론(export-image prepareCloneForCapture) 안 .row-col-add-btn 0 · 글 블럭 수는 라이브와 같다(음성 — 콘텐츠는 남는다)
 * 양성대조: capture-safety.js 의 `clone.querySelectorAll('.row-col-add-btn')…remove()` 한 줄 지우면 B1 빨강(클론에 단추 ≥1).
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TPL_ID = 'tpl_1775031581782';
const TPL_HTML = fs.readFileSync(path.join(__dirname, '../../templates/canvas', TPL_ID + '.html'), 'utf8');
const SEC = '<div class="section-block" id="sB" data-section="1" data-name="옛템플릿"><div class="section-hitzone"></div><div class="section-inner">'
  + '<div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';

test('B1 옛 템플릿의 죽은 «열 추가» 단추는 PNG 클론에 0 · 글은 남는다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async ([html, sec]) => {
    /* ⛔insertTemplate 을 안 거친다 — LEGACY-TPL-REOPEN-LEAVES-EMPTY-ROWS-01 ㉯(wk/0912-legacy-tpl-empty-rows)가 넣는 순간 단추를 걷는다.
       ②는 «단추가 이미 캔버스에 있는» 꼴(㉯ 전에 넣고 아직 다시 안 연 프로젝트)의 안전망이라 템플릿 HTML 을 row 째 그대로 얹는다. */
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    const S = document.getElementById('sB');
    S.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="row" data-layout="stack">' + html + '</div>');
    window.applyZoom?.(100);
    window.deselectAll?.();
    const ex = await import('/js/io/export-image.js');
    const live = { btn: S.querySelectorAll('.row-col-add-btn').length, tb: S.querySelectorAll('.text-block').length };
    const clone = await ex.prepareCloneForCapture(S, 860, true);
    const out = { live, clone: { btn: clone.querySelectorAll('.row-col-add-btn').length, tb: clone.querySelectorAll('.text-block').length } };
    clone.remove();
    return out;
  }, [TPL_HTML, SEC]);
  console.log('RCAB0912 ' + JSON.stringify(r));
  expect(r.live.btn, '[전제] 넣은 템플릿에 죽은 단추가 라이브로 있다').toBeGreaterThan(0);
  expect(r.clone.btn, 'PNG 클론엔 0').toBe(0);
  expect(r.live.tb, '[전제] 글 블럭 있음').toBeGreaterThan(0);
  expect(r.clone.tb, '글 블럭은 그대로').toBe(r.live.tb);
  expect(errs).toEqual([]);
});
