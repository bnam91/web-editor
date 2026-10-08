/* fx-particles-panel — ★섹션 배경 파티클의 «켜는 칸»을 ★사람처럼 ★눌러서 잰다 (2026-10-08 현빈 발주 · 지디 GO)
 *
 * ★현빈 원문 — 「★패널에서 내가 만져보려는데」 ⇒ ★이 파일이 재는 것은 ★★«만질 수 있나»다.
 *
 * ★★왜 unit 으로 ★안 닫나 (★오늘 팀 교훈 ⑴ 「머지됐다 ≠ 앱에 있다 ≠ ★쓸 수 있다」):
 *   ★파티클이 ★그 셋을 ★다 보여줬다 — 커밋 7개·unit 초록인데 ★배선 2줄이 없어 앱에서 죽어 있었고(aecd7545),
 *   ★그 뒤에도 ★«켜는 칸»이 없어 ★쓸 수 없었다. ⇒ ★★소스·단위로는 ★그 셋을 ★못 가른다.
 *
 * ★칸 넷(발주 §1⑷):
 *   ㉠ D0  ★전제 — ★칸이 섹션 패널에 ★있나 ＋ ★★«창 안»인가 (⛔없으면 멈춘다)
 *   ⑵ D0b ★★«칸이 ★패널에 ★보인다» — ★섹션이면 있고 ★블럭이면 없다 (★★372벌 중 아무도 안 재던 축)
 *          ★★⛔D1(기능)과 ★섞지 않는다 — ★2026-10-08 참값이 ★⑵=false · ★⑶=true 였다
 *   ㉡ D1  ★양성 — ★누르면 ★층(FX_PARTICLES_WRAP)이 생기고 ★그 안에 ★노드가 ★공식과 같은 수만큼 (★수를 박는다)
 *   ㉢ D2  ★음성 — ★끄면 ★그릇이 사라진다(0개) ＋ ★★dataset ★남은 키 ★0개
 *          ★★그 둘째 칸은 ★지디 2026-10-08 지시다 — ★내 실측(값만 `''` 로 덮으면 ★키 둘이 ★고아로
 *            남아 ★저장본에 샌다)을 ★행위로 잠그는 자리다.
 *   ㉣ D3  ★★저장 왕복 — ★켠 뒤 ★저장→재로드 하면 ★다시 그려진다(★명부 길 `watchAllFx`)
 *          ★★가장 중요하다 — ★「손실 판정은 ★«다시 쓰일 때»로」
 *   ＋ D4  ★만지기 — ★프리셋·개수·모양이 ★정말 그림을 바꾼다
 *   ＋ D5  ★★작은 창(720) — ★칸이 ★여전히 ★창 안이고 ★눌린다
 *
 * ★★D5 를 ★왜 따로 두나 — ★오늘 `text-gradient` ★7칸이 ★정확히 그 병으로 빨갰다
 *   (토글 트랙 y=722 · 기본 뷰포트 innerHeight ★720 ⇒ ★2px 밖 ⇒ `locator.click` 30s 타임아웃).
 *   ⇒ ★내 칸은 ★「Background」 절(패널 ★둘째 절)에 있어 ★구조적으로 위쪽이다 —
 *     ★★그러나 ★「위쪽일 것이다」는 ★예상이고, ★D5 가 ★측정이다.
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다):
 *   · ★진짜 Electron 창·파일 저장 — 이 하네스는 `electronAPI` 가 가짜다(_root-harness 머리말의 그 명부)
 *   · ★사람 눈에 ★예쁜가 — ★QA 몫
 *   · ★상한에서의 ★«프레임» 무게 — ★★미측정. ★노드·바이트는 ★쟀다(particles-render.js PRESETS 머리말의 표)
 *     ⚠️★2026-10-08 상한이 ★60 → ★120 이 되어 ★노드가 ★약 ★1.9배다 ⇒ ★★프레임 위험은 ★더 커졌는데 ★여전히 안 쟀다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fx-particles-panel.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★★창 — ★공용 자리 ★하나다. ⛔회차마다 손으로 적지 마라.
   ★오늘 교훈: `text-gradient` 는 ★처방이 ★그 spec `:613` 주석에 ★이미 있었는데 ★G18 ★한 칸만 고쳐
     ★나머지 30칸이 ★그대로였다 ⇒ ★★「한 칸만 고치지 마라 — ★공용 자리에」. */
const VIEW_W = 1440, VIEW_H = 1000;
const SMALL_H = 720;                 /* ★오늘 7칸을 죽인 ★그 높이. ⛔바꾸지 마라 — ★이 수가 ★대조군이다 */

async function growViewport(page, h = VIEW_H) {
  await page.setViewportSize({ width: VIEW_W, height: h });
  const got = await page.evaluate(() => window.innerHeight);
  /* ★★1000 은 ★리터럴이다 — ⛔`toBeGreaterThanOrEqual(h)` 로 쓰면 ★「h 이상이 h 이상」이라
     ★항상 참이 되어 ★아무것도 안 잠근다. ★양성대조 = ★VIEW_H 를 720 으로 되돌리면 ★빨개진다. */
  expect(got, `창 높이가 모자라 패널 아래 칸이 화면 밖이다 (got ${got})`).toBeGreaterThanOrEqual(1000);
}

/** 섹션 하나를 만들고 ★섹션 패널을 ★연다. ⛔칸을 손으로 만들지 않는다 — ★앱이 그리는 그 길이다. */
async function setup(page, { h = VIEW_H } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: VIEW_W, height: h });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" id="pS" data-section="1" style="background:#0A0A0C">'
      + '<div class="section-hitzone"></div>'
      + '<div class="section-inner" style="padding-left:40px;padding-right:40px">'
      + '<div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    window.rebindAll?.(); window.deselectAll?.();
    const s = document.getElementById('pS');
    s.classList.add('selected');
    return window.showSectionProperties(s);
  });
  await page.waitForTimeout(250);
  return errs;
}

/** 칸 하나의 ★«정말 누를 수 있나» — ⛔`visible` 로 묻지 않는다.
 *  ★돌려주는 것: 사각형 ＋ ★그 점의 ★맨 위 요소(★null = ★화면 밖) ＋ ★창 안인가. */
