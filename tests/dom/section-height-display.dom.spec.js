/* section-height-display.dom.spec.js — 섹션 높이 표시 (현빈 2026-10-07 (다)·(라))
 *
 * 무엇을 재나 — «앱 통째로»(bootApp) 에서 진짜 모듈·진짜 패널·진짜 직렬화를 돌린다.
 *   H1 ★자의 선택을 잠근다 — 배율 40%·100%·200% 에서 ★같은 수. ⛔배율 걸린 자(rect)를 쓰면 빨강.
 *      ★전제를 먼저 단언한다(expect(currentZoom).toBe(40|100|200)) — 「200% 에서」라 이름 붙였으면 재기 전에 200 임을 확인.
 *      ★음성대조를 ★같은 시험 안에 둔다: rect.height 는 ★갈려야 한다(120/300/600). 그게 안 갈리면
 *        «배율이 아예 안 걸린 판»을 재고 있는 것이라 H1 의 초록이 무의미하다.
 *      ⚠️rect 를 재기 전에 #canvas-scaler 의 `transition: transform .15s` 를 끄고 리플로를 돌린다 —
 *        안 끄면 rect 가 «보간 전» 값을 줘서 40·100·200 이 ★전부 같게 나온다(2026-10-07 실측: 전부 120).
 *        그 꼴이면 음성대조가 죽어 H1 이 «안 재고도» 초록이 된다.
 *   H2 자 = 내보내기가 쓰는 그것 — export-image.js 가 섹션 세로로 쓰는 식(clone.offsetHeight)과 ★같은 수.
 *   D1 (다) 캔버스 — 섹션마다 배지가 «그 섹션의» 수를 들고 있다(섹션 둘이 ★서로 다른 수).
 *   D2 (다) 자리 — 배지는 `.section-label` 의 ★다음 형제(라벨 «안»이 아니다) ＋ ★라벨 textContent 가
 *      오염되지 않았다(= 섹션 «이름»을 읽는 10 자리가 안전하다). ⛔라벨 안에 넣으면 빨강.
 *   D3 (다) 패널 — 우측 패널 그 섹션 절에 「높이」 칸이 있고 캔버스 배지와 ★같은 수.
 *   T1 (라) 합계 — 우측 패널 ★맨 위(#rp-height-total)가 섹션 높이의 합 ＋ ★.panel-body «밖»에 있다
 *      (패널이 선택마다 다시 그려져도 안 지워지는 자리인지).
 *   P1 ★공용 함수 하나 — measureSectionHeight 를 0 으로 무력화하면 (다)·(라)·패널 ★셋이 같이 빨강.
 *      ⛔이게 「둘째 명부를 안 만들었다」의 증거다.
 *   U1~U4 ★갱신 — 섹션 추가 · 블록 추가(높이 변화) · 섹션 삭제 · ⌘Z 되돌리기.
 *   S1 ★저장·히스토리에 안 샌다 — getSerializedCanvas 에 배지 0건(＋양성대조: 세척 목록에서 빼면 샌다).
 *   S2 ★비교 키에 안 샌다 — serializeSectionClone(협업 가드)·normSection(버전·병합)에 배지 0건.
 *   Z1 ★★겹침 — 배율 40·70·100·150·200% 에서 `.section-label` 이 배지를 ★덮지 않는다(현빈 2026-10-08
 *      「화면 축소/확대하면 겹친다」). ⛔`transform: scale()` 은 «레이아웃 폭»을 안 바꾼다 — 히트존이 flex 라
 *      배지는 라벨의 «스케일 전» 폭 바로 뒤에 놓이는데 라벨은 scale 배로 그려진다. 라벨의
 *      `max-width: calc((100% - 110px) / var(--ui-scale))` 는 «상한»이라 라벨이 짧으면 안 걸린다.
 *      ★전제 단언(그 배율이 섰나) ＋ ★음성대조(라벨 그려진 폭이 배율마다 갈리나)를 같은 시험 안에 둔다.
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 실앱 재기동 · 진짜 파일 저장/불러오기 · 네이티브 PNG 캡처(CDP).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/section-height-display.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const BADGE = '.section-height-badge';

/* 섹션 둘 — 높이를 ★다르게 둔다(300 vs 140). 같게 두면 「섹션별」과 「전역 한 값」이 구분 안 된다. */
async function fixture(page) {
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = `
      <div class="section-block" id="hS1" data-section="1" data-name="S1">
        <div class="section-hitzone"><span class="section-label">Section 01</span></div>
        <div class="section-inner"><div class="gap-block" data-type="gap" id="hG1" style="height:300px"></div></div>
      </div>
      <div class="section-block" id="hS2" data-section="2" data-name="S2">
        <div class="section-hitzone"><span class="section-label">Section 02</span></div>
        <div class="section-inner"><div class="gap-block" data-type="gap" id="hG2" style="height:140px"></div></div>
      </div>`;
  });
  await page.evaluate(() => window.renderSectionHeights());
  await page.waitForFunction(() => document.querySelectorAll('.section-height-badge').length === 2, null, { timeout: 5000 });
}

