/* free-frame-fullwidth-drag.dom.spec.js — F3 (현빈 「프레임블럭 안에 그리드 블럭을 넣었을 뿐인데 자유이동이 안 되고 수직 이동만」)
 * 원인(Evaluator 36cbe872): T-088 클램프가 x 를 [0, 프레임폭−폭] 으로 죄는데, 입구 셋이 그리드를 «프레임 폭 이상»으로 넣어 [0,0].
 *   패널 삽입(settleRowInFreeFrame) 764 · 드롭(makeAbsolute) 860 · _insertToFlowFrame '100%'.
 * 처방: 입구 셋이 G2-a 폭 모델(data-grid-width)로 «프레임보다 작은 폭»을 준다(grid-block.js fitGridWidthToFreeFrame). 클램프는 그대로.
 * 재는 것: 입구별로 넣고 → 진짜 마우스로 (+100,+50) 끌어 Δx>0 → 오른쪽으로 크게(+900) 끌어도 프레임 밖에 안 나간다.
 *   대조: 폭 400 그리드는 Δx=100 그대로(드래그 자체는 정상 — 이 판에서도, 기준판에서도).
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스). ★배율 100% 를 첫 전제로 단언한다(모델 px = 화면 px).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const FW = 764;   // 현빈 실기 프레임 ss_ts0he_rwpnswe 와 같은 폭
const SEC = `<div class="section-block" id="sF" data-section="1" data-name="sF"><div class="section-hitzone"></div><div class="section-inner" id="innerF">
  <div class="gap-block" data-type="gap" style="height:30px"></div>
  <div class="frame-block" id="frF" data-free-layout="true" style="position:relative;width:${FW}px;height:420px;margin:0 auto;background:#f4f4f8"></div>
  <div class="gap-block" data-type="gap" style="height:30px"></div>
  <div id="flowSlot"></div>
  <div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
  }, SEC);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('frF').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.currentZoom), '전제 — 배율 100%').toBe(100);
  return errs;
}

/* 그리드가 «끌리는 단위»(프레임 직계 absolute) 와 모델 좌표 */
const geo = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), fr = document.getElementById('frF');
  if (!g) return null;
  let u = g; while (u && u.parentElement !== fr) u = u.parentElement;
  return { inFrame: !!u, abs: u ? u.style.position : null, left: u ? parseInt(u.style.left, 10) : null, top: u ? parseInt(u.style.top, 10) : null,
           uw: u ? u.offsetWidth : null, gw: g.offsetWidth, key: g.dataset.gridWidth ?? null, fw: fr.offsetWidth, fcw: fr.clientWidth };
}, id);

async function dragBy(page, id, dx, dy) {
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock?.(id); }, id);
  await page.waitForTimeout(80);
  const b = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + Math.min(40, r.width / 4), r.top + r.height / 2]; }, id);
  await page.mouse.move(b[0], b[1]);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b[0] + dx * i / 12, b[1] + dy * i / 12);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

/* 공통 판정: 넣은 직후 전제 → (+100,+50) Δx>0 → 오른끝 50px 넘겨 끌기 → ★죔 판정
 *
 * ★★`side` = ★이 칸이 ★★«제 손으로 ★선언하는» 축 값이다. ⛔제품의 ★지금 상태에서 ★끌어오지 ★않는다.
 *   `'clip'` = ★자른다(★속성 ★없음 = ★기본 · 또는 `'true'`) ⇒ ★넘긴 50px 을 ★죔이 ★먹는다
 *   `'free'` = ★안 자른다(`clipContent="false"`)                ⇒ ★넘긴 ★50px 이 ★그대로 ★남는다
 * ⚰️★옛 꼴(2026-10-09): ★`if (clips)` 로 ★★제품 dataset 을 ★읽어 ★갈래를 ★골랐다.
 *   ★★그 꼴은 ★거의 ★항등식이다 — ★CSS·기본값이 ★뒤집혀도 ★★맞는 갈래가 ★골라져 ★빨강이 ★안 난다.
 *   ★실제로 ★2026-10-10 에 ★기본이 ★뒤집히자 ★이 파일 ★네 칸이 ★한꺼번에 ★빨개졌다 — ★그 갈래가
 *   ★★잡아 준 것이 ★아니라, ★else 쪽 ★단언이 ★기본에 ★안 맞아 ★빨개진 것이다(★자가 아니라 ★사고였다).
 * ⇒ ★칸이 ★선언하고, ⑴dataset 값 ⑵computed overflow 를 ★★전제로 ★단언한 뒤, ★행위는 ★★갈래 ★없이 잰다. */
