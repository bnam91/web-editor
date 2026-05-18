/* prop-text-wireup-type.js
 * 타입 전환 (H1/H2/H3/body/caption/label/bullet)
 * — bullet ↔ 일반 변형 전환 시 contentEl을 새 노드로 교체하므로 state.contentEl을 mutate
 */

export function wireTypeSection({ tb, propPanel, ctx }) {
  const typeMap2 = { 'tb-h1':'heading','tb-h2':'heading','tb-h3':'heading','tb-body':'body','tb-caption':'caption','tb-label':'label','tb-bullet':'bullet' };
  propPanel.querySelectorAll('.prop-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.pushHistory?.();
      const cls = btn.dataset.cls;

      let contentEl = ctx.contentEl;

      // bullet ↔ 일반 변형 전환 시 태그(ul/div) 자체를 교체해야 함
      const wasBullet = contentEl.tagName === 'UL';
      const isBullet  = cls === 'tb-bullet';
      if (wasBullet !== isBullet) {
        const newTag = isBullet ? 'ul' : 'div';
        const newEl = document.createElement(newTag);
        // 속성 복사
        for (const a of contentEl.attributes) newEl.setAttribute(a.name, a.value);
        // 내용 마이그레이션
        if (isBullet) {
          // div → ul: 기존 텍스트를 단일 li로 감싸기
          const txt = contentEl.textContent.trim();
          newEl.innerHTML = `<li>${txt || '항목을 입력하세요'}</li>`;
        } else {
          // ul → div: 모든 li 텍스트를 줄바꿈으로 합치기
          const items = [...contentEl.querySelectorAll('li')].map(li => li.textContent.trim()).filter(Boolean);
          newEl.textContent = items.join('\n') || (newEl.dataset.placeholder || '');
          newEl.style.whiteSpace = 'pre-wrap';
        }
        newEl.className = cls;
        contentEl.replaceWith(newEl);
        contentEl = newEl;
        ctx.contentEl = newEl; // R1: 외부 wireup이 참조하는 ctx 갱신
      } else {
        contentEl.className = cls;
      }
      tb.dataset.type = typeMap2[cls];
      propPanel.querySelectorAll('.prop-type-btn').forEach(b => b.classList.toggle('active', b===btn));

      const labelSection = document.getElementById('label-style-section');
      if (labelSection) labelSection.style.display = cls === 'tb-label' ? 'block' : 'none';

      // label로 전환 시 기본 스타일 적용, 다른 타입으로 전환 시 초기화
      if (cls === 'tb-label') {
        if (!contentEl.style.backgroundColor) contentEl.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-bg').trim() || '#111111';
        if (!contentEl.style.color) contentEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-color').trim() || '#ffffff';
        if (!contentEl.style.borderRadius) contentEl.style.borderRadius = '4px';
      } else {
        contentEl.style.backgroundColor = '';
        contentEl.style.borderRadius = '';
      }
    });
  });
}
