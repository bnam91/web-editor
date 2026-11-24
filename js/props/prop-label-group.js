import { propPanel } from '../globals.js';
import { blockHeaderHTML, escHtml } from './_helpers.js';
import { renderPanel, sec, hintHTML } from './_panel-frame.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { panelRenderedPx } from './_panel-rendered.js';
import {
  LABEL_BUILTIN_PRESETS, LABEL_USER_PREFIX, listLabelUserPresets, addLabelUserPreset, updateLabelUserPreset, removeLabelUserPreset,
  resolveLabelPreset, readLabelStyle, applyLabelStyleToItem, applyLabelStyleToBlock,
} from '../label-presets.js';
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance(A3)
import { layoutSizeRowHTML, layoutGapSlotHTML, wireLayoutSection } from './_layout-section.js';   // 표준 Layout(L2~L4 · C3)

/** 단일 label-item에 스타일 프리셋 적용 — 기본 4종 또는 'user:<id>'(t3-01 내 프리셋) */
function _applyPresetToItem(item, presetName) {
  const s = resolveLabelPreset(presetName);
  if (!s) return;
  // B1 — 프리셋을 «직접» 입히면 라벨 모양 변수 연결은 끊는다(값을 손으로 정한 것이 이긴다 · 변수가 나중에 덮지 않게)
  if (item.dataset.labelShape) { delete item.dataset.labelShape; item.style.clipPath = ''; }
  applyLabelStyleToItem(item, s);
}
/* t3-01 — 패널을 다시 그려도 마지막에 고른 프리셋을 select 에 남긴다(저장·이름 변경 뒤 그 항목을 계속 가리키게). */
let _lgLastPreset = 'Default';

