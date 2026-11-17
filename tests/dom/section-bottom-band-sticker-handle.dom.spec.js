/* section-bottom-band-sticker-handle — 0.9.12 142행 SECTION-BOTTOM-BAND-COVERS-STICKER-HANDLE-01 (W06D O4 흔들림의 뿌리)
 *   섹션 바닥 띠(.section-bottom-handle · 10px · z5 · 섹션 :hover/선택 때만 보임)가 섹션 바닥 가까이 앉은 «고른 선 스티커»의 두께 손잡이를 덮어
 *   누름이 섹션 높이 끌기로 갔다(아이맥 진단: pointerdown 대상 .section-bottom-handle · mousedown 없음 · 두께 12→12).
 *   호버 «전» hit 는 손잡이라 시험의 사전 hit 가 못 잡았다(띠는 호버 «뒤»에 뜬다).
 * 칸:
 *   B(k) 섹션 높이 H 에서 선 y = H−k (k 16·10·8·6·4 = 높이 200 이면 184·190·192·194·196 — XREPRO 다섯 자리) · 손잡이 위로 옮긴 뒤 hit = [thick] · 실제 끌기로 두께가 변한다 · 섹션 높이 무변
 *   N1 [음성] 같은 장면(k 6)에서 스티커 «바로 아래» 띠(손잡이 아닌 x)를 끌면 섹션 높이가 는다
 *   N2 [음성] 스티커에서 먼 x 의 띠를 끌면 섹션 높이가 는다
 * 양성대조(CTL = js/section-bottom-handle.js 의 sbh-pass 한 줄 되돌림): B(8)·B(6)·B(4) 빨강(hit = .section-bottom-handle) · B(16)·B(10)·N1·N2 초록.
 * 장면: bootApp → 섹션 비움(아래 섹션 hitzone 배제 — 별건) → addSection → 기본 글자 누름+Delete → addStickerBlock(highlightB · 끝점 명시 = 앱 입구, MCP 와 같은 문) · 누름·끌기는 실마우스 · 고정 대기 0(rAF 두 번·waitStableRect).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const f2 = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const tagAt = (page, x, y) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ')[0] + (e.dataset?.endpoint ? `[${e.dataset.endpoint}]` : '') : null; }, [x, y]);

async function scene(page, k) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await bootApp(page);
  const sid = await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((x) => x.remove());   // 아래 섹션 hitzone 이 바닥을 덮지 않게 — 섹션 하나(이 칸은 띠만 잰다 · 아래 섹션 hitzone 겹침은 별건)
    await window.addSection();
    return window.getSelectedSection().id;
  });
  /* 기본 글자를 앱 문(누름 + Delete)으로 지운다 — 글자(z2)가 바닥 가까운 선 스티커를 덮지 않게 · 높이 = 섹션 바닥값(w2d06d clearText 와 같은 끝 상태) */
  for (let i = 0; i < 6; i++) {
    const tb = await page.evaluate((s) => document.getElementById(s).querySelector('.text-block')?.id || null, sid);
    if (!tb) break;
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const q = await waitStableRect(page, `[id="${tb}"]`);
    await page.mouse.click(q.cx, q.cy);
    await page.waitForFunction((i) => !!document.getElementById(i)?.classList.contains('selected'), tb, { timeout: 3000 });
    await page.keyboard.press('Delete');
    await page.waitForFunction((i) => !document.getElementById(i), tb, { timeout: 3000 });
  }
  const r = await page.evaluate(async ([sid, k]) => {
    const sec = document.getElementById(sid);
    if (window.getSelectedSection()?.id !== sid) window.selectSection?.(sec);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const H = sec.offsetHeight, ly = H - k;
    window.addStickerBlock({ shape: 'highlightB', x1: 350, y1: ly, x2: 510, y2: ly, thickness: 12 });
    const st = [...sec.querySelectorAll('.sticker-block')].pop();
    st?.scrollIntoView({ block: 'center', behavior: 'instant' });
    return { sec: sid, id: st?.id ?? null, H, ly, nText: sec.querySelectorAll('.text-block').length, sel: !!st?.classList.contains('selected') };
  }, [sid, k]);
  expect({ id: !!r.id, nText: r.nText }, `[전제] 글자 0 · 선 스티커 들어감 (H=${r.H})`).toEqual({ id: true, nText: 0 });
  await waitStableRect(page, `[id="${r.id}"]`);
  await f2(page);
  return { errs, ...r };
}
const thickMid = (page, id) => page.evaluate((i) => { const h = document.getElementById(i).querySelector('.hlb-handle[data-endpoint="thick"]'); if (!h) return null; const q = h.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, id);
const readS = (page, s) => page.evaluate((s) => ({ H: document.getElementById(s).offsetHeight, mh: document.getElementById(s).style.minHeight }), s);
const readT = (page, id) => page.evaluate((i) => document.getElementById(i).dataset.thickness, id);
async function drag(page, p, dy) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x, p.y + dy, { steps: 8 }); await page.mouse.up(); await f2(page); }

