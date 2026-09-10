/**
 * Goditor — 갭(간격) 규격의 «단일 진실». (2026-09-07 신설)
 *
 * ★왜 «넣기»가 아니라 «감수 패스»인가 (현빈 지시, 이 설계의 뿌리)
 *   초안은 「블록을 추가할 때 갭도 같이 넣는다」였다. 현빈이 두 가지로 죽였다:
 *     ⑴ 블록1·갭1·블록2·갭2 에서 «블록2 를 지우면» 블록1·갭1·갭2 가 남는다(고아 갭 200px).
 *        삽입만 아는 규칙은 삭제·이동·교체를 못 따라간다.
 *     ⑵ 삽입 «시점»엔 뒤에 뭐가 올지 모른다. 갭은 «앞뒤 조합»의 함수라 고정값이면 애초에 틀린다.
 *   ⇒ 그래서 이건 «감수(監修)»다 — 섹션을 다 짓고 «전체를 읽은 뒤» 한 번 보정한다.
 *
 * ★★핵심 성질은 «멱등»이다. 두 번 돌린 결과가 같아야 한다.
 *   그래야 ⑴아무 때나 돌려도 안전하고 ⑵삭제 뒤에 돌리면 고아 갭이 «저절로» 정리된다.
 *   기계적 근거 = `normalizePlan()` 이 두 번째엔 ops 를 «빈 배열»로 돌려준다(tests/unit/spacing-spec).
 *
 * ⛔이 파일은 «순수»다 — electron·DOM·fs 를 안 부른다. 그래야 단위검사가 진짜 검사가 된다.
 *   DOM 을 만지는 쪽은 js/spacing-normalize.js(렌더러)가 «판단 없이» 맡는다.
 */

'use strict';

/* ── ⓐ 값 (현빈 승인, 2026-09-07) ─────────────────────────────────────────
 * 근거 = templates/canvas/*.html 19개에서 «사람이 만든 갭»의 분포 실측(bac5499):
 *   100×13 · 80×11 · 40×9 · 20×4 · 30×4 · 60×3 · 120×3 · 15×3 · 90×2 · 160×2 · 24×2
 *   · 180·200·220·700 각 1 · (inline height 없음 18)
 * 상위 셋(100·80·40)이 L·M·S 그대로다. XS 는 실측 15(제목↔캡션 3건)를 4의 배수로 올린 16.
 * ⚠️캡션 인접 15 는 3건뿐이라 «표본이 얇다». 되돌릴 근거가 생기면 여기부터 본다. */
/* ★이 값 네 개는 «현빈 승인 확정»이다(2026-09-07, 「그 값으로 등록해」). 바꾸려면 다시 물어라.
 *
 * ⚠️같이 남기는 실측 — 「실사용 클로드가 «스스로» 쓰는 값」은 다르다(9370 실대화):
 *     섹션시작→첫 프레임 100 (10/10 일관) · 제목→콘텐츠 50 (3/3) · 라벨→제목 20 · 본문→이미지 80
 *     ★제목→글은 20 과 30 을 «번갈아» 썼다(2회 중 1:1).
 *   ⇒ ★이건 「경쟁 후보」가 아니다. **규격이 필요한 «이유»다** —
 *     사람이 정한 값이 없으면 모델은 같은 자리에 매번 다른 값을 넣는다.
 *
 * ⛔그리고 저 실측을 그대로 대조하면 «틀린다» — 층이 다르다.
 *   `add_gap_block` 이 만든 갭은 «텍스트 프레임 안»에 들어가고(_insertToFlowFrame),
 *   read_section 은 후손을 평탄화해 보여준다. 즉 위 「제목→콘텐츠 50」의 일부는
 *   ★«섹션 레벨 갭이 아니다». 이 규격이 관할하는 것은 .section-inner «직속»뿐이다.
 *   (이 혼동이 실제로 결함을 하나 만들었다 — 안 보이는 갭 위에 덧쌓아 50+80=130px. 지금은 막혀 있다)
 *
 * ⇒ 값을 바꿀 땐 «여기 한 줄»이면 된다. 구조·배선·검사는 값과 무관하게 그대로다. */
