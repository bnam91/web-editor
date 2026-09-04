/* ══════════════════════════════════════════════════════════════════════════
   11-section-bg-proxy-sanitize.spec.js
   섹션 배경 «위치 편집»의 임시 DOM(.sec-bg-proxy / .sec-bg-editing)이
   «직렬화 정본»(js/io/section-serialize.js)에서 확실히 걸러지는지.

   ★소스를 «그대로» 주입한다 — 사본이 없으니 drift 불가(10-collab-undo-diff 와 같은 방식).
   ★앱(Electron)·CDP 9334 미접촉. 순수 chromium.

   양성대조: 세척 «전» 문자열엔 반드시 편집 UI 가 «들어 있어야» 한다.
             (픽스처가 우연히 비어 있어서 초록인 경우를 배제)
═══════════════════════════════════════════════════════════════════════════ */
const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const SER  = path.join(ROOT, 'js/io/section-serialize.js');

// 런타임(enterSectionBgEditMode)이 실제로 만드는 DOM 그대로
const PROXY_HTML =
  '<div class="sec-bg-proxy" data-sec-bg-proxy="1" data-img-w="1200" data-img-x="-200" data-img-y="0">' +
    '<div class="asset-img-clip"><img class="asset-img" draggable="false" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>' +
    '<div class="img-edit-hint">드래그: 위치 · 모서리: 크기 · Esc: 완료</div>' +
  '</div>';

const LEAK = ['sec-bg-proxy', 'sec-bg-editing', 'img-edit-hint', 'img-corner-handle',
              'img-edge-handle', 'img-boundary', 'img-rotate-zone', 'img-editing'];

test.describe('섹션 배경 위치편집 — 직렬화 무유출', () => {
  test('편집 «중» 상태를 세척하면 편집 UI 0회 · 배경 데이터는 보존', async ({ page }) => {
    await page.goto('about:blank');
    await page.addScriptTag({ path: SER });
    const ok = await page.evaluate(() => !!(window.serializeCleanRoot && window.serializeSectionClone));
    expect(ok, 'serializeCleanRoot 로드').toBe(true);

    const res = await page.evaluate(({ PROXY_HTML, LEAK }) => {
      const canvas = document.createElement('div');
      canvas.id = 'canvas';
      document.body.appendChild(canvas);
      canvas.innerHTML =
        '<section class="section-block sec-bg-editing" id="sec_uid2mbz"' +
        ' data-bg-img="data:image/png;base64,AAAA" data-bg-size="1200px 600px" data-bg-pos="-200px 0px"' +
        ' style="background-image:url(&quot;data:image/png;base64,AAAA&quot;);background-size:1200px 600px;background-position:-200px 0px">' +
          '<div class="section-inner"><div class="text-block">본문</div></div>' +
          PROXY_HTML +
        '</section>';

      const sec = canvas.querySelector('#sec_uid2mbz');
      const before = canvas.innerHTML;

      // ⑴ 캔버스 전체 경로(getSerializedCanvas 재현)
      const clone = canvas.cloneNode(true);
      window.serializeCleanRoot(clone);
      const canvasStr = clone.innerHTML;

      // ⑵ 섹션 1개 경로(협업 undo 라이브 가드)
      const secStr = window.serializeSectionClone(sec);

      const hits = s => LEAK.filter(k => s.includes(k));
      return {
        beforeHits: hits(before),
        canvasHits: hits(canvasStr),
        secHits: hits(secStr),
        // 배경 자체(정본 dataset + 인라인 style)는 반드시 살아 있어야 한다
        canvasKeepsBg: /data-bg-img=/.test(canvasStr) && /data-bg-size="1200px 600px"/.test(canvasStr)
                    && /data-bg-pos="-200px 0px"/.test(canvasStr),
        secKeepsBg: /data-bg-img=/.test(secStr) && /data-bg-pos="-200px 0px"/.test(secStr),
        // 라이브 DOM 은 건드리면 안 된다(세척은 클론에만)
        liveUntouched: !!canvas.querySelector('.sec-bg-proxy') && sec.classList.contains('sec-bg-editing'),
        canvasStr, secStr,
      };
    }, { PROXY_HTML, LEAK });

    // 양성대조 — 픽스처가 실제로 편집 UI 를 «달고» 있었나
    expect(res.beforeHits.sort(), '세척 전엔 편집 UI 가 있어야 한다(양성대조)')
      .toEqual(['img-edit-hint', 'sec-bg-editing', 'sec-bg-proxy'].sort());

    expect(res.canvasHits, '캔버스 직렬화 유출 0').toEqual([]);
    expect(res.secHits, '섹션 직렬화 유출 0').toEqual([]);
    expect(res.canvasKeepsBg, '캔버스 직렬화에 배경 dataset 보존').toBe(true);
    expect(res.secKeepsBg, '섹션 직렬화에 배경 dataset 보존').toBe(true);
    expect(res.liveUntouched, '라이브 DOM 은 세척되지 않아야(클론만)').toBe(true);
  });
});
