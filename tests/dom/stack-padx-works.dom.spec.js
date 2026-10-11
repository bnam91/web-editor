/* stack-padx-works.dom.spec.js — ①-가 ★스택 프레임의 ★좌우 패딩이 ★«먹는다» (현빈 2026-10-11)
 * ★현빈: 「프레임 안에서 ★스택모드 일때 프레임블럭 안에서 ★좌우패딩이 ★먹히게 바란거였거든?」
 *
 * ★★식 = ★★클램프 — `w = min( max(stackW − 2·pad, 하한), ★안쪽폭 )` · ★하한 = `minVisibleWidth`(prop-frame.js)
 *   ★그 식을 ★고른 ★까닭과 ★버린 둘(★계수 1 · ★비율)의 ★수는 ★그 함수 ★머리말에 있다. ⛔여기 베껴 두지 않는다(두 명부).
 *
 * ★★자 — ⛔`offsetLeft` 아님. ★`offsetParent`(=row) 기준이라 ★프레임 패딩이 ★영영 안 보인다(첫 회차에 그걸로 틀렸다).
 *   ⇒ ★`getBoundingClientRect` 의 ★«프레임 기준 틈» ÷ 배율.
 * ★★이 처방이 ★덮는 분모 — ★«꼴»로 셌다(⛔종 이름이 아니라 `prop-frame.js:69` 의 ★«position:absolute ＋ id»):
 *   ★고른 ★6종을 ★«호출 자리의 인자»로 넣는다(⛔`fn({})` 아님 — `addTextBlock(type,opts)`·`addShapeBlock(type)` 서명이 다르다)
 *   ⇒ ★6/6 들어가고 · ★absolute ★4 · ★★`stackW` 가 박히는(=이 처방이 덮는) ★★4칸: grid 688 · 글자틀 339 · 도형 100 · 캔버스 360
 *   ⇒ ★그중 ★★하한에 ★닿는 칸 ★★3(도형 1 · ★비도형 2) — ★명부는 P3 에 있다
 *   ⚠️그 수가 ★3 → ★4 로 ★움직였다. 까닭은 ★같은 브랜치의 ★①-나 — 자유배치 «추가» 글자가 `width:100%` 에서
 *     «글자 길이 폭»(339px)이 되자 `it.width < parentW` 가 참이 되어 ★보존 쪽으로 넘어왔다.
 *     ⇒ ★★«다른 커밋이 ★바꿀 수 있는 수»다 ⇒ ★전제로 단언하고 ★로그에 찍는다.
 * ★누름 꼴: `#ss-to-stack-btn`·정렬 단추 = ★진짜 `page.click` · 패딩·너비 = ★`page.fill`(number 의 input 을 bindSlider 가 듣는다)
 *   ⛔`dispatchEvent` 0건. ★★드릴인 — 프레임이 ★이미 selected 면 ★다음 클릭이 ★«자식»을 고른다(`css/editor-blocks.css:235`)
 *   ⇒ ★`deselectAll` 뒤에 ★한 번 클릭해야 ★프레임 패널이 뜬다(★그래서 ★한 회차를 ★날렸다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

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
  const pad = parseFloat(getComputedStyle(F).paddingLeft) || 0;
  const frameW = parseInt(F.style.width) || F.offsetWidth || 0;
  const ids = ['ss-align-left', 'ss-align-hcenter', 'ss-align-right'];
  return {
    pad, frameW, inner: frameW - 2 * pad, ovf: getComputedStyle(F).overflowX,
    alignOn: ids.filter((i) => document.getElementById(i)?.classList.contains('active')).join(',') || '(0개)',
    rows: [...F.children].map((r, i) => {
      const rr = r.getBoundingClientRect();
      return {
        i, id: r.id || '(무명)', cls: (r.className || '').split(' ')[0],
        gapL: Math.round((rr.left - fr.left) / z), gapR: Math.round((fr.right - rr.right) / z),
        w: Math.round(rr.width / z), inlineW: r.style.width || '(빈칸)',
        stackW: r.dataset.stackW ?? null, alignSelf: getComputedStyle(r).alignSelf,
        outL: Math.round((fr.left - rr.left) / z), outR: Math.round((rr.right - fr.right) / z),
      };
    }),
  };
})`;

/** ★프레임을 ★한 번만 ★고른다 — ★드릴인을 ★피한다 */
async function pickFrame(page) {
  await page.evaluate(() => window.deselectAll?.());
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
}

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
  await pickFrame(page);
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
      out.push({ k, id: el.id, abs: el.style.position === 'absolute', w: el.offsetWidth, shape: !!el.querySelector(':scope > .shape-block') });
    });
    return out;
  }, KINDS);
  for (const a of added) console.log(`   ${a.err ? '⛔' : '✅'} ${a.k} ${a.err || `id=${a.id} absolute=${a.abs} 폭=${a.w}${a.shape ? ' ★도형' : ''}`}`);
  expect(added.filter(a => !a.err).length, '전제: 고른 여섯이 다 들어갔다(인자를 호출 자리에서 끌었다)').toBe(KINDS.length);
  await pickFrame(page);
  await page.click('#ss-to-stack-btn', { timeout: 2500 });
  await pickFrame(page);
  const pre = await page.evaluate(eval(READ));
  const kept = pre.rows.filter(r => r.stackW !== null);
  console.log(`[전제] frameW=${pre.frameW} pad=${pre.pad} overflowX=${pre.ovf} · 자식 ${pre.rows.length} · ★이 처방이 덮는 ${kept.length}칸: ${kept.map(r => `${r.cls}/${r.stackW}`).join(' · ')}`);
  expect(pre.pad, '전제: 패딩은 0 에서 시작').toBe(0);
  /* ★★이 수는 ★«다른 커밋이 바꿀 수 있는 수»다(머리말의 3→4 까닭) ⇒ ★전제로 박아 ★바뀌면 ★여기서 ★멈추게 한다 */
  expect(kept.length, `전제: 덮는 자식이 4칸이다 — 잰 값 ${kept.length}: ${kept.map(r => `${r.cls}/${r.stackW}`).join(',')}`).toBe(4);
  const widthNum = await page.locator('#ss-width-num').count();
  expect(widthNum, '전제: 프레임 패널이 떴다(너비칸 있다)').toBe(1);
  return { errs, pre };
}
const setPad = (page, v) => page.fill('#ss-padx-num', String(v), { timeout: 2000 });
const setW = (page, v) => page.fill('#ss-width-num', String(v), { timeout: 2000 });

