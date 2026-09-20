/* ═══════════════════════════════════════════════════════════════════════════
   feature-flags.js — «화면이 여러 벌인 기능»의 킬스위치 단일 원본.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 globals.js 가 아니라 여기인가
     globals.js 는 «에디터 화면(index.html)의 모듈»이다. 프로젝트 목록 화면
     (pages/projects.html)은 그 모듈을 로드하지 않는다 — 그래서 목록 화면에서는
     window.COLLAB_ENABLED 가 «undefined» 였고, 킬스위치를 꺼도 카드의 👥 버튼은
     그대로 떴다(2026-09-02 현빈 화면 발견). 스위치가 «닿지 않는 화면»이 있으면
     스위치가 아니다.
   ⇒ 이 파일은 «플레인 스크립트»로, 두 화면이 «둘 다» 맨 앞에서 읽는다.
      (플레인 스크립트는 type=module 보다 «먼저» 실행된다 — 순서 사고도 같이 막힌다.)
   ⚠️새 화면(페이지)을 추가하면 이 파일을 «먼저» 걸어라. 안 걸면 그 화면만 샌다.
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  /* ── ★협업 임시 킬스위치 — «서버가 열릴 때까지» 감춘다(폐기 아님) ─────────
   * false 면 협업으로 «새로 들어가는 문»이 전부 닫힌다:
   *   ⒜ 프로젝트 카드의 👥「원격으로 올리기」 (pages/projects.html)
   *   ⒝ 환경설정 「협업」 탭·패인 (js/settings/settings-modal.js)
   *   ⒞ 동기화 start·autoStart (js/collab/sync.js)
   *   ⒟ 초대 폴링·상단바 「초대 N건」 배지 (js/collab/invites-badge.js)
   *
   * 사유 ①(2026-09-02, 현빈 지시): 서버 협업 API 가 «라이브에 없다».
   *   https://blacksheepwall.kr/api/collab/{create,join,ops} → 전부 404
   *   (대조군 /api/license/signup 은 405 = 존재). server/ec2-server.js 의 ROUTES
   *   화이트리스트에 collab 이 없다. 그런데 앱에는 협업이 v0.8.5 로 이미 나갔다
   *   — 지금 사용자가 저 버튼을 누르면 «반드시» 실패한다.
   * 사유 ②: C8(협업 undo 가 상대 작업 재전파로 영구삭제) 미수정 — feat/collab-undo-op.
   *
   * ★되돌리기 = 이 줄 하나를 true 로. 코드·데이터는 아무것도 안 지웠다.
   *   서버 ROUTES 에 collab 이 올라간 «뒤에» 켠다(순서 반대면 또 404 를 판다).
   * ⚠️데이터는 안 건드린다 — 이미 협업으로 올라간 프로젝트(proj.collabRef)의
   *   「👥 공동작업」 배지·collab-card 표시는 «그대로 남는다». 감추는 건 입구뿐이다
   *   (사용자가 「내 프로젝트가 사라졌다」고 느끼면 안 된다). */
  w.COLLAB_ENABLED = false;

  /* ── ★[M58] 새 프로젝트의 «페이지 배경» 기본값 ─────────────────────────
   * 현빈 2026-09-06: 「애초에 시작할때 캔버스 밝기가 너무 밝아서 바탕색을 777777으로 해줄래?」
   *
   * ⛔이 값이 «네 벌»로 갈라져 있었다 — 만드는 «경로»마다 다른 색이 나왔다:
   *     pages/projects.html «새 프로젝트» 버튼  #f5f5f5  ← 현빈이 본 «거의 흰색»
   *     pages/projects.html «샘플 프로젝트»     #969696
   *     js/tab-system.js    buildEmptyProject  #9b9b9b
   *     js/globals.js       레거시 폴백         #828282
   *   ★tab-system.js 의 주석은 스스로를 「유일한 정본」이라 부르면서 바로 옆줄에
   *     「실제로 projects.html 복사본은 bg 가 다르다」고 «경고까지» 하고 있었다.
   *     경고만 있고 «막는 것»이 없으면 갈라진다 — 이 저장소에서 오늘만 세 번째다.
   *
   * ⇒ 값을 여기 하나로 올린다. 이 파일을 고른 이유는 위 COLLAB_ENABLED 와 «같다»:
   *   두 화면(index.html · pages/projects.html)이 «둘 다» 맨 앞에서 읽는 유일한 자리다.
   *   globals.js 는 에디터 화면 전용 모듈이라 목록 화면에서 undefined 가 된다.
   *
   * ⛔«레거시 폴백»(globals.js 의 #828282)은 «일부러» 안 바꿨다 — 그건 저장본에 bg 키가
   *   없는 «구 프로젝트»를 열 때 쓰는 값이라, 바꾸면 옛 프로젝트의 색이 바뀐다.
   *   현빈 요청은 「애초에 시작할 때」 = «새로 만들 때»였다.
   * ⚠️이미 만들어진 프로젝트도 안 바뀐다(값이 저장본에 박혀 있다). 이건 «새 프로젝트»의 기본값이다. */
  w.PAGE_BG_DEFAULT = '#777777';
})(window);

