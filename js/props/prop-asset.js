import { propPanel, state } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { alignBtn, overlayToggleBtnHTML } from './_helpers.js';
import { posElOf, wireFloatToggle, wireFloatPosition, floatPositionRowHTML } from '../overlay-float.js';
import { videoTrimSectionHTML, wireVideoTrim } from './asset-video-trim.js';
/* ★폭 하한은 «리터럴로 쓰지 않는다» — asset-width-limits.js 한 자리에서 온다.
   패널(슬라이더·숫자칸·커밋 clamp)과 모서리 핸들이 «같은 수»를 봐야 갈라지지 않는다.
   (선례: prop-modal.js 가 MODAL_LIMITS 를, prop-gap.js 가 GAP_MIN/MAX 를 그렇게 쓴다.) */
import { ASSET_W_MIN } from '../blocks/asset-width-limits.js';

export function applyAssetPadX(ab, padX) {
  const canvasW = 860;
  const baseH   = parseInt(ab.dataset.baseHeight) || parseInt(ab.style.height) || 780;
  const newW    = canvasW - padX * 2;
  const newH    = Math.round(baseH * newW / canvasW);
  const pct     = Math.round(newW / canvasW * 10000) / 100; // 소수점 2자리 %
  ab.style.paddingLeft  = '';
  ab.style.paddingRight = '';
  ab.style.width        = pct + '%';
  ab.style.alignSelf    = 'center';
  ab.style.height       = newH + 'px';
}

