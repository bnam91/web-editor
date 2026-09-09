// ── 확대블럭(zoom-block) 프로퍼티 패널 ───────────────────────────────────────
// 헤더는 신규 블록 체크리스트가 요구하는 풀 구조:
//   prop-block-label > prop-block-icon + prop-block-info + prop-block-id
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const D = () => (window.ZOOM_DEFAULTS || {});

function _st(block) {
  return window.readZoomState ? window.readZoomState(block) : { ...D() };
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 슬라이더 + 숫자 한 쌍. dataset[key] 에 쓰고 재렌더. */
function _pairRow(id, label, value, min, max, step) {
  return `
    <div class="prop-row">
      <span class="prop-label">${label}</span>
      <input type="range" class="prop-slider" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
      <input type="number" class="prop-number" id="${id}-num" min="${min}" max="${max}" step="${step}" value="${value}">
    </div>`;
}

export function showZoomProperties(block) {
  const st = _st(block);
  const pinned = !!(window.readPinnedZoomShortEdge?.(block));
  const isChecker = st.fill === 'checker';
  // 체크패턴일 땐 색 피커에 «되돌아갈 색»을 보여준다(피커가 'checker' 를 못 읽는다).
  const fillHex   = isChecker ? '#cfd6e0' : st.fill;
  const fillAlpha = parseAlphaFromColor(fillHex);
  const bdcAlpha  = parseAlphaFromColor(st.bdc);
  const shadowOn  = st.shadow !== 'off';
  const bdOn      = st.bd === 'on';
  const hasImg    = !!st.imgSrc;
  /* ★그림자 «끔»이면 그림자 값들은 흐리게 두되 «지우지 않는다» — 다시 켜면 그대로 돌아온다.
     (prop-laurel/prop-banner02 의 opacity:0.4;pointer-events:none 관례) */
  const dim = (on) => on ? '' : 'opacity:0.4;pointer-events:none;';

  /* ★★벌림은 «양(陽)만» — 현빈 2026-09-09 「벌림 음수 안 되게 양(陽) 간만」.
       슬라이더·숫자 상자의 하한을 −400 → 0 으로 올렸다(위 _pairRow 인자, 아래 bindPair 인자).
     ★옛 저장본에 «음수»가 들어 있을 수 있다 — 하한이 −400 이던 시절의 프로젝트다.
       그때 무슨 일이 나는가를 재서 골랐다:
         ⑴ range 입력은 value 가 min 보다 작으면 «스스로» min 으로 올려 잡는다 ⇒ 슬라이더는 0.
         ⑵ 그런데 number 입력은 min 을 «검사용»으로만 쓴다 ⇒ 숫자 상자엔 −30 이 그대로 뜬다.
       ⇒ 손대지 않으면 «한 줄에서 슬라이더는 0, 숫자는 −30» 이 된다. 그게 조용히 깨진 꼴이다.
     ★그래서 «보여 주는 값»을 한 번 접어 둘을 맞춘다. 기하도 같은 자리에서 0 으로 떨어진다
       (zoom-geometry.js computeZoomGeometry 의 `Math.max(0, …)` — 그 옆에 근거를 적었다).
       ⇒ 패널·캔버스가 «같은 말»을 한다.
     ⛔저장본을 말없이 고쳐 쓰지 «않는다» — block.dataset.spread 는 −30 그대로 남는다.
       사람이 슬라이더를 실제로 만지는 «그 순간»에만 0..800 안의 값으로 덮인다(bindPair 의 clamp).
       결정이 뒤집히면 옛 값이 그대로 살아나온다. */
  const spreadShown = Math.max(0, st.spread);

  /* ★[숨김] 테두리 «모서리»(bdr) 슬라이더 — 현빈 2026-09-08
       「보더 모서리 라디우스 슬라이드 패널은 숨김처리해줘 «아직»」
     ⛔왜 «아직»인가 = zoom-block.js 머리 ③ 에 적은 그것이다: bdr 은 실루엣 계산에 «안» 들어간다
       (꼭짓점 기준). 라운드를 크게 주면 그림자 사다리꼴이 붙는 점이 모서리에서 뜬다.
       ⇒ 라운드와 실루엣이 맞을 때까지 «입구만» 닫는다.
     ⛔코드를 지우지 않는다 — data-bdr 값·렌더(shapeEl 의 rx)·저장/로드는 그대로 산다.
       기본 0 이라 화면은 안 바뀌고, 다시 켜면 그대로 돌아온다.
     ★HTML 주석(<!-- -->)으로 가리면 «안 된다» — 여기는 템플릿 리터럴 안이라 ${...} 가 그대로
       «실행»되고 마크업까지 만들어진 뒤 주석으로 감싸질 뿐이다. 그래서 변수로 빼서 JS 주석으로 막는다.
     ★되돌리기 = 아래 두 줄에서 주석을 옮기면 끝. (전례: index.html 의 Info/Inner Card 숨김) */
  // const bdrRow = _pairRow('zm-bdr', '모서리', st.bdr, 0, 200, 1);
  const bdrRow = '';

  /* ★[숨김] 방향° · 길이 · 좁아짐% — 현빈 2026-09-09
       「우측 패널에서 이펙트 섹션에서 대부분이 필요 없다. 왜냐면은 캔버스에서 조절하면 될 거
         같거든. 그래서 방향·길이·좁아짐 이거는 없어도 될 듯해」
       「좁아짐 슬라이더는 기능 없어도 될 듯」
     ★위 bdr 과 «똑같은 관용구»다(변수로 빼서 JS 주석으로 막는다). 새 방식을 만들지 않는다 —
       HTML 주석으로는 못 가린다는 이유도 그대로(템플릿 리터럴 안이라 ${...} 가 먼저 «실행»된다).
     ⛔상태 키와 기본값은 «살아 있다» — angle −90 · length 170 · narrow 62 (zoom-block.js
       ZOOM_DEFAULTS). 기하가 여전히 셋을 다 쓴다: lightPoint(angle,length) 가 광원 자리를,
       autoShortEdge(…, narrow) 가 짧은 변을 잡는다. 지우면 저장된 프로젝트가 통째로 깨진다.
     ★그럼 방향·길이는 이제 «어디서» 조절하나 — 캔버스의 빨간 「빛」 손잡이다(현빈 논지).
       빛 손잡이를 끌면 dataset.lx/ly 가 박히고, 그 뒤로는 angle·length 대신 그 자리가 이긴다.
     ★★되돌릴 길이 «있는가»를 앱에서 확인하고 지웠다 — 아래 「손잡이 자동으로 되돌리기」
       (zm-ab-reset) 가 여섯 키(ax·ay·bx·by·lx·ly)를 지운다 ⇒ 광원이 다시 angle·length 로
       돌아간다. 그 버튼이 없어지면 사람이 기본 방향으로 돌아갈 길이 사라진다 ⇒ ⛔지우지 마라.
     ★되돌리기 = 아래 여섯 줄에서 주석을 옮기면 끝. */
  // const angleRow  = _pairRow('zm-angle',  '방향°',   st.angle,  -180, 180, 1);
  const angleRow  = '';
  // const lengthRow = _pairRow('zm-length', '길이',    st.length,    0, 1200, 1);
  const lengthRow = '';
  // const narrowRow = _pairRow('zm-narrow', '좁아짐%', st.narrow,    0, 100, 1);
  const narrowRow = '';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="3.5" width="5" height="5" rx="0.6"/>
            <path d="M6 4.6 L11 6 L6 7.4" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${_esc(block.dataset.layerName || 'Zoom')}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Shape</div>
      <div class="prop-row">
        <div class="prop-align-group" id="zm-shape-group">
          <button class="prop-align-btn${st.shape === 'rect' ? ' active' : ''}" data-shape="rect" title="사각형 (기본)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="4.5" width="13" height="7" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${st.shape === 'circle' ? ' active' : ''}" data-shape="circle" title="원">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
          <button class="prop-align-btn${st.shape === 'square' ? ' active' : ''}" data-shape="square" title="정사각형">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>
          </button>
        </div>
      </div>
      ${_pairRow('zm-size', '크기', st.size, 20, 600, 2)}
      ${_pairRow('zm-rot', '회전°', st.rot, -180, 180, 1)}
      <div class="prop-row">
        <span class="prop-label">배경</span>
        <div class="prop-radio-group" id="zm-bg-group">
          <label class="prop-radio"><input type="radio" name="zm-bg" value="checker"${isChecker ? ' checked' : ''}> 체크패턴</label>
          <label class="prop-radio"><input type="radio" name="zm-bg" value="color"${isChecker ? '' : ' checked'}> 색</label>
        </div>
      </div>
      <div class="prop-color-row" style="${dim(!isChecker || hasImg)}">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'zm-fill', hex: fillHex, alpha: fillAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label" style="font-size:10px;color:var(--ui-text-muted);">
          ${hasImg ? '이미지 — 도형 «안»에 담긴다(모양·기하는 안 바뀐다)' : '이미지를 넣으면 도형 안을 채운다'}
        </span>
      </div>
      <div id="zm-img-drop" style="border:2px dashed var(--ui-border-mid, #444);border-radius:6px;padding:18px 10px;text-align:center;color:var(--ui-text-muted);font-size:11px;cursor:pointer;background:var(--ui-bg-input);">
        ${hasImg ? `<img src="${_esc(st.imgSrc)}" style="max-width:80px;max-height:80px;object-fit:contain;display:block;margin:0 auto 6px;">` : ''}
        <div>이미지 드래그앤드롭<br>또는 클릭해서 선택</div>
      </div>
      <!-- ★버튼은 «추가»지 «교체»가 아니다 — 현빈 2026-09-08 「버튼으로 해도되지않을까
           다른 에셋블럭들처럼?」. 어휘는 prop-asset.js 의 prop-action-btn secondary
           («이미지 선택...») 를 그대로 빌린다 — 새 클래스를 만들지 않는다.
           ⛔위 드롭존은 «남긴다». 드래그앤드롭은 지금도 되는 길이라 버튼을 붙였다고
             막으면 기능이 하나 사라진다. 둘은 같은 _applyZoomImage 로 모인다. -->
      <button class="prop-action-btn secondary" id="zm-img-btn" style="width:100%;margin-top:6px;">이미지 선택...</button>
      ${hasImg ? `<div class="prop-row"><button class="prop-action-btn" id="zm-img-clear" style="width:100%;">이미지 제거</button></div>` : ''}
    </div>

    <div class="prop-section">
      <!-- ★제목·라벨만 «말을 바꿨다». 라디오 자체(name·value·id·핸들러)는 한 글자도 안 건드렸다.
           ★이름 = 현빈 2026-09-09: 「이건 그림자랑 달라 zoom effect라고 우측패널에 바꿔줘」.
           아래 「도형 그림자」가 현빈이 말한 «박스에 거는 드롭섀도»(x·y로 조절, 텍스트블럭 라디오와
           같은 갈래 = CSS 그림자)다. 둘 다 「그림자」라 부르면 사람이 뭐가 뭔지 모른다.
           ⛔상태 키(st.shadow)와 id(zm-shadow*)는 그대로 둔다 — 바꾸면 저장된 프로젝트가 깨진다. -->
      <div class="prop-section-title">Zoom Effect</div>
      <div class="prop-row">
        <span class="prop-label">줌 이펙트</span>
        <div class="prop-radio-group" id="zm-shadow-group">
          <label class="prop-radio"><input type="radio" name="zm-shadow" value="on"${shadowOn ? ' checked' : ''}> 켬</label>
          <label class="prop-radio"><input type="radio" name="zm-shadow" value="off"${shadowOn ? '' : ' checked'}> 끔</label>
        </div>
      </div>
      <div id="zm-shadow-fields" style="${dim(shadowOn)}">
${angleRow}${lengthRow}
      ${_pairRow('zm-spread', '벌림', spreadShown, 0, 800, 1)}
      ${_pairRow('zm-maxop', '최대 농도%', st.maxop, 0, 100, 1)}
      ${_pairRow('zm-curve', '농도 곡선', st.curve, 10, 400, 1)}
${narrowRow}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Border</div>
      <div class="prop-row">
        <span class="prop-label">테두리</span>
        <div class="prop-radio-group" id="zm-bd-group">
          <label class="prop-radio"><input type="radio" name="zm-bd" value="on"${bdOn ? ' checked' : ''}> 켬</label>
          <label class="prop-radio"><input type="radio" name="zm-bd" value="off"${bdOn ? '' : ' checked'}> 끔</label>
        </div>
      </div>
      <div id="zm-bd-fields" style="${dim(bdOn)}">
      ${_pairRow('zm-bdw', '두께', st.bdw, 0, 80, 1)}
${bdrRow}
      <div class="prop-color-row">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'zm-bdc', hex: st.bdc, alpha: bdcAlpha })}
      </div>
      </div>
    </div>

    <!-- ★★도형 그림자 — 현빈 2026-09-08 「줌블럭에 쉐도우 온오프 기능도 «별도로»」.
         ★「광원」과 이것을 패널에서 가르는 법 = 세 겹으로 갈랐다:
           ① 말   — 위는 「Zoom Effect」, 여기는 「도형 그림자」. 둘 다 '그림자'라 안 부른다.
           ② 자리 — 붙여 두면 헷갈린다. Border 를 사이에 끼워 «떨어뜨렸다».
                    그리고 이건 도형의 «생김새»(테두리 옆)지 돋보기 장치가 아니다.
           ③ 생김 — 광원은 «라디오 켬/끔»(두 갈래), 이건 «버튼 3단»(prop-align-group).
                    컨트롤 «모양»이 달라 눈으로도 다른 것임을 안다.
         ⛔체크박스로 만들면 안 된다 — 검사 ⓑ-14 가 이 파일에 체크박스 입력이 «없음»을 단언한다
           (현빈이 「라디오버튼으로」라고 못박은 것). prop-sticker 의 prop-toggle 을 통째로
           베끼지 않은 이유가 이것이다. 실측으로 확인하고 골랐다.
         ⚠️그 «금지된 문자열»을 여기 주석에 그대로 적으면 검사가 오발한다 — 실제로 한 번 물렸다.
           이 주석은 템플릿 리터럴 «안»이라 JS 주석 걷기가 못 걷어낸다. 말로만 적는다.
         ★어휘(없음/부드럽게/강하게 · none/soft/strong)는 prop-mockup.js:93-95 를 그대로 빌렸다. -->
    <div class="prop-section">
      <div class="prop-section-title">도형 그림자 (줌 이펙트와 별개)</div>
      <div class="prop-row">
        <div class="prop-align-group" id="zm-drop-group">
          <button class="prop-align-btn${st.dropShadow === 'none'   ? ' active' : ''}" data-val="none">없음</button>
          <button class="prop-align-btn${st.dropShadow === 'soft'   ? ' active' : ''}" data-val="soft">부드럽게</button>
          <button class="prop-align-btn${st.dropShadow === 'strong' ? ' active' : ''}" data-val="strong">강하게</button>
        </div>
      </div>
      <!-- ⛔여기에 «안내문 행»을 두면 안 된다 — 실앱 240px 에서 실측하고 뺐다.
           prop-label 은 폭 ~56px 짜리 «라벨 칸»이라 문장이 「도형이 «자...」로 잘린다.
           (같은 자리의 이미지 안내문도 「이미지를 넣...」으로 잘려 있다 — 기존 흠이다.)
           ⇒ 가르는 말은 «절 제목»에 넣는다. 제목은 폭을 다 쓴다(실측 확인).
           ⚠️이 주석은 템플릿 리터럴 «안»이다 — 백틱을 쓰면 리터럴이 «거기서 끝나» 터진다.
             실제로 한 번 물렸다(ReferenceError: label is not defined). 백틱 금지. -->
    </div>

    <div class="prop-section">
      <!-- ★손잡이 셋 — 현빈 승인 2026-09-09. 색은 css/editor-blocks.css 가 칠한다(빨강 L · 보라 a·b).
           ⛔안내문을 prop-label 안에 넣으면 «폭 56px 라벨 칸»에서 잘린다(이 파일 아래 실측 주석 참조).
             그래서 제목이 어휘를 지고, 안내문은 폭을 다 쓰는 행에 둔다. -->
      <div class="prop-section-title">손잡이 (빛 · a · b)</div>
      <div class="prop-row" style="${dim(shadowOn)}">
        <span style="font-size:10px;color:var(--ui-text-muted);line-height:1.5;">
          빨간 점 = 빛. 짧은 변을 통째로 옮긴다.<br>
          보라 점 = a·b. 각자 벌린다.<br>
          ${pinned ? '지금 — 수동(끌어서 고정됨)' : '지금 — 자동(방향·길이를 따라감)'}
        </span>
      </div>
      <div class="prop-row">
        <button class="prop-action-btn" id="zm-ab-reset" ${pinned ? '' : 'disabled'}
          style="width:100%;${pinned ? '' : 'opacity:0.4;pointer-events:none;'}">손잡이 자동으로 되돌리기</button>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderZoomBlock?.(block);

  // Shape 프리셋 토글
  propPanel.querySelectorAll('#zm-shape-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.shape;
      if (block.dataset.shape === next) return;
      window.pushHistory?.('확대블럭 모양');
      propPanel.querySelectorAll('#zm-shape-group .prop-align-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.shape = next;
      // ★모양이 바뀌면 실루엣이 통째로 달라진다 — 사람이 끈 a·b 는 «그 모양의» 값이라 뜻이 없다.
      //   자동으로 되돌린다(고정을 남기면 광원과 그림자가 따로 논다).
      window.clearPinnedZoomShortEdge?.(block);
      // ★프리셋이 바뀌면 «비율»이 달라진다 — 핸들로 끈 w/h 를 남기면 프리셋이 구실을 못 한다.
      window.clearZoomSizeOverride?.(block);
      rerender();
      showZoomProperties(block);
      window.triggerAutoSave?.();
    });
  });

  /* 도형 그림자 3단 — Shape 프리셋 토글과 «같은 하네스»다(새 관용구를 안 만든다).
     ⛔dataset.shadow(광원)를 «안» 건드린다 — 키가 따로다.
     ★rerender() 를 안 부른다: 이건 기하가 «한 줄도» 안 바뀐다. 칠하는 일은 CSS 가
       data-drop-shadow 를 보고 한다(css/editor-blocks.css). 실루엣·A·B·a·b 는 그대로다.
       ⇒ 괜히 다시 그리면 사람이 집어 둔 앵커(_zoomPicked)만 잃는다. */
  propPanel.querySelectorAll('#zm-drop-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.val;
      if (block.dataset.dropShadow === next) return;
      window.pushHistory?.('확대블럭 도형 그림자');
      propPanel.querySelectorAll('#zm-drop-group .prop-align-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.dropShadow = next;
      window.triggerAutoSave?.();
    });
  });

  // 슬라이더 + 숫자 쌍
  const bindPair = (id, key, label, min, max) => {
    const s = propPanel.querySelector('#' + id);
    const n = propPanel.querySelector('#' + id + '-num');
    if (!s || !n) return;
    const apply = v => {
      const val = Math.min(max, Math.max(min, v));
      /* ★크기 슬라이더는 «덧씌우개»를 지운다 — 안 지우면 핸들로 한 번 끈 뒤로 슬라이더가
         아무 반응도 안 한다(w/h 가 이기기 때문). a·b 의 「자동으로 되돌리기」와 같은 규율. */
      if (key === 'size') window.clearZoomSizeOverride?.(block);
      /* ★★방향°·길이는 «빛을 옮기는 슬라이더»다 — 손잡이 셋(ax/ay·bx/by·lx/ly)을 «다» 푼다.
         ⛔안 풀면 슬라이더를 끝까지 밀어도 화면이 «한 픽셀도» 안 움직인다: 고정이 이기기 때문이다.
           (크기 슬라이더가 w/h 에서 이미 겪은 그 병 — 같은 처방을 같은 자리에 둔다.)
         ★셋을 «따로» 풀지 않는다: 빛만 풀고 a·b 를 남기면 축과 짧은 변이 따로 놀아
           빔이 꼬인다. 손잡이는 한 덩어리로 자동으로 돌아간다. */
      /* ★지금은 이 두 갈래로 «들어오지 않는다» — 방향°·길이 슬라이더가 가려져 있다(위 [숨김]).
         ⛔그래도 지우지 않는다: 슬라이더를 되살리는 순간 이 줄이 없으면 그 병이 그대로 돌아온다. */
      if (key === 'angle' || key === 'length') window.clearPinnedZoomShortEdge?.(block);
      block.dataset[key] = String(val);
      s.value = val; n.value = val;
      rerender();
    };
    s.addEventListener('input', e => apply(parseFloat(e.target.value)));
    n.addEventListener('input', e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) apply(v); });
    const commit = () => { window.pushHistory?.(label); window.triggerAutoSave?.(); };
    s.addEventListener('change', commit);
    n.addEventListener('change', commit);
  };
  bindPair('zm-size',   'size',   '확대블럭 크기',      20, 600);
  bindPair('zm-rot',    'rot',    '확대블럭 회전',    -180, 180);
  // ★[숨김] 위 angleRow·lengthRow 와 «짝»이다 — UI 가 없는데 바인딩만 남기면 안 된다(bdr 과 같은 규율).
  // bindPair('zm-angle',  'angle',  '확대블럭 방향',    -180, 180);
  // bindPair('zm-length', 'length', '확대블럭 길이',       0, 1200);
  bindPair('zm-spread', 'spread', '확대블럭 벌림',       0, 800);
  bindPair('zm-maxop',  'maxop',  '확대블럭 농도',       0, 100);
  bindPair('zm-curve',  'curve',  '확대블럭 농도곡선',  10, 400);
  // ★[숨김] 위 narrowRow 와 «짝». ⛔상태 키 st.narrow 와 기본값 62 는 «살아 있다».
  // bindPair('zm-narrow', 'narrow', '확대블럭 좁아짐',     0, 100);
  bindPair('zm-bdw',    'bdw',    '확대블럭 테두리 두께',  0, 80);
  // ★[숨김] 위 _pairRow 와 «짝»이다 — UI 가 없는데 바인딩만 남기면 안 된다. 같이 가린다.
  //   (bindPair 는 querySelector 결과가 없으면 조용히 return 하므로 남겨도 «오류는 안 난다» —
  //    실측으로 확인했다. 그래도 「없는 요소를 찾는 코드」는 다음 사람을 헷갈리게 하니 가린다.)
  // bindPair('zm-bdr',    'bdr',    '확대블럭 테두리 모서리', 0, 200);

  /* 라디오 두 벌 — ⛔값을 «지우지 않는다». dataset 에 'on'/'off' 만 쓰고 재렌더한다.
     그래서 끄고 켜기를 반복해도 방향·길이·농도가 그대로 돌아온다(검사 ⓑ-14·변이 M14). */
  const bindRadio = (name, key, label) => {
    propPanel.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        window.pushHistory?.(label);
        block.dataset[key] = r.value;
        rerender();
        showZoomProperties(block);   // 흐리게/진하게 갱신
        window.triggerAutoSave?.();
      });
    });
  };
  bindRadio('zm-shadow', 'shadow', '줌 이펙트');
  /* 배경 라디오 — 'checker' 는 «색이 아니라 무늬»라 dataset.fill 에 그 낱말을 넣는다.
     색으로 되돌릴 땐 피커가 들고 있던 색을 그대로 쓴다(따로 기억해 두지 않는다). */
  propPanel.querySelectorAll('input[type="radio"][name="zm-bg"]').forEach(r => {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      window.pushHistory?.('확대블럭 배경');
      block.dataset.fill = (r.value === 'checker')
        ? 'checker'
        : (propPanel.querySelector('#zm-fill-color')?.value || '#cfd6e0');
      rerender();
      showZoomProperties(block);
      window.triggerAutoSave?.();
    });
  });
  bindRadio('zm-bd',     'bd',     '확대블럭 테두리');

  wireColorField('zm-fill', {
    initialAlpha: fillAlpha,
    onApply: (c) => { block.dataset.fill = c; rerender(); },
    onCommit: () => { window.pushHistory?.('확대블럭 색'); window.triggerAutoSave?.(); },
  });

  wireColorField('zm-bdc', {
    initialAlpha: bdcAlpha,
    onApply: (c) => { block.dataset.bdc = c; rerender(); },
    onCommit: () => { window.pushHistory?.('확대블럭 테두리 색'); window.triggerAutoSave?.(); },
  });

  /* ★㉒ 이미지 — 스티커의 전례를 그대로 따른다(prop-sticker.js:673~).
     ⛔dataset.imgSrc 에 넣는다 ⇒ 캔버스 HTML 스냅샷에 «자동으로» 실린다(저장/로드 별도 작업 없음).
     ⛔5MB 상한도 전례대로 — 큰 dataURL 은 저장본을 통째로 무겁게 만든다. */
  const _applyZoomImage = (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { window.showToast?.('⚠️ 5MB 이하 이미지만 지원'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      window.pushHistory?.('확대블럭 이미지');
      block.dataset.imgSrc = ev.target.result;
      rerender();
      window.triggerAutoSave?.();
      showZoomProperties(block);   // 썸네일 + 제거 버튼
    };
    reader.readAsDataURL(file);
  };
  // 파일 선택창 — 버튼과 드롭존 클릭이 «같은» 입구를 쓴다.
  const _pickZoomImage = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => _applyZoomImage(inp.files?.[0]);
    inp.click();
  };
  propPanel.querySelector('#zm-img-btn')?.addEventListener('click', _pickZoomImage);
  const drop = propPanel.querySelector('#zm-img-drop');
  if (drop) {
    drop.addEventListener('click', _pickZoomImage);
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => {
      e.preventDefault(); e.stopPropagation();
      drop.style.borderColor = 'var(--sel-color)';
    }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, (e) => {
      e.preventDefault(); e.stopPropagation();
      drop.style.borderColor = '';
    }));
    drop.addEventListener('drop', (e) => _applyZoomImage(e.dataTransfer?.files?.[0]));
  }
  propPanel.querySelector('#zm-img-clear')?.addEventListener('click', () => {
    window.pushHistory?.('확대블럭 이미지 제거');
    delete block.dataset.imgSrc;
    rerender();
    window.triggerAutoSave?.();
    showZoomProperties(block);
  });

  propPanel.querySelector('#zm-ab-reset')?.addEventListener('click', () => {
    if (!window.readPinnedZoomShortEdge?.(block)) return;
    window.pushHistory?.('확대블럭 짧은 변 자동');
    window.clearPinnedZoomShortEdge?.(block);
    rerender();
    showZoomProperties(block);
    window.triggerAutoSave?.();
  });
}

window.showZoomProperties = showZoomProperties;
