/* h2c-svg-transform.dom.spec.js — ★html2canvas 가 ★«svg 에 닿는 CSS transform»을 ★안 그리는 구멍과
 *   그걸 메우는 전처리 `js/io/h2c-prep.js` `liftSvgTransformsForH2C(root)` 를 ★잰다.
 *
 * ★★무엇이 샜나 — 현빈 2026-10-09: 「이거 썸네일이 뒤집혀 보이네 (월계수 블럭 부분에 ★오른쪽 월계수잎)」
 *   ★월계수 오른 잎은 ★왼 잎과 ★같은 path 를 쓰고 거울을 ★CSS 하나로만 낸다(laurel-block.js `_laurelLeafSvg`)
 *   ⇒ ★썸네일에서 ★오른 잎이 ★왼 잎의 ★복사본이 됐다. ★실측(이 일 전): 두 잎 무게중심이 ★−0.1101 로 ★동일.
 *     ★참 렌더는 L −0.2048 / R ＋0.1907 ⇒ ★부호가 갈린다. ★즉 ★화면은 맞고 ★그림만 틀렸다.
 *
 * ★★자 — ★잎/꼬리 상자 안 ★«잉크 가로 무게중심» 오프셋(−=왼쪽 쏠림 / ＋=오른쪽).
 *   모양이 ★좌우 비대칭이라 ★거울이면 ★부호가 뒤집힌다.
 *   ⛔«live vs h2c» 로 견주지 ★마라 — ★다른 렌더러라 ★안티앨리어싱 차가 ★신호보다 크다(실측:
 *     transform 이 ★없는 갈래에서도 live −0.0263 / h2c −0.1712). ⇒ ★★«같은 렌더러 안에서 ★조건만» 바꾼다.
 *
 * ★전제로 ★`applyZoom(100)` 을 ★못박는다 — ⛔안 박으면 회차마다 40~60 으로 흔들려
 *   `getBoundingClientRect` 가 그 배율을 품고 ★상자가 빗나가 ★잉크 0 이 나온다(실측: 한 번 밟았다).
 *
 * ★양성대조·변이·0건 명부는 파일 끝 주석.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js h2c-svg-transform
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

/* page 안에서 도는 자 — 상자 하나의 잉크 수와 가로 무게중심 */
const INK = `
function inkOff(ctx, W, H, b) {
  const x0=Math.max(0,Math.round(b.x)), y0=Math.max(0,Math.round(b.y));
  const w=Math.min(Math.round(b.w),W-x0), h=Math.min(Math.round(b.h),H-y0);
  if (w<=0||h<=0) return {ink:0,off:null,note:'bbox 밖'};
  const d=ctx.getImageData(x0,y0,w,h).data; let ink=0,sx=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;
    const nw=Math.abs(d[i]-255)+Math.abs(d[i+1]-255)+Math.abs(d[i+2]-255);
    if(d[i+3]>40&&nw>12){ink++;sx+=x;}}
  return ink?{ink,off:+(((sx/ink)/w)-0.5).toFixed(4)}:{ink:0,off:null};
}`;

/* 월계수 ＋ 말풍선을 한 섹션에 세운다. ★zoom 을 못박고 그 값을 돌려준다(전제 단언용). */
async function scene(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await bootApp(page);
  return page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.applyZoom?.(100);
    window.addSection({ skipDefaultBlock: true });
    const sec = c.querySelector('.section-block:not([data-ghost])');
    window.selectSection?.(sec);
    window.addLaurelBlock?.();
    await new Promise(r => setTimeout(r, 90));
    window.selectSection?.(sec);
    await window.addSpeechBubbleBlock?.();
    await new Promise(r => setTimeout(r, 220));
    return {
      zoom: window.currentZoom,
      secId: sec.id,
      leaves: sec.querySelectorAll('.laurel-leaf-left svg, .laurel-leaf-right svg').length,
      tails: sec.querySelectorAll('.tb-bubble-tail').length,
      h2c: typeof window.html2canvas,
    };
  });
}

