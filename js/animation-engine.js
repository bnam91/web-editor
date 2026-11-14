/* ═══════════════════════════════════════════════════════
   ANIMATION GIF ENGINE
═══════════════════════════════════════════════════════ */
import { countUpLine, numToken, reelDigit, lineStartX, typedLines } from './fx/anim-gif-text.js';
import { drawTracks, V2_FX, TRACK_FX, normTracks, totalMs, scaleTracks, parseAnimGif, serializeAnimGif, AT_MAX, DUR_MIN, DUR_MAX } from './fx/anim-gif-tracks.js';
import { sectionBgColor } from './io/export-image.js';

const ANIM_LIST = [
  { id: 'slide-up',     label: '슬라이드업',     desc: '아래→위로 올라오며 등장' },
  { id: 'typewriter',   label: '타이핑',          desc: '한 글자씩 입력되듯 등장' },
  { id: 'slot-machine', label: '슬롯머신',        desc: '숫자가 롤링되다 멈춤' },
  { id: 'fade-in',      label: '페이드인',        desc: '투명→불투명 부드럽게' },
  { id: 'word-pop',     label: '단어별 순차등장', desc: '단어 하나씩 팝인' },
  { id: 'glow-pulse',   label: '글로우 펄스',     desc: '빛이 번쩍이며 강조' },
  { id: 'count-up',     label: '카운트업',        desc: '0부터 목표 숫자까지 카운팅' },
  /* GIF V2(현빈 GO 261114) — 줄별 타임라인 엔진(js/fx/anim-gif-tracks.js)으로 그린다 · 위 7종은 옛 _drawFrame 그대로 */
  { id: 'stamp',        label: '도장 찍기',       desc: '크고 흐리게 내려와 «쾅» 선명하게' },
  { id: 'blur-in',      label: '흐림→선명',       desc: '흐릿하게 시작해 또렷해짐' },
  { id: 'blur-whip',    label: '블러 휩',         desc: '옆에서 잔상을 끌며 휙 들어옴' },
];

/** 한 바퀴 계획 — V1 7종 = 옛 길(_drawFrame · 1200ms/속도) · V2 효과 = 줄별 타임라인(블럭 전체 = 모든 줄 같은 효과 · 0ms 동시 시작).
 *  k = 배율(블럭 1px = 캔버스 k px) — 흐림·흔들림 px 를 미리보기·GIF 에서 같은 «눈 크기»로. */
const _V2_DUR = { stamp: 560, 'blur-in': 900, 'blur-whip': 700 };
function _plan(style, speed, k) {
  /* F3 줄마다 따로 — 저장된 트랙(글 줄 수에 다시 맞춤) · 속도는 at·dur 를 나눈다 · 한 바퀴 = 가장 늦게 끝나는 줄 */
  if (_perLine && _tracks) {
    const tr = scaleTracks(normTracks(_tracks, String(style.text || '').split('\n').length), speed);
    const dur = Math.max(1, totalMs(tr));
    return { duration: dur, draw: (ctx, W, H, size, t) => drawTracks(ctx, W, H, style, size, tr, t * dur, k) };
  }
  if (!V2_FX.includes(_animType)) return { duration: 1200 / speed, draw: (ctx, W, H, size, t) => _drawFrame(ctx, W, H, style, size, _animType, t) };
  const dur = Math.round(_V2_DUR[_animType] / speed);
  const tracks = String(style.text || '').split('\n').map((_, i) => ({ line: i, fx: _animType, at: 0, dur }));
  return { duration: dur, draw: (ctx, W, H, size, t) => drawTracks(ctx, W, H, style, size, tracks, t * dur, k) };
}

let _animTb        = null;
let _animType      = 'slide-up';
let _animRafId     = null;
let _animTimeoutId = null;   // setTimeout 전용 (cancelAnimationFrame과 분리)
let _animStart     = null;
let _animLoops     = 0;
let _perLine       = false;   // F3 «줄마다 따로»
let _tracks        = null;    // F3 줄별 트랙(normTracks 결과) — 블럭 data-anim-gif 와 같은 값