/** 배율을 세우고 ★보간을 끈 뒤 두 자를 같이 읽는다(위 머리말의 transition 함정). */
const readAtZoom = (page, z) => page.evaluate((zz) => {
  const sc = document.getElementById('canvas-scaler');
  sc.style.transition = 'none';
  window.applyZoom(zz);
  void sc.offsetWidth;
  window.renderSectionHeights();
  const s1 = document.getElementById('hS1');
  return {
    zoom: window.currentZoom,
    measured: window.measureSectionHeight(s1),
    rectH: Math.round(s1.getBoundingClientRect().height),
    badge: s1.querySelector('.section-height-badge')?.dataset.h || null,
    total: document.getElementById('rp-height-total')?.querySelector('.rp-ht-val')?.textContent || null,
  };
}, z);

test('H1 ★자의 선택 — 배율 40·100·200% 에서 ★같은 수 (음성대조: rect 는 갈린다)', async ({ page }) => {
  const errs = await bootApp(page);
  await fixture(page);

  const a40  = await readAtZoom(page, 40);
  const a100 = await readAtZoom(page, 100);
  const a200 = await readAtZoom(page, 200);

  // ★전제 단언 — 「그 배율에서」라 이름 붙였으니 재기 전에 그 배율이 섰음을 확인한다.
  expect(a40.zoom,  '40% 전제').toBe(40);
  expect(a100.zoom, '100% 전제').toBe(100);
  expect(a200.zoom, '200% 전제').toBe(200);

  // ★주 단언 — 배율에 안 흔들린다. 셋 다 «잰 값»을 메시지에 찍는다(조사가 증거를 지우지 않게).
  const got = [a40.measured, a100.measured, a200.measured];
  expect(got, `measured@40/100/200 = ${got.join('/')}`).toEqual([300, 300, 300]);
  const badges = [a40.badge, a100.badge, a200.badge];
  expect(badges, `badge@40/100/200 = ${badges.join('/')}`).toEqual(['300px', '300px', '300px']);
  const totals = [a40.total, a100.total, a200.total];
  expect(totals, `total@40/100/200 = ${totals.join('/')}`).toEqual(['440px', '440px', '440px']);

  /* ★음성대조 — 배율이 «실제로 걸려 있다»는 증거. 이게 전부 같으면 H1 은 아무것도 안 잰 것이다.
     (2026-10-07 실측으로 이 자리에서 한 번 죽었다 — transition 을 안 끄면 전부 120 이 나온다.) */
  const rects = [a40.rectH, a100.rectH, a200.rectH];
  expect(rects, `★음성대조 rect@40/100/200 = ${rects.join('/')} — 갈려야 한다`).toEqual([120, 300, 600]);

  expect(errs, errs.join('\n')).toEqual([]);
});

test('H2 자 = ★내보내기가 쓰는 그것 (export-image.js 의 clone.offsetHeight 와 같은 수)', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('hS1');
    /* 내보내기 경로가 하는 일을 «그 식 그대로» 재현한다 — 캔버스 배율 밖(body 직속)의 클론을
       offsetHeight 로 재는 것(js/io/export-image.js captureCloneToCanvas :444). */
    const clone = sec.cloneNode(true);
    clone.style.cssText = 'position:fixed;top:-99999px;left:0;width:' + sec.offsetWidth + 'px;';
    document.body.appendChild(clone);
    clone.getBoundingClientRect();
    const cloneH = clone.offsetHeight;
    clone.remove();
    return { cloneH, measured: window.measureSectionHeight(sec), badge: sec.querySelector('.section-height-badge').dataset.h };
  });
  expect(r.measured, `measured=${r.measured} cloneH=${r.cloneH}`).toBe(r.cloneH);
  expect(r.badge).toBe(r.cloneH + 'px');
});