async function judge(page, id, label, { side } = {}) {
  expect(['clip', 'free'], `[${label}] ★이 칸이 ★축 값을 ★안 선언했다 — ⛔제품에서 ★끌어오지 않는다`).toContain(side);
  const axis = await page.evaluate(() => {
    const fr = document.getElementById('frF');
    return { attr: fr.dataset.clipContent ?? null, radius: fr.dataset.radius ?? null, ov: getComputedStyle(fr).overflow };
  });
  expect(axis.radius, `[${label}] ★전제: `+'`data-radius`'+` 가 붙어 있다 — ★radius 규칙(0,3,0)이 ★끔(0,2,0)을 ★이겨 ★축을 ★못 잰다`).toBe(null);
  if (side === 'free') {
    expect(axis.attr, `[${label}] ★전제: `+'`free`'+` 라 선언했는데 ★속성이 `+'`false`'+` 가 ★아니다 (${axis.attr})`).toBe('false');
    expect(axis.ov, `[${label}] ★★전제: ★끔인데 computed overflow 가 ★visible 이 ★아니다 — ★끔이 ★안 먹는다`).toBe('visible');
  } else {
    expect(axis.attr === null || axis.attr === 'true',
      `[${label}] ★전제: `+'`clip`'+` 라 선언했는데 ★속성이 ${axis.attr} 다`).toBe(true);
    expect(axis.ov, `[${label}] ★★전제: ★속성 ${axis.attr === null ? '없음(기본)' : axis.attr} 인데 ★안 자른다`
      + ' — ★2026-10-10 의 ★«기본 = 자름»이 ★죽었다').toBe('hidden');
  }
  const g0 = await geo(page, id);
  expect(g0 && g0.inFrame, `[${label}] 전제 — 프레임 안에 들어갔다`).toBe(true);
  expect(g0.abs, `[${label}] 전제 — 끌리는 단위가 absolute`).toBe('absolute');
  await dragBy(page, id, 100, 50);
  const g1 = await geo(page, id);
  expect(g1.top - g0.top, `[${label}] 전제 — 끌기가 «먹었다»(세로 50)`).toBe(50);
  /* ★증상 먼저(현빈 말 그대로) → 원인(폭) 다음. 순서를 바꾸면 핀에서 «원인 단언»이 빨강을 먼저 가져가 증상을 못 잰다. */
  expect(g1.left - g0.left, `[${label}] ★수직만 움직였다(Δx=0) · 폭 ${g0.gw} / 프레임 ${g0.fcw}`).toBeGreaterThan(0);
  expect(g0.gw, `[${label}] 그리드 폭(${g0.gw})이 프레임 보이는 폭(${g0.fcw}) 이상 — 좌우 여지 0`).toBeLessThan(g0.fcw);
  /* 오른쪽 끝을 50px «넘겨» 끈다 — 클램프가 죄는지 본다. ⚠️+900 처럼 크게 끌면 중심이 프레임 밖 60px 을 넘어
     «끌어내기»(drag-out, 그룹에서 빼내는 정상 기능)가 나므로 그건 이 시험의 물음이 아니다. */
  const over = (g1.fw - (g1.left + g1.uw)) + 50;
  await dragBy(page, id, over, 0);
  const g2 = await geo(page, id);
  expect(g2.inFrame, `[${label}] 전제 — 끌어내기가 안 났다(프레임 안 그대로)`).toBe(true);

  /* ══ ★울타리 — ★★«이 칸이 ★선언한 쪽»으로만 잰다 (2026-10-10 재서술 · 지디 ㉠)
     ⚰️★옛 단언(2026-09-22 T-088): `g2.left + g2.uw === g2.fw` ★조건 ★없이.
        ★글: 「오른쪽 끝에 «딱» 붙었다(넘긴 50px 은 클램프가 먹었다)」 · ★그때 센 수 `fw 764` → `764`.
     ⚰️★그 단언의 까닭 = 「`.frame-block` 은 ★overflow:hidden」 ⇒ ★2026-09-28 현빈 지시로 ★기본이
        `visible` 이 되어 ★그 까닭이 ★죽었고(문만 남았다), ★★2026-10-10 에 ★다시 ★살아났다.
     ★★그래서 ★조건을 ★다시 적는다 — ★양쪽을 ★다 적고, ★★쪽은 ★칸이 ★고른다:
        ★`clip` ⇒ ★`fw` 에 ★딱 (★울타리 ★선다 · ★실측 `764`)
        ★`free` ⇒ ★넘긴 ★50px 이 ★그대로 (★실측 `814` = 764＋50)
     ⛔한쪽만 ★돌면 ★그 자리가 ★또 ★빈다 — ★`free` 쪽은 ★`E1f` 가 ★돌린다. */
  /* ⚰️★2026-10-10 3차 — ★★`side` 로 ★갈리던 ★죔 단언을 ★★★합쳤다. ★★까닭:
       ★현빈 ★1010t1c1 로 ★★죔을 ★껐다(지디 판정 ㉮) ⇒ ★★`clip` 쪽도 ★`free` 쪽도 ★★넘긴 50px 이 ★남는다
       ⇒ ★★★갈래가 ★★같아졌다 ⇒ ⛔갈래를 ★남겨 두면 ★★«적었지만 ★같은 것을 ★두 번 ★재는» 꼴이 된다.
     ★★`side` 는 ★★이제 ★★«전제»만 ★가른다 — ★위의 ★dataset ＋ ★computed overflow ★단언이 ★그것이다.
       ⇒ ★★즉 ★★«자름은 ★서 있고(전제) ★죔은 ★꺼져 있다(아래)»를 ★한 칸이 ★같이 잠근다.
     ⚰️★옛 수: ★`clip` ⇒ `fw 764` 에 ★딱 · ★`free` ⇒ `814`(=764＋50). ★★이제 ★★둘 다 ★814 다. */
  expect(g2.left + g2.uw - g2.fw,
    `[${label}] ★★넘긴 50px 이 ★사라졌다 — ★★★죔이 ★돌아왔다(현빈 1010t1c1)`
    + ` (fw ${g2.fw} · 오른끝 ${g2.left + g2.uw} · side ${side})`).toBe(50);
  expect(g2.left, `[${label}] 왼쪽이 프레임 밖`).toBeGreaterThanOrEqual(0);
  return { g0, g1, g2 };
}