/* ══ F3 줄마다 따로(현빈 GO 261114 · P076 = 질문 «타이핑» · 답 «도장») ══
   저장 = 텍스트 블럭 data-anim-gif(js/fx/anim-gif-tracks.js parseAnimGif/serializeAnimGif — 글 내용은 저장 안 함) · 값이 바뀔 때만 쓰고 이력 한 칸.
   «줄» = 글의 명시 줄바꿈 한 줄(화면에서 접힌 조각은 같은 트랙) · 줄 글은 textContent 로만 보인다. */
const _fxLabel = (id) => (ANIM_LIST.find((a) => a.id === id) || {}).label || id;
function _lineTexts() { return _animTb ? String(_getTextStyle(_animTb).text || '').split('\n') : ['']; }
function _loadAnimGif() {
  const r = parseAnimGif(_animTb?.dataset.animGif, _lineTexts().length);
  _perLine = r.perLine; _tracks = r.tracks;
  if (r.perLine) {
    const sp = document.getElementById('anim-speed'), rp = document.getElementById('anim-repeat');
    if (sp) { sp.value = String(r.speed); const v = document.getElementById('anim-speed-val'); if (v) v.textContent = r.speed + 'x'; }
    if (rp) { rp.value = String(r.repeat); const v = document.getElementById('anim-repeat-val'); if (v) v.textContent = r.repeat + '회'; }
  }
  const cb = document.getElementById('anim-per-line');
  if (cb) cb.checked = _perLine;
  _renderTrackRows();
}
function _saveAnimGif() {
  if (!_animTb) return;
  const next = (_perLine && _tracks)
    ? serializeAnimGif({ tracks: _tracks, speed: parseFloat(document.getElementById('anim-speed')?.value) || 1, repeat: parseInt(document.getElementById('anim-repeat')?.value) || 1 })
    : null;
  if ((_animTb.dataset.animGif ?? null) === next) return;   // 안 바뀌면 이력도 안 쌓는다
  if (next) _animTb.dataset.animGif = next; else delete _animTb.dataset.animGif;
  window.pushHistory?.('GIF 줄별 효과');
  window.scheduleAutoSave?.();
}
function setAnimPerLine(on) {
  _perLine = !!on;
  if (_perLine && !_tracks) _tracks = normTracks(null, _lineTexts().length, { fx: TRACK_FX.includes(_animType) ? _animType : 'fade-in', dur: 1000 });
  _renderTrackRows();
  _saveAnimGif();
  restartAnimPreview();
}
function _renderTrackRows() {
  const box = document.getElementById('anim-tracks');
  const list = document.getElementById('anim-list');
  if (list) list.classList.toggle('is-off', _perLine);   // 줄마다 따로일 땐 왼쪽 목록(블럭 전체 한 효과)은 쉰다
  if (!box) return;
  box.style.display = _perLine ? '' : 'none';
  box.textContent = '';
  if (!_perLine || !_tracks) return;
  const texts = _lineTexts();
  _tracks = normTracks(_tracks, texts.length);
  const T = Math.max(1, totalMs(_tracks));
  _tracks.forEach((tr, i) => {
    const row = document.createElement('div'); row.className = 'anim-track-row'; row.dataset.line = String(i);
    const lab = document.createElement('span'); lab.className = 'anim-track-label'; lab.textContent = (texts[i] || '').slice(0, 12) || '(빈 줄)'; lab.title = texts[i] || '';
    const sel = document.createElement('select'); sel.className = 'anim-track-fx';
    for (const id of TRACK_FX) { const o = document.createElement('option'); o.value = id; o.textContent = _fxLabel(id); o.selected = id === tr.fx; sel.appendChild(o); }
    const num = (cls, v, min, max, title) => { const n = document.createElement('input'); n.type = 'number'; n.className = cls; n.min = String(min); n.max = String(max); n.step = '50'; n.value = String(v); n.title = title; return n; };
    const atIn = num('anim-track-at', tr.at, 0, AT_MAX, '시작(ms)'), durIn = num('anim-track-dur', tr.dur, DUR_MIN, DUR_MAX, '길이(ms)');
    const bar = document.createElement('div'); bar.className = 'anim-track-bar';
    const seg = document.createElement('span'); seg.className = 'anim-track-seg';
    seg.style.left = `${(tr.at / T) * 100}%`; seg.style.width = `${(tr.dur / T) * 100}%`;
    bar.appendChild(seg);
    const apply = () => {
      _tracks[i] = { line: i, fx: sel.value, at: Number(atIn.value), dur: Number(durIn.value) };
      _tracks = normTracks(_tracks, texts.length);   // 범위 고정(소독과 같은 문)
      _renderTrackRows(); _saveAnimGif(); restartAnimPreview();
    };
    sel.addEventListener('change', apply); atIn.addEventListener('change', apply); durIn.addEventListener('change', apply);
    row.append(lab, sel, atIn, durIn, bar);
    box.appendChild(row);
  });
}

