/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */
import { propPanel, canvasEl, state } from '../globals.js';   /* ★canvasWrap 은 뺐다 — 깔때기(applyCanvasBackground)만 쓰므로 «바인딩 자체»를 없앤다(직접 대입 재유입 방지) */
import { applyCanvasBackground } from '../canvas-contrast.js';   /* 캔버스 배경은 «이 문 하나»로만 칠한다(검사 B1) */

/* ── 헬퍼: ab의 effective usePadx 결정 ──
   'true' / 'false' 명시 → 그 값 (개별 오버라이드)
   미설정 → 글로벌 디폴트(pageSettings.padXExcludesAsset)
*/
function getEffectiveUsePadx(ab) {
  if (ab.dataset.usePadx === 'true') return true;
  if (ab.dataset.usePadx === 'false') return false;
  return !!state.pageSettings.padXExcludesAsset;
}
window.getEffectiveUsePadx = getEffectiveUsePadx;

/* ── 패딩 비주얼(좌우 패딩 힌트) 켜짐 여부 — «단일 진실원» ──────────────
   그리는 쪽: css/editor-canvas.css `body.gdt-pad-on .section-inner::before`
   켜는 쪽:   js/props/prop-section.js `_showPadXHint`
   ⇒ 두 곳이 각자 localStorage 를 읽으면 «기본값»이 갈린다. 읽고 쓰는 문을 여기 하나로 둔다.

   ★기본은 «켜짐». 현빈이 시안을 보고 「이걸로 하자」고 한 것이 그 동작이다 —
     끄는 건 «빼는 선택»이지 기본이 아니다. ⇒ 키가 «없으면» true, «있으면» 그 값.
     ⛔`!!pref.on` 로 쓰지 마라(그리드는 기본 꺼짐이라 그게 맞지만 여기선 반대다).
   ★키는 GRID_KEY(gdt.gridGuide)와 «따로» 둔다 — 한 키에 섞으면 한쪽 저장이 다른 쪽을 지운다
     (같은 이유로 EXPORT_KEY 도 따로다).
   ⛔프로젝트에 저장하지 않는다 — 「보기」 설정이지 문서가 아니다(그리드와 같은 논리).
   ★모듈 최상위다 — 페이지 패널을 «한 번도 안 열어도» prop-section 이 읽을 수 있어야 한다. */
const PAD_HINT_KEY = 'gdt.padHint';
function readPadHintOn() {
  try {
    const raw = localStorage.getItem(PAD_HINT_KEY);
    if (raw === null) return true;                       // 키가 없다 = 아직 아무도 안 껐다 = 켜짐
    const o = JSON.parse(raw);
    return o && typeof o.on === 'boolean' ? o.on : true; // 깨진 값도 «켜짐»으로 — 기능이 사라지는 쪽보다 낫다
  } catch (_) { return true; }
}
function savePadHintOn(on) {
  try { localStorage.setItem(PAD_HINT_KEY, JSON.stringify({ on: !!on })); } catch (_) {}
}
window.readPadHintOn = readPadHintOn;
window.savePadHintOn = savePadHintOn;

/* ── 헬퍼: ab의 «패딩 제외(full-bleed)» 폭 문자열 ──
   패딩제외 상태면 `calc(100% + 2*padX px)`, 아니면 '' (= inline width 제거).
   ⚠️ 리사이즈/슬라이더/MCP가 최대폭에서 width를 ''로 지우면 calc()가 사라져 «패딩제외가 영구히 풀린다»
   (현빈 08-27 제보: 우측하단 핸들로 줄였다 늘리면 패딩제외 안 먹음). 그 세 곳이 이 헬퍼를 공유한다.
   padX 출처 규약은 applyPadXToSection(아래)·prop-row.applyPadX·block-factory.applyExcludePadX와 동일. */
function assetFullBleedWidth(ab) {
  if (!ab || !getEffectiveUsePadx(ab)) return '';
  // ★프레임 «전체» 안의 에셋은 full-bleed 대상이 아니다.
  //   ⑴free-layout 프레임 = 절대배치라 무의미(applyExcludePadX 가드 미러)
  //   ⑵flow 프레임도 마찬가지 — `.frame-block{overflow:hidden}`(css/editor-blocks.css:10)이라
  //     프레임 밖으로 나가는 폭은 «어떤 계산으로도 안 보이고 잘리기만» 한다. 헬퍼는 프레임이 아니라
  //     «섹션» padX 로 계산하므로 좌우 padX 만큼 클립됐다(2026-08-27 goditor-qa BUG-2, 4b5c812 유래).
  //     도달경로 = banner-block.js:54 가 배너 프리셋 stack-inner 를 fullWidth 프레임으로 만든다.
  if (ab.closest('.frame-block')) return '';
  // preset 고정폭(logo·a4 등)은 그 사이즈를 지켜야 한다 — applyExcludePadX와 같은 가드.
  // ⚠️ ②width 분기의 `preset !== 'logo'` 만으론 a4가 안 걸린다(08-27 태양 지적).
  if (window.ASSET_PRESETS?.[ab.dataset.preset]?.width) return '';
  const row = ab.parentElement;
  let padX;
  // ⚠️ row의 패딩 키가 «두 가지»다: 생성 경로(block-factory.applyRowPaddingX)는 `paddingX`,
  //    패널 슬라이더(prop-row.applyPadX)는 `padX`. 둘 다 읽어야 한다 — 하나만 보면 조용히 글로벌로 샌다.
  const rowPadX = row && row.classList.contains('row')
    ? (row.dataset.padX !== undefined && row.dataset.padX !== '' ? row.dataset.padX
       : (row.dataset.paddingX !== undefined && row.dataset.paddingX !== '' ? row.dataset.paddingX : undefined))
    : undefined;
  if (rowPadX !== undefined) {
    padX = parseInt(rowPadX);                   // row 직속 ab는 row의 패딩이 지배
  } else {
    const inner = ab.closest('.section-inner');
    const hasOverride = inner && inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
    padX = inner && hasOverride ? parseInt(inner.dataset.paddingX) : state.pageSettings.padX;
  }
  padX = parseInt(padX) || 0;
  return padX > 0 ? `calc(100% + ${padX * 2}px)` : '';
}
window.assetFullBleedWidth = assetFullBleedWidth;

