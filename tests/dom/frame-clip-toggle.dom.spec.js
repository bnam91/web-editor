/* frame-clip-toggle — ★★프레임 「★내용 자르기」 ★★토글을 ★★«사람이 누르는 길»로 잰다 (2026-10-10)
 *
 * ★★★왜 이 파일이 ★있나 — ★★공백이 ★있었다. ★★그리고 ★그 공백은 ★현빈 결정의 ★자리였다.
 *   ★실측(2026-10-10): ★`ss-clip-toggle`(프레임 패널의 그 체크박스)을 ★★«누르는» 자가
 *     ★★`tests/` ★전체에 ★★★0건이었다. ★에셋 쪽은 ★`asset-clip-toggle.dom.spec.js` ★AC1 이 ★있었다.
 *   ⇒ ★★비대칭이었고, ★★빈 쪽이 ★★더 중요한 쪽이었다 — ★★«프레임 기본이 ★자름»은 ★★현빈 1009t3-② 다.
 *   ⇒ ★★★이 칸이 ★그 결정을 ★★«패널을 눌러서» ★잠그는 ★첫 칸이다.
 *
 * ★★★⛔다만 ★범위를 ★좁혀 적는다 — ★★«프레임이 ★자른다»는 ★★이미 ★재어진다:
 *   ★`frame-clip-drag.dom.spec.js` ★K1(히트) · ★K3f(픽셀) · ★K6(픽셀 ＋ 닿는 규칙 전수)
 *   ⇒ ★★그러니 ★이 파일이 ★새로 ★잠그는 것은 ★★★«패널 토글 → 그림»의 ★★«배선»이다.
 *     ⛔«프레임이 자른다»를 ★이 파일이 ★처음 잠갔다고 ★적지 ★마라.
 *
 * ★★★그리고 ★★에셋과 ★★갈리는 자리가 ★★하나 있다 — ★★«되돌림»의 ★꼴이다:
 *   ★에셋: ★다시 켜면 ★★속성을 ★★지운다(⇒ ★인라인 0 · ★옛 바이트 보존 · ★AC1 이 그것을 잠근다)
 *   ★★프레임: ★다시 켜면 ★★명시 ★`'true'` 를 ★쓴다(⇒ ★속성이 ★남는다)
 *   ⇒ ★★★같은 결과(자른다)인데 ★★꼴이 ★다르다 ⇒ ★★실패 방식도 ★다르다 ⇒ ★★여기 ★박아 둔다.
 *
 * ★★안 재는 것 (⛔「닫았다」로 적지 않는다)
 *   · ★★그 체크박스가 ★★«마우스로 ★닿나»(가려짐·면적) — ★아래가 ★★진짜 클릭을 ★먼저 ★시도하고,
 *     ★★안 되면 ★`el.click()` 으로 ★물러서되 ★★★어느 길로 갔는지 ★★출력에 ★찍는다. ⛔조용히 ★물러서지 ★않는다
 *   · ★★저장·내보내기 ★왕복 — ★별 자리다
 *   · ★★그리드 — ★범위 밖(★flex `min-height:auto` 0 붕괴 · ★별건)
 */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { bootApp } = require('./_root-harness.js');

const VIEW_W = 1440, VIEW_H = 1000;
const TOGGLE = '#ss-clip-toggle';
/* ★★★사람이 ★손을 ★대는 자리는 ★★«라벨»이다 — ★진짜 `input` 은 ★★0×0 으로 ★숨어 있다.
   ★★★그게 ★설계임을 ★★무엇으로 ★아나(★지디 조건 2026-10-10 · ⛔말로만 ★적지 ★않는다):
     ★`css/editor-props.css:215`  ★`.prop-toggle input { opacity: 0; width: 0; height: 0; }`
     ★`css/editor-props.css:214`  ★`.prop-toggle { … width: 32px; height: 18px; cursor: pointer; }`
     ★`css/editor-props.css:216`  ★`.prop-toggle-track` 이 ★스위치를 ★그린다
   ⇒ ★★즉 ★★«커스텀 토글»이다 — ★★input 의 ★면적 ★0 은 ★★결함이 ★아니라 ★★그 꼴의 ★일부다
   ★★실측(2026-10-10 ★1차 회차): ★input bbox ★★0x0 · ★그 점의 요소 ★`label.prop-toggle` · ★`isSelf true`
     ⇒ ★★`isSelf` 가 ★★그걸 말한다 — ★그 점의 요소가 ★그 input 을 ★★품은 ★라벨이다
   ⇒ ★★⛔그래서 ★input 의 ★면적을 ★요구하지 ★않는다. ★★라벨의 ★면적을 ★잰다 */
