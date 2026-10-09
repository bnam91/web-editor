/* ── Quote 블록 프로퍼티 패널 — 인용구 (★v1) ──────────────────────────────────
   ★이름 = 「인용구」 / `quote` ★하나다(지디 판정 2026-10-07 · 근거는 현빈 자신의
     「★인용구 느낌의 블럭이야」). ★단 ★사람이 읽는 ★한 자리(아래 절 부제)에 ★입말
     「쉼표」를 남긴다 — 현빈이 「쉼표」로 찾을 때 못 찾으면 ★그게 다음 메모가 된다.

   ★prop-coupon.js 의 관례를 그대로 쓴다: colorFieldHTML/wireColorField · 슬라이더+숫자 «쌍» ·
     blockHeaderHTML · setRpIdBadge · ★dataset 에 쓰고 rerender() · pushHistory 는 ★push-after.
   ⛔블럭 DOM 에 인라인으로 박지 마라 — renderQuoteBlock 이 innerHTML 을 통째로 새로 만든다.

   ★min/max 는 ★리터럴로 쓰지 않는다 — quote-block.js 의 QUOTE_LIMITS ★한 표에서 온다.
   ★부호 8종의 이름·글리프도 ★QUOTE_SHAPES ★한 명부에서 온다. ⛔여기서 다시 적지 않는다.

   ══ ★「모양」 줄은 ★`.prop-align-group`(wrap) 이다 — ⛔세그먼트가 ★아니다 ════════
   ★★실측으로 골랐다(2026-10-07 · tests/dom/_probe-qt1-*.spec.js · ×3):
     ★우측 패널 줄 내용폭 = ★211px · 「모양」 라벨 56px ⇒ ★남는 폭 ★155px
     ⒜ `.prop-type-group` ＋ 8단추 → 자연폭 ★174 > 155 ⇒ ★★2개가 넘치고
        ★`〈 〉`(8번째)는 ★elementFromPoint 가 ★`panel-body` 를 돌려준다 = ★★안 눌린다
     ⒝ `.prop-align-group` ＋ 8단추 → ★2줄로 접히고 ★넘침 0 · ★안 닿는 단추 0 ⇒ ★★이 꼴
   ★★⚠️그리고 ★이 고장은 ★«기존 자 둘»이 ★못 본다 — ★그게 이 줄을 적는 까닭이다:
     `min-width:max-content` ⇒ ★안 눌린다(자 ㉠ «자연폭» = 0건)
     `white-space:nowrap`    ⇒ ★안 쪼개진다(자 ㉡ «구별되는 y» = 0건)
     `.prop-row{overflow:hidden}` ⇒ ★그냥 ★★«잘린다»
   ⇒ ★★자 ㉢ ★«잘렸나» 가 필요하다 = ★기하(오른끝 넘었나) ＋ ★`elementFromPoint(가운데)`
     ⛔`scrollWidth > clientWidth` 금지(flex:1 이면 ★항등식) · ⛔`getClientRects().length` 금지(글자 토막 수)
     ★그 자는 tests/dom/quote-block.dom.spec.js 가 ★들고 있다.

   ══ ⛔v1 패널에 ★없는 줄 (★이름으로 적는다) ═══════════════════════════════════
   ★★「에셋(SVG·이미지)」 — ⛔넣지 않는다. ★피그마 `generic` 분기가 `block.svg` 를
     ★한 번도 안 읽어 ★부호가 조용히 사라진다(P-export 실측 · sangpe_to_figma.mjs:1356).
     ⇒ ★없는 걸 보여 주면 ★「되는 줄 알았다」가 된다. ★v2 에서 ★피그마 분기와 ★같이 켠다.
   ★「줄마다 따로 꾸밈」 · 「좌우반전 이미지」 · 「프리셋」 · 「앞뒤 다른 모양 섞기」 — 전부 v2.

   ★히스토리 — ⛔이 파일은 `update*Block` 이라는 이름을 ★안 부른다(그런 이름이 없다).
     dataset 에 쓰고 renderQuoteBlock 으로 다시 그린 ★뒤에 pushHistory 를 ★한 번 한다
     (push-after · prop-coupon.js 와 같은 까닭) ⇒ 한 제스처 = 한 칸.
*/
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
/* ★HTML 이스케이프는 ★정본 하나다 — ⛔제 사본을 만들지 마라
   (tests/unit/name-axes-to-markup X9 가 사본 수를 센다). */
