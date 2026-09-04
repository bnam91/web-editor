/**
 * Goditor Claude PM — MCP «토큰 다이어트» 통합 블록 도구 (2026-08-25)
 *
 * 문제(실측): tools/list 가 도구 73개·108,801자 ≈ 34,000토큰이었다. 이건 «매 요청마다»
 *   클라이언트 컨텍스트에 실리는 고정비다. 무료/Pro 짧은 대화(30k)면 100%를 넘겨 사실상
 *   사용 불가, Pro(100k) 34% 잠식. 범인은 add_*_block(26)+update_*_block(25)=95,620자(88%).
 *   ⇒ 요금제가 작은 사용자에게만 터지는 결함이라 개발자 환경에선 안 보인다.
 *
 * 해법: 51개 블록 도구를 «표면»에서 3개로 접는다.
 *   - add_block(type, props)      → 내부적으로 add_<type>_block 핸들러 그대로 호출
 *   - update_block(blockId, props)→ blockId 접두사(또는 type)로 update_<type>_block 디스패치
 *   - get_block_schema(type)      → 그 타입의 «전체» JSON Schema 를 필요할 때만 꺼내 본다
 *   기존 51개는 «별칭»으로 살아 있다(핸들러 그대로, tools/list 에서만 숨김) — 이미 쓰던
 *   대화·문서·docs 가 안 깨진다. 숨김 = 목록 미노출이지 제거가 아니다.
 *
 * 기능 보존의 핵심 = 타입 enum 26종에 «언제 쓰는 블록인지» 한 줄 설명을 유지하는 것.
 *   그래야 스키마를 안 보고도 「비교표가 필요하니 comparison」을 고를 수 있다.
 *   ★설명은 영문으로 쓴다 — 같은 뜻이면 한글은 토큰이 4~5배 든다(한글 1자≈1.1토큰,
 *     영문 1자≈0.26토큰). 이 파일이 «토큰» 파일이라 언어 선택도 설계의 일부다.
 *
 * 자주 쓰는 타입은 스키마를 add_block/update_block 설명에 «인라인»해 왕복 0회로 끝낸다.
 *   선정 근거 = 실제 프로젝트 71개·블록 26,083개 실측 빈도(README 아님, proj.json 전수):
 *     gap 33.4%(70/71 프로젝트) · frame 29.5%(70) · text 26.2%(70) · asset 5.5%(58)
 *     = 네 종이 전체 블록의 94.6%. 여기에 card(카드 그리드 — 상세페이지 «특장점 3열»의
 *     표준 표현이라 과제 빈도가 높다) · table(37/71) · iconify(30/71) · divider(30/71)까지
 *     인라인해도 비용이 작아(각 100~300자) 왕복 절감이 더 크다.
 */

'use strict';

/* ── 블록 타입 레지스트리 ──
 *   type      : 통합 도구가 받는 이름
 *   add/upd   : 실제 핸들러(=기존 도구 이름). null = 그 방향 도구 없음
 *   pfx       : blockId 접두사(update 디스패치 근거)
 *   blurb     : ★«언제 쓰는 블록인가» 한 줄. 스키마 없이 타입을 고르게 하는 유일한 단서.
 */
