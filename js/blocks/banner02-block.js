// banner02-block.js
// 1급 독립 배너 블록 (canvas-block 패턴 미러링). 기존 banner-presets 디자인을 자체 데이터모델로 포팅.
//   - dataset 기반 모델, renderBanner02(block)가 dataset에서 DOM 재구성 (scale-to-fit)
//   - makeBanner02Block / addBanner02Block — canvas-block과 동일 구조
import { genId, showNoSelectionHint, insertAfterSelected, selectAllEditableContents } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

// 기존 BANNER_PRESETS 디자인을 variant로 포팅 (런타임 의존 없이 값 복사 — 두 시스템 분리)
const BANNER02_VARIANTS = {
  frame_8: {
    label: '가로 배너',
    width: 780, height: 260, radius: 20, bg: '#f3f4f6',
    textX: 36, textY: 35, textW: 358,
    labelSize: 24, titleSize: 42, subSize: 16, gap1: 5, gap2: 10,
    imgX: 494, imgY: 5, imgW: 250, imgH: 250,
  },
  wide_4x1: {
    label: '와이드 4:1',
    width: 800, height: 200, radius: 16, bg: '#f3f4f6',
    textX: 28, textY: 28, textW: 380,
    labelSize: 20, titleSize: 32, subSize: 14, gap1: 4, gap2: 6,
    imgX: 610, imgY: 10, imgW: 180, imgH: 180,
  },
};

function _variant(key) { return BANNER02_VARIANTS[key] || BANNER02_VARIANTS.frame_8; }

// ── 가변 텍스트 lines 모델 ──────────────────────────────────────────────────
// dataset.lines = JSON.stringify([{kind, text, size, color, gapTop}, ...])
// kind: 'label' | 'title' | 'sub' (자유 문자열도 허용 — 클래스명 bn2-{kind}로 매핑)
// 기존 d.label/title/sub + d.labelSize/titleSize/subSize + d.labelColor/titleColor/subColor + d.gap1/gap2는
// 1) 첫 render 시 lines 배열로 자동 migrate
// 2) lines 배열의 첫 매칭 kind 항목에 동기화되어 유지 (이전 API/저장 포맷 호환)
/* ★2026-09-21 사용자관점훑기 T-09x(exportvisual) — 기본 문구는 «안내문구»다, 본문이 아니다.
 *   고치기 «전»: 이 세 줄은 진짜 텍스트값으로만 들어가고 아무 표시가 없었다. 그래서
 *   js/io/capture-safety.js stripEditorOnlyForCapture 가 보는 `[data-is-placeholder="true"]`
 *   그물에 «배너만» 안 걸려, 모달 안내문구는 빠지는데 배너 안내문구는 내보낸 PNG 에 박혔다
 *   (실측 2026-09-21: 860×1399 export PNG 배너 글자영역 320×120 에 검정 2,203px).
 *   ⇒ 값이 아니라 «표시»를 붙인다 — export 쪽 코드는 한 줄도 안 건드려도 같이 걷힌다.
 *   ★규약은 block-factory.js / modal-block.js 와 «같은» data-is-placeholder + data-placeholder 다. */
function _defaultLines(v) {
  return [
    { kind: 'label', text: '라벨입니다.',         size: v.labelSize, color: '#000000', gapTop: 0,      fontFamily: '', fontWeight: 400, letterSpacing: 0, placeholder: true },
    { kind: 'title', text: '제목을 입력합니다.',    size: v.titleSize, color: '#000000', gapTop: v.gap1, fontFamily: '', fontWeight: 400, letterSpacing: 0, placeholder: true },
    { kind: 'sub',   text: '캡션이 입력됩니다.',    size: v.subSize,   color: '#000000', gapTop: v.gap2, fontFamily: '', fontWeight: 400, letterSpacing: 0, placeholder: true },
  ];
}
// ★「+ 텍스트 줄 추가」로 «새로 만드는» 줄의 기본문구 — 정본은 여기 한 곳.
//   prop-banner02.js 의 추가 버튼이 window._bn2Lines.newLineText 로 «읽어» 쓴다.
//   ⚠️초판에선 이 리터럴이 prop-banner02.js 안에 «따로» 박혀 있었다. 그래서 아래 판정이 그 줄을
//     못 알아봤고, 사용자가 추가한 줄만 「강아지 간식새 줄」로 이어붙었다(같은 뿌리의 «빠진 자리»).
//     「정본이 한 곳」이라는 말이 실제로 참이 되도록 리터럴을 이쪽으로 옮겼다.
const BANNER02_NEW_LINE_TEXT = '새 줄';

