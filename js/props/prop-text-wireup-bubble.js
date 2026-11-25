/* prop-text-wireup-bubble.js
 * speech-bubble 블록 전용 이벤트 wireup (스타일 / 말꼬리 / 배경 / 발신자)
 */
import { wireColorField } from './color-picker.js';
import { clearBubbleSenderAlign } from './prop-text-wireup-align.js';
import { wireNumberScrub } from './_helpers.js';

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
    window.applySpeechBubbleStyle?.(tb, e.target.value);
    window.pushHistory?.();
    window.triggerAutoSave?.();
    window.showTextProperties?.(tb);
  });

  // 말꼬리 방향
  const _setTail = (dir) => {
    tb.dataset.tail = dir;
    tb.style.marginLeft = dir === 'right' ? 'auto' : dir === 'center' ? 'auto' : '';
    tb.style.marginRight = dir === 'center' ? 'auto' : '';
    /* ★1012t1M2-a — 정렬 단추가 이름표에 남긴 인라인 textAlign 을 지운다 ⇒ 이름은 말꼬리 규칙(CSS)을 따른다
       (left = 22px 들여쓰기 · right = 오른쪽 · center = 가운데). 안 지우면 예전에 누른 left 가 CSS 를 이긴다. */
    clearBubbleSenderAlign(tb);   // ★한 벌 함수(prop-text-wireup-align.js) — MCP tail 갈래와 같은 처리
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
    window.pushHistory?.();
    window.triggerAutoSave?.();
  };

  document.getElementById('bubble-tail-left')?.addEventListener('click', () => _setTail('left'));
  document.getElementById('bubble-tail-center')?.addEventListener('click', () => _setTail('center'));
  document.getElementById('bubble-tail-right')?.addEventListener('click', () => _setTail('right'));

  /* 1120b B2 — 배경 색 칸 = Fill 과 같은 부품 → 같은 배선(wireColorField: 스와치·HEX·% 한 벌). 값 = hex(100%) 또는 rgba(…) → _applyBubbleBg(몸 + 꼬리 --bubble-bg) */
  wireColorField('bubble-bg', {
    initialAlpha: parseInt(document.getElementById('bubble-bg-alpha')?.value, 10) || 100,
    onApply: (c) => _applyBubbleBg(c),
    onCommit: () => window.pushHistory?.(),
  });

  // 발신자 이름 토글
  document.getElementById('bubble-show-sender')?.addEventListener('change', e => {
    const show = e.target.checked;
    tb.dataset.showSender = show ? 'true' : 'false';
    const senderEl = tb.querySelector('.tb-sender-name');
    if (senderEl) senderEl.style.display = show ? '' : 'none';
    window.pushHistory?.();   // push-after(0.9.14 94행) — tests/unit/prop-push-after PA-9
    window.triggerAutoSave?.();
  });
  /* ★1017t1m3 크기 «고정» — 현빈 「해당 기능을 끄면 모달처럼 배경사이즈를 고정해두고 조절가능하게 해줘 👉 이거 반영이 됐는지?」
     ★모달(prop-modal.js 너비 풀폭/고정 · 높이 자동/최소)의 뜻을 그대로 옮긴다: 고정 = 너비 고정 + 높이 «최소»(글이 넘치면 자란다 — 잘리지 않게).
     ★고정으로 바꿀 때 지금 그려진 크기(모델 px)를 시작값으로 ⇒ 누르는 순간 모양이 안 튄다.
     ★이력 = push-after(이 파일의 말꼬리·발신자와 같은 규약 · 0.9.14 94·97행). */
  const _wIn = document.getElementById('bubble-w-number');
  const _hIn = document.getElementById('bubble-h-number');
  const _setSize = (mode) => {
    if (mode === 'fixed') {
      const body = tb.querySelector('.tb-bubble');
      /* ★시작 너비는 «올림» — offsetWidth 는 정수로 깎는다(실폭 348.445 → 348) ⇒ 그만큼 좁아져 줄이 꺾이고 높이가 튄다
         (앱 실측 261026: 70→112). ★테두리 상자 실폭 = computed width(border-box 면 그대로 · content-box 면 좌우 패딩·테두리를 더한다). */
      const _exactW = (el) => { const cs = getComputedStyle(el); const w = parseFloat(cs.width) || 0;
        return cs.boxSizing === 'border-box' ? w : ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((a, k) => a + (parseFloat(cs[k]) || 0), w); };
      if (!(parseInt(tb.dataset.bubbleW, 10) > 0)) tb.dataset.bubbleW = String(Math.ceil(body ? _exactW(body) : 300));
      if (!(parseInt(tb.dataset.bubbleH, 10) > 0)) tb.dataset.bubbleH = String(Math.round(body ? body.offsetHeight : 80));
      tb.dataset.bubbleSize = 'fixed';
    } else {
      delete tb.dataset.bubbleSize;
    }
    applyBubbleSize(tb);
    window.pushHistory?.();
    window.triggerAutoSave?.();
    window.showTextProperties?.(tb);   // W/H 칸 막힘(자동)·값을 새로 그린다(스타일 드롭다운과 같은 길)
  };
  /* ★L4b(현빈 L-2) — 옛 자동/고정 세그먼트 → 모드 드롭다운(같은 _setSize · 같은 키) */
  document.getElementById('bubble-size-mode')?.addEventListener('change', (e) => {
    if ((e.target.value === 'fixed') === (tb.dataset.bubbleSize === 'fixed')) return;
    _setSize(e.target.value);
  });
  const _wireDim = (input, key, min, max) => input?.addEventListener('change', () => {
    const n = Math.min(max, Math.max(min, parseInt(input.value, 10) || min));
    tb.dataset[key] = String(n); input.value = n;
    applyBubbleSize(tb);
    window.pushHistory?.();
    window.triggerAutoSave?.();
  });
  _wireDim(_wIn, 'bubbleW', 60, 860);
  _wireDim(_hIn, 'bubbleH', 40, 2000);
  wireNumberScrub(document.getElementById('bubble-w-number-scrub'), _wIn, { min: 60, max: 860 });   // 라벨 끌기 — 놓을 때 change 한 번 = 위 길
  wireNumberScrub(document.getElementById('bubble-h-number-scrub'), _hIn, { min: 40, max: 2000 });

  /* BT1 — 발신자 «이름 입력칸»은 패널에서 뺐다. 이름은 캔버스 이름표를 더블클릭해 고친다(js/block-drag.js bindBlock 말풍선 갈래). */
}

/** ★1017t1m3 — 말풍선 몸통(.tb-bubble) 크기를 dataset 에서 «한 자리»로 칠한다.
 *  고정 = width:W px · max-width:none · min-height:H px · 자동 = 그 세 칸을 비운다(CSS 의 fit-content·80% 로 돌아간다).
 *  ★인라인이라 저장본(canvas HTML)에 그대로 실린다 — 다시 열 때 따로 칠할 일이 없다. */
export function applyBubbleSize(tb) {
  const body = tb && tb.querySelector('.tb-bubble');
  if (!body) return;
  if (tb.dataset.bubbleSize === 'fixed') {
    body.style.boxSizing = 'border-box';
    body.style.width = (parseInt(tb.dataset.bubbleW, 10) || 300) + 'px';
    body.style.maxWidth = 'none';
    body.style.minHeight = (parseInt(tb.dataset.bubbleH, 10) || 80) + 'px';
  } else {
    body.style.width = ''; body.style.maxWidth = ''; body.style.minHeight = ''; body.style.boxSizing = '';
  }
}
if (typeof window !== 'undefined') window.applyBubbleSize = applyBubbleSize;