test('P1 ⒜pad0 무변 ＋ ⒝폭 단조감소(늘어난 칸 0) ＋ ⒞틈 단조증가·식 일치 ＋ ★실제로 먹는다', async ({ page }) => {
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
  const keptN = seen[0].rows.filter(r => r.stackW !== null).length;
  /* ★★⒜ pad 0 — ★변환 직후와 ★같다(★모든 자식) */
  for (const r of seen[0].rows) {
    const b = base.get(r.id);
    expect(r.w, `pad 0: ${r.cls} 폭이 변환 직후와 같다(${b.w})`).toBe(b.w);
    expect(r.gapL, `pad 0: ${r.cls} 틈이 변환 직후와 같다(${b.gapL})`).toBe(b.gapL);
  }
  /* ★★⒝ 폭이 ★늘어난 칸 = ★0개 (⛔«튐 없음»을 ★수로) ＋ ★★⒞ 틈이 ★줄어든 칸 = ★0개 */
  const grew = [], gapShrank = [];
  for (let i = 1; i < seen.length; i++) {
    for (const r of seen[i].rows.filter(x => x.stackW !== null)) {
      const p = seen[i - 1].rows.find(x => x.id === r.id);
      if (r.w > p.w) grew.push(`${r.cls} pad ${seen[i - 1].pad}→${seen[i].pad}: 폭 ${p.w}→${r.w}`);
      if (r.gapL < p.gapL) gapShrank.push(`${r.cls} pad ${seen[i - 1].pad}→${seen[i].pad}: 틈 ${p.gapL}→${r.gapL}`);
    }
  }
  console.log(`[P1 ⒝] 걸음 ${seen.length - 1}번 × 덮는 ${keptN}칸 = ${(seen.length - 1) * keptN} 쌍 ⇒ ★폭이 늘어난 칸 ${grew.length}개 · ★틈이 줄어든 칸 ${gapShrank.length}개`);
  expect(grew, `폭이 늘어난 칸이 있다(튐): ${grew.slice(0, 3).join(' / ')}`).toEqual([]);
  expect(gapShrank, `틈이 줄어든 칸이 있다: ${gapShrank.slice(0, 3).join(' / ')}`).toEqual([]);
  /* ★★⒞ 식과 맞다 */
  const offBy = [];
  for (const s of seen) for (const r of s.rows.filter(x => x.stackW !== null)) {
    const want = s.pad + (s.inner - r.w) / 2;
    if (Math.abs(r.gapL - want) > 1) offBy.push(`${r.cls} pad ${s.pad}: 틈 ${r.gapL} ≠ 식 ${want.toFixed(1)}`);
  }
  console.log(`[P1 ⒞] 식(틈 = pad + (안쪽폭 − w)/2)과 어긋난 칸 ${offBy.length}개`);
  expect(offBy, offBy.slice(0, 3).join(' / ')).toEqual([]);
  /* ★★«실제로 먹는다» — ⛔«단조»만 걸면 ★«전부 그대로»도 ★통과한다 */
  const moved = seen[0].rows.filter(r => r.stackW !== null).map(r => {
    const last = seen[seen.length - 1].rows.find(x => x.id === r.id);
    return { cls: r.cls, d: last.gapL - r.gapL };
  });
  console.log(`[P1] pad 0→100 에서 ★틈이 움직인 양(덮는 ${keptN}칸): ${moved.map(m => `${m.cls} ＋${m.d}`).join(' · ')}`);
  for (const m of moved) expect(m.d, `${m.cls}: pad 100 에서 틈이 늘어야 한다(움직인 양 ${m.d})`).toBeGreaterThan(0);
  expect(moved.length, '움직임을 잰 칸이 덮는 칸 수와 같다').toBe(keptN);
  /* ★음성대조 — 정렬 판정 · 대칭 · ★«stackW 가 안 박히는» 자식의 ★무회귀(틈 == pad) */
  for (const s of seen) {
    expect(s.alignOn, `pad=${s.pad}: 정렬 켜짐이 hcenter 그대로`).toBe('ss-align-hcenter');
    for (const r of s.rows.filter(x => x.stackW !== null)) {
      expect(Math.abs(r.gapL - r.gapR), `pad=${s.pad} ${r.cls}: 좌우 틈 L${r.gapL}/R${r.gapR}`).toBeLessThanOrEqual(1);
    }
    for (const r of s.rows.filter(x => x.stackW === null)) {
      expect(r.gapL, `pad=${s.pad} ${r.cls}(안 박힘): 틈이 pad 그대로여야 한다`).toBe(s.pad);
    }
  }
  const free = seen[0].rows.filter(r => r.stackW === null);
  console.log(`[P1 무회귀] stackW 안 박힌 ${free.length}칸: ${free.map(r => r.cls).join(' · ')} — 모든 pad 에서 틈 == pad`);
  expect(free.length, '전제: 안 박히는 자식이 있다(chat row·quote·gap)').toBeGreaterThan(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 ★경계 — ★«안쪽 폭 ≤ 0»은 ★★사람 경로로 ★닿는다(너비 하한 ＋ 패딩 상한)', async ({ page }) => {
  const { pre } = await scene(page);
  /* ★★★정정(2026-10-11) — ★앞 판에 ★내가 ★「패딩칸 상한이 100 이라 ★사람이 ★이 경계에 ★닿을 수 없다」라 ★적었다.
     ★★★거짓이었다. ★그 문장은 ★`stackW > 200` 인 자식에서만 ★참이고, ★도형 기본 ★100px 은 ★pad 48 에서 ★닿았다.
     ★★그리고 ★«안쪽 폭 ≤ 0» 자체도 ★★두 조종칸의 ★끝값만으로 ★닿는다(아래 ★실측).
     ⇒ ★반증한 자 = ★t3frame(★나) · ★2026-10-11 · ★까닭 = ★부등식의 ★«다른 변»(자식 폭·프레임 폭)을 ★안 쟀다.
     ⇒ ★꼴: ★★«닿나»를 물을 땐 ★★두 변의 ★«조종칸 범위»를 ★먼저 ★읽어라. */
  const lim = await page.evaluate(() => {
    const w = document.getElementById('ss-width-num'), p = document.getElementById('ss-padx-num');
    return { wMin: Number(w.min), wMax: Number(w.max), pMin: Number(p.min), pMax: Number(p.max) };
  });
  console.log(`[P2 전제] 너비칸 min=${lim.wMin} max=${lim.wMax} · 패딩칸 min=${lim.pMin} max=${lim.pMax}`
    + ` ⇒ ★안쪽 폭 최솟값 = ${lim.wMin} − 2×${lim.pMax} = ${lim.wMin - 2 * lim.pMax}`);
  expect(lim.wMin - 2 * lim.pMax, '전제: 두 칸의 끝값만으로 안쪽 폭이 0 이하가 된다(=사람 경로로 닿는다)').toBeLessThanOrEqual(0);
  await setW(page, lim.wMin);
  await setPad(page, lim.pMax);
  const s = await page.evaluate(eval(READ));
  const kept = s.rows.filter(r => r.stackW !== null);
  console.log(`[P2] 너비 ${s.frameW} · pad ${s.pad} ⇒ ★안쪽 ${s.inner} ⇒ ${kept.map(r => `${r.cls}(sw${r.stackW}) inlineW=${r.inlineW}`).join(' | ')}`);
  expect(s.inner, '전제: 안쪽 폭이 0 이하다').toBeLessThanOrEqual(0);
  expect(kept.length, `전제: 덮는 칸이 그대로다 — 잰 값 ${kept.length}`).toBe(4);
  for (const r of kept) expect(r.inlineW, `${r.cls}: 안쪽 폭이 0 이하면 보존을 포기한다(빈 값)`).toBe('(빈칸)');
  /* ★되돌리면 ★살아난다 — ★`stackW`(뜻)는 ★안 지워졌다 */
  await setPad(page, 0);
  await setW(page, pre.frameW);
  const back = await page.evaluate(eval(READ));
  console.log(`[P2 ★되돌림] 너비 ${back.frameW} pad ${back.pad} ⇒ ${back.rows.filter(r => r.stackW !== null).map(r => `${r.cls} w${r.w}`).join(' | ')}`);
  for (const r of back.rows.filter(x => x.stackW !== null)) {
    expect(r.w, `되돌리면 ${r.cls} 폭이 돌아온다(${pre.rows.find(x => x.id === r.id).w})`).toBe(pre.rows.find(x => x.id === r.id).w);
  }
});

test('P3 ★★하한 ★명부 — ★닿는 명부 ⊇ {글자틀, 캔버스} ＋ ★명부 밖 0건 (⛔등호 금지)', async ({ page }) => {
  const { pre } = await scene(page);
  const rows = [];
  for (let pad = 0; pad <= 100; pad += 2) { await setPad(page, pad); rows.push(await page.evaluate(eval(READ))); }
  const kept = pre.rows.filter(r => r.stackW !== null);
  const tbl = kept.map(k => {
    const series = rows.map(s => ({ pad: s.pad, w: s.rows.find(x => x.id === k.id).w, inner: s.inner }));
    let hit = null;
    for (let i = 1; i < series.length; i++) if (series[i].w === series[i - 1].w) { hit = series[i].pad; break; }
    return { cls: k.cls, id: k.id, sw: Number(k.stackW), floor: series[series.length - 1].w, hit,
      over: series.filter(s => s.w > s.inner).map(s => s.pad) };
  });
  for (const t of tbl) {
    console.log(`[P3] ${t.cls}(sw${t.sw}) ⇒ ★멈춘 폭 ${t.floor} · ★하한에 닿는 첫 pad ${t.hit === null ? '(★안 닿는다)' : t.hit}`
      + ` · ★안쪽보다 넓어진 pad ${t.over.length}개`);
  }
  /* ★★★명부 꼴 — ⛔`== N` 금지(★흔들리는 수다 · ①-나 가 이미 한 번 늘렸다).
     ★명부 = ★«하한에 닿는 것»의 ★꼴로 적고, ★★명부 밖에서 ★닿는 칸이 ★0 건임을 ★따로 센다. */
  /* ★★★명부를 ★★«술어»에서 ★파생시킨다 — ⛔내가 ★문턱(sw ≤ 20 등)을 ★손으로 적으면 ★★그것이 ★둘째 명부다.
     ★첫 회차에 ★그렇게 적어 ★★도형(sw 100 · 하한 20)이 ★명부 밖으로 ★떨어졌다(★이 칸이 ★잡았다).
     ★★예측 = ★«상한 패딩에서 ★하한 아래로 ★내려가나» = `sw − 2·padMax ≤ min(sw, 하한)` */
  const padMax = await page.evaluate(() => Number(document.getElementById('ss-padx-num').max));
  const floors = await page.evaluate((ids) => {
    const F = document.getElementById('sF'); const out = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      const sw = Number(el.dataset.stackW);
      out[id] = Math.min(sw, window.__minVisibleWidth(el, sw));
    }
    return out;
  }, tbl.map(t => t.id));
  const 예측 = tbl.filter(t => t.sw - 2 * padMax <= floors[t.id]);
  const 닿음 = tbl.filter(t => t.hit !== null);
  const 음성 = tbl.filter(t => t.hit === null);
  console.log(`[P3 ★명부] 술어에서 파생한 예측 ${예측.length}칸: ${예측.map(t => `${t.cls}(sw${t.sw}·하한${floors[t.id]})`).join(' · ')}`);
  console.log(`[P3 ★전수] 덮는 ${tbl.length}칸 · ★닿는 칸 ${닿음.length}: ${닿음.map(t => `${t.cls}/${t.sw}@pad${t.hit}`).join(' · ')}`
    + ` | ★안 닿는 칸 ${음성.length}: ${음성.map(t => `${t.cls}(sw${t.sw})`).join(' · ') || '없다'}`);
  console.log(`[P3 ★넘침] 안쪽보다 넓어진 칸이 있는 자식 ${tbl.filter(t => t.over.length).length}개`);
  /* ⑴ ★★명부 ⊇ {도형, 글자틀, 캔버스} — ★«그 셋이 ★닿는다»를 ★이름으로 */
  for (const want of [100, 339, 360]) {
    const t = tbl.find(x => x.sw === want);
    expect(t, `전제: sw=${want} 자식이 장면에 있다`).toBeTruthy();
    expect(t.hit, `sw=${want}(${t && t.cls}) 는 사람 범위 안에서 하한에 닿는다`).not.toBeNull();
  }
  /* ⑵ ★★음성 칸 — ★grid(688)는 ★안 닿는다(★하한 200 보다 ★한참 넓다) */
  const g = tbl.find(x => x.sw === 688);
  expect(g && g.hit, 'grid(sw688)는 사람 범위에서 하한에 안 닿는다(음성 칸)').toBeNull();
  /* ⑶ ★★★명부 ⊇ 닿음 ＋ ★★명부 밖 ★0건 — ⛔수(`== 3`)로 ★닫지 ★않는다(★흔들린다) */
  const 명부밖닿음 = 닿음.filter(t => !예측.includes(t));
  expect(명부밖닿음.map(t => `${t.cls}(sw${t.sw})@pad${t.hit}`), '예측 명부 밖에서 하한에 닿은 자식이 있다 — 식과 명부가 갈렸다').toEqual([]);
  const 예측밖음성 = 예측.filter(t => t.hit === null);
  expect(예측밖음성.map(t => `${t.cls}(sw${t.sw})`), '예측은 닿는다 했는데 안 닿은 자식이 있다 — 식과 명부가 갈렸다').toEqual([]);
  /* ⑷ ★넘침 ★0건 */
  expect(tbl.filter(t => t.over.length).map(t => t.cls), '안쪽 폭보다 넓어진 자식이 있다').toEqual([]);
});