test('H0 전제 — 장면이 서고 zoom 100 이 ★못박혔고 html2canvas·헬퍼가 ★있다', async ({ page }) => {
  const s = await scene(page);
  expect(s.zoom, '⒜ ★zoom 100 (⛔안 박으면 상자가 흔들려 잉크 0 이 난다)').toBe(100);
  expect(s.leaves, '⒝ 월계수 잎 svg 둘').toBe(2);
  expect(s.tails, '⒞ 말풍선 꼬리 svg 하나').toBe(1);
  expect(s.h2c, '⒟ html2canvas 가 실렸다').toBe('function');
  const fn = await page.evaluate(async () => {
    const m = await import('/js/io/h2c-prep.js');
    return typeof m.liftSvgTransformsForH2C;
  });
  expect(fn, '⒠ 헬퍼를 들일 수 있다').toBe('function');
});

test('H1 ★★구멍 자체 — h2c 는 svg 의 CSS transform 을 ★안 그린다(인라인·클래스 ★둘 다) · `<g>`·감싸는 쪽은 ★그린다', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async (ink) => {
    eval(ink);
    const PATH = 'M0 0 L40 0 L40 100 L0 100 Z M60 40 L100 40 L100 60 L60 60 Z';
    const st = document.createElement('style');
    st.textContent = '.h1-mirror{transform:scaleX(-1);} .h1-shift{transform:translateX(-25px);}';
    document.head.appendChild(st);
    const mk = (how) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:-9999px;left:0;width:100px;height:100px;background:#fff;';
      let attr = '', inner = `<path d="${PATH}" fill="#111"/>`;
      if (how === 'inline-mirror') attr = ' style="transform:scaleX(-1)"';
      if (how === 'class-mirror')  attr = ' class="h1-mirror"';
      if (how === 'class-shift')   attr = ' class="h1-shift"';
      if (how === 'g-mirror') inner = `<g transform="translate(100,0) scale(-1,1)">${inner}</g>`;
      const svg = `<svg width="100" height="100" viewBox="0 0 100 100"${attr}>${inner}</svg>`;
      d.innerHTML = (how === 'wrap-mirror') ? `<div style="transform:scaleX(-1);width:100px;height:100px;">${svg}</div>` : svg;
      document.body.appendChild(d); return d;
    };
    const out = {};
    for (const how of ['none', 'inline-mirror', 'class-mirror', 'class-shift', 'g-mirror', 'wrap-mirror']) {
      const el = mk(how);
      const cv = await html2canvas(el, { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false });
      out[how] = inkOff(cv.getContext('2d'), cv.width, cv.height, { x: 0, y: 0, w: cv.width, h: cv.height });
      el.remove();
    }
    st.remove();
    return out;
  }, INK);
  console.log('[H1] ' + JSON.stringify(r));
  const base = r.none.off;
  expect(base, '전제 — 기준 도형이 ★좌우 비대칭이다(무게중심이 0 이 아니다)').toBeLessThan(-0.05);
  /* ★구멍 — svg 쪽 것은 ★안 그린다. ⛔「대충 비슷」이 아니라 ★같은 값이다 */
  expect(r['inline-mirror'].off, '★인라인 transform on svg → ★무변').toBe(base);
  expect(r['class-mirror'].off,  '★클래스 transform on svg → ★무변(인라인과 ★같다)').toBe(base);
  /* ★translate 는 ★무시가 아니라 ★잘림이다 — 잉크가 준다 */
  expect(r['class-shift'].ink, '★클래스 translateX on svg → ★내용이 ★잘린다(잉크 급감)').toBeLessThan(r.none.ink / 2);
  /* ★그려지는 두 꼴 */
  expect(r['g-mirror'].off * base, '★`<g transform>` → ★그린다(부호 뒤집힘)').toBeLessThan(0);
  expect(r['wrap-mirror'].off * base, '★감싸는 div 의 CSS transform → ★그린다(헬퍼가 쓰는 길)').toBeLessThan(0);
});

