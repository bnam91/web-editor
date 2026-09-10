/* ═══════════════════════════════════
   INSPECTOR PANEL
═══════════════════════════════════ */
import { isJumpTarget } from './variation-visibility.js';

// FIX: buildLayerPanel() 마지막에 Inspector 탭 활성 시 자동 갱신 추가 (layer-panel.js)
// FIX: step-block, canvas-block, shape-block 카운트 추가

/* ── Logo 개수 판정 ── ★이건 «근사»다. 근사인 이유와 걷어낼 조건을 여기 적어 둔다.
 *
 * 정본은 data-preset="logo" 표식이다. 그런데 옛 블록들은 그 표식을 «이미 잃었다» —
 * 패딩제외 토글이 preset 을 조건 없이 지웠기 때문이다(prop-asset.js, 2026-08-28 수정).
 *   실측(프로젝트 70개 «전수», 에셋 블록 934개):
 *     표식有 1 · 200x64 규격 7 · 둘 다 1 ⇒ ★표식有인데 200x64 아님 = 0 / 200x64인데 표식 없음 = 6
 *   ⇒ 표식만 세면 «6개를 놓친다». 그래서 「표식 ∪ 200x64」로 센다.
 *
 * ⚠️오탐: 우연히 200x64 인 일반 이미지가 로고로 잡힌다. 원리적으로 크기만으론 못 가른다.
 *   근거는 «위험이 낮다»지 «없다»가 아니다 — 에셋 934개 중 200x64 는 7개(0.7%)이고
 *   크기 상위 12위 안에 없다. 대부분 에셋은 height 만 잡혀 있는데 200x64 는 둘 다 명시라 드물다.
 *
 * ★★파일에는 «아무것도 안 쓴다» — 표시 전용이다.
 *   같은 오탐률이면 사용자 프로젝트 파일에 박는 쪽이 아니라 화면에만 있는 쪽을 고른다.
 *   화면은 틀려도 코드 한 줄로 걷어내지만, 파일에 박힌 오탐은 사용자가 발견할 방법이 없다.
 *
 * ⇒ 걷어낼 조건: 「표식만으로 세도 같은 수가 나오는 날」. 그때 || _isLogoSized 절을 지운다.
 * ★export 인 이유: 프로브가 이 술어를 «재구현»하면 여기를 고쳐도 프로브가 안 죽는다. */
export const LOGO_W = 200, LOGO_H = 64;
export const _isLogoSized = (ab) =>
  parseInt(ab.style.width) === LOGO_W && parseInt(ab.style.height) === LOGO_H;
/** 에셋 블록 목록에서 «로고로 셀 것»을 고른다(표식 ∪ 규격). 파일은 안 건드린다. */
/* 점프 상태 — 키별 대상 배열과 «지금 몇 번째». 패널을 다시 그리면 대상은 갱신되고 커서는 유지한다. */
let _jumpTargets = {};
const _jumpIdx = {};