test('P4 ★★하한이 ★«수지④»를 ★막는다 — ★글자틀 ★줄 수가 ★하한 위에서 ★불변', async ({ page }) => {
  const { pre } = await scene(page);
  const tf = pre.rows.find(r => r.stackW !== null && r.cls === 'frame-block' && Number(r.stackW) > 200);
  expect(tf, '전제: 글자틀(sw > 200)이 장면에 있다').toBeTruthy();
  const LINES = `((id) => {
    const el = document.getElementById(id);
    const ce = el.querySelector('[class^="tb-"]') || el;
    const lh = parseFloat(getComputedStyle(ce).lineHeight) || 1;
    return { w: el.offsetWidth, inlineW: el.style.width || '(빈칸)', h: ce.offsetHeight, lines: Math.round(ce.offsetHeight / lh) };
  })`;
  const z = await page.evaluate(eval(LINES), tf.id);
  console.log(`[P4 전제] 글자틀 sw=${tf.stackW} · 변환 직후 폭 ${z.w} · 줄 ${z.lines}`);
  expect(z.lines, '전제: 한 줄에서 시작한다').toBe(1);
  const got = [];
  for (const pad of [70, 74, 100]) {
    await setPad(page, pad);
    const s = await page.evaluate(eval(LINES), tf.id);
    got.push({ pad, ...s });
    console.log(`[P4] pad=${String(pad).padStart(3)} ⇒ 폭 ${s.w}(inline ${s.inlineW}) · ★줄 ${s.lines} (높이 ${s.h})`);
  }
  /* ★★하한 위에서는 ★폭도 ★줄 수도 ★움직이지 ★않는다 */
  for (const g of got) {
    expect(g.w, `pad=${g.pad}: 하한 위에서는 폭이 멈춘다(${got[0].w})`).toBe(got[0].w);
    expect(g.lines, `pad=${g.pad}: 줄 수가 늘지 않는다(${got[0].lines})`).toBe(got[0].lines);
  }
  /* ★★★그 «하한이 ★좋은 쪽»임을 ★★수로 남긴다(★무력화로 쟀다 · 2026-10-11):
       ★하한을 ★0 으로 두면 ⇒ ★pad 70 → 199px·줄 2 · ★74 → 191px·줄 2 · ★★100 → ★139px·★줄 4(높이 115→230)
       ⇒ ★★수지④ 증상(「한 줄이던 글자가 여러 줄로」)이 ★다시 난다. ★하한이 ★200px·줄 2 에서 ★멈춘다.
     ⛔이 칸은 ★그 비교를 ★«단언»하지 못한다(★하한 없는 판을 ★여기서 만들 수 없다) ⇒ ★수만 ★적는다. */
  console.log('[P4 ★기록] 하한 0 으로 무력화하면 pad 100 에서 139px·줄 4(높이 230) — 수지④ 증상이 돌아온다');
});