const TOGGLE_LABEL = 'label.prop-toggle:has(#ss-clip-toggle)';

/* ★장면 — ★`frame-clip-drag.dom.spec.js` ★`scene()` 과 ★★같은 앱 길이다(★그 파일이 ★정본).
   ⛔앱 밖에서 ★DOM 을 ★손으로 ★짓지 ★않는다 — ★그러면 ★«앱에서 ★이 꼴이 ★생기나»를 ★안 잰 것이 된다. */
async function scene(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: VIEW_H });
  await bootApp(page);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.();
    window.addSection();
    window.addFrameBlock();
    const fr = [...document.querySelectorAll('.frame-block')].find((f) => f.dataset.freeLayout === 'true');
    window.addTextBlock();
    return { frameId: fr.id, childId: [...fr.children].map((k) => k.id).pop() };
  });
  await page.evaluate(() => window.applyZoom?.(100));   /* ⛔배율 100% — 모델 px ≠ 화면 px 를 피한다 */
  await page.waitForTimeout(350);
  return { errs, ...ids };
}

/** ★자식을 ★프레임 ★오른쪽 밖으로 ★밀어 둔다 — ★`frame-clip-drag` 의 ★`pushChildOut` 과 ★같은 식 */
const pushOut = (page, f, c, by = 60) => page.evaluate(([f2, c2, d]) => {
  const fr = document.getElementById(f2), ch = document.getElementById(c2);
  ch.style.left = Math.round(Math.max(0, fr.clientWidth - ch.offsetWidth) + d) + 'px';
  return Math.round(ch.getBoundingClientRect().right - fr.getBoundingClientRect().right);
}, [f, c, by]);

const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

/** ★그 띠에 ★자식의 ★잉크가 ★있나 — ★숨겼다 찍어 ★견준다 */
async function inkInBand(page, childId, band) {
  const shown = md5(await page.screenshot({ clip: band }));
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error('다시 찾았는데 없다: ' + id);   /* ⛔널 가드가 «통과»가 되면 또 둔갑한다 */
    el.style.visibility = 'hidden';
  }, childId);
  const hidden = md5(await page.screenshot({ clip: band }));
  await page.evaluate((id) => { document.getElementById(id).style.visibility = ''; }, childId);
  return { ink: shown !== hidden, shown, hidden };
}

/** ★★그 띠가 ★잉크를 ★★보일 수 ★있나 — ⛔이게 죽으면 ★아래 ★모든 `false` 가 ★«안 쟀다»다 */
async function bandAlive(page, band) {
  const before = md5(await page.screenshot({ clip: band }));
  await page.evaluate((b) => {
    const d = document.createElement('div'); d.id = '__ALIVE__';
    d.style.cssText = 'position:fixed;left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.width
      + 'px;height:' + b.height + 'px;background:#00ff00;z-index:99999;';
    document.body.appendChild(d);
  }, band);
  await page.waitForTimeout(120);
  const during = md5(await page.screenshot({ clip: band }));
  await page.evaluate(() => document.getElementById('__ALIVE__')?.remove());
  await page.waitForTimeout(80);
  return before !== during;
}

/** ★★★«사람 손이 ★닿나»를 ★★세 줄로 ★가른다 (지디 조건 2026-10-10 · ⛔별 창을 ★쓰지 ★않는다).
 *  ★순서는 ★★«닿는가 → 불리는가 → 맞는 갈래인가» 중 ★첫 칸이다.
 *  ★★갈래별 ★처분을 ★★미리 ★적는다 — ⛔재고 나서 ★고르지 ★않게:
 *    ★㈀ ★뷰포트 ★밖뿐          ⇒ ★★장면의 흠 ⇒ ★이 파일이 ★`scrollIntoViewIfNeeded` 먼저 하고 ★진짜 클릭
 *    ★★㈁ ★면적 ★0 또는 ★가려짐 ⇒ ★★★제품 결함 ⇒ ⛔이 칸의 ★몫이 ★아니다(★수만 올린다 · ★별 티켓)
 *       ⇒ ★★그리고 ★이 칸은 ★`el.click()` 길을 ★★찍은 채 ★★초록으로 ★닫는다 —
 *         ⛔제품 결함으로 ★영구 빨강이 되면 ★★다음 ★참 빨강을 ★가린다
 *    ★★㈂ ★셋 다 ★멀쩡한데 ★타임아웃 ⇒ ★★«닿는가»가 ★아니라 ★★«불리는가»다 ⇒ ★★별건 */
