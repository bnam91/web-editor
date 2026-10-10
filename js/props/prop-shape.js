import { propPanel } from '../globals.js';
import { checkerBgBigColors, checkerSvgFills } from '../checker-tokens.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { svgStopRemap } from './gradient-model.js';
import { overlayToggleBtnHTML, blockHeaderHTML } from './_helpers.js';
import { starPoints, starClipPath, clampStarN, STAR_MIN, STAR_MAX,
         starPointsList, starViewBox, clampStarCount, STAR_COUNT_MIN, STAR_COUNT_MAX,
         clampStarInner, STAR_INNER_MIN, STAR_INNER_MAX, STAR_INNER_DISPLAY,
         clampStarGap, STAR_GAP_MIN, STAR_GAP_MAX,
         clampStarRating, starRatingFills, starRatingPreview,
         STAR_RATING_MIN, STAR_RATING_MAX, STAR_RATING_COUNT,
         STAR_FILL_ON, STAR_FILL_OFF,
         starViewBoxWidth, starFrameWidthFor,
         starFillsFor, starColorList, starColorsAttr,
         starScaleList, starScalesAttr, clampStarScale,
         STAR_SCALE_MIN, STAR_SCALE_MAX, STAR_SCALE_DEFAULT } from '../shape-star.js';
import { starSelectedIndex, starModeBlock, exitStarMode } from '../star-select.js';
import { posElOf, wireFloatToggle, wireFloatPosition, floatPositionRowHTML } from '../overlay-float.js';

// 캔버스에서 온캔버스 그라데이션 라인을 드래그하면(gradient-line-overlay.js, source==='canvas')
// 모달이 열려 있을 때 스와치 미리보기만 동기화한다. bg 쓰기/재렌더는 이미
// gradient-model.js의 shape-block set()이 처리하므로 여기서 중복 적용하지 않는다(루프 방지).
let _applyingExternalShapeGrad = false;
document.addEventListener('gradient-line:change', (e) => {
  if (e.detail?.source !== 'canvas') return;
  const block = e.target?.closest?.('.shape-block');
  if (!block || !e.detail?.css) return;
  _applyingExternalShapeGrad = true;
  const sw = document.getElementById('shape-color-color')?.closest('.prop-color-swatch');
  if (sw) sw.style.background = e.detail.css; // 모달이 열려 있으면 스와치 미리보기 갱신
  _applyingExternalShapeGrad = false;
});

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return '#cccccc';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#cccccc';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

const SHAPE_ICONS = {
  star:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 9.8,6.2 14.5,6.2 10.8,8.9 12.2,13.5 8,10.8 3.8,13.5 5.2,8.9 1.5,6.2 6.2,6.2" fill="#888"/></svg>`,
  rectangle: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  ellipse:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  line:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  arrow:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/><polyline points="8,2 14,2 14,8" stroke="#888" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  polygon:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,12 2,12" stroke="#888" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>`,
};
const SHAPE_NAMES = {
  star: 'Star', rectangle: 'Rectangle', ellipse: 'Ellipse',
  line: 'Line', arrow: 'Arrow', polygon: 'Polygon',
};

/** 도형 크기 한 축을 «쓰는 곳과 같은 객체»(래퍼 frame)에서 읽는다 — style → dataset → 실제 레이아웃.
 *  offsetWidth/Height 는 CSS transform(캔버스 줌)에 안 흔들리는 layout 값이라 줌 40/150% 에서도 같다. */
function _shapeFrameSize(el, axis) {
  if (!el) return 100;
  const styleV = parseInt(axis === 'w' ? el.style.width : el.style.height);
  if (styleV) return styleV;
  const dataV = parseInt(axis === 'w' ? el.dataset.width : el.dataset.height);
  if (dataV) return dataV;
  return Math.round(axis === 'w' ? el.offsetWidth : el.offsetHeight) || 100;
}