test('P5 ★★합친 것을 ★재는 자 — ★부르는 둘이 ★같은 하한을 ★받나', async ({ page }) => {
  await scene(page);
  const got = await page.evaluate(() => {
    const F = document.getElementById('sF');
    const num = document.getElementById('ss-width-num');
    const w = parseInt(F.dataset.width) || F.offsetWidth || 0;
    const shape = F.querySelector(':scope > .frame-block');     /* 자식 중 프레임꼴 하나 */
    const shapeEl = [...F.children].find(c => c.querySelector(':scope > .shape-block')) || null;
    const p = window.__minVisibleWidth;
    return {
      has: typeof p === 'function',
      panelMin: Number(num.min), predFrame: p ? p(F, w) : null, frameW: w,
      predShape: p && shapeEl ? p(shapeEl, Number(shapeEl.dataset.stackW)) : null,
      shapeSw: shapeEl ? Number(shapeEl.dataset.stackW) : null,
      shapeRendered: shapeEl ? shapeEl.offsetWidth : null,
      sameSlot: !!shape,
    };
  });
  console.log(`[P5] 술어 있나=${got.has} · ★패널이 쓴 하한 ${got.panelMin} · ★술어가 준 하한 ${got.predFrame}(프레임 폭 ${got.frameW})`
    + ` | ★도형 자식 sw=${got.shapeSw} ⇒ 술어 ${got.predShape}`);
  expect(got.has, '전제: 술어가 내놓아져 있다').toBe(true);
  /* ⑴ ★★소비자 ⑴(폭 슬라이더)이 ★쓴 수 == ★술어의 답 — ⛔수(200)를 ★여기 적지 않는다 */
  expect(got.panelMin, '폭 슬라이더의 하한이 술어의 답과 같다').toBe(got.predFrame);
  /* ⑵ ★★소비자 ⑵(파생)의 ★하한 == ★술어의 답 — ★상한 패딩에서 ★멈춘 폭으로 ★잰다 */
  await setPad(page, 100);
  const stopped = await page.evaluate(() => {
    const F = document.getElementById('sF');
    const el = [...F.children].find(c => c.querySelector(':scope > .shape-block'));
    return el ? el.offsetWidth : null;
  });
  console.log(`[P5] pad 상한에서 ★도형이 멈춘 폭 ${stopped} · ★술어가 준 하한 ${got.predShape}`);
  expect(stopped, '파생이 쓴 하한이 술어의 답과 같다').toBe(got.predShape);
  /* ⑶ ★★술어가 ★두 갈래를 ★실제로 ★가른다 — ★안 가르면 ⑴⑵ 가 ★같아도 ★아무것도 ★안 잠근다 */
  expect(got.predShape, '도형과 비도형의 하한이 다르다(술어가 가른다)').not.toBe(got.predFrame);
});