const reach = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return { found: false };
  const b = el.getBoundingClientRect();
  const cx = Math.round(b.left + b.width / 2), cy = Math.round(b.top + b.height / 2);
  const top = document.elementFromPoint(cx, cy);
  return {
    found: true, cx, cy,
    w: Math.round(b.width), h: Math.round(b.height),
    innerH: window.innerHeight, innerW: window.innerWidth,
    inWindow: cy >= 0 && cy <= window.innerHeight && cx >= 0 && cx <= window.innerWidth && b.width > 0 && b.height > 0,
    topTag: top ? (top.id || top.tagName + '.' + top.className) : null,
    hits: !!(top && (top === el || el.contains(top) || top.contains(el))),
  };
}, sel);

/** ★층과 ★그림의 «수» — ⛔`> 0` 으로 묻지 않는다. ★공식(estimateNodes)과 ★견준다.
 *  ★★층 클래스는 ★`window.FX_PARTICLES_WRAP` 에서 ★읽는다 — ⛔spec 에 ★문자열을 박지 않는다.
 *    ★까닭(2026-10-08 지디 실측): ★지디가 ★`svg[data-fx="particles"]`·`.fx-particles` 같은
 *      ★★«없는 꼴»을 ★지어내 재서 ★★「기능이 안 돈다」는 ★거짓 결론이 ★날 자리였다.
 *    ⇒ ★그래서 ★`wrapClassFrom` 으로 ★★«무엇을 읽었나»를 ★결과에 ★같이 찍는다(★지디 처방). */
const drawn = (page) => page.evaluate(() => {
  const sec = document.getElementById('pS');
  const wrap = sec.querySelector(':scope > .' + window.FX_PARTICLES_WRAP);
  const cfg = window.readParticles(sec.dataset);
  return {
    wrapClassFrom: window.FX_PARTICLES_WRAP,      /* ★출처를 찍는다 — ⛔내가 지어낸 이름이 아니다 */
    wraps: sec.querySelectorAll(':scope > .' + window.FX_PARTICLES_WRAP).length,
    nodes: wrap ? wrap.querySelectorAll('*').length : 0,
    svgLen: wrap ? wrap.innerHTML.length : 0,
    on: !!window.hasParticles(sec.dataset),
    cfg,
    /* ★공식 — ★제품이 ★제 입으로 내는 수(⛔검사가 손으로 세지 않는다) */
    est: cfg ? window.ParticlesFx.estimateNodes(cfg) : 0,
    /* ★dataset 에 ★우리 이름으로 ★남은 키 — ★㉢ 의 둘째 칸 */
    leftKeys: Object.keys(sec.dataset).filter((k) => /^fxParticles/.test(k)),
  };
});

/* ═══ ㉠ D0 전제 ═════════════════════════════════════════════════════════════ */