export function showShapeProperties(block) {
  if (!block) return;

  const shapeType   = block.dataset.shapeType || 'rectangle';
  const rawColor    = block.dataset.shapeColor || '#cccccc';
  // 그라데이션 적용 상태: shapeGradient JSON 존재 또는 shapeColor가 linear-gradient(... CSS
  let gradientMeta = null;
  try { gradientMeta = block.dataset.shapeGradient ? JSON.parse(block.dataset.shapeGradient) : null; } catch (_) {}
  const isGradient  = !!gradientMeta || /gradient/.test(rawColor);
  const gradientCss = isGradient ? rawColor : '';
  // picker/hex 표시용 hex — 그라데이션이면 첫 stop, 아니면 그대로
  // ★shapeColor 에 그라데이션 CSS 가 남았는데 메타가 없으면(이미지 모드 등) 첫 스톱을 모른다 →
  //   회색 기본값 대신 svg 의 마지막 단색으로(0918 picker: 이미지→솔리드 = 마지막 단색)
  const color       = isGradient
    ? (gradientMeta?.stops?.[0]?.color || _lastSolidOf(block) || '#cccccc')
    : rawColor;
  const colorAlpha  = parseAlphaFromColor(color);
  const strokeWidth = parseInt(block.dataset.shapeStrokeWidth || '3');
  const strokeColor = block.dataset.shapeStrokeColor || color;
  const strokeColorAlpha = parseAlphaFromColor(strokeColor);
  // ★크기는 «래퍼 frame»에 있다 — shape-block 자신은 인라인 width/height 를 안 쓰고
  //   CSS 100% 로 frame 을 따른다(js/block-factory.js addShapeBlock, css/editor-blocks.css .shape-block).
  //   여기서 block.style 을 읽던 탓에 언제나 NaN→100 이라 패널이 실제 크기와 무관한 거짓값(100/100)을
  //   보였고, 쓰는 쪽 applySize 는 frame 에 써서 «읽는 곳과 쓰는 곳이 다른 객체»였다.
  //   폴백 꼴은 레포 선례를 따른다(prop-mockup.js Width: style→dataset,
  //   prop-label-group.js: style→offsetWidth, overlay-handles.js _onMockupHandleMouseDown).
  const ss          = block.closest('.frame-block');
  const w           = _shapeFrameSize(ss || block, 'w');
  const h           = _shapeFrameSize(ss || block, 'h');
  const starN       = clampStarN(block.dataset.starPoints);
  const starCount   = clampStarCount(block.dataset.starCount);   // ★별 «갯수»(현빈 2026-10-06) — 없으면 1 = 옛 별
  const starInner   = clampStarInner(block.dataset.starInner);   // ★null = ★미설정 = ★옛 별(특례)
  const starGap     = clampStarGap(block.dataset.starGap);       // ★없으면 0 = 옛 간격(틀 폭 그대로)
  const starRating  = clampStarRating(block.dataset.starRating); // ★null = ★미설정 = ★평점 아님(1010t1b3)
  const ratingOn    = starRating !== null;                       // ★켜져 있으면 ★갯수가 ★5 로 ★잠긴다
  /* ★★«고른 별»(1010t1b2) — ★`js/star-select.js` 가 ★JS 프로퍼티에 들고 있다(⛔속성이 아니다 = ★직렬화 안 탄다) */
  const starSel     = (starModeBlock() === block) ? starSelectedIndex(block) : null;
  const starSelColors = starColorList(block.dataset.starColors, starCount) || [];
  const iconSvg     = SHAPE_ICONS[shapeType] || SHAPE_ICONS.rectangle;
  const shapeName   = SHAPE_NAMES[shapeType] || shapeType;
  const id          = block.id || '';
  // 가림막(redact) — 얼굴/주민번호 등 밑에 깔린 콘텐츠를 backdrop-filter로 흐리는 모드.
  // rect/ellipse만 지원: backdrop-filter는 요소의 border-box(+border-radius)로만 클립되어
  // polygon/star/line/arrow처럼 실제 윤곽이 사각형이 아닌 도형엔 시각적으로 안 맞는다.
  const canRedact   = shapeType === 'rectangle' || shapeType === 'ellipse';
  const isRedact    = canRedact && block.dataset.shapeRedact === 'true';
  const redactBlur  = parseInt(block.dataset.shapeRedactBlur || '8');
  // 모드: 'blur'(기본, backdrop-filter 실시간) | 'mosaic'(스냅샷 픽셀화, js/effects/redact-mosaic.js)
  // ★모자이크 임시 차단(2026-09-20 «0920b-mosaic-off» T-070, js/feature-flags.js REDACT_MOSAIC_ENABLED):
  //   스위치가 꺼져 있으면 «패널도 캔버스와 같은 말»을 해야 한다 — 화면은 블러로 보이는데(CSS
  //   body.redact-mosaic-off) 패널만 「모자이크 active」면 사용자가 뭘 보고 있는지 알 수 없다.
  //   ⇒ 레거시 mosaic 블록도 패널에선 blur 로 읽는다. ⛔dataset 은 안 고친다(데이터 보존).
  //   ⛔`=== false` 비교 — 플래그를 안 얹는 하네스(undefined)는 «켜짐»이다.
  const mosaicOK    = window.REDACT_MOSAIC_ENABLED !== false;
  const redactMode  = (mosaicOK && block.dataset.shapeRedactMode === 'mosaic') ? 'mosaic' : 'blur';
  // ★차단 중 «저장값은 아직 모자이크»인 레거시 블록(현빈이 신고한 그 블록들, 2026-09-21).
  //   위 :98 이 패널을 blur 로 «읽는» 덕에 화면과 패널은 같은 말을 하지만, 그것만 두면 패널이
  //   「이건 블러다」라고 «거짓 상태»를 말한다 — 저장값은 mosaic 이라 T-071 로 스위치를 되살리면
  //   그 블록만 조용히 모자이크로 돌아간다. 게다가 「블러」 버튼은 이미 active 라 사용자가 누를
  //   이유가 없어 «전환 길»이 사실상 닫혀 있다(코드상 D10 으로 열려 있어도 눈에 안 보인다).
  //   ⇒ ⑴그 사실을 글로 고지하고 ⑵「블러로 바꾸기」를 «보이는 버튼»으로 준다. seg 상태는 불변.
  const legacyMosaic = isRedact && !mosaicOK && block.dataset.shapeRedactMode === 'mosaic';
  /* 오버레이(플로팅) — Figma 의 Ignore Auto Layout. 도형은 «위치를 쥔 요소»가 .shape-block 이
     아니라 자유배치 래퍼 프레임이다(shape-frame.js shapeFrameOf = 판정 SSOT). 동작은
     js/overlay-float.js 가 텍스트와 «같은 코드»로 돈다 — 여기선 상태만 읽어 버튼을 그린다.
     (2026-09-20 현빈 원문 3번 「도형 블럭과 에셋 블럭에도 오버레이 버튼·기능」 / T-052) */
  const floatPosEl     = posElOf(block);
  const isFloatOverlay = floatPosEl?.dataset.overlayBlock === 'true';

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          ${iconSvg}`,
      name: block.dataset.layerName,
      defaultName: shapeName,
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: id,
    })}
    </div>

    ${canRedact ? `
    <div class="prop-section">
      <div class="prop-section-title">가림막 (Redact)</div>
      <div class="prop-row">
        <!-- ★prop-label--auto: 「블러로 가리기」는 전역 .prop-label(56px)에 안 들어가 말줄임으로 잘렸다
             (2026-09-20 실측 sw60/cw56, 실물 앱은 더 잘림). 이 줄은 «라벨 하나 + 남는 폭을 쓰는 컨트롤»
             이라 앱 관례인 내용폭 라벨을 쓴다(css/editor-props.css:32, prop-page.js 「그리드 가이드」 선례).
             ⛔전역 .prop-label 의 56px 은 내리지도 올리지도 마라 — 패널 세로 정렬의 출처다. -->
        <span class="prop-label prop-label--auto">블러로 가리기</span>
        <label class="prop-toggle">
          <input type="checkbox" id="shape-redact-toggle" ${isRedact ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div id="shape-redact-controls" style="${isRedact ? '' : 'display:none'}">
        <div class="prop-row" style="margin-top:8px;">
          <span class="prop-label">방식</span>
          <div class="prop-align-group" id="shape-redact-mode-seg">
            <button type="button" class="prop-align-btn${redactMode === 'blur' ? ' active' : ''}" data-mode="blur" aria-pressed="${redactMode === 'blur'}" title="블러 — 밑 콘텐츠를 실시간으로 흐림">블러</button>
            <!-- ⚠️class 속성은 «템플릿 표현식 하나»를 유지한다 — tests/unit/redact-mode-seg-markup.test.js:38 이
                 class="prop-align-btn" + 표현식 하나 형태를 고정한다(정적 클래스를 더하면 그 초록이 깨진다).
                 비활성 표시는 class «밖»(disabled / aria-disabled / title)으로 낸다.
                 ⛔버튼을 «지우지» 않는다 — 현빈 표현이 「모자이크 버튼의 기능은 막아둘 것」이고,
                    같은 테스트 :35 가 data-mode 버튼 2개(blur·mosaic)를 요구한다.
                 ⛔이 주석 안에 달러+중괄호를 쓰지 마라 — 템플릿 리터럴 «안»이라 JS 로 평가된다(2026-09-20 실측: SyntaxError). -->
            <button type="button" class="prop-align-btn${redactMode === 'mosaic' ? ' active' : ''}" data-mode="mosaic" aria-pressed="${redactMode === 'mosaic'}"${mosaicOK ? '' : ' disabled aria-disabled="true"'} title="${mosaicOK ? '모자이크 — 밑 화면을 찍어 픽셀화(이동·편집이 끝날 때 다시 찍음)' : '모자이크는 일시적으로 꺼져 있습니다(블러만 사용) — 캡처가 사진을 못 실어 회색/단색으로 나오는 문제 수정 중'}">모자이크</button>
          </div>
        </div>
        ${legacyMosaic ? `
        <div class="prop-hint" id="shape-redact-legacy-note" style="margin-top:6px;">이 도형은 <b>모자이크</b>로 저장돼 있습니다. 모자이크가 일시 중지돼 지금은 <b>블러로 보여 주는 중</b>이고, 모자이크가 되살아나면 다시 모자이크로 돌아갑니다.</div>
        <button type="button" class="prop-btn" id="shape-redact-to-blur" style="margin-top:6px;width:100%;">블러로 바꾸기 (저장값도 블러로)</button>
        ` : ''}
        <div class="prop-row" style="margin-top:8px;">
          <span class="prop-label">강도</span>
          <input type="range" class="prop-slider" id="shape-redact-blur-slider" min="2" max="20" step="1" value="${redactBlur}">
          <input type="number" class="prop-number" id="shape-redact-blur-num" min="2" max="20" value="${redactBlur}">
        </div>
        ${redactMode === 'mosaic' ? `
        <button type="button" class="prop-btn" id="shape-redact-mosaic-refresh" style="margin-top:8px;width:100%;">${window.isMosaicPending?.(block) ? '캡처 중…' : '지금 스냅샷 새로고침'}</button>
        <div class="prop-hint" style="margin-top:4px;">도형을 얼굴·주민번호 등 위에 올리면 그 순간 밑 콘텐츠를 캡처해 픽셀 모자이크로 가립니다. 실시간 추적이 아니라 도형을 옮기거나(이동/리사이즈 종료) 편집을 마칠 때(mouseup) 자동으로 다시 찍습니다 — 안 맞으면 위 버튼으로 즉시 새로고침하세요. 채우기 색상은 무시됩니다.</div>
        ` : `
        <div class="prop-hint" style="margin-top:4px;">도형을 얼굴·주민번호 등 위에 올리면 밑에 깔린 콘텐츠가 실시간으로 흐려집니다. 채우기 색상은 무시됩니다.</div>
        `}
      </div>
    </div>` : ''}

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-color-row" id="shape-fill-row" style="${isRedact ? 'display:none' : ''}">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'shape-color', hex: color, alpha: colorAlpha, gradientCss })}
      </div>
      <div class="prop-color-row" style="margin-top:${isRedact ? '0' : '8px'};">
        <span class="prop-label">외곽선</span>
        ${colorFieldHTML({ idPrefix: 'shape-stroke-color', hex: strokeColor, alpha: strokeColorAlpha })}
      </div>
      <div class="prop-row" style="margin-top:8px;">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="shape-stroke-slider" min="0" max="20" step="1" value="${strokeWidth}">
        <input type="number" class="prop-number" id="shape-stroke-num" min="0" max="20" value="${strokeWidth}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title prop-ph-header">
        <span>Size</span>
        ${overlayToggleBtnHTML({ id: 'shape-overlay-toggle', active: isFloatOverlay })}
      </div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="range" class="prop-slider" id="shape-w-slider" min="10" max="860" step="1" value="${w}">
        <input type="number" class="prop-number" id="shape-w-num" min="10" max="860" value="${w}">
      </div>
      <div class="prop-row">
        <span class="prop-label">H</span>
        <input type="range" class="prop-slider" id="shape-h-slider" min="10" max="860" step="1" value="${h}">
        <input type="number" class="prop-number" id="shape-h-num" min="10" max="860" value="${h}">
      </div>
      ${shapeType === 'star' ? `<div class="prop-row">
        <span class="prop-label">꼭짓점</span>
        <input type="range" class="prop-slider" id="shape-star-slider" min="${STAR_MIN}" max="${STAR_MAX}" step="1" value="${starN}">
        <input type="number" class="prop-number" id="shape-star-num" min="${STAR_MIN}" max="${STAR_MAX}" value="${starN}">
      </div>
      <!-- ★별 «갯수»(현빈 2026-10-06 「우측패널에 갯수추가하기하면 별 갯수가 여러개 추가되게」).
           ★꼴은 새로 짓지 않았다 — 바로 위 「꼭짓점」·「W/H」·「두께」와 «같은» slider+number 쌍이다.
           ★갯수를 늘리면 블록이 «옆으로» 넓어진다(별 크기 유지 — 현빈 판정). -->
      <div class="prop-row">
        <span class="prop-label">갯수</span>
        <input type="range" class="prop-slider" id="shape-star-count-slider" min="${STAR_COUNT_MIN}" max="${STAR_COUNT_MAX}" step="1" value="${starCount}"${ratingOn ? ' disabled' : ''}>
        <input type="number" class="prop-number" id="shape-star-count-num" min="${STAR_COUNT_MIN}" max="${STAR_COUNT_MAX}" value="${starCount}"${ratingOn ? ' disabled' : ''}>
      </div>
      <!-- 별 «통통함»(현빈 2026-10-07 「별이 너무 뾰족해서 … 살짝 통통한 별로도」).
           꼴은 새로 짓지 않았다 — 위 「꼭짓점」·「갯수」와 같은 slider+number 쌍이다.
           ★미설정 = 옛 별이다(shape-star.js 머리말) ⇒ 초기 표시는 STAR_INNER_DISPLAY 지만
             ★dataset 에는 안 쓴다. 사람이 그 칸을 만진 뒤부터 비로 계산한다. -->
      <div class="prop-row">
        <span class="prop-label">통통함</span>
        <input type="range" class="prop-slider" id="shape-star-inner-slider" min="${STAR_INNER_MIN}" max="${STAR_INNER_MAX}" step="1" value="${starInner ?? STAR_INNER_DISPLAY}">
        <input type="number" class="prop-number" id="shape-star-inner-num" min="${STAR_INNER_MIN}" max="${STAR_INNER_MAX}" value="${starInner ?? STAR_INNER_DISPLAY}">
      </div>
      ${starCount > 1 ? `<!-- 별 «간격»(현빈 2026-10-07 「별 간격 조절되면 좋겠고」).
           ★갯수가 1 이면 이 줄을 안 그린다 — dx=0 이라 ★조용히 아무 일도 안 일어난다
             (「조용히 아무 일 없음」을 만들지 않는다). 갯수를 2 이상으로 올리면 나타난다. -->
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="shape-star-gap-slider" min="${STAR_GAP_MIN}" max="${STAR_GAP_MAX}" step="1" value="${starGap}">
        <input type="number" class="prop-number" id="shape-star-gap-num" min="${STAR_GAP_MIN}" max="${STAR_GAP_MAX}" value="${starGap}">
      </div>` : ''}
      <!-- ★별 «평점»(별점) — 현빈 2026-10-10 1010t1b3 「★별점기능이 들어가야함 ★챗블럭에 ★이미 있는 기능인데
           ★참고 (★별점기능을 하면 ★별이 ★5개로 구성)」 ⇒ ★꼴을 ★챗블럭에서 ★빌렸다(js/props/prop-chat.js
           의 ★chb-prop-stars-row — ★체크박스 ＋ ★0~5 숫자칸 ＋ ★★ 미리보기 ★세 쪼가리 그대로).
           ⛔슬라이더를 ★안 둔다 — ★챗이 ★숫자칸만 쓴다. ★「참고」의 뜻을 ★꼴에서도 지킨다.
           ★★켜면 ★갯수가 ★5 로 ★잠긴다(지디 판정 ⑤) ⇒ ★위 ★갯수 두 칸에 ★disabled 가 붙고
             ★아래 ★까닭 줄이 ★나타난다 — ★★«잠겼다»를 ★겉모습으로 ★말한다(t2cmdl ㉣).
           ★끄면 ★잠금이 ★풀린다(되돌릴 수 있게 · 지디 판정 ⑤). -->
      <div class="prop-row" id="shape-star-rating-row" style="gap:6px;font-size:11px;white-space:nowrap">
        <label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:#aaa;flex-shrink:0" title="별 도형을 평점으로 — 채운 별과 빈 별을 색으로 가른다">
          <input type="checkbox" id="shape-star-rating-toggle" ${ratingOn ? 'checked' : ''}>
          <span>별점</span>
        </label>
        <input type="number" class="prop-number" id="shape-star-rating-num" min="${STAR_RATING_MIN}" max="${STAR_RATING_MAX}" value="${starRating ?? STAR_RATING_MAX}" ${ratingOn ? '' : 'disabled'} style="width:48px">
        <span id="shape-star-rating-preview" style="color:${STAR_FILL_ON};letter-spacing:1px;${ratingOn ? '' : 'opacity:0.3'}">${starRatingPreview(starRating)}</span>
      </div>
      ${ratingOn ? `<div class="prop-hint" id="shape-star-rating-hint" style="margin-top:4px;">별점은 별 ${STAR_RATING_COUNT}개로 구성됩니다 — 갯수는 별점을 끄면 다시 바꿀 수 있습니다.</div>` : ''}
      ${starSel !== null ? `<!-- ★★«이 별» 색 (현빈 2026-10-10 1010t1b2 「★개별 별모양 블럭을 선택하고 ★색 지정」)
           ★★이 줄이 ★★«입구»다 — ★이 줄이 ★생기기 전까지 ★data-star-colors 를 ★쓰는 ★자가 ★0건이었다.
           ★더블클릭으로 ★모드에 들어와 ★별을 고르면 ★나타난다. ★Esc·밖 클릭이면 ★사라진다. -->
      <div class="prop-row" id="shape-star-one-row" style="gap:6px;font-size:11px;white-space:nowrap">
        <span class="prop-label" id="shape-star-one-label">${starSel + 1}번 별</span>
        ${colorFieldHTML({ idPrefix: 'shape-star-one', hex: starSelColors[starSel] || (block.dataset.shapeColor || '#cccccc') })}
      </div>
      <div class="prop-row" style="gap:6px;">
        <button type="button" class="prop-btn" id="shape-star-one-reset">이 별 색 지우기</button>
        <button type="button" class="prop-btn" id="shape-star-one-done">개별 선택 끝내기</button>
      </div>
      <div class="prop-hint" id="shape-star-one-hint" style="margin-top:4px;">${starSel + 1}번 별만 색이 바뀝니다 — 지우면 블록 색을 따릅니다. (Esc 로 끝내기)</div>` : ''}
      ${starCount > 1 ? `<div class="prop-hint" id="shape-star-count-hint" style="margin-top:4px;">별이 여러 개면 이미지 채우기를 쓸 수 없습니다.</div>` : ''}` : ''}
      ${floatPositionRowHTML({ prefix: 'shape', posEl: floatPosEl })}
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="shape-rot-slider" min="-180" max="180" step="1" value="${parseInt(block.dataset.shapeRotation || '0')}">
        <input type="number" class="prop-number" id="shape-rot-num" min="-180" max="180" value="${parseInt(block.dataset.shapeRotation || '0')}">
      </div>
    </div>
    ${window.fxSectionHtml?.(block, 'shape') || ''}`;   /* ★E1 Effects — Rotation 아래(맨 끝 · 지디 승인) */
  window.wireFxSection?.(block, 'shape', () => showShapeProperties(block));

  if (window.setRpIdBadge) window.setRpIdBadge(id || null);

  const svg = block.querySelector('svg');
  // 부모 sub-section (shape frame) — 위 Size 표시와 «같은 객체»를 쓴다(ss 는 크기 읽기와 공용).

  // shape는 section padding을 무시하고 section 전체 폭(최대 860)까지 확장 가능 ───
  // wrap frame의 max-width 제한을 풀고, width가 inner를 넘으면 좌우 균등 음수 margin으로 padding 침범
  function _extendShapeFrameToSection() {
    if (!ss) return;
    const sec = block.closest('.section-block');
    if (!sec) return;
    const inner = sec.querySelector('.section-inner');
    if (!inner) return;
    // max-width / flex shrink 제한 풀기 — 한 번만 적용해도 OK
    if (ss.style.maxWidth !== 'none')   ss.style.maxWidth   = 'none';
    if (ss.style.flexShrink !== '0')    ss.style.flexShrink = '0';
    const innerW = inner.clientWidth;
    const secW = sec.offsetWidth || 860;
    const wrapW = parseFloat(ss.style.width) || parseInt(ss.dataset.width) || ss.offsetWidth || 0;
    if (wrapW > innerW) {
      // wrap이 inner content area를 넘으면 padding 침범 — section 좌/우 끝을 넘지 않게 clamp
      const maxOverflow = (secW - innerW) / 2;
      const half = Math.min((wrapW - innerW) / 2, maxOverflow);
      ss.style.marginLeft  = `-${half}px`;
      ss.style.marginRight = `-${half}px`;
    } else {
      if (ss.style.marginLeft)  ss.style.marginLeft  = '';
      if (ss.style.marginRight) ss.style.marginRight = '';
    }
  }
  _extendShapeFrameToSection();

  // ── 가림막(Redact) ── dataset.shapeColor/shapeGradient는 건드리지 않는다 —
  // 시각효과는 CSS 클래스(.shape-redact)가 fill을 덮어쓰는 방식이라 꺼도 원래 색/그라데이션이
  // 그대로 복원된다(editor-blocks.css 참고).
  // mode: 'blur'(backdrop-filter 실시간) | 'mosaic'(js/effects/redact-mosaic.js 스냅샷 픽셀화)
  function applyRedact(on, blurPx, mode, opts) {
    // ★모자이크 임시 차단 안전망 — 키보드·외부 호출·재진입으로 이 함수에 'mosaic' 이 들어와도
    //   블러로 내린다(위 버튼의 disabled 만으로는 «우회 경로»가 막히지 않는다).
    if (mode === 'mosaic' && !mosaicOK) mode = 'blur';
    // ★★차단 중 «모드를 고르지 않는» 조작(강도 슬라이더·숫자칸)은 저장된 mosaic 을 건드리지 않는다.
    //   (2026-09-20 픽스 라운드, 이벨류에이터 지적 medium) 패널이 mosaic 을 blur 로 «읽기만» 하므로
    //   슬라이더 핸들러가 그 읽은 값을 도로 넘겨 dataset 을 blur 로 «굳혀» 버렸다 — 스위치를 되살려도
    //   그 블록은 이미 blur 라, 이 유닛의 「데이터 보존 = 되돌리기 한 줄」이 평범한 조작 한 번에 깨졌다.
    //   ⇒ 모드를 «실제로 고른» 호출(방식 버튼)만 opts.explicitMode 를 달고 오고, 나머지는 보존한다.
    //   ⛔가림막을 껐다 켜는 건 보존 대상이 아니다 — 끌 때 dataset.shapeRedactMode 자체가 지워진다.
    if (!mosaicOK && on && mode === 'blur' && !opts?.explicitMode
        && block.dataset.shapeRedact === 'true' && block.dataset.shapeRedactMode === 'mosaic') {
      mode = 'mosaic';
    }
    // 모드가 «바뀌는» 순간인지(강도 슬라이더처럼 같은 모드 안의 변경과 구분) — 바뀌면 옛 캡처를
    // 다시 쓰면 안 된다(2026-09-19: 모자이크→블러→이동→모자이크 에서 옛 위치 모자이크가 뜨던 버그).
    const wasMosaic = block.dataset.shapeRedact === 'true' && block.dataset.shapeRedactMode === 'mosaic';
    block.classList.toggle('shape-redact', !!on);
    if (on) {
      block.dataset.shapeRedact = 'true';
      // ★최소 2px — 0(무의미한 흐림)인데 토글만 켜진 채 남는 "가려진 줄 착각" 방지
      //   (적대적 QA 발견, 2026-09-15). 이 함수가 UI 두 컨트롤의 단일 창구다.
      const bp = Math.max(2, Math.min(20, parseInt(blurPx) || 2));
      block.dataset.shapeRedactBlur = String(bp);
      const m = mode === 'mosaic' ? 'mosaic' : 'blur';
      block.dataset.shapeRedactMode = m;
      if (m === 'mosaic' && !mosaicOK) {
        // ★차단 중 보존된 레거시 모자이크 — dataset 은 그대로 두고 «보이는 것»만 블러로 따라간다.
        //   CSS(body.redact-mosaic-off + data-shape-redact-blur)가 이미 저장값을 읽지만,
        //   인라인도 같이 채워 «열어 본 블록/안 열어 본 블록»의 계산값이 한 글자도 안 갈리게 한다.
        //   ⛔캡처는 부르지 않는다(입구에서 어차피 false 지만, 헛도는 호출을 남기지 않는다).
        block.style.setProperty('--redact-blur', `${bp}px`);
      } else if (m === 'blur') {
        block.style.setProperty('--redact-blur', `${bp}px`);
        if (wasMosaic) _invalidateMosaic();
      } else {
        block.style.removeProperty('--redact-blur');
        // 같은 모자이크 안의 강도 변경만 캐시 재사용, 모드 전환·새로 켬은 항상 새로 찍는다.
        _trackMosaicCapture(window.captureMosaicSnapshot?.(block, wasMosaic ? { reuseFullRes: true } : undefined));
      }
    } else {
      delete block.dataset.shapeRedact;
      delete block.dataset.shapeRedactMode;
      block.style.removeProperty('--redact-blur');
      _invalidateMosaic();
    }
    window.scheduleAutoSave?.();
  }
  function _invalidateMosaic() {
    if (window.invalidateMosaic) window.invalidateMosaic(block);
    else {
      delete block.dataset.mosaicCaptured;
      block.querySelector(':scope > canvas.redact-mosaic-canvas')?.remove();
    }
  }
  // 캡처가 도는 동안 새로고침 버튼에 「캡처 중…」 — 상태는 redact-mosaic.js 의 WeakMap(런타임
  // 전용)에서 읽는다. ⛔dataset 에 pending 플래그를 두지 않는다(저장 HTML 누수).
  // ★캡처가 실패하면(결과 false 인데 블록은 여전히 모자이크·미캡처) 조용히 원래 라벨로 돌아가지
  //   않고 「캡처 실패 — 다시 시도」로 알린다(0918 픽스 라운드: 회색만 남고 이유를 알 수 없던 문제).
  //   실패는 안전 쪽(회색 #4a4a4a)이라 원본은 안 보인다 — 그 사실도 title 로 알려준다.
  function _trackMosaicCapture(p) {
    const setLabel = (result) => {
      const btn = document.getElementById('shape-redact-mosaic-refresh');
      if (!btn) return;
      const pending = !!window.isMosaicPending?.(block);
      const failed = !pending && result === false
        && block.dataset.shapeRedactMode === 'mosaic'
        && !window.isMosaicCaptured?.(block);
      btn.textContent = pending ? '캡처 중…' : (failed ? '캡처 실패 — 다시 시도' : '지금 스냅샷 새로고침');
      if (failed) btn.title = '밑 화면을 찍지 못해 회색으로 가려 둔 상태입니다(원본은 안 보임). 눌러서 다시 찍으세요.';
      else btn.removeAttribute('title');
    };
    setLabel(undefined);
    if (p && typeof p.then === 'function') p.then(setLabel, () => setLabel(false));
  }
  // 저장된 프로젝트 로드 등으로 dataset과 클래스가 어긋났을 때 방어적으로 동기화
  if (canRedact) {
    block.classList.toggle('shape-redact', isRedact);
    if (isRedact) {
      if (redactMode === 'blur') block.style.setProperty('--redact-blur', `${redactBlur}px`);
      else if (!window.isMosaicCaptured?.(block)) _trackMosaicCapture(window.captureMosaicSnapshot?.(block, { join: true }));
    }
  }

  const redactToggleEl = document.getElementById('shape-redact-toggle');
  if (redactToggleEl) {
    redactToggleEl.addEventListener('change', () => {
      const on = redactToggleEl.checked;
      applyRedact(on, redactBlur, redactMode);
      const fillRow = document.getElementById('shape-fill-row');
      if (fillRow) fillRow.style.display = on ? 'none' : '';
      const controls = document.getElementById('shape-redact-controls');
      if (controls) controls.style.display = on ? '' : 'none';
      window.pushHistory?.();
    });
  }
  const redactModeSeg = document.getElementById('shape-redact-mode-seg');
  if (redactModeSeg) {
    redactModeSeg.querySelectorAll('.prop-align-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return; // 비활성 버튼(모자이크 임시 차단) — 브라우저가 이미 막지만 명시한다
        const m = btn.dataset.mode;
        /* ★«패널이 그린 값»과 «저장된 값»이 다를 수 있다 (2026-09-21 최종통합 QA, high).
           차단 중(mosaicOK=false) 레거시 mosaic 블록은 패널에선 redactMode='blur' 로 읽힌다(:98).
           그 읽은 값만 보고 early-return 하면 사용자가 「블러」를 «명시적으로» 골라도 호출이
           아예 안 나가고 — :250 의 보존 가드는 explicitMode 가 «올 때만» 비켜서므로 —
           dataset 은 영영 mosaic 으로 남는다. ⇒ ⑴패널이 거짓말을 하고(그림=블러, 데이터=모자이크)
           ⑵T-071 로 스위치를 되살리면 사용자의 선택을 무시하고 조용히 모자이크로 돌아간다.
           ⇒ «화면에 그려진 모드»와 «저장된 모드»가 «둘 다» 같을 때만 할 일이 없다. */
        const storedMode = block.dataset.shapeRedactMode === 'mosaic' ? 'mosaic' : 'blur';
        if (m === redactMode && m === storedMode) return;
        applyRedact(true, redactBlurSliderValue(), m, { explicitMode: true }); // 모드를 «실제로 고른» 호출
        window.pushHistory?.();
        showShapeProperties(block); // 강도 힌트/새로고침 버튼 등 모드별 UI 다시 그림
      });
    });
  }
  function redactBlurSliderValue() {
    const el = document.getElementById('shape-redact-blur-slider');
    return el ? el.value : redactBlur;
  }
  const redactBlurSlider = document.getElementById('shape-redact-blur-slider');
  const redactBlurNum    = document.getElementById('shape-redact-blur-num');
  if (redactBlurSlider && redactBlurNum) {
    redactBlurSlider.addEventListener('input', () => {
      redactBlurNum.value = redactBlurSlider.value;
      applyRedact(true, redactBlurSlider.value, redactMode);
    });
    redactBlurSlider.addEventListener('change', () => window.pushHistory?.());
    redactBlurNum.addEventListener('input', () => {
      // ★최소 2px — 0(사실상 안 가려짐)인데 토글은 "켜짐"으로 남는 걸 막는다
      //   (적대적 QA 발견: 강도 0에서도 토글이 켜져 있어 사용자가 가려졌다고 착각할 위험).
      const v = Math.min(20, Math.max(2, parseInt(redactBlurNum.value) || 2));
      redactBlurSlider.value = v;
      applyRedact(true, v, redactMode);
    });
    redactBlurNum.addEventListener('change', () => window.pushHistory?.());
  }
  // ★레거시 모자이크 → 블러 «전환» 버튼. 방식 seg 의 「블러」와 같은 길(explicitMode)을 쓴다 —
  //   차이는 «보이느냐» 뿐이다(seg 의 블러는 이미 active 라 눌러야 할 이유가 안 보인다).
  const redactToBlurBtn = document.getElementById('shape-redact-to-blur');
  if (redactToBlurBtn) {
    redactToBlurBtn.addEventListener('click', () => {
      applyRedact(true, redactBlurSliderValue(), 'blur', { explicitMode: true });
      window.pushHistory?.();
      showShapeProperties(block); // 고지·버튼이 사라져 패널과 데이터가 같아진다
    });
  }
  const redactMosaicRefreshBtn = document.getElementById('shape-redact-mosaic-refresh');
  if (redactMosaicRefreshBtn) {
    redactMosaicRefreshBtn.addEventListener('click', () => { _trackMosaicCapture(window.captureMosaicSnapshot?.(block)); });
  }

  function applyColor(hex) {
    // perf: 동일 색이면 데이터·DOM 변경 자체를 스킵 → MutationObserver autosave 트리거 회피
    // ★이미지(체커) 모드면 같은 색이라도 빠져나와야 한다(0918 picker: 이미지→솔리드 탭 = 마지막 단색 복귀)
    if (block.dataset.shapeColor === hex && !block.dataset.shapeGradient && !block.dataset.shapeFill) return;
    if (block.dataset.shapeFill) {
      _clearShapeImage(block);
      const inp = document.getElementById('shape-color-color');
      if (inp) delete inp.dataset.cpFill;
    }
    block.dataset.shapeColor = hex;
    if (svg) {
      // 그라데이션이 적용돼 있을 때만 clear 수행 (대부분의 솔리드 드래그에선 no-op이라 skip)
      if (block.dataset.shapeGradient) { _clearShapeGradient(block); window.hideGradientLine?.(block); }
      // svg.style.color 도 값이 같으면 스킵 (실제로 같을 일은 드물지만 안전망)
      if (svg.style.color !== hex) svg.style.color = hex;
    }
    window.scheduleAutoSave?.();
  }

  function applyGradient(detail) {
    if (!svg || !detail) return;
    if (block.dataset.shapeFill) {
      _clearShapeImage(block);
      const inp = document.getElementById('shape-color-color');
      if (inp) delete inp.dataset.cpFill;
    }
    _applyShapeGradient(block, svg, detail);
    block.dataset.shapeColor = detail.css || '';
    block.dataset.shapeGradient = JSON.stringify({
      type: detail.type, angle: detail.angle, stops: detail.stops,
    });
    window.scheduleAutoSave?.();
  }

  function applyStroke(v) {
    block.dataset.shapeStrokeWidth = String(v);
    if (svg) svg.style.strokeWidth = String(v);
    // rectangle/ellipse: inner SVG geometry를 stroke에 맞춰 재계산 (stroke=0이면 풀폭)
    window.refreshShapeInnerSVG?.(block);
    window.scheduleAutoSave?.();
  }

  function applyStrokeColor(c) {
    block.dataset.shapeStrokeColor = c;
    if (svg) svg.style.stroke = c;
    window.scheduleAutoSave?.();
  }

  // 한 축만 넘기고 다른 축은 null 로 둔다 = «안 건드린다». 예전엔 두 축을 늘 같이 써서
  // W 칸만 입력해도 (거짓값이던) H 슬라이더 값 100 이 그대로 프레임에 박혀 H 가 파괴됐다.
  function applySize(newW, newH) {
    // frame(ss)만 리사이즈 — block/svg는 CSS 100%로 자동 추종
    if (ss) {
      if (newW != null) { ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW); }
      // minHeight 도 같이 — addShapeBlock 이 심어 둔 min-height:100px 가 남아 있으면 H 를 100 아래로
      // 내려도 화면은 100 인 채 style/dataset 만 작아져 «패널 값 ≠ 실제 크기»가 다시 생긴다.
      // 꼴은 핸들 리사이즈 선례 그대로(js/overlay-handles.js _onFrameHandleMouseDown onMove).
      if (newH != null) {
        ss.style.height = `${newH}px`; ss.style.minHeight = `${newH}px`; ss.dataset.height = String(newH);
      }
    }
    // 폭이 inner를 넘으면 padding 침범 자동 적용
    _extendShapeFrameToSection();
    // 회전 적용 중이면 frame 잔존 보정만 정리 (크기는 사용자가 지정한 값 그대로 유지)
    const curRot = parseInt(block.dataset.shapeRotation || '0');
    if (curRot !== 0 && typeof _updateFrameForRotation === 'function') {
      _updateFrameForRotation(curRot);
    }
    window.scheduleAutoSave?.();
  }

  // ── 색상 피커 ──
  // 탭 능력 선언 + 재오픈 시드(0918 picker). ★wireColorField 보다 «먼저» — 거기선 비어 있으면 'solid' 로 채운다.
  //   이미지 채우기는 면이 있는 도형만(선·화살표는 fill 이 없어 바둑판을 칠할 면이 없다).
  {
    const inp = document.getElementById('shape-color-color');
    if (inp) {
      /* ★별이 여러 개면 이미지 채우기를 «닫는다»(지디 승인 2026-10-06).
         까닭: 이미지 모드는 .shape-img-fill 에 CSS clip-path 를 «하나» 건다(_syncShapeImageClip).
           그런데 `clip-path: polygon(...) polygon(...)` 은 ★브라우저가 거절한다(실측 2026-10-06:
           computed 가 "none"). `path('… Z … Z')` 는 받지만 ★px 단위라 도형 크기에 따라 안 늘어난다.
         ⛔「조용히 첫 별 하나만 칠한다」가 더 나쁘다 ⇒ 탭을 닫고 ★까닭을 화면에 적는다.
         ★기존 부품을 쓴다 — cpModes/cpModesNote 가 그 일을 하는 자리다(color-picker.js _applyModeGate,
           선례 prop-text-wireup-text-edit.js:283). 새 UI 언어 0. */
      const hasFace = !!SHAPE_FACE_TYPES[shapeType] && !(shapeType === 'star' && starCount > 1);
      inp.dataset.cpModes = hasFace ? 'solid,gradient,image' : 'solid,gradient';
      if (shapeType === 'star' && starCount > 1) inp.dataset.cpModesNote = '별이 여러 개면 이미지 채우기를 쓸 수 없습니다.';
      else delete inp.dataset.cpModesNote;
      // 패널을 다시 그리면 native input 이 새로 만들어져 시드가 사라진다 → 블럭 dataset 에서 다시 채운다
      if (block.dataset.shapeGradient) inp.dataset.cpGradient = block.dataset.shapeGradient;
      if (hasFace && block.dataset.shapeFill === 'image') inp.dataset.cpFill = 'image';
    }
  }
  wireColorField('shape-color', {
    initialAlpha: colorAlpha,
    onApply: (c) => applyColor(c),
    onCommit: () => window.pushHistory?.(),
  });

  // ── 외곽선 색상 피커 ──
  wireColorField('shape-stroke-color', {
    initialAlpha: strokeColorAlpha,
    onApply: (c) => applyStrokeColor(c),
    onCommit: () => window.pushHistory?.(),
  });

  // 초기 svg.stroke 동기화 — 첫 mount 시 dataset.shapeStrokeColor가 있으면 즉시 적용
  if (svg && block.dataset.shapeStrokeColor) {
    svg.style.stroke = block.dataset.shapeStrokeColor;
  }

  // ── 그라데이션 이벤트 수신 (color-picker gradient 탭) ──
  // perf: 매 input마다 pushHistory 발생하던 것을 commit 이벤트로 분리.
  // goya-cp:gradient — 라이브 미리보기(매 프레임), pushHistory 호출 안 함.
  // goya-cp:gradient-commit — 사용자 확정(마우스업·select 변경), pushHistory 호출.
  const shapeColorInput = document.getElementById('shape-color-color');
  if (shapeColorInput && !shapeColorInput._gradWired) {
    shapeColorInput._gradWired = true;
    shapeColorInput.addEventListener('goya-cp:gradient', (e) => {
      applyGradient(e.detail);
      // ★재오픈 시드 — color-picker.js openPicker가 이 dataset을 보고 gradient 탭/스톱을
      //   복원한다(wireColorField의 onGradient 경로는 안 타서 여기서 직접 채워야 한다).
      //   적대적 QA(qa-adversarial-gradient) 발견: 없으면 재오픈마다 solid+기본 2스톱으로 리셋.
      if (e.detail) {
        try {
          shapeColorInput.dataset.cpGradient = JSON.stringify({
            type: e.detail.type, angle: e.detail.angle, stops: e.detail.stops,
          });
        } catch (_) {}
      }
      // ★기록은 여기서 하지 않는다 — commit 이면 바로 뒤에 goya-cp:gradient-commit 이 «또» 온다.
      //   전엔 둘 다 pushHistory 해서 커밋 1번에 기록 2개(되돌리기 1번에 아무 변화 없음) — 0918 picker 에서 제거.
      // 팝업 편집 → 캔버스 핸들 각도 재배치 (banner02/comparison과 동일 패턴)
      if (!_applyingExternalShapeGrad) window.showGradientLine?.(block);
    });
    shapeColorInput.addEventListener('goya-cp:gradient-commit', () => {
      window.pushHistory?.();
    });
    // ── 이미지(에셋) 탭 수신 — 0918 picker ──
    //   src 없음(탭만 누름) = 바둑판(체커) 표시 «이미지 넣기 전» 상태. src 있음(업로드) = 이미지 채우기.
    shapeColorInput.addEventListener('goya-cp:image', (e) => {
      const d = e.detail || {};
      if (!svg || !SHAPE_FACE_TYPES[block.dataset.shapeType || 'rectangle']) return;
      // ★그라데이션을 거쳐 왔으면 shapeColor 에 그라데이션 CSS 가 남는다 → «마지막 단색»으로 되돌려 둔다.
      //   안 그러면 패널 재그리기 때 회색(#cccccc)으로 시드돼 솔리드 복귀가 회색이 되고, 피그마 내보내기엔
      //   color 로 'linear-gradient(...)' 문자열이 실린다(이벨류에이터 0918 지적).
      if (/gradient/.test(block.dataset.shapeColor || '')) {
        let meta = null; try { meta = JSON.parse(block.dataset.shapeGradient || 'null'); } catch (_) {}
        block.dataset.shapeColor = _lastSolidOf(block) || meta?.stops?.[0]?.color || '#cccccc';
      }
      if (block.dataset.shapeGradient) { _clearShapeGradient(block); window.hideGradientLine?.(block); }
      delete shapeColorInput.dataset.cpGradient;
      if (d.src) _applyShapeImage(block, d.src, d.fit);
      else _enterShapeChecker(block);
      shapeColorInput.dataset.cpFill = 'image';
      const sw = shapeColorInput.closest('.prop-color-swatch');
      if (sw) sw.style.background = d.src ? `center / cover no-repeat url("${d.src}")` : _checkerSwatchBg();
      window.scheduleAutoSave?.();
      if (d.commit) window.pushHistory?.();
    });
  }
  // 이미지(체커) 모드 도형은 스와치도 바둑판/사진으로 — 패널을 다시 그려도 «지금 뭐가 칠해졌나»가 보이게
  if (block.dataset.shapeFill === 'image') {
    const sw = document.getElementById('shape-color-color')?.closest('.prop-color-swatch');
    const img = block.querySelector(':scope > .shape-img-fill');
    const src = img ? (img.style.backgroundImage || '') : '';
    if (sw) sw.style.background = src ? `center / cover no-repeat ${src}` : _checkerSwatchBg();
  }

  // 선택 시 채우기가 그라데이션이면 캔버스 위 그라데이션 라인 표시 (아니면 overlay가 no-op)
  window.showGradientLine?.(block);
  // 0918 canvasgrad: 캔버스 바 ↔ 피커 스탑 양방향 배선 + 재오픈 시드(dataset.cpGradient)
  window.bindGradientLinePicker?.(block, shapeColorInput);

  // ── 스트로크 두께 ──
  const strokeSlider = document.getElementById('shape-stroke-slider');
  const strokeNum    = document.getElementById('shape-stroke-num');
  strokeSlider.addEventListener('input',  () => { strokeNum.value = strokeSlider.value; applyStroke(parseInt(strokeSlider.value)); });
  strokeSlider.addEventListener('change', () => window.pushHistory?.());
  strokeNum.addEventListener('input', () => {
    const v = Math.min(20, Math.max(0, parseInt(strokeNum.value) || 0));
    strokeSlider.value = v; applyStroke(v);
  });
  strokeNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 W ──
  const wSlider = document.getElementById('shape-w-slider');
  const wNum    = document.getElementById('shape-w-num');
  wSlider.addEventListener('input',  () => { wNum.value = wSlider.value; applySize(parseInt(wSlider.value), null); });
  wSlider.addEventListener('change', () => window.pushHistory?.());
  wNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(wNum.value) || 10));
    wSlider.value = v; wNum.value = v; applySize(v, null);
  });
  wNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 H ──
  const hSlider = document.getElementById('shape-h-slider');
  const hNum    = document.getElementById('shape-h-num');
  hSlider.addEventListener('input',  () => { hNum.value = hSlider.value; applySize(null, parseInt(hSlider.value)); });
  hSlider.addEventListener('change', () => window.pushHistory?.());
  hNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(hNum.value) || 10));
    hSlider.value = v; hNum.value = v; applySize(null, v);
  });
  hNum.addEventListener('change', () => window.pushHistory?.());

  /* ── 별 꼭짓점 수(B2) ＋ 별 갯수(현빈 2026-10-06) ──
   * ★두 값을 ★한 함수(_applyStarGeom)로 쓴다 — 명부를 둘로 만들지 않는다. 꼭짓점만 바꿔도 갯수를
   *   «지금 값»에서 읽어 같이 쓰므로, 둘이 어긋난 SVG(폴리곤 3개인데 viewBox 는 1개분 같은 꼴)가 안 생긴다.
   * ★값이 «다를 때만» DOM 에 쓴다 — 같은 값을 다시 쓰면 복원 뒤 직렬화가 갈려 ⌘Z 깊이가 깎인다(B2 규율). */
  const starSlider = document.getElementById('shape-star-slider');
  const starNum    = document.getElementById('shape-star-num');
  const starCSlider = document.getElementById('shape-star-count-slider');
  const starCNum    = document.getElementById('shape-star-count-num');

  /** ★지금 dataset 에서 ★«네 값»(꼭짓점·갯수·간격·통통함)을 ★스스로 읽어 SVG 기하를 맞춘다. 멱등.
   *  ★★2026-10-07 — 간격·통통함이 늘었을 때 ★서명을 ★안 늘렸다. ★까닭 둘:
   *    ⑴ ★호출부가 ★dataset 을 ★먼저 쓰고 ★그 다음 부른다 ⇒ ★인자로 받던 값과 ★같다
   *    ⑵ ★★서명을 늘리면 ★그걸 ★닻으로 쓰는 검사가 ★조용히 눈이 먼다 — ★오늘 실제로 났다
   *       (`variant-ship-leak` 의 `sliceBlock('const statRow = (key, label, list) =>')`)
   *       ⇒ ★★`shape-star` 쪽 닻은 ★0건으로 확인했지만, ★늘리지 ★않는 쪽이 ★더 안전하다
   *  ★인자 둘은 ★호환으로 ★남겼다(옛 호출부가 그대로 돈다) — ⛔쓰지 않는다. dataset 이 ★정본이다. */
  const _applyStarGeom = () => {
    const svg = block.querySelector('svg');
    if (!svg) return;
    const n     = clampStarN(block.dataset.starPoints);
    const count = clampStarCount(block.dataset.starCount);
    const gap   = clampStarGap(block.dataset.starGap);
    const inner = clampStarInner(block.dataset.starInner);
    /* ★★`starColors`·`starScales` 를 ★읽는 자는 ★★이 함수 ★하나다(지디 ⑧ 의 ★조건).
       ⇒ ★읽는 자가 ★둘이 되면 ★그때 ★명부가 ★참으로 ★둘이 된다. ⛔다른 곳에서 ★읽지 ★마라. */
    const list = starPointsList(n, count, gap, inner, block.dataset.starScales);
    const vb = starViewBox(count, gap);
    if (svg.getAttribute('viewBox') !== vb) svg.setAttribute('viewBox', vb);
    const polys = [...svg.querySelectorAll('polygon')];
    /* ★★«이 칠은 ★내가 한 것인가»를 가리는 ★명부 — ⛔무조건 ★떼면 ★그라데이션 `url(#…)` 이 ★죽는다
       (그 까닭은 ★`_restoreShapeGradientFill` 머리말에 ★한 벌로 적혀 있다).
       ★든 것 = ★평점 두 색 ＋ ★사람이 ★어느 별에든 ★직접 준 색 ★전부.
       ★★«어느 별에든»인 까닭 = ★복제가 ★첫 별의 색을 ★다른 index 로 ★옮겨 놓기 때문이다(⒜ 함정).
         ⇒ ★index 별로만 보면 ★번진 색을 ★«내 것»으로 ★못 알아본다. */
    const _mineFills = new Set([STAR_FILL_ON, STAR_FILL_OFF]);
    (starColorList(block.dataset.starColors, count) || []).forEach(v => { if (v) _mineFills.add(v); });
    /* 갯수가 줄면 남는 polygon 을 지우고, 늘면 첫 polygon 을 ★복제해서 더한다
       (fill·stroke 는 svg 의 style 상속 ＋ 그라데이션 url(#…) 이 polygon 속성에 있을 수 있어
        ⛔createElementNS 로 새로 만들지 않는다 — 그러면 그라데이션이 걸린 별만 색이 샌다). */
    while (polys.length > list.length) polys.pop().remove();
    while (polys.length < list.length) {
      const seed = polys[0];
      if (!seed) break;
      const cl = seed.cloneNode(false);
      /* ★★★⒜ 함정(1010t1b2) — ★복제는 ★첫 별의 ★칠을 ★물고 온다 ⇒ ★개별 색이 ★새 별로 ★번진다.
         ★칠은 ★아래 fills 루프가 ★제 index 로 ★다시 정하므로 ★여기서는 ★«내 칠»만 ★떼어 둔다.
         ⛔무조건 떼면 ★그라데이션 `url(#…)` 이 ★떨어진다 — ★그게 ★이 복제를 ★쓰는 ★본래 까닭이다
           (위 cloneNode 주석) ⇒ ★★`_mineFills` 에 든 것만 ★뗀다. */
      if (_mineFills.has(cl.getAttribute('fill'))) cl.removeAttribute('fill');
      seed.parentNode.appendChild(cl);
      polys.push(cl);
    }
    /* ★평점(1010t1b3) — ★별마다 ★fill 을 준다. ★미설정이면 ★null = ★«칠하지 않는다».
       ★fill 을 ★속성으로 쓰는 것은 ★이 파일의 선례다(위 cloneNode 주석의 그 까닭 — 그라데이션이 polygon 속성에 산다).
       ⛔★그래서 ★끌 때 ★`removeAttribute('fill')` 를 ★무조건 ★부르면 ★★그라데이션 별의 ★칠을 ★죽인다.
         ⇒ ★★«내가 칠한 두 색일 때만» 뗀다. ★실측 근거 = 그 cloneNode 주석이 ★url(#…) 을 ★이름으로 적어 뒀다. */
    /* ★★칠의 임자는 ★`starFillsFor` ★하나다(1010t1b2) — ★평점 ＋ ★개별 색을 ★거기서 ★합친다.
       ⛔여기서 ★둘을 ★섞지 마라 — ★각자 쓰면 ★«누가 마지막에 썼나»가 ★칠을 정한다(순서 의존).
       ★null 칸 = ★«fill 속성을 ★쓰지 ★말라» = ★블록 색·그라데이션을 ★물려받는다. */
    const fills = starFillsFor({
      rating: block.dataset.starRating, colors: block.dataset.starColors, count,
    });
    polys.forEach((poly, i) => {
      if (poly.getAttribute('points') !== list[i]) poly.setAttribute('points', list[i]);
      const want = fills ? fills[i] : null;
      const cur = poly.getAttribute('fill');
      if (want) {
        if (cur !== want) poly.setAttribute('fill', want);
      } else if (cur !== null && _mineFills.has(cur)) {
        poly.removeAttribute('fill');
      }
    });
  };

  if (starSlider && starNum) {
    const applyStar = (raw) => {
      const n = clampStarN(raw);
      starSlider.value = n; starNum.value = n;
      if (block.dataset.starPoints !== String(n)) block.dataset.starPoints = String(n);
      _applyStarGeom();   // ★dataset 이 정본 — 위에서 이미 썼다
      _syncShapeImageClip(block);
      window.scheduleAutoSave?.();
    };
    starSlider.addEventListener('input',  () => applyStar(starSlider.value));
    starSlider.addEventListener('change', () => window.pushHistory?.());
    starNum.addEventListener('input',  () => { if (starNum.value !== '') applyStar(starNum.value); });
    starNum.addEventListener('change', () => { applyStar(starNum.value); window.pushHistory?.(); });
  }

  /* ══ ★«별 하나의 비»를 지키는 ★폭 — ★★갯수와 ★간격이 ★쓰는 ★단 ★하나의 자 (1010t1b1 · 지디 ②③) ══
   * ★★«W/vbW 를 붙든다»는 ★식 자체는 ★`starFrameWidthFor`(shape-star.js) 에 있다 — ★여기는 ★클램프만.
   * ★클램프 수(10·860)는 ★★W 슬라이더와 ★같은 수다 — ⛔딴 수를 쓰면 ★패널과 ★어긋난다.
   * ★★상한에 닿으면 ★거기서 ★멈춘다(= 별이 작아진다) — ★갯수와 ★간격이 ★★같게 멈춘다(지디 판정 ③).
   *   ⛔한쪽만 다르게 ★분기하지 마라. ★그 분기가 ★곧 ★b1 의 ★흠이었다.
   * ★★★prev 는 ★«지금 dataset»에서 읽는다 ⇒ ★★부르는 쪽은 ★dataset 을 ★쓰기 ★«전»에 ★이 함수를 불러야 한다. */
  const _starWantW = (nextCount, nextGap) => {
    const curW = _shapeFrameSize(ss || block, 'w');
    const raw = starFrameWidthFor(curW,
      block.dataset.starCount, block.dataset.starGap, nextCount, nextGap);
    if (raw === null) return null;
    return { curW, wantW: Math.max(10, Math.min(860, Math.round(raw))) };
  };

  /* ★★밖으로 뺐다(1010t1b3) — ★평점을 켜면 ★갯수를 ★5 로 맞춰야 하고, ★그 «갯수→폭» 규칙의
     ★임자는 ★이 함수 ★하나여야 한다. ⛔평점 쪽에 ★폭 계산을 ★다시 쓰면 ★명부가 ★둘이 된다. */
  let applyStarCount = null;
  if (starCSlider && starCNum) {
    applyStarCount = (raw) => {
      const prev = clampStarCount(block.dataset.starCount);
      const c = clampStarCount(raw);
      starCSlider.value = c; starCNum.value = c;
      if (c === prev) return;
      /* ★갯수를 늘리면 블록이 «옆으로» 넓어진다 — 별 크기 유지(현빈 판정 2026-10-06).
         ⛔W 를 그대로 두면 viewBox 만 N배라 preserveAspectRatio="none" 때문에 별이 1/N 로 납작해진다.
         ★폭은 «읽는 곳과 쓰는 곳이 같은 객체»(래퍼 frame)로 간다 — applySize 가 그 자리다.
         ★W 상한 860 에 닿으면 거기서 멈춘다(= 별이 작아진다). 슬라이더 상한과 같은 수를 쓴다. */
      /* ★★공용 자를 쓴다(1010t1b1) — ★옛 식은 ★`curW * c / prev` 였고 ★★gap 을 ★안 셌다.
         ★실측 오차(gap 15): prev 1→5 ★−5.66%. ★gap 0 에서는 ★항등이라 ★안 잡혔다. */
      const _w = _starWantW(c, block.dataset.starGap);   // ⚠️dataset 쓰기 «전»에 — prev 를 거기서 읽는다
      if (block.dataset.starCount !== String(c)) block.dataset.starCount = String(c);
      _applyStarGeom();   // ★dataset 이 정본 — 위에서 이미 썼다
      if (_w && _w.wantW !== _w.curW) applySize(_w.wantW, null);
      /* 이미지 채우기는 갯수>1 에서 못 쓴다(위 cpModes 주석) — 이미 걸려 있으면 «여기서» 푼다.
         ⛔그냥 두면 사진이 첫 별 모양으로만 잘린 채 나머지 별이 투명해진다(조용한 반쪽 동작). */
      if (c > 1 && block.dataset.shapeFill === 'image') {
        _clearShapeImage(block);
        const svg2 = block.querySelector('svg.shape-svg') || block.querySelector('svg');
        if (svg2 && svg2.style.fill === 'transparent') svg2.style.fill = 'currentColor';
        window.showToast?.('별이 여러 개면 이미지 채우기를 쓸 수 없습니다 — 색 채우기로 되돌렸어요');
      }
      _syncShapeImageClip(block);
      window.scheduleAutoSave?.();
      showShapeProperties(block);   // 갯수에 따라 안내문구·이미지 탭 가능 여부가 바뀐다 → 패널 다시
    };
    starCSlider.addEventListener('input',  () => applyStarCount(starCSlider.value));
    starCSlider.addEventListener('change', () => window.pushHistory?.());
    starCNum.addEventListener('input',  () => { if (starCNum.value !== '') applyStarCount(starCNum.value); });
    starCNum.addEventListener('change', () => { applyStarCount(starCNum.value); window.pushHistory?.(); });
  }

  /* ── 별 «통통함»(현빈 2026-10-07) ＋ 별 «간격»(현빈 2026-10-07) ──
   * ★꼴을 새로 짓지 않았다 — 위 꼭짓점·갯수와 ★같은 배선이다.
   * ★★통통함은 ★«미설정 = 옛 별»이라 ★사람이 만지는 ★순간 dataset 에 ★처음 쓰인다
   *   ⇒ ★그 전에는 ★dataset 에 ★키가 ★없다 ⇒ ★저장본도 ★옛 바이트 그대로다. */
  const starInSlider = document.getElementById('shape-star-inner-slider');
  const starInNum    = document.getElementById('shape-star-inner-num');
  if (starInSlider && starInNum) {
    const applyStarInner = (raw) => {
      const v = clampStarInner(raw);
      if (v === null) return;                       // 빈 칸은 「지우는 중」 — 아무것도 안 한다
      starInSlider.value = v; starInNum.value = v;
      if (block.dataset.starInner !== String(v)) block.dataset.starInner = String(v);
      _applyStarGeom();
      _syncShapeImageClip(block);                   // 이미지 채우기 clip 도 같은 비를 탄다
      window.scheduleAutoSave?.();
    };
    starInSlider.addEventListener('input',  () => applyStarInner(starInSlider.value));
    starInSlider.addEventListener('change', () => window.pushHistory?.());
    starInNum.addEventListener('input',  () => { if (starInNum.value !== '') applyStarInner(starInNum.value); });
    starInNum.addEventListener('change', () => { applyStarInner(starInNum.value); window.pushHistory?.(); });
  }

  const starGSlider = document.getElementById('shape-star-gap-slider');
  const starGNum    = document.getElementById('shape-star-gap-num');
  if (starGSlider && starGNum) {
    const applyStarGap = (raw) => {
      const g = clampStarGap(raw);
      const prevG = clampStarGap(block.dataset.starGap);
      starGSlider.value = g; starGNum.value = g;
      if (g === prevG) return;
      /* ★★★b1 (현빈 2026-10-10) — ★간격도 ★폭을 ★키운다.
         ★고치기 전: ★여기가 ★폭을 ★안 건드려 ★viewBox 만 넓어졌다 ⇒ ★`preserveAspectRatio="none"`
           때문에 ★별이 ★가로로만 ★납작해졌다. ★실측(W 500 · count 5): ★gap 15 에서 비 ★0.9423,
           ★gap 200 에서 ★0.5549 (★44.5% 납작) — ★세로는 ★불변이었다.
         ⇒ ★갯수와 ★★같은 자(`_starWantW`)를 쓴다. ⛔여기 ★제 식을 ★두면 ★명부가 ★둘이 된다. */
      const _w = _starWantW(block.dataset.starCount, g);   // ⚠️dataset 쓰기 «전»에
      /* ★0 이면 키를 ★지운다 — 옛 저장본과 ★바이트 동일하게(간격을 안 쓴 문서는 그대로). */
      if (g === 0) { if (block.dataset.starGap !== undefined) delete block.dataset.starGap; }
      else if (block.dataset.starGap !== String(g)) block.dataset.starGap = String(g);
      _applyStarGeom();
      if (_w && _w.wantW !== _w.curW) applySize(_w.wantW, null);
      window.scheduleAutoSave?.();
    };
    starGSlider.addEventListener('input',  () => applyStarGap(starGSlider.value));
    starGSlider.addEventListener('change', () => window.pushHistory?.());
    starGNum.addEventListener('input',  () => { if (starGNum.value !== '') applyStarGap(starGNum.value); });
    starGNum.addEventListener('change', () => { applyStarGap(starGNum.value); window.pushHistory?.(); });
  }

  /* ── 별 «평점»(별점 · 현빈 2026-10-10 · 1010t1b3) ──
   * ★꼴은 ★챗블럭 배선과 ★같다 — ★토글은 change, ★숫자칸은 input＋change(prop-chat.js 의 그 두 쌍).
   * ★★켜면 ★갯수를 ★5 로 맞춘다 — ⛔폭 계산을 ★여기 ★다시 쓰지 ★않고 ★applyStarCount 를 ★부른다.
   *   ⇒ ★«갯수→폭» 규칙의 ★임자가 ★하나다(지디 판정 ③ 의 그 뜻).
   * ★★끄면 ★키를 ★지운다 — ★옛 저장본과 ★바이트 동일(starGap 0 의 그 규율과 ★같다). */
  const starRatToggle = document.getElementById('shape-star-rating-toggle');
  const starRatNum    = document.getElementById('shape-star-rating-num');
  if (starRatToggle && starRatNum) {
    const applyStarRating = (raw) => {
      const r = clampStarRating(raw);
      if (r === null) return;                        // 빈 칸은 「지우는 중」 — 아무것도 안 한다
      if (block.dataset.starRating !== String(r)) block.dataset.starRating = String(r);
      _applyStarGeom();
      const pv = document.getElementById('shape-star-rating-preview');
      if (pv) pv.textContent = starRatingPreview(r);
      window.scheduleAutoSave?.();
    };
    starRatToggle.addEventListener('change', () => {
      if (starRatToggle.checked) {
        const r = clampStarRating(starRatNum.value) ?? STAR_RATING_MAX;
        block.dataset.starRating = String(r);
        /* ★「별점기능을 하면 ★별이 ★5개로 구성」 — ★갯수를 ★5 로. ★폭은 ★그 함수가 쥔다.
           ★이미 5 면 ★그 함수가 ★제 머리에서 ★되돌아 나가므로(c === prev) ★기하만 ★직접 맞춘다. */
        if (clampStarCount(block.dataset.starCount) !== STAR_RATING_COUNT) applyStarCount?.(STAR_RATING_COUNT);
        else _applyStarGeom();
      } else {
        delete block.dataset.starRating;
        _applyStarGeom();                            // ★칠을 되돌린다 — ★내가 칠한 두 색만
        /* ★★그라데이션이 걸려 있던 별이면 ★그 참조도 ★되돌린다 — ★★별은 아무도 다시 칠해 주지 않는다
           (위 `_restoreShapeGradientFill` 머리말: SHAPE_DEFS.star 에 ★dynamic 이 없다)
           ⇒ ★★이 한 줄이 ★«평점이 그라데이션을 덮는다»를 ★★비가역에서 ★가역으로 ★바꾼다. */
        _restoreShapeGradientFill(block);
      }
      window.pushHistory?.('별점 토글');
      window.scheduleAutoSave?.();
      showShapeProperties(block);                    // ★갯수 잠금·까닭 줄이 바뀐다 → 패널 다시
    });
    starRatNum.addEventListener('input',  () => { if (starRatNum.value !== '') applyStarRating(starRatNum.value); });
    starRatNum.addEventListener('change', () => { applyStarRating(starRatNum.value); window.pushHistory?.('별점'); });
  }

  /* ── ★★«이 별» 색 — ★★1010t1b2 의 ★«입구» (현빈 「개별 별모양 블럭을 선택하고 ★색 지정」) ──
   * ★★여기 ★배선한 까닭 = ★`_applyStarGeom` 이 ★이 닫힘(closure) 안에 있다.
   *   ⛔모듈 밖(`star-select.js`)에서 ★색을 쓰면 ★★다시 그릴 자가 ★없다 — ★그 함수가 ★유일한 ★그리개다
   *   ★실측 근거: ★`_applyStarGeom()` 호출 ★7곳이 ★★전부 ★이 파일의 ★손잡이 ★안이다(★D7 이 ★그래서 ★두 번 빨갰다)
   * ★★쓰는 꼴 = ★`starColorList` 로 ★읽고 ★그 index 만 갈고 ★`starColorsAttr` 로 ★되돌려 쓴다
   *   ⇒ ★전부 비면 ★★키를 ★지운다(★옛 바이트 보존 — ★`starGap` 0 의 그 규율) */
  const starOneSel = (starModeBlock() === block) ? starSelectedIndex(block) : null;
  if (starOneSel !== null && document.getElementById('shape-star-one-color')) {
    const writeOne = (hex) => {
      const count = clampStarCount(block.dataset.starCount);
      const list = (starColorList(block.dataset.starColors, count) || new Array(count).fill(null)).slice(0, count);
      while (list.length < count) list.push(null);
      list[starOneSel] = hex || null;
      const attr = starColorsAttr(list);
      if (attr === null) { if (block.dataset.starColors !== undefined) delete block.dataset.starColors; }
      else if (block.dataset.starColors !== attr) block.dataset.starColors = attr;
      _applyStarGeom();                 // ★이 파일의 ★그리개 — ★유일하다
      window.scheduleAutoSave?.();
    };
    wireColorField('shape-star-one', {
      onApply:  (hex) => writeOne(hex),
      onCommit: () => window.pushHistory?.('별 하나 색'),
    });
    document.getElementById('shape-star-one-reset')?.addEventListener('click', () => {
      writeOne(null);
      window.pushHistory?.('별 하나 색 지우기');
      showShapeProperties(block);       // 스와치가 블록 색으로 돌아가야 한다
    });
    document.getElementById('shape-star-one-done')?.addEventListener('click', () => {
      exitStarMode();                   // ★그 함수가 ★패널을 ★다시 그린다
    });
  }

  // ── 회전 ──
  // 사용자 의도: 회전해도 frame 자체 크기는 변하지 않아야 함.
  // 시각적 잘림은 부모 frame이 overflow:visible 되도록 CSS에서 처리 (회전된 shape를 가진 frame).
  // 이전 시도(boundedW/H minWidth/minHeight 보정)는 사용자가 "크기가 커진다"고 느끼게 했으므로 폐기.
  // 이 함수는 잔존 inline 보정값을 깨끗이 해제하는 용도로만 남긴다 (구버전 데이터 호환).
  function _updateFrameForRotation(_deg) {
    const frame = block.closest('.frame-block');
    if (!frame) return;
    // 이전 버전이 남긴 보정값 정리
    if (frame.style.minHeight) frame.style.removeProperty('min-height');
    if (frame.style.minWidth)  frame.style.removeProperty('min-width');
    _relockFrameMinHeight(frame);
  }
  // 회전 적용은 공유 함수(applyShapeRotation)로 위임 — 프로퍼티 슬라이더와
  // 코너 회전 핸들(asset-rotate.js)이 동일한 경로를 쓰도록 통일한다.
  function applyRotation(deg) {
    applyShapeRotation(block, deg);
    _updateFrameForRotation(parseInt(block.dataset.shapeRotation || '0'));
  }
  const rotSlider = document.getElementById('shape-rot-slider');
  const rotNum    = document.getElementById('shape-rot-num');
  if (rotSlider && rotNum) {
    rotSlider.addEventListener('input',  () => { rotNum.value = rotSlider.value; applyRotation(rotSlider.value); });
    rotSlider.addEventListener('change', () => window.pushHistory?.());
    rotNum.addEventListener('input', () => {
      const v = Math.min(180, Math.max(-180, parseInt(rotNum.value) || 0));
      rotSlider.value = v; applyRotation(v);
    });
    rotNum.addEventListener('change', () => window.pushHistory?.());
  }

  /* 오버레이(플로팅) 토글 — 텍스트 패널과 «같은 함수»를 부른다(js/overlay-float.js).
     ⛔여기서 enter/exit 을 다시 짜지 마라: 그 코드는 11개의 후속 P0 수정을 받은 자리다. */
  wireFloatToggle({
    block,
    buttonId: 'shape-overlay-toggle',
    rerender: () => showShapeProperties(block),
  });
  /* 떠 있을 때만 나오는 X/Y 두 칸 — 텍스트 Position 절과 «같은 규약»(overlay-float.js). */
  wireFloatPosition({ block, xId: 'shape-x-number', yId: 'shape-y-number' });
}

