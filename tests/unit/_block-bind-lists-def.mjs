// _block-bind-lists-def.mjs — «bindBlock 걸 종류» 명부 8곳의 ★한 자리 정의 (S3 t4 ⒡ · W2D-01 이관 · 2026-10-21)
//
// ⛔제품 코드는 이 파일을 import 하지 않는다 · 명부끼리 파생하지 않는다(지디: 하나에서 파생 철회).
//   ⇒ 이 파일은 «시험이 재는 기준표»일 뿐이다. js/** 어디에도 이 파일 이름이 나오면 안 된다(자 R0 이 잰다).
//   ⇒ 손 명부를 정본에서 끌어오게 고치는 일(파생)은 이 표의 일이 아니다. 이 표는 «차집합»만 적는다.
//
// 이름 앞 밑줄(_) — 시험 glob(package.json "test": 'tests/unit/*.test.mjs' 'tests/unit/*.test.js')에 안 걸린다.
//   ⇒ 이 파일은 시험으로 돌지 않고, tests/unit/block-bind-lists-ruler.test.mjs 가 import 해서 읽는다.
//
// 표가 적는 것 = 바닥 6acfb9e44e0b35b1d65c56752033907a65c3c688 에서 ★잰 값 그대로다(짐작 아님).
//   knownGaps    = K_BIND − 그 명부  (오늘 빠져 있는 종류 · 까닭)
//   allowedExtra = 그 명부 − K_BIND  (오늘 더 들어 있는 종류 · 까닭)
//   ⇒ 명부를 고쳐 빠짐이 채워지거나 더함이 사라지면 자 R2 가 «표를 줄여라»로 빨개진다(래칫).
//   ⛔CANON 의 radial-block 빠짐은 «알려진 빠짐»으로 적지 않는다 — 그게 이번 결함이다. CANON 은 knownGaps = {}.
//
// 까닭 표기(잠금 시험 tests/unit/block-bind-kinds-lock.test.mjs 와 같은 낱말 · 지디 ㉠ 짐작 금지):
//   covered     = 다른 클래스로 이미 걸림(speech-bubble-block 은 text-block 을 같이 단다 — block-factory.js makeSpeechBubbleBlock)
//   unconfirmed = 그 길로 그 종류가 다시 태어나는지 아직 안 쟀다
//
// 자리는 «줄 번호»가 아니라 anchor 글자로 찾는다(줄이 밀려도 같은 명부를 읽게). lineAtBase 는 사람이 읽으라고 적은 기록일 뿐 단언에 안 쓴다.
// anchor 는 그 파일 안에서 ★정확히 한 번 나와야 한다(자 R0 이 잰다).

// K_BIND — bindBlock 으로 묶여야 하는 종류. 정본 js/block-bind-kinds.js:14-25 의 30종(6acfb9e4) + radial-block = 31.
//   radial-block 을 더한 까닭: js/blocks/radial-block.js:694-708 addRadialBlock 이 만든 블럭에 bindBlock 을 건다
//   (제 바인더를 따로 쓰지 않는다) ⇒ 넣는 기준(만드는 자리가 있고 bindBlock 으로 묶임)에 맞는데 정본에 없다 = 결함.
export const K_BIND = Object.freeze([
  'text-block', 'asset-block', 'gap-block', 'icon-circle-block', 'icon-block', 'table-block', 'label-group-block',
  'graph-block', 'divider-block', 'bridge-block', 'grid-block', 'infocard-block', 'innercard-block', 'modal-block',
  'icon-text-block', 'qa-block', 'shape-block', 'vector-block', 'step-block', 'chat-block', 'laurel-block', 'zoom-block',
  'joker-block', 'canvas-block', 'banner02-block', 'comparison-block', 'mockup-block', 'speech-bubble-block',
  'coupon-block', 'quote-block',
  'radial-block',
]);

// OWN_BINDER — 제 바인더를 따로 쓰는 종류. 정본(CANON)에 들면 안 된다(js/block-bind-kinds.js 머리말 ⛔ · rebindAll 이 따로 묶음).
//   gradient-block = bindGradientSelect · sticker-block = bindStickerSelect · annotation-block = bindAnnotationSelect (js/io/save-load.js:1412-1428).
export const OWN_BINDER = Object.freeze(['gradient-block', 'sticker-block', 'annotation-block']);

const C = 'covered', U = 'unconfirmed';
const W2D02 = 'W2D-02 별건 — 제 바인더(bindGradientSelect) 종류가 bindBlock 손 명부에 들어 있다 · 이번에 뜻을 안 바꾼다(바꾸면 R2 가 표를 고치라고 빨개진다)';

