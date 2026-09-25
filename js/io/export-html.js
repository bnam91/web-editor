import { canvasEl, state } from '../globals.js';
import { isGoyaAssetUrl as _isGoyaAsset, parseGoyaAssetUrl as _parseGoyaAssetUrl } from './goya-asset-inline.js';
import { HIDDEN_VARIATION_SECTION_SEL } from '../variation-visibility.js';
import { textGradShadowDefsMarkup } from '../props/text-block-color.js';
import { neutralizeRedactForH2C, stripEditorOnlyForCapture, neutralizeEmptyImageCheckerForCapture } from './capture-safety.js';
import { collectCanvasCss } from './export-css-collect.js';

const CANVAS_W = 860;

/* ── goya-asset:// → base64 data URI 재인라인 ──────────────────────────
 * 이미지 외부화 이후 라이브 DOM의 이미지는 `goya-asset://<id>/<hash>.<ext>`
 * 커스텀 프로토콜 참조다. 이 프로토콜은 앱(Electron) 안에서만 해석되므로,
 * 내보낸 단독 HTML을 일반 브라우저에서 열면 이미지가 깨진다.
 * → export 전에 clone을 순회하며 모든 goya-asset:// 참조(style background-image,
 *   <img src>, data-* 속성)를 fetch해 base64 data: URI로 되돌려 파일을 portable하게 만든다.
 *   (goya-asset 프로토콜은 supportFetchAPI:true 이므로 렌더러 fetch가 동작)
 *   기존 data:image 는 그대로 둔다. fetch 실패 시 해당 URL은 건드리지 않고 넘어간다(견고성).
 *   URL 판별/파싱 헬퍼는 goya-asset-inline.js(Figma JSON 재인라인과 공유)에서 가져온다.
 * ───────────────────────────────────────────────────────────────────── */
function _extractUrl(cssOrUrl) {
  // url("...") 형태와 raw URL 둘 다 처리
  const m = (cssOrUrl || '').match(/url\(["']?([^"')]+)["']?\)/);
  return m ? m[1] : cssOrUrl;
}

