import { propPanel } from '../globals.js';
import { blockHeaderHTML, escHtml, sliderRowHTML } from './_helpers.js';
import { forgetLabelAutoColor } from './label-auto-color.js';
import { wireHexText, parseHex6, formatHex6 } from './color-picker.js';
import { pushHistory, PRESETS, _presetsReady, rgbToHex, getBlockBreadcrumb } from '../editor.js';
import { alignFlowBlock } from './prop-multisel.js';
import { collectBulkAlignTargets } from './bulk-align-targets.js';
/* ★띠 변수의 «거두기»는 prop-page.js 한 벌에서 온다 — 여기서 이름 명부를 다시 적지 않는다.
   (그 파일이 패딩 비주얼 on/off 의 «단일 진실원»이기도 하다. 순환 없음: prop-page 는 이 파일을 안 부른다.) */
import { sweepPadHintVars } from './prop-page.js';

/* ═══════════════════════════════════
   SECTION PROPERTIES PANEL
═══════════════════════════════════ */

/* ═══════════════════════════════════
   좌우 패딩 힌트 — 만지는 «동안»만 띠를 비춘다
   그리는 쪽: css/editor-canvas.css 의 `body.gdt-pad-on .section-inner::before`.
     테두리 «두께»가 곧 패딩 폭이라 여기선 계산이 없다 — 변수만 넘긴다.
   ★변수는 «그 섹션의 inner 에» 박는다. body 에 박으면 섹션마다 패딩이 다른데도
     모든 섹션이 같은 띠를 쓰게 된다. 변수를 안 가진 섹션은 0px 라 저절로 안 보인다.
   ★400ms 뒤 클래스와 «변수까지» 지운다. 변수를 남기면 인라인 style 이라
     getSerializedCanvas(= clone.innerHTML)를 타고 «프로젝트 파일»에 실린다.
     옆집 그리드 가이드가 DOM 을 전혀 안 건드리는 이유가 바로 그것이다.
     autoSave 디바운스가 1500ms 라 400ms 청소가 «먼저» 끝난다.
═══════════════════════════════════ */
let _padHintTimer = null;
/* ★띠를 거두는 «문»은 하나다 — 좌우(_showPadXHint)와 아래(_showPadBHint)가 ★같이 쓴다.
   ⚠️★타이머도 한 벌이어야 한다: 좌우를 만지다 아래를 만지면 ★뒤 타이머가 앞을 이어받는다.
     따로 두면 앞 타이머가 «둘 다»의 클래스(gdt-pad-on)를 먼저 꺼서 ★뒤 띠가 사라진다.
   ★400ms — 이 수를 두 군데 적지 않으려고 여기 한 줄로 모았다.
   ★변수 이름 명부는 ⛔적지 않는다: sweepPadHintVars 가 `--gdt-pad-` 접두사로 걷는다
     (prop-page.js 그 함수 머리말 — 요소 명부도 같이 없앤 까닭이 적혀 있다). */
function _schedulePadHintClear() {
  clearTimeout(_padHintTimer);
  _padHintTimer = setTimeout(() => {
    document.body.classList.remove('gdt-pad-on');
    sweepPadHintVars();
  }, 400);
}
function _showPadXHint(inner, v) {
  /* ★꺼져 있으면 «아예 아무것도 안 한다» — 클래스도, 변수도 안 붙는다.
     ⇒ 끈 상태에서는 거둘 것도 새어나갈 것도 없다(저장 경합 자체가 생기지 않는다).
     ★기본은 «켜짐». 그 판단은 prop-page.js 의 readPadHintOn 한 곳에만 있다 —
       여기서 localStorage 를 다시 읽으면 기본값이 두 벌이 되어 언젠가 갈린다.
     ⛔`!window.readPadHintOn?.()` 로 쓰지 마라 — 함수가 아직 없을 때(로드 순서)
       「꺼짐」으로 읽혀 기본값이 뒤집힌다. «있고 그게 false 일 때»만 접는다. */
  if (window.readPadHintOn && window.readPadHintOn() === false) return;
  inner.style.setProperty('--gdt-pad-l', v + 'px');
  inner.style.setProperty('--gdt-pad-r', v + 'px');
  document.body.classList.add('gdt-pad-on');
  /* 섹션을 빠르게 갈아타며 만졌을 수 있다 — 거두기는 «남은 변수 전부»를 걷는다(공용 한 벌). */
  _schedulePadHintClear();
}

/* ═══════════════════════════════════
   ★아래 패딩 띠 — 만지는 «동안»만 (2026-10-07 현빈 ①)
   > 「섹션선택 > 우측패널 > ★아래 패딩 슬라이드 조절 시 ★좌우패딩하면 ★색이 보이는데
      ★아래 패딩 조절시 ★안보이는 문제가 있음 / ★이걸 조절해도 ★패딩이 어떻게 줄어드는지 ★안보임」
   ★2026-09-08 당시엔 ★일부러 안 만들었다(그때 범위가 「좌우 하나」였고, 검사 T5 가 그걸 잠갔다).
     ⇒ 그 ★까닭이 죽었다. T5 는 ★지우지 않고 ★방향을 뒤집었다 — 범위가 ★늘었을 뿐,
       「범위를 안 넘었다」는 규칙은 살아 있다(같은 파일 T6 이 세운 선례 그대로).
   ★왜 _showPadXHint 를 그냥 부르지 않나 — ★그릴 상자가 다르다.
     좌우는 `.section-inner` 의 padding-left/right, 아래는 ★`.section-block` 의 padding-bottom 이다
     (applyPadB 가 `sec.style.paddingBottom` 에 쓴다). ⇒ 받는 요소도, 변수도 다르다.
   ★거두기·타이머·on/off 게이트는 ★좌우와 «한 벌»을 쓴다 — 갈라 두면 둘이 서로를 끈다.
   ★그리는 쪽: css/editor-canvas.css `body.gdt-pad-on .section-block[style*="--gdt-pad-b"]::before`
═══════════════════════════════════ */
function _showPadBHint(sec, v) {
  /* ★게이트는 좌우와 «같은 문»을 본다(prop-page.js readPadHintOn) — 「패딩 비주얼 끔」이면
     좌우는 안 뜨는데 아래만 뜨는 꼴이 되면 그게 결함이다.
     ⛔`!window.readPadHintOn?.()` 로 쓰지 마라 — 로드 순서 때문에 기본값이 뒤집힌다(T9 와 같은 까닭). */
  if (window.readPadHintOn && window.readPadHintOn() === false) return;
  sec.style.setProperty('--gdt-pad-b', v + 'px');
  document.body.classList.add('gdt-pad-on');
  _schedulePadHintClear();
}