const SCALE = Object.freeze({
  XS: 16,   // 제목↔캡션 · 라벨↔제목   (템플릿 실측 15)
  S: 40,    // 본문↔본문 · 제목↔제목   (템플릿 실측 40 — 조합 실측 최다)
  M: 80,    // 제목↔본문 · 본문↔덩어리 (템플릿 실측 80)
  L: 100,   // 섹션 «상하»             (add_section 이 이미 이렇게 넣고 있다)
});

/* ── ⓑ 무게표 ─────────────────────────────────────────────────────────────
 * ★새 블록 타입이 생기면 «여기 한 줄»만 주면 된다. 그 외에 손댈 곳이 없다.
 *   이름은 main/claude-pm/mcp-block-tools.js 의 BLOCK_TYPES(26종) 이름을 그대로 쓴다 —
 *   여기서 새 이름을 만들면 두 표가 갈라지고, 갈라진 표는 반드시 썩는다.
 *
 *   0 = 위 블록의 «꼬리»(붙는다)   1 = 글줄   2 = 표제   3 = 덩어리
 *
 * ⚠️아래 다섯(divider·iconify·icon_circle·icon_text·label_group)은 «실측 근거가 없다» —
 *   템플릿 조합 표본에 안 나왔다. 작은 장식물이라 덩어리(3)로 보지 않고 2 로 둔 «판단»이다.
 *   실측이 생기면 이 다섯 줄부터 고쳐라. */
const WEIGHT = Object.freeze({
  // 0 — 꼬리
  caption: 0,
  label: 0,
  // 1 — 글줄
  body: 1,
  bullet: 1,
  // 2 — 표제
  heading: 2,
  h1: 2,
  h2: 2,
  h3: 2,
  // 2 — 작은 장식물(★판단, 실측 없음)
  divider: 2,
  iconify: 2,
  icon_circle: 2,
  icon_text: 2,
  label_group: 2,
  /* row = 블록을 «나란히» 담는 DOM 래퍼다. 진짜 무게는 childTypes(자식 중 최대)에서 나오고,
     이 값은 «안을 못 봤을 때»의 폴백이다. 덩어리로 두는 편이 안전하다(여백이 모자란 것보다 낫다). */
  row: 3,
  /* ★아래 다섯은 «렌더러가 실제로 내는» dataset.type 인데 MCP BLOCK_TYPES 엔 없다
     (tests/unit/spacing-spec ⑩-b 가 js/ 191개 파일에서 세어 잡았다). 무게가 없으면
     「모르는 타입」으로 떨어지므로 여기 있어야 한다. */
  icon: 2,          // .icon-block(icn_) = iconify 와 같은 것, 이름만 다르다
  bridge: 3,        // .bridge-block — 섹션을 잇는 시각 덩어리
  infocard: 3,      // .infocard-block — 카드
  innercard: 3,     // .innercard-block — 카드 안 카드
  modal: 3,         // .modal-block — 컨테이너 + 텍스트(현빈 발주 2026-09-08). 카드와 같은 «덩어리»다
  joker: 3,         // .joker-block(sb_) — 피그마 컴포넌트 자리, 통짜 그림
  // 3 — 덩어리
  table: 3,
  asset: 3,
  canvas: 3,
  frame: 3,
  card: 3,
  graph: 3,
  step: 3,
  grid: 3,
  comparison: 3,
  mockup: 3,
  chat: 3,
  banner: 3,
  banner02: 3,
  laurel: 3,
  zoom: 3,          // .zoom-block(zmb_) — 도형+그림자 사다리꼴, 통짜 시각 덩어리
  liner: 3,
  vector: 3,
  shape: 3,
  sticker: 3,
  gradient: 3,
  speech_bubble: 3,
});

/** 모르는 타입이 떨어진 «가장 안전한» 무게. 2 면 어떤 조합과 만나도 S 또는 M 이라 튀지 않는다. */
const FALLBACK_WEIGHT = 2;

