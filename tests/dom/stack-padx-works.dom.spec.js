/* stack-padx-works.dom.spec.js — ①-가 ★스택 프레임의 ★좌우 패딩이 ★«먹는다» (현빈 2026-10-11)
 * ★현빈: 「프레임 안에서 ★스택모드 일때 프레임블럭 안에서 ★좌우패딩이 ★먹히게 바란거였거든?」
 *
 * ★★식 = ★★비율 — `w = round(stackW × (frameW − 2·pad) / frameW)` (★2026-10-11 지디 판정)
 *   ⛔«계수 1»(틈이 pad 만큼 정확히)은 ★★요구가 ★아니었고 ★★구조적으로 ★불가능하다(`stackW < 2·pad` 에서 깨진다).
 *   ★그 식에서는 ★도형 기본 100px 자식이 ★pad 48 ⇒ 4px, ★pad 50 ⇒ ★★760px 로 ★«튀었다»(실측).
 *
 * ★★자 — ⛔`offsetLeft` 아님. ★`offsetParent`(=row) 기준이라 ★프레임 패딩이 ★영영 안 보인다(첫 회차에 그걸로 틀렸다).
 *   ⇒ ★`getBoundingClientRect` 의 ★«프레임 기준 틈» ÷ 배율.
 * ★★단언 셋(지디 측정 조건):
 *   ⒜ ★pad 0 에서 ★★변환 직후와 ★같다(★기존 문서 무변) ⇐ ★주 단언
 *   ⒝ ★★폭이 ★단조 ★감소 — ★★«늘어나는 칸이 0개»  ⇐ ★«튐 없음»의 자
 *   ⒞ ★틈이 ★단조 ★증가 ＋ ★★식과 맞다(`틈 = pad + (안쪽폭 − w)/2`)
 * ★★분모의 출처: ★내가 고른 ★6종을 ★«호출 자리의 인자»로 넣었고(⛔`fn({})` 아님 — 서명이 다른 둘이 있다),
 *   ★그중 ★변환이 ★세는 것(= `prop-frame.js:69` 의 ★«position:absolute ＋ id» ★꼴)이 ★★5개,
 *   ★그중 ★`it.width < parentW` 로 ★★보존되는(stackW 박히는) 것이 ★★4개(grid 688·★글자틀 339·shape 100·canvas 360)다.
 *   ★★그 수가 ★★한 번 ★움직였다 — ★★3 → ★★4. ★까닭은 ★★같은 브랜치의 ★①-나 다:
 *     ★①-나 ★전에는 ★글자틀이 ★`width:100%` 라 ★`it.width < parentW` 가 ★거짓이어서 ★안 박혔고(보존 3칸),
 *     ★①-나 로 ★자유배치 ★«추가» 글자가 ★★«글자 길이 폭»(실측 339px)이 되자 ★★보존 쪽으로 ★넘어왔다.
 *   ⇒ ★★★그래서 ★이 수는 ★★«다른 커밋이 ★바꿀 수 있는 수»다. ★그래서 ★전제로 ★단언하고 ★로그에 ★찍는다.
 *   ★chat·quote 는 ★absolute 가 ★아니라 ★안 센다
 *   ⇒ ★★그 셋은 ★★«무회귀»로 ★찍는다(틈 == pad).  ⛔종 «이름»으로 세지 않았다 — ★꼴로 셌다.
 * ★누름 꼴: `#ss-to-stack-btn`·정렬 단추 = ★진짜 `page.click` · 패딩·너비 = ★`page.fill`(number 의 input 을 bindSlider 가 듣는다)
 *   ⛔`dispatchEvent` 0건
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★인자는 ★호출 자리에서 끌었다: `ai-section-fill.js:448` `addTextBlock(styleType,{content})` · `goditor-api.js:81` `'body'` */
const KINDS = [
  ['addGridBlock', [{}]],
  ['addTextBlock', ['body', {}]],
  ['addShapeBlock', ['rectangle']],
  ['addChatBlock', [{}]],
  ['addCanvasBlock', [{}]],
  ['addQuoteBlock', [{}]],
];

