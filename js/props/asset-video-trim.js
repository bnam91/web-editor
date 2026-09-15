/* ══════════════════════════════════════
   영상/GIF 에셋 — 트림·프레임 컨트롤 (프로토타입, feature/video-trim-controls)
   디자인 스펙: video-trim-mockup.html (지디 확정) — 필름스트립은 1차 구현 범위 밖(플레이스홀더).
   GIF 인코딩은 js/animation-engine.js(exportAnimGif)와 같은 벤더 라이브러리 재사용(js/gif.js·js/gif.worker.js).
══════════════════════════════════════ */

/* 캔버스 표시용 — IN/OUT 밖으로 나가면 IN으로 되돌려 "구간만 재생"을 만든다.
   패널이 닫혀 있어도(즉 bindBlock 시점에) 걸어 둔다 — 트림 편집과 캔버스 재생을 분리. */
export function attachAssetVideoTrimLoop(ab) {
  const video = ab?.querySelector('.asset-video');
  if (!video || video._trimLoopBound) return;
  video._trimLoopBound = true;
  const rate = parseFloat(ab.dataset.playbackRate);
  if (Number.isFinite(rate) && rate > 0) video.playbackRate = rate;
  video.addEventListener('timeupdate', () => {
    const inT  = parseFloat(ab.dataset.trimIn);
    const outT = parseFloat(ab.dataset.trimOut);
    if (!Number.isFinite(inT) || !Number.isFinite(outT) || outT <= inT) return;
    if (video.currentTime < inT - 0.05 || video.currentTime >= outT) video.currentTime = inT;
  });
}

function fmtT(s) {
  return Number.isFinite(s) ? s.toFixed(1) + 's' : '—';
}

export function videoTrimSectionHTML(ab) {
  const video = ab.querySelector('.asset-video');
  const dur   = video?.duration;
  const ready = Number.isFinite(dur) && dur > 0;
  const inT   = parseFloat(ab.dataset.trimIn);
  const outT  = parseFloat(ab.dataset.trimOut);
  const speed = ab.dataset.playbackRate || '1';

  if (!ready) {
    return `
    <div class="prop-section">
      <div class="prop-section-title">Video</div>
      <div class="prop-hint" style="text-align:center;padding:8px 0;">영상 정보를 불러오는 중...</div>
    </div>`;
  }

  return `
    <div class="prop-section">
      <div class="prop-section-title">Video 트림</div>
      <div class="vtrim-track-wrap" id="vtrim-track-wrap">
        <div class="vtrim-track"></div>
        <div class="vtrim-range" id="vtrim-range"></div>
        <div class="vtrim-playhead" id="vtrim-playhead"></div>
        <div class="vtrim-handle" data-handle="in" id="vtrim-handle-in" title="시작 지점"></div>
        <div class="vtrim-handle" data-handle="out" id="vtrim-handle-out" title="끝 지점"></div>
      </div>
      <div class="prop-row" style="justify-content:space-between;">
        <span class="prop-value-text">IN <b id="vtrim-in-label">${fmtT(inT)}</b></span>
        <span class="prop-value-text">OUT <b id="vtrim-out-label">${fmtT(outT)}</b></span>
        <span class="prop-value-text">길이 <b id="vtrim-dur-label">${fmtT(outT - inT)}</b></span>
      </div>
      <button class="prop-action-btn secondary" id="vtrim-mark-btn" style="margin-top:2px;">▣ 현재 프레임을 썸네일로 고정</button>
      <div class="prop-row" style="margin-top:10px;">
        <span class="prop-label">재생속도</span>
        <select class="prop-select" id="vtrim-speed" style="flex:1">
          <option value="0.5"${speed === '0.5' ? ' selected' : ''}>0.5×</option>
          <option value="1"${speed === '1' ? ' selected' : ''}>1×</option>
          <option value="1.5"${speed === '1.5' ? ' selected' : ''}>1.5×</option>
          <option value="2"${speed === '2' ? ' selected' : ''}>2×</option>
        </select>
      </div>
      <button class="prop-action-btn secondary" id="vtrim-export-frame-btn" style="margin-top:8px;">현재 프레임 이미지로 내보내기</button>
      <button class="prop-action-btn primary" id="vtrim-export-gif-btn" style="margin-top:6px;">GIF로 내보내기</button>
    </div>`;
}