test('D1·D2 (다) 캔버스 — 섹션마다 제 수 · ★라벨 «형제»이고 라벨 글자는 안 오염된다', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  const r = await page.evaluate(() => {
    const out = [];
    for (const id of ['hS1', 'hS2']) {
      const sec = document.getElementById(id);
      const hz = sec.querySelector('.section-hitzone');
      const label = hz.querySelector('.section-label');
      const badge = hz.querySelector('.section-height-badge');
      out.push({
        id,
        badgeText: badge?.dataset.h || null,
        measured: window.measureSectionHeight(sec),
        badgeInsideLabel: !!label.querySelector('.section-height-badge'),   // ⛔true 면 이름 오염
        isNextSibling: label.nextElementSibling === badge,
        labelText: label.textContent,
        /* ★«실효» opacity 로 잰다 — 조상까지 곱한다.
           ⛔getComputedStyle(badge).opacity 로 재면 ★안 된다: opacity 는 ★상속되지 않는 속성이라
             부모 .section-hitzone 이 0 이어도 자식의 computed 값은 ★언제나 1 이다 ⇒ 그 단언은
             부모의 0 을 ★구조적으로 못 본다(죽은 단언). 실측 2026-10-07: 내 `opacity:1` 한 줄을
             ★지워도 그 단언은 초록이었다(양성대조 M10 빨강 0건) — 그래서 자를 바꿨다. */
        badgeEff: (() => { let o = 1, n = badge; while (n && n !== document.body) { const v = parseFloat(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; n = n.parentElement; } return o; })(),
        labelEff: (() => { let o = 1, n = label; while (n && n !== document.body) { const v = parseFloat(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; n = n.parentElement; } return o; })(),
      });
    }
    return out;
  });
  // 섹션마다 ★다른 수 (한 값이 전역으로 박힌 것과 구분된다)
  expect(r[0].badgeText, `S1=${r[0].badgeText}`).toBe('300px');
  expect(r[1].badgeText, `S2=${r[1].badgeText}`).toBe('140px');
  expect(r[0].measured).toBe(300);
  expect(r[1].measured).toBe(140);
  for (const x of r) {
    expect(x.badgeInsideLabel, `${x.id}: 배지가 라벨 ★안에 있으면 섹션 이름이 오염된다`).toBe(false);
    expect(x.isNextSibling, `${x.id}: 배지는 라벨의 다음 형제여야 한다`).toBe(true);
    /* ★요구가 「섹션★마다 ★볼 수 있게」다 — hover·선택이 ★아닌 섹션에서도 높이는 보여야 한다.
       ★그런데 ⒥ 조건(지디 2026-10-07)은 ★평소엔 «흐리게» ⇒ ★0 < eff < 1 ★둘 다 단언한다.
       ⛔`>0` 만 걸면 「늘 또렷」도 통과한다 — 그러면 ⒥ 의 ★절반(눈에 안 거슬리게)을 안 재는 것이다. */
    expect(x.badgeEff, `${x.id}: 배지 실효 opacity=${x.badgeEff} — hover 아닌 섹션에서도 보여야 한다`).toBeGreaterThan(0);
    expect(x.badgeEff, `${x.id}: 평소엔 ★흐려야 한다(⒥) — 실효 ${x.badgeEff}`).toBeLessThan(1);
    /* ★짝 단언 — 라벨은 ★그대로 hover-only 다(내가 라벨까지 상시 노출로 바꾼 게 아니라는 증거).
       이 둘이 같아지면 「배지만 따로 세웠다」가 거짓이 된다. */
    expect(x.labelEff, `${x.id}: 라벨 실효 opacity=${x.labelEff} — 라벨은 hover/선택 때만 보여야 한다`).toBe(0);
  }
  // ★라벨 textContent = 섹션 «이름» 그대로 (branch-system·version-diff·section-search… 가 읽는 값)
  expect(r[0].labelText).toBe('Section 01');
  expect(r[1].labelText).toBe('Section 02');

  /* ★⒥ 두 번째 단계 — ★선택하면 ★또렷해진다(라벨과 같은 밝기). 이 칸이 없으면 「흐리게」만 재고
     「hover·선택이면 또렷」을 ★안 재는 것이다. */
  const sel = await page.evaluate(() => {
    /* ⚠️`transition: opacity .15s` 가 걸려 있다 — 클래스를 붙이고 ★곧바로 재면 getComputedStyle 이
       ★«보간 중» 값(0.45 언저리)을 준다. ★목표값이 아니다. (H1 의 scaler transition 과 ★같은 함정 —
       2026-10-07 에 이 자리에서 ★또 밟았다: 선택했는데 0.45 가 나와 「⒥ 가 안 걸렸다」로 읽힐 뻔했다.)
       ⇒ 재기 ★전에 전이를 끄고 리플로를 한 번 돌린다. */
    for (const el of document.querySelectorAll('.section-hitzone > .section-label, .section-hitzone > .section-height-badge')) el.style.transition = 'none';
    document.getElementById('hS1').classList.add('selected');
    void document.getElementById('hS1').offsetWidth;
    const eff = (el) => { let o = 1, n = el; while (n && n !== document.body) { const v = parseFloat(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; n = n.parentElement; } return o; };
    return { badge: eff(document.querySelector('#hS1 .section-height-badge')), label: eff(document.querySelector('#hS1 .section-label')) };
  });
  expect(sel.badge, `선택하면 배지가 또렷해야 한다(⒥) — 실효 ${sel.badge}`).toBe(1);
  expect(sel.label, `선택하면 라벨도 또렷 — 실효 ${sel.label}`).toBe(1);
});

test('D3 (다) 패널 — 섹션 절 「높이」 칸이 캔버스 배지와 ★같은 수', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  await page.evaluate(() => window.showSectionProperties(document.getElementById('hS2')));
  await page.waitForSelector('#sec-height-value', { state: 'attached' });
  const r = await page.evaluate(() => ({
    cell: document.getElementById('sec-height-value').textContent.trim(),
    badge: document.querySelector('#hS2 .section-height-badge').dataset.h,
    secId: document.getElementById('sec-height-value').dataset.secId,
  }));
  expect(r.cell, `패널=${r.cell} 배지=${r.badge}`).toBe('140px');
  expect(r.badge).toBe('140px');
  expect(r.secId).toBe('hS2');
});

test('T1 (라) 합계 — 우측 패널 ★맨 위 · 섹션 높이의 합 · .panel-body ★밖', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  const r = await page.evaluate(() => {
    const el = document.getElementById('rp-height-total');
    const panel = document.getElementById('panel-right');
    const body = panel.querySelector('.panel-body');
    const header = panel.querySelector('.panel-header');
    return {
      val: el.querySelector('.rp-ht-val')?.textContent,
      count: el.querySelector('.rp-ht-count')?.textContent,
      inPanelBody: !!body.contains(el),                 // ⛔true 면 선택마다 지워지는 자리다
      beforeHeader: !!(el.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING),
      derived: window.totalSectionHeight(),
      parts: [...document.querySelectorAll('#canvas > .section-block')].map(s => window.measureSectionHeight(s)),
    };
  });
  expect(r.parts, `섹션별 = ${r.parts.join('+')}`).toEqual([300, 140]);
  expect(r.val, `합계 표시=${r.val} · 파생=${r.derived}`).toBe('440px');
  expect(r.derived).toBe(440);
  expect(r.count).toBe('섹션 2');
  expect(r.inPanelBody, '합계가 .panel-body 안이면 선택이 바뀔 때 지워진다').toBe(false);
  expect(r.beforeHeader, '합계는 「Properties」 머리 ★위(= 패널 맨 위)여야 한다').toBe(true);

  /* 선택을 갈아타 패널을 다시 그려도 합계는 ★산다 (자리가 .panel-body 밖이라는 것의 «행위» 증거) */
  await page.evaluate(() => window.showSectionProperties(document.getElementById('hS1')));
  await page.waitForSelector('#sec-height-value', { state: 'attached' });
  const after = await page.evaluate(() => document.getElementById('rp-height-total')?.querySelector('.rp-ht-val')?.textContent);
  expect(after, '패널 재렌더 뒤에도 합계가 살아 있어야 한다').toBe('440px');
});