test('E1 ★패널 삽입 — 프레임 고른 채 addGridBlock → 좌우로도 움직인다 ＋ ★★넘긴 50px 이 ★그대로 남는다(죔 ★꺼짐)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const fr = document.getElementById('frF'), sec = document.getElementById('sF');
    window.deselectAll?.(); sec.classList.add('selected'); fr.classList.add('selected'); window._activeFrame = fr;
    return window.addGridBlock({}).block.id;
  });
  await page.waitForTimeout(300);
  const r = await judge(page, id, '패널 삽입', { side: 'clip' });
  expect(r.g0.key, '폭은 모델 키로 들어간다(프레임 보이는 폭 × 0.8)').toBe(String(Math.round(r.g0.fcw * 0.8)));
  expect(errs).toEqual([]);
});

/* ⚠️★★2026-10-10 재서술 — ★이 칸의 ★옛 제목 「E1 과 ★토글만 다른데 ★울타리가 ★선다」는 ★★거짓이 되었다:
     ★기본이 ★자름으로 ★뒤집혀 ★★E1 도 ★울타리가 ★선다 ⇒ ★이 칸은 ★더 이상 ★E1 의 ★«짝»이 아니라 ★★«사본»이다.
   ⛔지우지 ★않았다 — ★켬(`'true'`)이 ★기본과 ★같은 결과를 ★내는지는 ★여전히 ★물을 값이 있다
     (★`!important` 라 ★조상 해제까지 ★이긴다 ⇒ ★기본과 ★갈릴 수 있는 자리다).
   ★★E1 의 ★참 짝은 ★이제 ★아래 `E1f`(`clipContent="false"`) 다. */
