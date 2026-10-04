/* modal-frameify-pixel — M1 「프레임화 하기」 픽셀 동일 골든 (2026-10-04, M1 레인 · 설계 §1-3)
 * ★「사람이 보는 것」으로 잰다 — dataset 이 아니라 화면 픽셀(modal-variant.dom.spec 머리말의 교훈).
 *   한 칸 = 섹션 하나에 모달 → 선택·hover 걷기 → 섹션 rect 스샷 A → 프레임화 → 같은 clip 스샷 B → 다른 픽셀 «0» 이어야.
 *   + 수치: 그릇 rect · 글자 칸마다 Range.getClientRects() 줄 상자 · 아이콘 rect — 0.01px 단위로 같아야.
 * 행렬 = 형태 4 × 설정 14 × 자리 3(섹션 / 스택 프레임 안 / 그리드 밑) × 배율 2(100% · 40%) — 테스트 하나 = (형태·자리·배율), 안에서 설정 14 를 돈다.
 * ★비교기 자체의 양성대조 V1 = 맨 끝 시험(픽셀 하나 바꾼 PNG 를 «1» 로 세는가).
 * (PNG 내보내기 E2 는 이 파일에 없다 — 하네스에서 못 잰다(electronAPI 가짜 → captureSectionCdp null) · 실앱에서 쟀다: $S/reports/M1-BUILD.md)
 * ⛔앱 무접촉 — bootApp. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const LONG = '오후 2시 이전 주문은 당일 출고되며 주말과 공휴일 주문은 다음 영업일에 순차적으로 출고됩니다. 제주·도서산간 지역은 추가 배송비가 붙을 수 있습니다.';
const CFGS = [
  ['기본', {}],
  ['타이포', { fontFamily: 'Georgia, serif', fontWeight: '500', lineHeight: 1.4, letterSpacing: 2 }],
  ['꾸밈', { italic: true, strike: true, highlight: true }],
  ['색', { textColor: 'var(--color-brand, #c0392b)', bg: 'rgba(20, 120, 200, 0.15)' }],
  ['테두리', { borderW: 3, borderStyle: 'dotted', borderColor: '#336699' }],
  ['모서리', { radius: 24, bg: '#eef4ff' }],
  ['그림자soft', { dropShadow: 'soft', bg: '#ffffff' }],
  ['그림자strong', { dropShadow: 'strong', bg: '#ffffff' }],
  ['폭고정', { wMode: 'fixed', width: 420, align: 'center' }],
  ['높이center', { hMode: 'fixed', height: 300, vAlign: 'center' }],
  ['높이bottom', { hMode: 'fixed', height: 300, vAlign: 'bottom', align: 'right' }],
  ['빈칸', { title: '', text: '' }],
  ['작은글', { fontSize: 12, padY: 4, padX: 6, title: '작', text: '작은 글' }],   // 내용 < 60px — 프레임 CSS min-height:60 을 눌렀는지(V4)
  ['긴글', { text: `첫 줄\n둘째 줄 ${LONG}`, title: `제목도 길게 ${LONG.slice(0, 40)}` }],
];
const VARIANTS = ['plain', 'titled', 'dashed', 'icon-stack'];
const PLACES = ['section', 'frame', 'grid'];
const ZOOMS = [100, 40];

const SEC = `<div class="section-block" id="sX" data-section="1" data-name="X"><div class="section-hitzone"></div><div class="section-inner" id="innerX" style="padding-left: 32px; padding-right: 32px;">
<div class="gap-block" data-type="gap" id="gTop" style="height:140px"></div><div id="slot"></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:200px"></div></div></div>`;

/** 자리별로 모달을 놓는다 — 돌려주는 것 없음. 이전 판은 섹션째 갈아끼운다. */
const place = (page, variant, cfg, where) => page.evaluate(([variant, cfg, where, SEC]) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
  c.insertAdjacentHTML('beforeend', SEC);
  const slot = document.getElementById('slot');
  const { row, block } = window.makeModalBlock({ variant, title: '배송 안내', text: '오후 2시 이전 주문은 당일 출고됩니다.', ...cfg });
  block.id = 'mdlX';
  if (where === 'section') slot.replaceWith(row);
  else if (where === 'frame') {
    const f = window.makeFrameBlock({ fullWidth: true, bg: '#fafafa', padding: 24 }); f.id = 'hostF';
    f.appendChild(row); slot.replaceWith(f);
  } else {
    const r = document.createElement('div'); r.className = 'row'; r.dataset.layout = 'stack';
    r.innerHTML = '<div class="grid-block" id="gX" data-type="grid" data-gap="24" data-valign="top"></div>';
    r.firstChild.dataset.cols = JSON.stringify([{ width: 1, lines: [{ type: 'body', text: '칸 가' }] }, { width: 1, lines: [{ type: 'body', text: '칸 나' }] }]);
    slot.replaceWith(r);
    const g = document.getElementById('gX'); window.renderGridBlock(g);
    const box = window.ensureGridKidsBox ? window.ensureGridKidsBox(g) : (() => { window.addGridChild('gX', 'gap'); return g.querySelector(':scope > .grd-children'); })();
    box.innerHTML = ''; box.appendChild(row);
  }
  window.renderModalBlock(block); window.rebindAll?.(); window.deselectAll?.(); document.activeElement?.blur?.();
}, [variant, cfg, where, SEC]);