test('P1 ★공용 함수 하나 — 무력화하면 (다)·(라)·패널 ★셋이 같이 빨강', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  await page.evaluate(() => window.showSectionProperties(document.getElementById('hS1')));
  await page.waitForSelector('#sec-height-value', { state: 'attached' });

  const before = await page.evaluate(() => ({
    badge: document.querySelector('#hS1 .section-height-badge').dataset.h,
    total: document.getElementById('rp-height-total').querySelector('.rp-ht-val').textContent,
    cell:  document.getElementById('sec-height-value').textContent.trim(),
  }));
  expect(before, JSON.stringify(before)).toEqual({ badge: '300px', total: '440px', cell: '300px' });

  // ★양성대조 — 공용 자 하나를 0 으로 바꾼다. 「둘째 명부」가 있으면 그쪽은 ★안 바뀐다.
  const after = await page.evaluate(() => {
    window.measureSectionHeight = () => 0;
    window.renderSectionHeights();
    return {
      badge: document.querySelector('#hS1 .section-height-badge').dataset.h,
      total: document.getElementById('rp-height-total').querySelector('.rp-ht-val').textContent,
      cell:  document.getElementById('sec-height-value').textContent.trim(),
    };
  });
  expect(after.badge, `(다) 캔버스가 공용 자를 안 쓴다 — 받은 값 ${after.badge}`).toBe('0px');
  expect(after.total, `(라) 합계가 ★파생이 아니다 — 받은 값 ${after.total}`).toBe('0px');
  expect(after.cell,  `(다) 패널 칸이 공용 자를 안 쓴다 — 받은 값 ${after.cell}`).toBe('0px');
});

test('U1 갱신 — 섹션 ★추가 (addSection 실경로) 하면 배지가 생기고 합계가 커진다', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  const b = await page.evaluate(() => ({
    n: document.querySelectorAll('.section-height-badge').length,
    total: window.totalSectionHeight(),
  }));
  expect(b.n).toBe(2);

  await page.evaluate(() => window.addSection({ skipDefaultBlock: true }));
  await page.waitForFunction(() => document.querySelectorAll('#canvas > .section-block').length === 3, null, { timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll('.section-height-badge').length === 3, null, { timeout: 5000 });

  const a = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('#canvas > .section-block')];
    return {
      n: document.querySelectorAll('.section-height-badge').length,
      total: document.getElementById('rp-height-total').querySelector('.rp-ht-val').textContent,
      sum: secs.reduce((t, s) => t + window.measureSectionHeight(s), 0),
      badges: secs.map(s => s.querySelector('.section-height-badge')?.dataset.h),
    };
  });
  expect(a.n, `배지 ${a.n}개 · 배지값 ${a.badges.join(',')}`).toBe(3);
  expect(a.total, `합계 표시=${a.total} 실제합=${a.sum}`).toBe(a.sum + 'px');
  expect(a.sum, `새 섹션이 더해져 ${b.total} 보다 커야 한다 — 실제 ${a.sum}`).toBeGreaterThan(b.total);
});

test('U2 갱신 — 섹션 ★높이가 바뀌면(블록 키우기) 배지·합계가 따라온다', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  await page.evaluate(() => { document.getElementById('hG1').style.height = '500px'; });
  // ResizeObserver 경로 — «스스로» 와야 한다(renderSectionHeights 를 손으로 안 부른다)
  await page.waitForFunction(
    () => document.querySelector('#hS1 .section-height-badge')?.dataset.h === '500px',
    null, { timeout: 5000 });
  const r = await page.evaluate(() => ({
    badge: document.querySelector('#hS1 .section-height-badge').dataset.h,
    total: document.getElementById('rp-height-total').querySelector('.rp-ht-val').textContent,
  }));
  expect(r.badge).toBe('500px');
  expect(r.total, `합계=${r.total} (500+140 이어야)`).toBe('640px');
});