/** 요소를 화면 가운데로 데려오고 잠깐 표시한다. selectSection 과 같은 «실제 좌표» 방식. */
function jumpToElement(el) {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap || !el) return;
  const delta = el.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
  // 블록은 섹션보다 작으니 «가운데»에 놓는다 — 위에 40px 만 두면 뭘 가리키는지 알기 어렵다.
  const center = Math.max(0, wrap.clientHeight / 2 - el.getBoundingClientRect().height / 2);
  /* 스크롤이 «실제로 일어나는지»를 먼저 안다 — 이미 화면 안이면 scrollend 가 «영영 안 온다».
     scrollTo 는 범위를 클램프하므로 우리도 같은 클램프로 재야 예측이 맞는다. */
  const maxTop  = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
  const wantTop = Math.min(maxTop, Math.max(0, wrap.scrollTop + delta - center));
  const willScroll = Math.abs(wantTop - wrap.scrollTop) > 1;
  wrap.scrollTo({ top: wantTop, behavior: 'smooth' });

  /* ★그 블록을 «고른다» — 깜빡임만으로는 1.2초 뒤 아무 표시도 안 남아
     「어디로 간 건지」를 알 수 없었다(현빈 2026-09-04). 선택하면 아웃라인이 남고
     우측 패널도 그 블록으로 바뀐다. 섹션이면 selectSection, 블록이면 selectBlock.
   ★★두 갈래는 «인자가 다르다»(2026-09-09):
       selectSection(sec)  — editor.js:2686, «요소»를 받는다
       selectBlock(id)     — block-edit.js:18, «id 문자열»을 받아 getElementById 한다
     여기서 요소를 넘기고 있었다 ⇒ String(el) = "[object HTMLDivElement]" ⇒ 항상 null ⇒ false.
     즉 「선택해서 아웃라인을 남긴다」가 블록 대상에선 «처음부터 한 번도» 안 됐다
     (실측 12/12 클릭에서 .selected 부착 0건). 레포의 다른 호출부는 전부 block.id 를 넘긴다. */
  try {
    if (el.classList.contains('section-block')) window.selectSection?.(el);
    else if (el.id) window.selectBlock?.(el.id);   // id 없는 블록은 getElementById 로 못 찾는다
  } catch (_) {}

  /* ★표시는 «클릭 즉시» 붙인다(2026-09-09). 옛 판은 320ms «선지연» 뒤에 붙였는데,
       목록을 훑는 리듬이 그보다 빠르면 붙기 «전에» 다음 클릭의 _clearFlash 가 지운다
       ⇒ 화면에 아무 표시도 안 뜬다. 실측(파테나·heading 12개·zoom 40%·클릭 12회):
         200ms 간격 1/12 · 300ms 1/12 · 500ms 11/12 (1 은 마지막 클릭 — 뒤에 다음 클릭이 없다)
       400ms 부근이 경계라 사용자에겐 「됐다 안 됐다」로 느껴졌다. 간헐이 아니라 리듬의 함수다.
     ★지우기는 반대로 «스크롤이 멈춘 뒤»부터 센다 — smooth 스크롤이 구르는 동안 시간이 흘러
       긴 점프에서는 도착 «전에» 표시가 죽었다(정착 ≈2,050ms vs 강조 종료 ≈1,850ms).
       scrollend 지원은 이 Electron 에서 확인했다('onscrollend' in #canvas-wrap === true). */
  /* ⛔[M59] 타이머로 «누가» 지울지를 기억하지 마라 — 현빈 2026-09-06:
       「옮겨다니면서 … 파란색 볼드 아웃라인이 시간지나면 사라져야되는데 계속 남아있는 버그」
     옛 코드는 지우기 타이머가 «하나»(_t2)뿐이라, 1.7초(320+1400) 안에 다음 항목을 누르면
     clearTimeout(_t2) 가 «앞 블록의 지우기»를 취소했다 → 지나온 블록마다 아웃라인이 «영구히» 남는다.
     6개를 훑는 것이 이 기능의 «정상 사용»이라 사실상 항상 재현된다.
   ⇒ 지우는 대상을 «기억»하지 말고 «화면에서 찾아» 지운다. 타이머가 몇 개 살아 있든,
     중간에 패널이 다시 그려지든, 블록이 교체되든(undo·협업) 남지 않는다.
     ★이 방식은 타이머 상태와 «무관»하다 — 그게 요점이다. */
  const _clearFlash = () => document.querySelectorAll('.insp-jump-flash')
    .forEach(n => n.classList.remove('insp-jump-flash'));
  clearTimeout(jumpToElement._t);
  clearTimeout(jumpToElement._t2);
  // 앞 클릭이 걸어 둔 scrollend 대기도 «지금» 거둔다 — 안 그러면 리스너가 쌓인다.
  if (jumpToElement._onEnd) wrap.removeEventListener('scrollend', jumpToElement._onEnd);
  jumpToElement._onEnd = null;

  _clearFlash();                       // 앞 항목의 표시를 «지금» 거둔다(타이머를 안 믿는다)
  el.classList.add('insp-jump-flash'); // ★즉시 — 지연을 두면 훑는 리듬에 먹힌다

  /* 1400ms 를 «스크롤이 멈춘 뒤»부터 센다. 지우는 것은 여전히 _clearFlash —
     대상을 «기억»하지 않으므로 [M59] 의 「앞 블록이 영구히 남는」 병은 돌아오지 않는다. */
  const arm = () => {
    clearTimeout(jumpToElement._t2);
    jumpToElement._t2 = setTimeout(_clearFlash, 1400);
  };
  if (!willScroll) {
    arm();                             // 이미 화면 안 — scrollend 는 «영영 안 온다»
  } else {
    const onEnd = () => {
      wrap.removeEventListener('scrollend', onEnd);
      if (jumpToElement._onEnd === onEnd) jumpToElement._onEnd = null;
      clearTimeout(jumpToElement._t);
      arm();
    };
    jumpToElement._onEnd = onEnd;
    wrap.addEventListener('scrollend', onEnd);
    // 폴백 — scrollend 를 못 받는 판이 와도(또는 스크롤이 삼켜져도) 표시가 영구히 남지 않는다.
    jumpToElement._t = setTimeout(onEnd, 2500);
  }
}

