/* export-placeholder-flag-blank.dom.spec.js — 「섹션 내보내기가 내용 없이 흰 페이지」(T-039).
 *
 * ★신고(2026-09-15, 현빈 → 지디): 어떤 프로젝트에서 섹션을 내보냈더니 내용 없이 흰 페이지만 나왔다.
 *   카드 등록 시점엔 원인도 재현 조건도 없었다(「못 잼 — 조사 전」).
 *
 * ★재현(2026-09-22 · 실앱 포트 9641 · 860px PNG · returnDataUrl 로 픽셀을 직접 셈)
 *   ⑴ 섹션에 텍스트 블록을 넣는다(= 안내문구 상태, data-is-placeholder="true")
 *   ⑵ 섹션 툴바의 ✨「AI로 섹션 텍스트 채우기」로 채운다
 *      (js/ai-section-fill.js applyAIReplacements — 이 스펙은 Gemini 호출만 건너뛰고 «그 함수»를 부른다)
 *   ⑶ 화면엔 AI 가 채운 본문이 «보인다»(visibility:visible · opacity 0.45 — 흐릴 뿐 읽힌다)
 *   ⑷ 그런데 내보낸 PNG 는 860×824 에서 «흰색 아닌 픽셀 0 / 708,640» — 완전한 흰 페이지
 *   변수 하나만 뒤집어 확인했다: 표식 남김 0 → 표식«만» 제거 104,542 → 다시 붙이면 도로 0
 *   (세 번째는 첫 번째와 바이트 수까지 같았다). 글자·레이아웃·블록은 한 톨도 안 건드렸다.
 *
 * ★뿌리 — 「글자가 들어가면 표식은 즉시 삭제된다」는 전제가 틀렸다.
 *   js/io/capture-safety.js hidePlaceholderTextForCapture 는 `[data-is-placeholder="true"]` 를
 *   전부 visibility:hidden 으로 가린다. 그 전제를 편집 경로(block-drag·editor·block-factory)는
 *   지키지만 js/ai-section-fill.js 는 textContent 만 쓰고 표식을 «한 줄도» 안 뗐다(6자리).
 *   ⇒ 글자만 있는 섹션이면 산출물 전체가 백지가 된다. 그 함수는 PNG·단독 HTML·프로젝트
 *     목록 썸네일이 «같이» 쓰므로 세 산출물이 한꺼번에 샌다.
 *
 * ★왜 아무도 못 봤나 — js/io/save-load.js(C2/D2)가 «다시 열 때» 역방향 자가보정으로 표식을
 *   꺼 준다. 즉 이 결함은 「AI 로 채운 뒤 그 세션에서 바로 내보낼 때만」 난다.
 *   프로젝트를 한 번 닫았다 열면 증상이 사라진다 — 그래서 재현이 안 됐던 것이다.
 *
 * 여기서 재는 것:
 *   N0 ★음성대조 — 고치기 «전» 소스(기준 커밋)에 표식 제거가 실제로 «없다»(계측기가 뭔가를 보고 있다).
 *   T1 쓰는 쪽 — applyAIReplacements 로 채우면 표식이 남지 않는다.
 *   T2 ★읽는 쪽 짝검사 — 표식이 «남아 있어도» 안내문구와 다른 글자면 캡처가 안 숨긴다.
 *      (우회로가 새 사각지대를 만들지 않게 같은 패치에서 그 자리를 재는 검사도 같이 둔다.
 *       T1 만 있으면 다음 writer 가 생기는 날 흰 페이지가 조용히 돌아온다.)
 *   T3 ★회귀 — «진짜» 안내문구(글자가 안내문구 그대로)는 여전히 숨는다. 산출물에 박히면 안 된다.
 *   T4 ★회귀 — data-placeholder 가 «없는» 안내 요소(.cvb-card-ph)는 그대로 숨는다.
 *      비교할 원문이 없으면 숨기는 쪽이 기존 동작이다.
 *   T5 빈 글자를 쓰면 표식을 «떼지 않는다» — 도로 안내문구 상태다.
 *   T6 ★진단 한 줄 — 글자가 통째로 안 그려지는 클론이면 [export-blank] 를 한 번 찍는다.
 *      (T-039 는 신고→원인이 일주일 걸렸다. 앱이 백지를 내면서 «아무 말도 안 했기» 때문이다.)
 *   T7 음성대조 — 정상 섹션에선 그 줄이 «안» 찍힌다(늘 찍히면 진단이 아니라 소음이다).
 *
 * ⛔앱을 «안» 띄운다 — index.html + 레포 파일만 크로미움에 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js export-placeholder-flag-blank
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* 기준 커밋 — 이 결함이 «살아 있던» 판. N0 음성대조가 이 판의 소스를 읽는다. */
const BASE_SHA = '12865a1';

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  /* ⛔«이름»으로 import 하지 마라 — 없는 이름은 «링크 시점»에 모듈을 통째로 죽인다.
     그러면 고치기 전 판에서 이 스펙이 전부 빨강이 되는데, 그 빨강은 「결함을 쟀다」가 아니라
     「하네스가 안 떴다」다(2026-09-22 실측: 5개가 waitForFunction 타임아웃으로 죽었다 —
     검사처럼 생긴 문장이 될 뻔했다). 네임스페이스로 받아 «없으면 undefined» 로 둔다. */
  return h.replace('</body>', `<script type="module">
  const cs = await import('/js/io/capture-safety.js');
  window.__hidePh   = cs.hidePlaceholderTextForCapture;
  window.__strip    = cs.stripEditorOnlyForCapture;
  window.__isStill  = cs.isStillPlaceholderText || null;      // 고치기 «전» 판엔 없다
  window.__warnBlank = cs.warnIfCaptureTextVanished || null;  // 〃
  await import('/js/ai-section-fill.js');
  window.__ready = true;
</script></body>`);
})();

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 안내문구 상태의 텍스트 블록 둘 + 표 한 칸을 심는다 — block-factory 가 내는 것과 «같은 꼴».
   (블록 생성기 전체를 띄우지 않는다: 이 스펙이 재는 것은 «표식과 글자»의 관계 하나다.) */
