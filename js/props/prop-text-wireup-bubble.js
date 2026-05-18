/* prop-text-wireup-bubble.js
 * speech-bubble 블록 전용 이벤트 wireup (스타일 / 말꼬리 / 배경 / 발신자)
 */

export function wireBubbleSection({ tb, ctx, currentBubbleStyle }) {
  // 말꼬리 방향 — contentEl은 ctx 통해 동적 조회 (R1: type 토글 후 교체 대비)
  const _applyBubbleBg = (hex) => {
    ctx.contentEl.style.backgroundColor = hex;
    // --bubble-bg 변수를 .speech-bubble-block(tb)에 설정해 SVG 말꼬리 색상도 동기화
    tb.style.setProperty('--bubble-bg', hex);
    window.triggerAutoSave?.();
  };

  // 말풍선 스타일 드롭다운
  document.getElementById('bubble-style-select')?.addEventListener('change', e => {
    window.pushHistory?.();
    const style = e.target.value;
    tb.dataset.bubbleStyle = style;
    _applyBubbleStyle(style);
    window.triggerAutoSave?.();
  });

  const _applyBubbleStyle = (style) => {
    const bubbleEl = tb.querySelector('.tb-bubble');
    if (!bubbleEl) return;
    if (style === 'apple') {
      bubbleEl.dataset.bubbleStyle = 'apple';
    } else {
      delete bubbleEl.dataset.bubbleStyle;
    }
  };
  _applyBubbleStyle(currentBubbleStyle);

  // 말꼬리 방향
  const _setTail = (dir) => {
    window.pushHistory?.();
    tb.dataset.tail = dir;
    tb.style.marginLeft = dir === 'right' ? 'auto' : dir === 'center' ? 'auto' : '';
    tb.style.marginRight = dir === 'center' ? 'auto' : '';
    // 말꼬리 SVG 교체 (center는 대칭형, left/right는 비대칭형)
    const oldTail = tb.querySelector('.tb-bubble-tail');
    if (oldTail && window.getBubbleTailSVG) {
      const tmp = document.createElement('div');
      tmp.innerHTML = window.getBubbleTailSVG(dir);
      oldTail.replaceWith(tmp.firstElementChild);
    }
    ['left','center','right'].forEach(d => {
      document.getElementById('bubble-tail-' + d)?.classList.toggle('active', d === dir);
    });
    window.triggerAutoSave?.();
  };

  document.getElementById('bubble-tail-left')?.addEventListener('click', () => _setTail('left'));
  document.getElementById('bubble-tail-center')?.addEventListener('click', () => _setTail('center'));
  document.getElementById('bubble-tail-right')?.addEventListener('click', () => _setTail('right'));

  const bubbleBgPicker = document.getElementById('bubble-bg-color');
  const bubbleBgHexInput = document.getElementById('bubble-bg-hex');
  bubbleBgPicker?.addEventListener('input', e => {
    const hex = e.target.value;
    bubbleBgHexInput.value = hex;
    _applyBubbleBg(hex);
  });
  bubbleBgPicker?.addEventListener('change', () => window.pushHistory?.());
  bubbleBgHexInput?.addEventListener('input', e => {
    const hex = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      bubbleBgPicker.value = hex;
      _applyBubbleBg(hex);
    }
  });
  bubbleBgHexInput?.addEventListener('change', () => window.pushHistory?.());

  // 발신자 이름 토글
  document.getElementById('bubble-show-sender')?.addEventListener('change', e => {
    window.pushHistory?.();
    const show = e.target.checked;
    tb.dataset.showSender = show ? 'true' : 'false';
    const senderEl = tb.querySelector('.tb-sender-name');
    if (senderEl) senderEl.style.display = show ? '' : 'none';
    const nameRow = document.getElementById('bubble-sender-name-row');
    if (nameRow) nameRow.style.display = show ? 'flex' : 'none';
    window.triggerAutoSave?.();
  });

  // 발신자 이름 텍스트 입력
  document.getElementById('bubble-sender-name-input')?.addEventListener('input', e => {
    const name = e.target.value;
    tb.dataset.senderName = name;
    const senderEl = tb.querySelector('.tb-sender-name');
    if (senderEl) senderEl.textContent = name || 'Your name';
    window.triggerAutoSave?.();
  });
  document.getElementById('bubble-sender-name-input')?.addEventListener('change', () => window.pushHistory?.());
}