/* 클론을 만들어 (선택적으로) 헬퍼를 돌리고 h2c 로 찍는다 — ★썸네일 길과 ★같은 꼴 */
const runClone = (page, useHelper) => page.evaluate(async ({ ink, useHelper }) => {
  eval(ink);
  const mod = await import('/js/io/h2c-prep.js');
  const sec = document.querySelector('#canvas .section-block:not([data-ghost])');
  const clone = sec.cloneNode(true);
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
  document.body.appendChild(clone);          // ★붙인 뒤에 부른다 — detached 면 computed 가 빈 문자열이다
  const lifted = useHelper ? mod.liftSvgTransformsForH2C(clone) : 0;
  const base = clone.getBoundingClientRect();
  const box = (sel) => { const e = clone.querySelector(sel); if (!e) return null;
    const q = e.getBoundingClientRect();
    return { x: q.left - base.left, y: q.top - base.top, w: q.width, h: q.height }; };
  const bL = box('.laurel-leaf-left svg'), bR = box('.laurel-leaf-right svg');
  const cv = await html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false });
  const s = cv.width / base.width;
  const m = (b) => b ? inkOff(cv.getContext('2d'), cv.width, cv.height,
    { x: b.x*s, y: b.y*s, w: b.w*s, h: b.h*s }) : null;
  const out = { lifted, L: m(bL), R: m(bR) };
  clone.remove();
  return out;
}, { ink: INK, useHelper });

test('H2 ★★본 단언 — 월계수: 헬퍼 ★없으면 두 잎이 «같다» · ★있으면 «거울»이 된다', async ({ page }) => {
  const s = await scene(page);
  expect(s.zoom, '전제 — zoom 100').toBe(100);
  const without = await runClone(page, false);
  const withh   = await runClone(page, true);
  console.log('[H2 없음] ' + JSON.stringify(without));
  console.log('[H2 있음] ' + JSON.stringify(withh));
  expect(without.L.ink, '전제 — 왼 잎에 잉크가 있다(0 이면 ★내 상자가 빗나갔다)').toBeGreaterThan(100);
  expect(without.R.ink, '전제 — 오른 잎에도 있다').toBeGreaterThan(100);
  /* ⚰️고치기 전 — ★두 잎의 무게중심이 ★같다(= 오른 잎이 왼 잎의 ★복사본) */
  expect(without.R.off, '⚰️헬퍼 없으면 오른 잎 = 왼 잎 (★같은 값)').toBe(without.L.off);
  /* ★고친 뒤 — ★부호가 갈린다 */
  expect(withh.L.off * withh.R.off, '★★헬퍼가 있으면 두 잎의 무게중심 ★부호가 갈린다(=거울)').toBeLessThan(0);
  expect(withh.L.off, '★왼 잎은 ★안 바뀐다(헬퍼는 거울 없는 쪽을 안 건드린다)').toBe(without.L.off);
  expect(withh.lifted, '★올린 개수 — 월계수 오른 잎 ＋ 말풍선 꼬리 = 2').toBe(2);
});

test('H3 ★★흐름 밖 svg(말풍선 꼬리) — 감싸는 쪽이 ★그 상자를 물려받고 거울이 ★그려진다', async ({ page }) => {
  await scene(page);
  const r = await page.evaluate(async (ink) => {
    eval(ink);
    const mod = await import('/js/io/h2c-prep.js');
    const sec = document.querySelector('#canvas .section-block:not([data-ghost])');
    const out = {};
    for (const [label, tf] of [['identity', 'scaleX(1)'], ['mirror', 'scaleX(-1)']]) {
      const clone = sec.cloneNode(true);
      clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;';
      document.body.appendChild(clone);
      const tail = clone.querySelector('.tb-bubble-tail');
      const svgBox = tail.getBoundingClientRect();
      tail.style.transform = tf;                 // ★둘 다 lift 대상(none 이 아니다) ⇒ ★랩 기하가 ★같다
      const lifted = mod.liftSvgTransformsForH2C(clone);
      const t2 = clone.querySelector('.tb-bubble-tail');
      const wrap = t2.parentElement;
      const wb = wrap.getBoundingClientRect();
      const base = clone.getBoundingClientRect(), q = t2.getBoundingClientRect();
      const box = { x: q.left - base.left, y: q.top - base.top, w: q.width, h: q.height };
      const cv = await html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const s = cv.width / base.width;
      out[label] = { lifted, isWrap: wrap.dataset.h2cLift === '1',
        wrapBox: { w: +wb.width.toFixed(1), h: +wb.height.toFixed(1) },
        svgBox: { w: +svgBox.width.toFixed(1), h: +svgBox.height.toFixed(1) },
        m: inkOff(cv.getContext('2d'), cv.width, cv.height, { x: box.x*s, y: box.y*s, w: box.w*s, h: box.h*s }) };
      clone.remove();
    }
    return out;
  }, INK);
  console.log('[H3] ' + JSON.stringify(r));
  /* ★★랩 상자가 ★0×0 이면 안 된다 — ★그것이 ★처음 판의 결함이었다(실측 0×0 ⇒ 거울이 안 그려졌다) */
  for (const k of ['identity', 'mirror']) {
    expect(r[k].isWrap, `${k}: 감싸는 span 이 생겼다`).toBe(true);
    expect(r[k].wrapBox.w, `★★${k}: 랩 상자 폭 = svg 폭 (⛔0 이면 흐름 밖 갈래가 죽었다)`).toBe(r[k].svgBox.w);
    expect(r[k].wrapBox.h, `★★${k}: 랩 상자 높이 = svg 높이`).toBe(r[k].svgBox.h);
  }
  /* ★같은 랩 기하에서 ★조건만 바꿨다 ⇒ ★부호가 뒤집혀야 한다
     ⚠️꼬리는 ★거의 대칭이라 ★크기가 작다 — ★부호로만 판정한다(⛔크기로 판정하지 마라) */
  expect(r.identity.m.off, '전제 — identity 쪽 무게중심이 잡혔다').not.toBeNull();
  expect(r.mirror.m.off,   '전제 — mirror 쪽도 잡혔다').not.toBeNull();
  expect(r.identity.m.off * r.mirror.m.off, '★★거울이 ★그려졌다(부호 뒤집힘)').toBeLessThan(0);
});