/* ★프레임 패널의 「좌우 패딩」도 «같은 띠»를 쓴다(F5) — 사본 없이 이 함수를 그대로 부른다.
   (inner 자리에 프레임을 넘긴다. 그리는 쪽 규칙은 css/editor-canvas.css 에 프레임용 선택자 한 줄이 붙었다.) */
window._showPadXHint = _showPadXHint;
window._showPadBHint = _showPadBHint;   /* ★짝을 맞춘다 — 좌우만 노출하면 다음 사람이 「아래는 없다」로 읽는다 */

/**
 * 섹션 배경 적용 헬퍼 — 이미지와 색을 동시에 합성한다.
 * 우선순위(위→아래): 색(overlay) > 이미지 > 투명
 * - 이미지 + 색 둘 다: `background: linear-gradient(<color>,<color>), url(<img>)`
 *   (첫 layer가 위. 색이 반투명이면 이미지에 tint, 불투명이면 이미지 가림 — 의도된 동작)
 * - 이미지만: backgroundImage = url(...), backgroundColor = transparent
 * - 색만: backgroundColor = <color>, backgroundImage = none
 * - 둘 다 없음: 모두 클리어
 *
 * 색은 sec.dataset.bg, 이미지는 sec.dataset.bgImg, 사이즈는 sec.dataset.bgSize에서 읽는다.
 */
/* ★섹션 색이 «불투명»인가 — 불투명이면 _applySectionBg 규약상 색 층이 그림 위라 배경 이미지를 덮는다.
   판정은 여기 한 곳(패널 상시 한 줄 · 에셋→배경 토스트가 같이 쓴다, 2026-10-01 C2). */
export function isOpaqueSectionColor(color) {
  const c = String(color || '').trim().toLowerCase();
  if (!c || c === 'transparent') return false;
  const m = c.match(/^rgba\(([^)]+)\)$/);
  if (m) { const a = parseFloat(m[1].split(',')[3]); return !(a < 1); }
  return true;
}
window.isOpaqueSectionColor = isOpaqueSectionColor;

function _applySectionBg(sec) {
  /* ★체크 배경(빈 이미지 자리) — 무늬는 CSS 한 자리(.sec-bg-empty)가 준다.
     ⛔인라인으로 박지 마라: 저장본(.gdt)·배송 HTML 에 무늬가 그대로 실린다
     (css/editor-blocks.css 의 .grd-img-empty 머리말이 그 사고를 이미 적어 뒀다). */
  sec.classList.toggle('sec-bg-empty', sec.dataset.bgImgEmpty === '1' && !sec.dataset.bgImg);
  const color = sec.dataset.bg || '';
  const img   = sec.dataset.bgImg || '';
  const size  = sec.dataset.bgSize || 'cover';
  // ★bgPos 는 dataset 이 정본(save-load.js 복원과 동일). 예전엔 여기서 'center' 로 덮어써서
  //   「위치 편집」으로 잡은 위치가 사이즈 변경·색 변경 한 번에 되돌아갔다.
  const pos   = sec.dataset.bgPos || 'center';

  // 항상 shorthand는 초기화 후 개별 속성으로 재설정 (이전 multi-layer 잔재 제거)
  sec.style.background = '';

  if (img && color) {
    // multi-background: gradient(색) 위, url(이미지) 아래
    sec.style.background = `linear-gradient(${color}, ${color}), url(${img})`;
    // 색 layer 는 gradient — 고유 크기가 없어 어떤 키워드든 박스 전체다. 'cover' 로 고정해야
    // 이미지 layer 가 px 값(위치 편집 결과)일 때 색이 박스 일부만 덮는 사고가 없다.
    sec.style.backgroundSize = `cover, ${size}`;
    sec.style.backgroundPosition = `center, ${pos}`;
    sec.style.backgroundRepeat = 'no-repeat, no-repeat';
  } else if (img) {
    sec.style.backgroundImage = `url(${img})`;
    sec.style.backgroundColor = 'transparent';
    sec.style.backgroundSize = size;
    sec.style.backgroundPosition = pos;
    sec.style.backgroundRepeat = 'no-repeat';
  } else if (color) {
    sec.style.backgroundImage = 'none';
    sec.style.backgroundColor = color;
    sec.style.backgroundSize = '';
    sec.style.backgroundPosition = '';
    sec.style.backgroundRepeat = '';
  } else {
    sec.style.backgroundImage = '';
    sec.style.backgroundColor = '';
    sec.style.backgroundSize = '';
    sec.style.backgroundPosition = '';
    sec.style.backgroundRepeat = '';
  }
}

function applyPreset(sec, presetId) {
  const preset = PRESETS.find(p => p.id === presetId);
  // 기존 preset 변수 초기화
  PRESETS.forEach(p => Object.keys(p.variables).forEach(k => sec.style.removeProperty(k)));
  delete sec.dataset.preset;

  if (preset && presetId !== 'default') {
    Object.entries(preset.variables).forEach(([k, v]) => sec.style.setProperty(k, v));
    sec.dataset.preset = presetId;
  }
  // 프리셋 배경색 적용 (정의된 경우에만) — 이미지가 있으면 합성 유지
  if (preset?.backgroundColor) {
    sec.dataset.bg = preset.backgroundColor;
    _applySectionBg(sec);
  }
  pushHistory();
}

function setRpIdBadge(id) {
  const badge = document.getElementById('rp-block-id-badge');
  if (!badge) return;
  if (id) {
    badge.textContent = id;
    badge.style.display = '';
    badge.onclick = () => _copyToClipboard(id);
  } else {
    badge.style.display = 'none';
  }
}

