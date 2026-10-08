/* fx-particles-persist — 파티클 층이 ★저장 왕복(㉠)과 ★섹션 병합(㉣) 뒤에 «산다»
 *   (2026-10-07 지디 발주 ㉠·㉣ · R1 판정과 한 쌍)
 *
 * ★★왜 둘을 한 파일에 두나 — ★재는 것이 ★같다: 「★층이 ★살아남나」.
 *   그리고 ★둘 다 ★«제외목록»의 성질에 걸려 있다:
 *     ㉠ `js/io/section-serialize.js:217`(요소 통째 remove)·`:146`(클래스 토큰) 명부에
 *        ★우리 이름이 ★없어야 ★살아남는다 — 이름 전수는 unit 이 쟀고(fx-particles-wiring W7)
 *        ★여기선 ★«정말 살아남나»를 ★행위로 잰다.
 *     ㉣ `js/section-merge.js:172` `KEEP_OUT` 이 ★제외목록이라 ★가만 두면 ★층이 ★상자로 따라간다.
 *        ⇒ ★★그것이 ★배경이 겪는 것과 ★같은 결이다(`:113~116` 이 source 배경색을 상자로 옮겨 보존).
 *        ⇒ ★지디 판정 2026-10-07 R1: ⛔`KEEP_OUT` 을 ★고치지 마라 · ★대신 ★이 검사로 잠가라.
 *
 * ★★음성대조를 ★같은 판에서 둔다 — ⛔「파티클만 특별하게 다룬다」가 아님을 증명한다:
 *   ㉠ 같은 클론에서 ★`sec-bg-editing`(편집 마커)은 ★사라진다 ⇒ 세척이 ★진짜로 돌았다
 *   ㉣ 같은 병합에서 ★배경색도 ★상자로 간다 ⇒ 층이 ★배경과 ★같은 자리로 간다
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다):
 *   · `KEEP_OUT` 에 우리 이름을 ★넣으면 빨개지나(㉣-3 양성대조) — ★소스 변이가 필요하다(모듈 지역 상수)
 *   · 배송본 CSS(㉢) — 별 spec
 * ★이 효과는 «정지 한 장면»이다 ⇒ ★시드를 고정하고 ★글자를 견준다. ⛔rAF 를 기다리지 않는다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const CFG = { preset: 'party', seed: 20261007, glow: 0, spread: 0 };

/** 섹션 n 개를 만든다. parts[i] 가 설정이면 그 섹션에 파티클을 건다. */
async function setup(page, parts) {
  return page.evaluate((parts) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = parts.map((_, i) =>
      `<div class="section-block" id="secQ${i}" style="position:relative;height:300px;background:#0A0A0C">`
      + '<div class="section-inner"></div></div>').join('');
    window.rebindAll?.();
    return parts.map((cfg, i) => {
      const sec = document.getElementById('secQ' + i);
      if (cfg) { window.writeParticles(sec.dataset, cfg); window.applySectionParticles(sec); }
      return sec.id;
    });
  }, parts);
}

test('Q0 ★전제 — 배선이 섰고 저장·병합 문이 window 에 있다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({
    apply: typeof window.applySectionParticles, watch: typeof window.watchAllParticles,
    ser: typeof window.serializeCleanRoot, merge: typeof window.mergeSectionInto,
    gate: typeof window.canMergeSections, wrapCls: window.FX_PARTICLES_WRAP,
  }));
  expect(r).toEqual({ apply: 'function', watch: 'function', ser: 'function',
    merge: 'function', gate: 'function', wrapCls: 'sec-fxpart-wrap' });
  expect(errs).toEqual([]);
});