test('H4 ★`transformOrigin` 을 ★물려준다 — ⛔빼면 다른 점을 중심으로 돈다', async ({ page }) => {
  await scene(page);
  const r = await page.evaluate(async () => {
    const mod = await import('/js/io/h2c-prep.js');
    const sec = document.querySelector('#canvas .section-block:not([data-ghost])');
    const clone = sec.cloneNode(true);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;';
    document.body.appendChild(clone);
    const svg = clone.querySelector('.laurel-leaf-right svg');
    const want = getComputedStyle(svg).transformOrigin;
    mod.liftSvgTransformsForH2C(clone);
    const svg2 = clone.querySelector('.laurel-leaf-right svg');
    const wrap = svg2.parentElement;
    const got = { wrapOrigin: wrap.style.transformOrigin, wrapTf: wrap.style.transform,
                  svgTf: svg2.style.transform, want };
    clone.remove();
    return got;
  });
  console.log('[H4] ' + JSON.stringify(r));
  expect(r.wrapOrigin, '★감싸는 쪽이 svg 의 transform-origin 을 ★그대로 받았다').toBe(r.want);
  expect(r.wrapTf, '★감싸는 쪽에 transform 이 옮겨졌다(matrix 꼴)').toMatch(/matrix\(/);
  expect(r.svgTf, '★svg 쪽은 꺼졌다').toBe('none');
});

test('H5 ★★live 를 ★안 건드린다 — 헬퍼를 돌려도 라이브 DOM 이 ★무변', async ({ page }) => {
  await scene(page);
  const r = await page.evaluate(async () => {
    const mod = await import('/js/io/h2c-prep.js');
    const sec = document.querySelector('#canvas .section-block:not([data-ghost])');
    const snap = () => {
      const g = (sel) => { const e = sec.querySelector(sel); if (!e) return null;
        const q = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return { x: +q.left.toFixed(1), w: +q.width.toFixed(1), tf: cs.transform,
                 wrapped: e.parentElement?.dataset?.h2cLift === '1' }; };
      return { R: g('.laurel-leaf-right svg'), T: g('.tb-bubble-tail') };
    };
    const before = snap();
    const clone = sec.cloneNode(true);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;';
    document.body.appendChild(clone);
    const lifted = mod.liftSvgTransformsForH2C(clone);
    clone.remove();
    return { lifted, before, after: snap() };
  });
  console.log('[H5] ' + JSON.stringify(r));
  expect(r.lifted, '전제 — 클론에서는 ★올렸다(0 이면 이 검사가 아무것도 안 잠근다)').toBeGreaterThan(0);
  expect(r.after, '★★라이브 DOM 은 ★한 글자도 안 바뀐다(자리·transform·감싸짐)').toEqual(r.before);
  expect(r.after.R.tf, '★라이브 오른 잎의 거울은 ★그대로 살아 있다').toMatch(/matrix\(-1/);
  expect(r.after.R.wrapped, '★라이브 쪽은 ★감싸지지 않았다').toBe(false);
});

test('H6 ★소비자 ★셋이 헬퍼를 ★부른다 — ⛔하나라도 빠지면 그 길만 조용히 틀린다', async () => {
  const CALL = /liftSvgTransformsForH2C\s*\(\s*clone\s*\)/;
  const IMP  = /import\s*\{[^}]*liftSvgTransformsForH2C[^}]*\}\s*from\s*['"]\.\/h2c-prep\.js['"]/;
  for (const f of ['js/io/save-load.js', 'js/io/capture-safety.js', 'js/io/export-image.js']) {
    const src = read(...f.split('/'));
    expect(src, `${f} 가 헬퍼를 ★들인다`).toMatch(IMP);
    expect(src, `${f} 가 헬퍼를 ★부른다`).toMatch(CALL);
  }
  /* ★④ redact-mosaic 은 ★뺐다 — ★킬스위치로 ★html2canvas 호출 0회다(아래 ⒞ 명부).
     ⛔그 사실이 ★바뀌면(모자이크 재개) ★이 단언이 ★거짓이 된다 ⇒ ★그때 ★넷째를 걸어라. */
  expect(read('js', 'feature-flags.js'), '★모자이크 킬스위치가 ★아직 false 다(④를 뺀 ★근거)')
    .toMatch(/REDACT_MOSAIC_ENABLED\s*=\s*false/);
});

test('H7 ★★«두 번 걸림»을 막는 자 — 헬퍼 뒤 svg 의 ★computed transform 이 `none` 이다', async ({ page }) => {
  /* ★★왜 재나(지디 2026-10-09) — 이 고침의 ★선 전제는 「h2c 는 svg 의 transform 을 ★어떤 꼴이든 안 그린다」다.
     ★만약 어떤 조건에서 ★존중하면 ★거울이 ★두 번 걸려(−1 × −1 = ＋1) ★원래대로 돌아오고,
     ★그 초록을 ★「원래 맞았다」로 ★읽을 참이다. ⇒ ★★그 길을 ★구조로 막는다: svg 쪽을 ★확실히 끈다.
     ⛔`svg.style.transform` ★만 보지 마라 — ★클래스가 이기는 판이 있을 수 있다 ⇒ ★computed 로 잰다.
     ★★그리고 `!important` 가 CSS 에 있으면 ★인라인 `none` 이 ★진다 ⇒ ★그 0건을 ★여기서 ★같이 문다. */
  await scene(page);
  const r = await page.evaluate(async () => {
    const mod = await import('/js/io/h2c-prep.js');
    const sec = document.querySelector('#canvas .section-block:not([data-ghost])');
    const clone = sec.cloneNode(true);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;';
    document.body.appendChild(clone);
    const lifted = mod.liftSvgTransformsForH2C(clone);
    const out = [...clone.querySelectorAll('svg')].map((sv) => ({
      cls: (sv.getAttribute('class') || '').slice(0, 24),
      computed: getComputedStyle(sv).transform,
      inline: sv.style.transform,
      wrapped: sv.parentElement?.dataset?.h2cLift === '1',
    })).filter((x) => x.wrapped);
    clone.remove();
    return { lifted, wrapped: out };
  });
  console.log('[H7] ' + JSON.stringify(r));
  expect(r.lifted, '전제 — 올린 것이 있다(0 이면 이 검사가 아무것도 잠그지 않는다)').toBeGreaterThan(0);
  expect(r.wrapped.length, '전제 — 감싸진 svg 수 = 올린 수').toBe(r.lifted);
  for (const x of r.wrapped) {
    /* ★★본 단언 — ★computed 가 `none` 이면 ★h2c 가 ★무엇을 하든 ★두 번 걸릴 길이 ★없다 */
    expect(x.computed, `★${x.cls || '(무클래스)'}: svg 의 ★computed transform 이 none`).toBe('none');
  }
  /* ★★`!important` 0건 — ★이게 깨지면 위 단언이 ★거짓이 될 수 있다. ★그 시한을 ★여기서 문다.
     ★★⛔주석을 ★먼저 ★벗겨라 — ★안 벗기면 ★거짓양성이 난다(실측 2026-10-09: `css/editor-blocks.css:101`
       ★주석 산문에 「transform:scale() … !important」가 들어 있어 ★이 게이트가 ★한 번 빨개졌다.
       ★참값은 ★0건이다). ★「주석은 ★소스 파싱 게이트의 ★입력」의 자리. */
  const cssAll = fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f.endsWith('.css'))
    .map((f) => read('css', f)).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');          // ★주석 제거(줄은 안 센다 — 개수만 본다)
  const bang = cssAll.match(/transform\s*:[^;}]*!important/g) || [];
  expect(bang, '★CSS 에 `transform: … !important` 선언이 ★0건이다(있으면 인라인 none 이 진다)').toEqual([]);
});