const BLOCK_TYPES = [
  { type: 'text', add: 'add_text_block', upd: 'update_text_block', pfx: 'tb_',
    blurb: 'any words: heading/body/label/caption/bullet' },
  { type: 'gap', add: 'add_gap_block', upd: 'update_gap_block', pfx: 'gb_',
    blurb: 'vertical spacer between blocks' },
  { type: 'asset', add: 'add_asset_block', upd: 'update_asset_block', pfx: 'ab_',
    blurb: 'image placeholder row (1/2/3-up or text+image)' },
  { type: 'frame', add: 'add_frame_block', upd: 'update_frame_block', pfx: 'ss_',
    blurb: 'container holding other blocks (free layout or full-width band)' },
  { type: 'card', add: 'add_card_block', upd: 'update_card_block', pfx: 'cvb_',
    blurb: 'N cards in a row (image+title+desc) — feature/benefit grid' },
  { type: 'canvas', add: 'add_canvas_block', upd: 'update_canvas_block', pfx: 'cvb_',
    blurb: 'free-placed layers (x/y/w/h shape·image·text) or card grid; Figma import target' },
  { type: 'table', add: 'add_table_block', upd: 'update_table_block', pfx: 'tbl_',
    blurb: 'table of specs/prices (headers + rows)' },
  { type: 'comparison', add: 'add_comparison_block', upd: 'update_comparison_block', pfx: 'cmp_',
    blurb: 'us-vs-them column comparison, one column featured' },
  { type: 'step', add: 'add_step_block', upd: 'update_step_block', pfx: 'stb_',
    blurb: 'numbered steps (how-to / process), 1-10 items' },
  { type: 'iconify', add: 'add_iconify_block', upd: 'update_iconify_block', pfx: 'icn_',
    blurb: 'one Iconify icon by name ("ph:house-bold")' },
  { type: 'icon_circle', add: 'add_icon_circle_block', upd: 'update_icon_circle_block', pfx: 'icb_',
    blurb: 'round icon slot (color or image inside a circle)' },
  { type: 'icon_text', add: 'add_icon_text_block', upd: 'update_icon_text_block', pfx: 'itb_',
    blurb: 'small icon + one line of text (feature bullet)' },
  { type: 'divider', add: 'add_divider_block', upd: 'update_divider_block', pfx: 'dvd_',
    blurb: 'separator line (h/v, solid|dashed|dotted)' },
  { type: 'sticker', add: 'add_sticker_block', upd: 'update_sticker_block', pfx: 'stk_',
    blurb: 'floating badge/sticker over a section (NEW, SALE, arrows, ribbons)' },
  { type: 'speech_bubble', add: 'add_speech_bubble_block', upd: 'update_speech_bubble_block', pfx: 'sb_',
    blurb: 'single speech bubble (a quote / review line)' },
  { type: 'chat', add: 'add_chat_block', upd: 'update_chat_block', pfx: 'chb_',
    blurb: 'KakaoTalk-style chat thread (many bubbles L/R + profiles)' },
  { type: 'label_group', add: 'add_label_group_block', upd: 'update_label_group_block', pfx: 'lg_',
    blurb: 'chip/tag cluster (USP badges, review keywords)' },
  { type: 'laurel', add: 'add_laurel_block', upd: 'update_laurel_block', pfx: 'lrb_',
    blurb: 'laurel wreath award mark + centered lines (grid capable)' },
  { type: 'graph', add: 'add_graph_block', upd: 'update_graph_block', pfx: 'grb_',
    blurb: 'bar/line chart from label+value items' },
  { type: 'shape', add: 'add_shape_block', upd: 'update_shape_block', pfx: 'shp_',
    blurb: 'rect/ellipse/line/arrow/polygon/star' },
  { type: 'vector', add: 'add_vector_block', upd: 'update_vector_block', pfx: 'vb_',
    blurb: 'raw SVG string with fill-color replacement' },
  { type: 'mockup', add: 'add_mockup_block', upd: 'update_mockup_block', pfx: 'mkp_',
    blurb: 'device frame (phone/tablet/laptop/browser) around a screenshot' },
  { type: 'banner', add: 'add_banner_block', upd: 'update_frame_block', pfx: 'ss_',
    blurb: 'preset horizontal banner (frame + auto text/image children)' },
  { type: 'banner02', add: 'add_banner02_block', upd: 'update_banner02_block', pfx: 'bn2_',
    blurb: 'standalone wide banner (label/title/sub + image)' },
  { type: 'liner', add: 'add_liner_block', upd: 'update_liner_block', pfx: 'lnr_',
    blurb: 'text along a curve/arc/wave/circle path' },
  { type: 'gradient', add: 'add_gradient_block', upd: 'update_gradient_block', pfx: 'grad_',
    blurb: 'gradient fade overlay to soften an image/section edge' },
];

