/* ══════════════════════════════════════
   영상/GIF 에셋 — 트림·프레임 컨트롤 (feature/video-trim-controls + video-gif-export)
   디자인 스펙: video-trim-mockup.html (지디 확정) — 필름스트립은 1차 구현 범위 밖(플레이스홀더).
   GIF 인코딩은 js/animation-engine.js(exportAnimGif)와 같은 벤더 라이브러리 재사용(js/gif.js·js/gif.worker.js).
══════════════════════════════════════ */
import { canvasToGifBlob } from '../io/export-image.js';

const GIF_TARGET_INTERVAL_MS = 120;  // 목표 프레임 간격
const GIF_MAX_FRAMES         = 60;   // 상한 — js/io/export-image.js 와 동일값(무한렌더 방지)
const GIF_BASE_MAX_WIDTH     = 480;  // 기본 해상도 상한
const GIF_REDUCED_MAX_WIDTH  = 320;  // 프레임수 상한에 걸렸을 때 추가로 낮추는 해상도
const GIF_SEEK_TIMEOUT_MS    = 1500; // seeked 이벤트가 안 오는 코덱/구간 대비 폴백

// 트림 구간 길이에 맞춰 프레임수/간격/해상도를 정한다.
// 구간이 길어 naive 프레임수가 상한을 넘으면 프레임수를 상한으로 고정하고(간격↑) 해상도도 낮춘다.
function planGifExport(video, inT, outT) {
  const trimDur = Math.max(0.05, outT - inT);
  const naiveFrames = Math.ceil((trimDur * 1000) / GIF_TARGET_INTERVAL_MS);
  const capped = naiveFrames > GIF_MAX_FRAMES;
  const frameCount = Math.max(2, Math.min(naiveFrames, GIF_MAX_FRAMES));
  const intervalSec = trimDur / frameCount;
  const maxW = capped ? GIF_REDUCED_MAX_WIDTH : GIF_BASE_MAX_WIDTH;
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;
  const scale = Math.min(1, maxW / vw);
  return {
    frameCount,
    intervalSec,
    width:  Math.max(2, Math.round(vw * scale)),
    height: Math.max(2, Math.round(vh * scale)),
    capped,
  };
}

function seekTo(video, t) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      resolve();
    };
    video.addEventListener('seeked', finish);
    video.currentTime = t;
    setTimeout(finish, GIF_SEEK_TIMEOUT_MS);
  });
}

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