function openAnimModal(tb) {
  // BUG-FIX: tb null 가드 — null/undefined면 모달 열지 않음
  if (!tb) { console.warn('[AnimGif] openAnimModal: tb is null, skipped'); return; }
  _animTb = tb;
  const modal = document.getElementById('anim-gif-modal');
  modal.style.display = 'flex';

  // BUG-FIX: _animType을 먼저 초기화하고 buildAnimList 호출해야
  // _buildAnimList 내부 active 표시가 올바른 초기값을 반영함
  _animType = 'slide-up';
  _loadAnimGif();   // F3 — 저장된 줄별 효과가 있으면 그것으로(미리보기도)
  _buildAnimList();
  // _selectAnim은 _buildAnimList 후에 호출 (active 토글 + preview 시작)
  _selectAnim('slide-up');
  _applyEmptyGate(document.querySelector('.anim-export-btn'));

  // BUG-FIX: 오버레이 바깥 클릭으로 닫기 (한 번만 등록)
  if (!modal._overlayClickBound) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAnimModal();
    });
    modal._overlayClickBound = true;
  }
}

function closeAnimModal() {
  _saveAnimGif();   // F3 — 속도·반복을 바꾼 채 닫으면 그 값도(안 바뀌었으면 무동작)
  document.getElementById('anim-gif-modal').style.display = 'none';
  _stopAnimPreview();
}

function _buildAnimList() {
  const list = document.getElementById('anim-list');
  /* ★이름·설명은 틀에 안 넣는다 (T-049) — 지금은 이 파일의 고정 목록이지만, 「목록이
     고정이다」는 옆 파일이 바뀌면 끝나는 전제다. 어차피 아래에서 한 줄씩 훑으므로 비용이 0. */
  list.innerHTML = ANIM_LIST.map(a => `
    <div class="anim-item${a.id === _animType ? ' active' : ''}" data-id="${a.id}">
      <div class="anim-item-name"></div>
      <div class="anim-item-desc"></div>
    </div>
  `).join('');
  list.querySelectorAll('.anim-item').forEach((el, i) => {
    el.querySelector('.anim-item-name').textContent = ANIM_LIST[i].label;
    el.querySelector('.anim-item-desc').textContent = ANIM_LIST[i].desc;
    el.addEventListener('click', () => _selectAnim(el.dataset.id));
  });
}

function _selectAnim(id) {
  _animType = id;
  document.querySelectorAll('.anim-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id));
  _updateAnimConflictWarning();
  _startAnimPreview();
}

function _updateAnimConflictWarning() {
  const warn = document.getElementById('anim-conflict-warn');
  if (!warn || !_animTb) return;
  const conflictTypes = ['count-up', 'slot-machine'];
  const style = _getTextStyle(_animTb);
  const hasMultiline = style.text.includes('\n');
  warn.style.display = (conflictTypes.includes(_animType) && hasMultiline) ? 'flex' : 'none';
  const rich = document.getElementById('anim-rich-warn');
  if (rich) rich.style.display = _hasRichStyling(_animTb) ? 'flex' : 'none';
}

function restartAnimPreview() {
  _startAnimPreview();
}

function _stopAnimPreview() {
  if (_animRafId)     { cancelAnimationFrame(_animRafId); _animRafId = null; }
  if (_animTimeoutId) { clearTimeout(_animTimeoutId); _animTimeoutId = null; }
  _animStart = null;
  _animLoops = 0;
}

function _extractText(el) {
  // innerHTML 기반으로 줄바꿈을 안정적으로 추출
  const html = el.innerHTML || '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')       // <br> → 줄바꿈
    .replace(/<div/gi, '\n<div')         // <div> 앞에 줄바꿈 삽입
    .replace(/<p(?=[\s>])/gi, '\n<p')    // <p> 앞에 줄바꿈 삽입
    .replace(/<[^>]+>/g, '')             // 모든 태그 제거
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')          // 3개 이상 연속 줄바꿈 → 최대 2개
    .trim() || el.textContent?.trim() || 'Sample Text';
}

