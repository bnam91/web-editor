/* thumb-usable.js — 프로젝트 카드 썸네일의 «빈 그림» 판정 한 곳 (T-87, 2026-09-22)
 *
 * ★왜 한 파일인가 — «만드는 쪽»(js/io/save-load.js captureThumbnail)과 «그리는 쪽»
 *   (pages/projects.html 카드)이 서로 다른 잣대를 쓰면, 한쪽이 통과시킨 빈 그림을
 *   다른 쪽이 빈 칸으로 그린다. 그 일이 실제로 났다.
 *
 * ★함정(2026-09-22 실측, 워크트리 wt-T087 · 포트 9640) —
 *   toDataURL 은 높이 0 캔버스에서 «예외를 안 던지고» "data:,"(6자)를 돌려준다.
 *   첫 섹션 높이 1~2px → html2canvas 860×2 → 200/860=0.2326 → round(0.465)=0 →
 *   200×0 캔버스 → toDataURL "data:," len=6. 6자 문자열은 truthy 라
 *   _meta.json 에 «썸네일이 있다»로 저장되고, 카드는 <img src="data:,"> 를 그려
 *   onerror 로 숨겼다 ⇒ 기본 아이콘조차 없는 «완전한 빈 칸».
 *   (3~6px 이면 200×1 짜리 «멀쩡해 보이는» 1067자 한 줄 얼룩이 나온다 — 이것도 그림이 아니다.)
 *   ⛔try/catch 로는 안 보인다. 길이와 꼴을 «재야» 보인다.
 *
 * 같은 병을 js/props/prop-mockup.js 가 _degenerate 로 먼저 막았다 — 128자 기준은 거기서 가져왔다.
 * 기계 검사: tests/unit/thumb-usable.test.mjs · tests/dom/card-thumb-empty.dom.spec.js
 *
 * ★classic script 다(모듈 아님). pages/projects.html 의 인라인 스크립트가 바로 쓰고,
 *   index.html 은 js/io/save-load.js(모듈)보다 «먼저» 싣는다 — defer 되는 모듈로 바꾸지 마라.
 */
(function (root) {
  var MIN_DATA_URL_LEN = 128;   // prop-mockup.js _degenerate 와 같은 값
  var THUMB_W = 200;            // 카드 썸네일 가로(=captureThumbnail 의 축소 폭)
  var MIN_THUMB_H = 8;          // 카드 칸은 130px 다 — 몇 px 짜리 띠는 늘려 봐야 그림이 아니다

  /* 「이 썸네일 «값»은 진짜 그림인가」
   * ⛔「비어 있지 않다」(truthy)로 재지 마라 — 그게 "data:,"(6자)를 통과시킨 바로 그 잣대다.
   * data: 가 아닌 값(파일 경로·원격 URL)은 여기서 판정하지 않는다 — <img> 가 읽어 보면 안다. */
  function isUsableThumbnail(v) {
    if (typeof v !== 'string' || !v) return false;
    if (!v.startsWith('data:')) return true;
    return v.startsWith('data:image/') && v.length >= MIN_DATA_URL_LEN;
  }

  /* 캡처한 캔버스를 카드용 썸네일 data URL 로 줄인다. «빈 그림이면 null» — 그럴듯한 6자를 안 돌려준다.
   * null 을 받은 쪽은 썸네일을 저장하지 않고, 카드는 기본 아이콘을 보여준다. */
  function makeThumbDataUrl(canvas, opts) {
    opts = opts || {};
    var w = opts.width || THUMB_W;
    var minH = (opts.minHeight == null) ? MIN_THUMB_H : opts.minHeight;
    if (!canvas || !canvas.width || !canvas.height) return null;
    var out = document.createElement('canvas');
    out.width = w;
    out.height = Math.round(canvas.height * (w / canvas.width));
    if (!(out.height >= minH)) return null;          // 0·NaN 도 여기서 걸린다
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    var url = out.toDataURL(opts.type || 'image/jpeg', (opts.quality == null) ? 0.7 : opts.quality);
    return isUsableThumbnail(url) ? url : null;      // 결과를 «재고» 내놓는다
  }

  root.isUsableThumbnail = isUsableThumbnail;
  root.makeThumbDataUrl = makeThumbDataUrl;
  root.THUMB_USABLE_CONST = { MIN_DATA_URL_LEN: MIN_DATA_URL_LEN, THUMB_W: THUMB_W, MIN_THUMB_H: MIN_THUMB_H };
  /* node 단위검사도 «같은 함수»를 재게 한다 */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isUsableThumbnail: isUsableThumbnail, makeThumbDataUrl: makeThumbDataUrl,
                       MIN_DATA_URL_LEN: MIN_DATA_URL_LEN, THUMB_W: THUMB_W, MIN_THUMB_H: MIN_THUMB_H };
  }
})(typeof window !== 'undefined' ? window : globalThis);