const READ = `(() => {
  const F = document.getElementById('sF');
  const fr = F.getBoundingClientRect();
  const z = F.offsetWidth ? fr.width / F.offsetWidth : 1;
  const cs = getComputedStyle(F);
  const pad = parseFloat(cs.paddingLeft) || 0;
  const frameW = parseInt(F.style.width) || F.offsetWidth || 0;
  const ids = ['ss-align-left', 'ss-align-hcenter', 'ss-align-right'];
  return {
    pad, frameW, inner: frameW - 2 * pad,
    alignOn: ids.filter((i) => document.getElementById(i)?.classList.contains('active')).join(',') || '(0개)',
    rows: [...F.children].map((r, i) => {
      const rr = r.getBoundingClientRect();
      return {
        i, id: r.id || '(무명)', cls: (r.className || '').split(' ')[0],
        gapL: Math.round((rr.left - fr.left) / z), gapR: Math.round((fr.right - rr.right) / z),
        w: Math.round(rr.width / z), inlineW: r.style.width || '(빈칸)',
        stackW: r.dataset.stackW ?? null, alignSelf: getComputedStyle(r).alignSelf,
      };
    }),
  };
})`;

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sS"><div class="section-hitzone"></div>' +
      '<div class="section-inner" id="sS-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    window.state.pageSettings.padX = 0; window.applyPageSettings();
    const S = document.getElementById('sS');
    window.selectSection(S); window.addFrameBlock();
    const F = [...S.querySelectorAll('.frame-block:not([data-text-frame])')].pop();
    F.id = 'sF'; F.style.height = '1000px';
  });
  /* ★그릇을 정하는 자는 `window._activeFrame` 이고 ★놓는 자는 ★클릭이다(`block-drag.js:133`).
     ⛔`selectSection` 은 그걸 안 놓는다 — 첫 회차에 그래서 다섯 종이 「안 들어갔다」로 보였다. */
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
  const active = await page.evaluate(() => window._activeFrame?.id || '(없다)');
  expect(active, '전제: 클릭이 _activeFrame 을 이 프레임으로 놓았다').toBe('sF');
  const added = await page.evaluate((KINDS) => {
    const F = document.getElementById('sF');
    const out = [];
    KINDS.forEach(([k, args], i) => {
      const before = new Set([...F.children]);
      window._activeFrame = F;
      try { window[k]?.(...args); } catch (e) { out.push({ k, err: String(e && e.message || e) }); return; }
      const now = [...F.children].filter(x => !before.has(x));
      if (!now.length) { out.push({ k, err: '(자식이 안 늘었다)' }); return; }
      const el = now[now.length - 1];
      if (!el.id) el.id = 'auto' + i;
      el.style.top = (20 + i * 150) + 'px';     /* ★행을 가른다 — 끌어 옮기기는 사람이 하는 짓이고 폭을 안 바꾼다 */
      out.push({ k, id: el.id, abs: el.style.position === 'absolute', w: el.offsetWidth });
    });
    return out;
  }, KINDS);
  for (const a of added) console.log(`   ${a.err ? '⛔' : '✅'} ${a.k} ${a.err || `id=${a.id} absolute=${a.abs} 폭=${a.w}`}`);
  const okN = added.filter(a => !a.err).length;
  const absN = added.filter(a => a.abs).length;
  console.log(`[분모] 들어간 ${okN}/${KINDS.length} · 그중 absolute(=변환이 세는 꼴) ${absN}`);
  expect(okN, '전제: 고른 여섯이 다 들어갔다(인자를 호출 자리에서 끌었다)').toBe(KINDS.length);
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });   /* ★패널을 프레임으로 되돌린다 */
  await page.click('#ss-to-stack-btn', { timeout: 2500 });
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
  const pre = await page.evaluate(eval(READ));
  const kept = pre.rows.filter(r => r.stackW !== null);
  console.log(`[전제] frameW=${pre.frameW} pad=${pre.pad} · 자식 ${pre.rows.length} · ★보존(stackW 박힘) ${kept.length}칸: ${kept.map(r => `${r.cls}/${r.stackW}`).join(' · ')}`);
  expect(pre.pad, '전제: 패딩은 0 에서 시작').toBe(0);
  /* ★★이 수는 ★«다른 커밋이 바꿀 수 있는 수»다(머리말의 3→4 까닭) ⇒ ★★전제로 ★박아 ★바뀌면 ★★여기서 ★멈추게 한다 */
  expect(kept.length, `전제: 보존되는 자식이 4칸이다(grid·글자틀·shape·canvas) — 잰 값 ${kept.length}: ${kept.map(r => `${r.cls}/${r.stackW}`).join(',')}`).toBe(4);
  return { errs, pre };
}
const setPad = (page, v) => page.fill('#ss-padx-num', String(v), { timeout: 2000 });

