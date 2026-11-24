import { propPanel, state } from '../globals.js';
import { blockHeaderHTML, rotRowHTML, wireRotRow } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { gridCircleIconSvg } from '../blocks/grid-circle-icon.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { strokeSectionHTML, strokeHeadToolsHTML, wireStrokeSection, STROKE_STYLES_SVG, STROKE_POP_WHY } from './_stroke-section.js';
import { fillSectionHTML, fillHeadToolsHTML, wireFillSection, fillLast } from './_fill-section.js';

/* G14 「＋ 블럭 넣기 ▾」 종류·이름표 — 정본은 js/icb-children.js(ICB_CHILD_KIND_LABELS · t5-12ⓑ 그리드 원 줄 패널과 한 벌). */
import { ICB_CHILD_KIND_LABELS as _ICB_KID_KINDS } from '../icb-children.js';

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
  const ICB_BW_DEF = 3;   // css/editor-blocks.css .icb-circle[data-border] 의 옛 고정 굵기
  const _icbBcDef = (circle ? getComputedStyle(circle).getPropertyValue('--ui-border').trim() : '') || '#333333';   // 옛 고정 색 = 편집기 토큰이 지금 그리는 값(실측 · 읽기만)
  const _icbBw = block.dataset.borderW != null ? (parseFloat(block.dataset.borderW) || 0) : ICB_BW_DEF;
  const _icbBc = block.dataset.borderColor || _icbBcDef;
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

  renderPanel(block, {
    header: blockHeaderHTML({
      icon: gridCircleIconSvg({ size: 12, stroke: '#888' }),   // 그리드 칸 원형 이미지 svg 와 «같은 상수»(S2 2026-10-04)
      name: block.dataset.layerName,
      defaultName: 'Asset-Circle',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    }),
    sections: [
      sec('size', `
      <div class="prop-row">
        <span class="prop-label">지름</span>
        <input type="range" class="prop-slider" id="icb-size-slider" min="40" max="860" step="4" value="${size}">
        <input type="number" class="prop-number"  id="icb-size-number" min="40" max="860" value="${size}">
      </div>`),
      sec('padding', `
      <div class="prop-row" style="${_padXOff}"${_padXTitle}>
        <span class="prop-label">좌우패딩</span>
        <input type="range" class="prop-slider" id="icb-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="icb-padx-number" min="0" max="200" value="${padX}">
      </div>`),
      sec('position', `
      <span class="prop-field-label">Rotation</span>${rotRowHTML({ p: 'icb', numberId: 'icb-rot-number', value: parseInt(block.dataset.rotation || '0'), flipH: block.dataset.flipH === '1', flipV: block.dataset.flipV === '1' })}`, { headTools: window.overlayToggleBtnHTML?.({ id: 'icb-float-toggle', active: block.dataset.overlayBlock === 'true' }) || '' }),   // 플로팅 = Position(§2-1)
      // 옛 「Image」 절 + 원 안 블럭 넣기 = Content
      sec('content', `${hasImage ? `
      <button class="prop-action-btn secondary" id="icb-pos-btn">이미지 위치 조절</button>
      <button class="prop-action-btn secondary" id="icb-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="icb-remove-btn">이미지 제거</button>
      ${window.circleSampleRowHTML?.(block) || ''}
      <div class="prop-row">
        <span class="prop-label">내용 자르기</span>
        <label class="prop-toggle">
          <input type="checkbox" id="icb-clip-toggle" ${window.clipsContent?.(block) !== false ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>` : `
      <button class="prop-action-btn primary" id="icb-upload-btn">이미지 선택</button>
      <div class="prop-hint" style="margin-top:6px;">또는 블록에 파일을 드래그</div>
      ${window.circleSampleRowHTML?.(block) || ''}
      <div class="prop-row">
        <span class="prop-label">내용 자르기</span>
        <label class="prop-toggle">
          <input type="checkbox" id="icb-clip-toggle" ${window.clipsContent?.(block) !== false ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>`}
      <div id="icb-kids-section">
      <div class="prop-row" style="align-items:center;gap:6px;">
        <select class="prop-select" id="icb-kid-add-kind" style="flex:1 1 0;min-width:0;width:auto;"
                title="원 «안»에 블럭을 넣는다 — 글자는 원 안에서 고친다">
          <option value="">＋ 블럭 넣기 (원 안)…</option>
          ${_ICB_KID_KINDS.map(([k, ko]) => `<option value="${k}">+ ${ko}</option>`).join('')}
        </select>
      </div>
      </div>`),
      sec('fill', fillSectionHTML({ prefix: 'icb-fill', on: _fillOn, colorHtml: colorFieldHTML({ idPrefix: 'icb-bg', hex: _lastFill, alpha: bgAlpha }) }),
        { headTools: fillHeadToolsHTML({ prefix: 'icb-fill', on: _fillOn }) }),   // 표준 Fill F2-3 — 옛 «채움» 토글(icb-fill-toggle) → 머리 ＋ / 줄 −(없음 = 'transparent' = 옛 끔 값 · 편집 = 체커 · Figma 투명)
      /* ★표준 Stroke 부품(현빈 261123 · 8910 strokestd2 4) — 없음 = data-border none(옛 키 · 옛 «없음» 고르기 그대로) · 머리 ＋ = 실선
         ★새 키 2(지디 261123 (가)): borderW·borderColor — 기본(3px · 편집기 토큰 --ui-border 가 지금 그리는 색)과 다를 때만 저장 → 옛 저장본 바이트 무변
         위치 = 안쪽 막힘(CSS border + 전역 box-sizing:border-box) · 옛 «스타일» select = line-style 슬롯(실선·점선 · 단계 3 팝오버로) */
      sec('stroke', strokeSectionHTML({ prefix: 'icb-stroke', color: _icbBc, alpha: parseAlphaFromColor(_icbBc), width: _icbBw, maxWidth: 20, align: 'inside', canAlign: false,
        alignWhy: '위치(안쪽·가운데·바깥) — 곧 지원 · 지금은 안쪽', on: borderV !== 'none',
        pop: { styles: STROKE_STYLES_SVG, style: borderV === 'none' ? 'solid' : borderV, styleId: 'icb-border-select', why: STROKE_POP_WHY.css } }),   // 단계 3-1: «스타일» = ⫶ 팝오버(옛 id icb-border-select · 실선·점선 — 이 블럭엔 «점» 없었음 · 옛 change 배선 그대로)
        { headTools: strokeHeadToolsHTML({ prefix: 'icb-stroke', on: borderV !== 'none' }) }),
    ],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  /* B1 — 오버레이(플로팅) 토글: prop-iconify.js 와 «같은» 공용 길(js/overlay-float.js · posElOf = 서클 «자기 자신»).
     ⛔정적 import 안 한다(같은 까닭 — unit 하네스 축소 복사). 원 안 자식(G14)은 블럭 안이라 통째로 뜬다. */
  window.wireFloatToggle?.({ block, buttonId: 'icb-float-toggle', rerender: () => showIconCircleProperties(block) });
  /* 프로토 Z6-C — 샘플 그림 줄(js/radial-arrange.js · 배치 프레임의 칸에서만 나온다). */
  window.wireCircleSampleRow?.(block, () => showIconCircleProperties(block));

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
  const _icbRot = (v, typing) => {
    v = Math.min(180, Math.max(-180, parseInt(v) || 0));
    window.applyRotationDeg?.(block, v);
    if (!typing) propPanel.querySelector('#icb-rot-number').value = v;
  };
  propPanel.querySelector('#icb-rot-number').addEventListener('input',  e => _icbRot(e.target.value, true));   // QA2 M4 — 치는 중엔 칸을 다시 안 쓴다(«-30» 을 칠 수 있게) · 끝낼 때(change) 범위로 정규화
  propPanel.querySelector('#icb-rot-number').addEventListener('change', e => _icbRot(e.target.value));
  wireRotRow({ p: 'icb', numberId: 'icb-rot-number', host: () => block });   // Q17 · Q20(시안 v10 — 슬라이더 없음)
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
  /* 표준 Fill F2-3 — 옛 토글 자리: − = 'transparent' · ＋ = 지난 색(fillLast · 없으면 옛 _lastFill = 칠했던 색 또는 #e8e8e8) · 이력 «양쪽 끝» 그대로(앞 = 여기 · 뒤 = 부품 commit) */
  wireFillSection({ prefix: 'icb-fill', adapter: {
    none: () => { window.pushHistory(); fillLast.set(block.id, _lastFill); _paint('transparent'); showIconCircleProperties(block); },
    add: () => { window.pushHistory(); _paint(fillLast.get(block.id, _lastFill)); showIconCircleProperties(block); },
    commit: () => window.pushHistory() } });
  /* Q11(현빈 261112) «내용 자르기» — 에셋(prop-asset.js asset-clip-toggle)과 같은 꼴: 기본값과 같으면 키를 지운다(옛 바이트) · 그리기는 applyIcbClip 한 자리. */
  propPanel.querySelector('#icb-clip-toggle')?.addEventListener('change', e => {
    window.pushHistory?.('서클 내용 자르기');
    const want = !!e.target.checked;
    if (want === window.CLIP_DEFAULTS?.icb) delete block.dataset.clipContent;
    else block.dataset.clipContent = want ? 'true' : 'false';
    window.applyIcbClip?.(block);
    window.scheduleAutoSave?.();
  });
  /* G14 「＋ 블럭 넣기 ▾」 — 고르면 바로 넣고 머리로 되돌린다(G19 그리드 「＋ 블럭 넣기 ▾」와 같은 꼴). */
  const _kidAdd = propPanel.querySelector('#icb-kid-add-kind');
  _kidAdd?.addEventListener('change', () => {
    const kind = _kidAdd.value;
    _kidAdd.value = '';
    if (!kind) return;
    window.addCircleChild?.(block, kind);
  });

  /* 표준 Stroke 부품 배선 — 원에 변수(--icb-bw/--icb-bc)는 키가 있을 때만(기본과 같으면 키·변수 둘 다 지움 = 옛 저장본 그대로) */
  const _icbSetBorder = (v) => { block.dataset.border = v; if (circle) circle.dataset.border = v; };
  const _icbVar = (key, cssVar, val, isDef) => {
    if (isDef) { delete block.dataset[key]; circle?.style.removeProperty(cssVar); if (circle?.getAttribute('style') === '') circle.removeAttribute('style'); }
    else { block.dataset[key] = String(val); circle?.style.setProperty(cssVar, cssVar === '--icb-bw' ? `${val}px` : val); }
  };
  wireStrokeSection({ prefix: 'icb-stroke', alpha: parseAlphaFromColor(_icbBc), maxWidth: 20, onWidth: ICB_BW_DEF,
    adapter: {
      color: (c) => _icbVar('borderColor', '--icb-bc', c, String(c).toLowerCase() === _icbBcDef.toLowerCase()),
      width: (v) => { if ((block.dataset.border || 'none') === 'none') _icbSetBorder(propPanel.querySelector('#icb-border-select')?.value || 'solid'); _icbVar('borderW', '--icb-bw', v, v === ICB_BW_DEF); },
      none: () => _icbSetBorder('none'),   // 없음 = 옛 «없음» 그대로(굵기·색 키는 남김 → 다시 켜면 그 굵기·색)
      commit: () => window.pushHistory(),
    } });
  propPanel.querySelector('#icb-border-select').addEventListener('change', e => {
    _icbSetBorder(e.target.value);
    window.pushHistory();
  });
}


window.showIconCircleProperties = showIconCircleProperties;