// ── 안내문구(기본문구) 식별 ────────────────────────────────────────────────
// 배너 텍스트는 dataset.lines(JSON) 모델에 들어있어 text-block 처럼 DOM 에 data-is-placeholder 를
// 못 단다 — comparison-block.js 가 «같은 처지»에서 이미 쓰는 「기본문구와 값이 같은가」 방식을 그대로 쓴다
// (간단·저위험, 이 repo 실전 검증). 새 방식 발명 아님.
// ⚠️알려진 한계(모달·비교 블럭도 이미 수용 중인 트레이드오프): 사용자가 안내문구와 «글자 그대로 같은 말»을
//   진짜 본문으로 입력하면 다음 편집진입 때도 전체선택된다. 새 위험이 아니라 기존 패턴과 동일하다.
// ⚠️기본문구는 variant 와 무관하게 같은 문자열이다(_defaultLines 의 text 는 v 를 안 쓴다) →
//   리터럴을 여기 다시 베끼지 않고 _defaultLines 를 그대로 참조한다.
// ⚠️kind 는 조건에 «안» 넣는다 — 선례(comparison-block.js isCmpPlaceholderText)도 값만 본다.
//   네 문구가 서로 달라 kind 를 봐도 걸러지는 게 없고, 줄의 kind 가 바뀌면 오히려 판정만 새기 때문이다.
function _banner02PlaceholderTexts() {
  return _defaultLines(_variant()).map(l => String(l.text).trim()).concat([BANNER02_NEW_LINE_TEXT]);
}
function _isBanner02PlaceholderText(text) {
  const s = (text == null ? '' : String(text)).trim();
  if (s === '') return false;                 // 빈 줄은 전체선택할 내용이 없다 — 캐럿만(기존 동작)
  return _banner02PlaceholderTexts().includes(s);
}
function _readLines(block) {
  const d = block.dataset;
  if (d.lines) {
    try {
      const arr = JSON.parse(d.lines);
      if (Array.isArray(arr) && arr.length) return arr.map(_normLine);
    } catch (_) {}
  }
  // legacy migrate
  const v = _variant(d.variant);
  const lines = [];
  if (d.label !== undefined) lines.push(_normLine({ kind: 'label', text: d.label, size: d.labelSize, color: d.labelColor, gapTop: 0 }, v.labelSize));
  if (d.title !== undefined) lines.push(_normLine({ kind: 'title', text: d.title, size: d.titleSize, color: d.titleColor, gapTop: d.gap1 ?? v.gap1 }, v.titleSize));
  if (d.sub   !== undefined) lines.push(_normLine({ kind: 'sub',   text: d.sub,   size: d.subSize,   color: d.subColor,   gapTop: d.gap2 ?? v.gap2 }, v.subSize));
  return lines.length ? lines : _defaultLines(v).map(_normLine);
}
// fontFamily 안전 정규화: CSS injection 차단 — 영숫자/공백/콤마/하이픈/괄호/점/언더스코어/single quote만 허용, 최대 100자
function _safeFontFamily(s) {
  if (typeof s !== 'string') return '';
  const v = s.slice(0, 100);
  if (v === '') return '';
  // 허용 문자만 통과 — { ; } : @ " < > 등 차단
  if (!/^[A-Za-z0-9 ,\-_().' -￿]+$/.test(v)) return '';
  return v;
}
function _normLine(l, fallbackSize) {
  return {
    kind:    String(l?.kind || 'sub'),
    text:    String(l?.text ?? ''),
    size:    Number.isFinite(+l?.size) ? Math.max(4, Math.min(400, +l.size)) : (fallbackSize || 16),
    color:   typeof l?.color === 'string' ? l.color : '#000000',
    gapTop:  Number.isFinite(+l?.gapTop) ? Math.max(0, +l.gapTop) : 0,
    fontFamily:    _safeFontFamily(l?.fontFamily),
    fontWeight:    Number.isFinite(+l?.fontWeight) ? Math.max(100, Math.min(900, Math.round(+l.fontWeight))) : 400,
    letterSpacing: Number.isFinite(+l?.letterSpacing) ? Math.max(-20, Math.min(50, +l.letterSpacing)) : 0,
    /* ★«안내문구» 표시 — true 일 때만 키를 둔다(저장본이 불필요하게 커지지 않게).
       ⛔여기서 «만들지» 않는다 — 호출자가 placeholder:true 를 «줄 때만» 표시가 선다.
       ⚠️「_normLine 을 다시 부르면 표시가 저절로 떨어진다」는 옛 주석은 전제가 한 칸 넓었다
         (EVAL medium, 2026-09-21): _legacyLine 은 «글자를 안 써도»(색·크기·gap 만 바꿔도)
         줄을 통째로 다시 만들어 표시를 떨어뜨렸고, 아직 아무도 안 쓴 「라벨입니다.」가 본문으로
         승격돼 PNG 에 박혔다. ⇒ 표시를 떼는 자리는 «글자를 실제로 쓴 경로»에만 둔다
         (blur 커밋 · _legacyLine 의 text 지정 분기 · 패널 editLine).
       ★옛 저장본(이 키가 없다)은 placeholder 없음 = 본문으로 읽힌다 — 열기만 해도 글자가
         사라지는 회귀가 없다(제일 비싼 회귀다). */
    ...(l?.placeholder === true ? { placeholder: true } : {}),
  };
}
function _writeLines(block, lines) {
  const arr = (Array.isArray(lines) ? lines : []).map(_normLine);
  block.dataset.lines = JSON.stringify(arr);
  // legacy mirror — 첫 label/title/sub kind만 동기화 (이전 reader 호환)
  const findFirst = k => arr.find(x => x.kind === k);
  const lab = findFirst('label'), tit = findFirst('title'), sub = findFirst('sub');
  if (lab) { block.dataset.label = lab.text; block.dataset.labelSize = String(lab.size); block.dataset.labelColor = lab.color; }
  if (tit) { block.dataset.title = tit.text; block.dataset.titleSize = String(tit.size); block.dataset.titleColor = tit.color; block.dataset.gap1 = String(tit.gapTop); }
  if (sub) { block.dataset.sub   = sub.text; block.dataset.subSize   = String(sub.size); block.dataset.subColor   = sub.color; block.dataset.gap2 = String(sub.gapTop); }
  return arr;
}

// ── 렌더 ────────────────────────────────────────────────────────────────────
function renderBanner02(block) {
  const d = block.dataset;
  const designW = parseInt(d.bannerW) || 780;
  let   designH = parseInt(d.bannerH) || 260;   // ⑸ 자동 높이에서 재대입될 수 있다
  const radius  = parseInt(d.radius) || 0;
  const bg      = d.bg || '#f3f4f6';
  const align   = d.align || 'left';

  // 외곽
  block.style.position = 'relative';
  block.style.overflow = 'hidden';
  block.style.borderRadius = radius + 'px';
  block.style.background = bg;
  block.style.width = '100%';
  block.style.maxWidth = designW + 'px';
  block.style.margin = '0 auto';

  let inner = block.querySelector('.bn2-inner');
  if (!inner) { inner = document.createElement('div'); inner.className = 'bn2-inner'; block.appendChild(inner); }
  inner.innerHTML = '';
  inner.style.cssText = `position:absolute;top:0;left:0;right:auto;bottom:auto;width:${designW}px;height:${designH}px;transform-origin:top left;`;

  // 텍스트 영역 (가변 lines)
  const lines = _readLines(block);
  // 자동 migrate 결과를 dataset.lines에 저장 (다음 read 빠르게 + 저장 포맷 통일)
  if (!d.lines) _writeLines(block, lines);

  const tx = document.createElement('div');
  tx.className = 'bn2-text';
  tx.style.cssText = `position:absolute;left:${parseInt(d.textX)||36}px;top:${parseInt(d.textY)||35}px;width:${parseInt(d.textW)||358}px;display:flex;flex-direction:column;align-items:${align==='center'?'center':align==='right'?'flex-end':'flex-start'};text-align:${align};`;
  const mkLine = (line, idx) => {
    const el = document.createElement('div');
    el.className = 'bn2-' + line.kind;
    el.textContent = line.text;
    const styleParts = [
      `font-size:${line.size}px`,
      `color:${line.color}`,
      'line-height:1.25',
      'width:100%',
      'white-space:pre-wrap',
      'word-break:break-word',
    ];
    // ★빈 줄은 «높이 0» 이라 캔버스에서 더블클릭할 자리가 아예 없다 → 우측 패널이 유일한 복구
    //   수단이 되는 갇힘이 생긴다. 최소 높이를 줘서 클릭 대상이 «항상» 존재하게 한다.
    //   .bn2-line-empty 는 편집용 마커 — serialize/export 세 경로에서 벗긴다.
    // ★min-height 는 «인라인으로 주지 않는다» — 인라인이면 저장본·.gdt·export-html 에 다 실리고,
    //   무엇보다 neededHeight() 의 입력이 되어 «원래 안 넘치던 배너»를 열기만 해도 자라게 만든다
    //   (QA BUG-1: bn2_84a7j_bgcvdp1 260→294). 클릭영역은 «화면에서만» 필요하지 높이 계산의 입력이 아니다.
    //   → CSS(.bn2-line-empty)로만 주고, neededHeight 는 그 몫을 도로 빼서 «실제 글자 높이»로 잰다.
    if (!String(line.text || '').trim()) el.classList.add('bn2-line-empty');
    /* ★안내문구 표시 — block-factory.js/modal-block.js 와 «같은» 속성 한 쌍.
       읽는 쪽이 이미 셋이나 있다: capture-safety.js stripEditorOnlyForCapture(캡처 클론에서 숨김) ·
       canvas-state.js _isPlaceholderText(MCP 가 「아직 안 썼다」를 알아야 채운다) ·
       editor-blocks.css `#canvas [data-is-placeholder="true"]`(편집 화면에서만 흐리게 — #canvas
       스코프라 body 에 붙는 export 클론엔 «안» 샌다). */
    if (line.placeholder === true) {
      el.dataset.isPlaceholder = 'true';
      el.dataset.placeholder   = line.text;
    }
    if (line.gapTop)                                  styleParts.push(`margin-top:${line.gapTop}px`);
    if (line.fontFamily)                              styleParts.push(`font-family:${line.fontFamily}`);
    if (line.fontWeight && line.fontWeight !== 400)   styleParts.push(`font-weight:${line.fontWeight}`);
    if (line.letterSpacing)                           styleParts.push(`letter-spacing:${line.letterSpacing}px`);
    el.style.cssText = styleParts.join(';') + ';';
    el.setAttribute('contenteditable', 'false');
    el.dataset.lineIdx = String(idx);
    el.dataset.kind = line.kind;
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      el.setAttribute('contenteditable', 'true'); el.focus();
      /* ★안내문구면 «전체선택» — 타이핑이 곧 «교체»가 되게 한다.
         이게 없어서 캐럿만 찍혔고, 사용자가 바로 치면 기본문구에 이어붙었다
         (사용자 관점 훑기 0920 U-26: 「강아지 간식제목을 입력합니다.」).
         ⛔focus() «직후 동기»로 부른다 — 비동기면 기본 캐럿이 선택을 덮는다.
         안내문구가 «아니면» 기존 동작(focus 만) 그대로 — 사용자가 쓴 본문을 통째로 날릴 위험을 안 만든다. */
      if (_isBanner02PlaceholderText(el.textContent)) selectAllEditableContents(el);
    });
    // ★⑶ 빈 줄에서 백스페이스 한 번 더 → 그 줄 삭제 + 이전 줄 끝으로 캐럿.
    //   지금까지 줄 삭제는 우측 × 버튼이 유일했다(캔버스 경로 0건).
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Backspace') return;
      // ⚠️IME: 한글 조합 중 백스페이스는 «조합 버퍼»를 지우는 것이지 줄 삭제가 아니다.
      //   checklist-panel.js 의 기존 규약과 동일한 형태로 막는다.
      if (ev.isComposing || ev.keyCode === 229) return;
      if (String(el.textContent || '').length !== 0) return;   // 글자가 남아 있으면 일반 삭제
      const cur = _readLines(block);
      if (cur.length <= 1) return;                             // 마지막 1줄은 못 지운다(× 버튼 규약과 동일)
      const i = parseInt(el.dataset.lineIdx, 10);
      if (!Number.isInteger(i) || !cur[i]) return;
      ev.preventDefault();
      // ⚠️요소를 DOM 에서 빼면 blur 가 발화한다. 그 핸들러는 «옛 인덱스»로 텍스트를 쓰므로
      //   삭제로 인덱스가 밀린 뒤엔 «엉뚱한 줄»을 덮어쓴다(화면엔 안 보이고 저장본만 틀어진다).
      //   → 삭제 중 표시를 세워 blur 를 no-op 시킨다.
      el.dataset.removing = '1';
      window.pushHistory?.();                                  // 변형 «전»에 — ⌘Z 로 되살아나야 한다
      cur.splice(i, 1);
      _writeLines(block, cur);
      renderBanner02(block);
      window.scheduleAutoSave?.();
      const prev = Math.max(0, i - 1);
      if (block.classList.contains('selected')) {
        window.bn2SetActiveLine?.(block, prev);
        window.showBanner02Properties?.(block, prev);
      }
      // ⚠️재렌더로 요소가 새로 그려졌다 — 옛 참조는 detached 다. 새로 조회해서 캐럿을 끝에 놓는다.
      const target = block.querySelector(`[data-line-idx="${prev}"]`);
      if (target) {
        target.setAttribute('contenteditable', 'true');
        target.focus();
        const r = document.createRange();
        r.selectNodeContents(target);
        r.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
      }
    });
    /* ★캔버스에서 «타자 치는 중»은 렌더를 안 지나는 유일한 변경 경로다
     *   (contenteditable 이 글자를 직접 늘리고, 커밋은 blur 에서 한다).
     *   ⇒ 넘치기 시작하는 그 순간을 여기서만 알 수 있어 힌트만 따로 다시 잰다
     *     (히스토리·저장은 blur 의 몫 — 여기서 건드리지 않는다).
     */
    el.addEventListener('input', () => {
      /* ★DOM 표시도 «즉시» 뗀다 — 모델(blur 커밋)만 떼면 둘이 어긋난다(EVAL high, 2026-09-21).
         어긋나면 ⑴방금 쓴 글자가 캔버스에서 계속 흐리고(#canvas [data-is-placeholder] opacity .45)
         ⑵js/io/capture-safety.js hidePlaceholderTextForCapture 가 그 줄에 visibility:hidden 을 걸어
           «단독 HTML 내보내기(export-html.js)·프로젝트 목록 썸네일(save-load.js captureThumbnail)»에서
           사용자가 방금 쓴 글자가 통째로 안 보인다.
         ★PNG 만 멀쩡한 것이 함정이다 — export-image.js renderComponentsInClone 이 클론에서 배너를
           «모델로 다시 그려» 속성이 재계산된다. 그래서 PNG 실측만으로는 이 구멍이 안 보인다.
         ⇒ 다른 블럭이 전부 지키는 규약(js/blocks/block-drag.js:846~850)과 «같은» 모양으로 뗀다. */
      if (el.dataset.isPlaceholder === 'true' && String(el.textContent || '').trim() !== '') {
        delete el.dataset.isPlaceholder;
      }
      window.refreshBanner02Hint?.(block);
    });
    el.addEventListener('blur', () => {
      if (el.dataset.removing === '1') return;   // ⑶ 삭제 중 — 옛 인덱스로 덮어쓰지 않는다
      el.setAttribute('contenteditable', 'false');
      const cur = _readLines(block);
      const i = parseInt(el.dataset.lineIdx);
      if (Number.isInteger(i) && cur[i]) {
        // ★변경이 «있을 때만» 커밋한다 — 예전엔 편집 없이 들어갔다 나오기만 해도 pushHistory 가
        //   돌아 no-op 스텝이 쌓였고, 그게 ⑶ 줄삭제와 겹쳐 사용자 체감이 「⌘Z 두 번」이 됐다(QA BUG-6).
        //   저장도 같이 아꼈다(불필요한 autosave 억제).
        if (cur[i].text === el.textContent) {
          /* 글자가 그대로면 커밋하지 않는다 — 다만 «모델과 DOM 을 맞춰» 두고 나간다.
             input 이 표시를 뗐다가 도로 같은 글자가 된 경우(더블클릭 전체선택 후 같은 문구 재입력)
             DOM 만 표시가 빠져 «화면은 본문인데 모델은 안내문구»인 어긋남이 남는다.
             block-drag.js:886~889 가 같은 자리에서 「안내문구가 본문으로 굳는 지뢰 방지」로
             표시 «유지»를 택했다 — 같은 결론이다. */
          if (cur[i].placeholder === true) {
            el.dataset.isPlaceholder = 'true';
            el.dataset.placeholder   = cur[i].text;
          }
          return;
        }
        cur[i].text = el.textContent;
        /* ★글자가 «바뀌면» 안내문구 표시를 뗀다 — 이제부터 본문이다.
           ⛔문자열 비교로 「기본문구와 같으니 아직 안내문구」를 판정하지 «않는다».
             위 early-return 이 이미 그 경우다(글자가 그대로면 커밋 자체를 안 한다) —
             block-drag.js:885~888 의 기존 규약(「안내문구가 본문으로 굳는 지뢰 방지」)과 같은 결론이다. */
        delete cur[i].placeholder;
        /* ★모델과 «같이» 뗀다 — 이 핸들러는 renderBanner02 를 다시 부르지 않으므로 여기서 안 떼면
           DOM 속성만 낡은 채로 남는다. 그 상태의 클론을 그대로 쓰는 경로(단독 HTML·썸네일)에서
           방금 쓴 글자가 숨겨진다(EVAL high, 2026-09-21). 위 input 규약의 «한 짝»이다. */
        delete el.dataset.isPlaceholder;
        delete el.dataset.placeholder;
        _writeLines(block, cur);
        window.pushHistory?.(); window.scheduleAutoSave?.();
        if (block.classList.contains('selected')) window.showBanner02Properties?.(block);
      }
    });
    return el;
  };
  lines.forEach((line, i) => tx.appendChild(mkLine(line, i)));
  inner.appendChild(tx);

  // 이미지 영역
  const img = document.createElement('div');
  img.className = 'bn2-img';
  const fit = d.imgFit || 'cover';
  img.style.cssText = `position:absolute;left:${parseInt(d.imgX)||494}px;top:${parseInt(d.imgY)||5}px;width:${parseInt(d.imgW)||250}px;height:${parseInt(d.imgH)||250}px;border-radius:12px;overflow:hidden;`;
  if (d.imgSrc) {
    img.style.backgroundImage = `url("${d.imgSrc}")`;
    img.style.backgroundSize = fit === 'contain' ? 'contain' : 'cover';
    img.style.backgroundPosition = 'center';
    img.style.backgroundRepeat = 'no-repeat';
  } else {
    /* ★체커는 «CSS 클래스»에 둔다(.banner02-block .bn2-img-empty) — 인라인이면 저장본·.gdt·
       단독 HTML 내보내기에 그대로 실린다. 정본은 .asset-block(editor-layout.css) /
       .cvb-img-empty(editor-blocks.css) 이고, 여기만 그 컨벤션을 «안» 따르고 있었다.
       ⚠️이것만으로 PNG 내보내기는 «안» 고쳐진다 — 캡처 클론은 라이브 문서에 붙어 앱 CSS 를
         그대로 받으므로 클래스 체커도 그려진다. 그 몫은 capture-safety.js 의
         neutralizeEmptyImageCheckerForCapture 가 진다(둘이 «같이» 가야 한다). */
    img.classList.add('bn2-img-empty');
  }
  inner.appendChild(img);

  // ★⑸ 내용에 맞춘 자동 높이 —
  //   designH 는 프리셋 고정값이고 block.overflow 가 hidden 이라, 줄을 늘리면 넘친 글자가
  //   «그냥 사라진다». 텍스트 스택 실제 높이를 재서 필요한 만큼 designH 를 키운다.
  //   ⚠️.bn2-tx 는 position:absolute 라 inner 레이아웃 높이에 기여하지 않는다 → offsetHeight 를 직접 잰다.
  //     offsetHeight 는 transform «전» 레이아웃 값이라 inner 의 scale() 과 섞이지 않는다(rect 를 쓰면 섞인다).
  //   규약: 사람이 H 를 만진 배너(autoHeight==='false')는 건드리지 않는다. 플래그가 «없는»
  //     기존 저장본은 «늘리기만» 한다 — 로드만으로 기존 배너 높이가 바뀌는 게 제일 비싼 회귀다.
  const BN2_BOTTOM_PAD = 24;
  const neededHeight = () => {
    const th = _bn2TextHeight(tx);
    if (!th) return 0;
    let need = (parseInt(d.textY) || 0) + th + BN2_BOTTOM_PAD;
    // 축소 시 이미지가 잘리지 않게 하한 — 이미지는 absolute 라 높이를 줄여도 안 밀린다.
    if (d.imgSrc) need = Math.max(need, (parseInt(d.imgY) || 0) + (parseInt(d.imgH) || 0));
    return Math.round(need);
  };
  const autoMode = d.autoHeight;                 // 'true' | 'false' | undefined(레거시)
  if (autoMode !== 'false') {
    const need = neededHeight();
    if (need > 0) {
      const grewOnly = (autoMode !== 'true');    // 레거시 저장본 = 늘리기만
      const next = grewOnly ? Math.max(designH, need) : need;
      if (next !== designH) {
        designH = next;
        block.dataset.bannerH = String(designH);
        inner.style.height = designH + 'px';
      }
    }
  }

  // scale-to-fit (canvas-block 패턴)
  // ⚠️applyScale 이 block.style.height 를 쓰는데 그 block 을 ResizeObserver 가 보고 있다
  //   → 같은 값을 다시 써도 RO 가 또 돌 수 있다. «값이 바뀔 때만» 쓰기로 루프를 끊는다.
  const applyScale = () => {
    const aw = block.offsetWidth;
    if (aw <= 0) return;
    const scale = aw / designW;
    const h = (designH * scale) + 'px';
    if (inner.style.transform !== `scale(${scale})`) inner.style.transform = `scale(${scale})`;
    if (block.style.height !== h) block.style.height = h;
    block._bn2Scale = scale;
  };
  applyScale();
  if (block._bn2RO) block._bn2RO.disconnect();
  block._bn2RO = new ResizeObserver(applyScale);
  block._bn2RO.observe(block);

  /* ★넘침 힌트 재계산은 «여기» 한 곳이다 — 배너 내용·크기가 바뀌는 모든 길(우측 패널의 rerender,
     캔버스 더블클릭 편집 blur, 캔버스 백스페이스 줄삭제, updateBanner02Block API)이 이 함수를 지난다.
     ⛔호출처를 늘려 붙이지 않는다: 예전엔 패널의 W 칸과 패널 최초 구성 «둘»에만 붙어 있어서
       ⑴글자크기를 키워 «넘치기 시작한 순간» 힌트가 안 뜨고 ⑵이미 뜬 힌트의 숫자가 썩었다.
     ⚠️힌트는 살아 있는 .bn2-text 를 재므로 «그린 뒤»에 불러야 한다. */
  window.refreshBanner02Hint?.(block);
}

