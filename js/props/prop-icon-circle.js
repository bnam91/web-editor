import { propPanel, state } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { gridCircleIconSvg } from '../blocks/grid-circle-icon.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

/* G14 「＋ 블럭 넣기 ▾」 종류 — 정본 목록은 js/icb-children.js ICB_CHILD_KINDS(이름표만 여기). */
const _ICB_KID_KINDS = [['body', '텍스트'], ['h2', '제목'], ['icon', '아이콘']];

export function showIconCircleProperties(block) {
  const circle   = block.querySelector('.icb-circle');
  const size     = parseInt(block.dataset.size)    || 80;
  const bgColor  = block.dataset.bgColor           || '#e8e8e8';
  /* ★G14 E48 — 「채움」은 원에 «인라인 색이 실렸나»로 읽는다(⛔dataset.bgColor 로 읽지 않는다).
     생성기(makeIconCircleBlock)가 빈 원에도 placeholder '#e8e8e8' 을 박는데 원에는 안 칠한다 — 체커가 보인다.
     예전 패널은 그 placeholder 를 «칠해진 색»으로 보여 줬다(실측 G14-MEASURE: 패널 E8E8E8 100% · 캔버스 체커 = 패널이 거짓말).
     ⇒ 읽는 쪽만 고친다 — 데이터는 그대로(Figma 폴백 export-figma-json 이 '#e8e8e8' 을 «빈 원» 신호로 쓴다).
     ★끔 = 기존 값 'transparent'(새 값 아님 — MCP _isColor 가 받고 CSS 는 체커를 남기고 Figma 는 투명으로 낸다).
     ★투명도(색칸의 %)는 «배경만» 흐리게 한다 — 안 ㉠(지디 확정 2026-10-04). 현빈 원문 「이미지가 아닌 프레임이 «채워지는» 거겠지?
       투명도도 조절되고」의 «채워지는» = 채움(배경) ⇒ 그 채움의 투명도. 원 안 자식·그림은 안 흐려진다.
       「원 전체」 투명도(㉡)는 현빈이 원하면 그때 얹는다(새 키 data-opacity — 지금은 없다). */
  const _fillOn  = !!circle && !!circle.style.backgroundColor && bgColor !== 'transparent';
  let   _lastFill = (bgColor && bgColor !== 'transparent') ? bgColor : '#e8e8e8';   // 끈 뒤 다시 켤 색(패널 지역 — 데이터 키 아님)
  const bgAlpha  = parseAlphaFromColor(_lastFill);
  const borderV  = block.dataset.border            || 'none';
  const radius   = parseInt(block.dataset.radius)  || 0;
  const padX     = parseInt(block.dataset.padX)    || 0;
  // ★「좌우 패딩」은 «죽은 속성이 아니다» — row 가 cols 일 때만 산다(실측 2026-09-05).
  //   stack(기본)에서는 블록이 행 폭으로 늘어나고 .icon-circle-block 이 justify-content:center
  //   + .icb-circle 이 flex-shrink:0 이라, «좌우 대칭» 패딩이 정확히 상쇄돼 원이 1px도 안 움직인다
  //   (padX 0/40/80/120/200 다섯 값에서 원 중심 720.0 고정·블록 폭 286.4 고정).
  //   → 값을 지우면 cols 에서 쓰던 사람이 잃는다. 그래서 «내리지 않고», 무효인 레이아웃에서만
  //     끄고 이유를 붙인다(prop-laurel/prop-banner02 의 opacity:0.4;pointer-events:none 관례).
  const _padXLive  = block.parentElement?.dataset.layout === 'cols';
  const _padXOff   = _padXLive ? '' : 'opacity:0.4;pointer-events:none;';
  const _padXTitle = _padXLive ? '' : ' title="이 행이 «가로 배치(cols)»일 때만 적용됩니다 — 세로 배치에서는 원이 가운데 정렬이라 좌우 패딩이 상쇄됩니다"';

  const hasImage = block.classList.contains('has-image');

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: gridCircleIconSvg({ size: 12, stroke: '#888' }),   // 그리드 칸 원형 이미지 svg 와 «같은 상수»(S2 2026-10-04)
      name: block.dataset.layerName,
      defaultName: 'Asset-Circle',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">지름</span>
        <input type="range" class="prop-slider" id="icb-size-slider" min="40" max="860" step="4" value="${size}">
        <input type="number" class="prop-number"  id="icb-size-number" min="40" max="860" value="${size}">
      </div>
      <div class="prop-row" style="${_padXOff}"${_padXTitle}>
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="icb-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="icb-padx-number" min="0" max="200" value="${padX}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="icb-rot-slider" min="-180" max="180" step="1" value="${parseInt(block.dataset.rotation || '0')}">
        <input type="number" class="prop-number" id="icb-rot-number" min="-180" max="180" value="${parseInt(block.dataset.rotation || '0')}">
      </div>
    </div>
    ${hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <button class="prop-action-btn secondary" id="icb-pos-btn">이미지 위치 조절</button>
      <button class="prop-action-btn secondary" id="icb-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="icb-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <button class="prop-action-btn primary" id="icb-upload-btn">이미지 선택</button>
      <div class="prop-hint" style="margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`}
    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-row">
        <span class="prop-label">채움</span>
        <label class="prop-toggle" title="끄면 원 바탕이 비어 있다(편집 화면에선 체크무늬 · 내보내기에선 투명)">
          <input type="checkbox" id="icb-fill-toggle" ${_fillOn ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-color-row" id="icb-bg-row" style="${_fillOn ? '' : 'opacity:0.4;'}">
        <span class="prop-label">배경</span>
        ${colorFieldHTML({ idPrefix: 'icb-bg', hex: _lastFill, alpha: bgAlpha })}
      </div>
    </div>
    <div class="prop-section" id="icb-kids-section" style="padding-bottom:4px;">
      <div class="prop-row" style="align-items:center;gap:6px;">
        <select class="prop-select" id="icb-kid-add-kind" style="flex:1 1 0;min-width:0;width:auto;"
                title="원 «안»에 블럭을 넣는다 — 글자는 원 안에서 고친다">
          <option value="">＋ 블럭 넣기 (원 안)…</option>
          ${_ICB_KID_KINDS.map(([k, ko]) => `<option value="${k}">+ ${ko}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Border</div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="icb-border-select">
          <option value="none"   ${borderV==='none'   ?'selected':''}>없음</option>
          <option value="solid"  ${borderV==='solid'  ?'selected':''}>실선</option>
          <option value="dashed" ${borderV==='dashed' ?'selected':''}>점선</option>
        </select>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  if (hasImage) {
    propPanel.querySelector('#icb-pos-btn').addEventListener('click', () => window.enterCircleImageEditMode(block));
    propPanel.querySelector('#icb-replace-btn').addEventListener('click', () => window.triggerCircleUpload(block));
    propPanel.querySelector('#icb-remove-btn').addEventListener('click', () => window.clearCircleImage(block));
  } else {
    propPanel.querySelector('#icb-upload-btn').addEventListener('click', () => window.triggerCircleUpload(block));
  }

  const applySize = v => {
    v = Math.min(860, Math.max(40, v));
    block.dataset.size     = v;
    circle.style.width     = v + 'px';
    circle.style.height    = v + 'px';   // height는 항상 width와 동일 — 단일 차원 경로 방어
    circle.style.aspectRatio = '1 / 1';  // 런타임 가드 — 부모 flex stretch로 squash되는 케이스 차단
    propPanel.querySelector('#icb-size-slider').value = v;
    propPanel.querySelector('#icb-size-number').value = v;
  };
  propPanel.querySelector('#icb-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  propPanel.querySelector('#icb-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); window.pushHistory(); });
  propPanel.querySelector('#icb-size-slider').addEventListener('change', () => window.pushHistory());

  const applyPadX = v => {
    v = Math.min(200, Math.max(0, v));
    block.dataset.padX         = v;
    block.style.paddingLeft    = v + 'px';
    block.style.paddingRight   = v + 'px';
    propPanel.querySelector('#icb-padx-slider').value = v;
    propPanel.querySelector('#icb-padx-number').value = v;
  };
  propPanel.querySelector('#icb-padx-slider').addEventListener('input',  e => applyPadX(parseInt(e.target.value)));
  propPanel.querySelector('#icb-padx-number').addEventListener('change', e => { applyPadX(parseInt(e.target.value)); window.pushHistory(); });
  propPanel.querySelector('#icb-padx-slider').addEventListener('change', () => window.pushHistory());

  // 회전 — 공유 헬퍼(applyRotationDeg, dataset.rotation)로 핫존(asset-rotate.js)과 동기
  const _icbRot = v => {
    v = Math.min(180, Math.max(-180, parseInt(v) || 0));
    window.applyRotationDeg?.(block, v);
    propPanel.querySelector('#icb-rot-slider').value = v;
    propPanel.querySelector('#icb-rot-number').value = v;
  };
  propPanel.querySelector('#icb-rot-slider').addEventListener('input',  e => _icbRot(e.target.value));
  propPanel.querySelector('#icb-rot-number').addEventListener('input',  e => _icbRot(e.target.value));
  propPanel.querySelector('#icb-rot-slider').addEventListener('change', () => window.pushHistory());
  propPanel.querySelector('#icb-rot-number').addEventListener('change', () => window.pushHistory());

  const _fillToggle = propPanel.querySelector('#icb-fill-toggle');
  const _bgRow = propPanel.querySelector('#icb-bg-row');
  const _paint = (c) => { block.dataset.bgColor = c; circle.style.backgroundColor = c; };
  wireColorField('icb-bg', {
    initialAlpha: bgAlpha,
    onApply: (c) => {
      _paint(c);
      _lastFill = c;
      // 색을 고르면 «채움 켬»이다 — 토글·흐림을 같이 맞춘다
      if (_fillToggle) _fillToggle.checked = true;
      if (_bgRow) _bgRow.style.opacity = '';
    },
    onCommit: () => window.pushHistory(),
  });
  /* G14 채움 켬/끔 — 끔 = 'transparent'(기존 값) · 켬 = 마지막 색(없으면 #e8e8e8). 히스토리는 «양쪽 끝»(js/CLAUDE.md). */
  _fillToggle?.addEventListener('change', () => {
    window.pushHistory();
    if (_fillToggle.checked) { _paint(_lastFill); if (_bgRow) _bgRow.style.opacity = ''; }
    else { _paint('transparent'); if (_bgRow) _bgRow.style.opacity = '0.4'; }
    window.pushHistory();
  });
  /* G14 「＋ 블럭 넣기 ▾」 — 고르면 바로 넣고 머리로 되돌린다(G19 그리드 「＋ 블럭 넣기 ▾」와 같은 꼴). */
  const _kidAdd = propPanel.querySelector('#icb-kid-add-kind');
  _kidAdd?.addEventListener('change', () => {
    const kind = _kidAdd.value;
    _kidAdd.value = '';
    if (!kind) return;
    window.addCircleChild?.(block, kind);
  });

  propPanel.querySelector('#icb-border-select').addEventListener('change', e => {
    block.dataset.border   = e.target.value;
    circle.dataset.border  = e.target.value;
    window.pushHistory();
  });
}


window.showIconCircleProperties = showIconCircleProperties;
