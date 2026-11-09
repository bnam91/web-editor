/* export-empty-line-eelc.dom.spec.js — EXPORT-EMPTY-LINE-COLLAPSE-CMP-BUBBLE-01 (2026-11-09)
 *
 * ★증상 — 말풍선·챗의 «빈 줄»(.ln-row > .grd-line:empty)은 높이를 `#canvas .ln-row > .grd-line:empty::before` 안내문에서만 얻었다.
 *   내보내기 클론은 #canvas 밖(body)이라 그 줄이 0 으로 접혀 PNG 가 줄당 35.19px 짧았다
 *   (헤드리스 실측: 말풍선 119.19 → 84 · 챗 빈 줄 3개 309.56 → 204). 그리드(EXPORT-HEIGHT, exph 스펙)와 같은 기전.
 * ★비교·laurel·카드는 행/칸 높이가 고정이라 안 접혔다(같은 실측: 클론 = 화면) — 손대지 않았다.
 * ★고침 — css/editor-blocks.css 의 #canvas 밖 ZWSP 규칙 한 줄. 캔버스 안에선 #canvas 규칙이 특이도로 이긴다(E3).
 * ⛔앱 창 없음 — bootApp(헤드리스) 위에서 prepareCloneForCapture · renderComponentsInClone 을 «진짜로» 부른다.
 * 음성대조: css/editor-blocks.css 를 2f6efd4fe 판으로 되돌리면 E1 빨강, E2·E3 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB" style="background:#fff"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const ZWSP = JSON.stringify('​');

/** 빈 섹션에 kind 블럭 하나(모든 줄 = text) → 배율 100 정착 → 화면·클론 높이와 빈 줄 ::before 를 잰다. */
async function measure(page, kind, text) {
  return page.evaluate(async ([SEC, kind, text]) => {
    const ex = await import('/js/io/export-image.js');
    const L = [{ type: 'body', text }];
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', SEC);
    window.rebindAll?.(); window.applyZoom?.(100); window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    let b, ok;
    if (kind === 'bubble') {
      window.addSpeechBubbleBlock('left'); b = document.querySelector('#sB .speech-bubble-block');
      ok = window.updateSpeechBubbleBlockRaw(b.id, { lines: L }).ok;
    } else if (kind === 'chat') {
      window.addChatBlock(); b = document.querySelector('#sB .chat-block');
      const m = JSON.parse(b.dataset.messages); m.forEach(x => { x.lines = L; });
      ok = window.updateChatBlockRaw(b.id, { messages: m }).ok;
    } else {
      window.addComparisonBlock({ cols: [{ title: 'A', rows: [{ type: 'text', text: 'a' }] }, { title: 'B', rows: [{ type: 'text', text: 'b' }] }] });
      b = document.querySelector('#sB .comparison-block');
      const cols = window.getComparisonCols(b.dataset); cols.forEach(x => { x.rows[0].lines = L; x.rows[0].text = text; });
      b.dataset.cols = JSON.stringify(cols); window.renderComparison(b); ok = true;
    }
    window.deselectAll?.();
    const S = document.getElementById('canvas-scaler');
    const settled = () => !S.getAnimations().length && Math.abs(Number((/^matrix\(([^,]+),/.exec(getComputedStyle(S).transform) || [0, 1])[1]) - 1) < 1e-3;
    while (!settled()) await new Promise(r => requestAnimationFrame(r));
    const before = (root) => [...root.querySelectorAll('.ln-row > .grd-line:empty')].map(e => getComputedStyle(e, '::before').content);
    const sec = document.getElementById('sB');
    const liveH = sec.getBoundingClientRect().height;
    const liveBefore = before(sec);
    const clone = await ex.prepareCloneForCapture(sec, Math.round(sec.getBoundingClientRect().width), true);
    ex.renderComponentsInClone(clone);
    const r = { ok, liveH, cloneH: clone.getBoundingClientRect().height, liveBefore, cloneBefore: before(clone), cloneText: clone.innerText };
    clone.remove();
    return r;
  }, [SEC, kind, text]);
}

test.describe('EXPORT-EMPTY-LINE — 말풍선·챗 빈 줄이 내보내기에서 안 접힌다', () => {
  test('E1 ★말풍선·챗 빈 줄 — 클론 높이 = 화면 높이(±1) · 클론 안내문 = ZWSP 뿐', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1200 });
    const errs = await bootApp(page);
    for (const kind of ['bubble', 'chat']) {
      const r = await measure(page, kind, '');
      expect(r.ok, `${kind} 판 깔기`).toBe(true);
      expect(r.cloneBefore.length, `전제 — ${kind} 클론에 빈 줄이 있다`).toBeGreaterThan(0);
      expect(Math.abs(r.cloneH - r.liveH), `${kind}: 화면 ${r.liveH} ↔ 클론 ${r.cloneH}`).toBeLessThanOrEqual(1);
      expect(new Set(r.cloneBefore), `${kind}: 클론 빈 줄 ::before`).toEqual(new Set([ZWSP]));
      expect(r.cloneText).not.toContain('입력하세요');
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('E2 대조 — 글자 있는 말풍선·챗은 그대로(클론 = 화면, 빈 줄 0)', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1200 });
    const errs = await bootApp(page);
    for (const kind of ['bubble', 'chat']) {
      const r = await measure(page, kind, 'X');
      expect(r.ok).toBe(true);
      expect(r.cloneBefore, `${kind}: 빈 줄 없음`).toEqual([]);
      expect(Math.abs(r.cloneH - r.liveH), `${kind}: 화면 ${r.liveH} ↔ 클론 ${r.cloneH}`).toBeLessThanOrEqual(1);
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('E3 캔버스 안내문 무변 — #canvas 규칙이 ZWSP 규칙을 이긴다(말풍선·챗·비교)', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1200 });
    const errs = await bootApp(page);
    const want = { bubble: '말풍선 텍스트를 입력하세요', chat: '글자를 입력하세요', cmp: '내용을 입력하세요.' };
    for (const [kind, ph] of Object.entries(want)) {
      const r = await measure(page, kind, '');
      expect(r.liveBefore.length, `전제 — ${kind} 화면에 빈 줄`).toBeGreaterThan(0);
      expect(new Set(r.liveBefore), `${kind}: 캔버스 안내문`).toEqual(new Set([JSON.stringify(ph)]));
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