/* ⛔모르는 타입을 «조용히» 기본값으로 삼키지 않는다 — 그게 표가 썩는 방식이다.
 *   같은 이름을 매번 짖으면 로그가 시끄러워지므로 «이름당 한 번»만 말한다. */
const _warned = new Set();
let _warn = (msg) => { try { console.warn(msg); } catch (_) {} };
/** 테스트가 경고를 «잡아» 셀 수 있게 하는 구멍. 반환값 = 원래 함수(복구용). */
function setWarner(fn) { const prev = _warn; _warn = fn || (() => {}); return prev; }
function resetWarnings() { _warned.clear(); }

/**
 * 타입 → 무게. 모르는 타입은 FALLBACK_WEIGHT 로 떨어지되 «말한다».
 * @param {string} type
 * @returns {number} 0..3
 */
function weightOf(type) {
  /* ★DOM 은 «하이픈», 도구 레지스트리는 «밑줄»을 쓴다 — 같은 블록인데 이름이 두 벌이다.
     `dataset.type` 실측: speech-bubble · label-group · icon-circle · icon-text
     `BLOCK_TYPES` 실측: speech_bubble · label_group · icon_circle · icon_text
     ⛔이걸 안 맞추면 «있는 타입»이 조용히 「모르는 타입」으로 떨어진다.
     2026-09-07 실측: 진짜 앱이 만든 «데일리 수분크림»(8섹션)에서 speech-bubble 이
     무게 2로 떨어져 `speech-bubble → row` 가 M80 이어야 할 자리에 S40 이 들어갔다.
     내 픽스처는 전부 밑줄로 적혀 있어서 «영영 안 보였을» 결함이다. */
  const t = String(type == null ? '' : type).replace(/-/g, '_');
  if (Object.prototype.hasOwnProperty.call(WEIGHT, t)) return WEIGHT[t];
  if (!_warned.has(t)) {
    _warned.add(t);
    _warn(`[spacing] 모르는 블록 타입 «${t || '(빈 이름)'}» — 무게 ${FALLBACK_WEIGHT}(안전측)로 떨어뜨렸다. `
      + 'main/claude-pm/services/spacing.js 의 WEIGHT 에 한 줄 추가해라.');
  }
  return FALLBACK_WEIGHT;
}

/**
 * 항목 하나의 «실효 무게».
 * ★.row 는 블록 여럿을 나란히 담는 래퍼다. 안에 이미지가 하나라도 있으면 그 줄은 «덩어리»다
 *   ⇒ 자식 중 «가장 무거운» 것을 그 줄의 무게로 본다. (렌더러가 childTypes 로 실어 보낸다)
 * @param {{type?:string, childTypes?:string[]}|string} item
 */
function weightOfItem(item) {
  if (item && typeof item === 'object') {
    const kids = Array.isArray(item.childTypes) ? item.childTypes.filter(Boolean) : [];
    if (kids.length) return kids.reduce((mx, t) => Math.max(mx, weightOf(t)), 0);
    return weightOf(item.type);
  }
  return weightOf(item);
}

/**
 * 앞뒤 조합 → 갭 픽셀. (섹션 «상하»는 이 함수가 아니라 SCALE.L 이다)
 *
 *   뒤가 무게0(캡션·라벨)  → XS  ← 캡션은 위 블록의 «꼬리»다. 이 줄이 «먼저» 와야 한다
 *                                 (표→캡션도 XS 로 붙어야 하므로 덩어리 규칙보다 위).
 *   한쪽이 3(덩어리)      → M
 *   둘이 같은 무게        → S   (1↔1 본문↔본문 · 2↔2 제목↔제목)
 *   그 밖(무게가 다르다)   → M   (1↔2 제목↔본문 · 0↔1 캡션→본문 …)
 *
 * ⚠️`body → table` 은 템플릿 실측이 **40** 인데 **80** 으로 «올렸다»(표본 1건이고, 덩어리
 *   앞에는 여백이 필요하다고 봤다). 실측을 뒤집은 유일한 칸이다 — 되돌릴 근거가 생기면 여기.
 */