// 인라인 스펙 — 자주 쓰는 타입은 «여기서 바로» 쓰게 한다(get_block_schema 왕복 0회).
// 손으로 쓴 이유: 스키마에 min/max 가 안 실린 필드가 많아(검증 코드에만 있음) 자동 축약이
// 오히려 틀린 범위를 알려준다. 아래 값은 핸들러 검증 코드 기준으로 맞췄다.
const INLINE_ADD = [
  'text: content*:str<=500 | type:body|h1|h2|h3|label|caption|bullet(def body) | align:left|center|right | sectionId:sec_',
  'gap: height:num 4-800(def 40) | sectionId',
  'asset: preset:img1|img2|img3|text-img(def img1) | sectionId | scratchId:sp_ (img1 only)',
  'frame: fullWidth:bool(false=free 860x520) | bg:css color(def #fff) | radius:int 0-400 | sectionId',
  'card: cards*:[{title<=500,desc<=2000,imgSrc?}] 1-8 | bgColor | radius:0-40 | textAlign | titleSize:12-60 | descSize:10-40 | sectionId',
  'table: headers:str[] | rows:str[][] (row len = headers len) | showHeader:bool | cellAlign:left|center|right | sectionId',
  'iconify: name*:"prefix:icon" (mdi|material-symbols|heroicons|lucide|ph|tabler|bi|feather|ion|ri) | size:16-512(def 96) | color | sectionId',
  'divider: lineDir:horizontal|vertical | lineStyle:solid|dashed|dotted | lineColor | lineWeight:1-24 | padV:0-120 | padH:0-2000 | lineLength:20-400(vertical) | sectionId',
];
const INLINE_UPD = [
  'text(tb_): content(=text) | color | fontSize:8-2000 | fontWeight:100-900|normal|bold | align',
  'gap(gb_): height:0-400',
  'asset(ab_): imgSrc | width:100-860 | height:200-1600 | borderRadius:0-120 | align | fit:cover|contain | bgColor | overlay/overlayOpacity/overlayPosition | layerName',
  'frame(ss_): bg | bgImage | width/height:20-4000 | paddingY:0-400 | radius:0-400 | bgOpacity:0-1 | borderWidth/Style/Color | alignItems | justifyContent | gap:0-400 | translateX/Y | rotateDeg | flipH/flipV',
  'card(cvb_): title | desc | imgSrc | bgColor | radius | textAlign | titleSize | descSize (multi-card: type:"canvas" + patchCards)',
  'table(tbl_): headers | rows | showHeader | cellAlign | + style fields (get_block_schema)',
  'iconify(icn_): iconName | size | rotation | iconColor | layerName',
  'divider(dvd_): lineColor | lineStyle | lineWeight | lineDir | lineLength | padV | padH',
];

// ── 인자 정규화 ────────────────────────────────────────────────────────────
// ★버그2(실측): fontSize:"120px" 가 거부됐다. 사람도 클로드도 자연히 「120px」이라 쓴다.
//   한 번 거부 = 왕복 1회 + 에러 페이로드 = 토큰 낭비. «에러를 줄이는 게 토큰을 줄이는 길».
//   ⇒ 스키마가 integer/number 라고 선언한 필드는 "120px"·"120"·120 을 모두 받아 정규화한다.
//   범위 밖·숫자 아님은 그대로 거부(검증은 기존 핸들러가 한다 — 여긴 «표기»만 관대하게).
const _NUM_RE = /^\s*(-?\d+(?:\.\d+)?)\s*(?:px|PX|Px)?\s*$/;
function _coerceNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const m = v.match(_NUM_RE);
  return m ? Number(m[1]) : v;
}
// fontWeight 는 스키마에 type 이 없다(100~900 | "normal" | "bold" 혼합). 숫자 문자열만 정규화.
const _EXTRA_NUMERIC = new Set(['fontWeight']);