/** GIF 가 읽는 글 요소 — 그리기·경고가 같은 요소를 본다. */
function _textEl(tb) {
  return tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb.querySelector('div');
}

/* ⑸(DONE40 · 시트 GIF-V1 RICHTEXT) GIF 는 글 요소 «하나»의 스타일로 칠한다 — 글 «안» 조각 꾸밈(색·형광·굵기 등)은 사라진다.
   본 고침은 V2(조각별 그리기). 지금은 꾸밈이 있으면 모달에 한 줄 경고(지디 결정 C). 글 요소 자체의 색은 실리므로 «안쪽»만 본다. */
const _RICH_SEL = 'b, strong, i, em, u, s, mark, font, [style*="color"], [style*="background"], [style*="font-weight"], [style*="font-style"], [style*="text-decoration"]';
function _hasRichStyling(tb) {
  return !!_textEl(tb)?.querySelector(_RICH_SEL);
}

/* X2(GIF-V1-EMPTY-TEXT-SAMPLE-01) 빈 글이면 «Sample Text» GIF 가 성공 토스트와 함께 나갔다(_extractText 대체값)
   ⇒ 저장 단추를 끄고 까닭을 툴팁으로(지디 결정 A · 단추 모양은 기존 .anim-export-btn:disabled). */
const _EMPTY_TITLE = '글이 비어 있어 GIF 를 만들 수 없습니다 — 글을 먼저 입력하세요';
function _isEmptyText(tb) {
  const el = tb && _textEl(tb);
  return !el || !(el.textContent || '').trim();
}
function _applyEmptyGate(btn) {
  if (!btn) return;
  const empty = _isEmptyText(_animTb);
  btn.disabled = empty;
  if (empty) { btn.setAttribute('aria-disabled', 'true'); btn.title = _EMPTY_TITLE; }
  else { btn.removeAttribute('aria-disabled'); btn.title = ''; }
}

function _getTextStyle(tb) {
  const el  = _textEl(tb);
  if (!el) return { text: '', fontSize: 24, color: '#111111', fontFamily: 'sans-serif', fontWeight: '400', letterSpacing: 0, textAlign: 'left', lineHeight: 1.4, sectionBg: '#ffffff' };
  const cs  = window.getComputedStyle(el);
  const sec = tb.closest('.section-block');
  /* ⑷(DONE40) 인라인 style 만 읽어 클래스·테마 배경 섹션이 흰색으로 나갔다 ⇒ 정지 이미지 내보내기와 같은 규칙(computed · 투명이면 페이지 배경).
     shortcut: 그라데이션·이미지·메시 배경은 아직 «바탕색»만 깐다 — 그 모양을 깔지는 지디 결정 뒤. */
  const bg  = sec ? sectionBgColor(sec) : '#ffffff';
  return {
    text:          _extractText(el),
    fontSize:      parseFloat(cs.fontSize)      || 24,
    color:         cs.color                     || '#111111',
    fontFamily:    cs.fontFamily                || 'sans-serif',
    fontWeight:    cs.fontWeight                || '400',
    letterSpacing: parseFloat(cs.letterSpacing) || 0,
    textAlign:     el.style.textAlign || (cs.textAlign === 'start' ? 'left' : cs.textAlign) || 'left',
    lineHeight:    parseFloat(cs.lineHeight) / (parseFloat(cs.fontSize) || 1) || 1.4,
    sectionBg:     bg || '#ffffff',
  };
}

