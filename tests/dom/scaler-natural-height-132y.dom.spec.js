/* scaler-natural-height-132y.dom — ★132 ⓨ(지디 GO 261027): js/editor.js _syncScalerHeight 가 자연 높이를 «비우고 재지» 않고
 *   #canvas.offsetTop + offsetHeight 로 읽는다 — 전제 둘(흐름 자식 #canvas 하나 · scaler padding/border·#canvas margin-bottom 0)이 깨지면 옛 길.
 * 장면마다 페이지 안에서 셋을 잰다:
 *   naive   = #canvas.offsetTop + offsetHeight              (새 길의 값)
 *   cleared = scaler 높이를 비우고 잰 offsetHeight            (옛 길의 값 = 정답)
 *   got     = applyZoom → _syncScalerHeight 가 써 둔 scaler.style.height
 * ★N(전제 선다): naive === cleared 이고 got === round((cleared ∨ abs 자식 바닥) × 배율)
 * ★B(전제 깨짐 — 지디 ③ «깨지는 판을 찾아라»): naive !== cleared 를 «먼저» 단언(장면이 진짜 깨는가) → 그래도 got 이 정답 = 옛 길로 갔다
 *   B 장면은 레포에 그 꼴을 «만드는» 코드가 지금 없다(CSS·JS 전수 grep) — 합성이다. N 장면은 레포에 있는 꼴(자유배치·스크래치·＋층·메모 덧층·마지막 섹션 margin).
 * 기다림은 전부 조건(고정 대기 0). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const ZOOM = 40;
async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((z) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    for (let i = 0; i < 3; i++) c.insertAdjacentHTML('beforeend', `<div class="section-block" id="nS${i}" data-section="1" style="height:${400 + i * 50}px;"><div class="section-hitzone"></div><div class="section-inner"></div></div>`);
    window.rebindAll?.(); window.applyZoom(z);
  }, ZOOM);
  return errs;
}
/** 장면을 걸고(fn 은 페이지 안 문자열 본문) → applyZoom 으로 _syncScalerHeight 를 부르고 → 셋을 잰다 */
const measure = (page, body) => page.evaluate(([body, z]) => {
  new Function(body)();
  window.applyZoom(z);
  const sc = document.getElementById('canvas-scaler'), cv = document.getElementById('canvas');
  const got = sc.style.height;
  const naive = cv.offsetTop + cv.offsetHeight;
  const prev = sc.style.height; sc.style.height = ''; void sc.offsetHeight; let cleared = sc.offsetHeight; sc.style.height = prev;
  let nat = cleared;
  for (const c of sc.children) if (c.style && c.style.position === 'absolute') { const b = c.offsetTop + c.offsetHeight; if (b > nat) nat = b; }
  return { got, naive, cleared, want: Math.round(nat * z / 100) + 'px' };
}, [body, ZOOM]);

const N = {
  N0_base: '',
  N1_freeLayout_overflow: `const s = document.querySelector('#nS2 .section-inner'); s.insertAdjacentHTML('beforeend', '<div class="frame-block" data-free-layout="true" style="position:relative;height:120px"><div class="asset-block" style="position:absolute;top:600px;height:300px;width:100px"></div></div>');`,
  N2_scratch_abs_below: `const d = document.createElement('div'); d.className = 'scratch-item'; d.style.position = 'absolute'; d.style.top = '3000px'; d.style.height = '200px'; d.style.width = '100px'; document.getElementById('canvas-scaler').appendChild(d);`,
  N3_grd_plus_layer: `let L = document.getElementById('grd-plus-layer'); if (!L) { L = document.createElement('div'); L.id = 'grd-plus-layer'; document.getElementById('canvas-scaler').appendChild(L); } L.innerHTML = '<div class="grd-add-btn" style="position:absolute;top:2500px;height:40px;width:40px"></div>';`,
  N4_memo_overlay_before_canvas: `const sc = document.getElementById('canvas-scaler'); let ov = document.getElementById('section-memo-overlay'); if (!ov) { ov = document.createElement('div'); ov.id = 'section-memo-overlay'; sc.insertBefore(ov, document.getElementById('canvas')); }`,
  N5_last_section_margin: `document.getElementById('nS2').style.marginBottom = '60px';`,
};
const B = {
  B1_flow_child_after_canvas: `const d = document.createElement('div'); d.id = 'zz-flow-probe'; d.style.height = '300px'; document.getElementById('canvas-scaler').appendChild(d);`,
  B2_canvas_margin_bottom: `document.getElementById('canvas').style.marginBottom = '80px';`,
  B3_scaler_padding_bottom: `document.getElementById('canvas-scaler').style.paddingBottom = '50px';`,
};

for (const [name, body] of Object.entries(N)) {
  test(`${name} [전제 선다] naive === cleared · _syncScalerHeight 값 = 정답`, async ({ page }) => {
    const errs = await setup(page); const r = await measure(page, body);
    expect(r.naive, `[전제] 이 장면에서 두 길이 같다 ${JSON.stringify(r)}`).toBe(r.cleared);
    expect(r.got, `scaler 높이 = round(자연 높이 × ${ZOOM}%)`).toBe(r.want);
    expect(errs).toEqual([]);
  });
}
for (const [name, body] of Object.entries(B)) {
  test(`${name} [전제 깨짐 · 합성] naive !== cleared «인데도» _syncScalerHeight 값 = 정답(옛 길로 감)`, async ({ page }) => {
    const errs = await setup(page); const r = await measure(page, body);
    expect(r.naive, `[전제] 이 장면은 두 길이 «갈린다»(아니면 이 칸이 아무것도 안 잰다) ${JSON.stringify(r)}`).not.toBe(r.cleared);
    expect(r.got, '전제가 깨지면 옛 길(비우고 잰다)의 값').toBe(r.want);
    expect(errs).toEqual([]);
  });
}