window.showShapeProperties = showShapeProperties;

/* ★청소한 뒤 «자기 높이»로 다시 잠근다 (2026-09-21 최종통합 QA medium ③ 후속)
 *   위 두 자리는 구버전이 남긴 «부푼» min-width/height 보정값을 걷어내는 자리다(회전해도 크기 불변).
 *   그런데 «청소»와 «바닥 해제»가 한 동작이었다 — 걷어내면 CSS 바닥이 되살아난다:
 *       css/editor-blocks.css `.frame-block { min-height: 60px }`
 *   ⇒ 손잡이·패널로 60 아래로 내려 둔 도형을 돌리면 style.height 는 40 인데 화면은 60 이 된다.
 *   실측(실앱 9504 · 격리 프로필 · 줌 40%): 40 으로 줄인 사각형을 10° 돌리니 offsetHeight 60
 *   (패널 H 칸은 40 — 20px 거짓). 회전된 채로는 패널에 30 을 넣어도 화면이 60 에 바닥쳤다(30px 거짓).
 *   그래서 걷어낸 «다음» 자기 높이로 다시 잠근다 — 부푼 값은 안 살아나고(청소 의도 유지),
 *   바닥도 안 되살아난다(패널 값 = 실제 크기). 높이를 «안 적은» 프레임(자동 높이)은 건드리지 않는다.
 *   같은 «세트 규약»의 다른 자리 — js/block-drag.js _onShapeHandleMouseDown ·
 *   js/overlay-handles.js _onFrameHandleMouseDown · 이 파일의 applySize.
 *   회귀: tests/dom/shape-rotate-minheight.dom.spec.js */