test('H8 ★★«정확히 한 번» — ⛔거울로는 1회와 2회를 ★못 가른다(−1×−1=＋1) ⇒ ★translateX 로 잰다', async ({ page }) => {
  /* ★★지디 ⒝ 를 ★고쳐 세운다 — ★거울은 ★제곱이 ★항등이라 「안 걸림」과 「두 번 걸림」이 ★★같은 값이다.
     ⇒ ★부호로는 ★홀·짝만 갈린다. ★★«정확히 한 번»을 재려면 ★★제곱이 항등이 ★아닌 변환이 필요하다.
     ★translateX: 0 / ★20 / ★40 ⇒ ★★세 값이 ★다르다. ⇒ ★무게중심 ★이동량을 ★픽셀로 잰다. */
  await bootApp(page);
  const r = await page.evaluate(async (ink) => {
    eval(ink);
    const mod = await import('/js/io/h2c-prep.js');
    const st = document.createElement('style');
    st.textContent = '.h8-t20{transform:translateX(20px);} .h8-t40{transform:translateX(40px);}';
    document.head.appendChild(st);
    /* ★가로로 좁은 막대 — 가운데가 뚜렷해 이동량을 ★픽셀로 읽기 쉽다 */
    const mk = (cls) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:-9999px;left:0;width:200px;height:40px;background:#fff;';
      d.innerHTML = '<svg width="200" height="40" viewBox="0 0 200 40"' + (cls ? ' class="' + cls + '"' : '')
        + '><rect x="20" y="10" width="20" height="20" fill="#111"/></svg>';
      document.body.appendChild(d); return d;
    };
    const shoot = async (cls, lift) => {
      const el = mk(cls);
      const lifted = lift ? mod.liftSvgTransformsForH2C(el) : 0;
      const cv = await html2canvas(el, { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const m = inkOff(cv.getContext('2d'), cv.width, cv.height, { x: 0, y: 0, w: cv.width, h: cv.height });
      /* ★절대 무게중심 x(px) — 이동량을 ★픽셀로 보려면 정규화를 ★풀어야 한다 */
      const cx = m.off === null ? null : +((m.off + 0.5) * cv.width).toFixed(2);
      el.remove();
      return { lifted, ink: m.ink, cx, w: cv.width };
    };
    const base = await shoot(null, true);        // transform 없음 ⇒ lifted 0
    const once = await shoot('h8-t20', true);    // ★헬퍼가 20px 를 올린다
    const twice = await shoot('h8-t40', true);   // ★«두 번 걸렸다면» 이 값일 참(40px)
    st.remove();
    return { base, once, twice };
  }, INK);
  console.log('[H8] ' + JSON.stringify(r));
  expect(r.base.lifted, '전제 — transform 없는 판은 ★0 을 올린다').toBe(0);
  expect(r.once.lifted, '전제 — 20px 판은 ★1 을 올린다').toBe(1);
  expect(r.base.cx, '전제 — 기준 무게중심이 잡혔다').not.toBeNull();
  const d1 = r.once.cx - r.base.cx;
  const d2 = r.twice.cx - r.base.cx;
  console.log('[H8 판정] 이동량 — 한 번=' + d1.toFixed(2) + 'px (기대 ≈20) · 두 번 기준=' + d2.toFixed(2) + 'px (기대 ≈40)');
  /* ★★본 단언 — ★한 번만 걸렸다: ★0 도 아니고 ★40(두 번)도 아니다 */
  expect(Math.abs(d1 - 20), `★★«정확히 한 번» — 이동량이 ★20px (잰 값 ${d1.toFixed(2)})`).toBeLessThan(3);
  expect(Math.abs(d1), '⛔「안 걸림」이 아니다').toBeGreaterThan(10);
  expect(Math.abs(d1 - d2), `⛔「두 번 걸림」이 아니다(두 번이면 ${d2.toFixed(2)}px)`).toBeGreaterThan(10);
});

/* ══ 양성대조·변이·0건 명부 — ★실측(2026-10-09 · 이 레인) ═════════════════════════════════
 * ⒜ ★판 = `origin/dev` `7c3b6cb7366a`. ★헬퍼를 ★끄고/켜고를 ★같은 판에서 ★같은 자로 견줬다
 *     (⛔live↔h2c 대조는 ★쓰지 않았다 — ★다른 렌더러라 ★transform 없는 갈래에서도 어긋난다).
 *     ★고치기 전 수 : 월계수 h2c L −0.1104 / R ★−0.1104(★같다) · ★참 렌더 L −0.2048 / R ＋0.1907
 *     ★고친 뒤     : 월계수 h2c L −0.1104 / R ★＋0.0964(★부호 갈림) · `lifted` = ★2
 *     ★꼬리(흐름 밖) : ★같은 랩 기하에서 identity −0.0203 → mirror ＋0.058 (★부호 뒤집힘)
 * ⒝ ★변이 — 「무엇을 끄면 어느 검사가 빨강인가」(★아래 ⒟ 에 수를 적는다)
 * ⒞ ⛔0건인 자리 — ★«구조상» / «장면을 좁혔다» ★갈라 적는다:
 *   ㉠ ★구조상 못 잰다
 *     · ★**`js/effects/redact-mosaic.js:264`** — ★h2c 호출이 ★**0회**다. `REDACT_MOSAIC_ENABLED=false`
 *       (feature-flags.js:208)이고 ★두 입구가 ★모두 `mosaicDisabled()` 로 먼저 막는다
 *       (`captureMosaicSnapshot:157` 「킬스위치 — html2canvas 호출 0회」 · `captureMosaicsAfterLoad:449`).
 *       ⇒ ★그래서 ★헬퍼를 ★안 걸었다. ★★모자이크가 ★재개되면 ★이 칸이 ★살아난다 ⇒ ★그때 ★넷째를 걸어라
 *         (★H6 의 마지막 단언이 ★그 시한을 ★물고 있다 — 플래그가 true 가 되면 ★빨개진다).
 *     · ★**`js/io/export-image.js:494`** — ★h2c 는 ★«CDP 없는 빌드(웹)» ★폴백이다. ★일렉트론 주 경로는
 *       CDP 네이티브라 ★브라우저가 거울을 그려 준다 ⇒ ★여기 병은 ★웹 빌드에서만 보인다. ★그 빌드를 ★안 띄웠다.
 *     · ★**배포(packaged) 앱** · ★**현빈이 보신 그 썸네일 PNG 자체** — ★같은 코드로 ★재현만 했다.
 *   ㉡ ★내가 ★장면/자를 좁혔다
 *     · ★**말풍선 `[data-tail="center"]`**(`translateX(-50%)` · editor-blocks.css:3074) — ★잉크 0 으로
 *       나와 ★못 쟀다(★내 상자가 빗나갔다). ★헬퍼는 ★그 갈래도 올리지만 ★«그려지나»는 ★안 쟀다.
 *     · ★**블록을 ★기본 상태로만** 놓고 전수했다(41개 중 `addDeviceMockupBlock` ★1개는 ★아무것도 안 생겨 ★미측정).
 *       ⇒ ★옵션·변형에 ★더 있을 수 있다. ★전수 결과 = ★svg 에 transform 닿는 블록 ★**2개**(월계수·말풍선).
 *     · ★**꼬리의 ★잉크 수**가 identity 243 vs mirror 196 으로 ★안 같다(순수 거울이면 ★면적 보존이어야).
 *       ⇒ ★부호로만 판정했다. ★까닭 미확정(경계 안티앨리어싱 추정) — ⛔「추정」이라 적는다.
 *     · ★**`zoom` 100 한 값** · ★**scale:2 경로**(capture-safety)는 ★scale:1 로만 쟀다.
 */
