/* ═══════════════════════════════════════════════════════
   ANIMATION GIF ENGINE
═══════════════════════════════════════════════════════ */

const ANIM_LIST = [
  { id: 'slide-up',     label: '슬라이드업',     desc: '아래→위로 올라오며 등장' },
  { id: 'typewriter',   label: '타이핑',          desc: '한 글자씩 입력되듯 등장' },
  { id: 'slot-machine', label: '슬롯머신',        desc: '숫자가 롤링되다 멈춤' },
  { id: 'fade-in',      label: '페이드인',        desc: '투명→불투명 부드럽게' },
  { id: 'word-pop',     label: '단어별 순차등장', desc: '단어 하나씩 팝인' },
  { id: 'glow-pulse',   label: '글로우 펄스',     desc: '빛이 번쩍이며 강조' },
  { id: 'count-up',     label: '카운트업',        desc: '0부터 목표 숫자까지 카운팅' },
];

let _animTb        = null;
let _animType      = 'slide-up';
let _animRafId     = null;
let _animTimeoutId = null;   // setTimeout 전용 (cancelAnimationFrame과 분리)
let _animStart     = null;
let _animLoops     = 0;

function openAnimModal(tb) {
  // BUG-FIX: tb null 가드 — null/undefined면 모달 열지 않음
  if (!tb) { console.warn('[AnimGif] openAnimModal: tb is null, skipped'); return; }
  _animTb = tb;
  const modal = document.getElementById('anim-gif-modal');
  modal.style.display = 'flex';

  // BUG-FIX: _animType을 먼저 초기화하고 buildAnimList 호출해야
  // _buildAnimList 내부 active 표시가 올바른 초기값을 반영함
  _animType = 'slide-up';
  _buildAnimList();
  // _selectAnim은 _buildAnimList 후에 호출 (active 토글 + preview 시작)
  _selectAnim('slide-up');

  // BUG-FIX: 오버레이 바깥 클릭으로 닫기 (한 번만 등록)
  if (!modal._overlayClickBound) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAnimModal();
    });
    modal._overlayClickBound = true;
  }
}

function closeAnimModal() {
  document.getElementById('anim-gif-modal').style.display = 'none';
  _stopAnimPreview();
}

function _buildAnimList() {
  const list = document.getElementById('anim-list');
  list.innerHTML = ANIM_LIST.map(a => `
    <div class="anim-item${a.id === _animType ? ' active' : ''}" data-id="${a.id}">
      <div class="anim-item-name">${a.label}</div>
      <div class="anim-item-desc">${a.desc}</div>
    </div>
  `).join('');
  list.querySelectorAll('.anim-item').forEach(el => {
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

function _getTextStyle(tb) {
  const el  = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb.querySelector('div');
  if (!el) return { text: '', fontSize: 24, color: '#111111', fontFamily: 'sans-serif', fontWeight: '400', letterSpacing: 0, textAlign: 'left', lineHeight: 1.4, sectionBg: '#ffffff' };
  const cs  = window.getComputedStyle(el);
  const sec = tb.closest('.section-block');
  const bg  = sec ? (sec.style.backgroundColor || sec.style.background || '#ffffff') : '#ffffff';
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
  const duration    = 1200 / speed; // ms for one cycle

  _animLoops = 0;

  function tick(ts) {
    if (!_animStart) _animStart = ts;
    const elapsed = ts - _animStart;
    const t       = Math.min(elapsed / duration, 1);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = style.sectionBg || '#ffffff';
    ctx.fillRect(0, 0, W, H);
    _drawFrame(ctx, W, H, style, displaySize, _animType, t);

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
      const n            = Math.floor(t * style.text.length);
      const partial      = style.text.slice(0, n);
      const partialLines = partial.split('\n');
      const totalH       = (lines.length - 1) * lineH;
      ctx.fillStyle = style.color;
      partialLines.forEach((line, i) => {
        ctx.fillText(line, anchorX, cy - totalH / 2 + i * lineH);
      });
      // cursor blink
      if (t < 1) {
        const lastLine = partialLines[partialLines.length - 1];
        const lastY    = cy - totalH / 2 + (partialLines.length - 1) * lineH;
        const tw       = ctx.measureText(lastLine).width;
        let curX;
        if (style.textAlign === 'left')       curX = anchorX + tw + 2;
        else if (style.textAlign === 'right') curX = anchorX - tw - 2;
        else                                  curX = anchorX + tw / 2 + 2;
        ctx.fillRect(curX, lastY - displaySize * 0.45, 2, displaySize * 0.9);
      }
      break;
    }

    /* ── 슬롯머신 (줄바꿈 시 첫줄만) ── */
    case 'slot-machine': {
      const numMatch = firstLine.match(/\d+/);
      if (!numMatch) {
        const offset = (1 - _easeOut(t)) * H * 0.4;
        ctx.save(); ctx.globalAlpha = t;
        ctx.fillStyle = style.color;
        ctx.fillText(firstLine, anchorX, cy + offset);
        ctx.restore();
        break;
      }
      const target  = parseInt(numMatch[0]);
      const current = Math.floor(target * _easeOut(t));
      const display = firstLine.replace(/\d+/, current.toString());
      const rollY   = (1 - _easeOut(t)) * displaySize * 1.5;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, cy - displaySize, W, displaySize * 2);
      ctx.clip();
      ctx.fillStyle = style.color;
      ctx.fillText(display, anchorX, cy + rollY);
      ctx.globalAlpha = 0.3 * (1 - t);
      ctx.fillText(firstLine.replace(/\d+/, (target + 10).toString()), anchorX, cy + rollY - displaySize * 1.2);
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
      const numMatch = firstLine.match(/\d+/);
      const target   = numMatch ? parseInt(numMatch[0]) : 100;
      const current  = Math.floor(target * _easeOut(t));
      const display  = numMatch ? firstLine.replace(/\d+/, current.toString()) : current.toString();
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
  btn.disabled  = false;
  btn.innerHTML = _GIF_BTN_HTML;
}

async function exportAnimGif() {
  if (!_animTb) return;

  const btn = document.querySelector('.anim-export-btn');
  // 중복 클릭 방지: 이미 비활성화 상태면 무시
  if (btn.disabled) return;

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
    const duration    = 1200 / speed; // ms
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
      _drawFrame(ctx, W, H, style, displaySize, _animType, t);
      gif.addFrame(ctx, { copy: true, delay });
    }
    // 마지막 값에서 1.5초 정지 (카운트업 등 UX)
    const holdFrames = Math.ceil(fps * 1.5);
    for (let i = 0; i < holdFrames; i++) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = style.sectionBg || '#ffffff';
      ctx.fillRect(0, 0, W, H);
      _drawFrame(ctx, W, H, style, displaySize, _animType, 1);
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
      alert('GIF 생성 중 오류가 발생했습니다: ' + (err && err.message ? err.message : err));
      _restoreGifBtn(btn);
    });

    gif.render();

  } catch (err) {
    console.error('GIF export error:', err);
    alert('GIF 생성 중 오류가 발생했습니다: ' + err.message);
    _restoreGifBtn(btn);
  }
}

window.openAnimModal    = openAnimModal;
// BUG-FIX: openAnimGifModal 별칭 추가 (외부에서 다른 이름으로 호출하는 경우 대비)
window.openAnimGifModal = openAnimModal;
window.closeAnimModal   = closeAnimModal;
window.exportAnimGif    = exportAnimGif;
