/* 버즈(1012t1Z5) — 프레임 패널 맨 위의 「Buzz」 절.
   js/props/prop-frame.js 의 _renderAutoPanel 이 버즈 프레임(js/blocks/buzz-mark.js isBuzzFrame)일 때
   머리 바로 뒤에 buzzSectionHTML 을 그리고, 다 그린 뒤 wireBuzzSection 을 부른다.
   ★순환 수입 없음 — 이 파일은 prop-frame.js 를 수입하지 않고 window.showFrameProperties 로 되부른다.

   컨트롤이 하는 일(js/blocks/buzz-frame.js):
     스타일 · 배치 · 다시 뿌리기 · 무늬번호 · ↻ · 흩어짐 · 겹침 · 엇갈림 · 간격 · 너비 · 각도 · 범위 · 방향 = «전부» 다시 놓는다
     개수 +/−  = 흩어짐에서는 새 것만 놓는다(남은 것 불변) · 스택에서는 다시 쌓는다
     깊이      = 표식만 바꾼다(자리 불변)
   어느 것도 프레임 높이를 안 바꾼다 — 넘치면 그 안에서 겹쳐 놓고 절 끝의 안내 한 줄(#bzf-squeeze)을 켠다.

   히스토리: 단추 · 선택 · 토글 = 값 쓰기 → 다시 놓기 → pushHistory(push-after) → scheduleAutoSave.
             슬라이더 = bindSlider(_helpers.js)가 mousedown 에 앞 표본 · 숫자 칸 change 에 뒤 표본.
   ⌘Z 는 캔버스를 통째로 갈므로 배선은 노드가 아니라 id 로 프레임을 다시 잡는다(F()). */
import { propPanel } from '../globals.js';
import { escHtml, bindSlider, sliderRowHTML } from './_helpers.js';
import { isBuzzFrame } from '../blocks/buzz-mark.js';
import { BUZZ_STYLES, BUZZ_STYLE_KEYS, BUZZ_COUNT, BUZZ_LIMITS, getBuzz, setBuzz, buzzRows,
         relayoutBuzzFrame, applyBuzzStyle, setBuzzCount, refitBuzzFrame, buzzCrowded } from '../blocks/buzz-frame.js';

/* ── 조각 — 이웃 패널과 같은 마크업 ───────────────────────────── */
/* title 은 줄(.prop-row) 자체에 단다 — 클래스 없는 감싸는 div 를 만들지 않는다. */
const _slider = (label, id, key, value, title = '') => {
  const row = sliderRowHTML(label, `${id}-slider`, `${id}-number`, { ...BUZZ_LIMITS[key], value });
  return title ? row.replace('<div class="prop-row">', `<div class="prop-row" title="${escHtml(title)}">`) : row;
};

/* 글자 단추 묶음 — .prop-align-group 은 절 «직속»에 둔다(라벨은 윗줄 .prop-field-label). opts = [[값, 라벨], …] */
const _group = (id, label, opts, cur) => `<span class="prop-field-label">${escHtml(label)}</span>
      <div class="prop-align-group" id="${id}" role="group" aria-label="${escHtml(label)}">${
  opts.map(([v, text]) => `<button class="prop-align-btn${v === cur ? ' active' : ''}" data-val="${escHtml(v)}">${escHtml(text)}</button>`).join('')
}</div>`;

const SQUEEZE_TEXT = '말풍선이 프레임 높이보다 많아 겹쳐 놓았습니다. 높이를 키우거나 개수를 줄이세요.';