function gapFor(prevType, nextType) {
  const wp = weightOfItem(prevType);
  const wn = weightOfItem(nextType);
  if (wn === 0) return SCALE.XS;
  if (wp === 3 || wn === 3) return SCALE.M;
  if (wp === wn) return SCALE.S;
  return SCALE.M;
}

/* ── ⑵ 정규화(감수 패스) — «순수» 부분 ────────────────────────────────────
 *
 * 입력 items = 섹션의 «세로 시퀀스»(section-inner 의 직속 자식) 순서대로:
 *   { id, kind:'gap',   height:number, auto:boolean }
 *   { id, kind:'block', type:string, childTypes?:string[] }
 *
 * 출력 { ops, notes, slots }
 *   ops = [{op:'set', id, height, from}, {op:'remove', id}, {op:'insert', afterId|null, height}]
 *   ★ops 가 빈 배열이면 «할 일이 없다» = 적용부는 아무것도 안 한다(히스토리도 안 쌓인다).
 *     이게 멱등의 기계적 근거다.
 *
 * 모델 = «슬롯». 블록과 블록 사이(그리고 맨 위·맨 아래)가 슬롯이고, 슬롯 하나엔
 * 갭이 «정확히 하나» 있어야 한다. 그러면 세 가지가 한 규칙으로 풀린다:
 *   연속 갭 2개  → 슬롯 하나에 갭 둘 → 첫 것만 남기고 나머지 remove   (병합)
 *   블록 삭제 후 → 남은 갭 둘이 «같은 슬롯»에 떨어진다 → 위와 같은 처리 (고아 갭)
 *   갭 0개       → 슬롯이 비었다 → insert                              (빠진 자리)
 *
 * ⓓ 자동/수동: 슬롯 안에 «수동» 갭(data-gap-auto 없음)이 하나라도 있으면 그 슬롯은
 *   통째로 «안 건드린다». 현빈이 「여긴 37px 이 예뻐」라고 맞춘 것을 되돌리면 도와주는 게
 *   아니라 뺏는 것이다. ★표식이 «없는» 갭은 수동으로 본다 — 반대로 정하면 기존 프로젝트의
 *   손맞춤 값이 전부 되돌아간다. 대가: 기존 프로젝트의 «기존 갭 값»은 안 바뀐다(빠진 자리
 *   삽입은 표식과 무관하게 된다).
 */

/** 섹션 상하 슬롯의 목표값. 규격상 항상 L. */
const SECTION_EDGE = SCALE.L;

function _isGap(it) { return it && it.kind === 'gap'; }

/**
 * ★이 갭을 감수가 만져도 되는가 = «자동»인가.
 *
 * 세 갈래다(가운데가 실측으로 «나중에» 생긴 갈래다):
 *   ⑴ marked=true                       → 자동. 기계가 만들었다(data-gap-auto="1").
 *   ⑵ marked=false · hasInlineHeight=false → ★자동. «아무도 값을 정한 적이 없다».
 *   ⑶ marked=false · hasInlineHeight=true  → 수동. 누군가 그 값을 «정했다» — 안 건드린다.
 *
 * ★⑵ 가 왜 자동인가 (2026-09-07 실측): templates/canvas 19개에 **inline height 가 아예 없는
 *   갭이 18개** 있다. 그건 CSS 기본값이 보이는 것이지 «사람이 고른 값»이 아니다.
 *   ⓓ 규칙(「표식 없으면 수동」)이 지키려는 건 «사람이 정한 값»인데, 정해진 값이 «없다».
 *   ⇒ 이 앱에서 갭 높이를 바꾸는 자리는 전부 `.style.height` 를 쓴다(prop-gap 3곳 ·
 *      prop-multisel · updateGapBlock). 그래서 「inline height 없음」 ⇔ 「아무도 안 정했다」가
 *      «구조적으로» 성립한다. 빈칸을 채우는 것은 뺏는 것이 아니다.
 *   ⚠️이 등가가 깨지려면 «CSS 클래스로 갭 높이를 주는» 경로가 새로 생겨야 한다. 그런 걸 만들면
 *      여기부터 고쳐라(tests/unit/spacing-spec 의 ⑨ 가 그 자리를 지킨다).
 *
 * `auto` 는 «축약 형태»다 — 검사·하네스가 손으로 시퀀스를 적을 때 쓴다.
 */