export function showAssetProperties(ab) {
  const currentH   = parseInt(ab.style.height) || ab.offsetHeight || 780;
  const hasImage   = ab.classList.contains('has-image');
  const currentR   = parseInt(ab.style.borderRadius) || 0;
  const currentAlign = ab.dataset.align || 'center';
  /* 너비: inline px → 그대로 / inline % → px 환산 / 없거나 calc() → 860 (full)
     ★함수로 뽑은 이유 = 「빈 칸을 커밋했을 때 되돌릴 값」도 «같은 셈»이어야 한다.
       두 곳에 따로 적으면 패널이 여는 순간의 값과 되돌리는 값이 갈라진다. */
  const readW = () => {
    const raw = ab.style.width;
    if (!raw) return 860;
    if (raw.endsWith('%')) return Math.round(parseFloat(raw) * 860 / 100);
    /* calc(100% + Npx) — 풀블리드·스크래치 «넘침» 밴드의 관용구(prop-page.js applyAssetFullBleed,
       canvas-scratch-drop.js applyScratchWidth). 문자열로는 못 읽으니 «잰다».
       ⛔getBoundingClientRect 를 쓰지 마라 — 캔버스 줌(transform)이 곱해져 40% 에서 344 를 준다.
         offsetWidth 는 layout 값이라 줌과 무관하다(prop-label-group.js 선례와 같은 이유).
       ⚠️이 갈래가 없으면 parseInt('calc(…)') = NaN → 폴백 860 이라, 830 으로 들어온 블록을
         패널이 «860» 이라고 말한다(= 슬라이더를 건드리는 순간 풀블리드로 튄다). */
    if (raw.startsWith('calc(')) return Math.round(ab.offsetWidth) || 860;
    return parseInt(raw) || 860;
  };
  const currentW = readW();
  if (!ab.dataset.align) { ab.dataset.align = 'center'; ab.style.alignSelf = 'center'; }
  /* ★눈금의 «하한»은 실제 값보다 커서는 안 된다 (2026-09-20, 0920b-scratch-modal)
       슬라이더는 min 보다 작은 value 를 «조용히 끌어올려» 보여준다 ⇒ 실제 165px 짜리 블록에
       높이 슬라이더는 200 을, 숫자칸은 165 를 띄워 «같은 줄에서 서로 다른 말»을 한다.
       그 상태에서 슬라이더를 건드리거나 숫자칸을 커밋하면 하한으로 튀어 방금 맞춘 비율이 깨진다.
     ⚠️이건 이번 수정이 «새로 만든» 자리가 아니다 — Logo 프리셋(200×64)이 이미 그 길이었다
       (높이 슬라이더에 64 를 넣는데 min 은 200). 스크래치 표시폭 그대로 넣기가
       그 자리를 «자주 밟게» 만들 뿐이다.
     ⇒ «높이 축»은 기본 하한 200 을 그대로 두고, 이미 그보다 낮은 블록에서만 눈금을 넓힌다.
       ⛔높이 하한 자체를 낮추지 않는다 — 보통 블록의 편집 감각은 한 픽셀도 안 바뀐다.
     ★«폭 축»은 2026-09-20 통합에서 갈라졌다 — 현빈 결정 ㉠(T-075/T-078)으로
       폭 하한이 «상수 60»(ASSET_W_MIN)이 됐다. 그래서 여기서 폭에 적응형 하한을 따로
       세우지 않는다(옛 `W_MIN = Math.min(100, currentW)` 는 삭제).
       ⑴ 하한이 60 이라 스크래치 최소(60px)와 같은 수다 ⇒ 패널이 거짓말할 자리가 없어졌다.
       ⑵ 적응형을 남기면 «하한이 두 자리»가 되어 asset-width-limits.js 의 단일 진실원이 깨진다
          (tests/unit/asset-width-min.test.js S-1·S-2 가 그걸 검사로 막는다).
       ⑶ 결정 문구의 「적응형은 min(60, 현재값) 으로 «낮추기만»」 = 60 보다 올리는 길을 막으라는 뜻.
          지금 폭이 60 밑으로 내려갈 수 있는 길은 패널·핸들 양쪽에 «없다»(둘 다 ASSET_W_MIN 클램프). */
  const H_MIN = Math.min(200, currentH > 0 ? currentH : 200);
  const currentSize   = ab.dataset.size    || '100';
  // (가) 설계: effective usePadx — dataset 명시값 우선, 미설정이면 글로벌 디폴트
  const usePadX       = typeof window.getEffectiveUsePadx === 'function'
    ? window.getEffectiveUsePadx(ab)
    : (ab.dataset.usePadx === 'true');
  /* ⛔이름 충돌 주의 — 바로 아래 `overlayOn`/`asset-overlay-toggle` 은 «이미지 위에 어두운 막 +
     텍스트를 얹는» Text Overlay 다(.asset-overlay). 이번 건(오버레이=플로팅, Figma 의 Ignore
     Auto Layout)과 «완전히 다른 기능»인데 이름만 같다. 그래서 새 토글의 id 는
     `asset-float-toggle` 이다 — 같은 id 를 쓰면 getElementById 가 먼저 것을 잡아 두 기능이
     서로를 눌러 버린다(.guard/FEATURE_REGISTRY.md 가 옛 id 를 계약으로 못 박고 있다).
     (2026-09-20 현빈 원문 3번 「도형 블럭과 에셋 블럭에도 오버레이 버튼·기능」 / T-052) */
  const floatPosEl     = posElOf(ab);
  const isFloatOverlay = floatPosEl?.dataset.overlayBlock === 'true';
  const overlayOn     = ab.dataset.overlay === 'true';
  // 기존 overlay 요소 가져오기 (없으면 생성)
  let overlayEl = ab.querySelector('.asset-overlay');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'asset-overlay';
    ab.appendChild(overlayEl);
  }
  const overlayColor = overlayEl.style.color || '#ffffff';
  const overlayOpacity = parseFloat(overlayEl.dataset.ovOpacity ?? '0.35');

  // 그레인(필름 노이즈) — asset-overlay와 같은 패턴: 형제 오버레이 div + dataset.
  // ⛔패널을 열기만 해도 만들면 안 된다(적대적 QA a1-a3 지적) — 실제로 강도를 설정할 때만
  //   만든다(아래 슬라이더 핸들러). 여기선 이미 있으면 값만 읽는다.
  let grainEl = ab.querySelector('.asset-grain');
  const grainIntensity = grainEl ? Math.round(parseInt(grainEl.dataset.grainIntensity ?? '0', 10)) : 0;

  const currentBgColor = ab.dataset.bgColor || '#a0a0a0';
  // T-059 2라운드: 그라데이션이면 _hex6 가 #000000 으로 떨어져 Solid 복귀 = 검정이었다 → wireColorField(gradientValue)가 첫 스탑으로 채운다
  const assetBgGrad = /gradient\s*\(/i.test(currentBgColor) ? currentBgColor : '';
  const currentBgAlpha = assetBgGrad ? 100 : parseAlphaFromColor(currentBgColor);
  const currentFit = ab.dataset.fit || 'cover';
  // B23: 에셋 외곽선(stroke)
  const currentStrokeWidth = parseInt(ab.dataset.strokeWidth || '0');
  const currentStrokeColor = ab.dataset.strokeColor || '#000000';
  const currentStrokeAlpha = parseAlphaFromColor(currentStrokeColor);
  const isVideo = ab.dataset.assetType === 'video-pending';
  /* T-011: 배경색은 «이미지의 하위 속성»이 아니라 블록 속성이다 — 이미지를 넣으면 배경 절이
     통째로 사라져, 이미 걸어 둔 그라데이션을 고칠 길도 지울 길도 없었다(값은 dataset.bgColor 에
     살아서 계속 칠해지는데 «닿는 문»만 없는 막다른 골목). ⇒ hasImage 분기 «밖»에 둔다.
     선례: prop-icon-circle.js 의 Color/배경 절도 hasImage 삼항 밖에 있다. */
  const bgSection = `
    <div class="prop-section">
      <div class="prop-section-title">Background</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        ${colorFieldHTML({ idPrefix: 'asset-bg', hex: assetBgGrad ? '#a0a0a0' : currentBgColor, alpha: currentBgAlpha, gradientCss: assetBgGrad })}
      </div>
      <!-- ★「초기화」는 색 줄의 «3번째 형제»였다 — 그 버튼은 안 줄고(.prop-align-btn--aux: flex 0 0 auto)
           줄어드는 건 색 필드뿐이라, 고정 240px 패널에서 hex 칸이 16px 로 짜부라져 값이 안 보였다(T-100).
           같은 파일의 형제 행(외곽선, 버튼 없음)은 69px 로 멀쩡했다 — 실측 대조. ⇒ 버튼을 자기 줄로 내린다. -->
      <div class="prop-color-row--aux">
        <button class="prop-align-btn prop-align-btn--aux" id="asset-bg-clear">초기화</button>
      </div>
      ${hasImage && currentFit === 'cover' ? '<div class="prop-hint" style="margin-top:6px;">꽉 채우기에서는 배경이 이미지 뒤에 가려집니다 — 원본 비율에서 보입니다.</div>' : ''}
    </div>`;
  const imageSection = hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">${isVideo ? 'Video' : 'Image'}</div>
      <div class="prop-row">
        <span class="prop-label">Fit</span>
        <div class="prop-align-group" id="asset-fit-group">
          <button class="prop-align-btn${currentFit==='cover'?' active':''}" data-fit="cover" title="꽉 채우기">꽉 채우기</button>
          <button class="prop-align-btn${currentFit==='contain'?' active':''}" data-fit="contain" title="원본 비율">원본 비율</button>
        </div>
      </div>
      ${isVideo ? '' : '<button class="prop-action-btn secondary" id="asset-pos-btn">이미지 위치 조절</button>'}
      <button class="prop-action-btn secondary" id="asset-replace-btn">${isVideo ? '영상' : '이미지'} 교체</button>
      <button class="prop-action-btn danger"    id="asset-remove-btn">${isVideo ? '영상' : '이미지'} 제거</button>
    </div>
    ${isVideo ? videoTrimSectionHTML(ab) : ''}` : `
    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <div class="prop-hint" style="text-align:center;padding:8px 0 4px;">더블클릭하여 이미지 추가</div>
      <button class="prop-action-btn secondary" id="asset-upload-btn" style="margin-top:4px;">이미지 선택...</button>
      <div class="prop-hint" style="text-align:center;margin-top:4px;">또는 파일을 블록에 드래그</div>
    </div>`;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <circle cx="4" cy="4" r="1"/>
            <polyline points="11 8 8 5 3 11"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${ab.dataset.layerName || 'Asset Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(ab)}</span>
        </div>
        ${ab.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${ab.id}')">${ab.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Preset</div>
      <div class="prop-type-group">
        <button class="prop-preset-btn prop-type-btn" data-w="860" data-h="780">Standard</button>
        <button class="prop-preset-btn prop-type-btn" data-w="860" data-h="860">Square</button>
        <button class="prop-preset-btn prop-type-btn" data-w="860" data-h="1032">Tall</button>
        <button class="prop-preset-btn prop-type-btn" data-w="860" data-h="575">Wide</button>
        <button class="prop-preset-btn prop-type-btn" data-preset="logo" data-w="200" data-h="64">Logo</button>
        <button class="prop-preset-btn prop-type-btn" data-preset="a4" data-w="410" data-h="580">A4</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title prop-ph-header">
        <span>Size</span>
        ${overlayToggleBtnHTML({ id: 'asset-float-toggle', active: isFloatOverlay, title: '오토레이아웃에서 빼서 섹션 위에 절대위치로 띄웁니다(Figma의 Ignore Auto Layout과 같은 개념). 다시 누르면 원래 있던 자리로 돌아갑니다. ※아래 「Text Overlay」(이미지 위 어두운 막)와는 다른 기능입니다.' })}
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="asset-align-group">
          ${alignBtn('object-h', 'left', { label: '왼쪽 정렬', title: '왼쪽 정렬', active: currentAlign==='left', attrs: { 'data-align': 'left' } })}
          ${alignBtn('object-h', 'center', { label: '가운데 정렬 (수평)', title: '가운데 정렬 (수평)', active: currentAlign==='center', attrs: { 'data-align': 'center' } })}
          ${alignBtn('object-h', 'right', { label: '오른쪽 정렬', title: '오른쪽 정렬', active: currentAlign==='right', attrs: { 'data-align': 'right' } })}
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="asset-w-slider" min="${ASSET_W_MIN}" max="860" step="10" value="${currentW}">
        <input type="number" class="prop-number" id="asset-w-number" min="${ASSET_W_MIN}" max="860" value="${currentW}">
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="asset-h-slider" min="${H_MIN}" max="1600" step="10" value="${currentH}">
        <input type="number" class="prop-number" id="asset-h-number" min="${H_MIN}" max="1600" value="${currentH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="asset-r-slider" min="0" max="120" step="2" value="${currentR}">
        <input type="number" class="prop-number" id="asset-r-number" min="0" max="120" value="${currentR}">
      </div>
      <div class="prop-row">
        <span class="prop-label">패딩 제외</span>
        <label class="prop-toggle">
          <input type="checkbox" id="asset-padx-toggle" ${usePadX ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      ${floatPositionRowHTML({ prefix: 'asset', posEl: floatPosEl })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Border</div>
      <div class="prop-color-row">
        <span class="prop-label">외곽선</span>
        ${colorFieldHTML({ idPrefix: 'asset-stroke-color', hex: currentStrokeColor, alpha: currentStrokeAlpha })}
      </div>
      <div class="prop-row" style="margin-top:8px;">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="asset-stroke-slider" min="0" max="20" step="1" value="${currentStrokeWidth}">
        <input type="number" class="prop-number" id="asset-stroke-num" min="0" max="20" value="${currentStrokeWidth}">
      </div>
    </div>
    ${bgSection}
    ${imageSection}
    ${hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">그레인</div>
      <div class="prop-row">
        <span class="prop-label">강도</span>
        <input type="range" class="prop-slider" id="asset-grain-slider" min="0" max="100" step="1" value="${grainIntensity}">
        <input type="number" class="prop-number" id="asset-grain-number" min="0" max="100" value="${grainIntensity}">
      </div>
    </div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">Text Overlay</div>
      <!-- ★2026-09-20 픽스라운드(low④) — 같은 패널에 「오버레이」가 두 뜻으로 보인다:
           여기(이미지 위 어두운 막)와 위 Size 절의 오버레이(플로팅). 개명은
           .guard/FEATURE_REGISTRY.md 계약(id·dataset)을 건드리므로 승인 대상이라,
           지금은 «설명 한 줄»만 붙여 화면에서 가를 수 있게 한다. -->
      <div class="prop-hint" style="margin:-2px 0 6px;">이미지 «위에» 어두운 막을 씌웁니다 — 위 Size 절의 «오버레이(플로팅)» 버튼과는 다른 기능입니다.</div>
      <div class="prop-row">
        <span class="prop-label">활성화</span>
        <label class="prop-toggle">
          <input type="checkbox" id="asset-overlay-toggle" ${overlayOn ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div id="asset-overlay-controls" style="${overlayOn ? '' : 'display:none'}">
        <div class="prop-row">
          <span class="prop-label">불투명</span>
          <input type="range" class="prop-slider" id="asset-overlay-opacity" min="0" max="100" step="1" value="${Math.round(overlayOpacity * 100)}">
          <input type="number" class="prop-number" id="asset-overlay-opacity-num" min="0" max="100" value="${Math.round(overlayOpacity * 100)}">
        </div>
        <div class="prop-row">
          <span class="prop-label">위치</span>
          <div class="prop-align-group" id="overlay-position-group">
            ${alignBtn('object-v', 'top', { label: '위쪽 정렬', title: '위쪽 정렬', active: (overlayEl.style.justifyContent||'center')==='flex-start', attrs: { 'data-pos': 'flex-start' } })}
            ${alignBtn('object-v', 'middle', { label: '가운데 정렬 (수직)', title: '가운데 정렬 (수직)', active: (overlayEl.style.justifyContent||'center')==='center', attrs: { 'data-pos': 'center' } })}
            ${alignBtn('object-v', 'bottom', { label: '아래쪽 정렬', title: '아래쪽 정렬', active: (overlayEl.style.justifyContent||'center')==='flex-end', attrs: { 'data-pos': 'flex-end' } })}
          </div>
        </div>
        <div class="prop-hint" style="margin-top:2px;">이 블록 선택 후 중앙 패널로 블록 추가</div>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(ab.id || null);

  const wSlider = document.getElementById('asset-w-slider');
  const wNumber = document.getElementById('asset-w-number');
  const applyW = v => {
    if (v >= 860) {
      // 패딩제외면 calc()+음수마진 세트 복원, 아니면 제거 (overlay-handles 리사이즈와 동일 규약)
      if (window.applyAssetFullBleed) window.applyAssetFullBleed(ab); else ab.style.width = '';
    } else {
      /* ★폭과 마진은 «세트»다 — 단독으로 쓰면 풀블리드의 음수마진(-padX)이 남아 블록이
         한쪽으로 padX 만큼 밀린다(prop-page.js applyAssetWidth 머리말, 2026-09-20 QA). */
      if (window.applyAssetWidth) window.applyAssetWidth(ab, v);
      else { ab.style.width = v + 'px'; ab.style.marginLeft = ''; ab.style.marginRight = ''; }
      ab.style.alignSelf = ab.dataset.align === 'left' ? 'flex-start'
        : ab.dataset.align === 'right' ? 'flex-end' : 'center';
    }
    wSlider.value = v;
    wNumber.value = v;
  };
  wSlider.addEventListener('input', () => { applyW(parseInt(wSlider.value)); });
  wSlider.addEventListener('change', () => { window.pushHistory?.(); });
  wNumber.addEventListener('change', () => {
    /* ⚠️★옛 꼴 `Math.max(100, parseInt(v) || 860)` 은 «0 과 빈 칸을 같은 것으로» 봤다.
         둘 다 falsy 라 폴백 860 으로 떨어져 «꽉참(풀블리드)»이 된다 —
           · 0 을 넣은 사람은 「가장 작게」를 원했는데 화면은 제일 커졌다
           · 지우다 만 빈 칸도 마찬가지로 꽉 차 버렸다 (지우는 동안 값이 날아간다)
         ⇒ 하한 숫자만 60 으로 바꿔서는 이 문이 «안» 닫힌다. 셋을 갈라야 한다.
       ⑴ 빈 칸·NaN = «값 없음» → 커밋하지 않는다(지금 폭을 칸에 되돌려 놓기만).
       ⑵ 0 을 포함한 숫자 → 하한 ASSET_W_MIN·상한 860 으로 «막는다».
       ⚠️높이 칸(hNumber)의 `|| 780` 도 같은 꼴이지만 «높이 축»은 이 카드의 범위가 아니다. */
    const raw = parseInt(wNumber.value, 10);
    if (!Number.isFinite(raw)) {
      const now = readW();
      wNumber.value = now; wSlider.value = now;
      return;                                   // ⛔pushHistory 도 안 한다 — «아무 일도 없었다»
    }
    applyW(Math.min(860, Math.max(ASSET_W_MIN, raw)));
    window.pushHistory?.();
  });

  const hSlider = document.getElementById('asset-h-slider');
  const hNumber = document.getElementById('asset-h-number');

  document.getElementById('asset-padx-toggle').addEventListener('change', e => {
    ab.dataset.usePadx = e.target.checked ? 'true' : 'false';
    /* ★[로고 표식 유실] 패딩 토글로 폭이 재계산되면 고정폭 프리셋 상태와 어긋나므로 preset 을
     *   해제한다(코덱스리뷰 b2-6). ⛔그런데 초판은 그걸 «조건 없이» 했다.
     *   Logo 프리셋은 정의부터 「200x64 고정, usePadx 무시」다(:293 아래) — 폭이 «재계산되지 않는다».
     *   그래서 로고에서는 해제할 이유가 없는데도 표식만 사라졌다:
     *     크기는 200x64 그대로 · data-preset 만 소실 ⇒ 「로고인데 로고로 안 세어진다」
     *   실측(프로젝트 70개 전수, 에셋 934개): 표식 1 / 200x64 규격 7 — 6개가 이렇게 잃었다.
     *   ★현빈이 신고한 「리사이즈하면 패딩제외가 풀린다」와 같은 뿌리다 — 상태가 조용히 버려진다.
     *   ⇒ 로고는 표식을 지키고, «폭도 다시 잡는다»(아래 재계산 구간을 아예 안 타게 한다).
     *     a4 는 실제로 폭이 재계산되므로 기존 동작(해제)을 그대로 둔다. */
    const wasLogo = ab.dataset.preset === 'logo';
    if (!wasLogo) delete ab.dataset.preset;
    if (wasLogo) {
      // 표식만 지키는 게 아니라 «고정 규격»도 다시 못 박는다 — 표식과 크기가 어긋나면
      // 개수 근사(표식 ∪ 200x64)가 다음에 또 틀린다.
      ab.style.width = '200px';
      ab.style.height = '64px';
      ab.style.marginLeft = '';
      ab.style.marginRight = '';
      if (wNumber) wNumber.value = 200;
      if (wSlider) wSlider.value = 200;
      const hS = document.getElementById('asset-h-slider');
      const hN = document.getElementById('asset-h-number');
      if (hS) hS.value = 64;
      if (hN) hN.value = 64;
      window.pushHistory();
      return;                         // ★아래 폭·높이 재계산을 «안» 탄다(usePadx 무시가 정의다)
    }
    // 이 블록이 속한 section-inner의 padX 값 결정
    const inner = ab.closest('.section-inner');
    const hasPadXOverride = inner?.dataset.paddingX !== '' && inner?.dataset.paddingX !== undefined;
    const padX = inner
      ? (hasPadXOverride ? parseInt(inner.dataset.paddingX) : (state.pageSettings.padX || 0))
      : (state.pageSettings.padX || 0);
    const prevWidth = ab.offsetWidth;
    if (e.target.checked && padX > 0) {
      ab.style.marginLeft  = -padX + 'px';
      ab.style.marginRight = -padX + 'px';
      ab.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      ab.style.marginLeft  = '';
      ab.style.marginRight = '';
      ab.style.width = '';
    }
    // 너비 변화 비율에 따라 높이 비례 조정
    const newWidth = ab.offsetWidth;
    if (prevWidth > 0 && newWidth > 0 && newWidth !== prevWidth) {
      const prevH = parseInt(ab.style.height) || ab.offsetHeight;
      if (prevH > 0) {
        const newH = Math.round(prevH * newWidth / prevWidth);
        ab.style.height = newH + 'px';
        const hSliderEl = document.getElementById('asset-h-slider');
        const hNumberEl = document.getElementById('asset-h-number');
        if (hSliderEl) hSliderEl.value = newH;
        if (hNumberEl) hNumberEl.value = newH;
      }
    }
    window.pushHistory();
  });

  const applyH = v => {
    ab.style.height = v + 'px';
    hSlider.value = v;
    hNumber.value = v;
  };
  hSlider.addEventListener('input', () => { applyH(parseInt(hSlider.value)); });
  hSlider.addEventListener('change', () => { window.pushHistory?.(); }); // wSlider 패턴 통일: change에서만 pushHistory
  hNumber.addEventListener('change', () => {
    const v = Math.min(1600, Math.max(H_MIN, parseInt(hNumber.value) || 780));  // ★하한은 눈금과 «같은 한 벌»
    applyH(v); window.pushHistory();
  });

  const setWSliderDisabled = disabled => {
    wSlider.disabled = disabled;
    wNumber.disabled = disabled;
    wSlider.style.opacity = disabled ? 'var(--ui-disabled-opacity)' : '';
    wNumber.style.opacity = disabled ? 'var(--ui-disabled-opacity)' : '';
  };

  // 초기 상태: Logo 프리셋이면 width 슬라이더 비활성화
  if (ab.dataset.preset === 'logo') setWSliderDisabled(true);

  propPanel.querySelectorAll('.prop-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const isLogo = btn.dataset.preset === 'logo';
      const isA4   = btn.dataset.preset === 'a4';
      const w = parseInt(btn.dataset.w);
      const h = parseInt(btn.dataset.h);
      ab.dataset.size       = '100';
      ab.dataset.baseHeight = h;  // 항상 baseHeight 갱신

      if (isA4) {
        // A4 세로: 고정폭 410 + 중앙정렬 (full-bleed 아님). Logo 패턴과 유사하나 폭 슬라이더는 활성(410에서 조절 가능).
        ab.dataset.preset = 'a4';
        ab.dataset.align = 'center';
        ab.style.marginLeft  = '';
        ab.style.marginRight = '';
        ab.style.height = h + 'px';
        applyH(h);          // 580 (baseHeight는 상단에서 이미 갱신)
        applyW(w);          // 410 → width:410px + alignSelf center + 폭슬라이더 값 410
        setWSliderDisabled(false);
      } else if (isLogo) {
        // Logo 프리셋: 200x64 고정, usePadx 무시
        ab.dataset.preset = 'logo';
        ab.style.width    = '200px';
        ab.style.height   = '64px';
        ab.style.alignSelf = ab.dataset.align === 'left' ? 'flex-start'
          : ab.dataset.align === 'right' ? 'flex-end' : 'center';
        applyH(64);
        applyW(200);
        setWSliderDisabled(true);
      } else {
        // 일반 프리셋: Logo 해제
        delete ab.dataset.preset;
        setWSliderDisabled(false);

        if (ab.dataset.usePadx !== 'false') {
          // 패딩 제외 ON: 토글 핸들러와 동일하게 음수 마진 방식 적용
          const inner = ab.closest('.section-inner');
          const hasPadXOverride = inner?.dataset.paddingX !== '' && inner?.dataset.paddingX !== undefined;
          const padX = inner
            ? (hasPadXOverride ? parseInt(inner.dataset.paddingX) : (state.pageSettings.padX || 0))
            : (state.pageSettings.padX || 0);
          ab.dataset.baseHeight = h;
          if (padX > 0) {
            ab.style.marginLeft  = -padX + 'px';
            ab.style.marginRight = -padX + 'px';
            ab.style.width = `calc(100% + ${padX * 2}px)`;
          } else {
            ab.style.marginLeft  = '';
            ab.style.marginRight = '';
            ab.style.width = '';
          }
          ab.style.height = h + 'px';
          applyH(h);
        } else {
          // 패딩 포함: 컨텐츠 너비(756px)에 맞게 높이 비례 축소
          const inner = ab.closest('.section-inner');
          const hasPadXOverride = inner?.dataset.paddingX !== '' && inner?.dataset.paddingX !== undefined;
          const padX = inner
            ? (hasPadXOverride ? parseInt(inner.dataset.paddingX) : (state.pageSettings.padX || 0))
            : (state.pageSettings.padX || 0);
          const canvasW = 860;
          const contentW = canvasW - padX * 2;
          const scaledH = padX > 0 ? Math.round(h * contentW / canvasW) : h;
          ab.style.marginLeft  = '';
          ab.style.marginRight = '';
          ab.style.width  = '';
          ab.style.height = scaledH + 'px';
          ab.dataset.baseHeight = scaledH;
          applyH(scaledH);
          applyW(860);
        }
      }
      window.pushHistory();
    });
  });

  /* ★「지금 어느 프리셋이 적용돼 있는지」 표시 (T-101 ③, 2026-09-21 사용자관점훑기 smallux)
       재현(실앱 9550, New Design → 이미지블록 Square 추가 → Tall 클릭):
         ab.style.height 는 1032px 로 바뀌는데 .prop-preset-btn 여섯 개 전부 active 없음
         (실측 ["Standard:-","Square:-","Tall:-","Wide:-","Logo:-","A4:-"]).
       선례를 그대로 쓴다 — 같은 폴더 prop-page.js 의 _syncColPresets(칼럼 6/12):
         «현재 값이 정확히 그 프리셋일 때만» 켜고, 마지막으로 누른 단추를 기억하지 않는다.
         기억해 두면 슬라이더로 높이를 한 칸만 움직여도 그 표시가 곧바로 거짓말이 된다.
     ★왜 픽셀이 아니라 «비(比)»로 재나
       같은 프리셋이라도 「패딩 제외」가 꺼져 있으면 실제 픽셀이 컨텐츠폭(860-2·padX)으로
       줄어든 채 들어간다(바로 위 else 가지의 scaledH). 픽셀 동등비교만 하면 그 모드에서는
       어떤 단추도 영영 안 켜진다. 비는 두 모드에서 같다(반올림 여유 1%).
     ★Logo·A4 는 dataset.preset 이 따로 남으므로 그것까지 같아야 켠다 —
       비만 우연히 같은 보통 블록이 Logo 로 보이지 않게.
     ⛔크기가 바뀌는 «경로»를 손으로 나열하지 않는다(프리셋·슬라이더·숫자칸·모서리 핸들·
       undo/redo·패딩 토글…). 그런 목록은 늙는다. 대신 블록의 style/data-preset 변화를
       MutationObserver 로 본다 — 같은 파일 prop-page.js 의 내보내기 버튼이 쓰는 그 방식이다. */
  const presetBtns = [...propPanel.querySelectorAll('.prop-preset-btn')];
  const syncPresetActive = () => {
    /* ⛔여기서는 readW() 를 쓰지 «않는다» — 그건 슬라이더가 보여줄 «논리 폭»(패딩포함 모드에선
         style.width 가 비어 있어 860 을 돌려준다)이고, 그 모드의 실제 높이는 컨텐츠폭으로
         줄어든 scaledH 다 ⇒ 둘을 섞어 비를 내면 어떤 프리셋과도 안 맞는다(실측: 860 vs 650).
       ★대신 «그려진 상자»를 잰다. offsetWidth 는 layout 값이라 캔버스 줌(transform)과 무관하다
         (같은 파일 readW() 의 calc() 갈래가 이미 그 이유로 offsetWidth 를 쓴다). */
    const w = ab.offsetWidth || 0;
    const h = parseInt(ab.style.height) || ab.offsetHeight || 0;
    const cur = ab.dataset.preset || '';
    presetBtns.forEach(b => {
      const bw = parseInt(b.dataset.w), bh = parseInt(b.dataset.h);
      const ok = (b.dataset.preset || '') === cur
        && w > 0 && h > 0 && bw > 0 && bh > 0
        && Math.abs(h / w - bh / bw) <= (bh / bw) * 0.01;
      b.classList.toggle('active', ok);
      b.title = ok ? '지금 적용돼 있는 프리셋입니다' : '';
    });
  };
  if (window.__gdtAssetPresetObs) { try { window.__gdtAssetPresetObs.disconnect(); } catch (_) {} }
  const _presetObs = new MutationObserver(() => {
    /* 패널은 innerHTML 로 통째로 다시 그려진다 — 단추가 패널에서 떨어지면 스스로 끊는다. */
    if (!presetBtns[0] || !presetBtns[0].isConnected) {
      _presetObs.disconnect();
      if (window.__gdtAssetPresetObs === _presetObs) window.__gdtAssetPresetObs = null;
      return;
    }
    syncPresetActive();
  });
  try {
    _presetObs.observe(ab, { attributes: true, attributeFilter: ['style', 'data-preset'] });
    window.__gdtAssetPresetObs = _presetObs;
  } catch (_) {}
  syncPresetActive();


  const applyAlign = a => {
    ab.dataset.align = a;
    if (a === 'left')   ab.style.alignSelf = 'flex-start';
    if (a === 'center') ab.style.alignSelf = 'center';
    if (a === 'right')  ab.style.alignSelf = 'flex-end';
    propPanel.querySelectorAll('#asset-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
  };
  propPanel.querySelectorAll('#asset-align-group .prop-align-btn').forEach(btn => {
    /* ★[2026-09-21] 순서를 뒤집었다. «단추라 push-before 가 의도일 수 있다»고 봤으나
       실측에서 근거를 못 찾았다 — 직전 편집이 push-after 인 순간 이 클릭이 앞 편집과 뭉쳐
       ⌘Z 한 번에 둘 다 사라졌다(실측 A). 단추가 «한 클릭 = 한 걸음»인 성질(실측 C)은
       순서를 뒤집어도 안 깨진다 — 클릭 하나가 값을 확정하는 건 그대로다. */
    btn.addEventListener('click', () => { applyAlign(btn.dataset.align); window.pushHistory?.(); });
  });

  const rSlider = document.getElementById('asset-r-slider');
  const rNumber = document.getElementById('asset-r-number');
  const applyR = v => { ab.style.borderRadius = v + 'px'; };
  rSlider.addEventListener('input', () => { applyR(parseInt(rSlider.value)); rNumber.value = rSlider.value; });
  rSlider.addEventListener('change', () => { window.pushHistory?.(); });
  rNumber.addEventListener('change', () => { window.pushHistory?.(); });
  rNumber.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(rNumber.value) || 0));
    applyR(v); rSlider.value = v;
  });

  // ── B23: 외곽선(border) — 도형 stroke와 동등. 에셋은 div라 border-* 사용(box-sizing:border-box로 레이아웃 시프트 없음) ──
  const applyAssetBorder = v => {
    ab.dataset.strokeWidth = String(v);
    if (v > 0) {
      ab.style.borderStyle = 'solid';
      ab.style.borderWidth = v + 'px';
      ab.style.borderColor = ab.dataset.strokeColor || '#000000';
    } else {
      ab.style.border = '';
    }
  };
  const applyAssetStrokeColor = c => {
    ab.dataset.strokeColor = c;
    if ((parseInt(ab.dataset.strokeWidth) || 0) > 0) ab.style.borderColor = c;
  };
  if ((parseInt(ab.dataset.strokeWidth) || 0) > 0) applyAssetBorder(parseInt(ab.dataset.strokeWidth));
  wireColorField('asset-stroke-color', {
    initialAlpha: currentStrokeAlpha,
    onApply: (c) => applyAssetStrokeColor(c),
    onCommit: () => window.pushHistory?.(),
  });
  const stSlider = document.getElementById('asset-stroke-slider');
  const stNum    = document.getElementById('asset-stroke-num');
  stSlider.addEventListener('input',  () => { stNum.value = stSlider.value; applyAssetBorder(parseInt(stSlider.value)); });
  stSlider.addEventListener('change', () => window.pushHistory?.());
  stNum.addEventListener('input', () => {
    const v = Math.min(20, Math.max(0, parseInt(stNum.value) || 0));
    stSlider.value = v; applyAssetBorder(v);
  });
  stNum.addEventListener('change', () => window.pushHistory?.());

  if (hasImage) {
    document.getElementById('asset-fit-group').addEventListener('click', e => {
      const btn = e.target.closest('[data-fit]');
      if (!btn) return;
      const fit = btn.dataset.fit;
      ab.dataset.fit = fit;
      const img = ab.querySelector('.asset-img');
      if (img) img.style.objectFit = fit;
      document.querySelectorAll('#asset-fit-group [data-fit]').forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory?.();
    });
    document.getElementById('asset-pos-btn')?.addEventListener('click', () => window.enterPosDragMode(ab));
    document.getElementById('asset-replace-btn').addEventListener('click', () => window.triggerAssetUpload(ab));
    document.getElementById('asset-remove-btn').addEventListener('click', () => window.clearAssetImage(ab));
    if (isVideo) wireVideoTrim(ab);
  } else {
    document.getElementById('asset-upload-btn').addEventListener('click', () => window.triggerAssetUpload(ab));
  }

  /* T-011: 배경색 배선은 이미지 유무와 무관하게 «조건 없이» 돈다. else 안에 있던 탓에
     이미지가 들어가면 onGradient 가 사라졌고, color-picker.js 가 onGradient 유무로
     cpModes(solid / solid,gradient)를 정하므로 그라데이션 탭 자체가 안 열렸다. */
  const bgField = wireColorField('asset-bg', {
    initialAlpha: currentBgAlpha,
    gradientValue: assetBgGrad,   // T-059 2라운드: 재오픈 시드
    onApply: (c) => {
      // 이전 그라데이션 제거 후 솔리드 적용 (prop-frame.js ss-bg와 동일 패턴)
      ab.style.background = '';
      ab.dataset.bgColor = c;
      ab.style.backgroundColor = c;
    },
    onGradient: (css, commit) => {
      ab.style.backgroundColor = '';
      ab.style.background = css;
      ab.dataset.bgColor = css;
      if (commit) window.pushHistory?.();
    },
    onCommit: () => window.pushHistory?.(),
  });
  document.getElementById('asset-bg-clear').addEventListener('click', () => {
    delete ab.dataset.bgColor;
    ab.style.backgroundColor = '';
    ab.style.background = '';
    bgField?.setHex('#a0a0a0');
    window.pushHistory?.();
  });

  // ── 오버레이 이벤트 바인딩 ──
  const applyOverlayBg = opacity => {
    overlayEl.style.background = `rgba(0,0,0,${opacity})`;
    overlayEl.dataset.ovOpacity = String(opacity);
  };

  document.getElementById('asset-overlay-toggle').addEventListener('change', e => {
    const on = e.target.checked;
    ab.dataset.overlay = on ? 'true' : 'false';
    document.getElementById('asset-overlay-controls').style.display = on ? '' : 'none';
    window.pushHistory();
  });

  const ovOpSlider = document.getElementById('asset-overlay-opacity');
  const ovOpNum    = document.getElementById('asset-overlay-opacity-num');
  ovOpSlider.addEventListener('input', () => {
    const v = parseInt(ovOpSlider.value) / 100;
    ovOpNum.value = ovOpSlider.value;
    applyOverlayBg(v);
  });
  ovOpNum.addEventListener('change', () => {
    const v = Math.min(100, Math.max(0, parseInt(ovOpNum.value) || 0));
    ovOpSlider.value = v;
    applyOverlayBg(v / 100);
  });

  // 오버레이 위치
  propPanel.querySelectorAll('#overlay-position-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlayEl.style.justifyContent = btn.dataset.pos;
      propPanel.querySelectorAll('#overlay-position-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory();
    });
  });

  // ── 그레인 이벤트 바인딩 ──
  if (hasImage) {
    const applyGrain = intensity => {
      // ★여기서만 만든다 — 사용자가 실제로 강도를 만진 순간에만 층이 생긴다(위 주석 참고).
      if (!grainEl) {
        grainEl = document.createElement('div');
        grainEl.className = 'asset-grain';
        ab.appendChild(grainEl);
      }
      grainEl.style.opacity = String(intensity / 100);
      grainEl.dataset.grainIntensity = String(intensity);
    };
    const grainSlider = document.getElementById('asset-grain-slider');
    const grainNumber = document.getElementById('asset-grain-number');
    grainSlider.addEventListener('input', () => {
      const v = parseInt(grainSlider.value);
      grainNumber.value = v;
      applyGrain(v);
    });
    grainSlider.addEventListener('change', () => { window.pushHistory?.(); });
    grainNumber.addEventListener('change', () => {
      const v = Math.min(100, Math.max(0, parseInt(grainNumber.value) || 0));
      grainSlider.value = v;
      applyGrain(v);
      window.pushHistory?.();
    });
  }

  /* 오버레이(플로팅) 토글 — 텍스트·도형 패널과 «같은 함수»(js/overlay-float.js). */
  wireFloatToggle({
    block: ab,
    buttonId: 'asset-float-toggle',
    rerender: () => showAssetProperties(ab),
  });
  /* 떠 있을 때만 나오는 X/Y 두 칸 — 텍스트 Position 절과 «같은 규약»(overlay-float.js). */
  wireFloatPosition({ block: ab, xId: 'asset-x-number', yId: 'asset-y-number' });
}

// Backward compat: classic scripts call these via window.*
window.applyAssetPadX    = applyAssetPadX;
window.showAssetProperties = showAssetProperties;
