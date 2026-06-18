// ── Chat Block ─────────────────────────────────────────────────────────────────
// 카톡식 메시지 말풍선 리스트 블록. 좌/우 정렬, 프로필 옵션 지원.
//
// 의존성:
//   - genId, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)

import { genId, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const CHAT_DEFAULT_MESSAGES = [
  { text: '안녕하세요! 반갑습니다 😊', align: 'left' },
  { text: '네, 반갑습니다~', align: 'right' },
  { text: '무엇을 도와드릴까요?', align: 'left' },
];

const CHAT_TAIL_PATH = 'M18.3597 14.7395C9.25742 16.3944 2.32729 11.6364 0 9.05055L0.258587 1.29294C2.75826 1.81011 8.17136 2.27557 9.82631 0C9.56773 9.30914 16.5496 13.9637 18.3597 14.7395Z';
// 꼬리 SVG 기본 크기(viewBox 단위와 동일). tailScale(%)로 width/height만 비례 조정 → path·좌측 translate는 viewBox 좌표라 무관.
const CHAT_TAIL_W = 19;
const CHAT_TAIL_H = 16;

// full-bleed: 블록이 속한 섹션의 effective 좌우패딩(px) 해석.
//   - closest('.section-inner')의 dataset.paddingX override가 있으면 그 값
//   - 없으면 window.state?.pageSettings?.padX (프로젝트 globals state)
//   - section-inner 없거나(프레임 free-layout 등) full-bleed 무의미하면 0
// 에셋블럭(prop-asset.js:217-221)·canvas-block(_effSectionPadX) 패턴 미러.
function _effSectionPadX(block) {
  if (block.closest?.('.frame-block[data-free-layout="true"]')) return 0;
  const inner = block.closest?.('.section-inner');
  if (!inner) return 0;
  const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
  if (hasOverride) return parseInt(inner.dataset.paddingX) || 0;
  return window.state?.pageSettings?.padX || 0;
}

function _chatToken(name, fallback) {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function renderChatBlock(block) {
  const messages    = JSON.parse(block.dataset.messages || '[]');
  const gap         = parseInt(block.dataset.gap)      || 8;
  const fontSize    = parseInt(block.dataset.fontSize) || 32;
  const bgLeft      = block.dataset.bgLeft   || _chatToken('--preset-chat-bg-left', '#e5e5ea');
  const bgRight     = block.dataset.bgRight  || _chatToken('--preset-chat-bg-right', '#1888fe');
  const colorLeft   = block.dataset.colorLeft  || _chatToken('--preset-chat-text-left', '#111111');
  const colorRight  = block.dataset.colorRight || _chatToken('--preset-chat-text-right', '#ffffff');
  const radius      = parseInt(block.dataset.radius)  || 16;
  const padding     = parseInt(block.dataset.padding) || 16;
  // 말풍선 "내부" 패딩(텍스트↔버블 경계). block.dataset.padding은 블록 "바깥" 패딩이라 별개.
  // 하위호환: 명시적으로 설정된 경우에만 인라인 주입 → 미설정 시 CSS 기본(.chb-bubble {padding:10px 14px}) 보존.
  const hasBubblePadding = block.dataset.bubblePadding != null && block.dataset.bubblePadding !== '';
  const bubblePadding    = hasBubblePadding ? parseInt(block.dataset.bubblePadding) : null;
  // 카톡식 프로필 — 토글 별도 (default off). 크기는 fontSize에 비례.
  const showProfile = block.dataset.showProfile === '1';
  const showName    = block.dataset.showName === '1';
  const profileSize    = parseInt(block.dataset.profileSize)    || Math.max(48, Math.round(fontSize * 1.6));
  const profileOffsetY = parseInt(block.dataset.profileOffsetY) || 0;
  const profileGap     = (block.dataset.profileGap != null) ? parseInt(block.dataset.profileGap) : 8;
  // 말풍선 꼬리 크기 — tailScale(%). 미설정 시 100(기본). 0이면 꼬리 숨김.
  const tailScale = (block.dataset.tailScale != null && block.dataset.tailScale !== '')
    ? parseInt(block.dataset.tailScale) : 100;
  const tailW = Math.max(0, Math.round(CHAT_TAIL_W * tailScale / 100));
  const tailH = Math.max(0, Math.round(CHAT_TAIL_H * tailScale / 100));
  block.style.padding = `${padding}px`;

  block.innerHTML = messages.map((msg, idx) => {
    const isLeft = msg.align !== 'right';
    const bg     = isLeft ? bgLeft  : bgRight;
    const color  = isLeft ? colorLeft : colorRight;
    const dir    = isLeft ? 'left' : 'right';
    const tailTransform = isLeft ? 'transform="scale(-1,1) translate(-19,0)"' : '';
    // width/height는 인라인 style로 — CSS(.chb-tail{width:19px;height:16px})가 presentation 속성을 덮으므로 style로만 적용돼야 시각 반영됨.
    const tail = `<svg class="chb-tail" viewBox="0 0 19 16" xmlns="http://www.w3.org/2000/svg" style="fill:${bg};width:${tailW}px;height:${tailH}px"><path d="${CHAT_TAIL_PATH}" ${tailTransform}/></svg>`;

    // 프로필 영역(이미지만) + 이름은 말풍선 위에 별도 위치
    let profileHtml = '';
    let nameHtml = '';
    if (showProfile) {
      const hidden = msg.hideProfile === true;
      const img    = msg.profileImg || '';
      const placeholderSvg = `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#c0c0c0"/>
        <circle cx="50" cy="40" r="15" fill="#f0f0f0"/>
        <path d="M 18 92 Q 18 62 50 62 Q 82 62 82 92 Z" fill="#f0f0f0"/>
      </svg>`;
      const imgHtml = img
        ? `<img class="chb-profile-img" src="${img}" alt="" draggable="false">`
        : `<div class="chb-profile-img chb-profile-placeholder">${placeholderSvg}</div>`;
      profileHtml = `<div class="chb-profile chb-profile-${dir}" data-msg-idx="${idx}" style="width:${profileSize}px;flex-shrink:0;margin-top:${profileOffsetY}px;${hidden ? 'visibility:hidden;' : ''}">${imgHtml}</div>`;
    }
    // 이름은 말풍선 위에 별도 (showName + name 있을 때)
    if (showName && (msg.profileName || '').trim()) {
      const hidden = msg.hideProfile === true;
      const nameColor = isLeft ? colorLeft : colorRight;
      nameHtml = `<div class="chb-profile-name" style="font-size:${Math.max(11, Math.round(fontSize * 0.55))}px;color:${nameColor};text-align:${isLeft ? 'left' : 'right'};${hidden ? 'visibility:hidden;' : ''}">${msg.profileName}</div>`;
    }

    // 별점(★) — msg.stars(0~5) 설정 시에만 말풍선 상단에 표시. 채운 별=주황, 빈 별=회색.
    // contenteditable=false로 텍스트 편집(.chb-btext)과 분리 → 인라인 편집 시 별점이 텍스트에 섞이지 않음.
    let starsHtml = '';
    if (msg.stars != null && msg.stars !== '') {
      const sc = Math.max(0, Math.min(5, parseInt(msg.stars) || 0));
      const ssz = Math.round(fontSize * 1.0);
      let st = '';
      for (let k = 0; k < 5; k++) st += `<span style="color:${k < sc ? '#ff8a00' : '#d6d6d6'}">★</span>`;
      starsHtml = `<div class="chb-stars" contenteditable="false" style="font-size:${ssz}px;line-height:1;letter-spacing:2px;margin-bottom:6px;user-select:none">${st}</div>`;
    }

    // 좌측: profile + wrap(name+bubble+tail), 우측: wrap + profile
    // bubblePadding 미설정(null) 시엔 인라인 padding 미주입 → CSS 10px 14px 기본 보존(무회귀).
    // 텍스트는 .chb-btext로 분리(편집 대상). data-msg-idx는 편집 타깃인 .chb-btext에 둔다.
    const padCss = (bubblePadding != null) ? `;padding:${bubblePadding}px` : '';
    const wrapHtml = `<div class="chb-wrap">${nameHtml}<div class="chb-bubble" style="background:${bg};color:${color};font-size:${fontSize}px;border-radius:${radius}px${padCss}">${starsHtml}<div class="chb-btext" data-msg-idx="${idx}">${msg.text}</div></div>${tail}</div>`;
    const inner = isLeft ? `${profileHtml}${wrapHtml}` : `${wrapHtml}${profileHtml}`;
    return `<div class="chb-msg chb-${dir}" style="margin-bottom:${gap}px;gap:${profileGap}px">${inner}</div>`;
  }).join('');

  // 패딩 제외(full-bleed): 섹션 좌우패딩 무시 — 음수마진 + calc 확장폭으로 섹션 가장자리까지 확장.
  // 에셋블럭 패턴 미러. 매 렌더 재적용(idempotent), off면 인라인 스타일 클리어(무회귀).
  const _fb    = block.dataset.fullBleed === 'true';
  const _secPX = _fb ? _effSectionPadX(block) : 0;
  if (_fb && _secPX > 0) {
    block.style.marginLeft  = -_secPX + 'px';
    block.style.marginRight = -_secPX + 'px';
    block.style.width       = `calc(100% + ${_secPX * 2}px)`;
  } else {
    block.style.marginLeft  = '';
    block.style.marginRight = '';
    block.style.width       = '';
  }

  // 더블클릭으로 메시지 인라인 편집 — Enter는 default(줄바꿈), ESC/blur로 종료
  // innerHTML 재생성으로 bubble 노드가 교체되므로 block에 위임(delegation)으로 1회만 바인딩
  if (!block._chatEditBound) {
    block._chatEditBound = true;

    const finishEdit = (bubble) => {
      if (bubble.getAttribute('contenteditable') !== 'true') return;
      bubble.removeAttribute('contenteditable');
      bubble.style.cursor = '';
      bubble.style.userSelect = '';
      const idx = parseInt(bubble.dataset.msgIdx);
      const msgs = JSON.parse(block.dataset.messages || '[]');
      if (msgs[idx]) {
        const newText = bubble.innerText;  // \n 보존 (.chb-btext만 편집 대상이라 별점 미포함)
        if (msgs[idx].text !== newText) {
          msgs[idx].text = newText;
          block.dataset.messages = JSON.stringify(msgs);
          window.pushHistory?.('채팅 메시지 편집');
          window.scheduleAutoSave?.();
          // 우측 prop-chat 패널이 열려있다면 textarea sync
          if (block.classList.contains('selected')) {
            window.showChatProperties?.(block);
          }
        }
      }
    };

    block.addEventListener('dblclick', (e) => {
      const bubble = e.target.closest('.chb-btext');
      if (!bubble || !block.contains(bubble)) return;
      e.stopPropagation();
      if (bubble.getAttribute('contenteditable') === 'true') return;
      // user-select:none 우회 — 편집 중에는 텍스트 선택/캐럿 허용
      bubble.setAttribute('contenteditable', 'true');
      bubble.style.cursor = 'text';
      bubble.style.userSelect = 'text';
      bubble.focus();
      // 캐럿을 끝으로 (전체 선택 후 collapseToEnd로 caret 이동)
      const sel = window.getSelection();
      try { sel.selectAllChildren(bubble); sel.collapseToEnd(); } catch(_) {}
    });

    // blur 위임: focusout 이벤트로 btext 단위 종료 감지
    block.addEventListener('focusout', (e) => {
      const bubble = e.target.closest?.('.chb-btext');
      if (bubble && block.contains(bubble)) finishEdit(bubble);
    });

    block.addEventListener('keydown', (e) => {
      const bubble = e.target.closest?.('.chb-btext');
      if (!bubble || bubble.getAttribute('contenteditable') !== 'true') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        bubble.blur();
      }
      // Enter는 default(줄바꿈) 그대로
    });
  }
}

function makeChatBlock(opts = {}) {
  const block = document.createElement('div');
  block.className    = 'chat-block';
  block.id           = genId('chb');
  block.dataset.type = 'chat';
  block.dataset.messages  = JSON.stringify(opts.messages || CHAT_DEFAULT_MESSAGES);
  block.dataset.gap        = opts.gap       || 8;
  block.dataset.fontSize   = opts.fontSize  || 32;
  block.dataset.bgLeft     = opts.bgLeft    || '#e5e5ea';
  block.dataset.bgRight    = opts.bgRight   || '#1888fe';
  block.dataset.colorLeft  = opts.colorLeft  || '#111111';
  block.dataset.colorRight = opts.colorRight || '#ffffff';
  block.dataset.radius     = opts.radius    || 16;
  block.dataset.padding    = opts.padding   || 16;
  renderChatBlock(block);

  const row = document.createElement('div');
  row.className      = 'row';
  row.id             = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addChatBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();
  const { row, block } = makeChatBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (C9)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
}

// ── 수정 ──────────────────────────────────────────────────────────────────────
// PM의 update_chat_block(MCP) → main(_invokeRendererUpdateChatBlock) → 여기.
// banner02 updateBanner02Block 패턴 미러: NOT_FOUND/INVALID/USER_BUSY 처리,
// before snapshot + pushHistory + dataset partial write + renderChatBlock 재렌더 + autoSave.
//
// 지원 필드:
//   - 메시지 배열: messages(전체 교체) / addMessage / removeMessage / editMessage
//   - 스타일: gap, fontSize, bgLeft, bgRight, colorLeft, colorRight, radius, padding, bubblePadding
//   - 프로필: showProfile, showName, profileSize, profileOffsetY, profileGap
//   - 기타: layerName
function updateChatBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('chat-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `chat-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }
  // 사용자가 인라인 편집(dblclick contenteditable) 중이면 USER_BUSY
  if (block.querySelector('.chb-btext[contenteditable="true"]')) {
    return { ok: false, code: 'USER_BUSY', message: 'user is editing a bubble — try again later', retryAfter: 2000 };
  }

  // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────
  const _colorRe = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$|^transparent$/;
  const _isImgSrcOk = (s) => {
    if (typeof s !== 'string') return false;
    if (s.length > 200000) return false;
    if (/["\r\n]/.test(s)) return false;
    return true;
  };
  const _normBool01 = (v) => {
    if (v === true || v === 1 || v === '1' || v === 'true') return '1';
    if (v === false || v === 0 || v === '0' || v === 'false') return '0';
    return null;
  };
  const _normMsg = (m, ctx) => {
    if (!m || typeof m !== 'object') throw new Error(`${ctx} must be object`);
    const o = {};
    if (m.text !== undefined && m.text !== null) {
      if (typeof m.text !== 'string') throw new Error(`${ctx}.text must be string`);
      if ([...m.text].length > 2000) throw new Error(`${ctx}.text too long (>2000)`);
      o.text = m.text;
    } else {
      o.text = '';
    }
    if (m.align !== undefined && m.align !== null) {
      if (m.align !== 'left' && m.align !== 'right') throw new Error(`${ctx}.align must be 'left'|'right'`);
      o.align = m.align;
    } else {
      o.align = 'left';
    }
    if (m.hideProfile !== undefined && m.hideProfile !== null) {
      o.hideProfile = m.hideProfile === true || m.hideProfile === 'true' || m.hideProfile === 1 || m.hideProfile === '1';
    }
    if (m.profileImg !== undefined && m.profileImg !== null) {
      if (!_isImgSrcOk(m.profileImg)) throw new Error(`${ctx}.profileImg invalid (must be string, ≤200000, no quote/newline)`);
      o.profileImg = String(m.profileImg);
    }
    if (m.profileName !== undefined && m.profileName !== null) {
      if (typeof m.profileName !== 'string') throw new Error(`${ctx}.profileName must be string`);
      if ([...m.profileName].length > 200) throw new Error(`${ctx}.profileName too long (>200)`);
      o.profileName = m.profileName;
    }
    // 별점: 0~5 정수면 표시, null/생략이면 별점 없음
    if (m.stars !== undefined && m.stars !== null && m.stars !== '') {
      const sv = parseInt(m.stars);
      if (!Number.isInteger(sv) || sv < 0 || sv > 5) throw new Error(`${ctx}.stars must be integer 0~5 or null`);
      o.stars = sv;
    }
    return o;
  };

  // ── before snapshot ────────────────────────────────────────────────────────
  const before = {
    messages: block.dataset.messages,
    gap: block.dataset.gap, fontSize: block.dataset.fontSize,
    bgLeft: block.dataset.bgLeft, bgRight: block.dataset.bgRight,
    colorLeft: block.dataset.colorLeft, colorRight: block.dataset.colorRight,
    radius: block.dataset.radius, padding: block.dataset.padding,
    bubblePadding: block.dataset.bubblePadding,
    showProfile: block.dataset.showProfile, showName: block.dataset.showName,
    profileSize: block.dataset.profileSize, profileOffsetY: block.dataset.profileOffsetY,
    profileGap: block.dataset.profileGap, layerName: block.dataset.layerName,
    tailScale: block.dataset.tailScale, fullBleed: block.dataset.fullBleed,
  };

  window.pushHistory?.('채팅 블록 수정');

  const applied = {};

  // ── 1) 메시지 배열 ─────────────────────────────────────────────────────────
  let messages;
  try {
    messages = JSON.parse(block.dataset.messages || '[]');
    if (!Array.isArray(messages)) messages = [];
  } catch (_) { messages = []; }

  if (partial.messages !== undefined) {
    if (!Array.isArray(partial.messages)) return { ok: false, code: 'INVALID', message: 'messages must be array' };
    if (partial.messages.length < 1) return { ok: false, code: 'INVALID', message: 'messages must have at least 1 item' };
    if (partial.messages.length > 100) return { ok: false, code: 'INVALID', message: 'messages too many (>100)' };
    try {
      messages = partial.messages.map((m, i) => _normMsg(m, `messages[${i}]`));
    } catch (e) { return { ok: false, code: 'INVALID', message: e.message }; }
    applied.messages = messages;
  }
  if (partial.addMessage !== undefined && partial.addMessage !== null) {
    if (typeof partial.addMessage !== 'object') return { ok: false, code: 'INVALID', message: 'addMessage must be object' };
    if (messages.length >= 100) return { ok: false, code: 'INVALID', message: 'messages limit reached (100)' };
    let newMsg;
    try { newMsg = _normMsg(partial.addMessage, 'addMessage'); }
    catch (e) { return { ok: false, code: 'INVALID', message: e.message }; }
    let at = messages.length;
    if (partial.addMessage.atIndex !== undefined && partial.addMessage.atIndex !== null) {
      if (!Number.isInteger(partial.addMessage.atIndex) || partial.addMessage.atIndex < 0) {
        return { ok: false, code: 'INVALID', message: 'addMessage.atIndex must be integer >=0' };
      }
      at = Math.min(messages.length, partial.addMessage.atIndex);
    }
    messages.splice(at, 0, newMsg);
    applied.addMessage = { ...newMsg, atIndex: at };
  }
  if (partial.removeMessage !== undefined && partial.removeMessage !== null) {
    const r = partial.removeMessage;
    let idx = -1;
    if (typeof r === 'number') idx = r;
    else if (typeof r === 'object' && Number.isInteger(r.index)) idx = r.index;
    else return { ok: false, code: 'INVALID', message: 'removeMessage must be number(index) or {index}' };
    if (!Number.isInteger(idx) || idx < 0 || idx >= messages.length) {
      return { ok: false, code: 'NOT_FOUND', message: `removeMessage target not found: ${JSON.stringify(r)}` };
    }
    const removed = messages.splice(idx, 1)[0];
    applied.removeMessage = { index: idx, removed };
  }
  if (partial.editMessage !== undefined && partial.editMessage !== null) {
    const e = partial.editMessage;
    if (typeof e !== 'object') return { ok: false, code: 'INVALID', message: 'editMessage must be object' };
    if (!Number.isInteger(e.index)) return { ok: false, code: 'INVALID', message: 'editMessage.index must be integer >=0' };
    if (e.index < 0 || e.index >= messages.length) {
      return { ok: false, code: 'NOT_FOUND', message: `editMessage.index out of range: ${e.index}` };
    }
    const cur = messages[e.index] || {};
    let merged;
    try {
      merged = _normMsg({
        text:        e.text        !== undefined ? e.text        : cur.text,
        align:       e.align       !== undefined ? e.align       : cur.align,
        hideProfile: e.hideProfile !== undefined ? e.hideProfile : cur.hideProfile,
        profileImg:  e.profileImg  !== undefined ? e.profileImg  : cur.profileImg,
        profileName: e.profileName !== undefined ? e.profileName : cur.profileName,
        stars:       e.stars       !== undefined ? e.stars       : cur.stars,
      }, 'editMessage');
    } catch (err) { return { ok: false, code: 'INVALID', message: err.message }; }
    messages[e.index] = merged;
    applied.editMessage = { index: e.index, ...merged };
  }
  // messages 변경이 있었다면 dataset에 commit
  if (partial.messages !== undefined || partial.addMessage !== undefined || partial.removeMessage !== undefined || partial.editMessage !== undefined) {
    block.dataset.messages = JSON.stringify(messages);
  }

  // ── 2) 숫자 스타일 (gap/fontSize/radius/padding) ───────────────────────────
  const _setInt = (key, datasetKey, min, max) => {
    if (partial[key] === undefined) return null;
    const v = partial[key];
    if (!Number.isFinite(+v) || !Number.isInteger(+v)) return { ok: false, code: 'INVALID', message: `${key} must be integer` };
    const n = +v;
    if (n < min || n > max) return { ok: false, code: 'INVALID', message: `${key} out of range [${min},${max}]` };
    block.dataset[datasetKey] = String(n);
    applied[key] = n;
    return null;
  };
  let err;
  err = _setInt('gap',      'gap',      0, 400); if (err) return err;
  err = _setInt('fontSize', 'fontSize', 4, 400); if (err) return err;
  err = _setInt('radius',   'radius',   0, 400); if (err) return err;
  err = _setInt('padding',  'padding',  0, 400); if (err) return err;
  err = _setInt('profileOffsetY', 'profileOffsetY', -400, 400); if (err) return err;
  err = _setInt('profileGap',     'profileGap',     0, 400);    if (err) return err;
  err = _setInt('tailScale',      'tailScale',      0, 400);    if (err) return err;

  // fullBleed(패딩 제외): boolean → dataset 'true'/'false'. (canvas-block과 동일 표기)
  if (partial.fullBleed !== undefined) {
    const fb = _normBool01(partial.fullBleed);
    if (fb === null) return { ok: false, code: 'INVALID', message: 'fullBleed must be 0/1 or boolean' };
    block.dataset.fullBleed = fb === '1' ? 'true' : 'false';
    applied.fullBleed = fb === '1';
  }

  // bubblePadding: null 명시 입력 → reset (dataset에서 제거 → CSS 기본 10px 14px 복원, 무회귀)
  if (partial.bubblePadding !== undefined) {
    if (partial.bubblePadding === null) {
      delete block.dataset.bubblePadding;
      applied.bubblePadding = null;
    } else {
      const v = partial.bubblePadding;
      if (!Number.isFinite(+v) || !Number.isInteger(+v)) return { ok: false, code: 'INVALID', message: 'bubblePadding must be integer or null' };
      const n = +v;
      if (n < 0 || n > 40) return { ok: false, code: 'INVALID', message: 'bubblePadding out of range [0,40]' };
      block.dataset.bubblePadding = String(n);
      applied.bubblePadding = n;
    }
  }

  // profileSize: null 명시 입력 → reset (dataset에서 제거)
  if (partial.profileSize !== undefined) {
    if (partial.profileSize === null) {
      delete block.dataset.profileSize;
      applied.profileSize = null;
    } else {
      const v = partial.profileSize;
      if (!Number.isFinite(+v) || !Number.isInteger(+v)) return { ok: false, code: 'INVALID', message: 'profileSize must be integer or null' };
      const n = +v;
      if (n < 24 || n > 400) return { ok: false, code: 'INVALID', message: 'profileSize out of range [24,400]' };
      block.dataset.profileSize = String(n);
      applied.profileSize = n;
    }
  }

  // ── 3) 색상 (bgLeft/bgRight/colorLeft/colorRight) ──────────────────────────
  const _setColor = (key, datasetKey) => {
    if (partial[key] === undefined) return null;
    if (partial[key] === null || partial[key] === '') {
      delete block.dataset[datasetKey];
      applied[key] = null;
      return null;
    }
    if (typeof partial[key] !== 'string') return { ok: false, code: 'INVALID', message: `${key} must be string` };
    const v = partial[key].trim();
    if (v.length === 0 || v.length > 64) return { ok: false, code: 'INVALID', message: `${key} length invalid` };
    if (!_colorRe.test(v)) return { ok: false, code: 'INVALID', message: `${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)` };
    block.dataset[datasetKey] = v;
    applied[key] = v;
    return null;
  };
  err = _setColor('bgLeft',     'bgLeft');     if (err) return err;
  err = _setColor('bgRight',    'bgRight');    if (err) return err;
  err = _setColor('colorLeft',  'colorLeft');  if (err) return err;
  err = _setColor('colorRight', 'colorRight'); if (err) return err;

  // ── 4) enum 토글 (showProfile/showName) — boolean 입력도 정규화 ────────────
  const _setEnum01 = (key, datasetKey) => {
    if (partial[key] === undefined) return null;
    const v = _normBool01(partial[key]);
    if (v === null) return { ok: false, code: 'INVALID', message: `${key} must be 0/1 or boolean` };
    block.dataset[datasetKey] = v;
    applied[key] = v;
    return null;
  };
  err = _setEnum01('showProfile', 'showProfile'); if (err) return err;
  err = _setEnum01('showName',    'showName');    if (err) return err;

  // ── 5) layerName ───────────────────────────────────────────────────────────
  if (partial.layerName !== undefined) {
    if (partial.layerName === null) {
      delete block.dataset.layerName;
      applied.layerName = null;
    } else {
      if (typeof partial.layerName !== 'string') return { ok: false, code: 'INVALID', message: 'layerName must be string' };
      if ([...partial.layerName].length > 200) return { ok: false, code: 'INVALID', message: 'layerName too long (>200)' };
      block.dataset.layerName = partial.layerName;
      applied.layerName = partial.layerName;
    }
  }

  // ── 6) 재렌더 (padding/style 동기화 포함, idempotent) ──────────────────────
  try {
    if (typeof window.renderChatBlock === 'function') {
      window.renderChatBlock(block);
    } else {
      renderChatBlock(block);
    }
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // ── 7) 우측 패널 + 레이어 패널 갱신 ────────────────────────────────────────
  if (block.classList.contains('selected')) {
    try { window.showChatProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  // ── 8) autosave ────────────────────────────────────────────────────────────
  try { window.scheduleAutoSave?.(); } catch (_) {}
  try { window.triggerAutoSave?.(); } catch (_) {}

  return { ok: true, blockId, before, applied };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeChatBlock   = makeChatBlock;
window.addChatBlock    = addChatBlock;
window.renderChatBlock = renderChatBlock;
window.updateChatBlock = updateChatBlock;

export { makeChatBlock, addChatBlock, updateChatBlock, renderChatBlock, CHAT_DEFAULT_MESSAGES, CHAT_TAIL_PATH };