function isAutoGap(it) {
  if (!it) return false;
  if (it.marked !== undefined) return it.marked === true || it.hasInlineHeight === false;
  return it.auto === true;
}
function _isAuto(it) { return isAutoGap(it); }

/**
 * @param {Array} items 섹션의 세로 시퀀스
 * @returns {{ops:Array, notes:string[], slots:Array}}
 */
function normalizePlan(items) {
  const seq = Array.isArray(items) ? items.filter(Boolean) : [];
  const ops = [];
  const notes = [];

  const blockIdx = [];
  for (let i = 0; i < seq.length; i++) if (!_isGap(seq[i])) blockIdx.push(i);

  /* 블록이 «하나도» 없으면 손대지 않는다. 방금 만든 빈 섹션(갭 2개)이 그 모양인데,
     거기서 갭을 지우면 사람이 블록을 넣을 «자리»가 사라진다. */
  if (blockIdx.length === 0) {
    if (seq.length) notes.push('블록이 없는 섹션 — 손대지 않았다(빈 섹션의 갭은 작업 자리다).');
    return { ops, notes, slots: [] };
  }

  /* ⛔갭이 아닌데 슬롯 사이에 낀 것이 없는지 = 시퀀스는 [gap*] (block [gap*])* 모양이다.
     슬롯을 만든다: 앞머리(top) · 블록 사이(inter) · 꼬리(bottom). */
  const slots = [];
  const push = (kind, from, to, prev, next) => {
    slots.push({ kind, gaps: seq.slice(from, to).filter(_isGap), prev, next });
  };
  push('top', 0, blockIdx[0], null, seq[blockIdx[0]]);
  for (let k = 0; k < blockIdx.length - 1; k++) {
    push('inter', blockIdx[k] + 1, blockIdx[k + 1], seq[blockIdx[k]], seq[blockIdx[k + 1]]);
  }
  push('bottom', blockIdx[blockIdx.length - 1] + 1, seq.length, seq[blockIdx[blockIdx.length - 1]], null);

  for (const slot of slots) {
    const target = slot.kind === 'inter' ? gapFor(slot.prev, slot.next) : SECTION_EDGE;
    slot.target = target;

    const manual = slot.gaps.filter((g) => !_isAuto(g));
    if (manual.length) {
      slot.skipped = 'manual';
      notes.push(`${_slotName(slot)} — 수동 갭(${manual.map((g) => g.id).join(', ')})이 있어 «안 건드렸다». 목표는 ${target}px 이었다.`);
      continue;
    }

    if (slot.gaps.length === 0) {
      /* 빠진 자리 — prev 뒤에 넣는다. top 슬롯이면 afterId=null(=맨 앞에 붙인다).
         ⛔★prev 에 id 가 «없으면» afterId 가 null 이 되어 «맨 앞»에 꽂힌다 — 섹션 한복판에
           들어갈 갭이 통째로 위로 튄다. id 없는 블록은 지목할 방법이 없으니 «건너뛰고 말한다». */
      if (slot.prev && !slot.prev.id) {
        slot.skipped = 'no-id';
        notes.push(`${_slotName(slot)} — 앞 블록에 id 가 없어 갭을 넣을 자리를 «지목할 수 없다»(건너뜀).`);
        continue;
      }
      /* ★★«가장자리 갭» — 이웃 블록의 «안쪽 끝»에 이미 갭이 붙어 있으면 넣지 않는다.
         실측(2026-09-07, 진짜 클로드가 만든 상세페이지_0907): add_gap_block 이 넣은 갭이
         «텍스트 프레임 안»에 들어가 있었다(frame[ heading · gap50 ] · row). 시퀀스에는 안 보여서
         여기서 gap80 을 «또» 넣으면 50+80=130px 이중 간격이 된다.
         ⇒ 안 보이는 것을 고칠 순 없지만, «위에 덧쌓지는» 않는다. */
      if ((slot.prev && slot.prev.edgeGapAfter) || (slot.next && slot.next.edgeGapBefore)) {
        slot.skipped = 'edge-gap';
        notes.push(`${_slotName(slot)} — 이웃 블록 «안»에 이미 갭이 붙어 있어 넣지 않았다(이중 간격 방지). 목표는 ${target}px 이었다.`);
        continue;
      }
      ops.push({ op: 'insert', afterId: slot.prev ? slot.prev.id : null, height: target, slot: _slotName(slot) });
      continue;
    }

    /* id 없는 갭도 지목할 수 없다 — set/remove 가 조용히 빗나가는 대신 슬롯을 통째로 둔다. */
    if (slot.gaps.some((g) => !g.id)) {
      slot.skipped = 'no-id';
      notes.push(`${_slotName(slot)} — id 없는 갭이 있어 손대지 않았다(지목할 수 없다).`);
      continue;
    }

    const [keep, ...extra] = slot.gaps;
    if (Math.round(Number(keep.height)) !== target) {
      ops.push({ op: 'set', id: keep.id, height: target, from: Number(keep.height), slot: _slotName(slot) });
    }
    for (const g of extra) {
      ops.push({ op: 'remove', id: g.id, slot: _slotName(slot) });
      notes.push(`${_slotName(slot)} — 겹친 갭 ${g.id}(${g.height}px) 제거(연속 갭 병합 / 고아 갭 정리).`);
    }
  }

  return { ops, notes, slots };
}