/* ── 헬퍼: 패딩제외 폭을 «마진과 세트로» 적용 ──
   ⚠️ width 만 쓰면 폭은 커지는데 위치가 안 밀려 «우측 padX 만큼 섹션 밖으로 넘쳐 잘린다»
   (`.section-inner{overflow-x:hidden}`). 정본 3곳(applyPadXToSection·prop-row.applyPadX·
   block-factory.applyExcludePadX)이 전부 width+marginLeft+marginRight 를 «항상 세트로» 쓰는 이유다.
   2026-08-27 회귀: 신설 경로만 width 단독이라, «음수마진이 없는» usePadx 에셋을 최대폭으로 키우면
   실데이터 15개 중 4개가 잘렸다. 호출부가 이 함수를 쓰면 세트 규약을 못 어긴다.
   반환: 적용한 width 문자열(패딩제외 아니면 ''). */
function applyAssetFullBleed(ab) {
  const w = assetFullBleedWidth(ab);
  ab.style.width = w;
  if (w) {
    const m = w.match(/\+\s*(\d+(?:\.\d+)?)px/);
    const padX = m ? parseFloat(m[1]) / 2 : 0;
    if (padX > 0) { ab.style.marginLeft = -padX + 'px'; ab.style.marginRight = -padX + 'px'; }
  }
  // w === '' 이면 마진은 «건드리지 않는다» — usePadx=false 경로가 이미 각자 정리한다(회귀 0).
  return w;
}
window.applyAssetFullBleed = applyAssetFullBleed;

/* ── 헬퍼: section-inner 하나에 padX 적용 ── */
function applyPadXToSection(inner, padX) {
  inner.style.paddingLeft  = padX ? padX + 'px' : '';
  inner.style.paddingRight = padX ? padX + 'px' : '';
  window.syncMergedPartMargins?.(inner.closest('.section-block'), { applyPadding: true });
  // section-inner의 '직접' 자식 ab만 처리 — row 안의 ab는 row 핸들러가 관리
  inner.querySelectorAll(':scope > .asset-block').forEach(ab => {
    if (getEffectiveUsePadx(ab) && padX > 0) {
      ab.style.marginLeft  = -padX + 'px';
      ab.style.marginRight = -padX + 'px';
      ab.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      ab.style.marginLeft  = '';
      ab.style.marginRight = '';
      // calc()는 full-bleed 모드가 설정한 값 → 제거
      // px 값은 사용자가 직접 지정한 너비 → 보존
      if (!ab.style.width || ab.style.width.includes('calc')) ab.style.width = '';
    }
  });
  // gradient-block은 항상 패딩 제외 (usePadx='true' 고정) — 섹션/row 내부 모두 처리
  inner.querySelectorAll('.gradient-block').forEach(gb => {
    if (padX > 0) {
      gb.style.marginLeft  = -padX + 'px';
      gb.style.marginRight = -padX + 'px';
      gb.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      gb.style.marginLeft  = '';
      gb.style.marginRight = '';
      if (!gb.style.width || gb.style.width.includes('calc')) gb.style.width = '100%';
    }
  });
  // bridge-block도 항상 full-bleed(섹션 너비 고정) — gradient와 동일 정책 (b3-2)
  inner.querySelectorAll('.bridge-block').forEach(brg => {
    if (padX > 0) {
      brg.style.marginLeft  = -padX + 'px';
      brg.style.marginRight = -padX + 'px';
      brg.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      brg.style.marginLeft  = '';
      brg.style.marginRight = '';
      if (!brg.style.width || brg.style.width.includes('calc')) brg.style.width = '100%';
    }
  });
  // full-bleed 카드(canvas-block)는 width/margin을 직접 박지 않고 renderCanvas에 위임
  // (renderCanvas가 effective 섹션 padX를 읽어 calc 확장폭/음수마진을 통합 계산).
  inner.querySelectorAll('.canvas-block[data-full-bleed="true"]').forEach(cvb => {
    window.renderCanvas?.(cvb);
  });
}

/* ── 페이지 전체 padX 일괄 적용 (섹션 개별 override 제외) ── */
function applyPagePadX(padX) {
  document.querySelectorAll('.section-block').forEach(sec => {
    const inner = sec.querySelector('.section-inner');
    if (!inner) return;
    // 섹션 자체 override가 있으면 건너뜀
    if (inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined) return;
    applyPadXToSection(inner, padX);
  });
}

// save-load.js 등 외부에서 호출 가능하도록 export
window.applyPagePadX = applyPagePadX;
window.applyPadXToSection = applyPadXToSection;