// ── 생성 ────────────────────────────────────────────────────────────────────
function makeBanner02Block(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const v = _variant(data.variant || 'frame_8');
  const block = document.createElement('div');
  block.className = 'banner02-block'; block.dataset.type = 'banner02';
  block.id = genId('bn2');
  block.dataset.layerName = data.layerName || 'Banner';
  block.dataset.variant   = data.variant || 'frame_8';
  block.dataset.bannerW   = data.width  ?? v.width;
  block.dataset.bannerH   = data.height ?? v.height;
  block.dataset.radius    = data.radius ?? v.radius;
  block.dataset.bg        = data.bg     ?? v.bg;
  block.dataset.align     = data.align  || 'left';
  block.dataset.textX     = data.textX ?? v.textX;
  block.dataset.textY     = data.textY ?? v.textY;
  block.dataset.textW     = data.textW ?? v.textW;
  block.dataset.label     = data.label ?? '라벨입니다.';
  block.dataset.labelSize  = data.labelSize ?? v.labelSize;
  block.dataset.labelColor = data.labelColor || '#000000';
  block.dataset.title      = data.title ?? '제목을 입력합니다.';
  block.dataset.titleSize  = data.titleSize ?? v.titleSize;
  block.dataset.titleColor = data.titleColor || '#000000';
  block.dataset.sub        = data.sub ?? '캡션이 입력됩니다.';
  block.dataset.subSize    = data.subSize ?? v.subSize;
  block.dataset.subColor   = data.subColor || '#000000';
  block.dataset.gap1       = data.gap1 ?? v.gap1;
  block.dataset.gap2       = data.gap2 ?? v.gap2;
  block.dataset.imgSrc     = data.imgSrc || '';
  block.dataset.imgX       = data.imgX ?? v.imgX;
  block.dataset.imgY       = data.imgY ?? v.imgY;
  block.dataset.imgW       = data.imgW ?? v.imgW;
  block.dataset.imgH       = data.imgH ?? v.imgH;
  block.dataset.imgFit     = data.imgFit || 'cover';

  /* ★안내문구 표시는 «여기»서 선다 — 기본 문구를 실제로 박는 자리가 여기다.
     ⚠️_defaultLines() 가 아니다: 새 배너는 위처럼 legacy dataset(label/title/sub)으로 만들어지고
       _readLines 는 그 경우 legacy-migrate 경로를 타서 _defaultLines 를 «안» 지나간다.
       (고치는 중에 실제로 헛짚었다 — DOM 검사 T1 이 그 헛짚음을 잡았다.)
     ★판정 기준은 «문자열 비교»가 아니라 «호출자가 값을 줬나»다 — 템플릿·붙여넣기·MCP 가
       진짜 글자를 넣어 만든 배너는 data.label 등이 있으므로 본문으로 남는다.
     ⛔우연히 기본문구와 «같은 글자»를 넘긴 호출자는 본문으로 취급된다 — 의도한 쪽이다
       (block-drag.js:885~888 의 「안내문구가 본문으로 굳는 지뢰 방지」와 같은 방향). */
  _writeLines(block, [
    { kind: 'label', text: block.dataset.label, size: block.dataset.labelSize, color: block.dataset.labelColor, gapTop: 0,
      ...(data.label === undefined ? { placeholder: true } : {}) },
    { kind: 'title', text: block.dataset.title, size: block.dataset.titleSize, color: block.dataset.titleColor, gapTop: block.dataset.gap1,
      ...(data.title === undefined ? { placeholder: true } : {}) },
    { kind: 'sub',   text: block.dataset.sub,   size: block.dataset.subSize,   color: block.dataset.subColor,   gapTop: block.dataset.gap2,
      ...(data.sub   === undefined ? { placeholder: true } : {}) },
  ]);

  renderBanner02(block);
  row.appendChild(block);
  return { row, block };
}

