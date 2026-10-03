/* prop-text-wireup-bubble.js
 * speech-bubble 블록 전용 이벤트 wireup (스타일 / 말꼬리 / 배경 / 발신자)
 */
import { wireHexText, parseHex6, formatHex6 } from './color-picker.js';

export function wireBubbleSection({ tb, ctx }) {
  // 말꼬리 방향 — contentEl은 ctx 통해 동적 조회 (R1: type 토글 후 교체 대비)
  const _applyBubbleBg = (hex) => {
    ctx.contentEl.style.backgroundColor = hex;
    // --bubble-bg 변수를 .speech-bubble-block(tb)에 설정해 SVG 말꼬리 색상도 동기화
    tb.style.setProperty('--bubble-bg', hex);
    window.triggerAutoSave?.();
  };

  /* 말풍선 스타일 드롭다운 — BT3: 모습(배경·글자색)은 block-factory.js applySpeechBubbleStyle 한 곳이 쓴다(MCP 와 같은 길).
     ⛔패널을 «열 때» 적용하지 않는다 — 옛 판은 열 때마다 다시 칠했는데, 이제 칠하면 손으로 바꾼 배경색이 지워진다.
     바꾼 뒤엔 패널을 다시 그린다 — 배경색 칸·글자색 칸이 «새 값»을 보이게. */
  document.getElementById('bubble-style-select')?.addEventListener('change', e => {
    window.pushHistory?.();
    window.applySpeechBubbleStyle?.(tb, e.target.value);
    window.triggerAutoSave?.();
    window.showTextProperties?.(tb);
  });

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
    bubbleBgHexInput.value = formatHex6(hex);
    _applyBubbleBg(hex);
  });
  bubbleBgPicker?.addEventListener('change', () => window.pushHistory?.());
  /* 색 코드 칸 — 공용 배선(wireHexText). 무효값은 표시되고 blur 하면 되돌아간다. */
  wireHexText(bubbleBgHexInput, {
    parse: parseHex6,
    format: formatHex6,
    getCurrent: () => bubbleBgPicker?.value || '#ffffff',
    onApply: (v) => { if (bubbleBgPicker) bubbleBgPicker.value = v; _applyBubbleBg(v); },
    onCommit: () => window.pushHistory?.(),
  });

  // 발신자 이름 토글
  document.getElementById('bubble-show-sender')?.addEventListener('change', e => {
    window.pushHistory?.();
    const show = e.target.checked;
    tb.dataset.showSender = show ? 'true' : 'false';
    const senderEl = tb.querySelector('.tb-sender-name');
    if (senderEl) senderEl.style.display = show ? '' : 'none';
    window.triggerAutoSave?.();
  });
  /* BT1 — 발신자 «이름 입력칸»은 패널에서 뺐다. 이름은 캔버스 이름표를 더블클릭해 고친다(js/block-drag.js bindBlock 말풍선 갈래). */
}