const PH_H1 = '제목을 입력하세요';
const PH_BODY = '본문 내용을 입력하세요.';
const PH_CELL = '항목 1';

async function plant(page) {
  return page.evaluate(({ PH_H1, PH_BODY, PH_CELL }) => {
    const host = document.querySelector('#canvas') || document.body;
    host.innerHTML = '';
    const sec = document.createElement('div');
    sec.className = 'section-block';
    sec.id = 'sec1';
    sec.innerHTML = `
      <div class="text-block" id="tb1"><div class="tb-h1" data-placeholder="${PH_H1}" data-is-placeholder="true">${PH_H1}</div></div>
      <div class="text-block" id="tb2"><div class="tb-body" data-placeholder="${PH_BODY}" data-is-placeholder="true">${PH_BODY}</div></div>
      <div class="table-block" id="tbl1"><table><thead><tr><th>H</th></tr></thead>
        <tbody><tr><td data-placeholder="${PH_CELL}" data-is-placeholder="true">${PH_CELL}</td></tr></tbody></table></div>`;
    host.appendChild(sec);
    return sec.querySelectorAll('[data-is-placeholder="true"]').length;
  }, { PH_H1, PH_BODY, PH_CELL });
}

/* 진짜 AI 채우기 경로 — Gemini 호출만 건너뛰고 적용 함수를 그대로 부른다. */
const aiFill = (page) => page.evaluate(() => {
  const sec = document.querySelector('#sec1');
  const items = window.collectSectionTextBlocks(sec);
  const reps = items.map((it, i) => ({ id: it.id, text: 'AI가 채운 본문 ' + i }));
  window.applyAIReplacements(sec, reps, []);
  return {
    flagsLeft: sec.querySelectorAll('[data-is-placeholder="true"]').length,
    texts: [...sec.querySelectorAll('.tb-h1, .tb-body, td')].map(e => e.textContent.trim()),
  };
});

/* 캡처 클론을 만들어 «무엇이 숨었는지» 돌려준다. */
const capture = (page) => page.evaluate(() => {
  const sec = document.querySelector('#sec1');
  const clone = sec.cloneNode(true);
  window.__strip(clone);
  const hidden = [...clone.querySelectorAll('*')]
    .filter(e => e.style && e.style.visibility === 'hidden')
    .map(e => (e.textContent || '').trim());
  const visibleText = [...clone.querySelectorAll('.tb-h1, .tb-body, td')]
    .filter(e => e.style.visibility !== 'hidden')
    .map(e => e.textContent.trim());
  return { hidden, visibleText };
});