function showLabelGroupProperties(block, selectedItem) {
  const isAbsolute = block.style.position === 'absolute';
  const currentW   = parseInt(block.style.width)  || Math.round(block.offsetWidth);
  const currentX   = parseInt(block.style.left)   || 0;
  const currentY   = parseInt(block.style.top)    || 0;
  const gap        = parseInt(block.style.gap) || 10;
  const jc         = block.style.justifyContent || 'flex-start';
  const align      = jc === 'center' ? 'center' : jc === 'flex-end' ? 'right' : 'left';
  const firstItem  = block.querySelector('.label-item');
  /* 묶음 B E112 — 항목 높이 = «그려진» 위아래 패딩(_panel-rendered.js). 옛 `|| 4` 는 인라인이 비면 8 을 그렸다 — 실제 CSS .label-item 11+11=22(원형 20+20). */
  const allItemPadT = Math.round(panelRenderedPx(firstItem, 'paddingTop'));
  const allItemPadB = Math.round(panelRenderedPx(firstItem, 'paddingBottom'));
  const allItemH   = allItemPadT + allItemPadB;
  const itemBg     = selectedItem?.dataset.bg     || '#111111';
  const itemColor  = selectedItem?.dataset.color  || '#ffffff';
  const itemBgAlpha    = parseAlphaFromColor(itemBg);
  const itemColorAlpha = parseAlphaFromColor(itemColor);
  const itemRadius = parseInt(selectedItem?.dataset.radius ?? 40);
  const itemPadT   = Math.round(panelRenderedPx(selectedItem, 'paddingTop'));      // E112
  const itemPadB   = Math.round(panelRenderedPx(selectedItem, 'paddingBottom'));
  const itemH      = itemPadT + itemPadB;
  /* B1 — 라벨 «모양 변수»(좌측 Design System) — 고른 칸이 변수를 쓰면 배경·글자·모서리 대신 «변수 ‹이름› 사용 중 · 끊기 · 바꾸기» */
  const _shapes    = window.DesignSystem?.getLabelShapes?.().shapes || {};
  const _shapeNames = Object.keys(_shapes);
  const boundName  = selectedItem?.dataset.labelShape && _shapes[selectedItem.dataset.labelShape] ? selectedItem.dataset.labelShape : null;
  const _shapeOpts = (cur) => _shapeNames.map((n) => `<option value="${escHtml(n)}"${n === cur ? ' selected' : ''}>${escHtml(n)}</option>`).join('');
  const userPresets = listLabelUserPresets();

  /* ★U2(right-panel-unify) — 절은 틀이 그린다. 옛 「Selected Tag」 한 절을 소유대로 갈랐다(고른 태그 배경·글자 = Fill ·
     모서리 = Appearance · 높이 = Size) — 라벨에 「태그」를 붙여 «전체» 높이와 가른다. id 는 그대로. */
  renderPanel(block, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="3" width="4" height="6" rx="3"/>
            <rect x="7" y="3" width="4" height="6" rx="3"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Tags',
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: block.id,
    }),
    sections: [
      sec('kind', `
      <div class="prop-row">
        <span class="prop-label">Preset</span>
        <select class="prop-select" id="lg-style-select">
          <optgroup label="기본">${Object.keys(LABEL_BUILTIN_PRESETS).map((k) => `
            <option value="${k}">${k}</option>`).join('')}
          </optgroup>${userPresets.length ? `
          <optgroup label="내 프리셋">${userPresets.map((p) => `
            <option value="${LABEL_USER_PREFIX}${escHtml(p.id)}">★ ${escHtml(p.name)}</option>`).join('')}
          </optgroup>` : ''}
        </select>
      </div>
      <div class="prop-row">
        <button class="prop-action-btn primary" id="lg-apply-all-btn">전체 적용</button>
        <button class="prop-action-btn secondary" id="lg-preset-save-btn" title="고른 태그(없으면 첫 태그)의 꼴을 내 프리셋으로 저장">현재 꼴 저장</button>
      </div>
      <div class="prop-row" id="lg-preset-user-row" style="display:none">
        <button class="prop-action-btn secondary" id="lg-preset-overwrite-btn" title="이 프리셋을 지금 꼴로 덮어쓴다">덮어쓰기</button>
        <button class="prop-action-btn secondary" id="lg-preset-rename-btn">이름 변경</button>
        <button class="prop-action-btn danger" id="lg-preset-delete-btn">삭제</button>
      </div>
      <div class="prop-row" id="lg-preset-name-row" style="display:none">
        <input type="text" class="prop-text" id="lg-preset-name-input" maxlength="40" placeholder="프리셋 이름" aria-label="프리셋 이름">
        <button class="prop-action-btn primary" id="lg-preset-name-ok" style="flex:0 0 52px;margin-top:0">확인</button>
        <button class="prop-action-btn secondary" id="lg-preset-name-cancel" style="flex:0 0 52px;margin-top:0">취소</button>
      </div>${selectedItem ? '' : `
      ${hintHTML('태그를 눌러 색 바꾸기')}`}`),   /* R8ⓐ(현빈 261123) 한국어 UI 의 유일한 영어 힌트 → 한국어 · 안 골랐을 땐 Fill 절이 없다(컨트롤 0 절 금지 · 게이트 빈 머리 검사) — 안내는 여기 */
      sec('position', !isAbsolute ? '' : `
      <div class="prop-lhls-row">
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">X</span>
            <input type="number" id="lg-x-number" value="${currentX}" aria-label="X position">
          </div>
        </div>
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">Y</span>
            <input type="number" id="lg-y-number" value="${currentY}" aria-label="Y position">
          </div>
        </div>
      </div>`),
      /* ★표준 Layout(현빈 261124 L-4/7 · C3) — 옛 슬라이더 걷음 · 숫자 칸 id·범위 무변 · 높이 = 태그 상하 패딩이라 W/H 짝 아님 → 한 칸씩(사슬 없음) */
      sec('size', (!isAbsolute ? '' : layoutSizeRowHTML({ prefix: 'lg-w', one: { id: 'lg-width-number', label: 'Width', min: 40, max: 860, value: currentW } }))
        + layoutSizeRowHTML({ prefix: 'lg-all-h', one: { id: 'lg-all-height-number', label: '전체 높이', icon: 'h', min: 0, max: 120, value: allItemH } })
        + (!selectedItem ? '' : layoutSizeRowHTML({ prefix: 'lg-item-h', one: { id: 'lg-item-height-number', label: '태그 높이', icon: 'h', min: 0, max: 120, value: itemH } }))),
      sec('layout', `
      <div class="prop-align-group">
        <button class="prop-align-btn ${align==='left'?'active':''}" data-align="left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${align==='center'?'active':''}" data-align="center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${align==='right'?'active':''}" data-align="right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
      ${layoutGapSlotHTML({ id: 'lg-gap-number', value: gap, max: 60 })}`),
      /* B1(dev) — 고른 태그가 «모양 변수»를 쓰면 모서리·색 대신 «변수 사용 중 · 끊기 · 바꾸기»(모양 = Appearance) · 색 칸은 끊어야 생긴다 */
      /* A4 Opacity(블럭 · 계약 window.readBlockOpacity) — 태그 모서리·모양 변수는 고른 태그가 있을 때만 */
      sec('appearance', appearanceSectionHTML({ prefix: 'lg', op: { value: window.readBlockOpacity?.(block) ?? 100 } }) + (!selectedItem ? '' : boundName ? `
      <div class="prop-row" id="lg-shape-bound" data-shape="${escHtml(boundName)}">
        <span class="prop-hint" style="flex:1;padding:0">모양: 변수 <b>${escHtml(boundName)}</b> 사용 중</span>
        <button class="prop-btn" id="lg-shape-unlink" style="width:auto;padding:0 8px" title="지금 모양 그대로 이 칸에 박고 변수 연결을 끊는다(끊어야 색·모서리를 따로 고칠 수 있다)">끊기</button>
      </div>
      ${_shapeNames.length > 1 ? `<div class="prop-row"><span class="prop-label">바꾸기</span><select class="prop-select" id="lg-shape-switch">${_shapeOpts(boundName)}</select></div>` : ''}` : `
      ${appearanceSectionHTML({ prefix: 'lg-item', radius: { numberId: 'lg-item-radius-number', value: itemRadius, max: 50 } })}   <!-- ★표준 Appearance A3(현빈 261124 · 시안 #mkp-appstd) — 옛 슬라이더 걷음 · 숫자 칸 id·키·범위 무변 -->
      ${_shapeNames.length ? `<div class="prop-row"><span class="prop-label">모양 변수</span><select class="prop-select" id="lg-shape-link"><option value="">연결 안 함</option>${_shapeOpts('')}</select></div>` : ''}`), selectedItem ? { headTools: appearanceHeadToolsHTML({ prefix: 'lg-item' }) } : {}),
      sec('fill', (!selectedItem || boundName) ? '' : `
      <div class="prop-color-row">
        <span class="prop-label">태그 배경</span>
        ${colorFieldHTML({ idPrefix: 'lg-item-bg', hex: itemBg, alpha: itemBgAlpha })}
      </div>
      <div class="prop-color-row">
        <span class="prop-label">태그 글자</span>
        ${colorFieldHTML({ idPrefix: 'lg-item-color', hex: itemColor, alpha: itemColorAlpha })}
      </div>`),
    ],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 정렬
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.align;
      block.style.justifyContent = a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start';
      propPanel.querySelectorAll('.prop-align-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 간격
  wireLayoutSection({ w: { numberId: 'lg-gap-number', max: 60, apply: (v) => { block.style.gap = v + 'px'; } } });

  // 전체 태그 높이 일괄 조절
  const setAllItemH = v => {
    const half = Math.round(v / 2);
    block.querySelectorAll('.label-item').forEach(item => {
      item.style.paddingTop    = half + 'px';
      item.style.paddingBottom = half + 'px';
    });
  };
  wireLayoutSection({ w: { numberId: 'lg-all-height-number', max: 120, apply: setAllItemH } });

  // ── 스타일 프리셋 드롭다운 (C17) ───────────────────────────────────
  const styleSelect = document.getElementById('lg-style-select');
  const applyAllBtn = document.getElementById('lg-apply-all-btn');

  // 드롭다운 변경 시 선택된 태그에만 즉시 적용
  styleSelect?.addEventListener('change', () => {
    if (!selectedItem) return;
    window.pushHistory?.();
    _applyPresetToItem(selectedItem, styleSelect.value);
    // 컬러 픽커 동기화
    const bgPicker2 = document.getElementById('lg-item-bg-color');
    const bgHex2    = document.getElementById('lg-item-bg-hex');
    const colorPicker2 = document.getElementById('lg-item-color-color');
    const colorHex2    = document.getElementById('lg-item-color-hex');
    const p = resolveLabelPreset(styleSelect.value);
    if (p) {
      const hex6 = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff');   // rgba·transparent 는 색 칸이 못 받는다(옛 동작 그대로)
      const bgVal = hex6(p.bg), colorVal = hex6(p.color);
      if (bgPicker2) bgPicker2.value = bgVal;
      if (bgHex2)    bgHex2.value    = bgVal.replace('#','').toUpperCase();
      if (colorPicker2) colorPicker2.value = colorVal;
      if (colorHex2)    colorHex2.value    = colorVal.replace('#','').toUpperCase();
    }
  });

  // C18: 전체 적용 버튼 — 캔버스 전체 label-group-block의 모든 label-item에 적용
  applyAllBtn?.addEventListener('click', () => {
    window.pushHistory?.();
    const presetName = styleSelect?.value || 'Default';
    const canvas = document.getElementById('canvas') || document.querySelector('.canvas-area') || document.body;
    canvas.querySelectorAll('.label-group-block .label-item').forEach(item => {
      _applyPresetToItem(item, presetName);
    });
    // t3-01 내 프리셋은 블럭 꼴(모양·간격)까지 — 기본 4종엔 그 키가 없어 무동작
    const userStyle = presetName.startsWith(LABEL_USER_PREFIX) ? resolveLabelPreset(presetName) : null;
    if (userStyle) canvas.querySelectorAll('.label-group-block').forEach(b => applyLabelStyleToBlock(b, userStyle));
    // CSS 변수도 업데이트 (design-system 연동) — 기본 4종만(내 프리셋은 디자인 토큰을 안 바꾼다)
    const p = LABEL_BUILTIN_PRESETS[presetName];
    if (p && window.DesignSystem) {
      const tokens = {
        '--preset-label-bg':    p.bg === 'transparent' ? 'transparent' : p.bg,
        '--preset-label-color': p.color,
      };
      document.documentElement.style.setProperty('--preset-label-bg', tokens['--preset-label-bg']);
      document.documentElement.style.setProperty('--preset-label-color', tokens['--preset-label-color']);
    }
  });

  _wireLabelUserPresets(block, selectedItem, styleSelect);

  wireAppearanceSection({ op: { numberId: 'lg-opacity', apply: (v) => window.setBlockOpacity?.(block, v), commit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); } } });   // A4 — ★태그 안 골라도 블럭 칸(아래 «태그 없으면 return» 앞)
  if (!selectedItem) return;

  // 아이템 배경색
  wireColorField('lg-item-bg', {
    initialAlpha: itemBgAlpha,
    onApply: (c) => { selectedItem.style.backgroundColor = c; selectedItem.dataset.bg = c; },
    onCommit: () => window.pushHistory?.(),
  });

  // 아이템 글자색
  wireColorField('lg-item-color', {
    initialAlpha: itemColorAlpha,
    onApply: (c) => { selectedItem.style.color = c; selectedItem.dataset.color = c; },
    onCommit: () => window.pushHistory?.(),
  });

  // 모서리
  if (selectedItem) wireAppearanceSection({ radius: { numberId: 'lg-item-radius-number', max: 50, apply: (v) => { selectedItem.style.borderRadius = v + 'px'; selectedItem.dataset.radius = v; }, commit: () => window.pushHistory?.() } });   // 표준 Appearance A3(슬라이더 걷음 · 모양 변수에 묶이면 칸 없음 = 무동작)

  // B1 — 모양 변수 끊기·바꾸기·연결 (변수 값은 좌측 Design System 에서 고친다)
  const _rebind = (name) => {
    window.pushHistory?.();
    if (name) window.LabelShape?.bindLabelItem(selectedItem, name, _shapes[name]);
    else if (boundName) window.LabelShape?.unbindLabelItem(selectedItem, _shapes[boundName]);
    window.scheduleAutoSave?.();
    showLabelGroupProperties(block, selectedItem);
  };
  document.getElementById('lg-shape-unlink')?.addEventListener('click', () => _rebind(null));
  document.getElementById('lg-shape-switch')?.addEventListener('change', (e) => _rebind(e.target.value));
  document.getElementById('lg-shape-link')?.addEventListener('change', (e) => { if (e.target.value) _rebind(e.target.value); });

  // 태그 높이 (상하 패딩으로 조절)
  const setItemH = v => {
    const half = Math.round(v / 2);
    selectedItem.style.paddingTop    = half + 'px';
    selectedItem.style.paddingBottom = half + 'px';
  };
  if (selectedItem) wireLayoutSection({ w: { numberId: 'lg-item-height-number', max: 120, apply: setItemH } });

  // 너비 / 위치 (서브섹션 내 absolute 전용)
  if (isAbsolute) {
    wireLayoutSection({ w: { numberId: 'lg-width-number', min: 40, max: 860, apply: (v) => { block.style.width = v + 'px'; } } });

    const xNum = document.getElementById('lg-x-number');
    const yNum = document.getElementById('lg-y-number');
    xNum?.addEventListener('input', () => { block.style.left = (parseInt(xNum.value) || 0) + 'px'; });
    xNum?.addEventListener('change', () => window.pushHistory?.());
    yNum?.addEventListener('input', () => { block.style.top  = (parseInt(yNum.value) || 0) + 'px'; });
    yNum?.addEventListener('change', () => window.pushHistory?.());
  }
}

