/* prop-text-wireup-type.js
 * 타입 전환 (H1/H2/H3/body/caption/label/bullet)
 * — bullet ↔ 일반 변형 전환 시 contentEl을 새 노드로 교체하므로 state.contentEl을 mutate
 */
import { setTextTypeClass, afterTextTypeChange, BULLET_LIST_STYLE_VALUES } from './text-type-class.js';
import { markLabelAutoColor, dropLabelAutoColor } from './label-auto-color.js';

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
      const _pxWrap = document.getElementById('txt-label-padx-wrap');   // 알약 안쪽 좌우 패딩 줄 — 라벨일 때만
      if (_pxWrap) _pxWrap.style.display = cls === 'tb-label' && contentEl.dataset.shape !== 'circle' ? 'block' : 'none';
      if (_pxWrap && cls === 'tb-label') {
        const _pxv = Math.round(parseFloat(getComputedStyle(contentEl).paddingLeft) || 0);
        document.getElementById('txt-label-padx-slider').value = _pxv;
        document.getElementById('txt-label-padx-number').value = _pxv;
      }

      // label로 전환 시 기본 스타일 적용, 다른 타입으로 전환 시 초기화
      if (cls === 'tb-label') {
        if (!contentEl.style.backgroundColor) contentEl.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-bg').trim() || '#111111';
        // textgrad-ok: 라벨 전환 — 아래에서 clearTextGradient(라벨은 그라데이션 불가)
        if (!contentEl.style.color) {
          contentEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-color').trim() || '#ffffff';
          markLabelAutoColor(contentEl);   // 0920r5 polish2: «라벨이 넣은 색» 표식 — 라벨을 벗어나면 이 색만 걷어낸다
        }
        if (!contentEl.style.borderRadius) contentEl.style.borderRadius = '4px';
      } else {
        contentEl.style.backgroundColor = '';
        contentEl.style.borderRadius = '';
        // 0920r5 polish2(T-059): 라벨이 넣은 흰 글자색이 남아 흰 섹션에서 글자가 안 보였다.
        //   표식이 달린 색(= 라벨이 넣은 그 색)일 때만 걷어낸다 — 사용자가 고른 색은 그대로 둔다.
        dropLabelAutoColor(contentEl);
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

/* ═══ 1017t1m1 ★텍스트 → Quote 블럭 전환 (현빈 「텍스트블럭에서 quato블럭으로 바꿀수도
 *   있게 위에 type절에 넣기」) ════════════════════════════════════════════════════════
 * ★타입 전환(위 wireTypeSection)과 ★다르다 — ul↔div 는 ★같은 .text-block 안의 ★태그 교체지만
 *   quote 는 ★다른 블럭 «타입»이다(.quote-block, js/blocks/quote-block.js). ⇒ ★블럭 자체를 ★갈아끼운다.
 * ★이력 = push-before(이웃 wireTypeSection 과 같은 규약 — ★구조를 바꾸는 전환이라 삽입류와 같다).
 * ★잃는 것(⛔되돌릴 수 없다 — ⌘Z 로만 복구) — quote 는 .text-block 의 서식 그릇을 «안» 받는다:
 *   타입 클래스(tb-h1…) 와 그 표준 크기 · 글자 효과(.tgs·.text-effect) · 글자 그라데이션/스트로크/그림자 ·
 *   형광펜·방점·밑줄 인라인 서식 · 불릿이면 li 구조(quote 는 quoteLines 줄 모델). ★하나라도 있으면 토스트로 알린다.
 * ⛔라이너/말풍선 변형은 ★전환 대상이 아니다 — 템플릿의 #type-section 이 그 둘에서 ★이미 통째로 숨어 있다
 *   (isLiner||isIconText 로 display:none, 게다가 isLiner 는 wireTypeSection 자체가 안 불린다 — prop-text.js:275).
 */
export function wireTextToQuote({ tb, propPanel, ctx }) {
  const btn = propPanel.querySelector('#txt-to-quote');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const contentEl = ctx.contentEl;
    if (!contentEl || !tb) return;

    // ★글 추출 — 불릿(ul)이면 li 를 줄바꿈으로, 아니면 textContent 그대로(서식은 여기서 이미 버려진다).
    const text = contentEl.tagName === 'UL'
      ? [...contentEl.querySelectorAll('li')].map((li) => li.textContent.trim()).filter(Boolean).join('\n')
      : contentEl.textContent.trim();

    // ★잃는 서식이 있었는지 — 있으면 되돌릴 수 없는 손실을 토스트로 알린다(비가역 앞 고지).
    const losesFormatting = !!(
      contentEl.querySelector?.('.tgs, .text-effect, u, s, strike, mark')
      || contentEl.tagName === 'UL'
      || /font-weight\s*:\s*(bold|[6-9]00)/i.test(contentEl.style.fontWeight || getComputedStyle(contentEl).fontWeight || '')
      || contentEl.style.fontStyle === 'italic'
      || !!contentEl.dataset?.gradStops
    );

    window.pushHistory?.();   // ★push-before — 이웃 wireTypeSection 과 같은 규약(구조 전환)

    const made = window.makeQuoteBlock?.({ text });
    if (!made) return;
    const wrapper = tb.closest('.frame-block[data-text-frame="true"]') || tb;
    wrapper.replaceWith(made.row);
    try { window.bindBlock?.(made.block); } catch (_) {}
    window.buildLayerPanel?.();
    try { window.selectBlock?.(made.block.id); } catch (_) {}
    window.triggerAutoSave?.();

    if (losesFormatting) {
      window.showToast?.('일부 글자 서식이 사라졌습니다 — ⌘Z 로 되돌릴 수 있습니다');
    }
  });
}