/* 클릭 위임 — 패널은 innerHTML 로 다시 그려지므로 «행마다» 리스너를 달면 새로 그릴 때 사라진다.
   문서 레벨에 한 번만 단다. ★재진입 방지: 이미 달렸으면 다시 안 단다. */
if (typeof document !== 'undefined' && !window.__inspJumpWired) {
  window.__inspJumpWired = true;
  document.addEventListener('click', (e) => {
    const row = e.target.closest?.('.insp-jump');
    if (!row) return;
    const key = row.dataset.jump;
    /* ★지워진 블록·«숨은 시안» 안의 블록은 건너뛴다 — 셋(여기·statRow·색칩)이 «같은 술어»를 본다.
       패널을 그린 «뒤» 시안을 전환해도 여기서 한 번 더 걸러 「눌렀는데 안 움직인다」가 안 난다. */
    const list = (_jumpTargets[key] || []).filter(isJumpTarget);
    if (!list.length) return;
    const i = ((_jumpIdx[key] ?? -1) + 1) % list.length;
    _jumpIdx[key] = i;
    jumpToElement(list[i]);
    const val = row.querySelector('[data-jump-value]');
    if (val) {
      // ★「눌렀는데 안 움직인다」로 읽히지 않게 «지금 몇 번째»를 보여준다.
      val.textContent = `${i + 1}/${list.length}`;
      clearTimeout(val._t);
      val._t = setTimeout(() => { val.textContent = String(list.length); }, 2000);
    }
  });
}

export function logoBlocksOf(assetBlocks) {
  return [...assetBlocks].filter(ab => ab.dataset.preset === 'logo' || _isLogoSized(ab));
}