function _startAnimPreview() {
  _stopAnimPreview();
  if (!_animTb) return;
  _updateAnimConflictWarning();
  const canvas = document.getElementById('anim-preview-canvas');
  // BUG-FIX: canvas 없으면 에러 대신 조용히 리턴
  if (!canvas) { console.warn('[AnimGif] anim-preview-canvas not found'); return; }
  const ctx    = canvas.getContext('2d');
  const style  = _getTextStyle(_animTb);
  const speed  = parseFloat(document.getElementById('anim-speed')?.value  || 1);
  const repeat = parseInt(document.getElementById('anim-repeat')?.value   || 1);

  // 블록 비율 기반으로 캔버스 해상도 설정 (고정 너비 480 기준)
  // offsetWidth/offsetHeight: CSS transform(zoom) 영향 없는 실제 논리 크기
  const bW = Math.max(_animTb.offsetWidth,  1);
  const bH = Math.max(_animTb.offsetHeight, 1);
  const CANVAS_PREVIEW_W = 480;
  const ratio    = bH / bW;
  canvas.width   = CANVAS_PREVIEW_W;
  canvas.height  = Math.round(CANVAS_PREVIEW_W * ratio);

  // 폰트 크기도 비율에 맞게 스케일
  const scale       = CANVAS_PREVIEW_W / bW;
  const displaySize = Math.round(style.fontSize * scale);
  const W = canvas.width, H = canvas.height;
  const plan        = _plan(style, speed, scale);
  const duration    = plan.duration; // ms for one cycle

  _animLoops = 0;

  function tick(ts) {
    if (!_animStart) _animStart = ts;
    const elapsed = ts - _animStart;
    const t       = Math.min(elapsed / duration, 1);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = style.sectionBg || '#ffffff';
    ctx.fillRect(0, 0, W, H);
    plan.draw(ctx, W, H, displaySize, t);

    if (t < 1) {
      _animRafId = requestAnimationFrame(tick);
    } else {
      _animLoops++;
      if (_animLoops < repeat) {
        // 루프 간 300ms 대기 (카운트업 등 마지막 값 인식 시간)
        _animTimeoutId = setTimeout(() => {
          _animTimeoutId = null;
          _animStart = null;
          _animRafId = requestAnimationFrame(tick);
        }, 300);
      } else {
        // hold 1500ms then restart loop
        _animTimeoutId = setTimeout(() => {
          _animTimeoutId = null;
          _animLoops = 0;
          _animStart = null;
          _animRafId = requestAnimationFrame(tick);
        }, 1500);
      }
    }
  }
  _animRafId = requestAnimationFrame(tick);
}

