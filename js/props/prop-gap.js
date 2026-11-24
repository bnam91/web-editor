import { propPanel, state } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { GAP_MIN, GAP_MAX } from '../blocks/gap-limits.js';
import { layoutSizeRowHTML, wireLayoutSection } from './_layout-section.js';   // 표준 Layout(L2 · C1)
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance(A4 Opacity)

export function showGapProperties(gb) {
  const currentH = gb.offsetHeight;
  renderPanel(gb, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/>
            <line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/>
          </svg>`,
      name: gb.dataset.layerName,
      defaultName: 'Gap Block',
      crumb: window.getBlockBreadcrumb(gb),
      id: gb.id,
    }),
    /* ★표준 Layout L2(현빈 261124 L-4 · 시안 #mkp-layoutstd) — 옛 gap-slider 걷음 · 숫자 칸 id·범위 무변 · H 만 = 한 칸(one) · 아이콘 ↕(one.icon h) */
    sections: [sec('size', `${layoutSizeRowHTML({ prefix: 'gap', one: { id: 'gap-number', label: 'Height', icon: 'h', min: GAP_MIN, max: GAP_MAX, value: currentH } })}
      <div class="prop-row gap-preset-row">
        ${[20,40,80,120,160,200,240,280].map(h => `<button class="gap-preset-btn${currentH===h?' active':''}" data-h="${h}">${h}</button>`).join('')}
      </div>`),
      sec('appearance', appearanceSectionHTML({ prefix: 'gap', op: { value: window.readBlockOpacity?.(gb) ?? 100 } }), { headTools: appearanceHeadToolsHTML({ prefix: 'gap' }) })],   // A4 Opacity 만(모서리 없음)
  });

  if (window.setRpIdBadge) window.setRpIdBadge(gb.id || null);

  const number = document.getElementById('gap-number');
  /* 표준 Layout 배선(부품) — input = 범위 안이면 바로 · change = 잘라 + 이력 한 번 · 빈 칸 = 옛 값 되돌림 · 라벨 끌기 */
  wireLayoutSection({ w: { numberId: 'gap-number', min: GAP_MIN, max: GAP_MAX, read: () => gb.offsetHeight, apply: (v) => {
    gb.style.height = v + 'px';
    window.markGapManual?.(gb);   // ⓓ 사람이 정한 높이 — 갭 감수가 되돌리지 않는다
    updatePresetActive(v);
    window.scheduleAutoSave?.();
  } } });
  wireAppearanceSection({ op: { numberId: 'gap-opacity', apply: (v) => window.setBlockOpacity?.(gb, v) } });   // A4 — 계약(갈래 E) 없으면 그리기 0

  const presetBtns = propPanel.querySelectorAll('.gap-preset-btn');
  function updatePresetActive(v) {
    presetBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.h) === v));
  }
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const h = parseInt(btn.dataset.h);
      window.pushHistory?.();
      gb.style.height = h + 'px';
      window.markGapManual?.(gb);   // ⓓ 사람이 고른 프리셋 — 갭 감수가 되돌리지 않는다
      number.value = h;
      updatePresetActive(h);
      window.scheduleAutoSave?.();
    });
  });
}


window.showGapProperties = showGapProperties;
