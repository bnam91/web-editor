/* ── InnerCard 블록 프로퍼티 패널 — 카드 컨테이너(bg/radius/padding/그림자) + 라인 텍스트 ──
   라인 구조 변경(추가/삭제/이미지)은 updateInnerCardBlock API 영역. */
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance(A2)
import { propPanel } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { fillSectionHTML, fillHeadToolsHTML, wireFillSection, fillLast } from './_fill-section.js';

import { layoutPadSlotHTML, wireLayoutSection } from './_layout-section.js';   // 표준 Layout(C2)

export function showInnerCardProperties(block) {
  let lines = [];
  try { lines = JSON.parse(block.dataset.lines || '[]'); } catch (_) {}
  const bg = block.dataset.bg || '#ffffff';
  const radius = parseInt(block.dataset.radius) || 0;
  const padding = parseInt(block.dataset.padding) || 0;
  const shadow = block.dataset.shadow || 'none';
  const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  renderPanel(block, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1.5" y="1.5" width="9" height="9" rx="2"/><path d="M4 5 H8 M4 7 H6.5"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Inner Card',
      crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '',
      id: block.id,
    }),
    // 옛 「Card」 절 하나 → 소유 절로 나눔(배경=Fill · 모서리=Appearance · 패딩=Padding · 그림자=Effects)
    sections: [
      sec('content', `${lines.map((l, li) => (l.type === 'image' || l.type === 'gap') ? '' : `
      <div class="prop-row">
        <span class="prop-label">${_esc(({ h1: 'H1', h2: 'H2', h3: 'H3', body: 'Body', caption: 'Cap', label: 'Label', bullet: 'Bullet' })[l.type || 'body'] || l.type)}</span>
        <input type="text" class="prop-input icd-line-input" data-line="${li}" value="${_esc(l.text || '')}" style="flex:1;min-width:0">
      </div>`).join('')}
      <div class="prop-hint">줄 더하기·빼기는 아직 패널에 없습니다 — 글은 위 칸이나 캔버스에서 고칩니다</div>`),
      sec('padding', layoutPadSlotHTML({ allId: 'icd-pad-number', all: padding, max: 120 })),   // ★표준 Layout(C2) — 네 면 한 값 한 칸 · 옛 슬라이더 icd-pad-slider 걷음 · 숫자 칸 id·범위·dataset.padding 무변
      sec('appearance', `
      ${appearanceSectionHTML({ prefix: 'icd', op: { value: window.readBlockOpacity?.(block) ?? 100 }, radius: { numberId: 'icd-radius-number', value: radius, max: 60 } })}   <!-- ★표준 Appearance A2(현빈 261124 · 시안 #mkp-appstd) — 옛 슬라이더 걷음 · 숫자 칸 id·dataset.radius·범위 무변 -->`, { headTools: appearanceHeadToolsHTML({ prefix: 'icd' }) }),
      sec('fill', fillSectionHTML({ prefix: 'icd-fill', on: bg !== 'transparent', colorHtml: colorFieldHTML({ idPrefix: 'icd-bg', hex: bg, alpha: parseAlphaFromColor(bg) }) }),
        { headTools: fillHeadToolsHTML({ prefix: 'icd-fill', on: bg !== 'transparent' }) }),   // 표준 Fill F2 — 없음 = bg 'transparent'(블럭 색 검사가 이미 받는 값)
      sec('effects', `
      <div class="prop-row">
        <span class="prop-label">그림자</span>
        <div class="prop-type-group">
          <button class="prop-type-btn ${shadow === 'none' ? 'active' : ''}" data-sh="none">없음</button>
          <button class="prop-type-btn ${shadow === 'soft' ? 'active' : ''}" data-sh="soft">소프트</button>
          <button class="prop-type-btn ${shadow === 'strong' ? 'active' : ''}" data-sh="strong">강하게</button>
        </div>
      </div>`),
    ],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  if (document.getElementById('icd-bg-color')) {
    wireColorField('icd-bg', {
      initialAlpha: parseAlphaFromColor(bg),
      onApply: (c) => { block.dataset.bg = c; window.renderInnerCardBlock?.(block); },
      onCommit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); },
    });
  }
  /* 표준 Fill F2 — − = 'transparent' · ＋ = 지난 색 · 없으면 #FFFFFF(블럭 기본) */
  wireFillSection({ prefix: 'icd-fill', adapter: {
    none: () => { fillLast.set(block.id, bg); block.dataset.bg = 'transparent'; window.renderInnerCardBlock?.(block); window.scheduleAutoSave?.(); showInnerCardProperties(block); },
    add: () => { block.dataset.bg = fillLast.get(block.id, '#ffffff'); window.renderInnerCardBlock?.(block); window.scheduleAutoSave?.(); showInnerCardProperties(block); },
    commit: () => window.pushHistory?.() } });
  wireAppearanceSection({ op: { numberId: 'icd-opacity', apply: (v) => window.setBlockOpacity?.(block, v) }, radius: { numberId: 'icd-radius-number', max: 60, apply: (v) => { block.dataset.radius = String(v); window.renderInnerCardBlock?.(block); } } });   // 표준 Appearance A2 — 옛 wireNum('radius') 자리(슬라이더 걷음)
  wireLayoutSection({ w: { numberId: 'icd-pad-number', max: 120, apply: (v) => { block.dataset.padding = String(v); window.renderInnerCardBlock?.(block); } } });   // ★표준 Layout(C2) — 옛 wireNum('pad') 자리

  propPanel.querySelectorAll('[data-sh]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.shadow = btn.dataset.sh;
    window.renderInnerCardBlock?.(block);
    window.pushHistory?.(); window.scheduleAutoSave?.();
    showInnerCardProperties(block);
  }));

  propPanel.querySelectorAll('.icd-line-input').forEach(inp => {
    inp.addEventListener('input', () => {
      try {
        const ls = JSON.parse(block.dataset.lines || '[]');
        if (ls[+inp.dataset.line]) { ls[+inp.dataset.line].text = inp.value; block.dataset.lines = JSON.stringify(ls); window.renderInnerCardBlock?.(block); }
      } catch (_) {}
    });
    inp.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  });
}

window.showInnerCardProperties = showInnerCardProperties;