function _schemaProps(schema) {
  return (schema && schema.inputSchema && schema.inputSchema.properties) || null;
}

/** 키 이름 관대화: 대소문자·언더스코어 차이를 흡수해 «조용한 무시»를 없앤다.
 *  ⚠️버그1 실측: update_block{text:"..."} 이 color/fontSize 만 적용하고 text 는 통째로
 *    무시됐다(스키마 이름은 content). 「스타일은 되는데 글자는 못 고치는」 상태였다. */
function _canon(k) { return String(k).toLowerCase().replace(/[_\-\s]/g, ''); }

function normalizeArgs(schema, args) {
  const props = _schemaProps(schema);
  const out = {};
  const unknown = [];
  if (!args || typeof args !== 'object') return { args: {}, unknown };
  if (!props) return { args: { ...args }, unknown };

  const canonMap = new Map();
  for (const k of Object.keys(props)) canonMap.set(_canon(k), k);
  // text ↔ content 별칭(양방향). 블록마다 «내용» 필드 이름이 갈린다(text-block=content,
  // sticker/speech-bubble=text). 어느 쪽으로 불러도 통하게 한다.
  const SYN = [['text', 'content'], ['content', 'text'], ['label', 'title'], ['msg', 'text'], ['value', 'text']];

  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    let key = null;
    if (Object.prototype.hasOwnProperty.call(props, k)) key = k;
    else if (canonMap.has(_canon(k))) key = canonMap.get(_canon(k));
    else {
      for (const [from, to] of SYN) {
        if (_canon(k) === from && Object.prototype.hasOwnProperty.call(props, to)
            && args[to] === undefined) { key = to; break; }
      }
    }
    if (!key) { unknown.push(k); out[k] = v; continue; } // 모르는 키도 넘긴다(핸들러가 rest 로 받는 경우 대비)
    const t = props[key] && props[key].type;
    const isNum = t === 'integer' || t === 'number'
      || (Array.isArray(t) && (t.includes('integer') || t.includes('number')))
      || _EXTRA_NUMERIC.has(key);
    out[key] = isNum ? _coerceNumber(v) : v;
  }
  return { args: out, unknown };
}

// ── 설치 ───────────────────────────────────────────────────────────────────
/**
 * @param {Map} tools        name → handler
 * @param {Map} toolSchemas  name → {description, inputSchema}
 * @param {Function} registerTool
 * @param {Function} hide    name → tools/list 에서 숨김
 */