/* ── ★선택 테두리 «오버레이 층» 킬스위치 (2026-09-06 · 울트라플랜 P0) ────────
 * true 면 선택 표시를 문서(블록 CSS outline)가 아니라 핸들이 이미 쓰는 오버레이
 * 층(#ss-handles-overlay)의 SVG 1장에서 그린다(js/selection-overlay.js).
 *
 * ★왜 «양립»인가 — P0 는 CSS 원본을 «지우지 않는다».
 *   중화(outline-color:transparent)는 `body.sel-ov` 아래에서만 걸리고, 그 클래스는
 *   오버레이 모듈이 «초기화에 성공한 뒤 스스로» 붙인다. 즉 JS 가 죽으면 클래스가
 *   안 붙고 문서 outline 이 그대로 살아 «제품이 성립»한다. 되돌리기 = 이 줄 하나.
 * ⚠️COLLAB_ENABLED 와 달리 이 스위치가 닿는 화면은 에디터(index.html) 하나다 —
 *   프로젝트 목록엔 캔버스가 없다. 그래도 «스위치의 단일 원본»은 여기다.
 */
(function (w) { w.SEL_OVERLAY_ENABLED = true; })(window);

/* ── ★모달 「늘어나면 가운데」 킬스위치 (2026-09-08 · 현빈 발주) ────────────────
 * 현빈: 「이것들은 높이나 너비가 늘어나면 수직수평 정렬로 되는 걸 «디폴트»로 해줘」
 *
 * true 면 모달의 폭이 full→fixed 로, 또는 높이가 auto→fixed 로 «처음» 바뀌는 순간
 * (패널 버튼·핸들 드래그가 전부 이 순간을 만든다) 정렬을 한 번 «채운다»:
 *   dataset.vAlign='center' · dataset.align='center' · dataset.autoCentered='1'
 * 표시키(autoCentered)를 찍은 뒤로는 «영영» 안 채운다 — 그래서 사용자가 왼쪽으로
 * 되돌리면 그 선택이 다음 리사이즈에 살아남는다.
 *
 * ★이 단위에서 «되돌리기가 완전하지 않은 유일한 자리»라 스위치를 단다.
 *   저장본에 vAlign/autoCentered 키가 남기 때문이다(코드를 revert 하면 읽는 데가 없어
 *   무해하지만 데이터엔 남는다). 되돌리기 = 이 줄 하나를 false 로.
 * ⚠️false 로 내려도 «이미 가운데가 된 블록»은 그대로 가운데다 — 읽기는 계속 살아 있다.
 *   사용자가 만든 페이지의 모양을 소급해서 바꾸지 않는다. 끄는 것은 «채우는 일»뿐이다.
 */
(function (w) { w.MODAL_AUTOCENTER = true; })(window);

