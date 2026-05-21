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

function renderChatBlock(block) {
  const messages    = JSON.parse(block.dataset.messages || '[]');
  const gap         = parseInt(block.dataset.gap)      || 8;
  const fontSize    = parseInt(block.dataset.fontSize) || 32;
  const bgLeft      = block.dataset.bgLeft   || '#e5e5ea';
  const bgRight     = block.dataset.bgRight  || '#1888fe';
  const colorLeft   = block.dataset.colorLeft  || '#111111';
  const colorRight  = block.dataset.colorRight || '#ffffff';
  const radius      = parseInt(block.dataset.radius)  || 16;
  const padding     = parseInt(block.dataset.padding) || 16;
  // 카톡식 프로필 — 토글 별도 (default off). 크기는 fontSize에 비례.
  const showProfile = block.dataset.showProfile === '1';
  const showName    = block.dataset.showName === '1';
  const profileSize    = parseInt(block.dataset.profileSize)    || Math.max(48, Math.round(fontSize * 1.6));
  const profileOffsetY = parseInt(block.dataset.profileOffsetY) || 0;
  const profileGap     = (block.dataset.profileGap != null) ? parseInt(block.dataset.profileGap) : 8;
  block.style.padding = `${padding}px`;

  block.innerHTML = messages.map((msg, idx) => {
    const isLeft = msg.align !== 'right';
    const bg     = isLeft ? bgLeft  : bgRight;
    const color  = isLeft ? colorLeft : colorRight;
    const dir    = isLeft ? 'left' : 'right';
    const tailTransform = isLeft ? 'transform="scale(-1,1) translate(-19,0)"' : '';
    const tail = `<svg class="chb-tail" viewBox="0 0 19 16" xmlns="http://www.w3.org/2000/svg" width="19" height="16" style="fill:${bg}"><path d="${CHAT_TAIL_PATH}" ${tailTransform}/></svg>`;

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

    // 좌측: profile + wrap(name+bubble+tail), 우측: wrap + profile
    const wrapHtml = `<div class="chb-wrap">${nameHtml}<div class="chb-bubble" data-msg-idx="${idx}" style="background:${bg};color:${color};font-size:${fontSize}px;border-radius:${radius}px">${msg.text}</div>${tail}</div>`;
    const inner = isLeft ? `${profileHtml}${wrapHtml}` : `${wrapHtml}${profileHtml}`;
    return `<div class="chb-msg chb-${dir}" style="margin-bottom:${gap}px;gap:${profileGap}px">${inner}</div>`;
  }).join('');

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
        const newText = bubble.innerText;  // \n 보존
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
      const bubble = e.target.closest('.chb-bubble');
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

    // blur 위임: focusout 이벤트로 bubble 단위 종료 감지
    block.addEventListener('focusout', (e) => {
      const bubble = e.target.closest?.('.chb-bubble');
      if (bubble && block.contains(bubble)) finishEdit(bubble);
    });

    block.addEventListener('keydown', (e) => {
      const bubble = e.target.closest?.('.chb-bubble');
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
  window.triggerAutoSave?.();
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeChatBlock   = makeChatBlock;
window.addChatBlock    = addChatBlock;
window.renderChatBlock = renderChatBlock;

export { makeChatBlock, addChatBlock, renderChatBlock, CHAT_DEFAULT_MESSAGES, CHAT_TAIL_PATH };
