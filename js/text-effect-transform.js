// text-effect-transform.js — 텍스트 블록에 영화 포스터 효과를 입히는 이스터에그
// 트리거: 텍스트 블록의 layer label이 '**text_' prefix로 시작하면 적용 (badge 패턴 동일)
// prefix는 트리거 전용 — 텍스트 콘텐츠는 사용자 입력 그대로 유지
// 효과는 dataset.textEffect에 영구 저장 → prefix 제거해도 유지

const TEXT_EFFECT_PRESETS = [
  { value: 'neon',      label: 'Neon Glow (네온)' },
  { value: 'metallic',  label: 'Metallic (메탈릭)' },
  { value: 'grunge',    label: 'Grunge Ink (그런지)' },
  { value: 'vintage',   label: 'Vintage (빈티지)' },
  { value: 'cinematic', label: 'Cinematic (시네마틱)' }
];

const TEXT_EFFECT_DEFAULTS = {
  preset:    'grunge',     // 영화 포스터 distress 컨셉 — Grunge가 hero
  color:     '#ffffff',    // 단색 (영화 포스터 NEW WORLD/탈출 처럼 흰색)
  intensity: 70,
  grain:     60,           // grunge default: 표면 거칠기 강하게
  texture:   'dots'        // grunge 텍스처 — dots/scratches/paint
};

const GRUNGE_TEXTURES = [
  { value: 'dots',      label: 'Halftone Dots (점 패턴)' },
  { value: 'scratches', label: 'Scratched Metal (메탈 스크래치)' },
  { value: 'paint',     label: 'Aged Paint (갈라진 페인트)' },
  { value: '001',       label: 'Texture 001' },
  { value: '001-expand',label: 'Texture 001 (Expanded)' },
  { value: '002',       label: 'Texture 002' },
  { value: 'pamyo',     label: 'Texture 003 (파묘)' },
  { value: '004',       label: 'Texture 004' },
  { value: '005',       label: 'Texture 005' },
  { value: 'black-inv', label: 'Black Scratch (반전)' }
];

