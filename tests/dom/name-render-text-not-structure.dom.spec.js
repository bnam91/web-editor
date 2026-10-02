/* name-render-text-not-structure.dom.spec.js — 「사용자가 붙인 이름」이 화면에서
 * «글자로 그려지는가, 구조로 해석되는가»를 «진짜 렌더러»로 재는 자리. (T-049 남은 축)
 *
 * ★재는 성질 하나뿐이다
 *   이름 안에 «닫힌 꺾쇠 한 쌍»을 넣고, 그린 뒤에
 *     ⑴ 그 자리 textContent 가 넣은 글자 «그대로»인가 (= 글자로 그려짐 · 초록)
 *     ⑵ 패널 안에 그 이름에서 «생겨난 요소»가 있는가 (= 구조로 해석됨 · 빨강)
 *   를 «둘 다» 센다. ⛔공격 문자열은 안 쓴다 — 표식은 정의되지 않은 빈 커스텀 태그라
 *   스크립트도, 바깥 요청도, 이벤트도 일으키지 않는다. 「해석됐는가」만 드러낸다.
 *
 * ★자리는 «패턴으로» 찾는다 — js/props/prop-*.js 를 «글로브»로 긁어 모든 모듈의
 *   `show…Properties` 내보내기를 전부 부른다. 새 prop 패널 파일이 생기면 손 안 대도 같이 재진다.
 *   ⛔모듈 명부를 손으로 적지 않는다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(tests/dom 규약). 9345 대역 무접촉.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js name-render-text
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' };

/* ── 중립 표식 ─────────────────────────────────────────────────────────
 * 정의되지 않은 커스텀 요소. 브라우저는 «모르는 태그»로 만들 뿐 아무 것도 실행하지 않는다.
 * 이름이 글자로 그려지면 이 문자열이 «그대로» 보이고, 구조로 해석되면 요소가 하나 «생긴다».
 * ⛔여기에 스크립트·이벤트·주소를 넣지 않는다 — 재는 성질은 «해석 여부» 하나다. */
const PROBE_TAG = 'gd-nameprobe';
const PROBE = `이름표식<${PROBE_TAG}></${PROBE_TAG}>끝`;

/* 회귀 대조용 «멀쩡한» 이름 — 막느라 이걸 깨면 그것도 결함이다. */
const NORMAL_NAMES = [
  '가격표',
  '메인 배너 💡✨',
  '"큰" 제목',
  "작은 '따옴표'",
  'A & B 비교',
  '할인 100% · 무료배송',
];

const PROP_MODULES = fs.readdirSync(path.join(REPO, 'js', 'props'))
  .filter(f => /^prop-.+\.js$/.test(f))
  .sort();

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css"></head><body>
<div id="canvas"><div id="canvas-wrap"><div class="section-block" id="sec_probe" data-name="섹션"><div class="section-inner" id="host"></div></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script>
  /* prop 패널들이 기대하는 «바깥 세상» 최소 스텁. 없는 것은 «못 잼» 으로 떨어진다. */
  window.getBlockBreadcrumb = () => '경로';
  window._copyToClipboard   = () => {};
  window.readZoomState      = null;
  window.ZOOM_DEFAULTS      = {};
  window.pushHistory        = () => {};
  window.saveState          = () => {};
  window.loadTemplates      = () => [];
  window.getComputedSectionWidth = () => 286;
</script>
<script type="module">
  const mods = {};
  const names = ${JSON.stringify(PROP_MODULES)};
  window.__loadErrors = {};
  await Promise.all(names.map(async (n) => {
    try { mods[n] = await import('/js/props/' + n); }
    catch (e) { window.__loadErrors[n] = String(e); }
  }));
  try { mods['__layer__'] = await import('/js/panels/layer-panel-items.js'); }
  catch (e) { window.__loadErrors['layer-panel-items.js'] = String(e); }
  window.__mods = mods;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
}