test('㉠-1 ★저장 왕복 — 세척 뒤에도 층과 dataset 둘이 산다 (★음성대조: 편집 마커는 사라진다)', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [CFG]);
  const r = await page.evaluate(({ id, WRAP }) => {
    const sec = document.getElementById(id);
    /* ★음성대조 심기 — 편집 마커를 ★손으로 붙인다. 세척이 돌면 ★이것은 사라져야 한다. */
    sec.classList.add('sec-bg-editing');
    const before = {
      wrap: !!sec.querySelector(':scope > .' + WRAP),
      svgLen: (sec.querySelector('.' + WRAP)?.innerHTML || '').length,
      marker: sec.classList.contains('sec-bg-editing'),
    };
    const clone = sec.cloneNode(true);
    const host = document.createElement('div');
    host.appendChild(clone);
    window.serializeCleanRoot(host);                       // ★저장 경로가 쓰는 그 함수
    const after = {
      wrapInSaved: (host.innerHTML.match(new RegExp(WRAP, 'g')) || []).length,
      dsParticles: /data-fx-particles=/.test(host.innerHTML),
      dsSeed: /data-fx-particles-seed=/.test(host.innerHTML),
      markerInSaved: /sec-bg-editing/.test(host.innerHTML),
      svgInSaved: (host.innerHTML.match(/<svg[^>]*sec-fxpart-svg/g) || []).length,
    };
    sec.classList.remove('sec-bg-editing');
    return { before, after };
  }, { id: ids[0], WRAP: 'sec-fxpart-wrap' });

  expect(r.before.wrap, '★전제: 라이브에 층이 있다').toBe(true);
  expect(r.before.svgLen, '★전제: 그림이 들었다').toBeGreaterThan(500);
  expect(r.before.marker, '★전제: 음성대조 마커를 붙였다').toBe(true);
  /* ★음성대조 먼저 — 세척이 ★진짜로 돌았다(안 돌았으면 아래 「살아남았다」가 증인이 아니다) */
  expect(r.after.markerInSaved, '⛔★음성대조 실패 — 세척이 안 돌았다(편집 마커가 저장본에 남았다)').toBe(false);
  /* ★본 단언 — 층·dataset·그림이 ★저장본에 산다 */
  expect(r.after.wrapInSaved, '층이 저장본에서 사라졌다 — ②/③ 명부에 우리 이름이 걸렸다').toBeGreaterThan(0);
  expect(r.after.dsParticles, 'dataset.fxParticles 가 저장본에 없다 — 다시 열 때 그림이 안 난다').toBe(true);
  expect(r.after.dsSeed, 'dataset.fxParticlesSeed 가 저장본에 없다 — 정본 seed 가 사라졌다').toBe(true);
  expect(r.after.svgInSaved, 'SVG 가 저장본에서 사라졌다 — 배송본에도 안 실린다').toBeGreaterThan(0);
});

test('㉠-2 ★다시 열기 — 저장본 HTML 로 캔버스를 갈아 끼우고 watchAllParticles 가 ★같은 그림을 낸다', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [CFG]);
  const r = await page.evaluate(({ id, WRAP }) => {
    const canvas = document.getElementById('canvas');
    const sec = document.getElementById(id);
    const first = sec.querySelector('.' + WRAP).innerHTML;
    /* 저장 — 세척된 HTML */
    const host = document.createElement('div');
    host.appendChild(sec.cloneNode(true));
    window.serializeCleanRoot(host);
    const saved = host.innerHTML;
    /* ★다시 열기 — 캔버스를 통째로 갈아 끼운다(로드가 하는 그 길) */
    canvas.innerHTML = saved;
    window.rebindAll?.();
    const re = document.querySelector('.section-block');
    const beforeWatch = re.querySelector('.' + WRAP)?.innerHTML || '';
    const n = window.watchAllParticles(canvas);            // ★명부가 로드 뒤 부르는 그 함수
    const afterWatch = re.querySelector('.' + WRAP)?.innerHTML || '';
    return { n, savedHasSvg: /<svg/.test(beforeWatch), same: afterWatch === first,
      len: afterWatch.length, firstLen: first.length };
  }, { id: ids[0], WRAP: 'sec-fxpart-wrap' });

  expect(r.savedHasSvg, '★전제: 저장본에 이미 그림이 있다(다시 그리기 전에도)').toBe(true);
  expect(r.n, 'watchAllParticles 가 그 섹션을 다시 안 그렸다(돌려준 수 0)').toBeGreaterThan(0);
  expect(r.len, '다시 그린 뒤 그림이 비었다').toBeGreaterThan(500);
  expect(r.same, '★다시 열었더니 모습이 바뀌었다 — 같은 seed 인데 다른 그림이다(결정성 깨짐)').toBe(true);
});