/* ★정렬 단추는 ★`alignBtn` ★한 곳에서 나온다 — ⛔SVG 를 ★여기 적지 마라
   (tests/unit/align-btn-ssot.test.mjs T1·T2 가 ★이 파일을 ★MIGRATED 로 ★끌어들여 센다).
   ★`attrs` 는 ★`data-al` 이다 — ⛔`data-align` 을 ★쓰지 마라: prop-text-wireup-align.js:8 이
     `.prop-align-btn` 을 ★전부 잡아 `dataset.align` ★유무로만 거른다 ⇒ ★엉뚱한 블럭이
     ★조용히 정렬된다. ★prop-modal.js:263~265 가 ★같은 까닭으로 `data-al` 을 쓴다(그 선례를 베꼈다). */
import { blockHeaderHTML, escHtml as _esc, alignBtn } from './_helpers.js';
import {
  QUOTE_SHAPES, QUOTE_SHAPE_KEYS, QUOTE_DEFAULTS, QUOTE_LIMITS, clampQuote,
  quoteLines, quoteShapeOf, quoteIsPlaceholder, quoteShapesAll,
} from '../blocks/quote-block.js';

const L = QUOTE_LIMITS;

/** 스와치가 보여 줄 hex — prop-coupon._swatchHex 와 ★같은 규칙. */
function _swatchHex(v, dflt) {
  const s = String(v || '').trim();
  const m6 = s.match(/#([0-9a-fA-F]{6})\b/);
  if (m6) return '#' + m6[1].toLowerCase();
  const m3 = s.match(/#([0-9a-fA-F]{3})\b/);
  if (m3) return '#' + m3[1].toLowerCase().split('').map(ch => ch + ch).join('');
  const rgb = s.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const p = rgb[1].split(',').map(x => parseInt(x, 10));
    const to = n => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
    return '#' + to(p[0]) + to(p[1]) + to(p[2]);
  }
  return dflt;
}

const _ICON = `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M3 8 Q3 4 5 3.5"/><path d="M7 8 Q7 4 9 3.5"/>
          </svg>`;

/** 슬라이더＋숫자 한 쌍 — prop-coupon._pairRow 와 ★같은 꼴. */
function _pairRow(id, label, val, min, max, step = 1) {
  return `
      <div class="prop-row">
        <span class="prop-label">${_esc(label)}</span>
        <input type="range" class="prop-slider" id="${id}-slider" min="${min}" max="${max}" step="${step}" value="${val}">
        <input type="number" class="prop-number" id="${id}-number" min="${min}" max="${max}" step="${step}" value="${val}">
      </div>`;
}

/**
 * 인용구 패널을 그린다.
 * @param {HTMLElement} block
 */
export function showQuoteProperties(block) {
  if (!block) return;

  const shape = quoteShapeOf(block);
  const layout = block.dataset.layout === 'stack' ? 'stack' : 'inline';
  const markSize = clampQuote(Number(block.dataset.markSize) ?? QUOTE_DEFAULTS.markSize, L.markSize);
  const gap = clampQuote(Number(block.dataset.gap) ?? QUOTE_DEFAULTS.gap, L.gap);
  const fontSize = clampQuote(Number(block.dataset.fontSize) ?? QUOTE_DEFAULTS.fontSize, L.fontSize);
  const markColor = block.dataset.markColor || QUOTE_DEFAULTS.markColor;
  const textColor = block.dataset.textColor || QUOTE_DEFAULTS.textColor;
  /* ★가로 정렬 — ★모델은 ★이미 있었다(quote-block.js `_qtState.align`). ★없던 것은 ★이 칸이다.
     ⛔기본값을 ★여기 리터럴로 적지 마라 — ★QUOTE_DEFAULTS ★한 표에서 온다. */
  const align = ['left', 'center', 'right'].includes(block.dataset.align) ? block.dataset.align : QUOTE_DEFAULTS.align;
  /* ★★부호 ★y ＋ ★세로 정렬 (현빈 2026-10-09 ④⒝) — ⛔한도·기본값을 ★여기 리터럴로 적지 마라
     (QUOTE_LIMITS·QUOTE_DEFAULTS ★한 표에서 온다 · 머리말의 그 규약). */
  const markDy = clampQuote(Number(block.dataset.markDy ?? QUOTE_DEFAULTS.markDy), L.markDy);
  const vAlign = ['top', 'middle', 'bottom'].includes(block.dataset.vAlign) ? block.dataset.vAlign : QUOTE_DEFAULTS.vAlign;
  const preOn = block.dataset.preOn !== '0';
  const postOn = block.dataset.postOn !== '0';
  const raw = block.dataset.text ?? '';
  const lines = quoteLines(block);
  const isPh = quoteIsPlaceholder(block);

  /* ★모양 — ★`.prop-align-group`(wrap · 여러 줄). ⛔`.prop-type-group` 으로 바꾸지 마라
     (머리말의 실측: 8번째 단추가 ★안 눌린다). 꼴은 prop-annotation.js:209~213 선례.
     ★★목록은 ★`quoteShapesAll()` ★하나에서 온다 — ★제품 8종 ＋ ★사용자가 더한 것(현빈 2026-10-09 ⒝).
       ⛔여기서 ★QUOTE_SHAPES 를 ★직접 돌지 마라 — ★사용자 것이 ★조용히 빠진다(명부가 둘이 된다).
     ★사용자 것에만 ★지우는 자(×)를 단다 — ⛔제품 8종은 ★못 지운다. */
  const _shapes = quoteShapesAll();
  const shapeBtns = _shapes.map(s => `
        <button class="prop-align-btn${s.key === shape.key ? ' active' : ''}" data-qt-shape="${s.key}"
                title="${_esc(s.label)}${s.user ? ' (내가 더한 것 — 길게 눌러 지우기)' : ''}"
                ${s.user ? `data-qt-user="1"` : ''}
                aria-pressed="${s.key === shape.key ? 'true' : 'false'}">${_esc(s.label)}</button>`).join('')
    + `
        <button class="prop-align-btn" id="qt-shape-add" title="부호 직접 더하기"
                aria-label="부호 더하기">＋</button>`;

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
    icon: _ICON,
    name: block.dataset.layerName,
    defaultName: 'Quote',
    crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '',
    id: block.id,
  })}
    </div>

    <div class="prop-section">
      <div class="prop-section-title">인용구(쉼표)</div>
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">글 양옆에 부호가 섭니다. <b>부호 크기·간격은 글자 크기와 따로</b> 갑니다 — 묶으면 큰 부호를 쓰려고 글까지 커집니다.</div>
      <div class="prop-row" style="align-items:flex-start">
        <span class="prop-label">모양</span>
        <div class="prop-align-group" id="qt-shape-group">${shapeBtns}</div>
      </div>
