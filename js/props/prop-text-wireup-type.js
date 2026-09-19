/* prop-text-wireup-type.js
 * 타입 전환 (H1/H2/H3/body/caption/label/bullet)
 * — bullet ↔ 일반 변형 전환 시 contentEl을 새 노드로 교체하므로 state.contentEl을 mutate
 */
import { setTextTypeClass, afterTextTypeChange } from './text-type-class.js';

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
        // 0920r4 texttype: 복사해 둔 효과 클래스(.tgs·.text-effect·.tfx-*)를 덮지 않는다 — 타입 클래스만 교체
        setTextTypeClass(newEl, cls);
        contentEl.replaceWith(newEl);
        contentEl = newEl;
        ctx.contentEl = newEl; // R1: 외부 wireup이 참조하는 ctx 갱신
      } else {
        setTextTypeClass(contentEl, cls);   // 0920r4 texttype: className 통째 대입 금지(효과 클래스 유실)
      }
      tb.dataset.type = typeMap2[cls];
      propPanel.querySelectorAll('.prop-type-btn').forEach(b => b.classList.toggle('active', b===btn));

      const labelSection = document.getElementById('label-style-section');
      if (labelSection) labelSection.style.display = cls === 'tb-label' ? 'block' : 'none';

      // label로 전환 시 기본 스타일 적용, 다른 타입으로 전환 시 초기화
      if (cls === 'tb-label') {
        if (!contentEl.style.backgroundColor) contentEl.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-bg').trim() || '#111111';
        // textgrad-ok: 라벨 전환 — 아래에서 clearTextGradient(라벨은 그라데이션 불가)
        if (!contentEl.style.color) contentEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-color').trim() || '#ffffff';
        if (!contentEl.style.borderRadius) contentEl.style.borderRadius = '4px';
      } else {
        contentEl.style.backgroundColor = '';
        contentEl.style.borderRadius = '';
      }

      // 0918r2 textgrad: 라벨·불릿은 글자 그라데이션을 못 받는다(박스 배경이 같이 잘림 / ::marker 투명).
      //   그쪽으로 바꾸면 그라데이션을 풀고(인라인 color = «마지막 단색»이 그대로 드러난다), 글자색 피커 게이트도 다시 잰다.
      if (!window.textGradientAllowed?.(contentEl)) window.clearTextGradient?.(contentEl);
      // 타입 전환은 클래스 기본 글자색을 바꾼다(본문 #555 → H2 #1a1a1a) — 패널을 다시 안 그리므로
      //   글자색 입력값(= 솔리드 상태·그라데이션 탭 «지금 색» 기본값)을 실제 색으로 맞춘다. 안 맞추면 옛 타입 색이 시드된다.
      const _cp = document.getElementById('txt-color');
      const _m = (getComputedStyle(contentEl).color || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (_cp && _m) {
        const _hex = '#' + [_m[1], _m[2], _m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('');
        _cp.value = _hex;
        const _hx = document.getElementById('txt-color-hex');
        if (_hx) _hx.value = _hex.slice(1).toUpperCase();
        const _sw = _cp.closest('.prop-color-swatch');
        if (_sw) _sw.style.background = _hex;
      }
      // 0920r4 texttype: 타입이 바뀌면 그림자(패널·네온)의 computed 값이 달라질 수 있다 → 그라데이션 글자면 글자 «뒤»로 다시 맞춘다
      //   (불릿 경로는 replaceWith 로 붙은 «뒤»라 여기서 부른다 — 떨어진 노드는 무시됨)
      afterTextTypeChange(contentEl);
      _cp?.__textGradRegate?.();
    });
  });
}