async function reachability(page) {
  const loc = page.locator(TOGGLE_LABEL);
  const b0 = await loc.boundingBox().catch(() => null);
  let b1 = b0, scrolled = false;
  if (!b0 || b0.width < 1 || b0.height < 1) {
    await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    scrolled = true;
    b1 = await loc.boundingBox().catch(() => null);
  }
  const hit = await page.evaluate((s2) => {
    const el = document.querySelector(s2);
    if (!el) return { err: '다시 찾았는데 없다' };
    const inp = document.querySelector('#ss-clip-toggle');
    const ri = inp ? inp.getBoundingClientRect() : null;
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    const sel = top ? (top.id ? '#' + top.id : top.tagName.toLowerCase()
      + (top.className ? '.' + String(top.className).split(/\s+/)[0] : '')) : null;
    return { cx, cy, w: Math.round(r.width), h: Math.round(r.height),
             /* ★★input 의 크기는 ★★«사실»로만 ★싣는다 — ⛔단언하지 ★않는다(★설계가 ★바뀔 수 ★있다) */
             inpW: ri ? Math.round(ri.width) : null, inpH: ri ? Math.round(ri.height) : null,
             isSelf: !!(top && (top === el || el.contains(top) || top.contains(el))), top: sel,
             vw: window.innerWidth, vh: window.innerHeight };
  }, TOGGLE_LABEL);
  /* ★갈래를 ★★이름으로 ★정한다 — ⛔«타임아웃이었다»로 ★뭉개지 ★않는다 */
  let kind;
  if (hit.err) kind = '요소없음';
  else if (!hit.w || !hit.h) kind = '면적0';
  else if (!hit.isSelf) kind = '가려짐';
  else if (!b0 && b1) kind = '뷰포트밖(스크롤로 해결)';
  else if (!b0 && !b1) kind = '박스없음';
  else kind = '닿는다';
  return { kind, scrolled, b0, b1, ...hit };
}

/** ★★토글을 ★누른다 — ★진짜 클릭을 ★먼저, ★안 되면 ★`el.click()`. ★★어느 길인지 ★돌려준다 */
async function pressToggle(page) {
  /* ★★★라벨을 ★누른다 — ★★그것이 ★«사람이 하는 ★순서»다(★input 은 ★0×0 으로 ★숨어 있다) */
  await page.locator(TOGGLE_LABEL).scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  try {
    await page.locator(TOGGLE_LABEL).click({ timeout: 2500 });
    return 'mouse(label)';
  } catch (e) {
    await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) throw new Error('다시 찾았는데 없다: ' + s);
      el.click();
    }, TOGGLE);
    return 'el.click (★라벨에 ★마우스가 ★안 닿았다: ' + String(e).split('\n')[0].slice(0, 70) + ')';
  }
}

const read = (page, frameId) => page.evaluate((f) => {
  const fr = document.getElementById(f);
  const cb = document.querySelector('#ss-clip-toggle');
  const rf = fr.getBoundingClientRect();
  const ch = fr.children[fr.children.length - 1];
  const rt = ch.getBoundingClientRect();
  const over0 = Math.round(rt.right - rf.right);
  return {
    /* ★★«사실»만 — ⛔파생 술어를 ★여기서 ★다시 세지 ★않는다(★그 파일의 ★그 규약) */
    attr: fr.dataset.clipContent ?? null,
    ov: getComputedStyle(fr).overflow,
    ovInline: fr.style.overflow || null,
    checked: cb ? cb.checked : null,
    cbExists: !!cb,
    over: over0,
    /* ★★띠는 ★★«넘친 폭»에 ★맞춘다 — ⛔넓게 잡으면 ★대부분이 ★빈칸이라 ★차이가 ★묻힌다.
       ★`frame-clip-drag` ★K3f 의 ★그 꼴 ★그대로(★x=right+1 · ★폭=넘침−2 · ★위아래 2px 안쪽) */
    band: { x: Math.round(rf.right + 1), y: Math.round(rt.top + 2),
            width: Math.max(4, over0 - 2), height: Math.max(4, Math.round(rt.height) - 4) },
  };
}, frameId);

