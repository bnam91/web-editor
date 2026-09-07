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
  /* ★그림자 «끔»이면 그림자 값들은 흐리게 두되 «지우지 않는다» — 다시 켜면 그대로 돌아온다.
     (prop-laurel/prop-banner02 의 opacity:0.4;pointer-events:none 관례) */
  const dim = (on) => on ? '' : 'opacity:0.4;pointer-events:none;';

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
      <div class="prop-color-row" style="${dim(!isChecker)}">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'zm-fill', hex: fillHex, alpha: fillAlpha })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Shadow</div>
      <div class="prop-row">
        <span class="prop-label">그림자</span>
        <div class="prop-radio-group" id="zm-shadow-group">
          <label class="prop-radio"><input type="radio" name="zm-shadow" value="on"${shadowOn ? ' checked' : ''}> 켬</label>
          <label class="prop-radio"><input type="radio" name="zm-shadow" value="off"${shadowOn ? '' : ' checked'}> 끔</label>
        </div>
      </div>
      <div id="zm-shadow-fields" style="${dim(shadowOn)}">
      ${_pairRow('zm-angle', '방향°', st.angle, -180, 180, 1)}
      ${_pairRow('zm-length', '길이', st.length, 0, 1200, 1)}
      ${_pairRow('zm-spread', '벌림', st.spread, -400, 800, 1)}
      ${_pairRow('zm-maxop', '최대 농도%', st.maxop, 0, 100, 1)}
      ${_pairRow('zm-curve', '농도 곡선', st.curve, 10, 400, 1)}
      ${_pairRow('zm-narrow', '좁아짐%', st.narrow, 0, 100, 1)}
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

    <div class="prop-section">
      <div class="prop-section-title">짧은 변 (a·b)</div>
      <div class="prop-row" style="${dim(shadowOn)}">
        <span class="prop-label" style="font-size:10px;color:var(--ui-text-muted);">
          ${pinned ? '수동 — 끌어서 고정됨' : '자동 — 방향·길이를 따라감'}
        </span>
      </div>
      <div class="prop-row">
        <button class="prop-action-btn" id="zm-ab-reset" ${pinned ? '' : 'disabled'}
          style="width:100%;${pinned ? '' : 'opacity:0.4;pointer-events:none;'}">자동으로 되돌리기</button>
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
  bindPair('zm-angle',  'angle',  '확대블럭 방향',    -180, 180);
  bindPair('zm-length', 'length', '확대블럭 길이',       0, 1200);
  bindPair('zm-spread', 'spread', '확대블럭 벌림',    -400, 800);
  bindPair('zm-maxop',  'maxop',  '확대블럭 농도',       0, 100);
  bindPair('zm-curve',  'curve',  '확대블럭 농도곡선',  10, 400);
  bindPair('zm-narrow', 'narrow', '확대블럭 좁아짐',     0, 100);
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
  bindRadio('zm-shadow', 'shadow', '확대블럭 그림자');
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