${_pairRow('qt-marksize', '부호 크기', markSize, L.markSize.min, L.markSize.max)}
      <div class="prop-row">
        <span class="prop-label">부호 색</span>
        ${colorFieldHTML({ idPrefix: 'qt-markcol', hex: _swatchHex(markColor, QUOTE_DEFAULTS.markColor), alpha: parseAlphaFromColor(markColor) })}
      </div>
${_pairRow('qt-markdy', '부호 y', markDy, L.markDy.min, L.markDy.max)}
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">부호만 위아래로 밀립니다 — <b>글은 제자리</b>입니다. 한 줄·스택 <b>둘 다</b> 먹습니다.</div>
${_pairRow('qt-gap', '간격', gap, L.gap.min, L.gap.max)}
      <div class="prop-row">
        <span class="prop-label">꼴</span>
        <div class="prop-type-group" id="qt-layout-group">
          <button class="prop-type-btn${layout === 'inline' ? ' active' : ''}" data-qt-layout="inline">한 줄</button>
          <button class="prop-type-btn${layout === 'stack' ? ' active' : ''}" data-qt-layout="stack">스택</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="qt-align-group">
          ${alignBtn('text', 'left',   { label: '왼쪽 정렬',   title: '왼쪽 정렬',   active: align === 'left',   attrs: { 'data-al': 'left' } })}
          ${alignBtn('text', 'center', { label: '가운데 정렬', title: '가운데 정렬', active: align === 'center', attrs: { 'data-al': 'center' } })}
          ${alignBtn('text', 'right',  { label: '오른쪽 정렬', title: '오른쪽 정렬', active: align === 'right',  attrs: { 'data-al': 'right' } })}
        </div>
      </div>