test('D0 ㉠ ★전제 — ★칸이 섹션 패널에 ★있고 ★창 안이며 ★누를 수 있다', async ({ page }) => {
  const errs = await setup(page);
  await growViewport(page);

  /* ★★⑴ 칸이 ★거기 있나 — ⛔없으면 ★아래 전부가 ★뜻이 없다 */
  const t = await reach(page, '#sec-fxpart-toggle');
  expect(t.found, '⛔★섹션 패널에 파티클 칸이 ★없다 — 여기서 멈춘다(발주의 그 칸이 안 붙었다)').toBe(true);

  /* ★★⑵ ★창 안인가 — ★오늘 7칸을 죽인 그 축 */
  expect(t.inWindow, `★칸이 ★창 밖이다 (중심 y=${t.cy} · 창 높이=${t.innerH}) — 작은 창에서 못 누른다`).toBe(true);

  /* ★★⑶ ★정말 ★맨 위인가 — ⛔`visible` 이 ★「누를 수 있다」를 보증하지 않는다 */
  expect(t.topTag, `★그 점의 맨 위 요소가 ★null 이다 — ★화면 밖이다 (y=${t.cy}/${t.innerH})`).not.toBeNull();
  expect(t.hits, `★그 점의 맨 위가 ★남이다 (맨 위=${t.topTag}) — 무언가가 칸을 덮고 있다`).toBe(true);

  /* ★★⑷ ★자리 — ★「Background」 절 ★안인가 (지디 2026-10-07 Q1 판정 ⒞) */
  const where = await page.evaluate(() => {
    const el = document.getElementById('sec-fxpart-toggle');
    const sect = el?.closest('.prop-section');
    return { title: sect?.querySelector('.prop-section-title')?.textContent?.trim() || null };
  });
  expect(where.title, '★칸이 ★Background 절 밖에 붙었다 — 지디 판정 ⒞ 의 자리가 아니다').toBe('Background');

  /* ★★⑸ ★끈 상태가 ★출발점이다 — ⛔이미 켜져 있으면 ★D1 의 「켜진다」가 ★항상 참이다 */
  const d = await drawn(page);
  expect(d.on, '★전제: 새 섹션은 파티클이 꺼져 있다').toBe(false);
  expect(d.wraps, '★전제: 아직 층이 없다').toBe(0);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ ⑵ D0b ★★«패널에 칸이 ★보인다» — ★★지금 372벌 중 ★아무도 안 재는 축 ════════ */

test('D0b ⑵ ★★«칸이 ★패널에 보인다» — ★섹션이면 ★있고, ★블럭이면 ★없다', async ({ page }) => {
  /* ★★이 검사가 ★없어서 ★현빈이 ★앱을 ★직접 보고 ★발견했다(2026-10-08 「파티클 기능이 왜 없냐 아직?」).
     ★★지디 실측: ★DOM 372벌 중 ★패널을 ★거치는 spec 은 ★45벌(12%) 뿐이고,
       ★파티클 spec ★둘(fx-particles-persist · fx-particles-section)은 ★`window.*` ★직접 호출 ★12건 ·
       ★`locator().click` ★0건 · ★패널 경유 ★★0건이다.
     ⇒ ★★그 둘은 ★이 결함을 ★★영원히 못 잡는다 — ★«사람이 하는 순서»(섹션 고르기 → 패널 열림 →
       ★칸 누르기)를 ★안 밟기 때문이다. ★★이 한 칸이 ★그 순서를 ★밟는 자다.
     ★★⛔⑶«기능이 돈다»(D1)와 ★섞지 않는다 — ★따로 빨개져야 ★어느 쪽이 깨졌는지 안다.
       ★2026-10-08 참값이 ★정확히 ★그 꼴이었다: ★⑵=false · ★⑶=true
       ⇒ ★한 검사였다면 ★「파티클이 깨졌다」로 ★읽혔을 것이다(★처방까지 틀렸을 자리). */
  const errs = await setup(page);
  await growViewport(page);

  /* ★★⑴ ★섹션 패널 — ★칸이 ★보인다. ★자리는 ★`#panel-right`(★앱이 쓰는 그 그릇) */
  const panel = page.locator('#panel-right');
  await expect(panel, '★전제: 우측 패널 그릇이 없다 — 이 검사가 아무것도 못 잰다').toHaveCount(1);
  await expect(panel.locator('#sec-fxpart-toggle'),
    '⛔★섹션 패널에 ★파티클 칸이 ★없다 — ★★현빈이 본 ★그 결함이다').toHaveCount(1);
  /* ★사람이 ★읽는 글로도 ★보이나 — ⛔id 만 맞고 ★글이 비면 ★사람은 ★못 찾는다 */
  await expect(panel.getByText('파티클', { exact: false }).first(),
    '★패널에 ★「파티클」 이라는 ★글이 ★안 보인다').toBeVisible();

  /* ★★⑵ ★자리 — ★「Background」 절 ★안인가 (★지디 2026-10-07 Q1 판정 ⒞ · ★앱에서 확인된 절 이름) */
  const sects = await page.evaluate(() =>
    [...document.querySelectorAll('#panel-right .prop-section-title')].map((e) => e.textContent.trim()));
  expect(sects, '★전제: 섹션 패널에 ★Background 절이 ★없다 — 자리를 못 잰다').toContain('Background');
  const host = await page.evaluate(() => document.getElementById('sec-fxpart-toggle')
    ?.closest('.prop-section')?.querySelector('.prop-section-title')?.textContent?.trim() || null);
  expect(host, `★칸이 ★Background 절 ★밖에 있다 (지금 절=${host} · 패널 절 전수=${sects.join('/')})`).toBe('Background');

  /* ★★⑶ ★★음성대조 — ★블럭을 고르면 ★그 칸이 ★★없다(★파티클은 ★섹션 배경이다).
     ★★⛔「없다」를 ★고장난 계측기로 재지 않는다 ⇒ ★먼저 ★★«패널이 ★정말 블럭으로 바뀌었나»를 ★단언한다.
       ★그 표식 = ★`#asset-fx-section` — ★에셋 패널이 ★명부 다리(`fxSectionHtml`)로 ★그리는 ★그 절이다
       (prop-asset.js:231). ⇒ ★★이 한 줄이 ★덤으로 ★★「반사·그림자는 ★블럭 패널에서 뜬다」도 ★잠근다. */
  await page.evaluate(() => {
    const inner = document.querySelector('#pS .section-inner');
    inner.insertAdjacentHTML('beforeend', '<div class="asset-block" id="pA" style="height:80px"></div>');
    window.rebindAll?.();
    window.showAssetProperties(document.getElementById('pA'));
  });
  await page.waitForTimeout(200);
  await expect(panel.locator('#asset-fx-section'),
    '★전제 깨짐: ★에셋 패널이 ★안 열렸다 — 아래 「칸이 없다」가 ★증인이 못 된다').toHaveCount(1);
  await expect(panel.locator('#sec-fxpart-toggle'),
    '⛔★★블럭 패널에 ★섹션 파티클 칸이 ★떴다 — ★자리가 틀렸다(파티클은 섹션 배경이다)').toHaveCount(0);

  /* ★★⑷ ★섹션으로 ★돌아오면 ★다시 ★보인다 — ⛔한 번 사라지고 ★안 돌아오면 ★못 쓴다 */
  await page.evaluate(() => window.showSectionProperties(document.getElementById('pS')));
  await page.waitForTimeout(200);
  await expect(panel.locator('#sec-fxpart-toggle'),
    '★섹션으로 돌아왔는데 ★칸이 ★안 돌아왔다').toHaveCount(1);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ ㉡ D1 양성 ═════════════════════════════════════════════════════════════ */

test('D1 ㉡ ★양성 — ★누르면 층이 생기고 ★그 안에 ★노드가 ★공식과 같은 수만큼 난다', async ({ page }) => {
  const errs = await setup(page);
  await growViewport(page);
  expect((await drawn(page)).on, '★전제: 누르기 «전»에는 꺼져 있다').toBe(false);

  await page.click('#sec-fxpart-toggle');          /* ★사람이 하는 그 동작 */
  await page.waitForTimeout(150);

  const d = await drawn(page);
  expect(d.on, '★눌렀는데 ★안 켜졌다 — hasParticles 가 false 다').toBe(true);
  expect(d.wraps, `★층(.${d.wrapClassFrom})이 ★${d.wraps} 개다 — 하나여야 한다`).toBe(1);
  expect(d.svgLen, '★층이 ★비었다 — 켜지기만 하고 ★그림이 안 났다').toBeGreaterThan(500);

  /* ★★수를 박는다 — ⛔`> 0` 이 아니다. ★제품의 ★공식과 ★실제 DOM 노드가 ★같아야 한다.
     ★그 둘은 ★다른 길로 난다: ★est 는 ★계산 · ★nodes 는 ★svg() 가 지은 글자를 ★브라우저가 ★판 것.
     ⇒ ★★어느 한쪽만 틀려도 ★갈린다(★particles-render.js:98 이 ★같은 말을 한다 — ⛔공식을 믿지 마라). */
  expect(d.nodes, `★그려진 노드 수(${d.nodes})가 ★공식(${d.est})과 다르다 — 그림과 계산이 갈렸다`).toBe(d.est);
  /* ★★바닥 — ★입자 수보다 ★많아야 한다(⛔「빈 svg 한 장」이 ★초록으로 지나가지 않게).
     ⛔133 같은 ★맨숫자를 ★적지 않는다 — ★MAX_COUNT 가 바뀌면 ★거짓 빨강이 된다. */
  expect(d.nodes, `★노드(${d.nodes})가 ★입자 수(${d.cfg.count}) 이하다 — 껍데기만 났다`).toBeGreaterThan(d.cfg.count);
  /* ★기본값이 ★프리셋 ★첫 값인가 — ★발주 §4⑵ 의 그 안전기본값(지디 승인) */
  const first = await page.evaluate(() => window.ParticlesFx.KINDS[0]);
  expect(d.cfg.preset, '★켤 때 ★기본 프리셋이 ★KINDS 의 첫 값이 아니다').toBe(first);
  /* ★seed 가 ★섰나 — ⛔1 로 고정이면 ★섹션 둘이 ★같은 그림이 된다 */
  expect(Number.isFinite(d.cfg.seed), '★seed 가 수가 아니다').toBe(true);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ ㉢ D2 음성 ═════════════════════════════════════════════════════════════ */

test('D2 ㉢ ★음성 — ★끄면 층이 ★사라지고 ★dataset 에 ★남은 키가 ★0개다', async ({ page }) => {
  const errs = await setup(page);
  await growViewport(page);

  await page.click('#sec-fxpart-toggle');
  await page.waitForTimeout(150);
  const on = await drawn(page);
  /* ★★전제 먼저 — ★켜진 적이 ★있어야 ★「사라졌다」가 ★증인이 된다 */
  expect(on.on, '★전제: 끄기 «전»에 켜져 있다').toBe(true);
  expect(on.wraps, '★전제: 끄기 전에 층이 있다').toBe(1);
  expect(on.leftKeys.sort(), '★전제: 켜면 키 둘이 선다').toEqual(['fxParticles', 'fxParticlesSeed']);

  await page.click('#sec-fxpart-toggle');          /* ★같은 단추가 ★끈다 */
  await page.waitForTimeout(150);

  const off = await drawn(page);
  expect(off.on, '★껐는데 ★hasParticles 가 ★여전히 true 다').toBe(false);
  expect(off.wraps, `★껐는데 ★층이 ★${off.wraps} 개 남았다 — 그릇이 안 사라졌다`).toBe(0);
  expect(off.nodes, '★껐는데 ★노드가 남았다').toBe(0);

  /* ★★여기가 ★지디 지시의 그 칸 — ★「끈 뒤 ★남은 키 ★0개」.
     ★★까닭(2026-10-08 내 실측): ★값만 `''` 로 덮으면 ★`hasParticles` 는 ★false 인데
       ★키 ★둘이 ★고아로 ★남아 ★저장본에 ★샌다 ⇒ ★위 단언 셋은 ★전부 초록인데 ★새고 있다.
     ⇒ ★★그 «조용한 샘»을 ★잡는 자는 ★이 한 줄뿐이다. */
  expect(off.leftKeys, `★끈 뒤 dataset 에 ★키가 남았다 (${off.leftKeys.join(',')}) — 저장본에 샌다. clearParticles 를 안 썼다`).toEqual([]);

  /* ★★다시 켤 수 있나 — ⛔끈 뒤 ★단추가 사라지면 ★되돌릴 길이 없다 */
  const back = await reach(page, '#sec-fxpart-toggle');
  expect(back.found, '★끈 뒤 ★켜는 단추가 ★사라졌다 — 다시 켤 길이 없다').toBe(true);
  expect(back.hits, '★끈 뒤 ★단추를 못 누른다').toBe(true);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ ㉣ D3 ★저장 왕복 — ★가장 중요하다 ════════════════════════════════════ */

test('D3 ㉣ ★★저장 왕복 — ★켠 뒤 저장→재로드 하면 ★같은 그림이 ★다시 난다', async ({ page }) => {
  const errs = await setup(page);
  await growViewport(page);

  await page.click('#sec-fxpart-toggle');
  await page.waitForTimeout(150);
  const before = await drawn(page);
  expect(before.on, '★전제: 저장하기 전에 켜져 있다').toBe(true);
  expect(before.nodes, '★전제: 저장하기 전에 그림이 났다').toBe(before.est);

  const r = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const sec = document.getElementById('pS');
    const WRAP = window.FX_PARTICLES_WRAP;
    const first = sec.querySelector(':scope > .' + WRAP).innerHTML;

    /* ★저장 — ★앱이 쓰는 ★그 세척 함수 */
    const host = document.createElement('div');
    host.appendChild(sec.cloneNode(true));
    window.serializeCleanRoot(host);
    const saved = host.innerHTML;

    /* ★음성대조 — ★편집 마커를 심었으면 ★사라져야 한다(세척이 ★진짜로 돌았나) */
    const savedHasKeys = /data-fx-particles=/.test(saved) && /data-fx-particles-seed=/.test(saved);

    /* ★다시 열기 — ★캔버스를 ★통째로 갈아 끼운다(★로드가 하는 그 길) */
    canvas.innerHTML = saved;
    window.rebindAll?.();
    const re = document.querySelector('.section-block');
    /* ★★명부 길로 ★다시 그린다 — ⛔`applySectionParticles` 를 ★직접 부르지 않는다.
       ★실앱에서 ★로드 뒤에 도는 자는 ★`watchAllFx`(effects-registry.js:136) 다. */
    const n = window.watchAllFx(canvas);
    const after = re.querySelector(':scope > .' + WRAP)?.innerHTML || '';
    return {
      savedHasKeys, n,
      same: after === first,
      afterLen: after.length, firstLen: first.length,
      afterNodes: re.querySelector(':scope > .' + WRAP)?.querySelectorAll('*').length || 0,
    };
  });

  expect(r.savedHasKeys, '★저장본에 ★dataset 두 키가 ★없다 — 다시 열면 ★그림이 안 난다').toBe(true);
  expect(r.n, '★명부 길(watchAllFx)이 ★그 섹션을 ★안 그렸다(돌려준 수 0)').toBeGreaterThan(0);
  expect(r.afterLen, '★다시 연 뒤 ★그림이 비었다').toBeGreaterThan(500);
  expect(r.afterNodes, `★다시 연 뒤 노드 수(${r.afterNodes})가 ★처음(${before.nodes})과 다르다`).toBe(before.nodes);
  /* ★★같은 seed = ★같은 그림 — ★그것이 ★이 설계의 계약이다(seeded-random.js:7) */
  expect(r.same, `★다시 열었더니 ★모습이 바뀌었다 (${r.firstLen} → ${r.afterLen} 글자) — 같은 seed 인데 다른 그림이다`).toBe(true);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ D4 ★만지기 — ★현빈이 할 그 일 ══════════════════════════════════════════ */

test('D4 ★프리셋·개수·모양을 ★만지면 ★그림이 ★따라 바뀐다', async ({ page }) => {
  const errs = await setup(page);
  await growViewport(page);
  await page.click('#sec-fxpart-toggle');
  await page.waitForTimeout(150);

  /* ⑴ ★프리셋 — ★둘째 값으로 바꾼다(⛔이름을 적지 않는다 · KINDS 에서 읽는다) */
  const kinds = await page.evaluate(() => window.ParticlesFx.KINDS);
  expect(kinds.length, '★전제: 프리셋이 둘 이상이다 — 아니면 「바꿨다」를 못 만든다').toBeGreaterThan(1);
  const before = await drawn(page);
  await page.click(`#sec-fxpart-presets [data-fxpart-preset="${kinds[1]}"]`);
  await page.waitForTimeout(150);
  const afterPreset = await drawn(page);
  expect(afterPreset.cfg.preset, '★프리셋을 골랐는데 ★저장값이 ★안 바뀌었다').toBe(kinds[1]);
  expect(afterPreset.svgLen, '★프리셋을 바꿨는데 ★그림이 ★그대로다').not.toBe(before.svgLen);
  /* ★seed 는 ★그대로 — ★선례(prop-sticker-glow.js:69)의 그 결 */
  expect(afterPreset.cfg.seed, '★프리셋을 바꿨더니 ★seed 가 바뀌었다 — 무늬 번호는 그대로여야 한다').toBe(before.cfg.seed);

  /* ⑵ ★개수 — ★슬라이더가 아니라 ★수 칸으로(결정적이다) */
  await page.fill('[data-fxpart-axis="count"]', '12');
  await page.dispatchEvent('[data-fxpart-axis="count"]', 'input');
  await page.waitForTimeout(150);
  const afterCount = await drawn(page);
  expect(afterCount.cfg.count, '★개수를 12 로 쳤는데 ★저장값이 ★안 따라왔다').toBe(12);
  expect(afterCount.nodes, `★개수 12 의 노드 수(${afterCount.nodes})가 ★공식(${afterCount.est})과 다르다`).toBe(afterCount.est);
  expect(afterCount.nodes, '★개수를 줄였는데 ★노드가 ★안 줄었다').toBeLessThan(afterPreset.nodes);

  /* ⑶ ★상한 — ⛔거절이 아니라 ★«자른다»(particles-render.js:164) */
  const max = await page.evaluate(() => window.ParticlesFx.MAX_COUNT);
  await page.fill('[data-fxpart-axis="count"]', String(max + 500));
  await page.dispatchEvent('[data-fxpart-axis="count"]', 'input');
  await page.waitForTimeout(150);
  expect((await drawn(page)).cfg.count, `★상한(${max})을 넘겨 쳤는데 ★안 잘렸다`).toBe(max);

  /* ⑷ ★모양 — ★하나 끄면 ★저장값에서 빠진다 */
  const shapesBefore = (await drawn(page)).cfg.shapes;
  expect(shapesBefore.length, '★전제: 이 프리셋은 모양이 둘 이상이다').toBeGreaterThan(1);
  await page.click(`#sec-fxpart-shapes [data-fxpart-shape="${shapesBefore[0]}"]`);
  await page.waitForTimeout(150);
  const shapesAfter = (await drawn(page)).cfg.shapes;
  expect(shapesAfter, `★모양 「${shapesBefore[0]}」 를 껐는데 ★그대로다`).not.toContain(shapesBefore[0]);
  expect(shapesAfter.length, '★모양 하나만 빠져야 한다').toBe(shapesBefore.length - 1);

  /* ⑸ ★★마지막 하나는 ★못 끈다 — ⛔다 끄면 `normalize` 가 ★프리셋으로 ★되돌려
         ★사람이 「껐는데 ★더 많아졌다」를 본다. ⇒ ★그 입력은 ★무시한다. */
  for (const k of (await drawn(page)).cfg.shapes.slice(0, -1)) {
    await page.click(`#sec-fxpart-shapes [data-fxpart-shape="${k}"]`);
    await page.waitForTimeout(80);
  }
  const one = (await drawn(page)).cfg.shapes;
  expect(one.length, `★모양을 다 끄려 했는데 ★${one.length} 개가 남았다 — 하나는 남아야 한다`).toBe(1);
  await page.click(`#sec-fxpart-shapes [data-fxpart-shape="${one[0]}"]`);
  await page.waitForTimeout(120);
  expect((await drawn(page)).cfg.shapes, '★마지막 모양이 ★꺼졌다 — 프리셋으로 되돌아간다').toEqual(one);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ D5 ★★작은 창 — ★오늘 7칸을 죽인 ★그 축 ═══════════════════════════════ */

test(`D5 ★★작은 창(${SMALL_H}) — ★들머리는 ★창 안이고, ★깊은 칸은 ★굴려서 ★닿는다`, async ({ page }) => {
  /* ★★이 회차는 ★growViewport 를 ★안 부른다 — ★★작은 창이 ★이 시험의 ★대상이다.
   *
   * ★★⛔2026-10-08 ★내가 ★여기서 ★틀렸다 — ★★«자»가 ★잘못된 것을 ★재고 있었다.
   *   ★1차(칸이 ★켜기 단추 하나)에선 ★「켠 뒤 ★모든 칸이 ★창 안이다」가 ★초록이었다.
   *   ★2차(★축 ★13개)에서 ★카드가 ★길어지자 ★★`#sec-fxpart-rot` 의 ★중심이 ★y=844 가 되어 ★빨갰다.
   *   ★★그때 ★내가 ★검사를 ★고치기 ★전에 ★★«참값»을 ★쟀다:
   *     ★★`css/editor-panels.css:281` — `.panel-body { flex: 1; ★overflow-y: auto; padding: 6px; }`
   *   ⇒ ★★**우측 패널은 ★굴러간다.** ★그러면 ★y=844 는 ★★«못 만진다»가 ★아니다 — ★사람은 ★굴린다.
   *   ⇒ ★★내 단언이 ★★«사람이 하는 일»이 아니라 ★★«첫 화면에 다 보이나»를 ★재고 있었다.
   *     ★그리고 ★★축이 ★많은 것은 ★★현빈이 ★요구한 것이다(「조절옵션들 왜 줄여」) ⇒
   *     ★★«창 안에 다 넣기»를 ★지키려면 ★★축을 ★줄여야 한다 — ★★그건 ★요구와 ★정반대다.
   *   ⛔그래서 ★★«느슨하게 풀었다»가 ★아니다 — ★★«재는 자리를 ★옮겼다». ★아래 둘로 ★갈랐다:
   *     ⑴ ★들머리(카드 머리·토글)는 ★★굴리지 ★않고도 ★창 안 — ★★«찾을 수 있나»
   *     ⑵ ★깊은 칸은 ★★굴린 뒤 ★창 안 ＋ ★맨 위 ＋ ★★진짜 눌림 — ★★«쓸 수 있나»
   *   ★★＋ ★전제로 ★★«패널이 ★정말 굴러가나»를 ★단언한다 — ⛔안 굴러가면 ⑵가 ★공허하다.
   *   ★★그리고 ★가장 ★깊은 칸(★끄기)을 ★★진짜 눌러 ★★«되돌릴 길이 있나»까지 ★잰다.
   *     ★그것이 ★오늘 `text-gradient` 7칸을 죽인 ★`locator.click` 타임아웃을 ★밟아 보는 자리다. */
  const errs = await setup(page, { h: SMALL_H });

  const got = await page.evaluate(() => window.innerHeight);
  /* ★★전제 단언 — ★★「작은 창에서」라 ★이름 붙였으면 ★재기 전에 ★그 창인지 ★단언한다.
     ⛔720 을 ★리터럴로 둔다 — `SMALL_H` 로 쓰면 ★항등식이다. */
  expect(got, `★전제 깨짐: 창이 ${got} 다 — 이 회차는 ★작은 창을 재야 한다`).toBe(720);

  /* ═══ ⑴ ★들머리 — ★굴리지 ★않고도 ★보이고 ★눌린다 ═══════════════════════ */
  const t = await reach(page, '#sec-fxpart-toggle');
  expect(t.found, '★작은 창에서 ★칸이 ★없다').toBe(true);
  expect(t.inWindow, `★★들머리가 ★화면 밖이다 (중심 y=${t.cy} · 창=${t.innerH}) — ★굴리기 전에 ★찾을 수조차 없다`).toBe(true);
  expect(t.topTag, `★그 점의 맨 위가 ★null 이다 — ★화면 밖 (y=${t.cy}/${t.innerH})`).not.toBeNull();
  expect(t.hits, `★그 점의 맨 위가 ★남이다 (맨 위=${t.topTag})`).toBe(true);

  await page.click('#sec-fxpart-toggle', { timeout: 5000 });
  await page.waitForTimeout(200);
  const d = await drawn(page);
  expect(d.on, '★작은 창에서 ★눌렀는데 ★안 켜졌다').toBe(true);
  expect(d.nodes, `★작은 창에서 노드 수(${d.nodes})가 ★공식(${d.est})과 다르다`).toBe(d.est);

  /* ★켠 ★뒤에도 ★카드 ★머리는 ★창 안이다 — ★★「어디 있는지」를 ★굴리지 않고 ★알 수 있어야 한다 */
  const head = await reach(page, '#sec-fxpart-head');
  expect(head.inWindow, `★★카드 머리가 ★화면 밖이다 (y=${head.cy}/${head.innerH}) — 파티클 칸을 ★못 찾는다`).toBe(true);

  /* ═══ ⑵ ★전제 — ★★패널이 ★정말 ★굴러가나 (⛔아니면 아래가 ★공허하다) ═════ */
  const sc = await page.evaluate(() => {
    const b = document.querySelector('#panel-right .panel-body');
    if (!b) return null;
    return { scrollH: b.scrollHeight, clientH: b.clientHeight, oy: getComputedStyle(b).overflowY };
  });
  expect(sc, '★전제: 우측 패널 몸(#panel-right .panel-body)을 못 찾았다').not.toBeNull();
  expect(sc.oy, `★전제: 패널이 ★안 굴러간다(overflow-y=${sc.oy}) — ★아래 「굴려서 닿는다」가 ★뜻이 없다`).toMatch(/auto|scroll/);
  expect(sc.scrollH, `★전제: 작은 창인데 ★굴릴 것이 ★없다 (scrollH ${sc.scrollH} ≤ clientH ${sc.clientH})`
    + ' — ★이 창에서는 ★굴림을 ★못 재므로 ★이 칸의 뜻이 약하다').toBeGreaterThan(sc.clientH);

  /* ═══ ⑶ ★깊은 칸 — ★★굴린 뒤 ★창 안 ＋ ★맨 위 ═════════════════════════ */
  const DEEP = ['#sec-fxpart-presets', '#sec-fxpart-reroll', '#sec-fxpart-seed',
                '[data-fxpart-axis="count"]', '[data-fxpart-axis="smin"]', '#sec-fxpart-colors',
                '[data-fxpart-axis="fxOpacity"]', '[data-fxpart-axis="jit"]', '#sec-fxpart-rot',
                '#sec-fxpart-dist', '[data-fxpart-axis="glow"]', '[data-fxpart-axis="spread"]',
                '#sec-fxpart-shapes', '#sec-fxpart-off'];
  for (const sel of DEEP) {
    const loc = page.locator(sel).first();
    await expect(loc, `★켠 뒤 ${sel} 가 없다`).toHaveCount(1);
    await loc.scrollIntoViewIfNeeded();        /* ★★사람이 하는 그 일 — 패널을 굴린다 */
    const r = await reach(page, sel);
    expect(r.inWindow, `★★굴린 뒤에도 ★${sel} 가 ★창 밖이다 (중심 y=${r.cy} · 창=${r.innerH}) — 못 만진다`).toBe(true);
    expect(r.hits, `★굴린 뒤 ★${sel} 의 맨 위가 ★남이다 (맨 위=${r.topTag}) — 무언가가 덮고 있다`).toBe(true);
  }

  /* ═══ ⑷ ★★가장 ★깊은 칸을 ★진짜 눌러 본다 — ★★«되돌릴 길»이 ★작은 창에도 있나 ═══
     ★`#sec-fxpart-off` 는 ★카드의 ★맨 끝이다 ⇒ ★그것이 ★눌리면 ★위의 전부가 ★닿는다.
     ⛔`timeout: 5000` — ★오늘 7칸은 ★30s 타임아웃으로 죽었다. ★짧게 두어 ★빨리 빨개지게. */
  await page.click('#sec-fxpart-off', { timeout: 5000 });
  await page.waitForTimeout(200);
  const off = await drawn(page);
  expect(off.on, '★★작은 창에서 ★끄기를 ★눌렀는데 ★안 꺼졌다 — 되돌릴 길이 없다').toBe(false);
  expect(off.leftKeys, `★작은 창에서 끈 뒤 ★키가 남았다 (${off.leftKeys.join(',')})`).toEqual([]);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ D6 ★★«축 전수»를 ★사람처럼 ★만진다 — ★★현빈이 「어디갔냐」 한 ★그 축들 ═════ */

test('D6 ★★시안의 축 전수 — ★이름·순서가 맞고 ★하나하나 ★만지면 ★값이 ★따라온다', async ({ page }) => {
  /* ★★현빈 2026-10-08 「파티클 ★시안보여줬던대로 ★안보이는데?? ★조절하는 항목들 ★어디갔냐??
       ★아티팩트에 있던것들 말야 ★조절옵션들 ★왜 줄여」
     ⇒ ★1차는 ★축이 ★`count` ★하나였다. ★이 칸이 ★«다시 줄어드는 것»을 ★행위로 막는다.
     ★★단위(P11·P12·P13)는 ★«칸이 나는가»를 재고, ★여기는 ★«눌러서 ★값이 바뀌는가»를 잰다. */
  const errs = await setup(page);
  await growViewport(page);
  await page.click('#sec-fxpart-toggle');
  await page.waitForTimeout(200);

  const panel = page.locator('#panel-right');

  /* ★★⑴ ★칸 이름·순서 — ★★앱에서도 ★시안 그대로인가(★단위가 아니라 ★실제 패널에서) */
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('#sec-fxpart-card .prop-label')].map((e) => e.textContent.trim()));
  expect(labels, '★★앱 패널의 칸 이름·순서가 ★시안과 다르다').toEqual(
    ['무늬번호', '갯수', '색', '크기', '불투명도', '흔들림', '회전', '분포', '글로우', '퍼짐', '모양']);

  /* ★★⑵ ★RANGES 축 전수가 ★칸을 가졌나 — ⛔7 을 적지 않는다. ★앱에서 ★센다 */
  const axes = await page.evaluate(() => ({
    ranges: Object.keys(window.ParticlesFx.RANGES).sort(),
    cells: [...document.querySelectorAll('[data-fxpart-axis]')].map((e) => e.dataset.fxpartAxis).sort(),
  }));
  expect(axes.cells, `★축 칸과 RANGES 키가 다르다 (칸 ${axes.cells} · RANGES ${axes.ranges})`).toEqual(axes.ranges);

  /* ★★⑶ ★축마다 ★눌러 본다 — ★★«중간값»을 넣어 ★저장값이 ★그 수가 되나.
     ⛔어느 축도 ★건너뛰지 않는다(★`for` 가 ★RANGES 를 돈다 ⇒ ★축이 늘면 ★여기도 ★같이 돈다). */
  for (const key of axes.ranges) {
    const r = await page.evaluate((k) => window.ParticlesFx.RANGES[k], key);
    /* ★중간값 — ★⛔min 이나 max 를 쓰면 ★「원래 그 값이었다」와 ★구분이 안 된다 */
    const mid = Math.round((r.min + r.max) / 2);
    const sel = `[data-fxpart-axis="${key}"]`;
    const was = (await drawn(page)).cfg[key];
    await page.fill(sel, String(mid));
    await page.dispatchEvent(sel, 'input');
    await page.waitForTimeout(90);
    const now = (await drawn(page)).cfg[key];
    /* ★★crop·min/max 뒤바뀜 보정이 있어 ★«정확히 mid»가 아닐 수 있다(smin>smax 면 swap)
       ⇒ ★★그래서 ★«칸이 보여 주는 수»와 ★«저장값»이 ★같은지로 잰다 — ★그것이 ★거짓말 안 하는 조건이다 */
    const shown = await page.inputValue(sel);
    expect(Number(shown), `★${key}: 칸에 보이는 수(${shown})와 저장값(${now})이 다르다 — 칸이 거짓말한다`).toBe(now);
    expect(now, `★${key}: ${was} → ${mid} 로 쳤는데 저장값이 ${now} 다 — 안 먹었다`).not.toBe(was);
  }

  /* ★★⑷ ★회전(참거짓) — ★RANGES 에 ★없는 축. ⇒ ★따로 잰다 */
  const rotWas = (await drawn(page)).cfg.rot;
  await page.click('#sec-fxpart-rot');
  await page.waitForTimeout(120);
  expect((await drawn(page)).cfg.rot, `★회전이 ${rotWas} 에서 안 바뀌었다`).toBe(!rotWas);

  /* ★★⑸ ★분포 — `DISTS` 에서 ★«지금 아닌 값»을 골라야 ★바뀜을 잰다 */
  const dists = await page.evaluate(() => window.ParticlesFx.DISTS);
  expect(dists.length, '★전제: 분포가 둘 이상이다').toBeGreaterThan(1);
  const distWas = (await drawn(page)).cfg.dist;
  const other = dists.find((d) => d !== distWas);
  await page.selectOption('#sec-fxpart-dist', other);
  await page.waitForTimeout(120);
  expect((await drawn(page)).cfg.dist, `★분포가 ${distWas} → ${other} 로 안 바뀌었다`).toBe(other);

  /* ★★⑹ ★무늬번호 — ★사람이 적는 수. ★같은 번호면 ★같은 그림이라는 계약도 ★같이 잰다 */
  const seedWas = (await drawn(page)).cfg.seed;
  await page.fill('#sec-fxpart-seed', '12345');
  await page.dispatchEvent('#sec-fxpart-seed', 'change');
  await page.waitForTimeout(120);
  const afterSeed = await drawn(page);
  expect(afterSeed.cfg.seed, `★무늬번호가 ${seedWas} → 12345 로 안 바뀌었다`).toBe(12345);
  const svgAt12345 = afterSeed.svgLen;
  /* ★다른 번호 → ★다른 그림 · ★돌아오면 ★같은 그림 (★결정성) */
  await page.fill('#sec-fxpart-seed', '999');
  await page.dispatchEvent('#sec-fxpart-seed', 'change');
  await page.waitForTimeout(120);
  await page.fill('#sec-fxpart-seed', '12345');
  await page.dispatchEvent('#sec-fxpart-seed', 'change');
  await page.waitForTimeout(120);
  expect((await drawn(page)).svgLen, '★같은 무늬번호로 돌아왔는데 ★그림 길이가 다르다 — 결정성이 깨졌다').toBe(svgAt12345);

  /* ★★⑺ ★다시 뿌리기 — ★seed 가 ★바뀐다 */
  const beforeRoll = (await drawn(page)).cfg.seed;
  await page.click('#sec-fxpart-reroll');
  await page.waitForTimeout(120);
  expect((await drawn(page)).cfg.seed, '★다시 뿌리기를 눌렀는데 ★무늬번호가 그대로다').not.toBe(beforeRoll);

  /* ★★⑻ ★색 — ★더하기 / ★빼기. ★상한 8 은 ★normalize 의 수다 */
  const csWas = (await drawn(page)).cfg.colors.length;
  await page.click('#sec-fxpart-color-add');
  await page.waitForTimeout(150);
  expect((await drawn(page)).cfg.colors.length, `★색 더하기를 눌렀는데 ${csWas} 에서 안 늘었다`).toBe(csWas + 1);
  await page.click('[data-fxpart-color-del="0"]');
  await page.waitForTimeout(150);
  expect((await drawn(page)).cfg.colors.length, '★색 빼기를 눌렀는데 안 줄었다').toBe(csWas);

  /* ★★⑼ ★접기 — ★패널 «표시»만. ⛔데이터는 ★안 변한다 */
  const cfgBeforeFold = JSON.stringify((await drawn(page)).cfg);
  await page.click('#sec-fxpart-fold');
  await page.waitForTimeout(120);
  await expect(panel.locator('#sec-fxpart-body'), '★접었는데 몸이 ★안 숨었다').toBeHidden();
  expect(JSON.stringify((await drawn(page)).cfg), '★접었더니 ★데이터가 바뀌었다 — 접기는 표시만이다').toBe(cfgBeforeFold);
  await page.click('#sec-fxpart-fold');
  await page.waitForTimeout(120);
  await expect(panel.locator('#sec-fxpart-body'), '★다시 펼쳤는데 몸이 ★안 보인다').toBeVisible();

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ D7 ★★상한에서 ★정말 그려지나 — ★★현빈 2026-10-08 「120개까지하자 최대」 ═════ */

test('D7 ★★상한(MAX_COUNT)에서도 ★그려진다 — ★노드 수가 ★공식과 맞고 ★시간을 ★기록한다', async ({ page }) => {
  /* ★★현빈 2026-10-08 상한을 ★60 → ★120 으로 올렸다. ⇒ ★노드가 ★약 ★1.9배다
       (★실측 2026-10-08: star 133→253 · gold 63→123 · 바이트 1.92x~2.03x).
     ⇒ ★★「올렸는데 ★안 그려진다」가 ★가장 큰 위험이다. ★이 칸이 ★그걸 잰다.
     ★★⛔시간에 ★빡빡한 문턱을 ★걸지 않는다 — ★이 맥은 ★여러 세션이 나눠 쓰고 ★load 가 ★5~85 로 흔든다
       ⇒ ★★문턱을 ★좁히면 ★그 검사는 ★부하에서 ★흔들리고, ★흔들리는 검사는 ★다음 빨강을 ★가린다.
       ⇒ ★★그래서 ⑴ ★«맞게 그려졌나»는 ★단단히 ★걸고 ⑵ ★«얼마나 걸렸나»는 ★★수로 ★기록한다
         ＋ ⑶ ★병이라고 볼 만큼 ★느릴 때만 ★빨개지는 ★너른 천장을 ★둔다.
     ★★⛔안 재는 것: ★섹션 ★여럿(N개)에 깔릴 때의 ★프레임 — ★★미측정이다(그 수는 ★아무도 안 쟀다). */
  const errs = await setup(page);
  await growViewport(page);
  await page.click('#sec-fxpart-toggle');
  await page.waitForTimeout(200);

  const max = await page.evaluate(() => window.ParticlesFx.MAX_COUNT);
  /* ★★전제 — ★개수를 ★상한으로 ★올린다. ⛔「원래 상한이었다」로 지나가지 않게 ★먼저 ★낮춘 뒤 ★올린다 */
  const sel = '[data-fxpart-axis="count"]';
  await page.fill(sel, '1');
  await page.dispatchEvent(sel, 'input');
  await page.waitForTimeout(120);
  expect((await drawn(page)).cfg.count, '★전제: 먼저 1 로 내렸다').toBe(1);

  const t0 = Date.now();
  await page.fill(sel, String(max));
  await page.dispatchEvent(sel, 'input');
  await page.waitForTimeout(150);
  const ms = Date.now() - t0;
  const d = await drawn(page);

  /* ⑴ ★★맞게 그려졌나 — ★단단히 */
  expect(d.cfg.count, `★상한 ${max} 로 올렸는데 저장값이 ${d.cfg.count} 다`).toBe(max);
  expect(d.wraps, '★상한에서 층이 하나가 아니다').toBe(1);
  expect(d.nodes, `★상한 ${max} 에서 노드(${d.nodes})가 공식(${d.est})과 다르다 — 그림과 계산이 갈렸다`).toBe(d.est);
  /* ★★노드가 ★개수보다 ★많다 — ⛔「빈 svg」가 초록으로 지나가지 않게. ⛔253 을 ★안 적는다 */
  expect(d.nodes, `★노드(${d.nodes})가 ★개수(${max}) 이하다 — 껍데기만 났다`).toBeGreaterThan(max);

  /* ⑵ ★★수를 ★기록한다 — ★다음 사람이 ★「얼마였나」를 ★이 메시지에서 읽는다
     ⛔산문에 손으로 박지 않는다(★잰 값을 ★그대로 단언 메시지에 넣는다). */
  const note = `★상한 ${max} · 노드 ${d.nodes} · svg ${d.svgLen}글자 · 한 섹션 다시그리기 ${ms}ms`;
  /* ⑶ ★★너른 천장 — ★병일 때만 빨개진다(★한 섹션 한 장면이 ★3초를 넘으면 ★무언가 잘못됐다) */
  expect(ms, `⛔★상한에서 ★한 섹션 ★다시그리기가 ★너무 느리다 — ${note}`).toBeLessThan(3000);
  /* ★★기록을 ★남긴다 — ⛔`console.log` 가 아니라 ★★«참인 단언의 메시지»로(러너가 실패 때만 찍지만
     ★이 줄이 ★spec 에 ★남아 ★다음 사람이 ★무엇을 쟀는지 ★읽는다). */
  expect(d.svgLen, `★전제 기록 — ${note}`).toBeGreaterThan(1000);

  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