test('E1c ★★「내용 자르기」 ★켬(`true`) — ★★기본과 ★같은 결과인지 (★죔 ★꺼짐 · ⚠️E1 의 짝이 아니라 ★사본)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const fr = document.getElementById('frF'), sec = document.getElementById('sF');
    fr.dataset.clipContent = 'true';                       /* ★이 한 줄만 ★E1 과 다르다 */
    window.deselectAll?.(); sec.classList.add('selected'); fr.classList.add('selected'); window._activeFrame = fr;
    return window.addGridBlock({}).block.id;
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('frF')).overflow),
    '★전제: 토글을 켰는데 computed overflow 가 ★hidden 이 아니다 — CSS 가 바뀌었다').toBe('hidden');
  const r = await judge(page, id, '패널 삽입(켬)', { side: 'clip' });
  expect(r.g2.left + r.g2.uw - r.g2.fw, '★켬에서도 ★넘긴 50px 이 ★남아야 한다 — ★죔은 ★꺼졌다').toBe(50);
  expect(errs).toEqual([]);
});

/* ★★`judge()` 의 ★★`free` 갈래를 ★★실제로 ★돌리는 ★단 ★하나의 칸 (2026-10-10 · 지디 ㉠).
   ⛔안 두면 ★그 갈래가 ★★한 번도 ★안 돌아 ★★«적었지만 ★안 잰 조건»이 된다 — ★2026-10-10 전까지
     ★이 파일에 `clipContent="false"` 를 쓰는 칸이 ★★0건이었다(전수로 셌다).
   ★장면은 ★E1 과 ★한 줄만 다르다 — ★★「내용 자르기」를 ★끈다.
   ★★여기에 ★옛 E1~E4 가 ★들고 있던 ★단언(「넘긴 50px 이 ★그대로 남는다」·★실측 814)이 ★산다. */
test('E1f ★★`clipContent="false"`(현빈 09-28 의 끔) — ★같은 삽입·같은 끌기인데 ★★넘긴 50px 이 ★그대로 남는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const fr = document.getElementById('frF'), sec = document.getElementById('sF');
    fr.dataset.clipContent = 'false';                      /* ★이 한 줄만 ★E1 과 다르다 */
    window.deselectAll?.(); sec.classList.add('selected'); fr.classList.add('selected'); window._activeFrame = fr;
    return window.addGridBlock({}).block.id;
  });
  await page.waitForTimeout(300);
  const r = await judge(page, id, '패널 삽입(끔)', { side: 'free' });
  expect(r.g2.left + r.g2.uw - r.g2.fw, '★끔인데 ★오른끝이 ★프레임 폭을 ★안 넘었다 — ★죔이 ★끔까지 가둔다').toBe(50);
  expect(errs).toEqual([]);
});