/** Buzz 절 마크업. 버즈 프레임이 아니면 ''. */
export function buzzSectionHTML(frame) {
  if (!isBuzzFrame(frame)) return '';
  const style = frame.dataset.buzzStyle || '';
  const layout = getBuzz(frame, 'layout');
  const n = buzzRows(frame).length;
  const squeezed = buzzCrowded(frame);
  return `<div class="prop-section" id="bzf-section">
      <div class="prop-section-title">Buzz</div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="bzf-style" aria-label="스타일">
          ${BUZZ_STYLE_KEYS.includes(style) ? '' : '<option value="" selected>직접</option>'}
          ${BUZZ_STYLE_KEYS.map((k) => `<option value="${k}"${k === style ? ' selected' : ''}>${escHtml(BUZZ_STYLES[k].label)}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">개수</span>
        <button class="prop-count-btn" id="bzf-n-minus" aria-label="개수 줄이기"${n <= BUZZ_COUNT[0] ? ' disabled' : ''}>−</button>
        <span class="prop-count-val" id="bzf-n-count">${n}</span>
        <button class="prop-count-btn" id="bzf-n-plus" aria-label="개수 늘리기"${n >= BUZZ_COUNT[1] ? ' disabled' : ''}>+</button>
      </div>
      ${_group('bzf-layout', '배치', [['scatter', '흩어짐'], ['stack', '스택']], layout)}
      <div class="prop-row">
        <button class="prop-action-btn" id="bzf-reroll" title="자리를 전부 새로 뿌린다(직접 놓은 자리도 · 문구와 스타일은 그대로)">🎲 다시 뿌리기</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">무늬번호</span>
        <input type="number" class="prop-number" id="bzf-seed" style="flex:1;min-width:0"
               value="${getBuzz(frame, 'seed')}" aria-label="무늬번호">
        <button class="prop-icon-btn" id="bzf-redraw"
                title="같은 번호로 다시 그리기" aria-label="다시 그리기">↻</button>
      </div>
      ${layout === 'stack'
        ? _slider('엇갈림', 'bzf-offset', 'offset', getBuzz(frame, 'offset')) + _slider('간격', 'bzf-gap', 'gap', getBuzz(frame, 'gap'))
        : _slider('흩어짐', 'bzf-spread', 'spread', getBuzz(frame, 'spread')) + `<div class="prop-row">
        <span class="prop-label">겹침</span>
        <label class="prop-toggle">
          <input type="checkbox" id="bzf-overlap"${getBuzz(frame, 'overlap') === 1 ? ' checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>`}
      ${_slider('너비', 'bzf-width', 'width', getBuzz(frame, 'width'), '0 = 글 길이에 맞춤')}
      ${_slider('각도', 'bzf-angle', 'angle', getBuzz(frame, 'angle'))}
      ${_slider('범위', 'bzf-range', 'range', getBuzz(frame, 'range'), '각도에 더하는 무작위 흔들림(±)')}
      ${_group('bzf-dir', '방향', [['alt', '번갈아'], ['one', '한 방향'], ['rand', '무작위']], getBuzz(frame, 'dir'))}
      ${_group('bzf-depth', '깊이', [['none', '없음'], ['weak', '약하게'], ['strong', '강하게']], getBuzz(frame, 'depth'))}
      <div class="prop-hint" id="bzf-squeeze"${squeezed ? '' : ' hidden'}>${SQUEEZE_TEXT}</div>
    </div>`;
}

/**
 * 사용자가 프레임 크기를 바꾼 직후(패널 높이 칸 · 크기 손잡이를 놓았을 때) — 밖으로 나간 말풍선이 있으면 같은 무늬번호로 안에 다시 놓고,
 * 패널이 그 프레임의 Buzz 절을 보이고 있으면 안내 줄도 맞춘다. 히스토리는 안 찍는다 — 부른 쪽의 「크기 변경」 한 칸에 같이 들어간다.
 * 창구를 window 로도 낸다: js/overlay-handles.js(크기 손잡이)가 패널 모듈을 수입하지 않고 부른다.
 */
export function refitBuzzOnResize(frame) {
  if (!isBuzzFrame(frame)) return false;
  const done = refitBuzzFrame(frame);
  const el = propPanel?.querySelector('#bzf-squeeze');
  if (el) el.hidden = !buzzCrowded(frame);
  return done;
}
if (typeof window !== 'undefined') window.refitBuzzOnResize = refitBuzzOnResize;

/** Buzz 절 배선. 패널에 절이 그려진 «뒤»에 부른다. */
export function wireBuzzSection(frame) {
  if (!propPanel || !isBuzzFrame(frame) || !propPanel.querySelector('#bzf-section')) return;
  const frameId = frame.id;
  const $ = (id) => propPanel.querySelector('#' + id);
  const F = () => { const f = document.getElementById(frameId); return isBuzzFrame(f) ? f : null; };
  const save = (label) => { window.pushHistory?.(label); window.scheduleAutoSave?.(); };
  const hint = (squeezed) => { const el = $('bzf-squeeze'); if (el) el.hidden = !squeezed; };
  /* 다시 놓고 → 안내 갱신 → 선택 손잡이를 새 상자에 맞춘다 */
  const again = (f) => { relayoutBuzzFrame(f); hint(buzzCrowded(f)); window.showFrameHandles?.(f); };
  /* 절만 다시 그린다(배치를 바꾸면 슬라이더 줄이 갈린다) */
  const redraw = (f) => {
    const old = $('bzf-section');
    if (!old) return;
    old.outerHTML = buzzSectionHTML(f);
    wireBuzzSection(f);
  };
  const group = (id, onPick) => {
    const g = $(id);
    if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('.prop-align-btn');
      const f = F();
      if (!b || !g.contains(b) || !f) return;
      g.querySelectorAll('.prop-align-btn').forEach((x) => x.classList.toggle('active', x === b));
      onPick(f, b.dataset.val);
    });
  };

  $('bzf-style')?.addEventListener('change', (e) => {
    const f = F();
    if (!f || !e.target.value) return;
    applyBuzzStyle(f, e.target.value);
    save('버즈 스타일');
    window.showFrameProperties?.(f);          /* 배경색 칸까지 되읽는다(Buzz 절도 다시 그려진다) */
    window.showFrameHandles?.(f);
  });

  const count = (d) => {
    const f = F();
    if (!f) return;
    const before = buzzRows(f).length;
    const n = setBuzzCount(f, before + d);
    if (n === before) return;
    $('bzf-n-count').textContent = String(n);
    $('bzf-n-minus').disabled = n <= BUZZ_COUNT[0];
    $('bzf-n-plus').disabled = n >= BUZZ_COUNT[1];
    hint(buzzCrowded(f));
    window.showFrameHandles?.(f);
    save('버즈 개수');
  };
  $('bzf-n-minus')?.addEventListener('click', () => count(-1));
  $('bzf-n-plus')?.addEventListener('click', () => count(+1));

  group('bzf-layout', (f, v) => { setBuzz(f, 'layout', v); again(f); save('버즈 배치'); redraw(f); });
  group('bzf-dir', (f, v) => { setBuzz(f, 'dir', v); again(f); save('버즈 방향'); });
  group('bzf-depth', (f, v) => { setBuzz(f, 'depth', v); save('버즈 깊이'); });

  /* 무늬번호 — 다시 뿌리기(새 번호) · 번호 직접 입력 · ↻(같은 번호로 다시). 셋 다 전부 다시 놓는다. */
  const seedInput = $('bzf-seed');
  const reseed = (seed, label) => {
    const f = F();
    if (!f) return;
    setBuzz(f, 'seed', seed);
    again(f);
    save(label);
    if (seedInput) seedInput.value = String(getBuzz(f, 'seed'));
  };
  $('bzf-reroll')?.addEventListener('click', () => {
    const s = window.FxSeed?.newSeed?.();
    if (Number.isFinite(s)) reseed(s % 10000 || 1, '버즈 다시 뿌리기');
  });
  seedInput?.addEventListener('change', () => {
    const f = F();
    const v = Number.parseInt(seedInput.value, 10);
    if (!f) return;
    if (!Number.isFinite(v)) { seedInput.value = String(getBuzz(f, 'seed')); return; }
    reseed((Math.abs(v) % 100000) || 1, '버즈 무늬번호');   /* 음수 · 큰 수를 친 대로 두면 32비트로 말려 엉뚱한 수가 보인다 — 1~99999 로 접는다 */
  });
  seedInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') seedInput.blur(); });
  $('bzf-redraw')?.addEventListener('click', () => { const f = F(); if (f) reseed(getBuzz(f, 'seed'), '버즈 다시 그리기'); });

  const slide = (id, key) => bindSlider($(`${id}-slider`), $(`${id}-number`),
    (v) => { const f = F(); if (!f) return; setBuzz(f, key, v); again(f); }, BUZZ_LIMITS[key]);
  slide('bzf-spread', 'spread');
  slide('bzf-offset', 'offset');
  slide('bzf-gap', 'gap');
  slide('bzf-width', 'width');
  slide('bzf-angle', 'angle');
  slide('bzf-range', 'range');
  $('bzf-overlap')?.addEventListener('change', (e) => {
    const f = F();
    if (!f) return;
    setBuzz(f, 'overlap', e.target.checked ? 1 : 0);
    again(f);
    save('버즈 겹침');
  });
}