function renderInspectorPanel() {
  const panel = document.getElementById('inspector-stats-body');
  if (!panel) return;

  // ── 데이터 수집 ──
  /* ★분모는 «화면에 있는 것» — 숨은 A/B 시안(data-variation-active="0") 안의 블록은 세지 않는다.
   *   ⑴ 못 가는 곳을 세면 「개수는 9인데 갈 수 있는 건 7」이 된다(2026-09-09 실측 19/24 → 20/20).
   *   ⑵ ★개요(섹션·전체 블록·텍스트·이미지)도 «같은 분모»를 쓴다 — 한 패널 안에서 위는 문서 전체,
   *      아래는 보이는 것이면 「텍스트 12인데 구성 합이 9」가 되어 더 헷갈린다.
   *   ⑶ 그리고 그 분모는 이제 «배송본»과 같다 — 안 고른 시안은 내보내기에서도 빠진다
   *      (js/io/export-html.js · js/io/export-figma-json.js). 인스펙터가 「나갈 것」을 잰다.
   *   술어는 js/variation-visibility.js «한 곳». ⛔여기에 조건을 베껴 적지 마라. */
  const $all = (sel) => [...document.querySelectorAll(sel)].filter(isJumpTarget);

  const sections   = $all('.section-block');
  const textBlocks = $all('.text-block');
  const assetBlocks= $all('.asset-block');
  const gapBlocks  = $all('.gap-block');
  const iconBlocks = $all('.icon-circle-block');
  const tableBlocks= $all('.table-block');
  const labelGroupBlocks  = $all('.label-group-block');
  const graphBlocks       = $all('.graph-block');
  const dividerBlocks     = $all('.divider-block');
  const iconTextBlocks    = $all('.icon-text-block');
  const stepBlocks        = $all('.step-block');
  const canvasBlocks      = $all('.canvas-block');
  const shapeBlocks       = $all('.shape-block');

  const logoBlocks = logoBlocksOf(assetBlocks);

  /* ★[점프] 통계 행을 누르면 «그 블록들»로 순차 이동한다(현빈 2026-08-28).
   *   개수는 이미 «요소 배열»에서 나오는데 지금까지 length 만 찍고 배열은 버렸다.
   *   그 배열을 들고 있으면 이동은 공짜다. 스크롤은 selectSection 이 쓰는 것과 같은 방식. */
  _jumpTargets = {};
  const statRow = (key, label, list) => {
    /* ★여기가 「개수 = 갈 곳」의 «보장»이다 — 어떤 목록이 들어와도 같은 술어로 한 번 거른 뒤
       그 «걸러진 것»을 세고, 그 «같은 배열»을 점프 대상으로 넘긴다. 둘이 갈라질 수가 없다. */
    list = (list || []).filter(isJumpTarget);
    if (!list.length) return '';
    _jumpTargets[key] = list;
    return `<div class="insp-stat-row insp-jump" data-jump="${key}" title="클릭하면 사용된 곳으로 이동 (${list.length}개)">`
         + `<span class="insp-stat-label">${label}</span>`
         + `<span class="insp-stat-value" data-jump-value="${key}">${list.length}</span></div>`;
  };

  // 텍스트 variant 카운트
  const variantCount = { heading: 0, subheading: 0, body: 0, caption: 0, label: 0 };
  textBlocks.forEach(tb => {
    const v = tb.dataset.type;
    if (v in variantCount) variantCount[v]++;
  });

  // ── 컬러 수집 ──
  function normalizeColor(raw) {
    if (!raw) return null;
    raw = raw.trim();
    if (!raw || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return null;
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^rgb/.test(raw)) {
      const m = raw.match(/\d+/g);
      if (!m || m.length < 3) return null;
      return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
    return null;
  }

  /* ★[색 사용처] Set 이 아니라 Map(색 → 요소들)으로 모은다(현빈 2026-08-28).
   *   Set 이라 «몇 번 쓰였는지»도 «어디서 쓰였는지»도 알 수 없었다.
   *   순회는 어차피 요소 단위로 돌고 있어서 «담아두기»만 하면 된다.
   * ★개수의 정의 = 「그 색을 쓰는 «요소» 수」. 이동 대상 수와 «같은 수»여야 한다 —
   *   3이라 써놓고 두 번만 이동하면 그게 더 헷갈린다. 한 요소가 글자색·배경색 둘 다
   *   같은 색이어도 1로 센다(Set 으로 요소를 담으므로 자연히 그렇게 된다). */
  const colorMap = new Map();
  const addColor = (hex, el) => {
    if (!hex) return;
    if (!colorMap.has(hex)) colorMap.set(hex, new Set());
    if (el) colorMap.get(hex).add(el);
  };
  const colorSet = { add: (hex) => addColor(hex, null) };   // 아래 기존 호출 호환

  sections.forEach(sec => {
    // 섹션 배경색
    const bgRaw = sec.style.backgroundColor || sec.style.background;
    const bgHex = normalizeColor(bgRaw);
    addColor(bgHex, sec);

    // 텍스트 블록 색상
    sec.querySelectorAll('.text-block').forEach(tb => {
      const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-label') || tb.querySelector('div');
      if (!contentEl) return;

      // 인라인 색상 우선
      if (contentEl.style.color) {
        addColor(normalizeColor(contentEl.style.color), tb);
      } else {
        addColor(normalizeColor(window.getComputedStyle(contentEl).color), tb);
      }

      // 라벨 박스 배경색
      const labelEl = tb.querySelector('.tb-label');
      if (labelEl) {
        const lbg = labelEl.style.backgroundColor
          ? normalizeColor(labelEl.style.backgroundColor)
          : normalizeColor(window.getComputedStyle(labelEl).backgroundColor);
        addColor(lbg, tb);
      }
    });
  });

  /* 많이 쓰인 색부터 — 팔레트에서 «주조색»이 위에 오는 게 읽기 쉽다.
     ★셋 중 세 번째 자리 — 여기서도 같은 isJumpTarget 으로 거른다. 그리고 «갈 곳이 하나도 없는 색»은
       팔레트에서 뺀다: 숨은 시안에만 있던 색이 「19색」에 끼어 있으면 못 가는 칩이 하나 생긴다. */
  const colorEntries = [...colorMap.entries()]
    .map(([hex, els]) => [hex, [...els].filter(isJumpTarget)])
    .filter(([, els]) => els.length)
    .sort((a, b) => b[1].length - a[1].length);
  const colors = colorEntries.map(([hex]) => hex);
  const colorEls = new Map(colorEntries);

  // ── HTML 렌더링 ──
  const variantLabels = {
    heading: 'Heading', subheading: 'Subheading',
    body: 'Body', caption: 'Caption', label: 'Label'
  };

  const variantRows = Object.entries(variantCount)
    .filter(([, n]) => n > 0)
    .map(([k]) => statRow('v:' + k, variantLabels[k],
      textBlocks.filter(tb => tb.dataset.type === k))).join('');

  const extraBlockRows = [
    statRow('gapBlocks', 'Gap', gapBlocks),
    statRow('iconBlocks', 'Icon Circle', iconBlocks),
    statRow('tableBlocks', 'Table', tableBlocks),
    statRow('graphBlocks', 'Graph', graphBlocks),
    statRow('dividerBlocks', 'Divider', dividerBlocks),
    statRow('labelGroupBlocks', 'Tags', labelGroupBlocks),
    statRow('iconTextBlocks', 'Icon Text', iconTextBlocks),
    statRow('stepBlocks', 'Step', stepBlocks),
    /* ★표시명은 «Card» 다 — 추가 메뉴(index.html)도, 레이어 패널(layer-panel-items.js
       labels.canvas)도 Card 인데 여기만 'Canvas' 라 어긋나 있었다.
       「캔버스」는 에디터의 «작업 화면»(#canvas)을 가리키는 말로 남겨 둔다 —
       한 낱말이 두 가지를 가리키면 대화가 매번 갈린다.
       클래스명 canvas-block / id cvb_ 는 «내부 이름»이라 그대로 둔다.
       저장된 모든 프로젝트 HTML 에 박혀 있어서 바꾸면 기존 파일이 전부 깨진다. */
    statRow('canvasBlocks', 'Card', canvasBlocks),
    statRow('shapeBlocks', 'Shape', shapeBlocks),
    // 0개면 «안 그린다» — 다른 줄과 같은 규율(없는 걸 0 으로 늘어놓지 않는다)
    statRow('logoBlocks', 'Logo', logoBlocks),
  ].join('');

  /* ★칩에 «사용 횟수»를 얹고, 누르면 그 색을 쓰는 곳으로 순차 이동한다.
   *   숫자를 hex 옆에 «따로 한 줄»로 두면 19색에서 칩이 세로로 길어진다 —
   *   스와치 «위»에 작은 배지로 얹어 세로 높이를 안 늘린다. */
  const colorSwatches = colors.length
    ? colors.map(hex => {
        const els = colorEls.get(hex) || [];
        const key = 'c:' + hex;
        if (els.length) _jumpTargets[key] = els;
        return `
        <div class="insp-color-item${els.length ? ' insp-jump' : ''}"${els.length ? ` data-jump="${key}"` : ''}
             title="${hex}${els.length ? ` — ${els.length}곳에서 사용 (클릭하면 이동)` : ''}">
          <div class="insp-color-swatch" style="background:${hex}">${
            els.length ? `<span class="insp-color-count" data-jump-value="${key}">${els.length}</span>` : ''
          }</div>
          <span class="insp-color-hex">${hex}</span>
        </div>`;
      }).join('')
    : '<span class="insp-empty">색상 없음</span>';

  const totalBlocks = textBlocks.length + assetBlocks.length + gapBlocks.length + iconBlocks.length + tableBlocks.length + graphBlocks.length + dividerBlocks.length + labelGroupBlocks.length + iconTextBlocks.length + stepBlocks.length + canvasBlocks.length + shapeBlocks.length;

  panel.innerHTML = `
    <div class="insp-section">
      <div class="insp-section-title">개요</div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">섹션</span>
        <span class="insp-stat-value">${sections.length}</span>
      </div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">전체 블록</span>
        <span class="insp-stat-value">${totalBlocks}</span>
      </div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">텍스트</span>
        <span class="insp-stat-value">${textBlocks.length}</span>
      </div>
      <div class="insp-stat-row">
        <span class="insp-stat-label">이미지</span>
        <span class="insp-stat-value">${assetBlocks.length}</span>
      </div>
      ${extraBlockRows}
    </div>

    <div class="insp-section">
      <div class="insp-section-title">텍스트 구성</div>
      ${variantRows || '<span class="insp-empty">텍스트 블록 없음</span>'}
    </div>

    <div class="insp-section">
      <div class="insp-section-title">
        컬러 팔레트
        <span class="insp-badge">${colors.length}색</span>
      </div>
      <div class="insp-color-grid">
        ${colorSwatches}
      </div>
    </div>
  `;
}

window.renderInspectorPanel = renderInspectorPanel;