const measure = (page) => page.evaluate(() => {
  const sec = document.getElementById('sX');
  const r = sec.getBoundingClientRect();
  const box = document.getElementById('mdlX') || document.querySelector('[data-row-text-style]');
  const b = box.getBoundingClientRect();
  const lines = [];
  const slots = document.getElementById('mdlX')
    ? [...box.querySelectorAll('[data-mdl-slot]')]
    : [...box.querySelectorAll('.text-block [class^="tb-"]')];
  for (const s of slots) { const rg = document.createRange(); rg.selectNodeContents(s); for (const q of rg.getClientRects()) lines.push([q.left, q.top, q.width, q.height].map(v => Math.round(v * 100) / 100)); }
  const ic = box.querySelector('.mdl-icon, .icon-block');
  const icr = ic ? ic.getBoundingClientRect() : null;
  return { clip: { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) },
           box: [b.left, b.top, b.width, b.height].map(v => Math.round(v * 100) / 100), lines, icon: icr && [icr.left, icr.top, icr.width, icr.height].map(v => Math.round(v * 100) / 100) };
});
async function diffPng(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = async (s) => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const A = await load(a), B = await load(b);
    if (A.width !== B.width || A.height !== B.height) return { n: -1, size: [A.width, A.height, B.width, B.height] };
    let n = 0, first = null;
    for (let i = 0; i < A.data.length; i += 4) if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) { n++; if (!first) first = [(i / 4) % A.width, Math.floor(i / 4 / A.width)]; }
    return { n, first };
  }, [a.toString('base64'), b.toString('base64')]);
}
/* ★자리가 «멈춘 뒤»에 찍는다 — 첫 판은 applyZoom 직후 첫 설정을 «움직이는 중»에 찍어 14칸 중 첫 칸만 매번 빨갰다
   (before 상자 437×725 ↔ after 402×796 · 40% 는 섹션 전체가 갈림). _root-harness waitStableRect 와 같은 처방: 두 번 연속 같을 때까지. */
const settle = async (page) => {
  await page.mouse.move(2, 2);
  await page.evaluate(() => document.fonts.ready);   // ★웹폰트가 «다 온 뒤» — 첫 칸만 글자 그림이 갈리던 둘째 까닭(형태는 같고 픽셀만 ~19k 다름)
  let prev = null;
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await page.evaluate(() => { const b = document.getElementById('sX').getBoundingClientRect(); const m = (document.getElementById('mdlX') || document.querySelector('[data-row-text-style]')).getBoundingClientRect();
      return [b.left, b.top, b.width, b.height, m.left, m.top, m.width, m.height].map(v => Math.round(v * 100)).join(','); });
    if (r === prev) return;
    prev = r; await page.waitForTimeout(100);
  }
  throw new Error('자리가 안 멈춘다');
};