test('㉣-1 ★병합 — source 의 층이 «상자» 안에 살고 mergedOuter 표식이 붙는다 (★음성대조: 배경색도 같은 자리로)', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [null, CFG]);              // [0]=target(파티클 없음) · [1]=source(파티클)
  const r = await page.evaluate(({ tId, sId, WRAP }) => {
    const target = document.getElementById(tId), source = document.getElementById(sId);
    /* ★음성대조 심기 — source 에 «배경색»을 준다. 층이 배경과 ★같은 자리로 가야 한다. */
    source.style.backgroundColor = 'rgb(17, 34, 51)';
    const gate = window.canMergeSections(target, source);
    const before = { wrapInSource: !!source.querySelector(':scope > .' + WRAP), gateOk: gate.ok, gateWhy: gate.reason || null };
    if (!gate.ok) return { before, skipped: true };
    const ok = window.mergeSectionInto(target, source);
    /* 합친 뒤 — 상자(part)가 target 안에 생겼다. 그 상자 «안»에 층이 있나? */
    const inner = target.querySelector('.section-inner');
    const parts = [...inner.children].filter((el) => el !== null);
    const wrapEl = target.querySelector('.' + WRAP);
    const box = wrapEl ? wrapEl.parentElement : null;
    return {
      before, ok,
      wrapExists: !!wrapEl,
      wrapInsideInner: !!(wrapEl && inner.contains(wrapEl)),
      wrapIsSectionChild: !!(wrapEl && wrapEl.parentElement === target),
      mergedOuter: wrapEl ? wrapEl.dataset.mergedOuter : null,
      boxBg: box ? box.style.backgroundColor : null,
      boxIsPartOfInner: !!(box && inner.contains(box)),
      partCount: parts.length,
    };
  }, { tId: ids[0], sId: ids[1], WRAP: 'sec-fxpart-wrap' });

  expect(r.before.wrapInSource, '★전제: source 에 층이 있다').toBe(true);
  expect(r.before.gateOk, `★전제: 이 둘은 합칠 수 있다(거부 까닭: ${r.before.gateWhy})`).toBe(true);
  expect(r.ok, '★전제: 합쳐졌다').toBe(true);
  expect(r.wrapExists, '합친 뒤 층이 사라졌다 — KEEP_OUT 에 걸렸거나 버려졌다').toBe(true);
  expect(r.wrapInsideInner, '층이 «상자» 안이 아니다 — 섹션 직속에 남았다(합쳐진 몸과 어긋난다)').toBe(true);
  expect(r.wrapIsSectionChild, '층이 아직 섹션의 직계 자식이다').toBe(false);
  expect(r.mergedOuter, '★분리 때 돌려보낼 표식(mergedOuter)이 안 붙었다').toBe('1');
  /* ★음성대조 — 배경색도 ★상자로 갔다 ⇒ 층이 «특별 취급»이 아니다 */
  expect(r.boxIsPartOfInner, '★음성대조: 배경을 든 상자가 inner 안에 있다').toBe(true);
  expect(r.boxBg, `★음성대조: source 배경색이 상자로 보존돼야 한다(section-merge.js:113~116) — 받음 ${r.boxBg}`)
    .toBe('rgb(17, 34, 51)');
});