/* ★켬/끔 «라디오 쌍» 헬퍼 — 체크박스에서 옮겨 오며 생긴 함정 둘을 여기 한 곳에서 막는다.
 *   ⛔함정①: change 는 «선택된 쪽»에서만 난다. 켬 라디오에만 리스너를 걸면
 *            사용자가 «끔»을 눌렀을 때 아무 일도 안 일어난다(체크박스는 한 요소라 이 문제가 없었다).
 *   ⛔함정②: 라디오는 `.checked = false` 로 끌 수 없다 — 그러면 «둘 다 안 켜진» 상태가 된다.
 *            끄려면 «끔 쪽을 켜야» 한다.
 *   ⇒ 읽기는 기존대로 `onEl.checked` 가 그대로 통한다(id 를 켬 쪽에 남겨 뒀다). */
function _radioPairSet(onEl, offEl, val) {
  if (onEl) onEl.checked = !!val;
  if (offEl) offEl.checked = !val;
}
function _radioPairOn(onEl, offEl, evt, fn) {
  if (onEl) onEl.addEventListener(evt, fn);
  if (offEl) offEl.addEventListener(evt, fn);
}

export function showPageProperties() {
  if (window.setRpIdBadge) window.setRpIdBadge(null);
  const { bg, gap, padX, padY, padXExcludesAsset } = state.pageSettings;
  const bgAlpha = state.pageSettings.bgAlpha ?? 100;
  const bgHexUp = (bg || '#000000').replace('#','').toUpperCase();
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fill="#888" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <span class="prop-block-name">Page</span>
      </div>
    </div>
    <!-- 「Background」 안내 절은 제거했다(현빈 2026-09-05) — 캔버스 바탕색은 왼쪽 Design System 패널. -->
    <div class="prop-section" style="opacity:0.4;pointer-events:none;" title="잘못 누르는 사고 방지로 일시 비활성 — 필요 시 prop-page.js에서 복구">
      <div class="prop-section-title">Bulk Align (비활성)</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="page-align-left" disabled>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-center" disabled>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-right" disabled>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      <div class="prop-row">
        <span class="prop-label">섹션 간격</span>
        <input type="range" class="prop-slider" id="section-gap-slider" min="0" max="200" step="1" value="${gap}">
        <input type="number" class="prop-number" id="section-gap-number" min="0" max="200" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="page-padx-slider" min="0" max="200" step="1" value="${padX}">
        <input type="number" class="prop-number" id="page-padx-number" min="0" max="200" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="page-pady-slider" min="0" max="200" step="1" value="${padY}">
        <input type="number" class="prop-number" id="page-pady-number" min="0" max="200" value="${padY}">
      </div>
      <div class="prop-row">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:#ccc;">
          <input type="checkbox" id="page-padx-asset" ${padXExcludesAsset ? 'checked' : ''}> 에셋블록 제외
        </label>
      </div>
      <div class="prop-hint" style="font-size:11px;color:#888;">에셋 블록은 좌우 패딩 일괄 적용에서 제외됩니다.</div>
    </div>
    <!-- ★Grid 는 «기하»가 아니라 «보기 보조»라 Layout 에서 떼어냈다.
         예전엔 그리드 3줄이 「좌우 패딩」과 「상하 패딩」 사이에 끼어 패딩 짝을 갈라놨다. -->
    <div class="prop-section">
      <div class="prop-section-title">Grid</div>
      <div class="prop-row">
        <span class="prop-label prop-label--auto">그리드 가이드</span>
        <div class="prop-radio-group">
          <label class="prop-radio"><input type="radio" name="page-grid" id="page-grid-on" value="on"> 켬</label>
          <label class="prop-radio"><input type="radio" name="page-grid" id="page-grid-off" value="off" checked> 끔</label>
        </div>
      </div>
      <!-- ★패딩 비주얼 — 그리드 가이드 «바로 아래». 둘 다 「편집 보조」라 같은 절이 맞다.
           ⚠️어휘를 «섞지» 않는다: 이 절은 이미 체크박스를 쓴다. 옆에 라디오를 놓으면 한 절에 두 어휘가 된다.
             (줌 패널은 라디오가 강제된 자리지만 — zoom-block.test.js ⓑ-14 — 그건 prop-zoom.js 전용이고
              이 패널엔 그런 제약이 없다. 실제로 바로 위 줄이 체크박스다.) -->
      <div class="prop-row">
        <span class="prop-label prop-label--auto">패딩 비주얼</span>
        <div class="prop-radio-group">
          <label class="prop-radio"><input type="radio" name="page-pad-hint" id="page-pad-hint-on" value="on"> 켬</label>
          <label class="prop-radio"><input type="radio" name="page-pad-hint" id="page-pad-hint-off" value="off" checked> 끔</label>
        </div>
      </div>
      <!-- ★칼럼·거터를 «한 줄»에 둔다 (2026-09-08 현빈: "칼럼과 거터 하나의 로우에 둬도 될듯해").
           ⚠️그냥 합치면 안 들어간다 — 240px 패널의 가용 폭은 211px 인데
             라벨 56×2 + 숫자칸 44×2 + gap 16 = 216px 로 «라벨만으로» 이미 넘친다(실측).
           ⇒ ⑴ 라벨을 «이 줄에서만» 28px 로 좁히고(.prop-label--narrow — 전역 .prop-label 은 안 건드린다)
             ⑵ 거터 «슬라이더»를 버렸다. 숫자칸이 같은 값을 받으므로 기능은 그대로고,
                프리셋 [6][12] 는 현빈 스케치에 남아 있어 지키는 쪽을 골랐다.
             ⇒ 실측 결과 넘침 0 · 잘린 요소 0 · 여유 +12px.
           ⛔라벨을 34px 로 되돌리지 마라 — 여유가 0 이라 윈도우 폰트에서 잘린다(실측). -->
      <div class="prop-row" id="page-grid-opts">
        <span class="prop-label prop-label--narrow">칼럼</span>
        <div class="prop-type-group" id="page-grid-col-presets">
          <button class="prop-preset-btn prop-type-btn" data-cols="6">6</button>
          <button class="prop-preset-btn prop-type-btn" data-cols="12">12</button>
        </div>
        <input type="number" class="prop-number" id="page-grid-cols" min="2" max="24" value="12" title="칼럼 수 (2~24, 직접 입력)">
        <span class="prop-label prop-label--narrow">거터</span>
        <input type="number" class="prop-number" id="page-grid-gut" min="0" max="80" value="10" title="칼럼 사이 간격(px)">
      </div>
    </div>
    <!-- ★라벨을 «안» 붙인다 — 절 제목이 이미 「참고 이미지」다. 같은 말을 두 번 하면
         240px 패널(가용 ~212px)에서 라벨이 잘리고 버튼 둘이 서로 눌린다(실측).
         개수는 A-2 와 같은 어휘로 prop-hint 에 내린다. -->
    <div class="prop-section">
      <div class="prop-section-title">참고 이미지</div>
      <div class="prop-type-group">
        <button class="prop-type-btn" id="spl-collapse-all">접기</button>
        <button class="prop-type-btn" id="spl-expand-all">펼치기</button>
      </div>
      <div class="prop-hint" style="font-size:11px;color:#888;">연결된 참고 이미지 <span id="spl-link-count">0개</span></div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Export</div>
      <div class="prop-row">
        <span class="prop-label">형식</span>
        <select class="prop-select" id="page-export-format">
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="gif">GIF (정적)</option>
          <option value="gif-anim">GIF (애니메이션)</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">폭</span>
        <select class="prop-select" id="page-export-width">
          <option value="860">860px (기본)</option>
          <option value="780">780px (쿠팡)</option>
        </select>
      </div>
      <button class="prop-export-btn" id="page-export-all-btn">전체 섹션 내보내기</button>
    </div>`;


  const gapSlider = document.getElementById('section-gap-slider');
  const gapNumber = document.getElementById('section-gap-number');
  gapSlider.addEventListener('mousedown', () => window.pushHistory?.());
  gapSlider.addEventListener('input', () => {
    state.pageSettings.gap = parseInt(gapSlider.value);
    canvasEl.style.gap = state.pageSettings.gap + 'px';
    gapNumber.value = state.pageSettings.gap;
  });
  gapSlider.addEventListener('change', () => window.scheduleAutoSave?.());
  gapNumber.addEventListener('input', () => {
    const v = Math.min(200, Math.max(0, parseInt(gapNumber.value) || 0));
    state.pageSettings.gap = v;
    canvasEl.style.gap = v + 'px';
    gapSlider.value = v;
  });
  gapNumber.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  /* ── 그리드 가이드 (편집 보조) ────────────────────────────────────────
     ★★DOM 도 인라인 스타일도 «안» 건드린다 — 고디터는 캔버스 DOM 을 그대로 직렬화해 저장하므로
       오버레이 요소나 inner.style 을 쓰면 프로젝트 파일과 내보낸 이미지에 그리드가 섞인다.
     ⇒ body 클래스 + «문서 단위 CSS 변수»로만 그린다(css/editor-canvas.css).
     ⇒ 칼럼 폭은 «섹션 콘텐츠 폭»에서 계산한다. 좌우 패딩이 바뀌면 다시 계산해야 하므로
       applyPagePadX 뒤에서도 부른다.
     ⛔프로젝트에 저장하지 않는다 — 이건 «보기» 설정이지 문서의 일부가 아니다.
       다른 사람이 그 프로젝트를 열었을 때 내 가이드가 켜져 있으면 그게 더 이상하다. */
  /* ── 패딩 비주얼 체크박스 배선 ──
     ★읽고 쓰는 것은 «모듈 최상위»의 readPadHintOn/savePadHintOn 하나뿐이다(위 단일 진실원).
       여기서 localStorage 를 다시 읽지 마라 — 기본값이 두 벌이 되는 순간 갈린다.
     ★끄면 «즉시» 걷는다 — 슬라이더를 만지던 중에 껐다면 400ms 를 기다릴 이유가 없다. */
  const padHintOn = document.getElementById('page-pad-hint-on');
  const padHintOff = document.getElementById('page-pad-hint-off');
  if (padHintOn) {
    _radioPairSet(padHintOn, padHintOff, readPadHintOn());
    _radioPairOn(padHintOn, padHintOff, 'change', () => {
      savePadHintOn(padHintOn.checked);
      if (!padHintOn.checked) {
        document.body.classList.remove('gdt-pad-on');
        document.querySelectorAll('.section-inner').forEach(el => {
          el.style.removeProperty('--gdt-pad-l');
          el.style.removeProperty('--gdt-pad-r');
        });
      }
    });
  }

  const gridOn   = document.getElementById('page-grid-on');
  const gridOff  = document.getElementById('page-grid-off');
  const gridCols = document.getElementById('page-grid-cols');
  const gridGut  = document.getElementById('page-grid-gut');
  const gridColPresets = document.getElementById('page-grid-col-presets');

  /* ★클램프는 «한 벌»만 둔다 — refreshGrid 가 쓰는 식과 되쓰기가 갈리면
       화면엔 999 가 남는데 실제 그리드는 24인 «거짓말» 상태가 생긴다. */
  /* ⚠️빈 칸·0 은 min(2) 이 아니라 «기본값 12» 로 간다 — `|| 12` 가 먼저 걸리기 때문이고, 그게 맞다.
       빈 칸은 「지우는 중」이지 「0을 원한다」가 아니다. 버그로 보고 고치지 마라. */
  const clampCols = (v) => Math.min(24, Math.max(2, parseInt(v) || 12));
  /* ⚠️★거터도 «빈 칸 = 지우는 중»이다 — 위 clampCols 와 같은 규약인데 여기만 0 으로 떨어졌다
       (2026-09-09 현빈 실측: 「거터는 10으로 해달라고 했음 기본」인데 0 이 되어 있었다).
     ⛔그렇다고 `|| 10` 으로 쓰면 «0 을 못 친다» — 0 이 falsy 라 10 으로 튕긴다.
       거터는 «0 이 정당한 값»이다(칼럼과 다른 점). ⇒ 「빈 칸/숫자 아님」과 「0」을 갈라야 한다. */
  const GUT_DEFAULT = 10;
  const clampGut  = (v) => {
    const n = parseInt(v);
    return Number.isFinite(n) ? Math.min(80, Math.max(0, n)) : GUT_DEFAULT;
  };

  const GRID_KEY = 'gdt.gridGuide';
  const readGridPref = () => {
    try { return JSON.parse(localStorage.getItem(GRID_KEY) || '{}') || {}; } catch (_) { return {}; }
  };
  const saveGridPref = (o) => { try { localStorage.setItem(GRID_KEY, JSON.stringify(o)); } catch (_) {} };

  /* 프리셋 [6]/[12] — 「직접입력 칸」을 없애지 않는다(2~24 를 프리셋 둘로 못 덮는다).
     ★.active 는 «현재 값이 정확히 그 값일 때만» — 8을 쳐 놓고 버튼이 눌려 있으면 거짓말이다. */
  function syncColPresets() {
    if (!gridColPresets) return;
    const cur = parseInt(gridCols?.value);
    gridColPresets.querySelectorAll('.prop-preset-btn').forEach(b =>
      b.classList.toggle('active', cur === parseInt(b.dataset.cols)));
  }

  /* ★체크박스 게이트(display:none) 제거 — 줄은 «늘 보이고» 조작만 잠근다.
     근거: 우리 가이드는 언제나 하나뿐이라(추가·삭제 UI 없음) 「없음」 상태가 아예 없다.
     ⇒ 체크박스는 순수 「꺼짐」이고, 끈다고 설정이 사라질 이유가 없다(피그마의 눈 아이콘과 같은 층). */
  function syncGridDisabled() {
    const on = !!(gridOn && gridOn.checked);
    [gridCols, gridGut].forEach(el => { if (el) el.disabled = !on; });
    if (gridColPresets) gridColPresets.querySelectorAll('button').forEach(b => { b.disabled = !on; });
  }

  function refreshGrid() {
    const on = !!(gridOn && gridOn.checked);
    document.body.classList.toggle('gdt-grid-on', on);
    syncGridDisabled();
    syncColPresets();
    const n = clampCols(gridCols?.value);
    const g = clampGut(gridGut?.value);
    /* ★끈 상태도 «기억»한다 — 예전엔 여기서 바로 return 해서 on:false 가 저장되지 않았고,
         꺼 놓고 패널을 다시 열면 가이드가 되살아났다. */
    saveGridPref({ on, n, g });
    if (!on) return;
    /* 콘텐츠 폭 — «화면에서» 잰다. 섹션마다 패딩이 다를 수 있어 첫 섹션을 기준으로 삼는다.
       ⚠️섹션별로 패딩을 따로 준 곳은 그 섹션에서 어긋난다 — 가이드지 자[尺]가 아니다. */
    const inner = document.querySelector('#canvas .section-inner');
    let contentW;
    if (inner) {
      const cs = getComputedStyle(inner);
      contentW = inner.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    } else {
      contentW = 860 - (parseInt(state.pageSettings.padX) || 0) * 2;
    }
    const col = Math.max(1, (contentW - g * (n - 1)) / n);
    const root = document.documentElement.style;
    root.setProperty('--gdt-grid-col', col.toFixed(2) + 'px');
    root.setProperty('--gdt-grid-gut', g + 'px');
  }
  /* 패딩이 바뀌면 그리드도 따라와야 한다 — 이 자리를 빠뜨리면 «켜 두고 패딩만 바꿨을 때» 어긋난다 */
  window.__gdtRefreshGrid = refreshGrid;

  if (gridOn) {
    const pref = readGridPref();
    gridOn.checked = !!pref.on;
    if (gridCols && pref.n) gridCols.value = pref.n;
    if (gridGut && pref.g != null) gridGut.value = pref.g;
    /* ⛔이 배열에 gridOff 를 «넣지 마라» — tests/unit/grid-guide-tidy.test.js 의 runInit 이
         `[gridOn, gridCols, gridGut]` 를 «끝 닻»으로 초기화 구간을 떠낸다(그 파일이 「손대지 마라」고
         적어 뒀고, 내가 한 번 어겨서 T-G6 셋이 «아무것도 안 쟀다»로 터졌다).
       ★그리고 넣을 «이유»도 없다 — 라디오의 켬/끔은 아래 _radioPairOn(…, 'change') 가 «양쪽» 다 받는다. */
    [gridOn, gridCols, gridGut].forEach(el =>
      el && el.addEventListener('input', refreshGrid));
    /* ★끔 라디오는 «여기서» 맞춘다 — 위 초기화 구간 «안»이 아니라.
       ⛔tests/unit/grid-guide-tidy.test.js 의 runInit 이 `const pref = readGridPref();` ~
         `[gridOn, gridCols, gridGut]` 사이를 «떠내서 실행»한다. 그 조각은 «자족적»이어야 해서
         조각 밖 식별자(gridOff·헬퍼)를 쓰면 ReferenceError 로 터진다 — 내가 두 번 그렇게 깨뜨렸다.
       ⇒ 조각은 한 글자도 안 건드리고, 끔 쪽은 «닻 뒤»에서 켠다. 결과는 같다. */
    if (gridOff) gridOff.checked = !gridOn.checked;
    _radioPairOn(gridOn, gridOff, 'change', refreshGrid);
    /* ★클램프 되쓰기는 «change 에만» 건다.
       ⛔input 에 걸면 min=2 라 `1` 을 치는 순간 2로 튀어서 `12` 를 못 친다. */
    if (gridCols) gridCols.addEventListener('change', () => { gridCols.value = clampCols(gridCols.value); refreshGrid(); });
    if (gridGut)  gridGut .addEventListener('change', () => { gridGut.value  = clampGut(gridGut.value);   refreshGrid(); });
    if (gridColPresets) gridColPresets.addEventListener('click', (e) => {
      const b = e.target.closest('.prop-preset-btn');
      if (!b || b.disabled || !gridCols) return;
      gridCols.value = clampCols(b.dataset.cols);
      refreshGrid();
    });
    refreshGrid();
  }

  const padxSlider = document.getElementById('page-padx-slider');
  const padxNumber = document.getElementById('page-padx-number');
  const padxAsset  = document.getElementById('page-padx-asset');

  const applyPadX = (v) => {
    state.pageSettings.padX = v;
    applyPagePadX(v);
    window.__gdtRefreshGrid?.();   /* ★그리드는 «패딩 안쪽»에 그려진다 — 같이 다시 재야 한다 */
  };

  padxSlider.addEventListener('mousedown', () => window.pushHistory?.());
  padxSlider.addEventListener('input', () => { applyPadX(parseInt(padxSlider.value)); padxNumber.value = padxSlider.value; });
  padxSlider.addEventListener('change', () => window.scheduleAutoSave?.());
  padxNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padxNumber.value)||0)); applyPadX(v); padxSlider.value = v; });
  padxNumber.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  padxAsset.addEventListener('change', e => {
    window.pushHistory?.();
    state.pageSettings.padXExcludesAsset = e.target.checked;
    document.querySelectorAll('.section-block').forEach(sec => {
      const inner = sec.querySelector('.section-inner');
      if (!inner) return;
      const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
      const px = hasOverride ? parseInt(inner.dataset.paddingX) : state.pageSettings.padX;
      applyPadXToSection(inner, px || 0);
    });
    window.scheduleAutoSave?.();
  });

  const applyPadY = (v) => {
    state.pageSettings.padY = v;
    canvasEl.style.setProperty('--page-pady', v + 'px');
  };
  const padySlider = document.getElementById('page-pady-slider');
  const padyNumber = document.getElementById('page-pady-number');
  padySlider.addEventListener('mousedown', () => window.pushHistory?.());
  padySlider.addEventListener('input', () => { applyPadY(parseInt(padySlider.value)); padyNumber.value = padySlider.value; });
  padySlider.addEventListener('change', () => window.scheduleAutoSave?.());
  padyNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padyNumber.value)||0)); applyPadY(v); padySlider.value = v; });
  padyNumber.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`page-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.pushHistory?.();
      document.querySelectorAll('.text-block').forEach(tb => {
        const parentFrame = tb.closest('.frame-block');
        if (parentFrame && parentFrame.dataset.textFrame !== 'true') return;
        if (tb.querySelector('.tb-label')) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      document.querySelectorAll('.label-group-block').forEach(block => {
        const parentFrame = block.closest('.frame-block');
        if (parentFrame && parentFrame.dataset.textFrame !== 'true') return;
        block.style.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
      });
      propPanel.querySelectorAll('#page-align-left,#page-align-center,#page-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
      window.scheduleAutoSave?.();
    });
  });

  /* ── 참고 이미지 일괄 접기/펼치기 ──────────────────────────────────────
     ★「연결 N개」를 «먼저» 보여준다 — 0개면 눌러도 아무 일이 안 나는데, 숫자가 없으면
       사용자는 「고장났다」로 읽는다. 0개면 버튼을 아예 비활성으로 두고 title 로 이유를 말한다.
     ★버튼은 «둘»이다(토글 아님) — 일부만 접힌 «혼합» 상태가 있어서 토글은 현재 상태를 못 정한다.
     ⛔절 이름에 「스크래치」를 쓰지 않는다 — 이미 있는 toggleScratchHideAll(«숨기기»)과 헷갈린다.
       이건 숨기는 게 아니라 연결된 참고 이미지를 «접는» 것이다. */
  const splCount     = document.getElementById('spl-link-count');
  const splCollapse  = document.getElementById('spl-collapse-all');
  const splExpand    = document.getElementById('spl-expand-all');
  if (splCount && splCollapse && splExpand) {
    /* ★제자리 갱신 — showPageProperties() 를 다시 부르면 슬라이더 포커스·패널 스크롤이 튄다
         (사용자가 다른 값을 만지던 중일 수 있다). 텍스트와 disabled 속성만 건드린다. */
    const _splSync = () => {
      /* ★판정 근거는 «데이터»(allLinks) 하나로 통일한다 — DOM 으로 세면 고아 링크에 흔들려
           숫자와 버튼 상태가 서로 다른 말을 한다. */
      const links = window.SPLink?.allLinks?.() ?? [];
      const t = links.length;
      const c = links.filter(l => l.collapsed).length;
      splCount.textContent = `${t}개`;
      const none = t === 0;
      for (const b of [splCollapse, splExpand]) {
        b.disabled = none;
        b.title = none ? '연결된 참고 이미지가 없습니다' : '';
      }
      /* ★혼합(일부만 접힘)이면 «둘 다» 불을 끈다 — 라디오처럼 생긴 버튼이 한쪽만 켜져 있으면
           「전부 접혀 있다」는 거짓말이 된다. c===t 접기 / c===0 펼치기 / 그 사이는 무표시. */
      splCollapse.classList.toggle('active', !none && c === t);
      splExpand  .classList.toggle('active', !none && c === 0);
    };
    const _splRun = (val, doneMsg, noopMsg) => {
      const r = window.SPLink?.setCollapsedAll?.(val);
      if (!r) return;
      // ★changed 0 도 «말한다» — 조용히 아무 일도 안 하면 고장으로 읽힌다.
      window.showToast?.(r.changed ? `${doneMsg} (${r.changed}개)` : noopMsg);
      /* ★일부러 이중이다 — setCollapsedAll 이 이미 'gdt:spl-changed' 를 쏴서 _splSync 가 한 번 돌았다.
           멱등이라 두 번 돌아도 결과가 같고, 이벤트가 죽어도 «버튼 동작만은» 살아 있게 남긴다. */
      _splSync();
    };
    splCollapse.addEventListener('click', () => _splRun(true,  '참고 이미지를 접었습니다', '이미 전부 접혀 있습니다'));
    splExpand  .addEventListener('click', () => _splRun(false, '참고 이미지를 펼쳤습니다', '이미 전부 펼쳐져 있습니다'));
    /* ★패널 밖에서 링크가 바뀌어도 여기 표시가 따라와야 한다 — 스크래치 아이템의 개별 ＋/－ 로
         접든, 링크를 새로 걸거나 끊든(개수가 바뀐다) 마찬가지다.
         .active 가 생긴 순간부터 «낡은 표시 = 틀린 정보» 다(A-5 클램프 되쓰기와 같은 종류의 결함).
         진실의 출처는 js/scratchpad-link.js 이고 거기서 'gdt:spl-changed' 를 쏜다.
       ⛔리스너를 쌓지 «않는다» — 패널을 여닫을수록 늘어나면 그것도 결함이다.
         ⑴이전 패널이 걸어둔 것을 먼저 떼고 ⑵다른 패널로 바뀌어 노드가 떨어지면 스스로 떨어진다. */
    const _splOnChange = () => {
      if (!splCount.isConnected) { window.removeEventListener('gdt:spl-changed', _splOnChange); return; }
      _splSync();
    };
    if (window.__gdtSplHook) window.removeEventListener('gdt:spl-changed', window.__gdtSplHook);
    window.__gdtSplHook = _splOnChange;
    window.addEventListener('gdt:spl-changed', _splOnChange);
    _splSync();
  }

  /* ── Export 선택 기억 ────────────────────────────────────────────────
     ⛔프로젝트 데이터에 저장하지 «않는다» — 「형식·폭」은 내 컴퓨터의 도구 설정이지 문서가 아니다.
       프로젝트에 넣으면 남의 프로젝트를 열 때 내 폭이 따라간다(그리드 설정과 같은 논리).
     ★키는 GRID_KEY(gdt.gridGuide)와 «따로» 둔다 — 한 키에 섞으면 한쪽 저장이 다른 쪽을 지운다. */
  const EXPORT_KEY = 'gdt.pageExport';
  const expFmtSel = document.getElementById('page-export-format');
  const expWSel   = document.getElementById('page-export-width');
  if (expFmtSel && expWSel) {
    try {
      const p = JSON.parse(localStorage.getItem(EXPORT_KEY) || '{}') || {};
      /* 없어진 옵션이 저장돼 있으면 «무시»한다 — value 를 그냥 넣으면 select 가 빈 값이 된다 */
      if (p.fmt && [...expFmtSel.options].some(o => o.value === p.fmt)) expFmtSel.value = p.fmt;
      if (p.w != null && [...expWSel.options].some(o => o.value === String(p.w))) expWSel.value = String(p.w);
    } catch (_) {}
    const _saveExportPref = () => {
      try {
        localStorage.setItem(EXPORT_KEY, JSON.stringify({
          fmt: expFmtSel.value,
          w: parseInt(expWSel.value) || 860,
        }));
      } catch (_) {}
    };
    expFmtSel.addEventListener('change', _saveExportPref);
    expWSel  .addEventListener('change', _saveExportPref);
  }

  // 전체 내보내기
  const pageExportBtn = document.getElementById('page-export-all-btn');
  if (pageExportBtn) {
    pageExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('page-export-format').value;
      const w   = parseInt(document.getElementById('page-export-width').value) || 860;
      const secCount = canvasEl.querySelectorAll('.section-block').length;
      if (!confirm(`전체 ${secCount}개 섹션을 내보냅니다. 계속할까요?`)) return;
      pageExportBtn.disabled = true;
      pageExportBtn.textContent = '내보내는 중...';
      try {
        const res = await window.exportAllSections(fmt, w, (i, total) => {
          pageExportBtn.textContent = `내보내는 중... (${i}/${total})`;
        });
        // ★결과는 «모달 하나»로만 말한다(현빈 「결과 모달도 떠야」).
        //   2초짜리 토스트에 「어느 섹션이 왜」를 담을 수 없다 — 담으면 사라진 뒤 행동이 안 남는다.
        window.showExportResultModal?.(res, { format: fmt, width: w });
      } catch (err) {
        console.error('[export] 전체 내보내기 실패:', err);
        window.showToast?.('⚠️ 내보내기 실패: ' + (err?.message || err));
      } finally {
        pageExportBtn.disabled = false;
        pageExportBtn.textContent = '전체 섹션 내보내기';
      }
    });
  }
}

