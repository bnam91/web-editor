/* _probe-qt1-quote-panel.spec.js — ★QT1(인용구) P단계 «재는 것만» 하는 probe. ⛔제품 코드를 안 바꾼다. 측정 끝나면 ★지운다.
 * 묻는 것: ❓⑸ 우측 패널 줄 폭이 ★몇이고, ★인용구 블럭 조절값 중 ★「모양 8종」 줄이 ★그 폭에서 ★읽히나.
 * 자 둘(정본 = tests/dom/pad-hint-bottom.dom.spec.js B6 · tests/dom/coupon-block.dom.spec.js:331):
 *   ㉠ «눌렸나» = 그룹의 ★자연폭(flex 를 잠깐 꺼서 내용이 요구하는 폭) vs 남는 폭
 *      ⛔row.scrollWidth 금지 — flex:1 이 남는 폭을 흡수해 ★항등식이 된다(2026-10-07 padviz 레인 실측)
 *   ㉡ «쪼개졌나» = ★«구별되는 y» 의 수 — 텍스트 노드에 Range 를 걸어 센다
 *      ⛔getClientRects().length 금지(글자 토막 수) · ⛔scrollWidth>clientWidth 금지(overflow:visible 이면 안 자란다)
 * 장면은 ★앱이 짓는 꼴로 — panel-shows-rendered.dom.spec.js setup 과 같은 길(섹션 고르기 → window.addTextBlock → 진짜 클릭).
 * ⚠️★실측 함정(2026-10-07) — #panel-right 의 .prop-row 는 18줄 중 ★6줄만 clientWidth 211 이고 ★12줄은 ★0 이다(숨은 줄).
 *   ⇒ ⛔첫 .prop-row 를 아무거나 집어 폭을 재지 마라 — ★0 을 재고 ★거짓 초록이 된다. ★211 인 줄을 골라라.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/_probe-qt1-quote-panel.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

/* 모양 8종 — 시안(goditor-quote-block.html)의 그 여덟이다. */
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
  /* 고르기 — 진짜 클릭으로 패널을 연다(사람이 하는 순서). */
  await page.evaluate(() => { window.__blk.querySelector('.tb-h2').dataset.pnl = '1'; });
  const r = await waitStableRect(page, '[data-pnl="1"]');
  await clickAt(page, r.cx, r.cy, { sel: '[data-pnl="1"]' }, { label: 'QT1 probe 고르기' });
  await page.waitForFunction(() => !!document.querySelector('#panel-right .prop-row'), null, { timeout: 5000 });
  return errs;
}

/* 페이지 안에서 돌 «자 한 벌» — 한 로우를 받아 ㉠㉡ 을 잰다. */
const RULERS = `(row, groupSel) => {
  const grp = row.querySelector(groupSel);
  const prev = grp.style.flex;
  grp.style.flex = '0 0 auto';
  const natural = Math.round(grp.getBoundingClientRect().width);
  grp.style.flex = prev;
  const texts = [];
  const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = (n.textContent || '').trim(); if (!t) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rects = [...rg.getClientRects()];
    texts.push({ t: t, lines: new Set(rects.map(x => Math.round(x.y))).size,
      w: rects.length ? Math.round(Math.max(...rects.map(x => x.width))) : 0,
      h: rects.length ? Math.round(Math.max(...rects.map(x => x.height))) : 0 });
  }
  const btns = [...grp.children].map(b => {
    const bb = b.getBoundingClientRect();
    const pf = b.style.flex; b.style.flex = '0 0 auto';
    const bn = Math.round(b.getBoundingClientRect().width); b.style.flex = pf;
    return { t: b.textContent.trim(), w: Math.round(bb.width), h: Math.round(bb.height), natural: bn };
  });
  const gb = grp.getBoundingClientRect();
  const lab = row.querySelector('.prop-label');
  return { rowW: row.clientWidth, labW: lab ? Math.round(lab.getBoundingClientRect().width) : 0,
    grpNatural: natural, grpNow: Math.round(gb.width), grpH: Math.round(gb.height),
    btnRows: new Set([...grp.children].map(b => Math.round(b.getBoundingClientRect().y))).size,
    btns: btns, texts: texts };
}`;

