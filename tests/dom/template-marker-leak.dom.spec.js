/* template-marker-leak.dom.spec.js — 「선택한 채 템플릿으로 저장」이 마커를 싣지 않는가. (2026-09-09)
 *
 * ★사용자가 겪는 일
 *   표(그리드)나 배너02의 «줄»을 고른 채 템플릿으로 저장하면 파란 선택 표시가 템플릿 HTML 에
 *   박힌다. 나중에 그 템플릿을 넣으면 아무것도 안 골랐는데 파란 줄이 그려진다
 *   (마커 CSS 스코프가 #canvas 안이라 캔버스에 들어가는 순간 산다). 썸네일·목업 PNG 에도 찍힌다.
 *
 * ★왜 «또» 재나 — 이미 U6/D4 가 있는데
 *   그 둘은 ⑴ 명부(파일이 세척을 부르나)와 ⑵ 위임받는 쪽(serializeCleanRoot 가 마커를 거나)을
 *   «따로» 잰다. 가운데가 비어 있었다 — 템플릿이 넘기는 root 는 «캔버스»가 아니라
 *   «섹션 1개·블록 1개»고, serializeCleanRoot 는 querySelectorAll 만 써서 구조적으로
 *   «root 자신»을 못 본다. ⇒ 블록이 .editing / .img-editing 을 «자기가» 달고 있으면
 *   (js/block-drag.js:182 · js/image-handling.js:62) 그대로 굳는다. 그 구멍을 여기서 잰다.
 *
 * ★재는 방법 — «진짜 함수»를 돌린다
 *   template-system.js 는 에디터 전역(electronAPI·패널·캔버스)이 통째로 필요해 이 하네스에
 *   못 띄운다. 그래서 그 파일에서 _cleanTemplateClone «몸통을 떠내» 실제 DOM 에 돌린다.
 *   ⛔떠낸 덩이가 비었으면 아무것도 안 재고 초록이 난다 ⇒ T0 이 «길이»를, 각 검사가
 *     «입력이 살아 있다»(마커가 실제로 1건 이상)를 본 단언 앞에 세운다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js template-marker
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const SER_SRC = fs.readFileSync(path.join(REPO, 'js/io/section-serialize.js'), 'utf8');
const TPL_SRC = fs.readFileSync(path.join(REPO, 'js/panels/template-system.js'), 'utf8');

/** 함수 «몸통»을 중괄호 균형으로 떠낸다(매개변수 기본값의 중괄호에 안 속게 괄호를 먼저 닫는다). */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  const start = m.index;
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const CLEAN_SRC = extractFn(TPL_SRC, '_cleanTemplateClone');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas"></div></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ content: SER_SRC });   // index.html:993 과 같은 계약(플레인 스크립트)
  return errs;
}

/** 어떤 문자열에서든 토큰을 «같은 계수기»로 센다 — 라이브 DOM 도 결과물도 이걸로 잰다. */
const countIn = (text, tok) => (String(text).match(new RegExp(tok, 'g')) || []).length;

/* 저장 대상 픽스처 — «루트 자신»과 «자손»에 마커를 둘 다 심는다.
   ⑴ 루트 자신: 실제로 block-drag.js:182 가 .editing 을, image-handling.js:62 가 .img-editing 을 단다.
   ⑵ 자손: 줄 선택 마커(bn2/grd)와 셀 선택(cell-selected). */
const FIXTURE = `
<div class="section-block selected sec-bg-editing" id="sec1">
  <div class="section-inner">
    <div class="banner02-block editing">
      <div data-line-idx="0" class="bn2-line bn2-line-selected">배너 줄</div>
      <div data-line-idx="1" class="bn2-line bn2-line-empty"></div>
    </div>
    <div class="grid-block img-editing">
      <div class="grd-line grd-line-selected" data-line="0">표 줄</div>
    </div>
    <table class="table-block"><tr><td class="cell cell-selected">셀</td></tr></table>
    <div class="xyz-block xyz-line-selected">앞으로 생길 줄 마커</div>
  </div>
</div>`;

/** 이 검사가 «0건이어야 한다»고 보는 토큰 전수. ★명부가 아니라 픽스처가 정한다 —
 *  픽스처에 심은 것만 세므로 「입력이 없어서 0」이 될 수 없다(각 검사가 그걸 먼저 단언한다). */
const TOKENS = ['bn2-line-selected', 'grd-line-selected', 'cell-selected', 'xyz-line-selected',
                'sec-bg-editing', 'img-editing', 'bn2-line-empty'];

test('TM0 ★떠낸 _cleanTemplateClone 이 «비어 있지 않다» (아래 초록이 빈 함수의 초록이 아니다)', () => {
  expect(CLEAN_SRC.length, '_cleanTemplateClone 을 못 떼었다 — 아래 검사는 아무것도 안 잰다').toBeGreaterThan(150);
  expect(CLEAN_SRC, '떠낸 덩이가 세척을 안 부른다 — 엉뚱한 함수를 뗐다').toMatch(/serializeClean/);
});