async function _goyaAssetToDataUri(url) {
  // 렌더러 fetch()는 file:// origin에서 커스텀 스킴 cross-origin이 Chromium에 하드 차단된다
  // ("Cross origin requests are only supported for: chrome, data, http, https").
  // → main 프로세스가 디스크에서 직접 읽어 base64를 돌려주는 IPC를 사용한다.
  const parsed = _parseGoyaAssetUrl(url);
  if (!parsed) throw new Error('goya-asset URL 파싱 실패: ' + url);
  if (window.electronAPI?.assetsReadAsDataUri) {
    const res = await window.electronAPI.assetsReadAsDataUri(parsed);
    if (res && res.ok && res.dataUri) return res.dataUri;
    throw new Error('asset 읽기 실패: ' + (res && res.error));
  }
  // 폴백(웹/IPC 미가용): fetch 시도 — file:// 외 환경에서는 동작
  const r = await fetch(url);
  if (!r.ok) throw new Error('asset fetch failed: ' + r.status);
  const blob = await r.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// clone 내 모든 goya-asset:// 참조를 base64 data URI로 변환 (중복 URL은 1회만 fetch)
async function inlineGoyaAssets(root) {
  const cache = new Map(); // url → dataURI (실패 시 null)
  const resolve = async (url) => {
    if (cache.has(url)) return cache.get(url);
    let data = null;
    try { data = await _goyaAssetToDataUri(url); }
    catch (err) { console.warn('[export-html] asset 인라인 실패, URL 유지:', url, err); }
    cache.set(url, data);
    return data;
  };

  // 1) style background-image
  for (const el of root.querySelectorAll('[style*="background-image"]')) {
    const raw = _extractUrl(el.style.backgroundImage);
    if (!_isGoyaAsset(raw)) continue;
    const data = await resolve(raw);
    if (data) el.style.backgroundImage = `url("${data}")`;
  }

  // 2) <img src>
  for (const im of root.querySelectorAll('img')) {
    const src = im.getAttribute('src') || '';
    if (!_isGoyaAsset(src)) continue;
    const data = await resolve(src);
    if (data) im.setAttribute('src', data);
  }

  // 3) data-bg-img / data-img-src 등 goya-asset URL을 담은 모든 data-* 속성
  for (const el of root.querySelectorAll('[data-bg-img], [data-img-src]')) {
    for (const attr of ['data-bg-img', 'data-img-src']) {
      const v = el.getAttribute(attr);
      if (!_isGoyaAsset(v)) continue;
      const data = await resolve(v);
      if (data) el.setAttribute(attr, data);
    }
  }
}

async function exportHTMLFile() {
  // 이미지 외부화 이후: lazy 언로드 섹션이 빈 상태로 직렬화되지 않도록 복원
  if (window.materializeAllSections) window.materializeAllSections();

  // canvas clone — 에디터 UI 요소 제거
  const clone = canvasEl.cloneNode(true);
  /* ★안 쓰는 A/B 시안은 «배송본에서 아예 뺀다» (2026-09-09 실측: export.html 에 .section-block 2개,
     data-variation-active="0" 그대로 · 숨기는 CSS 는 이 파일이 쓰는 <style> 에 «없다» ⇒ 받는 사람
     화면에 A안·B안이 위아래로 둘 다 보였다).
   ⛔여기서 숨기는 CSS 한 줄을 끼워 넣는 것으로 때우지 마라 — 그러면 «데이터는 여전히 나간다».
     받는 사람이 소스를 보면 안 고른 시안이 그대로 있다. 배송물에 있을 이유가 없는 것은 «뺀다».
   ★인라인 «앞»이다 — 뒤로 내리면 버릴 섹션의 이미지까지 base64 로 부풀려 넣고 지우게 된다.
   ⚠️저장 경로(js/io/section-serialize.js)는 «건드리지 않는다» — 저장본에서 빼면 시안이 지워진다. */
  clone.querySelectorAll(HIDDEN_VARIATION_SECTION_SEL).forEach(el => el.remove());
  /* ★편집 전용 DOM·상태 걷기 = «한 벌»이다 — js/io/capture-safety.js stripEditorOnlyForCapture.
     썸네일(save-load.js captureThumbnail)·PNG(export-image.js prepareCloneForCapture)와 같은 명부를
     쓴다. 여기가 세 번째 사본이면 또 갈린다(2026-09-21 QA: 썸네일 쪽이 셋에서 멈춘 채 늙어 있었다).
     ⇒ .section-label/.section-toolbar/.variation-badge/펜 주석/.qa-block(+감싼 .row)/
       .sec-bg-proxy·.img-edit-hint·.img-boundary/미입력 placeholder 가림/상태 클래스 일괄 제거는
       전부 그 한 벌이 한다. 아래에 남는 것은 «단독 HTML 에만» 필요한 것들이다. */
  stripEditorOnlyForCapture(clone);
  clone.querySelectorAll('.col-placeholder, .col-add-btn, .col-add-menu, .row-col-add-btn, .row-drop-indicator, .layer-section-drop-indicator').forEach(el => el.remove());
  /* ★앱 CSS 를 실으면서 드러난 «이미 새고 있던» 편집 DOM (2026-09-21 실측: 지금 내보낸 export.html
     안에 .shape-handle 8개 · .section-hitzone 1개가 그대로 들어 있었다). 앱 CSS 가 없을 땐 그냥
     안 그려져서 «우연히» 안 보였을 뿐이다 — 이 파일의 원칙대로(위 ⛔주석) 숨기지 말고 «뺀다». */
  clone.querySelectorAll('.section-hitzone, .shape-handle, .asset-overlay-handle, .icb-overlay-handle, .zm-overlay-handle, .mdl-overlay-handle, .grd-img-overlay-handle, .tfo-overlay-handle, .grid-cell-resize-handle').forEach(el => el.remove());
  // BL-CD-10: label-group은 render-재생성형이 아니라 직렬 DOM 보존형 — 에디터 전용 ✕삭제/＋추가
  // 버튼 노드가 저장 HTML에 남아 export에서 그대로 노출됐음. 노드 자체를 제거한다.
  clone.querySelectorAll('.label-item-delete-btn, .label-group-add-btn').forEach(el => el.remove());
  /* ★편집 전용 임시 DOM — 이 클론은 «라이브 캔버스»에서 뜨고(=serializeCleanRoot 를 안 거친다),
     내보낸 HTML 은 이 파일이 직접 쓰는 <style> 만 갖는다. 앱 CSS(.sec-bg-proxy .asset-img{opacity:0},
     .asset-img-clip{overflow:hidden})가 «없으므로» 편집 중 내보내면 배경 이미지가 불투명하게
     한 번 더, 그것도 클리핑 없이 겹쳐 찍힌다. 클래스가 아니라 «노드»를 지워야 한다. */
  clone.querySelectorAll('.sec-bg-proxy, .img-edit-hint, .img-boundary, .img-corner-handle, .img-edge-handle, .img-rotate-zone').forEach(el => el.remove());
  clone.querySelectorAll('.sec-bg-editing').forEach(el => el.classList.remove('sec-bg-editing'));
  clone.querySelectorAll('.img-editing').forEach(el => el.classList.remove('img-editing'));
  clone.querySelectorAll('.item-selected').forEach(el => el.classList.remove('item-selected'));
  clone.querySelectorAll('.bn2-line-selected').forEach(el => el.classList.remove('bn2-line-selected')); // ⑧ 편집용 마커
  clone.querySelectorAll('.grd-line-selected').forEach(el => el.classList.remove('grd-line-selected')); // 그리드 줄 선택 마커(편집용)
  clone.querySelectorAll('.bn2-line-empty').forEach(el => el.classList.remove('bn2-line-empty'));       // ⑸ 빈 줄 플레이스홀더
  /* [M38-b] 빈 카드 이미지 «편집 전용» 체커/'+' — .bn2-line-empty 와 같은 성격이다.
     ⚠️이 줄에 달려 있던 「앱 CSS 가 결과물에 안 실리므로 클래스만 남아도 안 그려진다」는 전제는
       2026-09-21 0180c54(아래 collectCanvasCss) 부터 «틀렸다». 지금은 앱 CSS 가 실린다.
       ⇒ 이 제거는 «클래스를 가진 쪽»만 닫는다. 블럭 자신의 클래스가 체커를 그리는 자리
         (.asset-block 등)는 못 닫으므로, 배송본 체커의 정본 방어는 두 자리다:
           · 클래스 체커 = js/io/export-css-collect.js(CSS 수확에서 서명으로 걷는다)
           · 인라인 체커 = 바로 아래 neutralizeEmptyImageCheckerForCapture(떼어낸 클론에서도 돈다)
         이 줄은 «의도 표시»로 남긴다(tests/unit/card-empty-export.test.mjs 가 회귀를 잡는다). */
  /* ★.grd-img-empty 가 넷째다 (2026-09-25, 그리드 «빈 셀»). 현빈 주문으로 빈 슬롯이
     회색 단색 → 체크패턴이 되면서 같은 성격의 자리가 하나 늘었다.
     ⛔클래스«만» 벗긴다 — 상자(높이·모서리·폭)는 인라인이라 그대로 남는다. 그래야
       「빈 셀이 자리를 차지한다」는 현빈 요구가 배송본에서도 지켜진다. 빠지는 건 무늬뿐이다. */
  clone.querySelectorAll('.cvb-img-empty, .cvb-img-empty-plain, .bn2-img-empty, .grd-img-empty')
       .forEach(el => el.classList.remove('cvb-img-empty', 'cvb-img-empty-plain', 'bn2-img-empty', 'grd-img-empty'));
  /* «인라인»으로 박힌 빈 칸 체커 — 클래스가 아니라 벗길 대상이 없다(목업의 안전망 레이어,
     옛 저장본이 품고 온 인라인 체커 등). PNG·썸네일과 «같은 서명»으로 레이어 단위로 걷는다.
     ⚠️이 클론은 문서에 «안» 붙는다 — computed 가 비어 클래스 체커는 여기서 안 잡힌다.
       그 몫은 collectCanvasCss 가 진다(위 [M38-b] 주석). 두 자리가 «한 판정식»을 공유한다. */
  neutralizeEmptyImageCheckerForCapture(clone);
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  // #16: 참고이미지 연결(data-ref-links)은 ScratchPadDB 참조 «기획 메타» — export엔 그 DB가 없어 死참조.
  //   배송본에서 제거(저장 경로 serializeCleanRoot에선 유지 → 로드 복원 가능).
  clone.querySelectorAll('[data-ref-links]').forEach(el => el.removeAttribute('data-ref-links'));
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected')); // #5-b 테이블 셀 선택 마킹 (UI 상태 — export 유출 방지). rowspan/colspan은 HTML 속성이라 그대로 보존.
  clone.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

  /* ★가림막(Redact)을 «설계로» 불투명하게 만든다 (2026-09-21 최종통합 QA medium)
     이 파일의 <style> 은 앱 CSS 를 «안» 싣는다 — .shape-block/.shape-redact/.shape-svg 규칙이
     한 줄도 없다(의도된 부분집합이다). 그래서 내보낸 HTML 에서 가림막은
       ⑴ backdrop-filter 가 사라져 흐림이 없고
       ⑵ 그런데 `.shape-redact .shape-svg{fill:none !important}` 도 같이 빠져서 SVG 가 원래 색
          (예: #cccccc)으로 칠해져 «우연히» 원문을 가린다.
     ⇒ 프라이버시가 «설계»가 아니라 «두 누락의 상쇄»로 지켜지고 있었다 — 도형 색을 흰색/투명으로
       쓰는 순간 깨지는 자리다. html2canvas 경로와 «같은 안전실패»를 여기서도 건다.
     ⛔이 호출은 「가림막이 흐리게 나온다」를 만들지 않는다 — 배송본에서도 «가려진다»가 규약이고,
       실시간 블러 재현은 별개다. 아래에서 앱 CSS 를 싣지만 backdrop-filter 는 밑에 깔린 그림을
       실제로 흐리게 «만들어» 원문 추정의 여지를 남긴다 ⇒ 불투명 채우기가 여전히 정답이다. */
  neutralizeRedactForH2C(clone);

  // goya-asset:// 참조를 base64로 재인라인 → 내보낸 HTML이 일반 브라우저에서도 portable
  await inlineGoyaAssets(clone);

  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Noto+Serif+KR:wght@400;600;700&family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">`;

  const bg = state.pageSettings.bg || '#ffffff';
  const css = `
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${bg};font-family:'Noto Sans KR',sans-serif;}
#canvas{width:${CANVAS_W}px;margin:0 auto;}
/* layout */
.section-block{position:relative;width:100%;}
.section-inner{display:flex;flex-direction:column;}
/* ★합쳐 넣은 아래 섹션의 몸 — 이 두 줄이 빠지면 내보낸 HTML 에서
   ⑴ align-self 로 준 가운데·우측 정렬이 통째로 풀리고(flex 가 아니게 된다)
   ⑵ 상자 안 절대배치 요소의 기준이 .section-block 으로 갈아타 y 가 튄다.
   에디터에서 고친 좌표 튐이 «산출물에서만» 재발하는 자리다. */
.section-merged-part{position:relative;display:flex;flex-direction:column;}
.row{position:relative;display:flex;width:100%;}
.row[data-layout="stack"]{flex-direction:column;}
.row[data-layout="flex"]{flex-direction:row;gap:8px;align-items:stretch;}
.row[data-layout="grid"]{display:grid;gap:8px;}
.col{position:relative;min-width:0;display:flex;flex-direction:column;}
.col[data-width="100"]{flex:100;}
.col[data-width="75"]{flex:75;}
.col[data-width="66"]{flex:66;}
.col[data-width="50"]{flex:50;}
.col[data-width="33"]{flex:33;}
.col[data-width="25"]{flex:25;}
/* gap */
.gap-block{display:block;width:100%;}
/* text */
.text-block{width:100%;word-break:keep-all;overflow-wrap:break-word;}
.tb-h1{font-size:104px;font-weight:700;color:#111;line-height:1.1;letter-spacing:-0.02em;}
.tb-h2{font-size:72px;font-weight:600;color:#1a1a1a;line-height:1.15;}
.tb-body{font-size:36px;color:#555;line-height:1.6;}
.tb-caption{font-size:26px;color:#999;line-height:1.6;letter-spacing:0.01em;}
.tb-label{display:inline-block;background:#111;color:#fff;font-size:22px;font-weight:600;padding:6px 18px;border-radius:4px;}
/* speech bubble */
.speech-bubble-block{position:relative;display:block;max-width:80%;}
.speech-bubble-block[data-tail="right"]{margin-left:auto;}
.tb-bubble{background:#e5e5ea;color:#1c1c1e;border-radius:20px;padding:10px 16px;font-size:16px;line-height:1.5;position:relative;display:inline-block;min-width:60px;word-break:break-word;}
.speech-bubble-block .tb-bubble::before{content:'';position:absolute;bottom:0;width:20px;height:16px;}
.speech-bubble-block[data-tail="left"] .tb-bubble::before{left:-8px;background:var(--bubble-bg,#e5e5ea);clip-path:polygon(100% 0,100% 100%,0 100%);}
.speech-bubble-block[data-tail="right"] .tb-bubble::before{right:-8px;background:var(--bubble-bg,#e5e5ea);clip-path:polygon(0 0,0 100%,100% 100%);}
/* asset — ★클리핑 임자는 .asset-block 이 아니라 .asset-img-clip 이다(앱 css/editor-blocks.css:439~453).
   예전엔 여기서 .asset-block 에 overflow:hidden 을 걸어 «화면과 다른» 상자를 만들었다(실측:
   라이브 visible ↔ 내보내기 hidden) — 오버레이 글자가 상자 밖으로 나가는 블록이 배송본에서만
   잘린다. 앱과 같은 임자·같은 값으로 맞춘다. */
.asset-block{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:visible;position:relative;}
.asset-block .asset-icon,.asset-block .asset-label{display:none;}
.asset-block.has-image{overflow:visible;}
.asset-img-clip{position:absolute;inset:0;overflow:hidden;border-radius:inherit;}
.asset-img{width:100%;height:100%;object-fit:cover;display:block;}
/* ★:not(.asset-img) 가 «뜻»이다 (2026-09-21 최종통합 QA medium).
   ⛔이 주석 안에 백틱을 쓰지 마라 — 여기는 «템플릿 리터럴 안»이라 백틱 하나가 CSS 를 통째로
     끊는다(2026-09-21 실측: import 단계에서 SyntaxError, 검사 하네스가 통째로 안 떴다).
   이 줄은 앱 CSS 를 안 싣던 시절의 폴백이다. 그런데 특이도가 (0,2,1) 이라
   수확한 앱 CSS .asset-img{height:100%} (0,1,0) 보다 «세다» ⇒ 뒤에 실어도 손글씨가 이겨
   상자 비율 ≠ 그림 비율인 에셋이 배송본에서만 «위쪽만» 보였다(실측 400×150 상자 → img 251.2px,
   600×376.7 세로그림 → 955.5px). 「손글씨 먼저, 앱 CSS 뒤 ⇒ 뒤가 이긴다」는 «같은 특이도»일
   때의 이야기이지 여기엔 성립하지 않는다.
   ⇒ 클리핑 임자(.asset-img)는 바로 윗줄의 폴백에 맡기고, 이 줄은 그 밖의 img 만 본다.
     CSSOM 이 막혀 appCss 가 비어도 윗줄이 cover 를 책임지므로 폴백은 그대로다.
   회귀: tests/dom/export-html-app-css.dom.spec.js A5·A5-src · tests/unit/export-html-asset-img.test.mjs */
.asset-block.has-image img:not(.asset-img){display:block;max-width:100%;height:auto;}
/* group */
.group-block{width:100%;}
.group-inner{display:flex;flex-direction:column;}
/* graph */
.graph-block{width:100%;overflow:hidden;}
.grb-inner{display:flex;flex-direction:column;height:100%;}
.grb-bars{display:flex;align-items:flex-end;gap:8px;flex:1;padding:16px;}
.grb-bar-col{display:flex;flex-direction:column;align-items:center;flex:1;}
.grb-bar-wrap{flex:1;display:flex;align-items:flex-end;width:100%;}
.grb-bar-fill{width:100%;background:#2d6fe8;}
.grb-bar-label{font-size:20px;color:#555;margin-top:4px;text-align:center;}
.grb-bar-val-label{font-size:18px;font-weight:600;color:#2d6fe8;margin-bottom:2px;}
/* label-group */
.label-group-block{width:100%;display:flex;flex-wrap:wrap;gap:10px;padding:16px;}
.label-item{display:inline-flex;align-items:center;padding:8px 20px;border-radius:40px;font-size:24px;background:var(--preset-label-bg,#e8e8e8);color:var(--preset-label-color,#333333);}
.label-item-delete-btn,.label-group-add-btn{display:none!important;}
/* table */
.table-block{width:100%;overflow:hidden;}
.tb-table{width:100%;border-collapse:collapse;font-size:28px;}
.tb-table th,.tb-table td{padding:10px 16px;border:1px solid #e0e0e0;text-align:center;}
.tb-table thead th{background:#f5f5f5;font-weight:600;}
/* 글자 그라데이션 + 그림자/네온 = 그림자를 글자 «뒤»로 (0919r3 textshadow — 앱 css/editor-blocks.css .tgs 와 같은 규칙).
   이 줄이 없으면 인라인 text-shadow 가 그라데이션 위에 칠해져 페이드가 사라진다. 여러 겹은 아래 <svg> 필터 정의를 참조. */
.tgs{text-shadow:none!important;filter:var(--tgs-filter)!important;}
`;

  /* ★앱 CSS 수확 (2026-09-21 최종통합 QA medium — 「내보낸 HTML 이 화면과 다르다」)
     위 `css` 는 «손으로 쓴 두 번째 CSS»다. 블록이 늘 때마다 같이 안 늙어서, 실앱 34노드 대조에서
     섹션 배경 소실 · 도형 100×100→0×24 · 프레임 flex→block · 캔버스 높이 −807.2px 이 났다.
     ⇒ 베끼지 말고 «지금 캔버스에 실제로 걸리는 규칙»을 CSSOM 에서 뽑아 싣는다
       (js/io/export-css-collect.js — 편집 전용 선택자는 안 담는다).
     ★순서가 뜻이다: 손글씨 `css` 가 «먼저», 수확한 앱 CSS 가 «뒤».
       같은 특이도면 뒤가 이긴다 ⇒ 「화면과 같은 그림」이 손글씨 추정값을 덮는다.
       CSSOM 이 막히면 appCss 가 빈 문자열이 되어 지금과 똑같이 동작한다(퇴행 없음).
     ⚠️매칭 판정은 클론이 아니라 «라이브 canvasEl» 에 한다 — 떼어낸 트리에선 조상이 없어
       `#canvas .x` 류가 거짓 음성이 된다. 라이브 쪽이 클론의 상위집합이라 안전하다. */
  const appCss = collectCanvasCss(canvasEl);

  /* 앱 CSS 뒤에 오는 «배송본 전용» 덮어쓰기 — 화면엔 있어야 하지만 배송본엔 없어야 하는 것.
     ⛔여기에 «화면 재현»용 규칙을 넣지 마라. 그건 위 수확이 할 일이다. */
  const exportOnlyCss = `
/* 이미지가 안 들어간 에셋의 편집용 안내(아이콘·라벨)는 배송본에 나가면 안 된다. */
.asset-block .asset-icon,.asset-block .asset-label{display:none!important;}
.label-item-delete-btn,.label-group-add-btn{display:none!important;}
/* 편집 커서·선택 허용은 배송본에서 뜻이 없다. */
#canvas *{cursor:default!important;}
`;

  // .tgs 글자가 url(#tgs-f-…) 로 가리키는 SVG 필터 정의 — 앱에선 캔버스 밖(body 직속)에 있어 클론에 안 딸려 온다.
  const tgsDefs = textGradShadowDefsMarkup(clone);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Export</title>
${fontLink}
<style>${css}</style>
<style>${appCss}</style>
<style>${exportOnlyCss}</style>
</head>
<body>
${tgsDefs}
<div id="canvas">
${clone.innerHTML}
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'export.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Publish Dropdown ── */

window.exportHTMLFile = exportHTMLFile;