function _relockFrameMinHeight(frame) {
  if (!frame || !frame.style.height) return;
  frame.style.minHeight = frame.style.height;
}

/* ── 공유 회전 적용/동기화 ──
 * 프로퍼티 패널 슬라이더와 코너 회전 핸들(asset-rotate.js의 shape-rotate-zone)이
 * 같은 상태(dataset.shapeRotation + transform:rotate)를 쓰도록 단일 진입점으로 통일.
 * transform 문자열에서 rotate()만 치환 → translate/scale 등 다른 transform 보존.
 */
export function applyShapeRotation(block, deg) {
  if (!block) return;
  const d = Math.max(-180, Math.min(180, parseInt(deg) || 0));
  const existing = block.style.transform || '';
  const stripped = existing.replace(/rotate\([^)]*\)\s*/g, '').trim();
  if (d === 0) {
    // 회전 해제: transform/transform-origin/dataset 잔존을 깨끗이 정리
    block.style.transform = stripped;
    if (!block.style.transform) {
      block.style.removeProperty('transform');
      block.style.removeProperty('transform-origin');
    }
    delete block.dataset.shapeRotation;
  } else {
    block.dataset.shapeRotation = String(d);
    block.style.transform = stripped ? `${stripped} rotate(${d}deg)` : `rotate(${d}deg)`;
    block.style.transformOrigin = 'center center';
  }
  // 구버전이 남긴 frame min-width/height 보정값 정리 (회전 시 크기 불변 정책)
  const frame = block.closest('.frame-block');
  if (frame) {
    if (frame.style.minHeight) frame.style.removeProperty('min-height');
    if (frame.style.minWidth)  frame.style.removeProperty('min-width');
    _relockFrameMinHeight(frame);
  }
  window.scheduleAutoSave?.();
}
window.applyShapeRotation = applyShapeRotation;