/* ── t3-01 내 프리셋: 등록·덮어쓰기·이름 변경·삭제 ─────────────────────────
 * 문서 변경이 아니라 «앱 설정» 쓰기라 pushHistory 하지 않는다(⌘Z 대상 아님) · prompt()/confirm() 금지(렌더러 멈춤) — 인라인 이름 줄 · 삭제는 두 번 눌러 확인. */
function _wireLabelUserPresets(block, selectedItem, styleSelect) {
  const $ = (id) => document.getElementById(id);
  const userRow = $('lg-preset-user-row'), nameRow = $('lg-preset-name-row'), nameInput = $('lg-preset-name-input');
  const delBtn = $('lg-preset-delete-btn');
  if (!styleSelect || !userRow || !nameRow || !nameInput) return;
  if ([...styleSelect.options].some((o) => o.value === _lgLastPreset)) styleSelect.value = _lgLastPreset;
  const curUserId = () => (styleSelect.value.startsWith(LABEL_USER_PREFIX) ? styleSelect.value.slice(LABEL_USER_PREFIX.length) : null);
  const syncUserRow = () => {
    userRow.style.display = curUserId() ? '' : 'none';
    if (delBtn) { delBtn.textContent = '삭제'; delBtn.dataset.armed = ''; }
  };
  syncUserRow();
  styleSelect.addEventListener('change', () => { _lgLastPreset = styleSelect.value; syncUserRow(); });

  const source = () => selectedItem || block.querySelector('.label-item');
  const rerender = (keep) => { _lgLastPreset = keep; window.showLabelGroupProperties(block, selectedItem); };
  const failToast = () => window.showToast?.('프리셋을 저장하지 못했습니다(저장소 쓰기 실패)');
  let mode = null;   // 'add' | 'rename'
  const openName = (m, value) => { mode = m; nameRow.style.display = ''; nameInput.value = value; nameInput.focus(); nameInput.select(); };
  const closeName = () => { mode = null; nameRow.style.display = 'none'; };
  const submit = () => {
    const name = nameInput.value.trim();
    if (!name) { window.showToast?.('이름을 입력하세요'); nameInput.focus(); return; }
    if (mode === 'add') {
      const it = source();
      if (!it) { window.showToast?.('태그가 없어 저장할 꼴이 없습니다'); return; }
      const p = addLabelUserPreset(name, readLabelStyle(it, block));
      if (!p) { failToast(); return; }
      window.showToast?.(`내 프리셋 «${p.name}» 저장`);
      rerender(LABEL_USER_PREFIX + p.id);
    } else if (mode === 'rename') {
      const id = curUserId();
      if (!id || !updateLabelUserPreset(id, { name })) { failToast(); return; }
      rerender(LABEL_USER_PREFIX + id);
    }
  };
  $('lg-preset-save-btn')?.addEventListener('click', () => openName('add', ''));
  $('lg-preset-rename-btn')?.addEventListener('click', () => {
    const id = curUserId();
    const cur = listLabelUserPresets().find((p) => p.id === id);
    if (cur) openName('rename', cur.name);
  });
  $('lg-preset-name-ok')?.addEventListener('click', submit);
  $('lg-preset-name-cancel')?.addEventListener('click', closeName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeName(); }
    e.stopPropagation();   // 이름 치는 동안 캔버스 단축키(⌫ 삭제 등)가 안 먹게
  });
  $('lg-preset-overwrite-btn')?.addEventListener('click', () => {
    const id = curUserId(); const it = source();
    if (!id || !it) return;
    if (!updateLabelUserPreset(id, { style: readLabelStyle(it, block) })) { failToast(); return; }
    window.showToast?.('내 프리셋을 지금 꼴로 덮어썼습니다');
  });
  delBtn?.addEventListener('click', () => {
    const id = curUserId();
    if (!id) return;
    if (delBtn.dataset.armed !== '1') { delBtn.dataset.armed = '1'; delBtn.textContent = '삭제?'; return; }
    if (!removeLabelUserPreset(id)) { failToast(); return; }
    rerender('Default');
  });
}

window.showLabelGroupProperties = showLabelGroupProperties;