${layout === 'inline' ? `
      <div class="prop-row">
        <span class="prop-label">세로 정렬</span>
        <div class="prop-align-group" id="qt-valign-group">
          ${alignBtn('object-v', 'top',    { label: '위쪽 정렬',          title: '위쪽 정렬',          active: vAlign === 'top',    attrs: { 'data-qv': 'top' } })}
          ${alignBtn('object-v', 'middle', { label: '가운데 정렬 (수직)', title: '가운데 정렬 (수직)', active: vAlign === 'middle', attrs: { 'data-qv': 'middle' } })}
          ${alignBtn('object-v', 'bottom', { label: '아래쪽 정렬',        title: '아래쪽 정렬',        active: vAlign === 'bottom', attrs: { 'data-qv': 'bottom' } })}
        </div>
      </div>` : `
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5"><b>세로 정렬</b>은 스택에서 쓰지 않습니다 — 축이 돌아 부호가 글 <b>위·아래</b>에 차례로 서므로 밀 틈이 없습니다. 세로로 밀려면 위의 <b>부호 y</b>를 쓰세요.</div>`}
      <div class="prop-row">
        <span class="prop-label">부호 켜기</span>
        <label class="prop-none-check" title="앞쪽 부호를 보일지">
          <input type="checkbox" id="qt-pre-on"${preOn ? ' checked' : ''} aria-label="앞 부호"> 앞
        </label>
        <label class="prop-none-check" title="뒤쪽 부호를 보일지">
          <input type="checkbox" id="qt-post-on"${postOn ? ' checked' : ''} aria-label="뒤 부호"> 뒤
        </label>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">글</div>
      <div class="prop-row" style="align-items:flex-start">
        <span class="prop-label">내용</span>
        <textarea class="prop-textarea" id="qt-text" rows="3" placeholder="${_esc(QUOTE_DEFAULTS.ph)}"
                  style="flex:1;min-width:0;resize:vertical">${_esc(raw)}</textarea>
      </div>
      <div class="prop-hint" style="padding:2px 8px;line-height:1.5">${
        layout === 'stack'
          ? `<b>엔터</b>로 줄을 나눕니다. 지금 <b>${lines.length}줄</b>이고 부호는 글 <b>위·아래에 한 쌍</b>입니다. <span style="opacity:.7">빈 줄은 건너뜁니다.</span>`
          : `<b>한 줄</b> 꼴에서는 부호가 <b>한 쌍</b>입니다. 엔터로 나눈 글은 가운데 칸에서 줄로 쌓입니다(지금 <b>${lines.length}줄</b>).`
      }${isPh ? ' <span style="opacity:.7">지금은 안내문구를 그리고 있습니다.</span>' : ''}</div>