test('FT1 ★★프레임 「내용 자르기」 ★토글을 ★★눌러서 — ★★켬(기본)은 ★안 그려지고 ★★★끔은 ★그려진다 (현빈 1009t3-②)', async ({ page }) => {
  const { errs, frameId, childId } = await scene(page);

  /* ─── ⑴ ★프레임을 ★고르고 ★패널을 ★연다 — ★★사람이 하는 ★순서다 ─── */
  const f = await page.evaluate((id) => {
    const fr = document.getElementById(id); fr.scrollIntoView({ block: 'center' });
    const b = fr.getBoundingClientRect();
    return { x: Math.round(b.left + 8), y: Math.round(b.top + 8) };
  }, frameId);
  await page.mouse.click(f.x, f.y);
  await page.waitForTimeout(350);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), frameId),
    '★전제: 프레임을 ★못 골랐다 — ★패널이 ★안 떠 ★아래가 ★뜻이 없다').toBe(true);
  await page.evaluate((id) => window.showFrameProperties(document.getElementById(id)), frameId);
  await page.waitForTimeout(250);

  /* ★★★«닿나»를 ★먼저 가른다 — ★★누르기 ★전에, ★같은 회차에서 */
  const reach = await reachability(page);

  const by = await pushOut(page, frameId, childId);
  /* ★★★자식에 ★단색을 ★깐다 — ⛔이 줄이 ★없으면 ★★양성대조가 ★죽는다.
     ★★까닭은 ★`frame-clip-drag.dom.spec.js` ★K3f 가 ★★이미 적어 뒀다:
       「★글자는 ★왼쪽에 ★몰려 ★★넘친 폭이 ★빈칸이 되어 ★양성대조가 ★죽는다」
     ★★★그리고 ★★나도 ★1차 회차에서 ★그대로 ★밟았다(2026-10-10 · ★ink false/false/false)
       ⇒ ★★«해법이 ★문서에 ★있어도 ★안 읽히면 ★없는 것과 ★같다»의 ★그 자리다. */
  await page.evaluate((c) => {
    const ch = document.getElementById(c);
    if (!ch) throw new Error('다시 찾았는데 없다: ' + c);
    ch.style.background = '#0000ff';
  }, childId);
  await page.waitForTimeout(120);
  const g0 = await read(page, frameId);

  /* ─── ★전제 ★넷 — ⛔하나라도 안 서면 ★아래는 ★«안 쟀다»다 ─── */
  expect(g0.cbExists, '★★전제: ★패널에 ★그 체크박스가 ★없다 — ★`showFrameProperties` 가 ★안 그렸다').toBe(true);
  expect(g0.attr, '★전제: ★이 칸은 ★★«속성 없음»(=기본)에서 ★시작한다').toBe(null);
  expect(g0.checked, '★★★전제: ★속성이 ★없는데 ★체크박스가 ★★꺼져 있다 — ★★패널이 ★공용 술어를 ★안 읽는다').toBe(true);
  expect(g0.ov, '★전제: 기본인데 computed overflow 가 ★hidden 이 ★아니다 — ★CSS 쪽이 ★바뀠다').toBe('hidden');
  expect(g0.over, `★전제: ★자식을 ★밖으로 ★못 밀었다 (넘침 ${g0.over}px · 잰 값 ${by}px)`).toBeGreaterThan(20);
  expect(await bandAlive(page, g0.band),
    '★★★띠가 ★죽었다 — ★초록 네모를 둬도 ★잉크가 ★안 생긴다 ⇒ ★★아래 ★모든 `false` 가 ★«못 쟀다»다').toBe(true);
  const s0 = await inkInBand(page, childId, g0.band);

  /* ─── ⑵ ★★눌러서 ★끈다 — ★★이것이 ★이 파일의 ★본론이다 ─── */
  const how1 = await pressToggle(page);
  await page.waitForTimeout(250);
  const g1 = await read(page, frameId);
  const s1 = await inkInBand(page, childId, g1.band);

  /* ─── ⑶ ★★다시 ★눌러서 ★켠다 ─── */
  const how2 = await pressToggle(page);
  await page.waitForTimeout(250);
  const g2 = await read(page, frameId);
  const s2 = await inkInBand(page, childId, g2.band);

  console.log(`FT1 ★잰 값 — 넘침 ${g0.over}px`
    + ` · 기본[attr ${g0.attr} / checked ${g0.checked} / ov ${g0.ov} / ink ${s0.ink}]`
    + ` · 끔[attr ${g1.attr} / checked ${g1.checked} / ov ${g1.ov} / ink ${s1.ink}]`
    + ` · 되켬[attr ${g2.attr} / checked ${g2.checked} / ov ${g2.ov} / ink ${s2.ink}]`
    + ` · 누른 길 ⑵ ${how1} · ⑶ ${how2}`
    + ` · ★닿나[${reach.kind}] ★라벨 bbox ${reach.w}x${reach.h} @(${reach.cx},${reach.cy})`
    + ` · ★input bbox ${reach.inpW}x${reach.inpH}(★0×0 은 ★설계 — editor-props.css:215)`
    + ` 뷰포트 ${reach.vw}x${reach.vh} · 그 점의 요소 ${reach.top} · isSelf ${reach.isSelf}`);

  /* ★★★양성대조 ★먼저 — ★★끔에서 ★잉크가 ★생겨야 ★위 ★«기본의 false»가 ★뜻을 갖는다 */
  expect(g1.attr, '★★눌렀는데 ★속성이 ★★«명시 끔»이 ★아니다 — ★★배선(change 핸들러)이 ★안 돌았다').toBe('false');
  expect(g1.ov, '★★끔인데 computed overflow 가 ★visible 이 ★아니다 — ★CSS 가 ★토글을 ★안 읽는다').toBe('visible');
  expect(s1.ink, '★★★양성대조 ★죽었다 — ★★끔으로 바꿔도 ★프레임 밖에 ★잉크가 ★안 생긴다'
    + ` (보인 ${s1.shown} / 숨긴 ${s1.hidden}) ⇒ ★★아래 ★«기본의 false» 는 ★★«안 쟀다»다`).toBe(true);

  /* ★★본 측정 — ★★현빈 1009t3-② 를 ★★«패널을 눌러서» 잠근다 */
  expect(s0.ink, '★★★기본(속성 없음)인데 ★프레임 ★밖에 ★자식의 ★잉크가 ★있다 — ★★현빈 1009t3-② 가 ★죽었다').toBe(false);

  /* ★★되돌림 — ★★★에셋과 ★꼴이 ★다르다. ★그 ★다름을 ★여기 ★박는다 */
  expect(g2.attr, '★★★다시 눌렀는데 ★★«명시 켬»이 ★아니다 — ★프레임은 ★★속성을 ★지우지 ★않고 ★`true` 를 쓴다'
    + ' (★에셋은 ★지운다 — ★★같은 결과라도 ★꼴이 ★다르니 ★실패 방식도 ★다르다)').toBe('true');
  expect(g2.checked, '★★다시 눌렀는데 ★체크박스가 ★안 켜졌다').toBe(true);
  expect(s2.ink, '★★다시 켰는데 ★프레임 ★밖에 ★잉크가 ★남았다 — ★토글이 ★한 방향뿐이다').toBe(false);
  /* ★★★전제 — ★★두 해시를 ★견주기 ★전에 ★★«같은 네모»인지 ★확인한다.
     ⛔다른 크롭을 ★견주면 ★★항상 ★다르다(거짓 빨강) 또는 ★★우연히 같다(거짓 초록) — ★둘 다 ★조용하다 */
  expect(g2.band, `★전제: ★«기본»과 ★«되켬»의 ★띠가 ★다른 네모다 — ★해시를 ★견줄 수 ★없다`
    + ` (기본 ${JSON.stringify(g0.band)} / 되켬 ${JSON.stringify(g2.band)})`).toEqual(g0.band);
  expect(s2.shown, '★★«기본»과 ★«되켬»의 ★그림이 ★다르다 — ★되켬이 ★원래 ★그림이 ★아니다').toBe(s0.shown);

  /* ★★★«닿나»는 ★★이 칸을 ★빨갛게 ★하지 ★않는다 — ★★갈래 ★㈁ 이면 ★제품 결함이고 ★별 티켓이다.
     ⛔제품 결함으로 ★이 칸이 ★영구 빨강이 되면 ★★다음 ★참 빨강을 ★가린다(지디 2026-10-10).
     ⇒ ★★대신 ★★«요소가 ★있고 ★면적이 ★있다»까지는 ★★여기서 ★잠근다 — ★그건 ★패널이 ★그린 ★결과다 */
  /* ★★★«닿나» — ★★라벨을 ★잰다. ⛔숨은 input 의 ★면적을 ★요구하지 ★않는다(★그건 ★설계다) */
  expect(reach.w, `★★그 ★라벨의 ★폭이 ★0 이다 — ★사람이 ★손을 ★댈 자리가 ★없다 (${JSON.stringify(reach)})`)
    .toBeGreaterThan(0);
  expect(reach.h, `★★그 ★라벨의 ★높이가 ★0 이다 (${JSON.stringify(reach)})`).toBeGreaterThan(0);
  expect(reach.isSelf, `★★★라벨 ★중심점에 ★다른 것이 ★덮여 있다 — ★눌러도 ★토글에 ★안 간다`
    + ` (그 점의 요소 ${reach.top} · ${JSON.stringify(reach)})`).toBe(true);
  expect(reach.kind, `★★«닿나» 갈래가 ★`+`닿는다`+`가 ★아니다 — ${JSON.stringify(reach)}`).toBe('닿는다');

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