/* ★알고 남긴 차이 — «이름과 상한»으로 적는다(상한을 넘으면 빨강). 형태(geo)는 언제나 0.01px 까지 같아야 한다.
   ⑴ icon-stack + 모서리: 아이콘 svg 가장자리 안티앨리어싱 62px(골든 3·4차 동일). 원인 = 모서리 둥근 프레임의 «자르기 층»
      (css `.frame-block[data-radius]:not([data-radius="0"]){overflow:hidden}` + makeFrameBlock 인라인 overflow:hidden).
      모서리 없는 icon-stack 은 0 · 다른 세 형태 + 모서리는 0 ⇒ 아이콘 래스터만 갈린다.
      ⛔없애려면 프레임에 인라인 overflow:visible 을 박아야 하는데, 그러면 «모달에서 온 둥근 프레임»만 나중에 넣는 이미지 줄을
        모서리에서 안 자른다(다른 모든 둥근 프레임과 다르게) — 그 대가가 더 커서 «자르기»를 지켰다(M1-BUILD 보고).
   ⑵ icon-stack · 배율 40%: 2px 안팎(소수 배율 래스터 — 어느 설정에 뜨는지 판마다 바뀐다: 3차 빈칸 · 4차 높이bottom·빈칸). */
const ALLOW = (variant, name, zoom) => (variant !== 'icon-stack' ? 0 : (name === '모서리' && zoom === 100) ? 64 : (zoom === 40 ? 4 : 0));
for (const variant of VARIANTS) for (const where of PLACES) for (const zoom of ZOOMS) {
  test(`G1 픽셀 동일 — ${variant} · ${where} · ${zoom}%`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1600, height: 1500 });
    const errs = await bootApp(page);
    await page.evaluate((z) => window.applyZoom(z), zoom);
    await page.waitForTimeout(800);   // 배율 맞추기의 비동기 가운데 맞추기
    /* ★토스트는 «캔버스 위 덮개»다(프레임화가 「⌘Z 로 되돌리기」를 띄운다) — 첫 판은 첫 설정의 B 컷에만 토스트가 들어가
       (뒤 설정은 앞 토스트가 A·B 둘 다에 남아 같아진다) 14칸 중 첫 칸만 ~19k px 갈렸다(형태 같음 · 0행부터). 비교 대상이 아니라 끈다. */
    await page.evaluate(() => { window.showToast = () => {}; });
    const bad = [];
    for (const [name, cfg] of CFGS) {
      await place(page, variant, cfg, where);
      await page.evaluate(() => document.getElementById('sX').scrollIntoView({ block: 'start' }));
      await settle(page);
      const m0 = await measure(page);
      const a = await page.screenshot({ clip: m0.clip });
      const ok = await page.evaluate(() => !!window.frameifyModal?.('mdlX'));
      if (!ok) { bad.push(`${name}: frameifyModal 실패/없음`); continue; }
      await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
      await settle(page);
      const m1 = await measure(page);
      const b = await page.screenshot({ clip: m0.clip });
      const d = await diffPng(page, a, b);
      const geo = JSON.stringify([m0.box, m0.lines, m0.icon]) === JSON.stringify([m1.box, m1.lines, m1.icon]);
      const allow = ALLOW(variant, name, zoom);
      if (d.n > allow || !geo) bad.push(`${name}: px=${d.n} first=${JSON.stringify(d.first)} geo=${geo ? 'ok' : JSON.stringify({ a: [m0.box, m0.lines.slice(0, 3), m0.icon], b: [m1.box, m1.lines.slice(0, 3), m1.icon] })}`);
    }
    console.log(`[G1 ${variant} ${where} ${zoom}]`, bad.length ? bad.join('\n  ') : 'ALL 0');
    expect(bad, bad.join('\n')).toEqual([]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('V1 비교기 양성대조 — 같은 PNG 에서 픽셀 하나를 바꾸면 «1» 로 센다', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  await page.setContent('<div id="b" style="width:200px;height:100px;background:#fff"><i id="p" style="position:absolute;left:10px;top:10px;width:1px;height:1px;background:#fff"></i></div>');
  const clip = { x: 0, y: 0, width: 220, height: 120 };
  const a = await page.screenshot({ clip });
  await page.evaluate(() => { document.getElementById('p').style.background = '#000'; });
  const b = await page.screenshot({ clip });
  expect((await diffPng(page, a, b)).n).toBe(1);
  expect((await diffPng(page, a, a)).n).toBe(0);
});