// 핸들 회전 → 프로퍼티 패널 슬라이더/숫자 입력 동기화 (패널은 선택된 shape만 표시)
export function syncShapeRotationUI(deg) {
  const d = Math.max(-180, Math.min(180, Math.round(parseFloat(deg) || 0)));
  const slider = document.getElementById('shape-rot-slider');
  const num    = document.getElementById('shape-rot-num');
  if (slider) slider.value = String(d);
  if (num)    num.value    = String(d);
}
window.syncShapeRotationUI = syncShapeRotationUI;

/* ── SVG 그라데이션 적용 헬퍼 ──
 * shape SVG 내부에 <defs><linearGradient|radialGradient> 를 동적 inject 하고
 * fill 을 url(#id) 로 바꾼다. stroke 는 currentColor 유지.
 * id 는 block.id 기반으로 안정적으로 부여 — outerHTML 직렬화 후 재로드해도 충돌 없음.
 */
function _gradIdFor(block) {
  const base = block.id || 'shp_anon';
  return `grad-${base}`;
}

function _clearShapeGradient(block) {
  if (!block) return;
  const svg = block.querySelector('svg');
  if (!svg) return;
  const id = _gradIdFor(block);
  const def = svg.querySelector(`#${CSS.escape(id)}`);
  if (def) {
    const parentDefs = def.closest('defs');
    def.remove();
    if (parentDefs && !parentDefs.children.length) parentDefs.remove();
  }
  // fill="url(#..)" 인 요소들을 currentColor 로 복귀
  svg.querySelectorAll('[fill^="url(#grad-"]').forEach(el => {
    el.setAttribute('fill', 'currentColor');
  });
  delete block.dataset.shapeGradient;
}