/* 한 이름으로 «모든» prop 패널을 그려 보고, 자리마다 결과를 돌려준다. */
async function renderAll(page, nameValue) {
  return page.evaluate(({ nameValue, PROBE_TAG }) => {
    const panel = document.querySelector('#panel-right .panel-body');
    const host = document.getElementById('host');
    const out = [];

    const makeBlock = () => {
      const b = document.createElement('div');
      b.className = 'ss-block text-block asset-block shape-block';
      b.id = 'blk_probe';
      Object.assign(b.dataset, {
        layerName: nameValue, name: nameValue, type: 'body', shapeType: 'rectangle',
        blockType: 'text', preset: 'plain', variant: 'plain',
        cols: '[]', rows: '[]', cells: '[]',
        /* ⑫채팅 프로필 이름 · 캔버스 층 이름표도 같은 축이다 — 같은 표식을 함께 넣는다. */
        messages: JSON.stringify([{ text: '글', profileName: nameValue, side: 'left' }]),
        layers: JSON.stringify([{ type: 'text', content: nameValue, label: nameValue }]),
        iconName: nameValue,
      });
      b.innerHTML = '<div class="tb-inner" contenteditable="true">글</div>'
                  + '<table class="tbl"><tbody><tr><td>1</td></tr></tbody></table>';
      host.appendChild(b);
      return b;
    };

    for (const [mod, ns] of Object.entries(window.__mods)) {
      for (const [fnName, fn] of Object.entries(ns)) {
        if (typeof fn !== 'function') continue;
        if (!/^show[A-Za-z0-9]*Propert(?:y|ies)$/.test(fnName)) continue;
        panel.innerHTML = '';
        host.innerHTML = '';
        const block = makeBlock();
        let threw = null;
        try { fn(block); } catch (e) { threw = String(e && e.message || e); }
        const slot = panel.querySelector('.prop-block-name');
        out.push({
          site: `${mod}::${fnName}`,
          threw,
          drew: !!slot,
          text: slot ? slot.textContent : null,
          /* ★패널 «전체»에서 센다 — 이름칸 말고 다른 칸(프로필 이름·층 이름표)에서
             구조로 해석돼도 같은 결함이다. 한 칸만 보면 이 카드가 또 반쪽이 된다. */
          probeEls: panel.querySelectorAll(PROBE_TAG).length,
        });
      }
    }

    /* 레이어 패널 줄 — 블록/그룹/프레임/에셋 네 가지 만들개가 전부 이름을 그린다. */
    const L = window.__mods['__layer__'];
    if (L) {
      for (const [fnName, fn] of Object.entries(L)) {
        if (typeof fn !== 'function' || !/^makeLayer.*Item$/.test(fnName)) continue;
        panel.innerHTML = ''; host.innerHTML = '';
        const block = makeBlock();
        let el = null, threw = null;
        try { el = fn(block, 0); } catch (e) { threw = String(e && e.message || e); }
        const slot = el && el.querySelector ? el.querySelector('.layer-item-name') : null;
        out.push({
          site: `layer-panel-items.js::${fnName}`,
          threw,
          drew: !!slot,
          text: slot ? slot.textContent : null,
          probeEls: el && el.querySelectorAll ? el.querySelectorAll(PROBE_TAG).length : 0,
        });
      }
    }
    return out;
  }, { nameValue, PROBE_TAG });
}