// LISTS — 명부 8곳. mustContain: 'K_BIND' = 위 K_BIND 전부. mustNot: 들면 안 되는 종류(allowedExtra 에 까닭과 함께 적힌 것만 예외).
export const LISTS = Object.freeze([
  {
    name: 'CANON',
    file: 'js/block-bind-kinds.js',
    anchor: 'export const BLOCK_BIND_KINDS = Object.freeze([',
    lineAtBase: 14,
    event: 'A/B 변형 사본(section-variation.js _bindVariantClone) · 템플릿 넣기 section·block 갈래(template-system.js _bindInsertedTree)',
    meaning: '정본 — bindBlock 걸 종류 전부(제 바인더 종류는 뺌)',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: {},
    allowedExtra: {},
  },
  {
    name: 'PASTE',
    file: 'js/editor.js',
    anchor: "const BLOCK_SEL = '.text-block, .asset-block",
    lineAtBase: 1757,
    event: '⌘V 각 갈래 · ⌘D 흐름/섹션 갈래 (_bindPastedEl)',
    meaning: '붙여넣은·복제한 나무 안의 블럭을 다시 묶는다',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: {},
    allowedExtra: { 'gradient-block': W2D02 },
  },
  {
    name: 'PASTE_FREE_FRAME',
    file: 'js/editor.js',
    anchor: "const _ALL = '",
    lineAtBase: 2135,
    event: '자유배치 프레임 안 붙여넣기',
    meaning: '프레임 안에 붙인 사본과 그 안 블럭을 다시 묶는다',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: { 'joker-block': U },
    allowedExtra: { 'gradient-block': W2D02 },
  },
  {
    name: 'DUP_ABS',
    file: 'js/editor.js',
    anchor: "const _ALL_BLOCK_SEL = '",
    lineAtBase: 1487,
    event: '⌘D 절대 위치(absolute) 갈래 — 잠금 시험 FROZEN 에 처음부터 없다',
    meaning: '부모 프레임 안 절대 위치 사본과 그 안 블럭을 다시 묶는다',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: { 'joker-block': U },
    allowedExtra: { 'gradient-block': W2D02 },
  },
  {
    name: 'REBIND_ALL',
    file: 'js/io/save-load.js',
    anchor: "canvasEl.querySelectorAll('.text-block, .asset-block",
    lineAtBase: 1431,
    event: '로드 · 페이지 전환 · undo/redo · 협업 반영 등 (rebindAll)',
    meaning: '캔버스 전체 블럭을 다시 묶는다(제 바인더 셋은 바로 위에서 따로)',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: { 'speech-bubble-block': C },
    allowedExtra: { 'card-block': '옛 꼴 — 만드는 자리 0(js/block-bind-kinds.js 머리말 «card-block 은 뺐다») · 옛 저장본 쪽으로 남은 것으로 보임 · 미확인' },
  },
  {
    name: 'BOOT_STATIC',
    file: 'js/editor.js',
    anchor: "document.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block",
    lineAtBase: 4398,
    event: '모듈 로드 1회(정적 마크업 초기 바인딩)',
    meaning: '문서에 이미 있는 블럭을 처음 묶는다',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: { 'joker-block': U, 'shape-block': U, 'speech-bubble-block': C },
    allowedExtra: {},
  },
  {
    name: 'NEW_SECTION',
    file: 'js/block-factory.js',
    anchor: "sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block",
    lineAtBase: 1570,
    event: '새 섹션 만들기(섹션 바인딩)',
    meaning: '새 섹션 안 블럭을 묶는다',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: {
      'banner02-block': U, 'canvas-block': U, 'comparison-block': U, 'icon-block': U, 'joker-block': U,
      'mockup-block': U, 'modal-block': U, 'speech-bubble-block': C,
    },
    allowedExtra: {},
  },
  {
    name: 'FRAME_TEMPLATE',
    file: 'js/panels/template-system.js',
    anchor: "ss.querySelectorAll('.text-block, .asset-block",
    lineAtBase: 571,
    event: '프레임(subsection) 템플릿 넣기 — rebindAll 비경유',
    meaning: '넣은 프레임 안 블럭을 묶는다',
    mustContain: 'K_BIND',
    mustNot: OWN_BINDER,
    knownGaps: {
      'banner02-block': U, 'canvas-block': U, 'chat-block': U, 'comparison-block': U, 'laurel-block': U,
      'mockup-block': U, 'speech-bubble-block': C, 'step-block': U, 'vector-block': U, 'zoom-block': U,
    },
    allowedExtra: {},
  },
]);

// NOT_BIND — 자 R3 목록 맞추기에서 «bindBlock 명부가 아니다»로 뺀 자리(까닭과 함께).
//   R3 꼴 = js/** 문자열 하나에 서로 다른 .xxx-block 이 10종 이상 · 그 문자열을 둘러싼 함수(없으면 그 최상위 문장)가 bindBlock 을 부름.
//   6acfb9e4 에서 그 꼴에 걸린 자리 = 손 명부 7곳 + 아래 1곳(잰 것 · 8곳).
export const NOT_BIND = Object.freeze([
  {
    file: 'js/block-drag.js',
    anchor: "const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .icon-block",
    lineAtBase: 3165,
    reason: '프레임 drop 처리기의 «무엇을 떨궜나» 가르기·자리 잡기용(matches · querySelectorAll → makeAbsolute 등) — 같은 함수의 bindBlock(:3241)은 이 명부가 아니라 따로 찾은 text-block 하나에 건다',
  },
]);