export function wireVideoTrim(ab) {
  const video = ab.querySelector('.asset-video');
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
  attachAssetVideoTrimLoop(ab);

  const dur       = video.duration;
  const wrap      = document.getElementById('vtrim-track-wrap');
  const rangeEl   = document.getElementById('vtrim-range');
  const playhead  = document.getElementById('vtrim-playhead');
  const handleIn  = document.getElementById('vtrim-handle-in');
  const handleOut = document.getElementById('vtrim-handle-out');
  const inLabel   = document.getElementById('vtrim-in-label');
  const outLabel  = document.getElementById('vtrim-out-label');
  const durLabel  = document.getElementById('vtrim-dur-label');
  if (!wrap) return;

  const inT  = () => parseFloat(ab.dataset.trimIn);
  const outT = () => parseFloat(ab.dataset.trimOut);
  const pct  = t => Math.max(0, Math.min(100, (t / dur) * 100));

  const paint = () => {
    const ip = pct(inT()), op = pct(outT());
    handleIn.style.left  = ip + '%';
    handleOut.style.left = op + '%';
    rangeEl.style.left   = ip + '%';
    rangeEl.style.width  = (op - ip) + '%';
    inLabel.textContent  = fmtT(inT());
    outLabel.textContent = fmtT(outT());
    durLabel.textContent = fmtT(outT() - inT());
  };
  const paintPlayhead = () => { playhead.style.left = pct(video.currentTime) + '%'; };
  paint();
  paintPlayhead();

  // ★패널 재오픈마다 이 함수가 다시 불린다 — 가드 없이 addEventListener만 하면
  //   video(패널과 달리 재생성 안 됨)에 리스너가 계속 쌓인다(적대적 QA 실측: 6회 재선택 후 7개
  //   누적, 죽은 #vtrim-playhead 참조). attachAssetVideoTrimLoop과 같은 방식으로 직전 것만 뗀다.
  if (video._paintPlayheadFn) video.removeEventListener('timeupdate', video._paintPlayheadFn);
  video._paintPlayheadFn = paintPlayhead;
  video.addEventListener('timeupdate', paintPlayhead);

  const dragHandle = (el, isIn) => {
    el.addEventListener('pointerdown', ev => {
      ev.stopPropagation();
      el.setPointerCapture(ev.pointerId);
      const onMove = mv => {
        const r = wrap.getBoundingClientRect();
        let t = ((mv.clientX - r.left) / r.width) * dur;
        t = Math.max(0, Math.min(dur, t));
        const minGap = dur * 0.02;
        if (isIn) { t = Math.min(t, outT() - minGap); ab.dataset.trimIn = String(Math.max(0, t)); }
        else      { t = Math.max(t, inT() + minGap);  ab.dataset.trimOut = String(Math.min(dur, t)); }
        video.currentTime = t;
        paint();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.pushHistory?.('영상 트림 구간 조절');
        window.scheduleAutoSave?.();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  };
  dragHandle(handleIn, true);
  dragHandle(handleOut, false);

  // 트랙(핸들 아닌 곳) 클릭/드래그 = 재생헤드 스크럽
  wrap.addEventListener('pointerdown', ev => {
    if (ev.target === handleIn || ev.target === handleOut) return;
    const seek = mv => {
      const r = wrap.getBoundingClientRect();
      let t = ((mv.clientX - r.left) / r.width) * dur;
      t = Math.max(inT(), Math.min(outT(), t));
      video.currentTime = t;
      paintPlayhead();
    };
    seek(ev);
    const onMove = mv => seek(mv);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  document.getElementById('vtrim-speed').addEventListener('change', e => {
    const v = parseFloat(e.target.value) || 1;
    video.playbackRate = v;
    ab.dataset.playbackRate = String(v);
    window.pushHistory?.('영상 재생속도 변경');
  });

  // 현재 프레임 → 캔버스 캡처 (공용 헬퍼, 두 버튼이 재사용)
  const captureFrame = () => {
    const cv = document.createElement('canvas');
    cv.width  = video.videoWidth  || 860;
    cv.height = video.videoHeight || 480;
    cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
    return cv;
  };

  document.getElementById('vtrim-mark-btn').addEventListener('click', () => {
    const dataUrl = captureFrame().toDataURL('image/png');
    window.pushHistory?.('영상 프레임 썸네일 고정');
    // 기존 정적 이미지 파이프라인 재사용 — 에셋을 <img>로 되돌린다(트림 데이터는 함께 소멸)
    window.setAssetImageFromSrc?.(ab, dataUrl);
    window.scheduleAutoSave?.();
    window.showToast?.('▣ 현재 프레임을 썸네일로 고정했습니다');
  });

  document.getElementById('vtrim-export-frame-btn').addEventListener('click', () => {
    captureFrame().toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frame-${Math.round(video.currentTime * 10)}.png`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  });

  document.getElementById('vtrim-export-gif-btn').addEventListener('click', () => {
    exportVideoGif(ab, video, inT(), outT());
  });
}

/* 트림 구간(IN~OUT)을 GIF로 인코딩 — 기존 카드뉴스 애니메이션(js/animation-engine.js exportAnimGif)과
   같은 벤더 라이브러리(js/gif.js + js/gif.worker.js, 전역 GIF)를 재사용한다. */
const VTRIM_GIF_FPS = 10;
const VTRIM_GIF_MAX_FRAMES = 80; // 프로토타입 안전판 — 8초(10fps) 상당
const VTRIM_GIF_MAX_W = 480;     // 파일 크기 방지용 다운스케일 상한

function exportVideoGif(ab, video, inT, outT) {
  const btn = document.getElementById('vtrim-export-gif-btn');
  if (!btn || btn.dataset.busy === '1') return;
  if (typeof window.GIF !== 'function') { window.showToast?.('❌ GIF 라이브러리를 불러오지 못했습니다'); return; }
  if (!Number.isFinite(inT) || !Number.isFinite(outT) || outT <= inT) return;

  const origText = btn.textContent;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = 'GIF 생성 중...';

  const wasPaused  = video.paused;
  const savedTime  = video.currentTime;
  const rate       = parseFloat(ab.dataset.playbackRate) || 1;
  video.pause();

  const vw = video.videoWidth  || 480;
  const vh = video.videoHeight || 270;
  const scale = Math.min(1, VTRIM_GIF_MAX_W / vw);
  const W = Math.max(2, Math.round(vw * scale));
  const H = Math.max(2, Math.round(vh * scale));

  const rangeDur   = outT - inT;
  const frameCount = Math.max(2, Math.min(VTRIM_GIF_MAX_FRAMES, Math.round(rangeDur * VTRIM_GIF_FPS)));
  const dt         = rangeDur / frameCount;
  // GIF 프레임 delay는 재생속도를 그대로 반영(2배속 선택 시 delay를 절반으로 → 감상 시 2배처럼 보임).
  // 대부분 뷰어가 <20ms는 100ms로 취급하므로 하한을 둔다.
  const delayMs    = Math.max(20, Math.round((dt * 1000) / rate));

  const cv  = document.createElement('canvas');
  cv.width  = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  const seekTo = t => new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; video.removeEventListener('seeked', finish); resolve(); };
    video.addEventListener('seeked', finish);
    video.currentTime = t;
    setTimeout(finish, 500); // seeked 미발화 대비 안전망
  });

  const cleanupAndRestore = () => {
    video.currentTime = savedTime;
    if (!wasPaused) video.play().catch(() => {});
    btn.disabled = false;
    btn.dataset.busy = '0';
    btn.textContent = origText;
  };

  (async () => {
    const gif = new window.GIF({
      workers: 2, quality: 10, width: W, height: H,
      workerScript: 'js/gif.worker.js', repeat: 0,
    });
    for (let i = 0; i < frameCount; i++) {
      const t = Math.min(outT, inT + i * dt);
      await seekTo(t);
      ctx.drawImage(video, 0, 0, W, H);
      gif.addFrame(ctx, { copy: true, delay: delayMs });
    }
    gif.on('progress', p => { btn.textContent = `GIF 생성 중... ${Math.round(p * 100)}%`; });
    gif.on('finished', blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-trim-${Date.now()}.gif`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      cleanupAndRestore();
      window.showToast?.('✅ GIF 저장 완료!');
    });
    gif.render();
  })().catch(err => {
    console.warn('[asset-video-trim] GIF 생성 실패:', err);
    cleanupAndRestore();
    window.showToast?.('❌ GIF 생성 실패: ' + (err?.message || err));
  });
}

window.attachAssetVideoTrimLoop = attachAssetVideoTrimLoop;