function install({ tools, toolSchemas, registerTool, hide }) {
  const byType = new Map();
  for (const d of BLOCK_TYPES) byType.set(d.type, d);

  /* 기존 update_block(=텍스트 블록 편집)을 update_text_block 으로도 등록한다.
     아래에서 update_block 이름을 «통합 도구»로 덮어쓰기 때문에, 원래 핸들러를 잃지 않도록
     먼저 이름을 하나 더 붙여 둔다(핸들러/스키마 그대로 — 동작 동일). */
  const legacyTextUpd = tools.get('update_block');
  const legacyTextSchema = toolSchemas.get('update_block');
  if (legacyTextUpd && !tools.has('update_text_block')) {
    registerTool('update_text_block', legacyTextUpd, legacyTextSchema);
  }

  // 51개 블록 도구를 «관대한 인자»로 감싸고 목록에서 숨긴다(핸들러는 그대로 = 별칭 생존).
  const managed = new Set();
  for (const d of BLOCK_TYPES) {
    for (const n of [d.add, d.upd]) {
      if (!n || managed.has(n) || !tools.has(n)) continue;
      managed.add(n);
      const orig = tools.get(n);
      const schema = toolSchemas.get(n);
      tools.set(n, async (args = {}) => orig(normalizeArgs(schema, args).args));
      hide(n);
    }
  }
  // update_block 은 아래에서 통합 도구로 다시 등록되므로 숨김 대상에서 뺀다.
  hide('update_block', false);

  const typeList = BLOCK_TYPES.map(d => d.type);
  function resolveType(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().toLowerCase()
      .replace(/[\s-]/g, '_')
      .replace(/_?block$/, '');
    // camelCase 로 왔을 때(speechBubble)도 받는다.
    const canon = _canon(s);
    for (const d of BLOCK_TYPES) if (_canon(d.type) === canon) return d;
    return null;
  }

  function mergeProps(props, rest) {
    const p = (props && typeof props === 'object' && !Array.isArray(props)) ? props : {};
    return { ...p, ...rest };
  }

  async function dispatch(toolName, args) {
    const h = tools.get(toolName);
    if (!h) throw new Error(`internal: handler missing for ${toolName}`);
    const res = await h(args);
    return res;
  }

  function warnUnknown(res, toolName, args) {
    try {
      const schema = toolSchemas.get(toolName);
      const { unknown } = normalizeArgs(schema, args);
      if (!unknown.length || !res || typeof res !== 'object') return res;
      const props = _schemaProps(schema);
      res.ignoredProps = unknown;
      res.hint = `unknown prop(s) ${unknown.join(', ')} were NOT applied. valid: `
        + (props ? Object.keys(props).join('|') : '(see get_block_schema)');
    } catch (_) {}
    return res;
  }

  // ── add_block ────────────────────────────────────────────────────────────
  registerTool(
    'add_block',
    async ({ type, props, ...rest } = {}) => {
      const d = resolveType(type);
      if (!d) {
        throw new Error(`unknown block type: ${type == null ? '(missing)' : type}. allowed: ${typeList.join(', ')}`);
      }
      if (!d.add) throw new Error(`type "${d.type}" has no add tool`);
      const args = mergeProps(props, rest);
      const res = await dispatch(d.add, args);
      return warnUnknown(res, d.add, args);
    },
    {
      description:
        'Create ANY block. One tool for all 26 block types (replaces the old add_*_block family). '
        + 'Pass props flat or nested: add_block{type:"text",content:"Hi"} == add_block{type:"text",props:{content:"Hi"}}. '
        + 'Blocks go into the selected section unless sectionId is given. Returns {ok, blockId, ...}. '
        + 'Numbers accept "120", "120px" or 120. If a prop name is unknown it is reported in ignoredProps (nothing silently dropped).\n'
        + 'INLINE SPECS (these 8 types need no schema lookup; * = required):\n  '
        + INLINE_ADD.join('\n  ')
        + '\nFor every other type call get_block_schema(type) first — it returns the full property list.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: typeList,
            description: 'what to build — ' + BLOCK_TYPES.map(d => `${d.type}=${d.blurb}`).join('; ')
          },
          props: {
            type: 'object',
            description: 'block properties. See INLINE SPECS above for the 8 common types; get_block_schema(type) for the rest. May also be passed flat alongside type.',
            additionalProperties: true
          }
        },
        required: ['type']
      }
    }
  );

  // ── update_block ─────────────────────────────────────────────────────────
  // ⚠️이름을 그대로 쓴다 — 기존 대화/문서가 update_block(tb_...) 로 부르고 있다.
  //   tb_ 로 오면 예전 텍스트 편집 핸들러로 그대로 간다(하위호환 100%).
  registerTool(
    'update_block',
    async ({ blockId, type, props, ...rest } = {}) => {
      if (typeof blockId !== 'string' || !blockId) {
        throw new Error('blockId required (get it from get_canvas_state)');
      }
      let d = resolveType(type);
      if (!d) {
        // 접두사 매칭 — 긴 접두사 우선(sb_ vs stb_ 처럼 헷갈리는 쌍 방어).
        const cands = BLOCK_TYPES.filter(x => x.upd && blockId.startsWith(x.pfx))
          .sort((a, b) => b.pfx.length - a.pfx.length);
        // cvb_ 는 card/canvas 공용 → canvas(상위집합)로 보낸다.
        d = cands.find(x => x.type === 'canvas') || cands[0] || null;
      }
      if (!d) {
        throw new Error(`cannot tell the block type of "${blockId}". Pass type explicitly. known id prefixes: `
          + BLOCK_TYPES.filter(x => x.upd).map(x => `${x.pfx}=${x.type}`).join(', '));
      }
      if (!d.upd) throw new Error(`type "${d.type}" has no update tool`);
      const args = { blockId, ...mergeProps(props, rest) };
      const res = await dispatch(d.upd, args);
      return warnUnknown(res, d.upd, args);
    },
    {
      description:
        'Edit an EXISTING block by id. One tool for all block types (replaces the old update_*_block family). '
        + 'The block type is inferred from the blockId prefix, so usually you just pass blockId + the fields to change '
        + '(flat or nested in props). Get blockIds from get_canvas_state. Partial update — only the fields you pass change. '
        + 'Numbers accept "120", "120px" or 120; for text blocks content and text mean the same thing. '
        + 'Unknown prop names are reported back in ignoredProps instead of being silently dropped. '
        + 'Returns USER_BUSY if the user is typing.\n'
        + 'INLINE SPECS (no schema lookup needed):\n  '
        + INLINE_UPD.join('\n  ')
        + '\nOther types: get_block_schema(type). id prefixes: '
        + BLOCK_TYPES.filter(x => x.upd && x.type !== 'banner' && x.type !== 'card').map(x => `${x.pfx}${x.type}`).join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'target block id, e.g. tb_xxx / cvb_xxx / ss_xxx' },
          props: { type: 'object', description: 'fields to change (may also be passed flat)', additionalProperties: true },
          type: { type: 'string', enum: typeList, description: 'optional — only needed when the id prefix is ambiguous' }
        },
        required: ['blockId']
      }
    }
  );

  // ── get_block_schema ─────────────────────────────────────────────────────
  registerTool(
    'get_block_schema',
    async ({ type, op = 'both' } = {}) => {
      const d = resolveType(type);
      if (!d) throw new Error(`unknown block type: ${type == null ? '(missing)' : type}. allowed: ${typeList.join(', ')}`);
      if (!['add', 'update', 'both'].includes(op)) throw new Error(`invalid op: ${op} (add|update|both)`);
      const pick = (name) => {
        if (!name) return null;
        const s = toolSchemas.get(name);
        if (!s) return null;
        return { description: s.description, properties: (s.inputSchema && s.inputSchema.properties) || {}, required: (s.inputSchema && s.inputSchema.required) || [] };
      };
      const out = { ok: true, type: d.type, idPrefix: d.pfx, use: d.blurb };
      if (op === 'add' || op === 'both') out.add = pick(d.add);
      if (op === 'update' || op === 'both') out.update = pick(d.upd);
      return out;
    },
    {
      description:
        'Get the full property schema of one block type — call it before add_block/update_block for a type that is not in the inline specs. '
        + 'op:"add"|"update"|"both"(default). Returns {type, idPrefix, use, add:{description,properties,required}, update:{...}}. '
        + 'This is the deliberate trade: the 26 type schemas are NOT loaded into every request (they cost ~30k tokens), you pull the one you need.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: typeList, description: 'block type (same enum as add_block)' },
          op: { type: 'string', enum: ['add', 'update', 'both'], description: 'which side to return. "add" is half the size.' }
        },
        required: ['type']
      }
    }
  );

  return { BLOCK_TYPES, hiddenCount: managed.size };
}

module.exports = { install, BLOCK_TYPES, normalizeArgs };