test('E2 ★드롭 — 섹션 흐름 그리드를 진짜 마우스로 프레임에 끌어넣기 → 좌우로도 움직인다', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const { row, block } = window.makeGridBlock({});
    document.getElementById('flowSlot').replaceWith(row); window.bindBlock(block); window.rebindAll?.();
    return block.id;
  });
  await page.waitForTimeout(200);
  expect((await geo(page, id)).inFrame, '전제 — 처음엔 프레임 밖(섹션 흐름)').toBe(false);
  await page.evaluate((id) => { window.deselectAll?.(); window.selectBlock?.(id); }, id);
  const src = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + 60, r.top + r.height / 2]; }, id);
  const dst = await page.evaluate(() => { const r = document.getElementById('frF').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height - 40]; });
  await page.mouse.move(src[0], src[1]); await page.mouse.down();
  for (let i = 1; i <= 16; i++) await page.mouse.move(src[0] + (dst[0] - src[0]) * i / 16, src[1] + (dst[1] - src[1]) * i / 16);
  await page.waitForTimeout(100); await page.mouse.up(); await page.waitForTimeout(400);
  expect(await page.evaluate((id) => document.getElementById(id).parentElement.id, id), '전제 — 드롭 경로(makeAbsolute: row 를 벗기고 블럭이 프레임 직계)').toBe('frF');
  const r = await judge(page, id, '드롭', { side: 'clip' });
  expect(r.g0.key, '폭은 모델 키로(프레임 보이는 폭 × 0.8)').toBe(String(Math.round(r.g0.fcw * 0.8)));
  expect(errs).toEqual([]);
});

test('E3 ★픽스처 — 프레임 안 «흐름 row» 째 들어 있던 폭 100% 그리드(옛 꼴)를 처음 끌 때도 좌우로 움직인다', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const { row, block } = window.makeGridBlock({});
    document.getElementById('frF').appendChild(row); window.bindBlock(block);
    return block.id;
  });
  const pre = await page.evaluate((id) => { const g = document.getElementById(id); return { rowPos: g.parentElement.style.position, w: g.offsetWidth, fw: document.getElementById('frF').clientWidth }; }, id);
  expect(pre, '전제 — 옛 꼴: 흐름 row · 그리드 폭 = 프레임 폭').toEqual({ rowPos: '', w: pre.fw, fw: pre.fw });
  /* 첫 끌기가 세운다(settleRowInFreeFrame 'inplace') — judge 의 첫 끌기가 그것이다. 세운 뒤 전제는 judge 안에서 다시 잰다. */
  await dragBy(page, id, 0, 1);
  await judge(page, id, '픽스처(옛 꼴)', { side: 'clip' });
  expect(errs).toEqual([]);
});

test('E4 _insertToFlowFrame 의 \'100%\' 기본 — 그리드를 그 길로 넣어도 프레임보다 작은 폭', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const fr = document.getElementById('frF'); window._activeFrame = fr;
    let made = null;
    const ok = window._insertToFlowFrame(() => { made = window.makeGridBlock({}); return made; });
    return ok ? made.block.id : null;
  });
  expect(id, '전제 — 그 길로 들어갔다').toBeTruthy();
  const r = await judge(page, id, '_insertToFlowFrame', { side: 'clip' });
  expect(r.g0.key, '폭은 모델 키로(프레임 보이는 폭 × 0.8)').toBe(String(Math.round(r.g0.fcw * 0.8)));
  expect(errs).toEqual([]);
});

test('C400 대조 — 폭 400 그리드는 Δx = 100 그대로(드래그 자체는 정상)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const { row, block } = window.makeGridBlock({});
    /* ⛔모델 키를 안 쓴다 — 기준판(bf9161d0)에도 같은 꼴이어야 «양쪽 초록» 대조가 된다. row 폭 400 · 그리드 100%. */
    const fr = document.getElementById('frF'); fr.appendChild(row);
    row.style.cssText = 'position:absolute;left:0px;top:0px;width:400px'; row.setAttribute('draggable', 'false');
    window.bindBlock(block);
    return block.id;
  });
  const g0 = await geo(page, id);
  expect(g0.gw, '전제 — 400').toBe(400);
  await dragBy(page, id, 100, 50);
  const g1 = await geo(page, id);
  expect([g1.left - g0.left, g1.top - g0.top]).toEqual([100, 50]);
  expect(errs).toEqual([]);
});