async function showSectionProperties(sec) {
  /* ★«기다리는 사이 선택이 옮겨갔나»를 먼저 기억한다 (2026-09-22 T-084).
     이 함수는 async 다 — 아래 await 한 줄이 패널 쓰기를 «다음 마이크로태스크»로 미룬다.
     그래서 js/editor.js selectSection 이 이걸 부르고 «동기로» 돌아간 뒤 호출자가
     곧바로 블럭을 고르면, 늦게 도착한 섹션 패널이 «더 최신인 블럭 패널»을 덮었다.
       실측(9639, 2026-09-22): addDeviceMockupBlock('iphone') / addPresetRow('img2') 에서
       동기 시점 패널 = 새 블럭(mkp_…) → +50ms = 섹션(sec_…). 새 블럭엔 파란 테두리가
       붙어 있는데 우측 패널만 섹션이라 「지금 뭘 고치는 중인지」가 또 어긋났다(카드 ⑤).
     ⛔«선택 안 된 섹션은 안 그린다»로 만들지 마라 — 선택과 무관하게 패널을 새로 그리는
       호출자가 있다(js/image-handling.js · 이 파일의 재렌더 3자리). 그래서 「부를 때는
       선택돼 있었는데 기다리는 사이 아니게 된 경우」만 접는다. */
  const _wasSelected = !!sec?.classList?.contains('selected');
  // race condition 방지: Electron readPresets() IPC가 완료될 때까지 대기 후 PRESETS 사용
  await _presetsReady;
  if (!sec || !sec.isConnected) return;
  if (_wasSelected && !sec.classList.contains('selected')) return;   // 더 최신 선택이 패널 주인이다
  // dataset.bg(헬퍼가 기록한 색)를 우선, 없으면 인라인 스타일에서 추출
  const rawBg = sec.dataset.bg || sec.style.backgroundColor || sec.style.background || '';
  const hexBg = rawBg
    ? (/^#[0-9a-f]{6}$/i.test(rawBg) ? rawBg : rgbToHex(rawBg))
    : '#ffffff';
  const _secBgM = rawBg.match(/rgba?\(([^)]+)\)/i);
  const secBgAlpha = _secBgM && _secBgM[1].split(',').length === 4
    ? Math.round(parseFloat(_secBgM[1].split(',')[3]) * 100)
    : 100;
  const hasBgImg  = !!sec.dataset.bgImg;
  const bgSize    = sec.dataset.bgSize || 'cover';
  const secPadB   = parseInt(sec.style.paddingBottom) || 0;
  const inner     = sec.querySelector('.section-inner');
  const hasPadXOverride = inner?.dataset.paddingX !== '' && inner?.dataset.paddingX !== undefined;
  const secPadX        = hasPadXOverride
    ? parseInt(inner.dataset.paddingX)
    : (parseInt(inner?.style.paddingLeft) || 0);
  const secPadXAsset   = inner?.dataset.padXExcludesAsset || '';
  // 「위치 편집」으로 잡은 크기는 px 값이라 3개 키워드 어디에도 안 맞는다 —
  // 옵션을 안 넣으면 select 가 «Cover» 로 보이는 거짓말을 한다.
  const _bgEmpty = sec.dataset.bgImgEmpty === '1';
  /* ★S1 섹션 체커 톤(2026-10-06 현빈 「일괄이 아니라 섹션마다」 · R1 = 섹션 «배경» 체커만).
     정본은 이 dataset 하나다 — ⛔전역 보기설정을 되살리지 마라(css/editor-base.css 머리말).
     ★키가 없으면 라이트 = 지금까지 저장된 모든 프로젝트가 «픽셀 동일»이다(마이그레이션 코드 0). */
  const _bgTone  = sec.dataset.checkerTone === 'dark' ? 'dark' : 'light';
  const _bgSizeCustom = /px/.test(bgSize);
  const bgImgHTML = hasBgImg ? `
    <div class="prop-row">
      <span class="prop-label">사이즈</span>
      <select class="prop-select" id="sec-bg-size">
        <option value="cover"   ${bgSize==='cover'   ?'selected':''}>Cover</option>
        <option value="contain" ${bgSize==='contain' ?'selected':''}>Contain</option>
        <option value="auto"    ${bgSize==='auto'    ?'selected':''}>Auto</option>
        ${_bgSizeCustom ? `<option value="${bgSize}" selected>직접 조절</option>` : ''}
      </select>
    </div>
    <button class="prop-action-btn secondary" id="sec-bg-pos-btn" style="margin-top:6px;">${sec._secBgEditing ? '위치 편집 완료' : '위치 편집'}</button>
    ${isOpaqueSectionColor(sec.dataset.bg) ? `<!-- ★상시 한 줄(지디 2026-10-01) — 토스트는 «방금 한 일»의 답, 이 줄은 «지금 상태»의 답. 증상이 아니라 «까닭»을 말한다. -->
    <div class="prop-hint" style="font-size:11px;color:#888;margin-top:6px;">배경색이 불투명해서 이 이미지를 덮고 있습니다 — 배경색 투명도를 낮추면 보입니다.</div>` : ''}
    <!-- C2 역방향(2026-10-01) — 배경 이미지를 스크래치패드로 «복사». 배경은 그대로 남는다. -->
    <button class="prop-action-btn secondary" id="sec-bg-to-scratch" style="margin-top:4px;">스크래치로 보내기</button>
    <button class="prop-action-btn danger" id="sec-bg-img-remove" style="margin-top:4px;">이미지 제거</button>
  ` : `
    <button class="prop-action-btn secondary" id="sec-bg-img-btn" style="margin-top:6px;">이미지 선택</button>
    <input type="file" id="sec-bg-img-input" accept="image/*" style="display:none">
    <!-- ★체크 배경 — 현빈 2026-09-28 「이미지 없이 체크배경으로 깔아둘 수 있게」.
         ⛔새 무늬를 만들지 않는다: .asset-block 의 72px 정본을 그대로 쓴다(css 한 자리). -->
    <button class="prop-action-btn ${_bgEmpty ? 'primary' : 'secondary'}" id="sec-bg-img-empty" style="margin-top:4px;"
      title="이미지를 넣기 «전»에 자리만 잡아 둔다. 내보내기엔 무늬가 안 나간다">
      ${_bgEmpty ? '체크 배경 끄기' : '체크 배경으로 두기'}</button>
    ${_bgEmpty ? `<!-- ★체커 톤 — 현빈 2026-10-06 「체크 배경 끄기 이거할때마다 «옆에 있을» 옵션 ·
           섹션마다 라이트 체크일수도, 어두운 체크일수도」. ⇒ 자리는 «그 단추 옆»이고, 체크 배경이
           켜져 «있을 때만» 보인다(끔 상태에선 정할 것이 없다).
         ★어휘는 페이지 패널에서 걷어온 그 라디오 그대로 쓴다 — 새 클래스 0.
         ⛔「내보내기엔 무늬가 안 나간다」는 톤과 무관하게 그대로다(걷는 판정이 «색»이 아니라 «서명»이라서). -->
    <div class="prop-row" style="margin-top:4px;" title="이 섹션의 체크 배경만 어둡게 합니다 — 흰 글자가 체커 위에서 보이게. 이 섹션 안의 빈 카드·도형 체커는 그대로입니다. 내보내기에는 체커가 나가지 않습니다.">
      <span class="prop-label prop-label--auto">체커 어둡게</span>
      <div class="prop-radio-group">
        <label class="prop-radio"><input type="radio" name="sec-checker-tone" id="sec-checker-tone-on" value="dark" ${_bgTone === 'dark' ? 'checked' : ''}> 켬</label>
        <label class="prop-radio"><input type="radio" name="sec-checker-tone" id="sec-checker-tone-off" value="light" ${_bgTone === 'dark' ? '' : 'checked'}> 끔</label>
      </div>
    </div>` : ''}
  `;

  // 섹션 내 텍스트 블록 타입별 수집
  const typeMap = { heading: 'Heading', body: 'Body', caption: 'Caption', label: 'Label' };
  const typeOrder = ['heading', 'body', 'caption', 'label'];
  const found = {}; // type → { blocks: [], color: hex }
  sec.querySelectorAll('.text-block').forEach(tb => {
    const type = tb.dataset.type;
    if (!typeMap[type]) return;
    const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
    /* ⛔contentEl 이 «없을 수» 있다 — 그러면 getComputedStyle 이 던지고 ★패널이 통째로 안 열린다.
         (2026-09-09 현빈 실측: 「Failed to execute 'getComputedStyle' … parameter 1 is not of type 'Element'」
          → showSectionProperties 가 죽어 섹션 프로퍼티가 «아예» 안 뜬다.)
       속이 빈 텍스트블럭은 «색을 잴 것이 없다» ⇒ 세지 않고 넘긴다. 패널은 살아야 한다. */
    if (!contentEl) return;
    const computed = window.getComputedStyle(contentEl);
    const colorHex = contentEl.style.color
      ? (/^#/.test(contentEl.style.color) ? contentEl.style.color : rgbToHex(contentEl.style.color))
      : rgbToHex(computed.color);
    if (!found[type]) found[type] = { blocks: [], color: colorHex };
    found[type].blocks.push(tb);
  });

  const colorRows = typeOrder.filter(t => found[t]).map(t => {
    const c = found[t].color;
    return `
      <div class="prop-color-row">
        <span class="prop-label">${typeMap[t]}</span>
        <div class="prop-color-swatch" style="background:${c}">
          <input type="color" id="sec-txt-${t}" value="${c}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-txt-${t}-hex" value="${c.replace('#','').toUpperCase()}" maxlength="7" aria-label="Color">
      </div>`;
  }).join('');

  const currentPreset = sec.dataset.preset || 'default';
  // section memo (P/G/E + Codex 리뷰) — dataset.memo ↔ textarea 양방향 바인딩.
  // 메모는 섹션 툴바 📝 버튼(section-memo.js popover)에서 편집·data-memo로 영속화됨 — prop 패널에는 없음.
  const presetSelectHTML = PRESETS.map(p =>
    `<option value="${escHtml(p.id)}"${p.id === currentPreset ? ' selected' : ''}>${escHtml(p.name)}</option>`
  ).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fill="#888" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/>
          </svg>`,
      name: sec._name || sec.dataset.name,
      defaultName: 'Section',
      crumb: getBlockBreadcrumb(sec),
      id: sec.id,
    })}
      <div class="prop-row">
        <span class="prop-label">Preset</span>
        <select class="prop-select" id="sec-preset">${presetSelectHTML}</select>
      </div>
      <!-- ★(다) 이 섹션의 «지금» 높이 — 현빈 2026-10-07. 읽기 전용(여기서 높이를 «정하지» 않는다).
           ⛔수를 여기서 다시 계산하지 마라 — 캔버스 배지·합계와 ★같은 함수(window.measureSectionHeight)를
             부른다. 값의 출처가 둘이면 어느 날 갈린다(js/section-height.js 머리말).
           갱신은 js/section-height.js 가 #sec-height-value 를 찾아서 한다(섹션 높이가 바뀌는 동안 패널이 열려 있을 수 있다). -->
      <div class="prop-row" title="내보내기 기준 레이아웃 px — 캔버스 배율에 흔들리지 않습니다">
        <span class="prop-label">높이</span>
        <span class="prop-value-text" id="sec-height-value" style="font-variant-numeric:tabular-nums;" data-sec-id="${escHtml(sec.id || '')}">${
          (() => { const h = window.measureSectionHeight?.(sec); return h == null ? '—' : h + 'px'; })()
        }</span>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Background</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-field">
          <div class="prop-color-swatch" style="background:${hexBg}">
            <input type="color" id="sec-bg-color" value="${hexBg}">
          </div>
          <input type="text" class="prop-color-hex" id="sec-bg-hex" value="${hexBg.replace('#','').toUpperCase()}" maxlength="7" aria-label="Color">
          <label class="prop-color-alpha" title="Opacity">
            <input type="text" class="prop-color-alpha-input" id="sec-bg-alpha" value="${secBgAlpha}" aria-label="Opacity">
            <span class="prop-color-alpha-suffix">%</span>
          </label>
        </div>
      </div>
      <span class="prop-field-label" style="margin-top:8px">Background Image</span>
      ${bgImgHTML}
    </div>
    ${colorRows ? `<div class="prop-section"><div class="prop-section-title">Text Color</div>${colorRows}</div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">Bulk Align</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="sec-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Padding</div>
      ${sliderRowHTML('좌우 패딩', 'sec-padx-slider', 'sec-padx-number', { min: 0, max: 100, step: 2, value: secPadX })}
      <div class="prop-row">
        <span class="prop-label">아래 패딩</span>
        <input type="range" class="prop-slider" id="sec-padb-slider" min="0" max="200" step="4" value="${secPadB}">
        <input type="number" class="prop-number" id="sec-padb-number" min="0" max="200" value="${secPadB}">
      </div>
      <div class="prop-row">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:#ccc;">
          <input type="checkbox" id="sec-overflow-visible" ${sec.dataset.overflowVisible === 'true' ? 'checked' : ''}>
          섹션 밖 보이기 (미리보기)
        </label>
      </div>
      <div class="prop-hint" style="font-size:11px;color:#888;">기본은 섹션 경계 밖이 잘립니다. 켜면 미리보기에서 경계 밖 요소도 보입니다. (내보내기 PNG는 항상 섹션 크기로 잘림)</div>
    </div>
    <!-- Memo: section-toolbar의 📝 버튼으로 popover 표시 (prop 패널 X) -->
    <div class="prop-section">
      <div class="prop-section-title">Export</div>
      <div class="prop-row" style="margin-bottom:4px;">
        <select class="prop-select" id="sec-export-format" style="flex:1;min-width:0;">
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="gif">GIF (정적)</option>
          <option value="gif-anim">GIF (애니메이션)</option>
        </select>
        <select class="prop-select" id="sec-export-width" style="flex:2;min-width:0;">
          <option value="860">860px (기본)</option>
          <option value="780">780px (쿠팡)</option>
        </select>
      </div>
      <button class="prop-export-btn" id="sec-export-btn">이 섹션 내보내기</button>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Template</div>
      <div class="prop-row" style="margin-bottom:4px;">
        <select class="prop-select" id="sec-tpl-folder" style="flex:1;min-width:0;">
          ${(()=>{
            const tpls = window.loadTemplates ? window.loadTemplates() : [];
            const folders = window.listTemplateFolders?.(tpls) || [];
            if (!folders.length) folders.push('내 템플릿');
            return folders.map(f => `<option value="${f.replace(/"/g,'&quot;')}">${f.replace(/</g,'&lt;')}</option>`).join('') +
              '<option value="__new__">새 폴더...</option>';
          })()}
        </select>
        <select class="prop-select" id="sec-tpl-cat" style="flex:1;min-width:0;" title="이 섹션의 «역할». 고르면 아래에 그 역할의 추천 태그가 뜬다">
          ${window.TPL_ROLES ? window.TPL_ROLES.map(r => `<option value="${r.key}">${r.ko}</option>`).join('')
            : '<option value="head">머리 (head)</option><option value="body">본문 (body)</option><option value="foot">꼬리 (foot)</option><option value="etc">기타 (etc)</option>'}
        </select>
      </div>
      <input type="text" id="sec-tpl-folder-new" class="tpl-name-input" placeholder="새 폴더 이름" style="display:none;margin-bottom:4px;">
      <input type="text" id="sec-tpl-name" class="tpl-name-input" placeholder="템플릿 이름" style="margin-bottom:4px;">
      <input type="text" id="sec-tpl-tags" class="tpl-name-input" placeholder="태그 (쉼표 구분)" style="margin-bottom:4px;">
      <!-- ★추천 태그 — 역할을 고르면 여기가 바뀐다. ⛔«가둠»이 아니다: 위 입력칸에 직접 쳐도 된다. -->
      <div id="sec-tpl-tag-recos" class="tpl-tag-recos" style="margin-bottom:4px;"></div>
      <button class="prop-action-btn primary" id="sec-tpl-save-btn">템플릿으로 저장</button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(sec.id || null);

  // 좌우 패딩 이벤트
  const padXSlider = document.getElementById('sec-padx-slider');
  const padXNumber = document.getElementById('sec-padx-number');
  if (padXSlider && inner) {
    const applyPadX = v => {
      v = Math.min(100, Math.max(0, isNaN(v) ? 0 : v));
      // 0도 명시 override로 저장 (페이지 padX inherit 방지)
      inner.style.paddingLeft  = v + 'px';
      inner.style.paddingRight = v + 'px';
      inner.dataset.paddingX   = String(v);
      _showPadXHint(inner, v);                                       // 만지는 «동안»만 좌우 패딩 띠를 비춘다
      window.syncMergedPartMargins?.(sec, { applyPadding: true });   // 사용자가 «직접» 바꿨으니 아래 몸도 전체 적용
      // 글로벌 padXExcludesAsset도 고려 (prop-page.js의 getEffectiveUsePadx 헬퍼)
      // section-inner의 '직접' 자식 ab만 처리 — row 안에 있는 ab는 row 핸들러가 관리
      const usePadx = window.getEffectiveUsePadx;
      inner.querySelectorAll(':scope > .asset-block').forEach(ab => {
        if (usePadx && usePadx(ab) && v > 0) {
          ab.style.marginLeft  = -v + 'px';
          ab.style.marginRight = -v + 'px';
          ab.style.width = `calc(100% + ${v * 2}px)`;
        } else {
          ab.style.marginLeft  = '';
          ab.style.marginRight = '';
          if (!ab.style.width || ab.style.width.includes('calc')) ab.style.width = '';
        }
      });
      padXSlider.value = v;
      padXNumber.value = v;
    };
    padXSlider.addEventListener('input',  e => applyPadX(parseInt(e.target.value)));
    padXSlider.addEventListener('change', () => pushHistory());
    padXNumber.addEventListener('change', e => { applyPadX(parseInt(e.target.value)); pushHistory(); });

  }

  // 아래 여백 이벤트
  const padBSlider = document.getElementById('sec-padb-slider');
  const padBNumber = document.getElementById('sec-padb-number');
  if (padBSlider) {
    const applyPadB = v => {
      v = Math.min(200, Math.max(0, isNaN(v) ? 0 : v));
      sec.style.paddingBottom = v ? v + 'px' : '';
      _showPadBHint(sec, v);                                         // 만지는 «동안»만 아래 패딩 띠를 비춘다
      padBSlider.value = v;
      padBNumber.value = v || '';
    };
    padBSlider.addEventListener('input',  e => applyPadB(parseInt(e.target.value)));
    padBSlider.addEventListener('change', () => pushHistory());
    padBNumber.addEventListener('change', e => { applyPadB(parseInt(e.target.value)); pushHistory(); });
  }

  // 섹션 밖 보이기 토글 — 미리보기 크롭(기본)을 이 섹션만 해제. 에디터 표시는 항상 보임이라 rerender 불필요.
  document.getElementById('sec-overflow-visible')?.addEventListener('change', e => {
    if (e.target.checked) sec.dataset.overflowVisible = 'true';
    else delete sec.dataset.overflowVisible;
    pushHistory();
  });

  // 배경색 이벤트
  const picker = document.getElementById('sec-bg-color');
  const hex    = document.getElementById('sec-bg-hex');
  const alphaInp = document.getElementById('sec-bg-alpha');
  const swatch = picker.closest('.prop-color-swatch');
  let _secAlpha = secBgAlpha;

  const _buildSecBg = () => {
    const h = (picker.value || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, _secAlpha / 100));
    return a >= 1 ? picker.value : `rgba(${r},${g},${b},${a})`;
  };
  const _applySecBg = () => {
    const c = _buildSecBg();
    sec.dataset.bg = c;
    _applySectionBg(sec);
    swatch.style.background = c;
  };

  picker.addEventListener('input', () => {
    hex.value = picker.value.replace('#','').toUpperCase();
    _applySecBg();
  });
  picker.addEventListener('change', () => pushHistory());
  /* 배경색 hex — 배선은 color-picker.js 의 wireHexText 한 자리에서 온다(손복사 금지).
     이 세 줄이 예전엔 wireColorField 와 「거의 같지만 조금 다른」 사본이었다. */
  wireHexText(hex, {
    parse: parseHex6,
    format: formatHex6,
    getCurrent: () => picker.value || '#000000',
    onApply: (v) => { picker.value = v; _applySecBg(); },
    onCommit: () => pushHistory(),
  });
  alphaInp.addEventListener('input', () => {
    const m = alphaInp.value.match(/(\d+)/);
    if (!m) return;
    _secAlpha = Math.max(0, Math.min(100, parseInt(m[1])));
    _applySecBg();
  });
  /* ★Enter = 확정하고 포커스를 뺀다 (현빈 2026-09-30 「투명으로 했는데 ⌘Z 가 안 된다」).
     포커스가 이 칸에 남으면 editor.js 단축키가 INPUT 포커스에서 ⌘Z 를 «돌려보내» 편집기 undo 가 안 돈다.
     blur 가 change(=onCommit·pushHistory)를 낸다 — Enter 에 change 가 이미 났으면 값이 같아 다시 안 난다. */
  alphaInp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); alphaInp.blur(); } });
  alphaInp.addEventListener('blur', () => { alphaInp.value = String(_secAlpha); });
  alphaInp.addEventListener('change', () => pushHistory());

  // 배경 이미지 이벤트
  const bgImgBtn    = document.getElementById('sec-bg-img-btn');
  const bgImgInput  = document.getElementById('sec-bg-img-input');
  const bgSizeEl    = document.getElementById('sec-bg-size');
  const bgImgRemove = document.getElementById('sec-bg-img-remove');
  /* C2 역방향 — ⛔style.backgroundImage 로 읽지 마라: lazy 로 내려간 섹션은 'none' 이다(io/lazy-sections.js).
     정본 dataset.bgImg 를 보낸다. 스크래치는 캔버스 히스토리 밖이라 기록 없음(우클릭 「스크래치로 보내기」와 같다). */
  document.getElementById('sec-bg-to-scratch')?.addEventListener('click', async () => {
    const src = sec.dataset.bgImg;
    if (!src) { window.showToast?.('⚠️ 배경 이미지가 없습니다'); return; }
    try {
      await window._scratchAddAndSave?.(src, 40, 40, 400);
      window.showToast?.('📋 배경 이미지를 스크래치로 보냈어요 (배경은 그대로)');
    } catch (err) {
      window.showToast?.('❌ 실패: ' + (err?.message || err));
    }
  });
  const bgPosBtnEl  = document.getElementById('sec-bg-pos-btn');
  // 「위치 편집」 = 에셋 더블클릭 편집기를 섹션 배경에 붙인 모드(토글).
  // 예전 enterBgPosDragMode(%-기반 위치만 드래그)는 프레임(.frame-block) 쪽에 그대로 남아 있다.
  if (bgPosBtnEl) bgPosBtnEl.addEventListener('click', () => {
    if (sec._secBgEditing) window.exitSectionBgEditMode?.(sec);
    else                   window.enterSectionBgEditMode?.(sec);
  });

  if (bgImgBtn && bgImgInput) {
    bgImgBtn.addEventListener('click', () => bgImgInput.click());
    bgImgInput.addEventListener('change', () => {
      const file = bgImgInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        window.pushHistory?.('섹션 배경 이미지');
        sec.dataset.bgImg = dataUrl;
        sec.dataset.bgSize = 'cover';
        delete sec.dataset.bgImgEmpty;   // ★진짜 그림이 오면 «자리표시»는 물러난다
        _applySectionBg(sec);
        /* ★[R1-업로드 · 2026-09-22] «끝 표본» — 바로 위 pushHistory 는 push-before 다(찍고 «나서» 바꾼다).
           ⚠️정정(2026-09-22): 이 자리를 한때 「찍고 → 비동기로 반영」(js/image-handling.js 꼴)으로
             분류했는데 «틀렸다» — 그 pushHistory 는 FileReader.onload «안»에 있어서 적용과 같은
             동기 구간이다. 곧 평범한 push-before 고, 고쳐야 하는 까닭도 평범한 그것이다:
           앞 동작이 push-after 였으면 이 push-before 가 꼭대기와 «같은 상태»를 찍어
           js/history.js 의 무변화 차단에 먹힌다 ⇒ 「업로드의 결과」가 스택에 한 번도 안 남는다.
           그러면 업로드 뒤에 편집이 하나만 더 와도 ⌘Z 한 번이 둘을 같이 먹는다.
           ⇒ 반영이 «끝난» 여기서 한 번 더 찍는다. ⛔옮기기가 아니라 더하기다.
           ★같은 «규칙»의 선례: js/image-handling.js · js/props/asset-video-trim.js (③).
             (규칙은 같다 — 「모든 동작이 끝 표본을 남긴다」. 기전이 같다는 뜻은 아니다.) */
        window.pushHistory?.('섹션 배경 이미지 적용');
        window.scheduleAutoSave?.();
        showSectionProperties(sec);
      };
      reader.readAsDataURL(file);
    });
  }
  const bgImgEmptyBtn = document.getElementById('sec-bg-img-empty');
  if (bgImgEmptyBtn) {
    bgImgEmptyBtn.addEventListener('click', () => {
      const on = sec.dataset.bgImgEmpty === '1';
      window.pushHistory?.(on ? '섹션 체크 배경 끄기' : '섹션 체크 배경');
      if (on) delete sec.dataset.bgImgEmpty; else sec.dataset.bgImgEmpty = '1';
      /* ⛔checkerTone 은 «같이 지우지 마라» — 체크 배경을 껐다 켜면 고른 톤이 돌아와야 한다.
         남아도 그리는 것이 없다: 그 속성이 바꾸는 토큰(--goya-checker-secbg-*)을 읽는 자리는
         .section-block.sec-bg-empty «하나»뿐이고, 그 클래스가 없으면 아무도 안 읽는다. */
      _applySectionBg(sec);
      window.scheduleAutoSave?.();
      showSectionProperties(sec);
    });
  }
  /* ★체커 톤 라디오 — 쓰는 문은 여기 하나(sec.dataset.checkerTone). CSS 가 속성을 보고 색을 바꾼다.
     ⛔_applySectionBg 를 부를 필요가 없다 — 이 값은 «클래스»도 «인라인»도 안 건드리고 CSS 변수만 바꾼다.
     ★showSectionProperties 를 다시 안 부른다: 패널을 다시 그리면 라디오 포커스가 날아가고, 바뀐 것은
       화면 색뿐이라 패널이 들고 있는 다른 값이 틀려질 자리가 없다. */
  const toneOn  = document.getElementById('sec-checker-tone-on');
  const toneOff = document.getElementById('sec-checker-tone-off');
  if (toneOn && toneOff) {
    const applyTone = (dark) => {
      window.pushHistory?.(dark ? '섹션 체커 어둡게' : '섹션 체커 밝게');
      if (dark) sec.dataset.checkerTone = 'dark'; else delete sec.dataset.checkerTone;
      window.scheduleAutoSave?.();
    };
    toneOn.addEventListener('change',  () => { if (toneOn.checked)  applyTone(true);  });
    toneOff.addEventListener('change', () => { if (toneOff.checked) applyTone(false); });
  }
  if (bgSizeEl) {
    bgSizeEl.addEventListener('change', () => {
      window.pushHistory?.('섹션 배경 크기');
      sec.dataset.bgSize = bgSizeEl.value;
      // 키워드 사이즈로 되돌리면 px 위치는 의미가 달라진다 → 중앙으로 리셋
      if (!/px/.test(bgSizeEl.value)) delete sec.dataset.bgPos;
      _applySectionBg(sec);
      window.scheduleAutoSave?.();
    });
  }
  if (bgImgRemove) {
    bgImgRemove.addEventListener('click', () => {
      window.pushHistory?.('섹션 배경 이미지 제거');
      delete sec.dataset.bgImg;
      delete sec.dataset.bgSize;
      delete sec.dataset.bgPos;
      _applySectionBg(sec);
      window.scheduleAutoSave?.();
      showSectionProperties(sec);
    });
  }

  // Preset 드롭다운 이벤트
  const presetSelect = document.getElementById('sec-preset');
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      applyPreset(sec, presetSelect.value);
      showSectionProperties(sec);
    });
  }

  // 텍스트 컬러 이벤트
  typeOrder.filter(t => found[t]).forEach(t => {
    const blocks = found[t].blocks;
    const applyColor = (val) => {
      blocks.forEach(tb => {
        const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
        // 0918r2 textgrad: 섹션 일괄 글자색 = 단색 — 글자 그라데이션 해제
        window.clearTextGradient?.(contentEl);
        contentEl.style.color = val;
        forgetLabelAutoColor(contentEl);   // 0920r6 labeltext: 사용자가 고른 색 — 라벨 표식 폐기(타입 전환 때 안 걷어내게)
      });
    };
    const p = document.getElementById(`sec-txt-${t}`);
    const h = document.getElementById(`sec-txt-${t}-hex`);
    const sw = p.closest('.prop-color-swatch');
    p.addEventListener('input', () => { applyColor(p.value); h.value = formatHex6(p.value); sw.style.background = p.value; });
    /* ★여긴 blur 핸들러가 «아예 없던» 자리다 — 무효값을 넣으면 영원히 칸에 남아
       「초록 화면 · 안 바뀐 값」이 됐다(2026-09-20 신고의 그 Heading 칸).
       값 포맷도 `#00FF00`(7자) → `00FF00`(다수결)으로 맞춘다. 배선은 공용 한 자리. */
    wireHexText(h, {
      parse: parseHex6,
      format: formatHex6,
      getCurrent: () => p.value || '#000000',
      onApply: (v) => { applyColor(v); p.value = v; sw.style.background = v; },
      onCommit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); },
    });
    // 커밋(change) 시 undo·autosave 반영 (input엔 미적용 — 드래그당 1히스토리)
    p.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  });

  // 일괄 정렬
  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`sec-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      /* ★대상은 «누를 때» 다시 센다. 예전엔 패널을 그릴 때 한 번 모아 뒀는데,
         패널을 연 뒤 블록을 더 넣으면 그 블록은 영영 안 움직였다(낡은 목록). */
      collectBulkAlignTargets(sec).forEach(el => alignFlowBlock(el, align));
      propPanel.querySelectorAll('#sec-align-left,#sec-align-center,#sec-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory?.('섹션 일괄 정렬');   // 한 번만 — ⌘Z 한 방에 되돌아간다
      window.scheduleAutoSave?.();
    });
  });

  // (메모 textarea 핸들러 제거됨 — 메모 UI는 prop 패널이 아닌 섹션 툴바 📝 popover(section-memo.js)로 일원화.
  //  과거 #sec-memo 블록은 패널에 해당 HTML이 없어 항상 null이던 dead-code였음.)

  // 내보내기 / 템플릿 저장
  _bindSectionExport(sec);
  _bindSectionTemplate(sec);

  // 이스터에그: badge 섹션이면 전용 컨트롤 추가
  window.enhanceBadgePropPanel?.(sec);
}

/* 섹션 내보내기 이벤트 바인딩 — showSectionProperties에서 분리 */
function _bindSectionExport(sec) {
  const secExportBtn = document.getElementById('sec-export-btn');
  if (!secExportBtn) return;
  secExportBtn.addEventListener('click', async () => {
    const fmt = document.getElementById('sec-export-format').value;
    const w   = parseInt(document.getElementById('sec-export-width').value) || 860;
    secExportBtn.disabled = true;
    // GIF 애니메이션은 frame 캡처 + 인코딩으로 시간이 오래 걸림 → 안내문 분리
    secExportBtn.textContent = fmt === 'gif-anim' ? 'GIF 생성 중...' : '내보내는 중...';
    /* ★한 섹션이어도 «스피너»를 띄운다 — 버튼 글자만 바뀌면 어디까지 왔는지도, 멈춘 건지도 모른다.
     * 전체 내보내기와 «같은 창»을 쓴다(현빈: 스피너가 돌다가 끝나면 결과). 검사까지 하므로 체감이 2배다. */
    window.showExportProgress?.(1, { format: fmt, width: w });
    window.stepExportProgress?.(1, 1, sec._name || sec.dataset?.name || '');
    try {
      const r = await window.exportSection(sec, fmt, w);
      // 단일 섹션 — «같으면» 토스트 한 줄, 그 외엔 결과 모달(전체 내보내기와 같은 창).
      window.showExportResultOne?.(r, { format: fmt, width: w });
    } finally {
      window.closeExportProgress?.();   // ★결과 모달이 스스로 닫지만, 토스트 경로·예외에서도 남지 않게
      secExportBtn.disabled = false;
      secExportBtn.textContent = '이 섹션 내보내기';
    }
  });
}

/* 섹션 템플릿 저장 이벤트 바인딩 — showSectionProperties에서 분리 */
/* ★역할별 «추천 태그» 칩 — 현빈 2026-09-28.
 *   「지금처럼 타이핑 할수도 있지만 어떤걸 선택하느냐에 따라서 밑에 태그추천이 뜨게」
 * ⛔칩은 «보조»다: 입력칸은 자유 그대로고, 칩에 없는 태그도 그대로 저장된다.
 * ★명부는 js/panels/template-roles.js 하나다 — 여기에 태그를 «또» 적지 않는다. */
function _tplRenderTagRecos() {
  const box = document.getElementById('sec-tpl-tag-recos');
  const sel = document.getElementById('sec-tpl-cat');
  const inp = document.getElementById('sec-tpl-tags');
  if (!box || !sel) return;
  const tags = (window.tplRoleTags ? window.tplRoleTags(sel.value) : []) || [];
  if (!tags.length) { box.innerHTML = ''; return; }
  /* 이미 넣은 태그는 «눌린 꼴»로 — 두 번 더해지는 걸 눈으로 막는다. */
  const have = new Set(String(inp?.value || '').split(',').map(t => t.trim()).filter(Boolean));
  box.innerHTML = '<div class="tpl-reco-label">추천 태그</div>'
    + tags.map(t => `<button type="button" class="tpl-reco-chip${have.has(t) ? ' on' : ''}" data-tag="${t}">${t}</button>`).join('');
}
function _tplBindTagRecos() {
  const box = document.getElementById('sec-tpl-tag-recos');
  const sel = document.getElementById('sec-tpl-cat');
  const inp = document.getElementById('sec-tpl-tags');
  if (!box || !sel || !inp) return;
  sel.addEventListener('change', _tplRenderTagRecos);
  inp.addEventListener('input', _tplRenderTagRecos);
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('.tpl-reco-chip');
    if (!chip) return;
    e.preventDefault();
    const tag = chip.dataset.tag;
    const cur = String(inp.value || '').split(',').map(t => t.trim()).filter(Boolean);
    const at = cur.indexOf(tag);
    if (at >= 0) cur.splice(at, 1);      // 한 번 더 누르면 뺀다(토글)
    else cur.push(tag);
    inp.value = cur.join(', ');
    _tplRenderTagRecos();
  });
  _tplRenderTagRecos();                   // 첫 그림
}

function _bindSectionTemplate(sec) {
  const tplFolderSel = document.getElementById('sec-tpl-folder');
  const tplFolderNew = document.getElementById('sec-tpl-folder-new');
  if (tplFolderSel && tplFolderNew) {
    tplFolderSel.addEventListener('change', () => {
      tplFolderNew.style.display = tplFolderSel.value === '__new__' ? 'block' : 'none';
    });
  }

  _tplBindTagRecos();

  const tplSaveBtn = document.getElementById('sec-tpl-save-btn');
  if (!tplSaveBtn) return;
  tplSaveBtn.addEventListener('click', () => {
    const name = document.getElementById('sec-tpl-name').value.trim();
    if (!name) { document.getElementById('sec-tpl-name').focus(); return; }
    const category = document.getElementById('sec-tpl-cat').value;
    let folder = tplFolderSel ? tplFolderSel.value : '기타';
    if (folder === '__new__') {
      folder = (tplFolderNew ? tplFolderNew.value.trim() : '') || '기타';
    }
    const tagsRaw = document.getElementById('sec-tpl-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    window.saveAsTemplate?.(sec, name, folder, category, tags);
    document.getElementById('sec-tpl-name').value = '';
    const tagsEl = document.getElementById('sec-tpl-tags');
    if (tagsEl) tagsEl.value = '';
    tplSaveBtn.textContent = '저장됨 ✓';
    tplSaveBtn.disabled = true;
    setTimeout(() => {
      if (tplSaveBtn) { tplSaveBtn.textContent = '템플릿으로 저장'; tplSaveBtn.disabled = false; }
    }, 1500);
  });
}

/* 블록이 선택된 상태에서 소속 섹션만 하이라이트 (deselectAll 없이) */
function syncSection(sec) {
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  sec.classList.add('selected');
  window.syncLayerActive(sec);
}

export { applyPreset, setRpIdBadge, showSectionProperties, syncSection };

window.applyPreset           = applyPreset;
window.setRpIdBadge          = setRpIdBadge;
window.showSectionProperties = showSectionProperties;
window.applySectionBg = _applySectionBg;   // image-handling.js(섹션 배경 위치 편집) 커밋용
window.syncSection           = syncSection;