// SVG <defs>를 body에 1회만 inject (grunge용 turbulence + displacement)
function ensureTextEffectSvgDefs() {
  if (document.getElementById('text-effect-svg-defs')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'text-effect-svg-defs';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
  svg.innerHTML = `
    <defs>
      <!-- Grunge: 영화 포스터 distress — 거친 윤곽 + 글자 표면 균열 -->
      <filter id="text-effect-grunge" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" result="distorted"/>
        <!-- 글자 안 구멍/균열 패턴 (composite로 빼냄) -->
        <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="3" result="crackle"/>
        <feColorMatrix in="crackle" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -7 4" result="crackleMask"/>
        <feComposite in="distorted" in2="crackleMask" operator="out"/>
      </filter>
      <!-- Grunge 강도 약 (intensity slider가 0~50%일 때 사용) -->
      <filter id="text-effect-grunge-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>`;
  document.body.appendChild(svg);
}

// 텍스트 블록 내부의 텍스트 element 찾기 (.tb-h1/h2/h3/body/caption/label/bullet)
function findTextEl(tb) {
  return tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet') || tb.querySelector('[contenteditable]');
}

// 모든 효과 클래스/스타일 제거
function clearTextEffect(textEl) {
  if (!textEl) return;
  textEl.classList.remove('text-effect', 'tfx-neon', 'tfx-metallic', 'tfx-grunge', 'tfx-vintage', 'tfx-cinematic',
    'tfx-tex-dots', 'tfx-tex-scratches', 'tfx-tex-paint',
    'tfx-tex-001', 'tfx-tex-001-expand', 'tfx-tex-002', 'tfx-tex-pamyo',
    'tfx-tex-004', 'tfx-tex-005', 'tfx-tex-black-inv');
  textEl.style.removeProperty('--tfx-color');
  textEl.style.removeProperty('--tfx-intensity');
  textEl.style.removeProperty('--tfx-grain');
  textEl.style.removeProperty('filter');
}

function applyTextEffect(tb, opts) {
  if (!tb) return;
  const textEl = findTextEl(tb);
  if (!textEl) return;
  ensureTextEffectSvgDefs();

  const cfg = { ...TEXT_EFFECT_DEFAULTS, ...(opts || {}) };
  clearTextEffect(textEl);
  textEl.classList.add('text-effect', 'tfx-' + cfg.preset);
  textEl.style.setProperty('--tfx-color', cfg.color);
  textEl.style.setProperty('--tfx-intensity', String(cfg.intensity / 100));
  textEl.style.setProperty('--tfx-grain', String(cfg.grain / 100));
  // grunge에서만 texture 변형 클래스 적용
  if (cfg.preset === 'grunge' && cfg.texture) {
    textEl.classList.add('tfx-tex-' + cfg.texture);
  }

  // Grunge: SVG filter의 turbulence/displacement를 슬라이더 값으로 동적 갱신
  // (CSS variable은 SVG attribute에 못 들어가므로 JS로 직접 setAttribute)
  if (cfg.preset === 'grunge') {
    const filt = document.getElementById('text-effect-grunge');
    if (filt) {
      const turb = filt.querySelector('feTurbulence');
      const disp = filt.querySelector('feDisplacementMap');
      const crackle = filt.querySelectorAll('feTurbulence')[1];
      // grain 0~100 → baseFrequency 0.4~1.6 (높을수록 거친 노이즈)
      if (turb) turb.setAttribute('baseFrequency', String((0.4 + 1.2 * cfg.grain / 100).toFixed(3)));
      // intensity 0~100 → displacement scale 1~10 (강할수록 윤곽 distortion)
      if (disp) disp.setAttribute('scale', String((1 + 9 * cfg.intensity / 100).toFixed(2)));
      // crackle은 grain 따라
      if (crackle) crackle.setAttribute('baseFrequency', String((1.0 + 2.0 * cfg.grain / 100).toFixed(3)));
    }
  }

  // dataset에 영구 저장 (autoSave가 outerHTML 직렬화하므로 data-* 보존)
  tb.dataset.textEffect = JSON.stringify(cfg);
}

// 저장/로드 사이클에서 dataset.textEffect 만 남고 클래스가 빠진 경우 복구
function ensureTextEffect(tb) {
  if (!tb || !tb.dataset.textEffect) return;
  try {
    const cfg = JSON.parse(tb.dataset.textEffect);
    applyTextEffect(tb, cfg);
  } catch (e) { /* malformed dataset → ignore */ }
}

// ── prop-panel 증강 ──
function enhanceTextEffectPropPanel(tb) {
  if (!tb || !tb.dataset.textEffect) return;
  let cfg;
  try { cfg = JSON.parse(tb.dataset.textEffect); }
  catch (e) { cfg = { ...TEXT_EFFECT_DEFAULTS }; }
  cfg = { ...TEXT_EFFECT_DEFAULTS, ...cfg };

  const propPanel = document.querySelector('#panel-right .panel-body')
                 || document.querySelector('.panel-body');
  if (!propPanel) return;

  const presetOpts = TEXT_EFFECT_PRESETS
    .map(p => `<option value="${p.value}" ${p.value === cfg.preset ? 'selected' : ''}>${p.label}</option>`)
    .join('');

  // grunge는 슬라이더/컬러 전부 숨기고 텍스처 select만 노출
  const isGrunge = cfg.preset === 'grunge';
  const showGrain = !isGrunge && ['vintage', 'cinematic'].includes(cfg.preset);
  const showColor = !isGrunge;
  const showIntensity = !isGrunge;
  const showTexture = isGrunge;
  const textureOpts = GRUNGE_TEXTURES
    .map(t => `<option value="${t.value}" ${t.value === cfg.texture ? 'selected' : ''}>${t.label}</option>`)
    .join('');

  const html = `
    <div class="prop-section" id="text-effect-controls-section">
      <div class="prop-section-title">텍스트 효과 ✨</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">프리셋</span>
        <select id="tfx-preset" style="flex:2;padding:5px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
          ${presetOpts}
        </select>
      </div>
      <div id="tfx-texture-row" style="display:${showTexture ? 'flex' : 'none'};align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">텍스처</span>
        <select id="tfx-texture" style="flex:2;padding:5px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
          ${textureOpts}
        </select>
      </div>
      <div id="tfx-color-row" style="display:${showColor ? 'flex' : 'none'};align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">메인 컬러</span>
        <input type="color" id="tfx-color" value="${cfg.color}"
               style="width:32px;height:24px;border:none;padding:0;cursor:pointer;background:transparent;">
        <input type="text" id="tfx-color-hex" value="${cfg.color}" maxlength="7"
               style="flex:1;padding:3px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
      </div>
      <div id="tfx-intensity-row" style="display:${showIntensity ? 'flex' : 'none'};align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">강도</span>
        <input type="range" id="tfx-intensity" min="0" max="100" value="${cfg.intensity}" style="flex:2;">
        <span id="tfx-intensity-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.intensity}%</span>
      </div>
      <div id="tfx-grain-row" style="display:${showGrain ? 'flex' : 'none'};align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">그레인 강도</span>
        <input type="range" id="tfx-grain" min="0" max="100" value="${cfg.grain}" style="flex:2;">
        <span id="tfx-grain-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.grain}%</span>
      </div>
      <button id="tfx-remove" style="margin-top:10px;width:100%;padding:6px;font-size:11px;background:#2a1a1a;color:#c66;border:1px solid #553;border-radius:4px;cursor:pointer;">효과 제거</button>
    </div>
  `;

  const existing = propPanel.querySelector('#text-effect-controls-section');
  if (existing) existing.outerHTML = html;
  else propPanel.insertAdjacentHTML('beforeend', html);

  const read = () => {
    const next = {
      preset:    propPanel.querySelector('#tfx-preset').value,
      color:     propPanel.querySelector('#tfx-color').value,
      intensity: parseInt(propPanel.querySelector('#tfx-intensity').value),
      grain:     parseInt(propPanel.querySelector('#tfx-grain').value),
      texture:   propPanel.querySelector('#tfx-texture')?.value || 'dots'
    };
    applyTextEffect(tb, next);
    // 가시성 토글 — grunge는 텍스처 select만, 나머지는 컬러/강도/그레인
    const isG = next.preset === 'grunge';
    const colorRow = propPanel.querySelector('#tfx-color-row');
    const intensityRow = propPanel.querySelector('#tfx-intensity-row');
    const grainRow = propPanel.querySelector('#tfx-grain-row');
    const textureRow = propPanel.querySelector('#tfx-texture-row');
    if (colorRow) colorRow.style.display = isG ? 'none' : 'flex';
    if (intensityRow) intensityRow.style.display = isG ? 'none' : 'flex';
    if (grainRow) grainRow.style.display = (!isG && ['vintage','cinematic'].includes(next.preset)) ? 'flex' : 'none';
    if (textureRow) textureRow.style.display = isG ? 'flex' : 'none';
    return next;
  };

  propPanel.querySelector('#tfx-preset')?.addEventListener('change', () => { read(); window.pushHistory?.('텍스트 효과 프리셋'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#tfx-texture')?.addEventListener('change', () => { read(); window.pushHistory?.('텍스트 효과 텍스처'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#tfx-color')?.addEventListener('input', e => {
    propPanel.querySelector('#tfx-color-hex').value = e.target.value;
    read();
  });
  propPanel.querySelector('#tfx-color')?.addEventListener('change', () => { window.pushHistory?.('텍스트 효과 컬러'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#tfx-color-hex')?.addEventListener('change', e => {
    const v = (e.target.value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      propPanel.querySelector('#tfx-color').value = v;
      read();
      window.pushHistory?.('텍스트 효과 컬러'); window.scheduleAutoSave?.();
    }
  });
  propPanel.querySelector('#tfx-intensity')?.addEventListener('input', e => {
    propPanel.querySelector('#tfx-intensity-val').textContent = e.target.value + '%';
    read();
  });
  propPanel.querySelector('#tfx-intensity')?.addEventListener('change', () => { window.pushHistory?.('텍스트 효과 강도'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#tfx-grain')?.addEventListener('input', e => {
    propPanel.querySelector('#tfx-grain-val').textContent = e.target.value + '%';
    read();
  });
  propPanel.querySelector('#tfx-grain')?.addEventListener('change', () => { window.pushHistory?.('텍스트 효과 그레인'); window.scheduleAutoSave?.(); });
  propPanel.querySelector('#tfx-remove')?.addEventListener('click', () => {
    delete tb.dataset.textEffect;
    const textEl = findTextEl(tb); clearTextEffect(textEl);
    propPanel.querySelector('#text-effect-controls-section')?.remove();
    window.pushHistory?.('텍스트 효과 제거'); window.scheduleAutoSave?.();
  });
}

// ── 로드 시 모든 text-block 효과 복구 ──
function initTextEffectsInDom() {
  ensureTextEffectSvgDefs();
  document.querySelectorAll('.text-block[data-text-effect]').forEach(ensureTextEffect);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTextEffectsInDom);
} else {
  initTextEffectsInDom();
}

// 프로젝트 전환 / 새 블록 추가 시 자동 보장
new MutationObserver(muts => {
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.classList?.contains('text-block') && node.dataset.textEffect) ensureTextEffect(node);
      node.querySelectorAll?.('.text-block[data-text-effect]').forEach(ensureTextEffect);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

window.applyTextEffect              = applyTextEffect;
window.ensureTextEffect             = ensureTextEffect;
window.enhanceTextEffectPropPanel   = enhanceTextEffectPropPanel;
window.TEXT_EFFECT_DEFAULTS         = TEXT_EFFECT_DEFAULTS;