test('TM1 ★섹션을 «고른 채» 저장해도 마커가 템플릿 HTML 에 0건 (자손 + 루트 자신)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(([cleanSrc, fixture]) => {
    const _cleanTemplateClone = eval('(' + cleanSrc + ')');
    document.getElementById('canvas').innerHTML = fixture;
    const live = document.getElementById('canvas').innerHTML;
    const el = document.getElementById('sec1');
    const liveRootCls = el.className;
    const saved = _cleanTemplateClone(el.cloneNode(true)).outerHTML;
    // ⛔라이브 DOM 을 건드리면 안 된다 — 세척은 «클론»에만 쓴다는 계약.
    return { live, saved, liveRootCls, liveRootAfter: el.className };
  }, [CLEAN_SRC, FIXTURE]);

  for (const tok of TOKENS) {
    expect(countIn(out.live, tok),
      `★라이브 DOM 에 «${tok}» 이 0건이다 — 입력이 없으면 아래 「출력 0」은 아무 뜻이 없다`).toBeGreaterThan(0);
    expect(countIn(out.saved, tok),
      `★«${tok}» 이 템플릿 저장본에 샜다 — 그 템플릿을 넣으면 «유령 선택바»가 그려진다`).toBe(0);
  }
  // ★루트 «자신»의 .selected — outerHTML 이라 여기에만 나온다.
  expect(out.liveRootCls, '픽스처 루트에 selected 가 없다 — 루트 구멍을 «안 재고» 있다').toContain('selected');
  expect(countIn(out.saved, 'selected'), '★루트 자신의 선택 마커가 저장본에 남았다').toBe(0);
  // 결과물이 «비어 있지 않다» — 0건이 「아무것도 안 담겨서」 난 0 이 아니다.
  expect(countIn(out.saved, 'bn2-line'), '★저장본에 배너 줄 자체가 0건이다 — 빈 문서를 재고 있다').toBeGreaterThan(0);
  expect(countIn(out.saved, 'grd-line'), '★저장본에 그리드 줄 자체가 0건이다 — 빈 문서를 재고 있다').toBeGreaterThan(0);
  // 라이브 무접촉
  expect(out.liveRootAfter, '★라이브 DOM 을 고쳤다 — 세척은 «클론»에만 쓰는 계약이다').toBe(out.liveRootCls);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('TM2 ★«블록 1개»를 저장할 때 그 블록 «자신»의 편집 마커도 안 실린다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(([cleanSrc, fixture]) => {
    const _cleanTemplateClone = eval('(' + cleanSrc + ')');
    document.getElementById('canvas').innerHTML = fixture;
    /* ★여기가 옛 판이 «구조적으로» 못 보던 자리다 — root 가 블록 «자신»이고,
       그 블록이 .editing 을 달고 있다(js/block-drag.js:182 가 실제로 그렇게 단다). */
    const block = document.querySelector('.banner02-block');
    return {
      liveCls: block.className,
      saved: _cleanTemplateClone(block.cloneNode(true)).outerHTML,
    };
  }, [CLEAN_SRC, FIXTURE]);

  expect(out.liveCls, '★픽스처 블록이 .editing 을 안 달고 있다 — 이 검사는 잴 것이 없었다').toContain('editing');
  expect(countIn(out.saved, 'editing'), '★블록 «자신»의 .editing 이 템플릿에 실렸다').toBe(0);
  expect(countIn(out.saved, 'bn2-line-selected'), '★자손 줄 마커도 같이 샜다').toBe(0);
  expect(countIn(out.saved, 'bn2-line'), '★저장본이 비었다 — 0건이 「안 담겨서」 난 0 이다').toBeGreaterThan(0);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('TM3 ★«성질»이 산다 — 명부에 없는 xyz-line-selected 도 벗겨진다(음성대조 포함)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    const rm = window.runtimeMarkers;
    if (!rm) return null;
    return {
      // 성질 — 아직 «없는» 줄 마커도 이름 규칙만으로 잡힌다
      미래: rm.isRuntimeMarker('newcomp-line-selected'),
      현재: rm.isRuntimeMarker('bn2-line-selected'),
      // ⛔음성대조 — 아무 클래스나 다 벗기면 위 초록이 공짜다(세척이 «내용»을 지운다)
      내용: ['section-block', 'grd-line', 'banner02-block', 'urgent-active'].map(c => rm.isRuntimeMarker(c)),
    };
  });
  expect(got, '★window.runtimeMarkers 가 없다 — 마커 판정의 단일 진실원이 사라졌다').not.toBeNull();
  expect(got.현재, '★현재 쓰는 줄 마커를 못 잡는다').toBe(true);
  expect(got.미래, '★-line-selected 성질이 죽었다 — 다음 컴포넌트의 줄 마커는 «명단에 적어야만» 벗겨진다').toBe(true);
  expect(got.내용, '★내용 클래스까지 런타임 마커로 본다 — 세척이 디자인을 지운다').toEqual([false, false, false, false]);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