test('U3 갱신 — 섹션 ★삭제하면 합계가 줄어든다', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  await page.evaluate(() => { document.getElementById('hS2').remove(); });
  await page.waitForFunction(
    () => document.getElementById('rp-height-total')?.querySelector('.rp-ht-val')?.textContent === '300px',
    null, { timeout: 5000 });
  const r = await page.evaluate(() => ({
    total: document.getElementById('rp-height-total').querySelector('.rp-ht-val').textContent,
    count: document.getElementById('rp-height-total').querySelector('.rp-ht-count').textContent,
    n: document.querySelectorAll('.section-height-badge').length,
  }));
  expect(r.total).toBe('300px');
  expect(r.count).toBe('섹션 1');
  expect(r.n).toBe(1);

  /* ★섹션을 ★전부 지우면 띠가 ★빈다 — CSS `#rp-height-total:empty{display:none}` 이 ★걸리는 조건.
     ⛔「0px · 섹션 0」을 띄우지 않는다. (이 단언이 없으면 그 CSS 규칙은 영영 안 걸리는 장식이다.) */
  await page.evaluate(() => { document.getElementById('hS1').remove(); });
  await page.waitForFunction(() => document.getElementById('rp-height-total')?.innerHTML === '', null, { timeout: 5000 });
  const empty = await page.evaluate(() => {
    const el = document.getElementById('rp-height-total');
    return { html: el.innerHTML, hidden: getComputedStyle(el).display, badges: document.querySelectorAll('.section-height-badge').length };
  });
  expect(empty.html, '섹션 0 이면 띠가 비어야 한다').toBe('');
  expect(empty.hidden, ':empty 규칙이 실제로 걸려 숨어야 한다').toBe('none');
  expect(empty.badges).toBe(0);
});

test('U4 갱신 — ★되돌리기(rebindAll 경로) 뒤에도 배지가 산다', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  /* rebindAll 은 로드·undo/redo·협업 수신이 모두 지나는 자리다 — 캔버스를 통째로 갈아끼운 뒤
     bindSectionHitzone 을 다시 부른다. 배지는 ★그 래퍼로 되살아나야 한다. */
  const r = await page.evaluate(async () => {
    const html = document.getElementById('canvas').innerHTML;
    document.getElementById('canvas').innerHTML = html;    // 라이브 노드 교체 = undo/redo 와 같은 꼴
    window.rebindAll({ preserveHistory: true });
    await new Promise(res => setTimeout(res, 120));
    const secs = [...document.querySelectorAll('#canvas > .section-block')];
    return {
      n: document.querySelectorAll('.section-height-badge').length,
      badges: secs.map(s => s.querySelector('.section-height-badge')?.dataset.h || null),
      dup: secs.map(s => s.querySelectorAll('.section-height-badge').length),   // ★배지가 겹쳐 쌓이지 않았나
      total: document.getElementById('rp-height-total')?.querySelector('.rp-ht-val')?.textContent,
    };
  });
  expect(r.badges, `배지 = ${JSON.stringify(r.badges)}`).toEqual(['300px', '140px']);
  expect(r.dup, `섹션마다 배지 1개여야 한다 — 실제 ${r.dup.join(',')}`).toEqual([1, 1]);
  expect(r.total).toBe('440px');
});

test('S1 ★저장·히스토리에 안 샌다 (＋양성대조: 세척에서 빼면 샌다)', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  const r = await page.evaluate(() => {
    const live = document.querySelectorAll('.section-height-badge').length;
    const saved = window.getSerializedCanvas();
    /* ★양성대조 — 세척 목록에서 «빼고» 같은 자로 다시 잰다. 그러면 ★실제로 새야 한다.
       (안 새면 이 시험은 아무것도 안 잠근 것이다 — 「항상 참인 단언」.) */
    const sec = document.getElementById('hS1');
    const wrap = document.createElement('div');
    wrap.appendChild(sec.cloneNode(true));
    const leaked = wrap.innerHTML;        // 세척 ★안 한 사본
    return {
      live,
      savedHas: /section-height-badge/.test(saved),
      /* ⛔`/300px/` 로 재면 안 된다 — 판의 gap-block 이 `style="height:300px"` 라 ★언제나 참이다
         (2026-10-07 실측: 이 자리에서 거짓 빨강이 났다). 배지가 값을 담는 ★그 자리(data-h)로 잰다. */
      savedHasDataH: /data-h=/.test(saved),
      leakedHas: /section-height-badge/.test(leaked),
    };
  });
  expect(r.live, '라이브에는 배지가 있어야 한다(없으면 S1 이 공허하게 초록)').toBe(2);
  expect(r.leakedHas, '★양성대조 — 세척 안 한 사본엔 배지가 ★있어야 한다').toBe(true);
  expect(r.savedHas, '저장본에 배지가 샜다 — serializeCleanRoot 목록을 보라').toBe(false);
  expect(r.savedHasDataH, '저장본에 배지 값(data-h)이 샜다').toBe(false);
});