test.describe('T-039 — 안내문구 표식이 내보내기를 백지로 만든다', () => {
  test('N0 음성대조 — 기준 커밋의 ai-section-fill.js 에는 표식 제거가 «없다»', () => {
    const before = execFileSync('git', ['-C', REPO, 'show', `${BASE_SHA}:js/ai-section-fill.js`],
      { encoding: 'utf8', maxBuffer: 1 << 24 });
    expect(before, '★계측기 점검 — 기준 커밋에 이 파일이 있어야 한다').toContain('applyAIReplacements');
    expect(before.includes('isPlaceholder'),
      '★이 줄이 빨강이면 결함이 이미 없었다는 뜻 = 이 스펙이 재는 대상이 사라진 것이다').toBe(false);
    // 그리고 그 판의 캡처 함수는 «글자를 안 보고» 표식만 봤다
    const capBefore = execFileSync('git', ['-C', REPO, 'show', `${BASE_SHA}:js/io/capture-safety.js`],
      { encoding: 'utf8', maxBuffer: 1 << 24 });
    expect(capBefore).toContain('hidePlaceholderTextForCapture');
    expect(capBefore.includes('isStillPlaceholderText'),
      '★고치기 전 캡처 함수는 표식 하나만 믿었다').toBe(false);
  });

  test('T1 쓰는 쪽 — AI 채우기 뒤 표식이 남지 않는다', async ({ page }) => {
    const errs = await boot(page);
    expect(await plant(page)).toBe(3);
    const r = await aiFill(page);
    expect(r.texts.every(t => t.startsWith('AI가 채운 본문')), '먼저 글자가 실제로 들어갔는가').toBe(true);
    expect(r.flagsLeft, '★AI 가 채운 자리에 안내문구 표식이 남으면 산출물에서 그 글자가 사라진다').toBe(0);
    expect(errs).toEqual([]);
  });

  test('T2 ★짝검사 — 표식이 남아 있어도 «본문»이면 캡처가 안 숨긴다', async ({ page }) => {
    const errs = await boot(page);
    await plant(page);
    await aiFill(page);
    // 다음 writer 흉내 — 글자는 본문인데 표식만 도로 켜 둔다
    await page.evaluate(() => {
      document.querySelectorAll('#sec1 .tb-h1, #sec1 .tb-body, #sec1 td')
        .forEach(el => { if (el.dataset.placeholder) el.dataset.isPlaceholder = 'true'; });
    });
    const forced = await page.evaluate(() =>
      document.querySelectorAll('#sec1 [data-is-placeholder="true"]').length);
    expect(forced, '음성대조 — 표식을 실제로 되붙였는가').toBe(3);

    const { hidden, visibleText } = await capture(page);
    expect(hidden, '★본문이 하나라도 숨으면 그만큼 산출물이 백지가 된다').toEqual([]);
    expect(visibleText.length).toBe(3);
    expect(visibleText.every(t => t.startsWith('AI가 채운 본문'))).toBe(true);
    expect(errs).toEqual([]);
  });

  test('T3 회귀 — «진짜» 안내문구는 여전히 숨는다', async ({ page }) => {
    const errs = await boot(page);
    await plant(page);   // AI 채우기를 «안» 한다 = 안내문구 그대로
    const { hidden, visibleText } = await capture(page);
    expect(hidden.sort(), '★안내문구가 산출물에 박히면 그게 결함이다')
      .toEqual([PH_BODY, PH_CELL, PH_H1].sort());
    expect(visibleText, '안내문구뿐인 섹션은 캡처에서 글자가 하나도 안 보이는 게 맞다').toEqual([]);
    expect(errs).toEqual([]);
  });

  test('T4 회귀 — data-placeholder 가 없는 안내 요소(.cvb-card-ph)는 그대로 숨는다', async ({ page }) => {
    const errs = await boot(page);
    const r = await page.evaluate(() => {
      const host = document.querySelector('#canvas') || document.body;
      host.innerHTML = '';
      const sec = document.createElement('div');
      sec.className = 'section-block';
      // js/blocks/canvas-block.js 가 만드는 그 꼴 — 표식만 있고 data-placeholder 가 «없다»
      sec.innerHTML = `<div class="cvb-card-ph" data-is-placeholder="true">텍스트를 입력하세요</div>`;
      host.appendChild(sec);
      const clone = sec.cloneNode(true);
      window.__hidePh(clone);
      const el = clone.querySelector('.cvb-card-ph');
      // 술어 헬퍼는 «고친 판에만» 있다 — 없으면 행동(visibility)만 잰다
      return { vis: el.style.visibility, still: window.__isStill ? window.__isStill(el) : null };
    });
    expect(r.vis, '★비교할 원문이 없으면 숨기는 쪽이 기존 동작이다').toBe('hidden');
    if (r.still !== null) expect(r.still).toBe(true);
    expect(errs).toEqual([]);
  });

  test('T5 빈 글자를 쓰면 표식을 떼지 않는다', async ({ page }) => {
    const errs = await boot(page);
    await plant(page);
    const r = await page.evaluate(() => {
      const sec = document.querySelector('#sec1');
      const items = window.collectSectionTextBlocks(sec);
      window.applyAIReplacements(sec, items.map(it => ({ id: it.id, text: '   ' })), []);
      return {
        flags: sec.querySelectorAll('[data-is-placeholder="true"]').length,
        h1Still: window.__isStill ? window.__isStill(sec.querySelector('.tb-h1')) : null,
      };
    });
    expect(r.flags, '★빈 글자는 본문이 아니다 — 표식이 살아야 안내문구가 본문으로 굳지 않는다').toBe(3);
    if (r.h1Still !== null) expect(r.h1Still).toBe(true);
    expect(errs).toEqual([]);
  });

  /* ★진단은 «붙은» 클론에서만 성립한다 — innerText 는 떼어낸 트리에서 textContent 와 같아진다.
     내보내기 경로가 실제로 그렇게 부른다(prepareCloneForCapture 가 body 에 붙인 뒤 ②재렌더). */
  const diagnose = (page) => page.evaluate(() => {
    const sec = document.querySelector('#sec1');
    const clone = sec.cloneNode(true);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
    document.body.appendChild(clone);
    window.__strip(clone);
    clone.getBoundingClientRect();
    const warns = [];
    const ow = console.warn;
    console.warn = function (...a) { warns.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')); };
    const info = window.__warnBlank ? window.__warnBlank(clone, { sectionId: sec.id }) : null;
    console.warn = ow;
    clone.remove();
    return { info, lines: warns.filter(w => w.includes('[export-blank]')) };
  });

  test('T6 ★진단 — 글자가 통째로 안 그려지면 [export-blank] 한 줄을 남긴다', async ({ page }) => {
    const errs = await boot(page);
    test.skip(!(await page.evaluate(() => !!window.__warnBlank)), '진단은 고친 판에만 있다');
    await plant(page);
    /* ★«글자만 있는» 섹션으로 만든다 — plant 의 표 머리글 <th>H</th> 는 안내문구가 아니라
       그대로 그려진다(그러면 «통째 사라짐»이 아니므로 진단이 안 찍히는 게 맞다. 실제로
       처음 이 검사가 빨강이었고, 틀린 쪽은 진단이 아니라 이 표본이었다). */
    await page.evaluate(() => document.querySelector('#sec1 thead')?.remove());
    const r = await diagnose(page);
    expect(r.lines.length, '★백지를 내면서 아무 말도 안 하면 다음 신고도 일주일이 걸린다').toBe(1);
    expect(r.info.shownChars).toBe(0);
    expect(r.info.heldChars, '가진 글자는 있다 — 그래서 «사라진» 것이다').toBeGreaterThan(0);
    // ★표본이 원인을 «가른다» — ph 와 txt 가 같으면 안내문구(정상), 다르거나 ph 가 null 이면 결함.
    expect(r.info.hiddenSample.length).toBeGreaterThan(0);
    expect(r.info.hiddenSample.every(h => h.ph !== null && h.txt === h.ph),
      '이 표본은 «안내문구뿐»이다 — 진단 줄만 보고 T-039 와 갈릴 수 있어야 한다').toBe(true);
    expect(errs).toEqual([]);
  });

  test('T7 음성대조 — 본문이 보이는 섹션에선 진단이 «안» 찍힌다', async ({ page }) => {
    const errs = await boot(page);
    test.skip(!(await page.evaluate(() => !!window.__warnBlank)), '진단은 고친 판에만 있다');
    await plant(page);
    await aiFill(page);          // 본문이 들어갔다 → 이제 그려진다
    const r = await diagnose(page);
    expect(r.lines, '★늘 찍히면 진단이 아니라 소음이다').toEqual([]);
    expect(r.info).toBe(null);
    expect(errs).toEqual([]);
  });
});
