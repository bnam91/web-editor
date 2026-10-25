import { canvasEl, state } from '../globals.js';
import { inlineGoyaAssetsInJSON, makeElectronAssetReader } from './goya-asset-inline.js';
import { NOT_HIDDEN_VARIATION } from '../variation-visibility.js';
import { getTextGradient, hasPaintingTextEffect, textShadowSource } from '../props/text-block-color.js';
import { parseGradient } from '../props/gradient-model.js';
import { readRedact, redactPx, normalizeRedact } from '../effects/image-redact.js';   /* ★이미지 블러(Redact, 1012t1 C1) */
import { collabParams, collabSlotSrc } from '../blocks/logo-collab.js';   /* ★1013t2A2 로고 콜라보 */
import { COLLAB_GLYPH } from '../blocks/logo-collab-model.js';

const CANVAS_W = 860;

/* ── SHAPE → Figma JSON (0919 QA) ────────────────────────────────────────────
 * ⑴ 크기: 도형 크기는 «래퍼 프레임»(dataset.width/height, 캔버스 실측)에 있고 .shape-block 자체엔 style.width 가 없다
 *    → 예전엔 늘 75×75 로 나갔다(200×200 가림막이 Figma 에선 14% 만 덮어 밑 콘텐츠 노출). 실측 폭 > 래퍼 dataset > style.
 * ⑵ 그라데이션: shapeColor 에 CSS 그라데이션 문자열이 그대로 실려 렌더러가 SVG color/fill 에 넣고 → 검은 사각형.
 *    color = 마지막 단색(폴백), gradientDef = 캔버스가 그리는 «바로 그» SVG <linearGradient|radialGradient>(끝점이 도형
 *    밖인 스탑 재매핑 포함) — 렌더러가 도형 SVG 에 그대로 넣는다(캔버스와 같은 수식).
 * ⑶ 가림막: redact 표시 + 불투명 덮개 색. ⛔반투명·원본 노출 금지(프라이버시). */
const _REDACT_COVER = '#4a4a4a';   // 모자이크 안전실패 색과 같은 회색(캔버스 폴백과 같다)
/* ★이미지 블러(Redact, 1012t1 C1) — 블러는 Figma 로 못 옮긴다(LAYER_BLUR 로 보내면 원본이 피그마 파일에 실려 효과를 끄면 보인다).
 *   ⇒ 도형 가림막과 같은 원칙: 원본 src 를 «싣지 않고» 불투명 덮개 색을 싣는다. 렌더러는 block.redact 갈래에서 그 색으로 칠한다.
 *   켜져 있지 않으면 null(필드 자체를 안 붙인다 — 옛 JSON 바이트 그대로). */
function _imageRedactField(el) {
  const v = readRedact(el);
  return v > 0 ? { intensity: v, blurPx: redactPx(v), cover: _REDACT_COVER } : null;
}
/* ★1013t2A2 로고 «콜라보» — [로고1 × 로고2 (× 로고3)] 를 «자유 프레임» 하나로 싸서 낸다(G14 icon-circle 선례 · 렌더러 무변경).
 *   좌표는 «모델»(collabGeometry)에서 — DOM 측정 아님(줌 무관). 칸1 = 기존 이미지 블록 출력(블러 포함) · 칸2·3 = 그 칸 img src.
 *   × = text 블록(키는 위 text 갈래와 같다) · 색·글꼴은 라이브 .asset-collab-x 의 computed 값(var() 를 푼 값).
 *   ⛔꺼짐(data-collab 없음)이면 이 함수를 안 부른다 — 옛 type:'image' 바이트 그대로. */