/* ── ㉲ ★R3 — ★«높이 0» 에서 거짓 크기로 안 그린다 ＋ ★★누가 다시 그리나 (2026-10-07) ─────
   ★★★내 첫 가정이 ★틀렸다 — ★정정해 적는다:
     처음엔 「`js/io/lazy-sections.js:81` 이 `lazy-unloaded` 를 붙여 ★높이를 0 으로 만든다」로 올렸다.
     ★★재 보니 ★그 클래스는 ★CSS 에 ★0건이고(`grep -rn lazy-unloaded css/` = 0),
       JS 도 ★height·display·contentVisibility 를 ★안 건드린다 — 하는 일은 ★`data-lazy-bg` 로
       ★배경 이미지를 ★내려놓는 것뿐이다(`_restoreSection` 전문이 그게 전부다).
     ⇒ ★★**「lazy ⇒ 높이 0」은 ★근거가 없다.** ⛔그 이름으로 재지 않는다.
   ★★그런데 ★«높이 0»은 ★다른 까닭으로 ★난다 — ★그것이 ★진짜 축이다:
     · 섹션이 `display:none` 인 부모 안에 있다(패널 접힘·탭 등)
     · ★`watchAllParticles` 가 ★`window 'load'` 리스너에서 돈다(effects-registry.js:136)
       ⇒ 그 시점에 캔버스가 ★비어 있거나 ★숨겨져 있으면 ★0 이 난다
   ★★그리고 ★★«진짜 결함»은 ★그대로 남는다 — ★★**한 번 0 이면 ★아무도 ★다시 안 그린다.**
     `_restoreSection` 은 ★클래스를 떼고 ★배경만 되살린다 ⇒ ★파티클 재렌더를 ★부르지 않는다.
     ⇒ ★R3-3 이 ★그것을 잠근다. ★★지금 ★빨강이 ★예상된다 — ⛔「흔들린다」가 아니라 ★«없어서 빨강»이다.
   ★R3-2 가 ★같은 판의 ★대조다(손으로 다시 부르면 ★그 그림으로 돌아온다 ⇒ ★길 자체는 있다). */
