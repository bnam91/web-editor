// capture-safety.js — html2canvas로 캡처하는 클론에서 프라이버시 안전장치를 건다.
//
// .shape-redact(가림막)는 backdrop-filter로 밑에 깔린 콘텐츠를 흐리는데,
// html2canvas는 backdrop-filter를 지원하지 않아 배경이 근투명(rgba(255,255,255,0.001))
// 그대로 그려져 가려야 할 원본이 «그대로 노출»된다(2026-09-15 실측 확인:
// captureThumbnail·prop-mockup._captureAndApply 둘 다 재현).
//
// ⚠️ CDP 네이티브 캡처(export-image.js captureSectionCdp)는 실제 브라우저 합성을
// 그대로 스크린샷하므로 backdrop-filter가 정상 렌더링된다 — 이 함수는 «html2canvas
// 경로에서만» 호출해야 한다. 네이티브 경로의 clone에 걸면 정상 블러까지 망가진다.
import { parseGradient } from '../props/gradient-model.js';

const REDACT_OPAQUE_FILL = '#4a4a4a';

export function neutralizeRedactForH2C(root) {
  if (!root) return;
  const targets = [
    ...(root.classList?.contains('shape-redact') ? [root] : []),
    ...root.querySelectorAll('.shape-redact'),
  ];
  for (const el of targets) {
    // backdrop-filter를 안전 실패(fail-safe)로 대체: html2canvas가 못 그리든 말든
    // 이 영역은 항상 불투명한 색으로 채워져 원본이 절대 비치지 않는다.
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    el.style.background = REDACT_OPAQUE_FILL;
    el.style.backgroundColor = REDACT_OPAQUE_FILL;
  }
}

/* 0918r2 textgrad — 글자 그라데이션(background-clip:text)의 html2canvas 대체.
 * 동봉 html2canvas 1.4.1 은 background-clip 을 border/padding/content 만 읽는다 → text 는 모른다.
 * 그대로 두면 «글자 박스 전체에 그라데이션 사각형 + 투명 글자»가 찍힌다(글자가 사라지고 네모가 생긴다).
 * ⇒ 정직한 대체: 그라데이션을 걷고 첫 스탑 단색으로 글자를 칠한다.
 *   ★인라인 color 는 «마지막 단색» 저장소라 첫 스탑이 아니다 — 여기서 bg-image 를 파싱해 계산한다.
 * ⚠️ native(CDP) 경로에선 부르지 말 것 — 브라우저가 그라데이션 글자를 제대로 그린다. */