// Backward compat: classic scripts call this via window.*
/* ── 캔버스 바탕색 — 왼쪽 Design System 패널의 컨트롤을 «한 번만» 배선한다.
   ★2026-09-03 현빈 지시로 우측 「페이지」 패널에서 옮겨 왔다.
     거기 「배경색」이라고 있으니 «섹션 배경»인 줄 알고 눌러 캔버스 전체 바탕이 바뀌는 일이 잦았다.
   ★마크업(id·.prop-color-swatch 구조)은 «그대로» 옮겼다 — 커스텀 컬러피커의 그라데이션 탭이
     그 구조에 붙기 때문에(color-picker.js openPicker), 모양을 바꾸면 그 기능이 조용히 사라진다.
   ★요소가 DS 패널에 «상주»하므로 패널을 열 때마다 다시 걸 필요가 없다 — 중복 배선 가드. */
export function wireCanvasBgControl() {
  const _probe = document.getElementById('page-bg-color');
  if (!_probe || _probe._canvasBgWired) return;
  _probe._canvasBgWired = true;
  const bgPicker   = document.getElementById('page-bg-color');
  const bgHex      = document.getElementById('page-bg-hex');
  const bgAlphaInp = document.getElementById('page-bg-alpha-input');
  const bgSwatch   = bgPicker.closest('.prop-color-swatch');

  const _bgToRgba = () => {
    const h = (state.pageSettings.bg || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, (state.pageSettings.bgAlpha ?? 100) / 100));
    return `rgba(${r},${g},${b},${a})`;
  };
  const _applyBg = () => {
    const rgba = _bgToRgba();
    applyCanvasBackground(rgba);          /* 배경 + 연결선 대비 재산출을 «같이» 한다 */
    bgSwatch.style.background = rgba;
  };

  bgPicker.addEventListener('input', () => {
    state.pageSettings.bg = bgPicker.value;
    bgHex.value = bgPicker.value.replace('#','').toUpperCase();
    // 솔리드 색 선택 시 그라데이션 해제(잔상 방지) — 솔리드로 복귀
    delete state.pageSettings.bgGradient;
    _applyBg();
  });
  bgPicker.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });
  bgHex.addEventListener('input', () => {
    const v = bgHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) {
      state.pageSettings.bg = '#' + v.toLowerCase();
      bgPicker.value = state.pageSettings.bg;
      _applyBg();
    }
  });
  bgHex.addEventListener('change', () => {
    const v = bgHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) {
      window.pushHistory?.();
      window.scheduleAutoSave?.();
    }
  });
  bgHex.addEventListener('blur', () => {
    bgHex.value = (state.pageSettings.bg || '#000000').replace('#','').toUpperCase();
  });
  bgAlphaInp.addEventListener('input', () => {
    const m = bgAlphaInp.value.match(/(\d+)/);
    if (!m) return;
    const p = Math.max(0, Math.min(100, parseInt(m[1])));
    state.pageSettings.bgAlpha = p;
    _applyBg();
  });
  bgAlphaInp.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });
  bgAlphaInp.addEventListener('blur', () => {
    bgAlphaInp.value = String(state.pageSettings.bgAlpha ?? 100);
  });

  // ── 페이지 배경 그라데이션 수신 (color-picker gradient 탭) ──
  // prop-shape.js 그라데이션 패턴 미러. goya-cp:gradient = 라이브 미리보기(매 프레임),
  // goya-cp:gradient-commit = 사용자 확정(마우스업·select 변경) → pushHistory.
  // NOTE(B6): export-html/export-image는 아직 solid bg만 읽으므로 내보내기엔 그라데이션 미반영(후속).
  const _applyBgGradient = (css) => {
    applyCanvasBackground(css);           /* 그라데이션도 같은 문 — 대비는 «최악 stop» 으로 잰다 */
    bgSwatch.style.background = css;
  };
  if (!bgPicker._gradWired) {
    bgPicker._gradWired = true;
    bgPicker.addEventListener('goya-cp:gradient', (e) => {
      if (!e.detail || !e.detail.css) return;
      state.pageSettings.bgGradient = JSON.stringify({
        type: e.detail.type,
        angle: e.detail.angle,
        stops: e.detail.stops,
      });
      _applyBgGradient(e.detail.css);
      if (e.detail.commit) window.pushHistory?.();
      window.scheduleAutoSave?.();
    });
    bgPicker.addEventListener('goya-cp:gradient-commit', () => {
      window.pushHistory?.();
      window.scheduleAutoSave?.();
    });
  }
}

window.showPageProperties = showPageProperties;

window.wireCanvasBgControl = wireCanvasBgControl;