/* ── ★가림막(Redact) «모자이크» 임시 킬스위치 (2026-09-20 · 현빈 발주 «0920b-mosaic-off» · 카드 T-070) ──
 * 현빈 원문: 「가림막(Redact)에 모자이크가 안됨. 우선 모자이크 버튼의 기능은 막아둘 것(블러만 둘 것)」
 *
 * false 면 모자이크로 «새로 들어가는 문»이 전부 닫힌다:
 *   ⒜ 속성패널 「방식」의 «모자이크» 버튼 = disabled(⛔지우지 않는다 — 현빈 표현이 「기능을 막아둘 것」)
 *      (js/props/prop-shape.js)
 *   ⒝ 스냅샷 캡처 자체 — captureMosaicSnapshot 입구에서 막아 html2canvas 호출 0회
 *      (js/effects/redact-mosaic.js). 호출처(패널·block-factory·로드후·mouseup 디바운스)를
 *      각각 막지 않는다 — 문이 하나여야 새 호출처가 생겨도 안 샌다.
 *   ⒞ 문서 mouseup 자동 재캡처 리스너 미등록 · captureMosaicsAfterLoad 즉시 return
 *   ⒟ 이미 «모자이크»로 저장된 블록은 회색(#4a4a4a) 대신 «블러»로 보인다
 *      (css/editor-blocks.css 의 body.redact-mosaic-off 오버라이드).
 *      ★강도는 «사용자가 저장한 값»(data-shape-redact-blur, 2~20)을 CSS 가 직접 읽는다 —
 *        인라인 --redact-blur 는 속성패널을 «열었을 때만» 채워지므로, 열지 않은 블록이
 *        폴백 8px 로 약하게 그려지던 것을 픽스 라운드에서 고쳤다.
 *      ★backdrop-filter 를 못 쓰는 렌더러에서는 @supports not 으로 «불투명 회색»을 그대로 남긴다.
 *   ⒡ 차단 중 «강도 슬라이더»를 만져도 dataset.shapeRedactMode="mosaic" 는 그대로다 —
 *      모드를 «실제로 고른» 호출(방식 버튼)만 모드를 바꾼다(prop-shape.js opts.explicitMode).
 *      ⛔가림막 토글을 껐다 켜면 dataset.shapeRedactMode 는 지워진다(끌 때 지워지는 게 원래 동작).
 *   ⒠ goditor-api updateShapeBlock(MCP update_shape_block)의 shapeRedactMode:'mosaic' 요청
 *      = { ok:false, code:'DISABLED' } — 조용히 blur 로 바꿔치지 않는다(「오류 삼키는 코드 = 위 판정 거짓말」).
 *
 * ★막은 이유 — 「모자이크가 안 된다」의 코드 경로(2026-09-20 조사):
 *   js/effects/redact-mosaic.js 의 html2canvas(scope, { useCORS:true, … }) 가
 *   goya-asset:// 스킴 이미지를 «못 싣는다». vendor/html2canvas/html2canvas.min.js 는
 *   useCORS:true 면 same-origin 이 아닌 모든 이미지에 crossOrigin="anonymous" 를 걸고,
 *   커스텀 스킴은 cross-origin 이라 «로드 자체»가 실패한다(이 레포의 실측 기록 2건:
 *   js/scratch-pad.js:293-294, js/image-color-adjust.js:268). 로드 실패는 html2canvas 가
 *   조용히 삼킨다(.catch(function(){})).
 *   ⇒ 가림막 밑이 사진이면 캡처에 사진이 빠지고 섹션 흰 배경만 찍혀 «픽셀이 아니라 단색 덩어리»,
 *     배경까지 투명한 자리면 _isSuspiciouslyBlank 에 걸려 «영영 회색 #4a4a4a» 가 된다.
 *   ⚠️PNG 내보내기는 네이티브 CDP 캡처(export-image.js captureSectionCdp)라 멀쩡해 보여서
 *     «화면만 이상한» 비대칭이 났다. 기존 DOM 스펙은 하네스가 «색 div»만 써서(이미지 0개)
 *     이 결함축이 측정범위 밖이었다 — 「한 축의 0건 ≠ 결함 0」.
 *   ⇒ 프로토타입(a0278a7) 이후 이 파일을 고친 커밋이 «8건»(a82c035·edbef24·5cc2075·b597b35·
 *     8e7e76d·2fcd9c5·6c1442c·a8d47dc) 인데도 사용자 화면에선 여전히 «안 된다» 였다.
 *     원인 수정은 별도 카드 T-071 «0920b-mosaic-cause» 로 뗀다 — 이 스위치는 «차단»만 한다.
 *
 * ★되살리는 조건(카드 T-071 «0920b-mosaic-cause» ④) — 둘 다 만족할 때만 true 로:
 *   ① 실앱(격리 포트)에서 «goya-asset:// 이미지가 캡처에 실린다» 를 픽셀로 확인
 *      (사진 자리 픽셀이 섹션 배경 단색이 아님).
 *   ② «실제 img» 를 쓰는 DOM 스펙(색 div 말고)이 초록.
 *   ⛔①을 건너뛰고 켜면 같은 결함이 그대로 돌아온다 — 8번 그랬다.
 *
 * ⚠️데이터는 아무것도 안 지웠다 — block.dataset.shapeRedactMode="mosaic" 는 그대로 남는다.
 *   되돌리기 = 이 줄 하나를 true 로. 지웠으면 되살릴 때 사용자의 선택이 사라졌을 것이다.
 * ⚠️실패 방향 — 두 축 다 안전 쪽이다.
 *   ⑴ JS 가 죽어 body.redact-mosaic-off 가 안 붙으면 옛 동작(불투명 회색)으로 남는다.
 *   ⑵ backdrop-filter 를 못 쓰는 렌더러면 @supports not 으로 역시 불투명 회색이 남는다
 *      (근투명 배경 + 블러만 믿었다면 사실상 «안 가려짐»이 됐을 축 — 픽스 라운드에서 닫았다).
 *   원본 노출은 어느 쪽으로도 0.
 */
(function (w) { w.REDACT_MOSAIC_ENABLED = false; })(window);
