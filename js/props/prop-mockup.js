// prop-mockup.js — 디바이스 목업 블록 프로퍼티 패널

import { propPanel } from '../globals.js';
import { neutralizeRedactForH2C, neutralizeTextGradForH2C, neutralizeObjectFitForH2C } from '../io/capture-safety.js';

export function showMockupProperties(block) {
  const deviceKey = block.dataset.device || 'iphone';
  const shadow    = block.dataset.shadow || 'none';
  const imgSrc    = block.dataset.imgSrc || '';
  const sourceSec = block.dataset.sourceSec || '';

  const devices = window.MOCKUP_DEVICES || {};
  const deviceLabel = devices[deviceKey]?.label || deviceKey;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <rect x="8" y="6" width="8" height="10" rx="0.5" fill="#888" stroke="none"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Mockup'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <!-- 디바이스 선택 -->
    <div class="prop-section">
      <div class="prop-section-title">Device</div>
      <div class="prop-row" style="gap:4px;">
        <span class="prop-label" style="flex:1;font-size:10px;color:#888;">${deviceLabel}</span>
        <button class="prop-btn" id="mkp-change-device-btn"
          style="width:auto;height:auto;padding:3px 8px;font-size:10px;">변경</button>
      </div>
    </div>

    <!-- 너비 -->
    <div class="prop-section">
      <div class="prop-section-title">Width</div>
      <div class="prop-row">
        <span class="prop-label">Width</span>
        <input type="range"  class="prop-slider" id="mkp-width-slider" min="100" max="860" step="10"
          value="${parseInt(block.style.width) || parseInt(block.dataset.width) || 360}">
        <input type="number" class="prop-number" id="mkp-width-number" min="100" max="860"
          value="${parseInt(block.style.width) || parseInt(block.dataset.width) || 360}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="mkp-rot-slider" min="-180" max="180" step="1" value="${parseInt(block.dataset.rotation || '0')}">
        <input type="number" class="prop-number" id="mkp-rot-number" min="-180" max="180" value="${parseInt(block.dataset.rotation || '0')}">
      </div>
    </div>

    <!-- 화면 이미지 -->
    <div class="prop-section">
      <div class="prop-section-title">Screen Image</div>
      <div class="prop-row" style="flex-direction:column;gap:4px;">
        <!-- 섹션 ID로 캡처 -->
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="text" id="mkp-sec-id-input" placeholder="섹션 ID 입력 (sec_xxx)"
            value="${sourceSec}"
            style="flex:1;background:#111;border:1px solid #333;border-radius:4px;color:#ddd;font-size:10px;padding:4px 7px;font-family:Pretendard,-apple-system,sans-serif;min-width:0;">
          <button class="prop-btn" id="mkp-capture-btn"
            style="width:auto;height:auto;padding:3px 8px;font-size:10px;white-space:nowrap;">가져오기</button>
        </div>
        ${sourceSec ? `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#888;flex:1;">연결된 섹션</span>
            <button class="prop-btn" id="mkp-toggle-sec-btn"
              style="width:auto;height:auto;padding:3px 8px;font-size:10px;">
              ${_isSecHidden(sourceSec) ? '섹션 보이기' : '섹션 숨기기'}
            </button>
          </div>
        ` : ''}
        <!-- 직접 이미지 업로드 -->
        <button class="prop-btn-full" id="mkp-upload-btn">이미지 파일 업로드</button>
        ${imgSrc ? `<div style="font-size:10px;color:#888;text-align:center;">이미지 등록됨 ✓</div>` : ''}
      </div>
    </div>

    <!-- 그림자 -->
    <div class="prop-section">
      <div class="prop-section-title">Shadow</div>
      <div class="prop-align-group" id="mkp-shadow-group">
        <button class="prop-align-btn${shadow === 'none'  ? ' active' : ''}" data-val="none">없음</button>
        <button class="prop-align-btn${shadow === 'soft'  ? ' active' : ''}" data-val="soft">부드럽게</button>
        <button class="prop-align-btn${shadow === 'strong'? ' active' : ''}" data-val="strong">강하게</button>
      </div>
    </div>
  `;

  // 디바이스 변경
  propPanel.querySelector('#mkp-change-device-btn').addEventListener('click', () => {
    window.openMockupModal?.();
  });

  // 너비
  const wSlider = propPanel.querySelector('#mkp-width-slider');
  const wNumber = propPanel.querySelector('#mkp-width-number');
  const applyWidth = v => {
    v = Math.min(860, Math.max(100, v));
    block.dataset.width = v;
    block.style.width   = v + 'px';
    window.renderMockupBlock?.(block);
    wSlider.value = v;
    wNumber.value = v;
  };
  wSlider.addEventListener('mousedown', () => window.pushHistory?.());
  wSlider.addEventListener('input',  () => applyWidth(parseInt(wSlider.value)));
  wSlider.addEventListener('change', () => window.pushHistory?.());
  /* ★[2026-09-21] 순서를 뒤집었다 — 전엔 «찍고 나서» 바꿨다(push-before).
     그러면 앞 편집이 push-after 였을 때 이 pushHistory 가 꼭대기와 같은 상태를 찍어 «버려지고»,
     폭 변경이 자기 칸을 못 가져 ⌘Z 한 번에 «앞 편집과 같이» 사라졌다(실측 A).
     ⛔이웃들은 원래 맞았다 — 슬라이더(:117~:119)는 양쪽 끝, 회전(:130~:133)은 push-after.
        숫자칸 «하나»만 뒤집혀 있었다. */
  wNumber.addEventListener('change', () => { applyWidth(parseInt(wNumber.value)); window.pushHistory?.(); });

  // 회전 — 공유 헬퍼(applyRotationDeg, dataset.rotation)로 핫존(asset-rotate.js)과 동기
  const mRotS = propPanel.querySelector('#mkp-rot-slider');
  const mRotN = propPanel.querySelector('#mkp-rot-number');
  const _mkpRot = v => {
    v = Math.min(180, Math.max(-180, parseInt(v) || 0));
    window.applyRotationDeg?.(block, v);
    mRotS.value = v; mRotN.value = v;
  };
  mRotS.addEventListener('input',  () => _mkpRot(mRotS.value));
  mRotN.addEventListener('input',  () => _mkpRot(mRotN.value));
  mRotS.addEventListener('change', () => window.pushHistory?.());
  mRotN.addEventListener('change', () => window.pushHistory?.());

  // 캡처 버튼
  const secIdInput = propPanel.querySelector('#mkp-sec-id-input');
  propPanel.querySelector('#mkp-capture-btn').addEventListener('click', async () => {
    const secId = secIdInput.value.trim();
    if (!secId) { window.showToast?.('섹션 ID를 입력하세요.'); return; }
    const sec = document.getElementById(secId);
    if (!sec || !sec.classList.contains('section-block')) { window.showToast?.('해당 ID의 섹션을 찾을 수 없습니다.'); return; }
    await _captureAndApply(block, sec);
  });

  // 섹션 토글
  const toggleBtn = propPanel.querySelector('#mkp-toggle-sec-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const secId = block.dataset.sourceSec;
      if (!secId) return;
      const sec = document.getElementById(secId);
      if (!sec) return;
      const hidden = sec.style.display === 'none';
      sec.style.display = hidden ? '' : 'none';
      sec.dataset.mockupHidden = hidden ? '' : 'true';
      toggleBtn.textContent = hidden ? '섹션 숨기기' : '섹션 보이기';
      window.pushHistory?.();
    });
  }

  // 이미지 업로드
  propPanel.querySelector('#mkp-upload-btn').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        window.pushHistory?.();
        _applyScreenImage(block, e.target.result);
        block.dataset.imgSrc = e.target.result;
        block.dataset.sourceSec = '';
        /* ★[R1-업로드 · 2026-09-22] «끝 표본» — 바로 위 pushHistory 는 push-before 다(찍고 «나서» 바꾼다).
           ⚠️정정(2026-09-22): 이 자리를 한때 「찍고 → 비동기로 반영」(js/image-handling.js 꼴)으로
             분류했는데 «틀렸다» — 그 pushHistory 는 FileReader.onload «안»에 있어서 적용과 같은
             동기 구간이다. 곧 평범한 push-before 고, 고쳐야 하는 까닭도 평범한 그것이다:
           앞 동작이 push-after 였으면 이 push-before 가 꼭대기와 «같은 상태»를 찍어
           js/history.js 의 무변화 차단에 먹힌다 ⇒ 「업로드의 결과」가 스택에 한 번도 안 남는다.
           그러면 업로드 뒤에 편집이 하나만 더 와도 ⌘Z 한 번이 둘을 같이 먹는다.
           ⇒ 반영이 «끝난» 여기서 한 번 더 찍는다. ⛔옮기기가 아니라 더하기다.
           ★같은 «규칙»의 선례: js/image-handling.js · js/props/asset-video-trim.js (③).
             (규칙은 같다 — 「모든 동작이 끝 표본을 남긴다」. 기전이 같다는 뜻은 아니다.) */
        window.pushHistory?.('목업 화면 이미지');
        window.showMockupProperties?.(block);
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  });

  // 그림자
  propPanel.querySelectorAll('#mkp-shadow-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.pushHistory?.();
      const val = btn.dataset.val;
      block.dataset.shadow = val;
      _applyShadow(block, val);
      propPanel.querySelectorAll('#mkp-shadow-group .prop-align-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === val);
      });
    });
  });
}

function _isSecHidden(secId) {
  const sec = document.getElementById(secId);
  return sec && sec.style.display === 'none';
}

async function _captureAndApply(block, sec) {
  if (typeof html2canvas === 'undefined') { window.showToast?.('html2canvas 없음'); return; }
  let clone = null;
  try {
    window.showToast?.('캡처 중...');

    // 클론 후 오프스크린에 배치 (ignoreElements 없이 깔끔하게 찍기)
    clone = sec.cloneNode(true);
    clone.querySelector?.('.section-hitzone')?.remove();
    clone.querySelector?.('.section-toolbar')?.remove();
    clone.classList.remove('selected');
    // 선택 아웃라인 제거
    clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    /* ★display:block 을 «같이» 건다 — 이 줄이 이 고침의 절반이다(2026-09-22).
       한 번 캡처한 섹션은 아래에서 sec.style.display='none' 으로 숨는다. 그 섹션을 «다시»
       캡처하면 cloneNode 가 그 display:none 까지 베껴 와, html2canvas 가 크기 0 짜리를 그리고
       canvas 가 0×0 이 된다. ⛔그때 toDataURL 은 «던지지 않고» 문자열 "data:," 를 «돌려준다»
       — 아래 try/catch 는 예외만 보므로 그대로 통과해 멀쩡한 PNG 를 6자로 덮고
       「캡처 완료!」라고 말했다(2026-09-21 실측: 928,378자 → 6자).
       ⛔원본 sec 의 display 를 건드리지 않는다 — 클론만 편다. 원본을 폈다 접으면 화면이
         깜빡이고, 도중에 실패하면 숨김 상태가 어긋난 채 남는다.
       ★cssText 뒤에 붙이므로 앞서 베껴 온 display:none 을 이긴다(뒤가 이긴다). */
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;box-shadow:none;display:block;';
    document.body.appendChild(clone);
    neutralizeRedactForH2C(clone); // html2canvas는 backdrop-filter 미지원 → 가림막 원본노출 방지(안전실패)
    neutralizeTextGradForH2C(clone); // html2canvas는 background-clip:text 미지원 → 글자 그라데이션은 첫 스탑 단색으로(0918r2 textgrad)
    await neutralizeObjectFitForH2C(clone); // html2canvas는 object-fit 미지원 → 상자에 «늘려» 그린다. 상자 크기대로 미리 잘라 끼운다(썸네일이 화면과 다른 그림이 되던 자리)
    if (window.finalizeMosaicForClone) { try { await window.finalizeMosaicForClone(sec, clone); } catch (_) {} }

    const bgColor = sec.style.backgroundColor || sec.style.background || '#ffffff';
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: bgColor || '#ffffff',
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/png');

    /* ★짝 검사 — «입구»만 막지 말고 «결과»를 재라(2026-09-22).
       위 display:block 은 «지금 아는 한 가지 원인»만 덮는다. 캔버스가 0 이 되는 길은 그것
       하나라는 보장이 없다(섹션이 0 높이·부모가 접힘·html2canvas 자체 실패 등).
       ⛔그리고 이 자리의 병은 «캔버스가 0 이 되는 것»이 아니라 «0 인 줄 모르고 덮는 것»이다.
       toDataURL 은 0×0 에서 예외를 «안» 던지고 "data:," 를 돌려주므로 try/catch 로는 못 잡는다.
       ⇒ 덮기 «전»에 결과를 재고, 빈 그림이면 가진 것을 지키고 «사실대로» 말한다. */
    /* ★판정은 js/io/image-data-url.js «한 곳»에서 한다 (T-148).
       여기 128 을 다시 적지 마라 — 2026-09-22 에 이 사본과 썸네일 사본이 «둘»로 갈렸고,
       그날 안에 모았다. tests/unit/one-empty-image-judge.test.mjs 가 셋째를 막는다.
       ⛔판정기가 없으면 «빈 그림으로 친다» — 배선이 깨졌을 때 «가진 그림을 지키는» 쪽이 안전하다.
         (조용히 덮는 것보다 「캡처 실패」라고 말하고 멈추는 것이 낫다.) */
    const _judge = window.isUsableImageDataUrl;
    const _degenerate = !canvas.width || !canvas.height || typeof _judge !== 'function' || !_judge(dataUrl);
    if (_degenerate) {
      window.showToast?.('캡처 실패: 섹션이 화면에 그려지지 않았습니다 — 이전 이미지를 그대로 둡니다.');
      return;   // ⛔dataset.imgSrc 를 «건드리지 않는다» — 가진 그림이 이긴다
    }

    window.pushHistory?.();
    block.dataset.imgSrc = dataUrl;
    block.dataset.sourceSec = sec.id;
    _applyScreenImage(block, dataUrl);
    // 섹션 숨기기
    sec.style.display = 'none';
    sec.dataset.mockupHidden = 'true';
    window.showToast?.('캡처 완료! 섹션이 숨겨졌습니다.');
    window.showMockupProperties?.(block);
  } catch(err) {
    window.showToast?.('캡처 실패: ' + err.message);
  } finally {
    clone?.remove();
  }
}

// asset-block과 동일한 체커보드 패턴
const _CHECKER_BG = 'repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px';

// backgroundSize 'cover'(디자인 규약 — asset/section/banner 등 전 블록 공용 기본값)로 화면을 꽉 채운다.
// 예전 '100% auto'는 원본 섹션이 폰 화면(세로로 긴 화면)보다 넓고 낮은 게 보통이라
// 상단 슬라이스만 채워지고 나머지가 체커보드로 비어 보이는 문제(2026-09-15 현빈 신고: "섹션 비율이 짜부라진다")가 있었다.
function _applyScreenImage(block, src) {
  const screen = block.querySelector('.mkp-screen');
  if (!screen) return;
  screen.style.backgroundImage    = `url('${src}')`;
  screen.style.backgroundSize     = 'cover';
  screen.style.backgroundPosition = 'top center';
  screen.style.backgroundRepeat   = 'no-repeat';
  screen.style.background         = `url('${src}') top center / cover no-repeat, ${_CHECKER_BG}`;
  screen.innerHTML = '';
}

function _applyShadow(block, val) {
  const shadows = {
    none:   'none',
    soft:   '0 20px 60px rgba(0,0,0,0.25)',
    strong: '0 30px 80px rgba(0,0,0,0.55)',
  };
  block.style.filter = val === 'none' ? '' : `drop-shadow(${shadows[val]})`;
  block.dataset.shadow = val;
}

// 외부에서 캡처 호출 가능하도록 노출
window._applyMockupScreenImage = _applyScreenImage;
window._applyMockupShadow = _applyShadow;
window.showMockupProperties = showMockupProperties;