/* ★★그라데이션 ★참조를 ★되돌린다 (1010t1b3 · 지디 요청으로 ★재고 ★고친 자리)
 * ★★왜 필요한가 — ★★별은 ★`refreshShapeInnerSVG`(block-factory.js)가 ★★안 지나간다:
 *   ★그 함수 머리가 ★`if (!def || !def.dynamic) return;` 이고 ★★`SHAPE_DEFS.star` 에 ★`dynamic` 이 ★없다
 *   (★실측: dynamic 은 ★rectangle·ellipse ★둘뿐이다) ⇒ ★★rect/ellipse 는 ★⌘Z·페이지전환에서 ★그라데이션
 *   fill 을 ★다시 칠해 주는데 ★★별은 ★★아무도 ★다시 칠해 주지 않는다.
 * ⇒ ★평점이 ★polygon 의 ★fill 을 ★덮었다가 ★물러나면 ★★별만 ★`currentColor` 로 ★주저앉는다.
 *   ★★`dataset.shapeGradient` 와 ★`<defs>` 는 ★살아 있으니 ★★데이터 손실은 ★아니지만
 *   ★★«스스로 돌아오지는 않는다» ⇒ ★★사용자 눈에는 ★사라진 것이다.
 * ⇒ ★★그래서 ★평점을 ★끌 때 ★여기서 ★되돌린다 — ★★비가역을 ★«없앤다».
 * ★id·선택자를 ★다시 쓰지 ★않았다: ★`_gradIdFor` ＋ ★`FILLABLE_SEL` ★그대로 쓴다(명부 안 늘린다). */