test('P1 ★★비율 — ⒜pad0 무변 ＋ ⒝폭 단조감소(늘어난 칸 0) ＋ ⒞틈 단조증가·식 일치', async ({ page }) => {
  const { errs, pre } = await scene(page);
  const base = new Map(pre.rows.map(r => [r.id, r]));
  const seen = [];
  for (let pad = 0; pad <= 100; pad += 2) {
    await setPad(page, pad);
    const s = await page.evaluate(eval(READ));
    expect(s.pad, `전제: 패딩칸이 ${pad} 로 섰다`).toBe(pad);
    seen.push(s);
  }
  const dump = (s) => s.rows.filter(r => r.stackW !== null).map(r => `${r.cls}(sw${r.stackW}) w${r.w} 틈${r.gapL}`).join(' | ');
  for (const pad of [0, 24, 48, 50, 100]) {
    const s = seen.find(x => x.pad === pad);
    console.log(`[P1] pad=${String(pad).padStart(3)} 안쪽 ${s.inner} ⇒ ${dump(s)} | 정렬=${s.alignOn}`);
  }
  /* ★★⒜ pad 0 — ★변환 직후와 ★같다(★모든 자식) */
  const z = seen[0];
  for (const r of z.rows) {
    const b = base.get(r.id);
    expect(r.w, `pad 0: ${r.cls} 폭이 변환 직후와 같다(${b.w})`).toBe(b.w);
    expect(r.gapL, `pad 0: ${r.cls} 틈이 변환 직후와 같다(${b.gapL})`).toBe(b.gapL);
  }
  /* ★★⒝ 폭이 ★늘어난 칸 = ★0개 (⛔«튐 없음»을 ★수로) */
  const grew = [];
  const gapShrank = [];
  for (let i = 1; i < seen.length; i++) {
    for (const r of seen[i].rows.filter(x => x.stackW !== null)) {
      const p = seen[i - 1].rows.find(x => x.id === r.id);
      if (r.w > p.w) grew.push(`${r.cls} pad ${seen[i - 1].pad}→${seen[i].pad}: 폭 ${p.w}→${r.w}`);
      if (r.gapL < p.gapL) gapShrank.push(`${r.cls} pad ${seen[i - 1].pad}→${seen[i].pad}: 틈 ${p.gapL}→${r.gapL}`);
    }
  }
  const keptN = seen[0].rows.filter(r => r.stackW !== null).length;
  console.log(`[P1 ⒝] 걸음 ${seen.length - 1}번 × 보존 ${keptN}칸 = ${(seen.length - 1) * keptN} 쌍 ⇒ ★폭이 늘어난 칸 ${grew.length}개 · ★틈이 줄어든 칸 ${gapShrank.length}개`);
  expect(grew, `폭이 늘어난 칸이 있다(튐): ${grew.slice(0, 3).join(' / ')}`).toEqual([]);
  /* ★★⒞ 틈이 ★단조 증가 ＋ ★식과 맞다 */
  expect(gapShrank, `틈이 줄어든 칸이 있다: ${gapShrank.slice(0, 3).join(' / ')}`).toEqual([]);
  const offBy = [];
  for (const s of seen) {
    for (const r of s.rows.filter(x => x.stackW !== null)) {
      const want = s.pad + (s.inner - r.w) / 2;
      if (Math.abs(r.gapL - want) > 1) offBy.push(`${r.cls} pad ${s.pad}: 틈 ${r.gapL} ≠ 식 ${want.toFixed(1)}`);
    }
  }
  console.log(`[P1 ⒞] 식(틈 = pad + (안쪽폭 − w)/2)과 어긋난 칸 ${offBy.length}개`);
  expect(offBy, offBy.slice(0, 3).join(' / ')).toEqual([]);
  /* ★★패딩이 ★실제로 ★먹는다 — ★보존 3칸 ★전부 ★틈이 ★늘었다(⛔«단조»만이면 ★«전부 그대로»도 통과한다) */
  const moved = z.rows.filter(r => r.stackW !== null).map(r => {
    const last = seen[seen.length - 1].rows.find(x => x.id === r.id);
    return { cls: r.cls, d: last.gapL - r.gapL };
  });
  console.log(`[P1] pad 0→100 에서 ★틈이 움직인 양(보존 ${keptN}칸): ${moved.map(m => `${m.cls} ＋${m.d}`).join(' · ')}`);
  for (const m of moved) expect(m.d, `${m.cls}: pad 100 에서 틈이 늘어야 한다(움직인 양 ${m.d})`).toBeGreaterThan(0);
  expect(moved.length, '움직임을 잰 칸이 보존 칸 수와 같다').toBe(keptN);
  /* ★음성대조 ⑴ — ★정렬 판정이 ★안 바뀐다 */
  for (const s of seen) expect(s.alignOn, `pad=${s.pad}: 정렬 켜짐이 hcenter 그대로`).toBe('ss-align-hcenter');
  /* ★음성대조 ⑵ — ★대칭 */
  for (const s of seen) for (const r of s.rows.filter(x => x.stackW !== null)) {
    expect(Math.abs(r.gapL - r.gapR), `pad=${s.pad} ${r.cls}: 좌우 틈 L${r.gapL}/R${r.gapR}`).toBeLessThanOrEqual(1);
  }
  /* ★★음성대조 ⑶ — ★★«stackW 가 안 박히는» 셋은 ★무회귀: ★틈 == pad */
  const free = z.rows.filter(r => r.stackW === null);
  console.log(`[P1 무회귀] stackW 안 박힌 ${free.length}칸: ${free.map(r => r.cls).join(' · ')}`);
  expect(free.length, '전제: 안 박히는 자식이 있다(글자틀·chat·quote·gap)').toBeGreaterThan(0);
  for (const s of seen) for (const r of s.rows.filter(x => x.stackW === null)) {
    expect(r.gapL, `pad=${s.pad} ${r.cls}(안 박힘): 틈이 pad 그대로여야 한다`).toBe(s.pad);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 ★★경계 — ★«안쪽 폭 ≤ 0»은 ★★사람 경로로 ★닿는다(너비 슬라이더 하한 ＋ 패딩 상한)', async ({ page }) => {
  const { pre } = await scene(page);
  /* ★★두 칸의 ★범위를 ★먼저 ★잰다 — ⛔«못 닿는다»를 ★추정하지 않는다(어제 그래서 틀렸다) */
  const lim = await page.evaluate(() => {
    const w = document.getElementById('ss-width-num'), p = document.getElementById('ss-padx-num');
    return { wMin: Number(w.min), wMax: Number(w.max), pMin: Number(p.min), pMax: Number(p.max) };
  });
  console.log(`[P2 전제] 너비칸 min=${lim.wMin} max=${lim.wMax} · 패딩칸 min=${lim.pMin} max=${lim.pMax}`
    + ` ⇒ ★안쪽 폭 최솟값 = ${lim.wMin} − 2×${lim.pMax} = ${lim.wMin - 2 * lim.pMax}`);
  expect(lim.wMin - 2 * lim.pMax, '전제: 두 칸의 끝값만으로 안쪽 폭이 0 이하가 된다(=사람 경로로 닿는다)').toBeLessThanOrEqual(0);
  /* ★★사람 경로 ★둘 — ★너비를 ★하한으로, ★패딩을 ★상한으로 */
  await page.fill('#ss-width-num', String(lim.wMin), { timeout: 2000 });
  await setPad(page, lim.pMax);
  const s = await page.evaluate(eval(READ));
  const kept = s.rows.filter(r => r.stackW !== null);
  console.log(`[P2] 너비 ${s.frameW} · pad ${s.pad} ⇒ ★안쪽 ${s.inner} ⇒ ${kept.map(r => `${r.cls}(sw${r.stackW}) inlineW=${r.inlineW}`).join(' | ')}`);
  expect(s.inner, '전제: 안쪽 폭이 0 이하다').toBeLessThanOrEqual(0);
  expect(kept.length, `전제: 보존 칸이 그대로다 — 잰 값 ${kept.length}`).toBe(4);
  for (const r of kept) expect(r.inlineW, `${r.cls}: 안쪽 폭이 0 이하면 보존을 포기한다(빈 값)`).toBe('(빈칸)');
  /* ★★그리고 ★되돌리면 ★살아난다 — ★`stackW`(뜻)는 ★안 지워졌다 */
  await setPad(page, 0);
  await page.fill('#ss-width-num', String(pre.frameW), { timeout: 2000 });
  const back = await page.evaluate(eval(READ));
  console.log(`[P2 ★되돌림] 너비 ${back.frameW} pad ${back.pad} ⇒ ${back.rows.filter(r => r.stackW !== null).map(r => `${r.cls} w${r.w}`).join(' | ')}`);
  for (const r of back.rows.filter(x => x.stackW !== null)) {
    const b = pre.rows.find(x => x.id === r.id);
    expect(r.w, `되돌리면 ${r.cls} 폭이 돌아온다(${b.w})`).toBe(b.w);
  }
});