/* ═══ T7 ★불릿 «글머리» 배선 — 현빈 2026-10-07 ═══════════════════════════════════════
 * ★명부·판정은 ★text-type-class.js 한 자리(BULLET_LIST_STYLES · bulletListStyleOf). ⛔여기 베끼지 마라.
 * ★★이력은 ★push-after 다 — ★적용 먼저, `pushHistory` ★나중. ⛔순서를 되돌리지 마라:
 *   `tests/unit/prop-push-after.test.mjs` ★PA-1 이 ★「찍고 나서 바꾸는」 꼴을 ★소스에서 잡는다.
 *   ★그리고 2026-10-07 에 ★같은 함정을 ★그리드 원형 패널에서 ★수로 쟀다 —
 *     push-before 면 ★앞 편집이 push-after 일 때 ★이 변경이 ★자기 히스토리 칸을 ★못 만든다(Δ＋0).
 * ★값은 ★인라인 `style.listStyleType` 로 쓴다 — ★새 dataset 키 0개(그 까닭은 명부 쪽 주석).
 * ⛔`setTextTypeClass` 를 ★안 부른다 — ★타입 클래스는 ★안 건드린다(모양만 바꾼다).
 * ★`ctx.contentEl` 을 ★매번 읽는다 — 타입 전환이 ★노드를 갈아끼우기 때문이다(이 파일 머리말 R1). */
export function wireBulletStyleSection({ propPanel, ctx }) {
  const sec = propPanel.querySelector('#bullet-style-section');
  if (!sec) return;                                    // 불릿이 아니면 절이 없다 — 아무것도 안 한다
  sec.querySelectorAll('[data-lst]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.lst;
      if (!BULLET_LIST_STYLE_VALUES.includes(v)) return;   // 명부 밖 값은 여기서 죽는다
      const el = ctx.contentEl;
      if (!el || el.tagName !== 'UL') return;              // ★타입이 그 사이 바뀌었으면 아무것도 안 한다
      el.style.listStyleType = v;                          // ★적용 먼저
      sec.querySelectorAll('[data-lst]').forEach(b => b.classList.toggle('active', b === btn));
      window.triggerAutoSave?.();
      window.pushHistory?.();                              // ★찍기 나중(= push-after · 위 ★★ 참조)
    });
  });
}