test('P6 ★프레임을 ★좁혀도 — ★넘침 0 ＋ ★너비를 만지면 ★파생이 ★다시 돈다(⛔썩지 않는다)', async ({ page }) => {
  const { pre } = await scene(page);
  for (const [w, p] of [[200, 100], [200, 90], [200, 70], [400, 100]]) {
    await setW(page, w); await setPad(page, p);
    const s = await page.evaluate(eval(READ));
    const kept = s.rows.filter(r => r.stackW !== null);
    console.log(`[P6] 너비 ${String(s.frameW).padStart(3)} ＋ pad ${String(s.pad).padStart(3)} ⇒ 안쪽 ${String(s.inner).padStart(3)} | `
      + kept.map(r => `${r.cls} w${r.w} 넘침 L${r.outL}/R${r.outR}`).join(' | '));
    for (const r of kept) {
      expect(r.outL, `너비 ${w}＋pad ${p}: ${r.cls} 가 프레임을 왼쪽으로 넘쳤다(${r.outL})`).toBeLessThanOrEqual(0);
      expect(r.outR, `너비 ${w}＋pad ${p}: ${r.cls} 가 프레임을 오른쪽으로 넘쳤다(${r.outR})`).toBeLessThanOrEqual(0);
    }
  }
  /* ★★썩음 칸 — ★pad 를 ★고정하고 ★너비만 ★바꾼다. ★파생이 ★다시 안 불리면 ★값이 ★머문다.
     ★★증명하는 칸은 ★«하한에 ★안 닿는» 자식이다(★하한에 닿은 것은 ★값이 ★같은 게 ★정답이라 ★아무것도 안 가른다). */
  await setW(page, 400); await setPad(page, 100);
  const s1 = await page.evaluate(eval(READ));
  await setW(page, 860);
  const s2 = await page.evaluate(eval(READ));
  const pick = (s) => s.rows.find(r => Number(r.stackW) === 688);
  console.log(`[P6 ★썩음] pad 100 고정 · 너비 400→860(안쪽 ${s1.inner}→${s2.inner}) ⇒ grid ${pick(s1).w}→${pick(s2).w}`);
  expect(pick(s1), '전제: grid(sw688)가 있다').toBeTruthy();
  expect(pick(s2).w, `너비를 바꾸면 파생이 다시 돈다(머물면 ${pick(s1).w})`).not.toBe(pick(s1).w);
  /* ★그리고 ★그 값이 ★식과 ★맞다 */
  const want = Math.min(Math.max(688 - 2 * s2.pad, 200), s2.inner);
  expect(pick(s2).w, `다시 돈 값이 식과 맞다(${want})`).toBe(want);
  expect(pre.frameW, '전제: 시작 프레임 폭').toBe(860);
});