test('S2 ★비교 키에 안 샌다 — 협업 가드(serializeSectionClone) · 버전·병합(normSection)', async ({ page }) => {
  await bootApp(page);
  await fixture(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('hS1');
    const collab = window.serializeSectionClone(sec);
    /* version-diff·market-merge 의 normSection 과 ★같은 식으로 정규화해 본다(그쪽은 모듈 내부 함수라
       직접 못 부른다 — 식을 그대로 재현하고, 그 식에 내 배지 이름이 들어 있는지를 소스로 함께 본다). */
    const el = sec.cloneNode(true);
    el.querySelectorAll('.section-label, .section-toolbar, .variation-badge, .section-height-badge, .annotation-block, .annot-preview').forEach(n => n.remove());
    return { collabHas: /section-height-badge/.test(collab), normHas: /section-height-badge/.test(el.outerHTML) };
  });
  expect(r.collabHas, '협업 라이브 가드 키에 배지가 샜다 — 오경보가 난다').toBe(false);
  expect(r.normHas).toBe(false);

  /* ★그 두 파일이 ★실제로 그 이름을 지우는지 «소스»로 확인한다 — 위 재현식은 내가 쓴 것이라
     그것만으로는 저쪽 파일을 안 잰다(검사가 자기 전제를 단언해야 한다). */
  const fs = require('fs'), path = require('path');
  const ROOT = path.join(__dirname, '..', '..');
  for (const f of ['js/version-diff.js', 'js/market-merge.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    expect(/\.section-height-badge/.test(src), `${f} 의 normSection 제거 목록에 배지 이름이 없다`).toBe(true);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   S3 — ★계약 하나를 ★행위로 잠근다(이번 변경이 «기대고 있는» 그 계약).
   js/io/save-load.js NON_CONTENT_UI_SELECTOR 머리말이 말하는 것:
     「이 목록은 ★저장에서 지워지는 것 = 편집이 아닌 것이다.
       ⛔여기에 추가할 때는 serializeProject 가 ★실제로 그걸 지우는지 먼저 확인하라 —
         지우지 않는 것을 넣으면 «진짜 편집»이 저장되지 않는다 = ★데이터 손실.」
   그런데 지우는 쪽 목록은 js/io/section-serialize.js 에 ★따로 적혀 있다(명부 둘). 지금까지
   그 쌍을 ★재는 자가 없었다 — 「확인하라」는 ★사람에게 맡겨진 주석이었다.
   ⇒ 목록을 읽어 ★그 클래스마다 요소를 하나씩 심고 직렬화해서 ★0건을 단언한다.
     이러면 내 배지뿐 아니라 ★17 개 전부가 잠긴다. 다음 사람이 ①에만 넣고 ②를 잊으면 빨강이다.
   ★음성대조를 같이 둔다 — 세척을 ★안 한 사본에서는 ★전부 남아야 한다(안 남으면 심기가 실패한 것).
   ══════════════════════════════════════════════════════════════════════════ */
test('S3 ★계약 — NON_CONTENT_UI_SELECTOR 의 ★모든 항목이 저장에서 0건 (명부 둘의 쌍을 잠근다)', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(() => {
    const sel = window.NON_CONTENT_UI_SELECTOR;
    const classes = sel.split(',').map(s => s.trim().replace(/^\./, '')).filter(Boolean);
    const inner = classes.map(c => `<span class="${c}" data-probe="1">x</span>`).join('');
    document.getElementById('canvas').innerHTML = `
      <div class="section-block" id="pS" data-section="1" data-name="P">
        <div class="section-hitzone"><span class="section-label">P</span></div>
        <div class="section-inner">${inner}</div>
      </div>`;
    // 음성대조 — 세척 «안» 한 사본
    const raw = document.getElementById('canvas').innerHTML;
    const rawSurvivors = classes.filter(c => new RegExp('class="' + c + '"').test(raw));
    // 피검 — 저장이 쓰는 그 함수
    const saved = window.getSerializedCanvas();
    const survivors = classes.filter(c => new RegExp('class="' + c + '"').test(saved));
    return { n: classes.length, classes, survivors, rawSurvivors };
  });
  expect(r.n, `명부 항목 수 = ${r.n}`).toBeGreaterThanOrEqual(17);
  // ★음성대조 — 심기가 실제로 됐다(안 됐으면 아래 0건이 «공허한 초록»이다)
  expect(r.rawSurvivors.length, `★음성대조 — 세척 전엔 ${r.n} 개가 다 있어야 한다, 실제 ${r.rawSurvivors.length}`).toBe(r.n);
  // ★주 단언 — 「명부 밖 0건」이 아니라 「명부의 ★전부가 0건」
  expect(r.survivors, `저장본에 남은 «편집 아닌 것» = ${r.survivors.join(', ') || '(없음)'}`).toEqual([]);
  // 내 배지가 그 명부에 ★실제로 들어 있나 (전제 단언 — 안 들어 있으면 위 0건이 배지를 안 잰다)
  expect(r.classes, `명부 = ${r.classes.join(',')}`).toContain('section-height-badge');
});

/* ══════════════════════════════════════════════════════════════════════════
   N1 — ★섹션 «이름»을 읽는 자리가 배지 때문에 ★오염되지 않는다 (지디 2026-10-07 요구)
   ⛔`grep` 으로 닫지 않는다 — ★실제로 ★두 모듈을 ★불러서 재다.
     ㉠ js/section-search.js  `window.openSectionSearch()` — sectionName():
        dataset.name → ★.section-label → id 순(그 파일 :68~74)
     ㉡ js/version-diff.js    `window.versionDiff.changeDiff()` — _nameOf():
        data-name → ★.section-label → id 순(그 파일 :260~272)
   ★판은 ★dataset.name 을 ★일부러 안 준다 — 주면 ★라벨을 ★아예 안 읽어 이 시험이 ★헛돈다
     (= 「한 환경에서만 참인 검사」. 그 함정을 ★전제 단언으로 먼저 막는다).
   ★「≥10 자리」라고 적는다 — 그 수는 ★내가 센 것이고, 센 자는 사용 자리 grep 이라 ★덜 셀 수 있다.
   ══════════════════════════════════════════════════════════════════════════ */
test('N1 ★이름 읽는 자리 ★둘을 실제로 불러서 — 배지가 있어도 이름은 「Section 01」 그대로', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = `
      <div class="section-block" id="nS1" data-section="1">
        <div class="section-hitzone"><span class="section-label">Section 01</span></div>
        <div class="section-inner"><div class="gap-block" data-type="gap" id="nG1" style="height:300px"></div></div>
      </div>`;
    window.renderSectionHeights();
  });
  await page.waitForFunction(() => !!document.querySelector('#nS1 .section-height-badge')?.dataset.h, null, { timeout: 5000 });

  // ★전제 — ⑴ 배지가 ★실제로 있다 ⑵ dataset.name 이 ★없다(없어야 라벨 경로를 탄다)
  const pre = await page.evaluate(() => ({
    badge: document.querySelector('#nS1 .section-height-badge')?.dataset.h || null,
    hasDataName: document.getElementById('nS1').hasAttribute('data-name'),
  }));
  expect(pre.badge, '전제 — 배지가 있어야 이 시험이 뜻이 있다').toBe('300px');
  expect(pre.hasDataName, '전제 — data-name 이 있으면 라벨을 안 읽어 시험이 헛돈다').toBe(false);

  // ㉠ section-search — 진짜로 연다
  const search = await page.evaluate(async () => {
    window.openSectionSearch();
    await new Promise(r => setTimeout(r, 150));
    const box = document.querySelector('.ss-list');          // js/section-search.js:34 (ul.ss-list)
    const txt = box ? box.innerText : '(패널 없음)';
    window.closeSectionSearch?.();
    return txt;
  });
  expect(search, `섹션 검색이 보여 준 이름 = ${JSON.stringify(search)}`).toContain('Section 01');
  expect(search, '⛔이름에 높이가 섞였다 — 배지가 라벨 «안»에 들어갔다는 뜻').not.toContain('300px');

  // ㉡ version-diff — 진짜로 부른다. «지금 캔버스»(배지가 든 라이브 HTML)를 그대로 먹인다
  const vd = await page.evaluate(() => {
    const live = document.getElementById('canvas').innerHTML;       // ★배지가 든 채로
    const old  = live.replace('height:300px', 'height:120px');      // 내용만 다르게 → changed 한 건
    const r = window.versionDiff.changeDiff({ p1: old }, { p1: live });
    return { names: r.changed.map(c => c.n), counts: r.counts };
  });
  expect(vd.names, `version-diff 가 부른 섹션 이름 = ${JSON.stringify(vd.names)}`).toEqual(['Section 01']);
  for (const n of vd.names) expect(n, '⛔이름에 높이가 섞였다').not.toMatch(/px/);
});