function _restoreShapeGradientFill(block) {
  if (!block || !block.dataset.shapeGradient) return false;
  const svg = block.querySelector('svg.shape-svg') || block.querySelector('svg');
  if (!svg) return false;
  const id = _gradIdFor(block);
  /* ★def 가 ★없으면 ★칠하지 않는다 — ⛔없는 id 를 가리키면 ★도형이 ★★투명해진다(조용한 더 큰 손실) */
  if (!svg.querySelector(`#${CSS.escape(id)}`)) return false;
  let n = 0;
  svg.querySelectorAll(FILLABLE_SEL).forEach(el => {
    if (el.getAttribute('fill') === 'none') return;   // 테두리 전용은 건드리지 않는다
    el.setAttribute('fill', `url(#${id})`);
    n++;
  });
  return n > 0;
}
window._restoreShapeGradientFill = _restoreShapeGradientFill;

// perf: 그라데이션 라이브 업데이트는 매 프레임 일어남. 기존 코드는 매번
// <linearGradient> 노드를 통째로 제거→재생성하고 모든 fillable에 setAttribute 호출.
// 같은 타입(linear/radial) + 같은 stop 개수가 유지될 때는 stop 요소만 재활용해서
// stop-color/offset 만 갱신하고, fill="url(#...)" 적용은 처음 한 번만 수행.
const SVG_NS = 'http://www.w3.org/2000/svg';
const FILLABLE_SEL = 'rect,ellipse,circle,polygon,path';