${_pairRow('qt-fontsize', '글자 크기', fontSize, L.fontSize.min, L.fontSize.max)}
      <div class="prop-row">
        <span class="prop-label">글자 색</span>
        ${colorFieldHTML({ idPrefix: 'qt-textcol', hex: _swatchHex(textColor, QUOTE_DEFAULTS.textColor), alpha: parseAlphaFromColor(textColor) })}
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderQuoteBlock?.(block);
  /* ★push-after — 쓰고 그린 «뒤»에 한 번. ⛔쓰기 «전»에 부르지 마라. */
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = () => showQuoteProperties(block);

  // ── 슬라이더 + 숫자 «쌍» ──
  const wireNum = (id, key, min, max) => {
    const s = document.getElementById(`${id}-slider`);
    const n = document.getElementById(`${id}-number`);
    if (!s || !n) return;
    const apply = (val) => {
      const x = Math.min(max, Math.max(min, Number.isFinite(val) ? val : min));
      block.dataset[key] = String(x);
      rerender();
      s.value = x; n.value = x;
    };
    s.addEventListener('input', () => apply(parseInt(s.value, 10)));
    s.addEventListener('change', commit);
    n.addEventListener('change', () => { apply(parseInt(n.value, 10)); commit(); });
  };
  wireNum('qt-marksize', 'markSize', L.markSize.min, L.markSize.max);
  wireNum('qt-markdy', 'markDy', L.markDy.min, L.markDy.max);
  wireNum('qt-gap', 'gap', L.gap.min, L.gap.max);
  wireNum('qt-fontsize', 'fontSize', L.fontSize.min, L.fontSize.max);

  // ── 색 (raw input[type=color] 금지 — 공용 컴포넌트) ──
  const wireColor = (prefix, key) => {
    if (!document.getElementById(`${prefix}-color`)) return;
    wireColorField(prefix, {
      initialAlpha: parseAlphaFromColor(block.dataset[key] || ''),
      onApply: (c) => { block.dataset[key] = c; rerender(); },
      onCommit: commit,
    });
  };
  wireColor('qt-markcol', 'markColor');
  wireColor('qt-textcol', 'textColor');

  /* ── ★가로 정렬 (현빈 2026-10-09 ④ 「수평 정렬」 · 티켓 1009t2-④ ⒜) ──────────────
     ★모델(`dataset.align`)은 ★이미 돌고 있었다 — ★없던 것은 ★이 ★칸 하나다.
     ★★한 번 ★잘못 닫힌 자리다: 이 파일의 `align` 8건이 ★전부 ★CSS 클래스명이라
       ★낱말로 세면 ★「이미 있다」가 된다. ⇒ ★판정은 ★«패널 조종칸 전수»로(Q14 가 그 자로 잰다).
     ★`#qt-align-group` «안»으로 ★좁힌다 — ⛔패널 전체의 `[data-al]` 을 잡지 마라
       (같은 속성을 ★prop-modal.js 도 쓴다 · 지금은 패널이 ★하나지만 ★범위를 ★좁혀 두는 쪽이 맞다).
     ⛔`reopen()` 을 ★부르지 않는다 — 정렬은 ★안내문을 ★안 바꾸고, ★다시 그리면 ★이 핸들러가
       ★새 노드에 ★다시 달리는 동안 ★연이은 클릭이 ★끊긴다(모양·꼴 단추와 ★다른 갈래다).
     ⇒ ★`active` 는 ★여기서 ★손으로 옮긴다(prop-text-wireup-align.js:49 와 ★같은 꼴). */
  propPanel.querySelectorAll('#qt-align-group [data-al]').forEach(btn => btn.addEventListener('click', () => {
    const a = btn.getAttribute('data-al');
    if (!['left', 'center', 'right'].includes(a)) return;
    block.dataset.align = a;
    rerender(); commit();
    propPanel.querySelectorAll('#qt-align-group [data-al]').forEach(b => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }));

  /* ── ★세로 정렬 (④⒝) ── ★inline 에서만 ★이 줄이 있다 ⇒ `forEach` 가 ★0바퀴면 ★그냥 안 돈다.
     ⛔「없으면 만들어 주기」를 ★하지 마라 — ★stack 에서 ★눌러도 안 움직이는 칸이 된다(실측 근거는
       quote-block.js `QUOTE_DEFAULTS.vAlign` 머리말). ★판정은 ★한 곳(`layout === 'inline'`)이다. */
  propPanel.querySelectorAll('#qt-valign-group [data-qv]').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.getAttribute('data-qv');
    if (!['top', 'middle', 'bottom'].includes(v)) return;
    block.dataset.vAlign = v;
    rerender(); commit();
    propPanel.querySelectorAll('#qt-valign-group [data-qv]').forEach(b => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }));

  // ── 모양 — ★제품 8종 ＋ ★사용자가 더한 것 ──
  /* ⛔옛 판은 `QUOTE_SHAPE_KEYS.includes(k)` 로 ★제품 8종만 통과시켰다 — ★사용자 것을 누르면
     ★조용히 ★아무 일도 안 난다(「먹통」이 아니라 ★«해당 없음»). ⇒ ★명부를 ★quoteShapesAll 로 ★넓힌다.
     ★여전히 ★«명부에 있는 키»만 받는다(저장본이 손상돼도 엉뚱한 키가 안 박힌다). */
  const _shapeKeys = new Set(quoteShapesAll().map(s => s.key));
  propPanel.querySelectorAll('[data-qt-shape]').forEach(btn => btn.addEventListener('click', () => {
    const k = btn.getAttribute('data-qt-shape');
    if (!_shapeKeys.has(k)) return;
    block.dataset.shape = k;
    rerender(); commit(); reopen();
  }));

  /* ── ★부호 ★직접 더하기 (현빈 2026-10-09 ⒝ 「별도로 ★사용자가 추가 가능하게」) ──────────
   * ★인라인 이름 폼은 ★DesignSystem._openInlineNameForm ★한 벌이다(컬러 변수 「변수로 만들기」가 쓰는 그것).
   *   ⛔여기서 ★제 폼을 ★또 만들지 않는다 — 꼴·스타일·취소 규약이 ★갈린다.
   * ★입력은 ★한 칸이고 ★«앞 뒤»를 ★공백으로 가른다(예: `< >` · `[ ]`). ★한 글자만 주면 ★앞뒤 ★같은 것으로 읽는다.
   * ★저장은 ★DesignSystem 이 한다(정본 `meta.quoteShapes` · 캐시 localStorage) — ⛔여기서 localStorage 를 ★안 만진다. */
  document.getElementById('qt-shape-add')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    window.DesignSystem?.openInlineNameForm?.(btn.closest('.prop-row') || btn.parentElement, {
      id: 'qt-shape-add',
      placeholder: '앞 뒤  (예: < >)',
      submitLabel: '더하기',
      hint: '앞·뒤 부호를 공백으로 갈라 적으세요. 한 글자만 적으면 앞뒤가 같아집니다.\n이 프로젝트에 저장됩니다.',
      onSubmit: (raw) => {
        const t = String(raw || '').trim();
        if (!t) return;
        const parts = t.split(/\s+/);
        const pre = parts[0] || '';
        const post = parts.length > 1 ? parts[parts.length - 1] : pre;
        const list = window.DesignSystem?.addQuoteShape?.({ pre, post }) || [];
        const made = list.find(r => r.pre === pre && r.post === post);
        if (made) block.dataset.shape = made.key;     // ★더한 것을 ★바로 입힌다(누르러 다시 찾지 않게)
        rerender(); commit(); reopen();
      },
    });
  });

  /* ★사용자 것 ★지우기 — ★길게 누르기(contextmenu)로. ⛔제품 8종에는 ★안 단다(위 마크업의 data-qt-user). */
  propPanel.querySelectorAll('[data-qt-user="1"]').forEach(btn => btn.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const k = btn.getAttribute('data-qt-shape');
    window.DesignSystem?.removeQuoteShape?.(k);
    /* ★지운 부호를 ★쓰고 있던 블럭은 ★기본값으로 떨어진다 — ⛔조용히 두지 않고 ★여기서 ★되돌려 적는다. */
    if (block.dataset.shape === k) block.dataset.shape = QUOTE_DEFAULTS.shape;
    rerender(); commit(); reopen();
  }));

  // ── 꼴(한 줄 / 스택) — ★줄 수 안내가 같이 바뀌므로 패널을 다시 그린다 ──
  propPanel.querySelectorAll('[data-qt-layout]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.layout = btn.getAttribute('data-qt-layout') === 'stack' ? 'stack' : 'inline';
    rerender(); commit(); reopen();
  }));

  // ── 앞/뒤 부호 끄기 ──
  document.getElementById('qt-pre-on')?.addEventListener('change', (e) => {
    block.dataset.preOn = e.target.checked ? '1' : '0';
    rerender(); commit();
  });
  document.getElementById('qt-post-on')?.addEventListener('change', (e) => {
    block.dataset.postOn = e.target.checked ? '1' : '0';
    rerender(); commit();
  });

  // ── 글 ── ★줄 수 안내가 바뀌므로 커밋 뒤 다시 그린다
  const t = document.getElementById('qt-text');
  t?.addEventListener('change', () => {
    if (window.commitQuoteText?.(block, t.value)) { rerender(); commit(); reopen(); }
  });
}

window.showQuoteProperties = showQuoteProperties;