/* ══════════════════════════════════════════════════════════════════════════
   N2 — ★저장 → ★다시 열기 왕복에서 배지·합계가 ★되살아난다 (지디 2026-10-07 지목)
   ★왜 이게 «진짜 구멍» 후보인가: 배지는 이제 ★저장에서 지워진다(S1·S3). 그러면 ★다시 열 때
     ★누가 다시 그려 주지 않으면 ★배지가 ★사라진 채로 열린다 — 「저장이 깨끗하다」가
     ★「열면 없다」로 되갚는 꼴이다. 그 둘은 ★같은 변경의 앞뒷면이라 ★같이 재야 한다.
   ★왕복은 ★흉내가 아니라 ★실물로 — `serializeProject()` → ★앱을 ★다시 띄우고(bootApp)
     → `applyProjectData()`. (tests/dom/grid-block-outline.dom.spec.js O5 와 ★같은 관용구.)
   ══════════════════════════════════════════════════════════════════════════ */
test('N2 ★저장 → ★재기동 → 다시 열기 — 배지와 합계가 되살아난다(저장본엔 0건인 채로)', async ({ page }) => {
  await bootApp(page);
  await fixture(page);                                   // 300 + 140
  const before = await page.evaluate(() => ({
    badges: [...document.querySelectorAll('#canvas > .section-block')].map(s => s.querySelector('.section-height-badge')?.dataset.h || null),
    total: document.getElementById('rp-height-total').querySelector('.rp-ht-val').textContent,
  }));
  expect(before.badges).toEqual(['300px', '140px']);
  expect(before.total).toBe('440px');

  const snap = await page.evaluate(() => window.serializeProject());
  // ★저장본엔 배지가 ★0 건이어야 한다(그게 이 왕복이 «진짜 시험»인 까닭)
  expect(/section-height-badge/.test(snap), '저장본에 배지가 샜다').toBe(false);
  expect(/data-h=/.test(snap), '저장본에 배지 값이 샜다').toBe(false);

  // ★앱을 다시 띄운다 — 「새로 연 것」과 같은 꼴
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);

  await expect.poll(
    () => page.evaluate(() => [...document.querySelectorAll('#canvas > .section-block')].map(s => s.querySelector('.section-height-badge')?.dataset.h || null)),
    { message: '★다시 연 뒤 배지가 되살아나야 한다(저장에서 지워지므로 그려 주는 자가 있어야 한다)', timeout: 10000 }
  ).toEqual(['300px', '140px']);

  const after = await page.evaluate(() => ({
    badges: [...document.querySelectorAll('#canvas > .section-block')].map(s => s.querySelector('.section-height-badge')?.dataset.h || null),
    dup: [...document.querySelectorAll('#canvas > .section-block')].map(s => s.querySelectorAll('.section-height-badge').length),
    total: document.getElementById('rp-height-total')?.querySelector('.rp-ht-val')?.textContent || null,
    count: document.getElementById('rp-height-total')?.querySelector('.rp-ht-count')?.textContent || null,
  }));
  expect(after.badges, `다시 연 뒤 배지 = ${JSON.stringify(after.badges)}`).toEqual(['300px', '140px']);
  expect(after.dup, `섹션마다 배지 1개여야 한다 — 실제 ${after.dup.join(',')}`).toEqual([1, 1]);
  expect(after.total, `다시 연 뒤 합계 = ${after.total}`).toBe('440px');
  expect(after.count).toBe('섹션 2');
});
const readBoxesAtZoom = (page, z) => page.evaluate((zz) => {
  const sc = document.getElementById('canvas-scaler');
  sc.style.transition = 'none';
  window.applyZoom(zz);
  void sc.offsetWidth;
  window.renderSectionHeights();
  const sec = document.getElementById('hS1');
  /* ★hover·선택이 아니면 opacity 0 이라 «눈에는» 안 보이지만 rect 는 그대로다 —
     겹침은 «보이는 동안» 문제니 선택 상태로 둔다(그 상태가 현빈이 본 장면이다). */
  sec.classList.add('selected');
  const lb = sec.querySelector('.section-label');
  const bd = sec.querySelector('.section-height-badge');
  const L = lb.getBoundingClientRect(), B = bd.getBoundingClientRect();
  return {
    zoom: window.currentZoom,
    uiScale: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1,
    labelW: Math.round(L.width), badgeW: Math.round(B.width),
    labelRight: Math.round(L.right), badgeLeft: Math.round(B.left),
    overlap: Math.round(L.right - B.left),      // ★>0 이면 겹친다
    badgeText: bd.dataset.h,
  };
}, z);

