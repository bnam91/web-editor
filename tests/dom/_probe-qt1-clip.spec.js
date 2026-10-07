/* _probe-qt1-clip.spec.js — ★QT1(인용구) P단계 probe ②. ⛔제품 코드 무변경. 측정 끝나면 ★지운다.
 * 묻는 것: ★자 ㉠(눌렸나)·㉡(쪼개졌나) 가 ★둘 다 0건인데도 ★단추가 ★잘려 있나?
 *   probe ① 실측: .prop-type-group 8단추 = 자연폭 174 · 남는 폭 155 · ㉠0건 ㉡0건.
 *   ⇒ min-width:max-content 라 ★안 눌리고, white-space:nowrap 이라 ★안 쪼개진다. 그래서 두 자가 ★못 본다.
 *   ⇒ ★자 ㉢ «잘렸나» = ⒜ 단추 오른끝 > 로우 내용 오른끝  ＋ ⒝ ★단추 가운데를 ★진짜로 집었을 때 그 단추가 ★잡히나
 *      (elementFromPoint — «보이나»가 아니라 «닿나»를 잰다. 부재는 ★행위/효과로.)
 * ★양성대조 꼴: 같은 자를 ★꼴 B(.prop-align-group wrap)에도 걸어 ★0건이 나와야 한다(자가 아무거나 빨갛게 하지 않음을 보인다).
 * ⚠️★실측 함정(2026-10-07) — #panel-right 의 .prop-row 는 18줄 중 ★6줄만 clientWidth 211 이고 ★12줄은 ★0 이다(숨은 줄).
 *   ⇒ ⛔첫 .prop-row 를 아무거나 집어 폭을 재지 마라 — ★0 을 재고 ★거짓 초록이 된다. ★211 인 줄을 골라라.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/_probe-qt1-clip.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SHAPES = ['“ ”', '« »', '『 』', '❝ ❞', '/ /', '[ ]', '( )', '〈 〉'];

async function scene(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll && window.rebindAll(); window.applyZoom && window.applyZoom(100);
    window.deselectAll && window.deselectAll(); window.selectSection(document.getElementById('sB'));
    window.addTextBlock('h2', { content: '인용구 probe' });
    window.__blk = [...document.querySelectorAll('#sB .text-block')].pop();
    window.buildLayerPanel && window.buildLayerPanel(); window.deselectAll && window.deselectAll();
    window.__blk && window.__blk.scrollIntoView({ block: 'center' });
  });
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 5000 });
  await page.evaluate(() => { window.__blk.querySelector('.tb-h2').dataset.pnl = '1'; });
  const r = await waitStableRect(page, '[data-pnl="1"]');
  await clickAt(page, r.cx, r.cy, { sel: '[data-pnl="1"]' }, { label: 'QT1 clip probe 고르기' });
  await page.waitForFunction(() => !!document.querySelector('#panel-right .prop-row'), null, { timeout: 5000 });
  return errs;
}

test('QT1-P5b ★자 ㉢ «잘렸나» — ㉠㉡ 이 0건인데도 단추가 잘려 안 닿는다', async ({ page }) => {
  const errs = await scene(page);

  const m = await page.evaluate((shapes) => {
    const host = document.querySelector('#panel-right .prop-row').parentElement;
    const mk = (groupCls, btnCls, tag) => {
      const row = document.createElement('div');
      row.className = 'prop-row'; row.dataset.probe = tag;
      row.innerHTML = '<span class="prop-label">모양</span><div class="' + groupCls + '" data-g="' + tag + '">'
        + shapes.map((s, i) => '<button type="button" class="' + btnCls + '" data-i="' + i + '">' + s + '</button>').join('') + '</div>';
      host.appendChild(row);
      return row;
    };
    /* ★자 ㉢ — ⒜ 기하(오른끝 넘었나) ＋ ⒝ 닿나(elementFromPoint) */
    const ruler3 = (row, tag) => {
      const grp = row.querySelector('[data-g="' + tag + '"]');
      const rr = row.getBoundingClientRect();
      /* 로우의 «내용» 오른끝 — padding 을 뺀다(.prop-row 는 padding 0 이지만 박지 않고 계산한다) */
      const cs = getComputedStyle(row);
      const contentRight = rr.right - parseFloat(cs.paddingRight || 0) - parseFloat(cs.borderRightWidth || 0);
      const out = [];
      for (const b of grp.children) {
        const bb = b.getBoundingClientRect();
        const cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        out.push({
          i: b.dataset.i, t: b.textContent.trim(),
          right: Math.round(bb.right), w: Math.round(bb.width),
          /* ⒜ 기하 — 오른끝이 로우 내용폭을 넘었나(넘은 px) */
          overBy: Math.round(bb.right - contentRight),
          /* ⒝ ★닿나 — 가운데를 집었을 때 ★그 단추(또는 그 자손)가 잡히나 */
          reachable: !!hit && (hit === b || b.contains(hit)),
          hitCls: hit ? (hit.className || hit.tagName) : null,
        });
      }
      return { tag: tag, rowW: row.clientWidth, contentRight: Math.round(contentRight),
        grpRight: Math.round(grp.getBoundingClientRect().right), btns: out };
    };
    const A = ruler3(mk('prop-type-group', 'prop-type-btn', 'A'), 'A');
    const B = ruler3(mk('prop-align-group', 'prop-align-btn', 'B'), 'B');
    return { A: A, B: B };
  }, SHAPES);

  for (const k of ['A', 'B']) {
    const r = m[k];
    const clipped = r.btns.filter(b => b.overBy > 0);
    const unreach = r.btns.filter(b => !b.reachable);
    console.log('★QT1-P5b ' + k + ' rowW=' + r.rowW + ' 내용오른끝=' + r.contentRight + ' 그룹오른끝=' + r.grpRight
      + ' ★넘은단추=' + clipped.length + JSON.stringify(clipped.map(b => b.t + ':+' + b.overBy))
      + ' ★안닿는단추=' + unreach.length + JSON.stringify(unreach.map(b => b.t + '→' + b.hitCls)));
    console.log('★QT1-P5b ' + k + ' 전수=' + JSON.stringify(r.btns));
  }

  /* ─ ★단언 — ㉢ 이 ★무엇을 잠그나 ─
     ★꼴 A(.prop-type-group 8단추) = ★잘린다  ⇒ 넘은 단추 ≥1  (★이 단언이 «빨강 기대»다 — 지금 판에서 참)
     ★꼴 B(.prop-align-group wrap) = ★안 잘린다 ⇒ 넘은 단추 0  (★음성대조 — 자가 아무거나 빨갛게 하지 않는다) */
  const aOver = m.A.btns.filter(b => b.overBy > 0);
  const bOver = m.B.btns.filter(b => b.overBy > 0);
  expect(aOver.length, '★꼴 A — 8단추 세그먼트가 211 줄에서 ★넘는다(≥1 이어야 ㉢ 이 뭔가를 재고 있다)').toBeGreaterThan(0);
  expect(bOver.length, '★음성대조 — 꼴 B(wrap)는 ★안 넘어야 한다. 넘으면 ㉢ 이 ★아무거나 빨갛게 하는 자다').toBe(0);

  console.log('★QT1-P5b pageerror=' + errs.length);
  expect(errs, '★앱이 오류 없이 떴다').toEqual([]);
});