function _drawFrame(ctx, W, H, style, displaySize, animType, t) {
  const cx = W / 2;
  const cy = H / 2;

  ctx.font         = `${style.fontWeight} ${displaySize}px ${style.fontFamily}`;
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = style.letterSpacing + 'px'; } catch(e) {}

  // textAlign & x-anchor
  const paddingX = Math.round(W * 0.05);
  let anchorX;
  if (style.textAlign === 'left') {
    anchorX = paddingX;
    ctx.textAlign = 'left';
  } else if (style.textAlign === 'right') {
    anchorX = W - paddingX;
    ctx.textAlign = 'right';
  } else {
    anchorX = cx;
    ctx.textAlign = 'center';
  }

  // word-wrap: 긴 줄을 maxWidth 안에 맞게 자동 분할
  const maxTextW = W - paddingX * 2;
  function wrapLine(text) {
    if (!text) return [''];
    const words = text.split(' ');
    const result = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > maxTextW && cur) {
        result.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur) result.push(cur);
    return result.length ? result : [''];
  }

  // multiline support (explicit \n + word-wrap)
  const rawLines  = style.text.split('\n');
  const lines     = rawLines.flatMap(l => wrapLine(l));
  const lineH     = displaySize * (style.lineHeight || 1.4);
  const firstLine = lines[0];

  // draw all lines centered vertically around baseY
  const drawLines = (linesArr, baseY, drawFn) => {
    const totalH = (linesArr.length - 1) * lineH;
    linesArr.forEach((line, i) => drawFn(line, anchorX, baseY - totalH / 2 + i * lineH));
  };

  switch (animType) {

    /* ── 슬라이드업 ── */
    case 'slide-up': {
      const offset = (1 - _easeOut(t)) * H * 0.45;
      ctx.save();
      ctx.globalAlpha = _easeInOut(t);
      ctx.fillStyle   = style.color;
      drawLines(lines, cy + offset, (line, x, y) => ctx.fillText(line, x, y));
      ctx.restore();
      break;
    }

    /* ── 타이핑 ── */
    case 'typewriter': {
      /* ⑶·X1(DONE40) 원문(줄바꿈 전)을 잘라 매 프레임 다시 정렬했다 ⇒ 가운데 정렬이면 친 글자가 왼쪽으로 밀리고, 긴 글은 폭을 넘었다.
         ⇒ 다른 효과와 같은 줄(wrapLine 뒤 lines)에서 치고, 줄 시작 x 는 «그 줄 전체» 폭으로 고정한다. */
      const shown  = typedLines(lines, t);
      const totalH = (lines.length - 1) * lineH;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'left';
      let curX = null, curY = null;
      shown.forEach((part, i) => {
        const x = lineStartX(style.textAlign, anchorX, ctx.measureText(lines[i]).width);
        const y = cy - totalH / 2 + i * lineH;
        ctx.fillText(part, x, y);
        curX = x + ctx.measureText(part).width + 2; curY = y;
      });
      if (t < 1 && curX != null) ctx.fillRect(curX, curY - displaySize * 0.45, 2, displaySize * 0.9);   // 커서
      break;
    }

    /* ── 슬롯머신 (줄바꿈 시 첫줄만) ── */
    case 'slot-machine': {
      if (!numToken(firstLine)) {
        const offset = (1 - _easeOut(t)) * H * 0.4;
        ctx.save(); ctx.globalAlpha = t;
        ctx.fillStyle = style.color;
        ctx.fillText(firstLine, anchorX, cy + offset);
        ctx.restore();
        break;
      }
      /* ⑵·X3(DONE40) 숫자 교체 + 줄 통째 슬라이드 + «첫 묶음+10» 잔상이었다(릴 아님 · 없는 숫자가 보임)
         ⇒ 수(콤마·소수 포함)의 «자리마다» 릴이 돌고 오른쪽 자리일수록 늦게 멈춘다. 숫자 아닌 글자는 제자리. */
      const tok    = numToken(firstLine);
      const nDig   = tok.raw.replace(/\D/g, '').length;
      const step   = displaySize * 1.2;
      const startX = lineStartX(style.textAlign, anchorX, ctx.measureText(firstLine).width);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, cy - displaySize * 0.6, W, displaySize * 1.2);
      ctx.clip();
      ctx.fillStyle = style.color;
      let order = 0;   // 왼쪽 자리부터 0 — 오른쪽 자리일수록 늦게 멈춘다
      for (let i = 0; i < firstLine.length; i++) {
        const ch = firstLine[i];
        const x  = startX + ctx.measureText(firstLine.slice(0, i)).width;
        const inNum = i >= tok.index && i < tok.index + tok.raw.length && ch >= '0' && ch <= '9';
        if (!inNum) { ctx.textAlign = 'left'; ctx.fillText(ch, x, cy); continue; }
        const r  = reelDigit(+ch, order++, nDig, t, _easeOut);
        const mx = x + ctx.measureText(ch).width / 2;
        ctx.textAlign = 'center';
        ctx.fillText(String(r.cur), mx, cy - r.frac * step);
        if (r.frac) ctx.fillText(String(r.next), mx, cy + (1 - r.frac) * step);
      }
      ctx.restore();
      break;
    }

    /* ── 페이드인 ── */
    case 'fade-in': {
      ctx.save();
      ctx.globalAlpha = _easeInOut(t);
      ctx.fillStyle   = style.color;
      drawLines(lines, cy, (line, x, y) => ctx.fillText(line, x, y));
      ctx.restore();
      break;
    }

    /* ── 단어별 순차등장 ── */
    case 'word-pop': {
      // wrapLine으로 줄 나눔 후 단어 순서 재구성
      const wrappedLines = lines; // 이미 위에서 wrapLine 처리됨
      const spaceW = ctx.measureText(' ').width;

      // 전체 단어 목록 (줄 순서 유지, 줄 정보 포함)
      const wordEntries = [];
      wrappedLines.forEach((line, lineIdx) => {
        line.split(' ').filter(w => w).forEach(word => {
          wordEntries.push({ word, lineIdx });
        });
      });
      if (!wordEntries.length) break;

      const totalWords = wordEntries.length;
      const totalH = wrappedLines.length * lineH;
      const startY = cy - totalH / 2 + lineH / 2;

      wrappedLines.forEach((line, lineIdx) => {
        const lineWords = line.split(' ').filter(w => w);
        const lineWidths = lineWords.map(w => ctx.measureText(w).width);
        const lineW = lineWidths.reduce((s, w) => s + w, 0) + spaceW * (lineWords.length - 1);
        let x;
        if (style.textAlign === 'left')       x = anchorX;
        else if (style.textAlign === 'right') x = anchorX - lineW;
        else                                  x = cx - lineW / 2;

        const y = startY + lineIdx * lineH;
        // 이 줄의 첫 단어가 전체에서 몇 번째인지
        const lineStartIdx = wordEntries.findIndex(e => e.lineIdx === lineIdx);

        lineWords.forEach((word, wi) => {
          const globalIdx = lineStartIdx + wi;
          const prog = Math.max(0, Math.min(1, t * totalWords - globalIdx));
          const sc   = 0.6 + 0.4 * _easeOut(prog);
          const wx   = x + lineWidths[wi] / 2;
          ctx.save();
          ctx.globalAlpha = prog;
          ctx.textAlign = 'left';
          ctx.translate(wx, y);
          ctx.scale(sc, sc);
          ctx.fillStyle = style.color;
          ctx.fillText(word, -lineWidths[wi] / 2, 0);
          ctx.restore();
          x += lineWidths[wi] + spaceW;
        });
      });
      break;
    }

    /* ── 글로우 펄스 ── */
    case 'glow-pulse': {
      const phase = t * Math.PI * 4;
      const glow  = 0.5 + 0.5 * Math.sin(phase);
      ctx.save();
      ctx.shadowColor = style.color;
      ctx.shadowBlur  = 4 + 32 * glow;
      ctx.globalAlpha = 0.6 + 0.4 * glow;
      ctx.fillStyle   = style.color;
      drawLines(lines, cy, (line, x, y) => ctx.fillText(line, x, y));
      ctx.restore();
      break;
    }

    /* ── 카운트업 (줄바꿈 시 첫줄만) ── */
    case 'count-up': {
      /* ⑴(DONE40) 첫 숫자 묶음만 셌다(12,345 → 0,345…) ⇒ 콤마·소수까지 한 수로 0 부터 센다. 수가 없으면 옛 꼴(0→100). */
      const display  = countUpLine(firstLine, t >= 1 ? 1 : _easeOut(t)) ?? Math.floor(100 * _easeOut(t)).toString();
      const scale    = t === 1 ? 1 : (1 + 0.05 * Math.sin(t * Math.PI * 8) * (1 - t));
      ctx.save();
      ctx.translate(anchorX, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = style.color;
      ctx.fillText(display, 0, 0);
      ctx.restore();
      break;
    }
  }
}