/** 그라데이션 스탑 → SVG <stop> 의 {col(알파 없는 색), op(0..1 문자열)} — 알파 이중 적용 방지(0919 QA). */
export function shapeStopPaint(s) {
  const raw = String((s && s.color) || '#000000').trim();
  let col = raw, colA = 1;
  const m = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (m) {
    col = `rgb(${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])})`;
    colA = m[4] == null ? 1 : Math.max(0, Math.min(1, +m[4]));
  }
  const o = (s && s.opacity != null && Number.isFinite(+s.opacity)) ? Math.max(0, Math.min(1, +s.opacity)) : null;
  const a = (o == null || o >= 1) ? (o == null ? colA : (colA < 1 ? colA : 1)) : o;
  return { col, op: String(Math.round(a * 1000) / 1000) };
}

function _applyShapeGradient(block, svg, detail) {
  const id = _gradIdFor(block);
  const targetType = detail.type === 'radial' ? 'radialGradient' : 'linearGradient';
  const stops = detail.stops || [];

  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  let gradNode = svg.querySelector(`#${CSS.escape(id)}`);

  // 재사용 조건: 같은 element 이름 + 같은 stop 개수 → 속성·자식 stop 갱신만
  const reuse = gradNode && gradNode.tagName === targetType && gradNode.children.length === stops.length;

  if (!reuse) {
    if (gradNode) gradNode.remove();
    gradNode = document.createElementNS(SVG_NS, targetType);
    gradNode.setAttribute('id', id);
    for (let i = 0; i < stops.length; i++) {
      gradNode.appendChild(document.createElementNS(SVG_NS, 'stop'));
    }
    defs.appendChild(gradNode);
  }

  // 좌표/축 갱신
  if (targetType === 'radialGradient') {
    gradNode.setAttribute('cx', '50%');
    gradNode.setAttribute('cy', '50%');
    gradNode.setAttribute('r', '50%');
  } else {
    const a = ((detail.angle ?? 90) - 90) * Math.PI / 180;
    let x1 = 0.5 - Math.cos(a) * 0.5;
    let y1 = 0.5 - Math.sin(a) * 0.5;
    let x2 = 0.5 + Math.cos(a) * 0.5;
    let y2 = 0.5 + Math.sin(a) * 0.5;
    // 0918 canvasgrad(T-060): 캔버스 바 끝점을 도형 밖으로 끌면 스탑이 0% 미만·100% 초과가 된다.
    // SVG <stop offset> 은 0~1 로 잘리므로 선을 스탑 범위까지 늘리고 offset 을 재매핑(저장값은 그대로).
    const _r = svgStopRemap({ x1, y1, x2, y2 }, stops.map(s => s.offset ?? 0));
    x1 = _r.x1; y1 = _r.y1; x2 = _r.x2; y2 = _r.y2;
    gradNode._offRemap = _r.remap;
    gradNode.setAttribute('x1', x1.toFixed(4));
    gradNode.setAttribute('y1', y1.toFixed(4));
    gradNode.setAttribute('x2', x2.toFixed(4));
    gradNode.setAttribute('y2', y2.toFixed(4));
  }

  // stop 갱신 (같은 값이면 setAttribute 스킵해 mutation 폭주 방지)
  const stopNodes = gradNode.children;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const _rm = gradNode._offRemap;
    const off = _rm
      ? (Math.round((((s.offset ?? 0) - _rm.lo) / _rm.span) * 10000) / 100) + '%'
      : Math.round((s.offset ?? 0) * 100) + '%';
    // ★0919 QA: 알파를 «한 번만» — 색이 rgba(…,a) 로 오고 opacity 에도 같은 a 가 실려 오면(CSS 모델 재파싱 경로)
    //   stop-color 알파 × stop-opacity 로 두 번 곱해져 50% 가 25% 로 그려졌다. stop-color 는 알파 없는 rgb,
    //   알파는 stop-opacity 한 곳(피커 CSS 모델과 같은 규약: opacity 가 정본, opacity 가 1/없음이면 색 알파).
    const { col, op } = shapeStopPaint(s);
    const n = stopNodes[i];
    if (n.getAttribute('offset') !== off) n.setAttribute('offset', off);
    if (n.getAttribute('stop-color') !== col) n.setAttribute('stop-color', col);
    if (n.getAttribute('stop-opacity') !== op) n.setAttribute('stop-opacity', op);
  }

  // fill="url(#id)" 는 한 번만 적용 — 같은 url이면 setAttribute 자체를 스킵.
  // querySelectorAll 결과는 라이브가 아니라 매번 새로 만들지만, fillable 셰이프 한 개당
  // 보통 element 수가 적어 cost는 미미. 다만 같은 url이면 노드 mutation 자체 회피.
  const urlVal = `url(#${id})`;
  const nodes = svg.querySelectorAll(FILLABLE_SEL);
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const f = el.getAttribute('fill');
    if (f === 'none') continue;
    if (f !== urlVal) el.setAttribute('fill', urlVal);
  }
}

window._applyShapeGradient = _applyShapeGradient;
window._clearShapeGradient = _clearShapeGradient;

/* ── 이미지(에셋) 채우기 — 0918 picker ──────────────────────────────────────
 * 상태는 dataset 두 개로만 말한다(클래스 X — section-serialize RUNTIME_MARKER 규약과 안 부딪히고 저장·로드 뒤에도 남는다):
 *   data-shape-fill="image"            이미지 모드(= 칠이 색이 아니라 이미지)
 *   data-shape-image="1"                실제 이미지가 들어 있음(없으면 «넣기 전» = 바둑판)
 * ★바둑판은 «CSS 자리»에 둔다(정본 선례 .asset-block / .cvb-img-empty — editor-blocks.css 주석):
 *   CSS 규칙이 SVG 면을 url(#goya-shape-checker) 로 칠한다. 패턴 정의는 #canvas 밖(body)에 1번만 주입 →
 *   직렬화·내보내기에 안 실린다. export-image 는 clone 에서 data-shape-fill 을 떼서 마지막 단색으로 낸다.
 * ★실제 이미지는 «인라인»(저장·HTML 내보내기에 실려야 하므로): 블럭 직속 div.shape-img-fill 에
 *   background:cover + 도형 모양 clip-path. SVG 면은 inline fill:transparent 로 비워 밑의 사진이 보이게 한다.
 *   (SVG <pattern><image> 는 도형 svg 가 preserveAspectRatio="none" 이라 사진이 늘어나 버려서 쓰지 않는다.)
 * ★svg.style.color(마지막 단색)는 건드리지 않는다 → 외곽선(currentColor)은 그대로, 솔리드 복귀 = 그 색. */
const SHAPE_FACE_TYPES = { rectangle: true, ellipse: true, polygon: true, star: true };
const _checkerSwatchBg = () => checkerBgBigColors('10px');   // 패널 스와치 — 색은 큰 쌍(CSS 토큰), 칸만 10px
// SHAPE_DEFS(block-factory.js) 좌표를 %로 옮긴 것 — polygon: viewBox 200×180, star: 200×190.
const SHAPE_IMG_CLIP = {
  rectangle: '',
  ellipse: 'ellipse(50% 50% at 50% 50%)',
  polygon: 'polygon(50% 4.44%, 97% 95.56%, 3% 95.56%)',
  star: starClipPath(5),   // 꼭짓점 수가 다르면 _syncShapeImageClip 이 dataset.starPoints 로 다시 만든다
};

/* 도형의 «마지막 단색» — svg.style.color(applyColor 가 쓰고, 그라데이션·이미지 모드는 안 건드림)를
   shapeColor 저장 형식(#rrggbb 또는 rgba(r,g,b,a))으로. 없으면 ''. */
function _lastSolidOf(block) {
  const svg = block && (block.querySelector('svg.shape-svg') || block.querySelector('svg'));
  const v = svg ? (svg.style.color || '') : '';
  if (!v || v === 'currentcolor' || v === 'currentColor') return '';
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (!m) return '';
  const p = m[1].split(',').map(x => x.trim());
  const to = (n) => Math.max(0, Math.min(255, parseInt(n, 10) | 0)).toString(16).padStart(2, '0');
  if (p.length === 4 && parseFloat(p[3]) < 1) return `rgba(${parseInt(p[0], 10)},${parseInt(p[1], 10)},${parseInt(p[2], 10)},${parseFloat(p[3])})`;
  return '#' + to(p[0]) + to(p[1]) + to(p[2]);
}

function _ensureShapeCheckerDefs() {
  if (typeof document === 'undefined' || document.getElementById('goya-shape-checker-defs')) return;
  const holder = document.createElementNS(SVG_NS, 'svg');
  holder.setAttribute('id', 'goya-shape-checker-defs');
  holder.setAttribute('width', '0');
  holder.setAttribute('height', '0');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  // 8×8 칸 바둑판 — objectBoundingBox 라 도형 크기와 무관하게 칸 수가 같다. 색 = 앱 체커 토큰(--goya-checker-svg-a/b).
  const { a, b } = checkerSvgFills();   // 색 = CSS --goya-checker-svg-a/b (var 참조 — style fill 이라 살아 있다)
  holder.innerHTML = `<defs><pattern id="goya-shape-checker" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="0.25" height="0.25">
    <rect x="0" y="0" width="0.25" height="0.25" style="fill:${b}"/>
    <rect x="0" y="0" width="0.125" height="0.125" style="fill:${a}"/>
    <rect x="0.125" y="0.125" width="0.125" height="0.125" style="fill:${a}"/>
  </pattern></defs>`;
  (document.body || document.documentElement).appendChild(holder);
}

function _syncShapeImageClip(block) {
  const img = block && block.querySelector(':scope > .shape-img-fill');
  if (!img) return;
  const type = block.dataset.shapeType || 'rectangle';
  /* ★별이 여러 개면 이미지 모드를 «지운다» — clip-path 는 polygon 하나뿐이라(실측: polygon 둘은
     computed "none") 사진이 ★첫 별 모양으로만 잘리고 나머지 별은 투명해진다. 패널 경로는 갯수를
     올릴 때 이미 풀지만(prop-shape applyStarCount), 저장본·다른 입구로 둘이 함께 들어와도
     «조용한 반쪽 동작»이 되지 않게 여기서도 막는다. */
  if (type === 'star' && clampStarCount(block.dataset.starCount) > 1) { _clearShapeImage(block); return; }
  const clip = type === 'star' ? starClipPath(block.dataset.starPoints, block.dataset.starInner) : (SHAPE_IMG_CLIP[type] || '');
  if (clip) img.style.clipPath = clip; else img.style.removeProperty('clip-path');
}

function _clearShapeImage(block) {
  if (!block) return;
  block.querySelector(':scope > .shape-img-fill')?.remove();
  const svg = block.querySelector('svg.shape-svg') || block.querySelector('svg');
  if (svg && svg.style.fill === 'transparent') svg.style.fill = 'currentColor';
  delete block.dataset.shapeFill;
  delete block.dataset.shapeImage;
}

function _enterShapeChecker(block) {
  _ensureShapeCheckerDefs();
  _clearShapeImage(block);
  block.dataset.shapeFill = 'image';
}

function _applyShapeImage(block, src, fit) {
  if (!block || !src) return;
  _clearShapeImage(block);
  const img = document.createElement('div');
  img.className = 'shape-img-fill';
  img.setAttribute('aria-hidden', 'true');
  const size = fit === 'fit' ? 'contain' : fit === 'tile' ? 'auto' : 'cover';
  const repeat = fit === 'tile' ? 'repeat' : 'no-repeat';
  img.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:0;background-image:url("${src}");background-size:${size};background-position:center;background-repeat:${repeat};`;
  block.insertBefore(img, block.firstChild);
  _syncShapeImageClip(block);
  const svg = block.querySelector('svg.shape-svg') || block.querySelector('svg');
  if (svg) svg.style.fill = 'transparent';
  block.dataset.shapeFill = 'image';
  block.dataset.shapeImage = '1';
}

_ensureShapeCheckerDefs();
window._clearShapeImage = _clearShapeImage;
window._syncShapeImageClip = _syncShapeImageClip;