function _slotName(slot) {
  if (slot.kind === 'top') return '[섹션 위]';
  if (slot.kind === 'bottom') return '[섹션 아래]';
  return `[${(slot.prev && (slot.prev.type || slot.prev.id)) || '?'} → ${(slot.next && (slot.next.type || slot.next.id)) || '?'}]`;
}

/**
 * ★검사 전용 — 계획을 «시퀀스에» 적용한 결과를 돌려준다(DOM 없이 멱등을 증명하는 자리).
 *   렌더러의 applySpacingOps 와 «같은 순서»로 적용한다: remove → set → insert.
 *   (insert 를 마지막에 하는 이유: afterId 가 가리키는 것이 remove 로 사라지면 안 된다 —
 *    삽입 대상 afterId 는 항상 «블록»이라 remove 대상이 아니지만, 순서를 규약으로 못박는다.)
 * @param {Array} items
 * @param {Array} ops
 * @param {(n:number)=>string} [mkId] 새 갭의 id 생성기
 */
function applyPlanToSequence(items, ops, mkId) {
  let n = 0;
  const newId = mkId || (() => `gb_new${++n}`);
  const out = (Array.isArray(items) ? items : []).map((it) => Object.assign({}, it));

  const removed = new Set(ops.filter((o) => o.op === 'remove').map((o) => o.id));
  let seq = out.filter((it) => !removed.has(it.id));

  for (const o of ops) {
    if (o.op !== 'set') continue;
    const t = seq.find((it) => it.id === o.id);
    if (t) t.height = o.height;
  }

  for (const o of ops) {
    if (o.op !== 'insert') continue;
    const gap = { id: newId(), kind: 'gap', height: o.height, auto: true };
    if (o.afterId == null) { seq = [gap].concat(seq); continue; }
    const i = seq.findIndex((it) => it.id === o.afterId);
    if (i < 0) seq.push(gap); else seq.splice(i + 1, 0, gap);
  }
  return seq;
}

module.exports = {
  SCALE,
  isAutoGap,
  WEIGHT,
  FALLBACK_WEIGHT,
  SECTION_EDGE,
  weightOf,
  weightOfItem,
  gapFor,
  normalizePlan,
  applyPlanToSequence,
  setWarner,
  resetWarnings,
};