test.describe('이름이 화면에서 «구조»로 해석되지 않는다', () => {
  test('① 표식이 든 이름 — 그린 자리마다 «글자로» 남아야 한다', async ({ page }) => {
    await boot(page);
    const rows = await renderAll(page, PROBE);
    const drawn = rows.filter(r => r.drew);
    const skipped = rows.filter(r => !r.drew);

    /* 계측기가 «아무것도 못 그렸다» 면 이 검사는 아무 것도 재지 않은 것이다. */
    expect(drawn.length, '이름을 그린 자리가 하나도 없다 — 계측기가 안 돌았다').toBeGreaterThan(5);

    const asStructure = drawn.filter(r => r.probeEls > 0).sort((a, b) => a.site.localeCompare(b.site));
    const asText = drawn.filter(r => r.probeEls === 0 && r.text === PROBE).sort((a, b) => a.site.localeCompare(b.site));
    const other = drawn.filter(r => r.probeEls === 0 && r.text !== PROBE);

    const report = [
      `잰 자리 ${drawn.length} · 못 잰 자리 ${skipped.length}`,
      `구조로 해석됨(빨강) ${asStructure.length} · 글자로 그려짐(초록) ${asText.length} · 기타 ${other.length}`,
      '── 구조로 해석된 자리 ──',
      ...asStructure.map(r => `  ${r.site}`),
      '── 글자로 그려진 자리(이미 막힌 곳) ──',
      ...asText.map(r => `  ${r.site}`),
      '── 못 잰 자리(그리다 막힘) ──',
      ...skipped.map(r => `  ${r.site}${r.threw ? ' · ' + r.threw.slice(0, 80) : ''}`),
    ].join('\n');

    expect(asText.length, `이미 막힌 자리가 하나도 없다 — 대조군이 없으면 계측기를 못 믿는다\n${report}`).toBeGreaterThan(0);

    /* ★면제 = «아직 안 닫은 자리» 목록. 소스 축 게이트(tests/unit/name-axes-to-markup.test.mjs)와 같은 규약이다.
       ⛔릴리스 워크플로가 `npm run test:dom` 도 부른다(.github/workflows/release-*.yml) —
         그냥 빨갛게 두면 «다른 세션의 릴리스까지» 막힌다. 그래서 여기도 면제로 시작한다.
       ★앵커는 «모듈::함수»다. 줄번호가 아니라 이름이라 위쪽을 고쳐도 안 어긋난다.
       ★덩이를 닫으면 그 자리가 초록이 되고 → 아래 「죽은 면제」에서 빨개진다. 지울 수밖에 없다.
       ⛔이름만 빼지 마라 — 줄마다 «왜 아직 면제인지»를 적는다. */
    /* ★면제는 «비워 둔다» — 이 검사는 빨갛게 둔다.
       워크트리가 서로 분리돼 있어 여기가 빨개도 남의 트리는 안 막힌다. 막히는 건 dev 머지 때뿐이고,
       게이트와 고침을 «같이» 올리기로 했다(2026-09-22 방침). ⇒ 남은 빨강이 곧 남은 일이다.
       ⚠️머지 «전»에 이 검사가 빨갛다면 .github/workflows/release-*.yml 의 `npm run test:dom` 도 빨갛다.
       면제를 정말 둬야 하면 [모듈::함수, 이유] 로 적어라 — ⛔이름만 빼는 면제는 금지. */
    const EXEMPT = new Map([]);

    const leaked = asStructure.map(r => r.site).filter(s => !EXEMPT.has(s));
    const dead = [...EXEMPT.keys()].filter(s => !asStructure.some(r => r.site === s));

    expect(dead, `닫힌 자리가 면제에 남아 있다 — 그 줄을 지워라(남은 면제 ${EXEMPT.size - dead.length}줄)\n${report}`).toEqual([]);
    expect(leaked, `면제 목록에 없는 자리에서 이름이 «구조»로 해석된다\n${report}`).toEqual([]);
  });

  test('② 회귀 — 멀쩡한 이름(한글·이모지·따옴표·&)은 그대로 보여야 한다', async ({ page }) => {
    await boot(page);

    /* ★«이름을 되비추는 자리»만 회귀 대상이다. 늘 고정 문구만 그리는 칸(예: Page)을
       섞으면 「이름이 깨졌다」로 오판된다 — 기준 이름 하나로 먼저 그 자리들을 가려낸다. */
    const SENTINEL = '기준이름가나다';
    const reflecting = new Set(
      (await renderAll(page, SENTINEL)).filter(r => r.drew && r.text === SENTINEL).map(r => r.site),
    );
    expect(reflecting.size, '이름을 되비추는 자리가 하나도 없다 — 회귀를 잴 대상이 없다').toBeGreaterThan(5);

    const broken = [];
    for (const name of NORMAL_NAMES) {
      for (const r of await renderAll(page, name)) {
        if (!reflecting.has(r.site)) continue;
        if (r.text !== name) broken.push(`${r.site} — 넣은 값 ${JSON.stringify(name)} / 보인 값 ${JSON.stringify(r.text)}`);
      }
    }
    expect(broken, `멀쩡한 이름이 화면에서 달라졌다(막느라 깨뜨린 것도 결함이다)\n대상 자리 ${reflecting.size}곳\n${broken.join('\n')}`).toEqual([]);
  });
});