function _easeOut(t)   { return 1 - Math.pow(1 - t, 3); }
function _easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

/* ── GIF 내보내기 ── */
const _GIF_BTN_HTML = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v7M3 5l3 4 3-4"/><path d="M1 10h10"/></svg> GIF 저장`;

function _restoreGifBtn(btn) {
  btn.innerHTML = _GIF_BTN_HTML;
  _applyEmptyGate(btn);   // 다시 켤 때도 빈 글이면 꺼 둔다
}

/* ⑹(DONE40) 실패를 네이티브 alert 로 띄워 앱 창이 막혔다 ⇒ 앱의 다른 알림처럼 토스트(창을 안 막는다). */
function _gifFail(err) {
  window.showToast?.('⚠️ GIF 생성 중 오류가 발생했습니다: ' + (err && err.message ? err.message : err));
}

async function exportAnimGif() {
  if (!_animTb) return;

  const btn = document.querySelector('.anim-export-btn');
  // 중복 클릭 방지: 이미 비활성화 상태면 무시 · 빈 글은 만들지 않는다(콘솔 호출 길 포함)
  if (btn.disabled || _isEmptyText(_animTb)) return;

  btn.disabled    = true;
  btn.textContent = '생성 중...';

  try {
    const style  = _getTextStyle(_animTb);
    const speed  = parseFloat(document.getElementById('anim-speed')?.value) || 1;
    // BUG-FIX: parseInt(value || 1)은 value="0"일 때 1로 오버라이드됨
    // 올바른 방법: null/undefined/빈문자열만 기본값 처리
    const repeatRaw = document.getElementById('anim-repeat')?.value;
    const repeat = (repeatRaw != null && repeatRaw !== '') ? parseInt(repeatRaw) : 1;

    // 동적 캔버스 크기: 실제 블록 크기 기반 2x 해상도
    // BUG-FIX: offsetWidth가 0이면 scale이 Infinity → displaySize가 Infinity 방지
    const bW = Math.max(_animTb.offsetWidth,  1);
    const bH = Math.max(_animTb.offsetHeight, 1);
    const W = Math.max(320, Math.round(bW * 2));
    const H = Math.max(80,  Math.round(bH * 2));
    const offCanvas  = document.createElement('canvas');
    offCanvas.width  = W;
    offCanvas.height = H;
    const ctx = offCanvas.getContext('2d');

    const scale       = W / bW;
    const displaySize = Math.round(style.fontSize * scale);
    const plan        = _plan(style, speed, scale);
    const duration    = plan.duration; // ms
    const fps         = 20;
    const frames      = Math.ceil((duration / 1000) * fps);
    const delay       = Math.round(1000 / fps);

    const gif = new GIF({
      workers:      2,
      quality:      8,
      width:        W,
      height:       H,
      workerScript: 'js/gif.worker.js',
      // gif.js: repeat=-1 → 1회 재생, repeat=0 → 무한루프, repeat=N → N번 추가반복
      // UI 슬라이더 min=1이므로 repeat=1은 "1회 재생"(=-1), repeat=2는 "2회"(=1번 추가반복)
      repeat:       repeat <= 1 ? -1 : repeat - 1,
    });

    for (let i = 0; i <= frames; i++) {
      const t = i / frames;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = style.sectionBg || '#ffffff';
      ctx.fillRect(0, 0, W, H);
      plan.draw(ctx, W, H, displaySize, t);
      gif.addFrame(ctx, { copy: true, delay });
    }
    // 마지막 값에서 1.5초 정지 (카운트업 등 UX)
    const holdFrames = Math.ceil(fps * 1.5);
    for (let i = 0; i < holdFrames; i++) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = style.sectionBg || '#ffffff';
      ctx.fillRect(0, 0, W, H);
      plan.draw(ctx, W, H, displaySize, 1);
      gif.addFrame(ctx, { copy: true, delay });
    }

    // 진행률 표시
    gif.on('progress', p => {
      btn.textContent = `생성 중... ${Math.round(p * 100)}%`;
    });

    gif.on('finished', blob => {
      // BUG-FIX: Electron에서 DOM 미삽입 <a>의 .click()은 다운로드를 트리거하지 않을 수 있음
      // document.body에 추가 후 클릭, 그 다음 제거
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = 'sangpe_animation.gif';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // BUG-FIX: Electron 다운로드는 비동기 처리 → 즉시 revoke하면 URL 무효화 위험
      // setTimeout으로 1초 후 revoke하여 다운로드 핸들러가 URL을 읽을 시간 확보
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showToast('✅ GIF 저장 완료!');
      _restoreGifBtn(btn);
    });

    // BUG-FIX: gif.on('error') 없으면 Worker 에러 시 EventEmitter가 uncaught error throw → 앱 크래시
    gif.on('error', err => {
      console.error('[GIF] Worker error:', err);
      _gifFail(err);
      _restoreGifBtn(btn);
    });

    gif.render();

  } catch (err) {
    console.error('GIF export error:', err);
    _gifFail(err);
    _restoreGifBtn(btn);
  }
}

window.openAnimModal    = openAnimModal;
// BUG-FIX: openAnimGifModal 별칭 추가 (외부에서 다른 이름으로 호출하는 경우 대비)
window.openAnimGifModal = openAnimModal;
window.closeAnimModal   = closeAnimModal;
window.setAnimPerLine   = setAnimPerLine;
window.exportAnimGif    = exportAnimGif;