function _assetCollabFigmaFrame(el, slot1) {
  const p = collabParams(el);
  const H = Math.round(p.H), S = p.S;
  const live = (el.id && document.getElementById(el.id)) || el;
  const xEl = live.querySelector(':scope > .asset-collab > .asset-collab-x');
  const cs = xEl ? getComputedStyle(xEl) : null;
  const radius = parseFloat(el.style.borderRadius) || 0;
  const children = [{ x: p.geo.slots[0], y: 0, w: S, block: { ...slot1, height: H, sizePct: 100, padX: 0 } }];
  for (let k = 2; k <= p.n; k++) {
    const xLeft = p.geo.xs[k - 2];
    children.push({ x: Math.round(xLeft), y: Math.round((H - p.x) / 2), w: p.x, block: {
      type: 'text', variant: 'body', id: (el.id || 'ab') + '__x' + (k - 1),
      content: COLLAB_GLYPH, height: p.x, liveWidth: p.x,
      style: {
        fontSize: (cs && cs.fontSize) || (p.x + 'px'),
        fontWeight: (cs && cs.fontWeight) || '400',
        fontFamily: (cs && cs.fontFamily) || '',
        color: (cs && cs.color) || p.color || '#555555',
        textAlign: 'center',
        lineHeight: (cs && cs.lineHeight) || (p.x + 'px'),
        letterSpacing: '', textShadow: '',
      },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    } });
    children.push({ x: Math.round(p.geo.slots[k - 1]), y: 0, w: S, block: {
      type: 'image', id: (el.id || 'ab') + '__logo' + k, height: H, sizePct: 100, padX: 0,
      style: { borderRadius: radius }, src: collabSlotSrc(live, k) || collabSlotSrc(el, k) || null,
      overlayOn: false, overlayText: '', overlayColor: '', overlayBg: 0,
    } });
  }
  return { type: 'frame', id: (el.id || slot1.id) + '__collab', width: Math.round(p.geo.width), height: H, bg: '', radius: 0, free: true, children };
}
function _shapeFigmaBlock(el) {
  const live = (el.id && document.getElementById(el.id)) || el;
  const frame = live.parentElement && live.parentElement.classList?.contains('frame-block') ? live.parentElement : null;
  const pick = (...vals) => { for (const v of vals) { const n = parseFloat(v); if (Number.isFinite(n) && n > 0) return n; } return 75; };
  const width  = Math.round(pick(live.offsetWidth,  frame && frame.dataset.width,  frame && frame.style.width,  el.style.width));
  const height = Math.round(pick(live.offsetHeight, frame && frame.dataset.height, frame && frame.style.height, el.style.height));
  const raw = el.dataset.shapeColor || '#cccccc';
  const isGrad = /gradient\s*\(/i.test(raw);
  const svg = el.querySelector('svg.shape-svg') || el.querySelector('svg');
  const lastSolid = (svg && svg.style && svg.style.color && !/currentcolor/i.test(svg.style.color)) ? svg.style.color : '';
  let color = isGrad ? (lastSolid || '#cccccc') : raw;
  let gradientDef = '';
  if (isGrad && svg) {
    const def = svg.querySelector('linearGradient, radialGradient');
    if (def) {
      const c = def.cloneNode(true);
      c.setAttribute('id', 'g');
      gradientDef = new XMLSerializer().serializeToString(c).replace(/ xmlns="[^"]*"/g, '');
    }
  }
  const redact = el.dataset.shapeRedact === 'true';
  /* ══ ★★«안 재고 있다»를 ★기록으로 남긴다 (t1bstar 2026-10-10 · 1010t1b ⑦ · 지디 판정) ══
   * ★★★별의 ★`starCount`·`starGap`·`starInner`(＋1010t1b3 의 ★`starRating`)가 ★★여기서 ★0건이다.
   *   ⇒ ★★별 ★5개·간격·통통함·평점이 ★★피그마로는 ★★«별 ★하나 ＋ ★색 ★하나»로 ★간다.
   * ★★이것은 ★★1010t1b 가 ★만든 흠이 ★아니다 — ★★오늘 ★이미 그렇다(★실측: 아래 out 의 필드 전수에 ★없다).
   *   ★왜 적나 — ★★«표의 ★빈칸은 ★«없는 경우»가 ★아니라 ★«안 잰 경우»다».
   *     ⛔주석이 ★없으면 ★다음 사람이 ★이 자리를 ★«별은 다 된다»로 ★읽는다.
   * ★★그리고 ★주석 ★하나로는 ★안 고쳐진다 ⇒ ★★별건 ★티켓으로 ★올렸다(지디가 TICKETS 에 적는다).
   * ★★왜 ★이 묶음에서 ★안 고쳤나 — ★1010t1b 는 ★«우측패널·캔버스»의 일이고 ★★내보내기는 ★다른 축이다.
   *   ⇒ ★범위를 ★넓히지 ★않았다(지디 판정 ⑦). ⛔「고쳤다」로 ★읽지 ★마라.
   * ★참고 — ★★`js/io/export-html.js` 는 ★다르다: ★캔버스를 ★cloneNode 해 ★innerHTML 을 뱉으므로
   *   ★★살아있는 DOM 이 ★그대로 나간다 ⇒ ★별 ★N개·간격·평점 칠이 ★★HTML 에서는 ★살아남는다.
   *   ★★이 둘의 ★갈림이 ★★여기 적힌 ★까닭이다. (★이건 ★소스 독해다 — ★내보내기를 ★돌려 본 것이 ★아니다) */
  const out = {
    type: 'shape', id: el.id || '',
    shapeType: el.dataset.shapeType || 'rect',
    color,
    // ★0 보존(0918 기본 테두리 0) — `|| 1` 이면 0이 1이 돼 피그마에 1px 테두리가 생긴다. 누락/NaN 만 1.
    strokeWidth: (() => { const n = parseInt(el.dataset.shapeStrokeWidth); return Number.isFinite(n) ? n : 1; })(),
    rotation: parseInt(el.dataset.shapeRotation) || 0,
    width, height,
  };
  if (gradientDef && !redact) out.gradientDef = gradientDef;
  /* ★1013t2A1 원 «갯수·간격·원마다 색·이너 그림자» — 켜진 것만 싣는다(꺼져 있으면 필드 0 = 옛 JSON 바이트 그대로).
     ⚠️렌더러(sangpe_to_figma)는 아직 이 필드를 안 읽는다 ⇒ 피그마에는 «원 1개 + 색 하나»로 간다(별과 같은 기존 흠).
     ⛔「피그마도 된다」로 읽지 마라 — 렌더러를 고칠지는 별건 판정이다. (그래프 G2 선례와 같은 꼴) */
  if ((el.dataset.shapeType || '') === 'ellipse') {
    const ec = parseInt(el.dataset.ellipseCount, 10);
    if (Number.isFinite(ec) && ec > 1) {
      out.ellipseCount = ec;
      if (el.dataset.ellipseGap !== undefined && el.dataset.ellipseGap !== '') out.ellipseGap = Number(el.dataset.ellipseGap);
      if (el.dataset.ellipseColors) out.ellipseColors = String(el.dataset.ellipseColors).split(',').map(v => v.trim() || null);
    }
    const es = parseInt(el.dataset.ellipseShadow, 10);
    if (Number.isFinite(es) && es > 0) out.innerShadow = { strength: es };
  }
  if (redact) {
    out.redact = { mode: el.dataset.shapeRedactMode || 'blur' };
    out.color = _REDACT_COVER;   // 불투명 덮개 — 흐림/모자이크 비트맵은 Figma 로 못 옮긴다(가리기가 우선)
  }
  return out;
}

async function exportFigmaJSON() {
  /* ★E157 공용 대기(whenGridRatiosSettled · grid-block.js) — 칸 배경 비율이 서고 그 그리드가 다시 그려진 «뒤»에 찍는다(틀린 행 높이가 산출물로 굳지 않게).
     반환 none(기다릴 것 없음) / settled / cap(상한 — 함수가 수·주소를 찍음). ⛔그 결과로 막지 않는다 — 찍기는 그대로 간다. */
  await window.whenGridRatiosSettled?.();
  // 현재 페이지를 pages 배열에 반영
  window.flushCurrentPage();

  const parser = new DOMParser();

  function parseHeight(el) {
    return parseFloat(el.style.height) || 0;
  }

  function parseBlock(el, ps) {
    // gap-block
    if (el.classList.contains('gap-block')) {
      return { type: 'gap', height: parseHeight(el) || 50 };
    }

    // text-block
    if (el.classList.contains('text-block')) {
      const inner = el.querySelector('.tb-h1, .tb-h2, .tb-body, .tb-caption, .tb-label');
      if (!inner) return null;
      const cls = inner.className;
      const text = inner.textContent.trim();

      // letterSpacing: inline style px 문자열 → 숫자
      let letterSpacing;
      const lsRaw = inner.style.letterSpacing;
      if (lsRaw && lsRaw !== 'normal') {
        const lsVal = parseFloat(lsRaw);
        if (!isNaN(lsVal)) letterSpacing = lsVal;
      }

      // padding (pageSettings.padX fallback)
      const padX = ps ? (ps.padX || 0) : 0;
      const padding = {
        top:    parseFloat(el.style.paddingTop)    || 0,
        right:  parseFloat(el.style.paddingRight)  || padX,
        bottom: parseFloat(el.style.paddingBottom) || 0,
        left:   parseFloat(el.style.paddingLeft)   || padX,
      };

      const base = {
        text,
        padding,
        ...(letterSpacing !== undefined ? { letterSpacing } : {}),
      };

      if (cls.includes('tb-h1')) return { type: 'heading', tag: 'h1', ...base };
      if (cls.includes('tb-h2')) return { type: 'heading', tag: 'h2', ...base };
      if (cls.includes('tb-body'))    return { type: 'body',    ...base };
      if (cls.includes('tb-caption')) return { type: 'caption', ...base };
      if (cls.includes('tb-label'))   return { type: 'label',   ...base };
      return { type: 'body', ...base };
    }

    // asset-block
    if (el.classList.contains('asset-block')) {
      const h = parseHeight(el) || 400;
      const src = el.dataset.imgSrc || null;
      const padX = ps ? (ps.padX || 0) : 0;
      const padding = {
        top:    parseFloat(el.style.paddingTop)    || 0,
        right:  parseFloat(el.style.paddingRight)  || padX,
        bottom: parseFloat(el.style.paddingBottom) || 0,
        left:   parseFloat(el.style.paddingLeft)   || padX,
      };
      // col width는 parseCol에서 주입
      const redact = _imageRedactField(el);
      if (redact) return { type: 'asset', src: null, height: h, padding, redact };   // ★블러: 원본 src 를 싣지 않는다(1012t1 C1)
      return { type: 'asset', src, height: h, padding };
    }

    return null;
  }

  function parseCol(colEl, ps) {
    const width = parseInt(colEl.dataset.width) || 100;
    const blocks = [];
    colEl.querySelectorAll(':scope > .text-block, :scope > .asset-block, :scope > .gap-block').forEach(b => {
      const block = parseBlock(b, ps);
      if (block) {
        if (block.type === 'asset') block.width = width;
        blocks.push(block);
      }
    });
    return { width, blocks };
  }

  function parseRow(rowEl, ps) {
    const layout = rowEl.dataset.layout || 'stack';
    const cols = [];
    rowEl.querySelectorAll(':scope > .col').forEach(c => cols.push(parseCol(c, ps)));
    return { layout, cols };
  }

  function parseSection(secEl, idx, ps) {
    const inner = secEl.querySelector('.section-inner');
    const rows = [];
    if (inner) {
      // ★.section-merged-part 는 «투명하게» 통과 — 안 그러면 합친 아래 몸이 통째로 빠진다
      const walk = (child) => {
        if (child.classList.contains('section-merged-part')) {
          [...child.children].forEach(walk);
        } else if (child.classList.contains('row')) {
          rows.push(parseRow(child, ps));
        } else if (child.classList.contains('group-block')) {
          child.querySelectorAll(':scope > .group-inner > .row').forEach(r => rows.push(parseRow(r, ps)));
        } else if (child.classList.contains('gap-block')) {
          const h = parseFloat(child.style.height) || 50;
          rows.push({ layout: 'stack', cols: [{ width: 100, blocks: [{ type: 'gap', height: h }] }] });
        }
      };
      [...inner.children].forEach(walk);
    }
    // 빈 blocks 배열 rows 제거
    const filteredRows = rows.filter(r => r.cols.some(c => c.blocks.length > 0));

    const name = secEl.dataset.name || secEl._name
      || secEl.querySelector('.section-label')?.textContent?.trim()
      || `Section ${idx + 1}`;
    const bg = secEl.style.backgroundColor || secEl.style.background || '';

    return { index: idx + 1, name, bg, rows: filteredRows };
  }

  function parsePage(page) {
    const doc = parser.parseFromString(
      `<div id="canvas">${page.canvas || ''}</div>`, 'text/html'
    );
    const canvasDiv = doc.getElementById('canvas');
    const ps = page.pageSettings || {};
    const sections = [];
    /* ★안 쓰는 A/B 시안은 «배송본에 안 싣는다» — 숨은 시안까지 실어 「Section 01」이 두 번 나가던 자리
       (2026-09-09 실측). 술어는 js/variation-visibility.js «한 곳»이다.
     ⚠️저장 경로가 아니다 — 시안은 프로젝트 저장본에 그대로 남는다. */
    canvasDiv.querySelectorAll(`:scope > .section-block:not([data-ghost])${NOT_HIDDEN_VARIATION}`).forEach((sec, i) => {
      sections.push(parseSection(sec, i, ps));
    });
    return {
      name:     page.name  || 'Page',
      label:    page.label || '',
      bg:       (ps.bg)    || '#ffffff',
      sections,
    };
  }

  const exportPages = state.pages.map(p => parsePage(p));

  const output = {
    source:  'sangpe-wizard',
    version: 1,
    pages:   exportPages,
  };

  // goya-asset:// → data URI 재인라인 (앱 밖에서는 커스텀 스킴을 못 읽는다)
  const { unresolvedAssets } = await inlineGoyaAssetsInJSON(output, makeElectronAssetReader());
  if (unresolvedAssets) console.warn('[export-figma-json] 재인라인 실패 에셋', unresolvedAssets, '건 — 원본 URL 유지');

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sangpe_export.json';
  a.click();
  URL.revokeObjectURL(a.href);
}


function getTextWithLineBreaks(el) {
  if (!el) return '';
  function extract(node) {
    if (node.nodeType === 3) return node.textContent;   // 텍스트 노드
    if (node.nodeName === 'BR') return '\n';
    const isBlock = node.nodeName === 'DIV' || node.nodeName === 'P';
    const inner = Array.from(node.childNodes).map(extract).join('');
    if (isBlock && node.previousSibling) return '\n' + inner;
    return inner;
  }
  return extract(el).trim();
}

function buildFigmaExportJSON(selectedIds, nodeMap) {
  // sangpe_to_figma.mjs 가 기대하는 포맷으로 빌드
  // sections[].blocks[] — gap / text / image / { columns:[{width,blocks}] }

  // CSS 클래스 기본값 (editor.css 기준)
  const TEXT_DEFAULTS = {
    'tb-h1':      { fontSize: 104, fontWeight: 700, color: '#111111', lineHeight: 1.1,  letterSpacing: -2.08 },
    'tb-h2':      { fontSize: 72,  fontWeight: 600, color: '#111111', lineHeight: 1.15, letterSpacing: 0 },
    'tb-h3':      { fontSize: 52,  fontWeight: 600, color: '#111111', lineHeight: 1.2,  letterSpacing: 0 },
    'tb-body':    { fontSize: 36,  fontWeight: 400, color: '#111111', lineHeight: 1.6,  letterSpacing: 0 },
    'tb-caption': { fontSize: 26,  fontWeight: 400, color: '#111111', lineHeight: 1.6,  letterSpacing: 0.26 },
    'tb-label':   { fontSize: 26,  fontWeight: 700, color: '#111111', lineHeight: 1.4,  letterSpacing: 1.56 },
  };

  function _getTextStyle(inner, el) {
    const cls = [...inner.classList].find(c => TEXT_DEFAULTS[c]) || 'tb-body';
    const def = TEXT_DEFAULTS[cls] || TEXT_DEFAULTS['tb-body'];

    // 인라인 스타일 우선, 없으면 첫 번째 자식 div의 font-size, 없으면 CSS 기본값
    const firstChildFs = (() => {
      const fc = inner.querySelector('div[style*="font-size"]');
      return fc ? parseFloat(fc.style.fontSize) : NaN;
    })();
    const fontSize   = parseFloat(inner.style.fontSize)   || firstChildFs || def.fontSize;
    const fontWeight = parseInt(inner.style.fontWeight)   || def.fontWeight;
    const lsRaw      = parseFloat(inner.style.letterSpacing);
    const letterSpacing = isNaN(lsRaw) ? def.letterSpacing : lsRaw;

    // color: inline → computed (live DOM) → 기본값
    let color = inner.style.color;
    if (!color) {
      try { color = window.getComputedStyle(inner).color; } catch {}
    }
    if (!color || color.startsWith('var(')) color = def.color;

    // lineHeight
    let lineHeight = def.lineHeight;
    if (inner.style.lineHeight) {
      const lh = parseFloat(inner.style.lineHeight);
      if (!isNaN(lh)) lineHeight = lh > 10 ? lh / fontSize : lh;
    }

    const textAlign = el.style.textAlign || inner.style.textAlign || 'left';

    // fontFamily: 인라인 우선, 없으면 CSS 기본값
    let fontFamily = inner.style.fontFamily;
    if (!fontFamily) {
      try { fontFamily = window.getComputedStyle(inner).fontFamily; } catch {}
    }
    fontFamily = (fontFamily || 'Noto Sans KR').replace(/["']/g, '').split(',')[0].trim();

    // text-effect(tfx-neon 등) 글로우 — Figma는 text-shadow 미지원 → live computed text-shadow를 캡처해 sangpe가 DROP_SHADOW로 적용(회차12 chart "92,000대" 크림글로우 fix)
    let textShadow = '';
    try {
      const _li = (el.id && document.getElementById(el.id)?.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label')) || inner;
      // 0919r3 textshadow: 그라데이션 글자는 .tgs 가 computed text-shadow 를 none 으로 가리고 drop-shadow 로 그린다
      //   → 원본 목록(--tgs-src)을 보낸다(안 그러면 Figma 에서 그림자가 사라진다).
      const ts = textShadowSource(_li);
      if (ts && ts !== 'none') textShadow = ts;
    } catch {}

    return { fontSize, fontWeight, color, lineHeight, letterSpacing, textAlign, fontFamily, textShadow };
  }

  function _block(el, ps) {
    if (el.classList.contains('gap-block')) {
      return { type: 'gap', height: parseFloat(el.style.height) || 50 };
    }
    // liner-block(곡선텍스트 SVG)은 text-block 클래스도 갖지만 tb-inner가 없어
    // 여기서 null 드롭됐었음 → liner-block 핸들러(아래)로 흘려보낸다.
    // ★그리고 그 «같은 병»이 speech-bubble-block 에도 있었다 (2026-09-09 실측):
    //   class="text-block speech-bubble-block" 인데 안쪽이 .tb-bubble/.tb-sender-name 이라
    //   tb-* 명부에 안 걸려 `return null` 로 «조용히» 통째로 사라졌다.
    //   ⇒ 「tb-* 가 있을 때만 텍스트로 다룬다」를 «조건»으로 올린다. 없으면 아래 갈래들을
    //     지나 GENERIC 폴백이 받는다(높이·배경·내부 텍스트/아이콘 보존). ⛔드롭보다 낫다.
    //     명부(tb-*)를 늘려 막지 않는 이유가 그거다 — 다음 변종에서 또 샌다.
    if (el.classList.contains('text-block') && !el.classList.contains('liner-block')
        && el.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label')) {
      const inner = el.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label');
      const padX = ps?.padX || 0;
      const variant = inner.classList.contains('tb-h1') ? 'heading'
        : inner.classList.contains('tb-h2') ? 'subheading'
        : inner.classList.contains('tb-h3') ? 'subheading3'
        : inner.classList.contains('tb-body') ? 'body'
        : inner.classList.contains('tb-caption') ? 'caption' : 'label';
      const style = _getTextStyle(inner, el);

      // label: 개별 라벨의 라이브 computed-style(bg/색)을 우선 — 전역 ps.labelBg/labelColor 하드코딩은 흰bg/검은글자 라벨을 뒤집음(회차12 tja5ovp).
      // 라이브 못 찾으면(클론DOM·var() 미해석) ps 폴백.
      const _liveLabel = (variant === 'label' && el.id) ? (document.getElementById(el.id)?.querySelector('.tb-label') || null) : null;
      const _liveLabelBg = _liveLabel ? getComputedStyle(_liveLabel).backgroundColor : '';
      const _liveLabelColor = _liveLabel ? getComputedStyle(_liveLabel).color : '';
      const _labelBgOpaque = _liveLabelBg && _liveLabelBg !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(_liveLabelBg);
      const textColor = variant === 'label'
        ? (_liveLabelColor || ps?.labelColor || '#ffffff')
        : style.color;

      const block = {
        type: 'text',
        variant,
        id: el.id || ('tb_' + Math.random().toString(36).slice(2,8)),
        content: getTextWithLineBreaks(inner),
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0),  // 라이브 DOM 실측 높이
        // 라이브 DOM 실측 폭 — sangpe wrap폭 정확도용(padding 폴백 72가 실제 인셋과 다를 때 텍스트 잘림 방지, 회차12 u2o2f04). 시각폭/프레임은 불변.
        liveWidth: Math.round((el.id && document.getElementById(el.id)?.offsetWidth) || el.offsetWidth || 0),
        style: {
          fontSize:      style.fontSize,
          fontWeight:    style.fontWeight,
          fontFamily:    style.fontFamily,
          color:         textColor,
          textAlign:     style.textAlign,
          lineHeight:    style.lineHeight,
          letterSpacing: style.letterSpacing,
          textShadow:    style.textShadow || '',
        },
        padding: {
          top:    parseFloat(el.style.paddingTop)    || 0,
          right:  parseFloat(el.style.paddingRight)  || padX,
          bottom: parseFloat(el.style.paddingBottom) || 0,
          left:   parseFloat(el.style.paddingLeft)   || padX,
        },
      };

      // 0918r2 textgrad: 글자 그라데이션 — style.fill 에 모델을 싣는다(sangpe_to_figma 가 set_gradient 로 칠함).
      //   style.color 는 첫 스탑 단색 그대로 둔다(하위 호환 · 그라데이션 실패 시 폴백).
      //   ★인라인 color 는 «마지막 단색» 저장소라 폴백 style.color 는 첫 스탑으로 덮는다(캔버스에 보이는 색에 가깝게).
      //   ★칠하는 글자 효과(메탈릭 등)가 걸려 있으면 캔버스에선 효과가 이긴다 → 그라데이션을 싣지 않는다(캔버스=Figma).
      if (variant !== 'label' && !hasPaintingTextEffect(inner)) {
        const _tg = getTextGradient(inner);
        if (_tg) {
          block.style.fill = { kind: 'gradient', type: _tg.type, angle: _tg.angle, stops: _tg.stops };
          const _fh = [..._tg.stops].sort((a, b) => a.offset - b.offset)[0]?.color || '';
          const _m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(_fh);
          if (_m) block.style.color = `rgb(${parseInt(_m[1], 16)}, ${parseInt(_m[2], 16)}, ${parseInt(_m[3], 16)})`;
        }
      }

      // label: 배경 박스 정보 추가
      if (variant === 'label') {
        // 개별 라벨의 inline borderRadius 우선, 없으면 프리셋 fallback
        const inlineRadius = parseFloat(inner.style.borderRadius);
        // 라이브 tb-label의 실제 computed 패딩 우선(프리셋마다 다름 — 하드코딩 36/11은 알약형 27 패딩을 못 맞춰 박스가 짧아짐, 회차12 thhvp4d)
        const _lcs = _liveLabel ? getComputedStyle(_liveLabel) : null;
        const _padH = _lcs ? Math.round(parseFloat(_lcs.paddingLeft)) : NaN;
        const _padV = _lcs ? Math.round(parseFloat(_lcs.paddingTop))  : NaN;
        block.labelBox = {
          bg:       _labelBgOpaque ? _liveLabelBg : (ps?.labelBg || '#111111'),
          radius:   !isNaN(inlineRadius) ? inlineRadius : (ps?.labelRadius || 8),
          paddingH: !isNaN(_padH) ? _padH : 36,
          paddingV: !isNaN(_padV) ? _padV : 11,
        };
      }

      return block;
    }
    if (el.classList.contains('label-group-block')) {
      const items = [];
      el.querySelectorAll('.label-item').forEach(item => {
        const span = item.querySelector('.label-item-text');
        items.push({
          text:   span?.textContent.trim() || 'Label',
          bg:     item.dataset.bg    || '#111111',
          color:  item.dataset.color || '#ffffff',
          radius: parseInt(item.dataset.radius) || 40,
        });
      });
      const gap   = parseInt(el.style.gap) || 10;
      const jc    = el.style.justifyContent || 'flex-start';
      const align = jc === 'center' ? 'center' : jc === 'flex-end' ? 'right' : 'left';
      const rowGap = parseInt(el.style.rowGap) || gap;
      return {
        type:   'label-group',
        id:     el.id || ('lg_' + Math.random().toString(36).slice(2, 8)),
        items,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0),
        style:  { gap, rowGap, align, paddingX: parseInt(el.style.paddingLeft) || 20 },
      };
    }
    if (el.classList.contains('asset-block')) {
      // dataset.size 우선, 없으면 실제 렌더 폭/섹션폭으로 산출(중앙정렬 가정) — 풀블리드 오인 방지.
      // ⚠️ offsetWidth는 detached/레이아웃前엔 0 → 인라인 style.width로 폴백(클론DOM·리로드직후 안전).
      let sizePct = parseInt(el.dataset.size);
      if (!sizePct) {
        const secEl = el.closest('.section-block');
        const renderedW = el.offsetWidth || parseFloat(el.style.width) || 0;
        const secW = (secEl && secEl.offsetWidth) || parseFloat(secEl && secEl.style.width) || 860;
        sizePct = (renderedW > 0 && secW > 0)
          ? Math.max(1, Math.min(100, Math.round(renderedW / secW * 100)))
          : 100;
      }
      // (가) 설계: effective usePadx — dataset 명시값 우선, 미설정이면 글로벌 디폴트
      const usePadx   = typeof window.getEffectiveUsePadx === 'function'
        ? window.getEffectiveUsePadx(el)
        : (el.dataset.usePadx === 'true' ? true : (el.dataset.usePadx === 'false' ? false : true));
      const padX      = usePadx ? 0 : (ps?.padX || 0); // 패딩 제외 ON → full width (padX=0)
      const overlayOn = el.dataset.overlay === 'true';
      const ovEl      = el.querySelector('.asset-overlay');
      const overlayText    = overlayOn ? (ovEl?.innerText || '') : '';
      const overlayColor   = overlayOn ? (ovEl?.style.color || '#ffffff') : '';
      const overlayBg      = overlayOn ? parseFloat(ovEl?.dataset.ovOpacity ?? '0.35') : 0;
      const _assetOut = {
        type: 'image',
        id: el.id || ('ab_' + Math.random().toString(36).slice(2, 8)),
        height: parseFloat(el.style.height) || 780,
        sizePct,
        padX,
        style: { borderRadius: parseFloat(el.style.borderRadius) || 0 },
        src: el.dataset.imgSrc || null,
        overlayOn,
        overlayText,
        overlayColor,
        overlayBg,
        ...(() => {   // ★블러(Redact, 1012t1 C1): 원본 src 를 덮개로 바꾼다 — 원본 바이트가 앱 밖으로 안 나간다
          const redact = _imageRedactField(el);
          return redact ? { src: null, redact } : {};
        })(),
      };
      return el.dataset.collab ? _assetCollabFigmaFrame(el, _assetOut) : _assetOut;   // ★1013t2A2
    }
    if (el.classList.contains('icon-circle-block')) {
      const size    = parseInt(el.dataset.size) || 240;
      const imgSrc  = el.dataset.imgSrc  || null;
      // 빈 원 신호 = .icb-circle가 체커보드(repeating-conic-gradient) & 투명 배경(섹션bg fix와 동일 live computed-style 판정).
      // dataset.bgColor는 빈 원도 기본 placeholder '#e8e8e8'가 박혀 있어 신호로 못 씀(회차12 imac 정정).
      // → live .icb-circle computed-style: 체커보드면 빈 원=bgColor null(투명), 솔리드 색이면 그 색.
      let bgColor = null;
      const _live = el.id ? document.getElementById(el.id) : null;
      const _circ = _live ? _live.querySelector('.icb-circle') : null;
      if (_circ) {
        const _cs = getComputedStyle(_circ);
        const _checker = /repeating-conic-gradient/.test(_cs.backgroundImage || '');
        const _bg = _cs.backgroundColor || '';
        const _opaque = _bg && _bg !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(_bg);
        if (!_checker && _opaque) bgColor = _bg;   // 사용자가 색 지정한 원만 그 색
      } else {
        // live 못 찾으면(클론DOM) dataset 폴백 — 단 기본 placeholder '#e8e8e8'는 빈 원이므로 null
        const _ds = el.dataset.bgColor;
        bgColor = (_ds && _ds !== '#e8e8e8') ? _ds : null;
      }
      const _circleOut = {
        type:    'circle',
        id:      el.id || ('icb_' + Math.random().toString(36).slice(2, 8)),
        size,
        bgColor,
        src:     imgSrc,
      };
      /* ★G14 — «원 안» 자식(.icb-circle > .icb-children)이 있으면 원 + 자식을 «자유 프레임» 하나로 싸서 낸다.
         렌더러(figma-renderer) 무변경 — frame(free) 분기는 이미 있다(좁으면 가운데 · 자식은 x,y 절대). 원은 그 프레임의 (0,0)·폭 size.
         자식 좌표는 «살아 있는 문서»에서 잰다(G19 _gridKidBlocks 와 같은 수법 · 배율은 화면폭/레이아웃폭으로 나눈다).
         ⛔자식 0개면 옛 출력 그대로(type:'circle' 하나 — tests/dom/icb-children K12b).
         ⚠️배경색 형식(computed rgb() 문자열 → 렌더러 hexToRgb)은 손대지 않는다 — E49, 범위 밖(지디 2026-10-04).
         ⚠️피그마 프레임은 «네모»로 자른다 — 원 밖·네모 안으로 넘친 글자는 피그마에선 보인다(캔버스는 원으로 자른다). 미측정. */
      const _kbox = el.querySelector(':scope > .icb-circle > .icb-children');
      const _kidEls = _kbox ? [..._kbox.children].filter(k => !k.classList.contains('drop-indicator')) : [];
      if (_kidEls.length) {
        const children = [{ x: 0, y: 0, w: size, block: _circleOut }];
        const cr = _circ ? _circ.getBoundingClientRect() : null;
        const z = (_circ && _circ.offsetWidth) ? ((cr.width / _circ.offsetWidth) || 1) : 1;
        _kidEls.forEach(kid => {
          const blocks = _flowKidBlocks(kid, ps);
          if (!blocks.length) return;
          const lk = kid.id ? document.getElementById(kid.id) : null;
          const kr = lk ? lk.getBoundingClientRect() : null;
          const x = (cr && kr) ? Math.round((kr.left - cr.left) / z) : 0;
          const y = (cr && kr) ? Math.round((kr.top - cr.top) / z) : 0;
          const w = lk ? (lk.offsetWidth || size) : size;
          blocks.forEach(b => children.push({ x, y, w, block: b }));
        });
        return { type: 'frame', id: (el.id || _circleOut.id) + '__kids', width: size, height: size, bg: '', radius: 0, free: true, children };
      }
      return _circleOut;
    }
    if (el.classList.contains('table-block')) {
      const table   = el.querySelector('.tb-table');
      const trEls    = table ? [...table.querySelectorAll('tr')] : [];
      const _rgbToHex = (rgb) => {
        const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(rgb || '');
        if (!m) return null;
        const _h = n => Math.round(parseFloat(n)).toString(16).padStart(2, '0');
        return '#' + _h(m[1]) + _h(m[2]) + _h(m[3]);
      };
      // 라이브 DOM 테이블(computed-style용) — el은 detached라 getComputedStyle 빈값(회차12 table fix)
      const _liveTbl = (el.id && document.getElementById(el.id)?.querySelector('.tb-table')) || table;
      const _liveTrs = _liveTbl ? [..._liveTbl.querySelectorAll('tr')] : [];
      // #5-b: 논리 그리드 «평면화 복원» — rowspan/colspan을 풀어 모든 행의 열수를 논리 colCount로 정합.
      //   앵커 셀에 내용, 가려진(spanned) 위치는 빈 셀로 채워 «열 밀림 0».
      //   병합 없는 표는 각 셀이 물리 위치=논리 위치 → 기존과 동일 결과(회귀 0).
      const _buildGrid = (trs) => {
        const g = [];
        trs.forEach((tr, r) => {
          g[r] = g[r] || [];
          let c = 0, phys = 0;
          [...tr.children].forEach(cell => {
            if (cell.tagName !== 'TD' && cell.tagName !== 'TH') return;
            while (g[r][c] !== undefined) c++;
            const rs = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10) || 1);
            const cs = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
            for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) {
              g[r + dr] = g[r + dr] || [];
              g[r + dr][c + dc] = { cell, isAnchor: dr === 0 && dc === 0, phys, rs, cs };
            }
            c += cs; phys++;
          });
        });
        return g;
      };
      const _grid = _buildGrid(trEls);
      let colCount = 0; _grid.forEach(row => { if (row) colCount = Math.max(colCount, row.length); });
      if (!colCount) colCount = trEls.length ? Math.max(...trEls.map(tr => tr.querySelectorAll('th,td').length)) : 2;
      const rows = trEls.map((tr, ri) => {
        const cells = [];
        for (let c = 0; c < colCount; c++) {
          const slot = _grid[ri] && _grid[ri][c];
          if (slot && slot.isAnchor) {
            const cCell = slot.cell;
            const lc = _liveTrs[ri] ? [..._liveTrs[ri].querySelectorAll('th,td')][slot.phys] : null;
            let cs; try { cs = lc ? window.getComputedStyle(lc) : null; } catch { cs = null; }
            const obj = {
              text:     (cCell.innerText || '').trim(),
              align:    (cs && cs.textAlign) || cCell.style.textAlign || el.dataset.cellAlign || 'center',
              color:    (cs && _rgbToHex(cs.color)) || null,
              weight:   (cs && parseInt(cs.fontWeight)) || null,
              fontSize: (cs && Math.round(parseFloat(cs.fontSize))) || null,
            };
            if (slot.cs > 1) obj.colSpan = slot.cs;   // 메타(빌더가 무시해도 무방)
            if (slot.rs > 1) obj.rowSpan = slot.rs;
            cells.push(obj);
          } else {
            // 가려진 위치(spanned) 또는 그리드 밖 → 빈 셀로 채워 열 정합
            cells.push({ text: '', align: el.dataset.cellAlign || 'center', color: null, weight: null, fontSize: null, _spanned: !!slot });
          }
        }
        return {
          header: !!(tr.parentElement && tr.parentElement.tagName === 'THEAD'),
          cells,
        };
      });
      const firstCell = table?.querySelector('td,th');
      let fontSize = 28;
      try { if (firstCell) fontSize = Math.round(parseFloat(window.getComputedStyle(firstCell).fontSize)) || 28; } catch {}
      const realH = Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0);
      return {
        type:       'table',
        id:         el.id || ('tbl_' + Math.random().toString(36).slice(2, 8)),
        rows,
        colCount,
        rowCount:   rows.length,
        showHeader: el.dataset.showHeader !== 'false',
        showVLines: el.dataset.showVLines !== 'false',
        showHLines: el.dataset.showHLines !== 'false',
        lineColor:  el.dataset.lineColor  || '#cccccc',
        headerBg:   el.dataset.headerBg   || '#f0f0f0',
        textColor:  el.dataset.textColor  || '#222222',
        cellAlign:  el.dataset.cellAlign  || 'center',
        fontSize,
        rowH:       parseInt(el.dataset.rowH) || 0,
        height:     realH || (rows.length * (fontSize + 28) + 24),
      };
    }
    if (el.classList.contains('canvas-block')) {
      let cards = [];
      try { cards = JSON.parse(el.dataset.cards || '[]'); } catch {}
      // cvb-inner는 캔버스 디자인공간을 섹션공간으로 scale 축소 → 폰트크기에 곱해야 실제 렌더와 일치.
      const cvbInner = el.querySelector('.cvb-inner');
      const sm = /scale\(([\d.]+)\)/.exec(cvbInner && cvbInner.style.transform || '');
      const cvbScale = sm ? parseFloat(sm[1]) : 1;
      return {
        type:      'card-grid',
        id:        el.id || ('cvb_' + Math.random().toString(36).slice(2, 8)),
        cards,
        gridCols:  parseInt(el.dataset.gridCols)  || 2,
        gridRows:  parseInt(el.dataset.gridRows)  || 1,
        cardGap:   parseInt(el.dataset.cardGap)   || 10,
        canvasW:   parseInt(el.dataset.canvasW)   || 440,
        canvasH:   parseInt(el.dataset.canvasH)   || 400,
        radius:    parseInt(el.dataset.radius)    || 16,
        imgRatio:  parseInt(el.dataset.imgRatio)  || 75,
        cardMode:  el.dataset.cardMode || 'simple',
        textBg:    el.dataset.textBg   || '#cccccc',
        labelPos:      el.dataset.labelPos || 'below',
        overlayHeight: parseInt(el.dataset.overlayHeight) || 180,
        overlayWidth:  parseInt(el.dataset.overlayWidth)  || 100,
        gradientBg:    (el.dataset.textBg && el.dataset.textBg.includes('gradient')) ? el.dataset.textBg : '',
        imgShape:      el.dataset.imgShape || 'rect',
        titleSize: Math.round((parseInt(el.dataset.titleSize) || 32) * cvbScale),
        descSize:  Math.round((parseInt(el.dataset.descSize)  || 20) * cvbScale),
        titleColor: el.dataset.titleColor || '',
        descColor:  el.dataset.descColor  || '',
        iconColor:  el.dataset.iconColor  || '',
        textAlign: el.dataset.textAlign || 'center',
        padX:      ps?.padX || 0,
        height:    Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 400),
      };
    }
    if (el.classList.contains('chat-block')) {
      let messages = [];
      try { messages = JSON.parse(el.dataset.messages || '[]'); } catch {}
      // 버블 색은 dataset 기본값(우=파랑 #1888fe)이 goditor 실제(회색)와 어긋남 → live .chb-bubble computed-style을 우선 읽음(회차12 p6bwvy9).
      const _liveChat = el.id ? document.getElementById(el.id) : null;
      const _bubbles = _liveChat ? [..._liveChat.querySelectorAll('.chb-bubble')] : [];
      const _rows = _liveChat ? [..._liveChat.querySelectorAll('.chb-msg')] : [];
      const _topPad = _rows.length ? Math.round(_rows[0].offsetTop) : 0;
      const _gap = (_rows.length >= 2 && _bubbles.length >= 1)
        ? Math.max(0, Math.round((_rows[1].offsetTop - _rows[0].offsetTop) - _bubbles[0].offsetHeight))
        : 46;
      // 버블은 messages 순서대로 렌더 → 첫 좌/우 메시지 인덱스의 버블을 집음(가장 견고).
      const _idxL = messages.findIndex(m => m.align !== 'right');
      const _idxR = messages.findIndex(m => m.align === 'right');
      const _lb = _idxL >= 0 ? _bubbles[_idxL] : _bubbles[0];
      const _rb = _idxR >= 0 ? _bubbles[_idxR] : null;
      const _bg = (n, fb) => { if (!n) return fb; const c = getComputedStyle(n).backgroundColor; return (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(c)) ? c : fb; };
      const _fg = (n, fb) => { if (!n) return fb; const c = getComputedStyle(n).color; return c || fb; };
      return {
        type:       'chat',
        id:         el.id || ('chb_' + Math.random().toString(36).slice(2, 8)),
        /* ★BT2 — 줄 있는 메시지는 «줄 글자 평문»(msg.text 는 이스케이프된 거울이라 &lt; 가 그대로 찍힌다). 줄별 크기·굵기는 E40 과 같은 별건. */
        messages:   messages.map((m, mi) => ({ text: (Array.isArray(m.lines) && m.lines.length && window.lnPlainText) ? window.lnPlainText(m.lines) : (m.text || ''), align: m.align === 'right' ? 'right' : 'left', w: _bubbles[mi] ? Math.round(_bubbles[mi].offsetWidth) : 0, h: _bubbles[mi] ? Math.round(_bubbles[mi].offsetHeight) : 0 })),
        fontSize:   parseInt(el.dataset.fontSize) || 32,
        bgLeft:     _bg(_lb, el.dataset.bgLeft    || '#e5e5ea'),
        bgRight:    _bg(_rb, el.dataset.bgRight   || '#1888fe'),
        colorLeft:  _fg(_lb, el.dataset.colorLeft || '#111111'),
        colorRight: _fg(_rb, el.dataset.colorRight|| '#ffffff'),
        radius:     parseInt(el.dataset.radius)  || 16,
        gap:        _gap,
        topPad:     _topPad,
        padding:    parseInt(el.dataset.padding) || 16,
        height:     Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 200),
      };
    }
    // ── ICON (icon-block) : SVG 아이콘 ──
    if (el.classList.contains('icon-block')) {
      const size = parseInt(el.dataset.size) || parseFloat(el.style.width) || 48;
      // 아이콘 실제 x(섹션폭 대비 fraction) 캡처 — sangpe 무조건 중앙정렬 버그(회차12 u2o2f04 'A' 왼쪽인데 가운데로 밀림)
      const _live = (el.id && document.getElementById(el.id)) || el;
      const _sec = _live.closest && _live.closest('.section-block');
      let xFrac = null;
      if (_sec) {
        const sr = _sec.getBoundingClientRect(); const z = (sr.width / (_sec.offsetWidth || 1)) || 1;
        const r = _live.getBoundingClientRect();
        xFrac = (r.left - sr.left) / z / (_sec.offsetWidth || 1);
      }
      return {
        type: 'icon', id: el.id || '',
        svg: el.dataset.iconSvg || (el.querySelector('svg')?.outerHTML) || '',
        color: el.dataset.iconColor || '#000000',
        size, rotation: parseInt(el.dataset.rotation) || 0, xFrac,
        height: size,
      };
    }
    // ── DIVIDER (divider-block) : 선 (가로=두께가 높이, 세로=lineLength가 높이) ──
    if (el.classList.contains('divider-block')) {
      const padV = parseInt(el.dataset.padV) || 0;
      const weight = parseInt(el.dataset.lineWeight) || 1;
      const dir = el.dataset.lineDir || 'horizontal';
      const lineLength = parseInt(el.dataset.lineLength) || 100; // 가로=% , 세로=px
      const height = dir === 'vertical' ? (padV * 2 + lineLength) : (padV * 2 + weight);
      return {
        type: 'divider', id: el.id || '',
        color: el.dataset.lineColor || '#cccccc',
        weight, lineLength, dir, padV, height,
      };
    }
    // ── GRAPH (graph-block) : 막대/라인 차트 ──
    if (el.classList.contains('graph-block')) {
      let items = []; try { items = JSON.parse(el.dataset.items || '[]'); } catch {}
      return {
        type: 'graph', id: el.id || '',
        chartType: el.dataset.chartType || 'bar',
        items,
        width: Math.round((el.id && document.getElementById(el.id)?.offsetWidth) || el.offsetWidth || 0),
        height: parseInt(el.dataset.chartHeight) || parseFloat(el.style.height) || 300,
        // GR2·GR3 — 축·격자·꺾은선 토글은 «켜진 것만» 싣는다(꺼진 그래프의 JSON 은 예전과 같다). ⚠️렌더러(sangpe_to_figma)는 아직 안 읽는다(E11).
        ...(['showAxis', 'showGrid', 'showLine'].some(k => el.dataset[k] === '1')
          ? { showAxis: el.dataset.showAxis === '1', showGrid: el.dataset.showGrid === '1', showLine: el.dataset.showLine === '1' } : {}),
        // ★1017t1f6㉠ — 축이 켜져 있고 사용자가 눈금 글자를 고친 게 있을 때만 싣는다(옛 그래프 JSON 은 무변). ⚠️렌더러는 아직 안 읽는다(위와 같은 사정).
        ...(el.dataset.showAxis === '1' && el.dataset.axisTickText
          ? { axisTickText: (window.__grbParseAxisTickOv ? window.__grbParseAxisTickOv(el.dataset.axisTickText) : {}) } : {}),
        // 1012t1G2·G3 — 실루엣·채움 분모도 «켜진 것만» 싣는다(옛 JSON 무변). ⚠️렌더러(sangpe_to_figma)는 아직 안 읽는다 — 피그마에선 보통 세로 막대.
        ...(window.GRAPH_SHAPE.shapeOn(el.dataset) ? { barShape: el.dataset.barShape, fillMax: window.GRAPH_SHAPE.fillMaxOf(el.dataset, items) } : {}),
        // 1013t1C — 원형·도너츠의 블럭 수준 키도 «있는 것만» 싣는다(새 키가 없는 원형·옛 donut 의 JSON 은 예전과 같다 — pieHole 은 pieDonut 이 켜졌을 때만).
        //   조각별 키(pieGrow · piePull · pieTag)는 items 에 이미 실린다. ⚠️렌더러(sangpe_to_figma)는 아직 안 읽는다 — 피그마에선 원형이 여전히 막대로 나간다.
        ...(((ds) => {
          const o = {};
          if (ds.chartType !== 'pie' && ds.chartType !== 'donut') return o;
          const int = (k) => { const n = parseInt(ds[k]); if (ds[k] !== undefined && Number.isFinite(n)) o[k] = n; };
          if (ds.pieDonut === '1') { o.pieDonut = true; int('pieHole'); }
          int('pieStart'); int('pieGap');
          if (ds.pieRank === '1') o.pieRank = true;
          if (ds.pieName === '1') o.pieName = true;
          if (ds.dropShadow === 'soft' || ds.dropShadow === 'strong') o.dropShadow = ds.dropShadow;
          return o;
        })(el.dataset)),
      };
    }
    // ── SHAPE (shape-block) : 도형(선/사각/원) ──
    if (el.classList.contains('shape-block')) {
      return _shapeFigmaBlock(el);
    }
    // ── STEP (step-block) : 번호badge + 제목/설명 카드 ──
    if (el.classList.contains('step-block')) {
      let steps = []; try { steps = JSON.parse(el.dataset.steps || '[]'); } catch {}
      return {
        type: 'step', id: el.id || '',
        steps: steps.map(s => ({ title: s.title || '', desc: s.desc || '' })),
        startNumber: parseInt(el.dataset.startNumber) || 1,
        numBg: el.dataset.numBg || '#222222',
        numColor: el.dataset.numColor || '#ffffff',
        numSize: parseInt(el.dataset.numSize) || 50,
        titleSize: parseInt(el.dataset.titleSize) || 36,
        descSize: parseInt(el.dataset.descSize) || 24,
        titleColor: el.dataset.titleColor || '#222222',
        descColor: el.dataset.descColor || '#888888',
        cardBg: el.dataset.stepCardBg || '#ffffff',
        badgeFormat: el.dataset.badgeFormat || 'padded',
        badgeGap: parseInt(el.dataset.badgeGap) || 20,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 80),
      };
    }
    // ── BANNER02 (banner02-block) : 라운드 컬러박스 + 텍스트스택 + 이미지 ──
    if (el.classList.contains('banner02-block')) {
      let lines = []; try { lines = JSON.parse(el.dataset.lines || '[]'); } catch {}
      return {
        type: 'banner02', id: el.id || '',
        bannerW: parseInt(el.dataset.bannerW) || 780,
        bannerH: parseInt(el.dataset.bannerH) || 260,
        radius: parseInt(el.dataset.radius) || 20,
        bg: el.dataset.bg || '#1a1f3d',
        textX: parseInt(el.dataset.textX) || 36,
        textY: parseInt(el.dataset.textY) || 35,
        textW: parseInt(el.dataset.textW) || 358,
        lines: lines.map(l => ({ kind: l.kind, text: l.text || '', size: l.size || 16, color: l.color || '#ffffff', gapTop: l.gapTop || 0, weight: l.fontWeight || 400 })),
        imgSrc: el.dataset.imgSrc || '',
        imgX: parseInt(el.dataset.imgX) || 0, imgY: parseInt(el.dataset.imgY) || 0,
        imgW: parseInt(el.dataset.imgW) || 0, imgH: parseInt(el.dataset.imgH) || 0,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || (parseInt(el.dataset.bannerH) || 260)),
      };
    }
    // comparison 행 셀: 문자열은 그대로, 객체면 텍스트 추출(예전 [object Object] 갭 방지)
    function _cmpCell(r) {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object') {
        const v = r.text ?? r.value ?? r.label ?? r.title ?? r.name;
        if (v != null) return String(v);
        const strs = Object.values(r).filter(x => typeof x === 'string' && x.trim());
        return strs.join(' ');
      }
      return r == null ? '' : String(r);
    }
    // comparison 행: image 행은 객체로 보존(placeholder 텍스트 노출 방지), 그 외 텍스트 (회차12 z8lg3v4 fix)
    function _cmpRow(r) {
      if (r && typeof r === 'object' && (r.type === 'image' || r.imgSrc !== undefined)) {
        /* ★1012t1D4 셀 이미지 블러 — 에셋(_imageRedactField)과 같은 원칙: 원본 imgSrc 를 싣지 않고 덮개 색만. */
        const rd = r.imgSrc ? normalizeRedact(r.redact) : 0;
        if (rd > 0) return { type: 'image', imgSrc: '', imgFit: r.imgFit || 'cover', text: r.text || '',
                             redact: { intensity: rd, blurPx: redactPx(rd), cover: _REDACT_COVER } };
        return { type: 'image', imgSrc: r.imgSrc || '', imgFit: r.imgFit || 'cover', text: r.text || '' };
      }
      return { type: 'text', text: _cmpCell(r) };
    }
    // ── COMPARISON (comparison-block) : 2열 비교(헤더+행, featured 강조) ──
    if (el.classList.contains('comparison-block')) {
      let cols = []; try { cols = JSON.parse(el.dataset.cols || '[]'); } catch {}
      const feat = el.dataset.featured;
      return {
        type: 'comparison', id: el.id || '',
        cols: cols.map(c => ({ title: c.title || '', bg: c.bg || '', text: c.text || '', rows: (c.rows || []).map(_cmpRow) })),
        featured: (feat !== undefined && feat !== '') ? parseInt(feat) : -1,
        compW: parseInt(el.dataset.compW) || 720,
        padX: parseInt(el.dataset.padX) || 0,
        padY: parseInt(el.dataset.padY) || 0,
        overlap: (el.dataset.overlap !== undefined && el.dataset.overlap !== '') ? parseInt(el.dataset.overlap) : 32,
        rowHeights: (() => { try { const a = JSON.parse(el.dataset.rowHeights || 'null'); return Array.isArray(a) ? a : []; } catch { return []; } })(),
        titleFont: parseInt(el.dataset.titleFont) || 38,
        rowFont: parseInt(el.dataset.rowFont) || 32,
        headerH: parseInt(el.dataset.headerH) || 72,
        rowH: parseInt(el.dataset.rowH) || 74,
        rowGap: parseInt(el.dataset.rowGap) || 12,
        radius: parseInt(el.dataset.radius) || 20,
        featScale: parseFloat(el.dataset.featScale) || 1.2,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 400),
      };
    }
    // ── MOCKUP (mockup-block) : 디바이스 프레임 이미지 ──
    if (el.classList.contains('mockup-block')) {
      const img = el.querySelector('img');
      return {
        type: 'mockup', id: el.id || '',
        imgSrc: img ? img.src : '',
        width: parseInt(el.dataset.width) || 575,
        offsetX: parseInt(el.dataset.offsetX) || 0,
        offsetY: parseInt(el.dataset.offsetY) || 0,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 400),
      };
    }
    // ── LINER (liner-block) : 곡선텍스트 → 렌더된 SVG 그대로 임베드 ──
    if (el.classList.contains('liner-block')) {
      const svg = el.querySelector('svg');
      return {
        type: 'liner', id: el.id || '',
        svg: svg ? svg.outerHTML : '',
        width: Math.round((el.id && document.getElementById(el.id)?.offsetWidth) || el.offsetWidth || 716),
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 56),
      };
    }
    // ── LAUREL (laurel-block) : 월계관 잎 SVG + 중앙 텍스트 ──
    if (el.classList.contains('laurel-block')) {
      let cells = []; try { cells = JSON.parse(el.dataset.cells || '[]'); } catch {}
      /* ★1013t1B2 C3 — 줄 저장 꼴이 그리드 줄(type·weight …)로 바뀌었다. 수신측(figma-renderer laurel)은 옛 이름(fontWeight)을 읽는다
         ⇒ 글자 줄만 옛 꼴로 맞춰 보낸다(여백·구분선·그림은 빠진다 · 결정 B2-10). ⛔블럭 모듈을 import 하지 않는다 — window 로 부른다.
         없으면(모듈 미적재) 옛 판처럼 그대로 보낸다. 지키는 검사: tests/dom/laurel-lines.dom.spec.js LL11. */
      if (typeof window._lrlFigmaCells === 'function') cells = window._lrlFigmaCells(cells);
      const _live = (el.id && document.getElementById(el.id)) || el;
      const _br = _live.getBoundingClientRect();
      const _z = (_br.width / (_live.offsetWidth || 1)) || 1;
      const _sec = _live.closest('.section-block');
      const _sr = _sec ? _sec.getBoundingClientRect() : _br;
      const _secW = (_sec ? _sec.offsetWidth : _live.offsetWidth) || 1;
      const leaf = _live.querySelector('svg');
      // 좌/우 월계관 잎의 실제 위치(섹션폭 대비 fraction)·세로위치(블록기준)·좌우반전(scaleX -1) 캡처
      //  — 하드코딩 위치/flip누락 버그 방지(회차12 uk8ggh2). 섹션 fraction이라 sangpe 프레임폭에 무관.
      const leaves = [..._live.querySelectorAll('.laurel-leaf-left,.laurel-leaf-right')].map(sp => {
        const svg = sp.querySelector('svg') || sp; const r = svg.getBoundingClientRect();
        const cs = getComputedStyle(svg);
        const flip = /matrix\(-1|scaleX\(-1\)/.test((cs.transform || '') + (svg.style.transform || ''));
        return { xFrac: (r.left - _sr.left) / _z / _secW, wFrac: r.width / _z / _secW,
                 y: Math.round((r.top - _br.top) / _z), h: Math.round(r.height / _z), flip };
      });
      return {
        type: 'laurel', id: el.id || '',
        cells, leafSvg: leaf ? leaf.outerHTML : '', leaves,
        height: Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 116),
      };
    }
    // ── MODAL BLOCK 전용 (현빈 발주 2026-09-08) ──
    //  ★type 은 'generic' 을 «그대로» 쓴다. 수신측(Figma 플러그인)이 이미 아는 형태라
    //    드롭되지 않는다 — 여기서 새 type 을 만들면 «모르는 타입»이 되어 조용히 빠질 수 있다.
    //    대신 kind='modal' 과 변형·패딩·테두리·간격을 실어 후속 refinement 가 쓸 수 있게 한다.
    //  ⛔텍스트 수집은 아래 generic 과 «같은 규칙»(tb- 접두)이다 — 두 벌로 갈리지 않게 한 곳에서만 센다.
    if (el.classList.contains('modal-block')) {
      const ds = el.dataset || {};
      /* ★글자는 dataset 에서 읽는다 — DOM 이 아니라.
         내보내기는 «분리된 문서»(DOMParser 클론)를 걸을 수 있고 거기선 innerText 가 빈 문자열이다
         (layout 이 없다). dataset 은 이 블록의 진실이므로 붙어 있든 떨어져 있든 같은 값을 준다.
         안내문구(placeholder)는 dataset 이 애초에 비어 있어 «저절로» 빠진다 — 따로 거르지 않는다. */
      /* ★이 숫자는 js/blocks/modal-block.js 의 MODAL_DEFAULTS.fontSize 와 «같은 값»이어야 한다.
         ⛔import 로 묶지 않는다 — 내보내기는 «분리된 문서»(DOMParser 클론)를 걷는 경로라
           블록 모듈(window/DOM 에 손대는)을 끌고 오면 안 된다. 결합 대신 검사로 묶었다:
           tests/unit/modal-text-defaults.test.mjs 의 T1 이 「세 자리가 같은 값을 본다」를
           소스에서 못박는다 — 한 자리만 고치면 그 검사가 빨개진다.
         ⚠️폴백 자체는 «남긴다». dataset 이 비어 있는 블록(손수 만든/가져온)에서 fs 가 NaN 이 되면
           내보낸 JSON 의 fs 가 null 로 나가 수신측이 조용히 깨진다. 없앨 것은 «14 라는 딴 값»이지
           폴백이 아니다.
      */
      const fs = parseInt(ds.fontSize) || 36;
      const color = ds.textColor || '#1c1c1e';
      const texts = [];
      const push = (slot, val) => {
        const tx = String(val ?? '').trim();
        if (tx) texts.push({ t: tx, fs, color, slot, x: 0, y: 0 });
      };
      if (ds.variant === 'titled') { push('title', ds.titleText); push('text', ds.textText); }
      else if (ds.variant === 'grid-2') { push('cell1', ds.cell1); push('cell2', ds.cell2); }
      else push('text', ds.textText);
      const bw = parseInt(ds.borderW) || 0;
      return {
        type: 'generic', id: el.id || '', kind: 'modal', variant: ds.variant || 'plain',
        width: (ds.wMode === 'fixed' && parseInt(ds.width)) || null,
        height: (ds.hMode === 'fixed' && parseInt(ds.height))
                || Math.round((el.id && document.getElementById(el.id)?.offsetHeight) || el.offsetHeight || 0),
        bg: ds.bg || '', radius: parseInt(ds.radius) || 0,
        padX: parseInt(ds.padX) || 0, padY: parseInt(ds.padY) || 0,
        border: bw > 0 ? { width: bw, style: ds.borderStyle || 'solid', color: ds.borderColor || '' } : null,
        gap: ds.variant === 'grid-2' ? (parseInt(ds.gap) || 0) : 0,
        align: ds.align || 'left',
        svg: el.querySelector('.mdl-icon svg')?.outerHTML || '',
        texts,
      };
    }

    // ── GENERIC 폴백 (잔여) ──
    //    드롭 방지: 높이 보존 + 배경 + 내부 텍스트/아이콘 살림. (완벽 레이아웃은 후속 refinement)
    if (/(-block)$/.test([...el.classList].find(c => c.endsWith('-block')) || '')) {
      /* ★G19 — 그리드 «밑» 자식 블럭(:scope > .grd-children)은 «블럭»으로 따로 나간다(_blockAll · _gridKidBlocks).
         여기서 그 안의 글자·아이콘까지 긁으면 자식 글자가 그리드 껍데기 (0,0)에 24px 로 «한 번 더» 찍힌다(측정 M2).
         ⇒ 껍데기 수집은 그릇 «밖»만 본다. 자식이 없으면 _kidsBox 가 null 이라 옛 수집과 «같은 결과»다. */
      const _kidsBox = _kidsBoxOf(el);   /* ★표 한 자리에서 — G19 그리드 · ★1011t1C 인용구 */
      const _notKid = (n) => !_kidsBox || !_kidsBox.contains(n);
      /* ★★★2026-10-24 — ★`parseFloat(el.style.width)` 이 ★★«퍼센트»를 ★★px 로 ★둔갑시켰다.
         ★★실측 : `parseFloat('100%') === 100`. ★단위가 ★조용히 ★사라진다.
         ★어노테이션은 `block.style.width = '100%'`(annotation-block.js:438 · ★섹션을 덮는 ★오버레이)라
           ★Figma JSON 에 ★★`width: 100` 이 ★실렸다 — ★★«100px 짜리 상자»다.
         ⛔내가 ★처음 붙인 이름 `ANNOT-FIGMA-BOX-IS-CSS-DEFAULT-NOT-DRAWING-EXTENT-01` 은
           ★★까닭을 ★틀렸다(「CSS 기본 100px」이 ★아니다 · CSS 는 `width:100%` 다).
           ★참 이름 = ★`FIGMA-GENERIC-PARSES-PERCENT-AS-PX-01`
         ⇒ ★★px(또는 단위 없는 수)만 ★받고, ★아니면 ★★«살아 있는 요소»의 실측 폭으로 ★떨어진다.
         ★재는 자 = `tests/dom/annot-same-as-other-blocks.dom.spec.js` A1 · A4 */
      const _pxOnly = (v) => {
        if (!v) return null;
        const t = String(v).trim();
        if (!/^-?[0-9.]+(px)?$/.test(t)) return null;   /* ⛔% · em · rem · calc() · auto 전부 거절 */
        const n = parseFloat(t);
        return Number.isFinite(n) ? n : null;
      };
      const _liveEl = el.id ? document.getElementById(el.id) : null;
      const w = parseInt(el.dataset.bannerW || el.dataset.compW || el.dataset.width) || _pxOnly(el.style.width)
                || Math.round((_liveEl && _liveEl.offsetWidth) || el.offsetWidth || 0) || null;
      /* ★자식이 있는 그리드의 «껍데기 높이» = 격자(.grd-inner) 높이 — 그리드 상자 높이엔 자식이 들어 있어 그대로 쓰면
         Figma 에서 격자 프레임이 자식 높이만큼 길어지고 그 밑에 자식이 «또» 쌓인다. */
      const _liveInner = (_kidsBox && el.id) ? document.getElementById(el.id)?.querySelector(_kidsInnerSel(el)) : null;   /* ★표 한 자리에서 */
      /* ★높이도 ★같은 병이었다 — `parseFloat(el.style.height)` 이 `'100%'` 를 ★100 으로 읽었다.
         ★다만 ★여기엔 ★★«살아 있는 높이» 폴백이 ★이미 ★맨 뒤에 ★있었다 ⇒ ★`_pxOnly` 로 거르면 ★그리로 떨어진다. */
      const h = (_liveInner && Math.round(_liveInner.offsetHeight))
                || parseInt(el.dataset.bannerH || el.dataset.chartHeight) || _pxOnly(el.style.height)
                || Math.round((_liveEl && _liveEl.offsetHeight) || el.offsetHeight || 0);
      const texts = [];
      /* ★★★2026-10-24 — ★`.annot-label` 을 ★★더했다. ★★현빈 ★결정의 ★연장(「★다른 블록처럼」).
         ★★증상 : ★어노테이션·치수선의 ★★그림(svg)은 ★나가는데 ★★라벨 ★글자는 ★안 나갔다
           — ★수집기가 ★`tb-` ★접두만 ★봤고 ★라벨은 ★`.annot-label` 이다.
           ★이름 = `ANNOT-LABEL-TEXT-NOT-IN-FIGMA-TEXTS-01`
         ★★x·y 가 ★맞는 ★근거 : ★라벨은 ★인라인으로 `left:<px>; top:<px>` 를 ★이미 ★가진다
           (`annotation-block.js:531` labelStyle) ⇒ ★아래 `parseFloat(t.style.left)` 가 ★그대로 ★읽는다.
           ⛔짐작이 아니다 — ★그 줄을 ★읽고 ★넣었다.
         ★★★다만 ★모형에 ★★안 ★담기는 ★것이 ★둘 ★있다(★«나간다»로 ★뭉개지 않게 ★적는다) :
           ⒜ ★라벨의 ★`transform: translate(0,-50%)` ★계열 ★정렬(`_calcLabelTransform`) —
              ★선의 ★방향에 ★따라 ★라벨을 ★좌/우/위/아래로 ★당기는 ★몫이다. ★여기선 ★안 ★싣는다.
           ⒝ ★`translate:<dx>px <dy>px`(사용자가 ★끌어 ★옮긴 ★몫 · `:547`).
           ⇒ ★이름 = `ANNOT-LABEL-ANCHOR-TRANSFORM-NOT-IN-FIGMA-01` (★미측정 · ★수신측 영향 안 쟀다)
         ★재는 자 = `tests/dom/annot-same-as-other-blocks.dom.spec.js` A1 · A5 */
      el.querySelectorAll('[class^="tb-"], [class*=" tb-"], .annot-label').forEach(t => {
        if (!_notKid(t)) return;
        /* ★1012t1H5 — 인용구 줄(.tb-qt-line) «안»의 효과 span(tb-dot 글자마다 · tb-hl · tb-glow)은 줄이 이미 실은 글자다.
           안 거르면 점을 켠 순간 글자가 한 자씩 또 실린다. ⛔줄 자신과 줄 밖(.tb-qt-body·부호)은 그대로(옛 JSON 바이트 동일). */
        if (t.parentElement && t.parentElement.closest('.tb-qt-line')) return;
        const tx = (t.innerText || '').trim();
        if (tx) { const cs = (typeof window.getComputedStyle === 'function') ? window.getComputedStyle(t) : {};
          texts.push({ t: tx, fs: parseInt(cs.fontSize) || 24, color: cs.color || '#111111',
            x: parseFloat(t.style.left) || 0, y: parseFloat(t.style.top) || 0 }); }
      });
      const ds = el.dataset || {};
      const out = {
        type: 'generic', id: el.id || '', kind: ds.type || '',
        width: w, height: h || 0, bg: ds.bg || '', radius: parseInt(ds.radius) || 0,
        svg: [...el.querySelectorAll('svg')].find(_notKid)?.outerHTML || '', texts,
      };
      /* ★G17 그리드 «블럭 외곽선» — 키(data-block-outline)가 있을 때만 `border` 를 싣는다(없으면 JSON 바이트 그대로).
       *   값은 렌더러가 블럭 style 에 «이미 그은» 변을 그대로 읽는다(모델 해석을 여기서 다시 하지 않는다 — 두 벌 금지).
       *   ⚠️figma-renderer/sangpe_to_figma.mjs 의 generic 분기는 아직 `border` 를 «안 읽는다»(플러그인에 면별 stroke 명령 0).
       *     ⇒ 피그마 화면에 선이 나오는 것은 «미구현·미측정»이다. 여기서는 «실어 보낸다»까지만. */
      /* ★G12 블럭 배경 — 켰을 때 선은 «배경 바깥 가장자리»의 .grd-edge 가 긋고 블럭 자기 테두리는 색이 투명이다(안 A).
       *   ⇒ 선 값은 .grd-edge 에서 읽는다(렌더러가 «이미 그은» 것을 읽는 원칙 그대로 · 모델 해석 두 벌 금지). */
      const _bbg = el.classList.contains('grid-block') ? window.gridBlockBg?.(el) : null;
      const _edge = _bbg && _bbg.on ? el.querySelector(':scope > .grd-edge') : null;
      if (ds.blockOutline && el.classList.contains('grid-block') && el.style) {
        const border = {};
        const src = _edge || el;
        for (const sd of ['top', 'right', 'bottom', 'left']) {
          const st = src.style.getPropertyValue('border-' + sd + '-style');
          border[sd] = st && st !== 'none'
            ? { width: parseFloat(src.style.getPropertyValue('border-' + sd + '-width')) || 0, style: st, color: src.style.getPropertyValue('border-' + sd + '-color') }
            : null;
        }
        out.border = border;
        if (_edge) out.borderAt = 'bg-edge';   // 선이 블럭 상자가 아니라 배경 바깥 가장자리에 있다
      }
      /* ★G12 블럭 배경 — 켰을 때만 `blockBg` 를 싣는다(끄면 JSON 바이트 그대로). 읽는 문 = grid-block.js gridBlockBg(window) «하나».
       *   height = 살아 있는 그리드 상자 높이(G19 자식 포함 — 위 껍데기 높이 h 와 다르다: 배경은 자식까지 덮는다).
       *   ⚠️figma-renderer/sangpe_to_figma.mjs generic 은 아직 이것을 «안 그린다»(G17 border 와 같은 처지 · 미구현·미측정). */
      if (_bbg && _bbg.on) {
        const _live = el.id ? document.getElementById(el.id) : null;
        out.blockBg = { color: _bbg.color, opacity: _bbg.opacity, padX: _bbg.padX, padY: _bbg.padY, pos: _bbg.pos, hasImage: !!_bbg.img,
          height: Math.round((_live && _live.offsetHeight) || h || 0) };
      }
      return out;
    }
    return null;
  }

  /* ═══ ★G19 그리드 «밑» 자식 블럭 — 그리드 전용 분기 ═══════════════════════════════════════
     그리드 블럭 = [격자 껍데기(GENERIC)] + [자식 블럭들]. 자식은 «흐름 블럭»으로 그리드 «뒤»에 잇는다
     (그릇 간격 data-child-gap 만큼 gap 블럭을 앞에 하나씩 — 화면의 margin-top·flex gap 과 같은 자리).
     ⛔순회기(_walkSectionChild·_row)는 그리드 «안»으로 안 내려간다 — 그래서 여기 «한 자리»에서만 내려간다.
     _blockAll 은 _block 과 같되 그리드면 자식 블럭을 뒤에 붙여 «목록»을 돌려준다(자식 0개면 [그리드] 하나 — 옛 출력과 같다). */
  /* ★★★«자식 그릇을 ★가진 블럭»의 ★표 ★한 자리 — ★`1011t1C`(2026-10-11 · 지디 조건 ⑵).
     ★★칸: [★블럭 클래스, ★그릇 클래스, ★★안쪽 래퍼 클래스, ★간격 dataset 키(없으면 null), ★간격 기본값]
     ★★★왜 ★여기 ★또 ★표가 ★있나 — ★`js/panels/layer-panel-items.js` 의 ★`LAYER_KIDS_BOX_BY_CLASS` 와
       ★★«합치지 ★못했다». ★까닭을 ★적는다(★지디 「★못 하면 ★왜 못 하나를 ★적어라」):
         ⒤ ★레이어 표는 ★★«그릇을 찾는 ★window 함수 ★이름»을 ★든다(★살아 있는 문서 · ★런타임)
         ⒥ ★★이 표는 ★★«클래스 ★글자»를 ★든다 — ★★이 모듈은 ★★«복제된 DOM»을 ★걷고(★`el` 이 ★클론일 수 있다)
            ★그리고 ★★«안쪽 래퍼»와 ★★«간격»까지 ★필요하다. ★레이어는 ★그 둘을 ★★안 묻는다
         ⇒ ★★★두 표가 ★★«다른 물음»에 ★답한다. ★합치면 ★한쪽이 ★안 쓰는 칸을 ★들고 다닌다
       ⚠️★그래서 ★★값은 ★겹친다(★클래스 이름 ★둘). ★★한쪽을 고치면 ★★다른 쪽도 ★보라 —
         ★그 둘을 ★★한 검사가 ★같이 잰다(★`tests/dom/quote-children-figma.dom.spec.js` ＋ ★`quote-children.dom.spec.js`).
     ⛔서클(`icon-circle-block`)은 ★★이 표에 ★없다 — ★그릇이 ★★`:scope > .icb-circle > .icb-children` ★★두 단이라
       ★★«클래스 ★한 칸»으로 ★안 담긴다. ★그 자리는 ★제 분기 그대로 둔다(★이 레인에서 ★안 건드렸다). */
  const KIDS_SHELL_BY_CLASS = [
    ['grid-block',  'grd-children', 'grd-inner', 'childGap', 24],   /* G19 */
    ['quote-block', 'qt-children',  'qt-inner',  null,        0],   /* ★1011t1C — ★간격 키가 ★없다 ⇒ ★화면도 ★0 이다
                                                                        (★`css/editor-blocks.css` 의 ★`.qt-children` 절이 ★간격을 ★안 준다 — ★실측) */
  ];
  const _kidsSpecOf = (el) => (el && el.classList)
    ? (KIDS_SHELL_BY_CLASS.find(([c]) => el.classList.contains(c)) || null) : null;
  /** ★★그 블럭이 ★자식 그릇을 ★가질 ★꼴인가 — ⛔클래스를 ★손으로 ★적지 ★마라. */
  const _hasKidsShell = (el) => !!_kidsSpecOf(el);
  /** ★그릇 — ★없으면 ★`null`(★자식 0개면 ★옛 출력과 ★같은 결과가 된다). */
  function _kidsBoxOf(el) {
    const spec = _kidsSpecOf(el);
    if (!spec) return null;
    for (const ch of el.children) if (ch.classList && ch.classList.contains(spec[1])) return ch;
    return null;
  }
  /** ★★안쪽 래퍼 — ★«껍데기 높이»를 ★그것으로 ★잰다(★상자엔 ★자식이 ★들어 있다). */
  const _kidsInnerSel = (el) => { const s = _kidsSpecOf(el); return s ? `:scope > .${s[2]}` : null; };
  /** ★그릇 간격 — ★표의 ★키·기본값에서. ★★키가 ★`null` 이면 ★★항상 ★기본값이다. */
  function _kidsGap(el) {
    const spec = _kidsSpecOf(el);
    if (!spec) return 0;
    const [, , , key, dflt] = spec;
    if (!key) return dflt;
    const raw = el.dataset?.[key];
    const n = Number(raw);
    return (raw !== undefined && raw !== '' && Number.isFinite(n)) ? Math.max(0, Math.min(80, Math.round(n))) : dflt;
  }
  let _frameBlockFn = null;   // _section 이 자기 _frameBlock 을 걸어 둔다(자식 중 자유배치 프레임용)
  /** 그릇 «한 자식»(row · gap · 글자 래퍼 · 흐름/자유 프레임 · 맨몸 블럭) → 블럭 목록. */
  function _flowKidBlocks(kid, ps) {
    if (!kid || kid.nodeType !== 1 || !kid.classList || kid.classList.contains('drop-indicator')) return [];
    if (kid.classList.contains('row')) return _row(kid, ps);
    if (kid.classList.contains('gap-block')) return [{ type: 'gap', height: parseFloat(kid.style.height) || 50 }];
    if (kid.classList.contains('frame-block')) {
      if (kid.dataset.freeLayout === 'true' && _frameBlockFn) return [_frameBlockFn(kid)];
      const out = [];
      _blockChildren(kid).forEach(b => out.push(..._blockAll(b, ps)));
      kid.querySelectorAll(':scope > .frame-block').forEach(n => out.push(..._flowKidBlocks(n, ps)));
      return out;
    }
    return _isContentBlock(kid) ? _blockAll(kid, ps) : [];
  }
  /** 그리드의 자식 블럭 — [{dy, blocks}] (dy = 그리드 윗변에서 그 자식 윗변까지, 캔버스 px · 살아 있는 문서에서 잼). */
  function _gridKidBlocks(grid, ps) {
    const box = _kidsBoxOf(grid);
    if (!box) return [];
    const liveGrid = grid.id ? document.getElementById(grid.id) : null;
    const gr = liveGrid ? liveGrid.getBoundingClientRect() : null;
    const z = liveGrid && liveGrid.offsetWidth ? (gr.width / liveGrid.offsetWidth) || 1 : 1;
    const out = [];
    [...box.children].forEach(kid => {
      const blocks = _flowKidBlocks(kid, ps);
      if (!blocks.length) return;
      const lk = kid.id ? document.getElementById(kid.id) : null;
      const dy = (gr && lk) ? Math.round((lk.getBoundingClientRect().top - gr.top) / z) : null;
      out.push({ dy, blocks });
    });
    return out;
  }
  /** _block + 그리드면 자식 블럭을 «흐름»으로 뒤에 잇는다(간격 gap 블럭 포함). */
  function _blockAll(el, ps) {
    const parsed = _block(el, ps);
    if (!parsed) return [];
    if (!_hasKidsShell(el)) return [parsed];   /* ★표 한 자리에서 */
    const kids = _gridKidBlocks(el, ps);
    if (!kids.length) return [parsed];
    const gap = _kidsGap(el);
    const out = [parsed];
    kids.forEach(k => { if (gap > 0) out.push({ type: 'gap', height: gap }); out.push(...k.blocks); });
    return out;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     순회 판정 — ★명부가 아니라 «성질»로 잡는다.

     ⛔왜 바꿨나 (2026-09-09 실측)
       순회 셀렉터가 «손으로 적은 명부» 네 벌이었고 이미 서로 어긋나 있었다
       (row 직속 18개엔 canvas-block 이 없고, 섹션 직속 18개엔 gap-block 이 없었다. 합집합 19).
       그런데 핸들러 `_block` 은 «GENERIC 폴백»(위 787줄)이 있어 이미 성질로 짜여 있다 —
       classList 중 `-block` 으로 끝나는 게 하나라도 있으면 잡는다.
       ⇒ 결함은 「핸들러는 멀쩡한데 순회가 거기까지 못 간다」였다.
         js/ 가 노출하는 add*Block 38종 중 «11종»이 row 안에서 이 명부에 없어
         `{"columns":[]}` 빈 껍데기로 나갔다(bridge·grid·infocard·innercard·icon-text·joker·vector…).

     ★그래서 순회를 핸들러에 «맞춘다» — 같은 판정을 쓴다.
       ⛔네 벌을 «한 곳으로 모으기만» 하면 안 된다. 모아도 그 한 곳이 손 명부면
         20번째 블록이 생기는 날 또 샌다. 명부는 «제외»에만 쓴다 — 제외는 짧고,
         한 줄마다 «왜»를 적을 수 있다.
     ═══════════════════════════════════════════════════════════════════════ */

  /* 제외 — 「-block 으로 끝나지만 _block() 에 넘기면 «안» 되는 것」. 각 줄에 이유가 붙는다.
     ⛔여기에 이유 없이 한 줄 더하면 그 종은 조용히 다시 샌다. 늘리려면 이유를 적어라. */
  const _TRAVERSE_SKIP = {
    // 자기 «전용 분기»가 이미 있다 — 여기서도 집으면 이중 처리되고, 게다가 GENERIC 폴백이
    // 프레임 구조(자식·좌표·free-layout)를 납작한 껍데기로 뭉갠다.
    'frame-block': '전용 분기(_processFrameBlock / _frameBlock)가 자식까지 내려간다',
    'group-block': '전용 분기(.group-inner > .row)가 안쪽 row 를 따로 돈다',
    // 컨테이너지 콘텐츠가 아니다. 섹션을 블록으로 집으면 자기 자신을 삼킨다.
    'section-block': '섹션 컨테이너 — 콘텐츠 블록이 아니다',
    /* ★뿌리를 «섹션 직속»까지 넓히면서 새로 필요해진 제외 (2026-09-09).
       어노테이션은 «편집 주석»이지 산출물이 아니다 — 짐작이 아니라 실물 근거가 있다:
       market-merge.js:29 의 normSection 이 .section-label·.section-toolbar·.variation-badge
       와 «같은 줄»에서 .annotation-block 을 지운다. 즉 이 레포는 이미 이걸 «내용이 아님»
       으로 판정하고 있다. 그 판정을 여기서도 따른다. */
    /* ★★★2026-10-24 — ★`'annotation-block'` 을 ★★★뺐다. ★★현빈 ★결정.
       ★★현빈 원문 : 「★왜 ★다르게 ★보냐 · ★★★똑같이 ★해 · ★다른 ★블록처럼」
       ⇒ ★★어노테이션(펜 주석)·치수선을 ★★★다른 블록과 ★★동일 ★취급한다.
         ★Figma JSON · 마켓 비교 · 저장 · 내보내기 ★★전부 ★같게.
       ★★★그리고 ★위 ★주석의 ★까닭이 ★★★죽었다 —
         ★그 까닭은 「★`market-merge.js:29` 가 ★이미 ★«내용 아님»으로 ★판정했다」인데
         ★★★그 줄도 ★★오늘 ★같이 ★고쳤다(★같은 결정) ⇒ ★★기댈 ★근거가 ★없다.
         ★★261024 에 ★`capture-safety` 가 ★★이미 ★그 판정을 ★뒤집었고
         (★현빈 261022 ⒝ 「★최종 이미지에 ★보인다」) ★★적대적 ⒠ 가
         「★★근거가 ★사라졌는데 ★결과는 ★남아 ★있다」로 ★★잡아 ★줬다.
       ★★⇒ ★★위 ★긴 주석은 ★★«역사 문장»이라 ★★그대로 ★둔다(★그때의 ★까닭이다).
         ⛔그 아래 ★한 줄만 ★★걷었다. ★★닫힌 이름 = `ANNOT-STILL-SKIPPED-IN-FIGMA-JSON-01`
       ★재는 자 = `tests/dom/annot-same-as-other-blocks.dom.spec.js` (★양성대조 — ★★«나온다»가 ★참) */
    'qa-block': 'admin QA 전용 체크리스트 — 콘텐츠가 아니라 작업 메타데이터다(export-image.js 와 같은 원칙)',
  };

  /** 핸들러(_block GENERIC 폴백)와 «같은» 판정 + 이유 붙은 제외. */
  function _isContentBlock(el) {
    if (!el || el.nodeType !== 1 || !el.classList) return false;
    const cls = [...el.classList];
    if (!cls.some(c => c.endsWith('-block'))) return false;
    return !cls.some(c => _TRAVERSE_SKIP[c]);
  }
  /** 직속 자식 중 «콘텐츠 블록»만. 네 자리가 전부 이걸 쓴다. */
  function _blockChildren(parent) {
    return parent ? [...parent.children].filter(_isContentBlock) : [];
  }

  function _row(rowEl, ps) {
    /* ★「직속 블록 «이냐» 컬럼 «이냐»」의 갈림길을 없앴다 (2026-09-09).
       ⛔예전엔 둘 중 하나만 골랐다. 그래서 «둘 다 있는» row 에서 한쪽이 통째로 사라졌다.
         실측 — row 안에 canvas-block(직속) + col>text 를 같이 두면:
           고치기 전(canvas 특례) : ["card-grid"]  ← col 의 text 가 사라진다
           특례만 지웠을 때       : ["text"]       ← 직속 canvas 가 사라진다
         ⇒ 어느 쪽도 맞지 않았다. 둘 다 모은다.
       ★그리고 여기서 옛 `directCanvas` 특례(`:scope > .canvas-block` 을 «따로» 집어
         그것만 돌려주던 자리)를 지웠다. 이제 canvas-block 은 _blockChildren 이 «성질»로
         잡으므로 중복이고, 남겨 두면 다음 사람이 「특례가 필요한 자리」로 읽는다.
         (그 특례가 명부에 canvas-block 이 «없다는 사실»을 오래 가려 주고 있었다.) */
    const toBlocks = (els) => {
      const out = [];
      els.forEach(b => out.push(..._blockAll(b, ps)));   // G19 — 그리드면 자식 블럭이 뒤에 붙는다(자식 0개면 _block 과 같다)
      return out;
    };

    const directBlocks = toBlocks(_blockChildren(rowEl));
    const colEls = [...rowEl.children].filter(c => c.classList && c.classList.contains('col'));
    if (!colEls.length) return directBlocks;

    const cols = colEls.map(col => ({
      width: parseInt(col.dataset.width) || 100,
      blocks: toBlocks(_blockChildren(col)),
    }));
    // stack(단일 컬럼) → blocks 직접 반환, 멀티컬럼 → { columns }
    const colPart = (cols.length === 1) ? cols[0].blocks : [{ columns: cols }];
    return [...directBlocks, ...colPart];
  }

  function _section(secEl, ps) {
    const inner = secEl.querySelector('.section-inner');
    if (!inner) return null;

    // 섹션 인라인 스타일에서 label CSS 변수 추출 (DOMParser 환경에서도 동작)
    const labelBg     = secEl.style.getPropertyValue('--preset-label-bg').trim()     || '#111111';
    const labelColor  = secEl.style.getPropertyValue('--preset-label-color').trim()  || '#ffffff';
    const labelRadius = parseFloat(secEl.style.getPropertyValue('--preset-label-radius')) || 8;
    const psEx = { ...ps, labelBg, labelColor, labelRadius };

    const blocks = [];
    function _processFrameBlock(fb) {
      _blockChildren(fb).forEach(b => {
        _blockAll(b, psEx).forEach(x => blocks.push(x));   // G19 — 그리드면 자식 블럭까지
      });
      fb.querySelectorAll(':scope > .frame-block').forEach(nested => _processFrameBlock(nested));
    }
    // free-layout 프레임: 절대배치 구조 보존(높이·배경·자식 위치) → 렌더 충실도↑.
    function _frameBlock(fb) {
      // ★0919 QA: 폭 = 캔버스에서 «보이는» 폭. dataset.width(860)인데 max-width:100% 로 716 에 눌린 프레임이
      //   Figma 에선 860 으로 나갔다. 지금 페이지의 살아 있는 요소가 있으면 그 layout 폭(줌 transform 무관)이 더 좁을 때 그걸 쓴다.
      const _liveFb = fb.id ? document.getElementById(fb.id) : null;
      const _liveW = _liveFb && _liveFb.offsetWidth ? _liveFb.offsetWidth : 0;
      // dataset.width 가 '100%'(⌘G 섹션레벨 그룹)면 parseInt 가 100(px)으로 읽혀 Figma 에서 100px 폭이 됐다 → 실폭(없으면 null=가용폭)
      const _dsPct = /%\s*$/.test(String(fb.dataset.width || ''));
      const _dsW = _dsPct ? null : (parseInt(fb.dataset.width) || null);
      const w = _dsPct ? (_liveW || null) : ((_dsW && _liveW && _liveW < _dsW) ? _liveW : _dsW);
      const h = parseInt(fb.dataset.height) || parseFloat(fb.style.height) || 0;
      const free = fb.dataset.freeLayout === 'true';
      const children = [];
      [...fb.children].forEach(c => {
        const x = parseFloat(c.style.left) || 0;
        const y = parseFloat(c.style.top) || 0;
        const cwRaw = (c.style.width || '').trim();
        const cw = cwRaw.endsWith('%') ? Math.round((parseFloat(cwRaw) / 100) * (w || 716)) : (parseFloat(cwRaw) || (w || 716));
        let innerB = c.classList.contains('frame-block') ? _frameBlock(c) : _block(c, psEx);
        if (innerB) {
          if (free && innerB.type === 'text') innerB.padding = { top: 0, right: 0, bottom: 0, left: 0 };
          children.push({ x, y, w: cw, block: innerB });
          /* G19 — 자유배치 프레임 안 그리드의 «밑» 자식: 같은 x, y = 그리드 y + 살아 있는 문서에서 잰 dy. */
          const _g = _hasKidsShell(c) ? c
            : (c.classList.contains('row') ? [...c.children].find(_hasKidsShell) || null : null);   /* ★표 한 자리에서 */
          if (_g) _gridKidBlocks(_g, psEx).forEach(k => k.blocks.forEach(b => children.push({ x, y: y + (k.dy ?? 0), w: cw, block: b })));
        }
      });
      const _bg = fb.dataset.bg || '';
      const out = { type: 'frame', id: fb.id || '', width: w, height: h,
               bg: _bg, radius: parseInt(fb.dataset.radius) || 0, free, children };
      // ★0919 QA: 배경 그라데이션 → 모델(렌더러가 set_gradient 로 칠함). 예전엔 렌더러가 CSS 문자열에서 «처음 나오는 rgba()»
      //   를 단색으로 칠해 가운데 스탑 색 한 가지가 됐다.
      if (/gradient\s*\(/i.test(_bg)) {
        const g = parseGradient(_bg);
        if (g && Array.isArray(g.stops) && g.stops.length >= 2) out.bgGradient = { type: g.type, angle: g.angle, stops: g.stops };
      }
      return out;
    }
    /* G19 — 떠 있는(오버레이) 그리드의 «밑» 자식도 떠 있는 블럭으로: 같은 x, y = 그리드 y + dy(살아 있는 문서에서 잼). */
    function _pushFloatingGridKids(el, parsed) {
      if (!_hasKidsShell(el)) return;   /* ★표 한 자리에서 */
      _gridKidBlocks(el, psEx).forEach(k => k.blocks.forEach(b => {
        blocks.push({ ...b, floating: true, x: parsed.x, y: parsed.y + (k.dy ?? 0) });
      }));
    }
    _frameBlockFn = _frameBlock;   // G19 — 그리드 자식 중 자유배치 프레임은 이 섹션의 _frameBlock 으로
    /* ★.section-merged-part(합쳐 넣은 아래 섹션의 몸)는 «투명하게» 통과한다.
       이 화이트리스트에 안 걸리면 자식을 내려가 보지도 않고 버려서, 합친 섹션을
       내보내면 아래쪽 몸이 «조용히» 통째로 사라진다(에러도 경고도 없다). */
    const _walkSectionChild = (child) => {
      if (child.classList.contains('section-merged-part')) {
        [...child.children].forEach(_walkSectionChild);
        return;
      }
      if (child.classList.contains('row')) {
        _row(child, psEx).forEach(b => blocks.push(b));
      } else if (child.classList.contains('group-block')) {
        child.querySelectorAll(':scope > .group-inner > .row').forEach(r => {
          _row(r, psEx).forEach(b => blocks.push(b));
        });
      } else if (child.classList.contains('gap-block')) {
        blocks.push({ type: 'gap', height: parseFloat(child.style.height) || 50 });
      } else if (child.classList.contains('frame-block')) {
        if (child.dataset.freeLayout === 'true') blocks.push(_frameBlock(child));
        else _processFrameBlock(child);
      } else if (_isContentBlock(child)) {
        // section-inner 직속 콘텐츠 블록(row/frame 미포함) — 드롭 방지. G19 — 그리드면 자식 블럭까지.
        _blockAll(child, psEx).forEach(x => blocks.push(x));
      }
    };
    [...inner.children].forEach(_walkSectionChild);

    /* ═══ ★순회의 «뿌리»는 .section-inner 하나가 아니다 ═══════════════════════
       ⛔2026-09-09 까지 이 순회는 `[...inner.children]` «만» 돌았다. 그런데 플로팅 블록
         (zoom·sticker·gradient…)은 .section-block «직속»에 position:absolute 로 산다
         — `sec.appendChild(block)` (sticker-block.js:558 · zoom-block.js:411 ·
         gradient-block.js:150, 셋 다 「섹션 직접 자식 (absolute → 섹션 기준)」이라 적혀 있다).
         ⇒ .section-inner 의 «형제»라서 방문 «대상 자체»가 아니었다.
       ★그래서 셀렉터를 아무리 «성질»로 바꿔도 이 부류엔 닿지 않는다. 뿌리를 넓혀야 닿는다.
         (같은 뿌리에서 PNG 쪽은 「섹션 높이에 기여를 안 해 잘린다」로 나타난다 — 별건.)

       ⛔셋을 «이름»으로 적지 않는다. 그러면 네 번째 플로팅 블록이 생기는 날 조용히 빠진다
         — 오늘 이 병이 난 이유가 정확히 그것이다. 「.section-inner 가 아닌 섹션 직속
         콘텐츠 블록」이라는 «구조»로 집는다.

       ⚠️FIGMA_ENABLED=false 이던 시절(globals.js:50 · index.html 킬스위치)에 이 부류가
         통째로 빠져 있었다. 다음 런칭에 「한 글자」로 켜질 때 바로 맞아야 한다. */
    [...secEl.children]
      // ⛔오버레이(플로팅)는 아래 «전용 분기»가 좌표규약(offsetX/offsetY)까지 맞춰 집는다 —
      //   여기서도 집으면 에셋 오버레이가 두 번 실린다(.asset-block 은 콘텐츠 블록이다).
      .filter(c => c !== inner && c.dataset?.overlayBlock !== 'true' && _isContentBlock(c))
      .forEach(fc => {
        const parsed = _block(fc, psEx);
        if (!parsed) return;
        /* ★좌표를 «같이» 싣는다 — 순서만 넣으면 위치가 사라진다.
           ★출처는 dataset.x/y 다. style.left/top 은 «캔버스 절대 y»가 들어가 있을 수 있다
             (zoom-block.js:227 실측: 섹션 간 드래그 뒤 dataset.y=114 인데 style.top=960,
              차이 846 = 그 섹션의 offsetTop). dataset 이 단일 진실원이고 style 은 그걸 되읽어 쓴다.
           ⇒ dataset 을 먼저 보고, 없을 때만 style 로 떨어진다. */
        const dx = fc.dataset.x, dy = fc.dataset.y;
        parsed.floating = true;
        parsed.x = (dx !== undefined && dx !== '') ? (parseFloat(dx) || 0) : (parseFloat(fc.style.left) || 0);
        parsed.y = (dy !== undefined && dy !== '') ? (parseFloat(dy) || 0) : (parseFloat(fc.style.top)  || 0);
        blocks.push(parsed);
        _pushFloatingGridKids(fc, parsed);
      });

    /* ★오버레이(플로팅) 텍스트 — js/props/prop-text-wireup-overlay.js 의 _enterOverlay 가
       `sec.appendChild(posEl)` 로 심는 posEl 은 .text-block 이 아니라 그 «래퍼»
       .frame-block[data-text-frame="true"] 다(텍스트는 항상 이 래퍼에 담겨 만들어진다 —
       block-factory.js:1389). 위 순회는 frame-block 을 통째로 제외한다(_TRAVERSE_SKIP —
       「전용 분기(_processFrameBlock/_frameBlock)가 자식까지 내려간다」는 이유인데, 그 전용
       분기는 «inner.children 을 도는 _walkSectionChild»에서만 불린다. 이 래퍼는 inner 의
       형제(섹션 직속)라 그 순회를 타지 않는다 ⇒ 어느 쪽에도 안 걸려 통째로 드롭됐다
       (2026-09-15 실측: 오버레이로 전환만 해도 내보내기에서 사라진다 — 프레임 드롭과 무관).
       ★위치 출처는 dataset.x/y 가 아니라 dataset.offsetX/offsetY 다(다른 키 — _enterOverlay
       가 이 키에 쓴다, prop-text-wireup-overlay.js:73-74). style.left/top 은 항상 최신이므로
       폴백으로 쓴다. */
    [...secEl.children]
      /* ★2026-09-20(0920b-overlay-extend) — 판정을 «타입 비의존»으로 넓혔다. 도형 오버레이의
         posEl 은 자유배치 «래퍼 프레임»이라 _TRAVERSE_SKIP['frame-block'] 에 걸려 위 순회에서도
         빠진다 ⇒ 안 넓히면 도형을 오버레이로 띄우는 순간 Figma 내보내기에서 «조용히» 사라진다
         (화면엔 멀쩡해 가장 늦게 발견되는 부류). 에셋 오버레이는 위 순회에 걸리긴 하지만
         좌표를 dataset.x/y 에서 찾아 offsetX/offsetY 를 못 읽는다 — 여기로 모은다.
         ⚠️data-text-frame 조건은 «or» 로 남긴다: 옛 프로젝트에 overlayBlock 없이 섹션 직속으로
           남은 텍스트프레임이 있어도 예전처럼 실린다(회귀 0). */
      .filter(c => c !== inner && (
        c.dataset?.overlayBlock === 'true'
        || (c.classList.contains('frame-block') && c.dataset.textFrame === 'true')))
      .forEach(tf => {
        // 래퍼면 안쪽 콘텐츠 블록, 아니면(에셋 등) 자기 자신. 이름 목록이 아니라 구조로 집는다.
        const tb = tf.classList.contains('frame-block')
          ? (tf.querySelector('.text-block') || tf.querySelector('.shape-block'))
          : tf;
        if (!tb) return;
        const parsed = _block(tb, psEx);
        if (!parsed) return;
        const dx = tf.dataset.offsetX, dy = tf.dataset.offsetY;
        parsed.floating = true;
        parsed.x = (dx !== undefined && dx !== '') ? (parseFloat(dx) || 0) : (parseFloat(tf.style.left) || 0);
        parsed.y = (dy !== undefined && dy !== '') ? (parseFloat(dy) || 0) : (parseFloat(tf.style.top)  || 0);
        blocks.push(parsed);
        _pushFloatingGridKids(tb, parsed);
      });

    const bgColor = secEl.style.backgroundColor || '';
    const styleAttr = secEl.getAttribute('style') || '';
    /* ★1017t1k1·k2 — rotate·색보정이 ★걸린 섹션은 ★레이어(.sec-bg-img, js/bg-layer.js)가 그림을
       들고 있고 본체(secEl)의 backgroundImage 는 'none' 이다 — ★레이어를 ★먼저 본다. */
    const _bgLayerEl = secEl.querySelector?.(':scope > .sec-bg-clip > .sec-bg-img') || null;
    const _bgLayerImg = _bgLayerEl ? (_bgLayerEl.style.backgroundImage || '') : '';
    const bgImgRaw = (_bgLayerImg && _bgLayerImg !== 'none')
      ? _bgLayerImg
      : (secEl.style.backgroundImage || (/background(-image)?:\s*([^;]+)/.exec(styleAttr) || [])[2] || '');
    // 섹션 배경: 이미지(data URI 또는 goya-asset://) / 그라디언트 / 솔리드 분기
    // ★goya-asset URL은 buildFigmaExportJSONInlined 후처리에서 data URI로 치환된다.
    let bgImage = '';
    const urlM = /url\(["']?((?:data:image|goya-asset:\/\/)[^"')]+)["']?\)/.exec(bgImgRaw);
    if (urlM) bgImage = urlM[1];
    const isGradient = /gradient/.test(bgImgRaw) && !urlM;
    // 섹션 실제 렌더색을 라이브 getComputedStyle로 읽는다 — .section-block{background:#fff}
    // 클래스 때문에 흰 섹션(74개)이 흰색으로 잡힌다. 진짜 투명한 섹션만 페이지배경(ps.bg)으로 채운다.
    // (예전엔 inline bg만 보고 흰 섹션에 ps.bg(회색)를 과적용해 Figma만 회색 되는 역갭이 있었음)
    const _liveEl = secEl.id ? document.getElementById(secEl.id) : null;
    const _liveBg = _liveEl ? getComputedStyle(_liveEl).backgroundColor : '';
    const _liveOpaque = _liveBg && _liveBg !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(_liveBg);
    let background;
    if (_liveOpaque) background = _liveBg;
    else if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') background = bgColor;
    else background = isGradient ? '#eeeeee' : (ps.bg || '#ffffff'); // 진짜 투명 섹션 → 페이지 회색
    const name = secEl.dataset.name
      || secEl.querySelector('.section-label')?.textContent?.trim()
      || 'Section';
    return { id: secEl.id || '', name, background, bgImage, blocks };
  }

  const parser = new DOMParser();
  const allSections = [];
  const nm = nodeMap || {};

  state.pages.forEach(pg => {
    const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
    const ps  = pg.pageSettings || state.pageSettings;
    /* ★숨은 A/B 시안은 «업로드에도» 안 싣는다 — 피그마에 안 고른 시안이 한 벌 더 얹히던 자리.
       exportFigmaJSON(파일 저장)과 «같은 술어»를 본다(js/variation-visibility.js). */
    doc.querySelectorAll(`#c > .section-block:not([data-ghost])${NOT_HIDDEN_VARIATION}`).forEach(sec => {
      const secId = sec.id || '';
      // selectedIds 필터링 (null 이면 전체 포함)
      if (selectedIds && !selectedIds.includes(secId)) return;

      const s = _section(sec, ps);
      if (!s) return;

      // node_map 에 등록된 섹션이면 figmaId / figmaY 주입 (업데이트 모드)
      const mapped = nm[secId];
      if (mapped?.figmaId) {
        s.figmaId = mapped.figmaId;
        if (mapped.y !== undefined) s.figmaY = mapped.y;
      }

      allSections.push(s);
    });
  });

  const ps = state.pageSettings;
  return {
    version: 'sangpe-design-v1',
    meta: {
      title: document.getElementById('project-tab-name')?.textContent?.trim() || 'Untitled',
      canvasWidth: CANVAS_W || 860,
      theme: { background: ps.bg, sectionGap: ps.gap },
      exportedAt: new Date().toISOString(),
    },
    sections: allSections,
  };
}

/**
 * buildFigmaExportJSON + goya-asset:// → data URI 재인라인(후처리).
 * 빌드 함수는 동기 DOM 순회라 그대로 두고, 결과 JSON에서 goya-asset URL을 모아
 * IPC(assets:readAsDataUri)로 1회씩 읽어 치환한다. 피그마 플러그인은 커스텀 스킴을 못 가져오므로
 * 업로드 경로(figma-publish.js doFigmaUpload)는 이 함수를 써야 이미지가 빠지지 않는다.
 * ⚠️ 실패(IPC 없음=웹·파일 없음)는 원본 URL 유지 + unresolvedAssets 로 보고 → 호출측이 토스트.
 * @returns {Promise<{ json, totalAssets, resolvedAssets, unresolvedAssets, unresolvedUrls }>}
 */
async function buildFigmaExportJSONInlined(selectedIds, nodeMap) {
  const json = buildFigmaExportJSON(selectedIds, nodeMap);
  const r = await inlineGoyaAssetsInJSON(json, makeElectronAssetReader());
  if (r.unresolvedAssets) console.warn('[export-figma-json] 재인라인 실패 에셋', r.unresolvedAssets, '건 — 원본 URL 유지', r.unresolvedUrls);
  return r;
}

export {
  exportFigmaJSON,
  getTextWithLineBreaks,
  buildFigmaExportJSON,
  buildFigmaExportJSONInlined,
};

// Backward compat

window.exportFigmaJSON       = exportFigmaJSON;
window.getTextWithLineBreaks = getTextWithLineBreaks;
window.buildFigmaExportJSON  = buildFigmaExportJSON;
window.buildFigmaExportJSONInlined = buildFigmaExportJSONInlined;