test('QT1-P5 ★우측 패널 줄 폭 실측 ＋ 모양 8종 줄이 그 폭에서 읽히나 (자 둘 · 세 꼴 비교)', async ({ page }) => {
  const errs = await scene(page);

  /* ─ ★전제 단언 — 장면이 틀어지면 이 줄이 먼저 빨개진다 ─ */
  const pre = await page.evaluate(() => ({
    panelW: Math.round(document.getElementById('panel-right').getBoundingClientRect().width),
    panelVar: getComputedStyle(document.body).getPropertyValue('--panel-right-w').trim(),
    realRows: document.querySelectorAll('#panel-right .prop-row').length,
    collapsed: document.body.classList.contains('right-panel-collapsed'),
  }));
  expect(pre.collapsed, '★전제 — 우측 패널이 접혀 있으면 폭이 0 이라 아무것도 안 잰다').toBe(false);
  expect(pre.panelW, `★전제 — 패널 폭 240 (실측 ${pre.panelW} · var=${pre.panelVar})`).toBe(240);
  expect(pre.realRows, '★전제 — 진짜 prop-row 가 떴다').toBeGreaterThan(0);

  /* ─ ⑴ ★진짜 prop-row 의 내용폭 = 지디가 말한 211 인가 ─ */
  const real = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#panel-right .prop-row')];
    const ws = rows.map(r => r.clientWidth);
    const cnt = {}; ws.forEach(v => { cnt[v] = (cnt[v] || 0) + 1; });
    return { n: rows.length, distinct: [...new Set(ws)].sort((a, b) => a - b), hist: cnt };
  });
  console.log('★QT1-P5 ⑴ 패널=' + JSON.stringify(pre) + ' 진짜prop-row내용폭=' + JSON.stringify(real));

  /* ─ ⑵ ★모양 8종 줄을 ★진짜 패널 안에 ★주입해 잰다 ─ */
  const measured = await page.evaluate(([shapes, rulersSrc]) => {
    const rulers = eval(rulersSrc);
    const host = document.querySelector('#panel-right .prop-row').parentElement;
    const mk = (groupCls, btnCls, n) => {
      const row = document.createElement('div');
      row.className = 'prop-row'; row.dataset.probe = groupCls + n;
      row.innerHTML = '<span class="prop-label">모양</span><div class="' + groupCls + '">'
        + shapes.slice(0, n).map(s => '<button type="button" class="' + btnCls + '">' + s + '</button>').join('') + '</div>';
      host.appendChild(row);
      return row;
    };
    const out = {};
    out.A_typeGroup8 = rulers(mk('prop-type-group', 'prop-type-btn', 8), '.prop-type-group');
    out.B_alignGroup8 = rulers(mk('prop-align-group', 'prop-align-btn', 8), '.prop-align-group');
    out.C_typeGroup4 = rulers(mk('prop-type-group', 'prop-type-btn', 4), '.prop-type-group');
    return out;
  }, [SHAPES, RULERS]);

  for (const k of Object.keys(measured)) console.log('★QT1-P5 ⑵ ' + k + '=' + JSON.stringify(measured[k]));

  const split = Object.keys(measured).map(k => [k, measured[k].texts.filter(t => t.lines > 1).map(t => t.t + ':' + t.lines)]);
  console.log('★QT1-P5 ㉡ 쪼개진글자=' + JSON.stringify(split));
  const squeezed = Object.keys(measured).map(k => [k, measured[k].btns.filter(b => b.w < b.natural).map(b => b.t + ':' + b.w + '/' + b.natural)]);
  console.log('★QT1-P5 ㉠ 눌린단추=' + JSON.stringify(squeezed));
  const over = Object.keys(measured).map(k => [k, measured[k].grpNatural, measured[k].grpNow, measured[k].rowW - measured[k].labW, measured[k].btnRows]);
  console.log('★QT1-P5 요약 [꼴,자연폭,실폭,남는폭,단추줄수]=' + JSON.stringify(over));

  console.log('★QT1-P5 pageerror=' + errs.length + ' ' + JSON.stringify(errs.slice(0, 3)));
  expect(errs, '★앱이 오류 없이 떴다').toEqual([]);
});