for (const k of [16, 10, 8, 6, 4]) {
  test(`B(${k}) 섹션 바닥 ${k}px 위 선 스티커 — 두께 손잡이 위에선 띠가 누름을 안 가져간다`, async ({ page }) => {
    const s = await scene(page, k);
    const h = await thickMid(page, s.id);
    expect({ sel: s.sel, h: !!h, pre: h && await tagAt(page, h.x, h.y) }, `[전제] 고른 선 스티커 · 두께 손잡이 · 호버 전 hit (H=${s.H} ly=${s.ly})`).toEqual({ sel: true, h: true, pre: '.hlb-handle[thick]' });
    await page.mouse.move(h.x - 40, h.y - 40); await page.mouse.move(h.x, h.y); await f2(page);
    const band = await page.evaluate((s) => getComputedStyle(document.getElementById(s).querySelector(':scope > .section-bottom-handle')).display, s.sec);
    expect(band, '[전제] 호버로 섹션 바닥 띠가 떴다').toBe('block');
    const hit = await tagAt(page, h.x, h.y);
    expect(hit, `★호버 뒤 두께 손잡이 중심 hit (H=${s.H} ly=${s.ly})`).toBe('.hlb-handle[thick]');
    const s0 = await readS(page, s.sec), t0 = await readT(page, s.id);
    await drag(page, h, 8);
    const s1 = await readS(page, s.sec), t1 = await readT(page, s.id);
    expect({ thickChanged: t1 !== t0, sec: s1 }, `★끌기 = 두께(${t0}→${t1}) · 섹션 높이 무변`).toEqual({ thickChanged: true, sec: s0 });
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}

for (const n of [{ cell: 'N1', name: '스티커 바로 아래(손잡이 아닌 x)', mx: 390 }, { cell: 'N2', name: '스티커에서 먼 x', mx: 760 }]) {
  test(`${n.cell} [음성] ${n.name}의 띠는 여전히 섹션 높이를 끈다`, async ({ page }) => {
    const s = await scene(page, 6);
    const p0 = await page.evaluate(([sid, mx]) => { const sec = document.getElementById(sid), q = sec.getBoundingClientRect(), z = q.width / sec.offsetWidth; return { x: q.left + mx * z, y: q.bottom - 2 * z }; }, [s.sec, n.mx]);
    await page.mouse.move(p0.x, p0.y - 30); await page.mouse.move(p0.x, p0.y); await f2(page);
    const b = await page.evaluate((sid) => { const q = document.getElementById(sid).querySelector(':scope > .section-bottom-handle').getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; }, s.sec);
    const p = { x: p0.x, y: (b.top + b.bottom) / 2 };
    await page.mouse.move(p.x, p.y); await f2(page);
    expect(await tagAt(page, p.x, p.y), `[전제] 그 자리 = 섹션 바닥 띠 (H=${s.H} ly=${s.ly})`).toBe('.section-bottom-handle');
    const s0 = await readS(page, s.sec), t0 = await readT(page, s.id);
    await drag(page, p, 20);
    const s1 = await readS(page, s.sec), t1 = await readT(page, s.id);
    expect({ grew: s1.H > s0.H, thick: t1 }, `★띠 끌기 = 섹션 높이 ${s0.H}→${s1.H} · 두께 무변`).toEqual({ grew: true, thick: t0 });
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