// 트림 구간을 GIF blob으로 인코딩 — "GIF로 적용"(finalize)과 "GIF로 내보내기"(download) 두
// 버튼이 공유하는 핵심 인코딩 경로(T-012). onProgress(text)로 버튼 라벨을 갱신한다.
async function encodeTrimToGif(video, inT, outT, speed, onProgress) {
  const plan = planGifExport(video, inT, outT);
  if (plan.capped) {
    window.showToast?.(`⚠️ 트림 구간이 길어 프레임 ${plan.frameCount}장·${plan.width}×${plan.height}로 자동 축소했습니다`);
  }
  const delayMs = Math.max(20, Math.round((plan.intervalSec * 1000) / (speed || 1)));

  const frameCanvases = [];
  const frameDelays = [];
  for (let i = 0; i < plan.frameCount; i++) {
    onProgress?.(`프레임 캡처 중... (${i + 1}/${plan.frameCount})`);
    const t = Math.min(outT, inT + i * plan.intervalSec);
    await seekTo(video, t);
    const cv = document.createElement('canvas');
    cv.width = plan.width;
    cv.height = plan.height;
    cv.getContext('2d').drawImage(video, 0, 0, plan.width, plan.height);
    frameCanvases.push(cv);
    frameDelays.push(delayMs);
  }

  onProgress?.('GIF 인코딩 중... 0%');
  const blob = await canvasToGifBlob(frameCanvases, frameDelays, {
    repeat: 0,
    background: '#ffffff',
    onProgress: p => onProgress?.(`GIF 인코딩 중... ${Math.round(p * 100)}%`),
  });
  return { blob, plan };
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
      <button class="prop-action-btn primary" id="vtrim-apply-gif-btn" style="margin-top:12px;">✓ GIF로 적용</button>
      <div class="prop-hint" style="text-align:center;margin-top:2px;">트림 구간을 구워 이 블록의 최종 이미지(GIF)로 확정합니다</div>
      <button class="prop-action-btn secondary" id="vtrim-export-frame-btn" style="margin-top:10px;">현재 프레임 이미지로 내보내기</button>
      <button class="prop-action-btn secondary" id="vtrim-export-gif-btn" style="margin-top:6px;">GIF로 내보내기(다운로드)</button>
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

  document.getElementById('vtrim-export-gif-btn').addEventListener('click', async () => {
    const btn = document.getElementById('vtrim-export-gif-btn');
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const originalLabel = btn.textContent;
    const wasPaused = video.paused;
    video.pause();
    try {
      const speed = parseFloat(ab.dataset.playbackRate) || 1;
      const { blob, plan } = await encodeTrimToGif(video, inT(), outT(), speed, text => { btn.textContent = text; });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-trim-${Math.round(inT() * 10)}-${Math.round(outT() * 10)}.gif`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      window.showToast?.(`GIF 내보내기 완료 (${plan.frameCount}프레임 · ${(blob.size / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.error('[GIF export]', err);
      window.showToast?.('GIF 내보내기 실패: ' + (err?.message || err));
    } finally {
      video.currentTime = inT();
      if (!wasPaused) video.play().catch(() => {});
      btn.textContent = originalLabel;
      delete btn.dataset.busy;
    }
  });

  // T-012 핵심 플로우: 트림 구간을 GIF로 구워 이 블록의 최종 자산(정지프레임+GIF)으로 확정한다.
  // 확정 후 <video>는 사라지고 setAssetImageFromSrc의 일반 이미지/GIF 파이프라인으로 넘어간다.
  document.getElementById('vtrim-apply-gif-btn').addEventListener('click', async () => {
    const btn = document.getElementById('vtrim-apply-gif-btn');
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const originalLabel = btn.textContent;
    video.pause();
    try {
      const speed = parseFloat(ab.dataset.playbackRate) || 1;
      await seekTo(video, inT());
      const stillDataUrl = captureFrame().toDataURL('image/png');

      const { blob, plan } = await encodeTrimToGif(video, inT(), outT(), speed, text => { btn.textContent = text; });
      // ★인코딩(수 초 걸리는 await)이 도는 동안 사용자가 블록을 삭제하거나(✕)·undo 했을 수
      //   있다 — 그러면 ab는 캔버스에서 떨어진 죽은 참조라 여기서 계속 쓰면 유령 히스토리/
      //   좀비 갱신이 된다(팀리드 지적, 2026-09-15). 결과는 조용히 버린다.
      if (!ab.isConnected) return;
      if (blob.size > 20 * 1024 * 1024) {
        // 네이버 상세설명 이미지 등록 상한(20MB) — 인코더가 프레임/해상도를 이미 축소하므로
        // 실무상 거의 도달하지 않지만, 혹시 넘으면 적용을 막고 트림 구간을 줄이도록 안내한다.
        window.showToast?.(`⚠️ 인코딩된 GIF가 ${(blob.size / 1024 / 1024).toFixed(1)}MB로 20MB를 초과합니다 — 트림 구간을 줄여주세요`);
        return;
      }
      const gifDataUrl = await blobToDataURL(blob);
      if (!ab.isConnected) return;

      window.pushHistory?.('영상 → GIF 적용');
      window.setAssetImageFromSrc?.(ab, stillDataUrl, gifDataUrl);
      window.scheduleAutoSave?.();
      window.showToast?.(`GIF로 적용 완료 (${plan.frameCount}프레임 · ${(blob.size / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.error('[GIF apply]', err);
      window.showToast?.('GIF 적용 실패: ' + (err?.message || err));
    } finally {
      btn.textContent = originalLabel;
      delete btn.dataset.busy;
    }
  });
}

window.attachAssetVideoTrimLoop = attachAssetVideoTrimLoop;