function _firstStopHex(css) {
  const m = parseGradient(css);
  if (!m || !Array.isArray(m.stops) || !m.stops.length) return null;
  const c = String([...m.stops].sort((a, b) => a.offset - b.offset)[0].color || '').trim();
  const r = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (r) return '#' + [r[1], r[2], r[3]].map(n => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0')).join('');
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map(x => x + x).join('').toLowerCase();
  return null;
}

export function neutralizeTextGradForH2C(root) {
  if (!root) return 0;
  const sel = '[style*="background-clip: text"], [style*="background-clip:text"]';
  const targets = [
    ...(root.matches?.(sel) ? [root] : []),
    ...root.querySelectorAll(sel),
  ];
  let n = 0;
  const done = new Set();
  for (const el of targets) {
    const st = el.style;
    const clip = (st.getPropertyValue('background-clip') || '') + ' ' + (st.getPropertyValue('-webkit-background-clip') || '');
    if (!/\btext\b/.test(clip)) continue;
    const fb = _firstStopHex(st.backgroundImage || '');
    st.removeProperty('background-image');
    st.removeProperty('background-clip');
    st.removeProperty('-webkit-background-clip');
    st.removeProperty('-webkit-text-fill-color');
    if (fb) st.setProperty('color', fb);
    done.add(el);
    n++;
  }
  /* ★2026-09-21 최종통합 QA medium — 글자 그라데이션이 «CSS 클래스에서만» 오는 자리가 있다.
   *   위 선택자는 «인라인 style»만 고른다. 그런데 예컨대 css/editor-blocks.css:2929~2933
   *   `.badge-hologram-square .badge-logo` 는 배지 블록의 «기본 상태»가 곧 글자 그라데이션이다
   *   (사용자가 색을 한 번 만져야 비로소 인라인이 생겨 위에서 잡힌다).
   *   이 함수를 타는 경로(썸네일·목업 캡처)는 Electron 에서도 «항상» html2canvas 라 실제로 영향받는다.
   *   ⇒ 클론이 문서에 붙은 «뒤»에 부르는 규약(세 호출부 전부 appendChild 다음)을 이용해
   *     계산값으로 한 번 더 훑는다. ⛔클래스는 인라인으로 «지울» 수 없으니 removeProperty 가 아니라
   *     명시적 덮어쓰기다(border-box + text-fill-color 복원).
   *   ⚠️클론이 문서에 안 붙어 있으면 계산값이 비어 이 두 번째 훑기는 «아무 일도 안 한다» —
   *     그건 «조용한 실패»가 아니라 이 함수의 호출 규약(붙인 뒤에 불러라)이 깨진 것이다. */
  const all = [...(root.nodeType === 1 ? [root] : []), ...root.querySelectorAll('*')];
  for (const el of all) {
    if (done.has(el)) continue;
    let cs;
    try { cs = window.getComputedStyle(el); } catch (_) { continue; }
    if (!cs) continue;
    const clip = (cs.getPropertyValue('background-clip') || '') + ' ' + (cs.getPropertyValue('-webkit-background-clip') || '');
    if (!/\btext\b/.test(clip)) continue;
    const bgImg = cs.getPropertyValue('background-image') || '';
    const fb = _firstStopHex(bgImg) || _firstStopHex(el.style.backgroundImage || '');
    const st = el.style;
    st.setProperty('background-image', 'none');
    st.setProperty('background-clip', 'border-box');
    st.setProperty('-webkit-background-clip', 'border-box');
    // 글자를 실제로 칠하는 값 — 클래스가 걸어 둔 transparent 를 «덮어» 되살린다.
    st.setProperty('-webkit-text-fill-color', fb || cs.getPropertyValue('color') || 'currentcolor');
    if (fb) st.setProperty('color', fb);
    n++;
  }
  // 0919r3 textshadow: html2canvas 는 filter 를 못 그린다 — 단색 대체 위 그림자는 순서 문제가 없으니
  //   .tgs(drop-shadow 파생)를 걷어 원래 text-shadow 를 되살린다.
  const tgs = [...(root.matches?.('.tgs') ? [root] : []), ...root.querySelectorAll('.tgs')];
  for (const el of tgs) {
    el.classList.remove('tgs');
    el.style.removeProperty('--tgs-src');
    el.style.removeProperty('--tgs-filter');
  }
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════════
   object-fit 대체 — html2canvas 경로 전용  [2026-09-21 최종통합 QA medium]

   ★무엇이 틀렸나 (실측): 동봉한 html2canvas 1.4.1 에는 `object-fit` 이 «한 글자도» 없다
     (vendor/html2canvas/html2canvas.min.js — 문자열 0건). 그래서 이미지를 늘 상자에
     «늘려» 그린다(fill). 화면·네이티브 PNG 는 cover 로 가운데를 잘라 보여주는데
     썸네일·목업 캡처만 전체 그림을 찌그러뜨려 넣는다 ⇒ 프로젝트 목록에서 보는 그림이
     실제 상세페이지와 «다른 그림»이 된다.
     (실측: 그리드 716×300 상자에 860×540 그림 → 화면·네이티브는 위·아래 마커 띠 0행,
      썸네일만 초록 16행·주황 17행이 «나타났다». 상자 비율 = 그림 비율인 풀블리드는
      화면도 썸네일도 29행 — 같은 실행 안의 양성대조.)

   ★고치는 방법 — «규칙»이 아니라 «픽셀»로 준다.
     상자 크기대로 캔버스를 만들고 cover/contain 산식으로 직접 그려서 그 결과를 img.src 로
     갈아 끼운다. 그러면 html2canvas 가 그 그림을 상자에 늘려 그려도(=fill) 이미 잘린
     그림이라 «화면과 같은 그림»이 나온다.
   ⛔노드를 div 로 바꿔 background-size:cover 로 주는 길은 «안» 쓴다 — `.itb-icon img` 처럼
     «요소 선택자»로 크기를 주는 규칙이 있어 img 를 div 로 바꾸면 그 상자가 통째로 무너진다.
   ⚠️네이티브(CDP) 경로에선 부르지 말 것 — 브라우저가 object-fit 을 제대로 그린다.
     이 함수를 태우면 «두 번 자르기»가 되어 도리어 화면과 갈린다.
   ★비율이 이미 같으면(자를 것이 없으면) 손대지 않는다 — 재인코딩으로 화질이 상하지 않게.
   ★실패는 «조용한 통과»가 아니라 «전과 같음»이다 — tainted canvas(CORS)·디코드 실패는
     원본 img 를 그대로 두므로 고치기 전과 똑같이 동작한다(퇴행 없음).
   ★object-position 은 «center 고정»으로 계산한다 — 이 레포는 그 속성을 한 군데도 안 쓴다
     (js·css 전수 0건). 쓰기 시작하면 여기도 같이 읽어야 한다.
   ⛔<video> 는 건드리지 않는다 — html2canvas 는 애초에 비디오 프레임을 못 그린다(별개 축).
   부르는 곳(html2canvas 3경로): js/io/save-load.js captureThumbnail ·
     js/props/prop-mockup.js _captureAndApply · js/io/export-image.js 의 html2canvas 폴백.
   반환 = 실제로 갈아 끼운 그림 수(검사·디버깅용).
   ══════════════════════════════════════════════════════════════════════════ */
export async function neutralizeObjectFitForH2C(root) {
  if (!root) return 0;
  const imgs = [
    ...(root.matches?.('img') ? [root] : []),
    ...root.querySelectorAll('img'),
  ];
  let n = 0;
  for (const el of imgs) {
    try {
      const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(el) : null;
      const fit = (cs?.objectFit || '').trim();
      if (fit !== 'cover' && fit !== 'contain') continue;
      /* 상자는 «레이아웃 px»로 잰다 — 이 클론은 body 직속(position:fixed)이라 캔버스 줌
         (transform:scale) 밖이지만, offsetWidth 는 배율에 아예 안 속는다. */
      const bw = el.offsetWidth, bh = el.offsetHeight;
      if (!(bw > 0) || !(bh > 0)) continue;
      if (!el.complete || !el.naturalWidth) { try { await el.decode(); } catch (_) { /* 못 읽으면 그대로 둔다 */ } }
      const nw = el.naturalWidth, nh = el.naturalHeight;
      if (!(nw > 0) || !(nh > 0)) continue;
      /* 비율이 같으면 cover 도 contain 도 «아무것도 안 자른다» — 건드릴 이유가 없다.
         ★«상대»오차로 잰다 — 절대값으로 재면 비율 자체가 큰 상자(가로로 긴 띠)에서는
           같은 어긋남도 크게 나오고, 400×251.16 처럼 offsetHeight 반올림(251)만으로도
           문턱을 넘어 «자를 것도 없는데» 재인코딩한다(실측: DOM T3 에서 걸렸다). */
      const boxR = bw / bh, imgR = nw / nh;
      if (Math.abs(boxR - imgR) / imgR < 0.005) continue;
      const s = fit === 'cover' ? Math.max(bw / nw, bh / nh) : Math.min(bw / nw, bh / nh);
      const dw = nw * s, dh = nh * s;
      const cvs = document.createElement('canvas');
      cvs.width  = Math.max(1, Math.round(bw));
      cvs.height = Math.max(1, Math.round(bh));
      const ctx = cvs.getContext('2d');
      if (!ctx) continue;
      ctx.imageSmoothingQuality = 'high';
      // 가운데 정렬(object-position:50% 50%) — contain 이면 남는 자리는 «투명»으로 둔다.
      ctx.drawImage(el, (cvs.width - dw) / 2, (cvs.height - dh) / 2, dw, dh);
      const url = cvs.toDataURL('image/png');   // tainted 면 여기서 던진다 ⇒ catch 로 «전과 같음»
      el.src = url;
      el.style.objectFit = 'fill';              // 이미 잘린 그림이다 — 두 번 자르지 않게
      try { await el.decode(); } catch (_) {}   // html2canvas 가 바로 읽을 수 있게
      n++;
    } catch (_) { /* 이 한 장만 «전과 같이» 둔다 */ }
  }
  return n;
}

/* ── 편집 전용 DOM·상태 걷기 (캡처 클론 공용) ────────────────────────────────────
 * ★2026-09-21 최종통합 QA medium: 「저장할 때 편집 중이던 상태가 프로젝트 목록 썸네일에
 *   그대로 박힌다」 — js/io/save-load.js captureThumbnail 은 클론에서 ⑴.section-label
 *   ⑵.section-toolbar ⑶루트의 .selected «셋»만 걷었고, 내보내기 클론이 걷는 나머지
 *   (펜 어노테이션·admin QA 블록·편집 전용 임시 DOM·미입력 placeholder 안내문구·자식
 *   블록의 .selected/.img-editing/.row-active 등)는 하나도 안 걷었다.
 *   실측(EXPORT-D): [thumb] 주석(자홍) 200px · 편집전용프록시(하늘) 100px 이 실제로 찍혔다.
 * ⇒ 명부를 «두 벌»로 두면 한쪽만 늙는다. 한 벌로 모아 두 경로가 같이 늙게 한다.
 *   ⛔여기 담는 것은 «편집 chrome 걷기»뿐 — 경로마다 다른 것(클론 위치·isolation·
 *     inset shorthand 변환·컴포넌트 재렌더)은 부르는 쪽에 남는다.
 * 부르는 곳: js/io/export-image.js prepareCloneForCapture · js/io/save-load.js captureThumbnail */
export function stripEditorOnlyForCapture(clone) {
  if (!clone) return;
  /* ★querySelector«All» 이다 — 이 명부를 단독 HTML 내보내기(js/io/export-html.js)가 같이 쓰면서
     클론이 «섹션 하나»가 아니라 «캔버스 전체»인 경우가 생겼다. 첫 하나만 지우면 나머지 섹션의
     라벨·툴바가 그대로 배송본에 실린다. 섹션 클론에서는 결과가 전과 같다(하나뿐이므로). */
  clone.querySelectorAll?.('.section-label, .section-toolbar').forEach(el => el.remove());
  clone.querySelectorAll('.variation-badge').forEach(el => el.remove());
  // C18: 펜툴 어노테이션(리뷰용 주석)과 진행중 미리보기는 리뷰 표시일 뿐 — 산출 이미지에 박히면 안 됨.
  // (대조: todo-pin은 #todo-pin-overlay로 섹션 밖이라 애초에 클론에 안 들어감)
  clone.querySelectorAll('.annotation-block, .annot-preview').forEach(el => el.remove());
  // admin QA 체크리스트 블록 — 콘텐츠가 아니라 작업 메타데이터다. 자리도 차지하면 안 되므로
  // 숨기지 않고 완전히 remove() 한다(annotation-block과 같은 원칙). 감싸는 .row 까지 지워야
  // 그 블록이 차지하던 세로 공간도 같이 사라진다.
  clone.querySelectorAll('.qa-block').forEach(el => {
    const row = el.closest('.row');
    if (row) row.remove(); else el.remove();
  });
  // 미입력 placeholder 안내문구는 산출 결과에 박히면 안 됨.
  // data-is-placeholder="true"는 실제 글자가 들어가면 즉시 삭제되므로, 클론에 true로 남은
  // 요소는 미입력 placeholder가 확정 → 안내문구 «가시성만» 숨겨 자식 DOM(<li>/<span> 등)과
  // 점유 높이는 그대로 둔다. (textContent='' 는 tb-bullet의 <li> 등 자식 DOM을 통째로 제거해
  //  height가 collapse되므로 금지. visibility:hidden은 자식·list marker까지 숨기되 박스 높이 유지.)
  clone.querySelectorAll('[data-is-placeholder="true"]').forEach(el => {
    el.style.visibility = 'hidden';
  });
  // 편집 전용 임시 DOM — 캡처 클론에 새어 나가면 그림에 박힌다.
  clone.querySelectorAll('.sec-bg-proxy, .img-edit-hint, .img-boundary').forEach(el => el.remove());
  // 도형 «이미지 넣기 전» 바둑판(0918 picker) — 편집 전용 표시다. CSS 규칙이 data-shape-fill="image"
  //   (이미지 없음)에 걸리므로 클론에서 그 속성을 떼면 마지막 단색(svg color)으로 나간다. 이미지가
  //   실제로 들어간 도형(data-shape-image)은 인라인 div 라 그대로 둔다.
  clone.querySelectorAll('.shape-block[data-shape-fill="image"]:not([data-shape-image])').forEach(el => {
    el.removeAttribute('data-shape-fill');
  });
  clone.classList?.remove('selected', 'sec-bg-editing');
  // 캔버스 전체 클론에서는 «루트»가 아니라 자식 섹션이 sec-bg-editing 을 달고 있다.
  clone.querySelectorAll?.('.sec-bg-editing').forEach(el => el.classList.remove('sec-bg-editing'));
  // 자식 블록의 UI 상태 클래스 전부 제거 (outline, dashed border, opacity 등 오염 방지)
  // ★row-active/col-active(2026-09-15 a1-a3 지적): editor-blocks.css가 이 둘에 z-index:1을
  //   줘서(활성 줄/칸 강조용) .row/.col이 스태킹 컨텍스트가 된다 — 벗기기 목록에 없으면
  //   클론에 그대로 남아, 그 안의 redact 도형이 z-index:3을 받아도(:has() 규칙)
  //   «줄 전체»가 z-index:1에 갇혀 겹치는 다른 줄의 글자(z-index:2)보다 아래일 수 있다.
  clone.querySelectorAll(
    '.selected, .img-editing, .editing, .dragging, .group-selected, .group-editing, .ss-drag-over, .drag-over, .item-selected, .bn2-line-selected, .bn2-line-empty, .grd-line-selected, .stb-line-selected, .stb-step-selected, .row-active, .col-active'
  ).forEach(el => {
    el.classList.remove('selected', 'img-editing', 'editing', 'dragging',
      'group-selected', 'group-editing', 'ss-drag-over', 'drag-over', 'item-selected', 'bn2-line-selected', 'bn2-line-empty',
      'grd-line-selected', 'stb-line-selected', 'stb-step-selected', 'row-active', 'col-active');
  });
  /* ★프라이버시(2026-09-15, a1-a3 지적+elementFromPoint 실측 확인 — T-027 z-index 수정
   * (editor-blocks.css .shape-block.shape-redact z-index:3)의 잔여 구멍): transform이
   * 걸린 조상은 «새 스태킹 컨텍스트»를 만든다 — 그 안의 redact 도형은 z-index:3이어도
   * «조상 밖»의 형제(.text-block 등, z-index:2)와 직접 비교되지 못한다. 조상 자신이
   * z-index:auto면 밖의 형제가 조상 전체(=속의 redact 도형까지) 위에 그려질 수 있다.
   * frame-block은 applyFrameTransform(frame-geometry.js)이 거의 항상 인라인 transform을
   * 써서 이 조건에 걸린다. ⇒ 특정 클래스를 나열하지 않고 «인라인 transform이 있는 조상
   * 전부»를 redact 도형마다 훑어 같이 z-index를 끌어올린다. 클론에만 적용 — 라이브
   * DOM·selected 상태의 실제 스태킹 동작은 안 건드린다.
   * ★썸네일 경로도 같이 받는다(2026-09-21) — 썸네일은 프로젝트 목록에 그대로 보이는 그림이라
   *   가림막이 새면 내보내기와 똑같이 새는 것이다. */
  clone.querySelectorAll('.shape-block.shape-redact').forEach(shp => {
    for (let anc = shp.parentElement; anc && anc !== clone; anc = anc.parentElement) {
      if (anc.style && anc.style.transform && anc.style.transform !== 'none') {
        const curZ = parseInt(anc.style.zIndex, 10);
        if (!Number.isFinite(curZ) || curZ < 3) anc.style.zIndex = '3';
      }
    }
  });
}