test('㉲ R3 ★높이 0 에서 거짓 크기로 안 그린다 ＋ ★★한 번 0 이면 누가 다시 그리나', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [CFG]);
  const r = await page.evaluate(({ id, WRAP }) => {
    const sec = document.getElementById(id);
    const canvas = document.getElementById('canvas');
    const first = sec.querySelector('.' + WRAP).innerHTML;
    const h0 = sec.offsetHeight;
    /* ★★전제를 ★만드는 법 — ⛔`lazy-unloaded` 로는 ★높이가 안 0 이 된다(위 머리말 정정).
       ★부모를 숨긴다 ⇒ ★offsetHeight 가 ★0 이 된다(브라우저 계약). */
    canvas.style.display = 'none';
    const hHidden = sec.offsetHeight;
    const drewHidden = window.applySectionParticles(sec);
    const svgHidden = sec.querySelector('.' + WRAP)?.innerHTML || '';
    /* ★R3-2 대조 — 되살리고 ★손으로 부르면 ★그 그림으로 돌아온다(길 자체는 있다) */
    canvas.style.display = '';
    const drewBack = window.applySectionParticles(sec);
    const svgBack = sec.querySelector('.' + WRAP)?.innerHTML || '';
    /* ★★R3-3 — ★«한 번 0 으로 비워진 뒤» ★앱의 ★어느 길이 ★다시 그리나.
       ★lazy 복원 길(materializeAllSections — ★실제 이름이다. ⛔restoreLazySections 는 ★없다)과
       ★명부 길(watchAllFx)을 ★둘 다 눌러 본다. */
    sec.querySelector('.' + WRAP).innerHTML = '';
    let lazyCalled = false, fxCalled = false;
    try { window.materializeAllSections?.(); lazyCalled = true; } catch (_) {}
    const afterLazy = sec.querySelector('.' + WRAP)?.innerHTML || '';
    try { window.watchAllFx?.(canvas); fxCalled = true; } catch (_) {}
    const afterFx = sec.querySelector('.' + WRAP)?.innerHTML || '';
    return { h0, hHidden, drewHidden, svgHiddenLen: svgHidden.length,
      drewBack, sameBack: svgBack === first, firstLen: first.length,
      lazyCalled, afterLazyLen: afterLazy.length, fxCalled, afterFxLen: afterFx.length,
      hasLazyFn: typeof window.materializeAllSections, hasFxFn: typeof window.watchAllFx };
  }, { id: ids[0], WRAP: 'sec-fxpart-wrap' });

  expect(r.firstLen, '★전제: 처음에 그림이 있었다').toBeGreaterThan(500);
  expect(r.hHidden, `★전제: 숨기면 높이가 0 이다(받음 ${r.hHidden} · 원래 ${r.h0})`).toBe(0);
  /* ★본 단언 — 높이 0 에서 ★안 그리고 ★층도 ★안 지운다(커밋 3f31d242) */
  expect(r.drewHidden, '높이 0 인데 그렸다 — 거짓 크기로 그린 것').toBe(false);
  expect(r.svgHiddenLen, '높이 0 에서 그림을 지웠다 — 저장본 그림이라도 남겨야 한다').toBeGreaterThan(500);
  /* ★R3-2 대조 — 길 자체는 있다 */
  expect(r.drewBack, '되살린 뒤에도 안 그렸다').toBe(true);
  expect(r.sameBack, '되살린 뒤 그림이 처음과 다르다 — 결정성이 깨졌다').toBe(true);
  /* ★★R3-3 — ★두 길 중 ★하나라도 ★다시 그려야 한다. ⛔지금은 ★빨강이 ★예상된다(«없어서 빨강») */
  expect(Math.max(r.afterLazyLen, r.afterFxLen),
    '★★미구현: 비워진 층을 ★다시 그리는 길이 없다 — '
    + `lazy(materializeAllSections=${r.hasLazyFn} · 불렀나=${r.lazyCalled} · 뒤 길이=${r.afterLazyLen}) · `
    + `명부(watchAllFx=${r.hasFxFn} · 불렀나=${r.fxCalled} · 뒤 길이=${r.afterFxLen}) `
    + '⇒ 뷰포트 밖에서 로드된 섹션이 «빈 채로» 남는다.').toBeGreaterThan(500);
});

test('㉣-2 ★병합 뒤에도 그림이 «그 그림»이다 — 상자가 새 기준이 되어도 seed 가 정본이다', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [null, CFG]);
  const r = await page.evaluate(({ tId, sId, WRAP }) => {
    const target = document.getElementById(tId), source = document.getElementById(sId);
    const first = source.querySelector('.' + WRAP).innerHTML;
    if (!window.canMergeSections(target, source).ok) return { skipped: true };
    window.mergeSectionInto(target, source);
    const wrapEl = target.querySelector('.' + WRAP);
    return { same: wrapEl.innerHTML === first, len: first.length,
      dsKept: !!(wrapEl.closest('[data-fx-particles]') || target.dataset.fxParticles) };
  }, { tId: ids[0], sId: ids[1], WRAP: 'sec-fxpart-wrap' });
  expect(r.len, '★전제: 그림이 있었다').toBeGreaterThan(500);
  expect(r.same, '병합이 그림을 바꿨다 — 합치기만 했는데 모습이 달라졌다').toBe(true);
});