function addBanner02Block(opts = {}) {
  // freeLayout 프레임 내부 삽입 — 별도 경로
  if (window._insertToFlowFrame?.(() => makeBanner02Block(opts))) {
    // freeLayout 경로는 row를 반환하지 않으므로 추가 후 마지막 banner02 추정 필요 — 호출자가 사용 X
    return null;
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return null; }
  window.pushHistory();
  const { row, block } = makeBanner02Block(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel?.();
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (C9)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.scheduleAutoSave?.();
  return { row, block };
}

// ── 수정 ────────────────────────────────────────────────────────────────────
// PM의 update_banner02_block(MCP) → main(_invokeRendererUpdateBanner02Block) → 여기.
// add_text_block의 editTextBlock 패턴 미러링: pushHistory + dataset partial write + renderBanner02 재렌더 + scheduleAutoSave.
// 지원 필드 (data-* 매핑):
//   - 변형: variant
//   - 외곽: width(bannerW), height(bannerH), radius, bg, align
//   - 텍스트 박스: textX/textY/textW
//   - 텍스트: label/labelSize/labelColor, title/titleSize/titleColor, sub/subSize/subColor, gap1, gap2
//   - 이미지: imgSrc, imgX/imgY/imgW/imgH, imgFit
//   - 편의: layout: 'left'|'right'  (text/img 좌우 swap — variant 기본 textX/imgX 사용)
function updateBanner02Block(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('banner02-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `banner02-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // before 스냅샷 (mutate 전, undo 푸시 전)
  const before = {
    variant: block.dataset.variant,
    label: block.dataset.label, title: block.dataset.title, sub: block.dataset.sub,
    imgSrc: block.dataset.imgSrc, bg: block.dataset.bg, align: block.dataset.align,
  };

  window.pushHistory?.();

  const applied = {};

  // 1) variant 스왑 — variant 키만 바뀌고 나머지는 유지 (Codex 안전성: 정의된 키만 허용)
  if (partial.variant !== undefined) {
    if (!BANNER02_VARIANTS[partial.variant]) {
      return { ok: false, code: 'INVALID', message: `invalid variant: ${partial.variant}` };
    }
    block.dataset.variant = String(partial.variant);
    applied.variant = block.dataset.variant;
  }

  // 2) 외곽
  const _setNum = (datasetKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    block.dataset[datasetKey] = String(n);
    return true;
  };
  if (partial.width  !== undefined) { if (_setNum('bannerW', partial.width, 80, 4000))  applied.width  = Number(partial.width); }
  if (partial.height !== undefined) { if (_setNum('bannerH', partial.height, 40, 4000)) applied.height = Number(partial.height); }
  if (partial.radius !== undefined) { if (_setNum('radius',  partial.radius, 0, 400))   applied.radius = Number(partial.radius); }
  if (partial.bg !== undefined && partial.bg !== null) {
    block.dataset.bg = String(partial.bg);
    applied.bg = block.dataset.bg;
  }
  if (partial.align !== undefined) {
    if (!['left','center','right'].includes(partial.align)) {
      return { ok: false, code: 'INVALID', message: `invalid align: ${partial.align}` };
    }
    block.dataset.align = partial.align;
    applied.align = partial.align;
  }

  // 3) 텍스트 박스
  if (partial.textX !== undefined) { if (_setNum('textX', partial.textX, -4000, 4000)) applied.textX = Number(partial.textX); }
  if (partial.textY !== undefined) { if (_setNum('textY', partial.textY, -4000, 4000)) applied.textY = Number(partial.textY); }
  if (partial.textW !== undefined) { if (_setNum('textW', partial.textW, 20, 4000))    applied.textW = Number(partial.textW); }

  // 4) 텍스트 콘텐츠/스타일 — 가변 lines 모델
  //    a) 신규 partial (권장): lines / addLine / removeLine / editLine
  //    b) 레거시 partial (호환): label/title/sub + 사이즈/색상/gap1/gap2 → 첫 매칭 kind의 line에 반영
  let lines = _readLines(block);
  const _findIdx = (kind, occurrence = 1) => {
    let seen = 0;
    for (let i = 0; i < lines.length; i++) if (lines[i].kind === kind) { seen++; if (seen === occurrence) return i; }
    return -1;
  };

  // 4-a) 신규 partial
  if (partial.lines !== undefined) {
    if (!Array.isArray(partial.lines)) return { ok: false, code: 'INVALID', message: 'lines must be array' };
    if (partial.lines.length === 0)    return { ok: false, code: 'INVALID', message: 'lines must have at least 1 item' };
    if (partial.lines.length > 20)     return { ok: false, code: 'INVALID', message: 'lines too many (>20)' };
    lines = partial.lines.map(_normLine);
    applied.lines = lines;
  }
  if (partial.addLine !== undefined && partial.addLine !== null) {
    const a = partial.addLine;
    if (typeof a !== 'object') return { ok: false, code: 'INVALID', message: 'addLine must be object' };
    if (lines.length >= 20)    return { ok: false, code: 'INVALID', message: 'lines limit reached (20)' };
    const newLine = _normLine(a);
    const at = Number.isInteger(a.atIndex) ? Math.max(0, Math.min(lines.length, a.atIndex)) : lines.length;
    lines.splice(at, 0, newLine);
    applied.addLine = { ...newLine, atIndex: at };
  }
  if (partial.removeLine !== undefined && partial.removeLine !== null) {
    const r = partial.removeLine;
    let idx = -1;
    if (typeof r === 'number') idx = r;
    else if (typeof r === 'object' && Number.isInteger(r.index)) idx = r.index;
    else if (typeof r === 'object' && typeof r.kind === 'string') idx = _findIdx(r.kind, r.occurrence || 1);
    if (idx < 0 || idx >= lines.length) return { ok: false, code: 'NOT_FOUND', message: `removeLine target not found: ${JSON.stringify(r)}` };
    if (lines.length <= 1)              return { ok: false, code: 'INVALID', message: 'cannot remove last remaining line' };
    const removed = lines.splice(idx, 1)[0];
    applied.removeLine = { index: idx, removed };
  }
  if (partial.editLine !== undefined && partial.editLine !== null) {
    const e = partial.editLine;
    if (typeof e !== 'object') return { ok: false, code: 'INVALID', message: 'editLine must be object' };
    let idx = Number.isInteger(e.index) ? e.index : (typeof e.kind === 'string' ? _findIdx(e.kind, e.occurrence || 1) : -1);
    if (idx < 0 || idx >= lines.length) return { ok: false, code: 'NOT_FOUND', message: `editLine target not found: ${JSON.stringify(e)}` };
    const cur = lines[idx];
    const merged = _normLine({
      kind:          e.kind          !== undefined ? e.kind          : cur.kind,
      text:          e.text          !== undefined ? e.text          : cur.text,
      size:          e.size          !== undefined ? e.size          : cur.size,
      color:         e.color         !== undefined ? e.color         : cur.color,
      gapTop:        e.gapTop        !== undefined ? e.gapTop        : cur.gapTop,
      fontFamily:    e.fontFamily    !== undefined ? e.fontFamily    : cur.fontFamily,
      fontWeight:    e.fontWeight    !== undefined ? e.fontWeight    : cur.fontWeight,
      letterSpacing: e.letterSpacing !== undefined ? e.letterSpacing : cur.letterSpacing,
    });
    lines[idx] = merged;
    applied.editLine = { index: idx, ...merged };
  }

  // 4-b) 레거시 partial (label/title/sub 직접) — 첫 매칭 kind에 반영. 없으면 append.
  const _legacyLine = (kind, textKey, sizeKey, colorKey, gapKey, vSize, vGap) => {
    const hasAny = partial[textKey] !== undefined || partial[sizeKey] !== undefined || partial[colorKey] !== undefined || partial[gapKey] !== undefined;
    if (!hasAny) return;
    let idx = _findIdx(kind);
    if (idx < 0) {
      // append new line of this kind
      lines.push(_normLine({ kind, text: partial[textKey] ?? '', size: partial[sizeKey] ?? vSize, color: partial[colorKey] ?? '#000000', gapTop: partial[gapKey] ?? vGap }));
      idx = lines.length - 1;
    } else {
      const cur = lines[idx];
      const textGiven = partial[textKey] !== undefined && partial[textKey] !== null;
      lines[idx] = _normLine({
        kind: cur.kind,
        text:   textGiven ? String(partial[textKey]) : cur.text,
        size:   partial[sizeKey]  !== undefined ? Number(partial[sizeKey])  : cur.size,
        color:  partial[colorKey] !== undefined && partial[colorKey] !== null ? String(partial[colorKey]) : cur.color,
        gapTop: partial[gapKey]   !== undefined ? Number(partial[gapKey])   : cur.gapTop,
        // 새 폰트 필드는 legacy partial로 안 들어오므로 cur 값 보존
        fontFamily:    cur.fontFamily,
        fontWeight:    cur.fontWeight,
        letterSpacing: cur.letterSpacing,
        /* ★«안내문구» 표시도 보존한다 — 폰트 필드와 같은 이유(legacy partial 에 안 실린다).
           ⛔글자를 «안» 건드리는 호출(색·크기·gap 만)이 표시를 떨어뜨리면, 아직 아무도 안 쓴
             「라벨입니다.」가 본문으로 승격돼 내보낸 PNG 에 그대로 찍힌다 — 고치기 전 증상 그대로다
             (EVAL medium, 2026-09-21: updateBanner02Block(id,{labelColor:'#ff0000'}) 한 줄로 재현).
           ★패널 경로(js/props/prop-banner02.js mutLines)는 read→mutate→write 라 원래 보존한다 —
             «같은 행위가 경로에 따라 정반대로 동작»하던 자리를 맞춘다.
           ★글자를 실제로 주면(textGiven) 그때는 본문이다 ⇒ 표시를 넘기지 않는다. */
        ...(!textGiven && cur.placeholder === true ? { placeholder: true } : {}),
      });
    }
    if (partial[textKey]  !== undefined && partial[textKey]  !== null) applied[textKey]  = lines[idx].text;
    if (partial[sizeKey]  !== undefined) applied[sizeKey]  = lines[idx].size;
    if (partial[colorKey] !== undefined && partial[colorKey] !== null) applied[colorKey] = lines[idx].color;
    if (partial[gapKey]   !== undefined) applied[gapKey]   = lines[idx].gapTop;
  };
  const _v = _variant(block.dataset.variant);
  _legacyLine('label', 'label', 'labelSize', 'labelColor', 'gap0', _v.labelSize, 0);          // gap0은 사실상 미사용 — label은 첫 줄
  _legacyLine('title', 'title', 'titleSize', 'titleColor', 'gap1', _v.titleSize, _v.gap1);
  _legacyLine('sub',   'sub',   'subSize',   'subColor',   'gap2', _v.subSize,   _v.gap2);

  // lines 변경 사항을 dataset에 한 번에 commit
  _writeLines(block, lines);

  // 5) 이미지 — imgSrc는 renderBanner02에서 url("...") template에 들어가므로 escape 필요
  if (partial.imgSrc !== undefined && partial.imgSrc !== null) {
    const src = String(partial.imgSrc);
    // 길이 가드 (data URL 폭주 방지) + " 와 개행 차단 (CSS url("") 깨짐/탈출 방지)
    if (src.length > 200000) {
      return { ok: false, code: 'TOO_LARGE', message: `imgSrc too long (>200000)` };
    }
    if (/["\r\n]/.test(src)) {
      return { ok: false, code: 'INVALID', message: 'imgSrc contains quote/newline (escape unsafe)' };
    }
    block.dataset.imgSrc = src;
    applied.imgSrc = src;
  }
  if (partial.imgX !== undefined) { if (_setNum('imgX', partial.imgX, -4000, 4000)) applied.imgX = Number(partial.imgX); }
  if (partial.imgY !== undefined) { if (_setNum('imgY', partial.imgY, -4000, 4000)) applied.imgY = Number(partial.imgY); }
  if (partial.imgW !== undefined) { if (_setNum('imgW', partial.imgW, 4, 4000))     applied.imgW = Number(partial.imgW); }
  if (partial.imgH !== undefined) { if (_setNum('imgH', partial.imgH, 4, 4000))     applied.imgH = Number(partial.imgH); }
  if (partial.imgFit !== undefined) {
    if (!['cover','contain'].includes(partial.imgFit)) {
      return { ok: false, code: 'INVALID', message: `invalid imgFit: ${partial.imgFit}` };
    }
    block.dataset.imgFit = partial.imgFit;
    applied.imgFit = partial.imgFit;
  }

  // 6) layout swap — text/img 좌우 위치 swap (편의 필드).
  // 현재 dataset의 textX/imgX 값을 swap. layout='left'면 text가 왼쪽(textX<imgX), 'right'면 그 반대.
  if (partial.layout !== undefined) {
    if (!['left','right'].includes(partial.layout)) {
      return { ok: false, code: 'INVALID', message: `invalid layout: ${partial.layout}` };
    }
    const tx = parseInt(block.dataset.textX) || 0;
    const ix = parseInt(block.dataset.imgX)  || 0;
    const textIsLeft = tx < ix;
    if ((partial.layout === 'left' && !textIsLeft) || (partial.layout === 'right' && textIsLeft)) {
      block.dataset.textX = String(ix);
      block.dataset.imgX  = String(tx);
    }
    applied.layout = partial.layout;
  }

  // 7) 재렌더 (변경 없어도 idempotent — Codex round-trip 안전성)
  try {
    renderBanner02(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // 8) 우측 패널 갱신 (선택 상태일 때만)
  if (block.classList.contains('selected')) {
    try { window.showBanner02Properties?.(block); } catch (_) {}
  }
  // 9) 레이어 패널 (layerName 변경 가능성 대비)
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

window.makeBanner02Block   = makeBanner02Block;
/* ⑸ 넘침 판정 — 패널 힌트가 쓰는 «단 하나»의 계산. renderBanner02 의 neededHeight 와 같은 식이며
   살아 있는 DOM(.bn2-text)을 재므로 새 계산을 만들지 않는다.
   ⚠️offsetHeight 는 transform 前 값 — inner 의 scale() 과 섞이지 않는다. */
/* ★빈 줄의 «클릭영역용» min-height 는 높이 계산에서 뺀다 — 그게 계산에 들어가면
   원래 안 넘치던 배너가 열기만 해도 자란다(QA BUG-1). 빈 줄의 «글자» 높이는 0 이므로
   computed min-height 를 그대로 차감하면 정확하다. CSS 값과 JS 상수를 이중으로 두지 않으려고
   실제 computed 를 읽는다. */
function _bn2TextHeight(tx) {
  if (!tx) return 0;
  let h = tx.offsetHeight;
  const empties = tx.querySelectorAll('.bn2-line-empty');
  if (empties.length) {
    const mh = parseFloat(getComputedStyle(empties[0]).minHeight) || 0;
    h -= mh * empties.length;
  }
  return Math.max(0, h);
}

function bn2OverflowInfo(block) {
  if (!block) return null;
  const tx = block.querySelector('.bn2-text');
  const th = _bn2TextHeight(tx);
  if (!th) return null;
  const d = block.dataset;
  const cur = parseInt(d.bannerH) || 260;
  let need = (parseInt(d.textY) || 0) + th + 24;
  if (d.imgSrc) need = Math.max(need, (parseInt(d.imgY) || 0) + (parseInt(d.imgH) || 0));
  need = Math.round(need);
  return { need, cur, overflow: need > cur };
}
window.bn2OverflowInfo     = bn2OverflowInfo;
window.addBanner02Block    = addBanner02Block;
window.updateBanner02Block = updateBanner02Block;
window.renderBanner02      = renderBanner02;
window.BANNER02_VARIANTS   = BANNER02_VARIANTS;
// ★newLineText/isPlaceholderText 를 같이 내보낸다 — prop-banner02.js 의 「+ 텍스트 줄 추가」가
//   기본문구 리터럴을 «제 파일에» 또 만들지 않도록(정본 1곳).
window._bn2Lines = { read: _readLines, write: _writeLines, normalize: _normLine, defaults: _defaultLines,
                     newLineText: BANNER02_NEW_LINE_TEXT, isPlaceholderText: _isBanner02PlaceholderText };

export { makeBanner02Block, addBanner02Block, updateBanner02Block, renderBanner02, BANNER02_VARIANTS };