test('P7 ★★«하한보다 ★이미 ★좁은» 비도형 자식 — ★pad 0 에서 ★넓어지지 ★않는다(`base` 가둠)', async ({ page }) => {
  /* ★★왜 ★따로 ★장면을 ★짓나: ★위 장면의 ★비도형 자식은 ★전부 ★하한(200) ★이상이다(339·360·688)
     ⇒ ★★`Math.min(base, …)` 가둠을 ★잠그는 칸이 ★★없다(★무력화해도 ★안 빨개진다 — ★그걸 ★확인했다).
     ⇒ ★그래서 ★★«하한보다 ★좁은» 자식을 ★한 벌 ★짓는다. ★그 꼴은 ★실제로 ★생긴다 — ★자유배치에서 ★작게 ★줄이면 된다
       (★폭을 ★손으로 박는 꼴은 ★`frame-stack-convert-keeps-text` 가 ★쓰는 ★선례와 ★같다). */
  await page.setViewportSize({ width: 1500, height: 900 });
  const errs = await bootApp(page);
  const info = await page.evaluate(() => {
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
    F.id = 'sF'; F.style.height = '600px';
    window._activeFrame = F;
    window.addCanvasBlock({});
    const el = [...F.children].pop();
    el.id = 'narrow';
    el.style.top = '40px';
    el.style.width = '150px';           /* ★작게 줄인 자식(사람은 손잡이로 한다) */
    return { shape: !!el.querySelector(':scope > .shape-block'), w: el.offsetWidth };
  });
  console.log(`[P7 전제] 자식 폭 ${info.w} · 도형인가=${info.shape}`);
  expect(info.shape, '전제: 비도형 자식이다(도형이면 하한이 min(w,20) 이라 이 칸이 아무것도 안 가른다)').toBe(false);
  await page.evaluate(() => window.deselectAll?.());
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
  await page.click('#ss-to-stack-btn', { timeout: 2500 });
  await page.evaluate(() => window.deselectAll?.());
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
  const R = `(() => {
    const F = document.getElementById('sF'), el = document.getElementById('narrow');
    const fr = F.getBoundingClientRect(), rr = el.getBoundingClientRect();
    const z = F.offsetWidth ? fr.width / F.offsetWidth : 1;
    const sw = Number(el.dataset.stackW);
    return { sw, floor: window.__minVisibleWidth ? Math.min(sw, window.__minVisibleWidth(el, sw)) : null,
      w: Math.round(rr.width / z), gapL: Math.round((rr.left - fr.left) / z),
      pad: parseFloat(getComputedStyle(F).paddingLeft) || 0 };
  })`;
  const z0 = await page.evaluate(eval(R));
  console.log(`[P7] 변환 직후 sw=${z0.sw} · 술어 하한(가둔 뒤) ${z0.floor} · 폭 ${z0.w} · 틈 ${z0.gapL}`);
  expect(z0.sw, '전제: stackW 가 박혔고 150 이다').toBe(150);
  expect(z0.floor, '전제: 가둔 하한이 stackW 와 같다(= base 로 가뒀다)').toBe(150);
  /* ★★주 단언 — ★pad 0 에서 ★폭이 ★stackW 그대로(⛔하한 200 으로 ★넓어지지 않는다) */
  expect(z0.w, 'pad 0: 하한보다 좁은 자식이 넓어지지 않는다').toBe(150);
  const got = [];
  for (const pad of [0, 48, 100]) {
    await page.fill('#ss-padx-num', String(pad), { timeout: 2000 });
    const s = await page.evaluate(eval(R));
    got.push(s);
    console.log(`[P7] pad=${String(pad).padStart(3)} ⇒ 폭 ${s.w} · 틈 ${s.gapL}`);
    expect(s.w, `pad=${pad}: 폭이 ${z0.sw} 를 넘지 않는다`).toBeLessThanOrEqual(z0.sw);
  }
  /* ★★★그리고 ★이 칸이 ★찾은 것 — ⛔좋은 소식이 ★아니라 ★★클램프의 ★«죽은 구역»이다. ★수로 적는다:
     ★★`stackW ≤ 하한` 인 자식은 ★폭이 ★★처음부터 ★멈춰 있다 ⇒ ★`틈 = pad + (안쪽 − w)/2 = (frameW − w)/2`
       ⇒ ★★pad 가 ★★항등식으로 ★소거된다 ⇒ ★★패딩이 ★★«전혀» 안 먹는다(★실측: pad 0·48·100 ★전부 ★틈 355).
     ★★그건 ★★현빈이 ★처음 ★가리킨 ★증상 ★그 꼴이다 — ★다만 ★★이 아종(비도형 · 하한 이하)에서만.
     ★비교(손 계산 ⛔미측정): ★비율 식이면 ★pad 100 에서 ★폭 115 ⇒ ★틈 ★372(＋17) — ★0 은 ★아니다.
     ⇒ ★★그래서 ★여기서 ★«틈이 늘어난다»를 ★★단언하지 ★않는다. ★★사실을 ★★단언한다(★고정) ＋ ★★올려서 ★판정을 받는다.
     ★★이 칸의 ★주 단언은 ★위의 ★«pad 0 에서 안 넓어진다»(= `base` 가둠)다. */
  for (const g of got) expect(g.gapL, `pad=${g.pad}: 하한 이하 자식은 틈이 고정이다(${got[0].gapL})`).toBe(got[0].gapL);
  console.log(`[P7 ★죽은 구역] stackW(${z0.sw}) ≤ 하한 ⇒ pad 0·48·100 에서 틈이 ${got[0].gapL} 고정 — ★패딩이 이 자식에겐 안 먹는다`);
  expect(errs, errs.join(' | ')).toEqual([]);
});