test('Z1 ★겹침 — 배율 40·70·100·150·200% 에서 라벨이 높이 배지를 «덮지 않는다»', async ({ page }) => {
  const errs = await bootApp(page);
  await fixture(page);

  const ZS = [40, 70, 100, 150, 200];
  const rows = [];
  for (const z of ZS) rows.push(await readBoxesAtZoom(page, z));

  // ★전제 — 그 배율이 실제로 섰다
  expect(rows.map(r => r.zoom), `zoom = ${rows.map(r => r.zoom).join('/')}`).toEqual(ZS);

  // ★음성대조 — 배율이 실제로 걸렸다(라벨 그려진 폭이 갈린다). 전부 같으면 아무것도 안 잰 것이다.
  const ws = rows.map(r => r.labelW);
  expect(new Set(ws).size, `★음성대조 labelW@${ZS.join('/')} = ${ws.join('/')} — 갈려야 한다`).toBeGreaterThan(1);

  // ★주 단언 — 겹침 0. 잰 값을 메시지에 찍는다(조사가 증거를 지우지 않게).
  const ov = rows.map(r => r.overlap);
  const detail = rows.map(r => `${r.zoom}%: ui=${r.uiScale} labelRight=${r.labelRight} badgeLeft=${r.badgeLeft} overlap=${r.overlap}`).join(' | ');
  expect(ov.filter(v => v > 0), `★겹친 배율이 있다 — ${detail}`).toEqual([]);

  expect(errs, errs.join('\n')).toEqual([]);
});


/* ★Z2 — `zoom` 으로 바꾸며 ★지운 `transform-origin: left bottom` 이 지키던 성질을 ★여기서 잠근다:
   「라벨이 ★섹션 경계 바로 위에 붙는다 = ★라벨 하단이 ★히트존 하단과 (거의) 같다」.
   ⛔이게 없으면 Z1 의 초록이 「겹침은 없는데 ★라벨이 떠 버린 판」과 구분되지 않는다. */
test('Z2 ★라벨은 섹션 경계 «바로 위»에 붙어 있다 — 배율 40·70·100·200% 에서 하단이 어긋나지 않는다', async ({ page }) => {
  const errs = await bootApp(page);
  await fixture(page);
  const ZS = [40, 70, 100, 200];
  const rows = [];
  for (const z of ZS) {
    rows.push(await page.evaluate((zz) => {
      const sc = document.getElementById('canvas-scaler');
      sc.style.transition = 'none';
      window.applyZoom(zz); void sc.offsetWidth; window.renderSectionHeights();
      const sec = document.getElementById('hS1'); sec.classList.add('selected');
      const hz = sec.querySelector('.section-hitzone');
      const lb = sec.querySelector('.section-label');
      const H = hz.getBoundingClientRect(), L = lb.getBoundingClientRect();
      return { zoom: window.currentZoom, gap: Math.round(H.bottom - L.bottom), lbH: Math.round(L.height) };
    }, z));
  }
  expect(rows.map(r => r.zoom), `zoom = ${rows.map(r => r.zoom).join('/')}`).toEqual(ZS);
  /* ★음성대조 — 라벨 그려진 높이가 배율마다 갈려야 한다(안 갈리면 배율이 안 걸린 판이다). */
  const hs = rows.map(r => r.lbH);
  expect(new Set(hs).size, `★음성대조 labelH@${ZS.join('/')} = ${hs.join('/')} — 갈려야 한다`).toBeGreaterThan(1);
  /* ★주 단언 — 라벨 하단과 히트존 하단의 어긋남이 라벨 높이의 절반을 넘지 않는다(「바로 위에 붙었다」). */
  const bad = rows.filter(r => Math.abs(r.gap) > Math.max(6, r.lbH / 2));
  const detail = rows.map(r => `${r.zoom}%: gap=${r.gap} labelH=${r.lbH}`).join(' | ');
  expect(bad.map(r => r.zoom), `★라벨이 섹션 경계에서 떨어졌다 — ${detail}`).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});