/* ── ★R4 — ★«높이 0» 이 ★파티클 고유인가, ★공용인가 (지디 판정 2026-10-07: ★재라 · ⛔고치지 마라) ──
   ★지디 ㉡: 「★글로우도 ★같은 병인가 — ★돌아오면 ★그 문을 빌려라 · ★안 돌아오면 ★공용 결함이다」
   ★★소스에서 본 ★차이 — ⛔이것은 ★판정이 ★아니다. ★아래가 ★행위 자다:
     글로우 `js/fx/glow-render.js:112` → `viewBox="0 0 100 100"` ＋ `preserveAspectRatio="none"` ＋ `width="100%"`
       ⇒ ★상자 크기가 ★그림에 ★안 들어간다 ⇒ ★숨겨도 ★같은 글자가 난다(★가설)
     파티클 `js/fx/particles-render.js:253` → `viewBox="0 0 ${W} ${H}"`
       ⇒ ★상자 크기가 ★그림에 ★들어간다 ⇒ ★크기를 모르면 ★그릴 수 없다
   ★★⇒ ★같은 판에서 ★조건만 바꿔 ★둘을 ★나란히 잰다(지디 규율: 「같은 판에서 ★조건만 바꾼 대조」).
     · ★갈리면  ⇒ R4 는 ★★파티클 고유 ⇒ 처방도 ★파티클 쪽(⛔effects-registry 를 안 건드린다)
     · ★안 갈리면 ⇒ ★★공용 결함 ⇒ ★지디에게 올린다(별 레인)
   ★★내 전제가 ★두 번 틀렸으므로(restoreLazySections 이름 · lazy⇒높이0) ★세 번째는 ★행위로 연다. */
test('R4 ★«숨긴 판»에서 글로우와 파티클이 갈리나 — 처방 자리를 가르는 칸', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(({ WRAP }) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secR" style="position:relative;height:300px;background:#0A0A0C"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    const sec = document.getElementById('secR');
    window.writeParticles(sec.dataset, { preset: 'party', seed: 20261007, glow: 0, spread: 0 });
    window.applySectionParticles(sec);
    const pFirst = sec.querySelector('.' + WRAP).innerHTML;
    const stk = window.makeStickerBlock({ shape: 'glow', fxKind: 'star', seed: 4242, x: 40, y: 40 });
    sec.appendChild(stk);
    const gFirst = stk.innerHTML;
    /* ★★조건만 바꾼다 — 부모를 숨긴다(브라우저 계약: offsetHeight 0) */
    canvas.style.display = 'none';
    const hHidden = sec.offsetHeight;
    const pDrew = window.applySectionParticles(sec);
    const pHidden = sec.querySelector('.' + WRAP)?.innerHTML || '';
    stk.innerHTML = '';
    window.renderStickerBlock(stk);                  // ★글로우가 쓰는 그 길
    const gHidden = stk.innerHTML;
    canvas.style.display = '';
    return { hHidden, pDrew, pSame: pHidden === pFirst, pLen: pFirst.length,
      gSame: gHidden === gFirst, gLen: gFirst.length,
      hasStk: typeof window.makeStickerBlock, hasRender: typeof window.renderStickerBlock };
  }, { WRAP: 'sec-fxpart-wrap' });

  expect(r.hasStk, '★전제: 글로우 스티커를 만들 수 있다').toBe('function');
  expect(r.hasRender, '★전제: 글로우를 다시 그리는 길이 있다').toBe('function');
  expect(r.pLen, '★전제: 파티클 그림이 났다').toBeGreaterThan(500);
  expect(r.gLen, '★전제: 글로우 그림이 났다').toBeGreaterThan(200);
  expect(r.hHidden, `★전제: 숨기면 높이가 0 이다(받음 ${r.hHidden})`).toBe(0);
  /* ★★가르는 세 줄 — ⛔전부 단언한다. 어느 쪽이 빨개지든 ★그것이 ★답이다 */
  expect(r.gSame, '★★글로우도 숨긴 판에서 그림이 바뀐다 ⇒ ★공용 결함이다(지디에게 — 처방은 effects-registry 쪽)').toBe(true);
  expect(r.pDrew, '파티클이 높이 0 에서 그렸다 — 가드가 안 걸렸다').toBe(false);
  expect(r.pSame, '파티클 층이 숨긴 판에서 바뀌었다 — 물러나기가 안 됐다').toBe(true);
});
